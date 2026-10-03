'use strict';
const crypto=require('node:crypto');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex').slice(0,12);
const clean=value=>String(value||'?').replace(/[\x00-\x1f\x7f]/g,'').replace(/[\u2013\u2014]/g,',').replace(/0x[a-f\d]{40}/gi,'').slice(0,90);
const at=s=>Math.max(...[s.activityAt,s.updated,s.lastActivity,s.startedAt].map(x=>Date.parse(x)).filter(Number.isFinite),0);
const read=/^(?:Read|Grep|Glob|LS|read_file|list_dir|search_files|mcp__[^ ]*__(?:read|search|find|get|list)[a-z_]*|websearch|webfetch)$/i;
const edit=/^(?:Edit|MultiEdit|Write|NotebookEdit|apply_patch|write_file)$/i;
function generate(usage={},saved={quietDays:7,projects:{}},rules={projects:[],onboarding:null},now=Date.now()){
 const sessions=usage.sessions||[],alerts=[],projects=new Map(),day=new Date(now).toISOString().slice(0,10),ruleMap=new Map((rules.projects||[]).map(p=>[p.key,p]));
 for(const s of sessions){if(!s.projectId)continue;const id=s.projectId,p=projects.get(id)||{key:id,name:clean(s.projectName),last:0,live:false};p.last=Math.max(p.last,at(s));p.live||=['working','recent'].includes(s.state);projects.set(id,p);}
 const list=[...projects.values()].map(p=>{const choice=saved.projects?.[p.key],paused=choice?.state==='paused'&&choice.resumeAt>day;return {...p,state:choice?.state==='closed'?'closed':paused?'paused':choice?.state==='queued'?'queued':p.live?'active':'resting',resumeAt:paused?choice.resumeAt:null,queueOrder:choice?.state==='queued'?choice.queueOrder:null,rulesEnabled:ruleMap.get(p.key)?.rulesEnabled??null};});
 const add=(type,s,values,priority,projectKey=null)=>{const identity=s?.sessionKey||s?.id||projectKey||'projects';alerts.push({id:hash(type+'|'+identity),type,sessionKey:s?.sessionKey||s?.id||null,agent:s?.agent||null,projectKey:projectKey||s?.projectId||null,values:s?.projectId?{...values,projectName:list.find(p=>p.key===s.projectId)?.name||clean(s.projectName)}:values,priority});};
 for(const s of sessions){const project=list.find(p=>p.key===s.projectId);if(['closed','paused','queued'].includes(project?.state)||s.state==='finished')continue;const tools=(s.tools||[]).filter(t=>t.count>0),total=tools.reduce((n,t)=>n+t.count,0),edits=tools.filter(t=>edit.test(t.name)).reduce((n,t)=>n+t.count,0),context=s.contextPercent;
  if(Number.isFinite(context)&&Number.isSafeInteger(s.lastInputTokens)&&Number.isSafeInteger(s.contextWindow)&&s.contextWindow>0&&context>=60){const stamp=new Date(at(s)||now).toISOString().replace(/[:.]/g,'-');add('context',s,{percent:context,handoffFile:'handoff-'+stamp+'-'+hash(s.sessionKey||s.id||'session')+'.md'},1);}
  else if((s.projectHistory||[]).length>1){const history=s.projectHistory;add('mixed-projects',s,{projectA:clean(history[0].name),projectB:clean(history.at(-1).name)},2);}
  else if(s.metadataComplete===true&&!s.sampled&&['xhigh','max','ultra'].includes(s.effort)&&tools.length&&tools.every(t=>read.test(t.name)))add('effort-read',s,{},3);
  else if(/(?:haiku|[-_]mini|[-_]nano|[-_]luna)(?:[-_.]|$)/i.test(s.model||'')&&edits>=12&&total)add('small-model-code',s,{},3);
  else if(s.helper&&!s.finishedAt&&s.state!=='finished'&&s.processAlive===true&&at(s)&&now-at(s)>=2*3600000)add('forgotten-helper',s,{hours:Math.floor((now-at(s))/3600000),count:1},4);
 }
 for(const p of list)if(p.state==='resting'&&p.last&&now-p.last>=saved.quietDays*86400000)add('quiet-project',null,{projectName:p.name,days:Math.floor((now-p.last)/86400000)},5,p.key);
 const active=list.filter(p=>p.state==='active');if(active.length>3)add('many-projects',null,{count:active.length},6);
 return {version:1,generatedAt:new Date(now).toISOString(),alerts:alerts.sort((a,b)=>a.priority-b.priority),settings:{quietDays:saved.quietDays||7,error:saved.error||null},projects:list,onboarding:rules.onboarding||null};
}
module.exports={generate,at};
