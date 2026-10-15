'use strict';
// MARCHA VIVA do ACELERAR. So leitura do estado, nunca grava.
// A rotina de 15 min da sua IA grava 1 linha por volta em estado/rotina-voltas.jsonl (em, resultado e, quando medido, ganho_min). Daqui sai:
//   estado   ligada (ultima volta ha 35 min ou menos: 2 voltas de folga) | parada (mais que isso: a tela mostra "?" com a
//            solucao) | desligada (so com ligado:false escrito no estado/rotina.json e sem volta recente) | sem-leitura
//   desde    o inicio das voltas seguidas (intervalo de ate 35 min entre uma e outra), so quando ligada
//   proxima  o proximo minuto da lista do rotina.json (se valida; senao 2, 17, 32 e 47), so quando ligada
//   hoje e semana (7 dias): voltas, quantas tem ganho_min (numero ou texto "25", "25.5"), e a soma das medidas;
//            nenhuma medida com volta = null (nao medido, a tela mostra "?"), nenhuma volta = 0 (nada aconteceu, "none").
// Hora no relogio deste computador. O relogio vem de quem chama (Date.now no servidor).
const fs = require('node:fs');
const path = require('node:path');

const CICLO_MIN = 15;
const LIGADA_ATE_MIN = 35;
const MINUTOS_PADRAO = [2, 17, 32, 47];
const CAUDA = 512 * 1024;
const MIN = 60000;
const GANHO = /^\s*\d+(?:\.\d+)?\s*$/;

function ganhoDe(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;
  if (typeof v === 'string' && GANHO.test(v)) { const n = Number(v.trim()); return Number.isFinite(n) ? n : null; }
  return null;
}
const doisDig = n => String(n).padStart(2, '0');
function local(ms) { const d = new Date(ms); return { ano: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate(), h: d.getHours(), m: d.getMinutes() }; }
function horaLocal(ms) { const b = local(ms); return doisDig(b.h) + ':' + doisDig(b.m); }
function diaLocal(ms) { const b = local(ms); return doisDig(b.dia) + '/' + doisDig(b.mes); }
function chaveDia(ms) { const b = local(ms); return b.ano * 10000 + b.mes * 100 + b.dia; }
function inicioDoDia(ms) { const b = local(ms); return new Date(b.ano, b.mes - 1, b.dia).getTime(); }

// le so a cauda (o arquivo cresce 1 linha a cada 15 min); linha quebrada ou sem "em" valido nao conta
function lerCauda(arquivo, bytes = CAUDA) {
  let fd;
  try {
    const st = fs.statSync(arquivo); if (!st.isFile()) return null;
    fd = fs.openSync(arquivo, 'r');
    const ini = Math.max(0, st.size - bytes), buf = Buffer.alloc(st.size - ini);
    fs.readSync(fd, buf, 0, buf.length, ini);
    let texto = buf.toString('utf8');
    if (ini > 0) texto = texto.slice(texto.indexOf('\n') + 1);
    return texto;
  } catch { return null; } finally { if (fd !== undefined) try { fs.closeSync(fd); } catch { /* ja fechado */ } }
}
function lerVoltas(estadoDir) {
  const texto = lerCauda(path.join(estadoDir, 'rotina-voltas.jsonl'));
  if (texto === null) return null;
  const voltas = [];
  for (const linha of texto.replace(/^﻿/, '').split(/\r?\n/)) {
    if (!linha.trim()) continue;
    let j; try { j = JSON.parse(linha); } catch { continue; }
    const em = j && typeof j.em === 'string' ? Date.parse(j.em) : NaN;
    if (!Number.isFinite(em)) continue;
    voltas.push({ em, ganho: j ? ganhoDe(j.ganho_min) : null });
  }
  return voltas.sort((a, b) => a.em - b.em);
}
function lerInfinityJson(estadoDir) {
  try { const j = JSON.parse(fs.readFileSync(path.join(estadoDir, 'rotina.json'), 'utf8').replace(/^﻿/, '')); return j && typeof j === 'object' ? j : null; } catch { return null; }
}
function minutosDoCron(j) {
  const m = j && Array.isArray(j.minutos) ? j.minutos : null;
  return m && m.length && m.length <= 60 && m.every(x => Number.isInteger(x) && x >= 0 && x < 60) ? [...new Set(m)].sort((a, b) => a - b) : MINUTOS_PADRAO.slice();
}
// proximo instante (minuto cheio) da lista depois de agora, na hora local
function proximaDe(agora, minutos) {
  const hora = new Date(agora).setMinutes(0, 0, 0);
  for (let h = 0; h <= 1; h++) for (const m of minutos) { const t = hora + h * 3600000 + m * MIN; if (t > agora) return t; }
  return null;
}
function soma(lista) {
  const medidas = lista.filter(v => v.ganho !== null);
  return { voltas: lista.length, medidas: medidas.length, soma: lista.length === 0 ? 0 : medidas.length ? Math.round(medidas.reduce((t, v) => t + v.ganho, 0) * 10) / 10 : null };
}

function calcular(voltas, rotinaJson, agora) {
  const minutos = minutosDoCron(rotinaJson);
  const base = { lido: false, estado: 'sem-leitura', ciclo: CICLO_MIN, minutos, hojeDia: diaLocal(agora), ultimaEm: null, ultimaMin: null, ultimaHora: null, ultimaDia: null, desdeEm: null, desdeHora: null, desdeDia: null, proximaMin: null, proximaHora: null, hoje: { voltas: null, medidas: null, soma: null }, semana: { voltas: null, medidas: null, soma: null } };
  // volta no futuro (relogio errado) nao conta; 2 min de folga para o arredondamento
  const validas = Array.isArray(voltas) ? voltas.filter(v => v.em <= agora + 2 * MIN) : [];
  if (!validas.length) return base;
  const ultima = validas[validas.length - 1].em, ultimaMin = Math.max(0, Math.floor((agora - ultima) / MIN));
  const hojeIni = inicioDoDia(agora), semanaIni = hojeIni - 6 * 24 * 3600000;
  const v = Object.assign(base, {
    lido: true, ultimaEm: new Date(ultima).toISOString(), ultimaMin, ultimaHora: horaLocal(ultima), ultimaDia: diaLocal(ultima),
    hoje: soma(validas.filter(x => x.em >= hojeIni)), semana: soma(validas.filter(x => x.em >= semanaIni))
  });
  if (ultimaMin <= LIGADA_ATE_MIN) {
    let i = validas.length - 1;
    while (i > 0 && validas[i].em - validas[i - 1].em <= LIGADA_ATE_MIN * MIN) i--;
    const desde = validas[i].em, prox = proximaDe(agora, minutos);
    Object.assign(v, { estado: 'ligada', desdeEm: new Date(desde).toISOString(), desdeHora: horaLocal(desde), desdeDia: diaLocal(desde), proximaHora: prox ? horaLocal(prox) : null, proximaMin: prox ? Math.max(1, Math.ceil((prox - agora) / MIN)) : null });
  } else v.estado = rotinaJson && rotinaJson.ligado === false ? 'desligada' : 'parada';
  return v;
}
function lerViva(estadoDir, agora = Date.now()) {
  if (!estadoDir) return calcular(null, null, agora);
  return calcular(lerVoltas(estadoDir), lerInfinityJson(estadoDir), agora);
}

module.exports = { lerViva, calcular, lerVoltas, ganhoDe, horaLocal, diaLocal, chaveDia, proximaDe, CICLO_MIN, LIGADA_ATE_MIN, MINUTOS_PADRAO };
