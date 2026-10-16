'use strict';
// HISTORICO POR HORA do infografico "quem fala com quem" (aba Equipe, vista Fluxo). SO METADADO: hora, de, para, tipo.
// Nenhum texto de mensagem sai daqui nem entra no cache: o texto e lido so para saber se a linha e do dono, de automacao
// ou um recado, e e descartado na hora. Do recado entre sessoes fica so o remetente (from) e a hora.
// Tipos de ligacao:
//   dono        voce -> sessao do Claude ou conversa do Codex (mensagem digitada por ele)
//   recado      sessao -> sessao (linha de usuario com <cross-session-message from=...>; e o aviso do Claude
// Metadados de coordenacao e eventos locais.
// Metadados de coordenacao e eventos locais.
// Metadados de coordenacao e eventos locais.
//   ajudante    sessao -> ajudantes dela: arquivo subagents/agent-*.jsonl (hora de criacao) e rollout de subagente do Codex
// Baldes por HORA por ligacao, por arquivo, num cache JSON com a posicao lida de cada arquivo: a 2a leitura so le o que entrou
// Ids dos nos iguais aos do pe-fluxo.cjs: voce, coordenador-claude, coordenador-codex, atendimento, loja, cortes, assistente, codex, codex:<8>,
// ajudantes:<no>. Conversa do Claude fora da casa vira "claude:outras"; conversa do Codex alem das N maiores vira "codex:outras".
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const H = 3600000, DIA = 24 * H, BRT = 3 * H;
const MAX_BYTES = 300 * 1024 * 1024;   // regra: arquivo maior que 300 MB e pulado e anotado
const CHUNK = 4 * 1024 * 1024, LINHA_MAX = 32 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_FIM = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i;
const LOCAL = /^local_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AJUDANTE_ID = /^a[0-9a-f]{16}$/;
const VERSAO_MD = 2; // muda quando a leitura da fila ou do codex.md muda: o md e relido na hora
const JANELAS = { '2h': 2 * H, '6h': 6 * H, '12h': 12 * H, '24h': 24 * H, semana: 7 * DIA, mes: 30 * DIA, total: Infinity };

// Mensagens estruturadas de ferramentas e automacao, separadas de entradas humanas.
const AUTO_CLAUDE = /^(<cross-session-message|<task-notification|<system-reminder|<command-|Caveat:|<local-command|From |<scheduled-task|This session is being continued|<bash-|<user-prompt-submit-hook|<tool-use-error|\[Request interrupted)/i;
// Eventos de automacao do Codex, identificados pelo formato.
const AUTO_CODEX = /^(?:<heartbeat>|<in-app-browser-context|<turn_aborted|<scheduled-task)/;
const COORDENADOR_NO_CODEX = /^(?:<cross-session-message|<task-notification|<system-reminder)/i;
// nome de conversa do Codex que nao vai para a tela (pe-fluxo.cjs + 2-analisar.cjs)
const DADO_SENSIVEL = /(?:https?:\/\/\S*[?&](?:token|key|secret)=|\b0x[a-f0-9]{40}\b|\b[A-HJ-NP-Za-km-z1-9]{32,44}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}|[a-z]:[\\/]|(?:api[_-]?key|password|secret|token)\s*[:=])/i;

const B_USER = Buffer.from('"type":"user"'), B_TOOL = Buffer.from('"tool_use_id":"');
const B_UMSG = Buffer.from('"UserMessage"'), B_DONE = Buffer.from('"item_completed"');

const fold = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function caixaDoNome(nome) {
  const v = fold(nome).trim();
  if (/coordenador|coordenacao/.test(v)) return 'coordenador-claude';
  if (/^atendimento\b/.test(v)) return 'atendimento';
  if (/^loja\b/.test(v)) return 'loja';
  if (/^cortes\b/.test(v)) return 'cortes';
  if (/^assistente\b/.test(v)) return 'assistente';
  return null;
}
const NOMES_FIXOS = { voce: 'Você', 'coordenador-claude': 'Claude', 'coordenador-codex': 'Coordenação do Codex', atendimento: 'ATENDIMENTO', loja: 'LOJA', cortes: 'CORTES', assistente: 'ASSISTENTE', codex: 'Codex', 'claude:outras': 'Outras conversas do Claude', 'codex:outras': 'Outras conversas do Codex' };
function ladoDe(id) {
  if (id === 'voce') return 'dono';
  if (id.startsWith('ajudantes:')) return 'ajudante';
  if (id === 'coordenador-codex' || id === 'codex' || id.startsWith('codex:')) return 'codex';
  return 'claude';
}
function nomeDaConversaCodex(bruto) {
  const t = String(bruto || '').replace(/[\u0000-\u001f\u2013\u2014|]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || DADO_SENSIVEL.test(t)) return null;
  const limpo = t.replace(/^coordenador\s*·\s*/i, '').replace(/\s*\(\d+\)\s*$/, '').trim().slice(0, 60);
  return limpo ? limpo.charAt(0).toUpperCase() + limpo.slice(1) : null;
}

// ---------- leitura em fluxo: so linhas inteiras, a partir de uma posicao ----------
async function lerLinhas(file, desde, ate, porLinha) {
  const fh = await fsp.open(file, 'r');
  const buf = Buffer.allocUnsafe(CHUNK);
  let p = desde, fimLido = desde, resto = null, pulando = false;
  try {
    while (p < ate) {
      const { bytesRead } = await fh.read(buf, 0, Math.min(CHUNK, ate - p), p);
      if (!bytesRead) break;
      let bloco = buf.subarray(0, bytesRead), base = p;
      if (resto) { bloco = Buffer.concat([resto, bloco]); base = p - resto.length; resto = null; }
      let s = 0, i;
      while ((i = bloco.indexOf(10, s)) !== -1) { if (!pulando) porLinha(bloco.subarray(s, i)); pulando = false; s = i + 1; }
      fimLido = base + s;
      if (s < bloco.length) { if (bloco.length - s > LINHA_MAX) pulando = true; else resto = Buffer.from(bloco.subarray(s)); }
      p += bytesRead;
    }
  } finally { await fh.close(); }
  return fimLido; // a linha sem quebra no fim (ainda sendo escrita) fica para a proxima leitura
}
const CAUDA_GRANDE = 200 * 1024 * 1024;
async function inicioDaCauda(file, pos) {
  if (pos <= 0) return 0;
  const fh = await fsp.open(file, 'r');
  try { const b = Buffer.alloc(1024 * 1024); const { bytesRead } = await fh.read(b, 0, b.length, pos); const i = b.subarray(0, bytesRead).indexOf(10); return i === -1 ? pos + bytesRead : pos + i + 1; } finally { await fh.close(); }
}
async function cabeca(file, n) {
  const fh = await fsp.open(file, 'r');
  try { const b = Buffer.alloc(n); const { bytesRead } = await fh.read(b, 0, n, 0); return b.subarray(0, bytesRead); } finally { await fh.close(); }
}
const textoDe = c => typeof c === 'string' ? c : Array.isArray(c) ? c.filter(b => b && b.type === 'text').map(b => b.text || '').join('\n') : '';
const temImagem = c => Array.isArray(c) && c.some(b => b && b.type === 'image');

// ---------- estado do cache ----------
function cacheVazio() { return { v: 1, lidoEm: null, arquivos: {}, pais: {}, vistos: {}, pulados: {} }; }
function somar(entrada, de, para, tipo, ms, n = 1) {
  if (!Number.isFinite(ms)) return false;
  const k = de + '|' + para + '|' + tipo, h = Math.floor(ms / H);
  const b = entrada.b || (entrada.b = {}); const l = b[k] || (b[k] = {});
  l[h] = (l[h] || 0) + n; return true;
}
// a mesma mensagem copiada em 2 arquivos (conversa retomada ou bifurcada) conta 1 vez
function primeiraVez(cache, chaveArq, chave) {
  const atual = cache.vistos[chave];
  if (atual && atual !== chaveArq && cache.arquivos[atual]) return false;
  cache.vistos[chave] = chaveArq; return true;
}
function esquecerArquivo(cache, chaveArq) {
  const e = cache.arquivos[chaveArq]; if (e) { e.b = {}; e.p = 0; }
  for (const k of Object.keys(cache.vistos)) if (cache.vistos[k] === chaveArq) delete cache.vistos[k];
}

// ---------- Claude: conversas ----------
function linhaClaude(cache, chaveArq, entrada, conversa, linha, conta) {
  if (linha.indexOf(B_USER) < 0 || linha.indexOf(B_TOOL) >= 0) return;
  let o; try { o = JSON.parse(linha.toString('utf8')); } catch { return; }
  if (!o || o.type !== 'user' || o.isSidechain) return;
  const ms = Date.parse(o.timestamp); if (!Number.isFinite(ms)) return;
  const c = o.message && o.message.content;
  let t = textoDe(c).trimStart();
  const origem = o.origin && typeof o.origin === 'object' ? o.origin : null;
  // recado entre sessoes: so o remetente e a hora
  const tag = /<cross-session-message\s+([^>]*)>/.exec(t.slice(0, 800));
  if (tag || (origem && origem.kind === 'peer')) {
    const a = {}; if (tag) for (const m of tag[1].matchAll(/([\w-]+)="([^"]*)"/g)) a[m[1]] = m[2];
    const from = String(a.from || (origem && origem.from) || '');
    const sessao = String(a['from-session'] || '');
    t = '';
    if (AJUDANTE_ID.test(from)) return;
    let de = null;
    if (LOCAL.test(from)) de = 'local:' + from.toLowerCase();
    else if (LOCAL.test(sessao)) de = 'local:' + sessao.toLowerCase();
    else if (UUID.test(sessao)) de = 'cc:' + sessao.toLowerCase();
    else { const cx = caixaDoNome(a['from-name'] || a.name); if (cx) de = 'box:' + cx; }
    if (!de) { conta.recadoSemRemetente++; return; }
    if (primeiraVez(cache, chaveArq, 'r' + ms.toString(36) + de.slice(-6))) { somar(entrada, de, 'cc:' + conversa, 'recado', ms); conta.recado++; }
    return;
  }
  if (o.isMeta) return;
  if (origem && origem.kind !== 'human') return;
  const tt = t.trim(), img = temImagem(c); t = '';
  if (!tt && !img) return;
  if (AUTO_CLAUDE.test(tt) || /^tentar novamente$/i.test(tt)) return;
  if (primeiraVez(cache, chaveArq, 'd' + ms.toString(36))) { somar(entrada, 'voce', 'cc:' + conversa, 'dono', ms); conta.dono++; }
}

// ---------- Codex: conversas ----------
function linhaCodex(cache, chaveArq, entrada, conversa, linha, conta) {
  if (linha.indexOf(B_UMSG) < 0 || linha.indexOf(B_DONE) < 0) return;
  let o; try { o = JSON.parse(linha.toString('utf8')); } catch { return; }
  const it = o && o.type === 'event_msg' && o.payload && o.payload.type === 'item_completed' ? o.payload.item : null;
  if (!it || it.type !== 'UserMessage') return;
  const ms = Date.parse(o.timestamp); if (!Number.isFinite(ms)) return;
  let t = ''; let img = 0;
  for (const b of Array.isArray(it.content) ? it.content : []) { if (b && b.type === 'text') t += (t ? '\n' : '') + (b.text || ''); else img++; }
  const tt = t.trim(); t = '';
  if (!tt && !img) return;
  if (/^<realtime_delegation>/.test(tt) && /<source>transcript_tail_flush/.test(tt)) return;
  if (COORDENADOR_NO_CODEX.test(tt)) { if (primeiraVez(cache, chaveArq, 'j' + ms.toString(36))) { somar(entrada, 'box:coordenador-claude', 'cx:' + conversa, 'recado', ms); conta.recado++; } return; }
  if (AUTO_CODEX.test(tt)) return;
  if (primeiraVez(cache, chaveArq, 'x' + ms.toString(36))) { somar(entrada, 'voce', 'cx:' + conversa, 'dono', ms); conta.dono++; }
}

// ---------- md da casa ----------
function diaBrt(y, m, d) { return Date.UTC(y, m - 1, d) + BRT; } // 00:00 em Brasilia, em ms UTC
function itensDaFila(texto, mtimeMs) {
  const anoBase = new Date(mtimeMs - BRT).getUTCFullYear(), mesBase = new Date(mtimeMs - BRT).getUTCMonth() + 1;
  const out = []; let pendentes = []; let dia = null, ultimaExp = null, horaAnt = null, semHora = 0;
  for (const linha of texto.split(/\r?\n/)) {
    if (!/^\d{1,4}[a-z]?(?:\.\s|-[A-Z])/.test(linha)) continue;
    const cab = linha.slice(0, 400);
    let hora = null, marca = null;
    for (const m of cab.matchAll(/(?<![\d:])([01]?\d|2[0-3]):([0-5][0-9x])(?!\d)/g)) {
      const antes = cab.slice(Math.max(0, m.index - 14), m.index);
      const v = { h: +m[1], mi: m[2][1] === 'x' ? +m[2][0] * 10 : +m[2] };
      if (/(FEITO|PEGUEI|PONTO|DESPACHADO|ACEITO)\s*$/i.test(antes)) { if (!marca) marca = v; continue; }
      hora = v; break;
    }
    hora = hora || marca;
    if (!hora) { semHora++; continue; }
    const dm = /(?<![\d/])(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])(?![\d/])/.exec(cab);
    let d = null;
    if (dm) { const mes = +dm[2]; d = diaBrt(mes > mesBase + 1 ? anoBase - 1 : anoBase, mes, +dm[1]); }
    // data escrita que poe o item no futuro e prazo, nao a data do item
    if (d !== null && (ultimaExp === null || (d >= ultimaExp && d <= ultimaExp + 4 * DIA)) && d + hora.h * H + hora.mi * 60000 <= mtimeMs + 10 * 60000) { dia = d; ultimaExp = d; }
    else if (dia !== null && horaAnt !== null && hora.h < horaAnt - 6) dia += DIA; // virou o dia sem data escrita
    horaAnt = hora.h;
    const escritor = (/\b(ATENDIMENTO|LOJA|CORTES|ASSISTENTE) do Claude/i.exec(cab.slice(0, 160)) || [])[1];
    const item = { hora, de: escritor ? escritor.toLowerCase() : 'coordenador-claude' };
    if (dia === null) { pendentes.push(item); continue; }
    if (pendentes.length) { for (const p of pendentes) out.push({ ...p, dia }); pendentes = []; }
    out.push({ ...item, dia });
  }
  const res = [];
  for (const it of out) { let ms = it.dia + it.hora.h * H + it.hora.mi * 60000; for (let k = 0; k < 3 && ms > mtimeMs + 10 * 60000; k++) ms -= DIA; res.push({ ms, de: it.de }); }
  return { itens: res, semHora, semData: pendentes.length };
}
function etiquetasParaCoordenador(texto) {
  const linhas = texto.split(/\r?\n/), out = []; let semHora = 0;
  const RX = /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\s*(Z|[+-]\d{2}:?\d{2}))?/;
  const ms = m => { const off = m[7] && m[7] !== 'Z' ? (m[7][0] === '-' ? 1 : -1) * (+m[7].slice(1, 3) * H + +m[7].slice(-2) * 60000) : m[7] === 'Z' ? 0 : BRT; return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) + off; };
  for (let i = 0; i < linhas.length; i++) {
    if (!/PARA\s+(A\s+)?COORDENADOR/i.test(linhas[i])) continue;
    let m = RX.exec(linhas[i]);
    for (let j = i - 1; !m && j >= Math.max(0, i - 30); j--) m = RX.exec(linhas[j]);
    if (!m) { semHora++; continue; }
    out.push({ ms: ms(m), para: /PARA\s+(A\s+)?COORDENADOR\s+(DO\s+)?CODEX/i.test(linhas[i]) ? 'coordenador-codex' : 'coordenador-claude' });
  }
  return { itens: out, semHora };
}

// ---------- varredura ----------
function listar(dir) { try { return fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; } }
function stat(p) { try { const s = fs.statSync(p); return s.isFile() ? s : null; } catch { return null; } }
function rolloutsCodex(raizes) {
  const out = [];
  const walk = (d, prof) => { for (const e of listar(d)) { const p = path.join(d, e.name); if (e.isDirectory() && prof < 5) walk(p, prof + 1); else if (e.isFile() && /^rollout-.*\.jsonl$/.test(e.name)) { const m = UUID_FIM.exec(e.name); if (m) out.push({ p, id: m[1].toLowerCase() }); } } };
  for (const r of raizes) walk(r, 0);
  return out;
}

function criarHistorico(opcoes = {}) {
  const casa = (process.env.PAINEL_HOME || os.homedir());
  const cfg = {
    claudeRoot: opcoes.claudeRoot || path.join(casa, '.claude', 'projects'),
    codexRoots: opcoes.codexRoots || [path.join(casa, '.codex', 'sessions'), path.join(casa, '.codex', 'archived_sessions')],
    codexIndex: opcoes.codexIndex || path.join(casa, '.codex', 'session_index.jsonl'),
    appRoot: opcoes.appRoot || path.join(casa, 'AppData', 'Roaming', 'Claude', 'claude-code-sessions'),
    estadoRoot: opcoes.estadoRoot || (process.env.PAINEL_ROOT || require('node:path').join(__dirname, 'demo', 'estado')),
    cacheFile: opcoes.cacheFile || path.join(__dirname, 'cache-fluxo.json'),
    maxBytes: opcoes.maxBytes || MAX_BYTES,
  };
  let cache = null, nomes = null, nomesEm = 0;

  function carregar() {
    if (cache) return cache;
    try { const c = JSON.parse(fs.readFileSync(cfg.cacheFile, 'utf8')); cache = c && c.v === 1 ? c : cacheVazio(); } catch { cache = cacheVazio(); }
    return cache;
  }
  function gravar() {
    const tmp = cfg.cacheFile + '.tmp'; fs.mkdirSync(path.dirname(cfg.cacheFile), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(cache)); fs.renameSync(tmp, cfg.cacheFile);
  }
  function anotarPulado(chave, motivo, tam) { cache.pulados[chave] = { motivo, mb: Math.round(tam / 1048576) }; }

  // arquivo de linhas (jsonl): incremental pela posicao; encolheu ou trocou o comeco = reler so ele
  async function jsonl(chave, file, st, porLinha, conta) {
    let e = cache.arquivos[chave];
    if (e && e.t === st.size && e.m === st.mtimeMs) return;
    // inteira, entao o que ele digita para o Codex nao virava fio. Arquivo grande agora e lido so da CAUDA (os ultimos
    // CAUDA_GRANDE bytes, a partir da 1a linha inteira) e depois segue incremental como os outros.
    if (st.size > cfg.maxBytes && (!e || (e.x === 'grande' && !e.p))) { e = cache.arquivos[chave] = { p: await inicioDaCauda(file, st.size - CAUDA_GRANDE), b: {}, cauda: true }; conta.cauda = (conta.cauda || 0) + 1; }
    // assinatura do comeco: sha1 dos primeiros ate 4 KB (as conversas do Claude comecam iguais nos primeiros 64 bytes)
    const assinar = async n => crypto.createHash('sha1').update(await cabeca(file, n)).digest('hex').slice(0, 16);
    if (!e) e = cache.arquivos[chave] = { p: 0, b: {} };
    const cl = Math.min(e.cl || 0, st.size);
    if (st.size < (e.p || 0) || (e.cl && (cl < e.cl || await assinar(cl) !== e.c))) { esquecerArquivo(cache, chave); conta.relidos++; }
    e.cl = Math.min(4096, st.size); e.c = await assinar(e.cl);
    delete e.x; delete cache.pulados[chave];
    const antes = e.p || 0;
    e.p = await lerLinhas(file, antes, st.size, linha => porLinha(e, linha));
    conta.bytes += e.p - antes; conta.lidos++;
    e.t = st.size; e.m = st.mtimeMs;
  }

  async function atualizar() {
    carregar();
    const t0 = Date.now();
    const conta = { lidos: 0, relidos: 0, pulados: 0, bytes: 0, dono: 0, recado: 0, ajudante: 0, fila: 0, paraCoordenador: 0, recadoSemRemetente: 0, filaSemHora: 0 };
    // 1) Claude: conversas (<projeto>/<uuid>.jsonl) e ajudantes (<projeto>/<uuid>/subagents/agent-*.jsonl)
    for (const proj of listar(cfg.claudeRoot)) {
      if (!proj.isDirectory()) continue;
      const dirProj = path.join(cfg.claudeRoot, proj.name);
      for (const e of listar(dirProj)) {
        if (e.isFile() && UUID_FIM.test(e.name) && UUID.test(e.name.slice(0, -6))) {
          const file = path.join(dirProj, e.name), st = stat(file); if (!st) continue;
          const conversa = e.name.slice(0, -6).toLowerCase(), chave = 'cl:' + proj.name + '/' + conversa;
          await jsonl(chave, file, st, (ent, linha) => linhaClaude(cache, chave, ent, conversa, linha, conta), conta);
        } else if (e.isDirectory() && UUID.test(e.name)) {
          const sub = path.join(dirProj, e.name, 'subagents'); let sd; try { sd = fs.statSync(sub); } catch { continue; }
          const chave = 'ag:' + proj.name + '/' + e.name.toLowerCase(); const ent = cache.arquivos[chave] || (cache.arquivos[chave] = { m: 0, n: [], b: {} });
          if (ent.m === sd.mtimeMs) continue;
          const vistos = new Set(ent.n), conversa = e.name.toLowerCase();
          for (const a of listar(sub)) {
            const m = /^agent-([0-9a-z]{6,40})\.jsonl$/i.exec(a.name); if (!a.isFile() || !m || vistos.has(m[1])) continue;
            const st = stat(path.join(sub, a.name)); if (!st) continue;
            const criado = st.birthtimeMs > 0 ? Math.min(st.birthtimeMs, st.mtimeMs) : st.mtimeMs; // hora de criacao, so metadado
            somar(ent, 'cc:' + conversa, 'aj:cc:' + conversa, 'ajudante', criado); vistos.add(m[1]); ent.n.push(m[1]); conta.ajudante++;
          }
          ent.m = sd.mtimeMs;
        }
      }
    }
    for (const { p, id } of rolloutsCodex(cfg.codexRoots)) {
      const chave = 'cx:' + id, e = cache.arquivos[chave];
      if (e && e.x && e.x !== 'grande') continue; // classe pelo cabecalho nao muda
      const st = stat(p); if (!st) continue;
      if (!e) {
        let cab; try { cab = (await cabeca(p, 9000)).toString('utf8').split('\n')[0]; } catch { continue; }
        const sub = /"source":\{"subagent"/.test(cab), src = (cab.match(/"source":"([^"]*)"/) || [])[1] || '';
        const tsrc = (cab.match(/"thread_source":"([^"]*)"/) || [])[1] || '';
        if (sub) {
          const pai = (cab.match(/"parent_thread_id":"([0-9a-f-]{36})"/) || [])[1];
          const ent = cache.arquivos[chave] = { x: tsrc === 'subagent' && pai ? 'subagente' : 'guardiao', b: {} };
          if (ent.x === 'subagente') {
            cache.pais[id] = pai.toLowerCase();
            const ts = Date.parse((cab.match(/"timestamp":"([^"]+)"/) || [])[1] || '') || st.birthtimeMs || st.mtimeMs;
            somar(ent, 'cx:' + pai.toLowerCase(), 'aj:cx:' + pai.toLowerCase(), 'ajudante', ts); conta.ajudante++;
          }
          continue;
        }
        if (src === 'exec') { cache.arquivos[chave] = { x: 'exec', b: {} }; continue; }
        if (src === 'vscode' && !tsrc) { cache.arquivos[chave] = { x: 'importada', b: {} }; continue; }
        if (tsrc === 'agent_created_thread') { cache.arquivos[chave] = { x: 'criada-por-agente', b: {} }; continue; }
      }
      await jsonl(chave, p, st, (ent, linha) => linhaCodex(cache, chave, ent, id, linha, conta), conta);
    }
    for (const [chave, nome, fn] of [['md:fila', 'fila-codex.md', 'fila'], ['md:codex', 'codex.md', 'paraCoordenador']]) {
      const file = path.join(cfg.estadoRoot, 'estado', nome), st = stat(file); if (!st) continue;
      const e = cache.arquivos[chave];
      if (e && e.t === st.size && e.m === st.mtimeMs && e.pv === VERSAO_MD) continue;
      if (st.size > cfg.maxBytes) { anotarPulado(chave, 'maior que 300 MB', st.size); continue; }
      const texto = (await fsp.readFile(file, 'utf8')).replace(/^\uFEFF/, '');
      const ent = { t: st.size, m: st.mtimeMs, pv: VERSAO_MD, b: {} };
      if (fn === 'fila') { const r = itensDaFila(texto, st.mtimeMs); for (const it of r.itens) somar(ent, 'box:' + it.de, 'box:codex', 'fila', it.ms); conta.fila = r.itens.length; conta.filaSemHora = r.semHora + r.semData; ent.semHora = r.semHora + r.semData; }
      else { const r = etiquetasParaCoordenador(texto); for (const it of r.itens) somar(ent, 'box:codex', 'box:' + it.para, 'para-coordenador', it.ms); conta.paraCoordenador = r.itens.length; ent.semHora = r.semHora; }
      cache.arquivos[chave] = ent;
    }
    cache.lidoEm = new Date().toISOString();
    gravar();
    nomes = null; // o mapa de nomes e refeito na proxima janela
    return { ms: Date.now() - t0, ...conta };
  }

  // ---------- nomes dos nos (refeito no maximo a cada 60 s) ----------
  function mapaDeNomes() {
    if (nomes && Date.now() - nomesEm < 60000) return nomes;
    const localParaCaixa = new Map(), cliParaLocal = new Map(), cliCaixaApp = new Map();
    try {
      const j = JSON.parse(fs.readFileSync(path.join(cfg.estadoRoot, 'estado', 'sessoes-claude.json'), 'utf8').replace(/^\uFEFF/, ''));
      for (const v of Object.values(j || {})) if (Array.isArray(v)) for (const it of v) if (it && LOCAL.test(String(it.sessionId || ''))) { const cx = caixaDoNome(it.titulo); if (cx && !localParaCaixa.has(it.sessionId.toLowerCase())) localParaCaixa.set(it.sessionId.toLowerCase(), cx); }
    } catch { /* sem a lista: tudo vira "outras" */ }
    for (const conta of listar(cfg.appRoot)) if (conta.isDirectory()) for (const org of listar(path.join(cfg.appRoot, conta.name))) if (org.isDirectory()) {
      const dir = path.join(cfg.appRoot, conta.name, org.name);
      for (const f of listar(dir)) {
        if (!f.isFile() || !/^local_.*\.json$/.test(f.name) || !LOCAL.test(f.name.slice(0, -5))) continue;
        const st = stat(path.join(dir, f.name)); if (!st || st.size > 1048576) continue;
        try { const d = JSON.parse(fs.readFileSync(path.join(dir, f.name), 'utf8')); const cli = String(d.cliSessionId || '').toLowerCase(); if (UUID.test(cli)) { cliParaLocal.set(cli, f.name.slice(0, -5).toLowerCase()); const cx = caixaDoNome(d.title); if (cx) cliCaixaApp.set(cli, cx); } } catch { /* ilegivel */ }
      }
    }
    const nomeCodex = new Map();
    try { for (const l of fs.readFileSync(cfg.codexIndex, 'utf8').split('\n')) { if (!l) continue; try { const o = JSON.parse(l); if (o && o.id) nomeCodex.set(String(o.id).toLowerCase(), o.thread_name); } catch { } } } catch { }
    nomes = { localParaCaixa, cliParaLocal, cliCaixaApp, nomeCodex }; nomesEm = Date.now();
    return nomes;
  }
  function resolver(bruto, n, rotulos) {
    if (bruto === 'voce') return { id: 'voce' };
    if (bruto.startsWith('box:')) return { id: bruto.slice(4) };
    if (bruto.startsWith('aj:')) { const dono = resolver(bruto.slice(3), n, rotulos); return { id: 'ajudantes:' + dono.id, de: dono }; }
    if (bruto.startsWith('local:')) return { id: n.localParaCaixa.get(bruto.slice(6)) || 'claude:outras' };
    if (bruto.startsWith('cc:')) { const cli = bruto.slice(3), loc = n.cliParaLocal.get(cli); return { id: (loc && n.localParaCaixa.get(loc)) || n.cliCaixaApp.get(cli) || 'claude:outras' }; }
    if (bruto.startsWith('cx:')) {
      let id = bruto.slice(3); const visto = new Set();
      while (cache.pais[id] && !visto.has(id)) { visto.add(id); id = cache.pais[id]; } // subagente de subagente: sobe ate a conversa
      const ent = cache.arquivos['cx:' + id];
      if (ent && ent.x === 'exec') return { id: 'codex' };
      const bruto2 = n.nomeCodex.get(id);
      if (/^coordenador\b/i.test(String(bruto2 || ''))) return { id: 'coordenador-codex' };
      const rot = rotulos ? (rotulos instanceof Map ? rotulos.get(id) : rotulos[id]) : undefined;
      return { id: 'codex:' + id.slice(0, 8), nome: rotulos ? (rot ? nomeDaConversaCodex(rot) : null) : nomeDaConversaCodex(bruto2) };
    }
    return { id: 'claude:outras' };
  }

  // ---------- janela ----------
  function janela(nome, op = {}) {
    if (!Object.prototype.hasOwnProperty.call(JANELAS, nome)) throw new Error('janela desconhecida: ' + nome + ' (use ' + Object.keys(JANELAS).join(', ') + ')');
    carregar();
    const agora = op.agora || Date.now(), dur = JANELAS[nome];
    const horaIni = dur === Infinity ? -Infinity : Math.floor((agora - dur) / H); // balde que cruza o comeco da janela entra inteiro
    const n = mapaDeNomes(), maxCodex = op.maxConversasCodex === undefined ? 8 : op.maxConversasCodex;
    const res = new Map(), nomeDe = new Map(), ligs = new Map();
    let primeira = Infinity, ultima = -Infinity;
    const r = b => { let v = res.get(b); if (!v) { v = resolver(b, n, op.rotulosCodex); res.set(b, v); if (v.nome && !nomeDe.has(v.id)) nomeDe.set(v.id, v.nome); } return v; };
    for (const e of Object.values(cache.arquivos)) for (const [k, horas] of Object.entries(e.b || {})) {
      const [de, para, tipo] = k.split('|');
      let soma = 0;
      for (const [h, q] of Object.entries(horas)) { const hh = +h; if (hh < primeira) primeira = hh; if (hh > ultima) ultima = hh; if (hh >= horaIni && hh * H <= agora) soma += q; }
      if (!soma) continue;
      const a = r(de).id, b = r(para).id; if (a === b) continue; // conversa da mesma caixa falando com ela mesma nao vira fio
      const kk = a + '|' + b + '|' + tipo; ligs.set(kk, (ligs.get(kk) || 0) + soma);
    }
    // conversas do Codex alem das N maiores viram "codex:outras" (o mapa continua legivel em mes e total)
    if (maxCodex > 0) {
      const tot = new Map(); for (const [k, q] of ligs) for (const id of k.split('|').slice(0, 2)) { const base = id.replace(/^ajudantes:/, ''); if (base.startsWith('codex:')) tot.set(base, (tot.get(base) || 0) + q); }
      const ficam = new Set([...tot.entries()].sort((x, y) => y[1] - x[1]).slice(0, maxCodex).map(x => x[0]));
      const troca = id => { const aj = id.startsWith('ajudantes:'), base = aj ? id.slice(10) : id; return base.startsWith('codex:') && !ficam.has(base) ? (aj ? 'ajudantes:codex:outras' : 'codex:outras') : id; };
      const novo = new Map(); for (const [k, q] of ligs) { const [a, b, t] = k.split('|'); const a2 = troca(a), b2 = troca(b); if (a2 === b2) continue; const kk = a2 + '|' + b2 + '|' + t; novo.set(kk, (novo.get(kk) || 0) + q); }
      ligs.clear(); for (const [k, q] of novo) ligs.set(k, q);
    }
    const nos = new Map(), nomeNo = id => {
      if (id.startsWith('ajudantes:')) return 'Ajudantes de ' + nomeNo(id.slice(10));
      return NOMES_FIXOS[id] || nomeDe.get(id) || (id.startsWith('codex:') ? 'Conversa do Codex' : id);
    };
    const ligacoes = [];
    for (const [k, q] of ligs) {
      const [de, para, tipo] = k.split('|'); ligacoes.push({ de, para, tipo, n: q });
      for (const id of [de, para]) { const no = nos.get(id) || { id, nome: nomeNo(id), lado: ladoDe(id), total: 0 }; no.total += q; nos.set(id, no); }
    }
    ligacoes.sort((x, y) => y.n - x.n);
    const lido = Boolean(cache.lidoEm), historicoDesde = primeira === Infinity ? null : new Date(primeira * H).toISOString();
    const desde = dur === Infinity ? historicoDesde : new Date(horaIni * H).toISOString();
    const pulados = Object.values(cache.pulados);
    return {
      janela: nome, lido, lidoEm: cache.lidoEm, desde, ate: new Date(agora).toISOString(),
      historicoDesde, historicoAte: ultima === -Infinity ? null : new Date((ultima + 1) * H).toISOString(),
      // janela maior que o historico: a tela diz "o historico comeca em X", nunca zero inventado antes disso
      cobreJanela: lido && historicoDesde !== null && (dur === Infinity || primeira <= horaIni),
      nos: [...nos.values()].sort((x, y) => y.total - x.total), ligacoes,
      pulados: pulados.length ? { arquivos: pulados.length, mb: pulados.reduce((s, p) => s + p.mb, 0) } : null,
    };
  }
  return { atualizar, janela, carregar: () => carregar(), _cache: () => cache };
}

module.exports = { criarHistorico, JANELAS, itensDaFila, etiquetasParaCoordenador, caixaDoNome };

/* COMO O SERVIDOR CHAMA (servidor.cjs do painel):
   const { criarHistorico } = require('./historico-fluxo.cjs');
   const hist = criarHistorico({ claudeRoot, estadoRoot: root, cacheFile: require('./so-leitura.cjs').cacheLocal('cache-fluxo.json') });
   // cache fora de pasta com git (tem id de conversa e hora, nenhum texto); apagar o arquivo = a proxima leitura e completa
   let lendo = null, lidoEm = 0;
   function historicoEmDia() { // recalculo no maximo a cada 60 s; leitura incremental (< 1 s), uma por vez, fora do pedido
     if (!lendo && Date.now() - lidoEm > 60000) lendo = hist.atualizar().catch(() => null).finally(() => { lendo = null; lidoEm = Date.now(); });
   }
   // 1 rota: GET /api/fluxo-historico?janela=24h -> 200 hist.janela(janela, { rotulosCodex }) (janela fora da lista = 400)
   //   rotulosCodex = Map threadId -> nome aprovado das commandSessions do snapshot (so rotulo aprovado vai a tela).
   //   Ou 1 campo no /api/estado: snapshot.fluxoHistorico = { '2h': hist.janela('2h'), ... } (cada janela ~50 ms; as 7 juntas ~350 ms: guardar o resultado junto com a leitura de 60 s).
*/
