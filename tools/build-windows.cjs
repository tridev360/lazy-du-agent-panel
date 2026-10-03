'use strict';
// Uses Node's SEA, with build tooling kept outside the package.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
function bundle(entry){
  const modules=new Map();
  function visit(file){const id=path.relative(ROOT,file).replace(/\\/g,'/');if(modules.has(id))return id;modules.set(id,'');
    let source=fs.readFileSync(file,'utf8').replace(/^#![^\n]*\n/,'');
    if(file.endsWith('.json'))source='module.exports='+source+';';
    else source=source.replace(/require\((['"])(\.[^'"]+)\1\)/g,(_,quote,name)=>{let target=path.resolve(path.dirname(file),name);if(!path.extname(target))target+='.cjs';if(!target.startsWith(ROOT+path.sep))throw Error('Module outside source tree');return 'load('+JSON.stringify(visit(target))+')';});
    modules.set(id,source);return id;
  }
  const main=visit(path.resolve(ROOT,entry));
  return "'use strict';const nativeRequire=require;const factories={"+[...modules].map(([id,src])=>JSON.stringify(id)+':function(module,exports,require,load,__dirname,__filename){\n'+src+'\n}').join(',')+'};const cache={};function load(id){if(cache[id])return cache[id].exports;const m={exports:{}};cache[id]=m;factories[id](m,m.exports,nativeRequire,load,require("node:path").dirname(id),id);return m.exports;}load('+JSON.stringify(main)+').main().catch(()=>{process.exitCode=1;});';
}
function patchPE(buffer){
  const pe=buffer.readUInt32LE(0x3c);if(buffer.toString('ascii',pe,pe+4)!=='PE\0\0')throw Error('Expected Windows PE executable');
  const opt=pe+24,magic=buffer.readUInt16LE(opt);if(![0x10b,0x20b].includes(magic))throw Error('Unknown PE format');
  // Windows GUI subsystem prevents a terminal window. Remove invalidated Authenticode directory.
  buffer.writeUInt16LE(2,opt+68);buffer.writeUInt32LE(0,opt+64);
  const cert=opt+(magic===0x20b?112:96)+8*4,offset=buffer.readUInt32LE(cert),size=buffer.readUInt32LE(cert+4);
  buffer.writeUInt32LE(0,cert);buffer.writeUInt32LE(0,cert+4);
  return offset&&offset+size===buffer.length?buffer.subarray(0,offset):buffer;
}
async function build(args=process.argv.slice(2)){
  if(process.platform!=='win32'||!process.version.startsWith('v24.'))throw Error('Build on Windows using Node 24 LTS.');
  const idx=args.indexOf('--tools'),tools=idx<0?path.resolve(ROOT,'../panel-build-tools'):path.resolve(args[idx+1]);
  const postject=path.join(tools,'node_modules/postject/dist/cli.js');if(!fs.existsSync(postject))throw Error('Install postject in the isolated tools folder first.');
  const dist=path.join(ROOT,'dist');fs.mkdirSync(dist,{recursive:true});
  const main=path.join(dist,'sea-main.cjs'),blob=path.join(dist,'sea-prep.blob'),config=path.join(dist,'sea-config.json'),exe=path.join(dist,'Lazy-Du-Panel-v2.exe');
  fs.writeFileSync(main,bundle('src/desktop.cjs'));
  if(JSON.parse(fs.readFileSync(path.join(tools,'node_modules/postject/package.json'),'utf8')).version!=='1.0.0-alpha.6')throw Error('Expected pinned postject 1.0.0-alpha.6.');
  const license=path.join(tools,'Node-'+process.version+'-LICENSE.txt');if(!fs.existsSync(license)){
    const response=await fetch('https://raw.githubusercontent.com/nodejs/node/'+process.version+'/LICENSE',{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Official Node license unavailable.');const text=await response.text();if(!text.startsWith('Node.js is licensed'))throw Error('Unexpected license format');fs.writeFileSync(license,text);
  }
  const assets={'example.json':path.join(ROOT,'example.json'),'NODE-LICENSE.txt':license};for(const name of fs.readdirSync(path.join(ROOT,'public'))){const file=path.join(ROOT,'public',name);if(fs.statSync(file).isFile())assets['public/'+name]=file;}
  for(const du of require('../public/dus.json'))assets['public/dus/'+du.id+'.png']=path.join(ROOT,'public','dus',du.id+'.png');
  fs.writeFileSync(config,JSON.stringify({main,output:blob,disableExperimentalSEAWarning:true,useSnapshot:false,useCodeCache:false,execArgvExtension:'none',assets},null,2));
  function run(binary,argv){const r=spawnSync(binary,argv,{stdio:'inherit',windowsHide:true});if(r.error||r.status!==0)throw Error('Build command failed');}
  run(process.execPath,['--experimental-sea-config',config]);fs.copyFileSync(process.execPath,exe);fs.writeFileSync(exe,patchPE(fs.readFileSync(exe)));
  run(process.execPath,[postject,exe,'NODE_SEA_BLOB',blob,'--sentinel-fuse','NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2']);
  fs.writeFileSync(exe,patchPE(fs.readFileSync(exe)));
  fs.copyFileSync(license,path.join(dist,'NODE-LICENSE.txt'));
  fs.writeFileSync(path.join(dist,'BUILD.json'),JSON.stringify({app:'lazy-du-agent-panel',version:require('../package.json').version,node:process.version,arch:process.arch,postject:'1.0.0-alpha.6',signed:false,sha256:require('node:crypto').createHash('sha256').update(fs.readFileSync(exe)).digest('hex')},null,2));
  console.log('Built dist/Lazy-Du-Panel-v2.exe (unsigned).');return exe;
}
if(require.main===module)build().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={bundle,patchPE,build};
