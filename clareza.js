'use strict';
(function(root){
 const human=typeof module==='object'&&module.exports?require('./linguagem.js'):root.PainelLinguagem;
 const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),words=(pt,en,es)=>({pt,en,es});
 const blocked=v=>/PRIVADO|_SECRETS|backup-privado|\b(?:seed|secret|senha|api.?key)\b|0x[a-f\d]{40}|https?:\/\//i.test(v||'');
 const missing=words('Entrega ainda não descrita no registro','Deliverable not yet described in the record','Entrega aún no descrita en el registro');
 function goalOf(value){
  if(blocked(value))return null;const text=norm(value).slice(0,600);
  const rules=[
   [/entregas,?\s*decisoes e nomes|r10.*(?:corrige|painel|nomes|clareza)/,words('Painel: entregas, decisões e nomes','Panel: deliverables, decisions and names','Panel: entregas, decisiones y nombres')],
   [/painel publico.*(?:guia|primeira visita|primeira vez)/,words('Guia de primeira visita ao painel público','Public panel first visit guide','Guía de primera visita al panel público')],
   [/painel publico.*(?:revis|teste)|revis.*painel publico/,words('Revisão final do painel público','Final public panel review','Revisión final del panel público')],
   [/(?:travas|protecao).*pront.*(?:revisor|pendente)/,words('Proteção automática para revisão','Automatic protection ready for review','Protección automática para revisión')],
   [/(?:travas|protecao).*(?:test|revis)|r8 testes\s*\d+/,words('Proteção automática testada','Tested automatic protection','Protección automática probada')],
   [/(?:tracker|indice de raridade).*(?:revis|teste|confer)|(?:revis|teste|confer).*(?:tracker|indice de raridade)/,words('Revisão do índice de raridade','Rarity index review','Revisión del índice de rareza')],
   [/conserto visual.*agente-1|agente-1.*(?:luz|sobrepu|visual)/,words('Conserto visual do painel dos robôs','Assistente panel visual fix','Corrección visual del panel de robots')],
   [/evento.*(?:contar 2 vezes|contagem duplicada)|mesmo post.*2 vezes/,words('Evento sem contagem duplicada','Event without duplicate counting','Evento sin conteo duplicado')],
   [/terminal.*(?:assistente[oõ]es|estados).*confer|confer.*terminal.*(?:assistente[oõ]es|estados)/,words('Botões e estados do Terminal conferidos','Verified Terminal buttons and states','Botones y estados del Terminal verificados')]
  ];return rules.find(([rule])=>rule.test(text))?.[1]||null;
 }
 function actorMatches(agent,line){
  const name=norm(line.agent).replace(/[^a-z0-9]+/g,' ').trim(),actor=norm(agent.deliveryActor).replace(/[^a-z0-9]+/g,' ').trim();
  if(actor&&name===actor)return true;
  if(actor==='codex painel')return /^(?:agente dev (?:do )?painel local|codex painel)$/.test(name);
  if(/codex painel publico/.test(actor))return /agente dev (?:do )?painel publico/.test(name);
  if(agent.identity?.focusKey==='security'&&/travas|protecao/.test(norm(agent.conversationName)))return /agente dev das travas/.test(name);
  return false;
 }
 function clockFrom(value,at){
  const text=norm(value);if(/amanha|quinta|\bqui\b|sexta|\bsex\b|20:\dx/.test(text))return null;
  const clock=/(?:\beta\s*~?\s*|(?:entrega|card|sobe|subida)[^;\n]{0,65}?~?\s*)([0-2]\d:[0-5]\d)/i.exec(value||'')?.[1];
  const stamp=Date.parse(at);if(!clock||!Number.isFinite(stamp))return null;
  return new Date(stamp-3*3600000).toISOString().slice(0,10)+'T'+clock+':00-03:00';
 }
 function explicitTask(agent,data){
  const id=agent.taskId||agent.currentItemId,work=(data.tasks||[]).find(t=>id&&t.id===id);const value=work?.summary||work?.resumo||work?.title||agent.currentItemTitle;
  if(!value||blocked(value)||/^(?:(?:tarefa atual|frente de trabalho|novo item|novo pedido|painel)$|trabalha nesta\b|coordena\b|organiza\b|acompanha\b)/i.test(value.trim()))return null;
  const labels=goalOf(value)||words(human.title(value,'pt'),human.title(value,'en'),human.title(value,'es'));
  return {labels,source:work?'task:'+work.id:'task-metadata',sourceAt:agent.currentItemAt||agent.lastAt,etaAt:null,estimated:null};
 }
 function deliveryOf(agent,data,parent){
  const direct=explicitTask(agent,data);if(direct)return direct;
  const at=Date.parse(data.updated),lines=Object.values(data.feeds||{}).flat().filter(line=>actorMatches(agent,line)&&Date.parse(line.at)<=at&&at-Date.parse(line.at)<30*60000).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
  // A newer unrecognized work must not resurrect an older deliverable.
  if(lines.length){const line=lines[0],labels=goalOf(line.agent+': '+line.text);if(labels)return {labels,source:'public-feed',sourceAt:line.at,etaAt:clockFrom(line.text,line.at),estimated:/estimad|ETA\s*~/i.test(line.text)};}
  if(parent?.currentDelivery?.known)return {...parent.currentDelivery,source:'parent-delivery',parentId:parent.id};
  return {labels:missing,source:'missing-deliverable',known:false,sourceAt:null,etaAt:null,estimated:null};
 }
 function sessionDelivery(session,data){
  const fields=session.summary?.fields||{},value=fields.proximo||fields.precisa,visual=/AGENTE-1/i.test(value||'')||session.id==='ATENDIMENTO'&&/card do up curto/i.test(value||'')&&/conserto visual do AGENTE-1/i.test(fields.fez||''),linked=visual?(data.needsAll||[]).find(item=>item.source==='tasks/ESCOLHAS.md'&&/conserto visual do AGENTE-1/i.test(item.detail||'')):null,labels=goalOf(value)||goalOf(linked?.detail);
  if(labels)return {labels,source:'operator-summary',sourceAt:session.updatedAt,etaAt:clockFrom(value,data.updated),estimated:/~|por volta/.test(value)};
  // A completed summary is history, not evidence of another current delivery.
  return {labels:missing,source:'missing-deliverable',known:false,etaAt:null,estimated:null};
 }
 function decorate(agent,proof){
  const known=proof.known!==false,delivery=known?{...agent.delivery,deliverableLabels:proof.labels,deliverableSource:proof.source,...(proof.etaAt?{etaAt:proof.etaAt,estimated:proof.estimated===true,etaSource:proof.source==='public-feed'?'feed':proof.source,etaUpdatedAt:proof.sourceAt,estimateBasis:null,previousEtaAt:null,completedAt:null}:{})}:{...agent.delivery,etaAt:null,deadlineAt:null,completedAt:null};
  if(known&&delivery.completedAt&&Date.parse(delivery.completedAt)<Date.parse(proof.sourceAt))delivery.completedAt=null;
  return {...agent,currentDelivery:{...proof,known},delivery};
 }
 function enrich(data){
  if(!data?.equipe)return data;const byId=new Map(),pending=[...(data.equipe.agents||[])];
  for(let depth=0;pending.length&&depth<8;depth++)for(let i=pending.length-1;i>=0;i--){const agent=pending[i];if(agent.parentId&&pending.some(a=>a.id===agent.parentId))continue;const proof=deliveryOf(agent,data,byId.get(agent.parentId));byId.set(agent.id,decorate(agent,proof));pending.splice(i,1);}
  for(const agent of pending)byId.set(agent.id,decorate(agent,{labels:missing,source:'missing-deliverable',known:false}));
  const agents=(data.equipe.agents||[]).map(a=>byId.get(a.id)),sessions=(data.operator?.sessions||[]).map(s=>({...s,node:s.node?decorate(s.node,sessionDelivery(s,data)):s.node}));
  const groups=(data.equipe.groups||[]).map(g=>({...g,agents:(g.agents||[]).map(a=>byId.get(a.id)||a)}));
  return {...data,homeSource:data.homeSource||data,equipe:{...data.equipe,agents,groups},operator:data.operator?{...data.operator,sessions}:data.operator};
 }
 function approvalScope(item,lang='pt'){
  if(item.source!=='tasks/ESCOLHAS.md'||item.section!=='scheduled'||!/^needs:\d+$/.test(item.id||''))return null;
  const source=String(item.detail||''),match=/card do lote[^(\n]*\(([^)]*)\)/i.exec(source);if(!match||blocked(match[1]))return null;
  const aliases=[];
  const parts=match[1].split(/\s*,\s*/).map(value=>({label:aliases.find(([regex])=>regex.test(value))?.[1]?.[lang]||human.teamText(value,lang)}));
  const planned=/~([0-2]\d:[0-5]\d)/.exec(source)?.[1]||null,excluded=/Termos ficam para\s+([^\n.]+)/i.exec(source)?.[1]||null;
  const defer=words('Adia as partes acima e deixa a publicação de hoje'+(planned?', prevista para ~'+planned:'')+'. Solicita publicação amanhã; novo horário ainda não combinado.','Defers the parts above and skips today’s publication'+(planned?', planned for ~'+planned:'')+'. Requests publication tomorrow; a new time has not been agreed.','Aplaza las partes anteriores y deja la publicación de hoy'+(planned?', prevista para ~'+planned:'')+'. Solicita publicar mañana; no se ha acordado una nueva hora.');
  return {parts,planned,excluded,source:'tasks/ESCOLHAS.md',defer:defer[lang]||defer.pt};
 }
 const api={goalOf,actorMatches,clockFrom,deliveryOf,sessionDelivery,enrich,approvalScope};if(typeof module==='object'&&module.exports)module.exports=api;else root.PainelClareza=api;
})(typeof window==='object'?window:globalThis);
