#!/usr/bin/env bash
# Leitor da fila de pedidos do painel. Laco: a cada 3 s imprime cada pedido novo de estado/pedidos-sessoes.jsonl com o prefixo "PEDIDO: ".
# Feito para o Claude Code que coordena rodar com a ferramenta Monitor: cada linha "PEDIDO: " vira um evento para ele tratar.
# So passa linha no formato que o painel grava: JSON com id pedido-<ms>-<8 hex> e origem painel, voz, compositor ou fluxo. O resto e ignorado.
# Cada id sai uma vez so (lista em estado/.pedidos.vistos). Se a fila for reescrita (menor, ou sem fim de linha onde parou), pula para o fim.
# O deslocamento (bytes ja lidos) fica em estado/.pedidos.offset. Sem deslocamento, comeca do fim da fila (nao repete pedidos antigos).
# Linha ainda sem fim de linha espera a proxima volta. So le a fila; grava so o deslocamento e a lista de ids. No Windows, rode pelo Git Bash.
# Ajustes: PAINEL_ROOT (pasta de estado), PEDIDOS_ARQ, PEDIDOS_OFFSET, PEDIDOS_INTERVALO (s) e PEDIDOS_VOLTAS (0 = sem fim).
export LC_ALL=C
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="${PAINEL_ROOT:-$AQUI/../estado-local}"
ARQ="${PEDIDOS_ARQ:-$RAIZ/estado/pedidos-sessoes.jsonl}"
OFF="${PEDIDOS_OFFSET:-$(dirname "$ARQ")/.pedidos.offset}"
VISTOS="$(dirname "$OFF")/.pedidos.vistos"
INTERVALO="${PEDIDOS_INTERVALO:-3}"
VOLTAS="${PEDIDOS_VOLTAS:-0}"
FORMATO='^\{"id":"pedido-[0-9]{13}-[0-9a-f]{8}",.*"origem":"(painel|voz|compositor|fluxo)"'

tamanho() { if [ -f "$ARQ" ]; then wc -c < "$ARQ" | tr -dc '0-9'; else printf '0'; fi; }
grava() { mkdir -p "$(dirname "$OFF")" && printf '%s\n' "$1" > "$OFF.tmp" && mv -f "$OFF.tmp" "$OFF"; }
# o byte antes do deslocamento tem de ser fim de linha; se nao for, a fila foi reescrita
alinhado() { [ "$1" -eq 0 ] && return 0; [ "$(tail -c +"$1" "$ARQ" 2>/dev/null | head -c 1 | od -An -c | tr -d ' ')" = '\n' ]; }

off=""
if [ -f "$OFF" ]; then off="$(tr -dc '0-9' < "$OFF")"; fi
if [ -z "$off" ]; then off="$(tamanho)"; grava "$off"; fi
touch "$VISTOS" 2>/dev/null

volta=0
while :; do
  tam="$(tamanho)"
  [ -z "$tam" ] && tam=0
  if [ "$tam" -lt "$off" ] || { [ "$tam" -gt "$off" ] && ! alinhado "$off"; }; then off="$tam"; grava "$off"; fi
  if [ "$tam" -gt "$off" ]; then
    lidos=0
    # read sem fim de linha falha: a linha incompleta nao conta e volta inteira na proxima vez
    while IFS= read -r linha; do
      lidos=$((lidos + ${#linha} + 1))
      linha="${linha%$'\r'}"
      [[ "$linha" =~ $FORMATO ]] || continue
      id="${linha:7:36}"; id="${id%%\"*}"
      grep -qxF "$id" "$VISTOS" 2>/dev/null && continue
      printf '%s\n' "$id" >> "$VISTOS"
      printf 'PEDIDO: %s\n' "$linha"
    done < <(tail -c +"$((off + 1))" "$ARQ" | head -c "$((tam - off))")
    if [ "$lidos" -gt 0 ]; then off=$((off + lidos)); grava "$off"; fi
    # a lista guarda so os 500 ids mais novos
    if [ "$(wc -l < "$VISTOS" | tr -dc '0-9')" -gt 1000 ]; then tail -n 500 "$VISTOS" > "$VISTOS.tmp" && mv -f "$VISTOS.tmp" "$VISTOS"; fi
  fi
  volta=$((volta + 1))
  if [ "$VOLTAS" -gt 0 ] && [ "$volta" -ge "$VOLTAS" ]; then break; fi
  sleep "$INTERVALO"
done
