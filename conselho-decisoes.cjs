'use strict';
const fs=require('node:fs'),path=require('node:path'),M=require('./conselho-modelo.js'),R=require('./conselho-fonte.cjs'),N=require('./conselho-relogio.cjs');
const CHOICES=new Set(['FAZER','PROVAR','GUARDAR','DESCARTAR']); // o que o painel grava (botoes do selo)
const ROTULO=Object.freeze({FAZER:'fazer agora',PROVAR:'testar primeiro',GUARDAR:'deixar pra depois',DESCARTAR:'não fazer',FAZER_COM_RESSALVAS:'fazer com ressalva',SO_SE:'só se',NAO:'não'});
const LIDOS=new Set(Object.keys(ROTULO));
function seal(row,now){
 if(!row||!LIDOS.has(row.veredito)||!M.time(row.hora)||Date.parse(row.hora)>now||!M.text(R.sanitize(row.id),80)||!M.text(R.sanitize(row.titulo),180))return null;
 const out={id:row.id,titulo:row.titulo,veredito:row.veredito,rotulo:ROTULO[row.veredito],hora:row.hora};
 if(row.t!==undefined){if(!['selo','revisto','importado'].includes(row.t))return null;out.t=row.t;}
 if(row.t==='revisto'){if(!LIDOS.has(row.anterior)||!M.time(row.anterior_hora)||Date.parse(row.hora)<=Date.parse(row.anterior_hora))return null;out.anterior=row.anterior;out.anterior_hora=row.anterior_hora;}
 if(row.parecer_coordenador!==undefined){if(row.parecer_coordenador!==null&&!LIDOS.has(row.parecer_coordenador))return null;out.parecer_coordenador=row.parecer_coordenador;}
 if(row.votos!==undefined){if(!Array.isArray(row.votos)||row.votos.length>30)return null;const seen=new Set();out.votos=[];for(const v of row.votos){const id=M.text(R.sanitize(v?.conselheiro),80);if(!id||seen.has(id)||!['yes','no','depends'].includes(v.voto))return null;seen.add(id);out.votos.push({conselheiro:id,voto:v.voto});}}
 return out;
}
function read(state,now=Date.now()){
 const p=path.join(state,'ideias','vereditos-dono.jsonl'),at=new Date(now).toISOString();
 try{
  const d=fs.lstatSync(path.dirname(p));if(d.isSymbolicLink()||!d.isDirectory())throw Error('invalid directory');
  const st=fs.lstatSync(p);if(!st.isFile()||st.isSymbolicLink()||st.size>8*1024*1024)throw Error();
  const text=fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''),history=[],latest=new Map();let invalid=!!text&&!text.endsWith('\n');
  for(const line of text.split(/\r?\n/).filter(s=>s.trim())){try{
    const r=seal(JSON.parse(line),now);if(!r){invalid=true;continue;}const old=latest.get(r.id);
    if(r.t==='revisto'){if(!old||old.veredito!==r.anterior||old.hora!==r.anterior_hora){invalid=true;continue;}}
    else if(old){invalid=true;continue;}
    history.push(r);latest.set(r.id,r);
  }catch{invalid=true;}}
  return {rows:[...latest.values()],history,valid:!invalid,at,source:'estado/ideias/vereditos-dono.jsonl',fileAt:st.mtime.toISOString()};
 }catch(e){return {rows:[],history:[],valid:e.code==='ENOENT',missing:e.code==='ENOENT',at,source:'estado/ideias/vereditos-dono.jsonl'};}
}
function create({stateRoot,hora=N.horaGetDate,now=Date.now,readCouncil=()=>R.read(stateRoot,now())}){
 let pending=false;
 return {async append(input){
  if(!input||Object.keys(input).some(k=>!['id','veredito','versao','rever','anterior','anterior_hora'].includes(k))||typeof input.id!=='string'||!CHOICES.has(input.veredito)||typeof input.versao!=='string'||(input.rever!==undefined&&input.rever!==true))throw Error('invalid');
  if(pending)throw Error('busy');pending=true;let fd,lock;
  try{
   const dir=path.join(stateRoot,'ideias'),ds=fs.lstatSync(dir);if(!ds.isDirectory()||ds.isSymbolicLink())throw Error('invalid');
   const target=path.join(dir,'vereditos-dono.jsonl');lock=target+'.lock';fd=fs.openSync(lock,'wx');
   const council=readCouncil(),idea=council.ideas.find(i=>i.sourceId===input.id);
   if(!idea||!idea.evidence.valid||idea.evidence.old||idea.version!==input.versao)throw Error('changed');
   const existing=read(stateRoot,now());if(!existing.valid)throw Error('invalid log');
   const old=existing.rows.find(r=>r.id===input.id)||idea.ownerSeal;
   if(old){if(old.veredito===input.veredito)return {ok:true,already:true,record:old};if(!input.rever||input.anterior!==old.veredito||input.anterior_hora!==old.hora)throw Error('already sealed');}
   else if(input.rever)throw Error('not sealed');
   const measured=await hora();if(typeof measured!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{2}:\d{2}$/.test(measured)||!M.time(measured)||Date.parse(measured)>now()||(old&&Date.parse(measured)<=Date.parse(old.hora)))throw Error('time');
   const again=readCouncil().ideas.find(i=>i.sourceId===input.id);
   if(!again||!again.evidence.valid||again.evidence.old||again.version!==input.versao||(again.ownerSeal?.veredito??null)!==(idea.ownerSeal?.veredito??null)||(again.ownerSeal?.hora??null)!==(idea.ownerSeal?.hora??null))throw Error('changed');
   const record={t:old?'revisto':'selo',id:idea.sourceId,titulo:idea.title,veredito:input.veredito,hora:measured,...(old?{anterior:old.veredito,anterior_hora:old.hora}:{}),votos:(idea.votes||[]).map(v=>({conselheiro:v.memberId,voto:v.value})),parecer_coordenador:idea.presidentChoice||null};
   try{const st=fs.lstatSync(target);if(st.isSymbolicLink()||!st.isFile())throw Error('invalid target');}catch(e){if(e.code!=='ENOENT')throw e;}
   const before=fs.existsSync(target)?fs.readFileSync(target):Buffer.alloc(0);if(before.length&&before.at(-1)!==10)throw Error('incomplete log');
   const imported=old&&!existing.rows.some(r=>r.id===input.id)?{t:'importado',id:idea.sourceId,titulo:idea.title,veredito:old.veredito,hora:old.hora}:null;
   const addition=(imported?JSON.stringify(imported)+'\n':'')+JSON.stringify(record)+'\n';
   fs.appendFileSync(target,addition,{encoding:'utf8',flag:'a'});const after=fs.readFileSync(target);
   if(!after.subarray(0,before.length).equals(before)||after.subarray(before.length).toString('utf8')!==addition||!read(stateRoot,now()).valid)throw Error('readback');
   return {ok:true,record};
  }finally{if(fd!==undefined){fs.closeSync(fd);fs.unlinkSync(lock);}pending=false;}
 }};
}
module.exports={read,create,seal,CHOICES,LIDOS,ROTULO};
