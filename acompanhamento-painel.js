(function (root) {
  'use strict';
  var ID = 'g-andamento', ALVO = 'andamento', MINUTO = 60000, API = '/api/meu-andamento';
  var PAGINA_VIDEOS = ''; 
  var VIDEOS = [];

  function el(doc, tag, cls, texto, id) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (id) n.id = id;
    if (texto !== undefined && texto !== null) n.textContent = String(texto);
    return n;
  }

  function casca(doc) {
    var sec = el(doc, 'section', 'g-view ma-vista', null, ID);
    sec.setAttribute('aria-label', 'Meu andamento: todos os projetos');
    if (sec.dataset) sec.dataset.dsOwned = 'andamento';

    var topo = el(doc, 'div', 'ma-topo');
    var titulo = el(doc, 'div', 'titulo');
    titulo.append(el(doc, 'h2', 'ma-h', 'Meu andamento'), el(doc, 'p', 'sub', 'Todos os projetos num lugar só, lidos do estado da sua equipe.'));
    var lado = el(doc, 'div', 'topo');
    var quando = el(doc, 'p', 'quando');
    quando.append(el(doc, 'i', 'pulsa'), el(doc, 'span', null, 'Atualizado ?', 'ma-quando'), el(doc, 'b', null, 'Próxima volta da sua equipe: ?', 'ma-proxima'));
    var botao = el(doc, 'button', 'botao', 'Modo mamífero: só o resumo', 'mam');
    botao.setAttribute('type', 'button');
    botao.setAttribute('aria-pressed', 'false');
    lado.append(quando, botao);
    topo.append(titulo, lado);

    var aviso = el(doc, 'p', 'aviso', 'Lendo o estado da sua equipe...', 'ma-aviso');
    var agora = el(doc, 'section', 'secao', null, 'ma-agora');
    agora.setAttribute('aria-label', 'Agora');
    var espera = el(doc, 'section', 'secao', null, 'ma-espera');
    espera.setAttribute('aria-label', 'O que espera você');
    var diario = el(doc, 'section', 'diario', null, 'ma-diario');
    diario.hidden = true;

    var videos = el(doc, 'section', 'videos', null, 'videos');
    videos.setAttribute('aria-label', 'Vídeos');
    var grade = el(doc, 'div', 'vd-grade');
    VIDEOS.forEach(function (t) {
      var a = el(doc, 'a', null, t);
      a.setAttribute('href', PAGINA_VIDEOS);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      grade.append(a);
    });
    videos.hidden=true;

    var rodape = el(doc, 'div', 'ma-rodape', null, 'ma-rodape');
    rodape.append(el(doc, 'span', null, 'Esta vista lê o estado de novo sozinha a cada minuto, enquanto está aberta.'), el(doc, 'span', null, 'Números do estado da sua equipe; "?" quando ainda não existe resultado.'));

    sec.append(topo, el(doc, 'div', 'frase', null, 'ma-chips'), aviso, agora, espera, el(doc, 'div', 'raiz', null, 'ma-raiz'), el(doc, 'section', null, null, 'ma-trilhas'), diario, videos, rodape);
    return sec;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { casca: casca, VIDEOS: VIDEOS, ID: ID };

  if (!root || !root.document || !root.document.documentElement || typeof root.MutationObserver !== 'function') return;
  var doc = root.document, html = doc.documentElement, S = { sec: null, lido: false, timer: 0, buscando: false };
  var ativa = function () { return html.dataset.gNew === ALVO && !doc.hidden; };

  function falha(texto) {
    var aviso = doc.getElementById('ma-aviso');
    if (aviso && !S.lido) aviso.textContent = texto;
  }
  function carregar() {
    var P = root.MeuAndamentoPagina;
    if (!P || S.buscando) { if (!P) falha('? A vista não carregou. Solução: recarregue o painel.'); return; }
    S.buscando = true;
    root.fetch(API, { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(function (res) { return res.json(); })
      .then(function (d) { S.buscando = false; if (P.montar(doc, d)) S.lido = true; })
      .catch(function () { S.buscando = false; falha('? O painel não respondeu agora. Solução: tento de novo sozinho no próximo minuto.'); });
  }
  function montar() {
    if (S.sec) return true;
    var main = doc.querySelector('main');
    if (!main) return false;
    S.sec = casca(doc);
    var anterior=doc.getElementById(ID);if(anterior)anterior.replaceWith(S.sec);else main.append(S.sec);
    var P = root.MeuAndamentoPagina, arm = null;
    try { arm = root.localStorage; } catch (e) { arm = null; }
    if (P) P.mamifero(doc, doc.getElementById('mam'), { hash: '', armazem: arm, alvo: S.sec });
    S.sec.addEventListener('click', function (ev) {
      var a = ev.target && ev.target.closest ? ev.target.closest('a') : null, href = a ? a.getAttribute('href') || '' : '';
      if (!a || href.charAt(0) !== '#') return;
      ev.preventDefault();
      var alvo = doc.getElementById(href.slice(1));
      if (alvo && alvo.scrollIntoView) alvo.scrollIntoView({ block: 'start', behavior: html.dataset.motion==='off'||(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches)?'auto':'smooth' });
    });
    return true;
  }
  function quandoMuda() {
    if (!montar() || !ativa()) return;
    carregar();
    if (!S.timer) S.timer = root.setInterval(function () { if (ativa()) carregar(); }, MINUTO);
  }
  quandoMuda();
  new root.MutationObserver(quandoMuda).observe(html, { attributes: true, attributeFilter: ['data-g-new'] });
  doc.addEventListener('visibilitychange', quandoMuda);
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', quandoMuda);
})(typeof window !== 'undefined' ? window : null);
