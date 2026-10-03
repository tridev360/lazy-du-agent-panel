'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const A=require('../public/acelerador.js'),V=require('../public/v21.js'),Copy=require('../public/copy-session.js');
const APPROVED_GEAR_LINES={
  "en": {
    "1": "Do one big task at a time. Call a helper only when you need one.",
    "2": "Up to 2 big tasks at the same time.",
    "3": "Up to 3 big tasks at the same time.",
    "4": "Up to 4 big tasks at the same time, with reviews running in parallel.",
    "5": "Run in parallel any tasks that do not touch the same files. Split big reviews into parts, have my approval question ready early, and if I use more than one AI, share the work with the other one too."
  },
  "pt": {
    "1": "Faça uma tarefa grande por vez. Chame um ajudante só quando precisar.",
    "2": "Até 2 tarefas grandes ao mesmo tempo.",
    "3": "Até 3 tarefas grandes ao mesmo tempo.",
    "4": "Até 4 tarefas grandes ao mesmo tempo, com as revisões em paralelo.",
    "5": "Rode em paralelo as tarefas que não mexem nos mesmos arquivos. Divida revisões grandes em partes, deixe a minha pergunta de aprovação pronta cedo e, se eu usar mais de uma IA, divida o trabalho com a outra também."
  },
  "es": {
    "1": "Haz una tarea grande a la vez. Llama a un ayudante solo cuando haga falta.",
    "2": "Hasta 2 tareas grandes al mismo tiempo.",
    "3": "Hasta 3 tareas grandes al mismo tiempo.",
    "4": "Hasta 4 tareas grandes al mismo tiempo, con las revisiones en paralelo.",
    "5": "Ejecuta en paralelo las tareas que no tocan los mismos archivos. Divide las revisiones grandes en partes, deja lista desde el principio mi pregunta de aprobación y, si uso más de una IA, reparte el trabajo con la otra también."
  }
};
const WIDTHS=[375,1280],LANGS=['en','pt','es'];
async function main(argv=process.argv.slice(2)){
  const value=k=>argv.includes(k)?argv[argv.indexOf(k)+1]:null,root=path.resolve(__dirname,'..'),out=path.resolve(value('--out')||process.env.OUTPUT_DIR||process.env.SAIDA||path.join(root,'validation-session-copy22'));
  fs.mkdirSync(out,{recursive:true});
  const report={kind:'Public fictional fixtures; copy controls only. No user file is read or written.',widths:WIDTHS,langs:LANGS,height:950,results:[],errors:[],externalRequests:[],assetErrors:[],requestFailures:[],posts:[],screenshots:0,ok:false};
  let browser,server,profile;
  try{
    const pw=require(value('--playwright')||process.env.PLAYWRIGHT_MODULE||'playwright-core'),executablePath=value('--browser')||pw.chromium.executablePath();
    assert.ok(fs.existsSync(executablePath),'Existing Chromium executable required; this tool never installs one');
    profile=fs.mkdtempSync(path.join(os.tmpdir(),'panel-session-copy22-'));
    server=require('../src/panel.cjs').createServer({profile,demoOnly:true});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const baseURL='http://127.0.0.1:'+server.address().port,snapshot=await(await fetch(baseURL+'/api/status?example=1&size=large')).json(),initial=await(await fetch(baseURL+'/api/example-acelerador')).json();
    assert.equal(snapshot.example,true);assert.equal(initial.ok,true);assert.equal(initial.modo,'publico');
    browser=await pw.chromium.launch({headless:true,executablePath,args:['--no-sandbox']});
    for(const lang of LANGS)for(const width of WIDTHS){
      const context=await browser.newContext({viewport:{width,height:950},isMobile:width===375,hasTouch:width===375,locale:lang==='pt'?'pt-BR':lang==='es'?'es-ES':'en-US'}),page=await context.newPage();
      let active=true;
      page.on('pageerror',error=>{if(active)report.errors.push({lang,width,message:error.message});});
      page.on('requestfailed',request=>{if(active)report.requestFailures.push({lang,width,path:new URL(request.url()).pathname,error:request.failure()?.errorText});});
      page.on('response',response=>{if(!active)return;const request=response.request(),url=new URL(response.url());if(request.method()==='POST')report.posts.push({lang,width,path:url.pathname,status:response.status()});if(['script','stylesheet','image','font','media'].includes(request.resourceType())&&response.status()>=400)report.assetErrors.push({lang,width,path:url.pathname,status:response.status()});});
      page.on('request',request=>{const url=new URL(request.url());if(active&&url.origin!==baseURL&&!['data:','blob:'].includes(url.protocol))report.externalRequests.push({lang,width,origin:url.origin});});
      try{
        await context.addInitScript(()=>{window.__sessionCopies=[];window.__copyDenied=false;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{if(window.__copyDenied)throw Error('Fictional blocked clipboard');window.__sessionCopies.push(text);}}});document.execCommand=()=>false;});
        await page.route('**/api/status**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(snapshot)}));
        await page.goto(baseURL+'/?example=1&size=large&lang='+lang);
        await page.waitForFunction(()=>document.body.dataset.panelMounted==='true'&&!!window.PanelCopySession&&!!window.PainelAcelerador?.instancia);
        await page.evaluate(()=>document.fonts?.ready);
        async function picture(name){
          const check=await page.evaluate(()=>{
            const controls=[...document.querySelectorAll('.copy-session-button,.copy-session-switch,.acel-ligar,.acel-opcao')].filter(n=>n.getClientRects().length&&!!n.closest('dialog[open]'));
            return {overflow:document.documentElement.scrollWidth>innerWidth,smallTargets:controls.filter(n=>{const r=n.getBoundingClientRect();return r.width<43.9||r.height<43.9;}).map(n=>n.className),copyOverflow:[...document.querySelectorAll('dialog[open] .copy-session')].some(n=>n.scrollWidth>n.clientWidth+1)};
          });
          assert.equal(check.overflow,false,lang+' '+width+' '+name+' horizontal overflow');assert.equal(check.copyOverflow,false,name+' copy-group overflow');assert.deepEqual(check.smallTargets,[],name+' 44px targets');
          await page.screenshot({path:path.join(out,lang+'-'+width+'-'+name+'.png'),fullPage:true});report.screenshots++;report.results.push({lang,width,kind:'picture',name,...check});
        }
        async function copy(group,expected,target='claude',writesFile=false){
          assert.equal(await group.getAttribute('data-target'),target);
          assert.equal(await group.locator('.copy-session-phrase').textContent(),Copy.phrase(lang,target,writesFile));
          const before=await page.evaluate(()=>window.__sessionCopies.length),posts=report.posts.length;
          await group.locator('.copy-session-button').click();
          await page.waitForFunction(n=>window.__sessionCopies.length===n+1,before);
          assert.equal(await page.evaluate(()=>window.__sessionCopies.at(-1)),expected);
          assert.equal(report.posts.length,posts,'Copying must not record an acceleration change');
        }
        await page.locator('#clean-auto').click();
        let group=page.locator('#drawer .copy-session');
        assert.equal(await page.locator('#drawer .summary-note').first().textContent(),V.automateText(lang).note);
        assert.equal(await page.locator('#drawer textarea').first().inputValue(),V.automateText(lang).plan);
        await picture('automate');
        await copy(group,V.automateText(lang).plan);
        await group.locator('.copy-session-switch').click();
        await copy(group,V.automateText(lang).plan,'codex');
        await page.evaluate(()=>window.__copyDenied=true);
        await group.locator('.copy-session-button').click();
        await group.locator('.copy-session-fallback').waitFor({state:'visible'});
        assert.equal(await group.locator('.copy-session-fallback').textContent(),V.automateText(lang).plan);
        assert.equal(await group.locator('.copy-session-status').textContent(),Copy.T[lang].failed);
        await picture('automate-blocked');
        await page.evaluate(()=>{window.__copyDenied=false;document.getElementById('drawer').close();});
        await page.locator('#acel-trigger').click();
        for(let id=1;id<=11;id++){
          const fases=Object.fromEntries(Array.from({length:id-1},(_,i)=>[i+1,{em:'2030-01-01T00:00:00Z'}]));
          await page.evaluate(({initial,fases,lang})=>PainelAcelerador.instancia.atualizar({...initial,fases,marcha:{n:1,em:'2030-01-01T00:00:00Z'}},lang),{initial,fases,lang});
          group=page.locator('#acel-gaveta [data-acel-copy="phase-'+id+'"]');
          await copy(group,A.phaseText(id,lang),'claude',A.phaseWritesFile(id));
          await group.locator('.copy-session-switch').click();
          await copy(group,A.phaseText(id,lang),'codex',A.phaseWritesFile(id));
          if(id===1){await group.scrollIntoViewIfNeeded();await picture('phase-rule-codex');}
          if(id===2)assert.equal(await page.locator('#acel-q-2').textContent(),A.COPY_TEXT[lang].question2);
          if(id===9){await group.scrollIntoViewIfNeeded();await picture('phase-plain-codex');}
          report.results.push({lang,width,kind:'phase',id,targets:['claude','codex'],writesFile:A.phaseWritesFile(id),exactText:true});
        }
        for(let n=1;n<=5;n++){
          group=page.locator('#acel-gaveta [data-acel-copy="gear-'+n+'"]');
          const visible=await page.locator('#acel-gaveta [data-acel-marcha="'+n+'"] .acel-opcao-linha').textContent();
          assert.equal(visible,APPROVED_GEAR_LINES[lang][n],'Gear line matches approved final text');
          await copy(group,A.gearText(n,lang,visible),'claude',true);
          await group.locator('.copy-session-switch').click();
          await copy(group,A.gearText(n,lang,visible),'codex',true);
          assert.equal(await page.locator('#acel-gaveta [data-acel-marcha="'+n+'"] button').count(),0,'No nested buttons');
          report.results.push({lang,width,kind:'gear',n,visibleLine:visible,targets:['claude','codex'],writesFile:true,exactText:true});
          if(n===2){await group.scrollIntoViewIfNeeded();await picture('gear-codex');}
        }
        assert.equal(await page.locator('#acel-gaveta [data-acel-marcha="1"]').getAttribute('aria-pressed'),'true','Copies retain selected gear');
        assert.equal(await page.locator('#acel-gaveta [data-acel-provisional]').count(),0,'No provisional copy or markup');
        group=page.locator('#acel-gaveta [data-acel-copy="phase-11"]');
        await page.evaluate(()=>window.__copyDenied=true);
        await group.locator('.copy-session-button').click();
        await group.locator('.copy-session-fallback').waitFor({state:'visible'});
        assert.equal(await group.locator('.copy-session-fallback').textContent(),A.phaseText(11,lang));
        await picture('phase-blocked');
        assert.deepEqual(report.posts.filter(p=>p.lang===lang&&p.width===width),[],'Copy flows perform no POST');
      }finally{active=false;await context.close();}
    }
    assert.deepEqual(report.errors,[],'No page error');assert.deepEqual(report.assetErrors,[],'All public assets load');assert.deepEqual(report.requestFailures,[],'No failed request during the proof');assert.deepEqual(report.externalRequests,[],'No external request without consent');report.ok=true;
  }catch(error){report.errors.push({message:error.message});throw error;}
  finally{
    fs.writeFileSync(path.join(out,'session-copy22-validation.json'),JSON.stringify(report,null,2)+'\n');
    if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));
    if(profile){const resolved=path.resolve(profile),expected=path.resolve(os.tmpdir())+path.sep;if(resolved.startsWith(expected)&&path.basename(resolved).startsWith('panel-session-copy22-'))fs.rmSync(resolved,{recursive:true,force:true});}
    process.stdout.write(JSON.stringify({ok:report.ok,screenshots:report.screenshots,output:out})+'\n');
  }
}
module.exports={main,WIDTHS,LANGS};
if(require.main===module)main().catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});

