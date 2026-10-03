(function(root){
  'use strict';
  // Team: you on top, Claude Code and Codex side by side, sessions and known helpers from parent ids.
  // Wires carry particles in the direction of who sent, in the sender's color. Metadata only.
  const FAMILIES=['claude','codex'];
  const NAMES={claude:'Claude Code',codex:'Codex'};
  const W={
    en:{tl:{started:'Started',by:p=>'by '+p,direct:ai=>'directly in '+ai+' · no parent session',outside:'by a session outside this reading',model:'Model and effort',helper:'Started a helper',tools:'Tools used',steps:n=>n===1?'1 step':n+' steps',noneRead:'none read',last:'Last activity',finished:'Finished',working:'Working now',recent:'Recent activity',waiting:'Waiting for you',paused:'Paused',open:'Timeline',edge:(a,b,what)=>a+' → '+b+' · '+what},title:'Team',note:'Who started what, from session metadata. Pink is you, orange is Claude Code, blue is Codex.',you:'You',sessions:n=>n===1?'1 session':n+' sessions',none:'No sessions in this reading',state:{working:'working',recent:'recent',waiting:'waiting for you',resting:'paused',finished:'finished'},
      legend:{work:'work sent',question:'waiting for you',reply:'reply returned',idle:'no recent activity'},hint:'Scroll sideways to see the whole team.',counts:(p,f)=>'Paused: '+p+' · Ended: '+f,noneWord:'none',
      wireLabel:(a,b,what)=>a+' to '+b+': '+what,kind:{work:'work sent',question:'waiting for you',reply:'reply returned',idle:'no recent activity'},
      youHub:(ai,n,active)=>'You work with '+ai+' in '+n+(n===1?' session':' sessions')+' in this reading; '+(active===0?'none':active)+' active now.',
      started:(from,to,ai)=>from+' started '+to+(ai?' in '+ai:'')+'.',helper:(from,to)=>from+' started '+to+' as a helper.',
      now:(to,state,action)=>to+' is '+state+(action?': '+action:'')+'.',last:when=>'Last activity '+when+'.',
      reply:(from,to)=>from+' finished and returned to '+to+'.',question:from=>from+' is waiting for your answer.',idle:(a,b)=>'No recent activity between '+a+' and '+b+'.',
      source:'From session metadata only: times, parent link, state, model, tool names and counts. No message text is read.',ai:'AI',model:'Model',tools:'Tools',tokens:'Tokens',project:'Project'},
    pt:{tl:{started:'Início',by:p=>'por '+p,direct:ai=>'direto no '+ai+' · sem sessão de origem',outside:'por uma sessão fora desta leitura',model:'Modelo e esforço',helper:'Começou um ajudante',tools:'Ferramentas usadas',steps:n=>n===1?'1 passo':n+' passos',noneRead:'nenhuma lida',last:'Última atividade',finished:'Concluída',working:'Trabalhando agora',recent:'Atividade recente',waiting:'Esperando você',paused:'Em pausa',open:'Linha do tempo',edge:(a,b,what)=>a+' → '+b+' · '+what},title:'Equipe',note:'Quem começou o quê, pelos metadados das sessões. Rosa é você, laranja é o Claude Code, azul é o Codex.',you:'Você',sessions:n=>n===1?'1 sessão':n+' sessões',none:'Nenhuma sessão nesta leitura',state:{working:'trabalhando',recent:'recente',waiting:'esperando você',resting:'em pausa',finished:'concluída'},
      legend:{work:'trabalho enviado',question:'esperando você',reply:'resposta devolvida',idle:'sem atividade recente'},hint:'Role para o lado para ver a equipe inteira.',counts:(p,f)=>'Em pausa: '+p+' · Encerradas: '+f,noneWord:'nenhuma',
      wireLabel:(a,b,what)=>a+' para '+b+': '+what,kind:{work:'trabalho enviado',question:'esperando você',reply:'resposta devolvida',idle:'sem atividade recente'},
      youHub:(ai,n,active)=>'Você trabalha com o '+ai+' em '+n+(n===1?' sessão':' sessões')+' nesta leitura; '+(active===0?'nenhuma':active)+' ativa'+(active>1?'s':'')+' agora.',
      started:(from,to,ai)=>from+' começou '+to+(ai?' no '+ai:'')+'.',helper:(from,to)=>from+' começou '+to+' como ajudante.',
      now:(to,state,action)=>to+' está '+state+(action?': '+action:'')+'.',last:when=>'Última atividade '+when+'.',
      reply:(from,to)=>from+' terminou e devolveu para '+to+'.',question:from=>from+' está esperando a sua resposta.',idle:(a,b)=>'Sem atividade recente entre '+a+' e '+b+'.',
      source:'Só dos metadados das sessões: horários, vínculo de origem, estado, modelo, nomes e contagens de ferramentas. Nenhum texto de mensagem é lido.',ai:'IA',model:'Modelo',tools:'Ferramentas',tokens:'Tokens',project:'Projeto'},
    es:{tl:{started:'Inicio',by:p=>'por '+p,direct:ai=>'directamente en '+ai+' · sin sesión de origen',outside:'por una sesión fuera de esta lectura',model:'Modelo',helper:'Empezó un ayudante',tools:'Herramientas usadas',steps:n=>n===1?'1 paso':n+' pasos',noneRead:'ninguna leída',last:'Última actividad',finished:'Terminada',working:'Trabajando ahora',recent:'Actividad reciente',waiting:'Esperándote',paused:'En pausa',open:'Línea de tiempo',edge:(a,b,what)=>a+' → '+b+' · '+what},title:'Equipo',note:'Quién empezó qué, según los metadatos de las sesiones. Rosa eres tú, naranja es Claude Code, azul es Codex.',you:'Tú',sessions:n=>n===1?'1 sesión':n+' sesiones',none:'Ninguna sesión en esta lectura',state:{working:'trabajando',recent:'reciente',waiting:'esperándote',resting:'en pausa',finished:'terminada'},
      legend:{work:'trabajo enviado',question:'esperándote',reply:'respuesta devuelta',idle:'sin actividad reciente'},hint:'Desplázate de lado para ver todo el equipo.',counts:(p,f)=>'En pausa: '+p+' · Terminadas: '+f,noneWord:'ninguna',
      wireLabel:(a,b,what)=>a+' a '+b+': '+what,kind:{work:'trabajo enviado',question:'esperándote',reply:'respuesta devuelta',idle:'sin actividad reciente'},
      youHub:(ai,n,active)=>'Trabajas con '+ai+' en '+n+(n===1?' sesión':' sesiones')+' en esta lectura; '+(active===0?'ninguna':active)+' activa'+(active>1?'s':'')+' ahora.',
      started:(from,to,ai)=>from+' empezó '+to+(ai?' en '+ai:'')+'.',helper:(from,to)=>from+' empezó '+to+' como ayudante.',
      now:(to,state,action)=>to+' está '+state+(action?': '+action:'')+'.',last:when=>'Última actividad '+when+'.',
      reply:(from,to)=>from+' terminó y devolvió a '+to+'.',question:from=>from+' está esperando tu respuesta.',idle:(a,b)=>'Sin actividad reciente entre '+a+' y '+b+'.',
      source:'Solo de los metadatos de las sesiones: horas, vínculo de origen, estado, modelo, nombres y recuentos de herramientas. No se lee ningún texto de mensaje.',ai:'IA',model:'Modelo',tools:'Herramientas',tokens:'Tokens',project:'Proyecto'}
  };
  const lingua=value=>Object.prototype.hasOwnProperty.call(W,value)?value:'en';
  const family=a=>a?.agent==='claude'?'claude':'codex';
  function lastAt(a){const at=[a?.activityAt,a?.updated,a?.finishedAt,a?.startedAt].map(x=>Date.parse(x)).filter(Number.isFinite);return at.length?Math.max(...at):null;}
  function level(a,now){
    // 0 idle, 1 recent, 2 working, 3 working in the last two minutes
    const at=lastAt(a),age=Number.isFinite(at)?now-at:null;
    if(a?.state==='working'||a?.state==='waiting')return age!==null&&age<120000?3:2;
    if(a?.state==='recent')return 1;
    if(a?.state==='finished'&&age!==null&&age<600000)return 1;
    return 0;
  }
  function kindOf(a,now){if(a?.state==='waiting')return 'question';if(a?.state==='finished'&&level(a,now))return 'reply';return level(a,now)?'work':'idle';}
  function graph(sessions,parentOf,now=Date.now()){
    const list=(sessions||[]).filter(a=>a&&a.id),byId=new Map(list.map(a=>[a.id,a]));
    const depth=new Map();const depthOf=a=>{if(depth.has(a.id))return depth.get(a.id);let d=0,cursor=a;const seen=new Set();while(cursor&&!seen.has(cursor.id)){seen.add(cursor.id);const p=byId.get(parentOf(cursor.id));if(!p)break;d++;cursor=p;}depth.set(a.id,d);return d;};
    const nodes=[{id:'you',type:'you'},...FAMILIES.map(f=>({id:'hub-'+f,type:'hub',family:f,count:list.filter(a=>family(a)===f).length,active:list.filter(a=>family(a)===f&&level(a,now)>=2).length}))];
    for(const a of list)nodes.push({id:a.id,type:'session',family:family(a),depth:depthOf(a),parent:byId.has(parentOf(a.id))?parentOf(a.id):null,session:a});
    const edges=[];
    for(const f of FAMILIES){const hub=nodes.find(n=>n.id==='hub-'+f),mine=list.filter(a=>family(a)===f),top=Math.max(0,...mine.map(a=>level(a,now))),asks=mine.some(a=>a.state==='waiting');edges.push({id:'you>hub-'+f,from:'you',to:'hub-'+f,kind:asks?'question':top?'work':'idle',level:asks?Math.max(1,top):top,sender:asks?f:'you',family:f,count:hub.count,active:hub.active});}
    for(const n of nodes.filter(n=>n.type==='session')){
      const a=n.session,k=kindOf(a,now),lv=level(a,now);
      if(n.parent){const p=byId.get(n.parent);edges.push({id:n.parent+'>'+n.id,from:n.parent,to:n.id,kind:k,level:lv,sender:k==='work'?family(p):family(a),helper:true});}
      else edges.push({id:'hub-'+n.family+'>'+n.id,from:'hub-'+n.family,to:n.id,kind:k,level:lv,sender:k==='work'?'you':n.family,helper:false});
    }
    return {nodes,edges};
  }
  function layout(g,{nodeW=212,nodeH=68,gapX=20,rowGap=52,colGap=64,pad=24,maxWidth=null,stacked=false}={}){
    if(Number.isFinite(maxWidth))return fittedLayout(g,{nodeW,nodeH,gapX,rowGap,colGap,pad,maxWidth,stacked});
    const sessions=g.nodes.filter(n=>n.type==='session'),maxDepth=Math.max(-1,...sessions.map(n=>n.depth)),pos=new Map();
    const levels={claude:[],codex:[]};for(const n of sessions)(levels[n.family][n.depth]||(levels[n.family][n.depth]=[])).push(n);
    const colW={};for(const f of FAMILIES)colW[f]=Math.max(nodeW,...Array.from(levels[f],l=>l?l.length*(nodeW+gapX)-gapX:0));
    const colX={claude:pad,codex:pad+colW.claude+colGap},width=pad*2+colW.claude+colGap+colW.codex,rowY=r=>pad+r*(nodeH+rowGap);
    pos.set('you',{x:width/2-nodeW/2,y:rowY(0),w:nodeW,h:nodeH});
    for(const f of FAMILIES)pos.set('hub-'+f,{x:colX[f]+colW[f]/2-nodeW/2,y:rowY(1),w:nodeW,h:nodeH});
    const rank={working:0,waiting:1,recent:2,resting:3,finished:4};
    for(let d=0;d<=maxDepth;d++)for(const f of FAMILIES){
      const row=(levels[f][d]||[]).slice().sort((a,b)=>{const posA=pos.get(a.parent),posB=pos.get(b.parent);return (posA?posA.x:0)-(posB?posB.x:0)||(rank[a.session.state]??3)-(rank[b.session.state]??3);});
      const span=row.length*(nodeW+gapX)-gapX,start=colX[f]+(colW[f]-span)/2;
      row.forEach((n,i)=>pos.set(n.id,{x:start+i*(nodeW+gapX),y:rowY(2+d),w:nodeW,h:nodeH}));
    }
    return {pos,width,height:rowY(2+maxDepth+1)-rowGap+pad,colX,colW,rowY:rowY(1),nodeH};
  }
  function fittedLayout(g,{nodeW,nodeH,gapX,rowGap,colGap,pad,maxWidth,stacked}){
    const width=Math.max(maxWidth,2*pad+nodeW*(stacked?1:2)+(stacked?0:colGap)),pos=new Map(),colX={},colW={},colY={},colH={},levels={claude:[],codex:[]},step=nodeH+rowGap;
    for(const n of g.nodes.filter(n=>n.type==='session'))(levels[n.family][n.depth]||(levels[n.family][n.depth]=[])).push(n);
    for(const f of FAMILIES){colW[f]=(width-2*pad-(stacked?0:colGap))/(stacked?1:2);colX[f]=pad+(f==='codex'&&!stacked?colW.claude+colGap:0);}
    pos.set('you',{x:(width-nodeW)/2,y:pad,w:nodeW,h:nodeH});
    const rank={working:0,waiting:1,recent:2,resting:3,finished:4};
    const rowFor=(f,depth)=>(levels[f][depth]||[]).slice().sort((a,b)=>(pos.get(a.parent)?.x||0)-(pos.get(b.parent)?.x||0)||(rank[a.session.state]??3)-(rank[b.session.state]??3));
    const capacity=f=>Math.max(1,Math.floor((colW[f]+gapX)/(nodeW+gapX)));
    const place=(f,row,y)=>{const cap=capacity(f);for(let i=0;i<row.length;i++){const line=Math.floor(i/cap),count=Math.min(cap,row.length-line*cap),span=count*(nodeW+gapX)-gapX;pos.set(row[i].id,{x:colX[f]+(colW[f]-span)/2+(i%cap)*(nodeW+gapX),y:y+line*step,w:nodeW,h:nodeH});}return Math.ceil(row.length/cap);};
    let cursor=pad+step;
    const hub=f=>{colY[f]=cursor;pos.set('hub-'+f,{x:colX[f]+(colW[f]-nodeW)/2,y:cursor,w:nodeW,h:nodeH});};
    if(stacked){for(const f of FAMILIES){hub(f);cursor+=step;for(let depth=0;depth<levels[f].length;depth++)cursor+=place(f,rowFor(f,depth),cursor)*step;colH[f]=cursor-rowGap-colY[f];cursor+=pad;}}
    else{for(const f of FAMILIES)hub(f);cursor+=step;const depths=Math.max(levels.claude.length,levels.codex.length);for(let depth=0;depth<depths;depth++){let rows=0;for(const f of FAMILIES)rows=Math.max(rows,place(f,rowFor(f,depth),cursor));cursor+=rows*step;}for(const f of FAMILIES)colH[f]=cursor-rowGap-colY[f];}
    return {pos,width,height:cursor-rowGap+pad,colX,colW,colY,colH,rowY:colY.claude,nodeH,stacked};
  }
  function wire(a,b){const x1=a.x+a.w/2,y1=a.y+a.h,x2=b.x+b.w/2,y2=b.y,dy=Math.max(24,(y2-y1)/2);return {p:[[x1,y1],[x1,y1+dy],[x2,y2-dy],[x2,y2]],d:'M'+x1+' '+y1+' C'+x1+' '+(y1+dy)+' '+x2+' '+(y2-dy)+' '+x2+' '+y2};}
  function point(p,t){const u=1-t,a=u*u*u,b=3*u*u*t,c=3*u*t*t,e=t*t*t;return [a*p[0][0]+b*p[1][0]+c*p[2][0]+e*p[3][0],a*p[0][1]+b*p[1][1]+c*p[2][1]+e*p[3][1]];}
  function length(p){let n=0,prev=point(p,0);for(let i=1;i<=16;i++){const q=point(p,i/16);n+=Math.hypot(q[0]-prev[0],q[1]-prev[1]);prev=q;}return n;}
  const stampOf=v=>{const ms=Date.parse(v);return Number.isFinite(ms)?ms:null;};
  function timeline(a,{name,parentId,hasParentLink,children=[],effortWord=e=>e,actionText=()=>null},lang='en'){
    // Every entry comes from session metadata: times, parent link, state, model, tool names and counts.
    const w=W[lingua(lang)].tl,fam=family(a),ai=NAMES[fam],out=[];
    const origin=parentId?{detail:w.by(name(parentId)),actor:'parent'}:hasParentLink?{detail:w.outside,actor:fam}:{detail:w.direct(ai),actor:fam};
    out.push({key:'start',at:stampOf(a.startedAt),title:w.started,detail:origin.detail,actor:origin.actor,parent:parentId||null});
    out.push({key:'model',at:null,untimed:true,title:w.model,detail:a.model?a.model+(a.effort?' · '+effortWord(a.effort):''):'?',actor:fam});
    for(const c of children.slice().sort((x,y)=>(stampOf(x.startedAt)??Infinity)-(stampOf(y.startedAt)??Infinity)))out.push({key:'helper',at:stampOf(c.startedAt),title:w.helper,detail:name(c.id),actor:family(c),child:c.id});
    const tools=(a.tools||[]).filter(t=>t&&typeof t.name==='string'&&t.count>0).sort((x,y)=>y.count-x.count),steps=Number.isFinite(a.observedSteps)&&a.observedSteps>0?a.observedSteps:tools.reduce((n,t)=>n+t.count,0);
    out.push({key:'tools',at:null,untimed:true,title:w.tools,detail:tools.length?tools.slice(0,4).map(t=>t.name+' ×'+t.count).join(' · ')+' · '+(a.sampled?'≥ ':'')+w.steps(steps):w.noneRead,actor:fam});
    out.push({key:'last',at:stampOf(a.activityAt||a.updated),title:w.last,detail:actionText(a)||a.lastTool||'?',actor:fam});
    const state=a.state==='finished'||a.finishedAt?'finished':a.state;
    out.push({key:'end',at:state==='finished'?stampOf(a.finishedAt):null,untimed:state!=='finished'||!Number.isFinite(stampOf(a.finishedAt)),title:state==='finished'?w.finished:state==='working'?w.working:state==='recent'?w.recent:state==='waiting'?w.waiting:w.paused,detail:'',actor:fam,state});
    return out;
  }
  const PARTICLES=[0,1,3,5],SPEED=[0,36,64,84];
  const particles=lv=>PARTICLES[Math.max(0,Math.min(3,lv|0))];
  const direction=edge=>edge.kind==='question'||edge.kind==='reply'?-1:1;
  function syncOwnedAnimations(animations,pause,paused){
    for(const animation of paused)if(animation.playState==='idle'||animation.playState==='finished')paused.delete(animation);
    if(pause){for(const animation of animations)if(animation.playState==='running'){animation.pause();paused.add(animation);}}
    else{for(const animation of paused)if(animation.playState==='paused')animation.play();paused.clear();}
  }
  const api={syncOwnedAnimations,W,NAMES,FAMILIES,lingua,level,kindOf,graph,layout,wire,point,length,particles,direction,SPEED,timeline};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(!root.document||!root.PanelV2)return;

  const d=root.document,$=id=>d.getElementById(id),P=root.PanelV2,NS='http://www.w3.org/2000/svg';
  let snapshot=null,lang=lingua(new URLSearchParams(root.location.search).get('lang')||d.documentElement.lang||'en'),current=null,moving=[],frame=0,lastTime=0;
  const t=()=>W[lingua(lang)];
  const H=()=>root.PanelHuman,compact=v=>H()?.compact?.(v,lingua(lang))||String(v);
  const relative=ms=>Number.isFinite(ms)?(root.PanelLocale?.text?.(H()?.relative?.(new Date(ms).toISOString(),lingua(lang))||'',lang)||''):'';
  function el(tag,value,cls){const n=d.createElement(tag);if(value!==undefined&&value!==null)n.textContent=value;if(cls)n.className=cls;return n;}
  function svg(tag,attrs){const n=d.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs||{}))n.setAttribute(k,v);return n;}
  const nameOf=a=>(lang==='pt'&&a.titlePT)||(lang==='es'&&a.titleES)||a.title||a.taskTitle||a.projectName||'?';
  const actionOf=a=>{const v=lang==='pt'?a.actionPT:lang==='es'?a.actionES||a.action:a.action;return root.PanelLocale?.action?.(v,lang)??v;};
  const label=id=>id==='you'?t().you:id.startsWith('hub-')?NAMES[id.slice(4)]:nameOf(current.byId.get(id));
  const reduced=()=>d.documentElement.dataset.motion==='off'||!!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const color=key=>getComputedStyle(d.documentElement).getPropertyValue(key==='you'?'--who-owner':key==='claude'?'--who-claude':'--who-codex').trim()||'#ffffff';

  const section=el('section',undefined,'look-team');section.id='look-team';
  const head=el('div',undefined,'look-view-head'),text=el('div',undefined,'look-view-text'),title=el('h2','','look-view-title'),note=el('p','','look-view-note'),legend=el('div',undefined,'look-team-legend');
  text.append(title,note);head.append(text);
  const scroller=el('div',undefined,'look-graph'),inner=el('div',undefined,'look-graph-inner'),hint=el('p','','look-view-note look-team-hint'),foot=el('p','','look-view-note look-team-foot');
  scroller.tabIndex=0;scroller.append(inner);section.append(head,legend,scroller,hint,foot);
  const view=$('view-team');if(view)view.prepend(section);

  function clock(ms){if(!Number.isFinite(ms))return '?';const L=lingua(lang),dt=new Date(ms),today=new Date().toISOString().slice(0,10)===dt.toISOString().slice(0,10),fmt=dt.toLocaleString(L==='pt'?'pt-BR':L==='es'?'es-ES':'en-US',{...(today?{}:{day:'numeric',month:L==='en'?'short':'long'}),hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'})+' UTC';return fmt+' · '+relative(ms);}
  function openTimeline(id,lead){
    if(!current)draw();const a=current?.byId.get(id);if(!a)return false;const w=t(),fam=family(a),parentId=current.parentOf(id),children=current.list.filter(x=>current.parentOf(x.id)===id);
    const entries=timeline(a,{name:x=>label(x),parentId,hasParentLink:!!(a.parentKey||a.parentId),children,effortWord:e=>H()?.effort?.(e,lingua(lang))||e,actionText:actionOf},lang);
    const head=el('div',undefined,'tl-head'),ai=el('span',NAMES[fam],'tl-chip');ai.dataset.family=fam;const st=el('span',w.state[a.state==='finished'||a.finishedAt?'finished':a.state]||w.state.resting,'tl-chip tl-state');st.dataset.state=a.state||'resting';head.append(ai,st);
    const ol=el('ol',undefined,'tl');
    for(const e of entries){const li=el('li',undefined,'tl-item');li.dataset.key=e.key;li.dataset.actor=e.actor==='parent'?family(current.byId.get(e.parent)):e.actor;if(e.untimed)li.dataset.untimed='true';else if(!Number.isFinite(e.at))li.dataset.time='unknown';const dot=el('span',undefined,'tl-dot');dot.setAttribute('aria-hidden','true');const body=el('div',undefined,'tl-body');if(!e.untimed)body.append(el('span',clock(e.at),'tl-time'));body.append(el('strong',e.title,'tl-title'));if(e.detail){if(e.parent||e.child){const b=el('button',e.detail,'tl-link');b.type='button';b.onclick=()=>openTimeline(e.parent||e.child);body.append(b);}else body.append(el('span',e.detail,'tl-detail'));}li.append(dot,body);ol.append(li);}
    const nodes=[head];if(lead)nodes.push(el('p',lead,'summary-note tl-lead'));nodes.push(ol,el('p',w.source,'summary-note look-team-source'));root.panelDrawer(nameOf(a),nodes);return true;
  }
  function detail(lines,heading){root.panelDrawer(heading,[...lines.map(line=>el('p',line,'summary-note')),el('p',t().source,'summary-note look-team-source')]);}
  function edgeLines(edge){
    const w=t(),from=label(edge.from),to=label(edge.to);
    if(edge.from==='you'){const hub=current.g.nodes.find(n=>n.id===edge.to);return [w.youHub(NAMES[hub.family],hub.count,hub.active),...(edge.kind==='question'?[w.question(NAMES[hub.family])]:[])];}
    const a=current.byId.get(edge.to),when=relative(lastAt(a)),lines=[];
    lines.push(edge.helper?w.helper(from,to):w.started(w.you,to,NAMES[family(a)]));
    if(edge.kind==='question')lines.push(w.question(to));else if(edge.kind==='reply')lines.push(w.reply(to,edge.helper?from:w.you));else lines.push(w.now(to,w.state[a.state]||w.state.resting,actionOf(a)));
    if(when)lines.push(w.last(when));if(edge.kind==='idle')lines.push(w.idle(from,to));
    return lines;
  }
  function nodeLines(node){
    const w=t();if(node.type==='you')return [w.note];
    if(node.type==='hub')return [w.youHub(NAMES[node.family],node.count,node.active)];
    const a=node.session,lines=[w.now(nameOf(a),w.state[a.state]||w.state.resting,actionOf(a))];
    if(a.model)lines.push(w.model+': '+a.model+(a.effort?' · '+a.effort:''));
    const tools=(a.tools||[]).filter(x=>x&&x.count>0).sort((x,y)=>y.count-x.count).slice(0,3).map(x=>x.name+' ×'+x.count).join(' · ');if(tools)lines.push(w.tools+': '+tools);
    if(Number.isFinite(a.tokens))lines.push(w.tokens+': '+compact(a.tokens));if(a.projectName)lines.push(w.project+': '+a.projectName);
    const when=relative(lastAt(a));if(when)lines.push(w.last(when));return lines;
  }
  const pausedAnimations=new Set();
  function syncAnimations(){syncOwnedAnimations(section.getAnimations?.({subtree:true})||[],d.hidden||reduced(),pausedAnimations);}
  function stop(){if(frame)root.cancelAnimationFrame(frame);frame=0;lastTime=0;}
  function visible(){return !d.hidden&&view&&!view.hidden&&view.offsetParent!==null&&moving.length>0&&!reduced();}
  function tick(now){
    frame=0;if(!visible()){lastTime=0;return;}
    const dt=lastTime?Math.min(64,now-lastTime)/1000:0;lastTime=now;
    for(const m of moving){m.phase=(m.phase+m.speed*dt/m.len)%1;const tt=m.dir>0?m.phase:1-m.phase,[x,y]=point(m.p,tt);m.el.setAttribute('transform','translate('+x.toFixed(1)+' '+y.toFixed(1)+')');m.el.setAttribute('opacity',(Math.sin(Math.PI*m.phase)*0.9+0.1).toFixed(2));}
    frame=root.requestAnimationFrame(tick);
  }
  function start(){if(!frame&&visible())frame=root.requestAnimationFrame(tick);}
  function draw(){
    stop();moving=[];const w=t();title.textContent=w.title;note.textContent=w.note;hint.textContent=w.hint;
    legend.replaceChildren();for(const [key,cls]of [['you','you'],['claude','claude'],['codex','codex']]){const i=el('span',undefined,'look-legend-item');const dot=el('i',undefined,'look-legend-dot');dot.dataset.family=cls;i.append(dot,el('span',key==='you'?w.you:NAMES[key]));legend.append(i);}
    for(const kind of ['work','question','reply','idle']){const i=el('span',undefined,'look-legend-item'),line=el('i',undefined,'look-legend-line');line.dataset.kind=kind;i.append(line,el('span',w.legend[kind]));legend.append(i);}
    const list=snapshot&&root.PanelCore?.agents?root.PanelCore.agents(snapshot):[],hier=root.PanelR9?.hierarchy?root.PanelR9.hierarchy(list):{edges:new Map()};
    const g=graph(list,id=>hier.edges.get(id)||null),compactView=root.matchMedia?.('(max-width:600px)').matches,L=layout(g,{...(compactView?{nodeW:172,nodeH:68,gapX:14,rowGap:44,colGap:36,pad:16}:{}),maxWidth:scroller.clientWidth||Math.max(240,(root.innerWidth||1280)-48),stacked:!!root.matchMedia?.('(max-width:1099px)').matches});
    current={g,L,list,byId:new Map(list.map(a=>[a.id,a])),parentOf:id=>hier.edges.get(id)||null};
    inner.replaceChildren();inner.style.width=L.width+'px';inner.style.height=L.height+'px';
    const art=svg('svg',{class:'look-graph-svg',width:L.width,height:L.height,viewBox:'0 0 '+L.width+' '+L.height,'aria-hidden':'false',role:'group'});art.setAttribute('aria-label',w.title);
    const panels=svg('g',{class:'look-panels'}),wires=svg('g',{class:'look-wires'}),badges=svg('g',{class:'look-badges'}),dots=svg('g',{class:'look-particles','aria-hidden':'true'});
    for(const f of FAMILIES)panels.append(svg('rect',{class:'look-panel','data-family':f,x:L.colX[f]-10,y:(L.colY?.[f]??L.rowY)-10,width:L.colW[f]+20,height:L.colH?L.colH[f]+20:L.height-L.rowY-6,rx:18}));
    art.append(panels,wires,badges,dots);inner.append(art);
    for(const edge of g.edges){
      const a=L.pos.get(edge.from),b=L.pos.get(edge.to);if(!a||!b)continue;const geo=wire(a,b);
      const line=svg('path',{d:geo.d,class:'look-wire','data-kind':edge.kind,'data-level':String(edge.level),'data-sender':edge.sender});if(edge.kind!=='idle')line.style.stroke=color(edge.sender);
      const hit=svg('path',{d:geo.d,class:'look-wire-hit',tabindex:'0',role:'button','data-edge':edge.id,'data-parent':edge.helper?edge.from:''});hit.setAttribute('aria-label',w.wireLabel(label(edge.from),label(edge.to),w.kind[edge.kind]));
      const open=()=>{const s=current.byId.get(edge.to),orphan=!edge.helper&&!!(s?.parentKey||s?.parentId);if(edge.from!=='you'&&openTimeline(edge.to,orphan?null:w.tl.edge(edge.from.startsWith('hub-')?w.you:label(edge.from),label(edge.to),w.kind[edge.kind])))return;detail(edgeLines(edge),label(edge.from)+' → '+label(edge.to));};hit.addEventListener('click',open);hit.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
      wires.append(line,hit);
      if(edge.kind==='question'||edge.kind==='reply'){const [mx,my]=point(geo.p,.5),g2=svg('g',{class:'look-badge','data-kind':edge.kind,transform:'translate('+mx+' '+my+')'});g2.append(svg('circle',{r:9}),Object.assign(svg('text',{'text-anchor':'middle','dominant-baseline':'central'}),{textContent:edge.kind==='question'?'?':'✓'}));badges.append(g2);}
      const count=reduced()?0:particles(edge.level);if(!count)continue;const len=length(geo.p);
      for(let i=0;i<count;i++){const c=svg('circle',{r:edge.level>=3?3.4:2.8,class:'look-particle',opacity:'0'});c.style.fill=color(edge.sender);dots.append(c);moving.push({el:c,p:geo.p,len,phase:i/count,speed:SPEED[edge.level],dir:direction(edge)});}
    }
    for(const node of g.nodes){
      const p=L.pos.get(node.id);if(!p)continue;const b=el('button',undefined,'look-node');b.type='button';b.style.transform='translate('+p.x+'px,'+p.y+'px)';b.style.width=p.w+'px';b.style.height=p.h+'px';
      b.dataset.type=node.type;if(node.family)b.dataset.family=node.family;
      if(node.type==='you'){b.dataset.family='you';const total=list.length,active=list.filter(a=>level(a,Date.now())>=2).length;b.append(el('span',undefined,'look-dot'),el('strong',w.you,'look-node-name'),el('small',total?w.sessions(total)+(active?' · '+active+' '+w.state.working:''):w.none,'look-node-sub'));}
      else if(node.type==='hub'){b.append(el('span',undefined,'look-dot'),el('strong',NAMES[node.family].toUpperCase(),'look-node-name'),el('small',node.count?w.sessions(node.count):w.none,'look-node-sub'));b.dataset.state=node.active?'working':'resting';}
      else{const a=node.session;b.dataset.state=a.state||'resting';const dot=el('span',undefined,'look-dot');dot.dataset.state=a.state==='working'||a.state==='recent'?'on':a.state==='waiting'?'waiting':'off';const when=relative(lastAt(a));b.append(dot,el('strong',nameOf(a),'look-node-name'),el('small',(w.state[a.state]||w.state.resting)+(when&&a.state!=='waiting'?' · '+when:''),'look-node-sub'));b.dataset.agentId=a.id;}
      b.setAttribute('aria-label',b.textContent);b.onclick=()=>{if(node.type==='session'&&openTimeline(node.id))return;detail(nodeLines(node),node.type==='you'?w.you:NAMES[node.family]);};inner.append(b);
    }
    const counts=snapshot?.usage?.counts,word=n=>Number.isFinite(n)?(n?String(n):w.noneWord):'?';foot.textContent=counts?w.counts(word(counts.paused),word(counts.finished)):'';
    if(compactView){const you=L.pos.get('you');if(you)scroller.scrollLeft=Math.max(0,you.x+you.w/2-scroller.clientWidth/2);}
    syncAnimations();start();
  }
  d.addEventListener('click',e=>{const row=e.target.closest?.('#home-stage .du-agent[data-agent-id]');if(!row||d.documentElement.dataset.look!=='today')return;if(openTimeline(row.dataset.agentId)){e.stopPropagation();e.preventDefault();}},true);
  d.addEventListener('visibilitychange',()=>{syncAnimations();if(d.hidden)stop();else start();});
  root.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change',()=>draw());
  new root.MutationObserver(()=>draw()).observe(d.documentElement,{attributes:true,attributeFilter:['data-motion']});
  let resizeTimer=0;root.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(draw,150);});
  const render=P.render.bind(P),select=P.select.bind(P),loading=P.loading.bind(P);
  P.render=(data,locale)=>{snapshot=data;lang=lingua(locale||lang);render(data,locale);draw();};
  P.select=(value,focus)=>{select(value,focus);if(value==='team')draw();else stop();};
  P.loading=locale=>{lang=lingua(locale||lang);loading(locale);};
  root.PanelLookTeam=Object.freeze({...api,draw,openTimeline,running:()=>!!frame,particles:()=>moving.length});
  const cached=P.state?.();if(cached?.snapshot){snapshot=cached.snapshot;lang=lingua(cached.locale||lang);}
  draw();
})(typeof window==='object'?window:globalThis);
