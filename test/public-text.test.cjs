'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
function files(dir,pattern){const out=[];for(const entry of fs.readdirSync(path.join(ROOT,dir),{withFileTypes:true})){const rel=dir+'/'+entry.name;if(entry.isDirectory())out.push(...files(rel,pattern));else if(pattern.test(entry.name))out.push(rel);}return out;}

test('published text has no long dashes and no local absolute paths',()=>{
  const dash=new RegExp('['+String.fromCharCode(0x2013,0x2014)+']'),local=/[A-Za-z]:(?:\\{1,2}|\/)Users(?:\\{1,2}|\/)|\/(?:Users|home)\/[\w.-]+\//i;
  const list=[...files('public',/\.(?:js|css|html|json|svg)$/),...files('src',/\.cjs$/),...files('tools',/\.cjs$/),'README.md','README.pt-BR.md','CHANGELOG.md','example.json','example-solo.json','package.json'];
  assert.ok(list.length>60,'the scan covers the published tree');
  for(const file of list){const text=read(file);assert.doesNotMatch(text,dash,file+' uses ": ", " · " or "." instead of a long dash');assert.doesNotMatch(text,local,file+' must not carry a local path');}
});

test('the documented task header and decisions file are exactly what the folder reader accepts',t=>{
  const {TaskBoard}=require('../src/lib/task-board.cjs'),{parseTask}=require('../src/lib/workspace.cjs'),Locale=require('../public/locale.js');
  for(const readme of ['README.md','README.pt-BR.md']){const sample=/~~~md\r?\n([\s\S]*?)~~~/.exec(read(readme));assert.ok(sample,readme+' shows the task header');const task=parseTask(sample[1],'sample');assert.ok(task,readme+' example is a readable task');assert.equal(task.phase.percent,40);assert.match(read(readme),/decisions\.md/);}
  const r9=read('public/r9.js'),hints=r9.match(/hint:'[^']*'/g)||[];assert.equal(hints.length,2,'en and pt hints');for(const hint of hints)assert.match(hint,/decisions\.md/);
  const en=/hint:'([^']*)'/.exec(r9)[1];assert.notEqual(Locale.text(en,'es'),en,'Spanish hint exists');assert.match(Locale.text(en,'es'),/decisions\.md/);
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'panel-format-'));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));const folder=path.join(home,'tasks');fs.mkdirSync(folder);
  fs.writeFileSync(path.join(folder,'menu.md'),'---\nphase: doing\n---\n# Draw the menu\n');
  fs.writeFileSync(path.join(folder,'notes.md'),'Plain notes without a header\n');
  fs.writeFileSync(path.join(folder,'decisions.md'),'# Decisions\n## 1. Which music fits the menu?\n## 2. DONE Pick the font\n');
  const s=new TaskBoard(home,{profile:home}).connect(folder);
  assert.deepEqual(s.tasks.map(x=>x.title).sort(),['Draw the menu','Which music fits the menu?']);
  assert.deepEqual(s.tasks.filter(x=>x.needsOwner).map(x=>x.title),['Which music fits the menu?']);
});

function sliceRun(source,from,to,context,call){const words=source.slice(source.indexOf('const words='),source.indexOf('\n  };',source.indexOf('const words='))+5),start=source.indexOf(from),end=source.indexOf(to,start);assert.ok(start>0&&end>start,'functions found in v21.js');vm.runInNewContext(words+'\nconst w=()=>words[lang]||words.en;\n'+source.slice(start,end)+'\nresult='+call+';',context);return context.result;}
function overview(lang,snapshot,readingFailed=false){return sliceRun(read('public/v21.js'),'  function title(a){','  function completedAccess(){',{lang,snapshot,readingFailed,root:{PanelR9:{credit:()=>({available:false})}}},'summaryValues()');}

test('overview lines say what was not read instead of an empty or invented value',()=>{
  const live={example:false,usage:{ready:true,errors:0,sessions:[{state:'working',taskTitle:null,projectName:'tiny-game'}]},tasks:[],cards:[]};
  const expected={en:'Tasks not connected',pt:'Tarefas não conectadas',es:'Tareas no conectadas'};
  for(const lang of ['en','pt','es']){
    const values=overview(lang,{...live,board:{connected:false,status:'disconnected'}});
    assert.equal(values[0],expected[lang],lang+': a folder that is not connected is not an empty delivery list');
    assert.equal(values[1],'tiny-game',lang+': recent activity falls back to the project name');
  }
  assert.equal(overview('en',{...live,usage:{...live.usage,sessions:[{state:'working'}]},board:{connected:false}})[1],'?','nothing to name is unknown, never blank');
  assert.equal(overview('pt',{...live,usage:{...live.usage,sessions:[{state:'working',taskTitle:'GAME MENU',taskTitlePT:'MENU DO JOGO'}]},board:{connected:false}})[1],'MENU DO JOGO');
  assert.equal(overview('en',{...live,board:{connected:true,status:'connected'},tasks:[{title:'Undated',phase:{percent:100}}]})[0],'None in this reading','a completion without a date is not a delivery');
  assert.equal(overview('en',{...live,board:{connected:true,status:'connected'},tasks:[{title:'Dated',phase:{percent:100},completedAt:'2030-01-07T10:00:00Z'}]})[0],'Dated');
  assert.equal(overview('en',{...live,example:true,tasks:[{title:'Game menu',phase:{percent:100}}]})[0],'Game menu');
  assert.deepEqual(Array.from(overview('en',live,true)).filter((x,i)=>i!==4),Array(5).fill('Not available'));
});

test('the source badge always marks the fictional example',()=>{
  const badge=(lang,snapshot,readingFailed=false)=>sliceRun(read('public/v21.js'),'  function sourceBadge(){','  function update(){',{lang,snapshot,readingFailed},'sourceBadge()');
  assert.equal(badge('en',{example:true}),'EXAMPLE · FICTIONAL PROJECT');
  assert.equal(badge('pt',{example:true}),'EXEMPLO · PROJETO FICTÍCIO');
  assert.equal(badge('es',{example:true}),'EJEMPLO · PROYECTO FICTICIO');
  assert.equal(badge('en',{example:false}),'Local reading');
  assert.match(badge('en',{example:true},true),/^Reading not available/);
});

test('the public accelerator marks steps on this panel and dates its choices in UTC',()=>{
  const A=require('../public/acelerador.js');
  for(const lang of ['en','pt','es']){
    const ui={...A.TEXTOS[lang].ui,...A.TEXTOS[lang].publico};
    assert.doesNotMatch(ui.ligar+' '+ui.ligou('X')+' '+ui.semFase+' '+ui.foraDeOrdem+' '+ui.semFaseSomar,/Turn on|Ligue|Ligar|Activa/,lang);
    assert.match(ui.ligou('X'),/^X: (marked on this panel|marcada neste painel|marcada en este panel)\.$/);
    assert.equal(ui.lista,({"en":"Each step has a text your AI can apply. Marking it here only records it on this panel.","pt":"Cada fase tem um texto para a sua IA aplicar. Marcar aqui só registra neste painel.","es":"Cada fase tiene un texto para que tu IA lo aplique. Marcar aquí solo lo registra en este panel."})[lang]);
    assert.match(A.TEXTOS[lang].ui.escolhidaAs(A.diaDe('2030-10-03T00:54:00Z',lang),A.horaDe('2030-10-03T00:54:00Z')),/00:54 UTC$/);
  }
  assert.equal(A.diaDe('2030-10-03T00:54:00Z','en'),'Oct 3');
  assert.equal(A.diaDe('2030-10-03T00:54:00Z','pt'),'3 de outubro');
  assert.equal(A.diaDe('2030-10-03T00:54:00Z','es'),'3 de octubre');
  assert.equal(A.diaDe('not a date','en'),'');
});
