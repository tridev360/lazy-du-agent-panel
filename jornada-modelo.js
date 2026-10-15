'use strict';
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./conselho-modelo.js'):root.CouncilModel,root);if(typeof module==='object'&&module.exports)module.exports=api;else root.JourneyModel=api;})(typeof globalThis==='object'?globalThis:this,function(C,root){
  const TYPES=['comeco','ia','produto','pessoa','infra','conquista'],METRICS=['conversas','projetos','produtos'];
  const rows=v=>Array.isArray(v)?v:[],number=v=>Number.isSafeInteger(v)&&v>=0?v:null;
  function evidence(at,source,now,ttl=7200000){at=C.time(at);return {at,source:source||null,valid:!!at&&!!source&&Date.parse(at)<=now,old:!!at&&now-Date.parse(at)>ttl};}
  function reading(raw,at,source,now,safe){const object=raw&&typeof raw==='object',e=evidence(object?raw.medidoEm:at,object?safe(raw.fonte):source,now,1800000);return {value:e.valid&&!e.old?number(object?raw.valor:raw):null,evidence:e};}
  function normalize(raw,opts={}){
    const now=opts.now??Date.now(),safe=v=>C.text(opts.sanitize?opts.sanitize(v):v,1000),origin=v=>opts.sourceAlias?opts.sourceAlias(v):safe(v),proof=evidence(raw?.atualizadoEm,opts.source,now),chapters=[],ids=new Set();
    for(const [i,r]of rows(raw?.capitulos).entries()){
      if(!r||typeof r!=='object')continue;const id=safe(r.id)||'chapter-'+i;if(ids.has(id))continue;ids.add(id);
      if(opts.private?.(r)){chapters.push({id,title:'frente sigilosa',period:null,summary:null,metrics:[],milestones:[],reserved:true});continue;}
      const milestones=[];for(const [j,m]of rows(r.marcos).entries()){
        if(!m||opts.private?.(m))continue;const title=safe(m.titulo);if(!title)continue;
        const type=String(m.tipo||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
        milestones.push({eventId:safe(m.eventoId||m.eventId),id:id+'-mark-'+j,title,day:typeof m.data==='string'&&m.data.length===10?C.day(m.data):null,detail:safe(m.detalhe),type:TYPES.includes(type)?type:'conquista',origin:origin(m.fonte),evidence:proof,quote:null});
      }
      const metrics=[];for(const label of METRICS){const v=r.numeros?.[label],object=v&&typeof v==='object',value=number(object?v.valor:v),e=object?evidence(v.medidoEm,origin(v.fonte),now):proof;if(value!==null&&e.valid)metrics.push({label,value,evidence:e,criterion:safe(object?v.criterio:r.numeros?.criterio),window:safe(object?v.janela:r.numeros?.janela)});}
      const period=typeof r.periodo==='object'&&r.periodo?[C.day(r.periodo.de),C.day(r.periodo.ate)].filter(Boolean).join(' / '):safe(r.periodo);
      // Historical reports remain separate from measured counts and today's totals.
      const reports=[['sessoes_de_trabalho_relatadas','sessões no relato'],['contas_claude_relatadas','contas Claude no relato'],['conselho_vozes_relatadas','vozes no relato']];
      let hero=null;for(const [key,label]of reports){const value=number(r.numeros?.[key]);if(value!==null&&proof.valid){hero={label,value,evidence:proof,criterion:'Relato histórico do capítulo. Não é uma contagem atual.',window:C.day(r.numeros?.data_do_relato)||period};break;}}
      chapters.push({id,title:safe(r.titulo),period,summary:safe(r.resumo_curto),metrics,milestones,reserved:false,hero});
    }
    const start=chapters.find(c=>!c.reserved)?.milestones.find(m=>m.type==='comeco'&&m.day)||null,current=raw?.hoje||raw?.capitulos?.at(-1)?.numeros||{};
    return {available:!!raw&&proof.valid,evidence:proof,chapters,start,current:{agents:reading(current.ia_sessoes_hoje,proof.at,proof.source,now,origin),products:reading(current.produtos_rodando,proof.at,proof.source,now,origin)}};
  }
  function compose(history,snapshot={},now=Date.now(),zone='America/Sao_Paulo'){
    const h=history||normalize(null,{now}),chapters=h.chapters.map(c=>({...c,milestones:c.milestones.map(m=>({...m}))})),floating=[];
    for(const m of snapshot.marcos?.valid?rows(snapshot.marcos.items):[]){
      const existing=chapters.flatMap(c=>c.milestones).find(n=>(typeof module==='object'&&module.exports?require('./dados-auditados.js'):root.PainelDadosAuditados).identity(n)===(typeof module==='object'&&module.exports?require('./dados-auditados.js'):root.PainelDadosAuditados).identity(m)&&(n.day===m.day||n.eventId&&n.eventId===m.eventId));
      if(existing){existing.type='conquista';existing.quote=m.quote;existing.quoteEvidence=evidence(m.at,m.source,now);continue;}
      const mark={id:m.id,title:m.title,day:m.day,detail:m.story,quote:m.quote,type:'conquista',origin:m.source,evidence:evidence(m.at,m.source,now)};
      const chapter=m.day?chapters.filter(c=>!c.reserved&&c.milestones.some(n=>n.day&&n.day<=m.day)).at(-1):null;
      (chapter?chapter.milestones:floating).push(mark);
    }
    for(const c of chapters)c.milestones.sort((a,b)=>(a.day||'9999').localeCompare(b.day||'9999'));
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
    const days=h.start&&h.evidence.valid?Math.floor((Date.parse(today+'T12:00:00Z')-Date.parse(h.start.day+'T12:00:00Z'))/86400000):null;
    const parts=[['Claude',snapshot.claude?.sessions,snapshot.claude?.evidence],['Ajudantes',snapshot.claude?.helpers,snapshot.claude?.helperEvidence],['Codex exec',snapshot.codex?.execs,snapshot.codex?.evidence],['Codex app',snapshot.codex?.conversations,snapshot.codex?.evidence]].map(([label,value,e])=>({label,value,evidence:evidence(e?.at,e?.source,now,1800000)}));
    const explicit=h.current?.agents,allKnown=parts.every(p=>number(p.value)!==null&&p.evidence.valid&&!p.evidence.old),agents=explicit?.value!==null&&explicit?.value!==undefined?{value:explicit.value,parts:[{label:'Hoje',...explicit}]}:{value:allKnown?parts.reduce((sum,p)=>sum+p.value,0):null,parts};
    const nodes=rows(snapshot.activity?.nodes).filter(n=>n.id&&C.time(n.fileAt)&&Date.parse(n.fileAt)<=now&&now-Date.parse(n.fileAt)<=21600000),nodeIds=new Set(nodes.map(n=>n.id));
    return {...h,chapters,floating,now,zone,stats:{days:days!==null&&days>=0?days:null,agents,products:h.current?.products||{value:null,evidence:null}},nodes,events:rows(snapshot.activity?.events).filter(e=>nodeIds.has(e.nodeId)),activityEvidence:evidence(snapshot.activity?.observedAt,snapshot.activity?.source,now,1800000),next:rows(snapshot.council?.ideas).filter(i=>i.verdict==='now'&&i.evidence?.valid)};
  }
  return {TYPES,METRICS,normalize,compose,evidence};
});
