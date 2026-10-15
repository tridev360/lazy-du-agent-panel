'use strict';
// LEITOR DOS PULSOS DO ACELERAR. SO LEITURA.
// O botao Acelerar do painel grava 1 linha em estado/pulsos-acelerar.jsonl; sua IA roda este script (a cada 15 min, ou quando voce pedir)
// e ve quais pulsos ainda nao tem resposta em estado/pulsos-acelerar-respostas.jsonl. Responder = 1 linha JSON nesse arquivo: {id, hora, texto, cards:[ids de card]}.
// Uso: node ler-pulsos.cjs [--estado <pasta estado>] [--agora <ISO>] [--janela <minutos>]   (padrao: estado-local/estado ou PAINEL_ROOT/estado; janela de 60 min, o mesmo que a tela guarda)
// Texto do pulso = comando que sai do pulso-acelerar.cjs (nunca do que estiver escrito na linha do arquivo).
const fs = require('node:fs'), path = require('node:path');

const JANELA_MIN = 60, ID_PULSO = /^P-[A-Za-z0-9-]{1,40}$/;
const ARQ = 'pulsos-acelerar.jsonl', ARQ_RESP = 'pulsos-acelerar-respostas.jsonl';

// o que o pulso pede: a mesma regra do pulso-acelerar.cjs (nenhuma lista propria)
function alvo(id) { return require('./pulso-acelerar.cjs').alvo(id); }
// linhas JSON do fim do arquivo (linha quebrada ou cortada e ignorada)
function lerLinhas(file, maxBytes = 512 * 1024) {
  try {
    const st = fs.lstatSync(file);
    if (!st.isFile() || st.isSymbolicLink()) return [];
    const fd = fs.openSync(file, 'r');
    try {
      const n = Math.min(st.size, maxBytes), buf = Buffer.alloc(n);
      fs.readSync(fd, buf, 0, n, st.size - n);
      let txt = buf.toString('utf8');
      if (st.size > n) txt = txt.slice(txt.indexOf('\n') + 1);
      const out = [];
      for (const l of txt.split('\n')) { if (!l.trim()) continue; try { const j = JSON.parse(l); if (j && typeof j === 'object' && !Array.isArray(j)) out.push(j); } catch { /* linha quebrada */ } }
      return out;
    } finally { fs.closeSync(fd); }
  } catch { return []; }
}

function pendentes({ estado, agora = Date.now(), janelaMin = JANELA_MIN } = {}) {
  const respondidos = new Set();
  for (const r of lerLinhas(path.join(estado, ARQ_RESP))) if (typeof r.id === 'string') respondidos.add(r.id);
  const validos = [];
  for (const p of lerLinhas(path.join(estado, ARQ))) {
    if (typeof p.id !== 'string' || !ID_PULSO.test(p.id) || typeof p.projeto !== 'string' || typeof p.hora !== 'string') continue;
    const a = alvo(p.projeto), t = Date.parse(p.hora);
    if (!a || !Number.isFinite(t) || agora - t > janelaMin * 60000) continue;
    validos.push({ id: p.id, hora: p.hora.slice(11, 16), projeto: p.projeto, texto: a.comando, minutos: Math.max(0, Math.round((agora - t) / 60000)), t });
  }
  validos.sort((x, y) => x.t - y.t);
  const novoDe = new Map(); for (const v of validos) novoDe.set(v.projeto, v.id); // o mais novo de cada projeto (o que a tela mostra)
  const itens = validos.filter(v => !respondidos.has(v.id)).map(({ t, ...v }) => ({ ...v, ultimo: novoDe.get(v.projeto) === v.id }));
  return { ok: true, itens };
}
function formatar(r) {
  if (!r || !r.itens || !r.itens.length) return ['Acelerar: nenhum pulso sem resposta'];
  return [r.itens.length + ' pulso(s) do Acelerar sem resposta; responda cada um com 1 linha JSON ({id, hora, texto, cards}) em estado/pulsos-acelerar-respostas.jsonl, na pasta de estado do painel (texto curto, sem segredo):',
    ...r.itens.map(i => '  ' + i.id + ' ' + i.hora + ' ' + i.projeto + ' ' + i.texto + ' (há ' + i.minutos + ' min)' + (i.ultimo ? ' (o mais novo do projeto)' : ''))];
}
function estadoPadrao() { return path.join(process.env.PAINEL_ROOT || path.join(__dirname, 'estado-local'), 'estado'); }
function main(argv) {
  const pega = nome => { const i = argv.indexOf(nome); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null; };
  try {
    const iso = pega('--agora'), agora = iso ? Date.parse(iso) : Date.now(), janela = Number(pega('--janela')) || JANELA_MIN;
    console.log(formatar(pendentes({ estado: pega('--estado') || estadoPadrao(), agora: Number.isFinite(agora) ? agora : Date.now(), janelaMin: janela })).join('\n'));
  } catch (e) { console.log('? leitor dos pulsos do Acelerar falhou. Solução: conferir o ler-pulsos.cjs na pasta do painel'); }
}
if (require.main === module) main(process.argv.slice(2));
module.exports = { pendentes, formatar, main, alvo };
