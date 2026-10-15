/* anim-grade.js (08/10): animacoes do tema GRADE. Pixel e dither, passos discretos (4 px, 30 a 60 ms), sem brilho e sem
   gradiente. So este arquivo e o theme-grade.css sao do tema: a marcacao (vistas.js) e o motor (anim-motor.js) sao comuns.
   Evento -> animacao (reconhecivel sem legenda):
   mensagem comando = quadrado cheio viaja pelo fio com rastro de dither; duvida = quadrado vazado que pisca; resposta = 2 quadrados;
   chegou = a caixa "engole" (rosto pisca em 3 quadros) e espirra 4 pixels; o fio que falou acende e esfria em 3 degraus.
   card novo = VOCE solta 3 molduras rosa em degraus e o ◆ do placar pisca; card respondido = check verde e pacote volta.
   subiu = coluna verde sobe ate o topo e "NO AR" pisca; gate verde = xadrez verde em volta e check; ajudante nasce = pixel
   sai da caixa e se divide; termina = pixel volta e a caixa pisca; acorda/dorme = rosto em 3 degraus + "z" de pixel;
   erro = caixa treme em 2 px e "?" ambar; troca de acao = o sprite da um tranco de 2 quadros. */
(function (root) {
  'use strict';
  const A = root.PainelAnim; if (!A) return;
  const doc = root.document, PASSO = 4;
  const q = v => Math.round(v / PASSO) * PASSO;
  const degrau = (p, n) => Math.floor(p * n) / n;
  function quad(ctx, x, y, s, cor) { ctx.fillStyle = cor; ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s); }
  // dither de verdade: nivel 1 = metade dos sub-pixels (xadrez), nivel 2 = 1 de 4
  function dither(ctx, x, y, s, cor, nivel) {
    const h = Math.max(1, s / 2), x0 = Math.round(x - s / 2), y0 = Math.round(y - s / 2); ctx.fillStyle = cor;
    if (nivel <= 1) { ctx.fillRect(x0, y0, h, h); ctx.fillRect(x0 + h, y0 + h, h, h); } else ctx.fillRect(x0, y0, h, h);
  }
  function vazado(ctx, x, y, s, cor) { ctx.fillStyle = cor; const x0 = Math.round(x - s / 2), y0 = Math.round(y - s / 2); ctx.fillRect(x0, y0, s, 2); ctx.fillRect(x0, y0 + s - 2, s, 2); ctx.fillRect(x0, y0, 2, s); ctx.fillRect(x0 + s - 2, y0, 2, s); }
  function glifo(ctx, rows, x, y, s, cor) { ctx.fillStyle = cor; rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '#') ctx.fillRect(Math.round(x + i * s), Math.round(y + j * s), s, s); })); }
  const Z = ['###', '..#', '.#.', '#..', '###'];
  const CHECK = A.SPRITES.terminou.frames[2], INTER = ['.##.', '#..#', '..#.', '.#..', '....', '.#..'];
  const ease = p => p; // grade nao suaviza: o degrau faz o ritmo

  // pacote de 1 vez pelo fio, em degraus de 4 px a cada 30 ms, rastro de dither; fim() quando chega
  function pacote(kit, fio, de, kind, cor, fim, onPos) {
    const path = kit.caminho(fio, de), dur = Math.max(600, Math.min(1300, path.total * 2.2));
    kit.efeito(dur, (ctx, p, now) => {
      const d = q(degrau(ease(p), Math.max(8, Math.round(path.total / PASSO))) * path.total);
      for (let k = 4; k >= 1; k--) { const [x, y] = kit.pontoEm(path, d - k * 6); dither(ctx, x, y, 6, cor, k <= 2 ? 1 : 2); }
      const [x, y] = kit.pontoEm(path, d); if (onPos) onPos(x, y);
      if (kind === 'duvida') { if (Math.floor(now / 90) % 2 === 0) vazado(ctx, x, y, 8, cor); else quad(ctx, x, y, 4, cor); }
      else if (kind === 'resposta') { const [x2, y2] = kit.pontoEm(path, d - 7); quad(ctx, x, y, 4, cor); quad(ctx, x2, y2, 4, cor); }
      else quad(ctx, x, y, 7, cor);
    }, () => { const [x, y] = path.pts[path.pts.length - 1]; espirro(kit, x, y, cor); if (fim) fim(); });
  }
  // 4 pixels saem do ponto em 3 degraus e somem
  function espirro(kit, x, y, cor, n = 4, r = 12) {
    kit.efeito(300, (ctx, p) => { const k = degrau(p, 3), dist = 4 + k * r; for (let i = 0; i < n; i++) { const a = (Math.PI * 2 * i) / n + Math.PI / 4; quad(ctx, x + Math.cos(a) * dist, y + Math.sin(a) * dist, k > .6 ? 2 : 3, cor); } });
  }
  // molduras quadradas que crescem em degraus (VOCE, gate)
  function molduras(kit, el, cor, n = 3, voltas = 2) {
    const b = kit.caixa(el); if (!b) return;
    for (let v = 0; v < voltas; v++) kit.efeito(520, (ctx, p) => {
      const k = Math.floor(p * n); ctx.fillStyle = cor;
      for (let i = 0; i <= k; i++) { if (i < k - 1) continue; const o = 4 + i * 6; ctx.fillRect(b.x - o, b.y - o, b.w + 2 * o, 1); ctx.fillRect(b.x - o, b.y + b.h + o - 1, b.w + 2 * o, 1); ctx.fillRect(b.x - o, b.y - o, 1, b.h + 2 * o); ctx.fillRect(b.x + b.w + o - 1, b.y - o, 1, b.h + 2 * o); }
    }, null, v * 560);
  }
  const H = {
    mensagem(ev, kit) {
      const fio = ev.fio; if (!fio) return; const cor = kit.corLado(ev.lado), alvo = kit.no(ev.para), origem = kit.no(ev.de);
      if (origem) kit.marcar(origem.el, 'fx-fala', 200);
      // F2: a mensagem viaja com etiqueta legivel (tipo + resumo da fonte + DE -> PARA) e o destino acende com o mesmo rotulo
      const T = { comando: 'Comando', duvida: 'Dúvida', resposta: 'Resposta' }[ev.kind] || 'Comando', l1 = T + (ev.resumo ? ' · ' + ev.resumo : ''), l2 = (ev.deNome || '?') + ' → ' + (ev.paraNome || '?');
      const tag = kit.etiqueta ? kit.etiqueta([l1, l2], ev.lado, 3200) : null;
      pacote(kit, fio, ev.de, ev.kind, cor, () => {
        if (tag) tag.fim();
        if (alvo) { kit.marcar(alvo.el, 'fx-engole', 360); const b = kit.caixa(alvo.el), t2 = kit.etiqueta ? kit.etiqueta(['Chegou · ' + l1], ev.lado, 1800) : null; if (t2 && b) { t2.el.classList.add('is-chegou'); t2.mover(b.x - 10, b.y); } }
        kit.esfriar(fio, ['quente', 'morno', 'recente'], 500);
      }, tag ? (x, y) => tag.mover(x, y) : null);
    },
    acao(ev, kit) {
      const n = ev.no; if (!n || !n.el) return; kit.marcar(n.el, 'fx-troca', 260);
      const slot = n.el.querySelector('.g-acao'); if (!slot) return; const [x, y] = kit.centro(slot);
      if (ev.acao === 'terminou') { espirro(kit, x, y, kit.css('--g-anda'), 8, 16); kit.marcar(n.el, 'fx-terminou', 700); }
      else espirro(kit, x, y, A.kit.corSprite(ev.acao, n.lado), 4, 8);
    },
    acorda(ev, kit) { const n = ev.no; if (!n) return; kit.marcar(n.el, 'fx-acorda', 600); const [x, y] = kit.centro(n.el.querySelector('.g-no-face')); kit.efeito(600, (ctx, p) => { const k = degrau(p, 4); glifo(ctx, Z, x + 6 + k * 16, y - 10 - k * 18, 2, kit.css('--g-tx3')); }); },
    dorme(ev, kit) { const n = ev.no; if (!n) return; kit.marcar(n.el, 'fx-dorme', 700); const [x, y] = kit.centro(n.el.querySelector('.g-no-face')); for (let i = 0; i < 3; i++) kit.efeito(700, (ctx, p) => { const k = degrau(p, 4); glifo(ctx, Z, x + 4 + k * 10, y - 6 - k * 14, 1 + (i % 2), kit.css('--g-tx2')); }, null, i * 220); },
    'ajudante-nasce'(ev, kit) {
      const n = ev.no; if (!n) return; const b = kit.caixa(n.el.querySelector('.g-no-face')); if (!b) return; const cor = kit.corLado(n.lado), x0 = b.x + b.w + 4, y0 = b.y + b.h / 2;
      kit.efeito(700, (ctx, p) => { const k = degrau(p, 6); if (k < .5) quad(ctx, x0 + k * 32, y0, 4, cor); else { const s = (k - .5) * 16; quad(ctx, x0 + 16, y0 - s, 3, cor); quad(ctx, x0 + 16, y0 + s, 3, cor); } });
      kit.rotulo('+' + (ev.n || 1), x0 + 24, y0 - 22, 'fx-rot-mais', 900);
    },
    'ajudante-termina'(ev, kit) {
      const n = ev.no; if (!n) return; const b = kit.caixa(n.el.querySelector('.g-no-face')); if (!b) return; const cor = kit.corLado(n.lado), x0 = b.x + b.w + 28, y0 = b.y + b.h / 2;
      kit.efeito(520, (ctx, p) => { quad(ctx, x0 - degrau(p, 6) * 24, y0, 3, cor); }, () => { kit.marcar(n.el, 'fx-engole', 360); espirro(kit, b.x + b.w / 2, y0, kit.css('--g-anda'), 4, 8); });
    },
    'card-novo'(ev, kit) {
      const pl = doc.querySelector('.g-pl.is-espera'); if (pl) kit.marcar(pl, 'fx-chega', 900);
      const v = kit.voce(); if (!v) return; kit.marcar(v.el, 'fx-pulsa', 1100); molduras(kit, v.el, kit.css('--g-rosa'), 3, 2);
    },
    'card-respondido'(ev, kit) {
      const v = kit.voce(); if (!v) return; const b = kit.caixa(v.el); if (!b) return; const verde = kit.css('--g-anda');
      kit.efeito(700, (ctx, p) => { const k = Math.min(3, Math.floor(p * 4)); glifo(ctx, A.SPRITES.terminou.frames[k], b.x + b.w - 30, b.y - 30, 3, verde); });
      const f = kit.F && kit.F.fios.find(x => (x.de === 'voce' || x.para === 'voce')); if (f) setTimeout(() => pacote(kit, f, 'voce', 'resposta', verde), 300);
    },
    subiu(ev, kit) {
      const n = ev.no || (kit.F && kit.F.nos.find(x => x.lado === 'claude' && /coordenador/i.test(x.el.textContent))); if (!n) return;
      const [x, y] = kit.centro(n.el.querySelector('.g-no-face')), verde = kit.css('--g-anda');
      kit.efeito(800, (ctx, p) => { const yy = q(y - degrau(p, 12) * (y + 8)); for (let k = 1; k <= 5; k++) dither(ctx, x, yy + k * 6, 6, verde, k <= 2 ? 1 : 2); quad(ctx, x, yy, 6, verde); quad(ctx, x - 6, yy + 6, 4, verde); quad(ctx, x + 6, yy + 6, 4, verde); },
        () => { const r = kit.rotulo('NO AR', Math.max(0, x - 24), 4, 'fx-noar', 1400); if (r) kit.marcar(r, 'fx-pisca3', 1400); });
    },
    'gate-verde'(ev, kit) {
      const n = ev.no || (kit.F && kit.F.nos.find(x => x.lado === 'codex')) || (kit.F && kit.F.nos[0]); if (!n) return; const b = kit.caixa(n.el.querySelector('.g-no-face')); if (!b) return; const verde = kit.css('--g-anda');
      kit.efeito(900, (ctx, p) => { const on = Math.floor(p * 6) % 2 === 0; if (p < .66) { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if ((i + j + (on ? 0 : 1)) % 2 === 0 && (i || j)) quad(ctx, b.x + b.w / 2 + i * 12, b.y + b.h / 2 + j * 12, 6, verde); } else glifo(ctx, CHECK, b.x - 4, b.y - 4, 3, verde); });
    },
    erro(ev, kit) { const n = ev.no; if (!n) return; kit.marcar(n.el, 'fx-treme', 420); const b = kit.caixa(n.el); if (!b) return; kit.efeito(900, (ctx, p, now) => { if (Math.floor(now / 120) % 2) glifo(ctx, INTER, b.x + b.w + 6, b.y + 4, 3, kit.css('--g-trava')); }); }
  };
  A.tema('grade', {
    sprite: { pixel: 'quadrado', escala: 2 },
    // particula continua (A1/A2 do inventario): quadrado que anda de 4 em 4 px em degraus de 60 ms, rastro de dither;
    // rapida = 4 px + 3 de rastro; lenta = 2 px + 1 de rastro; fio escolhido = 6 px; os outros apagam
    viajante(ctx, v, p, now, kit, sel) {
      const tq = Math.floor(now / 60) * 60, pp = ((tq / v.dur) + v.fase) % 1, d = q(pp * v.path.total);
      if (sel === false) return; const cor = kit.corLado(v.lado), s = sel ? 6 : v.lento ? 2 : 4;
      if (pp < .03 || pp > .97) { const [x, y] = kit.pontoEm(v.path, d); dither(ctx, x, y, s + 2, cor, 1); return; }
      const rastro = v.lento ? 1 : 3; for (let k = rastro; k >= 1; k--) { const [x, y] = kit.pontoEm(v.path, d - k * (s + 2)); dither(ctx, x, y, s, cor, k === 1 ? 1 : 2); }
      const [x, y] = kit.pontoEm(v.path, d); quad(ctx, x, y, s, cor);
    },
    evento(ev, kit) { const fn = H[ev.tipo]; if (fn) fn(ev, kit); }
  });
})(window);
