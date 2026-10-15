'use strict';
// Gancho no servidor.cjs (1 linha, logo depois do fluxo.handle):
//   if(require('./blocos-folha-rota.cjs').handle(req,url,{send,root,example,dir:__dirname}))return; // FOLHA: blocos proprios (so GET)
// Serve: GET /blocos-folha.js, GET /blocos-folha.css e GET /api/folha/hoje.
// /api/folha/hoje conta os cards decididos hoje (dia local do PC) e devolve os ultimos 5 de hoje, porque /api/agora
// e /api/pc-cards/lista so trazem os 5 ultimos respondidos de qualquer dia. Mesma pasta e mesma vista (sigilo) do
// /api/agora: card restrito vai sem pergunta. Nao grava nada; outro metodo volta 405.
const fs = require('node:fs');
const path = require('node:path');

const ARQUIVOS = { '/blocos-folha.js': ['blocos-folha.js', 'text/javascript'], '/blocos-folha.css': ['blocos-folha.css', 'text/css'] };
const ROTA = '/api/folha/hoje';

function diaLocal(t) {
  const d = new Date(t);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// cardsDir explicito para o teste; no servidor sai do root
function hoje({ cardsDir, agora = new Date() }) {
  const N = require('./cards300-nucleo.cjs');
  const { lidos, ilegiveis } = N.lerPasta(cardsDir);
  const dia = diaLocal(agora.getTime());
  const feitos = [];
  for (const l of lidos) {
    const c = l.cru;
    if (!c || typeof c !== 'object' || c.exemplo === true || !N.respondido(c)) continue;
    if (N.normal(c.tipo).trim() === 'passos' && !c.conferido) continue; // passo a passo sem conferir ainda espera
    const q = N.tempoTela(String(c.respondidoEm || (typeof c.respondido === 'string' ? c.respondido : '') || ''), agora);
    const t = Number.isFinite(q.t) ? q.t : l.mtime;
    if (diaLocal(t) !== dia) continue;
    const restrito = !N.paraTela(c);
    feitos.push({ arquivo: restrito ? N.chaveOpaca(l.arquivo) : l.arquivo, sessao: N.limpar(c.sessao, 60) || 'Sem nome', pergunta: restrito ? '' : N.limpar(c.pergunta, 600), restrito, ordemResp: t });
  }
  feitos.sort((a, b) => b.ordemResp - a.ordemResp);
  return { ok: true, decididasHoje: feitos.length, ultimos: feitos.slice(0, 5), ilegiveis, lidoEm: agora.toISOString() };
}

function handle(req, url, { send, root, example, dir }) {
  const p = url.pathname;
  if (p !== ROTA && !Object.hasOwn(ARQUIVOS, p)) return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') { send(405, { ok: false, erro: 'so leitura' }); return true; }
  if (p === ROTA) {
    if (example) { send(200, { ok: true, decididasHoje: null, ultimos: [], exemplo: true }); return true; }
    try { send(200, hoje({ cardsDir: path.join(root, 'estado', 'cards') })); }
    catch { send(503, { ok: false }); }
    return true;
  }
  // arquivo fixo desta pasta (nome da lista, sem entrada do pedido); recusa link simbolico como o servidor faz
  const [file, type] = ARQUIVOS[p];
  try {
    const base = fs.realpathSync(dir), alvo = path.join(dir, file);
    if (fs.lstatSync(alvo).isSymbolicLink() || fs.realpathSync(alvo) !== path.join(base, file)) throw Error('arquivo');
    send(200, fs.readFileSync(alvo), type);
  } catch { send(503, { error: 'Asset unavailable' }); }
  return true;
}

module.exports = { handle, hoje, ARQUIVOS, ROTA };
