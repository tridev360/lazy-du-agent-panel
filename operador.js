(function(root){
 'use strict';
 const COPY={pt:{tree:'Árvore viva',summaries:'Resumos',description:'Quem coordena. Quem entrega.',direct:'Frentes da coordenação',unknownOwner:'Frentes sem coordenação confirmada',all:'Todos',manyDone:'entregues',manyWorking:'trabalhando',manyWaiting:'esperando',manySleeping:'em descanso',need:'Precisa de você',clear:'Sem pedido agora',details:'Ver resumo',fez:'FEZ',achou:'ACHOU',mudou:'MUDOU',precisa:'PRECISA DE VOCÊ',missing:'Sem resumo ainda',notRecorded:'Sem registro',read:'Atualizado',source:'Fonte',ready:'Entregas da equipe',more:'Ver mais frentes',children:'subagentes',new:'Trazer novos agentes',stable:'Ordem preservada',empty:'As sessões acompanham a próxima tarefa',last:'Última entrega',working:'Trabalhando',waiting:'Esperando',sleeping:'Em descanso',done:'Entregue'},en:{tree:'Live tree',summaries:'Summaries',description:'Who coordinates. Who delivers.',direct:'Coordination workstreams',unknownOwner:'Workstreams without a confirmed coordinator',all:'All',manyDone:'delivered',manyWorking:'working',manyWaiting:'waiting',manySleeping:'resting',need:'Needs you',clear:'No request now',details:'View summary',fez:'DID',achou:'FOUND',mudou:'CHANGED',precisa:'NEEDS YOU',missing:'No summary yet',notRecorded:'Not recorded',read:'Updated',source:'Source',ready:'Team deliveries',more:'More workstreams',children:'subagents',new:'Show new agents',stable:'Order preserved',empty:'Sessions are following the next task',last:'Last delivery',working:'Working',waiting:'Waiting',sleeping:'Resting',done:'Delivered'},es:{tree:'Árbol en vivo',summaries:'Resúmenes',description:'Quién coordina. Quién entrega.',direct:'Frentes de coordinación',unknownOwner:'Frentes sin coordinación confirmada',all:'Todos',manyDone:'entregados',manyWorking:'trabajando',manyWaiting:'esperando',manySleeping:'en descanso',need:'Te necesita',clear:'Sin pedido ahora',details:'Ver resumen',fez:'HIZO',achou:'ENCONTRÓ',mudou:'CAMBIÓ',precisa:'TE NECESITA',missing:'Sin resumen aún',notRecorded:'Sin registro',read:'Actualizado',source:'Fuente',ready:'Entregas del equipo',more:'Ver más frentes',children:'subagentes',new:'Mostrar agentes nuevos',stable:'Orden conservado',empty:'Las sesiones siguen la próxima tarea',last:'Última entrega',working:'Trabajando',waiting:'Esperando',sleeping:'En descanso',done:'Entregado'}};
 const instances=new WeakMap(),short=(text,size=40)=>String(text||'').length<=size?String(text||''):String(text).slice(0,size-1).trimEnd()+'…';
 const byKey=(previous,rows)=>{const map=new Map(rows.map(row=>[row.id,row]));return [...previous.filter(id=>map.has(id)),...rows.filter(row=>!previous.includes(row.id)).map(row=>row.id)].map(id=>map.get(id));};
 function hierarchy(data){
  const operator=data.operator||{},sessions=operator.sessions||[],agents=data.equipe?.agents||[],actualSessions=new Set(operator.sessionAgentIds||[]),byId=new Map(agents.map(agent=>[agent.id,agent]));
  const roots=agents.filter(agent=>!actualSessions.has(agent.id)&&(!agent.parentId||!byId.has(agent.parentId)));
  const children=parent=>agents.filter(agent=>agent.parentId===parent);
  const branches=sessions.filter(session=>session.id!=='COORDENADOR').map(session=>({session,agents:roots.filter(agent=>agent.ownerSession===session.id)}));
  return {leader:sessions.find(session=>session.id==='COORDENADOR')||null,branches: data.selectedProject?branches.filter(branch=>branch.agents.length||data.selectedProject==='app'):branches,direct:roots.filter(agent=>agent.ownerSession==='COORDENADOR'),unlinked:roots.filter(agent=>!agent.ownerSession),children};
 }
 function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=root.PainelLinguagem?.text(text,document.documentElement.lang)||text;return node;}
 function time(value,lang){return Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat(lang,{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'America/Sao_Paulo'}).format(new Date(value)):null;}
 function sessionAction(session,lang='pt'){if(session.node?.currentDelivery)return session.node.currentDelivery.labels?.[lang]||session.node.currentDelivery.labels?.pt||'';const fields=session.summary?.fields||{},value=session.needsOperator?fields.precisa:(fields.fez||fields.proximo);if(session.needsOperator&&root.PainelVisao)return root.PainelVisao.humanLabel({title:root.PainelLinguagem?.text(value,lang)||value,detail:value},lang);if(/full report.*saiu|relatório.*saiu/i.test(value||''))return {pt:'Publicou o relatório do acervo',en:'Published the collection report',es:'Publicó el informe del tesoro'}[lang];if(/evento pronto/i.test(value||''))return {pt:'Preparou o evento para revisão',en:'Prepared the event for review',es:'Preparó el evento para revisión'}[lang];return root.PainelLinguagem?.text(value,lang)||value||'';}
 function create(host){
  const c={host,mode:'tree',options:{},order:[],known:new Set(),nodes:new Map(),sessionNodes:new Map(),summaryNodes:new Map(),branchNodes:new Map(),dirty:false};
  const header=el('div','op-toolbar'),modes=el('div','op-modes'),tree=el('button',null),summaries=el('button',null),refresh=el('button','op-refresh');tree.type=summaries.type=refresh.type='button';tree.addEventListener('click',()=>{c.mode='tree';paint(c);});summaries.addEventListener('click',()=>{c.mode='summaries';paint(c);});refresh.addEventListener('click',()=>{c.known=new Set(c.data.equipe?.agents?.map(agent=>agent.id)||[]);c.dirty=false;paint(c);});modes.append(tree,summaries);header.append(modes,refresh);
  const description=el('p','op-description'),view=el('div','op-tree'),chief=el('div','op-chief'),branches=el('div','op-branches'),direct=el('section','op-direct'),directTitle=el('h2'),directRows=el('div','op-direct-grid');direct.append(directTitle,directRows);const unlinked=el('section','op-direct'),unlinkedTitle=el('h2'),unlinkedRows=el('div','op-direct-grid');unlinked.append(unlinkedTitle,unlinkedRows);view.append(chief,branches,direct,unlinked);
  const summariesView=el('div','op-summaries'),sessionsGrid=el('div','op-summary-grid'),readyTitle=el('h2'),readyGrid=el('div','op-summary-grid');summariesView.append(sessionsGrid,readyTitle,readyGrid);host.append(header,description,view,summariesView);Object.assign(c,{header,tree,summaries,refresh,description,view,chief,branches,direct,directTitle,directRows,unlinked,unlinkedTitle,unlinkedRows,summariesView,sessionsGrid,readyTitle,readyGrid});instances.set(host,c);return c;
 }
 function updateText(node,value){const human=root.PainelLinguagem?.text(value,document.documentElement.lang)??String(value||'');if(node.textContent!==human)node.textContent=human;}
 function row(c,id){
  if(c.nodes.has(id))return c.nodes.get(id);
  const button=el('button','op-agent'),image=el('img','op-avatar'),copy=el('span','op-agent-copy'),badge=el('small','op-badge'),name=el('strong'),action=el('span','op-action'),meta=el('span','op-meta'),status=el('span','op-state'),eta=el('span','op-eta');button.type='button';button.dataset.agent=id;image.width=56;image.height=56;image.alt='';copy.append(badge,name,action,meta,status,eta);button.append(image,copy);button.addEventListener('click',()=>{if(button._session)openSummary(c,button._session);else if(button._agent)root.PainelEquipe?.openAgent?.(button._agent,document.getElementById('pipeline'));});
  const node={button,image,badge,name,action,meta,status,eta};c.nodes.set(id,node);return node;
 }
 // the Home row of each agent (role or last real step, forecast or real delivery), the Home name function
 // over the whole screen, identical helpers of one coordinator joined in one card, and a distinct real Agente.
 const CLASS=state=>state==='done'?'done':['working','walking','waiting'].includes(state)?'active':'rest';
 const HELPER={pt:'AGENTE AJUDANTE',en:'AGENTE HELPER',es:'AGENTE AYUDANTE'};
 function latest(members,read){let best=null,at=-Infinity;for(const member of members){const value=Date.parse(read(member.row));if(Number.isFinite(value)&&value>at){best=member;at=value;}}return best||members[0];}
 function singleStatus(c,entry){
  const {w,lang}=c,session=entry.session,state=session?entry.agent.state:entry.row.state;
  if(session?.needsOperator)return ['● '+w.need,'waiting'];if(session&&state==='registered')return [({pt:'Resumo registrado',en:'Summary recorded',es:'Resumen registrado'}[lang]),'registered'];
  return state==='done'?['✓ '+w.done,'done']:state==='waiting'?['◷ '+w.waiting,'waiting']:['sleeping','unknown','registered'].includes(state)?['◌ '+w.sleeping,'sleeping']:['● '+w.working,state||'working'];
 }
 function groupStatus(c,members,parent){
  const {w}=c,kind=CLASS(members[0].row.state),amount=parent&&members.length===parent.kids.length?w.all:String(members.length);
  const [icon,word,state]=kind==='done'?['✓',w.manyDone,'done']:kind==='active'?members.every(member=>member.row.state==='waiting')?['◷',w.manyWaiting,'waiting']:['●',w.manyWorking,'working']:['◌',w.manySleeping,'sleeping'];
  return [icon+' '+amount+' '+word,state];
 }
 function treePlan(c,data,model){
  const team=root.PainelEquipe,{lang}=c,now=Date.now(),fronts=team.teamFronts(data),entries=new Map(),known=agent=>c.known.has(agent.id);
  const visit=(agent,session,parent,depth)=>{
   if(!agent?.id||entries.has(agent.id))return;
   const base=fronts.get(agent.id)||{...agent},row={...base,state:team.stateOf(base,now)},role=team.nameRole(row,lang);
   // A helper with its coordinator's own role is that coordinator's helper, so the two names never match.
   if(parent&&role===parent.role)row.identity={...row.identity,labels:HELPER};
   const entry={id:agent.id,agent,session,row,role,parentId:parent?.id||null,kids:[]};entries.set(agent.id,entry);if(session)return;
   const kids=model.children(agent.id).filter(known);entry.kids=kids.map(kid=>kid.id);if(depth<5)for(const kid of kids)visit(kid,null,entry,depth+1);
  };
  if(model.leader?.node)visit(model.leader.node,model.leader,null,0);
  for(const branch of model.branches){if(branch.session.node)visit(branch.session.node,branch.session,null,0);for(const agent of branch.agents.filter(known))visit(agent,null,null,0);}
  for(const agent of [...model.direct,...model.unlinked].filter(known))visit(agent,null,null,0);
  const list=[...entries.values()],first=team.homeNames(list.map(entry=>entry.row),data,lang);for(const entry of list)entry.name=first.get(entry.id);
  // Helpers of one coordinator with the same name and the same state become one card; it says how many.
  const shown=new Map();
  for(const entry of list){
   if(!entry.kids.length)continue;const groups=new Map();
   for(const kid of byKey(c.childOrders?.get(entry.id)||[],entry.kids.map(id=>entries.get(id)).filter(Boolean))){const key=kid.kids.length?'own:'+kid.id:kid.name+'|'+CLASS(kid.row.state);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(kid);}
   for(const members of groups.values()){members[0].members=members;for(const member of members.slice(1))member.mergedInto=members[0].id;}
   shown.set(entry.id,[...groups.values()].map(members=>members[0].id));
  }
  const cardList=list.filter(entry=>!entry.mergedInto).map(entry=>({id:entry.id,name:entry.name,row:entry.row,size:(entry.members||[entry]).length,entry}));
  const names=team.distinctNames(cardList,lang);c.portraits??=new Map();
  const portraits=team.distinctPortraits(cardList.map(card=>({id:card.id,candidates:(card.entry.members||[card.entry]).map(member=>member.agent.agente)})),team.portraitPool(data),c.portraits);
  const cards=new Map();
  for(const card of cardList){
   const entry=card.entry,members=entry.members||[entry],name=names.get(card.id)||card.name,parent=entry.parentId?entries.get(entry.parentId):null,kind=CLASS(entry.row.state);
   const active=Boolean(entry.session)||kind==='active'||model.children(entry.id).some(kid=>CLASS(team.stateOf(kid,now))==='active');
   const lead=members.length<2?entry:kind==='done'?latest(members,row=>row.delivery?.completedAt):kind==='active'?latest(members,row=>row.delivery?.etaAt):latest(members,row=>row.lastAt);
   const [status,statusState]=members.length<2?singleStatus(c,entry):groupStatus(c,members,parent);
   cards.set(card.id,{name,action:team.taskLabel(entry.row,lang),status,statusState,time:team.cardTime(lead.row,lang,active),portrait:portraits.get(card.id)||null,row:{...lead.row,cardName:name},size:members.length});
  }
  return {cards,shown,collisions:names.collisions,missingPortraits:portraits.missing};
 }
 // Only for a row drawn outside the plan: the same rules for that card alone.
 function loneCard(c,agent,session){
  const team=root.PainelEquipe,row={...agent,state:team.stateOf(agent)},entry={agent,session,row};delete row.currentDelivery;
  const name=team.homeNames([row],c.data,c.lang).get(agent.id)||team.displayName(agent,c.lang),[status,statusState]=singleStatus(c,entry);
  return {name,action:team.taskLabel(row,c.lang),status,statusState,time:team.cardTime(row,c.lang,Boolean(session)||CLASS(row.state)==='active'),portrait:agent.agente?.verified===true&&team.imageOf(agent)!=='/agente.png'?{id:agent.agente.id??null,image:team.imageOf(agent)}:null,row:{...row,cardName:name},size:1};
 }
 function agentRow(c,agent,session=null){
  const {w}=c,node=row(c,agent.id),card=c.plan?.cards.get(agent.id)||loneCard(c,agent,session);
  node.button._agent=card.row;node.button._session=session;updateText(node.name,card.name);updateText(node.action,card.action||w.missing);node.action.lang=c.lang;
  // The tree already shows who coordinates whom, so no card repeats a label of its group.
  node.badge.hidden=true;updateText(node.badge,'');node.meta.hidden=true;
  const portrait=card.portrait;node.image.style.visibility=portrait?'':'hidden';if(!portrait)node.image.removeAttribute('src');else if(node.image.getAttribute('src')!==portrait.image)node.image.src=portrait.image;node.image.alt=portrait?.id?'Agente #'+portrait.id:'Agente';node.image.title=portrait?.id?'Agente #'+portrait.id:'';
  updateText(node.status,card.status);node.status.dataset.state=card.statusState;
  node.eta.hidden=!card.time.text;updateText(node.eta,card.time.text);node.eta.title=card.time.tip||'';node.eta.dataset.tone=card.time.tone||'';
  node.button.title=[card.name,card.action,card.status,card.time.text,card.time.tip].filter(Boolean).join(' · ');node.button.setAttribute('aria-label',node.button.title);return node.button;
 }
 function summaryName(c,session){const tree=/^summary:/.test(session.id||'')&&session.agentId?c.plan?.cards.get(session.agentId)?.name:null;return tree||root.PainelLinguagem?.conversation(session.name,c.lang)||root.PainelLinguagem?.title(session.name,c.lang)||session.name;}
 function openSummary(c,session){
  const {w,lang}=c,summary=session.summary?.fields||{},blocks=[];
  for(const key of ['fez','achou','mudou','precisa'])if(summary[key])blocks.push(c.options.detailBlock(w[key],summary[key]));if(summary.proximo)blocks.push(c.options.detailBlock({pt:'PRÓXIMO PASSO',en:'NEXT STEP',es:'PRÓXIMO PASO'}[lang],summary.proximo));
  blocks.push(c.options.detailBlock(w.source,(root.PainelLinguagem?.sourceLabel(session.source,lang)||w.source)+' · '+(root.PainelLinguagem?.relative(session.updatedAt,lang)||w.notRecorded)));
  c.options.drawer(summaryName(c,session),blocks);
 }
 function summaryCard(c,session){
  let node=c.summaryNodes.get(session.id);if(!node){const card=el('article','op-summary-card'),head=el('div','op-summary-head'),name=el('h3'),need=el('span','op-summary-need'),body=el('dl'),lines={};for(const key of ['fez','achou','mudou','precisa']){const title=el('dt'),value=el('dd');value.lang='pt';body.append(title,value);lines[key]={title,value};}const footer=el('div','op-summary-footer'),updated=el('time'),button=el('button',null);button.type='button';button.addEventListener('click',()=>openSummary(c,node.session));head.append(name,need);footer.append(updated,button);card.append(head,body,footer);node={card,name,need,lines,updated,button};c.summaryNodes.set(session.id,node);}
  node.session=session;updateText(node.name,summaryName(c,session));updateText(node.need,session.needsOperator?'● '+c.w.need:c.w.clear);node.need.dataset.needs=String(Boolean(session.needsOperator));for(const key of ['fez','achou','mudou','precisa']){const fields=session.summary?.fields||{},value=fields[key]||(key==='fez'?fields.proximo:null);node.lines[key].title.hidden=node.lines[key].value.hidden=!value;updateText(node.lines[key].title,key==='fez'&&!fields.fez&&fields.proximo?({pt:'PRÓXIMO PASSO',en:'NEXT STEP',es:'PRÓXIMO PASO'}[c.lang]):c.w[key]);if(/Verificações descritas nos detalhes/.test(summaryLine(value))){node.lines[key].title.hidden=node.lines[key].value.hidden=true;continue;}const visibleValue=key==='precisa'&&value&&session.needsOperator?root.PainelVisao?.humanLabel({title:value,detail:value},c.lang)||summaryLine(value):summaryLine(value);updateText(node.lines[key].value,visibleValue);}updateText(node.updated,c.w.read+' '+(root.PainelLinguagem?.relative(session.updatedAt,c.lang)||c.w.notRecorded));node.updated.dateTime=session.updatedAt||'';node.updated.title=c.w.source+': '+session.source;updateText(node.button,c.w.details+' ↗');return node.card;
 }
 function place(parent,node,index){if(parent.children[index]!==node)parent.insertBefore(node,parent.children[index]||null);}
 function agentBranch(c,agent,model,depth=0){
  let branch=c.branchNodes.get(agent.id);if(!branch){const box=el('div','op-agent-branch'),children=el('details','op-children'),summary=el('summary'),list=el('div','op-child-list');children.append(summary,list);box.append(children);branch={box,children,summary,list};c.branchNodes.set(agent.id,branch);}
  place(branch.box,agentRow(c,agent),0);const all=model.children(agent.id).filter(item=>c.known.has(item.id)),shown=c.plan?.shown.get(agent.id),kids=byKey(c.childOrders?.get(agent.id)||[],shown?all.filter(item=>shown.includes(item.id)):all);c.childOrders??=new Map();c.childOrders.set(agent.id,kids.map(item=>item.id));branch.children.hidden=!all.length;updateText(branch.summary,all.length+' '+c.w.children);if(depth<5)for(const [index,child]of kids.entries())place(branch.list,agentBranch(c,child,model,depth+1),index);for(const child of [...branch.list.children])if(!kids.some(kid=>child.querySelector('[data-agent]')?.dataset.agent===kid.id))child.remove();return branch.box;
 }
 function paint(c){
  const {data}=c;if(c.project!==data.selectedProject){c.project=data.selectedProject;c.initialized=false;c.directOrder=[];c.sessionsGrid.replaceChildren();c.readyGrid.replaceChildren();}c.lang=COPY[c.options.lang]?c.options.lang:'pt';c.w=COPY[c.lang];const {w}=c,model=hierarchy(data),current=data.equipe?.agents||[];
  if(!c.initialized){c.known=new Set(current.map(agent=>agent.id));c.initialized=true;}c.plan=root.PainelEquipe?.teamFronts?treePlan(c,data,model):null;const additions=current.filter(agent=>!c.known.has(agent.id));c.dirty=additions.length>0;updateText(c.refresh,c.dirty?w.new+' ('+additions.length+')':w.stable);c.refresh.disabled=!c.dirty;updateText(c.tree,w.tree);updateText(c.summaries,w.summaries);c.tree.setAttribute('aria-pressed',String(c.mode==='tree'));c.summaries.setAttribute('aria-pressed',String(c.mode==='summaries'));c.view.hidden=c.mode!=='tree';c.summariesView.hidden=c.mode!=='summaries';updateText(c.description,w.description);
  if(model.leader){const chief=agentRow(c,model.leader.node,model.leader);chief.classList.add('op-leader');place(c.chief,chief,0);}else updateText(c.chief,w.empty);
  const visible=model.branches.map(branch=>branch.session.id);for(const child of [...c.branches.children])if(!visible.includes(child.dataset.session))child.remove();
  for(const [index,branch]of model.branches.entries()){
   let box=c.sessionNodes.get(branch.session.id);if(!box){const section=el('section','op-session'),rows=el('div','op-session-agents');section.dataset.session=branch.session.id;section.append(rows);box={section,rows,order:[]};c.sessionNodes.set(branch.session.id,box);}place(box.section,agentRow(c,branch.session.node,branch.session),0);place(c.branches,box.section,index);
   const agents=byKey(box.order,branch.agents).filter(agent=>c.known.has(agent.id));box.order=agents.map(agent=>agent.id);for(const [at,agent]of agents.entries())place(box.rows,agentBranch(c,agent,model),at);
   for(const child of [...box.rows.children])if(!agents.some(agent=>child.querySelector('[data-agent]')?.dataset.agent===agent.id))child.remove();
  }
  updateText(c.directTitle,w.direct);const direct=byKey(c.directOrder||[],model.direct).filter(agent=>c.known.has(agent.id));c.directOrder=direct.map(agent=>agent.id);c.direct.hidden=!direct.length;for(const [index,agent]of direct.entries())place(c.directRows,agentBranch(c,agent,model),index);for(const child of [...c.directRows.children])if(!direct.some(agent=>child.querySelector('[data-agent]')?.dataset.agent===agent.id))child.remove();
  updateText(c.unlinkedTitle,w.unknownOwner);const unlinked=byKey(c.unlinkedOrder||[],model.unlinked).filter(agent=>c.known.has(agent.id));c.unlinkedOrder=unlinked.map(agent=>agent.id);c.unlinked.hidden=!unlinked.length;for(const [index,agent]of unlinked.entries())place(c.unlinkedRows,agentBranch(c,agent,model),index);for(const child of [...c.unlinkedRows.children])if(!unlinked.some(agent=>child.querySelector('[data-agent]')?.dataset.agent===agent.id))child.remove();
  // First paint prioritizes requests; live updates never reorder existing cards.
  const sorted=(data.operator?.sessions||[]).slice().sort((a,b)=>Number(b.needsOperator)-Number(a.needsOperator));const sessions=byKey(c.summaryOrder||[],sorted);c.summaryOrder=sessions.map(session=>session.id);for(const [index,session]of sessions.entries())place(c.sessionsGrid,summaryCard(c,session),index);
  updateText(c.readyTitle,w.ready);const ready=data.operator?.codex||[];if(!c.summaryEmpty){c.summaryEmpty=el('p','op-empty');c.summariesView.append(c.summaryEmpty);}c.summaryEmpty.hidden=Boolean(sessions.length||ready.length);updateText(c.summaryEmpty,({pt:'Este projeto não tem resumos registrados.',en:'This project has no recorded summaries.',es:'Este proyecto no tiene resúmenes registrados.'}[c.lang]));c.readyTitle.hidden=!ready.length;const available=ready.filter(session=>session.summary?.available),missing=ready.filter(session=>!session.summary?.available);
  for(const [index,session]of available.entries())place(c.readyGrid,summaryCard(c,session),index);
  if(!c.missingGroup){c.missingGroup=el('details','op-missing-group');c.missingTitle=el('summary');c.missingGrid=el('div','op-summary-grid');c.missingGroup.append(c.missingTitle,c.missingGrid);}c.missingGroup.hidden=!missing.length;updateText(c.missingTitle,missing.length+' '+({pt:'frentes aguardando resumo',en:'workstreams awaiting a summary',es:'frentes esperando resumen'}[c.lang]));
  for(const [index,session]of missing.entries())place(c.missingGrid,summaryCard(c,session),index);place(c.readyGrid,c.missingGroup,available.length);
  for(const [key,holder]of [['direct',c.directRows],['unlinked',c.unlinkedRows]]){
   const roots=key==='direct'?direct:unlinked,active=a=>['working','walking','waiting'].includes(a.state)||model.children(a.id).some(active),resting=roots.filter(a=>!active(a));
   c.resting??={};let group=c.resting[key];if(!group){const box=el('details','op-resting'),label=el('summary'),list=el('div','op-direct-grid');box.append(label,list);group=c.resting[key]={box,label,list};}
   updateText(group.label,({pt:'Pausadas e entregues',en:'Paused and delivered',es:'Pausadas y entregadas'}[c.lang])+' ('+resting.length+')');group.box.hidden=!resting.length;
   for(const [i,a]of resting.entries())place(group.list,agentBranch(c,a,model),i);holder.append(group.box);
  }
  if(root.PainelBuild){let badge=document.getElementById('build-badge');if(!badge){badge=el('span','op-build');badge.id='build-badge';document.querySelector('footer')?.append(badge);}updateText(badge,root.PainelBuild.version+' · '+root.PainelBuild.hash+' · '+time(root.PainelBuild.at,c.lang));badge.title=root.PainelBuild.at;}
 }
 function render(data,options={}){const host=document.getElementById('operator-live');if(!host)return;const c=instances.get(host)||create(host);c.data=data;c.options=options;paint(c);}
 function summaryLine(value){value=root.PainelLinguagem?.teamText(value)||value;if(/esforço|esforco|testes?\b|Tier S|arvore|árvore|branch|sha|hash/i.test(String(value||'')))return 'Verificações descritas nos detalhes';const source=String(value||'').replace(/\bcommit\b/gi,'alteração salva').replace(/\bmerge\b/gi,'integração');const first=source.split(/;|\n/)[0].trim(),words=first.split(/\s+/);return words.length>22?words.slice(0,22).join(' ')+'…':first;}
 const api={hierarchy,byKey,sessionAction,short,summaryLine,render};if(typeof module==='object'&&module.exports)module.exports=api;else root.PainelOperador=api;
})(typeof window==='object'?window:globalThis);
