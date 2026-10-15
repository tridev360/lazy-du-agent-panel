'use strict';
// Pure reducer: receives projected scalar records only, never process state or conversation bodies.
const START = new Set(['task_started','turn_started']);
const END = new Set(['task_complete','turn_complete','shutdown_complete']);
const WAIT = new Set(['turn_aborted','error']);
const WAIT_TOOLS = new Set(['wait','wait_agent','wait_threads','sleep']);
const SOURCES = Object.freeze(['codex.lifecycle','claude.lifecycle']);
function at(value) {
  if (typeof value !== 'string' || value.length > 40) return null;
  const n=Date.parse(value); return Number.isFinite(n) ? new Date(n).toISOString() : null;
}
function blank(family) {
  return {family:family==='claude'?'claude':'codex',state:'unknown',startedAt:null,closedAt:null,eventLastAt:null,activeId:null};
}
function scalar(record) {
  if(!record||typeof record!=='object')return null;
  const p=record.payload;
  return {type:typeof record.type==='string'?record.type:null,timestamp:at(record.timestamp),
    event:p&&typeof p.type==='string'?p.type:null,phase:p&&typeof p.phase==='string'?p.phase:null,
    name:p&&typeof p.name==='string'?p.name:null,
    id:p&&typeof p.task_id==='string'&&/^[a-zA-Z0-9._:-]{1,100}$/.test(p.task_id)?p.task_id:null};
}
function consume(previous,record,family=previous?.family||'codex') {
  const prior=previous||blank(family),r=scalar(record);if(!r)return {...prior};
  let kind=null;
  if(family==='codex'){
    if(r.type==='event_msg'&&START.has(r.event))kind='start';
    else if(r.type==='event_msg'&&END.has(r.event)||r.type==='response_item'&&r.phase==='final_answer')kind='done';
    else if(r.type==='event_msg'&&WAIT.has(r.event))kind='waiting';
    else if(r.type==='response_item'&&['function_call','custom_tool_call'].includes(r.event)&&r.name){
      kind=WAIT_TOOLS.has(r.name.trim().split('__').at(-1).split('.').at(-1))?'tool-wait':'tool-work';
    }
  }else if(family==='claude'){
    // Generic assistant/user records and a live process do not prove a work lifecycle.
    if(START.has(r.type))kind='start';
    else if(['result','completed',...END].includes(r.type))kind='done';
    else if(WAIT.has(r.type))kind='waiting';
  }
  if(!kind)return {...prior};
  if(!r.timestamp)return {...prior,state:'unknown',activeId:null};
  if(prior.eventLastAt&&Date.parse(r.timestamp)<Date.parse(prior.eventLastAt))
    return {...prior,state:'unknown',activeId:null};
  const next={...prior,family,eventLastAt:r.timestamp};
  if(kind==='start')return {...next,state:'working',startedAt:r.timestamp,closedAt:null,activeId:r.id};
  if(!prior.startedAt||prior.closedAt||prior.state==='unknown')return {...next,state:'unknown',activeId:null};
  if(r.id&&prior.activeId&&r.id!==prior.activeId)return {...next,state:'unknown',activeId:null};
  if(kind==='done')return {...next,state:'done',closedAt:r.timestamp,activeId:null};
  if(kind==='waiting')return {...next,state:'waiting',closedAt:r.timestamp,activeId:null};
  return {...next,state:kind==='tool-wait'?'waiting':'working'};
}
function proof(lifecycle,{observedAt,now=Date.now(),freshMs=30000,eventFreshMs=300000,verified=false,scanning=false,contradiction=false}={}) {
  const l=lifecycle||blank('codex'),seen=at(observedAt);
  const fresh=verified===true&&seen&&Number.isFinite(now)&&Number.isFinite(freshMs)&&freshMs>0
    &&Date.parse(seen)<=now&&now-Date.parse(seen)<=freshMs;
  const chronological=l.eventLastAt&&seen&&Date.parse(l.eventLastAt)<=Date.parse(seen)&&l.startedAt&&Date.parse(l.startedAt)<=Date.parse(l.eventLastAt);
  const eventFresh=l.eventLastAt&&now-Date.parse(l.eventLastAt)>=0&&now-Date.parse(l.eventLastAt)<=eventFreshMs;
  const state=fresh&&chronological&&!scanning&&!contradiction&&(l.state==='done'||eventFresh)&&['working','waiting','done'].includes(l.state)?l.state:'unknown';
  return {state,source:l.family==='claude'?'claude.lifecycle':'codex.lifecycle',
    startedAt:l.startedAt||null,closedAt:l.closedAt||null,observedAt:seen,eventLastAt:l.eventLastAt||null};
}
module.exports={blank,consume,proof,SOURCES};
