'use strict';
const {projectJSON}=require('./project-json.cjs'),{createHash}=require('node:crypto');
const key=id=>typeof id==='string'?createHash('sha256').update(id).digest('hex').slice(0,16):null;
const headers=['type','timestamp','sessionId','parentSessionId','isSidechain','agentId','payload.id','payload.parent_thread_id','payload.type','payload.role','payload.phase','payload.name','message.stop_reason','payload.source.subagent.thread_spawn.parent_thread_id','payload.source.subagent.parent_thread_id',...Array.from({length:8},(_,i)=>[`message.content.${i}.type`,`message.content.${i}.name`,`message.content.${i}.id`,`message.content.${i}.tool_use_id`]).flat()];
const clean=text=>String(text||'').replace(/(?:https?:\/\/|[a-z]:[\\/])\S+|\b[^\s@]+@[^\s@]+\b|0x[a-f\d]{40}|\b[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}\b|\b(?:sk-|ghp_|xox)[\w-]+|\b[\w-]{33,}\b/gi,'').replace(/<[^>]*>|[`*_#]/g,'').replace(/[\x00-\x1f]/g,' ').replace(/\s+/g,' ').trim();
function actionOf(name,text){
  const s=String(text||'');
  const tab=/\bteam\b|equipe/i.test(s)?['Team','Equipe']:/\busage\b|consumo/i.test(s)?['Usage','Consumo']:/\bhome\b/i.test(s)?['Home','Home']:null;
  if(/screenshot|tir.*print|captur.*tela|\.png|view_image/i.test(s+' '+name))return tab?['Taking '+tab[0]+' screenshots','Tirando prints da '+tab[1]]:['Checking screen images','Conferindo imagens das telas'];
  if(/(?:qa|check)[-_][\w.-]*\.cjs/i.test(s))return['Checking the panel screens','Conferindo as telas do painel'];
  if(/node\s+--test|vitest|pytest|npm\s+test|playwright/i.test(s))return['Running the tests','Rodando os testes'];
  if(/RELATORIO|REPORT|\.md.*write|write.*\.md|Writing.*report|Escrevendo.*relat/i.test(s))return['Writing the report','Escrevendo o relatório'];
  const filename=clean(s.replace(/\\/g,'/').match(/(?:^|[\s"':])([^\s"']+\.(?:[cm]?[jt]sx?|md|json|html|css|py|ps1))/i)?.[1]?.split('/').at(-1)||'').slice(0,36);
  if(/apply_patch|\bEdit\b|\bWrite\b/.test(name)||/apply_patch|writeFile|Set-Content/.test(s))return[filename?'Editing '+filename:'Editing a file',filename?'Editando '+filename:'Editando um arquivo'];
  if(/\bRead\b|read_file|readFile|Get-Content|\bcat\b/.test(name+' '+s))return[filename?'Reading '+filename:'Reading a file',filename?'Lendo '+filename:'Lendo um arquivo'];
  if(/spawn_agent|followup_task|\bAgent\b|\bTask\b/.test(name))return['Calling a helper','Chamando um ajudante'];
  if(/web|search|browse/i.test(name))return['Searching the web','Pesquisando na web'];
  if(/\bgit\b/.test(s))return['Checking code changes','Conferindo mudanças no código'];
  if(/npm\s+run\s+build|\bbuild\b/.test(s))return['Building the project','Preparando o projeto'];
  if(/Bash|PowerShell|exec|command|terminal|shell/i.test(name))return['Running a command','Rodando um comando'];
  return['Working on the task','Trabalhando na tarefa'];
}
function metadataStory(line,previous={}){
  let h;try{h=projectJSON(line,headers);}catch{return{};}
  const at=typeof h.timestamp==='string'&&Number.isFinite(Date.parse(h.timestamp))?new Date(h.timestamp).toISOString():null,out={};
  const id=h.type==='session_meta'&&!previous.birthAt?h['payload.id']:h.sessionId;if(id)out.sessionKey=key(id);if(h.type==='session_meta'&&at&&!previous.birthAt)out.birthAt=at;
  // Copied ancestry later in a fork must not replace the opening identity.
  const opening=h.type==='session_meta'&&!previous.birthAt;
  const parent=opening?(h['payload.parent_thread_id']||h['payload.source.subagent.thread_spawn.parent_thread_id']||h['payload.source.subagent.parent_thread_id']):h.type!=='session_meta'?h.parentSessionId:null;if(parent)out.parentKey=key(parent);if(parent||h.isSidechain)out.helper=true;if(h.agentId)out.helperKey=key(h.agentId);
  const kind=h['payload.type'],tool=h['payload.name'],assistantTool=h.type==='assistant'&&Object.values(h).includes('tool_use');
  const event=h.type==='user'||h.type==='assistant'||h.type==='event_msg'&&['user_message','task_started'].includes(kind)||h.type==='response_item'&&['function_call','function_call_output'].includes(kind);
  if(at&&event&&(!previous.activityAt||at>=previous.activityAt)){out.activityAt=at;out.closedAt=null;out.finishedAt=null;}
  if(tool&&at&&(!previous.activityAt||at>=previous.activityAt)){const action=actionOf(tool,'');out.action=action?.[0]||null;out.actionPT=action?.[1]||null;out.activityAt=at;out.closedAt=null;out.finishedAt=null;}
  const final=h.type==='event_msg'&&kind==='task_complete'||h.type==='response_item'&&kind==='message'&&h['payload.role']==='assistant'&&h['payload.phase']==='final_answer'||h.type==='assistant'&&(h['message.stop_reason']==='end_turn'||!assistantTool&&Object.values(h).includes('text'));
  if(final&&at&&(!previous.activityAt||at>=previous.activityAt)){out.closedAt=at;out.finishedAt=null;out.activityAt=at;}
  return out;
}
module.exports={metadataStory,actionOf,key};
