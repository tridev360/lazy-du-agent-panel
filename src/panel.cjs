const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { Metrics } = require("./lib/usage.cjs");
const { processSnapshot } = require("./lib/processes.cjs");
const { workspace, init } = require("./lib/workspace.cjs");
function createServer({
  base = path.join(__dirname, ".."),
  metrics = new Metrics(os.homedir(), { processReader: processSnapshot }),
  demoOnly = false,
} = {}) {
  const example = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "example.json"), "utf8"),
  );
  const assets = {
    "/": ["index.html", "text/html"],
    "/panel.js": ["panel.js", "text/javascript"],
    "/panel.css": ["panel.css", "text/css"],
    "/du.png": ["du.png", "image/png"],
    "/marca.png": ["marca.png", "image/png"],
    "/favicon.svg": ["favicon.svg", "image/svg+xml"],
    "/brand-font.woff2": ["brand-font.woff2", "font/woff2"],
  };
  const server = http.createServer((req, res) => {
    const send = (code, data, type = "application/json") => {
      res.writeHead(code, {
        "Content-Type": type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          "default-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      });
      res.end(type === "application/json" ? JSON.stringify(data) : data);
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
    if (req.method !== "GET") return send(405, { error: "Read-only panel" });
    let url;
    try {
      url = new URL(req.url, "http://127.0.0.1");
    } catch {
      return send(400, { error: "Invalid URL" });
    }
    if (url.pathname === "/api/health")
      return send(200, { app: "lazy-du-open-panel", version: 1 });
    if (url.pathname === "/api/status") {
      if (demoOnly || url.searchParams.get("example") === "1")
        return send(200, example);
      try {
        if (!metrics.running && Date.now() - metrics.last >= 30000)
          metrics.refresh().catch(() => {});
        return send(200, {
          usage: metrics.snapshot(),
          ...workspace(base),
          cards: [],
          example: false,
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
          fs.readFileSync(path.join(__dirname, "..", "public", name)),
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
    const server = createServer({ base, demoOnly: args.includes("--demo") });
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
