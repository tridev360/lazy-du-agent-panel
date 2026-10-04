(function(root){
  'use strict';
  const panelStorage=()=>root.PanelStorage?.storage()??((root.location?.search&&new URLSearchParams(root.location.search).get('example')==='1')?null:root.localStorage);
  const d=root.document,$=id=>d.getElementById(id),params=new URLSearchParams(root.location.search);
  const words={
    en:{example:"View example",newTab:"Opens in a new tab. Your setup stays here.",sample:"Fictional example.",returnTab:"Back to setup closes this example tab.",backSetup:"Back to setup",fallbackSetup:"Set up in this tab",title:'Make room for your AI.',intro:'Two choices. You can change them whenever you like.',size:'How big is your project?',sizes:['Just me','Small team','Large project'],goal:'What do you want to follow?',goals:['My next step','My team','Usage and limits'],skip:'Skip for now',back:'Back',setup:'Set up my panel',teach:'Teach your AI (optional)',saved:'Your panel is ready.',privacy:'Local on this computer. No account needed.',close:'Close panel',closed:'Panel closed. Open the launcher to return.',failed:'Could not close. Try again.'},
    pt:{example:"Ver exemplo",newTab:"Abre em outra aba. Sua configuração continua aqui.",sample:"Exemplo fictício.",returnTab:"Voltar à configuração fecha esta aba do exemplo.",backSetup:"Voltar à configuração",fallbackSetup:"Configurar nesta aba",title:'Abra espaço para sua IA.',intro:'Duas escolhas. Você pode trocar quando quiser.',size:'Qual o tamanho do seu projeto?',sizes:['Só eu','Time pequeno','Projeto grande'],goal:'O que você quer acompanhar?',goals:['Meu próximo passo','Minha equipe','Consumo e limites'],skip:'Pular por agora',back:'Voltar',setup:'Configurar meu painel',teach:'Ensinar minha IA (opcional)',saved:'Seu painel está pronto.',privacy:'Local neste computador. Sem conta.',close:'Fechar painel',closed:'Painel fechado. Abra o atalho para voltar.',failed:'Não consegui fechar. Tente de novo.'},
    es:{example:"Ver el ejemplo",newTab:"Se abre en otra pestaña. Tu configuración sigue aquí.",sample:"Ejemplo ficticio.",returnTab:"Volver a la configuración cierra esta pestaña del ejemplo.",backSetup:"Volver a la configuración",fallbackSetup:"Configurar en esta pestaña",title:'Haz espacio para tu IA.',intro:'Dos elecciones. Puedes cambiarlas cuando quieras.',size:'¿Qué tamaño tiene tu proyecto?',sizes:['Solo yo','Equipo pequeño','Proyecto grande'],goal:'¿Qué quieres seguir?',goals:['Mi siguiente paso','Mi equipo','Uso y límites'],skip:'Omitir por ahora',back:'Volver',setup:'Configurar mi panel',teach:'Enseña a tu IA (opcional)',saved:'Tu panel está listo.',privacy:'Local en este ordenador. Sin cuenta.',close:'Cerrar panel',closed:'Panel cerrado. Abre el acceso para volver.',failed:'No se pudo cerrar. Reintenta.'}
  };
  function get(){try{return JSON.parse(panelStorage().getItem('agent-panel-profile'));}catch{return null;}}
  function preferredLanguage(){try{return params.get('lang')||panelStorage().getItem('agent-panel-language')||d.documentElement.lang||'en';}catch{return params.get('lang')||d.documentElement.lang||'en';}}
  let profile=get(),lang=preferredLanguage(),active=params.get('setup')==='1'||!profile,step=0,size=profile?.size||'solo',returnView=d.body.dataset.view||'home';
  const w=()=>words[lang]||words.en;
  const view=goal=>goal==='team'?'team':goal==='usage'?'usage':'home';
  function el(tag,text,cls){const e=d.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;}
  function button(text,run){const e=el('button',text);e.type='button';e.onclick=run;return e;}
  function locale(){return Object.hasOwn(words,lang)?lang:'en';}
  function canCloseExample(){if(root.history?.length!==1)return false;try{const from=new URL(d.referrer);return from.origin===root.location.origin&&from.searchParams.get('example')!=='1';}catch{return false;}}
  function exampleReturn(){
    if(params.get('example')!=='1'||params.get('entry')!=='welcome')return;
    const t=w();let banner=$('welcome-example-banner');
    if(!banner){
      banner=el('section',null,'welcome-example-banner');banner.id='welcome-example-banner';
      const note=el('p');note.id='welcome-example-note';const back=el('a');back.id='welcome-example-return';
      back.onclick=event=>{if(!canCloseExample())return;event.preventDefault();try{root.close();}catch{}const fallback=$('welcome-example-fallback');fallback.hidden=false;fallback.focus();};
      const fallback=el('a');fallback.id='welcome-example-fallback';fallback.hidden=true;banner.append(note,back,fallback);$('main').prepend(banner);
    }
    const tabs=$('view-tabs');if(tabs?.before&&banner.nextElementSibling!==tabs)tabs.before(banner);
    const closes=canCloseExample(),href='/?setup=1&lang='+locale();
    $('welcome-example-note').textContent=t.sample+(closes?' '+t.returnTab:'');
    $('welcome-example-return').textContent=closes?t.backSetup:t.fallbackSetup;$('welcome-example-return').href=href;
    $('welcome-example-fallback').textContent=t.fallbackSetup;$('welcome-example-fallback').href=href;
  }
  function hide(){root.PanelTutorial?.retire('welcome',()=>$('setup-guide'));active=false;delete d.body.dataset.welcome;$('welcome').hidden=true;}
  function select(value){root.PanelV2?.select(value);( $('tab-'+value)||$('tab-home'))?.focus();}
  function finish(goal='next',skip=false){
    const revisiting=!!profile;
    if(skip&&revisiting){hide();if(returnView==='home'&&root.PanelOnboarding?.isGuiding?.())root.PanelOnboarding.focus();else select(returnView);return;}
    profile={version:2,size,goal,mode:size==='large'?'pro':size==='small'?'explorer':'beginner',skipped:skip};
    try{panelStorage().setItem('agent-panel-profile',JSON.stringify(profile));}catch{}
    hide();root.PanelClean?.setProfile(profile);
    if(!skip&&params.get('example')!=='1'&&root.PanelOnboarding?.start&&(!revisiting||root.PanelOnboarding.isGuiding?.()))root.PanelOnboarding.start({goal});
    else if(skip&&root.PanelOnboarding?.skip)root.PanelOnboarding.skip({goal});
    else select(view(goal));
  }
  function render(focus=false){exampleReturn();root.PanelTutorial?.language(lang);const host=$('welcome'),t=w(),previous=d.activeElement,owned=host.contains?.(previous)&&!previous?.dataset?.panelTutorial,focusId=owned?previous.id:null;host.hidden=!active;$('setup-guide').textContent=t.setup;if(!active)return;d.body.dataset.welcome='on';host.replaceChildren();host.append(el('p','1 / 2','clean-step'),el('h1',t.title),el('p',t.intro,'summary-note'));const example=el('a',t.example);example.id='welcome-example';example.href='/?example=1&size=solo&lang='+locale()+'&entry=welcome';example.target='_blank';example.rel='noopener';example.referrerPolicy='same-origin';const exampleNote=el('p',t.newTab,'summary-note');exampleNote.id='welcome-example-new-tab';host.append(example,exampleNote);const title=el('h2',step===0?t.size:t.goal);title.id='welcome-step-title';title.tabIndex=-1;host.append(title);host.querySelector('.clean-step').textContent=(step+1)+' / 2';const group=el('div',null,'clean-choices');group.setAttribute('role','group');group.setAttribute('aria-label',title.textContent);const keys=step===0?['solo','small','large']:['next','team','usage'];(step===0?t.sizes:t.goals).forEach((text,i)=>{const choice=button(text,()=>{if(step===0){size=keys[i];step=1;render(true);}else finish(keys[i]);});choice.id='welcome-choice-'+keys[i];if(step===0)choice.setAttribute('aria-pressed',String(size===keys[i]));group.append(choice);});host.append(group);const actions=el('div',null,'clean-setup-actions');if(step){const back=button(t.back,()=>{step=0;render(true);});back.id='welcome-back';actions.append(back);}const skip=button(t.skip,()=>finish('next',true));skip.id='welcome-skip';actions.append(skip);if(root.PanelTeach)actions.append(button(t.teach,()=>root.PanelTeach.open(lang)));host.append(actions,el('p',t.privacy,'summary-note'));const tutorial=el('div');tutorial.dataset.tutorialEntry='welcome';host.append(tutorial);root.PanelTutorial?.mount(tutorial,{entry:'welcome',language:lang});if(focus)title.focus();else if(owned&&(!d.activeElement||d.activeElement===previous||d.activeElement===d.body))(d.getElementById(focusId)||title).focus();}
  function show(){returnView=d.body.dataset.view||view(profile?.goal);size=profile?.size||'solo';active=true;step=0;render(true);root.PanelOnboarding?.visibility?.();}
  root.PanelWelcome={useGuidedSetup(){hide();},isActive:()=>active,render(data,locale){lang=locale||lang;const quit=$('quit-panel');quit.hidden=!data.desktop;quit.textContent=w().close;render();},language(locale){lang=locale;render();},show};
  $('setup-guide').onclick=show;
  $('quit-panel').onclick=async()=>{try{const r=await root.fetch('/api/exit',{method:'POST'});if(!r.ok)throw Error();d.body.dataset.stopped='true';const p=el('section',w().closed);p.id='panel-closed';$('main').prepend(p);}catch{root.panelToast?.(w().failed);}};
  if(params.get('example')==='1')active=false;if(!active)delete d.body.dataset.welcome;render(params.get('setup')==='1'&&active);
})(window);
