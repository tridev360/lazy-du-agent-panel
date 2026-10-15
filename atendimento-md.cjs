'use strict';
//   ultimoUp: a linha SUBIU mais nova ("## HH:MM [DD/MM] SUBIU <hash> (<o que>; ...)" ou "- HH:MM DD/MM SUBIU ..."), com hora e idade.
//   prontos:  o "pronto para ele" mais novo ("## HH:MM LEVA N PRONTA PARA SUBIR ..." ou "... pronto para ele ..."), com hora e validade:
//             vale so se nenhum SUBIU veio depois e por ate 24 h. Vencido sai da conta e vai para "vencidos".
// Hora sem data no titulo ("## 05:18 ...") e do dia da ultima gravacao do arquivo (se passa dela, e da vespera). Linha de log sem data nao conta.
const fs = require('node:fs'), path = require('node:path');
const H = 3600000, VALIDADE_MS = 24 * H, REL = 'estado/atendimento.md';
function lerTexto(root) { try { return require('./leitor.cjs').readSafe(root, REL, 1024 * 1024) || null; } catch { return null; } }
function mtimeDe(root) { try { const st = fs.statSync(path.join(root, REL)); return st.isFile() ? st.mtimeMs : null; } catch { return null; } }
// hora BRT (HH, M e x de "05:2x") e data opcional -> ms
function horaDe(hh, mm, dia, mes, base, herdada = false) {
  const aprox = /x$/i.test(mm), min = aprox ? Number(mm[0]) * 10 : Number(mm);
  const b = new Date(base - 3 * H);
  const ano = b.getUTCFullYear(), m = dia ? Number(mes) - 1 : b.getUTCMonth(), d = dia ? Number(dia) : b.getUTCDate();
  let t = Date.UTC(ano, m, d, Number(hh), min) + 3 * H;
  if (t > base + 120000) t = dia && !herdada ? Date.UTC(ano - 1, m, d, Number(hh), min) + 3 * H : t - 24 * H;
  return { t, aprox };
}
const HEX = /\b(?=[0-9a-f]*\d)[0-9a-f]{7,40}\b/gi;
function oQueSubiu(resto) {
  let s = String(resto || '').trim();
  const hash = /^[0-9a-f]{7,40}\b\s*/i.exec(s);
  if (hash) { s = s.slice(hash[0].length); const p = /^\(([^)]*)/.exec(s); if (p) s = p[1].split(';')[0]; }
  else s = s.split(/\s\(|:\s|;\s/)[0];
  return s.replace(HEX, '').replace(/\s{2,}/g, ' ').replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '').trim();
}
function frase(s) {
  let v = String(s || '').replace(HEX, '').replace(/\s{2,}/g, ' ').trim();
  const letras = v.replace(/[^A-Za-z]/g, ''), caixa = v.replace(/[^A-Z]/g, '');
  if (letras.length && caixa.length / letras.length > 0.6) v = v.charAt(0) + v.slice(1).toLowerCase();
  return v;
}
function ler(root, now = Date.now()) {
  const texto = lerTexto(root), base = mtimeDe(root);
  if (texto === null || !Number.isFinite(base)) return { ok: false, motivo: 'estado/atendimento.md sem leitura', lidoEm: new Date(now).toISOString(), ultimoUp: null, prontos: [], vencidos: [] };
  const M = require('./mastigar.cjs');
  const linhas = String(texto).replace(/^﻿/, '').split(/\r?\n/);
  const subiu = [], prontos = [];
  // Sem nenhuma linha datada: a hora fica sem dia (semDia); o pronto sem dia vai para "Fora da conta" e nunca conta.
  const cab = [];
  linhas.forEach((l, i) => {
    let m = /^##\s+(\d{2}):(\d[\dx])(?:\s+(\d{2})\/(\d{2}))?\s+(.+)$/i.exec(l);
    if (m) { cab.push({ i, hh: m[1], mm: m[2], dia: m[3], mes: m[4], resto: m[5], log: false }); return; }
    m = /^-\s+(\d{2}):(\d[\dx])\s+(\d{2})\/(\d{2})\s+SUBIU\s+(.+)$/i.exec(l);
    if (m) cab.push({ i, hh: m[1], mm: m[2], dia: m[3], mes: m[4], resto: 'SUBIU ' + m[5], log: true });
  });
  const datadas = cab.filter(c => c.dia);
  for (const c of cab) {
    let dia = c.dia, mes = c.mes, semDia = false;
    if (!dia) { const p = datadas.slice().sort((a, b) => Math.abs(a.i - c.i) - Math.abs(b.i - c.i))[0]; if (p) { dia = p.dia; mes = p.mes; } else semDia = true; }
    const { t, aprox } = horaDe(c.hh, c.mm, dia, mes, base, !c.dia && !!dia);
    const s = /^SUBIU\s+(.+)$/i.exec(c.resto);
    if (s) subiu.push({ t, aprox, semDia, linha: c.i + 1, oque: oQueSubiu(s[1]) });
    else if (!c.log && /\bPRONT[AO]S?\s+PARA\s+SUBIR\b|\bpront[oa] para ele\b/i.test(c.resto)) {
      const perto = linhas.slice(c.i, c.i + 4).join(' ');
      prontos.push({ t, aprox, semDia, linha: c.i + 1, titulo: frase(c.resto.split(/\s\(|:\s/)[0]), onde: /SUBIR-AGORA/i.test(perto) ? 'atalho SUBIR-AGORA da Área de Trabalho' : 'chat da Atendimento' });
    }
  }
    subiu.sort((a, b) => b.t - a.t); prontos.sort((a, b) => b.t - a.t);
  const up = subiu[0] || null;
  const hm = t => { const d = new Date(t - 3 * H); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };
  const campo = x => x.semDia ? { em: null, dataTexto: 'às ' + hm(x.t) + ' (o atendimento.md não diz o dia)', idadeTexto: null, aprox: x.aprox, semDia: true } : ({ em: new Date(x.t).toISOString(), dataTexto: M.dataTexto(x.t), idadeTexto: M.idadeTexto(M.idadeDe(x.t, now)), aprox: x.aprox });
  const ultimoUp = up ? { texto: M.frase(up.oque, 160) || 'o último up (o que subiu não foi lido)', ...campo(up), fonte: { arquivo: REL, linha: up.linha } } : null;
  const valem = [], vencidos = [];
  // so o "pronto" mais novo vale (os de antes sao previsoes do mesmo pronto)
  for (const [n, p] of prontos.entries()) {
    const porque = n > 0 ? 'outro pronto mais novo' : up && up.t >= p.t ? 'subiu depois (' + M.dataTexto(up.t) + ')' : p.semDia ? 'sem dia na linha' : now - p.t > VALIDADE_MS ? 'passou de 24 h' : null;
    const item = { titulo: M.titulo(p.titulo, 120), onde: p.onde, ...campo(p), fonte: { arquivo: REL, linha: p.linha, contaAte: p.semDia ? null : new Date(p.t + VALIDADE_MS).toISOString() } };
    if (porque) vencidos.push({ ...item, porque }); else valem.push(item);
  }
  return { ok: true, lidoEm: new Date(now).toISOString(), fonteEm: new Date(base).toISOString(), fonteTexto: 'atendimento.md gravado ' + M.dataTexto(base), ultimoUp, prontos: valem, vencidos: vencidos.slice(0, 5) };
}
let memo = null;
function lerCacheado(root, now = Date.now()) { if (memo && memo.root === root && now - memo.at < 30000) return memo.v; const v = ler(root, now); memo = { root, at: now, v }; return v; }
module.exports = { ler, lerCacheado, oQueSubiu, horaDe, frase, VALIDADE_MS };
