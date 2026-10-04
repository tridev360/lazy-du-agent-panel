'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),vm=require('node:vm');
const {createServer}=require('../src/panel.cjs');
const {buildTutorialManifest,mp4Duration,validVtt}=require('../src/tutorial-manifest.cjs');
const {tutorialFor,durationText}=require('../public/tutorial264.js');
const releaseConfig=require('../src/tutorial-releases.cjs');
const ROOT=path.join(__dirname,'..'),PUBLIC=path.join(ROOT,'public');
const MEDIA={
 pt:['9f50fd2bf592e1d6c27108196b3cc84f3bb3ec8fb9e5dca569efcb4bebacbae8','315fab1fb2b476262cf466a002033eede6e3e090aa2bec21ef0280f96cef60f9',3000122,2014],
 en:['c6e211f065ef5e8a3796ef0b3cf6d756e2d6b39c2230ef35fc6212c854862a22','2bf2cc2e6f2d5861a29045042afae3150b9d1cb6288e59d957bbef1d535d0874',2934245,1970],
 es:['f2680fd6aa5284fd772ec99f2316018fcb685a3d457aefff0b76c90424eaa44b','e9b098692f2b6eb7ebae720d9dbf30efc0102a44c93cc73b4ddfe07c4c0c59ae',3016203,2109]
};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const route=(lg,ext)=>'/tutorial-painel/tutorial.'+lg+'.'+ext;
function temporary(t){const p=fs.mkdtempSync(path.join(os.tmpdir(),'panel-tutorial-release-'));t.after(()=>fs.rmSync(p,{recursive:true,force:true}));return p;}
function copiedAssets(t){const publicDir=path.join(temporary(t),'public');fs.mkdirSync(path.join(publicDir,'tutorial-painel'),{recursive:true});for(const lg of Object.keys(MEDIA))for(const ext of ['mp4','vtt'])fs.copyFileSync(path.join(PUBLIC,route(lg,ext)),path.join(publicDir,route(lg,ext)));return publicDir;}
async function server(t,options={}){const instance=createServer({demoOnly:true,offline:true,profile:temporary(t),...options});await new Promise(r=>instance.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{instance.closeAllConnections();instance.close(r);}));return asset=>fetch('http://127.0.0.1:'+instance.address().port+asset);}
async function manifest(get){const r=await get('/tutorial-manifest.js');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const ctx={window:{}};vm.runInNewContext(await r.text(),ctx);return JSON.parse(JSON.stringify(ctx.window.PanelTutorialManifest));}
for(const [lg,pins]of Object.entries(MEDIA)){
 test('installed '+lg+' tutorial serves its own approved video and captions',async t=>{const get=await server(t),value=await manifest(get),entry=tutorialFor(value,lg);assert.deepEqual(Object.keys(value.tutorials),['pt','en','es']);assert.ok(entry);assert.equal(entry.durationSeconds,103.2);assert.equal(durationText(entry.durationSeconds),'1 min 43 s');assert.equal(entry.video.bytes,pins[2]);assert.equal(entry.subtitle.bytes,pins[3]);
  for(const [i,ext]of ['mp4','vtt'].entries()){const asset=route(lg,ext),r=await get(asset);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('content-type'),ext==='mp4'?'video/mp4':'text/vtt; charset=utf-8');const body=Buffer.from(await r.arrayBuffer());assert.equal(sha(body),pins[i]);assert.deepEqual(body,fs.readFileSync(path.join(PUBLIC,asset)));}
  const video=fs.readFileSync(path.join(PUBLIC,route(lg,'mp4'))),vtt=fs.readFileSync(path.join(PUBLIC,route(lg,'vtt')),'utf8');assert.equal(mp4Duration(video),103.2);assert.equal(validVtt(vtt,103.2),true);assert.equal(buildTutorialManifest({publicDir:PUBLIC,...releaseConfig}).tutorials[lg].video.sha256,pins[0]);
 });
 for(const ext of ['mp4','vtt'])for(const change of ['remove','change']){
  test(change+' '+lg+' '+ext+' closes only that language after a successful read',async t=>{const publicDir=copiedAssets(t),get=await server(t,{tutorialOptions:{publicDir}}),asset=route(lg,ext);assert.ok(tutorialFor(await manifest(get),lg));assert.equal((await get(asset)).status,200);const file=path.join(publicDir,asset);if(change==='remove')fs.unlinkSync(file);else fs.appendFileSync(file,'\nchanged\n');const value=await manifest(get);assert.equal(tutorialFor(value,lg),null);assert.equal(value.tutorials[lg],undefined);for(const e of ['mp4','vtt'])assert.equal((await get(route(lg,e))).status,404);for(const other of Object.keys(MEDIA).filter(x=>x!==lg)){assert.ok(tutorialFor(value,other));assert.equal((await get(route(other,'mp4'))).status,200);}});
 }
}
test('explicit empty release configuration keeps all six media routes closed',async t=>{const get=await server(t,{tutorialOptions:{releases:[]}});assert.deepEqual(await manifest(get),{version:1,tutorials:{}});for(const lg of Object.keys(MEDIA))for(const ext of ['mp4','vtt'])assert.equal((await get(route(lg,ext))).status,404);});
test('README links select the shipped videos and captions in all three languages',()=>{const b=fs.readFileSync(path.join(PUBLIC,'tutorial-painel/tutorial.pt.png'));assert.deepEqual([...b.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.equal(b.readUInt32BE(16),2880);assert.equal(b.readUInt32BE(20),1800);for(const file of ['README.md','README.pt-BR.md']){const text=fs.readFileSync(path.join(ROOT,file),'utf8');assert.ok(text.includes('](public/tutorial-painel/tutorial.pt.png)](public/tutorial-painel/tutorial.pt.mp4)'));for(const lg of Object.keys(MEDIA))for(const ext of ['mp4','vtt'])assert.ok(text.includes('](public/tutorial-painel/tutorial.'+lg+'.'+ext+')'));}});
