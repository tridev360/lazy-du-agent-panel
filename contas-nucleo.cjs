'use strict';
const fs=require('node:fs'),path=require('node:path');
const SOLUCAO='Sem leitura de consumo. Registre as suas contas no estado do painel e atualize a tela.';
const contaValida=v=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=80&&!/[\r\n\x00-\x1f<>]/.test(v);
function ler(root,nome,max=512000){
 let fd;try{if(!['credito-claude.jsonl','coordenacao.md'].includes(nome))return null;const file=path.resolve(root,'estado',nome);for(let cursor=file;cursor;cursor=path.dirname(cursor)){if(fs.lstatSync(cursor).isSymbolicLink())return null;if(path.dirname(cursor)===cursor)break;}if(fs.realpathSync(file)!==file)return null;const s=fs.lstatSync(file);if(!s.isFile()||s.size>max)return null;fd=fs.openSync(file,'r');const opened=fs.fstatSync(fd);if(!opened.isFile()||opened.dev!==s.dev||opened.ino!==s.ino||opened.size>max)return null;const bytes=Buffer.alloc(max+1);let total=0,n;while(total<bytes.length&&(n=fs.readSync(fd,bytes,total,bytes.length-total,null)))total+=n;if(total>max||fs.realpathSync(file)!==file)return null;return {texto:bytes.subarray(0,total).toString('utf8'),mtime:opened.mtimeMs};}catch{return null;}finally{if(fd!==undefined)fs.closeSync(fd);}
}
function iso(v){return typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(v)&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;}
function montar(texto,now=new Date()){
 const at=now.getTime(),latest=new Map();
 for(const line of String(texto||'').split(/\r?\n/)){try{const r=JSON.parse(line),hora=iso(r.hora);if(!contaValida(r.conta)||!hora||Date.parse(hora)>at+60000)continue;const old=latest.get(r.conta);if(!old||Date.parse(hora)>=Date.parse(old.hora))latest.set(r.conta,{conta:r.conta,hora,semana:typeof r.semana==='number'&&Number.isFinite(r.semana)&&r.semana>=0&&r.semana<=100?r.semana:null,zeraSemana:iso(r.zeraSemana)});}catch{}}
 const ordered=[...latest.values()].sort((a,b)=>Date.parse(b.hora)-Date.parse(a.hora));
 const atual=ordered[0]?.conta||null;
 const nomes=latest.size?[...latest.keys()]:['Sua conta'];
 const contas=nomes.map(conta=>{const r=latest.get(conta),expirada=!!r?.zeraSemana&&Date.parse(r.zeraSemana)<=at;return {conta,atual:conta===atual,semana:expirada?null:r?.semana??null,lidoEm:r?.hora||null,idadeHoras:r?Math.max(0,Math.floor((at-Date.parse(r.hora))/3600000)):null,zeraSemana:r?.zeraSemana||null,expirada};});
 const corrente=contas.find(c=>c.atual),outras=contas.filter(c=>!c.atual);
 const resetOrder=(a,b)=>(Date.parse(a.zeraSemana)||Infinity)-(Date.parse(b.zeraSemana)||Infinity)||a.conta.localeCompare(b.conta);
 const disponiveis=outras.filter(c=>c.semana!==null&&c.semana<95).sort(resetOrder);
 const resets=outras.filter(c=>c.zeraSemana&&Date.parse(c.zeraSemana)>at).sort(resetOrder);
 const trocar=corrente?.semana!==null&&corrente?.semana>=95;
 const proxima=trocar?disponiveis[0]||resets[0]:resets[0]||disponiveis[0];
 return {contas,atual,solucao:SOLUCAO,recomendacao:proxima?{conta:proxima.conta,agora:!!trocar&&proxima.semana!==null&&proxima.semana<95,aposReset:proxima.semana===null||proxima.semana>=95,zeraSemana:proxima.zeraSemana}:null,observadoEm:now.toISOString()};
}
function blocoOperador(texto){const m=String(texto||'').match(/^##\s+PARA O OPERADOR[^\r\n]*\r?\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/mi);return m?.[1]||'';}
const READY=/^(?:[-*]\s*)?(?:PRONTO:\s*)?pront[oa] para trocar(?:\s+(?:para\s+)?(?:a\s+)?(?:conta\s+)?([^\r\n.!]{1,80}))?[.!]?\s*$/i;
function sinais(texto){return blocoOperador(texto).split(/\r?\n/).map(x=>x.trim()).filter(x=>READY.test(x));}
function pronto(source,pedido){if(!source||!pedido||source.mtime<pedido.atMs)return false;return sinais(source.texto).some(line=>{if(pedido.antes.includes(line))return false;const target=line.match(READY)?.[1];return !target||target===pedido.conta;});}
module.exports={contaValida,SOLUCAO,ler,montar,blocoOperador,sinais,pronto};
