/* PAINEL GRADE FINAL: marcacao UNICA das vistas novas (esqueleto de 6 abas + AGORA, EQUIPE > Fluxo e CEREBRO).
   Os 3 temas (grade, livro, folha) so trocam a camada: theme-<tema>.css e anim-<tema>.js, por data-theme no <html> (tema.js).
   Eventos (mensagem, card, subiu, ajudante...) saem daqui para o anim-motor.js, que chama a animacao do tema ligado.
   So leitura: usa o mesmo estado do painel (latestSnapshot) e as rotas GET que ja existem.
   Nada aqui responde card nem manda mensagem: o "Escolher" abre os cards de sempre; a linha de comando e a caixa de sempre. */
(function (root) {
  'use strict';
  const doc = root.document, html = doc.documentElement;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const reduced = () => html.dataset.motion === 'off'; // regra do painel: o Movimento on vence o reduced-motion do sistema

  // ---------- abas e vistas (nada some: as antigas viram sub-vistas) ----------
  const TABS = [
  {
    "key": "agora",
    "label": "Agora",
    "views": [
      {
        "id": "agora",
        "label": "Agora",
        "kind": "new",
        "target": "agora"
      },
      {
        "id": "andamento",
        "label": "Meu andamento",
        "kind": "new",
        "target": "andamento"
      },
      {
        "id": "lancamentos",
        "label": "Lançamentos",
        "kind": "old",
        "target": "launches"
      },
      {
        "id": "cronograma",
        "label": "Cronograma",
        "kind": "extra",
        "target": "cronograma"
      },
      {
        "id": "rotina",
        "label": "Rotina",
        "kind": "extra",
        "target": "rotina"
      }
    ]
  },
  {
    "key": "equipe",
    "label": "Equipe",
    "views": [
      {
        "id": "fluxo",
        "label": "Fluxo",
        "kind": "new",
        "target": "fluxo"
      },
      {
        "id": "arvore",
        "label": "Árvore",
        "kind": "old",
        "target": "team",
        "mode": "Árvore"
      },
      {
        "id": "sessoes",
        "label": "Sessões",
        "kind": "old",
        "target": "sessions"
      },
      {
        "id": "historico",
        "label": "Histórico",
        "kind": "old",
        "target": "flow"
      }
    ]
  },
  {
    "key": "fila",
    "label": "Fila",
    "views": [
      {
        "id": "fila",
        "label": "Fila",
        "kind": "old",
        "target": "queue"
      },
      {
        "id": "projetos",
        "label": "Projetos",
        "kind": "old",
        "target": "projects"
      },
      {
        "id": "chaves",
        "label": "Chaves",
        "kind": "old",
        "target": "chaves"
      }
    ]
  },
  {
    "key": "decidir",
    "label": "Decidir",
    "views": [
      {
        "id": "ideias",
        "label": "Ideias",
        "kind": "old",
        "target": "ideias"
      },
      {
        "id": "conselho",
        "label": "Conselho",
        "kind": "old",
        "target": "council"
      },
      {
        "id": "radar",
        "label": "Radar",
        "kind": "old",
        "target": "radar"
      },
      {
        "id": "revisao",
        "label": "Revisão",
        "kind": "old",
        "target": "revisao"
      }
    ]
  },
  {
    "key": "cerebro",
    "label": "Cérebro",
    "views": [
      {
        "id": "aprendizados",
        "label": "Aprendizados",
        "kind": "new",
        "target": "aprendizados"
      },
      {
        "id": "mapa",
        "label": "Mapa",
        "kind": "new",
        "target": "cerebro"
      },
      {
        "id": "habitos",
        "label": "Hábitos",
        "kind": "old",
        "target": "tips"
      },
      {
        "id": "historia",
        "label": "História",
        "kind": "old",
        "target": "journey"
      },
      {
        "id": "mapa-antigo",
        "label": "Mapa antigo",
        "kind": "old",
        "target": "brain"
      }
    ]
  },
  {
    "key": "caixa",
    "label": "Caixa",
    "views": [
      {
        "id": "financas",
        "label": "Finanças",
        "kind": "old",
        "target": "finances"
      },
      {
        "id": "consumo",
        "label": "Consumo",
        "kind": "old",
        "target": "consumption"
      }
    ]
  }
];
  const S = { tab: 'agora', view: 'agora', snap: null, agora: null, cards: null, contas: null, fluxo: null, frentes: null, cerebro: null, obra: null, obraUi: null, model: null, pendentes: null, combo: [], sel: null, hover: null, demo: /(?:^#|&)demo=recompensa\b/.test(root.location.hash || ''), demoEventos: /(?:^#|&)demo=eventos\b/.test(root.location.hash || ''), fioSel: null };

  // ---------- utilidades ----------
  function h(tag, cls, ...kids) {
    const n = doc.createElement(tag); if (cls) n.className = cls;
    for (const k of kids) { if (k === null || k === undefined || k === false) continue; n.append(k.nodeType ? k : String(k)); }
    return n;
  }
  function svg(w, hgt, scale, rects, color) {
    const s = doc.createElementNS(SVGNS, 'svg'); s.setAttribute('width', w * scale); s.setAttribute('height', hgt * scale); s.setAttribute('viewBox', '0 0 ' + w + ' ' + hgt); s.setAttribute('shape-rendering', 'crispEdges'); s.setAttribute('aria-hidden', 'true');
    for (const [x, y, rw = 1, rh = 1] of rects) { const r = doc.createElementNS(SVGNS, 'rect'); r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', rw); r.setAttribute('height', rh); r.setAttribute('fill', color); s.append(r); }
    return s;
  }
  function grid(rows) { const out = []; rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') out.push([x, y]); })); return out; }
  // icones pixel 8x8, numa cor so
  const ICONS = {
    diamante: ['...#....', '..###...', '.#####..', '#######.', '.#####..', '..###...', '...#....', '........'],
    diamante2: ['...#....', '..#.#...', '.#.#.#..', '#.#.#.#.', '.#.#.#..', '..#.#...', '...#....', '........'],
    diamante3: ['...#....', '........', '.#...#..', '...#....', '.#...#..', '........', '...#....', '........'],
    check: ['........', '......##', '.....##.', '#...##..', '##.##...', '.###....', '..#.....', '........'],
    play: ['#.......', '###.....', '#####...', '#######.', '#####...', '###.....', '#.......', '........'],
    quadrado: ['........', '.######.', '.######.', '.######.', '.######.', '.######.', '.######.', '........'],
    engrenagem: ['...##...', '.######.', '.##..##.', '##....##', '##....##', '.##..##.', '.######.', '...##...']
  };
  const icon = (name, color, scale = 2) => svg(8, 8, scale, grid(ICONS[name]), color);
  function hash32(str) { let x = 0x811c9dc5; for (const ch of String(str)) { x ^= ch.codePointAt(0); x = Math.imul(x, 0x01000193) >>> 0; } return x >>> 0; }
  // rosto de sessao: identicon 5x5 espelhado, gerado do nome, na cor do lado
  function identicon(seed, color, cell = 4) {
    let bits = hash32(seed); const cells = [];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) { if (bits & 1) { cells.push([x, y]); if (x < 2) cells.push([4 - x, y]); } bits >>>= 1; }
    if (cells.length < 5) cells.push([2, 1], [2, 2], [2, 3], [1, 2], [3, 2]);
    const s = svg(5, 5, cell, cells, color); s.classList.add('g-face'); return s;
  }
  const css = name => getComputedStyle(html).getPropertyValue(name).trim();
  const sideColor = side => side === 'codex' ? css('--g-codex') : side === 'claude' ? css('--g-claude') : css('--g-tx2');
  // ?exemplo=1 no endereco da pagina: toda leitura pede o exemplo (pedido do coordenador, F2)
  const EXEMPLO = /[?&]exemplo=1\b/.test(root.location.search || '');
  async function getJSON(url, ms = 20000) {
    if (EXEMPLO && !/[?&]exemplo=1\b/.test(url)) url += (url.includes('?') ? '&' : '?') + 'exemplo=1';
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
    try { const r = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' }, signal: c.signal }); if (!r.ok) throw Error(String(r.status)); return await r.json(); }
    finally { clearTimeout(t); }
  }
  function ago(iso) {
    const t = typeof iso === 'number' ? iso : Date.parse(iso); if (!Number.isFinite(t)) return '?';
    const m = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (m < 1) return 'agora'; if (m < 60) return 'há ' + m + ' min'; const hr = Math.round(m / 60); if (hr < 48) return 'há ' + hr + ' h'; return 'há ' + Math.round(hr / 24) + ' dias';
  }
  // minutos de idade em frase de gente: "há 1 h 51 min" (nunca "há 111 min")
  function haMin(min, antes = 'há ') {
    if (!Number.isFinite(min)) return '?'; const m = Math.max(0, Math.round(min)); if (m < 1) return 'agora'; if (m < 60) return antes + m + ' min';
    if (m < 600) return antes + Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : ''); const hr = Math.round(m / 60); if (hr < 48) return antes + hr + ' h'; return antes + Math.round(hr / 24) + ' dias';
  }
  function ate(iso) {
    const t = Date.parse(iso); if (!Number.isFinite(t)) return '?';
    const m = Math.round((t - Date.now()) / 60000); if (m <= 0) return 'já zerou';
    if (m < 60) return 'zera em ' + m + ' min'; const hr = Math.round(m / 60); if (hr < 36) return 'zera em ' + hr + ' h'; return 'zera em ' + Math.round(hr / 24) + ' dias';
  }
  const latest = () => { try { return typeof latestSnapshot !== 'undefined' && latestSnapshot ? latestSnapshot : null; } catch { return null; } };
  const nomeBonito = (plain, title) => {
    const p = String(plain || title || '?');
    if (/^coordenador claude$/i.test(p)) return 'COORDENADOR Claude';
    if (/^coordenador codex$/i.test(p)) return 'COORDENADOR Codex';
    if (/^conversa do codex$/i.test(p)) return 'codex';
    if (/^outras conversas do codex$/i.test(p)) return 'outras do codex';
    return p;
  };
  // "Codex VPS: n-portas-1791483793" vira "Codex VPS · portas"
  const semCru = s => String(s || '').replace(/:\s*n-/, ' · ').replace(/-\d{6,}\b/g, '').replace(/\b\d{4} \d{2} \d{2}\b/g, '').replace(/\s+\d{8,}\b/g, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  const SEL_FRASE = '.g-sec,.g-txt,.g-vazio,.g-lab,.g-meta,.g-conta small,.g-row-nome,.g-no-linha,.opx-kicker,.opx-note,.opx-trava,.opx-foot,.opx-mono,.opx-name';
  function primeiraMaiuscula(raiz, sel = SEL_FRASE) {
    if (!raiz) return;
    for (const el of raiz.querySelectorAll(sel)) {
      const w = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT); let t;
      while ((t = w.nextNode())) { const v = t.nodeValue, i = v.search(/\S/); if (i < 0) continue; const ch = v.charAt(i); if (ch !== ch.toUpperCase() && /[a-zà-ÿ]/.test(ch)) t.nodeValue = v.slice(0, i) + ch.toUpperCase() + v.slice(i + 1); break; }
    }
  }
  const humanTitle = s => { const v = String(s || '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim(); return v.charAt(0).toUpperCase() + v.slice(1); };

  // ---------- fonte pixel na grade, tambem com zoom ----------
  function grade() {
    const dpr = root.devicePixelRatio || 1;
    for (const base of [16, 24, 48]) { const u = base / 8, dev = Math.max(1, Math.round(u * dpr)); html.style.setProperty('--g-px' + base, (dev / dpr * 8) + 'px'); }
  }

  // ---------- montagem do esqueleto ----------
  const els = {};
  function montar() {
    html.classList.add('esq'); grade();
    const shell = doc.querySelector('.shell'), main = doc.querySelector('main'); if (!shell || !main) return false;
    // barra
    const bar = h('div', ''), wrap = h('div', 'g-wrap'); bar.id = 'g-bar'; bar.dataset.dsOwned = 'grade'; bar.setAttribute('role', 'banner');
    const logo = h('a', 'g-logo', identicon('PAINEL', css('--g-tx'), 4), h('span', '', 'Painel')); logo.href = '#g=agora';
    const tabs = h('nav', 'g-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Painel');
    els.tabs = TABS.map((t, i) => { const b = h('button', 'g-tab', h('span', 'g-key', String(i + 1)), h('span', 'g-tl', t.label)); b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.tab = t.key; b.title = 'Tecla ' + (i + 1); b.addEventListener('click', () => show(t.key)); tabs.append(b); return b; });
    const right = h('div', 'g-right');
    const busca = h('span', 'g-busca'); busca.hidden = true; busca.setAttribute('role', 'status'); els.busca = busca;
    const placar = h('button', 'g-placar'); placar.type = 'button'; placar.title = 'Abre o WEN em tabela (tecla W)';
    const pl = (cls, ic, label) => { const n = h('span', 'g-odo', h('span', '', '?')); const box = h('span', 'g-pl ' + cls, ic, n); box.setAttribute('aria-label', label); return { box, n }; };
    els.plEspera = pl('is-espera', icon('diamante', css('--g-rosa')), 'espera você'); els.plAnda = pl('is-anda', icon('play', css('--g-anda')), 'anda'); els.plTrava = pl('is-trava', icon('quadrado', css('--g-trava')), 'travou');
    els.combo = h('span', 'g-combo'); els.combo.hidden = true;
    placar.append(els.combo, els.plEspera.box, els.plAnda.box, els.plTrava.box);
    placar.addEventListener('click', () => root.PainelF2 ? root.PainelF2.wen() : doc.getElementById('wen-trigger')?.click());
    placar.title = 'Abre o WEN em tabela (tecla W)';
    // interruptor de tema: grade (padrao) | livro | folha, guardado neste navegador (tema.js)
    const temas = h('div', 'g-temas'); temas.setAttribute('role', 'radiogroup'); temas.setAttribute('aria-label', 'Tema do painel');
    els.temas = [['grade', 'Grade'], ['livro', 'Livro'], ['folha', 'Folha']].map(([k, label]) => { const b = h('button', 'g-tema', label); b.type = 'button'; b.dataset.tema = k; b.setAttribute('role', 'radio'); b.title = 'Tema ' + label + ' (fica guardado neste navegador)'; b.addEventListener('click', () => { if (root.PainelTema) root.PainelTema.set(k); marcarTema(); }); temas.append(b); return b; });
    right.append(busca, placar, temas);
    // ajustes: o menu antigo (idioma, movimento, som, lofi) + WEN automatico e ACELERAR
    const settings = doc.getElementById('panel-settings');
    if (settings) {
      const opts = doc.getElementById('panel-settings-options');
      const sum = settings.querySelector('summary'); if (sum) { sum.replaceChildren(icon('engrenagem', css('--g-tx2'))); sum.title = 'Ajustes'; }
      const wen = doc.querySelector('.wen-controls'), acel = doc.getElementById('gancho-acelerador');
      if (opts && wen) opts.append(wen); if (opts && acel) opts.append(acel);
      right.append(settings);
    }
    wrap.append(logo, tabs, right); bar.append(wrap); shell.before(bar);
    // sub-vistas + as 3 telas novas no topo do main
    const sub = h('nav', 'g-sub'); sub.id = 'g-subnav'; sub.dataset.dsOwned = 'grade'; sub.setAttribute('aria-label', 'Vistas'); els.sub = sub;
    const agora = h('section', 'g-view'); agora.id = 'g-agora';
    const fluxo = h('section', 'g-view'); fluxo.id = 'g-fluxo';
    const cerebro = h('section', 'g-view'); cerebro.id = 'g-cerebro';
    const aprendizados=h('section','g-view');aprendizados.id='g-aprendizados';
    for (const v of [agora, fluxo, cerebro]) v.dataset.dsOwned = 'grade';
    main.prepend(sub, agora, fluxo, cerebro, aprendizados); Object.assign(els, { agora, fluxo, cerebro });
    // linha de comando no pe: a caixa "Para COORDENADOR" de sempre, em 1 linha; "/" abre
    const dock = h('div', ''); dock.id = 'g-dock'; const dw = h('div', 'g-wrap'); const slash = h('span', 'g-slash', '/'); slash.title = 'Tecla /';
    dw.append(slash, h('span', 'g-dock-dica', 'Esc fecha')); dock.append(dw); dock.dataset.dsOwned = 'grade'; doc.body.append(dock); els.dock = dock; els.dockWrap = dw; acoplar();
    dock.addEventListener('focusin', () => dock.classList.add('is-aberto'));
    dock.addEventListener('focusout', () => setTimeout(() => { if (!dock.contains(doc.activeElement)) dock.classList.remove('is-aberto'); }, 0));
    // dialogo de decidir: os cards de sempre (respondem pelo caminho de sempre)
    const dlg = doc.createElement('dialog'); dlg.id = 'g-decidir'; dlg.setAttribute('aria-label', 'Espera você');
    const close = h('button', 'g-btn is-quieto', 'Fechar'); close.type = 'button'; close.addEventListener('click', () => dlg.close());
    const dbody = h('div', 'g-dlg-body'); dlg.append(h('div', 'g-dlg-head', h('h2', 'g-h', 'ESPERA VOCÊ'), close), dbody); doc.body.append(dlg);
    const cards = doc.getElementById('gancho-cards'); if (cards) dbody.append(cards);
    els.dlg = dlg;
    return true;
  }

  function acoplar() {
    const caixa = doc.getElementById('painel-caixa'), dw = els.dockWrap; if (!caixa || !dw) return;
    if (caixa.parentElement !== dw) dw.insertBefore(caixa, dw.lastChild);
    if (els.dock.parentElement !== doc.body || doc.body.lastElementChild !== els.dock) doc.body.append(els.dock);
  }
  function marcarTema() {
    const t = html.dataset.theme || 'grade'; for (const b of els.temas || []) b.setAttribute('aria-checked', String(b.dataset.tema === t));
    // os icones pixel levam a cor do tema na hora de desenhar: redesenha o placar e a vista aberta
    for (const [slot, nome, cor] of [[els.plEspera, 'diamante', '--g-rosa'], [els.plAnda, 'play', '--g-anda'], [els.plTrava, 'quadrado', '--g-trava']]) { const old = slot && slot.box.querySelector('svg'); if (old) old.replaceWith(icon(nome, css(cor))); }
    if (S.view === 'agora') paintAgora(); if (S.view === 'fluxo') paintFluxo(); if (S.view === 'mapa') { S.cerebroPos = null; desenharCerebro(); } }
  const anim = () => root.PainelAnim || null;
  // ---------- navegacao ----------
  function show(tabKey, viewId, fromHash = false) {
    const tab = TABS.find(t => t.key === tabKey) || TABS[0], view = tab.views.find(v => v.id === viewId) || tab.views[0];
    S.tab = tab.key; S.view = view.id; html.dataset.gTab = tab.key; delete html.dataset.gNew; delete html.dataset.gOld;
    if (view.kind === 'new') html.dataset.gNew = view.target;
    else if (view.kind === 'extra') { html.dataset.gOld = view.target; doc.getElementById('tab-home')?.click(); }
    else {
      html.dataset.gOld = view.target; doc.getElementById('tab-' + view.target)?.click();
      if (view.mode) { let n = 0; const pick = () => { const b = [...doc.querySelectorAll('.pe-view-btn')].find(x => x.textContent.trim() === view.mode); if (b) b.click(); else if (n++ < 20) setTimeout(pick, 250); }; pick(); }
    }
    for (const b of els.tabs) b.setAttribute('aria-selected', String(b.dataset.tab === tab.key));
    els.sub.replaceChildren(...tab.views.map(v => { const b = h('button', '', v.label); b.type = 'button'; b.setAttribute('aria-current', String(v.id === view.id)); b.addEventListener('click', () => show(tab.key, v.id)); return b; }));
    // F2: as 16 abas antigas passam pelo adaptador (vistas-f2.js); a nota "visual antigo" saiu
    const hashWant = '#g=' + tab.key + '.' + view.id + (S.demo ? '&demo=recompensa' : '') + (S.demoEventos ? '&demo=eventos' : '');
    if (!fromHash && root.location.hash !== hashWant) history.replaceState(null, '', hashWant);
    if (!fromHash) root.scrollTo(0, 0);
    paintAtivo(true); setTimeout(acoplar, 60);
  }
  function fromHash() { const m = /g=([a-z]+)(?:\.([a-z-]+))?/.exec(root.location.hash || ''); if (m && m[1] === 'idealizadores') { show('decidir', 'ideias', true); return; } show(m ? m[1] : 'agora', m ? m[2] : undefined, true); }

  // ---------- dados ----------
  function modelo() {
    const PE = root.PainelEquipePE; if (!PE || !S.snap) return null;
    const now = Date.now();
    try {
      const lados = PE.ladosOf(S.snap, now, false, { casa: true });
      lados.janelaFluxo = '2h'; lados.historicoFluxo = S.snap.fluxoHistorico && S.snap.fluxoHistorico['2h'] || null; lados.frentesCodex = Array.isArray(S.frentes) ? S.frentes : null;
      lados.fluxoLeitura = S.snap.fluxoLeitura || null;
      const fv = S.fluxo ? PE.flowView(S.fluxo, 'pt', now, lados) : null;
      const view = PE.viewOf(S.snap, 'pt', now, { lados });
      // sem leitura, "?". A Folha le este mesmo objeto (PainelGrade.anda()); a conta antiga (PainelAtividade.agentes) nao entra mais.
      const conta = typeof PE.andaPainel === 'function' ? PE.andaPainel(lados, S.f2, now) : null;
      return { lados, fv, view, conta, hero: PE.heroLine(view) };
    } catch (e) { console.warn('grade modelo', e); return null; }
  }
  async function loadAgora() {
    try {
      const j = await getJSON('/api/agora'); const prev = S.pendentes; S.agora = j;
      const now = new Set((j.cards?.pendentes || []).map(c => c.arquivo));
      if (prev) { const sairam = [...prev].filter(id => !now.has(id)); if (sairam.length) recompensa(sairam); }
      if (anim()) anim().agora(j);
      S.pendentes = now;
    } catch { S.agora = S.agora || { erro: true }; }
    paintPlacar(); if (S.view === 'agora') setTimeout(() => paintAgora(), S.recompensando ? 520 : 0);
  }
  async function loadCards() { try { S.cards = await getJSON('/api/pc-cards/lista'); } catch { /* fica a leitura anterior */ } if (S.view === 'agora') paintAgora(); }
  async function loadContas() { try { S.contas = await getJSON('/api/contas-claude'); } catch { /* idem */ } if (S.view === 'agora') paintAgora(); }
  async function loadFluxo() {
    try { const [f, fr] = await Promise.all([getJSON('/api/pe-equipe/fluxo', 40000), getJSON('/api/pe-equipe/codex-frentes').catch(() => null)]); S.fluxo = f; if (f && f.f2 && f.f2.ok === true) S.f2 = f.f2; else if (!S.f2 && !S.f2pedido) { S.f2pedido = true; getJSON('/api/pe-equipe/codex-sessoes', 60000).then(j => { if (j && j.ok === true) { S.f2 = j; S.model = modelo(); paintPlacar(); if (S.view === 'fluxo') paintFluxo(); else if (S.view === 'agora') paintAgora(); } }).catch(() => {}).finally(() => { S.f2pedido = false; }); } S.frentes = fr && fr.lido === true && Array.isArray(fr.frentes) ? fr.frentes : null; S.fluxoFalhou = false; } catch { S.fluxoFalhou = true; /* a tela do Fluxo diz indisponivel com o proximo passo */ }
    S.model = modelo(); paintPlacar(); paintAtivo();
  }
  async function loadCerebro() { try { S.cerebro = await getJSON('/api/cerebro', 40000); S.cerebroPos = null; } catch { /* idem */ } if (S.view === 'mapa') paintCerebro(); }
  async function loadObra() { try { const j = await getJSON('/api/obra'); if (j.ok === true && Array.isArray(j.data?.projects)) { S.obra = j.data; S.obraUi?.update(S.obra); primeiraMaiuscula(S.obraHolder); } else S.obraUi?.error(); } catch { S.obraUi?.error(); } }
  function busca() {
    const strong = [...doc.querySelectorAll('.ds-summary-line strong')].map(n => n.textContent.trim()).filter(Boolean);
    const total = strong.map(t => parseInt(t, 10)).filter(Number.isFinite).reduce((a, b) => Math.max(a, b), 0);
    els.busca.hidden = !total; if (total) { els.busca.title = strong[0] + ' · o painel volta sozinho quando acha'; els.busca.setAttribute('aria-label', strong[0]); }
  }

  // ---------- placar (odometro de pixel) ----------
  function contagens() {
    const a = S.agora && S.agora.agora, c = S.agora && S.agora.cards;
    const ev = S.agora && S.agora.esperaVoce, espera = ev && Number.isFinite(ev.total) ? ev.total : a && c ? (c.pendentes || []).length + (a.voce || []).length : null;
    const rows = andaRows(a);
    const anda = S.model || a ? rows.length : null;
    const trava = a ? ((a.unavailable || []).includes('travado') ? null : (a.travado || []).length) : null;
    return { espera, anda, trava };
  }
  function odo(slot, value) {
    const v = value === null ? '?' : String(value), span = slot.n.firstChild;
    if (span.textContent === v) return; span.textContent = v;
    if (!reduced()) { slot.n.classList.remove('is-rolando'); void slot.n.offsetWidth; slot.n.classList.add('is-rolando'); }
  }
  // (paintAgora); "?" sem leitura continua "?", nunca 0 inventado. Todos = a conta de sempre.
  function contagensProjeto(k) {
    const PG = root.PainelProjetoGlobal; if (!PG || PG.atual() === 'todos') return k;
    const a = S.agora && S.agora.agora, cards = S.agora && S.agora.cards, casaP = x => PG.casa(x);
    const EV = S.agora && S.agora.esperaVoce && S.agora.esperaVoce.ok === true && Array.isArray(S.agora.esperaVoce.itens) ? S.agora.esperaVoce : null;
    const pend = (cards ? cards.pendentes || [] : []).filter(c => casaP({ sessao: c.sessao, titulo: c.pergunta }));
    const passos = EV ? EV.itens.filter(i => i && i.tipo !== 'card').map(i => ({ passo: i.titulo, onde: i.onde })) : a ? a.voce || [] : [];
    const passosP = passos.filter(p => casaP({ titulo: p.passo, texto: (p.onde || '') + ' ' + (p.passo || '') }));
    const travP = ((a && a.travado) || []).filter(t => casaP({ titulo: String(t), texto: String(t) }));
    const rowsA = andaRows(a).filter(r => casaP({ titulo: r.nome, texto: String(r.nome || '') + ' ' + String(r.linha || '') }));
    return { espera: k.espera === null ? null : pend.length + passosP.length, anda: k.anda === null ? null : rowsA.length, trava: k.trava === null ? null : travP.length, so: PG.nome(PG.atual()) };
  }
  function paintPlacar() {
    let k = contagens();
    try { k = contagensProjeto(k); } catch (e) { /* sem o seletor: a conta de sempre */ }
    if (S.demoAjuste) k.espera = k.espera === null ? null : Math.max(0, k.espera - S.demoAjuste);
    odo(els.plEspera, k.espera); odo(els.plAnda, k.anda); odo(els.plTrava, k.trava);
    els.plEspera.box.hidden = k.espera === 0;
    const ev = S.agora && S.agora.esperaVoce; els.plEspera.box.title = k.so ? 'espera você · só ' + k.so : ev && ev.rotulo ? ev.rotulo : 'espera você';
    els.plAnda.box.title = k.so ? 'anda · só ' + k.so : ''; els.plTrava.box.title = k.so ? 'travou · só ' + k.so : '';
  }

  // ---------- AGORA ----------
  // texto que chega da fonte sem acento e com nome cru: acentos so de palavra sem ambiguidade, nome padrao, "Agente" e nunca "Agentes"
  const fonteTxt = s => { const P = root.PainelNomes; let v = String(s === null || s === undefined ? '' : s); if (!P) return v; v = v.replace(/\S+/g, tok => /[/_=@#]|\.\w{1,5}$|^https?:/.test(tok) ? tok : P.acentos(tok)); return v.replace(/\bCOORDENADOR\b/g, 'Coordenador').replace(/\b(ATENDIMENTO|LOJA|CORTES|ASSISTENTE)\b/g, w => P.nome(w)); };
  function paintAgora() {
    const box = els.agora; if (!box) return;
    const a = S.agora && S.agora.agora, cards = S.agora && S.agora.cards, k = contagens();
    const frag = doc.createDocumentFragment();
    // cabecalho: idade da leitura e regua de 8 da meta do dia (zerar o rosa: decididas hoje / decididas + pendentes)
    const lido = a ? (a.stale ? 'leitura velha · ' : '') + 'lido ' + (Number.isFinite(a.ageMinutes) ? haMin(a.ageMinutes) : '?') + (a.seloMao ? ' · ' + a.seloMao.texto : '') : 'sem leitura (?)';
    const meta = metaDoDia();
    const regua = h('div', 'g-regua' + (meta && meta.total && meta.feitas === meta.total ? ' is-cheia' : '')); for (let i = 0; i < 8; i++) { const on = meta && meta.total ? i < Math.round(8 * meta.feitas / meta.total) : false; regua.append(h('i', on ? 'on' : '')); }
    regua.setAttribute('aria-hidden', 'true');
    const metaTxt = meta ? (meta.rotulo || (meta.total ? meta.feitas + ' de ' + meta.total + ' decididas hoje' : 'nada para decidir hoje')) : '?';
    const md = h('div', 'g-meta-dia', h('span', 'g-lab', 'Meta do dia'), regua, h('span', 'g-sec', metaTxt)); md.title = 'Régua de 8: cards decididos hoje sobre decididos + os que ainda esperam você. Fonte: /api/pc-cards/lista.';
    frag.append(h('div', 'g-head', h('span', 'g-sec', lido), md));
    const PG = root.PainelProjetoGlobal, filtra = !!(PG && PG.atual() !== 'todos'), casaP = x => !filtra || PG.casa(x);
    // 3 colunas
    const cols = h('div', 'g-cols');
    // ESPERA VOCE
    // atendimento.md); os passos a mao sem data ou "quando chegar" ficam embaixo, sem numero, como "Fora da conta"
    const EV = S.agora && S.agora.esperaVoce && S.agora.esperaVoce.ok === true && Array.isArray(S.agora.esperaVoce.itens) ? S.agora.esperaVoce : null;
    const pend = (cards ? cards.pendentes || [] : []).filter(c => casaP({ sessao: c.sessao, titulo: c.pergunta }));
    const passos = EV ? EV.itens.filter(i => i && i.tipo !== 'card').map(i => ({ passo: i.titulo, onde: i.onde, quando: i.dataTexto || null })) : a ? a.voce || [] : [];
    const foraConta = (EV && EV.semData && Array.isArray(EV.semData.itens) ? EV.semData.itens : []).filter(i => casaP({ titulo: i && i.titulo, texto: i && i.titulo }));
    const passosP = passos.filter(p => casaP({ titulo: p.passo, texto: (p.onde || '') + ' ' + (p.passo || '') }));
    const travP = ((a && a.travado) || []).filter(t => casaP({ titulo: String(t), texto: String(t) }));
    if (filtra) { k.espera = k.espera === null ? null : pend.length + passosP.length; k.trava = k.trava === null ? null : travP.length; }
    const espera = h('section', 'g-col g-espera' + (k.espera ? ' is-acao' : ''));
    const listE = h('ol', 'g-list'); let n = 0;
    for (const c of pend) {
      n++;
      const mark = h('span', 'g-mark', icon('diamante', css('--g-rosa')), String(n)); mark.dataset.mark = c.arquivo;
      const metaL = h('div', 'g-meta', h('i', 'g-sq ' + (c.familia === 'codex' ? 'is-codex' : 'is-claude')), (() => { const b = h('b', 'g-nome', root.PainelNomes ? root.PainelNomes.nome(c.sessao || '?') : (c.sessao || '?')); b.dataset.lado = c.familia === 'codex' ? 'codex' : 'claude'; return b; })(), '· ' + (c.tipo || 'card') + ' · ' + (c.criado || '?'), c.perigoso ? h('span', 'g-tag-perigo', '· perigosa') : null);
      const btn = h('button', 'g-btn', 'Escolher'); btn.type = 'button'; btn.addEventListener('click', () => abrirDecidir(c.arquivo));
      const li = h('li', 'g-item', mark, h('div', '', metaL, h('p', 'g-txt g-clamp', fonteTxt(c.pergunta || '?'))), btn); li.dataset.id = c.arquivo; li.title = (c.perigoso ? (c.avisoPerigo || '') + ' ' : '') + (c.pergunta || '');
      listE.append(li);
    }
    for (const p of passosP) {
      n++;
      const mark = h('span', 'g-mark', icon('diamante', css('--g-rosa')), String(n));
      const li = h('li', 'g-item', mark, h('div', '', h('div', 'g-meta', h('b', '', 'Seu passo'), '· ' + fonteTxt(p.onde || '?') + (p.quando ? ' · ' + p.quando : '')), h('p', 'g-txt g-clamp', fonteTxt(p.passo || '?'))), h('span', ''));
      listE.append(li);
    }
    if (foraConta.length) listE.append(h('li', 'g-item g-fora', h('span', 'g-mark'), h('div', '', h('div', 'g-meta', h('b', '', 'Fora da conta (' + foraConta.length + ')')),
      h('div', 'g-fora-lista', ...foraConta.map(i => h('p', 'g-sec', fonteTxt(i.titulo || '?') + (i.nota ? ' · ' + i.nota : ''))))), h('span', '')));
    const headE = h('div', 'g-col-head', h('h2', 'g-h', 'ESPERA VOCÊ'), h('span', 'g-num', k.espera === null ? '?' : String(k.espera)));
    if (k.espera === 0) {
      espera.append(headE, h('div', 'g-limpo', h('span', 'g-num', 'LIMPO'), h('p', 'g-sec', 'nada espera você · dias seguidos: ?'))); espera.lastChild.title = 'Sem histórico de dias limpos na fonte; a contagem entra quando houver registro.';
    } else espera.append(headE, h('p', 'g-sec g-sub2', k.espera === null ? 'sem leitura (?)' : S.agora && S.agora.esperaVoce && S.agora.esperaVoce.rotulo ? S.agora.esperaVoce.rotulo : pend.length + ' cards para escolher · ' + passosP.length + ' passos seus'), listE);
    // ANDA
    const anda = h('section', 'g-col'), listA = h('ol', 'g-list');
    const rowsA = andaRows(a).filter(r => casaP({ titulo: r.nome, texto: String(r.nome || '') + ' ' + String(r.linha || '') }));
    if (filtra && k.anda !== null) k.anda = rowsA.length;
    if (filtra) frag.append(h('p', 'g-sec pg-aviso', 'Vendo: ' + PG.nome(PG.atual()) + ' · ' + (pend.length + passosP.length) + ' esperando você, ' + rowsA.length + ' andando, ' + travP.length + ' travados neste projeto. Trocar em "Vendo:" na barra de cima.'));
    for (const r of rowsA) listA.append(h('li', 'g-row', h('i', 'g-st is-anda'), h('i', 'g-sq ' + (r.side === 'codex' ? 'is-codex' : 'is-claude')), h('div', 'g-row-body', (() => { const n = h('div', 'g-row-nome g-nome', r.nome); n.dataset.lado = r.side === 'codex' ? 'codex' : 'claude'; return n; })(), h('p', 'g-sec', r.linha))));
    const conta = S.model && S.model.conta;
    anda.append(h('div', 'g-col-head', h('h2', 'g-h', 'ANDA'), h('span', 'g-num', k.anda === null ? '?' : String(k.anda))),
      h('p', 'g-sec g-sub2', k.anda === null ? 'indisponível nesta cópia (?). Solução: confira Trabalhando agora na primeira tela' : typeof andaSubtitulo === 'function' ? andaSubtitulo(conta, rowsA) : quemAnda(conta)),
      rowsA.length ? listA : k.anda === null ? '' : h('p', 'g-vazio', 'ninguém andando nesta leitura'),
      ((a && a.rodando) || []).some(r => /indispon/i.test(r.o_que || '')) ? h('p', 'g-sec g-nota-vps', 'VPS: leitura indisponível (?) · o leitor da VPS volta na próxima volta') : '',
      vpsSemLeitura(a) ? h('p', 'g-sec g-nota-vps', vpsSemLeitura(a)) : '');
    // TRAVOU
    const trava = h('section', 'g-col'), listT = h('ol', 'g-list');
    for (const t of travP) listT.append(h('li', 'g-row-trava', h('i', 'g-st is-trava'), h('p', 'g-txt', fonteTxt(t))));
    trava.append(h('div', 'g-col-head', h('h2', 'g-h', 'TRAVOU'), h('span', 'g-num', k.trava === null ? '?' : String(k.trava))),
      h('p', 'g-sec g-sub2', k.trava ? 'parado até alguém destravar' + (a && a.mao && a.mao.travado && a.mao.travado.texto ? ' · ' + a.mao.travado.texto : '') : k.trava === 0 ? 'nada travado' : (a && a.semLeitura && a.semLeitura.travado) || 'sem leitura (?)'), k.trava ? listT : h('span', ''));
    cols.append(espera, anda, trava); frag.append(cols);
    // NO AR
    const noar = (a && a.noAr) || [];
    const upSite = a && a.noArFonte;
    frag.append(h('div', 'g-faixa', h('span', 'g-lab', 'No ar'), h('p', 'g-txt', noar.length ? noar.map(x => fonteTxt(root.PainelNomes ? root.PainelNomes.frase(x) : x)).join(' · ') : (a ? (a.semLeitura && a.semLeitura.noAr) || 'nada no ar registrado' : '?')), h('span', 'g-sec', upSite ? (upSite.dataTexto || '?') + (upSite.idadeTexto ? ' (' + upSite.idadeTexto + ')' : '') : a && a.atualizadoEm ? (a.mao && a.mao.noAr && a.mao.noAr.texto ? a.mao.noAr.texto : 'texto escrito pela sua IA sem hora de quando foi escrito') + ' · último up sem registro (?) Solução: a Atendimento anota cada subida no estado dela' : '')));
    // CONTAS
    const contas = h('div', 'g-contas');
    const barra = pct => { const b = h('span', 'g-barra'); const on = Number.isFinite(pct) ? Math.round(pct / 10) : 0; for (let i = 0; i < 10; i++) b.append(h('i', i < on ? 'on' : '')); return b; };
    const CR = S.agora && S.agora.credito && S.agora.credito.ok === true ? S.agora.credito : null;
    if (CR) {
      for (const c of (CR.claude && CR.claude.contas) || []) { const pct = Number.isFinite(c.usadoPct) ? c.usadoPct : null; const el = h('div', 'g-conta' + (c.daVez ? ' is-davez' : ''), h('span', 'g-lab', c.conta || c.quem), barra(pct), h('span', 'g-sec', c.texto || '?'), h('small', '', (c.daVez ? 'em uso · ' : '') + (c.lidoHa ? c.lidoHa + (c.zeraCurto || c.zeraTexto ? ' · ' + (c.zeraCurto || c.zeraTexto) : '') : c.velho || /dias/.test(c.idadeTexto || '') ? 'lido ' + (c.idadeTexto || '?') + (c.zeraHoje && c.zeraTexto ? ' · ' + c.zeraTexto : '') : (c.zeraTexto || ''))), pct === null ? h('small', 'g-conta-sol', (c.ultimoPct != null ? 'último ' + c.ultimoPct + '% · ' : '') + 'Solução: ' + (c.solucao || 'o Claude relê o crédito na próxima volta') + '.') : ''); el.title = (c.quem || '') + ': ' + (c.texto || '?') + ' · ' + (c.lidoTexto || '') + (c.zeraTexto ? ' · ' + c.zeraTexto : '') + (c.motivo ? ' · ' + c.motivo : ''); contas.append(el); }
      const cx2 = CR.codex; if (cx2) { const el = h('div', 'g-conta is-codex', h('span', 'g-lab', 'Codex'), barra(Number.isFinite(cx2.usadoPct) ? cx2.usadoPct : cx2.ultimoPct), h('span', 'g-sec', cx2.texto || '?'), h('small', '', (cx2.lidoHa ? cx2.lidoHa + ' · ' : '') + (Number.isFinite(cx2.usadoPct) ? (cx2.zeraTexto || '') : (cx2.ultimoTexto || cx2.motivo || 'sem leitura') + (cx2.solucao ? ' · Solução: ' + cx2.solucao : '')))); el.title = 'Codex: ' + (cx2.texto || '?') + (cx2.motivo ? ' (' + cx2.motivo + ')' : '') + ' · ' + (cx2.lidoTexto || '') + (cx2.zeraTexto ? ' · ' + cx2.zeraTexto : ''); contas.append(el); }
      contas.title = CR.regra || '';
    }
    for (const c of CR ? [] : (S.contas && S.contas.contas) || []) {
      const pct = Number.isFinite(c.semana) ? c.semana : null;
      const el = h('div', 'g-conta' + (c.atual ? ' is-davez' : ''), h('span', 'g-lab', c.conta), barra(pct), h('span', 'g-sec', pct === null ? '?' : pct + '%'), h('small', '', (c.atual ? 'em uso · ' : '') + ate(c.zeraSemana)), pct === null ? h('small', 'g-conta-sol', 'Solução: o Claude relê o crédito na próxima volta.') : '');
      el.title = 'Conta ' + c.conta + ': ' + (pct === null ? '?' : pct + '% da semana usada') + ' · lido ' + ago(c.lidoEm); contas.append(el);
    }
    const cx = a && a.credito && a.credito.codex;
    if (cx && !CR) { const temN = Number.isFinite(cx.semana); const el = h('div', 'g-conta is-codex', h('span', 'g-lab', 'Codex'), barra(cx.semana), h('span', 'g-sec', temN ? cx.semana + '%' : '?'), h('small', '', temN ? 'Codex · ' + ate(cx.zeraEm) : 'Sem número nesta leitura')); el.title = temN ? 'Codex: ' + (cx.texto || '') : 'Codex: a leitura do crédito não trouxe a porcentagem (' + (cx.lidoEm ? 'lida ' + ago(cx.lidoEm) : 'sem hora') + '). O número volta quando o leitor de uso do Codex gravar de novo.'; contas.append(el); }
    if (!contas.childElementCount) contas.append(h('span', 'g-sec', 'contas sem leitura (?)'));
    const davez = S.contas && S.contas.atual;
    frag.append(h('div', 'g-faixa', h('span', 'g-lab', 'Contas'), contas, h('span', 'g-sec', davez && S.contas.recomendacao && S.contas.recomendacao.conta ? 'próxima: ' + S.contas.recomendacao.conta + (S.contas.recomendacao.aposReset ? ' depois do reset' : '') : '')));
    // PROJETOS (Painel de LED: Painel de LED), reaproveitado de obra-pixel.js
    const obraBox = h('section', 'g-obra');
    obraBox.append(h('div', 'g-obra-head', h('h2', 'g-h', 'PROJETOS'), h('span', 'g-sec', 'Painel de LED · 1 LED = 1 item · fonte: LANCAMENTO.md, projetos.json e tasks')));
    if (root.PainelObraPixel && !S.obraHolder) {
      S.obraHolder = h('div', ''); S.obraUi = root.PainelObraPixel.create(doc, S.obraHolder, 'd');
      const k2 = S.obraHolder.querySelector('.opx-kicker'); if (k2) k2.textContent = 'Cor só onde importa: rosa = com você';
      if (S.obra) S.obraUi.update(S.obra); else loadObra();
    }
    if (S.obraHolder) obraBox.append(S.obraHolder); else obraBox.append(h('p', 'g-sec', 'Projetos indisponíveis nesta leitura (?)'));
    frag.append(obraBox);
    box.replaceChildren(frag); primeiraMaiuscula(box);
  }
  function metaDoDia() {
    const dd = S.agora && S.agora.decididas && S.agora.decididas.cards; if (dd && Number.isFinite(dd.total)) return { feitas: dd.respondidosHoje || 0, total: dd.total, rotulo: dd.rotulo };
    const c = S.cards; if (!c || c.ok !== true) return null;
    const d = new Date(), hoje = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
    const feitas = (c.respondidos || []).filter(x => String(x.respondidoAbs || '').startsWith(hoje)).length;
    return { feitas, total: feitas + (c.pendentes || []).length };
  }
  const nomeCasa = id => id === 'codex' ? 'Codex' : root.PainelNomes ? root.PainelNomes.nome(id) : String(id || '?');
  const ajN = n => n === 1 ? '1 ajudante' : n + ' ajudantes';
  const quemAnda = conta => conta && typeof conta.frase === 'string' ? conta.frase : '?';
  // subtitulo da coluna ANDA: com leitura das conversas, a frase de quem anda; sem ela, mas com a lista da sua IA, quantas frentes e quais.
  function andaSubtitulo(conta, rows) {
    const lido = conta && Number.isInteger(conta.n) && typeof conta.frase === 'string';
    if (lido || !Array.isArray(rows) || !rows.length) return conta && typeof conta.frase === 'string' ? conta.frase : 'Sem leitura das conversas agora. Solução: o painel relê sozinho a cada 15 s; se seguir, reinicie o painel';
    return (rows.length === 1 ? '1 frente andando' : rows.length + ' frentes andando') + ', pela lista escrita pela sua IA';
  }
  function vpsSemLeitura(a) {
    const n = a && Array.isArray(a.rodadasSemLeitura) ? a.rodadasSemLeitura.length : 0;
    return n ? 'VPS: ' + (n === 1 ? '1 rodada' : n + ' rodadas') + ' sem leitura ainda (?) Solução: o painel lê a VPS sozinho na próxima volta' : '';
  }
  function andaRows(a) {
    const out = [], fv = S.model && S.model.fv, conta = S.model && S.model.conta;
    if (conta) {
      // so o comprovado (a mesma lista "quem" da Folha): a sessao que usou ferramenta em 5 min, os ajudantes ativos sem entrega e o Codex rodando
      for (const q of (conta.comprovado && conta.quem) || []) {
        const usou = q.ferramentaEm ? Math.max(0, Math.floor((Date.now() - Date.parse(q.ferramentaEm)) / 60000)) : null;
        out.push({ nome: nomeCasa(q.id), side: q.side, linha: q.codex ? (q.codex === 1 ? '1 conversa do Codex rodando' : q.codex + ' conversas do Codex rodando') + ' (processo vivo, não pausado)' : [q.sessao ? 'usou ferramenta ' + (usou === null ? '?' : haMin(usou)) : null, q.ajudantes ? ajN(q.ajudantes) + ' trabalhando agora' : null].filter(Boolean).join(' · ') });
      }
    } else if (fv && Array.isArray(fv.nodes)) for (const nd of fv.nodes) {
      if (nd.id === 'voce' || nd.estado !== 'trabalhando') continue;
      out.push({ nome: root.PainelNomes ? root.PainelNomes.nome({ id: nd.id, plain: nd.plain, title: nd.title, side: nd.side, stage: nd.stage }) : nomeBonito(nd.plain, nd.title), side: nd.side, linha: (nd.lines || []).map(l => l[0]).join(' · ') });
    } else if (S.model && S.model.lados) for (const lado of S.model.lados.lados) for (const box of [lado.coordenador, ...lado.sessoes]) if (box && box.estado === 'trabalhando') out.push({ nome: root.PainelNomes ? root.PainelNomes.nome(box.nome || '?') : box.nome || '?', side: lado.id, linha: 'trabalhando · ' + ago(box.ultimaEm) });
    for (const r of (a && a.rodando) || []) if (!/indispon/i.test(r.o_que || '')) out.push({ nome: semCru(r.o_que), side: r.lado === 'codex' ? 'codex' : 'claude', linha: [r.quando || 'trabalhando agora', r.faixa || null, r.progresso && Number.isFinite(r.progresso.pct) ? Math.round(r.progresso.pct) + '% feito' : null].filter(Boolean).join(' · ') });
    return out;
  }
  function abrirDecidir(arquivo) {
    const dlg = els.dlg; if (!dlg) return; if (!dlg.open) dlg.showModal();
    const alvo = arquivo && dlg.querySelector('[data-foco="titulo:' + CSS.escape(arquivo) + '"]');
    if (alvo) alvo.closest('article')?.scrollIntoView({ block: 'start' });
  }

  // ---------- recompensa: dither de 4 quadros, check, combo ----------
  function recompensa(ids, demo = false) {
    S.recompensando = true; setTimeout(() => { S.recompensando = false; }, 600);
    const now = Date.now(); S.combo = S.combo.filter(t => now - t < 8000); for (const _ of ids) S.combo.push(now);
    for (const id of ids) {
      const mark = els.agora && els.agora.querySelector('[data-mark="' + CSS.escape(id) + '"]'); if (!mark) continue;
      const li = mark.closest('li'), ic = mark.querySelector('svg'), rosa = css('--g-rosa'), verde = css('--g-anda');
      const frames = [['diamante2', rosa], ['diamante3', rosa], ['check', verde]];
      if (reduced()) { ic.replaceWith(icon('check', verde)); mark.classList.add('is-feito'); }
      else frames.forEach(([nm, cor], i) => setTimeout(() => { const cur = mark.querySelector('svg'); if (cur) cur.replaceWith(icon(nm, cor)); if (nm === 'check') mark.classList.add('is-feito'); }, 50 * (i + 1)));
      li && li.classList.add('is-saindo');
    }
    if (S.combo.length >= 2) { els.combo.textContent = 'x' + Math.min(3, S.combo.length); els.combo.hidden = false; setTimeout(() => { els.combo.hidden = true; }, 1000); }
    // som: entraria aqui (desligado por padrao nesta rodada)
  }
  function demoRecompensa() {
    const marks = els.agora ? [...els.agora.querySelectorAll('[data-mark]')] : []; if (marks.length < 1) return;
    const ids = marks.slice(0, 2).map(m => m.dataset.mark);
    recompensa([ids[0]], true); S.demoAjuste = 1; paintPlacar();
    if (ids[1]) setTimeout(() => { recompensa([ids[1]], true); S.demoAjuste = 2; paintPlacar(); }, 700);
  }

  // Marcacao comum dos 3 temas. Cada DIRECAO (e cada tipo, quando a fonte mostra mais de um) tem a SUA linha, lado a lado;
  // a linha leva data-lado (cor de quem manda: voce, claude, codex), data-kind (traco: comando cheio, duvida tracejado,
  // resposta pontilhado) e data-idade (quente, morno, recente, frio). Cada linha tem etiqueta no meio (".g-fio-tag": quantas
  // + resumo da ultima mensagem, so o que a fonte da), que nunca cobre outra etiqueta nem uma caixa (empilha e puxa um fio
  // guia). Caixas: data-lado, data-estado, data-acao (PaAnim), data-work; Codex de uma sessao Claude fica pendurado embaixo
  // dela (".g-no.is-filho", data-dono) quando a fonte disser de quem ele e (contrato do ajudante de dados).
  const COLS = ['sessoes:claude', 'coord:claude', 'voce', 'coord:codex', 'sessoes:codex'];
  const colOf = nd => nd.id === 'voce' ? 2 : COLS.indexOf(nd.stage + ':' + nd.side);
  const ROT_KEY = rot => { const PA = root.PaAnim; if (!PA || !rot) return null; return Object.keys(PA.ROTULOS).find(k => PA.ROTULOS[k] === rot) || null; };
  const NM = () => root.PainelNomes;
  const KIND_T = { comando: 'Comando', duvida: 'Dúvida', resposta: 'Resposta' };
  const kindN = (k, n) => n + ' ' + (k === 'duvida' ? (n === 1 ? 'dúvida' : 'dúvidas') : k === 'resposta' ? (n === 1 ? 'resposta' : 'respostas') : (n === 1 ? 'comando' : 'comandos'));
  function caixasDe(lados) {
    const out = new Map(); if (!lados || !Array.isArray(lados.lados)) return out;
    for (const lado of lados.lados) for (const box of [lado.coordenador, ...(lado.sessoes || [])]) if (box && box.raw && box.raw.id) out.set(String(box.raw.id).toLowerCase(), box);
    return out;
  }
  // tipo da acao, so do que a fonte leu (mesma regra da Arvore); sem leitura: estado puro
  function acaoDe(nd, caixas) {
    if (nd.id === 'voce') return null;
    if (nd.needsYou) return 'esperando';
    if (nd.estado === 'dormindo') return 'dormindo';
    if (nd.estado === 'sem-leitura') return 'sem-leitura';
    if (nd.estado === 'terminou') return 'terminou';
    const PA = root.PaAnim, PE = root.PainelEquipePE;
    const box = caixas.get(String(nd.stage === 'ajudantes' ? nd.of : nd.id || '').toLowerCase());
    if (PA && PE && box && typeof PE.animInfo === 'function') { try { const t = PA.tipoDe(PE.animInfo(box, Date.now())); const k = ROT_KEY(t && t.rotulo); if (k) return k; } catch { /* segue pelo texto */ } }
    const linha = String(nd.lines && nd.lines[0] && nd.lines[0][0] || '').toLowerCase();
    if (PA) for (const k of Object.keys(PA.ROTULOS)) if (linha.startsWith(PA.ROTULOS[k].pt.toLowerCase())) return k;
    return nd.estado === 'trabalhando' ? 'generico' : nd.estado === 'esperando' ? 'pausa' : null;
  }
  const idadeDe = min => min === null || min === undefined ? 'frio' : min < 2 ? 'quente' : min < 5 ? 'morno' : min < 15 ? 'recente' : 'frio';
  // de quem e este Codex (contrato do ajudante de dados): o no ou a leitura crua dizem a sessao Claude dona
  function donoDe(nd, byId) {
    if (nd.side !== 'codex' || nd.stage === 'coord') return null;
    const raw = S.fluxo && Array.isArray(S.fluxo.nodes) ? S.fluxo.nodes.find(r => r && r.id === nd.id) : null;
    for (const c of [nd.dono, nd.donoId, nd.sessaoDona, nd.claudeDono, raw && raw.dono, raw && raw.donoId, raw && raw.sessaoDona, raw && raw.parentId]) {
      if (!c) continue; const alvo = byId.get(String(c)) || [...byId.values()].find(x => String(x.id).toLowerCase() === String(c).toLowerCase());
      if (alvo && alvo.side === 'claude') return alvo;
    }
    return null;
  }
  // nome padrao (nomes.js): nunca o id cru
  function nomeDe(nd, filho) {
    if (nd.id === 'voce') return 'Você';
    if (nd.stage === 'ajudantes') { const dono = filho && filho.dono; return 'Ajudantes' + (dono ? ' · ' + nomeDe(dono) : ''); }
    const P = NM(); if (!P) return nd.plain || nd.title || '?';
    if (filho) return P.nome({ tipo: 'codex', dono: filho.dono.plain || filho.dono.title || filho.dono.id, n: filho.n });
    return P.nome({ id: nd.id, plain: nd.plain, title: nd.title, side: nd.side, stage: nd.stage });
  }
  const frase = s => NM() ? NM().frase(s) : String(s || '');
  // resumo curto da mensagem: so o que a fonte da (campo resumo do contrato; senao o assunto); a frase neutra do modelo nao conta
  function resumoDe(msg, edge, comUltimo = true) {
    if (msg && (msg.titulo || msg.resumo)) return frase(String(msg.titulo || msg.resumo).slice(0, 90));
    if (comUltimo && edge && edge.f2ult && (edge.f2ult.titulo || edge.f2ult.resumo)) return frase(String(edge.f2ult.titulo || edge.f2ult.resumo).slice(0, 90));
    if (!msg) return null;
    const direto = msg.resumo || msg.summary || null; if (direto) return frase(String(direto).slice(0, 80));
    const raw = S.fluxo && Array.isArray(S.fluxo.edges) ? S.fluxo.edges.find(r => r && r.from === edge.from && r.to === edge.to) : null;
    const rm = raw && Array.isArray(raw.messages) ? raw.messages.find(m => m && (m.resumo || m.summary) && (!msg.at || m.at === msg.at)) : null;
    if (rm) return frase(String(rm.resumo || rm.summary).slice(0, 80));
    return msg.subject ? 'Assunto: ' + msg.subject : null;
  }
  // F2 (contrato do ajudante de dados): cada sessao Claude com os SEUS Codex
  // (bloco f2 de /api/pe-equipe/fluxo ou /api/pe-equipe/codex-sessoes) e o fio Claude <-> Codex com hora, titulo e resumo reais.
  const SESSAO_NO = { ATENDIMENTO: 'atendimento', LOJA: 'loja', ASSISTENTE: 'assistente', CORTES: 'cortes', COORDENADOR: 'coordenador-claude' };
  const JANELA_MS = 2 * 3600e3;
  function f2Fluxo(fv, byId) {
    const out = { nos: [], filhos: new Map(), edges: [], nota: new Map(), enriquecer: () => {} };
    const f2 = S.f2; if (!f2 || f2.ok !== true || !Array.isArray(f2.sessoes)) return out;
    const now = Date.now(), P = NM();
    const noDaSessao = sid => { const want = SESSAO_NO[String(sid || '').toUpperCase()]; if (!want) return null; return byId.get(want) || [...byId.values()].find(n => n.side === 'claude' && P && P.nome({ id: n.id, plain: n.plain, title: n.title }) === P.nome(want)) || null; };
    const coordCodex = [...byId.values()].find(n => n.side === 'codex' && n.stage === 'coord') || null;
    const idDe = p => { if (!p) return null; const s = String(p.sessao || '').toUpperCase(); if (p.tipo === 'codex' && p.id) return 'f2:' + p.id; if (s === 'VOCE' || p.tipo === 'dono') return 'voce'; if (s === 'COORDENADOR-CODEX') return coordCodex ? coordCodex.id : null; const n = noDaSessao(s); return n ? n.id : null; };
    const estadoDe = e => e === 'rodando' ? 'trabalhando' : e === 'terminou' ? 'terminou' : e === 'erro' || e === 'parou' ? 'sem-leitura' : 'dormindo';
    const idadeDe = c => haMin(c && c.estado === 'terminou' && Number.isFinite(c.fimIdadeMin) ? c.fimIdadeMin : c && c.idadeMin);
    const fio = Array.isArray(f2.fio) ? f2.fio : [];
    const recentes = fio.filter(ev => ev && Number.isFinite(Date.parse(ev.em)) && now - Date.parse(ev.em) <= JANELA_MS);
    for (const s of f2.sessoes) {
      const dono = noDaSessao(s.sessao); if (!dono) continue;
      const lista = Array.isArray(s.codex) ? s.codex : [];
      const comFio = new Set(recentes.filter(ev => ev.para && ev.para.tipo === 'codex' || ev.de && ev.de.tipo === 'codex').map(ev => (ev.para && ev.para.tipo === 'codex' ? ev.para.id : ev.de.id)));
      const mostrar = lista.filter(c => c && (c.estado === 'rodando' || comFio.has(c.id))).slice(0, 3);
      if (Number.isFinite(s.total) && s.total > 0) out.nota.set(dono.id, s.total + ' Codex em 24 h · ' + (Number.isFinite(s.rodando) ? s.rodando : '?') + ' rodando agora');
      for (const c of mostrar) {
        const id = 'f2:' + c.id, idade = idadeDe(c);
        const nd = { id, stage: 'sessoes', side: 'codex', estado: estadoDe(c.estado), work: c.estado === 'rodando', needsYou: false, plain: dono.plain, title: c.titulo || null,
          lines: [[frase(c.titulo || c.resumo || 'Sem título na fonte'), false], [frase((c.estadoTexto || c.estado || '?') + (c.onde ? ' na ' + (c.onde === 'vps' ? 'VPS' : 'máquina') : '') + ' · ' + (c.estado === 'rodando' ? 'desde ' : '') + (c.estado === 'rodando' ? (c.desdeTexto || idade) : idade)), c.estado === 'rodando']], f2: c };
        out.nos.push(nd); out.filhos.set(id, { dono, n: Number.isInteger(c.ordem) ? c.ordem : null });
      }
    }
    // Codex sem dono (a fonte nao provou qual sessao mandou; nunca chutado): coluna da direita, os que rodam ou falaram em 2 h, ate 5
    const comFioTodos = new Set(recentes.flatMap(ev => [ev.de, ev.para]).filter(p => p && p.tipo === 'codex').map(p => p.id));
    (Array.isArray(f2.semDono) ? f2.semDono : []).filter(c => c && (c.estado === 'rodando' || comFioTodos.has(c.id) || (Number.isFinite(c.idadeMin) && c.idadeMin <= 120))).slice(0, 5).forEach((c, i) => {
      const idade = idadeDe(c);
      out.nos.push({ id: 'f2:' + c.id, stage: 'sessoes', side: 'codex', estado: estadoDe(c.estado), work: c.estado === 'rodando', needsYou: false, plain: 'Codex ' + (i + 1), title: null, semDono: true,
        lines: [[frase(c.titulo || c.resumo || 'Sem título na fonte'), false], [frase((c.estadoTexto || c.estado || '?') + (c.onde ? ' na ' + (c.onde === 'vps' ? 'VPS' : 'máquina') : '') + ' · ' + idade), c.estado === 'rodando']], f2: c });
    });
    // fio: Claude <-> o seu Codex vira linha nova; o resto (COORDENADOR <-> COORDENADOR do Codex, voce <-> COORDENADOR) da o resumo da linha que ja existe
    const grupos = new Map(), ultimo = new Map(), ids = new Set([...byId.keys(), ...out.nos.map(n => n.id)]);
    for (const ev of recentes) {
      const de = idDe(ev.de), para = idDe(ev.para); if (!de || !para || de === para || !ids.has(de) || !ids.has(para)) continue;
      const kind = ['comando', 'duvida', 'resposta'].includes(ev.tipo) ? ev.tipo : 'comando';
      const msg = { time: ev.dataTexto || '?', at: ev.em, kind, titulo: ev.titulo ? frase(ev.titulo) : null, resumo: ev.resumo ? frase(ev.resumo) : null, motivo: ev.motivo || null };
      const comCodex = de.startsWith('f2:') || para.startsWith('f2:');
      const k = de + '>' + para;
      if (!comCodex) { if (!ultimo.has(k)) ultimo.set(k, msg); continue; }
      const g = grupos.get(k) || { key: k, from: de, to: para, kind, count: 0, messages: [], sender: de.startsWith('f2:') ? 'codex' : de === 'voce' ? 'voce' : (byId.get(de) || {}).side || 'claude', at: ev.em, f2: true };
      g.count++; g.messages.unshift(msg); if (Date.parse(ev.em) > Date.parse(g.at)) g.at = ev.em; grupos.set(k, g);
    }
    for (const g of grupos.values()) { const age = Math.max(0, now - Date.parse(g.at)); const ultK = g.messages[g.messages.length - 1]; g.kind = ultK ? ultK.kind : g.kind; g.ageMin = Math.floor(age / 60000); g.recent = age <= 15 * 60000; g.lastTime = ultK ? ultK.time : '?'; out.edges.push(g); }
    out.enriquecer = edges => { for (const e of edges) { const u = ultimo.get(e.from + '>' + e.to); if (u) e.f2ult = u; } };
    return out;
  }
  // FLUXO VERTICAL (A no PC, C no celular): o mesmo preparo do desenharFluxo (mesmos nos, donos, juntadas e linhas), entregue em dado limpo ao fluxo-vertical.js
  function pacoteV(fv) {
    const lei = fv && fv.leitura;
    const base = { pronto: !!(fv && fv.known && Array.isArray(fv.nodes)), falhou: S.fluxoFalhou === true, agora: S.agora, snap: S.snap, f2: S.f2, conta: S.model && S.model.conta, lei, antigas: fv && fv.antigas,
      h, icon, identicon, css, sideColor, frase, haMin, kindN, reduced, anim, primeiraMaiuscula, getJSON, abrirDecidir, repintar: () => paintFluxo() };
    if (!base.pronto) return base;
    const all = fv.nodes.filter(nd => colOf(nd) >= 0 || nd.stage === 'ajudantes' && nd.of), byId = new Map(fv.nodes.map(nd => [nd.id, nd]));
    const X2 = f2Fluxo(fv, byId); for (const nd of X2.nos) { all.push(nd); byId.set(nd.id, nd); }
    const filhos = new Map(), donoN = new Map();
    for (const nd of all) { if (nd.f2) continue; const d = nd.stage === 'ajudantes' ? byId.get(nd.of) || null : donoDe(nd, byId); if (!d) continue; const n = (donoN.get(d.id) || 0) + 1; donoN.set(d.id, n); filhos.set(nd.id, { dono: d, n }); }
    for (const [id, f] of X2.filhos) filhos.set(id, f);
    let nodes = all.filter(nd => !filhos.has(nd.id));
    const gen = nodes.filter(nd => nd.side === 'claude' && colOf(nd) === 0 && /^conversa do claude$/i.test(nomeDe(nd)));
    const juntou = new Set(gen.length > 1 ? gen.map(nd => nd.id) : []);
    if (juntou.size) {
      const ORD = { trabalhando: 0, esperando: 1, dormindo: 2, terminou: 3, 'sem-leitura': 4 };
      const melhor = gen.slice().sort((a, b) => (ORD[a.estado] ?? 9) - (ORD[b.estado] ?? 9))[0];
      const jn = { id: 'f2:outras-claude', stage: 'sessoes', side: 'claude', estado: melhor.estado, work: gen.some(nd => nd.work), needsYou: gen.some(nd => nd.needsYou), plain: 'Outras conversas do Claude (' + gen.length + ')', title: null, lines: [[gen.length + ' conversas sem nome de sessão', false]], juntou: [...juntou] };
      nodes = [...nodes.filter(nd => !juntou.has(nd.id)), jn]; all.push(jn); byId.set(jn.id, jn);
      for (const [id, f] of filhos) if (juntou.has(f.dono.id)) filhos.set(id, { ...f, dono: jn });
      for (let i = all.length - 1; i >= 0; i--) if (juntou.has(all[i].id)) all.splice(i, 1);
    }
    const remap = id => juntou.has(id) ? 'f2:outras-claude' : id;
    const ids = new Set(all.map(nd => nd.id)), somadas = new Map();
    for (const e0 of [...(fv.edges || []), ...X2.edges]) {
      const f = remap(e0.from), t = remap(e0.to); if (f === t) continue;
      const e = f === e0.from && t === e0.to ? e0 : { ...e0, from: f, to: t, key: f + '>' + t };
      const k = f + '>' + t, o = somadas.get(k); if (!o) { somadas.set(k, e); continue; }
      const idadeO = Number.isFinite(o.ageMin) ? o.ageMin : 1e9, idadeE = Number.isFinite(e.ageMin) ? e.ageMin : 1e9, novo = idadeE < idadeO ? e : o;
      somadas.set(k, { ...o, key: k, count: (o.count || 0) + (e.count || 0), messages: [...(o.messages || []), ...(e.messages || [])], ageMin: Math.min(idadeO, idadeE) === 1e9 ? o.ageMin : Math.min(idadeO, idadeE), recent: !!(o.recent || e.recent), kind: novo.kind, lastTime: novo.lastTime, at: novo.at });
    }
    const edges = [...somadas.values()].filter(e => ids.has(e.from) && ids.has(e.to)); X2.enriquecer(edges);
    const caixas = caixasDe(S.model && S.model.lados);
    const nos = all.map(nd => { const f = filhos.get(nd.id); return { id: nd.id, nome: nomeDe(nd, f), lado: nd.id === 'voce' ? 'voce' : nd.side || '', side: nd.side || null, stage: nd.stage, col: colOf(nd), estado: nd.estado || '', work: !!nd.work, needsYou: !!nd.needsYou, hot: !!nd.hot,
      linhas: (nd.lines || []).map(l => [frase(l[0]), !!l[1]]), acao: acaoDe(nd, caixas), dono: f ? f.dono.id : null, ordem: f ? f.n : null, of: nd.of || null, f2: nd.f2 || null, semDono: !!nd.semDono, juntou: nd.juntou ? nd.juntou.length : 0, nota: X2.nota.get(nd.id) || null }; });
    const linhas = linhasDe(edges).map(l => ({ key: l.key, from: l.e.from, to: l.e.to, kind: l.kind, count: l.count, sender: l.sender, ageMin: l.ageMin, recent: l.recent, last: l.e.lastTime || '', resumo: resumoDe(l.ult, l.e) }));
    return { ...base, nos, linhas };
  }
  function paintFluxo() {
    const box = els.fluxo; if (!box) return;
    if (root.PainelFluxoV) { const info = root.PainelFluxoV.pintar(box, pacoteV(S.model && S.model.fv)); S.fluxoInfo = info || null; return; }
    const m = S.model, fv = m && m.fv, view = m && m.view, conta = m && m.conta;
    const frag = doc.createDocumentFragment();
    const anda = conta && Number.isInteger(conta.n) ? conta.n : null;
    const motionBtn = h('button', 'g-btn is-quieto g-ligar', 'Ligar animação'); motionBtn.type = 'button'; motionBtn.hidden = !reduced();
    motionBtn.title = 'A animação está desligada neste PC.'; motionBtn.addEventListener('click', () => { const t = doc.getElementById('motion-toggle'); if (t && html.dataset.motion === 'off') t.click(); else html.dataset.motion = 'on'; setTimeout(paintFluxo, 50); });
    // falha ou volta pulada da releitura aparece aqui. Paradas e Dorme contam so as caixas do mapa (sem as conversas antigas).
    const lei = fv && fv.leitura, hm = iso => { const t = Date.parse(iso || ''); if (!Number.isFinite(t)) return '?'; const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
    const janelaTxt = lei ? 'De ' + hm(lei.desde) + ' a ' + hm(lei.ate) + (lei.fonte === 'conversas' ? ' (últimas 2 h, pelo minuto)' : ' (por hora cheia)') + ' · fios lidos ' + (Number.isFinite(lei.idadeMin) ? haMin(lei.idadeMin) : '?') + (Number.isFinite(lei.idadeMin) && lei.idadeMin > 5 ? ' · leitura velha. Solução: o painel relê sozinho a cada 15 s; se seguir, reinicie o painel' : '') : 'Últimas 2 h · fios sem leitura (?) Solução: o painel relê sozinho a cada 15 s; se seguir, reinicie o painel';
    const avisos = [];
    if (lei && lei.conversasFalhaEm) avisos.push('A leitura das conversas falhou às ' + hm(lei.conversasFalhaEm) + '. Solução: o painel tenta de novo a cada 15 s.');
    const usaHist = !!(lei && lei.fonte !== 'conversas');
    if (usaHist && lei.falha) avisos.push('A releitura do histórico falhou às ' + hm(lei.falha.em) + (lei.falha.motivo ? ': ' + lei.falha.motivo : '') + '. Solução: o painel tenta de novo a cada 1 min; se seguir, reinicie o painel.');
    else if (usaHist && lei.pulada) avisos.push(Number.isFinite(lei.pulada.cpu) ? 'Releitura do histórico adiada às ' + hm(lei.pulada.em) + ': o processador estava em ' + lei.pulada.cpu + '%. Solução: volta sozinha quando ele baixar de 90%.' : 'Releitura do histórico adiada às ' + hm(lei.pulada.em) + ': o uso do processador não foi lido. Solução: o painel tenta de novo em 1 min; se seguir, reinicie o painel.');
    if (fv && fv.histNota) avisos.push(fv.histNota);
    const desenhadas = fv && Array.isArray(fv.nodes) ? fv.nodes.filter(nd => nd.id !== 'voce' && nd.stage !== 'ajudantes') : null;
    const contaEstado = st => desenhadas ? desenhadas.filter(nd => nd.estado === st).length : null;
    const head = h('div', 'g-fluxo-head',
      h('div', '', h('h2', 'g-h', 'Quem fala com quem'), h('p', 'g-sec g-fluxo-nota', janelaTxt + ' · cada direção tem a sua linha, na cor de quem manda · a etiqueta diz quantas e a última')),
      h('div', 'g-contagem',
        h('div', 'is-anda', h('span', 'g-lab', 'Anda'), h('span', 'g-num', anda === null ? '?' : String(anda))),
        h('div', 'is-espera', h('span', 'g-lab', 'Paradas'), h('span', 'g-n24', contaEstado('esperando') === null ? '?' : String(contaEstado('esperando')))),
        h('div', 'is-dorme', h('span', 'g-lab', 'Dorme'), h('span', 'g-n24', contaEstado('dormindo') === null ? '?' : String(contaEstado('dormindo')))), motionBtn));
    frag.append(head);
    const antigas = fv && Number.isFinite(fv.antigas) && fv.antigas > 0 ? ' · ' + (fv.antigas === 1 ? '1 conversa antiga fora do mapa' : fv.antigas + ' conversas antigas fora do mapa') : '';
    frag.append(h('p', 'g-sec g-fluxo-nota', 'Anda: ' + (conta && conta.comprovado ? quemAnda(conta) : anda === null ? '?' : String(anda)) + antigas));
    for (const a of avisos) frag.append(h('p', 'g-sec g-fluxo-nota g-fluxo-aviso', frase(a)));
    const rolo = h('div', 'g-mapa-rolo'), mapa = h('div', 'g-mapa'); rolo.append(mapa); frag.append(rolo);
    const lista = h('div', 'g-fluxo-lista'); lista.setAttribute('aria-label', 'Quem fala com quem, em lista'); frag.append(lista);
    if (!fv || !fv.known || !Array.isArray(fv.nodes)) { mapa.append(h('p', 'g-vazio', S.fluxo ? 'Leitura do fluxo indisponível (?)' : 'Lendo quem fala com quem...')); box.replaceChildren(frag); return; }
    const det = h('section', 'g-fio-det'); det.hidden = true; els.fioDet = det;
    const amostra = (kind, lado) => { const s = doc.createElementNS(SVGNS, 'svg'); s.setAttribute('width', '32'); s.setAttribute('height', '8'); s.setAttribute('class', 'g-amostra'); const g = doc.createElementNS(SVGNS, 'g'); g.setAttribute('class', 'g-fio'); if (lado) g.dataset.lado = lado; g.dataset.idade = 'quente'; const l = doc.createElementNS(SVGNS, 'line'); l.setAttribute('x1', '0'); l.setAttribute('x2', '32'); l.setAttribute('y1', '4.5'); l.setAttribute('y2', '4.5'); l.setAttribute('class', 'g-fio-l k-' + kind); l.setAttribute('shape-rendering', 'crispEdges'); g.append(l); s.append(g); return s; };
    els.amostra = amostra;
    const legenda = h('div', 'g-legenda',
      h('span', 'is-voce', h('i', 'g-sq is-voce'), 'Você manda'), h('span', 'is-claude', h('i', 'g-sq is-claude'), 'Claude manda'), h('span', 'is-codex', h('i', 'g-sq is-codex'), 'Codex manda'),
      h('span', '', amostra('comando'), 'Comando'), h('span', '', amostra('duvida'), 'Dúvida'), h('span', '', amostra('resposta'), 'Resposta'),
      h('span', '', 'Linha forte = falou agora; esfria em 15 min'), h('span', '', h('i', 'g-st is-anda'), 'Anda'), h('span', '', h('i', 'g-st is-espera'), 'Espera'), h('span', '', h('i', 'g-st'), 'Dorme'));
    const demoLink = h('a', 'g-link g-demo-link', S.demoEventos ? 'Parar demo' : 'Ver todas as animações'); demoLink.href = S.demoEventos ? '#g=equipe.fluxo' : '#g=equipe.fluxo&demo=eventos';
    demoLink.title = 'Demo só visual: toca cada animação em sequência, sem gravar nada'; demoLink.addEventListener('click', () => { setTimeout(() => root.location.reload(), 30); });
    legenda.append(demoLink);
    frag.append(det, legenda);
    box.replaceChildren(frag);
    desenharFluxo(mapa, fv, lista);
  }
  // linhas: 1 por direcao; se as mensagens lidas trazem mais de um tipo, 1 por tipo (a principal fica com o resto da conta)
  function linhasDe(edges) {
    const out = [];
    for (const e of edges) {
      const msgs = Array.isArray(e.messages) ? e.messages : [], por = new Map();
      for (const msg of msgs) por.set(msg.kind, (por.get(msg.kind) || 0) + 1);
      const outros = [...por].filter(([k]) => k !== e.kind), soma = outros.reduce((a, [, n]) => a + n, 0);
      const subs = [], nMain = (e.count || 0) - soma;
      if (nMain > 0 || !outros.length) subs.push([e.kind, nMain > 0 ? nMain : e.count || 0]);
      for (const [k, n] of outros) subs.push([k, n]);
      for (const [kind, count] of subs) {
        const mine = msgs.filter(msg => msg.kind === kind), ult = mine[mine.length - 1] || null;
        out.push({ key: e.key + '#' + kind, e, kind, count, ult, sender: e.sender || 'claude', ageMin: e.ageMin, recent: !!e.recent });
      }
    }
    return out;
  }
  // cartao "Outras conversas do Claude": a 2a linha diz o estado; sem estado lido leva a solucao no title, como no Fluxo
  const SEM_ESTADO_J = 'Sem estado lido', SEM_ESTADO_J_SOL = 'Solução: o painel lê de novo sozinho em 30 s';
  function linhasJuntadas(gen) {
    const cont = st => gen.filter(nd => nd.estado === st).length;
    const resumoJ = [cont('trabalhando') ? cont('trabalhando') + ' andando' : null, cont('esperando') ? cont('esperando') + ' esperando' : null, cont('dormindo') ? cont('dormindo') + ' dormindo' : null, cont('terminou') ? cont('terminou') + ' terminaram' : null].filter(Boolean).join(' · ');
    return [[gen.length + ' conversas sem nome de sessão', false], resumoJ ? [resumoJ, cont('trabalhando') > 0] : [SEM_ESTADO_J, false, SEM_ESTADO_J_SOL]];
  }
  function linhaNo(l, st) { const el = h('div', 'g-no-linha' + (l[1] ? ' is-quente' : ''), st, frase(l[0])); if (l[2]) el.title = l[2]; return el; }
  function desenharFluxo(mapa, fv, lista) {
    const W = Math.max(1000, mapa.clientWidth), wA = 184, wB = 196, voceW = 176, gapC = 48;
    const ML = 16, xC = Math.round((W - voceW) / 2), X = [ML, xC - gapC - wB, xC, xC + voceW + gapC, W - wA], WD = [wA, wB, voceW, wB, wA];
    const all = fv.nodes.filter(nd => colOf(nd) >= 0 || nd.stage === 'ajudantes' && nd.of), byId = new Map(fv.nodes.map(nd => [nd.id, nd]));
    const X2 = f2Fluxo(fv, byId); for (const nd of X2.nos) { all.push(nd); byId.set(nd.id, nd); }
    // Codex pendurado na sua sessao Claude (quando a fonte disser); os sem dono ficam na coluna da direita
    const filhos = new Map(), donoN = new Map();
    for (const nd of all) { if (nd.f2) continue; const d = nd.stage === 'ajudantes' ? byId.get(nd.of) || null : donoDe(nd, byId); if (!d) continue; const n = (donoN.get(d.id) || 0) + 1; donoN.set(d.id, n); filhos.set(nd.id, { dono: d, n }); }
    for (const [id, f] of X2.filhos) filhos.set(id, f);
    let nodes = all.filter(nd => !filhos.has(nd.id));
    const gen = nodes.filter(nd => nd.side === 'claude' && colOf(nd) === 0 && /^conversa do claude$/i.test(nomeDe(nd)));
    const juntou = new Set(gen.length > 1 ? gen.map(nd => nd.id) : []);
    if (juntou.size) {
      const ORD = { trabalhando: 0, esperando: 1, dormindo: 2, terminou: 3, 'sem-leitura': 4 };
      const melhor = gen.slice().sort((a, b) => (ORD[a.estado] ?? 9) - (ORD[b.estado] ?? 9))[0];
      const jn = { id: 'f2:outras-claude', stage: 'sessoes', side: 'claude', estado: melhor.estado, work: gen.some(nd => nd.work), needsYou: gen.some(nd => nd.needsYou), plain: 'Outras conversas do Claude (' + gen.length + ')', title: null, lines: linhasJuntadas(gen), juntou: [...juntou] };
      nodes = [...nodes.filter(nd => !juntou.has(nd.id)), jn]; all.push(jn); byId.set(jn.id, jn);
      for (const [id, f] of filhos) if (juntou.has(f.dono.id)) filhos.set(id, { ...f, dono: jn });
      for (let i = all.length - 1; i >= 0; i--) if (juntou.has(all[i].id)) all.splice(i, 1);
    }
    const remap = id => juntou.has(id) ? 'f2:outras-claude' : id;
    const byCol = [0, 1, 2, 3, 4].map(c => nodes.filter(nd => colOf(nd) === c));
    // coluna da direita = Codex sem dono (os que rodam primeiro), ate 5
    byCol[4] = byCol[4].sort((a, b) => (b.work ? 1 : 0) - (a.work ? 1 : 0)).slice(0, 5);
    const kids = id => all.filter(nd => filhos.has(nd.id) && filhos.get(nd.id).dono.id === id);
    const ids = new Set([...byCol.flat(), ...all.filter(nd => filhos.has(nd.id))].map(nd => nd.id));
    const somadas = new Map();
    for (const e0 of [...(fv.edges || []), ...X2.edges]) {
      const f = remap(e0.from), t = remap(e0.to); if (f === t) continue;
      const e = f === e0.from && t === e0.to ? e0 : { ...e0, from: f, to: t, key: f + '>' + t };
      const k = f + '>' + t, o = somadas.get(k); if (!o) { somadas.set(k, e); continue; }
      const idadeO = Number.isFinite(o.ageMin) ? o.ageMin : 1e9, idadeE = Number.isFinite(e.ageMin) ? e.ageMin : 1e9, novo = idadeE < idadeO ? e : o;
      somadas.set(k, { ...o, key: k, count: (o.count || 0) + (e.count || 0), messages: [...(o.messages || []), ...(e.messages || [])], ageMin: Math.min(idadeO, idadeE) === 1e9 ? o.ageMin : Math.min(idadeO, idadeE), recent: !!(o.recent || e.recent), kind: novo.kind, lastTime: novo.lastTime, at: novo.at });
    }
    const edges = [...somadas.values()].filter(e => ids.has(e.from) && ids.has(e.to)); X2.enriquecer(edges);
    const linhas = linhasDe(edges);
    const pc = new Map(); for (const nd of all) pc.set(nd.id, filhos.has(nd.id) ? colOf(filhos.get(nd.id).dono) : colOf(nd));
    const nBus = linhas.filter(l => Math.abs(pc.get(l.e.from) - pc.get(l.e.to)) > 1).length;
    const busTop = 32, top = busTop + Math.max(1, nBus) * 8 + 32, pitch = 104, kidH = 52;
    const alturaCol = c => byCol[c].reduce((a, nd) => a + pitch + kids(nd.id).length * kidH, 0);
    const corpo = Math.max(alturaCol(0), alturaCol(4), pitch);
    let height = top + corpo;
    mapa.style.minWidth = W + 'px';
    [['Sessões do Claude', 'claude'], ['Coordena', 'claude'], ['Você', 'voce'], ['Executa', 'codex'], ['Codex sem dono', 'codex']].forEach(([t, lado], i) => { const k = h('span', 'g-colk', t); k.dataset.lado = lado; k.style.left = X[i] + 'px'; mapa.append(k); });
    const caixas = caixasDe(S.model && S.model.lados);
    const pos = new Map(), nosInfo = [];
    const montarNo = (nd, c, x, y, filho) => {
      const voce = nd.id === 'voce', el = h('div', 'g-no' + (voce ? ' is-voce' : '') + (filho ? ' is-filho' : ''));
      const lado = voce ? 'voce' : nd.side || '';
      const face = voce ? icon('diamante', css('--g-rosa')) : identicon(nd.id, sideColor(nd.side), filho ? 3 : 4);
      const facebox = h('span', 'g-no-face', face);
      const linhasEl = h('div', 'g-no-linhas');
      const evU = voce && S.agora && S.agora.esperaVoce && S.agora.esperaVoce.rotulo ? S.agora.esperaVoce.rotulo : null;
      [...(nd.lines || []).map(l => evU && /\bcards?\s+esperam?\b/i.test(l[0]) ? [evU, l[1]] : l).slice(0, filho ? 2 : 3), ...(X2.nota.has(nd.id) ? [[X2.nota.get(nd.id), false]] : [])].forEach((l, j) => { const st = j === 0 && !voce ? h('i', 'g-st' + (nd.estado === 'trabalhando' ? ' is-anda' : nd.estado === 'esperando' ? ' is-espera' : '')) : null; linhasEl.append(linhaNo(l, st)); });
      const acao = acaoDe(nd, caixas), sprite = h('span', 'g-acao'); sprite.setAttribute('aria-hidden', 'true');
      const nome = nomeDe(nd, filho);
      el.append(facebox, h('div', '', h('div', 'g-no-nome', h('span', 'g-no-t', nome), voce ? null : sprite), linhasEl));
      el.dataset.id = nd.id; el.dataset.lado = lado; el.dataset.estado = nd.estado || ''; if (acao) el.dataset.acao = acao; if (filho) el.dataset.dono = filho.dono.id;
      el.dataset.work = nd.work ? '1' : '0'; if (nd.needsYou || (voce && nd.hot)) el.dataset.precisa = '1';
      el.style.top = y + 'px'; el.style.left = x + 'px';
      if (voce) el.style.width = voceW + 'px'; else el.style.maxWidth = (WD[c] - (filho ? 24 : 0)) + 'px';
      el.title = nome + (nd.tag ? ' · ' + frase(nd.tag) : '') + ' · ' + (nd.lines || []).map(l => frase(l[0])).join(' · ');
      mapa.append(el); pos.set(nd.id, { el, c });
      const aj = (nd.lines || []).map(l => /(\d+)\s+(?:ajudantes?|executor(?:es)?)\b(?:.*?(\d+)\s+agora)?/i.exec(l[0])).find(Boolean);
      nosInfo.push({ id: nd.id, el, lado, nome, estado: nd.estado || '', acao: acao || null, precisa: el.dataset.precisa === '1', ajTotal: aj ? Number(aj[1]) : null, ajAgora: aj && aj[2] ? Number(aj[2]) : (aj ? 0 : null), cards: voce ? (nd.lines || []).map(l => /(\d+)\s+cards?/i.exec(l[0])).filter(Boolean).map(x => Number(x[1]))[0] ?? null : null });
    };
    // F2: as caixas ficam na altura de verdade (medida) com 32 px de vao entre elas, para a etiqueta caber entre as linhas
    const VAO = 32, colunaEm = (c, y0) => { let y = y0; for (const nd of byCol[c]) { montarNo(nd, c, X[c], y); y += pos.get(nd.id).el.offsetHeight + 8; for (const k of kids(nd.id)) { montarNo(k, c, X[c] + 24, y, filhos.get(k.id)); y += pos.get(k.id).el.offsetHeight + 4; } y += VAO; } return y - y0; };
    const alt0 = colunaEm(0, top), alt4 = colunaEm(4, top), corpoReal = Math.max(alt0, alt4, pitch);
    for (const c of [1, 2, 3]) { const list = byCol[c]; if (list.length === 1) { montarNo(list[0], c, X[c], top); const el = pos.get(list[0].id).el; el.style.top = (top + Math.max(0, Math.round((corpoReal - VAO - el.offsetHeight) / 2))) + 'px'; let y = parseInt(el.style.top, 10) + el.offsetHeight + 8; for (const k of kids(list[0].id)) { montarNo(k, c, X[c] + 24, y, filhos.get(k.id)); y += pos.get(k.id).el.offsetHeight + 4; } } else colunaEm(c, top); }
    height = top + Math.max(corpoReal, ...[1, 2, 3].map(c => byCol[c].length > 1 ? byCol[c].length * pitch : 0));
    const s = doc.createElementNS(SVGNS, 'svg'); s.setAttribute('class', 'g-fios'); s.setAttribute('width', W); s.setAttribute('shape-rendering', 'crispEdges'); mapa.prepend(s);
    const camada = doc.createElement('canvas'); camada.className = 'g-anim'; camada.setAttribute('aria-hidden', 'true'); mapa.append(camada);
    mapa.style.height = height + 'px';
    const base = mapa.getBoundingClientRect();
    const caixaDe = el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left - base.left), y: Math.round(r.top - base.top), w: Math.round(r.width), h: Math.round(r.height) }; };
    const R = id => { const p = pos.get(id); if (!p) return null; const b = caixaDe(p.el); return { c: pc.get(id), l: b.x, r: b.x + b.w, t: b.y, b: b.y + b.h, cy: b.y + 18 }; };
    const gapL = g => X[g] + WD[g], gapR = g => X[g + 1];
    const ladoK = (id, side) => id + ':' + side, total = new Map(), usado = new Map(), plan = [];
    const sideOut = (c, other) => c === 0 ? 'r' : c === 4 ? 'l' : other;
    for (const l of linhas) {
      const e = l.e, ca = pc.get(e.from), cb = pc.get(e.to);
      if (ca === cb) plan.push([l, 'mesma', ladoK(e.from, 'l'), ladoK(e.to, 'l')]);
      else if (Math.abs(ca - cb) === 1) { const right = ca < cb; plan.push([l, 'viz', ladoK(e.from, right ? 'r' : 'l'), ladoK(e.to, right ? 'l' : 'r')]); }
      else plan.push([l, 'bus', ladoK(e.from, sideOut(ca, 't')), ladoK(e.to, sideOut(cb, 't'))]);
    }
    for (const [, , pa, pb] of plan) for (const k of [pa, pb]) total.set(k, (total.get(k) || 0) + 1);
    const PORTA = 10, porta = k => { const n = total.get(k) || 1, i = usado.get(k) || 0; usado.set(k, i + 1); return Math.round((i - (n - 1) / 2) * PORTA); };
    // cada linha tem a sua faixa no vao (separadas; se o vao aperta, o passo encolhe ate 5 px)
    const porVao = new Map(); for (const [, tipo, pa, pb] of plan) if (tipo === 'viz') { const g = Math.min(pc.get(pa.split(':').slice(0, -1).join(':')), pc.get(pb.split(':').slice(0, -1).join(':'))); porVao.set(g, (porVao.get(g) || 0) + 1); }
    const lanes = new Map(), lane = k => { const n = lanes.get(k) || 0; lanes.set(k, n + 1); return n; };
    const passoVao = g => { const n = porVao.get(g) || 1, larg = gapR(g) - gapL(g) - 24; return Math.max(5, Math.min(10, Math.floor(larg / Math.max(1, n)))); };
    const px = v => Math.round(v) + 0.5; let bus = 0;
    const seta = (X0, Y0, dir) => { const pts = dir === 'r' ? [[X0 - 5, Y0 - 4], [X0 + 1, Y0 + 0.5], [X0 - 5, Y0 + 5]] : dir === 'l' ? [[X0 + 6, Y0 - 4], [X0, Y0 + 0.5], [X0 + 6, Y0 + 5]] : [[X0 - 4, Y0 - 5], [X0 + 0.5, Y0 + 1], [X0 + 5, Y0 - 5]]; const t = doc.createElementNS(SVGNS, 'path'); t.setAttribute('d', 'M' + pts.map(q => q.join(' ')).join(' L') + ' Z'); t.setAttribute('class', 'g-fio-seta'); return t; };
    const fiosInfo = [], tags = [];
    for (const [l, tipo, pa, pb] of plan) {
      const e = l.e, a = R(e.from), b = R(e.to); if (!a || !b) continue;
      let pts, dir;
      if (tipo === 'viz') {
        const right = a.c < b.c, g = Math.min(a.c, b.c), k = lane('v' + g), passo = passoVao(g), n = porVao.get(g) || 1;
        const x1 = right ? a.r + 4 : a.l - 4, x2 = right ? b.l - 4 : b.r + 4;
        const xm = Math.round((gapL(g) + gapR(g)) / 2 + (k - (n - 1) / 2) * passo);
        const y1 = a.cy + porta(pa), y2 = b.cy + porta(pb);
        pts = [[x1, y1], [xm, y1], [xm, y2], [x2, y2]]; dir = right ? 'r' : 'l';
      } else if (tipo === 'mesma') {
        // pai e filho na mesma coluna (sessao Claude e o seu Codex): sai pela esquerda e volta
        const xg = Math.max(2, Math.min(a.l, b.l) - 10 - lane('m' + a.c) * 6), y1 = a.cy + porta(pa), y2 = b.cy + porta(pb);
        pts = [[a.l - 4, y1], [xg, y1], [xg, y2], [b.l - 4, y2]]; dir = 'r';
      } else {
        const yb = busTop + 8 + (bus++) * 8;
        if (a.c === 0 || a.c === 4) { const xg = a.c === 0 ? gapL(0) + 12 + lane('b0') * 8 : gapR(3) - 12 - lane('b3') * 8, y1 = a.cy + porta(pa); pts = [[a.c === 0 ? a.r + 4 : a.l - 4, y1], [xg, y1], [xg, yb]]; }
        else { const x1 = Math.round((a.l + a.r) / 2) + porta(pa); pts = [[x1, a.t - 4], [x1, yb]]; }
        if (b.c === 0 || b.c === 4) { const toLeft = b.c === 0, xg = toLeft ? gapL(0) + 12 + lane('b0') * 8 : gapR(3) - 12 - lane('b3') * 8, x2 = toLeft ? b.r + 4 : b.l - 4, y2 = b.cy + porta(pb); pts.push([xg, yb], [xg, y2], [x2, y2]); dir = toLeft ? 'l' : 'r'; }
        else { const x2 = Math.round((b.l + b.r) / 2) + porta(pb); pts.push([x2, yb], [x2, b.t - 4]); dir = 'd'; }
      }
      const d = 'M' + pts.map(q => px(q[0]) + ' ' + px(q[1])).join(' L');
      const g = doc.createElementNS(SVGNS, 'g'); g.setAttribute('class', 'g-fio'); g.dataset.key = l.key; g.dataset.kind = l.kind; g.dataset.lado = l.sender; g.dataset.idade = idadeDe(l.ageMin);
      if (S.fioSel === l.key) g.dataset.sel = '1'; else if (S.fioSel) g.dataset.apagado = '1';
      const pth = doc.createElementNS(SVGNS, 'path'); pth.setAttribute('d', d); pth.setAttribute('class', 'g-fio-l k-' + l.kind);
      const deN = (nosInfo.find(n => n.id === e.from) || {}).nome || '?', paraN = (nosInfo.find(n => n.id === e.to) || {}).nome || '?';
      const resumo = resumoDe(l.ult, e);
      const tt = doc.createElementNS(SVGNS, 'title'); tt.textContent = deN + ' → ' + paraN + ' · ' + kindN(l.kind, l.count) + (resumo ? ' · ' + resumo : '') + ' · ' + (Number.isFinite(l.ageMin) ? haMin(l.ageMin, 'última há ') : 'hora ?') + ' · clique para ver as mensagens'; g.append(tt, pth);
      const X0 = Math.round(pts[pts.length - 1][0]), Y0 = Math.round(pts[pts.length - 1][1]);
      g.append(seta(X0, Y0, dir));
      const hit = doc.createElementNS(SVGNS, 'path'); hit.setAttribute('d', d); hit.setAttribute('class', 'g-fio-hit'); hit.setAttribute('tabindex', '0'); hit.setAttribute('role', 'button'); hit.setAttribute('aria-label', deN + ' para ' + paraN + ': ' + kindN(l.kind, l.count) + (resumo ? ', ' + resumo : ''));
      const abrir = () => { S.fioSel = S.fioSel === l.key ? null : l.key; paintFluxo(); };
      hit.addEventListener('click', abrir); hit.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrir(); } });
      hit.addEventListener('mouseenter', () => g.dataset.hover = '1'); hit.addEventListener('mouseleave', () => delete g.dataset.hover);
      g.append(hit); s.append(g);
      const info = { key: l.key, el: g, pts, de: e.from, para: e.to, deNome: deN, paraNome: paraN, ida: { key: l.key, kind: l.kind, sender: l.sender, count: l.count, last: e.lastTime || '', recent: l.recent, ageMin: l.ageMin, resumo }, volta: null };
      fiosInfo.push(info); tags.push({ l, info, resumo, abrir });
      if (S.fioSel === l.key) mostrarFio(l, linhas, nosInfo);
    }
    // etiquetas: no meio de cada linha, sem cobrir caixa nem outra etiqueta (empilha; longe do meio puxa um fio guia)
    const ocupado = [...pos.values()].map(p => { const b = caixaDe(p.el); return { x: b.x - 6, y: b.y - 4, w: b.w + 12, h: b.h + 8 }; });
    for (const k of mapa.querySelectorAll('.g-colk')) { const b = caixaDe(k); ocupado.push({ x: b.x - 4, y: b.y - 2, w: b.w + 8, h: b.h + 4 }); }
    const bate = r => ocupado.some(o => r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y);
    let fundo = height;
    const guias = doc.createElementNS(SVGNS, 'g'); guias.setAttribute('class', 'g-guias'); s.append(guias);
    for (const t of tags) {
      const { l, info } = t, tag = h('button', 'g-fio-tag', h('span', 'g-fio-tag-n', kindN(l.kind, l.count)), t.resumo ? h('span', 'g-fio-tag-r', t.resumo) : null);
      tag.type = 'button'; tag.dataset.lado = l.sender; tag.dataset.kind = l.kind; tag.dataset.idade = idadeDe(l.ageMin); tag.dataset.key = l.key; if (S.fioSel === l.key) tag.dataset.sel = '1'; else if (S.fioSel) tag.dataset.apagado = '1';
      tag.title = info.deNome + ' → ' + info.paraNome + ' · ' + kindN(l.kind, l.count) + (t.resumo ? ' · ' + t.resumo : ' · sem resumo na fonte');
      tag.addEventListener('click', t.abrir); tag.addEventListener('mouseenter', () => info.el.dataset.hover = '1'); tag.addEventListener('mouseleave', () => delete info.el.dataset.hover);
      mapa.append(tag);
      let tw = tag.offsetWidth, th = tag.offsetHeight;
      // ancora: meio do maior trecho da linha
      let best = 0, ax = info.pts[0][0], ay = info.pts[0][1];
      for (let i = 1; i < info.pts.length; i++) { const [x0, y0] = info.pts[i - 1], [x1, y1] = info.pts[i], len = Math.abs(x1 - x0) + Math.abs(y1 - y0); if (len > best) { best = len; ax = (x0 + x1) / 2; ay = (y0 + y1) / 2; } }
      // F2: 1o perto da linha (raio ate 96) com o resumo; depois a versao curta (so a contagem; o resumo fica no hover e no clique); so entao longe
      const tenta = rmax => {
        for (let r = 0; r <= rmax; r += 12) for (const [dx, dy] of r === 0 ? [[0, 0]] : [[0, -r], [0, r], [r, 0], [-r, 0], [r, -r], [-r, -r], [r, r], [-r, r], [r / 2, -r], [-r / 2, -r], [r / 2, r], [-r / 2, r]]) {
          const x = Math.round(Math.max(0, Math.min(W - tw, ax - tw / 2 + dx))), y = Math.round(Math.max(busTop, ay - th / 2 + dy));
          if (!bate({ x: x - 2, y: y - 2, w: tw + 4, h: th + 4 })) return { x, y };
        }
        return null;
      };
      let pick = tenta(96);
      if (!pick && t.resumo) { const rr = tag.querySelector('.g-fio-tag-r'); if (rr) rr.remove(); tag.classList.add('is-curta'); tw = tag.offsetWidth; th = tag.offsetHeight; pick = tenta(96); }
      if (!pick) pick = tenta(360);
      if (!pick) pick ={ x: Math.round(Math.max(0, Math.min(W - tw, ax - tw / 2))), y: fundo + 8 };
      tag.style.left = pick.x + 'px'; tag.style.top = pick.y + 'px';
      ocupado.push({ x: pick.x - 2, y: pick.y - 2, w: tw + 4, h: th + 4 }); fundo = Math.max(fundo, pick.y + th + 8);
      const cx = Math.max(pick.x, Math.min(pick.x + tw, ax)), cy = Math.max(pick.y, Math.min(pick.y + th, ay));
      if (Math.hypot(cx - ax, cy - ay) > 14) {
        const gl = doc.createElementNS(SVGNS, 'path'); gl.setAttribute('d', 'M' + px(ax) + ' ' + px(ay) + ' L' + px(cx) + ' ' + px(ay) + ' L' + px(cx) + ' ' + px(cy)); gl.setAttribute('class', 'g-guia'); gl.dataset.lado = l.sender; gl.dataset.key = l.key; guias.append(gl);
        const pt = doc.createElementNS(SVGNS, 'rect'); pt.setAttribute('x', Math.round(ax) - 2); pt.setAttribute('y', Math.round(ay) - 2); pt.setAttribute('width', 4); pt.setAttribute('height', 4); pt.setAttribute('class', 'g-guia-pt'); pt.dataset.lado = l.sender; guias.append(pt);
      }
      info.tag = tag;
    }
    height = Math.max(height, fundo); mapa.style.height = height + 'px'; s.setAttribute('height', height);
    if (S.fioSel && !fiosInfo.some(f => f.key === S.fioSel)) S.fioSel = null;
    S.fluxoInfo = { mapa, camada, W, H: height, fios: fiosInfo, nos: nosInfo };
    pintarLista(lista, nosInfo, tags);
    if (anim()) anim().fluxo(S.fluxoInfo);
  }
  // celular (e leitor de tela): a mesma leitura em lista, sem mapa que rola de lado
  function pintarLista(lista, nosInfo, tags) {
    if (!lista) return;
    const ol = h('ol', 'g-list g-fl-linhas');
    const ord = tags.slice().sort((a, b) => (a.l.ageMin ?? 1e9) - (b.l.ageMin ?? 1e9));
    for (const t of ord) {
      const { l, info } = t;
      const li = h('li', 'g-fl-linha', h('span', 'g-fl-de', h('b', 'g-nome', info.deNome), ' → ', h('b', 'g-nome', info.paraNome)), h('span', 'g-fl-tipo', els.amostra ? els.amostra(l.kind, l.sender) : null, kindN(l.kind, l.count)), h('span', 'g-sec', (t.resumo || 'Sem resumo na fonte') + ' · ' + (Number.isFinite(l.ageMin) ? haMin(l.ageMin) : 'hora ?')));
      li.dataset.lado = l.sender; li.dataset.idade = idadeDe(l.ageMin); li.querySelectorAll('.g-nome')[0].dataset.lado = (nosInfo.find(n => n.id === info.de) || {}).lado || ''; li.querySelectorAll('.g-nome')[1].dataset.lado = (nosInfo.find(n => n.id === info.para) || {}).lado || '';
      ol.append(li);
    }
    const nos = h('ol', 'g-list g-fl-nos');
    for (const n of nosInfo) { const li = h('li', 'g-fl-no', h('i', 'g-st' + (n.estado === 'trabalhando' ? ' is-anda' : n.estado === 'esperando' ? ' is-espera' : '')), h('b', 'g-nome', n.nome), h('span', 'g-sec', frase(n.el.querySelector('.g-no-linha') ? n.el.querySelector('.g-no-linha').textContent : ''))); li.querySelector('.g-nome').dataset.lado = n.lado; nos.append(li); }
    lista.replaceChildren(h('h3', 'g-lab', 'Mensagens'), ord.length ? ol : h('p', 'g-vazio', 'Nenhuma mensagem nas últimas 2 h'), h('h3', 'g-lab', 'Quem está no fluxo'), nos);
  }
  // detalhe da linha escolhida: as ultimas mensagens das 2 direcoes do par, com hora, DE e PARA na cor do lado e o resumo
  function mostrarFio(l, linhas, nosInfo) {
    const det = els.fioDet; if (!det) return;
    const fechar = h('button', 'g-btn is-quieto', 'Fechar'); fechar.type = 'button'; fechar.addEventListener('click', () => { S.fioSel = null; paintFluxo(); });
    const par = linhas.filter(x => (x.e.from === l.e.from && x.e.to === l.e.to) || (x.e.from === l.e.to && x.e.to === l.e.from));
    const nomeLado = id => { const n = nosInfo.find(x => x.id === id); return n ? [n.nome, n.lado] : ['?', '']; };
    const rows = [];
    for (const x of par) for (const msg of (x.e.messages || []).filter(mm => mm.kind === x.kind)) rows.push({ x, msg });
    const horaDe = (msg, x) => msg.time && msg.time !== '?' ? msg.time : x.e.lastTime && x.e.lastTime !== '?' ? x.e.lastTime + ' (última do par)' : Number.isFinite(x.ageMin) ? haMin(x.ageMin) : '?';
    rows.sort((a, b) => { const ta = Date.parse(a.msg.at), tb = Date.parse(b.msg.at); if (Number.isFinite(ta) && Number.isFinite(tb)) return tb - ta; return String(b.msg.time || '').localeCompare(String(a.msg.time || '')); });
    const ol = h('ol', 'g-list');
    rows.forEach((r, i) => { r.i = i; });
    for (const { x, msg, i } of rows.slice(0, 8)) {
      const [dn, dl] = nomeLado(x.e.from), [pn, pl] = nomeLado(x.e.to), resumo = resumoDe(msg, x.e, i === 0);
      const de = h('b', 'g-nome', dn), para = h('b', 'g-nome', pn); de.dataset.lado = dl; para.dataset.lado = pl;
      const tipo = h('span', 'g-fio-tipo', els.amostra ? els.amostra(x.kind, x.sender) : null, KIND_T[x.kind] || 'Comando'); tipo.dataset.lado = x.sender;
      ol.append(h('li', 'g-fio-msg', h('span', 'g-sec g-fio-hora', horaDe(msg, x)), tipo, h('span', 'g-fio-quem', de, ' → ', para), h('span', 'g-fio-txt', h('span', resumo ? 'g-txt' : 'g-sec', resumo || 'Sem resumo na fonte'), msg.titulo && msg.resumo ? h('span', 'g-sec', frase(msg.resumo)) : msg.motivo ? h('span', 'g-sec', 'Sem resumo: ' + msg.motivo) : null)));
    }
    if (!ol.childElementCount) ol.append(h('li', 'g-sec', 'Sem mensagem lida nesta leitura (?)'));
    const tot = par.reduce((a, x) => a + x.count, 0);
    det.replaceChildren(h('div', 'g-col-head', h('h2', 'g-h', 'Fio escolhido'), h('span', 'g-sec', tot + ' mensagens nas últimas 2 h' + (par.length > 1 ? ' · nas 2 direções' : '')), fechar), ol);
    det.hidden = false;
  }

  // ---------- CEREBRO ----------
  function paintCerebro() {
    const box = els.cerebro; if (!box) return;
    const d = S.cerebro, M = root.CerebroModelo;
    if (!d || !M) { box.replaceChildren(h('p', 'g-vazio', d === null ? 'Lendo o cérebro...' : 'Cérebro indisponível nesta leitura (?)')); return; }
    const vivos = (d.live || []).filter(n => n.fresh).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    const frag = doc.createDocumentFragment();
    // trabalhos abertos: 1 numero que importa + a linha do item aberto
    const v0 = vivos[0];
    const itemV = h('div', 'g-aberto-item');
    if (v0) {
      const mem = (v0.memories || []).map(m => typeof m === 'string' ? m : m && (m.title || m.id)).filter(Boolean)[0];
      itemV.append(h('div', 'g-meta', h('i', 'g-st is-anda'), h('i', 'g-sq' + (/codex/i.test(v0.title + ' ' + v0.desc) ? ' is-codex' : /claude|coordenador|atendimento|assistente|loja|cortes/i.test(v0.title) ? ' is-claude' : '')), h('b', '', semCru(v0.title)), '· ' + ago(v0.at)), semCru(v0.desc) && semCru(v0.desc) !== semCru(v0.title) ? h('p', 'g-txt g-clamp', semCru(v0.desc)) : '', h('p', 'g-sec', mem ? 'ligado a: ' + humanTitle(mem) : 'sem memória ligada nesta leitura'));
    } else itemV.append(h('p', 'g-sec', 'nenhum trabalho aberto nesta leitura'));
    const abrir = h('button', 'g-btn', 'Abrir'); abrir.type = 'button'; abrir.disabled = !v0; abrir.addEventListener('click', () => v0 && detalhe(v0, true));
    const headC = h('div', 'g-col-head', h('h2', 'g-h', 'TRABALHOS ABERTOS'), h('span', 'g-sec', d.readAt ? 'lido ' + ago(d.readAt) : '')); headC.style.marginBottom = '16px';
    frag.append(headC, h('div', 'g-aberto', h('span', 'g-num', String(vivos.length)), itemV, abrir));
    // os 4 numeros, mesma cor, numa linha
    const q = h('div', 'g-quatro');
    for (const [n, l] of [[d.nodes.length, 'pontos no mapa'], [d.edges.length, 'ligações'], [d.nodes.filter(n => n.tipo === 'feedback').length, 'lições'], [d.nodes.filter(n => n.tipo === 'user').length, 'ordens']]) q.append(h('div', '', h('span', 'g-n24', String(n)), h('span', 'g-sec', l)));
    frag.append(q);
    // mapa: pontos viram quadrados de 4 px na grade; grupos rotulados em pixel; centro vazio
    const wrap = h('div', 'g-cerebro-mapa'), canvas = doc.createElement('canvas'); canvas.setAttribute('aria-label', 'Mapa do cérebro: ' + d.nodes.length + ' pontos em 5 grupos'); wrap.append(canvas);
    frag.append(wrap);
    frag.append(h('p', 'g-sec g-cb-legenda', 'quadrado = 1 memória ou regra · verde = trabalho aberto agora · linha clara = ligação em uso · passe o mouse num quadrado, clique para fixar'));
    const linha = h('div', 'g-item-aberto'); frag.append(linha); els.cbLinha = linha;
    box.replaceChildren(frag);
    els.cbCanvas = canvas; desenharCerebro(); paintCbLinha();
    canvas.addEventListener('mousemove', ev => { const n = perto(ev); if ((n && n.id) !== (S.hover && S.hover.id)) { S.hover = n; canvas.style.cursor = n ? 'pointer' : 'crosshair'; desenharCerebro(); paintCbLinha(); } });
    canvas.addEventListener('mouseleave', () => { S.hover = null; desenharCerebro(); paintCbLinha(); });
    canvas.addEventListener('click', ev => { const n = perto(ev); if (n) { S.sel = n.id; desenharCerebro(); paintCbLinha(); } });
  }
  function cbPontos() {
    const d = S.cerebro, M = root.CerebroModelo; if (!d || !M) return null;
    if (S.cerebroPos && S.cerebroPos.w === els.cbCanvas.clientWidth) return S.cerebroPos;
    const vivos = (d.live || []).filter(n => n.fresh).map(n => ({ ...n, live: true, tipo: 'project', grupo: 'dominio', region: 'Sessoes' }));
    const nodes = [...d.nodes, ...vivos], edges = [...d.edges, ...vivos.filter(n => n.target && d.nodes.some(m => m.id === n.target)).map(n => ({ de: n.target, para: n.id }))];
    const lay = M.layout(nodes, edges, false), w = els.cbCanvas.clientWidth, hh = 560;
    const map = (nx, ny) => [Math.round((w / 2 + nx * w * 1.06) / 4) * 4, Math.round((hh / 2 - 8 + ny * hh * 0.9) / 4) * 4];
    const pts = lay.nodes.map(n => { const [x, y] = map(n.x, n.y); return { ...n, px: Math.max(4, Math.min(w - 8, x)), py: Math.max(32, Math.min(hh - 12, y)) }; });
    const byId = new Map(pts.map(p => [p.id, p]));
    const grupos = M.regions.map(r => { const g = pts.filter(p => p.region === r); if (!g.length) return null; const minY = Math.min(...g.map(p => p.py)), xs = g.map(p => p.px); return { nome: M.names[r].toUpperCase(), x: Math.round((Math.min(...xs) + Math.max(...xs)) / 2), y: minY - 16 }; }).filter(Boolean);
    const grau = new Map(); for (const e of edges) { grau.set(e.de, (grau.get(e.de) || 0) + 1); grau.set(e.para, (grau.get(e.para) || 0) + 1); }
    const pedido = cbHash(); if (pedido && pedido !== S.cbPedido && byId.has(pedido)) { S.sel = pedido; S.cbPedido = pedido; }
    if (!S.sel || !byId.has(S.sel)) S.sel =(pts.filter(p => !p.live).sort((p, q) => (grau.get(q.id) || 0) - (grau.get(p.id) || 0))[0] || {}).id || null;
    S.cerebroPos = { w, pts, byId, edges, grupos }; return S.cerebroPos;
  }
  function desenharCerebro() {
    const c = els.cbCanvas; if (!c || !c.isConnected) return; const P = cbPontos(); if (!P) return;
    const dpr = root.devicePixelRatio || 1, w = c.clientWidth, hh = 560; c.width = Math.round(w * dpr); c.height = Math.round(hh * dpr);
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, hh); x.imageSmoothingEnabled = false;
    const used = new Set((S.cerebro.used || []).map(e => e.de + '>' + e.para)), foco = S.hover || (S.sel && P.byId.get(S.sel));
    x.lineWidth = 1;
    for (const e of P.edges) {
      const a = P.byId.get(e.de), b = P.byId.get(e.para); if (!a || !b) continue;
      const hot = foco && (e.de === foco.id || e.para === foco.id), u = used.has(e.de + '>' + e.para);
      x.strokeStyle = hot ? 'rgba(236,232,223,.32)' : u ? 'rgba(236,232,223,.28)' : 'rgba(169,163,152,.045)';
      x.beginPath(); x.moveTo(a.px + 2, a.py + 2); x.lineTo(b.px + 2, b.py + 2); x.stroke();
    }
    for (const p of P.pts) { x.fillStyle = p.live ? css('--g-anda') : 'rgba(169,163,152,.85)'; x.fillRect(p.px, p.py, 4, 4); }
    if (foco) { x.fillStyle = css('--g-tx'); x.fillRect(foco.px - 2, foco.py - 2, 8, 8); x.strokeStyle = css('--g-tx'); x.strokeRect(foco.px - 5.5, foco.py - 5.5, 15, 15); }
    x.font = getComputedStyle(html).getPropertyValue('--g-p16').trim() + ' Silkscreen, monospace'; x.fillStyle = css('--g-tx2'); x.textBaseline = 'alphabetic';
    for (const g of P.grupos) { const tw = x.measureText(g.nome).width, gx = Math.round(Math.max(0, Math.min(w - tw, g.x - tw / 2))); x.fillStyle = css('--g-bg'); x.fillRect(gx - 4, g.y - 16, Math.ceil(tw) + 8, 20); x.fillStyle = css('--g-tx2'); x.fillText(g.nome, gx, g.y); }
  }
  function perto(ev) {
    const P = S.cerebroPos; if (!P) return null; const r = els.cbCanvas.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
    let best = null, bd = 10 * 10; for (const p of P.pts) { const dx = p.px + 2 - mx, dy = p.py + 2 - my, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = p; } } return best;
  }
  function paintCbLinha() {
    const L = els.cbLinha; if (!L) return; const P = S.cerebroPos, M = root.CerebroModelo;
    const n = S.hover || (S.sel && P && P.byId.get(S.sel));
    if (!n) { L.replaceChildren(h('i', 'g-sq'), h('p', 'g-sec', 'nenhum ponto escolhido · passe o mouse no mapa'), h('span', '')); return; }
    const lig = P.edges.filter(e => e.de === n.id || e.para === n.id).length;
    const ab = h('button', 'g-btn', 'Abrir'); ab.type = 'button'; ab.addEventListener('click', () => detalhe(n, !!n.live));
    // MASTIGAR (F2): titulo de gente + 1 frase do que e; tipo, grupo e ligacoes embaixo; o arquivo so no "ver fonte"
    const frase1 = cbFrase(n);
    L.replaceChildren(h('i', 'g-sq' + (n.live ? ' is-claude' : '')), h('div', '', h('div', 'g-row-nome', cbTitulo(n)), frase1 ? h('p', 'g-txt', frase1) : null, h('p', 'g-sec', cbMeta(n, M, lig)), cbFonte(n)), ab);
  }
  const cbTitulo = n => { const P = NM(); if (n.live) return humanTitle(semCru(n.title)); return P ? P.titulo(n.id || n.title) : humanTitle(n.title); };
  const cbFrase = n => { const P = NM(), d = n.live ? semCru(n.desc) : n.desc; if (!d || /^null/.test(String(d))) return ''; return P ? P.resumo(d, { cortada: !n.live && String(d).length >= 120 }) : String(d); };
  const cbMeta = (n, M, lig) => [M.types[n.tipo] || n.tipo || null, M.names[n.region] || (n.grupo ? humanTitle(n.grupo) : null), lig + (lig === 1 ? ' ligação' : ' ligações')].filter(Boolean).map((x, i) => i ? String(x).toLowerCase() : x).join(' · ');
  function cbFonte(n) { if (!n.arquivo) return null; const d = h('details', 'g-ver-fonte'); d.append(h('summary', '', 'ver fonte'), h('span', 'g-sec', n.arquivo)); return d; }
  function cbHash() { const m = /[#&]cb=([^&]+)/.exec(root.location.hash || ''); try { return m ? decodeURIComponent(m[1]) : null; } catch { return null; } }
  function detalhe(n, vivo) {
    const dlg = doc.getElementById('drawer'), title = doc.getElementById('drawer-title'), body = doc.getElementById('drawer-body'); if (!dlg || !title || !body) return;
    title.textContent = cbTitulo(n);
    const P = S.cerebroPos, viz = P ? P.edges.filter(e => e.de === n.id || e.para === n.id).map(e => P.byId.get(e.de === n.id ? e.para : e.de)).filter(Boolean) : [];
    const lista = h('ul', 'g-list'); for (const v of viz.slice(0, 24)) lista.append(h('li', 'g-sec', cbTitulo(v)));
    const mems = vivo ? (n.memories || []).map(m => typeof m === 'string' ? m : m && (m.title || m.id)).filter(Boolean).slice(0, 12) : [];
    const ml = h('ul', 'g-list'); for (const m of mems) ml.append(h('li', 'g-sec', NM() ? NM().titulo(m) : humanTitle(m)));
    const inteiro = n.desc && !/^null/.test(String(n.desc)) ? (NM() ? NM().resumo(vivo ? semCru(n.desc) : n.desc) : semCru(n.desc)) : '';
    body.replaceChildren(h('p', 'g-txt', inteiro || 'Sem descrição na fonte.'), h('p', 'g-sec', vivo ? 'Trabalho aberto · ' + ago(n.at) : (root.CerebroModelo.types[n.tipo] || 'Ponto do mapa')), viz.length ? h('h3', 'g-lab', 'Ligado a') : null, viz.length ? lista : null, mems.length ? h('h3', 'g-lab', 'Memórias que ele usa') : null, mems.length ? ml : null, cbFonte(n));
    if (!dlg.open) dlg.showModal();
  }

  // ---------- pintura e laços ----------
  let ultimoAtivo = '';
  function paintAtivo(forcar = false) {
    const key = S.view; if (!forcar && key === ultimoAtivo && key === 'mapa') return; ultimoAtivo = key;
    if (key === 'agora') { paintAgora(); loadObra(); }
    else if (key === 'fluxo') paintFluxo();
    else if (key === 'mapa') { if (S.cerebro) paintCerebro(); else { paintCerebro(); loadCerebro(); } }
  }
  function tick() {
    const snap = latest();
    if (snap && snap !== S.snap) { S.snap = snap; S.model = modelo(); paintPlacar(); if (anim()) anim().estado(snap); if (S.view === 'agora' || S.view === 'fluxo') paintAtivo(); }
    busca(); acoplar();
  }
  function teclas(ev) {
    const t = ev.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (ev.key === 'Escape' && els.dock.contains(t)) { t.blur(); els.dock.classList.remove('is-aberto'); return; }
    if (typing || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (/^[1-7]$/.test(ev.key) && !doc.querySelector('dialog[open]')) { ev.preventDefault(); show(TABS[Number(ev.key) - 1].key); }
    else if (ev.key === '/') { const ta = doc.getElementById('cx-texto'); if (ta) { ev.preventDefault(); ta.focus(); } }
  }
  function start() {
    if (!montar()) return;
    root.addEventListener('hashchange', fromHash); doc.addEventListener('keydown', teclas);
    let rz = null; root.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { S.cerebroPos = null; if (S.view === 'fluxo') paintFluxo(); if (S.view === 'mapa') paintCerebro(); }, 200); });
    fromHash();
    S.snap = latest(); S.model = modelo();
    loadAgora(); loadCards(); loadContas(); loadFluxo();
    if (root.PainelProjetoGlobal) root.PainelProjetoGlobal.ouvir(() => { paintPlacar(); if (S.view === 'agora') paintAgora(); });
    setInterval(tick, 2000); setInterval(loadAgora, 30000); setInterval(loadCards, 30000); setInterval(loadContas, 60000); setInterval(loadFluxo, 20000); setInterval(() => { if (S.view === 'mapa') loadCerebro(); }, 60000); setInterval(() => { if (S.view === 'agora') loadObra(); }, 30000);
    if (S.demo) setTimeout(demoRecompensa, 4000);
    marcarTema(); root.addEventListener('painel-tema', marcarTema);
    // fonte pixel do mapa: redesenha quando chegar
    doc.fonts && doc.fonts.load('16px Silkscreen').then(() => { if (S.view === 'mapa') desenharCerebro(); }).catch(() => {});
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => setTimeout(start, 0), { once: true }); else setTimeout(start, 0);
  root.PainelVistas = root.PainelGrade = Object.freeze({ _teste: Object.freeze({ linhasJuntadas, linhaNo }), show, primeiraMaiuscula, fluxoInfo: () => S.fluxoInfo || null, anda: () => ({ ...(S.model && S.model.conta || {}), n: contagens().anda, frase: 'Itens listados em Trabalhando agora', comprovado: true }), vpsSemLeitura, esperaProjeto: () => contagensProjeto(contagens()), estado: () => ({ tab: S.tab, view: S.view, contagens: contagens(), temFluxo: !!(S.model && S.model.fv), temCerebro: !!S.cerebro, temObra: !!S.obra }) });
})(window);
