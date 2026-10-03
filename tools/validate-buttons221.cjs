'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),cp=require('node:child_process');
const arg=name=>process.argv[process.argv.indexOf(name)+1];
if(process.argv.includes('--browser-cache'))process.env.PLAYWRIGHT_BROWSERS_PATH=arg('--browser-cache');
const pw=require(arg('--playwright')),out=path.resolve(process.env.SAIDA||process.cwd()),phase=process.argv.includes('--after')?'after':'before';
fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'panel-buttons-'));
const server=require('../src/panel.cjs').createServer({demoOnly:true,offline:true,profile});
const report={phase,source:'Fictional example only; no user metadata',tests:null,cases:[],errors:[],externalRequests:[],ok:false};
let browser;
function controls(){
 const modal=document.querySelector('dialog[open]');
 const container=e=>e.matches('.home-card,.look-ai-card,.metric,.du-agent,.teach-option,[role=radio]');
 return [...document.querySelectorAll('button,a[data-button],summary[data-button],[role=button]')].filter(e=>e.checkVisibility({checkVisibilityCSS:true,checkOpacity:true})&&!e.closest('[hidden],details:not([open]) :not(summary),dialog:not([open])')&&(!modal||modal.contains(e))).map(e=>{
  const s=getComputedStyle(e),r=e.getBoundingClientRect();
  return {id:e.id||null,classes:e.className?.toString()||'',label:(e.getAttribute('aria-label')||e.textContent).trim().slice(0,90),tag:e.tagName,role:e.getAttribute('role'),variant:e.dataset.button||'secondary',container:container(e),width:r.width,height:r.height,radius:s.borderTopLeftRadius,appearance:s.appearance,background:s.backgroundColor,image:s.backgroundImage,color:s.color,border:s.borderColor,disabled:!!e.disabled,focusVisible:e.matches(':focus-visible'),outline:s.outlineStyle,outlineWidth:parseFloat(s.outlineWidth),opacity:s.opacity};
 });
}
async function main(){
 if(phase==='after'){
  const files=fs.readdirSync(path.resolve('test')).filter(f=>f.endsWith('.test.cjs')).map(f=>'test/'+f);
  const gate=cp.spawnSync(process.execPath,['--test','--test-concurrency=1',...files],{encoding:'utf8',maxBuffer:5*1024*1024});
  fs.writeFileSync(path.join(out,'tests.txt'),(gate.stdout||'')+(gate.stderr||''));assert.equal(gate.status,0,'Full public suite');report.tests=Number((gate.stdout||'').match(/# pass (\d+)/)?.[1]);
 }
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const sample=await(await fetch(base+'/api/status?example=1&size=large')).json();
 browser=await pw.chromium.launch({headless:true,args:['--no-sandbox'],executablePath:process.argv.includes('--browser')?arg('--browser'):pw.chromium.executablePath()});
 for(const lang of ['en','pt','es'])for(const width of [375,768,1440]){
  const context=await browser.newContext({viewport:{width,height:950},locale:lang==='pt'?'pt-BR':lang==='es'?'es-ES':'en-US',reducedMotion:'reduce'}),page=await context.newPage(),records=[];
  page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base+'/')&&!r.url().startsWith('data:'))report.externalRequests.push(new URL(r.url()).origin);});
  await context.addInitScript(()=>{localStorage.setItem('agent-panel-profile',JSON.stringify({version:2,mode:'explorer',size:'large',goal:'finish'}));window.__copies=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>window.__copies.push(t)}});});
  await page.route('**/api/status**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(sample)}));
  await page.goto(base+'/?example=1&size=large&lang='+lang);await page.waitForFunction(()=>document.body.dataset.panelMounted==='true');
  async function snap(name){
   await page.evaluate(()=>window.PanelControls?.decorate?.());
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const rows=await page.evaluate(controls),overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   records.push({screen:name,overflow,controls:rows});assert.equal(overflow,false,name+' overflow');
   const commonRadius=await page.locator('#boot-retry').evaluate(e=>getComputedStyle(e).borderTopLeftRadius);
   if(phase==='after')for(const row of rows){
    assert.ok(['primary','secondary','link'].includes(row.variant),'Only three button variants '+row.label);
    assert.equal(row.appearance,'none','Native appearance '+row.label);
    if(!row.container){assert.ok(row.height>=43.5,'44px target '+row.label);assert.equal(row.radius,commonRadius,'Consistent radius '+row.label);}
   }
   await page.screenshot({path:path.join(out,lang+'-'+width+'-'+name+'.png'),fullPage:true});
  }
  for(const view of ['home','team','projects','usage','queue','tips']){await page.evaluate(view=>PanelV2.select(view,true),view);await snap(view);}
  await page.evaluate(()=>PanelV2.select('home',true));
  const close=async()=>{if(await page.locator('#drawer[open]').count())await page.locator('#close-drawer').click();else if(await page.locator('dialog[open]').count())await page.keyboard.press('Escape');};
  for(const [id,name]of [['clean-wen','overview'],['clean-auto','automate'],['acel-trigger','accelerate'],['clean-preferences','preferences']]){
   await page.evaluate(id=>document.getElementById(id)?.click(),id);await page.locator('dialog[open]').waitFor();await snap(name);await close();
  }
  await page.evaluate(()=>PanelBell.open());await page.locator('#drawer[open]').waitFor();await snap('bell');await close();
  await page.evaluate(lang=>PanelTeach.open(lang,PanelV2.state()?.snapshot),lang);await page.locator('#drawer[open] .teach-copy').waitFor();await snap('teach');
  const primary=page.locator('#drawer[open] .teach-copy');await primary.hover();await snap('teach-hover');await page.keyboard.press('Tab');await primary.focus();
  const focused=await primary.evaluate(e=>({visible:e.matches(':focus-visible'),width:parseFloat(getComputedStyle(e).outlineWidth),style:getComputedStyle(e).outlineStyle}));assert.ok(focused.visible&&focused.width>=2&&focused.style!=='none');await snap('teach-focus');
  await page.evaluate(()=>{navigator.clipboard.writeText=text=>new Promise(resolve=>window.__copyRelease=()=>{window.__copies.push(text);resolve();});});await primary.click();assert.equal(await primary.isDisabled(),true);await snap('teach-disabled');await page.evaluate(()=>window.__copyRelease());await page.waitForFunction(()=>!document.querySelector('#drawer .teach-copy').disabled);await snap('teach-copied');
  await page.locator('#drawer .teach-advanced summary').click();await snap('teach-advanced');await page.locator('#drawer .teach-option[data-option=custom]').click();await snap('teach-custom');await close();
  const fail=await context.newPage();fail.on('pageerror',e=>report.errors.push(e.message));await fail.route('**/api/status**',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic unavailable metadata'})}));
  await fail.goto(base+'/?lang='+lang);await fail.locator('#boot-retry').waitFor({state:'visible'});await fail.waitForFunction(()=>document.getElementById('startup-message')?.textContent.trim());
  const retry=await fail.locator('#boot-retry').evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return{variant:e.dataset.button,appearance:s.appearance,radius:s.borderTopLeftRadius,height:r.height,background:s.backgroundColor};});
  if(phase==='after'){assert.equal(retry.variant,'secondary');assert.equal(retry.appearance,'none');assert.ok(parseFloat(retry.radius)>0);assert.ok(retry.height>=44);}
  await fail.screenshot({path:path.join(out,lang+'-'+width+'-boot-error.png'),fullPage:true});await fail.close();
  report.cases.push({lang,width,records,keyboardFocus:focused,retry});await context.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);report.ok=true;
}
main().catch(e=>{report.failure=e.message;process.exitCode=1;}).finally(async()=>{
 if(browser)await browser.close();if(server.listening)await new Promise(resolve=>server.close(resolve));
 const resolved=path.resolve(profile);if(path.dirname(resolved)===path.resolve(os.tmpdir())&&path.basename(resolved).startsWith('panel-buttons-'))fs.rmSync(resolved,{recursive:true,force:true});
 fs.writeFileSync(path.join(out,'buttons-validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,phase,tests:report.tests,cases:report.cases.length,failure:report.failure||null}));
});
