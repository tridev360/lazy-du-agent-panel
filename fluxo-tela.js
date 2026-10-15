
(function (root) {
  'use strict';
  const doc = root.document, html = doc.documentElement, MD = root.PainelFluxoTelaModelo, SVGNS = 'http://www.w3.org/2000/svg';
  if (!doc || !MD) return;
  const SEM_JANELA = /Headless/i.test((root.navigator && root.navigator.userAgent) || '');
  let SUF = ''; try { SUF = new URLSearchParams(String(root.location.search || '')).get('exemplo') === '1' ? '?exemplo=1' : ''; } catch (e) { SUF = ''; }
  const LARGURA_SESSAO = 172, LINHA_NORTE = 28, CORTE = 980, ALTURA_MIN = 620;
  const ESTADO_T = { trabalhando: 'trabalhando', esperando: 'esperando', terminou: 'terminou', dormindo: 'dormindo', 'sem-leitura': 'sem leitura ?' };
  const PASSO_T = { fala: 'você falou', pensou: 'pensou', comando: 'comando', mandou: 'mandou', voltou: 'voltou', perguntou: 'perguntou', ajudante: 'chamou ajudante' };
  const E = { raiz: null, P: null, M: null, G: null, norte: null, norteEm: 0, nortePedido: false, aberta: null, envios: new Map(), maxNorte: MD.MAX_NORTE, gavSessao: null, altSess: 0, sig: {}, fitaNo: null, gaveta: null, passo: null, cabemNorte: null, cabemSess: null, ro: null, filtro: '' };
  const el = {};

  const h = (tag, cls, ...kids) => { const n = doc.createElement(tag); if (cls) n.className = cls; for (const k of kids) if (k !== null && k !== undefined && k !== false && k !== '') n.append(k.nodeType ? k : doc.createTextNode(String(k))); return n; };
  const botao = (cls, texto, dica) => { const b = h('button', cls, texto); b.type = 'button'; if (dica) b.title = dica; return b; };
  const poe = (n, t) => { if (n && n.textContent !== t) n.textContent = t; };
  const marca = (n, k, v) => { if (!n) return; if (v === null || v === undefined || v === false) { if (n.dataset[k] !== undefined) delete n.dataset[k]; } else if (n.dataset[k] !== String(v)) n.dataset[k] = String(v); };
  const hm = iso => { const d = new Date(iso); return isNaN(d) ? '?' : String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const muda = (chave, valor) => { const s = typeof valor === 'string' ? valor : JSON.stringify(valor); if (E.sig[chave] === s) return false; E.sig[chave] = s; return true; };
  const telaCheia = () => /(?:^#|&)tela=cheia\b/.test(root.location.hash || '');
  const podeAgir = () => root.PainelRecursos?.pedidos===true && SUF === '';
  const cru = () => null;
  const naTela = () => html.dataset.gNew === 'fluxo' && html.dataset.ft === 'tela' && doc.hidden !== true && !!E.raiz && E.raiz.isConnected;
  const rola = () => root.innerWidth < CORTE || root.innerHeight < ALTURA_MIN;

  function montar(box) {
    if (!E.raiz) {
      const faixa = (id, rotulo, ...kids) => { const f = h('section', 'ft-faixa ft-' + id, rotulo ? h('h2', 'ft-rot', rotulo) : null, ...kids); f.id = 'ft-' + id; return f; };
      const caixa = (cls, titulo) => { const t = h('b', 'ft-cx-t', titulo), corpo = h('div', 'ft-cx-c'); return { no: h('article', 'ft-cx ' + cls, t, corpo), t, corpo }; };
      el.voce = caixa('ft-voce', 'Você'); el.coordenador = caixa('ft-coordenador', 'COORDENADOR'); el.mandou = caixa('ft-mandou', 'Mandou agora');
      el.voceTxt = h('p', 'ft-cx-s', '?'); el.voce.corpo.append(el.voceTxt);
      el.jEstado = h('p', 'ft-cx-e', '?'); el.jDet = h('p', 'ft-cx-s', ''); el.jConta = h('p', 'ft-cx-n', ''); el.jTira = h('div', 'ft-tira'); el.coordenador.corpo.append(el.jEstado, el.jDet, el.jConta, el.jTira);
      el.seta1 = h('i', 'ft-seta'); el.seta2 = h('i', 'ft-seta'); for (const s of [el.seta1, el.seta2]) s.setAttribute('aria-hidden', 'true');
      el.vivo = faixa('vivo', 'Ao vivo', h('div', 'ft-vivo-linha', el.voce.no, el.seta1, el.coordenador.no, el.seta2, el.mandou.no)); el.vivo.hidden = true;
      el.sessMais = h('span', 'ft-rot-nota', ''); el.sessGrade = h('div', 'ft-sess-grade');
      el.sess = faixa('sessoes', null, h('div', 'ft-rot-linha', h('h2', 'ft-rot', 'Sessões'), h('span', 'ft-legenda', h('i', 'ft-px is-aceso'), 'trabalhando', h('i', 'ft-px is-entregou'), 'entregou', h('i', 'ft-px is-dormindo'), 'dormindo', h('i', 'ft-px is-sem'), 'sem leitura'), el.sessMais), el.sessGrade);
      el.norteLido = h('span', 'ft-rot-nota', ''); el.norteLista = h('ol', 'ft-norte-lista'); el.norteQ = h('p', 'ft-q', ''); el.norteQ.hidden = true;
      el.norteFocos = h('span', 'ft-rot-nota ft-norte-focos', ''); el.norteSess = h('div', 'ft-norte-sess');
      el.norte = faixa('norte', null, h('div', 'ft-rot-linha', h('h2', 'ft-rot', 'Norte · atrasadas primeiro, depois o seu foco'), el.norteLido, el.norteFocos), el.norteQ, el.norteLista, el.norteSess);
      el.chips = h('div', 'ft-chips'); el.acoes = h('div', 'ft-pe-acoes');
      el.fitaL = h('span', 'ft-fita-l', '?'); el.fitaFiltro = botao('ft-chip ft-fita-filtro', '', 'Tirar o filtro da fita'); el.fitaFiltro.hidden = true;
      el.fitaAbrir = botao('ft-chip', 'abrir a fita', 'Abre a fita crua inteira ao lado');
      el.fita = h('div', 'ft-fita', h('b', 'ft-fita-t', 'Fita crua'), el.fitaL, el.fitaFiltro, el.fitaAbrir); el.fita.hidden = true;
      el.pe = faixa('pe', null, h('div', 'ft-pe-linha', el.chips, el.acoes), el.fita);
      el.guarda = h('div', 'ft-guarda'); el.guarda.setAttribute('aria-hidden', 'true');
      el.gavT = h('b', 'ft-gav-t', ''); el.gavFechar = botao('ft-chip', 'Fechar', 'Fecha o painel ao lado (Esc)'); el.gavCorpo = h('div', 'ft-gav-corpo');
      el.gaveta = h('aside', 'ft-gaveta', h('div', 'ft-gav-cab', el.gavT, el.gavFechar), el.gavCorpo); el.gaveta.id = 'ft-gaveta'; el.gaveta.hidden = true;
      el.fios = doc.createElementNS(SVGNS, 'svg'); el.fios.setAttribute('class', 'ft-fios'); el.fios.setAttribute('aria-hidden', 'true');
      E.raiz = h('div', 'ft-tela', el.fios, el.vivo, el.sess, el.norte, el.pe, el.guarda, el.gaveta); E.raiz.id = 'ft-tela'; E.raiz.dataset.dsOwned = 'fluxo-tela';
      el.gavFechar.addEventListener('click', () => fecharGaveta());
      el.fitaAbrir.addEventListener('click', () => abrirGaveta('fita'));
      el.fitaFiltro.addEventListener('click', () => filtrarFita('', ''));
      if (root.ResizeObserver) { E.ro = new root.ResizeObserver(() => agendarMedida()); E.ro.observe(E.raiz); }
    }
    if (E.raiz.parentNode !== box || box.children.length !== 1) { box.replaceChildren(E.raiz); E.sig = {}; }
    if (!E.fitaNo && root.PainelCru && typeof root.PainelCru.criar === 'function') { try { E.fitaNo = root.PainelCru.criar({ so: 'fita' }); el.guarda.append(E.fitaNo); } catch (e) { E.fitaNo = null; } }
  }

  const GAV_T = { det: 'Detalhe', fita: 'Fita crua do seu Claude', topo: 'Resumo, consumo e fechadas', lado: 'Entregas e projetos', norte: 'Todas as frentes' };
  function abrirGaveta(qual) {
    if (E.gaveta === qual && qual !== 'det') return fecharGaveta();
    if (E.gaveta === 'fita' && qual !== 'fita' && E.fitaNo) el.guarda.append(E.fitaNo);
    if (E.gaveta === 'det' && qual !== 'det' && E.G && E.G.sel()) E.G.fechar();
    E.gaveta = qual; poe(el.gavT, GAV_T[qual] || '');
    marca(html, 'ftGaveta', qual === 'topo' || qual === 'lado' ? qual : null);
    el.gaveta.hidden = false; marca(el.gaveta, 'qual', qual);
    if (qual === 'fita' && E.fitaNo) el.gavCorpo.replaceChildren(E.fitaNo);
    else if (qual !== 'det') el.gavCorpo.replaceChildren();
  }
  function fecharGaveta() {
    const era = E.gaveta; E.gaveta = null;
    if (era === 'fita' && E.fitaNo) el.guarda.append(E.fitaNo);
    marca(html, 'ftGaveta', null); if (el.gaveta) { el.gaveta.hidden = true; el.gavCorpo.replaceChildren(); }
    E.sig.det = ''; E.sig.gnorte = '';
    if (era === 'det' && E.G && E.G.sel()) E.G.fechar();
  }
  function pintarDetalhe() {
    const sel = E.G ? E.G.sel() : null;
    if (!sel) { if (E.gaveta === 'det') { E.gaveta = null; el.gaveta.hidden = true; el.gavCorpo.replaceChildren(); E.sig.det = ''; } return; }
    const it = E.M.items.get(sel); if (E.gaveta !== 'det') abrirGaveta('det');
    if (!muda('det', [sel, it && it.nome, it && it.frase, it && it.estado])) return;
    const d = E.G.detalhe(); el.gavCorpo.replaceChildren(...(d ? [d] : []));
  }
  function filtrarFita(chave, nome) {
    E.filtro = chave || '';
    if (E.fitaNo && typeof E.fitaNo.cruFiltrar === 'function') { try { E.fitaNo.cruFiltrar(E.filtro, nome || ''); } catch (e) {  } }
    el.fitaFiltro.hidden = !E.filtro; poe(el.fitaFiltro, E.filtro ? 'só ' + (nome || chave) + ' · tirar' : '');
    if (E.filtro && E.gaveta !== 'fita') abrirGaveta('fita');
    for (const c of el.sessGrade.children) marca(c, 'filtro', E.filtro && c.dataset.sessao === E.filtro ? 1 : null);
  }

  function tira(alvo, enc, paiId) {
    const kids = [];
    for (const q of enc.tira) { const b = botao('ft-px is-' + (q.ponto === 'sem-leitura' ? 'sem' : q.ponto), '', q.dica); b.setAttribute('aria-label', q.dica); b.dataset.lado = q.lado; b.addEventListener('click', ev => { ev.stopPropagation(); E.G.abrir(q.id); }); kids.push(b); }
    if (enc.mais > 0) { const m = botao('ft-tira-mais', '+' + enc.mais, 'Mais ' + enc.mais + ': abre a lista inteira'); m.addEventListener('click', ev => { ev.stopPropagation(); E.G.abrir(paiId); }); kids.push(m); }
    const n = h('span', 'ft-tira-n', enc.texto); n.title = enc.total === null ? 'Ajudantes sem leitura. Solução: o painel lê de novo sozinho a cada 30 s' : enc.total ? enc.trabalhando + ' trabalhando agora, de ' + enc.total + ' nas últimas 2 h' : 'Nenhum ajudante nas últimas 2 h';
    kids.push(n); alvo.replaceChildren(...kids);
  }
  const filhosDe = it => (it.filhos || []).map(f => E.M.items.get(f)).filter(Boolean);
  const norteAgora = extra => (E.norte && E.norte.ok ? MD.norteEmTela(E.norte.frentes, Object.assign({ max: E.maxNorte, dono: podeAgir() }, extra)) : null);
  const linhasNorte = () => { const n = norteAgora(); return n ? n.todas : []; };
  const solucaoNorte = () => 'Solução: ' + ((E.norte && E.norte.solucao) || 'o painel tenta de novo sozinho em 30 s');

  function sessoesDaLinha() {
    const M = E.M, lista = [], vivo = !!cru();
    if (M.cC && !vivo) lista.push(M.cC);
    for (const s of M.sessoes) lista.push(s);
    if (M.cX) lista.push(M.cX);
    return lista;
  }
  function cartaoSessao(it, linhas, P) {
    const enc = MD.encaixe(filhosDe(it), { lido: it.agLido !== false });
    const fr = it.sessao ? MD.frenteDaSessao(it.sessao, it.nome, linhas) : null;
    const face = h('span', 'g-no-face'); try { face.append(P.identicon(it.id, P.sideColor(it.lado === 'codex' ? 'codex' : 'claude'), 3)); } catch (e) {  }
    const estado = it.precisa ? 'espera você' : ESTADO_T[it.estado] || '?';
    const cab = botao('ft-sess-cab', '', 'Abre o detalhe de ' + it.nome); cab.append(face, h('b', 'ft-sess-nome', it.nome), h('span', 'ft-selo is-' + (it.precisa ? 'precisa' : it.estado || 'sem'), estado));
    cab.addEventListener('click', () => E.G.abrir(it.id));
    const PT = root.PainelFluxoPartes, pls = PT && it.partes ? PT.linhas(h, it, 'ft', { extrasNaLinha: true }) : null, temPartes = !!(pls && pls.length), temQuem = temPartes && !!it.partes.quem;
    const cheios = h('div', 'ft-cheios');
    for (const c of enc.cheios) { const b = botao('ft-cheio', '', c.dica); b.append(h('i', 'ft-px is-aceso'), h('span', 'ft-cheio-n', c.nome)); b.dataset.lado = c.lado; b.addEventListener('click', () => E.G.abrir(c.id)); cheios.append(b); }
    if (enc.maisCheios > 0) cheios.append(h('span', 'ft-cheio-mais', '+' + enc.maisCheios + ' trabalhando (na tira)'));
    if (!enc.cheios.length && !temQuem) cheios.append(h('span', 'ft-cheio-mais', enc.total === null ? 'ajudantes: ?' : 'ninguém trabalhando agora'));
    const frente = h('div', 'ft-frente');
    if (fr) {
      const f = fr.frente, i = h('i', 'ft-barra-i'); i.style.setProperty('--ft-w', (f.barra === null ? 0 : f.barra) + '%');
      frente.append(h('span', 'ft-frente-n', f.nome + (fr.mais ? ' +' + fr.mais : '')), h('span', 'ft-barra' + (f.barra === null ? ' is-sem' : ''), i), h('span', 'ft-frente-t', [f.pctTexto, f.faltamTexto.replace(/^faltam /, ''), extra(f, 'medidoTexto')].filter(Boolean).join(' · ')), h('span', 'ft-selo is-' + f.selos.situacao.classe, f.selos.situacao.texto));
      frente.title = ['A mais urgente desta sessão: ' + f.nome, f.pctTexto, f.faltamTexto, extra(f, 'medidoTexto'), extra(f, 'causaTexto'), f.selos.situacao.texto, fr.mais ? 'mais ' + fr.mais + ' no Norte' : ''].filter(Boolean).join(' · ');
      marca(frente, 'salta', f.salta ? 1 : null);
    } else {
      frente.append(h('span', 'ft-frente-n is-sem', it.sessao ? 'Frente: ?' : 'Frente: não se aplica'));
      frente.title = it.sessao ? (E.norte && E.norte.ok ? 'Nenhuma frente do Norte é desta sessão agora' : 'Frentes sem leitura. ' + solucaoNorte()) : 'Este cartão junta conversas sem nome de sessão';
      if (it.sessao && E.norte && E.norte.ok) poe(frente.firstChild, 'Frente: nenhuma agora');
    }
    const t = h('div', 'ft-tira'); tira(t, enc, it.id);
    const frase = h('p', 'ft-sess-frase' + (temPartes ? ' is-partes' : ''), ...(temPartes ? pls : [it.frase || '?'])); if (temPartes) frase.title = it.partes.estado;
    const c = h('article', 'ft-sess', cab, frase, cheios, frente, t);
    c.dataset.id = it.id; c.dataset.estado = it.estado || ''; c.dataset.work = it.work ? '1' : '0'; c.dataset.lado = it.lado || 'claude'; if (it.sessao) c.dataset.sessao = it.sessao; if (it.precisa) c.dataset.precisa = '1';
    return c;
  }
  function pintarSessoes() {
    const P = E.P, todas = sessoesDaLinha(), linhas = linhasNorte();
    const cabem = rola() ? todas.length : Math.max(1, Math.floor((el.sessGrade.clientWidth || E.raiz.clientWidth || root.innerWidth) / LARGURA_SESSAO));
    const r = MD.sessoesQueCabem(todas, cabem);
    poe(el.sessMais, r.mais ? '+' + r.mais + (r.mais === 1 ? ' sessão parada fora da tela (veja no Organograma)' : ' sessões paradas fora da tela (veja no Organograma)') : '');
    const chave = r.visiveis.map(it => [it.id, it.nome, it.frase, it.estado, it.work, it.precisa, it.agLido, filhosDe(it).map(f => [f.id, f.estado, f.work, f.nome, f.frase])]);
    if (!muda('sess', [chave, linhas.map(l => [l.nome, l.barra, l.faltamTexto, l.selos.situacao.texto, l.salta, l.sessao, l.quem]), !!cru()])) return;
    el.sessGrade.style.setProperty('--ft-n', String(Math.max(1, r.visiveis.length)));
    el.sessGrade.replaceChildren(...r.visiveis.map(it => cartaoSessao(it, linhas, P)));
    E.sig.acesos = ''; acenderSessoes();
  }

  function listaDestinos(rotulo, lista, cls) {
    if (!lista.length) return null;
    const p = h('p', 'ft-mand-l ' + cls, h('span', 'ft-mand-r', rotulo));
    for (const d of lista) { const b = botao('ft-dest', d.nome + (d.semResposta ? ' · sem resposta' : ''), 'Filtra a fita crua por ' + d.nome); marca(b, 'sem', d.semResposta ? 1 : null); b.addEventListener('click', () => filtrarFita(d.chave, d.nome)); p.append(b); }
    return p;
  }
  function pintarVivo() {
    const r = cru(), v = r ? MD.aoVivo(r, Date.now() + (E.desloca || 0)) : null;
    if (el.vivo.hidden !== !v) { el.vivo.hidden = !v; el.fita.hidden = !v; E.sig.sess = ''; agendarMedida(); if (E.M) pintarSessoes(); }
    if (!v) { E.vivo = null; acenderSessoes(); return; }
    E.vivo = v;
    poe(el.voce.t, v.voce.titulo); poe(el.voceTxt, v.voce.texto); marca(el.voce.no, 'fila', v.voce.naFila ? 1 : null);
    poe(el.jEstado, v.coordenador.titulo); poe(el.jDet, v.coordenador.detalhe); poe(el.jConta, v.coordenador.conta); marca(el.coordenador.no, 'estado', v.coordenador.estado);
    marca(el.seta1, 'acesa', v.setas.ida ? 'ida' : null); marca(el.seta2, 'acesa', v.setas.mandou ? 'ida' : v.setas.volta ? 'volta' : null);
    if (muda('mandou', v.mandou)) el.mandou.corpo.replaceChildren(...[listaDestinos('Direção:', v.mandou.direcao, 'is-direcao'), listaDestinos('Dúvida:', v.mandou.duvida, 'is-duvida'), listaDestinos('Voltou:', v.mandou.voltou, 'is-voltou'), v.mandou.vazio ? h('p', 'ft-cx-s', v.mandou.vazio) : null].filter(Boolean));
    if (E.M && E.M.cC) { const enc = MD.encaixe(filhosDe(E.M.cC), { lido: E.M.cC.agLido !== false, maxTira: 16 }); if (muda('jtira', enc)) tira(el.jTira, enc, E.M.cC.id); }

    for (const [nome, x] of E.envios) if (x.estado === 'enviado' && MD.entregue(x.texto, x.ms, r.falas)) { x.estado = 'entregue'; x.entregueEm = Date.now(); E.sig.norte = ''; }
    acenderSessoes(); pintarFita();
  }
  function acenderSessoes() {
    const v = E.vivo, ida = new Set(v ? v.acesos : []), volta = new Set(v ? v.mandou.voltou.map(d => d.chave) : []), duvida = new Set(v ? v.mandou.duvida.filter(d => d.semResposta).map(d => d.chave) : []);
    for (const c of el.sessGrade.children) { const s = c.dataset.sessao || ''; marca(c, 'aceso', ida.has(s) ? 'ida' : volta.has(s) ? 'volta' : null); marca(c, 'duvida', duvida.has(s) ? 1 : null); }
    if (muda('acesos', [[...ida], [...volta], el.vivo.hidden])) agendarMedida();
  }
  function pintarFita() {
    let txt = '';
    const p = E.passo; if (p) txt = (root.PainelCru && root.PainelCru.hora ? root.PainelCru.hora(p.t) : hm(p.t)) + ' · ' + (PASSO_T[p.tipo] || String(p.tipo || '?')) + ' · ' + (p.destinoNome && (p.tipo === 'mandou' || p.tipo === 'voltou') ? (p.tipo === 'voltou' ? '← ' : '→ ') + p.destinoNome + ' · ' : '') + (p.resumo || (p.tipo === 'pensou' ? 'o app não guardou o texto deste pensamento' : '?'));
    else if (E.fitaNo) { let melhor = null, seq = -1; for (const li of E.fitaNo.querySelectorAll('.cru-passo')) { const s = Number(li.dataset.seq); if (s > seq) { seq = s; melhor = li; } } const t = melhor && melhor.querySelector('.cru-txt'); txt = t ? t.textContent.replace(/\s+/g, ' ').trim() : ''; }
    poe(el.fitaL, txt || 'nenhum passo lido ainda');
  }

  function pedirNorte(forcar) {
    if (E.nortePedido || (!forcar && E.norteEm && Date.now() - E.norteEm < 30000)) return;
    E.nortePedido = true;
    root.fetch('/api/pe-equipe/frentes-situacao' + SUF, { cache: 'no-store', redirect: 'error' }).then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(j => { E.norte = j && typeof j === 'object' && Array.isArray(j.frentes) ? j : { ok: false, frentes: [], motivo: 'resposta fora do formato', solucao: 'o painel tenta de novo sozinho em 30 s' }; })
      .catch(() => { E.norte = { ok: false, frentes: [], motivo: 'o painel não respondeu agora', solucao: 'o painel tenta de novo sozinho em 30 s' }; })
      .then(() => { E.nortePedido = false; E.norteEm = Date.now(); if (naTela()) { pintarNorte(); if (E.M) pintarSessoes(); } });
  }
  async function agir(acao, nome, nomeNeutro) {
    if(!root.confirm('Registrar este pedido para sua equipe?'))return;
    const x = { acao, estado: 'enviando', ms: Date.now(), hora: '', texto: '', erro: '' }; E.envios.set(nome, x); E.sig.norte = ''; pintarNorte();
    try {
      const r = await root.fetch('/api/fluxo-tela/fala', { method: 'POST', cache: 'no-store', redirect: 'error', headers: { 'Content-Type': 'application/json', 'X-R10-Token': root.PainelRecursos?.token||'' }, body: JSON.stringify({ acao, frente: nomeNeutro, confirmado: true }) });
      let j = null; try { j = await r.json(); } catch (e) { j = null; }
      if (r.status === 200 && j && j.ok) { x.estado = 'enviado'; x.ms = Date.parse(j.ts) || Date.now(); x.hora = hm(j.ts); x.texto = String(j.texto || ''); }
      else { x.estado = 'erro'; x.erro = r.status === 429 ? 'Espere 2 segundos e clique de novo.' : (j && j.error) || 'A fala não foi gravada. Solução: tente de novo ou fale com o seu Claude pelo chat.'; }
    } catch (e) { x.estado = 'erro'; x.erro = 'O painel não respondeu. Solução: confira se o painel está aberto e tente de novo.'; }
    E.sig.norte = ''; pintarNorte();
  }
  const textoEnvio = x => (x.estado === 'enviando' ? 'gravando...' : x.estado === 'erro' ? '? ' + x.erro : (x.acao === 'prioridade' ? 'prioridade pedida' : 'solução pedida') + ' · ' + (x.estado === 'entregue' ? 'entregue ao seu Claude' + (x.entregueEm ? ' ' + hm(x.entregueEm) : '') : 'enviado ' + x.hora + (cru() ? ' · seu Claude ainda não leu' : '')));

  const extra = (x, nome) => (x && typeof x[nome] === 'function' ? x[nome](/^en/.test(html.lang || '') ? 'en' : /^es/.test(html.lang || '') ? 'es' : 'pt') : '');
  function linhaNorte(l) {
    const agir_ = podeAgir() && !l.semNome && !l.pendente, aberta = E.aberta === l.nome, env = E.envios.get(l.nome) || null;
    const i = h('i', 'ft-barra-i'); i.style.setProperty('--ft-w', (l.barra === null ? 0 : l.barra) + '%');
    const selos = h('span', 'ft-nl-selos', h('span', 'ft-selo is-' + l.selos.situacao.classe, l.selos.situacao.texto), l.selos.foco ? h('span', 'ft-selo is-foco-alta', l.selos.foco.texto) : null, env ? h('span', 'ft-selo is-envio is-' + env.estado, textoEnvio(env)) : null);
    if (l.selos.situacao.solucao) selos.firstChild.title = 'Situação sem leitura. Solução: ' + l.selos.situacao.solucao;
    const foco = h('span', 'ft-nl-foco', Number.isInteger(l.foco) ? 'F' + l.foco : 'F?'); if (Number.isInteger(l.foco)) foco.dataset.foco = String(l.foco);
    const corpo = [h('span', 'ft-nl-pos', String(l.pos)), foco, h('span', 'ft-nl-nome', l.nome), h('span', 'ft-barra' + (l.barra === null ? ' is-sem' : ''), i), h('span', 'ft-nl-pct', l.pctTexto), h('span', 'ft-nl-falta', [l.faltamTexto, extra(l, 'medidoTexto')].filter(Boolean).join(' · ')), selos];
    const li = h('li', 'ft-nl'); marca(li, 'salta', l.salta ? 1 : null); marca(li, 'sit', l.selos.situacao.classe); marca(li, 'aberta', aberta ? 1 : null);
    const dica = [l.nome, l.focoTexto, typeof l.sessao === 'string' && l.sessao ? 'sessão ' + l.sessao : '', l.pctTexto, l.faltamTexto, extra(l, 'medidoTexto'), extra(l, 'causaTexto'), l.selos.situacao.texto].filter(Boolean).join(' · ');
    if (l.grupo) { const g = botao('ft-nl-b', '', dica + ' · clique para ver as frentes desta sessão'); g.append(...corpo); g.addEventListener('click', () => abrirNorte(l.sessao || '')); li.append(g); marca(li, 'grupo', 1); return li; }
    if (agir_) {
      const b = botao('ft-nl-b', '', dica + ' · clique para agir'); b.setAttribute('aria-expanded', String(aberta)); b.append(...corpo);
      b.addEventListener('click', () => { E.aberta = aberta ? null : l.nome; E.sig.norte = ''; pintarNorte(); });
      li.append(b);
      if (aberta) {
        const acoes = h('span', 'ft-nl-acoes');
        for (const k of Object.keys(MD.ACOES)) { const a = botao('ft-acao is-' + k, MD.ACOES[k].rotulo, MD.ACOES[k].dica + '. Não fala com sessão nenhuma'); a.disabled = !!env && env.estado === 'enviando'; a.addEventListener('click', () => agir(k, l.nome, l.nomeNeutro || l.nome)); acoes.append(a); }
        const x = botao('ft-acao is-fechar', 'Fechar', 'Fecha as ações desta frente'); x.addEventListener('click', () => { E.aberta = null; E.sig.norte = ''; pintarNorte(); }); acoes.append(x);
        if (env) acoes.append(h('span', 'ft-selo is-envio is-' + env.estado, textoEnvio(env)));
        li.append(acoes);
      }
    } else { const d = h('div', 'ft-nl-b is-parada', ...corpo); d.title = dica + ((l.semNome || l.pendente) && podeAgir() ? ' · frente sem nome neutro: para agir, fale com seu Claude pelo chat' : ''); li.append(d); }
    return li;
  }
  const sigEnvios = () => [...E.envios].map(([k, x]) => [k, x.estado, x.hora, x.erro]);
  function abrirNorte(chave) {
    if (E.gaveta === 'norte' && E.gavSessao === chave) return fecharGaveta();
    E.gavSessao = chave; if (E.gaveta !== 'norte') abrirGaveta('norte');
    E.sig.gnorte = ''; pintarGavetaNorte();
  }

  function pintarGavetaNorte() {
    if (E.gaveta !== 'norte') return;
    const N = norteAgora({ max: 0, agrupar: !podeAgir() }), s = N && E.gavSessao !== null ? N.sessoes.find(x => x.chave === E.gavSessao) : null;
    poe(el.gavT, E.gavSessao === null ? 'Todas as frentes' : 'Frentes · ' + (s ? s.nome : '?'));
    const linhas = N ? MD.daSessao(N.todas, E.gavSessao) : [];
    if (!muda('gnorte', [linhas, E.gavSessao, E.aberta, podeAgir(), sigEnvios(), !!cru()])) return;
    const topo = el.gavCorpo.scrollTop;
    el.gavCorpo.replaceChildren(...[s ? h('p', 'ft-q', s.texto) : null, linhas.length ? h('ol', 'ft-norte-lista is-gaveta', ...linhas.map(linhaNorte)) : h('p', 'ft-q', N ? 'none: nenhuma frente nesta leitura' : '? frentes sem leitura. ' + solucaoNorte())].filter(Boolean));
    el.gavCorpo.scrollTop = topo;
  }
  let voltasNorte = 0;
  function pintarNorte() {
    const n = E.norte;

    let colunas = 1, max = MD.MAX_NORTE;
    if (!rola()) {
      const cab = el.norte.firstElementChild, usado = (cab ? cab.offsetHeight + 4 : 22) + (el.norteQ.hidden ? 0 : el.norteQ.offsetHeight + 10) + (E.altSess || 26) + 8;
      const porColuna = Math.max(0, Math.floor((el.norte.clientHeight - usado) / LINHA_NORTE));
      if (porColuna < MD.MAX_NORTE && E.raiz.clientWidth >= 1100) colunas = 2;
      max = Math.max(1, Math.min(MD.MAX_NORTE, porColuna * colunas));
    }
    E.maxNorte = max;
    const N = norteAgora(), vis = N ? N.linhas : [];
    poe(el.norteLido, !n ? 'lendo...' : n.ok ? [MD.resumoNorte(n.resumo), 'lido ' + hm(n.atualizado), podeAgir() ? 'clique numa frente para agir' : ''].filter(Boolean).join(' · ') : '');
    poe(el.norteFocos, n && n.ok && Array.isArray(n.ordemFoco) ? n.ordemFoco.filter(o => o && Number.isInteger(o.posicao) && typeof o.foco === 'string').map(o => 'F' + o.posicao + ' ' + o.foco).join(' · ') : '');
    const semLeitura = !!n && !n.ok, vazio = !!N && !N.todas.length;
    el.norteQ.hidden = !(semLeitura || vazio);
    if (semLeitura) poe(el.norteQ, '? ' + (n.motivo || 'frentes sem leitura') + '. ' + solucaoNorte() + '.');
    else if (vazio) poe(el.norteQ, 'none: nenhuma frente em voo nesta leitura');
    if (muda('norte', [vis, colunas, N && N.sessoes, N && N.fora, E.aberta, podeAgir(), sigEnvios(), !!cru()])) {
      el.norteLista.style.setProperty('--ft-cols', String(colunas)); el.norteLista.style.setProperty('--ft-linhas', String(Math.max(1, Math.ceil(vis.length / colunas))));
      el.norteLista.replaceChildren(...vis.map(linhaNorte)); el.norteLista.hidden = !vis.length;
      const kids = (N ? N.sessoes : []).map(x => { const b = botao('ft-chip ft-ns' + (x.atrasadas ? ' is-trava' : ''), x.texto, 'Abre as frentes da sessão ao lado, sem rolar a página'); b.addEventListener('click', () => abrirNorte(x.chave)); return b; });
      if (N && N.total) { const b = botao('ft-chip ft-ns-todas', (N.fora > 0 ? '+' + N.fora + ' fora da tela · ' : '') + 'ver todas as ' + N.total, 'Abre a lista inteira ao lado, sem rolar a página'); b.addEventListener('click', () => abrirNorte(null)); kids.push(b); }
      el.norteSess.replaceChildren(...kids);
    }

    const hs = el.norteSess.offsetHeight || 0;
    if (hs && hs !== E.altSess && !rola() && voltasNorte < 2) { E.altSess = hs; voltasNorte++; pintarNorte(); voltasNorte = 0; return; }
    pintarGavetaNorte();
  }

  function pintarFila() {
    const F = root.PainelFusaoFluxo && typeof root.PainelFusaoFluxo.leitura === 'function' ? root.PainelFusaoFluxo.leitura() : null, en = doc.getElementById('en-agora');
    const dep = en ? en.querySelectorAll('.en-col.is-voce .en-mini').length : null, OP = root.PainelObraPixel;
    const projetos = F && F.obra && Array.isArray(F.obra.projects) ? F.obra.projects.map(p => { let t = null; try { t = OP && typeof OP.tally === 'function' ? OP.tally(p) : null; } catch (e) { t = null; } return MD.chipProjeto(p.name, t); }) : null;
    const r = F && F.resumo, c = F && F.consumo && Array.isArray(F.consumo.linhas) ? F.consumo.linhas.find(l => l.daVez) : null, f = F && F.fechadas;
    const cheia = telaCheia(), modelo = { dep, r: r ? [r.espera.valor, r.travou.valor, r.anda.valor] : null, c: c ? [c.nome, c.pct] : null, f: f ? f.texto : null, projetos, cheia, dono: html.classList.contains('fz-dono') };
    if (!muda('fila', modelo)) return;
    const chip = (texto, gaveta, dica, cls) => { const b = botao('ft-chip' + (cls ? ' ' + cls : ''), texto, dica); b.addEventListener('click', () => abrirGaveta(gaveta)); return b; };
    const kids = [chip(MD.chipDependem(dep), 'lado', dep === null ? 'As entregas ainda não chegaram. Solução: o painel relê sozinho a cada 15 s' : 'Abre as entregas e o que depende de você', dep ? 'is-voce' : '')];
    if (r) kids.push(chip('Espera você: ' + r.espera.valor, 'topo', r.espera.texto, r.espera.classe === 'n' ? 'is-voce' : ''), chip('Travou: ' + r.travou.valor, 'topo', r.travou.texto, r.travou.classe === 'n' ? 'is-trava' : ''), chip('Anda: ' + r.anda.valor, 'topo', r.anda.texto));
    else kids.push(chip('Resumo: ?', 'topo', 'Resumo sem leitura. Solução: o painel relê sozinho a cada 15 s'));
    kids.push(chip('Fechadas hoje: ' + (f ? f.texto : 'sem histórico'), 'topo', f && f.vs ? f.vs : 'A contagem lê o histórico (git) da pasta de estado. Solução: com git na pasta, o painel relê a cada 2 min'));
    kids.push(chip('Consumo: ' + (c ? c.nome + ' ' + (c.pct === null ? '?' : c.pct + '%') : '?'), 'topo', c ? 'A conta em uso. Abre o consumo de todas' : 'Consumo sem leitura. Solução: o painel relê o uso a cada 60 s'));
    if (projetos === null) kids.push(chip('Projetos: ?', 'lado', 'Projetos sem leitura. Solução: o painel relê sozinho a cada 15 s'));
    else if (!projetos.length) kids.push(chip('Projetos: none', 'lado', 'Nenhum projeto nesta leitura'));
    else { for (const p of projetos.slice(0, 6)) kids.push(chip(p, 'lado', 'Quanto do projeto já está no ar. Abre os projetos')); if (projetos.length > 6) kids.push(chip('+' + (projetos.length - 6) + ' projetos', 'lado', 'Abre todos os projetos')); }
    el.chips.replaceChildren(...kids);
    const org = botao('ft-chip', 'Organograma', 'Volta para o desenho em árvore (quem manda em quem)'); org.addEventListener('click', () => modo('organograma'));
    const st = h('a', 'ft-chip ft-chip-link', cheia ? 'Sair da tela cheia' : 'Segunda tela'); st.href = cheia ? '#g=equipe.fluxo' : '#g=equipe.fluxo&tela=cheia'; st.title = cheia ? 'Volta para o painel com menu' : 'Abre só o Fluxo, sem menu, numa janela nova para deixar na segunda tela'; if (!cheia) { st.target = '_blank'; st.rel = 'noopener'; }
    const acel = doc.getElementById('fz-acao'); if (acel && acel.parentNode !== el.acoes) el.acoes.prepend(acel);
    for (const x of Array.from(el.acoes.children)) if (x !== acel) x.remove();
    el.acoes.append(org, st);
  }

  let medidaMarcada = false;
  function agendarMedida() { if (medidaMarcada) return; medidaMarcada = true; (root.requestAnimationFrame || root.setTimeout)(() => { medidaMarcada = false; medir(); }); }
  function medir() {
    if (!E.raiz || !E.raiz.isConnected || html.dataset.ft !== 'tela') return;
    const livre = rola(); marca(E.raiz, 'rola', livre ? 1 : null);
    if (livre) html.style.removeProperty('--ft-h');
    else {
      const alvo = doc.getElementById('fz-fusao') || E.raiz, topo = alvo.getBoundingClientRect().top + (root.scrollY || 0), dock = doc.getElementById('g-dock');
      const pe = dock && root.getComputedStyle(dock).display !== 'none' ? dock.offsetHeight : 0;
      const alt = Math.max(420, Math.floor(root.innerHeight - topo - pe - 8)); html.style.setProperty('--ft-h', alt + 'px');

      const sobra = html.scrollHeight - root.innerHeight; if (sobra > 0 && sobra < 240 && alt - sobra >= 420) html.style.setProperty('--ft-h', (alt - sobra) + 'px');
    }
    if (E.M) { const cabem = Math.floor((el.sessGrade.clientWidth || 0) / LARGURA_SESSAO); if (cabem !== E.cabemSess) { E.cabemSess = cabem; pintarSessoes(); } }
    const alt = el.norte.clientHeight + 'x' + el.norte.clientWidth; if (alt !== E.cabemNorte) { E.cabemNorte = alt; pintarNorte(); }
    fios();
  }
  function fios() {
    const svg = el.fios; if (el.vivo.hidden || rola() || !el.sessGrade.children.length) { svg.replaceChildren(); return; }
    const base = E.raiz.getBoundingClientRect(), j = el.coordenador.no.getBoundingClientRect(), W = Math.round(base.width), H = Math.round(base.height);
    svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    const px = v => Math.round(v) + 0.5, x0 = px(j.left + j.width / 2 - base.left), y0 = Math.round(j.bottom - base.top), kids = [], topoGrade = el.sessGrade.getBoundingClientRect().top - base.top;
    for (const c of el.sessGrade.children) {
      const r = c.getBoundingClientRect(), x1 = px(r.left + r.width / 2 - base.left), y1 = Math.round(r.top - base.top), meio = px(Math.max(y0 + 2, topoGrade - 6));
      const p = doc.createElementNS(SVGNS, 'path'); p.setAttribute('d', 'M' + x0 + ' ' + y0 + ' V' + meio + ' H' + x1 + ' V' + y1); p.setAttribute('class', 'ft-fio'); if (c.dataset.aceso) p.dataset.aceso = c.dataset.aceso; if (c.dataset.duvida) p.dataset.duvida = '1';
      kids.push(p);
    }
    kids.sort((a, b) => (a.dataset.aceso ? 1 : 0) - (b.dataset.aceso ? 1 : 0)); svg.replaceChildren(...kids);
  }

  function ativa() { return telaCheia(); }
  function modo(m) { if (m === 'organograma' && telaCheia()) root.location.hash = '#g=equipe.fluxo'; }
  function sair() {
    if (html.dataset.ft === undefined) return;
    delete html.dataset.ft; marca(html, 'ftGaveta', null); html.style.removeProperty('--ft-h'); E.gaveta = null; E.sig = {};
    const acel = doc.getElementById('fz-acao'), sec = doc.getElementById('fz-fusao'); if (acel && sec && acel.parentNode !== sec) sec.prepend(acel);
    if (E.fitaNo && el.guarda) el.guarda.append(E.fitaNo);
  }
  function pintar(box, P, M, G) {
    E.P = P; E.M = M; E.G = G;
    montar(box);
    if (html.dataset.ft !== 'tela') { html.dataset.ft = 'tela'; E.sig = {}; }
    marca(html, 'ftCheia', telaCheia() ? 1 : null);
    pedirNorte(false);
    pintarVivo(); pintarSessoes(); pintarNorte(); pintarFila(); pintarDetalhe();
    agendarMedida();
  }

  function acordar() {
    if (E.P || html.dataset.gNew !== 'fluxo' || !ativa()) return;
    const V = root.PainelFluxoV; if (V && typeof V.forcar === 'function') { try { V.forcar(null); } catch (e) {  } }
  }
  function acertar() {
    if (html.dataset.gNew !== 'fluxo') return;
    const quer = ativa(), tem = html.dataset.ft === 'tela';
    if (quer === tem) return;
    if (!quer) sair();
    if (E.P) E.P.repintar(); else acordar();
  }
  function tique() {
    acordar(); acertar();
    marca(html, 'ftCheia', telaCheia() ? 1 : null);
    if (!naTela()) return;
    pintarVivo(); pintarFila(); pedirNorte(false);
    if (muda('dono', podeAgir())) { E.sig.norte = ''; pintarNorte(); }
  }
  root.addEventListener('painel-cru', ev => { const d = ev && ev.detail; if (d && Array.isArray(d.novos) && d.novos.length) E.passo = d.novos[d.novos.length - 1]; if (naTela()) root.setTimeout(pintarVivo, 0); });
  root.addEventListener('hashchange', () => { marca(html, 'ftCheia', telaCheia() ? 1 : null); E.sig.fila = ''; acertar(); agendarMedida(); });
  root.addEventListener('resize', agendarMedida);
  doc.addEventListener('keydown', ev => { if (ev.key === 'Escape' && E.gaveta && E.gaveta !== 'det' && naTela()) fecharGaveta(); });
  root.setInterval(tique, 1000);
  marca(html, 'ftCheia', telaCheia() ? 1 : null);

  root.PainelFluxoTela = Object.freeze({ ativa, modo, pintar, sair, estado: () => ({ modo: telaCheia() ? 'tela' : 'organograma', gaveta: E.gaveta, norte: E.norte ? { ok: E.norte.ok, n: (E.norte.frentes || []).length } : null, cheia: telaCheia(), podeAgir: podeAgir() }) });
  acordar();
})(window);
