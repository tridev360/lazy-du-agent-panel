'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { readSafe, files } = require('./leitor.cjs');
const D = require('./descoberta.cjs');
const SOURCES = { cards: 'estado/cards', cronograma: 'estado/cronograma.json', entregas: 'estado/entregas.json', ideias: 'estado/ideias/ideias.jsonl' };
const ROUTES = { '/api/pc-cards/lista': 'cards', '/api/cronograma': 'cronograma', '/api/entregas': 'entregas', '/api/ideias': 'ideias' };
function stateSources(root, enabled = true) {
  return Object.fromEntries(Object.entries(SOURCES).map(([key, file]) => {
    let available = false, count = 0;
    if (enabled && key === 'cards') available = files(root, file, '.json').filter(f => { try { const c = JSON.parse(readSafe(root, file + '/' + f)); const valid=c && typeof c.id === 'string' && typeof c.pergunta === 'string';if(valid && !c.respondido)count++;return valid; } catch { return false; } }).length > 0;
    else if (enabled && key === 'ideias') available = !!readSafe(root, file, 8 * 1024 * 1024).trim();
    else if (enabled) try { const j = JSON.parse(readSafe(root, file)); available = !!j && typeof j === 'object' && !Array.isArray(j) && (key === 'entregas' ? Array.isArray(j.entregas) : Array.isArray(j.hoje)); } catch {}
    return [key, { available, count: key === 'cards' ? count : undefined, file, solucao: 'Para começar: passo 2 (pasta metodo/), usando estado-local. Quem grava é a sua IA, com um sim por arquivo. Para outra pasta, veja PAINEL_ROOT no README.' }];
  }));
}
function missing(source) { return { ok: true, lido: false, valor: null, sourceState: 'missing', motivo: 'Estado ausente ou sem leitura.', solucao: source.solucao }; }
function bridge(snapshot) {
  // O Fluxo só aceita agente que diz a conversa de origem: a sessão no topo da cadeia de parentId.
  const all = [...snapshot.sessions, ...snapshot.helpers], byId = new Map(all.map(x => [x.id, x]));
  const origem = x => { const seen = new Set(); let c = x; while (c && c.parentId && !seen.has(c.id) && seen.size < 16) { seen.add(c.id); c = byId.get(c.parentId); } return c && !c.parentId ? c.id : null; };
  const agents = all.map(x => ({ ...x, title: x.name, ownerSession: x.parentId || x.id, parentId: x.parentId, conversationId: origem(x), isSubagent: !!x.parentId, project: snapshot.projects.find(p => p.id === x.projectId)?.name || '?' }));
  return { ...snapshot, wenSnapshot: {sessions:snapshot.sessions,helpers:snapshot.helpers,projects:snapshot.projects}, equipe: { agents, projects: snapshot.projects, total: agents.length, active: agents.filter(x => x.status === 'ativa').length, tokens: snapshot.consumption.tokens, countsExact: true, tokensExact: snapshot.consumption.exact }, operator: { sessions: snapshot.sessions.map(x => ({ id: x.id, name: x.name, title: x.name, node: x, summary: { fields: {}, available: false } })), codex: [] }, commandSessions: [], commandsEnabled: false, public: false };
}
function statePage(tab) {
  const head = '<!doctype html><html lang="pt-BR" data-painel-tab="home" data-g-old="queue"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/automatico.css"><link rel="stylesheet" href="/painel.css">';
  const parts = {
    cards: ['<link rel="stylesheet" href="/pc-cards/pc-cards.css"><script defer src="/pc-cards/pc-cards.js"></script>', '<div data-pc-cards data-api="/api/pc-cards"></div>'],
    cronograma: ['<link rel="stylesheet" href="/cronograma.css"><script defer src="/cronograma.js"></script><script defer src="/estado-aba.js"></script>', '<main></main>'],
    entregas: ['<link rel="stylesheet" href="/entregas.css"><script defer src="/entregas.js" data-lugares="fila"></script>', '<main><div id="panel-queue"></div></main>'],
    ideias: ['<link rel="stylesheet" href="/ideias.css"><script defer src="/ideias.js"></script>', '<main><section id="ideias-panel"></section></main>']
  };
  return head + parts[tab][0] + '</head><body class="v2-state-page">' + parts[tab][1] + '</body></html>';
}
// Uso do Claude na entrada: a linha mais nova de estado/credito-claude.jsonl (a mesma do WEN). Sem leitura: "?" com a solucao.
function claudeLimite(root, now = Date.now()) {
  let c = null; try { c = require('./credito-claude.cjs').claudeCredit(root, new Date(now)); } catch { c = null; }
  const semana = c && c.windows.find(w => w.minutes === 10080), janela = c && c.windows.find(w => w.minutes === 300);
  if (!semana && !janela) return { solucao: 'Solução: peça ao seu Claude para gravar o /usage em estado/credito-claude.jsonl (ou rode /usage no Claude Code).' };
  return { ...(semana ? { semana: semana.used } : {}), ...(janela ? { janela5h: janela.used } : {}), lidoEm: c.updated };
}
// Prova do modo so metadados para o fluxo de quem chama quem: a hora da leitura vai junto (sem ela o fluxo dava 503).
function provedorMetadados(scan) {
  let revisao = 0;
  return { metadataOnly: true, policyId: 'pe-scalar-v1', close() {}, snapshot: () => { const s = scan(); return { updated: s.updated, proof: { mode: 'scalar-metadata', policyId: 'pe-scalar-v1', revision: ++revisao, observedAt: s.updated }, equipe: bridge(s).equipe, wenSnapshot: bridge(s).wenSnapshot, commandSessions: [], metadataRecords: [], codexCredit: null }; } };
}
// Rotina da demo: so a pasta de estado da demo (demo/estado), so GET/HEAD de /api/rotina e /api/rotina/voltas, so leitura
// (nao anota volta, nao responde card: sem token). Qualquer outra pasta ou metodo segue barrado (null).
function rotinaDemo(root, pathname, method, demoRoot = path.join(__dirname, 'demo', 'estado')) {
  if (method !== 'GET' && method !== 'HEAD') return null;
  if (pathname !== '/api/rotina' && pathname !== '/api/rotina/voltas') return null;
  let raiz, demo; try { raiz = fs.realpathSync(path.resolve(String(root || ''))); demo = fs.realpathSync(path.resolve(demoRoot)); } catch { return null; }
  if (raiz !== demo) return null;
  const R = require('./rotina.cjs');
  try {
    if (pathname === '/api/rotina/voltas') return { ok: true, lidoEm: new Date().toISOString(), voltas: R.voltasPublicas(raiz) };
    const r = R.readInfinity(raiz); delete r.token;
    return { ...r, responde: false };
  } catch { return null; }
}
function createServer(root, options = {}) {
  const port = options.port || 3257;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Porta local invalida');
  const stateEnabled = options.stateEnabled === undefined ? !!root || fs.existsSync(path.join(__dirname,'estado-local')) : options.stateEnabled;
  root = path.resolve(root || path.join(__dirname, 'estado-local'));
  const home = options.home || process.env.PAINEL_HOME || require('node:os').homedir();
  let cached = null, legacy = null, monitores = null;
  const r10=require('./r10-servicos.cjs').create({root,port,soLeitura:require('./so-leitura.cjs').ativo,descobertas:()=>((cached&&cached.sessions)||[]).map(s=>s&&s.id)});
  const r9=require('./r9-rotas.cjs').create({root,port,soLeitura:require('./so-leitura.cjs').ativo});
  const worker = new (require('node:worker_threads').Worker)(path.join(__dirname,'descoberta-worker.cjs'), {workerData:{home,now:options.now,configDir:options.configDir||(path.resolve(home)===path.join(__dirname,'demo','home')?path.join(__dirname,'demo','config'):undefined),homes:options.homes,sourcesDir:options.sourcesDir,claudeHome:options.claudeHome,codexHome:options.codexHome}});
  let readyResolve, readyReject;
  const ready = new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
  // A leitura pesada fica fora da linha do servidor. Cada rodada preserva o cache incremental do worker.
  worker.on('message',msg=>{if(msg.data){cached=msg.data;readyResolve();}else if(!cached)readyReject(Error(msg.error));});
  worker.on('error',readyReject);
  const enabled = () => options.stateEnabled === false ? false : stateEnabled || fs.existsSync(root);
  const scan = () => comAtalho({...cached,limits:{...(cached&&cached.limits),claude:claudeLimite(root)},state:stateSources(root,enabled())});
  function oldServer() {
    if (!legacy) {
      const sessions = path.join(home, '.codex/sessions'), claudeRoot = path.join(home, '.claude/projects');
      const metadataReaderConfig = { stateRoot: root, codexRoot: sessions, claudeRoot, policy: { id: 'pe-scalar-v1', metadataOnly: true, approvedRoots: [root, sessions, claudeRoot] } };
      const metadataProvider = provedorMetadados(scan);
      legacy = require('./servidor.cjs').createServer(root, sessions, { port, localOnly: true, metadataOnly: true, metadataReaderConfig, metadataProvider, sessionDecoration: false, friendMode: true, cardsDataDir: options.cardsDataDir || path.join(root, '.painel-dados', 'cards'), transformSnapshot: raw => ({ ...raw, ...bridge(scan()), activity: raw.activity, sessionActivity: scan().activity, lofi: { radios: [] } }) });
    }
    return legacy;
  }
  const hosts = new Set(['127.0.0.1:' + port, 'localhost:' + port]);
  const assets = { '/automatico.js': ['automatico.js', 'text/javascript'], '/automatico.css': ['automatico.css', 'text/css'], '/estado-aba.js': ['estado-aba.js', 'text/javascript'] };
  const server = http.createServer(async (req, res) => {
    const send = (status, value, type = 'application/json') => {
      res.writeHead(status, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'" });
      res.end(type === 'application/json' ? JSON.stringify(require('./sigilo-pessoas.cjs').mascararTudo(value)) : value);
    };
    // Somente loopback. Nenhuma rota de comando, chave externa ou acesso remoto nesta entrada.
    if (!hosts.has(req.headers.host)) return send(403, { error: 'Acesso local obrigatorio' });
    if (/^\/lofi\.js(?:\?|$)/.test(req.url)) return send(403, { error: 'Rádio desabilitado' });
    let url; try { if (!req.url.startsWith('/') || req.url.startsWith('//')) throw Error(); url = new URL(req.url, 'http://127.0.0.1:' + port); } catch { return send(400, { error: 'Endereco invalido' }); }
    if (req.method === 'GET' && url.pathname === '/api/monitores') {
      const M = require('./monitores.cjs'), site = req.headers['sec-fetch-site'];
      // pedido de outro site (uma imagem ou fetch de qualquer pagina aberta) nao liga as checagens
      if (site && !['same-origin', 'none'].includes(site)) return send(403, { error: 'Acesso local obrigatorio' });
      // exemplo e demo (raiz da demo ou PAINEL_DEMO=1): so o ficticio, sem ler a config nem executar nada
      if (url.searchParams.get('exemplo') === '1' || process.env.PAINEL_DEMO === '1' || path.resolve(root) === path.resolve(__dirname, 'demo', 'estado')) return send(200, M.exemplo());
      if (!monitores) monitores = M.create({ root });
      const estado = monitores.snapshot();
      monitores.start();
      return send(200, estado);
    }
    if(require('./r10-servicos.cjs').match(url)){await r10.handle(req,url,{send});return;}
    const tab = ROUTES[url.pathname];
    if (req.method === 'POST' && url.pathname === '/api/conselho/conversa') return send(200,{ok:false,rows:[],motivo:'Conversa desligada nesta cópia. Responda na sessão do seu Claude.'});
    if (req.method !== 'GET' && req.method !== 'HEAD' && !['/api/chaves/virar', '/api/pc-cards/responder', '/api/pc-cards/passo', '/api/cronograma/ordem', '/api/pulso-acelerar', '/api/conselho/selo', '/api/dados-solucao/registrar'].includes(url.pathname) && !/^\/api\/pulso-acelerar\/cards\/[^/]+\/(responder|passo)$/.test(url.pathname)) return send(403, { error: 'Somente leitura' });
    if (url.pathname.startsWith('/modo-dono/')) return send(403, { error: 'Somente leitura' });
    if (url.pathname === '/api/modo-dono') return send(200, { aberto: false });
    { const demo = rotinaDemo(root, url.pathname, req.method); if (demo) return send(200, demo); }
    if (url.pathname.startsWith('/api/rotina')) return send(200, { ok: true, lido: false, valor: null, solucao: 'Use as sessões descobertas na visão geral.' });
    if (req.method === 'GET' && url.pathname === '/api/health') return send(200, { ok: true });
    try {
      await ready;
      if (req.method === 'GET' && url.pathname === '/') return send(200, readSafe(__dirname, 'automatico.html'), 'text/html');
      if (assets[url.pathname]) { const [file, type] = assets[url.pathname]; return send(200, readSafe(__dirname, file), type); }
      if(req.method==='GET' && url.pathname==='/como-usar') return send(200,readSafe(__dirname,'como-usar.html'),'text/html');
      if(req.method==='GET' && ['/metodo/GUIA.md','/metodo/ADENDO-R4.md','/metodo/COLE-NO-SEU-CLAUDE-METODO.md'].includes(url.pathname)) return send(200,readSafe(__dirname,url.pathname.slice(1)),'text/plain');
      if(req.method==='GET' && /^\/api\/exemplos\/(cards|cronograma|entregas|ideias)$/.test(url.pathname)) return send(200,require('./exemplos-estado.cjs').example(url.pathname.split('/').at(-1)));
      if (req.method === 'GET' && url.pathname === '/api/descoberta') return send(200, scan());
      if (req.method === 'GET' && url.pathname === '/api/projetos-painel') return send(200, { ok: true, projetos: scan().projects.map(p => ({ id: p.id, nome: p.name, dono: null })) });
      if (req.method === 'GET' && url.pathname === '/projeto-de.cjs') return send(200, 'window.PainelProjetosDescobertos=' + JSON.stringify(require('./sigilo-pessoas.cjs').mascararTudo({ projetos: scan().projects.map(p => ({ id: p.id, nome: p.name, cwd: p.cwd })), sessoes: scan().sessions })) + ';\n' + readSafe(__dirname, 'projeto-de.cjs'), 'text/javascript');
      if (tab && !scan().state[tab].available) return send(200, missing(scan().state[tab]));
      if (req.method === 'GET' && url.pathname === '/api/estado' && !Object.values(scan().state).some(s => s.available)) return send(200, bridge(scan()));
      if (req.method === 'GET' && /^\/estado\/(cards|cronograma|entregas|ideias)$/.test(url.pathname)) {
        const key = url.pathname.split('/').at(-1);
        if (!scan().state[key].available) return send(200, '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><p>? ' + scan().state[key].solucao.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]) + '</p></html>', 'text/html');
        return send(200, statePage(key), 'text/html');
      }
      if (req.method === 'POST' && url.pathname === '/api/dados-solucao/registrar') return send(200, {ok:false,motivo:'Registro opcional desligado nesta cópia.',solucao:'Confira a solução mostrada junto ao dado.'});
      if (req.method === 'GET' && url.pathname === '/painel-estado') {
        if (!enabled() || !fs.existsSync(root)) return send(200, '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tela completa</title><p>? A tela completa precisa de uma pasta de estado. Solução: faça o passo 2 em metodo/ e use estado-local, ou escolha PAINEL_ROOT no README.</p><a href="/">Voltar à primeira tela</a></html>', 'text/html');
        req.url = '/';
      }
      if(req.method==='GET') { const rel=url.pathname.slice(1); if(require('./empacotar.cjs').INCLUIR.includes(rel) && /\.(?:css|js|cjs)$/.test(rel)) return send(200,readSafe(__dirname,rel),rel.endsWith('.css')?'text/css':'text/javascript'); }
      if (require('./r9-rotas.cjs').assets.includes(url.pathname.slice(1)) || url.pathname.startsWith('/api/chaves') || url.pathname === '/api/pe-equipe/frentes-situacao') { await r9.handle(req,url,{send}); return; }
      if (url.pathname === '/api/conselheiros') { require('./conselheiros-fonte.cjs').handle(req, url, { send, root, dir: __dirname }); return; } // aba Decidir: le a pasta de estado mesmo antes dela existir
      if (!enabled() || !fs.existsSync(root)) return send(404, { error: 'Fonte ausente' });
      oldServer().emit('request', req, res);
    } catch { return send(200, { ok: false, lido: false, valor: null, solucao: 'Confira os arquivos locais e atualize o painel.' }); }
  });
  server.readerReady = ready;
  server.on('close', () => { worker.terminate(); monitores?.close(); legacy?.close(); });
  return server;
}
// Atalho de quem espera voce: link do app Claude ou do Codex, ou o comando de retomar (link-sessao.cjs). So para sessao esperando.
function comAtalho(snapshot, app) {
  if (!snapshot || !Array.isArray(snapshot.sessions) || !snapshot.sessions.some(s => s && s.state === 'waiting')) return snapshot;
  const L = require('./link-sessao.cjs'); let apps = app; try { apps = apps || require('./sessoes-app.cjs').readSessions(); } catch { apps = null; }
  return { ...snapshot, sessions: snapshot.sessions.map(s => s && s.state === 'waiting' ? { ...s, atalho: L.atalho(s, apps) } : s) };
}
module.exports = { createServer, stateSources, bridge, claudeLimite, provedorMetadados, rotinaDemo, comAtalho };
