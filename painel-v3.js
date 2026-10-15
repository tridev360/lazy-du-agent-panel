'use strict';
(function(){
  translations.pt.queue='A fila está andando.';
  translations.en.queue='The queue is moving.';
  translations.es.queue='La cola avanza.';
  $('decision-close').textContent='×';
  const words={
    pt:{waiting:'ESPERANDO VOCÊ',flow:'COMEÇADO × TERMINADO',week:'META DA SEMANA',money:'CUSTO × ENTRADA DO MÊS',none:'Sem atividade registrada',active:'Ao vivo',sleep:'Em descanso',ask:'Sua vez',oldest:'Mais antigo',closeFirst:'fechar antes de abrir',ready:'prontos',stalled:'parados',unmeasured:'Sem medida',missingGoal:'Meta ainda não definida',missingMoney:'Sem medida do mês',recommend:'Recomendado',chat:'Aprovar no chat da sessão',saved:'Escolha salva',error:'Não foi possível salvar. Tente de novo.',credit:'CRÉDITO',work:'TRABALHOS',footer:'Local · ao vivo · Brasília',feed:'Atividade',source:'Fonte',since:'Desde',role:'Papel',model:'Modelo',effort:'Esforço',skills:'Skills',open:'Abrir a sessão'},
    en:{waiting:'WAITING FOR YOU',flow:'STARTED × FINISHED',week:'WEEKLY GOAL',money:'MONTHLY COST × INCOME',none:'No recorded activity',active:'Live',sleep:'Resting',ask:'Your turn',oldest:'Oldest',closeFirst:'finish before starting',ready:'ready',stalled:'stalled',unmeasured:'Reading pending',missingGoal:'Goal not set yet',missingMoney:'No monthly reading',recommend:'Recommended',chat:'Approve in the session chat',saved:'Choice saved',error:'Could not save. Try again.',credit:'CAPACITY',work:'WORK',footer:'Local · live · BRT',feed:'Activity',source:'Source',since:'Since',role:'Role',model:'Model',effort:'Reasoning',skills:'Skills',open:'Open the session'},
    es:{waiting:'ESPERANDO TU DECISIÓN',flow:'INICIADO × TERMINADO',week:'META SEMANAL',money:'COSTO × INGRESOS DEL MES',none:'Sin actividad registrada',active:'En vivo',sleep:'Descansando',ask:'Tu turno',oldest:'Más antiguo',closeFirst:'terminar antes de empezar',ready:'listas',stalled:'paradas',unmeasured:'Sin medida',missingGoal:'Meta aún no definida',missingMoney:'Sin medida del mes',recommend:'Recomendado',chat:'Aprobar en el chat de la sesión',saved:'Elección guardada',error:'No se pudo guardar. Inténtalo de nuevo.',credit:'CAPACIDAD',work:'TRABAJOS',footer:'Local · en vivo · BRT',feed:'Actividad',source:'Fuente',since:'Desde',role:'Rol',model:'Modelo',effort:'Esfuerzo',skills:'Skills',open:'Abrir la sesión'}
  };
  const w=key=>(words[lang]||words.pt)[key], part=()=>Number(document.documentElement.dataset.parte||1);
  let dismissed=new Set(),answeredLocally=new Set(),currentCard=null,cardSignature='',saving=false,feedIds={claude:null,codex:null},stream=null,poll=null,stopped=false;
  function pendingCards(snapshot){if(window.Painel128Local?.enabled())return [];const cards=(snapshot?.ownerDecisionSource&&!exampleMode?[]:snapshot?.cards||[]).filter(card=>(exampleMode||!card.exemplo)&&!answeredLocally.has(card.id));return window.PainelVisao?.oldestCards(cards)||cards;}
  function orderedOptions(card){return(card.opcoes||[]).map((option,index)=>({...option,originalIndex:Number.isInteger(option.originalIndex)?option.originalIndex:index,recommended:option.recommended===true||option.recomendada===true||card.recomendada===index||card.recommended===index})).sort((a,b)=>Number(b.recommended)-Number(a.recommended));}
  function age(minutes){if(!numeric(minutes)||minutes<0)return '?';if(minutes<60)return Math.floor(minutes)+'m';if(minutes<1440)return Math.floor(minutes/60)+'h';return Math.floor(minutes/1440)+'d';}
  function amount(value,currency){if(!numeric(value))return '?';return new Intl.NumberFormat(lang,{style:'currency',currency,maximumFractionDigits:0}).format(value);}
  function feedDetails(line){const human=value=>window.PainelLinguagem.teamText(value,lang);drawer(human(line.agent||w('feed')),[detailBlock(w('feed'),human(line.text)),detailBlock(w('role'),human(line.role)),detailBlock(w('model'),line.model),detailBlock(w('effort'),line.effort),detailBlock(w('skills'),Array.isArray(line.skills)?line.skills.join(', '):line.skills),detailBlock(w('since'),line.since||line.at?brt(line.since||line.at):'?'),detailBlock(w('source'),line.source)]);}
  function renderFeeds(snapshot){for(const who of ['claude','codex']){
    const lines=(snapshot.feeds?.[who]||[]).slice(0,8),host=$(who+'-feed'),old=feedIds[who],ids=new Set(lines.map(line=>line.id));
    const activity=snapshot.activity?.[who];$(who+'-feed-state').textContent=activity?.waiting?w('ask'):activity?.sleeping?w('sleep'):lines.length?w('active'):w('none');
    host.replaceChildren();for(const line of lines){const button=element('button',undefined,'feed-line'+(old&&!old.has(line.id)?' new':'')),human=value=>window.PainelLinguagem.teamText(value,lang);button.append(element('time',line.time||''),element('b',shortTitle(human(line.agent),40)),element('span',shortTitle(human(line.text),75)));button.addEventListener('click',()=>feedDetails(line));host.append(button);}if(!lines.length)host.append(element('p',w('none'),'empty'));feedIds[who]=ids;
  }}
  function renderManagement(snapshot){const management=snapshot.management||{},waiting=management.waiting||{},flow=management.flow||{},goal=management.week,money=management.money;
    $('management').hidden=true;for(const key of ['wait','flow','week','money'])$('manage-'+key+'-title').textContent=w({wait:'waiting',flow:'flow',week:'week',money:'money'}[key]);
    $('manage-wait-value').textContent=numeric(waiting.count)?waiting.count:'?';$('manage-wait-note').textContent=waiting.oldestAt?w('oldest')+' '+age((Date.now()-Date.parse(waiting.oldestAt))/60000):waiting.count===0?t('none'):w('unmeasured');
    $('manage-flow-value').textContent=(numeric(flow.started)?flow.started:'?')+' × '+(numeric(flow.finished)?flow.finished:'?');$('manage-flow').classList.toggle('alert',flow.alert===true);$('manage-flow-note').textContent=flow.alert?w('closeFirst'):[numeric(flow.readyBranches)?flow.readyBranches+' '+w('ready'):'?',numeric(flow.stalledTasks)?flow.stalledTasks+' '+w('stalled'):'?'].join(' · ');
    $('manage-week-value').textContent=goal&&numeric(goal.value)?goal.value+' / '+(numeric(goal.target)?goal.target:'?'):'?';$('manage-week-note').textContent=goal?.name||w('missingGoal');
    const total=money?.totals?.length===1?money.totals[0]:null,income=money?.income;
    $('manage-money-value').classList.add('small-number');$('manage-money-value').textContent=amount(total?.value,total?.currency||'BRL')+' × '+amount(income?.value,income?.currency||'BRL');$('manage-money-note').textContent=money?.totals?.length>1?w('unmeasured'):money?w('source')+': '+(income?.source||w('unmeasured')):w('missingMoney');
  }
  async function choose(card,option){if(window.Painel128Local?.enabled())return;if(saving||card.blocked)return;saving=true;const host=$('decision-options');host.querySelectorAll('button').forEach(button=>button.disabled=true);$('decision-note').textContent='';
    try{const response=await fetch(apiUrl('/api/responder'),{method:'POST',headers:{'Content-Type':'application/json','X-Painel-Nonce':data.nonce},body:JSON.stringify({id:card.id,opcao:option.originalIndex})});const result=await response.json();if(!response.ok)throw Error(result.error||'Choice failed');answeredLocally.add(card.id);$('decision').close();currentCard=null;showToast(w('saved'));await refresh();}
    catch{$('decision-note').textContent=w('error');host.querySelectorAll('button').forEach(button=>button.disabled=false);}finally{saving=false;renderDecision(data);}
  }
  function renderDecision(snapshot,force=false){if(window.Painel128Local?.enabled())return;if(part()<2||!snapshot)return;const cards=pendingCards(snapshot),eligible=cards.filter(card=>force||!dismissed.has(card.id)),dialog=$('decision');
    if(currentCard&&!cards.some(card=>card.id===currentCard)){if(dialog.open)dialog.close();currentCard=null;}
    if(!force&&!dialog.open)return;
    if(($('drawer').open&&!dialog.open)||document.getElementById('painel-command-dialog')?.open)return;if(saving)return;const card=eligible.find(card=>card.id===currentCard)||eligible[0];if(!card)return;
    const nextSignature=JSON.stringify([card,lang,cards.length]);if(currentCard===card.id&&dialog.open&&!force&&cardSignature===nextSignature)return;currentCard=card.id;cardSignature=nextSignature;dialog.style.setProperty('--accent',/^CODEX$/i.test(card.sessao)?'var(--blue)':'var(--orange)');$('decision-session').textContent=card.sessao||'?';$('decision-count').textContent=(cards.indexOf(card)+1)+' / '+cards.length;$('decision-title').textContent=shortTitle(card.pergunta,150);$('decision-note').textContent=card.blocked?w('chat'):card.exemplo?t('demo'):'';
    const host=$('decision-options');host.replaceChildren();if(card.blocked){host.append(sessionLink(card));}else for(const [index,option] of orderedOptions(card).slice(0,4).entries()){
      const button=element('button',undefined,'decision-option'+(option.recommended?' recommended':'')),copy=element('span',undefined,'decision-copy');button.dataset.originalIndex=String(option.originalIndex);button.append(element('span',String(index+1),'decision-key'));copy.append(element('strong',shortTitle(option.label,100)));if(option.descricao)copy.append(element('small',shortTitle(option.descricao,150)));if(option.recommended)copy.append(element('span',w('recommend'),'recommended-label'));button.append(copy);button.addEventListener('click',()=>choose(card,option));host.append(button);
    }if(!dialog.open)dialog.showModal();
  }
  function dismiss(){if(saving)return;if(currentCard)dismissed.add(currentCard);currentCard=null;$('decision').close();}
  function openWaiting(){if(window.Painel128Local?.enabled()){window.Painel128Local.showCards();return;}
    if(!data)return;
    if(pendingCards(data).length){dismissed.clear();renderDecision(data,true);return;}
    const item=window.PainelVisao?.waitingItem(data,[])?.value;if(!item){showNeeds();return;}
    const label=window.PainelVisao.humanLabel(item,lang);
    if(window.PainelDetalhes)window.PainelDetalhes.open({...item,title:label,summary:label,needsOwner:true,nextStep:item.replyWhere?({pt:'Responda no ',en:'Reply in ',es:'Responde en '}[lang])+item.replyWhere:/mesa/i.test(label)?({pt:'Confirme a mesa semanal na conversa do Atendimento.',en:'Confirm the weekly table in the Atendimento conversation.',es:'Confirma la mesa semanal en la conversación de Atención.'}[lang]):({pt:'Abra a conversa da equipe para responder a este pedido.',en:'Open the team conversation to answer this request.',es:'Abre la conversación del equipo para responder.'}[lang])},{lang,drawer,brt});else drawer(label,[detailBlock(t('details'),item.detail)]);
    const respond=element('button',({pt:'Responder na conversa',en:'Reply in the conversation',es:'Responder en la conversación'}[lang]),'drawer-row');respond.addEventListener('click',()=>{$('drawer').close();document.querySelector('.painel-chat-trigger')?.click();});$('drawer-body').append(respond);
    const all=element('button',t('seeAll'),'drawer-row');all.addEventListener('click',showNeeds);$('drawer-body').append(all);
  }
  function renderV3(snapshot){document.getElementById("ia-tips").hidden=!snapshot.feeding&&!snapshot.iaTips&&!snapshot.tips;document.getElementById("project-strip").hidden=!snapshot.projects;if(snapshot.feeding||snapshot.iaTips||snapshot.tips)window.PainelTips?.render(snapshot,document.getElementById("ia-tips"),{lang,apiUrl});renderFeeds(snapshot);renderManagement(snapshot);if(!window.Painel128Local?.enabled())window.PainelOperador?.render(snapshot,{lang,drawer,detailBlock});$('capacity-title').textContent=w('credit');$('work-title').textContent=w('work');$('live-footer').textContent=w('footer');window.PainelComandos?.instance?.updateLanguage();window.PainelVisao?.render(snapshot,{lang,cards:pendingCards(snapshot)});renderDecision(snapshot);window.PainelStatus?.render(snapshot,{lang});window.PainelVisao?.renderHomeSummary?.(snapshot,{lang});}
  function accept(snapshot){if(stopped)return;rewardChanges(snapshot);latestSnapshot=snapshot;data=snapshot;render();window.PainelDev?.observe(snapshot.dev);}
  function beginPolling(){if(!poll)poll=setInterval(()=>{if(!document.hidden)refresh();},5000);}
  function connect(){if(stopped||document.hidden||exampleMode)return;if(!window.EventSource){beginPolling();return;}stream=new EventSource(apiUrl('/api/eventos'));stream.addEventListener('estado',event=>{try{const snapshot=JSON.parse(event.data);if(snapshot.nonce&&Array.isArray(snapshot.pipelineItems)){accept(snapshot);if(poll){clearInterval(poll);poll=null;}}}catch{beginPolling();}});stream.addEventListener('recarregar',event=>{try{window.PainelDev?.schedule(JSON.parse(event.data));}catch{}});stream.onerror=()=>beginPolling();}
  document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('motion-paused',document.hidden);if(document.hidden){stream?.close();stream=null;}else{refresh();connect();}});
  const ageTick=setInterval(()=>{if(data&&!document.hidden&&part()>=2)renderManagement(data);},60000);
  window.addEventListener('pagehide',()=>{stopped=true;stream?.close();clearInterval(poll);clearInterval(ageTick);},{once:true});
  $('decision-close').addEventListener('click',dismiss);$('decision').addEventListener('cancel',event=>{event.preventDefault();dismiss();});$('drawer').addEventListener('close',()=>renderDecision(data));
  document.addEventListener('keydown',event=>{if(!$('decision').open||saving||document.getElementById('painel-command-dialog')?.open||event.target?.closest?.('input,textarea,select,[contenteditable=true]')||event.altKey||event.ctrlKey||event.metaKey||!/^([1-4])$/.test(event.key))return;const button=$('decision-options').querySelectorAll('button')[Number(event.key)-1];if(button){event.preventDefault();button.click();}});
  $('manage-wait').addEventListener('click',()=>{if(window.Painel128Local?.enabled())window.Painel128Local.showCards();else openWaiting();});$('manage-flow').addEventListener('click',()=>drawer(w('flow'),[detailBlock(t('ready'),(data.readyBranches||[]).map(branch=>branch.title).join('\n')),detailBlock(t('stalled'),(data.stalledTasks||[]).map(work=>work.title).join('\n'))]));
  $('manage-week').addEventListener('click',()=>{const goal=data.management?.week;drawer(goal?.name||w('week'),[detailBlock(w('source'),goal?.source),detailBlock(w('since'),goal?.updated?brt(goal.updated):'?')]);});$('manage-money').addEventListener('click',()=>{const money=data.management?.money;drawer(w('money'),[detailBlock(w('money'),(money?.costs||[]).map(cost=>cost.item+' · '+amount(cost.value,cost.currency)+' · '+cost.source).join('\n')),detailBlock(w('source'),money?.income?.source),detailBlock(w('since'),money?.updated?brt(money.updated):'?')]);});
  if(part()>=3&&window.PainelComandos){$('command-trigger').hidden=false;window.PainelComandos.init({getData:()=>data,apiUrl,lang:()=>lang,showToast});document.addEventListener('painel-command-saved',refresh);document.addEventListener('painel-feed-saved',refresh);window.PainelLofi?.init({getData:()=>data,lang:()=>lang});document.getElementById('painel-command-dialog')?.addEventListener('close',()=>renderDecision(data));}
  window.PainelV3={render:renderV3,orderedOptions,age,redraw:render,openWaiting,openDue(item){if(item.kind==='launch')launchDetails(item.value);else if(item.kind==='task')taskDetails(item.value);else drawer(t('withDeadline'),[detailBlock(t('details'),item.value.text),element('p',brt(item.at))]);}};queueMicrotask(()=>{if(data&&!stopped)render();});connect();if(exampleMode)beginPolling();
})();

/* PAINEL RODADA 2 */
window.PainelBuild={"version":"painel-fria-20261007-r1","hash":"4090a488","at":"2026-10-07T05:03:15.6953340-03:00"};
/* linguagem.js */
'use strict';
(function(root){
 const choose=(lang,pt,en,es)=>lang==='pt'?pt:lang==='es'?es:en;
 const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const rules=[/\bsession token pace\b/i,/\bpace\b/i,/\bburn rate\b/i,/\b(?:exec|spawn_agent|followup_task|wait_agent|send_message|interrupt_agent|list_agents|js|sleep|cli|workspace|effort)\b/i,/\b(?:not shared by cli|not measured|nao medido|observed tokens|recent files only|session paused; ready to resume)\b/i,/\b(?:gpt-[\w.-]+|claude-(?:opus|sonnet|haiku)[\w.-]*)\b/i,/\bsessao\s+\d{1,2}:\d{2}\b/i,/\b[\w-]+\.(?:md|json|cjs|mjs|tsx?|jsx?|bat)\b/i];
 function violations(value){const source=normalized(value);return rules.filter(rule=>rule.test(source)).map(rule=>String(rule)).concat(/(^|\s)\?(?=\s|$)/.test(source)?['interrogação solta']:[]);}
 function model(value){const name=String(value||'');return /claude/i.test(name)?'Claude':/codex|gpt/i.test(name)?'Codex':null;}
 function effort(value,lang='pt'){const key=normalized(value);return ({low:choose(lang,'leve','light','leve'),medium:choose(lang,'médio','medium','medio'),high:choose(lang,'alto','high','alto'),xhigh:choose(lang,'muito alto','very high','muy alto'),max:choose(lang,'máximo','maximum','máximo'),ultra:choose(lang,'máximo','maximum','máximo')})[key]||null;}
 function sourceLabel(value,lang='pt'){
  const name=String(value||'');if(/uso-claude/i.test(name))return choose(lang,'Crédito do Claude','Claude credit','Crédito de Claude');
  if(/codex\.md|feed-codex/i.test(name))return choose(lang,'Entregas do Codex','Codex deliveries','Entregas de Codex');
  if(/economia/i.test(name))return choose(lang,'Resumo da economia','Economy summary','Resumen de economía');
  if(/boss/i.test(name))return choose(lang,'Resumo dos chefes do jogo','Game bosses summary','Resumen de jefes del juego');
  if(/colecao/i.test(name))return choose(lang,'Resumo do jogo','Game summary','Resumen del juego');
  if(/atendimento/i.test(name))return choose(lang,'Resumo do atendimento','Atendimento summary','Resumen de atención');
  if(/assistente/i.test(name))return choose(lang,'Resumo dos robôs','Assistentes summary','Resumen de robots');
  if(/loja/i.test(name))return choose(lang,'Resumo dos eventos','Events summary','Resumen de eventos');
  if(/cortes/i.test(name))return choose(lang,'Resumo do conteúdo','Content summary','Resumen de contenido');
  return choose(lang,'Registro do projeto','Project record','Registro del proyecto');
 }
 function text(value,lang='pt'){
  let result=String(value??'').replace(/\bA-D\b/g,choose(lang,'os quatro casos combinados','the four agreed cases','los cuatro casos acordados')).replace(/\bASSISTENTE\.bat\b/gi,choose(lang,'Iniciador dos robôs','Assistente launcher','Inicio de robots')).replace(/\basks\b/gi,choose(lang,'pedidos','requests','pedidos')).replace(/\bPAINEL QA\b/gi,choose(lang,'Revisão do painel','Panel review','Revisión del panel')).replace(/\bTRACKER-LOTE\b/gi,choose(lang,'Atualização das raridades','Rarity update','Actualización de rarezas')).replace(/\bsobe sem X\b/gi,choose(lang,'Subir sem uma parte','Publish without one part','Publicar sin una parte')).replace(/\btira 1 parte do lote\b/gi,choose(lang,'Indique no chat qual parte retirar das atualizações','Say in the chat which part to remove','Indica en el chat qué parte retirar')).replace(/travas r\d+ com os (\d+) achados do dinheiro/gi,(_,n)=>choose(lang,'Proteção financeira: '+n+' problemas identificados','Financial protection: '+n+' issues found','Protección financiera: '+n+' problemas identificados')).replace(/ele explodiu com dado tecnico no painel \([^)]*\); a causa foi o COORDENADOR empilhar pedidos; regra nova: tirar antes de por/gi,choose(lang,'O painel mostrava informação técnica demais. A prioridade é simplificar a leitura','The panel showed too much technical information. Reading must be simplified','El panel mostraba demasiada información técnica. La prioridad es simplificar la lectura')).replace(/DECISIONS [\d:x]+ \(prioridade 1 painel, 2 Terminal, 3 assistente, 4 jogo\), [\d:x]+ \(WATCHING vira FOLLOW WALLETS\); lancamentos com as horas da ATENDIMENTO/gi,choose(lang,'Prioridade: painel, Terminal, robôs e jogo. O botão de carteiras passa a se chamar FOLLOW WALLETS. Lançamentos usam os horários informados pela equipe do atendimento','Priority: panel, Terminal, assistentes and game. The wallet button is renamed FOLLOW WALLETS. Launches use times provided by the atendimento team','Prioridad: panel, Terminal, robots y juego. El botón de carteras se llama FOLLOW WALLETS. Los lanzamientos usan horarios del equipo de atención')).replace(/~(\d{1,2}:\d{2}) card do lote no chat da ATENDIMENTO \([^)]*\); up ate (\d{1,2}:\d{2})/gi,(_,review,release)=>choose(lang,'Aprovar as atualizações de quarta na conversa do atendimento, por volta de '+review+'. Publicação prevista até '+release,'Approve Wednesday updates in the atendimento conversation, around '+review+'. Publication expected by '+release,'Aprobar las actualizaciones del miércoles en la conversación de atención, alrededor de '+review+'. Publicación prevista hasta '+release)).replace(/paineis local \([^)]*\) e publico em rodada de SIMPLIFICAR \([^)]*\)/gi,choose(lang,'Painel local em uso; os dois painéis estão sendo simplificados para mostrar trabalho, entrega, decisões e gastos','Local panel in use; both panels are being simplified to show work, delivery, decisions and spending','Panel local en uso; ambos paneles se están simplificando para mostrar trabajo, entrega, decisiones y gastos')).replace(/\s+e rodada de coisa b[aá]sica/gi,'').replace(/\s*\(\s*\)/g,'').replace(/\bteste do dono\b/gi,choose(lang,'conferência de facilidade de uso','usability check','revisión de facilidad de uso')).replace(/\bdiff\b/gi,choose(lang,'alterações','changes','cambios')).replace(/\bcomm?itar\b/gi,choose(lang,'salvar as alterações','save changes','guardar los cambios')).replace(/\bdepois do port[aã]o\b/gi,choose(lang,'depois da aprovação','after approval','después de la aprobación')).replace(/\brodada (?:de )?SIMPLIFICAR\b/gi,choose(lang,'consertos do painel','panel fixes','correcciones del panel')).replace(/\bloop v5\b/gi,choose(lang,'versão do jogo','game version','versión del juego')).replace(/\bcommitado\b/gi,choose(lang,'com alterações salvas','with changes saved','con cambios guardados')).replace(/\bna painel local\b/g,'no painel local').replace(/\bo primeira publicação autorizada\b/g,'a primeira publicação autorizada').replace(/\b3250\b/g,choose(lang,'painel local','local panel','panel local')).replace(/~?(\d{1,2}):\d{1,2}x\b/g,(_,hour)=>choose(lang,'por volta das '+hour+'h','around '+hour+'h','alrededor de las '+hour+'h')).replace(/1o (?:up|uso) (?:da |por )?pré-aprovação/gi,choose(lang,'primeira publicação autorizada','first approved publication','primera publicación autorizada')).replace(/\?/g,'').replace(/\bDECISIONS(?:\s+[\d:x]+)?\b/gi,choose(lang,'decisões','decisions','decisiones')).replace(/\bmesa-ar\d+\b/gi,choose(lang,'mesa semanal','weekly table','mesa semanal')).replace(/\bxhigh\b/gi,choose(lang,'muito alto','very high','muy alto')).replace(/\bAgentes\b/g,'Agente').replace(/\bfull report\b/gi,choose(lang,'relatório do acervo','collection report','informe del tesoro')).replace(/\br[4-8]\b/g,choose(lang,'versão do painel','panel version','versión del panel')).replace(/[\u2013\u2014]/g,',');
  result=result.replace(/\b(?:gpt-[\w.-]+|claude-(?:opus|sonnet|haiku)[\w.-]*)\b/gi,name=>model(name)||choose(lang,'IA','AI','IA'));
  result=result.replace(/\b(?:session token pace|burn rate|pace)\b/gi,choose(lang,'ritmo de gasto','spending rhythm','ritmo de gasto'));
  const tool={exec:'terminal',spawn_agent:choose(lang,'chamou ajudante','called a helper','llamó ayudante'),followup_task:choose(lang,'passou tarefa','assigned work','asignó trabajo'),wait_agent:choose(lang,'esperou ajudante','waited for a helper','esperó ayudante'),send_message:choose(lang,'alinhou a equipe','coordinated the team','coordinó el equipo'),interrupt_agent:choose(lang,'pausou ajudante','paused a helper','pausó ayudante'),list_agents:choose(lang,'conferiu a equipe','checked the team','revisó el equipo'),js:choose(lang,'navegador','browser','navegador'),sleep:choose(lang,'esperou','waited','esperó')};
  result=result.replace(/\b(exec|spawn_agent|followup_task|wait_agent|send_message|interrupt_agent|list_agents|js|sleep)\b/gi,word=>tool[word.toLowerCase()]);
  result=result.replace(/\b(?:Not shared by CLI|Not measured|N[aã]o medido)\b/gi,choose(lang,'Leitura ainda indisponível','Reading not available yet','Lectura aún no disponible'));
  result=result.replace(/\bObserved tokens\b/gi,'tokens').replace(/\bRecent files only\. Counts may be partial\b/gi,choose(lang,'Contagem parcial','Partial count','Conteo parcial'));
  result=result.replace(/\bCLI\b/gi,choose(lang,'ferramenta local','local tool','herramienta local')).replace(/\beffort\b/gi,choose(lang,'esforço','reasoning','esfuerzo'));
  result=result.replace(/\bWorkspace\s+(?:[A-Z][\w-]*\s*){1,3}/g,choose(lang,'Projeto','Project','Proyecto')).replace(/\bworkspace\b/gi,choose(lang,'projeto','project','proyecto'));
  result=result.replace(/\bSESS[AÃ]O\s+\d{1,2}:\d{2}\b/gi,choose(lang,'Trabalho da equipe','Team work','Trabajo del equipo'));
  result=result.replace(/(?:[A-Z]:[\\/]|(?:estado|tasks|casa)[\\/])[^\s,;)]+/gi,choose(lang,'registro do projeto','project record','registro del proyecto'));
  result=result.replace(/\b[\w-]+\.(?:md|json|cjs|mjs|tsx?|jsx?|bat)\b/gi,file=>sourceLabel(file,lang));
  result=result.replace(/\bSession paused; ready to resume\b/gi,choose(lang,'Em descanso','Resting','En descanso'));
  if(result.trim()==='?')return choose(lang,'Leitura pendente','Reading pending','Lectura pendiente');
  return result.replace(/revisar o alterações/gi,'revisar as alterações').replace(/(^|\s)\?(?=\s|$)/g,'').replace(/\s{2,}/g,' ').trim();
 }

 function conversation(value,lang='pt'){const names={COORDENADOR:choose(lang,'Coordenação da casa','House coordination','Coordinación de la casa'),COORDENACAO:choose(lang,'Coordenação da casa','House coordination','Coordinación de la casa'),ATENDIMENTO:choose(lang,'Atendimento','Support','Atención'),ASSISTENTE:choose(lang,'Robôs automáticos','Automated assistentes','Robots automáticos'),LOJA:choose(lang,'Eventos e recompensas','Events and rewards','Eventos y recompensas'),CORTES:choose(lang,'Cortes e posts','Content and posts','Contenido y publicaciones'),CODEX:choose(lang,'Desenvolvimento','Development','Desarrollo')};return names[String(value||'').toUpperCase()]||null;}
 function teamText(value,lang='pt'){return text(String(value||'').replace(/\b(?:COORDENADOR|COORDENACAO|ATENDIMENTO|ASSISTENTE|LOJA|CORTES|CODEX)\b/g,name=>conversation(name,lang)||name).replace(/\bVIGIA\b/g,choose(lang,'monitor de lançamentos','launch monitor','monitor de lanzamientos')).replace(/\bAGENTE-1\b/g,choose(lang,'painel dos robôs','assistente panel','panel de robots')),lang);}
 function title(value,lang='pt'){const aliases={};return text(aliases[value]||Object.entries(aliases).find(([key])=>normalized(key)===normalized(value))?.[1]||value,lang).replace(/\b20\d{2}-\d{2}-\d{2}-[\w-]+\b/g,choose(lang,'Trabalho do projeto','Project work','Trabajo del proyecto'));}
 function number(value,lang='pt'){return Number.isFinite(value)?new Intl.NumberFormat(lang,{notation:'compact',maximumFractionDigits:1}).format(value):null;}
 function relative(value,lang='pt',now=Date.now()){const at=Date.parse(value);if(!Number.isFinite(at))return null;const min=Math.max(0,Math.floor((now-at)/60000));return min<1?choose(lang,'agora','now','ahora'):min<60?choose(lang,'há '+min+' min',min+' min ago','hace '+min+' min'):choose(lang,'há '+Math.floor(min/60)+' h',Math.floor(min/60)+' h ago','hace '+Math.floor(min/60)+' h');}
 const api={rules,violations,text,teamText,conversation,title,model,effort,sourceLabel,number,relative};if(typeof module==='object'&&module.exports)module.exports=api;else root.PainelLinguagem=api;
})(typeof window==='object'?window:globalThis);

/* previsao.cjs */
(function(){const module={exports:{}};
'use strict';
// Forecasts describe their evidence and assumptions; they are never deadlines.
const MINUTE=60000,caches=new Map();
const at=value=>Number.isFinite(Date.parse(value))?Date.parse(value):null;
const median=values=>{const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);return sorted.length?sorted[Math.floor(sorted.length/2)]:null;};
const toolCount=agent=>(agent.tools||[]).reduce((sum,tool)=>sum+(Number.isFinite(tool.count)?tool.count:0),0);
function samplesOf(agents){return agents.filter(agent=>agent.state==='done').map(agent=>({role:agent.roleKey||agent.identity?.roleKey,duration:at(agent.lastAt)-at(agent.startedAt)})).filter(item=>item.duration>=2*MINUTE&&item.duration<=120*MINUTE);}
function forecast(agent,now=new Date(),samples=[],cache=new Map()){
 let current=agent.delivery||{};const stamp=now.getTime();
 // A previous delivery belongs to the previous task, not to resumed work.
 if(current.completedAt&&['working','walking'].includes(agent.state)&&at(agent.lastAt)>at(current.completedAt))current={...current,lastCompletedAt:current.completedAt,completedAt:null,estimateReason:null};
 if(current.completedAt)return {...current,estimated:false};
 if(agent.state==='done'&&at(agent.lastAt)!==null)return {...current,completedAt:agent.lastAt,etaAt:null,estimated:false,estimateReason:'completed',timingSource:'last-completed-step'};
 const expiredDeclared=at(current.etaAt)!==null&&at(current.etaAt)<stamp;
 if(at(current.etaAt)!==null&&!expiredDeclared)return {...current,estimated:current.estimated??!['feed','deadline','operator-summary'].includes(current.etaSource),estimateBasis:current.estimateBasis||{method:current.etaSource==='feed'?'declared':'recorded-pace',source:current.etaSource||'task',readAt:current.etaUpdatedAt||agent.lastAt||now.toISOString()}};
 if(at(current.deadlineAt)!==null&&at(current.deadlineAt)>=stamp&&!expiredDeclared)return {...current,etaAt:current.deadlineAt,etaSource:'deadline',estimated:false,estimateBasis:{method:'declared-deadline',source:current.deadlineSource||'task',readAt:agent.lastAt||now.toISOString()}};
 const key=agent.id+'|'+(agent.currentItemId||agent.deliveryItemId||agent.roleKey||''),steps=toolCount(agent),previous=cache.get(key),lastAt=at(agent.lastAt),startAt=at(agent.startedAt);
 // No clock-driven sliding ETA. Only new activity can revise the prediction.
 if(previous&&at(previous.forecast.etaAt)>=stamp&&previous.steps===steps&&previous.lastAt===agent.lastAt)return {...current,...previous.forecast};
 const role=agent.roleKey||agent.identity?.roleKey,similar=samples.filter(item=>item.role===role),typical=median(similar.map(item=>item.duration));
 let remaining,method,basis;
 if(typical!==null){remaining=Math.max(3*MINUTE,typical-Math.max(0,stamp-(startAt??stamp)));method='similar-tasks';basis={sampleCount:similar.length,typicalMinutes:Math.round(typical/MINUTE),source:'completed-agent-tasks'};}
 else{
  const elapsed=startAt!==null&&lastAt!==null?Math.max(MINUTE,lastAt-startAt):null;
  const period=elapsed!==null&&steps>0?Math.max(30000,Math.min(5*MINUTE,elapsed/steps)):5*MINUTE;
  const remainingStages=['qa','reviewer','copy-reviewer'].includes(role)?1:3;
  remaining=Math.max(3*MINUTE,period*remainingStages);
  method=elapsed!==null&&steps>0?'steps-per-minute':'initial-window';
  basis={steps,elapsedMinutes:elapsed!==null?Math.round(elapsed/MINUTE):null,remainingStages,assumption:true,source:steps?'tool-count-and-session-time':'last-activity-and-initial-window'};
 }
 const anchor=Math.max(stamp,lastAt??stamp),etaAt=new Date(Math.ceil((anchor+remaining)/(5*MINUTE))*5*MINUTE).toISOString();
 const hardLate=at(current.deadlineAt)!==null&&at(current.deadlineAt)<stamp;
 const value={etaAt,etaSource:'calculated',estimated:true,state:hardLate?'late':'in-progress',minutes:hardLate?Math.ceil((stamp-at(current.deadlineAt))/MINUTE):Math.max(0,Math.ceil((at(etaAt)-stamp)/MINUTE)),estimateReason:'pace-model',etaUpdatedAt:now.toISOString(),estimateBasis:{method,...basis,readAt:agent.lastAt||now.toISOString()},previousEtaAt:previous?.forecast?.etaAt|| (expiredDeclared?current.etaAt:null),revisionReason:previous?'new-recorded-activity':expiredDeclared?'declared-estimate-expired':null};
 cache.set(key,{steps,lastAt:agent.lastAt,forecast:value});return {...current,...value};
}
function applyForecasts(root,team,now=new Date()){
 let cache=caches.get(root);if(!cache){cache=new Map();caches.set(root,cache);}const samples=samplesOf(team.agents||[]);
 for(const agent of team.agents||[])agent.delivery=forecast(agent,now,samples,cache);
 for(const group of team.groups||[]){const live=group.agents.filter(agent=>!agent.delivery?.completedAt),leader=live.find(agent=>!agent.parentId)||live[0]||group.agents[0];group.delivery=leader?.delivery||null;}
 if(cache.size>2000){const keep=new Set((team.agents||[]).map(agent=>agent.id));for(const key of cache.keys())if(![...keep].some(id=>key.startsWith(id+'|')))cache.delete(key);}
 return team;
}
module.exports={forecast,applyForecasts,samplesOf,toolCount};

window.PainelPrevisao=module.exports;})();
/* clareza.js */
'use strict';
(function(root){
 const human=typeof module==='object'&&module.exports?require('./linguagem.js'):root.PainelLinguagem;
 const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),words=(pt,en,es)=>({pt,en,es});
 const blocked=v=>/PRIVADO|_SECRETS|backup-privado|\b(?:seed|secret|senha|api.?key)\b|0x[a-f\d]{40}|https?:\/\//i.test(v||'');
 const missing=words('Entrega ainda não descrita no registro','Deliverable not yet described in the record','Entrega aún no descrita en el registro');
 function goalOf(value){
  if(blocked(value))return null;const text=norm(value).slice(0,600);
  const rules=[
   [/entregas,?\s*decisoes e nomes|r10.*(?:corrige|painel|nomes|clareza)/,words('Painel: entregas, decisões e nomes','Panel: deliverables, decisions and names','Panel: entregas, decisiones y nombres')],
   [/painel publico.*(?:guia|primeira visita|primeira vez)/,words('Guia de primeira visita ao painel público','Public panel first visit guide','Guía de primera visita al panel público')],
   [/painel publico.*(?:revis|teste)|revis.*painel publico/,words('Revisão final do painel público','Final public panel review','Revisión final del panel público')],
   [/(?:travas|protecao).*pront.*(?:revisor|pendente)/,words('Proteção automática para revisão','Automatic protection ready for review','Protección automática para revisión')],
   [/(?:travas|protecao).*(?:test|revis)|r8 testes\s*\d+/,words('Proteção automática testada','Tested automatic protection','Protección automática probada')],
   [/(?:tracker|indice de raridade).*(?:revis|teste|confer)|(?:revis|teste|confer).*(?:tracker|indice de raridade)/,words('Revisão do índice de raridade','Rarity index review','Revisión del índice de rareza')],
   [/conserto visual.*agente-1|agente-1.*(?:luz|sobrepu|visual)/,words('Conserto visual do painel dos robôs','Assistente panel visual fix','Corrección visual del panel de robots')],
   [/evento.*(?:contar 2 vezes|contagem duplicada)|mesmo post.*2 vezes/,words('Evento sem contagem duplicada','Event without duplicate counting','Evento sin conteo duplicado')],
   [/terminal.*(?:assistente[oõ]es|estados).*confer|confer.*terminal.*(?:assistente[oõ]es|estados)/,words('Botões e estados do Terminal conferidos','Verified Terminal buttons and states','Botones y estados del Terminal verificados')]
  ];return rules.find(([rule])=>rule.test(text))?.[1]||null;
 }
 function actorMatches(agent,line){
  const name=norm(line.agent).replace(/[^a-z0-9]+/g,' ').trim(),actor=norm(agent.deliveryActor).replace(/[^a-z0-9]+/g,' ').trim();
  if(actor&&name===actor)return true;
  if(actor==='codex painel')return /^(?:agente dev (?:do )?painel local|codex painel)$/.test(name);
  if(/codex painel publico/.test(actor))return /agente dev (?:do )?painel publico/.test(name);
  if(agent.identity?.focusKey==='security'&&/travas|protecao/.test(norm(agent.conversationName)))return /agente dev das travas/.test(name);
  return false;
 }
 function clockFrom(value,at){
  const text=norm(value);if(/amanha|quinta|\bqui\b|sexta|\bsex\b|20:\dx/.test(text))return null;
  const clock=/(?:\beta\s*~?\s*|(?:entrega|card|sobe|subida)[^;\n]{0,65}?~?\s*)([0-2]\d:[0-5]\d)/i.exec(value||'')?.[1];
  const stamp=Date.parse(at);if(!clock||!Number.isFinite(stamp))return null;
  return new Date(stamp-3*3600000).toISOString().slice(0,10)+'T'+clock+':00-03:00';
 }
 function explicitTask(agent,data){
  const id=agent.taskId||agent.currentItemId,work=(data.tasks||[]).find(t=>id&&t.id===id);const value=work?.summary||work?.resumo||work?.title||agent.currentItemTitle;
  if(!value||blocked(value)||/^(?:(?:tarefa atual|frente de trabalho|novo item|novo pedido|painel)$|trabalha nesta\b|coordena\b|organiza\b|acompanha\b)/i.test(value.trim()))return null;
  const labels=goalOf(value)||words(human.title(value,'pt'),human.title(value,'en'),human.title(value,'es'));
  return {labels,source:work?'task:'+work.id:'task-metadata',sourceAt:agent.currentItemAt||agent.lastAt,etaAt:null,estimated:null};
 }
 function deliveryOf(agent,data,parent){
  const direct=explicitTask(agent,data);if(direct)return direct;
  const at=Date.parse(data.updated),lines=Object.values(data.feeds||{}).flat().filter(line=>actorMatches(agent,line)&&Date.parse(line.at)<=at&&at-Date.parse(line.at)<30*60000).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
  // A newer unrecognized work must not resurrect an older deliverable.
  if(lines.length){const line=lines[0],labels=goalOf(line.agent+': '+line.text);if(labels)return {labels,source:'public-feed',sourceAt:line.at,etaAt:clockFrom(line.text,line.at),estimated:/estimad|ETA\s*~/i.test(line.text)};}
  if(parent?.currentDelivery?.known)return {...parent.currentDelivery,source:'parent-delivery',parentId:parent.id};
  return {labels:missing,source:'missing-deliverable',known:false,sourceAt:null,etaAt:null,estimated:null};
 }
 function sessionDelivery(session,data){
  const fields=session.summary?.fields||{},value=fields.proximo||fields.precisa,visual=/AGENTE-1/i.test(value||'')||session.id==='ATENDIMENTO'&&/card do up curto/i.test(value||'')&&/conserto visual do AGENTE-1/i.test(fields.fez||''),linked=visual?(data.needsAll||[]).find(item=>item.source==='tasks/ESCOLHAS.md'&&/conserto visual do AGENTE-1/i.test(item.detail||'')):null,labels=goalOf(value)||goalOf(linked?.detail);
  if(labels)return {labels,source:'operator-summary',sourceAt:session.updatedAt,etaAt:clockFrom(value,data.updated),estimated:/~|por volta/.test(value)};
  // A completed summary is history, not evidence of another current delivery.
  return {labels:missing,source:'missing-deliverable',known:false,etaAt:null,estimated:null};
 }
 function decorate(agent,proof){
  const known=proof.known!==false,delivery=known?{...agent.delivery,deliverableLabels:proof.labels,deliverableSource:proof.source,...(proof.etaAt?{etaAt:proof.etaAt,estimated:proof.estimated===true,etaSource:proof.source==='public-feed'?'feed':proof.source,etaUpdatedAt:proof.sourceAt,estimateBasis:null,previousEtaAt:null,completedAt:null}:{})}:{...agent.delivery,etaAt:null,deadlineAt:null,completedAt:null};
  if(known&&delivery.completedAt&&Date.parse(delivery.completedAt)<Date.parse(proof.sourceAt))delivery.completedAt=null;
  return {...agent,currentDelivery:{...proof,known},delivery};
 }
 function enrich(data){
  if(!data?.equipe)return data;const byId=new Map(),pending=[...(data.equipe.agents||[])];
  for(let depth=0;pending.length&&depth<8;depth++)for(let i=pending.length-1;i>=0;i--){const agent=pending[i];if(agent.parentId&&pending.some(a=>a.id===agent.parentId))continue;const proof=deliveryOf(agent,data,byId.get(agent.parentId));byId.set(agent.id,decorate(agent,proof));pending.splice(i,1);}
  for(const agent of pending)byId.set(agent.id,decorate(agent,{labels:missing,source:'missing-deliverable',known:false}));
  const agents=(data.equipe.agents||[]).map(a=>byId.get(a.id)),sessions=(data.operator?.sessions||[]).map(s=>({...s,node:s.node?decorate(s.node,sessionDelivery(s,data)):s.node}));
  const groups=(data.equipe.groups||[]).map(g=>({...g,agents:(g.agents||[]).map(a=>byId.get(a.id)||a)}));
  return {...data,homeSource:data.homeSource||data,equipe:{...data.equipe,agents,groups},operator:data.operator?{...data.operator,sessions}:data.operator};
 }
 function approvalScope(item,lang='pt'){
  if(item.source!=='tasks/ESCOLHAS.md'||item.section!=='scheduled'||!/^needs:\d+$/.test(item.id||''))return null;
  const source=String(item.detail||''),match=/card do lote[^(\n]*\(([^)]*)\)/i.exec(source);if(!match||blocked(match[1]))return null;
  const aliases=[];
  const parts=match[1].split(/\s*,\s*/).map(value=>({label:aliases.find(([regex])=>regex.test(value))?.[1]?.[lang]||human.teamText(value,lang)}));
  const planned=/~([0-2]\d:[0-5]\d)/.exec(source)?.[1]||null,excluded=/Termos ficam para\s+([^\n.]+)/i.exec(source)?.[1]||null;
  const defer=words('Adia as partes acima e deixa a publicação de hoje'+(planned?', prevista para ~'+planned:'')+'. Solicita publicação amanhã; novo horário ainda não combinado.','Defers the parts above and skips today’s publication'+(planned?', planned for ~'+planned:'')+'. Requests publication tomorrow; a new time has not been agreed.','Aplaza las partes anteriores y deja la publicación de hoy'+(planned?', prevista para ~'+planned:'')+'. Solicita publicar mañana; no se ha acordado una nueva hora.');
  return {parts,planned,excluded,source:'tasks/ESCOLHAS.md',defer:defer[lang]||defer.pt};
 }
 const api={goalOf,actorMatches,clockFrom,deliveryOf,sessionDelivery,enrich,approvalScope};if(typeof module==='object'&&module.exports)module.exports=api;else root.PainelClareza=api;
})(typeof window==='object'?window:globalThis);

/* equipe.js */
(function(scope){
  'use strict';
  const SLEEP_AFTER=10*60*1000;
  const homeForecast=typeof module==='object'&&module.exports?require('./previsao.cjs'):scope.PainelPrevisao,homeForecastCache=new Map();
  const COPY={
    en:{team:'Team live',agents:'agents',active:'working',tokens:'tokens in these conversations',consumption:'Consumption',water:'estimated water',cups:'cups of 250 ml',formula:'Playful estimate, not a measurement: (new input + output + 10% of cached input) ÷ 1,500 × 0.3 ml. Each cup is 250 ml.',working:'Working',walking:'Moving to work',waiting:'Waiting',sleeping:'Resting',done:'Done',unknown:'Unread',project:'Project',conversation:'Conversation',none:'No agent linked to this project',more:'more',model:'Model',effort:'Reasoning',skills:'Skills',tools:'Tools',since:'Since',now:'Now',details:'Agent details',progress:'Recorded progress',estimate:'Estimated delivery',deliveries:'deliveries',unmeasured:'Reading pending',noSkills:'No skill recorded',noTools:'No tool recorded',idle:'idle',minutes:'min',summary:'Progress',guardian:'Commands reviewed',week:'Codex week used'},
    pt:{team:'Equipe ao vivo',agents:'agentes',active:'trabalhando',tokens:'tokens nestas conversas',consumption:'Consumo',water:'água estimada',cups:'copos de 250 ml',formula:'Estimativa de brincadeira, sem medição: (entrada nova + saída + 10% da entrada em cache) ÷ 1.500 × 0,3 ml. Cada copo vale 250 ml.',working:'Trabalhando',walking:'Indo trabalhar',waiting:'Esperando',sleeping:'Descansando',done:'Terminou',unknown:'Não lido',project:'Projeto',conversation:'Conversa',none:'Nenhum agente ligado a este projeto',more:'mais',model:'Modelo',effort:'Esforço',skills:'Skills',tools:'Ferramentas',since:'Desde',now:'Agora',details:'Detalhes do agente',progress:'Progresso registrado',estimate:'Estimativa pelo ritmo',deliveries:'entregas',unmeasured:'Leitura pendente',noSkills:'Nenhuma skill registrada',noTools:'Nenhuma ferramenta registrada',idle:'parado',minutes:'min',summary:'Progresso',guardian:'Comandos conferidos',week:'Semana do Codex usada'},
    es:{team:'Equipo en vivo',agents:'agentes',active:'trabajando',tokens:'tokens en estas conversaciones',consumption:'Consumo',water:'agua estimada',cups:'vasos de 250 ml',formula:'Estimación informal, sin medición: (entrada nueva + salida + 10% de la entrada en caché) ÷ 1.500 × 0,3 ml. Cada vaso equivale a 250 ml.',working:'Trabajando',walking:'Yendo a trabajar',waiting:'Esperando',sleeping:'Descansando',done:'Terminado',unknown:'Sin leer',project:'Proyecto',conversation:'Conversación',none:'Ningún agente vinculado al proyecto',more:'más',model:'Modelo',effort:'Esfuerzo',skills:'Skills',tools:'Herramientas',since:'Desde',now:'Ahora',details:'Detalles del agente',progress:'Progreso registrado',estimate:'Estimación por ritmo',deliveries:'entregas',unmeasured:'Lectura pendiente',noSkills:'Ninguna skill registrada',noTools:'Ninguna herramienta registrada',idle:'parado',minutes:'min',summary:'Progreso',guardian:'Comandos revisados',week:'Semana de Codex usada'}
  };
  const finite=value=>Number.isFinite(value)&&value>=0;
  const date=value=>{const n=Date.parse(value);return Number.isFinite(n)?n:null;};
  function short(value,count=3){return String(value||'').trim().split(/\s+/).slice(0,count).join(' ');}
  function compact(value,lang='en'){return finite(value)?new Intl.NumberFormat(lang,{notation:'compact',maximumFractionDigits:1}).format(value):'?';}
  function agentCount(count,words){return count+' '+(count===1?words.agents.slice(0,-1):words.agents);}
  const TOOL_COPY={exec:['Terminal','Terminal','Terminal'],exec_command:['Terminal','Terminal','Terminal'],js:['Navegador','Browser','Navegador'],apply_patch:['Edita arquivos','Edits files','Edita archivos'],view_image:['Olha imagens','Views images','Ve imágenes'],spawn_agent:['Chama ajudantes','Calls agents','Llama agentes'],send_message:['Conversa com equipe','Talks to team','Habla con equipo'],followup_task:['Passa tarefa','Assigns task','Asigna tarea'],list_agents:['Vê a equipe','Views team','Ve equipo'],wait_agent:['Espera ajudante','Waits for agent','Espera agente'],wait:['Espera','Waits','Espera'],sleep:['Espera','Waits','Espera'],web__run:['Pesquisa','Researches','Investiga'],Read:['Lê arquivos','Reads files','Lee archivos'],Edit:['Edita arquivos','Edits files','Edita archivos'],Write:['Escreve arquivos','Writes files','Escribe archivos'],Bash:['Terminal','Terminal','Terminal'],Grep:['Busca arquivos','Searches files','Busca archivos'],Glob:['Busca arquivos','Searches files','Busca archivos'],Task:['Chama ajudantes','Calls agents','Llama agentes'],Agent:['Chama ajudantes','Calls agents','Llama agentes']};
  function localizedTool(tool,lang){const key=tool.name||'',known=TOOL_COPY[key]||TOOL_COPY[key.split('__').at(-1)],web={WebFetch:['Pesquisa na web','Researches the web','Investiga en la web'],ToolSearch:['Busca ferramentas locais','Finds local tools','Busca herramientas locales']};const labels=known||web[key];return labels?labels[lang==='pt'?0:lang==='es'?2:1]:({pt:'Usa ferramenta local',en:'Uses a local tool',es:'Usa herramienta local'}[lang]||'Uses a local tool');}
  function displayName(agent,lang='en'){const raw=(agent.identity?.labels?.[lang]||({pt:agent.parentId?'AGENTE AJUDANTE':'AGENTE MAESTRO',en:agent.parentId?'AGENTE HELPER':'AGENTE MAESTRO',es:agent.parentId?'AGENTE AYUDANTE':'AGENTE MAESTRO'}[lang])).replace(/\s+\d+$/,''),base=scope.PainelLinguagem?.teamText(raw,lang).toUpperCase()||raw;if(base.includes(' · '))return base;const context=agent.identity?.contextLabels?.[lang]||agent.identity?.focusLabels?.[lang]?.replace(/^(?:o|a|os|as|the|el|la|los|las)\s+/i,'')||agent.project||({pt:'TRABALHO ATUAL',en:'CURRENT WORK',es:'TRABAJO ACTUAL'}[lang]);return base+' · '+(scope.PainelLinguagem?.teamText(context,lang)||context).toUpperCase();}
  function activeAgent(agent,now=Date.now()){const last=date(agent.lastAt);return agent.processAlive===true||agent.active===true||last!==null&&now-last>=0&&now-last<600000;}
  // One row per agent with the Home rules, shared by the Home and the Equipe tab.
  function frontContext(snapshot){const source=snapshot.homeSource||snapshot,list=source.equipe?.agents||[];if(homeForecastCache.size>250)homeForecastCache.clear();return {source,list,now:new Date(date(source.updated)??Date.now()),samples:homeForecast.samplesOf(list)};}
  function frontSession(session){return {...session.node,family:'claude',project:session.projectName||'Casa',homeSessionState:session.node.state||null,identity:{...session.node.identity,taskLabels:session.node.identity?.taskLabels||(/review|qa/.test(session.node.identity?.roleKey||'')?{pt:'Revisa as entregas da equipe',en:'Reviews team deliveries',es:'Revisa las entregas del equipo'}:{pt:'Coordena tarefas e entregas',en:'Coordinates tasks and deliveries',es:'Coordina tareas y entregas'})}};}
  function frontRow(original,{now,samples}){
    // Home describes the last action/role and uses the original rhythm forecast.
    // Delivery recognition belongs to the detailed views, not to this fallback.
    // A finished card keeps its real end and never receives a forecast.
    const agent={...original};delete agent.currentDelivery;
    const finished=/^(?:done|completed)$/i.test(String(original.state||''));
    agent.delivery=finished?{...original.delivery,etaAt:null,estimated:false,state:'done',completedAt:date(original.delivery?.completedAt)!==null?original.delivery.completedAt:null,estimateBasis:null,previousEtaAt:null}:date(original.delivery?.etaAt)!==null?{...original.delivery,completedAt:null}:homeForecast.forecast({...original,state:'working',delivery:{...original.delivery,completedAt:null}},now,samples,homeForecastCache);
    return agent;
  }
  function homeFronts(snapshot){
    const context=frontContext(snapshot),{source,list}=context,roots=list.filter(a=>!a.parentId&&(activeAgent(a)||list.some(c=>c.parentId===a.id&&activeAgent(c)))),sessions=(source.operator?.sessions||[]).filter(s=>s.node&&activeAgent(s.node)).map(frontSession);
    const ids=new Set(sessions.map(a=>a.id));
    return [...roots.filter(a=>!ids.has(a.id)),...sessions].map(original=>frontRow(original,context)).sort((a,b)=>Number(a.state==='done')-Number(b.state==='done')||Number(a.state==='waiting'||a.state==='registered')-Number(b.state==='waiting'||b.state==='registered'));
  }
  // Every agent and every session of the snapshot, by id, without the Home activity filter.
  function teamFronts(snapshot){const context=frontContext(snapshot),{source,list}=context,rows=new Map();for(const agent of list)rows.set(agent.id,frontRow(agent,context));for(const session of source.operator?.sessions||[])if(session.node?.id)rows.set(session.node.id,frontRow(frontSession(session),context));return rows;}
  // Home card names: role, then the work in at most five words. The work comes only from
  // neutral sources: the estado/titulos.json title, a deliverable recognized from the public
  // feed, the closed list of focuses and the closed list of real steps. It passes the same
  // filter used for estado/titulos.json. Repeated names are told apart by project or by the
  // last real step (the card's, then its newest helper's), never by a number; whatever still
  // repeats is listed in collisions.
  const NAME_STOP=new Set(['agente','de','do','da','dos','das','e','o','a','os','as','em','no','na','nos','nas','ao','aos','para','por','com','um','uma','the','of','and','for','in','on','to','el','la','los','las','del','y','en','al','un','una','con']);
  const nameKey=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
  const nameStem=word=>nameKey(word).replace(/\s+/g,'').replace(/(?:es|s)$/,'');
  const pick=(lang,pt,en,es)=>lang==='pt'?pt:lang==='es'?es:en;
  const FOCUS_NAMES={panel:{pt:'PAINEL LOCAL',en:'LOCAL PANEL',es:'PANEL LOCAL'},publicPanel:{pt:'PAINEL PÚBLICO',en:'PUBLIC PANEL',es:'PANEL PÚBLICO'},commands:{pt:'COMANDOS',en:'COMMANDS',es:'COMANDOS'},delivery:{pt:'ENTREGAS',en:'DELIVERIES',es:'ENTREGAS'},home:{pt:'PÁGINA INICIAL',en:'HOME PAGE',es:'PÁGINA INICIAL'},terminal:{pt:'TERMINAL',en:'TERMINAL',es:'TERMINAL'},gallery:{pt:'GALERIAS',en:'GALLERIES',es:'GALERÍAS'},combat:{pt:'COMBATE',en:'COMBAT',es:'COMBATE'},economy:{pt:'ECONOMIA',en:'ECONOMY',es:'ECONOMÍA'},copy:{pt:'TEXTOS',en:'COPY',es:'TEXTOS'},usability:{pt:'LEITURA DO PAINEL',en:'PANEL READING',es:'LECTURA DEL PANEL'},security:{pt:'PROTEÇÃO',en:'PROTECTION',es:'PROTECCIÓN'},tracker:{pt:'RARIDADES',en:'RARITY',es:'RAREZA'},art:{pt:'ARTE',en:'ART',es:'ARTE'}};
  const FOCUS_KEYS=new Set(Object.values(FOCUS_NAMES).flatMap(labels=>Object.values(labels)).map(nameKey));
  // [actions, now, before, short now, short before]: the closed list of real steps, in words.
  const NAME_STEPS=[
    [/^explicando$/,['EXPLICA O PRÓXIMO PASSO','EXPLAINS THE NEXT STEP','EXPLICA EL PRÓXIMO PASO'],['EXPLICOU O PRÓXIMO PASSO','EXPLAINED THE NEXT STEP','EXPLICÓ EL PRÓXIMO PASO'],['EXPLICA PASSOS','EXPLAINS STEPS','EXPLICA PASOS'],['EXPLICOU PASSOS','EXPLAINED STEPS','EXPLICÓ PASOS']],
    [/^(?:terminal|powershell|bash|shell|exec|exec command)$/,['EXECUTA COMANDOS LOCAIS','RUNS LOCAL COMMANDS','EJECUTA COMANDOS LOCALES'],['EXECUTOU COMANDOS LOCAIS','RAN LOCAL COMMANDS','EJECUTÓ COMANDOS LOCALES'],['RODA COMANDOS','RUNS COMMANDS','EJECUTA COMANDOS'],['RODOU COMANDOS','RAN COMMANDS','EJECUTÓ COMANDOS']],
    [/^(?:le arquivos?|read)$/,['LÊ ARQUIVOS DO PROJETO','READS PROJECT FILES','LEE ARCHIVOS DEL PROYECTO'],['LEU ARQUIVOS DO PROJETO','READ PROJECT FILES','LEYÓ ARCHIVOS DEL PROYECTO'],['LÊ ARQUIVOS','READS FILES','LEE ARCHIVOS'],['LEU ARQUIVOS','READ FILES','LEYÓ ARCHIVOS']],
    [/^(?:busca (?:nos )?arquivos|pesquisa arquivos|grep|glob)$/,['PESQUISA ARQUIVOS DO PROJETO','SEARCHES PROJECT FILES','BUSCA ARCHIVOS DEL PROYECTO'],['PESQUISOU ARQUIVOS DO PROJETO','SEARCHED PROJECT FILES','BUSCÓ ARCHIVOS DEL PROYECTO'],['BUSCA ARQUIVOS','SEARCHES FILES','BUSCA ARCHIVOS'],['BUSCOU ARQUIVOS','SEARCHED FILES','BUSCÓ ARCHIVOS']],
    [/^(?:edita arquivos|edit|multiedit|apply patch)$/,['EDITA ARQUIVOS DO PROJETO','EDITS PROJECT FILES','EDITA ARCHIVOS DEL PROYECTO'],['EDITOU ARQUIVOS DO PROJETO','EDITED PROJECT FILES','EDITÓ ARCHIVOS DEL PROYECTO'],['EDITA ARQUIVOS','EDITS FILES','EDITA ARCHIVOS'],['EDITOU ARQUIVOS','EDITED FILES','EDITÓ ARCHIVOS']],
    [/^(?:escreve arquivos|write)$/,['ESCREVE ARQUIVOS DO PROJETO','WRITES PROJECT FILES','ESCRIBE ARCHIVOS DEL PROYECTO'],['ESCREVEU ARQUIVOS DO PROJETO','WROTE PROJECT FILES','ESCRIBIÓ ARCHIVOS DEL PROYECTO'],['ESCREVE ARQUIVOS','WRITES FILES','ESCRIBE ARCHIVOS'],['ESCREVEU ARQUIVOS','WROTE FILES','ESCRIBIÓ ARCHIVOS']],
    [/^(?:olha imagens|view image)$/,['CONFERE IMAGENS DO PROJETO','CHECKS PROJECT IMAGES','REVISA IMÁGENES DEL PROYECTO'],['CONFERIU IMAGENS DO PROJETO','CHECKED PROJECT IMAGES','REVISÓ IMÁGENES DEL PROYECTO'],['CONFERE IMAGENS','CHECKS IMAGES','REVISA IMÁGENES'],['CONFERIU IMAGENS','CHECKED IMAGES','REVISÓ IMÁGENES']],
    [/^novo (?:item|pedido)$/,['COMEÇA A TAREFA ATUAL','STARTS THE CURRENT TASK','EMPIEZA LA TAREA ACTUAL'],['COMEÇOU A TAREFA ATUAL','STARTED THE CURRENT TASK','EMPEZÓ LA TAREA ACTUAL'],['COMEÇA TAREFA','STARTS TASK','EMPIEZA TAREA'],['COMEÇOU TAREFA','STARTED TASK','EMPEZÓ TAREA']],
    [/^terminou o passo$/,['TERMINOU O ÚLTIMO PASSO','FINISHED THE LAST STEP','TERMINÓ EL ÚLTIMO PASO'],['TERMINOU O ÚLTIMO PASSO','FINISHED THE LAST STEP','TERMINÓ EL ÚLTIMO PASO'],['TERMINOU PASSO','FINISHED STEP','TERMINÓ PASO'],['TERMINOU PASSO','FINISHED STEP','TERMINÓ PASO']],
    [/^precisa revisar$/,['PEDE REVISÃO DO PASSO','ASKS FOR A STEP REVIEW','PIDE REVISIÓN DEL PASO'],['PEDIU REVISÃO DO PASSO','ASKED FOR A STEP REVIEW','PIDIÓ REVISIÓN DEL PASO'],['PEDE REVISÃO','ASKS REVIEW','PIDE REVISIÓN'],['PEDIU REVISÃO','ASKED REVIEW','PIDIÓ REVISIÓN']],
    [/^(?:chama ajudantes|spawn agent|task|agent)$/,['CHAMA AJUDANTES','CALLS HELPERS','LLAMA AYUDANTES'],['CHAMOU AJUDANTES','CALLED HELPERS','LLAMÓ AYUDANTES'],['CHAMA AJUDANTES','CALLS HELPERS','LLAMA AYUDANTES'],['CHAMOU AJUDANTES','CALLED HELPERS','LLAMÓ AYUDANTES']],
    [/^(?:conversa com equipe|send message|sendmessage)$/,['ALINHA COM A EQUIPE','ALIGNS WITH THE TEAM','COORDINA CON EL EQUIPO'],['ALINHOU COM A EQUIPE','ALIGNED WITH THE TEAM','COORDINÓ CON EL EQUIPO'],['ALINHA EQUIPE','ALIGNS TEAM','COORDINA EQUIPO'],['ALINHOU EQUIPE','ALIGNED TEAM','COORDINÓ EQUIPO']],
    [/^(?:espera|espera ajudante|wait|wait agent|sleep|monitor)$/,['ESPERA UM RETORNO','AWAITS A REPLY','ESPERA UNA RESPUESTA'],['ESPEROU UM RETORNO','AWAITED A REPLY','ESPERÓ UNA RESPUESTA'],['ESPERA RETORNO','AWAITS REPLY','ESPERA RESPUESTA'],['ESPEROU RETORNO','AWAITED REPLY','ESPERÓ RESPUESTA']],
    [/^(?:navegador|js)$/,['USA O NAVEGADOR','USES THE BROWSER','USA EL NAVEGADOR'],['USOU O NAVEGADOR','USED THE BROWSER','USÓ EL NAVEGADOR'],['USA NAVEGADOR','USES BROWSER','USA NAVEGADOR'],['USOU NAVEGADOR','USED BROWSER','USÓ NAVEGADOR']],
    [/^(?:pesquisa(?: na web)?|webfetch|websearch|web run)$/,['PESQUISA NA WEB','RESEARCHES THE WEB','INVESTIGA EN LA WEB'],['PESQUISOU NA WEB','RESEARCHED THE WEB','INVESTIGÓ EN LA WEB'],['PESQUISA WEB','RESEARCHES WEB','INVESTIGA WEB'],['PESQUISOU WEB','RESEARCHED WEB','INVESTIGÓ WEB']],
    [/^(?:passa tarefa|followup task)$/,['PASSA UMA TAREFA','ASSIGNS A TASK','ASIGNA UNA TAREA'],['PASSOU UMA TAREFA','ASSIGNED A TASK','ASIGNÓ UNA TAREA'],['PASSA TAREFA','ASSIGNS TASK','ASIGNA TAREA'],['PASSOU TAREFA','ASSIGNED TASK','ASIGNÓ TAREA']],
    [/^(?:ve a equipe|list agents)$/,['CONFERE A EQUIPE','CHECKS THE TEAM','REVISA EL EQUIPO'],['CONFERIU A EQUIPE','CHECKED THE TEAM','REVISÓ EL EQUIPO'],['CONFERE EQUIPE','CHECKS TEAM','REVISA EQUIPO'],['CONFERIU EQUIPE','CHECKED TEAM','REVISÓ EQUIPO']],
    [/^estado registrado$/,['ATUALIZOU O RESUMO','UPDATED THE SUMMARY','ACTUALIZÓ EL RESUMEN'],['ATUALIZOU O RESUMO','UPDATED THE SUMMARY','ACTUALIZÓ EL RESUMEN'],['ATUALIZOU RESUMO','UPDATED SUMMARY','ACTUALIZÓ RESUMEN'],['ATUALIZOU RESUMO','UPDATED SUMMARY','ACTUALIZÓ RESUMEN']],
    [/./,['USA FERRAMENTA LOCAL','USES A LOCAL TOOL','USA HERRAMIENTA LOCAL'],['USOU FERRAMENTA LOCAL','USED A LOCAL TOOL','USÓ HERRAMIENTA LOCAL'],['USA FERRAMENTA','USES TOOL','USA HERRAMIENTA'],['USOU FERRAMENTA','USED TOOL','USÓ HERRAMIENTA']]
  ];
  function nameRole(agent,lang='pt'){const raw=String(agent.identity?.labels?.[lang]||({pt:agent.parentId?'AGENTE AJUDANTE':'AGENTE MAESTRO',en:agent.parentId?'AGENTE HELPER':'AGENTE MAESTRO',es:agent.parentId?'AGENTE AYUDANTE':'AGENTE MAESTRO'}[lang])||'AGENTE MAESTRO').split(' · ')[0].replace(/\s+\d+$/,'').trim();return (scope.PainelLinguagem?.teamText(raw,lang)||raw).toUpperCase();}
  function nameProject(agent,lang='pt'){
    const raw=String(agent.project||agent.projectName||'').replace(/\s*\([^)]*\)/g,'').trim(),key=nameKey(raw);if(!raw)return null;
    if(/^(?:painel aberto|agent panel|public panel)$/.test(key))return FOCUS_NAMES.publicPanel[lang]||FOCUS_NAMES.publicPanel.en;
    if(/^(?:painel|panel)$/.test(key))return FOCUS_NAMES.panel[lang]||FOCUS_NAMES.panel.en;
    if(key==='casa')return pick(lang,'CASA','HOUSE','CASA');
    const upper=raw.toUpperCase();return /^[A-ZÀ-Ý0-9 ]{1,30}$/u.test(upper)?upper:null;
  }
  function nameProjects(agent,lang='pt'){const set=new Set(['casa','house','trabalho atual','current work','trabajo actual','projeto local','painel','painel','panel','panel local','local panel'].map(nameKey)),raw=String(agent.project||agent.projectName||'').replace(/\s*\([^)]*\)/g,'').trim();if(raw)set.add(nameKey(raw));const label=nameProject(agent,lang);if(label)set.add(nameKey(label));return set;}
  function nameIsTask(text,role,projects=new Set()){
    const value=String(text||'');
    // The estado/titulos.json filter, then: no number, five words at most, never only the project, no word of the role.
    if(!value||value.length>120||/[^A-ZÀ-Ý0-9 :,]/u.test(value)||/\b(?:V\d+|PRIVADO|SEGREDOS|PRIVATE|SEED|OWNER|WALLET)\b/i.test(value)||/\d/.test(value))return false;
    const words=value.split(' ').filter(word=>nameKey(word));if(!words.length||words.length>5||projects.has(nameKey(value)))return false;
    const roleWords=new Set(String(role||'').split(/\s+/).filter(word=>!NAME_STOP.has(nameKey(word))).map(nameStem).filter(Boolean));
    return !words.some(word=>!NAME_STOP.has(nameKey(word))&&roleWords.has(nameStem(word)));
  }
  function nameStep(agent,lang='pt'){
    const index=lang==='pt'?0:lang==='es'?2:1,action=nameKey(agent.lastAction).replace(/_/g,' ');
    if(action){const row=NAME_STEPS.find(([match])=>match.test(action)),before=['sleeping','done','unknown'].includes(agent.state);return {kind:'step',text:(before?row[2]:row[1])[index],short:(before?row[4]:row[3])[index]};}
    if(agent.homeSessionState==='waiting'||agent.homeSessionState&&agent.state==='waiting')return {kind:'step',text:pick(lang,'PRECISA DE VOCÊ','NEEDS YOU','TE NECESITA'),short:pick(lang,'PRECISA DE VOCÊ','NEEDS YOU','TE NECESITA')};
    if(agent.homeSessionState)return {kind:'step',text:pick(lang,'ATUALIZOU O RESUMO','UPDATED THE SUMMARY','ACTUALIZÓ EL RESUMEN'),short:pick(lang,'ATUALIZOU RESUMO','UPDATED SUMMARY','ACTUALIZÓ RESUMEN')};
    if(agent.state==='done')return {kind:'step',text:pick(lang,'TERMINOU O ÚLTIMO PASSO','FINISHED THE LAST STEP','TERMINÓ EL ÚLTIMO PASO'),short:pick(lang,'TERMINOU PASSO','FINISHED STEP','TERMINÓ PASO')};
    if(agent.state==='waiting')return {kind:'step',text:pick(lang,'ESPERA UM RETORNO','AWAITS A REPLY','ESPERA UNA RESPUESTA'),short:pick(lang,'ESPERA RETORNO','AWAITS REPLY','ESPERA RESPUESTA')};
    return null;
  }
  // Last real step of the newest helper of a card: the third way to tell two equal names apart.
  function nameHelperStep(agent,everyone=[],lang='pt'){
    const latest=everyone.filter(other=>other.parentId===agent.id&&date(other.lastAt)!==null).sort((a,b)=>date(b.lastAt)-date(a.lastAt))[0];
    const step=latest&&nameStep({...latest,state:stateOf(latest)},lang);
    return step?pick(lang,'AJUDANTE ','HELPER ','AYUDANTE ')+step.short:null;
  }
  const ACCENTS={REVISAO:'REVISÃO',COORDENACAO:'COORDENAÇÃO',RODAPE:'RODAPÉ',CORTES:'CORTES',PAGINA:'PÁGINA',ANIMACAO:'ANIMAÇÃO',PROTECAO:'PROTEÇÃO',EPOCAS:'ÉPOCAS',PREVIA:'PRÉVIA',GRAFICOS:'GRÁFICOS',DECISOES:'DECISÕES',PREVISOES:'PREVISÕES',SECAO:'SEÇÃO',CORRECAO:'CORREÇÃO',TRADUCAO:'TRADUÇÃO'};
  function nameOptions(agent,snapshot={},lang='pt'){
    const options=[],add=(kind,value)=>{let text=String(value||'').toUpperCase().replace(/\s+/g,' ').trim();if(!text)return;if(lang==='pt')text=text.replace(/[A-Z]+/g,word=>ACCENTS[word]||word);const tail=text.includes(':')?text.slice(text.indexOf(':')+1).trim():'';for(const item of [tail,text])if(item)options.push({kind,text:item,short:item});};
    const group=(snapshot.equipe?.groups||[]).find(g=>g.titleSource==='estado/titulos.json'&&agent.conversationId&&g.conversationId===agent.conversationId&&(!agent.projectId||!g.projectId||g.projectId===agent.projectId));
    const known=(snapshot.equipe?.agents||[]).find(a=>a.id===agent.id)?.currentDelivery;
    if(known?.known!==false&&known?.source==='public-feed')add('feed',known.labels?.[lang]||known.labels?.pt);
    if(group)add('title',group.titleLabels?.[lang]||group.title);
    const context=agent.identity?.contextLabels?.[lang];if(context&&FOCUS_KEYS.has(nameKey(context)))add('focus',context);
    const focus=agent.identity?.focusKey;if(focus&&FOCUS_NAMES[focus])add('focus',(focus==='panel'&&/aberto|public/i.test(agent.project||'')?FOCUS_NAMES.publicPanel:FOCUS_NAMES[focus])[lang]);
    const step=nameStep(agent,lang);if(step)options.push(step);
    return options;
  }
  function homeNames(rows,snapshot={},lang='pt'){
    const everyone=snapshot.equipe?.agents||[],entries=(rows||[]).map(agent=>{const role=nameRole(agent,lang),projects=nameProjects(agent,lang),choice=nameOptions(agent,snapshot,lang).find(option=>nameIsTask(option.text,role,projects))||null;return {agent,role,projects,choice,step:nameStep(agent,lang),helper:nameHelperStep(agent,everyone,lang),project:nameProject(agent,lang),name:choice?role+' · '+choice.text:role};});
    const repeated=()=>{const byName=new Map();for(const entry of entries){if(!byName.has(entry.name))byName.set(entry.name,[]);byName.get(entry.name).push(entry);}return [...byName.values()].filter(list=>list.length>1);};
    const tell=(list,extra,stepChoice)=>{const values=list.map(extra);if(new Set(values).size<2)return;list.forEach((entry,index)=>{const text=[entry.choice?.short||entry.choice?.text,values[index]].filter(Boolean).join(', ');if(values[index]&&(stepChoice||entry.choice?.kind!=='step')&&nameIsTask(text,entry.role,entry.projects))entry.name=entry.role+' · '+text;});};
    for(const list of repeated())tell(list,entry=>entry.project,true);
    for(const list of repeated())tell(list,entry=>entry.step?.short||null,false);
    for(const list of repeated())tell(list,entry=>entry.helper,true);
    const names=new Map(entries.map(entry=>[entry.agent.id,entry.name]));names.collisions=repeated().map(list=>list[0].name);return names;
  }
  function homeDelivered(agent,lang='pt'){
    if(agent?.state!=='done')return null;
    const word=pick(lang,'entregue','delivered','entregado');
    return date(agent.delivery?.completedAt)!==null?word+' '+timeLabel(agent.delivery.completedAt,lang):word;
  }
  // Second pass for screens with many cards (Equipe tab). Cards that still share a name after homeNames:
  // the one standing for the most agents (then the oldest, then the id) keeps it; every other one says its
  // own last real step from the closed list instead. Still never a number; what remains is in collisions.
  function distinctNames(cards,lang='pt'){
    const names=new Map((cards||[]).map(card=>[card.id,card.name])),groups=new Map();
    for(const card of cards||[]){if(!groups.has(card.name))groups.set(card.name,[]);groups.get(card.name).push(card);}
    for(const list of groups.values()){
      if(list.length<2)continue;
      const ordered=[...list].sort((a,b)=>(b.size||1)-(a.size||1)||(date(a.row?.startedAt)??Infinity)-(date(b.row?.startedAt)??Infinity)||String(a.id).localeCompare(String(b.id)));
      for(const card of ordered.slice(1)){
        const row=card.row||{},role=nameRole(row,lang),projects=nameProjects(row,lang),step=nameStep(row,lang),used=new Set(names.values());
        const next=[step?.text,step?.short].filter(text=>text&&nameIsTask(text,role,projects)).map(text=>role+' · '+text).find(name=>!used.has(name));
        if(next)names.set(card.id,next);
      }
    }
    const count=new Map();for(const name of names.values())count.set(name,(count.get(name)||0)+1);
    names.collisions=[...count].filter(([,n])=>n>1).map(([name])=>name);return names;
  }
  // Third line of a card with the Home rules: real delivery time when finished, forecast while active,
  // last real activity while resting (a resting agent receives no promise).
  function cardTime(agent,lang='pt',active=false){
    const delivered=homeDelivered(agent,lang);if(delivered)return {text:delivered,tone:'done',tip:''};
    if(active){const timing=deliveryLabel(agent.delivery,lang);return agent.delivery?.etaAt?{text:timing.eta+(timing.tone==='late'?' · '+pick(lang,'atrasada','overdue','atrasada'):''),tone:timing.tone,tip:forecastTip(agent.delivery,lang)}:{text:'',tone:timing.tone,tip:''};}
    return date(agent.lastAt)!==null?{text:pick(lang,'última atividade ','last activity ','última actividad ')+timeLabel(agent.lastAt,lang),tone:'resting',tip:''}:{text:'',tone:'resting',tip:''};
  }
  // Real Agente portraits only, from the verified pool the server assigns (the Home source). Each card keeps
  // its own verified Agente; a card without one borrows a verified Agente that no card of the same screen shows,
  // remembered per screen so it does not jump. Never the generic art, never twice on one screen.
  function portraitPool(snapshot){
    const seen=new Set(),pool=[],add=agente=>{const image=agente?.verified===true?imageOf({agente}):null;if(image&&image!=='/agente.png'&&!seen.has(image)){seen.add(image);pool.push({id:agente.id??null,image});}};
    for(const agent of snapshot?.equipe?.agents||[])add(agent.agente);for(const session of snapshot?.operator?.sessions||[])add(session.node?.agente);
    return pool.sort((a,b)=>a.image.localeCompare(b.image));
  }
  const portraitHash=value=>{let hash=2166136261;for(const char of String(value))hash=Math.imul(hash^char.codePointAt(0),16777619)>>>0;return hash;};
  function distinctPortraits(cards,pool=[],memory=new Map()){
    const used=new Set(),result=new Map(),known=new Map(pool.map(item=>[item.image,item]));
    for(const card of cards||[]){const own=(card.candidates||[]).map(agente=>agente?.verified===true?{id:agente.id??null,image:imageOf({agente})}:null).find(item=>item&&item.image!=='/agente.png'&&!used.has(item.image));if(own){used.add(own.image);result.set(card.id,own);}}
    for(const card of cards||[]){if(result.has(card.id))continue;const previous=memory.get(card.id);if(previous&&known.has(previous.image)&&!used.has(previous.image)){used.add(previous.image);result.set(card.id,previous);}}
    const free=pool.filter(item=>!used.has(item.image));
    for(const card of [...(cards||[])].filter(card=>!result.has(card.id)).sort((a,b)=>portraitHash(a.id)-portraitHash(b.id)||String(a.id).localeCompare(String(b.id)))){if(!free.length){result.set(card.id,null);continue;}const [chosen]=free.splice(portraitHash(card.id)%free.length,1);used.add(chosen.image);result.set(card.id,chosen);}
    for(const [id,value]of result)if(value)memory.set(id,value);
    result.missing=[...result].filter(([,value])=>!value).map(([id])=>id);return result;
  }
  function taskLabel(agent,lang='en'){
    if(agent.currentDelivery)return agent.currentDelivery.labels?.[lang]||agent.currentDelivery.labels?.pt||'';
    const action=String(agent.lastAction||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),role=agent.identity?.roleKey;
    const words=(pt,en,es)=>lang==='pt'?pt:lang==='es'?es:en;
    if(agent.identity&&!role&&agent.identity.taskLabels?.[lang]&&!action)return agent.identity.taskLabels[lang];
    const steps={'explicando':['Explica o próximo passo','Explains the next step','Explica el próximo paso'],'novo item':['Começa a tarefa atual','Starts the current task','Empieza la tarea actual'],'novo pedido':['Começa a tarefa atual','Starts the current task','Empieza la tarea actual'],'terminou o passo':['Finaliza a tarefa atual','Finishes the current task','Finaliza la tarea actual'],'precisa revisar':['Revisa o último passo','Reviews the last step','Revisa el último paso'],'terminal':['Executa comandos locais','Runs local commands','Ejecuta comandos locales'],'le arquivos':['Lê arquivos do projeto','Reads the project files','Lee archivos del proyecto'],'busca arquivos':['Pesquisa arquivos do projeto','Searches the project files','Busca archivos del proyecto'],'busca nos arquivos':['Pesquisa arquivos do projeto','Searches the project files','Busca archivos del proyecto'],'edita arquivos':['Edita arquivos do projeto','Edits the project files','Edita archivos del proyecto'],'escreve arquivos':['Escreve arquivos do projeto','Writes the project files','Escribe archivos del proyecto'],'olha imagens':['Confere imagens do projeto','Checks the project images','Revisa imágenes del proyecto']};
    if(!agent.identity||!role){
      if(steps[action])return steps[action][lang==='pt'?0:lang==='es'?2:1];
      if(action&&!/estado registrado/.test(action))return localizedTool({name:agent.lastAction},lang);
      return words('Revisa a tarefa recebida','Reviews the assigned task','Revisa la tarea recibida');
    }
    const work=agent.identity?.taskLabels?.[lang]||agent.taskLabels?.[lang];
    if(work&&agent.state!=='done'){const project=String(agent.project||'').replace(/\s*\([^)]*\)/g,'');return project?work.replace(/desta tarefa|para o projeto|this task|for the project|esta tarea|para el proyecto/gi,project):work;}
    const context=String(agent.identity?.taskLabels?.pt||agent.currentItemTitle||'').toLowerCase();
    const goal=String(agent.conversationTitle||agent.currentItemTitle||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const noun=/nomes.*estimativ/.test(goal)?words('os nomes e previsões','names and forecasts','los nombres y previsiones'):agent.identity?.focusLabels?.[lang]||(/galeri/.test(context)?words('as galerias','the galleries','las galerías'):/nomes|entregas|estimativ/.test(context)?words('o painel','the dashboard','el panel'):/toque|combate|armas|animac/.test(context)?words('o combate','combat','el combate'):/econom/.test(context)?words('a economia','the economy','la economía'):/texto|conte[uú]do/.test(context)?words('os textos','the copy','los textos'):/dados/.test(context)?words('os dados','the data','los datos'):words(agent.project?.replace(/\s*\([^)]*\)/g,'')||'a tarefa',agent.project?.replace(/\s*\([^)]*\)/g,'')||'the task',agent.project?.replace(/\s*\([^)]*\)/g,'')||'la tarea'));
    const verbs={'terminou o passo':words('Concluiu trabalho para ','Completed work for ','Terminó trabajo para '),'precisa revisar':words('Revisa trabalho em ','Reviews work on ','Revisa trabajo en '),'usa ferramenta local':words('Usa ferramenta para ','Uses a tool for ','Usa herramienta para '),'chama ajudantes':words('Divide trabalho em ','Delegates work on ','Reparte trabajo en '),'conversa com equipe':words('Alinha trabalho em ','Coordinates work on ','Coordina trabajo en '),'espera':words('Espera retorno de ','Awaits a reply for ','Espera respuesta de '),'explicando':words('Explica passos para ','Explains steps for ','Explica pasos para '),'novo item':words('Começa trabalho para ','Starts work for ','Empieza trabajo para '),'novo pedido':words('Começa trabalho em ','Starts work on ','Empieza trabajo en '),'terminal':words('Roda comandos para ','Runs commands for ','Ejecuta comandos para '),'le arquivos':words('Lê arquivos para ','Reads files for ','Lee archivos para '),'busca arquivos':words('Busca arquivos para ','Finds files for ','Busca archivos para '),'busca nos arquivos':words('Busca arquivos para ','Finds files for ','Busca archivos para '),'edita arquivos':words('Edita arquivos para ','Edits files for ','Edita archivos para '),'escreve arquivos':words('Escreve arquivos para ','Writes files for ','Escribe archivos para '),'olha imagens':words('Confere imagens de ','Checks images of ','Revisa imágenes de ')};
    if(action==='terminou o passo')return (words('Concluiu: ','Finished: ','Terminó: ')+noun.replace(/^(?:o|a|os|as|the|el|la|los|las)\s+/i,'')).slice(0,40);
    if(verbs[action]){const joined=verbs[action]+noun,value=lang==='pt'?joined.replace(/\bem os\b/g,'nos').replace(/\bem as\b/g,'nas').replace(/\bem o\b/g,'no').replace(/\bem a\b/g,'na').replace(/\bde os\b/g,'dos').replace(/\bde as\b/g,'das').replace(/\bde o\b/g,'do').replace(/\bde a\b/g,'da'):joined;return value.length<=40?value:value.slice(0,39).replace(/\s+\S*$/,'')+'…';}
    if(work&&role==='helper'&&!/tarefa atual|ferramenta local|frente de trabalho/.test(work))return work.slice(0,40);
    if(agent.lastAt)return (words('Atividade em ','Activity for ','Actividad en ')+noun).slice(0,40);
    return words('Organiza a próxima entrega','Plans the next delivery','Organiza la próxima entrega');
  }
  function stableOrder(previous,items){const byId=new Map(items.map(item=>[item.id,item])),ids=[...previous.filter(id=>byId.has(id)),...items.filter(item=>!previous.includes(item.id)).map(item=>item.id)];return ids.map(id=>byId.get(id));}
  function groupTitle(group,lang='en'){return group.titleLabels?.[lang]||group.conversation||COPY[lang].conversation;}
  function toolLabel(tool,agent,lang){return (lang?localizedTool(tool,lang):(tool.label||tool.name))+(finite(tool.count)?' ×'+(agent.toolsExact===false?'≥':'')+tool.count:'');}
  function stateOf(agent,now=Date.now()){
    const value=String(agent.state||'').toLowerCase(),last=date(agent.lastAt||agent.lastActionAt);
    if(value==='done'||value==='completed')return 'done';
    if(agent.processAlive===true)return value==='walking'?'walking':value==='working'?'working':'waiting';
    if(value==='waiting')return 'waiting';
    if(value==='sleeping'||last!==null&&now-last>=SLEEP_AFTER)return 'sleeping';
    if(value==='walking')return 'walking';
    return value==='working'?'working':'unknown';
  }
  function imageOf(agent){
    const value=String(agent.agente?.image||'');
    // Agente assets must already be local. Rendering never downloads an image.
    return /^\/?(?:assets|agente|agentes|miniaturas)\/[\w./-]+\.(?:png|webp|jpg)$/i.test(value)&&!value.includes('..')?value:'/agente.png';
  }
  function frescorDe(view){const f=view&&view.source&&view.source.consumption&&view.source.consumption.frescor;return f&&f.velho?f:null;}
  function consumoOf(view){const c=view&&view.source&&view.source.consumo;return c&&Number.isFinite(c.total)?c:null;}
  function sinceText(iso,lang){const at=Date.parse(iso);if(!Number.isFinite(at))return null;const d=new Date(at-3*3600000),two=n=>String(n).padStart(2,'0'),hm=two(d.getUTCHours())+':'+two(d.getUTCMinutes());return lang==='en'?['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]+' '+d.getUTCDate()+', '+hm:two(d.getUTCDate())+'/'+two(d.getUTCMonth()+1)+' '+hm;}
  function consumoLabel(view,lang){const c=consumoOf(view),since=c&&sinceText(c.desde,lang);return since?({pt:'tokens desde ',en:'tokens since ',es:'tokens desde '}[lang]||'tokens desde ')+since:null;}
  function paintSplit(controller,view,lang){const host=controller.split;if(!host)return;const c=consumoOf(view);if(!c||!c.total||view.tokens!==c.total){host.replaceChildren();host.hidden=true;return;}
    const W={pt:{read:'é releitura do contexto guardado (cache): custa cerca de 10 vezes menos que entrada nova.',types:['releitura','escrita de cache','entrada nova','saída'],today:'hoje',counting:p=>'Contando as conversas: '+p+'% lido'},en:{read:'is re-reading saved context (cache): it costs about 10 times less than new input.',types:['re-reading','cache writes','new input','output'],today:'today',counting:p=>'Counting conversations: '+p+'% read'},es:{read:'es relectura del contexto guardado (caché): cuesta cerca de 10 veces menos que la entrada nueva.',types:['relectura','escritura de caché','entrada nueva','salida'],today:'hoy',counting:p=>'Contando las conversaciones: '+p+'% leído'}}[lang]||null;if(!W){host.hidden=true;return;}
    const t=c.tipos,share=x=>{const p=x/c.total*100;return new Intl.NumberFormat(lang,{maximumFractionDigits:p<10?1:0}).format(p)+'%';};
    const nodes=[el('p','eq-split-main',share(t.leituraCache)+' '+W.read),el('p','eq-split-detail',[['leituraCache',0],['escritaCache',1],['novo',2],['saida',3]].map(([k,i])=>W.types[i]+' '+compact(t[k],lang)).join(' · ')),el('p','eq-split-detail',['Claude '+compact(c.familias.claude.total,lang),'Codex '+compact(c.familias.codex.total,lang),W.today+' '+compact(c.hoje.total,lang)].join(' · '))];
    if(!c.completo)nodes.push(el('p','eq-split-detail eq-split-counting',W.counting(new Intl.NumberFormat(lang,{maximumFractionDigits:0}).format(c.lidoPct))));
    host.replaceChildren(...nodes);host.hidden=false;}
  function cupLevels(waterMl,max=10){
    if(!finite(waterMl))return {levels:[],extra:null,total:null};
    const cups=waterMl/250,full=Math.floor(cups),partial=cups-full;
    if(cups===0)return {levels:[0],extra:0,total:0};
    const total=Math.ceil(cups),count=Math.min(max,total),levels=Array.from({length:count},(_,index)=>index<full?1:partial);
    if(total>max&&partial>0)levels[count-1]=partial;
    return {levels,extra:Math.max(0,total-count),total:cups};
  }
  function normalize(snapshot,now=Date.now()){
    const source=snapshot.equipe||snapshot||{},countsKnown=Array.isArray(source.agents)||Array.isArray(source.grupos),raw=source.agents||source.grupos?.flatMap(group=>group.agentes.map(agent=>({...agent,conversationId:agent.conversationId||group.id,conversation:agent.conversation||group.nome})))||[];
    const agents=raw.filter(agent=>agent&&typeof agent.id==='string').map(agent=>({...agent,state:stateOf(agent,now)}));
    const projects=new Map((Array.isArray(snapshot.projects)?snapshot.projects:[]).map(project=>[project.id,project]));
    const sourceGroups=new Map((source.groups||[]).map(group=>[group.id,group]));
    const groups=new Map();for(const agent of agents){const projectId=agent.projectId||'unread',conversationId=agent.conversationId||agent.id,key=projectId+'|'+conversationId;if(!groups.has(key))groups.set(key,{id:key,projectId,project:agent.project||agent.projectName||projects.get(projectId)?.name||null,conversationId,projectLabel:sourceGroups.get(key)?.projectLabel||null,titleLabels:sourceGroups.get(key)?.titleLabels||agent.conversationLabels||null,conversation:sourceGroups.get(key)?.title||agent.conversationTitle||agent.conversation||agent.conversationName||null,delivery:sourceGroups.get(key)?.delivery||agent.delivery||null,agents:[]});groups.get(key).agents.push(agent);}
    const tokens=finite(source.tokens)?source.tokens:(agents.length&&agents.every(agent=>finite(agent.tokens))?agents.reduce((sum,agent)=>sum+agent.tokens,0):null);
    const weightedTokens=finite(source.weightedTokens)?source.weightedTokens:(agents.length&&agents.every(agent=>finite(agent.weightedTokens))?agents.reduce((sum,agent)=>sum+agent.weightedTokens,0):null);
    const waterMl=finite(source.waterMl)?source.waterMl:finite(source.aguaMl)?source.aguaMl:finite(weightedTokens)?weightedTokens/1500*.3:null;
    const tokensExact=source.tokensExact!==false&&!agents.some(agent=>agent.tokensExact===false);
    return {source,agents,groups:[...groups.values()].sort((a,b)=>Number(Boolean(b.delivery?.etaAt))-Number(Boolean(a.delivery?.etaAt))||Number(a.agents.every(x=>x.state==='done'||x.state==='sleeping'))-Number(b.agents.every(x=>x.state==='done'||x.state==='sleeping'))),total:countsKnown?agents.length:null,active:countsKnown?agents.filter(agent=>['working','walking'].includes(agent.state)).length:null,tokens,tokensExact,weightedTokens,waterMl,now};
  }
  function progressOf(value,now=Date.now()){
    if(!value||!Array.isArray(value.deliveries)||!value.deliveries.length)return {percent:null,done:null,total:null,eta:null,deliveries:[]};
    const deliveries=value.deliveries,total=deliveries.length,done=deliveries.filter(item=>item.done===true||item.state==='done').length;
    const completed=deliveries.map(item=>date(item.completedAt)).filter(Number.isFinite).sort((a,b)=>a-b),started=date(value.startedAt);
    let eta=null;
    if(done<total&&completed.length>=2&&started!==null&&completed.at(-1)>started){const pace=(completed.at(-1)-started)/completed.length;eta=new Date(now+pace*(total-done)).toISOString();}
    return {percent:total?Math.round(done/total*100):null,done,total,eta,deliveries,startedAt:value.startedAt||null};
  }
  function homeAgents(agents,limit=8){
    const chosen=[],seen=new Set(),add=agent=>{if(agent&&!seen.has(agent.id)&&chosen.length<limit){seen.add(agent.id);chosen.push(agent);}};
    const moving=agents.filter(agent=>['working','walking'].includes(agent.state)).sort((a,b)=>Number(a.identity?.roleKey==='helper')-Number(b.identity?.roleKey==='helper')||Number(Boolean(a.parentId))-Number(Boolean(b.parentId))||String(b.lastAt||'').localeCompare(String(a.lastAt||'')));
    const waiting=agents.find(agent=>agent.state==='waiting'),sleeping=agents.find(agent=>agent.state==='sleeping');
    for(const agent of moving.slice(0,Math.max(0,limit-Number(Boolean(waiting))-Number(Boolean(sleeping)))))add(agent);
    add(waiting);add(sleeping);for(const agent of agents)add(agent);return chosen;
  }
  function deliveryLabel(delivery,lang='pt'){
    const words={pt:{eta:'entrega ~',none:'Calculando previsão',done:'Entregue',early:'Adiantado',onTime:'No prazo',late:'Atrasado',noDeadline:'Sem prazo',progress:'Em andamento',left:'faltam'},en:{eta:'delivery ~',none:'Calculating forecast',done:'Delivered',early:'Early',onTime:'On time',late:'Late',noDeadline:'No deadline',progress:'In progress',left:'left'},es:{eta:'entrega ~',none:'Calculando previsión',done:'Entregado',early:'Adelantado',onTime:'A tiempo',late:'Tarde',noDeadline:'Sin plazo',progress:'En curso',left:'faltan'}}[lang]||{};
    const overdue=delivery?.etaAt&&!delivery?.completedAt&&date(delivery.etaAt)<Date.now();const eta=overdue?({pt:'A qualquer momento',en:'Any moment now',es:'En cualquier momento'}[lang]):delivery?.etaAt?words.eta+timeLabel(delivery.etaAt,lang)+(delivery.estimated?' · '+({pt:'estimada',en:'estimated',es:'estimada'}[lang]):''):delivery?.completedAt?words.done+' '+timeLabel(delivery.completedAt,lang):words.none;
    const expired=Boolean(delivery?.etaAt&&!delivery?.completedAt&&date(delivery.etaAt)<Date.now());
    const tone=expired?'in-progress':delivery?.state==='in-progress'?(delivery.etaAt&&delivery.deadlineAt&&date(delivery.etaAt)>date(delivery.deadlineAt)?'late':'in-progress'):delivery?.state||'no-deadline';
    const countdownAt=date(delivery?.deadlineAt||delivery?.etaAt),remaining=countdownAt!==null?Math.max(0,Math.ceil((countdownAt-Date.now())/60000)):delivery?.minutes;
    const badge=delivery?.completedAt?words.done:expired?({pt:'Estimativa vencida',en:'Estimate overdue',es:'Estimación vencida'}[lang]||'Estimate overdue'):({'in-progress':words.progress+(finite(remaining)?' · '+(delivery?.deadlineAt?({pt:'Prazo em ',en:'Deadline in ',es:'Plazo en '}[lang])+remaining+' min':({pt:'Entrega em ',en:'Delivery in ',es:'Entrega en '}[lang])+remaining+' min'):''),'early':words.early,'on-time':words.onTime,'late':words.late,'no-deadline':words.noDeadline})[tone]||words.noDeadline;
    return {eta,badge,tone,ratio:finite(delivery?.ratio)?Math.min(1,delivery.ratio):null};
  }
  function forecastTip(delivery,lang='pt'){
    const b=delivery?.estimateBasis||{},w=(pt,en,es)=>lang==='pt'?pt:lang==='es'?es:en;
    let text=b.method==='similar-tasks'?w('Base: '+b.sampleCount+' tarefas parecidas, mediana '+b.typicalMinutes+' min','Basis: '+b.sampleCount+' similar tasks, median '+b.typicalMinutes+' min','Base: '+b.sampleCount+' tareas similares, mediana '+b.typicalMinutes+' min'):b.method==='steps-per-minute'?w('Base: '+b.steps+' passos em '+b.elapsedMinutes+' min; hipótese de '+b.remainingStages+' etapas restantes','Basis: '+b.steps+' steps in '+b.elapsedMinutes+' min; '+b.remainingStages+' remaining stages assumed','Base: '+b.steps+' pasos en '+b.elapsedMinutes+' min; se suponen '+b.remainingStages+' etapas'):b.method==='initial-window'?w('Base inicial: sem amostra de ritmo; hipótese de '+b.remainingStages+' etapas de 5 min','Initial basis: no pace sample; '+b.remainingStages+' stages of 5 min assumed','Base inicial: sin muestra de ritmo; se suponen '+b.remainingStages+' etapas de 5 min'):delivery?.etaSource==='operator-summary'?w('Previsão no resumo da sessão','Forecast in the session summary','Previsión en el resumen de sesión'):delivery?.etaSource==='feed'?w('Previsão declarada no feed','Forecast declared in the feed','Previsión declarada en el feed'):delivery?.deadlineAt?w('Prazo declarado na tarefa','Deadline declared in the task','Plazo declarado en la tarea'):delivery?.completedAt?w('Última entrega registrada','Last recorded delivery','Última entrega registrada'):w('Leitura da atividade local','Local activity reading','Lectura de actividad local');
    const read=b.readAt||delivery?.etaUpdatedAt||delivery?.completedAt;if(read)text+=' · '+w('lido ','read ','leído ')+timeLabel(read,lang);
    if(delivery?.previousEtaAt&&delivery?.previousEtaAt!==delivery?.etaAt)text+=' · '+w('antes ~','previously ~','antes ~')+timeLabel(delivery.previousEtaAt,lang)+' · '+w('novos passos registrados','new recorded activity','nueva actividad registrada');
    return text;
  }
  const instances=new WeakMap();
  function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=scope.PainelLinguagem?.text(text,document.documentElement.lang)??String(text);return node;}
  function svg(tag,attrs={}){const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))node.setAttribute(k,v);return node;}
  function drawCup(level,id){
    const cup=svg('svg',{viewBox:'0 0 32 42','aria-hidden':'true',class:'eq-cup'}),defs=svg('defs'),clip=svg('clipPath',{id});clip.append(svg('path',{d:'M5 4h22l-3 34H8z'}));defs.append(clip);cup.append(defs);
    const fill=svg('g',{'clip-path':'url(#'+id+')'});fill.append(svg('rect',{x:0,y:0,width:32,height:42,class:'eq-cup-bg'}));
    if(level>0){const wave=svg('g',{class:level<1?'eq-water-wave':''}),y=38-level*32;wave.append(svg('path',{d:'M-12 '+y+' q6 -3 12 0 t12 0 t12 0 t12 0 V44 H-12z',class:'eq-cup-water'}));fill.append(wave);}cup.append(fill,svg('path',{d:'M5 4h22l-3 34H8z',class:'eq-cup-outline'}),svg('path',{d:'M9 8v22',class:'eq-cup-glint'}));return cup;
  }
  function create(host){
    host.replaceChildren();host.className='eq-shell';const controller={host,snapshot:null,options:{},nodes:new Map(),groups:new Map(),previous:new Map(),cupKey:null,id:'eq-'+Math.random().toString(36).slice(2),details:false};
    const heading=el('div','eq-heading'),title=el('h2'),count=el('span');heading.append(title,count);
    const stage=el('div','eq-groups'),consumption=el('section','eq-consumption'),tokenBlock=el('div','eq-token-block'),consTitle=el('h2'),tokens=el('strong'),tokensLabel=el('span');const split=el('div','eq-split');split.hidden=true;tokenBlock.append(consTitle,tokens,tokensLabel,split);
    const cups=el('div','eq-cups'),waterBlock=el('div','eq-water-block'),water=el('strong'),waterLabel=el('span'),cupCount=el('small'),info=el('button','eq-info','i'),tip=el('span','eq-info-tip');info.type='button';info.setAttribute('aria-expanded','false');
    const infoPanel=el('div','eq-info-panel'),tldr=el('strong','eq-tldr'),more=el('details','eq-info-more'),moreSum=el('summary'),moreText=el('p');more.append(moreSum,moreText);infoPanel.append(tldr,more);infoPanel.hidden=true;
    info.addEventListener('click',()=>{const open=info.getAttribute('aria-expanded')!=='true';info.setAttribute('aria-expanded',String(open));infoPanel.hidden=!open;});info.append(tip);waterBlock.append(water,waterLabel,info,cupCount);consumption.append(tokenBlock,cups,waterBlock,infoPanel);
    host.append(heading,consumption,stage);Object.assign(controller,{heading,title,count,stage,consumption,consTitle,tokens,tokensLabel,split,cups,water,waterLabel,cupCount,info,tip,infoPanel,tldr,moreSum,moreText});
    controller.visibility=()=>{host.classList.toggle('eq-paused',document.hidden);for(const node of controller.nodes.values()){if(document.hidden)node.motion?.pause();else node.motion?.finish();}};document.addEventListener('visibilitychange',controller.visibility);
    controller.timer=setInterval(()=>{if(controller.snapshot&&!document.hidden&&host.isConnected)paint(controller,false);},30000);instances.set(host,controller);return controller;
  }
  function createGroup(controller,group){
    const box=el('section','eq-conversation'),heading=el('div','eq-conversation-heading'),identity=el('div'),project=el('span','eq-project'),title=el('h3'),counter=el('span','eq-group-count'),agents=el('div','eq-stage');const timing=el('div','eq-delivery-heading'),eta=el('strong','eq-delivery-eta'),badge=el('span','eq-deadline-badge'),bar=el('div','eq-time-bar'),fill=el('i');timing.append(eta,badge);bar.append(fill);identity.append(project,title);heading.append(identity,timing,counter);const legend=el('div','eq-time-legend');box.append(heading,bar,legend,agents);controller.stage.append(box);return {box,project,title,counter,agents,eta,badge,bar,fill,legend};
  }
  function createAgent(controller,agent){
    const button=el('button','eq-agent');button.type='button';button.dataset.id=agent.id;
    const art=el('div','eq-agent-art'),avatar=el('div','eq-agent-avatar'),image=el('img'),family=el('span','eq-family'),busy=el('span','eq-busy'),sleep=el('span','eq-zz'),check=el('span','eq-check','✓');image.width=68;image.height=68;image.alt='';image.draggable=false;
    image.addEventListener('error',()=>{if(image.getAttribute('src')!=='/agente.png')image.src='/agente.png';});
    busy.append(el('i'),el('i'),el('i'));sleep.append(el('i',undefined,'z'),el('i',undefined,'z'),el('i',undefined,'z'));avatar.append(image,family,busy,sleep,check);art.append(avatar);
    const name=el('strong','eq-agent-name'),action=el('span','eq-agent-action'),state=el('span','eq-agent-state');const eta=el('span','eq-agent-eta'),dot=el('i','eq-deadline-dot'),agente=el('span','eq-agente-number');button.append(art,name,agente,action,state,eta);eta.prepend(dot);agente.hidden=true;
    button.addEventListener('click',()=>{const current=controller.view.agents.find(item=>item.id===button.dataset.id);if(current){if(controller.options.onSelectAgent)controller.options.onSelectAgent(current);else showAgent(controller,current);}});
    return {button,art,avatar,image,family,name,action,state,eta,dot,agente,motion:null};
  }
  function paint(controller,animate=true){
    const lang=COPY[controller.options.lang]?controller.options.lang:'en',words=COPY[lang],homeMode=controller.options.mode==='home',source=homeMode?{...controller.snapshot,equipe:{...controller.snapshot.equipe,agents:homeFronts(controller.snapshot)}}:controller.snapshot,view=normalize(source);controller.view=view;controller.lang=lang;controller.words=words;
    const home=controller.options.mode==='home',homeIds=new Set(view.agents.map(agent=>agent.id));
    const allAgents=view.agents;const stableAgents=stableOrder(controller.agentOrder||[],allAgents);controller.agentOrder=stableAgents.map(agent=>agent.id);const initialHome=stableAgents;const pinnedHome=controller.homeOrder?.length?stableOrder(controller.homeOrder,stableAgents):initialHome;controller.homeOrder=pinnedHome.map(agent=>agent.id);const cardNames=home?homeNames(pinnedHome,controller.snapshot,lang):new Map();controller.homeNames=cardNames;
    const displayGroups=home?[{id:'home',projectId:'',project:'',conversation:'',agents:pinnedHome}]:stableOrder(controller.groupOrder||[],view.groups);controller.groupOrder=displayGroups.filter(group=>group.id!=='home').map(group=>group.id);
    controller.host.classList.toggle('eq-home',home);controller.heading.hidden=true;
    if(controller.options.consumptionHost&&controller.consumption.parentNode!==controller.options.consumptionHost)controller.options.consumptionHost.append(controller.consumption);
    controller.consumption.classList.add('eq-shell');
    controller.title.textContent=words.team;controller.count.textContent=(view.active??'?')+' '+words.active+' · '+(view.total??'?')+' '+words.agents;
    controller.host.classList.toggle('eq-paused',document.hidden);const wantedGroups=new Set(displayGroups.map(group=>group.id)),wantedAgents=new Set(displayGroups.flatMap(group=>group.agents).map(agent=>agent.id));
    for(const [key,group]of controller.groups)if(!wantedGroups.has(key)){group.box.remove();controller.groups.delete(key);}
    for(const [key,node]of controller.nodes)if(!wantedAgents.has(key)){node.motion?.cancel();node.button.remove();controller.nodes.delete(key);controller.previous.delete(key);}
    for(const [groupIndex,group]of displayGroups.entries()){let container=controller.groups.get(group.id);if(!container){container=createGroup(controller,group);controller.groups.set(group.id,container);}if(controller.stage.children[groupIndex]!==container.box)controller.stage.insertBefore(container.box,controller.stage.children[groupIndex]||null);container.box.classList.toggle('eq-wide',group.agents.length>3);container.project.textContent=group.projectLabel||group.project||group.projectId||words.project;container.title.textContent=groupTitle(group,lang);const timing=deliveryLabel(group.delivery,lang);container.eta.textContent=timing.eta;container.badge.textContent=timing.badge+(timing.tone==='late'&&group.delivery?.deadlineAt&&finite(group.delivery?.minutes)?' · '+group.delivery.minutes+' min':'');container.badge.dataset.tone=timing.tone;container.bar.hidden=!group.delivery?.deadlineAt;container.bar.classList.toggle('eq-time-expired',Boolean(group.delivery?.deadlineAt&&timing.ratio===null&&Date.parse(group.delivery.deadlineAt)<Date.now()));container.fill.hidden=timing.ratio===null;container.fill.style.transform='scaleX('+(timing.ratio||0)+')';container.bar.setAttribute('aria-label',timing.badge);container.legend.hidden=!(group.delivery?.startedAt||group.delivery?.deadlineAt);container.legend.textContent=({pt:'Início',en:'Start',es:'Inicio'}[lang])+' '+timeLabel(group.delivery?.startedAt,lang)+' · '+({pt:'Agora',en:'Now',es:'Ahora'}[lang])+' '+timeLabel(new Date().toISOString(),lang)+' · '+({pt:'Prazo',en:'Deadline',es:'Plazo'}[lang])+' '+timeLabel(group.delivery?.deadlineAt,lang);container.bar.title=({pt:'Início / agora / prazo',en:'Start / now / deadline',es:'Inicio / ahora / plazo'}[lang])+' · '+timeLabel(group.delivery?.startedAt,lang)+' / '+timeLabel(new Date().toISOString(),lang)+' / '+timeLabel(group.delivery?.deadlineAt,lang);container.eta.title=forecastTip(group.delivery,lang);container.counter.hidden=true;container.counter.textContent=agentCount(group.agents.length,words);container.box.querySelector('.eq-conversation-heading').hidden=home;
      controller.rows??=new Map();const orderedRows=stableOrder(controller.rows.get(group.id)||[],group.agents);if(home)orderedRows.sort((a,b)=>Number(b.currentDelivery?.known===true)-Number(a.currentDelivery?.known===true)||Number(a.state==='done')-Number(b.state==='done')||Number(a.state==='waiting'||a.state==='registered')-Number(b.state==='waiting'||b.state==='registered'));controller.rows.set(group.id,orderedRows.map(agent=>agent.id));
      for(const [agentIndex,agent]of orderedRows.entries()){let node=controller.nodes.get(agent.id);if(!node){node=createAgent(controller,agent);controller.nodes.set(agent.id,node);}if(container.agents.children[agentIndex]!==node.button)container.agents.insertBefore(node.button,container.agents.children[agentIndex]||null);
        const family=String(agent.family||'').toLowerCase()==='claude'?'claude':'codex',old=controller.previous.get(agent.id),item=agent.currentItemId||agent.taskId||null;
        const cardName=cardNames.get(agent.id)||displayName(agent,lang),delivered=homeDelivered(agent,lang);
        node.button.className='eq-agent eq-'+family+' eq-'+agent.state;node.name.textContent=cardName;node.action.textContent=taskLabel(agent,lang);node.state.textContent=words[agent.state]||words.unknown;const image=imageOf(agent);if(node.requestedImage!==image){node.requestedImage=image;node.image.src=image;}node.family.textContent=family==='claude'?'C':'X';const timing=deliveryLabel(agent.delivery,lang);node.eta.replaceChildren(node.dot,document.createTextNode(delivered||(agent.delivery?.etaAt?timing.eta+(timing.tone==='late'?' · '+({pt:'atrasada',en:'overdue',es:'atrasada'}[lang]):''):'')));node.dot.dataset.tone=delivered?'done':timing.tone;node.eta.hidden=!(delivered||agent.delivery?.etaAt||agent.delivery?.deadlineAt);node.agente.textContent=agent.agente?.verified&&agent.agente.id?'Agente #'+agent.agente.id:'';node.agente.hidden=true;
        node.button.title=cardName+' · '+taskLabel(agent,lang)+' · '+node.state.textContent;if(delivered)node.button.title+=' · '+delivered;else if(agent.currentDelivery?.known!==false)node.button.title+=' · '+timing.eta+' · '+timing.badge+' · '+forecastTip(agent.delivery,lang);node.button.setAttribute('aria-label',node.button.title+(node.agente.textContent?' · '+node.agente.textContent:''));node.image.alt=node.agente.textContent||'Agente';
        const identityChanged=old&&old.paper!==agent.identity?.paper;const change=old&&(old.state!==agent.state||item&&item!==old.item||agent.state==='walking'&&old.lastAt!==agent.lastAt),reduced=scope.document?.documentElement?.dataset.motion==='off'||scope.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
        if(animate&&identityChanged&&!reduced&&!document.hidden){node.name.animate([{opacity:.25,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'ease-out'});}if(animate&&change&&!reduced&&!document.hidden){node.motion?.cancel();if(agent.state==='done')node.motion=node.avatar.animate([{transform:'translateY(0)'},{transform:'translateY(-12px)',offset:.45},{transform:'translateY(0)'}],{duration:650,easing:'cubic-bezier(.22,1,.36,1)'});else if(agent.state==='walking'||item&&item!==old.item)node.motion=node.art.animate([{transform:'translateX(-26px)',opacity:.6},{transform:'translateX(0)',opacity:1}],{duration:700,easing:'cubic-bezier(.22,1,.36,1)'});}
        controller.previous.set(agent.id,{state:agent.state,item,lastAt:agent.lastAt,paper:agent.identity?.paper});
      }
    }
    if(!stableAgents.length){controller.empty??=el('p','eq-empty');controller.empty.textContent=view.agents.length?({pt:'A equipe aguarda o próximo trabalho',en:'The team awaits the next task',es:'El equipo espera el próximo trabajo'}[lang]):words.none;controller.stage.append(controller.empty);}else controller.empty?.remove();
    controller.consTitle.textContent=words.consumption;controller.tokens.textContent=finite(view.tokens)?(view.tokensExact?'':'≥ ')+compact(view.tokens,lang):frescorDe(view)?'?':({pt:'Este projeto ainda não tem consumo registrado',en:'No usage recorded for this project yet',es:'Este proyecto aún no tiene consumo registrado'}[lang]);controller.tokens.style.fontSize=finite(view.tokens)?'':'16px';controller.tokensLabel.hidden=!finite(view.tokens)&&!frescorDe(view);controller.tokensLabel.textContent=frescorDe(view)?(frescorDe(view).motivo||'sem medida')+'. Solução: '+frescorDe(view).solucao:(consumoLabel(view,lang)||words.tokens);paintSplit(controller,view,lang);
    controller.water.textContent=finite(view.waterMl)?'~'+new Intl.NumberFormat(lang,{maximumFractionDigits:view.waterMl>=100000?0:1}).format(view.waterMl>=1000?view.waterMl/1000:view.waterMl)+(view.waterMl>=1000?' L':' ml'):words.unmeasured;controller.water.hidden=controller.waterLabel.hidden=!finite(view.waterMl);const waterInfo=consumoOf(view)?.agua;controller.waterLabel.textContent=waterInfo?.rotulo?.[lang]||words.water;{const tldr={pt:'Cada copo = 250 ml de água que o uso de IA da equipe gasta, em conta aproximada; não é medido.',en:'Each cup = 250 ml of water the team\u2019s AI use takes, as a rough estimate; it is not measured.',es:'Cada vaso = 250 ml de agua que gasta el uso de IA del equipo, en cuenta aproximada; no se mide.'}[lang]||'',how={pt:'Como calculamos',en:'How we estimate',es:'Cómo calculamos'}[lang]||'Como calculamos';controller.tip.textContent=tldr;controller.tldr.textContent=tldr;controller.moreSum.textContent=how;controller.moreText.textContent=waterInfo?.dica?.[lang]||words.formula;controller.info.setAttribute('aria-label',tldr+' '+how);}
    const levels=cupLevels(view.waterMl),key=JSON.stringify(levels);if(key!==controller.cupKey){controller.cupKey=key;controller.cups.replaceChildren();for(const [index,level]of levels.levels.entries())controller.cups.append(drawCup(level,controller.id+'-'+index));if(levels.extra)controller.cups.append(el('span','eq-extra-cups',({pt:'E outros copos',en:'And more cups',es:'Y otros vasos'}[lang])));}
    controller.cupCount.hidden=true;controller.cupCount.textContent=levels.total!==null?new Intl.NumberFormat(lang,{maximumFractionDigits:1}).format(levels.total)+' '+words.cups:words.unmeasured;
    if(controller.details)paintDetails(controller);
  }
  function render(snapshot,host,options={}){if(!host)return;if(typeof options==='string')options={lang:options};const controller=instances.get(host)||create(host);controller.snapshot=snapshot||{};controller.options=options;paint(controller,Boolean(controller.view));}
  function destroy(host){const controller=instances.get(host);if(controller){clearInterval(controller.timer);document.removeEventListener('visibilitychange',controller.visibility);for(const node of controller.nodes.values())node.motion?.cancel();controller.dialog?.remove();instances.delete(host);}}
  // Expanded conversation cards are enabled only for the following 26f delivery.
  function enableDetails(host,enabled=true){const controller=instances.get(host);if(controller){controller.details=enabled;if(!enabled)controller.detailSection?.remove();else paintDetails(controller);}}
  function timeLabel(value,lang){return date(value)!==null?new Intl.DateTimeFormat(lang,{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo',hourCycle:'h23'}).format(new Date(value)):({pt:'Não registrado',en:'Not recorded',es:'Sin registro'}[lang]||'Not recorded');}
  function tokenLabel(agent,lang){return (finite(agent.tokens)&&agent.tokensExact===false?'≥ ':'')+compact(agent.tokens,lang);}
  function activityLabel(agent,words,now=Date.now()) {const last=date(agent.lastAt);return ['sleeping','unknown'].includes(agent.state)&&last!==null?words.idle+' '+Math.max(0,Math.floor((now-last)/60000))+' '+words.minutes:words[agent.state]||words.unknown;}
  function toolsOf(agent){return Array.isArray(agent.tools)?agent.tools.filter(tool=>tool&&typeof tool.name==='string'):[];}
  function agentCard(controller,agent){
    const {words,lang}=controller,card=el('article','eq-detail-card eq-'+(agent.family==='claude'?'claude':'codex')),head=el('div','eq-detail-head'),image=el('img'),name=el('strong',undefined,displayName(agent,lang)),state=el('span','eq-detail-status '+(['working','walking'].includes(agent.state)?'is-active':''),activityLabel(agent,words));image.src=imageOf(agent);image.alt='';image.width=34;image.height=34;head.append(image,name,state);card.append(head);
    card.append(el('p','eq-detail-action',taskLabel(agent,lang)));
    const meta=el('p','eq-detail-meta',(agent.model||'?')+' · '+words.effort.toLowerCase()+' '+(agent.effort||'?'));card.append(meta);
    const numbers=el('div','eq-detail-numbers');numbers.append(el('span',undefined,tokenLabel(agent,lang)+' tokens'),el('span',undefined,words.since+' '+timeLabel(agent.startedAt,lang)));card.append(numbers);
    const chips=el('div','eq-detail-chips');for(const skill of agent.skills||[])chips.append(el('span','eq-skill-chip',String(skill)));for(const tool of toolsOf(agent).slice(0,5))chips.append(el('span',undefined,toolLabel(tool,agent,lang)));if(!chips.childElementCount)chips.append(el('span','eq-no-meta',words.noTools));card.append(chips);
    const button=el('button','eq-detail-open',words.details+' ↗');button.type='button';button.addEventListener('click',()=>showAgent(controller,agent));card.append(button);return card;
  }
  function paintDetails(controller){
    const {view,words,lang}=controller;
    if(!controller.progressSection){const section=el('section','eq-progress'),heading=el('div','eq-progress-heading'),left=el('div'),title=el('h3'),percent=el('strong'),right=el('div','eq-progress-eta'),eta=el('strong'),etaLabel=el('span'),bar=el('div','eq-progress-bar'),fill=el('i'),note=el('p','eq-progress-note'),deliveries=el('div','eq-deliveries');left.append(title,percent);right.append(eta,etaLabel);heading.append(left,right);bar.append(fill);section.append(heading,bar,note,deliveries);controller.host.insertBefore(section,controller.stage);Object.assign(controller,{progressSection:section,progressTitle:title,progressPercent:percent,progressEta:eta,progressEtaLabel:etaLabel,progressBar:bar,progressFill:fill,progressNote:note,deliveries});}
    const progress=progressOf(view.source.progress||{deliveries:view.source.deliveries,startedAt:view.source.startedAt},view.now);controller.progressTitle.textContent=words.progress;controller.progressPercent.textContent=progress.percent!==null?progress.percent+'%':'?';controller.progressEta.textContent=progress.eta?timeLabel(progress.eta,lang):'?';controller.progressEtaLabel.textContent=words.estimate;controller.progressBar.hidden=progress.percent===null;controller.progressFill.style.transform='scaleX('+(progress.percent!==null?progress.percent/100:0)+')';controller.progressNote.textContent=progress.total!==null?progress.done+' / '+progress.total+' '+words.deliveries:words.unmeasured;
    controller.deliveries.replaceChildren();for(const delivery of progress.deliveries){const row=el('div','eq-delivery'+(delivery.done===true||delivery.state==='done'?' is-done':''));row.append(el('i',undefined,delivery.done===true||delivery.state==='done'?'✓':''),el('span',undefined,delivery.title||delivery.name||'?'));controller.deliveries.append(row);}
    if(!controller.detailSection){controller.detailSection=el('section','eq-team-details');controller.host.append(controller.detailSection);}controller.detailSection.replaceChildren();
    const week=view.source.weekPercent??view.source.weekPct??view.source.semanaPct;
    const guardian=view.source.guardianCount??view.source.guardian,guardianLabel=(finite(guardian)&&view.source.guardianExact===false?'≥ ':'')+compact(guardian,lang);
    const stats=el('div','eq-team-stats');for(const [value,label]of [[(view.active??'?')+' / '+(view.total??'?'),words.agents],[finite(week)?week+'%':'?',words.week],[guardianLabel,words.guardian]]){const stat=el('div');stat.append(el('strong',undefined,value),el('span',undefined,label));stats.append(stat);}controller.detailSection.append(stats);
    for(const group of view.groups){const section=el('section','eq-details-conversation'),head=el('div','eq-details-heading');head.append(el('h3',undefined,groupTitle(group,lang)),el('span',undefined,agentCount(group.agents.length,words)));const cards=el('div','eq-detail-grid');for(const agent of group.agents)cards.append(agentCard(controller,agent));section.append(head,cards);controller.detailSection.append(section);}
  }
  function showAgent(controller,agent){
    const {words,lang}=controller;if(!controller.dialog){const dialog=el('dialog','eq-dialog'),head=el('div','eq-dialog-head'),title=el('h2'),close=el('button',undefined,'×'),body=el('div','eq-dialog-body');close.type='button';close.setAttribute('aria-label','Close');close.addEventListener('click',()=>dialog.close());dialog.addEventListener('keydown',event=>{if(event.key==='Tab'){event.preventDefault();close.focus();}});title.id=controller.id+'-agent';dialog.setAttribute('aria-labelledby',title.id);head.append(title,close);dialog.append(head,body);document.body.append(dialog);Object.assign(controller,{dialog,dialogTitle:title,dialogBody:body});}
    controller.dialog.querySelector('.eq-dialog-head button').setAttribute('aria-label',({pt:'Fechar',en:'Close',es:'Cerrar'}[lang]));controller.dialogTitle.textContent=agent.cardName||controller.options.mode==='home'&&controller.homeNames?.get(agent.id)||displayName(agent,lang);const body=controller.dialogBody;body.replaceChildren();body.append(el('p','eq-dialog-action',taskLabel(agent,lang)));
    const human=scope.PainelLinguagem,missing=value=>!value||value==='?'||value==='Não medido';
    const facts=[[words.conversation,human?.title(agent.conversationLabels?.[lang]||agent.conversation,lang)],[words.project,human?.title(agent.project||agent.projectName,lang)],[words.model,human?.model(agent.model)],[words.effort,human?.effort(agent.effort,lang)],['Tokens',finite(agent.tokens)?tokenLabel(agent,lang):null],[words.since,human?.relative(agent.startedAt,lang)],[words.now,human?.relative(agent.lastAt,lang)],[( {pt:'Entrega',en:'Delivery',es:'Entrega'}[lang]),agent.delivery?.etaAt||agent.delivery?.completedAt?deliveryLabel(agent.delivery,lang).eta:null]];
    const meta=el('dl','eq-agent-facts');for(const [label,value]of facts){if(missing(value))continue;meta.append(el('dt',undefined,label),el('dd',undefined,human?.text(value,lang)||value));}body.append(meta);
    const tools=toolsOf(agent).slice(0,3);if(tools.length){const block=el('section','eq-dialog-list');block.append(el('h3',undefined,words.tools));for(const tool of tools){const value=localizedTool(tool,lang),count=finite(tool.count)?' '+(tool.exact===false?'≥ ':'')+tool.count:'';block.append(el('p',undefined,value+count));}body.append(block);}
    const skills=(agent.skills||[]).slice(0,3);if(skills.length){const block=el('section','eq-dialog-list');block.append(el('h3',undefined,words.skills));for(const skill of skills)block.append(el('p',undefined,human?.text(skill,lang)||skill));body.append(block);}
    if(agent.agente?.verified&&agent.agente.id)controller.dialogTitle.title='Agente #'+agent.agente.id;
    if(agent.model)meta.title=agent.model;
    if(!controller.dialog.open)controller.dialog.showModal();
  }
  const api={render,openAgent(agent,host){const c=instances.get(host);if(c)showAgent(c,agent);},destroy,enableDetails,normalize,stateOf,short,compact,deliveryLabel,imageOf,cupLevels,progressOf,toolLabel,displayName,taskLabel,groupTitle,homeAgents,homeFronts,homeNames,homeDelivered,teamFronts,nameRole,distinctNames,cardTime,portraitPool,distinctPortraits,activeAgent,stableOrder,forecastTip,SLEEP_AFTER};if(typeof module!=='undefined'&&module.exports)module.exports=api;if(scope)scope.PainelEquipe=api;
})(typeof window!=='undefined'?window:globalThis);

/* detalhes.js */
'use strict';
(function(root){
 const human=typeof module==='object'&&module.exports?require('./linguagem.js'):root.PainelLinguagem;
 const words={pt:{who:'Quem faz',state:'Situação',since:'Atualizado',progress:'Concluído',deadline:'Entrega',next:'Próximo passo',waiting:'Espera sua decisão'},en:{who:'Agent',state:'Status',since:'Updated',progress:'Complete',deadline:'Delivery',next:'Next step',waiting:'Waiting for your decision'},es:{who:'Agente',state:'Estado',since:'Actualizado',progress:'Completado',deadline:'Entrega',next:'Próximo paso',waiting:'Espera tu decisión'}};
 function clean(value){return String(value||'').replace(/[\u2013\u2014]/g,',').trim();}
 function titleOf(item,lang='pt'){return human.title(item.shortTitle||item.title||'Trabalho do projeto',lang).split(/\s*\(/)[0];}
 function summaryOf(item,lang='pt'){const body=clean(item.details||item.log||item.body||item.detail),explicit=clean(item.summary||item.resumo||(body.match(/^\s*(?:[-*]\s*)?RESUMO:\s*(.+)$/im)||[])[1]);return human.text(explicit||titleOf(item,lang),lang).split(/\s+/).slice(0,25).join(' ');}
 function explicitNext(item){const body=clean(item.details||item.log||item.body);return clean(item.nextStep||(body.match(/^\s*(?:[-*]\s*)?(?:PR[ÓO]XIMO PASSO|NEXT STEP|PROXIMO):\s*(.+)$/im)||[])[1]);}
 function open(item,options){const lang=options.lang||'pt',w=words[lang]||words.pt,doc=root.document,el=(tag,text,cls)=>{const n=doc.createElement(tag);n.textContent=human.teamText(text,lang);if(cls)n.className=cls;return n;},nodes=[el('p',summaryOf(item,lang),'detail-summary')],chips=el('div','','detail-chips');
 const states={feito:{pt:'Entregue',en:'Delivered',es:'Entregado'},andando:{pt:'Trabalhando',en:'Working',es:'Trabajando'},adiada:{pt:'Parado',en:'Paused',es:'Parado'},novo:{pt:'Na fila',en:'Queued',es:'En cola'},needs:{pt:'Precisa de você',en:'Needs you',es:'Te necesita'}};
 const state=states[item.phase?.key]?.[lang]||item.phase?.label||item.status||item.state;
 const facts=[[w.who,item.actor||item.executor||item.owner],[w.state,state],[w.since,human.relative(item.lastChangeAt||item.lastLogAt||item.startedAt,lang)],[w.progress,Number.isFinite(item.percent??item.phase?.percent)?(item.percent??item.phase.percent)+'%':null],[w.deadline,item.deadline||item.deadlineAt]];
 for(const [label,value]of facts){if(!value||value==='?')continue;const chip=el('span','','detail-chip');chip.append(el('small',label),el('b',value));chips.append(chip);}nodes.push(chips);
 const clarity=typeof module==='object'&&module.exports?require('./clareza.js'):root.PainelClareza,scope=clarity?.approvalScope(item,lang),conversation=human.conversation(item.replySession||/chat (?:da|do)\s+(\w+)/i.exec(item.replyWhere||'')?.[1],lang);
 if(scope){const section=el('section','','detail-scope');section.append(el('h3',({pt:'O que entra neste pacote',en:'What this package includes',es:'Qué incluye este paquete'}[lang])));const parts=el('ul','','detail-scope-parts');for(const part of scope.parts)parts.append(el('li',part.label));section.append(parts);if(scope.excluded)section.append(el('p','Termos fora deste pacote: '+scope.excluded+'.','detail-scope-excluded'));nodes.push(section);}
 if(Array.isArray(item.opcoes)&&item.opcoes.length){const list=el('ul','','detail-choices');for(const option of item.opcoes.slice().sort((a,b)=>Number(Boolean(b.recommended))-Number(Boolean(a.recommended)))){const row=el('li','','detail-choice'+(option.recommended?' is-recommended':'')),choosePart=/^sobe sem X$/i.test(option.label),postpone=scope&&/^amanh[aã]$/i.test(option.label),publish=scope&&/^sobe$/i.test(option.label);row.append(el('strong',choosePart?({pt:'Escolher uma parte para retirar',en:'Choose one part to remove',es:'Elegir una parte para retirar'}[lang]):postpone?({pt:'Pedir a publicação amanhã',en:'Request publication tomorrow',es:'Pedir la publicación mañana'}[lang]):publish?({pt:'Publicar as partes acima',en:'Publish the parts above',es:'Publicar las partes anteriores'}[lang]):option.label));if(option.recommended)row.append(el('span',({pt:'RECOMENDADA',en:'RECOMMENDED',es:'RECOMENDADA'}[lang]),'detail-recommended'));if(choosePart)row.append(el('p',({pt:'Na conversa de ',en:'In the ',es:'En la conversación de '}[lang])+(conversation||'equipe')+({pt:', diga qual parte da lista deve ficar fora antes de publicar.',en:' conversation, name the listed part to leave out before publishing.',es:', indica qué parte de la lista dejar fuera antes de publicar.'}[lang])));else if(postpone)row.append(el('p',scope.defer));else if(option.descricao)row.append(el('p',option.descricao.replace(/recomendada[:,]?\s*/i,'').replace(/na [aá]rvore montada/i,'na versão final')));list.append(row);}nodes.push(list);}if(item.replyWhere)nodes.push(el('p',({pt:'Responda na conversa de ',en:'Reply in the conversation for ',es:'Responde en la conversación de '}[lang])+(conversation||({pt:'sua equipe',en:'your team',es:'tu equipo'}[lang])),'detail-reply'));
 const next=item.replyWhere?'':explicitNext(item);if(next)nodes.push(el('p',w.next+': '+next,'detail-next'));const blocked=clean(item.blockedReason||item.waiting||item.blocker||(item.needsOwner?w.waiting:''));if(blocked)nodes.push(el('p',blocked,'detail-blocked'));options.drawer(titleOf(item,lang),nodes);
 }
 const api={summaryOf,titleOf,explicitNext,open};if(typeof module==='object'&&module.exports)module.exports=api;else root.PainelDetalhes=api;
})(typeof window==='object'?window:globalThis);

/* projetos.js */
'use strict';
(function(root){
  let selected='';
  const words={pt:{title:'PROJETOS',all:'Todos',tokens:'tokens hoje',agents:'agentes ativos',last:'Última atividade',empty:'Sem atividade registrada'},en:{title:'PROJECTS',all:'All',tokens:'tokens today',agents:'active agents',last:'Last activity',empty:'No recorded activity'},es:{title:'PROYECTOS',all:'Todos',tokens:'tokens hoy',agents:'agentes activos',last:'Última actividad',empty:'Sin actividad registrada'}};
  function rowsOf(snapshot){const value=snapshot.projects||snapshot.projetos;return Array.isArray(value)?value:Array.isArray(value?.items)?value.items:Array.isArray(value?.projetos)?value.projetos:[];}
  function same(item,id){return (item.projectId||item.project?.id||'app')===id;}
  function sumKnown(list,key){return list.some(x=>Number.isFinite(x[key]))?list.reduce((n,x)=>n+(Number.isFinite(x[key])?x[key]:0),0):null;}
  function todayTokens(row){return Object.hasOwn(row,'todayTokens')?row.todayTokens:Object.hasOwn(row,'tokensToday')?row.tokensToday:null;}
  function filterSnapshot(snapshot,id=selected){
    if(!snapshot||!id)return snapshot;
    const out={...snapshot,selectedProject:id};
    const home=rowsOf(snapshot).find(x=>String(x.name||x.nome).toLowerCase()==='painel')?.id||'app';
    if(id!==home){out.live='';out.codex='';out.decisions=[];out.states=[];}out.deadlines=(snapshot.deadlines||[]).filter(x=>same(x,id));
    for(const key of ['tasks','pipelineItems','nextItems','readyBranches','stalledTasks','cards','needsItems','needsAll','needsDeferred','projectOpenQuestions'])if(Array.isArray(snapshot[key]))out[key]=snapshot[key].filter(x=>same(x,id));
    if(snapshot.feeds)out.feeds=Object.fromEntries(Object.entries(snapshot.feeds).map(([key,list])=>[key,list.filter(x=>same(x,id))]));
    if(snapshot.equipe){const agents=(snapshot.equipe.agents||[]).filter(x=>same(x,id));out.equipe={...snapshot.equipe,agents,groups:(snapshot.equipe.groups||[]).filter(x=>same(x,id)),projects:(snapshot.equipe.projects||[]).filter(x=>x.id===id),total:agents.length,active:agents.filter(x=>['working','walking'].includes(x.state)).length,tokens:sumKnown(agents,'tokens'),weightedTokens:sumKnown(agents,'weightedTokens')};const retained=snapshot.equipe.consumptionByProject?.[id];if(retained){out.equipe.tokens=retained.tokens;out.equipe.weightedTokens=retained.weightedTokens;}out.equipe.waterMl=Number.isFinite(retained?.waterMl)?retained.waterMl:Number.isFinite(out.equipe.weightedTokens)?Math.round(out.equipe.weightedTokens/1500*.3):null;}
    if(snapshot.operator){const agents=out.equipe?.agents||[],owners=new Set(agents.map(a=>a.ownerSession).filter(Boolean));out.operator={...snapshot.operator,sessions:(snapshot.operator.sessions||[]).filter(session=>id===home||same(session.node||{},id)||owners.has(session.id)).map(session=>id===home||same(session.node||{},id)?session:{...session,summary:{fields:{},available:false},needsOperator:false}),codex:(snapshot.operator.codex||[]).filter(row=>same(row,id))};}
    if(snapshot.launches){const items=(snapshot.launches.items||[]).filter(x=>same(x,id));out.launches={...snapshot.launches,items,nextHard:items.filter(x=>x.prazo_duro).sort((a,b)=>String(a.deadlineAt||a.dia).localeCompare(String(b.deadlineAt||b.dia)))[0]||null};}
    if(out.equipe&&snapshot.equipe?.progress){const progress=snapshot.equipe.progress;out.equipe.progress={...progress,deliveries:(progress.deliveries||[]).filter(x=>same(x,id)),startedAt:id===home?progress.startedAt:null};}
    const items=out.pipelineItems||[],known=items.filter(x=>Number.isFinite(x.percent));out.progress={total:items.length,known:known.length,percent:known.length?known.reduce((n,x)=>n+x.percent,0)/known.length:null};
    out.needsTotal=(out.needsAll||out.needsItems||[]).length;out.needsCount=snapshot.ownerDecisionSource?out.needsTotal:(out.cards||[]).filter(x=>!x.exemplo).length+out.needsTotal;
    if(snapshot.management){const started=items.filter(x=>Number.isFinite(x.percent)&&x.percent>0&&x.percent<100).length,finished=items.filter(x=>x.percent===100).length;out.management={...snapshot.management,waiting:{count:out.needsCount,oldestAt:(out.cards||[]).map(x=>x.criado||x.createdAt).filter(Boolean).sort()[0]||null},flow:{started,finished,readyBranches:(out.readyBranches||[]).length,stalledTasks:(out.stalledTasks||[]).length,alert:started-finished>5},week:same(snapshot.management.week||{},id)?snapshot.management.week:null,money:same(snapshot.management.money||{},id)?snapshot.management.money:null};}
    if(out.management&&id===home)out.management.waiting.oldestAt=snapshot.management.waiting?.oldestAt||out.management.waiting.oldestAt;
    return out;
  }
  function render(snapshot,host,options){
    if(!host)return;const doc=root.document,w=words[options.lang]||words.en,rows=rowsOf(snapshot);if(selected&&!rows.some(x=>(x.id||x.projectId)===selected))selected='';
    const el=(tag,text,cls)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};host.replaceChildren();host.append(el('h2',w.title,'eyebrow'));const grid=el('div',undefined,'project-list');
    const all=el('button',w.all,'project-all');all.type='button';all.setAttribute('aria-pressed',String(!selected));all.addEventListener('click',()=>{selected='';options.onSelect();});grid.append(all);
    for(const row of rows){const id=row.id||row.projectId;if(!id)continue;const agents=(snapshot.equipe?.agents||[]).filter(x=>same(x,id));const button=el('button',undefined,'project-card');button.type='button';button.style.setProperty('--project-color',/^#[\da-f]{6}$/i.test(row.color||row.cor)?row.color||row.cor:'#ff2e7e');button.dataset.project=id;button.setAttribute('aria-pressed',String(selected===id));button.append(el('strong',root.PainelLinguagem?.title(row.name||row.nome||id,options.lang)||row.name||row.nome||id));const active=agents.filter(x=>['working','walking'].includes(x.state)),count=el('span',active.length+' '+w.agents,'project-fact'),avatars=el('span',undefined,'project-avatars');for(const agent of active.slice(0,4)){if(agent.agente?.image){const img=doc.createElement('img');img.src=agent.agente.image;img.alt=agent.agente?.verified&&agent.agente.id?'Agente #'+agent.agente.id:'Agente';avatars.append(img);}else avatars.append(el('i','','project-dot '+agent.family));}count.append(avatars);button.append(count);const tokens=todayTokens(row);button.append(el('span',(Number.isFinite(tokens)?(row.tokensExact===false?'≥ ':'')+new Intl.NumberFormat(options.lang).format(tokens):'?')+' '+w.tokens,'project-fact'));if(row.lastAt||row.lastActivity)button.append(el('small',w.last+' '+options.brt(row.lastAt||row.lastActivity)));if(Number.isFinite(row.percent??row.progress?.percent))button.append(el('span',Math.round(row.percent??row.progress.percent)+'%','project-progress'));button.addEventListener('click',()=>{selected=id;options.onSelect();});grid.append(button);}host.append(grid);
  }
  const api={rowsOf,todayTokens,filterSnapshot,render,get selected(){return selected;},select(id){selected=String(id||'');}};if(typeof module==='object'&&module.exports)module.exports=api;else root.PainelProjetos=api;
})(typeof window==='object'?window:globalThis);

/* tips.js */
﻿'use strict';
(function(root) {
  const XP = Object.freeze({ comum: 10, rara: 25, epica: 50, lendaria: 100 });
  const STORE = 'painel-feed-public-v1', SOUND = 'painel-feed-muted-v1', LIMIT = 500, ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
  const controllers = new WeakMap();
  const words = {
    en: { title:'Feed your AI',level:'Level',hunger:'Hunger',hungry:'Your Agente is ready for a prompt',full:'Your Agente is well fed',streak:'day streak',collection:'Collection',feed:'Feed & copy',copyAgain:'Copy again',ready:'Copied. Paste it into your AI.',empty:'No prompts available yet',locked:'Unlocks at level',agente:'Your Agente',soundOn:'Sound on',soundOff:'Muted',copyError:'Could not copy. Select the prompt and copy it.',saveError:'Copied. Points could not be saved. Try again.',offline:'Local connection unavailable. The prompt is ready to copy.',saving:'Feeding...',fed:'Fed today',limit:'Daily XP reached. Come back tomorrow.',real:'Your AI ate it',example:'Practice mode. Copies prompts without saving points.',next:'To the next level',local:'Saved on this device',rarity:{comum:'Common',rara:'Rare',epica:'Epic',lendaria:'Legendary'} },
    pt: { title:'Alimente sua IA',level:'Nível',hunger:'Fome',hungry:'Seu Agente está pronto para um prompt',full:'Seu Agente está bem alimentado',streak:'dias seguidos',collection:'Coleção',feed:'Alimentar e copiar',copyAgain:'Copiar de novo',ready:'Copiado. Cole na sua IA.',empty:'Nenhum prompt disponível ainda',locked:'Libera no nível',agente:'Seu Agente',soundOn:'Som ligado',soundOff:'Mudo',copyError:'Não foi possível copiar. Selecione o prompt e copie.',saveError:'Copiado. Os pontos não foram salvos. Tente de novo.',offline:'Conexão local indisponível. O prompt está pronto para copiar.',saving:'Alimentando...',fed:'Alimentado hoje',limit:'XP diário completo. Volte amanhã.',real:'Sua IA comeu mesmo',example:'Modo de prática. Copia prompts sem salvar pontos.',next:'Para o próximo nível',local:'Salvo neste dispositivo',rarity:{comum:'Comum',rara:'Rara',epica:'Épica',lendaria:'Lendária'} },
    es: { title:'Alimenta tu IA',level:'Nivel',hunger:'Hambre',hungry:'Tu Agente está listo para un prompt',full:'Tu Agente está bien alimentado',streak:'días seguidos',collection:'Colección',feed:'Alimentar y copiar',copyAgain:'Copiar de nuevo',ready:'Copiado. Pégalo en tu IA.',empty:'Todavía no hay prompts disponibles',locked:'Disponible en el nivel',agente:'Tu Agente',soundOn:'Sonido activo',soundOff:'Silenciado',copyError:'No se pudo copiar. Selecciona el prompt y cópialo.',saveError:'Copiado. No se guardaron los puntos. Inténtalo de nuevo.',offline:'Conexión local no disponible. El prompt está listo para copiar.',saving:'Alimentando...',fed:'Alimentado hoy',limit:'XP diario completo. Vuelve mañana.',real:'Tu IA sí comió',example:'Modo de práctica. Copia prompts sin guardar puntos.',next:'Para el próximo nivel',local:'Guardado en este dispositivo',english:'Prompt en inglés',rarity:{comum:'Común',rara:'Rara',epica:'Épica',lendaria:'Legendaria'} }
  };
  const finite = (value, fallback=0) => Number.isFinite(value) && value>=0 ? Math.min(1e9,Math.floor(value)) : fallback;
  const localeOf = value => /^pt/i.test(value)?'pt':/^es/i.test(value)?'es':'en';
  function tipsOf(snapshot) {
    const raw = snapshot?.feeding?.tips || snapshot?.iaTips?.dicas || snapshot?.tips?.items || snapshot?.tips || snapshot?.iaTips;
    const seen=new Set();
    return (Array.isArray(raw)?raw:[]).filter(tip=>{if(!tip||!ID.test(tip.id||'')||!Object.hasOwn(XP,tip.raridade)||seen.has(tip.id))return false;seen.add(tip.id);return true;}).slice(0,100).map(tip=>({...tip,xp:XP[tip.raridade],unlockLevel:tip.raridade==='lendaria'?5:1}));
  }
  function textOf(tip,lang) { const value=tip?.[localeOf(lang)==='pt'?'pt':'en'];return typeof value==='string'?value:typeof value?.colar==='string'?value.colar:''; }
  function titleOf(tip,lang) { const value=tip?.[localeOf(lang)==='pt'?'pt':'en'];return typeof value?.titulo==='string'?value.titulo:tip.id; }
  function modelOf(snapshot) {
    const feed=snapshot?.feeding||{},xp=finite(feed.xp),level=finite(feed.level,Math.floor(xp/100)+1)||1;
    const tips=tipsOf(snapshot).map(tip=>({...tip,locked:tip.locked===true||level<tip.unlockLevel}));
    return {xp,level,levelXp:Math.min(99,finite(feed.levelXp,xp%100)),nextLevelXp:100,hunger:Math.min(100,finite(feed.hunger)),streak:finite(feed.streak),collected:(Array.isArray(feed.collected)?feed.collected:[]).filter(id=>tips.some(t=>t.id===id)),collectionTotal:finite(feed.collectionTotal,tips.length||14),tips};
  }
  const dayOf=now=>now.toISOString().slice(0,10);
  function validDay(value,now) { if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const n=Date.parse(value+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===value&&value<=dayOf(now); }
  // Stored XP, unknown cards, duplicate claims and future dates are not trusted.
  function publicModel(snapshot,saved,now=new Date()) {
    const tips=tipsOf(snapshot).map(tip=>({...tip,locked:false})),byId=new Map(tips.map(tip=>[tip.id,tip])),days={};let earned=0;
    for(const date of Object.keys(saved?.days||{}).filter(day=>validDay(day,now)).sort().slice(-400)) {
      const ids=Array.isArray(saved.days[date])?saved.days[date]:[];let daily=0;
      for(const id of [...new Set(ids.slice(0,100))]){const tip=byId.get(id);if(!tip||daily+tip.xp>LIMIT||tip.unlockLevel>Math.floor(earned/100)+1)continue;(days[date]||=[]).push(id);daily+=tip.xp;earned+=tip.xp;}
    }
    const today=dayOf(now),collected=[...new Set(Object.values(days).flat())],xp=Object.values(days).flat().reduce((sum,id)=>sum+byId.get(id).xp,0);
    let streak=0,cursor=new Date(today+'T00:00:00Z');if(!days[today]?.length)cursor.setUTCDate(cursor.getUTCDate()-1);
    while(days[dayOf(cursor)]?.length&&streak<400){streak++;cursor.setUTCDate(cursor.getUTCDate()-1);}
    const model=modelOf({feeding:{tips,xp,level:Math.floor(xp/100)+1,levelXp:xp%100,collected,collectionTotal:tips.length,streak,hunger:days[today]?.length?100:streak?50:0}});
    model.tips=model.tips.map(tip=>({...tip,fedToday:!!days[today]?.includes(tip.id),eatenForReal:false}));
    return {model,saved:{days},dailyXp:(days[today]||[]).reduce((sum,id)=>sum+byId.get(id).xp,0)};
  }
  function publicFeed(snapshot,saved,id,now=new Date()) {
    const current=publicModel(snapshot,saved,now),tip=current.model.tips.find(item=>item.id===id);
    if(!tip||tip.locked)return {...current,gained:0,reason:'locked'};
    if(tip.fedToday)return {...current,gained:0,reason:'already-fed-today'};
    if(current.dailyXp+tip.xp>LIMIT)return {...current,gained:0,reason:'daily-limit'};
    (current.saved.days[dayOf(now)]||=[]).push(id);return {...publicModel(snapshot,current.saved,now),gained:tip.xp,reason:'fed'};
  }
  function readMuted(storage){try{return storage?.getItem(SOUND)==='1';}catch{return false;}}
  function saveMuted(storage,muted){try{storage?.setItem(SOUND,muted?'1':'0');}catch{}}
  let audio,audioGesture=false;
  function resumeAudio(){audioGesture=true;try{const Audio=root.AudioContext||root.webkitAudioContext;if(Audio){audio||=new Audio();audio.resume?.();}}catch{}}
  function playSound(levelUp,realBonus=false){
    if(!audio||!audioGesture||audio.state&&audio.state!=='running')return;try{const at=audio.currentTime,gain=audio.createGain();gain.connect(audio.destination);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(realBonus ? .018 : .025,at+.015);gain.gain.exponentialRampToValueAtTime(.0001,at+(realBonus ? .36 : .28));
      for(const [index,hz]of(realBonus?[330,495,660]:levelUp?[440,660,880]:[210,285]).entries()){const oscillator=audio.createOscillator();oscillator.type='sine';oscillator.frequency.setValueAtTime(hz,at+index*.06);oscillator.connect(gain);oscillator.start(at+index*.06);oscillator.stop(at+(realBonus ? .37 : .29));}
    }catch{}
  }
  function realBonusOf(before,after,snapshot,seen=new Set()){
    if(!before||snapshot?.public===true||snapshot?.example===true)return null;
    const previous=new Map(before.tips.map(tip=>[tip.id,tip])),ids=[];let gained=0;
    for(const tip of after.tips){const old=previous.get(tip.id);if(!old||old.eatenForReal!==false||tip.eatenForReal!==true||old.raridade!==tip.raridade||seen.has(tip.id)||!before.collected.includes(tip.id)||!after.collected.includes(tip.id))continue;ids.push(tip.id);gained+=XP[tip.raridade];}
    if(!gained||after.xp-before.xp<gained)return null;
    return {ids,gained,levelUp:after.level>before.level};
  }
  function render(snapshot,host,options={}) {
    if(!host||!root.document)return null;let c=controllers.get(host);
    if(!c){c={selected:null,snapshot,options,busy:false,muted:readMuted(root.localStorage),status:'',success:false,realSeen:new Set()};controllers.set(host,c);}
    const previous=c.model,previousLocal=c.snapshot?.public!==true&&c.snapshot?.example!==true;
    c.snapshot=snapshot;c.options=options;c.locale=localeOf(typeof options.lang==='function'?options.lang():options.lang||root.document.documentElement.lang);
    if(c.busy)return c;
    if(snapshot?.public===true){let saved;try{saved=JSON.parse(root.localStorage.getItem(STORE));}catch{}c.publicSaved=saved;c.model=publicModel(snapshot,saved).model;}else c.model=modelOf(snapshot);
    const reward=previousLocal?realBonusOf(previous,c.model,snapshot,c.realSeen):null;
    for(const tip of c.model.tips)if(tip.eatenForReal===true)c.realSeen.add(tip.id);
    if(reward){c.status=words[c.locale].real+' +'+reward.gained+' XP';c.success=true;}
    if(!c.selected||!c.model.tips.some(tip=>tip.id===c.selected))c.selected=c.model.tips.find(tip=>!tip.locked&&!tip.fedToday)?.id||c.model.tips[0]?.id;
    const signature=JSON.stringify([c.model,c.locale,c.muted]);if(c.signature===signature&&host.childElementCount)return c;c.signature=signature;draw(host,c);
    if(reward){if(!c.muted&&!(typeof c.options.isMuted==='function'&&c.options.isMuted()))playSound(reward.levelUp,true);animate(c,c.mascot.getBoundingClientRect(),reward.gained,reward.levelUp);}
    return c;
  }
  function draw(host,c){
    const doc=root.document,w=words[c.locale],model=c.model;
    const decodedMascot=c.mascot?.querySelector('img');
    const make=(tag,text,cls)=>{const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
    const button=(text,cls,action)=>{const el=make('button',text,cls);el.type='button';if(action)el.addEventListener('click',action);return el;};
    host.classList.add('feed-box');host.setAttribute('aria-label',w.title);host.replaceChildren();
    const header=make('div',undefined,'feed-heading'),sound=button(c.muted?w.soundOff:w.soundOn,'feed-sound',()=>{c.muted=!c.muted;saveMuted(root.localStorage,c.muted);if(!c.muted&&!(typeof c.options.isMuted==='function'&&c.options.isMuted()))resumeAudio();c.signature=null;draw(host,c);host.querySelector('.feed-sound')?.focus();});sound.setAttribute('aria-pressed',String(c.muted));header.append(make('h2',w.title),sound);host.append(header);
    const stage=make('section',undefined,'feed-stage'),mascot=make('div',undefined,'feed-mascot'),image=decodedMascot||make('img');if(!decodedMascot)image.src='/agente.png';image.alt=w.agente;image.width=84;image.height=84;mascot.append(image);if(model.level>1){const badge=make('span','✦','feed-accessory');badge.setAttribute('aria-hidden','true');mascot.append(badge);}c.mascot=mascot;
    const stats=make('div',undefined,'feed-stats'),xpBar=make('progress'),hunger=make('progress',undefined,'feed-hunger');xpBar.max=hunger.max=100;xpBar.value=model.levelXp;hunger.value=model.hunger;xpBar.setAttribute('aria-label',w.next);hunger.setAttribute('aria-label',w.hunger);
    stats.append(make('strong',w.level+' '+model.level,'feed-level'),make('span',model.levelXp+' / 100 XP','feed-xp'),xpBar,make('small',model.hunger>50?w.full:w.hungry,'feed-hunger-copy'),hunger);stage.append(mascot,stats,make('span','✦ '+model.streak+' '+(model.streak===1?({pt:'dia seguido',en:'day streak',es:'día seguido'}[c.locale]):w.streak),'feed-streak'));host.append(stage);
    if(!model.tips.length){host.append(make('p',w.empty,'feed-empty'));return;}
    const tip=model.tips.find(item=>item.id===c.selected)||model.tips[0],content=tip[c.locale==='pt'?'pt':'en'],card=make('article',undefined,'feed-card rarity-'+tip.raridade),head=make('div',undefined,'feed-card-head');head.append(make('span',w.rarity[tip.raridade],'feed-rarity'),make('span','+'+tip.xp+' XP','feed-reward'));const cardTitle=make('h3',titleOf(tip,c.locale));cardTitle.tabIndex=-1;card.append(head,cardTitle);
    if(c.locale==='es')card.append(make('small',w.english,'feed-language-note'));
    const prompt=make('p',textOf(tip,c.locale),'feed-prompt');prompt.tabIndex=0;
    if(tip.locked)card.append(make('p','◇ '+w.locked+' '+tip.unlockLevel,'feed-locked-note'));else{card.append(prompt);if(typeof content?.porque==='string')card.append(make('p',content.porque,'feed-why'));}
    const action=button(tip.locked?w.locked+' '+tip.unlockLevel:tip.fedToday?w.copyAgain:w.feed,'feed-action',()=>feed(host,c,tip,prompt,action));action.disabled=tip.locked||c.busy;card.append(action);if(tip.eatenForReal)card.append(make('span','✦ '+w.real,'feed-real'));else if(tip.fedToday)card.append(make('span','✓ '+w.fed,'feed-today'));host.append(card);
    const status=make('p',c.status||(c.snapshot?.example?w.example:c.snapshot?.public?w.local:''),'feed-status');status.setAttribute('role',c.success?'status':'alert');status.hidden=!status.textContent;host.append(status);c.statusNode=status;
    const collection=make('details',undefined,'feed-collection');collection.open=c.collectionOpen===true;const summary=make('summary',w.collection+' · '+model.collected.length+' / '+model.collectionTotal),grid=make('div',undefined,'feed-grid');collection.addEventListener('toggle',()=>{c.collectionOpen=collection.open;});
    for(const item of model.tips){const entry=button(undefined,'feed-mini rarity-'+item.raridade+(item.id===c.selected?' selected':'')+(item.locked?' locked':''),()=>{if(c.busy)return;c.selected=item.id;c.status='';c.signature=null;draw(host,c);host.querySelector('.feed-card h3')?.focus();});entry.setAttribute('aria-pressed',String(item.id===c.selected));entry.setAttribute('aria-label',titleOf(item,c.locale)+', '+w.rarity[item.raridade]+(item.locked?', '+w.locked+' '+item.unlockLevel:''));entry.append(make('span',item.locked?'◇':model.collected.includes(item.id)?'✓':'✧','feed-mini-icon'),make('span',titleOf(item,c.locale)),make('small',item.locked?w.level+' '+item.unlockLevel:'+'+item.xp+' XP'));grid.append(entry);}collection.append(summary,grid);host.append(collection);
  }
  async function copyPrompt(text,prompt){try{if(root.navigator?.clipboard?.writeText){await root.navigator.clipboard.writeText(text);return true;}}catch{}try{const selection=root.getSelection(),range=root.document.createRange();range.selectNodeContents(prompt);selection.removeAllRanges();selection.addRange(range);return root.document.execCommand('copy');}catch{return false;}}
  function animate(c,start,gained,levelUp){
    if(root.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
    try{const end=c.mascot.getBoundingClientRect(),crumb=root.document.createElement('span');crumb.className='feed-flying';crumb.textContent='✦';root.document.body.append(crumb);crumb.animate([{transform:`translate(${start.left+start.width/2}px,${start.top}px) scale(1)`,opacity:1},{transform:`translate(${end.left+end.width/2}px,${end.top+end.height*.6}px) scale(.25)`,opacity:0}],{duration:450,easing:'cubic-bezier(.2,.8,.4,1)'}).onfinish=()=>crumb.remove();
      c.mascot.animate([{transform:'scale(1)'},{transform:'scale(1.08,.94)'},{transform:'scale(.96,1.03)'},{transform:'scale(1)'}],{duration:500});const pop=root.document.createElement('span');pop.className='feed-xp-pop';pop.textContent='+'+gained+' XP';c.mascot.append(pop);pop.animate([{transform:'translateY(0)',opacity:1},{transform:'translateY(-28px)',opacity:0}],{duration:750}).onfinish=()=>pop.remove();if(levelUp){c.mascot.classList.add('feed-level-up');for(let index=0;index<7;index++){const spark=root.document.createElement('span');spark.className='feed-confetti';spark.textContent='✧';c.mascot.append(spark);spark.animate([{transform:'translate(0,0) scale(.4)',opacity:1},{transform:`translate(${(index-3)*16}px,${-30-(index%3)*13}px) scale(1)`,opacity:0}],{duration:650}).onfinish=()=>spark.remove();}}
    }catch{}
  }
  async function feed(host,c,tip,prompt,action){
    if(c.busy||tip.locked)return;const w=words[c.locale],originalLevel=c.model.level,start=action.getBoundingClientRect();let reward;
    c.busy=true;action.disabled=true;action.textContent=w.saving;c.options.onUserGesture?.();root.document.dispatchEvent(new root.CustomEvent('painel:user-gesture'));if(!c.muted)resumeAudio();
    const report=(text,success=false)=>{c.status=text;c.success=success;};
    try{
      if(!await copyPrompt(textOf(tip,c.locale),prompt)){report(w.copyError);return;}
      if(c.snapshot?.example===true||tip.fedToday){report(w.ready,true);return;}
      let gained=0,reason;
      if(c.snapshot?.public===true){const result=publicFeed(c.snapshot,c.publicSaved,tip.id);gained=result.gained;reason=result.reason;root.localStorage.setItem(STORE,JSON.stringify(result.saved));c.publicSaved=result.saved;c.model=result.model;}
      else{if(!c.snapshot?.nonce){report(w.offline);return;}const apiUrl=typeof c.options.apiUrl==='function'?c.options.apiUrl:value=>value,response=await root.fetch(apiUrl('/api/alimentar'),{method:'POST',headers:{'Content-Type':'application/json','X-Painel-Nonce':c.snapshot.nonce},body:JSON.stringify({id:tip.id})}),result=await response.json();if(!response.ok||result.ok!==true||!result.feeding)throw Error('Feed failed');c.snapshot={...c.snapshot,feeding:result.feeding};c.model=modelOf(c.snapshot);gained=finite(result.feeding.gained);reason=result.feeding.reason;}
      report(reason==='daily-limit'?w.limit:w.ready+(gained?' +'+gained+' XP':''),true);if(gained){reward={gained,levelUp:c.model.level>originalLevel};if(!c.muted&&!(typeof c.options.isMuted==='function'&&c.options.isMuted()))playSound(reward.levelUp);}
      root.document.dispatchEvent(new root.CustomEvent('painel-feed-saved',{detail:{id:tip.id,gained,level:c.model.level}}));
    }catch{report(w.saveError);}finally{c.busy=false;c.signature=null;draw(host,c);if(reward)animate(c,start,reward.gained,reward.levelUp);host.querySelector('.feed-action')?.focus();}
  }
  const api={render,tipsOf,textOf,modelOf,publicModel,publicFeed,realBonusOf,readMuted,saveMuted,XP};if(typeof module==='object'&&module.exports)module.exports=api;else root.PainelTips=api;
})(typeof window==='object'?window:globalThis);

/* status.js */
'use strict';
(function(root){
 const LABELS={pt:['Trabalhando','Esperando você','Próxima entrega','Crédito semanal usado','Água estimada','Atualizado','Projetos ativos','Alimente sua IA','Lofi','Versão local'],en:['Working','Waiting for you','Next delivery','Weekly credit used','Estimated water','Updated','Active projects','Feed your AI','Lofi','Local version'],es:['Trabajando','Esperando tu decisión','Próxima entrega','Crédito semanal usado','Agua estimada','Actualizado','Proyectos activos','Alimenta tu IA','Lofi','Versión local']};
 const WORDS={pt:{unknown:'Sem leitura da fonte',eta:'Nenhuma estimativa registrada',water:'Sem leitura de consumo',source:'Fonte',level:'Nível',off:'Desligado',scan:'Leitura em andamento, contagem mínima',agents:'Agentes trabalhando ou andando agora',projects:'Projetos com agentes trabalhando ou esperando',estimate:'Estimativa por tokens, sem medição de água',radio:'Toque para abrir a rádio',live:'Ao vivo',delay:'Leitura atrasada'},en:{unknown:'No source reading',eta:'No recorded estimate',water:'No consumption reading',source:'Source',level:'Level',off:'Off',scan:'Reading in progress, minimum count',agents:'Agents working or walking now',projects:'Projects with agents working or waiting',estimate:'Token estimate, no water measurement',radio:'Tap to open the radio',live:'Live',delay:'Reading delayed'},es:{unknown:'Sin lectura de la fuente',eta:'Sin estimación registrada',water:'Sin lectura de consumo',source:'Fuente',level:'Nivel',off:'Apagado',scan:'Lectura en curso, conteo mínimo',agents:'Agentes trabajando o caminando ahora',projects:'Proyectos con agentes trabajando o esperando',estimate:'Estimación por tokens, sin medición de agua',radio:'Toca para abrir la radio',live:'En vivo',delay:'Lectura atrasada'}};
 const ICONS=['M5 18v-5l7-8 7 8v5M9 18v-4h6v4','M12 4v8l5 3M4 12a8 8 0 1 0 16 0 8 8 0 1 0-16 0','M5 17 12 5l7 12M5 17h14','M5 7h14v11H5zM5 10h14','M12 3c-2 4-6 7-6 11a6 6 0 0 0 12 0c0-4-4-7-6-11','M5 12a7 7 0 0 1 12-5M17 3v4h-4M19 12a7 7 0 0 1-12 5M7 21v-4h4','M4 6h6l2 2h8v11H4z','M12 20 4 12a5 5 0 0 1 8-6 5 5 0 0 1 8 6z','M4 14v-3a8 8 0 0 1 16 0v3M4 13h3v6H4zM17 13h3v6h-3z','M8 5 3 12l5 7M16 5l5 7-5 7M14 3l-4 18'];
 const formatters=new Map();function formats(lang){if(!formatters.has(lang))formatters.set(lang,{number:new Intl.NumberFormat(lang,{maximumFractionDigits:1}),clock:new Intl.DateTimeFormat(lang,{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo',hourCycle:'h23'}),date:new Intl.DateTimeFormat(lang,{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo',hourCycle:'h23'})});return formatters.get(lang);}const finite=x=>Number.isFinite(x)&&x>=0;
 function weekly(snapshot,family){return(snapshot.credits?.[family]?.windows||[]).find(x=>x.minutes>=10000&&finite(x.used)&&x.used<=100)||null;}
 function waterFormula(snapshot,lang){let value=snapshot.equipe?.waterFormula||'1500 tokens ≈ 0.3 ml';if(lang==='en')value=value.replace(/entrada/g,'input').replace(/saida/g,'output').replace(/(\d),(\d)/g,'$1.$2');else if(lang==='es')value=value.replace(/saida/g,'salida');else value=value.replace(/saida/g,'saída');return value;}
 function values(snapshot,now=Date.now()){
  const team=snapshot.equipe,agents=team?.agents,delivery=(team?.groups||[]).filter(g=>!g.agents?.length||!g.agents.every(a=>a.state==='done')).map(g=>g.delivery).filter(d=>d?.etaAt&&!d.completedAt&&Number.isFinite(Date.parse(d.etaAt))).sort((a,b)=>a.etaAt.localeCompare(b.etaAt))[0]||null;
  return{active:Array.isArray(agents)?agents.filter(a=>['working','walking'].includes(a.state)).length:null,waiting:Number.isInteger(snapshot.needsCount)?snapshot.needsCount:null,delivery,claude:weekly(snapshot,'claude'),codex:weekly(snapshot,'codex'),water:finite(team?.waterMl)?team.waterMl:null,projects:Array.isArray(agents)?new Set(agents.filter(a=>['working','walking','waiting'].includes(a.state)).map(a=>a.projectId).filter(Boolean)).size:null,age:Number.isFinite(Date.parse(snapshot.updated))?Math.max(0,Math.floor((now-Date.parse(snapshot.updated))/1000)):null};
 }
 let mounted=false,current,language='pt',buttons=[],visible;
 function hide(){const tip=root.document.getElementById('status-tooltip');if(tip)tip.hidden=true;visible=null;}
 function show(b){const tip=root.document.getElementById('status-tooltip'),s=b._spec;if(!tip||!s)return;tip.replaceChildren();for(const [tag,text]of [['strong',s.title],['b',s.full],['p',s.meaning],['small',s.source]]){const n=root.document.createElement(tag);n.textContent=text;tip.append(n);}tip.hidden=false;const r=b.getBoundingClientRect(),width=Math.min(288,root.innerWidth-24);tip.style.width=width+'px';tip.style.left=Math.max(12,Math.min(root.innerWidth-width-12,r.left))+'px';tip.style.top=Math.max(12,Math.min(root.innerHeight-tip.offsetHeight-12,r.bottom+8))+'px';visible=b;}
 function mount(){const doc=root.document,top=doc.getElementById('status-top'),foot=doc.getElementById('status-bottom');if(!top||!foot)return false;
  for(const [index,key]of ['active','waiting','delivery','credit','water','updated','projects','feeding','lofi','version'].entries()){const b=doc.createElement('button');b.type='button';b.className='status-chip';b.id='status-'+key;b.setAttribute('aria-describedby','status-tooltip');const icon=doc.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');icon.classList.add('status-icon');const path=doc.createElementNS(icon.namespaceURI,'path');path.setAttribute('d',ICONS[index]);icon.append(path);const text=doc.createElement('span');b.append(icon,text);b._value=text;b.addEventListener('mouseenter',()=>show(b));b.addEventListener('mouseleave',hide);b.addEventListener('focus',()=>show(b));b.addEventListener('blur',hide);b.addEventListener('click',()=>{if(key==='lofi')doc.getElementById('lofi-trigger')?.click();else root.PainelVisao?.select(b._spec.tab);show(b);});(index<5?top:foot).append(b);buttons.push(b);}
  const rings=doc.createElement('span');rings.className='status-rings';rings.setAttribute('aria-hidden','true');for(const family of ['claude','codex']){const ring=doc.createElement('i');ring.className='status-mini-ring';ring.dataset.family=family;rings.append(ring);}buttons[3].insertBefore(rings,buttons[3]._value);buttons[3].querySelector('svg').remove();
  doc.addEventListener('painel-lofi-state',event=>{const b=buttons[8];if(!b?._spec)return;const w=WORDS[language]||WORDS.en,value=event.detail?.playing===true?'Lofi':'Lofi '+w.off;b._value.textContent=value;b._spec.full=event.detail?.playing===true?'Lofi':w.off;b.setAttribute('aria-label',(LABELS[language]||LABELS.en)[8]+': '+value);if(visible===b)show(b);});
  doc.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});root.addEventListener('scroll',hide,{passive:true});const timer=root.setInterval(()=>{if(current&&!doc.hidden&&buttons[5]){const at=Date.parse(current.updated),age=Number.isFinite(at)?Math.max(0,Math.floor((Date.now()-at)/1000)):null,value=age===null?'?':age+'s',b=buttons[5];if(b._value.textContent!==value){b._value.textContent=value;b.setAttribute('aria-label',(LABELS[language]||LABELS.en)[5]+': '+value);}b.classList.toggle('status-live',current.readerStatus!=='delayed'&&age!==null&&age<15);}},1000);root.addEventListener('pagehide',()=>root.clearInterval(timer),{once:true});return true;
 }
 function render(snapshot,{lang='pt'}={}){if(!root.document)return;if(!mounted){mounted=mount();if(!mounted)return;}current=snapshot;language=lang;const w=WORDS[lang]||WORDS.en,l=LABELS[lang]||LABELS.en,v=values(snapshot),nf=formats(lang).number,clock=at=>formats(lang).clock.format(new Date(at)),count=n=>n===null?'?':(snapshot.equipe?.scanning?'≥':'')+n;
  const origins={pt:['Sessões locais','Fila e decisões','Estimativa do agente','Crédito local','Tokens das conversas','Leitura local','Equipes por projeto','Progresso salvo no PC','Rádio escolhida','Versão local'],en:['Local sessions','Queue and decisions','Agent estimate','Local credit','Conversation tokens','Local reading','Project teams','Progress saved on this PC','Selected radio','Local version'],es:['Sesiones locales','Cola y decisiones','Estimación del agente','Crédito local','Tokens de las conversaciones','Lectura local','Equipos por proyecto','Progreso guardado en este PC','Radio elegida','Versión local']}[lang]||[],date=at=>Number.isFinite(Date.parse(at))?formats(lang).date.format(new Date(at)):w.unknown;const source=t=>w.source+': '+t,full=n=>n===null?w.unknown:String(n),credits=(v.claude?v.claude.used+'%':'?')+' / '+(v.codex?v.codex.used+'%':'?'),playing=root.PainelLofi?.instance?.playing?.()===true;
  const measured=Date.parse(snapshot.credits?.claude?.updated),stale=Number.isFinite(measured)&&Date.now()-measured>15*60000,creditValue=credits+(stale?' · '+clock(measured):'');
  const specs=[
   [count(v.active),full(v.active),snapshot.equipe?.scanning?w.scan:w.agents,origins[0]+' · '+date(snapshot.updated),'team'],
   [v.waiting??'?',full(v.waiting),l[1],origins[1]+' · '+date(snapshot.updated),'home'],
   [v.delivery?'~'+clock(v.delivery.etaAt):'?',v.delivery?date(v.delivery.etaAt):w.eta,l[2],v.delivery?origins[2]:w.eta,'team'],
   [creditValue,'Claude '+(v.claude?.used??'?')+'% · Codex '+(v.codex?.used??'?')+'%',l[3],origins[3]+' · Claude '+date(snapshot.credits?.claude?.updated)+' · Codex '+date(snapshot.credits?.codex?.updated),'consumption'],
   [v.water===null?'?':'~'+(v.water>=1000?nf.format(v.water/1000)+' L':nf.format(v.water)+' ml'),v.water===null?w.water:nf.format(v.water)+' ml',w.estimate,v.water===null?w.water:origins[4]+' · '+waterFormula(snapshot,lang),'consumption'],
   [v.age===null?'?':v.age+'s',date(snapshot.updated),snapshot.readerStatus==='delayed'?w.delay:w.live,origins[5],'home'],
   [count(v.projects),full(v.projects),w.projects,origins[6],'projects'],
   [w.level+' '+(snapshot.feeding?.level??'?'),w.level+' '+(snapshot.feeding?.level??'?'),l[7],origins[7],'tips'],
   [playing?'Lofi':'Lofi '+w.off,playing?'Lofi':w.off,w.radio,origins[8],'home'],
   [root.PainelBuild?.version||'r7',(root.PainelBuild?.version||'r7')+' · '+(root.PainelBuild?.hash||'')+' · '+(root.PainelBuild?.at||''),l[9],origins[9],'home']];
  for(const [i,[value,f,meaning,s,tab]]of specs.entries()){const b=buttons[i],changed=b._value.textContent!==String(value);b._spec={title:l[i],full:f,meaning,source:source(s),tab};b._value.textContent=value;b.setAttribute('aria-label',l[i]+': '+value);if(changed&&!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches)b._value.animate?.([{opacity:.45,transform:'translateY(2px)'},{opacity:1,transform:'translateY(0)'}],{duration:180});}
  buttons[2].hidden=!v.delivery;buttons[5].classList.toggle('status-live',snapshot.readerStatus!=='delayed'&&v.age!==null&&v.age<15);for(const ring of buttons[3].querySelectorAll('.status-mini-ring')){const window=v[ring.dataset.family];ring.style.setProperty('--used',(window?.used||0)+'%');ring.classList.toggle('unknown',!window);}if(visible)show(visible);
 }
 const api={values,weekly,render};if(typeof module!=='undefined')module.exports=api;root.PainelStatus=api;
})(typeof window==='undefined'?globalThis:window);

/* operador.js */
(function(root){
 'use strict';
 const COPY={pt:{tree:'Árvore viva',summaries:'Resumos',description:'Quem coordena. Quem entrega.',direct:'Frentes da coordenação',unknownOwner:'Frentes sem coordenação confirmada',all:'Todos',manyDone:'entregues',manyWorking:'trabalhando',manyWaiting:'esperando',manySleeping:'em descanso',need:'Precisa de você',clear:'Sem pedido agora',details:'Ver resumo',fez:'FEZ',achou:'ACHOU',mudou:'MUDOU',precisa:'PRECISA DE VOCÊ',missing:'Sem resumo ainda',notRecorded:'Sem registro',read:'Atualizado',source:'Fonte',ready:'Entregas da equipe',more:'Ver mais frentes',children:'subagentes',new:'Trazer novos agentes',stable:'Ordem preservada',empty:'As sessões acompanham a próxima tarefa',last:'Última entrega',working:'Trabalhando',waiting:'Esperando',sleeping:'Em descanso',done:'Entregue'},en:{tree:'Live tree',summaries:'Summaries',description:'Who coordinates. Who delivers.',direct:'Coordination workstreams',unknownOwner:'Workstreams without a confirmed coordinator',all:'All',manyDone:'delivered',manyWorking:'working',manyWaiting:'waiting',manySleeping:'resting',need:'Needs you',clear:'No request now',details:'View summary',fez:'DID',achou:'FOUND',mudou:'CHANGED',precisa:'NEEDS YOU',missing:'No summary yet',notRecorded:'Not recorded',read:'Updated',source:'Source',ready:'Team deliveries',more:'More workstreams',children:'subagents',new:'Show new agents',stable:'Order preserved',empty:'Sessions are following the next task',last:'Last delivery',working:'Working',waiting:'Waiting',sleeping:'Resting',done:'Delivered'},es:{tree:'Árbol en vivo',summaries:'Resúmenes',description:'Quién coordina. Quién entrega.',direct:'Frentes de coordinación',unknownOwner:'Frentes sin coordinación confirmada',all:'Todos',manyDone:'entregados',manyWorking:'trabajando',manyWaiting:'esperando',manySleeping:'en descanso',need:'Te necesita',clear:'Sin pedido ahora',details:'Ver resumen',fez:'HIZO',achou:'ENCONTRÓ',mudou:'CAMBIÓ',precisa:'TE NECESITA',missing:'Sin resumen aún',notRecorded:'Sin registro',read:'Actualizado',source:'Fuente',ready:'Entregas del equipo',more:'Ver más frentes',children:'subagentes',new:'Mostrar agentes nuevos',stable:'Orden conservado',empty:'Las sesiones siguen la próxima tarea',last:'Última entrega',working:'Trabajando',waiting:'Esperando',sleeping:'En descanso',done:'Entregado'}};
 const instances=new WeakMap(),short=(text,size=40)=>String(text||'').length<=size?String(text||''):String(text).slice(0,size-1).trimEnd()+'…';
 const byKey=(previous,rows)=>{const map=new Map(rows.map(row=>[row.id,row]));return [...previous.filter(id=>map.has(id)),...rows.filter(row=>!previous.includes(row.id)).map(row=>row.id)].map(id=>map.get(id));};
 function hierarchy(data){
  const operator=data.operator||{},sessions=operator.sessions||[],agents=data.equipe?.agents||[],actualSessions=new Set(operator.sessionAgentIds||[]),byId=new Map(agents.map(agent=>[agent.id,agent]));
  const roots=agents.filter(agent=>!actualSessions.has(agent.id)&&(!agent.parentId||!byId.has(agent.parentId)));
  const children=parent=>agents.filter(agent=>agent.parentId===parent);
  const branches=sessions.filter(session=>session.id!=='COORDENADOR').map(session=>({session,agents:roots.filter(agent=>agent.ownerSession===session.id)}));
  return {leader:sessions.find(session=>session.id==='COORDENADOR')||null,branches: data.selectedProject?branches.filter(branch=>branch.agents.length||data.selectedProject==='app'):branches,direct:roots.filter(agent=>agent.ownerSession==='COORDENADOR'),unlinked:roots.filter(agent=>!agent.ownerSession),children};
 }
 function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=root.PainelLinguagem?.text(text,document.documentElement.lang)||text;return node;}
 function time(value,lang){return Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat(lang,{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'America/Sao_Paulo'}).format(new Date(value)):null;}
 function sessionAction(session,lang='pt'){if(session.node?.currentDelivery)return session.node.currentDelivery.labels?.[lang]||session.node.currentDelivery.labels?.pt||'';const fields=session.summary?.fields||{},value=session.needsOperator?fields.precisa:(fields.fez||fields.proximo);if(session.needsOperator&&root.PainelVisao)return root.PainelVisao.humanLabel({title:root.PainelLinguagem?.text(value,lang)||value,detail:value},lang);if(/full report.*saiu|relatório.*saiu/i.test(value||''))return {pt:'Publicou o relatório do acervo',en:'Published the collection report',es:'Publicó el informe del tesoro'}[lang];if(/evento pronto/i.test(value||''))return {pt:'Preparou o evento para revisão',en:'Prepared the event for review',es:'Preparó el evento para revisión'}[lang];return root.PainelLinguagem?.text(value,lang)||value||'';}
 function create(host){
  const c={host,mode:'tree',options:{},order:[],known:new Set(),nodes:new Map(),sessionNodes:new Map(),summaryNodes:new Map(),branchNodes:new Map(),dirty:false};
  const header=el('div','op-toolbar'),modes=el('div','op-modes'),tree=el('button',null),summaries=el('button',null),refresh=el('button','op-refresh');tree.type=summaries.type=refresh.type='button';tree.addEventListener('click',()=>{c.mode='tree';paint(c);});summaries.addEventListener('click',()=>{c.mode='summaries';paint(c);});refresh.addEventListener('click',()=>{c.known=new Set(c.data.equipe?.agents?.map(agent=>agent.id)||[]);c.dirty=false;paint(c);});modes.append(tree,summaries);header.append(modes,refresh);
  const description=el('p','op-description'),view=el('div','op-tree'),chief=el('div','op-chief'),branches=el('div','op-branches'),direct=el('section','op-direct'),directTitle=el('h2'),directRows=el('div','op-direct-grid');direct.append(directTitle,directRows);const unlinked=el('section','op-direct'),unlinkedTitle=el('h2'),unlinkedRows=el('div','op-direct-grid');unlinked.append(unlinkedTitle,unlinkedRows);view.append(chief,branches,direct,unlinked);
  const summariesView=el('div','op-summaries'),sessionsGrid=el('div','op-summary-grid'),readyTitle=el('h2'),readyGrid=el('div','op-summary-grid');summariesView.append(sessionsGrid,readyTitle,readyGrid);host.append(header,description,view,summariesView);Object.assign(c,{header,tree,summaries,refresh,description,view,chief,branches,direct,directTitle,directRows,unlinked,unlinkedTitle,unlinkedRows,summariesView,sessionsGrid,readyTitle,readyGrid});instances.set(host,c);return c;
 }
 function updateText(node,value){const human=root.PainelLinguagem?.text(value,document.documentElement.lang)??String(value||'');if(node.textContent!==human)node.textContent=human;}
 function row(c,id){
  if(c.nodes.has(id))return c.nodes.get(id);
  const button=el('button','op-agent'),image=el('img','op-avatar'),copy=el('span','op-agent-copy'),badge=el('small','op-badge'),name=el('strong'),action=el('span','op-action'),meta=el('span','op-meta'),status=el('span','op-state'),eta=el('span','op-eta');button.type='button';button.dataset.agent=id;image.width=56;image.height=56;image.alt='';copy.append(badge,name,action,meta,status,eta);button.append(image,copy);button.addEventListener('click',()=>{if(button._session)openSummary(c,button._session);else if(button._agent)root.PainelEquipe?.openAgent?.(button._agent,document.getElementById('pipeline'));});
  const node={button,image,badge,name,action,meta,status,eta};c.nodes.set(id,node);return node;
 }
 // the Home row of each agent (role or last real step, forecast or real delivery), the Home name function
 // over the whole screen, identical helpers of one coordinator joined in one card, and a distinct real Agente.
 const CLASS=state=>state==='done'?'done':['working','walking','waiting'].includes(state)?'active':'rest';
 const HELPER={pt:'AGENTE AJUDANTE',en:'AGENTE HELPER',es:'AGENTE AYUDANTE'};
 function latest(members,read){let best=null,at=-Infinity;for(const member of members){const value=Date.parse(read(member.row));if(Number.isFinite(value)&&value>at){best=member;at=value;}}return best||members[0];}
 function singleStatus(c,entry){
  const {w,lang}=c,session=entry.session,state=session?entry.agent.state:entry.row.state;
  if(session?.needsOperator)return ['● '+w.need,'waiting'];if(session&&state==='registered')return [({pt:'Resumo registrado',en:'Summary recorded',es:'Resumen registrado'}[lang]),'registered'];
  return state==='done'?['✓ '+w.done,'done']:state==='waiting'?['◷ '+w.waiting,'waiting']:['sleeping','unknown','registered'].includes(state)?['◌ '+w.sleeping,'sleeping']:['● '+w.working,state||'working'];
 }
 function groupStatus(c,members,parent){
  const {w}=c,kind=CLASS(members[0].row.state),amount=parent&&members.length===parent.kids.length?w.all:String(members.length);
  const [icon,word,state]=kind==='done'?['✓',w.manyDone,'done']:kind==='active'?members.every(member=>member.row.state==='waiting')?['◷',w.manyWaiting,'waiting']:['●',w.manyWorking,'working']:['◌',w.manySleeping,'sleeping'];
  return [icon+' '+amount+' '+word,state];
 }
 function treePlan(c,data,model){
  const team=root.PainelEquipe,{lang}=c,now=Date.now(),fronts=team.teamFronts(data),entries=new Map(),known=agent=>c.known.has(agent.id);
  const visit=(agent,session,parent,depth)=>{
   if(!agent?.id||entries.has(agent.id))return;
   const base=fronts.get(agent.id)||{...agent},row={...base,state:team.stateOf(base,now)},role=team.nameRole(row,lang);
   // A helper with its coordinator's own role is that coordinator's helper, so the two names never match.
   if(parent&&role===parent.role)row.identity={...row.identity,labels:HELPER};
   const entry={id:agent.id,agent,session,row,role,parentId:parent?.id||null,kids:[]};entries.set(agent.id,entry);if(session)return;
   const kids=model.children(agent.id).filter(known);entry.kids=kids.map(kid=>kid.id);if(depth<5)for(const kid of kids)visit(kid,null,entry,depth+1);
  };
  if(model.leader?.node)visit(model.leader.node,model.leader,null,0);
  for(const branch of model.branches){if(branch.session.node)visit(branch.session.node,branch.session,null,0);for(const agent of branch.agents.filter(known))visit(agent,null,null,0);}
  for(const agent of [...model.direct,...model.unlinked].filter(known))visit(agent,null,null,0);
  const list=[...entries.values()],first=team.homeNames(list.map(entry=>entry.row),data,lang);for(const entry of list)entry.name=first.get(entry.id);
  // Helpers of one coordinator with the same name and the same state become one card; it says how many.
  const shown=new Map();
  for(const entry of list){
   if(!entry.kids.length)continue;const groups=new Map();
   for(const kid of byKey(c.childOrders?.get(entry.id)||[],entry.kids.map(id=>entries.get(id)).filter(Boolean))){const key=kid.kids.length?'own:'+kid.id:kid.name+'|'+CLASS(kid.row.state);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(kid);}
   for(const members of groups.values()){members[0].members=members;for(const member of members.slice(1))member.mergedInto=members[0].id;}
   shown.set(entry.id,[...groups.values()].map(members=>members[0].id));
  }
  const cardList=list.filter(entry=>!entry.mergedInto).map(entry=>({id:entry.id,name:entry.name,row:entry.row,size:(entry.members||[entry]).length,entry}));
  const names=team.distinctNames(cardList,lang);c.portraits??=new Map();
  const portraits=team.distinctPortraits(cardList.map(card=>({id:card.id,candidates:(card.entry.members||[card.entry]).map(member=>member.agent.agente)})),team.portraitPool(data),c.portraits);
  const cards=new Map();
  for(const card of cardList){
   const entry=card.entry,members=entry.members||[entry],name=names.get(card.id)||card.name,parent=entry.parentId?entries.get(entry.parentId):null,kind=CLASS(entry.row.state);
   const active=Boolean(entry.session)||kind==='active'||model.children(entry.id).some(kid=>CLASS(team.stateOf(kid,now))==='active');
   const lead=members.length<2?entry:kind==='done'?latest(members,row=>row.delivery?.completedAt):kind==='active'?latest(members,row=>row.delivery?.etaAt):latest(members,row=>row.lastAt);
   const [status,statusState]=members.length<2?singleStatus(c,entry):groupStatus(c,members,parent);
   cards.set(card.id,{name,action:team.taskLabel(entry.row,lang),status,statusState,time:team.cardTime(lead.row,lang,active),portrait:portraits.get(card.id)||null,row:{...lead.row,cardName:name},size:members.length});
  }
  return {cards,shown,collisions:names.collisions,missingPortraits:portraits.missing};
 }
 // Only for a row drawn outside the plan: the same rules for that card alone.
 function loneCard(c,agent,session){
  const team=root.PainelEquipe,row={...agent,state:team.stateOf(agent)},entry={agent,session,row};delete row.currentDelivery;
  const name=team.homeNames([row],c.data,c.lang).get(agent.id)||team.displayName(agent,c.lang),[status,statusState]=singleStatus(c,entry);
  return {name,action:team.taskLabel(row,c.lang),status,statusState,time:team.cardTime(row,c.lang,Boolean(session)||CLASS(row.state)==='active'),portrait:agent.agente?.verified===true&&team.imageOf(agent)!=='/agente.png'?{id:agent.agente.id??null,image:team.imageOf(agent)}:null,row:{...row,cardName:name},size:1};
 }
 function agentRow(c,agent,session=null){
  const {w}=c,node=row(c,agent.id),card=c.plan?.cards.get(agent.id)||loneCard(c,agent,session);
  node.button._agent=card.row;node.button._session=session;updateText(node.name,card.name);updateText(node.action,card.action||w.missing);node.action.lang=c.lang;
  // The tree already shows who coordinates whom, so no card repeats a label of its group.
  node.badge.hidden=true;updateText(node.badge,'');node.meta.hidden=true;
  const portrait=card.portrait;node.image.style.visibility=portrait?'':'hidden';if(!portrait)node.image.removeAttribute('src');else if(node.image.getAttribute('src')!==portrait.image)node.image.src=portrait.image;node.image.alt=portrait?.id?'Agente #'+portrait.id:'Agente';node.image.title=portrait?.id?'Agente #'+portrait.id:'';
  updateText(node.status,card.status);node.status.dataset.state=card.statusState;
  node.eta.hidden=!card.time.text;updateText(node.eta,card.time.text);node.eta.title=card.time.tip||'';node.eta.dataset.tone=card.time.tone||'';
  node.button.title=[card.name,card.action,card.status,card.time.text,card.time.tip].filter(Boolean).join(' · ');node.button.setAttribute('aria-label',node.button.title);return node.button;
 }
 function summaryName(c,session){const tree=/^summary:/.test(session.id||'')&&session.agentId?c.plan?.cards.get(session.agentId)?.name:null;return tree||root.PainelLinguagem?.conversation(session.name,c.lang)||root.PainelLinguagem?.title(session.name,c.lang)||session.name;}
 function openSummary(c,session){
  const {w,lang}=c,summary=session.summary?.fields||{},blocks=[];
  for(const key of ['fez','achou','mudou','precisa'])if(summary[key])blocks.push(c.options.detailBlock(w[key],summary[key]));if(summary.proximo)blocks.push(c.options.detailBlock({pt:'PRÓXIMO PASSO',en:'NEXT STEP',es:'PRÓXIMO PASO'}[lang],summary.proximo));
  blocks.push(c.options.detailBlock(w.source,(root.PainelLinguagem?.sourceLabel(session.source,lang)||w.source)+' · '+(root.PainelLinguagem?.relative(session.updatedAt,lang)||w.notRecorded)));
  c.options.drawer(summaryName(c,session),blocks);
 }
 function summaryCard(c,session){
  let node=c.summaryNodes.get(session.id);if(!node){const card=el('article','op-summary-card'),head=el('div','op-summary-head'),name=el('h3'),need=el('span','op-summary-need'),body=el('dl'),lines={};for(const key of ['fez','achou','mudou','precisa']){const title=el('dt'),value=el('dd');value.lang='pt';body.append(title,value);lines[key]={title,value};}const footer=el('div','op-summary-footer'),updated=el('time'),button=el('button',null);button.type='button';button.addEventListener('click',()=>openSummary(c,node.session));head.append(name,need);footer.append(updated,button);card.append(head,body,footer);node={card,name,need,lines,updated,button};c.summaryNodes.set(session.id,node);}
  node.session=session;updateText(node.name,summaryName(c,session));updateText(node.need,session.needsOperator?'● '+c.w.need:c.w.clear);node.need.dataset.needs=String(Boolean(session.needsOperator));for(const key of ['fez','achou','mudou','precisa']){const fields=session.summary?.fields||{},value=fields[key]||(key==='fez'?fields.proximo:null);node.lines[key].title.hidden=node.lines[key].value.hidden=!value;updateText(node.lines[key].title,key==='fez'&&!fields.fez&&fields.proximo?({pt:'PRÓXIMO PASSO',en:'NEXT STEP',es:'PRÓXIMO PASO'}[c.lang]):c.w[key]);if(/Verificações descritas nos detalhes/.test(summaryLine(value))){node.lines[key].title.hidden=node.lines[key].value.hidden=true;continue;}const visibleValue=key==='precisa'&&value&&session.needsOperator?root.PainelVisao?.humanLabel({title:value,detail:value},c.lang)||summaryLine(value):summaryLine(value);updateText(node.lines[key].value,visibleValue);}updateText(node.updated,c.w.read+' '+(root.PainelLinguagem?.relative(session.updatedAt,c.lang)||c.w.notRecorded));node.updated.dateTime=session.updatedAt||'';node.updated.title=c.w.source+': '+session.source;updateText(node.button,c.w.details+' ↗');return node.card;
 }
 function place(parent,node,index){if(parent.children[index]!==node)parent.insertBefore(node,parent.children[index]||null);}
 function agentBranch(c,agent,model,depth=0){
  let branch=c.branchNodes.get(agent.id);if(!branch){const box=el('div','op-agent-branch'),children=el('details','op-children'),summary=el('summary'),list=el('div','op-child-list');children.append(summary,list);box.append(children);branch={box,children,summary,list};c.branchNodes.set(agent.id,branch);}
  place(branch.box,agentRow(c,agent),0);const all=model.children(agent.id).filter(item=>c.known.has(item.id)),shown=c.plan?.shown.get(agent.id),kids=byKey(c.childOrders?.get(agent.id)||[],shown?all.filter(item=>shown.includes(item.id)):all);c.childOrders??=new Map();c.childOrders.set(agent.id,kids.map(item=>item.id));branch.children.hidden=!all.length;updateText(branch.summary,all.length+' '+c.w.children);if(depth<5)for(const [index,child]of kids.entries())place(branch.list,agentBranch(c,child,model,depth+1),index);for(const child of [...branch.list.children])if(!kids.some(kid=>child.querySelector('[data-agent]')?.dataset.agent===kid.id))child.remove();return branch.box;
 }
 function paint(c){
  const {data}=c;if(c.project!==data.selectedProject){c.project=data.selectedProject;c.initialized=false;c.directOrder=[];c.sessionsGrid.replaceChildren();c.readyGrid.replaceChildren();}c.lang=COPY[c.options.lang]?c.options.lang:'pt';c.w=COPY[c.lang];const {w}=c,model=hierarchy(data),current=data.equipe?.agents||[];
  if(!c.initialized){c.known=new Set(current.map(agent=>agent.id));c.initialized=true;}c.plan=root.PainelEquipe?.teamFronts?treePlan(c,data,model):null;const additions=current.filter(agent=>!c.known.has(agent.id));c.dirty=additions.length>0;updateText(c.refresh,c.dirty?w.new+' ('+additions.length+')':w.stable);c.refresh.disabled=!c.dirty;updateText(c.tree,w.tree);updateText(c.summaries,w.summaries);c.tree.setAttribute('aria-pressed',String(c.mode==='tree'));c.summaries.setAttribute('aria-pressed',String(c.mode==='summaries'));c.view.hidden=c.mode!=='tree';c.summariesView.hidden=c.mode!=='summaries';updateText(c.description,w.description);
  if(model.leader){const chief=agentRow(c,model.leader.node,model.leader);chief.classList.add('op-leader');place(c.chief,chief,0);}else updateText(c.chief,w.empty);
  const visible=model.branches.map(branch=>branch.session.id);for(const child of [...c.branches.children])if(!visible.includes(child.dataset.session))child.remove();
  for(const [index,branch]of model.branches.entries()){
   let box=c.sessionNodes.get(branch.session.id);if(!box){const section=el('section','op-session'),rows=el('div','op-session-agents');section.dataset.session=branch.session.id;section.append(rows);box={section,rows,order:[]};c.sessionNodes.set(branch.session.id,box);}place(box.section,agentRow(c,branch.session.node,branch.session),0);place(c.branches,box.section,index);
   const agents=byKey(box.order,branch.agents).filter(agent=>c.known.has(agent.id));box.order=agents.map(agent=>agent.id);for(const [at,agent]of agents.entries())place(box.rows,agentBranch(c,agent,model),at);
   for(const child of [...box.rows.children])if(!agents.some(agent=>child.querySelector('[data-agent]')?.dataset.agent===agent.id))child.remove();
  }
  updateText(c.directTitle,w.direct);const direct=byKey(c.directOrder||[],model.direct).filter(agent=>c.known.has(agent.id));c.directOrder=direct.map(agent=>agent.id);c.direct.hidden=!direct.length;for(const [index,agent]of direct.entries())place(c.directRows,agentBranch(c,agent,model),index);for(const child of [...c.directRows.children])if(!direct.some(agent=>child.querySelector('[data-agent]')?.dataset.agent===agent.id))child.remove();
  updateText(c.unlinkedTitle,w.unknownOwner);const unlinked=byKey(c.unlinkedOrder||[],model.unlinked).filter(agent=>c.known.has(agent.id));c.unlinkedOrder=unlinked.map(agent=>agent.id);c.unlinked.hidden=!unlinked.length;for(const [index,agent]of unlinked.entries())place(c.unlinkedRows,agentBranch(c,agent,model),index);for(const child of [...c.unlinkedRows.children])if(!unlinked.some(agent=>child.querySelector('[data-agent]')?.dataset.agent===agent.id))child.remove();
  // First paint prioritizes requests; live updates never reorder existing cards.
  const sorted=(data.operator?.sessions||[]).slice().sort((a,b)=>Number(b.needsOperator)-Number(a.needsOperator));const sessions=byKey(c.summaryOrder||[],sorted);c.summaryOrder=sessions.map(session=>session.id);for(const [index,session]of sessions.entries())place(c.sessionsGrid,summaryCard(c,session),index);
  updateText(c.readyTitle,w.ready);const ready=data.operator?.codex||[];if(!c.summaryEmpty){c.summaryEmpty=el('p','op-empty');c.summariesView.append(c.summaryEmpty);}c.summaryEmpty.hidden=Boolean(sessions.length||ready.length);updateText(c.summaryEmpty,({pt:'Este projeto não tem resumos registrados.',en:'This project has no recorded summaries.',es:'Este proyecto no tiene resúmenes registrados.'}[c.lang]));c.readyTitle.hidden=!ready.length;const available=ready.filter(session=>session.summary?.available),missing=ready.filter(session=>!session.summary?.available);
  for(const [index,session]of available.entries())place(c.readyGrid,summaryCard(c,session),index);
  if(!c.missingGroup){c.missingGroup=el('details','op-missing-group');c.missingTitle=el('summary');c.missingGrid=el('div','op-summary-grid');c.missingGroup.append(c.missingTitle,c.missingGrid);}c.missingGroup.hidden=!missing.length;updateText(c.missingTitle,missing.length+' '+({pt:'frentes aguardando resumo',en:'workstreams awaiting a summary',es:'frentes esperando resumen'}[c.lang]));
  for(const [index,session]of missing.entries())place(c.missingGrid,summaryCard(c,session),index);place(c.readyGrid,c.missingGroup,available.length);
  for(const [key,holder]of [['direct',c.directRows],['unlinked',c.unlinkedRows]]){
   const roots=key==='direct'?direct:unlinked,active=a=>['working','walking','waiting'].includes(a.state)||model.children(a.id).some(active),resting=roots.filter(a=>!active(a));
   c.resting??={};let group=c.resting[key];if(!group){const box=el('details','op-resting'),label=el('summary'),list=el('div','op-direct-grid');box.append(label,list);group=c.resting[key]={box,label,list};}
   updateText(group.label,({pt:'Pausadas e entregues',en:'Paused and delivered',es:'Pausadas y entregadas'}[c.lang])+' ('+resting.length+')');group.box.hidden=!resting.length;
   for(const [i,a]of resting.entries())place(group.list,agentBranch(c,a,model),i);holder.append(group.box);
  }
  if(root.PainelBuild){let badge=document.getElementById('build-badge');if(!badge){badge=el('span','op-build');badge.id='build-badge';document.querySelector('footer')?.append(badge);}/* 04/10: o rodape dizia "r17 · 77a1f213 · 22:11" (hash e uma hora de 2 dias atras com cara de agora): agora diz a versao e o DIA dela, sem hash */const at=String(root.PainelBuild.at||''),dia=/^\d{4}-\d{2}-\d{2}/.test(at)?at.slice(8,10)+'/'+at.slice(5,7):'?';updateText(badge,({pt:'versão ',en:'version ',es:'versión '}[c.lang]||'versão ')+root.PainelBuild.version+({pt:' de ',en:' of ',es:' del '}[c.lang]||' de ')+dia);badge.title=at;}
 }
 function render(data,options={}){const host=document.getElementById('operator-live');if(!host)return;const c=instances.get(host)||create(host);c.data=data;c.options=options;paint(c);}
 function summaryLine(value){value=root.PainelLinguagem?.teamText(value)||value;if(/esforço|esforco|testes?\b|Tier S|arvore|árvore|branch|sha|hash/i.test(String(value||'')))return 'Verificações descritas nos detalhes';const source=String(value||'').replace(/\bcommit\b/gi,'alteração salva').replace(/\bmerge\b/gi,'integração');const first=source.split(/;|\n/)[0].trim(),words=first.split(/\s+/);return words.length>22?words.slice(0,22).join(' ')+'…':first;}
 const api={hierarchy,byKey,sessionAction,short,summaryLine,render};if(typeof module==='object'&&module.exports)module.exports=api;else root.PainelOperador=api;
})(typeof window==='object'?window:globalThis);

/* visao.js */
'use strict';
(function(root){
  const TABS=['home','team','sessions','consumption','launches','projects','queue','tips','council','finances','journey','flow','brain','radar','ideias','chaves','revisao'];
  const WORDS={
    pt:{revisao:'Revisão',chaves:'Chaves',ideias:'Ideias',radar:'Radar',brain:'Cérebro',flow:'Mapa',council:'Conselho',finances:'Finanças',journey:'Sua linha do tempo',home:'Início',team:'Equipe',sessions:'Sessões',consumption:'Consumo',launches:'Lançamentos',projects:'Projetos',queue:'Fila',tips:'Alimente sua IA',waiting:'Esperando você',clear:'Tudo resolvido',oldest:'Mais antigo',open:'Abrir decisão',stage:'O palco',progress:'Fases concluídas',fullTeam:'Equipe completa',deadline:'Próximo prazo',launch:'Próximo lançamento',noDate:'Sem data registrada',noLaunch:'Nenhum prazo registrado',detail:'Ver detalhe',due:'Prazo alcançado',days:'dias',hours:'horas',minutes:'min',activity:'Atividade',ready:'Prontos',stalled:'Parados',work:'Trabalhos',owner:'Precisa de mim'},
    en:{revisao:'Review',chaves:'Switches',ideias:'Ideas',radar:'Radar',brain:'Brain',flow:'Map',council:'Council',finances:'Finances',journey:'Your timeline',home:'Home',team:'Team',sessions:'Sessions',consumption:'Usage',launches:'Launches',projects:'Projects',queue:'Queue',tips:'Feed your AI',waiting:'Waiting for you',clear:'All clear',oldest:'Oldest decision',open:'Open decision',stage:'The stage',progress:'Phases completed',fullTeam:'Full team',deadline:'Next deadline',launch:'Next launch',noDate:'No recorded time',noLaunch:'No recorded deadline',detail:'View details',due:'Time reached',days:'days',hours:'hours',minutes:'min',activity:'Activity',ready:'Ready',stalled:'Stalled',work:'Work',owner:'Needs me'},
    es:{revisao:'Revisión',chaves:'Opciones de tareas',ideias:'Ideas',radar:'Radar',brain:'Cerebro',flow:'Mapa',council:'Consejo',finances:'Finanzas',journey:'Tu línea del tiempo',home:'Inicio',team:'Equipo',sessions:'Sesiones',consumption:'Consumo',launches:'Lanzamientos',projects:'Proyectos',queue:'Cola',tips:'Alimenta tu IA',waiting:'Esperando tu decisión',clear:'Todo resuelto',oldest:'Más antigua',open:'Abrir decisión',stage:'El escenario',progress:'Fases completadas',fullTeam:'Equipo completo',deadline:'Próximo plazo',launch:'Próximo lanzamiento',noDate:'Sin hora registrada',noLaunch:'Ningún plazo registrado',detail:'Ver detalle',due:'Hora alcanzada',days:'días',hours:'horas',minutes:'min',activity:'Actividad',ready:'Listas',stalled:'Paradas',work:'Trabajos',owner:'Depende de mí'}
  };
  function stamp(value){if(typeof value!=='string'||!value.trim())return null;const time=Date.parse(value);return Number.isFinite(time)?time:null;}
  function oldestCards(cards){return [...cards].sort((a,b)=>(stamp(a.criado||a.createdAt)??Infinity)-(stamp(b.criado||b.createdAt)??Infinity));}
  function waitingItem(value,cards=oldestCards(value?.cards||[])){if(value?.ownerDecisionSource)cards=[];const needs=value?.needsAll||value?.needsItems||[];return cards.length?{kind:'card',value:cards[0]}:needs[0]?{kind:'need',value:needs[0]}:null;}
  function humanLabel(item,lang='pt'){
    const labels={pt:{decision:'Decisão pendente',approval:'Aprovação pendente',review:'Revisão pendente',mesa:'Mesa semanal'},en:{decision:'Pending decision',approval:'Pending approval',review:'Pending review',mesa:'Weekly table'},es:{decision:'Decisión pendiente',approval:'Aprobación pendiente',review:'Revisión pendiente',mesa:'Mesa semanal'}},words=labels[lang]||labels.en;
    const text=[item?.label,item?.shortTitle,item?.summary,item?.resumo,item?.title,item?.pergunta,item?.detail].filter(Boolean).join(' ');
    const subjects=[[/conserto visual do AGENTE-1/i,'Aprovar conserto visual dos robôs','Approve the assistente panel visual fix','Aprobar la corrección visual de robots'],[/pré-aprovação/i,'Confirmar atualização visual do atendimento','Confirm the visual atendimento update','Confirmar la actualización visual de atención'],[/painel publico.*(?:teste|lancamento)|lancamento.*painel publico/i,'Aprovar lançamento do painel público','Approve the public panel launch','Aprobar el lanzamiento del panel público'],[/confirmar.*(?:1o up|pré-aprovação)|primeiro uso.*pré-aprovação/i,'Confirmar atualização visual do atendimento','Confirm the visual atendimento update','Confirmar la actualización visual de atención'],[/lote de quarta/i,'Aprovar atualizações de quarta','Approve Wednesday updates','Aprobar actualizaciones del miércoles'],[/travas automaticas/i,'Ativar proteção automática','Enable automatic protection','Activar protección automática'],[/mande.*start.*telegram/i,'Iniciar o robô no Telegram','Start the Telegram assistente','Iniciar el robot en Telegram'],[/termos de uso/i,'Aprovar os termos de uso','Approve the terms of use','Aprobar los términos de uso'],[/custo.*ASSISTENTE/i,'Aprovar custo dos robôs','Approve the assistentes cost','Aprobar el costo de los robots'],[/criptografada|privado/i,'Conferir a cópia privada','Check the private copy','Revisar la copia privada'],[/cards.*push/i,'Aprovar publicação das mudanças','Approve publishing the changes','Aprobar la publicación'],[/telegram.*alarme/i,'Configurar alertas no Telegram','Configure Telegram alerts','Configurar alertas en Telegram'],[/teste cego.*voz/i,'Avaliar três versões de texto','Review three copy versions','Evaluar tres versiones de texto'],[/feedback.*previas/i,'Avaliar as prévias','Review the previews','Evaluar las vistas previas'],[/pons/i,'Aprovar atualização de dados','Approve the data update','Aprobar la actualización de datos'],[/codex.*gemini/i,'Escolher como usar as IA','Choose how to use the AI','Elegir cómo usar las IA'],[/raio.x.*carteira/i,'Escolher carteira para análise','Choose a wallet to analyse','Elegir una cartera para analizar'],[/sobras.*tracker/i,'Conferir os dados dos robôs','Check the assistentes data','Revisar los datos de los robots']];
    for(const [match,pt,en,es]of subjects)if(match.test(text))return lang==='pt'?pt:lang==='es'?es:en;
    if(item?.source==='ECONOMIA.md')return {pt:'Escolher regras da economia',en:'Choose the economy rules',es:'Elegir reglas de economía'}[lang]||words.decision;if(item?.source==='BOSS.md')return {pt:'Escolher regras do boss',en:'Choose the boss rules',es:'Elegir reglas del jefe'}[lang]||words.decision;
    if(/\bmesa[_\s]+semanal\b/i.test(text))return {pt:'Confirmar mesa semanal',en:'Confirm the weekly table',es:'Confirmar la mesa semanal'}[lang];
    if(/alchemy.*payg/i.test(text))return {pt:'Ativar cobrança do Alchemy',en:'Enable Alchemy billing',es:'Activar el cobro de Alchemy'}[lang];
    const type=String(item?.tipo||item?.type||'');if(/aprova|approval/i.test(type))return words.approval;if(/revis|review/i.test(type))return words.review;
    for(const value of [item?.label,item?.shortTitle,item?.summary,item?.resumo,item?.title]){
      const plain=String(value||'').trim();if(!plain||/\d|[_=\/\\{}<>`]|\.\.\.|\b(?:card|chat|true|false|UTC|BRT|api|arquivo|commit|deploy|antes de)\b/i.test(plain))continue;
      if(plain.split(/\s+/).length<=12)return plain.replace(/[\u2013\u2014]/g,',');
    }
    const subject=String(item?.title||item?.label||'').replace(/\([^)]*\)/g,'').replace(/\.\.\.$|…$/,'').trim();if(subject&&!/[\d_=\/\\{}<>]|\b(?:card|chat|true|false|UTC|BRT|api|arquivo|commit|deploy|antes de)\b/i.test(subject))return (root.PainelLinguagem?.text(subject,lang)||subject).split(/\s+/).slice(0,8).join(' ');
    return words.decision;
  }
  function launchAt(item){
    if(stamp(item.deadlineAt)!==null)return item.deadlineAt;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(item.dia||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.hora||''))return null;
    return item.dia+'T'+item.hora+':00-03:00';
  }
  function nextDue(snapshot,now=Date.now()){
    const entries=[],today=new Date(now-3*3600000).toISOString().slice(0,10),expiredDay=day=>/^\d{4}-\d{2}-\d{2}$/.test(day||'')&&day<today;
    for(const item of snapshot.launches?.items||[]){if(['no ar','pausado'].includes(item.estado)||expiredDay(item.dia))continue;const at=launchAt(item);if(stamp(at)!==null&&stamp(at)<now)continue;entries.push({kind:'launch',value:item,title:item.o_que,at,hard:Boolean(item.prazo_duro),sort:stamp(at)??stamp(item.dia+'T23:59:59-03:00')??Infinity});}
    for(const item of snapshot.tasks||[]){if(item.phase?.percent===100||!item.deadline||expiredDay(item.deadlineDay))continue;const at=item.deadlineAt||null;if(stamp(at)!==null&&stamp(at)<now)continue;entries.push({kind:'task',value:item,title:item.title,at,hard:true,sort:stamp(at)??stamp(item.deadlineDay+'T23:59:59-03:00')??Infinity});}
    for(const item of snapshot.deadlines||[]){if(stamp(item.at)===null||stamp(item.at)<now)continue;entries.push({kind:'deadline',value:item,title:item.text,at:item.at,hard:true,sort:stamp(item.at)});}
    const hard=entries.filter(item=>item.hard&&stamp(item.at)!==null).sort((a,b)=>a.sort-b.sort)[0];if(hard)return hard;
    for(const group of snapshot.equipe?.groups||[]){const delivery=group.delivery;if(!delivery||delivery.completedAt||group.agents?.length&&group.agents.every(agent=>agent.state==='done')||stamp(delivery.etaAt)===null)continue;entries.push({kind:'estimate',value:group,title:group.title,at:delivery.etaAt,hard:false,sort:stamp(delivery.etaAt)});}
    if(!entries.some(item=>Number.isFinite(item.sort)))for(const session of snapshot.operator?.sessions||[]){const delivery=session.node?.delivery;if(delivery?.etaAt)entries.push({kind:'estimate',value:session.node,title:session.name,at:delivery.etaAt,hard:false,sort:stamp(delivery.etaAt)});}
    return entries.filter(item=>Number.isFinite(item.sort)).sort((a,b)=>Number(stamp(a.at)===null)-Number(stamp(b.at)===null)||a.sort-b.sort)[0]||null;
  }
  function clock(value,now,words){const at=stamp(value);if(at===null)return '?';const ms=at-now;if(ms<=0)return words.due;if(ms>=86400000)return Math.ceil(ms/86400000)+' '+words.days;if(ms>=3600000)return Math.ceil(ms/3600000)+' '+words.hours;return Math.ceil(ms/60000)+' '+words.minutes;}
  let tab='home',snapshot=null,options={},next=null;
  function applyTab(value,notify=true){
    tab=TABS.includes(value)?value:'home';const doc=root.document;doc.documentElement.dataset.painelTab=tab;
    for(const key of TABS){doc.getElementById('panel-'+key).hidden=key!==tab;const button=doc.getElementById('tab-'+key);button.setAttribute('aria-selected',String(key===tab));button.tabIndex=key===tab?0:-1;}
    const stage=doc.getElementById('pipeline'),target=doc.getElementById(tab==='team'?'team-stage-host':'home-stage-host');if(stage.parentNode!==target)target.append(stage);
    if(notify){root.PainelV3?.redraw?.();doc.dispatchEvent(new root.CustomEvent('painel:tab-change',{detail:{tab}}));}
    return {tab};
  }
  function render(value,opts={}){
    snapshot=value;options=opts;const doc=root.document,words=WORDS[opts.lang]||WORDS.en,set=(id,text)=>{doc.getElementById(id).textContent=text;};
    const reading=root.PainelDadosAuditados?.source(value.updated,Date.now(),60000),live=reading?.age!==null&&reading?.age!==undefined&&!reading.old&&!reading.reason&&value.readerStatus==='ready';doc.getElementById('status').title=(value.readerStatus||'?')+' · '+(value.updated||'?');set('status',live?({pt:'Leitura recente',en:'Recent reading',es:'Lectura reciente'})[opts.lang]:reading?.age===null||!reading?({pt:'? sem hora da fonte',en:'? source time missing',es:'? falta hora de fuente'})[opts.lang]:({pt:'Leitura ',en:'Reading ',es:'Lectura '})[opts.lang]+reading.age+' min · '+(value.readerStatus||'?'));
    for(const key of TABS)set('tab-'+key,words[key]);for(const node of doc.querySelectorAll('[data-view-label]'))node.textContent=words[node.dataset.viewLabel];
    set('hero-title',({pt:'QUEM ESTÁ TRABALHANDO AGORA',en:'WHO IS WORKING NOW',es:'QUIÉN ESTÁ TRABAJANDO AHORA'}[opts.lang]||'WHO IS WORKING NOW'));let badge=doc.getElementById('home-project');if(!badge){badge=doc.createElement('span');badge.id='home-project';badge.className='eyebrow';doc.getElementById('hero-title').before(badge);}const project=value.projects?.find(item=>item.id===value.selectedProject);badge.textContent=(root.PainelLinguagem?.title(project?.name||'',opts.lang)||project?.name||'').replace(/\s*\([^)]*\)/g,'').toUpperCase();badge.hidden=!project;set('progress-note',words.progress);set('home-team',words.fullTeam+' ↗');set('work-title',words.queue);set('feature-title',words.work);set('feed-title',words.activity);set('launch-title',words.launches);doc.getElementById('ready').firstChild.textContent=words.ready;doc.getElementById('stalled').firstChild.textContent=words.stalled;set('owner-only',words.owner);
    const cards=value.ownerDecisionSource?[]:opts.cards||oldestCards(value.cards||[]),needs=value.needsAll||value.needsItems||[],waiting=value.management?.waiting?.count??value.needsCount;
    set('manage-wait-title',words.waiting);set('manage-wait-value',Number.isFinite(waiting)?waiting:'?');
    const pending=waitingItem(value,cards);set('home-oldest',pending?humanLabel(pending.value,opts.lang):(waiting===0?words.clear:words.noDate));set('manage-wait-note',waiting===0?words.clear:words.open+' ↗');doc.getElementById('manage-wait').classList.toggle('is-clear',waiting===0);
    next=nextDue(value,value.example?stamp(value.updated):Date.now());const estimate=next?.kind==='estimate';set('home-deadline-label',estimate?({pt:'Próxima entrega',en:'Next delivery',es:'Próxima entrega'}[opts.lang]||'Next delivery'):next?.kind==='launch'&&!next.hard?words.launch:words.deadline);set('home-deadline-title',next?.title||({pt:'Equipe acompanhada ao vivo',en:'Team activity is live',es:'Equipo seguido en vivo'}[opts.lang]||'Team activity is live'));set('home-countdown',next?estimate?'~'+new Date(stamp(next.at)-3*3600000).toISOString().slice(11,16):clock(next.at,value.example?stamp(value.updated):Date.now(),words):'');set('home-deadline-note',next?words.detail+' ↗':({pt:'Estimativa aparece no feed',en:'Estimate appears in the feed',es:'Estimación aparece en el feed'}[opts.lang]||'Estimate appears in the feed'));doc.getElementById('home-deadline').disabled=!next;
    if(!next){set('home-deadline-title',({pt:'Próxima atualização',en:'Next update',es:'Próxima actualización'}[opts.lang]||'Next update'));set('home-countdown','~'+new Date(Date.now()+15*60000-3*3600000).toISOString().slice(11,16));set('home-deadline-note',({pt:'Estimada · janela inicial de 15 min',en:'Estimated · initial 15 min window',es:'Estimada · ventana inicial de 15 min'}[opts.lang]||'Estimated · initial 15 min window'));}
    let activity=doc.getElementById('home-team-state');if(!activity){activity=doc.createElement('small');activity.id='home-team-state';activity.className='home-team-state';doc.getElementById('hero-title').after(activity);}const teamAgents=value.equipe?.agents||[];doc.querySelector('.home-stage')?.classList.toggle('is-empty',teamAgents.length===0);activity.hidden=teamAgents.length===0||teamAgents.some(agent=>['working','walking'].includes(agent.state));activity.textContent=({pt:'Sem agentes ativos',en:'No active agents',es:'Sin agentes activos'}[opts.lang]||'No active agents');
    if(next&&stamp(next.at)===null){const day=next.value.deadlineDay||next.value.dia;set('home-deadline-label',({pt:'Próxima data',en:'Next date',es:'Próxima fecha'}[opts.lang]||'Next date'));set('home-deadline-title',({pt:'Entregas previstas',en:'Planned deliveries',es:'Entregas previstas'}[opts.lang]||'Planned deliveries'));set('home-countdown',/^\d{4}-\d{2}-\d{2}$/.test(day||'')?day.slice(8)+'/'+day.slice(5,7):'');}
    if(next&&stamp(next.at)===null){const day=next.value.deadlineDay||next.value.dia;set('home-deadline-label',({pt:'Próxima data',en:'Next date',es:'Próxima fecha'}[opts.lang]||'Next date'));set('home-deadline-title',({pt:'Entregas previstas',en:'Planned deliveries',es:'Entregas previstas'}[opts.lang]||'Planned deliveries'));set('home-countdown',/^\d{4}-\d{2}-\d{2}$/.test(day||'')?day.slice(8)+'/'+day.slice(5,7):'');}
    if(next?.kind==='estimate'){const delivery=next.value.delivery;doc.getElementById('home-deadline').title=root.PainelEquipe?.forecastTip(delivery,opts.lang)||'';if(delivery?.estimated)set('home-deadline-note',({pt:'Estimada',en:'Estimated',es:'Estimada'}[opts.lang])+' · '+words.detail+' ↗');}
    const percent=value.progress?.percent,hero=doc.getElementById('total-percent');hero.hidden=!Number.isFinite(percent);hero.textContent=Number.isFinite(percent)?Math.round(percent)+'%':'';doc.getElementById('progress-note').hidden=!Number.isFinite(percent);if(Number.isFinite(percent))set('progress-note',({pt:'Itens concluídos',en:'Completed items',es:'Tareas completadas'}[opts.lang]||'Confirmed progress'));const countdown=doc.getElementById('home-countdown');countdown.hidden=!countdown.textContent||countdown.textContent==='?';if(next?.kind==='estimate'&&stamp(next.at)<(value.example?stamp(value.updated):Date.now()))set('home-deadline-note',({pt:'Estimativa vencida',en:'Estimate overdue',es:'Estimación vencida'}[opts.lang]||'Estimate overdue')+' · '+words.detail+' ↗');
  }
  function homeSummary(value){
    const weekly=family=>(value.credits?.[family]?.windows||[]).find(item=>item.minutes>=10000&&Number.isFinite(item.used)&&item.used>=0&&item.used<=100);
    const completed=Array.isArray(value.pipelineItems)?value.pipelineItems.filter(item=>['feito','noar'].includes(item.status)||item.phase?.key==='feito'):null;
    return {codex:weekly('codex'),claude:weekly('claude'),tokens:value.equipe?.tokens,waterMl:value.equipe?.waterMl,completedCount:completed?.length??null,lastCompleted:completed?.slice().sort((a,b)=>String(b.lastChangeAt||'').localeCompare(String(a.lastChangeAt||'')))[0]||null};
  }
  function homeResult(summary,lang='pt'){
    const w=(pt,en,es)=>lang==='pt'?pt:lang==='es'?es:en;
    return Number.isFinite(summary.completedCount)?summary.completedCount+' '+(summary.completedCount===1?w('trabalho concluído nesta fila','completed work item in this queue','trabajo terminado en esta cola'):w('trabalhos concluídos nesta fila','completed work items in this queue','trabajos terminados en esta cola')):w('As entregas aparecem depois da leitura','Deliveries appear after reading','Las entregas aparecen después de la lectura');
  }
  // porque o cartao redesenha a cada 30 s com o mesmo snapshot. Aceita reset em ISO ou em epoch de segundos (rate_limits do Codex).
  const CREDIT_MAX_AGE=2*3600000;
  function creditRow(credit,lang='pt',now=Date.now()){
    const w=(pt,en,es)=>lang==='pt'?pt:lang==='es'?es:en,two=n=>String(n).padStart(2,'0');
    const toMs=v=>typeof v==='number'&&Number.isFinite(v)&&v>0?(v<1e12?v*1000:v):typeof v==='string'&&v.trim()?Date.parse(v):NaN;
    const at=toMs(credit?.updated),known=Number.isFinite(at)&&at<=now+120000,age=known?Math.max(0,Math.floor((now-at)/60000)):null;
    const week=(credit?.windows||[]).find(item=>item.minutes>=10000&&Number.isFinite(item.used)&&item.used>=0&&item.used<=100);
    const reset=toMs(week?.reset),gone=Number.isFinite(reset)&&reset<=now,ok=!!week&&known&&now-at<=CREDIT_MAX_AGE&&!gone;
    const d=new Date((known?at:0)-3*3600000),n=new Date(now-3*3600000),hhmm=two(d.getUTCHours())+':'+two(d.getUTCMinutes()),sameDay=d.getUTCFullYear()===n.getUTCFullYear()&&d.getUTCMonth()===n.getUTCMonth()&&d.getUTCDate()===n.getUTCDate();
    const stamp=known?(sameDay?hhmm:two(d.getUTCDate())+'/'+two(d.getUTCMonth()+1)+' '+hhmm):null;
    const account=credit?.account?w(' · conta ',' · account ',' · cuenta ')+String(credit.account).slice(0,4):'';
    if(ok)return {state:'ok',value:week.used+'%',note:age<60?age+' min':Math.floor(age/60)+' h '+two(age%60)+' min',title:w('Crédito semanal da conta; leitura ','Weekly account credit; read ','Crédito semanal de la cuenta; lectura ')+stamp+account,readAt:new Date(at).toISOString(),ageMinutes:age};
    const why=gone?w('a semana já zerou','the week already reset','la semana ya se reinició'):known?w('leitura com mais de 2 h','reading older than 2 h','lectura de más de 2 h'):w('sem hora de leitura','no reading time','sin hora de lectura');
    return {state:'unknown',value:'?',note:stamp?w('lido ','read ','leído ')+stamp:w('sem leitura','no reading','sin lectura'),title:w('Sem leitura recente ('+why+')','No recent reading ('+why+')','Sin lectura reciente ('+why+')')+(stamp?w('; última leitura ','; last reading ','; última lectura ')+stamp:'')+account,readAt:known?new Date(at).toISOString():null,ageMinutes:age};
  }
  function renderHomeSummary(value,opts={}){
    const doc=root.document,lang=opts.lang||'pt',human=root.PainelLinguagem,w=(pt,en,es)=>lang==='pt'?pt:lang==='es'?es:en,summary=homeSummary(value),host=doc.getElementById('home-spend-facts');if(!host)return;
    host.replaceChildren();doc.getElementById('home-spend-title').textContent=w('Consumo e entregas registradas','Recorded usage and deliveries','Consumo y entregas registrados');
    const add=(label,value,title)=>{if(value===null||value===undefined)return;const box=doc.createElement('div'),term=doc.createElement('dt'),number=doc.createElement('dd');term.textContent=label;number.textContent=String(value);if(title)number.title=title;box.append(term,number);host.append(box);};
    for(const family of ['codex','claude']){const row=creditRow(value.credits?.[family],lang,value.example?Date.parse(value.updated):Date.now());add((family==='codex'?'Codex':'Claude')+w(' · semana usada',' · week used',' · semana usada')+' · '+row.note,row.value,row.title);if(host.lastElementChild){host.lastElementChild.dataset.lado=family;host.lastElementChild.classList.toggle('reading-old',row.state!=='ok');}}
    if(Number.isFinite(summary.tokens))add('Tokens',(value.equipe?.tokensExact===false?'≥ ':'')+(human?.number(summary.tokens,lang)||summary.tokens),(()=>{const at=Date.parse(value.equipe?.consumo?.desde);if(!Number.isFinite(at))return w('Tokens acumulados nestas conversas','Tokens accumulated in these conversations','Tokens acumulados en estas conversaciones');const d=new Date(at-3*3600000),two=n=>String(n).padStart(2,'0'),when=two(d.getUTCDate())+'/'+two(d.getUTCMonth()+1)+' '+two(d.getUTCHours())+':'+two(d.getUTCMinutes());return w('Tokens desde '+when+' (cada resposta 1 vez)','Tokens since '+when+' (each reply once)','Tokens desde '+when+' (cada respuesta 1 vez)');})());
    if(Number.isFinite(summary.waterMl))add(w('Água estimada','Estimated water','Agua estimada'),'~'+new Intl.NumberFormat(lang,{maximumFractionDigits:summary.waterMl>=100000?0:1}).format(summary.waterMl>=1000?summary.waterMl/1000:summary.waterMl)+(summary.waterMl>=1000?' L':' ml'),(value.equipe?.consumo?.agua?w('Data center + usina; estimativa, não medição','Data center + power plant; estimate, not a measurement','Centro de datos + central; estimación, no medición'):w('Estimativa pelos tokens, sem medição de água','Estimate from tokens, not a water measurement','Estimación por tokens, sin medición de agua')));
const result=doc.getElementById('home-result');result.textContent=homeResult(summary,lang);result.title=w('Contagem dos itens registrados como concluídos, sem afirmar receita ou publicação nova','Recorded completed items, not revenue or new publication','Trabajos registrados como terminados, sin afirmar ingresos ni publicación nueva');
    const age=Date.now()-Date.parse(value.credits?.claude?.updated);doc.getElementById('manage-wait-value').title=w('Pedidos pendentes neste projeto','Pending requests in this project','Solicitudes pendientes en este proyecto');host.querySelectorAll('div').forEach(box=>{if(box.querySelector('dt').textContent.startsWith('Claude')){box.classList.toggle('reading-old',age>30*60000);box.title=w('Leitura do crédito: ','Credit read: ','Lectura del crédito: ')+(human?.relative(value.credits?.claude?.updated,lang)||w('hora ainda não lida','time not read yet','hora aún no leída'));}});
    const pending=waitingItem(value,opts.cards||oldestCards(value.cards||[]));if(pending){const item=pending.value,label=pending.kind==='need'?humanLabel(item,lang):human?.title(item.pergunta||item.label||item.summary||item.resumo||item.title,lang);let scope=doc.getElementById('home-approval-scope');if(!scope){scope=doc.createElement('span');scope.id='home-approval-scope';scope.className='home-approval-scope';doc.getElementById('home-oldest').after(scope);}const packageScope=root.PainelClareza?.approvalScope(item,lang);scope.textContent=packageScope?packageScope.parts.map(p=>p.label).join(' · '):/conserto visual.*AGENTE-1/i.test(item.detail||'')?'Luz e texto sem sobreposição':'';scope.hidden=!scope.textContent;if(label)doc.getElementById('home-oldest').textContent=label.split(/\s+/).slice(0,18).join(' ');const choice=(item.opcoes||[]).find((option,index)=>option.recommended===true||option.recomendada===true||index===item.recomendada);const recommendation=pending.kind==='need'&&/recomendada/i.test(item.detail||'')?(/confirmar.*(?:1o up|pré-aprovação)/i.test(item.detail)?w('Publicar só texto e visual','Publish copy and visuals only','Publicar solo texto y diseño'):/lote de quarta/i.test(item.detail)?w('Publicar após as revisões','Publish after reviews','Publicar tras las revisiones'):/travas automaticas/i.test(item.detail)?w('Ativar após as revisões','Enable after reviews','Activar tras las revisiones'):null):null;if(recommendation)doc.getElementById('manage-wait-note').textContent=w('Recomendado: ','Recommended: ','Recomendado: ')+recommendation;if(choice)doc.getElementById('manage-wait-note').textContent=w('Recomendado: ','Recommended: ','Recomendado: ')+(human?.text(choice.label,lang)||choice.label);}
    doc.getElementById('manage-wait-note').hidden=!pending;
    doc.getElementById('manage-wait-title').textContent=w('O que precisa de você','What needs you','Qué te necesita');
    doc.getElementById('home-spend-details').textContent=w('Detalhes do consumo ↗','Usage details ↗','Detalles del consumo ↗');
    const team=root.PainelEquipe?.homeFronts?.(value)||value.equipe?.agents||[],empty=!team.length;doc.querySelector('.home-stage')?.classList.toggle('is-empty',empty);doc.getElementById('home-team').dataset.empty=String(empty);doc.getElementById('home-team').textContent=empty?w('Ver trabalhos deste projeto ↗','View project work ↗','Ver trabajos del proyecto ↗'):w('Ver toda a equipe ↗','See the whole team ↗','Ver todo el equipo ↗');
    let read=doc.getElementById('home-consumption-read');if(!read){read=doc.createElement('small');read.id='home-consumption-read';doc.getElementById('home-result').after(read);}const measure=value.equipe?.consumption,measuredAt=measure?.lastMeasurementAt||measure?.readAt,measurement=root.PainelDadosAuditados?.source(measuredAt,Date.now(),7200000);read.textContent=measure&&Number.isFinite(Date.parse(measuredAt))?w('Conversas acompanhadas · leitura ','Tracked conversations · read ','Conversaciones seguidas · lectura ')+new Intl.DateTimeFormat(lang,{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo',hourCycle:'h23'}).format(new Date(measuredAt))+' · '+(measurement?.age??'?')+' min'+(measurement?.old?w(' · antiga',' · old',' · antigua'):'')+(measure.frescor&&measure.frescor.velho?' · ? Solução: '+measure.frescor.solucao:''):'? '+w('medição sem horário','measurement time missing','medición sin hora');read.title=measure?w('Totais acumulados das mesmas conversas, conservados desde ','Cumulative totals from the same conversations, retained since ','Totales acumulados de las mismas conversaciones, conservados desde ')+measure.firstReadAt:'';
    const stale=doc.getElementById('claude-read');if(stale){stale.classList.toggle('reading-old',age>30*60000);stale.textContent=w('Leitura ','Read ','Lectura ')+(human?.relative(value.credits?.claude?.updated,lang)||w('ainda sem horário','time pending','hora pendiente'));}
  }
  const api={TABS,oldestCards,waitingItem,humanLabel,launchAt,nextDue,clock,render,homeSummary,homeResult,renderHomeSummary,creditRow,select:applyTab};
  if(typeof module==='object'&&module.exports){module.exports=api;return;}
  root.PainelVisao=api;root.painelTabState={get:()=>({tab}),restore:state=>applyTab(state?.tab||'home')};
  for(const button of root.document.querySelectorAll('[data-panel-tab]')){button.addEventListener('click',()=>applyTab(button.dataset.panelTab));button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const index=TABS.indexOf(tab),target=event.key==='Home'?TABS[0]:event.key==='End'?TABS.at(-1):TABS[(index+(event.key==='ArrowRight'?1:-1)+TABS.length)%TABS.length];applyTab(target);root.document.getElementById('tab-'+target).focus();});}
  root.document.getElementById('home-team').addEventListener('click',()=>applyTab(root.document.getElementById('home-team').dataset.empty==='true'?'queue':'team'));root.document.getElementById('home-spend-details')?.addEventListener('click',()=>applyTab('consumption'));root.document.getElementById('home-deadline').addEventListener('click',()=>{if(next?.kind==='estimate')applyTab('team');else if(next)root.PainelV3?.openDue?.(next);});
  applyTab(root.document.documentElement.dataset.painelTab||'home',false);root.PainelV3?.redraw?.();
  const timer=root.setInterval(()=>{if(snapshot&&!root.document.hidden){render(snapshot,options);renderHomeSummary(snapshot,options);}},30000);root.addEventListener('pagehide',()=>root.clearInterval(timer),{once:true});
})(typeof window==='object'?window:globalThis);

/* acesso.js */
'use strict';
// Keep Tab inside the active native dialog and preserve Escape's native return.
document.addEventListener('keydown',event=>{
 if(event.key!=='Tab')return;const dialog=document.querySelector('dialog[open]');if(!dialog)return;
 const nodes=[...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),summary,[tabindex="0"]')].filter(n=>!n.hidden&&n.getBoundingClientRect().width&&n.getBoundingClientRect().height);
 const first=nodes[0],last=nodes.at(-1);if(!first)return;
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
},true);

// A local choice also stops programmatic motion; no server state is changed.
(function(){
 const key='app-panel-motion',button=document.createElement('button'),query=matchMedia('(prefers-reduced-motion: reduce)');let stored=null;
 try{stored=localStorage.getItem(key);}catch{}
 let off=stored==='off';/* 04/10: ligado por padrao no painel local; so a sua escolha desliga */button.id='motion-toggle';button.type='button';button.className='motion-toggle';
 function paint(){document.documentElement.dataset.motion=off?'off':'on';button.setAttribute('aria-pressed',String(off));const lang=document.documentElement.lang;
  button.textContent=lang==='pt'?'Movimento '+(off?'off':'on'):lang==='es'?'Movimiento '+(off?'off':'on'):'Motion '+(off?'off':'on');
  if(off)for(const animation of document.getAnimations())animation.cancel();
 }
 button.addEventListener('click',()=>{off=!off;stored=off?'off':'on';try{localStorage.setItem(key,stored);}catch{}paint();});
 query.addEventListener('change',()=>{if(stored===null){off=false;paint();}});
 new MutationObserver(paint).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});const options=document.getElementById('panel-settings-options');options?.append(button);for(const id of ['fullscreen','refresh']){const control=document.getElementById(id);if(control)options?.append(control);}paint();
})();

// Put the existing chat action in the header on small screens, outside cards.
(()=>{
 const media=matchMedia('(max-width:900px)');let bound=false;
 function place(){const button=document.getElementById('painel-chat-trigger'),header=document.querySelector('.header-actions');if(!button||!header)return false;if(media.matches){if(button.parentNode!==header)header.prepend(button);}else if(button.parentNode!==document.body)document.body.append(button);if(!bound){media.addEventListener('change',place);bound=true;}return true;}
 if(!place()){const observer=new MutationObserver(()=>{if(place())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});}
})();

/* dev.js */
'use strict';
(function(scope){
  const KEY='painel-dev-resume-v1',TABS=new Set(['home','team','sessions','consumption','launches','projects','queue','tips','council','finances','journey','flow','brain','radar','ideias']);
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
