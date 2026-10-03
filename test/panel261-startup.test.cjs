'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const Start=require('../public/quick-start.js'),source=fs.readFileSync(path.join(__dirname,'../public/quick-start.js'),'utf8');
function setup({offline=false,language='en',fetcher=async()=>({ok:true,json:async()=>({})})}={}){
  const nodes={},handlers={},clock={now:0},intervals=[];
  function node(tag){return {tag,textContent:'',hidden:false,dataset:{},children:[],setAttribute(k,v){this[k]=v;},append(...items){this.children.push(...items);for(const item of items)if(item.id)nodes[item.id]=item;},prepend(...items){this.children.unshift(...items);for(const item of items)if(item.id)nodes[item.id]=item;},replaceChildren(...items){this.children=items;},querySelector(selector){return selector==='p'?this.children.find(n=>n.tag==='p'):null;}};}
  nodes['panel-boot']=node('section');nodes['panel-boot'].append(node('p'));const footer=node('footer'),main=node('main'),body=node('body'),html=node('html');html.lang=language;html.dataset.offline=String(offline);
  const d={documentElement:html,body,getElementById:id=>nodes[id]||null,createElement:node,querySelector:q=>q==='footer'?footer:q==='main'?main:null,addEventListener:(name,fn)=>{handlers['doc-'+name]=fn;},dispatchEvent:()=>{}};
  const root={document:d,fetch:fetcher,setInterval:fn=>{intervals.push(fn);return intervals.length;},clearInterval:()=>{},setTimeout:()=>1,clearTimeout:()=>{},CustomEvent:function(type,init){this.type=type;this.detail=init.detail;},addEventListener:(name,fn)=>{handlers[name]=fn;},navigator:{clipboard:{writeText:async()=>{}}}};
  const DateFake={now:()=>clock.now};vm.runInNewContext(source,{window:root,globalThis:root,Date:DateFake,Error,Number,Object,Array,Math,URLSearchParams});
  return {root,nodes,footer,main,handlers,clock,tick:()=>intervals.forEach(fn=>fn())};
}
test('startup uses measured reading counts and elapsed time, with no invented counts',()=>{
  assert.deepEqual(Start.progress({reading:{done:3,total:12,elapsedSeconds:8.7}},100),{done:3,total:12,seconds:8,discovering:false});
  assert.deepEqual(Start.progress({},4.9),{done:null,total:null,seconds:4,discovering:false});
  assert.equal(Start.valid({tasks:[{phase:{key:'doing'}}],usage:{sessions:[]}}),true);assert.equal(Start.valid({tasks:'PRIVATE',usage:{}}),false);
});
test('update check makes no request before click and offline makes no request even on click',async()=>{
  let calls=0;const app=setup({fetcher:async()=>{calls++;return {ok:true,json:async()=>({ok:true,currentVersion:'2.1.1',latestVersion:'2.2.0',updateAvailable:true,installMethod:'npx'})};}});
  assert.equal(calls,0);await app.nodes['check-update'].onclick();assert.equal(calls,1);assert.equal(app.nodes['check-update'].disabled,false);
  let offlineCalls=0;const disconnected=setup({offline:true,fetcher:async()=>{offlineCalls++;}});await disconnected.nodes['check-update'].onclick();assert.equal(offlineCalls,0);assert.match(disconnected.nodes['startup-message'].children[0].textContent,/Offline mode/);
});
test('dead server shows the one-command instruction in every language',async()=>{
  for(const language of ['en','pt','es']){const app=setup({language,fetcher:async()=>{throw Error('private folder / user details');}});await assert.rejects(app.root.fetch('/api/status'));assert.equal(app.nodes['startup-message'].textContent,Start.T[language].server);assert.doesNotMatch(app.nodes['startup-message'].textContent,/private folder|user details/);assert.equal(app.root.document.body.dataset.panelMounted,undefined);}
});
test('slow reading keeps real progress visible and offers example after 90 seconds',()=>{
  const app=setup({language:'pt'});app.root.PanelStartup.rendered({tasks:[],usage:{pending:true,progress:{done:2,total:9}}});assert.match(app.nodes['startup-progress'].textContent,/2 de 9/);assert.equal(app.nodes['startup-example'].hidden,true);app.clock.now=90000;app.tick();assert.equal(app.nodes['startup-example'].hidden,false);assert.equal(app.nodes['startup-message'].textContent,Start.T.pt.slow);
});
test('elapsed time advances while awaiting the next server response, including a failed reading',()=>{
  const app=setup();app.root.PanelStartup.received({tasks:[],usage:{pending:true},reading:{done:2,total:10,elapsedSeconds:5}});app.clock.now=3000;app.tick();assert.match(app.nodes['startup-progress'].textContent,/8 s/);app.root.PanelStartup.failed('server');app.clock.now=90000;app.tick();assert.equal(app.nodes['startup-message'].textContent,Start.T.en.server);assert.equal(app.nodes['startup-example'].hidden,false);
});
test('strange input and render exceptions show only a stable generic code',async()=>{
  const app=setup({language:'es',fetcher:async()=>({ok:true,json:async()=>({tasks:[{phase:null,private:'PRIVATE'}],usage:{}})})});const response=await app.root.fetch('/api/status');await assert.rejects(response.json());assert.equal(app.nodes['startup-message'].textContent,Start.T.es.broken);assert.doesNotMatch(app.nodes['startup-message'].textContent,/PRIVATE/);assert.equal(app.nodes['startup-example'].hidden,false);
  const second=setup();let prevented=false;second.handlers.error({preventDefault(){prevented=true;},message:'PRIVATE'});assert.equal(prevented,true);assert.match(second.nodes['startup-message'].textContent,/UI01/);
});
test('the final guard catches errors from the last render module without exposing the data',()=>{
  const app=setup();app.root.PanelV2={render(){throw Error('PRIVATE');},failure(){app.root.document.body.dataset.panelMounted='true';}};app.handlers.DOMContentLoaded();app.root.PanelV2.render({tasks:[],usage:{ready:true}});assert.equal(app.nodes['startup-message'].textContent,Start.T.en.broken);assert.equal(app.root.document.body.dataset.panelMounted,undefined);
});
test('offline also blocks external anchors and new backend offline signals',()=>{
  const app=setup();assert.equal(app.root.PanelStartup.offline(),false);app.root.PanelStartup.received({offline:true,tasks:[],usage:{}});let prevented=false,stopped=false;app.handlers['doc-click']({target:{closest:()=>({})},preventDefault(){prevented=true;},stopPropagation(){stopped=true;}});assert.equal(prevented,true);assert.equal(stopped,true);assert.equal(app.root.PanelStartup.offline(),true);
});
test('a failed version check reports the installed release instead of an older fallback',async()=>{const app=setup({fetcher:async()=>{throw Error('offline');}});await app.nodes['check-update'].onclick();assert.ok(app.nodes['startup-message'].children[0].textContent.includes(require('../package.json').version));});

test('versions never show arbitrary response strings',()=>{assert.equal(Start.version('2.1.1'),'2.1.1');assert.equal(Start.version('PRIVATE username'),' ?'.trim());});

test('initial language respects an explicit choice then saved choice then browser locale',()=>{assert.equal(Start.initialLanguage(null,null,'pt-BR'),'pt');assert.equal(Start.initialLanguage(null,'en','es-ES'),'en');assert.equal(Start.initialLanguage('es','pt','en-US'),'es');assert.equal(Start.initialLanguage('x','x','fr-FR'),'en');});
test('the status deadline covers a hanging request and a hanging JSON body',async()=>{for(const body of [false,true]){let expire,cleared=false,aborted=false;class Controller{constructor(){this.signal={};}abort(){aborted=true;}}const result=Start.boundedRead(async()=>body?{ok:true,json:()=>new Promise(()=>{})}:new Promise(()=>{}),'/api/status',{setTimer:fn=>{expire=fn;return 1;},clearTimer:()=>{cleared=true;},Controller});const rejected=assert.rejects(result,/READ_TIMEOUT/);expire();await rejected;assert.equal(cleared,true);assert.equal(aborted,true);}});
test('a partial snapshot mounts the screen and continues showing measured progress',()=>{const app=setup();app.root.PanelStartup.rendered({tasks:[],usage:{pending:true,sessions:[],progress:{done:2,total:7}}});assert.equal(app.root.document.body.dataset.panelMounted,'true');assert.match(app.nodes['startup-notice'].textContent,/2 of 7/);app.clock.now=90000;app.tick();assert.equal(app.nodes['startup-partial-example'].hidden,false);});
test('a new reading after a complete one keeps the panel mounted and the startup notice hidden',()=>{const app=setup();app.root.PanelStartup.rendered({tasks:[],usage:{ready:true,sessions:[]}});assert.equal(app.root.document.body.dataset.panelMounted,'true');assert.equal(app.nodes['startup-notice'].hidden,true);app.clock.now=180000;app.root.PanelStartup.rendered({tasks:[],usage:{ready:true,scanning:true,sessions:[],progress:{done:3,total:9}}});assert.equal(app.root.document.body.dataset.panelMounted,'true');assert.equal(app.nodes['startup-notice'].hidden,true);assert.equal(app.nodes['startup-partial-example'].hidden,true);});

test('every update method asks to close the running panel first',()=>{for(const lang of ['en','pt','es'])for(const method of ['clone','npx','zip'])assert.match(Start.T[lang][method],{en:/^Close the panel in the footer/,pt:/^Feche o painel no rodapé/,es:/^Cierra el panel desde el pie/}[lang]);});
