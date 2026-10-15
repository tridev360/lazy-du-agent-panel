/* Cartao da rotina: voltas e cards na primeira tela.
 * Le GET /api/rotina (estado/rotina.json) e GET /api/rotina/voltas (estado/rotina-voltas.jsonl) a cada 10 s com a aba aberta.
 *  - "O que cada volta fez": 1 linha por volta (hora, acelerou/manteve, o que fez), com o periodo no seletor (ultima volta,
 *    ultima hora, hoje, ontem). Sem o historico do servidor, as voltas saem do proprio detalhe (cada trecho "HH:MM: ...").
 *  - "Cards para voce": a pergunta inteira, onde responder, a recomendada primeiro. Card comum: o clique grava a escolha
 *    (POST /api/rotina/responder) e mostra "Pedido gravado" (so gravou; nao diz que a sua sessao principal leu). Card de subir, deploy, push,
 *    merge ou dinheiro (ou sem a marca perigoso:false do servidor): o painel nunca
 *    responde; o botao copia o texto pronto para colar no chat de quem executa. Card respondido em outro chat some sozinho
 *    (o servidor le o registro de decisoes); "respondido?" = so o texto bateu, confira.
 * Sem animacao. Nada de estilo inline (CSP): so classes. */
(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;
  const PARADO_MS = 20 * 60000, LER_MS = 10000, PERIODO_KEY = 'painel-rotina-periodo-v1';
  const PERIODOS = ['ultima', 'hora', 'hoje', 'ontem'];
  const T = {
    pt: { ligado: 'ligado', desligado: 'desligado', desde: h => 'ligado desde ' + h, proxima: h => 'próxima volta ' + h, parado: n => 'sem volta há ' + (n < 60 ? n + ' min' : Math.floor(n / 60) + ' h' + (n % 60 ? ' ' + (n % 60) + ' min' : '')), atrasada: h => 'volta atrasada: era às ' + h,
      voltas: 'O que cada volta fez', periodo: 'Período', per: { ultima: 'Última volta', hora: 'Última hora', hoje: 'Hoje', ontem: 'Ontem' }, acelerou: 'acelerou', manteve: 'manteve', semResultado: '?', nenhuma: 'Nenhuma volta gravada neste período.', desdeHist: (d, h) => 'O histórico começa em ' + d + ' às ' + h + '.', estimada: 'tirada do resumo da volta seguinte', deduzida: 'data deduzida pela ordem do registro', verMais: 'ver mais', verMenos: 'ver menos',
      cards: n => n === 1 ? '1 card esperando você' : n + ' cards esperando você', nenhumCard: 'Nenhum card esperando você', onde: o => 'responder: ' + o, destrava: d => 'destrava: ' + d, recomendada: 'recomendada',
      soNoChat: o => 'Este card só vale no ' + o + '. O botão copia a resposta pronta para colar lá.', copiar: o => 'Copiar: ' + o, copiado: o => 'Copiado. Cole no ' + o + '.', naoCopiou: 'Não consegui copiar. Selecione o texto abaixo e copie.',
      gravado: h => 'Pedido gravado às ' + h + '.', gravando: 'Gravando...', erro: 'Não consegui gravar. Tente de novo.', talvez: (h) => 'respondido? às ' + h + ' no chat: confira antes de responder de novo', respondidos: 'Respondidos há pouco', respondidoChat: h => 'respondido no chat às ' + h, respondidoPainel: (h, o) => 'respondido pelo painel às ' + h + ': ' + o,
      textoChat: (c, o) => 'Respondo o card ' + c.id + ' (' + c.pergunta + '): ' + o + '. Anote a resposta no registro de decisões e siga.', semLeitura: 'Rotina: sem leitura agora',
      foraChip: 'desligada nesta cópia', guiaTitulo: 'Como a rotina trabalha', guia: ['A cada 15 min ela olha o andamento de cada frente.', 'Anota o que cada volta fez: acelerou ou manteve.', 'Traz para cá os cards que esperam você, com a recomendada primeiro.'], guiaNota: 'Nesta cópia a rotina não roda sozinha. As escolhas que esperam você ficam no Agora.' },
    en: { ligado: 'on', desligado: 'off', desde: h => 'on since ' + h, proxima: h => 'next round ' + h, parado: n => 'no round for ' + n + ' min', atrasada: h => 'round overdue: due at ' + h,
      voltas: 'What each round did', periodo: 'Period', per: { ultima: 'Last round', hora: 'Last hour', hoje: 'Today', ontem: 'Yesterday' }, acelerou: 'sped up', manteve: 'held', semResultado: '?', nenhuma: 'No round recorded in this period.', desdeHist: (d, h) => 'History starts on ' + d + ' at ' + h + '.', estimada: 'taken from the next round summary', deduzida: 'date inferred from the log order', verMais: 'see more', verMenos: 'see less',
      cards: n => n === 1 ? '1 card waiting for you' : n + ' cards waiting for you', nenhumCard: 'No card waiting for you', onde: o => 'answer in: ' + o, destrava: d => 'unblocks: ' + d, recomendada: 'recommended',
      soNoChat: o => 'This card only counts in ' + o + '. The button copies the answer ready to paste there.', copiar: o => 'Copy: ' + o, copiado: o => 'Copied. Paste it in ' + o + '.', naoCopiou: 'Could not copy. Select the text below and copy it.',
      gravado: h => 'Request saved at ' + h + '.', gravando: 'Saving...', erro: 'Could not save. Try again.', talvez: (h) => 'answered? at ' + h + ' in chat: check before answering again', respondidos: 'Answered recently', respondidoChat: h => 'answered in chat at ' + h, respondidoPainel: (h, o) => 'answered on the panel at ' + h + ': ' + o,
      textoChat: (c, o) => 'I answer card ' + c.id + ' (' + c.pergunta + '): ' + o + '. Write the answer in the decisions log and go on.', semLeitura: 'Routine: no reading right now',
      foraChip: 'off in this copy', guiaTitulo: 'How the routine works', guia: ['Every 15 min it checks how each front is going.', 'It writes down what each round did: sped up or held.', 'It brings here the cards waiting for you, recommended first.'], guiaNota: 'In this copy the routine does not run by itself. The choices waiting for you are in Now.' },
    es: { ligado: 'encendido', desligado: 'apagado', desde: h => 'encendido desde ' + h, proxima: h => 'próxima vuelta ' + h, parado: n => 'sin vuelta hace ' + n + ' min', atrasada: h => 'vuelta atrasada: era a las ' + h,
      voltas: 'Qué hizo cada vuelta', periodo: 'Período', per: { ultima: 'Última vuelta', hora: 'Última hora', hoje: 'Hoy', ontem: 'Ayer' }, acelerou: 'aceleró', manteve: 'mantuvo', semResultado: '?', nenhuma: 'Ninguna vuelta registrada en este período.', desdeHist: (d, h) => 'El historial empieza el ' + d + ' a las ' + h + '.', estimada: 'tomada del resumen de la vuelta siguiente', deduzida: 'fecha deducida por el orden del registro', verMais: 'ver más', verMenos: 'ver menos',
      cards: n => n === 1 ? '1 card esperándote' : n + ' cards esperándote', nenhumCard: 'Ningún card esperándote', onde: o => 'responder en: ' + o, destrava: d => 'destraba: ' + d, recomendada: 'recomendada',
      soNoChat: o => 'Este card solo vale en el ' + o + '. El botón copia la respuesta lista para pegar allí.', copiar: o => 'Copiar: ' + o, copiado: o => 'Copiado. Pégalo en el ' + o + '.', naoCopiou: 'No pude copiar. Selecciona el texto de abajo y cópialo.',
      gravado: h => 'Pedido guardado a las ' + h + '.', gravando: 'Guardando...', erro: 'No pude guardar. Intenta de nuevo.', talvez: (h) => '¿respondido? a las ' + h + ' en el chat: confirma antes de responder otra vez', respondidos: 'Respondidos hace poco', respondidoChat: h => 'respondido en el chat a las ' + h, respondidoPainel: (h, o) => 'respondido en el panel a las ' + h + ': ' + o,
      textoChat: (c, o) => 'Respondo el card ' + c.id + ' (' + c.pergunta + '): ' + o + '. Anota la respuesta en el registro de decisiones y sigue.', semLeitura: 'Rutina: sin lectura ahora',
      foraChip: 'apagada en esta copia', guiaTitulo: 'Cómo trabaja la rutina', guia: ['Cada 15 min revisa cómo va cada frente.', 'Anota qué hizo cada vuelta: aceleró o mantuvo.', 'Trae aquí los cards que te esperan, con la recomendada primero.'], guiaNota: 'En esta copia la rutina no corre sola. Las elecciones que te esperan están en Ahora.' }
  };
  const lang = () => { const sel = doc.getElementById('language'); const v = (sel && sel.value) || doc.documentElement.lang || 'pt'; return T[v] ? v : 'pt'; };
  const brt = at => new Date(at - 3 * 3600000);
  const hora = iso => { const at = Date.parse(iso); if (!Number.isFinite(at)) return null; const d = brt(at); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };
  const dia = at => brt(at).toISOString().slice(0, 10);
  const diaCurto = iso => { const d = brt(Date.parse(iso)); return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0'); };
  const el = (tag, cls, txt) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (txt !== undefined && txt !== null) n.textContent = txt; return n; };
  let dados = null, voltas = null, timer = null, relogio = null, periodo = 'ultima', avisos = new Map(), abertos = new Set(), ocupado = false;
  try { const v = root.localStorage.getItem(PERIODO_KEY); if (PERIODOS.includes(v)) periodo = v; } catch { /* sem armazenamento */ }

  // Sem o historico do servidor: cada trecho "HH:MM: ..." do detalhe vira 1 volta de hoje (a da hora da ultima volta = o resultado dela).
  function trechos(detalhe) {
    const s = String(detalhe || '').replace(/\b(\d{2}:\d{2}):\s*(?=\1:)/g, '');
    const marcas = [...s.matchAll(/(?:^|[\s.;])(\d{2}):(\d{2}):\s/g)];
    if (!marcas.length) return s.trim() ? [{ hora: null, texto: s.trim() }] : [];
    const out = [];
    marcas.forEach((m, i) => { const ini = m.index + m[0].length, fim = i + 1 < marcas.length ? marcas[i + 1].index + 1 : s.length; const t = s.slice(ini, fim).trim().replace(/[\s.;]+$/, ''); if (t) out.push({ hora: m[1] + ':' + m[2], texto: t }); });
    return out;
  }
  function voltasLocais() {
    if (!dados || !dados.ultimaVolta) return [];
    const em = Date.parse(dados.ultimaVolta), h = hora(dados.ultimaVolta), partes = trechos(dados.detalhe), out = [];
    const propria = partes.find(p => p.hora === h) || partes.find(p => p.hora === null) || partes[0];
    out.push({ em: dados.ultimaVolta, resultado: dados.resultado, detalhe: propria ? propria.texto : null, estimada: false });
    for (const p of partes) { if (!p.hora || p.hora === h) continue; const at = Date.parse(dia(em) + 'T' + p.hora + ':00-03:00'); if (Number.isFinite(at) && at < em) out.push({ em: new Date(at).toISOString(), resultado: null, detalhe: p.texto, estimada: true }); }
    return out;
  }
  function filtradas(lista, agora) {
    const ordem = [...lista].filter(v => Number.isFinite(Date.parse(v.em))).sort((a, b) => Date.parse(b.em) - Date.parse(a.em));
    if (periodo === 'ultima') return ordem.slice(0, 1);
    if (periodo === 'hora') return ordem.filter(v => agora - Date.parse(v.em) <= 3600000);
    const alvo = periodo === 'hoje' ? dia(agora) : dia(agora - 86400000);
    return ordem.filter(v => dia(Date.parse(v.em)) === alvo);
  }

  function blocoVoltas(w, agora) {
    const box = el('section', 'inf-bloco inf-voltas');
    const topo = el('div', 'inf-bloco-topo');
    const titulo = el('h3', 'inf-bloco-titulo', w.voltas); titulo.id = 'inf-voltas-titulo';
    const sel = el('select', 'inf-periodo'); sel.id = 'inf-periodo'; sel.setAttribute('aria-label', w.periodo);
    for (const p of PERIODOS) { const o = el('option', null, w.per[p]); o.value = p; if (p === periodo) o.selected = true; sel.append(o); }
    sel.addEventListener('change', () => { periodo = PERIODOS.includes(sel.value) ? sel.value : 'ultima'; try { root.localStorage.setItem(PERIODO_KEY, periodo); } catch { /* sem armazenamento */ } desenhar(); const s = doc.getElementById('inf-periodo'); if (s) s.focus(); });
    topo.append(titulo, sel); box.append(topo);
    const todas = Array.isArray(voltas) ? voltas : voltasLocais(), lista = filtradas(todas, agora);
    if (!lista.length) {
      box.append(el('p', 'inf-vazio', w.nenhuma));
      const velha = todas.reduce((m, v) => { const at = Date.parse(v.em); return Number.isFinite(at) && (m === null || at < m) ? at : m; }, null);
      if (velha !== null && periodo === 'ontem') box.append(el('p', 'inf-vazio', w.desdeHist(diaCurto(new Date(velha).toISOString()), hora(new Date(velha).toISOString()))));
      return box;
    }
    const ul = el('ol', 'inf-voltas-lista'); ul.setAttribute('aria-labelledby', titulo.id);
    for (const v of lista) {
      const li = el('li', 'inf-volta');
      const cab = el('div', 'inf-volta-cab');
      cab.append(el('strong', 'inf-volta-hora', (periodo === 'ontem' ? diaCurto(v.em) + ' ' : '') + hora(v.em)));
      cab.append(el('span', 'inf-volta-res' + (v.resultado === 'acelerou' ? ' is-acelerou' : v.resultado === 'manteve' ? ' is-manteve' : ''), v.resultado ? w[v.resultado] : w.semResultado));
      if (v.estimada) cab.append(el('span', 'inf-volta-nota', w.estimada)); else if (v.dataDeduzida) cab.append(el('span', 'inf-volta-nota', w.deduzida));
      li.append(cab);
      if (v.detalhe) {
        const chave = v.em, aberto = abertos.has(chave), p = el('p', 'inf-volta-texto' + (aberto ? ' is-aberto' : ''), v.detalhe);
        li.append(p);
        if (v.detalhe.length > 240) { const b = el('button', 'inf-link', aberto ? w.verMenos : w.verMais); b.type = 'button'; b.setAttribute('aria-expanded', String(aberto)); b.addEventListener('click', () => { if (abertos.has(chave)) abertos.delete(chave); else abertos.add(chave); desenhar(); }); li.append(b); }
      }
      ul.append(li);
    }
    box.append(ul);
    return box;
  }

  async function copiar(texto) {
    try { if (root.navigator.clipboard && root.isSecureContext) { await root.navigator.clipboard.writeText(texto); return true; } } catch { /* tenta o jeito antigo */ }
    try { const ta = el('textarea', 'inf-copia'); ta.value = texto; ta.setAttribute('readonly', ''); doc.body.append(ta); ta.select(); const ok = doc.execCommand('copy'); ta.remove(); return ok; } catch { return false; }
  }
  async function responder(card, indice, w) {
    if (ocupado) return; ocupado = true; avisos.set(card.id, { tipo: 'info', texto: w.gravando }); desenhar();
    try {
      const r = await root.fetch('/api/rotina/responder', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Rotina-Token': dados && dados.token || '' }, body: JSON.stringify({ id: card.id, opcao: indice }) });
      const j = await r.json().catch(() => null);
      avisos.set(card.id, r.ok && j && j.ok ? { tipo: 'ok', texto: w.gravado(j.hora || hora(new Date().toISOString())) } : { tipo: 'erro', texto: (j && j.mensagem) || w.erro });
    } catch { avisos.set(card.id, { tipo: 'erro', texto: w.erro }); }
    finally { ocupado = false; }
    await ler();
  }
  function blocoCards(w) {
    const cards = Array.isArray(dados.cards) ? dados.cards : [];
    const abertosCards = cards.filter(c => c.estado !== 'respondido'), feitos = cards.filter(c => c.estado === 'respondido');
    const box = el('section', 'inf-bloco inf-cards-bloco' + (abertosCards.length ? ' tem-cards' : ''));
    const titulo = el('h3', 'inf-bloco-titulo', abertosCards.length ? w.cards(abertosCards.length) : w.nenhumCard); titulo.id = 'inf-cards-titulo';
    box.append(titulo);
    if (abertosCards.length) {
      const ul = el('ul', 'inf-cards'); ul.setAttribute('aria-labelledby', titulo.id);
      for (const card of abertosCards) {
        const li = el('li', 'inf-card' + (card.perigoso ? ' is-chat' : ''));
        li.append(el('p', 'inf-pergunta', card.pergunta));
        const meta = [card.onde ? w.onde(card.onde) : null, card.destrava ? w.destrava(card.destrava) : null].filter(Boolean).join(' · ');
        if (meta) li.append(el('p', 'inf-meta', meta));
        if (card.estado === 'respondido?') li.append(el('p', 'inf-talvez', w.talvez(card.respondidoEm || '?')));
        // na duvida, so copia: grava so quando o servidor marcou perigoso:false
        const podeGravar = dados.responde === true && card.perigoso === false && card.id;
        if (!podeGravar) li.append(el('p', 'inf-nota', w.soNoChat(card.onde || 'chat de quem executa')));
        const opcoes = Array.isArray(card.opcoes) && card.opcoes.length ? card.opcoes : [card.recomendado].filter(Boolean);
        const linha = el('div', 'inf-opcoes');
        opcoes.forEach((opcao, i) => {
          const b = el('button', 'inf-opcao' + (i === 0 ? ' is-recomendada' : ''), podeGravar ? opcao : w.copiar(opcao)); b.type = 'button';
          if (i === 0) b.append(el('span', 'inf-selo', w.recomendada));
          b.disabled = ocupado;
          b.addEventListener('click', async () => {
            if (podeGravar) return responder(card, i, w);
            const texto = w.textoChat(card, opcao), ok = await copiar(texto);
            avisos.set(card.id || card.pergunta, ok ? { tipo: 'ok', texto: w.copiado(card.onde || 'chat de quem executa') } : { tipo: 'erro', texto: w.naoCopiou, copia: texto });
            desenhar();
          });
          linha.append(b);
        });
        li.append(linha);
        const aviso = avisos.get(card.id || card.pergunta);
        if (aviso) { const p = el('p', 'inf-aviso is-' + aviso.tipo, aviso.texto); p.setAttribute('role', 'status'); li.append(p); if (aviso.copia) li.append(el('p', 'inf-copia-visivel', aviso.copia)); }
        ul.append(li);
      }
      box.append(ul);
    }
    if (feitos.length) {
      const d = el('details', 'inf-feitos'); d.append(el('summary', null, w.respondidos + ' (' + feitos.length + ')'));
      for (const card of feitos) d.append(el('p', 'inf-feito', card.pergunta + ' · ' + (card.respostaPor === 'painel' ? w.respondidoPainel(card.respondidoEm || '?', card.resposta || '?') : w.respondidoChat(card.respondidoEm || '?'))));
      box.append(d);
    }
    return box;
  }

  // Sem leitura da rotina (cópia sem a rotina ligada): o cartão explica o que ela faz, sem "?" e sem página vazia.
  function guia(w) {
    const box = el('div', 'inf-guia-cartao');
    const topo = el('div', 'inf-topo');
    const marca = el('strong', 'inf-marca'); marca.append(el('span', 'inf-simbolo', '∞'), el('span', null, 'Rotina'));
    topo.append(marca, el('span', 'inf-chip', w.foraChip));
    const bloco = el('section', 'inf-bloco inf-guia');
    const titulo = el('h3', 'inf-bloco-titulo', w.guiaTitulo); titulo.id = 'inf-guia-titulo';
    const ol = el('ol', 'inf-guia-passos'); ol.setAttribute('aria-labelledby', titulo.id);
    w.guia.forEach((t, i) => { const li = el('li', 'inf-guia-passo'); li.append(el('strong', 'inf-guia-n', String(i + 1)), el('span', null, t)); ol.append(li); });
    bloco.append(titulo, ol, el('p', 'inf-vazio', w.guiaNota));
    box.append(topo, bloco);
    return box;
  }
  function desenhar() {
    const host = doc.getElementById('rotina-card');
    if (!host) return;
    const w = T[lang()], agora = Date.now();
    if (!dados || dados.exemplo || dados.lido === false) { host.hidden = false; host.replaceChildren(guia(w)); return; }
    host.hidden = false;
    const ativo = doc.activeElement && host.contains(doc.activeElement) ? doc.activeElement.id : null;
    const topo = el('div', 'inf-topo');
    const marca = el('strong', 'inf-marca'); marca.append(el('span', 'inf-simbolo', '∞'), el('span', null, 'Rotina'));
    topo.append(marca, el('span', 'inf-chip' + (dados.ligado ? ' is-on' : ''), dados.ligado ? w.ligado : w.desligado));
    if (hora(dados.desde)) topo.append(el('span', 'inf-desde', w.desde(hora(dados.desde))));
    // atrasada so se nenhuma volta aconteceu depois da hora marcada (a sua sessao principal as vezes roda a volta e nao troca a "proxima")
    const ultima = Date.parse(dados.ultimaVolta), ciclo = (dados.cicloMin || 15) * 60000;
    let prox = Date.parse(dados.proxima), estimada = false;
    if (Number.isFinite(ultima) && (!Number.isFinite(prox) || ultima >= prox)) { prox = ultima + ciclo; estimada = true; }
    const atrasada = dados.ligado && Number.isFinite(prox) && agora - prox > 5 * 60000;
    const at = Date.parse(dados.atualizado), parado = dados.ligado && Number.isFinite(at) && agora - at > PARADO_MS;
    if (parado) topo.append(el('span', 'inf-proxima is-alerta', w.parado(Math.floor((agora - at) / 60000))));
    else if (atrasada) topo.append(el('span', 'inf-proxima is-alerta', w.atrasada(hora(new Date(prox).toISOString()))));
    else if (dados.ligado && Number.isFinite(prox)) topo.append(el('span', 'inf-proxima', w.proxima((estimada ? '~' : '') + hora(new Date(prox).toISOString()))));
    host.replaceChildren(topo, blocoCards(w), blocoVoltas(w, agora));
    if (ativo) { const n = doc.getElementById(ativo); if (n) n.focus(); }
  }
  async function ler() {
    if (doc.hidden) return;
    try {
      const r = await root.fetch('/api/rotina', { cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const j = await r.json();
      dados = r.ok && j && j.ok ? j : null;
    } catch { dados = null; }
    if (dados && dados.lido !== false && !dados.exemplo) {
      try {
        const r = await root.fetch('/api/rotina/voltas', { cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json' } });
        const j = r.ok ? await r.json() : null;
        voltas = j && j.ok && Array.isArray(j.voltas) ? j.voltas : null;
      } catch { voltas = null; }
    }
    if (!doc.querySelector('#rotina-card select:focus')) desenhar();
  }
  function iniciar() {
    if (!doc.getElementById('rotina-card')) return;
    ler();
    clearInterval(timer); clearInterval(relogio);
    timer = setInterval(ler, LER_MS);
    relogio = setInterval(() => { if (!doc.querySelector('#rotina-card select:focus')) desenhar(); }, 30000);
    doc.addEventListener('visibilitychange', () => { if (!doc.hidden) ler(); });
    const sel = doc.getElementById('language'); if (sel) sel.addEventListener('change', desenhar);
  }
  root.PainelRotina = Object.freeze({ ler, desenhar, trechos });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', iniciar, { once: true }); else iniciar();
})(window);
