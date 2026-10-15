'use strict';
// Serve /entregas.js, /entregas.css e GET /api/entregas (le <estado>/estado/entregas.json; nada grava).
// Gancho no servidor.cjs (1 linha, depois dos blocos-folha):
//   if(require('./entregas-rota.cjs').handle(req,url,{send,root,example}))return; // ENTREGAS: GET /api/entregas (so leitura)
// Regra do entregas.json: % = soma dos pesos (horas de obra) dos passos feitos / soma dos pesos conhecidos; peso null = hora
// desconhecida: o passo mostra "?" de horas e fica fora da conta. Horas na frente = soma dos pesos conhecidos nao feitos;
// laranja ("depende de voce") quando o 1o passo nao feito tem dependeDele; verde ("quase la") com 80% ou mais; roxo
// ("em obra") no resto. Arquivo com atualizadoEm de mais de 3 h = velho (a tela mostra a idade em destaque).
// Ausente ou quebrado = lido:false com o motivo e a solucao; nunca 0 inventado. Nada de data na tela: so horas de obra.
// Texto livre do arquivo (nome, passos, adianta) passa pelo filtro daqui: endereco, URL com chave, @nome e nome de pessoa
const fs = require('node:fs'), path = require('node:path');
const ASSETS = { '/entregas.js': ['entregas.js', 'text/javascript'], '/entregas.css': ['entregas.css', 'text/css'] };
const ARQUIVO = path.join('estado', 'entregas.json');
const MAX_BYTES = 512000;
const VELHO_MIN = 180;      // mais de 3 h sem reescrever = velho
const FUTURO_MIN = 15;      // hora mais de 15 min a frente do relogio desta maquina = hora suspeita
const QUASE = 0.8;          // 80% ou mais = quase la
const ORDEM = ['Terminal', 'Assistente', 'ARENA', 'Painel', 'PROJ', 'Cortes', 'Loja']; // pela chave sem acento ("Cortes" = "Cortes")
const SOLUCAO = 'A sua sessão principal refaz a lista de entregas; o painel lê de novo sozinho a cada minuto.';
const NEUTRO = { nome: 'Entrega com detalhe só no chat', passo: 'Passo com detalhe só no chat' };

// chave sem acento: "Cortes" e "Cortes" sao o mesmo projeto
const chave = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
// mesma lista PESSOAS do codex-sessoes.cjs (o teste confere que seguem iguais); so ela, nao o filtro da casa inteiro
// (o da casa fecharia "Relatorio: raio-x do mes", que e nome de entrega)
const PESSOAS = require('./sigilo-pessoas.cjs').PESSOAS;
const ENDERECO = /\b0x[0-9a-fA-F]{40}\b/;
const URL_CHAVE = /[?&#;](?:api[-_]?key|apikey|key|token|access[-_]?token|secret|senha|password|auth)=/i;
const ARROBA = /(?<![\w.])@[A-Za-z0-9_]{2,}/;
// base58 (carteira de rede): 32 a 44 letras do alfabeto base58 com numero, maiuscula e minuscula juntos (palavra comprida nao cai)
const base58 = s => s.split(/[^1-9A-HJ-NP-Za-km-z]+/).some(t => t.length >= 32 && t.length <= 44 && /\d/.test(t) && /[A-Z]/.test(t) && /[a-z]/.test(t));
function reservado(s) { const v = String(s || ''); return ENDERECO.test(v) || URL_CHAVE.test(v) || ARROBA.test(v) || base58(v) || PESSOAS.test(chave(v).toLowerCase()); }
const texto = (v, max = 300, neutro = '') => { if (typeof v !== 'string') return ''; const t = v.replace(/\s+/g, ' ').trim().slice(0, max); return t && reservado(t) ? neutro : t; };
const um = n => Math.round(n * 10) / 10; // horas com 1 casa (0.6 + 0.2 + 0.5 = 1.3, nunca 1.3000000000000003)
const soma = l => um(l.reduce((a, x) => a + x.peso, 0));
// trava no "adianta": esperando alguem, depende de alguem, nao da para pular (a tela pinta neutro, nunca verde)
const TRAVA = /esper|aguard|depend|n[aã]o d[aá]|trava|bloque|s[oó] anda|s[oó] sai|precisa d/i;

// 1 entrega: % pelos pesos conhecidos, passos na frente, proximo passo e a cor
function calcular(e) {
  const base = { id: texto(e && e.id, 80) || null, projeto: texto(e && e.projeto, 40) || 'Outros', nome: texto(e && e.nome, 200, NEUTRO.nome) || '?', dono: texto(e && e.dono, 40) || null, adianta: texto(e && e.adianta, 300) };
  const passos = e && Array.isArray(e.passos) ? e.passos : null;
  const pesoOk = p => p === null || (Number.isFinite(p) && p >= 0);
  const validos = passos && passos.length > 0 && passos.every(p => p && typeof p === 'object' && pesoOk(p.peso) && typeof p.feito === 'boolean');
  const vazio = { pct: null, estado: 'sem-leitura', horasFeitas: null, horasTotal: null, horasNaFrente: null, semPeso: 0, horasObra: null, obraSemPeso: 0, naFrente: [], proximo: null, adiantaLivre: false };
  if (!validos) return { ...base, lido: false, ...vazio, motivo: passos && passos.length ? 'passo sem peso ou sem feito' : 'sem passos' };
  let feitas = 0, total = 0;
  for (const p of passos) { if (p.peso === null) continue; total += p.peso; if (p.feito) feitas += p.peso; }
  const naFrente = passos.filter(p => !p.feito).map(p => ({ nome: texto(p.nome, 160, NEUTRO.passo) || '?', peso: p.peso === null ? null : um(p.peso), dependeDele: p.dependeDele === true, deFora: p.deFora === true }));
  const temSemPeso = passos.some(p => p.peso === null);
  if (!(total > 0) && !temSemPeso) return { ...base, lido: false, ...vazio, naFrente, proximo: naFrente[0] || null, motivo: 'pesos somam zero' };
  const proximo = naFrente[0] || null, razao = total > 0 ? feitas / total : null;
  // piso, nunca arredondar para cima: 99,6% fica 99 (100 so com tudo feito); 80,6% fica 80 e e verde, igual a legenda.
  // Sem nenhum peso conhecido o % fica "?" (null), nunca 0
  const pct = !naFrente.length ? 100 : razao === null ? null : Math.min(99, Math.floor(razao * 100 + 1e-9));
  const estado = !naFrente.length ? 'pronta' : proximo.dependeDele ? 'voce' : razao !== null && razao >= QUASE - 1e-9 ? 'quase' : 'obra';
  const conhecidos = naFrente.filter(x => x.peso !== null), obra = naFrente.filter(x => !x.dependeDele);
  const trava = estado === 'voce' || naFrente.some(x => x.dependeDele || x.deFora) || (e && e.trava === true) || TRAVA.test(base.adianta);
  return {
    ...base, lido: true, pct, estado, horasFeitas: um(feitas), horasTotal: um(total),
    horasNaFrente: soma(conhecidos), semPeso: naFrente.length - conhecidos.length,
    horasObra: soma(obra.filter(x => x.peso !== null)), obraSemPeso: obra.filter(x => x.peso === null).length,
    naFrente, proximo, adiantaLivre: !!base.adianta && !trava
  };
}

function idade(atualizadoEm, now) {
  const t = typeof atualizadoEm === 'string' ? Date.parse(atualizadoEm) : NaN;
  if (!Number.isFinite(t)) return { idadeMin: null, velho: null, futuro: false };
  const min = Math.round((now - t) / 60000);
  return { idadeMin: Math.max(0, min), velho: min > VELHO_MIN, futuro: min < -FUTURO_MIN };
}

// o arquivo inteiro: grupos por projeto (na ordem da casa), as 3 mais perto de sair e as que dependem do dono
function montar(json, now = Date.now()) {
  if (!json || typeof json !== 'object' || Array.isArray(json) || !Array.isArray(json.entregas)) return { ok: false, lido: false, motivo: 'quebrado', detalhe: 'sem a lista de entregas', solucao: SOLUCAO };
  const vistos = new Set();
  const entregas = json.entregas.slice(0, 200).map((x, i) => { const e = calcular(x); if (!e.id || vistos.has(e.id)) e.id = (e.id || 'entrega') + '-' + (i + 1); vistos.add(e.id); return e; });
  const grupos = new Map();
  for (const e of entregas) { const k = chave(e.projeto); if (!grupos.has(k)) grupos.set(k, { nome: e.projeto, l: [] }); grupos.get(k).l.push(e); }
  const pos = k => { const i = ORDEM.indexOf(k); return i < 0 ? 99 : i; };
  const chaves = [...grupos.keys()].sort((a, b) => pos(a) - pos(b));
  const projetos = chaves.map(k => { const { nome, l } = grupos.get(k); return { projeto: nome, chave: k, entregas: l, quantas: l.length, esperamVoce: l.filter(e => e.estado === 'voce').length, prontas: l.filter(e => e.estado === 'pronta').length }; });
  const abertas = entregas.filter(e => e.lido && e.estado !== 'pronta');
  const ordem = (a, b) => (b.pct ?? -1) - (a.pct ?? -1) || a.horasNaFrente - b.horasNaFrente;
  const perto = abertas.filter(e => e.estado !== 'voce').sort(ordem).slice(0, 3).map(e => e.id);
  const esperamVoce = abertas.filter(e => e.estado === 'voce').sort(ordem).map(e => e.id);
  const id = idade(json.atualizadoEm, now);
  return {
    ok: true, lido: true, lidoEm: new Date(now).toISOString(), atualizadoEm: typeof json.atualizadoEm === 'string' ? json.atualizadoEm : null, ...id,
    regraVelho: 'mais de 3 h sem a sua sessão principal refazer a lista', solucao: SOLUCAO, fonte: texto(json.fonte, 300), regra: texto(json.regra, 600),
    quantas: entregas.length, semLeitura: entregas.filter(e => !e.lido).length, projetos, perto, esperamVoce
  };
}

function ler(root, now = Date.now()) {
  if (!root) return { ok: false, lido: false, motivo: 'ausente', detalhe: 'pasta do estado desconhecida', solucao: SOLUCAO };
  const arq = path.join(root, ARQUIVO);
  let st; try { st = fs.lstatSync(arq); } catch { return { ok: false, lido: false, motivo: 'ausente', detalhe: 'a lista ainda não foi gravada', solucao: SOLUCAO }; }
  if (!st.isFile()) return { ok: false, lido: false, motivo: 'quebrado', detalhe: 'não é um arquivo comum', solucao: SOLUCAO };
  if (st.size > MAX_BYTES) return { ok: false, lido: false, motivo: 'quebrado', detalhe: 'grande demais', solucao: SOLUCAO };
  let json; try { json = JSON.parse(fs.readFileSync(arq, 'utf8').replace(/^﻿/, '')); } catch { return { ok: false, lido: false, motivo: 'quebrado', detalhe: 'arquivo incompleto ou com erro de escrita', solucao: SOLUCAO }; }
  return montar(json, now);
}

function handle(req, url, { send, root, example = false }) {
  const asset = ASSETS[url.pathname], api = url.pathname === '/api/entregas';
  if (!asset && !api) return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') { send(405, { ok: false, error: 'Somente leitura' }); return true; }
  if (asset) { try { send(200, fs.readFileSync(path.join(__dirname, asset[0])), asset[1]); } catch { send(404, { ok: false, error: 'Arquivo ausente' }); } return true; }
  if (example) { send(200, { ok: false, lido: false, exemplo: true, motivo: 'exemplo', solucao: 'Abra o painel normal para ver as entregas.' }); return true; }
  let j; try { j = ler(root); } catch { j = { ok: false, lido: false, motivo: 'quebrado', detalhe: 'leitura falhou', solucao: SOLUCAO }; }
  send(200, j);
  return true;
}

module.exports = { handle, ler, montar, calcular, idade, reservado, chave, ORDEM, VELHO_MIN, SOLUCAO, PESSOAS };
