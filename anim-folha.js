/* anim-folha.js (08/10, Fase 2): animacoes do tema FOLHA DO DIA (papel calmo). Curva longa, pouca coisa por vez, nada
   pisca forte; cada evento tem um gesto proprio, reconhecivel sem legenda (os 21 passos da demo do motor comum):
   mensagem comando = ponto com cauda suave desliza pelo fio na cor de quem manda, o fio acende e esfria em 2 s, quem recebe
   tinge o nome e abre 1 anel; duvida = anel vazado que respira; resposta = 2 pontos em fila.
   executando = cursor que pisca 3 vezes; lendo = luz que varre o nome; escrevendo = 3 linhas que se escrevem;
   testando = 2 bolhas que sobem; revisando = olho que abre e fecha; falando = 3 pontos em sequencia;
   esperando ajudante = arco fino que da 1 volta; esperando voce = anel rosa que respira 2 vezes;
   ajudante nasce = ponto sai e se divide em 2 com "+1"; termina = ponto volta e anel verde;
   card novo = VOCE respira rosa 2 vezes, 2 aneis rosa e "+1 card"; respondido = anel verde avanca e fecha, check se
   desenha, "feito" e um ponto verde volta pelo fio; subiu = linha verde se desenha embaixo da caixa, ponto sobe e "no ar";
   gate verde = anel verde avanca + check + "gate ok"; dormindo = barra esmaece e 2 "z" sobem; acordando = barra cresce e
   o "z" vai embora; erro = barra fica ambar, 2 aneis ambar e "?"; terminou = anel verde avanca, check e nome verde.
   Movimento off: o motor nao chama nada daqui. Som: nenhum. */
(function (root) {
  'use strict';
  const A = root.PainelAnim; if (!A) return;
  const doc = root.document;
  const io = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2, sai = p => 1 - Math.pow(1 - p, 3);
  const sino = p => Math.sin(Math.PI * Math.min(1, Math.max(0, p))); // 0 -> 1 -> 0
  function bola(ctx, x, y, r, cor, a = 1) { ctx.globalAlpha = Math.max(0, Math.min(1, a)); ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(x, y, Math.max(.3, r), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  function aro(ctx, x, y, r, cor, a = 1, lw = 1.5) { ctx.globalAlpha = Math.max(0, Math.min(1, a)); ctx.strokeStyle = cor; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, Math.max(.3, r), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
  function anel(kit, x, y, cor, raio = 22, dur = 900, atraso = 0) { kit.efeito(dur, (ctx, p) => aro(ctx, x, y, 4 + sai(p) * raio, cor, (1 - p) * .8), null, atraso); }
  // anel que AVANCA: o arco se desenha de 0 a 360 graus e some devagar (o mesmo gesto dos aneis do Agora)
  function avanca(kit, x, y, cor, raio = 14, dur = 1000, fim) {
    kit.efeito(dur, (ctx, p) => { const k = sai(Math.min(1, p / .7)), a = p > .8 ? (1 - p) * 5 : 1; ctx.globalAlpha = a; ctx.strokeStyle = cor; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y, raio, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }, fim);
  }
  // linha que se desenha (check, traco)
  function traco(ctx, pts, k, cor, a = 1, lw = 2) {
    const L = []; let tot = 0; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(l); tot += l; }
    let resta = tot * k; ctx.globalAlpha = Math.max(0, Math.min(1, a)); ctx.strokeStyle = cor; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length && resta > 0; i++) { const f = Math.min(1, resta / (L[i - 1] || 1)); ctx.lineTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f); resta -= L[i - 1]; }
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  function check(kit, x, y, cor, s = 1, dur = 900, atraso = 0) { kit.efeito(dur, (ctx, p) => traco(ctx, [[x - 5 * s, y], [x - 1.5 * s, y + 3.5 * s], [x + 5.5 * s, y - 4 * s]], sai(Math.min(1, p / .5)), cor, p > .75 ? (1 - p) * 4 : 1), null, atraso); }
  function letra(ctx, txt, x, y, cor, a) { ctx.globalAlpha = Math.max(0, Math.min(1, a)); ctx.fillStyle = cor; ctx.font = '600 13px Geist, system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x, y); ctx.globalAlpha = 1; }
  const face = n => n.el.querySelector('.g-no-face') || n.el;
  const centroFace = (kit, n) => kit.centro(face(n));
  const ponto = (kit, n) => { const s = n.el.querySelector('.g-acao'); return s && s.getBoundingClientRect().width ? kit.centro(s) : centroFace(kit, n); };
  // ponto com cauda suave pelo fio (o viajante de 1 vez); kind muda o desenho
  function cometa(kit, fio, de, kind, cor, fim) {
    const path = kit.caminho(fio, de), dur = Math.max(1000, Math.min(1800, path.total * 3));
    kit.efeito(dur, (ctx, p, now) => {
      const d = io(p) * path.total;
      if (kind === 'duvida') { const [x, y] = kit.pontoEm(path, d); aro(ctx, x, y, 3.5 + Math.sin(now / 140) * 1.2, cor, .95, 1.5); for (let k = 1; k <= 3; k++) { const [tx, ty] = kit.pontoEm(path, d - k * 7); bola(ctx, tx, ty, 1.2, cor, .35 - k * .08); } return; }
      if (kind === 'resposta') { for (const off of [0, 10]) { const [x, y] = kit.pontoEm(path, d - off); bola(ctx, x, y, 2.6, cor, off ? .7 : 1); } return; }
      for (let k = 5; k >= 1; k--) { const [tx, ty] = kit.pontoEm(path, d - k * 5); bola(ctx, tx, ty, 3.4 - k * .4, cor, .5 - k * .08); }
      const [x, y] = kit.pontoEm(path, d); bola(ctx, x, y, 3.6, cor, 1);
    }, fim);
  }
  // gesto de cada tipo de acao (o sprite troca com fade no css; isto e o detalhe em volta)
  const ACAO = {
    executando(kit, x, y, cor) { kit.efeito(1200, (ctx, p) => { if (Math.floor(p * 6) % 2 === 0) { ctx.globalAlpha = .9; ctx.fillStyle = cor; ctx.fillRect(x + 12, y + 5, 7, 2); ctx.globalAlpha = 1; } }); },
    lendo(kit, x, y, cor, n) { const b = kit.caixa(n.el); if (!b) return; kit.efeito(1100, (ctx, p) => { const cx = b.x + 16 + io(p) * Math.max(40, b.w - 32), gy = b.y + b.h + 3; const gr = ctx.createLinearGradient(cx - 28, 0, cx + 28, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.5, cor); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = sino(p) * .9; ctx.fillStyle = gr; ctx.fillRect(cx - 28, gy, 56, 1.5); ctx.globalAlpha = 1; }); },
    escrevendo(kit, x, y, cor) { kit.efeito(1300, (ctx, p) => { const a = p > .8 ? (1 - p) * 5 : 1; [10, 14, 7].forEach((w, i) => { const k = Math.max(0, Math.min(1, (p - i * .2) / .3)); if (k > 0) { ctx.globalAlpha = a * .85; ctx.fillStyle = cor; ctx.fillRect(x + 12, y - 5 + i * 4, Math.round(w * sai(k)), 1.5); ctx.globalAlpha = 1; } }); }); },
    testando(kit, x, y, cor) { for (const [dx, atr] of [[0, 0], [5, 300]]) kit.efeito(1000, (ctx, p) => aro(ctx, x + 12 + dx, y + 4 - sai(p) * 18, 1.6 + p * 1.2, cor, (1 - p) * .9, 1.2), null, atr); },
    revisando(kit, x, y, cor) { kit.efeito(1200, (ctx, p) => { const h = sino(p) * 4; ctx.globalAlpha = .9; ctx.strokeStyle = cor; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(x + 18, y, 7, Math.max(.3, h), 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; if (h > 2) bola(ctx, x + 18 + Math.sin(p * Math.PI * 2) * 2, y, 1.6, cor, .95); }); },
    falando(kit, x, y, cor) { kit.efeito(1400, (ctx, p) => { for (let i = 0; i < 3; i++) { const k = Math.max(0, Math.min(1, (p - i * .18) / .3)); bola(ctx, x + 12 + i * 6, y - 12, 1.8, cor, k * (p > .8 ? (1 - p) * 5 : 1)); } }); },
    esperaAjudante(kit, x, y, cor, n) { const [fx, fy] = centroFace(kit, n); kit.efeito(1400, (ctx, p) => { const a0 = -Math.PI / 2 + io(p) * Math.PI * 2; ctx.globalAlpha = sino(p) * .9; ctx.strokeStyle = cor; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(fx, fy, 12, a0, a0 + Math.PI * .6); ctx.stroke(); ctx.globalAlpha = 1; }); },
    esperando(kit, x, y, cor, n) { const [fx, fy] = centroFace(kit, n), rosa = kit.css('--g-rosa'); for (const atr of [0, 700]) kit.efeito(1100, (ctx, p) => aro(ctx, fx, fy, 6 + sino(p) * 8, rosa, sino(p) * .8, 1.5), null, atr); },
    subindo(kit, x, y) { const verde = kit.css('--g-anda'); kit.efeito(1000, (ctx, p) => traco(ctx, [[x + 14, y + 6], [x + 14, y - 10]], sai(p), verde, 1 - p * .6, 1.5)); },
    conferindo(kit, x, y) { check(kit, x + 16, y, kit.css('--g-anda'), .8, 900); },
    terminou(kit, x, y, cor, n) { const [fx, fy] = centroFace(kit, n), verde = kit.css('--g-anda'); avanca(kit, fx, fy, verde, 12, 1000); check(kit, fx, fy, verde, .8, 1000, 350); kit.marcar(n.el, 'fx-terminou', 1200); },
    generico(kit, x, y, cor, n) { const [fx, fy] = centroFace(kit, n); anel(kit, fx, fy, cor, 14, 800); }
  };
  const H = {
    mensagem(ev, kit) {
      const fio = ev.fio; if (!fio) return; const cor = kit.corLado(ev.lado), alvo = kit.no(ev.para);
      kit.esfriar(fio, ['quente', 'morno', 'recente'], 700);
      cometa(kit, fio, ev.de, ev.kind, cor, () => { if (alvo) { const [x, y] = centroFace(kit, alvo); anel(kit, x, y, cor, 20, 900); kit.marcar(alvo.el, 'fx-recebe', 700); } });
    },
    acao(ev, kit) {
      const n = ev.no; if (!n || !n.el) return; kit.marcar(n.el, 'fx-troca', 600);
      const fn = ACAO[ev.acao] || ACAO.generico, [x, y] = ponto(kit, n), cor = A.kit.corSprite(ev.acao, n.lado);
      fn(kit, x, y, cor, n);
    },
    acorda(ev, kit) {
      const n = ev.no; if (!n) return; kit.marcar(n.el, 'fx-acorda', 900); const [x, y] = centroFace(kit, n), cinza = kit.css('--g-tx2');
      kit.efeito(900, (ctx, p) => letra(ctx, 'z', x + 8 + sai(p) * 22, y - 8 - sai(p) * 16, cinza, 1 - p));
      anel(kit, x, y, kit.corLado(n.lado), 16, 900, 150);
    },
    dorme(ev, kit) {
      const n = ev.no; if (!n) return; kit.marcar(n.el, 'fx-dorme', 1000); const [x, y] = centroFace(kit, n), cinza = kit.css('--g-tx2');
      for (const [atr, dx] of [[0, 0], [450, 6]]) kit.efeito(1300, (ctx, p) => letra(ctx, 'z', x + 8 + dx + Math.sin(p * 3) * 2, y - 4 - p * 20, cinza, sino(p) * .9), null, atr);
    },
    'ajudante-nasce'(ev, kit) {
      const n = ev.no; if (!n) return; const [x, y] = centroFace(kit, n), cor = kit.corLado(n.lado);
      kit.efeito(1100, (ctx, p) => { const k = io(Math.min(1, p / .55)); if (p < .55) bola(ctx, x + 6 + k * 22, y, 2.6, cor); else { const s = sai((p - .55) / .45) * 8; bola(ctx, x + 28, y - s, 2.2, cor, 1 - (p - .55)); bola(ctx, x + 28, y + s, 2.2, cor, 1 - (p - .55)); } });
      const b = kit.caixa(face(n)); if (b) kit.rotulo('+' + (ev.n || 1), b.x + 34, b.y - 14, 'fx-rot-ok', 1300);
    },
    'ajudante-termina'(ev, kit) { const n = ev.no; if (!n) return; const [x, y] = centroFace(kit, n), cor = kit.corLado(n.lado); kit.efeito(900, (ctx, p) => bola(ctx, x + 30 - io(p) * 24, y - 8 + io(p) * 8, 2.4, cor, 1 - p * .3), () => anel(kit, x, y, kit.css('--g-anda'), 14, 700)); },
    'card-novo'(ev, kit) {
      const pl = doc.querySelector('.g-pl.is-espera'); if (pl) kit.marcar(pl, 'fx-chega', 1200);
      const v = kit.voce(); if (!v) return; kit.marcar(v.el, 'fx-pulsa', 1600); const [x, y] = kit.centro(v.el), rosa = kit.css('--g-rosa');
      anel(kit, x, y, rosa, 70, 1200); anel(kit, x, y, rosa, 70, 1200, 500);
      const b = kit.caixa(v.el); if (b) kit.rotulo('+1 card', b.x + b.w - 52, b.y - 18, 'fx-rot-rosa', 1400);
    },
    'card-respondido'(ev, kit) {
      const v = kit.voce(); if (!v) return; kit.marcar(v.el, 'fx-feito', 1400); const verde = kit.css('--g-anda'), [fx, fy] = centroFace(kit, v);
      avanca(kit, fx, fy, verde, 12, 1000); check(kit, fx, fy, verde, .8, 1000, 350);
      const b = kit.caixa(v.el); if (b) kit.rotulo('feito', b.x + b.w - 40, b.y - 18, 'fx-rot-ok', 1400);
      const f = kit.F && kit.F.fios.find(x => x.de === 'voce' || x.para === 'voce'); if (f) setTimeout(() => cometa(kit, f, 'voce', 'resposta', verde), 450);
    },
    subiu(ev, kit) {
      const n = ev.no || (kit.F && kit.F.nos.find(x => x.lado === 'claude' && /coordenador/i.test(x.el.textContent))); if (!n) return; const b = kit.caixa(n.el); if (!b) return; const verde = kit.css('--g-anda');
      kit.efeito(1300, (ctx, p) => { ctx.globalAlpha = p > .8 ? (1 - p) * 5 : 1; ctx.fillStyle = verde; ctx.fillRect(b.x, b.y + b.h + 3, Math.round(sai(Math.min(1, p * 1.5)) * b.w), 2); ctx.globalAlpha = 1; });
      const [x, y] = centroFace(kit, n); kit.efeito(1200, (ctx, p) => bola(ctx, x, y - sai(p) * Math.max(24, y - 8), 2.8, verde, 1 - p), null, 200);
      kit.rotulo('no ar', b.x, b.y - 18, 'fx-rot-ok', 1500);
    },
    'gate-verde'(ev, kit) {
      const n = ev.no || (kit.F && kit.F.nos.find(x => x.lado === 'codex')) || (kit.F && kit.F.nos[0]); if (!n) return; const [x, y] = centroFace(kit, n), verde = kit.css('--g-anda');
      avanca(kit, x, y, verde, 14, 1100); check(kit, x, y, verde, .9, 1000, 400);
      const b = kit.caixa(n.el); if (b) kit.rotulo('gate ok', b.x + 20, b.y - 18, 'fx-rot-ok', 1400);
    },
    erro(ev, kit) {
      const n = ev.no; if (!n) return; kit.marcar(n.el, 'fx-erro', 1000); const [x, y] = centroFace(kit, n), ambar = kit.css('--g-trava');
      anel(kit, x, y, ambar, 20, 900); anel(kit, x, y, ambar, 20, 900, 350);
      const b = kit.caixa(n.el); if (b) kit.rotulo('?', b.x + b.w + 6, b.y + 2, 'fx-rot-ambar', 1300);
    }
  };
  A.tema('folha', {
    sprite: { pixel: 'suave', escala: 2 },
    // sprite de pontos suaves (mesma forma 8x8 dos 3 temas)
    pixelSprite(x, frame, s, cor) { x.fillStyle = cor; x.globalAlpha = .9; frame.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') { x.beginPath(); x.arc(i * s + s / 2, j * s + s / 2, s * .36, 0, Math.PI * 2); x.fill(); } })); x.globalAlpha = 1; },
    // particula continua: ponto calmo na cor de quem manda; o rapido leva uma cauda curta, o lento quase some
    viajante(ctx, v, p, now, kit, sel) {
      if (sel === false) return; const a = Math.min(1, Math.min(p, 1 - p) * 8), d = io(p) * v.path.total, cor = kit.corLado(v.lado);
      if (!v.lento) for (let k = 2; k >= 1; k--) { const [tx, ty] = kit.pontoEm(v.path, d - k * 5); bola(ctx, tx, ty, 2.2 - k * .5, cor, a * (.35 - k * .1)); }
      const [x, y] = kit.pontoEm(v.path, d);
      bola(ctx, x, y, sel ? 3.6 : v.lento ? 1.8 : 2.8, cor, a * (v.lento ? .55 : .95));
    },
    evento(ev, kit) { const fn = H[ev.tipo]; if (fn) fn(ev, kit); }
  });
})(window);
