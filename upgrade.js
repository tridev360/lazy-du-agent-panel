'use strict';
(function(root){
 const A=typeof module==='object'&&module.exports?require('./dados-auditados.js'):root.PainelDadosAuditados;
 const PANELS=['team','sessions','consumption','launches','projects','queue'];
 const SCOPES=[...PANELS.map(k=>'panel-'+k),'panel-tips','ideias-panel','cronograma-casa','rotina-card'];
 const words={pt:{more:'Ver mais',old:'antiga',recent:'recente',unread:'? sem fonte',partial:'leitura parcial',read:'leitura',reason:'Fonte indisponível nesta leitura',active:'trabalhando',records:'registros',projects:'projetos',needs:'pedidos do Dono',ready:'ramos prontos',none:'nenhum',closed:'itens concluídos',tokens:'tokens acumulados',water:'litros estimados',sessions:'sessões registradas',queue:'recados na fila'},en:{more:'Show more',old:'old',recent:'recent',unread:'? no source',partial:'partial reading',read:'reading',reason:'Source unavailable in this reading',active:'working',records:'records',projects:'projects',needs:'Owner requests',ready:'ready branches',none:'none',closed:'completed items',tokens:'accumulated tokens',water:'estimated litres',sessions:'recorded sessions',queue:'queued messages'},es:{more:'Ver más',old:'antigua',recent:'reciente',unread:'? sin fuente',partial:'lectura parcial',read:'lectura',reason:'Fuente no disponible en esta lectura',active:'trabajando',records:'registros',projects:'proyectos',needs:'pedidos del Dueño',ready:'ramas listas',none:'ninguno',closed:'items completados',tokens:'tokens acumulados',water:'litros estimados',sessions:'sesiones registradas',queue:'mensajes en cola'}};
 function metrics(snapshot,kind,pb,now=Date.now()){
  const s=snapshot||{},team=s.equipe,rows=team?.agents,active=(rows||[]).filter(a=>{const p=a.workProof,t=A.instant(p?.eventLastAt||a.lastAt);return p?.state==='working'&&t&&Date.parse(t)<=now&&now-Date.parse(t)<=300000;}).length;
  const count=v=>Array.isArray(v)?v.length:null,work=Array.isArray(rows)?team.countsExact===true?active:active>0?'≥ '+active:null:null;
  const closed=s.progress?.closed??s.progress?.done??s.management?.flow?.finished;
  const m=team?.consumption,measurement=m?.lastMeasurementAt||m?.readAt;
  const knownMeasure=!!A.instant(measurement)&&Date.parse(measurement)<=now;
  const values={team:[['active',work],['records',count(rows)],['projects',count(s.projects)]],sessions:[['sessions',pb?.count??null],['queue',pb?.pending??null]],consumption:[['tokens',knownMeasure&&Number.isFinite(team?.tokens)?team.tokens:null],['water',knownMeasure&&Number.isFinite(team?.waterMl)?team.waterMl/1000:null]],launches:[['records',count(s.launches?.items)],['needs',Array.isArray(s.launches?.items)?s.launches.items.filter(i=>i.estado==='espera voce').length:null]],projects:[['projects',count(s.projects)],['active',work]],queue:[['records',count(s.tasks)],['closed',Number.isFinite(closed)?closed:null],['ready',count(s.readyBranches)]]};
  const at=kind==='consumption'?measurement:kind==='launches'?s.launches?.updated:kind==='sessions'?pb?.readAt:s.metadataProof?.observedAt||s.proof?.observedAt||s.updated;
  return {values:values[kind]||[],frescor:kind==='consumption'&&m?.frescor?.velho?{texto:(m.frescor.motivo||'sem medida')+'. Solução: '+m.frescor.solucao}:null,source:A.source(at,now,kind==='consumption'?7200000:600000),partial:kind==='consumption'?team?.tokensExact!==true:kind==='team'||kind==='projects'?team?.countsExact!==true:kind==='sessions'?pb?.partial===true:s.readerStatus==='partial'};
 }
 // r11: "Ramos prontos" sem ramo registrado diz nenhum (nunca um 0 que parece medida); o resto segue o número
 // r11: a faixa da Equipe nao repete o "trabalhando" do heroi (contas diferentes davam 0 contra 1)
 function naFaixa(kind,values){return kind==='team'?values.filter(v=>v[0]!=='active'):values;}
 function textoValor(label,value,lg){const w=words[lg]||words.pt;if(label==='ready'&&value===0)return w.none;return Number.isFinite(value)?new Intl.NumberFormat(lg,{notation:value>=1e6?'compact':'standard',maximumFractionDigits:1}).format(value):value??'?';}
 function start(win){
  const doc=win.document;if(!doc)return {refresh(){},stop(){}};let stopped=false,queued=false,timer=null,last=new Map();const observers=[];
  const lang=()=>doc.getElementById('language')?.value||doc.documentElement.lang||'pt';
  const el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const snapshot=()=>{try{return typeof latestSnapshot!=='undefined'?latestSnapshot:null;}catch{return null;}};
  function allowed(node){for(let p=node.parentElement;p;p=p.parentElement){const tag=String(p.tagName||p.tag||'').toLowerCase();if(['button','a','dialog','summary','details','textarea'].includes(tag))return false;}return true;}
  function compact(host){
   const w=words[lang()]||words.pt;
   for(const p of [...host.querySelectorAll('p'),...host.querySelectorAll('.jpb-fala-text')]){
    if(p.className?.split(' ').includes('up-full')||!allowed(p)||p.closest('.up-strip'))continue;
    const full=p.textContent.trim(),style=win.getComputedStyle?.(p),line=Number.parseFloat(style?.lineHeight)||20,tooTall=!!style&&(p.getBoundingClientRect?.().height||0)>line*2.2;
    const overflowed=Number.isFinite(p.clientHeight)&&p.clientHeight>0&&p.scrollHeight>p.clientHeight+1;
    if(full.length<=110&&!tooTall&&!overflowed)continue;
    const details=el('details','up-more'),summary=el('summary','up-summary'),intro=full.split(/(?<=[.!?])\s+/)[0];summary.append(el('span','up-summary-text',intro.length>86?intro.slice(0,83).trimEnd()+'…':intro),el('span','up-more-label',w.more));details.append(summary);p.after(details);p.classList.add('up-full');details.append(p);
   }
   for(const d of host.querySelectorAll('.up-more')){const full=d.querySelector('.up-full')?.textContent.trim()||'',intro=full.split(/(?<=[.!?])\s+/)[0],n=d.querySelector('.up-summary-text'),label=d.querySelector('.up-more-label');if(n)n.textContent=intro.length>86?intro.slice(0,83).trimEnd()+'…':intro;if(label)label.textContent=w.more;}
  }
  function strip(kind,s,pb){
   const host=doc.getElementById('panel-'+kind);if(!host||host.hidden)return;const w=words[lang()]||words.pt,m=metrics(s,kind,pb),key=lang()+'|'+JSON.stringify(m);let shell=host.querySelector('.up-strip');if(shell?.dataset.signature===key)return;
   if(!shell){shell=el('section','up-strip');const title=host.querySelector('h1');if(title)title.after(shell);else host.prepend(shell);}shell.dataset.signature=key;shell.setAttribute('aria-label',({pt:'Resumo da fonte',en:'Source summary',es:'Resumen de la fuente'})[lang()]||'Resumo da fonte');shell.replaceChildren();
   const grid=el('div','up-heroes');for(const [label,value]of naFaixa(kind,m.values)){const card=el('article','up-hero'),id=kind+'|'+lang()+'|'+label,prior=last.get(id),text=textoValor(label,value,lang());last.set(id,value);const number=el('strong','up-number'+(text===w.none?' up-palavra':''),text);if(Number.isFinite(value)&&Number.isFinite(prior)&&value!==prior)number.classList.add('up-roll');card.append(el('span','up-label',w[label]||label),number);if(value===null)card.append(el('small','up-caption',m.frescor?m.frescor.texto:w.reason));grid.append(card);}shell.append(grid);
   const age=m.source.age===null?w.unread:w.read+' '+m.source.age+' min · '+(m.source.old?w.old:w.recent),proof=el('div','up-proof');proof.append(el('span','up-chip '+(m.source.age===null?'is-unknown':m.source.old?'is-old':'is-current'),age));if(m.partial)proof.append(el('span','up-chip',w.partial));if(m.source.reason)proof.append(el('small','up-caption',m.source.reason));shell.append(proof);
   if(kind==='queue'){const p=s?.progress,total=p?.total,closed=p?.closed??p?.done;if(Number.isFinite(total)&&total>0&&Number.isFinite(closed)&&closed>=0&&closed<=total){const track=el('div','up-track'),fill=el('span','up-fill');track.setAttribute('role','img');track.setAttribute('aria-label',closed+'/'+total+' '+w.closed);fill.style.setProperty('--up-scale',String(closed/total));track.append(fill);shell.append(track,el('small','up-caption',closed+'/'+total+' '+w.closed));}}
  }
  function refresh(value){
   queued=false;if(stopped||doc.hidden)return;const s=value&&(value.equipe||value.updated||value.tasks)?value:snapshot(),pb=win.PainelCoordenadorPB?.instance?.summary?.();for(const kind of PANELS)strip(kind,s,pb);
   for(const id of SCOPES){const host=doc.getElementById(id);if(host&&!host.hidden)compact(host);}
  }
  function enqueue(records){if(stopped||queued||doc.hidden)return;if(records?.length&&records.every(r=>r.target?.closest?.('.up-strip')||r.target?.closest?.('.up-more')))return;queued=true;(win.queueMicrotask||((fn)=>Promise.resolve().then(fn)))(()=>refresh());}
  function stop(){stopped=true;for(const o of observers)o.disconnect();if(timer!==null)win.clearInterval?.(timer);for(const name of ['painel:tab-change','visibilitychange'])doc.removeEventListener?.(name,refresh);doc.getElementById('language')?.removeEventListener?.('change',enqueue);win.removeEventListener?.('pagehide',stop);}
  for(const id of [...SCOPES]){const host=doc.getElementById(id);if(host&&win.MutationObserver){const observer=new win.MutationObserver(enqueue);observer.observe(host,{childList:true,subtree:true});observers.push(observer);}}
  // Cronograma mounts later; watch its mounting only, not every child of the page.
  if(!doc.getElementById('cronograma-casa')&&win.MutationObserver){const parent=doc.getElementById('rotina-card')?.parentElement;if(parent){const observer=new win.MutationObserver(()=>{const host=doc.getElementById('cronograma-casa');if(host&&!observers.some(o=>o.upCron)){const o=new win.MutationObserver(enqueue);o.upCron=true;o.observe(host,{childList:true,subtree:true});observers.push(o);enqueue();}});observer.observe(parent,{childList:true});observers.push(observer);}}
  doc.addEventListener('painel:tab-change',refresh);doc.addEventListener('visibilitychange',refresh);doc.getElementById('language')?.addEventListener('change',enqueue);win.addEventListener?.('pagehide',stop);timer=win.setInterval?.(()=>refresh(),30000);refresh();return {refresh,stop,compact};
 }
 const api={metrics,start,SCOPES,textoValor,naFaixa};if(typeof module==='object'&&module.exports)module.exports=api;else{root.PainelUpgrade=api;start(root);}
})(typeof globalThis==='object'?globalThis:this);
