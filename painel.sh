#!/bin/sh
# Pode ser chamado de qualquer pasta. Em servidor sem tela, imprime o endereço.
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)" || exit 1
node abrir.cjs
