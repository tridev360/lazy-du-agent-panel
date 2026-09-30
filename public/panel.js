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
    features: "FEATURES",
    daily: "Daily usage",
    auto: "Your usage appears automatically.",
    optional:
      "Add a workspace when you want a task board. Try the example to see it in motion.",
    seeExample: "See the example",
    needsYou: "NEEDS YOU",
    footer: "Local. Refreshes every 30 seconds. UTC.",
    details: "DETAILS",
    phase: ["New", "Doing", "Ready", "Review", "Released", "Live"],
    all: "All",
    none: "none",
    unknown: "Not available in local files",
    scanning: "Reading usage metadata...",
    read: "phases read",
    noQueue: "No workspace yet",
    tokens: "observed tokens",
    observed:
      "Recently modified session files, up to 200. Tokens include input, output and cached input. These counts are not the account quota.",
    quota: "Account quota is not available from Claude session files.",
    partial: "Reading recent files. Counts are partial.",
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
    features: "FEATURES",
    daily: "Uso por dia",
    auto: "Seu uso aparece automaticamente.",
    optional:
      "Adicione uma pasta quando quiser um quadro de tarefas. Veja o exemplo para sentir a fila andando.",
    seeExample: "Ver o exemplo",
    needsYou: "PRECISA DE VOCÊ",
    footer: "Local. Atualiza a cada 30 segundos. UTC.",
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
      "Arquivos de sessão alterados recentemente, até 200. Tokens incluem entrada, saída e entrada em cache. Essa contagem não é a cota da conta.",
    quota:
      "A cota da conta não está disponível nos arquivos de sessão do Claude.",
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
let lang = ["en", "pt"].includes(
  new URLSearchParams(location.search).get("lang"),
)
  ? new URLSearchParams(location.search).get("lang")
  : localStorage.getItem("agent-panel-language") || "en";
if (!words[lang]) lang = "en";
const example = new URLSearchParams(location.search).get("example") === "1";
let data = null,
  filterOwner = "",
  filterExecutor = "",
  selected = "doing",
  busy = false,
  previous = null;
const t = (k) => words[lang][k] || k,
  numeric = (x) => typeof x === "number" && Number.isFinite(x),
  el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
function measured(value) {
  return numeric(value) && value >= 0 ? value.toLocaleString(lang) : "?";
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
  $("drawer-title").textContent = title;
  $("drawer-body").replaceChildren(...nodes);
  $("drawer").showModal();
}
function title(item) {
  return lang === "pt" && item.titlePT ? item.titlePT : item.title;
}
function detail(item) {
  drawer(title(item), [
    el(
      "p",
      (item.owner || item.executor || "") +
        " · " +
        (numeric(pct(item)) ? pct(item) + "%" : "?"),
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
  const u = data.usage,
    credit = u[who];
  drawer(who.toUpperCase(), [
    el(
      "p",
      credit?.windows?.length
        ? credit.windows
            .map(
              (w) =>
                w.used +
                "% · " +
                w.minutes +
                " min · " +
                (w.reset ? formatTime(w.reset) : "?"),
            )
            .join("\n")
        : t("quota"),
    ),
    el("p", measured(credit?.tokens) + " " + t("tokens")),
    el("p", t("observed")),
    el("p", u.complete ? t("complete") : t("partial")),
    ...u.sessions
      .filter((x) => x.agent === who)
      .map((s) =>
        el(
          "p",
          t("session") +
            " " +
            s.id +
            " · " +
            measured(s.tokens) +
            " " +
            t("tokens") +
            " · " +
            formatTime(s.updated),
        ),
      ),
  ]);
}
function showSessions() {
  const u = data.usage;
  drawer(t("sessions"), [
    el("p", measured(sessionCount(u)) + " " + t("sessions")),
    ...processDetails(u),
    el("p", t("observed")),
    el("p", u.complete ? t("complete") : t("partial")),
    ...u.sessions.map((s) =>
      el(
        "p",
        s.agent.toUpperCase() +
          " · " +
          t("session") +
          " " +
          s.id +
          " · " +
          measured(s.tokens) +
          " " +
          t("tokens") +
          " · " +
          formatTime(s.updated) +
          " · " +
          (s.recent ? t("recently") : t("inactive")),
      ),
    ),
  ]);
}
function showDaily() {
  drawer(t("daily"), [
    ...(data.usage.daily.length ? [] : [el("p", "? " + t("tokens"))]),
    el("p", t("observed")),
    el("p", data.usage.complete ? t("complete") : t("partial")),
    ...data.usage.daily.map((d) =>
      el(
        "p",
        d.day + " · " + measured(d.tokens) + " " + t("tokens") + " · UTC",
      ),
    ),
  ]);
}
function renderBoard() {
  const tasks = data.tasks.filter(
    (x) =>
      (!filterOwner || x.owner === filterOwner) &&
      (!filterExecutor || x.executor === filterExecutor),
  );
  $("task-count").textContent = tasks.length;
  $("board").replaceChildren();
  $("phase-tabs").replaceChildren();
  for (const [idx, key] of keys.entries()) {
    const list = tasks.filter((x) => x.phase.key === key),
      tab = el("button", t("phase")[idx] + " " + list.length);
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(key === selected));
    tab.onclick = () => {
      selected = key;
      renderBoard();
    };
    $("phase-tabs").append(tab);
    const col = el(
      "section",
      undefined,
      "phase-column" + (key === selected ? " selected" : ""),
    );
    col.dataset.phase = key;
    const heading = el("div", undefined, "phase-heading");
    heading.append(el("span", t("phase")[idx]), el("b", list.length));
    col.append(heading);
    const cards = el("div", undefined, "phase-list");
    for (const item of list) {
      const button = el("button", undefined, "feature " + tone(item));
      if (item.color) button.style.setProperty("--accent", item.color);
      button.append(
        el(
          "span",
          item.owner + " · " + item.executor.toUpperCase(),
          "task-session",
        ),
        el("strong", title(item)),
        meter(pct(item)),
        el("span", numeric(pct(item)) ? pct(item) + "%" : "?", "task-foot"),
      );
      button.onclick = () => detail(item);
      cards.append(button);
    }
    col.append(cards);
    $("board").append(col);
  }
  for (const b of document.querySelectorAll("[data-executor]"))
    b.setAttribute(
      "aria-pressed",
      String(filterExecutor === b.dataset.executor),
    );
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
  $("progress-note").textContent = t("running");
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
  if (!data) return;
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
  $("progress-note").textContent = items.length
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
    const b = el("button", owner || t("all"), "filter");
    b.setAttribute("aria-pressed", String(filterOwner === owner));
    b.onclick = () => {
      filterOwner = owner;
      render();
    };
    $("owner-filters").append(b);
  }
  renderBoard();
  $("empty-workspace").hidden = items.length > 0;
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
}
async function refresh() {
  if (busy) return;
  busy = true;
  try {
    const res = await fetch("/api/status" + (example ? "?example=1" : ""));
    if (!res.ok) throw Error();
    const next = await res.json();
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
    render();
    if (!next.example && (next.usage.scanning || next.usage.pending))
      setTimeout(refresh, next.usage.codex ? 1000 : 200);
  } catch {
    $("status").textContent = t("failure");
  } finally {
    busy = false;
  }
}
$("language").onchange = () => {
  lang = $("language").value;
  localStorage.setItem("agent-panel-language", lang);
  render();
};
$("refresh").onclick = refresh;
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
render();
refresh();
setInterval(refresh, 30000);
