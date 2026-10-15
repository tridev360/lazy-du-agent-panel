'use strict';
const { titleConfigOf } = require('./identidades.cjs');
const plain=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function pendingSections(text){
 const lines=String(text||'').split(/\r?\n/),items=[];let active=false,current=null;
 const flush=()=>{if(current)items.push(current);current=null;};
 for(const line of lines){if(/^##\s/.test(line)){flush();active=/propostas ao \w+|cards? (?:para|ao) (?:o )?\w+|decisoes (?:para|do|ao)/.test(plain(line));continue;}if(!active)continue;
  const title=/^###\s+\d+[.)]\s+(.+)/.exec(line)?.[1]||/^\*\*Card:\s*(.+?)\*\*\s*$/i.exec(line)?.[1];
  if(title){flush();current={title,detail:[]};}else if(current)current.detail.push(line);
 }flush();return items;
}
function projectSources(root,data,projects){
 const fs=require('node:fs'),path=require('node:path');let raw;try{raw=JSON.parse(require('./leitor.cjs').readSafe(root,'estado/projetos.json',64000));}catch{return;}
 data.projectSignals=[];data.projectOpenQuestions=[];
 for(const entry of raw.projetos||[]){const project=projects.find(row=>row.name===entry.nome);if(!project||!Array.isArray(entry.fontes))continue;for(const source of entry.fontes.slice(0,12)){
  if(!/^(?:COLECAO-PRONTO|COLECAO-FEEDBACK-0800|ECONOMIA|BOSS)\.md$/.test(source.arquivo||''))continue;
  const folder=project.paths.find(dir=>/\/colecao-jogo$/.test(dir));if(!folder)continue;const file=path.join(folder,source.arquivo);let text,at;try{const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>128000||!fs.realpathSync(file).toLowerCase().startsWith(fs.realpathSync(folder).toLowerCase()+path.sep))continue;text=fs.readFileSync(file,'utf8');at=stat.mtime.toISOString();}catch{continue;}
  if(source.tipo==='cards')for(const [index,section]of pendingSections(text).entries()){const id=project.id+':'+source.arquivo+':'+index;if(data.projectOpenQuestions.some(item=>item.id===id))continue;const need={id,projectId:project.id,type:'review',title:section.title,shortTitle:source.arquivo==='BOSS.md'?'Escolher regras do boss':'Escolher regras da economia',detail:section.detail.join('\n').slice(0,16000),source:source.arquivo,createdAt:at};data.projectOpenQuestions.push(need);}
  else data.projectSignals.push({projectId:project.id,source:source.arquivo,updated:at,lines:text.split(/\r?\n/).filter(line=>/^COLECAO (?:PRONTO|PONTO|VERIFICADO)/.test(line)).slice(-6)});
 }
 }
 data.needsTotal=(data.needsAll||[]).length;data.needsCount=data.needsTotal;if(data.management?.waiting)data.management.waiting.count=data.needsCount;
}
function classify(item, projects, fallback) {
  const text=plain([item.title,item.label,item.sessao,item.actor,item.agent,item.source,item.origin,item.o_que,item.detail,item.details].filter(Boolean).join(' '));
  const id=String(item.id||'').replace(/^queue:/,'');
  const primary=plain([item.title,item.label,item.sessao,item.actor,item.agent,item.o_que].filter(Boolean).join(' '));
  const name=/^(?:26[a-z]*|27[a-z]*)$/.test(id)?'painel':/painel (?:aberto|publico)|public panel|agent panel/.test(primary)?'public-panel':/\bcolecao\b|\bjp\b/.test(primary)?'colecao':/\bpainel\b|codex.painel/.test(primary)?'painel':/\bpainel\b|\bterminal\b|\bterminal\b/.test(primary)?'app':/\bcolecao\b/.test(text)?'colecao':/\bpainel local\b|\bcodex painel\b/.test(text)?'painel':null;
  return projects.find(project=>name==='public-panel'?plain(project.name)==='painel aberto':name==='painel'?plain(project.name)==='painel':name==='app'?plain(project.name)==='painel':name==='colecao'?plain(project.name).startsWith('colecao'):false)?.id||fallback;
}
function scopeProjects(root,data,configuration,fallback){
  const projects=[...configuration];if(!projects.some(row=>plain(row.name)==='painel'))projects.push({id:'panel',name:'Painel',color:'#4c9dff',paths:[]});
  const approved=titleConfigOf(root,data.equipe);
  for(const agent of data.equipe.agents){const entry=approved.get(agent.conversationId?.replace(/^(?:codex|claude):/,''));const label=entry?.project;const project=projects.find(row=>label==='panel'?plain(row.name)==='painel':label==='colecao'?plain(row.name).startsWith('colecao'):label==='app'?plain(row.name)==='painel':false);
    const currentProject=projects.find(row=>row.id===agent.projectId);const matched=project||(currentProject&&plain(currentProject.name)!=='painel'?currentProject:projects.find(row=>row.id===classify({title:agent.conversationName},projects,agent.projectId)));if(matched){agent.projectId=matched.id;agent.project=matched.name;agent.projectColor=matched.color;}
  }
  for(const group of data.equipe.groups||[]){group.agents=group.agents.map(agent=>data.equipe.agents.find(current=>current.id===agent.id)||agent);const leader=group.agents.find(agent=>!agent.parentId)||group.agents[0];group.projectId=leader.projectId;group.id=leader.projectId+'|'+group.conversationId;}
  for(const key of ['tasks','pipelineItems','queueItems','cards','needsAll','needsItems','nextItems','readyBranches','stalledTasks','deadlines'])for(const item of data[key]||[])item.projectId=classify(item,projects,item.projectId||fallback);
  for(const list of [...Object.values(data.feeds||{}),data.launches?.items||[]])for(const item of list)item.projectId=classify(item,projects,item.projectId||fallback);
  data.equipe.projects=projects.map(project=>{const agents=data.equipe.agents.filter(agent=>agent.projectId===project.id);const known=agents.filter(agent=>Number.isFinite(agent.tokens));return {id:project.id,name:require('./sigilo-pessoas.cjs').temPessoa(project.name)?'Projeto reservado':project.name,color:project.color,agents:agents.length,active:data.equipe.countsExact===true?agents.filter(agent=>['working','walking'].includes(agent.state)).length:null,activeMinimum:agents.filter(agent=>['working','walking'].includes(agent.state)).length,tokens:known.length?known.reduce((sum,agent)=>sum+agent.tokens,0):null,tokensExact:known.length===agents.length&&known.every(agent=>agent.tokensExact!==false),lastAt:agents.map(agent=>agent.lastAt).filter(Boolean).sort().at(-1)||null};});
  data.needsAll=data.needsAll||[];data.needsItems=data.needsItems||[];projectSources(root,data,projects);return projects;
}
module.exports={classify,pendingSections,scopeProjects};
