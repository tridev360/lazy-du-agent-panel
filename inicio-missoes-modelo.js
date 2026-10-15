'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PainelInicioMissoesModel=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 const text=v=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,' ').replace(/[\u2013\u2014]/g,',').trim().slice(0,500):null;
 function stamp(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(v))return null;const [y,m,d]=v.slice(0,10).split('-').map(Number),h=Number(v.slice(11,13)),min=Number(v.slice(14,16));if(m<1||m>12||d<1||d>new Date(Date.UTC(y,m,0)).getUTCDate()||h>23||min>59)return null;const n=Date.parse(v);return Number.isFinite(n)?n:null;}
 const pct=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100?v:null;
 function progress(v,now=Date.now()){const value=pct(v?.pct),at=stamp(v?.medidoEm),source=text(v?.fonte);return value!==null&&at!==null&&at<=now&&source?{value,at:new Date(at).toISOString(),source}:null;}
 function missions(agora,now=Date.now()){
  const at=stamp(agora?.atualizadoEm),known=agora?.ok===true&&!agora.unavailable?.includes('rodando')&&Array.isArray(agora.rodando),source=text(agora?.source)||'estado/estado-agora.json';
  return {known,source,at:at===null?null:new Date(at).toISOString(),old:at===null||at>now||now-at>600000,ownerRequests:agora?.ok===true&&!agora.unavailable?.includes('voce')&&Array.isArray(agora.voce)?agora.voce.filter(v=>text(v?.passo)).length:null,rows:known?agora.rodando.filter(v=>text(v?.o_que)).slice(0,30).map((v,i)=>({id:'M'+String(i+1).padStart(2,'0'),title:text(v.o_que),stage:text(v.etapa),who:text(v.lado),when:text(v.quando),range:text(v.faixa),progress:progress(v.progresso,now)})):[]};
 }
 function energy(row,now=Date.now()){const used=pct(row?.semana),at=stamp(row?.lidoEm),reset=stamp(row?.zeraSemana),expired=row?.expirada===true||reset!==null&&reset<=now,known=used!==null&&at!==null&&at<=now&&!expired;return {used:known?used:null,remaining:known?Math.round((100-used)*100)/100:null,at:at===null?null:new Date(at).toISOString(),reset:reset===null?null:new Date(reset).toISOString(),expired,old:at===null||at>now||now-at>3600000};}
 function alertLink(where){
  if(/^github$/i.test(where||''))return 'https://github.com/';
  if(!/^https?:\/\//i.test(where||''))return null;
  try{const url=new URL(where);return !url.username&&!url.password?url.href:null;}catch{return null;}
 }
 function alerts(agora,now=Date.now()){
  const view=missions(agora,now),known=agora?.ok===true&&!agora.unavailable?.includes('voce')&&Array.isArray(agora.voce);
  return {known,source:view.source,at:view.at,old:view.old,rows:known?agora.voce.filter(v=>text(v?.passo)).map((v,i)=>({number:i+1,step:text(v.passo),where:text(v.onde),card:text(v.card),href:alertLink(text(v.onde))})):[]};
 }
 return {text,stamp,pct,progress,missions,energy,alerts,alertLink};
});
