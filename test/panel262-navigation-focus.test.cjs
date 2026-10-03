'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const panel=fs.readFileSync(path.join(__dirname,'../public/panel.js'),'utf8'),v21=fs.readFileSync(path.join(__dirname,'../public/v21.js'),'utf8');
const drawerSource=panel.slice(panel.indexOf('function drawer(title, nodes) {'),panel.indexOf('function title(item) {'));
const navStart=v21.indexOf("  for(const b of nav.querySelectorAll('[role=tab]'))"),navEnd=v21.indexOf("  for(const b of nav.querySelectorAll('[data-view]'))",navStart);
function setup(){
  const handlers={},nodes={},document={body:{dataset:{view:'home'}},activeElement:null,querySelector:()=>nodes.more};
  function node(id){return {id,dataset:{},open:false,children:[],getClientRects:()=>[{}],focus(){document.activeElement=this;},addEventListener(type,fn){handlers[type]=fn;},querySelectorAll:()=>[],contains(n){return n===this||n===nodes.close;},replaceChildren(){},showModal(){this.open=true;}};}
  for(const id of ['drawer','drawer-title','drawer-body','close-drawer','clean-wen','tab-home','tab-team','tab-projects','tab-usage','more'])nodes[id]=node(id);nodes.close=nodes['close-drawer'];document.activeElement=nodes['clean-wen'];
  const nav={querySelectorAll:()=>['home','team','projects','usage'].map(key=>nodes['tab-'+key])},P={select(value,focus){document.body.dataset.view=value;if(focus)nodes['tab-'+value].focus();}};
  vm.runInNewContext(drawerSource+";drawer('WEN',[]);",{document,$:id=>nodes[id]});
  vm.runInNewContext(v21.slice(navStart,navEnd),{d:document,nav,P});
  return {document,nodes,handlers,modal:nodes.drawer};
}
test('late native close cannot steal an explicit Home focus before ArrowRight selects Team',()=>{const app=setup();assert.equal(app.document.activeElement.id,'close-drawer');app.modal.open=false;app.nodes['clean-wen'].focus();app.nodes['tab-home'].focus();app.handlers.close();assert.equal(app.document.activeElement.id,'tab-home','A later close event must preserve the explicit tab focus');let prevented=false;app.document.activeElement.onkeydown({key:'ArrowRight',preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(app.document.body.dataset.view,'team');assert.equal(app.document.activeElement.id,'tab-team');});
test('closing returns focus to the opener when the dialog still owns focus',()=>{const app=setup();app.modal.open=false;app.handlers.close();assert.equal(app.document.activeElement.id,'clean-wen');});
test('a close event keeps native restored focus on the opener',()=>{const app=setup();app.modal.open=false;app.nodes['clean-wen'].focus();app.handlers.close();assert.equal(app.document.activeElement.id,'clean-wen');});
test('closing falls back to More only when the previous opener is unavailable and focus is unclaimed',()=>{const app=setup();app.modal.open=false;app.document.activeElement=app.document.body;app.nodes['clean-wen'].getClientRects=()=>[];app.handlers.close();assert.equal(app.document.activeElement.id,'more');});
test('a queued close event does not disrupt a drawer that has already reopened',()=>{const app=setup();app.handlers.close();assert.equal(app.modal.open,true);assert.equal(app.document.activeElement.id,'close-drawer');});

