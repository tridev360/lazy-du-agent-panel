'use strict';
function exampleFor(base,size){
  const sample=structuredClone(base);sample.example=true;sample.exampleSize=size==='solo'?'solo':'large';sample.usage.claude={...sample.usage.claude,windows:[]};
  if(size==='solo'){
    sample.usage.sessions=sample.usage.sessions.slice(0,2);const ids=new Set(sample.usage.sessions.map(x=>x.id));
    if(sample.usage.previewSessions)sample.usage.previewSessions=sample.usage.previewSessions.filter(x=>ids.has(x.id));
    for(const a of sample.usage.sessions){if(!ids.has(a.parentKey))delete a.parentKey;if(!ids.has(a.parentId))delete a.parentId;}
    if(sample.tasks)sample.tasks=sample.tasks.filter(x=>!x.helper).slice(0,3);sample.queue=(sample.queue||[]).slice(0,2);sample.cards=(sample.cards||[]).slice(0,1);
    sample.usage.codex={source:'example',windows:[{used:18,minutes:10080,reset:'2026-10-05T12:00:00Z'}]};sample.usage.claude={...sample.usage.claude,source:'example',windows:[]};
  }
  if(size!=='solo'){
    const base=sample.usage.sessions[0],make=(id,role,title,titlePT,titleES,parentKey,action,actionPT,actionES)=>({...structuredClone(base),id,sessionKey:id,parentKey,role,title,titlePT,titleES,taskTitle:title,taskTitlePT:titlePT,taskTitleES:titleES,action,actionPT,actionES,state:'working',tokens:12000,weightedTokens:9000});
    const lead=make('example-lead','lead','Project planning','Plano do projeto','Plan del proyecto',null,'Planning the next milestone','Planejando a próxima etapa','Planeando la siguiente etapa');
    const authors=sample.usage.sessions.slice(0,2).map(a=>({...a,sessionKey:a.id,parentKey:a.agent===lead.agent?lead.id:null,state:'working'}));
    sample.usage.sessions=[lead,...authors,
      make('example-qa','qa','Game checks','Testes do jogo','Pruebas del juego',authors[0].id,'Checking jump controls','Conferindo os controles','Comprobando los controles'),
      make('example-review','reviewer','Code review','Revisão do código','Revisión del código',authors[0].id,'Reviewing the game menu','Revisando o menu do jogo','Revisando el menú del juego'),
      {...make('example-guide','writer','Player guide','Guia do jogador','Guía del jugador',authors[1].id,'Writing the player guide','Escrevendo o guia do jogador','Escribiendo la guía del jugador'),agent:authors[1].agent,model:authors[1].model,effort:authors[1].effort,tools:[{name:'Read',count:5},{name:'Write',count:2}],observedSteps:7},
      make('example-motion','dev','Animation support','Apoio de animação','Apoyo de animación','example-qa','Checking menu motion','Conferindo a animação do menu','Comprobando la animación del menú')];
    const toolsFor={'example-lead':[{name:'exec_command',count:4},{name:'apply_patch',count:1}],'example-qa':[{name:'exec_command',count:9}],'example-review':[{name:'exec_command',count:6},{name:'apply_patch',count:1}],'example-motion':[{name:'exec_command',count:3},{name:'apply_patch',count:2}]};
    for(const s of sample.usage.sessions){if(toolsFor[s.id]){s.tools=toolsFor[s.id];s.observedSteps=s.tools.reduce((n,t)=>n+t.count,0);}s.completedSteps=Math.min(s.completedSteps||0,s.observedSteps);}
    sample.usage.counts={active:sample.usage.sessions.length,paused:0,finished:0};sample.usage.previewSessions=[];
  }
  const now=Date.now(),iso=min=>new Date(now-min*60000).toISOString();
  sample.usage.sessions.forEach((s,i)=>{if(!s.startedAt)s.startedAt=iso(95-i*9);if(!s.updated)s.updated=iso(s.state==='working'?1+i:30+i*5);});
  return sample;
}
module.exports={exampleFor};
