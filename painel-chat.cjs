'use strict';
//   GET  /api/painel-chat               -> { ok, prints: { max, maxBytes } } (a caixa liga o botao Imagem so com esta rota)
//   POST /api/painel-chat/print/<alvo>  -> corpo = 1 PNG completo (ate 8 MB); grava
//        estado/prints-painel/AAAAMMDD-HHMMSS-<alvo>-<n>.png (hora de Sao Paulo) e devolve o caminho.
// So no PC: nenhuma rota le a imagem de volta, a pasta ganha um .gitignore com "*" e o modo exemplo nao grava.
const fs = require('node:fs');
const path = require('node:path');

const ALVOS = Object.freeze(['coordenador-claude', 'coordenador-codex', 'os-dois', 'atendimento', 'loja', 'assistente', 'cortes']);
const MAX_PRINTS = 3;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_DIR_BYTES = 1024 * 1024 * 1024;
const PNG_START = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_END = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
const ROUTE = /^\/api\/painel-chat\/print\/([a-z-]{3,14})$/;

function stampOf(now) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw Error('Invalid clock');
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const part = type => parts.find(item => item.type === type).value;
  return part('year') + part('month') + part('day') + '-' + part('hour') + part('minute') + part('second');
}

// PNG inteiro: assinatura, IHDR com largura e altura validas e IEND no fim. Outro formato nao entra.
function isPng(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 57 || bytes.length > MAX_BYTES) return false;
  if (!bytes.subarray(0, 8).equals(PNG_START) || bytes.readUInt32BE(8) !== 13 || bytes.toString('latin1', 12, 16) !== 'IHDR') return false;
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (width < 1 || height < 1 || width > 20000 || height > 20000) return false;
  return bytes.subarray(bytes.length - 12).equals(PNG_END);
}

function printsDir(root) {
  const base = fs.realpathSync(root), estado = path.join(base, 'estado');
  const state = fs.lstatSync(estado);
  if (state.isSymbolicLink() || !state.isDirectory()) throw Error('Invalid state directory');
  const dir = path.join(estado, 'prints-painel');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const entry = fs.lstatSync(dir);
  if (entry.isSymbolicLink() || !entry.isDirectory() || fs.realpathSync(dir) !== dir) throw Error('Invalid prints directory');
  // Nunca vai para commit nem pacote: a pasta se protege sozinha.
  try { fs.writeFileSync(path.join(dir, '.gitignore'), '*\n', { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  return dir;
}

function dirBytes(dir) {
  let total = 0;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) if (item.isFile()) total += fs.statSync(path.join(dir, item.name)).size;
  return total;
}

function audit(root, entry) {
  try { fs.appendFileSync(path.join(fs.realpathSync(root), 'estado', 'painel-comandos.log'), JSON.stringify(entry) + '\n', 'utf8'); } catch { /* o print ja esta salvo ou ja foi recusado */ }
}

// Grava 1 print. n = o proximo numero livre para a mesma hora e o mesmo alvo (nunca sobrescreve).
function savePrint(root, alvo, bytes, now = new Date()) {
  if (!ALVOS.includes(alvo)) return { ok: false, error: 'alvo', statusCode: 400 };
  if (!Buffer.isBuffer(bytes) || bytes.length > MAX_BYTES) return { ok: false, error: 'grande', statusCode: 413 };
  if (!isPng(bytes)) return { ok: false, error: 'formato', statusCode: 415 };
  let dir, stamp;
  try { dir = printsDir(root); stamp = stampOf(now); } catch { return { ok: false, error: 'gravar', statusCode: 503 }; }
  try { if (dirBytes(dir) + bytes.length > MAX_DIR_BYTES) return { ok: false, error: 'cheio', statusCode: 507 }; } catch { return { ok: false, error: 'gravar', statusCode: 503 }; }
  for (let n = 1; n <= 99; n++) {
    const nome = stamp + '-' + alvo + '-' + n + '.png', file = path.join(dir, nome);
    try { fs.writeFileSync(file, bytes, { flag: 'wx' }); }
    catch (error) { if (error.code === 'EEXIST') continue; return { ok: false, error: 'gravar', statusCode: 503 }; }
    audit(root, { hora: now.toISOString(), destino: alvo, resultado: 'print-salvo', bytes: bytes.length, texto: '[imagem privada omitida]' });
    return { ok: true, nome, caminho: file.split(path.sep).join('/') };
  }
  return { ok: false, error: 'gravar', statusCode: 503 };
}

const MESSAGES = Object.freeze({
  alvo: 'Escolha para quem vai.', grande: 'Imagem acima de 8 MB.', formato: 'Só imagem PNG inteira.', cheio: 'A pasta de prints passou de 1 GB. Limpe estado/prints-painel.',
  gravar: 'Não foi possível salvar a imagem. Tente de novo.', pedido: 'Pedido local inválido. Recarregue a página.', exemplo: 'Envio desligado no modo exemplo.'
});

// ctx: { root, send(status, data), port, nonce, example }. Devolve true quando a rota e deste modulo.
function handle(req, url, ctx) {
  const pathname = url.pathname, send = ctx.send;
  if (pathname === '/api/painel-chat') {
    if (req.method !== 'GET') { send(405, { error: 'Method not allowed' }); return true; }
    send(200, { ok: true, prints: ctx.example === true ? null : { max: MAX_PRINTS, maxBytes: MAX_BYTES } });
    return true;
  }
  const match = ROUTE.exec(pathname);
  if (!match && !pathname.startsWith('/api/painel-chat/')) return false;
  if (!match) { send(404, { error: 'Not found' }); return true; }
  if (req.method !== 'POST') { send(405, { error: 'Method not allowed' }); return true; }
  const fail = code => { const result = { ok: false, error: code, message: MESSAGES[code] }; return result; };
  if (ctx.example === true) { send(409, fail('exemplo')); return true; }
  const origins = ['http://127.0.0.1:' + ctx.port, 'http://localhost:' + ctx.port];
  if (!origins.includes(req.headers.origin) || req.headers['content-type'] !== 'image/png' || !ctx.nonce || req.headers['x-painel-nonce'] !== ctx.nonce) { send(403, fail('pedido')); return true; }
  if (!ALVOS.includes(match[1])) { send(400, fail('alvo')); return true; }
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_BYTES) { send(413, fail('grande')); req.resume(); return true; }
  const chunks = []; let size = 0, done = false;
  const finish = (status, data) => { if (!done) { done = true; send(status, data); } };
  req.on('data', chunk => { size += chunk.length; if (size <= MAX_BYTES) chunks.push(chunk); else if (size > MAX_BYTES * 2) req.destroy(); });
  req.on('error', () => finish(400, fail('pedido')));
  req.on('end', () => {
    if (size > MAX_BYTES) return finish(413, fail('grande'));
    let result;
    try { result = savePrint(ctx.root, match[1], Buffer.concat(chunks), new Date()); } catch { result = { ok: false, error: 'gravar', statusCode: 503 }; }
    finish(result.ok ? 200 : result.statusCode, result.ok ? result : fail(result.error));
  });
  return true;
}

module.exports = { handle, savePrint, isPng, stampOf, ALVOS, MAX_PRINTS, MAX_BYTES };
