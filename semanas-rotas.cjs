'use strict';






const fs = require('node:fs'), path = require('node:path');
const SIGILO = require('./sigilo-pessoas.cjs');
const ASSETS = { '/semanas.js': ['semanas.js', 'text/javascript'], '/semanas.css': ['semanas.css', 'text/css'] };
const ARQUIVO = path.join('estado', 'timeline-semanas.json');
const MAX_BYTES = 256000, MAX_TEXTO = 140, MAX_SEMANAS = 12, MAX_ITENS = 20, MAX_QUEM = 4, MAX_CHIP = 20;
const ESTADOS = ['pronto', 'obra', 'depende', 'depois'];
const SOLUCAO = 'a COORDENADOR grava as semanas no próximo WEN';

const PALAVRA_RESERVADA = /estrat|carteira|wallet|dinheiro|lucro|ranking|pnl|saldo|R\$|\$\s?\d|\d+\s?%/i;

const ENDERECO = /\b0x[0-9a-fA-F]{40,64}\b/; // 40 = endereco; 64 = hash de transacao (leva a carteira)
const base58 = s => s.split(/[^1-9A-HJ-NP-Za-km-z]+/).some(t => t.length >= 32 && t.length <= 44 && /\d/.test(t) && /[A-Z]/.test(t) && /[a-z]/.test(t));
const reservado = v => ENDERECO.test(v) || base58(v);

const texto = (v, max = MAX_TEXTO) => {
  if (typeof v !== 'string') return '';
  const t = v.replace(/\s+/g, ' ').trim();
  if (reservado(t)) return '?';
  return Array.from(t).slice(0, max).join('');
};
const textoOuNulo = v => { const t = texto(v); return t ? t : null; };
const idTexto = v => (typeof v === 'string' ? v.replace(/[^\w-]/g, '').slice(0, 40) : '');

function chips(v) {
  if (!Array.isArray(v)) return [];
  const saida = [];
  for (const q of v) {
    if (typeof q !== 'string') continue;
    const t = q.replace(/\s+/g, ' ').trim();
    if (!t || t.length > MAX_CHIP || reservado(t)) continue;
    saida.push(t);
    if (saida.length >= MAX_QUEM) break;
  }
  return saida;
}
function item(i) {
  if (!i || typeof i !== 'object') return null;
  const t = texto(i.texto);
  if (!t) return null;
  const quem = chips(i.quem), data = textoOuNulo(i.data);
  const eBot = quem.some(q => q.toUpperCase() === 'BOT') || /^bot\b/i.test(t);
  const base = { estado: ESTADOS.includes(i.estado) ? i.estado : '?', quem, dele: textoOuNulo(i.dele), data: data === '?' ? null : data };


  if (t !== '?' && (eBot || PALAVRA_RESERVADA.test(t))) return SIGILO.aberto() ? { texto: t, ...base, reservadoAberto: true } : { texto: eBot ? 'Bot: detalhe reservado' : 'Detalhe reservado', ...base, soDono: { texto: t } };
  return { texto: t, ...base };
}
function semana(s, n) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.itens)) return null;
  const todos = s.itens.map(item).filter(Boolean);
  return {
    id: idTexto(s.id) || 's' + n, titulo: texto(s.titulo) || 'Semana ' + (n + 1), datas: texto(s.datas), meta: texto(s.meta),
    itens: todos.slice(0, MAX_ITENS), cortados: Math.max(0, todos.length - MAX_ITENS)
  };
}

function validar(j) {
  if (!j || typeof j !== 'object' || Array.isArray(j) || !Array.isArray(j.semanas)) return null;
  const ms = typeof j.atualizado === 'string' ? Date.parse(j.atualizado) : NaN;
  const todas = j.semanas.map(semana).filter(Boolean), semanas = todas.slice(0, MAX_SEMANAS);
  if (!semanas.length) return null;
  return { ok: true, lido: true, atualizado: Number.isFinite(ms) ? j.atualizado.slice(0, 40) : null, nota: texto(j.nota), semanas, semanasCortadas: Math.max(0, todas.length - MAX_SEMANAS) };
}
const falta = (motivo, extra = SOLUCAO) => ({ ok: false, lido: false, semanas: [], motivo, falta: extra });

function ler(root) {
  let bruto;
  try {
    const arq = path.join(root, ARQUIVO), st = fs.lstatSync(arq); // T8: link nao e seguido
    if (!st.isFile() || st.isSymbolicLink()) return falta('ausente', 'Ainda não há semanas: ' + SOLUCAO + '.');
    if (st.size > MAX_BYTES) return falta('quebrado', 'O arquivo das semanas está grande demais: ' + SOLUCAO + '.');
    bruto = fs.readFileSync(arq, 'utf8').replace(/^﻿/, '');
  } catch { return falta('ausente', 'Ainda não há semanas: ' + SOLUCAO + '.'); }
  let j; try { j = JSON.parse(bruto); } catch { return falta('quebrado', 'O arquivo das semanas está quebrado: ' + SOLUCAO + '.'); }
  return validar(j) || falta('quebrado', 'O arquivo das semanas está sem semanas: ' + SOLUCAO + '.');
}

function handle(req, url, { send, root, example = false }) {
  const asset = ASSETS[url.pathname], api = url.pathname === '/api/semanas';
  if (!asset && !api) return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') { send(405, { ok: false, error: 'Somente leitura' }); return true; }
  if (asset) { try { send(200, fs.readFileSync(path.join(__dirname, asset[0])), asset[1]); } catch { send(404, { ok: false, error: 'Arquivo ausente' }); } return true; }
  if (example) { send(200, falta('exemplo', 'No modo exemplo as semanas não aparecem; abra o painel normal.')); return true; }
  let j; try { j = ler(root); } catch { j = falta('quebrado'); }
  send(200, j);
  return true;
}

module.exports = { handle, ler, validar, texto, reservado, ESTADOS, SOLUCAO };
