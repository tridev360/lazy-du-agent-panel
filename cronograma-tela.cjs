'use strict';
//   GET  /api/cronograma        -> estado/cronograma.json (hoje, semana, geral; so os campos da tela, texto limpo) + os ultimos
//                                  pedidos de ordem + o token do clique
//   POST /api/cronograma/ordem  -> {lista, ordem}: NAO muda o cronograma. Grava 1 linha em estado/pedidos-de-ordem.md
//                                  ("- DD/MM HH:MM | PAINEL | nova ordem: a > b > c | lista: hoje") e o COORDENADOR repassa as sessoes.
//                                  So entram os itens que podem mudar de lugar (nao feitos e sem hora fixa: post, mesa, HH:MM exata).
//   GET  /cronograma.js e /cronograma.css
// Quem escreve o cronograma.json e o Claude. Nada sai alem destes campos; no exemplo: vazio.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const FILES = { '/cronograma.js': ['cronograma.js', 'text/javascript'], '/cronograma.css': ['cronograma.css', 'text/css'] };
const ROUTE = '/api/cronograma', ORDEM = '/api/cronograma/ordem', FONTE = 'estado/cronograma.json', PEDIDOS = 'estado/pedidos-de-ordem.md';
const TOKEN = crypto.randomBytes(24).toString('hex');
const QUEM = ['claude', 'codex', 'ele', 'os dois'], ESTADOS = ['feito', 'rodando', 'na fila', 'espera voce', 'travado'];
function text(value, limit) {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (/PRIVADO|_SECRETS|backup-privado|\b(?:seed|api.?key|senha|secret)\b|0x[a-f\d]{40}/i.test(value)) return 'Detalhes no chat da sessão.';
  const clean = require('./realtime.cjs').safeText(value, 600).replace(/\b[a-f\d]{7,64}\b/gi, '').replace(/(?:[A-Z]:[\\/]|(?:estado|tasks|casa|src|public|wt)[\\/])[^\s;,]+/gi, '').replace(/[–—]/g, ',').replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, limit) : null;
}
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
// hora fixa = nao muda de lugar: o que ja foi feito, post e mesa, e hora exata (HH:MM sem "~" nem faixa)
function fixo(item) { return item.estado === 'feito' || /\b(?:post|mesa)\b/i.test(norm(item.o_que)) || /^\d{2}:\d{2}$/.test(String(item.hora || '').trim()); }
function item(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const o_que = text(raw.o_que, 160); if (!o_que) return null;
  const estado = ESTADOS.includes(norm(raw.estado)) ? norm(raw.estado) : null, quem = QUEM.includes(norm(raw.quem)) ? norm(raw.quem) : null;
  const out = { hora: text(raw.hora, 40), o_que, quem, estado, maxima: raw.maxima === true, prazo: text(raw.prazo, 40), depende: text(raw.depende, 80), data:require('./dados-auditados.js').day(raw.data||raw.dia), at:require('./dados-auditados.js').instant(raw.at||raw.feitoEm),id:text(raw.id||raw.taskId,80) };
  out.fixo = fixo(out);
  return out;
}
function ler(root, now = new Date()) {
  let raw = null, mtime = null;
  try { const lido = require('./leitor.cjs').readSafe(root, FONTE, 256000); raw = JSON.parse(String(lido || '').replace(/^﻿/, '')); mtime = fs.statSync(path.join(root, FONTE)).mtime.toISOString(); } catch { raw = null; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: true, lido: false, lidoEm: now.toISOString() };
  const lista = v => (Array.isArray(v) ? v : []).slice(0, 80).map(item).filter(Boolean);
  const at = Date.parse(raw.atualizado || '');
  const result={
    ok: true, lido: true, lidoEm: now.toISOString(), atualizado: Number.isFinite(at) ? new Date(at).toISOString() : null,fileAt:mtime,dia:require('./dados-auditados.js').day(raw.dia), estimado: raw.estimado === true,
    hoje: lista(raw.hoje),
    semana: (Array.isArray(raw.semana) ? raw.semana : []).slice(0, 20).map(d => d && typeof d === 'object' ? { dia: /^\d{4}-\d{2}-\d{2}$/.test(String(d.dia || '')) ? d.dia : null, rotulo: text(d.rotulo, 40), itens: lista(d.itens) } : null).filter(d => d && (d.rotulo || d.dia)),
    geral: (Array.isArray(raw.geral) ? raw.geral : []).slice(0, 20).map(f => f && typeof f === 'object' ? { fase: text(f.fase, 60), itens: lista(f.itens) } : null).filter(f => f && f.fase),
    pedidos: pedidosRecentes(root), token: TOKEN, ordena: true
  };return require('./frescor.cjs').cronogramaComProjetos(require('./dados-auditados.js').schedule(result,require('./agora-nucleo.cjs').read(root,now.getTime()),now.getTime()),root,now.getTime());
}
function pedidosRecentes(root) {
  let texto = null; try { texto = require('./leitor.cjs').readSafe(root, PEDIDOS, 128000); } catch { texto = null; }
  return String(texto || '').split(/\r?\n/).filter(l => /^-\s*\d{2}\/\d{2}\s+\d{2}:\d{2}\s*\|\s*PAINEL\s*\|\s*nova ordem:/.test(l)).slice(-5).map(l => text(l.replace(/^-\s*/, ''), 400)).filter(Boolean);
}
function alvo(dados, lista) {
  if (lista === 'hoje') return { itens: dados.hoje, rotulo: 'hoje' };
  const m = /^(semana|geral):(\d{1,2})$/.exec(String(lista || ''));
  if (!m) return null;
  const grupo = m[1] === 'semana' ? dados.semana[Number(m[2])] : dados.geral[Number(m[2])];
  return grupo ? { itens: grupo.itens, rotulo: m[1] + ', ' + (grupo.rotulo || grupo.fase || grupo.dia) } : null;
}
const brt = at => new Date(at - 3 * 3600000);
const stampBrt = at => { const d = brt(at), p = n => String(n).padStart(2, '0'); return p(d.getUTCDate()) + '/' + p(d.getUTCMonth() + 1) + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()); };
function origemOk(req) {
  const host = String(req.headers.host || '');
  return /^(?:127\.0\.0\.1|localhost):\d{2,5}$/.test(host) && req.headers.origin === 'http://' + host && (!req.headers['sec-fetch-site'] || req.headers['sec-fetch-site'] === 'same-origin')
    && String(req.headers['content-type'] || '').split(';')[0].trim() === 'application/json' && req.headers['x-cronograma-token'] === TOKEN;
}
async function corpo(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 16384) throw Error('grande'); chunks.push(chunk); }
  const j = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!j || typeof j !== 'object' || Array.isArray(j) || Object.keys(j).some(k => !['lista', 'ordem'].includes(k)) || !Array.isArray(j.ordem) || j.ordem.length < 2 || j.ordem.length > 80) throw Error('invalido');
  return j;
}
let gravando = false;
async function pedirOrdem(req, ctx) {
  if (ctx.example || !origemOk(req)) { if (typeof req.resume === 'function') req.resume(); return ctx.send(403, { ok: false, erro: 'origem' }); }
  if (gravando) { if (typeof req.resume === 'function') req.resume(); return ctx.send(409, { ok: false, erro: 'ocupado' }); }
  gravando = true;
  try {
    const j = await corpo(req), now = Date.now(), dados = ler(ctx.root, new Date(now)), lista = dados.lido ? alvo(dados, j.lista) : null;
    if (!lista) return ctx.send(409, { ok: false, erro: 'mudou', mensagem: 'O cronograma mudou. A tela vai atualizar.' });
    const moveis = lista.itens.filter(i => !i.fixo).map(i => i.o_que);
    const pedido = j.ordem.map(v => typeof v === 'string' ? v : null);
    // a nova ordem tem que ser exatamente os mesmos itens que podem mudar de lugar, cada um 1 vez
    if (pedido.some(v => v === null) || pedido.length !== moveis.length || new Set(pedido).size !== pedido.length || pedido.some(v => !moveis.includes(v))) return ctx.send(409, { ok: false, erro: 'mudou', mensagem: 'O cronograma mudou. A tela vai atualizar.' });
    if (pedido.every((v, i) => v === moveis[i])) return ctx.send(400, { ok: false, erro: 'igual', mensagem: 'A ordem é a mesma de agora.' });
    const linha = '- ' + stampBrt(now) + ' | PAINEL | nova ordem: ' + pedido.map(v => v.replace(/[|>\r\n]+/g, ' ').trim()).join(' > ') + ' | lista: ' + lista.rotulo.replace(/[|\r\n]+/g, ' ') + '\n';
    const base = fs.realpathSync(ctx.root), file = path.join(base, PEDIDOS), dir = path.dirname(file);
    if (fs.lstatSync(dir).isSymbolicLink() || fs.realpathSync(dir) !== dir) throw Error('pasta');
    let cabeca = '';
    try { if (fs.lstatSync(file).isSymbolicLink()) throw Error('link'); } catch (error) { if (error.code !== 'ENOENT') throw error; cabeca = '# Pedidos de ordem do cronograma pelo painel (o Claude le e repassa as sessoes; o painel nao muda o cronograma)\n'; }
    fs.appendFileSync(file, cabeca + linha, 'utf8');
    return ctx.send(200, { ok: true, hora: stampBrt(now).slice(6) });
  } catch {
    return ctx.send(400, { ok: false, erro: 'invalido', mensagem: 'Não consegui gravar. Tente de novo.' });
  } finally { gravando = false; }
}
function handle(req, url, ctx) {
  const p = url && url.pathname;
  if (p !== ROUTE && p !== ORDEM && !Object.hasOwn(FILES, p)) return false;
  if (p === ORDEM) { if (req.method !== 'POST') { ctx.send(405, { ok: false }); return true; } pedirOrdem(req, ctx).catch(() => ctx.send(500, { ok: false })); return true; }
  if (req.method !== 'GET') { if (typeof req.resume === 'function') req.resume(); ctx.send(405, { ok: false }); return true; }
  if (p === ROUTE) { ctx.send(200, ctx.example ? { ok: true, lido: false, exemplo: true } : ler(ctx.root)); return true; }
  const [file, type] = FILES[p];
  let bytes = null; try { bytes = fs.readFileSync(path.join(ctx.dir || __dirname, file)); } catch { bytes = null; }
  if (bytes) ctx.send(200, bytes, type); else ctx.send(503, { error: 'Asset unavailable' });
  return true;
}
module.exports = { handle, ler, fixo, ROUTE, ORDEM };
