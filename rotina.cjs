'use strict';
//   GET  /api/rotina            -> ligado, desde, ultima volta, resultado, detalhe, proxima, atualizado, os cards esperando o dono
//                                    (com estado: aberto, respondido ou "respondido?") e o token do clique
//   GET  /api/rotina/voltas     -> o historico de voltas (estado/rotina-voltas.jsonl, 1 linha por volta, ultimos 3 dias)
//   POST /api/rotina/responder  -> {id, opcao}: grava 1 linha em estado/respostas-de-card.md (so card que nao e de subir,
//                                    deploy, push, merge nem dinheiro: esses so no chat de quem executa) e devolve "gravado"
//                                    (so gravou; nao diz que o COORDENADOR leu)
//   GET  /rotina.js e /rotina.css
// Card de subir: decidido por TODO texto do card (id, pergunta, recomendada, destrava, onde e cada opcao inteira, em qualquer
// formato), bruto e ja filtrado, antes de qualquer corte. Na duvida (opcao que nao sei ler, qualquer texto que o filtro escondeu,
// inteiro ou em parte: [privado], hash, caminho ou corte) = de subir. A rota de gravacao reconfere tudo no servidor na hora de gravar.
// Historico: quando o ultimaVolta do rotina.json muda, o servidor anexa 1 linha no jsonl (lido a cada 60 s e a cada GET).
// O detalhe so e gravado depois do mesmo filtro de sigilo da tela (text): detalhe privado = so a volta atual, com o aviso.
// Card fecha sozinho: linha DONO no FILA-DE-DECISOES.md com o id do card, ou resposta pelo painel, DEPOIS da hora em que o painel
// viu o card pela primeira vez. Casou so pelo texto da pergunta = "respondido?" (nao fecha). Cada texto passa pelo filtro de
// sigilo do painel; nada alem desses campos sai daqui. No exemplo: vazio.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const FILES = { '/rotina.js': ['rotina.js', 'text/javascript'], '/rotina.css': ['rotina.css', 'text/css'] };
const ROUTE = '/api/rotina', VOLTAS = '/api/rotina/voltas', RESPONDER = '/api/rotina/responder';
const VOLTAS_ARQ = 'estado/rotina-voltas.jsonl', RESPOSTAS_ARQ = 'estado/respostas-de-card.md', FILA_ARQ = 'FILA-DE-DECISOES.md';
const TOKEN = crypto.randomBytes(24).toString('hex');
// card que mexe em subida, deploy, push, merge ou dinheiro: o painel nunca responde sozinho (so texto pronto para o chat certo)
const PERIGOSO = /\b(?:sub(?:ir|ida|a|ir[aá])|up\b|deploy|hospedagem|push|merge|main\b|dinheiro|compra|comprar|venda|vender|saque|withdraw|chave|env\b|segredo|pagamento|transfer|liga[rç])/i;

function when(value) { const at = typeof value === 'string' ? Date.parse(value) : NaN; return Number.isFinite(at) ? new Date(at).toISOString() : null; }
const OCULTO = 'Detalhes no chat da sessão.';
// O mesmo filtro de sigilo do operador (segredo, carteira, pasta reservada viram "Detalhes no chat da sessão."), sem hash e sem caminho.
// limpo() diz tambem se escondeu QUALQUER pedaco: o texto inteiro, um [privado] do safeText, hash, caminho ou o corte com reticencias.
const SIGILO = /PRIVADO|_SECRETS|backup-privado|\b(?:seed|api.?key|senha|secret)\b|0x[a-f\d]{40}/i;
const HASH = /\b[a-f\d]{7,64}\b/i, CAMINHO = /(?:[A-Z]:[\\/]|(?:estado|tasks|casa|src|public|wt)[\\/])[^\s;,]+/i;
const todas = rx => new RegExp(rx.source, 'gi');
function limpo(value, limit) {
  if (typeof value !== 'string' || !value.trim()) return { texto: null, oculto: false };
  if (SIGILO.test(value)) return { texto: OCULTO, oculto: true };
  const seguro = require('./realtime.cjs').safeText(value, 2000);
  const oculto = value.length > 2000 || seguro.includes('[privado]') || HASH.test(seguro) || CAMINHO.test(seguro);
  const clean = seguro.replace(todas(HASH), '').replace(todas(CAMINHO), '').replace(/[\u2013\u2014]/g, ',').replace(/\s+/g, ' ').replace(/\s+([,.;)])/g, '$1').trim();
  if (!clean) return { texto: null, oculto };
  if (clean.length > limit) return { texto: clean.slice(0, limit - 1).trimEnd() + '…', oculto: true };
  return { texto: clean, oculto };
}
function text(value, limit) { return limpo(value, limit).texto; }
const brt = at => new Date(at - 3 * 3600000);
const stampBrt = at => { const d = brt(at), p = n => String(n).padStart(2, '0'); return p(d.getUTCDate()) + '/' + p(d.getUTCMonth() + 1) + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()); };
function safeTarget(root, relative) {
  const base = fs.realpathSync(root), file = path.join(base, relative), dir = path.dirname(file);
  if (fs.lstatSync(dir).isSymbolicLink() || fs.realpathSync(dir) !== dir) throw Error('pasta');
  try { if (fs.lstatSync(file).isSymbolicLink()) throw Error('link'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return file;
}
function lerTexto(root, relative, max) { try { return require('./leitor.cjs').readSafe(root, relative, max); } catch { return null; } }
function lerCauda(root, relative, bytes) {
  try {
    const file = safeTarget(root, relative), st = fs.statSync(file), ini = Math.max(0, st.size - bytes), buf = Buffer.alloc(st.size - ini);
    const fd = fs.openSync(file, 'r'); try { fs.readSync(fd, buf, 0, buf.length, ini); } finally { fs.closeSync(fd); }
    return { texto: buf.toString('utf8'), mtimeMs: st.mtimeMs };
  } catch { return null; }
}
function lerJson(root) {
  try { const raw = JSON.parse(String(lerTexto(root, 'estado/rotina.json', 64000) || '').replace(/^﻿/, '')); return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null; } catch { return null; }
}

// ---------- voltas ----------
// O detalhe do COORDENADOR acumula as voltas anteriores ("15:16: ... 14:56: ... 14:34: ..."): cada trecho com hora vira a sua volta.
function trechos(detalhe) {
  const s = String(detalhe || '').replace(/\b(\d{2}:\d{2}):\s*(?=\1:)/g, '');
  const marcas = [...s.matchAll(/(?:^|[\s.;])(\d{2}):(\d{2}):\s/g)];
  if (!marcas.length) return [{ hora: null, texto: s.trim() }];
  const out = [];
  if (marcas[0].index > 0 && s.slice(0, marcas[0].index).trim()) out.push({ hora: null, texto: s.slice(0, marcas[0].index).trim() });
  marcas.forEach((m, i) => { const ini = m.index + m[0].length, fim = i + 1 < marcas.length ? marcas[i + 1].index + 1 : s.length; out.push({ hora: m[1] + ':' + m[2], texto: s.slice(ini, fim).trim().replace(/[\s.;]+$/, '') }); });
  return out.filter(t => t.texto);
}
const horaDe = iso => { const d = brt(Date.parse(iso)); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };
function lerVoltas(root, now = Date.now()) {
  const raw = lerCauda(root, VOLTAS_ARQ, 512 * 1024);
  if (!raw) return [];
  // selo vinha do rotina.json velho. A data sai da ordem do arquivo: de tras para a frente, cada linha e o instante mais novo com aquele HH:MM
  // que nao passa da linha seguinte (a ultima, de quando o arquivo foi gravado). Linha assim sai marcada como estimada (so a data e deduzida).
  const linhas = [];
  for (const linha of raw.texto.split(/\r?\n/)) { if (!linha.trim()) continue; try { const v = JSON.parse(linha); if (v && typeof v === 'object') linhas.push(v); } catch { /* linha quebrada fica de fora */ } }
  let teto = Math.min(raw.mtimeMs, now) + 2 * 60000;
  for (let i = linhas.length - 1; i >= 0; i--) {
    const v = linhas[i], dado = when(v.em);
    if (dado) { teto = Date.parse(dado); continue; }
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(v.hora || ''));
    if (!m) { v.em = null; continue; }
    const dia = new Date(teto - 3 * 3600000).toISOString().slice(0, 10);
    let at = Date.parse(dia + 'T' + m[1] + ':' + m[2] + ':00-03:00');
    if (at > teto) at -= 86400000;
    v.em = new Date(at).toISOString(); v.datado = 'deduzido';
    teto = at;
  }
  // linha do rotina-volta.sh (campo acelerou, sem resultado): vira volta com resultado e detalhe, datada pelo campo em ou deduzida
  for (const v of linhas) if ('acelerou' in v && v.resultado === undefined && v.origem === undefined) { v.origem = 'rotina-volta.sh'; v.resultado = v.acelerou ? 'acelerou' : 'manteve'; v.detalhe = typeof v.acelerou === 'string' && v.acelerou.trim() ? v.acelerou : null; }
  return linhas.filter(v => when(v.em) && now - Date.parse(v.em) <= 3 * 86400000);
}
let ultimaGravada = null;
function anotarVolta(root, now = Date.now()) {
  const raw = lerJson(root); if (!raw) return false;
  const em = when(raw.ultimaVolta); if (!em || Date.parse(em) > now + 120000) return false;
  if (ultimaGravada === em) return false;
  const antigas = lerVoltas(root, now), vistas = new Set(antigas.map(v => v.em));
  if (vistas.has(em)) { ultimaGravada = em; return false; }
  const partes = trechos(raw.detalhe), hora = horaDe(em), linhas = [];
  const propria = partes.find(p => p.hora === hora) || partes.find(p => p.hora === null) || partes[0];
  // sigilo ANTES de gravar e antes de cortar: o detalhe inteiro passa pelo filtro da tela (text); se ele esconde o todo,
  // nenhum trecho sai e so a volta atual entra, com o aviso. Senao cada trecho passa pelo mesmo filtro.
  const todoOculto = text(typeof raw.detalhe === 'string' ? raw.detalhe : null, 1200) === OCULTO;
  linhas.push({ em, resultado: ['acelerou', 'manteve'].includes(raw.resultado) ? raw.resultado : null, detalhe: todoOculto ? OCULTO : propria ? text(propria.texto, 1200) : null, origem: 'rotina.json', gravadoEm: new Date(now).toISOString() });
  // 1a gravacao do dia sem historico: os trechos com hora mais velhos do mesmo detalhe entram como voltas de hoje (resultado "?")
  if (!antigas.length && !todoOculto) {
    const dia = new Date(Date.parse(em) - 3 * 3600000).toISOString().slice(0, 10);
    for (const p of partes) {
      if (!p.hora || p.hora === hora) continue;
      const at = Date.parse(dia + 'T' + p.hora + ':00-03:00'); if (!Number.isFinite(at) || at >= Date.parse(em)) continue;
      linhas.push({ em: new Date(at).toISOString(), resultado: null, detalhe: text(p.texto, 1200), origem: 'detalhe da volta seguinte', gravadoEm: new Date(now).toISOString() });
    }
  }
  try {
    const file = safeTarget(root, VOLTAS_ARQ);
    fs.appendFileSync(file, linhas.sort((a, b) => Date.parse(a.em) - Date.parse(b.em)).map(v => JSON.stringify(v)).join('\n') + '\n', 'utf8');
    ultimaGravada = em; return true;
  } catch { return false; }
}
let relogio = null;
function vigiar(root) {
  if (relogio) return;
  relogio = setInterval(() => { try { anotarVolta(root); } catch { /* tenta de novo em 60 s */ } }, 60000);
  if (typeof relogio.unref === 'function') relogio.unref();
}

// ---------- cards ----------
const VISTOS_ARQ = () => require('./so-leitura.cjs').cacheLocal('rotina-cards-vistos.json');
let vistos = null;
function chaveCard(card) { return crypto.createHash('sha256').update(String(card.id || '') + '|' + String(card.pergunta || '')).digest('hex').slice(0, 16); }
function primeiraVez(card, now) {
  if (!vistos) { try { vistos = JSON.parse(fs.readFileSync(VISTOS_ARQ(), 'utf8')) || {}; } catch { vistos = {}; } }
  const k = chaveCard(card); if (vistos[k]) return vistos[k];
  vistos[k] = now;
  try { fs.mkdirSync(path.dirname(VISTOS_ARQ()), { recursive: true }); const keys = Object.keys(vistos); if (keys.length > 400) for (const old of keys.slice(0, keys.length - 400)) delete vistos[old]; fs.writeFileSync(VISTOS_ARQ(), JSON.stringify(vistos)); } catch { /* fica so na memoria */ }
  return now;
}
const palavras = s => [...new Set(String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().match(/[a-z0-9]{4,}/g) || [])];
function linhasDono(texto, now) {
  const ano = brt(now).getUTCFullYear(), out = [];
  for (const linha of String(texto || '').split(/\r?\n/)) {
    const m = /^\s*-\s*(?:[a-z]{3}\s+)?(\d{2})\/(\d{2})\s+(\d{2}):(\d)([\dx])\b/i.exec(linha);
    if (!m || !/\bDONO\b/.test(linha)) continue;
    const at = Date.parse(ano + '-' + m[2] + '-' + m[1] + 'T' + m[3] + ':' + m[4] + (m[5].toLowerCase() === 'x' ? '9' : m[5]) + ':00-03:00');
    if (Number.isFinite(at) && at <= now + 120000) out.push({ at, linha });
  }
  return out;
}
function linhasPainel(texto) {
  const out = [];
  for (const linha of String(texto || '').split(/\r?\n/)) {
    const m = /^-\s*(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s*\|\s*PAINEL\s*\|\s*card\s+([\w.-]{1,80})\s*\|\s*DONO escolheu:\s*(.{1,200})$/.exec(linha.trim());
    if (m) out.push({ dia: m[1] + '/' + m[2], hora: m[3] + ':' + m[4], id: m[5], opcao: m[6].trim() });
  }
  return out;
}
let filaCache = null;
function filaDono(root, now) {
  const raw = lerCauda(root, FILA_ARQ, 96 * 1024); if (!raw) return null;
  if (filaCache && filaCache.mtimeMs === raw.mtimeMs) return filaCache.linhas;
  filaCache = { mtimeMs: raw.mtimeMs, linhas: linhasDono(raw.texto, now) };
  return filaCache.linhas;
}
const rotuloDe = o => typeof o === 'string' ? (o.trim() ? o : null) : o && typeof o === 'object' && !Array.isArray(o) ? [o.label, o.texto].find(v => typeof v === 'string' && v.trim()) || null : null;
function opcoesDe(card) {
  const lista = [], add = v => { const t = text(v, 80); if (t && !lista.some(o => o.toLowerCase() === t.toLowerCase())) lista.push(t); };
  add(card.recomendado);
  for (const o of Array.isArray(card.opcoes) ? card.opcoes : []) add(rotuloDe(o));
  if (lista.length < 2) add('Agora não');
  return lista.slice(0, 4);
}
// Todo texto do card, bruto: cada campo e cada chave, inclusive cada opcao inteira (string ou objeto com qualquer campo).
// Card fundo ou grande demais para ler inteiro = null (na duvida, de subir).
function textosDoCard(valor, out = [], fundo = 0) {
  if (out === null || fundo > 5 || out.length > 600) return null;
  if (typeof valor === 'string') out.push(valor);
  else if (Array.isArray(valor)) { for (const v of valor) if (textosDoCard(v, out, fundo + 1) === null) return null; }
  else if (valor && typeof valor === 'object') { for (const [k, v] of Object.entries(valor)) { out.push(k); if (textosDoCard(v, out, fundo + 1) === null) return null; } }
  return out;
}
// Sem acento, sem caractere invisivel e com a largura normal (deploy em letra larga, com espaco de largura zero no meio e "subira" com acento contam).
const plano = s => String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u200b-\u200f\u202a-\u202e\u2060-\u206f\u3164\ufe00-\ufe0f\ufeff\uffa0]/g, '');
function temPerigo(textos) { const junto = textos.join(' \n '); return PERIGOSO.test(junto) || PERIGOSO.test(plano(junto)); }
// A regra unica de "card de subir" (o painel nunca grava; o botao so copia). Le o card bruto inteiro e passa cada texto que a
// tela mostra, copia ou grava (pergunta, onde, recomendada, destrava e cada opcao) pelo mesmo filtro da tela: se o filtro escondeu
// qualquer pedaco (inteiro ou parcial: [privado], hash, caminho, corte), o dono nao sabe o que escolheria = nao grava. Na duvida = true.
// A rota de gravacao chama esta mesma funcao de novo, no card lido do arquivo na hora de gravar.
const LIMITES = { pergunta: 220, onde: 60, recomendado: 80, destrava: 140 };
function cardDeSubir(card) {
  if (!card || typeof card !== 'object' || Array.isArray(card) || card.perigoso === true) return true;
  const brutos = textosDoCard(card);
  if (brutos === null) return true;
  const opcoes = Array.isArray(card.opcoes) ? card.opcoes : card.opcoes === undefined || card.opcoes === null ? [] : null;
  if (opcoes === null || opcoes.some(o => !rotuloDe(o))) return true; // opcao que nao sei ler (vazia, null, objeto sem label nem texto)
  const vistos = [];
  for (const [valor, max] of [...Object.entries(LIMITES).map(([campo, max]) => [card[campo], max]), ...opcoes.map(o => [rotuloDe(o), 80])]) {
    const r = limpo(valor, max);
    if (r.oculto) return true;
    if (r.texto) vistos.push(r.texto);
  }
  return temPerigo(brutos.concat(vistos));
}
function estadoDosCards(root, cards, now = Date.now()) {
  const fila = filaDono(root, now) || [], painel = linhasPainel(lerTexto(root, RESPOSTAS_ARQ, 256000));
  const hoje = stampBrt(now).slice(0, 5);
  return cards.map(card => {
    const desde = primeiraVez(card, now);
    const idRx = card.id ? new RegExp('(^|[^\\w-])' + card.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\w-])', 'i') : null;
    const doPainel = card.id ? painel.filter(p => p.id === card.id).pop() : null;
    // resposta pelo painel: vale a de hoje feita depois que o card apareceu
    if (doPainel && doPainel.dia === hoje && Date.parse(brt(now).toISOString().slice(0, 10) + 'T' + doPainel.hora + ':00-03:00') >= desde - 60000) return { ...card, estado: 'respondido', respondidoEm: doPainel.hora, respostaPor: 'painel', resposta: text(doPainel.opcao, 80) };
    const depois = fila.filter(l => l.at >= desde - 60000);
    const porId = idRx ? depois.filter(l => idRx.test(l.linha)).pop() : null;
    if (porId) return { ...card, estado: 'respondido', respondidoEm: horaDe(new Date(porId.at).toISOString()), respostaPor: 'chat' };
    const chave = palavras(card.pergunta);
    if (chave.length >= 3) { const porTexto = depois.filter(l => { const tem = palavras(l.linha); return chave.filter(p => tem.includes(p)).length / chave.length >= 0.6; }).pop(); if (porTexto) return { ...card, estado: 'respondido?', respondidoEm: horaDe(new Date(porTexto.at).toISOString()), respostaPor: 'chat' }; }
    return { ...card, estado: 'aberto' };
  });
}

function readInfinity(root, now = new Date()) {
  const raw = lerJson(root);
  if (!raw) return { ok: true, lido: false, lidoEm: now.toISOString() };
  const cards = (Array.isArray(raw.cardsParaEle) ? raw.cardsParaEle : []).slice(0, 12).map(card => {
    if (!card || typeof card !== 'object') return null;
    const id = typeof card.id === 'string' && /^[\w.-]{1,80}$/.test(card.id) ? card.id : null;
    const base = { id, pergunta: text(card.pergunta, 220), onde: text(card.onde, 60), recomendado: text(card.recomendado, 80), destrava: text(card.destrava, 140) };
    if (!base.pergunta) return null;
    return { ...base, opcoes: opcoesDe(card), perigoso: cardDeSubir(card) };
  }).filter(Boolean);
  let estados = cards;
  try { estados = estadoDosCards(root, cards, now.getTime()); } catch { estados = cards.map(card => ({ ...card, estado: 'aberto' })); }
  let doLog = NaN; try { doLog = lerVoltas(root, now.getTime()).map(v => Date.parse(v.em)).reduce((a, b) => Math.max(a, b), -Infinity); } catch { doLog = NaN; }
  if (doLog === -Infinity) doLog = NaN;
  const doJson = Date.parse(raw.ultimaVolta), maisNova = Math.max(Number.isFinite(doJson) ? doJson : -Infinity, Number.isFinite(doLog) ? doLog : -Infinity);
  const ultimaVolta = Number.isFinite(maisNova) ? new Date(maisNova).toISOString() : null, ultimaVoltaFonte = !ultimaVolta ? null : Number.isFinite(doLog) && doLog > (Number.isFinite(doJson) ? doJson : -Infinity) ? 'estado/rotina-voltas.jsonl' : 'estado/rotina.json';
  const atualizadoJson = Date.parse(raw.atualizado), atualizado = Number.isFinite(maisNova) || Number.isFinite(atualizadoJson) ? new Date(Math.max(Number.isFinite(maisNova) ? maisNova : -Infinity, Number.isFinite(atualizadoJson) ? atualizadoJson : -Infinity)).toISOString() : null;
  return {
    ok: true, lido: true, lidoEm: now.toISOString(),
    ligado: raw.ligado === true, desde: when(raw.desde), ultimaVolta, ultimaVoltaFonte,
    resultado: ['acelerou', 'manteve'].includes(raw.resultado) ? raw.resultado : null, detalhe: text(raw.detalhe, 600),
    proxima: when(raw.proxima), atualizado, cicloMin: Number.isInteger(raw.ciclo_min) && raw.ciclo_min > 0 && raw.ciclo_min <= 120 ? raw.ciclo_min : null,
    cards: estados, token: TOKEN, responde: true,
    esperaVoce: (() => { try { const e = require('./painel-numeros.cjs').esperaCacheada(root, now.getTime()); return { total: e.total, rotulo: e.rotulo, partes: e.partes, motivo: e.motivo }; } catch { return null; } })(),
    desdeTexto: (() => { try { return require('./mastigar.cjs').dataTexto(raw.desde); } catch { return null; } })()
  };
}
// ganho_min (minutos que a volta poupou, gravado pela rotina): numero de 0 a 600 (ou texto so com numero); o resto vira null e a tela diz "ganho ?"
function ganhoMin(v) { const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : NaN; return Number.isFinite(n) && n >= 0 && n <= 600 ? Math.round(n) : null; }
function voltasPublicas(root, now = Date.now()) {
  return lerVoltas(root, now).sort((a, b) => Date.parse(b.em) - Date.parse(a.em)).slice(0, 400).map(v => ({ em: when(v.em), resultado: ['acelerou', 'manteve'].includes(v.resultado) ? v.resultado : null, detalhe: text(v.detalhe, 1200), ganhoMin: ganhoMin(v.ganho_min), estimada: v.origem === 'detalhe da volta seguinte', dataDeduzida: v.datado === 'deduzido' }));
}
async function corpo(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 4096) throw Error('grande'); chunks.push(chunk); }
  const j = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!j || typeof j !== 'object' || Array.isArray(j) || Object.keys(j).some(k => !['id', 'opcao'].includes(k))) throw Error('invalido');
  return j;
}
function origemOk(req) {
  const host = String(req.headers.host || '');
  return /^(?:127\.0\.0\.1|localhost):\d{2,5}$/.test(host) && req.headers.origin === 'http://' + host && (!req.headers['sec-fetch-site'] || req.headers['sec-fetch-site'] === 'same-origin')
    && String(req.headers['content-type'] || '').split(';')[0].trim() === 'application/json' && req.headers['x-rotina-token'] === TOKEN;
}
let gravando = false;
async function responder(req, ctx) {
  if (ctx.example || !origemOk(req)) { if (typeof req.resume === 'function') req.resume(); return ctx.send(403, { ok: false, erro: 'origem' }); }
  if (gravando) { if (typeof req.resume === 'function') req.resume(); return ctx.send(409, { ok: false, erro: 'ocupado', mensagem: 'Outro clique está sendo gravado.' }); }
  gravando = true;
  try {
    const j = await corpo(req), now = Date.now(), atual = readInfinity(ctx.root, new Date(now));
    const card = (atual.cards || []).find(c => c.id && c.id === j.id);
    if (!card) return ctx.send(409, { ok: false, erro: 'mudou', mensagem: 'O card mudou ou já saiu. A tela vai atualizar.' });
    if (card.perigoso) return ctx.send(409, { ok: false, erro: 'so-no-chat', mensagem: 'Este card só vale no ' + (card.onde || 'chat de quem executa') + '.' });
    if (card.estado === 'respondido') return ctx.send(409, { ok: false, erro: 'respondido', mensagem: 'Este card já foi respondido.' });
    const opcao = Number.isInteger(j.opcao) && j.opcao >= 0 && j.opcao < card.opcoes.length ? card.opcoes[j.opcao] : null;
    if (!opcao) return ctx.send(400, { ok: false, erro: 'invalido' });
    const linha = '- ' + stampBrt(now) + ' | PAINEL | card ' + card.id + ' | DONO escolheu: ' + opcao.replace(/[|\r\n]+/g, ' ') + '\n';
    // de novo no servidor, na hora de gravar, sem confiar na tela: o card cru do arquivo (1 so com este id) passa outra vez pela
    // mesma regra, e a linha exata nao leva assunto de subir nem texto escondido pelo filtro
    const cru = lerJson(ctx.root), iguais = cru && Array.isArray(cru.cardsParaEle) ? cru.cardsParaEle.filter(c => c && typeof c === 'object' && c.id === card.id) : [];
    if (iguais.length !== 1 || cardDeSubir(iguais[0]) || opcao === OCULTO || opcao.includes('[privado]') || temPerigo([linha, card.pergunta || ''])) return ctx.send(409, { ok: false, erro: 'so-no-chat', mensagem: 'Este card só vale no ' + (card.onde || 'chat de quem executa') + '.' });
    const file = safeTarget(ctx.root, RESPOSTAS_ARQ);
    let cabeca = '';
    try { fs.lstatSync(file); } catch { cabeca = '# Respostas de card pelo painel (o Claude le, repassa a quem executa e anota na fila de decisões)\n'; }
    fs.appendFileSync(file, cabeca + linha, 'utf8');
    // so gravou no arquivo: a tela diz "Pedido gravado", nunca que o COORDENADOR recebeu ou leu
    return ctx.send(200, { ok: true, gravado: true, hora: stampBrt(now).slice(6), opcao });
  } catch (error) {
    return ctx.send(400, { ok: false, erro: 'invalido', mensagem: 'Não consegui gravar. Atualize e tente de novo.' });
  } finally { gravando = false; }
}
function handle(req, url, ctx) {
  const pathname = url && url.pathname;
  if (![ROUTE, VOLTAS, RESPONDER].includes(pathname) && !Object.hasOwn(FILES, pathname)) return false;
  if (pathname === RESPONDER) { if (req.method !== 'POST') { ctx.send(405, { ok: false, error: 'Method not allowed' }); return true; } responder(req, ctx).catch(() => ctx.send(500, { ok: false })); return true; }
  if (req.method !== 'GET') { if (typeof req.resume === 'function') req.resume(); ctx.send(405, { ok: false, error: 'Method not allowed' }); return true; }
  if (pathname === ROUTE || pathname === VOLTAS) {
    if (ctx.example) { ctx.send(200, pathname === ROUTE ? { ok: true, lido: false, exemplo: true } : { ok: true, voltas: [], exemplo: true }); return true; }
    vigiar(ctx.root);
    try { anotarVolta(ctx.root); } catch { /* a leitura segue sem gravar */ }
    ctx.send(200, pathname === ROUTE ? readInfinity(ctx.root) : { ok: true, lidoEm: new Date().toISOString(), voltas: voltasPublicas(ctx.root) });
    return true;
  }
  const [file, type] = FILES[pathname];
  let bytes = null; try { bytes = fs.readFileSync(path.join(ctx.dir || __dirname, file)); } catch { bytes = null; }
  if (bytes) ctx.send(200, bytes, type); else ctx.send(503, { error: 'Asset unavailable' });
  return true;
}
module.exports = { handle, readInfinity, ROUTE, trechos, linhasDono, linhasPainel, estadoDosCards, anotarVolta, lerVoltas, voltasPublicas, PERIGOSO, cardDeSubir };
