'use strict';











const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');


function textoMuda(tarefa, ligada) {
  const e = tarefa && tarefa[ligada ? 'aoLigar' : 'aoDesligar'];
  const t = e && typeof e === 'object' && !Array.isArray(e) && typeof e.muda === 'string' ? e.muda.trim() : '';
  return t || null;
}

const assets = ['chaves.js', 'chaves-modelo.js', 'chaves.css'];
const ARQUIVO = 'chaves-tasks.json', LOG = 'chaves-tasks-log.jsonl';
const ESTADOS = ['ligada', 'espera-ele', 'espera-outra', 'engavetada'];
const SOLUCAO = 'peça ao seu Claude para regravar as chaves';
const MAX_ARQUIVO = 2 * 1024 * 1024, MAX_CORPO = 2048, TRAVA_VELHA_MS = 30000;
const loopback = ip => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
const erro = (codigo, detalhe) => Object.assign(Error(detalhe || codigo), { codigo, detalhe: detalhe || null });
const sha1 = bytes => crypto.createHash('sha1').update(bytes).digest('hex');

function validar(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return ['o arquivo não é um objeto'];
  const p = [];
  if (d.versao !== 1) p.push('versão desconhecida (esperada: 1)');
  if (!Array.isArray(d.tasks)) { p.push('"tasks" não é uma lista'); return p; }
  const vistos = new Set();
  d.tasks.forEach((t, i) => {
    const onde = 'tarefa ' + (i + 1) + (t && typeof t.id === 'string' && t.id.trim() ? ' (' + t.id.trim().slice(0, 60) + ')' : '');
    if (!t || typeof t !== 'object' || Array.isArray(t)) { p.push(onde + ': não é um objeto'); return; }
    if (typeof t.id !== 'string' || !t.id.trim()) p.push(onde + ': sem id');
    else if (vistos.has(t.id)) p.push(onde + ': id repetido');
    else vistos.add(t.id);
    if (typeof t.nome !== 'string' || !t.nome.trim()) p.push(onde + ': sem nome');
    if (!ESTADOS.includes(t.estado)) p.push(onde + ': estado desconhecido');
    if (!t.chave || typeof t.chave !== 'object' || Array.isArray(t.chave) || typeof t.chave.ligada !== 'boolean') p.push(onde + ': chave sem "ligada" verdadeiro ou falso');
    if (t.aspa !== null && t.aspa !== undefined) {
      if (typeof t.aspa !== 'object' || Array.isArray(t.aspa)) p.push(onde + ': aspa fora do formato');
      else if (t.aspa.exata !== undefined && typeof t.aspa.exata !== 'boolean') p.push(onde + ': aspa.exata não é verdadeiro ou falso');
    }
  });
  return p;
}

function lerArquivo(dir) {
  const arquivo = path.join(dir, ARQUIVO);
  let buf;
  try {
    const st = fs.lstatSync(arquivo);
    if (!st.isFile() || st.isSymbolicLink()) return { ok: false, erro: 'invalido', detalhe: 'o caminho das chaves não é um arquivo comum' };
    if (st.size > MAX_ARQUIVO) return { ok: false, erro: 'invalido', detalhe: 'o arquivo das chaves está grande demais' };
    buf = fs.readFileSync(arquivo);
  } catch (e) {
    return e && e.code === 'ENOENT' ? { ok: false, erro: 'ausente', detalhe: 'o arquivo das chaves não existe' } : { ok: false, erro: 'invalido', detalhe: 'não consegui abrir o arquivo das chaves' };
  }
  const bom = buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
  const corpo = bom ? buf.subarray(3) : buf, texto = corpo.toString('utf8');
  if (!Buffer.from(texto, 'utf8').equals(corpo)) return { ok: false, erro: 'invalido', detalhe: 'o arquivo das chaves não está em UTF-8' };
  let dados;
  try { dados = JSON.parse(texto); } catch { return { ok: false, erro: 'invalido', detalhe: 'o arquivo das chaves não é um JSON inteiro' }; }
  const problemas = validar(dados);
  if (problemas.length) return { ok: false, erro: 'invalido', detalhe: problemas.slice(0, 3).join('; ') + (problemas.length > 3 ? '; e mais ' + (problemas.length - 3) : '') };
  return { ok: true, texto, dados, bom, assinatura: sha1(buf) };
}

const BRANCO = new Set([' ', '\t', '\n', '\r']);
function pular(t, i) { while (i < t.length && BRANCO.has(t[i])) i++; return i; }
function fimTexto(t, i) { for (i++; i < t.length; i++) { if (t[i] === '\\') i++; else if (t[i] === '"') return i + 1; } throw erro('invalido'); }
function fimValor(t, i) {
  const c = t[i];
  if (c === '"') return fimTexto(t, i);
  if (c === '{') return membros(t, i).fim;
  if (c === '[') return itens(t, i).fim;
  let j = i;
  while (j < t.length && !BRANCO.has(t[j]) && t[j] !== ',' && t[j] !== '}' && t[j] !== ']') j++;
  if (j === i) throw erro('invalido');
  return j;
}
function membros(t, i) {
  const mapa = new Map(), ordem = [];
  let j = pular(t, i + 1);
  if (t[j] === '}') return { ini: i, fim: j + 1, mapa, ordem };
  for (;;) {
    if (t[j] !== '"') throw erro('invalido');
    const chaveIni = j, chaveFim = fimTexto(t, j), nome = JSON.parse(t.slice(chaveIni, chaveFim));
    const pontos = pular(t, chaveFim);
    if (t[pontos] !== ':') throw erro('invalido');
    const ini = pular(t, pontos + 1), fim = fimValor(t, ini), m = { nome, chaveIni, chaveFim, pontos, ini, fim };
    mapa.set(nome, m); ordem.push(m);
    j = pular(t, fim);
    if (t[j] === ',') { j = pular(t, j + 1); continue; }
    if (t[j] === '}') return { ini: i, fim: j + 1, mapa, ordem };
    throw erro('invalido');
  }
}
function itens(t, i) {
  const lista = [];
  let j = pular(t, i + 1);
  if (t[j] === ']') return { ini: i, fim: j + 1, lista };
  for (;;) {
    const ini = j, fim = fimValor(t, ini);
    lista.push({ ini, fim });
    j = pular(t, fim);
    if (t[j] === ',') { j = pular(t, j + 1); continue; }
    if (t[j] === ']') return { ini: i, fim: j + 1, lista };
    throw erro('invalido');
  }
}

function virarNoTexto(texto, id, ligada, quando) {
  const raiz = membros(texto, pular(texto, 0)), tasks = raiz.mapa.get('tasks');
  if (!tasks || texto[tasks.ini] !== '[') throw erro('invalido');
  for (const item of itens(texto, tasks.ini).lista) {
    if (texto[item.ini] !== '{') continue;
    const obj = membros(texto, item.ini), mid = obj.mapa.get('id');
    if (!mid || texto[mid.ini] !== '"' || JSON.parse(texto.slice(mid.ini, mid.fim)) !== id) continue;
    const mch = obj.mapa.get('chave');
    if (!mch || texto[mch.ini] !== '{') throw erro('invalido');
    const ch = membros(texto, mch.ini), novo = { ligada, por: 'ele', quando }, trocas = [];
    if (!ch.ordem.length) throw erro('invalido');
    const primeiro = ch.ordem[0], ultimo = ch.ordem[ch.ordem.length - 1];
    const antesDaChave = texto.slice(mch.ini + 1, primeiro.chaveIni), depoisDosPontos = texto.slice(primeiro.pontos + 1, primeiro.ini);
    const entre = antesDaChave.includes('\n') ? antesDaChave : (depoisDosPontos ? ' ' : '');
    let faltam = '';
    for (const k of ['ligada', 'por', 'quando']) {
      const m = ch.mapa.get(k);
      if (m) trocas.push({ ini: m.ini, fim: m.fim, novo: JSON.stringify(novo[k]) });
      else faltam += ',' + entre + JSON.stringify(k) + ':' + depoisDosPontos + JSON.stringify(novo[k]);
    }
    if (faltam) trocas.push({ ini: ultimo.fim, fim: ultimo.fim, novo: faltam, insere: true });

    trocas.sort((a, b) => b.fim - a.fim || (a.insere ? -1 : 1));
    let saida = texto;
    for (const tr of trocas) saida = saida.slice(0, tr.ini) + tr.novo + saida.slice(tr.fim);
    return saida;
  }
  throw erro('id');
}

function dormir(ms) { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch { const fim = Date.now() + ms; while (Date.now() < fim) {  } } }
function pegarTrava(trava, esperaMs) {
  const ate = Date.now() + esperaMs;
  let venceu = false;
  for (;;) {
    let falha = null;
    try { const fd = fs.openSync(trava, 'wx'); try { fs.writeSync(fd, String(process.pid)); } catch {  } return fd; }
    catch (e) { falha = e || {}; }
    if (!['EEXIST', 'EPERM', 'EACCES', 'EBUSY'].includes(falha.code)) throw erro('gravar');
    if (falha.code === 'EEXIST' && !venceu) {
      let velha = false;
      try { velha = Date.now() - fs.statSync(trava).mtimeMs > TRAVA_VELHA_MS; } catch { velha = false; }
      if (velha) { venceu = true; try { fs.unlinkSync(trava); } catch {  } continue; }
    }
    if (Date.now() >= ate) throw erro('ocupado');
    dormir(12 + Math.floor(Math.random() * 24));
  }
}
function soltarTrava(fd, trava) { try { fs.closeSync(fd); } catch {  } try { fs.unlinkSync(trava); } catch {  } }
function gravarAtomico(arquivo, bytes) {
  const tmp = arquivo + '.' + process.pid + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
  try {
    fs.writeFileSync(tmp, bytes, { flag: 'wx' });
    try { const fd = fs.openSync(tmp, 'r+'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } } catch {  }
    let ultimo = null;
    for (let i = 0; i < 40; i++) {
      try { fs.renameSync(tmp, arquivo); return; }
      catch (e) { ultimo = e; if (!e || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) break; dormir(25); } // leitor com o arquivo aberto no Windows: tenta de novo
    }
    throw ultimo || Error('renomear');
  } catch {
    try { fs.unlinkSync(tmp); } catch {  }
    throw erro('gravar');
  }
}

function create({ root, dir, port, now = Date.now, soLeitura = false, painelDir = __dirname, esperaTravaMs = 1500 } = {}) {
  const porta = Number(port);
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) throw Error('porta invalida');
  const pasta = dir || (root ? path.join(root, 'estado') : null);
  if (!pasta) throw Error('pasta do estado ausente');
  const estadoDir = path.resolve(pasta), arquivo = path.join(estadoDir, ARQUIVO), log = path.join(estadoDir, LOG);
  const hosts = new Set(['127.0.0.1:' + porta, 'localhost:' + porta]);
  const origens = new Set(['http://127.0.0.1:' + porta, 'http://localhost:' + porta]);
  const token = crypto.randomBytes(24).toString('hex');
  const tokenOk = req => { const t = req.headers['x-chaves-token']; return typeof t === 'string' && t.length === token.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(token)); };
  const ctJson = req => String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() === 'application/json';

  function ler() { return lerArquivo(estadoDir); }

  function virar(id, ligada, confirmado) {
    if (soLeitura) throw erro('so-leitura');
    if (typeof id !== 'string' || !id || typeof ligada !== 'boolean') throw erro('corpo');
    if (confirmado !== true) throw erro('confirmar'); // sem o "Sim" dele nada e escrito, nem por dentro do servidor
    const antes = ler();
    if (!antes.ok) throw erro(antes.erro, antes.detalhe);
    const fd = pegarTrava(arquivo + '.lock', esperaTravaMs);
    try {
      const lido = ler(); // rele com a trava na mao: a virada parte do que esta no disco agora
      if (!lido.ok) throw erro(lido.erro, lido.detalhe);
      const tarefa = lido.dados.tasks.find(t => t.id === id);
      if (!tarefa) throw erro('id');
      const de = tarefa.chave.ligada, quando = new Date(now()).toISOString();
      const novoTexto = virarNoTexto(lido.texto, id, ligada, quando);

      const esperado = JSON.parse(lido.texto), alvo = esperado.tasks.find(t => t.id === id);
      alvo.chave.ligada = ligada; alvo.chave.por = 'ele'; alvo.chave.quando = quando;
      let conferido = null;
      try { conferido = JSON.parse(novoTexto); } catch { conferido = null; }
      if (!conferido || JSON.stringify(conferido) !== JSON.stringify(esperado)) throw erro('gravar');
      const bytes = Buffer.from(novoTexto, 'utf8');
      gravarAtomico(arquivo, bytes);
      const muda = textoMuda(tarefa, ligada); // do arquivo relido na trava; null = a tarefa nao tem texto para essa direcao
      let logOk = true;
      try { fs.appendFileSync(log, JSON.stringify({ quando, id, nome: tarefa.nome, de, para: ligada, por: 'ele', muda }) + '\n', 'utf8'); } catch { logOk = false; }
      return { ok: true, id, de, para: ligada, por: 'ele', quando, muda, assinatura: sha1(bytes), log: logOk };
    } finally { soltarTrava(fd, arquivo + '.lock'); }
  }

  async function corpo(req) {
    const partes = []; let tam = 0;
    for await (const p of req) { const b = Buffer.isBuffer(p) ? p : Buffer.from(p); tam += b.length; if (tam > MAX_CORPO) return { grande: true }; partes.push(b); }
    return { texto: Buffer.concat(partes).toString('utf8') };
  }

  async function handle(req, url, { send, example = false } = {}) {
    const p = url.pathname;
    if (req.method === 'GET' && assets.includes(p.slice(1))) {
      try { send(200, fs.readFileSync(path.join(painelDir, p.slice(1))), p.endsWith('.css') ? 'text/css' : 'text/javascript'); } catch { send(503, { ok: false, erro: 'arquivo' }); }
      return true;
    }
    if (p !== '/api/chaves' && p !== '/api/chaves/virar') return false;
    const virando = p === '/api/chaves/virar';
    if (!loopback(req.socket && req.socket.remoteAddress) || !hosts.has(req.headers.host)) { send(403, { ok: false, erro: 'so-local', mensagem: 'As chaves só abrem neste computador.' }); return true; }
    if (req.method !== (virando ? 'POST' : 'GET')) { send(405, { ok: false, erro: 'metodo' }); return true; }
    if (!virando) {
      if (example) { send(200, { ok: false, example: true }); return true; }
      const lido = ler();
      if (!lido.ok) { send(lido.erro === 'ausente' ? 404 : 503, { ok: false, erro: lido.erro, detalhe: lido.detalhe, solucao: SOLUCAO }); return true; }
      send(200, { ok: true, token, assinatura: lido.assinatura, soLeitura: !!soLeitura, lidoEm: new Date(now()).toISOString(), dados: lido.dados });
      return true;
    }
    if (example) { send(403, { ok: false, erro: 'exemplo', mensagem: 'No exemplo a chave não grava.' }); return true; }
    if (soLeitura) { send(403, { ok: false, erro: 'so-leitura', mensagem: 'Esta cópia do painel é só leitura.' }); return true; }
    const site = req.headers['sec-fetch-site'];
    if (!origens.has(req.headers.origin) || (site !== undefined && site !== 'same-origin')) { send(403, { ok: false, erro: 'origem', mensagem: 'A chave só vira de dentro do painel.' }); return true; }
    if (!ctJson(req)) { send(403, { ok: false, erro: 'tipo' }); return true; }
    if (!tokenOk(req)) { send(403, { ok: false, erro: 'token', mensagem: 'O painel reiniciou: a tela pede a chave de novo.' }); return true; }
    let c;
    try { c = await corpo(req); } catch { send(400, { ok: false, erro: 'json' }); return true; }
    if (c.grande) { send(413, { ok: false, erro: 'grande' }); return true; }
    let j;
    try { j = JSON.parse(c.texto); } catch { send(400, { ok: false, erro: 'json' }); return true; }
    const campos = j && typeof j === 'object' && !Array.isArray(j) ? Object.keys(j) : null;
    if (!campos || campos.some(k => !['id', 'ligada', 'confirmado'].includes(k)) || typeof j.id !== 'string' || !j.id || j.id.length > 200 || typeof j.ligada !== 'boolean') { send(400, { ok: false, erro: 'corpo', mensagem: 'Pedido fora do formato: id, ligada (verdadeiro ou falso) e confirmado.' }); return true; }
    if (j.confirmado !== true) { send(400, { ok: false, erro: 'confirmar', mensagem: 'Falta a confirmação: a chave só vira depois do Sim.' }); return true; }
    try { send(200, virar(j.id, j.ligada, true)); }
    catch (e) {
      const codigo = e && e.codigo;
      if (codigo === 'id') send(404, { ok: false, erro: 'id', mensagem: 'Essa tarefa não está mais na lista.' });
      else if (codigo === 'confirmar') send(400, { ok: false, erro: 'confirmar', mensagem: 'Falta a confirmação: a chave só vira depois do Sim.' });
      else if (codigo === 'ausente') send(404, { ok: false, erro: 'ausente', detalhe: e.detalhe, solucao: SOLUCAO });
      else if (codigo === 'invalido') send(503, { ok: false, erro: 'invalido', detalhe: e.detalhe, solucao: SOLUCAO });
      else if (codigo === 'ocupado') send(409, { ok: false, erro: 'ocupado', mensagem: 'Outra gravação estava no meio. Tente de novo.' });
      else if (codigo === 'so-leitura') send(403, { ok: false, erro: 'so-leitura' });
      else send(500, { ok: false, erro: 'gravar', mensagem: 'Não consegui gravar. Tente de novo.' });
    }
    return true;
  }

  return { handle, virar, ler, token, arquivo, log, dir: estadoDir };
}

module.exports = { create, assets, validar, lerArquivo, virarNoTexto, ARQUIVO, LOG, ESTADOS, SOLUCAO };
