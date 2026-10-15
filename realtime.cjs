'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
let localAvatarResolver;const feedingScanners=new Map();
function getAvatarResolver() {
  const module = require('./agentes.cjs');
  // An unverified pool may become verified after local thumbnail preparation.
  if (!localAvatarResolver || localAvatarResolver.info().status !== 'verified') localAvatarResolver = module.createAvatarResolver(__dirname);
  return localAvatarResolver;
}

function safeText(value, limit = 160) {
  return String(value ?? '').replace(/https?:\/\/\S+|0x[a-f\d]{40,}|\b(?:sk|ghp|gho|ghu|xox[baprs])[-_][\w-]+|\b(?:token|api[_ -]?key|secret|password|chave)\s*[:=]\s*\S+/gi, '[privado]').replace(/[\r\n\u2013\u2014]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function stamp(value, now) {
  return require('./leitor.cjs').timestampOf(value, now);
}

function brtTime(at) {
  return at ? new Date(Date.parse(at) - 3 * 3600000).toISOString().slice(11, 16) : '?';
}

function feedOf(text, family, now = new Date()) {
  const rows = [];
  let index = 0;
  for (const raw of String(text).split(/\r?\n/)) {
    index++;
    const line = raw.replace(/^\uFEFF/, '').trim();
    if (!line) continue;
    let at = null, agent = '', message = '', metadata = {};
    if (line.startsWith('{')) {
      try {
        const entry = JSON.parse(line);
        at = stamp(entry.at || entry.hora || entry.timestamp, now);
        agent = entry.agent || entry.agente || family;
        message = entry.text || entry.texto || entry.resumo;
        metadata = entry;
      } catch { continue; }
    } else {
      const full = /^(20\d{2}-\d{2}-\d{2}[T ][\d:.]+(?:Z|\s*[+-]\d{2}:?\d{2})?|\d{2}\/\d{2}(?:\/20\d{2})?\s+\d{2}:\d{2}(?::\d{2})?)\s*\|\s*([^|]+)\s*\|\s*([^|]+)(?:\|(.*))?$/.exec(line);
      const short = !full && /^(\d{2}:\d{2})\s+(CODEX\s+PAINEL|Guardian\s+review|Codex\s+\d+|[\wÀ-ÿ]+)\s+(.+)$/i.exec(line);
      if (full) {
        at = stamp(full[1], now);
        agent = full[2];
        message = full[3];
        if (full[4]) { try { metadata = JSON.parse(full[4]); } catch {} }
      } else if (short) {
        const date = new Date(now.getTime() - 3 * 3600000).toISOString().slice(0, 10);
        at = stamp(date + ' ' + short[1] + ' BRT', now);
        if (at && Date.parse(at) > now.getTime() + 60000) at = new Date(Date.parse(at) - 86400000).toISOString();
        agent = short[2];
        message = short[3];
      } else continue;
    }
    if (!at || !message) continue;
    const text = safeText(message, 180).split(/\s+/).slice(0, 6).join(' ');
    const name = safeText(agent, 40) || family;
    const row = { id: createHash('sha1').update(family + at + name + text).digest('hex').slice(0, 16), at, time: brtTime(at), agent: name, text, role: safeText(metadata.role || metadata.papel, 60) || null, model: safeText(metadata.model || metadata.modelo, 60) || null, effort: safeText(metadata.effort || metadata.esforco, 40) || null, skills: Array.isArray(metadata.skills) ? metadata.skills.slice(0, 6).map(skill => safeText(skill, 60)) : [], since: stamp(metadata.since || metadata.desde, now), source: 'feed', order: index };
    rows.push(row);
  }
  const seen = new Set();
  return rows.sort((a, b) => b.at.localeCompare(a.at) || b.order - a.order).filter(row => {
    const id = /guardian review/i.test(row.agent) ? 'guardian' : row.id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, 8).map(({ order, ...row }) => row);
}

function safeDirectory(root, parts) {
  if (/(?:PRIVADO|_SECRETS|backup-privado|(?:^|[\\/])\.env(?:$|[\\/.])|(?:^|[\\/])seed(?:$|[\\/.]))/i.test(path.join(root, ...parts))) return null;
  try {
    let current = root;
    if (!fs.lstatSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink()) return null;
    const base = fs.realpathSync(root);
    for (const part of parts) {
      current = path.join(current, part);
      if (!fs.lstatSync(current).isDirectory() || fs.lstatSync(current).isSymbolicLink()) return null;
    }
    const real = fs.realpathSync(current), relative = path.relative(base, real);
    return !relative.startsWith('..') && !path.isAbsolute(relative) ? real : null;
  } catch { return null; }
}

// A missing feed uses file timestamps only. Conversation text and tool arguments are never loaded.
function metadataFeed(root, family, now = new Date()) {
  if (!root) return [];
  const candidates = [];
  const add = (dir, pattern) => {
    if (!dir) return;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile() || entry.isSymbolicLink() || !pattern.test(entry.name)) continue;
        const file = path.join(dir, entry.name), stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink()) continue;
        candidates.push({ key: entry.name, at: new Date(stat.mtimeMs).toISOString() });
      }
    } catch {}
  };
  if (family === 'Codex') {
    const today = new Date(now.getTime() - 3 * 3600000);
    for (let offset = 0; offset < 2; offset++) {
      const date = new Date(today.getTime() - offset * 86400000).toISOString().slice(0, 10);
      add(safeDirectory(root, date.split('-')), /^rollout-[\wT:.-]+\.jsonl$/);
    }
  } else {
    const base = safeDirectory(root, []);
    if (base) {
      try {
        for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
          if (entry.isDirectory() && !entry.isSymbolicLink() && !/^\./.test(entry.name)) add(safeDirectory(base, [entry.name]), /^[a-f\d-]{20,}\.jsonl$/i);
        }
      } catch {}
    }
  }
  return candidates.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8).map(row => ({ id: createHash('sha1').update(family + row.key + row.at).digest('hex').slice(0, 16), at: row.at, time: brtTime(row.at), agent: family, text: 'Atividade local', role: null, model: null, effort: null, skills: [], since: null, source: 'session metadata' }));
}

function measuredObject(root, relative) {
  try {
    const result = JSON.parse(require('./leitor.cjs').readSafe(root, relative, 64000));
    return result && typeof result === 'object' && !Array.isArray(result) ? result : null;
  } catch { return null; }
}

function weekGoalOf(root, now = new Date()) {
  const raw = measuredObject(root, 'estado/meta-semana.json');
  if (!raw || typeof raw.nome !== 'string' || !Number.isFinite(raw.alvo) || raw.alvo < 0 || !Number.isFinite(raw.valor) || raw.valor < 0 || typeof raw.fonte !== 'string' || !raw.fonte.trim()) return null;
  const updated = stamp(raw.atualizado, now);
  if (!updated) return null;
  return { name: safeText(raw.nome, 80), target: raw.alvo, value: raw.valor, source: safeText(raw.fonte, 100), updated };
}

function moneyOf(root, now = new Date()) {
  const raw = measuredObject(root, 'estado/custos.json');
  if (!raw) return null;
  const updated = stamp(raw.atualizado, now);
  if (!updated) return null;
  const items = raw.itens || raw.custos || raw.items;
  if (!Array.isArray(items) || items.length > 100) return null;
  const costs = [];
  for (const item of items) {
    if (!item || typeof item.item !== 'string' || !Number.isFinite(item.valor) || item.valor < 0 || !/^[A-Z]{3}$/.test(item.moeda || '') || typeof item.fonte !== 'string' || !item.fonte.trim()) return null;
    costs.push({ item: safeText(item.item, 80), value: item.valor, currency: item.moeda, source: safeText(item.fonte, 100) });
  }
  const measuredIncome = raw.entrada || raw.entrada_mes || raw.income;
  const incomeUpdated = measuredIncome && stamp(measuredIncome.atualizado || raw.atualizado, now);
  const thisMonth = new Date(now.getTime() - 3 * 3600000).toISOString().slice(0, 7);
  const incomeMonth = incomeUpdated && new Date(Date.parse(incomeUpdated) - 3 * 3600000).toISOString().slice(0, 7);
  const income = measuredIncome && incomeUpdated && incomeMonth === thisMonth && Number.isFinite(measuredIncome.valor) && measuredIncome.valor >= 0 && /^[A-Z]{3}$/.test(measuredIncome.moeda || '') && typeof measuredIncome.fonte === 'string' && measuredIncome.fonte.trim() ? { value: measuredIncome.valor, currency: measuredIncome.moeda, source: safeText(measuredIncome.fonte, 100), updated: incomeUpdated } : null;
  const totals = new Map();
  for (const item of costs) totals.set(item.currency, (totals.get(item.currency) || 0) + item.value);
  return { costs, totals: [...totals].map(([currency, value]) => ({ currency, value })), income, updated };
}

function needsOldestOf(items, now) {
  const dates = [];
  for (const item of items) {
    const match = /\b(?:desde|criado|criada|registrado|registrada)\s*:?\s*(20\d{2}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?(?:Z|\s*[+-]\d{2}:?\d{2})?|\d{2}\/\d{2}(?:\/20\d{2})?\s+\d{2}:\d{2})\b/i.exec(item.detail || '');
    const at = match && stamp(match[1], now);
    if (at && Date.parse(at) <= now.getTime()) dates.push(at);
  }
  return dates;
}

function managementOf(root, data, now = new Date()) {
  const cards = data.cards.filter(card => !card.exemplo);
  const dates = [...cards.map(card => stamp(card.criado, now)), ...needsOldestOf(data.needsAll, now)].filter(at => at && Date.parse(at) <= now.getTime()).sort();
  const readyBranches = data.readyBranches.length;
  return {
    waiting: { count: cards.length + data.needsTotal, cards: cards.length, items: data.needsTotal, oldestAt: dates[0] || null, ageMinutes: dates.length ? Math.max(0, Math.floor((now.getTime() - Date.parse(dates[0])) / 60000)) : null },
    flow: { started: data.pipelineItems.filter(item => Number.isFinite(item.percent) && item.percent > 0 && item.percent < 100).length, finished: data.pipelineItems.filter(item => item.percent === 100).length, readyBranches, openQueue: data.queueItems.filter(item => !['feito', 'noar', 'pausado'].includes(item.status)).length, stalledTasks: data.stalledTasks.length, alert: readyBranches > 5 },
    week: weekGoalOf(root, now),
    money: moneyOf(root, now)
  };
}

function activityOf(data, family, now = new Date()) {
  const stalled = new Set(data.stalledTasks.map(item => item.id));
  const candidates = data.pipelineItems.filter(item => item.executor === family && !stalled.has(item.id) && ['pegou', 'pronto', 'revisao', 'liberado'].includes(item.status));
  const active = candidates.filter(item => item.status === 'pegou').sort((a, b) => (b.lastChangeAt || '').localeCompare(a.lastChangeAt || '') || (b.priority ? 1 : 0) - (a.priority ? 1 : 0))[0] || candidates[0];
  const card = data.cards.find(item => !item.exemplo && (family === 'codex' ? /codex/i.test(item.sessao) : !/codex/i.test(item.sessao)));
  const changes = [...candidates.map(item => item.lastChangeAt), ...(data.feeds[family] || []).map(item => item.at)].filter(Boolean).sort();
  const lastChangeAt = changes.at(-1) || null;
  return { activeId: active?.id || null, lastChangeAt, sleeping: !active || !lastChangeAt || now.getTime() - Date.parse(lastChangeAt) >= 30 * 60000, waiting: !!card, activeCount: candidates.length };
}

function registeredFeedOf(data) {
  return data.states.filter(item => ['atendimento', 'assistente', 'cortes', 'loja', 'coordenacao'].includes(item.id) && item.updatedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8).map(item => {
    const point = /\bPONTO\s*:\s*([^\r\n]+)/i.exec(item.point || '')?.[1];
    const text = point ? safeText(point, 180).split(/\s+/).slice(0, 6).join(' ') : 'Estado registrado';
    return { id: createHash('sha1').update(item.id + item.updatedAt + text).digest('hex').slice(0, 16), at: item.updatedAt, time: brtTime(item.updatedAt), agent: item.id.toUpperCase(), text, role: item.id.toUpperCase(), model: null, effort: null, skills: [], since: null, source: 'estado registrado' };
  });
}

function tipsOf(root) {
  const raw = measuredObject(root, 'estado/ia-tips.json');
  if (!raw || !Array.isArray(raw.dicas) || raw.dicas.length > 100) return [];
  return raw.dicas.filter(item => item && typeof item.id === 'string' && /^[\w.-]{1,80}$/.test(item.id) && typeof item.tema === 'string' && typeof item.pt === 'string' && typeof item.en === 'string').map(item => ({ id: item.id, tema: safeText(item.tema, 40), pt: safeText(item.pt, 500), en: safeText(item.en, 500) }));
}

function teamProgressOf(data, now) {
  const selected = data.queueItems.filter(item => /^(?:queue:23|queue:26[a-k]?|queue:27)$/.test(item.id));
  const started = [];
  const date = new Date(now.getTime() - 3 * 3600000).toISOString().slice(0, 10);
  for (const item of selected) {
    const match = /\bPEGUEI\s+(\d{2}:\d{2})(?!\d)/i.exec(item.details || '');
    const at = match && stamp(date + ' ' + match[1] + ' BRT', now);
    if (at && Date.parse(at) <= now.getTime()) started.push(at);
  }
  return { deliveries: selected.map(item => ({ id: item.id, title: item.title, state: item.status, done: ['feito','noar'].includes(item.status), completedAt: ['feito','noar'].includes(item.status) ? item.lastChangeAt : null })), startedAt: started.sort()[0] || null, source: 'estado/fila-codex.md', estimated: false };
}

function enrichSnapshot(root, sessionsRoot, data, now = new Date(), options = {}) {
  const metadata=options.metadataSnapshot;
  if(options.metadataOnly===true&&(!metadata||metadata.proof?.mode!=='scalar-metadata'||!metadata.equipe))throw Error('Metadata provider unavailable');
  const scalarFeed=family=>(metadata.equipe.agents||[]).filter(a=>a.family===family&&a.lastAt).slice(0,8).map(a=>({id:a.id,at:a.lastAt,time:brtTime(a.lastAt),agent:family==='codex'?'Codex':'Claude',text:'Atividade local',source:'scalar-metadata'}));
  const read = require('./leitor.cjs').readSafe;
  const codex = feedOf(read(root, 'estado/feed-codex.log', 512000), 'Codex', now);
  const claude = feedOf(read(root, 'estado/feed-claude.log', 512000), 'Claude', now);
  const registered = claude.length ? [] : registeredFeedOf(data);
  data.feeds = { codex: codex.length ? codex : options.metadataOnly===true?scalarFeed('codex'):metadataFeed(sessionsRoot, 'Codex', now), claude: claude.length ? claude : registered.length ? registered : options.metadataOnly===true?scalarFeed('claude'):metadataFeed(path.join((process.env.PAINEL_HOME || os.homedir()), '.claude', 'projects'), 'Claude', now) };
  for (const item of data.pipelineItems) {
    if (!item.lastChangeAt) item.lastChangeAt = data.tasks.find(work => work.id === item.id)?.lastLogAt || null;
  }
  data.management = managementOf(root, data, now);
  data.activity = { claude: activityOf(data, 'claude', now), codex: activityOf(data, 'codex', now) };
  const team = require('./equipe.cjs');
  const actualSessions = path.resolve(sessionsRoot || '') === path.join((process.env.PAINEL_HOME || os.homedir()), '.codex', 'sessions');
  const appSessions = options.metadataOnly===true ? metadata.appSessions||{bySession:new Map(),byCli:new Map(),available:false} : actualSessions ? require('./sessoes-app.cjs').readSessions() : { bySession: new Map(), byCli: new Map(), available: false };
  data.equipe = options.metadataOnly===true ? {...metadata.equipe,agents:metadata.equipe.agents.map(a=>({...a}))} : team.snapshotTeam(root, sessionsRoot, now, actualSessions ? { app: appSessions } : { claudeRoot: false });
  if(options.metadataOnly===true){data.commandSessions=metadata.commandSessions;data.metadataProof=metadata.proof;data.readerStatus=metadata.readerStatus;}
  const duResolver = getAvatarResolver();
  data.equipe.agents = duResolver.assign(data.equipe.agents);
  data.equipe.duPool = duResolver.info();
  data.equipe.progress = teamProgressOf(data, now);
  const config = team.projectConfig(root), selected = team.projectOf(root, config);
  const sourceProject = selected.configured ? selected : { id: 'app', name: 'Painel', color: '#ff5fae' };
  data.projectId = sourceProject.id;
  for (const collection of [data.tasks, data.pipelineItems, data.queueItems, data.cards, data.feeds.claude, data.feeds.codex, data.launches?.items || []]) for (const item of collection) item.projectId = sourceProject.id;
  const scopedConfig = require('./projeto-dados.cjs').scopeProjects(root, data, config, sourceProject.id);
  const projects = new Map(scopedConfig.map(project => [project.id, { id: project.id, name: project.name, color: project.color, agents: 0, active: 0, todayTokens: null, todayTokensExact: false, todayTokenSource: null, todayTokenReason: 'no-daily-baseline', tokenScope: 'conversation-total', tokens: null, tokensExact: false, lastAt: null, percent: null }]));
  projects.set(sourceProject.id, { ...projects.get(sourceProject.id), id: sourceProject.id, name: sourceProject.name, color: sourceProject.color, agents: 0, active: 0, todayTokens: null, todayTokensExact: false, todayTokenSource: null, todayTokenReason: 'no-daily-baseline', tokenScope: 'conversation-total', tokens: null, tokensExact: false, lastAt: null, percent: data.progress.percent });
  for (const project of data.equipe.projects) projects.set(project.id, { ...projects.get(project.id), ...project, percent: project.id === sourceProject.id ? data.progress.percent : null });
  data.projects = [...projects.values()];
  require('./previsao.cjs').applyForecasts(root,data.equipe,now);
  const operatorModule=require('./operador.cjs');
  data.operator=operatorModule.snapshotOperator(root,data.equipe,data,now);
  operatorModule.attachSessionNodes(data.operator,data.equipe,duResolver,now,root,appSessions);
  if(options.metadataOnly===true){data.equipe.consumo=null;data.equipe.consumoUnavailable='scalar-consumption-not-proved';}else if(actualSessions)try{data.equipe.consumo=require('./contador-tokens.cjs').snapshotConsumo(root,sessionsRoot,now);}catch{data.equipe.consumo=null;}
  data.tips = tipsOf(root);
  const feedingModule=require('./alimentacao.cjs');data.feeding=feedingModule.snapshotFeeding(root,now);
  if(options.metadataOnly===true){data.feeding.bonusUnavailable=true;data.feeding.bonusReason='metadata-policy';}else if(data.feeding.collected.length){let scanner=feedingScanners.get(root);if(!scanner){scanner={instance:new feedingModule.FeedingScanner(root,sessionsRoot,actualSessions?{}:{claudeRoot:false}),last:0};feedingScanners.set(root,scanner);}if(now.getTime()-scanner.last>=15000){scanner.last=now.getTime();try{data.feeding=scanner.instance.scan(now);}catch{data.feeding.bonusUnavailable=true;}}}
  try{const config=JSON.parse(read(root,'estado/lofi.json',16000));data.lofi={radios:(Array.isArray(config.radios)?config.radios:[]).filter(r=>r&&typeof r.nome==='string'&&/^[a-zA-Z0-9_-]{11}$/.test(r.youtube)).slice(0,8).map(r=>({nome:safeText(r.nome,100),youtube:r.youtube}))};}catch{data.lofi={radios:[]};}
  return data;
}

function signatureOf(data) {
  return createHash('sha256').update(JSON.stringify(data, (key, value) => ['updated', 'nonce', 'ageMinutes'].includes(key) ? undefined : value)).digest('hex');
}

function createStateStream(root, getSnapshot, options = {}) {
  const clients = new Set(), watchers = [];
  let timer, heartbeat, coalesce, previousSignature, previousData = null, version = 0, closed = false;
  const send = (res, data, event = 'estado') => {
    if (res.destroyed || res.writableEnded) { clients.delete(res); return; }
    if (res.writableLength > 1024 * 1024) { clients.delete(res); res.end(); return; }
    res.write(`id: ${version}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const refresh = () => {
    if (closed || !clients.size) return;
    try {
      const data = getSnapshot();
      if (data === previousData) return;
      previousData = data;
      const signature = signatureOf(data);
      if (signature === previousSignature) return;
      previousSignature = signature;
      version++;
      for (const res of clients) send(res, data);
    } catch {
      for (const res of clients) res.write('event: erro\ndata: {"error":"Estado indisponivel"}\n\n');
    }
  };
  const schedule = () => {
    if (coalesce || closed) return;
    coalesce = setTimeout(() => { coalesce = null; refresh(); }, options.coalesceMs || 120);
    coalesce.unref();
  };
  const start = () => {
    if (timer || closed) return;
    if (!options.example) {
      const folders = [[], ['tasks'], ['estado'], ['estado', 'cards']];
      for (const parts of folders) {
        const dir = safeDirectory(root, parts);
        if (!dir) continue;
        try {
          const watcher = fs.watch(dir, { persistent: false }, (_event, name) => {
            const file = String(name || '');
            const allowed = !parts.length ? /^(?:DECISIONS|FILA-DE-DECISOES)\.md$/.test(file) : parts.at(-1) === 'tasks' ? /^[\w.-]+\.md$/.test(file) : parts.at(-1) === 'cards' ? /^[\w.-]+\.json$/.test(file) : /^(?:[\w.-]+\.md|feed-(?:codex|claude)\.log|lancamentos\.json|meta-semana\.json|custos\.json|projetos\.json|ia-tips\.json|uso-(?:claude|codex-resets)\.json)$/.test(file);
            if (!name || allowed) { schedule(); options.onFileChange?.(); }
          });
          watcher.on('error', () => { watcher.close(); schedule(); options.onFileChange?.(); });
          watchers.push(watcher);
        } catch {}
      }
    }
    timer = setInterval(refresh, options.pollMs || 5000);
    timer.unref();
    heartbeat = setInterval(() => { for (const res of clients) if (!res.destroyed) res.write(': vivo\n\n'); }, options.heartbeatMs || 15000);
    heartbeat.unref();
  };
  const stop = () => {
    clearInterval(timer); timer = null;
    clearInterval(heartbeat); heartbeat = null;
    clearTimeout(coalesce); coalesce = null;
    for (const watcher of watchers.splice(0)) watcher.close();
  };
  return {
    subscribe(req, res, headers) {
      if (closed || clients.size >= 8) { res.writeHead(503, { ...headers, 'Content-Type': 'application/json' }); res.end('{"error":"Limite de conexoes"}'); return; }
      let data;
      try { data = getSnapshot(); } catch { res.writeHead(503, { ...headers, 'Content-Type': 'application/json' }); res.end('{"error":"Estado indisponivel"}'); return; }
      res.writeHead(200, { ...headers, 'Content-Type': 'text/event-stream; charset=utf-8', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 3000\n\n');
      const nextSignature = signatureOf(data);
      if (previousSignature && nextSignature !== previousSignature) {
        version++;
        for (const client of clients) send(client, data);
      }
      clients.add(res);
      previousSignature = nextSignature; previousData = data;
      send(res, data);
      res.on('close', () => { clients.delete(res); if (!clients.size) stop(); });
      start();
    },
    refresh,
    changed: schedule,
    broadcast(event, data) {
      if (closed || event !== 'recarregar') return;
      version++;
      for (const res of clients) send(res, data, event);
    },
    close() { closed = true; stop(); for (const res of clients) res.end(); clients.clear(); }
  };
}

module.exports = { feedOf, metadataFeed, weekGoalOf, moneyOf, managementOf, activityOf, tipsOf, teamProgressOf, enrichSnapshot, signatureOf, createStateStream, safeText, getAvatarResolver };
