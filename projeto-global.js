/* projeto-global.js. SELETOR DE PROJETO GLOBAL na barra de cima, ao lado das abas.
   O projeto selecionado filtra as vistas do painel.
   O botao antigo (projetos.js, PainelProjetos) filtrava o estado do painel antigo; este volta com os ids do ideias.cjs (projeto-de.cjs)
   e vale para todas as abas: "Todos" (padrao) ou 1 projeto. A escolha fica guardada neste navegador (localStorage, com try/catch).
   Quem desenha uma vista pergunta PainelProjetoGlobal.casa(item) e escuta o evento "painel-projeto".
   O nome de cada projeto vem do servidor (/api/projetos-painel): projeto com nome de pessoa da lista de ocultar vira "Projeto parceiro"
   fora do modo dono. So leitura: nada grava no servidor. */
(function (root) {
  'use strict';
  const doc = root.document, html = doc.documentElement, CHAVE = 'painel.projeto';
  const PD = root.PainelProjetoDe;
  if (!PD) return;
  let atual = 'todos', nomes = new Map(PD.PROJETOS.map(p => [p.id, p.nome])), ouvintes = new Set(), aberto = false, legadoRender = null;
  try { const v = root.localStorage.getItem(CHAVE); atual = v === 'todos' ? 'todos' : (PD.idDe(v) || 'todos'); } catch (e) { atual = 'todos'; }
  html.dataset.projeto = atual;
  const nome = id => id === 'todos' ? 'Todos' : nomes.get(id) || PD.nomeDe(id);
  // projeto de um item qualquer: sessao (dona) > pasta > palavra do titulo > Outros. Sessao achada no texto ("chat da ATENDIMENTO") tambem vale.
  const SESS = /\b(ATENDIMENTO|ASSISTENTE|CORTES|CORTES|LOJA)\b/;
  function projetoDe(item) {
    const x = item || {};
    if (x.projeto && PD.idDe(x.projeto)) return PD.idDe(x.projeto);
    const s = String(x.sessao || '').toUpperCase().replace('CORTES', 'CORTES');
    if (PD.SESSAO[s]) return PD.SESSAO[s];
    const m = SESS.exec(String(x.texto || '').toUpperCase()); if (m) return PD.SESSAO[m[1].replace('CORTES', 'CORTES')];
    return PD.porTitulo(x.titulo) || PD.porTitulo(x.texto) || 'outros';
  }
  const casa = item => atual === 'todos' || projetoDe(item) === atual;
  function escolher(id) {
    const v = id === 'todos' ? 'todos' : (PD.idDe(id) || 'todos');
    fechar(); if (v === atual) return;
    atual = v; html.dataset.projeto = v;
    try { root.localStorage.setItem(CHAVE, v); } catch (e) { /* sem armazenamento: vale ate recarregar */ }
    pintar();
    for (const f of ouvintes) { try { f(v); } catch (e) { /* uma vista com erro nao derruba as outras */ } }
    try { root.dispatchEvent(new CustomEvent('painel-projeto', { detail: { projeto: v } })); } catch (e) { /* navegador antigo */ }
    if (legadoRender) { try { legadoRender(); } catch (e) { /* o painel antigo repinta na proxima leitura */ } }
    acertarIdeias();
  }

  // ---------- o controle: "Vendo: Escritorio · trocar" ----------
  let caixa = null, botao = null, lista = null;
  function h(tag, cls, txt) { const n = doc.createElement(tag); if (cls) n.className = cls; if (txt !== undefined) n.textContent = txt; return n; }
  function montar() {
    if (caixa && caixa.isConnected) return true;
    const tabs = doc.querySelector('#g-bar .g-tabs'); if (!tabs) return false;
    caixa = h('div', 'pg-caixa'); caixa.id = 'pg-projeto';
    botao = h('button', 'pg-botao'); botao.type = 'button'; botao.setAttribute('aria-haspopup', 'listbox'); botao.setAttribute('aria-expanded', 'false');
    botao.addEventListener('click', e => { e.stopPropagation(); aberto ? fechar() : abrir(); });
    lista = h('div', 'pg-lista'); lista.setAttribute('role', 'listbox'); lista.setAttribute('aria-label', 'Projeto'); lista.hidden = true;
    caixa.append(botao, lista); tabs.after(caixa);
    doc.addEventListener('click', e => { if (aberto && !caixa.contains(e.target)) fechar(); });
    doc.addEventListener('keydown', e => { if (aberto && e.key === 'Escape') { fechar(); botao.focus(); } });
    pintar(); return true;
  }
  function pintar() {
    if (!botao) return;
    botao.replaceChildren(h('span', 'pg-rot', 'Vendo:'), h('b', 'pg-nome', nome(atual)), h('span', 'pg-trocar', '· trocar'));
    botao.title = 'Projeto que o painel mostra em todas as abas (fica guardado neste navegador)';
    botao.dataset.todos = atual === 'todos' ? '1' : '0';
    lista.replaceChildren(...[{ id: 'todos', nome: 'Todos' }, ...PD.PROJETOS].map(p => {
      const b = h('button', 'pg-op', nome(p.id)); b.type = 'button'; b.setAttribute('role', 'option'); b.dataset.projeto = p.id;
      b.setAttribute('aria-selected', String(p.id === atual)); b.addEventListener('click', () => escolher(p.id)); return b;
    }));
  }
  function abrir() { if (!lista) return; aberto = true; lista.hidden = false; botao.setAttribute('aria-expanded', 'true'); const s = lista.querySelector('[aria-selected="true"]'); if (s) s.focus(); }
  function fechar() { if (!lista) return; aberto = false; lista.hidden = true; botao.setAttribute('aria-expanded', 'false'); }

  // ---------- nomes do servidor (projeto com nome de pessoa: "Projeto parceiro" fora do modo dono) ----------
  function lerNomes() {
    fetch('/api/projetos-painel', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => {
      if (!j || !Array.isArray(j.projetos)) return;
      for (const p of j.projetos) if (p && PD.idDe(p.id) && typeof p.nome === 'string' && p.nome) nomes.set(PD.idDe(p.id), p.nome);
      pintar(); for (const f of ouvintes) { try { f(atual); } catch (e) { /* idem */ } }
    }).catch(() => { /* fica o nome do projeto-de.cjs */ });
  }

  // ---------- painel antigo (Fila, Projetos, Lancamentos, Consumo...): o mesmo filtro antes do filtro antigo ----------
  function filtrarLegado(snap) {
    if (!snap || atual === 'todos') return snap;
    const out = { ...snap, projetoGlobal: atual };
    const dono = t => String(t && t.owner || '').match(/\b(ATENDIMENTO|ASSISTENTE|CORTES|LOJA)\b/);
    const tarefa = t => { const d = dono(t); return d ? PD.SESSAO[d[1]] === atual : projetoDe({ titulo: t && (t.title || t.titulo) }) === atual; };
    for (const k of ['tasks', 'pipelineItems', 'nextItems', 'readyBranches', 'stalledTasks']) if (Array.isArray(snap[k])) out[k] = snap[k].filter(tarefa);
    if (Array.isArray(snap.cards)) out.cards = snap.cards.filter(c => casa({ sessao: c.sessao, titulo: c.pergunta }));
    for (const k of ['needsItems', 'needsAll', 'needsDeferred']) if (Array.isArray(snap[k])) out[k] = snap[k].filter(n => casa({ sessao: n.replySession, titulo: n.title, texto: n.replyWhere }));
    if (snap.launches && Array.isArray(snap.launches.items)) out.launches = { ...snap.launches, items: snap.launches.items.filter(l => casa({ sessao: l.sessao, titulo: l.o_que })) };
    if (snap.operator && Array.isArray(snap.operator.sessions)) out.operator = { ...snap.operator, sessions: snap.operator.sessions.filter(s => { const id = String(s && s.id || '').toUpperCase(); return !PD.SESSAO[id] || PD.SESSAO[id] === atual; }) };
    out.needsTotal = (out.needsAll || out.needsItems || []).length;
    out.needsCount = snap.ownerDecisionSource ? out.needsTotal : (out.cards || []).filter(x => !x.exemplo).length + out.needsTotal;
    return out;
  }
  function ligarLegado() {
    const PP = root.PainelProjetos; if (!PP || PP.__fatia11) return !!PP;
    const filtro = PP.filterSnapshot, render = PP.render;
    try {
      Object.defineProperty(PP, '__fatia11', { value: true });
      PP.filterSnapshot = (snap, id) => filtro(filtrarLegado(snap), id);
      PP.render = (snap, host, options) => { if (options && typeof options.onSelect === 'function') legadoRender = options.onSelect; return render(snap, host, options); };
    } catch (e) { return false; }
    return true;
  }

  // ---------- Decidir > Ideias: o Conselho de Agente abre no projeto escolhido ----------
  function acertarIdeias() {
    const f = doc.querySelector('iframe.ideias-frame'); if (!f) return;
    let u; try { u = new URL(f.getAttribute('src') || 'http://127.0.0.1:3259/'); } catch (e) { return; }
    // o Conselho de Agente chama Web2 de projb
    if (atual === 'todos') u.searchParams.delete('projeto'); else u.searchParams.set('projeto', atual === 'web2' ? 'projb' : atual);
    if (u.toString() !== f.src) f.src = u.toString();
  }

  // ---------- aviso nas vistas que ainda mostram todos os projetos ----------
  const VISTAS_SEM_FILTRO = { council: 'Conselho', radar: 'Radar', tips: 'Hábitos', journey: 'História', finances: 'Finanças', brain: 'Mapa do cérebro', 'mapa-antigo': 'Mapa antigo' };
  function aviso() {
    avisoFila();
    let a = doc.getElementById('pg-aviso');
    const alvo = html.dataset.gNew === 'cerebro' ? 'brain' : html.dataset.gOld || '';
    const sem = atual !== 'todos' && Object.hasOwn(VISTAS_SEM_FILTRO, alvo);
    if (!sem) { if (a) a.hidden = true; return; }
    if (!a) { a = h('p', 'pg-aviso'); a.id = 'pg-aviso'; a.setAttribute('role', 'status'); const sub = doc.getElementById('g-subnav'); if (sub) sub.after(a); else return; }
    a.hidden = false;
    a.textContent = VISTAS_SEM_FILTRO[alvo] + ': esta vista ainda mostra todos os projetos (sem separação por projeto na fonte). Vendo: ' + nome(atual) + '.';
  }
  // Fila: a faixa "Trabalhos registrados / Itens de checklist / Ramos prontos" (upgrade.js) conta o painel inteiro; com 1 projeto
  // escolhido, 1 linha logo abaixo dela diz isso. div (nao p): o upgrade.js embrulha p longo num "Ver mais". So mexe quando muda.
  function avisoFila() {
    const faixa = doc.querySelector('#panel-queue .up-strip'); let a = doc.getElementById('pg-aviso-fila');
    if (atual === 'todos' || !faixa) { if (a && !a.hidden) a.hidden = true; return; }
    if (!a) { a = h('div', 'pg-aviso'); a.id = 'pg-aviso-fila'; a.setAttribute('role', 'status'); }
    if (faixa.nextElementSibling !== a) faixa.after(a);
    const txt = 'Estes 3 números ainda contam todos os projetos. As entregas e a lista de trabalhos mostram só ' + nome(atual) + '.';
    if (a.textContent !== txt) a.textContent = txt;
    if (a.hidden) a.hidden = false;
  }

  let tentativas = 0;
  function iniciar() {
    const ok = montar(); ligarLegado(); acertarIdeias();
    if (!ok && tentativas++ < 60) { setTimeout(iniciar, 250); return; }
    try { new MutationObserver(aviso).observe(html, { attributes: true, attributeFilter: ['data-g-new', 'data-g-old', 'data-projeto'] }); } catch (e) { setInterval(aviso, 1000); }
    aviso();
    // a faixa da Fila nasce e renasce com a leitura: confere a cada 1,5 s so no DOM (nada de rede)
    avisoFila(); setInterval(avisoFila, 1500);
  }
  root.PainelProjetoGlobal = Object.freeze({
    atual: () => atual, nome, escolher, casa, projetoDe, filtrarLegado,
    ouvir: f => { if (typeof f === 'function') ouvintes.add(f); return () => ouvintes.delete(f); }
  });
  lerNomes();
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})(window);
