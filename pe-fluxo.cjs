'use strict';
// FLUXO da equipe (vista Fluxo da aba Equipe): quem manda COMANDO, DUVIDA e RESPOSTA para quem, nas ultimas 2 h. SO LEITURA.
// Fontes (as conversas que a 3250 ja acompanha):
//  - Claude (~/.claude/projects/*/<conversa>.jsonl): a origem de cada mensagem recebida (o dono, outra sessao, um ajudante,
//    o aviso de ajudante que terminou), o despacho de ajudante, a mensagem a ajudante, a pergunta ao dono e a resposta ao fim
//    do turno que o dono abriu.
//  - Painel (estado/recados-do-painel.md e estado/respostas-do-painel.md): o dono fala com as COORDENADOR pelo painel e elas respondem.
// Nenhum texto sai daqui: so hora, tipo, de quem, para quem e ate 2 assuntos de uma lista fechada de palavras.
// Mensagem cuja ponta nao deu para ler nao vira fio (entra so na conta "nao lidas").
// diz de que lado e (claude ou codex) e cada mensagem leva a fonte (despacho, entrega, pergunta...) para a tela dizer o que
// aconteceu em palavras simples, sem texto da conversa.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { projectJSON } = require('./project-json.cjs');
// Never materialize Codex conversation bodies or tool arguments.
const CODEX_FIELDS = ['type', 'timestamp', 'payload.type', 'payload.name', 'payload.role', 'payload.author', 'payload.recipient', 'payload.id', 'payload.agent_path', 'payload.source.subagent.agent_path', 'payload.source.subagent.thread_spawn.agent_path'];
const CANONICAL_AGENT_PATH = /^\/root(?:\/[a-z][a-z0-9_]*)*$/;
const codexToolName = name => typeof name === 'string' ? name.replace(/^collaboration\./, '') : '';

const WINDOW_MS = 2 * 3600 * 1000, RECENT_MS = 15 * 60 * 1000;
const TAIL_CLAUDE = 10 * 1024 * 1024, TAIL_CODEX = 8 * 1024 * 1024, HEAD = 400 * 1024;
const ESTADO = process.env.PE_ESTADO || (process.env.PAINEL_ROOT || require('node:path').join(__dirname, 'demo', 'estado'));
const CLAUDE_DIR = process.env.PE_CLAUDE_PROJECTS || path.join((process.env.PAINEL_HOME || os.homedir()), '.claude', 'projects');
const CODEX_DIR = process.env.PE_CODEX_SESSIONS || path.join((process.env.PAINEL_HOME || os.homedir()), '.codex', 'sessions');
const BOXES = ['voce', 'coordenador-claude', 'coordenador-codex', 'atendimento', 'loja', 'cortes', 'assistente', 'codex'];
const STAGE = { voce: 'voce', 'coordenador-claude': 'coord', 'coordenador-codex': 'coord', atendimento: 'sessoes', loja: 'sessoes', cortes: 'sessoes', assistente: 'sessoes', codex: 'sessoes' };
const HELPER_ID = /^a[0-9a-f]{16}$/;
const UUID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i;

const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const hashOf = text => crypto.createHash('sha256').update(fold(text).replace(/\s+/g, ' ').trim().slice(0, 400)).digest('hex').slice(0, 20);
// Assunto: so palavras de uma lista fechada; qualquer sinal de assunto reservado esconde tudo.
const RESERVED = /sigilos|reservad|segred|carteira|wallet|\bchave\b|senha|\bseed\b|privad|0x[0-9a-f]{6}|\benv\b/; // "segred" e "carteira" ja cobrem as pastas reservadas
const TOPICS = [
  ['painel', /\bpainel\b|\bdashboard\b/], ['equipe', /\bequipe\b/], ['fotos', /\bfotos?\b|\bprints?\b|screenshot/], ['tela', /\btelas?\b|\bvisual\b/],
  ['testes', /\btestes?\b|vitest|\bgate\b/], ['revisao', /\brevis|veredito|\bconfer/], ['subida', /\bsub(?:ir|iu|ida|a)\b|\bdeploy\b|hospedagem|\bno ar\b/],
  ['card', /\bcards?\b/], ['status', /\bstatus\b|\bwen\b|em que pe/], ['fila', /\bfila\b/], ['credito', /credito|\breset\b/],
  ['terminal', /\bterminal\b|\bterminal\b/], ['atendimento', /\batendimento\b|\bhome\b/], ['loja', /loja|\bloot\b|\bmesa\b/],
  ['cortes', /\bpost\b|\bvideo\b|\barte\b|cortes/], ['lancamento', /lancamento|\bdrop\b|\bmint\b/], ['codex', /\bcodex\b/]
];
function topicsOf(text, reserved) {
  const value = fold(text);
  if (reserved || RESERVED.test(value)) return ['reservado'];
  const found = [];
  for (const [key, pattern] of TOPICS) { if (pattern.test(value)) found.push(key); if (found.length === 2) break; }
  return found;
}
const QUESTION = /\?\s*(?:["')\]]\s*)?$|^\s*(?:wen\b|status\b|qual\b|quais\b|como\b|quando\b|onde\b|cade\b|por que\b|porque\b|o que\b|quem\b|quanto\b|tem como\b|da pra\b|consegue\b)/;
const ANSWER = /\b(?:entreg|pronto|feito|fiz\b|conclu|subiu|veredito|pode subir|confere\b|segura\b|resultado|relatorio|terminei|aprovad|recebid|respondi|ficou\b)/;
function kindOf(text, fallback) {
  const value = fold(text).trim(), head = value.slice(0, 600), last = value.slice(-300);
  if (QUESTION.test(last) || QUESTION.test(head.split(/\n/)[0] || '')) return 'duvida';
  if (ANSWER.test(head)) return 'resposta';
  return fallback;
}
const textOf = content => typeof content === 'string' ? content : Array.isArray(content) ? content.map(part => part && part.type === 'text' ? part.text || '' : '').join(' ') : '';

// Nome da sessao -> caixa. As duas Claude (e a receptora) sao a mesma caixa.
function boxOfName(name) {
  const value = fold(name);
  if (/coordenador|coordenacao/.test(value)) return 'coordenador-claude';
  if (/^atendimento\b/.test(value)) return 'atendimento';
  if (/^loja\b/.test(value)) return 'loja';
  if (/^cortes\b/.test(value)) return 'cortes';
  if (/^assistente\b/.test(value)) return 'assistente';
  return null;
}
function registryOf(estado) {
  const map = new Map();
  try {
    const data = JSON.parse(fs.readFileSync(path.join(estado, 'estado', 'sessoes-claude.json'), 'utf8').replace(/^\uFEFF/, ''));
    for (const item of Array.isArray(data && data.sessoes) ? data.sessoes : []) if (item && /^local_[0-9a-f-]{36}$/.test(item.sessionId || '')) map.set(item.sessionId, { name: String(item.titulo || ''), box: boxOfName(item.titulo), lastAt: Date.parse(item.ultima) || null });
    return { ok: true, map };
  } catch { return { ok: false, map }; }
}

// Leitura do fim do arquivo (so as linhas inteiras), com cache por tamanho e hora do arquivo.
const fileCache = new Map();
function tailRecords(file, maxBytes, fields = null) {
  let stat; try { stat = fs.statSync(file); } catch { return null; }
  const key = file + '|' + maxBytes + (fields ? '|metadata' : ''), hit = fileCache.get(key);
  if (hit && hit.size === stat.size && hit.mtime === stat.mtimeMs) return hit.records;
  const length = Math.min(maxBytes, stat.size), buffer = Buffer.alloc(length);
  let fd; try { fd = fs.openSync(file, 'r'); fs.readSync(fd, buffer, 0, length, stat.size - length); } catch { return null; } finally { if (fd !== undefined) fs.closeSync(fd); }
  const lines = buffer.toString('utf8').split('\n');
  if (length < stat.size) lines.shift();
  const records = [];
  for (const line of lines) { if (!line.trim()) continue; try { records.push(fields ? projectJSON(line, fields) : JSON.parse(line)); } catch { /* linha cortada */ } }
  fileCache.set(key, { size: stat.size, mtime: stat.mtimeMs, records });
  if (fileCache.size > 80) fileCache.delete(fileCache.keys().next().value);
  return records;
}
function openingName(file) {
  let text = '';
  try { const fd = fs.openSync(file, 'r'), buffer = Buffer.alloc(HEAD), n = fs.readSync(fd, buffer, 0, HEAD, 0); fs.closeSync(fd); text = buffer.subarray(0, n).toString('utf8'); } catch { return null; }
  for (const line of text.split('\n')) {
    let record; try { record = JSON.parse(line); } catch { continue; }
    if (record.type !== 'user' || !record.message) continue;
    const value = fold(textOf(record.message.content)).trim();
    if (!value) continue;
    const match = /(?:voce\s+e\s+(?:a|o)\s+|sessao\s+)(coordenador|coordenacao|atendimento|loja|cortes|assistente)\b/.exec(value.slice(0, 600));
    return match ? match[1] : '';
  }
  return '';
}

// ---------- Claude ----------
function claudeTranscripts(dir, since) {
  const list = [];
  let projects; try { projects = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  for (const project of projects) {
    if (!project.isDirectory()) continue;
    let files; try { files = fs.readdirSync(path.join(dir, project.name)); } catch { continue; }
    for (const name of files) {
      if (!UUID.test(name)) continue;
      const file = path.join(dir, project.name, name);
      try { if (fs.statSync(file).mtimeMs >= since) list.push({ file, uuid: UUID.exec(name)[1].toLowerCase() }); } catch { /* sumiu */ }
    }
  }
  return list;
}
function scanClaude({ dir, registry, since, now }) {
  const transcripts = claudeTranscripts(dir, since);
  if (!transcripts) return { ok: false, events: [], boxes: new Map(), unread: 0, lastAt: new Map() };
  // 1a passada: quem e cada conversa (pela abertura) e as mensagens de cada uma.
  const parsed = [];
  const received = new Map(); // hash do texto recebido de outra sessao -> id da sessao que mandou
  for (const item of transcripts) {
    const records = tailRecords(item.file, TAIL_CLAUDE);
    if (!records) continue;
    const opening = openingName(item.file);
    const recent = records.filter(record => Date.parse(record.timestamp) >= since);
    for (const record of recent) {
      const origin = record.origin;
      if (record.type === 'user' && origin && origin.kind === 'peer' && /^local_/.test(origin.from || '')) received.set(hashOf(textOf(record.message && record.message.content)), origin.from);
    }
    let last = null;
    for (let i = records.length - 1; i >= 0 && last === null; i--) { const at = Date.parse(records[i].timestamp); if (Number.isFinite(at)) last = at; }
    parsed.push({ ...item, opening, records: recent, last });
  }
  // 2a passada: conversa sem nome na abertura ganha o nome pelo que ela mandou e outra sessao recebeu.
  const localOf = new Map();
  for (const item of parsed) {
    if (item.opening) continue;
    for (const record of item.records) {
      if (record.type !== 'assistant') continue;
      for (const part of Array.isArray(record.message && record.message.content) ? record.message.content : []) {
        if (part && part.type === 'tool_use' && /send_message$/.test(part.name || '') && part.input) { const from = received.get(hashOf(part.input.message)); if (from) localOf.set(item.uuid, from); }
      }
      if (localOf.has(item.uuid)) break;
    }
  }
  const events = [], boxes = new Map(), lastAt = new Map();
  let unread = 0;
  // ponta que nao deu para ler = "nao lida" (nunca vira fio); conversa entre as 2 conversas da mesma caixa nao vira fio
  const push = (from, to, at, kind, topics, source) => { if (!from || !to) { unread++; return; } if (from === to) return; events.push({ from, to, at, kind, topics, source }); };
  const helpersOf = box => 'ajudantes:' + box;
  for (const item of parsed) {
    let box = item.opening ? boxOfName(item.opening) : null;
    if (!box && localOf.has(item.uuid)) { const known = registry.map.get(localOf.get(item.uuid)); box = known ? known.box : null; }
    if (!box && item.records.some(record => record.type === 'assistant' && (record.message && Array.isArray(record.message.content) ? record.message.content : []).some(part => part && part.type === 'tool_use' && /send_message$/.test(part.name || '')))) box = 'coordenador-claude';
    if (!box) continue; // conversa que nao e da casa (ou nao deu para saber de quem e): fica de fora
    boxes.set(item.uuid, box);
    const reserved = box === 'assistente';
    if (item.last !== null) lastAt.set(box, Math.max(lastAt.get(box) || 0, item.last));
    const toolNames = new Map();
    let turn = null; // origem do turno aberto: 'human' para responder ao dono no fim
    for (const record of item.records) {
      const at = Date.parse(record.timestamp), content = record.message && record.message.content, parts = Array.isArray(content) ? content : [];
      if (record.type === 'assistant') {
        for (const part of parts) {
          if (!part || part.type !== 'tool_use') continue;
          toolNames.set(part.id, part.name);
          const input = part.input || {};
          if (part.name === 'Agent' || part.name === 'Task') push(box, helpersOf(box), at, 'comando', topicsOf([input.description, input.prompt].join(' '), reserved), 'claude:despacho');
          else if (part.name === 'SendMessage' && HELPER_ID.test(String(input.to || ''))) push(box, helpersOf(box), at, 'comando', topicsOf(input.message || input.content, reserved), 'claude:ajudante');
          else if (part.name === 'AskUserQuestion') push(box, 'voce', at, 'duvida', topicsOf(JSON.stringify(input.questions || input), reserved), 'claude:pergunta');
        }
        // fim do turno aberto pelo dono ou pelo aviso de ajudante que terminou = resposta no chat do dono
        if ((turn === 'human' || turn === 'task') && record.message && (record.message.stop_reason === 'end_turn' || record.stopReason === 'end_turn') && parts.some(part => part && part.type === 'text' && String(part.text || '').trim())) {
          push(box, 'voce', at, 'resposta', topicsOf(textOf(content), reserved), 'claude:resposta'); turn = null;
        }
        continue;
      }
      if (record.type !== 'user' || parts.some(part => part && part.type === 'tool_result')) continue;
      // a mensagem de outra sessao chega marcada como meta; a do dono nao
      const origin = record.origin || {}, text = textOf(content);
      if (origin.kind === 'human') { if (record.isMeta === true || !text.trim()) continue; turn = 'human'; push('voce', box, at, kindOf(text, 'comando'), topicsOf(text, reserved), 'claude:dono'); }
      else if (origin.kind === 'peer') {
        turn = 'peer';
        const from = String(origin.from || '');
        if (HELPER_ID.test(from)) push(helpersOf(box), box, at, kindOf(text, 'resposta'), topicsOf(text, reserved), 'claude:ajudante');
        else { const known = registry.map.get(from), sender = known ? known.box : null; push(sender, box, at, kindOf(text, sender === 'coordenador-claude' ? 'comando' : 'resposta'), topicsOf(text, reserved || sender === 'assistente'), 'claude:sessao'); }
      } else if (origin.kind === 'task-notification') {
        turn = 'task';
        const id = /<tool-use-id>([^<]{1,80})<\/tool-use-id>/.exec(text);
        const tool = id ? toolNames.get(id[1]) : null;
        if (tool === 'Agent' || tool === 'Task') push(helpersOf(box), box, at, 'resposta', topicsOf('', reserved), 'claude:entrega');
      }
    }
  }
  return { ok: true, events, boxes, unread, lastAt };
}

// ---------- Codex ----------
function walk(dir, since, out = [], depth = 0) {
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return depth === 0 ? null : out; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && depth < 4) walk(full, since, out, depth + 1);
    else if (entry.isFile() && /^rollout-.*\.jsonl$/.test(entry.name)) { try { if (fs.statSync(full).mtimeMs >= since) out.push(full); } catch { /* sumiu */ } }
  }
  return out;
}
function scanCodex({ dir, since, threads, projected = null }) {
  const projectedById = projected ? new Map(projected.filter(row=>row.family=== 'codex').map(row=>[row.id,row.records])) : null;
  const files = projectedById ? [...projectedById.keys()].map(id=>id+'.jsonl') : walk(dir, since);
  if (!files) return { ok: false, events: [], unread: 0, lastAt: new Map() };
  const events = [], lastAt = new Map();
  let unread = 0;
  const rootOf = id => {
    const seen = new Set(); let current = id;
    while (current && !seen.has(current)) { seen.add(current); const item = threads.get(current); if (!item) return null; if (!item.parent) return item.box ? current : null; current = item.parent; }
    return null;
  };
  // Canonical names repeat in unrelated chats. Bind only inside proven ancestry.
  const aliases = new Map();
  const confirmedOpenings = new Set();
  const bind = (scope, alias, id) => {
    if (!scope || typeof alias !== 'string' || !CANONICAL_AGENT_PATH.test(alias)) return;
    const map = aliases.get(scope) || new Map();
    if (!map.has(alias)) map.set(alias, id); else if (map.get(alias) !== id) map.set(alias, null);
    aliases.set(scope, map);
  };
  for (const id of threads.keys()) { const root = rootOf(id); if (root) bind(root, '/root', root); }
  for (const file of files) {
    const id = ((UUID.exec(file) || [])[1] || '').toLowerCase(), scope = rootOf(id);
    if (!scope) continue;
    if(projectedById){const meta=(projectedById.get(id)||[]).find(row=>row.type==='session_meta');if(meta&&String(meta['payload.id']||'').toLowerCase()===id){confirmedOpenings.add(id);bind(scope,meta['payload.agent_path']||meta['payload.source.subagent.agent_path']||meta['payload.source.subagent.thread_spawn.agent_path'],id);}continue;}
    let fd;
    try {
      fd = fs.openSync(file, 'r'); const buffer = Buffer.alloc(HEAD), n = fs.readSync(fd, buffer, 0, HEAD, 0);
      for (const line of buffer.subarray(0, n).toString('utf8').split('\n')) {
        let meta; try { meta = projectJSON(line, CODEX_FIELDS); } catch { continue; }
        if (meta.type !== 'session_meta') continue;
        if (String(meta['payload.id'] || '').toLowerCase() === id) { confirmedOpenings.add(id); bind(scope, meta['payload.agent_path'] || meta['payload.source.subagent.agent_path'] || meta['payload.source.subagent.thread_spawn.agent_path'], id); }
        break; // copied ancestry cannot rename the opening agent
      }
    } catch { /* unread opening never invents an alias */ } finally { if (fd !== undefined) fs.closeSync(fd); }
  }
  const endpoint = (value, scope) => {
    let id = value;
    if (typeof value === 'string' && CANONICAL_AGENT_PATH.test(value)) id = aliases.get(scope)?.get(value);
    if (typeof id !== 'string') return null;
    const info = threads.get(id.toLowerCase());
    if (!info) return null;
    if (info.box) return info.box;
    const seen = new Set([id.toLowerCase()]); let parent = info.parent;
    while (parent && !seen.has(parent)) { seen.add(parent); const next = threads.get(parent); if (!next) return null; if (next.box) return 'ajudantes:' + next.box; parent = next.parent; }
    return null;
  };
  for (const file of files) {
    const thread = (UUID.exec(file) || [])[1];
    if (!thread) continue;
    const info = threads.get(thread.toLowerCase());
    if (!info) {
      // A missing root explicitly referenced by snapshot children is a known
      // unresolved source. Count its metadata messages without fabricating a box.
      if ([...threads.values()].some(item => item.parent === thread.toLowerCase())) for (const record of (projectedById ? projectedById.get(((UUID.exec(file)||[])[1]||'').toLowerCase()) : tailRecords(file, TAIL_CODEX, CODEX_FIELDS)) || []) if (record.type === 'response_item' && record['payload.type'] === 'agent_message' && Date.parse(record.timestamp) >= since) unread++;
      continue;
    }
    const scope = rootOf(thread.toLowerCase());
    const box = endpoint(thread, scope), helpers = box && !info.parent ? 'ajudantes:' + box : null;
    if (!box) { for (const record of (projectedById ? projectedById.get(((UUID.exec(file)||[])[1]||'').toLowerCase()) : tailRecords(file, TAIL_CODEX, CODEX_FIELDS)) || []) if (record.type === 'response_item' && record['payload.type'] === 'agent_message' && Date.parse(record.timestamp) >= since) unread++; continue; }
    const records = (projectedById ? projectedById.get(((UUID.exec(file)||[])[1]||'').toLowerCase()) : tailRecords(file, TAIL_CODEX, CODEX_FIELDS));
    if (!records) continue;
    let voiceAt = 0;
    for (const record of records) {
      const at = Date.parse(record.timestamp);
      if (!(at >= since)) continue;
      lastAt.set(box, Math.max(lastAt.get(box) || 0, at));
      const payload = { type: record['payload.type'], name: record['payload.name'], role: record['payload.role'], author: record['payload.author'], recipient: record['payload.recipient'] };
      if (record.type === 'inter_agent_communication_metadata') continue;
      if (record.type === 'response_item' && payload.type === 'function_call') {
        const name = codexToolName(payload.name);
        if (name === 'spawn_agent' && helpers) events.push({ from: box, to: helpers, at, kind: 'comando', topics: [], source: 'codex:spawn_agent' });
        else if (['request_user_input', 'request_user_input_async'].includes(name)) events.push({ from: box, to: 'voce', at, kind: 'duvida', topics: [], source: 'codex:pergunta' });
        else if (['send_message', 'followup_task'].includes(name)) unread++;
      } else if (record.type === 'response_item' && payload.type === 'agent_message') {
        // Explicit endpoints only. Activity or a preceding marker is not an origin.
        const from = endpoint(payload.author, scope), to = endpoint(payload.recipient, scope);
        if (from && to && from !== to && to === box) events.push({ from, to, at, kind: info.parent ? 'comando' : 'resposta', topics: [], source: 'codex:ajudante' });
        // A direct child replying to /root inside the confirmed root's own file
        // proves a group response, even when the runtime has no individual UUID alias.
        else if (!info.parent && scope === thread.toLowerCase() && confirmedOpenings.has(scope) && !aliases.get(scope)?.has(payload.author) && payload.recipient === '/root' && /^\/root\/[a-z][a-z0-9_]*$/.test(String(payload.author || '')) && !PRIVATE_NAME.test(payload.author) && [...threads.keys()].some(id => id !== scope && rootOf(id) === scope)) events.push({ from: helpers, to: box, at, kind: 'resposta', topics: [], source: 'codex:ajudante' });
        else if (!from || !to) unread++;
      } else if (record.type === 'response_item' && payload.type === 'message' && payload.role === 'user' && box === 'coordenador-codex') {
        // Bodies are not projected. A message without proven origin stays unlinked.
      } else if (record.type === 'realtime_item' && payload.type === 'transcript_segment' && payload.role === 'user') {
        // a voz do dono chega em pedacos: pedacos a menos de 90 s viram 1 mensagem
        if (at - voiceAt > 90000) events.push({ from: 'voce', to: box, at, kind: 'comando', topics: [], source: 'codex:voz' });
        voiceAt = at;
      }
    }
  }
  return { ok: true, events, unread, lastAt };
}

// ---------- Painel (o dono fala com as COORDENADOR pelos botoes do painel) ----------
function brt(day, month, hour, minute, now) {
  const year = new Date(now).getUTCFullYear();
  let at = Date.UTC(year, month - 1, day, hour + 3, minute);
  if (at - now > 86400000) at = Date.UTC(year - 1, month - 1, day, hour + 3, minute);
  return at;
}
function scanPanel({ estado, since, now }) {
  const events = [];
  let ok = true;
  const read = name => { try { return fs.readFileSync(path.join(estado, 'estado', name), 'utf8').replace(/^\uFEFF/, ''); } catch (error) { if (!error || error.code !== 'ENOENT') ok = false; return ''; } }; // arquivo que ainda nao existe = nada aconteceu
  for (const line of read('recados-do-painel.md').split(/\r?\n/)) {
    const m = /^- (\d{2})\/(\d{2}) (\d{2}):(\d{2}) \| ([^|]+?) \| (.*?) \| painel-[\w-]+/.exec(line);
    if (!m) continue;
    const at = brt(+m[1], +m[2], +m[3], +m[4], now);
    if (at < since || at > now + 60000) continue;
    const dest = fold(m[5]), targets = /os dois/.test(dest) ? ['coordenador-claude', 'coordenador-codex'] : /codex/.test(dest) ? ['coordenador-codex'] : /coordenador|coordenacao/.test(dest) ? ['coordenador-claude'] : [];
    for (const to of targets) events.push({ from: 'voce', to, at, kind: kindOf(m[6], 'comando'), topics: topicsOf(m[6]), source: 'painel:recado' });
  }
  for (const line of read('respostas-do-painel.md').split(/\r?\n/)) {
    const m = /^- (\d{2})\/(\d{2}) (\d{2}):(\d{2}) \| (COORDENADOR CLAUDE|COORDENADOR CODEX) \| painel-[\w-]+ \| (.*)$/.exec(line);
    if (!m) continue;
    const at = brt(+m[1], +m[2], +m[3], +m[4], now);
    if (at < since || at > now + 60000) continue;
    events.push({ from: /CODEX/.test(m[5]) ? 'coordenador-codex' : 'coordenador-claude', to: 'voce', at, kind: 'resposta', topics: topicsOf(m[6]), source: 'painel:resposta' });
  }
  return { ok, events };
}

// ---------- juntar ----------
// Caixa de cada conversa do Codex: o COORDENADOR ("COORDENADOR · conversa" ou outra COORDENADOR) e as outras, uma caixa por conversa.
const PRIVATE_NAME = /sigilos|segred|carteira|wallet|\bseed\b|\.env\b|\bchave\b|senha|password|0x[0-9a-f]{6}/i;
function boxOfThread(id, name) { return /^coordenador\b/i.test(String(name || '')) ? 'coordenador-codex' : 'codex:' + String(id).slice(0, 8); }
function nameOfThread(name) {
  const text = String(name || '').replace(/[\u0000-\u001f\u2013\u2014|]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text || PRIVATE_NAME.test(text)) return null;
  const clean = text.replace(/^coordenador\s*·\s*/i, '').replace(/\s*\(\d+\)\s*$/, '').trim().slice(0, 60);
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : null;
}
function threadsOf(snapshot) {
  const threads = new Map();
  const blocked = new Set();
  for (const item of Array.isArray(snapshot && snapshot.commandSessions) ? snapshot.commandSessions : []) if (item && item.family === 'codex' && item.threadId && PRIVATE_NAME.test(String(item.name || ''))) blocked.add(String(item.threadId).toLowerCase());
  for (const agent of snapshot && snapshot.equipe && Array.isArray(snapshot.equipe.agents) ? snapshot.equipe.agents : []) if (agent && agent.family === 'codex' && typeof agent.id === 'string' && PRIVATE_NAME.test(String(agent.conversationName || agent.conversation || ''))) blocked.add(agent.id.replace(/^codex:/, '').toLowerCase());
  for (const item of Array.isArray(snapshot && snapshot.commandSessions) ? snapshot.commandSessions : []) {
    if (item && item.family === 'codex' && item.threadId && !blocked.has(String(item.threadId).toLowerCase())) { const id = String(item.threadId).toLowerCase(); threads.set(id, { box: boxOfThread(id, item.name), name: nameOfThread(item.name), parent: null, lastAt: Date.parse(item.lastAt) || null }); }
  }
  for (const agent of snapshot && snapshot.equipe && Array.isArray(snapshot.equipe.agents) ? snapshot.equipe.agents : []) {
    if (!agent || agent.family !== 'codex' || typeof agent.id !== 'string') continue;
    if (PRIVATE_NAME.test(String(agent.conversationName || agent.conversation || ''))) continue;
    const id = agent.id.replace(/^codex:/, '').toLowerCase();
    if (blocked.has(id)) continue;
    if (agent.parentId) threads.set(id, { box: null, parent: String(agent.parentId).replace(/^codex:/, '').toLowerCase() });
    else if (!threads.has(id)) threads.set(id, { box: boxOfThread(id, agent.conversationName || agent.conversation), name: nameOfThread(agent.conversationName || agent.conversation), parent: null, lastAt: Date.parse(agent.lastAt) || null });
  }
  return threads;
}
function sideOf(id) { const key = String(id || ''); if (key === 'voce') return null; return ['coordenador-claude', 'atendimento', 'loja', 'cortes', 'assistente'].includes(key) ? 'claude' : key === 'coordenador-codex' || key === 'codex' || key.startsWith('codex:') ? 'codex' : null; }
function stateOf(lastAt, now) {
  if (!Number.isFinite(lastAt)) return 'unknown';
  const idle = now - lastAt;
  return idle < 2 * 60000 ? 'working' : idle < 10 * 60000 ? 'waiting' : 'sleeping';
}
function metadataNativeId(value) {
  if(typeof value!=='string')return null;
  const m=/^(codex|claude):([a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})(?::([a-zA-Z0-9_-]{1,80}))?$/i.exec(value);
  if(!m)return null;const family=m[1].toLowerCase();
  if(family==='codex'&&(m[3]||! /^[a-f\d]{8}-[a-f\d]{4}-7[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(m[2])))return null;
  return family+':'+m[2].toLowerCase()+(m[3]?':'+m[3]:'');
}
function metadataName(value) {
  if(typeof value!=='string'||PRIVATE_NAME.test(value)||/[/\\]|\bhttps?:|[\u0000-\u001f]/i.test(value))return null;
  return value.replace(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g,'[privado]').replace(/[\u2013\u2014]/g,' ').trim().slice(0,80)||null;
}
function metadataTime(value,now) {
  const n=typeof value==='string'?Date.parse(value):NaN;return Number.isFinite(n)&&n<=now?n:null;
}
function metadataWorkProof(agent,now) {
  const p=agent.workProof||{},source=p.source===agent.family+'.lifecycle'?p.source:null;
  const observed=metadataTime(p.observedAt,now),started=metadataTime(p.startedAt,now),closed=metadataTime(p.closedAt,now);
  let state=['working','waiting','done','unknown'].includes(p.state)?p.state:'unknown';
  if(!source||observed===null||now-observed>30000||started!==null&&started>observed||closed!==null&&(closed>observed||started!==null&&closed<started))state='unknown';
  if(['working','waiting','done'].includes(state)&&started===null||p.startedAt!=null&&started===null||p.closedAt!=null&&closed===null)state='unknown';
  if(state==='working'&&p.closedAt!=null)state='unknown';
  if(state==='done'&&(started===null||closed===null))state='unknown';
  return {state,source,startedAt:started===null?null:new Date(started).toISOString(),closedAt:closed===null?null:new Date(closed).toISOString(),observedAt:observed===null?null:new Date(observed).toISOString()};
}
function metadataPresentation(value,rootId) {
  if(!value||value.proofSource!=='approved-id'||metadataNativeId(value.rootId)!==rootId||typeof value.frontId!=='string'||!/^[a-z][a-z0-9-]{0,79}$/.test(value.frontId))return null;
  const label=metadataName(value.label);return label?{rootId,frontId:value.frontId,label,proofSource:'approved-id'}:null;
}
function buildMetadataFlow({snapshot,now,policyId,estado=ESTADO}) {
  const proof=snapshot?.proof,observed=metadataTime(proof?.observedAt,now);
  if(typeof policyId!=='string'||!/^[a-zA-Z0-9_.-]{1,80}$/.test(policyId)||proof?.mode!=='scalar-metadata'||proof.policyId!==policyId||observed===null||!Array.isArray(snapshot?.equipe?.agents)||!Array.isArray(snapshot.metadataRecords))throw Error('Metadata flow unavailable');
  // A retained reading keeps its original observation time. It never becomes a
  // fresh work proof merely because this route was requested again (fila291).
  if(now-observed>300000)return {ok:false,readAt:proof.observedAt,metadataProof:{mode:proof.mode,policyId:proof.policyId,revision:proof.revision,observedAt:proof.observedAt,complete:false},readerStatus:'stale',windowMinutes:WINDOW_MS/60000,nodes:[],edges:[],controlProof:{available:false,source:null}};
  const supplied=snapshot.equipe.agents,byId=new Map(),duplicates=new Set();let rejected=0;
  for(const agent of supplied) {
    const id=metadataNativeId(agent?.id);
    if(!id||!['codex','claude'].includes(agent.family)||!id.startsWith(agent.family+':')){rejected++;continue;}
    if(byId.has(id)){duplicates.add(id);rejected++;continue;}
    byId.set(id,{...agent,id,parentId:agent.parentId==null?null:metadataNativeId(agent.parentId)});
    if(agent.parentId!=null&&!metadataNativeId(agent.parentId)){duplicates.add(id);rejected++;}
  }
  for(const id of duplicates)byId.delete(id);
  const rootOf=agent=>{
    const seen=new Set();let current=agent;
    while(current) {
      if(seen.has(current.id)||seen.size>16)return null;seen.add(current.id);
      if(!current.parentId)return current.id.split(':').length===2?current:null;
      const parent=byId.get(current.parentId);if(!parent||parent.family!==agent.family)return null;current=parent;
    }return null;
  };
  const actors=[];
  for(const agent of byId.values()) {
    const root=rootOf(agent);
    if(!root||metadataNativeId(agent.conversationId)!==root.id){rejected++;continue;}
    actors.push({...agent,rootId:root.id});
  }
  const actorKeys=new Set(actors.map(a=>a.id));
  const good=actors.filter(agent=>{
    const seen=new Set();let current=agent;
    while(current) {
      if(!actorKeys.has(current.id)||seen.has(current.id))return false;
      seen.add(current.id);
      if(!current.parentId)return current.id===agent.rootId;
      current=byId.get(current.parentId);
    }return false;
  });
  const goodKeys=new Set(good.map(a=>a.id));
  if(good.length!==actors.length)rejected+=actors.length-good.length;
  const complete=proof.complete===true&&snapshot.readerStatus==='ready'&&rejected===0;
  const readerStatus=complete?'ready':'partial';
  const metadataProof={mode:proof.mode,policyId:proof.policyId,revision:Number.isInteger(proof.revision)?proof.revision:null,observedAt:proof.observedAt,complete};
  const coverage=proof.coverage;
  if(coverage?.finished===true&&['read','unread','unknown','durationMs'].every(key=>Number.isInteger(coverage[key])&&coverage[key]>=0)&&coverage.unknown<=coverage.read&&coverage.read>=good.length)metadataProof.coverage={read:good.length,unread:coverage.unread+rejected,unknown:coverage.unknown,finished:true,durationMs:coverage.durationMs,motivos:(Array.isArray(coverage.motivos)?coverage.motivos:[]).slice(0,40).map(m=>({familia:m.familia==='claude'?'claude':'codex',motivo:String(m.motivo||'?').slice(0,120)})).concat(rejected?[{familia:'?',motivo:rejected+' conversa(s) recusada(s) na montagem: id repetido, sem mae lida ou cadeia quebrada'}]:[])};
  const roots=good.filter(a=>!a.parentId),threads=new Map(),work=new Map(),presentation=new Map();
  for(const agent of good) {
    work.set(agent.id,metadataWorkProof(agent,observed));
    const root=byId.get(agent.rootId);
    presentation.set(agent.id,metadataPresentation(agent.presentation,root.id));
    if(agent.family==='codex')threads.set(agent.id.slice(6),agent.parentId?{box:null,parent:agent.parentId.slice(6)}:{box:agent.id,name:metadataName(agent.conversationName||agent.conversation||agent.name),parent:null,lastAt:metadataTime(agent.lastAt,now)});
  }
  const projected=snapshot.metadataRecords.filter(p=>p?.family==='codex'&&goodKeys.has('codex:'+String(p.id||'').toLowerCase())&&Array.isArray(p.records));
  const since=now-WINDOW_MS,codex=scanCodex({dir:null,since,threads,projected});
  const events=codex.events.filter(e=>e.at>=since&&e.at<=now);
  const controlProof={available:false,source:null};
  const owner={id:'voce',rootId:null,parentId:null,stage:STAGE.voce||'dono',side:null,family:null,name:null,lastAt:null,eventLastAt:null,state:null,needsYou:null,waiting:null,workProof:null,presentation:null};
  try{const e=require('./painel-numeros.cjs').esperaCacheada(estado,now);if(e&&e.total!==null){owner.waiting=e.total;owner.waitingTexto=e.rotulo;}}catch{}
  const nodes=[owner];
  for(const root of roots) {
    const lastAt=metadataTime(root.lastAt,now),eventLastAt=metadataTime(root.eventLastAt,now),p=presentation.get(root.id),w=work.get(root.id);
    nodes.push({id:root.id,rootId:root.id,parentId:null,family:root.family,stage:'sessoes',side:root.family,name:p?.label||metadataName(root.conversationName||root.conversation||root.name)||root.family,lastAt,eventLastAt:eventLastAt===null?null:new Date(eventLastAt).toISOString(),state:w.state,needsYou:null,workProof:w,presentation:p,observedAt:w.observedAt});
  }
  const groups=new Map();
  for(const agent of good.filter(a=>a.parentId)) {
    const members=groups.get(agent.rootId)||[],w=work.get(agent.id);
    members.push({id:agent.id,parentId:agent.parentId,rootId:agent.rootId,family:agent.family,workProof:w,presentation:presentation.get(agent.id),lastAt:metadataTime(agent.lastAt,now),eventLastAt:metadataTime(agent.eventLastAt,now)===null?null:new Date(metadataTime(agent.eventLastAt,now)).toISOString()});groups.set(agent.rootId,members);
  }
  for(const event of events)for(const end of [event.from,event.to])if(end.startsWith('ajudantes:')){const rootId=end.slice(10);if(roots.some(r=>r.id===rootId)&&!groups.has(rootId))groups.set(rootId,[]);}
  for(const [rootId,members]of groups) {
    const allKnown=complete&&members.length>0&&members.every(m=>m.workProof.state!=='unknown');
    const count=allKnown?members.filter(m=>m.workProof.state==='working').length:null;
    const times=members.map(m=>m.lastAt).filter(Number.isFinite),lastAt=times.length?Math.max(...times):null;
    const state=!allKnown?'unknown':count>0?'working':members.some(m=>m.workProof.state==='waiting')?'waiting':members.every(m=>m.workProof.state==='done')?'done':'unknown';
    const root=byId.get(rootId);
    nodes.push({id:'ajudantes:'+rootId,rootId,of:rootId,parentId:rootId,family:root.family,stage:'ajudantes',side:root.family,name:null,total:complete&&members.length>0?members.length:null,working:count,lastAt,eventLastAt:lastAt===null?null:new Date(lastAt).toISOString(),state,needsYou:null,workProof:null,presentation:presentation.get(rootId),members});
  }
  const ownerLast=events.filter(e=>e.from==='voce').map(e=>e.at).pop();
  if(Number.isFinite(ownerLast)){owner.lastAt=ownerLast;owner.eventLastAt=new Date(ownerLast).toISOString();}
  const nodeKeys=new Set(nodes.map(n=>n.id)),edges=new Map();
  for(const event of events) {
    if(!nodeKeys.has(event.from)||!nodeKeys.has(event.to))continue;
    const key=event.from+'>'+event.to,edge=edges.get(key)||{from:event.from,to:event.to,count:0,kinds:{comando:0,duvida:0,resposta:0},lastAt:0,lastKind:null,messages:[]};
    edge.count++;edge.kinds[event.kind]++;edge.lastAt=event.at;edge.lastKind=event.kind;
    edge.messages.push({at:new Date(event.at).toISOString(),kind:event.kind,topics:event.topics,source:event.source});edges.set(key,edge);
  }
  const list=[...edges.values()].map(edge=>{
    const order=['comando','duvida','resposta'],top=Math.max(...order.map(k=>edge.kinds[k]));
    const kind=order.filter(k=>edge.kinds[k]===top).includes(edge.lastKind)?edge.lastKind:order.find(k=>edge.kinds[k]===top);
    return {from:edge.from,to:edge.to,count:edge.count,kind,kinds:edge.kinds,lastAt:new Date(edge.lastAt).toISOString(),recent:now-edge.lastAt<=RECENT_MS,messages:edge.messages.slice(-8).reverse()};
  }).sort((a,b)=>Date.parse(b.lastAt)-Date.parse(a.lastAt));
  const claudeLidas=good.filter(a=>a.family==='claude').length,claudeFalhas=(coverage?.motivos||[]).filter(m=>m.familia==='claude').length;
  return {ok:true,readAt:proof.observedAt,windowMinutes:WINDOW_MS/60000,recentMinutes:RECENT_MS/60000,sources:{claude:claudeLidas>0&&claudeFalhas===0?'ok':'?',codex:complete&&codex.ok?'ok':'?',painel:'?',sessoes:complete?'ok':'?'},unread:complete?codex.unread:null,nodes,edges:list,metadataProof,readerStatus,controlProof};
}
function buildFlow({ snapshot = null, estado = ESTADO, claudeDir = CLAUDE_DIR, codexDir = CODEX_DIR, now = Date.now(), metadataOnly = false, policyId = null } = {}) {
  if(metadataOnly)return buildMetadataFlow({snapshot,now,policyId,estado});
  const since = now - WINDOW_MS;
  if(metadataOnly&&(!policyId||snapshot?.proof?.mode!=='scalar-metadata'||snapshot.proof.policyId!==policyId||!Array.isArray(snapshot.metadataRecords)||!Number.isFinite(Date.parse(snapshot.proof.observedAt))||Date.parse(snapshot.proof.observedAt)>now||now-Date.parse(snapshot.proof.observedAt)>30000))throw Error('Metadata flow unavailable');
  const registry = metadataOnly ? {ok:true,map:new Map()} : registryOf(estado);
  const claude = metadataOnly ? {ok:false,events:[],boxes:new Map(),unread:0,lastAt:new Map()} : scanClaude({ dir: claudeDir, registry, since, now });
  if(metadataOnly)for(const agent of snapshot.equipe.agents||[])if(agent.family==='claude'&&!agent.parentId){
    const box=boxOfName(agent.conversationName);if(box){const id=agent.id.replace(/^claude:/,'');claude.boxes.set(id,box);const at=Date.parse(agent.lastAt);if(Number.isFinite(at))claude.lastAt.set(box,at);}
  }
  const threads = threadsOf(snapshot);
  const codex = snapshot ? scanCodex({ dir: codexDir, since, threads, projected:metadataOnly?snapshot.metadataRecords:null }) : { ok: false, events: [], lastAt: new Map() };
  const panel = metadataOnly ? {ok:false,events:[]} : scanPanel({ estado, since, now });
  const complete=metadataOnly?snapshot.proof.complete!==false:true;
  const workStates=new Map();
  if(metadataOnly)for(const agent of snapshot.equipe.agents||[])if(!agent.parentId){const box=agent.family==='codex'?threads.get(agent.id.replace(/^codex:/,''))?.box:claude.boxes.get(agent.id.replace(/^claude:/,''));if(box)workStates.set(box,agent.workProof?.state||'unknown');}
  const events = [...claude.events, ...codex.events, ...panel.events].filter(event => event.at >= since && event.at <= now + 60000).sort((a, b) => a.at - b.at);
  // caixas: as fixas e um grupo de ajudantes por quem chamou (so quem chamou alguem ou tem ajudante vivo)
  const lastAt = new Map();
  for (const [box, at] of [...claude.lastAt, ...codex.lastAt]) lastAt.set(box, Math.max(lastAt.get(box) || 0, at));
  for (const item of registry.map.values()) if (item.box && Number.isFinite(item.lastAt) && !lastAt.has(item.box)) lastAt.set(item.box, item.lastAt);
  for (const item of threads.values()) if (item.box && Number.isFinite(item.lastAt)) lastAt.set(item.box, Math.max(lastAt.get(item.box) || 0, item.lastAt));
  const helpers = new Map(); // caixa -> {total, working, lastAt}
  const parentBox = new Map();
  for (const [uuid, box] of claude.boxes) parentBox.set('claude:' + uuid, box);
  for (const [id, item] of threads) if (item.box) parentBox.set('codex:' + id, item.box);
  for (const agent of snapshot && snapshot.equipe && Array.isArray(snapshot.equipe.agents) ? snapshot.equipe.agents : []) {
    if (!agent || !agent.parentId) continue;
    const box = parentBox.get(String(agent.conversationId || agent.parentId)) || parentBox.get(String(agent.parentId));
    if (!box) continue;
    const entry = helpers.get(box) || { total: 0, working: 0, lastAt: 0 }, at = Date.parse(agent.lastAt) || 0;
    entry.total++; if(metadataOnly ? agent.workProof?.state==='working' : now - at < 2 * 60000 && !/done|completed/i.test(String(agent.state || ''))) entry.working++;
    entry.lastAt = Math.max(entry.lastAt, at); helpers.set(box, entry);
  }
  const needs = new Set();
  for (const session of snapshot && snapshot.operator && Array.isArray(snapshot.operator.sessions) ? snapshot.operator.sessions : []) if (session && session.needsOperator) { const box = boxOfName(session.id || session.name); if (box) needs.add(box); }
  const codexBoxes = new Map();
  for (const item of threads.values()) if (item.box && item.box.startsWith('codex:') && !codexBoxes.has(item.box)) codexBoxes.set(item.box, item.name || null);
  const active = new Set(); for (const event of events) for (const end of [event.from, event.to]) active.add(end.startsWith('ajudantes:') ? end.slice(10) : end);
  const dynamic = [...codexBoxes.keys()].filter(id => active.has(id) || (lastAt.get(id) || 0) >= since);
  const nodes = [...BOXES.filter(id => id !== 'codex'), ...dynamic].map(id => ({ id, stage: STAGE[id] || 'sessoes', side: sideOf(id), name: codexBoxes.get(id) || null, lastAt: id === 'voce' ? null : lastAt.get(id) || null, state: id === 'voce' ? null : metadataOnly ? workStates.get(id)||'unknown' : stateOf(lastAt.get(id), now), needsYou: needs.has(id) }));
  const owner = nodes[0];
  const ownerLast = events.filter(event => event.from === 'voce').map(event => event.at).pop();
  owner.lastAt = Number.isFinite(ownerLast) ? ownerLast : null;
  const waiting = snapshot && snapshot.management && snapshot.management.waiting && Number.isFinite(snapshot.management.waiting.count) ? snapshot.management.waiting.count : null;
  let espera = null; try { espera = require('./painel-numeros.cjs').esperaCacheada(estado, now); } catch { espera = null; }
  owner.waiting = espera && espera.total !== null ? espera.total : waiting;
  owner.waitingTexto = espera && espera.total !== null ? espera.rotulo : null;
  const groupIds = new Set();
  for (const event of events) for (const end of [event.from, event.to]) if (end.startsWith('ajudantes:')) groupIds.add(end);
  for (const box of helpers.keys()) if (helpers.get(box).total) groupIds.add('ajudantes:' + box);
  const rank = id => { const at = BOXES.indexOf(id); return at >= 0 ? at : BOXES.length; };
  for (const id of [...groupIds].sort((a, b) => rank(a.slice(10)) - rank(b.slice(10)) || a.localeCompare(b))) {
    const of = id.slice(10), info = helpers.get(of) || null;
    if (!nodes.some(node => node.id === of)) continue;
    nodes.push({ id, stage: 'ajudantes', side: sideOf(of), of, total: info && complete ? info.total : null, working: info && complete ? info.working : null, lastAt: info && info.lastAt ? info.lastAt : null, state: info ? (info.working ? 'working' : metadataOnly?'unknown':stateOf(info.lastAt, now)) : 'unknown', needsYou: false });
  }
  // fios: 1 por par e por sentido; espessura pela quantidade; o tipo que mais aparece da a cor
  const edges = new Map();
  for (const event of events) {
    const key = event.from + '>' + event.to;
    const edge = edges.get(key) || { from: event.from, to: event.to, count: 0, kinds: { comando: 0, duvida: 0, resposta: 0 }, lastAt: 0, lastKind: null, messages: [] };
    edge.count++; edge.kinds[event.kind]++; edge.lastAt = event.at; edge.lastKind = event.kind;
    edge.messages.push({ at: new Date(event.at).toISOString(), kind: event.kind, topics: event.topics, source: event.source });
    edges.set(key, edge);
  }
  const list = [...edges.values()].map(edge => {
    const order = ['comando', 'duvida', 'resposta'];
    const top = Math.max(...order.map(kind => edge.kinds[kind]));
    const kind = order.filter(item => edge.kinds[item] === top).includes(edge.lastKind) ? edge.lastKind : order.find(item => edge.kinds[item] === top);
    return { from: edge.from, to: edge.to, count: edge.count, kind, kinds: edge.kinds, lastAt: new Date(edge.lastAt).toISOString(), recent: now - edge.lastAt <= RECENT_MS, messages: edge.messages.slice(-8).reverse() };
  }).sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt));
  return {
    ok: true, readAt: new Date(now).toISOString(), windowMinutes: WINDOW_MS / 60000, recentMinutes: RECENT_MS / 60000,
    sources: { claude: claude.ok ? 'ok' : '?', codex: codex.ok ? 'ok' : '?', painel: panel.ok ? 'ok' : '?', sessoes: registry.ok ? 'ok' : '?' },
    unread: claude.unread + (codex.unread || 0), nodes, edges: list
  };
}

let cache = null;
const closedCache = new WeakMap();
// Sem leitura em ate 13 s na 1a vez: f2 = {ok:false, motivo}; depois sempre o ultimo pronto, renovado por tras (cache 60 s, ssh 60 s).
async function comF2(value, ctx) {
  if (!value || typeof value !== 'object' || ctx.f2 === false) return value;
  if (ctx.exemplo === true) return { ...value, f2: require('./codex-sessoes.cjs').vazio() };
  let f2 = null;
  try { f2 = await require('./codex-sessoes.cjs').leituraRapida({ estado: ctx.estado || ESTADO, claudeDir: ctx.claudeDir || CLAUDE_DIR, codexDir: ctx.codexDir || CODEX_DIR, vpsReader: ctx.vpsReader }); } catch { f2 = null; }
  return { ...value, f2: f2 || { ok: false, versao: 'f2', motivo: 'primeira leitura ainda em curso (ssh e conversas); volta na proxima' } };
}
async function flow(ctx = {}) {
  if(ctx.metadataOnly===true){
    const provider=ctx.metadataProvider;if(!provider||provider.metadataOnly!==true||typeof provider.snapshot!=='function'||typeof provider.policyId!=='string')throw Error('Metadata flow unavailable');
    const snapshot=await provider.snapshot(),now=Date.now();
    return comF2(buildFlow({snapshot,now,metadataOnly:true,policyId:provider.policyId}),ctx);
  }
  const now = Date.now();
  if (cache && now - cache.at < 15000 && !ctx.fresh) return comF2(cache.value, ctx);
  let snapshot = null;
  try { snapshot = ctx.live ? await ctx.live() : null; } catch { snapshot = null; }
  let value;
  try { value = buildFlow({ snapshot, estado: ctx.estado || ESTADO, claudeDir: ctx.claudeDir || CLAUDE_DIR, codexDir: ctx.codexDir || CODEX_DIR, now }); }
  catch { value = { ok: false, readAt: new Date(now).toISOString(), sources: { claude: '?', codex: '?', painel: '?', sessoes: '?' }, unread: null, nodes: [], edges: [] }; }
  cache = { at: now, value };
  return comF2(value, ctx);
}

module.exports = { flow, buildFlow, scanCodex, threadsOf, topicsOf, kindOf, boxOfName, hashOf, WINDOW_MS, RECENT_MS };
