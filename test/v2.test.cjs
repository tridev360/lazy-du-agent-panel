const test=require('node:test'),a=require('node:assert/strict');
const C=require('../public/v2-core.js');
const {UsageIndex,readUsage}=require('../src/lib/usage.cjs');
const {metadata,publicMetadata}=require('../src/lib/agent-metadata.cjs');
test('missing tokens and breakdown never become invented zero water',()=>{
  a.equal(C.totalTokens([]),null);a.equal(C.water([]),null);a.equal(C.water([{tokens:100}]),null);a.deepEqual(C.cups(null),[]);
  a.equal(C.water([{weightedTokens:0}]),0);a.deepEqual(C.cups(0),[0]);
  a.equal(C.totalTokens([{tokens:100},{tokens:null}]),null);
});
test('water uses weighted tokens and bounds visual cups without rounding away the remainder',()=>{
  a.equal(C.water([{weightedTokens:1500}]),.3);a.deepEqual(C.cups(375),[1,.5]);a.equal(C.cups(5000).length,8);
});
test('recent metadata is not described as a working process',()=>{
  a.equal(C.agents({usage:{sessions:[{id:'a',agent:'codex',recent:true}]}})[0].state,'recent');
});
test('progress and deadline use recorded task data and exclude completed work',()=>{
  a.equal(C.progress([]),null);a.equal(C.progress([{phase:{percent:40}},{percent:100}]),70);
  const due={title:'check',deadlineAt:'2030-01-02T12:00:00Z',phase:{percent:40}};
  a.equal(C.nextDue([{deadlineAt:'2020-01-01T00:00:00Z',phase:{percent:100}},due]),due);
});
test('model, effort, project identity and tool names omit paths, text and tool arguments',()=>{
  let m=metadata(JSON.stringify({type:'session_meta',timestamp:'2030-01-02T12:00:00Z',payload:{cwd:'C:/private/person/project',model:'gpt-5.4',reasoning_effort:'high'}}));
  const line=JSON.stringify({type:'assistant',timestamp:'2030-01-02T12:01:00Z',message:{model:'claude-sonnet-4-6',content:[{type:'text',text:'PRIVATE_TEXT'},{type:'tool_use',id:'tool1',name:'Read',input:{file_path:'PRIVATE_PATH'}}]}});
  m=metadata(line,m);m=metadata(line,m);const view=publicMetadata(m);
  a.equal(view.effort,'high');a.equal(view.model,'claude-sonnet-4-6');a.deepEqual(view.tools,[{name:'Read',count:1}]);
  a.match(view.projectId,/^[a-f0-9]{8}$/);a.doesNotMatch(JSON.stringify(view),/private|person|PRIVATE/);
  a.equal(publicMetadata(metadata(JSON.stringify({payload:{model:'PRIVATE_TOKEN',effort:'PRIVATE'}}))).model,null);
});
test('Claude weighted usage deduplicates messages and survives repeated reads',()=>{
  const index=new UsageIndex(),stamp='2030-01-02T12:00:00Z';
  const line=JSON.stringify({type:'assistant',timestamp:stamp,cwd:'/workspace/game',message:{id:'m1',model:'claude-sonnet-4-6',usage:{input_tokens:100,output_tokens:20,cache_creation_input_tokens:30,cache_read_input_tokens:200}}});
  index.consume('claude','a',line);index.consume('claude','a',line);const s=index.snapshot(new Date(stamp)).sessions[0];
  a.equal(s.tokens,350);a.equal(s.weightedTokens,170);a.equal(s.model,'claude-sonnet-4-6');a.ok(s.projectId);
});
test('Codex cumulative breakdown does not count cached input as fresh input',()=>{
  const index=new UsageIndex();index.consume('codex','a',JSON.stringify({type:'event_msg',timestamp:'2030-01-02T12:00:00Z',payload:{type:'token_count',info:{total_token_usage:{total_tokens:150,input_tokens:100,output_tokens:50,cached_input_tokens:80}}}}));
  a.equal(index.snapshot().sessions[0].weightedTokens,78);
});
test('a later total without a breakdown clears a stale water estimate',()=>{
  let m=metadata(JSON.stringify({type:'event_msg',payload:{info:{total_token_usage:{total_tokens:150,input_tokens:100,output_tokens:50,cached_input_tokens:80}}}}));
  a.equal(publicMetadata(m).weightedTokens,78);
  m=metadata(JSON.stringify({type:'event_msg',payload:{info:{total_token_usage:{total_tokens:500}}}}),m);
  a.equal(publicMetadata(m).weightedTokens,null);
});
test('shipped example is a fictional game with bilingual decisions and no house labels',()=>{
  const d=require('../example.json');a.equal(d.tasks.length,6);a.equal(d.usage.sessions.length,3);a.ok(d.cards.every(x=>x.options.length===x.optionsPT.length));
  a.ok(d.tasks.every(x=>['Design','Gameplay'].includes(x.owner)));
  a.doesNotMatch(JSON.stringify(d),/[A-Z]:[\\/]|\/Users\/|\/home\//);
});
test('one small append completes when an open wait consumes the time slice',async t=>{
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'panel-append-')),file=path.join(dir,'fixture.jsonl');
  t.after(()=>{fs.unlinkSync(file);fs.rmdirSync(dir);});
  fs.writeFileSync(file,JSON.stringify({type:'assistant',timestamp:'2030-01-02T12:00:00Z',message:{id:'m',usage:{input_tokens:2,output_tokens:1}}})+'\n');
  const original=fs.promises.open,index=new UsageIndex();
  const budget={bytes:4096,capBytes:4096,read:0,deadline:performance.now()+10};
  fs.promises.open=async(...args)=>{const handle=await original(...args);await new Promise(r=>setTimeout(r,25));return handle;};
  try{
    await readUsage(file,'claude',index,{root:dir,budget});a.equal(index.snapshot().claude.tokens,3);a.ok(budget.read<=4096);
    const padding=JSON.stringify({type:'response_item',payload:{content:'fixture '.repeat(80)}})+'\n';
    const quota=JSON.stringify({type:'event_msg',timestamp:'2030-01-02T12:00:00Z',payload:{type:'token_count',rate_limits:{primary:{used_percent:42,window_minutes:10080}}}})+'\n';
    fs.writeFileSync(file,padding.repeat(1000)+quota);
    const latest=new UsageIndex(),tailBudget={bytes:65536,capBytes:65536,read:0,deadline:performance.now()+10};
    await readUsage(file,'codex',latest,{root:dir,budget:tailBudget,tail:true});
    a.equal(latest.snapshot().codex.windows[0].used,42);a.ok(tailBudget.read<=16384);
  }
  finally{fs.promises.open=original;}
});
