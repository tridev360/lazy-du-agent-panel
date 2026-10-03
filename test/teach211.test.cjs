'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Teach=require('../public/teach.js');
const source=fs.readFileSync(path.join(__dirname,'../public/teach.js'),'utf8'),copySource=fs.readFileSync(path.join(__dirname,'../public/copy-session.js'),'utf8');
test('copied rules default to the global Claude file and replace only the marked bullet section',()=>{
  for(const lang of ['en','pt','es']){
    const value=Teach.ruleText(undefined,lang),[instruction,body]=value.split('\n\n');
    assert.equal(instruction,Teach.SIMPLE[lang].instruction);
    assert.equal(body.split('\n')[0],Teach.SIMPLE[lang].header);
    const bullets=body.split('\n').slice(1);assert.ok(bullets.every(line=>line.startsWith('- ')));
    assert.equal(bullets.length,10);assert.equal(bullets[9],Teach.MODEL_EFFORT[lang]);assert.equal(bullets[6],Teach.SIMPLE[lang].folderLine);
    assert.ok(instruction.includes('"## Lazy Du Agent Panel"'));assert.ok(instruction.includes('"- "'));
    assert.match(instruction,/cloud session|sessão na nuvem|sesión en la nube/);
    assert.match(instruction,/and stop\.$|e pare\.$|y detente\.$/);
    assert.ok(!/[\u2013\u2014]/.test(value));
    assert.equal(Teach.text({mode:'own'},lang),'');assert.equal(Teach.ruleText({mode:'own'},lang),'');
    assert.equal(Teach.lines({mode:'recommended'},lang).length,10,'legacy rule API remains available');
  }
});
test('Codex gets only its file and project scope stays explicit',()=>{
  for(const lang of ['en','pt','es']){
    const value=Teach.ruleText({},lang,'codex');assert.ok(value.startsWith(Teach.SIMPLE[lang].instruction.replace('~/.claude/CLAUDE.md','~/.codex/AGENTS.md')));assert.ok(!value.includes('~/.claude/CLAUDE.md'));
    for(const target of ['claude','codex']){const local=Teach.ruleText({},lang,target,'project');assert.ok(!local.includes('~/'));assert.ok(local.includes(target==='claude'?'CLAUDE.md':'AGENTS.md'));assert.match(local,/only to this project|só neste projeto|solo en este proyecto/);}
  }
});
test('custom rule choices are copied while default recommendation stays intact',()=>{
  const picks=Object.fromEntries(Teach.TASKS.map(task=>[task,'codex']));const custom=Teach.ruleText({mode:'custom',picks},'en');assert.ok(custom.includes(Teach.taskLine('code','codex','en')));
  assert.ok(Teach.ruleText({},'pt').includes(Teach.T.pt.recommendedLines.code));
});
class Node{
  constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.style={};this.className='';this.hidden=false;this.open=false;}
  append(...nodes){this.children.push(...nodes);for(const node of nodes)if(node&&typeof node==='object')node.parent=this;}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  setAttribute(key,value){this.attributes[key]=value;}
  removeAttribute(key){delete this.attributes[key];}
  querySelectorAll(selector){const out=[];for(const node of this.children){if(!node||typeof node!=='object')continue;if(selector.startsWith('.')?node.className.split(' ').includes(selector.slice(1)):node.tagName===selector)out.push(node);out.push(...node.querySelectorAll(selector));}return out;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  focus(){this.focused=true;}select(){this.selected=true;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);}
}
function browser(clipboard){
  const document={documentElement:{lang:'pt'},body:new Node('body'),createElement:tag=>new Node(tag),createTextNode:text=>Object.assign(new Node('text'),{textContent:text}),createRange:()=>({selectNodeContents(node){this.node=node;}})};
  const selection={removeAllRanges(){},addRange(range){this.range=range;}};
  const window={document,navigator:{clipboard},localStorage:{getItem:()=>null,setItem(){}},getSelection:()=>selection,panelDrawer(title,nodes){this.drawer=nodes[0];}};
  vm.runInNewContext(copySource,{window});vm.runInNewContext(source,{window});return {window,document,selection};
}
test('one main copy action and one target link; advanced choices start closed',async()=>{
  let copied;const b=browser({writeText:async value=>{copied=value;}});b.window.PanelTeach.open('pt');const box=b.window.drawer,button=box.querySelector('.teach-copy'),switcher=box.querySelector('.teach-switch'),advanced=box.querySelector('details'),status=box.querySelector('.teach-status');
  assert.equal(button.textContent,'Copiar e colar no Claude Code');assert.equal(switcher.textContent,'Uso o Codex');assert.equal(advanced.open,false);
  assert.equal(box.querySelectorAll('.copy-session').filter(node=>node.button.dataset.button==='primary').length,1);assert.equal(box.querySelectorAll('.copy-session-phrase').length,3);assert.equal(box.querySelector('.copy-session-phrase').textContent,Teach.SIMPLE.pt.afterClaude);
  await button.onclick();assert.equal(copied,Teach.ruleText({},'pt'));assert.equal(status.textContent,Teach.SIMPLE.pt.afterClaude);assert.equal(advanced.open,false);
  switcher.onclick();assert.equal(button.textContent,'Copiar e colar no Codex');assert.equal(switcher.textContent,'Uso o Claude Code');await button.onclick();assert.equal(copied,Teach.ruleText({},'pt','codex'));assert.equal(status.textContent,Teach.SIMPLE.pt.afterCodex);
  const project=advanced.querySelectorAll('.teach-scope').find(node=>node.dataset.scope==='project');project.onclick();await button.onclick();assert.equal(copied,Teach.ruleText({},'pt','codex','project'));
  assert.ok(advanced.querySelectorAll('.teach-option').some(node=>node.dataset.option==='custom'));
});
test('clipboard fallback removes its temporary field and manual fallback reveals/selects rules',async()=>{
  const b=browser({writeText:async()=>{throw Error('denied');}});let command;b.document.execCommand=name=>{command=name;return true;};
  assert.equal(await Teach.copyToClipboard('copy me',b.window),true);assert.equal(command,'copy');assert.equal(b.document.body.children.length,0);
  delete b.document.execCommand;b.window.PanelTeach.open('pt');await b.window.drawer.querySelector('.teach-copy').onclick();
  assert.equal(b.window.drawer.querySelector('details').open,true);assert.equal(b.selection.range.node.textContent,Teach.ruleText({},'pt'));assert.equal(b.window.drawer.querySelector('.teach-status').textContent,Teach.T.pt.select);
});
test('teaching makes no file or network requests and distinguishes the panel from the local AI',()=>{
  assert.doesNotMatch(source,/\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|require\(/);
  assert.match(source,/person's local AI to save the rules if the person approves/);
  for(const lang of ['en','pt','es'])assert.match(Teach.T[lang].promise,/only copies|só copia|solo copia/i);
});

test('a target switch during clipboard permission keeps the after-copy instruction with the copied target',async()=>{
  let resolve;const b=browser({writeText:()=>new Promise(done=>{resolve=done;})});b.window.PanelTeach.open('pt');const button=b.window.drawer.querySelector('.teach-copy'),action=button.onclick();assert.equal(button.disabled,true);assert.equal(button.attributes['aria-busy'],'true');b.window.drawer.querySelector('.teach-switch').onclick();resolve();await action;assert.equal(button.disabled,false);assert.equal(button.attributes['aria-busy'],undefined);assert.equal(b.window.drawer.querySelector('.teach-status').textContent,Teach.SIMPLE.pt.afterClaude);
});

test('blocked removal copy selects the removal request rather than installation rules',async()=>{for(const lang of ['en','pt','es'])for(const keep of [false,true]){const b=browser({writeText:async()=>{throw Error('denied');}});b.window.PanelTeach.open(lang);if(keep)b.window.drawer.querySelectorAll('.teach-option').find(node=>node.dataset.option==='keep').onclick();const remove=b.window.drawer.querySelector('.teach-remove');await remove.onclick();assert.equal(b.window.drawer.querySelector('.teach-block').hidden,false);assert.equal(remove.disabled,false);assert.equal(remove.attributes['aria-busy'],undefined);assert.equal(b.window.drawer.querySelector('details').open,true);const selected=b.selection.range.node.textContent;assert.equal(selected,Teach.removalText(lang,'claude','project'));assert.ok(selected.includes('## Lazy Du Agent Panel'));assert.ok(!selected.includes(Teach.SIMPLE[lang].instruction));assert.equal(b.window.drawer.querySelector('.teach-status').textContent,Teach.T[lang].select);}});

test('global and old-project removal copy the exact approved requests in every language and target',async()=>{
  for(const lang of ['en','pt','es'])for(const target of ['claude','codex']){const copied=[],b=browser({writeText:async value=>copied.push(value)});b.window.PanelTeach.open(lang);if(target==='codex')b.window.drawer.querySelector('.teach-switch').onclick();const global=b.window.drawer.querySelector('.teach-remove-global'),project=b.window.drawer.querySelector('.teach-remove');await global.onclick();await project.onclick();assert.deepEqual(copied,[Teach.removalText(lang,target,'global'),Teach.removalText(lang,target,'project')]);assert.ok(copied.every(text=>!text.includes(target==='codex'?'CLAUDE.md':'AGENTS.md')));assert.ok(!copied[1].includes('~/'));assert.ok(copied[0].includes(target==='codex'?'~/.codex/AGENTS.md':'~/.claude/CLAUDE.md'));for(const phrase of b.window.drawer.querySelectorAll('.copy-session-phrase'))assert.equal(phrase.textContent,b.window.PanelCopySession.phrase(lang,target,true));}
});
test('approved model and effort policy is exactly the tenth bullet, including custom project choices',()=>{
  for(const lang of ['en','pt','es'])for(const target of ['claude','codex'])for(const scope of ['global','project']){const copied=Teach.ruleText({mode:'custom',picks:{code:'claude'}},lang,target,scope),bullets=copied.split('\n\n')[1].split('\n').slice(1);assert.equal(bullets.length,10);assert.equal(bullets[9],Teach.MODEL_EFFORT[lang]);assert.doesNotMatch(copied,/to remove them, delete|para tirar, apague|para quitarlas, borra/);}
});
