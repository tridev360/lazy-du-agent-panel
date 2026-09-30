const fs = require("node:fs"),
  path = require("node:path");
const { blocked, safeFile } = require("./usage.cjs");
const phases = {
  new: 0,
  nova: 0,
  open: 10,
  aberta: 10,
  doing: 40,
  andando: 40,
  ready: 60,
  "commit no ramo": 60,
  review: 80,
  confere: 80,
  "pode subir": 80,
  released: 90,
  liberado: 90,
  done: 100,
  feito: 100,
  "no ar": 100,
};
const clean = (s) =>
  String(s || "")
    .replace(/0x[a-f\d]{40}/gi, "[address]")
    .replace(/https?:\/\/\S+/gi, "[link]")
    .replace(/[\u2013\u2014]/g, ",")
    .slice(0, 90);
function parseTask(text, id) {
  const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!head) return null;
  const meta = {};
  for (const line of head[1].split(/\r?\n/)) {
    const pair = /^([a-z_]+):\s*(.*?)\s*$/.exec(line);
    if (pair) meta[pair[1]] = pair[2].replace(/^['"]|['"]$/g, "");
  }
  const raw = String(meta.phase || meta.estado || "").toLowerCase(),
    percent = phases[raw] ?? null;
  const key =
    percent === 100
      ? "live"
      : percent === 90
        ? "released"
        : percent === 80
          ? "review"
          : percent === 60
            ? "ready"
            : percent === 40
              ? "doing"
              : "new";
  const date = meta.deadline || meta.prazo,
    deadlineAt =
      typeof date === "string" &&
      /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d\d:\d\d)$/.test(date) &&
      Number.isFinite(Date.parse(date))
        ? new Date(date).toISOString()
        : null;
  return {
    id: clean(meta.id || id),
    title: clean(
      meta.title || /^#\s+(.+)$/m.exec(text.slice(head[0].length))?.[1] || id,
    ),
    owner: clean(meta.owner || meta.dono || "TEAM"),
    executor: ["claude", "codex"].includes(meta.executor)
      ? meta.executor
      : "claude",
    phase: { key, percent },
    deadlineAt,
    needsOwner: meta.needs_you === "true",
  };
}
function parseQueue(text) {
  return text.split(/\r?\n/).flatMap((line, i) => {
    const m =
      /^\s*(\d+)\.\s+(?:(FEITO|PEGUEI|DONE|DOING)\s+\d\d:\d\d\s*)?(.+)$/i.exec(
        line,
      );
    if (!m) return [];
    const status = (m[2] || "").toUpperCase(),
      percent = ["FEITO", "DONE"].includes(status)
        ? 100
        : ["PEGUEI", "DOING"].includes(status)
          ? 40
          : 0;
    return [
      {
        id: "queue-" + m[1],
        title: clean(m[3].replace(/\([^)]*\)/g, "")),
        executor: /\bclaude\b/i.test(m[3]) ? "claude" : "codex",
        percent,
        status: percent === 100 ? "done" : percent ? "doing" : "new",
        source: "queue",
      },
    ];
  });
}
function workspace(base) {
  const file = path.join(base, "config.json");
  if (!safeFile(base, file)) return { tasks: [], queue: [], configured: false };
  try {
    const config = JSON.parse(fs.readFileSync(file, "utf8"));
    const tasks = [];
    for (const folder of Array.isArray(config.tasks)
      ? config.tasks.slice(0, 10)
      : []) {
      if (typeof folder !== "string" || blocked(folder)) continue;
      const dir = path.resolve(base, folder);
      let entries;
      try {
        if (fs.lstatSync(dir).isSymbolicLink()) continue;
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (
          !entry.isFile() ||
          !entry.name.endsWith(".md") ||
          blocked(entry.name)
        )
          continue;
        const p = path.join(dir, entry.name);
        if (!safeFile(dir, p) || fs.statSync(p).size > 65536) continue;
        const task = parseTask(
          fs.readFileSync(p, "utf8"),
          entry.name.slice(0, -3),
        );
        if (task) {
          const alias = config.sessions?.[task.owner];
          if (alias && typeof alias === "string") task.owner = clean(alias);
          const color = config.colors?.[task.executor];
          if (typeof color === "string" && /^#[a-f\d]{6}$/i.test(color))
            task.color = color;
          tasks.push(task);
        }
      }
    }
    let queue = [];
    if (typeof config.queue === "string" && !blocked(config.queue)) {
      const p = path.resolve(base, config.queue),
        dir = path.dirname(p);
      if (p.endsWith(".md") && safeFile(dir, p) && fs.statSync(p).size <= 65536)
        queue = parseQueue(fs.readFileSync(p, "utf8"));
    }
    return { tasks, queue, configured: true };
  } catch {
    return { tasks: [], queue: [], configured: true, error: true };
  }
}
function init(base) {
  fs.mkdirSync(path.join(base, "tasks"), { recursive: true });
  const files = {
    "config.json": JSON.stringify(
      {
        tasks: ["tasks"],
        queue: "queue.md",
        sessions: { frontend: "frontend", backend: "backend" },
        colors: { codex: "#65a7ff", claude: "#ffac62" },
      },
      null,
      2,
    ),
    "queue.md":
      "1. DOING 10:00 Mobile polish\n2. Sound pack\n3. Wallet report\n",
    "tasks/mobile.md":
      "---\nid: mobile\nowner: frontend\nexecutor: codex\nphase: doing\n---\n# Mobile polish\n",
  };
  for (const [name, text] of Object.entries(files))
    fs.writeFileSync(path.join(base, name), text + "\n", { flag: "wx" });
}
module.exports = { parseTask, parseQueue, workspace, init };
