'use strict';
const fs=require('node:fs'),path=require('node:path');
const assets=['fluxo-modelo.js','fluxo-ui.js','fluxo-local.js','fluxo.css','obra-pixel.js','obra-pixel.css']; // obra-pixel: faixa de Projetos D (copiada de painel-obra-agentes)
function create({root,now=Date.now}){return {handle(req,url,{send,example=false}){
  const obra=url.pathname==='/api/obra';
  const asset=assets.find(f=>url.pathname==='/'+f);if(!asset&&url.pathname!=='/api/fluxo'&&!obra)return false;
  if(req.method!=='GET'){send(405,{ok:false,error:'Somente leitura'});return true;}
  if(asset){send(200,fs.readFileSync(path.join(__dirname,asset)),asset.endsWith('.css')?'text/css':'text/javascript');return true;}
  if(obra){try{send(200,{ok:true,data:require('./obra-fonte.cjs').read(root,now())});}catch{send(503,{ok:false,error:'Não foi possível ler os projetos'});}return true;}
  if(example){send(409,{ok:false,error:'Fluxo ao vivo indisponível no exemplo'});return true;}
  send(200,{ok:true,data:require('./fluxo-fonte.cjs').read(root,now())});return true;
}};}
module.exports={create,assets};
