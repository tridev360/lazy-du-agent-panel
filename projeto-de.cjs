'use strict';
// Projetos descobertos por cwd. A demonstracao e escolhida explicitamente.
// No navegador, o servidor injeta a mesma lista usada no seletor.
(function (root, fabrica) {
  let source = root.PainelProjetosDescobertos || { projetos: [], sessoes: [] }, demo = source.demo === true;
  if (typeof module === 'object' && module.exports) {
    demo = process.env.PAINEL_DEMO === '1';
    if (demo) source = { projetos: require('./demo/projetos.cjs'), sessoes: [] };
    else { const s = require('./descoberta.cjs').snapshot(); source = { projetos: s.projects.map(p => ({ id: p.id, nome: p.name, cwd: p.cwd, dono: null })), sessoes: s.sessions }; }
  }
  const api = fabrica(source, demo);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.PainelProjetoDe = api;
})(typeof window === 'object' ? window : globalThis, function (source, demo) {
  const PROJETOS = Object.freeze(source.projetos.map(p => Object.freeze({ ...p })));
  const IDS = new Set(PROJETOS.map(p => p.id));
  const SESSAO = Object.freeze(demo ? Object.fromEntries(PROJETOS.filter(p => p.id !== 'outros').map(p => [p.dono, p.id])) : Object.fromEntries(source.sessoes.map(s => [s.name.toUpperCase(), s.projectId])));
  // apelidos de id (ids antigos ou de outra tela) para os do seletor; vazio no exemplo
  const ALIAS = Object.freeze({});
  const sem = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const caminho = s => sem(s).replace(/\\+/g, '/').replace(/\/+/g, '/');
  const sessaoDe = s => { const v = String(s == null ? '' : s).toUpperCase().trim(); return v === 'COORDENACAO' ? 'COORDENADOR' : v; };
  function idDe(id) { const v = sem(id).trim(); return IDS.has(v) ? v : ALIAS[v] || null; }
  function nomeDe(id) { const p = PROJETOS.find(x => x.id === idDe(id)); return p ? p.nome : '? Projeto'; }
  // 2. pasta de trabalho
  function porPasta(p, quemChamou) {
    const f = caminho(p); if (!f) return null;
    const canonical = v => { const x = String(v || '').replace(/\\/g, '/').replace(/\/$/, ''); return /^[a-z]:\//i.test(x) ? x.toLowerCase() : x; };
    const recorded = canonical(p);
    for (const proj of PROJETOS.filter(x => x.cwd).sort((a, b) => b.cwd.length - a.cwd.length)) { const base = canonical(proj.cwd); if (recorded === base || recorded.startsWith(base + '/')) return proj.id; }
    const chamou = sessaoDe(quemChamou);
    for (const p of PROJETOS) if (p.id !== 'outros' && new RegExp('(^|/)' + p.id + '(/|$)').test(f)) return p.id;
    return chamou && SESSAO[chamou] && /(^|\/)wt\/[^/]+/.test(f) ? SESSAO[chamou] : null;
  }
  // 3. palavra do titulo (ou do nome da rodada); a primeira regra que casa vence
  const PALAVRAS = PROJETOS.filter(p => p.id !== 'outros').map(p => [new RegExp('\\b' + sem(p.nome).replace(/[^a-z0-9 ]/g, ' ').trim().replace(/\s+/g, '\\s+') + '\\b'), p.id]);
  function porTitulo(t) { const f = sem(t).replace(/[_]+/g, ' '); if (!f.trim()) return null; for (const [rx, id] of PALAVRAS) if (rx.test(f)) return id; return null; }
  // item: { tipo, sessao, quemChamou, pasta, pastas: [], titulo, titulos: [], projeto }
  function projetoDe(item) {
    const it = item && typeof item === 'object' ? item : {};
    const direto = idDe(it.projeto); if (direto) return direto;
    if (it.tipo === 'sessao') return SESSAO[sessaoDe(it.sessao)] || null;
    const chamou = sessaoDe(it.quemChamou || it.sessao);
    const conta = new Map();
    for (const p of [it.pasta, ...(Array.isArray(it.pastas) ? it.pastas : [])]) { const id = porPasta(p, chamou); if (id) conta.set(id, (conta.get(id) || 0) + 1); }
    if (conta.size) return [...conta].sort((a, b) => b[1] - a[1] || PROJETOS.findIndex(p => p.id === a[0]) - PROJETOS.findIndex(p => p.id === b[0]))[0][0];
    for (const t of [it.titulo, ...(Array.isArray(it.titulos) ? it.titulos : [])]) { const id = porTitulo(t); if (id) return id; }
    return SESSAO[chamou] || (demo ? 'outros' : null);
  }
  return Object.freeze({ PROJETOS, SESSAO, ALIAS, idDe, nomeDe, porPasta, porTitulo, projetoDe });
});
