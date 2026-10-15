'use strict';
// Conselheiros: le o que o Claude da pessoa grava (estado/conselheiros/config.json e vereditos.jsonl) e conta as ideias
// sem resposta com o mesmo carregar() do app de Ideias, para o lembrete do topo bater com a fila. So leitura.
const fs = require('node:fs'), path = require('node:path'), { pathToFileURL } = require('node:url');
const IDS = ['seguranca', 'texto', 'testes', 'produto'], VEREDITOS = ['PODE', 'CONFERE', 'SEGURA'];
const QUANDO = ['commit', 'risco', 'pedido'], FREQ = ['hora', 'dia', 'pedido'], POR_VEZ = [1, 3, 5], RIGOR = ['avisa', 'trava'], LIMITES = [5, 10, 20];
const LIMITE_CONFIG = 64 * 1024, LIMITE_VEREDITOS = 2 * 1024 * 1024, MAX_LINHAS = 2000;
const SOLUCAO_CONFIG = 'Solução: peça ao seu Claude para gravar estado/conselheiros/config.json de novo, no formato do CONSELHEIROS-PROMPT.md.';
const SOLUCAO_VEREDITOS = 'Solução: peça ao seu Claude para conferir estado/conselheiros/vereditos.jsonl (1 linha JSON por revisão).';
const SOLUCAO_IDEIAS = 'Solução: peça ao seu Claude para conferir o JSON de estado/ideias/ (conselho.json, ideias.jsonl e vereditos-dono.jsonl).';
// a revisao fala de senha e login o tempo todo: some so o que parece o segredo em si (valor, chave longa, frase de recuperacao)
const SEGREDO = /\bsk-[\w-]{8,}|\b(?:token|key|chave|senha|password|secret|apikey|api_key)\s*[:=]\s*\S+|0x[a-f\d]{40}|\b[a-f\d]{64}\b|\b[1-9A-HJ-NP-Za-km-z]{32,44}\b|BEGIN [A-Z ]*PRIVATE KEY|seed phrase|mnemonic|[?&](?:token|key|auth)=/i;
const segredo = v => SEGREDO.test(v);
function texto(v, max) {
  if (typeof v !== 'string' || v.length > 4000 || segredo(v)) return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[\u2013\u2014]/g, ', ').replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
}
// arquivo dentro da pasta de estado: sem atalho no caminho, com teto de tamanho
function lerArquivo(root, partes, limite) {
  try {
    let atual = path.resolve(root);
    for (const p of ['estado', ...partes]) { atual = path.join(atual, p); if (fs.lstatSync(atual).isSymbolicLink()) return { estado: 'invalido' }; }
    const st = fs.statSync(atual); if (!st.isFile() || st.size > limite) return { estado: 'invalido' };
    return { estado: 'ok', texto: fs.readFileSync(atual, 'utf8').replace(/^﻿/, '') };
  } catch (e) { return { estado: e && e.code === 'ENOENT' ? 'ausente' : 'invalido' }; }
}
function lerConfig(root) {
  const a = lerArquivo(root, ['conselheiros', 'config.json'], LIMITE_CONFIG);
  if (a.estado !== 'ok') return { estado: a.estado, config: null };
  let c; try { c = JSON.parse(a.texto); } catch { return { estado: 'invalido', config: null }; }
  if (!c || typeof c !== 'object' || Array.isArray(c)) return { estado: 'invalido', config: null };
  const lentes = Array.isArray(c.lentes) ? IDS.filter(id => c.lentes.includes(id)) : [];
  if (!lentes.length) return { estado: 'invalido', config: null };
  const i = c.ideias && typeof c.ideias === 'object' ? c.ideias : {};
  return { estado: 'ok', config: { versao: 1, lentes, quando: QUANDO.includes(c.quando) ? c.quando : null, ideias: { frequencia: FREQ.includes(i.frequencia) ? i.frequencia : null, porVez: POR_VEZ.includes(i.porVez) ? i.porVez : null }, rigor: RIGOR.includes(c.rigor) ? c.rigor : null, lembrete: LIMITES.includes(c.lembrete) ? c.lembrete : null } };
}
function linhaVeredito(raw, now) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !IDS.includes(raw.lente) || !VEREDITOS.includes(raw.veredito)) return null;
  const t = Date.parse(raw.em); if (!Number.isFinite(t) || t > now + 5 * 60000) return null;
  const achados = (Array.isArray(raw.achados) ? raw.achados : []).slice(0, 8)
    .map(x => ({ gravidade: Number.isInteger(x && x.gravidade) && x.gravidade >= 1 && x.gravidade <= 4 ? x.gravidade : null, texto: texto(x && x.texto, 300) }))
    .filter(x => x.gravidade && x.texto).sort((a, b) => a.gravidade - b.gravidade).slice(0, 5);
  return { em: new Date(t).toISOString(), lente: raw.lente, veredito: raw.veredito, alvo: texto(raw.alvo, 60), resumo: texto(raw.resumo, 200), achados };
}
function lerVereditos(root, now) {
  const a = lerArquivo(root, ['conselheiros', 'vereditos.jsonl'], LIMITE_VEREDITOS);
  if (a.estado !== 'ok') return { estado: a.estado, linhas: [], ignoradas: 0 };
  const cruas = a.texto.split(/\r?\n/).filter(l => l.trim()).slice(-MAX_LINHAS), linhas = []; let ignoradas = 0;
  for (const l of cruas) { let v = null; try { v = linhaVeredito(JSON.parse(l), now); } catch { v = null; } if (v) linhas.push(v); else ignoradas++; }
  return { estado: 'ok', linhas, ignoradas };
}
// mesma conta do app de Ideias: a fila e o que espera a pessoa; a primeira da fila e a mais votada
async function contarIdeias(root) {
  try {
    const E = await import(pathToFileURL(path.join(__dirname, 'decidir-ideias', 'estado.mjs')).href);
    const st = await E.carregar(path.join(path.resolve(root), 'estado', 'ideias'));
    const top = st.fila[0];
    return { estado: 'ok', pendentes: st.fila.length, maisVotada: top ? { id: top.id, titulo: texto(top.titulo, 120) || '?', aFavor: top.contagem ? top.contagem.favor : null } : null };
  } catch { return { estado: 'invalido', pendentes: null, maisVotada: null, solucao: SOLUCAO_IDEIAS }; }
}
async function ler(root, { now = Date.now() } = {}) {
  const cfg = lerConfig(root), ver = lerVereditos(root, now), ideias = await contarIdeias(root);
  const ligado = cfg.estado === 'ok';
  const lentes = (ligado ? cfg.config.lentes : []).map(id => {
    if (ver.estado === 'invalido') return { id, estado: 'invalido', ultimo: null, revisoes: null, solucao: SOLUCAO_VEREDITOS };
    const minhas = ver.linhas.filter(v => v.lente === id);
    let ultimo = null; for (const v of minhas) if (!ultimo || Date.parse(v.em) >= Date.parse(ultimo.em)) ultimo = v;
    return { id, estado: 'ok', ultimo, revisoes: minhas.length };
  });
  return { ok: true, lidoEm: new Date(now).toISOString(), ligado, configEstado: cfg.estado, config: cfg.config, ...(cfg.estado === 'invalido' ? { solucao: SOLUCAO_CONFIG } : {}),
    vereditosEstado: ver.estado, ignoradas: ver.ignoradas, lentes, ideias };
}
const ATIVOS = { '/conselheiros.js': ['conselheiros.js', 'text/javascript'], '/conselheiros.css': ['conselheiros.css', 'text/css'] };
function handle(req, url, ctx) {
  const ativo = ATIVOS[url.pathname];
  if (!ativo && url.pathname !== '/api/conselheiros') return false;
  if (req.method !== 'GET') { ctx.send(405, { ok: false, error: 'Somente leitura.' }); return true; }
  if (ativo) { ctx.send(200, fs.readFileSync(path.join(ctx.dir || __dirname, ativo[0]), 'utf8'), ativo[1]); return true; }
  // o exemplo do painel (?exemplo=1) nunca le a pasta da pessoa: mostra os conselheiros desligados
  if (ctx.example) { ctx.send(200, { ok: true, exemplo: true, ligado: false, configEstado: 'ausente', config: null, vereditosEstado: 'ausente', ignoradas: 0, lentes: [], ideias: { estado: 'ok', pendentes: 0, maisVotada: null } }); return true; }
  return ler(ctx.root).then(d => { ctx.send(200, d); return true; }, () => { ctx.send(503, { ok: false, solucao: 'Solução: o painel relê sozinho a cada minuto; se seguir, reinicie o painel.' }); return true; });
}
module.exports = { ler, handle, contarIdeias, lerConfig, lerVereditos, linhaVeredito };
