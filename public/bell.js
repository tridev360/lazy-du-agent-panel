(function(root){
  'use strict';
  const panelStorage=()=>root.PanelStorage?.storage()??((root.location?.search&&new URLSearchParams(root.location.search).get('example')==='1')?null:root.localStorage);
  // The bell: version notes and tips made on this computer, what waits for you, decisions asked by your AIs,
  // and, only when you ask, the author's public messages. Read marks and usage marks stay in this browser.
  // This version sends no usage data anywhere.
  const VERSION='2.2.4';
  const REPO='https://github.com/tridev360/lazy-du-agent-panel';
  const NEWS_SOURCE='https://raw.githubusercontent.com/tridev360/lazy-du-agent-panel/main/news.json';
  const CONTACTS=[{text:'github.com/tridev360',url:'https://github.com/tridev360'},{text:'X @hallstrid',url:'https://x.com/hallstrid'}];
  const FEATURES=['wen','accelerate','team','projects','usage','teach','automate','tips'];
  const KEYS={read:'agent-panel-bell-read',used:'agent-panel-used',tip:'agent-panel-tip',dismissed:'agent-panel-bell-closed',author:'agent-panel-author-news'};
  const T={
    en:{bell:'Notifications',unread:n=>n===1?'1 unread notification':n+' unread notifications',empty:'Nothing new.',markAll:'Mark all as read',read:'Mark as read',close:'Close',open:'Open',
      origin:{panel:'Panel tip',author:'Author message',you:'Waiting for you',claude:'Asked by Claude Code',codex:'Asked by Codex'},
      version:{title:'What is new in 2.1',text:'A new look, Teach your AI with who does what, and this bell. Read marks stay on this computer.'},
      recs:{title:'The panel has new usage recommendations',text:'See who does what in Teach your AI: one AI coordinates, the other reviews, production waits for your ok.'},
      tip:{wen:['Try WEN','The six short lines of where things stand, in one place.'],accelerate:['Try ACCELERATE','Steps to cut waiting, each with a text for your AI.'],team:['Try Team','See which session started which.'],projects:['Try Sessions','Every session, side by side.'],usage:['Try Usage','Tokens, credit and a playful water estimate.'],teach:['Try Teach your AI','Rules for your AI, copied with the instruction to save them.'],automate:['Try AUTOMATE','A routine plan, copied with the instruction for your AI.'],tips:['Try Feed your AI','Short prompts you can copy.']},
      waiting:name=>name+' is waiting for you',decision:'Decision for you',
      author:'Author messages',authorAuto:'Receive author messages',authorNow:'See author messages now',authorOff:'Off. Nothing is fetched until you turn it on or press the button.',authorWhat:'What is fetched: '+NEWS_SOURCE+' with a plain GET, once a day when on, or when you press the button. Nothing about you or your sessions is sent; GitHub sees your IP address like any download.',authorFail:'Could not check now.',authorNone:'No author messages.',authorChecked:at=>'Checked '+at+' UTC.',
      usage:'This version sends no usage data.',
      feedback:'Send feedback',feedbackNote:'Opens a new issue on GitHub in your browser. Nothing is sent until you submit it there.',contact:'Talk to the author',
      issueTitle:'Feedback: ',issue:['**What happened**','','','**What did you expect**','','','Panel version: '+VERSION]},
    pt:{bell:'Notificações',unread:n=>n===1?'1 notificação não lida':n+' notificações não lidas',empty:'Nada novo.',markAll:'Marcar todas como lidas',read:'Marcar como lida',close:'Fechar',open:'Abrir',
      origin:{panel:'Dica do painel',author:'Mensagem do autor',you:'Esperando você',claude:'Pedido do Claude Code',codex:'Pedido do Codex'},
      version:{title:'O que há de novo na 2.1',text:'Visual novo, Ensinar minha IA com quem faz o quê, e este sino. As marcas de lido ficam neste computador.'},
      recs:{title:'O painel tem novas recomendações de uso',text:'Veja quem faz o quê em Ensinar minha IA: uma IA coordena, a outra revisa, a produção espera o seu ok.'},
      tip:{wen:['Experimente o WEN','As seis linhas curtas de em que pé estamos, num lugar só.'],accelerate:['Experimente o ACELERAR','Fases para cortar espera, cada uma com um texto para a sua IA.'],team:['Experimente a Equipe','Veja qual sessão começou qual.'],projects:['Experimente Sessões','Todas as sessões, lado a lado.'],usage:['Experimente o Consumo','Tokens, crédito e uma estimativa lúdica de água.'],teach:['Experimente Ensinar minha IA','Regras para a sua IA, copiadas já com a instrução para salvar.'],automate:['Experimente o AUTOMATIZAR','Um plano de rotina, copiado já com a instrução para a sua IA.'],tips:['Experimente Alimente sua IA','Prompts curtos para copiar.']},
      waiting:name=>name+' está esperando você',decision:'Decisão para você',
      author:'Mensagens do autor',authorAuto:'Receber mensagens do autor',authorNow:'Ver mensagens do autor agora',authorOff:'Desligado. Nada é buscado até você ligar ou apertar o botão.',authorWhat:'O que é buscado: '+NEWS_SOURCE+' com um GET simples, uma vez por dia quando ligado, ou quando você aperta o botão. Nada sobre você ou suas sessões é enviado; o GitHub vê o seu IP como em qualquer download.',authorFail:'Não deu para conferir agora.',authorNone:'Nenhuma mensagem do autor.',authorChecked:at=>'Conferido às '+at+' UTC.',
      usage:'Esta versão não manda dado de uso.',
      feedback:'Mandar feedback',feedbackNote:'Abre uma issue nova no GitHub no seu navegador. Nada é enviado até você enviar por lá.',contact:'Falar com o autor',
      issueTitle:'Feedback: ',issue:['**O que aconteceu**','','','**O que você esperava**','','','Versão do painel: '+VERSION]},
    es:{bell:'Notificaciones',unread:n=>n===1?'1 notificación sin leer':n+' notificaciones sin leer',empty:'Nada nuevo.',markAll:'Marcar todas como leídas',read:'Marcar como leída',close:'Cerrar',open:'Abrir',
      origin:{panel:'Consejo del panel',author:'Mensaje del autor',you:'Esperándote',claude:'Pedido de Claude Code',codex:'Pedido de Codex'},
      version:{title:'Novedades de la 2.1',text:'Un aspecto nuevo, Enseña a tu IA con quién hace qué, y esta campana. Las marcas de leído quedan en este ordenador.'},
      recs:{title:'El panel tiene nuevas recomendaciones de uso',text:'Mira quién hace qué en Enseña a tu IA: una IA coordina, la otra revisa, producción espera tu ok.'},
      tip:{wen:['Prueba WEN','Las seis líneas cortas de dónde estamos, en un solo lugar.'],accelerate:['Prueba ACELERAR','Fases para recortar esperas, cada una con un texto para tu IA.'],team:['Prueba Equipo','Mira qué sesión empezó cuál.'],projects:['Prueba Sesiones','Todas las sesiones, lado a lado.'],usage:['Prueba Uso','Tokens, crédito y una estimación ilustrativa de agua.'],teach:['Prueba Enseña a tu IA','Reglas para tu IA, copiadas ya con la instrucción para guardarlas.'],automate:['Prueba AUTOMATIZAR','Un plan de rutina, copiado ya con la instrucción para tu IA.'],tips:['Prueba Alimenta tu IA','Prompts cortos para copiar.']},
      waiting:name=>name+' te está esperando',decision:'Decisión para ti',
      author:'Mensajes del autor',authorAuto:'Recibir mensajes del autor',authorNow:'Ver mensajes del autor ahora',authorOff:'Desactivado. No se busca nada hasta que lo actives o pulses el botón.',authorWhat:'Lo que se busca: '+NEWS_SOURCE+' con un GET simple, una vez al día si está activado, o cuando pulsas el botón. No se envía nada sobre ti ni tus sesiones; GitHub ve tu dirección IP como en cualquier descarga.',authorFail:'No se pudo comprobar ahora.',authorNone:'No hay mensajes del autor.',authorChecked:at=>'Comprobado a las '+at+' UTC.',
      usage:'Esta versión no envía datos de uso.',
      feedback:'Enviar comentarios',feedbackNote:'Abre una issue nueva en GitHub en tu navegador. No se envía nada hasta que la envíes allí.',contact:'Hablar con el autor',
      issueTitle:'Comentarios: ',issue:['**Qué pasó**','','','**Qué esperabas**','','','Versión del panel: '+VERSION]}
  };
  const lingua=value=>Object.prototype.hasOwnProperty.call(T,value)?value:'en';
  const NAMES={claude:'Claude Code',codex:'Codex'};
  function pickTip(used,closed,log,today){
    if(log&&log.date===today){const id=log.id;return FEATURES.includes(id)&&!used[id]&&!closed.includes('tip-'+id)?id:null;}
    return FEATURES.find(id=>!used[id]&&!closed.includes('tip-'+id))||null;
  }
  function items({snapshot=null,used={},closed=[],log=null,today='',author=[]}={},lang='en'){
    const t=T[lingua(lang)],out=[];
    out.push({id:'version-2.1',origin:'panel',title:t.version.title,text:t.version.text,action:'teach'});
    out.push({id:'recommendations-'+VERSION,origin:'panel',title:t.recs.title,text:t.recs.text,action:'teach'});
    const tip=pickTip(used,closed,log,today);if(tip)out.push({id:'tip-'+tip,origin:'panel',title:t.tip[tip][0],text:t.tip[tip][1],action:tip,tip:true});
    const sessions=snapshot?.usage?.sessions||[];
    for(const s of sessions)if(s?.state==='waiting'&&NAMES[s.agent])out.push({id:'waiting-'+(s.sessionKey||s.id),origin:s.agent,title:t.waiting(NAMES[s.agent]),text:(lang==='pt'&&s.projectNamePT)||(lang==='es'&&s.projectNameES)||s.projectName||'',action:'team'});
    const decisions=snapshot?snapshot.example?(snapshot.cards||[]):(snapshot.tasks||[]).filter(x=>x.needsOwner):[];
    for(const c of decisions.slice(0,6)){const who=NAMES[c.executor]&&c.source!=='task-board'?c.executor:null;out.push({id:'decision-'+(c.id||c.title),origin:who||'you',title:(lang==='pt'&&(c.questionPT||c.titlePT))||(lang==='es'&&(c.questionES||c.titleES))||c.question||c.title||t.decision,text:who?'':t.decision,action:'decision'});}
    if(root.PanelGuidance)out.push(...root.PanelGuidance.bellItems(snapshot,lang));
    for(const n of author||[])out.push({id:'author-'+n.id,origin:'author',title:n.title?.[lingua(lang)]||n.title?.en||'',text:n.text?.[lingua(lang)]||n.text?.en||'',link:n.link||null,date:n.date||null});
    return out;
  }
  function readMarks(ids){const read=new Set(Array.isArray(ids)?ids:[]);if([...read].some(id=>/^version-2\.(?:1|2)\.\d+$/.test(id)))read.add('version-2.1');return [...read];}
  function shouldFetchAuthor(author,now=Date.now()){return !!(author&&author.auto===true)&&(!author.checkedAt||!Number.isFinite(Date.parse(author.checkedAt))||now-Date.parse(author.checkedAt)>86400000);}
  function issueURL(lang){const t=T[lingua(lang)];return REPO+'/issues/new?title='+encodeURIComponent(t.issueTitle)+'&body='+encodeURIComponent([...t.issue,'Language: '+lingua(lang)].join('\n'));}
  const api={VERSION,REPO,NEWS_SOURCE,CONTACTS,FEATURES,KEYS,T,lingua,pickTip,items,readMarks,issueURL,shouldFetchAuthor};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(!root.document)return;
  const d=root.document;
  const get=(key,fallback)=>{try{const v=JSON.parse(panelStorage().getItem(key));return v??fallback;}catch{return fallback;}};
  const put=(key,value)=>{try{panelStorage().setItem(key,JSON.stringify(value));}catch{}};
  let snapshot=null,lang='en',checking=false,status='';
  const today=()=>new Date().toISOString().slice(0,10);
  function el(tag,value,cls){const n=d.createElement(tag);if(value!==undefined)n.textContent=value;if(cls)n.className=cls;return n;}
  function state(){
    const used=get(KEYS.used,{}),closed=get(KEYS.closed,[]),author=get(KEYS.author,{auto:false,checkedAt:null,items:[]});let log=get(KEYS.tip,null);
    if(!log||log.date!==today()){const id=pickTip(used,closed,null,today());log={date:today(),id};put(KEYS.tip,log);}
    return {used,closed,log,author,read:readMarks(get(KEYS.read,[]))};
  }
  function list(){const s=state();return items({snapshot,used:s.used,closed:s.closed,log:s.log,today:today(),author:s.author.items||[]},lang);}
  function unread(){const read=new Set(readMarks(get(KEYS.read,[])));return list().filter(x=>!read.has(x.id)).length;}
  function markRead(ids){const read=new Set(readMarks(get(KEYS.read,[])));for(const id of ids)read.add(id);put(KEYS.read,[...read].slice(-300));paint();}
  function used(id){if(!FEATURES.includes(id))return;const u=get(KEYS.used,{});if(!u[id]){u[id]=true;put(KEYS.used,u);paint();}}
  function act(item){
    const P=root.PanelV2;
    if(item.action==='guidance')root.PanelGuidance?.open?.(item.guidanceId);
    else if(item.action==='teach'){root.PanelTeach?.open(lang,snapshot);used('teach');}
    else if(item.action==='decision')P?.openDecision?.();
    else if(item.action==='team'||item.action==='projects'||item.action==='usage'||item.action==='tips'){d.getElementById('drawer')?.close?.();P?.select?.(item.action,true);}
    else if(item.action==='wen'){d.getElementById('drawer')?.close?.();d.getElementById('clean-wen')?.click();}
    else if(item.action==='automate'){d.getElementById('drawer')?.close?.();d.getElementById('clean-auto')?.click();}
    else if(item.action==='accelerate'){d.getElementById('drawer')?.close?.();d.getElementById('acel-trigger')?.click();}
    markRead([item.id]);
  }
  const offline=()=>root.PanelStartup?.offline?.()===true||d.documentElement.dataset.offline==='true';
  function offlineNotice(){const copy={en:['Offline mode','External connections are disabled in offline mode.'],pt:['Modo offline','Conexões externas estão desligadas no modo offline.'],es:['Modo sin conexión','Las conexiones externas están desactivadas en el modo sin conexión.']}[lingua(lang)];root.panelDrawer(copy[0],[el('p',copy[1],'summary-note')]);}
  async function checkAuthor(){
    if(offline()){offlineNotice();return;}
    if(checking)return;checking=true;status='';
    try{const r=await root.fetch('/api/news',{cache:'no-store',credentials:'same-origin',headers:{Accept:'application/json'}});const j=await r.json();
      if(!j||!j.ok){status=T[lingua(lang)].authorFail;}else{const a=get(KEYS.author,{auto:false});put(KEYS.author,{auto:!!a.auto,checkedAt:new Date().toISOString(),items:Array.isArray(j.items)?j.items.slice(0,20):[]});status=j.items?.length?'':T[lingua(lang)].authorNone;}
    }catch{status=T[lingua(lang)].authorFail;}finally{checking=false;paint();if(d.getElementById('drawer')?.open&&d.getElementById('drawer')?.dataset.bell==='true')open();}
  }
  function contact(){if(offline()){offlineNotice();return;}const t=T[lingua(lang)],box=el('div',undefined,'bell-contact');for(const c of CONTACTS){const a=el('a',c.text,'bell-link');a.href=c.url;a.target='_blank';a.rel='noopener noreferrer';box.append(a);}root.panelDrawer(t.contact,[box]);}
  function feedback(){if(offline()){offlineNotice();return;}root.open(issueURL(lang),'_blank','noopener,noreferrer');}
  function open(){
    const t=T[lingua(lang)],s=state(),read=new Set(s.read),all=list(),box=el('div',undefined,'bell'),head=el('div',undefined,'bell-head'),markAll=el('button',t.markAll,'bell-all');
    markAll.type='button';markAll.onclick=()=>{markRead(all.map(x=>x.id));open();};head.append(el('p',t.unread(all.filter(x=>!read.has(x.id)).length),'summary-note'),markAll);box.append(head);
    const ul=el('ul',undefined,'bell-list');
    if(!all.length)ul.append(el('li',t.empty,'summary-note'));
    for(const item of all){
      const li=el('li',undefined,'bell-item');li.dataset.origin=item.origin;li.dataset.read=String(read.has(item.id));
      const chip=el('span',undefined,'bell-origin');chip.append(el('i',undefined,'bell-dot'),el('span',t.origin[item.origin]||t.origin.panel));
      const body=el('div',undefined,'bell-body');body.append(chip,el('strong',item.title,'bell-title'));if(item.text)body.append(el('p',item.text,'bell-text'));
      const actions=el('div',undefined,'bell-actions');
      if(item.link){const a=el('a',t.open,'bell-open');a.href=item.link;a.target='_blank';a.rel='noopener noreferrer';a.onclick=()=>markRead([item.id]);actions.append(a);}
      else if(item.action){const b=el('button',t.open,'bell-open');b.type='button';b.onclick=()=>act(item);actions.append(b);}
      if(item.tip){const x=el('button',t.close,'bell-close');x.type='button';x.onclick=()=>{put(KEYS.closed,[...new Set([...get(KEYS.closed,[]),item.id])]);markRead([item.id]);open();};actions.append(x);}
      else if(!read.has(item.id)){const r=el('button',t.read,'bell-mark');r.type='button';r.onclick=()=>{markRead([item.id]);open();};actions.append(r);}
      li.append(body,actions);ul.append(li);
    }
    box.append(ul);
    const authorBox=el('section',undefined,'bell-author'),label=el('label',undefined,'bell-switch'),input=el('input'),now=el('button',checking?'...':t.authorNow,'bell-now');
    input.type='checkbox';input.checked=!!s.author.auto;input.onchange=()=>{const a=get(KEYS.author,{auto:false});put(KEYS.author,{...a,auto:input.checked});if(input.checked)checkAuthor();else open();};
    label.append(input,el('span',t.authorAuto));now.type='button';now.disabled=checking;now.onclick=()=>checkAuthor();
    authorBox.append(el('h3',t.author,'bell-section'),label,now,el('p',status||(s.author.checkedAt?t.authorChecked(s.author.checkedAt.slice(11,16)):(s.author.auto?'':t.authorOff)),'summary-note bell-status'),el('p',t.authorWhat,'summary-note bell-what'));
    const fb=el('button',t.feedback,'bell-feedback'),ct=el('button',t.contact,'bell-contact-open');fb.type='button';ct.type='button';fb.onclick=feedback;ct.onclick=contact;
    const more=el('section',undefined,'bell-more');more.append(fb,el('p',t.feedbackNote,'summary-note'),ct,el('p',t.usage,'summary-note'));
    box.append(authorBox,more);
    root.panelDrawer(t.bell,[box]);const drawer=d.getElementById('drawer');if(drawer){drawer.dataset.bell='true';drawer.addEventListener('close',()=>{delete drawer.dataset.bell;},{once:true});}
  }
  const button=el('button',undefined,'look-bell');button.type='button';button.id='look-bell';
  button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21.5a2.4 2.4 0 0 0 2.3-1.8H9.7a2.4 2.4 0 0 0 2.3 1.8zm7-5.1-1.6-1.9V10a5.4 5.4 0 0 0-4.2-5.3V4a1.2 1.2 0 0 0-2.4 0v.7A5.4 5.4 0 0 0 6.6 10v4.5L5 16.4v1.1h14z"/></svg>';
  const count=el('span','','look-bell-count');button.append(count);button.onclick=open;
  function paint(){const n=unread(),t=T[lingua(lang)];count.textContent=n>9?'9+':n?String(n):'';count.hidden=!n;button.title=t.bell;button.setAttribute('aria-label',t.bell+(n?' · '+t.unread(n):''));}
  function mount(){const actions=d.getElementById('clean-actions');if(actions&&!button.isConnected){const gear=d.getElementById('look-gear');if(gear)actions.insertBefore(button,gear);else actions.append(button);}}
  d.addEventListener('click',e=>{const hit=e.target.closest?.('#clean-wen,#clean-auto,#acel-trigger,.teach-open');if(!hit)return;used(hit.id==='clean-wen'?'wen':hit.id==='clean-auto'?'automate':hit.id==='acel-trigger'?'accelerate':'teach');},true);
  function update(data,locale){snapshot=data||snapshot;lang=lingua(locale||lang);mount();paint();if(!offline()&&!checking&&shouldFetchAuthor(get(KEYS.author,{auto:false})))checkAuthor();}
  root.PanelBell=Object.freeze({...api,update,open,used,feedback,contact,unread});
})(typeof window==='object'?window:globalThis);
