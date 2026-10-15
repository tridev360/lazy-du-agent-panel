'use strict';
(function(root){
 const model=typeof module==='object'&&module.exports?require('./grok-modelo.js'):root.PainelGrokModelo;
 const instances=new WeakMap(),abertos=new Set();let ultimo=null;
 const num=v=>typeof v==='number'&&Number.isFinite(v)?(Math.round(v*10)/10).toLocaleString('pt-BR'):'?';
 const plural=n=>n+(n===1?' sessão':' sessões');
 function render(doc,host,data,place='fluxo'){
  if(!host)return;const sig=JSON.stringify(data,(key,value)=>key==='lidoEm'?undefined:value),old=instances.get(host);if(old?.sig===sig)return;
  const open=abertos.has(place)||host.querySelector('details')?.open===true;
  const el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
  const g=data||model.unknown(Date.now(),'leitura em curso'),card=el('section','grok-card');card.dataset.family='grok';card.dataset.place=place;card.setAttribute('aria-label','Grok, olhos no X');
  const head=el('div','grok-head'),du=el('img','grok-du');du.src='/du.png';du.alt='';du.width=44;du.height=44;
  const title=el('div','grok-title'),label=el('h3','','Grok'),role=el('span','','olhos no X');title.append(label,role);
  const active=g.sessoes?.filter(s=>s.estado==='trabalhando')||[],stale=g.sessoes?.filter(s=>s.estado==='parada sem fechar')||[],state=el('span','grok-state',active.length?'trabalhando':stale.length?'parada sem fechar':g.ok?'descansando':'leitura pendente');state.setAttribute('role','status');head.append(du,title,state);
  const explain=el('p','grok-explain','Pesquisa o X. A fonte confere o que ela sugere.'),usage=el('div','grok-usage');
  for(const [key,label] of [['hoje','Hoje'],['semana','Semana']]){const box=el('div','grok-metric'),value=g[key];box.append(el('span','',label),el('strong','',value?.sessoes===null||value?.sessoes===undefined?'?':plural(value.sessoes)),el('span','',value?.minutos===null||value?.minutos===undefined?(stale.length?'? (sessão parada sem fechar)':'leitura pendente'):num(value.minutos)+' min'));usage.append(box);}
  const details=el('details','grok-details');details.open=open;details.addEventListener('toggle',()=>{if(details.open)abertos.add(place);else abertos.delete(place);});const summary=el('summary','','Ver uso e fonte');summary.addEventListener('click',()=>{if(details.open)abertos.delete(place);else abertos.add(place);});details.append(summary);
  if(stale.length)details.append(el('p','grok-solution','Minutos: ?; a COORDENADOR fecha as sessões paradas com a hora real do fim.'));
  details.append(el('p','grok-limit','Limite: ?; '+model.LIMIT_SOLUTION));
  if(!g.ok)details.append(el('p','grok-solution','Solução: '+(g.solucao||'o painel relê em 15 s')));
  if((g.sessoes||[]).some(s=>s.solucaoDetalhe))details.append(el('p','grok-solution','Onde aparece "?": '+model.SEM_REGISTRO+'. Solução: '+model.COMO_REGISTRAR+'.'));
  for(const s of [...active,...stale,...(g.sessoes||[]).filter(s=>!active.includes(s)&&!stale.includes(s))].slice(0,12))details.append(sessao(el,s,g));
  details.append(el('small','grok-source',(g.fonte||'estado/grok-uso.jsonl')+' · leitura '+(g.lidoEm?new Date(g.lidoEm).toLocaleTimeString('pt-BR'):'pendente')));
  card.append(head,explain);
  card.append(usage);

  for(const s of [...active,...stale].slice(0,3)){const line=el('p','grok-current',(s.estado==='parada sem fechar'?'Parada sem fechar: ':'')+model.safeQuem(s.quem)+' pediu: '+model.safeTema(s.tema));card.append(line);if(s.solucao)card.append(el('p','grok-solution',s.solucao));}
  if(g.ok&&g.recusadas>0)card.append(el('p','grok-solution',g.recusadas+(g.recusadas===1?' linha recusada':' linhas recusadas')+' no registro; a COORDENADOR confere o arquivo. As outras estão acima.'));
  if(!g.ok)card.append(el('p','grok-solution','Solução: '+(g.solucao||'o painel relê em 15 s')));
  card.append(details);host.replaceChildren(card);instances.set(host,{sig});
 }
  function tempo(s,g){if(s.fim===null||s.fim===undefined)return 'começou há '+num(s.idadeMin)+' min';const a=Date.parse(s.inicio),b=Date.parse(s.fim),ref=g?.lidoEm?Date.parse(g.lidoEm):Date.now();const dur=Number.isFinite(a)&&Number.isFinite(b)?(b-a)/60000:null,ago=Number.isFinite(b)&&Number.isFinite(ref)?Math.max(0,Math.round((ref-b)/60000)):null;const fimBrt=Number.isFinite(b)?new Date(b-3*3600000).toISOString():null,hora=fimBrt?fimBrt.slice(11,16):'?';return 'durou '+num(dur)+' min · '+(ago!==null&&ago<720?'acabou às '+hora+' (há '+ago+' min)':'acabou '+(fimBrt?fimBrt.slice(8,10)+'/'+fimBrt.slice(5,7)+' às '+hora:'?'));}

 function sessao(el,s,g){
  const item=el('article','grok-session'),aberta=s.fim===null||s.fim===undefined,topo=el('div','grok-session-top'),sem=model.SEM_REGISTRO||'quem pesquisou não registrou';
  const selo=el('span','grok-selo '+(aberta?'is-anda':s.cor?'is-'+s.cor:'is-nd'),aberta?(s.estado||'trabalhando'):(s.achadoTexto||'?'));
  selo.title=aberta?'sessão em curso':s.achado?'resultado registrado por quem pesquisou':'resultado: ? ('+sem+')';
  topo.append(el('strong','grok-titulo',s.titulo||(aberta?'pesquisa em curso':'? ('+(s.tituloMotivo||sem)+')')),selo);item.append(topo);
  if(!aberta)item.append(el('p','grok-serviu',(s.achado==='falhou'?'O que houve: ':'Serviu para: ')+(s.serviu||'? ('+(s.serviuMotivo||sem)+')')));
  item.append(el('p','grok-pedido',model.safeQuem(s.quem)+' pediu: '+model.safeTema(s.tema)),el('small','',tempo(s,g)+(s.aprox?' · horário aproximado':'')));
  if(s.solucao)item.append(el('p','grok-solution',s.solucao));
  return item;
 }
 function mount(doc,parent,data,place){if(!parent)return;let host=parent.querySelector('.grok-host');if(!host){host=doc.createElement('div');host.className='grok-host';parent.append(host);}render(doc,host,data,place);return host;}
 function start(win){const doc=win.document;if(!doc)return;let data=null,busy=false,observer=null,timer=null,queued=false;
  const draw=()=>{queued=false;for(const [id,place] of [['g-fluxo','fluxo'],['pe-equipe','equipe'],['panel-team','equipe'],['g-agora','agora'],['fh-agora','agora'],['fz-consumo','consumo'],['panel-consumption','consumo']]){const parent=doc.getElementById(id);if(parent&&id==='g-fluxo'&&doc.getElementById('fz-consumo')){parent.querySelector('.grok-host')?.remove();continue;}if(parent&&(id!=='panel-team'||!doc.getElementById('pe-equipe')))mount(doc,parent,data,place);}};
  const queue=()=>{if(queued)return;queued=true;win.requestAnimationFrame(draw);};
  const example=new URLSearchParams(win.location.search).get('exemplo')==='1';
  async function refresh(){if(busy||(doc.hidden&&data))return;busy=true;let guard=null;try{const ctl=win.AbortController&&win.setTimeout?new win.AbortController():null;if(ctl)guard=win.setTimeout(()=>ctl.abort(),8000);const r=await win.fetch('/api/grok'+(example?'?exemplo=1':''),{cache:'no-store',redirect:'error',...(ctl?{signal:ctl.signal}:{})});if(!r.ok)throw Error();data=await r.json();}catch{data=model.unknown(Date.now(),'não foi possível atualizar');}finally{if(guard)win.clearTimeout(guard);busy=false;ultimo=data;draw();try{win.dispatchEvent(new win.CustomEvent('grok-dados'));}catch{}}}
  draw();refresh();timer=win.setInterval(refresh,15000);if(win.MutationObserver){observer=new win.MutationObserver(queue);observer.observe(doc.body,{childList:true,subtree:true});}
  doc.addEventListener('visibilitychange',()=>{if(!doc.hidden)refresh();});win.addEventListener('pagehide',()=>{win.clearInterval(timer);observer?.disconnect();});
  return {refresh};
 }
 const api={render,mount,start,last:()=>ultimo};if(typeof module==='object'&&module.exports)module.exports=api;else{root.PainelGrokUI=api;if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>start(root),{once:true});else start(root);}
})(typeof window==='object'?window:globalThis);
