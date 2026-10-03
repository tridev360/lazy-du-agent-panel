"use strict";
(function(root) {
  const finite = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
  function agents(snapshot, now = Date.now()) {
    const progressive=!snapshot.example&&snapshot.usage?.ready===false&&(snapshot.usage?.pending||snapshot.usage?.scanning);
    const list=(progressive&&snapshot.usage?.previewSessions?.length?snapshot.usage.previewSessions:snapshot.usage?.sessions || []).map(s => ({...s,
      projectId: s.projectId || 'unassigned',
      state: s.state || (s.recent ? 'recent' : 'resting'),
      tokens: finite(s.tokens) ? s.tokens : null,
      model: s.model || null, effort: s.effort || null, tools: s.tools || [],
    }));
    const crew=root.DuCrew?root.DuCrew.assign(list):list;
    return root.PanelR4Core?root.PanelR4Core.decorate(crew,snapshot,now):crew;
  }
  function totalTokens(list) {
    return list.length && list.every(x => finite(x.tokens))
      ? list.reduce((n, x) => n + x.tokens, 0) : null;
  }
  function water(list) {
    const weighted = list.length && list.every(x => finite(x.weightedTokens))
      ? list.reduce((n, x) => n + x.weightedTokens, 0) : null;
    return finite(weighted) ? weighted / 1500 * .3 : null;
  }
  function cups(ml) {
    if (!finite(ml)) return [];
    return Array.from({length: Math.min(8, Math.max(1, Math.ceil(ml / 250)))},
      (_, i) => Math.max(0, Math.min(1, ml / 250 - i)));
  }
  function progress(items) {
    const known = items.filter(x => finite(x.phase?.percent ?? x.percent));
    return known.length ? Math.round(known.reduce((n,x) => n + (x.phase?.percent ?? x.percent),0) / known.length) : null;
  }
  function nextDue(items) {
    return items.filter(x => (x.phase?.percent ?? x.percent) !== 100 &&
      (Number.isFinite(Date.parse(x.deadlineAt)) || finite(x.deadlineIn)))
      .sort((a,b) => (Date.parse(a.deadlineAt) || a.deadlineIn * 60000) -
        (Date.parse(b.deadlineAt) || b.deadlineIn * 60000))[0] || null;
  }
  function usageTotals(usage={}) {
    if(usage.totals)return usage.totals;
    const sessions=usage.sessions||[],known=sessions.filter(x=>finite(x.tokens)),weighted=sessions.filter(x=>finite(x.weightedTokens));
    return {tokens:known.length?known.reduce((n,x)=>n+x.tokens,0):null,claude:known.some(x=>x.agent==='claude')?known.filter(x=>x.agent==='claude').reduce((n,x)=>n+x.tokens,0):null,codex:known.some(x=>x.agent==='codex')?known.filter(x=>x.agent==='codex').reduce((n,x)=>n+x.tokens,0):null,weightedTokens:weighted.length?weighted.reduce((n,x)=>n+x.weightedTokens,0):null,sessions:sessions.length,known:known.length,weighted:weighted.length};
  }
  const api = {finite, agents, totalTokens, water, cups, progress, nextDue, usageTotals};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PanelCore = api;
})(typeof window === 'object' ? window : globalThis);
