'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Teach=require('../public/teach.js'),Copy=require('../public/copy-session.js');
const teachSource=fs.readFileSync(require.resolve('../public/teach.js'),'utf8'),copySource=fs.readFileSync(require.resolve('../public/copy-session.js'),'utf8');

class Node{
  constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.style={};this.className='';this.hidden=false;this.open=false;this.content='';}
  set textContent(value){this.content=String(value);this.children=[];}
  get textContent(){return this.content+this.children.map(node=>node.textContent).join('');}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
  replaceChildren(...nodes){this.content='';this.children=[];this.append(...nodes);}
  setAttribute(key,value){this.attributes[key]=String(value);}
  removeAttribute(key){delete this.attributes[key];}
  querySelectorAll(selector){return this.children.flatMap(node=>[(selector.startsWith('.')?node.className.split(' ').includes(selector.slice(1)):node.tagName===selector)?node:null,...node.querySelectorAll(selector)]).filter(Boolean);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  focus(){this.focused=true;}
  select(){this.selected=true;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);}
}
function browser(lang,writeText,execCommand){
  const selection={removeAllRanges(){},addRange(range){this.range=range;}};
  const document={documentElement:{lang},body:new Node('body'),createElement:tag=>new Node(tag),createTextNode:value=>{const node=new Node('text');node.textContent=value;return node;},createRange:()=>({selectNodeContents(node){this.node=node;}}),execCommand};
  const window={document,navigator:{clipboard:{writeText}},localStorage:{getItem:()=>null,setItem(){}},getSelection:()=>selection,panelDrawer(title,nodes){this.drawer=nodes[0];}};
  vm.runInNewContext(copySource,{window});vm.runInNewContext(teachSource,{window});window.PanelTeach.open(lang);
  const box=window.drawer;
  return {window,document,selection,box,main:box.querySelector('.teach-copy'),switcher:box.querySelector('.teach-switch'),status:box.querySelector('.teach-status'),advanced:box.querySelector('details'),block:box.querySelector('.teach-block')};
}
function visibleText(node){
  if(node.hidden)return '';
  const children=node.tagName==='details'&&!node.open?node.children.filter(child=>child.tagName==='summary'):node.children;
  return [node.content,...children.map(visibleText)].filter(Boolean).join('\n');
}
function assertOneNextStep(b,lang,target){
  const phrase=Copy.phrase(lang,target,true),other=Copy.phrase(lang,target==='claude'?'codex':'claude',true),text=visibleText(b.box);
  assert.equal(text.split(phrase).length-1,1,'show the approved next step exactly once');
  assert.ok(!text.includes(other),'do not leave the previous target guidance visible');
  assert.equal(b.status.attributes.role,'status');assert.equal(b.status.attributes['aria-live'],'polite');
}

for(const lang of ['en','pt','es']){
  test(lang+': copying twice and switching tools keeps one next step and the exact global rules',async()=>{
    const copied=[],b=browser(lang,async value=>copied.push(value));
    assert.equal(b.main.textContent,Teach.SIMPLE[lang].copy);assert.equal(b.switcher.textContent,Copy.T[lang].codex);assert.equal(b.advanced.open,false);
    assert.equal(b.box.querySelectorAll('.copy-session').filter(group=>group.button.dataset.button==='primary').length,1);
    assertOneNextStep(b,lang,'claude');
    for(const target of ['claude','codex','claude']){
      if(b.main.parent.getTarget()!==target){b.switcher.onclick();assert.equal(b.status.textContent,'');}
      assert.equal(b.main.textContent,Teach.SIMPLE[lang].copy.replace('Claude Code',target==='codex'?'Codex':'Claude Code'));
      assertOneNextStep(b,lang,target);
      for(let n=0;n<2;n++){
        assert.equal(await b.main.onclick(),true);assert.equal(copied.at(-1),Teach.ruleText({},lang,target));
        assertOneNextStep(b,lang,target);assert.equal(b.status.textContent,Copy.T[lang].copied);assert.equal(b.advanced.open,false);
      }
    }
    assert.equal(copied.length,6);
  });
  test(lang+': blocked clipboard selects the exact rules and tool switching updates the fallback',async()=>{
    const b=browser(lang,async()=>{throw Error('blocked');},()=>false);
    for(const target of ['claude','codex']){
      if(target==='codex')b.switcher.onclick();
      assert.equal(await b.main.onclick(),false);assert.equal(b.advanced.open,true);assert.equal(b.block.hidden,false);
      assert.equal(b.block.textContent,Teach.ruleText({},lang,target));assert.equal(b.selection.range.node,b.block);assert.equal(b.block.focused,true);
      assert.equal(b.status.textContent,Teach.T[lang].select);assert.equal(b.main.disabled,false);assert.equal(b.switcher.disabled,false);
      assert.equal(b.document.body.children.length,0);assert.equal(b.box.querySelector('.copy-session-phrase').textContent,Copy.phrase(lang,target,true));
      b.advanced.open=false;assertOneNextStep(b,lang,target);
    }
  });
  test(lang+': legacy clipboard success keeps the same single guidance and restores focus',async()=>{
    let command;const b=browser(lang,async()=>{throw Error('blocked');},value=>{command=value;return true;}),previous=new Node('button');b.document.activeElement=previous;
    assert.equal(await b.main.onclick(),true);assert.equal(command,'copy');assert.equal(b.document.body.children.length,0);assert.equal(previous.focused,true);
    assertOneNextStep(b,lang,'claude');assert.equal(b.status.textContent,Copy.T[lang].copied);assert.equal(b.advanced.open,false);
  });
}
