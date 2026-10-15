---
name: portao-antes-do-commit
description: "ERRO: 'teste | grep && git commit' gravou commit com teste vermelho; o commit depende do código de saída do teste, nunca de pipe"
metadata:
  type: feedback
---

O que aconteceu: `npx vitest run x | grep Tests && git commit` commitou com 1 teste vermelho. O grep achou a linha e saiu com 0, então o `&&` seguiu. Aconteceu mais de uma vez, com `| head` também.

**Why:** várias sessões mexem no mesmo repositório; um vermelho tem de PARAR o commit, não aparecer na tela e ser ignorado.

**How to apply:** `npx vitest run <arquivos> > saida.txt 2>&1 && git add <arquivos> && git commit -F msg.txt`. O `&&` depende do código de saída do teste. Depois, leia o saida.txt e exija a linha "Tests N passed". Nunca pipe nem `|| true` entre o teste e o commit. Como já se repetiu, também virou regra no gancho (metodo-kit-barra-comando.mjs).
