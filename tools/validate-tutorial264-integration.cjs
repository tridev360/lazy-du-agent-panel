'use strict';
// Synthetic composition proof. Execute only with official VPS render and an exact frozen candidate.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict'),vm=require('node:vm');
const args=process.argv.slice(2),arg=n=>args[args.indexOf(n)+1],mutation=args.includes('--mutation-check');
const root=path.resolve(__dirname,'..'),out=process.env.SAIDA;
if(process.platform!=='linux'||!out)throw Error('Official VPS render required');
fs.mkdirSync(out,{recursive:true});
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const report={synthetic:true,realMedia:false,realApproval:false,ok:false,tests:null,cases:[],http:[],externalRequests:[],pageErrors:[],assetFailures:[],mutation:null,sourceHashes:{}};
const sources=['src/panel.cjs','src/tutorial-manifest.cjs','public/index.html','public/welcome.js','public/onboarding22.js','public/tutorial264.js','public/tutorial264.css','public/tutorial-manifest.js'];
for(const p of sources)report.sourceHashes[p]=sha(path.join(root,p));
let browser;const servers=[],contexts=[],temps=[];
async function serve(options={}){const profile=fs.mkdtempSync(path.join(os.tmpdir(),'tutorial264-composition-'));temps.push(profile);const server=require(path.join(root,'src/panel.cjs')).createServer({demoOnly:true,offline:true,profile,...options});servers.push(server);await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port;}
async function getManifest(origin){const res=await fetch(origin+'/tutorial-manifest.js');assert.equal(res.status,200);assert.match(res.headers.get('content-type'),/text\/javascript/);assert.equal(res.headers.get('cache-control'),'no-store');const text=await res.text(),sandbox={};sandbox.window=sandbox;sandbox.globalThis=sandbox;vm.runInNewContext(text,sandbox,{timeout:1000});assert.equal(sandbox.PanelTutorialManifest.version,1);return {manifest:JSON.parse(JSON.stringify(sandbox.PanelTutorialManifest)),text};}
async function setup(origin,lang,width,seed=true){
 const context=await browser.newContext({viewport:{width,height:1000},locale:lang==='pt'?'pt-BR':lang==='es'?'es-ES':'en-US',reducedMotion:'reduce',serviceWorkers:'block'});contexts.push(context);
 const page=await context.newPage();page.setDefaultTimeout(10000);const requests=[];
 page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('request',r=>requests.push({path:new URL(r.url()).pathname,type:r.resourceType()}));
 page.on('response',r=>{if(r.status()>=400&&!new URL(r.url()).pathname.startsWith('/api/'))report.assetFailures.push({path:new URL(r.url()).pathname,status:r.status()});});
 await context.route('**/*',r=>{if(new URL(r.request().url()).origin===origin)return r.continue();report.externalRequests.push({type:r.request().resourceType(),origin:new URL(r.request().url()).origin});return r.abort();});
 await context.addInitScript(seed=>{localStorage.setItem('agent-panel-motion','off');if(seed)localStorage.setItem('agent-panel-profile',JSON.stringify({version:2,mode:'explorer',size:'large',goal:'finish'}));},seed);
 await page.goto(origin+'/?'+(seed?'example=1&size=large&':'')+'lang='+lang,{waitUntil:'load'});
 await page.waitForFunction(()=>document.body.dataset.panelMounted==='true');
 assert.equal(await page.locator('#lofi-player iframe').count(),0,'No Lofi connection before user gesture');
 return {context,page,requests};
}
async function screen(page,name,lang,width){
 const dimensions=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,view:document.body.dataset.view,welcome:document.body.dataset.welcome||null}));
 assert.equal(dimensions.overflow,false,name+' page overflow');
 const file=lang+'-'+width+'-'+name+'.png';await page.screenshot({path:path.join(out,file),fullPage:true});return {file,...dimensions};
}
async function openClose(page,entry,method='escape'){
 const trigger=page.locator('[data-panel-tutorial="'+entry+'"]:visible');assert.equal(await trigger.count(),1,'Exactly one integrated trigger '+entry);
 assert.equal(await trigger.textContent(),'Ver como começar (2 s)');
 await trigger.scrollIntoViewIfNeeded();await trigger.focus();
 const before=await page.evaluate(()=>({x:scrollX,y:scrollY,view:document.body.dataset.view,welcome:document.body.dataset.welcome||null,firstHidden:document.getElementById('first-steps').hidden,motion:document.getElementById('motion').getAttribute('aria-pressed')}));
 await trigger.click();const video=page.locator('#panel-tutorial-dialog video');
 await video.evaluate(e=>new Promise((resolve,reject)=>{if(e.readyState>=1)return resolve();e.addEventListener('loadedmetadata',resolve,{once:true});e.addEventListener('error',()=>reject(Error('Fixture metadata failed')),{once:true});}));
 const media=await video.evaluate(e=>({paused:e.paused,autoplay:e.autoplay,controls:e.controls,duration:e.duration,language:e.querySelector('track')?.srclang,selected:e.querySelector('track')?.default}));
 assert.deepEqual(media,{paused:true,autoplay:false,controls:true,duration:2.4,language:'pt',selected:true});
 await video.evaluate(e=>e.play());assert.equal(await video.evaluate(e=>e.paused),false,'Manual play works');
 if(method==='close')await page.locator('.tutorial264-close').click();else await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.getElementById('panel-tutorial-dialog').open);
 assert.equal(await video.evaluate(e=>e.paused&&!e.hasAttribute('src')&&!e.querySelector('track')),true,'Close unloads media');
 assert.equal(await trigger.evaluate(e=>document.activeElement===e),true,'Close restores opener focus');
 const after=await page.evaluate(()=>({x:scrollX,y:scrollY,view:document.body.dataset.view,welcome:document.body.dataset.welcome||null,firstHidden:document.getElementById('first-steps').hidden,motion:document.getElementById('motion').getAttribute('aria-pressed')}));
 assert.deepEqual(after,before,'Close preserves screen scroll and Motion state');return media;
}
async function rerenderDuringPlayer(page,entry){
 const trigger=page.locator('[data-panel-tutorial="'+entry+'"]:visible');assert.equal(await trigger.count(),1);
 await trigger.scrollIntoViewIfNeeded();await trigger.focus();
 const before=await page.evaluate(()=>({x:scrollX,y:scrollY,view:document.body.dataset.view,welcome:document.body.dataset.welcome||null,at:Date.now()}));
 await trigger.evaluate(e=>window.__tutorial264PreviousOpener=e);await trigger.click();
 const video=page.locator('#panel-tutorial-dialog video');
 await video.evaluate(e=>new Promise((resolve,reject)=>{if(e.readyState>=1)return resolve();e.addEventListener('loadedmetadata',resolve,{once:true});e.addEventListener('error',()=>reject(Error('Rerender fixture metadata failed')),{once:true});}));
 await video.evaluate(e=>e.play());assert.equal(await video.evaluate(e=>e.paused),false,'Player is running before '+entry+' rerender');
 const rendererReturnedAt=await page.evaluate(entry=>{
  const snapshot=PanelV2.state().snapshot;
  if(entry==='welcome')PanelWelcome.render(snapshot,'pt');
  else{const guidance=snapshot.guidance||{},onboarding=guidance.onboarding||{};PanelOnboarding.update({...snapshot,guidance:{...guidance,onboarding:{...onboarding,projectName:'Synthetic refreshed project'}}},'pt');}
  return Date.now();
 },entry);
 await page.waitForFunction(()=>!document.getElementById('panel-tutorial-dialog').open);
 const after=await page.evaluate(entry=>{
  const previous=window.__tutorial264PreviousOpener,newTrigger=document.querySelector('[data-panel-tutorial="'+entry+'"]'),video=document.querySelector('#panel-tutorial-dialog video');
  const result={x:scrollX,y:scrollY,view:document.body.dataset.view,welcome:document.body.dataset.welcome||null,at:Date.now(),previousDisconnected:!previous?.isConnected,newOpenerFocused:document.activeElement===newTrigger,paused:video.paused,srcRemoved:!video.hasAttribute('src'),trackRemoved:!video.querySelector('track'),dialogOpen:document.getElementById('panel-tutorial-dialog').open};
  delete window.__tutorial264PreviousOpener;return result;
 },entry);
 assert.equal(after.previousDisconnected,true,'Renderer actually replaced opening trigger');
 assert.equal(after.newOpenerFocused,true,'New '+entry+' opener inherits focus');
 assert.equal(after.paused,true);assert.equal(after.srcRemoved,true);assert.equal(after.trackRemoved,true);assert.equal(after.dialogOpen,false);
 for(const key of ['x','y','view','welcome'])assert.equal(after[key],before[key],entry+' active rerender preserves '+key);
 report.cases.push({kind:'rerender-during-playback',entry,before,rendererReturnedAt,after});
}

async function completeDuringPlayer(page){
 const trigger=page.locator('[data-panel-tutorial="first-steps"]:visible');assert.equal(await trigger.count(),1);
 await trigger.scrollIntoViewIfNeeded();await trigger.focus();
 const before=await page.evaluate(()=>({x:scrollX,y:scrollY,view:document.body.dataset.view,locale:document.documentElement.lang,at:Date.now()}));
 await trigger.evaluate(e=>window.__tutorial264CompletionOpener=e);await trigger.click();const video=page.locator('#panel-tutorial-dialog video');
 await video.evaluate(e=>new Promise((resolve,reject)=>{if(e.readyState>=1)return resolve();e.addEventListener('loadedmetadata',resolve,{once:true});e.addEventListener('error',()=>reject(Error('Completion fixture metadata failed')),{once:true});}));
 await video.evaluate(e=>e.play());assert.equal(await video.evaluate(e=>e.paused),false,'Player runs before completing all steps');
 const completedAt=await page.evaluate(()=>{
  const snapshot=PanelV2.state().snapshot,guidance=snapshot.guidance||{},onboarding=guidance.onboarding||{};
  PanelOnboarding.update({...snapshot,example:false,guidance:{...guidance,onboarding:{...onboarding,projectKey:null,steps:{running:true,rules:true,newSession:true,task:true,decision:true}}}},'pt');
  return Date.now();
 });
 await page.waitForFunction(()=>!document.getElementById('panel-tutorial-dialog').open);
 const after=await page.evaluate(()=>{
  const v=document.querySelector('#panel-tutorial-dialog video'),menu=document.getElementById('first-steps-menu'),card=document.getElementById('first-steps');
  return {x:scrollX,y:scrollY,view:document.body.dataset.view,locale:document.documentElement.lang,at:Date.now(),focusId:document.activeElement.id,focusTag:document.activeElement.tagName,focusTutorialEntry:document.activeElement.dataset.panelTutorial||null,focusText:document.activeElement.textContent.slice(0,100),previousFocused:document.activeElement===window.__tutorial264CompletionOpener,previousConnected:window.__tutorial264CompletionOpener?.isConnected||false,focusConnected:document.activeElement.isConnected,bodyFocused:document.activeElement===document.body,menuFocused:document.activeElement===menu,menuVisible:menu.checkVisibility({checkVisibilityCSS:true}),detailsOpen:menu.closest('details')?.open??null,completeSummary:card.classList.contains('first-complete'),paused:v.paused,srcRemoved:!v.hasAttribute('src'),trackRemoved:!v.querySelector('track')};
 });
 const record={kind:'complete-five-during-playback',before,completedAt,after,delayed:null};report.cases.push(record);
 record.photo=await screen(page,'five-complete-focus','pt',375);
 assert.equal(after.completeSummary,true,'Actual completion summary branch ran');
 assert.equal(after.menuFocused,true,'Completion restores first steps menu focus');assert.equal(after.focusConnected,true);assert.equal(after.bodyFocused,false);assert.equal(after.menuVisible,true);
 assert.equal(after.paused,true);assert.equal(after.srcRemoved,true);assert.equal(after.trackRemoved,true);
 for(const key of ['x','y','view','locale'])assert.equal(after[key],before[key],'Five-of-five preserves '+key);
 await page.waitForFunction(()=>document.getElementById('first-steps').hidden,null,{timeout:5500});
 const delayed=await page.evaluate(()=>({focusId:document.activeElement.id,focusConnected:document.activeElement.isConnected,bodyFocused:document.activeElement===document.body,menuFocused:document.activeElement===document.getElementById('first-steps-menu'),at:Date.now()}));
 record.delayed=delayed;
 assert.equal(delayed.menuFocused,true,'Delayed summary hide preserves meaningful focus');assert.equal(delayed.bodyFocused,false);assert.equal(delayed.focusConnected,true);
 await page.evaluate(()=>delete window.__tutorial264CompletionOpener);
}

async function main(){
 const pwpath=arg('--playwright'),cache=arg('--browser-cache');if(!pwpath||!cache)throw Error('Fixed official browser cache required');process.env.PLAYWRIGHT_BROWSERS_PATH=cache;
 if(!mutation){
  const files=fs.readdirSync(path.join(root,'test')).filter(f=>f.endsWith('.test.cjs')).map(f=>'test/'+f);
  const gate=cp.spawnSync(process.execPath,['--test','--test-concurrency=1',...files],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
  fs.writeFileSync(path.join(out,'public-composition-tests.txt'),(gate.stdout||'')+(gate.stderr||''));assert.equal(gate.status,0,'Full public panel composition suite');report.tests=Number((gate.stdout||'').match(/# pass (\d+)/)?.[1]);assert.ok(report.tests>0);
 }
 const {chromium}=require(pwpath);browser=await chromium.launch({channel:'chromium',headless:true,chromiumSandbox:false,args:['--no-sandbox','--disable-dev-shm-usage']});
 if(mutation){
  const origin=await serve(),{page}=await setup(origin,'pt',375);
  assert.equal(await page.evaluate(()=>typeof window.PanelTutorial),'object','MUTATION_MISSING_TUTORIAL_LOADER');return;
 }
 const origin=await serve(),closed=await getManifest(origin);assert.deepEqual(closed.manifest.tutorials,{});report.http.push('Default manifest closed and no-store');
 for(const lang of ['en','pt','es']){
  const {context,page,requests}=await setup(origin,lang,375);assert.equal(await page.locator('[data-panel-tutorial]:visible').count(),0);
  await page.evaluate(()=>PanelWelcome.show());assert.equal(await page.locator('[data-panel-tutorial]:visible').count(),0);
  assert.equal(requests.some(r=>/\.(mp4|vtt)$/.test(r.path)),false);report.cases.push({kind:'closed-boot',lang,mediaRequests:0,lofiFrames:0});await context.close();
 }
 const assets=path.join(out,'synthetic-assets'),folder=path.join(assets,'tutorial-painel');fs.mkdirSync(folder,{recursive:true});
 const movie=path.join(folder,'fixture-pt.mp4'),vtt=path.join(folder,'fixture-pt.vtt');
 const ff=cp.spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=0x253143:s=480x270:r=15','-t','2.4','-an','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-movflags','+faststart',movie],{encoding:'utf8'});assert.equal(ff.status,0,'Synthetic media generation');
 const caption='WEBVTT\n\n00:00.000 --> 00:02.000\nLegenda fictícia para testar a composição.\n';fs.writeFileSync(vtt,caption);
 const release={locale:'pt',videoSrc:'/tutorial-painel/fixture-pt.mp4',subtitleSrc:'/tutorial-painel/fixture-pt.vtt',approval:{approvedByOwner:true,approvedAtUtc:'2026-10-03T00:00:00Z',videoSha256:sha(movie),subtitleSha256:sha(vtt)}};
 const fixtureOrigin=await serve({tutorialOptions:{publicDir:assets,releases:[release],enabledLocales:['pt']}});
 const valid=await getManifest(fixtureOrigin);assert.equal(valid.manifest.tutorials.pt.durationSeconds,2.4);report.fixture={durationSeconds:2.4,videoBytes:fs.statSync(movie).size,videoSha256:sha(movie),subtitleSha256:sha(vtt)};report.http.push('Fresh PT fixture manifest supersedes closed static asset');
 fs.appendFileSync(vtt,'\nAltered fixture');assert.deepEqual((await getManifest(fixtureOrigin)).manifest.tutorials,{});assert.equal((await fetch(fixtureOrigin+release.subtitleSrc)).status,404);fs.writeFileSync(vtt,caption);assert.ok((await getManifest(fixtureOrigin)).manifest.tutorials.pt);report.http.push('Hash alteration closes manifest and blocks media on actual HTTP route');
 fs.renameSync(movie,movie+'.held');assert.deepEqual((await getManifest(fixtureOrigin)).manifest.tutorials,{});assert.equal((await fetch(fixtureOrigin+release.videoSrc)).status,404);fs.renameSync(movie+'.held',movie);assert.ok((await getManifest(fixtureOrigin)).manifest.tutorials.pt);report.http.push('Missing media closes manifest on next page load');
 for(const lang of ['en','pt'])for(const width of [375,768,1100,1280,1440]){
  const {context,page,requests}=await setup(fixtureOrigin,lang,width);
  assert.equal(requests.some(r=>/\.(mp4|vtt)$/.test(r.path)),false,'Boot does not request media');await page.locator('#first-steps:visible').waitFor();
  const photos=[await screen(page,'first-steps',lang,width)];assert.equal(await page.locator('[data-panel-tutorial=first-steps]:visible').count(),lang==='pt'?1:0);
  if(lang==='pt'){
   await openClose(page,'first-steps','escape');await page.locator('[data-panel-tutorial=first-steps]').click();await page.locator('#panel-tutorial-dialog[open]').waitFor();
   const box=await page.locator('#panel-tutorial-dialog').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);photos.push(await screen(page,'tutorial-player',lang,width));await page.keyboard.press('Escape');
  }
  await page.evaluate(()=>PanelWelcome.show());await page.locator('#welcome:visible').waitFor();photos.push(await screen(page,'welcome',lang,width));
  assert.equal(await page.locator('[data-panel-tutorial=welcome]:visible').count(),lang==='pt'?1:0);
  if(lang==='pt')await openClose(page,'welcome','close');
  const widgets=await page.evaluate(()=>({welcome:document.querySelectorAll('[data-panel-tutorial=welcome]').length,firstSteps:document.querySelectorAll('[data-panel-tutorial=first-steps]').length}));
  assert.ok(widgets.welcome<=1&&widgets.firstSteps<=1,'No duplicate integration widgets');
  if(lang==='pt'&&width===375){
   await rerenderDuringPlayer(page,'welcome');
   await page.evaluate(()=>{PanelWelcome.useGuidedSetup();PanelV2.select('home',true);});await page.locator('#first-steps:visible').waitFor();
   await rerenderDuringPlayer(page,'first-steps');
   await completeDuringPlayer(page);
   await page.evaluate(()=>PanelWelcome.show());await page.locator('#welcome:visible').waitFor();
   await page.locator('[data-language=es]').evaluate(e=>e.click());await page.waitForFunction(()=>document.documentElement.lang==='es');assert.equal(await page.locator('[data-panel-tutorial]:visible').count(),0);
   await page.locator('[data-language=en]').evaluate(e=>e.click());await page.waitForFunction(()=>document.documentElement.lang==='en');assert.equal(await page.locator('[data-panel-tutorial]:visible').count(),0);
   await page.locator('[data-language=pt]').evaluate(e=>e.click());await page.waitForFunction(()=>document.documentElement.lang==='pt');assert.equal(await page.locator('[data-panel-tutorial=welcome]:visible').count(),1);
   await page.evaluate(()=>PanelWelcome.render(PanelV2.state().snapshot,'pt'));assert.equal(await page.locator('[data-panel-tutorial=welcome]').count(),1,'Welcome rerender leaves one widget');
   const previousFailures=report.assetFailures.length;await page.route('**/tutorial-painel/fixture-pt.mp4',r=>r.fulfill({status:404,body:'Synthetic missing media'}));
   await page.locator('[data-panel-tutorial=welcome]').click();await page.locator('.tutorial264-status:not([hidden])').waitFor();await page.keyboard.press('Escape');
   assert.equal(await page.locator('[data-panel-tutorial=welcome]').evaluate(e=>document.activeElement===e),true);
   const expected=report.assetFailures.splice(previousFailures);assert.ok(expected.every(r=>r.path===release.videoSrc&&r.status===404));report.cases.push({kind:'404',expectedFailures:expected.length});
  }
  report.cases.push({kind:'composition',lang,width,photos,mediaRequests:requests.filter(r=>/\.(mp4|vtt)$/.test(r.path)).length,widgets});await context.close();
 }
 const copy=fs.mkdtempSync(path.join(os.tmpdir(),'tutorial264-mutation-'));temps.push(copy);
 for(const p of ['src','public','package.json','example.json'])fs.cpSync(path.join(root,p),path.join(copy,p),{recursive:true});
 fs.mkdirSync(path.join(copy,'tools'),{recursive:true});fs.copyFileSync(__filename,path.join(copy,'tools',path.basename(__filename)));
 const htmlFile=path.join(copy,'public/index.html'),html=fs.readFileSync(htmlFile,'utf8'),loader=/<script\b[^>]*src=["']\/tutorial264\.js["'][^>]*>\s*<\/script>/g;
 assert.equal([...html.matchAll(loader)].length,1,'Mutation must change exactly one tutorial loader');fs.writeFileSync(htmlFile,html.replace(loader,''));
 const mutout=path.join(out,'mutation'),child=cp.spawnSync(process.execPath,[path.join(copy,'tools',path.basename(__filename)),'--mutation-check','--playwright',pwpath,'--browser-cache',cache],{cwd:copy,encoding:'utf8',maxBuffer:1024*1024,env:{...process.env,SAIDA:mutout},timeout:45000});
 fs.writeFileSync(path.join(out,'mutation-loader.log'),(child.stdout||'')+(child.stderr||''));
 const mr=JSON.parse(fs.readFileSync(path.join(mutout,'tutorial264-integration-proof.json'),'utf8'));assert.notEqual(child.status,0,'Meaningful removed-loader mutation must fail');assert.match(mr.failure,/MUTATION_MISSING_TUTORIAL_LOADER/);report.mutation={killed:true,total:1,change:'Tutorial loader removed only in isolated copy'};
 fs.writeFileSync(htmlFile,html);
 const focusFile=path.join(copy,'public/tutorial264.js'),focusSource=fs.readFileSync(focusFile,'utf8'),focusAnchor=' || active === previous.returnFocusNode';
 assert.equal(focusSource.split(focusAnchor).length-1,1,'Native-return focus mutation must change exactly one guard');
 fs.writeFileSync(focusFile,focusSource.replace(focusAnchor,''));
 fs.mkdirSync(path.join(copy,'test'),{recursive:true});fs.copyFileSync(path.join(root,'test/tutorial264-rerender.test.cjs'),path.join(copy,'test/tutorial264-rerender.test.cjs'));
 const focusMutation=cp.spawnSync(process.execPath,['--test','--test-concurrency=1','test/tutorial264-rerender.test.cjs'],{cwd:copy,encoding:'utf8',maxBuffer:2*1024*1024,timeout:30000});
 fs.writeFileSync(path.join(out,'mutation-native-focus.log'),(focusMutation.stdout||'')+(focusMutation.stderr||''));
 assert.equal(focusMutation.error,undefined,'Focus mutation runner must execute normally');
 assert.notEqual(focusMutation.status,0,'Removing native-return guard must fail the meaningful focal');
 assert.match(focusMutation.stdout||'',/^# fail [1-9]\d*/m,'Native focus mutation must produce test assertions');
 const focusFailureBlocks=(focusMutation.stdout||'').match(/^not ok .*?(?=^# Subtest:|^1\.\.)/gms)||[];
 for(const expected of ['not ok 4 - actual first-steps renderer retires an active player at five of five and keeps focus after the card hides','not ok 6 - retire distinguishes native return to the original opener from deliberate external focus']){
  const block=focusFailureBlocks.find(text=>text.startsWith(expected+'\n'));assert.ok(block,'Expected native-focus case must fail: '+expected);
  assert.match(block,/failureType: 'testCodeFailure'/,'Native-focus failure is an executed test');
  assert.match(block,/Expected "actual" to be reference-equal to "expected"/,'Native-focus case fails its reference-equality assertion');
 }
 assert.equal(Number((focusMutation.stdout||'').match(/^# fail (\d+)/m)?.[1]),2,'Only the two proven native-focus assertions fail');
 fs.writeFileSync(focusFile,focusSource);assert.equal(sha(focusFile),sha(path.join(root,'public/tutorial264.js')),'Mutation copy restores exact focus source');
 report.mutation={killed:true,total:2,cases:[{change:'Tutorial loader removed only in isolated copy',killed:true},{change:'Original native-return focus guard removed only in isolated copy',killed:true,failedAssertions:Number((focusMutation.stdout||'').match(/^# fail (\d+)/m)?.[1])}]};
 for(const p of sources)assert.equal(sha(path.join(root,p)),report.sourceHashes[p],'Frozen product preserved '+p);
 assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.externalRequests,[]);assert.deepEqual(report.assetFailures,[]);report.ok=true;
}
main().catch(e=>{report.failure=e.message;process.exitCode=1;}).finally(async()=>{
 for(const c of contexts)await c.close().catch(()=>{});if(browser)await browser.close();for(const s of servers)if(s.listening)await new Promise(r=>s.close(r));
 for(const folder of temps){const resolved=path.resolve(folder);if(path.dirname(resolved)===path.resolve(os.tmpdir())&&/^tutorial264-(composition|mutation)-/.test(path.basename(resolved)))fs.rmSync(resolved,{recursive:true,force:true});}
 fs.writeFileSync(path.join(out,'tutorial264-integration-proof.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,tests:report.tests,cases:report.cases.length,mutation:report.mutation,failure:report.failure||null}));
});
