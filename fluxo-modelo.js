'use strict';
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.PainelFluxoModel=api;})(typeof globalThis!=='undefined'?globalThis:this,(root)=>{
  const OWNERS=['claude','codex','vps','dono'],GROUPS=['rodando','sequencia','esperando','depois','feitos'];
  function text(v,max=700){if(typeof v!=='string')return null;return v.replace(/[\u0000-\u001f]/g,' ').replace(/[\u2013\u2014]/g,',').replace(/https?:\/\/\S+|0x[a-f\d]{40,}|\b[A-Za-z\d]{40,}\b|\b[^\s@]+@[^\s@]+\.[^\s@]+\b/gi,'[privado]').trim().slice(0,max)||null;}
  const id=v=>typeof v==='string'&&/^[a-z\d_-]{1,64}$/i.test(v)?v:null;
  function time(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(v))return null;const [y,m,d]=v.slice(0,10).split('-').map(Number);if(m<1||m>12||d<1||d>new Date(Date.UTC(y,m,0)).getUTCDate())return null;const n=Date.parse(v);return Number.isFinite(n)?n:null;}
  function owner(v){if(typeof v!=='string')return null;const aliases={claude:'claude',codex:'codex',vps:'vps',ele:'dono',dono:'dono',dono:'dono',projb:'dono'},key=v.trim().toLowerCase();return Object.hasOwn(aliases,key)?aliases[key]:null;}
  function proof(raw,source,now,error){const n=time(raw?.atualizadoEm||raw?.atualizado);return {source,state:error||(n===null?'undated':n>now?'future':now-n>600000?'old':'current'),updated:n===null?null:new Date(n).toISOString(),ageSeconds:n===null?null:Math.max(0,Math.floor((now-n)/1000)),origin:text(raw?.fonte,250)};}
  function compose(inputs,now=Date.now()){
    const get=key=>inputs[key]?.raw||null,queue=get('fila'),agora=get('agora'),cron=get('cronograma'),proofs={};
    for(const [k,f]of Object.entries({fila:'fila.json',agora:'estado-agora.json',cronograma:'cronograma.json'}))proofs[k]=proof(get(k),'estado/'+f,now,inputs[k]?.error);
    const tasks=[],groups={},warnings=[],A=typeof module==='object'&&module.exports?require('./dados-auditados.js'):root.PainelDadosAuditados,receipts=A.receipts(agora,cron);
    for(const group of GROUPS){const rows=queue?.[group];groups[group]=Array.isArray(rows)?'read':'unknown';if(!Array.isArray(rows))continue;if(rows.length>200){warnings.push(group+': limite de leitura');groups[group]='partial';}
      rows.slice(0,200).forEach((r,i)=>{if(!r||typeof r!=='object'||Array.isArray(r)){groups[group]='partial';warnings.push(group+': registro inválido');return;}const title=text(r.o_que||r.titulo,200);if(!title){groups[group]='partial';warnings.push(group+': título ausente');return;}
        const who=text(r.dono||r.lado||r.quem,100),after=Array.isArray(r.depoisDe)?r.depoisDe:[r.depoisDe];
        tasks.push({key:group+':'+i,id:id(r.id),title,detail:text(r.detalhe),owner:owner(who),who,group,automatic:typeof r.automatico==='boolean'?r.automatico:null,after:[...new Set(after.map(id).filter(Boolean))],source:'estado/fila.json',origin:text(r.origem||r.fonte,250)||proofs.fila.origin,when:text(r.quando,150),why:text(r.porque,250)});
      });
    }
    for(const work of tasks){const receipt=A.receiptFor(work,receipts,proofs.fila.updated,now);work.recordedGroup=work.group;work.receipt=receipt;if(receipt)work.group='feitos';work.executionConfirmed=work.group==='rodando'&&proofs.fila.state==='current';}
    const unique=new Map();for(const work of tasks)if(work.id)unique.set(work.id,unique.has(work.id)?null:work);
    for(const work of tasks)work.key=unique.get(work.id)===work?'id:'+work.id:work.key+':'+work.title;
    const passages=[];for(const work of tasks)for(const after of work.after){const previous=unique.get(after);if(previous&&unique.get(work.id)===work&&previous!==work)passages.push({from:previous.key,to:work.key,after});else warnings.push('Vínculo sem par único: '+after+' → '+(work.id||work.key));}
    const stations=OWNERS.map(o=>({owner:o,tasks:tasks.filter(t=>t.owner===o&&t.group!=='feitos'),running:tasks.some(t=>t.owner===o&&t.executionConfirmed),known:proofs.fila.state!=='missing'&&proofs.fila.state!=='invalid'&&['rodando','sequencia','esperando','depois'].every(g=>groups[g]==='read')}));
    const noAr=text(agora?.noAr,1000)|| (Array.isArray(agora?.noAr)?agora.noAr.map(r=>text(typeof r==='string'?r:r?.o_que)).filter(Boolean).join(' · '):null);
    const running=Array.isArray(agora?.rodando)?agora.rodando.slice(0,30).map(r=>({title:text(r?.o_que,200),when:text(r?.quando,100),range:text(r?.faixa,150),who:text(r?.lado||r?.quem,100)})).filter(r=>r.title):[];
    const a=agora?.agentes,measured=time(a?.medidoEm),agents=a&&Number.isSafeInteger(a.ativos)&&a.ativos>=0&&text(a.fonte)&&measured!==null&&measured<=now&&now-measured<=600000&&!['future','missing','invalid'].includes(proofs.agora.state)?{value:a.ativos,at:new Date(measured).toISOString(),source:text(a.fonte,250)}:{value:null,at:null,source:null};
    const events=Array.isArray(cron?.hoje)?cron.hoje.slice(0,200).map(r=>({title:text(r?.o_que,200),when:text(r?.hora,80),at:A.event(r,cron.dia).at,day:A.event(r,cron.dia).day,who:text(r?.quem,100),state:text(r?.estado,100)})).filter(r=>r.title&&r.at&&time(r.at)<=now):[];
    return {proofs,tasks,groups,stations,passages,warnings,unassigned:tasks.filter(t=>!t.owner&&t.group!=='feitos'),done:tasks.filter(t=>t.group==='feitos'),context:{noAr,running,agents},events,estimated:cron?.estimado===true};
  }
  // Only the fields already projected by the panel reader enter the infographic.
  const meta=v=>typeof v==='string'&&!/PRIVADO|_SECRETS|backup-privado|\b(?:seed|mnemonic|senha|password|private.?key|api.?key)\b|\.env\b|[a-z]:[\\/]|https?:|\bsk-[\w-]+/i.test(v)?text(v,180):null;
  const actorId=v=>typeof v==='string'&&/^[a-z\d_:./-]{1,140}$/i.test(v)?v:null;
  function activity(snapshot,flow,now=Date.now()){
    const proof=snapshot?.metadataProof||snapshot?.proof,observed=time(proof?.observedAt||snapshot?.updated),rows=snapshot?.equipe?.agents;
    const known=Array.isArray(rows)&&observed!==null&&observed<=now,old=!known||now-observed>60000,duplicates=new Set(),map=new Map();let partial=rows?.length>200;
    const isWorking=r=>{const w=r?.workProof,e=time(w?.eventLastAt||r?.lastAt||w?.startedAt),o=time(w?.observedAt);return w?.state==='working'&&['claude.lifecycle','codex.lifecycle'].includes(w.source)&&!w.closedAt&&e!==null&&e<=now&&now-e<=300000&&o!==null&&o<=now&&now-o<=60000;};
    for(const r of known?[...rows].sort((a,b)=>Number(isWorking(b))-Number(isWorking(a))).slice(0,200):[]){const key=actorId(r?.id);if(!key||!['claude','codex'].includes(r.family)){partial=true;continue;}if(map.has(key)){duplicates.add(key);partial=true;}map.set(key,r);}
    for(const key of duplicates)map.delete(key);
    const nodes=[];for(const [key,r]of map){
      const parent=actorId(r.parentId),seen=new Set([key]);let p=parent,linked=!!parent;
      while(p){if(seen.has(p)||!map.has(p)||map.get(p).family!==r.family||seen.size>20){linked=false;partial=true;break;}seen.add(p);p=actorId(map.get(p).parentId);}
      const work=r.workProof,at=time(work?.observedAt),begun=time(work?.startedAt),ended=time(work?.closedAt),lifecycle=['claude.lifecycle','codex.lifecycle'].includes(work?.source)&&begun!==null&&at!==null&&begun<=at&&(ended===null||ended>=begun&&ended<=at),eventAt=time(work?.eventLastAt||r.lastAt||work?.startedAt),fresh=!old&&lifecycle&&at<=now&&now-at<=60000&&(work.state==='done'||eventAt!==null&&eventAt<=now&&now-eventAt<=300000),reserved=r.reserved===true||r.reservado===true;
      const consistent=work?.state==='working'?ended===null:work?.state==='done'?ended!==null:true;
      const state=fresh&&consistent&&!reserved&&['working','waiting','done'].includes(work.state)?work.state:'unknown';
      const stamp=v=>{const n=time(v);return n!==null&&n<=now?new Date(n).toISOString():null;};
      nodes.push({id:key,parentId:linked?parent:null,parentUnknown:!!r.parentId&&!linked,family:r.family,name:reserved?'frente reservada':meta(r.presentation?.label||r.conversationName||r.conversation||r.name)||r.family,model:reserved?null:meta(r.model),effort:reserved?null:meta(r.effort),state,reserved,at:stamp(r.lastAt),observedAt:at===null?null:new Date(at).toISOString(),source:meta(r.source)||'metadados da Equipe',startedAt:reserved||!lifecycle||at>now?null:stamp(work?.startedAt),closedAt:reserved||!lifecycle||at>now?null:stamp(work?.closedAt),tools:reserved?[]:(Array.isArray(r.tools)?r.tools:[]).slice(0,20).map(t=>({name:meta(t?.name),count:Number.isSafeInteger(t?.count)&&t.count>=0?t.count:null})).filter(t=>t.name)});
    }
    const exact=known&&!old&&!partial&&proof?.complete===true&&snapshot.readerStatus==='ready'&&snapshot.equipe.countsExact===true&&nodes.every(n=>n.state!=='unknown'),working=nodes.filter(n=>n.state==='working').length;
    const count=exact&&snapshot.equipe.active===working?working:null;
    const counts=Object.fromEntries(['claude','codex'].map(f=>[f,exact&&count!==null?nodes.filter(n=>n.family===f&&n.state==='working').length:null]));
    const events=[],links=[],flowAt=time(flow?.readAt),flowKnown=flow?.ok===true&&Array.isArray(flow.nodes)&&Array.isArray(flow.edges)&&flowAt!==null&&flowAt<=now,flowOld=!flowKnown||now-flowAt>60000;
    const flowNodes=new Map((Array.isArray(flow?.nodes)?flow.nodes:[]).slice(0,300).map(n=>[actorId(n?.id),n]));
    const name=key=>{if(key==='voce')return 'Dono';const node=flowNodes.get(key),known=nodes.find(n=>n.id===key)?.name||meta(node?.name||node?.presentation?.label);if(known)return known;const parent=nodes.find(n=>n.id===node?.parentId);return parent&&key.startsWith('ajudantes:')?parent.name+' · ajudantes':key.split(':')[0];};
    for(const edge of flowKnown&&Array.isArray(flow.edges)?flow.edges.slice(0,200):[]){const from=actorId(edge?.from),to=actorId(edge?.to);if(!from||!to||from===to||!flowNodes.has(from)||!flowNodes.has(to))continue;
      const last=time(edge.lastAt),n=Number.isSafeInteger(edge.count)&&edge.count>0?edge.count:null;if(last===null||last>now||n===null)continue;
      const kind=['comando','duvida','resposta'].includes(edge.kind)?edge.kind:'comando';
      links.push({from,to,fromName:name(from),toName:name(to),count:n,kind,at:new Date(last).toISOString(),recent:!flowOld&&now-last<=900000,family:nodes.find(n=>n.id===from)?.family||flowNodes.get(from)?.family||flowNodes.get(from)?.side||'dono'});
      for(const [i,message]of (Array.isArray(edge.messages)?edge.messages:[]).slice(0,8).entries()){const at=time(message?.at);if(at===null||at>now||!['comando','duvida','resposta'].includes(message.kind))continue;events.push({id:from+':'+to+':'+at+':'+i,nodeId:from,to,kind:message.kind,at:new Date(at).toISOString(),fromName:name(from),toName:name(to),family:links.at(-1).family,source:meta(message.source)||'pe-fluxo · metadados'});}
    }
    for(const node of nodes)for(const [kind,at]of [['start',node.startedAt],['end',node.closedAt]])if(at)events.push({id:node.id+':'+kind+':'+at,nodeId:node.id,to:null,kind,at,fromName:node.name,family:node.family,source:node.source});
    events.sort((a,b)=>b.at.localeCompare(a.at));
    return {known,old,partial:!!partial||snapshot?.readerStatus==='partial',at:known?new Date(observed).toISOString():null,source:meta(snapshot?.equipe?.source)||'leitor do painel · Equipe',nodes,counts,count,links,events:events.slice(0,300),flowKnown,flowOld,flowAt:flowKnown?new Date(flowAt).toISOString():null};
  }
  return {OWNERS,GROUPS,text,time,owner,compose,activity};
});
