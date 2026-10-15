'use strict';
// Lugares (ganchos) do painel para modulos de fora. Contrato:
//   window.PainelGanchos.register('acelerador' | 'coordenador' | 'cards' | 'equipe', { render(snapshot, ctx), destroy() })
//   snapshot: o JSON de GET /api/estado (o mesmo da tela); ctx: { host, lang, nonce, refresh }.
//   host: acelerador = #gancho-acelerador (topo, ao lado do WEN), coordenador = #gancho-coordenador, cards = #gancho-cards,
//   equipe = #pe-equipe (aba Equipe). O lugar aparece quando o modulo registra; render roda depois de cada render() do painel.
(function(root){
  const doc=root.document,registry=new Map();
  const HOSTS={acelerador:'gancho-acelerador',coordenador:'gancho-coordenador',cards:'gancho-cards',equipe:'pe-equipe'};
  const current=()=>{try{return typeof latestSnapshot!=='undefined'&&latestSnapshot?latestSnapshot:null;}catch{return null;}};
  const language=()=>{try{return typeof lang==='string'?lang:'pt';}catch{return 'pt';}};
  function run(){
    const snapshot=current();
    for(const [name,module] of registry){
      const host=doc.getElementById(HOSTS[name]);if(!host)continue;
      host.hidden=false;if(!snapshot)continue;
      try{module.render(snapshot,{host,lang:language(),nonce:snapshot.nonce,refresh:()=>{try{return root.refresh?.();}catch{return null;}}});delete host.dataset.erro;}
      catch(error){host.dataset.erro='1';console.warn('gancho '+name,error);}
    }
  }
  function register(name,module){
    if(!Object.hasOwn(HOSTS,name)||!module||typeof module.render!=='function')throw Error('Gancho invalido');
    try{registry.get(name)?.destroy?.();}catch{}
    registry.set(name,module);run();
  }
  function wrap(){
    if(typeof root.render!=='function'||root.render.ganchos)return typeof root.render==='function';
    const original=root.render,wrapped=function(...args){try{return original.apply(this,args);}finally{run();}};
    wrapped.ganchos=true;Object.keys(original).forEach(key=>{wrapped[key]=original[key];});root.render=wrapped;return true;
  }
  root.PainelGanchos=Object.freeze({register,run,names:()=>[...registry.keys()]});
  if(!wrap())doc.addEventListener('DOMContentLoaded',wrap,{once:true});
})(window);
