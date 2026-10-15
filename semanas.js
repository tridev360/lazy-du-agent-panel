
(function (root) {
  'use strict';

  const VELHO_MIN = 360, CARTAO_MAX = 5, AVISO_VELHO = 'Pode estar velho; peça um WEN.';
  const LEGENDA = [
    { estado: 'pronto', nome: 'Pronto', explica: 'já saiu ou está feito' },
    { estado: 'obra', nome: 'Em obra', explica: 'alguém está fazendo agora' },
    { estado: 'depende', nome: 'Depende', explica: 'espera um passo de outro ou seu' },
    { estado: 'depois', nome: 'Depois', explica: 'ainda não começou' }
  ];
  const NOME_ESTADO = { pronto: 'Pronto', obra: 'Em obra', depende: 'Depende', depois: 'Depois', '?': 'Estado sem leitura' };

  function idadeTexto(iso, agora) {
    const t = typeof iso === 'string' ? Date.parse(iso) : NaN, now = Number.isFinite(agora) ? agora : Date.now();
    const aviso = AVISO_VELHO;
    if (!Number.isFinite(t) || t - now > 120000) return { texto: 'atualizado há ?', min: null, velho: true, aviso };
    const min = Math.max(0, Math.floor((now - t) / 60000));
    let texto;
    if (min < 1) texto = 'atualizado agora';
    else if (min < 60) texto = 'atualizado há ' + min + ' min';
    else if (min < 2880) texto = 'atualizado há ' + Math.floor(min / 60) + ' h';
    else texto = 'atualizado há ' + Math.floor(min / 1440) + ' d';
    return { texto, min, velho: min > VELHO_MIN, aviso: min > VELHO_MIN ? aviso : '' };
  }

  function idadeDados(d, agora) {
    if (!d || !d.lido) return { texto: '', min: null, velho: false, aviso: '' };
    return idadeTexto(d.atualizado, agora);
  }

  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function dataCurta(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || '')), mes = m ? Number(m[2]) : 0, dia = m ? Number(m[3]) : 0;
    return m && mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31 ? dia + ' de ' + MESES[mes - 1] : v;
  }

  function cartao(semana) {
    if (!semana || !Array.isArray(semana.itens)) return null;
    const itens = semana.itens, escolha = new Set();
    itens.forEach((it, i) => { if (it.dele && escolha.size < CARTAO_MAX) escolha.add(i); });
    itens.forEach((it, i) => { if (escolha.size < CARTAO_MAX) escolha.add(i); });
    const vistos = itens.filter((_, i) => escolha.has(i));

    return { titulo: semana.titulo, datas: semana.datas, meta: semana.meta, itens: vistos, restantes: itens.length - vistos.length + (semana.cortados > 0 ? semana.cortados : 0) };
  }
  const api = { idadeTexto, idadeDados, cartao, dataCurta, LEGENDA, VELHO_MIN, CARTAO_MAX, AVISO_VELHO };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  if (!root.document) return;

  const doc = root.document, html = doc.documentElement;
  const EXEMPLO = /[?&]exemplo=1\b/.test(root.location.search || '');
  const S = { dados: null, assinatura: '', erro: false, lendo: false, lidoEm: 0, aberta: false, botao: null, gaveta: null, cartao: null, idade: [], ultimoFoco: null };
  const NS = 'http://www.w3.org/2000/svg';

  function h(tag, cls, ...kids) { const n = doc.createElement(tag); if (cls) n.className = cls; for (const k of kids) { if (k === null || k === undefined || k === false) continue; n.append(k.nodeType ? k : String(k)); } return n; }
  const MAIS = { anuncio: 'anúncio', estrategias: 'estratégias', estrategia: 'estratégia', nucleo: 'núcleo', ate: 'até', voce: 'você', alem: 'além', tambem: 'também', so: 'só', ja: 'já', ultimo: 'último', simulacao: 'simulação', simulacoes: 'simulações', historico: 'histórico', previa: 'prévia', pagina: 'página', video: 'vídeo', circulo: 'círculo', robo: 'robô', seguranca: 'segurança', automacoes: 'automações', unica: 'única', cartao: 'cartão', sao: 'são', historia: 'história', conteudo: 'conteúdo', publico: 'público', codigo: 'código', botao: 'botão', cronograma: 'cronograma' };
  function acc(s) {
    let v = String(s === null || s === undefined ? '' : s);

    if (root.PainelNomes && typeof root.PainelNomes.datas === 'function') v = root.PainelNomes.datas(v);
    if (root.PainelNomes && typeof root.PainelNomes.acentos === 'function') v = root.PainelNomes.acentos(v);
    v = v.replace(/[A-Za-z]+/g, w => { const a = MAIS[w.toLowerCase()]; if (!a || a === w.toLowerCase()) return w; return w.charAt(0) === w.charAt(0).toUpperCase() ? a.charAt(0).toUpperCase() + a.slice(1) : a; });
    return v.replace(/\b(Du)s\b/g, '$1');
  }

  const chip = q => (root.PainelNomes && typeof root.PainelNomes.nome === 'function' ? root.PainelNomes.nome(q) : acc(q));

  async function getJSON(url) {
    if (EXEMPLO) url += '?exemplo=1';
    const c = new AbortController(), t = setTimeout(() => c.abort(), 15000);
    try { const r = await root.fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' }, signal: c.signal }); if (!r.ok) throw Error(String(r.status)); return await r.json(); }
    finally { clearTimeout(t); }
  }


  function bolinha(estado) { const ok = !!NOME_ESTADO[estado] && estado !== '?', b = h('i', 'sm-dot is-' + (ok ? estado : 'x'), ok ? null : '?'); b.setAttribute('aria-hidden', 'true'); return b; }
  function linhaItem(it, compacto) {
    const nomeEstado = NOME_ESTADO[it.estado] || NOME_ESTADO['?'];
    const li = h('li', 'sm-item is-' + (NOME_ESTADO[it.estado] ? it.estado : 'x') + (it.dele ? ' tem-dele' : ''));
    const corpo = h('div', 'sm-corpo');
    corpo.append(h('span', 'sm-txt', h('span', 'sm-sr', nomeEstado + ': '), acc(it.soDono && it.soDono.texto ? it.soDono.texto : it.texto))); // S2: soDono so chega no modo dono
    const meta = h('div', 'sm-meta');
    if (it.dele) meta.append(h('span', 'sm-seu', acc(it.dele)));
    if (it.data && it.data !== '?') { const d = h('span', 'sm-data', acc(dataCurta(it.data))); d.dataset.f2Cru = '1'; meta.append(d); }
    for (const q of it.quem || []) { const c = h('span', 'sm-quem', chip(q)); c.dataset.f2Cru = '1'; meta.append(c); }
    if (meta.children.length && !(compacto && !it.dele && !(it.quem || []).length)) corpo.append(meta);
    li.append(bolinha(it.estado), corpo);
    return li;
  }
  function cru(n) { n.dataset.f2Cru = '1'; return n; }
  function legenda() {
    const ul = h('ul', 'sm-legenda'); ul.setAttribute('aria-label', 'Legenda das cores');
    for (const l of LEGENDA) { const li = h('li', 'sm-leg', bolinha(l.estado), h('span', '', h('b', '', l.nome), ' ', h('span', 'sm-leg-e', l.explica))); ul.append(li); }
    return ul;
  }
  function blocoSemana(s, n) {
    const sec = h('section', 'sm-sem' + (n === 0 ? ' is-agora' : '')); sec.setAttribute('aria-labelledby', 'sm-t-' + s.id);
    const t = h('h3', 'sm-sem-t', acc(s.titulo)); t.id = 'sm-t-' + s.id;
    sec.append(h('div', 'sm-sem-cab', t, s.datas ? cru(h('span', 'sm-sem-datas', acc(s.datas))) : null));
    if (s.meta) sec.append(h('p', 'sm-sem-meta', acc(s.meta)));
    const ul = h('ul', 'sm-lista');
    if (s.itens.length) for (const it of s.itens) ul.append(linhaItem(it, false)); else ul.append(h('li', 'sm-vazio', 'Nenhum item nesta semana ainda.'));
    sec.append(ul);

    if (s.cortados > 0) sec.append(h('p', 'sm-corte', '+' + s.cortados + (s.cortados === 1 ? ' item' : ' itens') + ' desta semana não cabem aqui'));
    return sec;
  }
  function semLeitura(d) {
    return h('div', 'sm-falta', h('span', 'sm-q', '?'), h('div', '', h('b', '', 'As semanas ainda não chegaram.'), h('span', '', d && d.falta ? acc(String(d.falta)) : 'A COORDENADOR grava as semanas no próximo WEN.')));
  }

  function montarGaveta() {
    if (S.gaveta) return S.gaveta;
    const g = h('aside', 'sm-gaveta'); g.id = 'sm-gaveta'; g.hidden = true; g.dataset.dsOwned = 'semanas';
    g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'false'); g.setAttribute('aria-labelledby', 'sm-gaveta-t');
    const fecha = h('button', 'sm-fecha', 'Fechar'); fecha.type = 'button'; fecha.id = 'sm-fecha'; fecha.setAttribute('aria-label', 'Fechar as semanas');
    fecha.addEventListener('click', () => fechar(true));
    const t = h('h2', 'sm-gaveta-t', 'Próximas entregas por semana'); t.id = 'sm-gaveta-t';
    const idade = h('p', 'sm-idade'); idade.id = 'sm-idade'; idade.setAttribute('role', 'status'); idade.setAttribute('aria-live', 'off');
    const aviso = h('p', 'sm-aviso'); aviso.id = 'sm-aviso'; aviso.hidden = true;
    const corpo = h('div', 'sm-gaveta-corpo'); corpo.id = 'sm-corpo';
    g.append(h('div', 'sm-gaveta-cab', t, fecha), idade, aviso, legenda(), corpo);
    doc.body.append(g);
    S.gaveta = g;
    return g;
  }
  function pintarGaveta() {
    const g = S.gaveta; if (!g) return;
    const corpo = g.querySelector('#sm-corpo'), d = S.dados;
    if (!d) { corpo.replaceChildren(h('p', 'sm-lendo', S.erro ? '?' : 'Lendo as semanas...')); if (S.erro) corpo.replaceChildren(semLeitura(null)); return; }
    if (!d.lido || !d.semanas.length) { corpo.replaceChildren(semLeitura(d)); return; }
    const frag = doc.createDocumentFragment();
    d.semanas.forEach((s, n) => frag.append(blocoSemana(s, n)));
    if (d.semanasCortadas > 0) frag.append(h('p', 'sm-corte', '+' + d.semanasCortadas + (d.semanasCortadas === 1 ? ' semana' : ' semanas') + ' mais adiante não cabem aqui'));
    if (d.nota) frag.append(h('p', 'sm-nota', acc(d.nota)));
    corpo.replaceChildren(frag);
  }
  function pintarIdade() {
    const d = S.dados, p = doc.getElementById('sm-idade'), av = doc.getElementById('sm-aviso');
    if (p) {
      const i = idadeDados(d); // sem leitura: idade vazia e aviso escondido (S3)
      if (p.textContent !== i.texto) p.textContent = i.texto;
      p.hidden = !i.texto;
      if (av) { av.hidden = !i.velho; if (i.velho) av.textContent = i.aviso; }
    }
    const c = S.cartao && S.cartao.querySelector('.sm-c-idade');
    if (c) { const i = idadeDados(d); if (c.textContent !== i.texto) c.textContent = i.texto; c.classList.toggle('is-velho', !!i.velho); }
  }

  function medir() {
    const bar = doc.getElementById('g-bar'), dock = doc.getElementById('g-dock'), voz = doc.getElementById('voz-gaveta');
    const topo = bar ? Math.max(0, Math.round(bar.getBoundingClientRect().bottom)) : 0;
    let base = 0;
    for (const n of [voz, dock]) { if (!n || n.hidden) continue; const r = n.getBoundingClientRect(); if (r.height > 0 && r.top > topo + 160) { base = Math.max(0, Math.round(root.innerHeight - r.top)); break; } }
    html.style.setProperty('--sm-topo', topo + 'px'); html.style.setProperty('--sm-base', base + 'px');
  }

  function vozNaoCabe() {
    const voz = doc.getElementById('voz-gaveta'), bar = doc.getElementById('g-bar');
    return !!(voz && !voz.hidden && bar && voz.getBoundingClientRect().top <= bar.getBoundingClientRect().bottom + 160);
  }
  function abrir() {
    const g = montarGaveta();

    if (vozNaoCabe()) { const f = doc.getElementById('voz-fecha'); if (f) f.click(); }
    S.ultimoFoco = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : S.botao;
    pintarGaveta(); pintarIdade(); medir();
    g.hidden = false; S.aberta = true;
    if (S.botao) S.botao.setAttribute('aria-expanded', 'true');
    html.classList.add('sm-aberta');
    ler(true);
    const f = g.querySelector('#sm-fecha'); if (f) f.focus();
  }
  function fechar(voltaFoco) {
    if (!S.gaveta || !S.aberta) return;
    S.gaveta.hidden = true; S.aberta = false;
    if (S.botao) S.botao.setAttribute('aria-expanded', 'false');
    html.classList.remove('sm-aberta');
    if (voltaFoco) { const alvo = S.botao && S.botao.isConnected ? S.botao : S.ultimoFoco; if (alvo && alvo.focus) alvo.focus(); }
  }
  function alternar() { if (S.aberta) fechar(true); else abrir(); }

  function icone() {
    const s = doc.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 16 16'); s.setAttribute('width', '16'); s.setAttribute('height', '16'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false'); s.classList.add('sm-ico');
    const r = doc.createElementNS(NS, 'path'); r.setAttribute('d', 'M2 3h12v11H2zM2 6h12M5 1v3M11 1v3M5 9h2M9 9h2M5 11.5h2'); r.setAttribute('fill', 'none'); r.setAttribute('stroke', 'currentColor'); r.setAttribute('stroke-width', '1.4'); r.setAttribute('stroke-linejoin', 'miter');
    s.append(r); return s;
  }
  function montarBotao() {
    const dir = doc.querySelector('#g-bar .g-right');
    if (!dir) return false;
    if (S.botao && S.botao.isConnected && S.botao.parentNode === dir) return true;
    let b = S.botao;
    if (!b) {
      b = h('button', 'sm-botao'); b.type = 'button'; b.id = 'sm-botao';
      b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', 'sm-gaveta');
      b.setAttribute('aria-label', 'Semanas: próximas entregas por semana'); b.title = 'Próximas entregas por semana';
      b.append(icone(), h('span', 'sm-botao-nome', 'Semanas'));
      b.addEventListener('click', alternar);
      S.botao = b;
    }
    const duo = dir.querySelector('#g-duo');
    if (duo) duo.after(b); else dir.prepend(b);
    return true;
  }

  function pintarCartao() {
    const c = S.cartao; if (!c) return;
    const d = S.dados, frag = doc.createDocumentFragment();
    const ver = h('button', 'sm-ver', d && d.lido && d.semanas.length > 1 ? 'Ver todas as ' + d.semanas.length + ' semanas' : 'Abrir as semanas', h('span', '', ' →')); ver.type = 'button'; ver.addEventListener('click', abrir);
    const dados = d && d.lido ? cartao(d.semanas[0]) : null;
    frag.append(h('div', 'sm-c-cab', h('h2', 'g-h sm-c-t', dados ? acc(dados.titulo) : 'Esta semana'), dados && dados.datas ? cru(h('span', 'sm-c-datas', acc(dados.datas))) : null, h('span', 'sm-c-idade'), ver));
    if (dados && dados.meta) frag.append(h('p', 'sm-c-meta', acc(dados.meta)));
    if (!dados) { frag.append(S.erro || d ? semLeitura(d) : h('p', 'sm-lendo', 'Lendo as semanas...')); }
    else {
      const ul = h('ul', 'sm-lista sm-lista-c');
      for (const it of dados.itens) ul.append(linhaItem(it, true));
      frag.append(ul);
      if (dados.restantes > 0) { const mais = h('button', 'sm-mais', '+' + dados.restantes + (dados.restantes === 1 ? ' item' : ' itens') + ' nesta semana'); mais.type = 'button'; mais.addEventListener('click', abrir); frag.append(mais); }
    }
    c.replaceChildren(frag);
    pintarIdade();
  }
  function colocarCartao() {
    const c = S.cartao; if (!c) return;
    const fh = html.dataset.theme === 'folha' ? doc.getElementById('fh-agora') : null;
    if (fh) {
      const ent = fh.querySelector('#en-agora'), linha = fh.querySelector('.fh-bloco-linha'), ancora = ent || linha;
      if (ancora) { if (ancora.nextElementSibling !== c) ancora.after(c); } else if (c.parentElement !== fh) fh.append(c);
      return;
    }
    const box = doc.getElementById('g-agora'); if (!box) return;
    const ent = box.querySelector('#en-agora'), cols = box.querySelector('.g-cols'), ancora = ent || cols;
    if (ancora) { if (ancora.nextElementSibling !== c) ancora.after(c); } else if (c.parentElement !== box) box.append(c);
  }
  function montarCartao() {
    if (S.cartao && S.cartao.isConnected) return true;
    const box = doc.getElementById('g-agora'), fh = doc.getElementById('fh-agora');
    if (!box && !fh) return false;
    if (!S.cartao) { const s = h('section', 'sm-cartao'); s.id = 'sm-agora'; s.setAttribute('aria-label', 'Esta semana'); s.dataset.dsOwned = 'semanas'; s.dataset.f2Cru = '1'; S.cartao = s; pintarCartao(); }
    colocarCartao();
    return true;
  }
  function agoraVisivel() { const c = S.cartao; return !!(c && c.isConnected && c.offsetParent !== null); }

  async function ler(forcar) {
    if (S.lendo) return;
    if (!forcar && !S.aberta && !agoraVisivel()) return;
    if (doc.hidden && !forcar) return;
    S.lendo = true;
    try {
      const d = await getJSON('/api/semanas');
      const assin = JSON.stringify(d);
      S.erro = false; S.lidoEm = Date.now();
      if (assin !== S.assinatura) { S.assinatura = assin; S.dados = d; pintarCartao(); if (S.aberta) pintarGaveta(); }
    } catch {
      S.erro = true;
      if (!S.dados) { S.dados = { ok: false, lido: false, semanas: [], falta: 'Não consegui ler agora: o painel tenta de novo sozinho a cada minuto.' }; S.assinatura = ''; pintarCartao(); if (S.aberta) pintarGaveta(); }
    } finally { S.lendo = false; pintarIdade(); }
  }

  function manter() {
    montarBotao(); montarCartao();
    if (S.cartao && S.cartao.isConnected) colocarCartao();
  }
  function start() {
    let n = 0;
    const tentar = () => {
      const a = montarBotao(), b = montarCartao();
      if ((!a || !b) && n++ < 80) { setTimeout(tentar, 250); return; }
      ler(true);

      new MutationObserver(() => {
        manter(); if (Date.now() - S.lidoEm > 30000) ler();

        if (S.aberta) { if (html.dataset.vozConversa === 'aberta' && vozNaoCabe()) fechar(false); else medir(); }
      }).observe(html, { attributes: true, attributeFilter: ['data-g-old', 'data-g-new', 'data-theme', 'class', 'data-voz-conversa'] });
      const bar = doc.getElementById('g-bar'); if (bar) new MutationObserver(() => montarBotao()).observe(bar, { childList: true, subtree: true });
      const ag = doc.getElementById('g-agora'); if (ag) new MutationObserver(() => colocarCartao()).observe(ag, { childList: true });
      root.setInterval(() => { pintarIdade(); ler(); }, 60000);
      doc.addEventListener('visibilitychange', () => { if (!doc.hidden && Date.now() - S.lidoEm > 30000) ler(); });
    };
    doc.addEventListener('keydown', e => { if (e.key === 'Escape' && S.aberta) { e.preventDefault(); fechar(true); } });
    root.addEventListener('resize', () => { if (S.aberta) { if (html.dataset.vozConversa === 'aberta' && vozNaoCabe()) fechar(false); else medir(); } });
    tentar();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => setTimeout(start, 0), { once: true }); else setTimeout(start, 0);
  root.PainelSemanas = Object.freeze({ abrir, fechar: () => fechar(true), ler: () => ler(true), estado: () => ({ aberta: S.aberta, lido: !!(S.dados && S.dados.lido), botao: !!(S.botao && S.botao.isConnected), cartao: !!(S.cartao && S.cartao.isConnected) }) });
})(typeof window === 'object' ? window : globalThis);
