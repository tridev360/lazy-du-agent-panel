const test = require("node:test"),
  a = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { projectJSON } = require("../src/lib/project-json.cjs"),
  {
    UsageIndex,
    record,
    windowsOf,
    blocked,
    safeFile,
    discover,
    Metrics,
  } = require("../src/lib/usage.cjs"),
  {
    parseTask,
    parseQueue,
    workspace,
    init,
  } = require("../src/lib/workspace.cjs"),
  { identify } = require("../src/lib/processes.cjs");
const stamp = "2030-01-02T12:00:00Z",
  claude = (id = "m", output = 5, time = stamp) =>
    JSON.stringify({
      type: "assistant",
      timestamp: time,
      message: {
        id,
        content: [{ text: "SECRET_NOT_TO_KEEP" }],
        usage: {
          input_tokens: 10,
          output_tokens: output,
          cache_read_input_tokens: 7,
          cache_creation_input_tokens: 3,
        },
      },
    }),
  codex = (used = 30, time = stamp) =>
    JSON.stringify({
      type: "event_msg",
      timestamp: time,
      payload: {
        type: "token_count",
        info: { total_token_usage: { total_tokens: 55 } },
        rate_limits: {
          primary: {
            used_percent: used,
            window_minutes: 10080,
            resets_at: 1893585600,
          },
        },
      },
    });
function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lazy-panel-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function write(dir, file, text) {
  const full = path.join(dir, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
  return full;
}
test("JSON projector ignores conversation, spoofed usage and escaped strings", () => {
  const text = JSON.stringify({
    type: "assistant",
    timestamp: stamp,
    message: { content: [{ text: codex(99) }], usage: { input_tokens: 3 } },
    usage: { input_tokens: 888 },
  });
  const r = projectJSON(text, ["type", "message.usage.input_tokens"]);
  a.deepEqual(r, { type: "assistant", "message.usage.input_tokens": 3 });
  a.ok(!JSON.stringify(r).includes("99"));
});
test("projector rejects truncated and excessive nesting", () => {
  a.equal(record('{"type":"assistant"'), null);
  a.equal(record("[".repeat(82) + "0" + "]".repeat(82)), null);
  a.throws(() => projectJSON("true garbage", ["type"]));
});
test("latest Codex token event gives quota, zero and full are real measures", () => {
  const i = new UsageIndex();
  i.consume("codex", "one", codex(100));
  i.consume("codex", "two", codex(0, "2030-01-03T12:00:00Z"));
  i.consume("codex", "old", codex(75, "2029-12-30T12:00:00Z"));
  a.equal(i.snapshot().codex.windows[0].used, 0);
  a.equal(i.snapshot().sessions.find((x) => x.id).tokens, 55);
});
test("messages with fake token_count do not become quota", () => {
  const i = new UsageIndex();
  i.consume(
    "codex",
    "one",
    JSON.stringify({
      type: "response_item",
      timestamp: stamp,
      payload: {
        type: "token_count",
        rate_limits: { primary: { used_percent: 12, window_minutes: 10080 } },
      },
    }),
  );
  a.equal(i.snapshot().codex, null);
});
test("invalid percentages and missing quota stay unknown", () => {
  for (const n of [-1, 101, "0", null]) {
    const i = new UsageIndex();
    i.consume("codex", "one", codex(n));
    a.equal(i.snapshot().codex, null);
  }
  a.equal(
    windowsOf({
      "payload.rate_limits.primary.usedPercent": 15,
      "payload.rate_limits.primary.windowDurationMins": 60,
    })[0].used,
    15,
  );
});
test("Claude streaming repeats count once, all cache tokens included", () => {
  const i = new UsageIndex();
  i.consume("claude", "private-session-path", claude());
  i.consume(
    "claude",
    "private-session-path",
    claude("m", 8, "2030-01-02T12:01:00Z"),
  );
  i.consume("claude", "private-session-path", claude("m", 1));
  i.consume(
    "claude",
    "private-session-path",
    claude("next", 2, "2030-01-03T12:00:00Z"),
  );
  const s = i.snapshot();
  a.equal(s.claude.tokens, 50);
  a.deepEqual(s.daily, [
    { day: "2030-01-03", tokens: 22 },
    { day: "2030-01-02", tokens: 28 },
  ]);
  a.equal(s.claude.windows.length, 0);
  a.ok(!JSON.stringify(s).includes("SECRET"));
  a.ok(!JSON.stringify(s).includes("private-session-path"));
});
test("negative Claude usage never looks like zero", () => {
  const i = new UsageIndex();
  i.consume("claude", "f", claude("m", -2));
  a.equal(i.snapshot().sessions.length, 0);
});
test("discovery permits dated rollouts, project UUID sessions and subagents only", async (t) => {
  const dir = temp(t);
  write(
    dir,
    ".codex/sessions/2030/01/02/rollout-2030-01-02T12-00-00-a.jsonl",
    codex(),
  );
  write(
    dir,
    ".claude/projects/project/11111111-1111-1111-1111-111111111111.jsonl",
    claude(),
  );
  write(
    dir,
    ".claude/projects/project/11111111-1111-1111-1111-111111111111/subagents/agent-abcd.jsonl",
    claude(),
  );
  write(dir, ".claude/projects/project/auth.json", "DO NOT READ");
  write(dir, ".codex/sessions/.env", "DO NOT READ");
  let result = await discover(dir, new Date());
  while (!result.complete)
    result = await discover(dir, new Date(), { state: result.state });
  a.equal(result.files.length, 3);
});
test("protected names and links outside a reader root are rejected", (t) => {
  const dir = temp(t),
    other = temp(t);
  for (const p of [
    ".env",
    "settings.env",
    "auth.json",
    "my-secret/a",
    "private-signing-key/b",
    "wallet-backup/c",
    "seed-phrase/d",
    "id_rsa.pub",
    "credentials-local",
  ])
    a.equal(blocked(p), true);
  const target = write(other, "outside.md", "secret");
  let link;
  try {
    link = path.join(dir, "linked.md");
    fs.symlinkSync(target, link);
  } catch {
    return;
  }
  a.equal(safeFile(dir, link), false);
});
test("zero config reads only permitted usage fields and completes asynchronous scan", async (t) => {
  const dir = temp(t);
  write(
    dir,
    ".codex/sessions/2030/01/02/rollout-2030-01-02T12-00-00-a.jsonl",
    codex(),
  );
  write(
    dir,
    ".claude/projects/project/11111111-1111-1111-1111-111111111111.jsonl",
    claude() + "\n" + claude(),
  );
  const m = new Metrics(dir, {
    processReader: async () => ({ claude: 1, codex: 2 }),
  });
  a.equal(m.snapshot().codex, null);
  await settle(m);
  const s = m.snapshot();
  a.equal(s.codex.windows[0].used, 30);
  a.equal(s.claude.tokens, 25);
  a.equal(s.complete, true);
  a.deepEqual(s.processes, { claude: 1, codex: 2 });
  a.equal(s.available.claude, true);
});
test("missing local histories report unavailable", async (t) => {
  const m = new Metrics(temp(t));
  await settle(m);
  a.deepEqual(m.snapshot().available, { codex: false, claude: false });
  a.equal(m.snapshot().codex, null);
  a.equal(m.snapshot().processes, null);
});
test("task phases are explicit, unknown stays null", () => {
  for (const [phase, percent] of [
    ["doing", 40],
    ["commit no ramo", 60],
    ["CONFERE", 80],
    ["released", 90],
    ["done", 100],
    ["mystery", null],
  ]) {
    const item = parseTask(
      "---\nid: one\nowner: SITE\nexecutor: codex\nphase: " +
        phase +
        "\n---\n# Mobile\n",
      "a",
    );
    a.equal(item.phase.percent, percent);
  }
  a.equal(parseTask("# No metadata", "a"), null);
});
test("queue honors explicit marks and order", () => {
  const q = parseQueue(
    "1. FEITO 10:00 Sound\n2. PEGUEI 10:01 Mobile\n3. Wallet report\n",
  );
  a.deepEqual(
    q.map((x) => x.percent),
    [100, 40, 0],
  );
  a.deepEqual(
    q.map((x) => x.title),
    ["Sound", "Mobile", "Wallet report"],
  );
});
test("optional init creates a usable, editable example without overwriting files", (t) => {
  const dir = temp(t);
  init(dir);
  const s = workspace(dir);
  a.equal(s.tasks[0].phase.percent, 40);
  a.equal(s.queue.length, 3);
  a.equal(s.tasks[0].color, "#65a7ff");
  a.throws(() => init(dir));
});
test("workspace rejects protected config paths and hides file paths from snapshot", (t) => {
  const dir = temp(t);
  write(
    dir,
    "config.json",
    JSON.stringify({ tasks: ["my-secret"], queue: ".env" }),
  );
  a.deepEqual(workspace(dir), { tasks: [], queue: [], configured: true });
});
test("agent process labels discard arguments", () => {
  a.equal(identify("claude.exe"), "claude");
  a.equal(identify("codex.exe"), "codex");
  a.equal(
    identify(
      "node /tools/@anthropic-ai/claude-code/cli.js --some-secret value",
    ),
    null,
  );
  a.equal(identify("codex.exe app-server"), null);
  a.equal(identify("node panel.cjs"), null);
});

test("metadata scan is incremental and handles appended streaming events", async (t) => {
  const dir = temp(t);
  const file = write(
    dir,
    ".claude/projects/project/11111111-1111-1111-1111-111111111111.jsonl",
    claude() + "\n",
  );
  const m = new Metrics(dir);
  await settle(m);
  a.equal(m.snapshot().claude.tokens, 25);
  const oldOpen = fs.promises.open;
  let reads = 0;
  fs.promises.open = async (...args) => {
    reads++;
    return oldOpen(...args);
  };
  try {
    await settle(m);
    a.equal(reads, 0);
    fs.appendFileSync(file, claude("other", 12, "2030-01-04T12:00:00Z") + "\n");
    await settle(m);
    a.equal(m.snapshot().claude.tokens, 57);
    a.equal(reads, 1);
  } finally {
    fs.promises.open = oldOpen;
  }
});

test("quota-only records are removed from the index when the source file disappears", async (t) => {
  const dir = temp(t);
  const file = write(
    dir,
    ".codex/sessions/2030/01/02/rollout-2030-01-02T12-00-00-a.jsonl",
    codex() + "\n",
  );
  const m = new Metrics(dir);
  await settle(m);
  fs.unlinkSync(file);
  await settle(m);
  a.equal(m.snapshot().codex, null);
});
test("same-size rewritten logs are reread rather than mistaken for append", async (t) => {
  const dir = temp(t);
  const file = write(
    dir,
    ".claude/projects/project/11111111-1111-1111-1111-111111111111.jsonl",
    claude("m", 5) + "\n",
  );
  const m = new Metrics(dir);
  await settle(m);
  fs.writeFileSync(file, claude("m", 8) + "\n");
  fs.utimesSync(file, new Date(), new Date(Date.now() + 1000));
  await settle(m);
  a.equal(m.snapshot().claude.tokens, 28);
});
test("fake agent names in prompt arguments do not count as running agents", () => {
  a.equal(identify("node panel.cjs --prompt claude"), null);
});

async function settle(m) {
  for (let round = 0; round < 100; round++) {
    await m.refresh();
    if (!m.snapshot().pending) return;
  }
  throw Error("Fixture scan did not settle");
}
