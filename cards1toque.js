'use strict';
(function(root){
 const D=root.document;
 function safeBatch(cards){return cards.filter(c=>!c.perigoso&&!c.bloqueado&&c.tipoLivre==='decisao'&&c.opcoes.some(o=>o.recomendada));}
 function openChat(card){if(card.chatLink){root.location.href=card.chatLink;return;}D.getElementById('tab-sessions')?.click();const key=card.familia==='codex'?'codex:coordenador':'claude:'+String(card.sessao||'').replace(/^Claude$/i,'COORDENADOR').toUpperCase();const column=Array.from(D.querySelectorAll('[data-key]')).find(x=>x.dataset.key===key);column?.scrollIntoView({block:'center'});column?.querySelector('textarea')?.focus();return !!column;}
 function mount(host,{post,refresh,notice}){
  const el=(tag,cl,text)=>{const n=D.createElement(tag);if(cl)n.className=cl;if(text!==undefined)n.textContent=text;return n;};
  const button=(label,fn,cl='')=>{const b=el('button',cl,label);b.type='button';b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch{notice('Não consegui gravar. Atualize e tente de novo.');}finally{if(b.isConnected)b.disabled=false;}});return b;};
  function render(cards,source){host.replaceChildren();const h=el('div','agora-heading');h.append(el('h2','',cards.length?'O que precisa de você':'Nenhum card esperando'));const batch=safeBatch(cards);if(batch.length>1)h.append(button('Aceitar as '+batch.length+' recomendadas',async()=>{const result=await post('/api/agora/recomendadas',{cards:batch.map(c=>({arquivo:c.arquivo,versao:c.versao}))});notice(result.ok?'Recomendadas registradas e recados enviados.':result.mensagem);await refresh();},'agora-primary'));host.append(h);
   for(const c of cards){const article=el('article','agora-card'+(c.perigoso?' is-chat':''));article.dataset.cardId=c.id;article.append(el('span','agora-owner',root.PainelNomes?root.PainelNomes.nome(c.sessao):String(c.sessao||'').replace(/^COORDENADOR$/i,'Claude')),el('h3','',c.pergunta||'Responda no chat de quem executa.'));if(c.perigoso){article.append(el('p','agora-note',c.avisoPerigo||c.motivo||'Esta decisão precisa do chat de quem executa.'),button('Ver '+c.ondeResponder,()=>openChat(c),'agora-chat'));host.append(article);continue;}
    article.append(el('p','agora-gain',c.ganhoTempo?'Ganho: '+c.ganhoTempo:'Ganho em tempo: sem estimativa'));const opts=el('div','agora-options');for(const o of c.opcoes){const b=button(o.label+(o.recomendada?' · Recomendada':''),async()=>{const r=await post('/api/agora/responder',{arquivo:c.arquivo,versao:c.versao,opcao:o.indice});notice(r.ok?'Escolha registrada e recado enviado.':r.mensagem);await refresh();},o.recomendada?'agora-primary':'');opts.append(b);if(o.descricao)opts.append(el('small','',o.descricao));}article.append(opts);
    if(c.tipoLivre==='passos')c.passos.forEach((p,i)=>{const row=el('div','agora-step');row.append(el('span','',p.texto||p.titulo||p.label||'Passo '+(i+1)));const done=c.feitos.includes(i);const b=button(done?'Feito':'Fiz',async()=>{const r=await post('/api/agora/responder',{arquivo:c.arquivo,versao:c.versao,passo:i,feito:true});notice(r.ok?'Passo registrado.':r.mensagem);await refresh();});b.disabled=done;row.append(b);article.append(row);});host.append(article);
   }
  }
  return {render};
 }
 const api={mount,safeBatch,openChat};if(typeof module==='object'&&module.exports)module.exports=api;else root.PainelCards1Toque=Object.freeze(api);
})(typeof window==='object'?window:globalThis);
