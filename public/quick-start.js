(function(root){
  'use strict';
  const T={
    en:{check:'Check for a new version',checking:'Checking...',offline:'Offline mode. Music, author messages and external links are off.',versions:(a,b)=>'You have '+a+'; the latest is '+b+'.',noNetwork:'Could not check. Latest version: ?',clone:'Close the panel in the footer, run git pull in your panel folder, then open the panel again.',npx:'Close the panel in the footer, clone once. For future updates, run git pull in this folder.',zip:'Close the panel in the footer, download the ZIP again and open the new copy.',download:'Download ZIP',repository:'Open repository',copy:'Copy command',copied:'Copied',reading:(a,b,s)=>'Sessions read: '+a+' of '+b+' · '+s+' s',discovering:s=>'Finding local sessions · '+s+' s',server:'The panel is not responding. Run the command again, just once.',broken:'Something in this reading broke the screen. Feedback code: UI01.',slow:'This reading is taking longer than expected. You can open the example.',example:'Open example'},
    pt:{check:'Ver se tem versão nova',checking:'Conferindo...',offline:'Modo offline. Música, mensagens do autor e links externos estão desligados.',versions:(a,b)=>'Você está na '+a+'; a mais nova é '+b+'.',noNetwork:'Não deu para conferir. Versão mais nova: ?',clone:'Feche o painel no rodapé, rode git pull na pasta do painel e abra o painel de novo.',npx:'Feche o painel no rodapé, clone uma vez. Nas próximas atualizações, rode git pull nesta pasta.',zip:'Feche o painel no rodapé, baixe o ZIP de novo e abra a cópia nova.',download:'Baixar ZIP',repository:'Abrir repositório',copy:'Copiar comando',copied:'Copiado',reading:(a,b,s)=>'Sessões lidas: '+a+' de '+b+' · '+s+' s',discovering:s=>'Procurando sessões locais · '+s+' s',server:'O painel não está respondendo. Rode o comando de novo, uma vez só.',broken:'Algo nesta leitura quebrou a tela. Código para feedback: UI01.',slow:'Esta leitura está demorando mais que o esperado. Você pode abrir o exemplo.',example:'Abrir exemplo'},
    es:{check:'Ver si hay una versión nueva',checking:'Comprobando...',offline:'Modo sin conexión. Música, mensajes del autor y enlaces externos están desactivados.',versions:(a,b)=>'Tienes la '+a+'; la más nueva es '+b+'.',noNetwork:'No se pudo comprobar. Versión más nueva: ?',clone:'Cierra el panel desde el pie, ejecuta git pull en la carpeta del panel y abre el panel de nuevo.',npx:'Cierra el panel desde el pie, clona una vez. En futuras actualizaciones, ejecuta git pull en esta carpeta.',zip:'Cierra el panel desde el pie, descarga el ZIP de nuevo y abre la copia nueva.',download:'Descargar ZIP',repository:'Abrir repositorio',copy:'Copiar comando',copied:'Copiado',reading:(a,b,s)=>'Sesiones leídas: '+a+' de '+b+' · '+s+' s',discovering:s=>'Buscando sesiones locales · '+s+' s',server:'El panel no responde. Ejecuta el comando de nuevo, una sola vez.',broken:'Algo en esta lectura rompió la pantalla. Código para comentarios: UI01.',slow:'Esta lectura está tardando más de lo esperado. Puedes abrir el ejemplo.',example:'Abrir ejemplo'}
  };
  const version=value=>typeof value==='string'&&/^\d+\.\d+\.\d+(?:-[a-zA-Z\d.-]+)?$/.test(value)?value:'?';
  function progress(data,elapsed=0){const p=data?.reading||data?.usage?.progress;return {done:Number.isFinite(p?.done)&&p.done>=0?Math.floor(p.done):null,total:Number.isFinite(p?.total)&&p.total>=0?Math.floor(p.total):null,seconds:Number.isFinite(p?.elapsedSeconds)&&p.elapsedSeconds>=0?Math.floor(p.elapsedSeconds):Math.max(0,Math.floor(elapsed)),discovering:!!p?.discovering};}
  function valid(data){return !!data&&typeof data==='object'&&Array.isArray(data.tasks)&&data.tasks.every(task=>task&&typeof task==='object'&&task.phase&&typeof task.phase.key==='string')&&!!data.usage&&typeof data.usage==='object'&&(!data.usage.sessions||Array.isArray(data.usage.sessions));}
  function initialLanguage(query,saved,browser){const normalize=value=>typeof value==='string'?value.toLowerCase().split(/[-_]/)[0]:'';for(const value of [query,saved,browser]){const language=normalize(value);if(['en','pt','es'].includes(language))return language;}return 'en';}
  async function boundedRead(fetcher,url,options={}){
    const schedule=options.setTimer||root.setTimeout.bind(root),cancel=options.clearTimer||root.clearTimeout.bind(root),Controller=options.Controller||root.AbortController,controller=Controller?new Controller():null;
    let timeout;const expires=new Promise((_,reject)=>{timeout=schedule(()=>{reject(Error('READ_TIMEOUT'));controller?.abort();},options.timeoutMs||12000);});
    try{return await Promise.race([Promise.resolve().then(()=>fetcher(url,{cache:'no-store',credentials:'same-origin',signal:controller?.signal})).then(async response=>{if(!response.ok)throw Error('UI01');return response.json();}),expires]);}finally{cancel(timeout);}
  }
  const api={T,version,progress,valid,initialLanguage,boundedRead};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(!root.document)return;
  const d=root.document,$=id=>d.getElementById(id),started=Date.now();
  let savedLanguage=null;try{savedLanguage=root.localStorage?.getItem('agent-panel-language');}catch{}
  root.PanelLanguageInitial=initialLanguage(new URLSearchParams(root.location?.search||'').get('lang'),savedLanguage,root.navigator?.languages?.[0]||root.navigator?.language||d.documentElement.lang);d.documentElement.lang=root.PanelLanguageInitial;
  let isOffline=d.documentElement.dataset.offline==='true',mounted=false,problem='',latest=null,pending=false,current='2.2.8',lastReading=null,responseReady=false,lastReceivedAt=started,complete=false;
  const lang=()=>T[d.documentElement.lang]?d.documentElement.lang:'en',t=()=>T[lang()];
  const make=(tag,text)=>{const n=d.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const boot=$('panel-boot'),bootText=boot?.querySelector('p'),reading=make('p'),message=make('p'),example=make('a'),check=make('button');
  reading.id='startup-progress';message.id='startup-message';message.setAttribute('role','status');example.id='startup-example';example.className='boot-retry';example.hidden=true;
  if(boot){boot.append(reading,message,example);}
  check.id='check-update';check.type='button';d.querySelector('footer')?.append(check);
  const partialExample=make('a');partialExample.id='startup-partial-example';partialExample.className='boot-retry';partialExample.hidden=true;d.querySelector('main')?.prepend(partialExample);
  const notice=make('p');notice.id='startup-notice';notice.setAttribute('role','status');notice.hidden=true;d.querySelector('main')?.prepend(notice);
  function paint(){
    const w=t();check.textContent=pending?w.checking:w.check;check.disabled=pending;
    example.textContent=w.example;example.href='/?example=1&size=solo&lang='+lang();partialExample.textContent=w.example;partialExample.href=example.href;
    const p=progress(lastReading,(Date.now()-started)/1000);if(Number.isFinite(lastReading?.reading?.elapsedSeconds))p.seconds+=Math.max(0,Math.floor((Date.now()-lastReceivedAt)/1000));
    reading.textContent=p.done!==null&&p.total!==null?w.reading(p.done,p.total,p.seconds):w.discovering(p.seconds);
    message.textContent=problem?w[problem]:'';
    notice.textContent=problem?w[problem]:!complete?reading.textContent:'';notice.hidden=complete&&!problem;
    if(problem&&bootText)bootText.textContent=w[problem];
    if(problem==='slow'||problem==='broken'||!complete&&Date.now()-started>=90000)example.hidden=false;partialExample.hidden=!mounted||example.hidden;
  }
  function setOffline(value){if(value!==true&&value!==false)return;isOffline=value;d.documentElement.dataset.offline=String(value);d.dispatchEvent(new root.CustomEvent('panel-offline',{detail:{offline:value}}));}
  function failed(type=problem==='broken'?'broken':'server'){problem=type;if(!mounted)delete d.body.dataset.panelMounted;paint();}
  function received(data){
    if(typeof data?.offline==='boolean')setOffline(data.offline);
    lastReading=data;lastReceivedAt=Date.now();
    if(!valid(data)){failed('broken');return false;}
    responseReady=true;
    if(problem==='server')problem='';paint();return true;
  }
  function rendered(data){
    received(data);if(problem==='broken')return;
    mounted=true;d.body.dataset.panelMounted='true';complete=complete||!!data.example||data.usage?.ready===true&&!data.usage?.scanning&&!data.usage?.pending;
    if(complete){problem='';root.clearInterval(tick);}paint();
  }
  function display(nodes){if(typeof root.panelDrawer==='function')root.panelDrawer(t().check,nodes);else{message.replaceChildren(...nodes);delete d.body.dataset.panelMounted;}}
  function explainOffline(){display([make('p',t().offline)]);}
  function link(text,path){const a=make('a',text);a.href=path;a.target='_blank';a.rel='noopener noreferrer';a.className='session-link';return a;}
  function updateResult(result){
    if(result?.offline===true||isOffline){explainOffline();return;}
    current=version(result?.currentVersion);const remote=version(result?.latestVersion),nodes=[make('p',t().versions(current,remote))];
    if(result?.ok!==true||remote==='?'){nodes.push(make('p',t().noNetwork),link(t().repository,'https://github.com/tridev360/lazy-du-agent-panel'));display(nodes);return;}
    const method=['clone','npx','zip'].includes(result.installMethod)?result.installMethod:'clone';
    if(result.updateAvailable===true){nodes.push(make('p',t()[method]));
      if(method==='zip')nodes.push(link(t().download,'https://github.com/tridev360/lazy-du-agent-panel/archive/refs/heads/main.zip'));
      else{const command=method==='npx'?'git clone https://github.com/tridev360/lazy-du-agent-panel\ncd lazy-du-agent-panel\nnode src/open.cjs':'git pull\nnode src/open.cjs',pre=make('pre',command),copy=make('button',t().copy);copy.type='button';copy.onclick=async()=>{try{await root.navigator.clipboard.writeText(command);copy.textContent=t().copied;}catch{}};nodes.push(pre,copy);}
    }display(nodes);
  }
  const fetchLocal=root.fetch?.bind(root);
  check.onclick=async()=>{
    if(isOffline){updateResult({offline:true});return;}
    if(pending||!fetchLocal)return;pending=true;paint();
    const controller=typeof root.AbortController==='function'?new root.AbortController():null,timeout=root.setTimeout(()=>controller?.abort(),10000);
    try{const response=await fetchLocal('/api/update-check',{cache:'no-store',credentials:'same-origin',signal:controller?.signal});latest=response.ok?await response.json():{ok:false,currentVersion:current};if(latest?.offline===true)setOffline(true);updateResult(latest);}catch{updateResult({ok:false,currentVersion:current});}finally{root.clearTimeout(timeout);pending=false;paint();}
  };
  if(fetchLocal)root.fetch=async(input,options)=>{
    const url=typeof input==='string'?input:input?.url||'',status=/^\/api\/status(?:\?|$)/.test(url);if(status)responseReady=false;
    try{const response=await fetchLocal(input,options);if(status){if(!response.ok)failed('server');const json=response.json.bind(response);response.json=async()=>{try{const data=await json();if(!received(data))throw Error('UI01');return data;}catch{if(problem!=='broken')failed('server');throw Error('UI01');}};}return response;}catch(error){if(status){const timeout=options?.signal?.aborted===true;failed(timeout?'slow':'server');throw Error(timeout?'READ_TIMEOUT':'UI01');}throw error;}
  };
  function attach(){
    const panel=root.PanelV2;if(!panel||panel.startupGuard)return;panel.startupGuard=true;
    const render=panel.render.bind(panel),failure=panel.failure.bind(panel);
    panel.render=(data,locale)=>{try{render(data,locale);rendered(data);}catch{failed('broken');}};
    panel.failure=()=>{const reason=problem==='broken'?'broken':problem==='slow'?'slow':problem==='server'||!responseReady?'server':'broken';try{failure();}catch{}failed(reason);};
  }
  root.addEventListener('DOMContentLoaded',attach);
  d.addEventListener('change',()=>root.setTimeout(paint,0));
  d.addEventListener('click',event=>{if(isOffline&&event.target?.closest?.('a[href^="http"]')){event.preventDefault();event.stopPropagation();explainOffline();}},true);
  root.addEventListener('error',event=>{if(!mounted){event.preventDefault();failed('broken');}});
  const tick=root.setInterval(()=>{if(complete)return;if(!problem&&(Date.now()-started)>=90000)problem='slow';paint();},1000);
  root.PanelStartup=Object.freeze({...api,offline:()=>isOffline,setOffline,received,rendered,failed,paint,explainOffline,readStatus:url=>boundedRead(root.fetch.bind(root),url)});
  paint();
})(typeof window==='object'?window:globalThis);
