'use strict';
// Rotas do modulo ACELERAR (PD). O integrador monta assim, no servidor do painel:
//   const acel = require('<esta pasta>/acelerador-rotas.cjs').criarRotasAcelerador({ porta, arquivo, recados });
//   ... no handler, antes do 404:  if (acel.handle(req, res)) return;
//   arquivo = o json do modulo (padrao dados/acelerador.json desta pasta; nunca dentro do estado).
//   recados = caminho do estado/recados-do-painel.md (so o painel do dono passa; sem ele, ou no modo publico, a marcha
//             fica so no json). E a unica escrita fora do json: 1 linha por troca de marcha, no formato do painel.
// Rotas (prefixo padrao /api/acelerador; op.prefixo troca):
//   GET  /api/acelerador            modo, marcha escolhida, fases ligadas com a data, ganhos medidos (dono), marcas, minutos, token
//                                   e, so no dono, a marcha VIVA: as voltas de 15 min do ROTINA lidas do estado ao lado do
//                                   recados (marcha-viva.cjs, so leitura): ligada ou nao, ultima e proxima volta, minutos ganhos hoje e 7 dias
//   POST /api/acelerador/marcha     { marcha: 1..5 }       guarda a marcha; no dono com recados, 1 linha "| OS DOIS | marcha N: <nome>"
//   POST /api/acelerador/ligar      { fase }               liga so a proxima fase (sem pular)
//   POST /api/acelerador/minutos    { minutos: 5|15|30 }   soma uma espera medida pela pessoa (precisa de 1 fase ligada)
//   POST /api/acelerador/desfazer   { fase } ou { marca }  desfaz so o ultimo clique; fase semeada do dono nunca sai
//   GET  /acelerador/acelerador.js e /acelerador/acelerador.css
// Hora de cada clique pelo Get-Date (op.hora troca, para teste). Arquivo sem json = modo publico comecando em 0.
// Clique so da propria pagina: Host e Origin locais da porta, Sec-Fetch-Site same-origin, JSON e token por processo.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const L = require('./acelerador.js');
const VIVA = require('./marcha-viva.cjs');

const DATA = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/;
const FORMATO_O = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{2}:\d{2}$/;
const LINGUAS = ['pt', 'en', 'es'];
const RECADOS_MAX = 2 * 1024 * 1024; // o mesmo teto do PB
const MENSAGEM = {
  'fora-de-ordem': 'Ligue a fase anterior primeiro.',
  'ja-ligada': 'Esta fase já estava ligada.',
  'nao-desfaz': 'Só dá para desfazer o último clique.',
  'sem-fase': 'Ligue uma fase antes de somar minutos.',
  hora: 'Não consegui marcar a hora. Tente de novo.',
  invalido: 'Pedido inválido.',
  grande: 'Pedido grande demais.',
  ilegivel: 'O arquivo das fases está ilegível. Nada foi gravado.',
  gravar: 'Não consegui gravar. Tente de novo.',
  origem: 'Clique só vale de dentro do painel.'
};
function erro(codigo) { const e = Error(codigo); e.codigo = codigo; return e; }
function limpar(v, max) { return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : ''; }
function tres(v, max = 300) {
  if (!v || typeof v !== 'object') return null;
  const o = {};
  for (const l of LINGUAS) { const t = limpar(v[l], max); if (!t) return null; o[l] = t; }
  return o;
}

// O disco vence: todo clique rele o arquivo, normaliza e so entao grava. Fase fora de ordem (com buraco antes) nao conta.
function normalizar(cru) {
  const base = cru && typeof cru === 'object' && !Array.isArray(cru) ? cru : {};
  const modo = base.modo === 'dono' ? 'dono' : 'publico';
  const dono = modo === 'dono';
  const fasesCru = base.fases && typeof base.fases === 'object' ? base.fases : {};
  const fases = {};
  for (let i = 1; i <= L.TOTAL; i++) {
    const f = fasesCru[String(i)];
    if (!f || typeof f !== 'object' || typeof f.em !== 'string' || !DATA.test(f.em)) break;
    fases[String(i)] = f.semente === true ? { em: f.em, semente: true } : { em: f.em };
  }
  const ganhos = {};
  if (dono && base.ganhos && typeof base.ganhos === 'object') {
    for (const id of Object.keys(fases)) { const g = tres(base.ganhos[id]); if (g) ganhos[id] = g; }
  }
  let medido = null;
  if (dono && base.medido && Array.isArray(base.medido.itens)) {
    const itens = base.medido.itens
      .map(it => ({ fase: it && it.fase, minutos: it && it.minutos, texto: tres(it && it.texto) }))
      .filter(it => Number.isInteger(it.fase) && fases[String(it.fase)] && Number.isInteger(it.minutos) && it.minutos > 0 && it.minutos <= 100000 && it.texto)
      .slice(0, L.TOTAL);
    if (itens.length) medido = { itens, fonte: tres(base.medido.fonte), nota: tres(base.medido.nota), arquivo: limpar(base.medido.arquivo, 200) || null };
  }
  const marcas = (Array.isArray(base.marcas) ? base.marcas : [])
    .filter(m => m && typeof m.id === 'string' && /^[a-f0-9]{8}$/.test(m.id) && L.SOMAS.includes(m.minutos) && typeof m.em === 'string' && DATA.test(m.em))
    .slice(-500)
    .map(m => ({ id: m.id, minutos: m.minutos, em: m.em }));
  const mc = base.marcha;
  const marcha = mc && typeof mc === 'object' && (L.marchaValida(mc.n) || (dono && mc.n === L.ROTINA)) && typeof mc.em === 'string' && DATA.test(mc.em)
    ? (mc.semente === true ? { n: mc.n, em: mc.em, semente: true } : { n: mc.n, em: mc.em }) : null;
  const marchasTexto = {};
  if (dono && base.marchasTexto && typeof base.marchasTexto === 'object') {
    for (const n of L.MARCHAS) { const t = tres(base.marchasTexto[String(n)], 200); if (t) marchasTexto[String(n)] = t; }
  }
  const nuncaCorta = dono ? tres(base.nuncaCorta, 200) : null;
  return { versao: 1, modo, marcha, fases, ganhos, medido, marcas, marchasTexto, nuncaCorta };
}
function ler(arquivo) {
  let texto;
  try { texto = fs.readFileSync(arquivo, 'utf8'); } catch (e) { if (e && e.code === 'ENOENT') return normalizar(null); throw erro('ilegivel'); }
  let cru;
  try { cru = JSON.parse(texto.replace(/^﻿/, '')); } catch { throw erro('ilegivel'); }
  return normalizar(cru);
}
// Troca atomica (arquivo novo ao lado, depois rename): quem le no meio nunca ve meio json. Sem BOM.
function gravar(arquivo, estado) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const tmp = arquivo + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(estado, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  try { fs.renameSync(tmp, arquivo); } finally { try { fs.unlinkSync(tmp); } catch { /* ja trocado */ } }
}
// 1 linha no recados do painel, no formato do PB: "- DD/MM HH:MM | OS DOIS | marcha N: <nome> | painel-<uuid>".
// Dia e hora saem do Get-Date do clique. Nunca segue link, nunca passa do teto, sempre fecha a linha anterior.
function escreverRecado(arquivo, n, h) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(h);
  if (!m) throw erro('hora');
  const dia = m[3] + '/' + m[2], hora = m[4] + ':' + m[5];
  const texto = n === L.ROTINA ? 'marcha contínua' : 'marcha ' + n + ': ' + L.TEXTOS.pt.marchas[n].nome;
  const id = 'painel-' + crypto.randomUUID();
  let prefixo = '';
  try {
    const st = fs.lstatSync(arquivo);
    if (st.isSymbolicLink() || !st.isFile() || st.size > RECADOS_MAX) throw erro('gravar');
    if (st.size > 0) {
      const fd = fs.openSync(arquivo, 'r');
      try { const ultimo = Buffer.alloc(1); fs.readSync(fd, ultimo, 0, 1, st.size - 1); if (ultimo[0] !== 0x0a) prefixo = '\n'; } finally { fs.closeSync(fd); }
    }
  } catch (e) { if (!e || e.code !== 'ENOENT') throw erro('gravar'); }
  fs.appendFileSync(arquivo, prefixo + '- ' + dia + ' ' + hora + ' | OS DOIS | ' + texto + ' | ' + id + '\n', 'utf8');
  return { id, dia, hora, texto };
}
function vista(estado, token, avisa, rotina = null, estadoDir = null) {
  return {
    viva: estado.modo === 'dono' && avisa && estadoDir ? VIVA.lerViva(estadoDir) : null,
    ok: true, token, modo: estado.modo, avisa: estado.modo === 'dono' && avisa, total: L.TOTAL,
    rotina: estado.modo === 'dono' && avisa && rotina ? { texto: rotina } : null,
    marcha: estado.marcha, fases: estado.fases, ganhos: estado.ganhos, medido: estado.medido, marcas: estado.marcas,
    marchasTexto: estado.marchasTexto, nuncaCorta: estado.nuncaCorta, minutos: L.minutosDe(estado)
  };
}

// ---------- hora (Get-Date) ----------
// Um PowerShell fica de pe e responde "Get-Date -Format o" por linha: o 1o pedido leva ~3 s, os outros ~10 ms.
// Se ele cair ou travar, o proximo clique sobe outro; sem Get-Date nada e gravado.
let ps = null, fila = [];
function derrubar() {
  const pendentes = fila.splice(0);
  if (ps) { try { ps.stdin.end(); } catch { /* ja fechado */ } try { ps.kill(); } catch { /* ja saiu */ } ps = null; }
  for (const f of pendentes) f(null);
}
function subirPs() {
  const filho = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-NoLogo', '-Command', '-'], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
  let buf = '';
  filho.stdout.setEncoding('utf8');
  filho.stdout.on('data', d => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const linha = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!linha) continue;
      const f = fila.shift(); if (f) f(linha);
    }
  });
  filho.on('error', () => { if (ps === filho) derrubar(); });
  filho.on('exit', () => { if (ps === filho) { ps = null; const pendentes = fila.splice(0); for (const f of pendentes) f(null); } });
  return filho;
}
function horaGetDate(limiteMs = 45000) {
  return new Promise((resolve, reject) => {
    if (!ps) ps = subirPs();
    let feito = false;
    const relogio = setTimeout(() => { if (!feito) { feito = true; derrubar(); reject(erro('hora')); } }, limiteMs);
    fila.push(linha => {
      if (feito) return; feito = true; clearTimeout(relogio);
      if (linha && FORMATO_O.test(linha)) resolve(linha); else reject(erro('hora'));
    });
    try { ps.stdin.write('Get-Date -Format o\n'); } catch { if (!feito) { feito = true; clearTimeout(relogio); derrubar(); reject(erro('hora')); } }
  });
}
function fecharRelogio() { derrubar(); }

function criarRotasAcelerador(op = {}) {
  const porta = Number(op.porta);
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) throw Error('porta invalida');
  const arquivo = path.resolve(op.arquivo || path.join(__dirname, 'dados', 'acelerador.json'));
  if (!/\.json$/i.test(arquivo)) throw Error('o estado das fases e um arquivo .json');
  if (!op.localPessoal && /[\\/]estado(?:[\\/]|$)/i.test(arquivo)) throw Error('o acelerador nunca grava o json no estado');
  const recados = op.recados ? path.resolve(op.recados) : null;
  // ROTINA: so com o texto do dono (pt, en, es) e com o recados ligado
  const rotina = recados && op.rotina ? tres(op.rotina, 300) : null;
  if (recados && path.basename(recados) !== 'recados-do-painel.md') throw Error('recados so no recados-do-painel.md');
  // a pasta do estado (para a marcha viva) e a do recados; op.estado troca (teste)
  const estadoDir = recados ? path.resolve(op.estado || path.dirname(recados)) : null;
  const prefixo = String(op.prefixo || '/api/acelerador').replace(/\/+$/, '');
  if (!/^\/[\w/-]+$/.test(prefixo)) throw Error('prefixo invalido');
  const hosts = new Set(op.hosts || ['127.0.0.1:' + porta, 'localhost:' + porta]);
  const origens = new Set(op.origens || ['http://127.0.0.1:' + porta, 'http://localhost:' + porta]);
  const token = crypto.randomBytes(24).toString('hex');
  const hora = typeof op.hora === 'function' ? op.hora : horaGetDate;
  const estaticos = { '/acelerador/acelerador.js': ['acelerador.js', 'text/javascript'], '/acelerador/acelerador.css': ['acelerador.css', 'text/css'], '/acelerador/cabecalho-botoes.js': ['cabecalho-botoes.js', 'text/javascript'], '/acelerador/cabecalho-botoes.css': ['cabecalho-botoes.css', 'text/css'] };
  // um clique por vez neste processo: rele, muda e grava sem dois cliques se cruzarem
  let vez = Promise.resolve();
  const naVez = tarefa => { const p = vez.then(tarefa, tarefa); vez = p.catch(() => {}); return p; };

  function enviar(res, status, dados, tipo = 'application/json') {
    if (res.headersSent) return res.end();
    res.writeHead(status, { 'Content-Type': tipo + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(tipo === 'application/json' && !Buffer.isBuffer(dados) ? JSON.stringify(dados) : dados);
  }
  function mesmaPagina(req) {
    if (!origens.has(req.headers.origin)) return false;
    const atendimento = req.headers['sec-fetch-site'];
    if (atendimento !== undefined && atendimento !== 'same-origin') return false;
    const tipo = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    return tipo === 'application/json' && req.headers['x-acelerador-token'] === token;
  }
  async function corpo(req, limite = 1024) {
    const partes = []; let tam = 0;
    for await (const p of req) { tam += p.length; if (tam > limite) throw erro('grande'); partes.push(p); }
    let j;
    try { j = JSON.parse(Buffer.concat(partes).toString('utf8')); } catch { throw erro('invalido'); }
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw erro('invalido');
    return j;
  }
  async function marcarHora() {
    const h = await Promise.resolve().then(() => hora()).catch(() => { throw erro('hora'); });
    if (typeof h !== 'string' || !FORMATO_O.test(h)) throw erro('hora');
    return h;
  }
  async function acao(nome, pedido) {
    const chaves = Object.keys(pedido);
    if (nome === 'marcha') {
      const inf = pedido.marcha === L.ROTINA && !!rotina;
      if (chaves.length !== 1 || chaves[0] !== 'marcha' || !(L.marchaValida(pedido.marcha) || inf)) throw erro('invalido');
      const h = await marcarHora();
      return naVez(() => {
        const e = ler(arquivo);
        if (e.marcha && e.marcha.n === pedido.marcha) return { estado: e, recado: null }; // ja vale: nada sai
        if (inf && e.modo !== 'dono') throw erro('invalido');
        // o recado vai antes: se ele nao sair, a marcha nao muda (a tela mostra a de antes)
        const recado = e.modo === 'dono' && recados ? escreverRecado(recados, pedido.marcha, h) : null;
        e.marcha = { n: pedido.marcha, em: h };
        gravar(arquivo, e);
        return { estado: e, recado };
      });
    }
    if (nome === 'ligar') {
      if (chaves.length !== 1 || chaves[0] !== 'fase' || !Number.isInteger(pedido.fase) || pedido.fase < 1 || pedido.fase > L.TOTAL) throw erro('invalido');
      const h = await marcarHora();
      return naVez(() => {
        const e = ler(arquivo), k = L.ligadasEmOrdem(e.fases);
        if (pedido.fase <= k) throw erro('ja-ligada');
        if (pedido.fase !== k + 1) throw erro('fora-de-ordem');
        e.fases[String(pedido.fase)] = { em: h };
        gravar(arquivo, e);
        return { estado: e };
      });
    }
    if (nome === 'minutos') {
      if (chaves.length !== 1 || chaves[0] !== 'minutos' || !L.SOMAS.includes(pedido.minutos)) throw erro('invalido');
      const h = await marcarHora();
      return naVez(() => {
        const e = ler(arquivo);
        if (!L.ligadasEmOrdem(e.fases)) throw erro('sem-fase');
        const id = crypto.randomBytes(4).toString('hex');
        e.marcas.push({ id, minutos: pedido.minutos, em: h });
        if (e.marcas.length > 500) e.marcas = e.marcas.slice(-500);
        gravar(arquivo, e);
        return { estado: e, marca: id };
      });
    }
    if (nome === 'desfazer') {
      const porFase = chaves.length === 1 && chaves[0] === 'fase' && Number.isInteger(pedido.fase);
      const porMarca = chaves.length === 1 && chaves[0] === 'marca' && typeof pedido.marca === 'string' && /^[a-f0-9]{8}$/.test(pedido.marca);
      if (!porFase && !porMarca) throw erro('invalido');
      return naVez(() => {
        const e = ler(arquivo);
        if (porFase) {
          const k = L.ligadasEmOrdem(e.fases), ultima = e.fases[String(k)];
          if (!k || pedido.fase !== k || !ultima || ultima.semente) throw erro('nao-desfaz');
          delete e.fases[String(k)];
        } else {
          const ultima = e.marcas[e.marcas.length - 1];
          if (!ultima || ultima.id !== pedido.marca) throw erro('nao-desfaz');
          e.marcas.pop();
        }
        gravar(arquivo, e);
        return { estado: e };
      });
    }
    throw erro('invalido');
  }

  function handle(req, res) {
    let url;
    try { url = new URL(req.url, 'http://127.0.0.1'); } catch { return false; }
    const p = url.pathname;
    const daApi = p === prefixo || p.startsWith(prefixo + '/');
    if (!daApi && !Object.hasOwn(estaticos, p)) return false;
    if (!hosts.has(req.headers.host)) { req.resume(); enviar(res, 403, { ok: false, erro: 'origem', mensagem: MENSAGEM.origem }); return true; }
    if (Object.hasOwn(estaticos, p)) {
      if (req.method !== 'GET') { req.resume(); enviar(res, 405, { ok: false }); return true; }
      const [arq, tipo] = estaticos[p];
      try { enviar(res, 200, fs.readFileSync(path.join(__dirname, arq)), tipo); } catch { enviar(res, 503, { ok: false }); }
      return true;
    }
    if (p === prefixo) {
      if (req.method !== 'GET') { req.resume(); enviar(res, 405, { ok: false }); return true; }
      if (req.headers.origin && !origens.has(req.headers.origin)) { enviar(res, 403, { ok: false, erro: 'origem', mensagem: MENSAGEM.origem }); return true; }
      try { enviar(res, 200, vista(ler(arquivo), token, !!recados, rotina, estadoDir)); } catch (e) { const c = e && e.codigo === 'ilegivel' ? 'ilegivel' : 'gravar'; enviar(res, 503, { ok: false, erro: c, mensagem: MENSAGEM[c] }); }
      return true;
    }
    const nome = p.slice(prefixo.length + 1);
    if (!['marcha', 'ligar', 'minutos', 'desfazer'].includes(nome)) { req.resume(); enviar(res, 404, { ok: false }); return true; }
    if (req.method !== 'POST') { req.resume(); enviar(res, 405, { ok: false }); return true; }
    if (!mesmaPagina(req)) { req.resume(); enviar(res, 403, { ok: false, erro: 'origem', mensagem: MENSAGEM.origem }); return true; }
    corpo(req)
      .then(pedido => acao(nome, pedido))
      .then(r => enviar(res, 200, Object.assign(vista(r.estado, token, !!recados, rotina, estadoDir), r.marca ? { marca: r.marca } : {}, r.recado ? { recado: { id: r.recado.id, hora: r.recado.hora } } : {})))
      .catch(e => {
        const c = e && e.codigo && MENSAGEM[e.codigo] ? e.codigo : 'gravar';
        enviar(res, c === 'grande' ? 413 : c === 'invalido' ? 400 : c === 'gravar' ? 500 : 409, { ok: false, erro: c, mensagem: MENSAGEM[c] });
      });
    return true;
  }

  return { handle, token, arquivo, recados, prefixo, estado: estadoDir };
}

module.exports = { criarRotasAcelerador, normalizar, horaGetDate, fecharRelogio };
