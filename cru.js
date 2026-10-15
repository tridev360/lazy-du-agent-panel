
(function (root) {
  'use strict';
  var doc = root.document; if (!doc) return;
  var ROTULO = { fala: 'SUA FALA', pensou: 'PENSOU', comando: 'COMANDO', ajudante: 'AJUDANTE', mandou: 'MANDOU', perguntou: 'PERGUNTOU A VOCÊ', voltou: 'VOLTOU', respondeu: 'RESPONDEU', sistema: 'APP' };
  var GRUPO = { fala: 'fala', pensou: 'pensou', comando: 'comando', ajudante: 'mandou', mandou: 'mandou', perguntou: 'perguntou', voltou: 'voltou', respondeu: 'respondeu', sistema: 'sistema' };
  var FILTROS = [['', 'Tudo'], ['fala', 'Fala'], ['pensou', 'Pensou'], ['comando', 'Comando'], ['mandou', 'Mandou'], ['perguntou', 'Perguntou'], ['voltou', 'Voltou'], ['respondeu', 'Respondeu']];
  var ORIGEM = { nota: 'nota da sessão', recado: 'recado', relatorio: 'relatório', tarefa: 'tarefa' };
  var MAX_LINHAS = 600, CHAVE_ORDEM = 'painel-cru-ordem';
  var SEM_JANELA = false; try { SEM_JANELA = root.navigator.webdriver === true || /Headless/i.test(root.navigator.userAgent || ''); } catch (e) { SEM_JANELA = false; }

  try { if (/[?&]exemplo=/.test(String((root.location && root.location.search) || ''))) SEM_JANELA = true; } catch (e) {  }

  function h(tag, cls) { var el = doc.createElement(tag); if (cls) el.className = cls; for (var i = 2; i < arguments.length; i++) { var k = arguments[i]; if (k === null || k === undefined || k === '') continue; el.append(k); } return el; }
  function tx(v) { return v === null || v === undefined || v === '' ? '?' : String(v); }
  function p2(n) { return n < 10 ? '0' + n : String(n); }
  function hora(iso) { var d = new Date(iso); return isNaN(d) ? '?' : p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()); }
  function dur(ms) {
    if (typeof ms !== 'number' || !isFinite(ms) || ms < 0) return '';
    if (ms < 1000) return (Math.round(ms / 100) / 10).toString().replace('.', ',') + ' s';
    var s = Math.round(ms / 1000); if (s < 60) return s + ' s';
    var m = Math.floor(s / 60); if (m < 60) return m + ' min ' + p2(s % 60) + ' s';
    return Math.floor(m / 60) + ' h ' + p2(m % 60) + ' min';
  }
  function ha(ms) {
    if (typeof ms !== 'number' || !isFinite(ms)) return '?';
    var s = Math.max(0, Math.floor(ms / 1000)); if (s < 60) return 'há ' + s + ' s';
    var m = Math.floor(s / 60); if (m < 60) return 'há ' + m + ' min';
    return 'há ' + Math.floor(m / 60) + ' h ' + p2(m % 60) + ' min';
  }
  function plural(n, um, muitos) { return n + ' ' + (n === 1 ? um : muitos); }
  function conta(c) { return plural(c.pensamentos, 'pensamento', 'pensamentos') + ' · ' + plural(c.comandos, 'comando', 'comandos') + ' · ' + plural(c.envios, 'envio', 'envios') + ' · ' + plural(c.telas, 'tela de escolha', 'telas de escolha') + (c.voltas ? ' · ' + plural(c.voltas, 'volta', 'voltas') : ''); }
  function poe(el, texto) { if (el.textContent !== texto) el.textContent = texto; }
  function semMovimento() { try { return root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return true; } }

  var D = { epoca: -1, versao: 0, resumo: null, eventos: new Map(), falta: null, soDono: false, deslocamento: 0, lidoEm: 0, primeira: true, ultimaFala: '' };
  var instancias = [], relogio = null, pedindo = false, proxima = 0;
  function agoraServidor() { return Date.now() + D.deslocamento; }
  function aVista() { if (SEM_JANELA || doc.visibilityState === 'hidden') return false; for (var i = 0; i < instancias.length; i++) { var n = instancias[i].no; if (n.isConnected && n.offsetParent !== null) return true; } return false; }
  function ler() {
    if (pedindo) return; pedindo = true;
    var caminho = D.epoca < 0 ? '/api/cru' : '/api/cru/desde/' + D.epoca + '/' + D.versao;
    fetch(caminho, { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); }).then(function (x) {
      var j = x.j || {};
      if (x.status === 403 || j.fechado) { D.soDono = true; D.falta = tx(j.falta); D.epoca = -1; proxima = Date.now() + 30000; pintarTudo([]); return; }
      D.soDono = false;
      if (!j.ok) { D.falta = tx(j.falta); D.epoca = -1; D.resumo = null; proxima = Date.now() + 5000; pintarTudo([]); return; }
      D.falta = null; D.deslocamento = (Date.parse(j.agora) || Date.now()) - Date.now(); D.lidoEm = Date.now();
      if (j.tudo) { D.eventos = new Map(); for (var a = 0; a < instancias.length; a++) instancias[a].zerar(); }
      D.epoca = j.epoca; D.versao = j.versao; D.resumo = j.resumo; D.registro = j.registro;
      var novos = j.eventos || [];
      for (var i = 0; i < novos.length; i++) D.eventos.set(novos[i].seq, novos[i]);
      if (D.eventos.size > MAX_LINHAS) { var sobra = D.eventos.size - MAX_LINHAS, it = D.eventos.keys(); while (sobra-- > 0) { var k = it.next().value; D.eventos.delete(k); for (var b = 0; b < instancias.length; b++) instancias[b].tirar(k); } }
      pintarTudo(novos);
      try { root.dispatchEvent(new CustomEvent('painel-cru', { detail: { resumo: j.resumo, novos: D.primeira ? [] : novos } })); } catch (e) {  }
      D.primeira = false;
    }).catch(function () { D.falta = 'O painel não respondeu agora. Solução: confira se o painel está aberto; ele tenta de novo sozinho.'; proxima = Date.now() + 5000; if (!D.resumo) pintarTudo([]); }).then(function () { pedindo = false; });
  }
  function pintarTudo(novos) { for (var i = 0; i < instancias.length; i++) instancias[i].pintar(novos); }
  function tique() { var t = Date.now(); for (var i = 0; i < instancias.length; i++) instancias[i].relogio(); if (t >= proxima && aVista()) { proxima = t + 1000; ler(); } }
  function ligar() { if (!relogio) { relogio = setInterval(tique, 1000); tique(); } }

  function corpoDoPasso(e) {
    var frag = doc.createDocumentFragment(), txt, meta = h('span', 'cru-meta');
    if (e.tipo === 'fala') { txt = h('p', 'cru-txt cru-inteira', tx(e.texto || (e.imagens ? '[imagem]' : ''))); if (e.imagens) meta.append(h('i', 'cru-tag', plural(e.imagens, 'imagem', 'imagens'))); if (e.daEscolha) meta.append(h('i', 'cru-tag', 'resposta da tela de escolha')); else if (e.noMeio) meta.append(h('i', 'cru-tag', 'no meio do turno')); }
    else if (e.tipo === 'pensou') txt = h('p', 'cru-txt' + (e.semTexto ? ' cru-apagado' : ''), e.semTexto ? 'o app não guardou o texto deste pensamento, só a duração' : tx(e.resumo));
    else if (e.tipo === 'comando') txt = h('p', 'cru-txt', h('b', 'cru-ferr', tx(e.ferramenta)), ' ' + tx(e.resumo));
    else if (e.tipo === 'ajudante') txt = h('p', 'cru-txt', h('b', 'cru-seta', '→ ' + tx(e.destinoNome)), e.subtipo ? ' (' + e.subtipo + ')' : '');
    else if (e.tipo === 'mandou') txt = h('p', 'cru-txt', h('b', 'cru-seta', '→ ' + tx(e.destinoNome)), ' ' + tx(e.resumo));
    else if (e.tipo === 'voltou') { txt = h('p', 'cru-txt', h('b', 'cru-seta', '← ' + tx(e.destinoNome)), ' ' + tx(e.resumo)); if (ORIGEM[e.origem]) meta.append(h('i', 'cru-tag', ORIGEM[e.origem])); }
    else txt = h('p', 'cru-txt', tx(e.resumo));
    frag.append(txt);
    if (e.selo) meta.prepend(h('i', 'cru-selo is-' + e.selo, e.selo === 'duvida' ? 'dúvida' : 'direção'));
    if (e.entrega) meta.append(h('i', 'cru-tag', e.entrega));
    if (e.sensivel) meta.append(h('i', 'cru-tag', 'sensível: conteúdo oculto'));
    if (e.saida && e.saida.linhas && e.saida.linhas.length && e.tipo !== 'ajudante' && e.tipo !== 'mandou') frag.append(h('p', 'cru-saida' + (e.saida.erro ? ' is-erro' : ''), e.saida.linhas.join('\n') + (e.saida.maisLinhas ? '\n… mais ' + plural(e.saida.maisLinhas, 'linha', 'linhas') : '')));
    var temMais = e.tipo !== 'fala' && ((e.texto && e.texto !== e.resumo) || (e.saida && (e.saida.maisLinhas > 0 || e.saida.cortado || (e.saida.texto || '').length > 240)));
    if (e.pendente) meta.append(h('i', 'cru-tag is-vivo', e.tipo === 'perguntou' ? 'esperando você' : e.tipo === 'ajudante' ? 'trabalhando' : 'rodando'));
    if (typeof e.durMs === 'number') meta.append(h('i', 'cru-dur', dur(e.durMs)));
    if (e.cortado || (e.saida && e.saida.cortado)) meta.append(h('i', 'cru-tag', 'texto cortado'));
    return { frag: frag, meta: meta, temMais: temMais };
  }
  function textoInteiro(e) {
    var partes = [];
    if (e.texto) partes.push(e.texto);
    if (e.saida && e.saida.texto && e.tipo !== 'ajudante') partes.push((e.tipo === 'perguntou' ? '·· resposta ··\n' : '·· saída ··\n') + e.saida.texto);
    return partes.join('\n\n') || '?';
  }
  function pintarPasso(li, e) {
    var aberto = li.dataset.aberto === '1', c = corpoDoPasso(e), corpo = h('div', 'cru-corpo');
    li.dataset.tipo = e.tipo; li.dataset.grupo = GRUPO[e.tipo] || 'sistema'; li.dataset.destino = e.destino || ''; li.dataset.v = String(e.v);
    corpo.append(c.frag);
    if (c.temMais) {
      var b = h('button', 'cru-ver', aberto ? 'recolher' : 'ver tudo'); b.type = 'button'; b.setAttribute('aria-expanded', aberto ? 'true' : 'false');
      var pre = h('pre', 'cru-tudo', aberto ? textoInteiro(e) : ''); pre.hidden = !aberto;
      b.addEventListener('click', function () { var abre = pre.hidden; var atual = D.eventos.get(e.seq) || e; if (abre) pre.textContent = textoInteiro(atual); pre.hidden = !abre; li.dataset.aberto = abre ? '1' : '0'; b.textContent = abre ? 'recolher' : 'ver tudo'; b.setAttribute('aria-expanded', abre ? 'true' : 'false'); });
      corpo.append(b, pre);
    }
    li.replaceChildren(h('time', 'cru-h', hora(e.t)), h('span', 'cru-tipo', e.tipo === 'fala' && e.daEscolha ? 'SUA ESCOLHA' : ROTULO[e.tipo] || 'APP'), corpo, c.meta);
  }

  function criar(opcoes) {
    var soFita = !!(opcoes && opcoes.so === 'fita');
    var no = h('section', 'cru' + (soFita ? ' cru-so-fita' : '')); no.dataset.dsOwned = 'cru'; no.hidden = SEM_JANELA; // navegador sem janela (print) ou pagina de exemplo: o bloco nem aparece
    no.setAttribute('aria-label', soFita ? 'Fita crua da COORDENADOR' : 'COORDENADOR ao vivo');
    var q = h('p', 'cru-q'); q.hidden = true;
    var lido = h('span', 'cru-lido', ''), titulo = h('div', 'cru-topo', h('h2', 'cru-h2', soFita ? 'Fita crua da COORDENADOR' : 'COORDENADOR ao vivo'), lido);
    var espera = h('p', 'cru-espera'); espera.hidden = true; espera.setAttribute('role', 'status');
    var falas = h('ol', 'cru-falas'), estado = h('p', 'cru-estado', '?'), detalhe = h('p', 'cru-detalhe', ''), contaEl = h('p', 'cru-conta', ''), destinos = h('div', 'cru-destinos'), voo = h('i', 'cru-voo');
    var cima = h('div', 'cru-cima', h('section', 'cru-b cru-falou', h('h3', 'cru-h3', 'Você falou'), falas), h('section', 'cru-b cru-agora', h('h3', 'cru-h3', 'COORDENADOR agora'), estado, detalhe, contaEl), h('section', 'cru-b cru-foi', h('h3', 'cru-h3', 'Para onde foi'), destinos), voo);
    var chips = h('div', 'cru-chips'), filtroDest = h('button', 'cru-chip cru-chip-dest', ''), inverter = h('button', 'cru-chip cru-inverter', '');
    filtroDest.type = 'button'; filtroDest.hidden = true; inverter.type = 'button';
    var fita = h('div', 'cru-fita'), vazio = h('p', 'cru-vazio', 'Nenhum passo neste filtro.'); vazio.hidden = true;
    var corpo = h('div', 'cru-miolo', espera, soFita ? '' : cima, h('div', 'cru-fita-topo', soFita ? '' : h('h3', 'cru-h3', 'Fita crua'), chips, filtroDest, inverter), fita, vazio);
    no.append(titulo, q, corpo);
    var E = { tipo: '', destino: '', destinoNome: '', ordem: 'nova-em-cima', linhas: new Map(), turnos: new Map(), falasSig: '', ultimaFala: '', dest: new Map(), turnoAtual: -1 };
    try { var o = root.localStorage.getItem(CHAVE_ORDEM); if (o === 'nova-embaixo' || o === 'nova-em-cima') E.ordem = o; } catch (e) {  }
    function pintarOrdem() { fita.dataset.ordem = E.ordem; inverter.textContent = E.ordem === 'nova-em-cima' ? 'mais nova em cima ⇅' : 'mais nova embaixo ⇅'; inverter.title = 'Inverter a ordem da fita'; }
    inverter.addEventListener('click', function () { E.ordem = E.ordem === 'nova-em-cima' ? 'nova-embaixo' : 'nova-em-cima'; try { root.localStorage.setItem(CHAVE_ORDEM, E.ordem); } catch (e) {  } pintarOrdem(); });
    pintarOrdem();
    FILTROS.forEach(function (f) { var b = h('button', 'cru-chip', f[1]); b.type = 'button'; b.dataset.filtro = f[0]; b.setAttribute('aria-pressed', f[0] === '' ? 'true' : 'false'); b.addEventListener('click', function () { E.tipo = f[0]; for (var i = 0; i < chips.children.length; i++) chips.children[i].setAttribute('aria-pressed', chips.children[i] === b ? 'true' : 'false'); filtrar(); }); chips.append(b); });
    filtroDest.addEventListener('click', function () { escolherDestino('', ''); });
    function escolherDestino(chave, nome) { E.destino = E.destino === chave ? '' : chave; E.destinoNome = E.destino ? nome : ''; filtroDest.hidden = !E.destino; filtroDest.textContent = E.destino ? 'só ' + tx(E.destinoNome) + ' ✕' : ''; E.dest.forEach(function (b, k) { b.setAttribute('aria-pressed', k === E.destino ? 'true' : 'false'); }); filtrar(); }
    function passa(li) { return (!E.tipo || li.dataset.grupo === E.tipo) && (!E.destino || li.dataset.destino === E.destino); }
    function filtrar() { var algum = false; E.linhas.forEach(function (li) { var ok = passa(li); li.hidden = !ok; if (ok) algum = true; }); E.turnos.forEach(function (g) { var tem = false, ls = g.lista.children; for (var i = 0; i < ls.length; i++) if (!ls[i].hidden) { tem = true; break; } g.caixa.hidden = !tem; }); vazio.hidden = algum || E.linhas.size === 0; }

    function grupoDe(id) {
      var g = E.turnos.get(id); if (g) return g;
      var resumo = h('summary', 'cru-turno-topo', h('time', 'cru-h', '?'), h('span', 'cru-turno-fala', ''), h('span', 'cru-turno-conta', '')), lista = h('ol', 'cru-passos'), caixa = h('details', 'cru-turno', resumo, lista);
      caixa.dataset.turno = String(id); caixa.open = true;
      resumo.addEventListener('click', function () { caixa.dataset.fixo = '1'; });
      g = { caixa: caixa, lista: lista, resumo: resumo }; E.turnos.set(id, g);
      var depois = null; E.turnos.forEach(function (x, k) { if (k > id && (depois === null || k < depois.k)) depois = { k: k, el: x.caixa }; });
      if (depois) fita.insertBefore(caixa, depois.el); else fita.append(caixa);
      return g;
    }
    function pintarTurnos(lista, atual) {
      for (var i = 0; i < lista.length; i++) {
        var t = lista[i], g = E.turnos.get(t.id); if (!g) continue;
        var k = g.resumo.children, ini = Date.parse(t.inicio), fim = Date.parse(t.fim);
        poe(k[0], hora(t.inicio)); poe(k[1], t.id === 0 ? 'antes da primeira fala lida' : tx(t.fala)); poe(k[2], conta(t) + (isFinite(ini) && isFinite(fim) && fim > ini ? ' · ' + dur(fim - ini) : ''));
        g.caixa.classList.toggle('is-atual', t.id === atual);
      }
      if (atual !== E.turnoAtual) { E.turnos.forEach(function (g, id) { if (id !== atual && g.caixa.dataset.fixo !== '1') g.caixa.open = false; }); var ga = E.turnos.get(atual); if (ga && ga.caixa.dataset.fixo !== '1') ga.caixa.open = true; E.turnoAtual = atual; }
    }
    function pintarFalas(lista, animar) {
      var sig = lista.map(function (f) { return f.t + '|' + f.estado + '|' + f.texto.length; }).join(';'); if (sig === E.falasSig) return; E.falasSig = sig;
      falas.replaceChildren.apply(falas, lista.length ? lista.map(function (f) {
        var li = h('li', 'cru-fala' + (f.maisNova ? ' is-nova' : '') + (f.estado === 'fila' ? ' is-fila' : ''), h('time', 'cru-h', hora(f.t)), h('p', 'cru-txt cru-inteira', tx(f.texto || (f.imagens ? '[imagem]' : ''))));
        if (f.maisNova) li.append(h('span', 'cru-chegou', f.estado === 'fila' ? 'na fila: a COORDENADOR ainda não leu' : 'chegou na COORDENADOR'));
        else if (f.estado === 'fila') li.append(h('span', 'cru-chegou', 'na fila'));
        return li;
      }) : [h('li', 'cru-fala cru-apagado', 'nenhuma fala sua no trecho lido')]);
      var nova = lista.length ? lista[lista.length - 1] : null, chave = nova ? nova.t + '|' + nova.texto.length : '';
      if (animar && nova && nova.estado === 'chegou' && chave !== E.ultimaFala && !semMovimento() && cima.isConnected) voar();
      E.ultimaFala = chave;
    }
    function voar() {
      try {
        var a = cima.querySelector('.cru-falou').getBoundingClientRect(), b = cima.querySelector('.cru-agora').getBoundingClientRect(), c = cima.getBoundingClientRect();
        voo.style.setProperty('--cru-x0', Math.round(a.left + a.width / 2 - c.left) + 'px'); voo.style.setProperty('--cru-y0', Math.round(a.top + 24 - c.top) + 'px');
        voo.style.setProperty('--cru-x1', Math.round(b.left + b.width / 2 - c.left) + 'px'); voo.style.setProperty('--cru-y1', Math.round(b.top + 24 - c.top) + 'px');
        voo.classList.remove('is-voando'); void voo.offsetWidth; voo.classList.add('is-voando'); cima.querySelector('.cru-agora').classList.add('is-recebendo');
        setTimeout(function () { voo.classList.remove('is-voando'); var ag = cima.querySelector('.cru-agora'); if (ag) ag.classList.remove('is-recebendo'); }, 900);
      } catch (e) {  }
    }
    function pintarDestinos(lista) {
      var vistos = new Set();
      for (var i = 0; i < lista.length; i++) {
        var d = lista[i], b = E.dest.get(d.chave); vistos.add(d.chave);
        if (!b) {
          b = h('button', 'cru-d', h('span', 'cru-d-nome', ''), h('span', 'cru-d-selo', ''), h('span', 'cru-d-est', ''), h('span', 'cru-d-linha', '')); b.type = 'button'; b.dataset.chave = d.chave; b.setAttribute('aria-pressed', 'false');
          (function (dd, bb) { bb.addEventListener('click', function () { escolherDestino(dd.chave, bb.children[0].textContent); }); })(d, b);
          E.dest.set(d.chave, b); destinos.append(b);
        }
        b.dataset.tipo = d.tipo; b.dataset.estado = d.estado; b._d = d;
        b.classList.toggle('is-aceso', !!d.aceso); b.classList.toggle('is-semresposta', !!d.semResposta); b.classList.toggle('is-vivo', !!d.vivo); b.classList.toggle('is-voltou', !!d.voltouNoTurno);
        poe(b.children[0], tx(d.nome)); poe(b.children[1], d.selo === 'duvida' ? 'dúvida' : d.selo === 'direcao' ? 'direção' : ''); b.children[1].hidden = !d.selo; b.children[1].className = 'cru-d-selo' + (d.selo ? ' is-' + d.selo : '');
        poe(b.children[3], d.primeira || ''); b.children[3].hidden = !d.primeira; b.title = 'Filtrar a fita por ' + tx(d.nome);
      }
      E.dest.forEach(function (b, k) { if (!vistos.has(k)) { b.remove(); E.dest.delete(k); if (E.destino === k) escolherDestino('', ''); } });
      relogioDestinos();
    }
    function relogioDestinos() {
      var t = agoraServidor();
      E.dest.forEach(function (b) {
        var d = b._d; if (!d) return; var txt;
        if (d.semResposta) txt = 'sem resposta ainda · ' + ha(t - Date.parse(d.t || d.desde));
        else if (d.estado === 'trabalhando') txt = 'trabalhando ' + ha(t - Date.parse(d.tipo === 'ajudante' && d.desde ? d.desde : d.t));
        else if (d.estado === 'voltou') txt = 'voltou ' + ha(t - Date.parse(d.voltouEm));
        else txt = 'parado';
        poe(b.children[2], txt);
      });
    }
    function relogioEstado() {
      var r = D.resumo; if (!r) return; var e = r.estado, t = agoraServidor(), desde = e.desde ? ha(t - Date.parse(e.desde)) : '';
      var nome = e.nome === 'pensando' ? 'Pensando' : e.nome === 'comando' ? 'Usando comando' : e.nome === 'esperando' ? 'Esperando você' : e.nome === 'parada' ? 'Parada' : '?';
      poe(estado, nome + (desde ? ' ' + desde : '')); no.dataset.estado = e.nome;
      var det = e.nome === 'pensando' ? (e.porque === 'fala' ? 'leu a sua fala' : e.porque === 'resultado' ? 'leu a saída do comando' : e.porque === 'volta' ? 'leu uma volta' : e.porque === 'pensou' ? 'terminou de pensar; montando o próximo passo' : 'escrevendo')
        : e.nome === 'comando' ? tx(e.ferramenta) + ': ' + tx(e.detalhe)
        : e.nome === 'esperando' ? (e.porque === 'escolha' ? 'tela de escolha aberta: ' + tx(e.detalhe) : 'terminou com uma pergunta: ' + tx(e.detalhe))
        : e.nome === 'parada' ? 'turno fechado; espera a sua próxima fala ou uma volta' : 'sem leitura. Solução: fale com a COORDENADOR e a tela acorda';
      if ((e.nome === 'pensando' || e.nome === 'comando') && typeof e.silencioMs === 'number' && e.silencioMs + (Date.now() - D.lidoEm) > 300000) det += ' · sem linha nova no registro ' + ha(e.silencioMs + (Date.now() - D.lidoEm)) + ' (o app pode estar fechado)';
      poe(detalhe, det);
      var aberta = e.nome === 'esperando' && e.porque === 'escolha';
      espera.hidden = !aberta; if (aberta) poe(espera, 'ESPERANDO VOCÊ ' + desde + ' · tela de escolha aberta: ' + tx(e.detalhe) + ' · responda no chat da COORDENADOR');
      poe(lido, D.registro ? 'registro ' + tx(D.registro.arquivo).slice(0, 8) + '… · lido ' + ha(Date.now() - D.lidoEm) : '');
    }
    function pintar(novos) {
      no.classList.toggle('is-so-dono', !!D.soDono);
      if (D.soDono || D.falta) { q.hidden = false; corpo.hidden = !!D.soDono || !D.resumo; q.replaceChildren(h('b', 'cru-q-marca', D.soDono ? 'Só do dono' : '?'), ' ', h('span', 'cru-q-texto', tx(D.falta))); if (D.soDono || !D.resumo) return; } else { q.hidden = true; corpo.hidden = false; }
      var r = D.resumo; if (!r) return;
      var lista = novos && novos.length ? novos : E.linhas.size ? [] : Array.from(D.eventos.values());
      for (var i = 0; i < lista.length; i++) {
        var e = lista[i], li = E.linhas.get(e.seq);
        if (!li) { li = h('li', 'cru-passo'); li.dataset.seq = String(e.seq); E.linhas.set(e.seq, li); var g = grupoDe(e.turno), irmaos = g.lista.children, ant = null; for (var k = irmaos.length - 1; k >= 0; k--) if (Number(irmaos[k].dataset.seq) < e.seq) { ant = irmaos[k]; break; } if (ant) ant.after(li); else g.lista.prepend(li); if (!D.primeira && !semMovimento()) { li.classList.add('is-novo'); (function (x) { setTimeout(function () { x.classList.remove('is-novo'); }, 1200); })(li); } }
        else if (li.dataset.v === String(e.v)) continue;
        pintarPasso(li, e); li.hidden = !passa(li);
      }
      if (!soFita) { pintarFalas(r.falas || [], !D.primeira); poe(contaEl, 'Desde a sua última fala: ' + conta(r.turno)); pintarDestinos(r.destinos || []); }
      pintarTurnos(r.turnos || [], r.turno.id);
      relogioEstado(); if (lista.length) filtrar();
    }
    var inst = {
      no: no, pintar: pintar, relogio: function () { if (D.resumo && !D.soDono) { relogioEstado(); if (!soFita) relogioDestinos(); } },
      zerar: function () { E.linhas = new Map(); E.turnos = new Map(); E.turnoAtual = -1; fita.replaceChildren(); },
      tirar: function (seq) { var li = E.linhas.get(seq); if (li) { li.remove(); E.linhas.delete(seq); } }
    };

    no.cruFiltrar = function (chave, nome) { if (E.destino !== (chave || '')) escolherDestino(chave || '', nome || ''); };
    instancias.push(inst); if (D.resumo || D.falta) pintar([]); ligar();
    return no;
  }

  var principal = null;
  function no() { if (!principal) principal = criar(null); return principal; }

  function montarNaAgora() { var cols = doc.querySelector('#g-agora .g-cols'); if (cols && !no().isConnected) cols.after(no()); }
  root.PainelCru = { no: no, criar: criar, resumo: function () { return D.resumo; }, hora: hora, dur: dur, ha: ha };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', montarNaAgora); else montarNaAgora();
  setTimeout(montarNaAgora, 1500);
})(typeof window !== 'undefined' ? window : globalThis);
