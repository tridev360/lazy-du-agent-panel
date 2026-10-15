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

## Privacy

- Session reading is metadata only: known scalar fields from the records. Messages and tool outputs are discarded; private files, links, `.credentials.json` and `auth.json` are not opened.
- Conversation view, voice, music and the research log start off and are turned on only by your choice.
- Nothing is sent out of your computer, with two opt-in exceptions: Ask (uses your Codex) under Decide > Council runs your installed Codex, read only, with the idea text, only when you click; the lofi radio loads YouTube only if you add radios to `estado/lofi.json` and press play.
- Names you list in `config/nomes-ocultar.json` are masked in every response.

## Optional settings

| Variable | Default | Use |
| --- | --- | --- |
| PAINEL_HOME | your home | folder with .claude and .codex |
| PAINEL_HOMES | one home | JSON array of homes, or paths separated by semicolons |
| CLAUDE_CONFIG_DIR | .claude in home | real Claude config folder, with projects/ |
| CODEX_HOME | .codex in home | real Codex folder, with sessions/ |
| PAINEL_ROOT | estado-local, if present | another state folder |
| PAINEL_PORT | 3257 | local port, also `--port 3261` |
| PAINEL_SO_LEITURA | off | 1 turns off every write to the state |

## License

MIT. See [LICENSE](LICENSE). Bundled fonts (Geist, Inter, JetBrains Mono, Silkscreen) keep their own OFL licenses in `letras/`.
