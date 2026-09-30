const http = require("node:http"),
  path = require("node:path"),
  { spawn } = require("node:child_process");
const ready = () =>
  new Promise((resolve) => {
    const req = http.get("http://127.0.0.1:3251/api/health", (res) => {
      let data = "";
      res.on("data", (x) => (data += x));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data).app === "lazy-du-open-panel");
        } catch {
          resolve(false);
        }
      });
    });
    req.on("error", () => resolve(false));
    req.setTimeout(500, () => {
      req.destroy();
      resolve(false);
    });
  });
(async () => {
  if (!(await ready()))
    spawn(process.execPath, [path.join(__dirname, "panel.cjs")], {
      cwd: __dirname,
      windowsHide: true,
      detached: true,
      stdio: "ignore",
    }).unref();
  for (let i = 0; i < 15; i++) {
    if (await ready()) {
      const url = "http://127.0.0.1:3251";
      const command =
        process.platform === "win32"
          ? "powershell.exe"
          : process.platform === "darwin"
            ? "open"
            : "xdg-open";
      const args =
        process.platform === "win32"
          ? [
              "-NoProfile",
              "-NonInteractive",
              "-Command",
              "Start-Process 'http://127.0.0.1:3251'",
            ]
          : [url];
      spawn(command, args, { windowsHide: true, stdio: "ignore" }).unref();
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  console.error("Could not open the panel. Check port 3251.");
  process.exitCode = 1;
})();
