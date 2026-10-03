(function(root){
  'use strict';
  // Today's look: AI cards, who is working, what needs you and the week's spend, drawn from the same public snapshot.
  const WORDS={
    en:{claude:'CLAUDE CODE',codex:'CODEX',active:n=>n===1?'1 recent session':n+' recent sessions',idle:'No recent activity',none:'No sessions in this reading',reading:'Reading...',unknown:'?',who:'Who is working',team:'See the whole team ↗',needs:'What needs you',spend:'How much I spent this week',weekUsed:'week used',used:'used',details:'Usage details ↗',done:n=>n===1?'1 task completed today':n+' tasks completed today',chipExample:'Example',chipFile:'decisions.md',more:n=>n===1?'1 more':n+' more',state:{working:'working',recent:'recent',waiting:'waiting for you',resting:'paused'},settings:'Open Preferences',readOk:'Last reading finished',readFail:'Reading not available',feedback:'Send feedback',contact:'Talk to the author',open:'Open'},
    pt:{claude:'CLAUDE CODE',codex:'CODEX',active:n=>n===1?'1 sessão recente':n+' sessões recentes',idle:'Sem atividade recente',none:'Nenhuma sessão nesta leitura',reading:'Lendo...',unknown:'?',who:'Quem está trabalhando',team:'Ver toda a equipe ↗',needs:'O que precisa de você',spend:'Quanto gastei esta semana',weekUsed:'semana usada',used:'usado',details:'Detalhes do consumo ↗',done:n=>n===1?'1 tarefa concluída hoje':n+' tarefas concluídas hoje',chipExample:'Exemplo',chipFile:'decisions.md',more:n=>n===1?'mais 1':'mais '+n,state:{working:'trabalhando',recent:'recente',waiting:'esperando você',resting:'em pausa'},settings:'Abrir Preferências',readOk:'Última leitura concluída',readFail:'Leitura indisponível',feedback:'Mandar feedback',contact:'Falar com o autor',open:'Abrir'},
    es:{claude:'CLAUDE CODE',codex:'CODEX',active:n=>n===1?'1 sesión reciente':n+' sesiones recientes',idle:'Sin actividad reciente',none:'Ninguna sesión en esta lectura',reading:'Leyendo...',unknown:'?',who:'Quién está trabajando',team:'Ver todo el equipo ↗',needs:'Lo que necesita de ti',spend:'Cuánto gasté esta semana',weekUsed:'semana usada',used:'usado',details:'Detalles del uso ↗',done:n=>n===1?'1 tarea terminada hoy':n+' tareas terminadas hoy',chipExample:'Ejemplo',chipFile:'decisions.md',more:n=>n===1?'1 más':n+' más',state:{working:'trabajando',recent:'reciente',waiting:'esperándote',resting:'en pausa'},settings:'Abrir Preferencias',readOk:'Última lectura terminada',readFail:'Lectura no disponible',feedback:'Enviar comentarios',contact:'Hablar con el autor',open:'Abrir'}
  };
  const FAMILIES=['codex','claude'];
  const lingua=value=>Object.prototype.hasOwnProperty.call(WORDS,value)?value:'en';
  function stamp(a){const at=[a?.activityAt,a?.updated,a?.lastActivity].map(x=>Date.parse(x)).filter(Number.isFinite);return at.length?Math.max(...at):null;}
  function families(sessions){
    const out={};for(const family of FAMILIES){const list=(sessions||[]).filter(a=>a?.agent===family),recent=list.filter(a=>['working','recent'].includes(a.state)),times=list.map(stamp).filter(Number.isFinite);out[family]={count:list.length,recent:recent.length,waiting:list.filter(a=>a.state==='waiting').length,last:times.length?Math.max(...times):null};}
    return out;
  }
  function spend(credit){
    const out={};for(const family of FAMILIES){const q=credit(family);out[family]=q&&q.available?{available:true,used:Math.max(0,Math.min(100,100-q.remaining)),minutes:q.minutes}:{available:false};}
    return out;
  }
  const api={WORDS,families,spend,lingua};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(!root.document||!root.PanelV2)return;
  const d=root.document,$=id=>d.getElementById(id),P=root.PanelV2;
  let snapshot=null,lang=lingua(new URLSearchParams(root.location.search).get('lang')||d.documentElement.lang||'en');
  const w=()=>WORDS[lingua(lang)];
  function el(tag,value,cls){const n=d.createElement(tag);if(value!==undefined)n.textContent=value;if(cls)n.className=cls;return n;}
  function relative(ms){if(!Number.isFinite(ms))return '';const text=root.PanelHuman?.relative?.(new Date(ms).toISOString(),lingua(lang))||'';return root.PanelLocale?.text(text,lang)??text;}
  function ready(){return !!snapshot&&(snapshot.example||snapshot.usage?.ready===true&&!(snapshot.usage?.errors>0))&&!root.PanelClean?.status?.().readingFailed;}

  // AI cards: one per AI, with its own color.
  const ai=el('section',undefined,'look-ai');ai.id='look-ai';ai.setAttribute('aria-label','Claude Code · Codex');
  const cards={};
  for(const family of FAMILIES){const b=el('button',undefined,'look-ai-card');b.type='button';b.dataset.family=family;const dot=el('span',undefined,'look-dot'),text=el('span',undefined,'look-ai-text'),name=el('span','','look-ai-name'),state=el('span','','look-ai-state'),go=el('span','›','look-ai-go');go.setAttribute('aria-hidden','true');text.append(name,state);b.append(dot,text,go);b.onclick=()=>P.select('projects',true);cards[family]={b,dot,name,state};ai.append(b);}
  const overview=$('clean-overview');if(overview)overview.after(ai);

  // How much I spent this week.
  const spendCard=el('section',undefined,'home-card look-spend');spendCard.id='look-spend';const spendTitle=el('h2','','look-title'),spendGrid=el('dl',undefined,'look-spend-grid'),spendDone=el('p','','look-note'),spendLink=el('button','','look-link');spendLink.type='button';spendLink.onclick=()=>P.select('usage',true);spendCard.append(spendTitle,spendGrid,spendDone,spendLink);
  const stage=d.querySelector('#view-home .stage-card');if(stage)stage.after(spendCard);

  // What needs you: the existing decision button keeps its behavior; it gets a title, a count and a source chip.
  const waiting=$('waiting-open'),needsHead=el('span',undefined,'look-needs-head'),needsTitle=el('span','','look-title'),needsCount=el('span','','look-count'),chip=el('span','','look-chip'),chevron=el('span','›','look-chevron'),moreNote=el('span','','look-more');
  chevron.setAttribute('aria-hidden','true');needsHead.append(needsTitle,needsCount);
  if(waiting){const row=el('span',undefined,'look-needs-row'),question=$('waiting-question');waiting.prepend(needsHead);if(question){question.before(row);row.append(chip,question,chevron);}waiting.append(moreNote);}

  // Header: a quiet reading dot and a gear for Preferences.
  const actions=$('clean-actions'),dot=el('span',undefined,'look-reading'),gear=el('button',undefined,'look-gear');
  gear.type='button';gear.id='look-gear';gear.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zm8.1-2.3.1-.9-.1-.9 2-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-1.6-.9L15.8 3h-3.9l-.4 2.3c-.6.2-1.1.5-1.6.9l-2.3-.9-2 3.4 2 1.5-.1.9.1.9-2 1.5 2 3.4 2.3-.9c.5.4 1 .7 1.6.9l.4 2.3h3.9l.4-2.3c.6-.2 1.1-.5 1.6-.9l2.3.9 2-3.4z"/></svg>';
  gear.onclick=()=>d.getElementById('clean-preferences')?.click();
  if(actions)actions.append(dot,gear);

  // More menu: feedback and contact.
  const menu=d.querySelector('.clean-menu');let feedback=null,contact=null;
  if(menu){feedback=el('button','','look-feedback');feedback.type='button';feedback.onclick=()=>root.PanelBell?.feedback?.();contact=el('button','','look-contact');contact.type='button';contact.onclick=()=>root.PanelBell?.contact?.();menu.append(feedback,contact);}

  function draw(){
    const t=w(),sessions=root.PanelCore?.agents?snapshot?root.PanelCore.agents(snapshot):[]:snapshot?.usage?.sessions||[],ok=ready();
    d.documentElement.dataset.look='today';
    // AI cards
    const fam=families(sessions);
    for(const family of FAMILIES){const c=cards[family],f=fam[family];c.name.textContent=t[family];c.dot.dataset.state=!ok?'unknown':f.recent?'on':'off';c.state.textContent=!snapshot?t.reading:!ok?t.unknown:!f.count?t.none:(f.recent?t.active(f.recent):t.idle)+(f.last?' · '+relative(f.last):'');c.b.setAttribute('aria-label',t[family]+': '+c.state.textContent);}
    // who is working: v2 draws each row with its state and time; v21 draws the title, the legend and the team link
    // what needs you
    const count=snapshot?(P.decisions?.()||0):0,linked=snapshot&&(snapshot.example||snapshot.board?.connected);
    needsTitle.textContent=t.needs;needsCount.textContent=linked?String(count):'';needsCount.hidden=!linked;
    chip.textContent=!linked||!count?'':snapshot.example?t.chipExample:t.chipFile;chip.hidden=!chip.textContent;chevron.hidden=!count;
    const pending=snapshot&&!snapshot.example?(snapshot.tasks||[]).filter(x=>x.needsOwner).length:0;moreNote.textContent=pending>1?t.more(pending-1):'';moreNote.hidden=!moreNote.textContent;
    // spend
    spendTitle.textContent=t.spend;spendGrid.replaceChildren();const credit=family=>root.PanelR9?.credit?.(snapshot?.usage,family),sp=spend(credit);
    for(const family of FAMILIES){const s=sp[family],name=family==='claude'?'Claude Code':'Codex',label=s.available?(s.minutes===10080?t.weekUsed:(s.minutes%60===0?s.minutes/60+' h':s.minutes+' min')+' '+t.used):t.weekUsed,box=el('div',undefined,'look-spend-item');box.dataset.family=family;box.append(el('dt',name+' · '+label),el('dd',s.available?s.used+'%':t.unknown));spendGrid.append(box);}
    const done=snapshot?.example?(snapshot.tasks||[]).filter(x=>(x.phase?.percent??x.percent)===100).length:snapshot?.deliveries?.connected?(snapshot.deliveries.items||[]).length:null;spendDone.textContent=Number.isFinite(done)?t.done(done):'';spendDone.hidden=!spendDone.textContent;spendLink.textContent=t.details;
    // header and menu
    dot.dataset.state=!snapshot?'unknown':ok?'on':'off';dot.title=ok?t.readOk:t.readFail;dot.setAttribute('aria-label',dot.title);dot.setAttribute('role','img');gear.title=t.settings;gear.setAttribute('aria-label',t.settings);
    if(feedback)feedback.textContent=t.feedback;if(contact)contact.textContent=t.contact;
    // feed your AI: the teach card sits on top
    if(root.PanelTeach)root.PanelTeach.card($('view-tips'),lang);
    root.PanelBell?.update?.(snapshot,lang);
  }
  const render=P.render.bind(P),select=P.select.bind(P),loading=P.loading.bind(P),failure=P.failure.bind(P);
  P.render=(data,locale)=>{try{snapshot=data;lang=lingua(locale||lang);render(data,locale);draw();root.PanelStartup?.rendered?.(data);}catch{root.PanelStartup?.failed?.('broken');}};
  P.select=(value,focus)=>{select(value,focus);draw();try{root.PanelBell?.used?.(value);}catch{}};
  P.loading=locale=>{lang=lingua(locale||lang);loading(locale);draw();};
  P.failure=()=>{try{failure();draw();}catch{}root.PanelStartup?.failed?.();};
  root.PanelLook=Object.freeze({...api,draw});
  const cached=P.state?.();if(cached?.snapshot){snapshot=cached.snapshot;lang=lingua(cached.locale||lang);}
  draw();
})(typeof window==='object'?window:globalThis);
