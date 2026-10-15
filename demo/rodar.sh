#!/usr/bin/env bash
# Abre o painel com o estado de exemplo (ficticio). Uso: ./demo/rodar.sh [porta do painel] [porta do app de ideias]
set -euo pipefail
DEMO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PAINEL_DIR="$(cd -- "$DEMO_DIR/.." && pwd)"
PORTA="${1:-3257}"; PORTA_IDEIAS="${2:-3259}"
export PAINEL_ROOT="$DEMO_DIR/estado"
export PAINEL_HOME="$DEMO_DIR/home"
export PAINEL_PORT="$PORTA" PAINEL_IDEIAS_PORT="$PORTA_IDEIAS" PAINEL_IDEIAS_URL="http://127.0.0.1:$PORTA_IDEIAS"
export PAINEL_SO_LEITURA=0 PAINEL_DEV=0
export PE_ESTADO="$PAINEL_ROOT" PE_PAINEL="$PAINEL_DIR" PE_UPSTREAM="$PORTA"
export PE_CLAUDE_PROJECTS="$PAINEL_HOME/.claude/projects" PE_CODEX_SESSIONS="$PAINEL_HOME/.codex/sessions"
export PE_APP_SESSIONS="$PAINEL_HOME/AppData/Roaming/Claude/claude-code-sessions" PAINEL_APP_SESSIONS="$PAINEL_HOME/AppData/Roaming/Claude/claude-code-sessions"
export PAINEL_NOMES_OCULTAR="$PAINEL_HOME/nomes-ocultar.json" PAINEL_ACELERADOR_JSON="$PAINEL_HOME/acelerador.json"
export APPDATA="$PAINEL_HOME/AppData/Roaming" LOCALAPPDATA="$PAINEL_HOME/AppData/Local" TMPDIR="$PAINEL_HOME/tmp"
mkdir -p -- "$TMPDIR"
node "$DEMO_DIR/gerar.cjs"
exec node "$DEMO_DIR/iniciar.cjs"
