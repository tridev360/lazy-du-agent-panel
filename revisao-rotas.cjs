'use strict';


































const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const N = require('./cards300-nucleo.cjs'), SIGILO = require('./sigilo-pessoas.cjs');

const assets = ['revisao.js', 'revisao.css'];
const ITENS = 'revisao-itens.json', LOG = 'revisao-log.jsonl', RESPOSTAS = 'revisao-respostas.jsonl';
const PROJETOS = [{id:'lancamento',titulo:'Produto',sub:''},{id:'automacao',titulo:'Automação',sub:''},{id:'criacao',titulo:'Criação',sub:''},{id:'painel',titulo:'Painel',sub:''},{id:'resto',titulo:'Outros',sub:''}];
const DESTINOS = ['Claude','Codex','Revisor'];
const PERGUNTAS = ['Isso está bom para lançar?', 'O que você mudaria?', 'Qual o risco?'];
const SELOS = ['olho', 'sim', 'pronto', 'nao-passou'];
const ACOES = ['aprovo', 'refazer', 'depois', 'acho', 'opcao', 'opiniao', 'trazer-card', 'desfazer'];
const DECISOES = ['aprovo', 'refazer', 'depois', 'opcao', 'trazer-card'];
const SOLUCAO = 'peça à COORDENADOR para regravar a lista da revisão';
const RESERVADO = 'detalhe no chat da sessão', NA_COORDENADOR = 'Este se responde na tela de escolha da COORDENADOR.';
const SEM_PASTA = 'Assunto reservado: este texto não fica no painel. Escreva no chat da sessão.';
const DETALHE = ['titulo', 'mudou', 'espera', 'pares', 'midia', 'critico', 'textos']; // o que o item reservado so traz na pasta reservada

const PASTAS_MIDIA = [];
const TIPO_MIDIA = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm' };
const PASTA_PROIBIDA = /(?:segredos?|secrets?|sigilos[oa]s?|privad[oa]s?|wallet[-_.]?backups?|(?:^|[\\/])\.env|[\\/]seed(?:[\\/.]|$))/i;
const TIPOS_PERIGOSOS = new Set(['subida', 'env', 'env-dinheiro', 'tela-dinheiro', 'dinheiro', 'deploy']);

const RX_FORA = /^\s*(?:substitu|segurad|parad|superad|anulad|recusad|encerrad|cancelad|fechad|subid|respond|espera\b)/;
const RX_VALOR = /R\$|US\$|\$\s?\d|\b\d[\d.,]*\s?(?:sol|eth|weth|usdc|usdt|usd|brl|btc|reais|d[oó]lares)\b/i;
const RX_ENDERECO = /0x[a-fA-F0-9]{8,}|\b[a-fA-F0-9]{64}\b|(?<![\w/])[1-9A-HJ-NP-Za-km-z]{32,44}(?![\w])/;
const RX_ITEM = /^(?:card:)?[\w][\w.-]{0,119}$/, RX_ID_ARQUIVO = /^[\w][\w.-]{0,99}$/, RX_LINHA = /^r-[a-z0-9]{1,16}-[a-f0-9]{6}$/, RX_CHAVE = /^[a-f0-9]{24}$/;
const MAX_ARQUIVO = 2 * 1024 * 1024, MAX_CORPO = 4096, MAX_TEXTO = 500, MAX_PERGUNTA = 2000, MAX_VIDEO = 200 * 1024 * 1024, MAX_IMAGEM = 20 * 1024 * 1024, DESFAZER_MS = 60000;
const loopback = ip => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
const erro = (codigo, detalhe) => Object.assign(Error(detalhe || codigo), { codigo, detalhe: detalhe || null });
const sha1 = v => crypto.createHash('sha1').update(v).digest('hex');
const RX_VALOR_G = /(?:R\$|US\$|\$)\s?\d[\d.,]*|\b\d[\d.,]*\s?(?:sol|eth|weth|usdc|usdt|btc)\b/gi;
const lista = v => (Array.isArray(v) ? v : []);

const FORA = {
  reservado: { um: 'Card reservado', varios: ' cards reservados', espera: RESERVADO },
  restrito: { um: 'Card restrito', varios: ' cards restritos', espera: 'Assunto restrito: fica fora do painel. Responda no chat da sessão.' },
  repetido: { um: 'Card com nome repetido', varios: ' cards com nome repetido', espera: 'Há dois cards com o mesmo nome: responda no chat para não errar.' }
};






const RX_SEGREDO = /wallet[-_.]?backups?|segredos?|seed phrase|mnemonic|private key|chave privada|BEGIN [A-Z ]*PRIVATE KEY/i;
function mascara(dono) {
  const aberto = dono === true;
  return {
    dono: aberto,

    texto: aberto ? (v, max) => N.limpar(v, max) : (v, max) => N.limpar(v, max).replace(RX_VALOR_G, '[valor]'),

    itemFechado: (x, projeto) => RX_SEGREDO.test(JSON.stringify(x)) || (!aberto && (x.sigilo === true || x.dinheiro === true || N.sessaoReservada({ sessao: x.sessao, id: x.id }))),

    cardFechado: (c, duplicado, projeto) => {
      if (aberto) return RX_SEGREDO.test(JSON.stringify(c)) ? 'restrito' : duplicado ? 'repetido' : null;
      const b = N.bloqueio(c);
      return b === 'restrito' || b === 'reservado' || duplicado ? 'reservado' : null;
    }
  };
}
const FECHADA = mascara(false); // a regua do "reservado" (onde o detalhe pode morar) e sempre a da visao fechada, mesmo com o modo dono aberto

const segmentos = p => path.resolve(p).split(/[\\/]+/).filter(Boolean).map(s => s.toLowerCase());

const dentroDe = (alvo, pai) => { const a = segmentos(alvo), p = segmentos(pai); return p.length <= a.length && p.every((x, i) => a[i] === x); };
const foraDoEstado = (alvo, estadoDir, painelDir) => !segmentos(alvo).includes('estado-local') && !dentroDe(alvo, estadoDir) && !dentroDe(estadoDir, alvo) && !dentroDe(alvo, painelDir);
function pastaReservada(){return null;}
function pastaReservadaViva(dir, estadoDir, painelDir, criar) {
  if (!dir) return null;
  try {
    if (criar) { try { fs.mkdirSync(dir); } catch (e) { if (!e || e.code !== 'EEXIST') return null; } }
    const real = fs.realpathSync(dir);
    let estadoReal = estadoDir; try { estadoReal = fs.realpathSync(estadoDir); } catch {  }
    return fs.statSync(real).isDirectory() && foraDoEstado(real, estadoReal, painelDir) ? real : null;
  } catch { return null; }
}
function regrasDe(pastas) {
  return lista(pastas).filter(p => typeof p === 'string' && p.trim() && path.isAbsolute(p.trim())).map(p => {
    let alvo = p.trim();
    if (!alvo.includes('*')) { try { alvo = fs.realpathSync(alvo); } catch {  } }
    return segmentos(alvo);
  });
}
function dentro(real, regras) {
  const seg = segmentos(real);
  return regras.some(r => r.length < seg.length && r.every((x, i) => (x.endsWith('*') ? x.length > 1 && seg[i].startsWith(x.slice(0, -1)) : seg[i] === x)));
}
function midiaSegura(arquivo, regras) {
  if (typeof arquivo !== 'string' || !arquivo || arquivo.length > 400 || /[\u0000-\u001f*?"<>|]/.test(arquivo) || !path.isAbsolute(arquivo)) return null;
  const tipo = TIPO_MIDIA[path.extname(arquivo).toLowerCase()];
  if (!tipo || PASTA_PROIBIDA.test(arquivo)) return null;
  let st, real;
  try { st = fs.lstatSync(arquivo); if (!st.isFile() || st.isSymbolicLink()) return null; real = fs.realpathSync(arquivo); } catch { return null; }
  if (PASTA_PROIBIDA.test(real) || !dentro(real, regras)) return null;
  if (segmentos(real).join('/') !== segmentos(arquivo).join('/')) { try { if (segmentos(fs.realpathSync(path.dirname(arquivo))).join('/') !== segmentos(path.dirname(real)).join('/')) return null; } catch { return null; } }
  if (!st.size || st.size > (tipo.startsWith('video/') ? MAX_VIDEO : MAX_IMAGEM)) return null;
  return { real, tipo, tamanho: st.size };
}

function lerItens(estadoDir) {
  const arquivo = path.join(estadoDir, ITENS);
  let buf;
  try {
    const st = fs.lstatSync(arquivo);
    if (!st.isFile() || st.isSymbolicLink()) return { estado: 'invalido', detalhe: 'o caminho da lista não é um arquivo comum' };
    if (st.size > MAX_ARQUIVO) return { estado: 'invalido', detalhe: 'a lista da revisão está grande demais' };
    buf = fs.readFileSync(arquivo);
  } catch (e) { return e && e.code === 'ENOENT' ? { estado: 'ausente', detalhe: 'a lista da revisão ainda não existe' } : { estado: 'invalido', detalhe: 'não consegui abrir a lista da revisão' }; }
  let dados;
  try { dados = JSON.parse(buf.toString('utf8').replace(/^﻿/, '')); } catch { return { estado: 'invalido', detalhe: 'a lista da revisão não é um JSON inteiro' }; }
  const p = [];
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) p.push('o arquivo não é um objeto');
  else if (dados.versao !== 1) p.push('versão desconhecida (esperada: 1)');
  else if (!Array.isArray(dados.itens)) p.push('"itens" não é uma lista');
  else if (dados.itens.length > 200) p.push('itens demais (o teto é 200)');
  else {
    const vistos = new Set();
    dados.itens.forEach((x, i) => {
      const onde = 'item ' + (i + 1);
      if (!x || typeof x !== 'object' || Array.isArray(x)) { p.push(onde + ': não é um objeto'); return; }
      if (typeof x.id !== 'string' || !RX_ID_ARQUIVO.test(x.id)) p.push(onde + ': id ausente ou fora do formato');
      else if (vistos.has(x.id)) p.push(onde + ': id repetido'); else vistos.add(x.id);
      if ((typeof x.titulo !== 'string' || !x.titulo.trim()) && (typeof x.neutro !== 'string' || !x.neutro.trim())) p.push(onde + ': sem título'); // o item reservado leva so a linha neutra
    });
  }
  if (p.length) return { estado: 'invalido', detalhe: p.slice(0, 3).join('; ') + (p.length > 3 ? '; e mais ' + (p.length - 3) : '') };
  return { estado: 'ok', dados };
}

function lerLinhas(arquivo) {
  let texto;
  try {
    const st = fs.statSync(arquivo), ini = Math.max(0, st.size - MAX_ARQUIVO), fd = fs.openSync(arquivo, 'r');
    try { const buf = Buffer.alloc(st.size - ini); fs.readSync(fd, buf, 0, buf.length, ini); texto = buf.toString('utf8'); } finally { fs.closeSync(fd); }
    if (ini) texto = texto.slice(texto.indexOf('\n') + 1);
  } catch { return []; }
  const out = [];
  for (const l of texto.split('\n')) { if (!l.trim()) continue; try { const j = JSON.parse(l); if (j && typeof j === 'object' && !Array.isArray(j)) out.push(j); } catch {  } }
  return out;
}

function lerFora(dir) {
  const itens = new Map(), log = new Map(), lista0 = lerItens(dir);
  if (lista0.estado === 'ok') for (const x of lista0.dados.itens) itens.set(x.id, x);
  for (const l of lerLinhas(path.join(dir, LOG))) if (typeof l.linha === 'string' && RX_LINHA.test(l.linha)) log.set(l.linha, l);
  return { itens, log, respostas: lerLinhas(path.join(dir, RESPOSTAS)) };
}

const comDetalhe = x => DETALHE.some(k => (k === 'titulo' ? typeof x.titulo === 'string' && !!x.titulo.trim() && x.titulo.trim() !== (typeof x.neutro === 'string' ? x.neutro.trim() : '') : Array.isArray(x[k]) ? x[k].length > 0 : x[k] !== undefined && x[k] !== null && x[k] !== ''));



function dobrar(log, respostas, reservados, T, fora = null) {
  const validas = log.filter(l => l.por === 'ele' && typeof l.linha === 'string' && RX_LINHA.test(l.linha) && ACOES.includes(l.acao));
  const desfeitas = new Set(validas.filter(l => l.acao === 'desfazer' && typeof l.desfaz === 'string').map(l => l.desfaz));
  const resp = new Map(), real = l => (fora && l.reservado === true && fora.log.get(l.linha)) || {}, fechada = l => !fora && l.reservado === true;
  for (const r of respostas.concat(fora ? fora.respostas : [])) if (typeof r.linha === 'string' && typeof r.texto === 'string' && r.texto.trim()) resp.set(r.linha, r);
  const voce = new Map(), opinioes = new Map();
  for (const l of validas) {
    if (l.acao === 'desfazer' || desfeitas.has(l.linha)) continue;
    const ids = lista(l.itens).filter(x => typeof x === 'string');
    if (l.acao === 'opiniao') {
      const r = resp.get(l.linha), fechado = ids.some(id => reservados.has(id));
      const o = { linha: l.linha, destino: T(l.destino, 40), pergunta: T(l.pergunta, 300) || T(real(l).pergunta, 300) || (l.reservado === true ? 'Pergunta reservada: ' + RESERVADO + '.' : ''), quando: typeof l.quando === 'string' ? l.quando : null,
        resposta: r ? { de: T(r.de, 40) || T(l.destino, 40), texto: fechado ? 'Resposta pronta: ' + RESERVADO + '.' : T(r.texto, 1200), quando: typeof r.quando === 'string' ? r.quando : null } : null };
      for (const id of ids) { if (!opinioes.has(id)) opinioes.set(id, []); opinioes.get(id).push(o); }
      continue;
    }
    const id = ids[0]; if (!id) continue;
    if (l.acao === 'acho' && voce.has(id) && DECISOES.includes(voce.get(id).acao)) continue; // o comentario nao apaga a decisao
    voce.set(id, { acao: l.acao, quando: typeof l.quando === 'string' ? l.quando : null, texto: T(l.texto, MAX_TEXTO) || T(real(l).texto, MAX_TEXTO) || null, linha: l.linha, card: typeof l.card === 'string' && !fechada(l) ? l.card : null, opcao: l.opcao && typeof l.opcao === 'object' && !fechada(l) ? { indice: l.opcao.indice, label: T(l.opcao.label, 160) } : null });
  }
  return { voce, opinioes, desfeitas, validas };
}


function projetoDoCard(c) {
  const nome = N.normal([c.id, c.item].filter(s => typeof s === 'string').join(' ')), s = N.normal(c.sessao), pergunta = N.normal(c.pergunta);
  const lanc = /terminal|lancamento/;
  if (N.sessaoReservada(c) || /\bbots?\b/.test(s) || /\bbots?\b/.test(nome)) return 'automacao';
  if (/\bpainel\b/.test(nome)) return 'painel';
  if (lanc.test(nome) || /\bsite\b/.test(s)) return 'lancamento';
  if (/conteudo/.test(s) || /\bconteudo\b/.test(nome)) return 'criacao';
  if (/\bpainel\b/.test(pergunta)) return 'painel';
  if (lanc.test(pergunta)) return 'lancamento';
  return 'resto';
}
function cardDe(l, agora, m) {
  const c = l.cru, ops = Array.isArray(c.opcoes) ? c.opcoes.slice(0, 8) : [], T = m.texto, projeto = projetoDoCard(c);
  let rec = Number.isInteger(c.recomendada) && c.recomendada >= 0 && c.recomendada < ops.length ? c.recomendada : ops.findIndex(o => o && (o.recomendada === true || o.recommended === true));
  if (rec < 0) rec = ops.findIndex(o => o && /\b(?:recomendad[oa]|recommended)\b/i.test(typeof o.label === 'string' ? o.label : ''));
  const rotulo = v => T(String(v).replace(/\s*\((?:recomendad[oa]|recommended)\)\s*/i, ' ').replace(/\s{2,}/g, ' '), 160);
  const opcoes = ops.map((o, i) => (o && typeof o === 'object' && N.rotuloGravado(o.label) ? { indice: i, label: rotulo(o.label), descricao: T(o.descricao, 300), recomendada: i === rec, gravado: N.rotuloGravado(o.label) } : null))
    .filter(Boolean).sort((a, b) => Number(b.recomendada) - Number(a.recomendada) || a.indice - b.indice);
  const tipo = N.normal(c.tipo).trim(), criado = N.tempoTela(c.criado, agora);
  return {
    id: typeof c.id === 'string' && RX_ID_ARQUIVO.test(c.id) ? c.id : l.arquivo.replace(/\.json$/i, ''), opaco: String(N.chaveOpaca(l.arquivo)).replace(/[^\w.-]/g, '').slice(0, 60) || sha1(l.arquivo).slice(0, 16),
    sessao: T(c.sessao, 60) || '?', projeto, fechado: m.cardFechado(c, !!l.duplicado, projeto), // null = aparece inteiro; senao o motivo de virar 1 linha
    sensivel: !!m.cardFechado(c, !!l.duplicado, projeto) || !!FECHADA.cardFechado(c, !!l.duplicado, projeto), // assunto reservado: o texto livre dele sobre este card nunca vai para o estado
    perigoso: c.perigoso === true || TIPOS_PERIGOSOS.has(tipo) || N.perigoso(c), // o "perigoso": false declarado no card nunca baixa a regra (a mesma do Espera você)
    pergunta: T(c.pergunta, MAX_PERGUNTA) || '?', opcoes, onde: N.ondeResponder(c), criado: criado.abs || null, ordem: Number.isFinite(criado.t) ? criado.t : Infinity
  };
}
function lerCards(cardsDir, agora, m = mascara(false)) {
  let lidos, ilegiveis;
  try { ({ lidos, ilegiveis } = N.lerPasta(cardsDir)); } catch (e) { return { estado: e && e.code === 'ENOENT' ? 'ausente' : 'falha', abertos: [], ilegiveis: 0 }; }
  const subs = N.substituidos(lidos), abertos = [];
  for (const l of lidos) {
    const c = l.cru;
    if (c.exemplo === true || N.respondido(c) || N.fechado(c, subs) || RX_FORA.test(N.normal(c.status)) || RX_FORA.test(N.normal(c.estado))) continue;
    abertos.push(cardDe(l, agora, m));
  }
  abertos.sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id));
  return { estado: 'ok', abertos, ilegiveis };
}
const cardTela = c => ({ id: c.id, sessao: c.sessao, pergunta: c.pergunta, perigoso: c.perigoso, onde: c.onde, criado: c.criado, opcoes: c.opcoes.map(o => ({ indice: o.indice, label: o.label, descricao: o.descricao, recomendada: o.recomendada })) });



function montar(args) { return SIGILO.rodarComo(!!args && args.dono === true, () => montarDentro(args)); }

function montarDentro({ estadoDir, cardsDir, regras, agora = new Date(), cardsLidos = null, dono = false, reservadoDir = null }) {
  const m = mascara(dono), T = m.texto;
  const fonteItens = lerItens(estadoDir), cards = cardsLidos || lerCards(cardsDir, agora, m), midia = new Map(), interno = new Map();
  const cru = fonteItens.estado === 'ok' ? fonteItens.dados.itens : [];
  const fora = m.dono ? (reservadoDir ? lerFora(reservadoDir) : { itens: new Map(), log: new Map(), respostas: [] }) : null;
  let reservadoNoEstado = 0;
  const porId = new Map(cards.abertos.map(c => [c.id, c])), presos = new Set();
  function midiaTela(idItem, m) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
    const ok = midiaSegura(m.arquivo, regras), legenda = T(m.legenda, 140) || null;
    if (!ok) return { tipo: m.tipo === 'video' ? 'video' : 'imagem', falta: true, src: null, poster: null, legenda };
    const chave = sha1(idItem + '\n' + ok.real).slice(0, 24); midia.set(chave, ok);
    let poster = null;
    if (ok.tipo.startsWith('video/')) { const capa = midiaSegura(m.poster, regras); if (capa && capa.tipo.startsWith('image/')) { const k = sha1(idItem + '\n' + capa.real).slice(0, 24); midia.set(k, capa); poster = '/api/revisao/midia/' + k; } }
    return { tipo: ok.tipo.startsWith('video/') ? 'video' : 'imagem', falta: false, src: '/api/revisao/midia/' + chave, poster, legenda };
  }
  const base = (id, tipo, projeto, sessao) => ({ id, tipo, projeto, sessao, titulo: '?', mudou: null, selo: null, espera: null, reservado: false, pares: [], midia: [], critico: null, textos: [], cards: [], voce: null, opinioes: [] });
  const itens = [];
  for (const x0 of cru) {
    const projeto = PROJETOS.some(p => p.id === x0.projeto) ? x0.projeto : 'resto', sensivel = FECHADA.itemFechado(x0, projeto);
    if (sensivel && comDetalhe(x0)) reservadoNoEstado++;

    const det = sensivel && fora ? fora.itens.get(x0.id) : null, x = det ? { ...x0, ...Object.fromEntries(DETALHE.filter(k => det[k] !== undefined).map(k => [k, det[k]])) } : x0;
    const it = base(x.id, 'item', projeto, T(x.sessao, 40) || '?'), dentroDele = new Map();
    if (m.itemFechado(x, projeto)) {
      const neutro = typeof x.neutro === 'string' ? x.neutro.trim() : '';
      it.reservado = true; it.espera = RESERVADO; it.titulo = neutro && !RX_VALOR.test(neutro) && !RX_ENDERECO.test(neutro) ? T(neutro, 160) : 'Item reservado';
    } else {
      it.titulo = T(x.titulo, 160) || T(x.neutro, 160) || '?'; it.mudou = T(x.mudou, 260) || null; it.selo = SELOS.includes(x.selo) ? x.selo : null; it.espera = T(x.espera, 260) || null;
      it.pares = lista(x.pares).slice(0, 6).filter(p => p && typeof p === 'object').map(p => ({ rotulo: T(p.rotulo, 60) || null, formato: ['16x9', '9x16'].includes(p.formato) ? p.formato : 'livre', antes: midiaTela(x.id, p.antes), depois: midiaTela(x.id, p.depois) })).filter(p => p.antes || p.depois);
      it.midia = lista(x.midia).slice(0, 12).map(m => midiaTela(x.id, m)).filter(Boolean);
      const c = x.critico && typeof x.critico === 'object' ? x.critico : null, notas = c ? lista(c.notas).slice(0, 12).filter(n => Array.isArray(n) && n.length >= 2).map(n => [T(n[0], 40), T(n[1], 10) || '?', n.length > 2 ? T(n[2], 10) || '?' : null]) : [];
      if (notas.length) it.critico = { quem: T(c.quem, 80) || null, colunas: [T(lista(c.colunas)[0], 60) || 'Antes', T(lista(c.colunas)[1], 60) || 'Agora'], notas, obs: T(c.obs, 700) || null };
      it.textos = lista(x.textos).slice(0, 12).filter(t => t && typeof t === 'object' && typeof t.texto === 'string' && t.texto.trim()).map(t => ({ titulo: T(t.titulo, 120) || null, texto: T(t.texto, 12000), legenda: T(t.legenda, 260) || null, imagem: t.imagem ? midiaTela(x.id, t.imagem) : null }));
      for (const idCard of lista(x.cards).slice(0, 8)) {
        const c2 = typeof idCard === 'string' ? porId.get(idCard.replace(/\.json$/i, '')) : null;
        if (!c2 || c2.fechado || presos.has(c2.id)) continue;
        presos.add(c2.id); dentroDele.set(c2.id, c2); it.cards.push(cardTela(c2));
      }
    }
    interno.set(it.id, { tipo: 'item', reservado: it.reservado, sensivel: sensivel || it.reservado, cards: dentroDele });
    itens.push(it);
  }
  const fechados = new Map(); // cards fora da tela: 1 linha por assunto e sessao (no modo dono tambem por motivo), sem pergunta, opcao nem nome de arquivo
  for (const c of cards.abertos) {
    if (presos.has(c.id)) continue;
    if (c.fechado) { const k = (m.dono ? c.fechado + '\n' : '') + c.projeto + '\n' + c.sessao; if (!fechados.has(k)) fechados.set(k, []); fechados.get(k).push(c); continue; }
    const id = 'card:' + c.id, it = base(id, 'card', c.projeto, c.sessao);
    it.titulo = c.pergunta; it.selo = c.perigoso ? 'COORDENADOR' : 'sim'; it.cards = [cardTela(c)]; // o perigoso tem selo proprio: responde-se na COORDENADOR
    interno.set(id, { tipo: 'card', reservado: false, sensivel: c.sensivel, perigoso: c.perigoso, cards: new Map([[c.id, c]]) });
    itens.push(it);
  }
  for (const [k, l] of fechados) {
    const f = FORA[l[0].fechado] || FORA.reservado, id = 'card:reservados-' + sha1(k).slice(0, 10), it = base(id, 'card', l[0].projeto, l[0].sessao);
    it.reservado = true; it.titulo = l.length === 1 ? f.um : l.length + f.varios; it.espera = f.espera;
    interno.set(id, { tipo: 'card', reservado: true, sensivel: true, cards: new Map() }); itens.push(it);
  }
  const reservados = new Set(itens.filter(i => i.reservado).map(i => i.id));
  const d = dobrar(lerLinhas(path.join(estadoDir, LOG)), lerLinhas(path.join(estadoDir, RESPOSTAS)), reservados, T, fora);
  for (const it of itens) { it.voce = d.voce.get(it.id) || null; it.opinioes = d.opinioes.get(it.id) || []; }
  const grupos = PROJETOS.map(p => ({ projeto: p.id, titulo: p.titulo, sub: p.sub, itens: itens.filter(i => i.projeto === p.id) }));
  const fonte = { itens: fonteItens.estado, detalhe: fonteItens.detalhe || null, solucao: fonteItens.estado === 'ok' ? null : SOLUCAO, atualizado: fonteItens.estado === 'ok' && typeof fonteItens.dados.atualizado === 'string' ? fonteItens.dados.atualizado : null, por: fonteItens.estado === 'ok' ? T(fonteItens.dados.por, 40) || null : null, cards: cards.estado, ilegiveis: cards.ilegiveis, reservadoNoEstado };
  return { payload: { ok: true, dono: m.dono, fonte, grupos, total: itens.length, destinos: DESTINOS, perguntas: PERGUNTAS, assinatura: sha1(JSON.stringify([fonte, grupos, m.dono])) }, interno, midia, dobra: d };
}



function create({ root, dir, port, now = Date.now, soLeitura = false, painelDir = __dirname, cardsDir, midiaDirs, dono, reservadoDir } = {}) {
  const ehDono = typeof dono === 'function' ? dono : () => SIGILO.aberto();
  const porta = Number(port);
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) throw Error('porta invalida');
  const pasta = dir || process.env.PAINEL_REVISAO_DIR || (root ? path.join(root, 'estado') : null);
  if (!pasta) throw Error('pasta do estado ausente');
  const estadoDir = path.resolve(pasta), pastaCards = path.resolve(cardsDir || path.join(estadoDir, 'cards')), log = path.join(estadoDir, LOG);
  const pastasMidia = midiaDirs || (process.env.PAINEL_REVISAO_MIDIA ? process.env.PAINEL_REVISAO_MIDIA.split(';') : PASTAS_MIDIA);
  const painelReal = path.resolve(painelDir), pastaFora = pastaReservada(reservadoDir, estadoDir, painelReal); // null = sem pasta reservada; a pasta de verdade e conferida de novo a cada uso
  const hosts = new Set(['127.0.0.1:' + porta, 'localhost:' + porta]);
  const origens = new Set(['http://127.0.0.1:' + porta, 'http://localhost:' + porta]);
  const token = crypto.randomBytes(24).toString('hex');
  const tokenOk = req => { const t = req.headers['x-revisao-token']; return typeof t === 'string' && t.length === token.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(token)); };
  const ctJson = req => String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() === 'application/json';
  let memo = {}; // so a pasta dos cards (centenas de arquivos) e repetida por 2 s no GET, 1 leitura por modo (dono ou nao: uma nunca serve a outra); a lista, o log e as respostas sao lidos toem uso, e toda escrita le tudo de novo
  function tudo(fresco) {
    const agora = now(), aberto = ehDono() === true, k = aberto ? 'dono' : 'outros';
    return SIGILO.rodarComo(aberto, () => {
      const velho = memo[k];
      if (fresco || !velho || agora - velho.em < 0 || agora - velho.em >= 2000) memo[k] = { em: agora, cards: lerCards(pastaCards, new Date(agora), mascara(aberto)) };
      return montar({ estadoDir, cardsDir: pastaCards, regras: regrasDe(pastasMidia), agora: new Date(agora), cardsLidos: memo[k].cards, dono: aberto, reservadoDir: aberto ? pastaReservadaViva(pastaFora, estadoDir, painelReal, false) : null }); // fechado nunca abre a pasta reservada
    });
  }
  const ler = () => ({ ...tudo(true).payload, soLeitura: !!soLeitura, lidoEm: new Date(now()).toISOString() });

  function acrescentar(arquivo, obj) {
    let antes = '';
    try { const st = fs.statSync(arquivo); if (st.size) { const fd = fs.openSync(arquivo, 'r'), b = Buffer.alloc(1); try { fs.readSync(fd, b, 0, 1, st.size - 1); } finally { fs.closeSync(fd); } if (b[0] !== 10) antes = '\n'; } } catch {  }
    fs.appendFileSync(arquivo, antes + JSON.stringify(obj) + '\n', 'utf8');
  }


  function agir(j) {
    if (soLeitura) throw erro('so-leitura');
    const campos = j && typeof j === 'object' && !Array.isArray(j) ? Object.keys(j) : null;
    if (!campos || campos.some(k => !['acao', 'itens', 'texto', 'destino', 'pergunta', 'card', 'opcao', 'desfaz'].includes(k)) || !ACOES.includes(j.acao)) throw erro('corpo');
    const acao = j.acao, cruTexto = j.texto === undefined || j.texto === null ? '' : j.texto;
    if (typeof cruTexto !== 'string' || cruTexto.length > MAX_TEXTO) throw erro('corpo');
    const texto = cruTexto.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim() || null;
    const quando = new Date(now()).toISOString(), linha = 'r-' + now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
    const m = tudo(true);
    let registro, fora = null;
    if (acao === 'desfazer') {
      if (typeof j.desfaz !== 'string' || !RX_LINHA.test(j.desfaz) || j.itens !== undefined) throw erro('corpo');
      const alvo = m.dobra.validas.find(l => l.linha === j.desfaz && l.acao !== 'desfazer');
      if (!alvo) throw erro('linha');
      if (m.dobra.desfeitas.has(alvo.linha)) throw erro('desfeita');
      if (now() - Date.parse(alvo.quando) > DESFAZER_MS) throw erro('tarde');
      registro = { linha, quando, por: 'ele', acao, item: typeof alvo.item === 'string' ? alvo.item : null, itens: lista(alvo.itens), texto: null, destino: null, pergunta: null, card: null, opcao: null, desfaz: alvo.linha };
    } else {
      const itens = j.itens;
      if (!Array.isArray(itens) || !itens.length || itens.length > 20 || itens.some(x => typeof x !== 'string' || !RX_ITEM.test(x)) || new Set(itens).size !== itens.length) throw erro('corpo');
      if (acao !== 'opiniao' && itens.length !== 1) throw erro('corpo');
      for (const id of itens) if (!m.interno.has(id)) throw erro('id');
      const alvo = m.interno.get(itens[0]);
      let destino = null, pergunta = null, card = null, opcao = null, cardSensivel = false;
      if (acao === 'opiniao') {
        if (!DESTINOS.includes(j.destino)) throw erro('destino');
        pergunta = typeof j.pergunta === 'string' ? j.pergunta.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim() : '';
        if (!pergunta || pergunta.length > 300) throw erro('pergunta');
        destino = j.destino;
      } else {
        if (alvo.tipo === 'card' && alvo.perigoso && ['aprovo', 'refazer', 'acho', 'opcao'].includes(acao)) throw erro('perigoso');
        if (alvo.tipo === 'card' && alvo.reservado && !['depois', 'trazer-card'].includes(acao)) throw erro('reservado');
        if (alvo.tipo === 'card' && ['aprovo', 'refazer'].includes(acao)) throw erro('card-opcao');
        if (acao === 'acho' && !texto) throw erro('corpo');
        if (acao === 'opcao' || acao === 'trazer-card') {
          if (acao === 'trazer-card' && alvo.reservado && j.card === undefined) card = null;
          else {
            if (typeof j.card !== 'string') throw erro('corpo');
            const c = alvo.cards.get(j.card);
            if (!c) throw erro('card');
            card = c.id; cardSensivel = c.sensivel === true;
            if (acao === 'opcao') {
              if (c.perigoso) throw erro('perigoso');
              const o = Number.isInteger(j.opcao) ? c.opcoes.find(x => x.indice === j.opcao) : null;
              if (!o) throw erro('opcao');
              opcao = { indice: o.indice, label: o.gravado };
            }
          }
        }
      }
      registro = { linha, quando, por: 'ele', acao, item: itens[0], itens, texto: acao === 'opiniao' ? null : texto, destino, pergunta, card, opcao, desfaz: null };


      if (cardSensivel || itens.some(id => m.interno.get(id).sensivel === true)) {
        const livre = pergunta && !PERGUNTAS.includes(pergunta) ? pergunta : null;
        if (registro.texto || livre) fora = { linha, quando, texto: registro.texto, pergunta: livre };
        registro = { ...registro, texto: null, pergunta: livre ? null : pergunta, reservado: true };
      }
    }
    if (fora) { // primeiro fora do estado: sem a pasta reservada nada e gravado
      const dirFora = pastaReservadaViva(pastaFora, estadoDir, painelReal, true);
      if (!dirFora) throw erro('sem-pasta-reservada');
      try { acrescentar(path.join(dirFora, LOG), fora); } catch { throw erro('sem-pasta-reservada'); }
    }
    try { acrescentar(log, registro); } catch { throw erro('gravar'); }
    memo = {};
    return { ok: true, linha, quando, acao };
  }

  async function corpo(req) {
    const partes = []; let tam = 0;
    for await (const p of req) { const b = Buffer.isBuffer(p) ? p : Buffer.from(p); tam += b.length; if (tam > MAX_CORPO) return { grande: true }; partes.push(b); }
    return { texto: Buffer.concat(partes).toString('utf8') };
  }
  function servirMidia(req, res, send, headers, chave) {
    let m = RX_CHAVE.test(chave) ? tudo(false).midia.get(chave) : null;
    if (!m && RX_CHAVE.test(chave)) m = tudo(true).midia.get(chave);
    const ok = m ? midiaSegura(m.real, regrasDe(pastasMidia)) : null; // confere de novo na hora de entregar
    if (!ok) { send(404, { ok: false, erro: 'midia' }); return; }
    if (!res || typeof res.writeHead !== 'function') { send(200, fs.readFileSync(ok.real), ok.tipo); return; }
    let ini = 0, fim = ok.tamanho - 1, status = 200;
    const faixa = req.headers.range;
    if (faixa) {
      const mm = /^bytes=(\d*)-(\d*)$/.exec(String(faixa));
      if (mm && (mm[1] || mm[2])) {
        if (mm[1]) { ini = Number(mm[1]); if (mm[2]) fim = Math.min(Number(mm[2]), fim); } else ini = Math.max(0, ok.tamanho - Number(mm[2]));
        status = 206;
      }
      if (!mm || (!mm[1] && !mm[2]) || ini > fim || ini >= ok.tamanho) { res.writeHead(416, { ...(headers || {}), 'Content-Range': 'bytes */' + ok.tamanho }); res.end(); return; }
    }
    res.writeHead(status, { ...(headers || {}), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Type': ok.tipo, 'Content-Length': fim - ini + 1, 'Accept-Ranges': 'bytes', ...(status === 206 ? { 'Content-Range': 'bytes ' + ini + '-' + fim + '/' + ok.tamanho } : {}) });
    if (req.method === 'HEAD') { res.end(); return; }
    const fluxo = fs.createReadStream(ok.real, { start: ini, end: fim });
    fluxo.on('error', () => res.destroy()); res.on('close', () => fluxo.destroy()); fluxo.pipe(res);
  }

  async function handle(req, url, { send, res, example = false, headers } = {}) {
    const p = url.pathname;
    if (req.method === 'GET' && assets.includes(p.slice(1))) {
      try { send(200, fs.readFileSync(path.join(painelDir, p.slice(1))), p.endsWith('.css') ? 'text/css' : 'text/javascript'); } catch { send(503, { ok: false, erro: 'arquivo' }); }
      return true;
    }
    const naMidia = p.startsWith('/api/revisao/midia/'), agindo = p === '/api/revisao/acao';
    if (p !== '/api/revisao' && !agindo && !naMidia) return false;
    if (!loopback(req.socket && req.socket.remoteAddress) || !hosts.has(req.headers.host)) { send(403, { ok: false, erro: 'so-local', mensagem: 'A revisão só abre neste computador.' }); return true; }
    if (naMidia) {
      if (req.method !== 'GET' && req.method !== 'HEAD') { send(405, { ok: false, erro: 'metodo' }); return true; }
      if (example) { send(404, { ok: false, erro: 'midia' }); return true; }
      servirMidia(req, res, send, headers, p.slice('/api/revisao/midia/'.length));
      return true;
    }
    if (req.method !== (agindo ? 'POST' : 'GET')) { send(405, { ok: false, erro: 'metodo' }); return true; }
    if (!agindo) {
      if (example) { send(200, { ok: false, example: true }); return true; }
      try { send(200, { ...tudo(false).payload, token, soLeitura: !!soLeitura, lidoEm: new Date(now()).toISOString() }); }
      catch { send(503, { ok: false, erro: 'leitura', solucao: 'peça à COORDENADOR para reiniciar o painel' }); }
      return true;
    }
    if (example) { send(403, { ok: false, erro: 'exemplo', mensagem: 'No exemplo a revisão não grava.' }); return true; }
    if (soLeitura) { send(403, { ok: false, erro: 'so-leitura', mensagem: 'Esta cópia do painel é só leitura.' }); return true; }
    const site = req.headers['sec-fetch-site'];
    if (!origens.has(req.headers.origin) || (site !== undefined && site !== 'same-origin')) { send(403, { ok: false, erro: 'origem', mensagem: 'A revisão só grava de dentro do painel.' }); return true; }
    if (!ctJson(req)) { send(403, { ok: false, erro: 'tipo' }); return true; }
    if (!tokenOk(req)) { send(403, { ok: false, erro: 'token', mensagem: 'O painel reiniciou: a tela pede a chave de novo.' }); return true; }
    let c;
    try { c = await corpo(req); } catch { send(400, { ok: false, erro: 'json' }); return true; }
    if (c.grande) { send(413, { ok: false, erro: 'grande' }); return true; }
    let j;
    try { j = JSON.parse(c.texto); } catch { send(400, { ok: false, erro: 'json' }); return true; }
    try { send(200, agir(j)); }
    catch (e) {
      const codigo = e && e.codigo;
      const RESP = {
        corpo: [400, 'Pedido fora do formato.'], destino: [400, 'Escolha para quem perguntar.'], pergunta: [400, 'Escreva ou escolha a pergunta.'], opcao: [400, 'Essa opção não existe no card.'],
        'card-opcao': [400, 'Card se resolve pela opção.'], id: [404, 'Esse item saiu da lista.'], card: [404, 'Esse card não está mais aberto neste item.'], linha: [404, 'Não achei o que desfazer.'],
        desfeita: [409, 'Isso já foi desfeito.'], tarde: [409, 'Passou do tempo de desfazer. Marque de novo como quiser.'], perigoso: [403, NA_COORDENADOR], reservado: [403, 'Este card fica fora do painel: responda no chat da sessão.'], 'so-leitura': [403, 'Esta cópia do painel é só leitura.'], 'sem-pasta-reservada': [409, SEM_PASTA]
      };
      const r = RESP[codigo];
      if (r) send(r[0], { ok: false, erro: codigo, mensagem: r[1] }); else send(500, { ok: false, erro: 'gravar', mensagem: 'Não consegui gravar. Tente de novo.' });
    }
    return true;
  }

  return { handle, agir, ler, token, log, dir: estadoDir, cardsDir: pastaCards, reservadoDir: pastaFora };
}

module.exports = { create, assets, montar, mascara, midiaSegura, regrasDe, lerItens, pastaReservada, PROJETOS, DESTINOS, PERGUNTAS, SELOS, ACOES, ITENS, LOG, RESPOSTAS, SOLUCAO, PASTAS_MIDIA, RESERVADO, NA_COORDENADOR };
