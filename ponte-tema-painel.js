/* ponte-tema-painel.js (para o PAINEL 3250, só acrescentar; o COORDENADOR aplica com print):
   avisa o app Decidir (iframe da 3259) qual tema o painel está usando (grade, livro, folha) e repete quando ele troca.
   Como ligar: copiar para casa/ferramentas/painel/, servir o arquivo no servidor.cjs (igual ao ideias-app.css)
   e pôr <script src="/ponte-tema-painel.js" defer></script> depois do tema.js no index.html. Sem rede. */
(function () {
  'use strict';
  var APP = (function () { try { var f = document.querySelector('iframe.ideias-frame'); return new URL(f.getAttribute('src')).origin; } catch (e) { return 'http://127.0.0.1:3259'; } })();
  function quadro() { return document.querySelector('.ideias-frame'); }
  function tema() { return (window.PainelTema && window.PainelTema.atual()) || document.documentElement.dataset.theme || 'grade'; }
  function enviar() {
    var f = quadro();
    if (f && f.contentWindow) f.contentWindow.postMessage({ tipo: 'painel-tema', tema: tema() }, APP);
  }
  window.addEventListener('painel-tema', enviar);
  window.addEventListener('message', function (e) {
    if (e.origin === APP && e.data && e.data.tipo === 'decidir-pede-tema') enviar();
  });
  document.addEventListener('DOMContentLoaded', function () { var f = quadro(); if (f) f.addEventListener('load', enviar); });
})();
