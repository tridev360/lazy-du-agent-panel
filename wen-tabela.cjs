'use strict';
// WEN EM TABELA. SO LEITURA: nada aqui grava, nada envia, nada sai da maquina.
// Monta, das fontes que o painel ja le, o que a tela do WEN mostra no lugar das 7 linhas (que seguem em "Mais"):
//   tabela    uma linha por frente: Frente | Progresso | Faltam | Tasks | Quem trabalha (selos: Claude laranja, Codex azul)
//             + rodape "Trabalhando agora" + selo "parada ha N min" quando a frente tem passo aberto e nenhuma sessao com sinal
//   acelerado as voltas da rotina de 15 min da ultima hora com resultado "acelerou" (campo ganho_min gravado na volta)
//   uso       a conta do Claude em uso e o Codex: % da semana, quando zera e tokens da ultima hora (arquivo do coletor)
//   economia  o que esta sendo feito para gastar menos, com o efeito (lista que a sua IA grava em estado/wen-economia.json)
// Fontes: lista de entregas (entregas-rota.cjs: % = horas dos passos feitos / horas de todos; Faltam = pesos nao feitos x 60),
//   sessoes e ajudantes do leitor do painel (descoberta.cjs: so metadados, nunca o texto), casadas com a frente pelo nome do projeto.
// Regra: fonte nao lida = null = "?" com a solucao; so "lido e nada" vira zero ou "ninguem agora". Nunca horario de relogio em "Faltam".
const fs = require('node:fs'), path = require('node:path');
const ER = require('./entregas-rota.cjs');

const MIN = 60000, H = 3600000;
const PARADA_MIN = 60;        // passo aberto e sem sinal de sessao ha mais de 60 min = parada
const ACEL_MIN = 60;          // janela do bloco Acelerado
const GANHO_MAX = 600;        // ganho_min acima disso (10 h numa volta) e erro de digitacao: vira "ganho ?"
const TOKENS_VELHO_MIN = 20;  // o arquivo de tokens da ultima hora com mais que isso vira "?"
const ECONOMIA_VELHA_H = 24;  // a lista de economia de mais de 24 h vai marcada como velha
const ECONOMIA_MAX = 8;
const SOLUCAO_LEITOR = 'rode node checar.cjs para conferir as pastas do Claude e do Codex';
const SOLUCAO_PESO = 'Solução: peça ao seu Claude para gravar o peso em horas dos passos de cada entrega';
const SOLUCAO_GANHO = 'Solução: peça ao seu Claude para gravar os minutos ganhos na volta';
const ARQ_VOLTAS = 'estado/rotina-voltas.jsonl', SOLUCAO_VOLTAS = 'Solução: peça à sua IA para gravar uma volta da rotina de 15 min';
const SOLUCAO_ECONOMIA = 'Solução: peça ao seu Claude para gravar a lista de economia do dia';
const SOLUCAO_TOKENS = 'Solução: rode node tokens-hora-coletor.cjs';
const NEUTRO_ACEL = 'aceleração (detalhe reservado)', NEUTRO_ECO = 'economia (detalhe reservado)', NEUTRO_EFEITO = 'efeito (detalhe reservado)';
const LEGENDA = Object.freeze([{ tipo: 'claude', texto: 'Claude', ajuda: 'sessão ou ajudante do Claude' }, { tipo: 'codex', texto: 'Codex', ajuda: 'sessão do Codex' }]);

// hora no relogio deste computador (o mesmo do resto da tela)
const hhmm = ms => { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
const fold = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// "Faltam": ate 180 min em minutos, ate 48 h em horas, depois em dias; zero minuto (peso 0 aberto) nao vira "~0 min"
const faltamDe = min => min === 0 ? '< 1 min' : min <= 180 ? '~' + min + ' min' : min <= 2880 ? '~' + Math.round(min / 60) + ' h' : '~' + Math.round(min / 1440) + ' d';
const vivo = s => s && s.state === 'working';

// ---------- a tabela (funcao pura: tudo entra por parametro; null = fonte nao lida) ----------
function rodapeDe({ sessoes }) {
  if (sessoes === null) return { sessoes: null, ajudantes: null, codex: null, texto: 'Trabalhando agora: ? sessões, ? ajudantes, ? Codex. Solução: ' + SOLUCAO_LEITOR + '.', selos: [{ tipo: 'claude', texto: '? sessões' }, { tipo: 'codex', texto: '? Codex' }] };
  const v = sessoes.filter(vivo), nS = v.filter(s => s.family === 'claude' && !s.parentId).length, nA = v.filter(s => s.parentId).length, nC = v.filter(s => s.family === 'codex' && !s.parentId).length;
  const selos = [{ tipo: 'claude', texto: plural(nS, 'sessão', 'sessões') }, { tipo: 'claude', texto: plural(nA, 'ajudante', 'ajudantes') }, { tipo: 'codex', texto: nC + ' Codex' }];
  return { sessoes: nS, ajudantes: nA, codex: nC, texto: 'Trabalhando agora: ' + selos.map(s => s.texto).join(', ') + '.', selos };
}
function projetoDaFrente(nome, projetos) {
  const alvo = fold(nome); if (!alvo || !Array.isArray(projetos)) return null;
  const p = projetos.find(x => x && (x.id === nome || fold(x.name) === alvo)); return p ? p.id : null;
}
function frenteDe(p, { sessoes, projetos, now }) {
  const abertas = p.entregas.filter(e => e.estado !== 'pronta');
  if (!abertas.length) return null;
  let feitas = 0, total = 0, horas = 0, semPeso = 0, tasks = 0, cards = 0;
  for (const e of abertas) {
    if (e.lido && e.horasTotal > 0) { feitas += e.horasFeitas; total += e.horasTotal; }
    if (e.lido) { horas += e.horasNaFrente || 0; semPeso += e.semPeso || 0; } else semPeso += 1;
    tasks += e.naFrente.length; cards += e.naFrente.filter(x => x.dependeDele).length;
  }
  const pct = total > 0 ? Math.min(99, Math.floor(feitas / total * 100 + 1e-9)) : null;
  const cor = pct === null ? 'sem' : pct >= 80 ? 'verde' : pct < 35 ? 'laranja' : 'azul';
  const faltamMin = horas > 0 || semPeso === 0 ? Math.round(horas * 60) : null, parcial = faltamMin !== null && semPeso > 0;
  const faltamTexto = faltamMin === null ? '?' : faltamDe(faltamMin) + (parcial ? ' + ?' : '');
  const chave = projetoDaFrente(p.projeto, projetos);
  const selos = [];
  let quem, quemPendente = null, quemSolucao = null, parada = null;
  if (sessoes === null) { quemPendente = '? sem leitura das sessões'; quemSolucao = 'Solução: ' + SOLUCAO_LEITOR; quem = quemPendente; }
  else {
    const daqui = chave ? sessoes.filter(s => s.projectId === chave) : [], v = daqui.filter(vivo);
    const nS = v.filter(s => s.family === 'claude' && !s.parentId).length, nA = v.filter(s => s.parentId).length, nC = v.filter(s => s.family === 'codex' && !s.parentId).length;
    if (nS) selos.push({ tipo: 'claude', texto: plural(nS, 'sessão', 'sessões') });
    if (nA) selos.push({ tipo: 'claude', texto: plural(nA, 'ajudante', 'ajudantes') });
    if (nC) selos.push({ tipo: 'codex', texto: nC + ' Codex' });
    quem = selos.length ? selos.map(s => s.texto).join(' + ') : 'ninguém agora';
    // parada: passo aberto e nenhuma sessao da frente com sinal ha mais de 60 min (sinal = ultimo registro de sessao ou ajudante)
    if (tasks > 0 && !v.length) {
      const sinais = daqui.map(s => Date.parse(s.lastAt)).filter(Number.isFinite), ultimo = sinais.length ? Math.max(...sinais) : null;
      if (ultimo === null) parada = { min: null, maisDe: true, tipo: 'sem-sessao', texto: 'nenhuma sessão nesta frente' };
      else { const idle = Math.round((now - ultimo) / MIN); if (idle > PARADA_MIN) parada = { min: idle, maisDe: false, tipo: 'parada', texto: 'parada há ' + idle + ' min' }; }
    }
  }
  return {
    chave: chave || fold(p.projeto).replace(/ /g, '-'), projeto: p.projeto, nome: p.projeto, pct, cor, faltamMin, faltamParcial: parcial, faltamTexto, tasks, cardsSeus: cards,
    cardsTexto: cards ? '(' + cards + (cards === 1 ? ' card seu)' : ' cards seus)') : '', selos, quem, quemPendente, quemSolucao, parada,
    solucao: pct === null || faltamMin === null ? SOLUCAO_PESO : null
  };
}
function montar({ entregas, sessoes = [], projetos = [], now = Date.now() }) {
  const base = { versao: 'wen-tabela-1', geradoEm: new Date(now).toISOString(), legenda: LEGENDA, rodape: rodapeDe({ sessoes }) };
  if (!entregas || entregas.ok !== true) return { ...base, ok: false, frentes: [], motivo: (entregas && (entregas.detalhe || entregas.motivo)) || 'sem leitura', solucao: (entregas && entregas.solucao) || ER.SOLUCAO };
  const frentes = entregas.projetos.map(p => frenteDe(p, { sessoes, projetos, now })).filter(Boolean);
  const em = Date.parse(entregas.atualizadoEm);
  return { ...base, ok: true, frentes, entregasEm: entregas.atualizadoEm || null, entregasHora: Number.isFinite(em) ? hhmm(em) : null, entregasIdadeMin: entregas.idadeMin, entregasVelha: entregas.velho === true, solucao: entregas.solucao };
}

// ---------- Acelerado ----------
function lerJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch { return null; } }
function rotinaDe({ estado, voltas, now }) {
  const cfg = lerJson(path.join(estado, 'estado', 'rotina.json')) || {}, ciclo = Number.isFinite(cfg.ciclo_min) && cfg.ciclo_min > 0 ? cfg.ciclo_min : 15;
  const rot = 'Rotina de ' + ciclo + ' min';
  if (!voltas) return { ligada: null, texto: '? ' + rot + ' sem leitura das voltas. ' + SOLUCAO_VOLTAS + '.' };
  if (cfg.ligado === false) return { ligada: false, texto: rot + ': desligada.' };
  const ultima = voltas.length ? Date.parse(voltas[0].em) : NaN, idade = Math.round((now - ultima) / MIN);
  if (!Number.isFinite(ultima) || idade > 2 * ciclo) return { ligada: false, texto: '? ' + rot + ' sem volta' + (Number.isFinite(ultima) ? ' há ' + idade + ' min (última ' + hhmm(ultima) + ')' : ' gravada') + '. Solução: peça ao seu Claude para religar a rotina.' };
  const agora = new Date(now).getMinutes(), minutos = Array.isArray(cfg.minutos) ? cfg.minutos.filter(Number.isFinite).sort((a, b) => a - b) : [];
  const prox = minutos.length ? (minutos.find(m => m > agora) ?? minutos[0] + 60) - agora : Math.max(1, ciclo - idade);
  return { ligada: true, texto: rot + ': ligada, próxima volta em ~' + prox + ' min.' };
}
// o mesmo filtro de texto de gente do rotina.cjs: travessao vira virgula, sem espaco antes da pontuacao
const TRAVESSOES = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']', 'g');
const textoDeGente = v => String(v).replace(TRAVESSOES, ',').replace(/\s+/g, ' ').replace(/\s+([,.;)])/g, '$1').replace(/,{2,}/g, ',').replace(/^[,\s]+/, '').trim();
const limpa = (v, max) => { if (typeof v !== 'string') return ''; const t = textoDeGente(v); return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t; };
function acelerado({ estado, now = Date.now() }) {
  const base = { versao: 'acelerado-1', janelaMin: ACEL_MIN, fonte: 'estado/rotina-voltas.jsonl', campo: 'ganho_min', itens: [], totalGanhoMin: null, semGanho: 0, ultima: null };
  let voltas = null;
  try { if (estado && fs.existsSync(path.join(estado, 'estado', 'rotina-voltas.jsonl'))) voltas = require('./rotina.cjs').voltasPublicas(estado, now); } catch { voltas = null; }
  const rotina = rotinaDe({ estado, voltas, now });
  if (!voltas) return { ...base, ok: false, texto: '? voltas da rotina sem leitura', solucao: SOLUCAO_VOLTAS, rotina };
  const acel = voltas.filter(v => v.resultado === 'acelerou' && v.em && Date.parse(v.em) <= now + 2 * MIN);
  const dentro = acel.filter(v => now - Date.parse(v.em) <= ACEL_MIN * MIN), vistos = new Set(), itens = [];
  for (const v of dentro) {
    const cru = (v.detalhe ? textoDeGente(v.detalhe) : '') || 'aceleração sem descrição na volta', texto = ER.reservado(cru) ? NEUTRO_ACEL : cru, corte = texto.length > 160 ? texto.slice(0, 159).trimEnd() + '…' : texto;
    if (vistos.has(corte)) continue; vistos.add(corte);
    itens.push({ em: v.em, hora: hhmm(Date.parse(v.em)), texto: corte, ganhoMin: v.ganhoMin, ganhoTexto: v.ganhoMin === null ? 'ganho ?' : 'ganhou ~' + v.ganhoMin + ' min', solucao: v.ganhoMin === null ? SOLUCAO_GANHO : null });
  }
  const conhecidos = itens.filter(i => i.ganhoMin !== null), ult = acel[0] ? Date.parse(acel[0].em) : NaN;
  return { ...base, ok: true, itens, totalGanhoMin: conhecidos.length ? conhecidos.reduce((a, i) => a + i.ganhoMin, 0) : null, semGanho: itens.length - conhecidos.length, texto: itens.length ? null : 'none', ultima: Number.isFinite(ult) ? { hora: hhmm(ult), idadeMin: Math.round((now - ult) / MIN) } : null, rotina };
}

// ---------- tokens da ultima hora (o tokens-hora-coletor.cjs grava estado/tokens-hora.json; a tela so le o arquivo) ----------
const numTok = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e12 ? v : null;
const fmtTok = n => n >= 999500 ? (n / 1e6).toFixed(1).replace('.', ',') + ' mi' : n >= 1000 ? Math.round(n / 1e3) + ' mil' : String(Math.round(n));
function tokensIA(total, semCache) {
  const t = numTok(total), s = numTok(semCache);
  if (t === null || s === null || s > t) return { texto: '?', total: null, semCache: null, solucao: SOLUCAO_TOKENS };
  if (t === 0) return { texto: 'none', total: 0, semCache: 0, solucao: null };
  return { texto: '~' + fmtTok(t) + ' (' + (s < 500 ? '< 500' : '~' + fmtTok(s)) + ' sem cache)', total: t, semCache: s, solucao: null };
}
function tokensHora({ estado, now = Date.now() }) {
  const vazio = motivo => ({ ok: false, motivo, hora: null, idadeMin: null, claude: tokensIA(), codex: tokensIA() });
  const j = estado ? lerJson(path.join(estado, 'estado', 'tokens-hora.json')) : null;
  if (!j || typeof j !== 'object') return vazio('sem leitura dos tokens da última hora');
  const em = Date.parse(j.atualizado); if (!Number.isFinite(em)) return vazio('hora do arquivo de tokens ilegível');
  const idade = Math.round((now - em) / MIN), base = { hora: hhmm(em), idadeMin: idade };
  if (em > now + 2 * MIN) return { ...vazio('hora do arquivo de tokens no futuro'), ...base };
  if (idade > TOKENS_VELHO_MIN) return { ...vazio('arquivo de tokens com ' + idade + ' min (passa de ' + TOKENS_VELHO_MIN + ')'), ...base };
  return { ok: true, motivo: null, ...base, claude: tokensIA(j.claude_total, j.claude_sem_cache), codex: tokensIA(j.codex_total, j.codex_sem_cache) };
}

// ---------- Uso de cada IA ----------
function zeraDe(zeraEm, now) {
  const alvo = Date.parse(zeraEm); if (!Number.isFinite(alvo) || alvo <= now) return '?';
  const ms = alvo - now, d = Math.floor(ms / (24 * H)), h = Math.floor((ms - d * 24 * H) / H), m = Math.floor((ms - d * 24 * H - h * H) / MIN);
  return d > 0 ? '~' + d + ' d ' + h + ' h' : h > 0 ? '~' + h + ' h ' + m + ' min' : '~' + Math.max(1, m) + ' min';
}
const corUso = pct => pct === null ? 'sem' : pct >= 90 ? 'vermelho' : pct >= 75 ? 'laranja' : 'azul';
function linhaUso(ia, rotulo, c, now) {
  if (!c) return { ia, rotulo, pct: null, cor: 'sem', zeraTexto: '?', obs: '? sem leitura' };
  const pct = typeof c.usadoPct === 'number' && !c.velho ? c.usadoPct : null;
  const obs = c.velho || pct === null ? '? ' + (c.motivo || 'sem leitura') + (c.solucao ? '. Solução: ' + c.solucao : '') : c.lidoTexto || '';
  return { ia, rotulo, pct, cor: corUso(pct), zeraTexto: zeraDe(c.zeraEm, now), obs };
}
function usoIA({ credito, tokens, now = Date.now() }) {
  if (!credito || credito.ok !== true) return { ok: false, linhas: [], motivo: 'leitura do uso sem resposta', solucao: 'Solução: rode /usage no Claude Code para conferir seu plano' };
  const contas = credito.claude && Array.isArray(credito.claude.contas) ? credito.claude.contas : [], vez = contas.find(c => c.daVez) || contas[0] || null;
  const claude = vez ? linhaUso('claude', 'Claude' + (vez.conta ? (/\bconta\b/i.test(vez.conta) ? ', ' : ', conta ') + vez.conta.replace(/^Sua conta$/i, 'sua conta') : '') + ' (em uso)', vez, now) : { ia: 'claude', rotulo: 'Claude', pct: null, cor: 'sem', zeraTexto: '?', obs: '? sem leitura da conta do Claude. Solução: rode /usage no Claude Code para conferir seu plano' };
  const T = tokens || { ok: false, hora: null, claude: tokensIA(), codex: tokensIA() };
  const comTokens = (l, ia) => ({ ...l, tokens: { ...T[ia], obs: T.hora ? 'lido às ' + T.hora + (T.ok ? '' : ', velho') : '' } });
  return { ok: true, linhas: [comTokens(claude, 'claude'), comTokens(linhaUso('codex', 'Codex', credito.codex, now), 'codex')] };
}

// ---------- Economia: o que esta sendo feito para gastar menos, com o efeito (estado/wen-economia.json) ----------
function economia({ estado, now = Date.now() }) {
  const sem = motivo => ({ versao: 'economia-1', ok: false, linhas: [], texto: '?', motivo, solucao: SOLUCAO_ECONOMIA, hora: null, velha: false });
  const j = estado ? lerJson(path.join(estado, 'estado', 'wen-economia.json')) : null;
  if (!j || typeof j !== 'object' || Array.isArray(j)) return sem('lista de economia sem leitura');
  if (!Array.isArray(j.linhas)) return sem('lista de economia em formato inválido');
  const em = Date.parse(j.atualizado), linhas = [];
  for (const x of j.linhas) {
    if (!x || typeof x !== 'object') continue;
    const frase = limpa(x.frase, 160), efeito = limpa(x.efeito, 100); if (!frase) continue;
    linhas.push({ frase: ER.reservado(frase) ? NEUTRO_ECO : frase, efeito: !efeito ? null : ER.reservado(efeito) ? NEUTRO_EFEITO : efeito });
    if (linhas.length >= ECONOMIA_MAX) break;
  }
  return { versao: 'economia-1', ok: true, linhas, texto: linhas.length ? null : 'none', motivo: null, solucao: null, hora: Number.isFinite(em) ? hhmm(em) : null, velha: Number.isFinite(em) ? now - em > ECONOMIA_VELHA_H * H || em > now + 2 * MIN : true };
}

// ---------- tudo junto (a rota /api/pe-equipe/wen chama isto pelo wen-vivo.cjs) ----------
function sessoesDoLeitor(ctx, now) { // null = o leitor nao respondeu; lista vazia = lido e nada
  if (ctx.snapshot) return ctx.snapshot;
  try { const s = require('./descoberta.cjs').snapshot({ now }); return s && Array.isArray(s.sessions) ? s : null; } catch { return null; }
}
// o leitor manda as sessoes em sessions e os ajudantes em helpers: a tabela conta os dois (sem repetir o mesmo id)
function sessoesDe(snap) {
  if (!snap || !Array.isArray(snap.sessions)) return null;
  const vistos = new Set(), out = [];
  for (const s of [...snap.sessions, ...(Array.isArray(snap.helpers) ? snap.helpers : [])]) { if (!s || vistos.has(s.id)) continue; vistos.add(s.id); out.push(s); }
  return out;
}
function gerar(ctx = {}) {
  const now = ctx.now || Date.now(), estado = ctx.estado;
  const seguro = (f, falha) => { try { return f(); } catch { return falha; } };
  const falha = { ok: false, frentes: [], motivo: 'erro ao ler as fontes', solucao: 'Solução: abra de novo em 1 minuto; se seguir, ' + SOLUCAO_LEITOR };
  const snap = sessoesDoLeitor(ctx, now);
  const tabela = seguro(() => montar({ entregas: ER.ler(estado, now), sessoes: snap ? sessoesDe(snap) : null, projetos: snap ? snap.projects : [], now }), falha);
  return {
    tabela,
    acelerado: seguro(() => acelerado({ estado, now }), { ok: false, itens: [], texto: '? sem leitura', solucao: SOLUCAO_VOLTAS }),
    uso: seguro(() => usoIA({ credito: ctx.credito, tokens: tokensHora({ estado, now }), now }), { ok: false, linhas: [] }),
    economia: seguro(() => economia({ estado, now }), { ok: false, linhas: [], texto: '?', solucao: SOLUCAO_ECONOMIA })
  };
}
function vazio() {
  const motivo = 'modo exemplo: sem dado real';
  return { tabela: { ok: true, exemplo: true, frentes: [], motivo, rodape: null, legenda: LEGENDA }, acelerado: { ok: true, exemplo: true, itens: [], texto: 'none', motivo, rotina: null }, uso: { ok: true, exemplo: true, linhas: [], motivo }, economia: { ok: true, exemplo: true, linhas: [], texto: 'none', motivo } };
}
module.exports = { montar, sessoesDe, rodapeDe, frenteDe, acelerado, usoIA, tokensHora, economia, gerar, vazio, hhmm, LEGENDA, PARADA_MIN, ACEL_MIN, GANHO_MAX };
