
(function (root, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.PainelFluxoTelaModelo = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';

  const TETO_FOCO_MIN = 120;
  const MAX_CHEIOS = 2, MAX_TIRA = 12;
  const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const fold = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const virgula = v => String(Math.round(v * 10) / 10).replace('.', ',');

  const duracaoMedida = m => (m < 120 ? Math.round(m) + ' min' : Math.round(m / 60) + ' h');
  const temNumero = f => num(f.pct) !== null || num(f.faltamMin) !== null;
  const idadeLida = f => { const m = num(f.medidoHaMin); return m !== null && m >= 0 ? m : null; };
  function textoMedido(f, lang) {
    if (!f || f.velha !== true) return '';
    const m = idadeLida(f); if (m === null && !temNumero(f)) return '';
    const d = m === null ? '?' : duracaoMedida(m); return lang === 'en' ? 'measured ' + d + ' ago' : lang === 'es' ? 'medido hace ' + d : 'medido há ' + d;
  }
  function textoCausa(f, lang) {
    if (!f || f.velha !== true) return '';
    if (temNumero(f)) return idadeLida(f) !== null ? '' : lang === 'en' ? 'the panel could not read when this number was measured' : lang === 'es' ? 'el panel no leyó cuándo se midió este número' : 'o painel não leu quando este número foi medido';
    if (typeof f.blocoDe !== 'string' || !/^[A-Z][A-Z0-9]{1,11}$/.test(f.blocoDe)) return '';
    const s = f.blocoDe, hora = typeof f.blocoHora === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(f.blocoHora) ? f.blocoHora : null;
    if (hora === null) return lang === 'en' ? 'session ' + s + ' did not write the number for this workstream' : lang === 'es' ? 'la sesión ' + s + ' no escribió el número de este frente' : 'a sessão ' + s + ' não escreveu o número desta frente';
    return lang === 'en' ? 'session ' + s + ' has not rewritten its workstreams since ' + hora + ' local' : lang === 'es' ? 'la sesión ' + s + ' no reescribe los frentes desde ' + hora + ' local' : 'a sessão ' + s + ' não regrava as frentes desde ' + hora + ' local';
  }
  const minutos = v => (v < 1 ? 'menos de 1 min' : v < 90 ? '~' + Math.round(v) + ' min' : '~' + virgula(v / 60) + ' h');

  function ha(ms) {
    if (typeof ms !== 'number' || !Number.isFinite(ms)) return '?';
    const s = Math.floor(ms / 1000);
    if (s < 1) return 'agora';
    if (s < 60) return 'há ' + s + ' s';
    const m = Math.floor(s / 60);
    if (m < 60) return 'há ' + m + ' min';
    return 'há ' + Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
  }

  const PONTO_ORDEM = { aceso: 0, entregou: 1, dormindo: 2, 'sem-leitura': 3 };
  const PONTO_TEXTO = { aceso: 'trabalhando agora', entregou: 'entregou', dormindo: 'dormindo', 'sem-leitura': 'sem leitura' };
  const pontoDe = f => (f.work === true || f.estado === 'trabalhando' ? 'aceso' : f.estado === 'terminou' ? 'entregou' : f.estado === 'dormindo' ? 'dormindo' : 'sem-leitura');
  function encaixe(filhos, opcoes) {
    const o = opcoes || {}, maxCheios = num(o.maxCheios) === null ? MAX_CHEIOS : o.maxCheios, maxTira = num(o.maxTira) === null ? MAX_TIRA : o.maxTira;
    if (o.lido === false) return { cheios: [], tira: [], mais: 0, maisCheios: 0, trabalhando: null, total: null, texto: '?' };
    const todos = (Array.isArray(filhos) ? filhos : []).filter(f => f && f.tipo !== 'grupo').map((f, i) => {
      const ponto = pontoDe(f);
      return { id: f.id, ponto, nome: f.nome || '?', frase: f.frase || PONTO_TEXTO[ponto], dica: (f.nome || '?') + ' · ' + (f.frase || PONTO_TEXTO[ponto]), lado: f.lado || 'claude', i };
    }).sort((a, b) => PONTO_ORDEM[a.ponto] - PONTO_ORDEM[b.ponto] || a.i - b.i);
    const vivos = todos.filter(x => x.ponto === 'aceso'), cheios = vivos.slice(0, Math.max(0, maxCheios)), tira = todos.slice(0, Math.max(0, maxTira));
    return { cheios, tira, mais: todos.length - tira.length, maisCheios: vivos.length - cheios.length, trabalhando: vivos.length, total: todos.length, texto: todos.length ? vivos.length + ' de ' + todos.length : 'nenhum ajudante em 2 h' };
  }
  function sessoesQueCabem(sessoes, max) {
    const lista = Array.isArray(sessoes) ? sessoes : [], teto = Math.max(1, num(max) === null ? lista.length : Math.floor(max));
    if (lista.length <= teto) return { visiveis: lista, mais: 0 };
    const fica = new Set(lista.filter(s => s && s.work).slice(0, teto));
    for (const s of lista) { if (fica.size >= teto) break; fica.add(s); }
    return { visiveis: lista.filter(s => fica.has(s)), mais: lista.length - fica.size };
  }

  const SOL_SITUACAO = 'seu Claude grava a situação da frente no próximo WEN';
  const focoDe = f => (Number.isInteger(f && f.foco) && f.foco >= 1 && f.foco <= 5 ? f.foco : null);
  function seloNorte(f, teto) {
    const limite = num(teto) === null ? TETO_FOCO_MIN : teto, x = f || {}, atraso = num(x.atrasoMin);
    const situacao = x.situacao === 'em-dia' ? { classe: 'em-dia', texto: 'em dia' }
      : x.situacao === 'atrasada' ? { classe: 'atrasada', texto: 'atrasada ' + (atraso === null ? '? min' : atraso < 120 ? Math.round(atraso) + ' min' : '~' + virgula(atraso / 60) + ' h') }
      : x.situacao === 'sem-prazo' ? { classe: 'sem-prazo', texto: 'sem prazo ?' }
      : { classe: 'sem-leitura', texto: '?', solucao: SOL_SITUACAO };
    const foco = focoDe(x), doMomento = foco === 1 || foco === 2, faltam = num(x.faltamMin), subiu = num(x.estimativaSubiuMin);
    const alta = doMomento && ((faltam !== null && faltam > limite) || (subiu !== null && subiu > 0));
    return { situacao, foco: alta ? { classe: 'foco-alta', texto: 'foco, estimativa alta' } : null, salta: doMomento && (alta || x.situacao === 'atrasada') };
  }

  const nomeDe = f => { const n = typeof f.frente === 'string' && f.frente.trim() ? f.frente : typeof f.nome === 'string' && f.nome.trim() ? f.nome : ''; return n.replace(/\s+/g, ' ').trim(); };
  const linhaDeSobra = f => /^mais \d+ frentes?\b/i.test(nomeDe(f)) && num(f.pct) === null && num(f.faltamMin) === null && focoDe(f) === null && (f.situacao === null || f.situacao === undefined);
  const resumoNorte = r => (r && num(r.total) !== null && num(r.emDia) !== null && num(r.atrasadas) !== null && num(r.semPrazo) !== null
    ? r.total + (r.total === 1 ? ' frente' : ' frentes') + ' · ' + r.emDia + ' em dia · ' + r.atrasadas + (r.atrasadas === 1 ? ' atrasada' : ' atrasadas') + ' · ' + r.semPrazo + ' sem prazo' : '');
  function ordenarNorte(frentes, teto) {
    if (!Array.isArray(frentes)) return [];
    return frentes.filter(f => f && typeof f === 'object' && !Array.isArray(f) && !linhaDeSobra(f)).map((f, i) => {
      const selos = seloNorte(f, teto), foco = focoDe(f), pct = num(f.pct), faltam = num(f.faltamMin), barra = pct === null ? null : Math.max(0, Math.min(100, Math.floor(pct))), nome = nomeDe(f);
      return Object.assign({}, f, { nome: nome || '?', semNome: !nome, _i: i, _foco: foco === null ? 9 : foco, selos, salta: selos.salta, barra, pctTexto: barra === null ? '?' : barra + '%',
        medidoTexto: lang => textoMedido(f, lang), causaTexto: lang => textoCausa(f, lang),
        faltamTexto: 'faltam ' + (faltam === null ? '?' : minutos(faltam)), focoTexto: foco === null ? 'foco ?' : 'foco ' + foco + (f.focoNome ? ' · ' + String(f.focoNome) : '') });
    }).sort((a, b) => {
      const atrA = a.situacao === 'atrasada', atrB = b.situacao === 'atrasada', nA = num(a.atrasoMin), nB = num(b.atrasoMin);
      return a._foco - b._foco || (b.salta ? 1 : 0) - (a.salta ? 1 : 0) || (atrB ? 1 : 0) - (atrA ? 1 : 0) || (nB === null ? -1 : nB) - (nA === null ? -1 : nA) || a._i - b._i;
    }).map((f, i) => { const { _i, _foco, ...linha } = f; linha.pos = i + 1; return linha; });
  }
  function linhasQueCabem(total, alturaPx, linhaPx, colunas) {
    const n = Math.max(0, Math.floor(num(total) || 0));
    if (num(alturaPx) === null || !(num(linhaPx) > 0)) return { visiveis: n, mais: 0 };
    const vagas = Math.max(0, Math.floor(alturaPx / linhaPx)) * Math.max(1, Math.floor(num(colunas) || 1));
    if (n <= vagas) return { visiveis: n, mais: 0 };
    const visiveis = Math.max(0, vagas - 1);
    return { visiveis, mais: n - visiveis };
  }

  function frenteDaSessao(chave, nome, linhas) {
    const alvos = [chave, nome].map(fold).filter(Boolean); if (!alvos.length || !Array.isArray(linhas)) return null;
    const palavra = (texto, alvo) => { const t = ' ' + fold(texto).replace(/[^a-z0-9]+/g, ' ') + ' '; return t.includes(' ' + alvo.replace(/[^a-z0-9]+/g, ' ') + ' '); };
    const casa = f => {
      const s = f.sessao == null ? [] : Array.isArray(f.sessao) ? f.sessao : [f.sessao];
      if (s.some(x => alvos.includes(fold(x)))) return true;
      return (Array.isArray(f.quem) ? f.quem : []).some(q => alvos.some(a => palavra(typeof q === 'string' ? q : q && q.nome, a)));
    };
    const todas = linhas.filter(f => f && casa(f)), comNome = todas.filter(f => !f.grupo), achadas = comNome.length ? comNome : todas;
    return achadas.length ? { frente: achadas[0], mais: todas.reduce((s, f) => s + (f.grupo ? f.n : 1), 0) - (achadas[0].grupo ? achadas[0].n : 1) } : null;
  }



  const MAX_NORTE = 8, PENDENTE = /^\s*([^:]{1,30}):\s*frente\s+\d+\s*\(nome neutro pendente\)\s*$/i;
  const SESSAO_NOME = {}, SESSAO_ORDEM = [];
  const chaveSessao = f => (typeof f.sessao === 'string' && f.sessao.trim() ? f.sessao.trim().toUpperCase() : '');
  const tierDe = l => (l.situacao === 'atrasada' ? 1 : l.selos.foco ? 2 : focoDe(l) === 1 ? 3 : 4);
  const maior = lista => { const v = lista.map(num).filter(x => x !== null); return v.length ? Math.max(...v) : null; };
  const menor = lista => { const v = lista.map(num).filter(x => x !== null); return v.length ? Math.min(...v) : null; };
  function linhaGrupo(prefixo, ms) {
    const atr = ms.filter(x => x.situacao === 'atrasada'), altas = ms.filter(x => x.selos.foco), f1 = ms.filter(x => focoDe(x) === 1), semPrazo = ms.filter(x => x.situacao === 'sem-prazo').length;
    const tier = atr.length ? 1 : altas.length ? 2 : f1.length ? 3 : 4, prazo = maior(ms.map(x => x.faltamMin)), focos = ms.map(focoDe).filter(x => x !== null), foco = focos.length ? Math.min(...focos) : null;
    const situacao = atr.length ? { classe: 'atrasada', texto: atr.length + (atr.length === 1 ? ' atrasada' : ' atrasadas') } : ms.every(x => x.situacao === 'em-dia') ? { classe: 'em-dia', texto: 'em dia' }
      : semPrazo ? { classe: 'sem-prazo', texto: semPrazo + ' sem prazo ?' } : { classe: 'sem-leitura', texto: '?', solucao: SOL_SITUACAO };
    const dono = ms.find(x => focoDe(x) === foco) || ms[0];
    return { grupo: true, n: ms.length, semNome: true, nome: prefixo + ': ' + ms.length + ' frentes sem nome neutro', sessao: chaveSessao(ms[0]) || null, tier, foco, focoNome: foco === null ? null : dono.focoNome || null,
      focoTexto: foco === null ? 'foco ?' : 'foco ' + foco + (dono.focoNome ? ' · ' + String(dono.focoNome) : ''), situacao: atr.length ? 'atrasada' : situacao.classe === 'em-dia' ? 'em-dia' : situacao.classe === 'sem-prazo' ? 'sem-prazo' : null,
      atrasoMin: maior(atr.map(x => x.atrasoMin)), faltamMin: tier === 2 ? maior(altas.map(x => x.faltamMin)) : tier === 3 ? menor(f1.map(x => x.faltamMin)) : prazo,
      selos: { situacao, foco: altas.length ? { classe: 'foco-alta', texto: 'foco, estimativa alta' } : null, salta: ms.some(x => x.salta) }, salta: ms.some(x => x.salta),
      barra: null, pctTexto: '', faltamTexto: 'maior prazo ' + (prazo === null ? '?' : minutos(prazo)), _i: Math.min(...ms.map(x => x.pos)) };
  }
  function resumoSessoes(linhas) {
    const por = new Map();
    for (const l of linhas) { const k = chaveSessao(l); if (!por.has(k)) por.set(k, []); por.get(k).push(l); }
    const ordem = k => (k === '' ? 99 : SESSAO_ORDEM.indexOf(k) < 0 ? 50 : SESSAO_ORDEM.indexOf(k));
    return [...por.keys()].sort((a, b) => ordem(a) - ordem(b) || a.localeCompare(b)).map(k => {
      const ms = por.get(k), atrasadas = ms.filter(x => x.situacao === 'atrasada').length, prazo = maior(ms.map(x => x.faltamMin)), nome = k === '' ? 'Sem sessão' : SESSAO_NOME[k] || k.charAt(0) + k.slice(1).toLowerCase();
      return { chave: k, nome, total: ms.length, atrasadas, maiorPrazoMin: prazo, texto: nome + ': ' + ms.length + (ms.length === 1 ? ' frente' : ' frentes') + ', ' + atrasadas + (atrasadas === 1 ? ' atrasada' : ' atrasadas') + ', maior prazo ' + (prazo === null ? '?' : minutos(prazo)) };
    });
  }
  function norteEmTela(frentes, opcoes) {
    const o = opcoes || {}, max = num(o.max) === null ? MAX_NORTE : Math.max(0, Math.floor(o.max)), dono = o.dono === true;

    const entrada = (Array.isArray(frentes) ? frentes : []).filter(f => f && typeof f === 'object' && !Array.isArray(f)).map(f => {
      const { soDono, ...resto } = f, real = dono && soDono && typeof soDono.frente === 'string' && soDono.frente.trim() ? soDono.frente.trim() : '';
      return real ? Object.assign(resto, { frente: real, nomeDoDono: true, nomeNeutro: typeof f.frente === 'string' ? f.frente : '' }) : Object.assign(resto, { nomeDoDono: false });
    });
    const base = ordenarNorte(entrada, o.teto), soltas = [], grupos = new Map(), agrupar = o.agrupar !== false;
    for (const l of base) {
      const m = l.nomeDoDono ? null : PENDENTE.exec(l.nome); l.pendente = !!m;
      if (!m || !agrupar) { soltas.push(Object.assign(l, { grupo: false, n: 1, tier: tierDe(l), _i: l.pos })); continue; }
      const k = fold(m[1]); if (!grupos.has(k)) grupos.set(k, { prefixo: m[1].trim(), ms: [] }); grupos.get(k).ms.push(l);
    }
    for (const g of grupos.values()) soltas.push(g.ms.length === 1 ? Object.assign(g.ms[0], { grupo: false, n: 1, tier: tierDe(g.ms[0]), _i: g.ms[0].pos }) : linhaGrupo(g.prefixo, g.ms));
    const nulo = (v, pior) => (num(v) === null ? pior : v);
    const todas = soltas.sort((a, b) => a.tier - b.tier
      || (a.tier === 1 ? nulo(b.atrasoMin, -1) - nulo(a.atrasoMin, -1) : a.tier === 2 ? nulo(b.faltamMin, -1) - nulo(a.faltamMin, -1) : a.tier === 3 ? nulo(a.faltamMin, Infinity) - nulo(b.faltamMin, Infinity) : 0)
      || a._i - b._i).map((l, i) => { const { _i, ...linha } = l; linha.pos = i + 1; return linha; });
    const linhas = todas.slice(0, max);
    return { linhas, todas, total: base.length, fora: base.length - linhas.reduce((s, l) => s + l.n, 0), sessoes: resumoSessoes(base) };
  }
  const daSessao = (linhas, chave) => (chave === null || chave === undefined ? linhas : linhas.filter(l => chaveSessao(l) === String(chave).toUpperCase()));

  const ACOES = { prioridade: { rotulo: 'Dar prioridade', dica: 'Grava um pedido para seu Claude dar prioridade a esta frente' }, demora: { rotulo: 'Pedir solução para a demora', dica: 'Grava um pedido para seu Claude trazer uma solução para a demora desta frente' } };
  const TRACOS = new RegExp('[' + String.fromCharCode(8211, 8212) + ']', 'g'); // os 2 tracos longos, montados pelo codigo: o arquivo servido nao leva nenhum
  const nomeLimpo = v => Array.from(String(v == null ? '' : v).replace(/["“”«»`]/g, '').replace(TRACOS, '-').replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim()).slice(0, 80).join('').trim();
  function falaPronta(acao, nomeFrente) {
    const nome = nomeLimpo(nomeFrente); if (!nome || !Object.prototype.hasOwnProperty.call(ACOES, acao)) return null;
    return acao === 'prioridade' ? 'Pedido do painel: dar prioridade à frente "' + nome + '".' : 'Pedido do painel: a frente "' + nome + '" está demorando. Traga uma solução para a demora.';
  }

  function entregue(texto, enviadoEmMs, falas) {
    if (!texto || !Array.isArray(falas) || num(enviadoEmMs) === null) return false;
    return falas.some(f => f && typeof f.texto === 'string' && f.texto.includes(texto) && Date.parse(f.t) >= enviadoEmMs - 2000);
  }

  const ESTADO_NOME = { pensando: 'Pensando', comando: 'Usando comando', esperando: 'Esperando você', parada: 'Terminou' };
  const conta = (n, um, muitos) => (n === null ? '? ' + muitos : n + ' ' + (n === 1 ? um : muitos));
  function aoVivo(resumo, agoraMs) {
    if (!resumo || typeof resumo !== 'object') return null;
    const falas = Array.isArray(resumo.falas) ? resumo.falas : [], fala = falas.find(f => f && f.maisNova) || falas[falas.length - 1] || null;
    const e = resumo.estado && typeof resumo.estado === 'object' ? resumo.estado : {}, t = resumo.turno && typeof resumo.turno === 'object' ? resumo.turno : {};
    const desde = e.desde ? ha(agoraMs - Date.parse(e.desde)) : '', nome = ESTADO_NOME[e.nome] || '?', quando = fala && fala.t ? ha(agoraMs - Date.parse(fala.t)) : '';
    const detalhe = e.nome === 'pensando' ? (e.porque === 'fala' ? 'leu a sua fala' : e.porque === 'resultado' ? 'leu a saída do comando' : e.porque === 'volta' ? 'leu uma volta' : e.porque === 'pensou' ? 'terminou de pensar' : 'escrevendo')
      : e.nome === 'comando' ? String(e.ferramenta || '?') + ': ' + String(e.detalhe || '?')
      : e.nome === 'esperando' ? (e.porque === 'escolha' ? 'tela de escolha aberta' : 'terminou com uma pergunta')
      : e.nome === 'parada' ? 'espera a sua próxima fala' : 'sem leitura. Solução: fale com seu Claude e a tela acorda';
    const ds = (Array.isArray(resumo.destinos) ? resumo.destinos : []).filter(d => d && d.chave);
    const curto = d => ({ chave: String(d.chave), nome: String(d.nome || d.chave), semResposta: d.semResposta === true });
    const direcao = ds.filter(d => d.aceso && d.selo !== 'duvida').map(curto), duvida = ds.filter(d => d.aceso && d.selo === 'duvida').map(curto), voltou = ds.filter(d => d.voltouNoTurno).map(curto);
    return {
      voce: { titulo: 'Você' + (quando && quando !== '?' ? ' · ' + quando : ''), texto: fala && fala.texto ? String(fala.texto) : 'nenhuma fala sua nesta leitura', naFila: !!(fala && fala.estado === 'fila') },
      coordenador: { estado: ESTADO_NOME[e.nome] ? e.nome : '?', titulo: nome + (nome !== '?' && desde && desde !== '?' ? ' ' + desde : ''), detalhe, conta: 'leu ' + conta(num(t.leituras), 'arquivo', 'arquivos') + ' · ' + conta(num(t.comandos), 'comando', 'comandos') },
      mandou: { direcao, duvida, voltou, vazio: direcao.length || duvida.length || voltou.length ? '' : 'nada mandado neste turno' },
      setas: { ida: e.nome === 'pensando' || e.nome === 'comando', mandou: ds.some(d => d.aceso), volta: voltou.length > 0 },
      acesos: ds.filter(d => d.aceso).map(d => String(d.chave))
    };
  }

  const pctProjeto = t => (t && num(t.total) !== null && t.total > 0 && num(t.ar) !== null ? Math.round(100 * t.ar / t.total) : null);
  const chipProjeto = (nome, t) => { const p = pctProjeto(t); return String(nome || '?') + ' ' + (p === null ? '?' : p + '%'); };
  const chipDependem = n => 'Dependem de você: ' + (num(n) === null ? '?' : n === 0 ? 'nada' : n);

  return Object.freeze({ TETO_FOCO_MIN, MAX_CHEIOS, MAX_TIRA, MAX_NORTE, norteEmTela, daSessao, ACOES, ha, minutos, encaixe, sessoesQueCabem, seloNorte, ordenarNorte, resumoNorte, linhasQueCabem, frenteDaSessao, falaPronta, nomeLimpo, entregue, aoVivo, pctProjeto, chipProjeto, chipDependem, textoMedido, textoCausa });
});
