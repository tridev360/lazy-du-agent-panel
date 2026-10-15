'use strict';
const fs=require('node:fs'),path=require('node:path');
const assets=['fluxo-tela-modelo.js','fluxo-tela.js','fluxo-tela.css','r9-dicas.js','r9-dicas.css',...require('./chaves-rotas.cjs').assets];
function create({root,port,soLeitura=false}={}){
 const chaves=root?require('./chaves-rotas.cjs').create({root,port,soLeitura}):null;
 return {async handle(req,url,{send,example=false}={}){
  example=example||url.searchParams.get('exemplo')==='1';
  const p=url.pathname.slice(1);
  if(assets.includes(p)){if(!['GET','HEAD'].includes(req.method)){send(405,{ok:false});return true;}send(200,fs.readFileSync(path.join(__dirname,p)),p.endsWith('.css')?'text/css':'text/javascript');return true;}
  if(url.pathname==='/api/pe-equipe/frentes-situacao'){if(req.method!=='GET'){send(405,{ok:false});return true;}send(200,example?{ok:false,frentes:[],motivo:'Modo exemplo sem fonte real',solucao:'Use a demonstração local.'}:require('./frentes-situacao-rota.cjs').ler({estado:root}));return true;}
  if(url.pathname.startsWith('/api/chaves')){if(chaves)return chaves.handle(req,url,{send,example});send(200,{ok:false,erro:'ausente',solucao:'Escolha sua pasta de estado com o Claude.'});return true;}
  return false;
 }};
}
module.exports={create,assets};
