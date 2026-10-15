'use strict';
// Projeto cujo nome cita pessoa da lista de ocultar vira "Projeto parceiro" fora do modo dono (no modo dono, temPessoa e falso e o
// nome real sai). Tambem serve /projeto-de.cjs (o mesmo arquivo do servidor, como JavaScript), /projeto-global.js e /projeto-global.css.
const fs = require('node:fs'), path = require('node:path');
const PD = require('./projeto-de.cjs'), SIGILO = require('./sigilo-pessoas.cjs');
const ASSETS = { '/projeto-de.cjs': ['projeto-de.cjs', 'text/javascript'], '/projeto-global.js': ['projeto-global.js', 'text/javascript'], '/projeto-global.css': ['projeto-global.css', 'text/css'] };
function lista() { return PD.PROJETOS.map(p => ({ id: p.id, nome: SIGILO.temPessoa(p.nome) ? 'Projeto parceiro' : p.nome, dono: p.dono })); }
function handle(req, url, { send, dir = __dirname }) {
  const asset = ASSETS[url.pathname];
  if (!asset && url.pathname !== '/api/projetos-painel') return false;
  if (req.method !== 'GET') { send(405, { ok: false, error: 'Somente leitura' }); return true; }
  if (asset) { let bytes; try { bytes = fs.readFileSync(path.join(dir, asset[0])); if (url.pathname === '/projeto-de.cjs') bytes = Buffer.from('window.PainelProjetosDescobertos=' + JSON.stringify({ projetos: PD.PROJETOS, sessoes: Object.entries(PD.SESSAO).map(([name, projectId]) => ({ name, projectId })), demo: process.env.PAINEL_DEMO === '1' }) + ';\n' + bytes); } catch { send(404, { ok: false, error: 'Arquivo ausente' }); return true; } send(200, bytes, asset[1]); return true; }
  send(200, { ok: true, projetos: lista() });
  return true;
}
module.exports = { handle, lista, ASSETS };
