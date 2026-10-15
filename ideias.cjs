'use strict';
const fs = require('node:fs');
const path = require('node:path');
const LIMIT = 8 * 1024 * 1024, MAX_EVENTS = 8000;
const TYPES = new Set(['feature', 'receita', 'processo', 'parceria', 'conserto']);
const validProject = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,100}$/i.test(value);
const AUTHORS = new Set(['claude', 'codex']);
const STATES = new Set(['escolhida', 'virou card', 'guardada', 'descartada']);
const POSITIONS = new Set(['a favor', 'contra', 'melhora']);
const ID = /^I-\d{8}-\d{4}-[A-Z]{1,3}\d{1,3}$/;
const PRIVATE = /PRIVADO|_SECRETS|backup-privado|\b(?:seed|senha|secret|bearer|api[ _-]?key|(?:access[ _-]?|refresh[ _-]?)token|password|passwd|pwd|private[ _-]?key|mnemonic|passphrase|credentials?|authorization)\b|token["']?\s*[:=]|\bsk[-_][a-z0-9_-]{8,}|0x[a-f\d]{40}|\b[1-9A-HJ-NP-Za-km-z]{32,44}\b|(?:[A-Z]:[\\/]|(?:estado|tasks|casa|src|public|wt)[\\/])|[?&](?:key|token|auth|password)=/i;
function text(raw, max) {
  // Inspect the whole field before truncating. Sensitive events never enter the DTO.
  if (typeof raw !== 'string' || raw.length > 16000 || PRIVATE.test(raw)) return null;
  const clean = raw.replace(/\b[a-f\d]{7,64}\b/gi, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[–—]/g, ',').replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, max) : null;
}
function time(raw, now) {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?-03:00$/.test(raw)) return null;
  const n = Date.parse(raw);
  if (!Number.isFinite(n) || n > now + 60000) return null;
  if (new Date(n - 3 * 3600000).toISOString().slice(0, 19) !== raw.slice(0, 19)) return null;
  return new Date(n).toISOString();
}
function projectEvent(raw, now) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const at = time(raw.hora, now); if (!at) return null;
  const common = { at, author: raw.autor };
  if (raw.t === 'ideia' && ID.test(raw.id) && AUTHORS.has(raw.autor) && TYPES.has(raw.tipo) && validProject(raw.projeto) && ['P', 'M', 'G'].includes(raw.esforco)) {
    const title = text(raw.titulo, 70), why = text(raw.porque, 320), how = text(raw.como, 480), gain = text(raw.ganho, 320);
    if (title && why && how && gain) return { ...common, kind: 'idea', id: raw.id, type: raw.tipo, project: raw.projeto, effort: raw.esforco, title, why, how, gain };
  }
  if (raw.t === 'debate' && ID.test(raw.id) && AUTHORS.has(raw.autor) && POSITIONS.has(raw.posicao)) {
    const body = text(raw.texto, 480); if (body) return { ...common, kind: 'debate', id: raw.id, position: raw.posicao, body };
  }
  if (raw.t === 'decisao' && ID.test(raw.id) && ['coordenador-claude', 'coordenador-codex', 'dono'].includes(raw.autor) && STATES.has(raw.estado)) {
    const body = text(raw.motivo, 320); if (body) return { ...common, kind: 'decision', id: raw.id, state: raw.estado, body };
  }
  if (raw.t === 'progresso' && AUTHORS.has(raw.autor)) {
    const body = text(raw.texto, 480); if (body) return { ...common, kind: 'progress', body };
  }
  // A report contributes only its time, never a path or its contents.
  if (raw.t === 'relatorio' && raw.autor === 'claude') return { ...common, kind: 'report' };
  return null;
}
function projectLedger(input, now = Date.now()) {
  const lines = input.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  if (lines.length > MAX_EVENTS) throw new Error('LIMIT');
  let omitted = 0;
  const events = [];
  for (const line of lines) {
    if (line.length > 16000) { omitted++; continue; }
    try { const event = projectEvent(JSON.parse(line), now); if (event) events.push(event); else omitted++; } catch { omitted++; }
  }
  const ideas = new Map();
  // The append-only source defines the first idea and the latest decisions.
  for (const event of events) if (event.kind === 'idea' && !ideas.has(event.id)) ideas.set(event.id, { ...event, debates: [], decision: null, codexOpinion: null });
  for (const event of events) {
    const idea = ideas.get(event.id); if (!idea) continue;
    if (event.kind === 'debate') { idea.debates.push(event); if (idea.debates.length > 8) idea.debates.shift(); }
    if (event.kind === 'decision') {
      if (event.author === 'coordenador-codex') idea.codexOpinion = event;
      else idea.decision = event;
    }
  }
  const rank = idea => ({ 'virou card': 0, escolhida: 1, guardada: 3, descartada: 4 }[idea.decision?.state] ?? 2);
  return { sourceState: omitted ? 'partial' : 'ready', omitted, total: ideas.size, ideas: [...ideas.values()].sort((a, b) => rank(a) - rank(b) || b.at.localeCompare(a.at)).slice(0, 60), progress: events.filter(e => e.kind === 'progress').slice(-5).reverse(), reports: events.filter(e => e.kind === 'report').slice(-3).reverse() };
}
function readFixedLedger(root) {
  const base = path.resolve(root), relative = ['estado', 'ideias', 'ideias.jsonl'];
  if (fs.lstatSync(base).isSymbolicLink()) throw new Error('UNAVAILABLE');
  let file = base;
  for (const part of relative) { file = path.join(file, part); if (fs.lstatSync(file).isSymbolicLink()) throw new Error('UNAVAILABLE'); }
  const realBase = fs.realpathSync(base), real = fs.realpathSync(file), rel = path.relative(realBase, real);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('UNAVAILABLE');
  const before = fs.statSync(real);
  if (!before.isFile() || before.size > LIMIT || before.nlink > 1) throw new Error('LIMIT');
  const fd = fs.openSync(real, 'r');
  try {
    const stat = fs.fstatSync(fd);
    if (stat.dev !== before.dev || stat.ino !== before.ino || !stat.isFile() || stat.size > LIMIT) throw new Error('UNAVAILABLE');
    const buffer = Buffer.alloc(LIMIT + 1); let length = 0;
    while (length <= LIMIT) { const n = fs.readSync(fd, buffer, length, buffer.length - length, null); if (!n) break; length += n; }
    const after = fs.fstatSync(fd), finalPath = fs.lstatSync(file);
    if (length > LIMIT || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || finalPath.isSymbolicLink() || finalPath.dev !== stat.dev || finalPath.ino !== stat.ino) throw new Error('UNAVAILABLE');
    return buffer.subarray(0, length).toString('utf8');
  } finally { fs.closeSync(fd); }
}
const demo = [
  { t: 'ideia', id: 'I-20261004-1512-C1', hora: '2026-10-04T15:12:00-03:00', autor: 'claude', tipo: 'receita', projeto: 'projeto-b', titulo: 'Uma pagina simples para cada cliente', porque: 'O cliente encontra o que a loja vende sem esperar uma resposta.', como: 'Começar por uma página curta com exemplos fictícios.', esforco: 'M', ganho: 'Validar o interesse antes de medir receita.' },
  { t: 'ideia', id: 'I-20261004-1542-X1', hora: '2026-10-04T15:42:00-03:00', autor: 'codex', tipo: 'conserto', projeto: 'projeto-a', titulo: 'Abrir a Fila somente quando ela for usada', porque: 'A abertura do painel pode carregar menos dados.', como: 'Separar a lista e comparar o peso antes e depois.', esforco: 'M', ganho: 'Ganho ainda sem medida.' },
  { t: 'debate', id: 'I-20261004-1542-X1', hora: '2026-10-04T15:43:00-03:00', autor: 'claude', posicao: 'melhora', texto: 'Conservar o resumo do Início e medir em telas pequenas.' },
  { t: 'decisao', id: 'I-20261004-1542-X1', hora: '2026-10-04T15:44:00-03:00', autor: 'coordenador-codex', estado: 'escolhida', motivo: 'Parecer favorável para medir a candidata.' },
  { t: 'decisao', id: 'I-20261004-1512-C1', hora: '2026-10-04T15:45:00-03:00', autor: 'coordenador-claude', estado: 'guardada', motivo: 'Voltar quando houver retorno do cliente.' },
  { t: 'progresso', hora: '2026-10-04T15:46:00-03:00', autor: 'codex', texto: 'O exemplo do quadro está pronto para ser conferido.' }
];
function read(root, example = false, now = Date.now()) {
  const readAt = new Date(now).toISOString();
  try { return { ok: true, example, readAt, ...projectLedger(example ? demo.map(e => JSON.stringify(e)).join('\n') : readFixedLedger(root), example ? Date.parse('2026-10-04T19:00:00Z') : now) }; }
  catch (error) { return { ok: false, example, readAt, sourceState: error.code === 'ENOENT' ? 'missing' : 'unavailable' }; }
}
function handle(req, url, ctx) {
  const asset = { '/ideias.js': ['ideias.js', 'text/javascript'], '/ideias.css': ['ideias.css', 'text/css'] }[url.pathname];
  if (!asset && url.pathname !== '/api/ideias') return false;
  if (req.method !== 'GET') { ctx.send(405, { error: 'Somente leitura.' }); return true; }
  if (asset) ctx.send(200, fs.readFileSync(path.join(ctx.dir, asset[0]), 'utf8'), asset[1]);
  else { const dto = read(ctx.root, ctx.example); ctx.send(dto.ok ? 200 : 503, dto); }
  return true;
}
module.exports = { handle, read, projectLedger, projectEvent, text };
