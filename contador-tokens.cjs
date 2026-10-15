'use strict';
// comeco e pelo fim (amostra): faltava o meio das conversas do Claude e sobravam conversas do Codex de antes do inicio da conta.
// Agora: le os .jsonl do Claude (~/.claude/projects, com os ajudantes) e do Codex (~/.codex/sessions) aos poucos, com tempo maximo
// por leitura, e soma CADA RESPOSTA 1 vez, separada por tipo de token:
//   Claude: o Claude Code grava 1 linha por bloco da mesma resposta repetindo o mesmo uso -> junta por message.id (global);
//   Codex: token_usage_record por response_id (global); arquivo sem esses registros usa a diferenca entre os token_count.
// So campos de uso, ids, hora, modelo e pasta passam pelo leitor de metadados do equipe.cjs (nada de texto de conversa).
// Pastas reservadas (o mesmo bloqueio do painel) nunca sao abertas; conversa com pasta reservada nao entra na conta.
// "Desde": o inicio da contagem do painel (o firstReadAt do cache de consumo); sem ele, o comeco do dia (BRT).
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const TIPOS = ['novo', 'escritaCache', 'leituraCache', 'saida'];
const BUDGET_MS = 1200, CHUNK = 4 * 1024 * 1024, MAX_REST = 64 * 1024 * 1024, LIST_MS = 15000;
const CLAUDE_FIELDS = ['type', 'timestamp', 'cwd', 'message.id', 'message.model', 'message.usage.input_tokens', 'message.usage.output_tokens', 'message.usage.cache_creation_input_tokens', 'message.usage.cache_read_input_tokens'];
const CODEX_RECORD = ['type', 'timestamp', 'payload.response_id', 'payload.usage.input_tokens', 'payload.usage.cached_input_tokens', 'payload.usage.cache_write_input_tokens', 'payload.usage.output_tokens'];
const CODEX_COUNT = ['type', 'timestamp', 'payload.type', 'payload.info.total_token_usage.input_tokens', 'payload.info.total_token_usage.cached_input_tokens', 'payload.info.total_token_usage.cache_write_input_tokens', 'payload.info.total_token_usage.output_tokens'];
const CODEX_META = ['type', 'payload.cwd'];
const CODEX_TURN = ['type', 'payload.model'];
const PATTERNS_CLAUDE = [Buffer.from('"usage"')];
const PATTERNS_CODEX = ['"token_usage_record"', '"token_count"', '"session_meta"', '"turn_context"'].map(text => Buffer.from(text));
const n = value => Number.isFinite(value) && value >= 0 ? value : 0;
const zero = () => ({ novo: 0, escritaCache: 0, leituraCache: 0, saida: 0, respostas: 0 });
const total = u => u.novo + u.escritaCache + u.leituraCache + u.saida;
const dayBRT = ms => new Date(ms - 3 * 3600000).toISOString().slice(0, 10);
const modelKey = value => String(value || '?').toLowerCase().replace(/[^\w.-]/g, '').slice(0, 60) || '?';

function startOf(root, now) {
  try {
    const stored = JSON.parse(fs.readFileSync(path.join(root, 'casa/ferramentas/painel/.cache/consumo.json'), 'utf8'));
    const at = Date.parse(stored.firstReadAt);
    if (Number.isFinite(at) && at <= now.getTime()) return at;
  } catch {}
  const local = new Date(now.getTime() - 3 * 3600000);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + 3 * 3600000;
}

class TokenCounter {
  constructor({ claudeRoot, codexRoot, start, budgetMs = BUDGET_MS, metadata, blocked }) {
    this.claudeRoot = claudeRoot; this.codexRoot = codexRoot; this.start = start; this.budgetMs = budgetMs;
    this.metadata = metadata; this.blocked = blocked;
    this.files = new Map(); this.listedAt = 0; this.refused = new Set();
    this.seenClaude = new Set(); this.seenCodex = new Set();
    this.byDay = new Map(); // dia|familia|modelo -> soma
    this.byCwd = new Map(); // familia|pasta -> soma
    this.skippedLines = 0;
  }
  list(now) {
    if (now - this.listedAt < LIST_MS) return;
    this.listedAt = now;
    const add = (file, family, extra = {}) => {
      if (this.refused.has(file)) return;
      let stat; try { stat = fs.statSync(file); } catch { return; }
      if (!stat.isFile() || stat.mtimeMs < this.start) return;
      const entry = this.files.get(file);
      if (entry) { if (stat.size < entry.offset) this.files.set(file, this.fresh(file, family, extra, stat)); else { entry.size = stat.size; entry.mtimeMs = stat.mtimeMs; } return; }
      // caminho reservado: decidido 1 vez e nunca aberto
      if (this.blocked(file)) { this.refused.add(file); return; }
      this.files.set(file, this.fresh(file, family, extra, stat));
    };
    const dirs = dir => { try { return fs.readdirSync(dir, { withFileTypes: true }).filter(e => !e.isSymbolicLink()); } catch { return []; } };
    if (this.claudeRoot) for (const project of dirs(this.claudeRoot).filter(e => e.isDirectory())) {
      const projectDir = path.join(this.claudeRoot, project.name);
      for (const entry of dirs(projectDir)) {
        if (entry.isFile() && /^[a-f\d-]{20,}\.jsonl$/i.test(entry.name)) add(path.join(projectDir, entry.name), 'claude');
        else if (entry.isDirectory() && /^[a-f\d-]{20,}$/i.test(entry.name)) for (const child of dirs(path.join(projectDir, entry.name, 'subagents'))) if (child.isFile() && /^agent-[\w-]+\.jsonl$/i.test(child.name)) add(path.join(projectDir, entry.name, 'subagents', child.name), 'claude');
      }
    }
    if (this.codexRoot) {
      const walk = (dir, depth) => { for (const entry of dirs(dir)) { const full = path.join(dir, entry.name); if (entry.isDirectory() && depth < 3) walk(full, depth + 1); else if (entry.isFile() && /^rollout-[\wT:.-]+\.jsonl$/.test(entry.name)) add(full, 'codex'); } };
      walk(this.codexRoot, 0);
    }
  }
  fresh(file, family, extra, stat) { return { file, family, offset: 0, rest: null, size: stat.size, mtimeMs: stat.mtimeMs, cwd: null, privado: false, model: null, lastId: null, lastSkip: false, lastVals: null, lastBucket: null, records: false, prevTotal: null, pending: [], ...extra }; }
  bucket(day, family, model, cwd) {
    const key = day + '|' + family + '|' + modelKey(model);
    if (!this.byDay.has(key)) this.byDay.set(key, zero());
    const cwdKey = family + '|' + modelKey(model) + '|' + String(cwd || '?');
    if (!this.byCwd.has(cwdKey)) this.byCwd.set(cwdKey, zero());
    return [this.byDay.get(key), this.byCwd.get(cwdKey)];
  }
  addTo(buckets, values, responses = 0) { for (const b of buckets) { for (const t of TIPOS) b[t] += values[t]; b.respostas += responses; } }
  claudeLine(entry, line) {
    if (!line.includes('"usage"')) return;
    const record = this.metadata(line, { fields: CLAUDE_FIELDS });
    if (!record) return;
    if (!entry.cwd && typeof record.cwd === 'string') { entry.cwd = record.cwd; if (require('./equipe.cjs').sensitiveCwd(record.cwd)) entry.privado = true; }
    const usage = record.message?.usage, id = record.message?.id;
    if (!usage || typeof id !== 'string' || entry.privado) return;
    const at = Date.parse(record.timestamp);
    const values = { novo: n(usage.input_tokens), escritaCache: n(usage.cache_creation_input_tokens), leituraCache: n(usage.cache_read_input_tokens), saida: n(usage.output_tokens) };
    if (id === entry.lastId) {
      // a mesma resposta em outro bloco: soma so o que cresceu
      if (entry.lastSkip || !entry.lastBucket) return;
      const delta = {}; let grew = false;
      for (const t of TIPOS) { const v = Math.max(entry.lastVals[t], values[t]); delta[t] = v - entry.lastVals[t]; if (delta[t]) grew = true; entry.lastVals[t] = v; }
      if (grew) this.addTo(entry.lastBucket, delta);
      return;
    }
    entry.lastId = id; entry.lastVals = values; entry.lastBucket = null; entry.lastSkip = true;
    if (!Number.isFinite(at) || at < this.start || this.seenClaude.has(id)) return;
    this.seenClaude.add(id); entry.lastSkip = false;
    entry.lastBucket = this.bucket(dayBRT(at), 'claude', record.message.model, entry.cwd);
    this.addTo(entry.lastBucket, values, 1);
  }
  codexLine(entry, line) {
    if (line.includes('"token_usage_record"')) {
      const record = this.metadata(line, { fields: CODEX_RECORD });
      if (record?.type !== 'token_usage_record' || entry.privado) return;
      entry.records = true;
      const usage = record.payload?.usage, id = record.payload?.response_id, at = Date.parse(record.timestamp);
      if (!usage || typeof id !== 'string' || !Number.isFinite(at) || at < this.start || this.seenCodex.has(id)) return;
      this.seenCodex.add(id);
      const values = { novo: Math.max(0, n(usage.input_tokens) - n(usage.cached_input_tokens)), escritaCache: n(usage.cache_write_input_tokens), leituraCache: n(usage.cached_input_tokens), saida: n(usage.output_tokens) };
      this.addTo(this.bucket(dayBRT(at), 'codex', entry.model, entry.cwd), values, 1);
      return;
    }
    if (line.includes('"token_count"')) {
      // reserva: so vale para arquivo sem token_usage_record (versao antiga); a diferenca entre os totais acumulados
      const record = this.metadata(line, { fields: CODEX_COUNT });
      const usage = record?.payload?.type === 'token_count' ? record.payload.info?.total_token_usage : null;
      if (!usage) return;
      const current = { novo: Math.max(0, n(usage.input_tokens) - n(usage.cached_input_tokens)), escritaCache: n(usage.cache_write_input_tokens), leituraCache: n(usage.cached_input_tokens), saida: n(usage.output_tokens) };
      const previous = entry.prevTotal || zero(), at = Date.parse(record.timestamp);
      entry.prevTotal = current;
      if (entry.records || entry.privado || !Number.isFinite(at) || at < this.start) return;
      const delta = {}; let grew = false;
      for (const t of TIPOS) { delta[t] = Math.max(0, current[t] - previous[t]); if (delta[t]) grew = true; }
      if (grew) entry.pending.push({ day: dayBRT(at), model: entry.model, cwd: entry.cwd, delta });
      return;
    }
    if (line.includes('"session_meta"')) {
      const record = this.metadata(line, { fields: CODEX_META });
      if (record?.type === 'session_meta' && !entry.cwd && typeof record.payload?.cwd === 'string') { entry.cwd = record.payload.cwd; if (require('./equipe.cjs').sensitiveCwd(record.payload.cwd)) entry.privado = true; }
      return;
    }
    if (line.includes('"turn_context"')) {
      const record = this.metadata(line, { fields: CODEX_TURN });
      if (record?.type === 'turn_context' && typeof record.payload?.model === 'string') entry.model = record.payload.model;
    }
  }
  readSome(entry, until) {
    let fd;
    try {
      fd = fs.openSync(entry.file, 'r');
      const size = fs.fstatSync(fd).size;
      if (size < entry.offset) { Object.assign(entry, this.fresh(entry.file, entry.family, {}, { size, mtimeMs: entry.mtimeMs })); }
      const patterns = entry.family === 'claude' ? PATTERNS_CLAUDE : PATTERNS_CODEX;
      while (entry.offset < size && Date.now() < until) {
        const length = Math.min(CHUNK, size - entry.offset), buffer = Buffer.alloc(length);
        const read = fs.readSync(fd, buffer, 0, length, entry.offset);
        if (read <= 0) break;
        entry.offset += read;
        const data = entry.rest && entry.rest.length ? Buffer.concat([entry.rest, buffer.subarray(0, read)]) : buffer.subarray(0, read);
        const end = data.lastIndexOf(10);
        if (end < 0) { entry.rest = data.length > MAX_REST ? (this.skippedLines++, null) : Buffer.from(data); continue; }
        entry.rest = end + 1 < data.length ? Buffer.from(data.subarray(end + 1)) : null;
        // so as linhas com uso (ou com a pasta e o modelo, no Codex) viram texto; o resto do arquivo nunca e decodificado
        const starts = new Set();
        for (const pattern of patterns) { let i = data.indexOf(pattern, 0); while (i >= 0 && i < end) { const start = data.lastIndexOf(10, i) + 1; starts.add(start); const next = data.indexOf(10, i); i = next < 0 ? -1 : data.indexOf(pattern, next); } }
        for (const start of [...starts].sort((a, b) => a - b)) {
          const stop = data.indexOf(10, start), line = data.toString('utf8', start, stop < 0 ? end : stop);
          if (entry.family === 'claude') this.claudeLine(entry, line); else this.codexLine(entry, line);
        }
      }
      entry.size = size;
    } catch {} finally { if (fd !== undefined) try { fs.closeSync(fd); } catch {} }
  }
  step(now = Date.now()) {
    const until = Date.now() + this.budgetMs;
    this.list(now);
    const pending = [...this.files.values()].filter(e => e.offset < e.size).sort((a, b) => b.mtimeMs - a.mtimeMs);
    for (const entry of pending) { if (Date.now() >= until) break; this.readSome(entry, until); }
  }
  view(now = new Date(), root = null) {
    const files = [...this.files.values()];
    const bytes = files.reduce((s, e) => s + e.size, 0), read = files.reduce((s, e) => s + Math.min(e.offset, e.size), 0);
    // completo = a 1a contagem inteira terminou; depois disso a conta fica exata ate a ultima leitura (segundos atras), sem piscar
    if (!this.firstDone && files.every(e => e.offset >= e.size)) this.firstDone = true;
    const complete = this.firstDone === true;
    // a reserva do Codex (arquivo sem token_usage_record) entra so agora, para nao contar 2 vezes
    const byDay = new Map([...this.byDay].map(([k, v]) => [k, { ...v }])), byCwd = new Map([...this.byCwd].map(([k, v]) => [k, { ...v }]));
    for (const e of files) if (e.family === 'codex' && !e.records && !e.privado) for (const p of e.pending) {
      const k = p.day + '|codex|' + modelKey(p.model); if (!byDay.has(k)) byDay.set(k, zero()); for (const t of TIPOS) byDay.get(k)[t] += p.delta[t];
      const c = 'codex|' + modelKey(p.model) + '|' + String(p.cwd || '?'); if (!byCwd.has(c)) byCwd.set(c, zero()); for (const t of TIPOS) byCwd.get(c)[t] += p.delta[t];
    }
    const familias = { claude: zero(), codex: zero() }, hoje = { claude: zero(), codex: zero() }, today = dayBRT(now.getTime()), porDia = {}, porModelo = new Map();
    for (const [key, v] of byDay) {
      const [day, family, model] = key.split('|');
      this.addTo([familias[family]], v, v.respostas);
      if (day === today) this.addTo([hoje[family]], v, v.respostas);
      porDia[day] ||= { claude: 0, codex: 0 }; porDia[day][family] += total(v);
      const mk = family + '|' + model; if (!porModelo.has(mk)) porModelo.set(mk, { familia: family, modelo: model, ...zero() }); this.addTo([porModelo.get(mk)], v, v.respostas);
    }
    const soma = obj => { const s = zero(); for (const v of Object.values(obj)) this.addTo([s], v, v.respostas); return s; };
    const tipos = soma(familias), tiposHoje = soma(hoje);
    const withTotals = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, { ...v, total: total(v) }]));
    // por projeto (a mesma regra de pasta do painel)
    let porProjeto = null;
    if (root) try {
      const team = require('./equipe.cjs'), config = team.projectConfig(root), linhas = {}; porProjeto = {};
      for (const [key, v] of byCwd) { const a = key.indexOf('|'), b = key.indexOf('|', a + 1), family = key.slice(0, a), model = key.slice(a + 1, b), cwd = key.slice(b + 1); if (cwd === '?') continue; const id = team.projectOf(cwd, config).id; (linhas[id] ||= []).push({ familia: family, modelo: model, ...v }); }
      for (const [id, list] of Object.entries(linhas)) porProjeto[id] = { tokens: list.reduce((s, v) => s + total(v), 0), waterMl: require('./agua.cjs').aguaDe(list)?.centralMl ?? null };
    } catch { porProjeto = null; }
    const modelos = [...porModelo.values()];
    const agua = require('./agua.cjs').aguaDe(modelos);
    return {
      desde: new Date(this.start).toISOString(), lidoEm: now.toISOString(), completo: complete, lidoPct: complete || !bytes ? 100 : Math.floor(read / bytes * 1000) / 10,
      arquivos: files.length, linhasPuladas: this.skippedLines,
      total: total(tipos), tipos: { ...tipos, total: total(tipos) }, familias: withTotals(familias),
      hoje: { dia: today, total: total(tiposHoje), tipos: { ...tiposHoje, total: total(tiposHoje) }, familias: withTotals(hoje) },
      porDia: Object.fromEntries(Object.entries(porDia).sort().slice(-14)), porModelo: modelos.map(m => ({ ...m, total: total(m) })), porProjeto,
      agua: agua ? { ...agua, dica: require('./agua.cjs').dicaDe(agua), rotulo: require('./agua.cjs').ROTULO } : null,
      fonte: 'cada resposta 1 vez, direto das conversas deste PC'
    };
  }
}

const counters = new Map();
function counterFor(root, sessionsRoot, now = new Date(), options = {}) {
  const claudeRoot = options.claudeRoot === undefined ? path.join((process.env.PAINEL_HOME || os.homedir()), '.claude', 'projects') : options.claudeRoot;
  const key = root + '\0' + sessionsRoot + '\0' + claudeRoot;
  let counter = counters.get(key);
  if (!counter) {
    const team = require('./equipe.cjs');
    const blocked = file => !team.safePath(path.dirname(file).startsWith(path.resolve(sessionsRoot || '')) ? sessionsRoot : claudeRoot, file, new Map());
    counter = new TokenCounter({ claudeRoot, codexRoot: sessionsRoot, start: startOf(root, now), budgetMs: options.budgetMs, metadata: team.projectMetadata, blocked });
    counters.set(key, counter);
  }
  return counter;
}
// Uma leitura do estado: le mais um pedaco (tempo maximo) e devolve a conta ate aqui.
function snapshotConsumo(root, sessionsRoot, now = new Date(), options = {}) {
  const counter = counterFor(root, sessionsRoot, now, options);
  counter.step(now.getTime());
  const view = counter.view(now, root);
  // a 1a contagem (todas as conversas desde o inicio) segue sozinha entre as leituras, em pedacos, ate terminar
  if (!view.completo && !counter.looping && options.background !== false) {
    counter.looping = true;
    const tick = () => { try { counter.step(Date.now()); } catch {} if ([...counter.files.values()].some(e => e.offset < e.size)) { const t = setTimeout(tick, 150); t.unref?.(); } else counter.looping = false; };
    const t = setTimeout(tick, 150); t.unref?.();
  }
  return view;
}
module.exports = { TokenCounter, snapshotConsumo, counterFor, startOf, dayBRT, TIPOS, CLAUDE_FIELDS };
