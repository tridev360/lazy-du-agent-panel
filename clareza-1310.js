'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.PainelClareza1310=api;api.instance=api.start(root);}})(typeof window==='object'?window:globalThis,()=>{
  const SOURCE=/^(?:Fonte|Source|Fuente|Critério|Criterion|Criterio|Janela|Window|Nota|Note|Observação|Observacion)\s*:/i;
  const EXPLANATIONS='.ideias-reading,.im-proof,.im-record,.im-energy-note,.fx-proof-line,.fx-caption,.cr-ranking-note,.cr-scoreboard caption,.fi-note,.fi-caption,.fi-footnote,.pe-now-sub,.cb-footer,.cb-tree-intro';
  const WORDS={pt:{source:'Fonte e explicação',more:'Ver mais',less:'Ver menos',age:'Leitura'},en:{source:'Source and explanation',more:'Read more',less:'Read less',age:'Read'},es:{source:'Fuente y explicación',more:'Ver más',less:'Ver menos',age:'Lectura'}};
  // A idade da leitura mais antiga continua a vista: o texto da fonte vai para o balao e a hora com a idade ficam num chip curto.
  function oldestAge(texts){let best=null;for(const text of texts){const tail=text.split(' · ').slice(1).join(' · ').trim();if(!tail)continue;const m=/(\d+)\s*(min|h|d)\b/i.exec(tail),minutes=m?Number(m[1])*(/^h/i.test(m[2])?60:/^d/i.test(m[2])?1440:1):-1;if(!best||minutes>best.minutes)best={tail,minutes};}return best?best.tail:'?';}
  function start(root){
    const doc=root.document;if(!doc||!root.getComputedStyle)return null;
    const measured=new Map(),panels=Array.from(doc.querySelectorAll('#panel-council,#panel-brain,#panel-journey')),listeners=[],observers=[],shortNodes=new WeakMap(),idleWaiters=[];let stopped=false,scheduled=false,running=false,rerun=false,serial=0,frame=null;
    const language=()=>WORDS[doc.getElementById('language')?.value||doc.documentElement.lang]||WORDS.pt;
    const el=(tag,cls,text)=>{const node=doc.createElement(tag);node.className=cls;if(text!==undefined)node.textContent=text;return node;};
    function lines(node){const style=root.getComputedStyle(node),height=node.getBoundingClientRect().height,line=parseFloat(style.lineHeight)||parseFloat(style.fontSize)*1.5;return height>0?Math.max(1,Math.round((height-parseFloat(style.paddingTop||0)-parseFloat(style.paddingBottom||0))/line)):0;}
    function safe(node){return !node.closest('.cl1310-info,.cl1310-more,.cl1310-original,.cl1310-excerpt,details:not([open]),[hidden],.rf-skeleton')&&!node.querySelector('button,a,input,select,textarea,summary,[role="button"],[aria-live]')&&!node.matches('[role="status"],[aria-live]')&&!!node.textContent.trim();}
    function count(panel,node,removed,type){if(!removed)return;const record=measured.get(panel.id)||{aba:panel.id.replace(/^panel-/,''),linhasRetiradas:0,fontes:0,blocosLongos:0,largura:root.innerWidth};record.linhasRetiradas+=removed;record[type]++;measured.set(panel.id,record);node.dataset.cl1310RemovedLines=String(removed);}
    function source(panel,node,before){
      if(!before||!node.isConnected)return;
      // Keep the original node and its measured lines, but collect metadata once per tab.
      const marker=el('span','cl1310-source-marker');marker.hidden=true;marker.setAttribute('aria-hidden','true');marker._cl1310SourceNode=node;node.before(marker);node.classList.add('cl1310-original');node.remove();count(panel,marker,before,'fontes');
    }
    function syncSources(panel){
      const markers=Array.from(panel.querySelectorAll('.cl1310-source-marker')),unique=new Map();
      for(const marker of markers){const node=marker._cl1310SourceNode,key=node?.textContent.trim().replace(/\s+/g,' ');if(key&&!unique.has(key))unique.set(key,node);}
      let footer=panel.querySelector('.cl1310-source');if(!markers.length){footer?.remove();return;}
      if(!footer){footer=el('footer','cl1310-source');const details=el('details','cl1310-info'),summary=el('summary','','?'),balloon=el('div','cl1310-balloon');summary.setAttribute('aria-label',language().source);summary.setAttribute('title',language().source);details.append(summary,balloon);footer.append(details);panel.append(footer);}
      const signature=Array.from(unique.keys()).join('\n');if(footer._cl1310SourceSignature===signature)return;
      const chipText=language().age+': '+oldestAge(unique.keys()),host=panel.querySelector('.jt-intro')||footer;let chip=panel.querySelector('.cl1310-age');if(!chip){chip=el('span','cl1310-age');}if(chip.parentNode!==host){const info=host.querySelector(':scope>.cl1310-info');if(info)host.insertBefore(chip,info);else host.append(chip);}chip.textContent=chipText;chip.title=chipText;
      footer._cl1310SourceSignature=signature;footer.dataset.cl1310UniqueSources=String(unique.size);const balloon=footer.querySelector('.cl1310-balloon');balloon.replaceChildren();
      balloon.append(el('strong','',language().source));for(const node of unique.values())balloon.append(node);
    }
    function excerpt(node,fullText){
      const text=fullText||node.textContent.trim(),words=text.split(/\s+/),style=root.getComputedStyle(node),probe=el('div','cl1310-probe');
      Object.assign(probe.style,{position:'fixed',left:'-10000px',top:'0',width:node.getBoundingClientRect().width+'px',font:style.font,lineHeight:style.lineHeight,letterSpacing:style.letterSpacing,padding:'0',border:'0',margin:'0',visibility:'hidden',contain:'layout style paint'});probe.setAttribute('aria-hidden','true');doc.body.append(probe);
      const max=(parseFloat(style.lineHeight)||parseFloat(style.fontSize)*1.5)*2+.5;let lo=1,hi=words.length,best=1;
      while(lo<=hi){const mid=(lo+hi)>>1;probe.textContent=words.slice(0,mid).join(' ')+'…';if(probe.getBoundingClientRect().height<=max){best=mid;lo=mid+1;}else hi=mid-1;}
      probe.remove();return words.slice(0,best).join(' ')+(best<words.length?'…':'');
    }
    function longText(panel,node,before){
      if(before<=2||!node.isConnected)return;
      const preview=el(node.tagName.toLowerCase(),'cl1310-excerpt',excerpt(node)),details=el('details','cl1310-more'),summary=el('summary','',language().more),content=el('div','cl1310-full');details.id='cl1310-more-'+(++serial);summary.setAttribute('aria-controls',details.id+'-full');content.id=details.id+'-full';details.append(summary,content);node.before(preview,details);node.classList.add('cl1310-original');content.append(node);
      preview._cl1310FullText=node.textContent.trim();details.addEventListener('toggle',()=>{summary.textContent=details.open?language().less:language().more;preview.hidden=details.open;});count(panel,details,Math.max(0,before-lines(preview)),'blocosLongos');
    }
    function wireInfo(panel){
      for(const details of panel.querySelectorAll('.cl1310-info')){if(details.dataset.cl1310Wired)continue;details.dataset.cl1310Wired='true';const summary=details.querySelector('summary'),balloon=details.querySelector('.cl1310-balloon');if(!summary||!balloon)continue;
        summary.setAttribute('aria-expanded',String(details.open));
        if(typeof balloon.showPopover==='function'){balloon.setAttribute('popover','manual');const toggle=event=>{if(event&&event.target!==details)return;summary.setAttribute('aria-expanded',String(details.open));if(!details.open){try{balloon.hidePopover();}catch{}return;}
          const box=summary.getBoundingClientRect(),mobile=root.innerWidth<=600;balloon.style.position='fixed';balloon.style.margin='0';balloon.style.right='auto';balloon.style.left=(mobile?24:Math.max(16,Math.min(box.right-320,root.innerWidth-336)))+'px';balloon.style.width=(mobile?Math.max(0,root.innerWidth-48):Math.min(320,root.innerWidth-32))+'px';balloon.style.minWidth='0';balloon.style.top=mobile?'auto':Math.min(box.bottom+8,Math.max(16,root.innerHeight-336))+'px';balloon.style.bottom=mobile?'24px':'auto';try{balloon.showPopover();}catch{}
        };details.addEventListener('toggle',toggle);if(details.open)toggle();}
      }
    }
    const defer=fn=>typeof root.requestAnimationFrame==='function'?root.requestAnimationFrame(fn):root.setTimeout(fn,0);
    function ignoreOwnMutations(){for(const observer of observers)observer.takeRecords?.();}
    function settled(){running=false;ignoreOwnMutations();if(rerun){rerun=false;schedule();return;}for(const resolve of idleWaiters.splice(0))resolve();}
    function refresh(){schedule();}
    function pass(){
      frame=null;scheduled=false;if(stopped||doc.hidden){settled();return;}running=true;
      const plans=[];
      // Read all original geometry before moving a single node. This avoids a
      // forced whole-panel layout between each of hundreds of source notes.
      for(const panel of panels){if(panel.hidden)continue;const width=panel.getBoundingClientRect().width;if(!width)continue;
        if(!measured.has(panel.id))measured.set(panel.id,{aba:panel.id.replace(/^panel-/,''),linhasRetiradas:0,fontes:0,blocosLongos:0,largura:root.innerWidth});
        const explicit=new Set(panel.querySelectorAll(EXPLANATIONS)),sources=[],long=[],reflow=[];
        for(const preview of panel.querySelectorAll('.cl1310-excerpt'))if(!preview.hidden&&preview._cl1310FullText&&lines(preview)>2)reflow.push(preview);
        for(const node of new Set([...panel.querySelectorAll('p,small,blockquote,caption'),...explicit])){
          if(!safe(node))continue;const text=node.textContent.trim(),metadata=explicit.has(node)||SOURCE.test(text),previous=shortNodes.get(node);
          if(!metadata&&previous?.text===text&&previous.width===width)continue;
          const before=lines(node);if(!before)continue;
          if(metadata)sources.push({node,before});else if(!node.closest('.jt-hero,.jt-chips')){if(before>2)long.push({node,before});else shortNodes.set(node,{text,width});}
        }plans.push({panel,sources,long,reflow});
      }
      // One write-only batch for sources, followed by bounded paragraph work.
      for(const plan of plans){for(const item of plan.sources)source(plan.panel,item.node,item.before);syncSources(plan.panel);wireInfo(plan.panel);}ignoreOwnMutations();
      const pending=plans.flatMap(plan=>[...plan.long.map(item=>({...item,panel:plan.panel})),...plan.reflow.map(node=>({node,reflow:true,panel:plan.panel}))]);
      function chunk(){frame=null;if(stopped){settled();return;}let processed=0;const began=root.performance?.now?.()||Date.now();
        while(pending.length&&processed<3){const item=pending.shift();if(!item.panel.hidden&&item.node.isConnected){if(item.reflow){if(!item.node.hidden)item.node.textContent=excerpt(item.node,item.node._cl1310FullText);}else longText(item.panel,item.node,item.before);}processed++;if((root.performance?.now?.()||Date.now())-began>=6)break;}
        ignoreOwnMutations();if(pending.length)frame=defer(chunk);else settled();
      }
      if(pending.length)frame=defer(chunk);else settled();
    }
    function schedule(){if(stopped)return;if(running){rerun=true;return;}if(scheduled)return;scheduled=true;frame=defer(pass);}
    for(const panel of panels){if(typeof root.MutationObserver==='function'){const observer=new root.MutationObserver(records=>{if(records.every(r=>r.target.closest?.('.cl1310-info,.cl1310-more,.cl1310-excerpt,.cl1310-source')||r.type==='childList'&&[...r.addedNodes,...r.removedNodes].length>0&&[...r.addedNodes,...r.removedNodes].every(n=>n.nodeType===1&&n.matches?.('.cl1310-source-marker,.cl1310-source,.cl1310-info,.cl1310-more,.cl1310-excerpt,.cl1310-original'))))return;schedule();});observer.observe(panel,{childList:true,subtree:true});observers.push(observer);}}
    function listen(target,type,fn,options){target?.addEventListener(type,fn,options);listeners.push([target,type,fn,options]);}
    listen(doc,'painel:tab-change',schedule);listen(doc,'visibilitychange',schedule);listen(root,'resize',schedule);listen(doc.getElementById('language'),'change',schedule);
    listen(doc,'toggle',event=>{if(event.target.matches?.('details')&&!event.target.closest?.('.cl1310-info,.cl1310-more,.cl1310-source'))schedule();},true);
    listen(doc,'keydown',event=>{if(event.key==='Escape')for(const details of doc.querySelectorAll('.cl1310-info[open]')){details.open=false;details.querySelector('summary')?.focus();}});
    listen(doc,'click',event=>{for(const details of doc.querySelectorAll('.cl1310-info[open]'))if(!details.contains(event.target))details.open=false;});
    function report(){return panels.map(panel=>{const sources=Array.from(panel.querySelectorAll('.cl1310-source-marker')),long=Array.from(panel.querySelectorAll('.cl1310-more')),footer=panel.querySelector('.cl1310-source');return {aba:panel.id.replace(/^panel-/,''),linhasRetiradas:[...sources,...long].reduce((total,node)=>total+Number(node.dataset.cl1310RemovedLines||0),0),fontes:footer?1:0,fontesAgrupadas:sources.length,fontesDistintas:Number(footer?.dataset.cl1310UniqueSources||0),blocosLongos:long.length,largura:root.innerWidth,pendente:scheduled||running||rerun,medida:measured.has(panel.id)?'DOM ao abrir a aba':'aba ainda não medida'};});}
    function whenIdle(){return scheduled||running||rerun?new Promise(resolve=>idleWaiters.push(resolve)):Promise.resolve();}
    function destroy(){stopped=true;if(frame!==null){if(typeof root.requestAnimationFrame==='function')root.cancelAnimationFrame?.(frame);else root.clearTimeout?.(frame);}for(const observer of observers)observer.disconnect();for(const [target,type,fn,options]of listeners)target?.removeEventListener?.(type,fn,options);for(const resolve of idleWaiters.splice(0))resolve();}
    listen(root,'pagehide',destroy);refresh();return {refresh,report,destroy,whenIdle};
  }
  return {start,SOURCE,EXPLANATIONS};
});
