'use strict';
// Ordem de leitura: 1) PRECISA DE VOCE AGORA (destaque, 1 item por linha, onde responder); 2) NO AR; 3) RODANDO com a hora
// prevista (uma forma so: a hora estimada; a faixa fica no title; previsao que ja passou ganha aviso); 4) o resto menor
// (travado por, credito) e "ja acelerado" fechado. Sem texto cortado: tudo quebra linha; listas longas abrem com "ver mais".
// Fonte: GET /api/agora (estado/estado-agora.json, a mesma fonte do WEN). "?" so quando a fonte nao leu. Le ao abrir, a cada
// 30 s com a aba visivel e ao voltar para a aba.
(function(root){
  const doc=root.document,PERIOD=30000,MAX_RODANDO=4;
  const WORDS={
    pt:{title:'Em que pé estamos',read:h=>'atualizado às '+h,ago:n=>n<1?'agora':'há '+n+' min',stale:'pode estar velho',fail:'Não deu para ler o disco agora. Tento de novo em 30 s.',unread:'?',unreadTitle:'sem leitura',
      you:'Precisa de você agora',youNone:'Nada precisa de você agora.',answer:'responder no card ↓',live:'No ar',running:'Rodando',runningNone:'Nenhuma frente rodando informada.',blocked:'Travado por',blockedNone:'nada travado',credit:'Crédito',sped:n=>'Já acelerado ('+n+')',before:'antes',more:n=>'ver mais '+n,less:'ver menos',late:h=>'previsão passou ('+h+')',side:{claude:'Claude',codex:'Codex',ele:'você','os dois':'os dois'}},
    en:{title:'Where we stand',read:h=>'updated at '+h,ago:n=>n<1?'now':n+' min ago',stale:'may be old',fail:'Could not read the disk now. Trying again in 30 s.',unread:'?',unreadTitle:'no reading',
      you:'Needs you now',youNone:'Nothing needs you now.',answer:'answer on the card ↓',live:'Live',running:'Running',runningNone:'No running work reported.',blocked:'Blocked by',blockedNone:'nothing blocked',credit:'Credit',sped:n=>'Already sped up ('+n+')',before:'before',more:n=>'see '+n+' more',less:'see less',late:h=>'estimate passed ('+h+')',side:{claude:'Claude',codex:'Codex',ele:'you','os dois':'both'}},
    es:{title:'Cómo vamos',read:h=>'actualizado a las '+h,ago:n=>n<1?'ahora':'hace '+n+' min',stale:'puede estar viejo',fail:'No se pudo leer el disco ahora. Reintento en 30 s.',unread:'?',unreadTitle:'sin lectura',
      you:'Te necesita ahora',youNone:'Nada te necesita ahora.',answer:'responder en el card ↓',live:'En el aire',running:'En marcha',runningNone:'Ningún frente en marcha informado.',blocked:'Trabado por',blockedNone:'nada trabado',credit:'Crédito',sped:n=>'Ya acelerado ('+n+')',before:'antes',more:n=>'ver '+n+' más',less:'ver menos',late:h=>'la estimación pasó ('+h+')',side:{claude:'Claude',codex:'Codex',ele:'tú','os dois':'los dos'}}
  };
  let data=null,failed=false,busy=false,timer=null,maisRodando=false;
  const lang=()=>{const value=doc.getElementById('language')?.value||doc.documentElement.lang||'pt';return WORDS[value]?value:'pt';};
  function el(tag,className,text){const node=doc.createElement(tag);if(className)node.className=className;if(text!==undefined&&text!==null)node.textContent=text;return node;}
  const brtNow=()=>new Date(Date.now()-3*3600000);
  const clock=iso=>{const at=Date.parse(iso||'');if(!Number.isFinite(at))return null;const d=new Date(at-3*3600000);return String(d.getUTCHours()).padStart(2,'0')+':'+String(d.getUTCMinutes()).padStart(2,'0');};
  // a ultima hora HH:MM do texto de previsao ("~16:15", "15:15 a 15:37", "card ~20:00"); sem hora = null
  function fimPrevisto(texto){const all=[...String(texto||'').matchAll(/(?:^|[^\d:])([01]\d|2[0-3]):([0-5]\d)(?![\d:])/g)];if(!all.length)return null;const m=all[all.length-1],now=brtNow();return {h:m[1]+':'+m[2],min:Number(m[1])*60+Number(m[2]),agora:now.getUTCHours()*60+now.getUTCMinutes()};}
  function creditText(c){if(typeof c==='string')return c||null;if(!c||typeof c!=='object')return null;const parts=['claude','codex'].map(k=>{const a=c[k],nome=k==='claude'?'Claude':'Codex';if(typeof a==='string')return nome+': '+a;if(!a)return null;return nome+': '+(typeof a.semana==='number'?a.semana+'% da semana usado':typeof a.restante==='number'?a.restante+'% restante':a.texto||'?');}).filter(Boolean);return parts.length?parts.join(' · '):null;}
  const known=(s,key)=>s&&s.ok&&!(s.unavailable||[]).includes(key);
  function label(text,id){const n=el('h3','sala-rotulo',text);if(id)n.id=id;return n;}
  function unread(w){const n=el('span','sala-sem-leitura',w.unread);n.title=w.unreadTitle;return n;}
  function blocoVoce(s,w){
    const box=el('section','sala-voce');box.setAttribute('aria-labelledby','sala-voce-titulo');
    box.append(label(w.you,'sala-voce-titulo'));
    if(!known(s,'voce')){box.append(unread(w));return box;}
    const itens=s.voce.filter(v=>v&&v.passo);
    if(!itens.length){box.classList.add('is-vazio');box.append(el('p','sala-voce-nada',w.youNone));return box;}
    const ol=el('ol','sala-voce-lista');
    for(const v of itens){
      const li=el('li','sala-voce-item');
      // "Merge do AGENTE-1 (chat da ASSISTENTE)" + chip "chat da ASSISTENTE" repetia: o parentese igual ao onde sai do texto
      const sufixo=v.onde?' ('+v.onde+')':'',passo=sufixo&&String(v.passo).toLowerCase().endsWith(sufixo.toLowerCase())?String(v.passo).slice(0,-sufixo.length).trim():v.passo;
      li.append(el('span','sala-voce-passo',passo||v.passo));
      const meta=el('span','sala-voce-meta');
      if(v.onde)meta.append(el('span','sala-chip',v.onde));
      if(v.card&&!/^nenhum$/i.test(v.card)&&doc.getElementById('rotina-card')){const b=el('button','sala-link',w.answer);b.type='button';b.addEventListener('click',()=>{const alvo=doc.getElementById('rotina-card');if(alvo&&!alvo.hidden){alvo.scrollIntoView({block:'start',behavior:root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});const f=alvo.querySelector('.inf-opcao');if(f)f.focus({preventScroll:true});}});meta.append(b);}
      if(meta.childElementCount)li.append(meta);
      ol.append(li);
    }
    box.append(ol);return box;
  }
  function linhaSimples(cls,titulo,cortes){const row=el('div','sala-linha '+cls);row.append(label(titulo));const body=el('div','sala-corpo-linha');for(const c of cortes)body.append(c);row.append(body);return row;}
  function blocoRodando(s,w){
    const row=el('div','sala-linha sala-rodando');
    if(!known(s,'rodando')){row.append(label(w.running));row.append(unread(w));return row;}
    const itens=s.rodando.filter(v=>v&&v.o_que);
    row.append(label(w.running+(itens.length?' ('+itens.length+')':'')));
    if(!itens.length){row.append(el('p','sala-nada',w.runningNone));return row;}
    const ul=el('ul','sala-rodando-lista');
    itens.forEach((v,i)=>{
      const li=el('li','sala-rodando-item');if(i>=MAX_RODANDO&&!maisRodando)li.hidden=true;
      const quando=v.quando||v.faixa||'';
      const t=el('span','sala-quando',quando||w.unread);if(v.faixa&&v.faixa!==quando)t.title=v.faixa;if(!quando)t.title=w.unreadTitle;
      const oque=el('span','sala-oque');
      if(['claude','codex','ele','os dois'].includes(v.lado)){const dot=el('i','sala-lado is-'+v.lado.replace(' ','-'));dot.title=w.side[v.lado];oque.append(dot);}
      oque.append(doc.createTextNode(v.o_que));
      li.append(t,oque);
      const fim=/(?:(?:previs[aã]o|estimativa|ETA)\b|~)/i.test(v.quando||'')&&!/\b(?:feito|conclu[ií]do|aplicado|verde)\b/i.test(v.quando||'')?fimPrevisto(v.quando):null;
      if(fim&&fim.agora-fim.min>5&&fim.agora-fim.min<12*60)li.append(el('span','sala-atrasado',w.late(fim.h)));
      ul.append(li);
    });
    row.append(ul);
    if(itens.length>MAX_RODANDO){const b=el('button','sala-link',maisRodando?w.less:w.more(itens.length-MAX_RODANDO));b.type='button';b.setAttribute('aria-expanded',String(maisRodando));b.addEventListener('click',()=>{maisRodando=!maisRodando;render();});row.append(b);}
    return row;
  }
  function render(){
    const list=doc.getElementById('sala-linhas');if(!list)return;
    const w=WORDS[lang()],s=data&&data.agora;
    doc.getElementById('sala-titulo').textContent=w.title;
    const at=doc.getElementById('sala-lido');
    at.classList.toggle('sala-falhou',failed);at.classList.toggle('sala-velho',!failed&&!!(s&&s.stale));
    at.textContent=failed?w.fail:s&&s.atualizadoEm?w.read(clock(s.atualizadoEm))+' · '+w.ago(s.ageMinutes||0)+(s.stale?' · '+w.stale:''):'';
    if(!data){list.replaceChildren(el('p','sala-carregando','...'));return;}
    const partes=[blocoVoce(s,w)];
    partes.push(linhaSimples('sala-noar',w.live,known(s,'noAr')&&s.noAr.length?s.noAr.map(t=>el('p','sala-texto',t)):[unread(w)]));
    partes.push(blocoRodando(s,w));
    const baixo=el('div','sala-baixo');
    baixo.append(linhaSimples('sala-travado',w.blocked,known(s,'travado')?(s.travado.length?s.travado.map(t=>el('p','sala-texto',t)):[el('p','sala-nada',w.blockedNone)]):[unread(w)]));
    let canonical;try{canonical=typeof latestSnapshot!=='undefined'?latestSnapshot?.credits:null;}catch{}const cred=canonical&&root.PainelCreditoModelo?root.PainelCreditoModelo.text(canonical,lang()):s&&s.ok&&!(s.unavailable||[]).includes('credito')?creditText(s.credito)+({pt:' · registro histórico',en:' · historical record',es:' · registro histórico'})[lang()]:null;
    baixo.append(linhaSimples('sala-credito',w.credit,cred?[el('p','sala-texto',cred)]:[unread(w)]));
    partes.push(baixo);
    if(known(s,'acelerar')){const itens=s.acelerar.filter(v=>v&&v.feito);if(itens.length){const d=el('details','sala-acelerado');d.append(el('summary',null,w.sped(itens.length)));const ul=el('ul');for(const v of itens){const li=el('li');li.append(el('span','sala-texto',v.feito||v.espera));if(v.feito&&v.espera)li.append(el('span','sala-antes',' · '+w.before+': '+v.espera));ul.append(li);}d.append(ul);partes.push(d);}}
    if(known(s,'acelerar')){const proposals=s.acelerar.filter(v=>v&&!v.feito&&v.espera);if(proposals.length){const d=el('details','sala-propostas');d.append(el('summary',null,({pt:'Propostas de aceleração',en:'Acceleration proposals',es:'Propuestas de aceleración'})[lang()]+' ('+proposals.length+')'));const ul=el('ul');for(const v of proposals){const li=el('li');li.textContent=v.espera;ul.append(li);}d.append(ul);partes.push(d);}}
    const aberto=list.querySelector('details.sala-acelerado[open]');
    list.replaceChildren(...partes);
    if(aberto){const d=list.querySelector('details.sala-acelerado');if(d)d.open=true;}
    if(typeof root.CustomEvent==='function')doc.dispatchEvent(new root.CustomEvent('painel:agora-leitura',{detail:{agora:s,failed}}));
  }
  async function read(){
    if(busy)return;busy=true;
    try{
      const example=/[?&]exemplo=1(?:&|$)/.test(root.location.search);
      const response=await root.fetch('/api/agora'+(example?'?exemplo=1':''),{cache:'no-store'});
      if(!response.ok)throw Error('status '+response.status);
      const next=await response.json();if(!next||!next.agora)throw Error('sem dados');
      data=next;failed=false;
    }catch{failed=true;}
    finally{busy=false;render();}
  }
  function start(){
    render();read();
    timer=root.setInterval(()=>{if(!doc.hidden)read();},PERIOD);
    doc.addEventListener('visibilitychange',()=>{if(!doc.hidden)read();});
    doc.getElementById('language')?.addEventListener('change',()=>root.setTimeout(render,0));
  }
  root.PainelSala=Object.freeze({read,render,fimPrevisto,leitura:()=>({agora:data?.agora||null,failed}),stop:()=>{if(timer)root.clearInterval(timer);timer=null;}});
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);
