'use strict';
(function(root) {
  const XP = Object.freeze({ comum: 10, rara: 25, epica: 50, lendaria: 100 });
  const STORE = 'painel-feed-public-v1', SOUND = 'painel-feed-muted-v1', LIMIT = 500, ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
  const controllers = new WeakMap();
  const words = {
    en: { title:'Feed your AI',level:'Level',hunger:'Hunger',hungry:'Your Du is ready for a prompt',full:'Your Du is well fed',streak:'day streak',collection:'Collection',feed:'Feed & copy',copyAgain:'Copy again',ready:'Copied.',empty:'No prompts available yet',locked:'Unlocks at level',du:'Your Du',soundOn:'Sound on',soundOff:'Muted',copyError:'Could not copy. Select the prompt and copy it.',saveError:'Copied. Points could not be saved. Try again.',offline:'Local connection unavailable. The prompt is ready to copy.',saving:'Feeding...',fed:'Fed today',limit:'Daily XP reached. Come back tomorrow.',real:'Your AI ate it',example:'Practice mode. Copies prompts without saving points.',next:'To the next level',local:'Saved on this device',rarity:{comum:'Common',rara:'Rare',epica:'Epic',lendaria:'Legendary'} },
    pt: { title:'Alimente sua IA',level:'Nível',hunger:'Fome',hungry:'Seu Du está pronto para um prompt',full:'Seu Du está bem alimentado',streak:'dias seguidos',collection:'Coleção',feed:'Alimentar e copiar',copyAgain:'Copiar de novo',ready:'Copiado.',empty:'Nenhum prompt disponível ainda',locked:'Libera no nível',du:'Seu Du',soundOn:'Som ligado',soundOff:'Mudo',copyError:'Não foi possível copiar. Selecione o prompt e copie.',saveError:'Copiado. Os pontos não foram salvos. Tente de novo.',offline:'Conexão local indisponível. O prompt está pronto para copiar.',saving:'Alimentando...',fed:'Alimentado hoje',limit:'XP diário completo. Volte amanhã.',real:'Sua IA comeu mesmo',example:'Modo de prática. Copia prompts sem salvar pontos.',next:'Para o próximo nível',local:'Salvo neste dispositivo',rarity:{comum:'Comum',rara:'Rara',epica:'Épica',lendaria:'Lendária'} },
    es: { title:'Alimenta tu IA',level:'Nivel',hunger:'Hambre',hungry:'Tu Du está listo para un prompt',full:'Tu Du está bien alimentado',streak:'días seguidos',collection:'Colección',feed:'Alimentar y copiar',copyAgain:'Copiar de nuevo',ready:'Copiado.',empty:'Todavía no hay prompts disponibles',locked:'Disponible en el nivel',du:'Tu Du',soundOn:'Sonido activo',soundOff:'Silenciado',copyError:'No se pudo copiar. Selecciona el prompt y cópialo.',saveError:'Copiado. No se guardaron los puntos. Inténtalo de nuevo.',offline:'Conexión local no disponible. El prompt está listo para copiar.',saving:'Alimentando...',fed:'Alimentado hoy',limit:'XP diario completo. Vuelve mañana.',real:'Tu IA sí comió',example:'Modo de práctica. Copia prompts sin guardar puntos.',next:'Para el próximo nivel',local:'Guardado en este dispositivo',english:'Prompt en inglés',rarity:{comum:'Común',rara:'Rara',epica:'Épica',lendaria:'Legendaria'} }
  };
  const finite = (value, fallback=0) => Number.isFinite(value) && value>=0 ? Math.min(1e9,Math.floor(value)) : fallback;
  const localeOf = value => /^pt/i.test(value)?'pt':/^es/i.test(value)?'es':'en';
  function tipsOf(snapshot) {
    const raw = snapshot?.feeding?.tips || snapshot?.iaTips?.dicas || snapshot?.tips?.items || snapshot?.tips || snapshot?.iaTips;
    const seen=new Set();
    return (Array.isArray(raw)?raw:[]).filter(tip=>{if(!tip||!ID.test(tip.id||'')||!Object.hasOwn(XP,tip.raridade)||seen.has(tip.id))return false;seen.add(tip.id);return true;}).slice(0,100).map(tip=>({...tip,xp:XP[tip.raridade],unlockLevel:tip.raridade==='lendaria'?5:1}));
  }
  function textOf(tip,lang) { const value=tip?.[localeOf(lang)==='pt'?'pt':'en'];return typeof value==='string'?value:typeof value?.colar==='string'?value.colar:''; }
  function titleOf(tip,lang) { const value=tip?.[localeOf(lang)==='pt'?'pt':'en'];return typeof value?.titulo==='string'?value.titulo:tip.id; }
  function modelOf(snapshot) {
    const feed=snapshot?.feeding||{},xp=finite(feed.xp),level=finite(feed.level,Math.floor(xp/100)+1)||1;
    const tips=tipsOf(snapshot).map(tip=>({...tip,locked:tip.locked===true||level<tip.unlockLevel}));
    return {xp,level,levelXp:Math.min(99,finite(feed.levelXp,xp%100)),nextLevelXp:100,hunger:Math.min(100,finite(feed.hunger)),streak:finite(feed.streak),collected:(Array.isArray(feed.collected)?feed.collected:[]).filter(id=>tips.some(t=>t.id===id)),collectionTotal:finite(feed.collectionTotal,tips.length||14),tips};
  }
  const dayOf=now=>now.toISOString().slice(0,10);
  function validDay(value,now) { if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const n=Date.parse(value+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===value&&value<=dayOf(now); }
  function publicModel(snapshot,saved,now=new Date()) {
    const tips=tipsOf(snapshot).map(tip=>({...tip,locked:false})),byId=new Map(tips.map(tip=>[tip.id,tip])),days={};let earned=0;
    for(const date of Object.keys(saved?.days||{}).filter(day=>validDay(day,now)).sort().slice(-400)) {
      const ids=Array.isArray(saved.days[date])?saved.days[date]:[];let daily=0;
      for(const id of [...new Set(ids.slice(0,100))]){const tip=byId.get(id);if(!tip||daily+tip.xp>LIMIT||tip.unlockLevel>Math.floor(earned/100)+1)continue;(days[date]||=[]).push(id);daily+=tip.xp;earned+=tip.xp;}
    }
    const today=dayOf(now),collected=[...new Set(Object.values(days).flat())],xp=Object.values(days).flat().reduce((sum,id)=>sum+byId.get(id).xp,0);
    let streak=0,cursor=new Date(today+'T00:00:00Z');if(!days[today]?.length)cursor.setUTCDate(cursor.getUTCDate()-1);
    while(days[dayOf(cursor)]?.length&&streak<400){streak++;cursor.setUTCDate(cursor.getUTCDate()-1);}
    const model=modelOf({feeding:{tips,xp,level:Math.floor(xp/100)+1,levelXp:xp%100,collected,collectionTotal:tips.length,streak,hunger:days[today]?.length?100:streak?50:0}});
    model.tips=model.tips.map(tip=>({...tip,fedToday:!!days[today]?.includes(tip.id),eatenForReal:false}));
    return {model,saved:{days},dailyXp:(days[today]||[]).reduce((sum,id)=>sum+byId.get(id).xp,0)};
  }
  function publicFeed(snapshot,saved,id,now=new Date()) {
    const current=publicModel(snapshot,saved,now),tip=current.model.tips.find(item=>item.id===id);
    if(!tip||tip.locked)return {...current,gained:0,reason:'locked'};
    if(tip.fedToday)return {...current,gained:0,reason:'already-fed-today'};
    if(current.dailyXp+tip.xp>LIMIT)return {...current,gained:0,reason:'daily-limit'};
    (current.saved.days[dayOf(now)]||=[]).push(id);return {...publicModel(snapshot,current.saved,now),gained:tip.xp,reason:'fed'};
  }
  function readMuted(storage){try{return storage?.getItem(SOUND)!=='0';}catch{return true;}}
  function saveMuted(storage,muted){try{storage?.setItem(SOUND,muted?'1':'0');}catch{}}
  function storage(){try{return root.localStorage;}catch{return null;}}
  let audio,audioGesture=false;
  function resumeAudio(){audioGesture=true;try{const Audio=root.AudioContext||root.webkitAudioContext;if(Audio){audio||=new Audio();audio.resume?.();}}catch{}}
  function playSound(levelUp,realBonus=false){
    if(!audio||!audioGesture||audio.state&&audio.state!=='running')return;try{const at=audio.currentTime,gain=audio.createGain();gain.connect(audio.destination);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(realBonus ? .018 : .025,at+.015);gain.gain.exponentialRampToValueAtTime(.0001,at+(realBonus ? .36 : .28));
      for(const [index,hz]of(realBonus?[330,495,660]:levelUp?[440,660,880]:[210,285]).entries()){const oscillator=audio.createOscillator();oscillator.type='sine';oscillator.frequency.setValueAtTime(hz,at+index*.06);oscillator.connect(gain);oscillator.start(at+index*.06);oscillator.stop(at+(realBonus ? .37 : .29));}
    }catch{}
  }
  function realBonusOf(before,after,snapshot,seen=new Set()){
    if(!before||snapshot?.public===true||snapshot?.example===true)return null;
    const previous=new Map(before.tips.map(tip=>[tip.id,tip])),ids=[];let gained=0;
    for(const tip of after.tips){const old=previous.get(tip.id);if(!old||old.eatenForReal!==false||tip.eatenForReal!==true||old.raridade!==tip.raridade||seen.has(tip.id)||!before.collected.includes(tip.id)||!after.collected.includes(tip.id))continue;ids.push(tip.id);gained+=XP[tip.raridade];}
    if(!gained||after.xp-before.xp<gained)return null;
    return {ids,gained,levelUp:after.level>before.level};
  }
  function render(snapshot,host,options={}) {
    if(!host||!root.document)return null;let c=controllers.get(host);
    if(!c){c={selected:null,snapshot,options,busy:false,muted:readMuted(storage()),status:'',success:false,realSeen:new Set()};controllers.set(host,c);}
    const previous=c.model,previousLocal=c.snapshot?.public!==true&&c.snapshot?.example!==true;
    c.snapshot=snapshot;c.options=options;c.locale=localeOf(typeof options.lang==='function'?options.lang():options.lang||root.document.documentElement.lang);
    if(c.busy)return c;
    if(snapshot?.public===true){let saved;try{saved=JSON.parse(storage().getItem(STORE));}catch{}c.publicSaved=saved;c.model=publicModel(snapshot,saved).model;}else c.model=modelOf(snapshot);
    const reward=previousLocal?realBonusOf(previous,c.model,snapshot,c.realSeen):null;
    for(const tip of c.model.tips)if(tip.eatenForReal===true)c.realSeen.add(tip.id);
    if(reward){c.status=words[c.locale].real+' +'+reward.gained+' XP';c.success=true;}
    if(!c.selected||!c.model.tips.some(tip=>tip.id===c.selected))c.selected=c.model.tips.find(tip=>!tip.locked&&!tip.fedToday)?.id||c.model.tips[0]?.id;
    const signature=JSON.stringify([c.model,c.locale,c.muted]);if(c.signature===signature&&host.childElementCount)return c;c.signature=signature;draw(host,c);
    if(reward){if(!c.muted&&!(typeof c.options.isMuted==='function'&&c.options.isMuted()))playSound(reward.levelUp,true);animate(c,c.mascot.getBoundingClientRect(),reward.gained,reward.levelUp);}
    return c;
  }
  function draw(host,c){
    const doc=root.document,w=words[c.locale],model=c.model;
    const decodedMascot=c.mascot?.querySelector('img');
    const make=(tag,text,cls)=>{const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
    const button=(text,cls,action)=>{const el=make('button',text,cls);el.type='button';if(action)el.addEventListener('click',action);return el;};
    host.classList.add('feed-box');host.setAttribute('aria-label',w.title);host.replaceChildren();
    const header=make('div',undefined,'feed-heading'),sound=button(c.muted?w.soundOff:w.soundOn,'feed-sound',()=>{c.muted=!c.muted;saveMuted(storage(),c.muted);if(!c.muted&&!(typeof c.options.isMuted==='function'&&c.options.isMuted()))resumeAudio();c.signature=null;draw(host,c);host.querySelector('.feed-sound')?.focus();});sound.setAttribute('aria-pressed',String(c.muted));header.append(make('h2',w.title),sound);host.append(header);
    const stage=make('section',undefined,'feed-stage'),mascot=make('div',undefined,'feed-mascot'),image=decodedMascot||make('img');if(!decodedMascot)image.src=root.DuPortraits?.[0]?.image||'/marca.png';image.alt=w.du;image.width=84;image.height=84;mascot.append(image);if(model.level>1){const badge=make('span','✦','feed-accessory');badge.setAttribute('aria-hidden','true');mascot.append(badge);}c.mascot=mascot;
    const stats=make('div',undefined,'feed-stats'),xpBar=make('progress'),hunger=make('progress',undefined,'feed-hunger');xpBar.max=hunger.max=100;xpBar.value=model.levelXp;hunger.value=model.hunger;xpBar.setAttribute('aria-label',w.next);hunger.setAttribute('aria-label',w.hunger);
    stats.append(make('strong',w.level+' '+model.level,'feed-level'),make('span',model.levelXp+' / 100 XP','feed-xp'),xpBar,make('small',model.hunger>50?w.full:w.hungry,'feed-hunger-copy'),hunger);stage.append(mascot,stats,make('span','✦ '+model.streak+' '+(model.streak===1?({pt:'dia seguido',en:'day streak',es:'día seguido'}[c.locale]):w.streak),'feed-streak'));host.append(stage);
    if(!model.tips.length){host.append(make('p',w.empty,'feed-empty'));return;}
    const tip=model.tips.find(item=>item.id===c.selected)||model.tips[0],content=tip[c.locale==='pt'?'pt':'en'],card=make('article',undefined,'feed-card rarity-'+tip.raridade),head=make('div',undefined,'feed-card-head');head.append(make('span',w.rarity[tip.raridade],'feed-rarity'),make('span','+'+tip.xp+' XP','feed-reward'));const cardTitle=make('h3',titleOf(tip,c.locale));cardTitle.tabIndex=-1;card.append(head,cardTitle);
    if(c.locale==='es')card.append(make('small',w.english,'feed-language-note'));
    const prompt=make('p',textOf(tip,c.locale),'feed-prompt');prompt.tabIndex=0;
    if(tip.locked)card.append(make('p','◇ '+w.locked+' '+tip.unlockLevel,'feed-locked-note'));else{card.append(prompt);if(typeof content?.porque==='string')card.append(make('p',content.porque,'feed-why'));}
    const action=button(tip.locked?w.locked+' '+tip.unlockLevel:tip.fedToday?w.copyAgain:w.feed,'feed-action',()=>feed(host,c,tip,prompt,action));action.disabled=tip.locked||c.busy;card.append(action);if(tip.eatenForReal)card.append(make('span','✦ '+w.real,'feed-real'));else if(tip.fedToday)card.append(make('span','✓ '+w.fed,'feed-today'));host.append(card);if(!tip.locked&&root.PanelCopySession){const group=root.PanelCopySession.create({lang:c.locale,label:w.copyAgain,text:textOf(tip,c.locale),writesFile:false,target:c.copyTarget||'claude',onTargetChange:target=>{c.copyTarget=target;}});group.button.hidden=true;group.button.setAttribute('aria-hidden','true');card.append(group.switcher,group.phrase);c.copyPhrase=group.phrase;c.copyGroup=group;}
    const status=make('p',c.status||(c.snapshot?.example?w.example:c.snapshot?.public?w.local:''),'feed-status');status.setAttribute('role',c.success?'status':'alert');status.hidden=!status.textContent;host.append(status);c.statusNode=status;
    const collection=make('details',undefined,'feed-collection');collection.open=c.collectionOpen===true;const summary=make('summary',w.collection+' · '+model.collected.length+' / '+model.collectionTotal),grid=make('div',undefined,'feed-grid');collection.addEventListener('toggle',()=>{c.collectionOpen=collection.open;});
    for(const item of model.tips){const entry=button(undefined,'feed-mini rarity-'+item.raridade+(item.id===c.selected?' selected':'')+(item.locked?' locked':''),()=>{if(c.busy)return;c.selected=item.id;c.status='';c.signature=null;draw(host,c);host.querySelector('.feed-card h3')?.focus();});entry.setAttribute('aria-pressed',String(item.id===c.selected));entry.setAttribute('aria-label',titleOf(item,c.locale)+', '+w.rarity[item.raridade]+(item.locked?', '+w.locked+' '+item.unlockLevel:''));entry.append(make('span',item.locked?'◇':model.collected.includes(item.id)?'✓':'✧','feed-mini-icon'),make('span',titleOf(item,c.locale)),make('small',item.locked?w.level+' '+item.unlockLevel:'+'+item.xp+' XP'));grid.append(entry);}collection.append(summary,grid);host.append(collection);
  }
  async function copyPrompt(text,prompt){try{if(root.navigator?.clipboard?.writeText){await root.navigator.clipboard.writeText(text);return true;}}catch{}try{const selection=root.getSelection(),range=root.document.createRange();range.selectNodeContents(prompt);selection.removeAllRanges();selection.addRange(range);return root.document.execCommand('copy');}catch{return false;}}
  function animate(c,start,gained,levelUp){
    if(root.document.documentElement.dataset.motion==='off')return;
    if(root.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
    try{const end=c.mascot.getBoundingClientRect(),crumb=root.document.createElement('span');crumb.className='feed-flying';crumb.textContent='✦';root.document.body.append(crumb);crumb.animate([{transform:`translate(${start.left+start.width/2}px,${start.top}px) scale(1)`,opacity:1},{transform:`translate(${end.left+end.width/2}px,${end.top+end.height*.6}px) scale(.25)`,opacity:0}],{duration:450,easing:'cubic-bezier(.2,.8,.4,1)'}).onfinish=()=>crumb.remove();
      c.mascot.animate([{transform:'scale(1)'},{transform:'scale(1.08,.94)'},{transform:'scale(.96,1.03)'},{transform:'scale(1)'}],{duration:500});const pop=root.document.createElement('span');pop.className='feed-xp-pop';pop.textContent='+'+gained+' XP';c.mascot.append(pop);pop.animate([{transform:'translateY(0)',opacity:1},{transform:'translateY(-28px)',opacity:0}],{duration:750}).onfinish=()=>pop.remove();if(levelUp){c.mascot.classList.add('feed-level-up');for(let index=0;index<7;index++){const spark=root.document.createElement('span');spark.className='feed-confetti';spark.textContent='✧';c.mascot.append(spark);spark.animate([{transform:'translate(0,0) scale(.4)',opacity:1},{transform:`translate(${(index-3)*16}px,${-30-(index%3)*13}px) scale(1)`,opacity:0}],{duration:650}).onfinish=()=>spark.remove();}}
    }catch{}
  }
  async function feed(host,c,tip,prompt,action){
    if(c.busy||tip.locked)return;const w=words[c.locale],originalLevel=c.model.level,start=action.getBoundingClientRect();let reward;
    c.busy=true;action.disabled=true;action.textContent=w.saving;c.options.onUserGesture?.();root.document.dispatchEvent(new root.CustomEvent('painel:user-gesture'));if(!c.muted&&!(typeof c.options.isMuted==='function'&&c.options.isMuted()))resumeAudio();
    const report=(text,success=false)=>{c.status=text;c.success=success;};
    try{
      if(!await copyPrompt(textOf(tip,c.locale).replaceAll('Claude Code',c.copyGroup?.getTarget?.()==='codex'?'Codex':'Claude Code'),prompt)){report(w.copyError);return;}
      if(c.snapshot?.example===true||tip.fedToday){report(w.ready,true);return;}
      let gained=0,reason;
      if(c.snapshot?.public===true){const result=publicFeed(c.snapshot,c.publicSaved,tip.id);gained=result.gained;reason=result.reason;storage().setItem(STORE,JSON.stringify(result.saved));c.publicSaved=result.saved;c.model=result.model;}
      report(reason==='daily-limit'?w.limit:w.ready+(gained?' +'+gained+' XP':''),true);if(gained){reward={gained,levelUp:c.model.level>originalLevel};if(!c.muted&&!(typeof c.options.isMuted==='function'&&c.options.isMuted()))playSound(reward.levelUp);}
      root.document.dispatchEvent(new root.CustomEvent('painel-feed-saved',{detail:{id:tip.id,gained,level:c.model.level}}));
    }catch{report(w.saveError);}finally{c.busy=false;c.signature=null;draw(host,c);host.querySelector('.feed-action')?.focus({preventScroll:true});if(reward)root.requestAnimationFrame(()=>animate(c,start,reward.gained,reward.levelUp));}
  }
  const api={render,tipsOf,textOf,modelOf,publicModel,publicFeed,realBonusOf,readMuted,saveMuted,XP};if(typeof module==='object'&&module.exports)module.exports=api;else root.DuTips=api;
})(typeof window==='object'?window:globalThis);
