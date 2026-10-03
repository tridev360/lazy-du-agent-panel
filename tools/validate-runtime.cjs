'use strict';
// Isolated public validation with optional compressed baseline source for a server CPU comparison.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawnSync,fork}=require('node:child_process');
const args=process.argv.slice(2),value=key=>args.includes(key)?args[args.indexOf(key)+1]:null;
const root=path.resolve(__dirname,'..');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function serverFactory(baseline){
  if(!baseline)return require('../src/panel.cjs').createServer;
  const Module=require('node:module'),source=require('node:zlib').gunzipSync(Buffer.from(baseline,'base64')).toString('utf8');
  const filename=path.join(root,'src/panel.cjs'),loaded=new Module(filename,module);
  loaded.filename=filename;loaded.paths=Module._nodeModulePaths(path.dirname(filename));loaded._compile(source,filename);
  return loaded.exports.createServer;
}
function fixture(){return {index:{},published:{},last:Date.now(),running:false,pending:false,scopeDays:1,scopeRevision:0,snapshot(){return {ready:true,sessions:[{id:'synthetic',agent:'codex'}],payload:'synthetic metadata '.repeat(60000)};}};}
async function cpuChild(){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'panel-cpu-')),server=serverFactory(value('--baseline-gzip'))({profile,metrics:fixture(),board:{snapshot:()=>({tasks:[],queue:[],board:{connected:true}})}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let start,clock;
  process.on('message',async message=>{
    if(message==='start'){start=process.cpuUsage();clock=process.hrtime.bigint();process.send({started:true});}
    if(message==='end'){const cpu=process.cpuUsage(start),wallMs=Number(process.hrtime.bigint()-clock)/1e6;process.send({cpu,wallMs,oneCorePercent:(cpu.user+cpu.system)/1000/wallMs*100});}
    if(message==='close'){await new Promise(resolve=>server.close(resolve));fs.rmSync(profile,{recursive:true,force:true});process.exit(0);}
  });process.send({url:'http://127.0.0.1:'+server.address().port});
}
function nextMessage(child){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('CPU worker timeout')),15000);child.once('message',message=>{clearTimeout(timer);resolve(message);});child.once('error',error=>{clearTimeout(timer);reject(error);});});}
async function cpuSample(baseline){
  const child=fork(__filename,['--cpu-child',...(baseline?['--baseline-gzip',baseline]:[])],{cwd:root,stdio:['ignore','ignore','pipe','ipc']});
  try{const {url}=await nextMessage(child);await(await fetch(url+'/api/status')).arrayBuffer();
    const started=nextMessage(child);child.send('start');await started;const start=performance.now();let requests=0;
    for(let i=0;i<50;i++){await sleep(Math.max(0,start+i*100-performance.now()));const response=await fetch(url+'/api/status',{headers:{'accept-encoding':'gzip'}});assert.equal(response.status,200);await response.arrayBuffer();requests++;}
    await sleep(Math.max(0,start+5000-performance.now()));const result=nextMessage(child);child.send('end');const receipt=await result;return {requests,...receipt};
  }finally{if(child.connected)child.send('close');setTimeout(()=>{if(child.exitCode===null)child.kill();},1000).unref();}
}
async function main(){
  const out=path.resolve(process.env.SAIDA||process.env.OUTPUT_DIR||value('--out')||'validation-output');fs.mkdirSync(out,{recursive:true});
  const playwrightPath=value('--playwright');if(value('--browser-cache'))process.env.PLAYWRIGHT_BROWSERS_PATH=value('--browser-cache');
  const playwright=require(playwrightPath||'playwright-core'),browserPath=playwright.chromium.executablePath();
  if(!fs.existsSync(browserPath))throw Error('Existing Chromium executable is unavailable');
  const validation=spawnSync(process.execPath,[path.join(__dirname,'validate-public.cjs'),'--out',out,'--browser',browserPath,...(playwrightPath?['--playwright',playwrightPath]:[])],{cwd:root,stdio:'inherit',env:{...process.env,OUTPUT_DIR:out}});
  if(validation.status!==0)throw Error('Public validation failed: '+validation.status);
  const delta=spawnSync(process.execPath,[path.join(__dirname,'validate-211-delta.cjs'),'--out',out,'--browser',browserPath,...(playwrightPath?['--playwright',playwrightPath]:[])],{cwd:root,stdio:'inherit',env:{...process.env,OUTPUT_DIR:out}});
  if(delta.status!==0)throw Error('2.1.1 interaction validation failed: '+delta.status);
  const metrics=[],baseline=value('--baseline-gzip');
  if(baseline)for(const mode of ['baseline','candidate'])metrics.push({mode,sample:await cpuSample(mode==='baseline'?baseline:null)});
  fs.writeFileSync(path.join(out,'cpu-server.json'),JSON.stringify({scope:'Synthetic local HTTP workload, server child process only, 50 gzip requests during 5 seconds per sample',baselineRef:value('--baseline-ref'),samples:metrics},null,2)+'\n');
  const browser=await playwright.chromium.launch({executablePath:browserPath,headless:true,args:['--no-sandbox']});
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'panel-layout-')),server=serverFactory(null)({profile,demoOnly:true,metrics:{snapshot(){throw Error('Example only');}}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port,layouts=[];
  try{for(const width of [375,768,1099,1100,1280]){
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),page=await context.newPage();
    await page.goto(url+'/?example=1&size=large&lang=es');await page.waitForSelector('#home-stage .du-agent');assert.equal(await page.locator('#version-trigger').textContent(),'v'+require('../package.json').version);await page.click('#tab-team');await page.waitForSelector('#look-team .look-node[data-type=hub]');
    const reading=await page.evaluate(()=>{const nodes=[...document.querySelectorAll('#look-team .look-node[data-type=hub]')].map(node=>{const r=node.getBoundingClientRect();return {name:node.textContent.trim(),x:r.x,y:r.y,right:r.right,bottom:r.bottom};});return {viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,nodes};});
    assert.equal(reading.overflow,false);assert.equal(reading.nodes.length,2);assert.ok(reading.nodes.every(node=>node.x>=0&&node.right<=width),'Both AI hubs fit '+width);
    assert.equal(Math.abs(reading.nodes[0].y-reading.nodes[1].y)<2,width>=1100,'Responsive AI layout '+width);
    await page.screenshot({path:path.join(out,'team-es-'+width+'-responsive.png'),fullPage:true});layouts.push(reading);await context.close();
  }}finally{await browser.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(profile,{recursive:true,force:true});}
  fs.writeFileSync(path.join(out,'responsive.json'),JSON.stringify({ok:true,layouts},null,2)+'\n');console.log('Runtime validation and responsive captures passed.');
}
(value('--cpu-child')!==null||args.includes('--cpu-child')?cpuChild():main()).catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
