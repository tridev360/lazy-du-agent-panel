const crypto = require('node:crypto');
const {projectJSON} = require('./project-json.cjs');
const paths=['type','timestamp','cwd','payload.cwd','payload.model','message.model','payload.info.total_token_usage.total_tokens',
  'payload.type','payload.effort','payload.reasoning_effort','payload.name','payload.call_id','payload.agent_role','payload.role','payload.task_subject','payload.estimated_completion',
  'payload.info.total_token_usage.input_tokens','payload.info.total_token_usage.output_tokens',
  'payload.info.total_token_usage.cached_input_tokens',
  ...Array.from({length:16},(_,i)=>['type','name','id','tool_use_id'].map(k=>`message.content.${i}.${k}`)).flat()];
const model = value => typeof value==='string' && /^(?:claude-|gpt-|codex|o[134](?:-|$))[a-z\d._ -]{0,60}$/i.test(value) ? value : null;
const tool = value => typeof value==='string' && /^(?:mcp__[a-z\d_]+|[a-z][a-z_.]{1,60})$/i.test(value) ? value : null;
function metadata(line,previous={}) {
  let r;try{r=projectJSON(line,paths);}catch{return previous;}
  return metadataRecord(r, previous);
}
function metadataRecord(r, previous={}) {
  if (!['session_meta','turn_context','assistant','user','response_item','event_msg'].includes(r.type)) return previous;
  // These bounded tracking sets stay private to one file's reader. Copying
  // thousands of call IDs for every token/context record makes long histories
  // quadratic; publicMetadata only returns fresh scalar/array projections.
  const out={...previous,toolCounts:previous.toolCounts||{},seen:previous.seen||new Set(),pending:previous.pending||{},completed:previous.completed||new Set(),taskDurationsMinutes:previous.taskDurationsMinutes||[]};
  const at=typeof r.timestamp==='string'?Date.parse(r.timestamp):NaN;
  if(Number.isFinite(at)){if(!out.startedAt||at<Date.parse(out.startedAt))out.startedAt=new Date(at).toISOString();}
  const subject=r['payload.task_subject'];if(['tests','research','design','code','files','review'].includes(subject))out.taskSubject=subject;
  const kind=r['payload.type'];
  if(kind==='task_started'&&Number.isFinite(at))out.taskStart=at;
  if(kind==='task_complete'&&Number.isFinite(at)&&out.taskStart&&at>out.taskStart){const minutes=(at-out.taskStart)/60000;if(minutes<=240){out.taskDurationsMinutes.push(minutes);out.taskDurationsMinutes=out.taskDurationsMinutes.slice(-32);}out.taskStart=null;}
  const cwd=r.cwd||r['payload.cwd'];
  if(typeof cwd==='string'&&cwd.length<=2048){
    const identity=cwd.replace(/\\/g,'/').replace(/\/$/,'').toLowerCase();
    out.projectId=crypto.createHash('sha256').update(identity).digest('hex').slice(0,8);
    // The local panel shows the project folder, never its parent path.
    const folder=cwd.replace(/\\/g,'/').replace(/\/+$/,'').split('/').at(-1);
    out.projectName=folder?.replace(/[\x00-\x1f\x7f]/g,'').replace(/0x[a-f\d]{40}/gi,'').slice(0,80)||null;
  }
  const m=model(r['message.model']||r['payload.model']);if(m)out.model=m;
  const effort=r['payload.effort']||r['payload.reasoning_effort'];
  const role=r['payload.agent_role']||r['payload.role'];if(['dev','designer','reviewer','qa','researcher','writer','lead','creator'].includes(role))out.role=role;
  const eta=r['payload.estimated_completion'];if(typeof eta==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(eta)&&Number.isFinite(Date.parse(eta)))out.estimateAt=new Date(eta).toISOString();
  if(['minimal','low','medium','high','xhigh','max','ultra'].includes(effort))out.effort=effort;
  const candidates=[];
  if(r.type==='response_item'&&tool(r['payload.name']))candidates.push([r['payload.name'],r['payload.call_id']||r.timestamp]);
  for(let i=0;i<16;i++)if(r[`message.content.${i}.type`]==='tool_use'&&tool(r[`message.content.${i}.name`]))candidates.push([r[`message.content.${i}.name`],r[`message.content.${i}.id`]||r.timestamp+':'+i]);
  for(const [name,id]of candidates){const key=name+':'+id;if(!out.seen.has(key)&&out.seen.size<2048){out.seen.add(key);out.toolCounts[name]=(out.toolCounts[name]||0)+1;if(Number.isFinite(at)&&(!out.lastToolAt||at>=out.lastToolAt)){out.lastTool=name;out.lastToolAt=at;}const hash=crypto.createHash('sha256').update(String(id)).digest('hex').slice(0,16);if(Object.keys(out.pending).length<128)out.pending[hash]=at;}}
  const completed=[];
  if(r.type==='response_item'&&kind==='function_call_output')completed.push(r['payload.call_id']);
  for(let i=0;i<16;i++)if(r[`message.content.${i}.type`]==='tool_result')completed.push(r[`message.content.${i}.tool_use_id`]);
  for(const id of completed){if(typeof id!=='string')continue;const hash=crypto.createHash('sha256').update(id).digest('hex').slice(0,16);if(Object.hasOwn(out.pending,hash)&&out.completed.size<2048){out.completed.add(hash);delete out.pending[hash];}}
  const input=r['payload.info.total_token_usage.input_tokens'],output=r['payload.info.total_token_usage.output_tokens'],cache=r['payload.info.total_token_usage.cached_input_tokens'];
  if (r['payload.info.total_token_usage.total_tokens'] !== undefined) out.weightedTokens = null;
  if([input,output,cache].every(x=>Number.isSafeInteger(x)&&x>=0)&&cache<=input)out.weightedTokens=input-cache+output+cache*.1;
  return out;
}
function publicMetadata(meta={}) {
  return {projectId:meta.projectId||null,projectName:meta.projectName||null,
    model:meta.model||null,effort:meta.effort||null,role:meta.role||null,estimateAt:meta.estimateAt||null,
    tools:Object.entries(meta.toolCounts||{}).map(([name,count])=>({name,count})),
    toolsExact:false,weightedTokens:meta.weightedTokens??null,startedAt:meta.startedAt||null,taskStartedAt:meta.taskStart?new Date(meta.taskStart).toISOString():null,lastTool:meta.lastTool||null,taskSubject:meta.taskSubject||null,
    observedSteps:Object.values(meta.toolCounts||{}).reduce((n,v)=>n+v,0),completedSteps:(meta.completed?.size||0)+(meta.completedCount||0),taskDurationsMinutes:meta.taskDurationsMinutes||[],sampled:!!meta.sampled};
}
module.exports={metadata,metadataRecord,publicMetadata,paths};
