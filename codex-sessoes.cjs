'use strict';
// Cada sessao do Claude (ATENDIMENTO, LOJA, ASSISTENTE, CORTES, COORDENADOR) com os SEUS Codex: rodada em maquina remota e
// codex exec local, com estado, desde quando e titulo curto; e as mensagens Claude <-> Codex de cada par como eventos do fio,
// com a hora real e um resumo curto do pedido (nunca frase generica; sem fonte, campo vazio com o motivo).
// Fontes (todas medidas, nenhuma inventada):
//  - Conversas do Claude (~/.claude/projects/**.jsonl, inclusive subagents): so o COMANDO das ferramentas Bash/PowerShell
//    que chama codex exec ou o script remoto (pasta, nome da rodada, hora) e, do resultado, so o NOME da rodada, PRONTO ou RODANDO.
//  - Conversas do Codex local (~/.codex/sessions/**/rollout-*.jsonl): so metadado (id, hora, pasta, fim da tarefa).
//  - Metadados de maquina remota exportados pelo usuario, sem conexao remota.
//  - estado/fila-codex.md (pedido Claude -> Codex, hora do item), estado/codex.md (linha PARA COORDENADOR) e
//    estado/recados-do-painel.md / respostas-do-painel.md (o dono fala com as COORDENADOR pelo painel).
// Dono da rodada, nesta ordem de prova: comando na conversa da sessao > estado/<sessao>.md cita o nome > work com "dono:".
// Assunto reservado (ASSISTENTE, ou palavra de sigilo) nunca vira titulo: fica null com o motivo.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const H = 3600000, JANELA = 24 * H, VPS_TTL = 60000, VPS_TIMEOUT = 12000, CACHE_TTL = 60000;
const TAIL = 8 * 1024 * 1024, HEAD = 400 * 1024;
const ESTADO = process.env.PE_ESTADO || (process.env.PAINEL_ROOT || require('node:path').join(__dirname, 'demo', 'estado'));
const CLAUDE_DIR = process.env.PE_CLAUDE_PROJECTS || path.join((process.env.PAINEL_HOME || os.homedir()), '.claude', 'projects');
const CODEX_DIR = process.env.PE_CODEX_SESSIONS || path.join((process.env.PAINEL_HOME || os.homedir()), '.codex', 'sessions');
const APP_ROOT = process.env.PE_APP_SESSIONS || path.join((process.env.PAINEL_HOME || os.homedir()), 'AppData', 'Roaming', 'Claude', 'claude-code-sessions');
const SESSOES = ['ATENDIMENTO', 'LOJA', 'ASSISTENTE', 'CORTES', 'COORDENADOR'];
const PRIVATE = /sigilos|segred|carteira|wallet|\bseed\b|\.env\b|\bchave\b|senha|password|private|0x[0-9a-f]{6}|_SECRETS|backup-privado/i;
const UUID_FIM = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const SIGILO_CAUDA = (() => { try { return require('./pe-cauda.cjs').SIGILO || null; } catch { return null; } })();
const PRIVADO_ATIV = (() => { try { return require('./claude-atividade.cjs').PRIVADO || null; } catch { return null; } })();
const TIPO_RESERVADO = (() => { try { return require('./claude-atividade.cjs').TIPO_RESERVADO || { test: () => false }; } catch { return { test: () => false }; } })();
const PESSOAS = require('./sigilo-pessoas.cjs').PESSOAS;
const PD = require('./projeto-de.cjs');
const GENERICO = /^(?:voc[eê]\s+[eé](?=\s|$)|you are\b|leia\b|read\b|regras?\b|limite desta execu|contexto\b|pedido do dono\s*:?\s*$|checklist|importante\b|antes de agir|escreva ok\.md)/i;
function privado(text) {
  if (text == null || text === '') return false;
  const v = String(text), f = String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (!SIGILO_CAUDA || !PRIVADO_ATIV) return true;
  return PRIVATE.test(v) || SIGILO_CAUDA.test(f) || PRIVADO_ATIV.test(v) || PESSOAS.test(f);
}
// so le arquivo de pedido: .md ou .txt, fora de pasta e nome reservados (nunca .env, chave, carteira, PRIVADO)
function podeLerPedido(file) {
  if (typeof file !== 'string' || !/\.(?:md|txt)$/i.test(file)) return false;
  if (/(?:^|[\\/])\.env|_SECRETS|PRIVADO|backup-privado|pasta-privada|[\\/]\.ssh[\\/]|seed|chave|carteira|wallet|secret|token/i.test(file)) return false;
  return !privado(path.basename(file));
}
const fold = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const iso = ms => Number.isFinite(ms) ? new Date(ms).toISOString() : null;
// Data para gente, em BRT: "8 de outubro, 22:40"
function dataTexto(ms) {
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms - 3 * H), two = n => String(n).padStart(2, '0');
  return d.getUTCDate() + ' de ' + MESES[d.getUTCMonth()] + ', ' + two(d.getUTCHours()) + ':' + two(d.getUTCMinutes());
}
// Texto curto e limpo: sem caminho, URL, endereco, e-mail, travessao nem markdown. Sigilo = null.
function limpo(text, max = 110) {
  if (typeof text !== 'string') return null;
  let v = text.replace(/[\u0000-\u001f]/g, ' ').replace(/^\s*#{1,6}\s*/, '').replace(/[`*_>]/g, '').replace(/[\u2013\u2014]/g, ':');
  if (privado(v)) return null;
  v = v.replace(/https?:\/\/\S+/gi, '').replace(/\b[a-z]:[\\/][^\s'")]*/gi, '').replace(/(?:^|\s)\/(?:srv|root|home|tmp|opt)\/\S*/g, ' ')
    .replace(/0x[a-f\d]{8,}/gi, '').replace(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g, '').replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g, '')
    .replace(/\(\s*\)/g, '').replace(/\s+/g, ' ').trim();
  if (!v) return null;
  if (v.length > max) v = v.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
  return v;
}
const SIGLAS = Object.assign({ vps: 'VPS', ui: 'tela', api: 'API' }, (() => { try { const v = JSON.parse(fs.readFileSync(process.env.PAINEL_SIGLAS || path.join(__dirname, 'config', 'siglas.json'), 'utf8')); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } })());
function nomeCurto(nome) { return String(nome || '').replace(/-\d{9,12}$/, '').replace(/-20\d{10}$/, ''); }
function nomeLegivel(nome) {
  if (!nome || privado(nome) || !/[a-z]{2,}/i.test(nomeCurto(nome))) return null;
  const partes = nomeCurto(nome).replace(/^20\d\d-\d\d-\d\d-/, '').split(/[-_]+/).filter(Boolean);
  const out = [];
  for (const p of partes) {
    const k = p.toLowerCase();
    let m;
    if (SIGLAS[k]) out.push(SIGLAS[k]);
    else if ((m = /^r(\d+)$/.exec(k))) out.push('rodada ' + m[1]);
    else if ((m = /^v(\d+)$/.exec(k))) out.push('versão ' + m[1]);
    else if ((m = /^leva(\d+)$/.exec(k))) out.push('leva ' + m[1]);
    else if ((m = /^([a-z]+)(\d+)$/.exec(k)) && m[1].length > 2) out.push(m[1] + ' ' + m[2]);
    else out.push(k);
  }
  const t = out.join(' ').replace(/\s+/g, ' ').trim();
  if (privado(t)) return null;
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : null;
}
function sessaoDoNome(name) {
  const v = fold(name).trim();
  if (/coordenador|coordenacao/.test(v)) return 'COORDENADOR';
  if (/^atendimento\b/.test(v)) return 'ATENDIMENTO';
  if (/^loja\b/.test(v)) return 'LOJA';
  if (/^cortes\b/.test(v)) return 'CORTES';
  if (/^assistente\b/.test(v)) return 'ASSISTENTE';
  return null;
}
const textOf = c => typeof c === 'string' ? c : Array.isArray(c) ? c.map(p => p && p.type === 'text' ? p.text || '' : '').join(' ') : '';

// ---------- leitura com cache por tamanho e hora ----------
const tailCache = new Map();
function tailLines(file, maxBytes, filtro) {
  let st; try { st = fs.statSync(file); } catch { return null; }
  const key = file + '|' + maxBytes, hit = tailCache.get(key);
  if (hit && hit.size === st.size && hit.mtime === st.mtimeMs) return hit.lines;
  const length = Math.min(maxBytes, st.size), buf = Buffer.alloc(length);
  let fd; try { fd = fs.openSync(file, 'r'); fs.readSync(fd, buf, 0, length, st.size - length); } catch { return null; } finally { if (fd !== undefined) fs.closeSync(fd); }
  const lines = buf.toString('utf8').split('\n'); if (length < st.size) lines.shift();
  const kept = lines.filter(filtro);
  tailCache.set(key, { size: st.size, mtime: st.mtimeMs, lines: kept });
  if (tailCache.size > 200) tailCache.delete(tailCache.keys().next().value);
  return kept;
}
function headText(file, bytes = HEAD) {
  try { const fd = fs.openSync(file, 'r'), b = Buffer.alloc(bytes), n = fs.readSync(fd, b, 0, bytes, 0); fs.closeSync(fd); return b.subarray(0, n).toString('utf8'); } catch { return ''; }
}

// ---------- quem e cada conversa do Claude ----------
const appCache = { at: 0, map: new Map() };
function appTitles(appRoot, now) {
  if (now - appCache.at < 5 * 60000) return appCache.map;
  const map = new Map();
  try {
    for (const acc of fs.readdirSync(appRoot, { withFileTypes: true })) {
      if (!acc.isDirectory()) continue;
      for (const org of fs.readdirSync(path.join(appRoot, acc.name), { withFileTypes: true })) {
        if (!org.isDirectory()) continue;
        const dir = path.join(appRoot, acc.name, org.name);
        for (const f of fs.readdirSync(dir)) {
          if (!/^local_[0-9a-f-]{36}\.json$/i.test(f)) continue;
          try {
            const st = fs.statSync(path.join(dir, f)); if (st.size > 1024 * 1024) continue;
            const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
            if (j && typeof j.cliSessionId === 'string' && typeof j.title === 'string') map.set(j.cliSessionId.toLowerCase(), j.title);
          } catch { /* arquivo do app em escrita */ }
        }
      }
    }
  } catch { /* sem pasta do app */ }
  appCache.at = now; appCache.map = map;
  return map;
}
const openingCache = new Map();
function openingSessao(file) {
  if (openingCache.has(file)) return openingCache.get(file);
  let found = null;
  for (const line of headText(file).split('\n')) {
    if (!line.includes('"type":"user"')) continue;
    let r; try { r = JSON.parse(line); } catch { continue; }
    const v = fold(textOf(r.message && r.message.content)).trim(); if (!v) continue;
    const m = /(?:voce\s+e\s+(?:a|o)\s+|sessao\s+)(coordenador|coordenacao|atendimento|loja|cortes|assistente)\b/.exec(v.slice(0, 800));
    found = m ? sessaoDoNome(m[1]) : null; break;
  }
  openingCache.set(file, found);
  return found;
}

// ---------- comandos de Codex nas conversas do Claude ----------
const RE_VPS = /(?:^|[\s;&|(])(?:bash|sh)\s+["']?[^\s"']*codex-remoto(-solto)?\.sh["']?\s+(?:(enviar|buscar)\s+)?("[^"]+"|'[^']+'|[^\s|;&>]+)\s+("[^"]+"|'[^']+'|[^\s|;&>]+)/;
const RE_EXEC = /codex(?:\.exe)?["']?\s+(?:[^|;&\n]*?\s)?exec\b/;
const unq = s => String(s || '').replace(/^["']|["']$/g, '');
const base = p => { const v = unq(p); if (!v || /[$%`]/.test(v)) return null; return v.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || null; };
function parseComando(cmd) {
  const out = [];
  if (typeof cmd !== 'string' || !/codex/i.test(cmd)) return out;
  for (const seg of cmd.split(/\n|&&|;\s/)) {
    let m = RE_VPS.exec(seg);
    if (m) {
      const solto = !!m[1], modo = m[2] || (solto ? null : 'enviar');
      if (!modo) continue;
      if (modo === 'buscar') { const nome = unq(m[4]); if (/^[A-Za-z0-9][\w.-]*-\d{9,12}$/.test(nome)) out.push({ tipo: 'vps-buscar', pasta: base(m[3]), nome }); }
      else out.push({ tipo: 'vps-enviar', solto, pasta: base(solto ? m[3] : m[3]), pastaCompleta: unq(m[3]) || null, pedido: unq(solto ? m[4] : m[4]) });
      continue;
    }
    if (RE_EXEC.test(seg)) {
      const c = /(?:^|\s)(?:-C|--cd)[ =]("[^"]+"|'[^']+'|\S+)/.exec(seg), o = /(?:^|\s)(?:-o|--output-last-message)\s+("[^"]+"|'[^']+'|\S+)/.exec(seg);
      const r = /\bresume\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(seg), p = /\s-\s*<\s*("[^"]+"|'[^']+'|[^\s>]+)/.exec(seg);
      if (/\bssh(?:\.exe)?\s/.test(seg)) { out.push({ tipo: 'exec-ssh' }); continue; }
      out.push({ tipo: r ? 'exec-resume' : 'exec', cwd: c ? unq(c[1]) : null, final: o ? unq(o[1]) : null, prompt: p ? unq(p[1]) : null, resume: r ? r[1].toLowerCase() : null });
    }
  }
  return out;
}
function claudeFiles(dir, since) {
  const list = [];
  let projects; try { projects = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  for (const p of projects) {
    if (!p.isDirectory()) continue;
    let entries; try { entries = fs.readdirSync(path.join(dir, p.name), { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(dir, p.name, e.name);
      if (e.isFile() && UUID_FIM.test(e.name)) { try { if (fs.statSync(full).mtimeMs >= since) list.push({ file: full, uuid: UUID_FIM.exec(e.name)[1].toLowerCase(), pai: null }); } catch { /* sumiu */ } }
      else if (e.isDirectory() && /^[0-9a-f-]{36}$/i.test(e.name)) {
        const sub = path.join(full, 'subagents');
        let kids; try { kids = fs.readdirSync(sub); } catch { continue; }
        for (const k of kids) { if (!/^agent-[\w-]+\.jsonl$/.test(k)) continue; const f = path.join(sub, k); try { if (fs.statSync(f).mtimeMs >= since) list.push({ file: f, uuid: null, pai: e.name.toLowerCase(), mainFile: path.join(dir, p.name, e.name + '.jsonl') }); } catch { /* sumiu */ } }
      }
    }
  }
  return list;
}
const convCache = new Map();
const tipoCache = new Map();
function tipoReservado(file) {
  if (tipoCache.has(file)) return tipoCache.get(file);
  let r = false;
  try { const meta = file.replace(/\.jsonl$/i, '.meta.json'), st = fs.statSync(meta); if (st.size <= 64 * 1024) { const j = JSON.parse(fs.readFileSync(meta, 'utf8')); r = !!(j && typeof j.agentType === 'string' && TIPO_RESERVADO.test(j.agentType)); } } catch { r = false; }
  tipoCache.set(file, r); if (tipoCache.size > 2000) tipoCache.clear();
  return r;
}
function comandosDe(item, since) {
  let st; try { st = fs.statSync(item.file); } catch { return []; }
  let c = convCache.get(item.file);
  if (!c || st.size < c.offset) c = { offset: Math.max(0, st.size - 48 * 1024 * 1024), primeira: st.size > 48 * 1024 * 1024, comandos: [], pend: new Map() };
  if (st.size > c.offset) {
    let fd; try {
      fd = fs.openSync(item.file, 'r'); let pos = c.offset, resto = '';
      while (pos < st.size) {
        const n = Math.min(4 * 1024 * 1024, st.size - pos), b = Buffer.alloc(n); fs.readSync(fd, b, 0, n, pos); pos += n;
        const parts = (resto + b.toString('utf8')).split('\n'); resto = parts.pop();
        if (c.primeira) { parts.shift(); c.primeira = false; }
        for (const line of parts) linha(line, c, item);
      }
      c.offset = st.size - Buffer.byteLength(resto);
    } catch { /* arquivo em escrita: tenta na proxima */ } finally { if (fd !== undefined) fs.closeSync(fd); }
  }
  convCache.set(item.file, c); if (convCache.size > 600) convCache.delete(convCache.keys().next().value);
  return c.comandos.filter(x => x.at >= since);
}
function linha(line, c, item) {
  const cod = line.includes('codex'), res = c.pend.size > 0 && line.includes('"tool_use_id"');
  if (!cod && !res) return;
  let r; try { r = JSON.parse(line); } catch { return; }
  const parts = Array.isArray(r.message && r.message.content) ? r.message.content : [];
  if (r.type === 'assistant' && cod) {
    const at = Date.parse(r.timestamp); if (!Number.isFinite(at)) return;
    for (const part of parts) {
      if (!part || part.type !== 'tool_use' || !/^(Bash|PowerShell)$/.test(part.name || '')) continue;
      for (const x of parseComando(part.input && part.input.command)) { const cmd = { ...x, at, toolId: part.id, uuid: item.uuid || item.pai, ajudante: !!item.pai, reservado: item.pai ? tipoReservado(item.file) : false, mainFile: item.mainFile || item.file }; c.comandos.push(cmd); if (/^vps-/.test(x.tipo)) c.pend.set(part.id, cmd); }
    }
    if (c.comandos.length > 3000) c.comandos = c.comandos.slice(-2000);
  } else if (r.type === 'user' && res) {
    for (const part of parts) {
      if (!part || part.type !== 'tool_result' || !c.pend.has(part.tool_use_id)) continue;
      const cmd = c.pend.get(part.tool_use_id), txt = textOf(part.content).slice(-4000); c.pend.delete(part.tool_use_id);
      cmd.respostaEm = Date.parse(r.timestamp);
      if (cmd.tipo === 'vps-enviar') { const m = /(?:^|\n)\s*([A-Za-z0-9][\w.-]*-\d{9,12})\s*$/m.exec(txt); if (m) cmd.nome = m[1]; }
      if (cmd.tipo === 'vps-buscar') cmd.resultado = /\bPRONTO\b/.test(txt) ? 'pronto' : /\bRODANDO\b/.test(txt) ? 'rodando' : null;
    }
    if (c.pend.size > 200) c.pend = new Map([...c.pend].slice(-100));
  }
}
function scanClaude({ claudeDir, appRoot, now }) {
  const since = now - JANELA, files = claudeFiles(claudeDir, since);
  if (!files) return { ok: false, motivo: 'pasta das conversas do Claude sem leitura', comandos: [] };
  const titles = appTitles(appRoot, now), comandos = [];
  for (const item of files) for (const c of comandosDe(item, since)) comandos.push(c);
  // sessao dona de cada conversa: titulo do app > abertura da conversa
  const dono = new Map();
  for (const c of comandos) {
    if (dono.has(c.uuid)) { c.sessao = dono.get(c.uuid); continue; }
    const s = sessaoDoNome(titles.get(c.uuid)) || openingSessao(c.mainFile);
    dono.set(c.uuid, s); c.sessao = s;
  }
  return { ok: true, comandos, conversas: files.length };
}

// ---------- Codex local (rollouts) ----------
function walk(dir, since, out = [], depth = 0) {
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return depth === 0 ? null : out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && depth < 3) walk(full, since, out, depth + 1);
    else if (e.isFile() && /^rollout-.*\.jsonl$/.test(e.name)) { try { const st = fs.statSync(full); if (st.mtimeMs >= since) out.push({ file: full, mtime: st.mtimeMs }); } catch { /* sumiu */ } }
  }
  return out;
}
const metaCache = new Map();
function rolloutMeta(file, mtime) {
  const hit = metaCache.get(file); if (hit && hit.mtime === mtime) return hit.value;
  let value = null;
  const first = headText(file, 64 * 1024).split('\n')[0];
  try {
    const r = JSON.parse(first);
    if (r && r.type === 'session_meta' && r.payload) value = { id: String(r.payload.id || '').toLowerCase(), cwd: typeof r.payload.cwd === 'string' ? r.payload.cwd : null, startedAt: Date.parse(r.payload.timestamp || r.timestamp), originator: String(r.payload.originator || ''), source: typeof r.payload.source === 'string' ? r.payload.source : (r.payload.source ? 'sub' : '') };
  } catch { /* 1a linha grande demais ou cortada */ }
  if (value) {
    let started = 0, done = 0, last = NaN;
    for (const line of tailLines(file, 2 * 1024 * 1024, l => l.includes('"task_started"') || l.includes('"task_complete"') || l.includes('"turn_aborted"')) || []) {
      const t = /"timestamp":"([^"]+)"/.exec(line); const at = t ? Date.parse(t[1]) : NaN;
      if (line.includes('"task_started"')) started = Math.max(started, at || 0); else done = Math.max(done, at || 0);
    }
    last = mtime;
    value.lastAt = last; value.doneAt = done && done >= started ? done : null;
  }
  metaCache.set(file, { mtime, value }); if (metaCache.size > 400) metaCache.delete(metaCache.keys().next().value);
  return value;
}
function scanCodexLocal({ codexDir, now }) {
  const files = walk(codexDir, now - JANELA);
  if (!files) return { ok: false, motivo: 'pasta das conversas do Codex sem leitura', rollouts: [] };
  const rollouts = [];
  for (const f of files) { const m = rolloutMeta(f.file, f.mtime); if (m && m.id) rollouts.push({ ...m, file: f.file }); }
  return { ok: true, rollouts };
}
const normPath = p => fold(String(p || '').replace(/\\/g, '/').replace(/^\/([a-z])\//i, '$1:/').replace(/\/+$/, ''));

// ---------- VPS ----------
const VPS_PY = String.raw`import os,json,time
root=os.path.expanduser('~/trabalhos-remotos')
now=time.time()
procs={}
for n in os.listdir('/proc'):
  if not n.isdigit(): continue
  try:
    if open('/proc/'+n+'/comm').read().strip() not in ('codex','codex.exe','node'): continue
    c=os.readlink('/proc/'+n+'/cwd')
    if c.startswith(root+'/'):
      k=c[len(root)+1:].split('/')[0]
      try: st=open('/proc/'+n+'/stat').read().rsplit(')',1)[1].split()[0]
      except (OSError,IndexError): st='?'
      procs.setdefault(k,[]).append(st)
  except OSError: pass
def mt(p):
  try: return int(os.stat(p).st_mtime)
  except OSError: return None
out=[]
for e in os.scandir(root):
  if not e.is_dir(follow_symlinks=False): continue
  d=e.path; m=mt(d) or 0
  logm=mt(d+'/saida.log'); last=max([x for x in (m,logm,mt(d+'/saida-codigo.txt')) if x] or [0])
  if now-last>172800 and e.name not in procs: continue
  r={'nome':e.name,'mtime':m,'log':logm,'final':mt(d+'/final.txt'),'pedido':mt(d+'/PEDIDO.md'),'exitEm':mt(d+'/saida-codigo.txt'),'vivo':e.name in procs,'parado':bool(procs.get(e.name)) and all(s in ('T','t') for s in procs[e.name]),'pausadoArq':os.path.exists(d+'/PAUSADO.txt')}
  try: r['exit']=open(d+'/saida-codigo.txt').read(20).strip()
  except OSError: r['exit']=None
  try:
    t=''
    with open(d+'/PEDIDO.md','rb') as f:
      t=[l.strip()[:200] for l in f.read(8000).decode('utf8','replace').splitlines() if l.strip()][:6]
    r['linhas']=t
  except OSError: r['linhas']=None
  if r['vivo'] and logm:
    try:
      with open(d+'/saida.log','rb') as f:
        f.seek(0,2); s=f.tell(); f.seek(max(0,s-400000)); b=f.read().decode('utf8','replace')
      for l in reversed(b.splitlines()):
        if '"rate_limits"' not in l: continue
        try: j=json.loads(l)
        except ValueError: continue
        def find(o):
          if isinstance(o,dict):
            if 'rate_limits' in o and isinstance(o['rate_limits'],dict): return o['rate_limits']
            for v in o.values():
              x=find(v)
              if x: return x
          return None
        rl=find(j)
        if rl:
          keep={}
          for k in ('primary','secondary'):
            w=rl.get(k)
            if isinstance(w,dict): keep[k]={'used_percent':w.get('used_percent'),'window_minutes':w.get('window_minutes'),'resets_at':w.get('resets_at')}
          keep['plan_type']=rl.get('plan_type') if isinstance(rl.get('plan_type'),str) else None
          r['rl']=keep; r['rlEm']=logm; break
    except OSError: pass
  out.append(r)
cred=None
try:
  import glob
  fs_=sorted(glob.glob(os.path.expanduser('~/.codex/sessions/*/*/*/rollout-*.jsonl')),key=lambda p:os.stat(p).st_mtime,reverse=True)[:4]
  for p in fs_:
    with open(p,'rb') as f:
      f.seek(0,2); s=f.tell(); f.seek(max(0,s-2000000)); b=f.read().decode('utf8','replace')
    for l in reversed(b.splitlines()):
      if '"rate_limits"' not in l: continue
      try: j=json.loads(l)
      except ValueError: continue
      rl=(j.get('payload') or {}).get('rate_limits')
      if not isinstance(rl,dict): continue
      keep={'em':j.get('timestamp'),'plan_type':rl.get('plan_type') if isinstance(rl.get('plan_type'),str) else None}
      for k in ('primary','secondary'):
        w=rl.get(k)
        if isinstance(w,dict): keep[k]={'used_percent':w.get('used_percent'),'window_minutes':w.get('window_minutes'),'resets_at':w.get('resets_at')}
      if not cred or str(keep['em'])>str(cred['em']): cred=keep
      break
except Exception: pass
print(json.dumps({'agora':int(now),'rodadas':out,'credito':cred}))
`;
let vpsState = { at: 0, value: null, pending: null };
function lerVps(now, { vpsReader } = {}) {
  // Somente fixture injetada ou metadados exportados. Nenhuma conexao remota no kit.
  return vpsReader ? Promise.resolve(vpsReader()) : Promise.resolve({ok:false,motivo:'Use os metadados exportados em fontes/.',rodadas:[]});
}
// Credito do Codex lido do log da rodada viva na VPS (o mesmo rate_limits que o uso-codex.mjs le das conversas locais).
function creditoVps() {
  const v = vpsState.value; if (!v || !v.ok) return null;
  let best = null;
  for (const r of v.rodadas) if (r.rl && Number.isFinite(r.rlEm) && (!best || r.rlEm > best.rlEm)) best = r;
  if (v.credito && Number.isFinite(Date.parse(v.credito.em))) { const em = Date.parse(v.credito.em) / 1000; if (!best || em > best.rlEm) best = { rl: v.credito, rlEm: em }; }
  if (!best) return null;
  const windows = [];
  for (const k of ['primary', 'secondary']) { const w = best.rl[k]; if (w && Number.isFinite(w.used_percent) && Number.isFinite(w.window_minutes)) windows.push({ used: Math.round(w.used_percent), minutes: w.window_minutes, reset: Number.isFinite(w.resets_at) ? iso(w.resets_at * 1000) : null }); }
  return windows.length ? { updated: iso(best.rlEm * 1000), source: 'VPS: rate_limits do log da rodada viva (ssh, 60 s)', windows, plan: best.rl.plan_type || null } : null;
}

// ---------- estado: dono por citacao e por work ----------
function donoPorEstado(estado) {
  const cit = new Map();
  const arquivos = { ATENDIMENTO: 'atendimento.md', LOJA: 'loja.md', ASSISTENTE: 'assistente.md', CORTES: 'cortes.md', COORDENADOR: 'coordenacao.md' };
  for (const [s, f] of Object.entries(arquivos)) { try { cit.set(s, fs.readFileSync(path.join(estado, 'estado', f), 'utf8')); } catch { /* sem arquivo */ } }
  let passagem = ''; try { passagem = fs.readFileSync(path.join(estado, 'estado', 'coordenador-passagem.md'), 'utf8'); } catch { /* sem passagem */ }
  return nome => {
    const curto = nomeCurto(nome);
    for (const [s, t] of cit) if (t.includes(nome)) return { sessao: s, prova: 'estado/' + arquivos[s] + ' cita a rodada' };
    for (const [s, t] of cit) if (curto.length >= 6 && t.includes(curto)) return { sessao: s, prova: 'estado/' + arquivos[s] + ' cita a pasta' };
    if (passagem && (passagem.includes(nome) || (curto.length >= 6 && passagem.includes(curto)))) return { sessao: 'COORDENADOR', prova: 'estado/coordenador-passagem.md cita a rodada' };
    try {
      const txt = fs.readFileSync(path.join(estado, 'tasks', curto + '.md'), 'utf8').slice(0, 4000);
      const m = /dono:\s*([A-Za-z]+)/i.exec(txt); const s = m ? sessaoDoNome(m[1]) : null;
      if (s) return { sessao: s, prova: 'tasks/' + curto + '.md (dono)' };
    } catch { /* sem work */ }
    return null;
  };
}

// ---------- fila e codex.md: Claude <-> Codex das COORDENADOR, com hora real ----------
function fioCoordenador(estado, since, now) {
  const ev = [];
  let ok = true;
  const ler = n => { try { return fs.readFileSync(path.join(estado, 'estado', n), 'utf8'); } catch (e) { if (!e || e.code !== 'ENOENT') ok = false; return ''; } };
  const fila = ler('fila-codex.md').split(/\r?\n/);
  for (const line of fila.slice(-600)) {
    const m = /^(\d{1,4})\.\s+(20\d\d-\d\d-\d\dT[\d:.]+[-+]\d\d:\d\d)\s+(.*)$/.exec(line); if (!m) continue;
    const at = Date.parse(m[2]); if (!(at >= since && at <= now + 60000)) continue;
    const corpo = m[3];
    if (/^PAINEL AUTOMATICO/i.test(corpo)) continue; // pedido gerado pelo proprio painel, nao e mensagem de ninguem
    const de = /^Claude|^COORDENADOR \(Claude\)|^COORDENACAO/i.test(corpo) ? 'COORDENADOR' : sessaoDoNome(corpo.split(/[\s:(]/)[0]) || 'COORDENADOR';
    const sem = corpo.replace(/^[A-Z ]+->\s*CODEX\s*/i, '').replace(/^\([^)]*\)\.?\s*/, '');
    const resumo = de === 'ASSISTENTE' ? null : limpo(sem.split(/(?<=[.!?])\s/)[0], 140);
    ev.push({ em: at, de: { sessao: de, tipo: 'claude' }, para: { sessao: 'COORDENADOR-CODEX', tipo: 'codex' }, tipo: /\?\s*$/.test(sem.split(/(?<=[.!?])\s/)[0]) ? 'duvida' : 'comando', titulo: 'Pedido ' + m[1] + ' da fila do Codex', resumo, motivo: resumo ? null : de === 'ASSISTENTE' ? 'assunto reservado' : 'texto do pedido com dado reservado ou vazio', fonte: { arquivo: 'estado/fila-codex.md', item: Number(m[1]) } });
  }
  for (const line of ler('codex.md').split(/\r?\n/).slice(-800)) {
    if (!/PARA COORDENADOR/.test(line)) continue;
    const t = /(20\d\d-\d\d-\d\dT[\d:.]+[-+]\d\d:\d\d)/.exec(line); if (!t) continue;
    const at = Date.parse(t[1]); if (!(at >= since && at <= now + 60000)) continue;
    const tag = /^\[([^\]]{1,60})\]/.exec(line);
    const resto = line.slice(line.indexOf(t[1]) + t[1].length).replace(/^\s*Get-Date\.?\s*/, '').replace(/PARA COORDENADOR:?\s*/, '');
    const resumo = limpo(resto.split(/(?<=[.!?])\s/)[0], 140);
    ev.push({ em: at, de: { sessao: 'COORDENADOR-CODEX', tipo: 'codex' }, para: { sessao: 'COORDENADOR', tipo: 'claude' }, tipo: 'resposta', titulo: 'Aviso do Codex para o COORDENADOR' + (tag ? ' (' + limpo(tag[1], 40) + ')' : ''), resumo, motivo: resumo ? null : 'texto com dado reservado ou vazio', fonte: { arquivo: 'estado/codex.md', etiqueta: tag ? tag[1] : null } });
  }
  return { ok, eventos: ev };
}
function fioPainel(estado, since, now) {
  const ev = []; let ok = true;
  const ler = n => { try { return fs.readFileSync(path.join(estado, 'estado', n), 'utf8'); } catch (e) { if (!e || e.code !== 'ENOENT') ok = false; return ''; } };
  const brt = (d, mo, h, mi) => { const y = new Date(now).getUTCFullYear(); let at = Date.UTC(y, mo - 1, d, h + 3, mi); if (at - now > 86400000) at = Date.UTC(y - 1, mo - 1, d, h + 3, mi); return at; };
  for (const line of ler('recados-do-painel.md').split(/\r?\n/)) {
    const m = /^- (\d{2})\/(\d{2}) (\d{2}):(\d{2}) \| ([^|]+?) \| (.*?) \| painel-[\w-]+/.exec(line); if (!m) continue;
    const at = brt(+m[1], +m[2], +m[3], +m[4]); if (at < since || at > now + 60000) continue;
    const dest = fold(m[5]), alvos = /os dois/.test(dest) ? ['COORDENADOR', 'COORDENADOR-CODEX'] : /codex/.test(dest) ? ['COORDENADOR-CODEX'] : /coordenador|coordenacao/.test(dest) ? ['COORDENADOR'] : [];
    const resumo = limpo(m[6], 140);
    for (const s of alvos) ev.push({ em: at, de: { sessao: 'VOCE', tipo: 'dono' }, para: { sessao: s, tipo: s === 'COORDENADOR' ? 'claude' : 'codex' }, tipo: /\?\s*$/.test(m[6]) ? 'duvida' : 'comando', titulo: 'Recado seu pelo painel', resumo, motivo: resumo ? null : 'texto com dado reservado', fonte: { arquivo: 'estado/recados-do-painel.md' } });
  }
  for (const line of ler('respostas-do-painel.md').split(/\r?\n/)) {
    const m = /^- (\d{2})\/(\d{2}) (\d{2}):(\d{2}) \| (COORDENADOR CLAUDE|COORDENADOR CODEX) \| painel-[\w-]+ \| (.*)$/.exec(line); if (!m) continue;
    const at = brt(+m[1], +m[2], +m[3], +m[4]); if (at < since || at > now + 60000) continue;
    const resumo = limpo(m[6], 140), s = /CODEX/.test(m[5]) ? 'COORDENADOR-CODEX' : 'COORDENADOR';
    ev.push({ em: at, de: { sessao: s, tipo: s === 'COORDENADOR' ? 'claude' : 'codex' }, para: { sessao: 'VOCE', tipo: 'dono' }, tipo: 'resposta', titulo: 'Resposta pelo painel', resumo, motivo: resumo ? null : 'texto com dado reservado', fonte: { arquivo: 'estado/respostas-do-painel.md' } });
  }
  return { ok, eventos: ev };
}

// ---------- juntar ----------
function legivel(t) {
  if (!t) return t;
  let v = t.replace(/^\s*#{1,6}\s*/, '').replace(/^(?:PEDIDO(?: AO CODEX)?(?:\s*\([^)]*\))?|FRENTE|TAREFA|RODADA)\s*:\s*/i, '');
  const letras = v.replace(/[^A-Za-zÀ-ÿ]/g, ''), caixa = v.replace(/[^A-ZÀ-Þ]/g, '');
  if (letras.length > 8 && caixa.length / letras.length > 0.6) v = v.toLowerCase().replace(/\b(vps|ui|api)\b/g, m => m.toUpperCase());
  return v.charAt(0).toUpperCase() + v.slice(1);
}
// 1a linha com assunto: pula a abertura de papel ("Voce e o painel inteiro..."), regra e cabecalho vazio
function escolherLinha(linhas) {
  if (!Array.isArray(linhas)) return null;
  for (const l of linhas.slice(0, 6)) { const v = String(l || '').replace(/^\s*#{1,6}\s*/, '').trim(); if (v.length >= 4 && !GENERICO.test(v)) return v; }
  return null;
}
function tituloDoPrompt(file) {
  if (!podeLerPedido(file)) return null;
  return escolherLinha(headText(file, 8000).split(/\r?\n/).filter(l => l.trim()).slice(0, 6));
}
function montar({ claude, local, vps, estado, now, coordenador, painel }) {
  const since = now - JANELA, donoDe = donoPorEstado(estado);
  const codex = []; // cada Codex achado
  const porNome = new Map();
  // 1) VPS: cada rodada
  for (const r of vps.ok ? vps.rodadas : []) {
    const desde = (Number.isFinite(r.pedido) ? r.pedido : r.mtime) * 1000;
    const ultimo = Math.max(r.mtime || 0, r.log || 0, r.exitEm || 0) * 1000;
    if (!r.vivo && ultimo < since) continue;
    const pausada = r.vivo && (r.parado === true || r.pausadoArq === true) || (!r.vivo && r.pausadoArq === true && (r.exit == null || r.exit === ''));
    const estadoR = pausada ? 'pausada' : r.vivo ? 'rodando' : r.exit === '0' ? 'terminou' : r.exit != null && r.exit !== '' ? 'erro' : 'parou';
    const item = { id: 'vps:' + r.nome, onde: 'vps', rodada: r.nome, estado: estadoR, desde, fimEm: r.exitEm ? r.exitEm * 1000 : null, ultimoSinal: ultimo, saida: r.exit, tituloCru: escolherLinha(r.linhas || (r.titulo ? [r.titulo] : null)), eventos: [] };
    codex.push(item); porNome.set(r.nome, item);
  }
  // 2) comandos do Claude: amarram dono, hora e pedido
  const usados = new Set();
  const cmds = claude.ok ? claude.comandos.slice().sort((a, b) => a.at - b.at) : [];
  for (const c of cmds) {
    if (c.tipo === 'exec-ssh') continue; // codex exec direto pela ssh: sem pasta da casa nem conversa local, nao ha o que provar
    if (c.tipo === 'vps-enviar') {
      if (!c.nome && !c.pasta) continue;
      let item = c.nome ? porNome.get(c.nome) : null;
      if (!item && c.pasta) item = codex.find(x => x.onde === 'vps' && !x.sessao && nomeCurto(x.rodada) === c.pasta && Math.abs(x.desde - c.at) < 15 * 60000);
      if (!item && c.nome && vps.ok) continue; // rodada que ja saiu da VPS
      if (!item) { item = { id: 'vps:' + (c.nome || c.pasta + '@' + c.at), onde: 'vps', rodada: c.nome || null, estado: vps.ok ? '?' : '?', desde: c.at, fimEm: null, ultimoSinal: c.at, saida: null, tituloCru: null, eventos: [], motivo: vps.ok ? 'rodada nao achada na VPS' : 'VPS sem leitura agora' }; codex.push(item); }
      if (!item.sessao && c.sessao) { item.sessao = c.sessao; item.prova = c.ajudante ? 'comando de um ajudante da sessao' : 'comando na conversa da sessao'; }
      if (c.reservado) item.reservadoTipo = true;
      item.mandadoEm = c.at; item.pasta = c.pasta; if (c.pastaCompleta) item.pastaCompleta = c.pastaCompleta;
      item.eventos.push({ em: c.at, tipo: 'comando', de: 'sessao', acao: 'mandou' });
    } else if (c.tipo === 'vps-buscar') {
      const item = porNome.get(c.nome); if (!item) continue;
      if (!item.sessao && c.sessao) { item.sessao = c.sessao; item.prova = 'busca na conversa da sessao'; }
      if (c.reservado) item.reservadoTipo = true;
      if (c.resultado === 'pronto') item.eventos.push({ em: c.respostaEm || c.at, tipo: 'resposta', de: 'codex', acao: 'trouxe' });
      else if (c.resultado === 'rodando') item.ultimaPergunta = c.respostaEm || c.at;
    } else if (c.tipo === 'exec' || c.tipo === 'exec-resume') {
      // conversa local do Codex: pelo id do resume, pela pasta e hora, ou so pela hora quando a pasta veio de variavel
      let ro = null;
      if (c.resume) ro = local.rollouts.find(x => x.id === c.resume) || null;
      if (!ro) {
        const cands = local.rollouts.filter(x => !usados.has(x.id) && Number.isFinite(x.startedAt) && x.startedAt >= c.at - 30000 && x.startedAt <= c.at + 5 * 60000 && !/sub/.test(x.source));
        const porPasta = c.cwd && !/\$/.test(c.cwd) ? cands.filter(x => normPath(x.cwd) === normPath(c.cwd) || normPath(x.cwd).endsWith('/' + fold(base(c.cwd)))) : [];
        ro = porPasta[0] || (cands.length === 1 ? cands[0] : null);
      }
      const id = ro ? 'local:' + ro.id : 'local:' + c.toolId;
      let item = codex.find(x => x.id === id);
      if (!item) {
        let finalEm = null; try { finalEm = c.final && !/\$/.test(c.final) ? fs.statSync(c.final).mtimeMs : null; } catch { finalEm = null; }
        const fim = ro && ro.doneAt ? ro.doneAt : finalEm && finalEm >= c.at ? finalEm : null;
        const estadoL = fim ? 'terminou' : ro ? (now - ro.lastAt < 5 * 60000 ? 'rodando' : 'parou') : '?';
        item = { id, onde: 'local', rodada: null, estado: estadoL, desde: ro && Number.isFinite(ro.startedAt) ? ro.startedAt : c.at, fimEm: fim, ultimoSinal: ro ? ro.lastAt : c.at, saida: null, tituloCru: tituloDoPrompt(c.prompt && !/\$/.test(c.prompt) ? c.prompt : null), eventos: [], pasta: base(c.cwd || (ro && ro.cwd) || ''), pastaCompleta: c.cwd || (ro && ro.cwd) || null, motivo: ro ? null : 'conversa do Codex local nao achada pela pasta nem pela hora' };
        codex.push(item);
      }
      if (ro) usados.add(ro.id);
      if (!item.sessao && c.sessao) { item.sessao = c.sessao; item.prova = c.ajudante ? 'comando de um ajudante da sessao' : 'comando na conversa da sessao'; }
      if (c.reservado) item.reservadoTipo = true;
      item.mandadoEm = item.mandadoEm || c.at;
      item.eventos.push({ em: c.at, tipo: 'comando', de: 'sessao', acao: c.tipo === 'exec-resume' ? 'continuou' : 'mandou' });
    }
  }
  // 3) dono pelo estado/work quando a conversa nao provou
  for (const item of codex) if (!item.sessao && item.rodada) { const d = donoDe(item.rodada); if (d) { item.sessao = d.sessao; item.prova = d.prova; } }
  for (const item of codex) if (!item.sessao && item.tituloCru) { const m = /\b(ATENDIMENTO|LOJA|ASSISTENTE|CORTES|COORDENADOR|COORDENACAO)\b/.exec(item.tituloCru); if (m) { item.sessao = sessaoDoNome(m[1]); item.prova = 'o titulo do pedido cita a sessao'; } }
  // 4) titulo, resumo e eventos de fim
  for (const item of codex) {
    const porSessao = item.sessao === 'ASSISTENTE' || item.reservadoTipo === true, semProva = !item.sessao, porNome = privado(item.rodada) || privado(item.pasta);
    item.oculto = porSessao || semProva || porNome;
    const titulo = item.oculto ? null : limpo(legivel(item.tituloCru), 90);
    item.tituloPedido = titulo;
    item.motivoTitulo = titulo ? null : porSessao ? 'assunto reservado' : semProva ? 'dono nao provado: nome e pedido escondidos' : porNome ? 'nome com dado reservado' : item.tituloCru ? 'titulo com dado reservado' : 'pedido sem assunto na fonte';
    // VPS: o nome da rodada e o que a sessao deu a esse envio; local: a pasta pode ser reusada, entao o nome vem do pedido
    item.nome = item.oculto ? null : item.onde === 'vps' ? nomeLegivel(item.rodada || item.pasta) : titulo ? limpo(titulo, 50) : null;
    item.idPublico = item.oculto ? 'oculto:' + require('node:crypto').createHash('sha256').update(String(item.id)).digest('hex').slice(0, 12) : item.id;
    item.projeto = PD.projetoDe({ pastas: [item.pastaCompleta, item.pasta], titulo: item.tituloCru, titulos: [item.rodada], quemChamou: item.sessao });
    // modo dono: o nome e o pedido reais de uma rodada oculta vao em soDono (o filtro do send tira o campo de todo pedido que nao e do dono)
    if (item.oculto) { const nomeReal = item.onde === 'vps' ? nomeLegivel(item.rodada || item.pasta) : limpo(legivel(item.tituloCru), 50); const pedidoReal = limpo(legivel(item.tituloCru), 90);
      const t = SIGILO_PESSOAS.textoDono(nomeReal ? (item.onde === 'vps' ? 'Rodada ' : 'Codex local: ') + nomeReal : ''), r = SIGILO_PESSOAS.textoDono(pedidoReal || '');
      if (t || r) item.soDono = { titulo: t, resumo: r }; }
    if (item.fimEm) item.eventos.push({ em: item.fimEm, tipo: 'resposta', de: 'codex', acao: item.estado === 'erro' ? 'erro' : 'terminou' });
    if (item.ultimaPergunta && item.estado === 'rodando') item.eventos.push({ em: item.ultimaPergunta, tipo: 'duvida', de: 'sessao', acao: 'perguntou' });
  }
  // 5) por sessao; ordem estavel: vivos pelo inicio (o mais antigo vivo = 1), depois os outros do mais novo ao mais velho
  const vivo = x => x.estado === 'rodando';
  const sessoes = SESSOES.map(s => {
    const meus = codex.filter(x => x.sessao === s);
    const lista = [...meus.filter(vivo).sort((a, b) => a.desde - b.desde), ...meus.filter(x => !vivo(x)).sort((a, b) => (b.fimEm || b.ultimoSinal) - (a.fimEm || a.ultimoSinal))];
    lista.forEach((x, i) => { x.ordem = i + 1; });
    return { sessao: s, tipo: 'claude', rodando: lista.filter(vivo).length, total: lista.length, codex: lista.map(x => publico(x, now)) };
  });
  const semDono = codex.filter(x => !x.sessao).sort((a, b) => b.ultimoSinal - a.ultimoSinal).slice(0, 30).map(x => publico(x, now));
  // 6) fio: Claude <-> Codex de cada par + COORDENADOR <-> COORDENADOR do Codex + dono <-> COORDENADOR pelo painel
  const fio = [];
  for (const x of codex) {
    if (!x.sessao) continue;
    for (const e of x.eventos) {
      if (!(e.em >= since)) continue;
      const ponta = { sessao: x.sessao, tipo: 'codex', ordem: x.ordem, id: x.idPublico };
      const nome = x.nome || (x.oculto ? 'um Codex (assunto reservado)' : x.onde === 'vps' ? 'a rodada sem nome' : 'o Codex local');
      const titulo = e.acao === 'mandou' ? (x.nome ? 'Mandou ' + (x.onde === 'vps' ? 'a rodada ' : 'o Codex local ') + nome : 'Mandou ' + nome)
        : e.acao === 'continuou' ? 'Mandou continuar ' + nome
        : e.acao === 'perguntou' ? 'Conferiu se ' + nome + ' terminou: ainda rodando'
        : e.acao === 'trouxe' ? 'Trouxe o resultado de ' + nome
        : e.acao === 'erro' ? nome + ' parou com erro (saída ' + x.saida + ')'
        : nome + ' terminou' + (x.saida != null ? ' (saída ' + x.saida + ')' : '');
      fio.push({ em: e.em, de: e.de === 'sessao' ? { sessao: x.sessao, tipo: 'claude' } : ponta, para: e.de === 'sessao' ? ponta : { sessao: x.sessao, tipo: 'claude' }, tipo: e.tipo, titulo, resumo: x.tituloPedido, motivo: x.tituloPedido ? null : x.motivoTitulo, fonte: x.oculto ? null : { codex: x.id, rodada: x.rodada, pasta: x.pasta || null, prova: x.prova || null } });
    }
  }
  for (const e of [...coordenador.eventos, ...painel.eventos]) fio.push(e);
  fio.sort((a, b) => b.em - a.em);
  const out = { sessoes, semDono, fio: fio.slice(0, 200).map(e => ({ ...e, em: iso(e.em), dataTexto: dataTexto(e.em) })) };
  Object.defineProperty(out, 'pausadasInternas', { value: codex.filter(x => x.onde === 'vps' && x.estado === 'pausada').map(x => x.rodada), enumerable: false });
  return out;
}
function publico(x, now) {
  return {
    id: x.idPublico || x.id, ordem: x.ordem || null, sessao: x.sessao || null, tipo: 'codex', onde: x.onde, estado: x.estado,
    estadoTexto: { rodando: 'rodando', pausada: 'pausada (processo parado ou pausada pelo Coordenador)', terminou: 'terminou', erro: 'parou com erro', parou: 'parou sem terminar (sem processo e sem código de saída)', '?': 'sem leitura' }[x.estado] || 'sem leitura',
    desde: iso(x.desde), desdeTexto: dataTexto(x.desde), idadeMin: Number.isFinite(x.desde) ? Math.max(0, Math.round((now - x.desde) / 60000)) : null,
    fimIdadeMin: Number.isFinite(x.fimEm) ? Math.max(0, Math.round((now - x.fimEm) / 60000)) : null,
    fimEm: iso(x.fimEm), ultimoSinal: iso(x.ultimoSinal), saida: x.saida == null ? null : String(x.saida),
    titulo: x.nome ? (x.onde === 'vps' ? 'Rodada ' : 'Codex local: ') + x.nome : x.oculto ? null : (x.onde === 'vps' ? 'Rodada sem nome' : 'Codex local'),
    resumo: x.tituloPedido, motivo: x.tituloPedido ? (x.motivo || null) : x.motivoTitulo + (x.motivo ? '; ' + x.motivo : ''),
    prova: x.prova || null, oculto: !!x.oculto, fonte: x.oculto ? null : { rodada: x.rodada || null, pasta: x.pasta || null },
    projeto: x.projeto || null, ...(x.soDono ? { soDono: x.soDono } : {})
  };
}

let cache = null, building = null;
const SIGILO_PESSOAS = require('./sigilo-pessoas.cjs');
function leitura(ctx = {}) {
  return SIGILO_PESSOAS.rodarComo(false, () => leituraFechada(ctx));
}
async function leituraFechada(ctx = {}) {
  const now = ctx.now || Date.now();
  if (!ctx.fresh && cache && now - cache.at < CACHE_TTL) return cache.value;
  if (building) return building;
  building = (async () => {
    const estado = ctx.estado || ESTADO;
    const vps = await lerVps(now, ctx).catch(() => ({ ok: false, motivo: 'ssh com erro', rodadas: [] }));
    let claude, local, coordenador, painel;
    try { claude = scanClaude({ claudeDir: ctx.claudeDir || CLAUDE_DIR, appRoot: ctx.appRoot || APP_ROOT, now }); } catch { claude = { ok: false, motivo: 'erro ao ler as conversas do Claude', comandos: [] }; }
    try { local = scanCodexLocal({ codexDir: ctx.codexDir || CODEX_DIR, now }); } catch { local = { ok: false, motivo: 'erro ao ler as conversas do Codex', rollouts: [] }; }
    try { coordenador = fioCoordenador(estado, now - JANELA, now); } catch { coordenador = { ok: false, eventos: [] }; }
    try { painel = fioPainel(estado, now - JANELA, now); } catch { painel = { ok: false, eventos: [] }; }
    const m = montar({ claude, local, vps, estado, now, coordenador, painel });
    const fonte = (ok, motivo, extra = {}) => ({ ok: !!ok, motivo: ok ? null : motivo || 'sem leitura', ...extra });
    const value = {
      ok: true, versao: 'f2', lidoEm: iso(now), janelaHoras: JANELA / H,
      fontes: {
        claude: fonte(claude.ok, claude.motivo, { conversas: claude.conversas || 0, comandos: claude.comandos.length }),
        codexLocal: fonte(local.ok, local.motivo, { conversas: local.rollouts.length }),
        vps: fonte(vps.ok, vps.motivo, { lidoEm: iso(vps.lidoEm), rodadas: vps.rodadas.length, cacheSegundos: VPS_TTL / 1000 }),
        filaCodex: fonte(coordenador.ok, 'estado/fila-codex.md ou codex.md sem leitura'),
        painel: fonte(painel.ok, 'recados ou respostas do painel sem leitura')
      },
      ...m
    };
    cache = { at: now, value, pausadas: Array.isArray(m.pausadasInternas) ? m.pausadasInternas : [] };
    return value;
  })().finally(() => { building = null; });
  return building;
}
// Para a rota que nao pode esperar o ssh: devolve o ultimo pronto (ou espera ate `ms`) e renova por tras.
async function leituraRapida(ctx = {}, ms = 13000) {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL) return cache.value;
  const p = leitura(ctx);
  if (cache) { p.catch(() => null); return cache.value; }
  return Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
}
function vazio() { return { ok: true, versao: 'f2', exemplo: true, lidoEm: null, janelaHoras: JANELA / H, motivo: 'modo exemplo: sem dado real', fontes: {}, sessoes: SESSOES.map(s => ({ sessao: s, tipo: 'claude', rodando: 0, total: 0, codex: [] })), semDono: [], fio: [] }; }
function _reset() { cache = null; building = null; vpsState = { at: 0, value: null, pending: null }; tailCache.clear(); metaCache.clear(); openingCache.clear(); appCache.at = 0; }
function ultimaLeitura() { return cache ? cache.value : null; }
// nomes das rodadas pausadas (estado T ou PAUSADO.txt) na ultima leitura; null = sem leitura
function rodadasPausadas() {
  if (!cache) return null;
  return new Set((cache.pausadas || []).filter(Boolean).map(String));
}
module.exports = { ultimaLeitura, rodadasPausadas, vazio, privado, podeLerPedido, escolherLinha, leitura, leituraRapida, creditoVps, parseComando, nomeLegivel, nomeCurto, limpo, dataTexto, sessaoDoNome, montar, fioCoordenador, fioPainel, _reset, SESSOES };
