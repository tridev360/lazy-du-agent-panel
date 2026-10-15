'use strict';
// mostra a recompensa e troca o nome da aba. Cada conceito (ia-a.js, ia-b.js, ia-c.js) se registra com
// IAConceito.registrar(chave, { rotulo:{pt,en,es}, usaEstado:bool, desenhar(host, ctx) }).
// No painel local salva por POST /api/ia-conceito/copiei; no painel publico (snapshot.public) salva no navegador.
// O modulo antigo (#ia-tips) continua no HTML e so fica escondido (html.iac-on).
(function (root) {
  const doc = root.document;
  const conceitos = new Map();
  const CHAVE_SOM = 'painel-feed-muted-v1', CHAVE_PUBLICO = 'painel-ia-copiados-v1';
  // que falta (a copia daqui e aos poucos), sem apagar nada; confirma em 1 linha; sem a pasta pessoal (nuvem), avisa e para.
  const INSTRUCAO = {
    pt: n => (n === 1 ? 'Salve a regra abaixo no meu arquivo de regras global, para valer em todos os meus projetos: ' : 'Salve as regras abaixo no meu arquivo de regras global, para valerem em todos os meus projetos: ') +
      '~/.claude/CLAUDE.md se você é o Claude Code, ou ~/.codex/AGENTS.md se você é o Codex. Coloque numa seção que começa com o título "## Painel Agent Panel". Se essa seção já existir, só acrescente nela o que ainda não está lá. Crie o arquivo se ele não existir. Não apague nem mude mais nada. Depois confirme em 1 linha. Se daqui você não alcança a minha pasta pessoal (por exemplo, numa sessão na nuvem), diga isso em 1 linha e pare.',
    en: n => (n === 1 ? 'Save the rule below in my global rules file so it applies to all my projects: ' : 'Save the rules below in my global rules file so they apply to all my projects: ') +
      '~/.claude/CLAUDE.md if you are Claude Code, or ~/.codex/AGENTS.md if you are Codex. Put ' + (n === 1 ? 'it' : 'them') + ' in a section that starts with the title "## Painel Agent Panel". If that section already exists, only add what is not there yet. Create the file if it does not exist. Do not delete or change anything else. Then confirm in one line. If you cannot reach my home folder from here (for example, in a cloud session), say so in one line and stop.',
    es: n => (n === 1 ? 'Guarda la regla de abajo en mi archivo de reglas global, para que valga en todos mis proyectos: ' : 'Guarda las reglas de abajo en mi archivo de reglas global, para que valgan en todos mis proyectos: ') +
      '~/.claude/CLAUDE.md si eres Claude Code, o ~/.codex/AGENTS.md si eres Codex. ' + (n === 1 ? 'Ponla' : 'Ponlas') + ' en una sección que empiece con el título "## Painel Agent Panel". Si esa sección ya existe, solo agrega lo que todavía no está. Crea el archivo si no existe. No borres ni cambies nada más. Después confirma en 1 línea. Si desde aquí no llegas a mi carpeta personal (por ejemplo, en una sesión en la nube), dilo en 1 línea y detente.'
  };
  const W = {
    pt: {
      copiar: 'Copiar', copiado: 'Copiado', copiadoCole: 'Copiado. Cole em qualquer conversa do Claude Code que roda no seu computador.', copiadosCole: n => n + ' copiados. Cole em qualquer conversa do Claude Code que roda no seu computador.',
      textoManual: 'Texto completo para copiar', erroCopia: 'Não deu para copiar. Selecione e copie o texto completo abaixo.', erroSalvar: 'Copiado, mas o painel não salvou. Tente de novo.',
      semLeitura: 'Sem leitura das dicas agora. O painel tenta de novo sozinho.', tentar: 'Tentar agora', lendo: 'Lendo as dicas',
      vazio: 'Nenhuma dica cadastrada ainda.', emUso: 'Em uso', verTexto: 'Ver o texto', esconder: 'Esconder o texto', porque: 'Por quê',
      som: on => 'Som ' + (on ? 'on' : 'off'), todasCopiadas: 'Todas copiadas', bloco: 'Siga estas regras de trabalho em toda tarefa:',
      usoNovo: t => 'Sua IA usou de verdade: ' + t + '.', hoje: 'hoje', ontem: 'ontem', ha: n => 'há ' + n + ' dias', exemplo: 'Modo exemplo: copia, mas não salva.', publico: 'Salvo neste navegador.'
    },
    en: {
      copiar: 'Copy', copiado: 'Copied', copiadoCole: 'Copied. Paste it into any Claude Code chat running on your computer.', copiadosCole: n => n + ' copied. Paste them into any Claude Code chat running on your computer.',
      textoManual: 'Full text to copy', erroCopia: 'Could not copy. Select and copy the full text below.', erroSalvar: 'Copied, but the panel did not save it. Try again.',
      semLeitura: 'Tips are not readable right now. The panel retries on its own.', tentar: 'Try now', lendo: 'Reading the tips',
      vazio: 'No tips yet.', emUso: 'In use', verTexto: 'Show the text', esconder: 'Hide the text', porque: 'Why',
      som: on => 'Sound ' + (on ? 'on' : 'off'), todasCopiadas: 'All copied', bloco: 'Follow these working rules on every task:',
      usoNovo: t => 'Your AI really used it: ' + t + '.', hoje: 'today', ontem: 'yesterday', ha: n => n + ' days ago', exemplo: 'Example mode: copies, does not save.', publico: 'Saved in this browser.'
    },
    es: {
      copiar: 'Copiar', copiado: 'Copiado', copiadoCole: 'Copiado. Pégalo en cualquier conversación de Claude Code que corra en tu ordenador.', copiadosCole: n => n + ' copiados. Pégalos en cualquier conversación de Claude Code que corra en tu ordenador.',
      textoManual: 'Texto completo para copiar', erroCopia: 'No se pudo copiar. Selecciona y copia el texto completo de abajo.', erroSalvar: 'Copiado, pero el panel no lo guardó. Inténtalo de nuevo.',
      semLeitura: 'Los consejos no se pueden leer ahora. El panel lo intenta solo.', tentar: 'Intentar ahora', lendo: 'Leyendo los consejos',
      vazio: 'Todavía no hay consejos.', emUso: 'En uso', verTexto: 'Ver el texto', esconder: 'Ocultar el texto', porque: 'Por qué',
      som: on => 'Sonido ' + (on ? 'on' : 'off'), todasCopiadas: 'Todos copiados', bloco: 'Follow these working rules on every task:',
      usoNovo: t => 'Tu IA lo usó de verdad: ' + t + '.', hoje: 'hoy', ontem: 'ayer', ha: n => 'hace ' + n + ' días', exemplo: 'Modo ejemplo: copia, no guarda.', publico: 'Guardado en este navegador.'
    }
  };
  const GRUPO_DO_TEMA = { economia: 'gastar', qualidade: 'errar', equipe: 'equipe', produtividade: 'organizar', decisao: 'organizar' };
  const GRUPOS = { gastar: { pt: 'Gastar menos', en: 'Spend less', es: 'Gastar menos' }, errar: { pt: 'Errar menos', en: 'Fewer mistakes', es: 'Menos errores' }, equipe: { pt: 'Trabalhar em equipe', en: 'Teamwork', es: 'Trabajo en equipo' }, organizar: { pt: 'Organizar', en: 'Stay organized', es: 'Organizar' } };
  const ORDEM_RARIDADE = { lendaria: 4, epica: 3, rara: 2, comum: 1 };

  const st = { dados: null, erro: false, lendo: false, copiados: new Set(), emUso: new Set(), host: null, chave: null, ultimoEstado: null, aberto: new Set(), feitos: new Map(), status: '', statusTipo: '', copiaManual: null, desenhadoEm: 0, apertando: false, usoNovo: [] };

  const snap = () => { try { return typeof latestSnapshot !== 'undefined' && latestSnapshot ? latestSnapshot : null; } catch { return null; } };
  const lingua = () => { const valor = doc.getElementById('language')?.value || doc.documentElement.lang || 'pt'; return W[valor] ? valor : 'pt'; };
  const el = (tag, classe, texto) => { const node = doc.createElement(tag); if (classe) node.className = classe; if (texto !== undefined && texto !== null) node.textContent = texto; return node; };
  const svg = (tag, attrs) => { const node = doc.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, String(v)); return node; };
  const movimento = () => doc.documentElement.dataset.motion !== 'off' && !root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const mudo = () => { try { return root.localStorage.getItem(CHAVE_SOM) === '1'; } catch { return false; } };
  const publico = () => snap()?.public === true;
  // No modo exemplo do painel (?exemplo=1) a rota tambem vai em exemplo: nada real aparece e nada e salvo.
  const rota = caminho => caminho + (/[?&]exemplo=1(?:&|$)/.test(root.location.search) ? '?exemplo=1' : '');

  function numero(valor, lang) {
    if (!Number.isFinite(valor)) return '?';
    const pt = lang !== 'en', abs = Math.abs(valor);
    const corta = (n, casas) => n.toLocaleString(pt ? 'pt-BR' : 'en-US', { maximumFractionDigits: casas, minimumFractionDigits: 0 });
    if (abs >= 1e9) return corta(valor / 1e9, abs >= 1e11 ? 0 : abs >= 1e10 ? 1 : 2) + (pt ? ' bi' : 'B');
    if (abs >= 1e6) return corta(valor / 1e6, abs >= 1e8 ? 0 : 1) + (pt ? ' mi' : 'M');
    return corta(Math.round(valor), 0);
  }
  function quando(iso, lang) {
    const ms = Date.parse(iso || ''); if (!Number.isFinite(ms)) return null;
    const dia = t => new Date(t - 3 * 3600000).toISOString().slice(0, 10);
    const dias = Math.round((Date.parse(dia(Date.now()) + 'T12:00Z') - Date.parse(dia(ms) + 'T12:00Z')) / 86400000), w = W[lang];
    return dias <= 0 ? w.hoje : dias === 1 ? w.ontem : w.ha(dias);
  }

  // ---------- dados ----------
  function dadosDoEstado(snapshot) {
    const feed = snapshot?.feeding; if (!feed || !Array.isArray(feed.tips)) return null;
    const dicas = feed.tips.filter(t => t && typeof t.id === 'string' && t.pt?.colar && t.en?.colar).map(t => ({ id: t.id, grupo: GRUPO_DO_TEMA[t.tema] || 'organizar', raridade: ORDEM_RARIDADE[t.raridade] ? t.raridade : 'comum', xp: t.xp || 10, pt: t.pt, en: t.en }));
    return { ok: true, dicas, grupos: GRUPOS, copiados: Array.isArray(feed.collected) ? feed.collected : [], emUso: Array.isArray(feed.bonusTips) ? feed.bonusTips : [],bonusUnavailable:feed.bonusUnavailable===true, ultimaCopia: feed.lastFedAt || null, nonce: snapshot.nonce || null, exemplo: snapshot.example === true, doEstado: true };
  }
  function lerPublico() { try { const salvo = JSON.parse(root.localStorage.getItem(CHAVE_PUBLICO) || '[]'); return Array.isArray(salvo) ? salvo.filter(id => typeof id === 'string').slice(0, 100) : []; } catch { return []; } }
  function aplicar(dados) {
    // Selo novo de uso real (o detector achou o texto numa conversa) desde a ultima leitura: vira recompensa na tela.
    const antes = st.dados && !publico() ? new Set(st.emUso) : null;
    st.dados = dados; st.erro = false;
    st.copiados = new Set(publico() ? lerPublico() : dados.copiados || []);
    st.emUso = new Set(publico() ? [] : dados.emUso || []);
    if (antes) st.usoNovo = [...st.emUso].filter(id => !antes.has(id));
  }
  async function ler() {
    if (st.lendo) return; st.lendo = true;
    try {
      const resposta = await root.fetch(rota('/api/ia-conceito'), { cache: 'no-store' });
      if (!resposta.ok) throw Error('sem rota');
      const dados = await resposta.json(); if (!dados?.ok || !Array.isArray(dados.dicas)) throw Error('formato');
      aplicar(dados);
    } catch {
      const doEstado = dadosDoEstado(snap());
      if (doEstado) aplicar(doEstado); else st.erro = true;
    } finally { st.lendo = false; desenhar(); celebrarUso(); }
  }
  function celebrarUso() {
    const ids = st.usoNovo || []; st.usoNovo = []; if (!ids.length || !st.dados) return;
    const lang = lingua(), dica = st.dados.dicas.find(d => d.id === ids[0]); if (!dica) return;
    mostrar(W[lang].usoNovo((lang === 'pt' ? dica.pt : dica.en).titulo), 'ok'); desenhar();
    tocar([330, 495, 660], 0.02);
    if (!movimento() || !st.host) return;
    for (const id of ids) for (const node of st.host.querySelectorAll('[data-iac-id="' + id + '"]')) { node.classList.add('iac-usou'); node.addEventListener('animationend', () => node.classList.remove('iac-usou'), { once: true }); }
  }

  // ---------- copiar e salvar ----------
  function textoDe(dica, lang) { return (lang === 'pt' ? dica.pt : dica.en).colar; }
  function bloco(dicas, lang) {
    const instrucao = (INSTRUCAO[lang] || INSTRUCAO.pt)(dicas.length) + '\n\n';
    if (dicas.length === 1) return instrucao + textoDe(dicas[0], lang);
    return instrucao + W[lang].bloco + '\n\n' + dicas.map((dica, i) => (i + 1) + '. ' + textoDe(dica, lang)).join('\n');
  }
  async function paraAreaDeTransferencia(texto) {
    try { if (root.navigator?.clipboard?.writeText) { await root.navigator.clipboard.writeText(texto); return true; } } catch { /* tenta o outro jeito */ }
    try {
      const area = el('textarea', 'iac-escondido'); area.value = texto; area.setAttribute('readonly', ''); doc.body.append(area); area.select();
      const ok = doc.execCommand('copy'); area.remove(); return ok;
    } catch { return false; }
  }
  async function salvar(ids) {
    if (publico()) { for (const id of ids) st.copiados.add(id); try { root.localStorage.setItem(CHAVE_PUBLICO, JSON.stringify([...st.copiados])); } catch { /* fica na tela */ } return true; }
    if (st.dados?.exemplo || snap()?.example === true) return true;
    const nonce = st.dados?.nonce || snap()?.nonce; if (!nonce) return false;
    try {
      const resposta = await root.fetch(rota('/api/ia-conceito/copiei'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Painel-Nonce': nonce }, body: JSON.stringify({ ids }) });
      const dados = await resposta.json();
      if (!resposta.ok || !dados.ok) return false;
      aplicar({ ...st.dados, ...dados }); return true;
    } catch { return false; }
  }
  async function copiar(ids, origem) {
    const lang = lingua(), w = W[lang], dicas = ids.map(id => st.dados?.dicas.find(d => d.id === id)).filter(Boolean);
    if (!dicas.length) return;
    const antes = new Set(st.copiados), chaveFoco = origem?.dataset?.iacFoco || null;
    acordarSom();
    const texto = bloco(dicas, lang);
    if (!await paraAreaDeTransferencia(texto)) { st.copiaManual = { texto, lang }; mostrar(w.erroCopia, 'erro'); desenhar(chaveFoco); return; }
    st.copiaManual = null;
    const salvo = await salvar(dicas.map(d => d.id));
    const novos = dicas.map(d => d.id).filter(id => !antes.has(id));
    for (const d of dicas) st.feitos.set(d.id, Date.now());
    if (chaveFoco) st.feitos.set('foco:' + chaveFoco, Date.now());
    mostrar(!salvo ? w.erroSalvar : dicas.length > 1 ? w.copiadosCole(dicas.length) : w.copiadoCole, salvo ? 'ok' : 'erro');
    const completou = novos.length > 0 && st.dados.dicas.every(d => st.copiados.has(d.id));
    desenhar(chaveFoco);
    recompensa(novos, completou);
    root.setTimeout(() => desenhar(), 2600);
  }
  function mostrar(texto, tipo) { st.status = texto; st.statusTipo = tipo; root.clearTimeout(mostrar.t); mostrar.t = root.setTimeout(() => { st.status = ''; st.statusTipo = ''; desenhar(); }, 5200); }

  // ---------- som e recompensa (dentro do mudo e do Movimento off) ----------
  let audio = null;
  function acordarSom() { if (mudo()) return; try { const Ctx = root.AudioContext || root.webkitAudioContext; if (Ctx) { audio ||= new Ctx(); audio.resume?.(); } } catch { /* sem som */ } }
  function tocar(notas, volume) {
    if (mudo() || !audio || (audio.state && audio.state !== 'running')) return;
    try {
      const t = audio.currentTime, ganho = audio.createGain(); ganho.connect(audio.destination);
      ganho.gain.setValueAtTime(0, t); ganho.gain.linearRampToValueAtTime(volume, t + 0.015); ganho.gain.exponentialRampToValueAtTime(0.0001, t + 0.12 * notas.length + 0.3);
      notas.forEach((hz, i) => { const o = audio.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(hz, t + i * 0.08); o.connect(ganho); o.start(t + i * 0.08); o.stop(t + 0.12 * notas.length + 0.32); });
    } catch { /* sem som */ }
  }
  function recompensa(novos, completou) {
    tocar(completou ? [2 * 261.63, 659, 784, 1047] : novos.length ? [392, 2 * 261.63] : [440], completou ? 0.03 : 0.022);
    const host = st.host; if (!host || !movimento()) return;
    const marcar = (alvo, classe) => { if (!alvo) return; alvo.classList.remove(classe); void alvo.offsetWidth; alvo.classList.add(classe); alvo.addEventListener('animationend', () => alvo.classList.remove(classe), { once: true }); };
    for (const id of novos) for (const node of host.querySelectorAll('[data-iac-id="' + id + '"]')) marcar(node, 'iac-ganhou');
    if (novos.length) { for (const node of host.querySelectorAll('[data-iac-conta]')) marcar(node, 'iac-subiu'); for (const node of host.querySelectorAll('[data-iac-agente]')) marcar(node, 'iac-pulo'); }
    const agente = host.querySelector('[data-iac-agente]');
    if (agente && novos.length) {
      const pop = el('span', 'iac-mais', '+' + novos.length); agente.append(pop); pop.addEventListener('animationend', () => pop.remove(), { once: true });
      if (completou) for (let i = 0; i < 8; i++) { const brilho = el('span', 'iac-brilho', '✦'); brilho.style.setProperty('--iac-angulo', (i * 45) + 'deg'); agente.append(brilho); brilho.addEventListener('animationend', () => brilho.remove(), { once: true }); }
    }
  }

  // ---------- desenho ----------
  function contexto() {
    const lang = lingua(), dados = st.dados;
    return {
      lang, w: W[lang], el, svg, numero: v => numero(v, lang), quando: iso => quando(iso, lang), snapshot: snap(),
      dicas: dados?.dicas || [], grupos: dados?.grupos || GRUPOS, agentes: dados?.agentes || [], ultimaCopia: dados?.ultimaCopia || null,
      bonusUnavailable:dados?.bonusUnavailable===true||snap()?.feeding?.bonusUnavailable===true,copiados: st.copiados, emUso: st.emUso, aberto: st.aberto, publico: publico(), exemplo: dados?.exemplo === true,
      textoDe: d => textoDe(d, lang), cortes: d => (lang === 'pt' ? d.pt : d.en), raridade: r => ORDEM_RARIDADE[r] || 1,
      acabouDeCopiar: chave => Date.now() - (st.feitos.get(chave) || 0) < 2400,
      copiar: (ids, origem) => copiar(ids, origem),
      alternar: (id, origem) => { if (st.aberto.has(id)) st.aberto.delete(id); else st.aberto.add(id); desenhar(origem?.dataset?.iacFoco || null); },
      redesenhar: chaveFoco => desenhar(chaveFoco),
      botaoCopiar: (ids, chave, rotulo, classe) => {
        const feito = Date.now() - (st.feitos.get('foco:' + chave) || 0) < 2400;
        const b = el('button', (classe || 'iac-copiar') + (feito ? ' is-feito' : '')); b.type = 'button'; b.dataset.iacFoco = chave;
        b.append(el('span', 'iac-copiar-texto', feito ? W[lang].copiado : rotulo || W[lang].copiar));
        b.addEventListener('click', () => copiar(ids, b)); return b;
      },
      status: () => {
        const p = el('p', 'iac-status' + (st.statusTipo ? ' is-' + st.statusTipo : ''), st.status || (dados?.exemplo ? W[lang].exemplo : publico() ? W[lang].publico : ''));
        p.setAttribute('role', st.statusTipo === 'erro' ? 'alert' : 'status'); p.hidden = !p.textContent;
        if (!st.copiaManual || st.copiaManual.lang !== lang) return p;
        const caixa = el('div', 'iac-copia-manual'), label = el('label', null, W[lang].textoManual), area = el('textarea', 'iac-colar');
        area.id = 'iac-copia-manual'; area.value = st.copiaManual.texto; area.readOnly = true; area.rows = 10;
        label.htmlFor = area.id; area.style.width = '100%'; area.style.maxWidth = '100%'; area.style.boxSizing = 'border-box';
        area.addEventListener('click', () => area.select()); caixa.append(p, label, area); return caixa;
      },
      chipEmUso: () => el('span', 'iac-chip', W[lang].emUso)
    };
  }
  function escolhido() {
    const pedido = new URLSearchParams(root.location.search).get('conceito') || doc.documentElement.dataset.iaConceito || '';
    if (conceitos.has(pedido)) return pedido;
    return conceitos.keys().next().value || null;
  }
  function desenhar(chaveFoco) {
    const host = st.host; if (!host) return;
    st.desenhadoEm = Date.now();
    const chave = escolhido(), conceito = conceitos.get(chave); if (!conceito) return;
    st.chave = chave; host.dataset.conceito = chave;
    const foco = chaveFoco !== undefined ? chaveFoco : doc.activeElement?.closest?.('#ia-conceito') ? doc.activeElement.dataset?.iacFoco || null : null;
    const lang = lingua(), w = W[lang];
    host.replaceChildren();
    if (st.erro && !st.dados) {
      const caixa = el('div', 'iac-cartao iac-vazio'); caixa.append(el('p', null, w.semLeitura));
      const b = el('button', 'iac-copiar', w.tentar); b.type = 'button'; b.addEventListener('click', ler); caixa.append(b); host.append(caixa);
    } else if (!st.dados) {
      const caixa = el('div', 'iac-cartao iac-esqueleto'); caixa.setAttribute('aria-label', w.lendo);
      for (let i = 0; i < 4; i++) caixa.append(el('span', 'iac-osso'));
      host.append(caixa);
    } else if (!st.dados.dicas.length) {
      const caixa = el('div', 'iac-cartao iac-vazio'); caixa.append(el('p', null, w.vazio)); host.append(caixa);
    } else {
      try { conceito.desenhar(host, contexto()); } catch (erro) { console.warn('ia conceito', erro); }
    }
    rotularAba();
    if (foco) host.querySelector('[data-iac-foco="' + foco + '"]')?.focus({ preventScroll: true });
  }

  // ---------- aba, menu de ajustes, montagem ----------
  function rotularAba() {
    const aba = doc.getElementById('tab-tips'), conceito = conceitos.get(st.chave); if (!aba || !conceito) return;
    const nome = conceito.rotulo[lingua()] || conceito.rotulo.pt; if (aba.textContent !== nome) aba.textContent = nome;
  }
  function botaoSom() {
    const opcoes = doc.getElementById('panel-settings-options'); if (!opcoes || doc.getElementById('iac-som')) return;
    const b = el('button', 'iac-som'); b.id = 'iac-som'; b.type = 'button';
    const pintar = () => { b.textContent = W[lingua()].som(!mudo()); b.setAttribute('aria-pressed', String(mudo())); };
    b.addEventListener('click', () => { try { root.localStorage.setItem(CHAVE_SOM, mudo() ? '0' : '1'); } catch { /* sem armazenamento */ } pintar(); });
    opcoes.append(b); pintar();
    new MutationObserver(pintar).observe(doc.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  function montar() {
    const secao = doc.getElementById('panel-tips'); if (!secao || doc.getElementById('ia-conceito')) return;
    doc.documentElement.classList.add('iac-on');
    const host = el('div', 'iac'); host.id = 'ia-conceito'; secao.prepend(host); st.host = host;
    host.addEventListener('pointerdown', () => { st.apertando = true; }); doc.addEventListener('pointerup', () => { st.apertando = false; }); doc.addEventListener('pointercancel', () => { st.apertando = false; });
    const aba = doc.getElementById('tab-tips'); if (aba) new MutationObserver(rotularAba).observe(aba, { childList: true, characterData: true, subtree: true });
    doc.getElementById('language')?.addEventListener('change', () => root.setTimeout(() => desenhar(), 0));
    new MutationObserver(() => desenhar()).observe(doc.documentElement, { attributes: true, attributeFilter: ['lang'] });
    doc.addEventListener('painel:tab-change', evento => { if (evento.detail?.tab === 'tips') { ler(); desenhar(); } });
    // O conceito que le o estado ao vivo (Raio-x) redesenha quando chega estado novo e a aba esta aberta.
    root.setInterval(() => {
      const atual = snap(), conceito = conceitos.get(st.chave);
      if (!conceito?.usaEstado || atual === st.ultimoEstado || secao.hidden || doc.hidden) return;
      // Numero ao vivo sem roubar o clique: no maximo a cada 10 s e nunca com o mouse em cima ou o dedo apertando.
      if (st.ultimoEstado && (Date.now() - st.desenhadoEm < 10000 || st.host?.matches(':hover') || st.apertando)) return;
      st.ultimoEstado = atual; desenhar();
    }, 1500);
    root.setInterval(() => { if (!secao.hidden && !doc.hidden) ler(); }, 60000);
    botaoSom(); desenhar(); ler();
  }
  root.IAConceito = { registrar(chave, conceito) { conceitos.set(chave, conceito); if (st.host) desenhar(); }, W, numero, quando, bloco };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', montar, { once: true }); else root.setTimeout(montar, 0);
})(window);
