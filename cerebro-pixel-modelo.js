(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.CerebroPixel = api; })(typeof window === 'object' ? window : globalThis, () => {
  'use strict';
  const TIPOS = ['ordens', 'erros', 'regras', 'licoes', 'skills', 'agentes', 'ferramentas'];
  const NOMES = { ordens: 'Ordens', erros: 'Erros repetidos', regras: 'Regras', licoes: 'Lições', skills: 'Skills', agentes: 'Agentes', ferramentas: 'Ferramentas' };
  const FRASES = {
    ordens: 'O que você mandou e decidiu, com data: decisões, fila de decisões e respostas de card.',
    erros: 'Assunto que você teve de cobrar mais de uma vez, marcado como erro repetido.',
    regras: 'Como sua equipe trabalha, no CLAUDE.md e nas regras da sua equipe.',
    licoes: 'Nota de método da sua equipe, sem ordem sua e sem repetição.',
    skills: 'Habilidades e rotinas agendadas instaladas.',
    agentes: 'Ajudantes que as sessões chamam.',
    ferramentas: 'Scripts que sua equipe fez (fora o código do painel).'
  };
  const SEM_DESCRICAO = 'sem descrição ainda';
  const SOLUCAO_FRASE = { ferramentas: 'Para resolver: ponha 1 comentário no topo do arquivo ou escreva a frase em na fonte pessoal configurada.', agentes: 'Para resolver: preencha o campo description do agente ou escreva a frase em na fonte pessoal configurada.', skills: 'Para resolver: preencha o campo description da skill ou escreva a frase em na fonte pessoal configurada.', erros: 'Para resolver: preencha o campo description do arquivo de memória ou escreva a frase em na fonte pessoal configurada.' };
  const SOLUCAO_PADRAO = 'Para resolver: escreva a frase em na fonte pessoal configurada.';
  const textoValido = v => { const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''; return s && !/^(?:null|undefined|nan|\[object object\])$/i.test(s) ? s : ''; };
  function cortarFrase(s, max = 110) {
    let t = s; const ponto = t.search(/\.(?:\s|$)/); if (ponto >= 6 && ponto < t.length - 1) t = t.slice(0, ponto + 1);
    if (t.length > max) { const j = t.slice(0, max - 3), e = j.lastIndexOf(' '); t = (e > 0 ? j.slice(0, e) : j).replace(/[\s,;:.(-]+$/, '') + '...'; }
    return t;
  }
  function fraseDaDica(it) {
    const f = textoValido(it && it.frase); if (f) return { texto: f, solucao: null };
    const d = textoValido(it && it.descricao); if (d) return { texto: cortarFrase(d), solucao: null };
    if (it && it.reservado) return { texto: 'Assunto reservado: o texto só abre para você, no modo dono.', solucao: null };
    return { texto: SEM_DESCRICAO, solucao: SOLUCAO_FRASE[it && it.tipo] || SOLUCAO_PADRAO };
  }
  function contagemExtra(d, tipo) {
    const c = d && d.contagens && d.contagens[tipo], campo = tipo === 'ordens' ? 'assuntos' : tipo === 'erros' ? 'marcas' : '';
    if (!c || !campo || c[campo] === undefined) return '';
    const n = Number.isFinite(Number(c[campo])) && c[campo] !== null ? Number(c[campo]) : null, um = n === 1;
    if (campo === 'assuntos') return n === null ? '? assuntos vivos na memória (fonte não lida).' : n + (um ? ' assunto vivo na memória, contado à parte.' : ' assuntos vivos na memória, contados à parte.');
    return n === null ? '? marcas de repetição (fonte não lida).' : n + (um ? ' marca de repetição.' : ' marcas de repetição.');
  }
  const COLS = 80, ROWS = 54, MEIO = 40;
  const ROTULO = { ordens: { c: 11, r: 4 }, licoes: { c: 68, r: 4 }, regras: { c: 7, r: 22 }, skills: { c: 72, r: 22 }, erros: { c: 9, r: 41 }, agentes: { c: 70, r: 41 }, ferramentas: { c: 40, r: 49 } };
  function sulco(c, r) {
    const u = Math.abs(c + 0.5 - MEIO);
    if (u >= 8 && u <= 33 && r === Math.round(8 + 1.8 * Math.sin(u / 2.9))) return true;
    if (u >= 5 && u <= 28 && r === Math.round(24 + 1.6 * Math.sin(u / 2.5 + 1))) return true;
    if (r >= 12 && r <= 20 && Math.round(u) === Math.round(21 + 1.5 * Math.sin(r / 2.4))) return true;
    if (u >= 21 && u <= 34 && r === Math.round(37 + 1.2 * Math.sin(u / 2.2))) return true;
    return false;
  }
  const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const tempo = i => { const t = Date.parse(i && i.quando); return Number.isFinite(t) ? t : NaN; };
  const chegada = i => { const t = Date.parse(i && i.primeiroVisto); return Number.isFinite(t) ? t : tempo(i); };

  function dentroEsquerdo(c, r) {
    const x = c + 0.5, y = r + 0.5, cx = 20.5;
    const ang = Math.atan2(y - 22, x - cx), giro = 1 + 0.045 * Math.sin(ang * 13) + 0.02 * Math.sin(ang * 5 + 1);
    const cima = Math.pow(Math.abs(x - cx) / (18.6 * giro), 2.3) + Math.pow(Math.abs(y - 22) / (20.5 * giro), 2.3) <= 1;
    const lobo = ((x - 15.5) / 14.5) ** 2 + ((y - 34) / (10.5 * giro)) ** 2 <= 1;
    return (cima || lobo) && c <= MEIO - 2 && r >= 1;
  }
  function regiaoDe(c, r) {
    const u = Math.abs(c + 0.5 - MEIO), esq = c < MEIO;
    const b1 = 17 + Math.round(1.6 * Math.sin(u / 4.2)), b2 = u < 3 ? 30 : 30 + Math.round(1.4 * Math.sin(u / 3.7 + 1)), meioU = 17 + Math.round(1.5 * Math.sin(r / 2.6));
    if (r >= b2 && u < meioU) return 'ferramentas';
    if (r < b1) return esq ? 'ordens' : 'licoes';
    if (r >= b2) return esq ? 'erros' : 'agentes';
    return esq ? 'regras' : 'skills';
  }
  let cacheGrade = null;
  function grade() {
    if (cacheGrade) return JSON.parse(JSON.stringify(cacheGrade.json));
    const vivo = new Set(), celulas = [];
    const por = (c, r) => { const k = c + ',' + r; if (vivo.has(k) || c < 0 || c >= COLS || r < 0 || r >= ROWS) return; vivo.add(k); celulas.push({ c, r, regiao: regiaoDe(c, r) }); };
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < MEIO - 1; c++) if (dentroEsquerdo(c, r) && !sulco(c, r)) { por(c, r); por(COLS - 1 - c, r); }
    let fundo = 0; for (const k of vivo) fundo = Math.max(fundo, Number(k.split(',')[1]));
    for (let r = 34; r < ROWS - 1; r++) for (let c = MEIO - 4; c < MEIO + 4; c++) if (r <= fundo + 6) por(c, r);
    for (let r = 30; r < ROWS; r++) { const vivos = []; for (let c = 0; c < COLS; c++) if (vivo.has(c + ',' + r)) vivos.push(c); for (let i = 1; i < vivos.length; i++) { const gap = vivos[i] - vivos[i - 1] - 1; if (gap > 0 && gap <= 6) for (let c = vivos[i - 1] + 1; c < vivos[i]; c++) por(c, r); } }
    for (let volta = 0; volta < 2; volta++) for (let i = celulas.length - 1; i >= 0; i--) { const x = celulas[i], viz = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dc, dr]) => vivo.has((x.c + dc) + ',' + (x.r + dr))).length; if (viz < 2) { vivo.delete(x.c + ',' + x.r); celulas.splice(i, 1); } }
    celulas.sort((a, b) => a.r - b.r || a.c - b.c);
    const regioes = {};
    for (const tipo of TIPOS) {
      const cel = celulas.filter(x => x.regiao === tipo), mc = cel.reduce((a, x) => a + x.c, 0) / cel.length, mr = cel.reduce((a, x) => a + x.r, 0) / cel.length;
      const d = x => (x.c - mc) ** 2 + (x.r - mr) ** 2;
      const ordem = cel.slice().sort((a, b) => d(a) - d(b) || a.r - b.r || a.c - b.c);
      regioes[tipo] = { celulas: ordem.map(x => ({ c: x.c, r: x.r })), centro: { c: ordem[0].c, r: ordem[0].r }, meio: { c: mc, r: mr } };
    }
    const json = { cols: COLS, rows: ROWS, celulas, regioes };
    cacheGrade = { json: JSON.parse(JSON.stringify(json)) };
    return json;
  }

  function distribuir(itens, g) {
    const porItem = new Map(), porCelula = new Map();
    for (const tipo of TIPOS) {
      const cel = g.regioes[tipo].celulas, lista = (itens || []).filter(i => i && i.tipo === tipo).slice().sort((a, b) => (chegada(b) || 0) - (chegada(a) || 0) || String(a.id).localeCompare(String(b.id)));
      lista.forEach((it, i) => { const alvo = cel[i % cel.length], k = alvo.c + ',' + alvo.r, cell = porCelula.get(k)?.cell || { c: alvo.c, r: alvo.r, regiao: tipo }; if (!porCelula.has(k)) porCelula.set(k, { cell, itens: [] }); porCelula.get(k).itens.push(it); porItem.set(it.id, cell); });
    }
    return { porItem, porCelula, itensDa: cell => (cell && porCelula.get(cell.c + ',' + cell.r)?.itens) || [] };
  }

  function inicioDoDia(agora) { const d = new Date(agora); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function doPeriodo(itens, periodo, agora = Date.now()) {
    const hoje = inicioDoDia(agora), ini = periodo === 'hoje' ? hoje : periodo === 'semana' ? new Date(hoje).setDate(new Date(hoje).getDate() - 6) : -Infinity;
    return (itens || []).filter(i => { const t = chegada(i); return Number.isFinite(t) && t <= agora && t >= ini; });
  }
  const periodoPadrao = (itens, agora = Date.now()) => doPeriodo(itens, 'hoje', agora).length ? 'hoje' : 'semana';
  function buscar(itens, q) {
    const palavras = fold(q).split(/\s+/).filter(Boolean); if (!palavras.length) return (itens || []).slice();
    return (itens || []).filter(i => { const t = fold([i.titulo, i.frase, i.descricao, i.porque, i.arquivo].filter(Boolean).join(' ')); return palavras.every(p => t.includes(p)); });
  }
  const novosHoje = (itens, agora = Date.now()) => doPeriodo(itens, 'hoje', agora);
  const paraPiscar = (itens, vistos, agora = Date.now()) => novosHoje(itens, agora).filter(i => !vistos.has(i.id));

  function contagem(d, tipo) {
    const c = d && d.contagens && d.contagens[tipo];
    if (!c || c.total === null || c.total === undefined || !Number.isFinite(Number(c.total))) {
      const ids = ((d && d.fontes) || []).filter(f => !f.lida && (f.tipos || []).includes(tipo)).map(f => f.id);
      return { texto: '?', solucao: 'Fonte não lida' + (ids.length ? ' (' + ids.slice(0, 3).join(', ') + ')' : '') + '. Quem resolve: COORDENADOR, conferindo o caminho e rodando a coleta de novo.' };
    }
    return { texto: String(c.total), solucao: null };
  }

  const cacheCam = new Map();
  function caminhoEntre(g, a, b) {
    const dentro = new Set(g.celulas.map(x => x.c + ',' + x.r)), DIR = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const chave = (c, r, d) => (r * g.cols + c) * 4 + d, custo = new Map(), de = new Map(), balde = [[]];
    for (let d = 0; d < 4; d++) { custo.set(chave(a.c, a.r, d), 0); balde[0].push([a.c, a.r, d]); }
    let fim = null;
    for (let k = 0; k < balde.length && !fim; k++) {
      for (const [c, r, d] of balde[k] || []) {
        if (custo.get(chave(c, r, d)) !== k) continue;
        if (c === b.c && r === b.r) { fim = [c, r, d]; break; }
        for (let nd = 0; nd < 4; nd++) {
          const nc = c + DIR[nd][0], nr = r + DIR[nd][1]; if (!dentro.has(nc + ',' + nr)) continue;
          const nk = k + 1 + (nd === d ? 0 : 3), ch = chave(nc, nr, nd);
          if (custo.has(ch) && custo.get(ch) <= nk) continue;
          custo.set(ch, nk); de.set(ch, chave(c, r, d)); (balde[nk] = balde[nk] || []).push([nc, nr, nd]);
        }
      }
    }
    if (!fim) return [];
    const out = []; let ch = chave(fim[0], fim[1], fim[2]);
    while (ch !== undefined) { const cel = Math.floor(ch / 4); out.push({ c: cel % g.cols, r: Math.floor(cel / g.cols) }); ch = de.get(ch); }
    return out.reverse();
  }
  function caminho(g, de, para) {
    const k = de + '>' + para; if (cacheCam.has(k)) return cacheCam.get(k);
    const v = caminhoEntre(g, g.regioes[de].centro, g.regioes[para].centro); cacheCam.set(k, v); return v;
  }
  function entrada(g) { let best = null; for (const x of g.celulas) if (x.regiao === 'ferramentas' && (!best || x.r > best.r || (x.r === best.r && Math.abs(x.c + 0.5 - MEIO) < Math.abs(best.c + 0.5 - MEIO)))) best = x; return { c: best.c, r: best.r }; }
  const caminhoAte = (g, cell) => caminhoEntre(g, entrada(g), cell);

  return Object.freeze({ TIPOS, NOMES, FRASES, SEM_DESCRICAO, fraseDaDica, ROTULO, COLS, ROWS, fold, grade, distribuir, doPeriodo, periodoPadrao, buscar, novosHoje, paraPiscar, contagem, contagemExtra, caminho, caminhoAte, entrada, inicioDoDia });
});
