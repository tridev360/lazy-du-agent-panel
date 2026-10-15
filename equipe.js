(function(scope){
  'use strict';
  const SLEEP_AFTER=10*60*1000;
  const homeForecast=typeof module==='object'&&module.exports?require('./previsao.cjs'):scope.PainelPrevisao,homeForecastCache=new Map();
  const COPY={
    en:{team:'Team live',agents:'agents',active:'working',tokens:'tokens in these conversations',consumption:'Consumption',water:'estimated water',cups:'cups of 250 ml',formula:'Playful estimate, not a measurement: (new input + output + 10% of cached input) ÷ 1,500 × 0.3 ml. Each cup is 250 ml.',working:'Working',walking:'Moving to work',waiting:'Waiting',sleeping:'Resting',done:'Done',unknown:'Unread',project:'Project',conversation:'Conversation',none:'No agent linked to this project',more:'more',model:'Model',effort:'Reasoning',skills:'Skills',tools:'Tools',since:'Since',now:'Now',details:'Agent details',progress:'Recorded progress',estimate:'Estimated delivery',deliveries:'deliveries',unmeasured:'Reading pending',noSkills:'No skill recorded',noTools:'No tool recorded',idle:'idle',minutes:'min',summary:'Progress',guardian:'Commands reviewed',week:'Codex week used'},
    pt:{team:'Equipe ao vivo',agents:'agentes',active:'trabalhando',tokens:'tokens nestas conversas',consumption:'Consumo',water:'água estimada',cups:'copos de 250 ml',formula:'Estimativa de brincadeira, sem medição: (entrada nova + saída + 10% da entrada em cache) ÷ 1.500 × 0,3 ml. Cada copo vale 250 ml.',working:'Trabalhando',walking:'Indo trabalhar',waiting:'Esperando',sleeping:'Descansando',done:'Terminou',unknown:'Não lido',project:'Projeto',conversation:'Conversa',none:'Nenhum agente ligado a este projeto',more:'mais',model:'Modelo',effort:'Esforço',skills:'Skills',tools:'Ferramentas',since:'Desde',now:'Agora',details:'Detalhes do agente',progress:'Progresso registrado',estimate:'Estimativa pelo ritmo',deliveries:'entregas',unmeasured:'Leitura pendente',noSkills:'Nenhuma skill registrada',noTools:'Nenhuma ferramenta registrada',idle:'parado',minutes:'min',summary:'Progresso',guardian:'Comandos conferidos',week:'Semana do Codex usada'},
    es:{team:'Equipo en vivo',agents:'agentes',active:'trabajando',tokens:'tokens en estas conversaciones',consumption:'Consumo',water:'agua estimada',cups:'vasos de 250 ml',formula:'Estimación informal, sin medición: (entrada nueva + salida + 10% de la entrada en caché) ÷ 1.500 × 0,3 ml. Cada vaso equivale a 250 ml.',working:'Trabajando',walking:'Yendo a trabajar',waiting:'Esperando',sleeping:'Descansando',done:'Terminado',unknown:'Sin leer',project:'Proyecto',conversation:'Conversación',none:'Ningún agente vinculado al proyecto',more:'más',model:'Modelo',effort:'Esfuerzo',skills:'Skills',tools:'Herramientas',since:'Desde',now:'Ahora',details:'Detalles del agente',progress:'Progreso registrado',estimate:'Estimación por ritmo',deliveries:'entregas',unmeasured:'Lectura pendiente',noSkills:'Ninguna skill registrada',noTools:'Ninguna herramienta registrada',idle:'parado',minutes:'min',summary:'Progreso',guardian:'Comandos revisados',week:'Semana de Codex usada'}
  };
  const finite=value=>Number.isFinite(value)&&value>=0;
  const date=value=>{const n=Date.parse(value);return Number.isFinite(n)?n:null;};
  function short(value,count=3){return String(value||'').trim().split(/\s+/).slice(0,count).join(' ');}
  function compact(value,lang='en'){return finite(value)?new Intl.NumberFormat(lang,{notation:'compact',maximumFractionDigits:1}).format(value):'?';}
  function agentCount(count,words){return count+' '+(count===1?words.agents.slice(0,-1):words.agents);}
  const TOOL_COPY={exec:['Terminal','Terminal','Terminal'],exec_command:['Terminal','Terminal','Terminal'],js:['Navegador','Browser','Navegador'],apply_patch:['Edita arquivos','Edits files','Edita archivos'],view_image:['Olha imagens','Views images','Ve imágenes'],spawn_agent:['Chama ajudantes','Calls agents','Llama agentes'],send_message:['Conversa com equipe','Talks to team','Habla con equipo'],followup_task:['Passa tarefa','Assigns task','Asigna tarea'],list_agents:['Vê a equipe','Views team','Ve equipo'],wait_agent:['Espera ajudante','Waits for agent','Espera agente'],wait:['Espera','Waits','Espera'],sleep:['Espera','Waits','Espera'],web__run:['Pesquisa','Researches','Investiga'],Read:['Lê arquivos','Reads files','Lee archivos'],Edit:['Edita arquivos','Edits files','Edita archivos'],Write:['Escreve arquivos','Writes files','Escribe archivos'],Bash:['Terminal','Terminal','Terminal'],Grep:['Busca arquivos','Searches files','Busca archivos'],Glob:['Busca arquivos','Searches files','Busca archivos'],Task:['Chama ajudantes','Calls agents','Llama agentes'],Agent:['Chama ajudantes','Calls agents','Llama agentes']};
  function localizedTool(tool,lang){const key=tool.name||'',known=TOOL_COPY[key]||TOOL_COPY[key.split('__').at(-1)],web={WebFetch:['Pesquisa na web','Researches the web','Investiga en la web'],ToolSearch:['Busca ferramentas locais','Finds local tools','Busca herramientas locales']};const labels=known||web[key];return labels?labels[lang==='pt'?0:lang==='es'?2:1]:({pt:'Usa ferramenta local',en:'Uses a local tool',es:'Usa herramienta local'}[lang]||'Uses a local tool');}
  function displayName(agent,lang='en'){const raw=(agent.identity?.labels?.[lang]||({pt:agent.parentId?'AGENTE AJUDANTE':'AGENTE MAESTRO',en:agent.parentId?'AGENTE HELPER':'AGENTE MAESTRO',es:agent.parentId?'AGENTE AYUDANTE':'AGENTE MAESTRO'}[lang])).replace(/\s+\d+$/,''),base=scope.PainelLinguagem?.teamText(raw,lang).toUpperCase()||raw;if(base.includes(' · '))return base;const context=agent.identity?.contextLabels?.[lang]||agent.identity?.focusLabels?.[lang]?.replace(/^(?:o|a|os|as|the|el|la|los|las)\s+/i,'')||agent.project||({pt:'TRABALHO ATUAL',en:'CURRENT WORK',es:'TRABAJO ACTUAL'}[lang]);return base+' · '+(scope.PainelLinguagem?.teamText(context,lang)||context).toUpperCase();}
  function activeAgent(agent,now=Date.now()){const last=date(agent.lastAt);return agent.processAlive===true||agent.active===true||last!==null&&now-last>=0&&now-last<600000;}
  // One row per agent with the Home rules, shared by the Home and the Equipe tab.
  function frontContext(snapshot){const source=snapshot.homeSource||snapshot,list=source.equipe?.agents||[];if(homeForecastCache.size>250)homeForecastCache.clear();return {source,list,now:new Date(date(source.updated)??Date.now()),samples:homeForecast.samplesOf(list)};}
  function frontSession(session){return {...session.node,family:'claude',project:session.projectName||'Casa',homeSessionState:session.node.state||null,identity:{...session.node.identity,taskLabels:session.node.identity?.taskLabels||(/review|qa/.test(session.node.identity?.roleKey||'')?{pt:'Revisa as entregas da equipe',en:'Reviews team deliveries',es:'Revisa las entregas del equipo'}:{pt:'Coordena tarefas e entregas',en:'Coordinates tasks and deliveries',es:'Coordina tareas y entregas'})}};}
  function frontRow(original,{now,samples}){
    // Home describes the last action/role and uses the original rhythm forecast.
    // Delivery recognition belongs to the detailed views, not to this fallback.
    // A finished card keeps its real end and never receives a forecast.
    const agent={...original};delete agent.currentDelivery;
    const finished=/^(?:done|completed)$/i.test(String(original.state||''));
    agent.delivery=finished?{...original.delivery,etaAt:null,estimated:false,state:'done',completedAt:date(original.delivery?.completedAt)!==null?original.delivery.completedAt:null,estimateBasis:null,previousEtaAt:null}:date(original.delivery?.etaAt)!==null?{...original.delivery,completedAt:null}:homeForecast.forecast({...original,state:'working',delivery:{...original.delivery,completedAt:null}},now,samples,homeForecastCache);
    return agent;
  }
  function homeFronts(snapshot){
    const context=frontContext(snapshot),{source,list}=context,roots=list.filter(a=>!a.parentId&&(activeAgent(a)||list.some(c=>c.parentId===a.id&&activeAgent(c)))),sessions=(source.operator?.sessions||[]).filter(s=>s.node&&activeAgent(s.node)).map(frontSession);
    const ids=new Set(sessions.map(a=>a.id));
    return [...roots.filter(a=>!ids.has(a.id)),...sessions].map(original=>frontRow(original,context)).sort((a,b)=>Number(a.state==='done')-Number(b.state==='done')||Number(a.state==='waiting'||a.state==='registered')-Number(b.state==='waiting'||b.state==='registered'));
  }
  // Every agent and every session of the snapshot, by id, without the Home activity filter.
  function teamFronts(snapshot){const context=frontContext(snapshot),{source,list}=context,rows=new Map();for(const agent of list)rows.set(agent.id,frontRow(agent,context));for(const session of source.operator?.sessions||[])if(session.node?.id)rows.set(session.node.id,frontRow(frontSession(session),context));return rows;}
  // Home card names: role, then the work in at most five words. The work comes only from
  // neutral sources: the estado/titulos.json title, a deliverable recognized from the public
  // feed, the closed list of focuses and the closed list of real steps. It passes the same
  // filter used for estado/titulos.json. Repeated names are told apart by project or by the
  // last real step (the card's, then its newest helper's), never by a number; whatever still
  // repeats is listed in collisions.
  const NAME_STOP=new Set(['agente','de','do','da','dos','das','e','o','a','os','as','em','no','na','nos','nas','ao','aos','para','por','com','um','uma','the','of','and','for','in','on','to','el','la','los','las','del','y','en','al','un','una','con']);
  const nameKey=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
  const nameStem=word=>nameKey(word).replace(/\s+/g,'').replace(/(?:es|s)$/,'');
  const pick=(lang,pt,en,es)=>lang==='pt'?pt:lang==='es'?es:en;
  const FOCUS_NAMES={panel:{pt:'PAINEL LOCAL',en:'LOCAL PANEL',es:'PANEL LOCAL'},publicPanel:{pt:'PAINEL PÚBLICO',en:'PUBLIC PANEL',es:'PANEL PÚBLICO'},commands:{pt:'COMANDOS',en:'COMMANDS',es:'COMANDOS'},delivery:{pt:'ENTREGAS',en:'DELIVERIES',es:'ENTREGAS'},home:{pt:'PÁGINA INICIAL',en:'HOME PAGE',es:'PÁGINA INICIAL'},terminal:{pt:'TERMINAL',en:'TERMINAL',es:'TERMINAL'},gallery:{pt:'GALERIAS',en:'GALLERIES',es:'GALERÍAS'},combat:{pt:'COMBATE',en:'COMBAT',es:'COMBATE'},economy:{pt:'ECONOMIA',en:'ECONOMY',es:'ECONOMÍA'},copy:{pt:'TEXTOS',en:'COPY',es:'TEXTOS'},usability:{pt:'LEITURA DO PAINEL',en:'PANEL READING',es:'LECTURA DEL PANEL'},security:{pt:'PROTEÇÃO',en:'PROTECTION',es:'PROTECCIÓN'},tracker:{pt:'RARIDADES',en:'RARITY',es:'RAREZA'},art:{pt:'ARTE',en:'ART',es:'ARTE'}};
  const FOCUS_KEYS=new Set(Object.values(FOCUS_NAMES).flatMap(labels=>Object.values(labels)).map(nameKey));
  // [actions, now, before, short now, short before]: the closed list of real steps, in words.
  const NAME_STEPS=[
    [/^explicando$/,['EXPLICA O PRÓXIMO PASSO','EXPLAINS THE NEXT STEP','EXPLICA EL PRÓXIMO PASO'],['EXPLICOU O PRÓXIMO PASSO','EXPLAINED THE NEXT STEP','EXPLICÓ EL PRÓXIMO PASO'],['EXPLICA PASSOS','EXPLAINS STEPS','EXPLICA PASOS'],['EXPLICOU PASSOS','EXPLAINED STEPS','EXPLICÓ PASOS']],
    [/^(?:terminal|powershell|bash|shell|exec|exec command)$/,['EXECUTA COMANDOS LOCAIS','RUNS LOCAL COMMANDS','EJECUTA COMANDOS LOCALES'],['EXECUTOU COMANDOS LOCAIS','RAN LOCAL COMMANDS','EJECUTÓ COMANDOS LOCALES'],['RODA COMANDOS','RUNS COMMANDS','EJECUTA COMANDOS'],['RODOU COMANDOS','RAN COMMANDS','EJECUTÓ COMANDOS']],
    [/^(?:le arquivos?|read)$/,['LÊ ARQUIVOS DO PROJETO','READS PROJECT FILES','LEE ARCHIVOS DEL PROYECTO'],['LEU ARQUIVOS DO PROJETO','READ PROJECT FILES','LEYÓ ARCHIVOS DEL PROYECTO'],['LÊ ARQUIVOS','READS FILES','LEE ARCHIVOS'],['LEU ARQUIVOS','READ FILES','LEYÓ ARCHIVOS']],
    [/^(?:busca (?:nos )?arquivos|pesquisa arquivos|grep|glob)$/,['PESQUISA ARQUIVOS DO PROJETO','SEARCHES PROJECT FILES','BUSCA ARCHIVOS DEL PROYECTO'],['PESQUISOU ARQUIVOS DO PROJETO','SEARCHED PROJECT FILES','BUSCÓ ARCHIVOS DEL PROYECTO'],['BUSCA ARQUIVOS','SEARCHES FILES','BUSCA ARCHIVOS'],['BUSCOU ARQUIVOS','SEARCHED FILES','BUSCÓ ARCHIVOS']],
    [/^(?:edita arquivos|edit|multiedit|apply patch)$/,['EDITA ARQUIVOS DO PROJETO','EDITS PROJECT FILES','EDITA ARCHIVOS DEL PROYECTO'],['EDITOU ARQUIVOS DO PROJETO','EDITED PROJECT FILES','EDITÓ ARCHIVOS DEL PROYECTO'],['EDITA ARQUIVOS','EDITS FILES','EDITA ARCHIVOS'],['EDITOU ARQUIVOS','EDITED FILES','EDITÓ ARCHIVOS']],
    [/^(?:escreve arquivos|write)$/,['ESCREVE ARQUIVOS DO PROJETO','WRITES PROJECT FILES','ESCRIBE ARCHIVOS DEL PROYECTO'],['ESCREVEU ARQUIVOS DO PROJETO','WROTE PROJECT FILES','ESCRIBIÓ ARCHIVOS DEL PROYECTO'],['ESCREVE ARQUIVOS','WRITES FILES','ESCRIBE ARCHIVOS'],['ESCREVEU ARQUIVOS','WROTE FILES','ESCRIBIÓ ARCHIVOS']],
    [/^(?:olha imagens|view image)$/,['CONFERE IMAGENS DO PROJETO','CHECKS PROJECT IMAGES','REVISA IMÁGENES DEL PROYECTO'],['CONFERIU IMAGENS DO PROJETO','CHECKED PROJECT IMAGES','REVISÓ IMÁGENES DEL PROYECTO'],['CONFERE IMAGENS','CHECKS IMAGES','REVISA IMÁGENES'],['CONFERIU IMAGENS','CHECKED IMAGES','REVISÓ IMÁGENES']],
    [/^novo (?:item|pedido)$/,['COMEÇA A TAREFA ATUAL','STARTS THE CURRENT TASK','EMPIEZA LA TAREA ACTUAL'],['COMEÇOU A TAREFA ATUAL','STARTED THE CURRENT TASK','EMPEZÓ LA TAREA ACTUAL'],['COMEÇA TAREFA','STARTS TASK','EMPIEZA TAREA'],['COMEÇOU TAREFA','STARTED TASK','EMPEZÓ TAREA']],
    [/^terminou o passo$/,['TERMINOU O ÚLTIMO PASSO','FINISHED THE LAST STEP','TERMINÓ EL ÚLTIMO PASO'],['TERMINOU O ÚLTIMO PASSO','FINISHED THE LAST STEP','TERMINÓ EL ÚLTIMO PASO'],['TERMINOU PASSO','FINISHED STEP','TERMINÓ PASO'],['TERMINOU PASSO','FINISHED STEP','TERMINÓ PASO']],
    [/^precisa revisar$/,['PEDE REVISÃO DO PASSO','ASKS FOR A STEP REVIEW','PIDE REVISIÓN DEL PASO'],['PEDIU REVISÃO DO PASSO','ASKED FOR A STEP REVIEW','PIDIÓ REVISIÓN DEL PASO'],['PEDE REVISÃO','ASKS REVIEW','PIDE REVISIÓN'],['PEDIU REVISÃO','ASKED REVIEW','PIDIÓ REVISIÓN']],
    [/^(?:chama ajudantes|spawn agent|task|agent)$/,['CHAMA AJUDANTES','CALLS HELPERS','LLAMA AYUDANTES'],['CHAMOU AJUDANTES','CALLED HELPERS','LLAMÓ AYUDANTES'],['CHAMA AJUDANTES','CALLS HELPERS','LLAMA AYUDANTES'],['CHAMOU AJUDANTES','CALLED HELPERS','LLAMÓ AYUDANTES']],
    [/^(?:conversa com equipe|send message|sendmessage)$/,['ALINHA COM A EQUIPE','ALIGNS WITH THE TEAM','COORDINA CON EL EQUIPO'],['ALINHOU COM A EQUIPE','ALIGNED WITH THE TEAM','COORDINÓ CON EL EQUIPO'],['ALINHA EQUIPE','ALIGNS TEAM','COORDINA EQUIPO'],['ALINHOU EQUIPE','ALIGNED TEAM','COORDINÓ EQUIPO']],
    [/^(?:espera|espera ajudante|wait|wait agent|sleep|monitor)$/,['ESPERA UM RETORNO','AWAITS A REPLY','ESPERA UNA RESPUESTA'],['ESPEROU UM RETORNO','AWAITED A REPLY','ESPERÓ UNA RESPUESTA'],['ESPERA RETORNO','AWAITS REPLY','ESPERA RESPUESTA'],['ESPEROU RETORNO','AWAITED REPLY','ESPERÓ RESPUESTA']],
    [/^(?:navegador|js)$/,['USA O NAVEGADOR','USES THE BROWSER','USA EL NAVEGADOR'],['USOU O NAVEGADOR','USED THE BROWSER','USÓ EL NAVEGADOR'],['USA NAVEGADOR','USES BROWSER','USA NAVEGADOR'],['USOU NAVEGADOR','USED BROWSER','USÓ NAVEGADOR']],
    [/^(?:pesquisa(?: na web)?|webfetch|websearch|web run)$/,['PESQUISA NA WEB','RESEARCHES THE WEB','INVESTIGA EN LA WEB'],['PESQUISOU NA WEB','RESEARCHED THE WEB','INVESTIGÓ EN LA WEB'],['PESQUISA WEB','RESEARCHES WEB','INVESTIGA WEB'],['PESQUISOU WEB','RESEARCHED WEB','INVESTIGÓ WEB']],
    [/^(?:passa tarefa|followup task)$/,['PASSA UMA TAREFA','ASSIGNS A TASK','ASIGNA UNA TAREA'],['PASSOU UMA TAREFA','ASSIGNED A TASK','ASIGNÓ UNA TAREA'],['PASSA TAREFA','ASSIGNS TASK','ASIGNA TAREA'],['PASSOU TAREFA','ASSIGNED TASK','ASIGNÓ TAREA']],
    [/^(?:ve a equipe|list agents)$/,['CONFERE A EQUIPE','CHECKS THE TEAM','REVISA EL EQUIPO'],['CONFERIU A EQUIPE','CHECKED THE TEAM','REVISÓ EL EQUIPO'],['CONFERE EQUIPE','CHECKS TEAM','REVISA EQUIPO'],['CONFERIU EQUIPE','CHECKED TEAM','REVISÓ EQUIPO']],
    [/^estado registrado$/,['ATUALIZOU O RESUMO','UPDATED THE SUMMARY','ACTUALIZÓ EL RESUMEN'],['ATUALIZOU O RESUMO','UPDATED THE SUMMARY','ACTUALIZÓ EL RESUMEN'],['ATUALIZOU RESUMO','UPDATED SUMMARY','ACTUALIZÓ RESUMEN'],['ATUALIZOU RESUMO','UPDATED SUMMARY','ACTUALIZÓ RESUMEN']],
    [/./,['USA FERRAMENTA LOCAL','USES A LOCAL TOOL','USA HERRAMIENTA LOCAL'],['USOU FERRAMENTA LOCAL','USED A LOCAL TOOL','USÓ HERRAMIENTA LOCAL'],['USA FERRAMENTA','USES TOOL','USA HERRAMIENTA'],['USOU FERRAMENTA','USED TOOL','USÓ HERRAMIENTA']]
  ];
  function nameRole(agent,lang='pt'){const raw=String(agent.identity?.labels?.[lang]||({pt:agent.parentId?'AGENTE AJUDANTE':'AGENTE MAESTRO',en:agent.parentId?'AGENTE HELPER':'AGENTE MAESTRO',es:agent.parentId?'AGENTE AYUDANTE':'AGENTE MAESTRO'}[lang])||'AGENTE MAESTRO').split(' · ')[0].replace(/\s+\d+$/,'').trim();return (scope.PainelLinguagem?.teamText(raw,lang)||raw).toUpperCase();}
  function nameProject(agent,lang='pt'){
    const raw=String(agent.project||agent.projectName||'').replace(/\s*\([^)]*\)/g,'').trim(),key=nameKey(raw);if(!raw)return null;
    if(/^(?:painel aberto|agent panel|public panel)$/.test(key))return FOCUS_NAMES.publicPanel[lang]||FOCUS_NAMES.publicPanel.en;
    if(/^(?:painel|panel)$/.test(key))return FOCUS_NAMES.panel[lang]||FOCUS_NAMES.panel.en;
    if(key==='casa')return pick(lang,'CASA','HOUSE','CASA');
    const upper=raw.toUpperCase();return /^[A-ZÀ-Ý0-9 ]{1,30}$/u.test(upper)?upper:null;
  }
  function nameProjects(agent,lang='pt'){const set=new Set(['casa','house','trabalho atual','current work','trabajo actual','projeto local','painel','painel','panel','panel local','local panel'].map(nameKey)),raw=String(agent.project||agent.projectName||'').replace(/\s*\([^)]*\)/g,'').trim();if(raw)set.add(nameKey(raw));const label=nameProject(agent,lang);if(label)set.add(nameKey(label));return set;}
  function nameIsTask(text,role,projects=new Set()){
    const value=String(text||'');
    // The estado/titulos.json filter, then: no number, five words at most, never only the project, no word of the role.
    if(!value||value.length>120||/[^A-ZÀ-Ý0-9 :,]/u.test(value)||/\b(?:V\d+|PRIVADO|SEGREDOS|PRIVATE|SEED|OWNER|WALLET)\b/i.test(value)||/\d/.test(value))return false;
    const words=value.split(' ').filter(word=>nameKey(word));if(!words.length||words.length>5||projects.has(nameKey(value)))return false;
    const roleWords=new Set(String(role||'').split(/\s+/).filter(word=>!NAME_STOP.has(nameKey(word))).map(nameStem).filter(Boolean));
    return !words.some(word=>!NAME_STOP.has(nameKey(word))&&roleWords.has(nameStem(word)));
  }
  function nameStep(agent,lang='pt'){
    const index=lang==='pt'?0:lang==='es'?2:1,action=nameKey(agent.lastAction).replace(/_/g,' ');
    if(action){const row=NAME_STEPS.find(([match])=>match.test(action)),before=['sleeping','done','unknown'].includes(agent.state);return {kind:'step',text:(before?row[2]:row[1])[index],short:(before?row[4]:row[3])[index]};}
    if(agent.homeSessionState==='waiting'||agent.homeSessionState&&agent.state==='waiting')return {kind:'step',text:pick(lang,'PRECISA DE VOCÊ','NEEDS YOU','TE NECESITA'),short:pick(lang,'PRECISA DE VOCÊ','NEEDS YOU','TE NECESITA')};
    if(agent.homeSessionState)return {kind:'step',text:pick(lang,'ATUALIZOU O RESUMO','UPDATED THE SUMMARY','ACTUALIZÓ EL RESUMEN'),short:pick(lang,'ATUALIZOU RESUMO','UPDATED SUMMARY','ACTUALIZÓ RESUMEN')};
    if(agent.state==='done')return {kind:'step',text:pick(lang,'TERMINOU O ÚLTIMO PASSO','FINISHED THE LAST STEP','TERMINÓ EL ÚLTIMO PASO'),short:pick(lang,'TERMINOU PASSO','FINISHED STEP','TERMINÓ PASO')};
    if(agent.state==='waiting')return {kind:'step',text:pick(lang,'ESPERA UM RETORNO','AWAITS A REPLY','ESPERA UNA RESPUESTA'),short:pick(lang,'ESPERA RETORNO','AWAITS REPLY','ESPERA RESPUESTA')};
    return null;
  }
  // Last real step of the newest helper of a card: the third way to tell two equal names apart.
  function nameHelperStep(agent,everyone=[],lang='pt'){
    const latest=everyone.filter(other=>other.parentId===agent.id&&date(other.lastAt)!==null).sort((a,b)=>date(b.lastAt)-date(a.lastAt))[0];
    const step=latest&&nameStep({...latest,state:stateOf(latest)},lang);
    return step?pick(lang,'AJUDANTE ','HELPER ','AYUDANTE ')+step.short:null;
  }
  const ACCENTS={REVISAO:'REVISÃO',COORDENACAO:'COORDENAÇÃO',RODAPE:'RODAPÉ',CORTES:'CORTES',PAGINA:'PÁGINA',ANIMACAO:'ANIMAÇÃO',PROTECAO:'PROTEÇÃO',EPOCAS:'ÉPOCAS',PREVIA:'PRÉVIA',GRAFICOS:'GRÁFICOS',DECISOES:'DECISÕES',PREVISOES:'PREVISÕES',SECAO:'SEÇÃO',CORRECAO:'CORREÇÃO',TRADUCAO:'TRADUÇÃO'};
  function nameOptions(agent,snapshot={},lang='pt'){
    const options=[],add=(kind,value)=>{let text=String(value||'').toUpperCase().replace(/\s+/g,' ').trim();if(!text)return;if(lang==='pt')text=text.replace(/[A-Z]+/g,word=>ACCENTS[word]||word);const tail=text.includes(':')?text.slice(text.indexOf(':')+1).trim():'';for(const item of [tail,text])if(item)options.push({kind,text:item,short:item});};
    const group=(snapshot.equipe?.groups||[]).find(g=>g.titleSource==='estado/titulos.json'&&agent.conversationId&&g.conversationId===agent.conversationId&&(!agent.projectId||!g.projectId||g.projectId===agent.projectId));
    const known=(snapshot.equipe?.agents||[]).find(a=>a.id===agent.id)?.currentDelivery;
    if(known?.known!==false&&known?.source==='public-feed')add('feed',known.labels?.[lang]||known.labels?.pt);
    if(group)add('title',group.titleLabels?.[lang]||group.title);
    const context=agent.identity?.contextLabels?.[lang];if(context&&FOCUS_KEYS.has(nameKey(context)))add('focus',context);
    const focus=agent.identity?.focusKey;if(focus&&FOCUS_NAMES[focus])add('focus',(focus==='panel'&&/aberto|public/i.test(agent.project||'')?FOCUS_NAMES.publicPanel:FOCUS_NAMES[focus])[lang]);
    const step=nameStep(agent,lang);if(step)options.push(step);
    return options;
  }
  function homeNames(rows,snapshot={},lang='pt'){
    const everyone=snapshot.equipe?.agents||[],entries=(rows||[]).map(agent=>{const role=nameRole(agent,lang),projects=nameProjects(agent,lang),choice=nameOptions(agent,snapshot,lang).find(option=>nameIsTask(option.text,role,projects))||null;return {agent,role,projects,choice,step:nameStep(agent,lang),helper:nameHelperStep(agent,everyone,lang),project:nameProject(agent,lang),name:choice?role+' · '+choice.text:role};});
    const repeated=()=>{const byName=new Map();for(const entry of entries){if(!byName.has(entry.name))byName.set(entry.name,[]);byName.get(entry.name).push(entry);}return [...byName.values()].filter(list=>list.length>1);};
    const tell=(list,extra,stepChoice)=>{const values=list.map(extra);if(new Set(values).size<2)return;list.forEach((entry,index)=>{const text=[entry.choice?.short||entry.choice?.text,values[index]].filter(Boolean).join(', ');if(values[index]&&(stepChoice||entry.choice?.kind!=='step')&&nameIsTask(text,entry.role,entry.projects))entry.name=entry.role+' · '+text;});};
    for(const list of repeated())tell(list,entry=>entry.project,true);
    for(const list of repeated())tell(list,entry=>entry.step?.short||null,false);
    for(const list of repeated())tell(list,entry=>entry.helper,true);
    const names=new Map(entries.map(entry=>[entry.agent.id,entry.name]));names.collisions=repeated().map(list=>list[0].name);return names;
  }
  function homeDelivered(agent,lang='pt'){
    if(agent?.state!=='done')return null;
    const word=pick(lang,'entregue','delivered','entregado');
    return date(agent.delivery?.completedAt)!==null?word+' '+timeLabel(agent.delivery.completedAt,lang):word;
  }
  // Second pass for screens with many cards (Equipe tab). Cards that still share a name after homeNames:
  // the one standing for the most agents (then the oldest, then the id) keeps it; every other one says its
  // own last real step from the closed list instead. Still never a number; what remains is in collisions.
  function distinctNames(cards,lang='pt'){
    const names=new Map((cards||[]).map(card=>[card.id,card.name])),groups=new Map();
    for(const card of cards||[]){if(!groups.has(card.name))groups.set(card.name,[]);groups.get(card.name).push(card);}
    for(const list of groups.values()){
      if(list.length<2)continue;
      const ordered=[...list].sort((a,b)=>(b.size||1)-(a.size||1)||(date(a.row?.startedAt)??Infinity)-(date(b.row?.startedAt)??Infinity)||String(a.id).localeCompare(String(b.id)));
      for(const card of ordered.slice(1)){
        const row=card.row||{},role=nameRole(row,lang),projects=nameProjects(row,lang),step=nameStep(row,lang),used=new Set(names.values());
        const next=[step?.text,step?.short].filter(text=>text&&nameIsTask(text,role,projects)).map(text=>role+' · '+text).find(name=>!used.has(name));
        if(next)names.set(card.id,next);
      }
    }
    const count=new Map();for(const name of names.values())count.set(name,(count.get(name)||0)+1);
    names.collisions=[...count].filter(([,n])=>n>1).map(([name])=>name);return names;
  }
  // Third line of a card with the Home rules: real delivery time when finished, forecast while active,
  // last real activity while resting (a resting agent receives no promise).
  function cardTime(agent,lang='pt',active=false){
    const delivered=homeDelivered(agent,lang);if(delivered)return {text:delivered,tone:'done',tip:''};
    if(active){const timing=deliveryLabel(agent.delivery,lang);return agent.delivery?.etaAt?{text:timing.eta+(timing.tone==='late'?' · '+pick(lang,'atrasada','overdue','atrasada'):''),tone:timing.tone,tip:forecastTip(agent.delivery,lang)}:{text:'',tone:timing.tone,tip:''};}
    return date(agent.lastAt)!==null?{text:pick(lang,'última atividade ','last activity ','última actividad ')+timeLabel(agent.lastAt,lang),tone:'resting',tip:''}:{text:'',tone:'resting',tip:''};
  }
  // Real Agente portraits only, from the verified pool the server assigns (the Home source). Each card keeps
  // its own verified Agente; a card without one borrows a verified Agente that no card of the same screen shows,
  // remembered per screen so it does not jump. Never the generic art, never twice on one screen.
  function portraitPool(snapshot){
    const seen=new Set(),pool=[],add=agente=>{const image=agente?.verified===true?imageOf({agente}):null;if(image&&image!=='/agente.png'&&!seen.has(image)){seen.add(image);pool.push({id:agente.id??null,image});}};
    for(const agent of snapshot?.equipe?.agents||[])add(agent.agente);for(const session of snapshot?.operator?.sessions||[])add(session.node?.agente);
    return pool.sort((a,b)=>a.image.localeCompare(b.image));
  }
  const portraitHash=value=>{let hash=2166136261;for(const char of String(value))hash=Math.imul(hash^char.codePointAt(0),16777619)>>>0;return hash;};
  function distinctPortraits(cards,pool=[],memory=new Map()){
    const used=new Set(),result=new Map(),known=new Map(pool.map(item=>[item.image,item]));
    for(const card of cards||[]){const own=(card.candidates||[]).map(agente=>agente?.verified===true?{id:agente.id??null,image:imageOf({agente})}:null).find(item=>item&&item.image!=='/agente.png'&&!used.has(item.image));if(own){used.add(own.image);result.set(card.id,own);}}
    for(const card of cards||[]){if(result.has(card.id))continue;const previous=memory.get(card.id);if(previous&&known.has(previous.image)&&!used.has(previous.image)){used.add(previous.image);result.set(card.id,previous);}}
    const free=pool.filter(item=>!used.has(item.image));
    for(const card of [...(cards||[])].filter(card=>!result.has(card.id)).sort((a,b)=>portraitHash(a.id)-portraitHash(b.id)||String(a.id).localeCompare(String(b.id)))){if(!free.length){result.set(card.id,null);continue;}const [chosen]=free.splice(portraitHash(card.id)%free.length,1);used.add(chosen.image);result.set(card.id,chosen);}
    for(const [id,value]of result)if(value)memory.set(id,value);
    result.missing=[...result].filter(([,value])=>!value).map(([id])=>id);return result;
  }
  function taskLabel(agent,lang='en'){
    if(agent.currentDelivery)return agent.currentDelivery.labels?.[lang]||agent.currentDelivery.labels?.pt||'';
    const action=String(agent.lastAction||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),role=agent.identity?.roleKey;
    const words=(pt,en,es)=>lang==='pt'?pt:lang==='es'?es:en;
    if(agent.identity&&!role&&agent.identity.taskLabels?.[lang]&&!action)return agent.identity.taskLabels[lang];
    const steps={'explicando':['Explica o próximo passo','Explains the next step','Explica el próximo paso'],'novo item':['Começa a tarefa atual','Starts the current task','Empieza la tarea actual'],'novo pedido':['Começa a tarefa atual','Starts the current task','Empieza la tarea actual'],'terminou o passo':['Finaliza a tarefa atual','Finishes the current task','Finaliza la tarea actual'],'precisa revisar':['Revisa o último passo','Reviews the last step','Revisa el último paso'],'terminal':['Executa comandos locais','Runs local commands','Ejecuta comandos locales'],'le arquivos':['Lê arquivos do projeto','Reads the project files','Lee archivos del proyecto'],'busca arquivos':['Pesquisa arquivos do projeto','Searches the project files','Busca archivos del proyecto'],'busca nos arquivos':['Pesquisa arquivos do projeto','Searches the project files','Busca archivos del proyecto'],'edita arquivos':['Edita arquivos do projeto','Edits the project files','Edita archivos del proyecto'],'escreve arquivos':['Escreve arquivos do projeto','Writes the project files','Escribe archivos del proyecto'],'olha imagens':['Confere imagens do projeto','Checks the project images','Revisa imágenes del proyecto']};
    if(!agent.identity||!role){
      if(steps[action])return steps[action][lang==='pt'?0:lang==='es'?2:1];
      if(action&&!/estado registrado/.test(action))return localizedTool({name:agent.lastAction},lang);
      return words('Revisa a tarefa recebida','Reviews the assigned task','Revisa la tarea recibida');
    }
    const work=agent.identity?.taskLabels?.[lang]||agent.taskLabels?.[lang];
    if(work&&agent.state!=='done'){const project=String(agent.project||'').replace(/\s*\([^)]*\)/g,'');return project?work.replace(/desta tarefa|para o projeto|this task|for the project|esta tarea|para el proyecto/gi,project):work;}
    const context=String(agent.identity?.taskLabels?.pt||agent.currentItemTitle||'').toLowerCase();
    const goal=String(agent.conversationTitle||agent.currentItemTitle||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const noun=/nomes.*estimativ/.test(goal)?words('os nomes e previsões','names and forecasts','los nombres y previsiones'):agent.identity?.focusLabels?.[lang]||(/galeri/.test(context)?words('as galerias','the galleries','las galerías'):/nomes|entregas|estimativ/.test(context)?words('o painel','the dashboard','el panel'):/toque|combate|armas|animac/.test(context)?words('o combate','combat','el combate'):/econom/.test(context)?words('a economia','the economy','la economía'):/texto|conte[uú]do/.test(context)?words('os textos','the copy','los textos'):/dados/.test(context)?words('os dados','the data','los datos'):words(agent.project?.replace(/\s*\([^)]*\)/g,'')||'a tarefa',agent.project?.replace(/\s*\([^)]*\)/g,'')||'the task',agent.project?.replace(/\s*\([^)]*\)/g,'')||'la tarea'));
    const verbs={'terminou o passo':words('Concluiu trabalho para ','Completed work for ','Terminó trabajo para '),'precisa revisar':words('Revisa trabalho em ','Reviews work on ','Revisa trabajo en '),'usa ferramenta local':words('Usa ferramenta para ','Uses a tool for ','Usa herramienta para '),'chama ajudantes':words('Divide trabalho em ','Delegates work on ','Reparte trabajo en '),'conversa com equipe':words('Alinha trabalho em ','Coordinates work on ','Coordina trabajo en '),'espera':words('Espera retorno de ','Awaits a reply for ','Espera respuesta de '),'explicando':words('Explica passos para ','Explains steps for ','Explica pasos para '),'novo item':words('Começa trabalho para ','Starts work for ','Empieza trabajo para '),'novo pedido':words('Começa trabalho em ','Starts work on ','Empieza trabajo en '),'terminal':words('Roda comandos para ','Runs commands for ','Ejecuta comandos para '),'le arquivos':words('Lê arquivos para ','Reads files for ','Lee archivos para '),'busca arquivos':words('Busca arquivos para ','Finds files for ','Busca archivos para '),'busca nos arquivos':words('Busca arquivos para ','Finds files for ','Busca archivos para '),'edita arquivos':words('Edita arquivos para ','Edits files for ','Edita archivos para '),'escreve arquivos':words('Escreve arquivos para ','Writes files for ','Escribe archivos para '),'olha imagens':words('Confere imagens de ','Checks images of ','Revisa imágenes de ')};
    if(action==='terminou o passo')return (words('Concluiu: ','Finished: ','Terminó: ')+noun.replace(/^(?:o|a|os|as|the|el|la|los|las)\s+/i,'')).slice(0,40);
    if(verbs[action]){const joined=verbs[action]+noun,value=lang==='pt'?joined.replace(/\bem os\b/g,'nos').replace(/\bem as\b/g,'nas').replace(/\bem o\b/g,'no').replace(/\bem a\b/g,'na').replace(/\bde os\b/g,'dos').replace(/\bde as\b/g,'das').replace(/\bde o\b/g,'do').replace(/\bde a\b/g,'da'):joined;return value.length<=40?value:value.slice(0,39).replace(/\s+\S*$/,'')+'…';}
    if(work&&role==='helper'&&!/tarefa atual|ferramenta local|frente de trabalho/.test(work))return work.slice(0,40);
    if(agent.lastAt)return (words('Atividade em ','Activity for ','Actividad en ')+noun).slice(0,40);
    return words('Organiza a próxima entrega','Plans the next delivery','Organiza la próxima entrega');
  }
  function stableOrder(previous,items){const byId=new Map(items.map(item=>[item.id,item])),ids=[...previous.filter(id=>byId.has(id)),...items.filter(item=>!previous.includes(item.id)).map(item=>item.id)];return ids.map(id=>byId.get(id));}
  function groupTitle(group,lang='en'){return group.titleLabels?.[lang]||group.conversation||COPY[lang].conversation;}
  function toolLabel(tool,agent,lang){return (lang?localizedTool(tool,lang):(tool.label||tool.name))+(finite(tool.count)?' ×'+(agent.toolsExact===false?'≥':'')+tool.count:'');}
  function stateOf(agent,now=Date.now()){
    const value=String(agent.state||'').toLowerCase(),last=date(agent.lastAt||agent.lastActionAt);
    if(value==='done'||value==='completed')return 'done';
    if(agent.processAlive===true)return value==='walking'?'walking':value==='working'?'working':'waiting';
    if(value==='waiting')return 'waiting';
    if(value==='sleeping'||last!==null&&now-last>=SLEEP_AFTER)return 'sleeping';
    if(value==='walking')return 'walking';
    return value==='working'?'working':'unknown';
  }
  function imageOf(agent){
    const value=String(agent.agente?.image||'');
    // Agente assets must already be local. Rendering never downloads an image.
    return /^\/?(?:assets|agente|agentes|miniaturas)\/[\w./-]+\.(?:png|webp|jpg)$/i.test(value)&&!value.includes('..')?value:'/agente.png';
  }
  function frescorDe(view){const f=view&&view.source&&view.source.consumption&&view.source.consumption.frescor;return f&&f.velho?f:null;}
  function consumoOf(view){const c=view&&view.source&&view.source.consumo;return c&&Number.isFinite(c.total)?c:null;}
  function sinceText(iso,lang){const at=Date.parse(iso);if(!Number.isFinite(at))return null;const d=new Date(at-3*3600000),two=n=>String(n).padStart(2,'0'),hm=two(d.getUTCHours())+':'+two(d.getUTCMinutes());return lang==='en'?['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]+' '+d.getUTCDate()+', '+hm:two(d.getUTCDate())+'/'+two(d.getUTCMonth()+1)+' '+hm;}
  function consumoLabel(view,lang){const c=consumoOf(view),since=c&&sinceText(c.desde,lang);return since?({pt:'tokens desde ',en:'tokens since ',es:'tokens desde '}[lang]||'tokens desde ')+since:null;}
  function paintSplit(controller,view,lang){const host=controller.split;if(!host)return;const c=consumoOf(view);if(!c||!c.total||view.tokens!==c.total){host.replaceChildren();host.hidden=true;return;}
    const W={pt:{read:'é releitura do contexto guardado (cache): custa cerca de 10 vezes menos que entrada nova.',types:['releitura','escrita de cache','entrada nova','saída'],today:'hoje',counting:p=>'Contando as conversas: '+p+'% lido'},en:{read:'is re-reading saved context (cache): it costs about 10 times less than new input.',types:['re-reading','cache writes','new input','output'],today:'today',counting:p=>'Counting conversations: '+p+'% read'},es:{read:'es relectura del contexto guardado (caché): cuesta cerca de 10 veces menos que la entrada nueva.',types:['relectura','escritura de caché','entrada nueva','salida'],today:'hoy',counting:p=>'Contando las conversaciones: '+p+'% leído'}}[lang]||null;if(!W){host.hidden=true;return;}
    const t=c.tipos,share=x=>{const p=x/c.total*100;return new Intl.NumberFormat(lang,{maximumFractionDigits:p<10?1:0}).format(p)+'%';};
    const nodes=[el('p','eq-split-main',share(t.leituraCache)+' '+W.read),el('p','eq-split-detail',[['leituraCache',0],['escritaCache',1],['novo',2],['saida',3]].map(([k,i])=>W.types[i]+' '+compact(t[k],lang)).join(' · ')),el('p','eq-split-detail',['Claude '+compact(c.familias.claude.total,lang),'Codex '+compact(c.familias.codex.total,lang),W.today+' '+compact(c.hoje.total,lang)].join(' · '))];
    if(!c.completo)nodes.push(el('p','eq-split-detail eq-split-counting',W.counting(new Intl.NumberFormat(lang,{maximumFractionDigits:0}).format(c.lidoPct))));
    host.replaceChildren(...nodes);host.hidden=false;}
  function cupLevels(waterMl,max=10){
    if(!finite(waterMl))return {levels:[],extra:null,total:null};
    const cups=waterMl/250,full=Math.floor(cups),partial=cups-full;
    if(cups===0)return {levels:[0],extra:0,total:0};
    const total=Math.ceil(cups),count=Math.min(max,total),levels=Array.from({length:count},(_,index)=>index<full?1:partial);
    if(total>max&&partial>0)levels[count-1]=partial;
    return {levels,extra:Math.max(0,total-count),total:cups};
  }
  function normalize(snapshot,now=Date.now()){
    const source=snapshot.equipe||snapshot||{},countsKnown=Array.isArray(source.agents)||Array.isArray(source.grupos),raw=source.agents||source.grupos?.flatMap(group=>group.agentes.map(agent=>({...agent,conversationId:agent.conversationId||group.id,conversation:agent.conversation||group.nome})))||[];
    const agents=raw.filter(agent=>agent&&typeof agent.id==='string').map(agent=>({...agent,state:stateOf(agent,now)}));
    const projects=new Map((Array.isArray(snapshot.projects)?snapshot.projects:[]).map(project=>[project.id,project]));
    const sourceGroups=new Map((source.groups||[]).map(group=>[group.id,group]));
    const groups=new Map();for(const agent of agents){const projectId=agent.projectId||'unread',conversationId=agent.conversationId||agent.id,key=projectId+'|'+conversationId;if(!groups.has(key))groups.set(key,{id:key,projectId,project:agent.project||agent.projectName||projects.get(projectId)?.name||null,conversationId,projectLabel:sourceGroups.get(key)?.projectLabel||null,titleLabels:sourceGroups.get(key)?.titleLabels||agent.conversationLabels||null,conversation:sourceGroups.get(key)?.title||agent.conversationTitle||agent.conversation||agent.conversationName||null,delivery:sourceGroups.get(key)?.delivery||agent.delivery||null,agents:[]});groups.get(key).agents.push(agent);}
    const tokens=finite(source.tokens)?source.tokens:(agents.length&&agents.every(agent=>finite(agent.tokens))?agents.reduce((sum,agent)=>sum+agent.tokens,0):null);
    const weightedTokens=finite(source.weightedTokens)?source.weightedTokens:(agents.length&&agents.every(agent=>finite(agent.weightedTokens))?agents.reduce((sum,agent)=>sum+agent.weightedTokens,0):null);
    const waterMl=finite(source.waterMl)?source.waterMl:finite(source.aguaMl)?source.aguaMl:finite(weightedTokens)?weightedTokens/1500*.3:null;
    const tokensExact=source.tokensExact!==false&&!agents.some(agent=>agent.tokensExact===false);
    return {source,agents,groups:[...groups.values()].sort((a,b)=>Number(Boolean(b.delivery?.etaAt))-Number(Boolean(a.delivery?.etaAt))||Number(a.agents.every(x=>x.state==='done'||x.state==='sleeping'))-Number(b.agents.every(x=>x.state==='done'||x.state==='sleeping'))),total:countsKnown?agents.length:null,active:countsKnown?agents.filter(agent=>['working','walking'].includes(agent.state)).length:null,tokens,tokensExact,weightedTokens,waterMl,now};
  }
  function progressOf(value,now=Date.now()){
    if(!value||!Array.isArray(value.deliveries)||!value.deliveries.length)return {percent:null,done:null,total:null,eta:null,deliveries:[]};
    const deliveries=value.deliveries,total=deliveries.length,done=deliveries.filter(item=>item.done===true||item.state==='done').length;
    const completed=deliveries.map(item=>date(item.completedAt)).filter(Number.isFinite).sort((a,b)=>a-b),started=date(value.startedAt);
    let eta=null;
    if(done<total&&completed.length>=2&&started!==null&&completed.at(-1)>started){const pace=(completed.at(-1)-started)/completed.length;eta=new Date(now+pace*(total-done)).toISOString();}
    return {percent:total?Math.round(done/total*100):null,done,total,eta,deliveries,startedAt:value.startedAt||null};
  }
  function homeAgents(agents,limit=8){
    const chosen=[],seen=new Set(),add=agent=>{if(agent&&!seen.has(agent.id)&&chosen.length<limit){seen.add(agent.id);chosen.push(agent);}};
    const moving=agents.filter(agent=>['working','walking'].includes(agent.state)).sort((a,b)=>Number(a.identity?.roleKey==='helper')-Number(b.identity?.roleKey==='helper')||Number(Boolean(a.parentId))-Number(Boolean(b.parentId))||String(b.lastAt||'').localeCompare(String(a.lastAt||'')));
    const waiting=agents.find(agent=>agent.state==='waiting'),sleeping=agents.find(agent=>agent.state==='sleeping');
    for(const agent of moving.slice(0,Math.max(0,limit-Number(Boolean(waiting))-Number(Boolean(sleeping)))))add(agent);
    add(waiting);add(sleeping);for(const agent of agents)add(agent);return chosen;
  }
  function deliveryLabel(delivery,lang='pt'){
    const words={pt:{eta:'entrega ~',none:'Calculando previsão',done:'Entregue',early:'Adiantado',onTime:'No prazo',late:'Atrasado',noDeadline:'Sem prazo',progress:'Em andamento',left:'faltam'},en:{eta:'delivery ~',none:'Calculating forecast',done:'Delivered',early:'Early',onTime:'On time',late:'Late',noDeadline:'No deadline',progress:'In progress',left:'left'},es:{eta:'entrega ~',none:'Calculando previsión',done:'Entregado',early:'Adelantado',onTime:'A tiempo',late:'Tarde',noDeadline:'Sin plazo',progress:'En curso',left:'faltan'}}[lang]||{};
    const overdue=delivery?.etaAt&&!delivery?.completedAt&&date(delivery.etaAt)<Date.now();const eta=overdue?({pt:'A qualquer momento',en:'Any moment now',es:'En cualquier momento'}[lang]):delivery?.etaAt?words.eta+timeLabel(delivery.etaAt,lang)+(delivery.estimated?' · '+({pt:'estimada',en:'estimated',es:'estimada'}[lang]):''):delivery?.completedAt?words.done+' '+timeLabel(delivery.completedAt,lang):words.none;
    const expired=Boolean(delivery?.etaAt&&!delivery?.completedAt&&date(delivery.etaAt)<Date.now());
    const tone=expired?'in-progress':delivery?.state==='in-progress'?(delivery.etaAt&&delivery.deadlineAt&&date(delivery.etaAt)>date(delivery.deadlineAt)?'late':'in-progress'):delivery?.state||'no-deadline';
    const countdownAt=date(delivery?.deadlineAt||delivery?.etaAt),remaining=countdownAt!==null?Math.max(0,Math.ceil((countdownAt-Date.now())/60000)):delivery?.minutes;
    const badge=delivery?.completedAt?words.done:expired?({pt:'Estimativa vencida',en:'Estimate overdue',es:'Estimación vencida'}[lang]||'Estimate overdue'):({'in-progress':words.progress+(finite(remaining)?' · '+(delivery?.deadlineAt?({pt:'Prazo em ',en:'Deadline in ',es:'Plazo en '}[lang])+remaining+' min':({pt:'Entrega em ',en:'Delivery in ',es:'Entrega en '}[lang])+remaining+' min'):''),'early':words.early,'on-time':words.onTime,'late':words.late,'no-deadline':words.noDeadline})[tone]||words.noDeadline;
    return {eta,badge,tone,ratio:finite(delivery?.ratio)?Math.min(1,delivery.ratio):null};
  }
  function forecastTip(delivery,lang='pt'){
    const b=delivery?.estimateBasis||{},w=(pt,en,es)=>lang==='pt'?pt:lang==='es'?es:en;
    let text=b.method==='similar-tasks'?w('Base: '+b.sampleCount+' tarefas parecidas, mediana '+b.typicalMinutes+' min','Basis: '+b.sampleCount+' similar tasks, median '+b.typicalMinutes+' min','Base: '+b.sampleCount+' tareas similares, mediana '+b.typicalMinutes+' min'):b.method==='steps-per-minute'?w('Base: '+b.steps+' passos em '+b.elapsedMinutes+' min; hipótese de '+b.remainingStages+' etapas restantes','Basis: '+b.steps+' steps in '+b.elapsedMinutes+' min; '+b.remainingStages+' remaining stages assumed','Base: '+b.steps+' pasos en '+b.elapsedMinutes+' min; se suponen '+b.remainingStages+' etapas'):b.method==='initial-window'?w('Base inicial: sem amostra de ritmo; hipótese de '+b.remainingStages+' etapas de 5 min','Initial basis: no pace sample; '+b.remainingStages+' stages of 5 min assumed','Base inicial: sin muestra de ritmo; se suponen '+b.remainingStages+' etapas de 5 min'):delivery?.etaSource==='operator-summary'?w('Previsão no resumo da sessão','Forecast in the session summary','Previsión en el resumen de sesión'):delivery?.etaSource==='feed'?w('Previsão declarada no feed','Forecast declared in the feed','Previsión declarada en el feed'):delivery?.deadlineAt?w('Prazo declarado na tarefa','Deadline declared in the task','Plazo declarado en la tarea'):delivery?.completedAt?w('Última entrega registrada','Last recorded delivery','Última entrega registrada'):w('Leitura da atividade local','Local activity reading','Lectura de actividad local');
    const read=b.readAt||delivery?.etaUpdatedAt||delivery?.completedAt;if(read)text+=' · '+w('lido ','read ','leído ')+timeLabel(read,lang);
    if(delivery?.previousEtaAt&&delivery?.previousEtaAt!==delivery?.etaAt)text+=' · '+w('antes ~','previously ~','antes ~')+timeLabel(delivery.previousEtaAt,lang)+' · '+w('novos passos registrados','new recorded activity','nueva actividad registrada');
    return text;
  }
  const instances=new WeakMap();
  function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=scope.PainelLinguagem?.text(text,document.documentElement.lang)??String(text);return node;}
  function svg(tag,attrs={}){const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))node.setAttribute(k,v);return node;}
  function drawCup(level,id){
    const cup=svg('svg',{viewBox:'0 0 32 42','aria-hidden':'true',class:'eq-cup'}),defs=svg('defs'),clip=svg('clipPath',{id});clip.append(svg('path',{d:'M5 4h22l-3 34H8z'}));defs.append(clip);cup.append(defs);
    const fill=svg('g',{'clip-path':'url(#'+id+')'});fill.append(svg('rect',{x:0,y:0,width:32,height:42,class:'eq-cup-bg'}));
    if(level>0){const wave=svg('g',{class:level<1?'eq-water-wave':''}),y=38-level*32;wave.append(svg('path',{d:'M-12 '+y+' q6 -3 12 0 t12 0 t12 0 t12 0 V44 H-12z',class:'eq-cup-water'}));fill.append(wave);}cup.append(fill,svg('path',{d:'M5 4h22l-3 34H8z',class:'eq-cup-outline'}),svg('path',{d:'M9 8v22',class:'eq-cup-glint'}));return cup;
  }
  function create(host){
    host.replaceChildren();host.className='eq-shell';const controller={host,snapshot:null,options:{},nodes:new Map(),groups:new Map(),previous:new Map(),cupKey:null,id:'eq-'+Math.random().toString(36).slice(2),details:false};
    const heading=el('div','eq-heading'),title=el('h2'),count=el('span');heading.append(title,count);
    const stage=el('div','eq-groups'),consumption=el('section','eq-consumption'),tokenBlock=el('div','eq-token-block'),consTitle=el('h2'),tokens=el('strong'),tokensLabel=el('span');const split=el('div','eq-split');split.hidden=true;tokenBlock.append(consTitle,tokens,tokensLabel,split);
    const cups=el('div','eq-cups'),waterBlock=el('div','eq-water-block'),water=el('strong'),waterLabel=el('span'),cupCount=el('small'),info=el('button','eq-info','i'),tip=el('span','eq-info-tip');info.type='button';info.setAttribute('aria-expanded','false');
    const infoPanel=el('div','eq-info-panel'),tldr=el('strong','eq-tldr'),more=el('details','eq-info-more'),moreSum=el('summary'),moreText=el('p');more.append(moreSum,moreText);infoPanel.append(tldr,more);infoPanel.hidden=true;
    info.addEventListener('click',()=>{const open=info.getAttribute('aria-expanded')!=='true';info.setAttribute('aria-expanded',String(open));infoPanel.hidden=!open;});info.append(tip);waterBlock.append(water,waterLabel,info,cupCount);consumption.append(tokenBlock,cups,waterBlock,infoPanel);
    host.append(heading,consumption,stage);Object.assign(controller,{heading,title,count,stage,consumption,consTitle,tokens,tokensLabel,split,cups,water,waterLabel,cupCount,info,tip,infoPanel,tldr,moreSum,moreText});
    controller.visibility=()=>{host.classList.toggle('eq-paused',document.hidden);for(const node of controller.nodes.values()){if(document.hidden)node.motion?.pause();else node.motion?.finish();}};document.addEventListener('visibilitychange',controller.visibility);
    controller.timer=setInterval(()=>{if(controller.snapshot&&!document.hidden&&host.isConnected)paint(controller,false);},30000);instances.set(host,controller);return controller;
  }
  function createGroup(controller,group){
    const box=el('section','eq-conversation'),heading=el('div','eq-conversation-heading'),identity=el('div'),project=el('span','eq-project'),title=el('h3'),counter=el('span','eq-group-count'),agents=el('div','eq-stage');const timing=el('div','eq-delivery-heading'),eta=el('strong','eq-delivery-eta'),badge=el('span','eq-deadline-badge'),bar=el('div','eq-time-bar'),fill=el('i');timing.append(eta,badge);bar.append(fill);identity.append(project,title);heading.append(identity,timing,counter);const legend=el('div','eq-time-legend');box.append(heading,bar,legend,agents);controller.stage.append(box);return {box,project,title,counter,agents,eta,badge,bar,fill,legend};
  }
  function createAgent(controller,agent){
    const button=el('button','eq-agent');button.type='button';button.dataset.id=agent.id;
    const art=el('div','eq-agent-art'),avatar=el('div','eq-agent-avatar'),image=el('img'),family=el('span','eq-family'),busy=el('span','eq-busy'),sleep=el('span','eq-zz'),check=el('span','eq-check','✓');image.width=68;image.height=68;image.alt='';image.draggable=false;
    image.addEventListener('error',()=>{if(image.getAttribute('src')!=='/agente.png')image.src='/agente.png';});
    busy.append(el('i'),el('i'),el('i'));sleep.append(el('i',undefined,'z'),el('i',undefined,'z'),el('i',undefined,'z'));avatar.append(image,family,busy,sleep,check);art.append(avatar);
    const name=el('strong','eq-agent-name'),action=el('span','eq-agent-action'),state=el('span','eq-agent-state');const eta=el('span','eq-agent-eta'),dot=el('i','eq-deadline-dot'),agente=el('span','eq-agente-number');button.append(art,name,agente,action,state,eta);eta.prepend(dot);agente.hidden=true;
    button.addEventListener('click',()=>{const current=controller.view.agents.find(item=>item.id===button.dataset.id);if(current){if(controller.options.onSelectAgent)controller.options.onSelectAgent(current);else showAgent(controller,current);}});
    return {button,art,avatar,image,family,name,action,state,eta,dot,agente,motion:null};
  }
  function paint(controller,animate=true){
    const lang=COPY[controller.options.lang]?controller.options.lang:'en',words=COPY[lang],homeMode=controller.options.mode==='home',source=homeMode?{...controller.snapshot,equipe:{...controller.snapshot.equipe,agents:homeFronts(controller.snapshot)}}:controller.snapshot,view=normalize(source);controller.view=view;controller.lang=lang;controller.words=words;
    const home=controller.options.mode==='home',homeIds=new Set(view.agents.map(agent=>agent.id));
    const allAgents=view.agents;const stableAgents=stableOrder(controller.agentOrder||[],allAgents);controller.agentOrder=stableAgents.map(agent=>agent.id);const initialHome=stableAgents;const pinnedHome=controller.homeOrder?.length?stableOrder(controller.homeOrder,stableAgents):initialHome;controller.homeOrder=pinnedHome.map(agent=>agent.id);const cardNames=home?homeNames(pinnedHome,controller.snapshot,lang):new Map();controller.homeNames=cardNames;
    const displayGroups=home?[{id:'home',projectId:'',project:'',conversation:'',agents:pinnedHome}]:stableOrder(controller.groupOrder||[],view.groups);controller.groupOrder=displayGroups.filter(group=>group.id!=='home').map(group=>group.id);
    controller.host.classList.toggle('eq-home',home);controller.heading.hidden=true;
    if(controller.options.consumptionHost&&controller.consumption.parentNode!==controller.options.consumptionHost)controller.options.consumptionHost.append(controller.consumption);
    controller.consumption.classList.add('eq-shell');
    controller.title.textContent=words.team;controller.count.textContent=(view.active??'?')+' '+words.active+' · '+(view.total??'?')+' '+words.agents;
    controller.host.classList.toggle('eq-paused',document.hidden);const wantedGroups=new Set(displayGroups.map(group=>group.id)),wantedAgents=new Set(displayGroups.flatMap(group=>group.agents).map(agent=>agent.id));
    for(const [key,group]of controller.groups)if(!wantedGroups.has(key)){group.box.remove();controller.groups.delete(key);}
    for(const [key,node]of controller.nodes)if(!wantedAgents.has(key)){node.motion?.cancel();node.button.remove();controller.nodes.delete(key);controller.previous.delete(key);}
    for(const [groupIndex,group]of displayGroups.entries()){let container=controller.groups.get(group.id);if(!container){container=createGroup(controller,group);controller.groups.set(group.id,container);}if(controller.stage.children[groupIndex]!==container.box)controller.stage.insertBefore(container.box,controller.stage.children[groupIndex]||null);container.box.classList.toggle('eq-wide',group.agents.length>3);container.project.textContent=group.projectLabel||group.project||group.projectId||words.project;container.title.textContent=groupTitle(group,lang);const timing=deliveryLabel(group.delivery,lang);container.eta.textContent=timing.eta;container.badge.textContent=timing.badge+(timing.tone==='late'&&group.delivery?.deadlineAt&&finite(group.delivery?.minutes)?' · '+group.delivery.minutes+' min':'');container.badge.dataset.tone=timing.tone;container.bar.hidden=!group.delivery?.deadlineAt;container.bar.classList.toggle('eq-time-expired',Boolean(group.delivery?.deadlineAt&&timing.ratio===null&&Date.parse(group.delivery.deadlineAt)<Date.now()));container.fill.hidden=timing.ratio===null;container.fill.style.transform='scaleX('+(timing.ratio||0)+')';container.bar.setAttribute('aria-label',timing.badge);container.legend.hidden=!(group.delivery?.startedAt||group.delivery?.deadlineAt);container.legend.textContent=({pt:'Início',en:'Start',es:'Inicio'}[lang])+' '+timeLabel(group.delivery?.startedAt,lang)+' · '+({pt:'Agora',en:'Now',es:'Ahora'}[lang])+' '+timeLabel(new Date().toISOString(),lang)+' · '+({pt:'Prazo',en:'Deadline',es:'Plazo'}[lang])+' '+timeLabel(group.delivery?.deadlineAt,lang);container.bar.title=({pt:'Início / agora / prazo',en:'Start / now / deadline',es:'Inicio / ahora / plazo'}[lang])+' · '+timeLabel(group.delivery?.startedAt,lang)+' / '+timeLabel(new Date().toISOString(),lang)+' / '+timeLabel(group.delivery?.deadlineAt,lang);container.eta.title=forecastTip(group.delivery,lang);container.counter.hidden=true;container.counter.textContent=agentCount(group.agents.length,words);container.box.querySelector('.eq-conversation-heading').hidden=home;
      controller.rows??=new Map();const orderedRows=stableOrder(controller.rows.get(group.id)||[],group.agents);if(home)orderedRows.sort((a,b)=>Number(b.currentDelivery?.known===true)-Number(a.currentDelivery?.known===true)||Number(a.state==='done')-Number(b.state==='done')||Number(a.state==='waiting'||a.state==='registered')-Number(b.state==='waiting'||b.state==='registered'));controller.rows.set(group.id,orderedRows.map(agent=>agent.id));
      for(const [agentIndex,agent]of orderedRows.entries()){let node=controller.nodes.get(agent.id);if(!node){node=createAgent(controller,agent);controller.nodes.set(agent.id,node);}if(container.agents.children[agentIndex]!==node.button)container.agents.insertBefore(node.button,container.agents.children[agentIndex]||null);
        const family=String(agent.family||'').toLowerCase()==='claude'?'claude':'codex',old=controller.previous.get(agent.id),item=agent.currentItemId||agent.taskId||null;
        const cardName=cardNames.get(agent.id)||displayName(agent,lang),delivered=homeDelivered(agent,lang);
        node.button.className='eq-agent eq-'+family+' eq-'+agent.state;node.name.textContent=cardName;node.action.textContent=taskLabel(agent,lang);node.state.textContent=words[agent.state]||words.unknown;const image=imageOf(agent);if(node.requestedImage!==image){node.requestedImage=image;node.image.src=image;}node.family.textContent=family==='claude'?'C':'X';const timing=deliveryLabel(agent.delivery,lang);node.eta.replaceChildren(node.dot,document.createTextNode(delivered||(agent.delivery?.etaAt?timing.eta+(timing.tone==='late'?' · '+({pt:'atrasada',en:'overdue',es:'atrasada'}[lang]):''):'')));node.dot.dataset.tone=delivered?'done':timing.tone;node.eta.hidden=!(delivered||agent.delivery?.etaAt||agent.delivery?.deadlineAt);node.agente.textContent=agent.agente?.verified&&agent.agente.id?'Agente #'+agent.agente.id:'';node.agente.hidden=true;
        node.button.title=cardName+' · '+taskLabel(agent,lang)+' · '+node.state.textContent;if(delivered)node.button.title+=' · '+delivered;else if(agent.currentDelivery?.known!==false)node.button.title+=' · '+timing.eta+' · '+timing.badge+' · '+forecastTip(agent.delivery,lang);node.button.setAttribute('aria-label',node.button.title+(node.agente.textContent?' · '+node.agente.textContent:''));node.image.alt=node.agente.textContent||'Agente';
        const identityChanged=old&&old.paper!==agent.identity?.paper;const change=old&&(old.state!==agent.state||item&&item!==old.item||agent.state==='walking'&&old.lastAt!==agent.lastAt),reduced=scope.document?.documentElement?.dataset.motion==='off'||scope.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
        if(animate&&identityChanged&&!reduced&&!document.hidden){node.name.animate([{opacity:.25,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'ease-out'});}if(animate&&change&&!reduced&&!document.hidden){node.motion?.cancel();if(agent.state==='done')node.motion=node.avatar.animate([{transform:'translateY(0)'},{transform:'translateY(-12px)',offset:.45},{transform:'translateY(0)'}],{duration:650,easing:'cubic-bezier(.22,1,.36,1)'});else if(agent.state==='walking'||item&&item!==old.item)node.motion=node.art.animate([{transform:'translateX(-26px)',opacity:.6},{transform:'translateX(0)',opacity:1}],{duration:700,easing:'cubic-bezier(.22,1,.36,1)'});}
        controller.previous.set(agent.id,{state:agent.state,item,lastAt:agent.lastAt,paper:agent.identity?.paper});
      }
    }
    if(!stableAgents.length){controller.empty??=el('p','eq-empty');controller.empty.textContent=view.agents.length?({pt:'A equipe aguarda o próximo trabalho',en:'The team awaits the next task',es:'El equipo espera el próximo trabajo'}[lang]):words.none;controller.stage.append(controller.empty);}else controller.empty?.remove();
    controller.consTitle.textContent=words.consumption;controller.tokens.textContent=finite(view.tokens)?(view.tokensExact?'':'≥ ')+compact(view.tokens,lang):frescorDe(view)?'?':({pt:'Este projeto ainda não tem consumo registrado',en:'No usage recorded for this project yet',es:'Este proyecto aún no tiene consumo registrado'}[lang]);controller.tokens.style.fontSize=finite(view.tokens)?'':'16px';controller.tokensLabel.hidden=!finite(view.tokens)&&!frescorDe(view);controller.tokensLabel.textContent=frescorDe(view)?(frescorDe(view).motivo||'sem medida')+'. Solução: '+frescorDe(view).solucao:(consumoLabel(view,lang)||words.tokens);paintSplit(controller,view,lang);
    controller.water.textContent=finite(view.waterMl)?'~'+new Intl.NumberFormat(lang,{maximumFractionDigits:view.waterMl>=100000?0:1}).format(view.waterMl>=1000?view.waterMl/1000:view.waterMl)+(view.waterMl>=1000?' L':' ml'):words.unmeasured;controller.water.hidden=controller.waterLabel.hidden=!finite(view.waterMl);const waterInfo=consumoOf(view)?.agua;controller.waterLabel.textContent=waterInfo?.rotulo?.[lang]||words.water;{const tldr={pt:'Cada copo = 250 ml de água que o uso de IA da equipe gasta, em conta aproximada; não é medido.',en:'Each cup = 250 ml of water the team\u2019s AI use takes, as a rough estimate; it is not measured.',es:'Cada vaso = 250 ml de agua que gasta el uso de IA del equipo, en cuenta aproximada; no se mide.'}[lang]||'',how={pt:'Como calculamos',en:'How we estimate',es:'Cómo calculamos'}[lang]||'Como calculamos';controller.tip.textContent=tldr;controller.tldr.textContent=tldr;controller.moreSum.textContent=how;controller.moreText.textContent=waterInfo?.dica?.[lang]||words.formula;controller.info.setAttribute('aria-label',tldr+' '+how);}
    const levels=cupLevels(view.waterMl),key=JSON.stringify(levels);if(key!==controller.cupKey){controller.cupKey=key;controller.cups.replaceChildren();for(const [index,level]of levels.levels.entries())controller.cups.append(drawCup(level,controller.id+'-'+index));if(levels.extra)controller.cups.append(el('span','eq-extra-cups',({pt:'E outros copos',en:'And more cups',es:'Y otros vasos'}[lang])));}
    controller.cupCount.hidden=true;controller.cupCount.textContent=levels.total!==null?new Intl.NumberFormat(lang,{maximumFractionDigits:1}).format(levels.total)+' '+words.cups:words.unmeasured;
    if(controller.details)paintDetails(controller);
  }
  function render(snapshot,host,options={}){if(!host)return;if(typeof options==='string')options={lang:options};const controller=instances.get(host)||create(host);controller.snapshot=snapshot||{};controller.options=options;paint(controller,Boolean(controller.view));}
  function destroy(host){const controller=instances.get(host);if(controller){clearInterval(controller.timer);document.removeEventListener('visibilitychange',controller.visibility);for(const node of controller.nodes.values())node.motion?.cancel();controller.dialog?.remove();instances.delete(host);}}
  // Expanded conversation cards are enabled only for the following 26f delivery.
  function enableDetails(host,enabled=true){const controller=instances.get(host);if(controller){controller.details=enabled;if(!enabled)controller.detailSection?.remove();else paintDetails(controller);}}
  function timeLabel(value,lang){return date(value)!==null?new Intl.DateTimeFormat(lang,{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo',hourCycle:'h23'}).format(new Date(value)):({pt:'Não registrado',en:'Not recorded',es:'Sin registro'}[lang]||'Not recorded');}
  function tokenLabel(agent,lang){return (finite(agent.tokens)&&agent.tokensExact===false?'≥ ':'')+compact(agent.tokens,lang);}
  function activityLabel(agent,words,now=Date.now()) {const last=date(agent.lastAt);return ['sleeping','unknown'].includes(agent.state)&&last!==null?words.idle+' '+Math.max(0,Math.floor((now-last)/60000))+' '+words.minutes:words[agent.state]||words.unknown;}
  function toolsOf(agent){return Array.isArray(agent.tools)?agent.tools.filter(tool=>tool&&typeof tool.name==='string'):[];}
  function agentCard(controller,agent){
    const {words,lang}=controller,card=el('article','eq-detail-card eq-'+(agent.family==='claude'?'claude':'codex')),head=el('div','eq-detail-head'),image=el('img'),name=el('strong',undefined,displayName(agent,lang)),state=el('span','eq-detail-status '+(['working','walking'].includes(agent.state)?'is-active':''),activityLabel(agent,words));image.src=imageOf(agent);image.alt='';image.width=34;image.height=34;head.append(image,name,state);card.append(head);
    card.append(el('p','eq-detail-action',taskLabel(agent,lang)));
    const meta=el('p','eq-detail-meta',(agent.model||'?')+' · '+words.effort.toLowerCase()+' '+(agent.effort||'?'));card.append(meta);
    const numbers=el('div','eq-detail-numbers');numbers.append(el('span',undefined,tokenLabel(agent,lang)+' tokens'),el('span',undefined,words.since+' '+timeLabel(agent.startedAt,lang)));card.append(numbers);
    const chips=el('div','eq-detail-chips');for(const skill of agent.skills||[])chips.append(el('span','eq-skill-chip',String(skill)));for(const tool of toolsOf(agent).slice(0,5))chips.append(el('span',undefined,toolLabel(tool,agent,lang)));if(!chips.childElementCount)chips.append(el('span','eq-no-meta',words.noTools));card.append(chips);
    const button=el('button','eq-detail-open',words.details+' ↗');button.type='button';button.addEventListener('click',()=>showAgent(controller,agent));card.append(button);return card;
  }
  function paintDetails(controller){
    const {view,words,lang}=controller;
    if(!controller.progressSection){const section=el('section','eq-progress'),heading=el('div','eq-progress-heading'),left=el('div'),title=el('h3'),percent=el('strong'),right=el('div','eq-progress-eta'),eta=el('strong'),etaLabel=el('span'),bar=el('div','eq-progress-bar'),fill=el('i'),note=el('p','eq-progress-note'),deliveries=el('div','eq-deliveries');left.append(title,percent);right.append(eta,etaLabel);heading.append(left,right);bar.append(fill);section.append(heading,bar,note,deliveries);controller.host.insertBefore(section,controller.stage);Object.assign(controller,{progressSection:section,progressTitle:title,progressPercent:percent,progressEta:eta,progressEtaLabel:etaLabel,progressBar:bar,progressFill:fill,progressNote:note,deliveries});}
    const progress=progressOf(view.source.progress||{deliveries:view.source.deliveries,startedAt:view.source.startedAt},view.now);controller.progressTitle.textContent=words.progress;controller.progressPercent.textContent=progress.percent!==null?progress.percent+'%':'?';controller.progressEta.textContent=progress.eta?timeLabel(progress.eta,lang):'?';controller.progressEtaLabel.textContent=words.estimate;controller.progressBar.hidden=progress.percent===null;controller.progressFill.style.transform='scaleX('+(progress.percent!==null?progress.percent/100:0)+')';controller.progressNote.textContent=progress.total!==null?progress.done+' / '+progress.total+' '+words.deliveries:words.unmeasured;
    controller.deliveries.replaceChildren();for(const delivery of progress.deliveries){const row=el('div','eq-delivery'+(delivery.done===true||delivery.state==='done'?' is-done':''));row.append(el('i',undefined,delivery.done===true||delivery.state==='done'?'✓':''),el('span',undefined,delivery.title||delivery.name||'?'));controller.deliveries.append(row);}
    if(!controller.detailSection){controller.detailSection=el('section','eq-team-details');controller.host.append(controller.detailSection);}controller.detailSection.replaceChildren();
    const week=view.source.weekPercent??view.source.weekPct??view.source.semanaPct;
    const guardian=view.source.guardianCount??view.source.guardian,guardianLabel=(finite(guardian)&&view.source.guardianExact===false?'≥ ':'')+compact(guardian,lang);
    const stats=el('div','eq-team-stats');for(const [value,label]of [[(view.active??'?')+' / '+(view.total??'?'),words.agents],[finite(week)?week+'%':'?',words.week],[guardianLabel,words.guardian]]){const stat=el('div');stat.append(el('strong',undefined,value),el('span',undefined,label));stats.append(stat);}controller.detailSection.append(stats);
    for(const group of view.groups){const section=el('section','eq-details-conversation'),head=el('div','eq-details-heading');head.append(el('h3',undefined,groupTitle(group,lang)),el('span',undefined,agentCount(group.agents.length,words)));const cards=el('div','eq-detail-grid');for(const agent of group.agents)cards.append(agentCard(controller,agent));section.append(head,cards);controller.detailSection.append(section);}
  }
  function showAgent(controller,agent){
    const {words,lang}=controller;if(!controller.dialog){const dialog=el('dialog','eq-dialog'),head=el('div','eq-dialog-head'),title=el('h2'),close=el('button',undefined,'×'),body=el('div','eq-dialog-body');close.type='button';close.setAttribute('aria-label','Close');close.addEventListener('click',()=>dialog.close());dialog.addEventListener('keydown',event=>{if(event.key==='Tab'){event.preventDefault();close.focus();}});title.id=controller.id+'-agent';dialog.setAttribute('aria-labelledby',title.id);head.append(title,close);dialog.append(head,body);document.body.append(dialog);Object.assign(controller,{dialog,dialogTitle:title,dialogBody:body});}
    controller.dialog.querySelector('.eq-dialog-head button').setAttribute('aria-label',({pt:'Fechar',en:'Close',es:'Cerrar'}[lang]));controller.dialogTitle.textContent=agent.cardName||controller.options.mode==='home'&&controller.homeNames?.get(agent.id)||displayName(agent,lang);const body=controller.dialogBody;body.replaceChildren();body.append(el('p','eq-dialog-action',taskLabel(agent,lang)));
    const human=scope.PainelLinguagem,missing=value=>!value||value==='?'||value==='Não medido';
    const facts=[[words.conversation,human?.title(agent.conversationLabels?.[lang]||agent.conversation,lang)],[words.project,human?.title(agent.project||agent.projectName,lang)],[words.model,human?.model(agent.model)],[words.effort,human?.effort(agent.effort,lang)],['Tokens',finite(agent.tokens)?tokenLabel(agent,lang):null],[words.since,human?.relative(agent.startedAt,lang)],[words.now,human?.relative(agent.lastAt,lang)],[( {pt:'Entrega',en:'Delivery',es:'Entrega'}[lang]),agent.delivery?.etaAt||agent.delivery?.completedAt?deliveryLabel(agent.delivery,lang).eta:null]];
    const meta=el('dl','eq-agent-facts');for(const [label,value]of facts){if(missing(value))continue;meta.append(el('dt',undefined,label),el('dd',undefined,human?.text(value,lang)||value));}body.append(meta);
    const tools=toolsOf(agent).slice(0,3);if(tools.length){const block=el('section','eq-dialog-list');block.append(el('h3',undefined,words.tools));for(const tool of tools){const value=localizedTool(tool,lang),count=finite(tool.count)?' '+(tool.exact===false?'≥ ':'')+tool.count:'';block.append(el('p',undefined,value+count));}body.append(block);}
    const skills=(agent.skills||[]).slice(0,3);if(skills.length){const block=el('section','eq-dialog-list');block.append(el('h3',undefined,words.skills));for(const skill of skills)block.append(el('p',undefined,human?.text(skill,lang)||skill));body.append(block);}
    if(agent.agente?.verified&&agent.agente.id)controller.dialogTitle.title='Agente #'+agent.agente.id;
    if(agent.model)meta.title=agent.model;
    if(!controller.dialog.open)controller.dialog.showModal();
  }
  const api={render,openAgent(agent,host){const c=instances.get(host);if(c)showAgent(c,agent);},destroy,enableDetails,normalize,stateOf,short,compact,deliveryLabel,imageOf,cupLevels,progressOf,toolLabel,displayName,taskLabel,groupTitle,homeAgents,homeFronts,homeNames,homeDelivered,teamFronts,nameRole,distinctNames,cardTime,portraitPool,distinctPortraits,activeAgent,stableOrder,forecastTip,SLEEP_AFTER};if(typeof module!=='undefined'&&module.exports)module.exports=api;if(scope)scope.PainelEquipe=api;
})(typeof window!=='undefined'?window:globalThis);
