'use strict';
// Nucleo dos cards do painel (itens 72 e 100 da fila do Codex), sem HTTP.
// Le estado/cards/*.json so para ler; as unicas escritas no estado sao a resposta no proprio card (SO respondido
// "<ISO> opcao N (pelo painel[, falta o ok no chat])" e respondidoEm "<ISO>", do Get-Date), depois do backup,
// e 1 linha em estado/recados-do-painel.md para a sessao dona do card agir.
// Card perigoso ou restrito nunca grava resposta ou intencao pelo painel: abre o chat do executor.
// Passo a passo (feito por passo) e registro de cliques ficam em dadosDir, nunca no estado.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const NOME_CARD = /^[\w][\w.-]{0,115}\.json$/;
const ID_CARD = /^[\w.-]{1,100}$/;
const LIMITE_CARD = 64000;
const PASTA_PROIBIDA = /(?:PRIVADO|_SECRETS|backup-privado|(?:^|[\\/])\.env|[\\/]seed(?:[\\/.]|$))/i;
// Tipos com fluxo proprio na tela (passos: marcar cada passo). Os outros tipos com opcao respondem como decisao.
const TIPOS_LIVRES = new Set(['decisao', 'passos']);
// Tipos perigosos por natureza somente permitem responder no chat do executor.
const TIPOS_PERIGOSOS = new Set(['subida', 'env', 'env-dinheiro', 'tela-dinheiro', 'dinheiro', 'deploy']);
// Assunto perigoso: sem escrita pelo painel.
const SO_NO_CHAT = /\b(?:sub(?:ir|ida|idas|ido|indo|a|o|imos|iu|am|irem)|sob(?:e|em)|ups?|no ar|deploys?|redeploys?|rollback|pré-aprovação|publica\w*|main|hospedagem|push|merge|env|variave(?:l|is)|chaves?|flags?|segredos?|senhas?|tokens?|keys?|secrets?|passwords?|dinheiro|money|saque|withdraw|seed|private key|pagamentos?|pag(?:o|a|ar|ou)|compr\w*|vend\w*|credito|custo|premio|transferencias?)\b|r\$/;
const NOME_ENV = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]{2,}\b/;
const FLAG_PERIGO = /perig|sensiv|restrit|chat|confirm|aprov/i;
const DOT_TEXTO_PAINEL = /\b(env|chave|hospedagem|push|deploy|merge|dinheiro|money|saque|withdraw|seed|private key|pagamento|transferencia)\b/i;
const DOT_TEXTO = /\b(?:subir|subida|deploy(?:ment)?|publicar|publicacao|hospedagem|push|merge|main|env|environment|ambiente|chave|keys?|secret|segredo|senha|password|seed|contrato|contract|dinheiro|money|funds?|fundos|financeir\w*|pagamento\w*|payment\w*|comprar|compra\w*|assinar|assinatura|sign|transfer\w*|saque\w*|withdraw\w*|gastar|custo|credito|credit|approval|aprovacao|autorizar|autorizacao)\b/i;
const DOT_FLAG = /(?:sensiv|sensitive|aprovar.?no.?chat|confirmacao.?chat|requires.?chat|confirmation|approval|autoriz|deploy|subir|hospedagem|push|merge|env|chave|key|secret|money|dinheiro|financ|pagamento|payment|transfer|withdraw|saque|seed|restrit|perig|danger|executor)/i;
// Card inteiro fora da tela (sigilo): o painel so diz onde responder.
const RESTRITO = /PRIVADO|_SECRETS|backup-privado|seed phrase|mnemonic|private key|chave privada|BEGIN [A-Z ]*PRIVATE KEY/i;
// Comando com cara de dado sensivel nao vira botao de copiar.
const COMANDO_SENSIVEL = /0x[a-fA-F0-9]{40}|\b[a-fA-F0-9]{64}\b|[1-9A-HJ-NP-Za-km-z]{32,44}|:\/\/[^\s/@]+:[^\s/@]+@|[?&](?:key|token|apikey|api_key|access_token|password|senha)=|\bsk-[A-Za-z0-9]/i;

// Caracteres especiais montados por codigo (o fonte fica so com ASCII; travessao nunca aparece escrito aqui).
const CH = n => String.fromCharCode(n);
const TRAV = CH(8211) + CH(8212);
const RX_TRAV_ESPACO = new RegExp('\\s*[' + TRAV + ']\\s*', 'g');
const RX_TRAV = new RegExp('[' + TRAV + ']', 'g');
const RX_ROTULO = new RegExp('[\\r\\n|"' + TRAV + ']', 'g');
const RX_ACENTO = new RegExp('[' + CH(0x300) + '-' + CH(0x36f) + ']', 'g');
const RETIC = CH(8230);
function semBom(t) { return t.charCodeAt(0) === 0xFEFF ? t.slice(1) : t; }

function erro(codigo) { const e = new Error(codigo); e.codigo = codigo; return e; }
function normal(v) { return String(v ?? '').normalize('NFD').replace(RX_ACENTO, '').toLowerCase(); }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function texto(v) { return typeof v === 'string' ? v : (typeof v === 'number' ? String(v) : ''); }

// Texto para a tela: sem travessao, endereco encurtado, URL com credencial escondida.
function limpar(v, max = 600) {
  let s = texto(v).replace(/\r\n?/g, '\n').trim();
  s = s.replace(RX_TRAV_ESPACO, ', ');
  s = s.replace(/0x[a-fA-F0-9]{40}/g, a => a.slice(0, 6) + RETIC + a.slice(-4));
  s = s.replace(/\b[a-fA-F0-9]{64}\b/g, a => a.slice(0, 6) + RETIC);
  s = s.replace(/(?<![\w/])[1-9A-HJ-NP-Za-km-z]{32,44}(?![\w])/g, a => (/[0-9]/.test(a) && /[A-Z]/.test(a) && /[a-z]/.test(a)) ? a.slice(0, 4) + RETIC + a.slice(-4) : a);
  s = s.replace(/(:\/\/)[^\s/@]+:[^\s/@]+@/g, '$1***@').replace(/([?&](?:key|token|apikey|api_key|access_token|password|senha)=)[^\s&]+/gi, '$1***');
  s = PESSOAS_F2.mascarar(s);
  return s.length > max ? s.slice(0, max - 1).trimEnd() + RETIC : s;
}
const PESSOAS_F2 = require('./sigilo-pessoas.cjs');
// Sessao reservada (a mesma regra do claude-atividade.cjs, SESSOES_RESERVADAS): o card dela nao mostra pergunta, opcao, passo nem resposta.
const RESERVADAS = (() => { try { return [...require('./claude-atividade.cjs').SESSOES_RESERVADAS]; } catch { return ['ASSISTENTE']; } })();
function sessaoReservada(c) {
  const s = texto(c && c.sessao), id = texto(c && c.id);
  return RESERVADAS.some(r => new RegExp('\\b' + r + '\\b', 'i').test(s) || new RegExp('^' + r + '-', 'i').test(id));
}
// /api/estado, /api/pc-cards). Restrito e reservado: so a sessao, a hora e uma chave opaca no lugar do arquivo e do id.
function paraTela(c) { const b = bloqueio(c); return b !== 'restrito' && (b !== 'reservado' || PESSOAS_F2.aberto()); } // fatia 10: reservado aparece so no modo dono; restrito nunca
function chaveOpaca(nome) { return PESSOAS_F2.chaveOpaca(nome); }
// ou o card que outro aponta em "substitui". Fechado sem resposta nao espera ninguem: sai do "Espera você" e da meta.
const RX_FECHADO = /^\s*(?:substitu|anulad|encerrad|cancelad)/;
function idSubstituido(v) { const m = /^\s*([\w][\w.-]{0,115})/.exec(texto(v)); return m ? m[1].replace(/\.json$/i, '').toLowerCase() : ''; }
function substituidos(lidos) {
  const out = new Set();
  for (const l of lidos || []) { const v = l && l.cru ? l.cru.substitui : null; for (const x of Array.isArray(v) ? v : [v]) { const id = idSubstituido(x); if (id) out.add(id); } }
  return out;
}
function fechado(c, subs) {
  if (!c || typeof c !== 'object') return false;
  if (RX_FECHADO.test(normal(c.status)) || RX_FECHADO.test(normal(c.estado))) return true;
  if (texto(c.substituidoPor).trim() || (c.anulado && c.anulado !== false)) return true;
  const id = texto(c.id).toLowerCase();
  return !!(subs && id && subs.has(id));
}
// Rotulo gravado em resposta: igual ao que a 3250 grava (sem quebra de linha, aspas, barra vertical ou travessao).
function rotuloGravado(v) { return texto(v).replace(RX_ROTULO, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 200); }
function rotuloTela(v) { return limpar(texto(v).replace(/\s*\((?:recomendad[oa]|recommended)\)\s*/i, ' ').replace(/\s{2,}/g, ' '), 160); }

function respondido(c) {
  return !!(c.respondido || (typeof c.resposta === 'string' && c.resposta.trim()) || c.respondida || /^(respondido|respondida|feito)$/i.test(texto(c.estado)));
}

function familia(sessao) { return /codex/i.test(texto(sessao)) ? 'codex' : 'claude'; }

// Onde o dono responde quando o card nao vale pelo painel: o chat de quem executa.
function ondeResponder(c) {
  const link = texto(c.link_sessao);
  const m = /\bchat d[aoe]s? ([^,;()\n]+)/i.exec(link);
  if (m) return 'chat da ' + limpar(m[1], 60).trim();
  const s = limpar(texto(c.sessao) || link, 60).trim();
  if (!s) return 'chat de quem perguntou';
  if (/^codex$/i.test(s)) return 'chat do Codex';
  return 'chat da ' + s;
}

function opcoesDe(c) { return Array.isArray(c.opcoes) ? c.opcoes.slice(0, 8) : []; }

function indiceRecomendada(c, opcoes) {
  for (const chave of ['recomendada', 'recommended']) {
    if (Number.isInteger(c[chave]) && c[chave] >= 0 && c[chave] < opcoes.length) return c[chave];
  }
  const marcada = opcoes.findIndex(o => o && (o.recomendada === true || o.recommended === true));
  if (marcada >= 0) return marcada;
  return opcoes.findIndex(o => o && /\b(?:recomendad[oa]|recommended)\b/i.test(texto(o.label)));
}

function passosDe(c) {
  if (!Array.isArray(c.passos)) return [];
  const out = [];
  for (const p of c.passos.slice(0, 12)) {
    if (typeof p === 'string') { const t = limpar(p, 300); if (t) out.push({ texto: t }); continue; }
    if (!p || typeof p !== 'object' || Array.isArray(p)) continue;
    const t = limpar(p.texto || p.faca, 300);
    if (!t) continue;
    const passo = { texto: t };
    for (const [de, para] of [['onde', 'onde'], ['botao', 'botao'], ['aparece', 'aparece'], ['naoMexer', 'naoMexer'], ['nao_mexer', 'naoMexer']]) {
      const v = limpar(p[de], 240); if (v && !passo[para]) passo[para] = v;
    }
    const cmd = texto(p.comando).trim();
    if (cmd) {
      if (COMANDO_SENSIVEL.test(cmd) || cmd.length > 400) passo.comandoRetido = true;
      else passo.comando = cmd.replace(RX_TRAV, '-');
    }
    const mini = texto(p.miniatura);
    if (/^[\w][\w.-]{0,80}\.(?:png|jpe?g|webp)$/i.test(mini)) passo.miniatura = mini;
    out.push(passo);
  }
  return out;
}
// A marcacao de "feito" vale para esta lista de passos; se a sessao trocar os passos, a marcacao zera.
function chavePassos(passos) { return sha256(Buffer.from(JSON.stringify(passos), 'utf8')).slice(0, 32); }

function assuntoDe(c) {
  const ops = opcoesDe(c), passos = passosDe(c);
  return normal([c.tipo, c.pergunta, c.assunto,
    ...ops.map(o => o && typeof o === 'object' ? texto(o.label) + ' ' + texto(o.descricao) : ''),
    ...passos.map(p => [p.texto, p.onde, p.botao, p.aparece, p.naoMexer, p.comando].filter(Boolean).join(' '))].join(' '));
}
function opcoesValidas(c) { return opcoesDe(c).filter(o => o && typeof o === 'object' && rotuloGravado(o.label)); }
// Fluxo do card na tela: 'passos' (marcar passo a passo) ou 'decisao' (1 botao por opcao); '' = sem nada para clicar.
function fluxoDe(c) {
  const tipo = normal(c.tipo).trim();
  if (tipo === 'passos' && passosDe(c).length) return 'passos';
  return opcoesValidas(c).length ? 'decisao' : '';
}
// Por que o card nao vale pelo painel (null = vale com 1 clique). Pacote 8: so o restrito (sigilo) e o card sem opcao.
function bloqueio(c) {
  if (RESTRITO.test(JSON.stringify(c))) return 'restrito';
  if (sessaoReservada(c)) return 'reservado';
  if (!fluxoDe(c)) return 'sem-opcoes';
  return null;
}
function flagPerigo(c) {
  if (!c || typeof c !== 'object') return false;
  return Object.entries(c).some(([chave, valor]) => (valor !== false && (FLAG_PERIGO.test(normal(chave)) || DOT_FLAG.test(normal(chave)))) ||
    (valor && typeof valor === 'object' && flagPerigo(valor)));
}
// Card inteiro: tambem nota, acao, flags e nome cru de env. Tipos fora de decisao/passos pedem o ok no chat.
// Flags de perigo com tipo malformado tambem bloqueiam o clique.
function perigoso(c) {
  const cru = JSON.stringify(c);
  const dobrado = normal(cru);
  return flagPerigo(c) || !TIPOS_LIVRES.has(normal(c.tipo).trim()) || TIPOS_PERIGOSOS.has(normal(c.tipo).trim()) ||
    SO_NO_CHAT.test(dobrado) || DOT_TEXTO_PAINEL.test(dobrado) || DOT_TEXTO.test(dobrado) || NOME_ENV.test(cru);
}
function avisoPerigo(c) { return 'Decisão perigosa: vale só com o seu ok no ' + ondeResponder(c) + '.'; }
// Compatibilidade com o pacote 8; o novo sufixo registra a falta de confirmacao no chat.
const RX_PELO_PAINEL = /\bopcao (\d{1,2}) \(pelo painel(?:, falta o ok no chat)?\)\s*$/;
function respostaTela(c) {
  const aviso = perigoso(c) ? ' · falta o seu ok no chat' : '';
  if (typeof c.resposta === 'string' && c.resposta.trim()) return limpar(c.resposta, 200) + aviso;
  const m = RX_PELO_PAINEL.exec(texto(c.respondido));
  if (m) { const o = opcoesDe(c)[Number(m[1]) - 1]; return limpar('Opção ' + m[1] + (o && typeof o === 'object' && texto(o.label) ? ': ' + rotuloTela(o.label) : '') + ' (pelo painel)', 200) + aviso; }
  if (/\bpassos feitos \(pelo painel(?:, falta o ok no chat)?\)\s*$/.test(texto(c.respondido))) return 'Passos feitos (pelo painel)' + aviso;
  return 'respondido' + aviso;
}

// ---------- tempo ----------
function hhmm(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function ddmm(d) { return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); }
function quando(v, agora) {
  const s = texto(v).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d)([\dx])(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/i.exec(s);
  if (m) {
    const aprox = m[6].toLowerCase() === 'x', min = Number(m[5]) * 10 + (aprox ? 0 : Number(m[6]));
    let t;
    if (m[8]) t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${String(min).padStart(2, '0')}:${m[7] || '00'}${m[8].toUpperCase() === 'Z' ? 'Z' : m[8]}`);
    else t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), min, Number(m[7] || 0)).getTime();
    return Number.isFinite(t) ? { t, aprox, soData: false } : null;
  }
  m = /^(\d{2})\/(\d{2})(?:\/(\d{4}))?\s+(\d{2}):(\d)([\dx])/i.exec(s);
  if (m) {
    const aprox = m[6].toLowerCase() === 'x', min = Number(m[5]) * 10 + (aprox ? 0 : Number(m[6]));
    const ano = m[3] ? Number(m[3]) : agora.getFullYear();
    const t = new Date(ano, Number(m[2]) - 1, Number(m[1]), Number(m[4]), min).getTime();
    return Number.isFinite(t) ? { t, aprox, soData: false } : null;
  }
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) { const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0).getTime(); return Number.isFinite(t) ? { t, aprox: false, soData: true } : null; }
  return null;
}
function tempoTela(v, agora) {
  const q = quando(v, agora);
  if (!q) return { rel: '', abs: '' };
  const d = new Date(q.t);
  const abs = ddmm(d) + (q.soData ? '' : ' ' + (q.aprox ? hhmm(d).slice(0, 4) + 'x' : hhmm(d)));
  if (q.soData) {
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
    const dia = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dias = Math.round((hoje - dia) / 86400000);
    return { rel: dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`, abs, t: q.t };
  }
  const min = Math.floor((agora.getTime() - q.t) / 60000);
  let rel;
  if (min < 1) rel = 'agora';
  else if (min < 60) rel = `há ${min} min`;
  else if (min < 1440) rel = `há ${Math.floor(min / 60)} h`;
  else { const dias = Math.floor(min / 1440); rel = dias === 1 ? 'ontem' : `há ${dias} dias`; }
  return { rel, abs, t: q.t };
}

// ---------- leitura ----------
function pastaSegura(dir) {
  if (typeof dir !== 'string' || !path.isAbsolute(dir) || PASTA_PROIBIDA.test(dir)) throw erro('pasta');
  const real = fs.realpathSync(dir);
  if (PASTA_PROIBIDA.test(real) || !fs.statSync(real).isDirectory()) throw erro('pasta');
  return real;
}
function caminhoCard(dir, arquivo) {
  if (typeof arquivo !== 'string' || !NOME_CARD.test(arquivo)) throw erro('invalido');
  const base = pastaSegura(dir), alvo = path.join(base, arquivo);
  let st;
  try { st = fs.lstatSync(alvo); } catch { throw erro('sumiu'); }
  if (st.isSymbolicLink() || !st.isFile() || st.size > LIMITE_CARD) throw erro('invalido');
  if (path.dirname(fs.realpathSync(alvo)) !== base) throw erro('invalido');
  return alvo;
}
function lerBytes(bytes) {
  const cru = JSON.parse(semBom(bytes.toString('utf8')));
  if (!cru || typeof cru !== 'object' || Array.isArray(cru)) throw erro('invalido');
  return cru;
}
function lerPasta(dir) {
  const base = pastaSegura(dir);
  const nomes = fs.readdirSync(base, { withFileTypes: true })
    .filter(e => e.isFile() && !e.isSymbolicLink() && NOME_CARD.test(e.name)).map(e => e.name).sort();
  const lidos = []; let ilegiveis = 0;
  for (const arquivo of nomes) {
    try {
      const alvo = path.join(base, arquivo), st = fs.statSync(alvo);
      if (st.size > LIMITE_CARD) { ilegiveis++; continue; }
      const bytes = fs.readFileSync(alvo);
      lidos.push({ arquivo, versao: sha256(bytes), cru: lerBytes(bytes), mtime: st.mtimeMs });
    } catch { ilegiveis++; }
  }
  const conta = new Map();
  for (const l of lidos) { const id = typeof l.cru.id === 'string' ? l.cru.id : ''; conta.set(id, (conta.get(id) || 0) + 1); }
  for (const l of lidos) l.duplicado = !(typeof l.cru.id === 'string' && ID_CARD.test(l.cru.id)) || conta.get(l.cru.id) > 1;
  return { lidos, ilegiveis };
}

// ---------- passo a passo (dadosDir/passos.json, nunca no estado) ----------
function lerJson(arquivo, padrao) { try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { return padrao; } }
function gravarAtomico(arquivo, cortes) {
  const tmp = arquivo + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
  fs.writeFileSync(tmp, cortes, { encoding: 'utf8', flag: 'wx' });
  try { fs.renameSync(tmp, arquivo); } finally { try { fs.unlinkSync(tmp); } catch {} }
}
function progresso(dadosDir) { const p = lerJson(path.join(dadosDir, 'passos.json'), {}); return p && typeof p === 'object' && !Array.isArray(p) ? p : {}; }
function feitosDe(prog, arquivo, chave, total) {
  const reg = prog[arquivo];
  if (!reg || reg.chave !== chave || !Array.isArray(reg.feitos)) return [];
  return [...new Set(reg.feitos.filter(i => Number.isInteger(i) && i >= 0 && i < total))].sort((a, b) => a - b);
}

// ---------- vista para a tela ----------
const TIPO_TELA = { decisao: 'decisão', passos: 'passo a passo', subida: 'subida', env: 'env', 'env-dinheiro': 'env e dinheiro', 'tela-dinheiro': 'tela de dinheiro' };
function tipoTela(tipo) { const t = normal(tipo).trim(); return TIPO_TELA[t] || limpar(t.replace(/[-_]+/g, ' '), 40); }
const MOTIVO = {
  restrito: 'Assunto restrito: fica fora do painel.',
  duplicado: 'Há dois cards com o mesmo nome: responda no chat para não errar.',
  'sem-opcoes': 'Este card não tem opções para clicar.',
  reservado: 'Assunto reservado: fica fora do painel.',
  reservadoAberto: 'Assunto reservado: aberto só neste PC. Responda no chat da sessão.'
};

function vista(l, agora, prog, subs) {
  const c = l.cru;
  const bloqueado = bloqueio(c);
  // Sigilo prevalece inclusive quando o mesmo id aparece em dois arquivos.
  const motivo = bloqueado === 'restrito' || bloqueado === 'reservado' ? bloqueado : l.duplicado ? 'duplicado' : bloqueado;
  const aberto = PESSOAS_F2.aberto(), restrito = motivo === 'restrito' || (motivo === 'reservado' && !aberto), fluxo = fluxoDe(c), perigo = !restrito && perigoso(c);
  const ops = opcoesDe(c), rec = indiceRecomendada(c, ops);
  const opcoes = ops.map((o, i) => (o && typeof o === 'object' && rotuloGravado(o.label)) ? {
    indice: i, label: rotuloTela(o.label), descricao: limpar(o.descricao, 300), recomendada: i === rec
  } : null).filter(Boolean).sort((a, b) => Number(b.recomendada) - Number(a.recomendada) || a.indice - b.indice);
  const passos = restrito ? [] : passosDe(c), chave = passos.length ? chavePassos(passos) : '';
  const feitos = passos.length ? feitosDe(prog, l.arquivo, chave, passos.length) : [];
  const criado = tempoTela(c.criado, agora);
  const resp = respondido(c);
  const quandoResp = tempoTela(texto(c.respondidoEm) || texto(c.respondido), agora);
  let estado = 'pendente';
  if (resp) estado = (normal(c.tipo).trim() === 'passos' && !c.conferido) ? 'esperando' : 'respondido';
  else if (fechado(c, subs)) estado = 'fechado';
  const out = {
    arquivo: restrito ? chaveOpaca(l.arquivo) : l.arquivo, versao: restrito ? '' : l.versao, chavePassos: chave,
    sessao: limpar(c.sessao, 60) || 'Sem nome', familia: familia(c.sessao),
    criado: criado.rel, criadoAbs: criado.abs, ordem: Number.isFinite(criado.t) ? criado.t : Infinity, mtime: l.mtime,
    tipo: tipoTela(c.tipo), tipoLivre: motivo ? '' : fluxo,
    perigoso: perigo, avisoPerigo: perigo ? avisoPerigo(c) : '',
    pergunta: restrito ? '' : limpar(c.pergunta, 600),
    opcoes: restrito ? [] : opcoes,
    passos, feitos,
    bloqueado: !!motivo, motivo: motivo ? MOTIVO[motivo === 'reservado' && aberto ? 'reservadoAberto' : motivo] : '', ondeResponder: ondeResponder(c), restrito,
    estado, resposta: resp ? (restrito ? 'respondido' : respostaTela(c)) : '',
    respondido: quandoResp.rel, respondidoAbs: quandoResp.abs, ordemResp: Number.isFinite(quandoResp.t) ? quandoResp.t : l.mtime,
    exemplo: c.exemplo === true
  };
  // o nome de verdade fica so dentro do servidor (nao enumeravel: o JSON nunca leva)
  Object.defineProperty(out, 'arquivoReal', { value: l.arquivo, enumerable: false });
  return out;
}

function montarLista({ cardsDir, dadosDir, agora = new Date(), mostrarExemplo = false }) {
  const { lidos, ilegiveis } = lerPasta(cardsDir);
  const prog = progresso(dadosDir), subs = substituidos(lidos);
  const todos = lidos.map(l => vista(l, agora, prog, subs)).filter(v => mostrarExemplo || !v.exemplo);
  const pendentes = todos.filter(v => v.estado === 'pendente').sort((a, b) => a.ordem - b.ordem || a.mtime - b.mtime);
  const esperando = todos.filter(v => v.estado === 'esperando').sort((a, b) => b.ordemResp - a.ordemResp);
  const respondidos = todos.filter(v => v.estado === 'respondido').sort((a, b) => b.ordemResp - a.ordemResp).slice(0, 5);
  return { pendentes, esperando, respondidos, ilegiveis };
}

// ---------- hora (Get-Date) ----------
// Um PowerShell fica de pe e responde "Get-Date -Format o" por linha: o 1o pedido leva ~3 s (sobe o PowerShell),
// os outros ~10 ms. Se ele cair ou travar, o proximo clique sobe outro; sem Get-Date nada e gravado.
const FORMATO_O = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{2}:\d{2}$/;
let ps = null, fila = [];
function derrubar() {
  const pend = fila.splice(0);
  if (ps) { try { ps.stdin.end(); } catch {} try { ps.kill(); } catch {} ps = null; }
  for (const f of pend) f(null);
}
function subirPs() {
  const filho = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-NoLogo', '-Command', '-'], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
  let buf = '';
  filho.stdout.setEncoding('utf8');
  filho.stdout.on('data', d => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const linha = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!linha) continue;
      const f = fila.shift(); if (f) f(linha);
    }
  });
  filho.on('error', () => { if (ps === filho) derrubar(); });
  filho.on('exit', () => { if (ps === filho) { ps = null; const pend = fila.splice(0); for (const f of pend) f(null); } });
  return filho;
}
function horaGetDate(limiteMs = 45000) {
  return new Promise((resolve, reject) => {
    if (!ps) ps = subirPs();
    let feito = false;
    const relogio = setTimeout(() => { if (!feito) { feito = true; derrubar(); reject(erro('hora')); } }, limiteMs);
    fila.push(linha => {
      if (feito) return; feito = true; clearTimeout(relogio);
      if (linha && FORMATO_O.test(linha)) resolve(linha); else reject(erro('hora'));
    });
    try { ps.stdin.write('Get-Date -Format o\n'); } catch { if (!feito) { feito = true; clearTimeout(relogio); derrubar(); reject(erro('hora')); } }
  });
}
function fecharRelogio() { derrubar(); }

// ---------- registro de cliques (dadosDir/registro-cliques.log) ----------
function registrar(dadosDir, hora, acao, arquivo, detalhe, resultado) {
  try {
    const linha = [hora || '?', acao, arquivo || '-', String(detalhe || '').replace(/[\r\n|]+/g, ' ').slice(0, 120), resultado].join(' | ');
    fs.appendFileSync(path.join(dadosDir, 'registro-cliques.log'), linha + '\n', 'utf8');
  } catch {}
}

// ---------- escrita da resposta (so no proprio card) ----------
// pedido: {arquivo, versao, opcao} para decisao; {arquivo, versao, feito:true} para card de passos.
function comLock(alvo,fn){const lock=alvo+'.lock',nonce=crypto.randomBytes(24).toString('hex');let fd;try{fd=fs.openSync(lock,'wx');fs.writeFileSync(fd,nonce);}catch(e){if(fd!==undefined)fs.closeSync(fd);throw erro(e?.code==='EEXIST'?'ocupado':'gravar');}try{return fn();}finally{try{const ours=fs.fstatSync(fd),current=fs.lstatSync(lock);if(!current.isSymbolicLink()&&current.ino===ours.ino&&current.dev===ours.dev&&fs.readFileSync(lock,'utf8')===nonce)fs.unlinkSync(lock);}catch{}finally{fs.closeSync(fd);}}}
function gravarResposta({ cardsDir, dadosDir, pedido, hora }) {
  const { arquivo, versao } = pedido;
  if (typeof versao !== 'string' || !/^[a-f0-9]{64}$/.test(versao)) throw erro('invalido');
  const alvo = caminhoCard(cardsDir, arquivo);
  return comLock(alvo,()=>gravarRespostaComLock({ cardsDir, dadosDir, pedido, hora, alvo }));
}
function gravarRespostaComLock({ cardsDir, dadosDir, pedido, hora, alvo }) {
  const { arquivo, versao } = pedido;
  const bytes = fs.readFileSync(alvo);
  if (sha256(bytes) !== versao) throw erro('mudou');
  const card = lerBytes(bytes);
  if (perigoso(card)) throw erro('so-no-chat');
  if (respondido(card)) throw erro('ja-respondido');
  const { lidos } = lerPasta(cardsDir);
  if (fechado(card, substituidos(lidos))) throw erro('ja-respondido');
  const mesmo = lidos.filter(l => l.cru && l.cru.id === card.id);
  if (typeof card.id !== 'string' || !ID_CARD.test(card.id)) throw erro('id-invalido');
  if (mesmo.length !== 1) throw erro('id-repetido');
  const motivo = bloqueio(card);
  if (motivo) throw erro(motivo === 'restrito' || motivo === 'reservado' ? 'so-no-chat' : 'sem-opcoes');
  const fluxo = fluxoDe(card);
  let resposta, escolha;
  if (pedido.feito === true) {
    const passos = passosDe(card);
    if (fluxo !== 'passos') throw erro('invalido');
    const feitos = feitosDe(progresso(dadosDir), arquivo, chavePassos(passos), passos.length);
    if (feitos.length !== passos.length) throw erro('passos-faltando');
    resposta = `Feito (${passos.length} de ${passos.length} passos)`; escolha = 'passos feitos';
  } else {
    const ops = opcoesDe(card);
    if (fluxo !== 'decisao' || !Number.isInteger(pedido.opcao) || pedido.opcao < 0 || pedido.opcao >= ops.length) throw erro('invalido');
    const o = ops[pedido.opcao];
    resposta = o && typeof o === 'object' ? rotuloGravado(o.label) : '';
    if (!resposta) throw erro('invalido');
    escolha = 'opcao ' + (pedido.opcao + 1);
  }
  // copia do original, byte a byte, antes de tocar no card
  const pastaBackup = path.join(dadosDir, 'backup');
  fs.mkdirSync(pastaBackup, { recursive: true });
  const carimbo = hora.slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
  const nomeBackup = `${arquivo}.${carimbo}.${crypto.randomBytes(3).toString('hex')}.bak`;
  fs.writeFileSync(path.join(pastaBackup, nomeBackup), bytes, { flag: 'wx' });
  // so os 2 campos mudam (respondido e respondidoEm); a ordem das chaves e o resto do card ficam iguais
  const marca = hora + ' ' + escolha + (perigoso(card) ? ' (pelo painel, falta o ok no chat)' : ' (pelo painel)');
  const novo = { ...card, respondido: marca, respondidoEm: hora };
  const fora = o => { const x = { ...o }; delete x.respondido; delete x.respondidoEm; return JSON.stringify(x); };
  if (fora(novo) !== fora(card)) throw erro('gravar');
  const finalComQuebra = /\n\s*$/.test(bytes.toString('utf8'));
  const cortes = JSON.stringify(novo, null, 2) + (finalComQuebra ? '\n' : '');
  const pastaTmp = path.join(dadosDir, 'tmp');
  fs.mkdirSync(pastaTmp, { recursive: true });
  const tmp = path.join(pastaTmp, `${arquivo}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  fs.writeFileSync(tmp, cortes, { encoding: 'utf8', flag: 'wx' });
  try {
    // releitura logo antes de trocar: se alguem mexeu no card nesse meio tempo, nada e gravado
    if (!fs.readFileSync(alvo).equals(bytes)) throw erro('mudou');
    try { fs.renameSync(tmp, alvo); }
    catch { throw erro('ocupado'); }
  } finally { try { fs.unlinkSync(tmp); } catch {} }
  // 1 linha para a sessao dona do card agir (o mesmo arquivo que o painel ja usa para recados): se falhar, o card fica
  // gravado e a tela avisa para mandar no chat
  let recado = null;
  try { recado = gravarRecado(path.dirname(pastaSegura(cardsDir)), hora, card, escolha); } catch { recado = null; }
  return { resposta, respondido: marca, respondidoEm: hora, escolha, backup: nomeBackup, recado, sessao: sessaoRecado(card), perigoso: perigoso(card), avisoPerigo: perigoso(card) ? avisoPerigo(card) : '' };
}
// Sessao dona do card como vai na linha de recado (sem barra vertical, quebra de linha nem travessao).
function sessaoRecado(card) { return rotuloGravado(texto(card.sessao)).slice(0, 60) || 'Claude'; }
const MAX_RECADOS = 2 * 1024 * 1024;
// "- DD/MM HH:MM | <sessao> | card <id>: opcao N (pelo painel) | painel-<uuid>" no fim de estado/recados-do-painel.md
function gravarRecado(estadoDir, hora, card, escolha) {
  if (path.basename(estadoDir) !== 'estado') throw erro('gravar');
  const arquivo = path.join(estadoDir, 'recados-do-painel.md');
  let prefixo = '';
  try {
    const st = fs.lstatSync(arquivo);
    if (st.isSymbolicLink() || !st.isFile() || st.size > MAX_RECADOS) throw erro('gravar');
    if (st.size > 0) { const fd = fs.openSync(arquivo, 'r'); try { const ultimo = Buffer.alloc(1); fs.readSync(fd, ultimo, 0, 1, st.size - 1); if (ultimo[0] !== 0x0a) prefixo = '\n'; } finally { fs.closeSync(fd); } }
  } catch (e) { if (e && e.codigo) throw e; if (!e || e.code !== 'ENOENT') throw e; }
  const id = 'painel-' + crypto.randomUUID();
  const aviso = perigoso(card) ? ' INTENCAO PERIGOSA: falta o seu ok no ' + rotuloGravado(ondeResponder(card)) + ';' : '';
  const linha = '- ' + hora.slice(8, 10) + '/' + hora.slice(5, 7) + ' ' + hora.slice(11, 16) + ' | ' + sessaoRecado(card) + ' |' + aviso + ' card ' + card.id + ': ' + escolha + ' (pelo painel) | ' + id;
  fs.appendFileSync(arquivo, prefixo + linha + '\n', 'utf8');
  return { id, linha };
}

// Marca ou desmarca 1 passo como feito (so em dadosDir/passos.json).
function marcarPasso(args) {
  return comLock(caminhoCard(args.cardsDir,args.pedido.arquivo),()=>marcarPassoComLock(args));
}
function marcarPassoComLock({ cardsDir, dadosDir, pedido, hora }) {
  const { arquivo, versao, chave, passo, feito } = pedido;
  if (typeof chave !== 'string' || !/^[a-f0-9]{32}$/.test(chave) || !Number.isInteger(passo) || typeof feito !== 'boolean') throw erro('invalido');
  const cardPath=caminhoCard(cardsDir,arquivo),cardBytes=fs.readFileSync(cardPath);
  if(typeof versao!=='string'||sha256(cardBytes)!==versao)throw erro('mudou');
  const card = lerBytes(cardBytes);
  if (respondido(card)) throw erro('ja-respondido');
  if (bloqueio(card) || perigoso(card)) throw erro('so-no-chat');
  const passos = passosDe(card);
  if (!passos.length || chavePassos(passos) !== chave) throw erro('mudou');
  if (passo < 0 || passo >= passos.length) throw erro('invalido');
  fs.mkdirSync(dadosDir, { recursive: true });
  const arq = path.join(dadosDir, 'passos.json');
  const prog = progresso(dadosDir);
  const atuais = new Set(feitosDe(prog, arquivo, chave, passos.length));
  if (feito) atuais.add(passo); else atuais.delete(passo);
  prog[arquivo] = { chave, feitos: [...atuais].sort((a, b) => a - b), em: hora };
  if(!fs.readFileSync(cardPath).equals(cardBytes))throw erro('mudou');
  gravarAtomico(arq, JSON.stringify(prog, null, 2) + '\n');
  return { feitos: prog[arquivo].feitos, total: passos.length };
}

module.exports = {
  montarLista, gravarResposta, marcarPasso, horaGetDate, fecharRelogio, registrar, lerPasta, bloqueio, perigoso, fluxoDe, passosDe, chavePassos,
  respondido, ondeResponder, limpar, rotuloGravado, quando, tempoTela, caminhoCard, pastaSegura, sha256, erro, normal,
  fechado, substituidos, sessaoReservada, paraTela, chaveOpaca
};
