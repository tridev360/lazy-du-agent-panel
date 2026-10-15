'use strict';
// Keep Tab inside the active native dialog and preserve Escape's native return.
document.addEventListener('keydown',event=>{
 if(event.key!=='Tab')return;const dialog=document.querySelector('dialog[open]');if(!dialog)return;
 const nodes=[...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),summary,[tabindex="0"]')].filter(n=>!n.hidden&&n.getBoundingClientRect().width&&n.getBoundingClientRect().height);
 const first=nodes[0],last=nodes.at(-1);if(!first)return;
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
},true);

// A local choice also stops programmatic motion; no server state is changed.
(function(){
 const key='app-panel-motion',button=document.createElement('button'),query=matchMedia('(prefers-reduced-motion: reduce)');let stored=null;
 try{stored=localStorage.getItem(key);}catch{}
 let off=stored==='off'||stored===null&&query.matches;button.id='motion-toggle';button.type='button';button.className='motion-toggle';
 function paint(){document.documentElement.dataset.motion=off?'off':'on';button.setAttribute('aria-pressed',String(off));const lang=document.documentElement.lang;
  button.textContent=lang==='pt'?'Movimento '+(off?'off':'on'):lang==='es'?'Movimiento '+(off?'off':'on'):'Motion '+(off?'off':'on');
  if(off)for(const animation of document.getAnimations())animation.cancel();
 }
 button.addEventListener('click',()=>{off=!off;stored=off?'off':'on';try{localStorage.setItem(key,stored);}catch{}paint();});
 query.addEventListener('change',()=>{if(stored===null){off=query.matches;paint();}});
 new MutationObserver(paint).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});const options=document.getElementById('panel-settings-options');options?.append(button);for(const id of ['fullscreen','refresh']){const control=document.getElementById(id);if(control)options?.append(control);}paint();
})();

// Put the existing chat action in the header on small screens, outside cards.
(()=>{
 const media=matchMedia('(max-width:900px)');let bound=false;
 function place(){const button=document.getElementById('painel-chat-trigger'),header=document.querySelector('.header-actions');if(!button||!header)return false;if(media.matches){if(button.parentNode!==header)header.prepend(button);}else if(button.parentNode!==document.body)document.body.append(button);if(!bound){media.addEventListener('change',place);bound=true;}return true;}
 if(!place()){const observer=new MutationObserver(()=>{if(place())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});}
})();
