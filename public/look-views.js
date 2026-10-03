(function(root){
  'use strict';
  // Today's look for Sessions (side by side, metadata only) and Usage (one summary line, big total, cups, credit rings).
  const ORDER={working:0,recent:1,waiting:2,resting:3};
  const W={
    en:{sessionsTitle:'Sessions side by side',sessionsNote:'Each column is one session. Metadata only: the panel does not read or send messages.',all:'All projects',now:'Now',startedBy:'Started by',tools:'Tools',model:'Model',tokens:'Tokens',project:'Project',noAction:'No action read',openApp:'To read or reply, open your AI app.',empty:'No sessions in this reading.',more:(shown,total)=>'Showing '+shown+' of '+total+' sessions.',state:{working:'Working',recent:'Recent',waiting:'Waiting for you',resting:'Paused'},
      usageTitle:'Usage',eyebrow:'USAGE',weekTokens:'tokens in the last 7 recorded days · UTC',breakdown:(c,x,t)=>'Claude Code '+c+' · Codex '+x+' · today '+t,water:'Playful water estimate · 7 days',cups:'Water in cups, 7 days',how:'How we calculate',credit:'CREDIT',weekUsed:'week used',used:p=>p+' used',resets:d=>'Resets '+d+' UTC',read:r=>'Read '+r,older:'Older reading',unread:'Reading unavailable: this session history does not include the plan percentage.',app:{claude:'See it in the Claude app',codex:'See it in the Codex app'},deliveries:'Deliveries recorded today',notConnected:'Task folder not connected.',connect:'Connect my task folder',noneToday:'No task has a dated completion today.',
      summary:(total,parts)=>'This week: '+total+' tokens · credit used: '+parts,first:'Totals appear when the first reading finishes.',
      howText:['Tokens: input, output and cached input from the sessions read on this computer. Claude Code counts by UTC day; Codex reports a running total per session.','Week: the last 7 recorded days, in UTC. Days before the first reading are not rebuilt.','Large sessions: only their opening and recent parts are read, so a total can be partial; the ≥ sign marks that.','Water: a playful estimate, not a measurement. (Fresh input + output + 10% of cached input) ÷ 1,500 × 0.3 ml. One cup is 250 ml.','Credit: the plan percentage found in the session metadata, when present. It resets at the time shown, in UTC.','Nothing here leaves this computer.']},
    pt:{sessionsTitle:'Sessões lado a lado',sessionsNote:'Cada coluna é uma sessão. Só metadados: o painel não lê nem manda mensagens.',all:'Todos os projetos',now:'Agora',startedBy:'Iniciada por',tools:'Ferramentas',model:'Modelo',tokens:'Tokens',project:'Projeto',noAction:'Nenhuma ação lida',openApp:'Para ler ou responder, abra o app da sua IA.',empty:'Nenhuma sessão nesta leitura.',more:(shown,total)=>'Mostrando '+shown+' de '+total+' sessões.',state:{working:'Trabalhando',recent:'Recente',waiting:'Esperando você',resting:'Em pausa'},
      usageTitle:'Consumo',eyebrow:'CONSUMO',weekTokens:'tokens nos últimos 7 dias registrados · UTC',breakdown:(c,x,t)=>'Claude Code '+c+' · Codex '+x+' · hoje '+t,water:'Estimativa lúdica de água · 7 dias',cups:'Água em copos, 7 dias',how:'Como calculamos',credit:'CRÉDITO',weekUsed:'semana usada',used:p=>p+' usadas',resets:d=>'Zera '+d+' UTC',read:r=>'Leitura '+r,older:'Leitura antiga',unread:'Leitura indisponível: este histórico de sessões não traz a porcentagem do plano.',app:{claude:'Veja no app do Claude',codex:'Veja no app do Codex'},deliveries:'Entregas registradas hoje',notConnected:'Pasta de tarefas não conectada.',connect:'Ligar minha pasta de tarefas',noneToday:'Nenhuma tarefa com conclusão datada hoje.',
      summary:(total,parts)=>'Esta semana: '+total+' tokens · crédito usado: '+parts,first:'Os totais aparecem quando a primeira leitura terminar.',
      howText:['Tokens: entrada, saída e entrada em cache das sessões lidas neste computador. O Claude Code conta por dia UTC; o Codex informa um total acumulado por sessão.','Semana: os últimos 7 dias registrados, em UTC. Dias antes da primeira leitura não são refeitos.','Sessões grandes: só o começo e o trecho recente são lidos, então um total pode ser parcial; o sinal ≥ marca isso.','Água: uma estimativa lúdica, não uma medição. (Entrada nova + saída + 10% da entrada em cache) ÷ 1.500 × 0,3 ml. Cada copo vale 250 ml.','Crédito: a porcentagem do plano encontrada nos metadados da sessão, quando existe. Zera na hora mostrada, em UTC.','Nada daqui sai deste computador.']},
    es:{sessionsTitle:'Sesiones lado a lado',sessionsNote:'Cada columna es una sesión. Solo metadatos: el panel no lee ni envía mensajes.',all:'Todos los proyectos',now:'Ahora',startedBy:'Iniciada por',tools:'Herramientas',model:'Modelo',tokens:'Tokens',project:'Proyecto',noAction:'Ninguna acción leída',openApp:'Para leer o responder, abre la app de tu IA.',empty:'Ninguna sesión en esta lectura.',more:(shown,total)=>'Se muestran '+shown+' de '+total+' sesiones.',state:{working:'Trabajando',recent:'Reciente',waiting:'Esperándote',resting:'En pausa'},
      usageTitle:'Uso',eyebrow:'USO',weekTokens:'tokens en los últimos 7 días registrados · UTC',breakdown:(c,x,t)=>'Claude Code '+c+' · Codex '+x+' · hoy '+t,water:'Estimación ilustrativa de agua · 7 días',cups:'Agua en vasos, 7 días',how:'Cómo lo calculamos',credit:'CRÉDITO',weekUsed:'semana usada',used:p=>p+' usadas',resets:d=>'Se renueva '+d+' UTC',read:r=>'Lectura '+r,older:'Lectura antigua',unread:'Lectura no disponible: este historial de sesiones no incluye el porcentaje del plan.',app:{claude:'Ver en la app de Claude',codex:'Ver en la app de Codex'},deliveries:'Entregas registradas hoy',notConnected:'Carpeta de tareas sin conectar.',connect:'Conectar mi carpeta de tareas',noneToday:'Ninguna tarea tiene una finalización fechada hoy.',
      summary:(total,parts)=>'Esta semana: '+total+' tokens · crédito usado: '+parts,first:'Los totales aparecen cuando termina la primera lectura.',
      howText:['Tokens: entrada, salida y entrada en caché de las sesiones leídas en este ordenador. Claude Code cuenta por día UTC; Codex informa un total acumulado por sesión.','Semana: los últimos 7 días registrados, en UTC. Los días anteriores a la primera lectura no se reconstruyen.','Sesiones grandes: solo se leen el inicio y la parte reciente, así que un total puede ser parcial; el signo ≥ lo indica.','Agua: una estimación ilustrativa, no una medición. (Entrada nueva + salida + 10% de la entrada en caché) ÷ 1.500 × 0,3 ml. Cada vaso equivale a 250 ml.','Crédito: el porcentaje del plan que aparece en los metadatos de la sesión, cuando existe. Se renueva a la hora indicada, en UTC.','Nada de esto sale de este ordenador.']}
  };
  const lingua=value=>Object.prototype.hasOwnProperty.call(W,value)?value:'en';
  const finite=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
  function lastAt(a){const at=[a?.activityAt,a?.updated,a?.lastActivity].map(x=>Date.parse(x)).filter(Number.isFinite);return at.length?Math.max(...at):null;}
  function order(list){return [...(list||[])].sort((a,b)=>(ORDER[a.state]??3)-(ORDER[b.state]??3)||(lastAt(b)??0)-(lastAt(a)??0));}
  function toolsLine(tools,max=3){return (tools||[]).filter(t=>t&&typeof t.name==='string'&&finite(t.count)&&t.count>0).sort((a,b)=>b.count-a.count).slice(0,max).map(t=>t.name+' ×'+t.count).join(' · ');}
  function weekTotal(usage){const week=(usage?.periods||[]).find(p=>p.key==='week');if(!week)return null;const parts=[week.claude,week.codex].filter(finite);return parts.length?parts.reduce((n,x)=>n+x,0):null;}
  function periodLabel(q,lang){const t=W[lingua(lang)];if(!q?.available)return t.weekUsed;if(q.minutes===10080)return t.weekUsed;return t.used(q.minutes%60===0?q.minutes/60+' h':q.minutes+' min');}
  function summary(usage,credit,lang,compact){
    const t=W[lingua(lang)];if(!usage||usage.ready===false)return t.first;
    const total=weekTotal(usage),parts=['claude','codex'].map(key=>{const q=credit(key),name=key==='claude'?'Claude Code':'Codex';return name+' '+(q?.available?Math.max(0,Math.min(100,100-q.remaining))+'%':'?');}).join(', ');
    return t.summary((usage.sampled&&total!==null?'≥ ':'')+(total===null?'?':compact(total)),parts);
  }
  function ring(used){const c=2*Math.PI*26;if(!finite(used))return {dash:0,gap:c,c};const v=Math.max(0,Math.min(100,used));return {dash:c*v/100,gap:c*(1-v/100),c};}
  function waterText(ml,lang){if(!finite(ml))return '?';const fmt=new Intl.NumberFormat(lang==='pt'?'pt-BR':lang==='es'?'es-ES':'en-US',{maximumFractionDigits:ml<100?0:1});return ml<100?'~'+fmt.format(ml)+' ml':'~'+fmt.format(ml/1000)+' L';}
  const api={W,lingua,order,toolsLine,weekTotal,summary,ring,waterText,periodLabel};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(!root.document||!root.PanelV2)return;
  const d=root.document,$=id=>d.getElementById(id),P=root.PanelV2,NS='http://www.w3.org/2000/svg';
  let snapshot=null,lang=lingua(new URLSearchParams(root.location.search).get('lang')||d.documentElement.lang||'en'),project='';
  const t=()=>W[lingua(lang)];
  function el(tag,value,cls){const n=d.createElement(tag);if(value!==undefined&&value!==null)n.textContent=value;if(cls)n.className=cls;return n;}
  const H=()=>root.PanelHuman,compact=v=>H()?.compact?.(v,lingua(lang))||String(v);
  const relative=ms=>Number.isFinite(ms)?(H()?.relative?.(new Date(ms).toISOString(),lingua(lang))||''):'';
  const name=a=>(lang==='pt'&&a.titlePT)||(lang==='es'&&a.titleES)||a.title||a.taskTitle||a.projectName||'?';
  const action=a=>{const v=lang==='pt'?a.actionPT:lang==='es'?a.actionES||a.action:a.action;return root.PanelLocale?.action?.(v,lang)??v;};
  const projectOf=a=>(lang==='pt'&&a.projectNamePT)||(lang==='es'&&a.projectNameES)||a.projectName||'';

  // Sessions side by side
  const sessions=el('section',undefined,'look-sessions');sessions.id='look-sessions';
  const sHead=el('div',undefined,'look-view-head'),sTitle=el('h2','','look-view-title'),sNote=el('p','','look-view-note'),chips=el('div',undefined,'look-chips'),cols=el('div',undefined,'look-cols'),sFoot=el('p','','look-view-note');
  cols.tabIndex=0;cols.setAttribute('role','list');const sText=el('div',undefined,'look-view-text');sText.append(sTitle,sNote);sHead.append(sText);sessions.append(sHead,chips,cols,sFoot);
  $('view-projects')?.prepend(sessions);
  function tile(label,value,cls){const n=el('div',undefined,'look-tile'+(cls?' '+cls:''));n.append(el('span',label,'look-tile-label'),el('span',value,'look-tile-value'));return n;}
  function drawSessions(){
    const w=t(),all=snapshot&&root.PanelCore?.agents?root.PanelCore.agents(snapshot):[],graph=root.PanelR9?.hierarchy?root.PanelR9.hierarchy(all):null;
    sTitle.textContent=w.sessionsTitle;sNote.textContent=w.sessionsNote;cols.setAttribute('aria-label',w.sessionsTitle);
    const projects=[...new Set(all.map(projectOf).filter(Boolean))].slice(0,8);if(project&&!projects.includes(project))project='';
    chips.replaceChildren();chips.hidden=projects.length<2;
    for(const value of ['',...projects]){const b=el('button',value||w.all,'look-chip-btn');b.type='button';b.setAttribute('aria-pressed',String(project===value));b.onclick=()=>{project=value;drawSessions();};chips.append(b);}
    const list=order(all.filter(a=>!project||projectOf(a)===project)),shown=list.slice(0,30);
    cols.replaceChildren();
    if(!list.length){cols.append(el('p',w.empty,'look-empty'));sFoot.textContent='';return;}
    for(const a of shown){
      const family=a.agent==='claude'?'claude':'codex',state=ORDER[a.state]!==undefined?a.state:'resting',col=el('article',undefined,'look-col');col.dataset.family=family;col.dataset.state=state;col.setAttribute('role','listitem');col.setAttribute('aria-label',name(a));
      const head=el('div',undefined,'look-col-head'),dot=el('span',undefined,'look-dot');dot.dataset.state=state==='working'||state==='recent'?'on':state==='waiting'?'waiting':'off';
      head.append(dot,el('strong',name(a),'look-col-name'),el('span',family==='claude'?'CLAUDE CODE':'CODEX','look-col-chip'));
      const when=lastAt(a),status=el('p',w.state[state]+(when&&state!=='waiting'?' · '+relative(when):''),'look-col-status');
      const body=el('div',undefined,'look-col-body');
      body.append(tile(w.now+(when?' · '+relative(when):''),action(a)||w.noAction,'look-tile-now'));
      const parentId=graph?.edges?.get(a.id),parent=parentId?all.find(x=>x.id===parentId):null;if(parent)body.append(tile(w.startedBy,name(parent)));
      const tools=toolsLine(a.tools);if(tools)body.append(tile(w.tools,tools));
      if(a.model)body.append(tile(w.model,a.model+(a.effort?' · '+(H()?.effort?.(a.effort,lingua(lang))||a.effort):'')));
      body.append(tile(w.tokens,finite(a.tokens)?compact(a.tokens):'?'));
      if(projectOf(a))body.append(tile(w.project,projectOf(a)));
      const foot=el('div',undefined,'look-col-foot'),tl=el('button',(root.PanelLookTeam?.W?.[lingua(lang)]?.tl?.open)||'Timeline','look-col-timeline');tl.type='button';tl.onclick=()=>root.PanelLookTeam?.openTimeline?.(a.id);foot.append(el('span',w.openApp),tl);col.append(head,status,body,foot);cols.append(col);
    }
    sFoot.textContent=list.length>shown.length?w.more(shown.length,list.length):'';
  }

  // Usage
  const usage=el('section',undefined,'look-usage');usage.id='look-usage';
  const uHead=el('div',undefined,'look-view-head look-usage-head'),uTitle=el('h2','','look-view-title'),uSummary=el('p','','look-usage-summary');
  const total=el('section',undefined,'look-total'),tLeft=el('div',undefined,'look-total-left'),tEyebrow=el('span','','look-eyebrow'),tBig=el('strong','','look-big'),tLabel=el('span','','look-total-label'),tBreak=el('p','','look-total-break');
  const tCups=el('div',undefined,'look-cups'),tRight=el('div',undefined,'look-total-right'),tWater=el('strong','','look-water'),tWaterLabel=el('span','','look-total-label'),how=el('button','','look-how');
  how.type='button';how.onclick=()=>{const w=t();root.panelDrawer(w.how,w.howText.map(line=>el('p',line,'summary-note')));};
  tLeft.append(tEyebrow,tBig,tLabel,tBreak);tRight.append(tWater,tWaterLabel,how);total.append(tLeft,tCups,tRight);
  const cTitle=el('h3','','look-section-title'),cGrid=el('div',undefined,'look-credit-grid'),deliveries=el('section',undefined,'look-deliveries');
  const uText=el('div',undefined,'look-view-text');uText.append(uTitle);uHead.append(uText);usage.append(uHead,uSummary,total,cTitle,cGrid,deliveries);
  const view=$('view-usage');if(view){view.prepend(usage);const daily=$('daily');if(daily)uHead.append(daily);}
  function ringSvg(used,family){const r=ring(used),svg=d.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 64 64');svg.setAttribute('class','look-ring');svg.setAttribute('aria-hidden','true');
    const track=d.createElementNS(NS,'circle'),arc=d.createElementNS(NS,'circle');for(const c of [track,arc]){c.setAttribute('cx','32');c.setAttribute('cy','32');c.setAttribute('r','26');c.setAttribute('fill','none');c.setAttribute('stroke-width','6');}
    track.setAttribute('class','look-ring-track');arc.setAttribute('class','look-ring-arc');arc.dataset.family=family;arc.setAttribute('stroke-dasharray',r.dash+' '+r.gap);arc.setAttribute('transform','rotate(-90 32 32)');arc.setAttribute('stroke-linecap',r.dash>0?'round':'butt');svg.append(track,arc);return svg;}
  function drawUsage(){
    const w=t(),u=snapshot?.usage,credit=key=>root.PanelR9?.credit?.(u,key);
    uTitle.textContent=w.usageTitle;uSummary.textContent=snapshot?summary(snapshot.example?{...u,ready:true}:u,credit,lang,compact):w.first;
    const ready=!!snapshot&&(snapshot.example||u?.ready!==false),week=(u?.periods||[]).find(p=>p.key==='week'),today=(u?.periods||[]).find(p=>p.key==='today'),sum=ready?weekTotal(u):null;
    tEyebrow.textContent=w.eyebrow;tBig.textContent=(u?.sampled&&sum!==null?'≥ ':'')+(sum===null?'?':compact(sum));tLabel.textContent=w.weekTokens;
    const part=v=>finite(v)?compact(v):'?',todaySum=today&&[today.claude,today.codex].some(finite)?[today.claude,today.codex].filter(finite).reduce((n,x)=>n+x,0):null;
    tBreak.textContent=ready?w.breakdown(part(week?.claude),part(week?.codex),part(todaySum)):'';
    const ml=ready&&finite(week?.weightedTokens)?week.weightedTokens/1500*.3:null;tWater.textContent=waterText(ml,lang);tWaterLabel.textContent=w.water;how.textContent=w.how;
    tCups.replaceChildren();tCups.setAttribute('role','img');tCups.setAttribute('aria-label',w.cups+': '+waterText(ml,lang));
    const levels=root.PanelCore?.cups?root.PanelCore.cups(ml):[];if(levels.length)while(levels.length<8)levels.push(0);for(const level of levels){const cup=el('span',undefined,'look-cup'),fill=el('i');cup.dataset.empty=String(level<=0);fill.style.setProperty('--level',Math.round(level*100)+'%');cup.append(fill);tCups.append(cup);}
    cTitle.textContent=w.credit;cGrid.replaceChildren();
    for(const key of ['claude','codex']){
      const q=credit(key),used=q?.available?Math.max(0,Math.min(100,100-q.remaining)):null,card=el('section',undefined,'look-credit'),ringBox=el('div',undefined,'look-ring-box'),text=el('div',undefined,'look-credit-text');
      card.dataset.family=key;ringBox.append(ringSvg(used,key),el('span',used===null?'?':used+'%','look-ring-value'));
      const title=el('p',undefined,'look-credit-title');title.append(el('strong',key==='claude'?'Claude Code':'Codex'),d.createTextNode(' · '+periodLabel(q,lang)));text.append(title);
      if(q?.available){const reset=new Date(q.reset).toLocaleString(lingua(lang)==='pt'?'pt-BR':lingua(lang)==='es'?'es-ES':'en-US',{day:'numeric',month:lang==='en'?'short':'long',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'});text.append(el('p',w.resets(reset),'look-credit-line'));const readAt=Date.parse(q.readAt);text.append(el('p',q.stale?w.older:Number.isFinite(readAt)?w.read(relative(readAt)):'','look-credit-read'));}
      else{text.append(el('p',w.unread,'look-credit-line'));const a=el('a',w.app[key],'look-credit-link');a.href=key==='claude'?'https://claude.ai/':'https://chatgpt.com/codex';a.target='_blank';a.rel='noopener noreferrer';text.append(a);}
      card.append(ringBox,text);cGrid.append(card);
    }
    deliveries.replaceChildren(el('h3',w.deliveries,'look-section-title look-small-title'));
    const linked=!!(snapshot?.example||snapshot?.deliveries?.connected),done=snapshot?.example?[...(snapshot.tasks||[]),...(snapshot.queue||[])].filter(x=>(x.phase?.percent??x.percent)===100):snapshot?.deliveries?.items||[];
    if(!snapshot){deliveries.append(el('p','?','look-credit-line'));}
    else if(!linked){deliveries.append(el('p',w.notConnected,'look-credit-line'));const b=el('button',w.connect,'look-link');b.type='button';b.onclick=()=>root.PanelR4?.connect?.();deliveries.append(b);}
    else{deliveries.append(el('strong',String(done.length),'look-deliveries-n'));if(done.length){const ul=el('ul',undefined,'look-deliveries-list');for(const item of done.slice(0,3))ul.append(el('li',(lang==='pt'&&item.titlePT)||(lang==='es'&&item.titleES)||item.title));deliveries.append(ul);}else deliveries.append(el('p',w.noneToday,'look-credit-line'));}
  }
  function draw(){drawSessions();drawUsage();}
  const render=P.render.bind(P),select=P.select.bind(P),loading=P.loading.bind(P),failure=P.failure.bind(P);
  P.render=(data,locale)=>{snapshot=data;lang=lingua(locale||lang);render(data,locale);draw();};
  P.select=(value,focus)=>{select(value,focus);if(value==='projects'||value==='usage')draw();};
  P.loading=locale=>{lang=lingua(locale||lang);loading(locale);draw();};
  P.failure=()=>{failure();draw();};
  root.PanelLookViews=Object.freeze({...api,draw});
  const cached=P.state?.();if(cached?.snapshot){snapshot=cached.snapshot;lang=lingua(cached.locale||lang);}
  draw();
})(typeof window==='object'?window:globalThis);
