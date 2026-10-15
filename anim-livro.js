/* anim-livro.js (fase 2, 08/10): animacoes do tema LIVRO DE ORDENS (terminal de ordens: LEDs, ticker, "FILL").
   Movimento suave (ease), ponto redondo com cauda de cometa na cor de quem manda, flash de 300 ms como ordem executada,
   numero com tick. Sem brilho de neon. Cada evento do motor tem a versao do livro, nunca mais pobre que a da GRADE:
   mensagem   = o fio acende na cor de quem manda e esfria em 3 passos; cometa com cauda corre o fio (duvida = anel que pulsa,
                resposta = 2 pontos); na chegada, onda na cor de quem mandou, a caixa faz FILL (300 ms), "+1" sobe e o numero do fio da tick
   acao       = o LED do tipo troca com fade, a borda pisca na cor do lado e o nome da acao sobe ("lendo", "testando"...)
   terminou   = FILL verde, check desenhado em traco e 8 pontos que abrem; "FEITO"
   acorda     = luz sobe, borda acende na cor do lado, anel suave e o "z" sai voando
   dorme      = luz desce e dois "z" sobem devagar
   ajudante   = nasce: ponto sai da caixa e se divide em 2, "+1 ajudante" / termina: ponto volta, FILL verde, "-1 ajudante"
   card novo  = VOCE pulsa, 2 aneis rosa abrem, "NOVO"; o placar da espera acende
   respondido = VOCE faz FILL verde, barra de preenchimento corre a base da caixa, check e "FILL"
   subiu      = etiqueta "NO AR" desliza no topo, linha verde sobe da caixa ate o topo
   gate verde = anel verde fecha em volta e o check se desenha; "GATE OK"
   erro       = borda ambar 2x e "?" ambar
   Sprites em LEDs redondos (o apagado fica visivel, como painel de LED de bolsa). */
(function (root) {
  'use strict';
  const A = root.PainelAnim; if (!A) return;
  const doc = root.document;
  const io = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  const out = p => 1 - Math.pow(1 - p, 3);
  function bola(ctx, x, y, r, cor, a = 1) { if (r <= 0) return; ctx.globalAlpha = Math.max(0, Math.min(1, a)); ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  function anel(ctx, x, y, r, cor, a = 1, lw = 1.5) { if (r <= 0) return; ctx.globalAlpha = Math.max(0, Math.min(1, a)); ctx.strokeStyle = cor; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
  // check desenhado em traco: p de 0 a 1
  function check(ctx, x, y, s, p, cor, a = 1) {
    const pts = [[x - s * .5, y], [x - s * .15, y + s * .35], [x + s * .55, y - s * .4]], L1 = Math.hypot(s * .35, s * .35), L2 = Math.hypot(s * .7, s * .75), d = p * (L1 + L2);
    ctx.globalAlpha = a; ctx.strokeStyle = cor; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    if (d <= L1) { const k = d / L1; ctx.lineTo(pts[0][0] + (pts[1][0] - pts[0][0]) * k, pts[0][1] + (pts[1][1] - pts[0][1]) * k); }
    else { const k = (d - L1) / L2; ctx.lineTo(pts[1][0], pts[1][1]); ctx.lineTo(pts[1][0] + (pts[2][0] - pts[1][0]) * k, pts[1][1] + (pts[2][1] - pts[1][1]) * k); }
    ctx.stroke(); ctx.globalAlpha = 1; ctx.lineCap = 'butt';
  }
  const corNo = (kit, n) => kit.corLado(n && n.lado);
  function rot(kit, txt, x, y, cls, ms, cor) { const r = kit.rotulo(txt, x, y, cls, ms); if (r && cor) r.style.setProperty('--fx-cor', cor); return r; }
  // cometa com cauda pelo fio, no sentido de quem manda
  function corre(kit, fio, de, cor, kind, fim) {
    const path = kit.caminho(fio, de), dur = Math.max(700, Math.min(1400, path.total * 2.4));
    kit.efeito(dur, (ctx, p) => {
      const d = io(p) * path.total;
      for (let k = 9; k >= 1; k--) { const [x, y] = kit.pontoEm(path, d - k * 5); bola(ctx, x, y, 3.4 - k * .3, cor, .55 - k * .055); }
      const [x, y] = kit.pontoEm(path, d);
      if (kind === 'duvida') anel(ctx, x, y, 3.5 + Math.sin(p * Math.PI * 6) * 1.2, cor, 1, 1.6);
      else if (kind === 'resposta') { bola(ctx, x, y, 2.6, cor); const [x2, y2] = kit.pontoEm(path, d - 9); bola(ctx, x2, y2, 2.6, cor); }
      else { bola(ctx, x, y, 6, cor, .18); bola(ctx, x, y, 3.8, cor); }
    }, () => { const [x, y] = path.pts[path.pts.length - 1]; onda(kit, x, y, cor); if (fim) fim(); });
  }
  function onda(kit, x, y, cor, rMax = 16, dur = 420) { kit.efeito(dur, (ctx, p) => anel(ctx, x, y, 2 + out(p) * rMax, cor, 1 - p, 1.5)); }
  // pontos que abrem em volta de um ponto (terminou, respondido)
  function abre(kit, x, y, cor, n = 8, dist = 18, dur = 520) {
    kit.efeito(dur, (ctx, p) => { const e = out(p); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; bola(ctx, x + Math.cos(a) * e * dist, y + Math.sin(a) * e * dist, 2 * (1 - p) + .6, cor, 1 - p); } });
  }
  const H = {
    mensagem(ev, kit) {
      const fio = ev.fio; if (!fio) return; const cor = kit.corLado(ev.lado), alvo = kit.no(ev.para);
      kit.esfriar(fio, ['quente', 'morno', 'recente'], 450);
      corre(kit, fio, ev.de, cor, ev.kind, () => {
        kit.marcar(fio.el, 'fx-conta', 320);
        if (!alvo) return; kit.marcar(alvo.el, 'fx-fill', 320);
        const b = kit.caixa(alvo.el); if (b) rot(kit, ev.kind === 'duvida' ? '?' : '+1', b.x + b.w - 10, b.y - 10, 'fx-rot-mais', 900, cor);
      });
    },
    acao(ev, kit) {
      const n = ev.no; if (!n) return; const b = kit.caixa(n.el);
      if (ev.acao === 'terminou') {
        kit.marcar(n.el, 'fx-fill-ok', 320); const verde = kit.css('--g-anda');
        if (b) { const cx = b.x + 10, cy = b.y + 18; kit.efeito(420, (ctx, p) => check(ctx, cx, cy, 12, out(p), verde)); abre(kit, cx, cy, verde); rot(kit, 'FEITO', b.x + b.w - 24, b.y - 12, 'fx-rot-ok', 1100); }
        return;
      }
      kit.marcar(n.el, 'fx-troca', 450);
      const nome = root.PaAnim && root.PaAnim.ROTULOS && root.PaAnim.ROTULOS[ev.acao] ? root.PaAnim.ROTULOS[ev.acao].pt : '';
      if (b && nome) rot(kit, nome.toLowerCase(), b.x + 28, b.y - 12, 'fx-rot-acao', 1000, ev.acao === 'esperando' ? kit.css('--g-rosa') : corNo(kit, n));
    },
    acorda(ev, kit) {
      const n = ev.no; if (!n) return; kit.marcar(n.el, 'fx-acorda', 700); const b = kit.caixa(n.el), cor = corNo(kit, n);
      if (b) { onda(kit, b.x + 10, b.y + 18, cor, 22, 600); rot(kit, 'z', b.x + 14, b.y - 6, 'fx-rot-z', 900); }
    },
    dorme(ev, kit) {
      const n = ev.no; if (!n) return; kit.marcar(n.el, 'fx-dorme', 800); const b = kit.caixa(n.el); if (!b) return;
      rot(kit, 'z', b.x + 14, b.y - 6, 'fx-rot-z', 1400); setTimeout(() => rot(kit, 'z', b.x + 22, b.y - 10, 'fx-rot-z', 1400), 450);
    },
    'ajudante-nasce'(ev, kit) {
      const n = ev.no; if (!n) return; kit.marcar(n.el, 'fx-fill', 320); const b = kit.caixa(n.el), cor = corNo(kit, n); if (!b) return;
      const x0 = b.x + b.w / 2, y0 = b.y + b.h;
      kit.efeito(700, (ctx, p) => { const sai = out(Math.min(1, p * 2)), abreP = out(Math.max(0, p * 2 - 1)), y = y0 + sai * 14; if (p < .5) bola(ctx, x0, y, 3, cor); else { bola(ctx, x0 - abreP * 12, y + abreP * 4, 2.6, cor, 1 - abreP * .4); bola(ctx, x0 + abreP * 12, y + abreP * 4, 2.6, cor, 1 - abreP * .4); } });
      rot(kit, '+' + (ev.n || 1) + ' ajudante', b.x + 24, b.y - 12, 'fx-rot-mais', 1100, cor);
    },
    'ajudante-termina'(ev, kit) {
      const n = ev.no; if (!n) return; const b = kit.caixa(n.el), verde = kit.css('--g-anda'); if (!b) return;
      const x0 = b.x + b.w / 2, y0 = b.y + b.h;
      kit.efeito(520, (ctx, p) => bola(ctx, x0, y0 + 16 * (1 - io(p)), 3 * (1 - p * .5), verde, 1 - p * .3), () => { kit.marcar(n.el, 'fx-fill-ok', 320); abre(kit, x0, y0, verde, 6, 12, 420); });
      rot(kit, '-' + (ev.n || 1) + ' ajudante', b.x + 24, b.y - 12, 'fx-rot-ok', 1100);
    },
    'card-novo'(ev, kit) {
      const pl = doc.querySelector('.g-pl.is-espera'); if (pl) kit.marcar(pl, 'fx-chega', 900);
      const v = kit.voce(); if (!v) return; kit.marcar(v.el, 'fx-pulsa', 1100); const b = kit.caixa(v.el), rosa = kit.css('--g-rosa'); if (!b) return;
      // 2 molduras rosa abrem da caixa, uma atras da outra
      for (const atraso of [0, 260]) kit.efeito(800, (ctx, p) => { ctx.globalAlpha = 1 - p; ctx.strokeStyle = rosa; ctx.lineWidth = 1.5; const e = out(p) * 14; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(b.x - e, b.y - e, b.w + 2 * e, b.h + 2 * e, 8 + e); else ctx.rect(b.x - e, b.y - e, b.w + 2 * e, b.h + 2 * e); ctx.stroke(); ctx.globalAlpha = 1; }, null, atraso);
      rot(kit, 'NOVO', b.x + b.w - 34, b.y - 14, 'fx-rot-rosa', 1200);
    },
    'card-respondido'(ev, kit) {
      const v = kit.voce(); if (!v) return; kit.marcar(v.el, 'fx-fill-ok', 320); const b = kit.caixa(v.el), verde = kit.css('--g-anda'); if (!b) return;
      kit.efeito(460, (ctx, p) => { ctx.globalAlpha = 1 - Math.max(0, p - .7) / .3; ctx.fillStyle = verde; ctx.fillRect(b.x + 2, b.y + b.h - 3, (b.w - 4) * out(p), 2); ctx.globalAlpha = 1; });
      kit.efeito(420, (ctx, p) => check(ctx, b.x + b.w - 16, b.y + 16, 10, out(p), verde), null, 200);
      abre(kit, b.x + b.w - 16, b.y + 16, verde, 8, 16, 520);
      rot(kit, 'FILL', b.x + b.w - 30, b.y - 14, 'fx-rot-ok', 1200);
    },
    subiu(ev, kit) {
      const n = ev.no, verde = kit.css('--g-anda'); kit.rotulo('NO AR', 8, 4, 'fx-noar', 1600);
      if (!n) return; kit.marcar(n.el, 'fx-fill-ok', 320); const b = kit.caixa(n.el); if (!b) return;
      const x = b.x + b.w / 2, y0 = b.y;
      kit.efeito(900, (ctx, p) => { const top = y0 - out(p) * Math.max(0, y0 - 8); ctx.globalAlpha = 1 - Math.max(0, p - .6) / .4; ctx.fillStyle = verde; ctx.fillRect(x - 1, top, 2, y0 - top); bola(ctx, x, top, 3, verde); ctx.globalAlpha = 1; });
    },
    'gate-verde'(ev, kit) {
      const n = ev.no; if (!n) return; kit.marcar(n.el, 'fx-fill-ok', 320); const b = kit.caixa(n.el), verde = kit.css('--g-anda'); if (!b) return;
      const cx = b.x + b.w - 14, cy = b.y + 14;
      kit.efeito(700, (ctx, p) => { const e = out(Math.min(1, p * 1.4)); ctx.globalAlpha = 1; ctx.strokeStyle = verde; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(cx, cy, 9, -Math.PI / 2, -Math.PI / 2 + e * Math.PI * 2); ctx.stroke(); if (p > .45) check(ctx, cx, cy, 9, out((p - .45) / .55), verde); });
      rot(kit, 'GATE OK', b.x + 20, b.y - 14, 'fx-rot-ok', 1300);
    },
    erro(ev, kit) {
      const n = ev.no; if (!n) return; kit.marcar(n.el, 'fx-erro', 800); const b = kit.caixa(n.el);
      if (b) rot(kit, '?', b.x + b.w - 14, b.y - 12, 'fx-rot-ambar', 1100);
    }
  };
  A.tema('livro', {
    sprite: { pixel: 'led', escala: 2 },
    // LED redondo; o apagado aparece fraco, como painel de LED de bolsa
    pixelSprite(x, frame, s, cor) {
      frame.forEach((row, j) => [...row].forEach((ch, i) => { x.globalAlpha = ch === '#' ? 1 : .1; x.fillStyle = ch === '#' ? cor : '#71717A'; x.beginPath(); x.arc(i * s + s / 2, j * s + s / 2, s * .42, 0, Math.PI * 2); x.fill(); }));
      x.globalAlpha = 1;
    },
    // particula continua na cor de quem manda: rapida = 3 px com cauda; lenta = 2 px; escolhido maior
    viajante(ctx, v, p, now, kit, sel) {
      if (sel === false) return; const cor = kit.corLado(v.lado), d = p * v.path.total, r = sel ? 4 : v.lento ? 1.8 : 3;
      const a = Math.min(1, Math.min(p, 1 - p) * 12);
      if (!v.lento) for (let k = 4; k >= 1; k--) { const [x, y] = kit.pontoEm(v.path, d - k * 4); bola(ctx, x, y, r - k * .4, cor, a * (.45 - k * .09)); }
      const [x, y] = kit.pontoEm(v.path, d); bola(ctx, x, y, r, cor, a * (v.lento ? .75 : 1));
    },
    evento(ev, kit) { const fn = H[ev.tipo]; if (fn) fn(ev, kit); }
  });
})(window);
