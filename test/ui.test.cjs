const test = require("node:test"),
  a = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
function ui(data) {
  const timers = [];
  class Node {
    constructor(tag = "div") {
      this.tag = tag;
      this.dataset = {};
      this.children = [];
      this.style = { setProperty() {} };
      this.textContent = "";
    }
    append(...nodes) {
      this.children.push(...nodes);
    }
    replaceChildren(...nodes) {
      this.children = [...nodes];
    }
    setAttribute(k, v) {
      this[k] = v;
    }
    get firstElementChild() {
      return this.children[0];
    }
    focus() {}
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
    }
    querySelectorAll() {
      return this.children.filter((n) => n.tag === "button");
    }
  }
  const nodes = new Map(),
    get = (id) => {
      if (!nodes.has(id)) nodes.set(id, new Node());
      return nodes.get(id);
    };
  for (const who of ["claude", "codex", "sessions"])
    get(who + "-ring").append(new Node("strong"));
  const executors = ["claude", "codex"].map((x) => {
    const n = new Node("button");
    n.dataset = { executor: x };
    return n;
  });
  const ctx = {
    URLSearchParams,
    Date,
    Intl,
    Map,
    Set,
    Number,
    console,
    location: { search: "?example=1" },
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
    },
    document: {
      getElementById: get,
      createElement: (tag) => new Node(tag),
      documentElement: {},
      querySelectorAll: (selector) =>
        selector === "[data-executor]" ? executors : [],
      title: "",
    },
    fetch: async () => ({ ok: true, json: async () => structuredClone(data) }),
    setInterval() {},
    setTimeout(fn, delay) {
      timers.push({ fn, delay });
    },
  };
  ctx.window=ctx;
  ctx.PanelR4={period:()=>"Today · UTC"};
  ctx.document.querySelector=()=>({dataset:{trend:"No comparison available"}});
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(require.resolve("../public/v2-core.js"),"utf8"),ctx);
  vm.runInContext(
    fs.readFileSync(require.resolve("../public/panel.js"), "utf8"),
    ctx,
  );
  return {
    ctx,
    nodes,
    executors,
    timers,
    async ready() {
      await new Promise((r) => setImmediate(r));
    },
    async run(code) {
      return vm.runInContext(code, ctx);
    },
  };
}
const example = () =>
  JSON.parse(fs.readFileSync(require.resolve("../example.json"), "utf8"));
test("full UI renders six example game tasks and phase-weighted progress", async () => {
  const u = ui(example());
  await u.ready();
  a.equal(u.nodes.get("board").children.flatMap(c=>c.children[1].children).length, 6);
  a.equal(u.nodes.get("pipeline").children.length, 6);
  a.equal(u.nodes.get("claude-ring").firstElementChild.textContent, "?");
  a.equal(u.nodes.get("codex-ring").firstElementChild.textContent, "72%");
  a.equal(u.nodes.get("cards").children.length, 2);
});
test("language change translates feature names and choices", async () => {
  const u = ui(example());
  await u.ready();
  u.nodes.get("language").value = "pt";
  u.nodes.get("language").onchange();
  a.equal(u.ctx.document.documentElement.lang, "pt");
  const all = u.nodes
    .get("board")
    .children.flatMap((c) => c.children[1].children);
  a.ok(all.some((x) => x.children[1].textContent === "Movimento do jogador"));
  a.equal(
    u.nodes.get("cards").children[0].children[1].textContent,
    "Como deve ser o pulo?",
  );
});
test("filters and drawer are functional", async () => {
  const u = ui(example());
  await u.ready();
  u.executors[0].onclick();
  a.equal(u.nodes.get("board").children.flatMap(c=>c.children[1].children).length, 3);
  u.nodes.get("pipeline").children[0].onclick();
  a.equal(u.nodes.get("drawer").open, true);
  a.equal(u.nodes.get("drawer-title").textContent, "Player movement");
  u.nodes.get("close-drawer").onclick();
  a.equal(u.nodes.get("drawer").open, false);
});
test("missing readings display question marks without invented zero quota", async () => {
  const d = example();
  d.example = false;
  d.tasks = [];
  d.cards = [];
  d.usage = {
    codex: null,
    claude: { tokens: null, windows: [] },
    sessions: [],
    daily: [],
    available: { codex: false, claude: false },
    complete: false,
    processes: null,
  };
  const u = ui(d);
  await u.ready();
  a.equal(u.nodes.get("claude-ring").firstElementChild.textContent, "?");
  a.equal(u.nodes.get("codex-ring").firstElementChild.textContent, "?");
  a.equal(u.nodes.get("sessions-ring").firstElementChild.textContent, "Awaiting reading");
  a.equal(u.nodes.get("claude-note").textContent, "Awaiting reading tokens");
  a.equal(u.nodes.get("empty-task board").hidden, false);
});
test("example choices remain local and only acknowledge the chosen card", async () => {
  const u = ui(example());
  await u.ready();
  const card = u.nodes.get("cards").children[0];
  card.children[2].onclick();
  a.equal(u.nodes.get("toast").textContent, "Example choice saved");
  a.equal(card.children[2].disabled, true);
});

test("first usage becomes visible while the initial scan continues", async () => {
  const d = example();
  d.example = false;
  d.usage.scanning = true;
  d.usage.codex = null;
  const u = ui(d);
  await u.ready();
  const retry = u.timers.find((x) => x.delay === 1000);
  a.ok(retry);
  d.usage.codex = { windows: [{ used: 37, minutes: 10080 }] };
  retry.fn();
  await u.ready();
  a.equal(u.nodes.get("codex-ring").firstElementChild.textContent, "63%");
  a.ok(u.timers.some((x) => x.delay === 1000));
});
function unknownUsage() {
  const d = example();
  d.example = false;
  d.usage = {
    codex: null,
    claude: { tokens: null, windows: [] },
    sessions: [],
    daily: [],
    available: { codex: true, claude: true },
    discovered: { codex: 1, claude: 1 },
    complete: false,
    scanning: false,
    processes: { claude: null, codex: null, unknown: 1 },
  };
  return d;
}
function drawerText(u) {
  return u.nodes
    .get("drawer-body")
    .children.map((x) => x.textContent)
    .join("\n");
}
test("readable roots without usage metadata show unknown in cards and history", async () => {
  for (const complete of [false, true]) {
    const d = unknownUsage();
    d.usage.complete = complete;
    const u = ui(d);
    await u.ready();
    a.equal(u.nodes.get("claude-note").textContent, "Awaiting reading tokens");
    a.equal(u.nodes.get("sessions-ring").firstElementChild.textContent, "Awaiting reading");
    a.equal(
      u.nodes.get("process-note").textContent,
      "Awaiting reading top-level agent sessions",
    );
    u.nodes.get("claude-metric").onclick();
    a.match(drawerText(u), /Awaiting reading tokens/);
    u.nodes.get("sessions-metric").onclick();
    a.match(drawerText(u), /Awaiting reading top-level agent sessions/);
    a.match(drawerText(u), /CLAUDE: Awaiting reading · CODEX: Awaiting reading/);
    a.match(drawerText(u), /Only executable names are read/);
    u.nodes.get("daily").onclick();
    a.match(drawerText(u), /Open a Claude session to build your history/);
  }
});
test("unknown per-session and daily tokens remain unknown without breaking details", async () => {
  const d = unknownUsage();
  d.usage.sessions = [
    {
      id: "fixture",
      agent: "claude",
      tokens: null,
      updated: "2030-01-02T12:00:00Z",
    },
  ];
  d.usage.daily = [{ day: "2030-01-02", tokens: null }];
  const u = ui(d);
  await u.ready();
  u.nodes.get("claude-metric").onclick();
  a.match(drawerText(u), /fixture · Awaiting reading tokens/);
  u.nodes.get("sessions-metric").onclick();
  a.match(drawerText(u), /fixture · Awaiting reading tokens/);
  u.nodes.get("daily").onclick();
  a.match(drawerText(u), /2030-01-02 · \? tokens/);
});
test("valid measured zero is shown and process uncertainty has a Portuguese explanation", async () => {
  const d = unknownUsage();
  d.usage.claude.tokens = 0;
  d.usage.sessions = [
    {
      id: "fixture-zero",
      agent: "claude",
      tokens: 0,
      updated: "2030-01-02T12:00:00Z",
    },
  ];
  d.usage.daily = [{ day: "2030-01-02", tokens: 0 }];
  d.usage.processes = { claude: 0, codex: 0, unknown: 0 };
  const u = ui(d);
  await u.ready();
  a.equal(u.nodes.get("claude-note").textContent, "0 tokens");
  a.equal(
    u.nodes.get("process-note").textContent,
    "0 top-level agent sessions",
  );
  u.nodes.get("claude-metric").onclick();
  a.match(drawerText(u), /fixture-zero · 0 tokens/);
  u.nodes.get("language").value = "pt";
  u.nodes.get("language").onchange();
  u.nodes.get("sessions-metric").onclick();
  a.match(drawerText(u), /Só nomes de executáveis são lidos/);
  a.match(drawerText(u), /CLAUDE: 0 · CODEX: 0/);
});
test("a pending bounded scan uses the existing first-read retry", async () => {
  const d = unknownUsage();
  d.usage.pending = true;
  const u = ui(d);
  await u.ready();
  a.ok(u.timers.some((x) => x.delay === 1000));
  d.usage.codex = { windows: [{ used: 10, minutes: 10080 }] };
  u.timers.find((x) => x.delay === 1000).fn();
  await u.ready();
  a.equal(u.nodes.get("codex-ring").firstElementChild.textContent, "90%");
  a.ok(u.timers.some((x) => x.delay === 1000));
});

test("without a workspace the hero shows usage and detected agents", async () => {
  const data = example();
  data.example = false;
  data.configured = false;
  data.tasks = [];
  data.queue = [];
  data.usage.updated = "2030-01-02T12:00:00Z";
  data.usage.claude.windows = [];
  data.usage.claude.tokens = 160;
  data.usage.daily = [
    { day: "2030-01-02", tokens: 100 },
    { day: "2030-01-01", tokens: 60 },
  ];
  data.usage.processes = { claude: 1, codex: 2, unknown: 0 };
  const panel = ui(data);
  await panel.ready();
  a.equal(panel.nodes.get("total-percent").textContent, "3");
  a.equal(panel.nodes.get("pipeline").children.length, 2);
  a.equal(panel.nodes.get("claude-ring").firstElementChild.textContent, "100");
  a.match(
    panel.nodes.get("claude-note").textContent,
    /100 today · 160 last 7 days/,
  );
  a.equal(panel.nodes.get("now").children.length, 2);
  a.match(panel.nodes.get("next").children[0].href, /example=1/);
  panel.nodes.get("pipeline").children[0].onclick();
  a.ok(panel.nodes.get("drawer").open);
  panel.nodes.get("language").value = "pt";
  panel.nodes.get("language").onchange();
  a.match(panel.nodes.get("claude-note").textContent, /100 hoje/);
});

test("workspace queue view is preserved and missing live readings are explicit", async () => {
  const configured = example();
  configured.example = false;
  configured.configured = true;
  const board = ui(configured);
  await board.ready();
  a.equal(board.nodes.get("pipeline").children.length, 6);
  const missing = unknownUsage();
  missing.example = false;
  missing.configured = false;
  missing.tasks = [];
  missing.queue = [];
  const panel = ui(missing);
  await panel.ready();
  a.equal(panel.nodes.get("claude-ring").firstElementChild.textContent, "?");
  a.match(panel.nodes.get("now").children[0].textContent, /not available/);
});

test("large observed token counts fit the ring and stay exact in details", async () => {
  const data = example();
  data.example = false;
  data.configured = false;
  data.tasks = [];
  data.queue = [];
  data.usage.updated = "2030-01-02T12:00:00Z";
  data.usage.claude.windows = [];
  data.usage.claude.tokens = 130409306;
  data.usage.daily = [{ day: "2030-01-02", tokens: 130409306 }];
  data.usage.processes = {
    claude: 44,
    codex: 2,
    unknown: 10,
    top: { claude: 1, codex: 1 },
    agents: [
      { name: "claude", count: 1 },
      { name: "codex", count: 1 },
    ],
  };
  const panel = ui(data);
  await panel.ready();
  a.equal(panel.nodes.get("total-percent").textContent, "2");
  a.equal(
    panel.nodes.get("claude-ring").firstElementChild.textContent,
    "130.4M",
  );
  panel.nodes.get("claude-metric").onclick();
  a.match(drawerText(panel), /130,409,306/);
  panel.nodes.get("language").value = "pt";
  panel.nodes.get("language").onchange();
  a.match(
    panel.nodes.get("claude-ring").firstElementChild.textContent,
    /130,4.*mi/,
  );
});
