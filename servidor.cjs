'use strict';
// Marca e endereco do app de ideias vem do env (README): PAINEL_MARCA e PAINEL_IDEIAS_URL.
const MARCA=String(process.env.PAINEL_MARCA||'PAINEL').replace(/[<>&"']/g,'').slice(0,40)||'PAINEL',IDEIAS_URL=String(process.env.PAINEL_IDEIAS_URL||'http://127.0.0.1:3259').replace(/\/+$/,'');
// O quadro do Conselho so aceita o app de ideias local (http, 127.0.0.1 ou localhost, com porta).
const IDEIAS_FRAME=/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(IDEIAS_URL)?IDEIAS_URL:'';
const SO_LEITURA=require('./so-leitura.cjs').ativo;
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
// Idealizadores: o quadro do app de ideias so entra quando o app responde no endereco local; sem ele fica a grade de reserva.
let ideiasCache={em:0,ok:false};
function ideiasNoAr(){if(Date.now()-ideiasCache.em<5000)return Promise.resolve(ideiasCache.ok);let u;try{u=new URL(IDEIAS_URL);}catch{return Promise.resolve(false);}if(u.protocol!=='http:'||!/^(127\.0\.0\.1|localhost)$/.test(u.hostname))return Promise.resolve(false);
  return new Promise(resolve=>{const fim=ok=>{ideiasCache={em:Date.now(),ok};resolve(ok);};const r=http.get(IDEIAS_URL+'/api/equipe',res=>{res.resume();fim(res.statusCode===200);});r.on('error',()=>fim(false));r.setTimeout(600,()=>{r.destroy();fim(false);});});}
const {randomBytes}=require('node:crypto');
function validPort(port){if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid local port');return port;}
function createServer(root,sessionsRoot,options={}) {
  if(options.automatic===true)return require('./automatico-servidor.cjs').createServer(root,options);
  const port=validPort(options.port===undefined?3257:options.port);
  const r10=require('./r10-servicos.cjs').create({root,port,soLeitura:SO_LEITURA,descobertas:()=>{try{return (state(false).sessions||[]).map(s=>s&&s.id);}catch{return [];}}});
  const metadataOnly=options.metadataOnly===true;
  const metadataProvider=metadataOnly?(options.metadataProvider||require('./pe-metadata-reader.cjs').createMetadataReader(options.metadataReaderConfig)):null;
  const nonce=randomBytes(24).toString('hex'),exampleNonce=randomBytes(24).toString('hex');
  const acrescimo=require('./acrescimo-rotas.cjs').create({root,port,nonce,...(options.friendMode?{hora:require('./pc-cards/cards-nucleo.cjs').horaNode}:{})});
  const solucoes=require('./dados-solucao-rotas.cjs').create({root,port,nonce});
  const fluxo=require('./fluxo-rotas.cjs').create({root});
  const radar=require('./radar-rotas.cjs').create({root});
  const r9=require('./r9-rotas.cjs').create({root,port,soLeitura:SO_LEITURA});
  const livroV3=require('./livro-v3-rota.cjs').create({root,port}); // LIVRO V3: estado e descoberta
  let monitores=null; // monitores.cjs: o mesmo da entrada simples; a demo e o ?exemplo=1 recebem so os ficticios
  const cerebro=require('./cerebro-fonte.cjs').create({root:options.brainRoot||root,metadataProvider:{snapshot:()=>metadataProvider?currentMetadata():state(false)}});
  const exampleAnswers=new Map();
  const assets={'/agente.png':['agente-320.png','image/png'],'/agente-original.png':['agente.png','image/png'],'/marca.png':['marca.png','image/png'],'/':['index.html','text/html'], '/painel.css':['painel.css','text/css'], '/painel.js':['painel.js','text/javascript'], '/painel-v3.css':['painel-v3.css','text/css'], '/painel-v3.js':['painel-v3.js','text/javascript'], '/dev.js':['dev.js','text/javascript'], '/mapa.css':['mapa.css','text/css'], '/mapa.js':['mapa.js','text/javascript'], '/comandos.css':['comandos.css','text/css'], '/comandos.js':['comandos.js','text/javascript'], '/equipe.css':['equipe.css','text/css'], '/equipe.js':['equipe.js','text/javascript'], '/detalhes.css':['detalhes.css','text/css'], '/detalhes.js':['detalhes.js','text/javascript'], '/projetos.css':['projetos.css','text/css'], '/projetos.js':['projetos.js','text/javascript'], '/tips.css':['tips.css','text/css'], '/tips.js':['tips.js','text/javascript'], '/favicon.svg':['favicon.svg','image/svg+xml']};
  assets["/conselho-arte/visionario.png"]=["assets/conselho/visionario.png",'image/png'];
  assets["/conselho-arte/cetico.png"]=["assets/conselho/cetico.png",'image/png'];
  assets["/conselho-arte/operador.png"]=["assets/conselho/operador.png",'image/png'];
  assets["/conselho-arte/cientista.png"]=["assets/conselho/cientista.png",'image/png'];
  assets["/conselho-arte/filosofo.png"]=["assets/conselho/filosofo.png",'image/png'];
  assets["/conselho-arte/politico.png"]=["assets/conselho/politico.png",'image/png'];
  assets["/conselho-arte/economista.png"]=["assets/conselho/economista.png",'image/png'];
  assets["/conselho-arte/artista.png"]=["assets/conselho/artista.png",'image/png'];
  assets["/conselho-arte/advogado.png"]=["assets/conselho/advogado.png",'image/png'];
  assets["/conselho-arte/cliente.png"]=["assets/conselho/cliente.png",'image/png'];
  assets['/chat.js']=['chat.js','text/javascript'];
  assets['/chat.css']=['chat.css','text/css'];
  assets['/contas.js']=['contas.js','text/javascript'];
  assets['/contas.css']=['contas.css','text/css'];
  assets['/lofi.js']=['lofi.js','text/javascript'];
  assets['/lofi.css']=['lofi.css','text/css'];
  for(const file of require('./acrescimo-rotas.cjs').assets)assets['/'+file]=[file,file.endsWith('.css')?'text/css':'text/javascript'];
  for(const file of ['inicio-missoes.css','inicio-missoes-modelo.js','inicio-missoes.js'])assets['/'+file]=[file,file.endsWith('.css')?'text/css':'text/javascript'];
  for(const file of ['dados-auditados.js','credito-modelo.js','upgrade.js','upgrade.css'])assets['/'+file]=[file,file.endsWith('.css')?'text/css':'text/javascript'];
  for(const file of ['cerebro-modelo.js','cerebro.js','cerebro.css'])assets['/'+file]=[file,file.endsWith('.css')?'text/css':'text/javascript'];
  for(const file of ['ideias-app.css'])assets['/'+file]=[file,'text/css'];
  for(const file of ['nomes.js','vistas-f2.js','vistas-f2.css','vistas.js','vistas.css','tema.js','theme-grade.css','theme-livro.css','theme-folha.css','anim-motor.js','anim-grade.js','anim-livro.js','anim-folha.js'])assets['/'+file]=[file,file.endsWith('.css')?'text/css':'text/javascript'];
  assets['/modo-dono.js']=['modo-dono.js','text/javascript'];assets['/modo-dono.css']=['modo-dono.css','text/css'];
  assets['/ponte-tema-painel.js']=['ponte-tema-painel.js','text/javascript'];
  for(const file of require('./fluxo-rotas.cjs').assets)assets['/'+file]=[file,file.endsWith('.css')?'text/css':'text/javascript'];
  // Fontes do kit (letras/, woff2 local com a licença OFL).
  if(fs.existsSync(path.join(__dirname,'letras')))for(const file of fs.readdirSync(path.join(__dirname,'letras')))if(/^[\w-]+\.(woff2|css|txt)$/.test(file))assets['/letras/'+file]=['letras/'+file,file.endsWith('.woff2')?'font/woff2':file.endsWith('.css')?'text/css':'text/plain; charset=utf-8'];
  for(const [file,type] of [['sala.js','text/javascript'],['sala.css','text/css'],['ganchos.js','text/javascript'],['ganchos.css','text/css'],['ajustes.css','text/css'],['inicio-clean.js','text/javascript'],['inicio-clean.css','text/css']])assets['/'+file]=[file,type];
  const allowed=new Set(['127.0.0.1:'+port,'localhost:'+port]);
  const pedidosLocal=()=>{const text=require('./leitor.cjs').readSafe(root,'tasks/ESCOLHAS.md',512000);return text?require('./decisoes.cjs').needsOf(text).all:[];};
  let cards=null;try{cards=require('./pc-cards/cards-rotas.cjs').criarRotasCards({porta:port,cardsDir:path.join(root,'estado','cards'),dadosDir:options.cardsDataDir||path.join(__dirname,'pc-cards','dados'),pedidos3250:false,pedidosLocal,somenteChatPerigoso:options.friendMode===true,...(options.localOnly?{horaGetDate:require('./pc-cards/cards-nucleo.cjs').horaNode}:{})});}catch{cards=null;}
  let acel=null;try{acel=require('./acelerador/acelerador-rotas.cjs').criarRotasAcelerador({porta:port,arquivo:process.env.PAINEL_ACELERADOR_JSON||require('node:path').join(process.env.PAINEL_DADOS || require('node:path').join(__dirname, 'demo', 'home', 'dados'), 'acelerador.json'),recados:path.join(root,'estado','recados-do-painel.md'),rotina:{pt:'Máxima que não para: a cada 15 min olha o andamento e as frentes, lista os próximos passos de cada frente para você decidir.',en:'Top gear that never stops: every 15 min it checks progress and every front, lists the next steps of each front for you to decide.',es:'Máxima que no para: cada 15 min mira el avance y los frentes, enumera los próximos pasos de cada frente para que decidas.'}});}catch{acel=null;}
  let duAssetsStamp,avatarAssets=[];
  const verifiedAvatarAssets=()=>{
    const {safeFile,loadVerifiedPool}=require('./agentes.cjs');
    const manifest=safeFile(__dirname,'agentes/manifest.json',128000)||safeFile(__dirname,'assets/agentes/manifest.json',128000);
    if(!manifest){avatarAssets=[];return avatarAssets;}
    const stat=fs.statSync(manifest),stamp=stat.mtimeMs+':'+stat.size;
    if(stamp!==duAssetsStamp){
      duAssetsStamp=stamp;
      const verified=loadVerifiedPool(__dirname).pool;
      const entries=JSON.parse(fs.readFileSync(manifest,'utf8')).entries || [];
      avatarAssets=verified.map(agente=>({...agente,sha256:entries.find(entry=>(entry.arquivo?'/'+entry.arquivo:'/assets/agentes/'+entry.asset)===agente.image)?.sha256}));
    }
    return avatarAssets;
  };
  const avatarAsset=pathname=>{
    const {safeFile}=require('./agentes.cjs');
    verifiedAvatarAssets();
    const entry=avatarAssets.find(agente=>agente.image===pathname);
    if(!entry)return null;
    const file=safeFile(__dirname,pathname.slice(1),150000);
    if(!file)return null;
    const bytes=fs.readFileSync(file);
    return require('node:crypto').createHash('sha256').update(bytes).digest('hex')===entry.sha256 ? bytes : null;
  };
  const agora300=require('./agora-rotas.cjs').criar({root,dir:__dirname,port});
  const contas298=require('./contas-rotas.cjs').criar({root,dir:__dirname,port,nonce});
  let liveStreamFechado,liveStreamDono,exampleStream;
  const liveStream={changed:()=>{liveStreamFechado?.changed();liveStreamDono?.changed();},broadcast:(event,meta)=>{liveStreamFechado?.broadcast(event,meta);liveStreamDono?.broadcast(event,meta);},close:()=>{liveStreamFechado?.close();liveStreamDono?.close();}};
  const readerWorker=options.readerWorker===true?require('./snapshot-worker.cjs').createSnapshotWorker(root,sessionsRoot,()=>liveStream?.changed(),{watchMs:30000,changeGapMs:30000,...options.readerCadence,metadataOnly,metadataReaderConfig:metadataProvider?.config}):options.readerWorker&&typeof options.readerWorker==='object'?options.readerWorker:null;
  // Keep node --watch aware of the reader's dependencies as well as the worker.
  if(readerWorker)for(const module of ['./leitor.cjs','./equipe.cjs','./cronograma.cjs','./realtime.cjs','./alimentacao.cjs','./agentes.cjs'])require(module);
  if(metadataOnly&&readerWorker&&typeof readerWorker.metadataSnapshot!=='function')throw Error('Metadata worker unavailable');
  const currentMetadata=()=>{if(!metadataProvider)throw Error('Metadata policy unavailable');if(readerWorker){readerWorker.touch();return readerWorker.metadataSnapshot();}return metadataProvider.snapshot();};
  const peProvider={metadataOnly:true,policyId:metadataProvider?.policyId,snapshot:currentMetadata};
  const exampleProvider={metadataOnly:true,policyId:'example-scalar',snapshot:()=>{const fake=require('./exemplo.cjs').snapshotExample(exampleAnswers),at=new Date().toISOString();return {updated:at,proof:{mode:'scalar-metadata',policyId:'example-scalar',observedAt:at,example:true},equipe:fake.equipe||{agents:[]},commandSessions:fake.commandSessions||[],metadataRecords:[]};}};
  const dev=require('./dev.cjs').createDevController(__dirname,{
    ...options.development,
    enabled:options.dev===undefined?process.env.PAINEL_DEV==='1':options.dev===true,
    serverId:randomBytes(16).toString('hex'),
    assets:Object.values(assets).map(([file])=>file),
    poolAssets:()=>verifiedAvatarAssets().map(agente=>agente.image.slice(1)),
    onChange:meta=>{liveStream?.broadcast('recarregar',meta);exampleStream?.broadcast('recarregar',meta);}
  });
  let cachedLive=null,cachedAt=0,liveMemo=null;
  const stabilize=require('./estavel.cjs').createStabilizer(root,undefined,{processReading:options.friendMode!==true});
  // The initial HTTP read and SSE subscription share one scan; assets stay responsive.
  const claude303=metadataOnly&&options.sessionDecoration!==false?require('./claude-integracao303.cjs').criarIntegracao(root,options.metadataReaderConfig):(snapshot=>snapshot);
  const comCreditoClaude=snapshot=>{try{snapshot.credits=require('./credito-fresco.cjs').creditos(root,snapshot.credits,Date.now());}catch{}const value=claude303(snapshot);return options.transformSnapshot?options.transformSnapshot(value):value;};
  const state=example=>SIGILO.rodarComo(false,()=>{
    if(example)return {...require('./exemplo.cjs').snapshotExample(exampleAnswers),nonce:exampleNonce,dev:dev.snapshot()};
    if(readerWorker){
      // O mesmo objeto enquanto nao chega leitura nova (o fluxo de eventos nem recalcula a assinatura de 4 MB)
      const reads=typeof readerWorker.version==='function'?readerWorker.version():null,devNow=dev.snapshot(),devSig=JSON.stringify(devNow);
      if(reads!==null&&liveMemo&&liveMemo.reads===reads&&liveMemo.dev===devSig&&Date.now()-liveMemo.at<60000)return claude303(liveMemo.data);
      const raw=readerWorker.snapshot();if(metadataOnly&&(raw.metadataProof?.mode!=='scalar-metadata'||raw.metadataProof.policyId!==metadataProvider.policyId))throw Error('Metadata state unavailable');
      const data=comCreditoClaude({...stabilize(raw),nonce,dev:devNow});
      liveMemo={reads,dev:devSig,at:Date.now(),data};
      return data;
    }
    if(!cachedLive||Date.now()-cachedAt>=2000){cachedLive=require('./leitor.cjs').snapshot(root,sessionsRoot,new Date(),{metadataOnly,metadataProvider});if(!metadataOnly)cachedLive.commandSessions=require('./comandos.cjs').sessionsOf(cachedLive.equipe,root);cachedLive.commandsEnabled=true;cachedLive.public=false;cachedAt=Date.now();}
    return comCreditoClaude({...stabilize(cachedLive),nonce,dev:dev.snapshot()});
  });
  const notify=()=>{cachedAt=0;liveMemo=null;readerWorker?.refresh();liveStream?.changed();exampleStream?.changed();};
  const SIGILO=require('./sigilo-pessoas.cjs'),tela=SIGILO.criarMemo();
  const MODO_DONO=require('./modo-dono.cjs');
  const atender=async(req,res)=>{
    const dono=SIGILO.aberto();
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; connect-src 'self'; style-src 'self'; font-src 'self'; script-src 'self'; frame-src 'self' "+IDEIAS_FRAME+"; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
    const send=(status,data,type='application/json')=>{let body=type==='application/json'?SIGILO.rodarComo(dono,()=>JSON.stringify(tela(data))):type==='text/html'&&typeof data==='string'?SIGILO.rodarComo(dono,()=>SIGILO.mascarar(data)):data;const compressed=(typeof body==='string'||Buffer.isBuffer(body))&&/json|text|javascript|svg/.test(type)&&Buffer.byteLength(body)>1024&&/\bgzip\b/.test(req.headers['accept-encoding']||'');if(compressed)body=require('node:zlib').gzipSync(body);res.writeHead(status,{...headers,'Content-Type':type+'; charset=utf-8',...(compressed?{'Content-Encoding':'gzip','Vary':'Accept-Encoding'}:{})});res.end(body);};
    if(!allowed.has(req.headers.host)) return send(403,{error:'Local access only'});
    if(SO_LEITURA&&req.method!=='GET'&&req.method!=='HEAD') return send(403,{ok:false,error:'Somente leitura',mensagem:'Gravação desabilitada por PAINEL_SO_LEITURA=1. Solução: retire essa variável e reinicie o painel para permitir respostas.'});
    // Parse only origin-form targets. Reject ambiguous mode selection before loading either reader.
    if(!req.url.startsWith('/')||req.url.startsWith('//')||req.url.includes('#'))return send(400,{error:'Invalid URL'});
    let url;try{url=new URL(req.url,'http://127.0.0.1:'+port);}catch{return send(400,{error:'Invalid URL'});}
    if(require('./r10-servicos.cjs').match(url)){await r10.handle(req,url,{send});return;}
    const modes=url.searchParams.getAll('exemplo');
    if([...url.searchParams.keys()].some(key=>key!=='exemplo'&&!(url.pathname==='/modo-dono/abrir'&&key==='t'))||modes.length>1||(modes.length===1&&modes[0]!=='1'))return send(400,{error:'Invalid mode'});
    const example=modes.length===1;
    if(!options.localOnly&&MODO_DONO.abrir(req,res,url,port,headers))return;
    if(req.method==='GET' && url.pathname==='/api/modo-dono') return send(200,{aberto:dono&&!example});
    if(await solucoes.handle(req,url,{send,example}))return;
    if(await acrescimo.handle(req,url,{send,res,example,credits:()=>state(false).credits}))return;
    if(cerebro.handle(req,url,{send}))return;
    if(radar.handle(req,url,{send,example}))return;
    if(fluxo.handle(req,url,{send,example}))return;
    if(require('./blocos-livro-rota.cjs').handle(req,url,{send,root,example}))return;
    if(req.method==='GET'&&url.pathname==='/api/monitores'){const M=require('./monitores.cjs'),site=req.headers['sec-fetch-site'];if(site&&!['same-origin','none'].includes(site))return send(403,{error:'Acesso local obrigatorio'});if(example||process.env.PAINEL_DEMO==='1')return send(200,M.exemplo());if(!monitores)monitores=M.create({root});const m=monitores.snapshot();monitores.start();return send(200,m);}
    if(await livroV3.handle(req,url,{send,example:example||process.env.PAINEL_DEMO==='1',snapshot:()=>state(false),cardsDataDir:options.cardsDataDir}))return;
    if(require('./blocos-folha-rota.cjs').handle(req,url,{send,root,example,dir:__dirname}))return; // FOLHA: blocos proprios (so GET)
    if(require('./entregas-rota.cjs').handle(req,url,{send,root,example}))return;
    if(await r9.handle(req,url,{send,example}))return;
    if(require('./fluxo-vertical-rota.cjs').handle(req,url,{send,root,example}))return;
    if(require('./projeto-rota.cjs').handle(req,url,{send}))return;
    if(require('./pulso-acelerar.cjs').handle(req,url,{send,res,root,port,cards,dono,example,soLeitura:SO_LEITURA,friendMode:options.friendMode===true}))return; // ACELERAR do Fluxo: pulso local, cards do pulso e /fusao-fluxo.js e .css
    if(['/api/ideias','/ideias.js','/ideias.css'].includes(url.pathname)){
      try{return require('./ideias.cjs').handle(req,url,{send,root,example,dir:__dirname});}
      catch{return send(503,{ok:false,sourceState:'unavailable'});}
    }
    if(await require('./conselheiros-fonte.cjs').handle(req,url,{send,root,example,dir:__dirname}))return; // conselheiros da aba Decidir: /api/conselheiros e /conselheiros.js e .css (so GET)
    // An accepted live API request keeps the reader going for its demand window; health checks and the example do not.
    const watch=()=>{if(readerWorker&&!example)readerWorker.touch();};
    if(req.method==='GET' && url.pathname==='/api/health') return send(200,example?{ok:true,example:true}:{ok:true});
    if(contas298.handle(req,url,{send,example}))return;
    if(agora300.handle(req,url,{send,example}))return;
    try{if(require('./painel-numeros.cjs').handle(req,url,{send,root,example,snapshot:()=>{try{return state(false);}catch{return null;}}}))return;}catch{return send(503,{ok:false,error:'Numeros unavailable'});}
    try{if(require('./status-6-linhas.cjs').handle(req,url,{root,sessionsRoot:metadataOnly?null:sessionsRoot,example,send,dir:__dirname}))return;}catch(error){if(error.code!=='MODULE_NOT_FOUND')return send(503,{error:'Status unavailable'});}
    try{if(require('./coordenador-pb.cjs').handle(req,url,{root,send,port,example,painelDir:__dirname,live:()=>example?null:state(false)}))return;}catch{return send(503,{error:'Coordination unavailable'});}
    try{if(require('./painel-chat.cjs').handle(req,url,{root,send,port,nonce,example}))return;}catch(error){if(error.code!=='MODULE_NOT_FOUND'&&url.pathname.startsWith('/api/painel-chat'))return send(503,{error:'Chat unavailable'});}
    if(cards&&cards.handle(req,url.pathname.startsWith('/api/pc-cards')?SIGILO.guardarResposta(res,dono):res))return;
    try{if(require('./pe-equipe.cjs').handle(req,url,{send,painelDir:__dirname,estado:root,metadataOnly,metadataProvider:example?exampleProvider:peProvider,live:()=>{try{return Promise.resolve(example?exampleProvider.snapshot():metadataOnly?currentMetadata():state(false));}catch{return Promise.resolve(null);}}}))return;}catch{return send(503,{error:'Equipe unavailable'});}
    try{if(require('./rotina.cjs').handle(req,url,{send,root,example,dir:__dirname}))return;}catch{return send(503,{error:'Rotina indisponível'});}
    try{if(require('./cronograma-tela.cjs').handle(req,url,{send,root,example,dir:__dirname}))return;}catch{return send(503,{error:'Cronograma unavailable'});}
    if(acel&&acel.handle(req,/^\/(?:api\/)?acelerador/.test(url.pathname)?SIGILO.guardarResposta(res,dono):res))return;
    try{if(require('./ia-conceito/ia-rotas.cjs').handle(req,url,{root,send,port,nonce,example,painelDir:__dirname,notify}))return;}catch(error){if(error.code!=='MODULE_NOT_FOUND'&&url.pathname.includes('ia-conceito'))return send(503,{error:'IA unavailable'});} // PAINEL-IA: Ensine sua IA (aba Alimente sua IA)
    if(req.method==='GET' && url.pathname==='/api/eventos') {
      if(req.headers.origin && !['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin))return send(403,{error:'Local origin required'});
      const {createStateStream}=require('./realtime.cjs');
      if(example){exampleStream ||= createStateStream(__dirname,()=>state(true),{...options.realtime,example:true});return exampleStream.subscribe(req,res,headers);}
      watch();
      const opcoesFluxo=readerWorker?{...options.realtime,onFileChange:()=>readerWorker.changed()}:options.realtime;
      // fluxo continuo: um para cada modo (o fechado e o aberto nunca dividem o mesmo fluxo nem a mesma cache)
      const aoVivo=dono?(liveStreamDono ||= createStateStream(root,()=>{
        if(!MODO_DONO.pedido(req,port)){liveStreamDono?.close();liveStreamDono=null;return SIGILO.rodarComo(false,()=>tela(state(false)));}
        return SIGILO.rodarComo(true,()=>tela(state(false)));
      },opcoesFluxo)):(liveStreamFechado ||= createStateStream(root,()=>SIGILO.rodarComo(false,()=>tela(state(false))),opcoesFluxo));
      aoVivo.subscribe(req,res,headers);
      // An open live stream is a viewer until it closes.
      if(readerWorker&&res.statusCode===200&&!res.writableEnded&&!res.destroyed){readerWorker.open();res.on('close',()=>readerWorker.leave());}
      return;
    }
    if(req.method==='GET' && url.pathname==='/api/estado') {
      watch();
      try {
        return send(200,state(example));
      }catch{return send(503,{error:example?'Example unavailable':'Could not read local state'});}
    }
    if(req.method==='POST' && url.pathname==='/api/responder') {
      if(!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin))return send(403,{error:'Local origin required'});
      if(req.headers['content-type']!=='application/json'||req.headers['x-painel-nonce']!==(example?exampleNonce:nonce))return send(403,{error:'Invalid request'});
      // Pacote9: a escrita local usa somente /api/pc-cards/responder. O exemplo antigo continua sintetico.
      if(!example)return send(410,{error:'Esta resposta mudou. Atualize o painel e responda na seção Cards.'});
      watch();
      const chunks=[];let size=0;
      try {
        for await(const chunk of req){size+=chunk.length;if(size>4096)return send(413,{error:'Request too large'});chunks.push(chunk);}
        const parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||Object.keys(parsed).some(key=>!['id','opcao'].includes(key)))throw Error('Invalid choice');
        const result=example ? require('./exemplo.cjs').answerExample(exampleAnswers,parsed.id,parsed.opcao) : require('./leitor.cjs').answer(root,parsed.id,parsed.opcao);
        notify();
        return send(200,result);
      }catch(error){return send(409,{error:example?'Could not demonstrate choice':['Already answered','Approve in the session chat','Choice already recorded'].includes(error.message)?error.message:'Could not save choice'});}
    }
    if(req.method==='POST' && url.pathname==='/api/alimentar'){
      if(example)return send(409,{ok:false,error:'example_disabled'});
      if(!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin)||req.headers['content-type']!=='application/json'||req.headers['x-painel-nonce']!==nonce)return send(403,{ok:false,error:'invalid_request'});
      watch();
      try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1024)return send(413,{ok:false,error:'too_large'});chunks.push(chunk);}
        const parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!parsed||Array.isArray(parsed)||Object.keys(parsed).length!==1||typeof parsed.id!=='string')return send(400,{ok:false,error:'invalid_json'});
        const feeding=require('./alimentacao.cjs').feedTip(root,parsed.id);notify();return send(200,{ok:true,feeding});
      }catch{return send(409,{ok:false,error:'feed_unavailable'});}
    }
    if(req.method==='POST' && url.pathname==='/api/comando') {
      if(example)return send(409,{ok:false,error:'example_disabled',message:'Comando desligado no exemplo'});
      const commands=require('./comandos.cjs');
      const reject=(status,code,message)=>{try{commands.recordRejected(root,({invalid_origin:'origin',invalid_request:'nonce',too_large:'size',invalid_json:'json'})[code] || code);}catch{}return send(status,{ok:false,error:code,message});};
      if(!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin))return reject(403,'invalid_origin','Origem local obrigatoria');
      if(req.headers['content-type']!=='application/json'||req.headers['x-painel-nonce']!==nonce)return reject(403,'invalid_request','Pedido local invalido');
      watch();
      const chunks=[];let size=0;
      try {
        for await(const chunk of req){size+=chunk.length;if(size>4096)return reject(413,'too_large','Comando grande demais');chunks.push(chunk);}
        const parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||Object.keys(parsed).some(key=>!['destino','texto','confirmado','threadId'].includes(key)))return reject(400,'invalid_json','Comando invalido');
        const result=await commands.sendCommand(root,parsed,new Date(),{sessionsRoot,teamOptions:path.resolve(sessionsRoot||'')===path.join((process.env.PAINEL_HOME || require('os').homedir()),'.codex','sessions')?{}:{claudeRoot:false},teamReader:metadataOnly?{snapshot:()=>currentMetadata().equipe}:undefined});
        notify();
        return send(result.statusCode || (result.ok ? 200 : 409),result);
      }catch{return reject(400,'invalid_json','Comando invalido');}
    }
    if(req.method==='GET' && Object.hasOwn(assets,url.pathname)) {const [file,type]=assets[url.pathname];try{const base=fs.realpathSync(__dirname),asset=path.join(__dirname,file);if(fs.lstatSync(asset).isSymbolicLink())throw Error('Invalid asset');const resolved=fs.realpathSync(asset);if(resolved!==path.join(base,file))throw Error('Invalid asset');let bytes=fs.readFileSync(resolved);if(file==='index.html')bytes=Buffer.from(bytes.toString('utf8').replaceAll('__MARCA__',MARCA).replaceAll('http://127.0.0.1:3259',IDEIAS_URL));if(file==='index.html'){const pagina=bytes.toString('utf8');bytes=Buffer.from(await ideiasNoAr()?pagina.replace('<div id="idealizadores-host" class="r10-painel">','<div id="idealizadores-host" class="r10-painel" hidden>'):pagina.replace(/<iframe\b[^>]*class="ideias-frame"[^>]*><\/iframe>/g,''));}if(options.friendMode&&file==='index.html')bytes=Buffer.from(bytes.toString('utf8').replace(/<link\b[^>]*href="\/lofi\.css"[^>]*>/g,'').replace(/<script\b[^>]*src="\/lofi\.js"[^>]*><\/script>/g,'').replace('</head>','<link rel="stylesheet" href="/automatico.css"></head>'));if(dono&&!example&&file==='index.html')bytes=Buffer.from(bytes.toString('utf8').replace('</head>','<link rel="stylesheet" href="/modo-dono.css"><script defer src="/modo-dono.js"></script></head>'));if(example&&file==='index.html')bytes=Buffer.from(bytes.toString('utf8').replace(/<a\b[^>]*\bid="brand-home"[^>]*>/,tag=>tag.replace(/\bhref="[^"]*"/,'href="/?exemplo=1"')).replace('<section id="rotina-card" class="rotina-card" aria-label="Rotina" hidden></section>','').replace('<div id="coordenador-pb-bar"></div>','').replace('<div id="coordenador-pb-feed"></div>','<p class="empty" data-t="none"></p>').replace('<div data-pc-cards data-api="/api/pc-cards"></div>','').replace('<link rel="stylesheet" href="/acelerador/acelerador.css"><script defer src="/acelerador/acelerador.js"></script>',''));return send(200,bytes,type);}catch{return send(503,{error:'Asset unavailable'});}}
    if(req.method==='GET' && /^(?:\/assets\/agentes\/[a-f\d]{16,64}\.(?:png|webp|jpg)|\/agentes\/[1-9]\d{0,4}\.png)$/.test(url.pathname)){
      try{const bytes=avatarAsset(url.pathname);if(!bytes)return send(404,{error:'Not found'});return send(200,bytes,url.pathname.endsWith('.webp')?'image/webp':url.pathname.endsWith('.jpg')?'image/jpeg':'image/png');}catch{return send(503,{error:'Asset unavailable'});}
    }
    return send(404,{error:'Not found'});
  };
  const server=http.createServer((req,res)=>SIGILO.rodarComo(!options.localOnly&&MODO_DONO.pedido(req,port),()=>atender(req,res)));
  const close=server.close.bind(server);
  server.readerReady=readerWorker?.ready||Promise.resolve();
  server.close=(...args)=>{metadataProvider?.close();readerWorker?.close();dev.close();liveStream?.close();exampleStream?.close();return close(...args);};
  server.on('close',()=>{claude303.close?.();agora300.close();monitores?.close();});
  return server;
}
function cliOptions(args,env=process.env){
  const envPort=env.PAINEL_PORT===undefined || env.PAINEL_PORT==='' ? '3257' : env.PAINEL_PORT;
  if(!/^\d+$/.test(envPort))throw Error('Invalid local port');
  const result={port:validPort(Number(envPort))};
  if(env.PAINEL_DEV==='1')result.dev=true;
  if(env.PAINEL_ROOT){if(typeof env.PAINEL_ROOT!=='string')throw Error('Invalid state root');result.root=env.PAINEL_ROOT;}
  for(let i=0;i<args.length;i++){
    if(args[i]==='--port'){if(!/^\d+$/.test(args[i+1]||''))throw Error('Invalid local port');result.port=validPort(Number(args[++i]));}
    else if(args[i]==='--brain-root'){if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Invalid brain root');result.brainRoot=args[++i];}
    else if(args[i]==='--estado-root'){if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Invalid state root');result.root=args[++i];}
    else throw Error('Invalid argument');
  }
  return result;
}
if(require.main===module) {
  try{
    const options=cliOptions(process.argv.slice(2));
    const root=options.root||path.join(__dirname,'estado-local');
    const sessions=path.join((process.env.PAINEL_HOME || require('node:os').homedir()),'.codex','sessions');
    const claudeRoot=path.join((process.env.PAINEL_HOME || require('node:os').homedir()),'.claude','projects'),appRoot=path.join((process.env.PAINEL_HOME || require('node:os').homedir()),'AppData','Roaming','Claude','claude-code-sessions'),indexRoot=path.dirname(sessions);
    const metadataReaderConfig={stateRoot:path.resolve(root),codexRoot:sessions,claudeRoot,indexRoot,appRoot,policy:{id:'pe-scalar-v1',metadataOnly:true,approvedRoots:[path.resolve(root),sessions,claudeRoot,indexRoot,appRoot]}};
    const server=createServer(root,sessions,{...options,stateEnabled:options.root?true:undefined,automatic:process.env.PAINEL_DEMO!=='1',readerWorker:true,metadataOnly:true,metadataReaderConfig});
    server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Local port is already in use.':'Local panel could not start.');process.exitCode=1;});
    server.readerReady.then(()=>server.listen(options.port,'127.0.0.1',()=>console.log('Painel: http://127.0.0.1:'+options.port))).catch(()=>{console.error('Local state reader unavailable');process.exitCode=1;server.close();});
  }catch{console.error('Invalid local panel arguments.');process.exitCode=1;}
}
module.exports={createServer,cliOptions};
