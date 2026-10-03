(function(root){
  'use strict';
  const primary=['clean-wen','teach-copy-claude','resolve-start'];
  function buttonStyle(node){if(node.dataset?.button)return node.dataset.button;if(primary.includes(node.id)||node.matches?.('.teach-primary,.teach-copy,.teach-open,[data-primary]'))return 'primary';if(node.matches?.('.look-link,.card-link,.teach-codex,.teach-secondary,.teach-switch,a:not(.boot-retry),[role=tab]'))return 'link';return 'secondary';}
  const api={buttonStyle};if(typeof module==='object'&&module.exports)module.exports=api;if(!root.document)return;
  const d=root.document,$=id=>d.getElementById(id),group=$('panel-language'),original=$('language');
  function decorate(){for(const node of d.querySelectorAll('button,a.boot-retry,a.session-link,footer a,summary')){const style=buttonStyle(node);if(node.dataset.button!==style)node.dataset.button=style;}}
  const bootWords={en:{sessions:'Reading sessions...',overview:'Where things stand',completed:'Completed task',activity:'Recent activity',blocked:'Blocked by',speed:'Can we speed up?',next:'Your next step',credit:'Credit',reading:'Reading...',retry:'Reload panel'},pt:{sessions:'Lendo sessões...',overview:'Em que pé estamos',completed:'Tarefa concluída',activity:'Atividade recente',blocked:'Travado por',speed:'Dá para acelerar?',next:'Seu próximo passo',credit:'Crédito',reading:'Lendo...',retry:'Reabrir painel'},es:{sessions:'Leyendo sesiones...',overview:'Dónde estamos',completed:'Tarea terminada',activity:'Actividad reciente',blocked:'Bloqueado por',speed:'¿Podemos acelerar?',next:'Tu siguiente paso',credit:'Crédito',reading:'Leyendo...',retry:'Recargar panel'}};
  function sync(){const language=d.documentElement.lang||'en';for(const label of d.querySelectorAll('[data-boot-copy]')){const text=(bootWords[language]||bootWords.en)[label.dataset.bootCopy];if(text&&label.textContent!==text)label.textContent=text;}if(group){group.setAttribute('aria-label',language==='pt'?'Idioma':language==='es'?'Idioma':'Language');for(const button of group.querySelectorAll('[data-language]')){button.setAttribute('aria-pressed',String(button.dataset.language===language));button.dataset.button=button.dataset.language===language?'primary':'secondary';}}root.PanelStartup?.paint?.();}
  function choose(language){if(!['en','pt','es'].includes(language)||!original)return;original.value=language;d.documentElement.lang=language;try{root.localStorage.setItem('agent-panel-language',language);}catch{}original.dispatchEvent(new root.Event('change',{bubbles:true}));sync();}
  if(original){original.hidden=true;original.tabIndex=-1;original.setAttribute('aria-hidden','true');}
  if(group)for(const button of group.querySelectorAll('[data-language]'))button.onclick=()=>choose(button.dataset.language);
  if($('boot-retry'))$('boot-retry').onclick=()=>root.location.reload();
  d.addEventListener('change',()=>root.setTimeout(sync,0));
  if(root.MutationObserver)new root.MutationObserver(decorate).observe(d.body,{childList:true,subtree:true});
  if(original)choose(root.PanelLanguageInitial||d.documentElement.lang||'en');decorate();sync();
  root.PanelControls=Object.freeze({...api,sync,decorate});
})(typeof window==='object'?window:globalThis);
