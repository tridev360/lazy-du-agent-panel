# Lazy Du Agent Panel

A local panel for your Claude Code and Codex sessions: who is waiting for you, who is working now, projects, helpers and usage. It runs on your computer, with no account, no API key and no dependencies. Node 20 or newer.

[Português](README.pt-BR.md)

> Version 3 is a new base. The interface is mostly in Portuguese for now; English and Spanish cover part of the screens. Version 2.2.8 stays available under the `v2.2.8` tag.

## Start here

1. Clone or download this repository into a new folder.
2. Run `node checar.cjs` to check the setup in plain sentences, then `node servidor.cjs`.
3. Open http://127.0.0.1:3257. Read Start here and take the one minute tour, or skip it.
4. Look at Waiting for you, answer in the Claude Code or Codex session, then check Working now.

To open it again: `painel.bat` on Windows or `sh painel.sh` on Linux. The server listens only on 127.0.0.1. Ctrl+C stops a server started in the terminal.

Prefer to try it first? `npm run example` (or `npm run example:win`) opens a fictional state, with no real sessions.

## What you get

- Now: what waits for you, agents working now and the age of each reading. A missing reading shows "?" with the fix, never an invented zero.
- Flow: coordinator, sessions and helpers in one vertical view, with who sends and who receives.
- Ideas: ideas with votes and a one tap decision. Optional reviewers ("councillors") give a verdict before you decide.
- Brain: your CLAUDE.md, memory, agents and rules, when you allow those sources.
- Schedule, deliveries, cards and queue when you connect an optional state folder (see `metodo/GUIA.md`).
- WEN: a one line per front summary with progress, minutes left and who works now.
- Grid, Book and Sheet themes. Motion respects reduced motion.

## Requests to the coordinator and session shortcut

- In Waiting for you, each session has one shortcut: "Abrir sessão ↗" opens the conversation in the Claude app or in Codex; a terminal-only session gets "Copiar comando" (`claude --resume <id>`).
- Requests start off and live in the full screen (http://127.0.0.1:3257/painel-estado, which needs the state folder from step 2 in `metodo/`). In Recursos pessoais, click Ligar pedidos: what you send from the panel, to one session or to the coordinator (the session that coordinates the others for you), becomes one line in `estado/pedidos-sessoes.jsonl`. The panel does not talk to the session by itself.
- For the coordinator to read the queue: in the Claude Code session that coordinates, ask it to run `bash ferramentas/escuta-pedidos.sh` with the Monitor tool (on Windows, through Git Bash). Each new request arrives as one `PEDIDO: {...}` line, including those addressed to one session. The first time, it starts at the end of the queue (older requests do not arrive); after that it picks up where it stopped, including requests sent while it was off, and each request comes only once. If your state folder is not `estado-local`, run it with the same `PAINEL_ROOT`.
- Only you should write to this queue: the text of each request becomes an instruction for the coordinating agent (a prompt injection risk). Do not let other programs or people add lines to `estado/pedidos-sessoes.jsonl`, and ask the agent to confirm in its chat before anything risky. The listener only passes lines in the format the panel writes and never rewrites the queue.
- For the answer to show in the panel, with voice on (Ligar voz, in Recursos pessoais), the coordinator writes one line `{"ts":"<ISO time>","texto":"..."}` to `estado/voz-respostas.jsonl`. To answer inside one session's tab, add `"sessao":"<id from the request>"`.

## Monitors

Create `config/monitores.json` from `config/monitores.exemplo.json`, or pick another path with `PAINEL_MONITORES`. The file stays out of git (`.gitignore`). Each item has an `id` (a-z, 0-9 and hyphen), a short `nome` and a `tipo`:

- `http`: GET of `url` or `urlEnv`, with optional `esperar` (default 200 to 399) and `timeoutMs` (default 5000, max 15000). A URL with a key goes only through `urlEnv`, which holds the name of the environment variable. Literal URLs with credentials, secret parameters or a key-like path segment are refused. Redirects are followed only to the same host and port, or from http on port 80 to https on port 443 of the same host. The screen shows only the host or the variable name.
- `comando`: executable in `comando` and a list of strings in `args`, with no shell. Only the exit code is used; the output is discarded. `timeoutMs`: default 10000, max 30000; on timeout the command and what it started are stopped (on Windows, processes left in the background by a Git Bash script may keep running). On Windows, `.cmd` and `.bat` files do not run (Node 20.12.2 or newer).
- `batimento`: `arquivo` relative to `PAINEL_ROOT` (the state folder you chose) or absolute; only its modification time is read. `maxIdadeSegundos`: default 300.

`intervaloSegundos` is at least 60 s. Checks start when the simple screen or the Book theme Now screen asks for the monitors, run one at a time while the panel is open, and reload the configuration when its modification time changes. The demo and the example never read this file. Nothing configured = the section is hidden on the simple screen; the Book theme shows "Nenhum monitor configurado". No reading shows "?". A monitor that is down also shows in "Esperando você". Configuring HTTP or a command authorizes those checks, including connections to the destination you chose.

## Privacy

- Session reading is metadata only: known scalar fields from the records. Messages and tool outputs are discarded; private files, links, `.credentials.json` and `auth.json` are not opened.
- Conversation view, voice, music and the research log start off and are turned on only by your choice.
- Nothing is sent out of your computer, with opt-in exceptions: Ask (uses your Codex) under Decide > Council runs your installed Codex, read only, with the idea text, only when you click; the lofi radio loads YouTube only if you add radios to `estado/lofi.json` and press play; configured monitors run HTTP checks or commands, which may connect to the destinations you choose.
- Names you list in `config/nomes-ocultar.json` are masked in every response.

## Optional settings

| Variable | Default | Use |
| --- | --- | --- |
| PAINEL_HOME | your home | folder with .claude and .codex |
| PAINEL_HOMES | one home | JSON array of homes, or paths separated by semicolons |
| CLAUDE_CONFIG_DIR | .claude in home | real Claude config folder, with projects/ |
| CODEX_HOME | .codex in home | real Codex folder, with sessions/ |
| PAINEL_ROOT | estado-local, if present | another state folder |
| PAINEL_MONITORES | config/monitores.json | another monitors file |
| PAINEL_PORT | 3257 | local port, also `--port 3261` |
| PAINEL_SO_LEITURA | off | 1 turns off every write to the state |

## License

MIT. See [LICENSE](LICENSE). Bundled fonts (Geist, Inter, JetBrains Mono, Silkscreen) keep their own OFL licenses in `letras/`.
