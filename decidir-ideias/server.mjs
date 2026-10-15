import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, stat } from 'node:fs/promises';
import { carregar, placar, limpar, classificar, erro, comTrava, acrescentar, novaHora, reacoes, VEREDITOS,
  PROJETOS, ACOES_LOTE, planoDoLote, reacoesDoLote, idsDoLote, resumoDoLote, nomeDoProjeto } from './estado.mjs';
import { criarLeitorDeEquipe } from './equipe.mjs';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(process.env.DADOS || path.join((process.env.PAINEL_ROOT || decodeURIComponent(new URL('../estado-local/', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1')), 'estado/ideias'));
// Equipe online: estado/ (a pasta acima de ideias/) ou ESTADO; EQUIPE_APP e EQUIPE_PROJETOS só nos testes.
const lerEquipe = criarLeitorDeEquipe({ estadoDir: path.resolve(process.env.ESTADO || path.join(dataDir, '..')),
  ...(process.env.EQUIPE_APP !== undefined ? { appRoot: process.env.EQUIPE_APP } : {}),
  ...(process.env.EQUIPE_PROJETOS !== undefined ? { projetosRoot: process.env.EQUIPE_PROJETOS } : {}) });
const port = Number(process.env.PORTA || 3259);
// O painel que abre este app num iframe (PAINEL_PORT, padrao 3250).
const PAINEL_PORTA = Number(process.env.PAINEL_PORT || 3257), PAINEL_ORIGENS = `http://127.0.0.1:${PAINEL_PORTA} http://localhost:${PAINEL_PORTA}`;
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORTA precisa ser um número entre 1 e 65535.');
try { if (!(await stat(dataDir)).isDirectory()) throw new Error(); }
catch { throw new Error('A pasta DADOS não existe. Configure DADOS antes de iniciar o app.'); }

// Serializa leituras e escritas deste processo. A trava de arquivo protege outra instância.
let pending = Promise.resolve();
function serial(task) {
  const next = pending.then(task);
  pending = next.catch(() => {});
  return next;
}
const ARTES = new Set(['visionario', 'cetico', 'operador', 'cientista', 'filosofo', 'politico', 'economista', 'artista', 'advogado', 'cliente', 'claude', 'codex']);
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/estilo.css', ['estilo.css', 'text/css; charset=utf-8']],
  ['/cliente.js', ['cliente.js', 'text/javascript; charset=utf-8']],
]);
function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
async function body(req) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) throw erro(415, 'Envie JSON.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8192) throw erro(413, 'O texto é grande demais.');
    chunks.push(chunk);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error();
    return data;
  } catch { throw erro(400, 'JSON inválido.'); }
}
async function decidir(data, revisao = false) {
  return comTrava(dataDir, async () => {
    const state = await carregar(dataDir);
    if (typeof data.id !== 'string') throw erro(400, 'Informe o id da ideia.');
    let opcao = typeof data.opcao === 'string' && VEREDITOS.includes(data.opcao) ? VEREDITOS.indexOf(data.opcao) + 1 : data.opcao;
    if (!Number.isInteger(opcao) || opcao < 1 || opcao > 4) throw erro(400, 'Escolha uma opção de 1 a 4.');
    const idea = (revisao ? state.revisao : state.fila).find(i => i.id === data.id);
    if (!idea) throw erro(state.byId.has(data.id) ? 409 : 404, revisao
      ? 'Essa ideia não está mais entre as aceitas para rever. Atualize a tela.'
      : 'Essa ideia já foi decidida ou não está na fila. Atualize a tela.');
    if (data.texto !== undefined && typeof data.texto !== 'string') throw erro(400, 'O texto precisa ser uma frase.');
    if ((data.texto || '').length > 300) throw erro(400, 'Use até 300 caracteres.');
    const input = data.texto ?? idea.opcoes[opcao - 1].texto;
    if (/0x[a-f\d]{40,}|\b[a-f\d]{64}\b|\b[1-9A-HJ-NP-Za-km-z]{32,44}\b|(?:seed phrase|mnemonico|chave privada|private key)\s*[:=]/i.test(input)) {
      throw erro(400, 'Use só a condição da ideia, sem endereços ou segredos.');
    }
    const texto = limpar(input);
    if ([2, 3].includes(opcao) && !texto) throw erro(400, 'Escreva o ajuste ou a condição antes de decidir.');
    // Também normaliza pela API. Um ajuste novo e importante não é um "tanto faz".
    if (opcao === 2 && idea.tantoFaz && classificar(texto).marca === 'DETALHE') opcao = 1;
    const hora = novaHora(state), before = placar(state);
    const label = (idea.temDebate ? ['Aceitar', 'Aceitar com ressalvas', 'Só se', 'Rejeitar']
      : ['Aceitar', 'Aceitar com ajuste', 'Guardar para depois', 'Rejeitar'])[opcao - 1];
    const decision = { t: 'decisao', id: idea.id, hora, autor: 'dono',
      estado: opcao === 4 ? 'descartada' : 'escolhida', motivo: revisao ? 'revisao' : `${label}: ${opcao === 1 ? idea.opcoes[0].detalhe : texto || idea.opcoes[opcao - 1].detalhe}`, card: '' };
    const seal = { t: 'selo', id: idea.id, titulo: idea.titulo, veredito: VEREDITOS[opcao - 1],
      condicao: [2, 3].includes(opcao) ? texto : '', hora, origem: 'app decidir-ideias' };
    await acrescentar(dataDir, [['ideias.jsonl', decision], ['vereditos-dono.jsonl', seal]]);
    const next = await carregar(dataDir), after = placar(next);
    return { ideia: idea, decisao: seal, reacoes: reacoes(before, after, idea, opcao), placar: after, fila: next.fila, revisao: next.revisao };
  });
}
// v4: decidir em lote as pendentes de um projeto. Grava as mesmas 2 linhas da decisão 1 a 1 por ideia, com o id do lote.
async function decidirLote(data) {
  return comTrava(dataDir, async () => {
    const projeto = PROJETOS.find(p => p.id === data.projeto);
    if (!projeto) throw erro(400, 'Escolha um projeto da barra.');
    if (!ACOES_LOTE.includes(data.acao)) throw erro(400, 'Escolha aceitar, rejeitar ou deixar para depois.');
    if (!Array.isArray(data.ids) || !data.ids.length || data.ids.length > 200 || data.ids.some(id => typeof id !== 'string')) throw erro(400, 'Informe as ideias do lote.');
    const state = await carregar(dataDir);
    const plano = planoDoLote(state.fila, projeto.id, data.acao);
    // O lote só grava se a tela viu exatamente as mesmas ideias que vão ser decididas.
    const vistos = new Set(data.ids);
    if (!plano.length) throw erro(409, 'Não há ideias para este lote agora. Atualize a tela.');
    if (vistos.size !== data.ids.length || plano.length !== vistos.size || plano.some(p => !vistos.has(p.ideia.id))) {
      throw erro(409, `A fila de ${projeto.nome} mudou. Confira de novo antes de decidir em lote.`);
    }
    const before = placar(state), base = novaHora(state);
    const lote = `L-${base.slice(0, 19).replace(/\D/g, '')}-${projeto.id}`;
    const records = [];
    plano.forEach(({ ideia, opcao, texto, adiada }, k) => {
      const hora = novaHora(state, k);
      const label = (ideia.temDebate ? ['Aceitar', 'Aceitar com ressalvas', 'Só se', 'Rejeitar']
        : ['Aceitar', 'Aceitar com ajuste', 'Guardar para depois', 'Rejeitar'])[opcao - 1];
      const motivo = `${label}: ${opcao === 1 ? ideia.opcoes[0].detalhe : texto || ideia.opcoes[opcao - 1].detalhe} (em lote: ${projeto.nome})`;
      const marca = { lote, loteAcao: data.acao, loteProjeto: projeto.id };
      records.push(['ideias.jsonl', { t: 'decisao', id: ideia.id, hora, autor: 'dono', estado: opcao === 4 ? 'descartada' : 'escolhida', motivo: limpar(motivo), card: '', ...marca }]);
      records.push(['vereditos-dono.jsonl', { t: 'selo', id: ideia.id, titulo: ideia.titulo, veredito: VEREDITOS[opcao - 1],
        condicao: [2, 3].includes(opcao) ? limpar(texto) : '', hora, origem: 'app decidir-ideias', ...marca, ...(adiada ? { adiada: true } : {}) }]);
    });
    await acrescentar(dataDir, records);
    const next = await carregar(dataDir), after = placar(next);
    return { lote: { ...resumoDoLote(next, lote), ideias: plano.map(p => ({ id: p.ideia.id, titulo: p.ideia.titulo, veredito: VEREDITOS[p.opcao - 1], condicao: [2, 3].includes(p.opcao) ? limpar(p.texto) : '' })) },
      reacoes: data.acao === 'depois' ? [] : reacoesDoLote(before, after, lote), placar: after, fila: next.fila, revisao: next.revisao };
  });
}
async function desfazer(data) {
  return comTrava(dataDir, async () => {
    const state = await carregar(dataDir), before = placar(state);
    const last = [...state.effective.values()].filter(x => x.app).sort((a, b) => Date.parse(a.hora) - Date.parse(b.hora)).at(-1);
    if (!last) throw erro(409, 'Não há decisão deste app para desfazer.');
    if (data.lote !== undefined && data.lote !== (last.lote || null)) throw erro(409, 'A última decisão mudou. Atualize a tela antes de desfazer.');
    if (last.lote) {
      // O lote inteiro volta num passo só: uma reabertura para cada ideia ainda selada por ele.
      const resumo = resumoDoLote(state, last.lote), ids = idsDoLote(state, last.lote);
      await acrescentar(dataDir, ids.map((id, k) => ['ideias.jsonl', { t: 'decisao', id, hora: novaHora(state, k), autor: 'dono',
        estado: 'reaberta', motivo: `Desfazer o lote de ${resumo.nome} no app decidir-ideias`, card: '', lote: last.lote }]));
      const next = await carregar(dataDir), after = placar(next);
      return { lote: { ...resumo, desfeito: true, ids }, ideia: next.byId.get(ids[0]), reaberta: true,
        reacoes: reacoesDoLote(before, after, last.lote, true), placar: after, fila: next.fila, revisao: next.revisao };
    }
    if (data.id && data.id !== last.id) throw erro(409, 'A última decisão mudou. Atualize a tela antes de desfazer.');
    const idea = state.byId.get(last.id);
    if (!idea) throw erro(409, 'A ideia da última decisão não está mais nos dados.');
    await acrescentar(dataDir, [['ideias.jsonl', { t: 'decisao', id: last.id, hora: novaHora(state), autor: 'dono',
      estado: 'reaberta', motivo: 'Desfazer a última decisão no app decidir-ideias', card: '' }]]);
    const next = await carregar(dataDir), after = placar(next);
    return { ideia: idea, reaberta: true, reacoes: reacoes(before, after, idea, last.opcao, true), placar: after, fila: next.fila, revisao: next.revisao };
  });
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors " + PAINEL_ORIGENS + "; base-uri 'none'; form-action 'self'");
  try {
    const host = req.headers.host || '';
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(host)) throw erro(403, 'Abra este app pelo endereço local.');
    if (req.method === 'POST' && req.headers.origin && ![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(req.headers.origin)) {
      throw erro(403, 'A decisão precisa partir deste app local.');
    }
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (req.method === 'GET' && assets.has(url.pathname)) {
      const [file, type] = assets.get(url.pathname);
      const content = await readFile(path.join(appDir, file));
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(content);
    } else if (req.method === 'GET' && /^\/letras\/[\w-]+\.(woff2|css)$/.test(url.pathname)) {
      // Fontes do kit, da pasta letras/ ao lado deste app (woff2 local, licença OFL).
      const nome = url.pathname.slice(8);
      const content = await readFile(path.join(appDir, '..', 'letras', nome));
      res.writeHead(200, { 'Content-Type': nome.endsWith('.css') ? 'text/css; charset=utf-8' : 'font/woff2', 'Cache-Control': 'max-age=3600' });
      res.end(content);
    } else if (req.method === 'GET' && /^\/arte\/[a-z]+\.png$/.test(url.pathname) && ARTES.has(url.pathname.slice(6, -4))) {
      // Arte de cada cadeira: peças do Painel, uma por conselheiro (pasta assets/conselho).
      const content = await readFile(path.join(appDir, 'assets', 'conselho', url.pathname.slice(6)));
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=3600' });
      res.end(content);
    } else if (req.method === 'GET' && url.pathname === '/api/fila') {
      send(res, 200, await serial(async () => { const s = await carregar(dataDir); return { ideias: s.fila, total: s.fila.length, revisao: s.revisao, placar: placar(s), projetos: PROJETOS, equipe: lerEquipe() }; }));
    } else if (req.method === 'GET' && url.pathname === '/api/equipe') {
      send(res, 200, { projetos: PROJETOS, equipe: lerEquipe() });
    } else if (req.method === 'POST' && url.pathname === '/api/lote') {
      const input = await body(req); send(res, 200, await serial(() => decidirLote(input)));
    } else if (req.method === 'GET' && url.pathname === '/api/revisao') {
      send(res, 200, await serial(async () => { const s = await carregar(dataDir); return { ideias: s.revisao, total: s.revisao.length, placar: placar(s) }; }));
    } else if (req.method === 'GET' && url.pathname === '/api/placar') {
      send(res, 200, await serial(async () => placar(await carregar(dataDir))));
    } else if (req.method === 'POST' && url.pathname === '/api/decidir') {
      const input = await body(req); send(res, 200, await serial(() => decidir(input)));
    } else if (req.method === 'POST' && url.pathname === '/api/revisar') {
      const input = await body(req); send(res, 200, await serial(() => decidir(input, true)));
    } else if (req.method === 'POST' && url.pathname === '/api/desfazer') {
      const input = await body(req); send(res, 200, await serial(() => desfazer(input)));
    } else if (url.pathname === '/favicon.ico') { res.writeHead(204); res.end(); }
    else send(res, 404, { erro: 'Página não encontrada.' });
  } catch (e) {
    if (!res.headersSent) send(res, e.status || 500, { erro: e.status ? e.message : 'Não foi possível ler ou gravar os dados. Confira a pasta e os arquivos JSON.' });
    else res.end();
    if (!e.status) console.error(e.message);
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Decidir ideias: http://127.0.0.1:${port}`));
server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? 'Porta ocupada. Escolha outra PORTA.' : e.message); process.exitCode = 1; });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
