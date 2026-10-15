'use strict';
// Le estado/ia-tips.json (as dicas) e estado/ia-alimentacao.json (o progresso de hoje, mesmo formato).
// Grava SO estado/ia-alimentacao.json, com a mesma trava (.lock) do alimentacao.cjs, entao o detector de uso real
// (FeedingScanner) segue funcionando: ele so premia dica que esta em "collected".
// Rotas: GET /api/ia-conceito · POST /api/ia-conceito/copiei {ids:[...]} · GET /ia-conceito/<arquivo do front>.
const fs = require('node:fs'), path = require('node:path');
const { randomUUID } = require('node:crypto');

const ID = /^[\w.-]{1,80}$/;
const RARIDADES = { comum: 10, rara: 25, epica: 50, lendaria: 100 };
const LIMITE_DIA = 500;
const GRUPO_DO_TEMA = { economia: 'gastar', qualidade: 'errar', equipe: 'equipe', produtividade: 'organizar', decisao: 'organizar' };
const GRUPOS_PADRAO = {
  gastar: { pt: 'Gastar menos', en: 'Spend less', es: 'Gastar menos' },
  errar: { pt: 'Errar menos', en: 'Fewer mistakes', es: 'Menos errores' },
  equipe: { pt: 'Trabalhar em equipe', en: 'Teamwork', es: 'Trabajo en equipo' },
  organizar: { pt: 'Organizar', en: 'Stay organized', es: 'Organizar' }
};
const FRONT = {
  'ia-nucleo.js': 'text/javascript', 'ia.css': 'text/css',
  'ia-a.js': 'text/javascript', 'ia-a.css': 'text/css',
  'ia-b.js': 'text/javascript', 'ia-b.css': 'text/css',
  'ia-c.js': 'text/javascript', 'ia-c.css': 'text/css'
};

const texto = (valor, max) => typeof valor === 'string' ? valor.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/\s*[\u2013\u2014]\s*/g, ': ').trim().slice(0, max) : '';
const diaDe = agora => new Date(agora.getTime() - 3 * 3600000).toISOString().slice(0, 10);

function lerSeguro(arquivo, max) {
  try {
    const info = fs.lstatSync(arquivo);
    if (info.isSymbolicLink() || !info.isFile() || info.size > max) return null;
    return fs.readFileSync(arquivo, 'utf8');
  } catch { return null; }
}

function lerDicas(estadoDir) {
  let bruto; try { bruto = JSON.parse(lerSeguro(path.join(estadoDir, 'ia-tips.json'), 128000) || 'null'); } catch { bruto = null; }
  if (!bruto || !Array.isArray(bruto.dicas)) return { dicas: [], grupos: GRUPOS_PADRAO };
  const grupos = {};
  for (const [chave, nomes] of Object.entries(bruto.grupos && typeof bruto.grupos === 'object' ? bruto.grupos : GRUPOS_PADRAO)) {
    if (!/^[a-z]{1,20}$/.test(chave) || !nomes) continue;
    grupos[chave] = { pt: texto(nomes.pt, 40), en: texto(nomes.en, 40), es: texto(nomes.es || nomes.pt, 40) };
  }
  const vistos = new Set(), dicas = [];
  for (const dica of bruto.dicas.slice(0, 100)) {
    if (!dica || !ID.test(dica.id || '') || vistos.has(dica.id)) continue;
    const lingua = valor => valor && typeof valor.colar === 'string' ? { titulo: texto(valor.titulo, 100), porque: texto(valor.porque, 240), colar: texto(valor.colar, 4000) } : null;
    const pt = lingua(dica.pt), en = lingua(dica.en);
    if (!pt?.colar || !en?.colar) continue;
    vistos.add(dica.id);
    const raridade = Object.hasOwn(RARIDADES, dica.raridade) ? dica.raridade : 'comum';
    let grupo = typeof dica.grupo === 'string' && grupos[dica.grupo] ? dica.grupo : GRUPO_DO_TEMA[dica.tema] || 'organizar';
    if (!grupos[grupo]) grupos[grupo] = GRUPOS_PADRAO[grupo] || { pt: grupo, en: grupo, es: grupo };
    dicas.push({ id: dica.id, grupo, raridade, xp: RARIDADES[raridade], pt, en });
  }
  return { dicas, grupos };
}

function estadoNovo() { return { version: 1, xp: 0, lastFedAt: null, days: {}, collected: [], bonuses: [] }; }
// Mesmo contrato do alimentacao.cjs (readState): arquivo invalido nao vira estado zerado em silencio.
function lerProgresso(estadoDir) {
  const arquivo = path.join(estadoDir, 'ia-alimentacao.json'), cortes = lerSeguro(arquivo, 256000);
  if (!cortes) { if (fs.existsSync(arquivo)) throw Error('progresso ilegivel'); return estadoNovo(); }
  const bruto = JSON.parse(cortes);
  if (bruto.version !== 1 || !Number.isSafeInteger(bruto.xp) || bruto.xp < 0 || !bruto.days || typeof bruto.days !== 'object' || !Array.isArray(bruto.collected) || !Array.isArray(bruto.bonuses)) throw Error('progresso invalido');
  const estado = estadoNovo();
  estado.xp = bruto.xp;
  estado.lastFedAt = typeof bruto.lastFedAt === 'string' && Number.isFinite(Date.parse(bruto.lastFedAt)) ? bruto.lastFedAt : null;
  estado.collected = [...new Set(bruto.collected.filter(id => ID.test(id)))].slice(0, 100);
  estado.bonuses = [...new Set(bruto.bonuses.filter(id => ID.test(id)))].slice(0, 100);
  for (const [dia, registro] of Object.entries(bruto.days)) {
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(dia) || !registro || !Number.isSafeInteger(registro.xp) || registro.xp < 0 || registro.xp > LIMITE_DIA || !Array.isArray(registro.prompts)) throw Error('dia invalido');
    estado.days[dia] = { xp: registro.xp, prompts: [...new Set(registro.prompts.filter(id => ID.test(id)))].slice(0, 100) };
  }
  return estado;
}

function destinoSeguro(estadoDir) {
  const base = path.resolve(estadoDir);
  if (/(?:PRIVADO|_SECRETS|backup-privado|(?:^|[\\/])seed(?:[\\/]|$))/i.test(base)) throw Error('pasta privada');
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
  const info = fs.lstatSync(base);
  if (info.isSymbolicLink() || !info.isDirectory()) throw Error('pasta invalida');
  const arquivo = path.join(base, 'ia-alimentacao.json');
  if (fs.existsSync(arquivo) && (fs.lstatSync(arquivo).isSymbolicLink() || !fs.lstatSync(arquivo).isFile())) throw Error('arquivo invalido');
  return arquivo;
}

// Marca as dicas como copiadas: entram em "collected" (o detector passa a procurar o texto nas conversas)
// e no registro do dia. Pontos seguem o formato antigo (teto de 500 por dia), so para o arquivo continuar valido.
function marcarCopiadas(estadoDir, ids, agora = new Date()) {
  const { dicas } = lerDicas(estadoDir), escolhidas = dicas.filter(dica => ids.includes(dica.id));
  if (!escolhidas.length) throw Error('dica desconhecida');
  const destino = destinoSeguro(estadoDir), trava = destino + '.lock';
  let fd, temporario;
  try {
    fd = fs.openSync(trava, 'wx', 0o600);
    const estado = lerProgresso(estadoDir), dia = diaDe(agora), registro = estado.days[dia] || { xp: 0, prompts: [] }, novos = [];
    for (const dica of escolhidas) {
      if (!estado.collected.includes(dica.id)) { estado.collected.push(dica.id); novos.push(dica.id); }
      if (!registro.prompts.includes(dica.id)) {
        registro.prompts.push(dica.id);
        const pontos = Math.min(dica.xp, LIMITE_DIA - registro.xp);
        if (pontos > 0) { registro.xp += pontos; estado.xp += pontos; }
      }
    }
    estado.days[dia] = registro;
    estado.lastFedAt = agora.toISOString();
    temporario = destino + '.' + randomUUID() + '.tmp';
    fs.writeFileSync(temporario, JSON.stringify(estado) + '\n', { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporario, destino); temporario = null;
    return { estado, novos };
  } finally {
    if (temporario) { try { fs.unlinkSync(temporario); } catch { /* sem sobra */ } }
    if (fd !== undefined) { fs.closeSync(fd); try { fs.unlinkSync(trava); } catch { /* ja saiu */ } }
  }
}

// Retratos para as cartas: os do pacote verificado do painel (agentes/manifest.json), espalhados pelo pacote.
// O painel so serve a imagem cujo sha256 bate com o manifesto; a tela troca pela marca se alguma falhar.
function retratos(painelDir, quantos) {
  if (!painelDir) return [];
  let manifesto; try { manifesto = JSON.parse(lerSeguro(path.join(painelDir, 'agentes', 'manifest.json'), 128000) || 'null'); } catch { manifesto = null; }
  const arquivos = (manifesto?.entries || []).map(e => e && e.arquivo).filter(a => typeof a === 'string' && /^agentes\/[1-9]\d{0,4}\.png$/.test(a));
  arquivos.sort((a, b) => Number(a.slice(4, -4)) - Number(b.slice(4, -4)));
  if (!arquivos.length) return [];
  const saida = [];
  for (let i = 0; i < quantos; i++) saida.push('/' + arquivos[Math.round(i * (arquivos.length - 1) / Math.max(1, quantos - 1)) % arquivos.length]);
  return [...new Set(saida)];
}

function resumo(estadoDir, contexto) {
  const { dicas, grupos } = lerDicas(estadoDir), ids = new Set(dicas.map(dica => dica.id));
  // No modo exemplo (?exemplo=1) o progresso real nao aparece: a tela mostra as dicas e nada copiado.
  const estado = contexto.example === true ? estadoNovo() : lerProgresso(estadoDir);
  const dias = Object.keys(estado.days).filter(dia => estado.days[dia].prompts.length).sort();
  return {
    ok: true, versao: 1, dicas, grupos, agentes: retratos(contexto.painelDir, dicas.length),
    copiados: estado.collected.filter(id => ids.has(id)),
    emUso: estado.bonuses.filter(id => ids.has(id)),
    ultimaCopia: estado.lastFedAt, diasComCopia: dias.length,
    nonce: contexto.nonce || null, exemplo: contexto.example === true, lidoEm: new Date().toISOString()
  };
}

function handle(req, url, contexto) {
  const caminho = url.pathname;
  if (!caminho.startsWith('/api/ia-conceito') && !caminho.startsWith('/ia-conceito/')) return false;
  const estadoDir = contexto.estadoDir || path.join(contexto.root, 'estado');
  const send = contexto.send;
  if (req.method === 'GET' && caminho.startsWith('/ia-conceito/')) {
    const nome = caminho.slice('/ia-conceito/'.length);
    if (!Object.hasOwn(FRONT, nome)) { send(404, { error: 'Not found' }); return true; }
    const bytes = lerSeguro(path.join(__dirname, nome), 400000);
    if (bytes === null) send(404, { error: 'Not found' }); else send(200, bytes, FRONT[nome]);
    return true;
  }
  if (req.method === 'GET' && caminho === '/api/ia-conceito') {
    try { send(200, resumo(estadoDir, contexto)); } catch { send(503, { ok: false, error: 'ia_unavailable' }); }
    return true;
  }
  if (req.method === 'POST' && caminho === '/api/ia-conceito/copiei') {
    const origens = ['http://127.0.0.1:' + contexto.port, 'http://localhost:' + contexto.port];
    if (contexto.example) { req.resume(); send(409, { ok: false, error: 'example_disabled' }); return true; }
    if (!origens.includes(req.headers.origin) || req.headers['content-type'] !== 'application/json' || !contexto.nonce || req.headers['x-painel-nonce'] !== contexto.nonce) { req.resume(); send(403, { ok: false, error: 'invalid_request' }); return true; }
    (async () => {
      try {
        const partes = []; let tamanho = 0;
        for await (const parte of req) { tamanho += parte.length; if (tamanho > 2048) return send(413, { ok: false, error: 'too_large' }); partes.push(parte); }
        const corpo = JSON.parse(Buffer.concat(partes).toString('utf8'));
        if (!corpo || Array.isArray(corpo) || Object.keys(corpo).length !== 1 || !Array.isArray(corpo.ids) || !corpo.ids.length || corpo.ids.length > 100 || corpo.ids.some(id => typeof id !== 'string' || !ID.test(id))) return send(400, { ok: false, error: 'invalid_json' });
        const { novos } = marcarCopiadas(estadoDir, [...new Set(corpo.ids)]);
        contexto.notify?.();
        send(200, { ...resumo(estadoDir, contexto), novos });
      } catch { send(409, { ok: false, error: 'save_unavailable' }); }
    })();
    return true;
  }
  req.resume();
  send(405, { ok: false, error: 'method_not_allowed' });
  return true;
}

module.exports = { handle, lerDicas, lerProgresso, marcarCopiadas, resumo, FRONT };
