'use strict';
// PULSO ACELERAR. Botao "Acelerar" do Fluxo: 1 linha JSON no fim de estado/pulsos-acelerar.jsonl, dentro da pasta de estado do painel.
// Sua IA le as linhas sem resposta com node ler-pulsos.cjs e responde em estado/pulsos-acelerar-respostas.jsonl ({id, hora, texto, cards}).
// Rotas (tudo local, so 127.0.0.1):
//   GET  /api/pulso-acelerar                          -> aceita (o painel grava?), token, ultimos por projeto (com as respostas), segundos para o proximo pulso
//                                                        quando nao aceita: so id, hora, projeto e a contagem de respostas, sem token; no ?exemplo=1: vazio e sem token
//   POST /api/pulso-acelerar {projeto}                -> grava o pulso (painel deste computador, nunca na copia so leitura, 1 por projeto a cada 2 min)
//   GET|POST /api/pulso-acelerar/cards/<projeto|todos>/lista|responder|passo|miniatura/<arq>
//                                                      -> o MESMO caminho de resposta dos cards, com a lista do projeto
//   GET  /fusao-fluxo.js e /fusao-fluxo.css           -> a tela da fusao do Fluxo
// O navegador so manda o id do projeto: nenhum texto livre vira ordem (o comando sai de projeto-de.cjs).
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const PD = require('./projeto-de.cjs'), SIGILO = require('./sigilo-pessoas.cjs');

const INTERVALO_MS = 120000, VALE_MS = 3600000, SEM_RESPOSTA_MS = 15 * 60000, TRAVA_VELHA_MS = 10000, CORPO_MAX = 2048;
const ARQ = 'pulsos-acelerar.jsonl', ARQ_RESP = 'pulsos-acelerar-respostas.jsonl';
const FORMATO_O = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{2}:\d{2}$/;
const ID_CARD = /^[\w.-]{1,120}$/;
const ID_PULSO = /^P-[A-Za-z0-9-]{1,40}$/;
// linha da resposta com credencial vira neutra (o filtro de credencial do entregas-rota.cjs; nome de pessoa o send do servidor ja mascara)
const NEUTRA = 'Detalhe só no chat do seu Claude';
const ENDERECO = /\b0x[0-9a-fA-F]{40}\b/, HEX64 = /\b[0-9a-fA-F]{64}\b/;
const URL_CHAVE = /[?&#;](?:api[-_]?key|apikey|key|token|access[-_]?token|secret|senha|password|auth)=/i;
const CHAVE_SOLTA = /\bsk-[A-Za-z0-9_-]{8,}|\bghp_[A-Za-z0-9]{20,}|\bAKIA[0-9A-Z]{16}\b|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\./;
const SEGREDO = /\b(?:token|senha|password|secret|api[-_ ]?key|private key|chave privada|seed|mnemonic)\b\s*[:=]\s*\S{4,}|\bBearer\s+\S{8,}/i;
const BOT_TG = /\b\d{6,12}:[A-Za-z0-9_-]{30,}/; // token de bot do Telegram (numero:codigo); o codigo tem _ e - que quebram o pedaco base58
const base58 = v => v.split(/[^1-9A-HJ-NP-Za-km-z]+/).some(t => t.length >= 32 && t.length <= 90 && /\d/.test(t) && /[A-Z]/.test(t) && /[a-z]/.test(t)); // 32 a 44 = endereco; ate 90 = chave secreta (a da Solana tem 87 a 88)
const credencial = v => ENDERECO.test(v) || HEX64.test(v) || URL_CHAVE.test(v) || CHAVE_SOLTA.test(v) || SEGREDO.test(v) || BOT_TG.test(v) || base58(v);
const ASSETS = { '/fusao-fluxo.js': ['fusao-fluxo.js', 'text/javascript'], '/fusao-fluxo.css': ['fusao-fluxo.css', 'text/css'] };
const espera = ms => new Promise(r => setTimeout(r, ms));

// o que o pulso pede: Todos = "ACELERAR Todos"; projeto = "ACELERAR <nome>" com o nome que o leitor do painel deu ao projeto
function alvo(id) {
  if (id === 'todos') return { projeto: 'todos', sessao: 'coordenador', comando: 'ACELERAR Todos' };
  const p = PD.PROJETOS.find(x => x.id === id);
  return p ? { projeto: p.id, sessao: p.dono || 'coordenador', comando: 'ACELERAR ' + p.nome } : null;
}
// o projeto de um card: a mesma regra do Agora (projeto-global.js, PainelProjetoGlobal.projetoDe com {sessao, titulo: pergunta})
function projetoDoCard({ sessao, pergunta } = {}) {
  const s = String(sessao || '').toUpperCase();
  if (PD.SESSAO[s]) return PD.SESSAO[s];
  return PD.porTitulo(pergunta) || 'outros';
}

// linhas JSON do fim do arquivo (quebrada ou cortada e ignorada)
function lerLinhas(file, maxBytes = 512 * 1024) {
  try {
    const st = fs.lstatSync(file);
    if (!st.isFile() || st.isSymbolicLink()) return [];
    const fd = fs.openSync(file, 'r');
    try {
      const n = Math.min(st.size, maxBytes), buf = Buffer.alloc(n);
      fs.readSync(fd, buf, 0, n, st.size - n);
      let txt = buf.toString('utf8');
      if (st.size > n) txt = txt.slice(txt.indexOf('\n') + 1);
      const out = [];
      for (const l of txt.split('\n')) { if (!l.trim()) continue; try { const j = JSON.parse(l); if (j && typeof j === 'object' && !Array.isArray(j)) out.push(j); } catch { /* linha quebrada */ } }
      return out;
    } finally { fs.closeSync(fd); }
  } catch { return []; }
}
const limpo = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);

function criar({ root, port, hora, agora } = {}) {
  const estadoDir = path.join(root, 'estado'), arquivo = path.join(estadoDir, ARQ), respostas = path.join(estadoDir, ARQ_RESP), trava = arquivo + '.lock';
  const relogio = typeof agora === 'function' ? agora : Date.now;
  const horaGetDate = typeof hora === 'function' ? hora : () => require('./pc-cards/cards-nucleo.cjs').horaGetDate();
  const token = crypto.randomBytes(24).toString('hex');
  const hosts = new Set(['127.0.0.1:' + port, 'localhost:' + port]), origens = new Set(['http://127.0.0.1:' + port, 'http://localhost:' + port]);

  // ---------- leitura ----------
  const pulsos = () => lerLinhas(arquivo).filter(p => p && typeof p.id === 'string' && ID_PULSO.test(p.id) && typeof p.projeto === 'string' && typeof p.hora === 'string' && alvo(p.projeto));
  const msDe = h => Date.parse(h);
  function respostasDe(p) {
    const out = []; const cards = [];
    for (const r of lerLinhas(respostas)) {
      if (r.id !== p.id) continue;
      out.push({ hora: limpo(r.hora, 40), linhas: String(r.texto == null ? '' : r.texto).split(/\r?\n/).map(l => limpo(l, 4000)).filter(Boolean).slice(0, 6).map(l => (credencial(l) ? NEUTRA : l.slice(0, 400))) });
      for (const c of Array.isArray(r.cards) ? r.cards : []) if (typeof c === 'string' && ID_CARD.test(c) && !/^\.+$/.test(c) && !cards.includes(c) && cards.length < 10) cards.push(c);
    }
    return { respostas: out, cards };
  }
  function estado(pode = true, soLeitura = false) {
    const now = relogio(), ultimo = new Map(), ultimos = {}, restaS = {};
    for (const p of pulsos()) ultimo.set(p.projeto, p);
    for (const [proj, p] of ultimo) {
      const t = Math.floor(msDe(p.hora) / 1000) * 1000; if (!Number.isFinite(t)) continue; // a hora do Get-Date vale ao segundo
      const falta = Math.ceil((INTERVALO_MS - Math.max(now - t, 0)) / 1000);
      if (falta > 0) restaS[proj] = Math.min(falta, INTERVALO_MS / 1000);
      if (now - t > VALE_MS) continue;
      const r = respostasDe(p), semResposta = !r.respostas.length && now - t > SEM_RESPOSTA_MS;
      if (!pode) { ultimos[proj] = { id: p.id, hora: limpo(p.hora, 40), projeto: p.projeto, nRespostas: r.respostas.length }; continue; } // quando nao aceita: so id, hora e contagem
      ultimos[proj] = { id: p.id, hora: p.hora, projeto: p.projeto, sessao: limpo(p.sessao, 40), comando: limpo(p.comando, 80), respostas: r.respostas, cards: r.cards, esperandoResposta: !r.respostas.length && !semResposta, semResposta };
    }
    return pode && !soLeitura ? { ok: true, aceita: true, token, intervaloS: INTERVALO_MS / 1000, ultimos, restaS } : { ok: true, aceita: false, intervaloS: INTERVALO_MS / 1000, ultimos, restaS };
  }
  // ids de card citados nas respostas aos pulsos do projeto (ultima hora)
  function citados(proj) {
    const now = relogio(), set = new Set();
    for (const p of pulsos()) { if (p.projeto !== proj) continue; const t = msDe(p.hora); if (Number.isFinite(t) && now - t <= VALE_MS) for (const c of respostasDe(p).cards) set.add(c); }
    return set;
  }

  // ---------- gravacao (1 linha inteira por vez, trava curta) ----------
  async function comTrava(fn) {
    fs.mkdirSync(estadoDir, { recursive: true });
    let fd = null;
    for (let i = 0; i < 100 && fd === null; i++) {
      try { fd = fs.openSync(trava, 'wx'); } catch (e) {
        if (!e || e.code !== 'EEXIST') throw e;
        try { const st = fs.statSync(trava); if (Date.now() - st.mtimeMs > TRAVA_VELHA_MS) { const de = fs.statSync(trava); if (de.mtimeMs === st.mtimeMs && de.ino === st.ino) fs.unlinkSync(trava); continue; } } catch { continue; }
        await espera(20);
      }
    }
    if (fd === null) throw Object.assign(new Error('trava'), { codigo: 'ocupado' });
    try { return fn(); } finally { try { fs.closeSync(fd); } catch { /* fechada */ } try { fs.unlinkSync(trava); } catch { /* ja saiu */ } }
  }
  async function pulsar(proj) {
    const a = alvo(proj), h = await horaGetDate();
    if (typeof h !== 'string' || !FORMATO_O.test(h)) throw Object.assign(new Error('hora'), { codigo: 'hora' });
    const t = msDe(h);
    return comTrava(() => {
      const ult = pulsos().filter(p => p.projeto === proj).pop(), tu = ult ? msDe(ult.hora) : NaN;
      if (Number.isFinite(tu) && t - tu < INTERVALO_MS) return { status: 200, corpo: { ok: false, erro: 'espera', restaS: Math.min(Math.ceil((INTERVALO_MS - Math.max(t - tu, 0)) / 1000), INTERVALO_MS / 1000) } };
      let texto = ''; try { const st = fs.lstatSync(arquivo); if (st.isSymbolicLink() || !st.isFile()) throw Error('arquivo'); texto = fs.readFileSync(arquivo, 'utf8'); } catch (e) { if (!e || e.code !== 'ENOENT') throw e; }
      let id; do { id = 'P-' + h.slice(0, 19).replace(/\D/g, '') + '-' + Array.from({ length: 4 }, () => String.fromCharCode(65 + crypto.randomInt(26))).join(''); } while (texto.includes('"' + id + '"'));
      const linha = { id, hora: h, projeto: a.projeto, sessao: a.sessao, comando: a.comando };
      fs.appendFileSync(arquivo, (texto && !texto.endsWith('\n') ? '\n' : '') + JSON.stringify(linha) + '\n', 'utf8');
      return { status: 200, corpo: { ok: true, horaTexto: h.slice(11, 16), pulso: linha } };
    });
  }

  // ---------- pedido ----------
  function lerCorpo(req) {
    return new Promise(resolve => {
      const partes = []; let tam = 0, grande = false;
      req.on('data', c => { tam += c.length; if (tam > CORPO_MAX) { grande = true; partes.length = 0; if (tam > 64 * 1024) req.destroy(); } else if (!grande) partes.push(c); });
      req.on('end', () => resolve(grande ? { grande: true } : { texto: Buffer.concat(partes).toString('utf8') }));
      req.on('error', () => resolve({ grande: true }));
    });
  }
  const ctJson = req => String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() === 'application/json';
  const tokenOk = req => { const t = req.headers['x-pulso-token']; if (typeof t !== 'string' || t.length !== token.length) return false; return crypto.timingSafeEqual(Buffer.from(t), Buffer.from(token)); };
  async function postPulso(req, send, { dono, friendMode, soLeitura }) {
    if (soLeitura) return send(403, { ok: false, erro: 'so-leitura' });
    if (!(dono === true || friendMode === true)) return send(403, { ok: false, erro: 'nao-aceita' });
    if (!origens.has(req.headers.origin)) return send(403, { ok: false, erro: 'origem' });
    if (req.headers['sec-fetch-site'] !== 'same-origin') return send(403, { ok: false, erro: 'origem' });
    if (!ctJson(req)) return send(403, { ok: false, erro: 'tipo' });
    if (!tokenOk(req)) return send(403, { ok: false, erro: 'token' });
    const c = await lerCorpo(req);
    if (c.grande) return send(413, { ok: false, erro: 'grande' });
    let j; try { j = JSON.parse(c.texto); } catch { return send(400, { ok: false, erro: 'json' }); }
    if (!j || typeof j !== 'object' || Array.isArray(j) || Object.keys(j).join() !== 'projeto' || typeof j.projeto !== 'string' || !alvo(j.projeto)) return send(400, { ok: false, erro: 'projeto' });
    try { const r = await pulsar(j.projeto); return send(r.status, r.corpo); } catch (e) { return send(e && e.codigo === 'ocupado' ? 409 : 500, { ok: false, erro: e && e.codigo ? e.codigo : 'gravar' }); }
  }

  // ---------- cards: o mesmo caminho de resposta do pc-cards ----------
  function chamarCards(cards, metodo, url, req, dono, res) {
    return new Promise(resolve => {
      const falsoReq = { method: metodo, url, headers: { host: req.headers.host, origin: req.headers.origin } };
      let status = 200; const partes = [];
      const falsoRes = {
        writeHead(s) { status = s; return this; }, setHeader() {}, getHeader() { return undefined; },
        write(c) { partes.push(Buffer.from(c)); return true; },
        end(c) { if (c != null) partes.push(Buffer.from(c)); resolve({ status, corpo: Buffer.concat(partes) }); }
      };
      const tratou = SIGILO.rodarComo(dono === true, () => cards.handle(falsoReq, res || falsoRes));
      if (!tratou) resolve(null); else if (res) resolve({ direto: true });
    });
  }
  async function listaCards(req, send, cards, proj, ctxDono) {
    const r = await chamarCards(cards, 'GET', '/api/pc-cards/lista', req, ctxDono);
    let j = null; try { j = r && JSON.parse(r.corpo.toString('utf8')); } catch { j = null; }
    if (!r || !j) return send(503, { ok: false, mensagem: 'Não consegui ler os cards agora.' });
    if (r.status !== 200) return send(r.status, j);
    if (proj !== 'todos') {
      const cit = citados(proj), casa = c => projetoDoCard({ sessao: c.sessao, pergunta: c.pergunta }) === proj || cit.has(String(c.arquivo || '').replace(/\.json$/i, ''));
      for (const k of ['pendentes', 'esperando', 'respondidos']) if (Array.isArray(j[k])) j[k] = j[k].filter(casa);
    }
    return send(200, { ...j, projeto: proj });
  }
  async function rotaCards(req, url, ctx) {
    const { send, res, cards, soLeitura } = ctx;
    const m = /^\/api\/pulso-acelerar\/cards\/([^/]+)\/(lista|responder|passo|miniatura\/.+)$/.exec(url.pathname);
    if (!m || !(m[1] === 'todos' || PD.PROJETOS.some(p => p.id === m[1]))) return send(404, { ok: false });
    if (ctx.example === true) return m[2] === 'lista' && req.method === 'GET' ? send(200, { ok: true, example: true, projeto: m[1], pendentes: [], esperando: [], respondidos: [] }) : send(403, { ok: false, erro: 'exemplo' }); // o exemplo nao le nem grava card
    if (!cards) return send(503, { ok: false, mensagem: 'Os cards não estão ligados nesta cópia.' });
    const sub = m[2];
    if (sub === 'lista') { if (req.method !== 'GET') return send(405, { ok: false }); return listaCards(req, send, cards, m[1], ctx.dono); }
    if (sub.startsWith('miniatura/')) { if (req.method !== 'GET') return send(405, { ok: false }); req.url = '/api/pc-cards/' + sub; SIGILO.rodarComo(ctx.dono === true, () => cards.handle(req, res)); return; }
    if (req.method !== 'POST') return send(405, { ok: false });
    if (soLeitura) return send(403, { ok: false, erro: 'so-leitura' });
    req.url = '/api/pc-cards/' + sub;
    SIGILO.rodarComo(ctx.dono === true, () => cards.handle(req, SIGILO.guardarResposta(res, ctx.dono === true)));
  }

  // ---------- porta de entrada ----------
  function handle(req, url, ctx0 = {}) {
    const p = url.pathname, send = ctx0.send, example = ctx0.example === true;
    const ctx = example ? { ...ctx0, dono: false, friendMode: false } : ctx0; // o exemplo nunca grava
    if (Object.hasOwn(ASSETS, p) && req.method === 'GET') {
      const [file, tipo] = ASSETS[p];
      let bytes; try { bytes = fs.readFileSync(path.join(__dirname, file)); } catch { send(404, { ok: false, error: 'Arquivo ausente' }); return true; }
      send(200, bytes, tipo); return true;
    }
    if (p !== '/api/pulso-acelerar' && !p.startsWith('/api/pulso-acelerar/')) return false;
    if (!hosts.has(req.headers.host)) { send(403, { ok: false, erro: 'so local' }); return true; }
    const falha = () => { try { send(500, { ok: false, erro: 'gravar' }); } catch { /* resposta ja saiu */ } };
    if (p === '/api/pulso-acelerar') {
      if (example) { if (req.method === 'GET') send(200, { ok: true, example: true, intervaloS: INTERVALO_MS / 1000, ultimos: {}, restaS: {} }); else if (req.method === 'POST') send(403, { ok: false, erro: 'exemplo' }); else send(405, { ok: false }); return true; }
      if (req.method === 'GET') { send(200, estado(ctx.dono === true || ctx.friendMode === true, ctx.soLeitura === true)); return true; }
      if (req.method === 'POST') { postPulso(req, send, ctx).catch(falha); return true; }
      send(405, { ok: false }); return true;
    }
    rotaCards(req, url, ctx).catch(falha);
    return true;
  }
  return { handle, estado, alvo, projetoDoCard };
}

// o servidor.cjs chama so isto: a instancia vive por root+porta
const instancias = new Map();
function handle(req, url, ctx = {}) {
  const chave = String(ctx.root) + '|' + String(ctx.port);
  let R = instancias.get(chave);
  if (!R) { R = criar({ root: ctx.root, port: ctx.port }); instancias.set(chave, R); }
  return R.handle(req, url, ctx);
}
module.exports = { criar, alvo, projetoDoCard, handle, ASSETS };
