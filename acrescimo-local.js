'use strict';
(() => {
  const records=new Map(),paths={council:'/api/conselho',finances:'/api/financas',journey:'/api/jornada'};
  let stopped=false,nonce=null;
  let audio,stampCount=0;
  const muted=()=>{try{return localStorage.getItem('painel-feed-muted-v1')!=='0';}catch{return true;}};
  function gesture(){if(muted())return;try{const Audio=window.AudioContext||window.webkitAudioContext;if(Audio){audio||=new Audio();audio.resume?.();}}catch{}}
  // Reuses the existing feed confirmation's quiet two-note sound.
  function stampSound(){if(muted()||!audio||audio.state!=='running')return;try{const at=audio.currentTime,gain=audio.createGain(),variation=[.99,1,1.01][stampCount++%3];gain.connect(audio.destination);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.025,at+.015);gain.gain.exponentialRampToValueAtTime(.0001,at+.28);for(const [index,hz]of[210,285].entries()){const oscillator=audio.createOscillator();oscillator.type='sine';oscillator.frequency.setValueAtTime(hz*variation,at+index*.06);oscillator.connect(gain);oscillator.start(at+index*.06);oscillator.stop(at+.29);}}catch{}}
  const lang=()=>document.getElementById('language')?.value||document.documentElement.lang||'pt';
  const message=(pt,en,es)=>lang()==='en'?en:lang()==='es'?es:pt;
  for(const kind of Object.keys(paths)){
    const host=document.getElementById('acrescimo-'+kind);if(!host)continue;
    const record={loading:false,data:null};
    record.ui=window.PainelAcrescimoUI.create(document,host,kind,kind==='council'?{
      liveMesa:true,
      onGesture:gesture,onStamp:stampSound,isMuted:muted,
      toggleMute(){try{localStorage.setItem('painel-feed-muted-v1',muted()?'0':'1');}catch{}gesture();},
      onRefresh(){return load(kind,true);},
      async onQuestion(body,onEvent,signal){
        const response=await fetch('/api/conselho/pergunta',{method:'POST',headers:{'Content-Type':'application/json','X-Painel-Nonce':nonce},body:JSON.stringify(body),signal,redirect:'error'});
        if(!response.ok||!response.body)throw Error('question_not_started');
        const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',total=0;
        for(;;){const part=await reader.read();if(part.done)break;total+=part.value.length;if(total>128*1024)throw Error('response_too_large');buffer+=decoder.decode(part.value,{stream:true});let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);if(line.trim())onEvent(JSON.parse(line));}}
      },
      async onHistory(id){const response=await fetch('/api/conselho/conversa',{method:'POST',headers:{'Content-Type':'application/json','X-Painel-Nonce':nonce},body:JSON.stringify({id}),redirect:'error'});const result=await response.json();if(!response.ok||!result.ok)throw Error(result.motivo||'');return result.rows;},
      async onStop(turno){if(!turno)return;await fetch('/api/conselho/parar',{method:'POST',headers:{'Content-Type':'application/json','X-Painel-Nonce':nonce},body:JSON.stringify({turno}),redirect:'error'});},
      async onSeal(body){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);try{const response=await fetch('/api/conselho/selo',{method:'POST',headers:{'Content-Type':'application/json','X-Painel-Nonce':nonce},body:JSON.stringify(body),signal:controller.signal,redirect:'error'});const result=await response.json();if(!response.ok){const error=Error(result.message||'Seu selo não foi confirmado');error.code=result.error;throw error;}return result;}finally{clearTimeout(timer);}},
      onSaved(){load(kind);}
    }:{});records.set(kind,record);
  }
  async function load(kind,force=false){
    const r=records.get(kind);if(!r||stopped||document.hidden||document.getElementById('panel-'+kind)?.hidden)return false;
    if(r.loading){if(!force)return false;await r.pending;return load(kind,true);}
    r.loading=true;let settle; r.pending=new Promise(resolve=>{settle=resolve;});const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try{const suffix=new URLSearchParams(location.search).get('exemplo')==='1'?'?exemplo=1':'';
      const response=await fetch(paths[kind]+suffix,{cache:'no-store',redirect:'error',signal:controller.signal});const result=await response.json();if(!response.ok||result.ok!==true||!result.data)throw Error();
      if(kind==='council'){nonce=result.nonce;if(!Array.isArray(result.data.ideas)||!Array.isArray(result.data.members)||!Array.isArray(result.data.pool))throw Error();}
      if(kind==='finances'&&!Array.isArray(result.data.entries))throw Error();
      r.data=kind==='journey'?window.JourneyModel.compose(result.data,{marcos:result.marcos}):result.data;
      r.ui.status('');r.ui.update(r.data,{lang:lang()});
      return true;
    }catch{r.ui.status(message('Não foi possível atualizar. ','Could not update. ','No se pudo actualizar. ')+(r.data?message('A última leitura foi preservada.','The last reading was preserved.','La última lectura se conservó.'):message('Sem leitura.','No reading.','Sin lectura.')));return false;}
    finally{document.getElementById('acrescimo-'+kind).dataset.refinoState=r.data?'ready':'error';clearTimeout(timer);r.loading=false;settle();r.pending=null;}
  }
  const active=()=>document.documentElement.dataset.painelTab;
  document.addEventListener('painel:tab-change',event=>load(event.detail?.tab));
  document.getElementById('refresh')?.addEventListener('click',()=>load(active(),true));
  document.getElementById('language')?.addEventListener('change',()=>{for(const r of records.values())if(r.data)r.ui.update(r.data,{lang:lang()});});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load(active());});
  const timer=setInterval(()=>load(active()),30000);
  window.addEventListener('pagehide',()=>{stopped=true;clearInterval(timer);for(const r of records.values())r.ui.destroy();},{once:true});
  load(active());
})();
