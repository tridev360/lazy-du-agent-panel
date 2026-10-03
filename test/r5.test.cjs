const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../public/v2-core.js'),{UsageIndex}=require('../src/lib/usage.cjs');
test('consumption totals include every read session, independent of portrait pagination',()=>{
  const index=new UsageIndex();for(let i=0;i<40;i++)index.consume('codex','sample-'+i,JSON.stringify({type:'event_msg',timestamp:'2030-01-01T12:00:00Z',payload:{type:'token_count',info:{total_token_usage:{total_tokens:100+i}}}}));
  const usage=index.snapshot(new Date('2030-01-01T12:01:00Z'));assert.equal(usage.sessions.length,40);assert.equal(usage.totals.sessions,40);assert.equal(usage.totals.tokens,4780);assert.deepEqual(C.usageTotals(usage),usage.totals);
});
test('metadata-only sessions never erase measured consumption or fabricate water',()=>{
  const usage={sessions:[{agent:'claude',tokens:100,weightedTokens:20},{agent:'codex',tokens:null,weightedTokens:null}]};
  assert.deepEqual(C.usageTotals(usage),{tokens:100,claude:100,codex:null,weightedTokens:20,sessions:2,known:1,weighted:1});assert.equal(C.usageTotals({}).tokens,null);assert.equal(C.usageTotals({}).weightedTokens,null);
});
test('Claude daily trend and cumulative totals use deduplicated message records',()=>{
  const index=new UsageIndex();const line=(id,day,tokens)=>JSON.stringify({type:'assistant',timestamp:day+'T12:00:00Z',message:{id,usage:{input_tokens:tokens,output_tokens:0,cache_read_input_tokens:0}}});
  index.consume('claude','sample',line('one','2030-01-01',10));index.consume('claude','sample',line('one','2030-01-01',10));index.consume('claude','sample',line('two','2030-01-02',20));const usage=index.snapshot();assert.equal(usage.totals.claude,30);assert.deepEqual(usage.daily,[{day:'2030-01-02',tokens:20},{day:'2030-01-01',tokens:10}]);
});
