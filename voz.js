(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports) module.exports=factory();
  else {
    var api=factory();
    function connect(){if(!api.mount(root.document))return false;root.PainelVoz=api.create(root.document,root);return true;}
    if(!connect()){
      var observer=new root.MutationObserver(function(){if(connect())observer.disconnect();});
      observer.observe(root.document.body,{childList:true,subtree:true});
    }
  }
})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  function mount(doc) {
    if(doc.getElementById('voz-widget'))return true;const host=doc.createElement('section');host.id='voz-widget';host.className='r10-painel';const make=(tag,id,text,parent)=>{const n=doc.createElement(tag);n.id='voz-'+id;if(text)n.textContent=text;if(tag==='button')n.type='button';parent.append(n);return n;};make('button','mic','Falar',host);make('button','conversa','Voz e texto',host);make('button','liga','Ligar voz',host);make('p','status','Voz local. Texto é alternativa.',host);const drawer=make('div','gaveta',null,host);drawer.hidden=true;make('button','fecha','Fechar',drawer);make('div','mensagens',null,drawer);const review=make('div','revisao',null,drawer);review.hidden=false;const input=make('textarea','texto',null,review);input.setAttribute('aria-label','Pedido para sua sessão');make('button','enviar','Registrar pedido',review);make('button','cancelar','Cancelar',review);make('button','mudo','Mudo',drawer);make('button','parar','Parar leitura',drawer);make('p','audio-status','Sem áudio até ligar.',drawer);(doc.getElementById('r10-controles')||doc.body).append(host);return true;
  }

  function create(doc,win) {
    var el=function(id){return doc.getElementById('voz-'+id);};
    var state='parado',rec=null,timer=null,enabled=false,muted=true,polling=false,destroyed=false;
    var since=new Date().toISOString(),seen=new Set(),generation=0,stopRequested=false;
    var holding=false,released=false,reviewTimer=null,lastSpoken='';
    function clearReview(){if(reviewTimer!==null){win.clearTimeout(reviewTimer);reviewTimer=null;}}
    var help='Abra o painel no Chrome e permita o microfone em '+((win.location&&win.location.host)||'127.0.0.1')+'.';
    function store(key,value){try{win.localStorage.setItem(key,value);}catch(e){}}
    try{enabled=win.localStorage.getItem('painel-voz-ligada')==='1';muted=win.localStorage.getItem('painel-voz-mudo')!=='0';}catch(e){}
    function setState(next,message) {
      state=next;el('widget').dataset.estado=next;
      el('status').textContent=message||({parado:'Pronto para falar.',ouvindo:'Ouvindo. Toque no microfone para revisar.',revisando:'Confira o texto antes de enviar.',enviando:'Enviando para a sua sessão...',erro:'Não foi possível continuar.'})[next];
      el('mic').textContent=next==='ouvindo'?'Revisar':'Falar';
      el('mic').setAttribute('aria-label',next==='ouvindo'?'Parar microfone e revisar fala':'Falar com a sua sessão');
      el('mic').setAttribute('aria-pressed',String(next==='ouvindo'));
      el('mic').disabled=next==='enviando'||next==='revisando';
      el('revisao').hidden=false;
      el('enviar').disabled=next==='enviando';el('cancelar').disabled=next==='enviando';
    }
    function open(){el('gaveta').hidden=false;doc.documentElement.dataset.vozConversa='aberta';el('conversa').setAttribute('aria-expanded','true');el('fecha').focus();}
    function stopSpeech(){try{win.speechSynthesis?.cancel();}catch(e){}}
    function setEnabled(value) {
      enabled=value;generation++;store('painel-voz-ligada',enabled?'1':'0');
      el('liga').textContent=enabled?'Desligar voz':'Ligar voz';el('liga').setAttribute('aria-pressed',String(enabled));
      if(timer!==null){win.clearInterval(timer);timer=null;}
      if(enabled) {timer=win.setInterval(poll,3000);}
      else {
        holding=false;released=false;clearReview();
        if(rec){var old=rec;rec=null;try{old.abort();}catch(e){}}
        stopSpeech();if(state==='ouvindo')setState('parado');
      }
    }
    function muteUI(){el('mudo').textContent=muted?'Ativar som':'Silenciar';el('mudo').setAttribute('aria-pressed',String(muted));}
    function addMessage(who,text) {
      var p=doc.createElement('p'),label=doc.createElement('strong'),content=doc.createElement('span');
      label.textContent=who+': ';content.textContent=text;p.append(label,content);el('mensagens').append(p);

      while(el('mensagens').children.length>100)el('mensagens').children[0].remove();
      el('mensagens').scrollTop=el('mensagens').scrollHeight;
    }
    function localVoice() {
      try {
        var voices=win.speechSynthesis.getVoices().filter(function(v){return /^pt[-_]BR$/i.test(v.lang)&&v.localService===true;});
        return voices.find(function(v){return /Microsoft Maria/i.test(v.name);})||voices[0];
      } catch(e){return null;}
    }
    function speak(text) {
      var voice=localVoice();
      if(!voice||!win.SpeechSynthesisUtterance){el('audio-status').textContent='Sem voz pt-BR local. Respostas só em texto.';return;}
      el('audio-status').textContent=muted?'Som silenciado.':'Voz: '+voice.name;
      if(muted||state==='ouvindo')return;
      try {var utterance=new win.SpeechSynthesisUtterance(text);utterance.voice=voice;utterance.lang='pt-BR';win.speechSynthesis.speak(utterance);lastSpoken=text;}catch(e){el('audio-status').textContent='Não foi possível falar. A resposta está em texto.';}
    }
    async function poll() {
      if(!enabled||destroyed||polling)return;
      polling=true;var current=generation;
      try {
        var response=await win.fetch('/api/voz/respostas?desde='+encodeURIComponent(since),{cache:'no-store'});
        if(!response.ok)throw Error();var data=await response.json();
        if(current!==generation||!enabled||destroyed)return;
        if(!Array.isArray(data.respostas))throw Error();
        data.respostas.forEach(function(row){
          if(typeof row.ts!=='string'||!Number.isFinite(Date.parse(row.ts))||typeof row.texto!=='string')return;
          var key=row.ts+'\n'+row.texto;
          if(seen.has(key))return;seen.add(key);if(seen.size>200)seen.delete(seen.values().next().value);
          if(row.ts>since)since=row.ts;
          addMessage('sua sessão',row.texto);speak(row.texto);
        });
        if(el('audio-status').dataset.falha==='1'){el('audio-status').dataset.falha='0';el('audio-status').textContent='Conexão com a sua sessão restaurada.';}
      } catch(e){if(enabled&&current===generation){el('audio-status').dataset.falha='1';el('audio-status').textContent='Não foi possível consultar a sua sessão. Tentando de novo em 3 segundos.';}}
      finally {polling=false;}
    }
    function cancel() {
      if(state==='enviando')return;
      holding=false;released=false;clearReview();
      if(rec){var old=rec;rec=null;try{old.abort();}catch(e){}}
      el('texto').value='';setState('parado');
    }
    function mic() {
      if(state==='enviando'||state==='revisando')return;
      if(state==='ouvindo'&&rec){if(!stopRequested){stopRequested=true;try{rec.stop();}catch(e){setState('erro','Não foi possível parar o microfone. '+help);}}return;}
      var Recognition=win.webkitSpeechRecognition||win.SpeechRecognition;
      if(!Recognition){setState('erro',help);return;}
      setEnabled(true);stopSpeech();el('texto').value='';stopRequested=false;
      try {
        var active=new Recognition();rec=active;
        active.lang='pt-BR';active.continuous=true;active.interimResults=false;
        var finals=[];
        active.onresult=function(event){
          if(rec!==active||state!=='ouvindo')return;
          for(var i=event.resultIndex;i<event.results.length;i++)if(event.results[i].isFinal)finals[i]=event.results[i][0].transcript;
          el('texto').value=finals.filter(Boolean).join(' ').trim();
        };
        active.onerror=function(event){
          if(rec!==active)return;
          holding=false;released=false;clearReview();
          setState('erro',event.error==='not-allowed'||event.error==='service-not-allowed'?help:'Não foi possível reconhecer a fala. '+help);
        };
        active.onend=function(){
          if(rec!==active)return;rec=null;
          if(state==='erro')return;
          setState(el('texto').value?'revisando':'erro',el('texto').value?null:'Não reconheci nenhuma fala. Toque no microfone e tente novamente.');
          if(el('texto').value){
            if(holding){

              if(released)reviewAndSend();
            }else el('texto').focus();
          }else {holding=false;released=false;}
        };
        setState('ouvindo');var go=function(){if(rec!==active)return;try{active.start();}catch(e){rec=null;setState('erro',help);}};try{if(typeof Recognition.available!=='function'){rec=null;setState('erro','Reconhecimento local indisponível. Use o texto.');return;}Recognition.available({langs:['pt-BR'],processLocally:true}).then(function(r){if(r==='available'){active.processLocally=true;go();}else{rec=null;setState('erro','Reconhecimento local indisponível. Use o texto.');}},function(){rec=null;setState('erro','Reconhecimento local indisponível. Use o texto.');});}catch(e){rec=null;setState('erro','Reconhecimento local indisponível. Use o texto.');}
      } catch(e){rec=null;setState('erro',help);}
    }
    async function send() {
      if(state==='enviando')return;
      clearReview();holding=false;released=false;
      var text=String(el('texto').value||'').trim();
      if(!text||Array.from(text).length>2000){setState('erro','Use texto de 1 a 2000 caracteres.');return;}
      setState('enviando');
      try {
        var response=await win.fetch('/api/voz/fala',{method:'POST',headers:{'Content-Type':'application/json','X-R10-Token':win.PainelRecursos?.token||''},body:JSON.stringify({texto:text,confirmado:true})});
        var data=await response.json();if(!response.ok||data.ok!==true)throw Error(data.error||'Não foi possível enviar. Tente novamente.');
        addMessage('Você',text);el('texto').value='';setState('parado','Fala salva para a sua sessão. Aguardando resposta.');
      } catch(e){setState('erro',e.message==='Failed to fetch'?'Não foi possível enviar. Tente novamente.':e.message||'Não foi possível enviar. Tente novamente.');}
    }
    function reviewAndSend(){
      holding=false;released=false;clearReview();
      setState('revisando','Confira a fala. Envio em 1,5 s. Esc cancela; editar pausa.');
      reviewTimer=win.setTimeout(function(){reviewTimer=null;if(state==='revisando')send();},1500);
    }
    function startHold(){
      if(state==='ouvindo'||state==='revisando'||state==='enviando')return false;
      holding=true;released=false;mic();
      if(state!=='ouvindo'){holding=false;return false;}
      el('status').textContent='Ouvindo. Solte para enviar. Esc cancela.';return true;
    }
    function endHold(){
      if(!holding||released)return;released=true;
      if(rec&&state==='ouvindo')mic();
      else if(state==='revisando')reviewAndSend();
      else if(state!=='ouvindo'){holding=false;released=false;}
    }
    function repeat(){if(lastSpoken){stopSpeech();speak(lastSpoken);}}
    el('texto').addEventListener('input',function(){clearReview();if(state==='revisando')el('status').textContent='Confira o texto antes de enviar.';});
    el('mic').addEventListener('click',mic);el('liga').addEventListener('click',function(){setEnabled(!enabled);});
    el('conversa').addEventListener('click',function(){if(el('gaveta').hidden)open();else close();});
    function close(){el('gaveta').hidden=true;doc.documentElement.dataset.vozConversa='fechada';el('conversa').setAttribute('aria-expanded','false');el('conversa').focus();}
    el('fecha').addEventListener('click',close);el('enviar').addEventListener('click',send);el('cancelar').addEventListener('click',cancel);
    el('mudo').addEventListener('click',function(){muted=!muted;store('painel-voz-mudo',muted?'1':'0');if(muted)stopSpeech();muteUI();});
    el('parar').addEventListener('click',stopSpeech);
    doc.addEventListener('keydown',function(event){if(event.key==='Escape'&&!el('gaveta').hidden)close();});
    function destroy(){destroyed=true;clearReview();setEnabled(false);}

    win.addEventListener('pagehide',function(){destroyed=true;generation++;clearReview();if(timer!==null)win.clearInterval(timer);if(rec){try{rec.abort();}catch(e){}}stopSpeech();});
    if(win.speechSynthesis?.addEventListener)win.speechSynthesis.addEventListener('voiceschanged',function(){var v=localVoice();el('audio-status').textContent=v?'Voz: '+v.name:'Sem voz pt-BR local. Respostas só em texto.';});
    el('texto').value='';setState('parado');muteUI();setEnabled(enabled);
    return {send:send,poll:poll,destroy:destroy,startHold:startHold,endHold:endHold,cancel:cancel,repeat:repeat,stopSpeech:stopSpeech,busy:function(){return state==='ouvindo'||state==='revisando'||reviewTimer!==null;},recognition:function(){return rec;},window:win};
  }
  return {create:create,mount:mount};
});
