"use strict";
const $ = (id) => document.getElementById(id),
  keys = ["new", "doing", "ready", "review", "released", "live"];
const words = {
  en: {
    panel: "AGENT PANEL",
    example: "Example",
    local: "On your PC",
    fullscreen: "Full screen",
    onPC: "ON YOUR PC. YOUR AGENTS.",
    queue: "THE QUEUE IS MOVING.",
    usageHero: "YOUR AGENTS, AT A GLANCE.",
    today: "today",
    week: "last 7 days",
    buildBoard: "Build your task board",
    processesUnavailable: "Agent process names are not available yet.",
    detected: "detected agents",
    folderUnknown: "Folder and uptime are unavailable from executable names.",
    you: "YOU",
    live: "LIVE",
    now: "NOW",
    next: "NEXT",
    remaining: "remaining",
    sessions: "SESSIONS",
    recent: "recent history",
    features: "TASKS",
    daily: "Daily usage",
    auto: "Your usage appears automatically.",
    optional:
      "Add a task board when you want a task board. Try the example to see it in motion.",
    seeExample: "See the example",
    needsYou: "NEEDS YOU",
    footer: "Local. Reads every 3 minutes. UTC.",
    details: "DETAILS",
    phase: ["New", "Doing", "Ready", "Review", "Released", "Live"],
    all: "All",
    none: "none",
    unknown: "Open your agent to continue",
    scanning: "Reading usage metadata...",
    read: "phases read",
    noQueue: "No task board yet",
    tokens: "tokens",
    observed:
      "Tokens include input, output and cached input from read sessions. Your agent app shows plan credit.",
    quota: "Your Claude app shows your plan percentage.",
    partial: "Your history is filling in.",
    complete:
      "Recent files scanned. Older unchanged files are outside this view.",
    running: "top-level agent sessions",
    processLimit:
      "Only executable names are read. Node processes cannot be assigned to an agent.",
    saved: "Example choice saved",
    chat: "Review in your agent chat",
    demo: "Example only. No real decision is saved.",
    failure: "Could not refresh local readings.",
    close: "Close",
    refresh: "Refresh",
    session: "Session",
    reset: "Resets",
    recently: "Recently updated",
    inactive: "Recent history",
    working: "Work in motion",
    progress: "Queue progress",
    exampleData: "EXAMPLE. ALL DATA IS FICTIONAL.",
    liveMode: "My PC",
    update: "Live reading",
    try: "Open example",
    reward: "Now live:",
  },
  pt: {
    panel: "PAINEL DE AGENTES",
    example: "Exemplo",
    local: "No seu PC",
    fullscreen: "Tela cheia",
    onPC: "NO SEU PC. SEUS AGENTES.",
    queue: "A FILA ESTÁ ANDANDO.",
    usageHero: "SEUS AGENTES, NUM OLHAR.",
    today: "hoje",
    week: "últimos 7 dias",
    buildBoard: "Monte seu quadro",
    processesUnavailable: "Os nomes dos processos ainda não estão disponíveis.",
    detected: "agentes detectados",
    folderUnknown:
      "Pasta e tempo de execução não estão disponíveis nos nomes dos executáveis.",
    you: "VOCÊ",
    live: "NO AR",
    now: "AGORA",
    next: "PRÓXIMOS",
    remaining: "restante",
    sessions: "SESSÕES",
    recent: "histórico recente",
    features: "TAREFAS",
    daily: "Uso por dia",
    auto: "Seu uso aparece automaticamente.",
    optional:
      "Adicione uma pasta quando quiser um quadro de tarefas. Veja o exemplo para sentir a fila andando.",
    seeExample: "Ver o exemplo",
    needsYou: "PRECISA DE VOCÊ",
    footer: "Local. Lê a cada 3 minutos. UTC.",
    details: "DETALHES",
    phase: ["Nova", "Fazendo", "Pronta", "Revisão", "Liberada", "No ar"],
    all: "Todas",
    none: "nenhum",
    unknown: "Indisponível nos arquivos locais",
    scanning: "Lendo metadados de uso...",
    read: "fases lidas",
    noQueue: "Ainda sem quadro",
    tokens: "tokens observados",
    observed:
      "Arquivos de sessão alterados recentemente, até 200. Tokens incluem entrada, saída e entrada em cache. Essa contagem não é a crédito do plano.",
    quota:
      "A crédito do plano não está disponível nos arquivos de sessão do Claude.",
    partial: "Lendo arquivos recentes. Contagens parciais.",
    complete:
      "Arquivos recentes lidos. Arquivos antigos sem alteração ficam fora desta visão.",
    running: "processos de agentes em execução",
    processLimit:
      "Só nomes de executáveis são lidos. Processos Node não podem ser atribuídos a um agente.",
    saved: "Escolha do exemplo salva",
    chat: "Revise no chat do seu agente",
    demo: "Só exemplo. Nenhuma decisão real é salva.",
    failure: "Não foi possível atualizar as leituras.",
    close: "Fechar",
    refresh: "Atualizar",
    session: "Sessão",
    reset: "Zera",
    recently: "Atualizada há pouco",
    inactive: "Histórico recente",
    working: "Trabalho andando",
    progress: "Progresso da fila",
    exampleData: "EXEMPLO. TODOS OS DADOS SÃO FICTÍCIOS.",
    liveMode: "Meu PC",
    update: "Leitura ao vivo",
    try: "Abrir exemplo",
    reward: "Agora no ar:",
  },
};
let lang = window.PanelLanguageInitial || document.documentElement.lang || 'en';
if (!words[lang] && lang !== "es") lang = "en";
const example = new URLSearchParams(location.search).get("example") === "1";
let data = null,
  filterOwner = "",
  filterExecutor = "",
  filterProject = "",
  selected = "doing",
  busy = false,
  previous = null;
const translate = text => window.PanelLocale?.text(text, lang) ?? text;
const t = (k) => translate((words[lang] || words.en)[k] || k),
  numeric = (x) => typeof x === "number" && Number.isFinite(x),
  el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = translate(text);
    if (cls) n.className = cls;
    return n;
  };
function rawEl(tag,text,cls){const n=el(tag,undefined,cls);if(text!==undefined)n.textContent=text;return n;}
function measured(value) {
  return numeric(value) && value >= 0 ? value.toLocaleString(lang) : (lang === "pt" ? "Aguardando leitura" : "Awaiting reading");
}
function compact(value) {
  return numeric(value) && value >= 0
    ? new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value)
    : "?";
}
function sessionCount(usage) {
  return usage.sessions.length || null;
}
function processCount(counts) {
  return counts && numeric(counts.claude) && numeric(counts.codex)
    ? counts.claude + counts.codex
    : null;
}
function processDetails(usage) {
  return [
    el("p", measured(processCount(usage.processes?.top || usage.processes)) + " " + t("running")),
    el(
      "p",
      "CLAUDE: " +
        measured(usage.processes?.claude) +
        " · CODEX: " +
        measured(usage.processes?.codex),
    ),
    el("p", t("processLimit")),
  ];
}
function formatTime(value) {
  if (!value) return data?.example ? t("example") : "?";
  const d = new Date(value);
  return Number.isFinite(d.getTime())
    ? new Intl.DateTimeFormat(lang, {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(d) + " UTC"
    : "?";
}
function tone(item) {
  return item.needsOwner
    ? "owner"
    : item.phase?.key === "live" || item.percent === 100
      ? "live"
      : item.executor === "codex"
        ? "codex"
        : "claude";
}
function pct(item) {
  return item.phase?.percent ?? item.percent ?? null;
}
function meter(value) {
  const m = el("div", undefined, "mini-meter"),
    i = el("i");
  if (numeric(value)) i.style.setProperty("--amount", value + "%");
  m.append(i);
  return m;
}
function drawer(title, nodes) {
  const modal=$('drawer');
  if(!modal.open)modal.panelReturnFocus=document.activeElement;
  if(!modal.dataset.focusCycle){modal.dataset.focusCycle='on';modal.addEventListener?.('keydown',event=>{if(event.key!=='Tab')return;const controls=[...modal.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(n=>!n.hidden&&n.getClientRects().length);if(!controls.length){event.preventDefault();modal.focus();return;}const first=controls[0],last=controls.at(-1);if(controls.length===1||event.shiftKey&&document.activeElement===first||!event.shiftKey&&document.activeElement===last){event.preventDefault();(event.shiftKey?last:first).focus();}});modal.addEventListener?.('close',()=>{const previous=modal.panelReturnFocus;if(previous?.getClientRects?.().length)previous.focus();else document.querySelector('.clean-more > summary')?.focus();});}

  $("drawer-title").textContent = title;
  $("drawer-body").replaceChildren(...nodes);
  $("drawer").showModal();
  $("close-drawer").focus({preventScroll:true});
}
function title(item) {
  return lang === "pt" && item.titlePT ? item.titlePT : lang === "es" && item.titleES ? item.titleES : item.title;
}
function detail(item) {
  drawer(title(item), [
    el("p", (lang === "pt" && item.summaryPT ? item.summaryPT : lang === "es" && item.summaryES ? item.summaryES : item.summary) || (lang === "pt" ? "Resumo não registrado." : "No summary recorded."), "summary-note"),
    el(
      "p",
      [(lang === "pt" && item.ownerPT ? item.ownerPT : lang === "es" && item.ownerES ? item.ownerES : item.owner) || item.executor || "",
        numeric(pct(item)) ? pct(item) + "%" : t("phase")[0]].filter(Boolean).join(" · "),
    ),
    el(
      "p",
      numeric(pct(item))
        ? t("phase")[
            keys.indexOf(
              item.phase?.key ||
                (item.percent === 100
                  ? "live"
                  : item.percent === 40
                    ? "doing"
                    : "new"),
            )
          ]
        : t("unknown"),
    ),
    el("p", item.deadlineAt ? formatTime(item.deadlineAt) : ""),
  ]);
}
function usageDetail(who) {
  const u=data.usage,total=PanelCore.usageTotals(u),period=PanelR4.period();
  const nodes=[el('p',period,'summary-note'),el('p',lang==='pt'?'Tokens de entrada, saída e cache das sessões lidas.':'Input, output and cached tokens from read sessions.','summary-note')];
  if(who==='claude')nodes.push(el('p',lang==='pt'?'A porcentagem do plano fica no app do Claude. Este painel mede tokens locais, não o crédito da conta.':'Your plan percentage is in the Claude app. This panel measures local tokens, not account credit.','summary-note'),el('p',document.querySelector('[data-metric=claude]').dataset.trend+' · '+(lang==='pt'?'hoje contra ontem, UTC':'today versus yesterday, UTC')));
  else for(const win of u.codex?.windows||[])nodes.push(el('p',Math.round(100-win.used)+'% '+(lang==='pt'?'restante · ':'remaining · ')+(win.minutes>=10000?(lang==='pt'?'janela semanal':'weekly window'):(lang==='pt'?'janela de '+Math.round(win.minutes/60)+' horas':Math.round(win.minutes/60)+'-hour window'))+(win.reset?' · '+t('reset')+' '+formatTime(win.reset):'')));
  const precise=x=>numeric(x)?new Intl.NumberFormat(lang).format(x):measured(x);
  nodes.push(el('p',precise(u[who]?.tokens)+' '+t('tokens')));
  for(const session of u.sessions||[])if(session.agent===who)nodes.push(el('p',session.id+' · '+precise(session.tokens)+' '+t('tokens')));
  if(who==='claude')for(const day of u.daily||[])nodes.push(el('p',day.day+' · '+compact(day.tokens)+' '+t('tokens')+' · UTC'));
  nodes.push(el('p',(lang==='pt'?'Leitura: ':'Read: ')+formatTime(u.updated),'summary-note'));drawer(who==='claude'?(lang==='pt'?'Consumo Claude':'Claude usage'):(lang==='pt'?'Plano Codex':'Codex plan'),nodes);
}
function showSessions(){drawer(lang==='pt'?'Sessões em palavras':'Sessions at a glance',[...processDetails(data.usage),...PanelCore.agents(data).map(a=>el('p',a.id+' · '+measured(a.tokens)+' '+t('tokens')+(a.action?' · '+a.action:'')))]);}
function showDaily(){drawer(t('daily'),[el('p',lang==='pt'?'Claude, por dia UTC. Codex informa o acumulado de cada sessão.':'Claude, by UTC day. Codex reports each session’s cumulative count.','summary-note'),...(data.usage.daily?.length?data.usage.daily.map(day=>el('p',day.day+' · '+compact(day.tokens)+' '+t('tokens')+' · UTC')):[el('p',lang==='pt'?'Abra uma sessão Claude para formar seu histórico.':'Open a Claude session to build your history.')])]);}
function renderBoard() {
  const tasks=data.tasks.filter(x=>(!filterOwner||x.owner===filterOwner)&&(!filterProject||x.projectId===filterProject)&&(!filterExecutor||x.executor===filterExecutor));
  $("board").replaceChildren();$("phase-tabs").replaceChildren();$("task-count").textContent='';
  const groups=[['new',lang==='pt'?'Para fazer':'To do',x=>(pct(x)??0)<40],['doing',lang==='pt'?'Fazendo':'In progress',x=>pct(x)===40],['checking',lang==='pt'?'Conferindo':'Being checked',x=>pct(x)>40&&pct(x)<100],['live',lang==='pt'?'Concluídas':'Finished',x=>pct(x)===100]];
  for(const [key,label,match]of groups){const list=tasks.filter(match);if(!list.length)continue;const col=el('section',undefined,'phase-column'+(key==='doing'?' selected':'')),heading=el('div',undefined,'phase-heading');col.dataset.phase=key;heading.append(el('span',label));col.append(heading);const cards=el('div',undefined,'phase-list');for(const item of list){const button=el('button',undefined,'feature '+tone(item));const person=(lang==='pt'?item.ownerPT||item.owner:lang==='es'?item.ownerES||item.owner:item.owner),who=person==='TEAM'?(lang==='pt'?'Equipe':'Team'):person;const by=[who,item.executor==='claude'?'Claude Code':item.executor==='codex'?'Codex':''].filter(Boolean).join(' · ');if(by)button.append(el('span',by,'task-session'));button.append(rawEl('strong',title(item)));if(item.needsOwner)button.append(el('span',lang==='pt'?'Esperando sua decisão':'Waiting for your decision','decision-wait'));button.onclick=()=>detail(item);cards.append(button);}col.append(cards);$("board").append(col);}
  if(!tasks.length)$("board").append(el('p',lang==='pt'?'Nenhuma tarefa combina com estes filtros. Escolha Todas ou troque o agente.':'No tasks match these filters. Choose All or change the agent.','filter-empty summary-note'));
  for(const button of document.querySelectorAll('[data-executor]'))button.setAttribute('aria-pressed',String(filterExecutor===button.dataset.executor));
}
function renderUsageHero(usage) {
  const daily = usage.daily || [];
  const date = (usage.updated || new Date().toISOString()).slice(0, 10);
  const cutoff = new Date(Date.parse(date) - 6 * 86400000)
    .toISOString()
    .slice(0, 10);
  const readable = numeric(usage.claude?.tokens);
  const today =
    daily.find((entry) => entry.day === date)?.tokens ?? (readable ? 0 : null);
  const week = readable
    ? daily
        .filter((entry) => entry.day >= cutoff && entry.day <= date)
        .reduce(
          (sum, entry) => sum + (numeric(entry.tokens) ? entry.tokens : 0),
          0,
        )
    : null;
  const processes = usage.processes;
  const agents =
    processes?.agents ||
    ["claude", "codex"]
      .filter((name) => numeric(processes?.[name]) && processes[name] > 0)
      .map((name) => ({ name, count: processes[name] }));
  const count = processCount(processes?.top || processes);
  const detected = agents.reduce((sum, agent) => sum + agent.count, 0);
  $("hero-title").textContent = t("usageHero");
  $("total-percent").textContent = numeric(count)
    ? String(count)
    : detected
      ? detected + "+"
      : "?";
  if (typeof PanelV2 === "undefined") $("progress-note").textContent = t("running");
  $("traveler").style.setProperty("--amount", "50%");
  $("pipeline").replaceChildren();
  $("pipeline").style.setProperty("--segments", 2);
  const windows = usage.codex?.windows || [];
  const quota = windows.find((window) => window.minutes >= 10000) || windows[0];
  for (const [agent, text, amount] of [
    [
      "codex",
      "CODEX · " +
        (quota
          ? Math.round(quota.used) +
            "% · " +
            t("reset") +
            " " +
            formatTime(quota.reset)
          : "?"),
      quota?.used,
    ],
    [
      "claude",
      "CLAUDE · " +
        measured(today) +
        " " +
        t("today") +
        " · " +
        measured(week) +
        " " +
        t("week"),
      null,
    ],
  ]) {
    const segment = el(
      "button",
      undefined,
      "segment " + agent + " usage-segment",
    );
    const fill = el("div", undefined, "fill");
    fill.style.setProperty("--amount", (amount || 0) + "%");
    segment.append(fill, el("span", text, "usage-label"));
    segment.onclick = () => usageDetail(agent);
    $("pipeline").append(segment);
  }
  $("claude-summary-title").textContent = t("today") + " · " + t("tokens");
  $("claude-ring").firstElementChild.textContent = compact(today);
  $("claude-note").textContent =
    measured(today) +
    " " +
    t("today") +
    " · " +
    measured(week) +
    " " +
    t("week") +
    " · " +
    t("tokens");
  $("now").replaceChildren();
  for (const agent of agents) {
    const item = el("button", undefined, "work-item " + agent.name);
    item.append(
      el("span", agent.name.toUpperCase(), "actor"),
      el("strong", String(agent.count) + " " + t("detected")),
    );
    item.onclick = () =>
      drawer(agent.name.toUpperCase(), [
        el("p", t("folderUnknown")),
        el("p", t("processLimit")),
      ]);
    $("now").append(item);
  }
  if (!agents.length)
    $("now").append(
      el(
        "p",
        numeric(count) && count === 0 ? t("none") : t("processesUnavailable"),
        "empty",
      ),
    );
  const invitation = el(
    "a",
    t("buildBoard") + " · " + t("seeExample"),
    "work-item",
  );
  invitation.href = "/?example=1&lang=" + lang;
  $("next").replaceChildren(invitation);
}
function render() {
  document.documentElement.lang = lang;
  document
    .querySelectorAll("[data-t]")
    .forEach((n) => (n.textContent = t(n.dataset.t)));
  $("language").value = lang;
  $("refresh").ariaLabel = t("refresh");
  $("close-drawer").ariaLabel = t("close");
  if (!data) { $("example-toggle").textContent = t("example"); if (typeof PanelV2 !== "undefined") PanelV2.loading(lang); return; }
  if (typeof PanelV2 !== "undefined") {
    document.title = "Lazy Du | " + t("panel");
    $("example-badge").hidden = !data.example;
    $("example-toggle").textContent = data.example ? t("liveMode") : t("example");
    $("example-toggle").href = data.example ? "/?lang=" + lang : "/?example=1&lang=" + lang;
    $("owner-filters").replaceChildren();
    for (const owner of ["", ...new Set(data.tasks.map(x => x.owner).filter(Boolean))]) {
      const label = owner ? (owner === "TEAM" ? (lang === "pt" ? "Equipe" : "Team") : lang === "pt" ? data.tasks.find(x => x.owner === owner)?.ownerPT || owner : owner) : t("all");
      const b = el("button", label, "filter");
      b.setAttribute("aria-pressed", String(filterOwner === owner));
      b.onclick = () => { filterOwner = owner; render(); };
      $("owner-filters").append(b);
    }
    $("owner-filters").hidden = !data.tasks.some(x => x.owner);
    $("filters").hidden = !data.tasks.length;
    $("phase-tabs").hidden = !data.tasks.length;
    $("board").hidden = !data.tasks.length;
    renderBoard();
    PanelV2.render(data, lang);
    if (typeof PanelWelcome !== "undefined") PanelWelcome.render(data, lang);
    if (typeof DuSync !== "undefined") DuSync.update(data, lang);
    return;
  }
  const demo = data.example,
    items = [...data.queue, ...data.tasks],
    known = items.filter((x) => numeric(pct(x))),
    total = known.length
      ? known.reduce((n, x) => n + pct(x), 0) / known.length
      : null;
  $("hero-title").textContent = items.length ? t("queue") : t("usageHero");
  $("eyebrow").textContent = demo ? t("exampleData") : t("onPC");
  $("example-badge").hidden = !demo;
  $("example-toggle").textContent = demo ? t("liveMode") : t("example");
  $("example-toggle").href = demo
    ? "/?lang=" + lang
    : "/?example=1&lang=" + lang;
  $("total-percent").textContent = numeric(total)
    ? Math.round(total) + "%"
    : "?";
  if (typeof PanelV2 === "undefined") $("progress-note").textContent = items.length
    ? known.length + "/" + items.length + " " + t("read")
    : t("noQueue");
  $("pipeline").replaceChildren();
  $("pipeline").style.setProperty("--segments", Math.max(1, items.length));
  $("traveler").style.setProperty("--amount", (total || 0) + "%");
  for (const item of items) {
    const button = el(
        "button",
        undefined,
        "segment " +
          tone(item) +
          (pct(item) === 40 ? " active" : "") +
          (!numeric(pct(item)) ? " unknown" : ""),
      ),
      fill = el("div", undefined, "fill");
    fill.style.setProperty("--amount", (pct(item) || 0) + "%");
    button.append(fill);
    button.title =
      title(item) + " · " + (numeric(pct(item)) ? pct(item) + "%" : "?");
    button.ariaLabel = button.title;
    button.onclick = () => detail(item);
    $("pipeline").append(button);
  }
  for (const [id, list] of [
    ["now", items.filter((x) => pct(x) === 40)],
    ["next", items.filter((x) => pct(x) === 0).slice(0, 5)],
  ]) {
    const host = $(id);
    host.replaceChildren();
    for (const item of list) {
      const button = el("button", undefined, "work-item " + tone(item));
      button.append(
        el("span", item.executor.toUpperCase(), "actor"),
        el("strong", title(item)),
        meter(pct(item)),
      );
      button.onclick = () => detail(item);
      host.append(button);
    }
    if (!list.length) host.append(el("p", t("none"), "empty"));
  }
  const usage = data.usage;
  for (const who of ["claude", "codex"]) {
    const windows = usage[who]?.windows || [],
      w = windows.find((x) => x.minutes >= 10000) || windows[0],
      left = w ? 100 - w.used : null;
    const ring = $(who + "-ring");
    ring.style.setProperty("--amount", (left || 0) + "%");
    ring.firstElementChild.textContent = numeric(left)
      ? Math.round(left) + "%"
      : "?";
    $(who + "-note").textContent =
      who === "claude"
        ? measured(usage.claude?.tokens) + " " + t("tokens")
        : w?.reset
          ? t("reset") + " " + formatTime(w.reset)
          : t("unknown");
  }
  if (!demo && !data.configured) renderUsageHero(usage);
  $("sessions-ring").firstElementChild.textContent = measured(
    sessionCount(usage),
  );
  $("sessions-ring").style.setProperty("--amount", "100%");
  $("process-note").textContent =
    measured(processCount(usage.processes?.top || usage.processes)) +
    " " +
    t("running");
  $("status").textContent = demo
    ? t("example")
    : usage.scanning
      ? t("scanning")
      : formatTime(usage.updated);
  $("owner-filters").replaceChildren();
  for (const owner of ["", ...new Set(data.tasks.map((x) => x.owner))]) {
    const label = owner ? (lang === "pt" ? data.tasks.find(x => x.owner === owner)?.ownerPT || owner : owner) : t("all");
    const b = el("button", label, "filter");
    b.setAttribute("aria-pressed", String(filterOwner === owner));
    b.onclick = () => {
      filterOwner = owner;
      render();
    };
    $("owner-filters").append(b);
  }
  renderBoard();
  $("empty-task board").hidden = items.length > 0;
  $("filters").hidden = !data.tasks.length;
  $("phase-tabs").hidden = !data.tasks.length;
  $("board").hidden = !data.tasks.length;
  $("deadline-strip").replaceChildren();
  for (const item of data.tasks.filter((x) => x.deadlineAt || x.deadlineIn)) {
    const b = el("button", undefined, "deadline-pill");
    b.append(
      el("span", title(item)),
      el(
        "strong",
        demo ? item.deadlineIn + " min" : formatTime(item.deadlineAt),
      ),
    );
    b.onclick = () => detail(item);
    $("deadline-strip").append(b);
  }
  $("move-count").textContent = data.cards.length;
  $("cards").replaceChildren();
  for (const card of data.cards) {
    const box = el("article", undefined, "choice");
    box.append(el("span", t("example"), "eyebrow"), el("h3", title(card)));
    if (card.chat) box.append(el("p", t("chat"), "chat-note"));
    else
      for (const option of lang === "pt" && card.optionsPT
        ? card.optionsPT
        : card.options) {
        const b = el("button", option);
        b.onclick = () => {
          box.querySelectorAll("button").forEach((x) => (x.disabled = true));
          $("toast").textContent = t("saved");
          $("toast").hidden = false;
          setTimeout(() => ($("toast").hidden = true), 2200);
        };
        box.append(b);
      }
    box.append(el("p", t("demo"), "chat-note"));
    $("cards").append(box);
  }
  if (!data.cards.length) $("cards").append(el("p", t("none"), "empty"));
  document.title = "Lazy Du | " + t("panel");
  if (typeof PanelV2 !== "undefined") PanelV2.render(data, lang);
  if (typeof PanelWelcome !== "undefined") PanelWelcome.render(data, lang);
  if (typeof DuSync !== "undefined") DuSync.update(data, lang);
}
async function refresh(force=false) {
  if (typeof window !== 'undefined' && window.PanelShutdown) return;
  if (busy) return;
  busy = true;
  try {
    const url = "/api/status" + (example ? "?example=1&size=" + (new URLSearchParams(location.search).get("size") || "large") : force===true?"?refresh=1":"");
    const next = window.PanelStartup ? await window.PanelStartup.readStatus(url) : await fetch(url).then(response => { if (!response.ok) throw Error(); return response.json(); });
    if (previous) {
      const newLive = next.tasks.find(
        (x) =>
          x.phase.key === "live" &&
          previous.has(x.id) &&
          previous.get(x.id) !== "live",
      );
      if (newLive) {
        $("toast").textContent = t("reward") + " " + newLive.title;
        $("toast").hidden = false;
        $("toast").className = "celebrate";
        setTimeout(() => ($("toast").hidden = true), 2500);
      }
    }
    previous = new Map(next.tasks.map((x) => [x.id, x.phase.key]));
    data = next;
    if (!next.example && (next.usage.scanning || next.usage.pending))
      setTimeout(refresh, 1000);
    render();
  } catch (error) {
    if (error?.message === "READ_TIMEOUT") window.PanelStartup?.failed?.("slow");
    $("status").textContent = t("failure");
    if (!data || data.usage?.pending || data.usage?.scanning) setTimeout(refresh, 1000);
    if (typeof PanelV2 !== "undefined") PanelV2.failure();
  } finally {
    busy = false;
  }
}
$("language").onchange = () => {
  lang = $("language").value;
  try { localStorage.setItem("agent-panel-language", lang); } catch {}
  if (typeof PanelWelcome !== "undefined") PanelWelcome.language(lang);
  render();
};
$("refresh").onclick = () => refresh(true);
$("close-drawer").onclick = () => $("drawer").close();
$("claude-metric").onclick = () => data && usageDetail("claude");
$("codex-metric").onclick = () => data && usageDetail("codex");
$("sessions-metric").onclick = () => data && showSessions();
$("daily").onclick = () => data && showDaily();
$("progress-note").onclick = () =>
  data &&
  drawer(
    t("progress"),
    [...data.queue, ...data.tasks].map((x) => {
      const b = el(
        "button",
        title(x) + " · " + (numeric(pct(x)) ? pct(x) + "%" : "?"),
        "drawer-row",
      );
      b.onclick = () => {
        $("drawer").close();
        detail(x);
      };
      return b;
    }),
  );
$("fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {}
};
for (const b of document.querySelectorAll("[data-executor]"))
  b.onclick = () => {
    filterExecutor =
      filterExecutor === b.dataset.executor ? "" : b.dataset.executor;
    renderBoard();
  };
if (typeof window !== "undefined") {
  window.panelDrawer = drawer;
  window.panelDetail = detail;
  window.panelProject = (id) => { filterProject = id; renderBoard(); };
  window.panelToast = (text) => { $("toast").textContent = text; $("toast").hidden = false; setTimeout(() => $("toast").hidden = true, 2500); };
}
render();
refresh();
setInterval(refresh, 30000);
