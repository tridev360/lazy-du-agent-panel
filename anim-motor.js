/* anim-motor.js: motor comum das animacoes do painel novo. NAO desenha estilo: cada tema (anim-grade.js,
   anim-livro.js, anim-folha.js) registra o seu jeito com PainelAnim.tema(nome, impl) e o motor chama o tema ligado.
   O motor so faz 4 coisas:
   1. acha os EVENTOS comparando a leitura nova com a anterior (so o que a fonte registra; nada inventado):
      mensagem (comando, duvida, resposta), acao (tipo do PaAnim), acorda, dorme, ajudante-nasce, ajudante-termina,
      card-novo, card-respondido, subiu, gate-verde, erro;
   2. anda as particulas continuas dos fios (as do Fluxo antigo: rapidas no fio que falou ha menos de 15 min, 1 lenta nos outros);
   3. toca os sprites 8x8 de cada tipo de acao nas caixas (1 laco so, 125 ms por passo);
   4. a DEMO (#...&demo=eventos): toca cada animacao em sequencia, so visual, sem gravar nada.
   Movimento off (html[data-motion=off]) para tudo; aba escondida pausa; som: nenhum (so anotado onde entraria). */
(function (root) {
  'use strict';
  const doc = root.document, html = doc.documentElement;
  const TEMAS = {};
  const motionOn = () => html.dataset.motion !== 'off';
  const nomeTema = () => TEMAS[html.dataset.theme] ? html.dataset.theme : 'grade';
  const tema = () => TEMAS[nomeTema()] || null;
  const css = name => getComputedStyle(html).getPropertyValue(name).trim();
  const hash = str => { let x = 0x811c9dc5; for (const ch of String(str)) { x ^= ch.codePointAt(0); x = Math.imul(x, 0x01000193) >>> 0; } return x >>> 0; };

  // ---------- sprites 8x8 por tipo de acao (mesma forma nos 3 temas; o tema escolhe o pixel) ----------
  const G = rows => rows.map(r => r.padEnd(8, '.'));
  const SPRITES = {
    escrevendo: { ms: 160, frames: [G(['', '##', '', '', '', '', '', '']), G(['', '####', '', '', '', '', '', '']), G(['', '######', '', '##', '', '', '', '']), G(['', '######', '', '####', '', '', '', '']), G(['', '######', '', '######', '', '##', '', '']), G(['', '######', '', '######', '', '####', '', ''])] },
    lendo: { ms: 180, frames: [G(['.##', '#..#', '#..#', '.##', '....#', '', '########', '']), G(['..##', '.#..#', '.#..#', '..##', '.....#', '', '########', '']), G(['...##', '..#..#', '..#..#', '...##', '......#', '', '########', '']), G(['....##', '...#..#', '...#..#', '....##', '.......#', '', '########', ''])] },
    executando: { ms: 260, frames: [G(['', '#', '.#', '..#', '.#', '#...###', '', '']), G(['', '#', '.#', '..#', '.#', '#', '', ''])] },
    testando: { ms: 170, frames: [G(['', '..#..#', '..#..#', '..#.##', '..####', '..####', '...##', '']), G(['', '..#..#', '..#.##', '..#..#', '..####', '..####', '...##', '']), G(['', '..####', '..#..#', '..#..#', '..####', '..####', '...##', '']), G(['....#', '..#..#', '..#..#', '..#..#', '..####', '..####', '...##', ''])] },
    revisando: { ms: 220, frames: [G(['', '..####', '.#....#', '#..##..#', '.#....#', '..####', '', '']), G(['', '..####', '.#....#', '#....###', '.#....#', '..####', '', '']), G(['', '..####', '.#....#', '#..##..#', '.#....#', '..####', '', '']), G(['', '', '', '########', '', '', '', ''])] },
    subindo: { ms: 140, frames: [G(['', '', '', '...##', '..####', '.######', '...##', '########']), G(['', '', '...##', '..####', '.######', '...##', '...##', '########']), G(['', '...##', '..####', '.######', '...##', '...##', '', '########']), G(['...##', '..####', '.######', '...##', '...##', '', '', '########']), G(['..####', '.######', '...##', '...##', '', '', '', '########'])] },
    conferindo: { ms: 260, frames: [G(['...##', '..####', '.######', '...##', '...##', '...##', '', '########']), G(['', '.......#', '......##', '#....##', '##..##', '.####', '..##', '########'])] },
    ajudante: { ms: 200, frames: [G(['', '', '', '...##', '...##', '', '', '']), G(['', '', '..#', '...##', '...###', '', '', '']), G(['', '.#', '', '...##', '...##', '', '.....#', '']), G(['#', '', '', '...##', '...##', '', '', '......#'])] },
    esperaAjudante: { ms: 300, frames: [G(['.######', '.#####', '..###', '...#', '..#.#', '.#...#', '.######', '']), G(['.######', '.#...#', '..###', '...#', '..###', '.#####', '.######', '']), G(['.######', '.#...#', '..#.#', '...#', '..###', '.#####', '.######', ''])] },
    falando: { ms: 220, frames: [G(['.######', '#......#', '#.#....#', '#......#', '.######', '..#', '.#', '']), G(['.######', '#......#', '#.#.#..#', '#......#', '.######', '..#', '.#', '']), G(['.######', '#......#', '#.#.#.##', '#......#', '.######', '..#', '.#', ''])] },
    esperando: { ms: 240, frames: [G(['', '', '...#', '..###', '...#', '', '', '']), G(['', '...#', '..###', '.#####', '..###', '...#', '', '']), G(['...#', '..###', '.#####', '#######', '.#####', '..###', '...#', '']), G(['...#', '..#.#', '.#...#', '#.....#', '.#...#', '..#.#', '...#', ''])] },
    terminou: { ms: 130, uma: true, frames: [G(['', '', '', '...##', '...##', '', '', '']), G(['', '', '..####', '..#..#', '..#..#', '..####', '', '']), G(['', '.......#', '......##', '#....##', '##..##', '.####', '..##', '']), G(['#......#', '.......#', '......##', '#....##', '##..##', '.####', '..##', '#'])] },
    generico: { ms: 150, frames: [G(['', '...##', '', '.#....#', '.#....#', '', '...##', '']), G(['', '...##', '', '......#', '.#....#', '', '...##', '']), G(['', '...##', '', '.#....#', '.#....#', '', '', '']), G(['', '...##', '', '.#....#', '......#', '', '...##', '']), G(['', '', '', '.#....#', '.#....#', '', '...##', ''])] },
    aguardando: { ms: 500, frames: [G(['', '', '', '', '##.##.##', '', '', '']), G(['', '', '', '', '##.##', '', '', ''])] },
    pausa: { ms: 500, frames: [G(['', '', '..#.#', '..#.#', '..#.#', '..#.#', '', ''])] },
    parado: { ms: 600, frames: [G(['', '', '', '', '#######', '', '', ''])] },
    dormindo: { ms: 330, frames: [G(['', '', '', '', '', '....###', '.....#', '....###']), G(['', '', '..###', '...#', '..###', '', '', '']), G(['###', '.#', '###', '', '', '', '', ''])] },
    'sem-leitura': { ms: 400, frames: [G(['..####', '.#....#', '.....#', '....#', '...#', '', '...#', '']), G(['', '', '', '', '', '', '', ''])] }
  };
  // cor do sprite: o tipo manda (rosa = espera voce; verde = terminou/subiu; ambar = sem leitura); senao a cor do lado
  function corSprite(acao, lado) {
    if (acao === 'esperando') return css('--g-rosa');
    if (acao === 'terminou' || acao === 'subindo' || acao === 'conferindo') return css('--g-anda');
    if (acao === 'sem-leitura') return css('--g-trava');
    if (acao === 'dormindo' || acao === 'parado' || acao === 'aguardando' || acao === 'pausa') return css('--g-tx3');
    return lado === 'codex' ? css('--g-codex') : lado === 'voce' ? css('--g-rosa') : css('--g-claude');
  }

  // ---------- estado anterior (para achar eventos) ----------
  const antes = { fios: null, nos: null, cards: null, noAr: null, gates: null };
  let F = null;                 // fluxo desenhado agora: {mapa, camada, W, H, fios, nos}
  const fx = [];                // efeitos de 1 vez desenhados no canvas: {t0, dur, draw(ctx, p, t), fim}
  let viajantes = [];           // particulas continuas dos fios
  const etiquetas = [];         // F2: etiquetas de mensagem no ar agora (empilham)
  let raf = 0, spriteTimer = 0, demo = null;
  const ouvintes = [];

  function emitir(ev) {
    for (const fn of ouvintes) { try { fn(ev); } catch { /* ouvinte quebrado nao para o motor */ } }
    if (!motionOn()) return;
    const t = tema(); if (!t || typeof t.evento !== 'function') return;
    try { t.evento(ev, kit); } catch (e) { console.warn('anim evento', ev.tipo, e); }
    // som: entraria aqui (desligado; o mudo do painel continua valendo)
    acordarLaco();
  }

  // ---------- geometria dos fios ----------
  function medir(pts) { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, L, total: L[L.length - 1] }; }
  function pontoEm(path, d) {
    const { pts, L } = path; if (d <= 0) return pts[0]; if (d >= path.total) return pts[pts.length - 1];
    let i = 1; while (i < L.length && L[i] < d) i++;
    const seg = L[i] - L[i - 1] || 1, k = (d - L[i - 1]) / seg;
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
  }
  const reverso = path => medir(path.pts.slice().reverse());

  // ---------- kit que o tema usa ----------
  const kit = {
    get F() { return F; }, css, hash, motionOn, medir, pontoEm, SPRITES, corSprite,
    corLado: lado => lado === 'codex' ? css('--g-codex') : lado === 'voce' ? css('--g-rosa') : lado === 'claude' ? css('--g-claude') : css('--g-tx'),
    no: id => F && F.nos.find(n => n.id === id) || null,
    voce: () => F && F.nos.find(n => n.id === 'voce') || null,
    fio: key => F && F.fios.find(f => f.key === key) || null,
    // centro de um elemento em coordenadas do mapa
    centro(el, dx = 0, dy = 0) { if (!F || !el) return [0, 0]; const a = F.mapa.getBoundingClientRect(), r = el.getBoundingClientRect(); return [Math.round(r.left - a.left + r.width / 2 + dx), Math.round(r.top - a.top + r.height / 2 + dy)]; },
    caixa(el) { if (!F || !el) return null; const a = F.mapa.getBoundingClientRect(), r = el.getBoundingClientRect(); return { x: Math.round(r.left - a.left), y: Math.round(r.top - a.top), w: Math.round(r.width), h: Math.round(r.height) }; },
    // caminho do fio no sentido de quem manda
    caminho(fio, de) { const p = medir(fio.pts); return de === fio.de ? p : reverso(p); },
    // efeito de 1 vez no canvas
    efeito(dur, draw, fim, atraso = 0) { if (!motionOn()) { if (fim) fim(); return; } fx.push({ t0: performance.now() + atraso, dur, draw, fim }); acordarLaco(); },
    // classe de 1 vez num elemento (o tema faz o keyframe no seu css)
    marcar(el, cls, ms) { if (!el || !motionOn()) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); clearTimeout(el['_t_' + cls]); el['_t_' + cls] = setTimeout(() => el.classList.remove(cls), ms); },
    // o fio que falou acende e esfria em degraus (o tema da a cor de cada data-idade)
    esfriar(fio, degraus = ['quente', 'morno', 'recente'], passo = 450) {
      if (!fio || !fio.el) return; const el = fio.el, original = el.dataset.idadeBase || el.dataset.idade; el.dataset.idadeBase = original;
      degraus.forEach((d, i) => setTimeout(() => { if (el.isConnected) el.dataset.idade = d; }, i * passo));
      setTimeout(() => { if (el.isConnected) { el.dataset.idade = original; delete el.dataset.idadeBase; } }, degraus.length * passo);
    },
    // F2: etiqueta que viaja com a mensagem (tipo + resumo da fonte + DE -> PARA), na cor de quem manda; as que estao no ar
    // ao mesmo tempo empilham (nunca se cobrem). Devolve {el, mover(x, y), fim()}
    etiqueta(linhas, lado, ms) {
      if (!F || !motionOn()) return null; const el = doc.createElement('span'); el.className = 'g-fx-tag'; el.dataset.lado = lado || '';
      for (const [i, t] of linhas.filter(Boolean).entries()) { const s = doc.createElement('span'); s.className = i === 0 ? 'g-fx-tag-t' : 'g-fx-tag-s'; s.textContent = t; el.append(s); }
      F.mapa.append(el); const slot = etiquetas.length; etiquetas.push(el);
      const mover = (x, y) => { const w = el.offsetWidth, hh = el.offsetHeight; el.style.left = Math.round(Math.max(0, Math.min(F.W - w, x + 10))) + 'px'; el.style.top = Math.round(Math.max(0, y - hh - 10 - slot * (hh + 4))) + 'px'; };
      const fim = () => { el.remove(); const i = etiquetas.indexOf(el); if (i >= 0) etiquetas.splice(i, 1); };
      setTimeout(fim, ms || 2600); return { el, mover, fim };
    },
    rotulo(texto, x, y, cls, ms) { if (!F || !motionOn()) return; const r = doc.createElement('span'); r.className = 'g-fx-rot ' + (cls || ''); r.textContent = texto; r.style.left = x + 'px'; r.style.top = y + 'px'; F.mapa.append(r); setTimeout(() => r.remove(), ms || 1200); return r; }
  };

  // ---------- canvas da camada de animacao ----------
  let ctx = null, dpr = 1;
  function prepararCanvas() {
    if (!F || !F.camada) return; dpr = root.devicePixelRatio || 1;
    F.camada.width = Math.round(F.W * dpr); F.camada.height = Math.round(F.H * dpr);
    F.camada.style.width = F.W + 'px'; F.camada.style.height = F.H + 'px';
    ctx = F.camada.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
  }
  // particulas continuas (inventario A1 e A2): fio que falou ha menos de 15 min = 2 a 5 rapidas; os outros = 1 lenta
  function montarViajantes() {
    viajantes = [];
    if (!F) return;
    for (const fio of F.fios) for (const dirc of [fio.ida, fio.volta]) {
      if (!dirc) continue;
      const de = dirc === fio.ida ? fio.de : fio.para, path = kit.caminho(fio, de); if (path.total < 24) continue;
      const n = dirc.recent ? Math.min(5, 2 + Math.floor(Math.log2(1 + dirc.count))) : 1, vel = dirc.recent ? 120 : 34;
      const off = (hash(dirc.key) % 1000) / 1000, dur = Math.max(1200, path.total / vel * 1000);
      for (let i = 0; i < n; i++) viajantes.push({ fio, path, dur, fase: (off + i / n) % 1, lento: !dirc.recent, lado: dirc.sender, kind: dirc.kind });
    }
  }
  function visivel() { return F && F.mapa.isConnected && F.mapa.offsetParent !== null && !doc.hidden; }
  function acordarLaco() { if (!raf && motionOn() && visivel()) raf = root.requestAnimationFrame(quadro); }
  function quadro(now) {
    raf = 0; if (!ctx || !F) return;
    ctx.clearRect(0, 0, F.W, F.H);
    if (!motionOn() || !visivel()) return;
    const t = tema(), sel = F.fios.find(f => f.el && f.el.dataset.sel === '1');
    if (t && typeof t.viajante === 'function') for (const v of viajantes) {
      const p = ((now / v.dur) + v.fase) % 1;
      try { t.viajante(ctx, v, p, now, kit, sel ? sel === v.fio : null); } catch { /* um ponto quebrado nao para os outros */ }
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const e = fx[i], p = (now - e.t0) / e.dur; if (p < 0) continue;
      if (p >= 1) { fx.splice(i, 1); if (e.fim) try { e.fim(); } catch { /* segue */ } continue; }
      try { e.draw(ctx, p, now); } catch { fx.splice(i, 1); }
    }
    if (viajantes.length || fx.length) raf = root.requestAnimationFrame(quadro);
  }
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) acordarLaco(); });

  // ---------- sprites nas caixas ----------
  function sprites() {
    if (!F) return; const t = tema(); const cfg = (t && t.sprite) || { pixel: 'quadrado', escala: 2 };
    for (const n of F.nos) {
      const slot = n.el.querySelector('.g-acao'); if (!slot) continue;
      const acao = n.el.dataset.acao; if (!acao || !SPRITES[acao]) { slot.replaceChildren(); continue; }
      let c = slot.querySelector('canvas'); const s = cfg.escala || 2;
      if (!c) { c = doc.createElement('canvas'); slot.replaceChildren(c); }
      c.width = 8 * s * dpr; c.height = 8 * s * dpr; c.style.width = 8 * s + 'px'; c.style.height = 8 * s + 'px';
      c._acao = acao; c._lado = n.lado; c._t0 = performance.now(); c.title = (root.PaAnim && root.PaAnim.ROTULOS[acao] ? root.PaAnim.ROTULOS[acao].pt : acao);
      pintarSprite(c, 0);
    }
    if (!spriteTimer) spriteTimer = setInterval(passoSprites, 125);
  }
  function pintarSprite(c, now) {
    const spr = SPRITES[c._acao]; if (!spr) return; const t = tema(); const cfg = (t && t.sprite) || { pixel: 'quadrado', escala: 2 };
    let k = 0; if (motionOn() && now) { const i = Math.floor((now - c._t0) / spr.ms); k = spr.uma ? Math.min(spr.frames.length - 1, i) : i % spr.frames.length; } else if (spr.uma) k = spr.frames.length - 1; else k = Math.min(1, spr.frames.length - 1);
    if (c._k === k && c._tema === nomeTema()) return; c._k = k; c._tema = nomeTema();
    const x = c.getContext('2d'), s = (cfg.escala || 2) * dpr; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height);
    const cor = corSprite(c._acao, c._lado), frame = spr.frames[k];
    if (t && typeof t.pixelSprite === 'function') { t.pixelSprite(x, frame, s, cor, kit); return; }
    x.fillStyle = cor; frame.forEach((row, y) => [...row].forEach((ch, xx) => { if (ch === '#') x.fillRect(xx * s, y * s, s, s); }));
  }
  function passoSprites() {
    if (!F || !F.mapa.isConnected) { clearInterval(spriteTimer); spriteTimer = 0; return; }
    if (doc.hidden) return; const now = performance.now();
    for (const c of F.mapa.querySelectorAll('.g-acao canvas')) pintarSprite(c, now);
  }

  // ---------- eventos: compara com a leitura anterior ----------
  function diffFluxo(info) {
    const fios = new Map(), nos = new Map();
    for (const f of info.fios) for (const d of [f.ida, f.volta]) if (d) fios.set(d.key, { f, d, de: d === f.ida ? f.de : f.para, para: d === f.ida ? f.para : f.de });
    for (const n of info.nos) nos.set(n.id, n);
    const evs = [];
    if (antes.fios) for (const [k, cur] of fios) {
      const old = antes.fios.get(k);
      if (old ? cur.d.count > old.count || (cur.d.last && cur.d.last !== old.last) : cur.d.recent) evs.push({ tipo: 'mensagem', kind: cur.d.kind, de: cur.de, para: cur.para, lado: cur.d.sender, fio: cur.f, resumo: cur.d.resumo || null, deNome: cur.f.deNome || null, paraNome: cur.f.paraNome || null });
    }
    if (antes.nos) for (const [id, n] of nos) {
      const o = antes.nos.get(id); if (!o) continue;
      if (o.estado === 'dormindo' && n.estado === 'trabalhando') evs.push({ tipo: 'acorda', no: n });
      else if (o.estado !== 'dormindo' && n.estado === 'dormindo') evs.push({ tipo: 'dorme', no: n });
      if (n.estado === 'sem-leitura' && o.estado !== 'sem-leitura') evs.push({ tipo: 'erro', no: n });
      if (n.acao && n.acao !== o.acao && !['dormindo', 'sem-leitura'].includes(n.acao)) evs.push({ tipo: 'acao', no: n, acao: n.acao, antes: o.acao });
      if (Number.isFinite(n.ajTotal) && Number.isFinite(o.ajTotal) && n.ajTotal > o.ajTotal) evs.push({ tipo: 'ajudante-nasce', no: n, n: n.ajTotal - o.ajTotal });
      if (Number.isFinite(n.ajAgora) && Number.isFinite(o.ajAgora) && n.ajAgora < o.ajAgora) evs.push({ tipo: 'ajudante-termina', no: n, n: o.ajAgora - n.ajAgora });
    }
    antes.fios = new Map([...fios].map(([k, v]) => [k, { count: v.d.count, last: v.d.last }]));
    antes.nos = new Map([...nos].map(([k, v]) => [k, { estado: v.estado, acao: v.acao, ajTotal: v.ajTotal, ajAgora: v.ajAgora }]));
    evs.forEach((ev, i) => setTimeout(() => emitir(ev), 150 + i * 260));
  }
  function agora(j) {
    const pend = new Set(((j && j.cards && j.cards.pendentes) || []).map(c => c.arquivo).filter(Boolean));
    const noAr = (j && j.agora && Array.isArray(j.agora.noAr)) ? j.agora.noAr.map(String) : null;
    if (antes.cards) { for (const id of pend) if (!antes.cards.has(id)) emitir({ tipo: 'card-novo', id }); for (const id of antes.cards) if (!pend.has(id)) emitir({ tipo: 'card-respondido', id }); }
    if (antes.noAr && noAr) for (const linha of noAr) if (!antes.noAr.includes(linha)) emitir({ tipo: 'subiu', texto: linha });
    antes.cards = pend; if (noAr) antes.noAr = noAr;
  }
  function estado(snap) {
    const ramos = snap && Array.isArray(snap.readyBranches) ? snap.readyBranches.map(r => r && (r.branch || r.title)).filter(Boolean) : null;
    if (ramos && antes.gates) for (const r of ramos) if (!antes.gates.includes(r)) emitir({ tipo: 'gate-verde', ramo: r });
    if (ramos) antes.gates = ramos;
  }

  // ---------- fluxo desenhado (chamado pelo vistas.js) ----------
  function fluxo(info) {
    F = info; prepararCanvas(); montarViajantes();
    if (demo) demo.reaplicar();
    sprites(); diffFluxo(info); acordarLaco();
    const t = tema(); if (t && typeof t.desenhou === 'function') try { t.desenhou(kit); } catch { /* segue */ }
    if (/(?:^#|&)demo=eventos\b/.test(root.location.hash || '') && !demo) iniciarDemo();
  }
  new MutationObserver(() => { if (F) { sprites(); acordarLaco(); } }).observe(html, { attributes: true, attributeFilter: ['data-motion', 'data-theme'] });

  // ---------- DEMO: toca cada animacao em sequencia (so visual, nada gravado) ----------
  function iniciarDemo() {
    const pick = () => {
      const nos = F ? F.nos : [], col = (lado, coord) => nos.filter(n => n.lado === lado && (coord ? /coordenador/i.test(n.el.textContent) : !/coordenador/i.test(n.el.textContent)));
      const A = col('claude', false)[0] || nos[0], B = col('claude', false)[1] || A, J = col('claude', true)[0] || A, V = kit.voce() || A, X = col('codex', true)[0] || col('codex', false)[0] || J;
      const fioEntre = (a, b) => F.fios.find(f => (f.de === a.id && f.para === b.id) || (f.de === b.id && f.para === a.id)) || null;
      return { A, B, J, V, X, fioEntre };
    };
    const override = new Map();
    const setAcao = (n, acao) => { if (!n) return; override.set(n.id, acao); n.el.dataset.acao = acao; sprites(); };
    const passos = [
      ['executando comando', p => { setAcao(p.A, 'executando'); emitir({ tipo: 'acao', no: p.A, acao: 'executando' }); }],
      ['usando ferramenta: lendo', p => { setAcao(p.B, 'lendo'); emitir({ tipo: 'acao', no: p.B, acao: 'lendo' }); }],
      ['escrevendo código', p => { setAcao(p.J, 'escrevendo'); emitir({ tipo: 'acao', no: p.J, acao: 'escrevendo' }); }],
      ['testando', p => { setAcao(p.A, 'testando'); emitir({ tipo: 'acao', no: p.A, acao: 'testando' }); }],
      ['revisando', p => { setAcao(p.B, 'revisando'); emitir({ tipo: 'acao', no: p.B, acao: 'revisando' }); }],
      ['falando com a equipe', p => { setAcao(p.J, 'falando'); emitir({ tipo: 'acao', no: p.J, acao: 'falando' }); }],
      ['ajudante nascendo', p => { setAcao(p.A, 'ajudante'); emitir({ tipo: 'ajudante-nasce', no: p.A, n: 1 }); }],
      ['esperando ajudante', p => { setAcao(p.A, 'esperaAjudante'); emitir({ tipo: 'acao', no: p.A, acao: 'esperaAjudante' }); }],
      ['ajudante terminando', p => { emitir({ tipo: 'ajudante-termina', no: p.A, n: 1 }); }],
      ['mensagem: comando', p => { const f = p.fioEntre(p.J, p.A) || F.fios[0]; if (f) emitir({ tipo: 'mensagem', kind: 'comando', de: f.de, para: f.para, lado: f.ida.sender, fio: f, resumo: f.ida.resumo, deNome: f.deNome, paraNome: f.paraNome }); }],
      ['mensagem: dúvida', p => { const f = F.fios.find(x => x.ida.kind === 'duvida') || p.fioEntre(p.B, p.V) || F.fios[1] || F.fios[0]; if (f) emitir({ tipo: 'mensagem', kind: 'duvida', de: f.de, para: f.para, lado: f.ida.sender, fio: f, resumo: f.ida.resumo, deNome: f.deNome, paraNome: f.paraNome }); }],
      ['mensagem: resposta', p => { const f = F.fios.find(x => x.ida.kind === 'resposta') || F.fios.find(x => x.de === 'voce') || F.fios[0]; if (f) emitir({ tipo: 'mensagem', kind: 'resposta', de: f.de, para: f.para, lado: f.ida.sender, fio: f, resumo: f.ida.resumo, deNome: f.deNome, paraNome: f.paraNome }); }],
      ['card novo: VOCÊ pulsa', () => emitir({ tipo: 'card-novo', id: 'demo' })],
      ['card respondido', () => emitir({ tipo: 'card-respondido', id: 'demo' })],
      ['esperando você', p => { setAcao(p.B, 'esperando'); emitir({ tipo: 'acao', no: p.B, acao: 'esperando' }); }],
      ['subiu no ar', p => { setAcao(p.J, 'subindo'); emitir({ tipo: 'subiu', texto: 'demo', no: p.J }); }],
      ['gate verde', p => emitir({ tipo: 'gate-verde', ramo: 'demo', no: p.X })],
      ['dormindo', p => { setAcao(p.X, 'dormindo'); emitir({ tipo: 'dorme', no: p.X }); }],
      ['acordando', p => { setAcao(p.X, 'generico'); emitir({ tipo: 'acorda', no: p.X }); }],
      ['erro / sem leitura', p => { setAcao(p.B, 'sem-leitura'); emitir({ tipo: 'erro', no: p.B }); }],
      ['terminou', p => { setAcao(p.A, 'terminou'); emitir({ tipo: 'acao', no: p.A, acao: 'terminou' }); }]
    ];
    let i = 0, cap = null;
    const passo = () => {
      if (!F || !F.mapa.isConnected) { demo.timer = setTimeout(passo, 500); return; }
      const p = pick(); const [nome, fn] = passos[i % passos.length];
      if (!cap || !cap.isConnected) { cap = doc.createElement('div'); cap.className = 'g-demo-cap'; F.mapa.append(cap); }
      cap.textContent = 'DEMO ' + ((i % passos.length) + 1) + '/' + passos.length + ' · ' + nome;
      try { fn(p); } catch (e) { console.warn('demo', nome, e); }
      i++; demo.timer = setTimeout(passo, 1100);
    };
    demo = { timer: setTimeout(passo, 900), reaplicar() { if (!F) return; for (const n of F.nos) if (override.has(n.id)) n.el.dataset.acao = override.get(n.id); cap = null; } };
  }

  root.PainelAnim = Object.freeze({
    tema(nome, impl) { TEMAS[nome] = impl; if (F) { sprites(); acordarLaco(); } },
    fluxo, agora, estado, emitir, ouvir: fn => ouvintes.push(fn), SPRITES, kit,
    estadoMotor: () => ({ tema: nomeTema(), viajantes: viajantes.length, efeitos: fx.length, demo: !!demo, sprites: F ? F.mapa.querySelectorAll('.g-acao canvas').length : 0 })
  });
})(window);
