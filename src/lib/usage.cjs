const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { projectJSON } = require("./project-json.cjs");
const { metadataRecord, publicMetadata, paths: metadataPaths } = require("./agent-metadata.cjs");
const {metadataStory,key:storyKey}=require('./session-story.cjs');
const {ConversationCache}=require('./conversation-cache.cjs');
const {DailyUsage}=require('./daily-usage.cjs');
const countFields = [
  "input_tokens",
  "output_tokens",
  "cache_creation_input_tokens",
  "cache_read_input_tokens",
];
const paths = [
  ...metadataPaths,
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
    this.metadata = new Map();
    this.codex = null;
    this.quotas = new Map();
    this.complete = false;
    this.discovered = { codex: 0, claude: 0 };
    this.errors = 0;
    this.available = { codex: false, claude: false };
  }
  consume(kind, file, line) {
    // Project permitted metadata without decoding conversation bodies or tool arguments.
    const r = record(line);
    if (!r) return;
    const at = validTime(r.timestamp);
    const oldMeta=this.metadata.get(file)||{};
    const meta={...metadataRecord(r,oldMeta),...metadataStory(line,oldMeta)};
    if(at&&(meta.model||meta.projectId||meta.lastTool)){meta.kind=kind;meta.id=label(file);}
    if(kind==='claude'){const id=path.basename(file,'.jsonl');meta.sessionKey=storyKey(id);if(/^agent-/.test(id)){meta.helper=true;meta.helperKey=storyKey(id.replace(/^agent-/,''));}}
    if(at&&(!meta.helper||!meta.birthAt||at>=meta.birthAt)&&(r.type==='assistant'||r.type==='response_item'&&['function_call','function_call_output'].includes(r['payload.type']))&&(!meta.activityAt||at>meta.activityAt))meta.activityAt=at;
    this.metadata.set(file, meta);
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
        const records=old?.records||new Map();records.set(at+'|'+total,{at,total,weighted:meta.weightedTokens,window:this.readingEdge?.file===file?this.readingEdge.phase:'full'});
        if (!old || at >= old.at)
          this.files.set(file, {
            kind,
            id: label(file),
            at,
            total,
            messages: null,
            records,
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
      const rawId = r["message.id"];
      if (typeof rawId !== "string" || rawId.length > 200) return;
      const id=storyKey(rawId);
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
        entry.messages.set(id, { at, total, weighted: (numbers[0] || 0) + (numbers[1] || 0) + (numbers[2] || 0) + (numbers[3] || 0) * .1 });
    }
  }
  snapshot(now = new Date(),liveSessionKeys=null,previewOnly=null) {
    const daily = new Map(), days=new Map(),seenCodex=new Set(),claudeMessages=new Map(),
      sessions = [];
    const conversations=new Map();
    const addDay=(at,agent,tokens,weighted,conversation)=>{const day=at.slice(0,10);if(!days.has(day))days.set(day,{day,claude:0,codex:0,weightedTokens:0,weightedKnown:false});const d=days.get(day);d[agent]+=tokens;if(Number.isFinite(weighted)){d.weightedTokens+=weighted;d.weightedKnown=true;}const key=agent+'|'+conversation+'|'+day;const row=conversations.get(key)||{conversation,day,agent,tokens:0,weightedTokens:null};row.tokens+=tokens;if(Number.isFinite(weighted))row.weightedTokens=(row.weightedTokens||0)+weighted;conversations.set(key,row);};
    const bySession=new Map([...this.metadata.values()].filter(m=>m.sessionKey).map(m=>[m.sessionKey,m]));
    const family=file=>{let meta=this.metadata.get(file),id=meta?.sessionKey||label(file),seen=new Set();while(meta?.parentKey&&!seen.has(meta.parentKey)){seen.add(meta.parentKey);id=meta.parentKey;meta=bySession.get(id);}return id;};
    for (const [file, e] of this.files) {
      if(previewOnly&&!previewOnly.has(file))continue;
      let tokens = e.total;
      if (e.messages) {
        tokens = 0;
        for (const [id,m] of e.messages) {
          tokens += m.total;
          if(!previewOnly){const prior=claudeMessages.get(id);if(!prior||m.at>prior.at||m.at===prior.at&&m.total>prior.total)claudeMessages.set(id,{...m,conversation:family(file)});}
        }
      } else if(e.records&&!previewOnly){const group=family(file);let prior=0,priorWeighted=0,previousRecord=null;for(const r of [...e.records.values()].sort((a,b)=>a.at.localeCompare(b.at)||a.total-b.total)){const delta=r.total>=prior?r.total-prior:r.total;const weighted=Number.isFinite(r.weighted)?Math.max(0,r.weighted-(r.total>=prior?priorWeighted:0)):null;const fingerprint=group+'|'+r.at+'|'+r.total+'|'+r.weighted;const unknownGap=r.window==='tail'&&(!previousRecord||previousRecord.window==='head')&&(previousRecord?.at||this.metadata.get(file)?.startedAt||'').slice(0,10)!==r.at.slice(0,10);if(!seenCodex.has(fingerprint)){if(!unknownGap)addDay(r.at,e.kind,delta,weighted,group);seenCodex.add(fingerprint);}prior=r.total;priorWeighted=r.weighted||0;previousRecord=r;}}
      const meta=this.metadata.get(file)||{};
      const parent=[...this.metadata.values()].find(x=>x.sessionKey===meta.parentKey);
      const processAlive=Array.isArray(liveSessionKeys)?liveSessionKeys.includes(meta.sessionKey):null;
      const ended=!!(meta.finishedAt||meta.closedAt)&&!processAlive;
      const recent=processAlive||!ended&&now.getTime()-Date.parse(meta.activityAt||e.at)<=600000;
      const assignment=parent?.helperDescriptions?.find(d=>d.agentKey===meta.helperKey);const task=assignment?{taskTitle:assignment.title,taskTitlePT:assignment.titlePT,role:assignment.role}:meta.taskTitle?meta:parent||{};
      sessions.push({
        ...publicMetadata(meta),sessionKey:meta.sessionKey||null,parentKey:meta.parentKey||null,processAlive,taskTitle:task.taskTitle||null,taskTitlePT:task.taskTitlePT||null,taskWords:meta.taskWords||[],helper:!!meta.helper,action:meta.action||null,actionPT:meta.actionPT||null,finishedAt:meta.finishedAt||null,state:ended?'finished':recent?'recent':'resting',
        weightedTokens: e.messages ? [...e.messages.values()].reduce((n,m) => n + m.weighted, 0) : this.metadata.get(file)?.weightedTokens ?? null,
        id: e.id,
        agent: e.kind,
        updated: this.metadata.get(file)?.activityAt || e.at,
        tokens,
        recent,
      });
    }
    for(const [file,meta] of this.metadata)if((!previewOnly||previewOnly.has(file))&&!this.files.has(file)&&meta.startedAt&&meta.kind){const processAlive=Array.isArray(liveSessionKeys)?liveSessionKeys.includes(meta.sessionKey):null,recent=processAlive||!meta.finishedAt&&!meta.closedAt&&!!meta.activityAt&&now.getTime()-Date.parse(meta.activityAt)<=600000,parent=[...this.metadata.values()].find(x=>x.sessionKey===meta.parentKey),task=meta.taskTitle?meta:parent||{};sessions.push({...publicMetadata(meta),sessionKey:meta.sessionKey||null,parentKey:meta.parentKey||null,processAlive,taskTitle:task.taskTitle||null,taskTitlePT:task.taskTitlePT||null,helper:!!meta.helper,action:meta.action||null,actionPT:meta.actionPT||null,finishedAt:meta.finishedAt||null,state:(meta.finishedAt||meta.closedAt)&&!processAlive?'finished':recent?'recent':'resting',id:meta.id,agent:meta.kind,updated:meta.activityAt||meta.startedAt,tokens:null,recent:!!recent});}
    if(previewOnly)return{sessions:sessions.sort((a,b)=>Number(b.recent)-Number(a.recent)||b.updated.localeCompare(a.updated))};
    for(const m of claudeMessages.values()){daily.set(m.at.slice(0,10),(daily.get(m.at.slice(0,10))||0)+m.total);addDay(m.at,'claude',m.total,m.weighted,m.conversation);}
    // Message identity stays hashed and prevents copied Claude transcripts from
    // charging again when only the copy is inside a later selection window.
    this.dayContributions=[...conversations.values()].filter(row=>row.agent==='codex');
    for(const [unit,m] of claudeMessages)this.dayContributions.push({conversation:m.conversation,unit,day:m.at.slice(0,10),agent:'claude',tokens:m.total,weightedTokens:m.weighted});
    const today=now.toISOString().slice(0,10),weekStart=new Date(now.getTime()-6*86400000).toISOString().slice(0,10);
    const periodRows=[{key:'today',from:today,to:today},{key:'week',from:weekStart,to:today}].map(p=>{const rows=[...days.values()].filter(d=>d.day>=p.from&&d.day<=p.to);return{...p,claude:rows.reduce((n,d)=>n+d.claude,0),codex:rows.reduce((n,d)=>n+d.codex,0),weightedTokens:rows.some(d=>d.weightedKnown)?rows.reduce((n,d)=>n+d.weightedTokens,0):null};});
    for(const s of sessions){const meta=[...this.metadata.values()].find(m=>m.id===s.id),parent=bySession.get(meta?.parentKey),assignment=parent?.helperDescriptions?.find(d=>d.agentKey===meta?.helperKey);if(assignment){s.taskTitle=assignment.title;s.taskTitlePT=assignment.titlePT;s.role=assignment.role;s.taskWords=assignment.title.split(/\s+/);}else if(!s.taskWords)s.taskWords=meta?.taskWords||[];}
    const finished=sessions.filter(s=>s.state==='finished');
    const counts={active:sessions.filter(s=>s.recent).length,paused:sessions.filter(s=>s.state==='resting').length,finished:sessions.filter(s=>s.state==='finished').length};
    return {
      sampled:sessions.some(s=>s.sampled),periods:periodRows,counts,completedToday:[],finishedSessions:finished,
      quotaUpdated:this.codex?.updated||null,
      codex: this.codex,
      claude: {
        windows: [],
        source: "session usage, no account quota available",
        tokens: sessions.some((x) => x.agent === "claude" && Number.isFinite(x.tokens))
          ? sessions
              .filter((x) => x.agent === "claude")
              .reduce((n, x) => n + x.tokens, 0)
          : null,
      },
      totals: {
        tokens: sessions.some(x=>Number.isFinite(x.tokens)) ? sessions.reduce((n,x)=>n+(x.tokens||0),0) : null,
        claude: sessions.some(x=>x.agent==='claude'&&Number.isFinite(x.tokens))?sessions.filter(x=>x.agent==='claude').reduce((n,x)=>n+(x.tokens||0),0):null,
        codex: sessions.some(x=>x.agent==='codex'&&Number.isFinite(x.tokens))?sessions.filter(x=>x.agent==='codex').reduce((n,x)=>n+(x.tokens||0),0):null,
        weightedTokens: sessions.some(x=>Number.isFinite(x.weightedTokens)) ? sessions.reduce((n,x)=>n+(x.weightedTokens||0),0) : null,
        sessions: sessions.length,
        known: sessions.filter(x=>Number.isFinite(x.tokens)).length,
        weighted: sessions.filter(x=>Number.isFinite(x.weightedTokens)).length,
      },
      sessions: sessions
        .sort((a, b) => Number(b.recent)-Number(a.recent)||b.updated.localeCompare(a.updated)),
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
async function safeUsageFile(root, file,parents=new Map()) {
  if (blocked(file)) throw Error("Protected path");
  const validate=async dir=>{if(!parents.has(dir))parents.set(dir,Promise.all([fs.promises.realpath(dir),fs.promises.lstat(dir)]).then(([real,stat])=>{if(stat.isSymbolicLink()||blocked(real))throw Error('Linked path');return real;}));return parents.get(dir);};
  const base = await validate(root),
    real = await fs.promises.realpath(file),
    rel = path.relative(base, real);
  if (blocked(real) || rel.startsWith("..") || path.isAbsolute(rel))
    throw Error("Outside reader root");
  let parent = root;
  for (const part of path.relative(root, file).split(path.sep).slice(0, -1)) {
    parent = path.join(parent, part);
    await validate(parent);
  }
  if ((await fs.promises.lstat(file)).isSymbolicLink())
    throw Error("Linked file");
  const stat = await fs.promises.stat(file);
  if (!stat.isFile()) throw Error("Not a file");
  return stat;
}
function fileSessionKey(file,kind) {
  const name=path.basename(file,'.jsonl');
  const id=kind==='codex'?/([\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12})$/i.exec(name)?.[1]:/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(name)?name:null;
  return id?storyKey(id):null;
}
function discoveryState(home, now, scopeDays=1,liveSessionKeys=null) {
  const codexRoot=path.join(home,'.codex','sessions'),day=now.toISOString().slice(0,10).split('-');
  return {
    // Claude projects are walked before the older Codex days. Same selection and counts; the
    // Codex history (hundreds of older files, each checked) no longer delays active conversations.
    queue: [
      {dir:path.join(codexRoot,...day),root:codexRoot,kind:'codex',depth:0,bootstrap:true},
      {
        dir: path.join(home, ".claude", "projects"),
        root: path.join(home, ".claude", "projects"),
        kind: "claude",
        depth: 4,
        isRoot: true,
      },
      {
        dir: path.join(home, ".codex", "sessions"),
        root: path.join(home, ".codex", "sessions"),
        kind: "codex",
        depth: 3,
        isRoot: true,
      },
    ],
    current: null,
    found: new Map(),
    old: new Map(),
    available: { codex: false, claude: false },
    errors: 0,
    complete: false,
    limited: false,
    visited: 0,
    cutoff: now.getTime() - scopeDays * 86400000,
    liveSessionKeys,
    liveKnown: true,
    roots:{codex:codexRoot,claude:path.join(home,'.claude','projects')},
    parents:new Map(),
  };
}
async function discover(
  home,
  now = new Date(),
  { state, budget, limits,scopeDays=1,liveSessionKeys=null } = {},
) {
  state ||= discoveryState(home,now,scopeDays,liveSessionKeys);
  const cap = limitsOf(limits);
  budget = budget || {
    entries: cap.entries,
    bytes: cap.bytes,
    deadline: performance.now() + cap.milliseconds,
  };
  await turn();
  // Live keys that arrive after this discovery started: counted older files bound to a live
  // process move into the selection. Only their metadata is checked; content is not opened here.
  if(state.recheckLive){state.recheckLive=false;for(const [file,kind] of [...state.old]){const sessionKey=fileSessionKey(file,kind);if(!sessionKey||!state.liveSessionKeys?.includes(sessionKey))continue;try{const root=state.roots[kind],stat=await safeUsageFile(root,file,state.parents);state.found.set(file,{file,kind,size:stat.size,mtime:stat.mtimeMs,root,sessionKey});state.old.delete(file);}catch{state.errors++;}}}
  // Yield every 32 entries, not after each one. Same entries, budget and order; on a busy PC
  // each event-loop hop could cost a time slice and the walk took up to ~2x longer (measured).
  const inspections=[];let sinceTurn=0;
  // The first eligible file may sit behind several async directory reads.
  // Permit a small bootstrap of at most 64 entries without blocking the loop.
  while (budget.entries > 0 && (!expired(budget) || (state.found.size === 0 && state.visited < 64)) && !state.complete) {
    if (!state.current) {
      const next = state.queue.shift();
      if (!next) {
        state.complete = true;
        break;
      }
      budget.entries--;
      try {
        if(next.bootstrap){let parent=path.dirname(next.root);for(const part of [path.basename(next.root),...path.relative(next.root,next.dir).split(path.sep)]){if((await fs.promises.lstat(parent)).isSymbolicLink())throw Error('Linked path');parent=path.join(parent,part);}}
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
        if(next.bootstrap)state.available[next.kind]=true;
        state.current = { ...next, handle };
        if (next.isRoot) state.available[next.kind] = true;
      } catch (error) {
        if (error.code !== "ENOENT") state.errors++;
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
      const inspect=async()=>{try {
        const stat = await safeUsageFile(current.root, file,state.parents);
        const sessionKey=fileSessionKey(file,kind);
        if (stat.mtimeMs >= state.cutoff || sessionKey && state.liveSessionKeys?.includes(sessionKey)) {
          state.found.set(file, {
            file,
            kind,
            size: stat.size,
            mtime: stat.mtimeMs,
            root: current.root,
            sessionKey,
          });
          state.old.delete(file);
        } else if(!state.found.has(file)) state.old.set(file,kind);
      } catch {
        state.errors++;
      }};inspections.push(inspect());if(inspections.length>=8){await Promise.all(inspections);inspections.length=0;}
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
    if(++sinceTurn>=32){sinceTurn=0;await turn();}
  }
  await Promise.all(inspections);
  return {
    files: [...state.found.values()].sort((a, b) => b.mtime - a.mtime),
    available: { ...state.available },
    errors: state.errors,
    complete: state.complete,
    limited: state.limited,
    oldConversations:{total:state.old.size,codex:[...state.old.values()].filter(kind=>kind==='codex').length,claude:[...state.old.values()].filter(kind=>kind==='claude').length,complete:state.complete&&!state.limited},
    state,
  };
}
async function readUsage(
  file,
  kind,
  index,
  { tail = false, start = 0, end, state, root = path.dirname(file), budget } = {},
) {
  const tailBytes = Math.min(16384, budget?.bytes ?? limitsDefault.bytes);
  const actualStat = await safeUsageFile(root, file),stat={size:Number.isFinite(end)?Math.min(end,actualStat.size):actualStat.size},
    cursor = state || {
      offset: tail ? Math.max(0, stat.size - tailBytes) : start,
      probe: 0,
      dropping: tail && stat.size > tailBytes,
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
    const buffer = Buffer.alloc(65536);
    // Slow async filesystem operations must not starve the cursor forever.
    // After the time slice, permit at most one 16 KiB window, still charged
    // against the shared byte budget. No record text persists between rounds.
    // Async validation can use the whole wall-clock slice on a busy PC.
    // Reading still advances within the shared one MiB cap, yielding after
    // each 16 KiB window so HTTP requests are never waiting on a giant read.
    const canProgress = () => !expired(budget) ||
      budget.read < Math.min(limitsDefault.bytes, budget.capBytes);
    cursor.done = false;
    while (canProgress() && budget.read < limitsDefault.bytes) {
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
        // Finish one already delimited record after a slow filesystem wait.
        // Keep the byte cap and maxLine bound; otherwise a >16 KiB record can
        // be reread forever without advancing when each time slice expires.
        const finishLine=!budget.completedLine&&length<=maxLine&&length<=budget.bytes;
        while (read < length && (canProgress() || finishLine)) {
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
        if(finishLine&&expired(budget)&&budget.read>=buffer.length)budget.completedLine=true;
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
      if (cursor.probe > 0 || (cursor.dropping && !tail)) {
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
const largeFile=2*1024*1024,headSize=128*1024,tailSize=256*1024;
async function readEdges(file,index,previous,budget){
  if(!previous.edge)previous.edge={phase:'head',cursor:{offset:0,probe:0,dropping:false,errors:0}};
  const edge=previous.edge;
  index.readingEdge={file:file.file,phase:edge.phase};if(edge.phase==='head'){
    await readUsage(file.file,file.kind,index,{root:file.root,state:edge.cursor,end:headSize,budget});
    if(!edge.cursor.done)return;
    previous.errors+=edge.cursor.errors||0;
    edge.phase='tail';edge.cursor={offset:Math.max(headSize,file.size-tailSize),probe:0,dropping:true,errors:0};
  }
  index.readingEdge={file:file.file,phase:edge.phase};if(budget.bytes>0){await readUsage(file.file,file.kind,index,{root:file.root,state:edge.cursor,budget});if(edge.cursor.done){previous.done=true;previous.offset=file.size;previous.partial=!!edge.cursor.partial;previous.errors+=edge.cursor.errors||0;delete previous.edge;const meta=index.metadata.get(file.file);if(meta)meta.sampled=true;}}
}
class Metrics {
  constructor(
    home,
    { processReader = async () => null, clock = () => new Date(), limits,cacheDir=path.join(home,'.lazy-du-panel','metadata') } = {},
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
    this.published=null;this.readAt=null;
    this.cache=cacheDir===false?null:new ConversationCache(cacheDir,home);this.cachePrepared=false;this.finishedFiles=new Set();
    this.scopeDays=1;this.daily=this.cache?.daily||new DailyUsage();this.scopeRevision=0;
  }
  async prepareCache(){if(!this.cachePreparation)this.cachePreparation=(async()=>{await this.cache?.prepare();this.cachePrepared=true;this.scopeDays=this.cache?.scopeDays||this.scopeDays;})();await this.cachePreparation;}
  async setScopeDays(days){
    if(![1,3,7].includes(days))throw new RangeError('Scope must be 1, 3 or 7 days');
    await this.prepareCache();
    if(days===this.scopeDays)return days;
    this.scopeDays=days;this.scopeRevision++;
    await this.cache?.setScopeDays(days);
    this.scopeChanged=true;this.pending=true;this.last=0;
    return days;
  }
  async refresh() {
    if (this.running) return;
    clearTimeout(this.nextRound);
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
      await this.prepareCache();
      if (!this.processLoading && Date.now() - this.processLast >= 30000) {
        this.processLoading = true;this.processLast = Date.now();
        this.processPromise=Promise.resolve().then(()=>this.processReader()).then(x=>(this.processes=x)).catch(()=>(this.processes=null)).finally(()=>(this.processLoading=false));
      }
      // The process source (1.6 to 2.2 s measured at CPU 100%) no longer holds discovery.
      // A discovery started before its answer receives the live keys once it settles, and the
      // publication below waits for that answer, so a live older conversation is not left out.
      if(this.scopeChanged){await this.discovery?.current?.handle.close().catch(()=>{});this.discovery=null;this.scopeChanged=false;}
      if (!this.discovery || (this.discovery.complete && !wasPending)){
        this.discovery = discoveryState(this.home, this.clock(),this.scopeDays,this.processLoading?null:this.processes?.liveSessionKeys??null);
        this.discovery.liveKnown=!this.processLoading;
      }else if(!this.discovery.liveKnown&&!this.processLoading){this.discovery.liveSessionKeys=this.processes?.liveSessionKeys??null;this.discovery.liveKnown=true;this.discovery.recheckLive=Array.isArray(this.discovery.liveSessionKeys)&&this.discovery.liveSessionKeys.length>0;}
      const revision=this.scopeRevision;
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
      const allowed = new Set(files.map((x) => x.file));
      if (result.complete)
        for (const key of new Set([
          ...index.files.keys(),
          ...index.quotas.keys(),
          ...this.scanned.keys(),
        ]))
          if (!allowed.has(key)) {
            index.files.delete(key);
            index.metadata.delete(key);
            index.quotas.delete(key);
            this.scanned.delete(key);
            this.previewed.delete(key);
            this.finishedFiles.delete(key);
          }
      // Discovery yields for filesystem IO. Give reading its own time slice,
      // while retaining the shared byte cap across both phases.
      budget.deadline = performance.now() + this.limits.milliseconds;
      const readingOrder = [...files].sort((a,b) => Number(b.mtime>=this.clock().getTime()-86400000)-Number(a.mtime>=this.clock().getTime()-86400000)||b.mtime-a.mtime);
      for (const [position,file] of readingOrder.entries()) {
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
          index.metadata.delete(file.file);
          index.quotas.delete(file.file);
          this.finishedFiles.delete(file.file);
          if(this.cache?.restore(index,file)){previous.done=true;previous.offset=file.size;this.previewed.add(file.file);this.finishedFiles.add(file.file);continue;}
        } else if (file.size > previous.size) {
          if(file.size>largeFile){index.files.delete(file.file);index.metadata.delete(file.file);index.quotas.delete(file.file);previous.offset=0;delete previous.edge;}
          previous.done = false;
          previous.size = file.size;
          previous.mtime = file.mtime;
          this.finishedFiles.delete(file.file);
        }
        if(!result.complete&&position>=10&&!previous.done)continue;
        if (budget.bytes <= 0 || expired(budget)) continue;
        try {
          if(file.size>largeFile){try{if(!previous.done)await readEdges(file,index,previous,budget);}finally{index.readingEdge=null;}this.previewed.add(file.file);}
          else {
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
          }
          previous.readError = false;
          if(previous.done){this.finishedFiles.add(file.file);if(previous.cachedMtime!==file.mtime){this.cache?.save(index,file,previous.partial);previous.cachedMtime=file.mtime;}}
        } catch (error) {
          previous.readError = true;
          if (error.code === "ENOENT") {
            index.files.delete(file.file);
            index.metadata.delete(file.file);
            index.quotas.delete(file.file);
            this.scanned.delete(file.file);
            this.previewed.delete(file.file);
            this.finishedFiles.delete(file.file);
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
      // Nothing else left but the process answer: wait for it here instead of spinning rounds.
      if(!this.discovery.liveKnown&&result.complete&&this.processPromise&&files.every(file=>{const state=this.scanned.get(file.file);return state&&(state.done||state.readError);}))await this.processPromise;
      this.pending = revision!==this.scopeRevision ||
        !result.complete ||
        !this.discovery.liveKnown ||
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
      if(!this.pending){for(const [file,meta]of index.metadata){const read=this.scanned.get(file);meta.metadataComplete=!!read?.done&&!read?.partial&&!read?.errors&&!meta.sampled&&!meta.toolTruncated;}this.readAt=this.clock().toISOString();const now=new Date(this.readAt),snapshot=this.index.snapshot(now,this.processes?.liveSessionKeys??null);this.daily.merge(index.dayContributions);this.published=structuredClone({...snapshot,...this.daily.snapshot(now),scopeDays:this.scopeDays,oldConversations:result.oldConversations,periodSource:'accumulated observed conversation days'});await this.cache?.flush(files);}
    } catch {
      this.index.errors++;
      this.pending = false;
      this.last = Date.now();
    } finally {
      this.running = false;
      if(this.pending)this.nextRound=setTimeout(()=>{if(this.pending)this.refresh().catch(()=>{});},0).unref();
    }
  }
  snapshot() {
    const selected=[...(this.discovery?.found.keys()||[])];
    const progress={done:selected.filter(file=>{const state=this.scanned.get(file);return state?.done||state?.readError;}).length,total:selected.length,discovering:!this.discovery?.complete};
    const preview=this.pending&&!this.published?this.index.snapshot(this.clock(),this.processes?.liveSessionKeys??null,this.finishedFiles).sessions:[];
    return {
      ...(this.published||{complete:false,codex:null,claude:{tokens:null,windows:[]},sessions:[],daily:[],periods:[],totals:{sessions:0,tokens:null,claude:null,codex:null,weightedTokens:null,weighted:0},counts:{active:0,paused:0,finished:0},completedToday:[],available:this.index.available}),
      processes: this.processes,
      scanning: this.running,
      pending: this.pending,
      ready:!!this.published,progress,
      updated: this.readAt,
      previewSessions:preview,scopeDays:this.scopeDays,oldConversations:this.published?.oldConversations||{total:this.discovery?.old.size||0,complete:false},cache:{hits:this.cache?.hits||0,misses:this.cache?.misses||0},
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
