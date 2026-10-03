'use strict';
// Only derived per-conversation/day numbers survive selection changes.
class DailyUsage {
  constructor(saved = []) {
    this.rows = new Map();
    this.merge(saved);
  }
  merge(rows) {
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      if (!row || !/^[a-f0-9]{6,64}$/.test(row.conversation) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(row.day) ||
          !['codex', 'claude'].includes(row.agent) ||
          !Number.isSafeInteger(row.tokens) || row.tokens < 0) continue;
      const unit = row.agent === 'claude' && /^[a-f0-9]{6,64}$/.test(row.unit) ? row.unit : null;
      const key = row.agent + '|' + (unit || row.conversation) + '|' + row.day;
      const prior = this.rows.get(key);
      this.rows.set(key, {
        conversation: row.conversation, day: row.day, agent: row.agent,
        ...(unit ? {unit} : {}),
        tokens: Math.max(prior?.tokens ?? 0, row.tokens),
        weightedTokens: Number.isFinite(row.weightedTokens) && row.weightedTokens >= 0
          ? Math.max(prior?.weightedTokens ?? 0, row.weightedTokens)
          : prior?.weightedTokens ?? null,
      });
    }
  }
  save() { return [...this.rows.values()]; }
  snapshot(now) {
    const today = now.toISOString().slice(0, 10);
    const weekStart = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);
    const rows = this.save();
    const periods = [{key:'today',from:today,to:today},{key:'week',from:weekStart,to:today}].map(period => {
      const selected = rows.filter(row => row.day >= period.from && row.day <= period.to);
      const sum = agent => selected.some(row => row.agent === agent)
        ? selected.filter(row => row.agent === agent).reduce((n,row) => n + row.tokens, 0) : null;
      return {...period, claude:sum('claude'), codex:sum('codex'),
        weightedTokens:selected.some(row => Number.isFinite(row.weightedTokens))
          ? selected.reduce((n,row) => n + (row.weightedTokens ?? 0), 0) : null};
    });
    const daily = new Map();
    for (const row of rows) if (row.agent === 'claude' && row.day <= today)
      daily.set(row.day, (daily.get(row.day) ?? 0) + row.tokens);
    return {periods, daily:[...daily].map(([day,tokens]) => ({day,tokens})).sort((a,b)=>b.day.localeCompare(a.day)).slice(0,7)};
  }
}
module.exports = {DailyUsage};
