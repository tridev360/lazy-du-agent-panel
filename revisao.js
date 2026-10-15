'use strict';






(function (root) {
  const SOLUCAO = 'peça à COORDENADOR para reiniciar o painel';
  const T = {
    lendo: 'Lendo a revisão…', exemplo: 'No exemplo a revisão fica desligada: ela só mostra dado real.', semLeitura: 'Revisão sem leitura agora.', solucao: 'Solução: ',
    semLista: 'A lista das sessões não foi lida: abaixo só os cards.', listaRuim: 'A lista das sessões está com defeito: abaixo só os cards.', semCards: 'Os cards não foram lidos.',
    regra: ['Você orienta, escolhe e limita. ', 'Cada clique só anota o seu recado: a COORDENADOR lê e encaminha. ', 'Nada roda nem sobe daqui.'],
    todos: 'Tudo', nada: 'nada para revisar aqui agora', lido: 'lido ', listaDe: 'lista de ',
    mudou: 'Mudou: ', espera: 'Espera você: ', antes: 'ANTES', depois: 'DEPOIS', falta: 'mídia não encontrada', critico: 'Nota do crítico', eixo: 'Eixo', lerTexto: 'Texto pronto',
    aprovo: 'Aprovo', refazer: 'Refazer', depoisBtn: 'Depois', acho: 'o que eu acho', opiniao: 'Pedir opinião', marcar: 'marcar para perguntar junto',
    confirmar: 'Confirmar', cancelar: 'Cancelar', teclas: 'Enter confirma · Esc cancela', desfazer: 'Desfazer', feito: 'feito: ', voce: 'Você: ', mostrar: 'mostrar', esconder: 'esconder',
    recomendada: 'recomendada', perigo: 'Este se responde na tela de escolha da COORDENADOR.', trazer: 'Trazer ao chat', reservado: 'detalhe no chat da sessão',
    paraQuem: 'Perguntar para', oQue: 'O que perguntar', livre: 'ou escreva a sua pergunta', perguntar: 'Perguntar', esperando: '? esperando resposta de ', respondeu: ' respondeu', perguntou: 'você perguntou: ',
    marcados: n => n + (n === 1 ? ' marcado' : ' marcados'), cards: n => (n === 1 ? '1 card à espera da sua escolha' : n + ' cards à espera da sua escolha'), oQueFaz: 'o que cada opção faz', pedirMarcados: 'Pedir opinião sobre os marcados', limpar: 'Limpar',
    naoGravou: 'Não gravou. Tente de novo.', naoGravouLeitura: 'Não gravou: esta cópia do painel é só leitura.', verTudo: 'Ver tudo', verMenos: 'Ver menos'
  };
  const SELO = { olho: 'Seu olho', sim: 'Seu sim', pronto: 'Pronto', 'nao-passou': 'Não passou', COORDENADOR: 'Na COORDENADOR' };
  const PERGUNTA = { aprovo: 'Aprovo?', refazer: 'Refazer?', depois: 'Deixar para depois?', 'trazer-card': 'Trazer este card ao chat?' };
  const FEITO = { aprovo: 'Aprovo', refazer: 'Refazer', depois: 'Depois', acho: 'anotado', 'trazer-card': 'pedido de trazer ao chat', opiniao: 'pergunta enviada' };
  const DECISAO = ['aprovo', 'refazer', 'opcao', 'trazer-card'];
  function el(doc, tag, cls, text) { const n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = String(text); return n; }
  function botao(doc, cls, text) { const b = el(doc, 'button', cls, text); b.type = 'button'; return b; }

  const CORTE = 200, FOLGA = 20;
  function cortar(texto) {
    const s = String(texto); if (s.length <= CORTE + FOLGA) return null;
    let fim = s.lastIndexOf(' ', CORTE); if (fim < CORTE - 60) fim = CORTE;
    return s.slice(0, fim).replace(/[\s,;:.]+$/, '') + '…';
  }
  function longoNo(doc, tag, cls, texto) {
    const no = el(doc, tag, cls), curto = cortar(texto);
    if (curto === null) { no.textContent = String(texto); return no; }
    const t = el(doc, 'span', 'rv-longo-txt', curto), b = botao(doc, 'rv-ver-tudo', T.verTudo); let aberto = false;
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', () => { aberto = !aberto; t.textContent = aberto ? String(texto) : curto; b.textContent = aberto ? T.verMenos : T.verTudo; b.setAttribute('aria-expanded', String(aberto)); });
    no.append(t, b); return no;
  }
  const dois = n => String(n).padStart(2, '0');
  function hora(iso) { const d = new Date(iso); return Number.isFinite(d.getTime()) ? dois(d.getHours()) + ':' + dois(d.getMinutes()) : '?'; }
  function diaHora(iso) { const d = new Date(iso); return Number.isFinite(d.getTime()) ? dois(d.getDate()) + '/' + dois(d.getMonth() + 1) + ' ' + dois(d.getHours()) + ':' + dois(d.getMinutes()) : '?'; }
  const bom = p => !!p && p.ok === true && Array.isArray(p.grupos);
  const estadoDe = item => (item.voce && DECISAO.includes(item.voce.acao) ? 'feito' : item.voce && item.voce.acao === 'depois' ? 'depois' : 'aberto');
  const sigCorpo = item => JSON.stringify({ ...item, voce: null, opinioes: null });
  function rotuloVoce(item) {
    const v = item.voce; if (!v) return '';
    let r = FEITO[v.acao] || v.acao;
    if (v.acao === 'opcao') r = (v.opcao && v.opcao.label) || '?';
    if (v.acao === 'acho') r = '';
    return T.voce + [r, v.texto ? '"' + v.texto + '"' : '', hora(v.quando)].filter(Boolean).join(' · ');
  }

  function midiaNo(doc, m, rotulo) {
    const fig = el(doc, 'figure', rotulo ? 'rv-lado is-' + rotulo.toLowerCase() : 'rv-solta');
    if (rotulo) fig.append(el(doc, 'span', 'rv-lado-rot', rotulo));
    if (!m || m.falta) fig.append(el(doc, 'p', 'rv-falta', '? ' + T.falta));
    else if (m.tipo === 'video') {
      const v = el(doc, 'video', 'rv-video'); v.setAttribute('controls', ''); v.setAttribute('playsinline', ''); v.setAttribute('preload', m.poster ? 'none' : 'metadata');
      if (m.poster) v.setAttribute('poster', m.poster); v.setAttribute('src', m.src); fig.append(v);
    } else { const i = el(doc, 'img', 'rv-img'); i.setAttribute('loading', 'lazy'); i.setAttribute('alt', m.legenda || ''); i.setAttribute('src', m.src); fig.append(i); }
    if (m && m.legenda) fig.append(el(doc, 'figcaption', 'rv-leg', m.legenda));
    return fig;
  }
  function criticoNo(doc, c) {
    const box = el(doc, 'div', 'rv-critico'), t = el(doc, 'h4', 'rv-sub', T.critico), tab = el(doc, 'table', 'rv-notas'), cab = el(doc, 'tr');
    if (c.quem) t.append(el(doc, 'span', 'rv-sub-quem', c.quem));
    cab.append(el(doc, 'th', null, T.eixo), el(doc, 'th', null, c.colunas[0]), el(doc, 'th', null, c.colunas[1])); tab.append(cab);
    for (const n of c.notas) {
      const tr = el(doc, 'tr'), a = Number(String(n[1]).replace(',', '.')), b = Number(String(n[2]).replace(',', '.')), fim = el(doc, 'td', 'rv-nota', n[2] === null ? '?' : n[2]);
      if (Number.isFinite(a) && Number.isFinite(b) && a !== b) fim.dataset.delta = b > a ? 'sobe' : 'desce';
      tr.append(el(doc, 'td', 'rv-eixo', n[0]), el(doc, 'td', 'rv-nota', n[1]), fim); tab.append(tr);
    }
    box.append(t, tab); if (c.obs) box.append(el(doc, 'p', 'rv-obs', c.obs));
    return box;
  }
  function textoNo(doc, t) {
    const d = el(doc, 'details', 'rv-texto'), s = el(doc, 'summary', 'rv-texto-t', t.titulo || T.lerTexto), dentro = el(doc, 'div', 'rv-texto-corpo');
    if (t.texto.length <= 700) d.setAttribute('open', '');
    if (t.imagem) dentro.append(midiaNo(doc, t.imagem, null));
    const lado = el(doc, 'div', 'rv-texto-lado'); lado.append(el(doc, 'pre', 'rv-pre', t.texto)); if (t.legenda) lado.append(el(doc, 'p', 'rv-leg', t.legenda));
    dentro.append(lado); d.append(s, dentro); return d;
  }
  function cardNo(doc, item, card, cb) {
    const sec = el(doc, 'section', 'rv-card'), ol = el(doc, 'ol', 'rv-opcoes'), mais = el(doc, 'details', 'rv-card-mais'), maisLista = el(doc, 'ul', 'rv-card-mais-lista'); sec.dataset.card = card.id; sec.dataset.perigoso = String(!!card.perigoso);
    let comDescricao = 0;
    if (item.tipo !== 'card') sec.append(longoNo(doc, 'p', 'rv-card-pergunta', card.pergunta)); // no card sem entrega a pergunta ja e o titulo
    for (const o of card.opcoes) {
      const li = el(doc, 'li', card.perigoso ? 'rv-opcao-lida' : 'rv-opcao-li');
      if (card.perigoso) { li.append(el(doc, 'b', 'rv-opcao-rot', o.label)); if (o.descricao) li.append(el(doc, 'span', 'rv-opcao-desc', o.descricao)); }
      else {
        const b = botao(doc, 'rv-opcao'); b.append(el(doc, 'span', 'rv-opcao-rot', o.label)); if (o.recomendada) b.append(el(doc, 'span', 'rv-rec', T.recomendada));
        if (o.descricao) { b.title = o.descricao; comDescricao++; const linha = el(doc, 'li', 'rv-card-mais-li'); linha.append(el(doc, 'b', null, o.label + ': '), el(doc, 'span', 'rv-opcao-desc', o.descricao)); maisLista.append(linha); }
        b.addEventListener('click', () => cb.armar(item.id, 'opcao', { card: card.id, opcao: o.indice, label: o.label }));
        li.append(b);
      }
      ol.append(li);
    }
    sec.append(ol);
    if (comDescricao) { mais.append(el(doc, 'summary', 'rv-card-mais-t', T.oQueFaz), maisLista); sec.append(mais); }
    if (card.perigoso) {
      const p = el(doc, 'p', 'rv-perigo', T.perigo), b = botao(doc, 'rv-trazer', T.trazer);
      b.addEventListener('click', () => cb.armar(item.id, 'trazer-card', { card: card.id }));
      sec.append(p, b);
    }
    return sec;
  }
  function pedirNo(doc, payload, estado, cb) {
    const destinos = el(doc, 'div', 'rv-destinos'), perguntas = el(doc, 'div', 'rv-perguntas'), livre = el(doc, 'input', 'rv-livre'), fim = el(doc, 'div', 'rv-pedir-fim');
    const bd = [], bq = [], pinta = () => { bd.forEach((b, i) => b.setAttribute('aria-pressed', String(i === estado.destino))); bq.forEach((b, i) => b.setAttribute('aria-pressed', String(i === estado.pergunta))); };
    (payload.destinos || []).forEach((d, i) => { const b = botao(doc, 'rv-destino', d); b.addEventListener('click', () => { estado.destino = i; pinta(); }); bd.push(b); destinos.append(b); });
    (payload.perguntas || []).forEach((q, i) => { const b = botao(doc, 'rv-pergunta', q); b.addEventListener('click', () => { estado.pergunta = i; pinta(); }); bq.push(b); perguntas.append(b); });
    livre.setAttribute('type', 'text'); livre.setAttribute('maxlength', '300'); livre.setAttribute('placeholder', T.livre); livre.setAttribute('aria-label', T.livre); livre.setAttribute('autocomplete', 'off'); livre.value = '';
    const enviar = botao(doc, 'rv-enviar', T.perguntar), fechar = botao(doc, 'rv-fechar', T.cancelar);
    enviar.addEventListener('click', () => cb.enviar()); fechar.addEventListener('click', () => cb.fechar());
    fim.append(enviar, fechar, el(doc, 'span', 'rv-teclas', T.teclas)); pinta();
    return { partes: [el(doc, 'span', 'rv-pedir-rot', T.paraQuem), destinos, el(doc, 'span', 'rv-pedir-rot', T.oQue), perguntas, livre, fim], livre };
  }
  function itemNo(doc, item, cb) {
    const li = el(doc, 'article', 'rv-item'), cab = el(doc, 'div', 'rv-cab'), corpo = el(doc, 'div', 'rv-corpo'), pe = el(doc, 'div', 'rv-pe');
    li.dataset.id = item.id; li.dataset.tipo = item.tipo; if (item.reservado) li.dataset.reservado = 'true';
    const rot = el(doc, 'label', 'rv-marca-rot'), marcar = el(doc, 'input', 'rv-marcar'); marcar.type = 'checkbox'; marcar.setAttribute('aria-label', T.marcar); marcar.title = T.marcar; rot.append(marcar);
    cab.append(rot); if (item.selo && SELO[item.selo]) { const s = el(doc, 'span', 'rv-selo', SELO[item.selo]); s.dataset.selo = item.selo; cab.append(s); }
    cab.append(longoNo(doc, 'h3', 'rv-titulo', item.titulo), el(doc, 'span', 'rv-sessao', item.sessao));
    if (item.mudou) { const p = el(doc, 'p', 'rv-mudou'); p.append(el(doc, 'b', null, T.mudou), el(doc, 'span', null, item.mudou)); corpo.append(p); }
    for (const par of item.pares) {
      const box = el(doc, 'div', 'rv-par'); box.dataset.formato = par.formato;
      if (par.rotulo) box.append(el(doc, 'h4', 'rv-sub', par.rotulo));
      const lados = el(doc, 'div', 'rv-lados'); lados.append(midiaNo(doc, par.antes, T.antes), midiaNo(doc, par.depois, T.depois)); box.append(lados); corpo.append(box);
    }
    if (item.midia.length) { const box = el(doc, 'div', 'rv-soltas'); for (const m of item.midia) box.append(midiaNo(doc, m, null)); corpo.append(box); }
    if (item.critico) corpo.append(criticoNo(doc, item.critico));
    if (item.textos.length) { const box = el(doc, 'div', 'rv-textos'); for (const t of item.textos) box.append(textoNo(doc, t)); corpo.append(box); }
    for (const c of item.cards) corpo.append(cardNo(doc, item, c, cb));
    if (item.reservado) corpo.append(el(doc, 'p', 'rv-reservado', item.espera || T.reservado)); // o servidor diz por que a linha esta fechada
    else if (item.espera) { const p = el(doc, 'p', 'rv-espera'); p.append(el(doc, 'b', null, T.espera), el(doc, 'span', null, item.espera)); corpo.append(p); }

    const acoes = el(doc, 'div', 'rv-acoes'), soCard = item.tipo === 'card', perigoso = soCard && item.cards.some(c => c.perigoso);
    let acho = null;
    if (!soCard) for (const [acao, cls, rotulo] of [['aprovo', 'rv-aprovo', T.aprovo], ['refazer', 'rv-refazer', T.refazer]]) { const b = botao(doc, cls, rotulo); b.addEventListener('click', () => cb.armar(item.id, acao)); acoes.append(b); }
    const dep = botao(doc, 'rv-depois', T.depoisBtn); dep.addEventListener('click', () => cb.armar(item.id, 'depois')); acoes.append(dep);
    if (soCard && item.reservado) { const b = botao(doc, 'rv-trazer', T.trazer); b.addEventListener('click', () => cb.armar(item.id, 'trazer-card', {})); acoes.append(b); }
    if (!perigoso && !(soCard && item.reservado)) { acho = el(doc, 'input', 'rv-acho'); acho.setAttribute('type', 'text'); acho.setAttribute('maxlength', '500'); acho.setAttribute('placeholder', T.acho); acho.setAttribute('aria-label', T.acho); acho.setAttribute('autocomplete', 'off'); acho.value = ''; acoes.append(acho); }
    const op = botao(doc, 'rv-opiniao', T.opiniao); op.addEventListener('click', () => cb.abrirPedir(item.id)); acoes.append(op);
    const confirma = el(doc, 'div', 'rv-confirma'), q = el(doc, 'span', 'rv-confirma-q'), sim = botao(doc, 'rv-sim', T.confirmar), nao = botao(doc, 'rv-nao', T.cancelar);
    confirma.setAttribute('role', 'group'); confirma.hidden = true; sim.addEventListener('click', () => cb.confirmar(item.id)); nao.addEventListener('click', () => cb.desarmar(item.id));
    confirma.append(q, sim, nao, el(doc, 'span', 'rv-teclas', T.teclas));
    const pedir = el(doc, 'div', 'rv-pedir'); pedir.setAttribute('role', 'group'); pedir.setAttribute('aria-label', T.opiniao); pedir.hidden = true;
    const linha = el(doc, 'div', 'rv-linha'), feito = el(doc, 'p', 'rv-feito'), des = botao(doc, 'rv-desfazer', T.desfazer), err = el(doc, 'span', 'rv-erro'), voce = el(doc, 'p', 'rv-voce'), abrir = botao(doc, 'rv-abrir', T.mostrar);
    feito.setAttribute('role', 'status'); feito.hidden = true; des.hidden = true; err.setAttribute('role', 'alert'); err.hidden = true; voce.hidden = true; abrir.hidden = true;
    des.addEventListener('click', () => cb.desfazer(item.id)); abrir.addEventListener('click', () => cb.alternar(item.id));
    linha.append(voce, abrir, feito, des, err);
    const ops = el(doc, 'ul', 'rv-ops'); ops.hidden = true;
    pe.append(acoes, confirma, pedir, linha, ops); li.append(cab, corpo, pe);
    marcar.addEventListener('change', () => cb.marcar(item.id, !!marcar.checked));
    li.addEventListener('keydown', ev => cb.tecla(item.id, ev));
    return { li, corpo, marcar, acho, confirma, q, sim, nao, pedir, feito, des, err, voce, abrir, ops, livre: null };
  }
  function opNo(doc, o) {
    const li = el(doc, 'li', 'rv-op'); li.dataset.estado = o.resposta ? 'respondida' : 'esperando';
    if (!o.resposta) { li.append(el(doc, 'span', 'rv-op-t', T.esperando + o.destino + ' · "' + o.pergunta + '" · ' + hora(o.quando))); return li; }
    li.append(el(doc, 'b', 'rv-op-quem', (o.resposta.de || o.destino) + T.respondeu), el(doc, 'span', 'rv-op-hora', ' · ' + hora(o.resposta.quando) + ': '), el(doc, 'span', 'rv-op-resp', o.resposta.texto), el(doc, 'span', 'rv-op-perg', ' (' + T.perguntou + '"' + o.pergunta + '")'));
    return li;
  }
  function falhaNo(doc, frase, solucao, detalhe) {
    const box = el(doc, 'p', 'rv-q');
    box.append(el(doc, 'b', 'rv-q-marca', '?'), el(doc, 'span', 'rv-q-texto', ' ' + frase + ' '), el(doc, 'span', 'rv-q-fix', T.solucao + (solucao || SOLUCAO) + '.'));
    if (detalhe) box.append(el(doc, 'span', 'rv-q-detalhe', ' ' + detalhe));
    return box;
  }

  function criar(doc, host, deps) {
    const d = deps || {};
    const st = d.setTimeout || ((fn, ms) => root.setTimeout(fn, ms)), ct = d.clearTimeout || (t => root.clearTimeout(t));
    const focar = typeof d.focar === 'function' ? d.focar : n => { try { if (n && typeof n.focus === 'function') n.focus(); } catch {  } };
    const S = { payload: null, assinatura: null, pintado: false, casca: null, grupos: new Map(), itens: new Map(), dados: new Map(), armado: null, pedir: null, marcados: new Set(), ui: new Map(), abertos: new Set(), filtro: null, carregando: false, pendentes: 0, refazer: false, buscas: 0 };
    const cb = { armar, desarmar: () => desarmar(true), confirmar: () => confirmar(), abrirPedir, desfazer, marcar, tecla, alternar };
    const nosDe = id => (S.itens.get(id) || {}).nos;

    function aplicar(id) {
      const reg = S.itens.get(id), item = S.dados.get(id); if (!reg || !item) return;
      const nos = reg.nos, u = S.ui.get(id) || {}, a = S.armado && S.armado.id === id ? S.armado : null, estado = estadoDe(item);
      nos.li.dataset.estado = estado; if (a) nos.li.dataset.armado = a.acao; else delete nos.li.dataset.armado;
      if (S.abertos.has(id)) nos.li.dataset.aberto = 'true'; else delete nos.li.dataset.aberto;
      nos.confirma.hidden = !a; nos.q.textContent = a ? (a.acao === 'opcao' ? 'Responder "' + a.label + '"?' : PERGUNTA[a.acao] || '') : '';
      nos.marcar.checked = S.marcados.has(id);
      nos.feito.textContent = u.feito || ''; nos.feito.hidden = !u.feito; nos.des.hidden = !u.desfazer; nos.err.textContent = u.erro || ''; nos.err.hidden = !u.erro;
      const rv = rotuloVoce(item); nos.voce.textContent = rv; nos.voce.hidden = !rv;
      nos.abrir.hidden = estado !== 'feito'; nos.abrir.textContent = S.abertos.has(id) ? T.esconder : T.mostrar;
      nos.ops.replaceChildren(...item.opinioes.map(o => opNo(doc, o))); nos.ops.hidden = !item.opinioes.length;
    }
    function pintarBarra() {
      const c = S.casca; if (!c) return;
      const n = S.marcados.size, aberto = !!(S.pedir && S.pedir.onde === 'barra');
      c.barra.hidden = !n; c.barraN.textContent = T.marcados(n);
      if (!aberto) { c.barraPedir.hidden = true; c.barraPedir.replaceChildren(); }
    }
    function topo() {
      const c = S.casca, p = S.payload, chips = [];
      const total = p.grupos.reduce((n, g) => n + g.itens.filter(i => estadoDe(S.dados.get(i.id) || i) !== 'feito').length, 0);
      const chip = (valor, rotulo) => { const b = botao(doc, 'rv-chip', rotulo); b.setAttribute('aria-pressed', String(S.filtro === valor)); b.addEventListener('click', () => { S.filtro = S.filtro === valor ? null : valor; pintar(); }); return b; };
      chips.push(chip(null, T.todos + ' ' + total));
      // r11: categoria sem item nao ganha filtro (nada de "Outros 0"); o filtro ja escolhido fica para poder desligar
      for (const g of p.grupos) if (g.itens.length || S.filtro === g.projeto) chips.push(chip(g.projeto, g.titulo + ' ' + g.itens.filter(i => estadoDe(S.dados.get(i.id) || i) !== 'feito').length));
      c.chips.replaceChildren(...chips);
      const agora = new Date(), f = p.fonte || {};
      c.lido.textContent = T.lido + dois(agora.getHours()) + ':' + dois(agora.getMinutes()) + (f.itens === 'ok' && f.atualizado ? ' · ' + T.listaDe + (f.por ? f.por + ' ' : '') + diaHora(f.atualizado) : '');
      const avisos = [];
      if (f.itens === 'ausente') avisos.push(falhaNo(doc, T.semLista, f.solucao));
      else if (f.itens === 'invalido') avisos.push(falhaNo(doc, T.listaRuim, f.solucao, f.detalhe));
      if (f.cards === 'falha') avisos.push(falhaNo(doc, T.semCards, null));
      c.avisos.replaceChildren(...avisos);
    }
    function casca() {
      const wrap = el(doc, 'div', 'rv'), top = el(doc, 'div', 'rv-top'), regra = el(doc, 'p', 'rv-regra'), ferr = el(doc, 'div', 'rv-ferramentas'), chips = el(doc, 'div', 'rv-chips'), lido = el(doc, 'span', 'rv-lido');
      wrap.dataset.dsOwned = 'revisao'; for (const frase of T.regra) regra.append(el(doc, 'span', 'rv-regra-frase', frase));
      chips.setAttribute('role', 'group'); lido.setAttribute('role', 'status'); ferr.append(chips, lido); top.append(regra, ferr);
      const avisos = el(doc, 'div', 'rv-avisos'), lista = el(doc, 'div', 'rv-lista');
      const barra = el(doc, 'div', 'rv-barra'), barraN = el(doc, 'span', 'rv-barra-n'), bp = botao(doc, 'rv-barra-pedir', T.pedirMarcados), bl = botao(doc, 'rv-barra-limpar', T.limpar), barraPedir = el(doc, 'div', 'rv-pedir');
      barra.hidden = true; barraPedir.hidden = true; barra.setAttribute('role', 'region'); barra.setAttribute('aria-label', T.pedirMarcados);
      bp.addEventListener('click', () => abrirPedir('barra')); bl.addEventListener('click', () => { const ids = [...S.marcados]; S.marcados.clear(); if (S.pedir && S.pedir.onde === 'barra') S.pedir = null; pintarBarra(); ids.forEach(aplicar); });
      barra.addEventListener('keydown', ev => tecla('barra', ev));
      const linha = el(doc, 'div', 'rv-barra-linha'); linha.append(barraN, bp, bl); barra.append(linha, barraPedir);
      wrap.append(top, avisos, lista, barra); host.replaceChildren(wrap);
      S.casca = { wrap, chips, lido, avisos, lista, barra, barraN, barraPedir }; S.grupos = new Map();
    }

    function encher(box, nos, vazio) {
      if (!nos.length && vazio) { if (box.children.length !== 1 || box.children[0].className !== 'rv-nada') box.replaceChildren(el(doc, 'p', 'rv-nada', T.nada)); return; }
      if (box.children.length !== nos.length || nos.some((n, i) => box.children[i] !== n)) box.replaceChildren(...nos);
    }
    function pintar() {
      const p = S.payload;
      if (!bom(p)) {
        S.casca = null; S.grupos = new Map(); S.itens = new Map(); S.dados = new Map(); S.armado = null; S.pedir = null;
        const wrap = el(doc, 'div', 'rv'); wrap.dataset.dsOwned = 'revisao';
        if (!p) wrap.append(el(doc, 'p', 'rv-lendo', T.lendo)); else if (p.example) wrap.append(el(doc, 'p', 'rv-lendo', T.exemplo)); else wrap.append(falhaNo(doc, T.semLeitura, p.solucao));
        host.replaceChildren(wrap); return;
      }
      if (!S.casca) casca();
      const vivos = new Set();
      for (const g of p.grupos) {
        let reg = S.grupos.get(g.projeto);
        if (!reg) {
          const sec = el(doc, 'section', 'rv-grupo'), h = el(doc, 'h2', 'rv-grupo-t'), n = el(doc, 'span', 'rv-grupo-n'), itens = el(doc, 'div', 'rv-itens'), soltos = el(doc, 'details', 'rv-soltos'), soltosT = el(doc, 'summary', 'rv-soltos-t'), soltosBox = el(doc, 'div', 'rv-itens'); sec.dataset.projeto = g.projeto;
          h.append(el(doc, 'span', 'rv-grupo-nome', g.titulo)); if (g.sub) h.append(el(doc, 'span', 'rv-grupo-sub', g.sub)); h.append(n); soltos.append(soltosT, soltosBox); soltos.hidden = true; sec.append(h, itens, soltos);
          reg = { sec, n, itens, soltos, soltosT, soltosBox, visto: false }; S.grupos.set(g.projeto, reg); S.casca.lista.append(sec);
        }

        const entregas = [], soCards = [];
        for (const item of g.itens) {
          vivos.add(item.id);
          const sig = sigCorpo(item), velho = S.itens.get(item.id);
          if (!velho || velho.sig !== sig) S.itens.set(item.id, { sig, nos: itemNo(doc, item, cb) });
          S.dados.set(item.id, { ...item, opinioes: item.opinioes.slice() });
          (item.tipo === 'card' ? soCards : entregas).push(S.itens.get(item.id).nos.li);
        }
        encher(reg.itens, entregas, !g.itens.length); encher(reg.soltosBox, soCards, false);
        reg.soltos.hidden = !soCards.length; reg.soltosT.textContent = T.cards(soCards.length);
        if (soCards.length && !reg.visto) { reg.visto = true; if (soCards.length <= 4) reg.soltos.setAttribute('open', ''); }
        reg.n.textContent = String(g.itens.filter(i => estadoDe(i) !== 'feito').length);
        // r11: secao sem item some (so aparece vazia quando o filtro e dela), como no painel de origem
        reg.sec.hidden = S.filtro ? S.filtro !== g.projeto : !g.itens.length;
      }
      for (const id of [...S.itens.keys()]) if (!vivos.has(id)) { S.itens.delete(id); S.dados.delete(id); S.marcados.delete(id); S.abertos.delete(id); const u = S.ui.get(id); if (u) { if (u.relogio) ct(u.relogio); if (u.relogioErro) ct(u.relogioErro); S.ui.delete(id); } }
      if (S.armado && !vivos.has(S.armado.id)) S.armado = null;
      if (S.pedir && S.pedir.onde !== 'barra' && !vivos.has(S.pedir.onde)) S.pedir = null;
      for (const id of vivos) aplicar(id);
      topo(); pintarBarra();
    }

    function armar(id, acao, extra) {
      if (!S.dados.has(id)) return;
      const antes = S.armado; fecharPedir(false);
      S.armado = { id, acao, ...(extra || {}) };
      if (antes && antes.id !== id) aplicar(antes.id);
      aplicar(id);
      const nos = nosDe(id); if (nos) focar(nos.acho || nos.sim);
    }
    function desarmar(devolveFoco) { const a = S.armado; if (!a) return; S.armado = null; aplicar(a.id); if (devolveFoco) { const nos = nosDe(a.id); if (nos && nos.acho) focar(nos.acho); } depois(); }
    function confirmar() {
      const a = S.armado; if (!a) return;
      const nos = nosDe(a.id), texto = nos && nos.acho ? String(nos.acho.value || '').trim() : '';
      S.armado = null; aplicar(a.id);
      const pedido = { acao: a.acao, itens: [a.id] };
      if (a.acao !== 'trazer-card') pedido.texto = texto;
      if (a.card !== undefined) pedido.card = a.card;
      if (a.acao === 'opcao') pedido.opcao = a.opcao;
      mandar([a.id], pedido, { label: a.label, texto });
    }
    function tecla(onde, ev) {
      if (!ev) return;
      const pedindo = S.pedir && S.pedir.onde === onde, armado = S.armado && S.armado.id === onde;
      if (ev.key === 'Escape' || ev.key === 'Esc') { if (pedindo) fecharPedir(true); else if (armado) desarmar(true); else return; ev.preventDefault(); ev.stopPropagation(); return; }
      if (ev.key !== 'Enter' || ev.repeat || ev.isComposing) return;
      const alvo = ev.target, emBotao = alvo && String(alvo.tagName || alvo.tag || '').toLowerCase() === 'button';
      if (emBotao) return; // no botão o Enter é o clique dele (Cancelar cancela, Confirmar confirma)
      if (pedindo) { ev.preventDefault(); ev.stopPropagation(); enviarPedido(); return; }
      if (armado) { ev.preventDefault(); ev.stopPropagation(); confirmar(); return; }
      const nos = nosDe(onde);
      if (nos && nos.acho && alvo === nos.acho && String(nos.acho.value || '').trim()) { ev.preventDefault(); ev.stopPropagation(); mandar([onde], { acao: 'acho', itens: [onde], texto: String(nos.acho.value).trim() }, { texto: String(nos.acho.value).trim() }); }
    }
    function alternar(id) { if (S.abertos.has(id)) S.abertos.delete(id); else S.abertos.add(id); aplicar(id); }
    function marcar(id, ligado) { if (ligado) S.marcados.add(id); else S.marcados.delete(id); pintarBarra(); }

    function abrirPedir(onde) {
      if (onde !== 'barra' && !S.dados.has(onde)) return;
      if (S.armado) { const a = S.armado; S.armado = null; aplicar(a.id); }
      fecharPedir(false);
      const alvo = onde === 'barra' ? S.casca.barraPedir : nosDe(onde).pedir, estado = { onde, destino: 0, pergunta: 0, livre: null };
      const q = pedirNo(doc, S.payload, estado, { enviar: enviarPedido, fechar: () => fecharPedir(true) });
      estado.livre = q.livre; alvo.replaceChildren(...q.partes); alvo.hidden = false; S.pedir = estado; focar(q.livre);
    }
    function fecharPedir(avisa) {
      const q = S.pedir; if (!q) return; S.pedir = null;
      const alvo = q.onde === 'barra' ? (S.casca && S.casca.barraPedir) : (nosDe(q.onde) || {}).pedir;
      if (alvo) { alvo.hidden = true; alvo.replaceChildren(); }
      if (avisa) depois();
    }
    function enviarPedido() {
      const q = S.pedir; if (!q) return;
      const ids = q.onde === 'barra' ? [...S.marcados].filter(id => S.dados.has(id)) : [q.onde];
      const destino = (S.payload.destinos || [])[q.destino], escrito = String((q.livre && q.livre.value) || '').trim(), pergunta = escrito || (S.payload.perguntas || [])[q.pergunta];
      if (!ids.length || !destino || !pergunta) return;
      const daBarra = q.onde === 'barra'; fecharPedir(false);
      if (daBarra) { S.marcados.clear(); pintarBarra(); ids.forEach(aplicar); }
      mandar(ids, { acao: 'opiniao', itens: ids, destino, pergunta }, { destino, pergunta });
    }

    function limparRelogios(u) { if (u.relogio) { ct(u.relogio); u.relogio = null; } if (u.relogioErro) { ct(u.relogioErro); u.relogioErro = null; } }
    function falhou(ids, resposta) {
      const codigo = resposta && resposta.erro, frase = /leitura/i.test(String(codigo || '')) ? T.naoGravouLeitura : resposta && typeof resposta.mensagem === 'string' && resposta.mensagem ? 'Não gravou: ' + resposta.mensagem : T.naoGravou;
      for (const id of ids) {
        const u = S.ui.get(id) || {}; limparRelogios(u); u.feito = null; u.desfazer = null; u.erro = frase;
        u.relogioErro = st(() => { u.erro = null; u.relogioErro = null; aplicar(id); }, 12000);
        S.ui.set(id, u); aplicar(id);
      }
    }
    function mandar(ids, pedido, extra) {
      if (typeof d.gravar !== 'function') return;
      S.pendentes++;
      let ida;
      try { ida = Promise.resolve(d.gravar(pedido)); } catch (e) { ida = Promise.reject(e); }
      const fim = () => { S.pendentes--; depois(); };
      ida.then(r => {
        if (!r || r.ok !== true) { falhou(ids, r); fim(); return; }
        const quando = r.quando || new Date().toISOString();
        for (const id of ids) {
          const item = S.dados.get(id); if (!item) continue;
          const u = S.ui.get(id) || {}; limparRelogios(u); u.erro = null; u.antes = item.voce; u.desfazer = r.linha || null; u.acao = pedido.acao;
          if (pedido.acao === 'opiniao') item.opinioes = item.opinioes.concat([{ linha: r.linha, destino: extra.destino, pergunta: extra.pergunta, quando, resposta: null }]);
          else if (pedido.acao !== 'acho' || !item.voce || !['aprovo', 'refazer', 'depois', 'opcao', 'trazer-card'].includes(item.voce.acao)) item.voce = { acao: pedido.acao, quando, texto: extra.texto || null, linha: r.linha, card: pedido.card || null, opcao: pedido.acao === 'opcao' ? { indice: pedido.opcao, label: extra.label } : null };
          u.feito = T.feito + (pedido.acao === 'opcao' ? extra.label : FEITO[pedido.acao] || pedido.acao);
          u.relogio = st(() => { u.desfazer = null; u.feito = null; u.relogio = null; aplicar(id); }, 8000);
          S.ui.set(id, u);
          const nos = nosDe(id);
          if (nos && nos.acho && pedido.acao !== 'opiniao') nos.acho.value = '';
          if (estadoDe(item) === 'feito' && nos) { S.abertos.delete(id); for (const v of nos.corpo.querySelectorAll('video')) { try { if (typeof v.pause === 'function') v.pause(); } catch {  } } }
          aplicar(id);
        }
        S.assinatura = null; // a próxima leitura confere com o servidor
        if (bom(S.payload)) topo();
        fim();
      }, () => { falhou(ids, null); fim(); });
    }
    function desfazer(id) {
      const u = S.ui.get(id); if (!u || !u.desfazer || typeof d.gravar !== 'function') return;
      const linha = u.desfazer, acao = u.acao, irmaos = [...S.ui.entries()].filter(([, x]) => x.desfazer === linha).map(([k]) => k);
      for (const k of irmaos) { const x = S.ui.get(k); limparRelogios(x); x.desfazer = null; x.feito = null; aplicar(k); }
      S.pendentes++;
      let ida;
      try { ida = Promise.resolve(d.gravar({ acao: 'desfazer', desfaz: linha })); } catch (e) { ida = Promise.reject(e); }
      const fim = () => { S.pendentes--; depois(); };
      ida.then(r => {
        if (!r || r.ok !== true) { falhou(irmaos, r); fim(); return; }
        for (const k of irmaos) {
          const item = S.dados.get(k), x = S.ui.get(k); if (!item) continue;
          if (acao === 'opiniao') item.opinioes = item.opinioes.filter(o => o.linha !== linha); else if (item.voce && item.voce.linha === linha) item.voce = x.antes || null;
          aplicar(k);
        }
        S.assinatura = null; if (bom(S.payload)) topo(); fim();
      }, () => { falhou(irmaos, null); fim(); });
    }
    function depois() { if (S.refazer && !S.pendentes && !S.armado && !S.pedir) { S.refazer = false; carregar(); } }

    async function carregar() {
      if (S.carregando || typeof d.buscar !== 'function') return;
      S.carregando = true; S.buscas++;
      let p;
      try { p = await d.buscar(); } catch { p = { ok: false }; }
      S.carregando = false;
      if (S.pendentes || S.armado || S.pedir) { S.refazer = true; return; } // gravação no ar ou algo aberto: a leitura nova espera
      const assinatura = bom(p) ? 'ok:' + p.assinatura : 'falha:' + JSON.stringify([p && p.erro, !!(p && p.example)]);
      if (S.pintado && assinatura === S.assinatura) { if (S.casca && bom(S.payload)) topo(); return; }
      S.payload = p; S.assinatura = assinatura; S.pintado = true; pintar();
    }
    return { carregar, pintar, fechar: () => { fecharPedir(false); desarmar(false); }, estado: () => ({ buscas: S.buscas, pendentes: S.pendentes, armado: S.armado ? S.armado.id : null, pedir: S.pedir ? S.pedir.onde : null, marcados: [...S.marcados], lido: bom(S.payload) }) };
  }

  const api = { criar, SOLUCAO };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  root.PainelRevisao = api;
  const doc = root.document, host = doc.getElementById('revisao-host'); if (!host) return;
  const html = doc.documentElement, EXEMPLO = /[?&]exemplo=1\b/.test(root.location.search || '');
  let token = '', relogio = null;
  async function buscar() {
    const r = await root.fetch('/api/revisao' + (EXEMPLO ? '?exemplo=1' : ''), { cache: 'no-store', headers: { Accept: 'application/json' } });
    let j = null; try { j = await r.json(); } catch { j = null; }
    if (j && j.ok === true && typeof j.token === 'string') token = j.token;
    return j || { ok: false };
  }
  async function mandar(pedido) {
    const r = await root.fetch('/api/revisao/acao', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Revisao-Token': token }, body: JSON.stringify(pedido) });
    try { return await r.json(); } catch { return { ok: false }; }
  }

  async function gravar(pedido) { let r = await mandar(pedido); if (r && r.ok !== true && r.erro === 'token') { try { await buscar(); } catch {  } r = await mandar(pedido); } return r; }
  const tela = criar(doc, host, { buscar, gravar });
  const ativa = () => html.dataset.painelTab === 'revisao' && !doc.hidden && (!html.classList.contains('esq') || html.dataset.gOld === 'revisao');
  function ritmo() { if (relogio) { root.clearInterval(relogio); relogio = null; } if (ativa()) relogio = root.setInterval(() => tela.carregar(), 30000); }

  function pe() {
    let h = 0; const d = doc.getElementById('g-dock');
    if (d && typeof d.getBoundingClientRect === 'function') { const r = d.getBoundingClientRect(); if (r.height > 0 && r.bottom >= root.innerHeight - 2 && r.top > root.innerHeight / 3) h = Math.round(root.innerHeight - r.top); }
    host.style.setProperty('--rv-base', h + 'px');
  }
  function acordar() { ritmo(); pe(); if (ativa()) tela.carregar(); }
  host.addEventListener('change', pe); root.addEventListener('resize', pe);
  tela.pintar();
  doc.addEventListener('painel:tab-change', acordar);
  doc.addEventListener('visibilitychange', acordar);
  root.addEventListener('focus', acordar);
  if (typeof root.MutationObserver === 'function') new root.MutationObserver(acordar).observe(html, { attributes: true, attributeFilter: ['data-g-old', 'data-g-new', 'data-painel-tab'] });
  root.addEventListener('pagehide', () => { if (relogio) root.clearInterval(relogio); }, { once: true });
  acordar();
})(typeof window === 'object' ? window : globalThis);
