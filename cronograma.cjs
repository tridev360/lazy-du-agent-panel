'use strict';
const { safeText } = require('./realtime.cjs');
const MINUTE = 60000, DAY = 86400000;
const valid = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const key = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const itemKey = value => String(value || '').replace(/^queue:/, '').toLowerCase();
function clockAt(clock, reference, nextDay = false) {
  if (!/^\d{2}:\d{2}$/.test(clock || '')) return null;
  const [hour, minute] = clock.split(':').map(Number);
  if (hour > 23 || minute > 59) return null;
  const ref = new Date(reference), date = new Date(ref.getTime() - 3 * 3600000).toISOString().slice(0, 10);
  let at = Date.parse(date + 'T' + clock + ':00-03:00');
  if (nextDay && at < ref.getTime() && ref.getTime() - at > 12 * 3600000) at += DAY;
  return new Date(at).toISOString();
}
function timingOf(text, now = new Date(), source = 'fila', meta = {}) {
  const stamp = require('./leitor.cjs').timestampOf;
  const values = { startedAt: valid(meta.inicio || meta.startedAt), completedAt: valid(meta.fim || meta.completedAt), deadlineAt: valid(meta.prazo || meta.deadlineAt) };
  for (const field of ['startedAt', 'completedAt']) {
    const pattern = field === 'startedAt' ? /\bPEGUEI\s+(\d{2}:\d{2})(?!\d)/i : /\b(?:FEITO|PRONTO|NO AR)\s+(\d{2}:\d{2})(?!\d)/i;
    for (const line of String(text || '').split(/\r?\n/)) {
      if(field==='completedAt'&&/\b(?:REPASSE|ENCAMINHAMENTO|queued|somente prioridade|registro de encaminhamento)\b/i.test(line))continue;
      const match = pattern.exec(line);
      if (!match) continue;
      const dated = stamp(line.trim().replace(/^[-*]\s+/, ''), now);
      const at = clockAt(match[1], dated || now);
      // Undated activity belongs to the latest occurrence in the past.
      const measured = !dated && Date.parse(at) > now.getTime() + MINUTE ? new Date(Date.parse(at) - DAY).toISOString() : at;
      if (!values[field] || measured > values[field]) values[field] = measured;
    }
  }
  const deadline = /^\s*(?:[-*]\s*)?PRAZO:\s*(\d{2}:\d{2})(?!\d)/mi.exec(String(text || ''))?.[1] || (/^\d{2}:\d{2}$/.test(meta.prazo || '') ? meta.prazo : null);
  if (!values.deadlineAt && deadline) values.deadlineAt = clockAt(deadline, values.startedAt || now, !!values.startedAt);
  if (values.startedAt && values.completedAt && values.completedAt < values.startedAt && Date.parse(values.startedAt) - Date.parse(values.completedAt) > 12 * 3600000) values.completedAt = new Date(Date.parse(values.completedAt) + DAY).toISOString();
  return { ...values, deadlineSource: values.deadlineAt ? source : null, timingSource: values.startedAt || values.completedAt ? source : null };
}
function etaFeedOf(text, family, now = new Date()) {
  const output = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const match = /^(?:(\d{2}\/\d{2}(?:\/20\d{2})?)\s+)?(\d{2}:\d{2})\s+(?:\|\s*)?(.+?)\s+(?:\|\s*)?ETA\s+(\d{2}:\d{2})(?:\s|$)(.*)$/i.exec(line.trim());
    if (!match) continue;
    let meta = {}; const json = match[5].indexOf('{');
    if (json >= 0) { try { meta = JSON.parse(match[5].slice(json)); } catch {} }
    const at = match[1] ? require('./leitor.cjs').timestampOf(match[1] + ' ' + match[2], now) : clockAt(match[2], now);
    if (!at) continue;
    const recordedAt = !match[1] && Date.parse(at) > now.getTime() + MINUTE ? new Date(Date.parse(at) - DAY).toISOString() : at;
    if (Date.parse(recordedAt) > now.getTime() + MINUTE) continue;
    const item = /(?:^|\s)(\d+[a-z]?)(?=\s|$)/i.exec(match[5].slice(0, json < 0 ? undefined : json))?.[1];
    const etaAt = clockAt(match[4], recordedAt, true);
    if (!etaAt) continue;
    output.push({ family, agent: safeText(match[3].replace(/\s*\|\s*$/, ''), 100), itemId: safeText(meta.itemId || meta.taskId || item, 100) || null, agentId: safeText(meta.agentId, 100) || null, conversationId: safeText(meta.conversationId, 100) || null, etaAt, recordedAt });
  }
  return output.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}
function deliveryOf(timing = {}, eta = null, now = new Date(), rhythm = null) {
  const startedAt = valid(timing.startedAt), completedAt = valid(timing.completedAt), deadlineAt = valid(timing.deadlineAt);
  let etaAt = valid(eta?.etaAt), etaSource = etaAt ? 'feed' : null;
  const completed = (rhythm?.deliveries || []).filter(item => valid(item.completedAt));
  const rhythmStart = valid(rhythm?.startedAt);
  if (!etaAt && !completedAt && completed.length >= 2 && rhythmStart && Number.isInteger(rhythm.total) && rhythm.total > completed.length) {
    const last = Math.max(...completed.map(item => Date.parse(item.completedAt))), first = Date.parse(rhythmStart);
    if (last > first && last <= now.getTime()) { etaAt = new Date(last + (last - first) / completed.length * (rhythm.total - completed.length)).toISOString(); etaSource = 'rhythm'; }
  }
  let state = 'unknown', minutes = null;
  if (completedAt) {
    etaAt = null; etaSource = null;
    if (!deadlineAt) state = 'no-deadline';
    else if (completedAt > deadlineAt) { state = 'late'; minutes = Math.ceil((Date.parse(completedAt) - Date.parse(deadlineAt)) / MINUTE); }
    else if (startedAt && Date.parse(deadlineAt) > Date.parse(startedAt) && (Date.parse(completedAt) - Date.parse(startedAt)) < .8 * (Date.parse(deadlineAt) - Date.parse(startedAt))) { state = 'early'; minutes = Math.floor((Date.parse(deadlineAt) - Date.parse(completedAt)) / MINUTE); }
    else { state = 'on-time'; minutes = 0; }
  } else if (deadlineAt) { minutes = Math.ceil((Date.parse(deadlineAt) - now.getTime()) / MINUTE); state = minutes < 0 ? 'late' : 'in-progress'; if (minutes < 0) minutes = -minutes; }
  else if (etaAt) { state = 'in-progress'; minutes = Math.max(0, Math.ceil((Date.parse(etaAt) - now.getTime()) / MINUTE)); }
  else state = 'no-deadline';
  const ratio = startedAt && deadlineAt && Date.parse(deadlineAt) > Date.parse(startedAt) ? Math.max(0, Math.min(1, ((completedAt ? Date.parse(completedAt) : now.getTime()) - Date.parse(startedAt)) / (Date.parse(deadlineAt) - Date.parse(startedAt)))) : null;
  return { etaAt, etaSource, etaUpdatedAt: etaAt && etaSource === 'feed' ? eta.recordedAt : null, deadlineAt, startedAt, completedAt, state, minutes, ratio, deadlineSource: timing.deadlineSource || null, timingSource: timing.timingSource || null, estimateReason: etaAt ? null : completedAt ? 'completed' : 'insufficient-evidence' };
}
function loadSchedule(root, now) {
  const reader = require('./leitor.cjs');
  const queue = reader.queueItemsOf(reader.readSafe(root, 'estado/fila-codex.md'), now).map(item => ({ ...item, conversationId: /\b(?:sess[aã]o|conversa|thread(?:_id)?)\s*:?\s+([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\b/i.exec(item.details || '')?.[1] || null }));
  const tasks = [];
  for (const file of reader.files(root, 'tasks', '.md').slice(0, 400)) {
    const { meta, body } = reader.frontmatter(reader.readSafe(root, 'tasks/' + file, 256000));
    if (!/^20\d{2}-\d{2}-\d{2}-/.test(meta.id || '')) continue;
    tasks.push({ id: meta.id, title: safeText(/^#\s+(.+)$/m.exec(body)?.[1], 100), conversationId: meta.thread_id || meta.conversation_id || null, agentId: meta.agent_id || null, actor: meta.conversa || null, delivery: timingOf(reader.logOf(body), now, 'task', meta) });
  }
  const feeds = [...etaFeedOf(reader.readSafe(root, 'estado/feed-codex.log', 512000), 'codex', now), ...etaFeedOf(reader.readSafe(root, 'estado/feed-claude.log', 512000), 'claude', now)].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  return { queue, tasks, feeds };
}
function attachSchedule(root, team, now = new Date(), schedule = loadSchedule(root, now)) {
  const agents = team.agents || [], groups = new Map();
  const candidates = [...schedule.queue, ...schedule.tasks];
  for(const feed of schedule.feeds){if(!/^codexpainelpublico(?:v\d+)?$/.test(key(feed.agent)))continue;const roots=agents.filter(agent=>!agent.parentId&&agent.family===feed.family&&key(agent.project)==='painelaberto');if(roots.length!==1)continue;const agent=roots[0];agent.deliveryActor=feed.agent;if(!agent.taskRoleKey&&agent.roleKey==='helper'){agent.taskRoleKey='panel-dev';agent.taskRoleSource='public-project-feed';}break;}
  for (const agent of agents) {
    const idMatch = candidate => candidate.id === agent.currentItemId || itemKey(candidate.id) === itemKey(agent.currentItemId) || candidate.agentId === agent.id || candidate.conversationId && [agent.conversationId, agent.conversationId?.replace(/^(?:codex|claude):/, '')].includes(candidate.conversationId);
    const exact = candidates.filter(idMatch);
    const byTitle = agent.currentItemTitle ? candidates.filter(candidate => key(candidate.title) === key(agent.currentItemTitle)) : [];
    const actor = candidates.filter(candidate => candidate.actor && key(candidate.actor) === key(agent.conversation));
    let item = exact.length === 1 ? exact[0] : !exact.length && byTitle.length === 1 ? byTitle[0] : !exact.length && !byTitle.length && actor.length === 1 ? actor[0] : null;
    const matchingEta = schedule.feeds.find(feed => {
      if (feed.family !== agent.family) return false;
      if(item&&feed.itemId&&itemKey(feed.itemId)!==itemKey(item.id)&&!agent.deliveryActor&&!feed.agentId&&!feed.conversationId)return false;
      if (feed.agentId) return feed.agentId === agent.id || feed.agentId === agent.id.replace(/^(?:codex|claude):/, '');
      if (feed.conversationId) return !agent.parentId && [agent.conversationId, agent.conversationId.replace(/^(?:codex|claude):/, '')].includes(feed.conversationId);
      const named = agents.filter(other => !other.parentId && other.family === feed.family && [other.name, other.id, other.conversation, other.conversationName,other.deliveryActor].some(name => key(name) === key(feed.agent)||other.deliveryActor&&key(name)===key(other.deliveryActor)&&key(feed.agent)===key('CODEX '+other.deliveryActor)));
      if (named.length !== 1 || named[0].id !== agent.id) return false;
      return true;
    });
    if (matchingEta?.itemId) {
      const linked = candidates.filter(candidate => itemKey(candidate.id) === itemKey(matchingEta.itemId));
      if (linked.length === 1) item = linked[0];
    }
    const timing = item?.delivery || (item ? timingOf(item.details, now, 'fila') : {});
    const related = schedule.queue.filter(candidate => candidate.actor && key(candidate.actor) === key(agent.conversation));
    const rhythm = related.length ? { startedAt: related.map(candidate => candidate.delivery?.startedAt).filter(Boolean).sort()[0] || null, total: related.length, deliveries: related.filter(candidate => candidate.delivery?.completedAt).map(candidate => ({ completedAt: candidate.delivery.completedAt })) } : null;
    const resumed = timing.completedAt && ['working','walking'].includes(agent.state) && Date.parse(agent.lastAt) > Date.parse(timing.completedAt);
    agent.delivery = deliveryOf(resumed ? {...timing,completedAt:null} : timing, matchingEta, now, rhythm);
    if(resumed)agent.delivery.lastCompletedAt=timing.completedAt;
    agent.deliveryItemId = item?.id || null;
    const roleTitle = agent.parentId && agent.role && !/^(?:Ajudante|Coordena a conversa)$/i.test(agent.role) ? agent.role : null;
    agent.conversationTitle = safeText(item?.title || agent.currentItemTitle || roleTitle || agent.conversation, 120);
    const groupId = agent.projectId + '|' + agent.conversationId;
    if (!groups.has(groupId)) groups.set(groupId, { id: groupId, conversationId: agent.conversationId, projectId: agent.projectId, title: agent.conversationTitle, titleSource: item ? 'task-or-queue' : agent.currentItemTitle ? 'task-metadata' : 'conversation-metadata', agents: [] });
    groups.get(groupId).agents.push(agent);
  }
  for (const group of groups.values()) {
    const leader = group.agents.find(agent => !agent.parentId) || group.agents[0];
    const useful = group.agents.find(agent => agent.currentItemTitle || agent.deliveryItemId) || group.agents.find(agent => agent.conversationTitle && !/^(?:(?:Codex|Claude) em |Sessão )/i.test(agent.conversationTitle));
    group.title = useful?.conversationTitle || leader.conversationTitle;
    group.delivery = leader.delivery;
  }
  team.groups = [...groups.values()];
  const repeated = new Map();
  for (const group of team.groups) { const title = group.title; if (!repeated.has(title)) repeated.set(title, []); repeated.get(title).push(group); }
  for (const sameTitle of repeated.values()) if (sameTitle.length > 1) {
    sameTitle.sort((a, b) => a.id.localeCompare(b.id));
    sameTitle.forEach((group, index) => { group.title += ' (' + (index + 1) + ')'; });
  }
  return team;
}
module.exports = { clockAt, timingOf, etaFeedOf, deliveryOf, loadSchedule, attachSchedule };
