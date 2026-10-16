'use strict';
// feed de sessoes lado a lado e mensagem ao Codex ocupado.
// Modulo para a Home nova: o servidor do painel chama handle() em 1 linha, como ja faz com o status-6-linhas.cjs.
// So leitura do estado. A unica escrita e 1 linha por mensagem em estado/recados-do-painel.md, o mesmo arquivo e o
// mesmo formato que o painel de origem ja usa: o vigia acorda o Claude e ela responde ou repassa ao Codex pela fila.
// Nada de mensagem direta a sessao: sem codex queue, sem claude -p, sem fork aberto daqui.
// Reaproveita do painel de origem (so leitura, require): leitor.cjs (readSafe), status-6-linhas.cjs (plain, short,
// operatorOf) e comandos.cjs (validate e redact: as mesmas travas de subir, chave, dinheiro e mensagem a pessoas).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const BRT = 3 * 3600000;
const MAX_TEXT = 1000;
const MAX_RECADOS_BYTES = 2 * 1024 * 1024;
const BUSY_MIN = 12;          // escreveu no codex.md ha menos disso: o COORDENADOR do Codex esta no meio de um turno
const HELPER_MIN = 10;        // ajudante do Codex com passo nos ultimos 10 min conta como trabalhando
const ACTIVE_MIN = 30;        // sessao do Claude com noticia nos ultimos 30 min: ativa
const RECENT_HOURS = 6;       // coluna padrao: sessao com noticia nas ultimas 6 h
const DEDUP_MS = 30000;       // a mesma mensagem ao mesmo destino em 30 s vira 1 linha so
const ARRIVE_MIN = 4;         // vigia: junta 3 min de novidades e acorda o Claude (estimativa)
const HELPER_ETA_MIN = 14;    // pedido urgente: vigia + leitura da fila pela guarda do Codex a cada 10 min (estimativa)
const KNOWN_CLAUDE = Object.freeze(['COORDENADOR', 'ATENDIMENTO', 'LOJA', 'ASSISTENTE', 'CORTES']);
const RESERVED = new Set(['ASSISTENTE']); // assunto privado: a coluna mostra so o estado ate ele abrir de proposito
const ID = /^painel-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLAUDE_SESSION = /^local_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVATE = /SIGILOS|_SECRETS|backup-privado|\bseed\b|\.env\b|private key|chave privada|mnemonic|\bsenha\b|password/i;
const MONEY = /\bR?\$\s?\d[\d.,]*|\b\d+(?:[.,]\d+)?\s*(?:ETH|WETH|USDC|USDT|USD|SOL|BRL|reais|d[oó]lares)\b/gi;
const NONCE = crypto.randomBytes(24).toString('hex');

// ---------- reaproveitamento do painel de origem (so leitura) ----------
const loaded = new Map();
function painelDirOf(root, options = {}) { return options.painelDir || path.join(root, 'casa', 'ferramentas', 'painel'); }
function casa(dir) {
  if (loaded.has(dir)) return loaded.get(dir);
  const pick = name => { try { return require(path.join(dir, name)); } catch { return null; } };
  const value = { leitor: pick('leitor.cjs'), status: pick('status-6-linhas.cjs'), comandos: pick('comandos.cjs') };
  if (value.leitor && value.status && value.comandos) loaded.set(dir, value);
  return value;
}
function readState(root, dir, relative, limit = 2 * 1024 * 1024) {
  const leitor = casa(dir).leitor;
  if (!leitor || typeof leitor.readSafe !== 'function') return '';
  return leitor.readSafe(root, relative, limit);
}
function modifiedAt(root, relative) {
  try {
    const file = path.resolve(root, relative), base = fs.realpathSync(root), real = fs.realpathSync(file);
    const rel = path.relative(base, real);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
    return fs.statSync(real).mtime;
  } catch { return null; }
}

// ---------- texto de gente ----------
function neutralLocal(value) {
  return String(value ?? '')
    .replace(/0x[0-9a-fA-F]{40}/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/local_[0-9a-f-]{8,}/gi, '')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '')
    .replace(/[0-9a-f]{7,64}/gi, s => /\d/.test(s) && /[a-f]/i.test(s) ? '' : s)
    .replace(/[\u2013\u2014]/g, ',')
    .replace(/\s{2,}/g, ' ').trim();
}
function cut(text, limit) {
  if (text.length <= limit) return text;
  const part = text.slice(0, limit - 1), space = part.lastIndexOf(' ');
  return (space > limit * 0.6 ? part.slice(0, space) : part).replace(/[\s,;:]+$/, '') + '…';
}
// Fala em palavras de gente: tira hash, id, caminho, link, carteira e valor; troca o jargao (plain do status das 6 linhas).
function simplify(text, limit, dir) {
  const status = dir ? casa(dir).status : null;
  // Palavra colada em maiuscula ("MESMAautora", "GETpublicos") ganha o espaco antes do resto.
  // "id local_..." e "id <numero longo>" saem inteiros (sobrava "número" solto).
  let out = String(text ?? '').replace(MONEY, 'valor').replace(/\*\*|`/g, '').replace(/,?\s*\bids?\s+(?:local_[0-9a-f-]{8,}|[0-9a-f]{8}-[0-9a-f-]{27,})/gi, '').replace(/\b([A-ZÀ-Þ]{2,})([a-zà-ÿ]{3,})/g, '$1 $2');
  try { out = status && typeof status.plain === 'function' ? status.plain(out) : neutralLocal(out); } catch { out = neutralLocal(out); }
  // Sobras do que saiu (hash, id, link): "( = leva C", "desde )", "()".
  out = out.replace(/[\u2013\u2014]/g, ',').replace(/\(\s*[=,;:+/]+\s*/g, '(').replace(/\(\s*\)/g, '').replace(/\s+([),;.:])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  return cut(out, limit);
}
function headline(text, limit, dir) {
  const full = simplify(text, 4000, dir);
  const first = full.split(/(?<=[.;!?])\s+(?=[A-ZÀ-Þ0-9"(])/)[0] || full;
  let out = cut(first.length >= 24 ? first : full, limit).replace(/[\s;:,]+$/, '');
  // Parentese aberto pelo corte fecha no fim ("(leva C do Tier S + pill" vira "(leva C do Tier S + pill)").
  const open = (out.match(/\(/g) || []).length - (out.match(/\)/g) || []).length;
  if (open > 0 && !out.endsWith('…')) out += ')'.repeat(open);
  return out;
}

// ---------- hora (BRT, sem horario de verao) ----------
function brtBase(now) {
  const d = new Date(now.getTime() - BRT);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate(), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
function brtAt(base, dayOffset, minutes) { return new Date(Date.UTC(base.y, base.mo, base.d + dayOffset, 0, minutes) + BRT); }
function clockMinutes(clock) {
  const match = /^(\d{1,2}):([0-5])([\dx])$/i.exec(String(clock || ''));
  if (!match || Number(match[1]) > 23) return null;
  return Number(match[1]) * 60 + Number(match[2]) * 10 + (/x/i.test(match[3]) ? 0 : Number(match[3]));
}
function stampOf(now) {
  const d = new Date(now.getTime() - BRT), two = n => String(n).padStart(2, '0');
  return { day: two(d.getUTCDate()) + '/' + two(d.getUTCMonth() + 1), hour: two(d.getUTCHours()) + ':' + two(d.getUTCMinutes()) };
}
function clockOf(date) { return stampOf(date).hour; }
function dayOffsetOfTag(base, text) {
  const iso = /(20\d\d)(\d\d)(\d\d)(?!\d)/.exec(text);
  if (iso) {
    const diff = Math.round((Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])) - Date.UTC(base.y, base.mo, base.d)) / 86400000);
    return diff <= 0 && diff > -60 ? diff : null;
  }
  const short = /-(\d\d)-(\d\d)\]?$/.exec(text);
  if (short && Number(short[2]) >= 1 && Number(short[2]) <= 12) {
    const diff = Math.round((Date.UTC(base.y, Number(short[2]) - 1, Number(short[1])) - Date.UTC(base.y, base.mo, base.d)) / 86400000);
    return diff <= 0 && diff > -60 ? diff : null;
  }
  return null;
}
function minutesAgo(iso, now) { const at = Date.parse(iso || ''); return Number.isFinite(at) ? (now.getTime() - at) / 60000 : Infinity; }
function newest(...values) { const valid = values.filter(value => Number.isFinite(Date.parse(value || ''))); return valid.length ? valid.sort((a, b) => Date.parse(b) - Date.parse(a))[0] : null; }

// ---------- leituras ----------
// Recados das sessoes do Claude no coordenacao.md ("- 15:3x Claude ...", "- 14:1x ASSISTENTE: ...", "- CORTES 06:55: ...").
// A secao vem do mais novo para o mais velho; a hora so tem dia quando sobe mais de 3 h de uma linha para a de baixo.
const WHO = '(Claude|COORDENADOR PONTE|COORDENADOR do Codex|ATENDIMENTO do Claude|ATENDIMENTO do Codex|COORDENADOR|PONTE|ATENDIMENTO|LOJA|ASSISTENTE|CORTES)';
const TIME_FIRST = new RegExp('^\\s*-\\s*(\\d{1,2}:[0-5][\\dx])\\s+' + WHO + '(?![\\w])\\s*(?:\\([^)]*\\))?\\s*[:,]?\\s*(.*)$');
const WHO_FIRST = new RegExp('^\\s*-\\s*' + WHO + '\\s+(\\d{1,2}:[0-5][\\dx])(?![\\d])\\s*(?:\\([^)]*\\))?\\s*[:,]?\\s*(.*)$');
function whoOf(raw) {
  const value = String(raw || '').trim();
  if (/^(?:Claude|COORDENADOR PONTE|COORDENADOR|PONTE)$/.test(value)) return 'COORDENADOR';
  if (/^COORDENADOR do Codex$/.test(value)) return 'COORDENADOR-CODEX';
  if (/^(?:ATENDIMENTO do Claude|ATENDIMENTO)$/.test(value)) return 'ATENDIMENTO';
  if (['LOJA', 'ASSISTENTE', 'CORTES'].includes(value)) return value;
  return null;
}
function recadosOf(text, now) {
  const lines = String(text || '').split(/\r?\n/);
  const start = lines.findIndex(line => /^##\s+Recados\b/i.test(line));
  if (start < 0) return [];
  let end = lines.findIndex((line, index) => index > start && /^##\s/.test(line));
  if (end < 0) end = lines.length;
  const base = brtBase(now), out = [];
  let previous = null, offset = 0;
  for (let i = start + 1; i < end; i++) {
    const a = TIME_FIRST.exec(lines[i]), b = !a && WHO_FIRST.exec(lines[i]);
    if (!a && !b) continue;
    const clock = a ? a[1] : b[2], who = whoOf(a ? a[2] : b[1]), body = (a ? a[3] : b[3]) || '';
    const minutes = clockMinutes(clock);
    if (minutes === null) continue;
    const tagged = dayOffsetOfTag(base, (/\[[^\]]*\]/.exec(lines[i]) || [''])[0].replace(/\]$/, ''));
    if (tagged !== null) offset = tagged;
    else if (previous === null) offset = minutes > base.min + 5 ? -1 : 0;
    else if (minutes - previous > 180) offset -= 1;
    previous = minutes;
    if (!who) continue;
    out.push({ who, clock, at: brtAt(base, offset, minutes).toISOString(), body, line: i + 1 });
  }
  return out;
}
// Bloco "## PARA O OPERADOR (HH:MM)" do coordenacao.md: o resumo que o COORDENADOR do Codex escreve para ele.
function operatorOf(text, now, dir) {
  const status = casa(dir).status;
  let block = null;
  try { block = status && typeof status.operatorOf === 'function' ? status.operatorOf(text) : null; } catch { block = null; }
  if (!block) return null;
  const base = brtBase(now), minutes = clockMinutes(block.at || '');
  const at = minutes === null ? null : brtAt(base, minutes > base.min + 5 ? -1 : 0, minutes).toISOString();
  return { at, clock: block.at || null, fields: block.fields || {} };
}
// Ultimas entradas do codex.md ("[TAG] 16:00 BRT Get-Date: texto"), da mais nova para a mais velha.
function codexEntriesOf(text, now, count = 4) {
  const lines = String(text || '').split(/\r?\n/), base = brtBase(now), out = [];
  for (let i = lines.length - 1; i >= 0 && out.length < count; i--) {
    const line = lines[i].trim(), tag = /^\[([^\]]{2,160})\]\s*(.*)$/.exec(line);
    if (!tag) continue;
    const rest = tag[2], time = /(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/.exec(rest);
    if (!time) continue;
    const minutes = Number(time[1]) * 60 + Number(time[2]);
    const before = rest.slice(0, time.index).replace(/[\s:,-]+$/, '').trim();
    const after = rest.slice(time.index + time[0].length).replace(/^\s*BRT\b/i, '').replace(/^\s*\(?\s*Get-Date\s*\)?/i, '').replace(/^\s*[:,-]\s*/, '').trim();
    const tagged = dayOffsetOfTag(base, tag[1]);
    const offset = tagged !== null ? tagged : minutes > base.min + 5 ? -1 : 0;
    out.push({ at: brtAt(base, offset, minutes).toISOString(), clock: time[0], body: before && /[a-z]/i.test(before) ? before + ': ' + after : after, line: i + 1 });
  }
  return out;
}
function feedCodexOf(text, now) {
  const base = brtBase(now), out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const match = /^(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s*\|\s*([^|]{1,80}?)\s*\|\s*([^|{]{1,400})/.exec(line);
    if (!match) continue;
    const month = Number(match[2]) - 1, day = Number(match[1]);
    if (month < 0 || month > 11 || day < 1 || day > 31) continue;
    const at = new Date(Date.UTC(base.y, month, day, Number(match[3]), Number(match[4])) + BRT);
    if (at.getTime() > now.getTime() + 300000) continue;
    out.push({ at: at.toISOString(), clock: match[3] + ':' + match[4], label: match[5].trim(), body: match[6].trim() });
  }
  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
// estado/sessoes-claude.json: as sessoes da conta atual com titulo conhecido (como o comandos.cjs do painel de origem).
function claudeSessionsOf(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { return []; }
  const out = [], seen = new Set();
  for (const item of (Array.isArray(parsed?.sessoes) ? parsed.sessoes : []).slice(0, 20)) {
    if (!item || !KNOWN_CLAUDE.includes(item.titulo) || !CLAUDE_SESSION.test(item.sessionId || '') || seen.has(item.titulo)) continue;
    seen.add(item.titulo);
    out.push({ title: item.titulo, sessionId: item.sessionId, ultima: Number.isFinite(Date.parse(item.ultima)) ? new Date(item.ultima).toISOString() : null });
  }
  return out;
}
// estado/recados-do-painel.md: "- DD/MM HH:MM | DESTINO | [sessão local_x | conversa <id> |] texto | painel-<uuid> [| marca]".
// Marca no fim da linha (o Claude anota): "entregue HH:MM", "respondida HH:MM", "cancelada"; ou o id em ponte-painel-entregues.txt.
function statusOf(marks, id, delivered) {
  if (/\bn[aã]o entregue\b/i.test(marks)) return 'nao-entregue';
  if (/\b(?:respondid[ao]|atendid[ao]|resolvid[ao]|feito)\b/i.test(marks)) return 'respondida';
  if (/\bcancelad[ao]\b/i.test(marks)) return 'cancelada';
  if (/\b(?:entregue|repassad[ao])\b/i.test(marks) || delivered.has(id)) return 'entregue';
  return 'na-fila';
}
function sentOf(text, deliveredText, now) {
  const delivered = new Set(String(deliveredText || '').replace(/^﻿/, '').split(/\r?\n/).map(line => line.trim()).filter(line => ID.test(line)));
  const base = brtBase(now), out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const match = /^-\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s*\|\s*(.*)$/.exec(line.trim());
    if (!match) continue;
    const parts = match[5].split(/\s*\|\s*/), idIndex = parts.findIndex(part => ID.test(part));
    if (idIndex < 2) continue;
    const dest = parts[0].trim().toUpperCase();
    let middle = parts.slice(1, idIndex), target = null;
    const session = /^sess[aã]o\s+(local_[0-9a-f-]{36})\b/i.exec(middle[0] || ''), thread = /^conversa\s+([0-9a-f-]{36})\b/i.exec(middle[0] || '');
    if (middle.length > 1 && session) { target = { family: 'claude', sessionId: session[1] }; middle = middle.slice(1); }
    else if (middle.length > 1 && thread) { target = { family: 'codex', threadId: thread[1] }; middle = middle.slice(1); }
    const id = parts[idIndex], marks = parts.slice(idIndex + 1).join(' | ');
    const at = new Date(Date.UTC(base.y, Number(match[2]) - 1, Number(match[1]), Number(match[3]), Number(match[4])) + BRT);
    out.push({ id, dest, target, at: at.toISOString(), clock: match[3] + ':' + match[4], text: middle.join(' | '), status: statusOf(marks, id, delivered) });
  }
  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

// estado/respostas-do-painel.md (so leitura; quem escreve e o COORDENADOR que responde, nunca o painel):
// "- DD/MM HH:MM | COORDENADOR CLAUDE | painel-<uuid> | resposta curta". O vigia nao le este arquivo (sem laco).
function whoOfReply(raw) {
  const value = String(raw || '').trim().toUpperCase();
  if (/^(?:COORDENADOR CLAUDE|Claude|CLAUDE|COORDENADOR)$/.test(value)) return 'claude';
  if (/^(?:COORDENADOR CODEX|COORDENADOR DO CODEX|CODEX)$/.test(value)) return 'codex';
  return KNOWN_CLAUDE.includes(value) ? value : null;
}
function repliesOf(text, now) {
  const base = brtBase(now), byId = new Map();
  for (const line of String(text || '').split(/\r?\n/)) {
    const match = /^-\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s*\|\s*([^|]{1,40}?)\s*\|\s*(painel-[0-9a-f-]{36})\s*\|\s*(.+)$/i.exec(line.trim());
    if (!match || !ID.test(match[6])) continue;
    const who = whoOfReply(match[5]);
    if (!who || PRIVATE.test(match[7])) continue;
    const at = new Date(Date.UTC(base.y, Number(match[2]) - 1, Number(match[1]), Number(match[3]), Number(match[4])) + BRT);
    const list = byId.get(match[6].toLowerCase()) || [];
    list.push({ who, at: at.toISOString(), clock: match[3] + ':' + match[4], raw: match[7] });
    byId.set(match[6].toLowerCase(), list);
  }
  for (const list of byId.values()) list.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return byId;
}

// ---------- dados ao vivo do painel de origem (por proxy, opcional) ----------
function liveOf(state, now) {
  const result = { ok: false, threads: [], workingCodex: 0, busyThreads: new Set(), lastByThread: new Map(), claudeByTitle: new Map() };
  if (!state || typeof state !== 'object') return result;
  result.ok = true;
  const agents = Array.isArray(state.equipe?.agents) ? state.equipe.agents : [];
  for (const agent of agents) {
    if (agent?.family !== 'codex') continue;
    const recent = minutesAgo(agent.lastAt, now) <= HELPER_MIN, working = recent && ['working', 'walking'].includes(agent.state);
    const own = String(agent.id || '').replace(/^codex:/, ''), parent = String(agent.parentId || '').replace(/^codex:/, '');
    if (working) {
      if (agent.parentId) result.workingCodex++;
      result.busyThreads.add(agent.parentId ? parent : own);
    }
    for (const key of [own, parent]) if (UUID.test(key) && Number.isFinite(Date.parse(agent.lastAt))) result.lastByThread.set(key, newest(result.lastByThread.get(key), agent.lastAt));
  }
  for (const session of Array.isArray(state.operator?.sessions) ? state.operator.sessions : []) if (session && typeof session.id === 'string' && Number.isFinite(Date.parse(session.node?.lastAt || ''))) result.claudeByTitle.set(session.id, session.node.lastAt);
  const seen = new Set();
  for (const item of Array.isArray(state.commandSessions) ? state.commandSessions : []) {
    if (item?.family !== 'codex' || !UUID.test(item.threadId || '') || seen.has(item.threadId)) continue;
    const name = String(item.name || '').replace(/[|\r\n\t\u0000-\u001f\u2013\u2014]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!name || PRIVATE.test(name)) continue;
    seen.add(item.threadId);
    result.threads.push({ threadId: item.threadId, name, lastAt: newest(item.lastAt, result.lastByThread.get(item.threadId)) });
  }
  return result;
}

// ---------- montagem ----------
function fala(at, clock, raw, source, dir, limit = 150) {
  const text = headline(raw, limit, dir), full = simplify(raw, 700, dir);
  return text ? { at, clock, text, full: full !== text ? full : null, source } : null;
}
function stateCodexCoordenador(codexMd, live, now) {
  const age = codexMd ? (now.getTime() - codexMd.getTime()) / 60000 : Infinity;
  const helpers = live.ok ? live.workingCodex : null;
  const busy = null;
  return {busy,helpers,state:'?',source:'estado/codex.md',summaryAgeMinutes:Number.isFinite(age)?age:null,familyActivity:helpers};
}
// Sessao do Claude: o painel nao ve o processo dela, so a noticia mais nova (recado, estado/<sessao>.md, sessoes-claude.json).
function sessionState(lastAt, now) {
  const age = minutesAgo(lastAt, now);
  return !Number.isFinite(age) ? '?' : age <= ACTIVE_MIN ? 'ativa' : 'quieta';
}
function snapshot(root, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const dir = painelDirOf(root, options);
  const live = liveOf(options.live, now);
  const read = file => readState(root, dir, file);
  const mega = read('estado/coordenacao.md'), codex = read('estado/codex.md');
  const recados = mega ? recadosOf(mega, now) : [];
  const operator = mega ? operatorOf(mega, now, dir) : null;
  const entries = codex ? codexEntriesOf(codex, now, 4) : [];
  const feed = feedCodexOf(read('estado/feed-codex.log'), now);
  const claude = claudeSessionsOf(read('estado/sessoes-claude.json')).map(item => ({ ...item, ultima: newest(item.ultima, live.claudeByTitle.get(item.title)) }));
  const sent = sentOf(read('estado/recados-do-painel.md'), read('estado/ponte-painel-entregues.txt'), now);
  const clean = item => item && !PRIVATE.test(item.full || '') && !PRIVATE.test(item.text);
  const byWho = who => recados.filter(item => item.who === who && !PRIVATE.test(item.body));

  // COORDENADOR do Codex: o resumo que ela escreve para ele (rodando, fez, proximo); do codex.md (registro tecnico) so o que
  // chegou depois do resumo, no maximo 2. Sem resumo, as 4 ultimas entradas do codex.md.
  const codexFalas = [];
  if (operator) for (const [key, label] of [['RODANDO', 'Rodando'], ['FEZ', 'Fez'], ['PROXIMO', 'Próximo']]) {
    const field = operator.fields[key];
    if (field && !PRIVATE.test(field.text)) codexFalas.push(fala(operator.at, operator.clock, label + ': ' + field.text, 'resumo', dir));
  }
  const summaryAt = operator && operator.at ? Date.parse(operator.at) : null;
  const fresh = entries.filter(entry => !PRIVATE.test(entry.body) && (!summaryAt || Date.parse(entry.at) > summaryAt)).slice(0, summaryAt ? 2 : 4);
  for (const entry of fresh) codexFalas.push(fala(entry.at, entry.clock, entry.body, 'registro', dir));
  const codexFalasOk = codexFalas.filter(clean).sort((a, b) => (Date.parse(b.at || 0) || 0) - (Date.parse(a.at || 0) || 0)).slice(0, 6);
  const codexMd = modifiedAt(root, 'estado/codex.md');
  const codexState = stateCodexCoordenador(codexMd, live, now);
  const coordenadorThread = live.threads.find(item => /^COORDENADOR\s*·\s*conversa$/i.test(item.name)) || live.threads.find(item => /COORDENADOR/i.test(item.name)) || null;

  // Claude: os recados dela no coordenacao.md; a hora mais nova entre recado, sessoes-claude.json e leitura de credito dela.
  const claudeCoordenador = claude.find(item => item.title === 'COORDENADOR');
  const claudeFalas = byWho('COORDENADOR').slice(0, 6).map(item => fala(item.at, item.clock, item.body, 'recado', dir)).filter(clean);
  let creditAt = null;
  for (const row of read('estado/credito-claude.jsonl').split(/\r?\n/).reverse()) {
    if (!row.trim()) continue;
    try { const value = JSON.parse(row); if (/Claude/i.test(String(value.quem || '')) && Number.isFinite(Date.parse(value.hora))) { creditAt = new Date(value.hora).toISOString(); break; } } catch { /* linha fora do formato */ }
  }
  const claudeLast = newest(claudeFalas[0]?.at, claudeCoordenador?.ultima, creditAt);

  const replies = repliesOf(read('estado/respostas-do-painel.md'), now);
  const sentTo = predicate => sent.filter(predicate).slice(0, 6).map(item => {
    const answers = (replies.get(item.id.toLowerCase()) || []).slice(0, 4).map(reply => ({ who: reply.who, at: reply.at, clock: reply.clock, text: simplify(reply.raw, 600, dir) })).filter(reply => reply.text);
    return { id: item.id, at: item.at, clock: item.clock, dest: item.dest, text: cut(item.text.replace(/[\u2013\u2014]/g, ',').replace(/\s+/g, ' ').trim(), 220), status: answers.length && ['na-fila', 'entregue'].includes(item.status) ? 'respondida' : item.status, replies: answers };
  });
  const toCodex = item => /^(?:COORDENADOR CODEX|COORDENADOR CODEX AGORA)$/.test(item.dest);
  const toClaude = item => /^(?:COORDENADOR CLAUDE|COORDENACAO|COORDENADOR)$/.test(item.dest) && !item.target;
  const toBoth = item => /^OS DOIS$/.test(item.dest);
  const toJoin = item => /^(?:JUNTAR|PALAVRA FINAL)$/.test(item.dest);

  const coordenador = {
    codex: { key: 'codex', title: 'COORDENADOR CODEX', name: 'COORDENADOR do Codex', family: 'codex', state: codexState.state, busy: codexState.busy, helpers: codexState.helpers,summaryAt:operator?.at||null,summaryAgeMinutes:operator?.at&&Date.parse(operator.at)<=now?Math.floor((now-Date.parse(operator.at))/60000):null,recordAgeMinutes:codexState.summaryAgeMinutes,familyActivity:codexState.familyActivity,lastAt: newest(codexMd ? codexMd.toISOString() : null, codexFalasOk[0]?.at), appLink: coordenadorThread ? 'codex://threads/' + coordenadorThread.threadId : null, falas: codexFalasOk, sent: sentTo(toCodex) },
    claude: { key: 'claude', title: 'COORDENADOR CLAUDE', name: 'Claude', family: 'claude', state: sessionState(claudeLast, now), busy: false, helpers: null, lastAt: claudeLast, appLink: null, falas: claudeFalas, sent: sentTo(toClaude) },
    dois: { key: 'dois', title: 'OS DOIS', sent: sentTo(toBoth), juntar: sentTo(toJoin) }
  };

  // Feed de sessoes: as 2 COORDENADOR, as sessoes do Claude da conta atual e as conversas do Codex lidas do painel de origem.
  const sessions = [
    { key: 'codex:coordenador', family: 'codex', kind: 'coordenador', name: 'COORDENADOR do Codex', para: 'codex', state: codexState.state, lastAt: coordenador.codex.lastAt, reserved: false, falas: codexFalasOk.slice(0, 5), sent: coordenador.codex.sent.slice(0, 3), appLink: coordenador.codex.appLink, canSend: true, busy: codexState.busy },
    { key: 'claude:COORDENADOR', family: 'claude', kind: 'coordenador', name: 'Claude', para: 'claude', state: coordenador.claude.state, lastAt: claudeLast, reserved: false, falas: claudeFalas.slice(0, 5), sent: coordenador.claude.sent.slice(0, 3), appLink: null, canSend: true, busy: false }
  ];
  for (const item of claude.filter(entry => entry.title !== 'COORDENADOR')) {
    const own = byWho(item.title).slice(0, 5).map(entry => fala(entry.at, entry.clock, entry.body, 'recado', dir)).filter(clean);
    const ownFile = modifiedAt(root, 'estado/' + item.title.toLowerCase() + '.md');
    const lastAt = newest(own[0]?.at, item.ultima, ownFile ? ownFile.toISOString() : null), reserved = RESERVED.has(item.title);
    sessions.push({ key: 'claude:' + item.title, family: 'claude', kind: 'sessao', name: item.title, para: 'sessao', state: sessionState(lastAt, now), lastAt, reserved, falas: reserved ? [] : own, falasReservadas: reserved ? own.length : 0, sent: sentTo(entry => entry.target?.family === 'claude' && entry.target.sessionId === item.sessionId).slice(0, 3), appLink: null, canSend: true, busy: false });
  }
  for (const thread of live.threads.filter(item => !/COORDENADOR/i.test(item.name))) {
    const working = live.busyThreads.has(thread.threadId);
    sessions.push({ key: 'codex:' + thread.threadId, family: 'codex', kind: 'conversa', name: thread.name, para: 'sessao', state: working ? 'trabalhando' : thread.lastAt ? 'parada' : '?', lastAt: thread.lastAt, reserved: false, falas: [], sent: sentTo(entry => entry.target?.family === 'codex' && entry.target.threadId === thread.threadId).slice(0, 3), appLink: 'codex://threads/' + thread.threadId, canSend: true, busy: working });
  }
  const feedFalas = feed.filter(item => !PRIVATE.test(item.body) && !PRIVATE.test(item.label)).slice(0, 6).map(item => fala(item.at, item.clock, item.label + ': ' + item.body, 'registro', dir)).filter(clean);
  if (feedFalas.length) sessions.push({ key: 'codex:registro', family: 'codex', kind: 'registro', name: 'Registro do Codex', para: null, state: sessionState(feedFalas[0].at, now), lastAt: feedFalas[0].at, reserved: false, falas: feedFalas.slice(0, 5), sent: [], appLink: null, canSend: false, busy: false });

  const padrao = sessions.filter(item => item.kind === 'coordenador' || (!item.reserved && item.kind !== 'registro' && minutesAgo(item.lastAt, now) <= RECENT_HOURS * 60)).map(item => item.key).slice(0, 6);
  return {
    messages:{total:sent.length,pending:sent.filter(r=>r.status==='na-fila'||r.status==='nao-entregue').length,delivered:sent.filter(r=>r.status==='entregue'||r.status==='respondida').length},readAt: now.toISOString(), readAtBrt: clockOf(now), nonce: options.nonce || NONCE, example: options.example === true,
    live: { ok: live.ok }, sendEnabled: options.example !== true && !!casa(dir).comandos,
    coordenador, sessions, padrao
  };
}
function reservedFalas(root, key, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(), dir = painelDirOf(root, options);
  const title = String(key || '').replace(/^claude:/, '');
  if (!RESERVED.has(title)) return null;
  const mega = readState(root, dir, 'estado/coordenacao.md');
  return recadosOf(mega, now).filter(item => item.who === title && !PRIVATE.test(item.body)).slice(0, 5).map(item => fala(item.at, item.clock, item.body, 'recado', dir)).filter(item => item && !PRIVATE.test(item.full || '') && !PRIVATE.test(item.text));
}

// ---------- envio: 1 linha em estado/recados-do-painel.md ----------
const lastSends = new Map();
function stateDir(root) {
  const base = fs.realpathSync(root), directory = path.join(base, 'estado'), entry = fs.lstatSync(directory);
  if (entry.isSymbolicLink() || !entry.isDirectory() || fs.realpathSync(directory) !== directory) throw Error('Invalid state directory');
  return directory;
}
function recadosFile(directory) {
  const file = path.join(directory, 'recados-do-painel.md');
  try { const entry = fs.lstatSync(file); if (entry.isSymbolicLink() || !entry.isFile()) throw Error('Invalid inbox'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return file;
}
const MESSAGES = Object.freeze({
  text: 'Escreva de 1 a 1000 caracteres.',
  locked: 'Subir, chave ou dinheiro só valem no chat de quem executa. Por aqui não vai.',
  private: 'Parece senha, chave ou segredo. Isso não passa pelo painel.',
  external: 'Mensagem para outras pessoas é no chat, não no painel.',
  session: 'Essa sessão saiu da lista. Atualize a tela.',
  invalid: 'Pedido inválido. Recarregue a página.',
  example: 'Envio desligado no modo exemplo.',
  unavailable: 'Envio indisponível agora: a regra de envio do painel não foi lida.',
  write: 'Não foi possível salvar. Tente de novo.',
  off: 'Envio pelo painel desligado nesta versão. Escreva direto no chat da sessão.'
});
function failure(code, statusCode) { return { ok: false, error: code, message: MESSAGES[code], statusCode }; }
function sendRecado() { return failure('off', 410); }

// ---------- gancho do servidor (1 linha no servidor.cjs da Home) ----------
const ASSETS = Object.freeze({ '/coordenador-pb.js': ['coordenador-pb.js', 'text/javascript'], '/coordenador-pb.css': ['coordenador-pb.css', 'text/css'] });
// ctx: { root, send(status,data,type?), dir?, port, nonce?, example?, painelDir?, live?: () => estado do painel de origem (objeto ou Promise) }
// Devolve true quando a rota e deste modulo (a resposta segue por ctx.send, mesmo assincrona).
function handle(req, url, ctx) {
  const pathname = url.pathname, send = ctx.send, nonce = ctx.nonce || NONCE;
  if (req.method === 'GET' && Object.hasOwn(ASSETS, pathname)) {
    const [file, type] = ASSETS[pathname], dir = ctx.dir || __dirname;
    try {
      const base = fs.realpathSync(dir), asset = path.join(dir, file);
      if (fs.lstatSync(asset).isSymbolicLink() || fs.realpathSync(asset) !== path.join(base, file)) throw Error('Invalid asset');
      send(200, fs.readFileSync(asset), type);
    } catch { send(503, { error: 'Asset unavailable' }); }
    return true;
  }
  if (pathname === '/api/coordenador-pb') {
    if (req.method !== 'GET') { send(405, { error: 'Method not allowed' }); return true; }
    Promise.resolve().then(() => ctx.live ? ctx.live() : null).catch(() => null)
      .then(live => send(200, snapshot(ctx.root, { live, nonce, example: ctx.example === true, painelDir: ctx.painelDir })))
      .catch(() => send(503, { error: 'Leitura indisponível' }));
    return true;
  }
  const reserved = /^\/api\/coordenador-pb\/reservada\/([A-Z]{2,12})$/.exec(pathname);
  if (reserved) {
    if (req.method !== 'GET') { send(405, { error: 'Method not allowed' }); return true; }
    try { const falas = reservedFalas(ctx.root, reserved[1], { painelDir: ctx.painelDir }); send(falas ? 200 : 404, falas ? { key: 'claude:' + reserved[1], falas } : { error: 'Not found' }); } catch { send(503, { error: 'Leitura indisponível' }); }
    return true;
  }
  if (pathname === '/api/coordenador-pb/recado') { send(410, failure('off', 410)); return true; }
  return false;
}

module.exports = { handle, snapshot, sendRecado, reservedFalas, recadosOf, codexEntriesOf, feedCodexOf, claudeSessionsOf, sentOf, statusOf, repliesOf, liveOf, simplify, headline, clockMinutes, stampOf, ASSETS, MESSAGES, NONCE };
