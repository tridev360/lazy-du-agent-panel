'use strict';
const test=require('node:test'),a=require('node:assert/strict');
const {createReadSnapshot}=require('../src/lib/read-snapshot.cjs');
const {syncOwnedAnimations,W}=require('../public/look-team.js');
const {createServer}=require('../src/panel.cjs');
test('snapshot reuses parsing and serialization until revision changes',()=>{
  let reads=0,serializations=0;const memo=createReadSnapshot(),build=()=>{reads++;return {get count(){serializations++;return reads;}};};
  const first=memo.read([1],build);a.equal(memo.read([1],build),first);a.equal(reads,1);a.equal(serializations,1);
  a.notEqual(memo.read([2],build),first);a.equal(reads,2);memo.invalidate();memo.read([2],build);a.equal(reads,3);
});
test('board deadline and Buffer memo preserve bounded freshness without serializing binary data',()=>{
  let now=0,reads=0;const memo=createReadSnapshot({ttl:1000,clock:()=>now,serialize:false});const build=()=>{reads++;return Buffer.from('status');};
  const first=memo.read([],build);now=999;a.equal(memo.read([],build),first);a.equal(first.json,null);now=1000;a.notEqual(memo.read([],build),first);a.equal(reads,2);
});
test('hidden and Motion off pause owned running animations and never resume prepaused ones',()=>{
  const animation=state=>({playState:state,pauses:0,plays:0,pause(){this.pauses++;this.playState='paused';},play(){this.plays++;this.playState='running';}});
  const running=animation('running'),prepaused=animation('paused'),ended=animation('finished'),owned=new Set();
  syncOwnedAnimations([running,prepaused,ended],true,owned);syncOwnedAnimations([running,prepaused,ended],true,owned);a.equal(running.pauses,1);a.equal(prepaused.pauses,0);
  syncOwnedAnimations([running,prepaused,ended],false,owned);a.equal(running.plays,1);a.equal(prepaused.plays,0);a.equal(owned.size,0);
  syncOwnedAnimations([running],true,owned);running.playState='idle';syncOwnedAnimations([],false,owned);a.equal(running.plays,1);
  a.equal(W.es.tl.model,'Modelo');
});
async function start(t,options){const server=createServer({...options,profile:'not-a-profile',demoOnly:false});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));return 'http://127.0.0.1:'+server.address().port;}
test('status reuses large usage JSON while invalidating scope and board updates',async t=>{
  let usageReads=0,boardReads=0,serializations=0;const metrics={index:{},last:Date.now(),running:false,pending:false,scopeDays:1,scopeRevision:0,published:{},snapshot(){usageReads++;return {ready:true,sessions:[{id:'fixture'}],scopeDays:this.scopeDays,get payload(){serializations++;return 'fixture'.repeat(400);}};},async setScopeDays(days){this.scopeDays=days;this.scopeRevision++;}};
  const board={snapshot(){boardReads++;return {tasks:[],queue:[],board:{connected:true}};},connect(){}};
  const base=await start(t,{metrics,board});
  const first=await fetch(base+'/api/status');a.equal(first.status,200);const firstBody=await first.json();
  const next=await fetch(base+'/api/status');a.deepEqual(await next.json(),firstBody);a.equal(usageReads,1);a.equal(boardReads,1);a.equal(serializations,1);
  let res=await fetch(base+'/api/scope',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:JSON.stringify({days:3})});a.equal(res.status,200);
  res=await fetch(base+'/api/status');a.equal((await res.json()).usage.scopeDays,3);a.equal(usageReads,2);a.equal(boardReads,2);
  res=await fetch(base+'/api/board',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:JSON.stringify({folder:'fixture'})});a.equal(res.status,200);await (await fetch(base+'/api/status')).json();a.equal(usageReads,3);a.equal(boardReads,3);
  metrics.published={};await (await fetch(base+'/api/status')).json();a.equal(usageReads,4);
});
test('example bypasses metadata and keeps live memo separate',async t=>{
  let reads=0;const base=await start(t,{metrics:{get running(){reads++;throw Error('forbidden');}},board:{snapshot(){reads++;throw Error('forbidden');}}});
  a.equal((await fetch(base+'/api/status?example=1')).status,200);a.equal(reads,0);
});

test('team fits both families side by side at 1100 and 1280 and stacks below 1100',()=>{
  const {graph,layout}=require('../public/look-team.js');
  const sessions=['claude','codex'].flatMap(agent=>Array.from({length:8},(_,i)=>({id:agent+i,agent,state:'working'})));const g=graph(sessions,()=>null);
  for(const viewport of [375,768,1099,1100,1280]){const stacked=viewport<1100,L=layout(g,{maxWidth:viewport-48,stacked,...(viewport<=600?{nodeW:172,gapX:14,pad:16}: {})}),claude=L.pos.get('hub-claude'),codex=L.pos.get('hub-codex');
    a.equal(L.width,viewport-48);if(stacked){a.equal(claude.x,codex.x);a.ok(codex.y>=L.colY.claude+L.colH.claude);}else{a.equal(claude.y,codex.y);a.ok(codex.x>claude.x);}
    const boxes=[...L.pos.values()];for(const box of boxes){a.ok(box.x>=0&&box.x+box.w<=L.width);a.ok(box.y>=0&&box.y+box.h<=L.height);}
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const x=boxes[i],y=boxes[j];a.ok(x.x+x.w<=y.x||y.x+y.w<=x.x||x.y+x.h<=y.y||y.y+y.h<=x.y);}
    for(const edge of g.edges){a.ok(L.pos.has(edge.from));a.ok(L.pos.has(edge.to));}
  }
});
