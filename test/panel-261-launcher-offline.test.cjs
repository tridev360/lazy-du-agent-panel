'use strict';
const test=require('node:test'),a=require('node:assert/strict');
const {launch,isReady}=require('../src/open.cjs'),{createServer,checkUpdate}=require('../src/panel.cjs'),{version}=require('../package.json');
const child=()=>({on(){return this;},unref(){this.detached=true;}});
test('existing same panel opens its link and never starts another server',async()=>{
  const calls=[],logs=[];await launch(['--lang','pt'],{ready:async()=>true,spawnProcess:(cmd,args,opts)=>{calls.push({cmd,args,opts});return child();},log:x=>logs.push(x)});
  a.equal(calls.length,1);a.ok(!calls[0].args.includes('--port'));a.match(logs[0],/já está aberto/);
});
test('launcher starts one detached server, reports safe terminal close in all three languages',async()=>{
  for(const lang of ['en','pt','es']){let checks=0;const calls=[],logs=[];await launch(['--no-browser','--offline','--lang',lang],{ready:async()=>checks++>0,spawnProcess:(cmd,args,opts)=>{calls.push({cmd,args,opts});return child();},pause:async()=>{},log:x=>logs.push(x)});
    a.equal(calls.length,1);a.equal(calls[0].opts.detached,true);a.equal(calls[0].opts.windowsHide,true);a.ok(calls[0].args.includes('--offline'));a.match(logs[0],lang==='pt'?/Pode fechar este terminal/:lang==='es'?/Puedes cerrar esta terminal/:/You can close this terminal/);
  }
});
test('offline launcher rejects an online instance without spawning or killing it',async()=>{
  let spawned=0;await a.rejects(launch(['--offline','--lang','pt'],{ready:async(_,options)=>!options?.offline,spawnProcess:()=>{spawned++;return child();},log:()=>{}}),/Feche o painel atual/);a.equal(spawned,0);
});
test('version check makes one public bounded GET only when called, compares versions and preserves offline',async()=>{
  let calls=0;const fetcher=async(url,options)=>{calls++;a.equal(url,'https://raw.githubusercontent.com/tridev360/lazy-du-agent-panel/main/package.json');a.equal(options.method,'GET');a.equal(options.credentials,'omit');return new Response(JSON.stringify({version:'99.0.0'}));};
  const offline=await checkUpdate({offline:true,fetcher});a.equal(offline.offline,true);a.equal(calls,0);
  const result=await checkUpdate({fetcher});a.equal(result.currentVersion,version);a.equal(result.latestVersion,'99.0.0');a.equal(result.updateAvailable,true);a.equal(calls,1);
  a.equal((await checkUpdate({fetcher:async()=>new Response('x'.repeat(100)),maxBytes:20})).ok,false);
  a.equal((await checkUpdate({fetcher:async()=>new Response(JSON.stringify({version:'not-version'}))})).ok,false);
  a.equal((await checkUpdate({fetcher:async(_,options)=>new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Error('timeout')))),timeoutMs:10})).ok,false);
});
async function start(t,options){const server=createServer({...options,demoOnly:true,profile:'fixture-profile'});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));return 'http://127.0.0.1:'+server.address().port;}
test('offline server advertises offline before rendering and blocks news and update connections',async t=>{
  let external=0;const base=await start(t,{offline:true,newsFetch:()=>{external++;throw Error('network');},updateFetch:()=>{external++;throw Error('network');}});
  const health=await(await fetch(base+'/api/health')).json();a.equal(health.offline,true);a.equal(await isReady(new URL(base).port,{offline:true}),true);
  const page=await fetch(base+'/');a.match(await page.text(),/data-offline="true"/);a.match(page.headers.get('content-security-policy'),/frame-src 'none'/);
  a.equal((await(await fetch(base+'/api/status')).json()).offline,true);a.equal((await(await fetch(base+'/api/news')).json()).offline,true);a.equal((await(await fetch(base+'/api/update-check')).json()).offline,true);a.equal(external,0);
});
test('opening online health and example makes no version request, explicit route makes one',async t=>{
  let calls=0;const base=await start(t,{updateFetch:async()=>{calls++;return new Response(JSON.stringify({version}));}});
  await fetch(base+'/api/health');await fetch(base+'/api/status');await fetch(base+'/');a.equal(calls,0);a.equal((await(await fetch(base+'/api/update-check')).json()).updateAvailable,false);a.equal(calls,1);
});
