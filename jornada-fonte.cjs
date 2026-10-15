'use strict';
const fs=require('node:fs'),path=require('node:path'),M=require('./jornada-modelo.js'),C=require('./conselho-modelo.js');
const PRIVATE=/PRIVADO|_SECRETS|backup-privado|privado-a|privado-b|repo-privado|\.env\b|\b(?:seed|mnemonic|secret|token|password|senha|api.?key|chave)\b|private.?key/i;
function sanitize(v){return typeof v==='string'&&!PRIVATE.test(v)?C.text(v):null;}
function sourceAlias(v){if(typeof v!=='string'||PRIVATE.test(v))return null;if(/[a-z]:[\\/]/i.test(v))return /\.jsonl/i.test(v)?'registro de sessão local':/marcos\.json/i.test(v)?'estado/marcos.json':'documento local';return sanitize(v);}
function read(root,now=Date.now()){
  const opts={now,source:'estado/linha-do-tempo.json',sanitize,sourceAlias,private:r=>PRIVATE.test(JSON.stringify([r.titulo,r.resumo_curto,r.detalhe,r.fonte]))};
  try{if(fs.lstatSync(root).isSymbolicLink())return M.normalize(null,opts);const file=path.join(root,'linha-do-tempo.json'),st=fs.lstatSync(file);if(!st.isFile()||st.isSymbolicLink()||st.size>2097152)return M.normalize(null,opts);return M.normalize(JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')),opts);}catch{return M.normalize(null,opts);}
}
module.exports={read,sanitize,sourceAlias};
