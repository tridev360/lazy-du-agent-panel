'use strict';
// painel-projetos/projetos.json (a fonte automática que o gerador de projetos grava a cada 15 min). SO LEITURA.
const fs = require('node:fs');
const path = require('node:path');
const M = require('./mastigar.cjs');
const H = 3600000, MIN = 60000;
const LIMITES = Object.freeze({ maoMs: 6 * H, creditoDaVezMs: 2 * H, creditoParadaMs: 26 * H, projetosMs: 45 * MIN, consumoMs: 2 * H, cerebroMs: 26 * H, financasMs: 72 * H, voltaMs: 60 * MIN });
const CAMPOS_MAO = Object.freeze(['noAr', 'travado', 'voce', 'acelerar']);
const SOLUCAO = Object.freeze({
  mao: 'confirme ou apague este texto',
  maoSemHora: 'confirme ou apague este texto',
  creditoDaVez: 'registre uma leitura atual do consumo',
  creditoParada: 'registre uma leitura atual do consumo desta conta',
  projetos: 'o gerador de projetos roda a cada 15 min (configure um agendador para rodar demo/gerar.cjs ou o seu gerador)',
  consumo: 'sem leitura de tokens; registre o consumo no estado do painel e atualize a tela; até lá o número fica "?"',
  cerebro: 'gere o grafo de novo a partir da pasta de memória',
  financas: 'você lança os valores no formulário Salvar dados, ou registre o que falta em um card',
  plano: 'atualize o plano no 1º tique do dia (rotina diária, passo 1)'
});
const idadeMsDe = (at, now) => Number.isFinite(at) && at <= now + 120000 ? Math.max(0, now - at) : null;
const ha = (at, now) => { const m = M.idadeDe(at, now); const t = M.idadeTexto(m); return t; };
// "? <motivo>. Solução: <solução>"  (nunca "?" sozinho)
const interrogacao = (motivo, solucao) => '? ' + String(motivo).replace(/[.\s]+$/, '') + '. Solução: ' + solucao;
// selo de idade de um dado: em (ISO ou null), idade, "há N h", velho (passou do limite ou sem hora)
function selo(em, now, limiteMs) {
  const at = M.ms(em), idade = idadeMsDe(at, now);
  return { em: Number.isFinite(at) && idade !== null ? new Date(at).toISOString() : null, idadeMin: idade === null ? null : Math.floor(idade / MIN), idadeTexto: idade === null ? null : ha(at, now), semHora: idade === null, velho: idade === null || idade > limiteMs };
}
const vazioMao = v => v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);
// A hora de cada texto escrito a mão (noAr, travado, voce, acelerar), pelo maoEm que o estado-auto grava só quando o texto muda
function maoDoEstado(raw, now = Date.now()) {
  const em = raw && typeof raw.maoEm === 'object' && raw.maoEm && !Array.isArray(raw.maoEm) ? raw.maoEm : {};
  const out = {};
  for (const campo of CAMPOS_MAO) {
    const s = selo(em[campo], now, LIMITES.maoMs), vazio = vazioMao(raw && raw[campo]);
    out[campo] = { ...s, vazio, velho: !vazio && s.velho, texto: vazio ? null : s.semHora ? 'texto escrito pela sua IA, sem hora gravada' : 'texto escrito pela sua IA, escrito ' + s.idadeTexto, solucao: s.semHora ? SOLUCAO.maoSemHora : SOLUCAO.mao };
  }
  return out;
}
const fraseMaoVelha = m => interrogacao(m.semHora ? 'texto escrito pela sua IA sem hora de quando foi escrito' : 'texto escrito pela sua IA escrito ' + m.idadeTexto + ' (passou de 6 h)', m.solucao);

// ---------- painel-projetos/projetos.json ----------
const REL_PROJETOS = 'casa/ferramentas/painel-projetos/projetos.json';
let memo = null;
function lerProjetosCru(root) {
  const file = path.join(root, REL_PROJETOS);
  const st = fs.lstatSync(file);
  if (!st.isFile() || st.isSymbolicLink() || st.size > 8 * 1024 * 1024) return null;
  if (memo && memo.file === file && memo.mtimeMs === st.mtimeMs && memo.size === st.size) return memo.v;
  const j = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  const features = [];
  for (const p of Array.isArray(j.projetos) ? j.projetos : []) for (const f of Array.isArray(p.features) ? p.features : []) {
    features.push({ id: String(f.id || ''), nome: String(f.nome || ''), projeto: String(p.nome || f.projeto || ''), projetoId: String(p.id || ''), etapa: String(f.etapa || ''), dono: String(f.dono || ''), prazo: f.prazo && typeof f.prazo === 'object' ? { texto: String(f.prazo.texto || ''), para: f.prazo.para || null, previsto: f.prazo.previsto === true, vencido: f.prazo.vencido === true, solucao: f.prazo.solucao || null, motivo: f.prazo.motivo || null } : null, ultimaAtualizacao: f.ultimaAtualizacao || null, naEtapaDesde: f.naEtapaDesde || null, falta: f.falta && typeof f.falta === 'object' ? { texto: String(f.falta.texto || ''), quem: f.falta.quem || null } : null });
  }
  const v = { geradoEm: j.geradoEm || null, resumo: j.resumo || null, interrogacoes: j.interrogacoes || null, etapas: Array.isArray(j.etapas) ? j.etapas : [], features };
  memo = { file, mtimeMs: st.mtimeMs, size: st.size, v };
  return v;
}
// ok=false: arquivo ausente/torto. velho=true: geradoEm passou de 45 min (3 voltas da tarefa de 15 min): o chamador mostra "?" + solução.
function lerProjetos(root, now = Date.now()) {
  let cru = null;
  try { cru = lerProjetosCru(root); } catch { cru = null; }
  if (!cru) return { ok: false, velho: true, motivo: 'painel-projetos/projetos.json sem leitura', solucao: SOLUCAO.projetos, features: [] };
  const s = selo(cru.geradoEm, now, LIMITES.projetosMs);
  return { ok: !s.semHora, ...s, geradoEm: s.em, fonte: REL_PROJETOS, resumo: cru.resumo, interrogacoes: cru.interrogacoes, features: cru.features, motivo: s.semHora ? 'projetos.json sem hora de geração' : s.velho ? 'projetos.json gerado ' + s.idadeTexto + ' (passou de 45 min)' : null, solucao: SOLUCAO.projetos };
}

// ---------- Lancamentos e Cronograma a partir do projetos.json (conserto 4) ----------
const dois = n => String(n).padStart(2, '0');
// dia e hora no relogio deste computador
const brtDia = at => { const d = new Date(at); return d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate()); };
const brtHora = at => { const d = new Date(at); return dois(d.getHours()) + ':' + dois(d.getMinutes()); };
const curto = (s, n) => String(s === undefined || s === null ? '' : s).replace(/\s+/g, ' ').replace(/[\u2013\u2014]/g, ',').trim().slice(0, n);
function curtoPalavra(s, n) { const t = curto(s, 2000); if (t.length <= n) return t; const corte = t.slice(0, n), i = corte.lastIndexOf(' '); return (i > n * 0.5 ? corte.slice(0, i) : corte).replace(/[\s,;:.\-]+$/, '') + '…'; }
const ESTADO_CRONO = { 'NO AR': 'feito', 'CARD DE UP': 'espera voce', REVISAO: 'rodando', EXECUCAO: 'rodando' };
const ESTADO_LANC = { 'NO AR': 'no ar', 'CARD DE UP': 'falta card', REVISAO: 'em revisao' };
const quemDe = dono => /codex/i.test(String(dono)) ? 'codex' : 'claude';
function sessaoDe(dono) {
  const cru = String(dono || '').split(/[|;(]/)[0].trim();
  if (!cru || /undefined|[A-Za-z]:[\\/]/.test(cru)) return '?';
  return M.nomeSessao(cru.split(/\s/)[0]) || curto(cru, 24);
}
// features -> { hoje (Cronograma), lancamentos, semPrevisao }
function itensDeProjetos(P, now = Date.now()) {
  const hojeDia = brtDia(now), hoje = [], lanc = [];
  let semPrevisao = 0;
  for (const f of P.features) {
    const nome = curtoPalavra(f.nome, 140); if (!nome) continue;
    const ult = M.ms(f.ultimaAtualizacao), para = f.prazo && f.prazo.previsto ? M.ms(f.prazo.para) : NaN, prev = Number.isFinite(para);
    const hojeUlt = Number.isFinite(ult) && ult <= now + 120000 && brtDia(ult) === hojeDia;
    // so a PREVISAO e hora a cumprir; a hora da ultima atualizacao vai marcada (horaFonte) e a tela nao poe "passou da hora" nem "hora fixa" nela
    const prevHoje = prev && brtDia(para) === hojeDia;
    if (hojeUlt || prevHoje) {
      const at = prevHoje ? para : ult;
      hoje.push({ id: 'projetos:' + f.id, hora: brtHora(at), horaFonte: prevHoje ? 'previsao' : 'atualizacao', o_que: nome, quem: quemDe(f.dono), estado: ESTADO_CRONO[f.etapa] || 'na fila', maxima: false, prazo: prev ? curtoPalavra(f.prazo.texto, 60) : null, depende: null, data: hojeDia, at: new Date(at).toISOString(), fixo: true, automatico: true });
    }
    const desde = M.ms(f.naEtapaDesde), noArHoje = f.etapa === 'NO AR' && Number.isFinite(desde) && now - desde <= 24 * H;
    if (f.etapa === 'CARD DE UP' || (prev && f.etapa !== 'NO AR') || noArHoje) {
      if (!prev && f.etapa !== 'NO AR') semPrevisao++;
      const falta = f.falta && f.falta.texto ? curto(f.falta.texto, 110) : '?';
      lanc.push({ id: 'proj:' + f.id, dia: prev ? brtDia(para) : null, ate: null, hora: prev ? brtHora(para) : '?', o_que: nome, sessao: sessaoDe(f.dono), estado: ESTADO_LANC[f.etapa] || 'em obra', depende: falta + (prev && f.prazo.vencido && f.etapa !== 'NO AR' ? ' · previsão vencida: era ' + brtHora(para) + ' de ' + brtDia(para).slice(8) + '/' + brtDia(para).slice(5, 7) : '') + (!prev && f.etapa !== 'NO AR' ? ' · previsão: ? Solução: a sessão do projeto grava "previsao: ..." no Log da task' : ''), prazo_duro: false });
    }
  }
  hoje.sort((a, b) => a.hora.localeCompare(b.hora));
  lanc.sort((a, b) => (a.dia || '9999').localeCompare(b.dia || '9999') || a.hora.localeCompare(b.hora));
  return { hoje: hoje.slice(0, 40), lancamentos: lanc.slice(0, 60), semPrevisao };
}
function lancamentosComProjetos(base, root, now = Date.now()) {
  let P = null; try { P = lerProjetos(root, now); } catch { P = null; }
  if (!P || !P.ok || P.velho) return { ...base, fonteAuto: { ok: false, motivo: P ? P.motivo : 'projetos.json sem leitura', solucao: SOLUCAO.projetos } };
  const a = itensDeProjetos(P, now);
  // o gerador nao traz prazo duro. Enquanto nao houver fonte de verdade, o prazo duro da lista a mao segue na tela (botao e linha do tempo), com a idade da lista.
  const duro = base && base.nextHard ? base.nextHard : null, idadeLista = base && base.updated ? M.idadeTexto(M.idadeDe(base.updated, now)) : null;
  const diaLista = base && base.updated ? String(M.dataTexto(base.updated) || '').split(',')[0] : null;
  const listaMao = duro ? { updated: base.updated || null, dataTexto: diaLista, idadeTexto: idadeLista } : null;
  const items = a.lancamentos.slice();
  if (duro) items.push({ ...duro, id: 'mao:' + duro.id, depende: (duro.depende || '?') + ' · da lista à mão' + (diaLista ? ' de ' + diaLista : '') + (idadeLista ? ' (' + idadeLista + ')' : ''), listaMao });
  items.sort((x, y) => (x.dia || '9999').localeCompare(y.dia || '9999') || String(x.hora).localeCompare(String(y.hora)));
  const prazoDuroTexto = duro ? 'prazo duro: o do botão vem da lista à mão' + (diaLista ? ' de ' + diaLista : '') + (idadeLista ? ' (' + idadeLista + ')' : '') + '; o gerador não traz prazo duro. Solução: a sua sessão principal confere a data e regrava estado/lancamentos.json' : 'prazo duro: ? nenhum na lista à mão e o gerador não traz. Solução: você diz a data e sua IA grava o prazo na lista em estado/lancamentos.json';
  return { updated: P.geradoEm, items, nextHard: duro ? { ...duro, id: 'mao:' + duro.id, listaMao } : null, velho: false, motivoVelho: null, fonteAuto: { ok: true, arquivo: P.fonte, geradoEm: P.geradoEm, idadeTexto: P.idadeTexto, n: items.length, semPrevisao: a.semPrevisao, prazoDuro: duro ? 'lista à mão' : '?', prazoDuroTexto }, listaAntiga: { updated: base ? base.updated : null, n: base && base.items ? base.items.length : 0 } };
}
// /api/cronograma: o Hoje vem do gerador (itens com hora real); o plano escrito a mao fica como texto com idade e solucao
function cronogramaComProjetos(c, root, now = Date.now()) {
  if (!c || typeof c !== 'object') return c;
  const plano = selo(c.atualizado, now, 24 * H);
  c.plano = { escritoEm: plano.em, idadeTexto: plano.idadeTexto, velho: plano.velho, solucao: SOLUCAO.plano };
  let P = null; try { P = lerProjetos(root, now); } catch { P = null; }
  if (!P || !P.ok || P.velho) { c.automatico = { ok: false, motivo: P ? P.motivo : 'projetos.json sem leitura', solucao: SOLUCAO.projetos }; return c; }
  const a = itensDeProjetos(P, now), tem = new Set((c.hoje || []).map(x => x && x.id).filter(Boolean));
  const novos = a.hoje.filter(x => !tem.has(x.id)).map(x => ({ ...x, recordedState: x.estado, receipt: null, dateReason: null, statusReason: null, historical: false }));
  c.hoje = [...(c.hoje || []), ...novos];
  c.automatico = { ok: true, arquivo: P.fonte, geradoEm: P.geradoEm, idadeTexto: P.idadeTexto, n: novos.length };
  return c;
}
module.exports = { itensDeProjetos, lancamentosComProjetos, cronogramaComProjetos, LIMITES, CAMPOS_MAO, SOLUCAO, H, MIN, idadeMsDe, ha, interrogacao, selo, maoDoEstado, fraseMaoVelha, lerProjetos, REL_PROJETOS };
