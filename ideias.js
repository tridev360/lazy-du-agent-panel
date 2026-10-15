'use strict';
(() => {
  const host = document.getElementById('ideias-panel'); if (!host) return;
  const names = { claude: 'Claude', codex: 'Codex', 'coordenador-claude': 'Claude', 'coordenador-codex': 'Codex', dono: 'Você' };
  const projects = {};
  const effort = { P: 'Pequeno', M: 'Médio', G: 'Grande' };
  let last = null, loading = false, stopped = false, opener = null;
  function el(tag, cls, body) { const node = document.createElement(tag); if (cls) node.className = cls; if (body !== undefined) node.textContent = body; return node; }
  function clock(at) { const date = new Date(at); return Number.isFinite(+date) ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', hourCycle: 'h23' }).format(date) : 'Sem horário'; }
  const heading = el('div', 'ideias-heading'), title = el('h2', '', 'Ideias'); title.id = 'ideias-title';
  const all = el('button', 'ideias-open', 'Ver ideias'); all.type = 'button'; all.disabled = true;
  heading.append(title, all);
  const state = el('p', 'ideias-reading', 'Lendo o quadro de ideias…'); state.setAttribute('role', 'status');
  const cards = el('div', 'ideias-grid'), progress = el('p', 'ideias-progress');
  host.append(heading, el('p', 'ideias-intro', 'As sessões propõem e discutem. As decisões ficam registradas no seu estado.'), state, cards, progress);
  const dialog = el('dialog', 'ideias-dialog'); dialog.setAttribute('aria-labelledby', 'ideias-dialog-title');
  const bar = el('div', 'ideias-heading'), dialogTitle = el('h2', '', 'Quadro de ideias'); dialogTitle.id = 'ideias-dialog-title';
  const close = el('button', '', 'Fechar'); close.type = 'button'; bar.append(dialogTitle, close);
  const filterLabel = el('label', 'ideias-filter', 'Projeto '), filter = el('select'); filter.setAttribute('aria-label', 'Filtrar ideias por projeto');
  for (const [key, label] of [['', 'Todos'], ...Object.entries(projects)]) { const option = el('option', '', label); option.value = key; filter.append(option); }
  filterLabel.append(filter);
  async function projectNames() {
    try {
      const response = await fetch('/api/projetos-painel', { cache: 'no-store' });
      const dto = await response.json();
      if (!response.ok || !Array.isArray(dto.projetos)) return;
      for (const p of dto.projetos) if (typeof p.id === 'string' && typeof p.nome === 'string') projects[p.id] = p.nome;
      if (last) render(last);
    } catch { /* os ids escritos no estado continuam legiveis */ }
  }
  function projectOptions(dto) {
    const selected = filter.value, ids = new Set([...Object.keys(projects), ...dto.ideas.map(i => i.project)]);
    const allProjects = el('option', '', 'Todos'); allProjects.value = ''; filter.replaceChildren(allProjects);
    for (const id of ids) { const option = el('option', '', projects[id] || id.replace(/[-_]+/g, ' ')); option.value = id; filter.append(option); }
    if (ids.has(selected)) filter.value = selected;
  }
  const statusLabel = el('label', 'ideias-filter', 'Situação '), status = el('select'); status.setAttribute('aria-label', 'Filtrar ideias por situação');
  for (const [key, label] of [['', 'Todas'], ['em discussão', 'Em discussão'], ['escolhida', 'Escolhida'], ['virou card', 'Virou card'], ['guardada', 'Guardada'], ['descartada', 'Descartada']]) { const option = el('option', '', label); option.value = key; status.append(option); }
  statusLabel.append(status); const list = el('div', 'ideias-list'); dialog.append(bar, filterLabel, statusLabel, list); document.body.append(dialog);
  function ideaCard(idea, detail = false) {
    const card = el('article', 'ideia');
    card.append(el('p', 'ideia-meta', `${names[idea.author] || 'Sem autoria'} · ${projects[idea.project] || 'Outros'} · ${clock(idea.at)}`), el('h3', '', idea.title));
    const stateText = idea.decision ? ({ escolhida: 'Escolhida', 'virou card': 'Virou card', guardada: 'Guardada', descartada: 'Descartada' }[idea.decision.state] || 'Em discussão') : 'Em discussão';
    card.append(el('span', 'ideia-state', stateText), el('p', '', idea.why));
    if (detail) {
      const facts = el('dl');
      for (const [label, value] of [['Como', idea.how], ['Esforço', effort[idea.effort] || 'Sem medida'], ['Ganho esperado', idea.gain]]) facts.append(el('dt', '', label), el('dd', '', value));
      card.append(facts);
      if (idea.decision) card.append(el('p', 'ideia-decision', `${names[idea.decision.author]}: ${idea.decision.body}`));
      if (idea.codexOpinion) card.append(el('p', 'ideia-opinion', `Parecer do Codex: ${idea.codexOpinion.body}`));
      if (idea.debates.length) { card.append(el('h4', '', 'Conversa')); for (const debate of idea.debates) card.append(el('p', 'ideia-debate', `${names[debate.author]} · ${debate.position}: ${debate.body}`)); }
    } else if (idea.debates.length) card.append(el('small', '', `${idea.debates.length} ${idea.debates.length === 1 ? 'comentário' : 'comentários'} na conversa`));
    return card;
  }
  function renderList() {
    list.replaceChildren(); const ideas = (last?.ideas || []).filter(idea => (!filter.value || idea.project === filter.value) && (!status.value || (idea.decision?.state || 'em discussão') === status.value));
    if (!ideas.length) { list.append(el('p', '', 'Nenhuma ideia com esses filtros.')); return; }
    for (const idea of ideas) list.append(ideaCard(idea, true));
  }
  function render(dto) {
    cards.replaceChildren();
    const shown = dto.ideas.slice(0, 3); for (const idea of shown) cards.append(ideaCard(idea));
    if (!shown.length) cards.append(el('p', 'ideias-empty', dto.sourceState === 'partial' ? 'Nenhuma ideia pôde ser exibida nesta leitura.' : 'Ainda não há ideias registradas.'));
    const noun = dto.sourceState === 'partial' ? 'legível' : 'registrada';
    const count = dto.total === 1 ? `1 ideia ${noun}` : `${dto.total} ideias ${noun === 'legível' ? 'legíveis' : 'registradas'}`;
    state.textContent = `${dto.example ? 'Exemplo fictício · ' : ''}${count} · Lido em ${clock(dto.readAt)}${dto.sourceState === 'partial' ? ' · Algumas linhas não puderam ser exibidas.' : ''}`;
    progress.textContent = dto.progress[0] ? `${names[dto.progress[0].author]} · ${clock(dto.progress[0].at)}: ${dto.progress[0].body}` : '';
    all.disabled = false; all.textContent = dto.total > 60 ? 'Ver 60 ideias' : 'Ver ideias'; renderList();
  }
  function valid(dto) {
    return dto?.ok === true && Number.isInteger(dto.total) && dto.total >= 0 && Array.isArray(dto.ideas) && dto.ideas.length <= 60 && Array.isArray(dto.progress) && dto.ideas.every(idea => typeof idea.title === 'string' && typeof idea.why === 'string' && Array.isArray(idea.debates));
  }
  async function load() {
    if (loading || stopped || document.hidden) return; loading = true;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const suffix = new URLSearchParams(location.search).get('exemplo') === '1' ? '?exemplo=1' : '';
      const response = await fetch('/api/ideias' + suffix, { method: 'GET', signal: controller.signal, redirect: 'error', cache: 'no-store' });
      const dto = await response.json(); if (!response.ok || !valid(dto)) throw new Error('READ');
      last = dto; projectOptions(dto); render(dto);
    } catch {
      state.textContent = last ? `Não foi possível atualizar o quadro. Última leitura: ${clock(last.readAt)}.` : 'Sem leitura do quadro de ideias. Tente atualizar o painel.';
    } finally { clearTimeout(timeout); loading = false; }
  }
  all.addEventListener('click', () => { opener = all; renderList(); dialog.showModal(); close.focus(); });
  close.addEventListener('click', () => dialog.close()); dialog.addEventListener('close', () => opener?.focus());
  filter.addEventListener('change', renderList);
  status.addEventListener('change', renderList);
  document.addEventListener('painel:tab-change', event => { if (event.detail?.tab === 'home') load(); });
  const timer = setInterval(() => { if (!document.getElementById('panel-home')?.hidden) load(); }, 60000);
  window.addEventListener('pagehide', () => { stopped = true; clearInterval(timer); }, { once: true });
  projectNames(); load();
})();
