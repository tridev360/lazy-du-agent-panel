'use strict';
const fs=require('node:fs'),path=require('node:path');
function create({root,port,nonce,hora,now}){let service;return {async handle(req,url,{send,example=false}){
 const assets={'/dados-solucao-config.js':'text/javascript','/dados-solucao.js':'text/javascript','/dados-solucao.css':'text/css'};
 if(req.method==='GET'&&assets[url.pathname]){send(200,fs.readFileSync(path.join(__dirname,url.pathname.slice(1))),assets[url.pathname]);return true;}
 if(!['/api/dados-solucao','/api/dados-solucao/registrar','/api/dados-solucao/preencher'].includes(url.pathname))return false;
 if(example){send(200,{ok:true,example:true,count:0,items:[],nonce:null,nextRead:null});return true;}
 service ||= require('./dados-solucao-nucleo.cjs').create({root,...(hora?{hora}:{}),...(now?{now}:{})});
 if(req.method==='GET'&&url.pathname==='/api/dados-solucao'){try{send(200,{...await service.status(),nonce});}catch{send(503,{ok:false,error:'reading_unavailable'});}return true;}
 if(req.method!=='POST'){send(405,{ok:false,error:'method_not_allowed'});return true;}
 if(!['127.0.0.1','::ffff:127.0.0.1','::1'].includes(req.socket?.remoteAddress)||!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin)||req.headers['x-painel-nonce']!==nonce||req.headers['content-type']!=='application/json'){send(403,{ok:false,error:'local_only'});return true;}
 try{let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>256*1024){send(413,{ok:false,error:'too_large'});return true;}chunks.push(chunk);}const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(url.pathname.endsWith('/registrar')){if(!input||Object.keys(input).some(k=>k!=='items'))throw Error();send(200,await service.register(input.items));}else if(url.pathname.endsWith('/preencher'))send(200,await service.fill(input));else send(405,{ok:false,error:'method_not_allowed'});}catch{send(409,{ok:false,error:'not_saved'});}return true;
 }};}
module.exports={create};
