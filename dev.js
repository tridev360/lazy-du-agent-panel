'use strict';
(function(scope){
  const KEY='painel-dev-resume-v1',TABS=new Set(['home','team','sessions','consumption','launches','projects','queue','tips']);
  function valid(meta){return meta?.enabled===true&&typeof meta.assetVersion==='string'&&/^[a-f0-9]{64}$/i.test(meta.assetVersion)&&typeof meta.serverId==='string'&&meta.serverId.length<=150;}
  function sanitize(value){
    if(!value||typeof value!=='object'||Array.isArray(value))return null;
    const tab=typeof value.tab==='string'?value.tab:value.tab?.tab;
    const safe={tab:TABS.has(tab)?tab:'home',project:typeof value.project==='string'?value.project.slice(0,150):'',scroll:{x:Number.isFinite(value.scroll?.x)?Math.max(0,value.scroll.x):0,y:Number.isFinite(value.scroll?.y)?Math.max(0,value.scroll.y):0}};
    if(value.filters&&typeof value.filters==='object')safe.filters={owner:typeof value.filters.owner==='string'?value.filters.owner.slice(0,100):'',executor:['','claude','codex'].includes(value.filters.executor)?value.filters.executor:'',deadlineOnly:value.filters.deadlineOnly===true,needsOwner:value.filters.needsOwner===true};
    if(['new','doing','ready','review','released','live'].includes(value.phase))safe.phase=value.phase;
    if(typeof value.launchDay==='string'&&/^(?:\d{4}-\d{2}-\d{2})?$/.test(value.launchDay))safe.launchDay=value.launchDay;
    return safe;
  }
  function capture(){return {tab:scope.painelTabState?.get?.()||'home',project:scope.PainelProjetos?.selected||'',filters:typeof filters!=='undefined'?{...filters}:null,phase:typeof selectedPhase!=='undefined'?selectedPhase:null,launchDay:typeof selectedLaunchDay!=='undefined'?selectedLaunchDay:null,scroll:{x:scope.scrollX||0,y:scope.scrollY||0}};}
  function apply(saved){
    if(saved.filters&&typeof filters!=='undefined')for(const key of ['owner','executor','deadlineOnly','needsOwner'])filters[key]=saved.filters[key];
    if(saved.phase&&typeof selectedPhase!=='undefined')selectedPhase=saved.phase;
    if(saved.launchDay!==undefined&&typeof selectedLaunchDay!=='undefined')selectedLaunchDay=saved.launchDay;
    scope.PainelProjetos?.select?.(saved.project);
    if(typeof render==='function')render();scope.painelTabState?.restore?.({tab:saved.tab});
    const frame=scope.requestAnimationFrame||((callback)=>callback());frame(()=>frame(()=>scope.scrollTo(saved.scroll.x,saved.scroll.y)));
  }
  function createController(win,options={}){
    let baseline=null,timer=null,pending=null,reloading=false,restored=false;
    const save=()=>{try{const state=sanitize((options.capture||capture)());if(state)win.sessionStorage.setItem(KEY,JSON.stringify(state));}catch{}};
    function restore(){if(restored)return;restored=true;try{const raw=win.sessionStorage.getItem(KEY);win.sessionStorage.removeItem(KEY);if(raw&&raw.length<=8192){const state=sanitize(JSON.parse(raw));if(state)(options.restore||apply)(state);}}catch{}}
    function changed(meta){return baseline&&(baseline.assetVersion!==meta.assetVersion||baseline.serverId!==meta.serverId);}
    function run(){timer=null;if(reloading||!pending)return;if(win.document?.getElementById('painel-command-dialog')?.open)return;reloading=true;save();(options.reload||(()=>win.location.reload()))();}
    function schedule(meta){if(!valid(meta)||!baseline||!changed(meta)||reloading)return false;pending=meta;if(timer!==null)win.clearTimeout(timer);timer=win.setTimeout(run,80);return true;}
    function observe(meta){if(!valid(meta)){baseline=null;pending=null;if(timer!==null)win.clearTimeout(timer);timer=null;return false;}if(!baseline){baseline={...meta};restore();return false;}return schedule(meta);}
    win.document?.addEventListener?.('close',()=>{if(pending&&!reloading&&timer===null)timer=win.setTimeout(run,80);},true);
    win.addEventListener?.('pagehide',()=>{if(timer!==null)win.clearTimeout(timer);},{once:true});
    return {observe,schedule,restore};
  }
  const api={createController,sanitize,valid,KEY};if(typeof module==='object'&&module.exports)module.exports=api;else{scope.PainelDev=createController(scope);if(typeof latestSnapshot!=='undefined'&&latestSnapshot)scope.PainelDev.observe(latestSnapshot.dev);}
})(typeof window==='object'?window:globalThis);
