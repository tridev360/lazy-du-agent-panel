'use strict';
const path=require('node:path'),{spawn}=require('node:child_process');
const {createServer}=require('./panel.cjs'),{isReady,browserCommand}=require('./open.cjs');
async function main(args=process.argv.slice(2)){
  const sea=require('node:sea');const index=args.indexOf('--port');const first=index<0?3251:Number(args[index+1]);
  if(!Number.isInteger(first)||first<1024||first>65535)throw Error('Invalid port');
  const pi=args.indexOf('--profile'),profile=pi<0?undefined:path.resolve(args[pi+1]||'.');
  let server,port;for(let candidate=first;candidate<Math.min(65536,first+20);candidate++){
    if(await isReady(candidate,{desktop:true})){port=candidate;break;}
    const test=createServer({base:path.dirname(process.execPath),...(profile?{profile}:{}),demoOnly:args.includes('--demo'),onClose:()=>test.close(),...(sea.isSea()?{readAsset:name=>Buffer.from(sea.getAsset(name))}:{})});
    try{await new Promise((r,j)=>{test.once('error',j);test.listen(candidate,'127.0.0.1',r);});server=test;port=candidate;break;}catch(e){test.close();if(e.code!=='EADDRINUSE')throw e;}
  }
  if(!port)throw Error('No local port available');
  const url='http://127.0.0.1:'+port;
  if(args.includes('--smoke-test')){const r=await fetch(url+'/api/status?example=1');if(!r.ok||!(await r.json()).example)throw Error('Smoke test failed');await new Promise(r=>server?server.close(r):r());return;}
  if(!args.includes('--no-browser')){const spec=browserCommand(process.platform,url);const child=spawn(spec.command,spec.args,{windowsHide:true,stdio:'ignore'});child.on('error',()=>{});child.unref();}
  // The executable is self-contained; no installation, registry writes, or admin access.
  if(args.includes('--exit-after')){const at=args.indexOf('--exit-after'),ms=Number(args[at+1]);if(Number.isFinite(ms)&&ms>=1000&&server)setTimeout(()=>server.close(),ms);}
  return {server,port};
}
if(require.main===module)main().catch(()=>{console.error('Could not open the local panel.');process.exitCode=1;});
module.exports={main};
