const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../public/r4-core.js');
const {metadata,publicMetadata}=require('../src/lib/agent-metadata.cjs');
const now=Date.parse('2030-01-01T12:00:00Z');
test('forecasts retain the recorded task start and an honest basis',()=>{
  const initial=R.forecast({id:'initial'},now);assert.equal(initial.method,'planning');assert.equal(initial.at,now+15*60000);
  const pace=R.forecast({id:'pace',startedAt:'2030-01-01T11:40:00Z',updated:'2030-01-01T12:00:00Z',observedSteps:10,tokens:10000},now);
  assert.equal(pace.method,'steps');assert.equal(pace.at,Date.parse('2030-01-01T11:46:00Z'));
  const token=R.forecast({id:'token',startedAt:'2030-01-01T11:40:00Z',updated:'2030-01-01T12:00:00Z',tokens:20000},now);assert.equal(token.method,'tokens');
  const history=R.forecast({id:'history',taskDurationsMinutes:[4,8,6]},now);assert.equal(history.method,'history');assert.equal(history.at,now+6*60000);
  assert.equal(R.forecast({id:'explicit',estimateAt:'2030-01-01T12:10:00Z'},now).method,'declared');
});
test('unchanged readings retain their forecast after expiry without moving the promise',()=>{
  const a={id:'stable',updated:'2030-01-01T12:00:00Z'},one=R.forecast(a,now);assert.equal(R.forecast(a,now+60000).at,one.at);assert.equal(R.forecast(a,one.at+1).at,one.at);assert.ok(R.forecast(a,one.at+60000).minutes<0);
});
test('names are uppercase, distinct and actions are short',()=>{
  const list=R.decorate([{id:'one',role:'researcher',taskTitle:'PRICES'},{id:'two',role:'researcher',taskTitle:'MATERIALS'},{id:'three',role:'creator',taskTitle:'GAME'},{id:'four',role:'creator',taskTitle:'PANEL'}],{},now);
  assert.equal(new Set(list.map(a=>a.title)).size,4);assert.equal(new Set(list.map(a=>a.titlePT)).size,4);
  for(const a of list){assert.equal(a.title,a.title.toUpperCase());assert.ok(a.action.length<=40);assert.ok(a.actionPT.length<=40);assert.ok(a.forecast.at>now);}
});
test('progress measures completed steps without inventing task completion',()=>{
  assert.equal(R.progress([],[]),null);assert.deepEqual(R.progress([],[{observedSteps:10,completedSteps:7}]),{percent:70,method:'steps',count:10,done:7});
  assert.equal(R.progress([{percent:20},{percent:60}],[]).percent,40);
});
test('tool completion and bounded own history expose only numeric metadata',()=>{
  let m=metadata(JSON.stringify({type:'event_msg',timestamp:'2030-01-01T11:50:00Z',payload:{type:'task_started'}}));
  m=metadata(JSON.stringify({type:'response_item',timestamp:'2030-01-01T11:51:00Z',payload:{type:'function_call',name:'functions.exec',call_id:'PRIVATE_CALL',arguments:'PRIVATE_ARGUMENT'}}),m);
  const done=JSON.stringify({type:'response_item',timestamp:'2030-01-01T11:52:00Z',payload:{type:'function_call_output',call_id:'PRIVATE_CALL',output:'PRIVATE_OUTPUT'}});
  m=metadata(done,m);m=metadata(done,m);
  m=metadata(JSON.stringify({type:'event_msg',timestamp:'2030-01-01T12:00:00Z',payload:{type:'task_complete',task_subject:'PRIVATE_SUBJECT',text:'PRIVATE_BODY'}}),m);
  const p=publicMetadata(m);assert.equal(p.observedSteps,1);assert.equal(p.completedSteps,1);assert.deepEqual(p.taskDurationsMinutes,[10]);assert.equal(p.lastTool,'functions.exec');assert.doesNotMatch(JSON.stringify(p),/PRIVATE|pending|completed"/);
});
test('Claude tool-result IDs deduplicate without reading user text',()=>{
  let m=metadata(JSON.stringify({type:'assistant',timestamp:'2030-01-01T11:51:00Z',message:{content:[{type:'tool_use',id:'private',name:'Read'}]}}));
  m=metadata(JSON.stringify({type:'user',timestamp:'2030-01-01T11:52:00Z',message:{content:[{type:'tool_result',tool_use_id:'private',content:'PRIVATE_TEXT'}]}}),m);
  assert.equal(publicMetadata(m).completedSteps,1);assert.doesNotMatch(JSON.stringify(publicMetadata(m)),/PRIVATE_TEXT|private/);
});
test('next delivery is always available even for an empty profile',()=>{assert.ok(R.next([],[],now).forecast.at>now);assert.equal(R.next([],[],now).agent,null);});
test('a live session appears before its first token count and newer tools update its activity',()=>{
  const {UsageIndex}=require('../src/lib/usage.cjs'),index=new UsageIndex();
  index.consume('codex','fixture',JSON.stringify({type:'session_meta',timestamp:'2030-01-01T12:00:00Z',payload:{model:'gpt-5.4',cwd:'/project'}}));
  const s=index.snapshot(new Date(now)).sessions[0];assert.equal(s.tokens,null);assert.equal(s.recent,false);assert.equal(s.model,'gpt-5.4');
  index.consume('codex','fixture',JSON.stringify({type:'event_msg',timestamp:'2030-01-01T12:01:00Z',payload:{type:'token_count',info:{total_token_usage:{total_tokens:10}}}}));
  index.consume('codex','fixture',JSON.stringify({type:'response_item',timestamp:'2030-01-01T12:02:00Z',payload:{name:'functions.exec',call_id:'c'}}));
  assert.equal(index.snapshot(new Date('2030-01-01T12:03:00Z')).sessions.length,1);assert.equal(index.snapshot().sessions[0].updated,'2030-01-01T12:02:00.000Z');
});
