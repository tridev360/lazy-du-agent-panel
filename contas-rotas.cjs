'use strict';
const N=require('./contas-nucleo.cjs');
function criar({root,dir=__dirname,port,nonce,sendRecado,now=()=>new Date()}){
 let pending=null,busy=false;
 const enviar=sendRecado||(()=>({ok:false,statusCode:410}));
 function view(example=false){const date=now(),source=example?null:N.ler(root,'credito-claude.jsonl');const data=N.montar(source?.texto,date);if(!example&&pending&&data.atual===pending.conta&&Date.parse(data.contas.find(c=>c.atual)?.lidoEm)>=pending.atMs)pending=null;return {ok:true,...data,fonteDisponivel:!!source,example,nonce:example?null:nonce,preparacao:!example&&pending?{conta:pending.conta,pedidoEm:pending.at,pronto:N.pronto(N.ler(root,'coordenacao.md'),pending)}:null};}
 function safe(req){const origin='http://'+req.headers.host;return [`localhost:${port}`,`127.0.0.1:${port}`].includes(req.headers.host)&&req.headers.origin===origin&&(!req.headers['sec-fetch-site']||req.headers['sec-fetch-site']==='same-origin')&&String(req.headers['content-type']||'').split(';')[0]==='application/json'&&typeof nonce==='string'&&req.headers['x-painel-nonce']===nonce;}
 async function prepare(req,send){if(busy)return send(409,{ok:false,erro:'ocupado'});busy=true;try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>512)return send(413,{ok:false,erro:'tamanho'});chunks.push(chunk);}let j;try{j=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return send(400,{ok:false,erro:'pedido'});}if(!j||Array.isArray(j)||Object.keys(j).length!==1||!N.contaValida(j.conta))return send(400,{ok:false,erro:'pedido'});
  const at=now(),current=view();if(!current.contas.some(c=>c.conta===j.conta))return send(400,{ok:false,erro:'pedido'});if(pending&&pending.conta===j.conta)return send(200,{ok:true,repetida:true,preparacao:{conta:pending.conta,pedidoEm:pending.at,pronto:N.pronto(N.ler(root,'coordenacao.md'),pending)}});
  if(pending)return send(409,{ok:false,erro:'troca_em_preparo'});
  if(!current.fonteDisponivel||current.atual===j.conta)return send(409,{ok:false,erro:'conta_atual_ou_sem_fonte'});
  const antes=N.sinais(N.ler(root,'coordenacao.md')?.texto);const r=await enviar({para:'claude',texto:'PREPARAR TROCA PARA '+j.conta},at);if(!r?.ok)return send(r?.statusCode||409,{ok:false,erro:'recado'});
  pending={conta:j.conta,at:at.toISOString(),atMs:at.getTime(),antes};return send(200,{ok:true,preparacao:{conta:j.conta,pedidoEm:pending.at,pronto:false}});
 }catch{return send(409,{ok:false,erro:'recado'});}finally{busy=false;}}
 function handle(req,url,{send,example=false}){if(!['/api/contas-claude','/api/contas-claude/preparar'].includes(url.pathname))return false;
  if(req.method==='GET'&&url.pathname==='/api/contas-claude'){send(200,view(example));return true;}
  if(req.method==='POST'&&url.pathname==='/api/contas-claude/preparar'){if(example||!safe(req)){send(403,{ok:false,erro:'origem'});return true;}send(410,{ok:false,erro:'desligado',mensagem:'Troca de conta pelo painel desligada nesta versão. Troque a conta no app.'});return true;}
  send(405,{ok:false,erro:'metodo'});return true;
 }
 return {handle,view};
}
module.exports={criar};
