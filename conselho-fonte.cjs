'use strict';
const fs=require('node:fs'),path=require('node:path'),M=require('./conselho-modelo.js');
function sanitize(value){if(typeof value!=='string')return null;if(/PRIVADO|_SECRETS|backup-privado|privado-a|privado-b|repo-privado|\.env\b|\b(?:seed|mnemonic|secret|password|senha|api.?key|chave)\b|\b(?:access|auth|bearer|api)[ _-]?token\b|token\s*[:=]\s*\S+|\bsk-[\w-]+|[?&](?:token|key)=/i.test(value))return null;return value;}
function file(root,name,now){const meta={source:'estado/ideias/'+name,readAt:new Date(now).toISOString()};try{const dir=path.join(root,'ideias'),ds=fs.lstatSync(dir);if(!ds.isDirectory()||ds.isSymbolicLink())throw Error('invalid');const p=path.join(dir,name),st=fs.lstatSync(p);if(!st.isFile()||st.isSymbolicLink()||st.size>1024*1024)throw Error('invalid');const raw=JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));if(!raw||Array.isArray(raw)||typeof raw!=='object')throw Error('invalid');return {raw,meta:{...meta,fileAt:st.mtime.toISOString()}};}catch(e){return {raw:null,meta:{...meta,missing:e.code==='ENOENT',invalid:e.code!=='ENOENT'}};}}
function role(c){const name=String(c.papel??c.nome??c.id??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return /vision/.test(name)?'vision':/cetic/.test(name)?'skeptic':/operador/.test(name)?'operations':/advogad/.test(name)?'law':/cliente/.test(name)?'customer':c.papel??c.nome;}
function originalIdea(value){if(Array.isArray(value))return value.map(originalIdea);if(!value||typeof value!=='object')return value;const added=new Set(['fala_simples','decisao_presidente_simples','criterio_simples','frase_assinatura_simples']);return Object.fromEntries(Object.entries(value).filter(([key])=>!added.has(key)).map(([key,item])=>[key,originalIdea(item)]));}
function readProposals(summaries,council,now){
  const output=Object.create(null),seen=new Set(),duplicates=new Set();
  const raw=summaries.raw,at=M.time(raw?.atualizadoEm??summaries.meta.fileAt);
  if(!raw||raw.version!==1||!Array.isArray(raw.propostas)||raw.propostas.length>150||!at||Date.parse(at)>now)return output;
  for(const r of raw.propostas){
    if(!r||typeof r.id!=='string'||r.id.length>80)continue;
    if(seen.has(r.id))duplicates.add(r.id);seen.add(r.id);
    const original=(Array.isArray(council.raw?.ideias)?council.raw.ideias:[]).find(i=>i?.id===r.id);
    if(original&&r.fonte_sha256===require('node:crypto').createHash('sha256').update(JSON.stringify(originalIdea(original))).digest('hex'))output[r.id]=r;
  }
  for(const id of duplicates)delete output[id];return output;
}
function read(root,now=Date.now()){const council=file(root,'conselho.json',now),comments=file(root,'comentarios.json',now),summaries=file(root,'propostas-simples.json',now);const propostas=readProposals(summaries,council,now);const data=M.normalize(council.raw,comments.raw,{council:council.meta,comments:comments.meta,now,sanitize,role,propostas,proposalSource:summaries,servedAt:new Date(now).toISOString()});const seals=require('./conselho-vereditos.cjs').read(root,now);for(const idea of data.ideas){idea.ownerSeal=seals.rows.find(r=>r.id===idea.sourceId)||idea.ownerSeal;idea.version=require('node:crypto').createHash('sha256').update(JSON.stringify([idea.sourceId,idea.title,idea.front,idea.tally,idea.verdict,idea.presidentChoice,idea.presidentLiteral||idea.president,idea.position,idea.score,idea.speeches.map(({memberId,line,literal,at,tone})=>({memberId,line:literal||line,at,tone})),idea.votes,data.councilEvidence.at])).digest('hex').slice(0,20);}data.ownerVerdicts=seals.valid?seals.rows:[];data.decisionHistory=seals.valid?seals.history:[];data.ranking=require('./conselho-ranking.js').calculate(data,seals,now);data.ownerEvidence=seals;data.ownerEvidence.rows=undefined;data.ownerEvidence.history=undefined;data.waiting=seals.valid&&data.councilEvidence.valid?data.ideas.filter(i=>!i.ownerSeal).length:null;return data;}
module.exports={read,file,sanitize,role,readProposals};
