'use strict';
// Projecao de leitura. So campos usados pela tela.
const fs = require('node:fs'), path = require('node:path');
const F = require('./r10-fontes.cjs'), L = require('./link-sessao.cjs');
const incerto = solucao => ({ lido: false, valor: '?', erro: 'sem leitura', solucao, nota: 'sem leitura', itens: [] });
const lista = itens => ({ lido: true, erro: null, nota: itens.length ? null : 'none', itens });
const ms = v => typeof v === 'number' && Number.isFinite(v) ? v : Date.parse(v || '') || null;
const numero = v => Number.isFinite(v) && v >= 0;
const idSeguro = v => typeof v === 'string' && /^[\w:-]{1,240}$/.test(v) ? v : null;
// Pedido gravado por outra tela usa o id das conversas (claude:<caminho>/<uuid>.jsonl): vira o id da descoberta. Id que nao se le some (undefined).
const sessaoDe = v => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'string') return undefined;
  const m = /^(claude|codex):(?:.*[\\/])?(?:[^\\/]*-)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\.jsonl)?$/i.exec(v);
  return m ? m[1].toLowerCase() + ':' + m[2].toLowerCase() : idSeguro(v) || undefined;
};
function texto(v, max = 600) {
  if (typeof v !== 'string') return '';
  if (/PRIVADO|_SECRETS|backup-privado|BEGIN [A-Z ]*PRIVATE KEY|\b(?:seed phrase|mnemonic|private key|chave privada)\b/i.test(v)) return 'Detalhes na sessão';
  return require('./sigilo-pessoas.cjs').mascarar(require('./realtime.cjs').safeText(F.limpar(v), max)
    .replace(/\bAKIA[0-9A-Z]{16}\b|\beyJ[\w-]{5,}\.eyJ[\w-]{5,}\.[\w-]*|\b[a-f0-9]{64}\b/gi, '[chave]')
    .replace(/(?:\\\\[\w.$-]+\\|[A-Za-z]:[\\/]|\b(?:estado|src|public)[\\/]|\/(?:[\w.-]+[\\/])+|(?:[\w.-]+\\){2,})[^\s,;]*/g, '[arquivo]'));
}
function existe(root, rel, diretorio = false) {
  try { const s = fs.statSync(F.seguro(root, rel)); return diretorio ? s.isDirectory() : s.isFile(); } catch { return false; }
}
function linhas(root, rel) {
  if (!existe(root, rel)) return null;
  const rows = F.tail(root, rel);
  try { if (!rows.length && fs.statSync(F.seguro(root, rel)).size) return null; } catch { return null; }
  return rows;
}
function atalho(s, app) {
  const a = L.atalho({ family: s.family, id: s.id }, app);
  return a.link && L.linkValido(a.link) ? { linkSessao: a.link } : L.comandoValido(a.comando) ? { comandoRetomar: a.comando } : {};
}
function montar({ root, snapshot: s, app, cardsDataDir, agora = Date.now() }) {
  const sol = 'Confira as fontes em Recursos pessoais.';
  const agents = Array.isArray(s?.sessions) ? s.sessions : Array.isArray(s?.equipe?.agents) ? s.equipe.agents.filter(x => !x.parentId) : null;
  const helpers = Array.isArray(s?.helpers) ? s.helpers : Array.isArray(s?.equipe?.agents) ? s.equipe.agents.filter(x => x.parentId) : null;
  const projects = Array.isArray(s?.projects) ? s.projects : Array.isArray(s?.equipe?.projects) ? s.equipe.projects : null;
  const nome = x => texto(x.name || x.conversationName || x.conversation || x.title) || 'Sessão';
  const idade = at => Number.isFinite(ms(at)) ? Math.max(0, Math.floor((agora - ms(at)) / 60000)) : null;
  const cfg = F.config(root);
  // Sem app fornecido, a descoberta do app retorna apenas metadados.
  if (!app) { try { app = require('./sessoes-app.cjs').readSessions(); } catch { app = {}; } }
  let cards = null, cardsErro = false;
  if (existe(root, 'estado/cards', true)) {
    try {
      const l = require('./pc-cards/cards-nucleo.cjs').montarLista({ cardsDir: F.seguro(root, 'estado/cards'), dadosDir: cardsDataDir || path.join(__dirname, 'pc-cards/dados'), agora: new Date(agora) });
      cards = l.pendentes; cardsErro = l.ilegiveis > 0;
    } catch { /* sem leitura */ }
  }
  const itens = (cards || []).map(c => {
    const sessao = (agents || []).find(x => x.id === c.sessao || nome(x) === c.sessao);
    const bloqueado = c.perigoso || c.bloqueado;
    return { tipo: 'card', cardId: c.arquivo, arquivo: c.arquivo, versao: c.versao, titulo: texto(c.pergunta) || 'Responda na sessão', detalhe: texto(c.sessao), perigoso: c.perigoso, modo: bloqueado || !c.opcoes.length ? 'chat' : 'opcoes',
      opcoes: bloqueado ? [] : c.opcoes.map(o => ({ rotulo: texto(o.label), indice: o.indice, recomendada: o.recomendada })), passos: [], idadeMin: idade(c.ordem), ...(sessao ? atalho(sessao, app) : {}) };
  });
  for (const x of agents || []) if (x.state === 'waiting') {
    const min = idade(x.lastAt);
    itens.push({ tipo: 'passo', titulo: nome(x), detalhe: nome(x) + ' · ' + (min === null ? 'sem leitura' : 'há ' + min + ' min'), idadeMin: min, passos: [], semBloco: 'Responda na sessão', ...atalho(x, app) });
  }
  const voceResolve = { ...lista(itens), ...(cards === null || cardsErro || agents === null ? { valor: '?', erro: 'sem leitura', solucao: 'Confira os cards e a descoberta de sessões.' } : {}) };
  let e = null;
  if (existe(root, 'estado/entregas.json')) { try { e = require('./entregas-rota.cjs').ler(root, agora); } catch {} }
  const entregas = e?.lido ? e.projetos.flatMap(p => p.entregas) : null;
  const abertas = entregas?.filter(x => x.estado !== 'pronta');
  const atualizadoMs = ms(e?.atualizadoEm);
  const frentes = abertas ? { ...lista(abertas.map(x => ({ nome: texto(x.nome), nomeInteiro: texto(x.nome), pct: x.pct, faltam: numero(x.horasNaFrente) ? '~' + x.horasNaFrente + ' h' : 'sem leitura · confira os passos', atencao: x.estado === 'voce' }))), dadoHaMin: idade(atualizadoMs) } : incerto('Peça à sessão para atualizar as entregas.');
  const docaEntregas = abertas ? { ...lista(abertas.slice().sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1)).map(x => ({ nome: texto(x.nome), pct: x.pct, estado: x.estado, passo: x.estado === 'voce' ? texto(x.proximo?.nome) : null }))), abertas: abertas.length, atualizadoMs, velho: e.velho } : incerto('Peça à sessão para atualizar as entregas.');
  const rawE = F.json(root, 'estado/entregas.json');
  const fechadas = entregas?.filter(x => x.estado === 'pronta');
  const dia = at => Number.isFinite(ms(at)) ? new Date(ms(at)).toDateString() : null;
  const fonteFeita = x => rawE?.entregas?.find(r => r.id === x.id);
  const fim = x => { const r = fonteFeita(x); return r?.concluidoEm || r?.feitoEm || r?.prontoEm; };
  const prontoHoje = !fechadas ? incerto('Peça à sessão para atualizar as entregas.') : fechadas.some(x => !Number.isFinite(ms(fim(x)))) ? incerto('Peça à sessão para registrar a hora das entregas prontas.') : lista(fechadas.filter(x => dia(fim(x)) === dia(agora)).map(x => texto(x.nome)));
  const projetos = projects ? lista(projects.map(p => {
    const l = entregas?.filter(x => x.projeto === p.name || x.projeto === p.nome || x.projeto === p.id);
    const leds = l?.map(x => x.estado === 'pronta' ? 'ar' : x.estado === 'voce' ? 'vez' : x.lido ? 'obra' : 'incerto');
    return { nome: texto(p.name || p.nome), ...(leds ? { leds, ar: leds.filter(x => x === 'ar').length, vez: leds.filter(x => x === 'vez').length, total: leds.length } : { total: '?', solucao: 'Peça à sessão para atualizar as entregas.' }) };
  })) : incerto(sol);
  let cr = null;
  if (Array.isArray(F.json(root, 'estado/cronograma.json')?.semana)) { try { cr = require('./cronograma-tela.cjs').ler(root, new Date(agora)); } catch {} }
  const semana = cr?.lido ? { ...lista(cr.semana.flatMap(d => d.itens.map(x => ({ texto: texto(x.o_que), estado: x.estado === 'feito' ? 'pronto' : x.estado === 'rodando' ? 'anda' : 'falta' })))), datas: 'Semana', atualizadoMs: ms(cr.atualizado || cr.fileAt) } : incerto('Peça à sessão para atualizar a semana.');
  const atividades = Array.isArray(s?.sessionActivity) ? s.sessionActivity : Array.isArray(s?.activity) ? s.activity : agents;
  const feed = atividades ? lista(atividades.filter(x => Number.isFinite(ms(x.at || x.lastAt))).slice().sort((a, b) => ms(b.at || b.lastAt) - ms(a.at || a.lastAt)).slice(0, 12).map(x => {
    const session = [...(agents || []), ...(helpers || [])].find(a => a.id === (x.sessionId || x.id)) || x;
    return { ms: ms(x.at || x.lastAt), quem: x.family === 'codex' ? 'CODEX' : 'CLAUDE', texto: nome(x) + (session.state === 'waiting' || session.state === 'done' ? ' terminou a vez.' : session.state === 'working' || x.status === 'ativa' ? ' está trabalhando.' : ' sem atividade recente.') };
  })) : incerto(sol);
  const all = agents && helpers ? [...agents, ...helpers] : agents;
  const C = require('./credito-fresco.cjs');
  let claude = null, codex = null;
  if (existe(root, 'estado/credito-claude.jsonl')) claude = require('./credito-claude.cjs').claudeCredit(root, new Date(agora));
  if (existe(root, 'estado/uso-codex.json')) codex = C.lerCodex(root);
  const contas = { erro: null, contas: ['claude', 'codex'].map(f => {
    const rows = all?.filter(x => x.family === f), tokensHoje = rows?.length && rows.every(x => numero(x.todayTokens)) ? rows.reduce((n, x) => n + x.todayTokens, 0) : '?';
    const credit = C.fresco(C.maisNova(f === 'claude' ? claude : codex, s?.credits?.[f]), agora), week = credit.windows.find(x => x.minutes >= 10000 && numero(x.used));
    return { conta: f.toUpperCase(), tokensHoje, semana: week?.used ?? '?', lidoMs: ms(credit.updated), zeraMs: ms(week?.reset), solucao: f === 'claude' ? 'Rode /usage no Claude Code.' : 'Atualize a leitura de uso do Codex.' };
  }) };
  // arquivo que ainda nao existe = nada enviado (none); "?" so para arquivo que existe e nao se le
  const pedidos = existe(root, 'estado/pedidos-sessoes.jsonl') ? linhas(root, 'estado/pedidos-sessoes.jsonl') : [], respostas = cfg.recursos.voz && existe(root, 'estado/voz-respostas.jsonl') ? linhas(root, 'estado/voz-respostas.jsonl') : [];
  const conversa = [...(pedidos || []).map(x => ({ eu: true, rotulo: 'VOCÊ', ms: ms(x.ts), texto: texto(x.texto, 2000), sessao: sessaoDe(x.sessao) })), ...(respostas || []).map(x => ({ eu: false, rotulo: 'RESPOSTA', ms: ms(x.ts), texto: texto(x.texto, 2000), sessao: sessaoDe(x.sessao) }))].filter(x => Number.isFinite(x.ms) && x.sessao !== undefined).sort((a, b) => a.ms - b.ms);
  const rawIdeias = require('./ideias.cjs').read(root, false, agora);
  const ii = rawIdeias.ok && !(rawIdeias.omitted && !rawIdeias.ideas.length) ? rawIdeias.ideas.map(x => ({ titulo: texto(x.title), de: texto(x.author), estado: texto(x.decision?.state) || 'nova', haMin: idade(x.at), ms: ms(x.at) })).sort((a, b) => (b.ms || 0) - (a.ms || 0)) : null;
  const ideias = ii ? { ...lista(ii), hoje: ii.filter(x => dia(x.ms) === dia(agora)).length, semana: ii.filter(x => x.ms >= agora - 7 * 86400000).length, novas: ii.filter(x => x.estado === 'nova').length } : incerto('Peça à sessão para registrar as ideias.');
  return { ok: true, exemplo: false, geradoMs: agora, erros: [], topo: { seus: cards !== null && !cardsErro && agents !== null ? itens.length : '?', frentes: abertas?.length ?? '?', cards: cardsErro ? '?' : cards?.length ?? '?' }, voceResolve, frentes, doca: { entregas: docaEntregas, projetos }, prontoHoje, automacao: incerto('veja Monitores no README'),
    ajudantes: helpers ? { ...lista([]), agora: helpers.filter(x => x.state === 'working').length, nota: helpers.length ? 'ajudantes descobertos' : 'none', lidoHaS: Number.isFinite(ms(s?.updated)) ? Math.max(0, Math.round((agora - ms(s.updated)) / 1000)) : null } : { ...incerto(sol), agora: '?' }, ideias, contas, codex: contas.contas[1], pesquisa: incerto(sol), semana, feed, conversa,
    conversaLeitura: pedidos === null || respostas === null ? incerto('Confira estado/pedidos-sessoes.jsonl e estado/voz-respostas.jsonl.') : { lido: true },
    recado: { sessoes: (agents || []).filter(x => idSeguro(x.id) && !['sleeping', 'done', 'unknown'].includes(x.state) && x.status !== 'parada').map(x => ({ chave: x.id, rotulo: nome(x).slice(0, 28), ultimoMs: ms(x.lastAt) })), historico: [] } };
}
module.exports = { montar };
