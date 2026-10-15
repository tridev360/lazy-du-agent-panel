/* tema.js (08/10): escolhe o tema do painel antes da 1a pintura: grade (padrao) | livro | folha.
   Fica guardado so neste navegador (localStorage). #...&tema=livro na barra de endereco tambem escolhe. Sem rede. */
(function () {
  'use strict';
  var TEMAS = ['grade', 'livro', 'folha'], KEY = 'painel-tema', html = document.documentElement;
  function ler() {
    var m = /(?:^#|&)tema=(grade|livro|folha)\b/.exec(location.hash || ''); if (m) return m[1];
    try { var v = localStorage.getItem(KEY); if (TEMAS.indexOf(v) >= 0) return v; } catch (e) { /* sem armazenamento: padrao */ }
    return 'grade';
  }
  function set(t) {
    if (TEMAS.indexOf(t) < 0) t = 'grade';
    html.dataset.theme = t;
    try { localStorage.setItem(KEY, t); } catch (e) { /* so nesta visita */ }
    try { window.dispatchEvent(new CustomEvent('painel-tema', { detail: t })); } catch (e) { /* navegador antigo */ }
  }
  html.dataset.theme = ler();
  window.PainelTema = { set: set, atual: function () { return html.dataset.theme; }, TEMAS: TEMAS };
})();
