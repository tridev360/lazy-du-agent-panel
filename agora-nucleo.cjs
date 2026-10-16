'use strict';
const fs=require('node:fs');
const path=require('node:path');
const LIMIT=128*1024;
const LABELS={noar:'No ar',rodando:'Rodando',travado:'Travado',acelerar:'Acelerar',proximo:'Você',credito:'Crédito'};
const PRIVATE=/PRIVADO|_SECRETS|backup-privado|\b(?:mnemonic|seed phrase|private key|chave privada)\b|0x[a-f\d]{40}|\b[a-f\d]{64}\b|\bsk-[\w-]+|[?&](?:token|key|password)=|:\/\/[^\s/@]+:[^\s/@]+@/i;
const PESSOAS_F2=require('./sigilo-pessoas.cjs');
function text(x,max=240){if(typeof x!=='string')return '';const s=PESSOAS_F2.mascarar(x.replace(/[\r\n\t]+/g,' ').replace(/[\u2013\u2014]/g,',').trim());return PRIVATE.test(s)?'Sem leitura':s.slice(0,max);}
function list(x,keys,max=30){return Array.isArray(x)?x.slice(0,max).filter(v=>v&&typeof v==='object'&&!Array.isArray(v)).map(v=>Object.fromEntries(keys.map(k=>[k,text(v[k],k==='card'?120:240)]))):[];}
function items(x){return Array.isArray(x)?x.slice(0,30).map(v=>text(typeof v==='string'?v:v?.o_que||v?.texto||v?.passo)).filter(Boolean):text(x)?[text(x)]:[];}
function creditPart(v){if(typeof v==='string')return text(v,200);if(!v||typeof v!=='object')return null;const out={};for(const k of ['semana','restante'])if(typeof v[k]==='number'&&Number.isFinite(v[k])&&v[k]>=0&&v[k]<=100)out[k]=v[k];for(const k of ['texto','lidoEm','zeraEm'])if(text(v[k],160))out[k]=text(v[k],160);return Object.keys(out).length?out:null;}
function credit(v){if(typeof v==='string')return text(v,300);if(!v||typeof v!=='object')return null;return {claude:creditPart(v.claude),codex:creditPart(v.codex)};}
function creditText(v){if(typeof v==='string')return v||'Sem leitura';return ['claude','codex'].map(k=>{const a=v?.[k],label=k==='claude'?'Claude':'Codex';if(typeof a==='string')return label+': '+a;if(!a)return label+': sem leitura';return label+': '+(typeof a.semana==='number'?a.semana+'% usado'+(a.lidoEm&&a.texto?' · '+a.texto:''):typeof a.restante==='number'?a.restante+'% restante':a.texto||'sem leitura');}).join(' · ');}
function unknown(reason='Sem leitura'){return {ok:false,source:'estado/estado-agora.json',atualizadoEm:null,ageMinutes:null,stale:true,motivo:reason,noAr:[],rodando:[],travado:[],acelerar:[],voce:[],credito:null};}
function normalCru(raw,now=Date.now()){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return unknown();
 const rowsOk=(v,keys)=>Array.isArray(v)&&v.every(r=>r&&typeof r==='object'&&!Array.isArray(r)&&keys.every(k=>typeof r[k]==='string'));
 const textOk=v=>typeof v==='string'||Array.isArray(v)&&v.every(r=>typeof r==='string'||r&&typeof r==='object'&&(typeof r.o_que==='string'||typeof r.texto==='string'));
 const unavailable=Object.entries({noAr:textOk(raw.noAr),rodando:rowsOk(raw.rodando,['o_que','quando','faixa']),travado:textOk(raw.travado),acelerar:rowsOk(raw.acelerar,['espera','quem_ve','protege']),voce:rowsOk(raw.voce,['passo','onde','card']),credito:typeof raw.credito==='string'||!!raw.credito&&typeof raw.credito==='object'&&!Array.isArray(raw.credito)}).filter(([,ok])=>!ok).map(([k])=>k);
 const at=Date.parse(raw.atualizadoEm||'');if(!Number.isFinite(at)||at>now+120000)return unknown();
 const ageMinutes=Math.max(0,Math.floor((now-at)/60000));
 return {ok:true,unavailable,source:'estado/estado-agora.json',atualizadoEm:new Date(at).toISOString(),ageMinutes,stale:now-at>600000,noAr:unavailable.includes('noAr')?[]:items(raw.noAr),rodando:unavailable.includes('rodando')?[]:list(raw.rodando,['o_que','quando','faixa','lado']).map((row,i)=>{
  const original=raw.rodando[i];if(typeof original.etapa==='string')row.etapa=text(original.etapa);
  const p=original.progresso,M=require('./inicio-missoes-modelo.js'),measured=M.progress(p,now);if(measured&&text(p.fonte)!=='Sem leitura')row.progresso={pct:measured.value,medidoEm:measured.at,fonte:text(p.fonte)};
  return row;
 }),travado:unavailable.includes('travado')?[]:items(raw.travado).filter(v=>!/^\s*(?:nada esperando voc[eê]|nada travado(?: em voc[eê])?|nenhuma trava(?: informada)?|sem travas?|nada)\.?\s*$/i.test(v)),acelerar:unavailable.includes('acelerar')?[]:list(raw.acelerar,['espera','feito','quem_ve','protege']),voce:unavailable.includes('voce')?[]:list(raw.voce,['passo','onde','card','em','quando']),credito:unavailable.includes('credito')?null:credit(raw.credito)};
}
// Cada texto escrito a mao (travado, passos, acelerar, no ar) tem a hora do estado-auto (maoEm, so muda quando o texto muda). Passou de 6 h
// ou sem hora: o campo sai como "sem leitura" com a frase "? ... Solução: ..." (s.semLeitura[campo]); os passos (voce) seguem na lista,
// porque a conta "Espera você" os separa por idade (painel-numeros.cjs).
function seloDaMao(s){
 const F=require('./frescor.cjs'),itens=[];
 for(const k of ['travado','voce','acelerar','noAr']){const m=s.mao&&s.mao[k];if(!m||m.vazio)continue;if(k==='noAr'&&s.noArFonte)continue;itens.push(m);}
 if(!itens.length)return null;
 if(itens.some(m=>m.semHora))return {texto:'textos escritos pela sua IA: sem hora gravada (?). Solução: '+F.SOLUCAO.maoSemHora,velho:true,solucao:F.SOLUCAO.maoSemHora};
 const mais=itens.reduce((a,b)=>b.idadeMin>a.idadeMin?b:a);
 const velho=itens.some(m=>m.velho);return {texto:'textos escritos pela sua IA: o mais antigo escrito '+mais.idadeTexto+(velho?' (passou de 6 h). Solução: '+F.SOLUCAO.mao:''),velho,solucao:F.SOLUCAO.mao};
}
function normal(raw,now=Date.now()){
 const s=normalCru(raw,now);if(!s||!s.ok)return s;
 const F=require('./frescor.cjs'),mao=F.maoDoEstado(raw,now);
 s.mao=mao;s.semLeitura={};
 for(const k of ['travado','acelerar','noAr']){const m=mao[k];if(m.velho&&!s.unavailable.includes(k)){s.unavailable.push(k);s[k]=[];s.semLeitura[k]=F.fraseMaoVelha(m);}}
 // os passos a mao (voce) seguem na lista para a conta "Espera voce", mas a LINHA do WEN e do status-6 usa a mesma regra do Agora: velho ou sem hora = "?" com a solucao, known false
 if(mao.voce.velho)s.semLeitura.voce=F.fraseMaoVelha(mao.voce);
 s.seloMao=seloDaMao(s);
 return s;
}
// "No ar" = o ultimo SUBIU do atendimento.md (a mesma fonte no Agora, no WEN e no status-6); sem SUBIU, o texto escrito pela sua IA com a sua hora (velho = "?")
function comNoArDoSite(s,root,now){
 if(!s||!s.ok)return s;
 try{const up=require('./atendimento-md.cjs').lerCacheado(root,now).ultimoUp;if(up){s.noArMao=s.noAr;s.noAr=['Último up: '+up.texto];s.noArFonte={dataTexto:up.dataTexto,idadeTexto:up.idadeTexto,em:up.em,fonte:up.fonte};s.unavailable=(s.unavailable||[]).filter(k=>k!=='noAr');if(s.semLeitura)delete s.semLeitura.noAr;s.seloMao=seloDaMao(s);}}catch{}
 return s;
}
function comCreditoFresco(s,root,now){
 if(!s||!s.ok)return s;
 try{const fresco=require('./credito-fresco.cjs').paraAgora(root,now);if(fresco){s.credito=fresco.credito;s.creditoFontes=fresco.fontes;s.unavailable=(s.unavailable||[]).filter(k=>k!=='credito');}}catch{}
 return s;
}
function read(root,now=Date.now()){
 try{const base=fs.realpathSync(root),estado=path.join(base,'estado'),file=path.join(estado,'estado-agora.json');for(const p of [estado,file])if(fs.lstatSync(p).isSymbolicLink())return unknown();const st=fs.lstatSync(file);if(!st.isFile()||st.size>LIMIT||fs.realpathSync(file)!==file)return unknown();return comNoArDoSite(comCreditoFresco(normal(JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')),now),root,now),root,now);}catch{return unknown();}
}
const ROW_KEYS={noar:'noAr',rodando:'rodando',travado:'travado',acelerar:'acelerar',proximo:'voce',credito:'credito'};
function lineValues(s){if(!s.ok)return Object.fromEntries(Object.keys(LABELS).map(k=>[k,'Sem leitura']));const values={noar:s.noAr.join('; ')||'Sem leitura',rodando:s.rodando.map(v=>[v.o_que,v.quando,v.faixa].filter(Boolean).join(' · ')).join('; ')||'Nenhuma execução informada',travado:s.travado.join('; ')||'Nenhuma trava informada',acelerar:s.acelerar.map(v=>[v.espera,v.feito].filter(Boolean).join(' · ')).join('; ')||'Sem leitura',proximo:s.voce.map(v=>v.passo).join('; ')||'Nada pedido a você',credito:creditText(s.credito)};for(const [k,field] of Object.entries(ROW_KEYS))if(s.unavailable?.includes(field))values[k]=s.semLeitura?.[field]||'Sem leitura';else if(s.semLeitura?.[field])values[k]=s.semLeitura[field];return values;}
function wen(s){const values=lineValues(s);return {readAt:s.atualizadoEm,readAtBrt:s.atualizadoEm?brt(s.atualizadoEm):null,source:s.source,stale:s.stale,ageMinutes:s.ageMinutes,lines:Object.entries(LABELS).map(([key,label])=>({key,label,text:values[key],known:s.ok&&!s.unavailable?.includes(ROW_KEYS[key])&&!s.semLeitura?.[ROW_KEYS[key]],detail:{sources:key==='credito'&&s.creditoFontes?.length?s.creditoFontes.map(f=>({file:f.file,line:null,note:f.note})):[{file:s.source,line:null,note:!s.ok?'Sem leitura':s.mao&&s.mao[ROW_KEYS[key]]&&!s.mao[ROW_KEYS[key]].vazio&&!(key==='noar'&&s.noArFonte)?s.mao[ROW_KEYS[key]].texto+(s.mao[ROW_KEYS[key]].velho?' (passou de 6 h)':''):key==='noar'&&s.noArFonte?'último up '+(s.noArFonte.dataTexto||'?')+(s.noArFonte.idadeTexto?' ('+s.noArFonte.idadeTexto+')':'')+' (estado/atendimento.md)':'Uma fonte, atualizada '+brt(s.atualizadoEm)}]}}))};}
function brt(at){return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(at));}
function compact(s,max){const v=text(s,2000);return v.length>max?v.slice(0,max-1).trimEnd()+'…':v;}
function hudCredit(s){if(typeof s.credito!=='string')return s.credito||{};const out={};for(const k of ['claude','codex']){const segment=s.credito.split(/\s*[·|]\s*/).find(t=>new RegExp('\\b'+k+'\\b','i').test(t));if(!segment)continue;const m=/(\d{1,3}(?:[.,]\d+)?)%/.exec(segment);const v={texto:compact(segment,70),lidoEm:s.atualizadoEm};if(m){const n=Number(m[1].replace(',','.'));if(n>=0&&n<=100){if(/\brestante|dispon[ií]vel/i.test(segment))v.restante=n;else if(/\bsemana|usad|consumid/i.test(segment))v.semana=n;}}out[k]=v;}return out;}
function hud(s){const v=lineValues(s),d=s.atualizadoEm?new Date(Date.parse(s.atualizadoEm)-3*3600000):null,c=hudCredit(s),cl=c.claude;const used=typeof cl?.semana==='number'?cl.semana:typeof cl?.restante==='number'?100-cl.restante:undefined;return {hora:d?d.toISOString().slice(0,16).replace('T',' '):null,noAr:compact(v.noar,100),rodando:s.unavailable?.includes('rodando')?[{nome:'Sem leitura',quando:'',nota:'',lado:'neutro'}]:s.rodando.slice(0,5).map(x=>({nome:compact(x.o_que,48),quando:compact(x.quando,24),nota:compact(x.faixa,48),lado:['claude','codex','ele'].includes(x.lado)?x.lado:'neutro'})),travado:compact(v.travado,80),acelerar:compact(v.acelerar,80),voce:compact(v.proximo,90),credito:typeof cl==='object'&&cl?{...(used===undefined?{}:{semana:used}),texto:compact(cl.texto||'',70)}:compact(typeof cl==='string'?cl:'Sem leitura',70),creditoCodex:c.codex||null,fonte:s.source,stale:s.stale,ageMinutes:s.ageMinutes};}
function direction(s,cards=[]){if(cards.length)return {text:cards.length+' cards esperam você',target:'cards',button:'Escolher'};if(s.ok&&!s.unavailable?.includes('travado')&&!s.unavailable?.includes('voce')&&s.travado.length&&s.voce.length)return {text:'Travado: '+s.travado[0],target:'travado',button:'Ver meu passo'};if(!s.ok||['rodando','travado','voce'].some(k=>s.unavailable?.includes(k)))return {text:'Uma linha está sem leitura',target:'refresh',button:'Atualizar'};return {text:s.rodando.length?'Tudo rodando. Acompanhe o progresso':'Nenhuma execução informada. Veja o Fluxo',target:'fluxo',button:'Ver Fluxo'};}
module.exports={read,normal,unknown,wen,hud,brt,text,creditText,direction,lineValues,comNoArDoSite,seloDaMao};
