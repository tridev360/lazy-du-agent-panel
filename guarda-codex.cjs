'use strict';
// Linha da guarda: "[GUARDA-...-ROOT-AAAAMMDD] HH:MM ..." (a data vem da etiqueta; sem data, hoje ou ontem pela hora).
// Relido so quando o arquivo muda (tamanho e hora). Sai: { rondas: [ISO, ...] (as 12 mais novas primeiro), lidoEm }.
const fs = require('node:fs');
const path = require('node:path');

const BRT = 3 * 3600000;
const LINHA = /^\s*\[(GUARDA[^\]]{0,160})\]\s*(?:[-:]\s*)?([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/;
let cache = null;
function rondasDe(texto, agora = Date.now()) {
  const out = [];
  const hoje = new Date(agora - BRT);
  for (const linha of String(texto || '').split(/\r?\n/)) {
    const m = LINHA.exec(linha);
    if (!m) continue;
    const data = /^(\d{4})(\d{2})(\d{2})$/.exec(m[1].split('-').reverse().find(p => /^\d{8}$/.test(p)) || '');
    let em;
    if (data) em = Date.UTC(Number(data[1]), Number(data[2]) - 1, Number(data[3]), Number(m[2]), Number(m[3])) + BRT;
    else { em = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate(), Number(m[2]), Number(m[3])) + BRT; if (em - agora > 5 * 60000) em -= 86400000; }
    if (!Number.isFinite(em) || em - agora > 5 * 60000) continue;
    out.push(em);
  }
  return [...new Set(out)].sort((a, b) => b - a).slice(0, 12).map(at => new Date(at).toISOString());
}
function guardaDe(root, agora = Date.now()) {
  const arquivo = path.join(root, 'estado', 'codex.md');
  let stat; try { stat = fs.statSync(arquivo); } catch { return null; }
  if (cache && cache.arquivo === arquivo && cache.tamanho === stat.size && cache.hora === stat.mtimeMs) return cache.valor;
  let texto = '';
  try { texto = require('./leitor.cjs').readSafe(root, 'estado/codex.md', 8 * 1024 * 1024); } catch { texto = ''; }
  const valor = texto ? { rondas: rondasDe(texto, agora), lidoEm: new Date(agora).toISOString() } : null;
  cache = { arquivo, tamanho: stat.size, hora: stat.mtimeMs, valor };
  return valor;
}
module.exports = { guardaDe, rondasDe };
