'use strict';
// Serve o .cache/radar.json que o radar-gerar.cjs grava no agendamento; se o arquivo falta ou passou de 20 min,
// monta na hora so lendo os mesmos arquivos (sem medir, sem gravar) e diz isso na tela.
const fs = require('node:fs'), path = require('node:path');
const assets = ['radar.js', 'radar.css'];
const EM_DIA_MS = 20 * 60e3;
function create({ root, dir = __dirname, now = Date.now } = {}) {
  // O placar curado (radar-fontes.json) mora na pasta do painel; sem ele ali, vale o da pasta de estado (a demo grava o seu la).
  const fontesDir = () => fs.existsSync(path.join(dir, 'radar-fontes.json')) || !root || !fs.existsSync(path.join(root, 'radar-fontes.json')) ? dir : root;
  const arquivo = () => path.join(fontesDir(), '.cache', 'radar.json');
  function ler() {
    let gravado = null, estado = 'ausente';
    try { const st = fs.lstatSync(arquivo()); if (st.isFile() && !st.isSymbolicLink() && st.size < 2e6) { gravado = JSON.parse(fs.readFileSync(arquivo(), 'utf8')); estado = now() - st.mtimeMs <= EM_DIA_MS ? 'em dia' : 'velho'; } } catch { gravado = null; }
    if (gravado && estado === 'em dia' && gravado.versao === 1) return { ...gravado, arquivo: { estado, geradoEm: gravado.geradoEm } };
    const fresco = require('./radar-gerar.cjs').montar({ root, dir: fontesDir(), now: now() });
    return { ...fresco, arquivo: { estado, geradoEm: gravado?.geradoEm || null } };
  }
  return { handle(req, url, { send, example = false }) {
    if (req.method === 'GET' && assets.includes(url.pathname.slice(1))) { send(200, fs.readFileSync(path.join(dir, url.pathname.slice(1))), url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript'); return true; }
    if (url.pathname !== '/api/radar') return false;
    if (req.method !== 'GET') { send(405, { ok: false, error: 'method_not_allowed' }); return true; }
    if (example) { send(200, { ok: false, example: true, sourceState: 'example' }); return true; }
    try { send(200, { ok: true, data: ler() }); } catch { send(503, { ok: false, sourceState: 'unavailable' }); }
    return true;
  } };
}
module.exports = { create, assets };
