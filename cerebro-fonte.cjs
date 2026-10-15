'use strict';
const fs=require('node:fs'),path=require('node:path');
const TYPES=new Set(['user','feedback','project','reference','regra']),GROUPS=new Set(['ordem','metodo','dominio','casa']);
function safeJSON(root,relative){
 const base=path.resolve(root),target=path.resolve(base,relative);if(!target.startsWith(base+path.sep))return {error:'Caminho fora da cópia'};
 try{let part=base;for(const item of path.relative(base,target).split(path.sep)){part=path.join(part,item);if(fs.lstatSync(part).isSymbolicLink())return {error:'Links não são lidos'};}
 const st=fs.statSync(target);if(!st.isFile()||st.size>3000000)return {error:'Arquivo grande ou inválido'};
 if(fs.realpathSync(base)!==base||fs.realpathSync(target)!==target)return {error:'Caminho inválido'};
 return {value:JSON.parse(fs.readFileSync(target,'utf8'))};
 }catch(e){return {error:e.code==='ENOENT'?'Arquivo ausente':'Arquivo não pôde ser lido'};}
}
const text=(v,limit=240)=>typeof v==='string'?v.slice(0,limit):'';
function normalize(input){
 if(!input||!Array.isArray(input.nodes)||!Array.isArray(input.edges))throw Error('Falta a lista de memórias e ligações');
 const ids=new Set(),nodes=[];for(const n of input.nodes.slice(0,1500)){
 if(!n||!text(n.id)||n.id.length>160||ids.has(n.id)||!TYPES.has(n.tipo)||!GROUPS.has(n.grupo))continue;ids.add(n.id);
 nodes.push({id:text(n.id,160),arquivo:text(n.arquivo),tipo:n.tipo,grupo:n.grupo,desc:text(n.desc,2000),region:text(n.region,30),title:text(n.arquivo).split('/').pop().replace(/\.[^.]+$/,'')||text(n.id)});
 }
 const unique=new Set(),edges=[];for(const e of input.edges.slice(0,8000)){if(!e||!ids.has(e.de)||!ids.has(e.para)||e.de===e.para)continue;const k=[e.de,e.para].sort().join('|');if(unique.has(k))continue;unique.add(k);edges.push({de:e.de,para:e.para});}
 if(!nodes.length)throw Error('Nenhuma memória válida');return {geradoEm:text(input.geradoEm),fonte:text(input.fonte),nodes,edges};
}
function age(at,now){const t=Date.parse(at);return Number.isFinite(t)?Math.max(0,now-t):null;}
function readLegacy(root,now=Date.now()){
 const issues=[],source=safeJSON(root,'estado/cerebro.json');let input=source.value,fixture=false;
 if(!input){fixture=true;input=safeJSON(__dirname,'demo/cerebro.json').value;issues.push({source:'estado/cerebro.json',message:source.error,solution:'A prévia usa o exemplo DEMO que vem com o painel.'});}
 let graph;try{graph=normalize(input);}catch(e){return {ok:false,message:e.message,solution:'Confira nodes e edges no arquivo estado/cerebro.json e toque em Atualizar leitura.'};}
 const live=[],used=[];const sources=[['estado/sessoes-claude.json','sessoes'],['estado/fila.json','rodando'],['estado/estado-agora.json','rodando']];
 const readings=[];for(const [file,key]of sources){const found=safeJSON(root,file);if(!found.value){issues.push({source:file,message:found.error,solution:'Atualizar leitura tenta buscar este arquivo de novo.'});continue;}
 const doc=found.value,at=text(doc.atualizadoEm||doc.atualizado||doc.geradoEm);readings.push({source:file,at});
 for(const [i,item]of (Array.isArray(doc[key])?doc[key]:[]).entries()){
 if(key==='sessoes'&&item.ativa!==true)continue;
 const measured=text(item.medidoEm||item.ultima||item.atualizadoEm||at),elapsed=age(measured,now),fresh=elapsed!==null&&elapsed<=5*60000&&Date.parse(measured)<=now+120000;
 const front=text(item.frente||item.sessao||item.faixa||item.titulo||item.o_que),known=/\b(ATENDIMENTO|ASSISTENTE|LOJA|CONTE[ÚU]DO|PC|VPS)\b/i.exec(front);
 const role=known?known[1].toLowerCase().replace('ú','u'):item.lado==='codex'?'codex':null;
 const matched=role&&graph.nodes.find(n=>n.id.toLowerCase()===role||n.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()===role||n.id.toLowerCase().endsWith('_'+role));
 const target=matched?matched.id:null;
 live.push({id:'live-'+key+'-'+i+'-'+file.split('/').pop(),title:text(item.titulo||item.o_que||item.fazendo)||'Sessão sem nome',desc:text(item.fazendo||item.detalhe)||'Registrada nesta fonte.',source:file,at:measured,fresh,target,role,kind:key==='sessoes'?'sessão':'frente'});
 // Só há partículas de uso quando o estado fornece a ligação explicitamente.
 for(const id of Array.isArray(item.memoriasUsadas)?item.memoriasUsadas:[]){if(graph.nodes.some(n=>n.id===id)&&target)used.push({de:target,para:id,at:measured,source:file});}
 }
 }
 return {ok:true,...graph,demo:fixture||/demo|fict/i.test(graph.fonte),fixture,readAt:new Date(now).toISOString(),readings,live,used,issues,frescor:(()=>{const F=require('./frescor.cjs'),s=F.selo(graph.geradoEm,now,F.LIMITES.cerebroMs);return {geradoEm:s.em,idadeTexto:s.idadeTexto,velho:s.velho&&!fixture,semHora:s.semHora,solucao:F.SOLUCAO.cerebro};})()};
}
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const timeOf=item=>text(item.medidoEm||item.lastAt||item.ultimaEm||item.atualizadoEm||item.atualizado||item.ultima||item.iniciadoEm||item.criadoEm||item.em||item.at||item.timestamp);
const terminal=s=>/^(concluido|concluida|feito|feita|done|closed|encerrado|cancelado|erro|failed|parou|idle|waiting|arquivado)$/.test(fold(s));
const humanText=v=>text(v);
function activityOf(item){
 const scalar=v=>humanText(typeof v==='string'?v:v&&typeof v==='object'?(v.titulo||v.title||v.label||v.descricao||v.description||v.texto||v.o_que):'');
 for(const field of ['fazendo','currentItemTitle','taskTitle','atividade','activity','detalhe']){const value=scalar(item[field]);if(value)return {desc:value,known:true};}
 const current=Array.isArray(item.currents)?item.currents[0]:item.currents||item.current;
 if(scalar(current))return {desc:scalar(current),known:true};
 if(scalar(item.presentation?.activityLabel))return {desc:scalar(item.presentation.activityLabel),known:true};
 for(const field of ['fez','achou','mudou']){const value=scalar(item[field]);if(value)return {desc:'Último passo: '+value,known:true};}
 if(scalar(item.precisa))return {desc:'Espera: '+scalar(item.precisa),known:true};
 const recorded=humanText(item.lastAction),project=humanText(item.project);
 if(recorded&& !/sem leitura|não informad|nao informad/i.test(recorded))return {desc:recorded+(project?' · '+project.replace(/-/g,' '):''),known:false,solution:'? tarefa: a fonte só informou o estado do trabalho. Atualizar leitura busca a descrição atual.'};
 if(item.state==='waiting')return {desc:'Espera registrada'+(project?' · '+project.replace(/-/g,' '):''),known:false,solution:'? tarefa: informe a atividade na fonte; Atualizar leitura relê os metadados.'};
 return {desc:'? tarefa · Atualizar leitura busca a descrição.',known:false,solution:'A fonte não informou a atividade. Atualizar leitura relê estado-agora e os metadados.'};
}
const memoryWordIndex=new WeakMap();
function linkedMemories(item,target,graph){
 const explicit=new Set([...(Array.isArray(item.memoriasUsadas)?item.memoriasUsadas:[]),...(Array.isArray(item.memorias)?item.memorias:[]),...(Array.isArray(item.regras)?item.regras:[])].filter(v=>typeof v==='string'));
 const words=new Set(fold([item.frente,item.titulo,item.o_que,item.fazendo,item.task,item.nome].join(' ')).match(/[a-z0-9]{4,}/g)||[]);
 for(const word of ['codex','claude','frente','sessao','estado','agente','agora','rodando','tarefa','arquivo','teste','coordenador','registrada','nesta','fonte','trabalho','aberto','processos','identificada','pasta'])words.delete(word);
 // A role name alone is not evidence of a work using every memory in that area.
 if(words.size===1)for(const role of ['atendimento','painel','cortes','loja'])words.delete(role);
 const adjacent=new Set();for(const e of graph.edges){if(e.de===target)adjacent.add(e.para);if(e.para===target)adjacent.add(e.de);}
 let index=memoryWordIndex.get(graph);if(!index){const tokens=value=>new Set(fold(value).match(/[a-z0-9]+/g)||[]);index=graph.nodes.map(n=>({n,names:tokens(n.title+' '+n.arquivo),description:tokens(n.desc)}));memoryWordIndex.set(graph,index);}
 const score=({n,names,description})=>explicit.has(n.id)||explicit.has(n.arquivo)?1000:[...words].reduce((sum,w)=>sum+(names.has(w)?10:description.has(w)?1:0),0)+(adjacent.has(n.id)?1:0);
 return index.filter(({n,names,description})=>n.id!==target&&(explicit.has(n.id)||explicit.has(n.arquivo)||adjacent.has(n.id)||[...words].some(w=>names.has(w)||description.has(w)))).map((entry,index)=>({...entry,index,score:score(entry)})).sort((a,b)=>b.score-a.score||a.index-b.index).map(({n})=>({id:n.id,method:explicit.has(n.id)||explicit.has(n.arquivo)?'explicito':adjacent.has(n.id)?'link':'assunto'})).slice(0,20);
}
function safeLines(root,relative){
 const base=path.resolve(root),target=path.resolve(base,relative);if(!target.startsWith(base+path.sep))return [];
 try{let current=base;for(const part of path.relative(base,target).split(path.sep)){current=path.join(current,part);if(fs.lstatSync(current).isSymbolicLink())return [];}
 const stat=fs.statSync(target);if(!stat.isFile()||stat.size>16*1024*1024||fs.realpathSync(target)!==target)return [];
 const length=Math.min(stat.size,256*1024),buffer=Buffer.alloc(length),fd=fs.openSync(target,'r');try{fs.readSync(fd,buffer,0,length,stat.size-length);}finally{fs.closeSync(fd);}
 const rows=buffer.toString('utf8').split(/\r?\n/);if(stat.size>length)rows.shift();return rows.map(row=>{try{return JSON.parse(row);}catch{return null;}}).filter(Boolean).slice(-300);
 }catch{return [];}
}
function read(root,now=Date.now(),options={}){
 const d=readLegacy(root,now);if(!d.ok)return d;
 const graph={nodes:d.nodes,edges:d.edges},byId=new Map(d.nodes.map(n=>[n.id,n])),added=[];
 for(const l of d.live){l.memories=linkedMemories({titulo:l.title,frente:l.role,fazendo:l.desc},l.target,graph);l.subagents=null;l.status=l.fresh?'rodando':'registrado';l.processCount=Number(/\((\d+) processos\)/.exec(l.title)?.[1])||null;}
 function add(item,source,index,kind='sessão'){
  if(!item||typeof item!=='object'||terminal(item.status||item.estado))return;
  const at=timeOf(item),elapsed=age(at,now),fresh=elapsed!==null&&elapsed<=5*60000&&Date.parse(at)<=now+120000&&(!item.state||item.state==='working')&&item.status!=='aguardando';
  const front=text(item.frontId||item.frente||item.role||item.sessao||item.nome||item.name||item.titulo||item.o_que||item.task),role=/\b(atendimento|assistente|loja|cortes|pc|vps|codex|coordenador)\b/.exec(fold(front))?.[1]||(item.family==='codex'?'codex':null);
  const target=d.nodes.find(n=>n.id===role||fold(n.title)===role||fold(n.id).endsWith('_'+role))?.id||null;
  const id='live-'+source.replace(/[^a-z0-9]/gi,'-')+'-'+text(String(item.id||item.threadId||index),180);
  const title=humanText(item.conversationName||item.nome||item.name||item.rotulo||item.titulo||item.o_que||front)||'Sessão';
  const activity=activityOf(item),desc=activity.desc;
  const hidden=/sigilos|reservad|segredos/i.test(front+' '+title+' '+desc);if(hidden)return;
  const subagents=Number.isInteger(item.subagents)?item.subagents:Number.isInteger(item.subagentes)?item.subagentes:Array.isArray(item.children)?item.children.length:null;
  const live={id,title,desc,source:activity.solution?source+' · '+activity.solution:source,at,fresh,target,role,kind,subagents,status: text(item.status||item.estado||item.state)||'registrado',memories:linkedMemories({...item,titulo:title,fazendo:activity.known?desc:item.project||'',frente:front},target,graph),processAlive:item.processAlive===true,activityKnown:activity.known,activitySolution:activity.solution||null};d.live.push(live);added.push(live);
 }
 const auto=safeJSON(root,'estado/estado-agora.json').value;
 for(const item of Array.isArray(auto?.rodando)?auto.rodando:[]){const live=d.live.find(n=>n.source==='estado/estado-agora.json'&&n.title===item.o_que);if(!live)continue;
  const activity=activityOf(item),unknown=/nao identificad|não identificad|indisponivel|indisponível/i.test(item.o_que||'');
  live.desc=activity.known?activity.desc:unknown?'? tarefa · Atualizar leitura busca a frente.':humanText(item.o_que||live.title);live.activityKnown=activity.known||!unknown;live.activitySolution=unknown?'A fonte identificou o processo, mas não a tarefa. Atualizar leitura relê os metadados atuais.':null;
 }
 for(const [i,item]of (Array.isArray(auto?.sessoes)?auto.sessoes:[]).entries())add({...item,medidoEm:timeOf(item)||timeOf(auto)},'estado/estado-agora.json',i);
 const cron=safeJSON(root,'estado/cronograma.json').value;
 for(const [i,item]of (Array.isArray(cron?.frentes)?cron.frentes:[]).entries())add({...item,medidoEm:timeOf(item)||timeOf(cron)},'estado/cronograma.json',i,'frente');
 const dispatches=safeLines(root,'estado/despachos.jsonl'),latest=new Map();
 for(const item of dispatches){const key=text(item.id||item.taskId||item.frente||item.sessao);if(!key)continue;const previous=latest.get(key),event=text(item.evento),status=/^(VALIDADO|IMPLEMENTADO|FALHOU)$/.test(event)?'feito':event==='PEDIDO'?'aguardando':text(item.status||item.estado)||'rodando';latest.set(key,{...previous,...item,status,frente:item.frente||'codex',iniciadoEm:event==='INICIADO'?item.em:previous?.iniciadoEm});}
 d.dispatches=[...latest.values()].filter(item=>!terminal(item.status)&&item.iniciadoEm).map(item=>({id:text(item.id||item.taskId)+':'+item.iniciadoEm,at:item.iniciadoEm,source:'estado/despachos.jsonl'})).filter(item=>item.id&&item.at&&Date.parse(item.at)<=now+120000);
 for(const [i,item]of [...latest.values()].entries())add(item,'estado/despachos.jsonl',i,'despacho');
 const metadata=options.metadata||{},agents=metadata.agents||metadata.equipe?.agents||metadata.equipe?.agentes||[];
 const publicAgents=agents.filter(a=>!a.parentId&&!a.reserved&&a.presentation?.visibility!=='reserved');
 const autoAt=timeOf(auto||{}),autoAge=age(autoAt,now),autoFresh=autoAge!==null&&autoAge<=5*60000&&Date.parse(autoAt)<=now+120000;
 for(const [i,item]of publicAgents.entries()){
  const project=fold(item.project||item.projectId),match=autoFresh&&project&&(Array.isArray(auto?.rodando)?auto.rodando:[]).find(front=>fold(front.o_que||front.titulo).split(':')[0].trim()===project);
  add({...item,taskTitle:item.taskTitle||item.currentItemTitle||(match?humanText(match.o_que||match.titulo):undefined),subagents:agents.filter(a=>a.parentId===item.id).length},match?'estado/estado-agora.json + processos/metadados':'processos/metadados',i);
 }
 for(const item of Array.isArray(options.processes)?options.processes:[])add({...item,processAlive:true,medidoEm:new Date(now).toISOString(),nome:item.name||'Codex vivo',fazendo:item.activity||'Processo vivo; tarefa não informada'},'processos/codex',item.id||0);
 for(const l of added)for(const memory of l.memories)if(l.fresh&&byId.has(memory.id))d.used.push({de:l.id,para:memory.id,at:l.at,source:l.source,method:memory.method});
 // Existing live fronts also light their mapped connections; linkage is labelled, never claimed as explicit usage.
 for(const l of d.live.filter(l=>!added.includes(l)))for(const memory of l.memories)if(l.fresh&&memory.method==='assunto')d.used.push({de:l.id,para:memory.id,at:l.at,source:l.source,method:memory.method});
 d.activitySources={auto:!!auto,dispatches:dispatches.length>0,metadata:publicAgents.length>0};
 return d;
}
function create({root,metadataProvider}){return {handle(req,url,{send}){if(url.pathname!=='/api/cerebro')return false;if(req.method!=='GET'){send(405,{ok:false,message:'Esta aba só faz leitura.'});return true;}if(req.headers?.['x-painel-initial-reading']==='1'){send(200,{...read(root),initialReading:true});return true;}let metadata;try{metadata=metadataProvider?.snapshot?.()||metadataProvider?.current?.();}catch{}if(metadata&&typeof metadata.then==='function'){metadata.then(value=>send(200,read(root,Date.now(),{metadata:value})),()=>send(200,read(root)));}else send(200,read(root,Date.now(),{metadata}));return true;}};}
module.exports={read,normalize,safeJSON,safeLines,age,create,linkedMemories,activityOf};
