#!/usr/bin/env node
"use strict";
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createServer } = require("./panel.cjs");

function isReady(port) {
  return new Promise((resolve) => {
    const request = http.get(
      `http://127.0.0.1:${port}/api/health`,
      (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(body).app === "lazy-du-open-panel");
          } catch {
            resolve(false);
          }
        });
      },
    );
    request.on("error", () => resolve(false));
    request.setTimeout(500, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function browserCommand(platform, url) {
  if (platform === "win32") {
    return {
      command: "powershell.exe",
      args: [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Start-Process '${url}'`,
      ],
    };
  }
  return { command: platform === "darwin" ? "open" : "xdg-open", args: [url] };
}

async function launch(args = process.argv.slice(2)) {
  const portIndex = args.indexOf("--port");
  const port = portIndex < 0 ? 3251 : Number(args[portIndex + 1]);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw Error("Invalid port");
  const workspaceIndex = args.indexOf("--workspace");
  const base =
    workspaceIndex < 0
      ? process.cwd()
      : path.resolve(args[workspaceIndex + 1] || ".");
  if (!(await isReady(port))) {
    const server = createServer({ base, demoOnly: args.includes("--demo") });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", resolve);
    });
  }
  const url = `http://127.0.0.1:${port}`;
  console.log(`Lazy Du panel: ${url}`);
  if (!args.includes("--no-browser")) {
    const { command, args: browserArgs } = browserCommand(
      process.platform,
      url,
    );
    const browser = spawn(command, browserArgs, {
      windowsHide: true,
      stdio: "ignore",
    });
    browser.on("error", () => console.log(`Open ${url} in your browser.`));
    browser.unref();
  }
}

if (require.main === module) {
  launch().catch(() => {
    console.error("Could not start the panel. Check that the port is free.");
    process.exitCode = 1;
  });
}
module.exports = { launch, browserCommand, isReady };
