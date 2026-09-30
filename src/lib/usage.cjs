const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { projectJSON } = require("./project-json.cjs");
const countFields = [
  "input_tokens",
  "output_tokens",
  "cache_creation_input_tokens",
  "cache_read_input_tokens",
];
const paths = [
  "type",
  "timestamp",
  "message.id",
  "payload.type",
  "payload.info.total_token_usage.total_tokens",
  ...countFields.map((x) => "message.usage." + x),
  ...["primary", "secondary"].flatMap((w) =>
    [
      "used_percent",
      "usedPercent",
      "window_minutes",
      "windowDurationMins",
      "resets_at",
      "resetsAt",
    ].map((x) => "payload.rate_limits." + w + "." + x),
  ),
];
const validTime = (v) =>
  typeof v === "string" && Number.isFinite(Date.parse(v))
    ? new Date(v).toISOString()
    : null;
const label = (file) =>
  crypto.createHash("sha256").update(file).digest("hex").slice(0, 6);
function record(line) {
  try {
    return projectJSON(line, paths);
  } catch {
    return null;
  }
}
function windowsOf(r) {
  return ["primary", "secondary"]
    .map((w) => {
      const p = "payload.rate_limits." + w + ".",
        used = r[p + "used_percent"] ?? r[p + "usedPercent"],
        minutes = r[p + "window_minutes"] ?? r[p + "windowDurationMins"],
        raw = r[p + "resets_at"] ?? r[p + "resetsAt"];
      return {
        used,
        minutes,
        reset:
          Number.isFinite(raw) && raw > 0
            ? new Date(raw * 1000).toISOString()
            : null,
      };
    })
    .filter(
      (w) =>
        Number.isFinite(w.used) &&
        w.used >= 0 &&
        w.used <= 100 &&
        Number.isFinite(w.minutes) &&
        w.minutes > 0,
    );
}
class UsageIndex {
  constructor() {
    this.files = new Map();
    this.codex = null;
    this.quotas = new Map();
    this.complete = false;
    this.discovered = { codex: 0, claude: 0 };
    this.errors = 0;
    this.available = { codex: false, claude: false };
  }
  consume(kind, file, line) {
    const r = record(line);
    if (!r) return;
    const at = validTime(r.timestamp);
    if (!at) return;
    if (
      kind === "codex" &&
      r.type === "event_msg" &&
      r["payload.type"] === "token_count"
    ) {
      const windows = windowsOf(r),
        prior = this.quotas.get(file);
      if (windows.length && (!prior || at > prior.updated)) {
        this.quotas.set(file, {
          updated: at,
          windows,
          source: "rollout rate_limits",
        });
        this.codex =
          [...this.quotas.values()].sort((a, b) =>
            b.updated.localeCompare(a.updated),
          )[0] || null;
      }
      const total = r["payload.info.total_token_usage.total_tokens"];
      if (Number.isSafeInteger(total) && total >= 0) {
        const old = this.files.get(file);
        if (!old || at >= old.at)
          this.files.set(file, {
            kind,
            id: label(file),
            at,
            total,
            messages: null,
          });
      }
    } else if (kind === "claude" && r.type === "assistant") {
      const numbers = countFields.map((x) => r["message.usage." + x]);
      if (
        !numbers.some(Number.isFinite) ||
        numbers.some(
          (x) => x !== undefined && (!Number.isSafeInteger(x) || x < 0),
        )
      )
        return;
      const id = r["message.id"];
      if (typeof id !== "string" || id.length > 200) return;
      const total = numbers.reduce((sum, x) => sum + (x || 0), 0);
      if (!Number.isSafeInteger(total)) return;
      let entry = this.files.get(file);
      if (!entry) {
        entry = { kind, id: label(file), at, total: 0, messages: new Map() };
        this.files.set(file, entry);
      }
      if (at > entry.at) entry.at = at;
      const previous = entry.messages.get(id);
      if (
        !previous ||
        at > previous.at ||
        (at === previous.at && total > previous.total)
      )
        entry.messages.set(id, { at, total });
    }
  }
  snapshot(now = new Date()) {
    const daily = new Map(),
      sessions = [];
    for (const e of this.files.values()) {
      let tokens = e.total;
      if (e.messages) {
        tokens = 0;
        for (const m of e.messages.values()) {
          tokens += m.total;
          const day = m.at.slice(0, 10);
          daily.set(day, (daily.get(day) || 0) + m.total);
        }
      }
      sessions.push({
        id: e.id,
        agent: e.kind,
        updated: e.at,
        tokens,
        recent: now.getTime() - Date.parse(e.at) <= 300000,
      });
    }
    return {
      codex: this.codex,
      claude: {
        windows: [],
        source: "session usage, no account quota available",
        tokens: sessions.some((x) => x.agent === "claude")
          ? sessions
              .filter((x) => x.agent === "claude")
              .reduce((n, x) => n + x.tokens, 0)
          : null,
      },
      sessions: sessions
        .sort((a, b) => b.updated.localeCompare(a.updated))
        .slice(0, 30),
      daily: [...daily]
        .map(([day, tokens]) => ({ day, tokens }))
        .sort((a, b) => b.day.localeCompare(a.day))
        .slice(0, 7),
      complete: this.complete,
      discovered: this.discovered,
      available: this.available,
      errors: this.errors,
    };
  }
}
function blocked(file) {
  return file
    .split(/[\\/]/)
    .some((x) =>
      /^(?:\.env(?:\..*)?|.+\.env|auth\.json|credentials.*|.*secret.*|.*private.*key.*|.*seed.*|.*wallet.*backup.*|id_rsa.*|keys?\.json)$/i.test(
        x,
      ),
    );
}
function safeFile(root, file) {
  try {
    if (blocked(file) || fs.lstatSync(root).isSymbolicLink()) return false;
    const base = fs.realpathSync(root),
      real = fs.realpathSync(file),
      rel = path.relative(base, real);
    if (
      blocked(real) ||
      rel.startsWith("..") ||
      path.isAbsolute(rel) ||
      fs.lstatSync(file).isSymbolicLink()
    )
      return false;
    const parts = path.relative(root, file).split(path.sep);
    let parent = root;
    for (const part of parts.slice(0, -1)) {
      parent = path.join(parent, part);
      if (fs.lstatSync(parent).isSymbolicLink()) return false;
    }
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}
const turn = () => new Promise((resolve) => setImmediate(resolve));
const limitsDefault = { entries: 512, bytes: 1024 * 1024, milliseconds: 100 };
const maxLine = 128 * 1024;
function limitsOf(value = {}) {
  return Object.fromEntries(
    Object.entries(limitsDefault).map(([key, max]) => [
      key,
      Number.isFinite(value[key]) && value[key] > 0
        ? Math.min(max, Math.floor(value[key]))
        : max,
    ]),
  );
}
function expired(budget) {
  return performance.now() >= budget.deadline;
}
async function safeUsageFile(root, file) {
  if (blocked(file)) throw Error("Protected path");
  const base = await fs.promises.realpath(root),
    real = await fs.promises.realpath(file),
    rel = path.relative(base, real);
  if (blocked(real) || rel.startsWith("..") || path.isAbsolute(rel))
    throw Error("Outside reader root");
  let parent = root;
  if ((await fs.promises.lstat(parent)).isSymbolicLink())
    throw Error("Linked root");
  for (const part of path.relative(root, file).split(path.sep).slice(0, -1)) {
    parent = path.join(parent, part);
    if ((await fs.promises.lstat(parent)).isSymbolicLink())
      throw Error("Linked path");
  }
  if ((await fs.promises.lstat(file)).isSymbolicLink())
    throw Error("Linked file");
  const stat = await fs.promises.stat(file);
  if (!stat.isFile()) throw Error("Not a file");
  return stat;
}
function discoveryState(home, now) {
  return {
    queue: [
      {
        dir: path.join(home, ".codex", "sessions"),
        root: path.join(home, ".codex", "sessions"),
        kind: "codex",
        depth: 3,
        isRoot: true,
      },
      {
        dir: path.join(home, ".claude", "projects"),
        root: path.join(home, ".claude", "projects"),
        kind: "claude",
        depth: 4,
        isRoot: true,
      },
    ],
    current: null,
    found: new Map(),
    available: { codex: false, claude: false },
    errors: 0,
    complete: false,
    limited: false,
    visited: 0,
    cutoff: now.getTime() - 7 * 86400000,
  };
}
async function discover(
  home,
  now = new Date(),
  { state = discoveryState(home, now), budget, limits } = {},
) {
  const cap = limitsOf(limits);
  budget = budget || {
    entries: cap.entries,
    bytes: cap.bytes,
    deadline: performance.now() + cap.milliseconds,
  };
  await turn();
  while (budget.entries > 0 && !expired(budget) && !state.complete) {
    if (!state.current) {
      const next = state.queue.shift();
      if (!next) {
        state.complete = true;
        break;
      }
      budget.entries--;
      try {
        if ((await fs.promises.lstat(next.dir)).isSymbolicLink()) continue;
        if (next.isRoot) {
          if (
            (await fs.promises.lstat(path.dirname(next.dir))).isSymbolicLink()
          )
            continue;
          const real = await fs.promises.realpath(next.dir);
          if (blocked(real)) continue;
        }
        const handle = await fs.promises.opendir(next.dir);
        state.current = { ...next, handle };
        if (next.isRoot) state.available[next.kind] = true;
      } catch (error) {
        if (!next.isRoot || error.code !== "ENOENT") state.errors++;
      }
      continue;
    }
    const current = state.current;
    let entry;
    budget.entries--;
    state.visited++;
    try {
      entry = await current.handle.read();
    } catch {
      state.errors++;
      entry = null;
    }
    if (!entry) {
      try {
        await current.handle.close();
      } catch {}
      state.current = null;
      continue;
    }
    if (entry.isSymbolicLink() || blocked(entry.name)) continue;
    const file = path.join(current.dir, entry.name),
      kind = current.kind;
    if (
      entry.isDirectory() &&
      current.depth > 0 &&
      ((kind === "codex" && /^\d{2,4}$/.test(entry.name)) ||
        (kind === "claude" &&
          current.depth === 4 &&
          !entry.name.startsWith(".")) ||
        (kind === "claude" &&
          (/^[\da-f-]{36}$/i.test(entry.name) || entry.name === "subagents")))
    ) {
      if (state.queue.length < 2048)
        state.queue.push({
          dir: file,
          root: current.root,
          kind,
          depth: current.depth - 1,
          isRoot: false,
        });
      else state.limited = true;
    } else if (
      entry.isFile() &&
      ((kind === "codex" && /^rollout-[\wT:.-]+\.jsonl$/.test(entry.name)) ||
        (kind === "claude" &&
          /^(?:[\da-f-]{36}|agent-[\da-f]+)\.jsonl$/i.test(entry.name)))
    ) {
      try {
        const stat = await safeUsageFile(current.root, file);
        if (stat.mtimeMs >= state.cutoff) {
          state.found.set(file, {
            file,
            kind,
            size: stat.size,
            mtime: stat.mtimeMs,
            root: current.root,
          });
          if (state.found.size > 200) {
            const oldest = [...state.found.values()].sort(
              (a, b) => a.mtime - b.mtime,
            )[0];
            state.found.delete(oldest.file);
          }
        }
      } catch {
        state.errors++;
      }
    }
    if (state.visited >= 20000) {
      state.limited = true;
      state.complete = true;
      state.queue = [];
      try {
        await state.current?.handle.close();
      } catch {}
      state.current = null;
    }
    await turn();
  }
  return {
    files: [...state.found.values()].sort((a, b) => b.mtime - a.mtime),
    available: { ...state.available },
    errors: state.errors,
    complete: state.complete,
    limited: state.limited,
    state,
  };
}
async function readUsage(
  file,
  kind,
  index,
  { tail = false, start = 0, state, root = path.dirname(file), budget } = {},
) {
  const stat = await safeUsageFile(root, file),
    cursor = state || {
      offset: tail ? Math.max(0, stat.size - maxLine) : start,
      probe: 0,
      dropping: tail && stat.size > maxLine,
      errors: 0,
    };
  budget = budget || {
    bytes: limitsDefault.bytes,
    deadline: performance.now() + limitsDefault.milliseconds,
  };
  budget.capBytes ??= budget.bytes;
  budget.read ??= 0;
  const handle = await fs.promises.open(file, "r");
  let pos = cursor.offset,
    rest = Buffer.alloc(0);
  const charge = (n) => {
    budget.bytes -= n;
    budget.read += n;
  };
  const request = (n) =>
    Math.min(n, budget.bytes, limitsDefault.bytes - budget.read);
  const clearLine = () => {
    cursor.probe = 0;
    cursor.dropping = false;
    cursor.partial = false;
    delete cursor.lineEnd;
    delete cursor.lineNext;
  };
  try {
    const buffer = Buffer.alloc(16384);
    cursor.done = false;
    while (!expired(budget) && budget.read < limitsDefault.bytes) {
      // A previous call kept only the positions of a partly read line.
      if (Number.isFinite(cursor.lineEnd)) {
        if (cursor.lineNext === cursor.lineEnd && cursor.lineEnd < stat.size) {
          cursor.probe = cursor.lineEnd - cursor.offset;
          delete cursor.lineEnd;
          delete cursor.lineNext;
          continue;
        }
        const length = cursor.lineEnd - cursor.offset;
        if (length > maxLine) {
          cursor.errors++;
          cursor.offset = cursor.lineNext;
          clearLine();
          pos = cursor.offset;
          continue;
        }
        if (length > budget.bytes) {
          if (
            length <= budget.capBytes ||
            budget.completedLine ||
            length > limitsDefault.bytes - budget.read
          )
            break;
          // One bounded completion for an artificial budget smaller than a line.
          budget.completedLine = true;
          budget.bytes = length;
        }
        let read = 0;
        const pieces = [];
        while (read < length && !expired(budget)) {
          const result = await handle.read(
            buffer,
            0,
            request(Math.min(buffer.length, length - read)),
            cursor.offset + read,
          );
          if (!result.bytesRead) break;
          charge(result.bytesRead);
          read += result.bytesRead;
          pieces.push(Buffer.from(buffer.subarray(0, result.bytesRead)));
          await turn();
        }
        if (read < length) break;
        const line = Buffer.concat(pieces).toString("utf8");
        index.consume(kind, file, line);
        if (cursor.lineNext === cursor.lineEnd) {
          cursor.probe = length;
          cursor.partial = record(line) === null;
          cursor.done = true;
          delete cursor.lineEnd;
          delete cursor.lineNext;
          return cursor;
        }
        cursor.offset = cursor.lineNext;
        clearLine();
        pos = cursor.offset;
        if (budget.completedLine) {
          cursor.done = pos >= stat.size;
          return cursor;
        }
        continue;
      }
      if (cursor.probe > 0 || cursor.dropping) {
        pos = cursor.offset + (cursor.probe || 0);
        if (pos >= stat.size) {
          if (cursor.dropping) {
            cursor.done = true;
            cursor.partial = true;
            return cursor;
          }
          cursor.lineEnd = stat.size;
          cursor.lineNext = stat.size;
          continue;
        }
        if (budget.bytes <= 0) break;
        const result = await handle.read(
          buffer,
          0,
          request(Math.min(buffer.length, stat.size - pos)),
          pos,
        );
        if (!result.bytesRead) break;
        charge(result.bytesRead);
        const chunk = buffer.subarray(0, result.bytesRead),
          newline = chunk.indexOf(10),
          end = pos + (newline < 0 ? chunk.length : newline);
        cursor.probe = end - cursor.offset;
        if (cursor.probe > maxLine && !cursor.dropping) {
          cursor.dropping = true;
          cursor.errors++;
        }
        if (newline >= 0) {
          if (cursor.dropping) {
            cursor.offset = end + 1;
            clearLine();
            pos = cursor.offset;
          } else {
            cursor.lineEnd = end;
            cursor.lineNext = end + 1;
          }
        }
        await turn();
        continue;
      }
      if (pos >= stat.size) {
        cursor.done = true;
        return cursor;
      }
      if (budget.bytes <= 0) break;
      const result = await handle.read(
        buffer,
        0,
        request(Math.min(buffer.length, stat.size - pos)),
        pos,
      );
      if (!result.bytesRead) break;
      charge(result.bytesRead);
      const readStart = pos,
        chunk = buffer.subarray(0, result.bytesRead);
      pos += result.bytesRead;
      let begin = 0;
      while (begin < chunk.length) {
        const newline = chunk.indexOf(10, begin),
          end = newline < 0 ? chunk.length : newline,
          piece = chunk.subarray(begin, end);
        if (!cursor.dropping) {
          if (rest.length + piece.length > maxLine) {
            rest = Buffer.alloc(0);
            cursor.dropping = true;
            cursor.errors++;
          } else rest = Buffer.concat([rest, piece]);
        }
        if (newline < 0) break;
        if (!cursor.dropping && rest.length)
          index.consume(kind, file, rest.toString("utf8"));
        cursor.offset = readStart + newline + 1;
        clearLine();
        rest = Buffer.alloc(0);
        begin = newline + 1;
      }
      // Continue the same line locally while there is budget. Nothing is retained.
      while (
        pos < stat.size &&
        rest.length &&
        !cursor.dropping &&
        budget.bytes > 0 &&
        !expired(budget)
      ) {
        const result = await handle.read(
          buffer,
          0,
          request(Math.min(buffer.length, stat.size - pos)),
          pos,
        );
        if (!result.bytesRead) break;
        charge(result.bytesRead);
        const readStart = pos,
          chunk = buffer.subarray(0, result.bytesRead);
        pos += result.bytesRead;
        let begin = 0;
        while (begin < chunk.length) {
          const newline = chunk.indexOf(10, begin),
            end = newline < 0 ? chunk.length : newline,
            piece = chunk.subarray(begin, end);
          if (!cursor.dropping) {
            if (rest.length + piece.length > maxLine) {
              rest = Buffer.alloc(0);
              cursor.dropping = true;
              cursor.errors++;
            } else rest = Buffer.concat([rest, piece]);
          }
          if (newline < 0) break;
          if (!cursor.dropping && rest.length)
            index.consume(kind, file, rest.toString("utf8"));
          cursor.offset = readStart + newline + 1;
          clearLine();
          rest = Buffer.alloc(0);
          begin = newline + 1;
        }
        await turn();
      }
      cursor.probe = pos - cursor.offset;
      if (pos >= stat.size) {
        cursor.done = true;
        if (rest.length && !cursor.dropping) {
          const line = rest.toString("utf8");
          index.consume(kind, file, line);
          cursor.partial = record(line) === null;
        } else if (cursor.dropping) cursor.partial = true;
        return cursor;
      }
      // The residual bytes are local. A later call probes and rereads the line.
      rest = Buffer.alloc(0);
      await turn();
    }
    return cursor;
  } finally {
    await handle.close();
  }
}
class Metrics {
  constructor(
    home,
    { processReader = async () => null, clock = () => new Date(), limits } = {},
  ) {
    this.home = home;
    this.clock = clock;
    this.processReader = processReader;
    this.limits = limitsOf(limits);
    this.index = new UsageIndex();
    this.processes = null;
    this.processLoading = false;
    this.processLast = 0;
    this.running = false;
    this.pending = false;
    this.last = 0;
    this.scanned = new Map();
    this.previewed = new Set();
    this.discovery = null;
  }
  async refresh() {
    if (this.running) return;
    const wasPending = this.pending;
    this.running = true;
    this.pending = true;
    this.index.complete = false;
    await turn();
    const budget = {
      entries: this.limits.entries,
      bytes: this.limits.bytes,
      capBytes: this.limits.bytes,
      read: 0,
      deadline: performance.now() + this.limits.milliseconds,
    };
    try {
      if (!this.discovery || (this.discovery.complete && !wasPending))
        this.discovery = discoveryState(this.home, this.clock());
      const result = await discover(this.home, this.clock(), {
          state: this.discovery,
          budget,
        }),
        files = result.files,
        index = this.index;
      index.available = result.available;
      index.discovered = {
        codex: files.filter((x) => x.kind === "codex").length,
        claude: files.filter((x) => x.kind === "claude").length,
      };
      if (!this.processLoading && Date.now() - this.processLast >= 30000) {
        this.processLoading = true;
        this.processLast = Date.now();
        Promise.resolve()
          .then(() => this.processReader())
          .then((x) => (this.processes = x))
          .catch(() => (this.processes = null))
          .finally(() => (this.processLoading = false));
      }
      const allowed = new Set(files.map((x) => x.file));
      if (result.complete)
        for (const key of new Set([
          ...index.files.keys(),
          ...index.quotas.keys(),
          ...this.scanned.keys(),
        ]))
          if (!allowed.has(key)) {
            index.files.delete(key);
            index.quotas.delete(key);
            this.scanned.delete(key);
            this.previewed.delete(key);
          }
      for (const file of files) {
        let previous = this.scanned.get(file.file);
        if (
          !previous ||
          file.size < previous.size ||
          (file.size === previous.size && file.mtime !== previous.mtime)
        ) {
          previous = {
            offset: 0,
            probe: 0,
            dropping: false,
            errors: 0,
            done: false,
            size: file.size,
            mtime: file.mtime,
          };
          this.scanned.set(file.file, previous);
          this.previewed.delete(file.file);
          index.files.delete(file.file);
          index.quotas.delete(file.file);
        } else if (file.size > previous.size) {
          previous.done = false;
          previous.size = file.size;
          previous.mtime = file.mtime;
        }
        if (budget.bytes <= 0 || expired(budget)) continue;
        try {
          if (!this.previewed.has(file.file)) {
            this.previewed.add(file.file);
            await readUsage(file.file, file.kind, index, {
              tail: true,
              root: file.root,
              budget,
            });
          }
          if (!previous.done && budget.bytes > 0 && !expired(budget))
            await readUsage(file.file, file.kind, index, {
              state: previous,
              root: file.root,
              budget,
            });
          previous.readError = false;
        } catch (error) {
          previous.readError = true;
          if (error.code === "ENOENT") {
            index.files.delete(file.file);
            index.quotas.delete(file.file);
            this.scanned.delete(file.file);
            this.previewed.delete(file.file);
            this.discovery.found.delete(file.file);
          }
        }
      }
      index.codex =
        [...index.quotas.values()].sort((a, b) =>
          b.updated.localeCompare(a.updated),
        )[0] || null;
      index.errors =
        result.errors +
        [...this.scanned.values()].reduce(
          (n, x) => n + x.errors + (x.readError ? 1 : 0),
          0,
        );
      this.pending =
        !result.complete ||
        files.some((file) => {
          const state = this.scanned.get(file.file);
          return !state || (!state.done && !state.readError);
        });
      index.complete =
        result.complete &&
        !result.limited &&
        !this.pending &&
        index.errors === 0 &&
        files.length > 0 &&
        files.every(
          (file) =>
            (index.files.has(file.file) || index.quotas.has(file.file)) &&
            !this.scanned.get(file.file)?.partial,
        );
      this.last = this.pending ? 0 : Date.now();
    } catch {
      this.index.errors++;
      this.pending = false;
      this.last = Date.now();
    } finally {
      this.running = false;
    }
  }
  snapshot() {
    return {
      ...this.index.snapshot(this.clock()),
      processes: this.processes,
      scanning: this.running,
      pending: this.pending,
      updated: this.clock().toISOString(),
    };
  }
}
module.exports = {
  record,
  windowsOf,
  UsageIndex,
  blocked,
  safeFile,
  discover,
  readUsage,
  Metrics,
};
