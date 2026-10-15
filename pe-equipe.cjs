'use strict';
// Gancho de servidor do modulo PE (aba Equipe, linha do tempo e vista Fluxo). SO LEITURA: nada grava, nada envia.
//   GET /api/pe-equipe/agentes    = o pacote verificado de retratos (lido pelo agentes.cjs da 3250, mesma verificacao que ela faz).
//   GET /api/pe-equipe/fluxo  = quem manda comando, duvida e resposta para quem nas ultimas 2 h (pe-fluxo.cjs; sem texto de mensagem).
//   GET /pe-equipe.js e GET /pe-equipe.css = os arquivos da tela.
//   Qualquer outro metodo nessas rotas = 405. O resto das rotas nao e deste modulo (handle devolve false).
// Uso no servidor do integrador: const pe = require('<esta pasta>/pe-equipe.cjs'); ... if (pe.handle(req, url, { send, live })) return;
//   live (opcional) = () => Promise do estado da 3250 que o integrador ja le; sem ele, o modulo le GET http://127.0.0.1:3250/api/estado.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const fluxo = require('./pe-fluxo.cjs');

const PAINEL_DIR = process.env.PE_PAINEL || __dirname;
const UPSTREAM = Number(process.env.PE_UPSTREAM || 3257);
const FILES = { '/pe-equipe.js': ['pe-equipe.js', 'text/javascript'], '/pe-equipe.css': ['pe-equipe.css', 'text/css'] };
const IMAGE = /^\/(?:assets|agentes|miniaturas)\/[\w./-]+\.(?:png|webp|jpg)$/i;
const ROUTE = '/api/pe-equipe/agentes', FLOW = '/api/pe-equipe/fluxo';
const TAIL = /^\/api\/pe-equipe\/conversa\/(claude|codex)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/(a?[0-9a-f]{6,40}))?$/i;

// O pacote verificado de retratos, o mesmo que a 3250 usa; lido 1 vez a cada 10 min no maximo.
let cache = null;
function pool(painelDir = PAINEL_DIR, now = Date.now()) {
  if (cache && cache.dir === painelDir && now - cache.at < 600000) return cache.value;
  let value;
  try {
    const reading = require(path.join(painelDir, 'agentes.cjs')).loadVerifiedPool(painelDir);
    const list = (Array.isArray(reading && reading.pool) ? reading.pool : [])
      .filter(item => item && item.verified === true && IMAGE.test(String(item.image)) && !String(item.image).includes('..'))
      .map(item => ({ image: String(item.image), agente: item.id === undefined || item.id === null ? null : String(item.id) }));
    value = { ok: true, verified: reading && reading.status === 'verified', pool: list };
  } catch {
    value = { ok: false, verified: false, pool: [] };
  }
  cache = { dir: painelDir, at: now, value };
  return value;
}

let live = null;
function readUpstream() {
  if (live && Date.now() - live.at < 30000) return live.value;
  const value = new Promise(resolve => {
    const request = http.get({ host: '127.0.0.1', port: UPSTREAM, path: '/api/estado', headers: { Host: '127.0.0.1:' + UPSTREAM, Accept: 'application/json' }, timeout: 20000 }, response => {
      if (response.statusCode !== 200) { response.resume(); resolve(null); return; }
      const chunks = []; let size = 0;
      response.on('data', chunk => { size += chunk.length; if (size > 64 * 1024 * 1024) request.destroy(); else chunks.push(chunk); });
      response.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { resolve(null); } });
      response.on('error', () => resolve(null));
    });
    request.on('timeout', () => { request.destroy(); resolve(null); });
    request.on('error', () => resolve(null));
  });
  live = { at: Date.now(), value };
  return value;
}

function fallbackSend(res) {
  return (status, body, type = 'application/json') => {
    if (res.headersSent) return res.end();
    res.writeHead(status, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(type === 'application/json' && !Buffer.isBuffer(body) && typeof body !== 'string' ? JSON.stringify(body) : body);
  };
}

function handle(req, url, ctx = {}, res = null) {
  const pathname = url && url.pathname;
  const tail = TAIL.exec(String(pathname || ''));
  if (pathname === '/api/pe-equipe/codex-frentes') {
    const sendF = ctx.send || fallbackSend(res);
    if (req.method !== 'GET') { if (typeof req.resume === 'function') req.resume(); sendF(405, { ok: false }); return true; }
    let r; try { r = ctx.estado ? require('./codex-frentes.cjs').frentes(ctx.estado) : { ok: false, lido: false }; } catch { r = { ok: false, lido: false }; }
    sendF(200, r); return true;
  }
  //             GET /api/pe-equipe/wen = o WEN de 7 linhas montado das fontes vivas (wen-vivo.cjs). Contrato: CONTRATO-FLUXO-F2.md.
  if (pathname === '/api/pe-equipe/codex-sessoes' || pathname === '/api/pe-equipe/wen') {
    const sendF = ctx.send || fallbackSend(res);
    if (req.method !== 'GET') { if (typeof req.resume === 'function') req.resume(); sendF(405, { ok: false, erro: 'so_leitura' }); return true; }
    const exemplo = url.searchParams && url.searchParams.get('exemplo') === '1';
    const job = exemplo ? (pathname.endsWith('/wen') ? require('./wen-vivo.cjs').vazio() : require('./codex-sessoes.cjs').vazio()) : pathname.endsWith('/wen') ? require('./wen-vivo.cjs').gerar({ estado: ctx.estado, snapshot:ctx.metadataProvider?.snapshot()?.wenSnapshot }) : require('./codex-sessoes.cjs').leitura({ estado: ctx.estado });
    Promise.resolve(job).then(v => sendF(200, v)).catch(() => sendF(503, { ok: false, erro: 'sem leitura' }));
    return true;
  }
  if (pathname !== ROUTE && pathname !== FLOW && !tail && !Object.hasOwn(FILES, pathname)) return false;
  const send = ctx.send || fallbackSend(res);
  if (req.method !== 'GET') {
    if (typeof req.resume === 'function') req.resume();
    send(405, { ok: false, error: 'Method not allowed', erro: 'so_leitura' });
    return true;
  }
  if (pathname === ROUTE) { send(200, pool(ctx.painelDir || PAINEL_DIR)); return true; }
  if (tail && ctx.metadataOnly === true) { send(503,{ok:false,error:'Metadata tail unavailable'}); return true; }
  if (tail) {
    const reader = typeof ctx.live === 'function' ? ctx.live : readUpstream;
    Promise.resolve().then(() => reader()).catch(() => null)
      .then(snapshot => send(200, require('./pe-cauda.cjs').caudaDe({ familia: tail[1].toLowerCase(), uuid: tail[2].toLowerCase(), agente: tail[3] ? tail[3].toLowerCase() : null, estado: ctx.estado || null, snapshot, claudeDir: ctx.claudeDir, codexDir: ctx.codexDir })))
      .catch(() => send(503, { ok: false, error: 'Tail unavailable' }));
    return true;
  }
  if (pathname === FLOW) {
    const reader = typeof ctx.live === 'function' ? ctx.live : readUpstream;
    fluxo.flow({ exemplo: !!(url.searchParams && url.searchParams.get('exemplo') === '1'), live: reader, estado: ctx.estado, claudeDir: ctx.claudeDir, codexDir: ctx.codexDir, fresh: ctx.fresh, metadataOnly:ctx.metadataOnly, metadataProvider:ctx.metadataProvider })
      .then(value => send(200, value))
      .catch(() => send(503, { ok: false, error: 'Flow unavailable' }));
    return true;
  }
  const [file, type] = FILES[pathname];
  let bytes = null;
  try { bytes = fs.readFileSync(path.join(__dirname, file)); } catch { bytes = null; }
  if (bytes) send(200, bytes, type); else send(503, { error: 'Asset unavailable' });
  return true;
}

module.exports = { handle, pool, PAINEL_DIR, ROUTE, FLOW, FILES };
