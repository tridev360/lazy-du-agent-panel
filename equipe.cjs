'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { safeText } = require('./realtime.cjs');

const ROLE_NAMES = { dados_vivos: 'Dados ao vivo', mapa_motion: 'Desenho e movimento', comandos: 'Comandos e equipe', gates_quarta: 'Testa os ramos', codigo: 'Revisa o codigo', seguranca: 'Revisa seguranca', produto: 'Revisa o produto', infra: 'Infra e custo', cortes: 'Cortes e comunidade' };
const TOOLS = { exec: 'Terminal', exec_command: 'Terminal', js: 'Navegador', apply_patch: 'Edita arquivos', view_image: 'Olha imagens', spawn_agent: 'Chama ajudantes', send_message: 'Conversa com equipe', followup_task: 'Passa tarefa', list_agents: 'Ve a equipe', wait_agent: 'Espera ajudante', wait: 'Espera', sleep: 'Espera', web__run: 'Pesquisa', Read: 'Le arquivos', Edit: 'Edita arquivos', Write: 'Escreve arquivos', Bash: 'Terminal', Grep: 'Busca nos arquivos', Glob: 'Busca arquivos', Task: 'Chama ajudantes', Agent: 'Chama ajudantes' };
const FIELDS = ['timestamp','type','id','thread_name','sessionId','parentSessionId','agentId','parentAgentId','agentName','cwd','slug','isSidechain','uuid','message.id','message.model','message.usage.*','message.content.*.type','message.content.*.name','payload.id','payload.parent_thread_id','payload.agent_nickname','payload.agent_path','payload.cwd','payload.model','payload.effort','payload.reasoning_effort','payload.type','payload.name','payload.role','payload.phase','payload.status','payload.skills.*','payload.task_id','payload.task_title','payload.source.subagent.parent_thread_id','payload.source.subagent.agent_path','payload.source.subagent.thread_spawn.parent_thread_id','payload.source.subagent.thread_spawn.agent_path','payload.info.total_token_usage.*','payload.rate_limits.primary.*','payload.rate_limits.secondary.*'];
const selectors = FIELDS.map(field => field.split('.'));
const CODEX_ID = /^[a-f\d]{8}-[a-f\d]{4}-7[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const CODEX_HEADER_FIELDS = ['timestamp','type','payload.id','payload.cwd','payload.agent_nickname','payload.agent_path','payload.parent_thread_id','payload.source.subagent.parent_thread_id','payload.source.subagent.agent_path','payload.source.subagent.thread_spawn.parent_thread_id','payload.source.subagent.thread_spawn.agent_path'];
selectors.push(['message','content','*','id']);
for (let index = selectors.length - 1; index >= 0; index--) {
  const field = selectors[index].join('.');
  if (/^(?:message\.usage|payload\.info\.total_token_usage|payload\.rate_limits\.(?:primary|secondary))\.\*$/.test(field)) {
    const prefix = selectors.splice(index, 1)[0].slice(0, -1);
    const names = field.includes('rate_limits') ? ['used_percent','window_minutes','resets_at'] : ['input_tokens','output_tokens','cached_input_tokens','cache_creation_input_tokens','cache_read_input_tokens','total_tokens','reasoning_output_tokens'];
    for (const name of names) selectors.push([...prefix, name]);
  }
}

// JSON values outside this metadata allowlist are skipped, never decoded or retained.
// In particular this parser cannot return message text, tool arguments or tool results.
function projectMetadata(line, options = {}) {
  const selected = options.fields ? options.fields.map(field => field.split('.')) : selectors;
  let cursor = 0;
  const text = String(line);
  const space = () => { while (/\s/.test(text[cursor] || '') && cursor < text.length) cursor++; };
  const matches = (parts, prefix) => selected.some(selector => (prefix ? selector.length >= parts.length : selector.length === parts.length) && parts.every((part, index) => selector[index] === '*' || selector[index] === part));
  const stringEnd = () => {
    const start = cursor++;
    while (cursor < text.length) {
      const quote = text.indexOf('"', cursor);
      if (quote < 0) break;
      let backslashes = 0;
      for (let before = quote - 1; text[before] === '\\'; before--) backslashes++;
      cursor = quote + 1;
      if (backslashes % 2 === 0) {
        if (options.strict) for (let i = start + 1; i < cursor - 1; i++) {
          if (text.charCodeAt(i) < 32) throw Error('Invalid metadata');
          if (text[i] === '\\') {
            const escape = text[++i];
            if (escape === 'u') { if (!/^[a-f\d]{4}$/i.test(text.slice(i + 1, i + 5))) throw Error('Invalid metadata'); i += 4; }
            else if (!'"\\/bfnrt'.includes(escape || '?')) throw Error('Invalid metadata');
          }
        }
        return [start, cursor];
      }
    }
    if (options.prefix) return [start, text.length];
    throw Error('Incomplete metadata');
  };
  const skip = () => {
    if (options.strict) { skipStrict(); return; }
    space();
    if (text[cursor] === '"') { stringEnd(); return; }
    if (text[cursor] === '{' || text[cursor] === '[') {
      const stack = [text[cursor++] === '{' ? '}' : ']'];
      while (cursor < text.length && stack.length) {
        const char = text[cursor];
        if (char === '"') stringEnd();
        else { cursor++; if (char === '{') stack.push('}'); else if (char === '[') stack.push(']'); else if (char === '}' || char === ']') { if (stack.pop() !== char) throw Error('Invalid metadata'); } }
      }
      if (stack.length) throw Error('Incomplete metadata');
      return;
    }
    while (cursor < text.length && !/[,}\]\s]/.test(text[cursor])) cursor++;
  };
  function skipStrict(depth = 0) {
    if (depth > 64) throw Error('Invalid metadata');
    space();
    const char = text[cursor];
    if (char === '"') { stringEnd(); return; }
    if (char === '{' || char === '[') {
      const object = char === '{', end = object ? '}' : ']'; cursor++; space();
      if (text[cursor] === end) { cursor++; return; }
      while (cursor < text.length) {
        if (object) { if (text[cursor] !== '"') throw Error('Invalid metadata'); stringEnd(); space(); if (text[cursor++] !== ':') throw Error('Invalid metadata'); }
        skipStrict(depth + 1); space();
        if (text[cursor] === end) { cursor++; return; }
        if (text[cursor++] !== ',') throw Error('Invalid metadata'); space();
      }
      throw Error('Incomplete metadata');
    }
    const primitive = /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(cursor));
    if (!primitive) throw Error('Invalid metadata'); cursor += primitive[0].length;
  }
  function value(parts) {
    space();
    const char = text[cursor];
    if (char === '{') {
      cursor++;
      const result = {}, keys = new Set();
      try {
        space();
        while (cursor < text.length && text[cursor] !== '}') {
          if (text[cursor] !== '"') throw Error('Invalid metadata');
          const [start, end] = stringEnd();
          if (end - start > 200) throw Error('Invalid metadata');
          const key = JSON.parse(text.slice(start, end));
          if (options.strict && keys.has(key)) throw Error('Duplicate metadata'); keys.add(key);
          space(); if (text[cursor++] !== ':') throw Error('Invalid metadata');
          const next = [...parts, key];
          if (matches(next, true)) result[key] = value(next); else skip();
          space(); if (text[cursor] === ',') { cursor++; space(); if (options.strict && text[cursor] === '}') throw Error('Invalid metadata'); } else if (text[cursor] !== '}') throw Error('Invalid metadata');
        }
        if (text[cursor] === '}') cursor++; else if (options.strict) throw Error('Incomplete metadata');
      } catch (error) { if (options.strict) throw error; /* A truncated head still contains valid metadata fields preceding skipped text. */ }
      return result;
    }
    if (char === '[') {
      cursor++; const result = [];
      space();
      let count = 0;
      while (cursor < text.length && text[cursor] !== ']' && count++ < 2000) {
        if (matches([...parts, '*'], true)) result.push(value([...parts, '*'])); else skip();
        space(); if (text[cursor] === ',') { cursor++; space(); } else if (text[cursor] !== ']') throw Error('Invalid metadata');
      }
      if (text[cursor] === ']') cursor++; else if (options.strict) throw Error('Incomplete metadata');
      return result;
    }
    if (char === '"') {
      const [start, end] = stringEnd();
      if (matches(parts, false) && options.prefix && /(?:message|text|content)$/.test(parts.at(-1))) {
        let prefix = text.slice(start + 1, Math.min(end - 1, start + 1 + options.prefix));
        // Decode only the authorized prefix, never the rest of the conversation.
        while (prefix.length) { try { return JSON.parse('"' + prefix + '"'); } catch { prefix = prefix.slice(0, -1); } }
        return '';
      }
      return matches(parts, false) && end - start <= (options.maxString || 1600) ? JSON.parse(text.slice(start, end)) : null;
    }
    const match = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(cursor));
    if (!match) throw Error('Invalid metadata');
    cursor += match[0].length;
    return matches(parts, false) ? JSON.parse(match[0]) : null;
  }
  try { const result = value([]); space(); return options.strict && cursor !== text.length ? null : result; } catch { return null; }
}

function codexHeader(source, checked) {
  const file = safePath(source.root, source.file, checked);
  const match = path.basename(source.file).match(/^rollout-(\d{4}-\d{2}-\d{2})T[\d:.-]+-([a-f\d-]+)\.jsonl$/i);
  if (!file || !match || !CODEX_ID.test(match[2])) return null;
  const relative = path.relative(path.resolve(source.root), path.resolve(source.file)).replace(/\\/g, '/');
  if (!relative.startsWith(match[1].replace(/-/g, '/') + '/')) return null;
  let fd;
  try {
    fd = fs.openSync(file, 'r'); const size = fs.fstatSync(fd).size, buffer = Buffer.alloc(Math.min(size, 65536));
    const count = fs.readSync(fd, buffer, 0, buffer.length, 0), newline = buffer.indexOf(10, 0);
    if (newline < 0 && size > count) return null;
    const header = projectMetadata(buffer.subarray(0, newline < 0 ? count : newline).toString('utf8'), { fields: CODEX_HEADER_FIELDS, strict: true });
    const payload = header?.payload, sub = payload?.source?.subagent;
    if (header?.type !== 'session_meta' || payload?.id !== match[2] || !validAt(header.timestamp) || typeof payload.cwd !== 'string') return null;
    const parents = [payload.parent_thread_id, sub?.parent_thread_id, sub?.thread_spawn?.parent_thread_id].filter(value => value != null);
    if (parents.some(id => typeof id !== 'string' || !CODEX_ID.test(id) || id === payload.id) || new Set(parents).size > 1) return null;
    return { record: header, id: payload.id, parentId: parents[0] || null };
  } catch { return null; } finally { if (fd !== undefined) fs.closeSync(fd); }
}

function safePath(root, file, checked) {
  const blocked = /(?:^|[\\/])(?:\.env(?:[./\\]|$)|[^\\/]*\.env$|PRIVADO(?:[./\\]|$)|_SECRETS(?:[./\\]|$)|backup-privado(?:[./\\]|$)|seed(?:[./\\]|$)|auth\.json$|credentials[^\\/]*)/i;
  if (blocked.test(file)) return null;
  try {
    const base = path.resolve(root), resolved = path.resolve(file), relative = path.relative(base, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
    const inspect = target => {
      const previous = checked?.get(target);
      if (previous?.isDirectory()) return previous;
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink()) throw Error('Invalid metadata path');
      if (stat.isDirectory()) checked?.set(target, stat);
      return stat;
    };
    inspect(base);
    let current = base;
    for (const part of relative.split(path.sep).filter(Boolean)) { current = path.join(current, part); inspect(current); }
    let realBase = checked?.get('real:' + base);
    if (!realBase) { realBase = fs.realpathSync(base); checked?.set('real:' + base, realBase); }
    const real = path.join(realBase, relative);
    return !blocked.test(real) ? real : null;
  } catch { return null; }
}

function list(root, relative = '', checked) {
  const directory = safePath(root, path.join(root, relative), checked);
  if (!directory) return [];
  try { return fs.readdirSync(directory, { withFileTypes: true }).filter(entry => !entry.isSymbolicLink() && !/^\./.test(entry.name)); } catch { return []; }
}

function validAt(value) { const time = typeof value === 'string' ? Date.parse(value) : NaN; return Number.isFinite(time) ? new Date(time).toISOString() : null; }
function amount(value) { return Number.isFinite(value) && value >= 0 ? value : null; }
function sensitiveCwd(value) { return /(?:PRIVADO|_SECRETS|backup-privado|(?:^|[\\/])(?:\.env(?:[./\\]|$)|[^\\/]*\.env$|seed(?:[./\\]|$)|auth\.json(?:[\\/]|$)|credentials[^\\/]*))/i.test(value || ''); }
function usageOf(raw, family) {
  if (!raw || typeof raw !== 'object') return null;
  const input = amount(raw.input_tokens), output = amount(raw.output_tokens);
  if (input === null || output === null) return null;
  const cached = amount(family === 'claude' ? raw.cache_read_input_tokens : raw.cached_input_tokens) || 0;
  const created = family === 'claude' ? amount(raw.cache_creation_input_tokens) || 0 : 0;
  const totalInput = family === 'claude' ? input + created + cached : input;
  return { input: totalInput, output, cached: Math.min(totalInput, cached), total: family === 'codex' && amount(raw.total_tokens) !== null ? raw.total_tokens : totalInput + output };
}
function weighted(usage) { return usage ? Math.max(0, usage.input - usage.cached) + usage.output + usage.cached * 0.1 : null; }
function toolLabel(name) { const plain = String(name || '').split('__').at(-1); return TOOLS[plain] || safeText(plain, 60); }
function roleName(value) { const name = String(value || '').split('/').filter(Boolean).at(-1); return ROLE_NAMES[name] || safeText((name || 'Ajudante').replace(/_/g, ' '), 80); }
function openingPrefixOf(line, family) {
  const header = projectMetadata(line);
  const codexMessage = header?.type === 'response_item' && header.payload?.type === 'message' && header.payload?.role === 'user';
  const user = family === 'codex' ? header?.type === 'event_msg' && header.payload?.type === 'user_message' || codexMessage : header?.type === 'user' && !header.message?.content?.some(item => item?.type === 'tool_result');
  if (!user) return null;
  const record = projectMetadata(line, { fields: family === 'codex' ? codexMessage ? ['payload.content','payload.content.*.type','payload.content.*.text'] : ['payload.message'] : ['message.content','message.content.*.type','message.content.*.text'], prefix: 1024 });
  return family === 'codex' ? codexMessage ? typeof record?.payload?.content==='string'?record.payload.content:record?.payload?.content?.find(item=>item.type==='input_text'||item.type==='text')?.text : record?.payload?.message : typeof record?.message?.content === 'string' ? record.message.content : record?.message?.content?.find(item => item.type === 'text')?.text;
}
function openingTitleOf(line, family) {
  const text = openingPrefixOf(line, family);
  if (!text || /^\s*(?:# AGENTS\.md instructions|<environment_context>|<INSTRUCTIONS>)/i.test(text)) return null;
  const heading = /^\s*(?:#{1,3}\s*)?((?:CODEX|CLAUDE)\s+[A-ZÀ-Ý0-9][^\r\n]{1,100})/u.exec(text)?.[1]?.replace(/\s*\([^)]*$/, '').trim();
  if (heading) return safeText(heading, 100);
  // 26p authorizes only the beginning of the first actual request as a title source.
  // Keep a short sanitized opening, never subsequent messages or the rest of the prompt.
  const title = text.replace(/(?:https?:\/\/|(?:[a-z]:[\\/]))\S+|\b[^\s@]+@[^\s@]+\b|<[^>]*>/gi, '').split(/[\r\n!?]/, 1)[0].replace(/^\s*#{1,6}\s*/, '').replace(/[`*_]/g, '').trim().split(/\s+/).slice(0, 7).join(' ');
  return safeText(title, 70) || null;
}

function projectConfig(root) {
  try {
    const raw = JSON.parse(require('./leitor.cjs').readSafe(root, 'estado/projetos.json', 64000));
    if (!Array.isArray(raw.projetos) || raw.projetos.length > 100) return [];
    return raw.projetos.filter(item => item && typeof item.nome === 'string' && Array.isArray(item.pastas)).map(item => ({ id: safeText(item.id, 60) || 'project-' + createHash('sha1').update(item.nome).digest('hex').slice(0, 10), name: safeText(item.nome, 80), color: /^#[a-f\d]{6}$/i.test(item.cor || '') ? item.cor : '#73b6ff', paths: item.pastas.filter(folder => typeof folder === 'string' && folder.length <= 500).map(folder => normalizeCwd(folder)) }));
  } catch { return []; }
}
function normalizeCwd(value) { return String(value || '').replace(/^file:\/\/\//i, '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase(); }
function projectOf(cwd, configuration) {
  const target = normalizeCwd(cwd);
  let match, size = -1;
  for (const item of configuration) for (const prefix of item.paths) if (prefix && (target === prefix || target.startsWith(prefix + '/')) && prefix.length > size) { match = item; size = prefix.length; }
  if (match) return { id: match.id, name: match.name, color: match.color, configured: true };
  const name = safeText(String(cwd || '').split(/[\\/]/).filter(Boolean).at(-1), 80) || 'Projeto local';
  return { id: 'project-' + createHash('sha1').update(target || '?').digest('hex').slice(0, 10), name, color: '#73b6ff', configured: false };
}

class TeamReader {
  constructor(stateRoot, codexRoot, options = {}) {
    this.stateRoot = stateRoot;
    this.codexRoot = codexRoot;
    this.claudeRoot = options.claudeRoot === false ? null : options.claudeRoot || path.join((process.env.PAINEL_HOME || os.homedir()), '.claude', 'projects');
    this.files = new Map(); this.names = new Map(); this.week = { used: null, at: null };
    this.headBytes = options.headBytes || 262144; this.tailBytes = options.tailBytes || 524288;
  }
  discover(now) {
    const result = [];
    if (this.codexRoot) {
      for (let day = 0; day < 3; day++) {
        const date = new Date(now.getTime() - 3 * 3600000 - day * 86400000).toISOString().slice(0, 10).replace(/-/g, '/');
        for (const entry of list(this.codexRoot, date, this.checked)) {
          if (!entry.isFile() || !/^rollout-[\wT:.-]+\.jsonl$/.test(entry.name)) continue;
          const file = path.join(this.codexRoot, date, entry.name);
          result.push({ root: this.codexRoot, file, family: 'codex' });
        }
      }
    }
    if (this.claudeRoot) {
      for (const project of list(this.claudeRoot, '', this.checked).filter(entry => entry.isDirectory()).slice(0, 100)) {
        const projectDir = project.name;
        for (const entry of list(this.claudeRoot, projectDir, this.checked)) {
          if (entry.isFile() && /^[a-f\d-]{20,}\.jsonl$/i.test(entry.name)) result.push({ root: this.claudeRoot, file: path.join(this.claudeRoot, projectDir, entry.name), family: 'claude', projectDir });
          else if (entry.isDirectory() && /^[a-f\d-]{20,}$/i.test(entry.name)) {
            const relative = path.join(projectDir, entry.name, 'subagents');
            for (const child of list(this.claudeRoot, relative, this.checked)) if (child.isFile() && /^agent-[\w-]+\.jsonl$/i.test(child.name)) result.push({ root: this.claudeRoot, file: path.join(this.claudeRoot, relative, child.name), family: 'claude', parentSession: entry.name, projectDir });
          }
        }
      }
    }
    const recent = result.filter(source => {
      const file = safePath(source.root, source.file, this.checked);
      if (!file) return false;
      try { const stat = fs.statSync(file); source.stat = stat; return stat.isFile() && (source.family === 'codex' || stat.mtimeMs >= now.getTime() - 60 * 60000 || this.files.has(file)); } catch { return false; }
    }).sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs).slice(0, 250);
    return this.withReferencedCodexParents(recent, now);
  }
  withReferencedCodexParents(recent, now) {
    // UUIDv7 carries the creation date. Inspect only that date and its neighbours,
    // then accept the first-line metadata only when filename and header agree.
    // The index already supplies titles; it does not contain rollout locations.
    const known = new Map(), recovered = new Map(), attempted = new Map();
    for (const source of recent) if (source.family === 'codex') {
      const header = codexHeader(source, this.checked);
      if (header) known.set(header.id, { ...source, header });
    }
    let lookups = 0;
    const locate = id => {
      if (attempted.has(id)) return attempted.get(id);
      if (!CODEX_ID.test(id) || lookups++ >= 64) return null;
      attempted.set(id, null);
      const created = Number.parseInt(id.replace(/-/g, '').slice(0, 12), 16);
      if (!Number.isFinite(created) || created > now.getTime() + 86400000 || created < Date.UTC(2000, 0, 1)) return null;
      const candidates = [];
      for (const delta of [-1, 0, 1]) {
        const date = new Date(created + delta * 86400000).toISOString().slice(0, 10).replace(/-/g, '/');
        for (const entry of list(this.codexRoot, date, this.checked)) {
          if (!entry.isFile() || !entry.name.endsWith('-' + id + '.jsonl')) continue;
          const file = safePath(this.codexRoot, path.join(this.codexRoot, date, entry.name), this.checked);
          if (!file) continue;
          try {
            const stat = fs.statSync(file), source = { root: this.codexRoot, file, family: 'codex', stat, metadataOnly: true };
            if (!stat.isFile()) continue;
            const header = codexHeader(source, this.checked);
            if (header?.id === id) candidates.push({ ...source, header });
          } catch {}
        }
      }
      const source = candidates.length === 1 ? candidates[0] : null;
      attempted.set(id, source); return source;
    };
    for (const seed of known.values()) {
      if (sensitiveCwd(seed.header.record.payload.cwd)) continue;
      const seen = new Set([seed.header.id]), chain = []; let parent = seed.header.parentId, complete = true;
      while (parent) {
        if (seen.has(parent) || seen.size > 16) { complete = false; break; }
        seen.add(parent);
        const source = known.get(parent) || recovered.get(parent) || locate(parent);
        if (!source || sensitiveCwd(source.header.record.payload.cwd)) { complete = false; break; }
        if (!known.has(parent)) chain.push(source);
        parent = source.header.parentId;
      }
      // Do not publish a partial, forged, private or cyclic recovered ancestry.
      if (complete) for (const source of chain) recovered.set(source.header.id, source);
    }
    return [...recent, ...recovered.values()].filter((source, index, sources) => sources.findIndex(other => other.file === source.file) === index);
  }
  scanNames() {
    const directory = path.dirname(this.codexRoot || '');
    const source = { root: directory, file: path.join(directory, 'session_index.jsonl'), family: 'index' };
    const file = safePath(source.root, source.file, this.checked);
    if (!file) return;
    try { source.stat = fs.statSync(file); if (source.stat.isFile()) this.read(source); } catch {}
  }
  newEntry(source) {
    const fileId = source.file.match(/([a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})\.jsonl$/i)?.[1];
    const childId = source.file.match(/agent-([\w-]+)\.jsonl$/i)?.[1];
    return { file: source.file, family: source.family, id: source.family === 'codex' ? fileId : source.parentSession ? `${source.parentSession}:${childId}` : fileId, parentId: source.parentSession || null, conversationId: source.parentSession || fileId, projectDir: source.projectDir, offset: 0, rest: '', metaSeen: false, tools: new Map(), toolIds: new Set(), skills: new Set(), usageById: new Map(), usage: null, tokensExact: true, toolsExact: true, firstAt: null, lastAt: null, lastKind: null, lastAction: null };
  }
  read(source) {
    const file = safePath(source.root, source.file, this.checked);
    if (!file) return;
    let entry = this.files.get(file);
    if (entry && source.stat.size < entry.offset) { this.files.delete(file); entry = null; }
    const first = !entry;
    if (!entry) { entry = this.newEntry(source); entry.metadataOnly = !!source.metadataOnly; this.files.set(file, entry); if (source.header) this.consume(entry, source.header.record); }
    if (!first && source.stat.size <= entry.offset) return;
    let fd;
    try {
      fd = fs.openSync(file, 'r');
      const actualSize = fs.fstatSync(fd).size;
      const block = (offset, length) => { const bytes = Buffer.alloc(Math.max(0, length)); const read = fs.readSync(fd, bytes, 0, bytes.length, offset); return bytes.subarray(0, read).toString('utf8'); };
      let content;
      if (first && actualSize > this.headBytes + this.tailBytes) {
        const head = block(0, this.headBytes), boundary = head.lastIndexOf('\n');
        const headLines = boundary >= 0 ? head.slice(0, boundary).split('\n') : [head];
        for (const line of headLines) this.consume(entry, projectMetadata(line));
        const tail = block(actualSize - this.tailBytes, this.tailBytes), firstNewline = tail.indexOf('\n');
        content = firstNewline >= 0 ? tail.slice(firstNewline + 1) : '';
        entry.tokensExact = source.family === 'codex';
        entry.toolsExact = false;
      } else {
        const start = first ? 0 : entry.offset;
        // A burst is consumed in bounded chunks rather than allocating the growing file.
        const length = Math.min(actualSize - start, 2 * 1024 * 1024);
        content = entry.rest + block(start, length);
        entry.offset = start + length;
      }
      if (first && actualSize > this.headBytes + this.tailBytes) entry.offset = actualSize;
      const lines = content.split('\n'); entry.rest = lines.pop();
      if (entry.rest.length > 2 * 1024 * 1024) entry.rest = '';
      for (const line of lines) if (line.length <= 2 * 1024 * 1024) this.consume(entry, projectMetadata(line));
      // A complete final record without a newline is valid; keep incomplete bytes for append.
      if (entry.rest.trim().endsWith('}')) {
        const record = projectMetadata(entry.rest);
        if (record?.type || source.family === 'index' && record?.id) { this.consume(entry, record); entry.rest = ''; }
      }
    } catch {} finally { if (fd !== undefined) fs.closeSync(fd); }
  }
  consume(entry, record) {
    if (!record || typeof record !== 'object') return;
    if (entry.family === 'index') { if (typeof record.id === 'string' && typeof record.thread_name === 'string') this.names.set(record.id, safeText(record.thread_name, 120)); return; }
    const at = validAt(record.timestamp), payload = record.payload || {};
    const stale = at && entry.lastAt && at < entry.lastAt;
    const previousActivity = stale ? Object.fromEntries(['lastKind','lastAction','currentItemId','currentItemTitle','currentItemAt','model','effort'].map(key => [key, entry[key]])) : null;
    if (entry.family === 'codex') {
      if (record.type === 'session_meta') {
        if (entry.metaSeen) return;
        entry.metaSeen = true;
        if (typeof payload.id === 'string') entry.id = safeText(payload.id, 100);
        const sub = payload.source?.subagent;
        entry.parentId = payload.parent_thread_id || sub?.parent_thread_id || sub?.thread_spawn?.parent_thread_id || null;
        entry.cwd = typeof payload.cwd === 'string' ? payload.cwd : null;
        entry.nickname = typeof payload.agent_nickname === 'string' ? safeText(payload.agent_nickname, 60) : null;
        entry.role = payload.agent_path || sub?.agent_path || sub?.thread_spawn?.agent_path || null;
        entry.firstAt = at;
        if (Array.isArray(payload.skills)) for (const skill of payload.skills) if (typeof skill === 'string') entry.skills.add(safeText(skill, 60));
        return;
      }
      if (at && entry.firstAt && at < entry.firstAt) return;
      if (record.type === 'turn_context') { entry.model = safeText(payload.model, 80) || entry.model; entry.effort = safeText(payload.effort || payload.reasoning_effort, 30) || entry.effort; }
      if (record.type === 'event_msg' && payload.type === 'token_count') {
        const usage = usageOf(payload.info?.total_token_usage, 'codex');
        if (usage) entry.usage = usage;
        for (const rate of [payload.rate_limits?.primary, payload.rate_limits?.secondary]) if (rate?.window_minutes === 10080 && amount(rate.used_percent) !== null && rate.used_percent <= 100 && at && (!this.week.at || at > this.week.at)) this.week = { used: rate.used_percent, at };
      }
      if (record.type === 'response_item' && ['function_call','custom_tool_call'].includes(payload.type) && typeof payload.name === 'string') this.tool(entry, payload.name, at);
      else if (record.type === 'event_msg' && /^(?:task_started|turn_started)$/.test(payload.type || '')) { entry.lastKind = 'walking'; entry.lastAction = 'Novo item'; entry.currentItemId = safeText(payload.task_id, 100) || null; entry.currentItemTitle = safeText(payload.task_title, 80).split(/\s+/).slice(0, 5).join(' ') || null; entry.currentItemAt = at; }
      else if (record.type === 'event_msg' && /^(?:task_complete|turn_complete|shutdown_complete)$/.test(payload.type || '') || record.type === 'response_item' && payload.phase === 'final_answer') { entry.lastKind = 'done'; entry.lastAction = 'Terminou o passo'; }
      else if (record.type === 'event_msg' && /^(?:agent_message|agent_reasoning)$/.test(payload.type || '')) { entry.lastKind = 'working'; entry.lastAction = 'Explicando'; }
      else if (record.type === 'event_msg' && /^(?:turn_aborted|error)$/.test(payload.type || '')) { entry.lastKind = 'waiting'; entry.lastAction = 'Precisa revisar'; }
    } else {
      if (!entry.cwd && typeof record.cwd === 'string') entry.cwd = record.cwd;
      if (!entry.metaSeen && (record.sessionId || record.cwd)) {
        entry.metaSeen = true;
        entry.sessionId = safeText(record.sessionId, 100) || entry.conversationId;
        if (!entry.parentId && record.parentSessionId) entry.parentId = safeText(record.parentSessionId, 100);
        entry.conversationId = entry.parentId || entry.sessionId || entry.conversationId;
        entry.cwd = typeof record.cwd === 'string' ? record.cwd : null;
        entry.nickname = safeText(record.agentName, 60) || null;
        entry.firstAt = at;
      }
      if (record.message?.model) entry.model = safeText(record.message.model, 80);
      const rawUsage = record.message?.usage;
      const usageId = record.message?.id || record.uuid;
      if (rawUsage && usageId) {
        const previousMessage = entry.usageById.get(usageId);
        if (!previousMessage?.at || !at || at >= previousMessage.at) {
          const raw = { ...(previousMessage?.raw || {}) };
          for (const key of ['input_tokens','output_tokens','cache_creation_input_tokens','cache_read_input_tokens']) if (amount(rawUsage[key]) !== null) raw[key] = rawUsage[key];
          const usage = usageOf(raw, 'claude');
          if (usage) {
            const previousTotal = entry.usage || { input: 0, output: 0, cached: 0, total: 0 };
            const previousContribution = previousMessage?.usage || { input: 0, output: 0, cached: 0, total: 0 };
            entry.usage = Object.fromEntries(Object.keys(previousTotal).map(key => [key, previousTotal[key] - previousContribution[key] + usage[key]]));
          }
          entry.usageById.set(usageId, { raw, usage, at: at || previousMessage?.at || null });
        }
      }
      const tools = record.message?.content?.filter(item => item?.type === 'tool_use' && typeof item.name === 'string') || [];
      for (const [index, tool] of tools.entries()) {
        const id = typeof tool.id === 'string' ? tool.id : usageId ? usageId + ':' + tool.name + ':' + index : null;
        if (!tool.id) entry.toolsExact = false;
        if (id && entry.toolIds.has(id)) continue;
        if (id) entry.toolIds.add(id);
        this.tool(entry, tool.name, at);
      }
      if (record.type === 'assistant' && !tools.length) { entry.lastKind = 'working'; entry.lastAction = 'Explicando'; }
      else if (record.type === 'user' && !record.message?.content?.some(item => item?.type === 'tool_result')) { entry.lastKind = 'walking'; entry.lastAction = 'Novo pedido'; }
      else if (/^(?:result|completed)$/.test(record.type || '')) { entry.lastKind = 'done'; entry.lastAction = 'Terminou o passo'; }
    }
    if (at && (!entry.lastAt || at > entry.lastAt)) entry.lastAt = at;
    if (!entry.firstAt && at) entry.firstAt = at;
    if (previousActivity) Object.assign(entry, previousActivity);
  }
  tool(entry, raw, at) {
    const name = safeText(raw, 100);
    if (!name) return;
    entry.tools.set(name, (entry.tools.get(name) || 0) + 1);
    const label = toolLabel(name);
    entry.lastKind = /^(?:wait|wait_agent|sleep)$/.test(name.split('__').at(-1)) ? 'waiting' : 'working';
    entry.lastAction = label || 'Usa ferramenta';
    if (/cua_repl|computer_use/.test(name)) entry.skills.add('computer-use');
    if (at && (!entry.lastAt || at > entry.lastAt)) entry.lastAt = at;
  }
  openingTitle(entry) {
    if (entry.metadataOnly) return null;
    if (entry.openingTitleChecked) return entry.openingTitle || null;
    if (Date.now() > this.titleReadUntil) return null;
    const source = this.sourcesByFile?.get(entry.file), file = source && safePath(source.root, entry.file, this.checked);
    if (!file) return null;
    let fd;
    try {
      fd = fs.openSync(file, 'r');
      const size = fs.fstatSync(fd).size, offset = entry.openingOffset || 0;
      const length = Math.min(Math.max(0, size - offset), this.headBytes), buffer = Buffer.alloc(length);
      const count = fs.readSync(fd, buffer, 0, length, offset);
      const lines = buffer.subarray(0, count).toString('utf8').split('\n');
      if (entry.openingDropping) { if (lines.length === 1) lines.length = 0; else { lines.shift(); entry.openingDropping = false; } }
      for (const line of lines) {
        const prefix = openingPrefixOf(line, entry.family);
        // Injected house rules precede the actual work and are not its title source.
        if (/^\s*(?:# AGENTS\.md instructions|<environment_context>|<INSTRUCTIONS>)/i.test(prefix || '')) continue;
        if(prefix)entry.openingFocusKey=entry.openingFocusKey||require('./foco.cjs').focusKeyOf(prefix);
        if(prefix)entry.openingRoleKey=entry.openingRoleKey||require('./identidades.cjs').roleKeyOf(prefix);
        const title = openingTitleOf(line, entry.family);
        if (title) { entry.openingRoleKey=require('./identidades.cjs').roleKeyOf(prefix);entry.openingTitle = title; entry.openingTitleChecked = true; return title; }
        const metadata = projectMetadata(line);
        if (entry.family === 'codex' ? metadata?.type === 'event_msg' && metadata.payload?.type === 'user_message' : metadata?.type === 'user' && !metadata.message?.content?.some(item => item.type === 'tool_result')) { entry.openingTitleChecked = true; break; }
      }
      entry.openingOffset = offset + count;
      entry.openingDropping = count > 0 && buffer[count - 1] !== 10;
      if (offset + count >= size && !entry.openingDropping) entry.openingTitleChecked = true;
    } catch {} finally { if (fd !== undefined) fs.closeSync(fd); }
    return null;
  }
  currentTaskRole(entry) {
    if (entry.metadataOnly) return require('./identidades.cjs').taskRoleKeyOf(entry.currentItemTitle || entry.role);
    const identify = require('./identidades.cjs').taskRoleKeyOf;
    const source = this.sourcesByFile?.get(entry.file);
    if (source && entry.taskScanSize !== source.stat.size && Date.now() <= this.taskReadUntil) {
      const file = safePath(source.root, entry.file, this.checked); let fd;
      try {
        if (!file) return null;
        fd = fs.openSync(file, 'r'); const size = fs.fstatSync(fd).size, start = Math.max(0, size - Math.min(this.tailBytes, 32768));
        const buffer = Buffer.alloc(size - start), count = fs.readSync(fd, buffer, 0, buffer.length, start);
        const text = buffer.subarray(0, count).toString('utf8'), first = start ? text.indexOf('\n') : -1;
        const lines = (start ? first < 0 ? '' : text.slice(first + 1) : text).split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
          const metadata = projectMetadata(lines[i]), at = validAt(metadata?.timestamp);
          if (!at || entry.firstAt && at < entry.firstAt || entry.taskRoleAt && at < entry.taskRoleAt) continue;
          const prefix = openingPrefixOf(lines[i], entry.family);
          if (!prefix || /^\s*(?:# AGENTS\.md instructions|<environment_context>|<INSTRUCTIONS>)/i.test(prefix)) continue;
          const roleKey = identify(prefix);
          // An operational follow-up without a recognized work does not change
          // the worker's last evidenced role; keep the same bounded tail budget.
          const focusKey=require('./foco.cjs').focusKeyOf(prefix);if(focusKey)entry.taskFocusKey=focusKey;
          if (roleKey) { entry.taskRoleKey = roleKey; entry.taskRoleAt = at; break; }
        }
        entry.taskScanSize = size;
      } catch {} finally { if (fd !== undefined) fs.closeSync(fd); }
    }
    if(!entry.taskRoleKey&&!entry.openingTitleChecked)this.openingTitle(entry);
    const initialKey=entry.openingRoleKey||identify(entry.openingTitle);
    const metadataKey = identify(entry.currentItemTitle);
    const metadataWins = metadataKey && (!entry.taskRoleAt || entry.currentItemAt && entry.currentItemAt >= entry.taskRoleAt);
    entry.taskRoleSource = metadataWins ? 'task-metadata' : entry.taskRoleKey ? 'public-task-prefix' : initialKey?'public-opening-prefix':'agent-path';
    return metadataWins ? metadataKey : entry.taskRoleKey || identify(entry.role) || initialKey;
  }
  snapshot(now = new Date(), app = null) {
    this.checked = new Map();
    this.scanNames();
    const sources = this.discover(now);
    const currentFiles = new Set(sources.map(source => source.file));
    for (const [file, entry] of this.files) if (entry.metadataOnly && !currentFiles.has(file)) this.files.delete(file);
    this.sourcesByFile = new Map(sources.map(source => [source.file, source]));
    const readUntil = Date.now() + 900;
    // Discoveries must make progress even while cached, growing conversations are
    // expensive or the machine is busy. Read unseen files first, at least one per
    // snapshot, then update the existing cache without replaying cumulative usage.
    const publicTitles=require('./identidades.cjs').titleConfigOf(this.stateRoot,{agents:sources.filter(source=>source.family==='codex').map(source=>({conversationId:'codex:'+source.file.match(/([a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})\.jsonl$/i)?.[1]}))});
    const namedPriority=source=>{if(source.family!=='codex')return 0;const id=source.file.match(/([a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})\.jsonl$/i)?.[1];return /COORDENADOR|maestro/i.test(this.names.get(id)||'')?3:publicTitles.has(id)?2:0;};
    const pending = sources.filter(source => !this.files.has(source.file)).sort((a,b)=>namedPriority(b)-namedPriority(a));
    const cached = sources.filter(source => this.files.has(source.file));
    let discoveryAttempted = false;
    for (const source of [...pending, ...cached]) {
      if (!this.files.has(source.file)) {
        if (discoveryAttempted && Date.now() > readUntil) continue;
        discoveryAttempted = true;
      }
      this.read(source);
    }
    const scanning = sources.some(source => !this.files.has(source.file));
    const configuration = projectConfig(this.stateRoot);
    const all = [...this.files.values()].filter(entry => entry.family !== 'index' && entry.id);
    const byId = new Map(all.filter(entry => entry.family === 'codex').map(entry => [entry.id, entry]));
    const rootOf = entry => { let current = entry; const seen = new Set(); while (current.parentId && byId.has(current.parentId) && !seen.has(current.parentId)) { seen.add(current.id); current = byId.get(current.parentId); } return current; };
    const privateConversation = entry => {
      let current = entry; const seen = new Set();
      while (current && !seen.has(current.id)) {
        if (current.family === 'codex' && !current.metaSeen) return true;
        if (sensitiveCwd(current.cwd) || sensitiveCwd(current.projectDir)) return true;
        seen.add(current.id);
        const parent = current.parentId || (current.family === 'claude' && current.conversationId !== current.id ? current.conversationId : null);
        const ancestor = parent ? all.find(candidate => candidate.family === entry.family && candidate.id === parent) : null;
        // Rejected, missing or unread ancestry never proves a public conversation,
        // even after discovery finishes. Apply the veto to every descendant.
        if (parent && !ancestor) return true;
        current = ancestor;
      }
      return !!current;
    };
    const agents = []; let guardian = 0, guardianExact = !scanning;
    // A conversation may still be a valid app destination after its Agente sleeps.
    // Share only checked root metadata, never child threads or private ancestors.
    const commandConversations = all.filter(entry => entry.family === 'codex' && entry.id && entry.metaSeen && !entry.parentId && !privateConversation(entry) && !/guardian review/i.test(this.names.get(entry.id)||'') && entry.model !== 'codex-auto-review').map(entry => ({id:'codex:'+entry.id,conversationId:'codex:'+entry.id,parentId:null,family:'codex',conversationName:this.names.get(entry.id)||null,conversation:this.names.get(entry.id)||'SESSION',lastAt:entry.lastAt}));
    this.titleReadUntil = Date.now() + 100;
    this.taskReadUntil = Date.now() + 60;
    const confirmed=require('./identidades.cjs').titleConfigOf(this.stateRoot,{agents:all.filter(entry=>entry.family==='codex').map(entry=>({conversationId:'codex:'+rootOf(entry).id}))});
    for (const entry of all) {
      if (!entry.lastAt || now.getTime() - Date.parse(entry.lastAt) > 60 * 60000&&!confirmed.has((entry.family==='codex'?rootOf(entry).id:entry.conversationId||entry.id))) continue;
      if (privateConversation(entry)) continue;
      const threadName = this.names.get(entry.id);
      if (/guardian review/i.test(threadName || entry.nickname || '') || entry.model === 'codex-auto-review') { guardian += [...entry.tools.values()].reduce((sum, value) => sum + value, 0) || 1; guardianExact = guardianExact && entry.toolsExact; continue; }
      const leader = entry.family === 'codex' ? rootOf(entry) : entry;
      const resolvedAncestor = candidate => { const seen = new Set(); let current = candidate; while (current.parentId) { if (seen.has(current.id)) return false; seen.add(current.id); const parent = all.find(other => other.family === current.family && other.id === current.parentId); if (!parent) return false; current = parent; } return !!current.metaSeen && !sensitiveCwd(current.cwd); };
      const rawConversation = entry.family === 'codex' ? leader.parentId && !byId.has(leader.parentId) ? leader.parentId : leader.id : entry.conversationId || entry.sessionId || entry.id;
      const conversationId = entry.family + ':' + rawConversation;
      const cwd = entry.cwd || leader.cwd;
      if (sensitiveCwd(cwd)) continue;
      const project = projectOf(cwd, configuration);
      const openingTitle = resolvedAncestor(leader) ? this.openingTitle(leader) : null;
      const taskRoleKey = resolvedAncestor(entry) ? this.currentTaskRole(entry) : null;
      const indexTitle = resolvedAncestor(leader) ? entry.family === 'codex' ? this.names.get(rawConversation) || this.names.get(leader.id) : this.names.get(rawConversation) : null;
      const appTitle = entry.family === 'claude' && resolvedAncestor(leader) ? require('./sessoes-app.cjs').lookupConversation(app, rawConversation)?.title || null : null;
      const realTitle = indexTitle && !/^(?:Codex|Claude) em /i.test(indexTitle) ? indexTitle : appTitle || openingTitle;
      const firstAt = validAt(leader.firstAt || entry.firstAt);
      const sessionTitle = firstAt ? 'Sessão ' + new Date(Date.parse(firstAt) - 3 * 3600000).toISOString().slice(11, 16) : 'Sessão sem início';
      const conversation = realTitle || sessionTitle;
      // Keep the app conversation title separately from the stage's work caption.
      // Only the checked public ancestor can supply this send-menu title.
      const conversationName = indexTitle && resolvedAncestor(leader) ? safeText(indexTitle,120) : appTitle ? safeText(appTitle,120) : null;
      const role = entry.role ? roleName(entry.role) : entry.parentId ? 'Ajudante' : 'Coordena a conversa';
      const age = Math.max(0, now.getTime() - Date.parse(entry.lastAt));
      const state = entry.lastKind === 'done' ? 'done' : age >= 10 * 60000 ? 'sleeping' : entry.lastKind || 'waiting';
      agents.push({ id: entry.family + ':' + entry.id, parentId: entry.parentId ? entry.family + ':' + entry.parentId : null, conversationId, conversationName, appTitle, conversation: safeText(conversation, 120), projectId: project.id, project: project.name, projectColor: project.color, family: entry.family, name: entry.nickname || (entry.parentId ? roleName(entry.role) : entry.family === 'codex' ? 'Codex' : 'Claude'), role, taskRoleKey, taskFocusKey:entry.taskFocusKey||entry.openingFocusKey||null, taskRoleSource: entry.taskRoleSource || null, model: entry.model || null, effort: entry.effort || null, skills: [...entry.skills].slice(0, 12), tools: [...entry.tools].map(([name, count]) => ({ name, count, label: toolLabel(name) })).sort((a, b) => b.count - a.count).slice(0, 12), toolsExact: entry.toolsExact, lastAction: entry.lastAction || 'Estado registrado', lastAt: entry.lastAt, lastActionAt: entry.lastAt, startedAt: entry.firstAt, state, tokens: entry.usage?.total ?? null, weightedTokens: weighted(entry.usage), inputTokens: entry.usage?.input ?? null, outputTokens: entry.usage?.output ?? null, cachedTokens: entry.usage?.cached ?? null, tokensExact: entry.tokensExact, tokenSource: entry.family === 'codex' ? 'total_token_usage' : entry.tokensExact ? 'message.usage' : 'message.usage (amostra)', currentItemId: entry.currentItemId || null, currentItemTitle: entry.currentItemTitle || null, source: 'metadados locais' });
    }
    agents.sort((a, b) => a.project.localeCompare(b.project) || a.conversation.localeCompare(b.conversation) || Number(!!a.parentId) - Number(!!b.parentId) || b.lastAt.localeCompare(a.lastAt));
    const sum = field => { const values = agents.map(agent => agent[field]).filter(value => value !== null); return values.length ? values.reduce((total, value) => total + value, 0) : null; };
    const weightedTokens = sum('weightedTokens');
    // Cumulative session counters have no proven midnight baseline. Keep their scope
    // explicit so neither active-agent counts nor conversation totals become "today".
    const projects = [...new Map(agents.map(agent => [agent.projectId, { id: agent.projectId, name: agent.project, color: agent.projectColor }])).values()].map(project => { const group = agents.filter(agent => agent.projectId === project.id); return { ...project, agents: group.length, active: group.filter(agent => !['sleeping','done'].includes(agent.state)).length, tokens: group.some(agent => agent.tokens !== null) ? group.reduce((total, agent) => total + (agent.tokens || 0), 0) : null, tokenScope: 'conversation-total', todayTokens: null, todayTokensExact: false, todayTokenSource: null, todayTokenReason: 'no-daily-baseline', tokensExact: !scanning && group.every(agent => agent.tokensExact && agent.tokens !== null), lastAt: group.map(agent => agent.lastAt).sort().at(-1), progress: null, percent: null }; });
    const result = { agents, projects, total: agents.length, active: agents.filter(agent => !['sleeping','done'].includes(agent.state)).length, tokens: sum('tokens'), weightedTokens, tokensExact: !scanning && agents.every(agent => agent.tokensExact && agent.tokens !== null), waterMl: weightedTokens === null ? null : Math.round(weightedTokens / 1500 * 0.3), waterEstimate: true, waterFormula: '((entrada - cache) + saida + cache × 0,1) / 1500 × 0,3 ml', glassMl: 250, weekPct: this.week.used, weekUpdated: this.week.at, guardian, guardianExact, source: 'Metadados locais, cabeca e fim; depois so crescimento', scanning, recentMinutes: 60, sleepingMinutes: 10, tokenWindow: 'Total das conversas recentes' };
    result.consumptionReadings=all.filter(entry=>entry.id&&entry.lastAt&&!privateConversation(entry)&&!/guardian review/i.test(this.names.get(entry.id)||entry.nickname||'')&&entry.model!=='codex-auto-review').map(entry=>({id:entry.family+':'+entry.id,projectId:projectOf(entry.cwd||rootOf(entry).cwd,configuration).id,tokens:entry.usage?.total??null,weightedTokens:weighted(entry.usage)}));
    result.commandConversations = commandConversations;
    require('./identidades.cjs').applyIdentities(this.stateRoot,result);
    const scheduled = require('./cronograma.cjs').attachSchedule(this.stateRoot, result, now);
    return require('./identidades.cjs').applyIdentities(this.stateRoot, scheduled);
  }
}

const readers = new Map();
function snapshotTeam(root, sessionsRoot, now = new Date(), options = {}) {
  const key = root + '\0' + sessionsRoot + '\0' + (options.claudeRoot ?? 'default');
  let reader = readers.get(key);
  if (!reader) { reader = new TeamReader(root, sessionsRoot, options); readers.set(key, reader); }
  return reader.snapshot(now, options.app || null);
}

module.exports = { projectMetadata, openingTitleOf, sensitiveCwd, safePath, usageOf, weighted, normalizeCwd, projectOf, projectConfig, TeamReader, snapshotTeam, codexHeader };
