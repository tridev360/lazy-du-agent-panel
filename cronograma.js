/* Cronograma com ordenacao local dos itens.
 * Le GET /api/cronograma (estado/cronograma.json, quem escreve e o Claude) a cada 60 s com a aba aberta. Abas Hoje, Semana e Geral.
 * Hoje = linha do tempo do dia com a hora atual marcada; feito apagado; rodando em destaque; o que aguarda sua resposta em rosa;
 * cor por quem faz (laranja Claude, azul Codex, rosa voce). Mudar ordem: arrastar (ou setas para cima e para baixo) os itens que
 * ainda nao foram feitos e nao tem hora fixa (post, mesa, hora exata). Isso NAO muda nada sozinho: "Enviar pedido" grava a nova
 * ordem em estado/pedidos-de-ordem.md (POST /api/cronograma/ordem) e o Claude repassa as sessoes.
 * Sem estilo inline (CSP): so classes. Motion off: sem pulso. */
(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;
  function autoLinha(d) {
    const a = d && d.automatico; if (!a || d.lido === false) return [];
    const t = a.ok ? 'Hoje ao vivo: ' + a.n + (a.n === 1 ? ' item lido' : ' itens lidos') + ' do gerador de projetos ' + (a.idadeTexto || '') : '? Hoje ao vivo sem leitura: ' + (a.motivo || 'gerador parado') + '. Solução: ' + (a.solucao || '');
    return [el('p', 'crono-lido' + (a.ok ? '' : ' is-velho'), t)];
  }
  const LER_MS = 60000, ABA_KEY = 'painel-cronograma-aba-v1', ABAS = ['hoje', 'semana', 'geral'], VELHO_MS = 2 * 3600000;
  const T = {
    pt: { titulo: 'Cronograma', abas: { hoje: 'Hoje', semana: 'Semana', geral: 'Geral' }, atualizado: (h, n) => 'atualizado às ' + h + (n === null ? '' : n < 1 ? ' · agora' : ' · há ' + (n >= 60 ? Math.floor(n / 60) + ' h ' + (n % 60) + ' min' : n + ' min')), velho: 'pode estar velho', estimado: 'horas estimadas',
      quem: { claude: 'Claude', codex: 'Codex', ele: 'você', 'os dois': 'os dois' }, estado: { feito: 'feito', rodando: 'rodando', 'na fila': 'na fila', 'espera voce': 'espera você', travado: 'travado' }, agora: h => 'agora ' + h, maxima: 'prioridade', depende: d => 'depende: ' + d,
      subir: o => 'Subir: ' + o, descer: o => 'Descer: ' + o, passou: 'passou da hora', feitos: n => '✓ ' + n + ' feitos hoje (ver)', esconderFeitos: 'esconder os feitos', arrastar: 'Arraste para mudar a ordem', fixo: 'hora fixa', mudou: 'Você mudou a ordem. Nada muda sozinho: o Claude repassa às sessões.', enviar: 'Enviar pedido ao Claude', desfazer: 'Desfazer', enviado: h => 'Pedido gravado às ' + h + '.', erro: 'Não consegui enviar. Tente de novo.', ultimos: 'Pedidos de ordem gravados', vazio: 'Nada neste cronograma.', semLeitura: 'Cronograma sem leitura agora.' },
    en: { titulo: 'Schedule', abas: { hoje: 'Today', semana: 'Week', geral: 'Overall' }, atualizado: (h, n) => 'updated at ' + h + (n === null ? '' : n < 1 ? ' · now' : ' · ' + (n >= 60 ? Math.floor(n / 60) + ' h ' + (n % 60) + ' min' : n + ' min') + ' ago'), velho: 'may be old', estimado: 'estimated times',
      quem: { claude: 'Claude', codex: 'Codex', ele: 'you', 'os dois': 'both' }, estado: { feito: 'done', rodando: 'running', 'na fila': 'queued', 'espera voce': 'waits for you', travado: 'blocked' }, agora: h => 'now ' + h, maxima: 'priority', depende: d => 'depends on: ' + d,
      subir: o => 'Move up: ' + o, descer: o => 'Move down: ' + o, passou: 'past its time', feitos: n => '✓ ' + n + ' done today (see)', esconderFeitos: 'hide done items', arrastar: 'Drag to change the order', fixo: 'fixed time', mudou: 'You changed the order. Nothing changes by itself: Claude passes it to the sessions.', enviar: 'Send request to Claude', desfazer: 'Undo', enviado: h => 'Request saved at ' + h + '.', erro: 'Could not send. Try again.', ultimos: 'Saved order requests', vazio: 'Nothing in this schedule.', semLeitura: 'Schedule has no reading now.' },
    es: { titulo: 'Cronograma', abas: { hoje: 'Hoy', semana: 'Semana', geral: 'General' }, atualizado: (h, n) => 'actualizado a las ' + h + (n === null ? '' : n < 1 ? ' · ahora' : ' · hace ' + (n >= 60 ? Math.floor(n / 60) + ' h ' + (n % 60) + ' min' : n + ' min')), velho: 'puede estar viejo', estimado: 'horas estimadas',
      quem: { claude: 'Claude', codex: 'Codex', ele: 'tú', 'os dois': 'los dos' }, estado: { feito: 'hecho', rodando: 'en marcha', 'na fila': 'en cola', 'espera voce': 'te espera', travado: 'trabado' }, agora: h => 'ahora ' + h, maxima: 'prioridad', depende: d => 'depende de: ' + d,
      subir: o => 'Subir: ' + o, descer: o => 'Bajar: ' + o, passou: 'pasó la hora', feitos: n => '✓ ' + n + ' hechos hoy (ver)', esconderFeitos: 'ocultar los hechos', arrastar: 'Arrastra para cambiar el orden', fixo: 'hora fija', mudou: 'Cambiaste el orden. Nada cambia solo: Claude lo pasa a las sesiones.', enviar: 'Enviar pedido o Claude', desfazer: 'Deshacer', enviado: h => 'Pedido guardado a las ' + h + '.', erro: 'No pude enviar. Intenta de nuevo.', ultimos: 'Pedidos de orden guardados', vazio: 'Nada en este cronograma.', semLeitura: 'Cronograma sin lectura ahora.' }
  };
  const lang = () => { const sel = doc.getElementById('language'); const v = (sel && sel.value) || doc.documentElement.lang || 'pt'; return T[v] ? v : 'pt'; };
  const el = (tag, cls, txt) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (txt !== undefined && txt !== null) n.textContent = txt; return n; };
  const clock = iso => { const at = Date.parse(iso || ''); if (!Number.isFinite(at)) return null; const d = new Date(at - 3 * 3600000); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };
  const agoraMin = () => { const d = new Date(Date.now() - 3 * 3600000); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
  const inicioMin = hora => { const s = String(hora || ''); if (/^agora$/i.test(s.trim())) return agoraMin(); const m = /([01]\d|2[0-3]):([0-5]\d)/.exec(s); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  let dados = null, falhou = false, aba = 'hoje', ordens = {}, avisos = {}, arrastando = null, timer = null, host = null, ocupado = false, verFeitos = false;
  // fim previsto (a ultima HH:MM da hora) ja passou ha mais de 5 min e o item nao esta feito = aviso "passou da hora"
  const fimMin = hora => { const all = [...String(hora || '').matchAll(/([01]\d|2[0-3]):([0-5]\d)/g)]; if (!all.length) return null; const m = all[all.length - 1]; return Number(m[1]) * 60 + Number(m[2]); };
  try { const v = root.localStorage.getItem(ABA_KEY); if (ABAS.includes(v)) aba = v; } catch { /* sem armazenamento */ }

  function grupos() {
    if (!dados) return [];
    if (aba === 'hoje') return [{ chave: 'hoje', titulo: null, itens: dados.hoje || [], linhaDoTempo: true },{chave:'historico',titulo:({pt:'Histórico com data',en:'Dated history',es:'Historial con fecha'})[lang()],itens:dados.historico||[]},{chave:'semData',titulo:({pt:'? Data não registrada',en:'? Date not recorded',es:'? Fecha sin registrar'})[lang()],itens:dados.semData||[]}].filter(g=>g.chave==='hoje'||g.itens.length);
    if (aba === 'semana') return (dados.semana || []).map((d, i) => ({ chave: 'semana:' + i, titulo: d.rotulo || d.dia, itens: d.itens || [] }));
    return (dados.geral || []).map((f, i) => ({ chave: 'geral:' + i, titulo: f.fase, itens: f.itens || [] }));
  }
  // os itens que podem mudar de lugar ocupam as mesmas vagas; a nova ordem local troca so quem ocupa essas vagas
  function ordenados(g) {
    const moveis = g.itens.filter(i => !i.fixo), local = ordens[g.chave];
    if (!local) return g.itens;
    const fila = local.map(o => moveis.find(i => i.o_que === o)).filter(Boolean);
    if (fila.length !== moveis.length) { delete ordens[g.chave]; return g.itens; }
    let k = 0; return g.itens.map(i => i.fixo ? i : fila[k++]);
  }
  function mover(g, o_que, delta) {
    const atual = ordens[g.chave] ? [...ordens[g.chave]] : g.itens.filter(i => !i.fixo).map(i => i.o_que);
    const de = atual.indexOf(o_que), para = de + delta;
    if (de < 0 || para < 0 || para >= atual.length) return;
    atual.splice(para, 0, atual.splice(de, 1)[0]);
    const original = g.itens.filter(i => !i.fixo).map(i => i.o_que);
    if (atual.every((v, i) => v === original[i])) delete ordens[g.chave]; else ordens[g.chave] = atual;
    delete avisos[g.chave];
    desenhar(); const b = host && host.querySelector('[data-crono-foco="' + CSS.escape(g.chave + '|' + o_que + '|' + (delta < 0 ? 'up' : 'down')) + '"]'); if (b && !b.disabled) b.focus(); else { const r = host && host.querySelector('[data-crono-item="' + CSS.escape(g.chave + '|' + o_que) + '"] .crono-seta'); if (r) r.focus(); }
  }
  async function enviar(g, w) {
    if (ocupado || !ordens[g.chave]) return; ocupado = true;
    try {
      const r = await root.fetch('/api/cronograma/ordem', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Cronograma-Token': dados && dados.token || '' }, body: JSON.stringify({ lista: g.chave, ordem: ordens[g.chave] }) });
      const j = await r.json().catch(() => null);
      if (r.ok && j && j.ok) { delete ordens[g.chave]; avisos[g.chave] = { tipo: 'ok', texto: w.enviado(j.hora || clock(new Date().toISOString())) }; }
      else avisos[g.chave] = { tipo: 'erro', texto: (j && j.mensagem) || w.erro };
    } catch { avisos[g.chave] = { tipo: 'erro', texto: w.erro }; }
    finally { ocupado = false; }
    await ler();
  }
  function linhaItem(g, i, w, idxMovel, totalMoveis) {
    const li = el('li', 'crono-item is-' + String(i.historical?'sem':i.estado || 'sem').replace(/\s+/g, '-') + (i.quem ? ' quem-' + i.quem.replace(/\s+/g, '-') : '') + (i.fixo ? ' is-fixo' : ' is-movel'));
    li.dataset.cronoItem = g.chave + '|' + i.o_que;
    const ordenavel = !['historico','semData'].includes(g.chave) && !i.fixo && dados.ordena === true && totalMoveis > 1;
    if (ordenavel) {
      li.draggable = true; li.title = w.arrastar;
      li.addEventListener('dragstart', ev => { arrastando = { chave: g.chave, o_que: i.o_que }; li.classList.add('is-arrastando'); try { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', i.o_que); } catch { /* sem dados */ } });
      li.addEventListener('dragend', () => { arrastando = null; li.classList.remove('is-arrastando'); });
      li.addEventListener('dragover', ev => { if (arrastando && arrastando.chave === g.chave && arrastando.o_que !== i.o_que) { ev.preventDefault(); li.classList.add('is-alvo'); } });
      li.addEventListener('dragleave', () => li.classList.remove('is-alvo'));
      li.addEventListener('drop', ev => { ev.preventDefault(); li.classList.remove('is-alvo'); if (!arrastando || arrastando.chave !== g.chave) return; const atual = ordens[g.chave] || g.itens.filter(x => !x.fixo).map(x => x.o_que); mover(g, arrastando.o_que, atual.indexOf(i.o_que) - atual.indexOf(arrastando.o_que)); arrastando = null; });
    }
    const hora = el('span', 'crono-hora', i.horaFonte === 'atualizacao' ? ({ pt: 'atualizado ', en: 'updated ', es: 'actualizado ' })[lang()] + (i.hora || '?') : g.linhaDoTempo ? (i.hora || '?') : (i.data?i.data+' · ':'? · ')+(i.hora||'?'));
    const corpo = el('div', 'crono-corpo');
    const linha = el('p', 'crono-oque');
    const dot = el('i', 'crono-dot'); if (i.quem) dot.title = w.quem[i.quem]; linha.append(dot, doc.createTextNode(i.o_que));
    corpo.append(linha);
    const meta = el('div', 'crono-meta');
    if(i.statusReason)meta.append(el('span','crono-chip','? '+i.statusReason));
    if(i.historical)meta.append(el('span','crono-chip','? '+({pt:'estado histórico',en:'historical status',es:'estado histórico'})[lang()]));
    if (i.estado && i.estado !== 'feito'&&!i.historical) meta.append(el('span', 'crono-chip chip-' + i.estado.replace(/\s+/g, '-'), w.estado[i.estado]));
    if (g.linhaDoTempo && i.estado && i.estado !== 'feito' && i.horaFonte !== 'atualizacao') { const fim = fimMin(i.hora), agora = agoraMin(); if (fim !== null && agora - fim > 5 && agora - fim < 12 * 60) meta.append(el('span', 'crono-chip chip-passou', w.passou)); }
    if (i.quem && !g.linhaDoTempo) meta.append(el('span', 'crono-quem', w.quem[i.quem]));
    if (i.maxima) meta.append(el('span', 'crono-chip chip-maxima', w.maxima));
    if (i.prazo) meta.append(el('span', 'crono-chip chip-prazo', i.prazo));
    if (i.depende) meta.append(el('span', 'crono-dep', w.depende(i.depende)));
    if (i.fixo && i.estado !== 'feito' && i.horaFonte !== 'atualizacao' && /^\d{2}:\d{2}$/.test(String(i.hora || ''))) meta.append(el('span', 'crono-dep', w.fixo));
    if (meta.childElementCount) corpo.append(meta);
    li.append(hora, corpo);
    if (ordenavel) {
      const setas = el('div', 'crono-setas');
      const up = el('button', 'crono-seta', '↑'); up.type = 'button'; up.setAttribute('aria-label', w.subir(i.o_que)); up.dataset.cronoFoco = g.chave + '|' + i.o_que + '|up'; up.disabled = idxMovel === 0; up.addEventListener('click', () => mover(g, i.o_que, -1));
      const down = el('button', 'crono-seta', '↓'); down.type = 'button'; down.setAttribute('aria-label', w.descer(i.o_que)); down.dataset.cronoFoco = g.chave + '|' + i.o_que + '|down'; down.disabled = idxMovel === totalMoveis - 1; down.addEventListener('click', () => mover(g, i.o_que, 1));
      setas.append(up, down); li.append(setas);
    }
    return li;
  }
  function blocoGrupo(g, w) {
    const sec = el('section', 'crono-grupo');
    if (g.titulo) sec.append(el('h3', 'crono-grupo-titulo', g.titulo));
    const itens = ordenados(g);
    if (!itens.length) { sec.append(el('p', 'crono-vazio', w.vazio)); return sec; }
    const ol = el('ol', 'crono-lista' + (g.linhaDoTempo ? ' is-linha' : ''));
    const totalMoveis = itens.filter(i => !i.fixo).length;
    let k = 0, marcou = !g.linhaDoTempo; const agora = agoraMin();
    // Hoje: os feitos antes do primeiro que falta ficam numa linha so ("7 feitos hoje"), para a hora de agora aparecer logo
    const feitosAntes = g.linhaDoTempo ? itens.findIndex(i => i.estado !== 'feito') : 0, nFeitos = feitosAntes < 0 ? itens.length : feitosAntes;
    if (g.linhaDoTempo && nFeitos > 1) { const li = el('li', 'crono-feitos'); const b = el('button', 'crono-feitos-botao', verFeitos ? w.esconderFeitos : w.feitos(nFeitos)); b.type = 'button'; b.setAttribute('aria-expanded', String(verFeitos)); b.addEventListener('click', () => { verFeitos = !verFeitos; desenhar(); const n = host && host.querySelector('.crono-feitos-botao'); if (n) n.focus(); }); li.append(b); ol.append(li); }
    for (const [pos, i] of itens.entries()) {
      if (g.linhaDoTempo && nFeitos > 1 && pos < nFeitos && !verFeitos) continue;
      if (!marcou) { const ini = inicioMin(i.hora); if (ini !== null && ini > agora && i.estado !== 'feito') { const m = el('li', 'crono-agora'); m.setAttribute('aria-label', w.agora(clock(new Date().toISOString()))); m.append(el('span', null, w.agora(clock(new Date().toISOString())))); ol.append(m); marcou = true; } }
      ol.append(linhaItem(g, i, w, i.fixo ? -1 : k, totalMoveis)); if (!i.fixo) k++;
    }
    if (!marcou) { const m = el('li', 'crono-agora'); m.append(el('span', null, w.agora(clock(new Date().toISOString())))); ol.append(m); }
    sec.append(ol);
    if (ordens[g.chave]) {
      const bar = el('div', 'crono-pedido'); bar.append(el('p', null, w.mudou));
      const b1 = el('button', 'crono-enviar', w.enviar); b1.type = 'button'; b1.disabled = ocupado; b1.addEventListener('click', () => enviar(g, w));
      const b2 = el('button', 'crono-desfazer', w.desfazer); b2.type = 'button'; b2.addEventListener('click', () => { delete ordens[g.chave]; desenhar(); });
      bar.append(b1, b2); sec.append(bar);
    }
    if (avisos[g.chave]) { const p = el('p', 'crono-aviso is-' + avisos[g.chave].tipo, avisos[g.chave].texto); p.setAttribute('role', 'status'); sec.append(p); }
    return sec;
  }
  function desenhar() {
    if (!host) return;
    const w = T[lang()];
    if (!dados || dados.exemplo) { host.hidden = true; return; }
    host.hidden = false;
    const foco = doc.activeElement && host.contains(doc.activeElement) ? doc.activeElement.dataset.cronoFoco || doc.activeElement.id : null;
    const topo = el('div', 'crono-topo');
    const titulo = el('h2', 'crono-titulo', w.titulo); titulo.id = 'crono-titulo';
    const tabs = el('div', 'crono-abas'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-labelledby', 'crono-titulo');
    for (const a of ABAS) { const b = el('button', 'crono-aba', w.abas[a]); b.type = 'button'; b.id = 'crono-aba-' + a; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(a === aba)); b.tabIndex = a === aba ? 0 : -1; b.addEventListener('click', () => { aba = a; try { root.localStorage.setItem(ABA_KEY, a); } catch { /* sem armazenamento */ } desenhar(); const n = doc.getElementById('crono-aba-' + a); if (n) n.focus(); }); b.addEventListener('keydown', ev => { if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return; ev.preventDefault(); const i = ABAS.indexOf(aba), prox = ABAS[(i + (ev.key === 'ArrowRight' ? 1 : ABAS.length - 1)) % ABAS.length]; aba = prox; desenhar(); const n = doc.getElementById('crono-aba-' + prox); if (n) n.focus(); }); tabs.append(b); }
    topo.append(titulo, tabs);
    const at = Date.parse(dados.atualizado || ''), idade = Number.isFinite(at) ? Math.max(0, Math.floor((Date.now() - at) / 60000)) : null;
    const lido = el('p', 'crono-lido' + (idade !== null && idade * 60000 > VELHO_MS ? ' is-velho' : ''), dados.lido === false ? w.semLeitura : (clock(dados.atualizado) ? w.atualizado(clock(dados.atualizado), idade) : '') + (idade !== null && idade * 60000 > VELHO_MS ? ' · ' + w.velho : '') + (dados.estimado ? ' · ' + w.estimado : '') + (dados.lido !== false && dados.plano && dados.plano.velho ? ' · Solução: ' + dados.plano.solucao : ''));
    const legenda = el('p', 'crono-legenda');
    for (const q of ['claude', 'codex', 'ele']) { const s = el('span', 'crono-leg quem-' + q); s.append(el('i', 'crono-dot'), doc.createTextNode(w.quem[q])); legenda.append(s); }
    const corpo = el('div', 'crono-corpo-aba'); corpo.setAttribute('role', 'tabpanel'); corpo.setAttribute('aria-labelledby', 'crono-aba-' + aba);
    if (dados.lido !== false) for (const g of grupos()){if(['historico','semData'].includes(g.chave)){const d=el('details','crono-history');d.append(el('summary','',g.titulo+' · '+g.itens.length),blocoGrupo(g,w));corpo.append(d);}else corpo.append(blocoGrupo(g,w));}
    const nodes = [topo, lido, ...autoLinha(dados), legenda, corpo];if(falhou)nodes.splice(1,0,el('p','crono-lido is-velho',w.semLeitura+' · '+({pt:'último registro preservado',en:'last record preserved',es:'último registro conservado'})[lang()]));
    if (Array.isArray(dados.pedidos) && dados.pedidos.length) { const d = el('details', 'crono-pedidos'); d.append(el('summary', null, w.ultimos + ' (' + dados.pedidos.length + ')')); for (const p of dados.pedidos.slice().reverse()) d.append(el('p', null, p)); nodes.push(d); }
    host.replaceChildren(...nodes);
    if (foco) { const n = host.querySelector('[data-crono-foco="' + CSS.escape(foco) + '"]') || doc.getElementById(foco); if (n) n.focus(); }
  }
  async function ler() {
    if (doc.hidden) return;
    try {
      const r = await root.fetch('/api/cronograma', { cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (!r.ok) throw Error('status'); const j = await r.json();
      if (!j || !j.ok) throw Error('sem dados'); dados = j; falhou = false;
    } catch { falhou = true; }
    if (!arrastando) desenhar();
  }
  function iniciar() {
    if (doc.getElementById('cronograma-casa')) return;
    host = el('section', 'crono'); host.id = 'cronograma-casa'; host.hidden = true; host.setAttribute('aria-labelledby', 'crono-titulo');
    const depois = doc.getElementById('rotina-card') || doc.getElementById('sala-comando');
    if (depois && depois.parentNode) depois.parentNode.insertBefore(host, depois.nextSibling); else { const main = doc.querySelector('main'); if (!main) return; main.prepend(host); }
    ler();
    clearInterval(timer); timer = setInterval(ler, LER_MS);
    setInterval(() => { if (!arrastando && !ocupado) desenhar(); }, 60000);
    doc.addEventListener('visibilitychange', () => { if (!doc.hidden) ler(); });
    const sel = doc.getElementById('language'); if (sel) sel.addEventListener('change', desenhar);
  }
  root.PainelCronograma = Object.freeze({ ler, desenhar, inicioMin });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', iniciar, { once: true }); else iniciar();
})(window);
