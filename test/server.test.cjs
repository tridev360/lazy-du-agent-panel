const test = require("node:test"),
  a = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { createServer } = require("../src/panel.cjs");
const { isReady } = require("../src/open.cjs");
test("launcher reuses only the same generation, not a legacy panel", async (t) => {
  const base = await start(t, { demoOnly: true });
  const health = await (await fetch(base + "/api/health")).json();
  a.equal(health.version, "2.1.0");
  a.equal(await isReady(Number(new URL(base).port)), true);
  const old = require("node:http").createServer((req,res) => res.end(JSON.stringify({app:"lazy-du-open-panel",version:1})));
  await new Promise(r => old.listen(0,"127.0.0.1",r));
  t.after(() => new Promise(r => old.close(r)));
  a.equal(await isReady(old.address().port), false);
});
async function start(t, opts) {
  const server = createServer(opts);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => server.close(r)));
  return "http://127.0.0.1:" + server.address().port;
}
test("example request never asks live readers for data", async (t) => {
  let reads = 0;
  const metrics = {
    get running() {
      reads++;
      throw Error("forbidden");
    },
    snapshot() {
      reads++;
      throw Error("forbidden");
    },
  };
  const base = await start(t, { metrics, base: "NOT-A-REAL-WORKSPACE" });
  const res = await fetch(base + "/api/status?example=1");
  a.equal(res.status, 200);
  const data = await res.json();
  a.equal(data.tasks.length, 6);
  a.equal(data.example, true);
  a.equal(reads, 0);
  a.ok(!/[A-Za-z]:[\\/]/.test(JSON.stringify(data)));
  a.ok(data.tasks.every((x) => !x.deadlineAt));
});
test("demo-only start also bypasses live readers for default route", async (t) => {
  const base = await start(t, {
    demoOnly: true,
    metrics: {
      snapshot() {
        throw Error("forbidden");
      },
    },
  });
  const res = await fetch(base + "/api/status");
  a.equal((await res.json()).example, true);
});
test("first status response does not wait for the history scan and takes less than 2 seconds", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lazy-panel-web-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let calls = 0;
  const metrics = {
    running: false,
    last: 0,
    refresh() {
      calls++;
      this.running = true;
      return new Promise(() => {});
    },
    snapshot() {
      return {
        codex: null,
        claude: { windows: [], tokens: 0 },
        sessions: [],
        daily: [],
        processes: null,
        complete: false,
      };
    },
  };
  const base = await start(t, { base: dir, metrics });
  const begin = performance.now(),
    res = await fetch(base + "/api/status"),
    data = await res.json();
  a.ok(performance.now() - begin < 2000);
  a.equal(calls, 1);
  a.equal(data.example, false);
  a.equal(data.usage.codex, null);
});
test("read-only API rejects writes, external origins, rebinding hosts and arbitrary files", async (t) => {
  const base = await start(t, { demoOnly: true });
  a.equal((await fetch(base + "/api/status", { method: "POST" })).status, 405);
  a.equal(
    (
      await fetch(base + "/api/status", {
        headers: { Origin: "https://other.example" },
      })
    ).status,
    403,
  );
  a.equal(
    await new Promise((resolve) => {
      require("node:http").get(
        base + "/api/status",
        { headers: { Host: "other.example" } },
        (r) => {
          r.resume();
          r.on("end", () => resolve(r.statusCode));
        },
      );
    }),
    403,
  );
  a.equal((await fetch(base + "/config.json")).status, 404);
  a.equal((await fetch(base + "/.env")).status, 404);
  const res = await fetch(base + "/");
  a.ok(
    res.headers.get("content-security-policy").includes("connect-src 'self'"),
  );
  a.equal(res.status, 200);
});

test("example mode cannot read files outside the shipped panel folder", async (t) => {
  const panel = path.resolve(__dirname, "..");
  const original = fs.readFileSync;
  const seen = [];
  fs.readFileSync = function (file, ...args) {
    if (typeof file === "string") {
      const rel = path.relative(panel, path.resolve(file));
      a.ok(!rel.startsWith("..") && !path.isAbsolute(rel), "outside read");
      seen.push(rel);
    }
    return original.call(this, file, ...args);
  };
  try {
    const base = await start(t, {
      base: "DO-NOT-READ",
      metrics: {
        snapshot() {
          throw Error("forbidden");
        },
      },
    });
    const data = await (await fetch(base + "/api/status?example=1")).json();
    a.equal(data.example, true);
    a.deepEqual(seen, ["example.json"]);
  } finally {
    fs.readFileSync = original;
  }
});

test("an unavailable live reader responds without crashing the local server", async (t) => {
  const base = await start(t, {
    metrics: {
      get running() {
        throw Error("not readable");
      },
    },
  });
  a.equal((await fetch(base + "/api/status")).status, 503);
  a.equal((await fetch(base + "/api/health")).status, 200);
});

test("public assets remain available after the directory reorganization", async (t) => {
  const base = await start(t, { demoOnly: true });
  for (const asset of [
    "/",
    "/panel.js",
    "/panel.css",
    "/du.png",
    "/marca.png",
    "/favicon.svg",
  ]) {
    const response = await fetch(base + asset);
    a.equal(response.status, 200, asset);
    a.ok((await response.arrayBuffer()).byteLength > 0, asset);
  }
});
