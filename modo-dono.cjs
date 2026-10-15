'use strict';
// Versao publica: o modo "sigilo aberto" nao existe nesta copia. Os nomes ficam sempre mascarados.
// Mesma interface do modulo original, sempre fechada; nenhum arquivo e lido e nenhuma rota abre.
function chaveLigada() { return false; }
function pedidoDoProprioPC() { return false; }
function pedido() { return false; }
function abrir() { return false; }
function codigoNoLugarCerto() { return false; }
function arquivoChave() { return null; }
module.exports = { pedido, abrir, chaveLigada, pedidoDoProprioPC, codigoNoLugarCerto, arquivoChave };
