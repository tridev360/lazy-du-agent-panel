'use strict';
const fs=require('node:fs'),path=require('node:path'),M=require('./fluxo-modelo.js');
const FILES={fila:'fila.json',agora:'estado-agora.json',cronograma:'cronograma.json'},LIMIT=256*1024;
// Somente três arquivos fixos. Nenhum caminho vindo do conteúdo é aberto.
function input(state,file){try{
  const target=path.resolve(state,file);let cursor=target;
  while(true){const s=fs.lstatSync(cursor);if(s.isSymbolicLink())return {error:'invalid'};const parent=path.dirname(cursor);if(parent===cursor)break;cursor=parent;}
  const stat=fs.statSync(target);if(!stat.isFile()||stat.size>LIMIT)return {error:'invalid'};
  const fd=fs.openSync(target,'r');let bytes;try{const buffer=Buffer.alloc(LIMIT+1),n=fs.readSync(fd,buffer,0,buffer.length,0);if(n>LIMIT)return {error:'invalid'};bytes=buffer.subarray(0,n);}finally{fs.closeSync(fd);}
  const raw=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));return raw&&typeof raw==='object'&&!Array.isArray(raw)?{raw}:{error:'invalid'};
}catch(e){return {error:e.code==='ENOENT'?'missing':'invalid'};}}
function read(root,now=Date.now()){const state=path.join(root,'estado'),inputs={};for(const [key,file]of Object.entries(FILES))inputs[key]=input(state,file);return M.compose(inputs,now);}
module.exports={read,FILES,LIMIT};
