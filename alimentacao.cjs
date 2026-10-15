'use strict';
const fs = require('node:fs'), path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { readSafe } = require('./leitor.cjs');
const { safeText } = require('./realtime.cjs');
const FILE = 'estado/ia-alimentacao.json';
const RARITIES = { comum: { xp: 10, level: 1 }, rara: { xp: 25, level: 1 }, epica: { xp: 50, level: 1 }, lendaria: { xp: 100, level: 5 } };
const DAILY_LIMIT = 500;
const normalizePrompt = text => String(text || '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
const fingerprint = text => createHash('sha256').update(normalizePrompt(text)).digest('hex');
const dayOf = now => new Date(now.getTime() - 3 * 3600000).toISOString().slice(0, 10);
function loadTips(root) {
  let raw; try { raw = JSON.parse(readSafe(root, 'estado/ia-tips.json', 128000)); } catch { return []; }
  if (!Array.isArray(raw.dicas) || raw.dicas.length > 100) return [];
  const used = new Set();
  return raw.dicas.filter(tip => tip && /^[\w.-]{1,80}$/.test(tip.id || '') && !used.has(tip.id) && used.add(tip.id)).map(tip => {
    const rarity = Object.hasOwn(RARITIES, tip.raridade) ? tip.raridade : 'comum';
    const language = value => {
      if (typeof value === 'string') return { titulo: safeText(tip.tema, 100), porque: '', colar: safeText(value, 4000) };
      if (!value || typeof value.colar !== 'string') return null;
      return { titulo: safeText(value.titulo, 100), porque: safeText(value.porque, 240), colar: safeText(value.colar, 4000) };
    };
    return { id: tip.id, tema: safeText(tip.tema, 40), raridade: rarity, xp: RARITIES[rarity].xp, unlockLevel: RARITIES[rarity].level, pt: language(tip.pt), en: language(tip.en) };
  }).filter(tip => tip.pt?.colar && tip.en?.colar);
}
function freshState() { return { version: 1, xp: 0, lastFedAt: null, days: {}, collected: [], bonuses: [] }; }
function readState(root) {
  const text = readSafe(root, FILE, 256000);
  if (!text) { if (fs.existsSync(path.join(root, FILE))) throw Error('Feeding state is unreadable'); return freshState(); }
  let raw; try { raw = JSON.parse(text); } catch { throw Error('Feeding state is unreadable'); }
  if (raw.version !== 1 || !Number.isSafeInteger(raw.xp) || raw.xp < 0 || !raw.days || typeof raw.days !== 'object' || !Array.isArray(raw.collected) || !Array.isArray(raw.bonuses)) throw Error('Feeding state is invalid');
  const state = freshState(); state.xp = raw.xp; state.lastFedAt = typeof raw.lastFedAt === 'string' && Number.isFinite(Date.parse(raw.lastFedAt)) ? raw.lastFedAt : null;
  state.collected = [...new Set(raw.collected.filter(id => /^[\w.-]{1,80}$/.test(id)))].slice(0, 100);
  state.bonuses = [...new Set(raw.bonuses.filter(id => /^[\w.-]{1,80}$/.test(id)))].slice(0, 100);
  for (const [day, record] of Object.entries(raw.days)) {
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(day) || !record || !Number.isSafeInteger(record.xp) || record.xp < 0 || record.xp > DAILY_LIMIT || !Array.isArray(record.prompts)) throw Error('Feeding day is invalid');
    state.days[day] = { xp: record.xp, prompts: [...new Set(record.prompts.filter(id => /^[\w.-]{1,80}$/.test(id)))].slice(0, 100) };
  }
  return state;
}
function safeDestination(root) {
  const base = path.resolve(root), directory = path.join(base, 'estado');
  if (fs.lstatSync(base).isSymbolicLink()) throw Error('Invalid state path');
  const real = fs.realpathSync(base);
  if (/(?:PRIVADO|_SECRETS|backup-privado|(?:^|[\\/])seed(?:[\\/]|$))/i.test(real)) throw Error('Private state path');
  if (!fs.existsSync(directory)) fs.mkdirSync(directory);
  if (fs.lstatSync(directory).isSymbolicLink() || !fs.lstatSync(directory).isDirectory()) throw Error('Invalid state directory');
  const file = path.join(directory, path.basename(FILE));
  if (fs.existsSync(file) && (fs.lstatSync(file).isSymbolicLink() || !fs.lstatSync(file).isFile())) throw Error('Invalid state file');
  return file;
}
function updateState(root, change) {
  const destination = safeDestination(root), lock = destination + '.lock';
  let fd, temporary;
  try {
    fd = fs.openSync(lock, 'wx', 0o600);
    const state = readState(root), result = change(state);
    if (result.changed) {
      temporary = destination + '.' + randomUUID() + '.tmp';
      fs.writeFileSync(temporary, JSON.stringify(state) + '\n', { flag: 'wx', mode: 0o600 });
      fs.renameSync(temporary, destination); temporary = null;
    }
    return { state, ...result };
  } finally { if (temporary) fs.unlinkSync(temporary); if (fd !== undefined) { fs.closeSync(fd); fs.unlinkSync(lock); } }
}
function viewState(state, now, tips) {
  const today = dayOf(now), record = state.days[today] || { xp: 0, prompts: [] }, level = Math.floor(state.xp / 100) + 1;
  let streak = 0, day = today;
  if (!state.days[day]?.prompts.length) day = dayOf(new Date(now.getTime() - 86400000));
  while (state.days[day]?.prompts.length && streak < 3660) { streak++; day = new Date(Date.parse(day + 'T12:00Z') - 86400000).toISOString().slice(0, 10); }
  const age = state.lastFedAt ? Math.max(0, now.getTime() - Date.parse(state.lastFedAt)) : Infinity;
  return { xp: state.xp, level, levelXp: state.xp % 100, nextLevelXp: 100, hunger: Math.max(0, Math.round(100 * (1 - age / 86400000))), streak, collected: state.collected, collectionTotal: tips.length, bonusTips: state.bonuses, dailyXp: record.xp, dailyLimit: DAILY_LIMIT, lastFedAt: state.lastFedAt, updatedAt: now.toISOString(), source: FILE, tips: tips.map(tip => ({ ...tip, locked: level < tip.unlockLevel, fedToday: record.prompts.includes(tip.id), eatenForReal: state.bonuses.includes(tip.id) })) };
}
function snapshotFeeding(root, now = new Date()) { const tips = loadTips(root); return viewState(readState(root), now, tips); }
function feedTip(root, id, now = new Date()) {
  const tips = loadTips(root), tip = tips.find(item => item.id === id);
  if (!tip) throw Error('Unknown prompt');
  const result = updateState(root, state => {
    if (Math.floor(state.xp / 100) + 1 < tip.unlockLevel) throw Error('Prompt is locked');
    const day = dayOf(now), record = state.days[day] || { xp: 0, prompts: [] };
    if (record.prompts.includes(id)) return { changed: false, gained: 0, reason: 'already-fed-today' };
    if (record.xp + tip.xp > DAILY_LIMIT) return { changed: false, gained: 0, reason: 'daily-limit' };
    record.xp += tip.xp; record.prompts.push(id); state.days[day] = record; state.xp += tip.xp;
    state.lastFedAt = now.toISOString(); if (!state.collected.includes(id)) state.collected.push(id);
    return { changed: true, gained: tip.xp, reason: 'fed' };
  });
  return { ...viewState(result.state, now, tips), gained: result.gained, reason: result.reason };
}
function userTextsOf(line, family) {
  const { projectMetadata } = require('./equipe.cjs'), metadata = projectMetadata(line);
  const user = family === 'codex' ? metadata?.type === 'event_msg' && metadata.payload?.type === 'user_message' : metadata?.type === 'user' && !metadata.message?.content?.some(item => item?.type === 'tool_result');
  if (!user) return [];
  const record = projectMetadata(line, { fields: family === 'codex' ? ['payload.message'] : ['message.content','message.content.*.type','message.content.*.text'], maxString: 256000 });
  const values = family === 'codex' ? [record?.payload?.message] : typeof record?.message?.content === 'string' ? [record.message.content] : (record?.message?.content || []).filter(item => item.type === 'text').map(item => item.text);
  return values.filter(value => typeof value === 'string');
}
function matchingTips(text, tips) {
  const normalized = normalizePrompt(text), matches = [];
  for (const tip of tips) {
    for (const language of ['pt', 'en']) {
      const prompt = normalizePrompt(tip[language].colar), index = normalized.indexOf(prompt);
      if (prompt.length >= 20 && index >= 0 && fingerprint(normalized.slice(index, index + prompt.length)) === fingerprint(prompt)) { matches.push(tip.id); break; }
    }
  }
  return matches;
}
function awardRealBonus(root, ids, now = new Date()) {
  const tips = loadTips(root), selected = tips.filter(tip => ids.includes(tip.id));
  if (!selected.length) return { gained: 0, awarded: [] };
  const result = updateState(root, state => {
    const day = dayOf(now), record = state.days[day] || { xp: 0, prompts: [] }, awarded = []; let gained = 0;
    for (const tip of selected) {
      if (state.bonuses.includes(tip.id) || !state.collected.includes(tip.id) || record.xp + tip.xp > DAILY_LIMIT) continue;
      state.bonuses.push(tip.id); state.xp += tip.xp; record.xp += tip.xp; gained += tip.xp; awarded.push(tip.id);
    }
    if (gained) state.days[day] = record;
    return { changed: gained > 0, gained, awarded };
  });
  return { gained: result.gained, awarded: result.awarded };
}
class FeedingScanner {
  constructor(root, sessionsRoot, options = {}) {
    this.root = root;
    this.reader = new (require('./equipe.cjs').TeamReader)(root, sessionsRoot, options);
    this.positions = new Map();
    this.scanBytes = options.scanBytes || 262144;
  }
  publicEntry(entry, all) {
    const sensitive = require('./equipe.cjs').sensitiveCwd;
    const seen = new Set(); let current = entry;
    while (current) {
      if (seen.has(current.id) || sensitive(current.cwd) || sensitive(current.projectDir) || current.model === 'codex-auto-review' || /guardian review/i.test(this.reader.names.get(current.id) || current.nickname || '')) return false;
      seen.add(current.id);
      if (!current.metaSeen || !current.cwd) return false;
      if (!current.parentId) return true;
      current = all.find(candidate => candidate.family === entry.family && candidate.id === current.parentId);
      if (!current) return false;
    }
    return false;
  }
  scan(now = new Date()) {
    const team = this.reader.snapshot(now), tips = loadTips(this.root), found = new Set();
    const all = [...this.reader.files.values()].filter(entry => entry.family !== 'index' && entry.id);
    const until = Date.now() + 150;
    const approved = all.filter(entry => this.publicEntry(entry, all));
    // Old completed files cannot starve newly appended user messages.
    approved.sort((a, b) => (this.positions.get(a.file)?.offset || 0) - (this.positions.get(b.file)?.offset || 0));
    let attempted = false, pending = false;
    for (const entry of approved) {
      const source = this.reader.sourcesByFile.get(entry.file);
      const file = source && require('./equipe.cjs').safePath(source.root, entry.file, this.reader.checked);
      if (!file) continue;
      let fd;
      try {
        const size = fs.statSync(file).size;
        let position = this.positions.get(file) || { offset: 0, dropping: false };
        if (size < position.offset) position = { offset: 0, dropping: false };
        if (size <= position.offset) continue;
        if (attempted && Date.now() > until) { pending = true; continue; }
        attempted = true;
        fd = fs.openSync(file, 'r');
        const buffer = Buffer.alloc(Math.min(size - position.offset, this.scanBytes)), bytes = fs.readSync(fd, buffer, 0, buffer.length, position.offset);
        const text = buffer.subarray(0, bytes).toString('utf8'), lastNewline = text.lastIndexOf('\n');
        let lines;
        if (lastNewline >= 0) {
          lines = text.slice(0, lastNewline).split('\n');
          // Byte offsets must not use decoded string lengths (UTF-8 prompts can contain accents).
          position.offset += buffer.subarray(0, bytes).lastIndexOf(10) + 1;
          if (position.dropping) { lines.shift(); position.dropping = false; }
        } else if (position.offset + bytes === size && text.trim().endsWith('}')) {
          lines = position.dropping ? [] : [text]; position.offset += bytes; position.dropping = false;
        } else if (bytes === this.scanBytes) {
          lines = []; position.offset += bytes; position.dropping = true;
        } else { lines = []; pending = true; }
        this.positions.set(file, position);
        if (position.offset < size) pending = true;
        for (const line of lines) for (const userText of userTextsOf(line, entry.family)) for (const id of matchingTips(userText, tips)) found.add(id);
      } catch { pending = true; } finally { if (fd !== undefined) fs.closeSync(fd); }
    }
    const bonus = awardRealBonus(this.root, [...found], now);
    return { ...snapshotFeeding(this.root, now), gained: bonus.gained, awarded: bonus.awarded, scanning: team.scanning || pending, detectionSource: 'local-user-message-fingerprints' };
  }
}
module.exports = { FILE, RARITIES, DAILY_LIMIT, normalizePrompt, fingerprint, loadTips, snapshotFeeding, feedTip, userTextsOf, matchingTips, awardRealBonus, FeedingScanner };
