'use strict';
// Forecasts describe their evidence and assumptions; they are never deadlines.
const MINUTE=60000,caches=new Map();
const at=value=>Number.isFinite(Date.parse(value))?Date.parse(value):null;
const median=values=>{const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);return sorted.length?sorted[Math.floor(sorted.length/2)]:null;};
const toolCount=agent=>(agent.tools||[]).reduce((sum,tool)=>sum+(Number.isFinite(tool.count)?tool.count:0),0);
function samplesOf(agents){return agents.filter(agent=>agent.state==='done').map(agent=>({role:agent.roleKey||agent.identity?.roleKey,duration:at(agent.lastAt)-at(agent.startedAt)})).filter(item=>item.duration>=2*MINUTE&&item.duration<=120*MINUTE);}
function forecast(agent,now=new Date(),samples=[],cache=new Map()){
 let current=agent.delivery||{};const stamp=now.getTime();
 // A previous delivery belongs to the previous task, not to resumed work.
 if(current.completedAt&&['working','walking'].includes(agent.state)&&at(agent.lastAt)>at(current.completedAt))current={...current,lastCompletedAt:current.completedAt,completedAt:null,estimateReason:null};
 if(current.completedAt)return {...current,estimated:false};
 if(agent.state==='done'&&at(agent.lastAt)!==null)return {...current,completedAt:agent.lastAt,etaAt:null,estimated:false,estimateReason:'completed',timingSource:'last-completed-step'};
 const expiredDeclared=at(current.etaAt)!==null&&at(current.etaAt)<stamp;
 if(at(current.etaAt)!==null&&!expiredDeclared)return {...current,estimated:current.estimated??!['feed','deadline','operator-summary'].includes(current.etaSource),estimateBasis:current.estimateBasis||{method:current.etaSource==='feed'?'declared':'recorded-pace',source:current.etaSource||'task',readAt:current.etaUpdatedAt||agent.lastAt||now.toISOString()}};
 if(at(current.deadlineAt)!==null&&at(current.deadlineAt)>=stamp&&!expiredDeclared)return {...current,etaAt:current.deadlineAt,etaSource:'deadline',estimated:false,estimateBasis:{method:'declared-deadline',source:current.deadlineSource||'task',readAt:agent.lastAt||now.toISOString()}};
 const key=agent.id+'|'+(agent.currentItemId||agent.deliveryItemId||agent.roleKey||''),steps=toolCount(agent),previous=cache.get(key),lastAt=at(agent.lastAt),startAt=at(agent.startedAt);
 // No clock-driven sliding ETA. Only new activity can revise the prediction.
 if(previous&&at(previous.forecast.etaAt)>=stamp&&previous.steps===steps&&previous.lastAt===agent.lastAt)return {...current,...previous.forecast};
 const role=agent.roleKey||agent.identity?.roleKey,similar=samples.filter(item=>item.role===role),typical=median(similar.map(item=>item.duration));
 let remaining,method,basis;
 if(typical!==null){remaining=Math.max(3*MINUTE,typical-Math.max(0,stamp-(startAt??stamp)));method='similar-tasks';basis={sampleCount:similar.length,typicalMinutes:Math.round(typical/MINUTE),source:'completed-agent-tasks'};}
 else{
  const elapsed=startAt!==null&&lastAt!==null?Math.max(MINUTE,lastAt-startAt):null;
  const period=elapsed!==null&&steps>0?Math.max(30000,Math.min(5*MINUTE,elapsed/steps)):5*MINUTE;
  const remainingStages=['qa','reviewer','copy-reviewer'].includes(role)?1:3;
  remaining=Math.max(3*MINUTE,period*remainingStages);
  method=elapsed!==null&&steps>0?'steps-per-minute':'initial-window';
  basis={steps,elapsedMinutes:elapsed!==null?Math.round(elapsed/MINUTE):null,remainingStages,assumption:true,source:steps?'tool-count-and-session-time':'last-activity-and-initial-window'};
 }
 const anchor=Math.max(stamp,lastAt??stamp),etaAt=new Date(Math.ceil((anchor+remaining)/(5*MINUTE))*5*MINUTE).toISOString();
 const hardLate=at(current.deadlineAt)!==null&&at(current.deadlineAt)<stamp;
 const value={etaAt,etaSource:'calculated',estimated:true,state:hardLate?'late':'in-progress',minutes:hardLate?Math.ceil((stamp-at(current.deadlineAt))/MINUTE):Math.max(0,Math.ceil((at(etaAt)-stamp)/MINUTE)),estimateReason:'pace-model',etaUpdatedAt:now.toISOString(),estimateBasis:{method,...basis,readAt:agent.lastAt||now.toISOString()},previousEtaAt:previous?.forecast?.etaAt|| (expiredDeclared?current.etaAt:null),revisionReason:previous?'new-recorded-activity':expiredDeclared?'declared-estimate-expired':null};
 cache.set(key,{steps,lastAt:agent.lastAt,forecast:value});return {...current,...value};
}
function applyForecasts(root,team,now=new Date()){
 let cache=caches.get(root);if(!cache){cache=new Map();caches.set(root,cache);}const samples=samplesOf(team.agents||[]);
 for(const agent of team.agents||[])agent.delivery=forecast(agent,now,samples,cache);
 for(const group of team.groups||[]){const live=group.agents.filter(agent=>!agent.delivery?.completedAt),leader=live.find(agent=>!agent.parentId)||live[0]||group.agents[0];group.delivery=leader?.delivery||null;}
 if(cache.size>2000){const keep=new Set((team.agents||[]).map(agent=>agent.id));for(const key of cache.keys())if(![...keep].some(id=>key.startsWith(id+'|')))cache.delete(key);}
 return team;
}
module.exports={forecast,applyForecasts,samplesOf,toolCount};
