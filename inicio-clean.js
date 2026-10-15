'use strict';
//  - Topo: marca, WEN, AUTOMATIZAR e ACELERAR (#gancho-acelerador); Comando, idioma e Lofi vao para o menu da engrenagem;
//    "Ao vivo" vira ponto de estado (o texto fica no title); o "sem leitura" do WEN sai do topo (o WEN aberto mostra a hora).
//  - Abas: Inicio, Equipe, Sessoes e Consumo; Lancamentos, Projetos, Fila e Alimente sua IA em "Mais".
//  - Numero de agentes trabalhando agora (a MESMA conta da Equipe: PainelEquipePE.contagem), grande, no topo; 1 clique abre a Equipe.
//    esperando, dormindo, terminou); a cor do ponto e a do lado (laranja Claude, azul Codex). Rosa so para o dono.
//    1 linha do que mudou + "ver" + fechar; fechou, nao volta para a mesma novidade (nem para as mais velhas).
//  - Quem esta trabalhando: 1 linha por sessao (as 2 COORDENADOR e as sessoes do Claude), com retrato pequeno, o que faz, o estado
//    e "entrega ~HH:MM" so quando a propria sessao escreveu a previsao. Fonte: GET /api/coordenador-pb (so leitura).
(function(root){
  const doc=root.document,$=id=>doc.getElementById(id);
  doc.documentElement.classList.add('ic');
  const W={
    pt:{agents:n=>n===1?'agente trabalhando agora':'agentes trabalhando agora',agentsTitle:'Abrir a Equipe',atLeast:'pelo menos',byActivity:'conta pela atividade dos últimos 5 min',more:'Mais',language:'Idioma',who:'Quem está trabalhando',team:'Ver toda a equipe',delivery:'entrega',estimated:'estimada',ago:'há',unread:'Sem leitura agora',spend:'Quanto gastei esta semana',state:{trabalhando:'trabalhando',esperando:'esperando',dormindo:'dormindo',terminou:'terminou','sem-leitura':'?',ativa:'ativa',quieta:'quieta',livre:'livre',parada:'parada','?':'?'},open:'Abrir as falas desta sessão'},
    en:{agents:n=>n===1?'agent working now':'agents working now',agentsTitle:'Open the Team',atLeast:'at least',byActivity:'counted from activity in the last 5 min',more:'More',language:'Language',who:'Who is working',team:'See the whole team',delivery:'delivery',estimated:'estimated',ago:'',unread:'No reading now',spend:'What I spent this week',state:{trabalhando:'working',esperando:'waiting',dormindo:'sleeping',terminou:'finished','sem-leitura':'?',ativa:'active',quieta:'quiet',livre:'free',parada:'stopped','?':'?'},open:'Open this session messages'},
    es:{agents:n=>n===1?'agente trabajando ahora':'agentes trabajando ahora',agentsTitle:'Abrir el Equipo',atLeast:'al menos',byActivity:'cuenta por la actividad de los últimos 5 min',more:'Más',language:'Idioma',who:'Quién está trabajando',team:'Ver todo el equipo',delivery:'entrega',estimated:'estimada',ago:'hace',unread:'Sin lectura ahora',spend:'Cuánto gasté esta semana',state:{trabalhando:'trabajando',esperando:'esperando',dormindo:'durmiendo',terminou:'terminó','sem-leitura':'?',ativa:'activa',quieta:'quieta',livre:'libre',parada:'parada','?':'?'},open:'Abrir los mensajes de esta sesión'}
  };
  // O que cada sessao faz (ate 6 palavras). Sessao fora desta lista mostra a fala mais nova, cortada em 6 palavras.
  const ROLES={
    pt:{'COORDENADOR do Codex':'Coordena o lado do Codex','Claude':'Coordena o lado do Claude',ATENDIMENTO:'Cuida do atendimento e das subidas',LOJA:'Produtos e pedidos',CORTES:'Posts, arte e vídeos',ASSISTENTE:'Tracker e assistentes'},
    en:{'COORDENADOR do Codex':'Coordinates the Codex side','Claude':'Coordinates the Claude side',ATENDIMENTO:'Support and deliveries',LOJA:'Store and orders',CORTES:'Posts, art and videos',ASSISTENTE:'Automations and helpers'},
    es:{'COORDENADOR do Codex':'Coordina el lado de Codex','Claude':'Coordina el lado de Claude',ATENDIMENTO:'Atención y entregas',LOJA:'Tienda y pedidos',CORTES:'Posts, arte y videos',ASSISTENTE:'Automatizaciones y ayudantes'}
  };
  const MAIS=['launches','projects','queue','tips'];
  const DONE=/\b(?:NO AR|SUBIU|FEITO|VERDE|ENTREGUE)\b|\b(?:subiu|entregue|entregou)\b/;
  const lang=()=>{const value=$('language')?.value||doc.documentElement.lang||'pt';return W[value]?value:'pt';};
  const snap=()=>{try{return typeof latestSnapshot!=='undefined'&&latestSnapshot?latestSnapshot:null;}catch{return null;}};
  const el=(tag,className,text)=>{const node=doc.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};

  // ---------- topo ----------
  function arrumarTopo(){
    const actions=doc.querySelector('.header-actions'),options=$('panel-settings-options');if(!actions||!options)return;
    let menu=options.querySelector('.ic-menu');
    if(!menu){menu=el('div','ic-menu');options.prepend(menu);}
    const command=$('command-trigger');if(command&&command.parentElement!==menu)menu.append(command);
    const language=$('language');
    if(language&&!language.closest('.ic-menu')){const row=el('label','ic-menu-row');const word=el('span','ic-menu-label');word.dataset.icWord='language';row.append(word,language);menu.append(row);}
    const lofi=$('lofi-trigger');if(lofi&&lofi.parentElement!==menu)menu.append(lofi);
    const wen=actions.querySelector('.wen-controls'),acel=$('gancho-acelerador');
    if(wen&&acel&&wen.nextElementSibling!==acel)wen.after(acel);
    // Normal ("Ao vivo" ou a hora da leitura) vira so o ponto; falha de leitura continua escrita no topo.
    const local=actions.querySelector('.local'),status=$('status');if(local&&status){const text=status.textContent.trim();local.title=text;local.dataset.ok=/n[aã]o foi poss|could not|no se pudo|falh|erro|sem leitura|no reading|sin lectura/i.test(text)?'0':'1';}
    for(const node of doc.querySelectorAll('[data-ic-word]'))node.textContent=W[lang()][node.dataset.icWord];
  }

  // ---------- abas ----------
  function arrumarAbas(){
    const nav=doc.querySelector('.panel-tabs');if(!nav||nav.querySelector('.tabs-mais'))return;
    const details=el('details','tabs-mais'),summary=el('summary','tabs-mais-botao'),list=el('div','tabs-mais-lista');
    summary.dataset.icWord='more';summary.textContent=W[lang()].more;
    for(const key of MAIS){const button=$('tab-'+key);if(button)list.append(button);}
    details.append(summary,list);nav.append(details);
    list.addEventListener('click',event=>{if(event.target.closest('[role=tab]'))details.open=false;});
    doc.addEventListener('click',event=>{if(details.open&&!details.contains(event.target))details.open=false;});
    doc.addEventListener('keydown',event=>{if(event.key==='Escape')details.open=false;});
    const mark=()=>summary.classList.toggle('is-active',MAIS.some(key=>$('tab-'+key)?.getAttribute('aria-selected')==='true'));
    new MutationObserver(mark).observe(list,{subtree:true,attributes:true,attributeFilter:['aria-selected']});mark();
  }

  // ---------- numero de agentes ----------
  function contaDoLeitor(snapshot){
    // a mesma conta do topo da Equipe e dos dois lados (uma fonte so); sem o modulo da Equipe, a conta antiga
    const modelo=root.PainelEquipePE;
    if(modelo&&typeof modelo.contagem==='function'){try{const conta=modelo.contagem(snapshot,Date.now());if(conta&&Number.isInteger(conta.trabalhando)&&(snapshot?.equipe||snapshot?.operator))return conta.trabalhando;}catch{}}
    const equipe=snapshot?.equipe;if(!equipe||typeof equipe!=='object')return null;
    if(Number.isInteger(equipe.active)&&equipe.active>=0)return equipe.active;
    return Array.isArray(equipe.agents)?equipe.agents.filter(agent=>['working','walking'].includes(agent?.state)).length:null;
  }
  // sessao ativa na lista abaixo. Nesse caso a conta vem da atividade que a tela ja tem (o mesmo dado que pinta "ativa · agora"):
  // sessoes do Claude e do Codex com atividade nos ultimos 5 min, as que a lista diz trabalhando e os ajudantes recentes que
  // ainda nao fecharam. Leitor incompleto = "pelo menos N"; sem leitura nenhuma = "?" (nunca 0 inventado).
  const ATIVA_MS=5*60000,FUTURO_MS=2*60000,COORDENADOR_NOME=/^coordenador\b/i;
  const horaDe=value=>{const at=Date.parse(value||'');return Number.isFinite(at)?at:null;};
  const maisNova=(...values)=>values.map(horaDe).reduce((best,at)=>at!==null&&(best===null||at>best)?at:best,null);
  function chaveDe(family,id){const raw=String(id||'').replace(/^(?:codex|claude):/i,'');if(!raw)return null;return family==='codex'?(raw.toLowerCase()==='coordenador'?'codex:coordenador':'codex:'+raw.toLowerCase()):'claude:'+raw.toUpperCase();}
  function leitorCompleto(snapshot){
    const equipe=snapshot?.equipe,proof=snapshot?.metadataProof;
    if(!equipe||typeof equipe!=='object'||equipe.scanning===true)return false;
    if(proof&&typeof proof==='object')return proof.complete===true&&(snapshot.readerStatus===undefined||snapshot.readerStatus==='ready');
    return equipe.countsExact!==false;
  }
  function atividade(snapshot,now){const set=ativas(snapshot,now);return set===null?null:set.size;}
  function ativas(snapshot,now){
    const vistos=new Map(),alias=new Map();let leu=false;
    const marca=(chave,at,agora)=>{if(!chave)return;leu=true;const item=vistos.get(chave)||{at:null,agora:false};if(at!==null&&at<=now+FUTURO_MS&&(item.at===null||at>item.at))item.at=at;if(agora)item.agora=true;vistos.set(chave,item);};
    const raiz=(family,id,name)=>family==='codex'&&COORDENADOR_NOME.test(String(name||''))?'codex:coordenador':alias.get((family+':'+String(id||'').replace(/^(?:codex|claude):/i,'')).toLowerCase())||chaveDe(family,id);
    // 1) as linhas de "Quem esta trabalhando" (GET /api/coordenador-pb): o estado e a hora que a lista pinta
    for(const session of Array.isArray(sessions)?sessions:[]){const family=String(session?.key||'').split(':')[0];marca(chaveDe(family==='codex'?'codex':'claude',session?.key),horaDe(session?.lastAt),session?.busy===true||session?.state==='trabalhando');}
    // 2) o estado da tela (GET /api/estado): as sessoes do Claude, as conversas do Codex e os agentes com hora
    for(const item of Array.isArray(snapshot?.operator?.sessions)?snapshot.operator.sessions:[]){
      const chave=chaveDe('claude',item?.id);if(!chave)continue;
      if(item.node?.conversationId)alias.set(String(item.node.conversationId).toLowerCase(),chave);
      marca(chave,maisNova(item.node?.lastAt,item.updatedAt),false);
    }
    for(const item of Array.isArray(snapshot?.commandSessions)?snapshot.commandSessions:[]){if(item?.threadId){const family=item.family==='claude'?'claude':'codex';marca(raiz(family,item.threadId,item.name),horaDe(item.lastAt),false);}}
    for(const agent of Array.isArray(snapshot?.equipe?.agents)?snapshot.equipe.agents:[]){
      if(!agent||typeof agent.id!=='string')continue;
      const family=agent.family==='claude'||/^claude:/i.test(agent.id)?'claude':'codex',proof=agent.workProof&&typeof agent.workProof==='object'?agent.workProof:{};
      const at=maisNova(agent.lastAt,agent.eventLastAt),seen=horaDe(proof.observedAt);
      const provaTrabalhando=proof.state==='working'&&proof.closedAt==null&&seen!==null&&now-seen<=ATIVA_MS;
      if(agent.parentId){const fechou=agent.state==='done'||proof.state==='done'||proof.closedAt!=null;marca('ajudante:'+agent.id.toLowerCase(),fechou?null:at,provaTrabalhando);}
      else marca(raiz(family,agent.id,agent.conversationName||agent.conversation),at,provaTrabalhando);
    }
    if(!leu)return null;
    const out=new Set();for(const [chave,item] of vistos)if(item.agora||(item.at!==null&&now-item.at<=ATIVA_MS))out.add(chave);
    return out;
  }
  function mistura(snapshot){const set=ativas(snapshot,Date.now());if(!set||!set.size)return null;let claude=0,codex=0;for(const k of set){const lado=k.startsWith('ajudante:')?k.slice(9):k;if(lado.startsWith('claude:'))claude++;else if(lado.startsWith('codex:'))codex++;}return claude+codex?{claude,codex,pct:Math.round(100*claude/(claude+codex))}:null;}
  function agentes(snapshot){
    const leitor=contaDoLeitor(snapshot),completo=leitorCompleto(snapshot),ativos=atividade(snapshot,Date.now());
    if(completo&&leitor!==null&&(leitor>0||!ativos))return {n:leitor,parcial:false,atividade:false};
    if(ativos===null)return completo||!(leitor>0)?{n:completo?leitor:null,parcial:false,atividade:false}:{n:leitor,parcial:true,atividade:false};
    const n=Math.max(ativos,leitor||0);
    return {n,parcial:!completo&&n>0,atividade:true};
  }
  function renderAgentes(){
    const button=$('sala-agentes');if(!button)return;
    const snapshot=snap(),conta=snapshot?agentes(snapshot):null,n=conta?conta.n:undefined,w=W[lang()];
    const mix=snapshot&&typeof n==='number'?mistura(snapshot):null,num=el('span','ic-agentes-num',n===undefined?'...':n===null?'?':String(n));
    if(mix){num.classList.add('agentes-mix');num.style.setProperty('--mix-claude',mix.pct+'%');num.title='Claude '+mix.claude+' · Codex '+mix.codex;}
    $('sala-agentes-n').replaceChildren(...(conta?.parcial?[el('span','ic-pelo-menos',w.atLeast+' ')]:[]),num);
    $('sala-agentes-rotulo').textContent=w.agents(n);
    // na proporcao e a legenda com os dois numeros, para a cor nao depender so do degrade dentro do algarismo.
    let mixEl=$('sala-agentes-mix');if(!mixEl){mixEl=el('span','ic-mix');mixEl.id='sala-agentes-mix';button.append(mixEl);}
    if(mix){const barra=el('span','ic-mix-barra'),a=el('i','ic-mix-claude'),b=el('i','ic-mix-codex');a.style.flexGrow=String(mix.claude);b.style.flexGrow=String(mix.codex);barra.append(a,b);const leg=el('span','ic-mix-leg');leg.append(el('b','ic-mix-c','Claude '+mix.claude),doc.createTextNode(' · '),el('b','ic-mix-x','Codex '+mix.codex));mixEl.replaceChildren(barra,leg);mixEl.hidden=false;}
    else{mixEl.replaceChildren();mixEl.hidden=true;}
    button.title=w.agentsTitle+(conta?.atividade?' · '+w.byActivity:'');
  }

  // ---------- quem esta trabalhando (1 linha por sessao) ----------
  let sessions=null,failed=false,busy=false;
  const portraits=()=>{const seen=new Set(),out=[];for(const agent of snap()?.equipe?.agents||[]){const image=typeof agent?.agente==='string'?agent.agente:agent?.agente?.image;if(typeof image==='string'&&/^\/(?:agentes\/[1-9]\d{0,4}\.png|assets\/agentes\/[a-f\d]{16,64}\.(?:png|webp|jpg))$/.test(image)&&!seen.has(image)){seen.add(image);out.push(image);}}return out;};
  const hash=text=>{let h=0;for(const ch of String(text))h=(h*31+ch.charCodeAt(0))>>>0;return h;};
  function ago(iso){const at=Date.parse(iso||'');if(!Number.isFinite(at))return '';const min=Math.max(0,Math.round((Date.now()-at)/60000)),w=W[lang()];if(min<1)return ({pt:'agora',en:'now',es:'ahora'})[lang()];const span=min<60?min+' min':Math.floor(min/60)+' h';return lang()==='en'?span+' ago':w.ago+' '+span;}
  function previsao(session){
    const now=Date.now();
    for(const fala of (session.falas||[]).slice(0,3)){
      const at=Date.parse(fala?.at||'');if(!Number.isFinite(at)||now-at>12*3600000)continue;
      const text=String(fala.full||fala.text||'');if(DONE.test(text))continue;
      const match=/(?:~\s*|\b(?:previs[aã]o|ETA|entrega|pronto|termina)[^\d]{0,12})([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/i.exec(text);if(!match)continue;
      const day=new Date(at-3*3600000);let target=Date.UTC(day.getUTCFullYear(),day.getUTCMonth(),day.getUTCDate(),Number(match[1]),Number(match[2]))+3*3600000;
      if(target<at)target+=86400000;
      if(target>now&&target-now<=12*3600000&&target-at<=12*3600000)return match[1].padStart(2,'0')+':'+match[2];
    }
    return null;
  }
  function oQueFaz(session){
    const role=ROLES[lang()][session.name];if(role)return role;
    const text=String(session.falas?.[0]?.text||'').replace(/^\s*(?:Rodando|Fez|Próximo|Proximo)\s*:\s*/i,'').split(/[.:;(]/)[0].trim();
    return text.split(/\s+/).slice(0,6).join(' ');
  }
  // Estado de cada linha pelo modelo das duas IAs (o mesmo da Equipe); sem ele, o estado que o /api/coordenador-pb trouxe.
  function caixaDe(session){
    const modelo=root.PainelEquipePE,snapshot=snap();if(!modelo||typeof modelo.ladosOf!=='function'||!snapshot)return null;
    let lados;try{lados=modelo.ladosOf(snapshot,Date.now());}catch{return null;}
    const [claude,codex]=lados.lados;
    if(session.kind==='coordenador')return session.family==='codex'?codex.coordenador:claude.coordenador;
    if(session.family==='claude')return claude.sessoes.find(box=>box.chave===String(session.name||'').toUpperCase())||null;
    const id=String(session.key||'').replace(/^codex:/,'').toLowerCase();
    return codex.sessoes.find(box=>String(box.chave||'').toLowerCase()==='codex:'+id)||null;
  }
  function renderSessoes(){
    const list=$('inicio-sessoes-lista');if(!list)return;
    const w=W[lang()];$('inicio-sessoes-titulo').textContent=w.who;$('inicio-sessoes-mais').firstChild.textContent=w.team+' ';
    if(!sessions){list.replaceChildren(el('li','ic-vazio',failed?w.unread:'...'));return;}
    const images=portraits();
    // casa do Claude (a mesma conta do numero); o texto da linha fica como era.
    const anim=root.PaAnim,modeloCasa=(()=>{try{return anim&&root.PainelEquipePE?.ladosOf?root.PainelEquipePE.ladosOf(snap(),Date.now(),false,{casa:true}):null;}catch{return null;}})();
    const caixaCasa=session=>{if(!modeloCasa)return null;const [claude,codex]=modeloCasa.lados;if(session.kind==='coordenador')return session.family==='codex'?(codex.coordenador?.coordVivo?codex.coordenador:null):claude.coordenador;if(session.family==='claude')return claude.sessoes.find(box=>box.chave===String(session.name||'').toUpperCase())||null;const id='codex:'+String(session.key||'').replace(/^codex:/,'').toLowerCase();return [codex.coordenador,...codex.sessoes].find(box=>String(box?.raw?.id||'').toLowerCase()===id)||null;};
    list.replaceChildren(...sessions.map(session=>{
      const item=el('li'),button=el('button','ic-sessao');button.type='button';button.title=w.open;button.dataset.family=session.family==='codex'?'codex':'claude';
      const image=el('img','ic-retrato');image.alt='';image.width=28;image.height=28;image.loading='lazy';image.src=images.length?images[hash(session.name)%images.length]:'/marca.png';
      const text=el('span','ic-sessao-texto');text.append(el('strong','ic-sessao-nome',session.name),el('span','ic-sessao-faz',session.reserved?'':oQueFaz(session)));
      // caixa do modelo "sem leitura" (leitor so de metadados: as 2 COORDENADOR) nao apaga o estado que o /api/coordenador-pb leu, o mesmo das outras linhas
      const modelo=caixaDe(session),box=modelo&&modelo.estado!=='sem-leitura'?modelo:null,state=box?box.estado:session.busy?'trabalhando':session.state,info=el('span','ic-sessao-info');
      const lastAt=box?(box.ultimaEm?new Date(box.ultimaEm).toISOString():null):session.lastAt;
      const dot=el('i','ic-ponto');dot.dataset.state=['trabalhando','ativa'].includes(state)?'on':['?','sem-leitura'].includes(state)?'unknown':'off';
      const line=el('span','ic-sessao-linha');line.append(dot,el('span','ic-sessao-estado',(w.state[state]||state||'?')+(lastAt&&!['?','sem-leitura'].includes(state)?' · '+ago(lastAt):'')));
      info.append(line);
      const eta=previsao(session);if(eta)info.append(el('span','ic-sessao-entrega',w.delivery+' ~'+eta+' · '+w.estimated));
      button.append(image,text,info);
      if(anim){try{const casa=caixaCasa(session),now=Date.now();anim.aplicar(button,casa&&root.PainelEquipePE.animInfo?root.PainelEquipePE.animInfo(casa,now):{familia:button.dataset.family,estado:state},lang());}catch{}}
      button.addEventListener('click',()=>$('tab-sessions')?.click());
      item.append(button);return item;
    }));
  }
  async function lerSessoes(){
    if(/[?&]exemplo=1(?:&|$)/.test(root.location.search)){failed=true;renderSessoes();return;}
    if(busy)return;busy=true;
    try{const response=await root.fetch('/api/coordenador-pb',{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();sessions=(Array.isArray(data.sessions)?data.sessions:[]).filter(session=>session&&['coordenador','sessao'].includes(session.kind));failed=false;}
    catch{failed=true;}
    finally{busy=false;renderSessoes();renderAgentes();}
  }

  // ---------- o que precisa de voce: a soma dos cards e dos pedidos que o modulo dos cards mostra ----------
  function renderPrecisa(){
    const badge=$('ic-precisa-n'),box=doc.querySelector('#gancho-cards .pcc');if(!badge)return;
    const title=$('ic-precisa-titulo');if(title)title.textContent=({pt:'O que precisa de você',en:'What needs you',es:'Lo que te necesita'})[lang()];
    if(!box){badge.hidden=true;return;}
    const read=selector=>{const value=Number(box.querySelector(selector)?.textContent);return Number.isFinite(value)?value:0;};
    const total=read('.pcc-titulo .pcc-conta')+read('.pcc-bloco__titulo .pcc-conta');
    badge.textContent=String(total);badge.hidden=total===0;
  }
  function vigiarPrecisa(){const host=doc.querySelector('#gancho-cards [data-pc-cards]');if(host)new MutationObserver(renderPrecisa).observe(host,{childList:true,subtree:true,characterData:true});renderPrecisa();}

  // ---------- consumo: 2 numeros (tokens e agua ficam em Consumo) ----------
  function renderGasto(){const title=$('home-spend-title');if(title)title.textContent=W[lang()].spend;}
  // Linha Credito de "Em que pe estamos" (sala.js, GET /api/status-6): o mesmo conserto do WEN (PainelWen.fixCredit, status6.js)
  function arrumarCredito(){
    const fix=root.PainelWen?.fixCredit,texto=doc.querySelector('#sala-linhas .sala-credito .sala-texto');if(typeof fix!=='function'||!texto)return;
    const line=fix({key:'credito',text:texto.textContent},snap(),Date.now());if(line&&typeof line.text==='string'&&line.text!==texto.textContent)texto.textContent=line.text;
  }

  // ---------- faixa de novidade: no topo, abaixo do cabecalho, no estilo dos cartoes ----------
  const VISTA_KEY='painel-novidade-vista-ate',JANELA_NOVIDADE=12*3600000,RESERVADAS=['ASSISTENTE'];
  const FW={pt:{k:'Novidade no ar',ver:'ver',fechar:'Fechar o aviso',reservada:s=>'trabalho da '+s+' · detalhe no chat da '+s},en:{k:'New and live',ver:'see',fechar:'Close the notice',reservada:s=>s+' work · details in the '+s+' chat'},es:{k:'Novedad en vivo',ver:'ver',fechar:'Cerrar el aviso',reservada:s=>'trabajo de '+s+' · detalle en el chat de '+s}};
  let novidade=null;
  function vistaAte(){try{return Date.parse(localStorage.getItem(VISTA_KEY)||'')||0;}catch{return 0;}}
  function ladoDe(work){const exec=String(work?.executor||'').toLowerCase(),owner=String(work?.owner||'').toUpperCase();if(/codex/.test(exec)||/^CODEX\b/.test(owner))return 'codex';if(/claude/.test(exec)||/^(?:ATENDIMENTO|LOJA|ASSISTENTE|CORTES|COORDENADOR|COORDENACAO)\b/.test(owner))return 'claude';return '';}
  // So vale como "no ar" o que o estado da work diz que subiu (a fase da Fila sozinha ja marcou "feito" o que ainda andava).
  const NO_AR=/^\s*(?:no[ -]ar|feit[oa]|subiu|entregue|publicad[oa])\b(?![^.;|]*\b(?:deslig\w*|pr[eé]via)\b)/i;
  const SIGLAS=new Set(['rh','buy','ui','api','qa','eth','up','faq','agente']);
  function tituloDe(work){const raw=String(root.PainelLinguagem?.title?.(work.title||'',lang())||work.title||'').replace(/[\r\n]+/g,' ').replace(/[\u2013\u2014]/g,',').trim().slice(0,110);const words=raw.split(/\s+/).map(word=>SIGLAS.has(word.toLowerCase())?word.toUpperCase():word);const text=words.join(' ');return text.charAt(0).toUpperCase()+text.slice(1);}
  function faixa(){
    let host=$('faixa-novidade');if(host)return host;
    host=el('section','faixa-nova');host.id='faixa-novidade';host.hidden=true;host.setAttribute('role','status');host.setAttribute('aria-live','polite');
    const ver=el('button','faixa-nova-ver'),x=el('button','faixa-nova-x');ver.type='button';x.type='button';
    const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
    const path=doc.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M6 6l12 12M18 6L6 18');svg.append(path);x.append(svg);
    host.append(el('span','faixa-nova-k'),el('span','faixa-nova-t'),ver,x);
    ver.addEventListener('click',()=>{const work=novidade?.task;if(work&&typeof root.taskDetails==='function'){try{root.taskDetails(work);return;}catch{}}$('tab-queue')?.click();});
    x.addEventListener('click',()=>{const at=novidade?.at||Date.now();try{localStorage.setItem(VISTA_KEY,new Date(Math.max(at,vistaAte())).toISOString());}catch{}novidade=null;host.hidden=true;});
    const header=doc.querySelector('.shell>header');if(header)header.after(host);else doc.body.prepend(host);
    return host;
  }
  function pintarFaixa(){
    const host=faixa();if(!novidade){host.hidden=true;return;}
    const w=FW[lang()],work=novidade.task,owner=(/^([A-Z]+)/.exec(String(work.owner||'').toUpperCase())||[])[1]||'',reservada=RESERVADAS.includes(owner);
    const titulo=reservada?w.reservada(owner):tituloDe(work);
    host.dataset.lado=ladoDe(work);
    host.querySelector('.faixa-nova-k').textContent=w.k;host.querySelector('.faixa-nova-t').textContent=titulo;
    host.querySelector('.faixa-nova-ver').textContent=w.ver;const x=host.querySelector('.faixa-nova-x');x.title=w.fechar;x.setAttribute('aria-label',w.fechar);
    host.hidden=false;
  }
  // A novidade mais nova das ultimas 12 h que ainda nao foi fechada; o painel tambem chama na hora em que algo entra no ar.
  function novidadeDoEstado(){
    const snapshot=snap();if(!snapshot||novidade?.ao)return;
    const now=Date.now(),ate=vistaAte();let melhor=null;
    for(const work of Array.isArray(snapshot.tasks)?snapshot.tasks:[]){if(work?.phase?.key!=='feito'||!NO_AR.test(String(work.state||'')))continue;const at=Date.parse(work.lastLogAt||'');if(!Number.isFinite(at)||at>now+300000||now-at>JANELA_NOVIDADE||at<=ate)continue;if(!melhor||at>melhor.at)melhor={task: work,at};}
    if(melhor&&(!novidade||novidade.task.id!==melhor.task.id))novidade=melhor;
    if(!melhor&&novidade&&!novidade.ao)novidade=null;
    pintarFaixa();
  }
  root.PainelFaixa=Object.freeze({novidade(work){if(!work||!NO_AR.test(String(work.state||'')))return;const at=Date.now();if(at<=vistaAte())return;novidade={task: work,at,ao:true};pintarFaixa();}});

  // A Equipe le daqui o mesmo numero (agentes), as chaves ativas (ativas, por lado e por cartao) e as linhas do /api/coordenador-pb.
  root.PainelAtividade=Object.freeze({agentes:snapshot=>agentes(snapshot),mistura:snapshot=>mistura(snapshot),ativas:(snapshot,now)=>ativas(snapshot,Number.isFinite(now)?now:Date.now()),chave:(family,id,name)=>family==='codex'&&COORDENADOR_NOME.test(String(name||''))?'codex:coordenador':chaveDe(family,id),sessoes:()=>sessions,ATIVA_MS});
  function renderTudo(){arrumarTopo();renderAgentes();renderSessoes();renderGasto();try{arrumarCredito();}catch{}try{novidadeDoEstado();}catch{}}
  function wrap(){
    if(typeof root.render!=='function'||root.render.inicioClean)return typeof root.render==='function';
    const original=root.render,wrapped=function(...args){try{return original.apply(this,args);}finally{try{renderTudo();}catch(error){console.warn('inicio clean',error);}}};
    wrapped.inicioClean=true;Object.keys(original).forEach(key=>{wrapped[key]=original[key];});root.render=wrapped;return true;
  }
  function start(){
    arrumarTopo();arrumarAbas();wrap();renderTudo();lerSessoes();vigiarPrecisa();
    $('sala-agentes')?.addEventListener('click',()=>$('tab-team')?.click());
    $('inicio-sessoes-mais')?.addEventListener('click',()=>$('tab-team')?.click());
    const actions=doc.querySelector('.header-actions');if(actions)new MutationObserver(()=>arrumarTopo()).observe(actions,{childList:true});
    const status=$('status');if(status)new MutationObserver(()=>arrumarTopo()).observe(status,{childList:true,characterData:true,subtree:true});
    const salaLinhas=$('sala-linhas');if(salaLinhas)new MutationObserver(()=>{try{arrumarCredito();}catch{}}).observe(salaLinhas,{childList:true});
    root.setInterval(()=>{if(!doc.hidden)lerSessoes();},60000);
    doc.addEventListener('visibilitychange',()=>{if(!doc.hidden)lerSessoes();});
    doc.addEventListener('painel:equipe-modelo',()=>{try{renderTudo();}catch{}});
    $('language')?.addEventListener('change',()=>root.setTimeout(renderTudo,0));
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);

// Item305: somente loader dos modulos novos da frente300/301.
(function(){
 if(document.querySelector('script[data-agora300-loader]'))return;
 const css=document.createElement('link');css.rel='stylesheet';css.href='/agora.css';document.head.append(css);
 const cards=document.createElement('script');cards.src='/cards1toque.js';cards.dataset.agora300Loader='1';cards.onload=()=>{const s=document.createElement('script');s.src='/agora.js';document.head.append(s);};document.head.append(cards);
})();
