'use strict';
const {createHash}=require('node:crypto');
const FILES={COORDENADOR:'coordenacao',ATENDIMENTO:'atendimento',ASSISTENTE:'assistente',LOJA:'loja',CORTES:'cortes'};
const ORDER=['COORDENADOR','ATENDIMENTO','ASSISTENTE','LOJA','CORTES'];
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
function publicText(value,limit=200){
 const text=String(value||'');
 if(/PRIVADO|_SECRETS|backup-privado|\b(?:seed|api.?key|senha|secret)\b|0x[a-f\d]{40}/i.test(text))return 'Detalhes no chat da sessão.';
 return require('./realtime.cjs').safeText(text,600).replace(/\b[a-f\d]{7,64}\b/gi,'').replace(/(?:[A-Z]:[\\/]|(?:estado|tasks|casa|src|public|wt)[\\/])[^\s;,]+/gi,'').replace(/[`*_]/g,'').replace(/\b(?:main do GitHub|main|tracker no ar)\s*=\s*/gi,'versão ativa: ').replace(/\s+/g,' ').trim().slice(0,limit);
}
function instructionOf(value){return /^(?:revisar|integrar|corrigir|conferir|validar|publicar|reiniciar|implementar|ler|escrever|aguardar)\b|\b(?:ainda vai|vai subir|vai integrar|precisa(?:mos)?|deve|pede)\b/i.test(value||'');}
function summaryOf(text){
 let fenced=false;const lines=String(text||'').split(/\r?\n/).map(line=>{if(/^\s*```/.test(line)){fenced=!fenced;return '';}return fenced?'':line;}),start=lines.findIndex(line=>/^##\s+PARA O OPERADOR\b/i.test(line));
 const fields={fez:null,achou:null,mudou:null,precisa:null};if(start<0)return {fields,available:false,clock:null};
 let key=null;for(const line of lines.slice(start+1,start+32)){
  if(/^#{1,6}\s/.test(line))break;
  const label=/^\s*(?:[-*]\s*)?(FEZ|ACHOU|MUDOU|PRECISA DE VOC[EÊ]):\s*(.*)$/i.exec(line);
  if(label){key=normalize(label[1])==='PRECISA DE VOCE'?'precisa':label[1].toLowerCase();fields[key]=label[2];}
  else if(key&&/^\s{2,}\S/.test(line))fields[key]+=' '+line.trim();
  else if(line.trim())break;
 }
 for(const key of Object.keys(fields))fields[key]=fields[key]?publicText(fields[key],320):null;
 if(fields.fez&&(instructionOf(fields.fez)||/\b(?:aguarda|falta|integrar|revisar)\b/i.test(fields.fez)&&!/\b(?:conclu[ií]do|entregue|saiu|terminou|publicado|pront[oa])\b/i.test(fields.fez))){fields.proximo=fields.fez;fields.fez=null;}
 return {fields,available:Object.values(fields).some(Boolean),clock:/\b([0-2]\d:[0-5]\d)\b/.exec(lines[start])?.[1]||null};
}
function needsOperator(summary){const value=normalize(summary?.fields?.precisa);return Boolean(value&&!/^(?:NADA|NENHUM|SEM PENDENCIA|NAO PRECISA|NOTHING|NONE)\b/.test(value));}
function readyOf(text,now=new Date()){
 const rows=new Map();let fenced=false;for(const line of String(text||'').split(/\r?\n/)){
  if(/^\s*```/.test(line)){fenced=!fenced;continue;}if(fenced)continue;
  if(!/^\s*[\p{L}\p{N} _-]{2,60}?\s+PRONTO\b[^\n]*?\b\d{2}:\d{2}\b[^\n]*?\|\s*PARA O OPERADOR:/iu.test(line))continue;
  const match=/^\s*([\p{L}\p{N} _-]{2,60}?)\s+(?:PRONTO|PONTO)\b/iu.exec(line);if(!match)continue;
  const name=publicText(match[1].trim(),60),message=line.slice(line.toUpperCase().indexOf('PARA O OPERADOR:')+'PARA O OPERADOR:'.length),clock=/\b(\d{2}:\d{2})\b/.exec(line)?.[1],updatedAt=clock?require('./cronograma.cjs').clockAt(clock,now):null;
  const summary=summaryOf('## PARA O OPERADOR\n'+message.replace(/(?:^|;\s*)(FEZ|ACHOU|MUDOU|PRECISA DE VOC[EÊ]):/gi,'\n- $1:'));
  if(!summary.available){const value=publicText(message,320)||null;summary.fields[instructionOf(value)||/\b(?:aguarda|falta)\b/i.test(value||'')&&!/\b(?:pront[oa]|conclu[ií]do|entregue|saiu)\b/i.test(value||'')?'proximo':'fez']=value;summary.available=Boolean(value);}
  const row={id:'ready:'+createHash('sha1').update(name).digest('hex').slice(0,12),name,summary,needsOperator:needsOperator(summary),updatedAt,source:'estado/codex.md'};
  const previous=rows.get(name);if(!previous||!previous.updatedAt||updatedAt&&updatedAt>=previous.updatedAt)rows.set(name,row);
 }return [...rows.values()].slice(-12);
}
function confirmedOwners(text){
 const map=new Map();map.focuses=new Map();const section=/## Frentes que passam do COORDENADOR para a (ATENDIMENTO|ASSISTENTE|LOJA|CORTES)[^\n]*\n([\s\S]*?)(?=\n## |$)/i.exec(text||'');if(!section)return map;
 for(const line of section[2].split(/\r?\n/)){const id=/session id\s+([a-f\d]{8}-[a-f\d-]{27,})/i.exec(line)?.[1];if(id){map.set(id,section[1].toUpperCase());const focus=require('./foco.cjs').focusKeyOf(line);if(focus)map.focuses.set(id,focus);}}return map;
}
function ownerOf(agent,explicit,byId,seen=new Set()){
 if(seen.has(agent.id))return {id:'COORDENADOR',source:'unresolved'};seen.add(agent.id);
 if(agent.parentId&&byId.has(agent.parentId))return ownerOf(byId.get(agent.parentId),explicit,byId,seen);
 const id=String(agent.conversationId||agent.id).replace(/^(?:codex|claude):/,'');
 if(explicit.has(id))return {id:explicit.get(id),source:'casa/CODEX-POR-SESSAO.md'};
 const declared=normalize(agent.ownerSession||agent.sessaoDona||'');if(ORDER.includes(declared)&&(!agent.ownerSource||agent.ownerSource==='task-session'))return {id:declared,source:'task-session'};
 const project=normalize(agent.projectId+' '+agent.project);
 if(/COLECAO|PAINEL|PANEL|FERRAMENTAS/.test(project))return {id:'COORDENADOR',source:'project-without-owner-policy'};
 const name=normalize(agent.conversationName||'');const named=/^CODEX (ATENDIMENTO|ASSISTENTE|LOJA|CORTES)\b/.exec(name);
 if(named)return {id:named[1],source:'conversation-name'};
 return {id:null,source:'owner-unconfirmed'};
}
function snapshotOperator(root,team,data,now=new Date()){
 const read=require('./leitor.cjs').readSafe;let config={};try{config=JSON.parse(read(root,'estado/sessoes-claude.json',32000));}catch{}
 const approved=new Map((Array.isArray(config.sessoes)?config.sessoes:[]).filter(item=>ORDER.includes(normalize(item.titulo))).map(item=>[normalize(item.titulo),item]));
 const sessions=ORDER.filter(id=>approved.has(id)).map(id=>{
  const src=read(root,'estado/'+FILES[id]+'.md',64000),summary=summaryOf(src),meta=approved.get(id),state=data.states?.find(item=>item.id===FILES[id]);
  let modifiedAt=null;try{const fs=require('node:fs'),path=require('node:path'),file=path.join(root,'estado',FILES[id]+'.md');if(src&&![root,path.join(root,'estado'),file].some(value=>fs.lstatSync(value).isSymbolicLink()))modifiedAt=fs.statSync(file).mtime.toISOString();}catch{}
  if(id==='CORTES'&&/full report|relat[oó]rio.*acervo/i.test(summary.fields.fez||'')){const today=new Date(now.getTime()-3*3600000).toISOString().slice(0,10),launch=data.launches?.items?.find(item=>item.sessao==='CORTES'&&item.dia===today&&/full report|relat[oó]rio.*acervo/i.test(item.o_que));if(launch){if(launch.estado==='no ar')summary.fields.fez='Publicou o relatório do acervo';else{summary.fields.proximo='Relatório do acervo: publicação '+(launch.estado==='armado'?'programada':launch.estado);summary.fields.fez=null;}summary.launchSource='estado/lancamentos.json';}}
  let updatedAt=summary.clock?require('./cronograma.cjs').clockAt(summary.clock,now):state?.updatedAt||modifiedAt;
  if(summary.clock&&updatedAt&&Date.parse(updatedAt)-now.getTime()>5*60000)updatedAt=new Date(Date.parse(updatedAt)-86400000).toISOString();
  return {id,name:id,parentId:id==='COORDENADOR'?null:'COORDENADOR',sessionId:meta.sessionId,summary,updatedAt,needsOperator:needsOperator(summary),source:'estado/'+FILES[id]+'.md',state:needsOperator(summary)?'waiting':'registered'};
 });
 const codex=readyOf(read(root,'estado/codex.md',64000),now),explicit=confirmedOwners(read(root,'casa/CODEX-POR-SESSAO.md',32000)),byId=new Map(team.agents.map(agent=>[agent.id,agent]));
 for(const agent of team.agents){const owner=ownerOf(agent,explicit,byId);agent.ownerSession=owner.id;agent.ownerSource=owner.source;const conversationId=String(agent.conversationId||'').replace(/^(?:codex|claude):/,'');const focus=agent.taskFocusKey||agent.identity?.focusKey||explicit.focuses.get(conversationId);if(focus&&agent.identity){agent.identity.focusKey=focus;agent.identity.focusLabels=require('./foco.cjs').labels[focus];}}
 const chiefs=team.agents.filter(agent=>agent.family==='codex'&&!agent.parentId);
 for(const agent of chiefs){const actor=normalize(agent.deliveryActor||agent.conversationName||''),matches=codex.filter(row=>actor&&actor.includes(normalize(row.name)));if(matches.length===1&&chiefs.filter(other=>normalize(other.deliveryActor||other.conversationName||'').includes(normalize(matches[0].name))).length===1){matches[0].agentId=agent.id;matches[0].ownerSession=agent.ownerSession;continue;}codex.push({id:'summary:'+agent.id,name:agent.identity?.labels?.pt||'CODEX',agentId:agent.id,ownerSession:agent.ownerSession,summary:{fields:{fez:null,achou:null,mudou:null,precisa:null},available:false},updatedAt:agent.lastAt,needsOperator:false,source:'estado/codex.md'});}
 return {sessions,codex,readAt:now.toISOString(),source:'operator-blocks-and-public-session-flow'};
}
function attachSessionNodes(operator,team,resolver,now=new Date(),root='operator',app=null){
 const realIds=new Set(),virtual=[];
 const titles={COORDENADOR:{pt:'AGENTE MAESTRO DA CASA',en:'AGENTE HOUSE MAESTRO',es:'AGENTE MAESTRO DE LA CASA'},ATENDIMENTO:{pt:'AGENTE MAESTRO DO ATENDIMENTO',en:'AGENTE ATENDIMENTO MAESTRO',es:'AGENTE MAESTRO DE ATENCIÓN'},ASSISTENTE:{pt:'AGENTE MAESTRO DOS ROBÔS',en:'AGENTE ASSISTENTE MAESTRO',es:'AGENTE MAESTRO DE LOS ASSISTENTES'},LOJA:{pt:'AGENTE MAESTRO DOS EVENTOS',en:'AGENTE EVENTS MAESTRO',es:'AGENTE MAESTRO DE EVENTOS'},CORTES:{pt:'AGENTE EDITOR DE CORTES',en:'AGENTE CONTENT EDITOR',es:'AGENTE EDITOR DE CONTENIDO'}};
 const sessionsApp=app||require('./sessoes-app.cjs').readSessions();
 for(const session of operator.sessions){
  const bare=String(session.sessionId||'').replace(/^local_/,'').toLowerCase(),appSession=require('./sessoes-app.cjs').lookupSession(sessionsApp,session.sessionId),cli=appSession?.cliSessionId||null;
  if(cli)session.cliSessionId=cli;
  const real=team.agents.find(agent=>agent.family==='claude'&&!agent.parentId&&[cli,bare].includes(String(agent.conversationId).replace(/^claude:/,'').toLowerCase()));
  const id=real?.id||'operator:'+session.id;if(real)realIds.add(real.id);
  // estado e hora reais: os da conversa lida; sem ela (parada ha mais de 1 h), a ultima atividade que o app registrou
  const lastAt=[real?.lastAt,appSession?.lastActivityAt,session.updatedAt].filter(value=>value&&Number.isFinite(Date.parse(value))&&Date.parse(value)-now.getTime()<=5*60000).sort().at(-1)||null;
  const node={id,parentId:null,roleKey:session.id==='CORTES'?'copy-reviewer':'maestro',identity:{roleKey:session.id==='CORTES'?'copy-reviewer':'maestro',labels:titles[session.id]},state:real?.state||session.state,lastAt,processAlive:real?.processAlive||false,startedAt:real?.startedAt||session.updatedAt,tools:[],agente:real?.agente,delivery:real?.delivery,conversationId:real?.conversationId||(cli?'claude:'+cli:null),appArchived:appSession?appSession.isArchived:null};
  const declared=/(?:~|por volta das )([0-2]\d:[0-5]\d)/.exec([session.summary.fields.proximo,session.summary.fields.precisa].filter(Boolean).join(' '));
  if(declared)node.delivery={etaAt:require('./cronograma.cjs').clockAt(declared[1],now,true),etaSource:'operator-summary',estimated:false,estimateBasis:{method:'declared',source:session.source,readAt:session.updatedAt}};
  session.node=node;virtual.push(node);
 }
 const newlyAssigned=resolver.assign([...team.agents,...virtual.filter(node=>!realIds.has(node.id))]);const avatars=new Map(newlyAssigned.map(agent=>[agent.id,agent.agente]));
 require('./previsao.cjs').applyForecasts(root+':operator',{agents:virtual,groups:[]},now);for(const session of operator.sessions)session.node.agente=avatars.get(session.node.id)||session.node.agente;
 operator.sessionAgentIds=[...realIds];return operator;
}
module.exports={instructionOf,summaryOf,needsOperator,readyOf,confirmedOwners,ownerOf,snapshotOperator,attachSessionNodes,publicText,ORDER};
