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
function bootstrapHTML(html,locale){const language=['en','pt','es'].includes(locale)?locale:'en',text={en:['Reading local metadata...','Enable JavaScript to open your panel.'],pt:['Lendo metadados locais...','Ative o JavaScript para abrir seu painel.'],es:['Leyendo metadatos locales...','Activa JavaScript para abrir tu panel.']}[language];const labels={en:{completed:'Completed task',activity:'Recent activity',blocked:'Blocked by',speed:'Can we speed up?',next:'Your next step',credit:'Credit',reading:'Reading...',sessions:'Reading sessions...',overview:'Where things stand',retry:'Reload panel'},pt:{completed:'Tarefa concluída',activity:'Atividade recente',blocked:'Travado por',speed:'Dá para acelerar?',next:'Seu próximo passo',credit:'Crédito',reading:'Lendo...',sessions:'Lendo sessões...',overview:'Em que pé estamos',retry:'Reabrir painel'},es:{completed:'Tarea terminada',activity:'Actividad reciente',blocked:'Bloqueado por',speed:'¿Podemos acelerar?',next:'Tu siguiente paso',credit:'Crédito',reading:'Leyendo...',sessions:'Leyendo sesiones...',overview:'Dónde estamos',retry:'Recargar panel'}}[language];html=html.replace(/(<[^>]+data-boot-copy="([^"]+)"[^>]*>)[^<]*(<\/[^>]+>)/g,(_,a,key,b)=>a+labels[key]+b).replace('class="boot-retry" data-boot-copy="retry" href="/"','class="boot-retry" data-boot-copy="retry" href="/?lang='+language+'"');return html.replace('<html lang="en"','<html lang="'+language+'"').replace('Reading local metadata...',text[0]).replace('Enable JavaScript to open your panel.',text[1]);}
function createServer({
  base = path.join(__dirname, ".."),
  profile = os.homedir(),
  metrics = new Metrics(profile, {
    processReader: () => processSnapshot({ details: true,bindSessions:true }),
  }),
  demoOnly = false,
  readAsset = (name) => fs.readFileSync(path.join(__dirname, '..', name)),
  onClose = null,
  board = null,
  newsFetch = typeof fetch === 'function' ? fetch : null,
} = {}) {
  const readNews = createNews({ fetcher: newsFetch });
  const acceleration = createAcceleration({ folder: path.join(profile, '.lazy-du-panel'), persist: !demoOnly, clock: () => new Date().toISOString() });
  const exampleAcceleration = createAcceleration({ folder: path.join(profile, '.lazy-du-panel'), persist: false, prefix: '/api/example-acelerador' });
  const example = JSON.parse(
    readAsset('example.json').toString('utf8'),
  );
  const assets = {
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
  const server = http.createServer((req, res) => {
    const send = (code, data, type = "application/json") => {
      let body=Buffer.from(type === "application/json" ? JSON.stringify(data) : data);const compressed=body.length>1024&&/text|javascript|json|svg/.test(type)&&/\bgzip\b/.test(req.headers['accept-encoding']||'');if(compressed)body=require('node:zlib').gzipSync(body);
      res.writeHead(code, {
        "Content-Type": type,
        "Content-Length": body.length,
        "Vary": "Accept-Encoding",
        ...(compressed?{"Content-Encoding":"gzip"}:{}),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          "default-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-src https://www.youtube-nocookie.com; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
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
    if(req.method==='POST'&&['/api/board','/api/scope'].includes(url.pathname)){
      if(req.headers.origin!=='http://127.0.0.1:'+port&&req.headers.origin!=='http://localhost:'+port)return send(403,{error:'Local origin required'});
      let body='';req.on('data',chunk=>{body+=chunk;if(body.length>4096)req.destroy();});req.on('end',async()=>{try{const data=JSON.parse(body);if(url.pathname==='/api/board'){if(!board)board=new TaskBoard(base);board.connect(data.folder);send(200,{connected:true});}else{await metrics.setScopeDays(data.days);send(200,{days:metrics.scopeDays});}}catch{send(400,{error:'Could not update local preferences'});}});return;
    }
    if (exampleAcceleration.handle(req, res, url) || acceleration.handle(req, res, url)) return;
    if (req.method !== "GET") return send(405, { error: "Read-only panel" });
    if (url.pathname === "/api/news") {
      // Only when the person asks in the bell: a plain GET to the public news file, nothing about them.
      readNews().then((body) => send(200, body), () => send(200, { ok: false }));
      return;
    }
    if (url.pathname === "/api/health")
      return send(200, { app: "lazy-du-open-panel", version, setup:1, revision:version, desktop:!!onClose });
    if (url.pathname === "/api/status") {
      if (demoOnly || url.searchParams.get("example") === "1")
        return send(200, {...exampleFor(example, url.searchParams.get("size")), desktop:!!onClose});
      try {
        if (!metrics.running && (metrics.pending || url.searchParams.get("refresh") === "1" || Date.now() - metrics.last >= 180000))
          metrics.refresh().catch(() => {});
        const usage = metrics.snapshot();
        if (!board) board = new TaskBoard(base);
        if (usage.ready === true && !(usage.sessions || []).length && !usage.errors) return send(200, {...exampleFor(example, url.searchParams.get("size") || "solo"), fallback: true, desktop: !!onClose});
        return send(200, {
          usage,
          ...board.snapshot(),
          cards: [],
          example: false,
          desktop: !!onClose,
        });
      } catch {
        return send(503, { error: "Local metadata unavailable" });
      }
    }
    if (assets[url.pathname]) {
      const [name, type] = assets[url.pathname];
      try {
        return send(
          200,
          name==='index.html'?bootstrapHTML(readAsset('public/'+name).toString('utf8'),url.searchParams.get('lang')):readAsset('public/' + name),
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
    const server = createServer({ base, demoOnly: args.includes("--demo"), onClose: () => server.close(() => process.exit(0)) });
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
module.exports = { createServer };
