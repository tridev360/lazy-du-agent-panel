/* livro-v3.js: a tela Agora do tema LIVRO DE ORDENS no desenho V3 (voz no centro, anel FALAR).
   So existe no LIVRO (o CSS esconde fora dele); GRADE e FOLHA nao mudam. Botao "Agora de antes" no menu das vistas volta a
   Agora de sempre (nada some: o resto da Agora do LIVRO segue la; o placar do dia fica embaixo da V3).
   Leitura: so GET /api/livro-v3 (VOCE RESOLVE, frentes, entregas, projetos, pronto hoje, ajudantes, ideias, contas, semana,
   feed, conversa e recado). Esta tela e so demonstracao: o anel FALAR, as respostas, o recado e o ENVIAR so mostram o aviso
   NADA e nada sai do navegador. Fora do exemplo a resposta vem "fechado" e a tela abre em "Agora de antes".
   Horas pelo relogio local do navegador. Texto entra sempre como texto (nada de HTML montado de string). */
(function (root) {
  'use strict';
  const doc = root.document, html = doc.documentElement;
  const EXEMPLO = /[?&]exemplo=1\b/.test(root.location.search || '');
  const API = '/api/livro-v3' + (EXEMPLO ? '?exemplo=1' : '');
  const NADA = 'Exemplo: nada é enviado. Esta tela é só demonstração.';
  const PERIGO = 'Perigoso: só vale com prova; responda no chat da sessão.';
  const SEM = 'sem leitura';
  const DIGITE = 'Exemplo: escreva e veja o aviso (nada é enviado)';
  const ABAS = [['CLAUDE', 'CLAUDE', 'voz'], ['IDEIAS', 'IDEIAS', 'ideias'], ['Atendimento', 'ATENDIMENTO', 'recado'], ['Cortes', 'CORTES', 'recado'], ['Loja', 'LOJA', 'recado']];
  const S = { dados: null, erroDados: false, aba: 'CLAUDE', ideiasVistas: false, vozLigada: false, primeira: true };
  const els = {};

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
    b.setAttribute('aria-label', 'Falar com o Claude'); b.title = NADA;
    const s = sv('svg', { viewBox: '0 0 200 200', 'aria-hidden': 'true' });
    s.append(sv('circle', { class: 'a-trilho', cx: 100, cy: 100, r: 96 }), sv('circle', { class: 'a-arco2', cx: 100, cy: 100, r: 88 }), sv('circle', { class: 'a-arco', cx: 100, cy: 100, r: 66 }));
    // 36 LEDs redondos em volta (o apagado fica visivel, como o painel de LED do LIVRO); a varredura so mexe na opacidade
    for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2 - Math.PI / 2; const c = sv('circle', { class: 'a-led', cx: (100 + 78 * Math.cos(a)).toFixed(2), cy: (100 + 78 * Math.sin(a)).toFixed(2), r: 2.4 }); c.style.animationDelay = (i * 0.1).toFixed(1) + 's'; s.append(c); }
    s.append(sv('circle', { class: 'a-miolo', cx: 100, cy: 100, r: 54 }));
    b.append(s, h('span', 'lv3-falar', h('i', ''), h('b', '', 'FALAR'), h('span', '', 'segure V')));
    // so mostra como a voz fica: acende por 2 s e volta; nada e gravado nem enviado
    b.addEventListener('click', () => {
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
    els.lido = h('span', 'lv3-lido', 'lendo...'); topo.append(els.lido);
    const fluxo = h('a', 'g-btn is-quieto', 'FLUXO · 2ª TELA ↗'); fluxo.href = (root.location.pathname || '/') + (root.location.search || '') + '#g=equipe.fluxo&tela=cheia'; fluxo.target = '_blank'; fluxo.rel = 'noopener'; fluxo.title = 'Abre só o Fluxo, sem menu, numa janela nova para deixar na segunda tela'; fluxo.dataset.lv3Bloco = 'fluxo';
    topo.append(h('span', 'lv3-acoes', fluxo));

    // coluna da esquerda: VOCE RESOLVE e o aviso das ideias
    const voce = bloco('voce', 'is-acao', [h('i', 'lv3-led is-rosa'), 'VOCÊ RESOLVE'], els.voceDir = h('span', 'lv3-dir', 'só o que espera você'));
    els.voce = h('div', 'lv3-lista'); voce.b.append(els.voce); els.voceB = voce.b;
    const ideias = bloco('ideias', 'lv3-ideias', [els.novo = h('span', 'lv3-novo is-zero', 'lendo'), 'IDEALISTAS'], els.ideiasDir = h('span', 'lv3-dir', 'lendo...'));
    els.ideias = h('ul', ''); const abrir = btn('g-btn is-quieto', 'ABRIR IDEIAS ↗', () => { S.ideiasVistas = true; root.location.hash = '#g=decidir.ideias'; });
    const visto = btn('lv3-op', 'VISTO', () => { S.ideiasVistas = true; pintarIdeias(); }, 'Marca as ideias de agora como vistas nesta visita');
    ideias.b.append(els.ideias, h('div', 'lv3-ops', abrir, visto)); els.ideiasB = ideias.b;
    const esq = h('div', 'lv3-col is-esq', voce.b, ideias.b);

    // centro: anel FALAR, voz e medidores; conversa com o Claude, as ideias e recado por sessao
    const nucleo = h('section', 'lv3-bloco lv3-nucleo'); nucleo.dataset.lv3Bloco = 'nucleo';
    els.vozSt = h('span', 'lv3-vozst', 'Pronto para falar.');
    els.convLed = h('i', 'lv3-led');
    els.anel = anel();
    const liga = btn('g-btn is-quieto', 'LIGAR VOZ', () => { S.vozLigada = !S.vozLigada; liga.textContent = S.vozLigada ? 'DESLIGAR VOZ' : 'LIGAR VOZ'; els.convLed.className = 'lv3-led' + (S.vozLigada ? ' is-vivo' : ''); aviso(NADA, 'erro'); }, 'Exemplo: só muda o botão');
    const conv = btn('g-btn is-quieto', 'CONVERSA', () => { trocarAba('CLAUDE'); els.input.focus(); }, 'Vai para a conversa com o Claude');
    els.liga = liga;
    const g1 = gauge('is-ajud', ''), g2 = gauge('', 'PRONTO HOJE'), g3 = gauge('is-ideia', 'IDEIAS · NOVAS HOJE'), g4 = gauge('', 'CONTA ATUAL');
    els.ajudLed = h('i', 'lv3-led'); g1.r.append(els.ajudLed, 'AJUDANTES · AGORA'); g1.g.dataset.lv3Bloco = 'ajudantes';
    Object.assign(els, { gAjud: g1, gPronto: g2, gIdeia: g3, gConta: g4 });
    const lado = h('div', 'lv3-lado', h('div', 'lv3-voz', liga, conv, els.vozSt), h('div', 'lv3-gauges', g1.g, g2.g, g3.g, g4.g));
    nucleo.append(els.anel, lado);
    const conversa = bloco('conversa', 'lv3-conversa', [els.convLed, 'CONVERSA · CLAUDE E IDEIAS'], h('span', 'lv3-dir', 'exemplo'));
    els.conv = h('div', 'lv3-lista'); els.conv.setAttribute('role', 'log'); els.conv.setAttribute('aria-live', 'polite');
    const tabs = h('div', 'lv3-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Para quem'); tabs.dataset.lv3Bloco = 'recado';
    els.tabs = ABAS.map(([chave, rot, tipo]) => { const b = btn('lv3-tab' + (tipo === 'ideias' ? ' is-id' : ''), rot, () => trocarAba(chave)); b.setAttribute('role', 'tab'); b.dataset.aba = chave; tabs.append(b); return b; });
    els.input = h('input', ''); els.input.type = 'text'; els.input.maxLength = 1000; els.input.setAttribute('aria-label', 'Escrever');
    els.input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); enviar(); } });
    els.enviar = btn('g-btn', 'ENVIAR', enviar);
    els.aviso = h('p', 'lv3-aviso', '');
    conversa.b.append(els.conv, tabs, h('div', 'lv3-entrada', els.input, els.enviar), els.aviso); els.convB = conversa.b;
    const cen = h('div', 'lv3-col is-cen', nucleo, conversa.b);

    // direita: feed do Claude e o Codex no exemplo
    const feed = bloco('feed', '', [els.feedLed = h('i', 'lv3-led'), 'FEED · CLAUDE'], els.feedDir = h('span', 'lv3-dir', 'lendo...'));
    els.feed = h('div', 'lv3-lista'); feed.b.append(els.feed); els.feedB = feed.b;
    const codex = h('section', 'lv3-breve'); codex.dataset.lv3Bloco = 'codex';
    codex.append(h('div', 'lv3-sec', h('i', 'lv3-led'), 'CODEX', h('span', 'lv3-dir', h('span', 'lv3-tag', 'EXEMPLO'))), h('p', '', 'No exemplo, o Codex aparece no feed quando revisa algo.'));
    const dir = h('div', 'lv3-col is-dir', feed.b, codex);

    // doca: frentes, entregas (com a Fila), esta semana, contas e projetos
    const fr = bloco('frentes', '', [h('i', 'lv3-led is-vivo'), 'FRENTES'], els.frDir = h('span', 'lv3-dir', 'lendo...'));
    els.frentes = h('div', 'lv3-lista'); fr.b.append(els.frentes); els.frB = fr.b;
    const fila = h('a', 'lv3-dir lv3-link', 'Fila ↗'); fila.href = '#g=fila.fila'; fila.title = 'Abre a aba Fila com todas as entregas';
    const en = bloco('entregas', '', ['ENTREGAS'], fila);
    els.entregas = h('div', 'lv3-lista'); en.b.append(h('div', 'lv3-sub', 'MAIS PERTO DE SAIR'), els.entregas); els.enB = en.b;
    const se = bloco('semana', '', ['ESTA SEMANA'], els.seDir = h('span', 'lv3-dir', 'lendo...'));
    els.semana = h('div', 'lv3-lista'); se.b.append(els.semana); els.seB = se.b;
    const co = bloco('contas', '', ['CONTAS'], els.coDir = h('span', 'lv3-dir', 'lendo...'));
    els.contas = h('div', 'lv3-lista'); co.b.append(els.contas); els.coB = co.b;
    const pj = bloco('projetos', '', ['PROJETOS'], els.pjDir = h('span', 'lv3-dir', 'lendo...'));
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
    html.style.setProperty('--lv3-anel', Math.round(156 + Math.min(40, folga * 0.2)) + 'px');
    html.style.setProperty('--lv3-ideias', Math.round(112 + Math.min(30, folga * 0.15)) + 'px');
    // o que a pagina ainda rolar (o placar embaixo e a margem da casca do painel) sai da altura, 1 vez por medida
    const sobra = doc.documentElement.scrollHeight - root.innerHeight;
    if (sobra > 0) html.style.setProperty('--lv3-h', Math.max(560, alt - sobra) + 'px');
    if (els.conv) els.conv.scrollTop = els.conv.scrollHeight;
  }

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
    return false;
  }
  function pintarVoce() {
    if (semDado(els.voce, els.voceB)) { els.voceDir.textContent = SEM; return; }
    const v = S.dados.voceResolve || { itens: [] };
    els.voceB.classList.toggle('is-erro', !!v.erro);
    els.voceDir.textContent = v.erro ? v.erro : 'só o que espera você · ' + v.itens.length;
    if (!v.itens.length) { els.voce.replaceChildren(vazio(v.erro ? 'Leitura falhou: ' + v.erro : 'Nada espera você agora.', v.erro ? null : 'none')); return; }
    els.voce.replaceChildren(...v.itens.map(itemVoce));
  }
  function itemVoce(it) {
    const card = it.tipo === 'card', perigo = it.perigoso === true;
    const tag = h('span', 'lv3-tag ' + (perigo ? 'is-perigo' : card ? 'is-card' : 'is-passo'), perigo ? 'PERIGOSO' : card ? 'DECISÃO' : 'SEU PASSO');
    const det = perigo ? String(it.detalhe || '').split(' · ').filter(x => !/^perigoso\b/i.test(x)).join(' · ') : it.detalhe; // a frase do perigoso sai so na nota
    const row = h('article', 'lv3-item', h('div', 'lv3-hd', tag, h('span', '', val(det))), h('p', 'lv3-q', val(it.titulo)));
    row.title = it.titulo || '';
    if (card && it.modo === 'opcoes') {
      const ops = h('div', 'lv3-ops');
      for (const o of it.opcoes || []) ops.append(btn('lv3-op' + (o.recomendada ? ' is-rec' : ''), (o.recomendada ? '★ ' : '') + o.rotulo, () => responder(o, row, ops), o.recomendada ? 'Recomendada' : ''));
      row.append(ops);
    } else if (card && it.modo === 'chat') {
      row.append(h('p', 'lv3-nota' + (perigo ? ' is-perigo' : ''), perigo ? PERIGO : 'Detalhe no chat da sessão.'));
    }
    if (!card && it.semBloco) row.append(h('p', 'lv3-nota', it.semBloco));
    return row;
  }
  // a escolha so aparece na tela: a linha some devagar e repete o aviso
  function responder(o, row, ops) {
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
    if (!f.itens.length) { els.feed.replaceChildren(vazio(f.erro ? 'Leitura falhou: ' + f.erro : 'Nenhuma fala do Claude ainda.', f.erro ? null : 'none')); return; }
    els.feed.replaceChildren(...f.itens.map(x => h('div', 'lv3-fd', h('span', 'h', hora(x.ms)), h('span', 'w' + (x.quem === 'CODEX' ? ' is-outro' : ''), val(x.quem)), h('p', '', val(x.texto)))));
  }
  function pintarAjudantes() {
    const g = els.gAjud, d = dado();
    if (!d) { g.v.textContent = SEM; g.n.textContent = S.dados && S.dados.fechado ? 'só no exemplo' : SEM; els.ajudLed.className = 'lv3-led'; return; }
    const b = d.ajudantes || {};
    g.v.textContent = val(b.agora);
    g.n.textContent = b.erro ? b.erro : val(b.nota) + ' · lido ' + (Number.isFinite(b.lidoHaS) ? 'há ' + b.lidoHaS + ' s' : SEM);
    els.ajudLed.className = 'lv3-led ' + (b.erro ? 'is-erro' : Number.isFinite(b.lidoHaS) && b.lidoHaS < 180 ? 'is-vivo' : '');
  }
  function pintarDoca() {
    // FRENTES
    if (!semDado(els.frentes, els.frB)) {
      const f = S.dados.frentes || { itens: [] };
      els.frB.classList.toggle('is-erro', !!f.erro);
      els.frDir.textContent = f.erro ? f.erro : 'dado ' + (Number.isFinite(f.dadoHaMin) ? 'de há ' + f.dadoHaMin + ' min' : SEM);
      const itens = f.itens;
      els.frentes.replaceChildren(...(itens.length ? itens.map(x => { const r = h('div', 'lv3-fr' + (x.atencao ? ' is-atencao' : ''), h('span', 'nm', val(x.nome)), h('span', 'pc', Number.isFinite(x.pct) ? x.pct + '%' : SEM), h('span', 'lv3-barra', h('i', '')), h('span', 'ft', val(x.faltam))); r.title = x.nomeInteiro || x.nome || ''; r.querySelector('.lv3-barra i').style.width = (Number.isFinite(x.pct) ? x.pct : 0) + '%'; return r; }) : [vazio(f.erro ? 'Leitura falhou: ' + f.erro : 'Nenhuma frente aberta.', f.erro ? null : 'none')]));
    } else els.frDir.textContent = SEM;
    // PRONTO HOJE: no medidor do centro; a lista do dia fica no balao do medidor
    const d = dado(), p = d ? d.prontoHoje || { itens: [] } : null, g = els.gPronto;
    if (!p) { g.v.textContent = SEM; g.n.textContent = S.dados && S.dados.fechado ? 'só no exemplo' : SEM; g.g.title = ''; }
    else { g.v.textContent = p.erro ? SEM : String(p.itens.length); g.n.textContent = p.erro ? p.erro : p.itens.length ? 'entregas fechadas hoje' : (p.nota || 'none'); g.g.title = p.itens.join('\n'); }
    pintarEntregas(); pintarProjetos();
  }
  // ENTREGAS: as mais perto de sair e a primeira que espera voce
  function pintarEntregas() {
    if (semDado(els.entregas, els.enB)) return;
    const e = S.dados.doca && S.dados.doca.entregas;
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
    if (semDado(els.projetos, els.pjB)) { els.pjDir.textContent = SEM; return; }
    const p = S.dados.doca && S.dados.doca.projetos;
    els.pjB.classList.toggle('is-erro', !!(p && !p.lido));
    if (!p || !p.lido) { els.pjDir.textContent = SEM; els.projetos.replaceChildren(vazio('Projetos sem leitura.')); return; }
    els.pjDir.textContent = p.itens.length ? 'no ar' : 'none';
    els.projetos.replaceChildren(...(p.itens.length ? p.itens.map(x => {
      const g = h('div', 'lv3-leds');
      if (x.leds) for (const c of x.leds.slice(0, 48)) g.append(h('i', 'is-' + c));
      const r = h('div', 'lv3-pj', g, h('span', 'nm', val(x.nome)), h('b', '', x.leds ? x.ar + '/' + x.total : SEM));
      r.title = val(x.nome) + ': ' + (x.leds ? x.ar + ' de ' + x.total + ' no ar' + (x.vez ? ' · ' + x.vez + ' com você' : '') : 'falta lista de itens'); return r;
    }) : [vazio('Nenhum projeto na lista.', 'none')]));
  }
  function pintarSemana() {
    if (semDado(els.semana, els.seB)) { els.seDir.textContent = SEM; return; }
    const sem = S.dados.semana;
    if (!sem || sem.erro) { els.seDir.textContent = SEM; els.semana.replaceChildren(vazio(sem && sem.erro ? 'Leitura falhou: ' + sem.erro : 'Semana sem leitura.')); return; }
    els.seDir.textContent = val(sem.datas);
    const itens = Array.isArray(sem.itens) ? sem.itens : [];
    els.semana.replaceChildren(...(itens.length ? itens.map(x => { const st = String(x && x.estado || ''); const r = h('div', 'lv3-sm', h('i', /pronto/.test(st) ? 'is-pronto' : /anda|fazendo|obra/.test(st) ? 'is-anda' : ''), h('span', '', val(x && x.texto))); r.title = (x && x.texto) || ''; return r; }) : [vazio('Nada na semana.', 'none')]));
  }
  function pintarContas() {
    const fora = semDado(els.contas, els.coB), c = fora ? null : S.dados.contas, lista = c && Array.isArray(c.itens) ? c.itens : null;
    if (!lista || !lista.length) { els.coDir.textContent = SEM; if (!fora) els.contas.replaceChildren(vazio('Contas sem leitura.')); els.gConta.v.textContent = SEM; els.gConta.n.textContent = S.dados && S.dados.fechado ? 'só no exemplo' : SEM; return; }
    els.coDir.textContent = 'semana';
    els.contas.replaceChildren(...lista.map(x => { const p = Number.isFinite(x.semana) ? x.semana : null; const r = h('div', 'lv3-cn' + (x.atual ? ' is-atual' : '') + (p !== null && p >= 80 ? ' is-alto' : ''), h('span', '', val(x.conta)), h('span', 'lv3-barra', h('i', '')), h('b', '', p === null ? SEM : p + '%')); r.querySelector('.lv3-barra i').style.width = (p || 0) + '%'; return r; }));
    const atual = lista.find(x => x.atual);
    els.gConta.v.textContent = atual ? atual.conta + ' ' + (Number.isFinite(atual.semana) ? atual.semana + '%' : SEM) : SEM;
    els.gConta.n.textContent = 'próxima: ' + val(c.proxima);
  }
  function pintarIdeias() {
    const d = dado(), ide = d ? d.ideias : null, lista = ide && Array.isArray(ide.itens) ? ide.itens : null;
    els.ideiasB.classList.toggle('is-erro', !!S.erroDados);
    const g = els.gIdeia;
    if (!lista) {
      els.novo.textContent = SEM; els.novo.className = 'lv3-novo is-zero'; els.ideiasDir.textContent = SEM;
      els.ideias.replaceChildren(h('li', '', h('span', '', S.dados && S.dados.fechado ? 'Ideias: só no exemplo.' : 'Ideias sem leitura.')));
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

  // ---------- conversa: Claude, ideias e recado por sessao (nada e enviado) ----------
  function trocarAba(chave, quieto) {
    S.aba = chave;
    for (const b of els.tabs || []) b.setAttribute('aria-selected', String(b.dataset.aba === chave));
    els.input.placeholder = DIGITE;
    if (!quieto) aviso('');
    pintarConversa();
  }
  function msg(cls, quem, texto, st, stCls) { const m = h('div', 'lv3-ms ' + cls, h('i', '', quem), texto); if (st) m.append(h('span', 'lv3-st' + (stCls ? ' ' + stCls : ''), st)); return m; }
  function pintarConversa() {
    const aba = ABAS.find(a => a[0] === S.aba) || [], tipo = aba[2], d = dado();
    let linhas = [];
    if (!d) linhas = [vazio(S.dados && S.dados.fechado ? (S.dados.falta || 'Esta tela mostra só o exemplo.') : S.erroDados ? 'Leitura falhou. O painel tenta de novo em meio minuto.' : 'Lendo...')];
    else if (tipo === 'voz') {
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
  function enviar() {
    if (!String(els.input.value || '').trim()) return;
    aviso(NADA, 'erro');
  }

  // ---------- leitura ----------
  async function lerDados() {
    if (!ativa()) return;
    try { S.dados = await getJSON(API); S.erroDados = false; } catch { S.erroDados = true; }
    // fora do exemplo esta tela nao toma a Agora: na 1a leitura fechada abre em "Agora de antes" (o botao volta a V3)
    if (S.primeira && !S.erroDados) { S.primeira = false; if (S.dados && S.dados.fechado && html.dataset.lv3 !== 'antes') { html.dataset.lv3 = 'antes'; pintarTroca(); } }
    pintarTopo(); pintarVoce(); pintarFeed(); pintarAjudantes(); pintarDoca(); pintarSemana(); pintarContas(); pintarIdeias(); pintarConversa();
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
    setInterval(lerDados, 30000);
    setInterval(() => { if (ativa()) pintarTopo(); }, 10000);
    return true;
  }
  function esperar() { if (iniciar()) return; let n = 0; const t = setInterval(() => { if (iniciar() || ++n > 80) clearInterval(t); }, 250); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', esperar, { once: true }); else esperar();
})(window);
