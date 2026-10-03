(function(root){
  'use strict';
  const T={
    en:{plain:'Paste it into any Claude Code chat running on your computer. Done.',file:'Paste it into any Claude Code chat running on your computer. If it asks to edit the file, allow it. Done.',codex:'I use Codex',claude:'I use Claude Code',copying:'Copying...',copied:'Copied.',failed:'Select the text below and copy it.'},
    pt:{plain:'Cole em qualquer conversa do Claude Code que roda no seu computador. Pronto.',file:'Cole em qualquer conversa do Claude Code que roda no seu computador. Se ela pedir para editar o arquivo, permita. Pronto.',codex:'Uso o Codex',claude:'Uso o Claude Code',copying:'Copiando...',copied:'Copiado.',failed:'Selecione o texto abaixo e copie.'},
    es:{plain:'Pégalo en cualquier conversación de Claude Code que corra en tu ordenador. Listo.',file:'Pégalo en cualquier conversación de Claude Code que corra en tu ordenador. Si pide editar el archivo, permítelo. Listo.',codex:'Uso Codex',claude:'Uso Claude Code',copying:'Copiando...',copied:'Copiado.',failed:'Selecciona el texto de abajo y cópialo.'}
  };
  const language=lang=>Object.prototype.hasOwnProperty.call(T,lang)?lang:'en';
  const targetName=target=>target==='codex'?'Codex':'Claude Code';
  function phrase(lang,target='claude',writesFile=false){return T[language(lang)][writesFile?'file':'plain'].replace('Claude Code',targetName(target));}
  async function copyToClipboard(value,runtime=root){
    try{await runtime.navigator.clipboard.writeText(value);return true;}catch{}
    const doc=runtime.document;if(!doc?.execCommand||!doc?.body)return false;
    const previous=doc.activeElement,field=doc.createElement('textarea');field.value=value;field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';doc.body.append(field);
    try{field.select();return !!doc.execCommand('copy');}catch{return false;}finally{field.remove();previous?.focus?.();}
  }
  function selectText(node,runtime){node.hidden=false;node.focus?.();try{const range=runtime.document.createRange();range.selectNodeContents(node);const selected=runtime.getSelection();selected.removeAllRanges();selected.addRange(range);}catch{}}
  function create(options={}){
    const runtime=options.runtime||root,d=runtime.document,lang=language(options.lang),t=T[lang];
    if(!d)throw Error('Copy controls need a document');
    function el(tag,text,cls){const n=d.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
    const group=el('div',undefined,'copy-session'+(options.className?' '+options.className:'')),button=el('button','','copy-session-button'),switcher=el('button','','copy-session-switch'),phraseNode=el('p','','copy-session-phrase'),status=options.status||el('p','','copy-session-status'),fallback=options.fallback||el('pre','','copy-session-fallback');
    let target=options.target==='codex'?'codex':'claude',text=options.text,busy=false;
    button.type='button';button.dataset.button=options.primary?'primary':'secondary';switcher.type='button';switcher.dataset.button='link';status.setAttribute('role','status');status.setAttribute('aria-live','polite');fallback.tabIndex=0;fallback.hidden=true;
    group.append(button,switcher,phraseNode);if(!options.status)group.append(status);if(!options.fallback)group.append(fallback);
    const valueOf=(value,chosen)=>typeof value==='function'?value(chosen):value;
    const pasteFor=chosen=>String(options.paste?valueOf(options.paste,chosen):phrase(lang,chosen,!!options.writesFile));
    function refresh(){button.textContent=String(valueOf(options.label,target)||{en:'Copy for my AI',pt:'Copiar para a minha IA',es:'Copiar para mi IA'}[lang]);switcher.textContent=t[target==='claude'?'codex':'claude'];phraseNode.textContent=pasteFor(target);group.dataset.target=target;return group;}
    function setTarget(value){if(busy)return false;target=value==='codex'?'codex':'claude';status.textContent='';if(!options.fallback)fallback.hidden=true;refresh();return true;}
    group.setTarget=setTarget;group.setText=value=>{text=value;return group;};group.refresh=refresh;group.getTarget=()=>target;
    switcher.onclick=()=>{if(busy)return;setTarget(target==='claude'?'codex':'claude');options.onTargetChange?.(target,group);};
    button.onclick=async()=>{
      if(busy)return false;
      const copiedTarget=target,value=String(valueOf(text,copiedTarget)||''),copiedPhrase=pasteFor(copiedTarget);if(!value)return false;
      busy=true;button.disabled=true;switcher.disabled=true;button.setAttribute('aria-busy','true');status.textContent=t.copying;
      let copied=false;
      try{copied=await copyToClipboard(value,runtime);if(copied){status.textContent=t.copied;options.onCopied?.({target:copiedTarget,text:value,phrase:copiedPhrase,group});}else{fallback.textContent=value;options.onFallback?.({target:copiedTarget,text:value,phrase:copiedPhrase,group});selectText(fallback,runtime);status.textContent=options.failed||t.failed;}}
      finally{busy=false;button.disabled=false;switcher.disabled=false;button.removeAttribute('aria-busy');}
      return copied;
    };
    Object.assign(group,{button,switcher,status,phrase:phraseNode,fallback});return refresh();
  }
  function mount(host,options){const group=create(options);host.append(group);return group;}
  const api={T,phrase,copyToClipboard,create,mount};if(typeof module==='object'&&module.exports)module.exports=api;if(root.document)root.PanelCopySession=Object.freeze(api);
})(typeof window==='object'?window:globalThis);
