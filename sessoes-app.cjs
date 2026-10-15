'use strict';
// o id da conversa (o nome do .jsonl). O app guarda o par em %APPDATA%\Claude\claude-code-sessions\<conta>\<org>\local_<uuid>.json.
// Daqui sai SO: sessionId, cliSessionId, title, isArchived, lastActivityAt. Nenhum outro campo do arquivo e guardado nem sai.
// Relido a cada leitura do estado (sem reiniciar): lista as pastas de todas as contas e so reabre o arquivo que mudou.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const UUID = '[a-f\\d]{8}-[a-f\\d]{4}-[a-f\\d]{4}-[a-f\\d]{4}-[a-f\\d]{12}';
const FILE = new RegExp('^local_' + UUID + '\\.json$', 'i');
const LOCAL = new RegExp('^local_' + UUID + '$', 'i');
const CLI = new RegExp('^' + UUID + '$', 'i');
const MAX_BYTES = 1024 * 1024;
// Titulo com cara de segredo, carteira ou caminho nunca vira nome na tela (fica o nome de antes).
const SENSITIVE = /SIGILOS|_SECRETS|backup-privado|\b(?:seed|api.?key|senha|secret|private|wallet|carteira|token)\b|0x[a-f\d]{6,}/i;

function defaultRoot() { return path.join(process.env.APPDATA || path.join((process.env.PAINEL_HOME || os.homedir()), 'AppData', 'Roaming'), 'Claude', 'claude-code-sessions'); }
function cleanTitle(value) {
  if (typeof value !== 'string') return null;
  const text = value.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/(?:https?:\/\/|[a-z]:[\\/])\S+/gi, '').replace(/\b[^\s@]+@[^\s@]+\b/g, '').replace(/\b[a-f\d]{7,64}\b/gi, '')
    .replace(/[–—]/g, ' ').replace(/[`*_<>]/g, '').replace(/\s+/g, ' ').trim();
  if (!text || SENSITIVE.test(text)) return null;
  return text.length > 60 ? text.slice(0, 59).trimEnd() + '…' : text;
}
function validAt(value) { const time = typeof value === 'number' ? value : Date.parse(value); return Number.isFinite(time) && time > 0 ? new Date(time).toISOString() : null; }
// So os 5 campos; o resto do objeto e descartado aqui mesmo.
function pick(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const sessionId = typeof raw.sessionId === 'string' && LOCAL.test(raw.sessionId) ? raw.sessionId.toLowerCase() : null;
  if (!sessionId) return null;
  const cliSessionId = typeof raw.cliSessionId === 'string' && CLI.test(raw.cliSessionId) ? raw.cliSessionId.toLowerCase() : null;
  return { sessionId, cliSessionId, title: cleanTitle(raw.title), isArchived: raw.isArchived === true, lastActivityAt: validAt(raw.lastActivityAt) };
}
function newer(a, b) { return String(a?.lastActivityAt || '') >= String(b?.lastActivityAt || ''); }
function dirs(dir) { try { return fs.readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isDirectory() && !entry.isSymbolicLink()); } catch { return []; } }

function createResolver(root = defaultRoot()) {
  const cache = new Map();
  function read() {
    const bySession = new Map(), byCli = new Map(), seen = new Set();
    let available = false;
    for (const account of dirs(root)) {
      for (const org of dirs(path.join(root, account.name))) {
        const dir = path.join(root, account.name, org.name);
        let files; try { files = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
        available = true;
        for (const entry of files) {
          if (!entry.isFile() || entry.isSymbolicLink() || !FILE.test(entry.name)) continue;
          const file = path.join(dir, entry.name); seen.add(file);
          let stat; try { stat = fs.statSync(file); } catch { continue; }
          if (stat.size > MAX_BYTES) continue;
          const stamp = stat.mtimeMs + ':' + stat.size;
          let hit = cache.get(file);
          if (!hit || hit.stamp !== stamp) {
            let value = null;
            try { value = pick(JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''))); } catch { value = null; }
            // o nome do arquivo e o id da sessao: arquivo que diz outro id nao vale
            if (value && value.sessionId !== entry.name.slice(0, -5).toLowerCase()) value = null;
            hit = { stamp, value }; cache.set(file, hit);
          }
          const value = hit.value; if (!value) continue;
          if (!bySession.has(value.sessionId) || newer(value, bySession.get(value.sessionId))) bySession.set(value.sessionId, value);
        }
      }
    }
    for (const file of [...cache.keys()]) if (!seen.has(file)) cache.delete(file);
    // a mesma conversa em 2 sessoes (raro): vale a que nao esta arquivada e, depois, a mais recente
    for (const value of bySession.values()) {
      if (!value.cliSessionId) continue;
      const old = byCli.get(value.cliSessionId);
      if (!old || (old.isArchived && !value.isArchived) || (old.isArchived === value.isArchived && newer(value, old))) byCli.set(value.cliSessionId, value);
    }
    return { bySession, byCli, available };
  }
  return { read, root };
}

let shared = null;
function readSessions(root) {
  if (root) return createResolver(root).read();
  if (!shared || shared.root !== (process.env.PAINEL_APP_SESSIONS || defaultRoot())) shared = createResolver(process.env.PAINEL_APP_SESSIONS || defaultRoot());
  try { return shared.read(); } catch { return { bySession: new Map(), byCli: new Map(), available: false }; }
}
function lookupSession(app, sessionId) { return app?.bySession?.get(String(sessionId || '').toLowerCase()) || null; }
function lookupConversation(app, conversationId) { return app?.byCli?.get(String(conversationId || '').replace(/^claude:/, '').toLowerCase()) || null; }

module.exports = { createResolver, readSessions, lookupSession, lookupConversation, cleanTitle, pick, defaultRoot };
