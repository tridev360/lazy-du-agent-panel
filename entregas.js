/* Entregas em barras de progresso, modulo independente.
   Lugares (atributo data-lugares do proprio <script>; o que nao estiver la nao aparece):
     fila      no TOPO da aba Fila: a lista inteira, em grupos por projeto, 1 barra por entrega
     agora     no Agora (depois das colunas Espera voce / Anda / Travou): cartao compacto com as 3 mais perto de sair
               e as que dependem de voce; clicar leva a Fila, na entrega
     projetos  (opcional) na sub-vista Projetos: as barras de cada projeto, sem soma inventada
   Cores: verde = quase la (80% ou mais), roxo = em obra, laranja = depende de voce (o proximo passo e seu).
   Fonte: GET /api/entregas (entregas-rota.cjs, le estado/entregas.json). So GET; nada grava. Sem leitura = "?" com a solucao.
   Nada de data nem contagem de dias: so horas de obra. Movimento off: as barras nao animam.
   Gancho: 1 linha no index.html, depois do vistas.js:
     <link rel="stylesheet" href="/entregas.css"><script defer src="/entregas.js" data-lugares="fila agora projetos"></script> */
(function (root) {
  'use strict';
  const doc = root.document, html = doc.documentElement, SVGNS = 'http://www.w3.org/2000/svg';
  const eu = doc.currentScript;
  const LUG = new Set(String((eu && eu.dataset.lugares) || 'fila agora').toLowerCase().split(/[\s,]+/).filter(Boolean));
  const EXEMPLO = /[?&]exemplo=1\b/.test(root.location.search || '');
  const parado = () => html.dataset.motion === 'off';
  const S = { dados: null, erro: null, lidoEm: 0, lendo: null, antes: new Map(), primeira: true };
  const els = {};

  // ---------- utilidades ----------
  function h(tag, cls, ...kids) { const n = doc.createElement(tag); if (cls) n.className = cls; for (const k of kids) { if (k === null || k === undefined || k === false) continue; n.append(k.nodeType ? k : String(k)); } return n; }
  async function getJSON(url) {
    if (EXEMPLO) url += (url.includes('?') ? '&' : '?') + 'exemplo=1';
    const c = new AbortController(), t = setTimeout(() => c.abort(), 15000);
    try { const r = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' }, signal: c.signal }); if (!r.ok) throw Error(String(r.status)); return await r.json(); }
    finally { clearTimeout(t); }
  }
  // texto que chega sem acento: acentos so de palavra sem ambiguidade (nomes.js + as daqui); Agente sempre no singular
  const MAIS = { anuncio: 'anúncio', estrategias: 'estratégias', estrategia: 'estratégia', ilustracao: 'ilustração', inventario: 'inventário', premio: 'prêmio', estaticos: 'estáticos', navegacao: 'navegação', faceis: 'fáceis', comecou: 'começou', comecam: 'começam', obras: 'obras', juncao: 'junção', simulacao: 'simulação', conferencia: 'conferência', musica: 'música', musicas: 'músicas', especificacao: 'especificação' };
  function acc(s) {
    let v = String(s === null || s === undefined ? '' : s);
    if (root.PainelNomes && typeof root.PainelNomes.acentos === 'function') v = root.PainelNomes.acentos(v);
    v = v.replace(/[A-Za-z]+/g, w => { const a = MAIS[w.toLowerCase()]; if (!a || a === w.toLowerCase()) return w; return w.charAt(0) === w.charAt(0).toUpperCase() ? a.charAt(0).toUpperCase() + a.slice(1) : a; });
    return v.replace(/\b(Agente)s\b/g, '$1').replace(/([A-Za-zÀ-ÿ])\.(md|json)\b/g, '$1'); // nome de arquivo sem a extensao
  }
  // projeto pela chave sem acento: "Cortes" e "Cortes" acham o mesmo nome e o mesmo icone
  const chave = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const NOME_PROJETO = { Cortes: 'Cortes', Loja: 'Loja', Painel: 'Painel', Terminal: 'Terminal', Assistente: 'Assistente', ARENA: 'ARENA', PROJ: 'PROJ' };
  const nomeProjeto = p => NOME_PROJETO[chave(p)] || acc(p || 'Outros');
  const horas = n => Number.isFinite(n) ? (Math.round(n * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '?';
  // horas na frente: so as conhecidas; passo sem peso vira "?" (nunca hora inventada)
  function horasTxt(conhecidas, semPeso) { if (!Number.isFinite(conhecidas)) return '? h'; if (semPeso && !(conhecidas > 0)) return '? h'; return '~' + horas(conhecidas) + ' h' + (semPeso ? ' + ?' : ''); }
  const dependem = n => n + (n === 1 ? ' depende de você' : ' dependem de você');
  function haMin(min) {
    if (!Number.isFinite(min)) return '?'; const m = Math.max(0, Math.round(min)); if (m < 1) return 'agora'; if (m < 60) return 'há ' + m + ' min';
    if (m < 600) return 'há ' + Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : ''); const hr = Math.round(m / 60); if (hr < 48) return 'há ' + hr + ' h'; return 'há ' + Math.round(hr / 24) + ' dias';
  }
  const ROTULO = { quase: 'quase lá', obra: 'em obra', voce: 'depende de você', pronta: 'pronta', 'sem-leitura': 'sem leitura' };

  // ---------- icones pixel 8x8 por projeto (cor do texto, nos 3 temas) ----------
  const ICONES = {
    Terminal: ['........', '#.......', '.#......', '..#.....', '.#......', '#...####', '........', '........'],
    Assistente: ['...##...', '...##...', '.######.', '#......#', '#.#..#.#', '#......#', '.######.', '..#..#..'],
    ARENA: ['...#....', '...#....', '........', '##.#.##.', '........', '...#....', '...#....', '........'],
    Painel: ['........', '###.####', '###.####', '........', '########', '###.....', '###.####', '........'],
    PROJ: ['...#....', '...#....', '..###...', '#######.', '.#####..', '..#.#...', '.#...#..', '........'],
    Cortes: ['########', '#......#', '#.#....#', '#.###..#', '#.####.#', '#.###..#', '#.#....#', '########'],
    Loja: ['.######.', '#......#', '#.#..#.#', '#......#', '#.#..#.#', '#......#', '.######.', '........'],
    Outros: ['........', '.######.', '.######.', '.######.', '.######.', '.######.', '.######.', '........']
  };
  function icone(projeto) {
    const rows = ICONES[chave(projeto)] || ICONES.Outros, s = doc.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 8 8'); s.setAttribute('width', '16'); s.setAttribute('height', '16'); s.setAttribute('shape-rendering', 'crispEdges'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'en-ic');
    rows.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '#') return; const r = doc.createElementNS(SVGNS, 'rect'); r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', 1); r.setAttribute('height', 1); r.setAttribute('fill', 'currentColor'); s.append(r); }));
    return s;
  }

  // o grupo da lista (Terminal, Assistente, ARENA, Painel, PROJ, Cortes, Loja) vira o id do seletor pelo mesmo projeto-de.cjs
  const PG = () => root.PainelProjetoGlobal || null;
  const filtrando = () => { const g = PG(); return !!(g && g.atual() !== 'todos'); };
  function visto(d) {
    if (!d || !d.lido || !filtrando()) return d;
    const g = PG(), projetos = d.projetos.filter(p => g.casa({ projeto: p.projeto, titulo: p.projeto }));
    const ids = new Set(projetos.flatMap(p => p.entregas.map(e => e.id)));
    // as 3 mais perto de sair DENTRO do projeto (a mesma ordem da rota: maior % e menos horas na frente)
    const ordem = (a, b) => (b.pct ?? -1) - (a.pct ?? -1) || a.horasNaFrente - b.horasNaFrente;
    const perto = projetos.flatMap(p => p.entregas).filter(e => e.lido && e.estado !== 'pronta' && e.estado !== 'voce').sort(ordem).slice(0, 3).map(e => e.id);
    return { ...d, projetos, quantas: ids.size, perto, esperamVoce: d.esperamVoce.filter(id => ids.has(id)), soProjeto: g.nome(g.atual()), totalGeral: d.quantas };
  }
  // projeto sem entrega na lista: "none" com o caminho de volta, nunca 0 inventado no lugar de leitura
  const semDoProjeto = d => h('p', 'en-vazio', 'Nenhuma entrega de ' + d.soProjeto + ' na lista de entregas. Em "Vendo:", na barra de cima, escolha Todos para ver as ' + d.totalGeral + '.');

  // ---------- pecas ----------
  const todas = () => (S.dados && S.dados.lido ? S.dados.projetos.flatMap(p => p.entregas) : []);
  const porId = id => todas().find(e => e.id === id) || null;
  // barra fina; anima do valor anterior para o novo (1a pintura: de 0), nunca no Movimento off
  function barra(e) {
    const b = h('span', 'en-barra'), fill = h('i', '');
    b.setAttribute('role', 'progressbar'); b.setAttribute('aria-valuemin', '0'); b.setAttribute('aria-valuemax', '100');
    if (Number.isFinite(e.pct)) b.setAttribute('aria-valuenow', String(e.pct)); else b.setAttribute('aria-valuetext', 'sem leitura');
    b.setAttribute('aria-label', acc(e.nome) + ': ' + (Number.isFinite(e.pct) ? e.pct + '%' : '?') + ', ' + ROTULO[e.estado]);
    const alvo = Number.isFinite(e.pct) ? e.pct : 0, de = S.antes.has(e.id) ? S.antes.get(e.id) : (S.primeira ? 0 : alvo);
    fill.style.setProperty('--en-p', (parado() ? alvo : de) + '%'); fill.dataset.alvo = String(alvo);
    b.append(fill); return b;
  }
  function pct(e) { if (Number.isFinite(e.pct)) return h('span', 'en-pct', e.pct + '%'); const s = h('span', 'en-pct', '?', h('span', 'en-pct-nota', e.lido ? ' falta estimar as horas' : ' falta ler os passos')); s.title = e.lido ? 'Nenhum passo desta entrega tem hora estimada ainda; o COORDENADOR estima e o % aparece.' : 'Os passos desta entrega não foram lidos; o COORDENADOR refaz a lista.'; return s; }
  // "Na frente: <passos> · ~<h> h · adianta: <texto>"; passo seu vai em laranja com "(você)"
  function linhaFrente(e) {
    const p = h('p', 'en-frente');
    if (!e.lido) { p.append(h('span', 'en-q', 'Passos sem leitura (?)'), ' · ' + (S.dados && S.dados.solucao || 'A sua sessão principal refaz a lista de entregas.')); return p; }
    if (e.estado === 'pronta') { p.append(h('span', 'en-ok', 'Pronta: todos os passos feitos')); return p; }
    p.append(h('span', 'en-rot', 'Na frente: '));
    // passo sem peso mostra "(? h)": hora desconhecida, fora da conta
    e.naFrente.forEach((x, i) => { if (i) p.append(', '); const nome = acc(x.nome) + (x.peso === null ? ' (? h)' : ''); p.append(x.dependeDele ? h('span', 'en-seu', nome + ' (você)') : nome); });
    p.append(' · ', h('span', 'en-h', horasTxt(e.horasNaFrente, e.semPeso)));
    // verde so quando corta caminho de verdade; trava (passo seu, alguem de fora, espera) fica neutro
    if (e.adianta) p.append(' · ', h('span', 'en-rot', 'adianta: '), h('em', 'en-adianta' + (e.adiantaLivre ? ' is-livre' : ''), acc(e.adianta)));
    return p;
  }
  function item(e) {
    const a = h('article', 'en-item is-' + e.estado, h('div', 'en-l1', h('b', 'en-nome', acc(e.nome)), pct(e)), barra(e), linhaFrente(e));
    a.dataset.enId = e.id; a.tabIndex = -1; a.title = ROTULO[e.estado] + (e.dono ? ' · quem toca: ' + (root.PainelNomes ? root.PainelNomes.nome(e.dono) : e.dono) : '');
    if (S.antes.has(e.id) && Number.isFinite(e.pct) && e.pct > S.antes.get(e.id)) a.classList.add('is-subiu');
    return a;
  }
  function legenda() {
    const chip = (cls, txt) => h('span', 'en-chip ' + cls, h('i', ''), txt);
    return h('div', 'en-legenda', chip('is-quase', 'quase lá (80% ou mais)'), chip('is-obra', 'em obra'), chip('is-voce', 'depende de você (o próximo passo é seu)'),
      h('span', 'en-leg-nota', '% = horas de obra feitas sobre as horas conhecidas da entrega · "?" = hora ainda não estimada · só horas, sem data'));
  }
  // aviso de leitura: velho (mais de 3 h), sem hora, hora a frente do relogio; nada quando esta em dia. Frase de gente, sem nome de arquivo
  function aviso(d) {
    if (!d || !d.lido) return null;
    if (d.idadeMin === null || d.idadeMin === undefined) return h('div', 'en-aviso', h('b', '', 'A lista não diz quando foi refeita (?)'), h('span', '', d.solucao));
    if (d.futuro) return h('div', 'en-aviso', h('b', '', 'A hora gravada na lista está à frente do relógio (?)'), h('span', '', 'O COORDENADOR regrava a lista com a hora certa. ' + d.solucao));
    if (d.velho) return h('div', 'en-aviso is-velho', h('b', 'en-idade', 'Atualizado ' + haMin(d.idadeMin)), h('span', '', 'Pode estar velha (mais de 3 h sem ser refeita). Solução: peça à sua IA para atualizar estado/entregas.json.'));
    return null;
  }
  function semLeitura(curto) {
    const d = S.dados, motivo = d && d.motivo === 'ausente' ? 'A lista de entregas ainda não foi gravada.' : d && d.motivo === 'exemplo' ? 'No modo de exemplo não há entregas.' : 'A lista de entregas não foi lida.';
    const box = h('div', 'en-semleitura', h('span', 'en-q-grande', '?'), h('div', '', h('b', '', motivo), h('span', '', (d && d.solucao) || 'A sua sessão principal refaz a lista de entregas.')));
    if (curto) box.classList.add('is-curto');
    return box;
  }
  function lidoTxt(d) { return d && d.lido && Number.isFinite(d.idadeMin) && !d.futuro ? 'atualizado ' + haMin(d.idadeMin) : ''; }

  // ---------- (a) FILA: a lista inteira ----------
  function pintarFila() {
    const box = els.fila; if (!box) return;
    const d = visto(S.dados), frag = doc.createDocumentFragment();
    const sub = d && d.lido ? [d.soProjeto ? 'só ' + d.soProjeto : '', d.quantas + (d.quantas === 1 ? ' entrega' : ' entregas'), d.esperamVoce.length ? dependem(d.esperamVoce.length) : 'nenhuma depende de você', lidoTxt(d)].filter(Boolean).join(' · ') : (S.erro ? 'sem leitura agora; o painel lê de novo em 1 min' : 'lendo...');
    frag.append(h('div', 'en-head', h('h2', 'g-h', 'Entregas'), h('span', 'en-sub', sub)));
    if (!d || !d.lido) { frag.append(d ? semLeitura(false) : h('p', 'en-sub', 'Lendo as entregas...')); box.replaceChildren(frag); return; }
    frag.append(legenda());
    const av = aviso(d); if (av) frag.append(av);
    if (d.soProjeto && !d.projetos.length) frag.append(semDoProjeto(d));
    const grade = h('div', 'en-grupos');
    for (const g of d.projetos) {
      const extra = [g.quantas + (g.quantas === 1 ? ' entrega' : ' entregas'), g.esperamVoce ? dependem(g.esperamVoce) : null].filter(Boolean).join(' · ');
      const sec = h('section', 'en-grupo', h('div', 'en-grupo-h', icone(g.projeto), h('h3', 'en-grupo-t', nomeProjeto(g.projeto)), h('span', 'en-grupo-n', extra)));
      sec.dataset.enProjeto = g.projeto;
      for (const e of g.entregas) sec.append(item(e));
      grade.append(sec);
    }
    frag.append(grade, h('p', 'en-fonte', 'Fonte: a lista de entregas registrada no estado. As horas são estimativa de obra; o % vem só dos passos feitos com hora conhecida.'));
    box.replaceChildren(frag);
  }

  // ---------- (b) AGORA: cartao compacto ----------
  function mini(e, voce) {
    const b = h('button', 'en-mini is-' + e.estado, h('span', 'en-l1', h('b', 'en-nome', acc(e.nome)), pct(e)), barra(e));
    const prox = e.proximo ? acc(e.proximo.nome) : '?', fr = h('span', 'en-frente');
    // passo seu: "de obra" conta so os passos de obra (nunca o seu); hora sem peso vira "?", nunca hora inventada
    if (voce) { fr.append(h('span', 'en-seu', 'Seu passo: ' + prox)); if (e.horasObra > 0 || e.obraSemPeso) fr.append(' · ' + horasTxt(e.horasObra, e.obraSemPeso) + ' de obra na frente'); }
    else fr.append(horasTxt(e.horasNaFrente, e.semPeso) + ' na frente · próximo: ' + prox);
    b.append(fr);
    b.type = 'button'; b.dataset.enId = e.id; b.title = 'Abrir na Fila';
    b.addEventListener('click', () => irFila({ id: e.id }));
    return b;
  }
  function pintarAgora() {
    const box = els.agora; if (!box) return;
    const d = visto(S.dados), frag = doc.createDocumentFragment();
    const ver = h('button', 'en-ver', d && d.lido ? 'Ver as ' + d.quantas + ' na Fila' : 'Abrir a Fila', h('span', '', ' →')); ver.type = 'button'; ver.addEventListener('click', () => irFila(null));
    const sub = d && d.lido ? [d.soProjeto ? 'só ' + d.soProjeto : '', 'as ' + d.perto.length + ' mais perto de sair' + (d.esperamVoce.length ? ' e ' + (d.esperamVoce.length === 1 ? 'a que depende de você' : 'as ' + d.esperamVoce.length + ' que dependem de você') : ''), lidoTxt(d)].filter(Boolean).join(' · ') : (S.erro ? 'sem leitura agora' : 'lendo...');
    frag.append(h('div', 'en-head', h('h2', 'g-h', 'Entregas'), h('span', 'en-sub', sub), ver));
    if (!d || !d.lido) { if (d) frag.append(semLeitura(true)); box.replaceChildren(frag); return; }
    const av = aviso(d); if (av) frag.append(av);
    const colP = h('div', 'en-col', h('h3', 'en-col-t', 'Mais perto de sair'));
    const perto = d.perto.map(porId).filter(Boolean);
    if (perto.length) for (const e of perto) colP.append(mini(e, false)); else colP.append(h('p', 'en-vazio', 'nenhuma entrega aberta além das que dependem de você'));
    const colV = h('div', 'en-col is-voce', h('h3', 'en-col-t', 'Dependem de você'));
    const voce = d.esperamVoce.map(porId).filter(Boolean);
    if (voce.length) for (const e of voce) colV.append(mini(e, true)); else colV.append(h('p', 'en-vazio', 'nenhuma entrega depende de você agora'));
    frag.append(h('div', 'en-cols', colP, colV));
    box.replaceChildren(frag);
  }

  // ---------- (c) PROJETOS: as barras de cada projeto ----------
  function pintarProjetos() {
    const box = els.projetos; if (!box) return;
    const d = visto(S.dados), frag = doc.createDocumentFragment();
    frag.append(h('div', 'en-head', h('h2', 'g-h', 'Entregas por projeto'), h('span', 'en-sub', d && d.lido ? [d.soProjeto ? 'só ' + d.soProjeto : '', 'cada barra é uma entrega; clique para ver na Fila', lidoTxt(d)].filter(Boolean).join(' · ') : (S.erro ? 'sem leitura agora' : 'lendo...'))));
    if (!d || !d.lido) { if (d) frag.append(semLeitura(true)); box.replaceChildren(frag); return; }
    const av = aviso(d); if (av) frag.append(av);
    if (d.soProjeto && !d.projetos.length) frag.append(semDoProjeto(d));
    const lista = h('div', 'en-projs');
    for (const g of d.projetos) {
      const b = h('button', 'en-proj', h('span', 'en-grupo-h', icone(g.projeto), h('span', 'en-grupo-t', nomeProjeto(g.projeto)), h('span', 'en-grupo-n', g.quantas + (g.quantas === 1 ? ' entrega' : ' entregas') + (g.esperamVoce ? ' · ' + dependem(g.esperamVoce) : ''))));
      for (const e of g.entregas) b.append(h('span', 'en-pl is-' + e.estado, h('span', 'en-l1', h('span', 'en-nome', acc(e.nome)), pct(e)), barra(e)));
      b.type = 'button'; b.title = 'Abrir ' + nomeProjeto(g.projeto) + ' na Fila'; b.addEventListener('click', () => irFila({ projeto: g.projeto }));
      lista.append(b);
    }
    frag.append(lista); box.replaceChildren(frag);
  }

  // anima as barras ate o valor novo no quadro seguinte e guarda o valor para a proxima leitura
  function soltarBarras() {
    const go = () => { for (const i of doc.querySelectorAll('.en-barra > i[data-alvo]')) i.style.setProperty('--en-p', i.dataset.alvo + '%'); };
    if (parado()) go(); else root.requestAnimationFrame(() => root.requestAnimationFrame(go));
    for (const e of todas()) if (Number.isFinite(e.pct)) S.antes.set(e.id, e.pct);
    S.primeira = false;
  }
  function pintar() { try { colocarAgora(); pintarFila(); pintarAgora(); pintarProjetos(); soltarBarras(); } catch (err) { console.warn('entregas', err); } }

  // ---------- ir para a Fila (e acender a entrega ou o projeto) ----------
  function irFila(alvo) {
    const V = root.PainelVistas;
    if (V && typeof V.show === 'function') V.show('fila', 'fila'); else root.location.hash = '#g=fila.fila';
    if (!alvo) return;
    setTimeout(() => {
      const sel = alvo.id ? '[data-en-id="' + CSS.escape(alvo.id) + '"]' : '[data-en-projeto="' + CSS.escape(alvo.projeto) + '"]';
      const el = els.fila && els.fila.querySelector(sel); if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: parado() ? 'auto' : 'smooth' });
      el.classList.remove('is-foco'); void el.offsetWidth; el.classList.add('is-foco'); clearTimeout(el._enFoco); el._enFoco = setTimeout(() => el.classList.remove('is-foco'), 1800);
    }, 160);
  }

  // ---------- leitura ----------
  async function ler(force) {
    if (S.lendo) return S.lendo;
    if (!force && doc.hidden) return null;
    S.lendo = (async () => {
      try { S.dados = await getJSON('/api/entregas'); S.erro = null; } catch (e) { S.erro = String(e && e.message || e); /* fica a leitura anterior */ }
      S.lidoEm = Date.now(); pintar();
    })().finally(() => { S.lendo = null; });
    return S.lendo;
  }

  // ---------- montagem (nos proprios; o vistas.js troca o miolo do Agora, o observador devolve o cartao) ----------
  // GRADE e LIVRO: dentro do Agora, logo depois das colunas. FOLHA: o Agora e outro (blocos-folha.js, #fh-agora), o cartao
  // entra depois da linha Andando / Travado / Credito, antes do "Hoje"
  function colocarAgora() {
    const card = els.agora; if (!card) return;
    const fh = html.dataset.theme === 'folha' ? doc.getElementById('fh-agora') : null;
    if (fh) { const linha = fh.querySelector('.fh-bloco-linha'); if (linha) { if (linha.nextElementSibling !== card) linha.after(card); } else if (card.parentElement !== fh) fh.append(card); return; }
    const box = doc.getElementById('g-agora'); if (!box) return;
    const cols = box.querySelector('.g-cols');
    if (cols) { if (cols.nextElementSibling !== card) cols.after(card); }
    else if (card.parentElement !== box) box.append(card);
  }
  function montar() {
    let ok = true;
    if (LUG.has('fila') && !els.fila) { const q = doc.getElementById('panel-queue'); if (q) { const s = h('section', 'en-bloco en-fila'); s.id = 'en-fila'; s.setAttribute('aria-label', 'Entregas'); s.dataset.dsOwned = 'entregas'; q.before(s); els.fila = s; } else ok = false; }
    if (LUG.has('projetos') && !els.projetos) { const p = doc.getElementById('panel-projects'); if (p) { const s = h('section', 'en-bloco en-projetos'); s.id = 'en-projetos'; s.setAttribute('aria-label', 'Entregas por projeto'); s.dataset.dsOwned = 'entregas'; p.before(s); els.projetos = s; } else ok = false; }
    if (LUG.has('agora') && !els.agora) {
      const box = doc.getElementById('g-agora');
      if (box) { const s = h('section', 'en-bloco en-card'); s.id = 'en-agora'; s.setAttribute('aria-label', 'Entregas'); s.dataset.dsOwned = 'entregas'; els.agora = s; colocarAgora(); new MutationObserver(colocarAgora).observe(box, { childList: true }); }
      else ok = false;
    }
    return ok;
  }
  function start() {
    let n = 0;
    const tentar = () => {
      // espera o vistas.js montar o Agora (ate 15 s); o que ja existe ganha o bloco na hora
      if (!montar() && n++ < 60) { setTimeout(tentar, 250); return; }
      ler(true);
      // abriu a Fila, o Agora ou Projetos com leitura de mais de 30 s: le de novo na hora
      new MutationObserver(() => { colocarAgora(); if (Date.now() - S.lidoEm > 30000) ler(); }).observe(html, { attributes: true, attributeFilter: ['data-g-old', 'data-g-new', 'data-theme'] });
      setInterval(() => ler(), 60000);
      // trocou o projeto em "Vendo:": repinta com a leitura que ja tem (nada de rede nova)
      if (typeof root.addEventListener === 'function') root.addEventListener('painel-projeto', () => pintar());
      doc.addEventListener('visibilitychange', () => { if (!doc.hidden && Date.now() - S.lidoEm > 30000) ler(); });
    };
    tentar();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => setTimeout(start, 0), { once: true }); else setTimeout(start, 0);
  root.PainelEntregas = Object.freeze({ ler: () => ler(true), irFila, estado: () => ({ lugares: [...LUG], lido: !!(S.dados && S.dados.lido), motivo: S.dados && S.dados.motivo || null, erro: S.erro, montado: { fila: !!els.fila, agora: !!els.agora, projetos: !!els.projetos } }) });
})(window);
