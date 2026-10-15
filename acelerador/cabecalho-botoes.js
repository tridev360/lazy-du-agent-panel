/* CABECALHO: os 2 botoes WEN e marcha juntos.
 *  - O WEN (status6.js, abre o WEN em tabela) e a marcha (ACELERAR, acelerador.js: o nome da marcha ligada, rosa com a
 *    ROTINA ligada) saem do menu da engrenagem e ficam lado a lado no comeco da direita da barra (#g-bar .g-right).
 *    O AUTOMATIZAR fica no menu (o WEN novo leva ele para o "Mais").
 *  - 3 variantes de desenho pelo endereco (#botoes=a|b|c, no hash: o servidor recusa ?botoes) para escolher; sem ele, a recomendada (PADRAO).
 *  - A barra vira 2 linhas (abas embaixo, com rolagem propria) quando logo + abas + seletor de projeto + direita nao cabem
 *    na largura: medido na hora (ResizeObserver), nunca por largura fixa. Nada sobrepoe em nenhuma largura.
 * Sem estilo inline (CSP do painel): so classes e data-*. No node exporta as regras: require('./cabecalho-botoes.js'). */
(function (root) {
  'use strict';
  const VARIANTES = ['a', 'b', 'c'];
  const PADRAO = 'a';
  function variante(search) { const m = /(?:^|[?&#])botoes=([^&#]*)/.exec(String(search || '')); return m && VARIANTES.includes(m[1]) ? m[1] : PADRAO; }
  // 1 linha so se tudo cabe; sem medida (pagina escondida, largura 0) nao troca nada
  function precisaDuasLinhas(m) {
    if (!m || !(m.disponivel > 0)) return false;
    return m.logo + m.abas + m.seletor + m.direita + m.vaos > m.disponivel;
  }
  function montarDuo(doc, search) {
    const right = doc.querySelector('#g-bar .g-right');
    if (!right) return null;
    let duo = doc.getElementById('g-duo');
    if (!duo) {
      duo = doc.createElement('div'); duo.id = 'g-duo'; duo.className = 'g-duo';
      duo.setAttribute('role', 'group'); duo.setAttribute('aria-label', 'WEN e marcha');
      right.prepend(duo);
    }
    duo.dataset.botoes = variante(search);
    const wen = doc.getElementById('wen-trigger');
    if (wen && wen.parentNode !== duo) duo.prepend(wen);
    const host = doc.getElementById('gancho-acelerador');
    if (host && host.parentNode !== duo) {
      host.hidden = false;
      // a marcha fica no par tambem no celular (sem isso ela entra na barra do WEN, que agora mora no menu)
      host.setAttribute('data-acel-fixo', '');
      duo.append(host);
    }
    return duo;
  }
  const exportado = { VARIANTES, PADRAO, variante, precisaDuasLinhas, montarDuo };
  if (typeof module !== 'undefined' && module.exports) module.exports = exportado;
  if (!root.document || root.PainelCabecalho) return;
  root.PainelCabecalho = exportado;
  const doc = root.document, html = doc.documentElement;

  // ---------- 2 linhas medidas ----------
  function larg(n) { return n ? n.getBoundingClientRect().width : 0; }
  function medir() {
    const wrap = doc.querySelector('#g-bar .g-wrap'), tabs = wrap && wrap.querySelector('.g-tabs');
    if (!wrap || !tabs) return;
    const st = root.getComputedStyle(wrap), pad = parseFloat(st.paddingLeft) + parseFloat(st.paddingRight), gap = parseFloat(st.columnGap) || 0;
    // largura natural das abas: a soma das abas (em 2 linhas a faixa estica e o scrollWidth nao serve)
    let abas = 0; for (const t of tabs.children) abas += larg(t);
    const itens = [wrap.querySelector('.g-logo'), tabs, wrap.querySelector('.pg-caixa'), wrap.querySelector('.g-right')].filter(Boolean);
    const m = { disponivel: wrap.clientWidth - pad, logo: larg(wrap.querySelector('.g-logo')), abas, seletor: larg(wrap.querySelector('.pg-caixa')), direita: larg(wrap.querySelector('.g-right')), vaos: gap * (itens.length - 1) + 8 };
    const dois = precisaDuasLinhas(m); exportado.ultima = Object.assign({ duasLinhas: dois }, m);
    if (html.classList.contains('g-bar-2l') !== dois) html.classList.toggle('g-bar-2l', dois);
  }
  let pedido = 0;
  const agendar = () => { if (pedido) return; pedido = root.requestAnimationFrame(() => { pedido = 0; medir(); }); };

  // ---------- montagem (a barra nasce no vistas.js; a marcha pode montar ate 1,5 s depois) ----------
  let tentativas = 0, observador = null, mudancas = null;
  function tentar() {
    const duo = montarDuo(doc, root.location ? (root.location.search || '') + (root.location.hash || '') : '');
    const pronto = duo && doc.getElementById('wen-trigger') && doc.getElementById('acel-trigger');
    if (duo) {
      try { const a = root.PainelAcelerador && root.PainelAcelerador.instancia; if (a && typeof a.lugar === 'function') a.lugar(); } catch { /* sem a marcha: so o WEN */ }
      if (!observador && root.ResizeObserver) { observador = new root.ResizeObserver(agendar); const w = doc.querySelector('#g-bar .g-wrap'); if (w) observador.observe(w); observador.observe(duo); }
      // o seletor de projeto pode entrar na barra depois da 1a medida: entrada ou saida de item mede de novo
      if (!mudancas && root.MutationObserver) { const w = doc.querySelector('#g-bar .g-wrap'); if (w) { mudancas = new root.MutationObserver(agendar); mudancas.observe(w, { childList: true }); } }
      agendar();
    }
    if (!pronto && ++tentativas < 40) root.setTimeout(tentar, 250);
  }
  root.addEventListener('resize', agendar);
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(agendar).catch(() => {});
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', tentar, { once: true }); else tentar();
})(typeof window === 'undefined' ? globalThis : window);
