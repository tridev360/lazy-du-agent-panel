'use strict';
(()=>{
  const host=document.getElementById('fluxo-host');if(!host)return;
  const ui=window.PainelFluxoUI.create(document,host),language=()=>document.getElementById('language')?.value||document.documentElement.lang||'pt';
  let stopped=false,busy=false,last=null,controller=null,flow=null,flowFailed=false,flowAttempt=null,clockTimer=null;
  // painel.js owns this snapshot. Read it without replacing or mutating it.
  const inventory=()=>typeof latestSnapshot==='object'&&latestSnapshot?latestSnapshot:null;
  function paint(){if(last)ui.update({...last,activity:window.PainelFluxoModel?.activity(inventory(),flow,Date.now()),activityFailed:flowFailed},{lang:language()});}
  function visible(){return !stopped&&!document.hidden&&document.documentElement.dataset.painelTab==='flow'&&!document.getElementById('panel-flow')?.hidden;}
  function syncClock(){clearTimeout(clockTimer);clockTimer=null;host.dataset.paused=String(!visible());if(!visible())return;ui.tickClock(Date.now());clockTimer=setTimeout(syncClock,1000);}
  async function load(){if(!visible()||busy)return;busy=true;controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
    try{const suffix=new URLSearchParams(location.search).get('exemplo')==='1'?'?exemplo=1':'',options={cache:'no-store',redirect:'error',signal:controller.signal};
      const queue=fetch('/api/fluxo'+suffix,options).then(async response=>{const result=await response.json();if(!response.ok||result.ok!==true||!Array.isArray(result.data?.tasks)||!Array.isArray(result.data?.stations)||!result.data?.proofs)throw Error();return result.data;});
      let messages=Promise.resolve();if(!suffix&&inventory()&&(flowAttempt===null||Date.now()-flowAttempt>=30000)){flowAttempt=Date.now();messages=fetch('/api/pe-equipe/fluxo',options).then(async response=>{const next=await response.json();if(!response.ok||next.ok!==true||!Array.isArray(next.nodes)||!Array.isArray(next.edges))throw Error();if(!stopped){flow=next;flowFailed=false;}}).catch(()=>{if(!stopped)flowFailed=true;});}
      const [read]=await Promise.allSettled([queue,messages]);if(stopped)return;if(read.status==='rejected')throw Error();last=read.value;ui.status('');paint();}
    catch{if(!stopped){const messages={pt:'Não foi possível atualizar. ',en:'Could not update. ',es:'No se pudo actualizar. '},kept={pt:'A última leitura foi preservada.',en:'The last reading was preserved.',es:'La última lectura se conservó.'};ui.status((messages[language()]||messages.pt)+(last?(kept[language()]||kept.pt):'?'));paint();}}
    finally{host.dataset.refinoState=last?'ready':'error';clearTimeout(timer);controller=null;busy=false;}
  }
  document.addEventListener('painel:tab-change',()=>{syncClock();if(visible())load();else ui.dismiss();});document.addEventListener('visibilitychange',()=>{syncClock();load();});
  document.getElementById('language')?.addEventListener('change',paint);
  const timer=setInterval(load,5000);window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(clockTimer);clearInterval(timer);controller?.abort();ui.destroy();},{once:true});load();syncClock();
})();
