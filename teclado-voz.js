(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.PainelTeclado=factory().create(root.document,root);
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  var KEY='painel-voz-tecla',CHOICES=['v','capslock','f2','mouse'];
  function editable(n){return !!n&&(n.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName)||!!n.closest?.('[contenteditable=""],[contenteditable="true"],[role="textbox"]'));}
  function normalize(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
  function create(doc,win){
    var choice='v',held=null,returnFocus=null,selected=0,results=[],animation=null;
    try{var saved=win.localStorage.getItem(KEY);if(CHOICES.includes(saved))choice=saved;}catch(e){}
    function el(tag,id,text,parent){var n=doc.createElement(tag);if(id)n.id=id;if(text)n.textContent=text;if(parent)parent.append(n);return n;}
    var settings=doc.getElementById('panel-settings-options'),label=el('label','teclado-voz-label','Segurar para falar',settings);
    var select=el('select','teclado-voz-tecla',null,label);select.setAttribute('aria-label','Tecla para falar');
    [['v','V'],['capslock','Caps Lock'],['f2','F2'],['mouse','Mouse lateral 3 ou 4']].forEach(function(row){var option=el('option',null,row[1],select);option.value=row[0];});select.value=choice;
    function voice(){return win.PainelVoz;}
    function cancelHold(){if(held!==null||voice()?.busy?.()){held=null;voice()?.cancel();}}
    select.addEventListener('change',function(){cancelHold();choice=CHOICES.includes(select.value)?select.value:'v';select.value=choice;try{win.localStorage.setItem(KEY,choice);}catch(e){}});
    var ir=el('dialog','teclado-ir',null,doc.body),cola=el('dialog','teclado-cola',null,doc.body);
    ir.className=cola.className='teclado-dialogo';ir.setAttribute('aria-labelledby','teclado-ir-titulo');cola.setAttribute('aria-labelledby','teclado-cola-titulo');
    el('h2','teclado-ir-titulo','Ir para',ir);var searchLabel=el('label',null,'Aba ou seção',ir),input=el('input','teclado-busca',null,searchLabel);
    input.type='search';input.placeholder='Buscar no painel';input.autocomplete='off';input.setAttribute('aria-controls','teclado-resultados');
    var list=el('div','teclado-resultados',null,ir),status=el('p','teclado-result-status',null,ir);status.setAttribute('role','status');
    el('h2','teclado-cola-titulo','Atalhos do painel',cola);
    var exemplo=/[?&]exemplo=1(&|$)/.test(win.location?.search||'');
    var rows=[['Segurar a tecla escolhida','Fala com a COORDENADOR. Soltar revisa e envia.'],['V, Caps Lock, F2 ou mouse lateral 3 e 4','Escolha na engrenagem. V é o padrão.'],['Esc','Cancela a fala ou fecha esta caixa.'],['R','repete a última resposta falada.'],['S','Para a fala na hora.'],['1 a 9','Abre a aba pela ordem na barra.'],['Alt + ← / →','Abre a aba anterior ou a próxima.'],['Ctrl + K',exemplo?'Busca as abas e visões deste painel de exemplo.':'Busca abas, seções e projetos de Meu andamento.'],['← / → sem Alt','Troca projetos dentro de Meu andamento.'],['Enter ou Espaço no projeto','Abre o detalhe. Esc ou Voltar fecha.'],['↑ / ↓ e Enter','Escolhe um resultado e vai.'],['?','Abre esta cola.'],['/ e W','Abre a caixa de mensagem e o WEN.'],['B','Mostra ou esconde a barra de cima. Escondida, o mouse parado no topo também a traz.']];
    var dl=el('dl',null,null,cola);rows.forEach(function(row){el('dt',null,row[0],dl);el('dd',null,row[1],dl);});
    el('p',null,'Atalhos pausam enquanto você digita. Editar a revisão pausa o envio.',cola);
    function modal(){return ir.open?ir:cola.open?cola:null;}
    function close(restore){var opened=modal();if(!opened)return;opened.close();if(restore&&returnFocus?.isConnected)returnFocus.focus();}
    [ir,cola].forEach(function(dialog){var b=el('button',null,'Fechar',dialog);b.type='button';b.addEventListener('click',function(){close(true);});dialog.addEventListener('cancel',function(e){e.preventDefault();close(true);});});
    var help=el('button','teclado-ajuda','Atalhos (?)',settings);help.type='button';help.addEventListener('click',function(){open(cola);});
    function tabs(){var catalog=win.PainelGrade?.abas?.()||[];return Array.from(doc.querySelectorAll('.g-tab')).filter(function(b){return !b.hidden;}).map(function(b){return catalog.find(function(t){return t.key===b.dataset.tab;});}).filter(Boolean);}
    function destinations(){var all=[];tabs().forEach(function(tab){all.push({tab:tab.key,label:tab.label});tab.views.forEach(function(view){all.push({tab:tab.key,view:view.id,label:view.label,section:tab.label});});});var projects=[];if(exemplo)return all;projects.forEach(function(p){all.push({project:'p-'+p[0],label:p[1],section:'Meu andamento'});});(win.MeuAndamento?.sections?.()||[]).forEach(function(s){all.push({ownerSection:s.id,label:s.name,section:'Seção de Meu andamento'});});return all;}
    function paint(){
      var term=normalize(input.value);results=destinations().filter(function(d){return normalize(d.label+' '+(d.section||'')).includes(term);});
      selected=Math.max(0,Math.min(selected,results.length-1));list.replaceChildren();
      results.forEach(function(d,i){var b=el('button',null,d.label+(d.section?' · '+d.section:''),list);b.type='button';b.dataset.selecionado=String(i===selected);b.setAttribute('aria-current',String(i===selected));b.addEventListener('click',function(){go(d);});});
      status.textContent=results.length?results.length+' destinos. Enter vai.':exemplo&&!tabs().length?'Esta página de exemplo não tem abas para buscar.':'Nenhum destino. Tente outro nome.';list.children[selected]?.scrollIntoView?.({block:'nearest'});
    }
    input.addEventListener('input',function(){selected=0;paint();});
    function open(dialog){if(modal())close(false);returnFocus=doc.activeElement;dialog.showModal();if(dialog===ir){input.value='';selected=0;paint();input.focus();}else dialog.querySelector('button').focus();}
    function navigate(tab,view,direction){
      var all=tabs(),old=all.findIndex(function(t){return t.key===win.PainelGrade.estado().tab;}),index=all.findIndex(function(t){return t.key===tab;});win.PainelGrade.show(tab,view);
      var main=doc.querySelector('main'),title=doc.getElementById('teclado-titulo-aba');if(!title&&main){title=el('h1','teclado-titulo-aba');main.prepend(title);}
      if(title){title.textContent=(all[index]?.label||'Painel')+(view?' · '+(all[index]?.views.find(function(v){return v.id===view;})?.label||''):'');title.tabIndex=-1;title.focus({preventScroll:true});}
      if(animation){animation.cancel();animation=null;}
      if(!main||win.matchMedia?.('(prefers-reduced-motion: reduce)').matches||doc.documentElement.dataset.motion==='off')return;
      var sign=direction||(index>=old?1:-1);animation=main.animate?.([{transform:'translateX('+(sign*16)+'px)',opacity:.6},{transform:'translateX(0)',opacity:1}],{duration:180,easing:'ease-out'});
    }
    function go(d){close(false);if(d.project){if(win.MeuAndamento)win.MeuAndamento.go(d.project);else win.location.assign('/meu-andamento#'+d.project);return;}if(d.ownerSection){win.MeuAndamento.go(d.ownerSection);return;}navigate(d.tab,d.view);}
    function consume(e){e.preventDefault();e.stopImmediatePropagation();}
    function blocked(e){return editable(e.target)||editable(doc.activeElement)||e.isComposing||e.defaultPrevented||!!doc.querySelector('dialog[open]')||doc.documentElement.classList.contains?.('fh-k-open');}
    function holdKey(e){return choice==='v'&&(e.code==='KeyV'||String(e.key).toLowerCase()==='v')||choice==='capslock'&&e.key==='CapsLock'||choice==='f2'&&e.key==='F2';}
    function keydown(e){
      var opened=modal();
      if(opened){
        if(e.ctrlKey&&!e.altKey&&!e.metaKey&&String(e.key).toLowerCase()==='k'){e.stopImmediatePropagation();return;}
        if(e.key==='Escape'){consume(e);close(true);return;}
        if(opened===ir&&['ArrowUp','ArrowDown','Enter'].includes(e.key)&&!e.isComposing){if(e.key==='Enter'&&e.target!==input)return;consume(e);if(e.key==='Enter'){if(results[selected])go(results[selected]);}else if(results.length){selected=(selected+(e.key==='ArrowDown'?1:-1)+results.length)%results.length;paint();}return;}
        return;
      }
      if(e.key==='Escape'&&(held!==null||voice()?.busy?.())){consume(e);cancelHold();return;}

      if(e.ctrlKey&&!e.altKey&&!e.metaKey&&String(e.key).toLowerCase()==='k'){if(editable(e.target)||editable(doc.activeElement)||e.isComposing||e.defaultPrevented||doc.querySelector('dialog[open]:not(.owner-detail)')||doc.documentElement.classList.contains?.('fh-k-open')){e.stopImmediatePropagation();return;}consume(e);open(ir);return;}
      if(blocked(e)||e.repeat||e.metaKey||e.ctrlKey)return;
      var all=tabs();if(e.altKey){if(!e.shiftKey&&['ArrowLeft','ArrowRight'].includes(e.key)&&all.length){consume(e);var dir=e.key==='ArrowRight'?1:-1,index=all.findIndex(function(t){return t.key===win.PainelGrade.estado().tab;});navigate(all[(index+dir+all.length)%all.length].key,undefined,dir);}return;}
      if(holdKey(e)){consume(e);if(held===null&&voice()?.startHold())held={key:e.key,code:e.code};return;}
      var key=String(e.key).toLowerCase();if(key==='r'||key==='s'){consume(e);if(key==='r')voice()?.repeat();else voice()?.stopSpeech();return;}
      if(e.key==='?'){consume(e);open(cola);return;}
      if(/^[1-9]$/.test(e.key)&&all[Number(e.key)-1]){consume(e);navigate(all[Number(e.key)-1].key);}
    }
    function keyup(e){if(held&&held.button===undefined&&(e.code&&e.code===held.code||String(e.key).toLowerCase()===String(held.key).toLowerCase())){consume(e);held=null;voice()?.endHold();}}
    function mouseDown(e){if(choice!=='mouse'||![3,4].includes(e.button)||blocked(e)||e.altKey||e.ctrlKey||e.metaKey)return;consume(e);if(held===null&&voice()?.startHold())held={button:e.button};}
    function mouseUp(e){if(held?.button===e.button){consume(e);held=null;voice()?.endHold();}}

    win.addEventListener('keydown',keydown,true);win.addEventListener('keyup',keyup,true);win.addEventListener('mousedown',mouseDown,true);win.addEventListener('mouseup',mouseUp,true);
    win.addEventListener('auxclick',function(e){if(choice==='mouse'&&[3,4].includes(e.button)&&!blocked(e))consume(e);},true);
    win.addEventListener('blur',cancelHold);doc.addEventListener('visibilitychange',function(){if(doc.hidden)cancelHold();});win.addEventListener('pagehide',cancelHold);
    return {navigate:navigate,openGo:function(){open(ir);},openHelp:function(){open(cola);}};
  }
  return {create:create,editable:editable};
});
