'use strict';
const http=require('node:http'),net=require('node:net'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
async function open() {
 let startedPid=null,ideiasPid=null;
 const livre=p=>new Promise(resolve=>{const s=net.createServer();s.once('error',()=>resolve(false));s.listen(p,'127.0.0.1',()=>s.close(()=>resolve(true)));});
 let port=Number(process.env.PAINEL_PORT||3257);
 try{if(!process.env.PAINEL_PORT)port=JSON.parse(fs.readFileSync(path.join(__dirname,'config/painel.json'),'utf8')).porta||port;}catch{}
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Porta inválida.');
 const ready=p=>new Promise(resolve=>{const r=http.get('http://127.0.0.1:'+p+'/api/health',res=>{let data='';res.on('data',b=>data+=b);res.on('end',()=>resolve(res.statusCode===200&&data==='{"ok":true}'));});r.on('error',()=>resolve(false));r.setTimeout(700,()=>{r.destroy();resolve(false);});});
 for(let attempt=0;attempt<20;attempt++,port++){
  if([3250,3256,3259].includes(port))continue;
  if(await ready(port))break;
  const free=await livre(port);
  if(!free)continue;
  // Idealizadores: o app do Conselho sobe na porta seguinte quando a pasta de ideias existe; sem ele, a aba mostra a grade de reserva.
  const env={...process.env,PAINEL_PORT:String(port)},dados=path.join(process.env.PAINEL_ROOT||path.join(__dirname,'estado-local'),'estado','ideias'),portaIdeias=Number(process.env.PAINEL_IDEIAS_PORT||port+1);
  if(fs.existsSync(dados)&&Number.isInteger(portaIdeias)&&portaIdeias!==port&&await livre(portaIdeias)){const ideias=spawn(process.execPath,[path.join(__dirname,'decidir-ideias','server.mjs')],{cwd:__dirname,env:{...env,PORTA:String(portaIdeias),DADOS:dados},detached:true,windowsHide:true,stdio:'ignore'});ideias.unref();ideiasPid=ideias.pid;env.PAINEL_IDEIAS_URL='http://127.0.0.1:'+portaIdeias;}
  const child=spawn(process.execPath,[path.join(__dirname,'servidor.cjs'),'--port',String(port)],{cwd:__dirname,env,detached:true,windowsHide:true,stdio:'ignore'});child.unref();startedPid=child.pid;
  let started=false;for(let i=0;i<30;i++){if(await ready(port)){started=true;break;}await new Promise(r=>setTimeout(r,300));}if(!started)throw Error('O painel não abriu. Solução: rode node checar.cjs.');break;
 }
 if(!await ready(port))throw Error('Nenhuma porta livre. Solução: escolha PAINEL_PORT.');
 const url='http://127.0.0.1:'+port;console.log('Painel: '+url);
 if(startedPid)console.log('Servidor iniciado em segundo plano, PID '+startedPid+'. Para encerrar: '+(process.platform==='win32'?'taskkill /PID '+startedPid+' /F':'kill '+startedPid));else console.log('O painel já estava rodando nessa porta; este comando não iniciou outro servidor.');
 if(ideiasPid)console.log('Conselho de ideias em segundo plano, PID '+ideiasPid+'. Para encerrar: '+(process.platform==='win32'?'taskkill /PID '+ideiasPid+' /F':'kill '+ideiasPid));
 if(process.env.PAINEL_NAO_ABRIR==='1')return;
 const command=process.platform==='win32'?'powershell.exe':process.platform==='darwin'?'open':'xdg-open';
 const args=process.platform==='win32'?['-NoProfile','-Command',"Start-Process '"+url+"'"]:[url];
 const b=spawn(command,args,{stdio:'ignore',windowsHide:true});b.on('error',()=>console.log('Abra este endereço no navegador: '+url));
}
if(require.main===module)open().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={open};
