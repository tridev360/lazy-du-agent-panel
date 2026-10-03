const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { Metrics } = require("./lib/usage.cjs");
const { processSnapshot } = require("./lib/processes.cjs");
const { workspace, init } = require("./lib/workspace.cjs");
const { version } = require("../package.json");
const { createAcceleration } = require('./lib/acceleration.cjs');
const { exampleFor } = require('./lib/examples.cjs');
const {TaskBoard}=require('./lib/task-board.cjs');
const { createNews } = require('./lib/news.cjs');
const { createReadSnapshot } = require('./lib/read-snapshot.cjs');
const {generate:generateGuidance}=require('./lib/guidance.cjs');
const {createSettings}=require('./lib/guidance-settings.cjs');
const {createRules}=require('./lib/guidance-rules.cjs');
const UPDATE_URL='https://raw.githubusercontent.com/tridev360/lazy-du-agent-panel/main/package.json';
const INSTALL_METHOD=/[\\/]_npx[\\/]/.test(__dirname)?'npx':fs.existsSync(path.join(__dirname,'..','.git'))?'clone':'zip';
const REPOSITORY_URL='https://github.com/tridev360/lazy-du-agent-panel';
async function checkUpdate({offline=false,fetcher=typeof fetch==='function'?fetch:null,timeoutMs=3000,maxBytes=65536}={}){
  if(offline)return {offline:true,currentVersion:version,installMethod:INSTALL_METHOD};
  const failed={ok:false,currentVersion:version,latestVersion:null,installMethod:INSTALL_METHOD,repository:REPOSITORY_URL};
  if(typeof fetcher!=='function')return failed;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetcher(UPDATE_URL,{method:'GET',headers:{Accept:'application/json'},credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal});
    if(!response?.ok||!response.body)return failed;
    const chunks=[];let bytes=0;for await(const chunk of response.body){bytes+=chunk.byteLength;if(bytes>maxBytes){controller.abort();return failed;}chunks.push(Buffer.from(chunk));}
    const latest=JSON.parse(Buffer.concat(chunks).toString('utf8')).version;
    if(typeof latest!=='string'||!/^\d+\.\d+\.\d+$/.test(latest)||latest.length>40)return failed;
    const local=version.split('.').map(Number),remote=latest.split('.').map(Number);let updateAvailable=false;for(let i=0;i<3;i++){if(remote[i]!==local[i]){updateAvailable=remote[i]>local[i];break;}}
    return {ok:true,currentVersion:version,latestVersion:latest,updateAvailable,installMethod:INSTALL_METHOD,repository:REPOSITORY_URL};
  }catch{return failed;}finally{clearTimeout(timer);}
}
function bootstrapHTML(html,locale){const language=['en','pt','es'].includes(locale)?locale:'en',text={en:['Reading local metadata...','Enable JavaScript to open your panel.'],pt:['Lendo metadados locais...','Ative o JavaScript para abrir seu painel.'],es:['Leyendo metadatos locales...','Activa JavaScript para abrir tu panel.']}[language];const labels={en:{completed:'Completed task',activity:'Recent activity',blocked:'Blocked by',speed:'Can we speed up?',next:'Your next step',credit:'Credit',reading:'Reading...',sessions:'Reading sessions...',overview:'Where things stand',retry:'Reload panel'},pt:{completed:'Tarefa concluída',activity:'Atividade recente',blocked:'Travado por',speed:'Dá para acelerar?',next:'Seu próximo passo',credit:'Crédito',reading:'Lendo...',sessions:'Lendo sessões...',overview:'Em que pé estamos',retry:'Reabrir painel'},es:{completed:'Tarea terminada',activity:'Actividad reciente',blocked:'Bloqueado por',speed:'¿Podemos acelerar?',next:'Tu siguiente paso',credit:'Crédito',reading:'Leyendo...',sessions:'Leyendo sesiones...',overview:'Dónde estamos',retry:'Recargar panel'}}[language];html=html.replace(/(<[^>]+data-boot-copy="([^"]+)"[^>]*>)[^<]*(<\/[^>]+>)/g,(_,a,key,b)=>a+labels[key]+b).replace('class="boot-retry" data-boot-copy="retry" href="/"','class="boot-retry" data-boot-copy="retry" href="/?lang='+language+'"');return html.replace('<html lang="en"','<html lang="'+language+'"').replace('Reading local metadata...',text[0]).replace('Enable JavaScript to open your panel.',text[1]);}
function createServer({
  base = path.join(__dirname, ".."),
  profile = os.homedir(),
  metrics = new Metrics(profile, {
    processReader: () => processSnapshot({ details: true,bindSessions:true }),
  }),
  demoOnly = false,
  offline = false,
  updateFetch = typeof fetch === 'function' ? fetch : null,
  readAsset = (name) => fs.readFileSync(path.join(__dirname, '..', name)),
  onClose = null,
  board = null,
  newsFetch = typeof fetch === 'function' ? fetch : null,
} = {}) {
  const readNews = createNews({ fetcher: newsFetch });
  const usageMemo=createReadSnapshot(),boardMemo=createReadSnapshot({ttl:1000}),bodyMemo=createReadSnapshot({serialize:false});
  const compressedBodies=new WeakMap();
  const guidanceMemo=createReadSnapshot({ttl:180000}),guidanceSettings=createSettings(path.join(profile,'.lazy-du-panel'),{persist:!demoOnly}),rulesReader=createRules(profile,metrics);
  const exampleStatus=size=>{const snapshot={...exampleFor(example,size),desktop:!!onClose,offline};snapshot.guidance=generateGuidance(snapshot.usage,{quietDays:7,projects:{}},{onboarding:{steps:{running:true,rules:false,newSession:false,task:false,decision:false},projectKey:null,projectName:null,taskFolderExists:false,connected:false}});return snapshot;};
  const readingStarted=Date.now();let readingFinished=null;
  const invalidateStatus=()=>{usageMemo.invalidate();boardMemo.invalidate();bodyMemo.invalidate();guidanceMemo.invalidate();};
  const acceleration = createAcceleration({ folder: path.join(profile, '.lazy-du-panel'), persist: !demoOnly, clock: () => new Date().toISOString() });
  const exampleAcceleration = createAcceleration({ folder: path.join(profile, '.lazy-du-panel'), persist: false, prefix: '/api/example-acelerador' });
  const example = JSON.parse(
    readAsset('example.json').toString('utf8'),
  );
  const assets = {
    "/copy-session.js": ["copy-session.js","text/javascript"],
    "/copy-session.css": ["copy-session.css","text/css"],
    "/connect22.js": ["connect22.js","text/javascript"],
    "/guidance22.js": ["guidance22.js","text/javascript"],
    "/guidance22.css": ["guidance22.css","text/css"],
    "/onboarding22.js": ["onboarding22.js","text/javascript"],
    "/onboarding22.css": ["onboarding22.css","text/css"],
    "/controls211.css": ["controls211.css","text/css"],
    "/controls211.js": ["controls211.js","text/javascript"],
    "/teach211.css": ["teach211.css","text/css"],
    "/resolve211.css": ["resolve211.css","text/css"],
    "/resolve211.js": ["resolve211.js","text/javascript"],
    "/quick-start.js": ["quick-start.js", "text/javascript"],
    "/v21.js": ["v21.js", "text/javascript"],
    "/v21.css": ["v21.css", "text/css"],
    "/colors.css": ["colors.css", "text/css"],
    "/look.css": ["look.css", "text/css"],
    "/look.js": ["look.js", "text/javascript"],
    "/look-views.js": ["look-views.js", "text/javascript"],
    "/look-team.js": ["look-team.js", "text/javascript"],
    "/teach.js": ["teach.js", "text/javascript"],
    "/bell.js": ["bell.js", "text/javascript"],
    "/acelerador/acelerador.js": ["acelerador.js", "text/javascript"],
    "/acelerador/acelerador.css": ["acelerador.css", "text/css"],
    "/": ["index.html", "text/html"],
    "/panel.js": ["panel.js", "text/javascript"],
    "/panel.css": ["panel.css", "text/css"],
    "/r4.js": ["r4.js", "text/javascript"],
    "/r4-core.js": ["r4-core.js", "text/javascript"],
    "/r4.css": ["r4.css", "text/css"],
    "/r5.css": ["r5.css", "text/css"],
    "/r6.css": ["r6.css", "text/css"],
    "/r7.css": ["r7.css", "text/css"],
    "/r7-usage.js": ["r7-usage.js", "text/javascript"],
    "/r9-model.js": ["r9-model.js", "text/javascript"],
    "/r9.js": ["r9.js", "text/javascript"],
    "/r9-usage.js": ["r9-usage.js", "text/javascript"],
    "/locale.js": ["locale.js", "text/javascript"],
    "/r11.css": ["r11.css", "text/css"],
    "/r9.css": ["r9.css", "text/css"],
    "/human.js": ["human.js", "text/javascript"],
    "/v2.js": ["v2.js", "text/javascript"],
    "/v2-core.js": ["v2-core.js", "text/javascript"],
    "/v2.css": ["v2.css", "text/css"],
    "/welcome.js": ["welcome.js", "text/javascript"],
    "/welcome.css": ["welcome.css", "text/css"],
    "/dus.js": ["dus.js", "text/javascript"],
    "/crew.js": ["crew.js", "text/javascript"],
    "/prompts.js": ["prompts.js", "text/javascript"],
    "/sync.js": ["sync.js", "text/javascript"],
    "/sync.css": ["sync.css", "text/css"],
    "/lofi.js": ["lofi.js", "text/javascript"],
    "/lofi.css": ["lofi.css", "text/css"],
    "/tips.js": ["tips.js", "text/javascript"],
    "/tips.css": ["tips.css", "text/css"],
    "/guide-choose.svg": ["guide-choose.svg", "image/svg+xml"],
    "/guide-work.svg": ["guide-work.svg", "image/svg+xml"],
    "/guide-panel.svg": ["guide-panel.svg", "image/svg+xml"],
    "/du.png": ["du.png", "image/png"],
    "/du-mini.png": ["du-mini.png", "image/png"],
    "/marca.png": ["marca.png", "image/png"],
    "/favicon.svg": ["favicon.svg", "image/svg+xml"],
    "/brand-font.woff2": ["brand-font.woff2", "font/woff2"],
  };
  for (const du of require('../public/dus.json')) assets[du.image]=['dus/'+du.id+'.png','image/png'];
  const server = http.createServer(async (req, res) => {
    const send = (code, data, type = "application/json") => {
      let body=Buffer.isBuffer(data)?data:Buffer.from(type === "application/json" ? JSON.stringify(data) : data);const compressed=body.length>1024&&/text|javascript|json|svg/.test(type)&&/\bgzip\b/.test(req.headers['accept-encoding']||'');if(compressed){let zipped=compressedBodies.get(body);if(!zipped){zipped=require('node:zlib').gzipSync(body);compressedBodies.set(body,zipped);}body=zipped;}
      res.writeHead(code, {
        "Content-Type": type,
        "Content-Length": body.length,
        "Vary": "Accept-Encoding",
        ...(compressed?{"Content-Encoding":"gzip"}:{}),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          "default-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-src "+(offline?"'none'":"https://www.youtube-nocookie.com")+"; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      });
      res.end(body);
    };
    const port = server.address()?.port;
    if (!["127.0.0.1:" + port, "localhost:" + port].includes(req.headers.host))
      return send(403, { error: "Local access only" });
    if (
      req.headers.origin &&
      !["http://127.0.0.1:" + port, "http://localhost:" + port].includes(
        req.headers.origin,
      )
    )
      return send(403, { error: "Local origin required" });
    let url;
    try {
      url = new URL(req.url, "http://127.0.0.1");
    } catch {
      return send(400, { error: "Invalid URL" });
    }
    if (url.pathname === '/api/exit' && req.method === 'POST' && onClose) {
      if (req.headers.origin !== 'http://127.0.0.1:' + port && req.headers.origin !== 'http://localhost:' + port)
        return send(403, {error:'Local origin required'});
      send(200, {closed:true});setImmediate(onClose);return;
    }
    if(req.method==='POST'&&['/api/guidance-settings','/api/onboarding-connect'].includes(url.pathname)){
      if(!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin))return send(403,{error:'Local origin required'});
      if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return send(415,{error:'JSON required'});
      let body='',oversized=false;req.on('data',chunk=>{body+=chunk;if(Buffer.byteLength(body)>32768){oversized=true;send(413,{error:'Request too large'});req.destroy();}});
      req.on('end',async()=>{if(oversized)return;try{const data=JSON.parse(body);if(url.pathname==='/api/guidance-settings'){const usage=metrics.snapshot(),allowed=[...new Set((usage.sessions||[]).map(s=>s.projectId).filter(id=>/^[a-f\d]{8}$/.test(id)))];guidanceSettings.update(data,allowed);invalidateStatus();send(200,{saved:true});}else{if(!data||Object.keys(data).length!==1||!/^[a-f\d]{8}$/.test(data.projectKey))throw Error('Invalid project');const folder=rulesReader.resolveTaskFolder(data.projectKey);if(!board)board=new TaskBoard(base,{profile});board.connect(folder);invalidateStatus();send(200,{connected:true});}}catch{send(400,{error:'Could not update local preferences'});}});return;
    }
    if(req.method==='POST'&&['/api/board','/api/scope'].includes(url.pathname)){
      if(req.headers.origin!=='http://127.0.0.1:'+port&&req.headers.origin!=='http://localhost:'+port)return send(403,{error:'Local origin required'});
      let body='';req.on('data',chunk=>{body+=chunk;if(body.length>4096)req.destroy();});req.on('end',async()=>{try{const data=JSON.parse(body);if(url.pathname==='/api/board'){if(!board)board=new TaskBoard(base,{profile});board.connect(data.folder);invalidateStatus();send(200,{connected:true});}else{await metrics.setScopeDays(data.days);invalidateStatus();send(200,{days:metrics.scopeDays});}}catch{send(400,{error:'Could not update local preferences'});}});return;
    }
    if (exampleAcceleration.handle(req, res, url) || acceleration.handle(req, res, url)) return;
    if (req.method !== "GET") return send(405, { error: "Read-only panel" });
    if (url.pathname === "/api/news") {
      // Only when the person asks in the bell: a plain GET to the public news file, nothing about them.
      if(offline)return send(200,{offline:true,ok:false});
      readNews().then((body) => send(200, body), () => send(200, { ok: false }));
      return;
    }
    if(url.pathname==='/api/update-check'){checkUpdate({offline,fetcher:updateFetch}).then(body=>send(200,body));return;}
    if (url.pathname === "/api/health")
      return send(200, { app: "lazy-du-open-panel", version, setup:1, revision:version, offline, installMethod:INSTALL_METHOD, desktop:!!onClose });
    if (url.pathname === "/api/status") {
      if(url.searchParams.get("refresh")==="1")rulesReader.invalidate();
      if (demoOnly || url.searchParams.get("example") === "1")
        return send(200,exampleStatus(url.searchParams.get('size')));
      try {
        if (!metrics.running && (metrics.pending || url.searchParams.get("refresh") === "1" || Date.now() - metrics.last >= 180000))
          metrics.refresh().catch(() => {});
        const usageReading=usageMemo.read([metrics.published,metrics.processes,metrics.running,metrics.pending,metrics.last,metrics.readAt,metrics.scopeRevision,metrics.scopeDays,metrics.finishedFiles?.size,metrics.discovery?.found.size,metrics.discovery?.complete,metrics.discovery?.old.size,metrics.cache?.hits,metrics.cache?.misses,metrics.index?.available?.codex,metrics.index?.available?.claude,metrics.scanned?.size,metrics.index?null:Math.floor(Date.now()/1000)],()=>metrics.snapshot());
        const usage = usageReading.value;
        if (!board) board = new TaskBoard(base,{profile});
        if (usage.ready === true && !(usage.sessions || []).length && !usage.errors) return send(200,{...exampleStatus(url.searchParams.get('size')||'solo'),fallback:true});
        if(usage.ready&&!usage.pending&&readingFinished===null)readingFinished=Date.now();
        const elapsedSeconds=Math.floor(((readingFinished??Date.now())-readingStarted)/1000),progress={done:usage.progress?.done??0,total:usage.progress?.total??null,elapsedSeconds};
        const boardReading=boardMemo.read([board],()=>board.snapshot());
        const rules=await rulesReader.snapshot(usage,boardReading.value,board.state?.folder||null),saved=guidanceSettings.snapshot();
        const guidanceReading=guidanceMemo.read([usageReading,rules,saved.revision,Math.floor(Date.now()/60000)],()=>generateGuidance(usage,saved,rules));
        const reading=bodyMemo.read([usageReading,boardReading,guidanceReading,elapsedSeconds],()=>Buffer.from('{"usage":'+usageReading.json+','+(boardReading.json==='{}'?'':boardReading.json.slice(1,-1)+',')+'"guidance":'+guidanceReading.json+',"reading":'+JSON.stringify(progress)+',"cards":[],"example":false,"offline":'+offline+',"desktop":'+!!onClose+'}'));
        return send(200,reading.value);
      } catch {
        return send(503, { error: "Local metadata unavailable" });
      }
    }
    if (assets[url.pathname]) {
      const [name, type] = assets[url.pathname];
      try {
        return send(
          200,
          name==='index.html'?bootstrapHTML(readAsset('public/'+name).toString('utf8'),url.searchParams.get('lang')).replace('<html ',offline?'<html data-offline="true" ':'<html '):readAsset('public/' + name),
          type,
        );
      } catch {
        return send(404, { error: "Asset unavailable" });
      }
    }
    return send(404, { error: "Not found" });
  });
  return server;
}
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === "init") {
    try {
      const base = path.resolve(args[1] || "example-workspace");
      init(base);
      console.log(
        "Example workspace created. Run node src/panel.cjs --workspace <folder>.",
      );
    } catch {
      console.error("Could not create the example. Use an empty folder.");
      process.exitCode = 1;
    }
  } else {
    const at = args.indexOf("--port"),
      port = at < 0 ? 3251 : Number(args[at + 1]),
      wi = args.indexOf("--workspace"),
      base =
        wi < 0 ? path.join(__dirname, "..") : path.resolve(args[wi + 1] || ".");
    if (!Number.isInteger(port) || port < 1024 || port > 65535)
      throw Error("Invalid port");
    const server = createServer({ base, demoOnly: args.includes("--demo"), offline:args.includes("--offline"), onClose: () => server.close(() => process.exit(0)) });
    server.on("error", () => {
      console.error(
        "The local panel could not start. Check that the port is free.",
      );
      process.exitCode = 1;
    });
    server.listen(port, "127.0.0.1", () =>
      console.log("Lazy Du panel: http://127.0.0.1:" + port),
    );
  }
}
module.exports = { createServer,checkUpdate };
