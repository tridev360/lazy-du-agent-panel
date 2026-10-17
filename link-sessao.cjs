'use strict';
// Atalho para abrir a sessao que espera voce. So formatos conhecidos e validados:
// - sessao do Claude Code aberta no app Claude: claude://claude.ai/epitaxy/local_<uuid> (o id local_ vem do proprio app, sessoes-app.cjs);
// - conversa do Codex: codex://threads/<uuid>;
// - sessao do Claude Code so no terminal: sem link; o painel oferece copiar "claude --resume <uuid>".
// Nada aqui abre, grava ou chama a rede: so monta o texto. Id que nao casa com o formato = null.
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const LOCAL = /^local_[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const LINK = /^(?:claude:\/\/claude\.ai\/epitaxy\/local_[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}|codex:\/\/threads\/[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})$/i;
const COMANDO = /^claude --resume [a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

function bare(id) { const v = String(id || '').replace(/^(?:claude|codex):/i, '').toLowerCase(); return UUID.test(v) ? v : null; }

// session: { family: 'claude' | 'codex', id } (id com ou sem o prefixo da familia). app: resultado de sessoes-app.readSessions() (opcional).
function atalho(session, app) {
  const family = session && session.family, id = bare(session && session.id);
  if (!id) return { link: null, comando: null };
  if (family === 'codex') return { link: 'codex://threads/' + id, comando: null };
  if (family !== 'claude') return { link: null, comando: null };
  let local = null;
  try { const a = require('./sessoes-app.cjs').lookupConversation(app || require('./sessoes-app.cjs').readSessions(), id); local = a && LOCAL.test(a.sessionId) ? a.sessionId.toLowerCase() : null; } catch { local = null; }
  return { link: local ? 'claude://claude.ai/epitaxy/' + local : null, comando: 'claude --resume ' + id };
}
const linkValido = v => typeof v === 'string' && LINK.test(v);
const comandoValido = v => typeof v === 'string' && COMANDO.test(v);

module.exports = { atalho, linkValido, comandoValido, LINK, COMANDO };
