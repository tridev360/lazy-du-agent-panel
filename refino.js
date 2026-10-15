'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.PainelRefino=api;api.start(root);}})(typeof window==='object'?window:globalThis,()=>{
  const TARGETS=[['home','panel-home'],['flow','panel-flow'],['council','panel-council'],['finances','panel-finances'],['journey','panel-journey']];
  const SELECTORS={home:['.im-percent','.im-energy-number','#home-spend-facts dd'],hero:['.im-owner strong'],council:['.cr-scoreboard td'],finances:['.ideia p'],journey:['.ideias349 p']};
  const WORDS={pt:{loading:'Carregando a fonte…',missing:'? sem leitura'},en:{loading:'Loading the source…',missing:'? no reading'},es:{loading:'Cargando la fuente…',missing:'? sin lectura'}};
  function numberParts(text){
    const value=String(text),money=value.match(/(?:R\$|US\$|[$€£¥])\s*([+-]?\d+(?:[.,]\d+)*)/),match=money?{index:money.index+money[0].lastIndexOf(money[1]),0:money[1]}:/(?:R\$|US\$|[$€£¥])/.test(value)?null:value.match(/[+-]?\d+(?:[.,]\d+)*(?:\s*[%x])?/);
    return match?{prefix:value.slice(0,match.index),number:match[0],suffix:value.slice(match.index+match[0].length),known:true}:{prefix:'',number:'?',suffix:'',known:false};
  }
  function eligible(kind,node){
    const text=node.textContent,classes=node.className||'';
    if(/ideia-meta|ideias-reading/.test(classes))return false;
    if(kind==='home'||kind==='hero')return true; // Only explicit measured fields are selected.
    if(kind==='council')return !/[A-Za-zÀ-ÿ]/.test(text);
    if(kind==='finances')return /(?:R\$|US\$|[$€£¥])\s*[+-]?[\d?]|\d[\d.,]*\s*[%x]/.test(text);
    return /^[^:]+:\s*(?:[+-]?\d[\d.,\s]*(?:%|x|dias?|days?|días?)?|\?)$/.test(text);
  }
  function start(root){
    const doc=root.document;if(!doc)return null;let stopped=false;
    const records=[],observers=[],listeners=[],homeRead=root.PainelSala?.leitura?.();let homePending=!homeRead?.agora&&!homeRead?.failed;
    const language=()=>{const value=doc.getElementById('language')?.value||doc.documentElement.lang||'pt';return WORDS[value]?value:'pt';};
    const el=(tag,cls,text)=>{const n=doc.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
    function key(node,scope,kind,index){
      const owner=['article','tr','.contas298-account'].map(s=>node.closest(s)).find(Boolean)||node.parentElement;
      const title=owner?.dataset.entry||owner?.querySelector('.im-id')?.textContent||owner?.querySelector('.cr-juror span')?.textContent||owner?.querySelector('h3')?.textContent||owner?.querySelector('.contas298-name')?.textContent||owner?.id||'';
      const section=owner?.closest('section')?.querySelector('h2')?.textContent||'';
      const slot=Array.from(owner?.children||[]).indexOf(node);
      return [scope.id,section,title,node.id||node.className.replace(/rf-[\w-]+/g,''),slot<0?0:slot,title?0:index].join('|');
    }
    function numbers(record){
      if(record.panel.hidden||doc.hidden||!SELECTORS[record.kind])return;
      const lang=language(),previous=record.lang===lang?record.values:new Map(),next=new Map();record.lang=lang;
      const scope=record.scope||record.panel,nodes=Array.from(new Set(SELECTORS[record.kind].flatMap(s=>Array.from(scope.querySelectorAll(s))))).slice(0,500);
      for(const [index,node]of nodes.entries()){
        if(!eligible(record.kind,node))continue;const id=key(node,scope,record.kind,index),text=node.textContent,part=numberParts(text),old=previous.get(id);
        next.set(id,{text,known:part.known});if(!part.known||node.querySelector('.rf-number'))continue;
        const value=el('span','rf-number',part.number);value.dataset.refinoNumber='true';
        if(old?.known&&old.text!==text)value.classList.add('rf-number-roll');
        node.dataset.refinoValue='true';node.replaceChildren(doc.createTextNode(part.prefix),value,doc.createTextNode(part.suffix));
      }record.values=next;
    }
    function loading(record){
      const {host,kind}=record;if(!host)return;
      const state=kind==='home'?(homePending?'loading':'ready'):host.dataset.refinoState||((host.querySelector(kind==='flow'?'.fx-proof':kind==='council'?'.cr-room':'.ideias349'))?'ready':'loading');
      const pending=state==='loading',words=WORDS[language()];host.setAttribute('aria-busy',String(pending));
      if(!pending){host.querySelector('.rf-skeleton')?.remove();host.querySelector('.rf-loading')?.remove();const notice=host.querySelector('.fx-notice')||host.querySelector('.cr-notice')||host.querySelector('.ideias-reading');if(state==='error'&&!host.querySelector('.rf-error')&&!notice?.textContent){const error=el('p','rf-error',words.missing);error.setAttribute('role','status');host.append(error);}if(state!=='error')host.querySelector('.rf-error')?.remove();return;}
      if(host.querySelector('.rf-skeleton'))return;
      const skeleton=el('div','rf-skeleton');skeleton.setAttribute('aria-hidden','true');
      for(let n=0;n<(kind==='finances'?4:kind==='council'||kind==='flow'?2:1);n++){const block=el('div','rf-skeleton-block');for(let j=0;j<3;j++)block.append(el('i','rf-skeleton-line'));skeleton.append(block);}
      const status=el('p','rf-loading',words.loading);status.setAttribute('role','status');host.append(skeleton,status);
    }
    function refresh(){if(stopped)return;for(const record of records){loading(record);numbers(record);}}
    for(const [kind,id]of TARGETS){const panel=doc.getElementById(id);if(!panel)continue;const host=kind==='home'?panel.querySelector('.im-missions'):doc.getElementById(kind==='flow'?'fluxo-host':'acrescimo-'+kind),record={kind,panel,host,values:new Map(),lang:null};records.push(record);
      if(typeof root.MutationObserver==='function'){
        const observer=new root.MutationObserver(mutations=>{if(stopped)return;if(mutations.every(m=>m.target.dataset?.refinoValue&&m.target.querySelector('.rf-number')))return;loading(record);numbers(record);});
        observer.observe(kind==='flow'?host||panel:panel,{childList:true,subtree:kind!=='flow',attributes:true,attributeFilter:['data-refino-state']});observers.push(observer);
      }
    }
    const sala=doc.getElementById('sala-comando'),home=doc.getElementById('panel-home');if(sala&&home){const record={kind:'hero',panel:home,scope:sala,host:null,values:new Map(),lang:null};records.push(record);if(typeof root.MutationObserver==='function'){const observer=new root.MutationObserver(mutations=>{if(!stopped&&!mutations.every(m=>m.target.dataset?.refinoValue&&m.target.querySelector('.rf-number')))numbers(record);});observer.observe(sala,{childList:true,subtree:true});observers.push(observer);}}
    function listen(target,event,fn){if(!target)return;target.addEventListener(event,fn);listeners.push([target,event,fn]);}
    listen(doc,'painel:agora-leitura',()=>{homePending=false;refresh();});listen(doc,'painel:tab-change',refresh);listen(doc,'visibilitychange',refresh);listen(doc.getElementById('language'),'change',refresh);
    function destroy(){stopped=true;for(const observer of observers)observer.disconnect();for(const [target,event,fn]of listeners)target.removeEventListener?.(event,fn);}
    root.addEventListener('pagehide',destroy,{once:true});refresh();return {refresh,destroy};
  }
  return {start,numberParts,eligible,TARGETS};
});
