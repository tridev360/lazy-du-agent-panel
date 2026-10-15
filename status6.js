'use strict';
// WEN: botao que abre o WEN EM TABELA (o mesmo do cabecalho: PainelF2.wen, dialogo #f2-wen) e o AUTOMATIZAR ao lado.
// UM jeito so. A rodada automatica (a cada 5 min) aperta o MESMO botao pelo MESMO caminho do clique
// (button.click()) e abre o mesmo WEN novo. O status em 6 linhas (GET /api/status-6) fica so de reserva: quando a pagina
// nao tem a tabela, ou quando outro codigo aperta este botao (o "Abrir o WEN antigo" de dentro do WEN novo).
(function(root){
  const PERIOD=5*60*1000,KEY='painel-wen-auto',PRESS_MS=180,OPEN_MS=260,CHANGED_MS=8000;
  const WORDS={
    pt:{wen:'WEN',tip:'Abre o WEN em tabela (tecla W)',auto:'AUTOMATIZAR',autoOn:'Automático: o WEN aperta sozinho a cada 5 min',autoOff:'Automático desligado: só no clique',last:'lido',never:'sem leitura',read:'Lido às',close:'Fechar',source:'Fonte',line:'linha',changed:'mudou',changes:n=>n===1?'1 linha mudou':n+' linhas mudaram',error:'Não deu para ler o disco agora',auto5:'automático',labels:{noar:'No ar',rodando:'Rodando',travado:'Travado por',acelerar:'Dá para acelerar?',proximo:'Seu próximo passo',credito:'Crédito'}},
    en:{wen:'WEN',tip:'Opens the WEN as a table (W key)',auto:'AUTOMATE',autoOn:'Automatic: WEN presses itself every 5 min',autoOff:'Automatic off: click only',last:'read',never:'no reading',read:'Read at',close:'Close',source:'Source',line:'line',changed:'changed',changes:n=>n===1?'1 line changed':n+' lines changed',error:'Could not read the disk now',auto5:'automatic',labels:{noar:'Live',rodando:'Running',travado:'Blocked by',acelerar:'Can it go faster?',proximo:'Your next step',credito:'Credit'}},
    es:{wen:'WEN',tip:'Abre el WEN en tabla (tecla W)',auto:'AUTOMATIZAR',autoOn:'Automático: WEN se pulsa solo cada 5 min',autoOff:'Automático apagado: solo con clic',last:'leído',never:'sin lectura',read:'Leído a las',close:'Cerrar',source:'Fuente',line:'linea',changed:'cambió',changes:n=>n===1?'1 línea cambió':n+' líneas cambiaron',error:'No se pudo leer el disco ahora',auto5:'automático',labels:{noar:'En vivo',rodando:'En marcha',travado:'Bloqueado por',acelerar:'¿Se puede acelerar?',proximo:'Tu próximo paso',credito:'Crédito'}}
  };
  function readAuto(storage){try{return storage?.getItem(KEY)==='1';}catch{return false;}}
  function writeAuto(storage,on){try{storage?.setItem(KEY,on?'1':'0');return true;}catch{return false;}}
  function changedKeys(previous,next){
    if(!previous?.lines || !next?.lines)return [];
    return next.lines.filter(line=>{const old=previous.lines.find(item=>item.key===line.key);return old && old.text!==line.text;}).map(line=>line.key);
  }
  function reducedMotion(win,doc){return doc?.documentElement?.dataset?.motion==='off' || win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;}
  // (GET /api/estado, o mesmo do bloco "Quanto gastei") tem a janela semanal do Codex valida (7 dias, 0 a 100%, reset no
  // futuro), o "?" vira o %; sem ela, fica "?". Nenhuma leitura nova: so o estado que a pagina ja tem.
  function snapshotNow(){try{return typeof latestSnapshot!=='undefined'&&latestSnapshot?latestSnapshot:null;}catch{return null;}}
  function codexWeek(snapshot,now=Date.now()){
    const codex=snapshot?.credits?.codex;
    for(const item of Array.isArray(codex?.windows)?codex.windows:[]){
      if(!item||!(item.minutes>=10000)||!Number.isFinite(item.used)||item.used<0||item.used>100)continue;
      const reset=typeof item.reset==='number'?(item.reset<1e12?item.reset*1000:item.reset):Date.parse(item.reset||'');
      if(Number.isFinite(reset)&&reset>now)return {used:Math.round(item.used),updated:codex.updated||null};
    }
    return null;
  }
  function fixCredit(line,snapshot=snapshotNow(),now=Date.now()){
    const model=typeof module==='object'&&module.exports?require('./credito-modelo.js'):root.PainelCreditoModelo;
    if(!line||line.key!=='credito'||!snapshot?.credits||!model)return line;
    const text=model.text(snapshot.credits,'pt',now);
    return {...line,text,known:!text.includes('?'),detail:{...line.detail,sources:[{file:'créditos canônicos do painel',note:text}]}};
  }
  // A tabela do cabecalho: o mesmo PainelF2.wen que o placar chama. Clique da pessoa alterna (abre e fecha, como o placar);
  // a rodada automatica sempre abre. Sem a tabela na pagina devolve false e o botao cai na reserva (nunca fica morto).
  function tableOpener(win){return source=>{const f2=win?.PainelF2||root.PainelF2;if(!f2||typeof f2.wen!=='function')return false;try{f2.wen(source==='auto'?true:undefined);return true;}catch{return false;}};}
  function createWen({doc,win=root,fetchJson,storage,timers=root,snapshot=snapshotNow,openTable=tableOpener(win)}){
    const state={data:null,auto:false,timer:null,autoTick:false,presses:[],mounted:false};
    const els={};
    const lang=()=>{const value=doc.getElementById?.('language')?.value||doc.documentElement?.lang||'pt';return WORDS[value]?value:'pt';};
    const words=()=>WORDS[lang()];
    function el(tag,className,text){const node=doc.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
    function flash(node,name,ms){if(!node)return;node.classList.add(name);timers.setTimeout(()=>node.classList.remove(name),ms);}
    // O mesmo manipulador para o clique da pessoa e para a rodada automatica.
    async function press(source,old=false){
      const reduce=reducedMotion(win,doc),button=els.button;
      if(!reduce)flash(button,'wen-pressing',PRESS_MS);
      if(!old&&openTable&&openTable(source)===true){state.presses.push({source,animated:!reduce,alvo:'tabela'});return null;}
      state.presses.push({source,animated:!reduce,alvo:'antigo'});
      button.setAttribute('aria-busy','true');
      let data=null;try{data=await fetchJson();}catch{data=null;}
      button.setAttribute('aria-busy','false');
      render(data,{source,reduce});
      return data;
    }
    // clique por codigo de outro lugar (isTrusted false e nao e a rodada automatica) = pedido do WEN antigo, a reserva
    function onClick(event){const source=state.autoTick?'auto':'click';state.autoTick=false;return press(source,source==='click'&&event?.isTrusted===false);}
    function autoPress(){state.autoTick=true;els.button.click();}
    function setAuto(on,{persist=true}={}){
      state.auto=!!on;if(persist)writeAuto(storage,state.auto);
      if(state.timer!==null){timers.clearInterval(state.timer);state.timer=null;}
      if(state.auto)state.timer=timers.setInterval(autoPress,PERIOD);
      if(els.toggle){els.toggle.setAttribute('aria-checked',String(state.auto));els.toggle.classList.toggle('is-on',state.auto);els.toggle.title=state.auto?words().autoOn:words().autoOff;}
      return state.auto;
    }
    function panel(){
      if(els.panel)return els.panel;
      const w=words(),box=el('section','wen-panel');box.id='wen-panel';box.setAttribute('role','dialog');box.setAttribute('aria-label','WEN');box.hidden=true;
      const head=el('div','wen-head'),title=el('strong','wen-title','WEN'),at=el('span','wen-at',''),close=el('button','wen-close','×');
      close.type='button';close.setAttribute('aria-label',w.close);close.addEventListener('click',()=>{box.hidden=true;});
      head.append(title,at,close);const list=el('div','wen-list'),live=el('p','wen-live','');live.setAttribute('aria-live','polite');
      box.append(head,list,live);doc.body.append(box);els.panel=box;els.at=at;els.list=list;els.live=live;els.title=title;return box;
    }
    function rowOf(key){
      let row=els.list.querySelector?.('[data-wen-key="'+key+'"]')||(els.rows||(els.rows={}))[key];
      if(row)return row;
      row=el('details','wen-row');row.dataset.wenKey=key;row.setAttribute('data-wen-key',key);
      const summary=el('summary','wen-summary'),label=el('span','wen-label',''),text=el('span','wen-text','');
      summary.append(label,text);const detail=el('div','wen-detail');row.append(summary,detail);
      row._label=label;row._text=text;row._detail=detail;els.list.append(row);(els.rows||(els.rows={}))[key]=row;return row;
    }
    function render(data,{source='click',reduce=false}={}){
      const w=words(),box=panel(),wasHidden=box.hidden;
      if(!data?.lines){els.at.textContent=w.error;box.hidden=false;return;}
      try{const current=typeof snapshot==='function'?snapshot():null;if(current)data={...data,lines:data.lines.map(line=>fixCredit(line,current))};}catch{}
      const changed=changedKeys(state.data,data);
      els.at.textContent=w.read+' '+(data.readAtBrt||'?')+(source==='auto'?' · '+w.auto5:'');
      for(const line of data.lines){
        const row=rowOf(line.key);row._label.textContent=w.labels[line.key]||line.label;row._text.textContent=line.text;
        row.classList.toggle('is-unknown',line.text==='?');
        row._detail.replaceChildren(...(line.detail?.sources||[]).map(item=>el('p','wen-source',w.source+': '+item.file+(item.line?' · '+w.line+' '+item.line:'')+(item.note?' · '+item.note:'')+(item.excerpt?' · '+item.excerpt:''))),...(line.detail?.note?[el('p','wen-note',line.detail.note)]:[]));
        if(changed.includes(line.key)){row.classList.add('wen-changed');row.setAttribute('aria-description',w.changed);timers.setTimeout(()=>{row.classList.remove('wen-changed');row.removeAttribute?.('aria-description');},CHANGED_MS);}
      }
      els.live.textContent=changed.length?w.changes(changed.length):'';
      if(els.last)els.last.textContent=w.last+' '+String(data.readAtBrt||'?').slice(0,5);
      box.hidden=false;
      if(!reduce)flash(box,wasHidden?'wen-opening':'wen-refresh',OPEN_MS);
      state.data=data;
    }
    // Ao lado da alavanca de marchas quando ela existir; antes disso, no cabecalho, ao lado do Comando.
    function place(){
      const gear=doc.querySelector?.('[data-gear-control],[data-marcha]');
      if(gear?.parentNode){gear.parentNode.insertBefore(els.box,gear.nextSibling||null);return 'marcha';}
      const actions=doc.querySelector?.('.header-actions');
      if(actions){actions.insertBefore(els.box,doc.getElementById?.('command-trigger')||actions.firstChild||null);return 'cabecalho';}
      doc.body.append(els.box);return 'pagina';
    }
    function mount(){
      if(state.mounted)return api;
      const w=words(),box=el('div','wen-controls');box.setAttribute('data-wen','');
      const button=el('button','wen-trigger',w.wen);button.type='button';button.id='wen-trigger';button.title=w.tip;button.setAttribute('aria-label',w.wen+': '+w.tip);button.setAttribute('aria-controls','wen-panel');
      button.addEventListener('click',onClick);
      const toggle=el('button','wen-auto',w.auto);toggle.type='button';toggle.id='wen-auto';toggle.setAttribute('role','switch');toggle.setAttribute('aria-checked','false');
      toggle.addEventListener('click',()=>setAuto(!state.auto));
      const last=el('span','wen-last',w.never);last.id='wen-last';
      box.append(button,toggle,last);els.box=box;els.button=button;els.toggle=toggle;els.last=last;
      state.placement=place();state.mounted=true;
      doc.addEventListener?.('keydown',event=>{if(event.key==='Escape'&&els.panel)els.panel.hidden=true;});
      if(state.placement!=='marcha' && typeof root.MutationObserver==='function' && doc.body){
        const observer=new root.MutationObserver(()=>{if(doc.querySelector('[data-gear-control],[data-marcha]')){state.placement=place();observer.disconnect();}});
        observer.observe(doc.body,{childList:true,subtree:true});
      }
      setAuto(readAuto(storage),{persist:false});
      return api;
    }
    const api={mount,press,onClick,autoPress,setAuto,render,state,els,PERIOD};
    return api;
  }
  const exported={createWen,tableOpener,changedKeys,readAuto,writeAuto,reducedMotion,codexWeek,fixCredit,PERIOD,KEY,WORDS};
  if(typeof module!=='undefined')module.exports=exported;
  root.PainelWen=exported;
  if(root.document && root.fetch && !root.__painelWenSemMontar){
    const start=()=>{
      let storage=null;try{storage=root.localStorage;}catch{storage=null;}
      const example=/[?&]exemplo=1\b/.test(root.location?.search||'');
      const wen=createWen({doc:root.document,win:root,storage,timers:root,fetchJson:()=>root.fetch('/api/status-6'+(example?'?exemplo=1':''),{cache:'no-store'}).then(r=>r.ok?r.json():null)});
      root.PainelWen.instance=wen.mount();
    };
    if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  }
})(typeof window==='undefined'?globalThis:window);
