'use strict';
// Serve /blocos-livro.js, /blocos-livro.css e GET /api/livro/dias (fechadas por dia para o placar e a grade de 35 dias).
// Gancho no servidor.cjs (1 linha, logo depois do fluxo.handle):
//   if(require('./blocos-livro-rota.cjs').handle(req,url,{send,root,example}))return;
// Fonte das fechadas: git log do estado (so leitura). Conta como "fechada" o registro cuja mensagem tem
// PODE SUBIR, CONFERE, no ar, checagem verde, fechado, commitado, VERDE, entregue ou subiu. Sem git: lido=false (a tela mostra "?").
const fs = require('node:fs'), path = require('node:path');
const { execFile } = require('node:child_process');
const ASSETS = { '/blocos-livro.js': ['blocos-livro.js', 'text/javascript'], '/blocos-livro.css': ['blocos-livro.css', 'text/css'] };
const FECHA = /PODE SUBIR|CONFERE|\bno ar\b|checagem verde|fechad|commitad|VERDE|entregue|subiu/i;
const NO_AR = /\bno ar\b|checagem verde|subiu/i;
const CACHE_MS = 120000;
const caches = new Map(); // root -> {em, linhas, lendo}

function lerGit(root) {
  return new Promise(ok => execFile('git', ['-C', root, 'log', '--since=40 days ago', '--format=%cd%x09%s', '--date=format:%Y-%m-%d %H:%M'],
    { maxBuffer: 1e8, windowsHide: true, timeout: 15000 },
    (err, out) => ok(err ? null : String(out).split('\n').filter(Boolean).map(l => { const i = l.indexOf('\t'); return { em: l.slice(0, i), msg: l.slice(i + 1) }; }))));
}
// dia local da maquina (o --date do git tambem usa o fuso local)
function diaLocal(ms) { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

// 1 leitura do git a cada 2 min por pasta; pedidos juntos esperam a mesma leitura
function linhas(root, now) {
  let c = caches.get(root);
  if (c && c.lendo) return c.lendo;
  if (c && c.linhas && now - c.em <= CACHE_MS) return Promise.resolve(c.linhas);
  c = { em: now, linhas: c ? c.linhas : null, lendo: null }; caches.set(root, c);
  c.lendo = lerGit(root).then(l => { c.linhas = l; c.em = Date.now(); c.lendo = null; return l; });
  return c.lendo;
}

async function dias(root, now = Date.now(), ler = linhas) {
  const lin = await ler(root, now), c = caches.get(root) || { em: now };
  if (!lin) return { ok: false, lido: false };
  const porDia = {}, fechadasHoje = [], noArHoje = [], hoje = diaLocal(now);
  let primeiro = null;
  for (const r of lin) {
    const d = r.em.slice(0, 10); if (!primeiro || d < primeiro) primeiro = d;
    if (!FECHA.test(r.msg)) continue;
    porDia[d] = (porDia[d] || 0) + 1;
    if (d === hoje) { fechadasHoje.push({ hora: r.em.slice(11, 16), msg: r.msg.slice(0, 160) }); if (NO_AR.test(r.msg)) noArHoje.push({ hora: r.em.slice(11, 16), msg: r.msg.slice(0, 160) }); }
  }
  return { ok: true, lido: true, lidoEm: new Date(c.em).toISOString(), hoje, primeiroDia: primeiro, fonte: 'git log do estado: mensagens com PODE SUBIR, CONFERE, no ar, checagem verde, fechado ou commitado', dias: porDia, fechadasHoje, noArHoje };
}

function handle(req, url, { send, root, example = false }) {
  const asset = ASSETS[url.pathname], api = url.pathname === '/api/livro/dias';
  if (!asset && !api) return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') { send(405, { ok: false, error: 'Somente leitura' }); return true; }
  if (asset) { try { send(200, fs.readFileSync(path.join(__dirname, asset[0])), asset[1]); } catch { send(404, { ok: false, error: 'Arquivo ausente' }); } return true; }
  if (example || !root) { send(200, { ok: false, lido: false, exemplo: !!example }); return true; }
  dias(root).then(j => send(200, j), () => send(200, { ok: false, lido: false }));
  return true;
}

module.exports = { handle, dias, FECHA, NO_AR };
