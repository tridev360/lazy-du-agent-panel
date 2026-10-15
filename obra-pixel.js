'use strict';
// Somente ?obra=d|e|f. Mesma fonte de a|b|c (/api/obra), sem sprite e sem som.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.PainelObraPixel = api; api.start(root); }
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const VERSIONS = {
    d: { title: 'Painel de LED', note: '1 LED = 1 item. Enche de baixo para cima, com o que está no ar na base.' },
    e: { title: 'Mapa de fases', note: '1 quadrado = 1 item, na ordem da lista do lançamento, até os marcos.' },
    f: { title: 'Letreiro', note: '1 pixel = 1 item. A letra acende quando o item vai ao ar.' }
  };
  const CATS = { ar: 'no ar', vez: 'com você', obra: 'em obra', incerto: 'incerto', fila: 'na fila' };
  const ORDER = { ar: 0, vez: 1, obra: 2, incerto: 3, fila: 4 };
  const LADOS = { claude: 'Claude', codex: 'Codex', sem: 'sem dono' };
  const LADO_ORDER = { claude: 0, codex: 1, sem: 2 };
  // Letras de 6 linhas. "#" = pixel da letra.
  const GLYPHS = {
    L: ['#..', '#..', '#..', '#..', '#..', '###'],
    D: ['####.', '#...#', '#...#', '#...#', '#...#', '####.'],
    P: ['###.', '#..#', '#..#', '###.', '#...', '#...'],
    A: ['.##.', '#..#', '#..#', '####', '#..#', '#..#'],
    I: ['###', '.#.', '.#.', '.#.', '.#.', '###'],
    C: ['.###', '#...', '#...', '#...', '#...', '.###'],
    O: ['.##.', '#..#', '#..#', '#..#', '#..#', '.##.'],
    '?': ['.##.', '#..#', '...#', '..#.', '....', '..#.']
  };
  const INITIALS = { 'painel': 'LD', 'painel aberto': 'PA', 'projeto reservado': 'PR' };
  const fold = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const pad = n => String(n).padStart(2, '0');
  function hora(iso) { const d = new Date(iso); if (!iso || Number.isNaN(d.getTime())) return '?'; return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function variant(search) { const v = new URLSearchParams(search).get('obra'); return Object.hasOwn(VERSIONS, v) ? v : null; }
  // Regra literal da fonte: o primeiro passo que falta, ou o primeiro dono, e "ele".
  function suaVez(item) {
    if (/^ele\b/.test(fold(item.blocker).trim())) return 'o primeiro passo que falta é dele (coluna O que falta)';
    if (/^ele\b/.test(fold(item.owner).trim())) return 'o primeiro dono é ele (coluna Dono)';
    return '';
  }
  // Lado da obra so quando a etapa ou o dono citam a IA; sem citacao = sem dono.
  function lado(item) {
    const t = fold((item.stage || '') + ' ' + (item.owner || ''));
    const codex = /\bcodex\b/.test(t), claude = /\bclaude\b/.test(t);
    return codex && !claude ? 'codex' : claude && !codex ? 'claude' : 'sem';
  }
  function categorize(item) {
    if (item.state === 'live') return { cat: 'ar', lado: null, vez: '' };
    const vez = suaVez(item);
    if (vez) return { cat: 'vez', lado: null, vez };
    if (item.state === 'building' || item.state === 'ready') return { cat: 'obra', lado: lado(item), vez: '' };
    if (item.state === 'notStarted') return { cat: 'fila', lado: null, vez: '' };
    return { cat: 'incerto', lado: null, vez: '' };
  }
  function tally(project) {
    const out = { total: project.hasSource ? project.items.length : null, ar: 0, vez: 0, obra: 0, incerto: 0, fila: 0, claude: 0, codex: 0, sem: 0 };
    if (!project.hasSource) return out;
    for (const item of project.items) { const c = categorize(item); out[c.cat]++; if (c.lado) out[c.lado]++; }
    return out;
  }
  // Ordem de empilhar: no ar, com voce, obra (Claude, Codex, sem dono; pronto antes de em obra), incerto, fila.
  function stacked(items) {
    return items.map((item, index) => ({ item, index, ...categorize(item) })).sort((a, b) =>
      ORDER[a.cat] - ORDER[b.cat] || (a.lado && b.lado ? LADO_ORDER[a.lado] - LADO_ORDER[b.lado] : 0) ||
      (a.item.state === 'ready' ? 0 : 1) - (b.item.state === 'ready' ? 0 : 1) || a.index - b.index);
  }
  function delivered(before, after) {
    if (!before) return [];
    const previous = new Map(before.projects.flatMap(p => p.items.map(i => [p.id + ':' + i.id, i.state])));
    return after.projects.flatMap(p => p.items.filter(i => previous.has(p.id + ':' + i.id) && previous.get(p.id + ':' + i.id) !== 'live' && i.state === 'live').map(i => p.id + ':' + i.id));
  }
  function initials(name) {
    const key = fold(name).trim();
    if (INITIALS[key]) return INITIALS[key];
    const words = key.replace(/\(.*\)/, '').replace(/^projeto d[oa] /, '').split(/\s+/).filter(Boolean);
    return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2)).toUpperCase();
  }
  // Celulas da letra em ordem de traco: coluna por coluna, de baixo para cima.
  function signCells(text) {
    const letters = [...text].map(ch => GLYPHS[ch] || GLYPHS['?']);
    const rows = 6, cols = letters.reduce((sum, g) => sum + g[0].length, 0) + Math.max(0, letters.length - 1);
    const on = Array.from({ length: rows }, () => Array(cols).fill(false));
    let x = 0;
    for (const glyph of letters) { for (let r = 0; r < rows; r++) for (let c = 0; c < glyph[r].length; c++) if (glyph[r][c] === '#') on[r][x + c] = true; x += glyph[0].length + 1; }
    const order = [];
    for (let c = 0; c < cols; c++) for (let r = rows - 1; r >= 0; r--) if (on[r][c]) order.push([r, c]);
    return { rows, cols, on, order };
  }
  function scaleCells(base, scale) {
    if (scale === 1) return base;
    const rows = base.rows * scale, cols = base.cols * scale, on = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => base.on[Math.floor(r / scale)][Math.floor(c / scale)]));
    const order = [];
    for (let c = 0; c < cols; c++) for (let r = rows - 1; r >= 0; r--) if (on[r][c]) order.push([r, c]);
    return { rows, cols, on, order };
  }
  // So acento de palavra conhecida no rotulo da secao; o texto da fonte segue igual no hover.
  const ACCENTS = { impressao: 'impressão', medicao: 'medição', anuncio: 'anúncio', inicio: 'início', producao: 'produção' };
  function accent(text) { return String(text || '').replace(/[A-Za-z]+/g, w => { const a = ACCENTS[w.toLowerCase()]; return a ? (w[0] === w[0].toUpperCase() ? a[0].toUpperCase() + a.slice(1) : a) : w; }); }
  function shortTitle(title) {
    const s = String(title || 'Item sem título').split(/\s\(|:\s/)[0].trim();
    return s.length > 72 ? s.slice(0, 71) + '…' : s;
  }
  function sourceText(s) {
    if (!s) return '? sem fonte';
    return String(s.file || '?') + (s.line ? ' · linha ' + s.line : '') + ' · leitura ' + hora(s.readAt) + (s.old ? ' · LEITURA VELHA' : '');
  }
  function itemHover(entry) {
    const { item, cat } = entry;
    let state = item.stateLabel || '?';
    if (cat === 'vez') state += ' · com você: ' + entry.vez;
    if (cat === 'obra') state += ' · obra ' + LADOS[entry.lado] + (entry.lado === 'sem' ? ' (a fonte não cita Claude nem Codex)' : ' (a fonte cita ' + LADOS[entry.lado] + ')');
    return shortTitle(item.title) + '\nEtapa: ' + (item.stage || '?') + '\nEstado: ' + state + '\nFonte: ' + sourceText(item.source);
  }

  function create(doc, host, mode) {
    let data = null, selected = null, signature = '', rewards = new Set();
    const node = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = String(text); return n; };
    const band = node('section', 'opx'), top = node('div', 'opx-top'), titleBox = node('div', 'opx-title'), legend = node('ul', 'opx-legend');
    const notice = node('div', 'opx-notice'), body = node('div', 'opx-body'), detail = node('div', 'opx-detail'), foot = node('div', 'opx-foot');
    // data-ds-owned: o "?" daqui ja vem com a solucao no hover; o varredor de "?" do painel nao o esconde.
    band.dataset.variant = mode; band.dataset.dsOwned = 'obra'; band.setAttribute('aria-label', 'Progresso dos projetos');
    titleBox.append(node('span', 'opx-kicker', 'PROJETOS'), node('h3', '', VERSIONS[mode].title), node('div', 'opx-note', VERSIONS[mode].note));
    for (const [key, label, rule] of [
      ['ar', 'no ar', 'A etapa diz NO AR, inteira (prévia ou parte não contam).'],
      ['vez', 'com você', 'O primeiro passo que falta é seu: a coluna O que falta (ou Dono) começa com "ele".'],
      ['claude', 'obra Claude', 'Em obra ou pronto esperando, e a etapa ou o dono cita o Claude.'],
      ['codex', 'obra Codex', 'Em obra ou pronto esperando, e a etapa ou o dono cita o Codex.'],
      ['sem', 'obra sem dono', 'Em obra ou pronto esperando, e a fonte não cita Claude nem Codex.'],
      ['incerto', 'incerto', 'A etapa mistura parte no ar com parte pendente, ou não casa com nenhuma regra.'],
      ['fila', 'fila', 'Ainda não começou (falta desenho, só aprovado ou não existe).']]) {
      const li = node('li'); li.dataset.k = key; li.title = rule; li.append(node('i', 'opx-key'), node('span', '', label)); legend.append(li);
    }
    top.append(titleBox, legend); notice.setAttribute('role', 'status'); notice.hidden = true; detail.hidden = true;
    band.append(top, notice, body, detail, foot); host.append(band);

    const countLine = (t, p, cls = 'opx-mono') => {
      const line = node('span', cls);
      if (t.total === null) { line.classList.add('opx-sem-lista'); line.textContent = '? falta lista'; line.title = 'Como resolver: ' + (p?.resolution || 'criar uma lista de itens com Etapa hoje para este projeto.'); return line; }
      if (t.ar === 0 && t.incerto > 0) line.append(node('b', 'opx-n', '? de ' + t.total + ' no ar'), node('span', 'opx-sol', ' · ' + t.incerto + ' sem leitura certa · Solução: a sessão dona do item marca que ele está no ar só quando ele subiu inteiro'), node('span', 'opx-sep', ' · '));
      else line.append(node('b', 'opx-n', t.ar + '/' + t.total + ' no ar'), node('span', 'opx-sep', ' · '));
      line.append(t.vez ? node('b', 'opx-vezn', t.vez + ' com você') : node('span', 'opx-dim', 'nada com você'));
      return line;
    };
    const trava = p => {
      if (!p.hasSource) return null;
      const blocker = p.blockers?.find(i => i.state === 'ready') || p.blockers?.[0];
      if (!blocker) return null;
      const line = node('span', 'opx-trava', 'trava: ' + blocker.text); line.title = shortTitle(blocker.title) + '\ntrava: ' + blocker.text; return line;
    };
    const projectHover = p => p.name + '\n' + (p.hasSource ? (p.scope || '') + ' · ' + p.items.length + ' itens' : '? falta lista de itens\n' + (p.resolution || '')) + '\nFonte: ' + sourceText(p.source);
    function itemCell(cls, entry) {
      const cell = node('i', cls); cell.dataset.cat = entry.cat; if (entry.lado) cell.dataset.lado = entry.lado;
      cell.title = itemHover(entry); cell.setAttribute('aria-label', shortTitle(entry.item.title) + ': ' + CATS[entry.cat]);
      return cell;
    }
    function projectButton(p, cls) {
      const b = node('button', cls); b.type = 'button'; b.dataset.project = p.id; b.dataset.hasSource = String(p.hasSource);
      b.setAttribute('aria-expanded', String(selected === p.id)); b.addEventListener('click', () => toggle(p.id)); return b;
    }

    // d) Painel de LED: matriz de 6 linhas, 1 LED por item, empilhado de baixo para cima.
    function led(p, t) {
      const b = projectButton(p, 'opx-mod'), grid = node('span', 'opx-leds'), rows = 6;
      b.append(node('span', 'opx-name', p.name));
      if (!p.hasSource) {
        const q = GLYPHS['?']; grid.style.setProperty('--cols', '4'); grid.classList.add('opx-leds-sem');
        for (let r = 0; r < rows; r++) for (let c = 0; c < 4; c++) { const cell = node('i', 'opx-led'); if (q[r][c] === '#') cell.classList.add('opx-q'); grid.append(cell); }
        grid.title = projectHover(p);
      } else {
        const list = stacked(p.items), cols = Math.max(4, Math.ceil(list.length / rows));
        grid.style.setProperty('--cols', String(cols));
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const entry = list[(rows - 1 - r) * cols + c];
          if (!entry) { grid.append(node('i', 'opx-led')); continue; }
          const cell = itemCell('opx-led', entry);
          if (rewards.has(p.id + ':' + entry.item.id)) { cell.classList.add('opx-cai'); cell.style.setProperty('--cai', String(r)); }
          grid.append(cell);
        }
      }
      b.title = projectHover(p); b.append(grid, countLine(t, p));
      const lock = trava(p); if (lock) b.append(lock);
      return b;
    }

    // e) Mapa de fases: trilha na ordem da lista, marcos M1 e M2 da fonte.
    function castle(label, open, title) {
      const box = node('span', 'opx-marco'), art = node('span', 'opx-castelo');
      for (const row of ['#.#.#.#', '#######', '#######', '###.###', '##...##', '##...##']) for (const ch of row) art.append(node('i', ch === '#' ? 'on' : ''));
      box.dataset.limpo = String(!open); box.title = title; box.append(art, node('small', '', label)); return box;
    }
    function trail(p, t) {
      const row = node('div', 'opx-trow'), name = projectButton(p, 'opx-tname');
      name.append(node('span', 'opx-name', p.name)); name.title = projectHover(p); row.append(name);
      if (!p.hasSource) {
        row.classList.add('opx-trow-sem'); const line = node('span', 'opx-tsem'); line.title = projectHover(p);
        line.append(node('span', 'opx-tsem-k', '? falta lista'), node('i', 'opx-tsem-line')); row.append(line); return row;
      }
      const marcos = data.marcos, m1 = marcos?.m1, m2 = marcos?.m2, track = node('div', 'opx-track'), scroller = node('div', 'opx-tscroll');
      const groups = []; for (const [index, item] of p.items.entries()) { const key = item.section || ''; if (!groups.length || groups[groups.length - 1].key !== key) groups.push({ key, entries: [] }); groups[groups.length - 1].entries.push({ item, index, ...categorize(item) }); }
      let first = true;
      for (const group of groups) {
        const fase = node('div', 'opx-fase'), nodes = node('div', 'opx-fase-nos');
        for (const entry of group.entries) {
          const seg = node('i', 'opx-seg'); if (entry.cat === 'ar') seg.dataset.ar = '1'; if (!first) nodes.append(seg); first = false;
          const cell = itemCell('opx-no', entry); if (entry.cat === 'vez') cell.textContent = '!'; if (entry.cat === 'incerto') cell.textContent = '?';
          if (rewards.has(p.id + ':' + entry.item.id)) { cell.classList.add('opx-enche'); for (let k = 0; k < 4; k++) cell.append(node('i', 'opx-faisca')); }
          nodes.append(cell);
        }
        const label = accent(String(group.key).split(/\s\(/)[0]) || 'Itens'; fase.title = group.key || 'Itens sem seção';
        fase.append(nodes, node('span', 'opx-fase-k', label)); track.append(fase);
      }
      const nucleo = m1 && m1.itens === p.items.length ? p.items : null;
      const faltam = nucleo ? nucleo.filter(item => item.state !== 'live').length : null;
      const proof = marcos ? '\nFonte: ' + sourceText(marcos.source) : '\nFonte: ? a lista não marca o núcleo';
      const m1Box = castle(faltam === 0 ? 'M1 LIMPO' : 'M1 núcleo' + (m1?.data ? ' ' + m1.data : ''), faltam !== 0,
        'Marco M1: núcleo' + (m1?.itens ? ' de ' + m1.itens + ' itens' : ' (? itens)') + (m1?.data ? ', data alvo ' + m1.data + ' (estimativa da fonte)' : ', sem data na fonte') + (nucleo ? '' : '\n? o número de itens do núcleo não bate com a lista') + proof);
      if (faltam === 0 && [...rewards].some(key => key.startsWith(p.id + ':'))) m1Box.classList.add('opx-limpou');
      track.append(node('i', 'opx-seg'), m1Box);
      const rest = node('span', 'opx-resto'); rest.title = 'O que vem depois do núcleo não tem lista de itens com Etapa hoje na fonte.' + proof; rest.append(node('small', '', '? resto sem lista'));
      track.append(rest, castle('M2 tudo' + (m2?.data ? ' ' + m2.data : ''), true, 'Marco M2: tudo o que você pediu até hoje' + (m2?.data ? ', data alvo ' + m2.data + ' (estimativa da fonte)' : ', sem data na fonte') + '\n? itens sem lista' + proof));
      scroller.append(track);
      const under = node('span', 'opx-m1', faltam === 0 ? 'M1 LIMPO · núcleo' + (m1?.data ? ' ' + m1.data : '') : 'M1 núcleo' + (m1?.data ? ' ' + m1.data : '') + ': ' + (faltam === null ? 'faltam ?' : 'faltam ' + faltam));
      under.title = 'Itens do núcleo que ainda não estão no ar.' + proof;
      const side = node('div', 'opx-tside'); side.append(countLine(t, p)); const lock = trava(p); if (lock) side.append(lock);
      const mid = node('div', 'opx-tmid'); mid.append(scroller, under);
      row.append(mid, side); return row;
    }

    // f) Letreiro: iniciais em pixel, 1 pixel = 1 item; contorno sempre visivel.
    function sign(p, t) {
      const b = projectButton(p, 'opx-sign'), grid = node('span', 'opx-sgrid'), text = initials(p.name), base = signCells(text);
      const list = p.hasSource ? stacked(p.items) : [], scale = Math.max(1, Math.ceil(Math.sqrt(list.length / base.order.length)));
      const cells = scaleCells(base, scale), slot = new Map(cells.order.map(([r, c], k) => [r + ':' + c, k]));
      grid.style.setProperty('--cols', String(cells.cols)); grid.style.setProperty('--px', (scale === 1 ? 16 : Math.max(5, Math.floor(16 / scale))) + 'px');
      const full = p.hasSource && t.total > 0 && t.ar === t.total;
      for (let r = 0; r < cells.rows; r++) for (let c = 0; c < cells.cols; c++) {
        if (!cells.on[r][c]) { grid.append(node('i', 'opx-pix opx-vazio')); continue; }
        const entry = list[slot.get(r + ':' + c)];
        if (!entry) { const cell = node('i', 'opx-pix opx-contorno'); cell.title = p.hasSource ? 'Pixel sem item' : projectHover(p); grid.append(cell); continue; }
        const cell = itemCell('opx-pix', entry); if (entry.cat === 'incerto') cell.textContent = '?';
        if (rewards.has(p.id + ':' + entry.item.id)) cell.classList.add('opx-acende');
        grid.append(cell);
      }
      if (full) { b.classList.add('opx-sign-cheio'); if ([...rewards].some(key => key.startsWith(p.id + ':'))) b.classList.add('opx-varre'); }
      grid.setAttribute('aria-label', text + ': ' + (p.hasSource ? t.ar + ' de ' + t.total + ' no ar' : 'falta lista'));
      b.title = projectHover(p); b.append(grid, node('span', 'opx-name', p.name), countLine(t, p));
      const lock = trava(p); if (lock) b.append(lock);
      return b;
    }

    function toggle(id) { selected = selected === id ? null : id; paint(); }
    function renderDetail() {
      detail.replaceChildren();
      const p = selected && data?.projects.find(x => x.id === selected);
      if (!p) { detail.hidden = true; selected = null; return; }
      detail.hidden = false;
      const head = node('div', 'opx-dhead'), close = node('button', 'opx-close', 'Fechar'); close.type = 'button'; close.addEventListener('click', () => toggle(p.id));
      head.append(node('h4', '', p.name), close); detail.append(head);
      if (!p.hasSource) { detail.append(node('div', 'opx-dreason', '? falta lista de itens'), node('div', 'opx-dfix', p.resolution || '')); return; }
      const t = tally(p), sum = node('div', 'opx-dsum');
      sum.append(countLine(t, p), node('span', 'opx-dim', ' · ' + t.obra + ' em obra · ' + t.incerto + ' incertos · ' + t.fila + ' na fila · ' + (p.scope || '')));
      detail.append(sum);
      const list = node('ol', 'opx-list');
      for (const item of p.items) {
        const entry = { item, ...categorize(item) }, li = node('li'); li.dataset.cat = entry.cat; li.title = itemHover(entry);
        const chip = node('span', 'opx-chip', entry.cat === 'obra' ? 'obra ' + LADOS[entry.lado] : CATS[entry.cat]); chip.dataset.cat = entry.cat; if (entry.lado) chip.dataset.lado = entry.lado;
        li.append(chip, node('strong', '', shortTitle(item.title)), node('span', 'opx-etapa', item.stage || '?'), node('small', '', 'linha ' + (item.source?.line || '?')));
        list.append(li);
      }
      detail.append(list);
    }
    // A recompensa so entra na pintura que observou a mudanca; update limpa o conjunto logo depois.
    function paint() {
      body.replaceChildren();
      if (!data) return;
      const wrap = node('div', mode === 'd' ? 'opx-mods' : mode === 'e' ? 'opx-trilhas' : 'opx-signs');
      for (const p of data.projects) { const t = tally(p); wrap.append(mode === 'd' ? led(p, t) : mode === 'e' ? trail(p, t) : sign(p, t)); }
      body.append(wrap);
      const old = data.projects.some(p => p.old);
      foot.replaceChildren(node('span', '', 'Retrato · leitura ' + hora(data.readAt)));
      if (old) foot.append(node('b', 'opx-old', ' LEITURA VELHA'));
      foot.append(node('span', '', ' · passe o mouse num quadrado para ver nome, etapa e fonte; clique no projeto para a lista'));
      // Som: entraria aqui, quando rewards tem item (sem som novo nesta rodada).
      renderDetail();
    }
    return {
      band,
      update(next) {
        rewards = new Set(delivered(data, next)); data = next; notice.hidden = true;
        const sig = JSON.stringify(next, (key, value) => key === 'ageSeconds' ? undefined : value);
        if (sig !== signature) { const focused = doc.activeElement?.dataset?.project; signature = sig; paint(); rewards = new Set(); if (focused) body.querySelector?.('[data-project="' + focused + '"]')?.focus?.(); }
      },
      error() { notice.hidden = false; notice.textContent = data ? 'A atualização falhou. A última leitura mantém a hora dela.' : '? Não foi possível ler os projetos.'; },
      destroy() { band.remove(); }
    };
  }

  function start(root) {
    const mode = variant(root.location.search); if (!mode) return;
    const doc = root.document; let ui = null, holder = null, busy = false, controller = null, stopped = false, timer = null, last = null;
    function mount() {
      if (ui && holder && !holder.isConnected) { ui.destroy(); ui = null; }
      if (ui) return;
      const flow = doc.querySelector('.pe-flow'), map = flow?.querySelector('.pe-flow-map'); if (!flow || !map) return;
      holder = doc.createElement('div'); holder.className = 'opx-holder'; map.before(holder); ui = create(doc, holder, mode); if (last) ui.update(last);
    }
    function visible() { return !stopped && !doc.hidden && doc.documentElement.dataset.painelTab === 'team' && ui && !doc.querySelector('.pe-flow')?.hidden; }
    async function read() {
      mount(); const showing = visible(); if (ui) ui.band.dataset.paused = String(!showing); if (!showing || busy) return;
      busy = true; controller = new root.AbortController(); const timeout = root.setTimeout(() => controller.abort(), 8000);
      try {
        const response = await root.fetch('/api/obra', { cache: 'no-store', redirect: 'error', signal: controller.signal }), json = await response.json();
        if (!response.ok || json.ok !== true || !Array.isArray(json.data?.projects)) throw Error('read');
        if (!stopped) { last = json.data; ui.update(last); }
      } catch { if (!stopped) ui?.error(); } finally { root.clearTimeout(timeout); busy = false; controller = null; }
    }
    let wasVisible = false;
    const mutation = new root.MutationObserver(() => { mount(); const showing = visible(); if (ui) ui.band.dataset.paused = String(!showing); if (showing && !wasVisible) read(); wasVisible = showing; });
    mutation.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-painel-tab', 'hidden'] });
    const refresh = () => read(); doc.addEventListener('visibilitychange', refresh); doc.addEventListener('painel:tab-change', refresh);
    timer = root.setInterval(read, 15000); mount(); wasVisible = visible(); read();
    root.addEventListener('pagehide', () => { stopped = true; mutation.disconnect(); root.clearInterval(timer); controller?.abort(); doc.removeEventListener('visibilitychange', refresh); doc.removeEventListener('painel:tab-change', refresh); ui?.destroy(); }, { once: true });
  }
  return { VERSIONS, CATS, GLYPHS, variant, suaVez, lado, categorize, tally, stacked, delivered, initials, signCells, create, start };
});
