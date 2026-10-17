/* LIVRO V3: estado local, pedidos e voz. O exemplo nunca envia.
   Texto por nos do DOM. Horas pelo navegador. */
(function (root) {
  'use strict';
  const doc = root.document, html = doc.documentElement;
  const EXEMPLO = /[?&]exemplo=1\b/.test(root.location.search || '');
  const API = '/api/livro-v3' + (EXEMPLO ? '?exemplo=1' : '');
  const NADA = 'Exemplo: nada é enviado. Esta tela é só demonstração.';
  const PERIGO = 'Perigoso: só vale com prova; responda no chat da sessão.';
  const SEM = 'sem leitura';
  const DIGITE = 'Exemplo: escreva e veja o aviso (nada é enviado)';
  const ABAS = [['CLAUDE', 'ORQUESTRADOR', 'voz'], ['IDEIAS', 'IDEIAS', 'ideias'], ['Atendimento', 'ATENDIMENTO', 'recado'], ['Cortes', 'CORTES', 'recado'], ['Loja', 'LOJA', 'recado']];
  const S = { dados: null, erroDados: false, aba: 'CLAUDE', ideiasVistas: false, vozLigada: false, primeira: true, lidoEm: null, proximo: 0, idade: {}, prontoChave: null };
  const RITMO_MS = 30000, DUAS_HORAS = 2 * 3600000;
  const els = {};
  const demonstracao = () => EXEMPLO || !!(S.dados && S.dados.exemplo);
  const abas = () => demonstracao() ? ABAS : [['ORQUESTRADOR', 'ORQUESTRADOR', 'voz'], ...((S.dados && S.dados.recado && S.dados.recado.sessoes) || []).map(x => [x.chave, x.rotulo, 'sessao'])];
  const UUID = '[a-f\\d]{8}-[a-f\\d]{4}-[a-f\\d]{4}-[a-f\\d]{4}-[a-f\\d]{12}';
  const LINK = new RegExp('^(?:claude://claude\\.ai/epitaxy/local_' + UUID + '|codex://threads/' + UUID + ')$', 'i');
  const COMANDO = new RegExp('^claude --resume ' + UUID + '$', 'i');
  const linkValido = v => typeof v === 'string' && LINK.test(v);
  const comandoValido = v => typeof v === 'string' && COMANDO.test(v);

  // ---------- utilidades ----------
  function h(tag, cls, ...kids) {
    const n = doc.createElement(tag); if (cls) n.className = cls;
    for (const k of kids) { if (k === null || k === undefined || k === false) continue; n.append(k.nodeType ? k : String(k)); }
    return n;
  }
  function btn(cls, texto, fn, titulo) { const b = h('button', cls, texto); b.type = 'button'; if (titulo) b.title = titulo; if (fn) b.addEventListener('click', fn); return b; }
  const SVGNS = 'http://www.w3.org/2000/svg';
  function sv(tag, at) { const n = doc.createElementNS(SVGNS, tag); for (const k in at) n.setAttribute(k, at[k]); return n; }
  const val = v => (v === null || v === undefined || v === '' ? SEM : String(v));
  async function getJSON(url, ms = 15000) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
    try { const r = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' }, signal: c.signal }); if (!r.ok) throw Error(String(r.status)); return await r.json(); }
    finally { clearTimeout(t); }
  }
  const dois = n => String(n).padStart(2, '0');
  const hora = ms => { if (!Number.isFinite(ms)) return SEM; const x = new Date(ms); return dois(x.getHours()) + ':' + dois(x.getMinutes()); };
  function haMin(m) { if (!Number.isFinite(m)) return SEM; if (m < 1) return 'agora'; if (m < 60) return 'há ' + m + ' min'; const hr = Math.round(m / 60); return hr < 48 ? 'há ' + hr + ' h' : 'há ' + Math.round(hr / 24) + ' dias'; }
  const haTxt = ms => (Number.isFinite(ms) ? haMin(Math.max(0, Math.round((Date.now() - ms) / 60000))) : SEM);
  function haCurto(ms) { if (!Number.isFinite(ms)) return SEM; const m = Math.max(0, Math.round((Date.now() - ms) / 60000)); return m < 1 ? 'agora' : m < 60 ? 'há ' + m + ' min' : m < 2880 ? 'há ' + Math.round(m / 60) + ' h' : 'há ' + Math.round(m / 1440) + ' d'; }
  function emCurto(ms) { if (!Number.isFinite(ms)) return SEM; const m = Math.max(0, Math.round((ms - Date.now()) / 60000)); return m < 1 ? 'agora' : m < 60 ? 'em ' + m + ' min' : m < 2880 ? 'em ' + Math.round(m / 60) + ' h' : 'em ' + Math.round(m / 1440) + ' d'; }
  const ativa = () => html.dataset.theme === 'livro' && html.dataset.gNew === 'agora' && html.dataset.lv3 !== 'antes';
  function guardar(k, v) { try { root.localStorage.setItem(k, v); } catch { /* so nesta visita */ } }
  function lerGuardado(k) { try { return root.localStorage.getItem(k); } catch { return null; } }
  // o dado que vale para pintar: nenhum quando a leitura falhou ou veio fechada (celula sem dado nunca mostra numero velho)
  const dado = () => (S.erroDados || !S.dados || S.dados.fechado ? null : S.dados);

  // ---------- esqueleto (montado 1 vez; cada leitura so troca o miolo das listas) ----------
  function bloco(nome, cls, titulo, extra) {
    const b = h('section', 'lv3-bloco ' + (cls || '')); b.dataset.lv3Bloco = nome;
    const sec = h('div', 'lv3-sec'); if (titulo) sec.append(...titulo); if (extra) sec.append(extra);
    b.append(sec); return { b, sec };
  }
  function anel() {
    const b = h('button', 'lv3-anel'); b.type = 'button'; b.dataset.lv3Bloco = 'anel'; b.dataset.estado = 'parado';
    b.setAttribute('aria-label', 'Falar'); b.title = EXEMPLO ? NADA : 'Clique para falar. Clique de novo para revisar.';
    // camadas: a de baixo fica parada (trilho, 36 LEDs apagados e o miolo); os 2 arcos e a varredura dos LEDs giram em camadas
    // HTML proprias (o compositor gira a camada pronta). A varredura anda em 36 passos de 10 graus: cada passo cai em cima de um LED.
    const svg = () => sv('svg', { viewBox: '0 0 200 200', 'aria-hidden': 'true' });
    const led = (i, cls, op) => { const a = i / 36 * Math.PI * 2 - Math.PI / 2; const c = sv('circle', { class: cls, cx: (100 + 78 * Math.cos(a)).toFixed(2), cy: (100 + 78 * Math.sin(a)).toFixed(2), r: 2.4 }); if (op !== undefined) c.setAttribute('opacity', op.toFixed(2)); return c; };
    const base = svg(); base.append(sv('circle', { class: 'a-trilho', cx: 100, cy: 100, r: 96 }));
    for (let i = 0; i < 36; i++) base.append(led(i, 'a-led'));
    base.append(sv('circle', { class: 'a-miolo', cx: 100, cy: 100, r: 54 }));
    const camada = (cls, ...filhos) => { const c = h('span', 'a-camada ' + cls), s = svg(); s.append(...filhos); c.append(s); return c; };
    const varre = []; for (let k = 0; k < 12; k++) varre.push(led(36 - k, 'a-led-on', 1 - k / 12)); // cabeca acesa e a cauda apagando
    const g2 = camada('a-gira2', sv('circle', { class: 'a-arco2', cx: 100, cy: 100, r: 88 })), g1 = camada('a-gira1', sv('circle', { class: 'a-arco', cx: 100, cy: 100, r: 66 })), gv = camada('a-varre', ...varre);
    b.append(base, g2, gv, g1, h('span', 'lv3-falar', h('i', ''), h('b', '', 'FALAR'), h('span', '', 'exemplo')));
    // O exemplo apenas acende o anel.
    b.addEventListener('click', () => {
      if (!demonstracao()) {
        if (!S.config || !S.config.recursos || !S.config.recursos.voz) { aviso('Ligue Voz em Recursos pessoais', 'erro'); return; }
        const voz = root.PainelVoz;
        if (!voz || !voz.startHold || !voz.endHold) { aviso('Voz sem leitura. Atualize o painel.', 'erro'); return; }
        if (b.dataset.estado === 'ouvindo') { voz.endHold(); b.dataset.estado = 'parado'; els.vozSt.textContent = 'Confira a fala na caixa de voz.'; }
        else if (voz.startHold()) { b.dataset.estado = 'ouvindo'; els.vozSt.textContent = 'Ouvindo. Clique para revisar.'; }
        else aviso('Abra a caixa de voz e confira o microfone.', 'erro');
        return;
      }
      if (b.dataset.estado === 'ouvindo') return;
      b.dataset.estado = 'ouvindo'; els.vozSt.textContent = 'Ouvindo... (exemplo)'; els.convLed.className = 'lv3-led is-rosa';
      aviso(NADA, 'erro');
      setTimeout(() => { b.dataset.estado = 'parado'; els.vozSt.textContent = 'Pronto para falar.'; els.convLed.className = 'lv3-led' + (S.vozLigada ? ' is-vivo' : ''); }, 2000);
    });
    return b;
  }
  function gauge(cls, rot) { const g = h('div', 'lv3-gg ' + cls), r = h('span', '', rot), v = h('b', '', 'lendo'), n = h('small', '', 'lendo...'); g.append(r, v, n); return { g, r, v, n }; }

  function montar() {
    const main = doc.querySelector('main'), agora = doc.getElementById('g-agora'); if (!main || !agora || doc.getElementById('lv3')) return !!doc.getElementById('lv3');
    const lv = h('section', 'lv3'); lv.id = 'lv3'; lv.setAttribute('aria-label', 'Agora, tela V3'); lv.dataset.dsOwned = 'livro';
    // topo: contadores, lido ha e Fluxo na 2a tela
    const topo = h('div', 'lv3-topo');
    const cont = (cls, rot) => { const b = h('b', '', '...'); const c = h('span', 'lv3-cont ' + cls, b, rot); topo.append(c); return b; };
    els.seus = cont('is-seus', 'seus'); els.frentesN = cont('', 'frentes'); els.cardsN = cont('', 'cards');
    // PRONTO HOJE: as tags do que fechou hoje, na linha do topo; o que nao cabe vira "+N" e a lista inteira fica no balao
    els.prontoN = h('b', '', '...');
    els.pronto = h('div', 'lv3-pronto', h('span', 'lv3-pronto-rot', h('i', 'lv3-led is-ok'), 'PRONTO HOJE ', els.prontoN), els.prontoTags = h('span', 'lv3-pronto-tags'));
    els.pronto.dataset.lv3Bloco = 'pronto'; topo.append(els.pronto);
    els.lido = h('span', 'lv3-lido', 'lendo...'); topo.append(els.lido);
    const fluxo = h('a', 'g-btn is-quieto', 'FLUXO · 2ª TELA ↗'); fluxo.href = (root.location.pathname || '/') + (root.location.search || '') + '#g=equipe.fluxo&tela=cheia'; fluxo.target = '_blank'; fluxo.rel = 'noopener'; fluxo.title = 'Abre só o Fluxo, sem menu, numa janela nova para deixar na segunda tela'; fluxo.dataset.lv3Bloco = 'fluxo';
    topo.append(h('span', 'lv3-acoes', fluxo));

    // coluna da esquerda: VOCE RESOLVE e o aviso das ideias
    const voce = bloco('voce', 'is-acao', [h('i', 'lv3-led is-rosa'), 'VOCÊ RESOLVE'], els.voceDir = h('span', 'lv3-dir', 'só o que espera você'));
    els.voce = h('div', 'lv3-lista'); voce.b.append(els.voce); els.voceB = voce.b;
    const ideias = bloco('ideias', 'lv3-ideias', [els.novo = h('span', 'lv3-novo is-zero', 'lendo'), 'IDEIAS'], els.ideiasDir = h('span', 'lv3-dir', 'lendo...'));
    els.ideias = h('ul', ''); const abrir = btn('g-btn is-quieto', 'ABRIR IDEIAS ↗', () => { S.ideiasVistas = true; root.location.hash = '#g=decidir.ideias'; });
    const visto = btn('lv3-op', 'VISTO', () => { S.ideiasVistas = true; pintarIdeias(); }, 'Marca as ideias de agora como vistas nesta visita');
    ideias.b.append(els.ideias, h('div', 'lv3-ops', abrir, visto)); els.ideiasB = ideias.b;
    const esq = h('div', 'lv3-col is-esq', voce.b, ideias.b);

    // centro: anel FALAR, voz e medidores; conversa com o Claude, as ideias e recado por sessao
    const nucleo = h('section', 'lv3-bloco lv3-nucleo'); nucleo.dataset.lv3Bloco = 'nucleo';
    els.vozSt = h('span', 'lv3-vozst', 'Pronto para falar.');
    els.convLed = h('i', 'lv3-led');
    els.anel = anel();
    const liga = btn('g-btn is-quieto', 'LIGAR VOZ', () => { if (!demonstracao()) { if (!S.config?.recursos?.voz) aviso('Ligue Voz em Recursos pessoais', 'erro'); else doc.getElementById('voz-conversa')?.click(); return; } S.vozLigada = !S.vozLigada; liga.textContent = S.vozLigada ? 'DESLIGAR VOZ' : 'LIGAR VOZ'; els.convLed.className = 'lv3-led' + (S.vozLigada ? ' is-vivo' : ''); aviso(NADA, 'erro'); }, 'Abrir voz');
    const conv = btn('g-btn is-quieto', 'CONVERSA', () => { trocarAba(demonstracao() ? 'CLAUDE' : 'ORQUESTRADOR'); els.input.focus(); }, 'Vai para a conversa');
    els.liga = liga;
    const g1 = gauge('is-ajud', ''), g2 = gauge('', 'PRONTO HOJE'), g3 = gauge('is-ideia', 'IDEIAS · NOVAS HOJE'), g4 = gauge('', 'CONTA ATUAL');
    els.ajudLed = h('i', 'lv3-led'); g1.r.append(els.ajudLed, 'AJUDANTES · AGORA'); g1.g.dataset.lv3Bloco = 'ajudantes';
    Object.assign(els, { gAjud: g1, gPronto: g2, gIdeia: g3, gConta: g4 });
    const lado = h('div', 'lv3-lado', h('div', 'lv3-voz', liga, conv, els.vozSt), h('div', 'lv3-gauges', g1.g, g2.g, g3.g, g4.g));
    nucleo.append(els.anel, lado);
    const conversa = bloco('conversa', 'lv3-conversa', [els.convLed, 'CONVERSA'], els.convDir = h('span', 'lv3-dir', 'lendo...'));
    els.conv = h('div', 'lv3-lista'); els.conv.setAttribute('role', 'log'); els.conv.setAttribute('aria-live', 'polite');
    const tabs = h('div', 'lv3-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Para quem'); tabs.dataset.lv3Bloco = 'recado';
    // cada aba com a cor de quem responde: Claude, as ideias e as sessoes (a cor fica na variavel --ia do CSS)
    els.tabBox = tabs;
    els.input = h('input', ''); els.input.type = 'text'; els.input.maxLength = 1000; els.input.setAttribute('aria-label', 'Escrever');
    els.input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); enviar(); } });
    els.enviar = btn('g-btn', 'ENVIAR', enviar);
    els.aviso = h('p', 'lv3-aviso', '');
    conversa.b.append(els.conv, tabs, h('div', 'lv3-entrada', els.input, els.enviar), els.aviso); els.convB = conversa.b;
    const cen = h('div', 'lv3-col is-cen', nucleo, conversa.b);

    // Feed e monitores.
    const feed = bloco('feed', '', [els.feedLed = h('i', 'lv3-led'), 'FEED'], els.feedDir = h('span', 'lv3-dir', 'lendo...'));
    els.feed = h('div', 'lv3-lista'); feed.b.append(els.feed); els.feedB = feed.b;
    const au = bloco('automacao', 'lv3-automacao', [els.auLed = h('i', 'lv3-led'), 'MONITORES'], els.auDir = h('span', 'lv3-dir', 'lendo...'));
    els.monitores = h('div', 'lv3-lista lv3-monitores'); au.b.append(els.monitores);
    els.auB = au.b;
    const codex = h('section', 'lv3-breve'); codex.dataset.lv3Bloco = 'codex';
    codex.append(h('div', 'lv3-sec', h('i', 'lv3-led'), 'CODEX', h('span', 'lv3-breve-p', 'No exemplo, o Codex aparece no feed quando revisa algo.'), h('span', 'lv3-dir', h('span', 'lv3-tag', 'EXEMPLO'))));
    els.codexNota = codex;
    const dir = h('div', 'lv3-col is-dir', feed.b, au.b, codex);

    // doca: frentes, entregas (com a Fila), esta semana, contas e projetos; cada uma com LED da leitura, quantos e a idade do dado
    const cab = (nome, rot) => { const led = h('i', 'lv3-led'), n = h('b', 'lv3-n', ''); els['led_' + nome] = led; els['n_' + nome] = n; return [led, rot, n]; };
    const fr = bloco('frentes', '', cab('frentes', 'FRENTES'), els.frDir = h('span', 'lv3-dir', 'lendo...'));
    els.frentes = h('div', 'lv3-lista'); fr.b.append(els.frentes); els.frB = fr.b;
    const fila = h('a', 'lv3-link lv3-fila', 'Fila ↗'); fila.href = '#g=fila.fila'; fila.title = 'Abre a aba Fila com todas as entregas';
    const en = bloco('entregas', '', cab('entregas', 'ENTREGAS'), els.enDir = h('span', 'lv3-dir', 'lendo...'));
    els.entregas = h('div', 'lv3-lista'); en.b.append(h('div', 'lv3-sub lv3-sub-fila', h('span', '', 'MAIS PERTO DE SAIR'), fila), els.entregas); els.enB = en.b;
    const se = bloco('semana', '', cab('semana', 'ESTA SEMANA'), els.seDir = h('span', 'lv3-dir', 'lendo...'));
    els.semana = h('div', 'lv3-lista'); els.seDatas = h('div', 'lv3-sub', '...'); se.b.append(els.seDatas, els.semana); els.seB = se.b;
    const co = bloco('contas', '', cab('contas', 'CONTAS'), els.coDir = h('span', 'lv3-dir', 'lendo...'));
    els.contas = h('div', 'lv3-lista lv3-cns'); co.b.append(els.contas); els.coB = co.b;
    const pj = bloco('projetos', '', cab('projetos', 'PROJETOS'), els.pjDir = h('span', 'lv3-dir', 'lendo...'));
    els.projetos = h('div', 'lv3-lista lv3-pjs'); pj.b.append(els.projetos); els.pjB = pj.b;
    pj.b.title = '1 LED = 1 item · verde no ar, rosa com você, roxo em obra, apagado na fila';

    lv.append(topo, h('div', 'lv3-meio', esq, cen, dir), h('div', 'lv3-doca', fr.b, en.b, se.b, co.b, pj.b));
    agora.before(lv); els.lv = lv;
    // botao no menu das vistas: troca entre a V3 e a Agora de antes (fica guardado neste navegador)
    if (lerGuardado('lv3-modo') === 'antes') html.dataset.lv3 = 'antes';
    els.troca = btn('', '', () => { if (html.dataset.lv3 === 'antes') delete html.dataset.lv3; else html.dataset.lv3 = 'antes'; guardar('lv3-modo', html.dataset.lv3 === 'antes' ? 'antes' : 'v3'); pintarTroca(); medir(); if (ativa()) lerDados(); });
    els.troca.id = 'lv3-troca'; pintarTroca(); acoplarTroca();
    trocarAba(S.aba, true);
    return true;
  }
  function pintarTroca() { if (!els.troca) return; const antes = html.dataset.lv3 === 'antes'; els.troca.textContent = antes ? 'Tela V3' : 'Agora de antes'; els.troca.title = antes ? 'Volta para a tela V3 (anel FALAR no centro)' : 'Mostra a Agora de sempre'; }
  function acoplarTroca() {
    const sub = doc.getElementById('g-subnav'); if (!sub || !els.troca) return;
    if (els.troca.parentElement !== sub) sub.append(els.troca);
    if (!S.obsSub) { S.obsSub = new MutationObserver(() => { if (els.troca.parentElement !== sub) sub.append(els.troca); }); S.obsSub.observe(sub, { childList: true }); }
    // o placar do dia do LIVRO fica embaixo da V3: a altura dele sai da conta (ele pode montar depois desta tela)
    const pl = doc.getElementById('lv-placar'); if (S.ro && pl && !S.roPlacar) { S.ro.observe(pl); S.roPlacar = true; }
  }

  // altura fixa pela janela: o bloco nunca cresce com o dado; so muda quando a janela muda de tamanho
  function medir() {
    if (!els.lv || !ativa()) return;
    const top = els.lv.getBoundingClientRect().top + root.scrollY, dock = doc.getElementById('g-dock'), base = dock ? dock.getBoundingClientRect().height : 0;
    const alt = Math.max(560, Math.floor(root.innerHeight - top - base - 12));
    html.style.setProperty('--lv3-h', alt + 'px');
    // a doca, o anel e o aviso das ideias crescem um pouco nas telas altas (1920x1080), sempre pelo mesmo calculo
    const folga = Math.max(0, alt - 640);
    html.style.setProperty('--lv3-doca', Math.round(150 + Math.min(70, folga * 0.3)) + 'px');
    html.style.setProperty('--lv3-nucleo', Math.round(168 + Math.min(40, folga * 0.2)) + 'px');
    // o anel cresce com a altura, mas nunca passa de 34% da largura do centro (os medidores ao lado nao cortam o titulo)
    const cen = els.anel && els.anel.parentElement ? els.anel.parentElement.getBoundingClientRect().width : 0, anelAlt = Math.round(156 + Math.min(40, folga * 0.2));
    html.style.setProperty('--lv3-anel', (cen ? Math.min(anelAlt, Math.max(150, Math.round(cen * 0.34))) : anelAlt) + 'px');
    html.style.setProperty('--lv3-ideias', Math.round(112 + Math.min(30, folga * 0.15)) + 'px');
    html.style.setProperty('--lv3-auto', Math.round(122 + Math.min(24, folga * 0.1)) + 'px');
    // o que a pagina ainda rolar (o placar embaixo e a margem da casca do painel) sai da altura, 1 vez por medida
    const sobra = doc.documentElement.scrollHeight - root.innerHeight;
    if (sobra > 0) html.style.setProperty('--lv3-h', Math.max(560, alt - sobra) + 'px');
    if (els.conv) els.conv.scrollTop = els.conv.scrollHeight;
    if (S.prontoChave) { S.prontoChave = null; pintarPronto(); } // a largura mudou: as tags cabem de novo
    ajustarListas(); // a altura das listas da doca mudou: as linhas que cabem inteiras sao outras
  }
  // listas da doca em linhas inteiras: o que nao cabe sai e vira "+N frentes" / "+N itens" (nunca uma linha cortada pela borda da lista)
  function caber(lista, linha, un) {
    if (!lista) return;
    for (const m of lista.querySelectorAll('.lv3-mais')) m.remove();
    const rows = [...lista.querySelectorAll(linha)]; for (const r of rows) r.hidden = false;
    if (!rows.length || !lista.clientHeight || lista.scrollHeight <= lista.clientHeight + 1) return;
    const mais = h('p', 'lv3-mais', ''); lista.append(mais);
    for (let n = 1; n <= rows.length; n++) {
      rows[rows.length - n].hidden = true; mais.textContent = '+' + n + ' ' + (n === 1 ? un[0] : un[1]);
      if (lista.scrollHeight <= lista.clientHeight + 1) break;
    }
  }
  function ajustarListas() { if (!els.lv || !ativa()) return; caber(els.frentes, '.lv3-fr', ['frente', 'frentes']); caber(els.semana, '.lv3-sm', ['item', 'itens']); }

  // ---------- pintura ----------
  function vazio(texto, marca) { return h('p', 'lv3-vazio', marca ? h('b', '', marca) : null, texto); }
  function tick(el, v) { const s = val(v); if (el.textContent !== s) { el.textContent = s; el.classList.remove('is-tick'); void el.offsetWidth; el.classList.add('is-tick'); } }
  // o placar do dia (blocos-livro) fica embaixo da V3 so quando tem leitura: sem ela ele mostraria marcas soltas no lugar dos numeros
  function marcarPlacar() {
    let lido = false;
    try { const b = root.PainelBlocosLivro; lido = !!(b && typeof b.estado === 'function' && b.estado().dias); } catch { lido = false; }
    if (lido) delete html.dataset.lv3Placar; else if (html.dataset.lv3Placar !== 'sem') html.dataset.lv3Placar = 'sem';
  }
  function pintarTopo() {
    marcarPlacar();
    const d = dado(), t = d && d.topo ? d.topo : {};
    tick(els.seus, t.seus); tick(els.frentesN, t.frentes); tick(els.cardsN, t.cards);
    els.lido.classList.toggle('is-erro', !!S.erroDados || !!(d && d.erros && d.erros.length));
    els.lido.textContent = S.erroDados ? 'leitura falhou · tenta de novo em 30 s' : !S.dados ? 'lendo...' : S.dados.fechado ? 'esta tela mostra só o exemplo' : (d.exemplo ? 'EXEMPLO · ' : '') + 'lido ' + haTxt(d.geradoMs) + ' · atualiza sozinho a cada 30 s';
  }
  // devolve true quando a lista ja foi preenchida com o aviso (falhou, lendo ou fechado)
  function semDado(lista, bloco) {
    const d = S.dados;
    bloco.classList.toggle('is-erro', !!S.erroDados);
    if (S.erroDados) { lista.replaceChildren(vazio('Leitura falhou. O painel tenta de novo em meio minuto.')); return true; }
    if (!d) { lista.replaceChildren(vazio('Lendo...')); return true; }
    if (d.fechado) { lista.replaceChildren(vazio(d.falta || 'Esta tela mostra só o exemplo. Para os seus dados, use Agora de antes no menu.')); return true; }
    const nome = bloco.dataset.lv3Bloco, b = nome === 'voce' ? d.voceResolve : nome === 'projetos' || nome === 'entregas' ? d.doca && d.doca[nome] : d[nome];
    if (b && b.erro && b.solucao && (!b.itens || !b.itens.length)) { lista.replaceChildren(vazio(SEM + ' · ' + b.solucao, '?')); return true; }
    return false;
  }
  function pintarVoce() {
    if (semDado(els.voce, els.voceB)) { els.voceDir.textContent = SEM; return; }
    const v = S.dados.voceResolve || { itens: [] };
    els.voceB.classList.toggle('is-erro', !!v.erro);
    els.voceDir.textContent = v.erro ? v.erro : 'só o que espera você · ' + v.itens.length;
    if (!v.itens.length) { els.voce.replaceChildren(vazio(v.erro ? 'Leitura falhou: ' + v.erro : 'Nada espera você agora.', v.erro ? null : 'none')); return; }
    els.voce.replaceChildren(...v.itens.map(itemVoce));
    if (v.erro && v.solucao) els.voce.append(vazio(SEM + ' · ' + v.solucao, '?'));
  }
  function itemVoce(it) {
    const card = it.tipo === 'card', perigo = it.perigoso === true;
    const tag = h('span', 'lv3-tag ' + (perigo ? 'is-perigo' : card ? 'is-card' : 'is-passo'), perigo ? 'PERIGOSO' : card ? 'DECISÃO' : 'SEU PASSO');
    const det = perigo ? String(it.detalhe || '').split(' · ').filter(x => !/^perigoso\b/i.test(x)).join(' · ') : it.detalhe; // a frase do perigoso sai so na nota
    const row = h('article', 'lv3-item', h('div', 'lv3-hd', tag, h('span', '', val(det))), h('p', 'lv3-q', val(it.titulo)));
    row.title = it.titulo || '';
    if (card && !perigo && it.modo === 'opcoes') {
      const ops = h('div', 'lv3-ops');
      for (const o of it.opcoes || []) ops.append(btn('lv3-op' + (o.recomendada ? ' is-rec' : ''), (o.recomendada ? '★ ' : '') + o.rotulo, () => responder(it, o, row, ops), o.recomendada ? 'Recomendada' : ''));
      row.append(ops);
    } else if (card && (perigo || it.modo === 'chat')) {
      row.append(h('p', 'lv3-nota' + (perigo ? ' is-perigo' : ''), perigo ? PERIGO : 'Detalhe no chat da sessão.'));
    }
    if (!card && it.semBloco) row.append(h('p', 'lv3-nota', it.semBloco));
    if (linkValido(it.linkSessao)) { const a = h('a', 'lv3-op', 'ABRIR SESSÃO ↗'); a.href = it.linkSessao; if (demonstracao()) a.addEventListener('click', e => { e.preventDefault(); aviso('Exemplo: na sua máquina este botão abre a sessão no app.', 'ok'); }); row.append(a); }
    else if (comandoValido(it.comandoRetomar)) { const b = btn('lv3-op', 'COPIAR COMANDO', async () => { try { await root.navigator.clipboard.writeText(it.comandoRetomar); b.textContent = 'copiado'; } catch { aviso('Não consegui copiar. Tente de novo.', 'erro'); } }); row.append(b); }
    return row;
  }
  // Resposta pela rota dos cards; exemplo apenas avisa.
  async function responder(it, o, row, ops) {
    if (it.perigoso || S.respondendo) return;
    if (!demonstracao()) {
      S.respondendo = true;
      try {
        const c = await getJSON('/api/pc-cards/lista');
        if (!c.ok || !c.token) throw Error();
        await postJSON('/api/pc-cards/responder', { arquivo: it.arquivo, versao: it.versao, opcao: o.indice }, 'x-pc-cards-token', c.token);
        ops.replaceWith(h('p', 'lv3-nota is-ok', 'Resposta registrada.')); aviso('Resposta registrada.', 'ok');
      } catch { aviso('Não consegui responder. Atualize os cards e tente de novo.', 'erro'); }
      finally { S.respondendo = false; }
      return;
    }
    row.classList.add('is-saindo');
    ops.replaceWith(h('p', 'lv3-nota is-ok', 'Escolhida: ' + o.rotulo + '. ' + NADA));
    aviso(NADA, 'ok');
  }
  function pintarFeed() {
    if (semDado(els.feed, els.feedB)) { els.feedDir.textContent = SEM; els.feedLed.className = 'lv3-led'; return; }
    const f = S.dados.feed || { itens: [] };
    els.feedB.classList.toggle('is-erro', !!f.erro);
    els.feedLed.className = 'lv3-led ' + (f.erro ? 'is-erro' : f.itens.length ? 'is-vivo' : '');
    els.feedDir.textContent = f.erro || f.nota || 'ao vivo';
    if (!f.itens.length) { els.feed.replaceChildren(vazio(f.erro ? 'Leitura falhou: ' + f.erro : 'Nenhuma atividade ainda.', f.erro ? null : 'none')); return; }
    els.feed.replaceChildren(...f.itens.map(x => h('div', 'lv3-fd', h('span', 'h', hora(x.ms)), h('span', 'w' + (x.quem === 'CODEX' ? ' is-outro' : ''), val(x.quem)), h('p', '', val(x.texto)))));
  }
  function pintarAjudantes() {
    const g = els.gAjud, d = dado();
    if (!d) { g.v.textContent = SEM; g.n.textContent = S.dados && S.dados.fechado ? 'só no exemplo' : SEM; els.ajudLed.className = 'lv3-led'; return; }
    const b = d.ajudantes || {};
    g.v.textContent = val(b.agora);
    g.n.textContent = b.erro ? b.erro + (b.solucao ? ' · ' + b.solucao : '') : val(b.nota) + ' · lido ' + (Number.isFinite(b.lidoHaS) ? 'há ' + b.lidoHaS + ' s' : SEM);
    els.ajudLed.className = 'lv3-led ' + (b.erro ? 'is-erro' : Number.isFinite(b.lidoHaS) && b.lidoHaS < 180 ? 'is-vivo' : '');
  }
  // Monitor ausente tem orientacao de configuracao. Caido primeiro, depois sem leitura, depois ok (a lista rola dentro do bloco).
  function pintarAutomacao() {
    const m = S.erroDados ? null : S.monitores, peso = x => x && x.status === 'caiu' ? 0 : x && x.status === 'ok' ? 2 : 1;
    const rows = m && m.ok && m.configurado && Array.isArray(m.monitores) ? m.monitores.map((x, i) => [x, i]).sort((a, b) => peso(a[0]) - peso(b[0]) || a[1] - b[1]).map(p => p[0]) : [];
    els.monitores.replaceChildren(...(rows.length ? rows.map(x => {
      const estado = ['ok', 'caiu'].includes(x.status) ? x.status : 'sem leitura';
      const desde = typeof x.desde === 'number' ? x.desde : Date.parse(x.desde || '');
      const lido = typeof x.lidoEm === 'number' ? x.lidoEm : Date.parse(x.lidoEm || '');
      const quando = estado === 'caiu' ? (Number.isFinite(desde) ? 'caiu ' + haTxt(desde) : 'caiu') : estado === 'ok' ? 'ok' + (Number.isFinite(lido) ? ' · lido ' + haCurto(lido) : '') : Number.isFinite(lido) ? '? · lido ' + haCurto(lido) : 'sem leitura';
      return h('div', 'lv3-monitor', h('i', 'lv3-led' + (estado === 'ok' ? ' is-ok' : estado === 'caiu' ? ' is-erro' : '')), h('b', '', x.nome), h('span', '', quando), x.motivo ? h('small', '', x.motivo) : null);
    }) : m && m.ok ? [vazio('Nenhum monitor configurado', 'none'), h('p', 'lv3-nota', 'Veja Monitores no README.')] : [vazio('sem leitura · Atualize o painel.', '?')]));
    els.auDir.textContent = demonstracao() ? 'exemplo' : 'local';
    els.auLed.className = 'lv3-led' + (rows.length ? rows.some(x => x.status === 'caiu') ? ' is-erro' : ' is-ok' : '');
  }
  // PRONTO HOJE: as tags no topo; o que nao cabe na linha vira "+N" e a lista inteira fica no balao
  function pintarPronto() {
    const d = dado(), p = d ? d.prontoHoje || { itens: [] } : null;
    const itens = p && !p.erro && Array.isArray(p.itens) ? p.itens : [];
    els.prontoN.textContent = !p || p.erro ? SEM : String(itens.length);
    const chave = JSON.stringify([itens, p ? p.erro || p.nota || '' : S.dados && S.dados.fechado ? 'fechado' : SEM]);
    if (chave === S.prontoChave) return;
    S.prontoChave = chave;
    els.pronto.title = itens.length ? itens.map(x => '✓ ' + x).join('\n') : '';
    if (!itens.length) { els.prontoTags.replaceChildren(h('span', 'lv3-pronto-v', !p ? (S.dados && S.dados.fechado ? 'só no exemplo' : SEM) : p.erro ? p.erro + (p.solucao ? ' · ' + p.solucao : '') : p.nota || 'none')); return; }
    const chips = itens.map(x => { const c = h('span', 'lv3-chip', '✓ ' + x); c.title = x; return c; }), mais = h('span', 'lv3-chip is-mais', '');
    mais.hidden = true; els.prontoTags.replaceChildren(...chips, mais);
    if (!ativa()) { S.prontoChave = null; return; } // escondida nao mede: mede de novo quando a V3 aparecer
    const fim = () => els.prontoTags.getBoundingClientRect().right + 1;
    if (chips[chips.length - 1].getBoundingClientRect().right <= fim()) return;
    mais.hidden = false;
    for (let n = 1; n <= chips.length; n++) {
      chips[chips.length - n].hidden = true; mais.textContent = '+' + n; mais.title = itens.slice(itens.length - n).join('\n');
      if (mais.getBoundingClientRect().right <= fim()) break;
    }
  }
  // cabecalho de cada bloco da doca: LED da leitura (verde lida, cinza sem leitura, vermelho falhou), quantos e a idade do dado
  function cabeca(nome, estado, n) {
    const led = 'lv3-led' + (estado === 'ok' ? ' is-ok' : estado === 'erro' ? ' is-erro' : ''), b = els['n_' + nome];
    if (els['led_' + nome].className !== led) els['led_' + nome].className = led;
    const s = n === null || n === undefined ? '' : String(n); if (b.textContent !== s) b.textContent = s;
  }
  function idade(nome, ms, titulo, velho) { S.idade[nome] = Number.isFinite(ms) ? { ms, titulo, velho: !!velho } : { txt: SEM }; }
  function pintarIdades() {
    for (const [nome, el] of [['frentes', els.frDir], ['entregas', els.enDir], ['semana', els.seDir], ['contas', els.coDir], ['projetos', els.pjDir]]) {
      const x = S.idade[nome] || { txt: SEM }, txt = x.txt || haCurto(x.ms);
      if (el.textContent !== txt) { el.textContent = txt; el.title = x.txt ? '' : (x.titulo || 'Idade do dado') + ': ' + hora(x.ms); }
      el.classList.toggle('is-velho', !!x.velho);
    }
  }
  function linhaFrente(x) {
    const pct = Number.isFinite(x.pct) ? Math.max(0, Math.min(100, x.pct)) : null, barra = h('span', 'lv3-barra', h('i', ''));
    barra.querySelector('i').style.width = (pct === null ? 0 : pct) + '%';
    const r = h('div', 'lv3-fr' + (x.atencao ? ' is-atencao' : ''), h('span', 'nm', val(x.nome)), h('span', 'pc', pct === null ? SEM : pct + '%'), barra, h('span', 'ft', val(x.faltam)));
    r.title = x.nomeInteiro || x.nome || ''; return r;
  }
  function pintarDoca() {
    // FRENTES: o nome inteiro em ate 2 linhas; quantas, LED e a idade do dado no cabecalho
    const d = dado(), f = d ? d.frentes || { itens: [] } : null, itens = f ? f.itens : [];
    if (!f) { cabeca('frentes', S.erroDados ? 'erro' : '', null); idade('frentes', NaN); }
    else { cabeca('frentes', f.erro ? 'erro' : 'ok', f.erro ? null : itens.length); if (f.erro) S.idade.frentes = { txt: f.erro }; else idade('frentes', Number.isFinite(f.dadoHaMin) ? (S.lidoEm || Date.now()) - f.dadoHaMin * 60000 : NaN, 'Idade do dado', f.dadoHaMin > 120); }
    if (!semDado(els.frentes, els.frB)) {
      els.frB.classList.toggle('is-erro', !!f.erro);
      els.frentes.replaceChildren(...(itens.length ? itens.map(linhaFrente) : [vazio(f.erro ? 'Leitura falhou: ' + f.erro : 'Nenhuma frente aberta.', f.erro ? null : 'none')]));
      caber(els.frentes, '.lv3-fr', ['frente', 'frentes']);
    }
    // PRONTO HOJE: as tags no topo e o medidor do centro (a lista do dia fica no balao dos dois)
    pintarPronto();
    const p = d ? d.prontoHoje || { itens: [] } : null, g = els.gPronto;
    if (!p) { g.v.textContent = SEM; g.n.textContent = S.dados && S.dados.fechado ? 'só no exemplo' : SEM; g.g.title = ''; }
    else { g.v.textContent = p.erro ? SEM : String(p.itens.length); g.n.textContent = p.erro ? p.erro + (p.solucao ? ' · ' + p.solucao : '') : p.itens.length ? 'entregas fechadas hoje' : (p.nota || 'none'); g.g.title = p.itens.join('\n'); }
    pintarEntregas(); pintarProjetos(); pintarIdades();
  }
  // ENTREGAS: as mais perto de sair e a primeira que espera voce
  function pintarEntregas() {
    const d = dado(), e = d && d.doca ? d.doca.entregas : null;
    cabeca('entregas', !d ? (S.erroDados ? 'erro' : '') : e && e.lido ? 'ok' : 'erro', e && e.lido && Number.isFinite(e.abertas) ? e.abertas : null);
    if (e && e.lido) idade('entregas', Number.isFinite(e.atualizadoMs) ? e.atualizadoMs : S.lidoEm, 'Idade do dado', e.velho); else idade('entregas', NaN);
    if (semDado(els.entregas, els.enB)) return;
    els.enB.classList.toggle('is-erro', !!(e && !e.lido));
    if (!e || !e.lido) { els.entregas.replaceChildren(vazio('Entregas sem leitura.')); return; }
    els.entregas.replaceChildren(...(e.itens.length ? e.itens.map(x => {
      const pct = Number.isFinite(x.pct) ? x.pct : null, barra = h('span', 'lv3-barra', h('i', ''));
      barra.querySelector('i').style.width = (pct === null ? 0 : pct) + '%';
      const r = h('div', 'lv3-en is-' + (x.estado || 'obra'), h('span', 'nm', val(x.nome)), h('b', 'pc', pct === null ? SEM : pct + '%'), x.passo ? h('span', 'ps', 'seu passo: ' + x.passo) : barra);
      r.title = val(x.nome) + (x.passo ? '\nseu passo: ' + x.passo : ''); return r;
    }) : [vazio('Nenhuma entrega aberta.', 'none')]));
  }
  // PROJETOS: painel de LED da Agora de sempre em miniatura (1 LED = 1 item, a mesma regra de cor)
  function pintarProjetos() {
    const d = dado(), p = d && d.doca ? d.doca.projetos : null;
    cabeca('projetos', !d ? (S.erroDados ? 'erro' : '') : p && p.lido ? 'ok' : 'erro', p && p.lido ? p.itens.length : null);
    if (p && p.lido) idade('projetos', S.lidoEm, 'Lido pelo painel'); else idade('projetos', NaN);
    if (semDado(els.projetos, els.pjB)) return;
    els.pjB.classList.toggle('is-erro', !!(p && !p.lido));
    if (!p || !p.lido) { els.projetos.replaceChildren(vazio('Projetos sem leitura.')); return; }
    els.projetos.replaceChildren(...(p.itens.length ? p.itens.map(x => {
      const g = h('div', 'lv3-leds');
      if (x.leds) for (const c of x.leds.slice(0, 48)) g.append(h('i', 'is-' + c));
      const r = h('div', 'lv3-pj', g, h('span', 'nm', val(x.nome)), h('b', '', x.leds ? x.ar + '/' + x.total : SEM));
      r.title = val(x.nome) + ': ' + (x.leds ? x.ar + ' de ' + x.total + ' no ar' + (x.vez ? ' · ' + x.vez + ' com você' : '') : 'falta lista de itens');
      if (!x.leds && x.solucao) r.append(h('small', 'lv3-nota', x.solucao)); return r;
    }) : [vazio('Nenhum projeto na lista.', 'none')]));
  }
  function pintarSemana() {
    const d = dado(), sem = d ? d.semana : null, itens = sem && Array.isArray(sem.itens) ? sem.itens : [];
    const ok = !!(sem && !sem.erro);
    cabeca('semana', !d ? (S.erroDados ? 'erro' : '') : ok ? 'ok' : 'erro', ok ? itens.filter(x => /pronto/.test(String(x && x.estado || ''))).length + '/' + itens.length : null);
    if (ok) idade('semana', Number.isFinite(sem.atualizadoMs) ? sem.atualizadoMs : S.lidoEm, 'Idade do dado'); else idade('semana', NaN);
    pintarIdades();
    if (semDado(els.semana, els.seB)) { els.seDatas.textContent = SEM; return; }
    if (!ok) { els.seDatas.textContent = SEM; els.semana.replaceChildren(vazio(sem && sem.erro ? 'Leitura falhou: ' + sem.erro : 'Semana sem leitura.')); return; }
    els.seDatas.textContent = val(sem.datas);
    els.semana.replaceChildren(...(itens.length ? itens.map(x => { const st = String(x && x.estado || ''); const r = h('div', 'lv3-sm', h('i', /pronto/.test(st) ? 'is-pronto' : /anda|fazendo|obra/.test(st) ? 'is-anda' : ''), h('span', '', val(x && x.texto))); r.title = (x && x.texto) || ''; return r; }) : [vazio('Nada na semana.', 'none')]));
    caber(els.semana, '.lv3-sm', ['item', 'itens']);
  }
  // CONTAS: Claude A a D pela regra da troca de conta (a ultima leitura vale ate o reset da semana; passou do reset, a conta que
  // nao e a atual zerou e a atual fica sem leitura; a atual com leitura de mais de 2 h fica sem leitura com a idade), Codex e pesquisa
  function contaClaude(x, agora) {
    const lido = x.lidoMs, zera = x.zeraMs, passou = Number.isFinite(zera) && zera <= agora;
    const titulo = 'Conta ' + x.conta + (x.atual ? ', a atual' : '') + ': leitura ' + haCurto(lido) + (Number.isFinite(zera) ? ' · reset da semana ' + (passou ? 'já passou' : emCurto(zera)) : '');
    if (!Number.isFinite(lido)) return { pct: null, idade: SEM, titulo };
    if (passou) return { pct: x.atual ? null : 0, idade: 'zerou', titulo };
    if (x.atual && agora - lido > DUAS_HORAS) return { pct: null, idade: haCurto(lido), titulo };
    return { pct: Number.isFinite(x.semana) ? x.semana : null, idade: haCurto(lido), titulo };
  }
  function pintarContas() {
    const agora = Date.now(), d = dado(), c = d ? d.contas : null, lista = c && Array.isArray(c.contas) ? c.contas : null;
    const g = els.gConta;
    if (d && !d.exemplo) {
      const rows = lista || [];
      els.contas.replaceChildren(...rows.map(x => h('div', 'lv3-cn is-real', h('span', 'k', x.conta), h('span', 'md', 'tokens hoje'), h('b', '', val(x.tokensHoje)), h('span', 'id', Number.isFinite(x.semana) ? 'crédito ' + x.semana + '% · ' + haTxt(x.lidoMs) : 'crédito sem leitura · ' + (x.solucao || 'Confira o uso.')))));
      cabeca('contas', 'ok', null); idade('contas', Math.max(...rows.map(x => x.lidoMs).filter(Number.isFinite)));
      // so a 1a conta fica grande; as outras vao na linha de baixo
      const fmt = x => x.conta + ' ' + (Number.isFinite(x.semana) ? x.semana + '%' : '?');
      g.v.textContent = rows.length ? fmt(rows[0]) : '?';
      g.n.textContent = [...rows.slice(1).map(fmt), 'semana'].join(' · '); pintarIdades(); return;
    }
    if (semDado(els.contas, els.coB)) { cabeca('contas', S.erroDados ? 'erro' : '', null); idade('contas', NaN); g.v.textContent = SEM; g.n.textContent = S.dados && S.dados.fechado ? 'só no exemplo' : SEM; return; }
    const base = lista && lista.length ? lista : ['A', 'B', 'C', 'D'].map(conta => ({ conta, lidoMs: null }));
    const linhas = base.map(x => { const r = contaClaude(x, agora); return { k: x.conta, cls: (x.atual ? 'is-atual' : '') + (r.pct !== null && r.pct >= 80 ? ' is-alto' : ''), pct: r.pct, v: r.pct === null ? SEM : r.pct + '%', id: r.idade, t: r.titulo }; });
    const cx = d.codex || null, cl = cx ? cx.lidoMs : NaN, cz = cx ? cx.zeraMs : NaN, cPassou = Number.isFinite(cz) && cz <= agora;
    const cxPct = !cx || !Number.isFinite(cl) || cPassou || agora - cl > DUAS_HORAS || !Number.isFinite(cx.semana) ? null : cx.semana;
    linhas.push({ k: 'CODEX', cls: 'is-cx' + (cxPct !== null && cxPct >= 80 ? ' is-alto' : ''), pct: cxPct, v: cxPct === null ? SEM : cxPct + '%', id: !cx || !Number.isFinite(cl) ? SEM : cPassou ? 'zerou' : haCurto(cl), t: 'Codex, uso da semana: leitura ' + haCurto(cl) });
    const pq = d.pesquisa || null;
    if (pq) linhas.push({ k: 'PESQUISA', cls: 'is-pq', md: pq.agora ? 'pesquisando agora' : 'semana ' + val(pq.semana), v: val(pq.hoje) + ' hoje', id: haCurto(pq.lidoMs), t: 'Pesquisas do exemplo: hoje e na semana' });
    else linhas.push({ k: 'PESQUISA', cls: 'is-pq', md: SEM, v: SEM, id: SEM, t: 'Pesquisa sem leitura' });
    const lidos = base.map(x => x.lidoMs).filter(Number.isFinite), atual = base.find(x => x.atual);
    cabeca('contas', !lista || !lista.length || (c && c.erro) ? 'erro' : 'ok', null);
    if (lidos.length) idade('contas', Math.max(...lidos), 'Leitura de uso mais nova'); else idade('contas', NaN);
    const ra = atual ? contaClaude(atual, agora) : null;
    g.v.textContent = atual ? atual.conta + ' ' + (ra.pct === null ? SEM : ra.pct + '%') : SEM;
    g.n.textContent = 'próxima: ' + val(c && c.proxima);
    els.coB.classList.toggle('is-erro', !lista || !lista.length || !!(c && c.erro));
    els.contas.replaceChildren(...linhas.map(x => {
      let meio;
      if (x.md !== undefined) meio = h('span', 'md', x.md);
      else { meio = h('span', 'lv3-barra', h('i', '')); meio.querySelector('i').style.width = (x.pct === null ? 0 : x.pct) + '%'; }
      const r = h('div', 'lv3-cn ' + x.cls, h('span', 'k', x.k), meio, h('b', '', x.v), h('span', 'id', x.id)); r.title = x.t; return r;
    }));
    pintarIdades();
  }
  function pintarIdeias() {
    const d = dado(), ide = d ? d.ideias : null, lista = ide && !ide.erro && Array.isArray(ide.itens) ? ide.itens : null;
    els.ideiasB.classList.toggle('is-erro', !!S.erroDados);
    const g = els.gIdeia;
    if (!lista) {
      els.novo.textContent = SEM; els.novo.className = 'lv3-novo is-zero'; els.ideiasDir.textContent = SEM;
      els.ideias.replaceChildren(h('li', '', h('span', '', S.dados && S.dados.fechado ? 'Ideias: só no exemplo.' : 'Ideias sem leitura.' + (ide && ide.solucao ? ' ' + ide.solucao : ''))));
      g.v.textContent = SEM; g.n.textContent = S.dados && S.dados.fechado ? 'só no exemplo' : SEM; return;
    }
    g.v.textContent = Number.isFinite(ide.hoje) ? ide.hoje + ' hoje' : SEM; g.n.textContent = 'semana ' + val(ide.semana);
    const novas = S.ideiasVistas ? 0 : (Number.isFinite(ide.novas) ? ide.novas : null);
    els.novo.textContent = novas === null ? SEM : novas ? novas + (novas === 1 ? ' NOVA' : ' NOVAS') : 'none';
    els.novo.className = 'lv3-novo' + (novas ? '' : ' is-zero');
    els.ideiasDir.textContent = lista.length ? 'última ' + haMin(lista[0].haMin) : 'none';
    els.ideias.replaceChildren(...(lista.length ? lista.slice(0, 3).map(x => { const li = h('li', '', h('i', '', haMin(x.haMin).replace('há ', '')), h('span', '', x.titulo)); li.title = x.titulo; return li; }) : [h('li', '', h('span', '', 'none'))]));
    if (S.aba === 'IDEIAS') pintarConversa();
  }

  // Conversa e destinos.
  function trocarAba(chave, quieto) {
    S.aba = chave;
    for (const b of els.tabs || []) b.setAttribute('aria-selected', String(b.dataset.aba === chave));
    els.input.placeholder = demonstracao() ? DIGITE : 'Escreva seu pedido';
    if (!quieto) aviso('');
    pintarConversa();
  }
  function msg(cls, quem, texto, st, stCls) { const m = h('div', 'lv3-ms ' + cls, h('i', '', quem), texto); if (st) m.append(h('span', 'lv3-st' + (stCls ? ' ' + stCls : ''), st)); return m; }
  function pintarConversa() {
    const aba = abas().find(a => a[0] === S.aba) || [], tipo = aba[2], d = dado();
    let linhas = [];
    if (!d) linhas = [vazio(S.dados && S.dados.fechado ? (S.dados.falta || 'Esta tela mostra só o exemplo.') : S.erroDados ? 'Leitura falhou. O painel tenta de novo em meio minuto.' : 'Lendo...')];
    else if (!demonstracao()) {
      linhas = (d.conversa || []).filter(x => S.aba === 'ORQUESTRADOR' ? !x.sessao : x.sessao === S.aba).map(m => msg(m.eu ? 'is-eu' : 'is-ja', val(m.rotulo) + ' ' + hora(m.ms), m.texto));
      if (!linhas.length) linhas = [vazio(d.conversaLeitura && !d.conversaLeitura.lido ? 'sem leitura · ' + d.conversaLeitura.solucao : 'Nenhum pedido nesta conversa.', d.conversaLeitura && !d.conversaLeitura.lido ? '?' : 'none')];
    } else if (tipo === 'voz') {
      linhas = (Array.isArray(d.conversa) ? d.conversa : []).map(m => msg(m.eu ? 'is-eu' : 'is-ja', val(m.rotulo) + ' ' + hora(m.ms), m.texto));
      if (!linhas.length) linhas = [vazio('Exemplo: a conversa com o Claude aparece aqui.', 'none')];
    } else if (tipo === 'ideias') {
      const ide = d.ideias, lista = ide && Array.isArray(ide.itens) ? ide.itens.slice().reverse() : [];
      linhas = lista.map(x => msg('is-id', 'IDEIA · ' + val(x.estado) + ' · ' + haMin(x.haMin), val(x.titulo), x.de ? 'veio de: ' + x.de : null));
      if (!linhas.length) linhas = [vazio('Nenhuma ideia nesta semana.', 'none')];
    } else if (tipo === 'recado') {
      const rec = d.recado || {}, rot = aba[1];
      const ses = (rec.sessoes || []).find(s => s.chave === S.aba);
      const hist = (rec.historico || []).filter(x => x.sessao === rot);
      linhas = hist.slice().reverse().map(x => { const m = msg('is-eu', 'VOCÊ · RECADO ' + hora(x.ms), x.texto, x.estado === 'lida' ? 'lida ' + hora(x.lidaMs) : 'esperando', x.estado === 'lida' ? '' : 'is-espera'); if (x.retorno) return [m, msg('is-ja', rot + ' · ' + hora(x.retorno.ms), x.retorno.texto)]; return [m]; }).flat();
      if (!linhas.length) linhas = [vazio('Nenhum recado para ' + rot + ' nas últimas 24 h. Último: ' + (ses && Number.isFinite(ses.ultimoMs) ? hora(ses.ultimoMs) : 'none') + '.', 'none')];
      if (rec.erro) linhas.unshift(vazio(rec.erro));
    }
    els.conv.replaceChildren(...linhas);
    els.conv.scrollTop = els.conv.scrollHeight; root.requestAnimationFrame(() => { els.conv.scrollTop = els.conv.scrollHeight; });
  }
  function aviso(t, tipo) { if (!els.aviso) return; els.aviso.textContent = t || ''; els.aviso.className = 'lv3-aviso' + (tipo ? ' is-' + tipo : ''); }
  async function postJSON(url, body, header, token) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', [header]: token }, body: JSON.stringify(body) });
    const j = await r.json(); if (!r.ok || !j.ok) throw Error(); return j;
  }
  async function enviar() {
    if (!String(els.input.value || '').trim()) return;
    if (!demonstracao()) {
      if (S.enviando) return;
      const texto = String(els.input.value).trim(), destino = S.aba;
      S.enviando = true; els.enviar.disabled = true;
      try {
        const c = await getJSON('/api/r10/config'); S.config = c;
        if (!c.ok || !c.recursos || !c.recursos.pedidos) { aviso('Ligue Pedidos em Recursos pessoais para enviar', 'erro'); return; }
        if (!c.token || !abas().some(x => x[0] === destino)) throw Error();
        const body = { texto, confirmado: true, ...(destino === 'ORQUESTRADOR' ? { para: 'orquestrador' } : { sessao: destino }) };
        await postJSON('/api/comando', body, 'x-r10-token', c.token);
        if (String(els.input.value).trim() === texto) els.input.value = ''; aviso('Pedido na fila. O orquestrador lê se a escuta estiver ligada (veja o README).', 'ok');
      } catch { aviso('Não consegui enviar. Tente de novo.', 'erro'); }
      finally { S.enviando = false; els.enviar.disabled = false; }
      return;
    }
    aviso(NADA, 'erro');
  }

  function atualizarAbas() {
    const aa = abas(), key = JSON.stringify(aa);
    if (key !== S.abasChave) {
      S.abasChave = key; els.tabBox.replaceChildren();
      els.tabs = aa.map(([chave, rot, tipo]) => { const b = btn('lv3-tab' + (tipo === 'ideias' ? ' is-id' : tipo === 'sessao' || tipo === 'recado' ? ' is-ses' : ' is-cl'), rot, () => trocarAba(chave)); b.setAttribute('role', 'tab'); b.dataset.aba = chave; els.tabBox.append(b); return b; });
      if (!aa.some(a => a[0] === S.aba)) S.aba = aa[0][0];
    }
    trocarAba(S.aba, true);
    els.convDir.textContent = demonstracao() ? 'exemplo' : 'pedidos e respostas';
    els.anel.querySelector('.lv3-falar').children[2].textContent = demonstracao() ? 'exemplo' : 'voz';
    els.codexNota.hidden = !demonstracao();
    if (!demonstracao()) {
      els.liga.textContent = 'ABRIR VOZ'; els.vozSt.textContent = S.config?.recursos?.voz ? 'Pronto para falar.' : 'Voz desligada';
      if (S.config?.ok && !S.config.recursos?.pedidos) aviso('Ligue Pedidos em Recursos pessoais para enviar', 'erro');
    }
  }

  // ---------- leitura ----------
  async function lerDados() {
    if (!ativa()) return;
    S.proximo = Date.now() + RITMO_MS;
    try { S.dados = await getJSON(API); S.erroDados = false; S.lidoEm = Date.now(); } catch { S.erroDados = true; }
    if (!S.erroDados && !S.dados.fechado) {
      const results = await Promise.allSettled([getJSON('/api/monitores' + (demonstracao() ? '?exemplo=1' : '')), ...(demonstracao() ? [] : [getJSON('/api/r10/config')])]);
      const mon = results[0]; S.monitores = mon.status === 'fulfilled' && mon.value.ok && typeof mon.value.configurado === 'boolean' ? mon.value : null;
      if (!S.monitores && demonstracao()) S.monitores = { ok: true, configurado: true, monitores: [{ id: 'robo', nome: 'Robô de compras', status: 'ok' }, { id: 'api', nome: 'API de exemplo', status: 'ok' }, { id: 'servidor', nome: 'Servidor de testes', status: 'caiu', desde: Date.now() - 180000 }] };
      if (results[1]) { S.config = results[1].status === 'fulfilled' ? results[1].value : null; if (S.config?.ok) root.PainelRecursos = { ...root.PainelRecursos, ...S.config.recursos, token: S.config.token }; }
    }
    atualizarAbas();
    // Compatibilidade com resposta de versao anterior.
    if (S.primeira && !S.erroDados) { S.primeira = false; if (S.dados && S.dados.fechado && html.dataset.lv3 !== 'antes') { html.dataset.lv3 = 'antes'; pintarTroca(); } }
    pintarTopo(); pintarVoce(); pintarFeed(); pintarAutomacao(); pintarAjudantes(); pintarDoca(); pintarSemana(); pintarContas(); pintarIdeias(); pintarConversa();
  }
  // 1 temporizador so: a cada 5 s le o que venceu (a leitura vale 30 s) e atualiza as idades; com a aba escondida ou fora da V3 nao faz nada
  function laco() {
    if (doc.hidden || !ativa()) return;
    if (Date.now() >= S.proximo) lerDados();
    else { pintarTopo(); pintarIdades(); }
  }

  function iniciar() {
    if (!montar()) return false;
    let estava = false, t = null;
    const olhar = () => { acoplarTroca(); marcarPlacar(); const a = ativa(); if (a && !estava) { medir(); lerDados(); } estava = a; };
    new MutationObserver(olhar).observe(html, { attributes: true, attributeFilter: ['data-theme', 'data-g-new', 'data-lv3'] });
    root.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(medir, 120); });
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(medir).catch(() => {});
    setTimeout(medir, 400);
    // a barra de cima, o menu das vistas, o placar e a caixa de baixo mudam de altura quando pintam: a V3 mede de novo so nessas horas
    if (root.ResizeObserver) { const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(medir, 60); }); S.ro = ro; for (const id of ['g-bar', 'g-subnav', 'g-dock', 'lv-placar']) { const n = doc.getElementById(id); if (n) { ro.observe(n); if (id === 'lv-placar') S.roPlacar = true; } } }
    olhar();
    setInterval(laco, 5000);
    doc.addEventListener('visibilitychange', () => { if (!doc.hidden) laco(); }); // a aba voltou: le na hora o que venceu escondido
    return true;
  }
  function esperar(n) { if (iniciar() || n > 80) return; setTimeout(() => esperar(n + 1), 250); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => esperar(0), { once: true }); else esperar(0);
})(window);
