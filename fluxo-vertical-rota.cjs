'use strict';
//   GET /api/fluxo-vertical/agentes  e os arquivos /fluxo-vertical.js e /fluxo-vertical.css
// O que sai, por sessao do Claude (as mesmas da estado/sessoes-claude.json que o claude-atividade.cjs ja le):
//   - lida: false quando a conversa da sessao nao foi achada (a tela mostra "?" com a solucao, nunca "nenhum agente");
//   - os ajudantes das ultimas 2 h (ate 12, os mesmos da lista de hoje), com tipo e a frase curta do itemAjudante (mesma limpeza
//     e mesma regra de reservado), a hora de inicio e a ultima;
//   - de cada um: as FERRAMENTAS chamadas na janela, so o nome de uma LISTA FECHADA e a conta (fora da lista: "outra"; conector: "Conector"
//     ou "Navegador"); nunca o argumento;
//   - de cada um: as MEMORIAS lidas, so pelo caminho .claude/projects/<projeto>/memory/<nome>.md (Read do arquivo, ou comando que cita esse
//     caminho), pelo titulo do indice; nunca o cortes. Vira so a conta "reservada": sessao reservada (ASSISTENTE), tipo reservado (tipo reservado),
//     pasta do privado-a, memoria de OUTRO projeto que nao o da conversa, cabecalho (ate 2 KB) com a marca SIGILOS ou palavra privada,
//     e o dominio que o indice da ASSISTENTE reserva (estrategia, desempenho, compras, carteira, trade);
//   - a DURACAO tipica por tipo de ajudante: mediana de (ultima escrita - inicio) dos que ja terminaram, com o n.
// Nunca sai texto de conversa, id, caminho nem argumento de ferramenta. Toda resposta passa pelo filtro de pessoas do send().
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const A = require('./claude-atividade.cjs');
const PD = require('./projeto-de.cjs');
const ASSETS = { '/fluxo-vertical.js': ['fluxo-vertical.js', 'text/javascript'], '/fluxo-vertical.css': ['fluxo-vertical.css', 'text/css'] };
const JANELA_MS = 2 * 3600e3, ATIVA_MS = 5 * 60e3, LISTA_MAX = 12, MAX_SUB = 2000, MAX_LER = 6 * 1024 * 1024, CACHE_MS = 30e3, CABECALHO = 2048;
const NOME_MEM = /^[A-Za-z0-9][\w.-]{0,79}$/;
// lista fechada dos nomes de ferramenta que podem sair (o resto vira "outra"; mcp__ vira Conector ou Navegador)
const FERRAMENTAS = new Set(['Bash', 'PowerShell', 'Read', 'Edit', 'Write', 'Grep', 'Glob', 'NotebookEdit', 'Agent', 'Task', 'SendMessage', 'SubagentHandback', 'Skill',
  'WebFetch', 'WebSearch', 'ToolSearch', 'TaskStop', 'Monitor', 'TodoWrite', 'Artifact', 'ArtifactComments', 'ArtifactData', 'EnterWorktree', 'ExitWorktree', 'AskUserQuestion']);
function nomeFerramenta(n) {
  const s = String(n || '');
  if (FERRAMENTAS.has(s)) return s;
  if (/^mcp__/i.test(s)) return /browser|chrome/i.test(s) ? 'Navegador' : 'Conector';
  return 'outra';
}
// a marca de sigilo do cabecalho (PRIVADO.) cai no PRIVADO do claude-atividade.cjs, que comeca por /sigilos/i
const MEM_RESERVADA_DIR = /privado-a/i, DOMINIO_BOT = /estrat[eé]gi|desempenho|\bcompras?\b|carteira|wallet|\btrad(?:e|es|ing)\b/i;
// caminho de memoria: .claude/projects/<projeto>/memory/<nome>.md
const CAMINHO_MEM = /[\\/]\.claude[\\/]projects[\\/]([^\\/"'\s]+)[\\/]memory[\\/]([A-Za-z0-9][\w.-]{0,79})\.md\b/g;
const DIR_MEM = /[\\/]\.claude[\\/]projects[\\/]([^\\/"'\s]+)[\\/]memory\b/g;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const lerCache = new Map(), cabCache = new Map();
let memo = null;

function stat(file) { try { const st = fs.lstatSync(file); return st.isFile() && !st.isSymbolicLink() ? st : null; } catch { return null; } }
function pastas(dir) { try { return fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory() && !d.isSymbolicLink()).map(d => d.name); } catch { return []; } }
function arquivos(dir) { try { return fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isFile() && !d.isSymbolicLink()).slice(0, MAX_SUB).map(d => d.name); } catch { return []; } }
const mediana = arr => { if (!arr.length) return null; const s = arr.slice().sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
// cabecalho da memoria (ate 2 KB): so para decidir se e reservada; o texto nunca sai
function cabecalho(file) {
  const st = stat(file); if (!st) return '';
  const old = cabCache.get(file); if (old && old.mtimeMs === st.mtimeMs) return old.txt;
  let txt = '';
  try { const fd = fs.openSync(file, 'r'), buf = Buffer.alloc(Math.min(CABECALHO, st.size)); try { fs.readSync(fd, buf, 0, buf.length, 0); } finally { fs.closeSync(fd); } txt = buf.toString('utf8'); } catch { txt = ''; }
  if (cabCache.size > 4000) cabCache.clear();
  cabCache.set(file, { mtimeMs: st.mtimeMs, txt }); return txt;
}
// memorias que existem, por projeto: chave "<projeto>/<nome>" -> { reservada, titulo }
function memorias(projectsRoot) {
  const out = new Map();
  for (const p of pastas(projectsRoot)) {
    const dir = path.join(projectsRoot, p, 'memory');
    const nomes = arquivos(dir).filter(n => /\.md$/i.test(n)); if (!nomes.length) continue;
    // titulo de gente de cada memoria: so o texto do link no indice MEMORY.md ("[Painel com dado velho](painel-dados-velhos-erro.md)")
    const titulos = new Map();
    try { const st = stat(path.join(dir, 'MEMORY.md')); if (st && st.size < 512 * 1024) for (const m of fs.readFileSync(path.join(dir, 'MEMORY.md'), 'utf8').matchAll(/\[([^\]\n]{2,80})\]\(([\w.-]{1,80})\.md\)/g)) if (!titulos.has(m[2])) titulos.set(m[2], m[1].trim()); } catch { /* sem indice: fica o nome do arquivo */ }
    for (const n of nomes) {
      const nome = n.slice(0, -3); if (!NOME_MEM.test(nome)) continue;
      if (nome === 'MEMORY') { out.set(p + '/MEMORY', { reservada: MEM_RESERVADA_DIR.test(p), titulo: 'Índice da memória (MEMORY.md)' }); continue; }
      const titulo = titulos.get(nome) || null, cab = cabecalho(path.join(dir, n)), legivel = nome.replace(/[-_]+/g, ' ');
      const reservada = MEM_RESERVADA_DIR.test(p) || A.PRIVADO.test(cab) || A.PRIVADO.test(legivel) || Boolean(titulo && A.PRIVADO.test(titulo))
        || DOMINIO_BOT.test(legivel) || Boolean(titulo && DOMINIO_BOT.test(titulo)) || DOMINIO_BOT.test(cab.slice(0, 600));
      out.set(p + '/' + nome, { reservada, titulo });
    }
  }
  return out;
}
// conta ferramentas e memorias de 1 ajudante, so na janela; o texto e lido para achar nome e nunca sai
function lerAjudante(file, st, desde, mems, quemChamou) {
  const old = lerCache.get(file); if (old && old.mtimeMs === st.mtimeMs && old.desde === desde && old.quem === quemChamou) return old.dado;
  const ferr = new Map(), mem = new Map(), conta = chave => mem.set(chave, (mem.get(chave) || 0) + 1), proj = new Map();
  const votar = (txt, quem) => { const id = txt ? PD.porPasta(txt, quem) : null; if (id) proj.set(id, (proj.get(id) || 0) + 1); };
  try {
    const ini = Math.max(0, st.size - MAX_LER), len = st.size - ini, buf = Buffer.alloc(len), fd = fs.openSync(file, 'r');
    try { fs.readSync(fd, buf, 0, len, ini); } finally { fs.closeSync(fd); }
    const linhas = buf.toString('utf8').split('\n'); if (ini > 0) linhas.shift();
    for (const t of linhas) {
      if (!t || t.indexOf('"tool_use"') < 0) continue;
      let l; try { l = JSON.parse(t); } catch { continue; }
      const at = Date.parse(l && l.timestamp || ''); if (Number.isFinite(at) && at < desde) continue;
      const content = l && l.message && Array.isArray(l.message.content) ? l.message.content : [];
      for (const part of content) {
        if (!part || part.type !== 'tool_use' || typeof part.name !== 'string') continue;
        const nome = nomeFerramenta(part.name); ferr.set(nome, (ferr.get(nome) || 0) + 1);
        const inp = part.input && typeof part.input === 'object' ? part.input : {};
        // memoria so pelo caminho .claude/projects/<projeto>/memory/<nome>.md, e so se o arquivo existe nessa pasta
        const alvo = typeof inp.file_path === 'string' ? inp.file_path : '';
        votar(alvo || (typeof inp.path === 'string' ? inp.path : ''), quemChamou);
        for (const m of alvo.matchAll(CAMINHO_MEM)) { const k = m[1] + '/' + m[2]; if (mems.has(k)) conta(k); }
        const cmd = typeof inp.command === 'string' ? inp.command : '';
        if (cmd) {
          votar(cmd, quemChamou);
          for (const m of cmd.matchAll(CAMINHO_MEM)) { const k = m[1] + '/' + m[2]; if (mems.has(k)) conta(k); }
          // nome solto (sem barra antes) so vale quando o comando entra na pasta de memoria de um projeto ("cd .../memory && cat a.md")
          const dirs = [...cmd.matchAll(DIR_MEM)].map(m => m[1]);
          if (dirs.length) for (const m of cmd.matchAll(/(^|[\s"'=(])([A-Za-z0-9][\w.-]{0,79})\.md\b/g)) for (const p of new Set(dirs)) { const k = p + '/' + m[2]; if (mems.has(k)) conta(k); }
        }
      }
    }
  } catch { return null; }
  const dado = { ferramentas: [...ferr].sort((a, b) => b[1] - a[1]).map(([nome, n]) => ({ nome, n })), memorias: [...mem.keys()], projetos: [...proj].sort((a, b) => b[1] - a[1]) };
  if (lerCache.size > 500) lerCache.clear();
  lerCache.set(file, { mtimeMs: st.mtimeMs, desde, quem: quemChamou, dado });
  return dado;
}

function agentes({ estadoRoot, appRoot, projectsRoot, now = Date.now() }) {
  const lista = (() => { try { return JSON.parse(fs.readFileSync(path.join(estadoRoot, 'estado', 'sessoes-claude.json'), 'utf8')); } catch { return null; } })();
  const sessoes = Array.isArray(lista && lista.sessoes) ? lista.sessoes : [];
  const mapa = A.mapaDoApp(appRoot), projetos = pastas(projectsRoot), mems = memorias(projectsRoot);
  const iso = t => t === null || !Number.isFinite(t) ? null : new Date(t).toISOString();
  const desde = now - JANELA_MS, porTipo = new Map(), out = [];
  for (const item of sessoes) {
    const sessao = String(item && item.titulo || '').toUpperCase().replace(/^COORDENACAO$/, 'COORDENADOR');
    if (!/^[A-Z]{2,20}$/.test(sessao) || out.some(r => r.sessao === sessao)) continue;
    const cli = mapa.get(String(item && item.sessionId || '')) || null;
    if (!cli || !UUID.test(cli)) { out.push({ sessao, lida: false, agentes: [] }); continue; }
    const todos = [];
    for (const p of projetos) {
      const sub = path.join(projectsRoot, p, cli, 'subagents');
      for (const n of arquivos(sub)) {
        if (!/^agent-[0-9a-z]{6,40}\.jsonl$/i.test(n)) continue;
        const file = path.join(sub, n), st = stat(file); if (!st || st.mtimeMs > now + 120e3) continue;
        const ativoHora = now - st.mtimeMs <= ATIVA_MS, fim = ativoHora ? A.terminou(file, st.mtimeMs) : true;
        // inicio = hora do .meta.json (reescrito quando o ajudante e chamado de novo: mede a ultima volta, igual ao "desde" da lista
        // de hoje); sem meta, a criacao do arquivo
        const meta = stat(file.replace(/\.jsonl$/i, '.meta.json'));
        const ini = meta && meta.mtimeMs <= st.mtimeMs ? meta.mtimeMs : Number.isFinite(st.birthtimeMs) && st.birthtimeMs > 0 ? st.birthtimeMs : null;
        todos.push({ at: st.mtimeMs, ini, file, fim, st, proj: p });
      }
    }
    todos.sort((a, b) => b.at - a.at);
    const reservadaSessao = A.SESSOES_RESERVADAS.has(sessao);
    for (const a of todos) {
      if (!a.fim || a.ini === null || a.at < a.ini) continue;
      const it = A.itemAjudante(a, sessao, now, iso); const tipo = it && it.tipo; if (!tipo) continue;
      const min = (a.at - a.ini) / 60000; if (!(min >= 0)) continue;
      const g = porTipo.get(tipo) || []; g.push(min); porTipo.set(tipo, g);
    }
    const agentesJanela = todos.filter(a => a.at >= desde).slice(0, LISTA_MAX).map(a => {
      const it = A.itemAjudante(a, sessao, now, iso) || {};
      const lido = lerAjudante(a.file, a.st, desde, mems, sessao);
      const reservado = reservadaSessao || it.reservado === true;
      let memNomes = null, memRes = 0;
      if (lido) {
        memNomes = [];
        for (const chave of lido.memorias) {
          const [proj, nome] = [chave.slice(0, chave.indexOf('/')), chave.slice(chave.indexOf('/') + 1)], info = mems.get(chave) || {};
          // outro projeto que nao o da conversa do ajudante: reservada (o assunto e de outra casa)
          if (reservado || info.reservada || proj !== a.proj) memRes++; else memNomes.push({ nome, titulo: info.titulo || null });
        }
      }
      const tituloReal = it.oque || (it.soDono && it.soDono.oque) || null;
      const projeto = lido && lido.projetos && lido.projetos.length ? lido.projetos[0][0] : PD.projetoDe({ titulo: tituloReal, quemChamou: sessao });
      // modo dono: o assunto real vai em soDono (o filtro do send tira o campo de todo pedido que nao e do dono)
      const soDono = reservado && it.soDono ? { oque: it.soDono.oque } : null;
      return { tipo: it.tipo || null, oque: reservado ? null : (it.oque || null), reservado: Boolean(reservado || it.reservado), ativo: Boolean(it.ativo), terminou: Boolean(it.terminou), projeto, ...(soDono ? { soDono } : {}),
        inicio: iso(a.ini), ultimaEm: iso(a.at), duracaoMin: a.ini !== null ? Math.max(0, Math.round((a.at - a.ini) / 60000)) : null,
        ferramentas: lido ? lido.ferramentas : null, memorias: memNomes, memoriasReservadas: lido ? memRes : null };
    });
    out.push({ sessao, lida: true, projeto: PD.SESSAO[sessao] || null, agentes: agentesJanela, historico: todos.length });
  }
  const duracao = {};
  for (const [tipo, arr] of porTipo) duracao[tipo] = { medianaMin: Math.round(mediana(arr) * 10) / 10, n: arr.length };
  return { ok: true, lidoEm: new Date(now).toISOString(), janelaMin: JANELA_MS / 60000, sessoes: out, duracao, fonteDuracao: 'início e última escrita de cada ajudante que já terminou, nas conversas das sessões lidas' };
}

function handle(req, url, { send, root, example, dir = __dirname }) {
  const asset = ASSETS[url.pathname];
  if (!asset && url.pathname !== '/api/fluxo-vertical/agentes') return false;
  if (req.method !== 'GET') { send(405, { ok: false, error: 'Somente leitura' }); return true; }
  // arquivo ausente: 404, nunca derruba o servidor (igual ao entregas-rota.cjs)
  if (asset) { let bytes; try { bytes = fs.readFileSync(path.join(dir, asset[0])); } catch { send(404, { ok: false, error: 'Arquivo do Fluxo ausente' }); return true; } send(200, bytes, asset[1]); return true; }
  if (example) { send(409, { ok: false, error: 'Sem exemplo' }); return true; }
  try {
    if (!memo || Date.now() - memo.em > CACHE_MS) {
      const home = (process.env.PAINEL_HOME || os.homedir());
      memo = { em: Date.now(), dado: agentes({ estadoRoot: root, appRoot: process.env.PE_APP_SESSIONS || path.join(home, 'AppData', 'Roaming', 'Claude', 'claude-code-sessions'), projectsRoot: process.env.PE_CLAUDE_PROJECTS || path.join(home, '.claude', 'projects') }) };
    }
    send(200, memo.dado);
  } catch { send(503, { ok: false, error: 'Leitura dos agentes indisponível' }); }
  return true;
}
module.exports = { handle, agentes, ASSETS, nomeFerramenta, FERRAMENTAS };
