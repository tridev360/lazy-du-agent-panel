'use strict';
(function(root){
 const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const instant=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&day(v.slice(0,10))&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
 const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v?v:null;
 const today=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
 function event(raw,parentDay){
  const at=instant(raw?.feitoEm||raw?.at||raw?.quando||raw?.hora),date=day(raw?.data||raw?.dia)||day(parentDay)||(at?today(Date.parse(at)):null);
  const hour=/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(raw?.hora||'')?raw.hora:null;
  return {day:date,at:at||(date&&hour?date+'T'+hour+':00-03:00':null),reason:date?null:'data não registrada'};
 }
 const doneText=value=>/\b(?:feito|concluid[oa]|aplicad[oa]|entregue|publicad[oa]|no ar)\b/.test(norm(value));
 function receipts(agora,cron){
  const rows=[];
  for(const r of Array.isArray(agora?.recibos)?agora.recibos:[])if(r&&doneText(r.estado))rows.push({id:r.id||r.taskId,title:r.o_que||r.titulo,at:instant(r.at||r.hora)||instant(agora.atualizadoEm),source:'estado/estado-agora.json'});
  for(const r of Array.isArray(agora?.rodando)?agora.rodando:[]){const text=[r.o_que,r.quando,r.faixa].join(' ');if(doneText(text)||/\bgate\b/.test(norm(r.o_que))&&/\bverde\b/.test(norm(text)))rows.push({id:r.id||r.taskId,title:r.o_que,text,at:instant(agora.atualizadoEm),source:'estado/estado-agora.json'});}
  for(const r of Array.isArray(agora?.noAr)?agora.noAr:[])rows.push({id:r?.id||r?.taskId,title:typeof r==='string'?r:r?.o_que||r?.titulo,at:instant(agora.atualizadoEm),source:'estado/estado-agora.json'});
  for(const group of [...(cron?.semana||[]),...(cron?.geral||[])])for(const r of group?.itens||[])if(r.estado==='feito'){const e=event(r,group.dia);rows.push({id:r.id||r.taskId,title:r.o_que,at:e.at,source:'estado/cronograma.json'});}
  return rows.filter(r=>r.title&&r.at);
 }
 function receiptFor(task,rows,after,now){
  const title=norm(task.title||task.o_que),id=task.id||task.taskId;if(!title)return null;
  const cutoff=after?Date.parse(after):-Infinity;
  return rows.filter(r=>Date.parse(r.at)>cutoff&&Date.parse(r.at)<=now&&(id&&r.id===id||norm(r.title)===title||r.text&&title.length>=8&&(' '+norm(r.text)+' ').includes(' '+title+' '))).sort((a,b)=>b.at.localeCompare(a.at))[0]||null;
 }
 function schedule(data,agora,now=Date.now()){
  const completed=receipts(agora,data),date=today(now),update=instant(data.atualizadoEm||data.atualizado);
  const eligible=completed.filter(c=>c.source==='estado/cronograma.json'||update&&Date.parse(c.at)>Date.parse(update));
  const mark=(r,parentDay)=>{const e=event(r,parentDay),receipt=receiptFor(r,eligible,e.at,now),futureDone=r.estado==='feito'&&e.at&&Date.parse(e.at)>now;return {...r,data:e.day,at:e.at,recordedState:r.estado,estado:receipt?'feito':futureDone?null:r.estado,receipt:receipt||null,dateReason:e.reason,statusReason:futureDone?'conclusão futura na fonte':null,historical:!receipt&&r.estado!=='feito'&&(!update||Date.parse(update)>now||now-Date.parse(update)>600000)};};
  const all=(data.hoje||[]).map(r=>mark(r,data.dia));
  return {...data,hoje:all.filter(r=>r.data===date),historico:all.filter(r=>r.data&&r.data!==date),semData:all.filter(r=>!r.data),semana:(data.semana||[]).map(g=>({...g,itens:(g.itens||[]).map(r=>mark(r,g.dia))})),geral:(data.geral||[]).map(g=>({...g,itens:(g.itens||[]).map(r=>mark(r))}))};
 }
 function source(at,now=Date.now(),ttl=600000){const stamp=instant(at),age=stamp&&Date.parse(stamp)<=now?Math.floor((now-Date.parse(stamp))/60000):null;return {at:stamp,age,old:age!==null&&now-Date.parse(stamp)>ttl,reason:!stamp?'hora não registrada':Date.parse(stamp)>now?'hora futura':null};}
 function identity(value){const key=String(value?.eventoId||value?.eventId||value?.identidade||'').trim();if(key)return 'id:'+key;const title=norm(value?.title||value?.titulo);return /^nasce o agente idealista(?: |$)/.test(title)?'event:nascimento-agente-idealista':title?'title:'+title:null;}
 function progress(items,queue=[],week=null){
  const counted=x=>!['cancelado','superado'].includes(x.status),closed=x=>['feito','noar'].includes(x.status)||x.phase?.key==='feito';
  const all=(items||[]).filter(counted),current=all.filter(x=>!closed(x)||week&&(x.closedDay||(x.source==='task'?x.deadlineDay:null))>=week.start&&(x.closedDay||(x.source==='task'?x.deadlineDay:null))<=week.end),done=current.filter(closed).length;
  return {total:current.length,known:current.length,done,open:current.length-done,percent:current.length?Math.round(done/current.length*1000)/10:null,excluded:queue.filter(x=>!counted(x)).length,scope:'abertos-e-fechados-na-semana',week,criterion:'completed-items'};
 }
 const api={progress,norm,instant,day,today,event,receipts,receiptFor,schedule,source,identity};if(typeof module==='object'&&module.exports)module.exports=api;else root.PainelDadosAuditados=api;
})(typeof globalThis==='object'?globalThis:this);
