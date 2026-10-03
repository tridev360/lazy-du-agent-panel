#!/usr/bin/env node
"use strict";
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { version } = require("../package.json");

function isReady(port, { desktop = false, offline = false } = {}) {
  return new Promise((resolve) => {
    const request = http.get(
      `http://127.0.0.1:${port}/api/health`,
      (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;if(body.length>8192){request.destroy();resolve(false);}
        });
        response.on("end", () => {
          try {
            const status = JSON.parse(body);
            resolve(response.statusCode === 200 && status.app === "lazy-du-open-panel" && status.version === version && (!offline || status.offline===true) && (!desktop || (status.setup === 1 && status.desktop === true && status.revision === version)));
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

async function launch(args = process.argv.slice(2),{ready=isReady,spawnProcess=spawn,log=console.log,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}) {
  const portIndex = args.indexOf("--port");
  const port = portIndex < 0 ? 3251 : Number(args[portIndex + 1]);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw Error("Invalid port");
  const workspaceIndex = args.indexOf("--workspace");
  const base =
    workspaceIndex < 0
      ? process.cwd()
      : path.resolve(args[workspaceIndex + 1] || ".");
  const offline=args.includes('--offline'),langIndex=args.indexOf('--lang'),lang=['en','pt','es'].includes(args[langIndex+1])?args[langIndex+1]:'en';
  const url=`http://127.0.0.1:${port}`,texts={en:{existing:'The panel is already open at ',opened:'Panel open at ',close:'. You can close this terminal; to stop the panel, use Close panel in the footer.',offline:'Close the existing panel in its footer, then run this command again with --offline.'},pt:{existing:'O painel já está aberto em ',opened:'Painel aberto em ',close:'. Pode fechar este terminal; para fechar o painel, use Fechar painel no rodapé.',offline:'Feche o painel atual pelo rodapé e rode o comando de novo com --offline.'},es:{existing:'El panel ya está abierto en ',opened:'Panel abierto en ',close:'. Puedes cerrar esta terminal; para cerrar el panel, usa Cerrar panel en el pie.',offline:'Cierra el panel actual desde el pie y ejecuta otra vez el comando con --offline.'}}[lang];
  const existing=await ready(port);
  if(existing){if(offline&&!(await ready(port,{offline:true})))throw Error(texts.offline);log(texts.existing+url);}
  else{
    const childArgs=[path.join(__dirname,'panel.cjs'),'--port',String(port),'--workspace',base,...(args.includes('--demo')?['--demo']:[]),...(offline?['--offline']:[])];
    const child=spawnProcess(process.execPath,childArgs,{detached:true,windowsHide:true,stdio:'ignore'});let failed=false;child.on('error',()=>{failed=true;});child.unref();
    let started=false;for(let attempt=0;attempt<30&&!failed;attempt++){await pause(100);if(await ready(port,{offline})){started=true;break;}}
    if(!started)throw Error('Could not start the local panel. Check that the port is free.');
    log(texts.opened+url+texts.close);
  }
  if (!args.includes("--no-browser")) {
    const { command, args: browserArgs } = browserCommand(
      process.platform,
      url,
    );
    const browser = spawnProcess(command, browserArgs, {
      windowsHide: true,
      stdio: "ignore",
    });
    browser.on("error", () => log(`Open ${url} in your browser.`));
    browser.unref();
  }
}

if (require.main === module) {
  launch().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
module.exports = { launch, browserCommand, isReady };
