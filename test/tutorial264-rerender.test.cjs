'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../public/tutorial264.js'),'utf8');
function harness(){
  const queue=[],nodes=[],document={documentElement:{lang:'pt'},activeElement:null};
  class Element{
    constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.listeners={};this.parentElement=null;this.hidden=false;this.open=false;this.paused=true;this.scrollHeight=0;this.clientHeight=0;this.scrollWidth=0;this.clientWidth=0;this.scrollTop=0;this.scrollLeft=0;this.pauseCalls=0;this.loadCalls=0;nodes.push(this);}
    get isConnected(){return this===document.body||!!this.parentElement?.isConnected;}
    get src(){return this.attributes.src||'';}set src(value){this.attributes.src=value;}
    setAttribute(name,value){this.attributes[name]=String(value);}removeAttribute(name){delete this.attributes[name];}hasAttribute(name){return Object.hasOwn(this.attributes,name);}
    append(...items){for(const item of items){item.parentElement=this;this.children.push(item);}}
    replaceChildren(...items){for(const item of this.children)item.parentElement=null;this.children=[];this.append(...items);}
    contains(target){return this===target||this.children.some(item=>item.contains(target));}
    addEventListener(type,callback){(this.listeners[type]||=[]).push(callback);}
    focus(){document.activeElement=this;}getClientRects(){return this.isConnected&&!this.hidden?[{}]:[];}
    pause(){this.paused=true;this.pauseCalls++;}load(){this.loadCalls++;}
    showModal(){this.nativeReturnFocus=document.activeElement;this.open=true;this.focus();}close(){const ownsFocus=this.contains(document.activeElement);this.open=false;if(ownsFocus)document.activeElement=this.nativeReturnFocus?.isConnected?this.nativeReturnFocus:document.body;queue.push(()=>{for(const callback of this.listeners.close||[])callback();});}
    remove(){const parent=this.parentElement;if(parent){parent.children=parent.children.filter(item=>item!==this);this.parentElement=null;}}
  }
  document.body=new Element('body');document.activeElement=document.body;document.createElement=tag=>new Element(tag);
  const window={document,scrollX:12,scrollY:230,scrollTo({left,top}){this.scrollX=left;this.scrollY=top;},PanelTutorialManifest:{version:1,tutorials:{pt:{locale:'pt',approvalMatched:true,durationSeconds:2.4,video:{src:'/tutorial-painel/fixture.pt.mp4',bytes:100,sha256:'a'.repeat(64)},subtitle:{src:'/tutorial-painel/fixture.pt.vtt',bytes:80,sha256:'b'.repeat(64)}}}}};
  vm.runInNewContext(source,{window});
  const container=new Element('section');container.scrollHeight=1000;container.clientHeight=300;container.scrollTop=87;document.body.append(container);
  return {window,document,container,nodes,queue,Element,api:window.PanelTutorial,dialog:nodes.find(n=>n.tagName==='dialog'),video:nodes.find(n=>n.tagName==='video')};
}
for(const entry of ['welcome','first-steps'])test(entry+' rerender during open player closes resources and focuses the replacement entry',()=>{
  const h=harness(),oldHost=new h.Element('div');h.container.append(oldHost);const oldButton=h.api.mount(oldHost,{entry,language:'pt-BR'});oldButton.focus();assert.equal(h.api.open(oldButton,'pt-BR'),true);h.video.paused=false;h.window.scrollX=44;h.window.scrollY=600;h.container.scrollTop=250;
  const host=new h.Element('div');h.container.replaceChildren(host);assert.equal(oldButton.isConnected,false);const replacement=h.api.mount(host,{entry,language:'pt'});
  assert.equal(h.dialog.open,false);assert.equal(h.video.paused,true);assert.equal(h.video.hasAttribute('src'),false);assert.equal(h.video.children.length,0);assert.equal(h.document.activeElement,replacement);assert.equal(replacement.isConnected,true);assert.equal(h.window.scrollX,12);assert.equal(h.window.scrollY,230);assert.equal(h.container.scrollTop,87);assert.ok(h.video.pauseCalls>=2);assert.ok(h.video.loadCalls>=2);
  const outside=new h.Element('button');h.document.body.append(outside);outside.focus();h.queue.forEach(callback=>callback());assert.equal(h.document.activeElement,outside,'A late native close event must not steal deliberate focus');
});
test('a mount in the other entry does not close a player whose original entry is still connected',()=>{const h=harness(),first=new h.Element('div'),welcome=new h.Element('div');h.container.append(first,welcome);const opener=h.api.mount(first,{entry:'first-steps',language:'pt'});h.api.open(opener,'pt');h.api.mount(welcome,{entry:'welcome',language:'pt'});assert.equal(h.dialog.open,true);h.api.close();assert.equal(h.document.activeElement,opener);});

test('actual first-steps renderer retires an active player at five of five and keeps focus after the card hides',()=>{
  const h=harness(),timers=[];
  h.Element.prototype.prepend=function(...items){for(const item of items)item.parentElement=this;this.children.unshift(...items);};
  h.Element.prototype.closest=function(tag){for(let item=this;item;item=item.parentElement)if(item.tagName===tag)return item;return null;};
  h.Element.prototype.scrollIntoView=function(){};
  Object.defineProperty(h.Element.prototype,'classList',{get(){this.classes||=new Set();return {add:value=>this.classes.add(value),remove:value=>this.classes.delete(value),contains:value=>this.classes.has(value)};}});
  h.Element.prototype.getClientRects=function(){if(!this.isConnected)return [];for(let item=this;item;item=item.parentElement)if(item.hidden||item.tagName==='details'&&!item.open)return [];return [{}];};
  h.container.id='view-home';
  const details=new h.Element('details'),menu=new h.Element('div'),setup=new h.Element('button');setup.id='setup-guide';details.append(menu);h.document.body.append(details,setup);
  h.document.getElementById=id=>h.nodes.filter(node=>node.id===id&&node.isConnected).at(-1);
  h.document.querySelector=selector=>selector==='.clean-menu'?menu:null;
  h.window.localStorage={getItem(){return null;},setItem(){}};
  h.window.setTimeout=callback=>{timers.push(callback);return timers.length;};
  h.window.PanelWelcome={useGuidedSetup(){}};
  h.window.PanelCopySession={create(){const group=new h.Element('div');group.button=new h.Element('button');group.append(group.button);return group;}};
  const initial={example:false,guidance:{onboarding:{steps:{rules:false,newSession:false,task:false,decision:false},projectKey:null}}};
  h.window.PanelV2={render(){},state(){return {snapshot:initial};},select(){}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/onboarding22.js'),'utf8'),{window:h.window,MutationObserver:class{observe(){}}});
  const card=h.document.getElementById('first-steps'),menuButton=h.document.getElementById('first-steps-menu'),opener=h.nodes.find(node=>node.dataset.panelTutorial==='first-steps'&&node.isConnected);
  assert.ok(opener);assert.equal(details.open,false);opener.focus();assert.equal(h.api.open(opener,'pt'),true);h.video.paused=false;
  h.window.PanelOnboarding.update({example:false,guidance:{onboarding:{steps:{rules:true,newSession:true,task:true,decision:true},projectKey:null}}},'pt');
  assert.equal(card.classList.contains('first-complete'),true);assert.equal(opener.isConnected,false);assert.equal(h.dialog.open,false);assert.equal(h.video.paused,true);assert.equal(h.video.hasAttribute('src'),false);assert.equal(h.video.children.length,0);assert.equal(details.open,true);assert.equal(h.document.activeElement,menuButton);assert.equal(menuButton.isConnected,true);assert.equal(menuButton.getClientRects().length,1);assert.equal(h.window.scrollX,12);assert.equal(h.window.scrollY,230);
  for(const callback of timers)callback();for(const callback of h.queue)callback();assert.equal(card.hidden,true);assert.equal(h.document.activeElement,menuButton);assert.notEqual(h.document.activeElement,h.document.body);
});

test('retiring another entry does not open its menu or close the current player',()=>{const h=harness(),host=new h.Element('div');h.container.append(host);const opener=h.api.mount(host,{entry:'welcome',language:'pt'});h.api.open(opener,'pt');let resolved=false;assert.equal(h.api.retire('first-steps',()=>{resolved=true;return host;}),false);assert.equal(resolved,false);assert.equal(h.dialog.open,true);h.api.close();});

test('retire distinguishes native return to the original opener from deliberate external focus',()=>{
  for(const deliberate of [false,true]){
    const h=harness(),host=new h.Element('div'),fallback=new h.Element('button'),outside=new h.Element('button');h.container.append(host);h.document.body.append(fallback,outside);
    const opener=h.api.mount(host,{entry:'first-steps',language:'pt'});opener.focus();assert.equal(h.api.open(opener,'pt'),true);h.video.paused=false;
    assert.equal(h.dialog.nativeReturnFocus,opener,'Native dialog remembers the original opening focus');
    if(deliberate)outside.focus();
    assert.equal(h.api.retire('first-steps',fallback),true);assert.equal(opener.isConnected,true,'Original opener is still connected at native close time');
    assert.equal(h.document.activeElement,deliberate?outside:fallback);assert.equal(h.video.paused,true);assert.equal(h.video.hasAttribute('src'),false);assert.equal(h.video.children.length,0);
    host.remove();for(const callback of h.queue)callback();assert.equal(h.document.activeElement,deliberate?outside:fallback);assert.equal(h.document.activeElement.isConnected,true);
  }
});
