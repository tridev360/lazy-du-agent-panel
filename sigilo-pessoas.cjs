'use strict';
// Os nomes de terceiros NAO moram no codigo: vem de um arquivo fora do estado (PAINEL_NOMES_OCULTAR troca o caminho;
// o teste usa nomes inventados). Sem o arquivo, so as regras gerais valem.
// Formato do arquivo: { "nomes": [], "nomesComuns": [], "contas": [], "minusculos": [], "comunidades": [], "protegidas": [] }
//   nomes: casa so o nome inteiro, com fronteira de palavra e com a caixa escrita, Capitalizada ou toda MAIUSCULA (o verbo em minusculo nao casa).
//     o inicio da linha e depois de . ! ?), onde a maiuscula e do verbo; depois de ; : ( aspas, travessao ou marcador de lista, e depois de artigo ("o X"), casa sempre.
//   qualquerCaixa: nome que nunca e palavra comum, em qualquer caixa (tambem no titulo que o painel passa para minusculo).
//   contas: apelido de perfil (X, mercado, Discord), em qualquer caixa.
//   minusculos: nome que a casa escreve em minusculo; casa minusculo so depois de o, do, ao, pro, pelo ou com o.
//   comunidades: servidor ou comunidade de parceiro, em qualquer caixa, com plural opcional (8e: "Nomes" casa como "Nome").
//   protegidas: expressao comum que nunca vira parceiro (fica como esta).
// Regras gerais: e-mail, URL de perfil (x.com, twitter.com, mercado.io, instagram.com, t.me...), @conta (menos @marca, @alpha,
const fs = require('node:fs'), crypto = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');
// codigo fora de wt/) e roda o pedido inteiro dentro de rodarComo(true, ...). Fora disso o contexto e false ou nenhum: o filtro roda como sempre.
// Aberto: nome, conta, @, perfil, e-mail, comunidade e chave opaca ficam como estao; o endereco de carteira (base58) SEGUE oculto.
const ctxDono = new AsyncLocalStorage();
function rodarComo(aberto, fn) { return ctxDono.run(aberto === true, fn); }
function aberto() { return ctxDono.getStore() === true; }
const ARQ_PADRAO = require('node:path').join(__dirname, 'config', 'nomes-ocultar.json');
const arquivoNomes = () => process.env.PAINEL_NOMES_OCULTAR || ARQ_PADRAO;
const L = '\\p{L}\\p{N}_';
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const semAcento = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const fold = s => semAcento(s).toLowerCase();
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const alt = arr => [...new Set(arr.filter(Boolean))].sort((a, b) => b.length - a.length).map(x => esc(x).replace(/\s+/g, '\\s+')).join('|');
const borda = (corpo, flags) => corpo ? new RegExp('(?<![' + L + '])(?:' + corpo + ')(?![' + L + '])', flags) : null;
const ART = '([Oo]|[Aa]|[Dd][oa]|[Dd]e|[Aa]o|\u00e0|[Pp]r[oa]|[Pp]el[oa]|[Cc]om [oa])';
const ART_M = '([Oo]|[Dd]o|[Aa]o|[Pp]ro|[Pp]elo|[Cc]om o)';
const TROCA = { o: '', a: '', do: 'de ', da: 'de ', de: 'de ', ao: 'a ', '\u00e0': 'a ', pro: 'para ', pra: 'para ', pelo: 'por ', pela: 'por ', 'com o': 'com ', 'com a': 'com ' };
const PARCEIRO = 'um parceiro';
const trocaArt = (m, art) => { const t = (TROCA[art.toLowerCase()] ?? '') + PARCEIRO; return /^[A-Z\u00c0-\u00de]/.test(art) ? cap(t) : t; };

function montar(j) {
  const lista = k => (Array.isArray(j && j[k]) ? j[k] : []).filter(x => typeof x === 'string' && x.trim().length >= 2).map(x => x.trim());
  const nomes = lista('nomes'), comuns = lista('nomesComuns'), contas = [...lista('contas'), ...lista('qualquerCaixa')], minus = lista('minusculos'), coms = lista('comunidades'), prot = lista('protegidas');
  const variantes = arr => { const out = []; for (const n of arr) for (const v of [n, semAcento(n)]) out.push(v, cap(v), v.toUpperCase()); return out; };
  const vars = variantes(nomes), varsComuns = variantes(comuns);
  const corpoNome = alt(vars), corpoComum = alt(varsComuns), corpoArt = alt([...vars, ...varsComuns]), corpoMinus = alt([...minus, ...minus.map(semAcento)].map(x => x.toLowerCase()));
  const todos = [...nomes, ...comuns, ...contas, ...minus, ...coms];
  // nome curto segue com borda de letra e numero (senao "ana" casaria dentro de "ana2" e de codigos)
  const gruposSlug = { longos: [], curtos: [] };
  for (const n of todos) gruposSlug[fold(n).replace(/[^a-z]/g, '').length >= 4 ? 'longos' : 'curtos'].push(fold(n));
  const slugDe = arr => alt(arr).replace(/\\s\+/g, '[^a-z0-9]*');
  const slugLongo = slugDe(gruposSlug.longos), slugCurto = slugDe(gruposSlug.curtos);
  const slug = [slugCurto && '(?:^|[^a-z0-9])(?:' + slugCurto + ')s?(?:$|[^a-z0-9])', slugLongo && '(?:^|[^a-z])(?:' + slugLongo + ')s?(?:$|[^a-z])'].filter(Boolean).join('|');
  const corpoCom = alt([...coms, ...coms.map(semAcento)]);
  return {
    n: todos.length,
    rxRapido: (() => { const c = alt(todos.map(x => x.split(/\s+/).sort((a, b) => b.length - a.length)[0]).flatMap(x => [x, semAcento(x)])); return c ? new RegExp(c, 'i') : null; })(),
    rxProt: borda(alt([...prot, ...prot.map(semAcento)]), 'giu'),
    rxCom: corpoCom ? borda('(?:' + corpoCom + ')s?', 'giu') : null,
    rxConta: borda(alt([...contas, ...contas.map(semAcento)]), 'giu'),
    rxArtConta: contas.length ? new RegExp('(?<![' + L + '])' + ART + '\\s+(?:' + alt([...contas, ...contas.map(semAcento)]) + ')(?![' + L + '])', 'giu') : null,
    rxArtNome: corpoArt ? new RegExp('(?<![' + L + '])' + ART + '\\s+(?:' + corpoArt + ')(?![' + L + '])', 'gu') : null,
    rxNome: borda(corpoNome, 'gu'),
    rxNomeComum: borda(corpoComum, 'gu'),
    rxMinus: corpoMinus ? new RegExp('(?<![' + L + '])' + ART_M + '\\s+(?:' + corpoMinus + ')(?![' + L + '])', 'gu') : null,
    rxSlug: slug ? new RegExp(slug) : null
  };
}
let cache = null;
function compilado() {
  const arq = arquivoNomes(), agora = Date.now();
  if (cache && cache.arq === arq && agora - cache.visto < 5000) return cache.v;
  let st = null; try { st = fs.statSync(arq); } catch { st = null; }
  const carimbo = st ? st.mtimeMs + ':' + st.size : 'sem';
  if (cache && cache.arq === arq && cache.carimbo === carimbo) { cache.visto = agora; return cache.v; }
  let j = null;
  if (st) try { j = JSON.parse(fs.readFileSync(arq, 'utf8').replace(/^\uFEFF/, '')); } catch { j = null; }
  cache = { arq, carimbo, visto: agora, v: montar(j), lido: !!j };
  return cache.v;
}
// so a contagem, nunca os nomes (para o teste e o log)
function situacao() { const v = compilado(); return { arquivoLido: !!(cache && cache.lido), entradas: v.n }; }

const RX_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const RX_URL_PERFIL = /(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com|mercado\.io|instagram\.com|tiktok\.com|t\.me|github\.com|warpcast\.com|magiceden\.io|youtube\.com|discord\.com\/users)\/[^\s"'<>()[\]{},]+/gi;
// link da casa fica: a conta @marca e a colecao app
const URL_CASA = /^(?:https?:\/\/)?(?:www\.)?(?:(?:x|twitter)\.com\/@marca(?:[/?#]|$)|mercado\.io\/collection\/app(?:[/?#]|$))/i;
const CASA = /^(?:@marca|alpha|everyone|here)$/i;
const RX_ARROBA = /(^|[^\w.@/])@([A-Za-z0-9_](?:[A-Za-z0-9_.]*[A-Za-z0-9_])?)/g;
const RX_PEDACO = /(?<![\p{L}\p{N}_])[\p{L}\p{N}_]+(?:[-_./\\][\p{L}\p{N}_]+)+(?![\p{L}\p{N}_])/gu;
// Depois de ; : ( aspas, travessao ou marcador de lista ("- ", "* ", "1.", "2)") a casa escreve NOME de pessoa ("Quem: X", "(X, ...)", "; X e ..."): mascara.
const comecoDeFrase = antes => {
  const ws = /\s*$/.exec(antes)[0], t = antes.slice(0, antes.length - ws.length);
  if (!t || ws.includes('\n')) return true;
  if (/(?:^|\n)[ \t]*\d+[.)]$/.test(t)) return false; // "1." e "2)" abrem item de lista, nao frase
  return /[.!?]$/.test(t);
};
const RX_DISCORD_RAPIDO = /discord|servidor|server/i;
const RX_DISCORD_DELE = /\b(discord|servidor|server)\s+(?:dele|dela|deles|delas)\b/gi;

// endereco base58 (rede e parecidos) de 32 a 44 caracteres, com letra maiuscula, minuscula e numero (hash hex nao tem maiuscula), vira "carteira oculta"
const RX_ENDERECO_B58 = /(?<![1-9A-HJ-NP-Za-km-z])[1-9A-HJ-NP-Za-km-z]{32,44}(?![1-9A-HJ-NP-Za-km-z])/g;
function carteiraOculta(v) { return v.length < 32 ? v : v.replace(RX_ENDERECO_B58, m => /\d/.test(m) && /[a-z]/.test(m) && /[A-Z]/.test(m) ? 'carteira oculta' : m); }
function mascarar(v) {
  if (typeof v !== 'string' || !v) return v;
  v = carteiraOculta(v);
  if (aberto()) return v;
  const C = compilado();
  if (!(C.rxRapido && C.rxRapido.test(v)) && v.indexOf('@') < 0 && v.indexOf('/') < 0 && !RX_DISCORD_RAPIDO.test(v)) return v;
  let s = v; const guarda = [];
  if (C.rxProt) s = s.replace(C.rxProt, m => { guarda.push(m); return '\u0000' + (guarda.length - 1) + '\u0000'; });
  if (s.includes('@')) s = s.replace(RX_EMAIL, 'um e-mail');
  if (s.includes('/')) s = s.replace(RX_URL_PERFIL, m => URL_CASA.test(m) ? m : 'um perfil');
  if (s.includes('@')) s = s.replace(RX_ARROBA, (m, antes, conta) => CASA.test(conta) ? m : antes + 'uma conta');
  if (C.rxSlug) s = s.replace(RX_PEDACO, m => C.rxSlug.test(fold(m)) ? chaveOpaca(m) : m);
  s = s.replace(RX_DISCORD_DELE, 'outro servidor');
  if (C.rxCom) s = s.replace(C.rxCom, 'uma comunidade parceira');
  if (C.rxArtConta) s = s.replace(C.rxArtConta, trocaArt);
  if (C.rxConta) s = s.replace(C.rxConta, PARCEIRO);
  if (C.rxArtNome) s = s.replace(C.rxArtNome, trocaArt);
  if (C.rxNome) s = s.replace(C.rxNome, PARCEIRO);
  if (C.rxNomeComum) s = s.replace(C.rxNomeComum, (m, at, str) => { const ini = Math.max(0, at - 200), antes = str.slice(ini, at); return (ini === 0 || /\S/.test(antes)) && comecoDeFrase(antes) ? m : PARCEIRO; });
  if (C.rxMinus) s = s.replace(C.rxMinus, trocaArt);
  if (guarda.length) s = s.replace(/\u0000(\d+)\u0000/g, (m, i) => guarda[Number(i)]);
  return s;
}
// slug, id ou caminho (sem espaco) com nome em qualquer caixa
function slugTemNome(v) { if (aberto()) return false; const C = compilado(); return !!(C.rxSlug && C.rxRapido && C.rxRapido.test(String(v)) && C.rxSlug.test(fold(v))); }
function temArroba(v) { if (aberto()) return false; let achou = false; String(v || '').replace(RX_ARROBA, (m, a, conta) => { if (!CASA.test(conta)) achou = true; return m; }); return achou; }
function temPessoa(v) { const s = String(v || ''); return mascarar(s) !== s || slugTemNome(s); }
// Para quem esconde o item inteiro (codex-sessoes, Entregas): nome em qualquer caixa, como a lista antiga fazia.
const PESSOAS = Object.freeze({ test: v => slugTemNome(v) });
// chave opaca no lugar de arquivo ou id que conta o assunto (card reservado, id com nome)
function chaveOpaca(v) { return 'oculto-' + crypto.createHash('sha256').update(String(v || '')).digest('hex').slice(0, 8); }

// Objeto inteiro (resposta de API): toda string passa pelo mascarar. Chave de id/arquivo/fonte fica, salvo se conta um nome
// (vira chave opaca, a mesma em toda a resposta, entao o que casa por id segue casando).
// em qualquer outro pedido o campo e tirado aqui, no mesmo filtro de toda resposta JSON (send, fluxo continuo e guardarResposta).
const CHAVE_DONO = 'soDono';
// texto real para o dono: nunca credencial, chave, hash longo, caminho nem URL com parametro sensivel (o restrito nunca abre)
const RX_SEGREDO_DONO = /\bseed\b|mnemonic|private[\s_-]?key|privkey|\.env\b|api[\s_-]?key|bearer|\bsk-[a-z0-9]{6,}|0x[a-f\d]{40}|\b[a-f\d]{40,}\b|[?&](?:key|token|apikey|api_key|secret|sig|signature|auth|password)=|_SECRETS|backup-privado/i;
function textoDono(v, max = 120) {
  if (typeof v !== 'string') return null;
  if (RX_SEGREDO_DONO.test(v)) return null;
  const t = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[A-Za-z]:[\\/]\S*/g, ' ').replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}
const LIVRE = new Set(['arquivo', 'versao', 'chave', 'id', 'fonte', 'source', 'em', 'chavePassos', 'link', 'link_sessao']);
function opacoSeNome(v) { return typeof v === 'string' && v && (slugTemNome(v) || mascarar(v) !== v) ? chaveOpaca(v) : v; }
function mascararTudo(x, prof = 0, chave = '') {
  if (prof > 60) return x;
  if (typeof x === 'string') {
    if (LIVRE.has(chave)) return opacoSeNome(x);
    const s = mascarar(x);
    return s === x && x.length <= 200 && !/\s/.test(x) && slugTemNome(x) ? chaveOpaca(x) : s;
  }
  if (Array.isArray(x)) return x.map(v => mascararTudo(v, prof + 1, chave));
  if (x && typeof x === 'object') {
    if (Buffer.isBuffer(x)) return x;
    const out = {}, dono = aberto();
    for (const [k, v] of Object.entries(x)) { if (k === CHAVE_DONO && !dono) continue; out[slugTemNome(k) ? chaveOpaca(k) : k] = mascararTudo(v, prof + 1, k); }
    return out;
  }
  return x;
}
// state() refaz o embrulho quando relê as conversas (15 s) ou a leitura (60 s). Memo pela leitura: a chave e o TEXTO de cada parte
// (JSON ate o nivel 2) e a versao da lista de nomes, nunca o objeto (o estavel.cjs muda a equipe no proprio objeto). Mesma fonte,
// mesma versao, mesmo texto = mesmo resultado; parte que mudou e refeita, lista nova zera tudo. O teste compara com o mascararTudo inteiro.
function criarMemo(nivel = 2) {
  let lista = null, porObjeto = new WeakMap(), partes = new Map();
  const estat = { abertas: 0, chamadas: 0, mesmoObjeto: 0, partesIguais: 0, partesRefeitas: 0, ultimaMs: 0 };
  function parte(x, prof, chave, caminho, novas) {
    if (!x || typeof x !== 'object' || Buffer.isBuffer(x)) return mascararTudo(x, prof, chave);
    if (prof < nivel) {
      if (Array.isArray(x)) return x.map((v, i) => parte(v, prof + 1, chave, caminho + '\u0002' + i, novas));
      const out = {};
      for (const [k, v] of Object.entries(x)) { if (k === CHAVE_DONO) continue; out[slugTemNome(k) ? chaveOpaca(k) : k] = parte(v, prof + 1, k, caminho + '\u0001' + k, novas); }
      return out;
    }
    let json; try { json = JSON.stringify(x); } catch { json = undefined; }
    const velho = partes.get(caminho);
    if (typeof json === 'string' && velho && velho.json === json) { estat.partesIguais++; novas.set(caminho, velho); return velho.out; }
    const out = mascararTudo(x, prof, chave); estat.partesRefeitas++;
    if (typeof json === 'string') novas.set(caminho, { json, out });
    return out;
  }
  function tela(d) {
    if (aberto()) { estat.abertas++; return mascararTudo(d); }
    estat.chamadas++;
    if (!d || typeof d !== 'object') return mascararTudo(d);
    const C = compilado(), t = Date.now();
    if (C !== lista) { lista = C; porObjeto = new WeakMap(); partes = new Map(); }
    const ja = porObjeto.get(d);
    if (ja) { estat.mesmoObjeto++; return ja; }
    const novas = new Map(), out = parte(d, 0, '', '', novas);
    partes = novas; porObjeto.set(d, out); estat.ultimaMs = Date.now() - t;
    return out;
  }
  tela.estat = estat;
  return tela;
}
// Resposta escrita direto no res (pc-cards, acelerador): o corpo JSON passa pelo mesmo filtro antes de sair.
function guardarResposta(res, abrir) {
  const abre = abrir === undefined ? aberto() : abrir === true;
  const wh = res.writeHead.bind(res), end = res.end.bind(res), write = res.write.bind(res);
  let pend = null;
  const solta = () => { if (pend) { const a = pend; pend = null; wh(...a); } };
  res.writeHead = (...a) => { pend = a; return res; };
  res.write = (...a) => { solta(); return write(...a); };
  res.end = (corpo, ...r) => {
    try {
      const h = pend && pend.find(x => x && typeof x === 'object'), tipo = String((h && (h['Content-Type'] || h['content-type'])) || res.getHeader('content-type') || '');
      if (pend && corpo != null && /json/.test(tipo) && !(h && (h['Content-Encoding'] || h['content-encoding']))) {
        const txt = Buffer.isBuffer(corpo) ? corpo.toString('utf8') : String(corpo);
        corpo = JSON.stringify(rodarComo(abre, () => mascararTudo(JSON.parse(txt))));
      }
    } catch { /* corpo que nao e JSON sai como veio */ }
    solta(); return end(corpo, ...r);
  };
  return res;
}
module.exports = { CHAVE_DONO, textoDono, rodarComo, aberto, PESSOAS, mascarar, mascararTudo, criarMemo, temPessoa, temArroba, slugTemNome, chaveOpaca, guardarResposta, situacao, arquivoNomes };
