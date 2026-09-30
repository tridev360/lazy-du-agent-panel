const test = require("node:test"),
  a = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { Metrics, UsageIndex } = require("../src/lib/usage.cjs");
const stamp = "2030-01-02T12:00:00Z",
  session = ".claude/projects/demo/11111111-1111-1111-1111-111111111111.jsonl";
const event = (id = "m", tokens = 3) =>
  JSON.stringify({
    type: "assistant",
    timestamp: stamp,
    message: {
      id,
      usage: { input_tokens: tokens, output_tokens: 0 },
      content: [{ text: "FIXTURE_CONTENT_MUST_NOT_APPEAR" }],
    },
  });
function home(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "usage-budget-fixture-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function write(dir, name, text) {
  const file = path.join(dir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return file;
}
async function finish(m) {
  for (let n = 0; n < 100; n++) {
    await m.refresh();
    if (!m.snapshot().pending) return;
  }
  throw Error("Fixture scan did not finish");
}
test("missing usage is null, while an explicit zero usage remains zero", () => {
  const i = new UsageIndex();
  a.equal(i.snapshot().claude.tokens, null);
  i.consume(
    "claude",
    "fixture",
    JSON.stringify({
      type: "assistant",
      timestamp: stamp,
      message: { id: "missing" },
    }),
  );
  a.equal(i.snapshot().claude.tokens, null);
  i.consume("claude", "fixture", event("zero", 0));
  a.equal(i.snapshot().claude.tokens, 0);
});
test("refresh yields immediately and discovers without synchronous filesystem calls", async (t) => {
  const dir = home(t);
  write(dir, session, event() + "\n");
  const m = new Metrics(dir);
  const original = fs.readdirSync;
  let calls = 0;
  fs.readdirSync = (...args) => {
    calls++;
    return original(...args);
  };
  try {
    const p = m.refresh();
    a.equal(calls, 0);
    a.equal(m.running, true);
    await p;
    a.equal(calls, 0);
  } finally {
    fs.readdirSync = original;
  }
});
test("discovery resumes across bounded entry rounds without reporting completion early", async (t) => {
  const dir = home(t);
  for (let n = 0; n < 12; n++)
    write(
      dir,
      ".claude/projects/project-" +
        n +
        "/11111111-1111-1111-1111-111111111111.jsonl",
      event("m" + n) + "\n",
    );
  const m = new Metrics(dir, {
    limits: { entries: 2, bytes: 4096, milliseconds: 500 },
  });
  await m.refresh();
  a.equal(m.snapshot().pending, true);
  a.equal(m.snapshot().complete, false);
  await finish(m);
  a.equal(m.snapshot().sessions.length, 12);
  a.equal(m.snapshot().claude.tokens, 36);
  a.equal(m.snapshot().complete, true);
});
test("first reads obey the byte budget and resume at safe line boundaries", async (t) => {
  const dir = home(t);
  let text = "";
  for (let n = 0; n < 80; n++) text += event("m" + n) + "\n";
  write(dir, session, text);
  const m = new Metrics(dir, {
    limits: { entries: 128, bytes: 512, milliseconds: 500 },
  });
  const original = fs.promises.open;
  let read = 0;
  fs.promises.open = async (...args) => {
    const handle = await original(...args),
      old = handle.read.bind(handle);
    handle.read = async (...args) => {
      const result = await old(...args);
      read += result.bytesRead;
      return result;
    };
    return handle;
  };
  try {
    await m.refresh();
    a.ok(read <= 512, "round read " + read + " bytes");
    a.equal(m.snapshot().complete, false);
    a.equal(m.snapshot().pending, true);
    await finish(m);
    a.equal(m.snapshot().claude.tokens, 240);
    a.equal(m.snapshot().complete, true);
  } finally {
    fs.promises.open = original;
  }
});
test("permission failure in a project is partial, never a measured zero", async (t) => {
  const dir = home(t);
  write(dir, session, event() + "\n");
  const denied = path.join(dir, ".claude", "projects", "demo"),
    original = fs.promises.opendir;
  fs.promises.opendir = async (file, ...args) => {
    if (path.resolve(file) === denied) {
      const error = Error("fixture denied");
      error.code = "EACCES";
      throw error;
    }
    return original(file, ...args);
  };
  try {
    const m = new Metrics(dir);
    await finish(m);
    const s = m.snapshot();
    a.equal(s.available.claude, true);
    a.equal(s.claude.tokens, null);
    a.equal(s.complete, false);
    a.ok(s.errors > 0);
  } finally {
    fs.promises.opendir = original;
  }
});
test("readable histories without usage metadata remain unknown and incomplete", async (t) => {
  const dir = home(t);
  write(
    dir,
    session,
    JSON.stringify({
      type: "assistant",
      timestamp: stamp,
      message: { id: "missing" },
    }) + "\n",
  );
  const m = new Metrics(dir);
  await finish(m);
  const s = m.snapshot();
  a.equal(s.available.claude, true);
  a.equal(s.claude.tokens, null);
  a.equal(s.complete, false);
});
test("UTF8 and incomplete appended records survive the cursor without duplicate tokens", async (t) => {
  const dir = home(t),
    record = JSON.stringify({
      type: "assistant",
      timestamp: stamp,
      message: {
        id: "m",
        usage: { input_tokens: 7 },
        content: [{ text: "fixture é" }],
      },
    });
  const encoded = Buffer.from(record),
    split = encoded.indexOf(Buffer.from("é")) + 1,
    file = write(dir, session, encoded.subarray(0, split)),
    m = new Metrics(dir, {
      limits: { entries: 128, bytes: 64, milliseconds: 500 },
    });
  await finish(m);
  a.equal(m.snapshot().claude.tokens, null);
  fs.appendFileSync(
    file,
    Buffer.concat([encoded.subarray(split), Buffer.from("\n")]),
  );
  await finish(m);
  a.equal(m.snapshot().claude.tokens, 7);
  await finish(m);
  a.equal(m.snapshot().claude.tokens, 7);
});

test("a denied usage file remains partial even when its history folder is readable", async (t) => {
  const dir = home(t),
    file = write(dir, session, event() + "\n"),
    original = fs.promises.open;
  fs.promises.open = async (target, ...args) => {
    if (path.resolve(target) === file) {
      const error = Error("fixture denied");
      error.code = "EACCES";
      throw error;
    }
    return original(target, ...args);
  };
  try {
    const m = new Metrics(dir);
    await finish(m);
    const s = m.snapshot();
    a.equal(s.claude.tokens, null);
    a.equal(s.complete, false);
    a.ok(s.errors > 0);
  } finally {
    fs.promises.open = original;
  }
});
test("oversized records are skipped with an error and a later usage record still reads", async (t) => {
  const dir = home(t);
  write(
    dir,
    session,
    JSON.stringify({ type: "user", content: "x".repeat(140000) }) +
      "\n" +
      event() +
      "\n",
  );
  const m = new Metrics(dir, {
    limits: { entries: 128, bytes: 32768, milliseconds: 100 },
  });
  await finish(m);
  const s = m.snapshot();
  a.equal(s.claude.tokens, 3);
  a.ok(s.errors > 0);
  a.equal(s.complete, false);
  a.ok(!JSON.stringify(s).includes("FIXTURE_CONTENT"));
});
test("real metadata reaches the HTTP envelope in less than two seconds on a fake home", async (t) => {
  const { createServer } = require("../src/panel.cjs"),
    dir = home(t);
  write(dir, session, event() + "\n");
  const server = createServer({ base: dir, metrics: new Metrics(dir) });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = "http://127.0.0.1:" + server.address().port + "/api/status",
    begin = performance.now();
  let data = await (await fetch(url)).json();
  a.ok(performance.now() - begin < 2000);
  while (
    data.usage.claude.tokens === null &&
    performance.now() - begin < 1900
  ) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    data = await (await fetch(url)).json();
  }
  a.equal(data.usage.claude.tokens, 3);
  a.ok(performance.now() - begin < 2000);
  a.ok(!JSON.stringify(data).includes(dir));
});

test("overflowing usage is not a valid zero measurement", () => {
  const index = new UsageIndex();
  index.consume(
    "claude",
    "fixture",
    JSON.stringify({
      type: "assistant",
      timestamp: stamp,
      message: {
        id: "overflow",
        usage: { input_tokens: Number.MAX_SAFE_INTEGER, output_tokens: 1 },
      },
    }),
  );
  a.equal(index.snapshot().claude.tokens, null);
});
test("pending rounds share one process read instead of starting a query every time", async (t) => {
  const dir = home(t);
  write(dir, session, event() + "\n");
  let calls = 0;
  const m = new Metrics(dir, {
    limits: { entries: 1, bytes: 4096, milliseconds: 100 },
    processReader: async () => {
      calls++;
      return null;
    },
  });
  await finish(m);
  a.equal(calls, 1);
});
test("a recent Codex quota is visible before a large history finishes scanning", async (t) => {
  const dir = home(t),
    line =
      JSON.stringify({
        type: "response_item",
        payload: { content: "fixture padding ".repeat(50) },
      }) + "\n";
  const quota =
    JSON.stringify({
      type: "event_msg",
      timestamp: stamp,
      payload: {
        type: "token_count",
        rate_limits: { primary: { used_percent: 42, window_minutes: 10080 } },
      },
    }) + "\n";
  write(
    dir,
    ".codex/sessions/2030/01/02/rollout-2030-01-02T12-00-00-a.jsonl",
    line.repeat(1000) + quota,
  );
  const m = new Metrics(dir, {
    limits: { entries: 128, bytes: 262144, milliseconds: 100 },
  });
  await m.refresh();
  a.equal(m.snapshot().codex.windows[0].used, 42);
  a.equal(m.snapshot().complete, false);
  a.equal(m.snapshot().pending, true);
  await finish(m);
});

test("unfinished and newline-free records leave no conversation bytes in persistent state", async (t) => {
  const sentinel = "CURSOR_PRIVATE_CONTENT_FIXTURE";
  for (const unfinished of [true, false]) {
    const dir = home(t),
      line = JSON.stringify({
        type: "assistant",
        timestamp: stamp,
        message: {
          id: "private-fixture",
          usage: { input_tokens: 9 },
          content: [{ text: sentinel }],
        },
      });
    const file = write(dir, session, unfinished ? line.slice(0, -3) : line),
      m = new Metrics(dir);
    await finish(m);
    for (const cursor of m.scanned.values()) {
      a.ok(
        Object.values(cursor).every(
          (value) => typeof value === "number" || typeof value === "boolean",
        ),
        "cursor retains only counters and flags",
      );
      a.ok(!JSON.stringify(cursor).includes(sentinel));
    }
    const serialized = JSON.stringify([...m.index.files.values()]);
    a.ok(!serialized.includes(sentinel));
    a.ok(!JSON.stringify(m.snapshot()).includes(sentinel));
    fs.appendFileSync(
      file,
      (unfinished ? line.slice(-3) : "") + "\n" + event("next", 2) + "\n",
    );
    await finish(m);
    a.equal(m.snapshot().claude.tokens, 11);
    await finish(m);
    a.equal(m.snapshot().claude.tokens, 11);
  }
});

test("small budgets finish at most one known bounded line per round", async (t) => {
  const { readUsage } = require("../src/lib/usage.cjs"),
    dir = home(t),
    first = event("first", 3),
    second = event("second", 4),
    file = write(dir, session, first + "\n" + second + "\n");
  const cursor = {
      offset: 0,
      probe: first.length,
      dropping: false,
      errors: 0,
      lineEnd: Buffer.byteLength(first),
      lineNext: Buffer.byteLength(first) + 1,
    },
    index = new UsageIndex(),
    budget = {
      bytes: 64,
      capBytes: 64,
      read: 0,
      deadline: performance.now() + 1000,
    };
  await readUsage(file, "claude", index, {
    state: cursor,
    root: path.dirname(file),
    budget,
  });
  a.equal(index.snapshot().claude.tokens, 3);
  a.equal(cursor.offset, Buffer.byteLength(first) + 1);
  a.equal(cursor.done, false);
  a.equal(budget.completedLine, true);
  a.equal(budget.read, Buffer.byteLength(first));
  a.ok(
    Object.values(cursor).every(
      (value) => typeof value === "number" || typeof value === "boolean",
    ),
  );
});
test("the absolute one MiB read cap includes every reread even with an oversized injected budget", async (t) => {
  const { readUsage } = require("../src/lib/usage.cjs"),
    dir = home(t),
    line =
      JSON.stringify({
        type: "user",
        content: "safe fixture padding ".repeat(50),
      }) + "\n",
    file = write(dir, session, line.repeat(2000));
  const cursor = { offset: 0, probe: 0, dropping: false, errors: 0 },
    budget = {
      bytes: 2 * 1024 * 1024,
      capBytes: 2 * 1024 * 1024,
      read: 0,
      deadline: performance.now() + 1000,
    };
  await readUsage(file, "claude", new UsageIndex(), {
    state: cursor,
    root: path.dirname(file),
    budget,
  });
  a.ok(budget.read <= 1024 * 1024);
  a.equal(cursor.done, false);
  a.ok(
    Object.values(cursor).every(
      (value) => typeof value === "number" || typeof value === "boolean",
    ),
  );
});

test("append before resuming an old known EOF extends the probe and counts the new record", async (t) => {
  const { readUsage } = require("../src/lib/usage.cjs"),
    dir = home(t),
    first = event("first", 3),
    second = event("second", 4),
    length = Buffer.byteLength(first);
  const file = write(dir, session, first + "\n" + second + "\n"),
    cursor = {
      offset: 0,
      probe: length,
      dropping: false,
      errors: 0,
      lineEnd: length,
      lineNext: length,
    },
    index = new UsageIndex();
  await readUsage(file, "claude", index, {
    state: cursor,
    root: path.dirname(file),
  });
  a.equal(index.snapshot().claude.tokens, 7);
  a.equal(cursor.done, true);
  a.equal(cursor.offset, fs.statSync(file).size);
  a.ok(
    Object.values(cursor).every(
      (value) => typeof value === "number" || typeof value === "boolean",
    ),
  );
});
