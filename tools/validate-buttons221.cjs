'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),cp=require('node:child_process');
const arg=name=>process.argv[process.argv.indexOf(name)+1];
if(process.argv.includes('--browser-cache'))process.env.PLAYWRIGHT_BROWSERS_PATH=arg('--browser-cache');
const pw=require(arg('--playwright')),out=path.resolve(process.env.SAIDA||process.cwd()),phase=process.argv.includes('--after')?'after':'before';
fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'panel-buttons-'));
const server=require('../src/panel.cjs').createServer({demoOnly:true,offline:true,profile});
const report={phase,source:'Fictional example only; no user metadata',tests:null,cases:[],errors:[],assetFailures:[],externalRequests:[],ok:false};
function measureButtonContrast(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d',{willReadFrequently:true,colorSpace:'srgb'});
 const parse=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);const rgba=ctx.getImageData(0,0,1,1,{colorSpace:'srgb'}).data;return [rgba[0],rgba[1],rgba[2],rgba[3]/255];};
 const blend=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3])),lum=a=>a.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 function background(e){const chain=[];for(let n=e;n;n=n.parentElement)chain.unshift(n);let low=[8,8,9],high=[8,8,9],stops=[],resolved=true,opacity=1;for(const n of chain){const s=getComputedStyle(n),color=parse(s.backgroundColor);opacity*=Number(s.opacity);if(color[3]===1){low=color.slice(0,3);high=color.slice(0,3);stops=[];resolved=true;}else{low=blend(color,low);high=blend(color,high);}if(s.backgroundImage!=='none'){const colors=(s.backgroundImage.match(/(?:rgba?|hsla?|color|oklch|oklab|lab|lch)\([^)]*\)/g)||[]).map(parse);if(!colors.length){resolved=false;low=[0,0,0];high=[255,255,255];}else{const values=colors.flatMap(c=>[blend(c,low),blend(c,high)]);low=[0,1,2].map(i=>Math.min(...values.map(v=>v[i])));high=[0,1,2].map(i=>Math.max(...values.map(v=>v[i])));stops.push({element:n.id||n.className?.toString()||n.tagName,computed:s.backgroundImage,colors});}}}return {low,high,stops,resolved,opacity};}
 const modal=document.querySelector('dialog[open]'),shown=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility==='visible'&&!e.closest('[hidden]')&&(!e.closest('dialog')||e.closest('dialog').open)&&(!modal||modal.contains(e));};
 return [...document.querySelectorAll('body *')].filter(e=>shown(e)&&e.closest('button,a[data-button],summary[data-button],[role=button]')&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(e=>{const s=getComputedStyle(e),b=background(e),fg=parse(s.color);fg[3]*=b.opacity;const fLow=lum(blend(fg,b.low)),fHigh=lum(blend(fg,b.high)),bLow=lum(b.low),bHigh=lum(b.high),overlap=Math.max(fLow,bLow)<=Math.min(fHigh,bHigh),minimumRatio=overlap?1:fLow>bHigh?(fLow+.05)/(bHigh+.05):(bLow+.05)/(fHigh+.05),size=parseFloat(s.fontSize),large=size>=24||size>=18.66&&Number(s.fontWeight)>=700,icon=e.getAttribute('aria-hidden')==='true'&&!/[\p{L}\p{N}]/u.test(e.textContent);return {id:e.id||e.className?.toString()||e.tagName,icon,text:e.textContent.trim().slice(0,90),fontSize:size,ratio:minimumRatio,required:large||icon?3:4.5,disabled:!!e.disabled||!!e.closest('[disabled]'),gradient:b.stops.length>0,backgroundResolved:b.resolved,foreground:s.color,foregroundRGB:fg,backgroundLowRGB:b.low,backgroundHighRGB:b.high,effectiveOpacity:b.opacity,composedGradientStops:b.stops,method:'Browser canvas sRGB RGBA8 normalization, including color(srgb); conservative composited gradient bounds.'};});
}
let browser;
function controls(){
 const modal=document.querySelector('dialog[open]');
 const container=e=>e.matches('.home-card,.look-ai-card,.metric,.live-metric,.du-agent,.look-node,.feature,.project-card,.feed-mini,.teach-option,[role=radio]');
 return [...document.querySelectorAll('button,a[data-button],summary[data-button],[role=button]')].filter(e=>e.checkVisibility({checkVisibilityCSS:true,checkOpacity:true})&&!e.closest('[hidden],details:not([open]) :not(summary),dialog:not([open])')&&(!modal||modal.contains(e))).map(e=>{
  const s=getComputedStyle(e),r=e.getBoundingClientRect();
  return {id:e.id||null,classes:e.className?.toString()||'',label:(e.getAttribute('aria-label')||e.textContent).trim().slice(0,90),tag:e.tagName,role:e.getAttribute('role'),tabIndex:e.tabIndex,svgTarget:e.namespaceURI==='http://www.w3.org/2000/svg',variant:e.dataset.button||'secondary',visualVariant:s.getPropertyValue('--button221-variant').trim(),container:container(e),width:r.width,height:r.height,radius:s.borderTopLeftRadius,appearance:s.appearance,background:s.backgroundColor,image:s.backgroundImage,color:s.color,border:s.borderColor,disabled:!!e.disabled,focusVisible:e.matches(':focus-visible'),outline:s.outlineStyle,outlineWidth:parseFloat(s.outlineWidth),opacity:s.opacity};
 });
}
function regressionStates(){
 const style=e=>{const s=getComputedStyle(e);return {background:s.backgroundColor,color:s.color,border:s.borderStyle,cursor:s.cursor,variant:s.getPropertyValue('--button221-variant').trim()};};
 const version=document.getElementById('version-trigger'),summary=document.querySelector('#drawer[open] .teach-advanced>summary'),disabled=document.getElementById('first-connect'),primary=document.getElementById('clean-wen'),accelerate=document.getElementById('acel-trigger'),states={};
 if(version){const range=document.createRange();range.selectNodeContents(version);const lines=[...new Set([...range.getClientRects()].filter(r=>r.width>0&&r.height>0).map(r=>Math.round(r.top*2)/2))];states.version={text:version.textContent.trim(),whiteSpace:getComputedStyle(version).whiteSpace,lines:lines.length,width:version.getBoundingClientRect().width,height:version.getBoundingClientRect().height,scrollWidth:version.scrollWidth,clientWidth:version.clientWidth};}
 if(summary){const s=getComputedStyle(summary),after=getComputedStyle(summary,'::after'),before=getComputedStyle(summary,'::before');states.summary={open:summary.parentElement.open,display:s.display,listStyle:s.listStyleType,after:after.content,before:before.content,hasIndicator:s.display==='list-item'&&s.listStyleType!=='none'||![after.content,before.content].every(c=>['none','normal','""',''].includes(c))};}
 if(disabled&&primary)states.disabled={nativeDisabled:disabled.disabled,...style(disabled),enabledPrimary:style(primary)};
 if(accelerate){const label=accelerate.querySelector('.acel-trigger-nome'),range=document.createRange();range.selectNodeContents(label);const rects=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0),lines=[...new Set(rects.map(r=>Math.round(r.top*2)/2))],box=accelerate.getBoundingClientRect();states.accelerate={text:label.textContent,accessibleLabel:accelerate.getAttribute('aria-label'),lines:lines.length,whiteSpace:getComputedStyle(label).whiteSpace,buttonWidth:box.width,buttonHeight:box.height,insideButton:rects.every(r=>r.left>=box.left&&r.right<=box.right),scrollWidth:accelerate.scrollWidth,clientWidth:accelerate.clientWidth};}
 return states;
}
async function main(){
 if(phase==='after'){
  const files=fs.readdirSync(path.resolve('test')).filter(f=>f.endsWith('.test.cjs')).map(f=>'test/'+f);
  const gate=cp.spawnSync(process.execPath,['--test','--test-concurrency=1',...files],{encoding:'utf8',maxBuffer:5*1024*1024});
  fs.writeFileSync(path.join(out,'tests.txt'),(gate.stdout||'')+(gate.stderr||''));assert.equal(gate.status,0,'Full public suite');report.tests=Number((gate.stdout||'').match(/# pass (\d+)/)?.[1]);
 }
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 if(phase==='after'){const asset=await fetch(base+'/buttons221.css');assert.equal(asset.status,200,'Button stylesheet HTTP 200');assert.ok(asset.headers.get('content-type')?.includes('text/css'),'Button stylesheet MIME');assert.equal(await asset.text(),fs.readFileSync(path.resolve('public/buttons221.css'),'utf8'),'Exact served button stylesheet');report.stylesheetServed=true;}
 const sample=await(await fetch(base+'/api/status?example=1&size=large')).json();
 browser=await pw.chromium.launch({headless:true,args:['--no-sandbox'],executablePath:process.argv.includes('--browser')?arg('--browser'):pw.chromium.executablePath()});
 for(const lang of ['en','pt','es'])for(const width of [375,768,1440]){
  const context=await browser.newContext({viewport:{width,height:950},locale:lang==='pt'?'pt-BR':lang==='es'?'es-ES':'en-US',reducedMotion:'reduce'}),page=await context.newPage(),records=[];let connectWrites=0;
  page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base+'/')&&!r.url().startsWith('data:'))report.externalRequests.push(new URL(r.url()).origin);});page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/'))report.assetFailures.push({path:new URL(r.url()).pathname,status:r.status()});});
  await context.addInitScript(()=>{localStorage.setItem('agent-panel-profile',JSON.stringify({version:2,mode:'explorer',size:'large',goal:'finish'}));window.__copies=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>window.__copies.push(t)}});});
  await page.route('**/api/status**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(sample)}));
  await page.route('**/api/onboarding-connect',r=>{connectWrites++;return r.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Synthetic blocked write'})});});
  await page.goto(base+'/?example=1&size=large&lang='+lang);await page.waitForFunction(()=>document.body.dataset.panelMounted==='true');
  async function snap(name,{viewport=false,scroll=null}={}){
   await page.evaluate(()=>window.PanelControls?.decorate?.());
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const rows=await page.evaluate(controls),overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   const contrast=await page.evaluate(measureButtonContrast);
   const regressions=await page.evaluate(regressionStates);
   records.push({screen:name,overflow,controls:rows,contrast,scroll,regressions});assert.equal(overflow,false,name+' overflow');
   if(phase==='after'){
    if(regressions.version){assert.equal(regressions.version.whiteSpace,'nowrap','Version stays on one line');assert.equal(regressions.version.lines,1,'Version text has one measured line');assert.ok(regressions.version.scrollWidth<=regressions.version.clientWidth,'Version text is not clipped');}
    if(regressions.summary)assert.ok(regressions.summary.hasIndicator,'Teach advanced options keeps disclosure indicator');
    if(regressions.disabled){assert.ok(regressions.disabled.nativeDisabled,'Unavailable connection remains natively disabled');assert.equal(regressions.disabled.variant,'secondary','Unavailable action uses secondary surface');assert.notEqual(regressions.disabled.background,regressions.disabled.enabledPrimary.background,'Disabled action differs from active primary on touch');assert.equal(regressions.disabled.border,'dashed','Disabled action has visible unavailable edge');}
    if(regressions.accelerate){assert.equal(regressions.accelerate.lines,1,'Accelerator label has one measured line');assert.ok(regressions.accelerate.insideButton,'Accelerator label stays inside button');assert.ok(regressions.accelerate.scrollWidth<=regressions.accelerate.clientWidth,'Accelerator control has no internal overflow');assert.ok(regressions.accelerate.accessibleLabel.includes(regressions.accelerate.text),'Accelerator accessible name keeps its full visible label');}
   }
   const commonRadius=await page.locator('#boot-retry').evaluate(e=>getComputedStyle(e).borderTopLeftRadius);
   if(phase==='after')for(const row of rows){
    if(row.svgTarget){assert.equal(row.role,'button','SVG action semantics '+row.label);assert.ok(row.label&&row.tabIndex>=0,'SVG action name and keyboard entry '+row.label);assert.ok(row.outlineWidth>=2&&row.outline!=='none'||!row.focusVisible,'SVG keyboard focus '+row.label);continue;}
    assert.ok(['primary','secondary','link'].includes(row.variant),'Only three button variants '+row.label);
    assert.ok(['primary','secondary','discreet'].includes(row.visualVariant),'Only three visual surfaces '+row.label);
    assert.equal(row.appearance,'none','Native appearance '+row.label);
    if(!row.container){assert.ok(row.height>=43.5&&row.width>=43.5,'44px target '+row.label);assert.equal(row.radius,commonRadius,'Consistent radius '+row.label);}
   }
   if(phase==='after')for(const row of contrast){assert.ok(row.backgroundResolved,'Resolved control background '+row.id);assert.ok(row.ratio>=row.required,'Control contrast '+row.id+' '+row.text+' '+row.ratio.toFixed(3)+' < '+row.required);}
   await page.screenshot({path:path.join(out,lang+'-'+width+'-'+name+'.png'),fullPage:!viewport});
  }
  async function rolled(name){
   const dialog=page.locator('dialog[open]');
   for(const [part,fraction]of [['top',0],['middle',.5],['end',1]]){const scroll=await dialog.evaluate((e,f)=>{const possible=[e,...e.querySelectorAll('*')].filter(n=>n.scrollHeight>n.clientHeight+1&&['auto','scroll'].includes(getComputedStyle(n).overflowY));const scroller=possible.sort((a,b)=>(b.scrollHeight-b.clientHeight)-(a.scrollHeight-a.clientHeight))[0]||e;scroller.scrollTop=(scroller.scrollHeight-scroller.clientHeight)*f;return {target:scroller.id||scroller.className,top:scroller.scrollTop,max:scroller.scrollHeight-scroller.clientHeight,clientHeight:scroller.clientHeight};},fraction);await snap(name+'-'+part,{viewport:true,scroll});}
  }
  for(const view of ['home','team','projects','usage','queue','tips']){await page.evaluate(view=>PanelV2.select(view,true),view);await snap(view);if(view==='home'){if(await page.locator('#first-connect:visible').count()){await page.locator('#first-connect').evaluate(e=>e.click());assert.equal(connectWrites,0,'Disabled connection sends no request');await snap('home-disabled-connect');}await page.locator('footer').scrollIntoViewIfNeeded();await snap('footer-version',{viewport:true});await page.evaluate(()=>window.scrollTo(0,0));}if(view==='team'&&await page.locator('.look-wire-hit[role=button]').count()){const wire=page.locator('.look-wire-hit[role=button]').first(),idleStroke=await wire.evaluate(e=>getComputedStyle(e).stroke);await page.keyboard.press('Tab');await wire.focus();const focus=await wire.evaluate(e=>{const s=getComputedStyle(e);return {role:e.getAttribute('role'),name:e.getAttribute('aria-label'),tabIndex:e.tabIndex,visible:e.matches(':focus-visible'),outline:s.outlineStyle,width:parseFloat(s.outlineWidth),stroke:s.stroke};});assert.equal(focus.role,'button');assert.ok(focus.name&&focus.tabIndex>=0&&focus.visible&&(focus.width>=2&&focus.outline!=='none'||focus.stroke!==idleStroke),'SVG line keeps its own keyboard focus');await snap('team-wire-focus');}}
  await page.evaluate(()=>PanelV2.select('home',true));
  const close=async()=>{if(await page.locator('#drawer[open]').count())await page.locator('#close-drawer').click();else if(await page.locator('dialog[open]').count())await page.keyboard.press('Escape');};
  for(const [id,name]of [['clean-wen','overview'],['clean-auto','automate'],['acel-trigger','accelerate'],['clean-preferences','preferences']]){
   await page.evaluate(id=>document.getElementById(id)?.click(),id);await page.locator('dialog[open]').waitFor();await snap(name);if(name==='accelerate')await rolled(name);await close();
  }
  await page.evaluate(()=>PanelBell.open());await page.locator('#drawer[open]').waitFor();await snap('bell');await close();
  await page.evaluate(lang=>PanelTeach.open(lang,PanelV2.state()?.snapshot),lang);await page.locator('#drawer[open] .teach-copy').waitFor();await snap('teach');
  const primary=page.locator('#drawer[open] .teach-copy');await primary.hover();await snap('teach-hover');await page.keyboard.press('Tab');await primary.focus();
  const focused=await primary.evaluate(e=>({visible:e.matches(':focus-visible'),width:parseFloat(getComputedStyle(e).outlineWidth),style:getComputedStyle(e).outlineStyle}));assert.ok(focused.visible&&focused.width>=2&&focused.style!=='none');await snap('teach-focus');
  if(phase==='after')for(const [selector,name]of [['#drawer[open] .teach-switch','discreet'],['#close-drawer','secondary']]){const control=page.locator(selector),before=await control.evaluate(e=>({background:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderColor}));await control.hover();const hover=await control.evaluate(e=>({background:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderColor}));assert.notDeepEqual(hover,before,name+' visible hover');await snap('teach-'+name+'-hover');await page.keyboard.press('Tab');await control.focus();const focus=await control.evaluate(e=>({visible:e.matches(':focus-visible'),width:parseFloat(getComputedStyle(e).outlineWidth),style:getComputedStyle(e).outlineStyle}));assert.ok(focus.visible&&focus.width>=2&&focus.style!=='none',name+' visible focus');await snap('teach-'+name+'-focus');}
  await page.evaluate(()=>{navigator.clipboard.writeText=text=>new Promise(resolve=>window.__copyRelease=()=>{window.__copies.push(text);resolve();});});await primary.click();assert.equal(await primary.isDisabled(),true);await snap('teach-disabled');await page.evaluate(()=>window.__copyRelease());await page.waitForFunction(()=>!document.querySelector('#drawer .teach-copy').disabled);await snap('teach-copied');
  await page.locator('#drawer .teach-advanced summary').click();await snap('teach-advanced');await page.locator('#drawer .teach-option[data-option=custom]').click();await snap('teach-custom');await rolled('teach-custom');await close();
  const fail=await context.newPage();fail.on('pageerror',e=>report.errors.push(e.message));await fail.route('**/api/status**',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic unavailable metadata'})}));
  await fail.goto(base+'/?lang='+lang);await fail.locator('#boot-retry').waitFor({state:'visible'});await fail.waitForFunction(()=>document.getElementById('startup-message')?.textContent.trim());
  const retry=await fail.locator('#boot-retry').evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return{variant:e.dataset.button,appearance:s.appearance,radius:s.borderTopLeftRadius,height:r.height,background:s.backgroundColor};});
  if(phase==='after'){assert.equal(retry.variant,'secondary');assert.equal(retry.appearance,'none');assert.ok(parseFloat(retry.radius)>0);assert.ok(retry.height>=44);}
  await fail.screenshot({path:path.join(out,lang+'-'+width+'-boot-error.png'),fullPage:true});await fail.close();
  report.cases.push({lang,width,records,keyboardFocus:focused,retry,connectWrites});await context.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.assetFailures,[]);assert.deepEqual(report.externalRequests,[]);report.ok=true;
}
main().catch(e=>{report.failure=e.message;process.exitCode=1;}).finally(async()=>{
 if(browser)await browser.close();if(server.listening)await new Promise(resolve=>server.close(resolve));
 const resolved=path.resolve(profile);if(path.dirname(resolved)===path.resolve(os.tmpdir())&&path.basename(resolved).startsWith('panel-buttons-'))fs.rmSync(resolved,{recursive:true,force:true});
 fs.writeFileSync(path.join(out,'buttons-validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,phase,tests:report.tests,cases:report.cases.length,failure:report.failure||null}));
});
