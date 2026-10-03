'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const arg=name=>process.argv[process.argv.indexOf(name)+1];
const out=path.resolve(process.env.SAIDA||process.cwd());fs.mkdirSync(out,{recursive:true});
if(process.argv.includes('--browser-cache'))process.env.PLAYWRIGHT_BROWSERS_PATH=arg('--browser-cache');
const pw=require(arg('--playwright'));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'panel-project-rules-'));
const server=require('../src/panel.cjs').createServer({demoOnly:true,offline:true,profile});
let browser;
const report={kind:'Fictional local metadata fixtures; no user files',cases:[],errors:[],externalRequests:[],ok:false};
async function main(){
  const tests=fs.readdirSync(path.resolve('test')).filter(file=>file.endsWith('.test.cjs')).map(file=>'test/'+file);
  const gate=spawnSync(process.execPath,['--test','--test-concurrency=1',...tests],{encoding:'utf8',maxBuffer:4*1024*1024});fs.writeFileSync(path.join(out,'tests.txt'),(gate.stdout||'')+(gate.stderr||''));assert.equal(gate.status,0,'Public full suite');
  const passed=(gate.stdout||'').match(/# pass (\d+)/);report.tests=passed?Number(passed[1]):null;
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  const fixture=await(await fetch(base+'/api/status?example=1')).json();fixture.example=false;
  fixture.projects=[{id:'rules-found',name:'Garden'},{id:'rules-missing',name:'Studio'},{id:'rules-unknown',name:'Archive'}];
  fixture.guidance={...(fixture.guidance||{}),alerts:[],projects:[{key:'rules-found',name:'Garden',rulesEnabled:true,state:'active'},{key:'rules-missing',name:'Studio',rulesEnabled:false,state:'active'},{key:'rules-unknown',name:'Archive',rulesEnabled:null,state:'active'}]};
  browser=await pw.chromium.launch({headless:true,args:['--no-sandbox'],executablePath:process.argv.includes('--browser')?arg('--browser'):pw.chromium.executablePath()});
  for(const lang of ['en','pt','es'])for(const width of [375,1440]){
    const context=await browser.newContext({viewport:{width,height:950},locale:lang==='pt'?'pt-BR':lang==='es'?'es-ES':'en-US',reducedMotion:'reduce'}),page=await context.newPage();
    page.on('pageerror',error=>report.errors.push(error.message));page.on('request',request=>{if(!request.url().startsWith(base+'/')&&!request.url().startsWith('data:'))report.externalRequests.push(new URL(request.url()).origin);});
    await context.addInitScript(()=>{window.__ruleCopies=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.__ruleCopies.push(text)}});});
    await page.route('**/api/status**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture)}));
    await page.goto(base+'/?lang='+lang);await page.waitForFunction(()=>document.body.dataset.panelMounted==='true'&&!!window.PanelGuidance);
    await page.locator('#tab-projects').click();const rows=page.locator('#look-sessions .project-rules-entry');assert.ok(await rows.count()>=3);
    for(const [id,state]of [['rules-found','found'],['rules-missing','missing'],['rules-unknown','unknown']]){
      const row=page.locator('#look-sessions .project-rules-entry[data-project-key="'+id+'"]');assert.equal(await row.locator('.project-rule-note').getAttribute('data-rules-state'),state);assert.equal(await row.locator('button button').count(),0);
      await row.locator('.project-rules-action').waitFor({state:'visible'});const target=await row.locator('.project-rules-action').boundingBox();assert.ok(target&&target.height>=44);assert.ok(target.width>=44);
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const target=page.locator('#look-sessions [data-rules-project="rules-missing"]');await page.keyboard.press('Tab');await target.focus();await page.evaluate(({data,lang})=>PanelV2.render(data,lang),{data:fixture,lang});assert.equal(await page.evaluate(()=>document.activeElement.dataset.rulesProject),'rules-missing');const focus=await target.evaluate(el=>({visible:el.matches(':focus-visible'),width:parseFloat(getComputedStyle(el).outlineWidth)}));assert.ok(focus.visible&&focus.width>=2,'Visible keyboard focus');
    await page.screenshot({path:path.join(out,lang+'-'+width+'-project-rules.png'),fullPage:true});
    await target.click();await page.locator('#drawer[open] .teach-copy').click();assert.equal(await page.evaluate(()=>window.__ruleCopies.length),1);const copied=await page.evaluate(()=>window.__ruleCopies[0]);assert.ok(copied.includes('~/.claude/CLAUDE.md'));assert.ok(copied.includes('## Lazy Du Agent Panel'));
    const main=page.locator('#drawer[open] .teach-simple > .copy-session');
    async function oneNextStep(){
      const phrase=await main.locator('.copy-session-phrase').innerText();
      const count=await page.locator('#drawer[open] .teach-simple').evaluate((box,phrase)=>[...box.querySelectorAll('p')].filter(p=>p.textContent===phrase&&!p.closest('details:not([open])')&&p.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})).length,phrase);
      assert.equal(count,1,'One visible next-step instruction after copying');
      assert.equal(await page.locator('#drawer[open] .teach-status').innerText(),await page.evaluate(lang=>PanelCopySession.T[lang].copied,lang));
      assert.equal(await page.locator('#drawer[open] .teach-advanced').getAttribute('open'),null);
    }
    await oneNextStep();
    await page.screenshot({path:path.join(out,lang+'-'+width+'-project-teach.png'),fullPage:true});
    await main.locator('.teach-switch').click();await main.locator('.teach-copy').click();
    assert.equal(await page.evaluate(()=>window.__ruleCopies.length),2);
    const codexCopy=await page.evaluate(()=>window.__ruleCopies[1]);assert.ok(codexCopy.includes('~/.codex/AGENTS.md'));assert.ok(!codexCopy.includes('~/.claude/CLAUDE.md'));await oneNextStep();
    await page.screenshot({path:path.join(out,lang+'-'+width+'-project-teach-codex.png'),fullPage:true});
    report.cases.push({lang,width,states:['found','missing','unknown'],nestedButtons:0,overflow:false,minimumTarget:44,focusPreserved:true,teachingOpened:true,copiedInstructionVerified:true,codexCopiedInstructionVerified:true,oneNextStep:true,advancedClosed:true,keyboardFocusVisible:true});await context.close();
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);report.ok=true;
}
main().catch(error=>{report.failure=error.message;process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();if(server.listening)await new Promise(resolve=>server.close(resolve));
  const resolved=path.resolve(profile);if(path.dirname(resolved)===path.resolve(os.tmpdir())&&path.basename(resolved).startsWith('panel-project-rules-'))fs.rmSync(resolved,{recursive:true,force:true});
  fs.writeFileSync(path.join(out,'project-rules-validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,tests:report.tests,cases:report.cases.length,failure:report.failure||null}));
});
