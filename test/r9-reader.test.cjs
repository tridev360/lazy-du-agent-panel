'use strict';
const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {Metrics,UsageIndex}=require('../src/lib/usage.cjs');
const {DailyUsage}=require('../src/lib/daily-usage.cjs');
const {key}=require('../src/lib/session-story.cjs');
const now=new Date('2030-01-07T12:00:00Z'),day=86400000;
const uuid=n=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0');
const line=(type,payload,at='2030-01-07T11:59:00Z')=>JSON.stringify({type,timestamp:at,payload})+'\n';
const content=(id,tokens=10)=>line('session_meta',{id,cwd:'/projects/Game',model:'gpt-6.1-sol'})+line('event_msg',{type:'token_count',info:{total_token_usage:{total_tokens:tokens,input_tokens:tokens,output_tokens:0,cached_input_tokens:0}}});
function fixture(t){const home=fs.mkdtempSync(path.join(os.tmpdir(),'panel-r9-reader-'));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));return home;}
function write(home,id,text,age=0){const file=path.join(home,'.codex','sessions','2030','01','07','rollout-2030-01-07T12-00-00-'+id+'.jsonl');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);fs.utimesSync(file,new Date(+now-age),new Date(+now-age));return file;}
function metrics(home,options={}){return new Metrics(home,{clock:()=>now,cacheDir:path.join(home,'cache'),...options});}
async function finish(m){for(let n=0;n<500;n++){await m.refresh();if(!m.pending&&!m.running){clearTimeout(m.nextRound);return m.snapshot();}}throw Error('Reader did not finish');}
async function watchOpens(run){const open=fs.promises.open,files=[];fs.promises.open=async(file,...args)=>{if(String(file).endsWith('.jsonl'))files.push(String(file));return open(file,...args);};try{return {value:await run(),files};}finally{fs.promises.open=open;}}

test('default scope is 24h; excluded old files are counted without opening content or restoring old cache',async t=>{
  const home=fixture(t),recent=write(home,uuid(1),content(uuid(1))),old=write(home,uuid(2),content(uuid(2),80),2*day);
  const broad=metrics(home);await broad.setScopeDays(7);await finish(broad);await broad.setScopeDays(1);
  const observed=await watchOpens(()=>finish(metrics(home)));
  a.equal(observed.value.scopeDays,1);a.equal(observed.value.sessions.length,1);a.equal(observed.value.totals.tokens,10);
  a.deepEqual(observed.value.oldConversations,{total:1,codex:1,claude:0,complete:true});
  a.ok(!observed.files.includes(old));a.equal(observed.value.sessions[0].processAlive,null);a.ok(fs.existsSync(recent));
});

test('scope 1/3/7 persists by profile and rejects unsupported values',async t=>{
  const home=fixture(t);write(home,uuid(1),content(uuid(1)));write(home,uuid(2),content(uuid(2)),2*day);write(home,uuid(3),content(uuid(3)),6*day);
  const m=metrics(home);a.equal((await finish(m)).sessions.length,1);
  await m.setScopeDays(3);a.equal((await finish(m)).sessions.length,2);
  const restored=metrics(home);a.equal((await finish(restored)).scopeDays,3);
  await restored.setScopeDays(7);a.equal((await finish(restored)).sessions.length,3);
  await a.rejects(()=>restored.setScopeDays(2),RangeError);a.equal(restored.scopeDays,7);
});

test('an old UUID conversation is selected only with an exact proven live process binding; process failure stays unknown',async t=>{
  const home=fixture(t),live=uuid(1),other=uuid(2);write(home,live,content(live),10*day);const excluded=write(home,other,content(other),10*day);
  const bound=await watchOpens(()=>finish(metrics(home,{processReader:async()=>({codex:1,claude:0,liveSessionKeys:[key(live)]})})));
  a.equal(bound.value.sessions.length,1);a.equal(bound.value.sessions[0].processAlive,true);a.equal(bound.value.counts.active,1);a.equal(bound.value.oldConversations.total,1);a.ok(!bound.files.includes(excluded));
  const failed=await watchOpens(()=>finish(metrics(home,{processReader:async()=>{throw Error('Unavailable');}})));
  a.equal(failed.value.processes,null);a.equal(failed.value.sessions.length,0);a.equal(failed.value.oldConversations.total,2);a.equal(failed.files.length,0);
});

test('more than 200 selected conversations survive discovery, totals, output and warm cache',async t=>{
  const home=fixture(t);for(let n=0;n<215;n++)write(home,uuid(n),content(uuid(n)));
  const cold=await finish(metrics(home));a.equal(cold.sessions.length,215);a.equal(cold.totals.tokens,2150);a.equal(cold.progress.total,215);a.equal(cold.progress.done,215);
  const warm=await watchOpens(()=>finish(metrics(home)));a.equal(warm.files.length,0);a.equal(warm.value.cache.hits,215);a.equal(warm.value.sessions.length,215);a.equal(warm.value.totals.tokens,2150);
});

test('daily accumulated tokens are idempotent across refresh, narrowed scope and restart',async t=>{
  const home=fixture(t);write(home,uuid(1),content(uuid(1),10));write(home,uuid(2),content(uuid(2),80),2*day);
  const m=metrics(home);await m.setScopeDays(7);const broad=await finish(m);a.equal(broad.periods[0].codex,90);
  await m.setScopeDays(1);const narrow=await finish(m);a.equal(narrow.totals.tokens,10);a.equal(narrow.periods[0].codex,90);
  a.equal((await finish(m)).periods[0].codex,90);const restart=await finish(metrics(home));a.equal(restart.periods[0].codex,90);a.equal(restart.periods[1].codex,90);
  const cacheDir=path.join(home,'cache',fs.readdirSync(path.join(home,'cache'))[0]),saved=fs.readFileSync(path.join(cacheDir,'daily.json'),'utf8');
  a.doesNotMatch(saved,/payload|projects|message|cwd|Game/);
});

test('diary keeps per-conversation UTC day contributions, measured zero and unknown weighted usage',()=>{
  const ledger=new DailyUsage(),conversation=key('conversation');ledger.merge([{conversation,day:'2030-01-06',agent:'codex',tokens:100,weightedTokens:null},{conversation,day:'2030-01-07',agent:'codex',tokens:0,weightedTokens:null}]);
  ledger.merge([{conversation,day:'2030-01-06',agent:'codex',tokens:100,weightedTokens:null}]);const s=ledger.snapshot(now);
  a.equal(s.periods[0].codex,0);a.equal(s.periods[1].codex,100);a.equal(s.periods[0].claude,null);a.equal(s.periods[0].weightedTokens,null);
});

test('a copied Claude message does not recharge after the originating conversation leaves the scope',()=>{
  const ledger=new DailyUsage(),unit=key('shared-message');ledger.merge([{conversation:key('original'),unit,day:'2030-01-07',agent:'claude',tokens:50,weightedTokens:20}]);
  ledger.merge([{conversation:key('copy'),unit,day:'2030-01-07',agent:'claude',tokens:50,weightedTokens:20}]);
  a.equal(ledger.snapshot(now).periods[0].claude,50);a.equal(new DailyUsage(ledger.save()).snapshot(now).periods[0].claude,50);
});

test('a finished session or helper contributes no task delivery',()=>{
  const i=new UsageIndex();for(const [file,id,parent] of [['parent',uuid(1),null],['child',uuid(2),uuid(1)]]){i.consume('codex',file,line('session_meta',{id,model:'gpt-6.1-sol',source:parent?{subagent:{thread_spawn:{parent_thread_id:parent}}}:undefined}));i.consume('codex',file,line('event_msg',{type:'user_message',message:'Build the game menu'}));i.consume('codex',file,line('event_msg',{type:'task_complete'}));}
  const s=i.snapshot(now);a.equal(s.completedToday.length,0);a.equal(s.finishedSessions.length,2);a.equal(s.counts.finished,2);a.equal(s.deliveries,undefined);a.equal(s.sessions.find(row=>row.sessionKey===key(uuid(2))).parentKey,key(uuid(1)));
  const isolated=new UsageIndex(),file=path.join('projects',uuid(1),'subagents','agent-abc123.jsonl');isolated.consume('claude',file,JSON.stringify({type:'assistant',timestamp:'2030-01-07T11:59:00Z',message:{id:'helper-message',model:'claude-sonnet-4-6',usage:{input_tokens:10}}}));const helper=isolated.snapshot(now).sessions[0];a.equal(helper.helper,true);a.equal(helper.parentKey,null);
});

test('published session/count/period snapshot stays visible during reread; progress uses selected files only',async t=>{
  const home=fixture(t);for(let n=0;n<8;n++)write(home,uuid(n),content(uuid(n)),n<4?0:2*day);
  const m=metrics(home,{limits:{entries:2,bytes:4096,milliseconds:100}});await m.setScopeDays(7);const previous=await finish(m);
  await m.setScopeDays(1);await m.refresh();const pending=m.snapshot();a.equal(pending.pending,true);a.deepEqual(pending.sessions,previous.sessions);a.deepEqual(pending.counts,previous.counts);a.deepEqual(pending.periods,previous.periods);a.deepEqual(pending.previewSessions,[]);a.ok(pending.progress.done<=pending.progress.total);
  const final=await finish(m);a.equal(final.sessions.length,4);a.equal(final.progress.total,4);a.equal(final.progress.done,4);
});

test('quota preserves Codex windows, source and original read timestamp independently of session tokens',()=>{
  const i=new UsageIndex();i.consume('codex','sample',line('event_msg',{type:'token_count',rate_limits:{primary:{used_percent:25,window_minutes:300,resets_at:1894021200}},info:{total_token_usage:{total_tokens:50}}}));
  const s=i.snapshot(now);a.equal(s.codex.source,'rollout rate_limits');a.equal(s.quotaUpdated,'2030-01-07T11:59:00.000Z');a.equal(s.codex.windows[0].used,25);a.deepEqual(s.claude.windows,[]);
});

test('last 24h files are opened first when the 7-day selection is expanded',async t=>{
  const home=fixture(t);const old=write(home,uuid(1),content(uuid(1)),2*day),recent=write(home,uuid(2),content(uuid(2)));
  const m=metrics(home);await m.setScopeDays(7);const watched=await watchOpens(()=>finish(m));a.equal(watched.files[0],recent);a.ok(watched.files.includes(old));
});
