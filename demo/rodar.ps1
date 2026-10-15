# Abre o painel com o estado de exemplo (ficticio). Uso: powershell -ExecutionPolicy Bypass -File demo/rodar.ps1 [-Porta 3257] [-PortaIdeias 3259]
param([ValidateRange(1,65535)][int]$Porta = 3257, [ValidateRange(1,65535)][int]$PortaIdeias = 3259)
$ErrorActionPreference = 'Stop'
$demoDir = $PSScriptRoot
$painelDir = Split-Path -Parent $demoDir
$env:PAINEL_ROOT = Join-Path $demoDir 'estado'
$env:PAINEL_HOME = Join-Path $demoDir 'home'
$env:PAINEL_PORT = [string]$Porta
$env:PAINEL_IDEIAS_PORT = [string]$PortaIdeias
$env:PAINEL_IDEIAS_URL = "http://127.0.0.1:$PortaIdeias"
$env:PAINEL_SO_LEITURA = '0'
$env:PAINEL_DEV = '0'
$env:PE_ESTADO = $env:PAINEL_ROOT
$env:PE_PAINEL = $painelDir
$env:PE_UPSTREAM = [string]$Porta
$env:PE_CLAUDE_PROJECTS = Join-Path $env:PAINEL_HOME '.claude/projects'
$env:PE_CODEX_SESSIONS = Join-Path $env:PAINEL_HOME '.codex/sessions'
$env:PE_APP_SESSIONS = Join-Path $env:PAINEL_HOME 'AppData/Roaming/Claude/claude-code-sessions'
$env:PAINEL_APP_SESSIONS = $env:PE_APP_SESSIONS
$env:PAINEL_NOMES_OCULTAR = Join-Path $env:PAINEL_HOME 'nomes-ocultar.json'
$env:PAINEL_ACELERADOR_JSON = Join-Path $env:PAINEL_HOME 'acelerador.json'
$env:APPDATA = Join-Path $env:PAINEL_HOME 'AppData/Roaming'
$env:LOCALAPPDATA = Join-Path $env:PAINEL_HOME 'AppData/Local'
$env:TMPDIR = Join-Path $env:PAINEL_HOME 'tmp'
$env:TEMP = $env:TMPDIR
$env:TMP = $env:TMPDIR
& node (Join-Path $demoDir 'gerar.cjs')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
New-Item -ItemType Directory -Force -Path $env:TMPDIR | Out-Null
& node (Join-Path $demoDir 'iniciar.cjs')
exit $LASTEXITCODE
