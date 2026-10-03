const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {bundle,patchPE}=require('../tools/build-windows.cjs');
test('SEA bundles all local modules with no runtime dependencies',()=>{
  const source=bundle('src/desktop.cjs');new vm.Script(source);a.ok(source.includes('src/lib/usage.cjs'));a.ok(source.includes('src/lib/project-json.cjs'));a.ok(!/require\(['"]\.\.?\//.test(source));
});
test('Windows GUI patch strips invalid signature without altering instructions',()=>{
  const b=Buffer.alloc(1024,0);b.writeUInt32LE(128,0x3c);b.write('PE\0\0',128,'ascii');const opt=152;b.writeUInt16LE(0x20b,opt);b.writeUInt16LE(3,opt+68);b.writeUInt32LE(1000,opt+112+32);b.writeUInt32LE(24,opt+112+36);b.write('CODE',600);const patched=patchPE(b);a.equal(patched.length,1000);a.equal(patched.readUInt16LE(opt+68),2);a.equal(patched.readUInt32LE(opt+112+32),0);a.equal(patched.toString('ascii',600,604),'CODE');a.throws(()=>patchPE(Buffer.alloc(1024)),/Expected/);
});
test('dist is ignored and package remains dependency free',()=>{
  a.ok(fs.readFileSync(path.join(__dirname,'../.gitignore'),'utf8').split(/\r?\n/).includes('dist/'));const p=require('../package.json');a.equal(p.dependencies,undefined);a.equal(p.devDependencies,undefined);
});
test('server serves the embedded asset provider instead of filesystem assets',async t=>{
  const {createServer}=require('../src/panel.cjs');const paths=[];const server=createServer({demoOnly:true,readAsset(name){paths.push(name);if(name==='example.json')return Buffer.from(JSON.stringify(require('../example.json')));return Buffer.from('embedded '+name);}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const url='http://127.0.0.1:'+server.address().port;a.equal(await(await fetch(url+'/welcome.js')).text(),'embedded public/welcome.js');a.equal(await(await fetch(url+'/guide-work.svg')).text(),'embedded public/guide-work.svg');a.equal((await(await fetch(url+'/api/status')).json()).example,true);a.deepEqual(paths,['example.json','public/welcome.js','public/guide-work.svg']);
});
test('desktop shutdown requires a same-origin POST and is unavailable on the source server',async t=>{
  const {createServer}=require('../src/panel.cjs');let closed=0;const server=createServer({demoOnly:true,onClose:()=>closed++});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const url='http://127.0.0.1:'+server.address().port;
  a.equal((await fetch(url+'/api/exit')).status,404);a.equal((await fetch(url+'/api/exit',{method:'POST'})).status,403);a.equal((await fetch(url+'/api/exit',{method:'POST',headers:{Origin:'http://other.invalid'}})).status,403);a.equal(closed,0);
  a.equal((await fetch(url+'/api/exit',{method:'POST',headers:{Origin:url}})).status,200);await new Promise(r=>setImmediate(r));a.equal(closed,1);
});
