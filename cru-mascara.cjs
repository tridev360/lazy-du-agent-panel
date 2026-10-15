'use strict';
const {limpar,permitido}=require('./r10-fontes.cjs');
function arquivoSensivel(v){return !permitido(String(v||''))||/(?:^|[\\/])(?:\.env(?:\.[^\\/]*)?|[^\\/]+\.env)(?:$|[\\/])/i.test(String(v));}
function comandoSensivel(v){return /(?:\.env\b|segredos?|secrets?|sigilos[oa]s?|privad[oa]s?|wallet[-_.]?backups?|private.?key|seed|mnemonic|credentials?)/i.test(String(v||''));}
function mascarar(v){return limpar(String(v||'')).replace(/((?:password|senha|secret|token|api[_-]?key|authorization)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|\S+)/gi,'$1[protegido]');}
module.exports={mascarar,arquivoSensivel,comandoSensivel};
