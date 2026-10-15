'use strict';

// Legacy commands use a local inbox. Session delivery uses only the official queue CLI.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { spawn } = require('node:child_process');
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const CLAUDE_SESSION = /^local_[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

const DESTINOS = Object.freeze(['codex', 'atendimento', 'assistente', 'cortes', 'loja', 'coordenacao']);
const MAX_TEXT = 1000;
const MAX_QUEUE_BYTES = 2 * 1024 * 1024;
const PRIVATE = /(?:\.env\b|\b(?:env|chave|chaves|key|keys|token|tokens|seed|seeds|semente|senha|password|credentials?|credential|segredos?|secret|secrets|auth\.json|backup-privado|private\s*key|api\s*key)\b|segredos|privado|\bbearer\s+|\b(?:sk-[a-z0-9_-]{10,}|gh[pousr]_[a-z0-9_]{10,})\b|\b[a-f0-9]{64}\b)/i;
const LOCKED = /(?:\b(?:subir|sobe|suba|publique|publicar|deploy\w*|hospedagem|push|pushing|merge|merging|dinheiro|money|buy|buying|comprar|compre|compra|compras|sell|selling|vender|venda|withdraw\w*|saque|sacar|saca|transfer\w*|transferir|transfira|pagar|pague|pagamento|payment|payments|assinatura|assinar|sign|signing|signed|transact\w*)\b)/i;
// Trava extra do seu projeto (nomes de arquivo ou palavras): config/comandos-travados.json, um array de textos; vazio por padrao.
const LOCKED_EXTRA = (() => { try { const v = JSON.parse(fs.readFileSync(process.env.PAINEL_COMANDOS_TRAVADOS || path.join(__dirname, 'config', 'comandos-travados.json'), 'utf8')); return Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).map(x => normal(x).trim()) : []; } catch { return []; } })();
const lockedExtra = text => LOCKED_EXTRA.some(x => text.includes(x));
const APPROVAL = /\b(?:pre\s?-?\s?aprov\w*|aprovo|aprova|aprovad[oa]s?|aprovar|aprovei|libera|liberar|liberado|liberada|liberados|liberadas|libere|liberem|liberou|carta\s+branca|pode\s+subir|go\s+ahead)\b/i;
const EXTERNAL_MESSAGE = /\b(?:mande|mandar|envie|enviar|send|post|poste|publicar|publish|message|dm)\b.{0,65}\b(?:discord|telegram|twitter|\bx\b|email|e-mail|slack|holder|holders|pessoa|fulano)\b/i;
const SENSITIVE_URL = /https?:\/\/(?:[^\s/]+@|\S*[?&](?:key|token|secret|password|api[_-]?key|auth|signature|sig)=)/i;

function normal(text) {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function redact(text) {
  if (typeof text !== 'string') return '[texto inválido]';
  if (PRIVATE.test(normal(text)) || SENSITIVE_URL.test(text)) return '[conteúdo sensível omitido]';
  return text.replace(/https?:\/\/\S+/gi, '[URL omitida]')
    .replace(/\b0x[a-f0-9]{40,}\b/gi, '[endereço omitido]')
    .replace(/\b[a-z0-9+/_=-]{40,}\b/gi, '[valor omitido]')
    .replace(/[\u0000-\u001f\u007f|\u2013\u2014]/g, ' ').trim().slice(0, MAX_TEXT);
}

function stampOf(now) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw Error('Invalid clock');
  const pieces = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const part = type => pieces.find(piece => piece.type === type).value;
  return { day: `${part('day')}/${part('month')}`, hour: `${part('hour')}:${part('minute')}`, iso: now.toISOString() };
}

function stateDir(root) {
  const base = fs.realpathSync(root);
  const directory = path.join(base, 'estado');
  if (!fs.existsSync(directory)) fs.mkdirSync(directory);
  const entry = fs.lstatSync(directory);
  if (entry.isSymbolicLink() || !entry.isDirectory() || fs.realpathSync(directory) !== directory) throw Error('Invalid state directory');
  return directory;
}

function targetFile(directory, name) {
  const file = path.join(directory, name);
  try {
    const entry = fs.lstatSync(file);
    if (entry.isSymbolicLink() || !entry.isFile()) throw Error('Invalid inbox file');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return file;
}

function validate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['destino', 'texto', 'confirmado', 'threadId'].includes(key))) return { code: 'invalid', status: 400 };
  if (input.threadId !== undefined && (typeof input.threadId !== 'string' || !(UUID.test(input.threadId) || input.destino !== 'codex' && CLAUDE_SESSION.test(input.threadId)))) return { code: 'session', status: 400 };
  if (typeof input.destino !== 'string' || !DESTINOS.includes(input.destino.trim().toLowerCase())) return { code: 'destination', status: 400 };
  if (typeof input.texto !== 'string' || !input.texto.trim() || input.texto.length > MAX_TEXT || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/.test(input.texto)) return { code: 'text', status: 400 };
  if (PRIVATE.test(normal(input.texto)) || SENSITIVE_URL.test(input.texto) || LOCKED.test(normal(input.texto)) || lockedExtra(normal(input.texto)) || APPROVAL.test(normal(input.texto))) return { code: 'locked', status: 403 };
  if (EXTERNAL_MESSAGE.test(normal(input.texto))) return { code: 'external', status: 403 };
  if (input.confirmado !== true) return { code: 'confirmation', status: 400 };
  return null;
}

const MESSAGES = Object.freeze({ invalid: 'Comando inválido.', destination: 'Escolha um destino.', text: 'Escreva de 1 a 1000 caracteres.', confirmation: 'Confirme antes de enviar.', locked: 'Isso fica travado no painel: decida fora dele.', external: 'Mensagem a outras pessoas é no chat.', write: 'Não foi possível salvar. Tente novamente.' });

function appendAudit(directory, entry) {
  fs.appendFileSync(targetFile(directory, 'painel-comandos.log'), JSON.stringify(entry) + '\n', 'utf8');
}

// Server calls after checking loopback, Host, Origin, nonce and bounded JSON.
// It can also record rejected transport attempts without storing request headers.
function recordRejected(root, error, now = new Date()) {
  try {
    const time = stampOf(now);
    const code = ['origin', 'nonce', 'json', 'size'].includes(error) ? error : 'invalid';
    appendAudit(stateDir(root), { hora: time.iso, destino: '?', resultado: 'recusado', motivo: code, texto: '[pedido recusado na entrada]' });
    return true;
  } catch { return false; }
}

function sendCommand(root, input, now = new Date(), options = {}) {
  if (input?.threadId !== undefined) return sendSession(root, input, now, options);
  let directory;
  let time;
  try { directory = stateDir(root); time = stampOf(now); } catch { return { ok: false, error: 'write', message: MESSAGES.write, statusCode: 503 }; }
  const invalid = validate(input);
  const destination = typeof input?.destino === 'string' && DESTINOS.includes(input.destino.trim().toLowerCase()) ? input.destino.trim().toLowerCase() : '?';
  const audit = { hora: time.iso, destino: destination, texto: typeof input?.texto === 'string' && (PRIVATE.test(normal(input.texto)) || SENSITIVE_URL.test(input.texto)) ? '[conteúdo sensível omitido]' : '[mensagem privada omitida]' };
  if (invalid) {
    try { appendAudit(directory, { ...audit, resultado: 'recusado', motivo: invalid.code }); } catch { return { ok: false, error: 'write', message: MESSAGES.write, statusCode: 503 }; }
    return { ok: false, error: invalid.code, message: MESSAGES[invalid.code], statusCode: invalid.status };
  }

  const id = 'painel-' + crypto.randomUUID();
  // One physical line prevents Markdown headings, forged queue states and log lines.
  const text = input.texto.replace(/[\r\n\t|\u2013\u2014]/g, ' ').replace(/\s+/g, ' ').trim();
  try {
    // Log the accepted attempt before its write; a crash never leaves an unlogged command.
    appendAudit(directory, { ...audit, id, resultado: 'recebido' });
    if (destination === 'codex') {
      const file = targetFile(directory, 'fila-codex.md');
      if (fs.existsSync(file) && fs.statSync(file).size > MAX_QUEUE_BYTES) throw Error('Queue too large');
      const previous = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '# FILA DO CODEX\n';
      const indexes = [...previous.matchAll(/^(\d+)\.\s/gm)].map(match => Number(match[1])).filter(Number.isSafeInteger);
      const index = (indexes.length ? Math.max(...indexes) : 0) + 1;
      if (!Number.isSafeInteger(index)) throw Error('Invalid queue');
      const entry = `${index}. PRIORIDADE (sua ordem ${time.hour} pelo painel) ${text}\n   comando: ${id} | ${time.day} ${time.hour} | executor: codex\n\n`;
      const temp = path.join(directory, '.' + id + '.tmp');
      try {
        fs.writeFileSync(temp, entry + previous, { encoding: 'utf8', flag: 'wx' });
        targetFile(directory, 'fila-codex.md');
        fs.renameSync(temp, file);
      } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
    } else {
      const file = targetFile(directory, 'recados-do-painel.md');
      fs.appendFileSync(file, `- ${time.day} ${time.hour} | ${destination.toUpperCase()} | ${text} | ${id}\n`, 'utf8');
    }
    // The received record already proves this attempt. A full disk after delivery
    // must not report failure and tempt the owner to submit the same command again.
    try { appendAudit(directory, { ...audit, id, resultado: 'na-fila' }); } catch { /* Already audited before delivery. */ }
    return { ok: true, id, destino: destination, queuedAt: time.iso, mensagem: destination === 'codex' ? 'Na fila. O plantão pega na próxima leitura.' : 'A COORDENACAO repassa na próxima guarda.' };
  } catch {
    try { appendAudit(directory, { ...audit, id, resultado: 'falha', motivo: 'write' }); } catch { /* Keep filesystem details private. */ }
    return { ok: false, error: 'write', message: MESSAGES.write, statusCode: 503 };
  }
}

// Only TeamReader's public metadata may become a send target. A visible child is
// never enough to authorize its parent: that parent must also be in the snapshot.
function sessionsOf(team, root) {
  const entries = [...(Array.isArray(team?.agents) ? team.agents : []),...(Array.isArray(team?.commandConversations)?team.commandConversations:[])];
  const sessions = [];
  const seen = new Set();
  let titles;
  if(root)try{titles=JSON.parse(require('./leitor.cjs').readSafe(root,'estado/titulos.json',32000))?.por_conversa;}catch{}
  for (const agent of entries) {
    if (!['codex', 'claude'].includes(agent.family) || agent.parentId || agent.id !== agent.conversationId) continue;
    const threadId = String(agent.id).slice(agent.family.length + 1);
    if (!UUID.test(threadId) || seen.has(agent.id)) continue;
    seen.add(agent.id);
    const configuredTitle=titles?.[threadId]?.titulo;
    const safeTitle=typeof configuredTitle==='string'&&configuredTitle.length<=120&&!PRIVATE.test(normal(configuredTitle))&&!/0x[a-f\d]{40}|[\u0000-\u001f\u007f]/i.test(configuredTitle)?configuredTitle:null;
    if(root&&agent.family==='codex'&&!agent.conversationName&&!safeTitle&&/^SESS(?:[AÃ]O|ION|I[ÓO]N)\b/i.test(agent.conversation||''))continue;
    const name = String(agent.conversationName || safeTitle || agent.conversation || agent.name || agent.family).slice(0, 120);
    const maestro = agent.identity?.paper === 'maestro' || /\b(?:COORDENADOR|COORDENACAO|maestro|coordenar)\b/i.test(name + ' ' + (agent.name || '') + ' ' + (agent.project || ''));
    const recent = Number.isFinite(Date.parse(agent.lastAt)) ? agent.lastAt : null;
    sessions.push({ family: agent.family, threadId, name, maestro, lastAt: recent, method: agent.family === 'codex' ? 'codex-queue' : 'local-relay' });
  }
  if(root){
    // The app registry is authoritative even when its sessions have no rollout.
    // A bad or missing registry exposes no Claude target, never a guessed session.
    for(let index=sessions.length-1;index>=0;index--)if(sessions[index].family==='claude')sessions.splice(index,1);
    let configured;try{configured=JSON.parse(require('./leitor.cjs').readSafe(root,'estado/sessoes-claude.json',32000));}catch{}
    const known=new Set(['COORDENADOR','ATENDIMENTO','ASSISTENTE','CORTES','LOJA']),ids=new Set();
    for(const item of (Array.isArray(configured?.sessoes)?configured.sessoes:[]).slice(0,20)){
      if(!item||!known.has(item.titulo)||!CLAUDE_SESSION.test(item.sessionId)||ids.has(item.sessionId))continue;
      ids.add(item.sessionId);sessions.push({family:'claude',threadId:item.sessionId,sessionId:item.sessionId,name:item.titulo,maestro:item.maestro===true||item.titulo==='COORDENADOR',lastAt:Number.isFinite(Date.parse(item.ultima))?item.ultima:null,method:'local-relay'});
    }
  }
  return sessions.sort((a, b) => a.family.localeCompare(b.family) || Number(b.maestro) - Number(a.maestro) || String(b.lastAt || '').localeCompare(String(a.lastAt || '')) || a.name.localeCompare(b.name));
}

function listCommandSessions(root, now = new Date(), options = {}) {
  const sessionsRoot = options.sessionsRoot || path.join((process.env.PAINEL_HOME || os.homedir()), '.codex', 'sessions');
  const team = options.teamReader ? options.teamReader.snapshot(now) : require('./equipe.cjs').snapshotTeam(root, sessionsRoot, now, options.teamOptions || {});
  return sessionsOf(team,root);
}

// Find the current packaged executable without a version pin or a PATH lookup.
function discoverCodexExecutable(bin = path.join((process.env.PAINEL_HOME || os.homedir()), 'AppData', 'Local', 'OpenAI', 'Codex', 'bin')) {
  const base = fs.realpathSync(bin);
  if (fs.lstatSync(bin).isSymbolicLink()) throw Error('Invalid CLI directory');
  const candidates = [];
  for (const item of fs.readdirSync(base, { withFileTypes: true })) {
    if (!item.isDirectory() || item.isSymbolicLink() || !/^[a-f\d]{8,64}$/i.test(item.name)) continue;
    const folder = path.join(base, item.name), executable = path.join(folder, 'codex.exe');
    try {
      if (fs.lstatSync(folder).isSymbolicLink() || fs.lstatSync(executable).isSymbolicLink() || !fs.statSync(executable).isFile()) continue;
      const real = fs.realpathSync(executable);
      if (real !== executable || path.dirname(path.dirname(real)) !== base) continue;
      candidates.push({ path: real, modified: fs.statSync(real).mtimeMs });
    } catch { /* An incomplete update directory is not an executable. */ }
  }
  candidates.sort((a, b) => b.modified - a.modified || a.path.localeCompare(b.path));
  if (!candidates.length) throw Error('CLI unavailable');
  return candidates[0].path;
}

function queueWithCli(executable, threadId, text, spawnCli = spawn) {
  return new Promise(resolve => {
    let settled = false, child;
    const done = outcome => { if (!settled) { settled = true; clearTimeout(timer); resolve(outcome); } };
    let timer;
    try {
      child = spawnCli(executable, ['queue', '--thread', threadId, '--message', text], { shell: false, windowsHide: true, stdio: 'ignore' });
      child.once('error', () => done('failed'));
      child.once('exit', code => done(code === 0 ? 'queued' : 'failed'));
      // Terminate only this child. A timeout does not prove non-delivery, so the
      // user is told to check the app before trying again.
      timer = setTimeout(() => { if (!settled) { child.kill(); done('unknown'); } }, 15000);
      timer.unref?.();
    } catch { done('failed'); }
  });
}

async function sendSession(root, input, now, options) {
  let directory, time;
  try { directory = stateDir(root); time = stampOf(now); } catch { return { ok: false, error: 'write', message: MESSAGES.write, statusCode: 503 }; }
  const invalid = validate(input);
  const destination = typeof input.destino === 'string' ? input.destino.trim().toLowerCase() : '?';
  const audit = { hora: time.iso, destino: destination, texto: '[mensagem privada omitida]' };
  const fail = (error, statusCode = 400) => {
    try { appendAudit(directory, { ...audit, resultado: 'recusado', motivo: error }); } catch { return { ok: false, error: 'write', message: MESSAGES.write, statusCode: 503 }; }
    return { ok: false, error, message: MESSAGES[error] || 'Sessão indisponível. Atualize a lista.', statusCode };
  };
  if (invalid) return fail(invalid.code, invalid.status);
  let session;
  try { session = listCommandSessions(root, now, options).find(item => item.threadId === input.threadId && item.family === (destination === 'codex' ? 'codex' : 'claude')); } catch { return fail('session', 503); }
  if (!session) return fail('session', 403);
  const id = 'painel-' + crypto.randomUUID();
  const method = session.method;
  try {
    appendAudit(directory, { ...audit, id, method, resultado: 'recebido' });
    if (method === 'local-relay') {
      const text = input.texto.replace(/[\r\n\t|\u2013\u2014]/g, ' ').replace(/\s+/g, ' ').trim();
      fs.appendFileSync(targetFile(directory, 'recados-do-painel.md'), `- ${time.day} ${time.hour} | CLAUDE | sessão ${session.threadId} | ${text} | ${id}\n`, 'utf8');
    } else {
      const executable = discoverCodexExecutable(options.binRoot);
      const outcome = await queueWithCli(executable, session.threadId, input.texto, options.spawnCli);
      if (outcome !== 'queued') {
        try { appendAudit(directory, { ...audit, id, method, resultado: outcome === 'unknown' ? 'incerto' : 'falha', motivo: 'cli' }); } catch {}
        return { ok: false, id, error: outcome === 'unknown' ? 'delivery_unknown' : 'cli', statusCode: 503, method, deliveryStatus: outcome, message: outcome === 'unknown' ? 'Confira a conversa no app antes de repetir.' : 'O app não confirmou a entrega. Tente novamente.' };
      }
    }
    try { appendAudit(directory, { ...audit, id, method, resultado: 'na-fila' }); } catch {}
    // Route verified from public constants in the installed official CLI, without a version pin:
    // evidencias/rodada4-27b-deeplink-fonte.json. Expose it only after queue exits 0.
    // A Claude local relay cannot prove a corresponding app route.
    const appLink = method === 'codex-queue' ? 'codex://threads/' + session.threadId : null;
    return { ok: true, id, destino: destination, threadId: session.threadId, queuedAt: time.iso, method, deliveryStatus: 'queued', appLink, mensagem: method === 'codex-queue' ? 'Na conversa do Codex. Aguardando leitura.' : 'A COORDENACAO repassa na próxima guarda.' };
  } catch { return fail(method === 'codex-queue' ? 'cli' : 'write', 503); }
}

module.exports = { APPROVAL, sendCommand, recordRejected, validate, redact, DESTINOS, MAX_TEXT, sessionsOf, listCommandSessions, discoverCodexExecutable, queueWithCli };
