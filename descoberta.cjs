'use strict';
// Le somente registros de sessao e escalares conhecidos. Nunca abre arquivos do cwd.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { scalarRecordStream } = require('./pe-metadata-reader.cjs');
const { readSafe } = require('./leitor.cjs');
const FIELDS = ['type', 'timestamp', 'id', 'thread_name', 'sessionId', 'parentSessionId', 'parentAgentId', 'agentId', 'isSidechain', 'cwd',
  'title', 'aiTitle', 'customTitle', 'agentType', 'message.stop_reason', 'summary', 'sessionTitle', 'message.id', 'message.model',
  'message.usage.input_tokens', 'message.usage.output_tokens', 'message.usage.cache_read_input_tokens', 'message.usage.cache_creation_input_tokens',
  'payload.id', 'payload.cwd', 'payload.title', 'payload.thread_name', 'payload.type', 'payload.parent_thread_id',
  'payload.source.subagent.parent_thread_id', 'payload.source.subagent.thread_spawn.parent_thread_id',
  'payload.source.subagent.agent_path', 'payload.source.subagent.thread_spawn.agent_path',
  'payload.info.total_token_usage.total_tokens', 'payload.info.total_token_usage.input_tokens', 'payload.info.total_token_usage.output_tokens',
  'payload.rate_limits.primary.used_percent', 'payload.rate_limits.primary.window_minutes', 'payload.rate_limits.primary.resets_at',
  'payload.rate_limits.secondary.used_percent', 'payload.rate_limits.secondary.window_minutes', 'payload.rate_limits.secondary.resets_at',
  'payload.info.last_token_usage.total_tokens', 'payload.info.last_token_usage.input_tokens', 'payload.info.last_token_usage.output_tokens'];
const PRIVATE = /(?:^|[\\/])(?:\.env(?:\.|$)|seed(?:\.|$)|wallet(?:\.|$)|carteira(?:\.|$)|(?:api[-_]?|private[-_]?)?key(?:\.|$)|token(?:\.|$)|credentials?(?:\.|$))/i;
const roles = new Set(['coordenador', 'executor', 'revisor', 'outro']);
const norm = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function label(x) {
  if (typeof x !== 'string') return '';
  // Conservador: um titulo suspeito inteiro e reservado antes de truncar ou exibir.
  const sensitive = /\b(?:seed|senha|password|secret|bearer|mnemonic)\b|\.env\b|\bsk[-_]|(?:token|key)\s*[:=]|\b[a-f\d]{64}\b|:\/\/[^\s/@]+:[^\s/@]+@|[?&](?:key|token|apikey|api_key|access_token|password|senha)=|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/i;
  const base58 = /(?<![\w/])[1-9A-HJ-NP-Za-km-z]{32,}(?![\w])/;
  const words = /(?:^|\s)(?:[\p{L}]+\s+){11}[\p{L}]+(?:\s|$)/u;
  if (sensitive.test(x) || words.test(x)) return 'Título reservado';
  x = x.replace(/0x[a-f\d]{40,}/gi, '[endereço oculto]').replace(new RegExp(base58.source, 'g'), '[endereço oculto]');
  return x.replace(/[\u0000-\u001f\u007f\u2013\u2014]|\p{Extended_Pictographic}/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
}
function canonicalCwd(x) {
  if (typeof x !== 'string' || !x.trim()) return null;
  let value = x.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
  if (/^[a-z]:\//i.test(value) || value.startsWith('//')) value = value.toLowerCase();
  value = value.replace(/\/\.claude\/worktrees\/[^/]+(?:\/.*)?$/, '');
  return value || '/';
}
function readable(x) {
  const value = label(String(x || '').replace(/\\/g, '/').split('/').filter(Boolean).at(-1)?.replace(/[-_]+/g, ' ') || 'Pasta desconhecida');
  return value ? value[0].toLocaleUpperCase('pt-BR') + value.slice(1) : 'Pasta desconhecida';
}
function safe(root, file) {
  try {
    const base = path.resolve(root), rel = path.relative(base, path.resolve(file));
    if (rel.startsWith('..') || path.isAbsolute(rel) || PRIVATE.test(rel) || fs.lstatSync(base).isSymbolicLink()) return false;
    for(let parent=base;;parent=path.dirname(parent)){if(fs.lstatSync(parent).isSymbolicLink())return false;if(parent===path.dirname(parent))break;}
    let cur = base;
    for (const part of rel.split(path.sep).filter(Boolean)) { cur = path.join(cur, part); if (fs.lstatSync(cur).isSymbolicLink()) return false; }
    return true;
  } catch { return false; }
}
function dirs(home, dir) {
  try { return safe(home, dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter(e => !e.isSymbolicLink() && !PRIVATE.test(e.name)).sort((a, b) => a.name.localeCompare(b.name)) : []; }
  catch { return []; }
}
function sources(home, {claudeHome = process.env.CLAUDE_CONFIG_DIR || path.join(home, '.claude'), codexHome = process.env.CODEX_HOME || path.join(home, '.codex'), diagnostics = []} = {}) {
  const out = [];
  function entries(root, dir, family) {
    try {
      if (!safe(root, dir)) {
        if (fs.existsSync(dir)) diagnostics.push({family, reason: 'Pasta é atalho ou privada. Solução: defina ' + (family === 'claude' ? 'CLAUDE_CONFIG_DIR' : 'CODEX_HOME') + ' com a pasta real, sem atalho.'});
        return [];
      }
      return fs.readdirSync(dir, {withFileTypes:true}).filter(e => {
        if(e.isSymbolicLink() || PRIVATE.test(e.name)) { diagnostics.push({family, reason: 'Arquivo pulado: atalho ou privado.'}); return false; }
        return true;
      }).sort((a,b)=>a.name.localeCompare(b.name));
    } catch { return []; }
  }
  const claude = path.join(claudeHome, 'projects');
  for (const p of entries(claudeHome, claude, 'claude').filter(e=>e.isDirectory())) {
    const dir=path.join(claude,p.name);
    for (const e of entries(claudeHome,dir,'claude')) {
      if(e.isFile() && e.name.endsWith('.jsonl')) out.push({file:path.join(dir,e.name),root:claudeHome,family:'claude',folder:p.name});
      if(e.isDirectory()) for(const a of entries(claudeHome,path.join(dir,e.name,'subagents'),'claude'))
        if(a.isFile() && /^agent-.+\.jsonl$/.test(a.name)) out.push({file:path.join(dir,e.name,'subagents',a.name),root:claudeHome,family:'claude',folder:p.name,parent:e.name,child:a.name.slice(6,-6)});
    }
  }
  function codex(dir) {
    for(const e of entries(codexHome,dir,'codex')) {
      const file=path.join(dir,e.name);
      if(e.isDirectory()) codex(file);
      else if(e.isFile() && e.name.endsWith('.jsonl')) out.push({file,root:codexHome,family:'codex',folder:null});
    }
  }
  codex(path.join(codexHome,'sessions'));
  return out;
}
const signature = s => [s.dev, s.ino, s.size, s.mtimeMs, s.ctimeMs].join(':');
const fileCache = new Map();
let bytesRead = 0;
function *records(home, source, diagnostics) {
  const root = source.root || home;
  if (!safe(root, source.file)) return;
  let fd;
  try {
    const before = fs.lstatSync(source.file);
    fd = fs.openSync(source.file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const opened = fs.fstatSync(fd);
    if (signature(before) !== signature(opened)) throw Error('Arquivo mudou');
    const tailHash=size=>{const count=Math.min(128,size),tail=Buffer.alloc(count);if(count)bytesRead+=fs.readSync(fd,tail,0,count,size-count);return crypto.createHash('sha256').update(tail).digest('hex');};
    let cache=fileCache.get(source.file);
    if(cache && opened.size>cache.size && tailHash(cache.size)!==cache.tail)cache=null;
    if(!cache || cache.dev!==opened.dev || cache.ino!==opened.ino || opened.size<cache.size || (opened.size===cache.size && opened.mtimeMs!==cache.mtimeMs)) {
      cache={dev:opened.dev,ino:opened.ino,size:0,mtimeMs:0,rows:[],parser:scalarRecordStream(2*1024*1024,FIELDS),decoder:new TextDecoder('utf-8',{fatal:true})};
    }
    const buf=Buffer.alloc(65536);
    let position=cache.size;
    while(position<opened.size) {
      const n=fs.readSync(fd,buf,0,Math.min(buf.length,opened.size-position),position);
      if(!n) break;
      position+=n; bytesRead+=n;
      cache.rows.push(...cache.parser.push(cache.decoder.decode(buf.subarray(0,n),{stream:true})));
    }
    if(signature(opened)!==signature(fs.fstatSync(fd)) || !safe(root,source.file)) throw Error('Arquivo mudou');
    if(position!==cache.size)cache.tail=tailHash(position);cache.size=position;cache.mtimeMs=opened.mtimeMs;fileCache.set(source.file,cache);
    yield* cache.rows;
  } catch { fileCache.delete(source.file); diagnostics.push({family:source.family,reason:'Leitura parcial ou arquivo mudando; será relido.'}); }
  finally { if(fd!==undefined) fs.closeSync(fd); }
}
const num = n => Number.isFinite(n) && n >= 0 ? n : null;
function usage(record, prefix) {
  const total = num(record[prefix + '.total_tokens']);
  if (total !== null) return total;
  const input = num(record[prefix + '.input_tokens']), output = num(record[prefix + '.output_tokens']);
  return input !== null && output !== null ? input + output : null;
}
// Esperando voce: so a sessao cujo ultimo registro tem menos de 24 h. Mais velha vira Parada.
const WAIT_WINDOW_MS = 24 * 3600000;
function localSnapshot({ home = process.env.PAINEL_HOME || require('node:os').homedir(), now = Date.now(), configDir = path.join(__dirname, 'config'), activeMs = 15 * 60000, claudeHome, codexHome } = {}) {
  now = Number(new Date(now));
  const diagnostics = [], found = new Map(), projects = new Map();
  let config = {};
  try { config = JSON.parse(readSafe(configDir, 'sessoes.json', 64000)); if (!config || Array.isArray(config) || typeof config !== 'object') config = {}; }
  catch { config = {}; }
  for (const source of sources(home, {claudeHome,codexHome,diagnostics})) {
    let row = null;
    for (const r of records(home, source, diagnostics)) {
      if (!row) {
        const nativeId = source.family === 'claude' ? r.sessionId || path.basename(source.file, '.jsonl') : r['payload.id'];
        if (!nativeId) continue;
        const child = source.child || (source.family === 'claude' && (r.isSidechain === true || /^agent-/.test(path.basename(source.file))) ? r.agentId || path.basename(source.file, '.jsonl').replace(/^agent-/, '') : null);
        const id = source.family + ':' + nativeId + (child ? ':' + child : '');
        row = found.get(id);
        if (!row) {
          row = { id, family: source.family, nativeId, folder: source.folder, cwd: null, title: '', titlePriority: 0, parentId: null, lastAt: null, startedDay: Number.isFinite(Date.parse(r.timestamp)) ? new Date(r.timestamp).toISOString().slice(0, 10) : null, tokens: null, todayTokens: null, usage: new Map(), cumulative: new Map(), helpers: [] };
          found.set(id, row);
        }
        if (source.parent || child) row.parentId = 'claude:' + (source.parent || nativeId) + (r.parentAgentId ? ':' + r.parentAgentId : '');
      }
      row.cwd = row.cwd || r.cwd || r['payload.cwd'] || null;
      const agent = r['payload.source.subagent.agent_path'] || r['payload.source.subagent.thread_spawn.agent_path'] || r.agentType;
      if(agent) row.agentName = readable(agent);
      if(r.type === 'assistant') { row.stopReason = r['message.stop_reason'] || null; row.lastAssistantAt = r.timestamp || null; }
      if(r.type === 'user') row.stopReason = null;
      if(r['payload.type'] === 'task_complete') row.stopReason = 'end_turn';
      else if(r['payload.type'] === 'task_started' || r['payload.type'] === 'agent_message' || r['payload.type'] === 'token_count') row.stopReason = 'tool_use';
      if(r['payload.rate_limits.primary.used_percent'] !== undefined) row.rateLimits = Object.fromEntries(['primary','secondary'].map(k=>[k,{usedPercent:num(r['payload.rate_limits.'+k+'.used_percent']),windowMinutes:num(r['payload.rate_limits.'+k+'.window_minutes']),resetsAt:num(r['payload.rate_limits.'+k+'.resets_at'])}]));
      const parent = r.parentSessionId || r['payload.parent_thread_id'] || r['payload.source.subagent.parent_thread_id'] || r['payload.source.subagent.thread_spawn.parent_thread_id'];
      if (parent && parent !== row.nativeId && !row.parentId) row.parentId = row.family + ':' + parent;
      const stamp = Date.parse(r.timestamp);
      if (Number.isFinite(stamp) && stamp <= now + 60000) row.lastAt = new Date(stamp).toISOString();
      const title = label(r.customTitle || r.aiTitle || r.title || r.sessionTitle || r['payload.title'] || r['payload.thread_name'] || r.summary);
      const priority = r.customTitle ? 4 : r.aiTitle ? 3 : r.summary ? 1 : 2;
      if (title && priority >= row.titlePriority) { row.title = title; row.titlePriority = priority; }
      const day = Number.isFinite(stamp) && stamp <= now + 60000 ? new Date(stamp).toISOString().slice(0, 10) : null;
      if (row.family === 'claude' && r.type === 'assistant') {
        const n = usage(r, 'message.usage');
        if (n !== null) {
          const tokens = n + (num(r['message.usage.cache_read_input_tokens']) || 0) + (num(r['message.usage.cache_creation_input_tokens']) || 0);
          // O mesmo message.id pode ser registrado varias vezes durante uma resposta.
          const key = r['message.id'] || source.file + ':' + row.usage.size;
          const prev = row.usage.get(key);
          if (!prev || tokens >= prev.tokens) row.usage.set(key, { tokens, day });
        }
      }
      if (row.family === 'codex' && r['payload.type'] === 'token_count') {
        const n = usage(r, 'payload.info.total_token_usage'), last = usage(r, 'payload.info.last_token_usage');
        if (n !== null) row.cumulative.set(source.file, [...(row.cumulative.get(source.file) || []), { tokens: n, day }]);
        else if (last !== null) row.usage.set(source.file + ':' + row.usage.size, { tokens: last, day });
      }
    }
  }
  const indexFile = path.join(codexHome || process.env.CODEX_HOME || path.join(home,'.codex'), 'session_index.jsonl');
  const indexRoot = codexHome || process.env.CODEX_HOME || path.join(home,'.codex');
  if (safe(indexRoot, indexFile)) for (const r of records(home, { file: indexFile, root:indexRoot, family: 'codex' }, diagnostics)) {
    const row = found.get('codex:' + r.id), title = label(r.thread_name);
    if (row && title && !row.title) row.title = title;
  }
  const today = new Date(now).toISOString().slice(0, 10);
  let configuredProjects=[];try{const groups=JSON.parse(readSafe(configDir,'projetos.json',64000));if(Array.isArray(groups))configuredProjects=groups.filter(g=>g && typeof g.pasta==='string' && typeof g.nome==='string').map(g=>({pasta:canonicalCwd(g.pasta),nome:label(g.nome)})).sort((a,b)=>b.pasta.length-a.pasta.length);}catch{}
  const roots = [...found.values()].map(r=>canonicalCwd(r.cwd)).filter(Boolean).sort((a,b)=>a.length-b.length);
  for (const row of found.values()) {
    const values = [...row.usage.values()];
    // Codex total_token_usage e acumulado na conversa. Somamos apenas deltas.
    let previous = 0;
    const cumulative = [...row.cumulative.values()].flat().sort((a, b) => (a.day || '').localeCompare(b.day || '') || a.tokens - b.tokens);
    for (const v of cumulative) { const delta = Math.max(0, v.tokens - previous); previous = Math.max(previous, v.tokens); values.push({ tokens: delta, day: v.day }); }
    const missingBaseline = row.family === 'codex' && cumulative[0]?.day === today && row.startedDay !== today;
    if (values.length) { row.tokens = values.reduce((sum, v) => sum + v.tokens, 0); row.todayTokens = missingBaseline || values.some(v => !v.day) ? null : values.filter(v => v.day === today).reduce((sum, v) => sum + v.tokens, 0); }
    const rawCwd = canonicalCwd(row.cwd), explicit= configuredProjects.find(p=>rawCwd===p.pasta || rawCwd?.startsWith(p.pasta+'/')), cwd = explicit?.pasta || roots.find(p=>rawCwd === p || rawCwd?.startsWith(p+'/')) || rawCwd, key = cwd || row.family + ':pasta:' + row.folder;
    const projectId = 'p-' + crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
    row.projectId = projectId;
    if (!projects.has(projectId)) projects.set(projectId, { id: projectId, name: explicit?.nome || readable(cwd || row.folder), cwd, sessions: 0, helpers: 0, tokens: null, todayTokens: null, tokensExact: diagnostics.length === 0, lastAt: null });
    row.name = row.agentName || row.title || (row.parentId ? 'Ajudante ' + ([...found.values()].filter(x=>x.parentId).indexOf(row)+1) : projects.get(projectId).name);
    row.role = null;
    for (const [match, value] of Object.entries(config)) {
      if (!match || !value || typeof value !== 'object' || !norm([row.title, row.folder, row.cwd].join(' ')).includes(norm(match))) continue;
      row.name = label(value.nome) || row.name;
      row.role = roles.has(value.papel) ? value.papel : null;
      break;
    }
    row.status = !row.lastAt ? 'desconhecida' : now - Date.parse(row.lastAt) <= activeMs ? 'ativa' : 'parada';
    row.state = !row.lastAt ? 'unknown' : now-Date.parse(row.lastAt)<2*60000 ? 'working' : row.stopReason==='end_turn' ? (now-Date.parse(row.lastAt)<WAIT_WINDOW_MS ? 'waiting' : 'sleeping') : row.stopReason==='tool_use' && row.status==='ativa' ? 'working' : row.status==='ativa' ? 'working' : 'sleeping';
    delete row.usage; delete row.cumulative; delete row.titlePriority; delete row.folder; delete row.nativeId; delete row.startedDay;
  }
  const all = [...found.values()];
  for (const row of all) if (row.parentId) {
    const parent = found.get(row.parentId);
    if (parent) { parent.helpers.push(row.id); row.projectId = parent.projectId; }
    else diagnostics.push({ family: row.family, reason: 'Ajudante com sessao mae ausente.' });
  }
  // Projeto do ajudante e o da mae; projetos sem sessoes continuam se o filho for orfao.
  for (const row of all) {
    const p = projects.get(row.projectId); if (!p) continue;
    p[row.parentId ? 'helpers' : 'sessions']++;
    if (row.tokens !== null) p.tokens = (p.tokens || 0) + row.tokens; else p.tokensExact = false;
    if (row.todayTokens !== null) p.todayTokens = (p.todayTokens || 0) + row.todayTokens; else p.tokensExact = false;
    if (row.lastAt && (!p.lastAt || row.lastAt > p.lastAt)) p.lastAt = row.lastAt;
  }
  const order={waiting:0,working:1,sleeping:2,unknown:3};
  all.sort((a,b)=>order[a.state]-order[b.state] || (b.lastAt || '').localeCompare(a.lastAt || ''));
  const sessions = all.filter(x => !x.parentId), helpers = all.filter(x => x.parentId), known = all.filter(x => x.tokens !== null);
  const daily = all.filter(x => x.todayTokens !== null);
  const consumption = { tokens: known.length ? known.reduce((n, x) => n + x.tokens, 0) : null, todayTokens: daily.length ? daily.reduce((n, x) => n + x.todayTokens, 0) : null, exact: known.length === all.length && daily.length === all.length && diagnostics.length === 0, period: 'Registros locais; hoje em UTC' };
  return { updated: new Date(now).toISOString(), sessions, helpers, projects: [...projects.values()].filter(p => p.sessions || p.helpers), consumption, activity: all.filter(x => x.lastAt).map(x => ({ sessionId: x.id, name: x.name, family: x.family, projectId: x.projectId, at: x.lastAt, status: x.status })).sort((a, b) => b.at.localeCompare(a.at)), diagnostics, activeMinutes: activeMs / 60000 };
}
function snapshot(options = {}) {
  bytesRead = 0;
  const now = Number(new Date(options.now || Date.now()));
  const home = options.home || process.env.PAINEL_HOME || require('node:os').homedir();
  let homes=options.homes;
  if(!homes && process.env.PAINEL_HOMES) {
    try { homes=JSON.parse(process.env.PAINEL_HOMES); } catch { homes=process.env.PAINEL_HOMES.split(';').filter(Boolean); }
  }
  homes=Array.isArray(homes) && homes.length ? [...new Set(homes.filter(x=>typeof x==='string').map(x=>path.resolve(x)))].slice(0,16) : [home];
  const chunks=homes.map((h,i)=>{
    const c=localSnapshot({...options,home:h,now});
    const prefix=homes.length>1?'casa-'+(i+1)+':':'';
    for(const r of [...c.sessions,...c.helpers]) { r.id=prefix+r.id;if(r.parentId)r.parentId=prefix+r.parentId;r.helpers=r.helpers.map(id=>prefix+id);r.source=homes.length>1?'Casa '+(i+1):'Local'; }
    return c;
  });
  const diagnostics=chunks.flatMap(c=>c.diagnostics), sourceStates=[];
  const sourceDir=options.sourcesDir || path.join(__dirname,'fontes');
  for(const e of dirs(sourceDir,sourceDir).filter(e=>e.isFile() && e.name.endsWith('.json')).slice(0,32)) {
    try {
      const j=JSON.parse(readSafe(sourceDir,e.name,2*1024*1024));
      if(j.version!==1 || !Number.isFinite(Date.parse(j.updated)) || !Array.isArray(j.sessions) || !Array.isArray(j.helpers) || j.sessions.length+j.helpers.length>5000) throw Error();
      const source=label(j.name || path.basename(e.name,'.json'));
      const prefix='fonte-'+crypto.createHash('sha256').update(e.name).digest('hex').slice(0,12)+':';
      const clean=r=>{
        if(!r || ![null,undefined].includes(r.tokens) && (typeof r.tokens!=='number'||num(r.tokens)===null) || r && ![null,undefined].includes(r.todayTokens) && (typeof r.todayTokens!=='number'||num(r.todayTokens)===null))throw Error();
        if(!r || !['claude','codex'].includes(r.family) || typeof r.id!=='string' || r.id.length>200 || (r.lastAt && !Number.isFinite(Date.parse(r.lastAt)))) throw Error();
        const cwd=canonicalCwd(typeof r.cwd==='string'?r.cwd.slice(0,500):'');
        return {id:prefix+r.id,parentId:r.parentId?prefix+String(r.parentId).slice(0,200):null,family:r.family,name:label(r.name)||'Sessão importada',cwd,projectId:'p-'+crypto.createHash('sha256').update(cwd||prefix).digest('hex').slice(0,16),lastAt:r.lastAt||null,tokens:num(r.tokens),todayTokens:num(r.todayTokens),state:['waiting','working','sleeping','unknown'].includes(r.state)?r.state:'unknown',status:!r.lastAt?'desconhecida':now-Date.parse(r.lastAt)<=15*60000?'ativa':'parada',helpers:[],source};
      };
      const sessions=j.sessions.map(clean),helpers=j.helpers.map(clean);
      if(sessions.some(r=>r.parentId)||helpers.some(r=>!r.parentId) || new Set([...sessions,...helpers].map(r=>r.id)).size!==sessions.length+helpers.length) throw Error();
      const ageSeconds=Math.max(0,Math.floor((now-Date.parse(j.updated))/1000)),stale=ageSeconds>300;
      if(stale) {diagnostics.push({family:'fonte',reason:source+' está sem atualização. Solução: rode node checar.cjs --exportar na origem e traga o arquivo de novo.'}); for(const r of [...sessions,...helpers]){r.state='unknown';r.status='desconhecida';}}
      sourceStates.push({name:source,updated:j.updated,ageSeconds,stale});chunks.push({sessions,helpers});
    }catch{diagnostics.push({family:'fonte',reason:'Fonte recusada. Solução: exporte com node checar.cjs --exportar; use JSON versão 1 com até 2 MB.'});}
  }
  const sessions=chunks.flatMap(c=>c.sessions),helpers=chunks.flatMap(c=>c.helpers),all=[...sessions,...helpers];
  const projects=new Map();
  for(const r of all) {
    const parent=all.find(p=>p.id===r.parentId);if(parent){r.projectId=parent.projectId;if(!parent.helpers.includes(r.id))parent.helpers.push(r.id);}
    if(!projects.has(r.projectId)) projects.set(r.projectId,{id:r.projectId,name:readable(r.cwd),cwd:r.cwd,sessions:0,helpers:0,tokens:null,todayTokens:null,tokensExact:true,lastAt:null});
    const p=projects.get(r.projectId);p[r.parentId?'helpers':'sessions']++;
    for(const key of ['tokens','todayTokens']) {if(r[key]!==null)p[key]=(p[key]||0)+r[key];else p.tokensExact=false;}
    if(r.lastAt && (!p.lastAt || r.lastAt>p.lastAt)) p.lastAt=r.lastAt;
  }
  // Preserva o nome da pasta agrupada do leitor local.
  for(const c of chunks) for(const p of c.projects||[]) if(projects.has(p.id)) projects.get(p.id).name=p.name;
  const order={waiting:0,working:1,sleeping:2,unknown:3};sessions.sort((a,b)=>order[a.state]-order[b.state]||(b.lastAt||'').localeCompare(a.lastAt||''));
  const sum=key=>all.some(r=>r[key]!==null)?all.reduce((n,r)=>n+(r[key]||0),0):null;
  const lastLimit=all.filter(r=>r.rateLimits).sort((a,b)=>(b.lastAt||'').localeCompare(a.lastAt||''))[0];
  const services=[];
  try {
    const configDir=options.configDir||path.join(__dirname,'config');const list=JSON.parse(readSafe(configDir,'servicos.json',64000));
    if(Array.isArray(list)) for(const service of list.slice(0,64)) {
      const item={name:label(service.nome)||'Serviço local',status:'desconhecido',ageSeconds:null,solucao:'Informe um arquivo de batimento em config/servicos.json. O painel não consulta URLs.'};
      if(typeof service.arquivo==='string') {
        const file=path.resolve(service.arquivo),root=path.dirname(file);
        // Nenhum segredo ou atalho, inclusive nos pais.
        let cur=file,valid=true;while(cur!==path.dirname(cur)){try{if(fs.lstatSync(cur).isSymbolicLink())valid=false;}catch{valid=false;}cur=path.dirname(cur);}
        if(valid && safe(root,file)) {
          const text=readSafe(root,path.basename(file),4096).trim();let stamp;
          try{const beat=JSON.parse(text);stamp=beat.at||beat.em;}catch{stamp=text;}
          const time=Date.parse(stamp);if(Number.isFinite(time) && time<=now+60000){item.ageSeconds=Math.max(0,Math.floor((now-time)/1000));item.status=item.ageSeconds<=(num(service.limiteSegundos)||60)?'vivo':'parado';item.solucao=item.status==='vivo'?'Batimento local atualizado.':'Confira o processo do serviço e faça ele gravar um novo batimento.';}
        }
      }
      services.push(item);
    }
  } catch {}
  return {updated:new Date(now).toISOString(),sessions,helpers,projects:[...projects.values()],consumption:{tokens:sum('tokens'),todayTokens:sum('todayTokens'),exact:all.length>0&&all.every(r=>r.tokens!==null&&r.todayTokens!==null)&&diagnostics.length===0,period:'Registros locais; hoje em UTC'},activity:all.filter(r=>r.lastAt).map(r=>({sessionId:r.id,name:r.name,family:r.family,projectId:r.projectId,at:r.lastAt,status:r.status})).sort((a,b)=>b.at.localeCompare(a.at)),diagnostics,activeMinutes:15,homes:homes.map(h=>String(h)),sources:sourceStates,services,limits:{codex:lastLimit?.rateLimits||null,claude:{solucao:'Solução: rode /usage no Claude Code.'}},reader:{bytesRead,files:fileCache.size}};
}

module.exports = { snapshot, canonicalCwd, readable, sources, label, localSnapshot };
