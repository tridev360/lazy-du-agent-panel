"use strict";
(function(root){
  const roles={dev:['DEV','DEV'],designer:['DESIGNER','DESIGNER'],reviewer:['REVIEWER','REVISOR'],qa:['TESTER','TESTADOR'],researcher:['RESEARCHER','PESQUISADOR'],writer:['WRITER','REDATOR'],lead:['ARCHITECT','ARQUITETO'],creator:['CREATOR','CRIADOR']};
  const subjects={tests:['TESTS','TESTES'],research:['RESEARCH','PESQUISA'],design:['DESIGN','DESIGN'],code:['CODE','CÓDIGO'],files:['FILES','ARQUIVOS'],review:['REVIEW','REVISÃO']};
  const finite=x=>Number.isFinite(x)&&x>=0;
  const stamp=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
  function activity(a){
    const tool=a.lastTool||a.tools?.at(-1)?.name||'',s=String(tool).toLowerCase();
    if(/test|vitest|playwright/.test(s)||a.role==='qa')return 'tests';
    if(/search|web|fetch|browse/.test(s)||a.role==='researcher')return 'research';
    if(/image|design|figma/.test(s)||a.role==='designer')return 'design';
    if(/edit|write|patch|exec|shell/.test(s)||a.role==='dev')return 'code';
    if(a.role==='reviewer')return 'review';
    return 'files';
  }
  const cache=new Map();
  function forecast(a,now=Date.now()){
    const explicit=stamp(a.estimateAt||a.deadlineAt);
    if(explicit)return {at:explicit,method:'declared',minutes:Math.ceil((explicit-now)/60000)};
    const start=stamp(a.taskStartedAt||a.taskAt||a.startedAt||a.birthAt),last=stamp(a.updated)||now;
    const steps=finite(a.observedSteps)?a.observedSteps:(a.tools||[]).reduce((n,t)=>n+(finite(t.count)?t.count:0),0);
    const elapsed=start&&last>start?(last-start)/60000:0;
    const rate=elapsed>0&&finite(a.tokens)?a.tokens/elapsed:null;
    const history=(a.taskDurationsMinutes||[]).filter(x=>finite(x)&&x>0&&x<=240).sort((x,y)=>x-y);
    let minutes=15,method='planning';
    if(history.length){const median=history[Math.floor(history.length/2)];minutes=Math.max(3,median);method='history';}
    else if(elapsed>=1&&steps>=2){minutes=Math.max(3,Math.min(45,elapsed/steps*3));method='steps';}
    else if(rate>0){minutes=Math.max(3,Math.min(45,Math.max(1000,a.tokens*.15)/rate));method='tokens';}
    const signature=String(start||'first-observation'),key=a.id||'next-session';
    let old=cache.get(key);
    if(!old){try{old=JSON.parse(root.localStorage?.getItem('agent-panel-eta-'+key));}catch{}}
    if(!old||old.signature!==signature){old={signature,at:(start||now)+Math.ceil(minutes)*60000,method};if(cache.size>512)cache.clear();cache.set(key,old);try{root.localStorage?.setItem('agent-panel-eta-'+key,JSON.stringify(old));}catch{}}
    method=old.method||method;
    return {at:old.at,minutes:Math.ceil((old.at-now)/60000),method,steps,rate,readAt:stamp(a.updated),conditional:['resting','waiting'].includes(a.state)};
  }
  function decorate(list,snapshot,now=Date.now()){
    return list.map(a=>{
      const role=roles[a.role]||roles.creator;
      const topic=text=>String(text||'').replace(/\{[^{}]*\}|\[[^\]]*\]/g,'').replace(/^\d{4}[-_ ]\d{2}[-_ ]\d{2}[-_ ]?/,'').replace(/[_-]/g,' ').replace(/\b(?:subagente|subagent|helper|ajudante|report|relat[oó]rio|v?\d+|second|third|fourth|fifth|sixth|seventh|eighth|ninth)\b/gi,'').replace(/\s+/g,' ').trim().split(/\s+/).slice(0,5).join(' ');
      const subject=topic(a.taskTitle)||topic(a.projectName)||'LOCAL PROJECT',subjectPT=topic(a.taskTitlePT||a.taskTitle)||topic(a.projectName)||'PROJETO LOCAL';
      const roleES={dev:'DEV',designer:'DISEÑADOR',reviewer:'REVISOR',qa:'PROBADOR',researcher:'INVESTIGADOR',writer:'REDACTOR',lead:'ARQUITECTO',creator:'CREADOR'};const en='DU '+role[0]+' · '+subject.toUpperCase(),pt='DU '+role[1]+' · '+subjectPT.toUpperCase(),es='DU '+(roleES[a.role]||roleES.creator)+' · '+(topic(a.taskTitleES)||subject).toUpperCase();
      const stale=a.state==='resting'||a.state==='finished'||stamp(a.updated)&&now-stamp(a.updated)>=600000;
      const last=String(a.lastTool||'').toLowerCase(),fallback=/read/.test(last)?['Reading a file','Lendo um arquivo']:/edit|write|patch/.test(last)?['Editing a file','Editando um arquivo']:/exec|command|bash|shell/.test(last)?['Running a command','Rodando um comando']:/agent|task/.test(last)?['Calling a helper','Chamando um ajudante']:/search|web/.test(last)?['Searching the web','Pesquisando na web']:['Waiting for the next activity','Esperando a próxima atividade'];
      const cleanAction=(text,subject,fallback)=>!text||text.toUpperCase()===subject.toUpperCase()?fallback:text;
      const action=a.state==='waiting'?['Waiting for your decision','Esperando sua decisão']:stale?['Waiting','Esperando']:[cleanAction(a.action,subject,fallback[0]),cleanAction(a.actionPT,subjectPT,fallback[1])];
      return {...a,title:en,titlePT:pt,titleES:es,action:action[0],actionPT:action[1],forecast:forecast(a,now)};
    });
  }
  function group(list){
    const same=new Map();for(const a of list){const key=a.title+'|'+a.state+'|'+(a.parentKey||'');if(!same.has(key))same.set(key,[]);same.get(key).push(a);}
    const result=[];for(const agents of same.values()){
      if(agents.length===1){result.push(agents[0]);continue;}
      const words=new Map();for(const a of agents)for(const word of new Set(a.taskWords||[]))words.set(word,(words.get(word)||0)+1);
      const used=new Set();for(const a of agents){const unique=(a.taskWords||[]).find(word=>words.get(word)===1&&!a.title.includes(word)&&!/^(?:HELPER|AJUDANTE|SUBAGENTE|REVIEWER|REVISOR)$/.test(word));if(unique){const add=text=>{const [prefix,subject]=text.split(' · ');return prefix+' · '+subject.split(/\s+/).slice(0,4).concat(unique).join(' ');};result.push({...a,title:add(a.title),titlePT:add(a.titlePT)});used.add(a);}}
      const rest=agents.filter(a=>!used.has(a));if(rest.length)result.push({...rest[0],memberCount:rest.length,members:rest.map(a=>a.id)});
    }return result;
  }

  function dailyTasks(items,day){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day||''))return [];
    const eligible=new Map();
    for(const task of items){
      const percent=task.phase?.percent??task.percent,at=percent===100?task.completedAt:task.startedAt;
      if(task.helper||!finite(percent)||percent>100||!task.title||/^(?:REPORT|RELAT[OÓ]RIO)$/i.test(task.title)||!/^\d{4}-\d{2}-\d{2}T/.test(at||'')||stamp(at)===null||new Date(at).toISOString().slice(0,10)!==day)continue;
      const key=task.id||task.title,prior=eligible.get(key);
      if(!prior||percent>(prior.phase?.percent??prior.percent))eligible.set(key,task);
    }
    return [...eligible.values()];
  }
  function progress(items,list,day){
    const daily=day!==undefined,known=daily?dailyTasks(items,day):items.filter(x=>finite(x.phase?.percent??x.percent));
    if(known.length)return {percent:Math.round(known.reduce((n,x)=>n+(x.phase?.percent??x.percent),0)/known.length),method:'tasks',count:known.length};
    if(daily)return null;
    const total=list.reduce((n,a)=>n+(a.observedSteps||0),0),done=list.reduce((n,a)=>n+(a.completedSteps||0),0);
    return total?{percent:Math.round(Math.min(1,done/total)*100),method:'steps',count:total,done}:null;
  }
  function next(list,items,now=Date.now()){
    const declared=items.filter(x=>(x.phase?.percent??x.percent)!==100&&stamp(x.deadlineAt)>now).map(x=>({agent:x,forecast:forecast(x,now)}));
    const active=list.filter(a=>a.state==='working'||a.state==='recent');
    const candidates=declared.concat((active.length?active:list).map(a=>({agent:a,forecast:a.forecast||forecast(a,now)})));
    return candidates.sort((a,b)=>a.forecast.at-b.forecast.at)[0]||{agent:null,forecast:forecast({id:'next-session'},now)};
  }
  const api={decorate,group,forecast,dailyTasks,progress,next,activity};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.PanelR4Core=api;
})(typeof window==='object'?window:globalThis);
