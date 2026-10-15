---
id: 2025-03-14-busca-nova
dono: backend
projeto: App de receitas
executor: claude
estado: andando
prazo: 2025-03-15
---
# Busca que entende acento

## Objetivo
"pão" e "pao" acham as mesmas receitas.

## Pode tocar
src/busca/, tests/busca/

## Não pode tocar
src/pagamento/, .env, qualquer coisa fora de src/busca/ (precisou: pare e devolva o pedido)

## Pronto quando
- Teste novo vermelho antes e verde depois (os dois no Log).
- Revisão CONFERE no hash exato.
- Card de subir respondido com prova.

## Log
- 2025-03-14 14:10 aberta, escopo acima.
- 2025-03-14 14:40 teste vermelho: 3 falhas (acento), como esperado.
- 2025-03-14 15:05 verde: tests/busca 48/48; commit d4e5f6a no ramo busca-nova. Revisão pedida.
