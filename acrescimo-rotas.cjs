'use strict';
const path=require('node:path'),fs=require('node:fs');
const assets=['acrescimo-ui.js','acrescimo-local.js','conselho-modelo.js','conselho-mesa.js','conselho-1310.css','clareza-1310.js','clareza-1310.css','telas-1310.js','telas-1310.css','telas-1310-inicial.js','financas-modelo.js','jornada-modelo.js','conselho-ranking.js','conselho-sala.js','conselho-sala.css','refino.css','refino.js','financas-vista.js','financas-ui.js','financas-painel.css'];
function create({root,port,nonce,hora,now=Date.now,conversationOptions={}}){
  const state=path.join(root,'estado');let writer,live;
  // A proposal can remain unchanged for days. Freshness belongs to the read,
  // while the version continues to protect against deciding different content.
  const readings=new Map();
  function verifiedCouncil(){const data=require('./conselho-fonte.cjs').read(state,now());for(const idea of data.ideas){const read=readings.get(idea.version);idea.decisionReady=!!read&&now()-read<300000;if(idea.decisionReady)idea.evidence={...idea.evidence,sourceOld:idea.evidence.old,old:false};}return data;}
  return {async handle(req,url,{send,res,example=false,credits}){
    if(req.method==='GET'&&assets.includes(url.pathname.slice(1))){send(200,fs.readFileSync(path.join(__dirname,url.pathname.slice(1))),url.pathname.endsWith('.css')?'text/css':'text/javascript');return true;}
    const conversationPaths=['/api/conselho/pergunta','/api/conselho/parar','/api/conselho/conversa'];
    if(!['/api/conselho','/api/financas','/api/jornada','/api/conselho/selo',...conversationPaths].includes(url.pathname))return false;
    if(example){send(409,{ok:false,error:'example_disabled'});return true;}
    if(conversationPaths.includes(url.pathname)){
      if(req.method!=='POST'){send(405,{ok:false,error:'method_not_allowed'});return true;}
      if(req.headers.origin!=='http://127.0.0.1:'+port||req.headers['content-type']!=='application/json'||req.headers['x-painel-nonce']!==nonce||!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)){send(403,{ok:false,error:'local_only'});return true;}
      let input;try{let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>4096){send(413,{ok:false,error:'too_large'});return true;}chunks.push(chunk);}input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{send(400,{ok:false,error:'invalid_question'});return true;}
      live ||= require('./conselho-conversa.cjs').create({stateRoot:state,now,...(hora?{hora}:{}),...conversationOptions});
      try{
        if(url.pathname==='/api/conselho/conversa'){if(!input||Object.keys(input).some(k=>k!=='id'))throw Error();send(200,{ok:true,rows:live.read(input.id)});}
        else if(url.pathname==='/api/conselho/parar'){if(!input||Object.keys(input).some(k=>k!=='turno')||typeof input.turno!=='string')throw Error();send(200,{ok:true,stopped:live.stop(input.turno)});}
        else{
          // Validação e leitura segura antes de abrir o stream.
          require('./conselho-conversa.cjs').request(state,input,now());
          if(!res){send(503,{ok:false,error:'stream_unavailable'});return true;}
          if(live.state().queued>=4){send(429,{ok:false,error:'queue_full'});return true;}
          res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
          let job;job=live.enqueue(input,event=>{if(!res.destroyed)res.write(JSON.stringify(event)+'\n');},()=>{if(!res.destroyed)res.end();});
          res.on('close',()=>{if(!res.writableEnded)live.stop(job);});
        }
      }catch{if(res?.headersSent){res.end();}else send(409,{ok:false,error:'question_not_started'});}return true;
    }
    if(req.method==='GET'&&url.pathname!=='/api/conselho/selo'){
      const tick=now();
      const data=url.pathname==='/api/conselho'?require('./conselho-fonte.cjs').read(state,tick):url.pathname==='/api/financas'?require('./financas-fonte.cjs').read(state,tick,typeof credits==='function'?credits()||{}:{}):require('./jornada-fonte.cjs').read(state,tick);
      if(url.pathname==='/api/conselho'){readings.clear();for(const idea of data.ideas){if(idea.evidence.valid){readings.set(idea.version,tick);if(idea.evidence.old){idea.decisionReady=true;idea.decisionReadAt=data.servedAt;}}}}
      send(200,{ok:true,data,...(url.pathname==='/api/conselho'?{nonce}:{}),...(url.pathname==='/api/jornada'?{marcos:require('./marcos-fonte.cjs').read(state,tick)}:{})});return true;
    }
    if(req.method==='POST'&&url.pathname==='/api/conselho/selo'){
      if(!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin)||req.headers['content-type']!=='application/json'||req.headers['x-painel-nonce']!==nonce){send(403,{ok:false,error:'invalid_request'});return true;}
      try{let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>4096){send(413,{ok:false,error:'too_large'});return true;}chunks.push(chunk);}const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));writer ||= require('./conselho-vereditos.cjs').create({stateRoot:state,...(hora?{hora}:{}),now,readCouncil:verifiedCouncil});const result=await writer.append(input),fresh=require('./conselho-fonte.cjs').read(state,now());send(200,{...result,ranking:fresh.ranking,decisions:fresh.decisionHistory});}
      catch(e){const messages={changed:'A proposta mudou ou a leitura venceu. Toque em Atualizar leitura.',busy:'Um carimbo está sendo salvo. Aguarde o recibo.',time:'Não consegui medir a hora. Atualize a leitura e tente de novo.','invalid log':'O registro de escolhas precisa ser conferido. Atualizar leitura relê o registro.','already sealed':'Esta proposta já tem um selo. Toque em Repensar para mudar.'};send(409,{ok:false,error:'seal_not_saved',message:messages[e.message]||'O selo não foi confirmado. Atualize a leitura para conferir o registro.'});}return true;
    }
    send(405,{ok:false,error:'method_not_allowed'});return true;
  }};
}
module.exports={create,assets};
