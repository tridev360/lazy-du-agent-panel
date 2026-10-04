'use strict';
// Official VPS only. Public source and newly generated fictional metadata only.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.SAIDA,args=process.argv.slice(2),arg=k=>{const i=args.indexOf(k);return i<0?undefined:args[i+1];},mutant=arg('--mutation-case');
if(process.platform!=='linux'||!out)throw Error('Official VPS render required');
const pw=arg('--playwright'),cache=arg('--browser-cache');if(!pw||!cache)throw Error('Fixed existing browser cache required');process.env.PLAYWRIGHT_BROWSERS_PATH=cache;
fs.mkdirSync(out,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),sha=f=>hash(fs.readFileSync(f));
const report={ok:false,synthetic:true,version:require(path.join(root,'package.json')).version,metadataSessions:15,projects:9,tests:null,cases:[],photos:[],mutations:[],pageErrors:[],assetErrors:[],externalRequests:[],sourceHashes:{}};
for(const p of ['public/welcome.js','public/welcome.css','public/onboarding22.js','public/onboarding22.css','public/index.html','public/v21.js','test/panel-guided-firstaccess.test.cjs','tools/validate-guided-firstaccess.cjs'])report.sourceHashes[p]=sha(path.join(root,p));
let browser,server;const contexts=[],temporary=[];
function makeScene(){
 const scene=fs.mkdtempSync(path.join(os.tmpdir(),'guided-firstaccess-'));temporary.push(scene);const profile=path.join(scene,'profile'),workspace=path.join(scene,'workspace'),now=new Date();
 const sessions=path.join(profile,'.codex','sessions',String(now.getUTCFullYear()),String(now.getUTCMonth()+1).padStart(2,'0'),String(now.getUTCDate()).padStart(2,'0'));fs.mkdirSync(sessions,{recursive:true});
 let count=0;
 for(let p=0;p<9;p++){
  const folder=path.join(workspace,p<5?'Personal example '+(p+1):'Example Automation '+(p-4));fs.mkdirSync(path.join(folder,'tasks'),{recursive:true});fs.writeFileSync(path.join(folder,'.git'),'Inert fictional metadata project marker, no repository.\n');fs.writeFileSync(path.join(folder,'package.json'),JSON.stringify({name:'fictional-example-'+p,private:true}));
  fs.writeFileSync(path.join(folder,'tasks','example.md'),'---\nid: example-'+p+'\ntitle: FICTIONAL example task\nphase: new\nowner: Example person\nexecutor: codex\n---\nFictional only. No automation or external services.\n');
  const roles=p<5?['dev']:(p===5||p===7?['lead','dev','reviewer']:['dev','reviewer']);
  for(const [i,role]of roles.entries()){
   const at=new Date(now.getTime()-(p===3?12:p===8?9:0)*86400000-1200000).toISOString(),id='synthetic-guided-'+p+'-'+i;
   const rows=[{type:'session_meta',timestamp:at,payload:{id,cwd:folder}},{type:'turn_context',timestamp:at,payload:{cwd:folder,model:'gpt-6-sol',effort:'medium',role}},{type:'event_msg',timestamp:at,payload:{type:'token_count',info:{total_token_usage:{total_tokens:0,input_tokens:0,output_tokens:0,cached_input_tokens:0}}}}];
   fs.writeFileSync(path.join(sessions,'rollout-'+id+'.jsonl'),rows.map(x=>JSON.stringify(x)).join('\n')+'\n');count++;
  }
 }
 assert.equal(count,15);return{profile,workspace};
}
async function serve(){
 const {profile,workspace}=makeScene(),{Metrics}=require(path.join(root,'src/lib/usage.cjs')),{TaskBoard}=require(path.join(root,'src/lib/task-board.cjs'));
 const metrics=new Metrics(profile,{processReader:async()=>null}),board=new TaskBoard(workspace,{profile});
 for(let i=0;i<8;i++){await metrics.refresh();if(!metrics.pending)break;}
 assert.equal(metrics.snapshot().sessions.length,15,'Real metadata parser returns fifteen fictional sessions');
 server=require(path.join(root,'src/panel.cjs')).createServer({base:workspace,profile,metrics,board,offline:true,updateFetch:null,newsFetch:null});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});return'http://127.0.0.1:'+server.address().port;
}
async function setup(origin,lang,width,{profile=null,guide=null,example=false}={}){
 const context=await browser.newContext({viewport:{width,height:1000},locale:lang==='pt'?'pt-BR':lang==='es'?'es-ES':'en-US',reducedMotion:'reduce',serviceWorkers:'block'});contexts.push(context);
 await context.addInitScript(({profile,guide})=>{window.__initialStorageCount=localStorage.length;if(profile)localStorage.setItem('agent-panel-profile',JSON.stringify(profile));if(guide)localStorage.setItem('lazydu-first-steps-22',JSON.stringify(guide));},{profile,guide});
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!new URL(r.url()).pathname.startsWith('/api/'))report.assetErrors.push({path:new URL(r.url()).pathname,status:r.status()});});
 await context.route('**/*',route=>{const request=route.request();if(new URL(request.url()).origin===origin)return route.continue();report.externalRequests.push({origin:new URL(request.url()).origin,type:request.resourceType()});return route.abort();});
 await page.goto(origin+'/?lang='+lang+(example?'&example=1&size=large':''),{waitUntil:'load'});await page.waitForFunction(()=>document.body.dataset.panelMounted==='true');return{page,context};
}
async function snapshot(page){return page.evaluate(()=>({view:document.body.dataset.view,welcome:document.body.dataset.welcome||null,guide:document.body.dataset.firstGuide||null,profile:JSON.parse(localStorage.getItem('agent-panel-profile')||'null'),saved:JSON.parse(localStorage.getItem('lazydu-first-steps-22')||'null'),steps:[...document.querySelectorAll('#first-steps [data-step]')].map(e=>({step:e.dataset.step,done:e.dataset.done,current:e.dataset.current||null})),apiSteps:window.PanelV2.state().snapshot.guidance.onboarding.steps,sessionCount:window.PanelV2.state().snapshot.usage.sessions.length,projects:window.PanelV2.state().snapshot.guidance.projects.length,initialStorageCount:window.__initialStorageCount}));}
async function capture(page,name,lang,width){const dimensions=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth}));assert.equal(dimensions.overflow,false,'Page fits '+width);const file=lang+'-'+width+'-'+name+'.png';await page.screenshot({path:path.join(out,file),fullPage:true});report.photos.push({file,sha256:sha(path.join(out,file)),...dimensions});}
async function fresh(page){const state=await snapshot(page);assert.equal(state.initialStorageCount,0);assert.equal(state.sessionCount,15);assert.equal(state.projects,9);assert.equal(await page.locator('#welcome').isVisible(),true,'MUTATION_WELCOME_VISIBLE_15');assert.equal(state.profile,null);assert.equal(state.welcome,'on');assert.equal(await page.locator('.clean-actions:visible').count(),0,'Welcome omits premature WEN and header actions');return state;}
async function welcomeBackAndLocale(page,lang){
 await page.locator('#welcome-choice-small').click();await page.locator('#welcome-choice-next').focus();
 await page.evaluate(()=>PanelWelcome.render(PanelV2.state().snapshot,document.documentElement.lang));assert.equal(await page.locator('#welcome-choice-next').evaluate(e=>document.activeElement===e),true,'Owned welcome goal focus survives reading refresh');
 const other=lang==='en'?'pt':'en';await page.locator('#panel-language [data-language='+other+']').click();await page.waitForFunction(other=>document.documentElement.lang===other,other);assert.equal(await page.locator('#panel-language [data-language='+other+']').evaluate(e=>document.activeElement===e),true,'Real language click keeps deliberately external focus');assert.equal(await page.locator('#welcome-choice-next').isVisible(),true,'Language keeps the second welcome step');await page.locator('#panel-language [data-language='+lang+']').click();await page.waitForFunction(lang=>document.documentElement.lang===lang,lang);
 await page.locator('#welcome-back').click();assert.equal(await page.locator('#welcome-choice-small').getAttribute('aria-pressed'),'true');assert.equal((await snapshot(page)).profile,null,'Back and locale never save setup choices');assert.equal(await page.locator('#welcome-step-title').evaluate(e=>document.activeElement===e),true);report.cases.push({kind:'welcome-back-reading-and-real-locale-focus',lang,localeTransitionVia:'Visible panel-language buttons, real click'});
}
async function guided(page){
 await page.locator('#welcome .clean-choices button').nth(0).click();assert.equal(await page.locator('#welcome').isVisible(),true);await page.locator('#welcome .clean-choices button').nth(0).click();
 await page.waitForFunction(()=>document.body.dataset.firstGuide==='on');
 assert.equal(await page.locator('#first-next-step').isVisible(),true,'A specific next step is visible');assert.equal(await page.locator('#first-steps [data-current=true]').count(),1,'One current step');
 assert.equal(await page.locator('#first-steps [data-current=true]').getAttribute('data-step'),'rules');
 assert.equal(await page.locator('#clean-overview').isVisible(),false,'MUTATION_GUIDE_INDICATORS_HIDDEN');assert.equal(await page.locator('#home-stage').isVisible(),false,'Guide precedes team indicators');
 assert.equal(await page.locator('.clean-actions:visible').count(),0,'Guide omits premature header actions');
 const state=await snapshot(page);assert.equal(state.profile.goal,'next');assert.equal(state.saved.guided,true);assert.equal(state.steps.filter(s=>s.done==='true').length,1);assert.deepEqual(state.apiSteps,{running:true,rules:false,newSession:false,task:false,decision:false});
 const position=await page.locator('#first-next-step').boundingBox();assert.ok(position&&position.y>=0&&position.y<1000,'Current action is in first viewport');
 assert.equal(await page.evaluate(()=>!!(document.getElementById('first-steps').compareDocumentPosition(document.getElementById('clean-overview'))&Node.DOCUMENT_POSITION_FOLLOWING)),true,'First steps precedes indicators in real DOM order');
 assert.equal(await page.locator('#first-all-steps').evaluate(e=>e.open),false,'Other steps are a closed summary');
 return state;
}
async function copyAndSkip(page,lang){
 await page.context().grantPermissions(['clipboard-read','clipboard-write'],{origin:new URL(page.url()).origin});
 const before=await snapshot(page);await page.locator('#first-copy-rules').click();
 await page.waitForFunction(()=>!document.getElementById('first-copy-rules').disabled);
 const copied=await snapshot(page);assert.deepEqual(copied.apiSteps,before.apiSteps,'Copying rules is not installing rules');assert.equal(copied.steps.filter(s=>s.done==='true').length,1,'Copy gesture never checks a step');
 await page.locator('#first-steps .first-heading button').click();const skipped=await snapshot(page);assert.notEqual(skipped.guide,'on');assert.equal(await page.locator('#clean-overview').isVisible(),true);assert.deepEqual(skipped.apiSteps,before.apiSteps,'Skip never accepts rules/tasks/decisions');
 report.cases.push({kind:'copy-is-not-install-and-guided-skip',lang,before,copied,skipped});
}
async function refreshFocus(page,lang){
 await page.locator('#first-all-steps summary').click();const field=page.locator('#first-task-input');await field.fill('Fictional task draft');await field.focus();await field.evaluate(e=>e.setSelectionRange(3,8));
 await page.evaluate(()=>{const source=PanelV2.state().snapshot,info=source.guidance.onboarding;window.__guideSource=source;PanelOnboarding.update({...source,guidance:{...source.guidance,onboarding:{...info,projectName:'Fictional refresh one'}}},document.documentElement.lang);});
 const after=await field.evaluate(e=>({focused:document.activeElement===e,value:e.value,start:e.selectionStart,end:e.selectionEnd,detailsOpen:document.getElementById('first-all-steps').open}));
 assert.deepEqual(after,{focused:true,value:'Fictional task draft',start:3,end:8,detailsOpen:true},'Owned input refresh preserves draft, caret and expanded steps');
 const external=await page.evaluate(()=>{const e=[...document.querySelectorAll('button,a[href],input,select,[tabindex]')].find(e=>!e.closest('#first-steps')&&!e.disabled&&e.tabIndex>=0&&e.checkVisibility({checkVisibilityCSS:true}));if(!e)return null;window.__guideExternal=e;e.focus();return{tag:e.tagName,id:e.id,focused:document.activeElement===e};});
 assert.ok(external?.focused,'A connected visible external control is focused');
 await page.evaluate(()=>{const s=window.__guideSource;PanelOnboarding.update({...s,guidance:{...s.guidance,onboarding:{...s.guidance.onboarding,projectName:'Fictional refresh two'}}},document.documentElement.lang);});
 assert.equal(await page.evaluate(()=>document.activeElement===window.__guideExternal),true,'Refresh never steals deliberately external focus');
 await page.locator('#first-copy-rules').focus();
 await page.evaluate(()=>{const s=window.__guideSource;PanelOnboarding.update({...s,guidance:{...s.guidance,onboarding:{...s.guidance.onboarding,steps:{running:true,rules:true,newSession:false,task:false,decision:false}}}},document.documentElement.lang);});
 assert.equal(await page.locator('#first-steps [data-current=true]').getAttribute('data-step'),'newSession');assert.equal(await page.locator('#first-next-step').evaluate(e=>document.activeElement===e),true,'Observed progression focuses the next action after owned control disappears');
 await page.evaluate(()=>{PanelOnboarding.update(window.__guideSource,document.documentElement.lang);delete window.__guideSource;delete window.__guideExternal;});
 report.cases.push({kind:'refresh-input-caret-details-and-external-focus',lang,after,external});
}
async function extras(origin,lang){
 const existing={version:2,size:'large',goal:'usage',mode:'pro',skipped:false};
 {const{page,context}=await setup(origin,lang,375,{profile:existing});assert.equal(await page.locator('#welcome').isVisible(),false);assert.notEqual((await snapshot(page)).guide,'on');assert.equal(await page.locator('#clean-overview').isVisible(),true);await page.evaluate(()=>PanelWelcome.show());await page.locator('#welcome .clean-choices button').nth(0).click();await page.locator('#welcome .clean-setup-actions button').filter({hasText:lang==='pt'?'Pular':lang==='es'?'Omitir':'Skip'}).click();assert.deepEqual((await snapshot(page)).profile,existing,'Revisit cancel preserves prior choices');report.cases.push({kind:'existing-and-revisit-cancel',lang});await context.close();}
 {const{page,context}=await setup(origin,lang,375);await fresh(page);await page.locator('#welcome .clean-setup-actions button').filter({hasText:lang==='pt'?'Pular':lang==='es'?'Omitir':'Skip'}).click();let state=await snapshot(page);assert.equal(state.profile.skipped,true);assert.notEqual(state.guide,'on');assert.equal(await page.locator('#clean-overview').isVisible(),true);await page.reload({waitUntil:'load'});await page.waitForFunction(()=>document.body.dataset.panelMounted==='true');assert.equal(await page.locator('#welcome').isVisible(),false);report.cases.push({kind:'initial-skip-and-reload',lang});await context.close();}
 {const{page,context}=await setup(origin,lang,375,{profile:existing,example:true});assert.equal(await page.locator('#welcome').isVisible(),false);assert.notEqual((await snapshot(page)).guide,'on');report.cases.push({kind:'explicit-example-never-forces-guide',lang});await context.close();}
 for(const [index,goal,view]of [[1,'team','team'],[2,'usage','usage']]){const{page,context}=await setup(origin,lang,375);await fresh(page);await page.locator('#welcome .clean-choices button').nth(index).click();await page.locator('#welcome .clean-choices button').nth(index).click();await page.waitForFunction(()=>document.body.dataset.firstGuide==='on');assert.equal((await snapshot(page)).profile.goal,goal);assert.equal(await page.locator('#first-next-step').isVisible(),true);assert.equal(await page.locator('#clean-overview').isVisible(),false);const before=await snapshot(page);await page.evaluate(view=>PanelV2.select(view),view);await page.evaluate(()=>PanelWelcome.show());await page.locator('#welcome-skip').click();const cancelled=await snapshot(page);assert.deepEqual(cancelled.profile,before.profile);assert.deepEqual(cancelled.saved,before.saved);assert.equal(cancelled.view,view);assert.equal(await page.locator('#tab-'+view).evaluate(e=>document.activeElement===e&&e.checkVisibility({checkVisibilityCSS:true})),true,'Cancelling welcome off Home focuses the visible current tab');await page.evaluate(()=>PanelV2.select('home'));await page.locator('#first-steps .first-heading button').click();const state=await snapshot(page);assert.equal(state.view,view,'Skip opens chosen goal');assert.notEqual(state.guide,'on');assert.deepEqual(state.apiSteps,{running:true,rules:false,newSession:false,task:false,decision:false});report.cases.push({kind:'size-goal-guide-offhome-revisit-cancel-then-skip',lang,index,goal,view});await context.close();}
 for(const [index,goal]of [[1,'team'],[2,'usage']]){const{page,context}=await setup(origin,lang,375);await fresh(page);await page.locator('#welcome .clean-choices button').nth(index).click();await page.locator('#welcome .clean-choices button').nth(index).click();await page.waitForFunction(()=>document.body.dataset.firstGuide==='on');await page.evaluate(()=>{const s=PanelV2.state().snapshot;PanelOnboarding.update({...s,guidance:{...s.guidance,onboarding:{...s.guidance.onboarding,steps:{running:true,rules:true,newSession:true,task:true,decision:true}}}},document.documentElement.lang);});assert.equal(await page.locator('#first-guide-open').isVisible(),true,'Observed synthetic 5/5 has an explicit dashboard entry');assert.equal((await snapshot(page)).guide,'on');await page.locator('#first-guide-open').click();const state=await snapshot(page);assert.equal(state.view,goal);assert.notEqual(state.guide,'on');assert.equal(state.profile.goal,goal);assert.deepEqual(state.apiSteps,{running:true,rules:false,newSession:false,task:false,decision:false},'Completion scenario only changes synthetic renderer input, not real fixture observations');report.cases.push({kind:'guided-observed-five-opens-saved-goal',lang,goal,input:'Explicit synthetic 5/5 renderer observation; no real rule/task/decision writes'});await context.close();}
}
async function mutations(){
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'product-source-manifest.json'),'utf8'));
 for(const kind of ['welcome','css-order']){
  const copy=fs.mkdtempSync(path.join(os.tmpdir(),'guided-mutation-'+kind+'-'));temporary.push(copy);
  for(const p of manifest.sourceManifest){assert.ok(!path.isAbsolute(p.path)&&!p.path.split('/').includes('..'));const target=path.join(copy,p.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,p.path),target);}
  if(kind==='welcome')fs.appendFileSync(path.join(copy,'public/v21.js'),'\n;window.PanelWelcome.useGuidedSetup();\n');
  else{const file=path.join(copy,'public/onboarding22.css'),css=fs.readFileSync(file,'utf8'),anchor='body[data-first-guide=on] #main>:not(#first-steps):not(#welcome):not(#view-tabs),body[data-first-guide=on] header>#clean-actions{display:none!important}';assert.equal(css.split(anchor).length-1,1,'Exact guide visibility CSS mutation anchor');fs.writeFileSync(file,css.replace(anchor,anchor.replace('display:none!important','display:block!important')));}
  const mutationOut=path.join(out,'mutation-'+kind);fs.mkdirSync(mutationOut,{recursive:true});
  const run=cp.spawnSync(process.execPath,[path.join(copy,'tools/validate-guided-firstaccess.cjs'),'--playwright',pw,'--browser-cache',cache,'--mutation-case',kind],{cwd:copy,encoding:'utf8',env:{...process.env,SAIDA:mutationOut},maxBuffer:4*1024*1024});
  const log=(run.stdout||'')+(run.stderr||'');fs.writeFileSync(path.join(out,'mutation-'+kind+'.log'),log);
  const anchor=kind==='welcome'?'MUTATION_WELCOME_VISIBLE_15':'MUTATION_GUIDE_INDICATORS_HIDDEN';assert.notEqual(run.status,0,kind+' mutant must fail');assert.ok(log.includes(anchor)&&log.includes('AssertionError'),kind+' kill must be the intended behavioral assertion');report.mutations.push({kind,killed:true,exit:run.status,assertion:anchor});
 }
}
async function main(){
 if(!mutant){const files=fs.readdirSync(path.join(root,'test')).filter(f=>f.endsWith('.test.cjs')).map(f=>'test/'+f),gate=cp.spawnSync(process.execPath,['--test','--test-reporter=tap','--test-concurrency=1',...files],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});const log=(gate.stdout||'')+(gate.stderr||'');fs.writeFileSync(path.join(out,'public-composition-tests.txt'),log);assert.equal(gate.status,0,'Exact new public panel composition');report.tests=Number(log.match(/# pass (\d+)/)?.[1]);assert.ok(report.tests>0);}
 browser=await require(pw).chromium.launch({channel:'chromium',headless:true,chromiumSandbox:false,args:['--no-sandbox','--disable-dev-shm-usage']});const origin=await serve();
 const health=await(await fetch(origin+'/api/health')).json();assert.equal(health.version,report.version);assert.equal(health.offline,true);
 if(mutant){const{page}=await setup(origin,'pt',375);await fresh(page);if(mutant==='css-order')await guided(page);return;}
 for(const lang of ['en','pt','es']){
  for(const width of [375,768,1100,1280,1440]){const{page,context}=await setup(origin,lang,width);const before=await fresh(page);await capture(page,'welcome',lang,width);if(width===375)await welcomeBackAndLocale(page,lang);const after=await guided(page);await capture(page,'next-step',lang,width);if(width===375){await page.reload({waitUntil:'load'});await page.waitForFunction(()=>document.body.dataset.panelMounted==='true');assert.equal(await page.locator('#welcome').isVisible(),false);assert.equal((await snapshot(page)).guide,'on');assert.equal((await snapshot(page)).steps.filter(s=>s.done==='true').length,1,'Reload does not fabricate completion');await refreshFocus(page,lang);await copyAndSkip(page,lang);}report.cases.push({kind:'fresh-metadata-to-guided-next',lang,width,before,after});await context.close();}
  await extras(origin,lang);
 }
 assert.equal(report.pageErrors.length,0);assert.equal(report.assetErrors.length,0);assert.equal(report.externalRequests.length,0);await browser.close();browser=null;await new Promise(r=>server.close(r));server=null;await mutations();report.ok=true;
}
main().catch(e=>{report.error=e.stack;console.error(e.stack);process.exitCode=1;}).finally(async()=>{for(const context of contexts)await context.close().catch(()=>{});await browser?.close().catch(()=>{});if(server)await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'guided-firstaccess-proof.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,tests:report.tests,cases:report.cases.length,photos:report.photos.length,mutations:report.mutations,pageErrors:report.pageErrors.length,externalRequests:report.externalRequests.length}));for(const folder of temporary)fs.rmSync(folder,{recursive:true,force:true});});
