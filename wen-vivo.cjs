'use strict';
// Linhas: No ar | Rodando (com hora) | Pronto esperando a sessao | Travado por | So acelera se | Seu proximo passo | Credito.
// Cada linha leva a hora da fonte (fonteEm) e vira "?" com o motivo quando a fonte falta ou passa de 60 min.
// Fontes: estado/estado-agora.json, estado/cards/*.json (sem "respondido"), estado/coordenador-frentes.md (so a hora),
// codex-sessoes.cjs (Codex rodando e pronto nao buscado, medido nas conversas e na VPS), credito-fresco.cjs (Claude e Codex).
// Cache de 1 min. Rota: GET /api/pe-equipe/wen (pe-equipe.cjs).
const fs = require('node:fs');
const path = require('node:path');
const cs = require('./codex-sessoes.cjs');

const VELHO = 60 * 60000, TTL = 60000;
const F = require('./frescor.cjs'), A = require('./agora-nucleo.cjs');
const hora = ms => { if (!Number.isFinite(ms)) return null; const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
function lerJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); } catch { return null; } }
const texto = v => Array.isArray(v) ? v.map(x => typeof x === 'string' ? x : x && (x.o_que || x.passo || x.espera || x.texto) || '').filter(Boolean) : typeof v === 'string' && v.trim() ? [v] : [];
// opc.limiteMin: acima disso a linha vira "?" (60 min para leitura; 360 para escrito pela sua IA; Infinity para a ultima subida, que e fato e nao leitura)
function linha(chave, rotulo, partes, fonteEm, fonte, now, motivoVazio, opc = {}) {
  const limite = opc.limiteMin !== undefined ? opc.limiteMin : VELHO / 60000;
  const idade = Number.isFinite(fonteEm) ? Math.round((now - fonteEm) / 60000) : null;
  const velho = idade === null || idade > limite;
  const limpo = partes.map(p => cs.limpo(p, 140)).filter(Boolean);
  const textoFinal = velho ? opc.textoVelho || '?' : limpo.length ? limpo.join(' · ') : 'none';
  const motivo = idade === null ? 'fonte sem leitura: ' + fonte : velho ? 'fonte com ' + idade + ' min (passa de ' + limite + ')' : !limpo.length ? motivoVazio || null : null;
  return { chave, rotulo, texto: textoFinal, fonteEm: Number.isFinite(fonteEm) ? new Date(fonteEm).toISOString() : null, fonteHora: hora(fonteEm), idadeMin: idade, velho, motivo, fonte };
}
let cache = null;
const SIGILO_PESSOAS = require('./sigilo-pessoas.cjs');
function gerar(ctx = {}) {
  return SIGILO_PESSOAS.rodarComo(false, () => gerarFechado(ctx));
}
async function gerarFechado(ctx = {}) {
  const now = ctx.now || Date.now();
  if (!ctx.fresh && cache && now - cache.at < TTL) return cache.value;
  const estado = ctx.estado || (process.env.PAINEL_ROOT || require('node:path').join(__dirname, 'demo', 'estado'));
  const ag = lerJson(path.join(estado, 'estado', 'estado-agora.json')) || {};
  const agEm = Date.parse(ag.atualizadoEm);
  let ags = null; try { ags = A.read(estado, now); } catch { ags = null; }
  const mao = ags && ags.ok && ags.mao ? ags.mao : F.maoDoEstado(ag, now);
  const maoMs = c => mao[c] && mao[c].em ? Date.parse(mao[c].em) : NaN;
  const tempoMao = c => mao[c].vazio ? agEm : maoMs(c); // campo vazio: nada escrito a mao para envelhecer (vale a leitura do script)
  const frase = c => mao[c].velho ? F.fraseMaoVelha(mao[c]) : null;
  const MAO_MIN = F.LIMITES.maoMs / 60000;
  // cards que esperam o dono (sem "respondido"), do mais velho ao mais novo
  const cards = []; let cardsEm = NaN;
  try {
    const dir = path.join(estado, 'estado', 'cards');
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      const st = fs.statSync(path.join(dir, f)); cardsEm = Math.max(Number.isFinite(cardsEm) ? cardsEm : 0, st.mtimeMs);
      const j = lerJson(path.join(dir, f)); if (!j || j.respondido || j.encerrado || j.substituidoPor) continue;
      if (!require('./cards300-nucleo.cjs').paraTela(j)) continue;
      cards.push({ id: String(j.id || f), sessao: String(j.sessao || '?'), pergunta: typeof j.pergunta === 'string' ? j.pergunta : null, em: st.mtimeMs });
    }
    cards.sort((a, b) => a.em - b.em);
  } catch { cardsEm = NaN; }
  let frentesEm = NaN; try { frentesEm = fs.statSync(path.join(estado, 'estado', 'coordenador-frentes.md')).mtimeMs; } catch { frentesEm = NaN; }
  let f2 = null; try { f2 = await cs.leituraRapida({ estado }); } catch { f2 = null; }
  const f2Em = f2 && f2.ok ? Date.parse(f2.lidoEm) : NaN;
  const rodando = [], pronto = [];
  for (const s of f2 && f2.ok ? f2.sessoes : []) for (const c of s.codex) {
    if (c.estado === 'rodando') rodando.push(s.sessao + ': ' + (c.titulo || 'Codex ' + c.ordem) + ' desde ' + hora(Date.parse(c.desde)));
    if (c.estado === 'terminou' && c.onde === 'vps' && Date.parse(c.fimEm) > now - 3 * 3600000 && pronto.length < 3) {
      const trazido = f2.fio.some(e => e.fonte && e.fonte.codex === c.id && /^Trouxe/.test(e.titulo));
      if (!trazido) pronto.push(s.sessao + ': ' + (c.titulo || 'Codex ' + c.ordem) + ' terminou ' + hora(Date.parse(c.fimEm)) + ' (busca não vista nas conversas)');
    }
  }
  const PN = require('./painel-numeros.cjs');
  let cred = null; try { cred = PN.credito(estado, now); } catch { cred = null; }
  let espera = null; try { espera = PN.esperaVoce(estado, now); } catch { espera = null; }
  // cada IA com a sua hora: a velha vira "?" com a hora lida e o ultimo numero, sem esconder a outra que esta fresca
  const parte = (c, nome) => { if (!c || !c.lidoEm) return nome + ' ? (sem leitura)'; if (c.usadoPct === null) return nome + ' ? (' + (c.ultimoTexto || c.motivo) + ')'; return nome + ' ' + c.texto + ' (lido ' + hora(Date.parse(c.lidoEm)) + (c.zeraTexto ? ', ' + c.zeraTexto : '') + ')'; };
  const daVez = cred ? cred.claude.contas.find(c => c.daVez) : null;
  const credLinha = cred ? [parte(daVez, daVez ? 'Claude ' + daVez.conta : 'Claude'), parte(cred.codex, 'Codex')] : [];
  const credEm = cred ? Math.max(...[daVez, cred.codex].map(c => c ? Date.parse(c.lidoEm) : NaN).filter(Number.isFinite)) : NaN;
  const lines = [
    ags && ags.ok && ags.noArFonte
      ? linha('noar', 'No ar', ags.noAr, Date.parse(ags.noArFonte.em), 'registro de subidas do estado (a mesma fonte do Agora)', now, 'nada no ar informado', { limiteMin: Infinity })
      : linha('noar', 'No ar', frase('noAr') ? [] : texto(ag.noAr), tempoMao('noAr'), 'estado/estado-agora.json (noAr, escrito pela sua IA); nenhuma subida lida)', now, 'nada no ar informado', { limiteMin: MAO_MIN, textoVelho: frase('noAr') }),
    linha('rodando', 'Rodando', rodando.length ? rodando : texto(ag.rodando), rodando.length ? f2Em : agEm, rodando.length ? 'Codex medidos nas conversas e na VPS (codex-sessoes.cjs)' : 'estado/estado-agora.json (rodando)', now, 'nenhum Codex rodando'),
    linha('pronto', 'Pronto esperando a sessão', pronto, f2Em, 'rodadas da VPS terminadas nas ultimas 3 h sem busca vista nas conversas (ate 3; codex-sessoes.cjs)', now, 'nada pronto esperando'),
    linha('travado', 'Travado por', [...(frase('travado') ? [frase('travado')] : texto(ag.travado)), ...(espera && espera.total ? [espera.rotulo] : cards.length ? [cards.length + ' card(s) esperando você'] : [])], Math.max(frase('travado') || !Number.isFinite(tempoMao('travado')) ? 0 : tempoMao('travado'), Number.isFinite(cardsEm) ? cardsEm : 0) || NaN, 'estado/estado-agora.json (travado, escrito pela sua IA) + estado/cards (sem respondido)', now, 'nada travado', { limiteMin: MAO_MIN, textoVelho: frase('travado') }),
    linha('acelerar', 'Só acelera se', frase('acelerar') ? [] : texto(ag.acelerar), tempoMao('acelerar'), 'estado/estado-agora.json (acelerar, escrito pela sua IA)', now, 'nada informado', { limiteMin: MAO_MIN, textoVelho: frase('acelerar') }),
    linha('proximo', 'Seu próximo passo', cards.length ? ['Responder o card "' + (cs.limpo(cards[0].pergunta, 80) || cards[0].id) + '" (' + cards[0].sessao + ')'] : frase('voce') ? [] : texto(ag.voce).slice(0, 1), cards.length ? cardsEm : tempoMao('voce'), cards.length ? 'estado/cards (o mais velho sem respondido)' : 'estado/estado-agora.json (voce, escrito pela sua IA)', now, 'nada esperando você', cards.length ? {} : { limiteMin: MAO_MIN, textoVelho: frase('voce') }),
    linha('credito', 'Crédito', credLinha, credEm, 'credito-fresco.cjs (Claude: credito-claude.jsonl e uso-claude.json; Codex: uso-codex.json)', now, null)
  ];
  // WEN em tabela: frentes, Acelerado, Uso de cada IA e Economia (wen-tabela.cjs); as 7 linhas acima seguem iguais
  let extra; try { extra = require('./wen-tabela.cjs').gerar({ estado, now, credito: cred, snapshot: ctx.snapshot }); } catch { extra = { tabela: { ok: false, frentes: [], motivo: 'erro ao ler as fontes', solucao: 'Solução: abra de novo em 1 minuto' }, acelerado: { ok: false, itens: [] }, uso: { ok: false, linhas: [] }, economia: { ok: false, linhas: [], texto: '?', solucao: 'Solução: peça ao seu Claude para gravar a lista de economia do dia' } }; }
  const value = { ok: true, versao: 'wen-vivo-1', geradoEm: new Date(now).toISOString(), geradoHora: hora(now), linhas: lines, ...extra, fontes: { estadoAgora: Number.isFinite(agEm) ? new Date(agEm).toISOString() : null, cards: Number.isFinite(cardsEm) ? new Date(cardsEm).toISOString() : null, coordenadorFrentes: Number.isFinite(frentesEm) ? new Date(frentesEm).toISOString() : null, codex: f2 && f2.ok ? f2.lidoEm : null }, cardsEsperando: cards.length, esperaVoce: espera ? { total: espera.total, rotulo: espera.rotulo, partes: espera.partes } : null };
  cache = { at: now, value };
  return value;
}
function vazio() { return { ...require('./wen-tabela.cjs').vazio(), ok: true, versao: 'wen-vivo-1', exemplo: true, geradoEm: null, geradoHora: null, linhas: ['noar', 'rodando', 'pronto', 'travado', 'acelerar', 'proximo', 'credito'].map(chave => ({ chave, rotulo: chave, texto: '?', fonteEm: null, fonteHora: null, idadeMin: null, velho: true, motivo: 'modo exemplo: sem dado real', fonte: null })), fontes: {}, cardsEsperando: null }; }
module.exports = { gerar, vazio };
