/* blocos-livro.js (fase 2): blocos proprios do tema LIVRO DE ORDENS, por cima da marcacao comum (vistas.js).
   So aparecem com data-theme="livro" (o css esconde nos outros temas e aqui nada le a rede fora do livro).
   1. PLACAR DO DIA (estilo P&L) logo abaixo do Agora: fechadas hoje, delta contra ontem, sparkline de 14 dias, melhor dia,
      sequencia e total de 14 dias; ao lado, a GRADE DE PIXELS de 35 dias (1 pixel = 1 fechada, 1 coluna = 1 dia).
   2. FILL: card que sai da lista de pendentes ou fechada nova no git do estado = linha pisca verde 300 ms, numero com tick,
      pixel novo acende e toast "FILL <item> +1 · sequencia N".
   3. LIVRO DO FLUXO abaixo do mapa: 1 linha por direcao de fio (hora, de, para, tipo, quantas, idade), na cor de quem manda;
      clicar acende o fio no mapa (o mesmo clique do mapa).
   4. FITA na barra: o ultimo evento do motor de animacao (mensagem, card, no ar, gate, acao), como ticker.
   Fonte: /api/livro/dias (blocos-livro-rota.cjs, git log do estado), PainelVistas.fluxoInfo() e PainelAnim.ouvir (eventos ja
   achados pelo motor). So GET; nada grava. Sem leitura = "?". Movimento off: sem animacao (o toast continua, parado).
   Gancho: 1 linha no index.html, depois do vistas.js:
     <link rel="stylesheet" href="/blocos-livro.css"><script defer src="/blocos-livro.js"></script> */
(function (root) {
  'use strict';
  const doc = root.document, html = doc.documentElement, SVGNS = 'http://www.w3.org/2000/svg';
  const ativo = () => html.dataset.theme === 'livro';
  const parado = () => html.dataset.motion === 'off';
  const S = { dias: null, hojeAntes: null, fluxoRef: null, fita: [], timerDias: 0, montado: false };
  const els = {};

  // ---------- utilidades ----------
  function h(tag, cls, ...kids) { const n = doc.createElement(tag); if (cls) n.className = cls; for (const k of kids) { if (k === null || k === undefined || k === false) continue; n.append(k.nodeType ? k : String(k)); } return n; }
  function sv(tag, attrs) { const n = doc.createElementNS(SVGNS, tag); for (const k in attrs || {}) n.setAttribute(k, attrs[k]); return n; }
  const ymd = ms => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const dm = ms => { const d = new Date(ms); return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0'); }; // ms ao meio-dia UTC do dia
  const hm = ms => { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const idade = min => !Number.isFinite(min) ? '?' : min < 1 ? 'agora' : min < 60 ? min + ' min' : min < 2880 ? Math.round(min / 60) + ' h' : Math.round(min / 1440) + ' d';
  const limpa = s => String(s || '').replace(/^[a-z0-9-]+:\s*/i, '').replace(/\s+/g, ' ').trim();
  function marcar(el, cls, ms) { if (!el || parado()) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); clearTimeout(el['_lv_' + cls]); el['_lv_' + cls] = setTimeout(() => el.classList.remove(cls), ms); }
  async function getJSON(url) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), 20000);
    try { const r = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' }, signal: c.signal }); if (!r.ok) throw Error(String(r.status)); return await r.json(); }
    finally { clearTimeout(t); }
  }

  // ---------- serie de dias (fechadas por dia; antes do 1o registro do git = sem leitura, nunca zero) ----------
  // o dia de hoje vem do servidor (mesmo fuso do git); sem leitura, o relogio deste navegador
  function serie(n) {
    const d = S.dias && S.dias.lido ? S.dias.dias || {} : null, primeiro = S.dias && S.dias.primeiroDia, out = [];
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(S.dias && S.dias.hoje || ''), base = m ? Date.UTC(+m[1], +m[2] - 1, +m[3], 12) : null;
    for (let i = n - 1; i >= 0; i--) {
      const ms = base !== null ? base - i * 86400000 : Date.now() - i * 86400000, k = base !== null ? new Date(ms).toISOString().slice(0, 10) : ymd(ms);
      out.push({ k, ms, n: d && primeiro && k >= primeiro ? (d[k] || 0) : null });
    }
    return out;
  }
  function sequencia(s) { let n = 0; for (let i = s.length - 1; i >= 0; i--) { if (s[i].n > 0) n++; else if (i === s.length - 1) continue; else break; } return n; }

  // ---------- montagem (nos proprios, irmaos das vistas; o vistas.js troca so o miolo delas) ----------
  function montar() {
    const agora = doc.getElementById('g-agora'), fluxo = doc.getElementById('g-fluxo'); if (!agora || !fluxo) return false;
    const placar = h('section', 'lv-bloco lv-placar-dia'); placar.id = 'lv-placar'; placar.setAttribute('aria-label', 'Placar do dia');
    const fios = h('section', 'lv-bloco lv-livro-fios'); fios.id = 'lv-fios'; fios.setAttribute('aria-label', 'Livro do fluxo');
    const toast = h('div', 'lv-toast'); toast.id = 'lv-toast'; toast.hidden = true; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite');
    for (const n of [placar, fios, toast]) n.dataset.dsOwned = 'livro';
    agora.after(placar); fluxo.after(fios); doc.body.append(toast);
    Object.assign(els, { placar, fios, toast });
    fitaNaBarra();
    S.montado = true; return true;
  }
  // a fita mora na ponta direita da linha das sub-vistas (o vistas.js refaz essa linha a cada troca: o observador devolve a fita)
  function fitaNaBarra() {
    const sub = doc.getElementById('g-subnav'); if (!sub) return;
    if (!els.fita) { const fita = h('div', 'lv-fita'); fita.id = 'lv-fita'; fita.dataset.dsOwned = 'livro'; fita.setAttribute('role', 'log'); fita.setAttribute('aria-live', 'polite'); fita.setAttribute('aria-label', 'Último evento'); els.fita = fita; }
    if (els.fita.parentElement !== sub || sub.lastElementChild !== els.fita) { sub.append(els.fita); pintarFita(); }
    if (!S.obsSub) { S.obsSub = new MutationObserver(() => { if (els.fita.parentElement !== sub || sub.lastElementChild !== els.fita) sub.append(els.fita); }); S.obsSub.observe(sub, { childList: true }); }
  }

  // ---------- 1. PLACAR DO DIA + GRADE DE 35 DIAS ----------
  function pintarPlacar() {
    const box = els.placar; if (!box || !ativo()) return;
    const s35 = serie(35), s14 = s35.slice(-14), hoje = s35[s35.length - 1], ontem = s35[s35.length - 2], lido = !!(S.dias && S.dias.lido);
    // esquerda: numero heroi, delta, sparkline, chaves
    const pl = h('div', 'lv-pl');
    const num = h('span', 'lv-pl-num', lido && hoje.n !== null ? String(hoje.n) : '?'); num.id = 'lv-hoje-n';
    const lbl = h('div', 'lv-pl-lbl', 'fechadas hoje');
    if (lido && hoje.n !== null && ontem.n !== null) { const d = hoje.n - ontem.n; lbl.append(' · ', h('span', 'lv-delta ' + (d > 0 ? 'is-up' : d < 0 ? 'is-down' : ''), (d > 0 ? '+' : '') + d), ' vs ontem'); }
    else lbl.append(' · ? vs ontem');
    const spark = sv('svg', { viewBox: '0 0 140 40', preserveAspectRatio: 'none', class: 'lv-spark', 'aria-hidden': 'true' });
    const pts14 = s14.filter(x => x.n !== null);
    if (lido && pts14.length >= 2) {
      const mx = Math.max(1, ...pts14.map(x => x.n)), off = 14 - pts14.length, pts = pts14.map((x, i) => [(i + off) * (140 / 13), 38 - (x.n / mx) * 34]);
      spark.append(sv('path', { d: 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L') + ' L' + pts[pts.length - 1][0].toFixed(1) + ' 40 L' + pts[0][0].toFixed(1) + ' 40 Z', class: 'lv-spark-area' }));
      spark.append(sv('path', { d: 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L'), class: 'lv-spark-l', 'vector-effect': 'non-scaling-stroke' }));
      const l = pts[pts.length - 1]; spark.append(sv('path', { d: 'M' + l[0].toFixed(1) + ' ' + l[1].toFixed(1) + ' L' + l[0].toFixed(1) + ' ' + l[1].toFixed(1), class: 'lv-spark-p', 'vector-effect': 'non-scaling-stroke' })); // ponto redondo mesmo com o svg esticado
    }
    const melhor = lido ? s35.reduce((a, b) => (b.n !== null && b.n > a.n ? b : a), { n: -1 }) : null;
    const kv = h('div', 'lv-kv',
      h('span', '', 'melhor dia ', h('b', '', melhor && melhor.n > 0 ? dm(melhor.ms) + ' · ' + melhor.n : '?')),
      h('span', '', 'sequência ', h('b', '', lido ? String(sequencia(s35)) : '?'), ' dias'),
      h('span', '', '14 dias ', h('b', '', lido && pts14.length ? String(pts14.reduce((a, b) => a + b.n, 0)) : '?')));
    const fonte = h('p', 'lv-fonte', lido ? 'fechada = registro com PODE SUBIR, CONFERE, no ar, checagem verde, fechado ou commitado no estado' : 'sem leitura do git do estado (?)');
    pl.append(h('div', 'lv-pl-top', num, lbl), spark, kv, fonte);
    // direita: 35 colunas x 16 pixels
    const px = h('div', 'lv-pix'), grid = h('div', 'lv-pix-grid'); grid.setAttribute('role', 'img');
    grid.setAttribute('aria-label', '35 dias de fechadas' + (lido ? ', hoje ' + (hoje.n === null ? '?' : hoje.n) : ', sem leitura'));
    for (const d of s35) {
      const col = h('div', 'lv-pix-col' + (d === hoje ? ' is-hoje' : '') + (d.n === null ? ' is-semleitura' : '') + (d.n >= 16 ? ' is-cheia' : ''));
      col.title = dm(d.ms) + ': ' + (d.n === null ? '? (sem registro no git)' : d.n + (d.n === 1 ? ' fechada' : ' fechadas'));
      for (let i = 0; i < 16; i++) col.append(h('b', d.n !== null && i < d.n ? 'on' : ''));
      grid.append(col);
    }
    px.append(grid, h('div', 'lv-pix-axis', h('span', '', dm(s35[0].ms)), h('span', '', '1 pixel = 1 fechada · coluna cheia = 16 ou mais'), h('span', '', 'hoje')));
    box.replaceChildren(pl, px);
  }
  async function lerDias(doLaco) {
    if (!ativo() || (doLaco === true && doc.hidden)) return;
    let j = null; S.lendoDias = (S.lendoDias || 0) + 1; try { j = await getJSON('/api/livro/dias'); S.erroDias = null; } catch (e) { S.erroDias = String(e && e.message || e); /* fica a leitura anterior */ }
    if (j) S.dias = j;
    const hojeN = S.dias && S.dias.lido ? (S.dias.dias || {})[S.dias.hoje] || 0 : null;
    pintarPlacar();
    if (S.hojeAntes !== null && hojeN !== null && hojeN > S.hojeAntes) { const f = (S.dias.fechadasHoje || [])[0]; fill(f ? limpa(f.msg) : 'fechada nova', null, true); }
    if (hojeN !== null) S.hojeAntes = hojeN;
  }

  // ---------- 2. FILL ----------
  let toastTimer = 0;
  function toast(tag, texto, extra) {
    const t = els.toast; if (!t) return;
    t.replaceChildren(h('b', '', tag), h('span', '', texto), extra ? h('em', '', extra) : null); t.hidden = false;
    marcar(t, 'is-entra', 320);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function fill(texto, idLinha, pixelNovo) {
    if (!ativo()) return;
    const s = serie(35), seq = S.dias && S.dias.lido ? Math.max(1, sequencia(s)) : '?';
    const row = idLinha ? doc.querySelector('#g-agora .g-item[data-id="' + CSS.escape(idLinha) + '"]') : null;
    marcar(row, 'lv-fill', 320);
    marcar(doc.getElementById('lv-hoje-n'), 'is-tick', 320);
    const col = els.placar && els.placar.querySelector('.lv-pix-col.is-hoje');
    if (col) { const on = col.querySelectorAll('b.on'); const alvo = pixelNovo ? on[on.length - 1] : on[on.length - 1] || col.querySelector('b'); marcar(alvo, 'is-novo', 320); }
    toast('FILL', String(texto || 'card respondido').slice(0, 70), '+1 · sequência ' + seq);
    // som: entraria aqui (desligado por padrao; o mudo do painel e o Movimento off continuam valendo)
  }

  // ---------- 3. LIVRO DO FLUXO ----------
  function nomeDe(F, id) {
    if (id === 'voce') return 'Você';
    if (F && F.nomes && F.nomes[id]) return F.nomes[id];
    const n = F && F.nos.find(x => x.id === id), t = n && n.el.querySelector('.g-no-t');
    return t ? t.textContent.trim() : String(id || '?');
  }
  const TIPO = { comando: 'comando', duvida: 'dúvida', resposta: 'resposta' };
  function pintarFios() {
    const box = els.fios; if (!box || !ativo()) return;
    const V = root.PainelVistas, F = V && typeof V.fluxoInfo === 'function' ? V.fluxoInfo() : null;
    S.fluxoRef = F;
    const linhas = [];
    if (F) for (const f of F.fios) for (const d of [f.ida, f.volta]) {
      if (!d) continue; const de = d === f.ida ? f.de : f.para, para = d === f.ida ? f.para : f.de;
      linhas.push({ key: f.key, sel: f.el && f.el.dataset.sel === '1', de: nomeDe(F, de), para: nomeDe(F, para), lado: d.sender || 'claude', kind: d.kind || 'comando', n: d.count || 0, hora: d.last || '?', min: Number.isFinite(d.ageMin) ? d.ageMin : null, recent: !!d.recent });
    }
    linhas.sort((a, b) => (a.min === null) - (b.min === null) || (a.min || 0) - (b.min || 0) || b.n - a.n);
    // sem hora em nenhuma mensagem: as colunas HORA e IDADE saem (nada de coluna inteira de "?") e o cabecalho diz o porque
    const comHora = linhas.some(l => l.min !== null), ordem = comHora ? 'a mais nova em cima' : 'mais mensagens em cima · o fluxo não traz a hora de cada mensagem; a coluna de hora volta sozinha quando trouxer';
    const head = h('div', 'lv-bhead', h('h2', 'g-h', 'Livro do fluxo'), h('span', 'g-sec', F ? linhas.length + (linhas.length === 1 ? ' direção' : ' direções') + ' nas últimas 2 h · ' + ordem + ' · clique para acender o fio' : 'lendo o fluxo, volta sozinho em segundos'));
    const tab = h('div', 'lv-tab' + (comHora ? '' : ' is-sem-hora')); tab.setAttribute('role', 'table');
    const cab = h('div', 'lv-tr lv-th', comHora ? h('span', '', 'HORA') : null, h('span', '', 'DE'), h('span', '', 'PARA'), h('span', '', 'TIPO'), h('span', 'is-num', 'QTD'), comHora ? h('span', 'is-num', 'IDADE') : null); cab.setAttribute('role', 'row');
    tab.append(cab);
    for (const l of linhas.slice(0, 14)) {
      const tr = h('button', 'lv-tr' + (l.sel ? ' is-sel' : '') + (l.recent ? ' is-quente' : ''),
        comHora ? h('span', 'lv-mono', l.hora === '?' ? 'sem hora' : l.hora) : null, h('span', 'lv-quem', h('i', 'lv-dot'), l.de), h('span', 'lv-para', l.para), h('span', 'lv-tipo k-' + l.kind, TIPO[l.kind] || l.kind), h('span', 'lv-mono is-num', String(l.n)), comHora ? h('span', 'lv-mono is-num', l.min === null ? '' : idade(l.min)) : null);
      tr.type = 'button'; tr.dataset.lado = l.lado; tr.dataset.key = l.key; tr.setAttribute('role', 'row');
      tr.title = l.de + ' → ' + l.para + ' · ' + (TIPO[l.kind] || l.kind) + ' · ' + l.n + (l.n === 1 ? ' mensagem' : ' mensagens');
      tr.addEventListener('click', () => { const hit = doc.querySelector('#g-fluxo .g-fio[data-key="' + CSS.escape(l.key) + '"] .g-fio-hit'); if (hit) hit.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
      tab.append(tr);
    }
    if (F && !linhas.length) tab.append(h('p', 'g-vazio', 'nenhuma mensagem nas últimas 2 h'));
    box.replaceChildren(head, tab);
    legendaLados();
  }
  // legenda das cores de quem manda, no comeco da legenda do mapa (o vistas.js repinta; aqui so acrescenta se faltar)
  function legendaLados() {
    const leg = doc.querySelector('#g-fluxo .g-legenda'); if (!leg || leg.querySelector('.lv-leg-lado')) return;
    const chip = (lado, txt) => { const b = h('b', '', h('i', ''), txt); b.dataset.lado = lado; return b; };
    const s = h('span', 'lv-leg-lado', chip('voce', 'você'), chip('claude', 'Claude'), chip('codex', 'Codex')); s.title = 'cor do fio = quem mandou';
    leg.prepend(s);
  }

  // ---------- 4. FITA (ultimo evento do motor) ----------
  const ROT = acao => { const PA = root.PaAnim; return PA && PA.ROTULOS && PA.ROTULOS[acao] ? PA.ROTULOS[acao].pt : acao; };
  function textoEvento(ev) {
    const A = root.PainelAnim, F = A && A.kit ? A.kit.F : null, nome = n => n && n.el ? (n.el.querySelector('.g-no-t') || n.el).textContent.trim() : '?';
    switch (ev.tipo) {
      case 'mensagem': return { lado: ev.lado, txt: nomeDe(F, ev.de) + ' → ' + nomeDe(F, ev.para) + ' · ' + (TIPO[ev.kind] || 'comando') };
      case 'card-novo': return { lado: 'voce', txt: 'card novo para você' };
      case 'card-respondido': return { lado: 'ok', txt: 'FILL · card respondido' };
      case 'subiu': return { lado: 'ok', txt: 'NO AR · ' + limpa(ev.texto || '').slice(0, 60) };
      case 'gate-verde': return { lado: 'ok', txt: 'GATE OK · ' + limpa(ev.ramo || '').slice(0, 60) };
      case 'acao': return { lado: ev.no && ev.no.lado, txt: nome(ev.no) + ' · ' + ROT(ev.acao) };
      case 'acorda': return { lado: ev.no && ev.no.lado, txt: nome(ev.no) + ' acordou' };
      case 'dorme': return { lado: 'dorme', txt: nome(ev.no) + ' dormiu' };
      case 'ajudante-nasce': return { lado: ev.no && ev.no.lado, txt: nome(ev.no) + ' +' + (ev.n || 1) + ' ajudante' };
      case 'ajudante-termina': return { lado: 'ok', txt: nome(ev.no) + ' -' + (ev.n || 1) + ' ajudante' };
      case 'erro': return { lado: 'trava', txt: nome(ev.no) + ' sem leitura (?)' };
      default: return null;
    }
  }
  function pintarFita() {
    const f = els.fita; if (!f) return;
    const ult = S.fita[0];
    if (!ult) { f.replaceChildren(h('span', 'lv-fita-h', hm(Date.now())), h('span', 'lv-fita-t is-vazio', 'fita · nada novo desde que abriu')); f.title = 'O último evento do painel aparece aqui (mensagem, card, no ar, gate, ação).'; return; }
    const linha = h('span', 'lv-fita-t', h('i', 'lv-dot'), ult.txt); linha.dataset.lado = ult.lado || '';
    f.replaceChildren(h('span', 'lv-fita-h', ult.hora), linha);
    f.title = S.fita.slice(0, 8).map(e => e.hora + '  ' + e.txt).join('\n');
    marcar(linha, 'is-entra', 320);
  }
  function aoEvento(ev) {
    if (ev && ev.tipo === 'card-respondido') { const li = doc.querySelector('#g-agora .g-item[data-id="' + CSS.escape(String(ev.id || '')) + '"]'), t = li && li.querySelector('.g-txt'); fill(t ? t.textContent.trim() : 'card respondido', ev.id, false); }
    const e = textoEvento(ev); if (!e) return;
    S.fita.unshift({ ...e, hora: hm(Date.now()) }); S.fita.length = Math.min(S.fita.length, 20);
    if (ativo()) pintarFita();
  }

  // ---------- liga e desliga com o tema ----------
  function aplicarTema() {
    if (!S.montado && !montar()) return;
    fitaNaBarra();
    clearInterval(S.timerDias); S.timerDias = 0;
    if (!ativo()) return;
    pintarPlacar(); pintarFios(); pintarFita(); lerDias();
    S.timerDias = setInterval(() => lerDias(true), 120000);
  }
  function laco() {
    if (!S.montado || !ativo()) return;
    fitaNaBarra();
    const V = root.PainelVistas, F = V && typeof V.fluxoInfo === 'function' ? V.fluxoInfo() : null;
    if (F !== S.fluxoRef) pintarFios(); else legendaLados();
  }
  function start() {
    let n = 0;
    const tentar = () => {
      if (!doc.getElementById('g-agora') || !root.PainelVistas) { if (n++ < 60) setTimeout(tentar, 250); return; }
      aplicarTema();
      // tema.js troca o data-theme do <html>; 1 observador basta (o evento painel-tema chega junto)
      new MutationObserver(() => aplicarTema()).observe(html, { attributes: true, attributeFilter: ['data-theme'] });
      if (root.PainelAnim && typeof root.PainelAnim.ouvir === 'function') root.PainelAnim.ouvir(aoEvento);
      setInterval(laco, 1000);
      doc.addEventListener('visibilitychange', () => { if (!doc.hidden && ativo()) lerDias(); });
      // demo so visual: #...&demo=fill toca a recompensa com texto de exemplo (nada e gravado)
      if (/(?:^#|&)demo=fill\b/.test(root.location.hash || '')) setTimeout(() => fill('demo: card respondido', null, true), 3000);
    };
    tentar();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => setTimeout(start, 0), { once: true }); else setTimeout(start, 0);
  root.PainelBlocosLivro = Object.freeze({ fill, estado: () => ({ ativo: ativo(), dias: !!(S.dias && S.dias.lido), leituras: S.lendoDias || 0, erroDias: S.erroDias || null, fita: S.fita.length, montado: S.montado }) });
})(window);
