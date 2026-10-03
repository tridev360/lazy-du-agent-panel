'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const rules=require('../../public/acelerador.js');
function createAcceleration({folder,persist=true,prefix='/api/acelerador',clock=()=>new Date().toISOString()}={}){
  const token=crypto.randomBytes(24).toString('hex');let queue=Promise.resolve(),memory={versao:1,modo:'publico',fases:{},ganhos:{},medido:null,marcas:[],marcha:null};const file=path.join(folder,'acceleration.json');
  function read(){if(!persist)return structuredClone(memory);let state={versao:1,modo:'publico',fases:{},ganhos:{},medido:null,marcas:[],marcha:null};try{const saved=JSON.parse(fs.readFileSync(file,'utf8'));for(let n=1;n<=rules.TOTAL;n++){if(!saved.fases?.[n]?.em)break;state.fases[n]={em:saved.fases[n].em};}if(rules.marchaValida(saved.marcha?.n))state.marcha={n:saved.marcha.n,em:saved.marcha.em};state.marcas=(saved.marcas||[]).filter(x=>typeof x.id==='string'&&rules.SOMAS.includes(x.minutos)&&typeof x.em==='string').slice(-500);}catch(e){if(e.code!=='ENOENT')throw Error('Could not read saved phases');}return state;}
  function view(state){return {...state,ok:true,token,total:rules.TOTAL,minutos:rules.minutosDe(state)};}
  function send(res,code,body){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));}
  function save(state){if(!persist){memory=structuredClone(state);return;}fs.mkdirSync(folder,{recursive:true});const temp=file+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';fs.writeFileSync(temp,JSON.stringify(state,null,2)+'\n',{flag:'wx'});try{fs.renameSync(temp,file);}finally{try{fs.unlinkSync(temp);}catch{}}}
  async function change(req,res,url){try{let body='';for await(const part of req){body+=part;if(Buffer.byteLength(body)>1024){send(res,413,{ok:false,erro:'grande'});return;}}const data=JSON.parse(body),state=read(),now=clock(),count=Object.keys(state.fases).length;
    if(url.pathname.endsWith('/marcha')){if(!rules.marchaValida(data.marcha))return send(res,400,{ok:false,erro:'invalido'});state.marcha={n:data.marcha,em:now};}
    else if(url.pathname.endsWith('/ligar')){if(!Number.isInteger(data.fase)||data.fase!==count+1||data.fase>rules.TOTAL)return send(res,409,{ok:false,erro:'fora-de-ordem'});state.fases[data.fase]={em:now};}
    else if(url.pathname.endsWith('/minutos')){if(!count||!rules.SOMAS.includes(data.minutos))return send(res,400,{ok:false,erro:'invalido'});state.marcas.push({id:crypto.randomBytes(4).toString('hex'),minutos:data.minutos,em:now});}
    else if(url.pathname.endsWith('/desfazer')){if(data.marca){if(state.marcas.at(-1)?.id!==data.marca)return send(res,409,{ok:false,erro:'nao-desfaz'});state.marcas.pop();}else{if(data.fase!==count||!count)return send(res,409,{ok:false,erro:'nao-desfaz'});delete state.fases[count];}}
    else return send(res,404,{ok:false,erro:'invalido'});save(state);send(res,200,view(state));
  }catch{send(res,400,{ok:false,erro:'invalido'});}}
  function handle(req,res,url){if(url.pathname!==prefix&&!url.pathname.startsWith(prefix+'/'))return false;if(req.method==='GET'&&url.pathname===prefix){try{send(res,200,view(read()));}catch{send(res,503,{ok:false,erro:'ilegivel'});}return true;}const origin=req.headers.origin,host=req.headers.host;if(req.method!=='POST')send(res,405,{ok:false,erro:'invalido'});else if(origin!=='http://'+host||req.headers['x-acelerador-token']!==token||String(req.headers['content-type']).split(';')[0]!=='application/json'||(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin'))send(res,403,{ok:false,erro:'origem'});else queue=queue.then(()=>change(req,res,url),()=>change(req,res,url));return true;}
  return {handle};
}
module.exports={createAcceleration};
