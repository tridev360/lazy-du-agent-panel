'use strict';
(function(root){
 const doc=root.document;if(!doc)return;
 let tip=null,alvo=null,anterior=null;
 function fechar(){if(tip)tip.remove();if(alvo){if(anterior===null)alvo.removeAttribute('aria-describedby');else alvo.setAttribute('aria-describedby',anterior);}tip=null;alvo=null;}
 function mostrar(ev){const n=ev.target&&ev.target.closest&&ev.target.closest('[title]');if(!n||!n.title.trim())return;if(n===alvo)return;fechar();alvo=n;anterior=n.getAttribute('aria-describedby');tip=doc.createElement('aside');tip.className='r9-dica';tip.id='r9-dica';tip.setAttribute('role','tooltip');tip.textContent=n.title;doc.body.append(tip);n.setAttribute('aria-describedby',anterior?anterior+' '+tip.id:tip.id);const r=n.getBoundingClientRect();tip.style.setProperty('--r9-x',Math.max(8,Math.min(r.left,root.innerWidth-tip.offsetWidth-8))+'px');tip.style.setProperty('--r9-y',Math.max(8,Math.min(r.bottom+6,root.innerHeight-tip.offsetHeight-8))+'px');}
 doc.addEventListener('pointerover',mostrar);doc.addEventListener('focusin',mostrar);
 doc.addEventListener('pointerout',e=>{if(alvo&&e.relatedTarget&&alvo.contains(e.relatedTarget))return;fechar();});doc.addEventListener('focusout',fechar);
 doc.addEventListener('keydown',e=>{if(e.key==='Escape')fechar();});root.addEventListener('scroll',fechar,true);
})(window);
