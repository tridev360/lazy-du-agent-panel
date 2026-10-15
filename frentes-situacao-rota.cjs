'use strict';








const fs = require('node:fs');
const path = require('node:path');

const MIN = 60000, VELHO_MIN = 5, MAX_BYTES = 1024 * 1024, MAX_FRENTES = 80;
const SOLUCAO = 'peça ao seu Claude para atualizar estado/frentes-situacao.json; o painel apenas lê este arquivo';

function vazio(motivo, extra = {}) {
  return { ok: false, motivo, solucao: SOLUCAO, atualizado: null, idadeMin: null, versao: null, chavesLidas: null, ordemFoco: [], frentes: [], resumo: null, fonte: 'estado/frentes-situacao.json', ...extra };
}

function ler({ estado, now = Date.now(), dono = false } = {}) {
  let j = null;
  try {
    const arq = path.join(String(estado || ''), 'estado', 'frentes-situacao.json'), st = fs.lstatSync(arq);
    if (!st.isFile() || st.isSymbolicLink() || st.size > MAX_BYTES) return vazio('arquivo da situação fora do formato');
    j = JSON.parse(fs.readFileSync(arq, 'utf8').replace(/^﻿/, ''));
  } catch { return vazio('sem leitura da situação das frentes'); }
  if (!j || typeof j !== 'object' || Array.isArray(j) || !Array.isArray(j.frentes)) return vazio('arquivo da situação fora do formato');
  const em = Date.parse(j.atualizado);
  if (!Number.isFinite(em)) return vazio('hora da situação ilegível');
  if (em > now + 2 * MIN) return vazio('hora da situação no futuro');
  const idadeMin = Math.round((now - em) / MIN);
  if (idadeMin > VELHO_MIN) return vazio('situação com ' + idadeMin + ' min (passa de ' + VELHO_MIN + ')', { atualizado: j.atualizado, idadeMin });

  let S = null; try { S = require('./sigilo-pessoas.cjs'); } catch { S = null; }
  const limpa = v => { try { return typeof v === 'string' && S && typeof S.mascarar === 'function' ? S.mascarar(v) : null; } catch { return null; } };
  const frentes = j.frentes.filter(f => f && typeof f === 'object' && !Array.isArray(f)).slice(0, MAX_FRENTES).map(f => { const { soDono, ...resto } = f; const linha = { ...resto, frente: limpa(f.frente) }; if (dono === true && soDono && typeof soDono === 'object' && !Array.isArray(soDono)) linha.soDono = soDono; return linha; }); // soDono (nome real da frente, se um dia a fonte trouxer) so sai no modo dono
  return {
    ok: true, motivo: null, solucao: null, atualizado: j.atualizado, idadeMin, versao: typeof j.versao === 'string' ? j.versao : null, chavesLidas: j.chavesLidas === true,
    ordemFoco: Array.isArray(j.ordemFoco) ? j.ordemFoco : [], frentes, resumo: j.resumo && typeof j.resumo === 'object' ? j.resumo : null, fonte: 'estado/frentes-situacao.json'
  };
}

module.exports = { ler, vazio, VELHO_MIN };
