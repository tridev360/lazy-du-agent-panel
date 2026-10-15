'use strict';
// PAINEL_SO_LEITURA=1 desliga as gravações do estado. O cache de leitura continua numa pasta temporária (TMP), nunca na do painel.
const ativo = process.env.PAINEL_SO_LEITURA === '1';
function pastaLocal() {
  const os = require('node:os'), path = require('node:path');
  const vivo = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'painel-local');
  if (!ativo) return vivo;
  const nome = String(__dirname).replace(/[\\/:]+/g, '_').replace(/[^\w.-]/g, '').slice(-80) || 'copia';
  return path.join(os.tmpdir(), 'painel-local-copia', nome);
}
function cacheLocal(arquivo) {
  const os = require('node:os'), path = require('node:path'), fs = require('node:fs');
  const alvo = path.join(pastaLocal(), arquivo);
  if (ativo) {
    try {
      if (!fs.existsSync(alvo)) {
        fs.mkdirSync(path.dirname(alvo), { recursive: true });
        const doVivo = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'painel-local', arquivo);
        if (fs.existsSync(doVivo)) fs.copyFileSync(doVivo, alvo);
      }
    } catch { /* sem semente: a copia le do zero */ }
  }
  return alvo;
}
module.exports = { ativo, pastaLocal, cacheLocal };
