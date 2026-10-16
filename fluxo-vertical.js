/* Fluxo da equipe em hierarquia vertical, adaptado ao celular.
   A = organograma em arvore (hover acende o caminho ate Voce), da largura CORTE para cima; C = coluna unica em cascata, abaixo dela.
   O vistas.js chama PainelFluxoV.pintar no lugar do desenho antigo (que so fica como volta se este arquivo nao carregar).
   De cima para baixo, igual nos 3: Voce > Coordena (Claude e do Codex) > Sessoes > Executam (ajudantes e Codex de cada uma).
   Dados: o mesmo preparo do Fluxo de hoje (vistas.js, pacoteV) + GET /api/fluxo-vertical/agentes (ferramentas, memorias e duracao
   tipica de cada ajudante). Sem leitura: "?" com a solucao; nunca numero inventado.
   Animacao: o mesmo motor (anim-motor.js) e os 3 temas de sempre. Cada ligacao tem 2 faixas: a que desce (de quem esta em cima) e a
   que sobe; as particulas andam nelas na cor de quem mandou; os eventos (mensagem nova, card, ajudante nasce e termina) seguem iguais.
   Cada cadeia lista os ajudantes VIVOS da sessao (chip com o
   mesmo nome da aba Equipe, ate 4 e "+N") e as rodadas do Codex rodando dela; "Ajudantes agora" e "Codex rodando" abrem a lista; o
   "Codex rodando" conta pela mesma fonte da Equipe (codex-sessoes, todas as rodadas), nao pelos ate 3 cartoes que o mapa desenha. */
(function (root) {
  'use strict';
  const doc = root.document, html = doc.documentElement, SVGNS = 'http://www.w3.org/2000/svg';
  const ST = { ag: null, agPedido: false, agEm: 0, agFalhou: null, sel: null, hover: null, M: null, P: null, fontes: false, escopo: null, lista: null, listaFixa: false };
  // sem a leitura do fluxo (no modo amigo a rota do Fluxo da Equipe nao existe): frase com o proximo passo, nunca 'Lendo' parado
  const FLUXO_INDISPONIVEL = '? O fluxo de quem chama quem não está ligado nesta cópia. Solução: use o Resumo acima ou Esperando você e Trabalhando agora na primeira tela';
  const ORDEM = ['ATENDIMENTO', 'ASSISTENTE', 'CORTES', 'LOJA'];
  // DEMO ("Ver todas as animacoes"): sem conversa lida, a animacao usa as linhas de quem responde a quem
  const emDemo = () => /(?:^#|&)demo=eventos\b/.test(root.location.hash || '');
  const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  const TIPO_H = { 'general-purpose': 'Ajudante geral', 'revisor-texto-sigilo': 'Revisor de texto e sigilo', 'revisor-dinheiro': 'Revisor de dinheiro', tela: 'Ajudante de tela', rota: 'Ajudante de servidor', analise: 'Análise', medir: 'Medição', claude: 'Ajudante', Explore: 'Busca no código', Plan: 'Plano', video: 'Vídeo', sweep: 'Compra em lote', 'tracker-dev': 'Tracker', 'claude-code-guide': 'Guia do Claude Code', 'statusline-setup': 'Barra de status' };
  const tipoH = t => t ? (TIPO_H[t] || String(t).replace(/[-_]+/g, ' ').replace(/^./, c => c.toUpperCase())) : 'Ajudante';
  const tipoPlural = t => ({ 'general-purpose': 'ajudantes gerais', 'revisor-texto-sigilo': 'revisores de texto', 'revisor-dinheiro': 'revisores de dinheiro', tela: 'ajudantes de tela', rota: 'ajudantes de servidor', analise: 'análises', medir: 'medições', claude: 'ajudantes', video: 'ajudantes de vídeo' }[t] || 'ajudantes do mesmo tipo');
  const FERR_H = { Bash: 'Comando', PowerShell: 'Comando', Read: 'Ler arquivo', Edit: 'Editar arquivo', Write: 'Escrever arquivo', Grep: 'Buscar texto', Glob: 'Achar arquivo', Agent: 'Chamar ajudante', Task: 'Chamar ajudante', SubagentHandback: 'Entregar', SendMessage: 'Recado', Skill: 'Habilidade', WebFetch: 'Ler página', WebSearch: 'Buscar na web', ToolSearch: 'Carregar ferramenta', NotebookEdit: 'Editar caderno', TaskStop: 'Parar tarefa', Monitor: 'Vigiar' };
  function ferrH(nome) {
    const n = String(nome || '');
    if (n === 'outra') return ['Outra ferramenta', null]; if (n === 'Conector' || n === 'Navegador') return [n, null];
    if (/^mcp__/i.test(n)) { if (/browser|chrome/i.test(n)) return ['Navegador', null]; if (/visualiz|widget/i.test(n)) return ['Desenho na conversa', null]; return ['Conector', null]; }
    return [FERR_H[n] || n, FERR_H[n] ? n : null];
  }
  const acento = s => root.PainelNomes && typeof root.PainelNomes.acentos === 'function' ? root.PainelNomes.acentos(String(s)) : String(s);
  // o nome de cada ajudante nos chips e o MESMO da aba Equipe (pe-equipe.js, linhasAjudantes: "papel: o que faz"; o tempo vai no
  // title). Assunto reservado segue o filtro de sempre: so o modo dono deste PC traz o texto real (soDono). Sem o pe-equipe: o nome do cartao.
  function nomeAj(it) {
    const a = it.agente || {}, real = it.donoAberto && a.soDono && a.soDono.oque ? a.soDono.oque : null, PE = root.PainelEquipePE;
    try {
      if (PE && typeof PE.linhasAjudantes === 'function') {
        const l = PE.linhasAjudantes({ lang: 'pt', now: Date.now(), view: { cards: new Map() } }, { casa: true, ajudantesLista: [{ tipo: a.tipo || (a.soDono && a.soDono.tipo) || null, oque: real || a.oque || null, reservado: real ? false : !!a.reservado, ativo: !!a.ativo, desde: a.inicio || null, ultimaEm: a.ultimaEm || null }] })[0];
        if (l && l.cabeca) return { texto: l.cabeca, titulo: l.completo || l.cabeca };
      }
    } catch (e) { /* cai no nome do cartao */ }
    return { texto: it.nome, titulo: it.nome + ' · ' + it.frase };
  }
  // titulo de uma rodada do Codex de uma sessao: o mesmo do cartao (sem o "Rodada"); reservado sem texto real fora do modo dono
  function tituloCx(P, c, p) {
    const realC = !c.titulo && c.soDono && c.soDono.titulo ? c.soDono.titulo : null;
    return { texto: c.titulo ? acento(P.frase(String(c.titulo).replace(/^Rodada\s+/i, ''))) : realC ? acento(P.frase(String(realC).replace(/^Rodada\s+/i, ''))) : (p.sessao === 'ASSISTENTE' ? 'Rodada com assunto reservado' : 'Rodada sem título na fonte'), dono: !!realC };
  }
  const memH = m => m && m.titulo ? m.titulo : String(m && m.nome || '?').replace(/[-_]+/g, ' ').replace(/^./, c => c.toUpperCase());
  const minTxt = v => !Number.isFinite(v) ? '?' : v < 1 ? 'menos de 1 min' : v < 90 ? '~' + Math.round(v) + ' min' : '~' + (Math.round(v / 6) / 10).toString().replace('.', ',') + ' h';
  const mediana = arr => { const s = arr.filter(Number.isFinite).sort((a, b) => a - b); if (!s.length) return null; const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const minDesde = iso => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? Math.max(0, (Date.now() - t) / 60000) : NaN; };
  const estreito = () => root.innerWidth < 760;
  const PG = () => root.PainelProjetoGlobal || null;
  const projAtivo = () => { const g = PG(); return g ? g.atual() : 'todos'; };
  const projNome = id => { const g = PG(); return g ? g.nome(id) : (id || '?'); };
  const lerEscopo = () => { try { return root.localStorage.getItem('painel.fluxoEscopo') === 'geral' ? 'geral' : 'projeto'; } catch (e) { return 'projeto'; } };
  const soProjeto = () => projAtivo() !== 'todos' && ST.escopo !== 'geral';
  const noProjeto = id => projAtivo() === 'todos' || id === projAtivo();
  // 3 linhas e nada cortado (a 840, 5 linhas e texto cortado). Regra: cartao de sessao >= 200 px. Abaixo de 980 entra a C.
  const CORTE = 980;
  const modoDaLargura = () => ST.forca || (root.innerWidth >= CORTE ? 'a' : 'c');

  // ---------- leitura extra: ferramentas, memorias e duracao (so GET, a cada 30 s) ----------
  function pedirAgentes(P) {
    if (ST.agPedido || (ST.agEm && Date.now() - ST.agEm < 30000)) return;
    ST.agPedido = true;
    P.getJSON('/api/fluxo-vertical/agentes', 30000).then(j => { ST.ag = j && j.ok === true ? j : null; ST.agFalhou = ST.ag ? null : 'resposta sem ok'; })
      .catch(() => { ST.agFalhou = 'a leitura não respondeu'; })
      .finally(() => { ST.agPedido = false; ST.agEm = Date.now(); P.repintar(); });
  }
  function agentesDe(P, sessao) {
    if (ST.ag && Array.isArray(ST.ag.sessoes)) { const s = ST.ag.sessoes.find(x => x.sessao === sessao); if (s) return { lista: s.lida === false ? null : s.agentes || [], fonte: 'rota' }; }
    const ops = P.snap && P.snap.operator && Array.isArray(P.snap.operator.sessions) ? P.snap.operator.sessions : [];
    const o = ops.find(x => fold(x && x.id).replace(/^COORDENACAO$/, 'COORDENADOR') === sessao);
    const l = o && o.ajudantes && Array.isArray(o.ajudantes.lista) ? o.ajudantes.lista : null;
    return { lista: l ? l.map(a => ({ tipo: a.tipo, oque: a.oque, reservado: a.reservado, ativo: a.ativo, terminou: a.terminou, inicio: a.desde, ultimaEm: a.ultimaEm, ferramentas: null, memorias: null, memoriasReservadas: null })) : null, fonte: 'estado' };
  }

  // ---------- modelo: itens por nivel, ligacoes e cadeias ----------
  function modelo(P) {
    const byId = new Map(P.nos.map(n => [n.id, n])), items = new Map(), links = new Map();
    const sessaoDe = n => { if (!n) return null; if (n.stage === 'coord' && n.side === 'claude') return 'COORDENADOR'; const f = fold(n.nome); return /^[A-Z]{2,20}$/.test(f) ? f : null; };
    const linha0 = n => n && n.linhas && n.linhas[0] ? n.linhas[0][0] : '';
    const voceN = byId.get('voce') || { id: 'voce', nome: 'Você', lado: 'voce', linhas: [], estado: '' };
    const coordC = P.nos.find(n => n.stage === 'coord' && n.side === 'claude') || null, coordX = P.nos.find(n => n.stage === 'coord' && n.side === 'codex') || null;
    const sessN = P.nos.filter(n => n.col === 0 && !n.dono).sort((a, b) => { const ia = ORDEM.indexOf(sessaoDe(a)), ib = ORDEM.indexOf(sessaoDe(b)); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    const semDonoN = P.nos.filter(n => n.col === 4 && !n.dono);
    const ev = P.agora && P.agora.esperaVoce;
    let kP = null; if (soProjeto()) { try { const V = root.PainelVistas; kP = V && typeof V.esperaProjeto === 'function' ? V.esperaProjeto() : null; } catch (e) { kP = null; } }
    const cardsN = kP ? kP.espera : ev && Number.isFinite(ev.total) ? ev.total : null;
    const add = it => { it.filhos = []; items.set(it.id, it); return it; };
    const voce = add({ id: 'voce', tipo: 'voce', nivel: 0, nome: 'Você', lado: 'voce', estado: voceN.estado, node: voceN, pai: null, cards: cardsN,
      frase: kP ? (cardsN === null ? 'Espera você neste projeto: ?' : cardsN === 0 ? 'Nada espera você neste projeto' : cardsN + (cardsN === 1 ? ' espera você neste projeto' : ' esperam você neste projeto')) : ev && ev.rotulo ? P.frase(ev.rotulo) : cardsN === 0 ? 'Nada espera você' : cardsN === null ? 'Cards que esperam você: ?' : (cardsN === 1 ? '1 card espera você' : cardsN + ' cards esperam você'), precisa: !!(cardsN && cardsN > 0) });
    const execDe = (p) => {
      const out = [], usados = new Set(); const { lista, fonte } = agentesDe(P, p.sessao); p.agFonte = fonte; p.agLido = lista !== null;
      (lista || []).forEach((a, i) => {
        if (soProjeto() && !noProjeto(a.projeto || 'outros')) return;
        const ini = minDesde(a.inicio), fim = minDesde(a.ultimaEm), real = a.reservado && a.soDono && a.soDono.oque ? a.soDono.oque : null;
        const quando = a.ativo ? 'rodando há ' + P.haMin(ini, '') : a.terminou ? 'entregou ' + P.haMin(fim) : 'parado ' + P.haMin(fim);
        // 2 ajudantes chamados no mesmo instante tinham o mesmo id e viravam 1 cartao so; o id fica igual e so o repetido ganha #2, #3
        let idA = 'aj:' + p.id + ':' + (a.inicio || i); if (usados.has(idA)) { let k = 2; while (usados.has(idA + '#' + k)) k++; idA += '#' + k; } usados.add(idA);
        out.push({ id: idA, tipo: 'ajudante', nivel: p.nivel + 1, lado: 'claude', pai: p.id, agente: a, sessao: p.sessao,
          nome: real ? acento(real) : a.reservado ? 'Assunto reservado' : a.oque ? acento(a.oque) : 'Ajudante sem descrição na fonte', frase: tipoH(a.tipo || (a.soDono && a.soDono.tipo)) + ' · no PC · ' + quando, projeto: a.projeto || null, donoAberto: !!real,
          estado: a.ativo ? 'trabalhando' : a.terminou ? 'terminou' : 'dormindo', work: !!a.ativo, acao: a.ativo ? 'generico' : a.terminou ? 'terminou' : 'dormindo', ord: a.ativo ? 0 : 1, quando: Date.parse(a.ultimaEm || '') || 0 });
      });
      for (const k of P.nos.filter(n => n.dono === p.id && n.f2)) {
        const c = k.f2, rod = c.estado === 'rodando', ter = c.estado === 'terminou';
        if (soProjeto() && !noProjeto(c.projeto || 'outros')) continue;
        const tc = tituloCx(P, c, p), realC = tc.dono, titulo = tc.texto;
        const onde = c.onde === 'vps' ? 'na VPS' : c.onde ? 'na máquina' : '';
        const quando = rod ? 'rodando há ' + P.haMin(c.idadeMin, '') : ter ? 'terminou ' + P.haMin(Number.isFinite(c.fimIdadeMin) ? c.fimIdadeMin : c.idadeMin) : (c.estadoTexto ? P.frase(c.estadoTexto) : 'sem leitura') + ' ' + P.haMin(c.idadeMin);
        out.push({ id: k.id, tipo: 'codex', nivel: p.nivel + 1, lado: 'codex', pai: p.id, node: k, f2: c, sessao: p.sessao, nome: titulo, frase: 'Codex ' + onde + ' · ' + quando, projeto: c.projeto || null, donoAberto: !!realC,
          estado: rod ? 'trabalhando' : ter ? 'terminou' : 'dormindo', work: rod, acao: rod ? 'generico' : ter ? 'terminou' : 'dormindo', ord: rod ? 0 : 1, quando: Date.now() - (Number.isFinite(c.idadeMin) ? c.idadeMin : 1e6) * 60000 });
      }
      const agg = P.nos.find(n => n.dono === p.id && n.stage === 'ajudantes');
      if (agg) p.aggId = agg.id;
      if (agg && !out.some(x => x.tipo === 'ajudante')) out.push({ id: 'grp:' + p.id, tipo: 'grupo', nivel: p.nivel + 1, lado: 'claude', pai: p.id, node: agg, sessao: p.sessao, nome: 'Ajudantes: ' + p.nome,
        frase: P.frase(linha0(agg) || 'Sem detalhe nas últimas 2 h'), estado: agg.estado, work: !!agg.work, acao: agg.acao, ord: 2, quando: 0 });
      out.sort((a, b) => a.ord - b.ord || b.quando - a.quando);
      for (const x of out) { add(x); p.filhos.push(x.id); }
      p.agAtivos = out.filter(x => x.tipo === 'ajudante' && x.work).length; p.agTotal = out.filter(x => x.tipo === 'ajudante').length;
      p.cxAtivos = out.filter(x => x.tipo === 'codex' && x.work).length; p.cxTotal = out.filter(x => x.tipo === 'codex').length;
    };
    const agTxt = p => {
      if (!p.agLido) return 'agentes: ?';
      const a = p.agAtivos, c = p.cxAtivos; if (!a && !c) return 'nenhum agente agora';
      return [a ? (a === 1 ? '1 ajudante' : a + ' ajudantes') : null, c ? (c === 1 ? '1 Codex' : c + ' Codex') : null].filter(Boolean).join(' e ') + ' agora';
    };
    const estadoTxt = n => { const l = P.frase(linha0(n) || '').replace(/\s*·\s*/g, ' '); return l ? l.charAt(0).toLowerCase() + l.slice(1) : n.estado || '?'; };
    const nodeItem = (n, tipo, nivel, pai) => add({ id: n.id, tipo, nivel, nome: n.id === (coordC && coordC.id) ? 'Claude' : n.id === (coordX && coordX.id) ? 'Codex' : n.nome, lado: n.side === 'codex' ? 'codex' : 'claude', estado: n.estado, work: n.work, precisa: n.needsYou, acao: n.acao, node: n, pai, sessao: sessaoDe(n) });
    let cC = null, cX = null;
    if (coordC) { cC = nodeItem(coordC, 'coord', 1, 'voce'); voce.filhos.push(cC.id); execDe(cC); cC.frase = 'Coordena · ' + estadoTxt(coordC) + ' · ' + agTxt(cC); }
    if (coordX) { cX = nodeItem(coordX, 'coord', 1, 'voce'); voce.filhos.push(cX.id); cX.frase = 'Coordena o Codex · ' + estadoTxt(coordX) + (coordX.linhas[1] ? ' · ' + P.frase(coordX.linhas[1][0]).replace(/^./, c => c.toLowerCase()) : ''); }
    const sessoes = [];
    for (const n of sessN) {
      const it = nodeItem(n, 'sessao', 2, cC ? cC.id : 'voce'); (cC || voce).filhos.push(it.id); sessoes.push(it);
      if (it.sessao) execDe(it); else { it.agLido = true; it.agAtivos = 0; it.cxAtivos = 0; }
      it.frase = n.juntou ? P.frase(linha0(n)) : estadoTxt(n).replace(/^./, c => c.toUpperCase()) + ' · ' + agTxt(it);
      it.projeto = it.sessao && root.PainelProjetoDe ? root.PainelProjetoDe.SESSAO[it.sessao] || null : null;
    }
    if (soProjeto()) for (let i = sessoes.length - 1; i >= 0; i--) {
      const s = sessoes[i]; if (noProjeto(s.projeto) || s.filhos.some(f => { const x = items.get(f); return x && x.tipo !== 'grupo'; })) continue;
      sessoes.splice(i, 1); const pai = items.get(s.pai); if (pai) pai.filhos = pai.filhos.filter(f => f !== s.id); for (const f of s.filhos) items.delete(f); items.delete(s.id);
    }
    const semDonoV = soProjeto() ? semDonoN.filter(k => noProjeto((k.f2 || {}).projeto || 'outros')) : semDonoN;
    if (semDonoV.length) {
      const g = add({ id: 'grp:semdono', tipo: 'sessao', nivel: 2, nome: 'Codex sem dono', lado: 'codex', estado: semDonoV.some(n => n.work) ? 'trabalhando' : 'dormindo', work: semDonoV.some(n => n.work), pai: cX ? cX.id : 'voce', sessao: null,
        frase: semDonoV.length + (semDonoV.length === 1 ? ' rodada sem sessão provada' : ' rodadas sem sessão provada') + ' · origem não registrada' });
      (cX || voce).filhos.push(g.id); sessoes.push(g);
      for (const k of semDonoV) { const c = k.f2 || {}; if (soProjeto() && !noProjeto(c.projeto || 'outros')) continue; const realS = !c.titulo && c.soDono && c.soDono.titulo ? c.soDono.titulo : null; const x = add({ id: k.id, tipo: 'codex', nivel: 3, lado: 'codex', pai: g.id, node: k, f2: c, projeto: c.projeto || null, donoAberto: !!realS, nome: c.titulo ? P.frase(c.titulo) : realS ? P.frase(realS) : 'Rodada sem título na fonte', frase: P.frase(k.linhas[1] ? k.linhas[1][0] : '?'), estado: k.estado, work: k.work, acao: k.acao }); g.filhos.push(x.id); }
    }
    // ligacoes: cada linha do Fluxo de hoje vira a faixa que desce (de cima para baixo) ou a que sobe, na ligacao pai > filho
    const mapId = id => { if (items.has(id)) return id; for (const p of items.values()) if (p.aggId === id) return p.filhos.find(f => items.get(f).tipo === 'ajudante' || items.get(f).tipo === 'grupo') ? 'grp:' + p.id : null; return null; };
    const nivelDe = id => id.startsWith('grp:') && items.get(id.slice(4)) ? items.get(id.slice(4)).nivel + 1 : items.has(id) ? items.get(id).nivel : 9;
    const ehAncestral = (a, b) => { let x = items.get(b); while (x && x.pai) { if (x.pai === a) return true; x = items.get(x.pai); } return false; };
    const link = (pai, filho) => { const k = pai + '>' + filho; if (!links.has(k)) links.set(k, { key: k, pai, filho, desce: [], sobe: [] }); return links.get(k); };
    for (const l of P.linhas) {
      const a = mapId(l.from), b = mapId(l.to); if (!a || !b || a === b) continue;
      const grpA = a.startsWith('grp:') && !items.has(a), grpB = b.startsWith('grp:') && !items.has(b);
      const na = nivelDe(a), nb = nivelDe(b);
      const aPai = grpB ? true : grpA ? false : na < nb || (na === nb && ehAncestral(a, b));
      const L = aPai ? link(a, b) : link(b, a);
      (aPai ? L.desce : L.sobe).push(l);
    }
    // ligacoes de estrutura (sem mensagem nas ultimas 2 h): a linha pontilhada mostra quem responde a quem
    for (const it of items.values()) {
      if (!it.pai) continue;
      if (it.tipo === 'ajudante' || it.tipo === 'grupo') { link(it.pai, 'grp:' + it.pai); continue; }
      link(it.pai, it.id);
    }
    const soma = arr => arr.reduce((s, l) => s + (l.count || 0), 0);
    for (const L of links.values()) {
      L.nDesce = soma(L.desce); L.nSobe = soma(L.sobe);
      const pi = items.get(L.pai), fi = L.filho.startsWith('grp:') && !items.has(L.filho) ? null : items.get(L.filho);
      L.estilo = L.filho.startsWith('grp:') || (fi && (fi.tipo === 'ajudante' || fi.tipo === 'codex' || fi.tipo === 'grupo')) ? 'espinha' : (fi && pi && fi.nivel - pi.nivel === 1) ? 'degrau' : fi && pi && fi.nivel === pi.nivel ? 'lado' : 'atalho';
    }
    // envia e recebe de cada cartao (todas as mensagens lidas nas 2 h)
    for (const it of items.values()) { it.envia = 0; it.recebe = 0; }
    for (const l of P.linhas) { const a = mapId(l.from), b = mapId(l.to); const ia = items.get(a), ib = items.get(b); if (ia) ia.envia += l.count || 0; if (ib) ib.recebe += l.count || 0; }
    // cadeias: quem escorre para quem (so mensagens que desceram), de voce ate a ponta
    const desceDe = id => [...links.values()].filter(L => L.pai === id && L.nDesce > 0);
    const cadeias = [];
    const anda = (id, caminho) => {
      if (caminho.length > 6) return;
      const prox = desceDe(id);
      if (!prox.length) { if (caminho.length > 1) cadeias.push(caminho); return; }
      for (const L of prox) {
        if (L.filho.startsWith('grp:') && !items.has(L.filho)) {
          const p = items.get(L.pai), vivos = p.filhos.map(f => items.get(f)).filter(x => x.tipo === 'ajudante' && x.work);
          cadeias.push([...caminho, vivos.length === 1 ? vivos[0].id : 'grp:' + p.id]);
        } else if ((items.get(L.filho) || {}).tipo === 'grupo') { if (caminho.length > 1) cadeias.push(caminho); }
        else if (!caminho.includes(L.filho)) anda(L.filho, [...caminho, L.filho]);
      }
    };
    anda('voce', ['voce']);
    const estadoPonta = id => {
      if (id.startsWith('grp:') && !items.has(id)) { const p = items.get(id.slice(4)); const v = p.filhos.map(f => items.get(f)).filter(x => x.tipo === 'ajudante' && x.work).length; return v ? 'trabalhando' : 'terminou'; }
      const it = items.get(id); if (!it) return '?'; if (it.precisa) return 'esperando';
      return it.estado === 'trabalhando' ? 'trabalhando' : it.estado === 'esperando' ? 'esperando' : it.estado === 'terminou' ? 'terminou' : it.estado === 'dormindo' ? 'dormindo' : 'sem-leitura';
    };
    const PESO = { trabalhando: 0, esperando: 1, 'sem-leitura': 2, terminou: 3, dormindo: 4 };
    const porPonta = new Map(); for (const c of cadeias) { const o = porPonta.get(c[c.length - 1]); if (!o || c.length > o.length) porPonta.set(c[c.length - 1], c); }
    const cad = [...porPonta.values()].map(c => ({ ids: c, ponta: c[c.length - 1], estado: estadoPonta(c[c.length - 1]) })).sort((a, b) => (PESO[a.estado] ?? 9) - (PESO[b.estado] ?? 9) || b.ids.length - a.ids.length);
    const pontas = new Map(); for (const c of cad) { const id = c.ponta.startsWith('grp:') && !items.has(c.ponta) ? c.ponta.slice(4) : c.ponta; if (!pontas.has(id)) pontas.set(id, c.estado); }
    for (const c of cad) if (c.ponta.startsWith('grp:') && !items.has(c.ponta)) { const p = items.get(c.ponta.slice(4)); for (const f of p.filhos) { const x = items.get(f); if (x.tipo === 'ajudante' && x.work && !pontas.has(x.id)) pontas.set(x.id, 'trabalhando'); } pontas.delete(p.id); }
    for (const [id, e] of pontas) { const it = items.get(id); if (it && it.tipo !== 'grupo') it.ponta = e; }
    // ajudantes vivos de cada sessao (todos, sem o corte do desenho) com o nome da aba Equipe
    const ajLista = [];
    for (const p of [cC, ...sessoes].filter(Boolean)) {
      const v = p.filhos.map(f => items.get(f)).filter(x => x && x.tipo === 'ajudante' && x.work).map(x => { const n = nomeAj(x); return { id: x.id, tipo: 'ajudante', texto: n.texto, titulo: n.titulo, dono: !!x.donoAberto }; });
      p.ajVivos = v; if (v.length) ajLista.push({ id: p.id, sessao: p.sessao, nome: p.nome, itens: v });
    }
    // Codex rodando pela MESMA fonte da Equipe (todas as rodadas rodando de cada sessao e as sem dono provado),
    // nunca so os ate 3 cartoes por sessao que o mapa desenha. Sem leitura: null ("?").
    const f2 = P.f2 && P.f2.ok === true && Array.isArray(P.f2.sessoes) ? P.f2 : null, cxLista = [];
    if (f2) {
      const doProj = c => !soProjeto() || noProjeto(c.projeto || 'outros'), rodando = arr => (Array.isArray(arr) ? arr : []).filter(c => c && c.estado === 'rodando' && doProj(c));
      const chipCx = (c, sessao, g) => { const id = 'f2:' + c.id, t = tituloCx(P, c, { sessao }); return { id: items.has(id) ? id : g ? g.id : null, tipo: 'codex', texto: t.texto, dono: t.dono, proprio: items.has(id), titulo: 'Codex ' + (c.onde === 'vps' ? 'na VPS' : c.onde ? 'na máquina' : '') + ' · rodando há ' + P.haMin(c.idadeMin, '') }; };
      const ordemS = ['COORDENADOR', ...ORDEM], porS = new Map(f2.sessoes.map(s => [String(s.sessao || '').toUpperCase(), s]));
      for (const sid of [...ordemS, ...[...porS.keys()].filter(k => !ordemS.includes(k))]) {
        const s = porS.get(sid); if (!s) continue; const vivos = rodando(s.codex); if (!vivos.length) continue;
        const g = sid === 'COORDENADOR' ? cC : sessoes.find(x => x.sessao === sid) || null, itens = vivos.map(c => chipCx(c, sid, g));
        cxLista.push({ id: g ? g.id : null, sessao: sid, nome: g ? g.nome : sid.charAt(0) + sid.slice(1).toLowerCase(), itens }); if (g) g.cxVivos = itens;
      }
      const sd = rodando(f2.semDono);
      if (sd.length) { const g = items.get('grp:semdono') || null, itens = sd.map(c => chipCx(c, null, g)); cxLista.push({ id: g ? g.id : null, sessao: null, nome: 'Sem dono provado', itens }); if (g) g.cxVivos = itens; }
      // o cartao da sessao diz o mesmo numero do topo
      if (cC && cC.cxVivos) { cC.cxAtivos = cC.cxVivos.length; cC.frase = 'Coordena · ' + estadoTxt(coordC) + ' · ' + agTxt(cC); }
      for (const s of sessoes) if (s.cxVivos && s.node && !s.node.juntou && s.sessao) { s.cxAtivos = s.cxVivos.length; s.frase = estadoTxt(s.node).replace(/^./, c => c.toUpperCase()) + ' · ' + agTxt(s); }
    }
    // cada cadeia diz de que sessao e, com os ajudantes vivos e o Codex rodando dela
    for (const c of cad) {
      const sid = [...c.ids].reverse().map(id => id.startsWith('grp:') && !items.has(id) ? id.slice(4) : id).find(id => { const x = items.get(id); return x && (x.tipo === 'sessao' || x.tipo === 'coord'); });
      const p = sid ? items.get(sid) : null; c.sessaoId = p ? p.id : null; c.ajudantes = p && p.ajVivos || []; c.codex = p && p.cxVivos || [];
    }
    // resumo do topo
    const ag = [...items.values()].filter(x => x.tipo === 'ajudante');
    const lido = [cC, ...sessoes].filter(Boolean).every(p => p.agLido !== false);
    const resumo = { ajudantes: lido ? ag.filter(x => x.work).length : null, codex: f2 ? cxLista.reduce((s, g) => s + g.itens.length, 0) : null, sessoes: sessoes.filter(s => s.work).length, sessoesTotal: sessoes.length, cards: cardsN,
      porSessao: [cC, ...sessoes].filter(Boolean).filter(p => p.agAtivos).map(p => p.nome + ' ' + p.agAtivos), cxPorSessao: cxLista.map(g => g.nome + ' ' + g.itens.length), ajLista, cxLista };
    for (const it of items.values()) it.partes = partesDe(P, it, estadoTxt);
    return { items, links, voce, cC, cX, sessoes, cadeias: cad, resumo };
  }

  const capP = s => { const t = String(s || '').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; };
  const soltasP = s => String(s || '').split(/\s+·\s+/).map(x => x.trim()).filter(Boolean);
  const semPontoP = s => String(s || '').replace(/\s*·\s*/g, ', ').trim();
  function partesDe(P, it, estadoTxt) {
    const n = it.node || null, quem = () => (it.agLido === false ? { lido: false, aj: null, cx: null } : { lido: true, aj: it.agAtivos || 0, cx: it.cxAtivos || 0 });
    if (it.tipo === 'coord' && n && it.lado !== 'codex') return { rotulos: ['Coordena'], estado: capP(estadoTxt(n)), quem: quem(), extras: [] };
    if (it.tipo === 'coord' && n) return { rotulos: ['Coordena o Codex'], estado: capP(estadoTxt(n)), quem: null, extras: n.linhas && n.linhas[1] ? [capP(semPontoP(P.frase(n.linhas[1][0])))] : [] };
    if (it.tipo === 'sessao' && n && !n.juntou) return { rotulos: [], estado: capP(estadoTxt(n)), quem: quem(), extras: [] };
    const p = soltasP(it.frase);
    if (it.tipo === 'ajudante' || (it.tipo === 'codex' && it.sessao !== undefined && p.length > 1)) return { rotulos: p.slice(0, -1), estado: capP(p[p.length - 1]), quem: null, extras: [] };
    const semEstado = e => (e ? { estado: e } : { estado: SEM_ESTADO, estadoDica: SEM_ESTADO_SOL });
    if (it.tipo === 'codex') return Object.assign({ rotulos: [], quem: null, extras: [] }, semEstado(capP(semPontoP(it.frase))));
    return Object.assign({ rotulos: [], quem: null, extras: p.slice(1).map(capP) }, semEstado(capP(p[0])));
  }
  const SEM_ESTADO = 'Sem estado lido', SEM_ESTADO_SOL = 'Solução: o painel lê de novo sozinho em 30 s';
  function linhasPartes(h, it, pre, opcoes) {
    const pt = it && it.partes, o = opcoes || {}; if (!pt) return null;
    const out = [], quem = h('span', pre + '-quem'); let n = 0;
    const poe = el => { if (n) quem.append(' '); quem.append(el); n++; };
    if (pt.estado) { const e = h('span', pre + '-estado', pt.estado); e.dataset.estado = it.precisa ? 'precisa' : it.estado || 'sem'; if (pt.estadoDica) e.title = pt.estadoDica; out.push(e); }
    for (const r of pt.rotulos) poe(h('span', pre + '-papel', r));
    if (pt.quem) {
      const q = pt.quem;
      if (!q.lido) { const v = h('span', pre + '-quem-vazio', 'agentes: ?'); v.title = 'A conversa desta sessão não foi lida. Solução: o painel tenta de novo sozinho a cada 30 s; se seguir, abra a sessão no app'; poe(v); }
      else if (!q.aj && !q.cx) poe(h('span', pre + '-quem-vazio', 'nenhum agente agora'));
      else {
        if (q.aj) { const s = h('span', pre + '-quem-selo is-claude', q.aj === 1 ? '1 ajudante' : q.aj + ' ajudantes'); s.title = it.nome + ': ' + (q.aj === 1 ? '1 ajudante do Claude trabalhando agora' : q.aj + ' ajudantes do Claude trabalhando agora'); poe(s); }
        if (q.cx) { const s = h('span', pre + '-quem-selo is-codex', q.cx === 1 ? '1 Codex' : q.cx + ' Codex'); s.title = it.nome + ': ' + (q.cx === 1 ? '1 rodada do Codex rodando agora' : q.cx + ' rodadas do Codex rodando agora'); poe(s); }
        poe(h('span', pre + '-quem-quando', 'agora'));
      }
    }
    if (o.extrasNaLinha) for (const x of pt.extras) poe(h('span', pre + '-extra', x));
    if (n) out.push(quem);
    if (!o.extrasNaLinha) for (const x of pt.extras) out.push(h('span', pre + '-extra', x));
    return out;
  }
  function seloEmDois(h, el) {
    for (const s of el.querySelectorAll('.fv-selo')) { const t = s.textContent, i = t.indexOf(' · '); if (i < 1) continue; s.replaceChildren(h('span', 'fv-selo-a', t.slice(0, i)), ' ', h('span', 'fv-selo-b', t.slice(i + 3))); }
  }
  function desencostar(mapa, R, W, H) {
    const fixos = [...mapa.querySelectorAll('.fv-card,.fv-mais,.fv-banda-rot>*,.fv-grupo-cab>*')].map(el => R(el)).filter(r => r && r.w && r.h).map(r => ({ l: r.l - 3, t: r.t - 3, r: r.r + 3, b: r.b + 3 })), postos = [];
    const livre = (x, y, w, h) => !fixos.some(o => x < o.r && x + w > o.l && y < o.b && y + h > o.t) && !postos.some(o => x < o.r + 2 && x + w > o.l - 2 && y < o.b + 2 && y + h > o.t - 2);
    for (const pill of mapa.querySelectorAll('.fv-pill')) {
      const w = pill.offsetWidth, h = pill.offsetHeight, x0 = parseFloat(pill.style.left) || 0, y0 = parseFloat(pill.style.top) || 0; let x = x0, y = y0;
      if (!livre(x, y, w, h)) {
        let melhor = null;
        for (let dy = -240; dy <= 240; dy += 6) for (let dx = -300; dx <= 300; dx += 6) {
          const nx = Math.max(0, Math.min(W - w, Math.round(x0 + dx))), ny = Math.max(0, Math.min(H - h, Math.round(y0 + dy))); if (!livre(nx, ny, w, h)) continue;
          const d = Math.abs(nx - x0) + Math.abs(ny - y0) * 1.5; if (!melhor || d < melhor.d) melhor = { x: nx, y: ny, d };
        }
        if (melhor) { x = melhor.x; y = melhor.y; pill.style.left = x + 'px'; pill.style.top = y + 'px'; pill.dataset.desviado = '1'; }
      }
      postos.push({ l: x, t: y, r: x + w, b: y + h });
    }
  }
  root.PainelFluxoPartes = Object.freeze({ de: partesDe, linhas: linhasPartes, desencostar });

  // ---------- cartoes ----------
  function nomeCurto(M, id) { if (id.startsWith('grp:') && !M.items.has(id)) { const p = M.items.get(id.slice(4)); return 'Ajudantes: ' + (p ? p.nome : '?'); } const it = M.items.get(id); return it ? it.nome : '?'; }
  function selo(P, txt, cls, titulo) { const s = P.h('span', 'fv-selo ' + (cls || ''), txt); if (titulo) s.title = titulo; return s; }
  // chips de quem trabalha agora (ajudante ou Codex); max = quantos a vista (0 = todos) e o "+N" abre o cartao da sessao
  function fecharListas() { if (!ST.lista) return; ST.lista = null; ST.listaFixa = false; for (const o of doc.querySelectorAll('.fv-num.tem-lista')) { o.setAttribute('aria-expanded', 'false'); delete o.dataset.aberto; } }
  function chipsDe(P, itens, max, alvoMais) {
    const box = P.h('div', 'fv-cad-chips'), vis = max ? itens.slice(0, max) : itens;
    for (const x of vis) {
      const b = P.h('button', 'fv-cad-chip is-' + x.tipo + (x.dono ? ' is-dono' : ''), x.texto); b.type = 'button'; b.dataset.tipo = x.tipo;
      if (x.titulo) b.title = x.titulo + (x.dono ? ' · reservado, aberto só neste PC' : '');
      if (x.id) {
        b.setAttribute('aria-label', (x.tipo === 'codex' ? 'Codex: ' : 'Ajudante: ') + x.texto + '. Abre o detalhe');
        b.addEventListener('click', e => { if (e && e.stopPropagation) e.stopPropagation(); fecharListas(); abrir(x.id); });
        b.addEventListener('mouseenter', () => acender(x.id)); b.addEventListener('mouseleave', () => acender(null));
      }
      box.append(b);
    }
    if (max && itens.length > max) {
      const n = itens.length - max, m = P.h('button', 'fv-cad-mais', '+' + n); m.type = 'button';
      m.title = n + ' a mais: abre o cartão da sessão com a lista inteira'; m.setAttribute('aria-label', 'Mais ' + n + '. Abre o cartão da sessão');
      if (alvoMais) m.addEventListener('click', e => { if (e && e.stopPropagation) e.stopPropagation(); abrir(alvoMais); });
      box.append(m);
    }
    return box;
  }
  const PONTA_T = { trabalhando: 'Ponta · trabalhando', esperando: 'Ponta · parada esperando', terminou: 'Ponta · entregou', dormindo: 'Ponta · dormindo', 'sem-leitura': 'Ponta · sem leitura' };
  function card(P, it, compacto) {
    const el = P.h('div', 'g-no fv-card fv-' + it.tipo + (compacto ? ' is-filho' : ''));
    const face = it.tipo === 'voce' ? P.icon('diamante', P.css('--g-rosa')) : P.identicon(it.tipo === 'ajudante' ? (it.agente && it.agente.tipo || 'aj') + it.id.slice(-4) : it.id, P.sideColor(it.lado === 'codex' ? 'codex' : 'claude'), compacto ? 3 : 4);
    const sprite = P.h('span', 'g-acao'); sprite.setAttribute('aria-hidden', 'true');
    const meta = P.h('div', 'fv-meta');
    if (it.tipo === 'ajudante') { meta.append(selo(P, '↓ tarefa', 'is-recebe', 'Recebeu a tarefa de ' + (it.pai && ST.M ? nomeCurto(ST.M, it.pai) : '?')), selo(P, it.agente.terminou ? '↑ entregou' : '↑ ainda não', it.agente.terminou ? 'is-envia' : 'is-zero')); }
    else if (it.tipo === 'grupo') { /* conta na linha */ }
    else if (it.tipo === 'sessao' && estreito() && modoDaLargura() !== 'c') { /* contadores da ligacao, logo abaixo */ }
    else {
      if (it.recebe) meta.append(selo(P, '↓ recebe ' + it.recebe, 'is-recebe', 'Recebeu ' + it.recebe + ' mensagens nas últimas 2 h'));
      if (it.envia) meta.append(selo(P, '↑ envia ' + it.envia, 'is-envia', 'Mandou ' + it.envia + ' mensagens nas últimas 2 h'));
      if (!it.recebe && !it.envia) meta.append(selo(P, 'sem mensagem em 2 h', 'is-zero'));
    }
    if (it.tipo === 'sessao' && estreito() && modoDaLargura() !== 'c' && ST.M) { const cs = contadores(P, ST.M, it, true); if (cs.length) meta.prepend(...cs); }
    if (it.ponta) meta.append(selo(P, PONTA_T[it.ponta] || 'Ponta', 'is-ponta is-' + it.ponta, 'Onde a cadeia de comandos para agora'));
    if (it.projeto && (it.tipo === 'ajudante' || it.tipo === 'codex' || it.tipo === 'sessao')) meta.append(selo(P, projNome(it.projeto), 'is-proj' + (projAtivo() !== 'todos' && it.projeto === projAtivo() ? ' is-ativo' : ''), 'Projeto: ' + projNome(it.projeto) + ' (pela pasta de trabalho, depois pelo título e pela sessão)'));
    if (it.donoAberto) meta.append(selo(P, 'reservado · aberto só neste PC', 'is-dono', 'Assunto reservado: aparece porque o modo dono está ligado neste PC'));
    el.append(P.h('span', 'g-no-face', face), P.h('div', 'fv-corpo', P.h('div', 'fv-nome', P.h('span', 'g-no-t', it.nome), it.tipo === 'voce' ? null : sprite), P.h('p', 'fv-frase', it.frase), meta.childNodes.length ? meta : null));
    { const pls = linhasPartes(P.h, it, 'fv'), fr = el.querySelector('.fv-frase'); if (pls && pls.length && fr) { fr.replaceChildren(...pls); fr.classList.add('is-partes'); } seloEmDois(P.h, el); }
    el.dataset.id = it.id; el.dataset.lado = it.lado; el.dataset.estado = it.estado || ''; el.dataset.work = it.work ? '1' : '0'; if (it.projeto) el.dataset.projeto = it.projeto;
    if (projAtivo() !== 'todos' && !soProjeto() && it.projeto && it.projeto !== projAtivo() && (it.tipo === 'ajudante' || it.tipo === 'codex')) el.classList.add('is-fora-proj');
    if (it.acao) el.dataset.acao = it.acao; if (it.precisa) el.dataset.precisa = '1'; if (ST.sel === it.id) el.dataset.sel = '1';
    el.tabIndex = 0; el.setAttribute('role', 'button'); el.setAttribute('aria-label', it.nome + '. ' + it.frase + '. Abre o detalhe');
    el.addEventListener('click', () => abrir(it.id)); el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(it.id); } });
    el.addEventListener('mouseenter', () => acender(it.id)); el.addEventListener('mouseleave', () => acender(null));
    el.addEventListener('focus', () => acender(it.id)); el.addEventListener('blur', () => acender(null));
    it.el = el; return el;
  }
  // contador da ligacao com quem esta em cima, para mostrar na propria linha do item (C e celular)
  function contadores(P, M, it, noCartao) {
    const out = [];
    const L = it.pai ? M.links.get(it.pai + '>' + (it.tipo === 'ajudante' || it.tipo === 'grupo' ? 'grp:' + it.pai : it.id)) : null;
    if (L && (it.tipo !== 'ajudante' || it === M.items.get(M.items.get(it.pai).filhos[0]))) {
      if (L.nDesce) out.push(selo(P, '↓ ' + L.nDesce + (it.tipo === 'sessao' ? ' · ' + nomeCurto(M, L.pai).replace(/ do Claude$/, '') : ''), 'is-desce', L.nDesce + ' desceram de ' + nomeCurto(M, L.pai)));
      if (noCartao && it.tipo === 'sessao' && !L.nDesce && !L.nSobe) out.push(selo(P, 'sem mensagem em 2 h', 'is-zero'));
      if (L.nSobe) out.push(selo(P, '↑ ' + L.nSobe, 'is-sobe', L.nSobe + ' subiram para ' + nomeCurto(M, L.pai)));
    }
    const atalho = [...M.links.values()].find(x => x.filho === it.id && x.estilo === 'atalho' && (x.nDesce || x.nSobe));
    if (atalho) out.push(selo(P, '↓ ' + atalho.nDesce + ' de você', 'is-desce is-voce', atalho.nDesce + ' vieram direto de você'));
    return out;
  }
  function pilha(P, M, p, max) {
    const box = P.h('div', 'fv-pilha'); box.dataset.pai = p.id; const fs = p.filhos.map(f => M.items.get(f)).filter(x => x && x.nivel > p.nivel && (x.tipo === 'ajudante' || x.tipo === 'codex' || x.tipo === 'grupo'));
    if (!fs.length) return null;
    const vis = fs.slice(0, max); for (const x of vis) box.append(card(P, x, true));
    if (fs.length > vis.length) { const nm = fs.length - vis.length, mais = P.h('button', 'fv-mais', '+ ' + nm + (nm === 1 ? ' que já entregou' : ' que já entregaram')); mais.type = 'button'; mais.addEventListener('click', () => abrir(p.id)); box.append(mais); }
    return box;
  }

  // ---------- os 3 desenhos ----------
  // nivel Coordena (A e B): no desktop, a assessoria do Claude (os ajudantes e os Codex dela) fica a esquerda, ligada pelo lado;
  // no celular, um botao abre o detalhe com a lista (o tronco das sessoes desce pela esquerda e nao pode cruzar a pilha)
  function nivelCoord(P, M, max, cls) {
    const box = P.h('div', cls + (estreito() ? '' : ' is-assessoria'));
    if (estreito()) {
      const linha = P.h('div', 'fv-coord-linha'); for (const c of [M.cC, M.cX].filter(Boolean)) linha.append(P.h('div', 'fv-col', card(P, c, true))); box.append(linha);
      const nAs = M.cC ? M.cC.filhos.length : 0;
      if (nAs) { const b = P.h('button', 'fv-mais fv-mais-as', 'Ajudantes do Coordenador: ' + nAs + ' em 2 h · ver'); b.type = 'button'; b.addEventListener('click', () => abrir(M.cC.id)); box.append(b); }
      return box;
    }
    const pl = M.cC ? pilha(P, M, M.cC, max) : null; if (pl) pl.classList.add('is-lado');
    box.append(P.h('div', 'fv-as-col', pl), P.h('div', 'fv-col fv-c-claude', M.cC ? card(P, M.cC) : null), P.h('div', 'fv-col fv-c-codex', M.cX ? card(P, M.cX) : null));
    return box;
  }
  function desenhoA(P, M) {
    const mapa = P.h('div', 'fv-mapa fv-a'), max = estreito() ? 3 : 4;
    mapa.append(P.h('div', 'fv-nivel fv-n0', card(P, M.voce)));
    mapa.append(nivelCoord(P, M, max, 'fv-nivel fv-n1'));
    const n2 = P.h('div', 'fv-nivel fv-n2 fv-cols'); n2.style.setProperty('--fv-n', Math.min(M.sessoes.length, 5));
    for (const s of M.sessoes) n2.append(P.h('div', 'fv-col', card(P, s), pilha(P, M, s, max)));
    mapa.append(n2); return mapa;
  }
  function desenhoC(P, M) {
    const mapa = P.h('div', 'fv-mapa fv-c'), lista = P.h('div', 'fv-arvore');
    const linhaDe = (it, prof) => {
      const row = P.h('div', 'fv-linha'); row.style.setProperty('--fv-prof', prof); row.dataset.id = it.id;
      const cont = P.h('div', 'fv-conta', ...contadores(P, M, it));
      row.append(card(P, it, it.nivel >= 3 || (it.tipo !== 'voce' && it.tipo !== 'coord' && it.tipo !== 'sessao'))); if (cont.childNodes.length) row.append(cont);
      lista.append(row);
    };
    const max = 5;
    const desce = (it, prof) => {
      linhaDe(it, prof);
      const fs = it.filhos.map(f => M.items.get(f)).filter(Boolean);
      const execs = fs.filter(x => x.tipo === 'ajudante' || x.tipo === 'codex' || x.tipo === 'grupo'), outros = fs.filter(x => !execs.includes(x));
      execs.slice(0, max).forEach(x => linhaDe(x, prof + 1));
      if (execs.length > max) { const nm = execs.length - max, mais = P.h('button', 'fv-mais', '+ ' + nm + (nm === 1 ? ' que já entregou' : ' que já entregaram')); mais.type = 'button'; mais.style.setProperty('--fv-prof', prof + 1); mais.addEventListener('click', () => abrir(it.id)); lista.append(mais); }
      for (const o of outros) desce(o, prof + 1);
    };
    desce(M.voce, 0);
    mapa.append(lista); return mapa;
  }

  // ---------- linhas em degrau, contadores colados e as faixas da animacao ----------
  function desenhar(P, M, mapa, modo) {
    const base = mapa.getBoundingClientRect(), W = Math.round(mapa.clientWidth), H = Math.round(mapa.scrollHeight);
    const R = el => { const r = el.getBoundingClientRect(); return { l: r.left - base.left, t: r.top - base.top, r: r.right - base.left, b: r.bottom - base.top, cx: (r.left + r.right) / 2 - base.left, cy: (r.top + r.bottom) / 2 - base.top, w: r.width, h: r.height }; };
    const svg = doc.createElementNS(SVGNS, 'svg'); svg.setAttribute('class', 'fv-fios g-fios'); svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('shape-rendering', 'crispEdges'); svg.setAttribute('aria-hidden', 'true'); mapa.prepend(svg);
    const camada = doc.createElement('canvas'); camada.className = 'g-anim'; camada.setAttribute('aria-hidden', 'true'); mapa.append(camada);
    const cards = [...mapa.querySelectorAll('.fv-card')], rects = new Map(cards.map(el => [el.dataset.id, R(el)]));
    const px = v => Math.round(v) + 0.5, fios = [], tags = [];
    const rFace = id => { const it = M.items.get(id); const f = it && it.el && it.el.querySelector('.g-no-face'); return f ? R(f) : null; };
    const seta = (x, y, dir) => { const p = doc.createElementNS(SVGNS, 'path'); const pts = dir === 'd' ? [[x - 4, y - 5], [x + 0.5, y + 1], [x + 5, y - 5]] : dir === 'u' ? [[x - 4, y + 5], [x + 0.5, y - 1], [x + 5, y + 5]] : dir === 'r' ? [[x - 5, y - 4], [x + 1, y + 0.5], [x - 5, y + 5]] : [[x + 6, y - 4], [x, y + 0.5], [x + 6, y + 5]]; p.setAttribute('d', 'M' + pts.map(q => q.join(' ')).join(' L') + ' Z'); p.setAttribute('class', 'g-fio-seta'); return p; };
    const dirFim = pts => { const a = pts[pts.length - 2], b = pts[pts.length - 1]; return Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]) ? (b[0] > a[0] ? 'r' : 'l') : (b[1] > a[1] ? 'd' : 'u'); };
    const idade = arr => { const m = Math.min(...arr.map(l => Number.isFinite(l.ageMin) ? l.ageMin : 1e9)); return m < 2 ? 'quente' : m < 5 ? 'morno' : m < 15 ? 'recente' : 'frio'; };
    const desloca = (pts, d) => pts.map((q, i) => { const a = pts[i - 1] || q, b = pts[i + 1] || q; const vert = (a[0] === q[0] && i > 0) || (b[0] === q[0] && i < pts.length - 1); const horiz = (a[1] === q[1] && i > 0) || (b[1] === q[1] && i < pts.length - 1); return [q[0] + (vert ? d : 0), q[1] + (horiz ? d : 0)]; });
    // geometria de cada ligacao
    const caminho = (L) => {
      const a = rects.get(L.pai); if (!a) return null;
      { const gh = fhCaminho(L, M, rects, a, rFace, modo); if (gh !== undefined) return gh; }
      const fiTipo = (M.items.get(L.filho) || {}).tipo;
      const paiTipo = (M.items.get(L.pai) || {}).tipo;
      if (L.estilo === 'espinha' && paiTipo === 'coord' && modo !== 'c' && !estreito()) {
        const it = M.items.get(L.filho);
        const alvos = L.filho.startsWith('grp:') && !M.items.has(L.filho) ? M.items.get(L.pai).filhos.map(f => M.items.get(f)).filter(x => x && (x.tipo === 'ajudante' || x.tipo === 'grupo') && rects.has(x.id)).map(x => rects.get(x.id)) : it && rects.has(it.id) ? [rects.get(it.id)] : [];
        if (!alvos.length) return null;
        const sx = Math.round(Math.max(...alvos.map(r => r.r)) + 28), y0 = Math.round(a.t + 22), cyDe = r => Math.round(r.t + Math.min(22, r.h / 2)), ult = alvos.reduce((m, r) => r.t > m.t ? r : m, alvos[0]);
        return { pts: [[Math.round(a.l - 4), y0], [sx, y0], [sx, cyDe(ult)], [Math.round(ult.r + 4), cyDe(ult)]], stubs: alvos.filter(r => r !== ult).map(r => [[sx, cyDe(r)], [Math.round(r.r + 4), cyDe(r)]]), tagEm: [sx, y0 - 26], espinha: true, lado: true };
      }
      if (L.estilo === 'espinha' || modo === 'c' || (estreito() && L.estilo === 'degrau' && fiTipo === 'sessao')) {
        const it = M.items.get(L.filho);
        let alvos;
        if (L.filho.startsWith('grp:') && !M.items.has(L.filho)) { const p = M.items.get(L.pai); alvos = p.filhos.map(f => M.items.get(f)).filter(x => x && (x.tipo === 'ajudante' || x.tipo === 'grupo') && rects.has(x.id)).map(x => rects.get(x.id)); }
        else alvos = it && rects.has(it.id) ? [rects.get(it.id)] : [];
        if (!alvos.length) return null;
        const fa = rFace(L.pai) || a, sx = Math.round(fa.cx);
        const ult = alvos[alvos.length - 1], fu = { cy: Math.round(ult.t + Math.min(22, ult.h / 2)) };
        return { pts: [[sx, Math.round(fa.b + 4)], [sx, fu.cy], [Math.round(ult.l - 4), fu.cy]], stubs: alvos.slice(0, -1).map(r => [[sx, Math.round(r.t + Math.min(22, r.h / 2))], [Math.round(r.l - 4), Math.round(r.t + Math.min(22, r.h / 2))]]), tagEm: [sx + 10, Math.round(a.b + 18)], espinha: true };
      }
      const b = rects.get(L.filho); if (!b) return null;
      if (L.estilo === 'lado') { const esq = a.cx < b.cx, y = Math.round(Math.min(a.b, b.b) - 22); return { pts: [[Math.round(esq ? a.r + 4 : a.l - 4), y], [Math.round(esq ? b.l - 4 : b.r + 4), y]], tagEm: [Math.round((a.cx + b.cx) / 2), y] }; }
      if (L.estilo === 'atalho') {
        const esq = b.cx < a.cx, y0 = Math.round(a.t + 22), xb = Math.round(b.cx + (L.porta || 0));
        const bloqueia = x => [...rects.entries()].some(([id, r]) => id !== L.pai && id !== L.filho && x > r.l - 6 && x < r.r + 6 && r.b > y0 && r.t < b.t);
        if (!bloqueia(xb) && (esq ? xb < a.l : xb > a.r)) return { pts: [[Math.round(esq ? a.l - 4 : a.r + 4), y0], [xb, y0], [xb, Math.round(b.t - 4)]], tagEm: [xb, Math.round(b.t - 16)] };
        const meio = [...rects.values()].filter(r => r.t > a.b - 1 && r.b < b.t + 1);
        const xg = esq ? Math.max(4, Math.round(Math.min(a.l, ...meio.map(r => r.l)) - 12)) : Math.min(W - 4, Math.round(Math.max(a.r, ...meio.map(r => r.r)) + 12)), yb = Math.round(b.t - 30);
        return { pts: [[Math.round(esq ? a.l - 4 : a.r + 4), y0], [xg, y0], [xg, yb], [xb, yb], [xb, Math.round(b.t - 4)]], tagEm: [xb, Math.round(b.t - 16)] };
      }
      // degrau: sai de baixo do pai, desce ate a sua faixa no vao, anda na horizontal e desce no filho
      const yb = Math.round(a.b + 14 + (L.faixa || 0) * 10), xa = Math.round(a.cx + (L.portaPai || 0)), xb = Math.round(b.cx + (L.porta || 0));
      if (Math.abs(xa - xb) < 3) return { pts: [[xa, Math.round(a.b + 4)], [xa, Math.round(b.t - 4)]], tagEm: [xa, Math.round(b.t - 16)] };
      return { pts: [[xa, Math.round(a.b + 4)], [xa, yb], [xb, yb], [xb, Math.round(b.t - 4)]], tagEm: [xb, Math.round(b.t - 16)] };
    };
    // portas e faixas: no pai, os filhos da esquerda para a direita; no vao, o mais de fora fica mais alto (nada se cruza)
    const porPai = new Map(), porFilho = new Map();
    for (const L of M.links.values()) { if (L.estilo === 'degrau') { if (!porPai.has(L.pai)) porPai.set(L.pai, []); porPai.get(L.pai).push(L); } if (L.estilo === 'degrau' || L.estilo === 'atalho') { if (!porFilho.has(L.filho)) porFilho.set(L.filho, []); porFilho.get(L.filho).push(L); } }
    for (const [pai, ls] of porPai) {
      const a = rects.get(pai); if (!a) continue; const cx = l => (rects.get(l.filho) || { cx: 0 }).cx;
      ls.sort((x, y) => cx(x) - cx(y)); const n = ls.length, passo = Math.min(14, Math.max(8, (a.w - 40) / Math.max(1, n)));
      ls.forEach((L, i) => { L.portaPai = (i - (n - 1) / 2) * passo; });
      const xa = L => a.cx + L.portaPai, esq = ls.filter(L => cx(L) < xa(L) - 2), dir = ls.filter(L => cx(L) > xa(L) + 2).reverse();
      esq.forEach((L, i) => { L.faixa = i; }); dir.forEach((L, i) => { L.faixa = i; });
    }
    for (const ls of porFilho.values()) { const n = ls.length; ls.sort((x, y) => (x.estilo === 'atalho') - (y.estilo === 'atalho')); ls.forEach((L, i) => { L.porta = (i - (n - 1) / 2) * 16; }); }
    for (const L of M.links.values()) {
      const g = caminho(L); if (!g) continue;
      const temMsg = L.nDesce > 0 || L.nSobe > 0, grupo = doc.createElementNS(SVGNS, 'g');
      grupo.setAttribute('class', 'fv-lig'); grupo.dataset.key = L.key; grupo.dataset.pai = L.pai; grupo.dataset.filho = L.filho; grupo.dataset.estilo = L.estilo;
      for (const s of g.stubs || []) { const p = doc.createElementNS(SVGNS, 'path'); p.setAttribute('d', 'M' + s.map(q => px(q[0]) + ' ' + px(q[1])).join(' L')); p.setAttribute('class', 'fv-galho'); grupo.append(p); }
      if (!temMsg) { const p = doc.createElementNS(SVGNS, 'path'); p.setAttribute('d', 'M' + g.pts.map(q => px(q[0]) + ' ' + px(q[1])).join(' L')); p.setAttribute('class', 'fv-estrutura'); grupo.append(p); if (emDemo()) { const pi = M.items.get(L.pai), kk = L.key + ':demo'; fios.push({ key: kk, el: grupo, pts: g.pts, de: L.pai, para: L.filho, deNome: pi ? pi.nome : '', paraNome: nomeCurto(M, L.filho), ida: { key: kk, kind: 'comando', sender: (pi && pi.lado) || 'claude', count: 0, last: '', recent: false, ageMin: null, resumo: null }, volta: null }); } svg.append(grupo); continue; }
      const pai = M.items.get(L.pai), filhoNome = nomeCurto(M, L.filho), paiNome = pai ? pai.nome : '?';
      for (const [lista, sentido] of [[L.desce, 'd'], [L.sobe, 'u']]) {
        const n = lista.reduce((s, l) => s + (l.count || 0), 0);
        const ptsBase = desloca(g.pts, sentido === 'd' ? -3 : 3), pts = sentido === 'd' ? ptsBase : ptsBase.slice().reverse();
        if (!n) continue;
        const kinds = {}; for (const l of lista) kinds[l.kind] = (kinds[l.kind] || 0) + (l.count || 0);
        const kind = Object.keys(kinds).sort((x, y) => kinds[y] - kinds[x])[0] || (sentido === 'd' ? 'comando' : 'resposta');
        const sender = (lista.find(l => l.sender) || {}).sender || (sentido === 'd' ? (pai && pai.lado) : 'claude');
        const fg = doc.createElementNS(SVGNS, 'g'); fg.setAttribute('class', 'g-fio'); fg.dataset.lado = sender; fg.dataset.kind = kind; fg.dataset.idade = idade(lista); fg.dataset.key = L.key + ':' + sentido;
        const p = doc.createElementNS(SVGNS, 'path'); p.setAttribute('d', 'M' + pts.map(q => px(q[0]) + ' ' + px(q[1])).join(' L')); p.setAttribute('class', 'g-fio-l k-' + kind); fg.append(p);
        const fim = pts[pts.length - 1]; fg.append(seta(Math.round(fim[0]), Math.round(fim[1]), dirFim(pts)));
        const tt = doc.createElementNS(SVGNS, 'title'); const deN = sentido === 'd' ? paiNome : filhoNome, paraN = sentido === 'd' ? filhoNome : paiNome;
        const kt = Object.entries(kinds).map(([k, c]) => P.kindN(k, c)).join(', ');
        const ult = lista.slice().sort((x, y) => (x.ageMin ?? 1e9) - (y.ageMin ?? 1e9))[0];
        tt.textContent = deN + ' → ' + paraN + ' · ' + kt + (ult && ult.resumo ? ' · última: ' + ult.resumo : ''); fg.prepend(tt); grupo.append(fg);
        const recente = lista.some(l => l.recent);
        for (const [k, c] of Object.entries(kinds)) {
          const sub = lista.filter(l => l.kind === k), u = sub.slice().sort((x, y) => (x.ageMin ?? 1e9) - (y.ageMin ?? 1e9))[0], kk = L.key + ':' + sentido + ':' + k;
          fios.push({ key: kk, el: fg, pts, de: sentido === 'd' ? L.pai : L.filho, para: sentido === 'd' ? L.filho : L.pai, deNome: deN, paraNome: paraN,
            ida: { key: kk, kind: k, sender, count: c, last: u ? u.last : '', recent: sub.some(l => l.recent), ageMin: u ? u.ageMin : null, resumo: u ? u.resumo : null }, volta: null });
        }
      }
      svg.append(grupo);
      const fiT = (M.items.get(L.filho) || {}).tipo, paiT = pai && pai.tipo;
      const noCartao = estreito() && ((L.estilo === 'degrau' && fiT === 'sessao') || L.estilo === 'atalho');
      if (modo !== 'c' && g.tagEm && !noCartao) tags.push({ L, em: g.tagEm, espinha: !!g.espinha, lado: !!g.lado, paiNome, filhoNome });
    }
    const esp = new Map(), resto = [];
    for (const t of tags) { if (!t.espinha) { resto.push(t); continue; } const o = esp.get(t.L.pai) || { L: { key: 'esp:' + t.L.pai, pai: t.L.pai, nDesce: 0, nSobe: 0 }, em: t.em, espinha: true, lado: t.lado, paiNome: t.paiNome, filhoNome: 'os agentes dela' }; o.L.nDesce += t.L.nDesce; o.L.nSobe += t.L.nSobe; if (t.em[1] < o.em[1] || t.lado) o.em = t.em; esp.set(t.L.pai, o); }
    tags.length = 0; tags.push(...resto, ...[...esp.values()].filter(t => t.L.nDesce || t.L.nSobe));
    // contadores colados na linha (A e B): "↓ 8 · ↑ 3" no trecho de cada ligacao; o detalhe fica no title
    const ocupado = [...rects.values()].map(r => ({ l: r.l - 2, t: r.t - 2, r: r.r + 2, b: r.b + 2 }));
    for (const el of mapa.querySelectorAll('.fv-banda-rot>*,.fv-grupo-cab>*,.fv-mais')) { const r = R(el); if (r.w && r.h) ocupado.push({ l: r.l - 4, t: r.t - 2, r: r.r + 4, b: r.b + 2 }); }
    for (const t of tags) {
      const { L } = t, pill = P.h('span', 'fv-pill');
      if (L.nDesce) pill.append(P.h('b', 'is-desce', '↓ ' + L.nDesce)); if (L.nSobe) pill.append(P.h('b', 'is-sobe', '↑ ' + L.nSobe));
      pill.title = (L.nDesce ? L.nDesce + ' desceram de ' + t.paiNome + ' para ' + t.filhoNome : '') + (L.nDesce && L.nSobe ? ' · ' : '') + (L.nSobe ? L.nSobe + ' subiram de volta' : '');
      pill.dataset.key = L.key; if (t.espinha) pill.dataset.pai = L.pai; { const pi = M.items.get(L.pai), fi = M.items.get(L.filho); pill.dataset.ladoDesce = pi ? pi.lado : ''; pill.dataset.ladoSobe = t.espinha ? 'misto' : fi ? fi.lado : 'claude'; } mapa.append(pill);
      const w = pill.offsetWidth, h = pill.offsetHeight;
      let x = t.espinha && !t.lado ? t.em[0] : Math.round(t.em[0] - w / 2), y = Math.round(t.em[1] - h / 2);
      x = Math.max(0, Math.min(W - w, x));
      const bate = (xx, yy) => ocupado.some(o => xx < o.r && xx + w > o.l && yy < o.b && yy + h > o.t);
      if (bate(x, y)) { const tent = [[0, -(h + 2)], [w / 2 + 6, 0], [-(w / 2 + 6), 0], [0, -2 * (h + 2)], [w + 8, 0], [-(w + 8), 0], [0, h + 2]]; for (const [dx, dy] of tent) { const nx = Math.max(0, Math.min(W - w, Math.round(x + dx))), ny = Math.round(y + dy); if (!bate(nx, ny)) { x = nx; y = ny; break; } } }
      pill.style.left = x + 'px'; pill.style.top = y + 'px'; ocupado.push({ l: x, t: y, r: x + w, b: y + h });
    }
    desencostar(mapa, R, W, H);
    const nos = cards.map(el => { const it = M.items.get(el.dataset.id); return { id: it.id, el, lado: it.lado, nome: it.nome, estado: it.estado || '', acao: it.acao || null, precisa: !!it.precisa,
      ajTotal: it.tipo === 'sessao' || it.tipo === 'coord' ? (it.agTotal ?? null) : null, ajAgora: it.tipo === 'sessao' || it.tipo === 'coord' ? (it.agAtivos ?? null) : null, cards: it.tipo === 'voce' ? it.cards : null }; });
    const nomes = {}; for (const it of M.items.values()) nomes[it.id] = it.nome; for (const L of M.links.values()) if (!nomes[L.filho]) nomes[L.filho] = nomeCurto(M, L.filho);
    return { mapa, camada, W, H, fios, nos, nomes };
  }

  // ---------- hover: acende o caminho ate o topo e apaga o resto ----------
  function caminhoAteTopo(M, id) { const s = new Set(); let it = M.items.get(id); while (it) { s.add(it.id); it = it.pai ? M.items.get(it.pai) : null; } return s; }
  function acender(id) {
    const M = ST.M, mapa = M && M.mapa; if (!mapa || !mapa.isConnected) return;
    const alvo = id || ST.sel; ST.hover = id;
    if (!alvo) { mapa.removeAttribute('data-foco'); for (const el of mapa.querySelectorAll('[data-aceso],[data-apagado]')) { el.removeAttribute('data-aceso'); el.removeAttribute('data-apagado'); } return; }
    const ok = caminhoAteTopo(M, alvo); mapa.dataset.foco = '1';
    for (const el of mapa.querySelectorAll('.fv-card')) { const on = ok.has(el.dataset.id); el.toggleAttribute('data-aceso', on); el.toggleAttribute('data-apagado', !on); }
    for (const g of mapa.querySelectorAll('.fv-lig')) { const f = g.dataset.filho, fid = f.startsWith('grp:') && !M.items.has(f) ? f.slice(4) : f; const on = ok.has(g.dataset.pai) && (ok.has(fid) || (f.startsWith('grp:') && [...ok].some(x => (M.items.get(x) || {}).pai === fid && ((M.items.get(x) || {}).tipo === 'ajudante')))); g.toggleAttribute('data-aceso', on); g.toggleAttribute('data-apagado', !on); }
    for (const p of mapa.querySelectorAll('.fv-pill')) { const g = mapa.querySelector('.fv-lig[data-key="' + CSS.escape(p.dataset.key) + '"]'); const on = p.dataset.pai ? ok.has(p.dataset.pai) : g && g.hasAttribute('data-aceso'); p.toggleAttribute('data-aceso', !!on); p.toggleAttribute('data-apagado', !on); }
  }

  // ---------- detalhe (clique): blocos com rotulo, nunca lista crua ----------
  function abrir(id) { ST.sel = ST.sel === id ? null : id; if (ST.P) ST.P.repintar(); }
  function bloco(P, rot, ...kids) { return P.h('section', 'fv-bloco', P.h('h4', 'fv-bloco-t', rot), ...kids); }
  function interrog(P, txt, sol) { return P.h('p', 'fv-q', P.h('b', '', '? '), txt, sol ? P.h('span', 'fv-sol', ' Solução: ' + sol) : null); }
  function duracaoTipica(P, M, it) {
    if (it.tipo === 'ajudante') {
      const t = it.agente && it.agente.tipo, d = ST.ag && ST.ag.duracao && t ? ST.ag.duracao[t] : null;
      if (!ST.ag) return { txt: null, q: interrog(P, 'Duração típica sem leitura.', 'o painel lê os agentes de novo sozinho a cada 30 s.') };
      if (!t) return { txt: null, q: interrog(P, 'Sem o tipo do ajudante na fonte, não dá para comparar.', 'o tipo aparece quando a sessão registrar o ajudante com tipo.') };
      if (!d || !d.n) return { txt: null, q: interrog(P, 'Nenhum ' + tipoH(t).toLowerCase() + ' terminou ainda nas conversas lidas.', 'o número aparece sozinho quando o primeiro terminar.') };
      return { txt: 'Costuma levar ' + minTxt(d.medianaMin) + ' (mediana de ' + d.n + ' ' + (d.n === 1 ? 'que já terminou' : tipoPlural(t) + ' que já terminaram') + ', n=' + d.n + ')' };
    }
    if (it.tipo === 'codex') {
      const s = P.f2 && Array.isArray(P.f2.sessoes) ? P.f2.sessoes.find(x => x.sessao === it.sessao) : null;
      const durs = s && Array.isArray(s.codex) ? s.codex.filter(c => c.estado === 'terminou' && Number.isFinite(c.idadeMin) && Number.isFinite(c.fimIdadeMin)).map(c => c.idadeMin - c.fimIdadeMin) : [];
      if (!durs.length) return { txt: null, q: interrog(P, 'Nenhuma rodada do Codex desta sessão terminou nas últimas 24 h.', 'o número aparece sozinho quando a primeira terminar.') };
      return { txt: 'Rodadas do Codex da ' + nomeCurto(M, it.pai) + ' costumam levar ' + minTxt(mediana(durs)) + ' (mediana de 24 h, n=' + durs.length + ')' };
    }
    return null;
  }
  function detalhe(P, M) {
    const it = ST.sel ? M.items.get(ST.sel) : null; if (!it) { ST.sel = null; return null; }
    const fechar = P.h('button', 'g-btn is-quieto fv-fechar', 'Fechar'); fechar.type = 'button'; fechar.addEventListener('click', () => { ST.sel = null; P.repintar(); });
    const face = it.tipo === 'voce' ? P.icon('diamante', P.css('--g-rosa')) : P.identicon(it.tipo === 'ajudante' ? (it.agente && it.agente.tipo || 'aj') + it.id.slice(-4) : it.id, P.sideColor(it.lado === 'codex' ? 'codex' : 'claude'), 4);
    const det = P.h('aside', 'fv-det', P.h('div', 'fv-det-cab', P.h('span', 'g-no-face', face), P.h('div', 'fv-det-tit', P.h('h3', 'fv-det-nome', it.nome), P.h('p', 'fv-frase', it.frase)), fechar));
    det.dataset.lado = it.lado; det.setAttribute('aria-label', 'Detalhe de ' + it.nome);
    { const pls = linhasPartes(P.h, it, 'fv'), fr = det.querySelector('.fv-frase'); if (pls && pls.length && fr) { fr.replaceChildren(...pls); fr.classList.add('is-partes'); } }
    // na cadeia
    const cam = [...caminhoAteTopo(M, it.id)].reverse();
    const migalha = P.h('p', 'fv-migalha'); cam.forEach((id, i) => { if (i) migalha.append(P.h('span', 'fv-seta', ' → ')); migalha.append(P.h('b', '', nomeCurto(M, id))); });
    det.append(bloco(P, 'Na hierarquia', migalha, it.ponta ? P.h('p', 'fv-txt', 'É a ponta da cadeia agora: ' + (PONTA_T[it.ponta] || '').replace(/^Ponta · /, '') + '.') : null));
    // mensagens
    if (it.tipo !== 'ajudante') {
      const de = new Map(), para = new Map();
      for (const L of M.links.values()) {
        const ehFilho = L.filho === it.id || (L.filho === 'grp:' + it.pai && it.tipo === 'grupo'), ehPai = L.pai === it.id;
        if (ehFilho) { for (const l of L.desce) de.set(nomeCurto(M, L.pai), (de.get(nomeCurto(M, L.pai)) || 0) + l.count); for (const l of L.sobe) para.set(nomeCurto(M, L.pai), (para.get(nomeCurto(M, L.pai)) || 0) + l.count); }
        if (ehPai) { for (const l of L.desce) para.set(nomeCurto(M, L.filho), (para.get(nomeCurto(M, L.filho)) || 0) + l.count); for (const l of L.sobe) de.set(nomeCurto(M, L.filho), (de.get(nomeCurto(M, L.filho)) || 0) + l.count); }
      }
      const linhaMsg = (rot, mapa, total) => P.h('div', 'fv-msg', P.h('span', 'fv-msg-n', String(total)), P.h('span', 'fv-msg-t', rot + (mapa.size ? ' · ' + [...mapa].map(([n, c]) => n + ' ' + c).join(' · ') : '')));
      det.append(bloco(P, 'Mensagens nas últimas 2 h', linhaMsg('Recebe', de, it.recebe || 0), linhaMsg('Envia', para, it.envia || 0)));
    }
    // agentes em uso
    if (it.tipo === 'sessao' || it.tipo === 'coord') {
      const fs = it.filhos.map(f => M.items.get(f)).filter(x => x && (x.tipo === 'ajudante' || x.tipo === 'codex' || x.tipo === 'grupo'));
      const ul = P.h('ul', 'fv-lista'); for (const x of fs) { const b = P.h('button', 'fv-item', P.h('span', 'fv-item-t', x.nome), P.h('span', 'fv-item-s', x.frase)); b.type = 'button'; b.dataset.estado = x.estado || ''; b.addEventListener('click', () => abrir(x.id)); ul.append(P.h('li', '', b)); }
      // as rodadas do Codex rodando que o mapa nao desenha (o mapa mostra ate 3 por sessao) entram na lista, sem cartao proprio
      const semCartao = (it.cxVivos || []).filter(c => !c.proprio);
      for (const x of semCartao) { const s = P.h('span', 'fv-item is-sem-cartao', P.h('span', 'fv-item-t', x.texto), P.h('span', 'fv-item-s', x.titulo)); s.dataset.estado = 'trabalhando'; ul.append(P.h('li', '', s)); }
      const n = (it.agAtivos || 0) + (it.cxAtivos || 0);
      det.append(bloco(P, 'Agentes em uso agora', P.h('p', 'fv-txt', it.agLido === false ? 'Ajudantes: ? (a conversa desta sessão não foi lida). Solução: o painel tenta de novo a cada 30 s; se seguir, abra a sessão no app.' : n === 0 ? 'Nenhum agora.' : [it.agAtivos ? it.agAtivos + (it.agAtivos === 1 ? ' ajudante' : ' ajudantes') : null, it.cxAtivos ? it.cxAtivos + ' Codex' : null].filter(Boolean).join(' e ') + ' trabalhando.'), fs.length || semCartao.length ? ul : P.h('p', 'fv-txt is-sec', 'Nenhum ajudante nem Codex nas últimas 2 h.')));
    }
    if (it.tipo === 'voce') {
      const btn = P.h('button', 'g-btn fv-cards-btn', 'Abrir os cards'); btn.type = 'button'; btn.addEventListener('click', () => P.abrirDecidir());
      det.append(bloco(P, 'Espera você', P.h('p', 'fv-txt', it.cards === null ? 'Cards: ? (a leitura do Agora não chegou).' : it.cards === 0 ? 'Nada espera você.' : it.cards + (it.cards === 1 ? ' card espera' : ' cards esperam') + ' a sua escolha.'), it.cards ? btn : null));
    }
    // ajudante: tarefa, tempo, ferramentas, memorias
    if (it.tipo === 'ajudante' || it.tipo === 'codex') {
      const a = it.agente || {}, c = it.f2 || {};
      if (it.tipo === 'ajudante') det.append(bloco(P, 'Tarefa', P.h('p', 'fv-txt', a.reservado ? (a.soDono && a.soDono.oque ? a.soDono.oque + ' (assunto reservado: aberto só neste PC)' : 'Assunto reservado (só no chat).') : a.oque || 'Sem descrição na fonte.'), it.projeto ? P.h('p', 'fv-txt is-sec', 'Projeto: ' + projNome(it.projeto) + ' · no PC') : null, P.h('p', 'fv-txt is-sec', tipoH(a.tipo) + ' · recebeu a tarefa da ' + nomeCurto(M, it.pai) + (a.terminou ? ' · já entregou' : ' · ainda não entregou'))));
      else det.append(bloco(P, 'Rodada do Codex', P.h('p', 'fv-txt', it.nome), c.resumo ? P.h('p', 'fv-txt is-sec', P.frase(c.resumo)) : c.soDono && c.soDono.resumo ? P.h('p', 'fv-txt is-sec', P.frase(c.soDono.resumo) + ' (aberto só neste PC)') : null, it.projeto ? P.h('p', 'fv-txt is-sec', 'Projeto: ' + projNome(it.projeto) + ' · ' + (c.onde === 'vps' ? 'na VPS' : 'no PC')) : null));
      const dur = duracaoTipica(P, M, it), tempo = P.h('div', 'fv-tempo');
      const agoraTxt = it.tipo === 'ajudante' ? (a.ativo ? 'Rodando há ' + P.haMin(minDesde(a.inicio), '') : 'Durou ' + (Number.isFinite(a.duracaoMin) ? minTxt(a.duracaoMin).replace('~', '') : '?') + (a.terminou ? ' e entregou ' + P.haMin(minDesde(a.ultimaEm)) : ''))
        : (c.estado === 'rodando' ? 'Rodando há ' + P.haMin(c.idadeMin, '') : c.estado === 'terminou' && Number.isFinite(c.fimIdadeMin) ? 'Durou ' + minTxt(c.idadeMin - c.fimIdadeMin).replace('~', '') + ' e terminou ' + P.haMin(c.fimIdadeMin) : 'Estado: ' + (c.estadoTexto || c.estado || '?'));
      tempo.append(P.h('p', 'fv-txt', agoraTxt)); if (dur && dur.txt) tempo.append(P.h('p', 'fv-txt is-sec', dur.txt)); if (dur && dur.q) tempo.append(dur.q);
      det.append(bloco(P, 'Quanto tempo', tempo));
      if (it.tipo === 'ajudante') {
        const fr = a.ferramentas;
        if (!Array.isArray(fr)) det.append(bloco(P, 'Ferramentas nas últimas 2 h', interrog(P, 'A contagem de ferramentas não veio.', 'a leitura dos agentes volta sozinha a cada 30 s; se seguir, reinicie o painel.')));
        else if (!fr.length) det.append(bloco(P, 'Ferramentas nas últimas 2 h', P.h('p', 'fv-txt is-sec', 'Nenhuma chamada na janela.')));
        else {
          const max = Math.max(...fr.map(f => f.n)), juntas = new Map();
          for (const f of fr) { const [nome, cru] = ferrH(f.nome); const o = juntas.get(nome) || { nome, crus: [], n: 0 }; o.n += f.n; if (cru && !o.crus.includes(cru)) o.crus.push(cru); juntas.set(nome, o); }
          const arr = [...juntas.values()].sort((x, y) => y.n - x.n), top = arr.slice(0, 6), maxJ = Math.max(...arr.map(x => x.n), max);
          const barras = P.h('div', 'fv-barras');
          for (const f of top) { const bar = P.h('span', 'fv-barra'); bar.style.setProperty('--fv-w', Math.max(4, Math.round(f.n / maxJ * 100)) + '%'); barras.append(P.h('div', 'fv-barra-l', P.h('span', 'fv-barra-n', f.nome, f.crus.length ? P.h('small', '', ' ' + f.crus.join(' e ')) : null), bar, P.h('span', 'fv-barra-c', String(f.n)))); }
          const resto = arr.slice(6).reduce((s, f) => s + f.n, 0);
          det.append(bloco(P, 'Ferramentas nas últimas 2 h', barras, resto ? P.h('p', 'fv-txt is-sec', 'e mais ' + resto + ' em ' + (arr.length - 6) + ' outras') : null, P.h('p', 'fv-txt is-sec', 'Total: ' + fr.reduce((s, f) => s + f.n, 0) + ' chamadas')));
        }
        const mem = a.memorias, memRes = a.memoriasReservadas;
        if (!Array.isArray(mem)) det.append(bloco(P, 'Memórias que puxou', interrog(P, 'A leitura das memórias não veio.', 'a leitura dos agentes volta sozinha a cada 30 s.')));
        else if (!mem.length && !memRes) det.append(bloco(P, 'Memórias que puxou', P.h('p', 'fv-txt is-sec', 'Nenhuma memória lida na janela.')));
        else { const chips = P.h('div', 'fv-chips'); for (const m of mem) chips.append(P.h('span', 'fv-chip', acento(memH(m)))); if (memRes) chips.append(P.h('span', 'fv-chip is-res', memRes === 1 ? '1 reservada' : memRes + ' reservadas')); det.append(bloco(P, 'Memórias que puxou', chips)); }
      } else {
        det.append(bloco(P, 'Ferramentas', interrog(P, 'A leitura do Codex ainda não conta ferramentas.', 'ensinar a leitura das rodadas do Codex a contar as chamadas de cada uma (fatia própria).')));
        det.append(bloco(P, 'Memórias que puxou', interrog(P, 'A leitura do Codex não traz memórias.', 'a mesma leitura passa a anotar as memórias que cada rodada abriu.')));
      }
    }
    return det;
  }

  // ---------- cabecalho comum: titulo, resumo, cadeias e legenda ----------
  function cabecalho(P, M) {
    const hm = iso => { const t = Date.parse(iso || ''); if (!Number.isFinite(t)) return '?'; const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
    const lei = P.lei, jan = lei ? 'De ' + hm(lei.desde) + ' a ' + hm(lei.ate) + ' · lido ' + (Number.isFinite(lei.idadeMin) ? P.haMin(lei.idadeMin) : '?') : 'Últimas 2 h';
    const cab = P.h('div', 'fv-cab', P.h('div', 'fv-cab-t', P.h('h2', 'g-h', 'Quem manda em quem'), P.h('p', 'g-sec', 'Comando desce, resposta sobe. ' + jan + '.')));
    if (!M) return [cab];
    const r = M.resumo, num = (rot, v, sub, cls) => P.h('div', 'fv-num ' + (cls || ''), P.h('span', 'fv-num-v', v === null || v === undefined ? '?' : String(v)), P.h('span', 'fv-num-r', rot), sub ? P.h('span', 'fv-num-s', sub) : null);
    // "Ajudantes agora" e "Codex rodando" abrem a lista de quem e (mouse em cima, clique, toque ou Enter); a lista sobrevive a releitura
    const numLista = (chave, rot, v, sub, cls, titulo, grupos, semLeitura) => {
      const el = num(rot, v, sub, cls), lista = P.h('div', 'fv-num-lista');
      el.classList.add('tem-lista'); el.dataset.lista = chave; lista.id = 'fv-lista-' + chave;
      el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); el.setAttribute('aria-controls', lista.id); el.setAttribute('aria-label', rot + ': ' + (v === null || v === undefined ? '?' : v) + '. Abre a lista de quem é');
      lista.append(P.h('p', 'fv-num-lista-t', titulo));
      if (semLeitura) lista.append(interrog(P, semLeitura[0], semLeitura[1]));
      if (!grupos.length && !semLeitura) lista.append(P.h('p', 'fv-txt is-sec', 'Nenhum agora.'));
      for (const g of grupos) lista.append(P.h('div', 'fv-num-lista-g', P.h('b', 'fv-num-lista-n', g.nome + ' · ' + g.itens.length), chipsDe(P, g.itens, 0, g.id)));
      if (grupos.length) lista.append(P.h('p', 'fv-txt is-sec fv-num-lista-dica', 'Clique num nome para o detalhe.'));
      el.append(lista);
      return el;
    };
    const nAj = numLista('ajudantes', 'Ajudantes agora', r.ajudantes, r.porSessao.length ? r.porSessao.join(' · ') : r.ajudantes === null ? 'leitura: ?' : 'nenhum agora', r.ajudantes ? 'is-anda' : '', 'Ajudantes trabalhando agora', r.ajLista,
      r.ajudantes === null ? ['Ajudantes: ? (a conversa de uma sessão não foi lida).', 'o painel tenta de novo a cada 30 s; se seguir, abra a sessão no app.'] : null);
    const nCx = numLista('codex', 'Codex rodando', r.codex, r.cxPorSessao.length ? r.cxPorSessao.join(' · ') : r.codex === null ? 'leitura: ?' : 'nenhum agora', r.codex ? 'is-codex' : '', 'Codex rodando agora', r.cxLista,
      r.codex === null ? ['Codex: ? (a leitura das rodadas do Codex não chegou).', 'o painel relê sozinho a cada minuto; se seguir, reinicie o painel.'] : null);
    const res = P.h('div', 'fv-resumo',
      num('Espera você', r.cards, r.cards ? (r.cards === 1 ? 'card para escolher' : 'cards para escolher') : r.cards === 0 ? 'nada agora' : null, r.cards ? 'is-rosa' : ''),
      nAj, nCx,
      num('Sessões trabalhando', r.sessoes, 'de ' + r.sessoesTotal));
    const sinc = () => { for (const o of [nAj, nCx]) { const on = ST.lista === o.dataset.lista; o.setAttribute('aria-expanded', String(on)); if (on) o.dataset.aberto = '1'; else delete o.dataset.aberto; } };
    for (const o of [nAj, nCx]) {
      const k = o.dataset.lista, alternar = () => { if (ST.lista === k && ST.listaFixa) { ST.lista = null; ST.listaFixa = false; } else { ST.lista = k; ST.listaFixa = true; } sinc(); };
      o.addEventListener('click', e => { if (e && e.target && e.target !== o && e.target.closest && e.target.closest('.fv-num-lista')) return; alternar(); });
      o.addEventListener('keydown', e => { if (e.target !== o) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(); } else if (e.key === 'Escape' && ST.lista) { e.stopPropagation(); ST.lista = null; ST.listaFixa = false; sinc(); } });
      o.addEventListener('pointerenter', e => { if (!e || e.pointerType !== 'mouse' || ST.lista === k) return; if (!ST.listaFixa || ST.lista === null) { ST.lista = k; ST.listaFixa = false; sinc(); } });
      o.addEventListener('pointerleave', e => { if (!e || e.pointerType !== 'mouse') return; if (ST.lista === k && !ST.listaFixa) { ST.lista = null; sinc(); } });
    }
    sinc();
    // cadeias: quem escorre para quem e onde para
    const cad = P.h('section', 'fv-cadeias', P.h('h3', 'fv-bloco-t', 'Quem escorre para quem'));
    const vis = M.cadeias.slice(0, estreito() ? 3 : 4);
    if (!vis.length) cad.append(P.h('p', 'fv-txt is-sec', 'Nenhum comando desceu nas últimas 2 h.'));
    const jaChips = new Set();
    for (const c of vis) {
      const li = P.h('div', 'fv-cadeia'); li.dataset.estado = c.estado;
      c.ids.forEach((id, i) => { if (i) li.append(P.h('span', 'fv-seta', '→')); const b = P.h('button', 'fv-elo' + (i === c.ids.length - 1 ? ' is-ponta' : ''), nomeCurto(M, id)); b.type = 'button'; const alvo = id.startsWith('grp:') && !M.items.has(id) ? id.slice(4) : id; b.addEventListener('click', () => abrir(alvo)); b.addEventListener('mouseenter', () => acender(alvo)); b.addEventListener('mouseleave', () => acender(null)); li.append(b); });
      li.append(P.h('span', 'fv-selo is-ponta is-' + c.estado, (PONTA_T[c.estado] || 'Ponta').replace('Ponta · ', 'para aqui · ')));
      // logo abaixo, quem trabalha agora nessa sessao (um chip por ajudante, ate 4 e "+N"; o Codex rodando dela)
      li.dataset.sessao = c.sessaoId || '';
      // duas cadeias da mesma sessao (ex.: Claude e Claude → ajudante) mostram os chips so na primeira, sem repetir
      if ((c.ajudantes.length || c.codex.length) && !(c.sessaoId && jaChips.has(c.sessaoId))) {
        if (c.sessaoId) jaChips.add(c.sessaoId);
        const ajs = P.h('div', 'fv-cad-ajs');
        if (c.ajudantes.length) ajs.append(P.h('span', 'fv-cad-rot', c.ajudantes.length === 1 ? '1 ajudante agora:' : c.ajudantes.length + ' ajudantes agora:'), chipsDe(P, c.ajudantes, 4, c.sessaoId));
        if (c.codex.length) ajs.append(P.h('span', 'fv-cad-rot is-codex', c.codex.length === 1 ? '1 Codex rodando:' : c.codex.length + ' Codex rodando:'), chipsDe(P, c.codex, 4, c.sessaoId));
        li.append(ajs);
      }
      cad.append(li);
    }
    if (M.cadeias.length > vis.length) cad.append(P.h('p', 'fv-txt is-sec', '+ ' + (M.cadeias.length - vis.length) + ' cadeias paradas (abra o cartão para ver)'));
    const amostra = kind => { const sv = doc.createElementNS(SVGNS, 'svg'); sv.setAttribute('width', '32'); sv.setAttribute('height', '8'); sv.setAttribute('class', 'g-amostra'); sv.setAttribute('aria-hidden', 'true'); const g = doc.createElementNS(SVGNS, 'g'); g.setAttribute('class', 'g-fio'); g.dataset.idade = 'quente'; const l = doc.createElementNS(SVGNS, 'line'); l.setAttribute('x1', '0'); l.setAttribute('x2', '32'); l.setAttribute('y1', '4.5'); l.setAttribute('y2', '4.5'); l.setAttribute('class', 'g-fio-l k-' + kind); l.setAttribute('shape-rendering', 'crispEdges'); g.append(l); sv.append(g); return sv; };
    const emDemo = /(?:^#|&)demo=eventos\b/.test(root.location.hash || ''), demo = P.h('a', 'g-link g-demo-link', emDemo ? 'Parar demo' : 'Ver todas as animações');
    demo.href = emDemo ? '#g=equipe.fluxo' : '#g=equipe.fluxo&demo=eventos'; demo.title = 'Demo só visual: toca cada animação em sequência, sem gravar nada'; demo.addEventListener('click', () => setTimeout(() => root.location.reload(), 30));
    const leg = P.h('div', 'fv-legenda', P.h('span', '', P.h('b', 'is-desce', '↓'), ' desce (de cima para baixo)'), P.h('span', '', P.h('b', 'is-sobe', '↑'), ' sobe'), P.h('span', '', P.h('i', 'g-sq is-voce'), 'você'), P.h('span', '', P.h('i', 'g-sq is-claude'), 'Claude'), P.h('span', '', P.h('i', 'g-sq is-codex'), 'Codex'), P.h('span', '', amostra('comando'), 'Comando'), P.h('span', '', amostra('duvida'), 'Dúvida'), P.h('span', '', amostra('resposta'), 'Resposta'), P.h('span', '', P.h('i', 'fv-amostra-pont'), 'sem mensagem em 2 h'), P.h('span', 'fv-leg-dica', estreito() ? 'Toque num cartão para ver o detalhe' : 'Passe o mouse para acender o caminho · clique para o detalhe'), demo);
    const extra = [];
    {
      const ativo = projAtivo(), esc = ST.escopo || 'projeto', box = P.h('div', 'fv-escopo'); box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'O que o Fluxo mostra');
      const op = (k, txt) => { const b = P.h('button', 'fv-escopo-op', txt); b.type = 'button'; b.dataset.escopo = k; const on = ativo === 'todos' ? k === 'geral' : esc === k; b.setAttribute('aria-pressed', String(on));
        if (ativo === 'todos' && k === 'projeto') { b.setAttribute('aria-disabled', 'true'); b.title = 'Escolha um projeto em "Vendo:" na barra de cima'; }
        else b.addEventListener('click', () => { ST.escopo = k; try { root.localStorage.setItem('painel.fluxoEscopo', k); } catch (e) { /* vale ate recarregar */ } P.repintar(); });
        return b; };
      box.append(op('geral', 'Fluxo geral'), op('projeto', 'Só o projeto ativo'), P.h('span', 'g-sec', ativo === 'todos' ? 'Vendo: Todos. Escolha um projeto na barra de cima para separar.' : 'Vendo: ' + projNome(ativo) + (esc === 'geral' ? ' (os outros projetos ficam apagados)' : ' (só as sessões, ajudantes e Codex dele)')));
      extra.push(box);
      if (root.PainelFluxoTela) { const b1 = P.h('a', 'g-btn is-quieto fv-segunda-tela', 'Segunda tela'); b1.href = '#g=equipe.fluxo&tela=cheia'; b1.target = '_blank'; b1.rel = 'noopener'; b1.title = 'Abre o resumo do Fluxo em 1 tela, sem menu, numa janela nova para deixar na segunda tela'; extra.push(b1); }
    }
    if (ST.agFalhou && !ST.ag) extra.push(P.h('p', 'g-sec fv-aviso', 'Ferramentas, memórias e duração: ? (' + ST.agFalhou + '). Solução: o painel tenta de novo a cada 30 s; se seguir, reinicie o painel.'));
    return [cab, res, cad, leg, ...extra];
  }

  const FH = { norte: null, norteEm: 0, nortePed: false, sigN: '', voo: null, vooEm: 0, vooPed: false, sigV: '', aberto: null, pe: null };
  const FH_SUF = (() => { try { return new URLSearchParams(String(root.location.search || '')).get('exemplo') === '1' ? '?exemplo=1' : ''; } catch (e) { return ''; } })();
  const fhNum = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const fhIgual = (a, b) => fhNum(a) !== null && fhNum(a) === fhNum(b);
  const fhChave = s => String(s === null || s === undefined ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  const fhTem = (el, c) => String(el.className || '').split(' ').includes(c);
  const fhSeloTexto = s => { const a = s.querySelector('.fv-selo-a'), b = s.querySelector('.fv-selo-b'); return a && b ? String(a.textContent).trim() + ', ' + String(b.textContent).trim() : String(s.textContent).replace(/\s+/g, ' ').trim(); };
  function fhPedir(P) {
    const agora = Date.now(), ler = (url, pronto) => { let p = null; try { p = P.getJSON(url + FH_SUF, 20000); } catch (e) { p = null; } Promise.resolve(p).then(j => j, () => null).then(pronto); };
    if (!FH.nortePed && (!FH.norteEm || agora - FH.norteEm >= 30000)) {
      FH.nortePed = true;
      ler('/api/pe-equipe/frentes-situacao', j => { FH.nortePed = false; FH.norteEm = Date.now(); const n = j && typeof j === 'object' && Array.isArray(j.frentes) ? j : { ok: false, frentes: [], motivo: 'o painel não respondeu agora', solucao: 'o painel tenta de novo sozinho em 30 s' }, s = JSON.stringify([n.ok, n.motivo || '', n.frentes]); if (s === FH.sigN) return; FH.sigN = s; FH.norte = n; P.repintar(); });
    }
    if (!FH.vooPed && (!FH.vooEm || agora - FH.vooEm >= 30000)) {
      FH.vooPed = true;
      ler('/api/pe-equipe/wen', j => { FH.vooPed = false; FH.vooEm = Date.now(); const v = j && j.voo && typeof j.voo === 'object' && Array.isArray(j.voo.frentes) ? j.voo : { ok: false, frentes: [] }, s = JSON.stringify([v.ok, v.frentes]); if (s === FH.sigV) return; FH.sigV = s; FH.voo = v; P.repintar(); });
    }
  }
  function fhModelo(norte, voo, dono) {
    const MD = root.PainelFluxoTelaModelo || null, ok = !!(MD && norte && norte.ok === true && Array.isArray(norte.frentes));
    if (!ok) return { lido: false, motivo: !MD ? 'o modelo do Norte não carregou' : !norte ? 'as frentes ainda não foram lidas' : String(norte.motivo || 'frentes sem leitura'), solucao: norte && norte.solucao ? String(norte.solucao) : 'o painel lê de novo sozinho em 30 s', sessoes: new Map(), voce: { lido: false, cards: null, respostas: null, semCards: null, itens: [] } };
    const N = MD.norteEmTela(norte.frentes, { max: 0, dono: dono === true, agrupar: false }), vooLido = !!(voo && voo.ok === true && Array.isArray(voo.frentes)), doVoo = new Map(), NOMES = new Map(N.sessoes.map(s => [fhChave(s.chave), s.nome]));
    if (vooLido) {
      const chaves = [...new Set(N.todas.map(l => fhChave(l.sessao)).filter(Boolean))], livre = l => !doVoo.has(l), duas = n => fhChave(n).split(' ').slice(0, 2).join(' ');
      const sessaoDe = f => { const q = (Array.isArray(f.selos) ? f.selos : []).find(x => x && x.tipo === 'claude' && chaves.includes(fhChave(x.texto))); if (q) return fhChave(q.texto); const b = fhChave(f.blocoDe); if (b && chaves.includes(b)) return b; const p = fhChave(f.nome).split(' ')[0]; return p === 'PAINEL' && chaves.includes('COORDENADOR') ? 'COORDENADOR' : chaves.includes(p) ? p : null; };
      for (const f of voo.frentes) {
        if (!f || typeof f !== 'object' || !fhChave(f.nome)) continue;
        const k = fhChave(f.nome); let c = N.todas.filter(l => livre(l) && (fhChave(l.nome) === k || fhChave(l.nomeNeutro) === k));
        if (!c.length) { const s = sessaoDe(f), ds = s ? N.todas.filter(l => livre(l) && fhChave(l.sessao) === s) : []; c = ds.filter(l => fhIgual(l.pct, f.pct) && fhIgual(l.tasks, f.tasks) && fhIgual(l.faltamMin, f.faltamMin)); if (c.length !== 1) { c = ds.filter(l => duas(l.nome) === duas(f.nome)); if (c.length !== 1) c = []; } }
        if (c.length) doVoo.set(c[0], f);
      }
    }
    const vista = l => {
      const w = doVoo.get(l) || null, a = fhNum(l.cardsDele), b = w ? fhNum(w.cardsSeus) : null, chave = fhChave(l.sessao);
      const itens = w && Array.isArray(w.selos) ? w.selos.filter(x => x && typeof x.texto === 'string' && x.texto.trim()).map(x => ({ tipo: x.tipo === 'codex' ? 'codex' : x.tipo === 'claude' ? 'claude' : 'script', texto: x.texto.trim() })) : [];
      const quem = !vooLido ? { lido: false, motivo: 'O WEN de agora não foi lido', itens: [] } : !w ? { lido: false, motivo: 'O WEN de agora não traz esta frente', itens: [] } : typeof w.quem === 'string' && w.quem.trim().startsWith('?') ? { lido: false, motivo: 'O WEN de agora não diz quem trabalha nesta frente', itens: [] } : { lido: true, itens };
      return { nome: (l.pendente || l.semNome) && !l.nomeDoDono && w ? String(w.nome).trim() : l.nome, foco: Number.isInteger(l.foco) ? l.foco : null, focoTexto: l.focoTexto, barra: l.barra, pctTexto: l.pctTexto, faltamTexto: l.faltamTexto, situacao: l.selos.situacao, alta: l.selos.foco || null,
        cards: a === null && b === null ? null : Math.max(a || 0, b || 0), esperaVoce: l.chaveEstado === 'espera-ele', quem, sessao: chave, sessaoNome: NOMES.get(chave) || 'Sem sessão' };
    };
    // "sem prazo" so quando todas as frentes da sessao dizem sem-prazo; faltamMin vazio em frente em dia ou atrasada e prazo nao lido
    const vistas = N.todas.map(vista), sessoes = new Map(), semTodas = ls => ls.length > 0 && ls.every(v => v.situacao && v.situacao.classe === 'sem-prazo');
    // o "maior" vale so para as frentes lidas: frente em dia ou atrasada sem faltamMin entra na conta "N sem leitura"
    const semLer = k => N.todas.filter(l => fhChave(l.sessao) === k && fhNum(l.faltamMin) === null && l.situacao !== 'sem-prazo').reduce((t, l) => t + (l.grupo ? l.n : 1), 0);
    const prazo = (s, ls, sl) => fhNum(s.maiorPrazoMin) !== null ? (sl ? 'maior prazo lido ' + MD.minutos(s.maiorPrazoMin) + ', ' + sl + ' sem leitura' : 'maior prazo ' + MD.minutos(s.maiorPrazoMin)) : semTodas(ls) ? 'sem prazo' : 'prazo sem leitura';
    for (const s of N.sessoes) {
      const ls = vistas.filter(v => v.sessao === fhChave(s.chave)), sl = semLer(fhChave(s.chave)), pz = prazo(s, ls, sl);
      sessoes.set(fhChave(s.chave), { chave: fhChave(s.chave), nome: s.nome, total: s.total, atrasadas: s.atrasadas, prazoTexto: pz, prazoSolucao: / sem leitura$/.test(pz) ? 'Solução: peça ao seu Claude para gravar faltamMin em cada frente de estado/frentes-situacao.json' : null, resumo: s.total + (s.total === 1 ? ' frente, ' : ' frentes, ') + s.atrasadas + (s.atrasadas === 1 ? ' atrasada, ' : ' atrasadas, ') + pz, linhas: ls });
    }
    const com = vistas.filter(v => v.cards > 0), resp = vistas.filter(v => !(v.cards > 0) && v.esperaVoce);
    return { lido: true, motivo: null, solucao: null, sessoes, voce: { lido: true, cards: vistas.length && vistas.every(v => v.cards === null) ? null : com.reduce((s, v) => s + v.cards, 0), respostas: resp.length, semCards: vistas.filter(v => v.cards === null).length, itens: [...com.map(v => Object.assign({ tipo: 'card' }, v)), ...resp.map(v => Object.assign({ tipo: 'resposta' }, v))] } };
  }
  function fhAlternar(chave, ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); FH.aberto = FH.aberto === chave ? null : chave; if (ST.P) ST.P.repintar(); }
  function fhBotao(P, n, dica, chave) {
    const b = P.h('button', 'fv-mais fh-p6-mais', '+ ' + n); b.type = 'button'; b.title = dica; b.setAttribute('aria-expanded', String(FH.aberto === chave));
    b.addEventListener('click', ev => fhAlternar(chave, ev)); b.addEventListener('keydown', ev => { if (ev && ev.stopPropagation) ev.stopPropagation(); });
    return b;
  }
  function fhPop(P, kids) { const pop = P.h('div', 'fh-pop', ...kids); pop.addEventListener('click', ev => { if (ev && ev.stopPropagation) ev.stopPropagation(); }); return pop; }
  function fhChips(P, q) {
    if (!q.lido) return [];
    if (!q.itens.length) { const c = P.h('span', 'fh-chip is-zero', 'ninguém agora'); c.title = 'O WEN de agora diz que ninguém trabalha nesta frente'; return [c]; }
    return q.itens.map(x => { const c = P.h('span', 'fh-chip is-' + x.tipo, x.texto); c.title = (x.tipo === 'codex' ? 'Rodada do Codex' : x.tipo === 'script' ? 'Script, sem IA' : 'Sessão ou ajudante do Claude') + ' nesta frente: ' + x.texto; return c; });
  }
  function fhLinha(P, v) {
    const i = P.h('i', 'fh-bar-i'); i.style.setProperty('--fh-w', (v.barra === null ? 0 : v.barra) + '%');
    const foco = P.h('span', 'fh-foco', v.foco === null ? 'F?' : 'F' + v.foco); if (v.foco !== null) foco.dataset.foco = String(v.foco);
    foco.title = v.foco === null ? 'O foco desta frente não foi lido' : 'Ordem no seu foco: ' + String(v.focoTexto).replace(' · ', ', ');
    const sit = P.h('span', 'fh-sit is-' + v.situacao.classe, v.situacao.texto); if (v.situacao.solucao) sit.title = 'Situação sem leitura. Solução: ' + v.situacao.solucao;
    const card = v.cards > 0 ? P.h('span', 'fh-card', v.cards === 1 ? '1 card seu' : v.cards + ' cards seus') : null; if (card) card.title = 'Esta frente espera a sua escolha em ' + (v.cards === 1 ? '1 card' : v.cards + ' cards');
    const resp = v.esperaVoce ? P.h('span', 'fh-resp', 'espera você') : null; if (resp) resp.title = 'A chave desta frente está desligada, esperando a sua resposta';
    const l = P.h('div', 'fh-l', P.h('span', 'fh-bar' + (v.barra === null ? ' is-sem' : ''), i), P.h('div', 'fh-l-n', foco, P.h('span', 'fh-l-nome', v.nome), P.h('b', 'fh-pct', v.pctTexto)),
      P.h('div', 'fh-l-q', P.h('b', 'fh-falta', v.faltamTexto), card, resp, P.h('span', 'fh-l-quem' + (v.quem.lido && v.quem.itens.length ? '' : ' fh-q-texto'), ...fhChips(P, v.quem))), P.h('div', 'fh-l-s', sit, v.alta ? P.h('span', 'fh-alta', v.alta.texto) : null));
    l.title = 'Frente: ' + v.nome + '. Feito ' + v.pctTexto + ', ' + v.faltamTexto + ', ' + v.situacao.texto + (v.cards === null ? ', cards seus sem leitura' : '') + (v.esperaVoce ? ', espera a sua resposta' : '') + (v.alta ? ', ' + v.alta.texto : '') + '.' + (v.quem.lido && v.quem.itens.length ? ' Quem trabalha: ' + v.quem.itens.map(x => x.texto).join(', ') + '.' : '');
    return l;
  }
  function fhBloco(P, mod, chave, max) {
    const b = P.h('div', 'fh-norte'), S = mod.lido ? mod.sessoes.get(chave) || null : null, k = 'S:' + chave;
    if (!mod.lido) { const q = P.h('div', 'fh-nt is-q', 'frentes: ?'); q.title = 'Frentes desta sessão sem leitura: ' + mod.motivo + '. Solução: ' + mod.solucao; b.append(q); return b; }
    if (!S) { const z = P.h('div', 'fh-nt is-zero', 'nenhuma frente agora'); z.title = 'Nenhuma frente do Norte é desta sessão nesta leitura'; b.append(z); return b; }
    const vis = S.linhas.slice(0, max), resto = S.linhas.slice(max);
    const tira = P.h('div', 'fh-nt', P.h('span', 'fh-nt-n', P.h('b', '', String(S.total)), S.total === 1 ? ' frente' : ' frentes'), P.h('span', 'fh-sit is-' + (S.atrasadas ? 'atrasada' : 'em-dia'), S.atrasadas ? S.atrasadas + (S.atrasadas === 1 ? ' atrasada' : ' atrasadas') : 'nenhuma atrasada'), P.h('span', 'fh-prazo', S.prazoTexto));
    if (S.prazoSolucao) tira.querySelector('.fh-prazo').title = S.prazoSolucao;
    tira.title = 'Norte desta sessão: ' + S.resumo + '. As frentes abaixo seguem a ordem do Norte: atrasadas primeiro, depois o seu foco';
    if (resto.length) tira.append(fhBotao(P, resto.length, 'Mais ' + resto.length + (resto.length === 1 ? ' frente desta sessão' : ' frentes desta sessão') + '. Abre aqui mesmo, na ordem do Norte', k));
    const frentes = P.h('div', 'fh-frentes', ...vis.map(v => fhLinha(P, v))); frentes.dataset.cabe = String(Math.min(3, vis.length));
    b.append(tira, frentes);
    if (resto.length && FH.aberto === k) b.append(fhPop(P, resto.map(v => fhLinha(P, v))));
    return b;
  }
  function fhItemVoce(P, x) {
    const selo = x.tipo === 'card' ? P.h('span', 'fh-card', x.cards === 1 ? '1 card seu' : x.cards + ' cards seus') : P.h('span', 'fh-resp', 'responder');
    const l = P.h('div', 'fh-v-l', P.h('div', 'fh-v-l1', P.h('span', 'fh-v-s', x.sessaoNome), P.h('span', 'fh-v-n', x.nome)), P.h('div', 'fh-v-l2', P.h('span', 'fh-v-p fh-v-pct', x.pctTexto), P.h('span', 'fh-v-p fh-v-f', x.faltamTexto), selo));
    l.title = (x.tipo === 'card' ? 'Card seu preso à frente ' : 'Frente desligada esperando a sua resposta: ') + x.nome + ', da sessão ' + x.sessaoNome + '. Feito ' + x.pctTexto + ', ' + x.faltamTexto + '.';
    return l;
  }
  function fhVoce(P, mod, max) {
    const V = mod.voce, b = P.h('div', 'fh-p6-voce'), nums = P.h('div', 'fh-v-nums');
    const num = (v, um, varios, cls, dica) => { const n = P.h('div', 'fh-v-num ' + cls, P.h('b', '', v === null ? '?' : String(v)), P.h('span', '', v === 1 ? um : varios)); n.title = v !== null ? dica : mod.lido ? dica + ': sem leitura, o Norte não diz quantos cards são seus em nenhuma frente. Solução: peça ao seu Claude para gravar cardsDele em cada frente de estado/frentes-situacao.json' : dica + ': sem leitura, ' + mod.motivo + '. Solução: ' + mod.solucao; return n; };
    const nCards = V.lido && V.cards === null ? [] : [num(V.cards, 'card seu preso a uma frente', 'cards seus presos a frentes', 'is-card', 'Cards que esperam a sua escolha e estão presos a uma frente do Norte')];
    nums.append(...nCards, num(V.respostas, 'frente desligada espera a sua resposta', 'frentes desligadas esperam a sua resposta', 'is-resp', 'Frentes com a chave desligada, esperando a sua resposta'));
    if (V.lido && V.semCards) { const q = P.h('span', 'fh-v-q', V.semCards + (V.semCards === 1 ? ' frente sem contagem de cards' : ' frentes sem contagem de cards')); q.title = 'O Norte não diz quantos cards são seus nessas frentes. Solução: peça ao seu Claude para gravar cardsDele em cada frente de estado/frentes-situacao.json'; nums.append(q); }
    b.append(nums);
    const teto = max === 1 || max === 2 ? max : 3, vis = V.itens.slice(0, teto), resto = V.itens.slice(teto);
    if (vis.length) { const lista = P.h('div', 'fh-v-lista', ...vis.map(x => fhItemVoce(P, x))); lista.dataset.cabe = String(Math.min(teto, vis.length)); b.append(lista); }
    if (resto.length) b.append(fhBotao(P, resto.length, 'Mais ' + resto.length + (resto.length === 1 ? ' frente esperando você' : ' frentes esperando você') + '. Abre aqui mesmo', 'V'));
    if (resto.length && FH.aberto === 'V') b.append(fhPop(P, resto.map(x => fhItemVoce(P, x))));
    return b;
  }
  function fhPilhas(P, M, mapa) {
    for (const pl of [...mapa.querySelectorAll('.fv-pilha')]) {
      const p = M.items.get(pl.dataset.pai); if (!p) continue;
      const fs = p.filhos.map(f => M.items.get(f)).filter(x => x && x.nivel > p.nivel && (x.tipo === 'ajudante' || x.tipo === 'codex' || x.tipo === 'grupo')), k = 'P:' + p.id;
      const cartoes = [...pl.querySelectorAll('.fv-card')], fica = Math.min(2, cartoes.length), fora = fs.slice(fica);
      for (const el of cartoes.slice(fica)) el.remove(); for (const velho of [...pl.querySelectorAll('.fv-mais')]) velho.remove();
      const emLinha = !!(pl.closest && pl.closest('.fv-n2'));
      fs.slice(0, fica).forEach(x => {
        if (!x.el) return;
        const est = x.partes && x.partes.estado ? String(x.partes.estado).trim() : '', frase = String(x.frase || '').replace(/\s+·\s+/g, ', ');
        const selos = [...x.el.querySelectorAll('.fv-selo')].map(fhSeloTexto).filter(Boolean);
        x.el.title = x.nome + '. ' + frase + (est && !frase.includes(est) ? '. ' + est : '') + (selos.length ? '. Selos: ' + selos.join(', ') : '');
        if (!emLinha) return;
        const nome = x.el.querySelector('.fv-nome'), m = /há\s.+$/.exec(est); if (!nome || !(m || est)) return; const t = P.h('span', 'fh-aj-t', m ? m[0] : est); t.title = x.el.title; nome.append(t);
      });
      if (!fora.length) continue;
      const vivos = fora.filter(x => x.work).length;
      pl.append(fhBotao(P, fora.length, 'Mais ' + fora.length + (fora.length === 1 ? ' ajudante ou rodada do Codex' : ' ajudantes e rodadas do Codex') + ' de ' + p.nome + ' nas últimas 2 h, ' + (vivos ? vivos + ' trabalhando agora' : 'nenhum trabalhando agora') + '. Abre a lista aqui mesmo', k));
      if (FH.aberto !== k) continue;
      pl.append(fhPop(P, fora.map(x => { const b = P.h('button', 'fh-p6-item', P.h('span', 'fh-p6-item-n', x.nome), P.h('span', 'fh-p6-item-e', x.partes && x.partes.estado ? x.partes.estado : x.frase)); b.type = 'button'; b.dataset.estado = x.estado || ''; b.dataset.lado = x.lado || 'claude'; b.title = 'Abre o detalhe de ' + x.nome; b.addEventListener('click', ev => { if (ev && ev.stopPropagation) ev.stopPropagation(); FH.aberto = null; abrir(x.id); }); return b; })));
      for (let n = pl; n && n !== mapa; n = n.parentNode) n.classList.add('fh-aberto');
    }
  }
  function fhMontar(P, M, mapa, modo) {
    const mod = fhModelo(FH.norte, FH.voo, html.classList.contains('fz-dono')), larga = modo !== 'c', marca = el => { for (let n = el; n && n !== mapa; n = n.parentNode) n.classList.add('fh-aberto'); };
    mapa.dataset.fh = larga ? 'a' : 'c'; html.dataset.fh = larga ? 'a' : 'c';
    for (const it of [M.cC, ...M.sessoes]) {
      const chave = !it || !it.el ? null : it === M.cC ? 'COORDENADOR' : it.sessao; if (!chave) continue;
      it.el.append(fhBloco(P, mod, chave, 3)); if (FH.aberto === 'S:' + chave) marca(it.el);
    }
    if (M.voce && M.voce.el) { M.voce.el.append(fhVoce(P, mod)); if (FH.aberto === 'V') marca(M.voce.el); }
    if (!larga) return;
    { const n2 = mapa.querySelector('.fv-n2'); if (n2 && n2.style && M.sessoes.length > 5) n2.style.setProperty('--fv-n', String(M.sessoes.length)); }
    for (const it of [M.voce, M.cC, M.cX, ...M.sessoes]) {
      if (!it || !it.el) continue;
      const meta = it.el.querySelector('.fv-meta'), nome = it.el.querySelector('.fv-nome'), est = it.el.querySelector('.fv-estado');
      if (est && it.partes && it.partes.estado) est.title = it.nome + ' agora: ' + it.partes.estado;
      if (!meta || !nome) continue;
      for (const s of [...meta.querySelectorAll('.fv-selo')]) { const desce = fhTem(s, 'is-recebe'); if (!desce && !fhTem(s, 'is-envia')) continue; if (!s.title) s.title = it.nome + (desce ? ' recebe ' : ' envia ') + String(s.textContent).replace(/[^0-9]/g, '') + ' nesta leitura'; s.textContent = (desce ? '↓ ' : '↑ ') + String(s.textContent).replace(/[^0-9]/g, ''); }
      if (it !== M.voce) nome.append(meta);
      if (it !== M.voce) for (const s of [...meta.querySelectorAll('.fv-selo')]) { const b = s.querySelector('.fv-selo-b'), fim = b ? String(b.textContent).trim() : ''; if (fim && !String(s.title || '').includes(fim)) s.title = fhSeloTexto(s) + (s.title ? '. ' + s.title : ''); }
    }
    fhPilhas(P, M, mapa);
  }
  const fhEntra = (col, b, xc, yc, xe) => (col && b.l > col.l + 11 ? [[xc, Math.round(b.cy)], [Math.round(b.l - 4), Math.round(b.cy)]] : [[xc, yc], [xe, yc], [xe, Math.round(b.t - 4)]]);
  function fhCaminho(L, M, rects, a, rFace, modo) {
    if (modo === 'c' || estreito()) return undefined;
    const pai = M.items.get(L.pai), it = M.items.get(L.filho), R = v => Math.round(v);
    if (L.estilo === 'espinha' && pai && pai.tipo !== 'coord') {
      const alvos = (L.filho.startsWith('grp:') && !M.items.has(L.filho) ? pai.filhos.map(f => M.items.get(f)).filter(x => x && (x.tipo === 'ajudante' || x.tipo === 'grupo')) : it ? [it] : []).filter(x => rects.has(x.id)).map(x => rects.get(x.id));
      if (!alvos.length) return null;
      if (pai.tipo === 'voce' && alvos.length === 1) {
        const b = alvos[0], tS = M.sessoes.map(s => rects.get(s.id)).filter(Boolean), topS = tS.length ? Math.min(...tS.map(r => r.t)) : null;
        if (topS === null || b.b < topS + 1) { const x = R(Math.max(a.l + 8, Math.min(b.cx, a.r - 8))); return { pts: [[x, R(a.b + 4)], [x, R(b.t - 4)]], tagEm: [x + 16, R((a.b + b.t) / 2)] }; }
        if (b.t > topS + 20) {
          const meio = [...rects.values()].filter(r => r.t > a.b - 1 && r.b < topS + 1), xg = R(a.l + 3), yb = R((meio.length ? Math.max(...meio.map(r => r.b)) : a.b) + 9), col = tS.find(r => b.cx > r.l - 1 && b.cx < r.r + 1), xc = R((col ? col.l : b.l) - 7), yc = R(b.t - 8), xe = R(Math.min(b.l + 14, b.r - 8));
          return { pts: [[xg, R(a.b + 4)], [xg, yb], [xc, yb], ...fhEntra(col, b, xc, yc, xe)], tagEm: [xc, R(yb + 12)] };
        }
      }
      if (alvos.some(r => r.t < a.b + 12)) return undefined;
      if (alvos.every(r => r.l > a.l + 11)) { const xt = R(a.l + 6), ult = alvos.reduce((m, r) => (r.t > m.t ? r : m), alvos[0]); return { pts: [[xt, R(a.b + 4)], [xt, R(ult.cy)], [R(ult.l - 4), R(ult.cy)]], stubs: alvos.filter(r => r !== ult).map(r => [[xt, R(r.cy)], [R(r.l - 4), R(r.cy)]]), tagEm: [xt + 12, R(a.b + 12)], espinha: true }; }
      const fa = rFace(L.pai) || a, sx = R(fa.cx), yb = R(Math.min(...alvos.map(r => r.t)) - 8), xs = alvos.map(r => R(Math.max(r.l + 14, Math.min(sx, r.r - 8)))), u = xs.reduce((m, x, i) => (Math.abs(x - sx) > Math.abs(xs[m] - sx) ? i : m), 0);
      return { pts: [[sx, R(a.b + 4)], [sx, yb], [xs[u], yb], [xs[u], R(alvos[u].t - 4)]], stubs: xs.map((x, i) => (i === u ? null : (x - sx) * (xs[u] - sx) >= 0 ? [[x, yb], [x, R(alvos[i].t - 4)]] : [[sx, yb], [x, yb], [x, R(alvos[i].t - 4)]])).filter(Boolean), tagEm: [sx + 12, R(a.b + 12)], espinha: true };
    }
    const b = rects.get(L.filho); if (!b || !pai) return undefined;
    if (L.estilo === 'atalho' && pai.tipo === 'voce' && b.t > a.b + 40) {
      const irmaos = [...M.links.values()].filter(x => x.estilo === 'atalho' && x.pai === L.pai && rects.has(x.filho)).sort((x, y) => rects.get(x.filho).cx - rects.get(y.filho).cx), i = Math.max(0, irmaos.indexOf(L));
      const tS = M.sessoes.map(s => rects.get(s.id)).filter(Boolean), topS = tS.length ? Math.min(...tS.map(r => r.t)) : b.t;
      const meio = [...rects.values()].filter(r => r.t > a.b - 1 && r.b < Math.min(b.t, topS) + 1), xg = R(a.l + 6 + i * 5), yb = R((meio.length ? Math.max(...meio.map(r => r.b)) : a.b) + 6), xb = R(b.cx + (L.porta || 0));
      if (b.t > topS + 20) { const col = tS.find(r => b.cx > r.l - 1 && b.cx < r.r + 1), xc = R((col ? col.l : b.l) - 7), yc = R(b.t - 8), xe = R(Math.min(b.l + 14, b.r - 8)); return { pts: [[xg, R(a.b + 4)], [xg, yb], [xc, yb], ...fhEntra(col, b, xc, yc, xe)], tagEm: [xc, R(yb + 14)] }; }
      return { pts: [[xg, R(a.b + 4)], [xg, yb], [xb, yb], [xb, R(b.t - 4)]], tagEm: [xb, R(b.t - 16)] };
    }
    if (L.estilo === 'lado' && pai.tipo === 'sessao' && Math.abs(a.t - b.t) < 4) {
      const esq = a.cx < b.cx, xa = R(a.cx + (esq ? 34 : -34)), xb = R(b.cx + (esq ? -34 : 34)), y = R(Math.min(a.t, b.t) - 7);
      return { pts: [[xa, R(a.t - 4)], [xa, y], [xb, y], [xb, R(b.t - 4)]], tagEm: [R((xa + xb) / 2), y - 9] };
    }
    if (pai.tipo === 'coord' && M.cX && L.pai === M.cX.id && L.estilo !== 'atalho' && b.t > a.b + 8 && b.cx > a.l + 8 && b.cx < a.r - 8) { const x = R(b.cx); return { pts: [[x, R(a.b + 4)], [x, R(b.t - 4)]], tagEm: [x + 16, R((a.b + b.t) / 2)] }; }
    return undefined;
  }
  function fhVoceAjusta(P, M) {
    const el = M && M.voce ? M.voce.el : null, b = el ? el.querySelector('.fh-p6-voce') : null;
    if (!b) return false;
    let mudou = false;
    for (let cabe = b.querySelectorAll('.fh-v-lista .fh-v-l2').length; cabe > 1; cabe--) {
      const ls = [...b.querySelectorAll('.fh-v-lista .fh-v-l2')];
      const aperta = ls.some(l => { const f = l.querySelector('.fh-v-f'); return l.clientWidth > 0 && (l.scrollWidth > l.clientWidth + 1 || (!!f && f.scrollWidth > f.clientWidth + 1)); });
      if (!aperta) break;
      const novo = fhVoce(P, fhModelo(FH.norte, FH.voo, html.classList.contains('fz-dono')), cabe - 1);
      b.replaceChildren(...Array.from(novo.childNodes)); mudou = true;
    }
    return mudou;
  }
  function fhCabe(P, mapa) {
    const larg = el => (el && el.offsetWidth > 0 ? el.offsetWidth : 0), VAO = 3;
    for (const q of mapa.querySelectorAll('.fh-l-quem')) {
      const cs = [...q.querySelectorAll('.fh-chip')], W = q.clientWidth;
      if (fhTem(q, 'fh-q-texto') || !cs.length || !(W > 0) || cs.some(c => !larg(c) || fhTem(c, 'fh-chip-mais'))) continue;
      if (cs.reduce((s, c, i) => s + larg(c) + (i ? VAO : 0), 0) <= W + 0.5) continue;
      const nomes = cs.map(c => String(c.textContent).trim()), m = P.h('span', 'fh-chip fh-chip-mais', '+' + cs.length); q.append(m);
      let k = cs.length;
      while (k > 0) { k--; m.textContent = '+' + (cs.length - k); if (cs.slice(0, k).reduce((s, c) => s + larg(c) + VAO, larg(m) || 26) <= W + 0.5) break; }
      for (const c of cs.slice(k)) c.remove();
      m.title = 'Quem trabalha nesta frente: ' + nomes.join(', ');
    }
    for (const s of mapa.querySelectorAll('.fh-l-s')) {
      const sit = s.querySelector('.fh-sit'), alta = s.querySelector('.fh-alta'), W = s.clientWidth;
      if (!sit || !alta || fhTem(alta, 'fh-alta-curta') || !(W > 0) || !larg(sit) || !larg(alta) || larg(sit) + VAO + larg(alta) <= W + 0.5) continue;
      alta.title = 'Selo inteiro: ' + String(alta.textContent).trim(); alta.textContent = 'est. alta'; alta.classList.add('fh-alta-curta');
    }
    for (const t of mapa.querySelectorAll('.fh-nt')) {
      const p = t.querySelector('.fh-prazo'), m = t.querySelector('.fh-p6-mais'), W = t.clientWidth;
      if (p && m && W > 0 && larg(p) && larg(m) && larg(p) + 6 + larg(m) > W + 0.5) t.classList.add('fh-nt-prazo');
      const sit = t.querySelector('.fh-sit'); if (sit && sit.clientWidth > 0 && sit.scrollWidth > sit.clientWidth + 1) t.classList.add('fh-nt-aperto');
    }
  }
  function fhPe(P, M, box) {
    const MD = root.PainelFluxoTelaModelo || null, n = FH.norte, lido = !!(MD && n && n.ok === true), sol = 'Solução: ' + (n && n.solucao ? String(n.solucao) : 'o painel lê de novo sozinho em 30 s');
    const hm = iso => { const t = Date.parse(iso || ''); if (!Number.isFinite(t)) return '?'; const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
    const partes = lido && typeof MD.resumoNorte === 'function' ? String(MD.resumoNorte(n.resumo) || '').split(' · ').filter(Boolean) : [];
    const tot = partes.length ? P.h('div', 'fh-p6b-tot', ...partes.map(x => P.h('span', 'fh-p', x)), P.h('span', 'fh-p', 'lido ' + hm(n.atualizado))) : P.h('div', 'fh-p6b-tot is-q', 'total: ?');
    tot.title = partes.length ? 'Norte inteiro: ' + partes.join(', ') + ', lido ' + hm(n.atualizado) + '.' : 'Total do Norte sem leitura. ' + sol;
    // sem ordemFoco escrito, a ordem sai do foco de cada frente (1 por foco, o nome do foco ou o da primeira frente); "nenhum" so quando nenhuma frente tem foco
    const escrita = lido && Array.isArray(n.ordemFoco) ? n.ordemFoco.filter(o => o && Number.isInteger(o.posicao) && typeof o.foco === 'string') : [], porFoco = new Map();
    if (lido && !escrita.length) for (const f of Array.isArray(n.frentes) ? n.frentes : []) { if (!f || !Number.isInteger(f.foco) || f.foco < 1 || porFoco.has(f.foco)) continue; const nome = [f.focoNome, f.frente].find(x => typeof x === 'string' && x.trim()); porFoco.set(f.foco, nome ? String(nome).trim() : ''); }
    const lf = !lido ? null : escrita.length ? escrita : [...porFoco].sort((a, b) => a[0] - b[0]).map(([posicao, foco]) => ({ posicao, foco })), dasFrentes = lido && !escrita.length;
    const focos = lf && lf.length ? P.h('div', 'fh-p6b-focos', ...lf.map(o => { const f = P.h('span', 'fh-foco', 'F' + o.posicao); f.dataset.foco = String(o.posicao); return P.h('span', 'fh-p fh-p6b-f', f, o.foco ? P.h('span', 'fh-p6b-fn', o.foco) : null); })) : P.h('div', 'fh-p6b-focos is-q', lf ? 'focos: nenhum' : 'focos: ?');
    focos.title = lf && lf.length ? (dasFrentes ? 'Ordem do seu foco, pelo foco de cada frente: ' : 'Ordem do seu foco: ') + lf.map(o => ('F' + o.posicao + ' ' + o.foco).trim()).join(', ') + '.' : lf ? 'Nenhuma frente com foco nesta leitura do Norte' : 'Ordem do foco sem leitura. ' + sol;
    const leg = P.h('div', 'fh-p6b-leg', ...[['aceso', 'trabalhando'], ['entregou', 'entregou'], ['dormindo', 'dormindo'], ['sem', 'sem leitura']].map(([c, t]) => P.h('span', 'fh-p6b-li', P.h('i', 'ft-px is-' + c), t)));
    const ss = P.h('div', 'fh-p6b-ss', ...[M.cC, ...M.sessoes, M.cX].filter(Boolean).map(it => {
      const enc = MD ? MD.encaixe((it.filhos || []).map(f => M.items.get(f)).filter(Boolean), { lido: it.agLido !== false, maxTira: it === M.cC ? 16 : undefined }) : { tira: [], mais: 0, trabalhando: null, total: null, texto: '?' };
      const qs = P.h('span', 'fh-p6b-qs', ...enc.tira.map(q => { const i = P.h('i', 'ft-px is-' + (q.ponto === 'sem-leitura' ? 'sem' : q.ponto)); i.title = String(q.dica).split(' · ').join(', '); i.dataset.lado = q.lado; return i; }));
      if (enc.mais > 0) { const m = P.h('span', 'fh-p6b-mais', '+' + enc.mais); m.title = 'Mais ' + enc.mais + ' nas últimas 2 h'; qs.append(m); }
      const c = P.h('span', 'fh-p6b-n' + (enc.total === null ? ' is-q' : ''), enc.texto);
      c.title = enc.total === null ? 'Ajudantes sem leitura. Solução: o painel lê de novo sozinho a cada 30 s' : enc.total ? enc.trabalhando + ' trabalhando agora, de ' + enc.total + ' nas últimas 2 h' : 'Nenhum ajudante nas últimas 2 h';
      return P.h('div', 'fh-p6b-s', P.h('b', 'fh-p6b-sn', it.nome), qs, c);
    }));
    const casa = typeof doc.getElementById === 'function' ? doc.getElementById('fz-resumo') : null, pai = casa && casa.parentNode && typeof casa.parentNode.insertBefore === 'function' ? casa.parentNode : null;
    const pe = P.h('section', 'fh-p6b' + (pai ? '' : ' is-na-caixa'), P.h('div', 'fh-p6b-col', P.h('h2', 'fh-p6b-t', 'Norte inteiro'), tot, focos), P.h('div', 'fh-p6b-col', P.h('h2', 'fh-p6b-t', 'Ajudantes nas últimas 2 h'), leg, ss));
    if (FH.pe && FH.pe.parentNode) FH.pe.remove();
    FH.pe = pe;
    if (pai) pai.insertBefore(pe, casa); else box.append(pe);
    return pe;
  }
  function fhCab(P, box) {
    const soTexto = el => [...el.childNodes].every(k => k.nodeType === 3 || k.tag === '#text');
    const pecas = el => { const t = String(el.textContent || ''); if (!soTexto(el) || !t.includes(' · ')) return; el.replaceChildren(...t.split(' · ').map(x => P.h('span', 'fh-p', x.trim()))); el.classList.add('is-partes'); if (!el.title) el.title = t.split(' · ').join(', '); };
    const sec = box.querySelector('.fv-cab .g-sec');
    if (sec && soTexto(sec)) {
      const t = String(sec.textContent || '').trim().replace(/\.$/, ''), i = t.indexOf('. '), a = i > 0 ? t.slice(0, i + 1) : '', resto = (i > 0 ? t.slice(i + 2) : t).split(' · ').map(x => x.trim());
      sec.replaceChildren(...(a ? [P.h('span', 'fh-cab-a', a)] : []), ...resto.map((x, n) => P.h('span', n ? 'fh-cab-l' : 'fh-cab-j', x)));
      sec.classList.add('is-partes'); sec.title = (a ? a + ' ' : '') + resto.join(', ') + '.';
    }
    for (const n of box.querySelectorAll('.fv-num')) {
      const r = n.querySelector('.fv-num-r'), v = n.querySelector('.fv-num-v'), s = n.querySelector('.fv-num-s'); if (!r) continue;
      const sub = s ? String(s.textContent || '').trim() : '', dica = String(r.textContent) + ': ' + (v ? String(v.textContent) : '?') + (sub ? ', ' + sub.split(' · ').join(', ') : '');
      r.title = dica; if (s) { s.title = dica; pecas(s); }
    }
    for (const el of box.querySelectorAll('.fv-num-lista-n,.fv-leg-dica')) pecas(el);
    { const esc = box.querySelector('.fv-escopo'), fr = esc ? esc.querySelector('.g-sec') : null, t = fr ? String(fr.textContent || '').trim() : ''; if (t) { if (!esc.title) esc.title = t; for (const b of esc.querySelectorAll('.fv-escopo-op')) if (!b.title) b.title = t; } }
    seloEmDois(P.h, box);
  }
  function fhDicas(mapa) { for (const p of mapa.querySelectorAll('.fv-pill')) { const t = String(p.title || ''); if (t.includes(' · ')) p.title = t.split(' · ').join(', '); } for (const z of mapa.querySelectorAll('.fv-selo.is-zero')) { if (!z.title && String(z.textContent).trim() === 'sem mensagem em 2 h') z.title = 'Nenhuma mensagem recebida nem mandada nas últimas 2 h'; } }
  function fhAfasta(ps, fixos, W) {
    const postos = [], out = [], bate = (x, p, o, f) => x < o.r + f && x + p.w > o.l - f && p.t < o.b + f && p.t + p.h > o.t - f;
    for (const p of ps) {
      let x = p.l; const preso = xx => postos.some(o => bate(xx, p, o, 2));
      if (preso(x)) { const livre = xx => xx >= 0 && xx + p.w <= W && !preso(xx) && !fixos.some(o => bate(xx, p, o, 0)), bom = postos.flatMap(o => [Math.ceil(o.r + 3), Math.floor(o.l - p.w - 3)]).filter(livre).sort((a, b) => Math.abs(a - p.l) - Math.abs(b - p.l))[0]; if (bom !== undefined) x = bom; }
      out.push(x); postos.push({ l: x, t: p.t, r: x + p.w, b: p.t + p.h });
    }
    return out;
  }
  function fhAfastar(mapa) {
    if (!mapa || !mapa.getBoundingClientRect) return;
    const b = mapa.getBoundingClientRect(), cx = el => { const r = el.getBoundingClientRect(); return { l: r.left - b.left, t: r.top - b.top, r: r.right - b.left, b: r.bottom - b.top, w: r.width, h: r.height }; };
    const els = [...mapa.querySelectorAll('.fv-pill')].filter(p => p.offsetWidth > 0), ps = els.map(cx), xs = fhAfasta(ps, [...mapa.querySelectorAll('.fv-card,.fv-mais')].map(cx).filter(r => r.w && r.h), mapa.offsetWidth);
    els.forEach((p, i) => { const d = xs[i] - ps[i].l; if (Math.abs(d) >= 1) { p.style.left = Math.round((parseFloat(p.style.left) || 0) + d) + 'px'; p.dataset.desviado = '1'; } });
  }
  doc.addEventListener('keydown', e => { if (e.key === 'Escape' && FH.aberto && ST.P) { FH.aberto = null; ST.P.repintar(); } });
  doc.addEventListener('click', e => { if (FH.aberto && ST.P && !(e && e.target && e.target.closest && e.target.closest('.fh-pop,.fh-p6-mais'))) { FH.aberto = null; ST.P.repintar(); } });
  root.PainelFluxoH = Object.freeze({ modelo: fhModelo, caminho: fhCaminho, estado: () => ({ aberto: FH.aberto, norte: !!FH.norte, voo: !!FH.voo }),
    _teste: Object.freeze({ voce: fhVoce, bloco: fhBloco, pilhas: fhPilhas, norte: n => { FH.norte = n || null; }, cab: fhCab, dicas: fhDicas, afasta: fhAfasta, pe: fhPe, voceAjusta: fhVoceAjusta, cabe: fhCabe, desenho: (P, M, norte, voo, modo) => { ST.M = M; ST.P = P; FH.norte = norte || null; FH.voo = voo || null; const mapa = modo === 'c' ? desenhoC(P, M) : desenhoA(P, M); fhMontar(P, M, mapa, modo === 'c' ? 'c' : 'a'); return mapa; } }) });

  // ---------- pintar (chamado pelo vistas.js no lugar do Fluxo de hoje) ----------
  function pintar(box, P) {
    ST.P = P; pedirAgentes(P);
    fhPedir(P);
    if (ST.escopo === null) { ST.escopo = lerEscopo(); const g = PG(); if (g) g.ouvir(() => { if (ST.P) ST.P.repintar(); }); }
    if (!ST.fontes && doc.fonts && doc.fonts.ready) { ST.fontes = true; doc.fonts.ready.then(() => P.repintar()); }
    const modo = modoDaLargura();
    if (!P.pronto) { box.replaceChildren(...cabecalho(P, null), P.h('p', 'g-vazio', P.falhou || P.snap ? FLUXO_INDISPONIVEL : 'Lendo quem manda em quem...')); return null; }
    const M = modelo(P); ST.M = M;
    const T = root.PainelFluxoTela;
    if (T && T.ativa()) delete html.dataset.fh;
    if (T && T.ativa()) { M.mapa = null; if (ST.ro) ST.ro.disconnect(); box.classList.add('fv-vista'); box.dataset.fluxoV = 'tela'; T.pintar(box, P, M, { abrir, detalhe: () => detalhe(P, M), sel: () => ST.sel, fechar: () => { ST.sel = null; P.repintar(); } }); return null; }
    if (T) T.sair();
    const mapa = modo === 'c' ? desenhoC(P, M) : desenhoA(P, M); M.mapa = mapa;
    fhMontar(P, M, mapa, modo);
    const det = detalhe(P, M);
    const corpo = P.h('div', 'fv-corpo-v fv-modo-' + modo + (det ? ' tem-det' : ''), mapa, det);
    const ligar = P.h('button', 'g-btn is-quieto g-ligar', 'Ligar animação'); ligar.type = 'button'; ligar.hidden = !P.reduced(); ligar.addEventListener('click', () => { const t = doc.getElementById('motion-toggle'); if (t && html.dataset.motion === 'off') t.click(); else html.dataset.motion = 'on'; setTimeout(() => P.repintar(), 50); });
    box.replaceChildren(...cabecalho(P, M), ligar, corpo);
    fhCab(P, box);
    box.classList.add('fv-vista'); box.dataset.fluxoV = modo;
    // a maiuscula da 1a letra muda a largura do texto: vem ANTES de medir (senao o contador fica sobre o cartao e o redesenho nao para)
    P.primeiraMaiuscula(box, '.fv-frase,.fv-txt,.fv-item-s');
    fhCabe(P, mapa);
    fhVoceAjusta(P, M); fhPe(P, M, box);
    const info = desenhar(P, M, mapa, modo);
    fhDicas(mapa); fhAfastar(mapa);
    // a fonte (ou o detalhe) pode mudar a altura dos cartoes depois do desenho: as linhas e os contadores seguem o cartao
    if (ST.ro) ST.ro.disconnect();
    if (root.ResizeObserver) { const alvos = [mapa, ...mapa.querySelectorAll('.fv-card')]; for (const el of alvos) { el._fvW = el.offsetWidth; el._fvH = el.offsetHeight; } let t = 0; ST.ro = new ResizeObserver(entradas => { if (!mapa.isConnected) return; if (!entradas.some(e => Math.abs(e.target.offsetWidth - e.target._fvW) >= 2 || Math.abs(e.target.offsetHeight - e.target._fvH) >= 2)) return; clearTimeout(t); t = setTimeout(() => { if (mapa.isConnected) P.repintar(); }, 120); }); for (const el of alvos) ST.ro.observe(el); }
    if (ST.sel || ST.hover) acender(ST.hover);
    const a = P.anim(); if (a) a.fluxo(info);
    return info;
  }
  doc.addEventListener('keydown', e => { if (e.key === 'Escape' && ST.lista) { fecharListas(); return; } if (e.key === 'Escape' && ST.sel && ST.P) { ST.sel = null; ST.P.repintar(); } });
  // a lista aberta pelo clique/toque fecha ao clicar fora dela
  doc.addEventListener('click', e => { if (ST.lista && !(e && e.target && e.target.closest && e.target.closest('.fv-num.tem-lista'))) fecharListas(); });
  root.PainelFluxoV = Object.freeze({ _teste: Object.freeze({ modelo, cabecalho, ag: j => { ST.ag = j; } }), pintar, pronto: () => !!ST.M, CORTE, modo: modoDaLargura, forcar: m => { ST.forca = m === 'a' || m === 'c' ? m : null; if (ST.P) ST.P.repintar(); },
    dados: () => { const M = ST.M; if (!M) return null; return { itens: [...M.items.values()].map(i => ({ id: i.id.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, '#'), tipo: i.tipo, nivel: i.nivel, nome: i.nome, frase: i.frase, envia: i.envia, recebe: i.recebe, ponta: i.ponta || null })),
      ligacoes: [...M.links.values()].map(L => ({ pai: nomeCurto(M, L.pai), filho: nomeCurto(M, L.filho), estilo: L.estilo, desce: L.nDesce, sobe: L.nSobe })), cadeias: M.cadeias.map(c => c.ids.map(id => nomeCurto(M, id)).join(' > ') + ' [' + c.estado + ']'), resumo: M.resumo, agentesLidos: !!ST.ag }; } });
})(window);
