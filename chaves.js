'use strict';




(function (root) {
  const M = typeof module === 'object' && module.exports ? require('./chaves-modelo.js') : root.PainelChavesModelo;
  const REGRA = ['Chaves registram suas escolhas para o seu Claude ler. ', 'Ligar ou desligar não inicia nem interrompe trabalho automaticamente. ', 'O Claude confere as dependências e conversa com você antes de agir.'];
  const SOLUCAO = 'peça ao seu Claude para regravar as chaves';
  const T = {
    lendo: 'Lendo as chaves…', exemplo: 'No exemplo as chaves ficam desligadas: elas só mostram dado real.',
    semLeitura: 'Chaves sem leitura agora.', ausente: 'O arquivo das chaves não existe.', invalido: 'O arquivo das chaves está com defeito.', solucao: 'Solução: ',
    todas: 'Todas', filtro: 'Filtrar por sessão', buscar: 'Buscar tarefa', lido: 'lido ', casa: 'lista atualizada ',
    nada: 'nada neste grupo agora', nadaFiltro: 'none: nada neste grupo com esse filtro', de: ' de ',
    semGrupo: ' com estado que a tela não conhece.', naoAchada: 'frase sua que gerou: não achada', sobreTema: 'frase sua sobre o tema',
    ligada: 'ligada', desligada: 'desligada', desfazer: 'Desfazer', abrirCard: 'abrir o card ', card: 'card ',
    ligarQ: 'Ligar ', desligarQ: 'Desligar ', oQueMuda: 'O que muda', pros: 'Prós', contras: 'Contras', semDetalhe: 'sem detalhe gravado para esta item',
    certeza: 'Tem certeza? ', simLigar: 'Sim, ligar', simDesligar: 'Sim, desligar', cancelar: 'Cancelar', teclas: 'Enter confirma · Esc cancela', feito: 'feito: ',
    naoGravou: 'Não gravou. Tente de novo.', naoGravouLeitura: 'Não gravou: esta cópia do painel é só leitura.', naoGravouOcupado: 'Não gravou: outra gravação estava no meio. Tente de novo.',
    naoGravouSumiu: 'Não gravou: essa item saiu da lista.', naoGravouArquivo: 'Não gravou. Solução: ' + SOLUCAO + '.'
  };
  const TEXTOS={pt:{...T},en:{
 lendo:'Reading choices…',exemplo:'Example mode: no real state and no changes.',semLeitura:'Choices could not be read.',ausente:'The choices file does not exist.',invalido:'The choices file is invalid.',solucao:'Fix: ',todas:'All',filtro:'Filter by session',buscar:'Search work',lido:'read ',casa:'list updated ',nada:'none: no work in this group',nadaFiltro:'none: no matches in this group',de:' of ',semGrupo:' with an unknown state.',naoAchada:'your original request: not found',sobreTema:'your request about this topic',ligada:'on',desligada:'off',desfazer:'Undo',abrirCard:'open card ',card:'card ',ligarQ:'Enable ',desligarQ:'Disable ',oQueMuda:'What changes',pros:'Pros',contras:'Cons',semDetalhe:'no effect recorded for this work',certeza:'Are you sure? ',simLigar:'Yes, enable',simDesligar:'Yes, disable',cancelar:'Cancel',teclas:'Enter confirms · Esc cancels',feito:'done: ',naoGravou:'Not saved. Try again.',naoGravouLeitura:'Not saved: this panel is read only.',naoGravouOcupado:'Not saved: another write was in progress.',naoGravouSumiu:'Not saved: this work left the list.',naoGravouArquivo:'Not saved. Ask your Claude to update the choices file.'
 },es:{
 lendo:'Leyendo opciones…',exemplo:'Modo ejemplo: sin datos reales ni cambios.',semLeitura:'No se pudieron leer las opciones.',ausente:'El archivo de opciones no existe.',invalido:'El archivo de opciones no es válido.',solucao:'Solución: ',todas:'Todas',filtro:'Filtrar por sesión',buscar:'Buscar trabajo',lido:'leído ',casa:'lista actualizada ',nada:'none: ningún trabajo en este grupo',nadaFiltro:'none: sin coincidencias en este grupo',de:' de ',semGrupo:' con estado desconocido.',naoAchada:'tu pedido original: no encontrado',sobreTema:'tu pedido sobre el tema',ligada:'activada',desligada:'desactivada',desfazer:'Deshacer',abrirCard:'abrir decisión ',card:'decisión ',ligarQ:'Activar ',desligarQ:'Desactivar ',oQueMuda:'Qué cambia',pros:'Ventajas',contras:'Desventajas',semDetalhe:'sin efecto registrado para este trabajo',certeza:'¿Confirmas? ',simLigar:'Sí, activar',simDesligar:'Sí, desactivar',cancelar:'Cancelar',teclas:'Enter confirma · Esc cancela',feito:'hecho: ',naoGravou:'No se guardó. Intenta de nuevo.',naoGravouLeitura:'No se guardó: este panel es de solo lectura.',naoGravouOcupado:'No se guardó: otra escritura estaba en curso.',naoGravouSumiu:'No se guardó: este trabajo salió de la lista.',naoGravouArquivo:'No se guardó. Pide a tu Claude que actualice las opciones.'
 }};
 const REGRAS={pt:REGRA,en:['Choices are recorded for your Claude to read. ','Enabling or disabling does not start or stop work automatically. ','Claude checks dependencies and talks to you before acting.'],es:['Las opciones se guardan para que tu Claude las lea. ','Activar o desactivar no inicia ni detiene trabajo automáticamente. ','Claude revisa las dependencias y habla contigo antes de actuar.']};
 const GRUPOS={en:{ligada:'Requested, waiting to be read','espera-ele':'Off, waiting for your answer','espera-outra':'Off, waiting for other work',engavetada:'Put aside by you'},es:{ligada:'Solicitadas, pendientes de lectura','espera-ele':'Desactivadas, esperando tu respuesta','espera-outra':'Desactivadas, esperando otro trabajo',engavetada:'Guardadas por ti'}};
 let idioma='pt';function escolherIdioma(doc,lang){const raw=lang||doc.documentElement.lang||'pt';const next=/^en/.test(raw)?'en':/^es/.test(raw)?'es':'pt';const mudou=next!==idioma;idioma=next;Object.assign(T,TEXTOS[next]);return mudou;}
  function el(doc, tag, cls, text) { const n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = String(text); return n; }
  const dois = n => String(n).padStart(2, '0');
  function horaDe(iso) { const d = new Date(iso); return Number.isFinite(d.getTime()) ? dois(d.getDate()) + '/' + dois(d.getMonth() + 1) + ' ' + dois(d.getHours()) + ':' + dois(d.getMinutes()) : '?'; }

  function topoNo(doc) {
    const top = el(doc, 'div', 'ch-top'), regra = el(doc, 'p', 'ch-regra');
    for (const frase of REGRAS[idioma]) regra.append(el(doc, 'span', 'ch-regra-frase', frase));
    top.append(regra); return top;
  }
  function falhaNo(doc, payload) {
    const p = payload || {}, box = el(doc, 'p', 'ch-q');
    const frase = p.erro === 'ausente' ? T.ausente : p.erro === 'invalido' ? T.invalido : T.semLeitura;
    box.append(el(doc, 'b', 'ch-q-marca', '?'), el(doc, 'span', 'ch-q-texto', frase), el(doc, 'span', 'ch-q-fix', T.solucao + (typeof p.solucao === 'string' && p.solucao ? p.solucao : SOLUCAO) + '.'));
    if (p.erro === 'invalido' && typeof p.detalhe === 'string' && p.detalhe) box.append(el(doc, 'span', 'ch-q-detalhe', p.detalhe));
    return box;
  }
  function aspaNo(doc, item) {
    const a = M.aspa(item), p = el(doc, 'p', 'ch-aspa is-' + a.tipo);
    if (a.tipo === 'vazia') p.append(el(doc, 'span', 'ch-aspa-vazia', T.naoAchada));
    else {
      if (a.tipo === 'tema') p.append(el(doc, 'span', 'ch-aspa-rotulo', T.sobreTema));
      const frase = el(doc, 'em', 'ch-aspa-texto', '“' + a.texto + '”'); frase.title = a.texto; p.append(frase);
      if (a.quando) p.append(el(doc, 'span', 'ch-aspa-quando', a.quando));
    }
    if (a.origem) p.append(el(doc, 'span', 'ch-origem', a.origem));
    return p;
  }
  function motivoNo(doc, item, cb) {
    // r11: sem motivo e sem card a linha nao entra (antes ficava um "?" solto embaixo de cada chave)
    if (!(typeof item.motivo === 'string' && item.motivo.trim()) && !(typeof item.card === 'string' && item.card)) return null;
    const p = el(doc, 'p', 'ch-motivo');
    p.append(el(doc, 'span', 'ch-motivo-texto', typeof item.motivo === 'string' ? item.motivo : '?'));
    if (typeof item.card === 'string' && item.card) {
      if (typeof cb.abrirCard === 'function') { const b = el(doc, 'button', 'ch-card', T.abrirCard + item.card); b.type = 'button'; b.addEventListener('click', () => cb.abrirCard(item.card)); p.append(b); }
      else p.append(el(doc, 'span', 'ch-card', T.card + item.card));
    }
    return p;
  }

  function pintarChave(nos, item, pedido) {
    const ligada = !!(item.chave && item.chave.ligada), marca = M.marca(item), pedindo = typeof pedido === 'boolean' && pedido !== ligada;
    nos.inp.checked = pedindo ? pedido : ligada; nos.inp.setAttribute('aria-checked', String(ligada)); nos.inp.setAttribute('aria-label', item.nome + ': ' + (ligada ? T.ligada : T.desligada));
    nos.li.dataset.ligada = String(ligada);
    if (pedindo) nos.li.dataset.pedindo = pedido ? 'ligar' : 'desligar'; else delete nos.li.dataset.pedindo;
    nos.marca.textContent = marca || ''; nos.marca.hidden = !marca;
  }
  function colunaNo(doc, classe, rotulo, itens) {
    const col = el(doc, 'div', 'ch-quadro-col ' + classe), ul = el(doc, 'ul', 'ch-quadro-lista');
    for (const item of itens) ul.append(el(doc, 'li', null, item));
    col.append(el(doc, 'span', 'ch-quadro-rot', rotulo), ul); return col;
  }

  function abrirQuadro(doc, nos, item, ligada) {
    if (!nos.quadro.hidden && nos.quadroPara === ligada) return; // já aberto para esse lado: não refaz (o foco fica onde está)
    const e = M.efeito(item, ligada), titulo = (ligada ? T.ligarQ : T.desligarQ) + item.nome + '?', partes = [el(doc, 'h3', 'ch-quadro-t', titulo)];
    if (e.muda) { const bloco = el(doc, 'div', 'ch-quadro-muda'); bloco.append(el(doc, 'span', 'ch-quadro-rot', T.oQueMuda), el(doc, 'p', 'ch-quadro-muda-texto', e.muda)); partes.push(bloco); }
    if (e.pros.length || e.contras.length) {
      const cols = el(doc, 'div', 'ch-quadro-cols');
      if (e.pros.length) cols.append(colunaNo(doc, 'is-pros', T.pros, e.pros));
      if (e.contras.length) cols.append(colunaNo(doc, 'is-contras', T.contras, e.contras));
      partes.push(cols);
    }
    if (e.vazio) partes.push(el(doc, 'p', 'ch-quadro-vazio', T.semDetalhe));
    const botoes = el(doc, 'div', 'ch-quadro-botoes'), sim = el(doc, 'button', 'ch-sim'), cancelar = el(doc, 'button', 'ch-cancelar', T.cancelar);
    sim.type = 'button'; cancelar.type = 'button';
    sim.append(el(doc, 'span', 'ch-sim-q', T.certeza), el(doc, 'b', 'ch-sim-r', ligada ? T.simLigar : T.simDesligar));
    sim.addEventListener('click', () => nos.aoSim()); cancelar.addEventListener('click', () => nos.aoCancelar());
    botoes.append(sim, cancelar, el(doc, 'span', 'ch-quadro-teclas', T.teclas)); partes.push(botoes);
    nos.quadro.setAttribute('aria-label', titulo); nos.quadro.replaceChildren(...partes); nos.quadro.hidden = false;
    nos.quadroPara = ligada; nos.sim = sim; nos.cancelar = cancelar;
  }
  function fecharQuadro(nos) { if (nos.quadro.hidden) return; nos.quadro.hidden = true; nos.quadro.replaceChildren(); nos.quadroPara = null; nos.sim = null; nos.cancelar = null; }
  function linhaNo(doc, item, cb) {
    const li = el(doc, 'li', 'ch-item'); li.dataset.id = item.id;
    const rot = el(doc, 'label', 'ch-chave'), inp = el(doc, 'input', 'ch-chave-input'), trilho = el(doc, 'span', 'ch-trilho');
    inp.type = 'checkbox'; inp.setAttribute('role', 'switch'); trilho.setAttribute('aria-hidden', 'true'); trilho.append(el(doc, 'span', 'ch-bola')); rot.append(inp, trilho);
    const corpo = el(doc, 'div', 'ch-corpo'), l1 = el(doc, 'div', 'ch-l1'), marca = el(doc, 'span', 'ch-marca'), feito = el(doc, 'p', 'ch-feito');
    const quem = typeof item.quem === 'string' && item.quem.trim() ? item.quem.trim() : typeof item.sessao === 'string' && item.sessao.trim() ? item.sessao.trim() : '?';
    l1.append(el(doc, 'strong', 'ch-nome', item.nome), el(doc, 'span', 'ch-selo', quem), marca);
    const desc = el(doc, 'p', 'ch-desc', typeof item.descricao === 'string' && item.descricao.trim() ? item.descricao.trim() : '?'); desc.title = desc.textContent;
    feito.setAttribute('role', 'status'); feito.hidden = true;
    corpo.append(...[l1, desc, aspaNo(doc, item), motivoNo(doc, item, cb), feito].filter(Boolean));
    const acao = el(doc, 'div', 'ch-acao'), des = el(doc, 'button', 'ch-desfazer', T.desfazer), err = el(doc, 'span', 'ch-erro');
    des.type = 'button'; des.hidden = true; err.setAttribute('role', 'alert'); err.hidden = true; acao.append(des, err);
    const quadro = el(doc, 'div', 'ch-quadro'); quadro.setAttribute('role', 'group'); quadro.hidden = true;
    li.append(rot, corpo, acao, quadro);
    const nos = { li, inp, marca, des, err, feito, quadro, quadroPara: null, sim: null, cancelar: null,
      aoSim: () => { if (typeof cb.onSim === 'function') cb.onSim(item.id); }, aoCancelar: () => { if (typeof cb.onCancelar === 'function') cb.onCancelar(item.id); } };
    pintarChave(nos, item);
    inp.addEventListener('change', () => { if (typeof cb.onVirar === 'function') cb.onVirar(item.id, !!inp.checked); else pintarChave(nos, item); });
    des.addEventListener('click', () => { if (typeof cb.onDesfazer === 'function') cb.onDesfazer(item.id); });

    quadro.addEventListener('keydown', ev => {
      if (!ev || quadro.hidden) return;
      if (ev.key === 'Enter' && !ev.repeat && !ev.isComposing) { ev.preventDefault(); ev.stopPropagation(); nos.aoSim(); }
      else if (ev.key === 'Escape' || ev.key === 'Esc') { ev.preventDefault(); ev.stopPropagation(); nos.aoCancelar(); }
    });
    return nos;
  }
  function grupoNo(doc, g, filtrado, cb, registro) {
    const sec = el(doc, 'section', 'ch-grupo'), h = el(doc, 'h2', 'ch-grupo-t'); sec.dataset.estado = g.estado;
    h.append(el(doc, 'span', 'ch-grupo-nome', (GRUPOS[idioma]&&GRUPOS[idioma][g.estado])||g.titulo), el(doc, 'span', 'ch-grupo-n', filtrado ? g.itens.length + T.de + g.total : String(g.total)));
    sec.append(h);
    if (!g.total) return null; // r11: grupo sem nenhuma chave some, em vez de "0" e "nada aqui"
    if (!g.itens.length) { sec.append(el(doc, 'p', 'ch-nada', filtrado && g.total ? T.nadaFiltro : T.nada)); return sec; }
    const ul = el(doc, 'ul', 'ch-itens');
    for (const t of g.itens) { const nos = linhaNo(doc, t, cb); if (registro) registro.set(t.id, nos); ul.append(nos.li); }
    sec.append(ul); return sec;
  }
  function encherLista(doc, lista, tasks, filtro, cb, registro) {
    const g = M.agrupar(tasks, filtro), partes = [];
    if (g.semGrupo.length) { const aviso = el(doc, 'p', 'ch-q'); aviso.append(el(doc, 'b', 'ch-q-marca', '?'), el(doc, 'span', 'ch-q-texto', g.semGrupo.length + (g.semGrupo.length === 1 ? ' item' : ' tarefas') + T.semGrupo), el(doc, 'span', 'ch-q-fix', T.solucao + SOLUCAO + '.')); partes.push(aviso); }
    for (const x of g.grupos) { const s = grupoNo(doc, x, g.filtrado, cb, registro); if (s) partes.push(s); }
    lista.replaceChildren(...partes);
  }
  function encherChips(doc, chips, tasks, sessao, onSessao) {
    const botoes = [[null, T.todas + ' ' + tasks.length], ...M.sessoes(tasks).map(s => [s.sessao, s.sessao + ' ' + s.n])].map(([valor, rotulo]) => {
      const b = el(doc, 'button', 'ch-chip', rotulo); b.type = 'button'; b.setAttribute('aria-pressed', String((sessao || null) === valor));
      b.addEventListener('click', () => { if (typeof onSessao === 'function') onSessao(valor); });
      return b;
    });
    chips.replaceChildren(...botoes);
  }
  function ferramentasNo(doc, busca) {
    const ferr = el(doc, 'div', 'ch-ferramentas'), chips = el(doc, 'div', 'ch-chips'), caixa = el(doc, 'input', 'ch-busca'), lido = el(doc, 'span', 'ch-lido');
    chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', T.filtro);
    caixa.setAttribute('type', 'search'); caixa.setAttribute('placeholder', T.buscar); caixa.setAttribute('aria-label', T.buscar); caixa.setAttribute('autocomplete', 'off'); caixa.value = busca || '';
    lido.setAttribute('role', 'status'); ferr.append(chips, caixa, lido);
    return { ferr, chips, caixa, lido };
  }
  function casca(doc) { const wrap = el(doc, 'div', 'ch'); wrap.dataset.dsOwned = 'chaves'; wrap.append(topoNo(doc)); return wrap; }
  const bom = payload => !!payload && payload.ok === true && !!payload.dados && Array.isArray(payload.dados.tasks);

  function render(doc, host, payload, opts) {
    const o = opts || {}; escolherIdioma(doc,o.lang); const wrap = casca(doc);
    if (!payload) { wrap.append(el(doc, 'p', 'ch-lendo', T.lendo)); host.replaceChildren(wrap); return { wrap }; }
    if (payload.example) { wrap.append(el(doc, 'p', 'ch-lendo', T.exemplo)); host.replaceChildren(wrap); return { wrap }; }
    if (!bom(payload)) { wrap.append(falhaNo(doc, payload)); host.replaceChildren(wrap); return { wrap }; }
    const f = ferramentasNo(doc, o.busca), lista = el(doc, 'div', 'ch-lista'), linhas = new Map(), tasks = payload.dados.tasks;
    encherChips(doc, f.chips, tasks, o.sessao, o.onSessao);
    f.caixa.addEventListener('input', () => { if (typeof o.onBusca === 'function') o.onBusca(f.caixa.value || ''); });
    f.lido.textContent = T.casa + horaDe(payload.dados.atualizado);
    encherLista(doc, lista, tasks, { sessao: o.sessao, busca: o.busca }, o, linhas);
    wrap.append(f.ferr, lista); host.replaceChildren(wrap);
    return { wrap, lista, linhas, ...f };
  }

  function criar(doc, host, deps) {
    const d = deps || {};
    const st = d.setTimeout || ((fn, ms) => root.setTimeout(fn, ms)), ct = d.clearTimeout || (t => root.clearTimeout(t));
    const focar = typeof d.focar === 'function' ? d.focar : n => { try { if (n && typeof n.focus === 'function') n.focus(); } catch {  } };
    const S = { payload: null, assinatura: null, pintado: false, sessao: null, busca: '', buscas: 0, carregando: false, pendentes: 0, refazer: false, quadro: null, nos: null, linhas: new Map(), ui: new Map() };
    const tarefa = id => (bom(S.payload) ? S.payload.dados.tasks.find(t => t.id === id) : null);
    const cb = () => ({
      onVirar: pedir, onSim: id => { if (S.quadro && S.quadro.id === id) confirmar(); }, onCancelar: id => { if (S.quadro && S.quadro.id === id) cancelar(true); },
      onDesfazer: id => { const u = S.ui.get(id); if (u && u.desfazer) { soltar(); virar(id, u.voltarPara, true); } },
      abrirCard: typeof d.abrirCard === 'function' && (typeof d.podeAbrirCard !== 'function' || d.podeAbrirCard()) ? d.abrirCard : null
    });
    function aplicar(id) {
      const nos = S.linhas.get(id), item = tarefa(id); if (!nos || !item) return;
      const u = S.ui.get(id) || {}, q = S.quadro && S.quadro.id === id ? S.quadro : null;
      pintarChave(nos, item, q ? q.ligada : null);
      if (q) abrirQuadro(doc, nos, item, q.ligada); else fecharQuadro(nos);
      nos.feito.textContent = u.feito || ''; nos.feito.hidden = !u.feito;
      nos.des.hidden = !u.desfazer; nos.err.textContent = u.erro || ''; nos.err.hidden = !u.erro;
    }
    function pintarLista() {
      if (!S.nos || !bom(S.payload)) return;
      S.linhas = new Map();
      encherLista(doc, S.nos.lista, S.payload.dados.tasks, { sessao: S.sessao, busca: S.busca }, cb(), S.linhas);
      for (const id of S.ui.keys()) aplicar(id);
    }
    function pintarChips() { if (S.nos && bom(S.payload)) encherChips(doc, S.nos.chips, S.payload.dados.tasks, S.sessao, valor => { soltar(); S.sessao = valor === S.sessao ? null : valor; pintarChips(); pintarLista(); }); }
    function carimbo() { if (S.nos && bom(S.payload)) { const agora = new Date(); S.nos.lido.textContent = T.lido + dois(agora.getHours()) + ':' + dois(agora.getMinutes()) + ' · ' + T.casa + horaDe(S.payload.dados.atualizado); } }
    function pintar() {
      if(escolherIdioma(doc,d.lang)) S.nos=null;
      if (!bom(S.payload)) { S.quadro = null; S.nos = null; S.linhas = new Map(); render(doc, host, S.payload); return; }
      if (S.sessao && !S.payload.dados.tasks.some(t => t.sessao === S.sessao)) S.sessao = null;
      for (const [id, u] of S.ui) { const t = tarefa(id); if (!t || !t.chave || t.chave.por !== 'ele') { if (u.relogio) ct(u.relogio); if (u.relogioErro) ct(u.relogioErro); S.ui.delete(id); } } // a equipe reclassificou: somem o "feito" e o Desfazer daquela virada
      if (!S.nos) {
        const wrap = casca(doc), f = ferramentasNo(doc, S.busca), lista = el(doc, 'div', 'ch-lista');
        f.caixa.addEventListener('input', () => { soltar(); S.busca = f.caixa.value || ''; pintarLista(); });
        wrap.append(f.ferr, lista); host.replaceChildren(wrap); S.nos = { wrap, lista, chips: f.chips, caixa: f.caixa, lido: f.lido };
      }
      pintarChips(); pintarLista(); carimbo();
    }

    function soltar() { const q = S.quadro; if (!q) return null; S.quadro = null; aplicar(q.id); return q; } // fecha e devolve a chave ao lugar
    function pedir(id, ligada) {
      const item = tarefa(id); if (!item) return;
      if (S.quadro && S.quadro.id !== id) soltar();
      if (!!(item.chave && item.chave.ligada) === ligada) { if (S.quadro) cancelar(false); else aplicar(id); return; } // ele mesmo voltou a chave: conta como cancelar
      S.quadro = { id, ligada }; aplicar(id);
      const nos = S.linhas.get(id); if (nos && nos.cancelar) focar(nos.cancelar); // o padrão seguro
    }
    function cancelar(devolveFoco) {
      const q = soltar(); if (!q) return;
      const nos = S.linhas.get(q.id); if (devolveFoco && nos) focar(nos.inp);
      if (S.refazer && !S.pendentes) { S.refazer = false; carregar(); }
    }
    function confirmar() {
      const q = soltar(); if (!q) return;
      const nos = S.linhas.get(q.id); if (nos) focar(nos.inp);
      virar(q.id, q.ligada, false);
    }

    function falhou(id, antes, resposta) {
      const item = tarefa(id), u = S.ui.get(id) || {};
      if (item) item.chave = antes;
      if (u.relogio) { ct(u.relogio); u.relogio = null; }
      u.desfazer = false; u.feito = null;
      const codigo = resposta && (resposta.erro || resposta.error);
      u.erro = /leitura/i.test(String(codigo || '')) ? T.naoGravouLeitura : codigo === 'ocupado' ? T.naoGravouOcupado : codigo === 'id' ? T.naoGravouSumiu : codigo === 'ausente' || codigo === 'invalido' ? T.naoGravouArquivo : T.naoGravou;
      if (u.relogioErro) ct(u.relogioErro);
      u.relogioErro = st(() => { u.erro = null; u.relogioErro = null; aplicar(id); }, 12000);
      S.ui.set(id, u); aplicar(id);
    }


    function virar(id, ligada, desfazendo) {
      const item = tarefa(id); if (!item || typeof d.gravar !== 'function') return;
      const antes = { ...item.chave }, u = S.ui.get(id) || {}, mostrado = M.efeito(item, ligada).muda;
      item.chave = { ...item.chave, ligada, por: 'ele' };
      if (u.relogio) { ct(u.relogio); u.relogio = null; }
      if (u.relogioErro) { ct(u.relogioErro); u.relogioErro = null; }
      u.erro = null; u.desfazer = false; u.feito = null; u.voltarPara = !!antes.ligada;
      S.ui.set(id, u); aplicar(id);
      S.pendentes++;
      let pedido;
      try { pedido = Promise.resolve(d.gravar(id, ligada)); } catch (e) { pedido = Promise.reject(e); }
      const fim = () => { S.pendentes--; if (!S.pendentes && S.refazer && !S.quadro) { S.refazer = false; carregar(); } };
      pedido.then(r => {
        if (!r || r.ok !== true) { falhou(id, antes, r); fim(); return; }
        const t = tarefa(id);
        if (t) t.chave = { ...t.chave, ligada: typeof r.para === 'boolean' ? r.para : ligada, por: 'ele', quando: r.quando || t.chave.quando };
        if (r.assinatura && S.pendentes === 1) S.assinatura = 'ok:' + r.assinatura; // só esta virada no ar: a próxima leitura igual não redesenha
        if (!desfazendo) {
          u.feito = T.feito + ((typeof r.muda === 'string' && r.muda.trim()) || mostrado || (ligada ? T.ligada : T.desligada));
          u.desfazer = true;
          u.relogio = st(() => { u.desfazer = false; u.feito = null; u.relogio = null; aplicar(id); }, 8000);
        }
        aplicar(id); fim();
      }, () => { falhou(id, antes, null); fim(); });
    }
    async function carregar() {
      if (S.carregando || typeof d.buscar !== 'function') return;
      S.carregando = true; S.buscas++;
      let p;
      try { p = await d.buscar(); } catch { p = { ok: false }; }
      S.carregando = false;
      if (S.pendentes || S.quadro) { S.refazer = true; return; } // virada no ar ou quadro aberto: a leitura nova espera (o texto não muda debaixo dos olhos)
      const assinatura = bom(p) ? 'ok:' + p.assinatura : 'falha:' + JSON.stringify([p && p.erro, p && p.detalhe, !!(p && p.example)]);
      if (S.pintado && assinatura === S.assinatura) { carimbo(); return; }
      S.payload = p; S.assinatura = assinatura; S.pintado = true; pintar();
    }
    return { carregar, pintar, fechar: () => cancelar(false), estado: () => ({ buscas: S.buscas, sessao: S.sessao, busca: S.busca, pendentes: S.pendentes, assinatura: S.assinatura, lido: bom(S.payload), quadro: S.quadro ? S.quadro.id : null }) };
  }

  const api = { render, criar, TEXTOS, REGRA: REGRA.join(''), SOLUCAO };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  root.PainelChaves = api;
  const doc = root.document, host = doc.getElementById('chaves-host'); if (!host) return;
  const html = doc.documentElement, EXEMPLO = /[?&]exemplo=1\b/.test(root.location.search || '');
  let token = '', relogio = null;
  async function buscar() {
    const r = await root.fetch('/api/chaves' + (EXEMPLO ? '?exemplo=1' : ''), { cache: 'no-store', headers: { Accept: 'application/json' } });
    let j = null; try { j = await r.json(); } catch { j = null; }
    if (j && j.ok === true && typeof j.token === 'string') token = j.token;
    return j || { ok: false };
  }

  async function mandar(id, ligada) {
    const r = await root.fetch('/api/chaves/virar', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Chaves-Token': token }, body: JSON.stringify({ id, ligada, confirmado: true }) });
    try { return await r.json(); } catch { return { ok: false }; }
  }

  async function gravar(id, ligada) { let r = await mandar(id, ligada); if (r && r.ok !== true && r.erro === 'token') { try { await buscar(); } catch {  } r = await mandar(id, ligada); } return r; }

  function abrirCard(id) {
    const dlg = doc.getElementById('g-decidir'); if (!dlg || typeof dlg.showModal !== 'function') return false;
    if (!dlg.open) dlg.showModal();
    let alvo = null; try { alvo = dlg.querySelector('[data-foco="titulo:' + root.CSS.escape(id + '.json') + '"]'); } catch { alvo = null; }
    const cartao = alvo && alvo.closest('article'); if (cartao && cartao.scrollIntoView) cartao.scrollIntoView({ block: 'start' });
    return true;
  }
  const tela = criar(doc, host, { buscar, gravar, abrirCard, podeAbrirCard: () => !!doc.getElementById('g-decidir') });
  const ativa = () => html.dataset.painelTab === 'chaves' && !doc.hidden && (!html.classList.contains('esq') || html.dataset.gOld === 'chaves');
  function ritmo() { if (relogio) { root.clearInterval(relogio); relogio = null; } if (ativa()) relogio = root.setInterval(() => tela.carregar(), 30000); }
  function acordar() { ritmo(); if (ativa()) tela.carregar(); else if (html.dataset.painelTab !== 'chaves' || (html.classList.contains('esq') && html.dataset.gOld !== 'chaves')) tela.fechar(); } // saiu da aba com o quadro aberto: conta como cancelar
  tela.pintar();
  doc.addEventListener('painel:tab-change', acordar);
  doc.addEventListener('visibilitychange', acordar);
  root.addEventListener('focus', acordar);

  doc.addEventListener('keydown', ev => { if ((ev.key === 'Escape' || ev.key === 'Esc') && tela.estado().quadro) tela.fechar(); });
  if (typeof root.MutationObserver === 'function') new root.MutationObserver(acordar).observe(html, { attributes: true, attributeFilter: ['data-g-old', 'data-g-new', 'data-painel-tab'] });
  root.addEventListener('pagehide', () => { if (relogio) root.clearInterval(relogio); }, { once: true });
  if(typeof root.MutationObserver==='function') new root.MutationObserver(()=>{tela.pintar();acordar();}).observe(html,{attributes:true,attributeFilter:['lang']});
  acordar();
})(typeof window === 'object' ? window : globalThis);
