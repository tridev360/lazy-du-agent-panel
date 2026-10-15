'use strict';
const translations={
en:{house:'HOUSE PANEL',local:'On your PC',fullscreen:'Full screen',thisWeek:'THIS WEEK, IN MOTION',queue:'The queue is moving.',you:'YOU',onAir:'LIVE',now:'NOW',next:'NEXT',remaining:'remaining',needsYou:'NEEDS YOU',yourMove:'your move',choices:'Choices and next steps',ready:'Ready',stalled:'Stalled',notes:'Notes',withDeadline:'With deadline',onlyMe:'Needs me',seeAll:'See all',details:'DETAILS',footer:'Local. Refreshes every 30 seconds. BRT.',all:'All',none:'Nothing here yet',unread:'Not read',measured:'measured',items:'items',freeResets:'free resets',reset:'Resets',tomorrow:'tomorrow',today:'today',noReset:'Reset not recorded',openSession:'Open the session',approve:'Approve in the session chat',missingLink:'Session link not provided',tests:'Tests',pending:'Claude review',log:'Log and evidence',phaseHint:'Recorded phases, not time spent. Unknown phases are excluded from the average.',source:'Reading source',lastLog:'Last log',daysWithout:'days without a new log',noDeadlineHour:'No exact time recorded',overdue:'Time reached',expires:'left',days:'d',hours:'h',min:'m',failure:'Could not refresh. The previous reading stays visible.',chooseError:'Could not save. Refresh and try again.',saved:'Choice saved',exampleSaved:'Example answered',reward:'New feature live!',example:'EXAMPLE',demo:'Example only. This choice does not enter the decision queue.',live:'Live now',decisions:'Latest decisions',sessions:'Session checkpoints',phase:['New','Doing','Ready','In review','Released','Live','Paused','Stalled 3+ days','No stage']},
pt:{house:'PAINEL DA CASA',local:'No seu PC',fullscreen:'Tela cheia',thisWeek:'ESTA SEMANA, EM MOVIMENTO',queue:'A FILA ESTÁ ANDANDO.',you:'VOCÊ',onAir:'NO AR',now:'AGORA',next:'PRÓXIMOS',remaining:'restante',needsYou:'PRECISA DE VOCÊ',yourMove:'sua vez',choices:'Escolhas e próximos passos',ready:'Prontos',stalled:'Parados',notes:'Notas',withDeadline:'Com prazo',onlyMe:'Só o que precisa de mim',seeAll:'Ver tudo',details:'DETALHES',footer:'Local. Atualiza a cada 30 segundos. BRT.',all:'Todas',none:'Nada por aqui ainda',unread:'Não lido',measured:'medidos',items:'itens',freeResets:'resets livres',reset:'Zera',tomorrow:'amanhã',today:'hoje',noReset:'Reset sem data registrada',openSession:'Abrir a sessão',approve:'Aprovar no chat da sessão',missingLink:'Link da sessão não informado',tests:'Testes',pending:'Revisão do Claude',log:'Log e evidência',phaseHint:'Fases registradas, não tempo gasto. Fases desconhecidas ficam fora da média.',source:'Fonte da leitura',lastLog:'Último log',daysWithout:'dias sem log novo',noDeadlineHour:'Sem hora exata registrada',overdue:'Hora alcançada',expires:'restantes',days:'d',hours:'h',min:'m',failure:'Não foi possível atualizar. A leitura anterior continua visível.',chooseError:'Não foi possível salvar. Atualize e tente de novo.',saved:'Escolha salva',exampleSaved:'Exemplo respondido',reward:'Feature nova no ar!',example:'EXEMPLO',demo:'Só um exemplo. A escolha não entra na fila de decisões.',live:'No ar agora',decisions:'Decisões mais recentes',sessions:'Ponto de cada sessão',phase:['Nova','Fazendo','Pronta','Em revisão','Liberada','No ar','Parado','Parado há 3 dias ou mais','Sem etapa']},
es:{house:'PANEL DE LA CASA',local:'En tu PC',fullscreen:'Pantalla completa',thisWeek:'ESTA SEMANA, EN MOVIMIENTO',queue:'La cola avanza.',you:'TÚ',onAir:'EN VIVO',now:'AHORA',next:'PRÓXIMOS',remaining:'restante',needsYou:'DEPENDE DE TI',yourMove:'tu turno',choices:'Elecciones y próximos pasos',ready:'Listas',stalled:'Paradas',notes:'Notas',withDeadline:'Con plazo',onlyMe:'Solo lo que me necesita',seeAll:'Ver todo',details:'DETALLES',footer:'Local. Se actualiza cada 30 segundos. BRT.',all:'Todas',none:'Nada por aquí todavía',unread:'No leído',measured:'medidos',items:'elementos',freeResets:'resets libres',reset:'Se reinicia',tomorrow:'mañana',today:'hoy',noReset:'Reset sin fecha registrada',openSession:'Abrir la sesión',approve:'Aprobar en el chat de la sesión',missingLink:'Falta el enlace de la sesión',tests:'Pruebas',pending:'Revisión de Claude',log:'Registro y evidencia',phaseHint:'Fases registradas, no tiempo invertido. Las fases desconocidas quedan fuera del promedio.',source:'Fuente de lectura',lastLog:'Último registro',daysWithout:'días sin registro nuevo',noDeadlineHour:'Sin hora exacta registrada',overdue:'Hora alcanzada',expires:'restantes',days:'d',hours:'h',min:'m',failure:'No se pudo actualizar. La lectura anterior sigue visible.',chooseError:'No se pudo guardar. Actualiza e inténtalo de nuevo.',saved:'Elección guardada',exampleSaved:'Ejemplo respondido',reward:'¡Nueva feature en vivo!',example:'EJEMPLO',demo:'Solo un ejemplo. La elección no entra en la cola de decisiones.',live:'En vivo ahora',decisions:'Decisiones recientes',sessions:'Estado de cada sesión',phase:['Nueva','En curso','Lista','En revisión','Liberada','En vivo','Parado','Parado hace 3 días o más','Sin etapa']}
};
const exampleMode=new URLSearchParams(window.location.search).get('exemplo')==='1';
const apiUrl=route=>route+(exampleMode?'?exemplo=1':window.Painel128Local?.enabled()?'?painel128=1':'');
let lang=document.documentElement.dataset.kitIdioma||localStorage.getItem('painel-language')||'pt',data=null,latestSnapshot=null,busy=false,previousPhases=null,toastTimer=null;
if(!translations[lang])lang='en';
const $=id=>document.getElementById(id),t=key=>translations[lang][key];
const filters={owner:'',executor:'',deadlineOnly:false,needsOwner:false},phaseKeys=['new','doing','ready','review','released','live','paused','stalled','none'];
let selectedPhase='doing';
function element(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=window.PainelLinguagem?.text(text,lang)??String(text);if(className)node.className=className;return node;}
function brt(value){
  if(typeof value!=='string' || !value.trim())return t('unread');
  const date=new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(lang,{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'America/Sao_Paulo'}).format(date)+' BRT' : t('unread');
}
function textBrt(value){
  let text=String(value ?? '');
  text=text.replace(/\b20\d{2}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?\s*(?:Z|[+-]\d{2}:?\d{2})\b/g,stamp=>{
    const normalized=stamp.replace(' ','T').replace(/\s+(?=[+-]\d{2}:?\d{2}$)/,'');
    return Number.isFinite(Date.parse(normalized)) ? brt(normalized) : stamp;
  });
  const ref=new Date(data?.updated || Date.now());
  text=text.replace(/\b(\d{2})\/(\d{2})(?:\/(20\d{2}))?\s+(\d{2}):(\d{2})\s+UTC\b/gi,(stamp,day,month,year,hour,minute)=>{
    const date=new Date(Date.UTC(Number(year || ref.getUTCFullYear()),Number(month)-1,Number(day),Number(hour),Number(minute)));
    if(date.getUTCDate()!==Number(day)||date.getUTCMonth()!==Number(month)-1||date.getUTCHours()!==Number(hour)||date.getUTCMinutes()!==Number(minute))return stamp;
    return brt(date.toISOString());
  });
  const weekdays=['dom','seg','ter','qua','qui','sex','sab'];
  text=text.replace(/\b(?:(dom|seg|ter|qua|qui|sex|sab)\s+)?([01]\d|2[0-3]):([0-5]\d)\s+UTC\b/gi,(stamp,day,hour,minute)=>{
    const h=Number(hour)-3,prefix=day?weekdays[(weekdays.indexOf(day.toLowerCase())+(h<0?6:0))%7]+' ':'';
    return prefix+String((h+24)%24).padStart(2,'0')+':'+minute+' BRT';
  });
  text=text.replace(/\b(?:(dom|seg|ter|qua|qui|sex|sab)\s+)?([01]?\d|2[0-3])\s+UTC\b/gi,(stamp,day,hour)=>{
    const h=Number(hour)-3,prefix=day?weekdays[(weekdays.indexOf(day.toLowerCase())+(h<0?6:0))%7]+' ':'';
    return prefix+String((h+24)%24).padStart(2,'0')+':00 BRT';
  });
  return text;
}
function countdown(value){const ms=Date.parse(value)-(data?.example?Date.parse(data.updated):Date.now());if(!Number.isFinite(ms))return t('noDeadlineHour');if(ms<=0)return t('overdue');const mins=Math.ceil(ms/60000),days=Math.floor(mins/1440),hours=Math.floor((mins%1440)/60);return `${days?days+t('days')+' ':''}${hours?hours+t('hours')+' ':''}${mins%60}${t('min')} ${t('expires')}`;}

function shortTitle(value,max=40){return (window.PainelLinguagem?.title(textBrt(value||t('unread')),lang)||textBrt(value||t('unread'))).replace(/[\r\n]+/g,' ').trim().replace(/[—–]/g,',').slice(0,max);}
function phaseOf(work){const una=typeof window!=='undefined'&&window.PainelFila?.etapa(work.id);if(una)return una;const key={nova:'new',aberta:'new',andando:'doing',commit:'ready',revisada:'review',liberado:'released',feito:'live',adiada:'paused'}[work.phase?.key];if(key)return key;const state=String(work.state||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[-_]+/g,' ').trim();return /^(?:revisad[oa]|em revisao|revisao|review|pode subir|pront[oa] para (?:subir|card))\b/.test(state)?'review':'new';}
function itemTone(item){return item.needsOwner?'owner':item.status==='noar'||item.phase?.key==='feito'?'live':item.executor==='codex'?'codex':'claude';}
function ownerTokens(work){const found=String(work.owner||'').match(/\b(?:ATENDIMENTO|ASSISTENTE|CONTENT|GAMES|LOJA|CORTES|COORDENACAO|COORDENADOR|CODEX)\b/g)||[];const names=[...new Set(found.map(name=>name==='COORDENACAO'?'COORDENADOR':name))];return names.length?names:[({pt:'Responsável a confirmar',en:'Coordinator to confirm',es:'Responsable por confirmar'}[lang])];}
function actorLabel(item){if(/^Codex(?: \d+)?$/.test(item.actor||''))return item.actor;const names=ownerTokens(item);return (names[0]==='COORDENADOR'?'Claude':names[0])+(names.length>1?' +'+(names.length-1):'');}
function numeric(value){return typeof value==='number'&&Number.isFinite(value);}
function meter(value){const host=element('div',undefined,'mini-meter'),fill=element('i');if(numeric(value))fill.style.setProperty('--amount',Math.min(100,Math.max(0,value))+'%');host.append(fill);return host;}
function showToast(text,celebrate=false){const host=$('toast');host.textContent=text;host.hidden=false;host.className=celebrate?'celebrate':'';clearTimeout(toastTimer);toastTimer=setTimeout(()=>host.hidden=true,3500);}
function drawer(title,nodes){$('drawer-title').textContent=window.PainelLinguagem?.title(title,lang)??title;$('drawer-body').replaceChildren(...nodes);if(!$('drawer').open)$('drawer').showModal();}
function detailBlock(title,text){const block=element('section');block.append(element('h3',title),element('p',window.PainelLinguagem?.text(textBrt(text||t('none')),lang)??textBrt(text||t('none'))));return block;}
function taskDetails(work){if(window.PainelDetalhes)return window.PainelDetalhes.open(work,{lang,drawer,brt});drawer(work.title||work.id,[element('p',work.owner+' · '+(work.actor||'Claude')+' · '+(translations[lang].phase[phaseKeys.indexOf(phaseOf(work))]||t('unread'))),element('p',work.deadline?textBrt(work.deadline):t('noDeadlineHour')),detailBlock(t('log'),[work.id,work.phase?.evidence,work.log].filter(Boolean).join('\n\n'))]);}
function itemDetails(item){const work=(data.tasks||[]).find(x=>(item.taskIds||[]).includes(x.id));if(item.source==='task'&&work)return taskDetails(work);if(window.PainelDetalhes)return window.PainelDetalhes.open(item,{lang,drawer,brt});drawer(item.title,[element('p',(item.actor||item.executor||'')+' · '+(numeric(item.percent)?item.percent+'%':t('unread'))),detailBlock(t('details'),item.details),...work?[detailBlock(t('log'),work.log)]:[]]);}
function showReady(){drawer(t('ready'),(data.readyBranches||[]).map(branch=>{const work=(data.tasks||[]).find(item=>item.id===branch.task),title=work?.title||branch.title,button=element('button',shortTitle(title,65),'drawer-row');button.addEventListener('click',()=>window.PainelDetalhes.open(work||{title,summary:title,phase:{label:({pt:'Pronto para revisão',en:'Ready for review',es:'Listo para revisión'}[lang])},nextStep:branch.pending},{lang,drawer,brt}));return button;}));}
function showStalled(){if(typeof window!=='undefined'&&window.PainelFila?.ok()){const groups=new Map(),byId=new Map((data.tasks||[]).map(x=>[x.id,x]));for(const item of window.PainelFila.parados()){const quem=item.quem||'Sem dono';if(!groups.has(quem))groups.set(quem,[]);groups.get(quem).push(item);}drawer(t('stalled'),[element('p',window.PainelFila.paradosRegra()),...[...groups].map(([quem,itens])=>{const section=element('section');section.append(element('h3',quem+' · '+itens.length));for(const item of itens){const button=element('button',item.titulo+' · '+item.paradoTexto,'drawer-row');button.addEventListener('click',()=>{const work=byId.get(item.chave);if(work)taskDetails(work);});section.append(button);}return section;})]);return;}const groups=new Map();for(const work of data.stalledTasks||[]){if(!groups.has(work.owner))groups.set(work.owner,[]);groups.get(work.owner).push(work);}drawer(t('stalled'),[...groups].map(([owner,tasks])=>{const section=element('section');section.append(element('h3',owner+' · '+tasks.length));for(const work of tasks){const button=element('button',shortTitle(work.title||work.id,60)+' · '+Math.floor((Date.parse(data.updated)-Date.parse(work.lastLogAt))/86400000)+' '+t('daysWithout'),'drawer-row');button.addEventListener('click',()=>taskDetails(work));section.append(button);}return section;}));}
function showNeeds(){if(window.Painel128Local?.enabled()){window.Painel128Local.showCards();return;}const buttons=list=>(list||[]).map(item=>{const label=window.PainelVisao?.humanLabel(item,lang)||shortTitle(item.title,100),button=element('button',label,'drawer-row');button.addEventListener('click',()=>window.PainelDetalhes.open({...item,title:label,summary:label,needsOwner:true},{lang,drawer,brt}));return button;});const nodes=buttons(data.needsAll||data.needsItems);if(data.needsDeferred?.length){const group=element('details',undefined,'quiet-details');group.append(element('summary',({pt:'Sem hora definida',en:'Without a set time',es:'Sin hora definida'}[lang])),...buttons(data.needsDeferred));nodes.push(group);}drawer(t('needsYou'),nodes);}
function showNotes(){drawer(t('notes'),[detailBlock(t('live'),data.live),detailBlock(t('decisions'),(data.decisions||[]).join('\n')),detailBlock(t('sessions'),(data.states||[]).filter(x=>!['codex','fila-codex'].includes(x.id)).map(x=>x.id+' · '+(x.updatedAt?brt(x.updatedAt):textBrt(x.updated))+'\n'+x.point).join('\n\n')),detailBlock(t('phaseHint'),t('phaseHint')),detailBlock(t('details'),data.codex)]);}
function renderPipeline(){if(window.Painel128Local?.enabled()){window.PainelEquipe?.destroy?.($('pipeline'));window.PainelMapa?.destroy?.($('pipeline'));$('pipeline').replaceChildren();$('pipeline').hidden=true;return;}$('pipeline').hidden=false;const items=data.pipelineItems||[],progress=window.PainelEquipe&&data.equipe?window.PainelEquipe.progressOf(data.equipe.progress):data.progress||{percent:null};$('total-percent').textContent=numeric(progress.percent)?Math.round(progress.percent)+'%':'?';if(window.PainelEquipe&&data.equipe){window.PainelMapa?.destroy?.($('pipeline'));window.PainelEquipe.render(data,$('pipeline'),{lang,mode:document.documentElement.dataset.painelTab==='team'?'team':'home',consumptionHost:$('consumption-host')});window.PainelEquipe.enableDetails($('pipeline'),false);}else if(window.PainelMapa)window.PainelMapa.render($('pipeline'),data,{lang,onSelect:itemDetails});}
function renderStrips(){const items=data.pipelineItems||[],stalled=new Set((data.stalledTasks||[]).map(x=>x.id)),current=items.filter(x=>!stalled.has(x.id)&&(['pegou','andando'].includes(x.status)||x.source==='task'&&x.phase?.key==='andando')),next=data.nextItems||[];for(const [id,list] of [['now',current],['next',next]]){const host=$(id);host.replaceChildren();for(const item of list){const button=element('button',undefined,'work-item '+itemTone(item));button.append(element('span',actorLabel(item),'actor'),element('strong',shortTitle(item.title)),meter(item.percent));button.addEventListener('click',()=>itemDetails(item));host.append(button);}if(!list.length)host.append(element('p',t('none'),'empty'));}}
function resetLabel(value){if(!value)return t('noReset');const normalized=window.PainelCreditoModelo?.instant(value)||value,date=new Date(normalized);if(!Number.isFinite(date.getTime()))return t('noReset');const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(data.updated));const next=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.parse(data.updated)+86400000));const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);const clock=new Intl.DateTimeFormat(lang,{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);value=normalized;return t('reset')+' '+(day===today?t('today')+' '+clock:day===next?t('tomorrow')+' '+clock:brt(value));}
function creditoVelho(who,credit){const at=Date.parse(credit?.updated||'');return who==='claude'&&Number.isFinite(at)&&Date.now()-at>2*3600000;}
function renderCredits(){for(const who of ['claude','codex']){const credit=data.credits?.[who],windows=credit?.windows||[],main=windows.find(x=>x.minutes>=10000)||null,remaining=main&&!creditoVelho(who,credit)?Math.round(main.used*10)/10:null;const ring=$(who+'-ring');ring.style.setProperty('--amount',numeric(remaining)?remaining+'%':'0%');ring.firstElementChild.textContent=numeric(remaining)?remaining+'%':'?';ring.setAttribute('aria-label',(numeric(remaining)?remaining+'%':'?')+' '+({pt:'da semana usado',en:'weekly used',es:'semanal usado'}[lang]||'weekly used'));ring.parentElement.title=ring.getAttribute('aria-label')+' · '+(credit?.updated||'?');const reading=$(who+'-read');if(reading){const age=credit?.updated&&Number.isFinite(Date.parse(credit.updated))?Math.max(0,Math.floor((Date.now()-Date.parse(credit.updated))/60000)):null;reading.textContent=age===null?({pt:'Sem leitura',en:'Unread',es:'Sin lectura'}[lang]):age<1?({pt:'Lido agora',en:'Read just now',es:'Leído ahora'}[lang]):({pt:'Leitura há ',en:'Read ',es:'Lectura hace '}[lang])+(age>=60?Math.floor(age/60)+' h'+(age%60?' '+(age%60)+' min':''):age+' min')+(lang==='en'?' ago':'');if(creditoVelho(who,credit))reading.textContent+=({pt:' · ? Solução: o Coordenador lê no próximo tique',en:' · ? Fix: Coordenador reads it on the next round',es:' · ? Solución: Coordenador lo lee en la próxima vuelta'}[lang]||'');reading.title=credit?.updated||'';}if(who==='claude')$('claude-reset').textContent=resetLabel(main?.reset);else {$('codex-reset').textContent=resetLabel(main?.reset);$('codex-resets').textContent=resetsText(credit);$('codex-resets').classList.toggle('reading-old',resetsOld(credit));} }const count=data.needsCount??(data.cards||[]).filter(x=>!x.exemplo).length+(data.needsTotal||0);$('owner-ring').firstElementChild.textContent=count;$('owner-ring').style.setProperty('--amount',count? '100%':'0%');$('move-count').textContent=count;}
function resetsAge(credit){const at=Date.parse(credit?.resetsUpdated);if(!Number.isFinite(at))return null;return Math.max(0,Date.parse(data?.updated||new Date().toISOString())-at);}
function resetsOld(credit){const age=resetsAge(credit);return age!==null&&age>24*3600000;}
function resetsText(credit){const n=credit?.resetsAvailable;if(!Number.isInteger(n))return ({pt:'resets livres: ?',en:'free resets: ?',es:'resets libres: ?'})[lang]||'?';const words={pt:[n===1?'reset livre':'resets livres','lido há','leitura velha'],en:[n===1?'free reset':'free resets','read','old reading'],es:[n===1?'reset libre':'resets libres','leído hace','lectura vieja']}[lang]||[t('freeResets'),'',''];const age=resetsAge(credit);if(age===null)return n+' '+words[0]+' · ?';const min=Math.round(age/60000),ago=min<60?min+' min':min<2880?Math.round(min/60)+' h':Math.round(min/1440)+(lang==='en'?' d':' d');return n+' '+words[0]+' · '+(lang==='en'?words[1]+' '+ago+' ago':words[1]+' '+ago)+(resetsOld(credit)?' · '+words[2]:'');}
function creditDetails(who){const reading=data.credits?.[who];drawer(who.toUpperCase(),[detailBlock(t('source'),[reading?.source,brt(reading?.updated),who==='codex'&&Number.isInteger(reading?.resetsAvailable)?resetsText(reading)+' · '+brt(reading.resetsUpdated):''].filter(Boolean).join('\n')),detailBlock(t('details'),(reading?.windows||[]).map(x=>x.minutes+' min · '+x.used+'% · '+brt(window.PainelCreditoModelo?.instant(x.reset)||x.reset)).join('\n'))]);}
function renderDeadlines(){const host=$('deadline-strip');host.replaceChildren();const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(data.updated));const items=(data.tasks||[]).filter(x=>x.deadline&&(x.deadlineAt||x.deadlineDay)&&x.phase?.percent!==100).sort((a,b)=>(a.deadlineAt||a.deadlineDay).localeCompare(b.deadlineAt||b.deadlineDay)).slice(0,6);for(const work of items){const button=element('button',undefined,'deadline-pill');button.append(element('span',shortTitle(work.title,28)),element('strong',work.deadlineAt?countdown(work.deadlineAt):work.deadlineDay.split('-').slice(1).reverse().join('/')));button.addEventListener('click',()=>taskDetails(work));host.append(button);}if(!items.length)for(const deadline of (data.deadlines||[]).slice(0,3)){const button=element('button',undefined,'deadline-pill');button.append(element('span',t('withDeadline')),element('strong',countdown(deadline.at)));button.addEventListener('click',()=>drawer(t('withDeadline'),[detailBlock(t('details'),deadline.text),element('p',deadline.at?brt(deadline.at):t('noDeadlineHour'))]));host.append(button);}}
function filteredTasks(){const stalled=new Set(typeof window!=='undefined'&&window.PainelFila?.ok()?[]:(data.stalledTasks||[]).map(x=>x.id));return (data.tasks||[]).filter(work=>!stalled.has(work.id)&&(!filters.owner||ownerTokens(work).includes(filters.owner))&&(!filters.executor||work.executor===filters.executor)&&(!filters.deadlineOnly||work.deadline)&&(!filters.needsOwner||work.needsOwner));}
let selectedLaunchDay=null;
function launchDayLabel(day,reference) {
  if(!day)return 'Sem data';
  const local=new Date(Date.parse(reference)-3*3600000),today=local.toISOString().slice(0,10);
  if(day===today)return 'Hoje';
  if(day===new Date(Date.parse(today+'T12:00:00Z')+86400000).toISOString().slice(0,10))return 'Amanhã';
  const date=new Date(day+'T12:00:00Z');
  return ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][date.getUTCDay()]+' '+day.slice(8)+'/'+day.slice(5,7);
}
function launchTimeLabel(value){const raw=String(value||'');if(/^~?\d{1,2}:\d{2}$/.test(raw))return raw;if(/card.*19:00.*depois/i.test(raw))return ({pt:'Após confirmação das 19h',en:'After the 19h approval',es:'Después de confirmar a las 19h'}[lang]);const hour=/~?(\d{1,2}):[\dx]+/.exec(raw);if(hour)return ({pt:'Por volta de ',en:'Around ',es:'Alrededor de '}[lang])+hour[1]+'h';return window.PainelLinguagem?.text(raw,lang)||({pt:'Horário a confirmar',en:'Time to confirm',es:'Hora por confirmar'}[lang]);}
function launchTone(state) {
  return {'no ar':'launch-live',armado:'launch-ready',liberado:'launch-ready','em revisao':'launch-review','falta card':'launch-owner','em obra':'launch-work',pausado:'launch-paused'}[state] || 'launch-work';
}
function launchDetails(item) {
  drawer(item.o_que,[element('p',launchDayLabel(item.dia,data.updated)+' · '+launchTimeLabel(item.hora)+' BRT'),element('p',item.sessao+' · '+item.estado),...(item.prazo_duro?[element('p','PRAZO DURO','launch-hard')]:[]),...(item.ate?[element('p','Até '+launchDayLabel(item.ate,data.updated))]:[]),detailBlock('Dependência',item.depende),...(item.torto?[detailBlock(({pt:'Para corrigir no arquivo',en:'Fix in the file',es:'Corregir en el archivo'}[lang]||'Para corrigir no arquivo'),item.problema)]:[])]);
}
function renderLaunches() {
  const timeline=$('launch-timeline'),tabs=$('launch-tabs'),counter=$('launch-countdown');
  timeline.replaceChildren();tabs.replaceChildren();counter.replaceChildren();
  const launches=data.launches;
  if(!launches){timeline.append(element('p','?','launch-unknown'));return;}
  {const at=Date.parse(launches.updated||''),idadeH=Number.isFinite(at)?Math.floor((Date.now()-at)/3600000):null,quando=Number.isFinite(at)?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(at)):null;
   const fa=launches.fonteAuto;const aviso=element('p',fa&&fa.ok&&quando?('Lista lida do gerador de projetos em '+quando+' (a cada 15 min)'+(fa.semPrevisao?' · '+fa.semPrevisao+' sem previsão escrita (?) Solução: cada sessão dona grava "previsao: ..." no Log da task':'')+' · '+(fa.prazoDuroTexto||'prazo duro: ?')+'.'):quando?('Lista escrita em '+quando+(idadeH>=1?' (há '+idadeH+' h)':'')+(idadeH>=6?': pode estar velha. Confira também a idade do Cronograma do Início.':'.')):'Lista sem hora de escrita: confira o Cronograma do Início.','launch-idade'+(idadeH===null||idadeH>=6?' is-velha':''));
   // fica ANTES da linha do tempo (irma dela), uma vez so: a linha do tempo segue so com os dias
   try{const velho=document.getElementById('launch-idade');if(velho)velho.remove();if(fa&&!fa.ok)aviso.textContent+=' · ? Gerador de projetos sem leitura: '+fa.motivo+'. Solução: '+fa.solucao;aviso.id='launch-idade';if(timeline.parentElement)timeline.parentElement.insertBefore(aviso,timeline);}catch{}}
  if(!launches.items.length){timeline.append(element('p','Nenhum lançamento previsto','empty'));return;}
  const hard=launches.nextHard;
  if(hard){const button=element('button',undefined,'launch-deadline');button.dataset.acao='prazo-lancamento';button.append(element('span','PRÓXIMO PRAZO DURO'),element('strong',hard.deadlineAt?countdown(hard.deadlineAt):'?'));if(hard.listaMao)button.append(element('small','da lista à mão'+(hard.listaMao.dataTexto?' de '+hard.listaMao.dataTexto:'')+(hard.listaMao.idadeTexto?' ('+hard.listaMao.idadeTexto+')':'')));button.setAttribute('aria-label','Próximo prazo duro: '+hard.o_que);button.addEventListener('click',()=>launchDetails(hard));counter.append(button);}
  const groups=new Map();
  for(const item of launches.items){const day=item.dia || '';if(!groups.has(day))groups.set(day,[]);groups.get(day).push(item);}
  if(!groups.has(selectedLaunchDay))selectedLaunchDay=groups.keys().next().value;
  for(const [day,items] of groups){
    const label=launchDayLabel(day,data.updated),tab=element('button',label);
    tab.dataset.acao='dia-lancamento';tab.setAttribute('role','tab');tab.id='launch-tab-'+(day || 'undated');tab.setAttribute('aria-controls','launch-day-'+(day || 'undated'));tab.setAttribute('aria-selected',String(day===selectedLaunchDay));tab.addEventListener('click',()=>{selectedLaunchDay=day;renderLaunches();});tabs.append(tab);
    const group=element('section',undefined,'launch-day'+(day===selectedLaunchDay?' selected':''));group.id='launch-day-'+(day || 'undated');group.setAttribute('role','tabpanel');group.setAttribute('aria-labelledby',tab.id);group.append(element('h3',label));
    for(const item of items){const button=element('button',undefined,'launch-item '+launchTone(item.estado));button.dataset.acao='detalhe-lancamento';button.dataset.id=item.id;const head=element('span',undefined,'launch-item-head');head.append(element('strong',launchTimeLabel(item.hora),'launch-hour'),element('span',item.estado,'launch-state'));const foot=element('span',undefined,'launch-item-foot');foot.append(element('span',item.sessao));if(item.prazo_duro)foot.append(element('span','PRAZO DURO','launch-hard'));if(item.torto){button.classList.add('launch-torto');foot.append(element('span',({pt:'dado torto: ',en:'bad data: ',es:'dato torcido: '}[lang]||'dado torto: ')+item.problema,'launch-torto-mark'));}button.append(head,element('span',item.o_que,'launch-name'),foot);button.addEventListener('click',()=>launchDetails(item));group.append(button);}
    timeline.append(group);
  }
}
function renderBoard(){
 const tasks=filteredTasks(),host=$('board');host.replaceChildren();$('task-count').textContent=tasks.length;const tabs=$('phase-tabs');tabs.replaceChildren();
 for(let index=0;index<phaseKeys.length;index++){
  const key=phaseKeys[index],list=tasks.filter(work=>phaseOf(work)===key),tab=element('button',translations[lang].phase[index]);tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(key===selectedPhase));tab.addEventListener('click',()=>{selectedPhase=key;renderBoard();});tabs.append(tab);
  const column=element('section',undefined,'phase-column'+(key===selectedPhase?' selected':''));column.dataset.phase=key;
  const table=element('table',undefined,'up-records'),head=element('thead'),labels=element('tr');for(const text of [({pt:'Trabalho',en:'Task',es:'Trabajo'})[lang],({pt:'Quem faz',en:'Assigned to',es:'Quién hace'})[lang],({pt:'Etapa',en:'Stage',es:'Etapa'})[lang]]){const th=element('th',text);th.setAttribute('scope','col');labels.append(th);}head.append(labels);table.append(head);const body=element('tbody');table.append(body);
  for(const work of list){const row=element('tr'),item=element('td'),button=element('button',undefined,'up-record-button');button.type='button';const titulo=(typeof window!=='undefined'&&window.PainelFila?.titulo(work.id))||shortTitle(work.title,90);button.append(element('span',titulo));button.setAttribute('aria-label',({pt:'Ver detalhe: ',en:'View details: ',es:'Ver detalle: '})[lang]+titulo);button.addEventListener('click',()=>taskDetails(work));item.append(button);const who=element('td',ownerTokens(work).join(' +')||'?'),stage=element('td');stage.append(element('span',translations[lang].phase[index],'up-chip'));row.append(item,who,stage);body.append(row);}
  if(list.length)column.append(table);else column.append(element('p',t('none'),'empty-column'));host.append(column);
 }
 for(const button of document.querySelectorAll('[data-executor]'))button.setAttribute('aria-pressed',String(filters.executor===button.dataset.executor));$('deadline-only').setAttribute('aria-pressed',String(filters.deadlineOnly));$('owner-only').setAttribute('aria-pressed',String(filters.needsOwner));
}
function renderOwnerFilters(){const host=$('owner-filters');host.replaceChildren();for(const owner of ['',...new Set((data.tasks||[]).flatMap(ownerTokens))]){const button=element('button',owner||t('all'),'filter');button.setAttribute('aria-pressed',String(filters.owner===owner));button.addEventListener('click',()=>{filters.owner=owner;renderOwnerFilters();renderBoard();});host.append(button);}}
function sessionLink(card){if(!card.link)return element('p',t('missingLink'),'chat-note');const a=element('a',t('openSession'),'session-link');a.href=card.link;a.target='_blank';a.rel='noopener noreferrer';return a;}
function choiceCard(card){const box=element('article',undefined,'choice');box.append(element('span',card.exemplo?t('example'):card.sessao,'eyebrow'),element('h3',textBrt(card.pergunta)));if(card.blocked){box.append(element('p',t('approve'),'chat-note'),sessionLink(card));return box;}for(const [index,option] of card.opcoes.entries()){const button=element('button',textBrt(option.label));if(option.descricao)button.append(element('span',textBrt(option.descricao)));button.addEventListener('click',async()=>{box.querySelectorAll('button').forEach(x=>x.disabled=true);try{const response=await fetch(apiUrl('/api/responder'),{method:'POST',headers:{'Content-Type':'application/json','X-Painel-Nonce':data.nonce},body:JSON.stringify({id:card.id,opcao:index})});const result=await response.json();if(!response.ok)throw Error();await refresh();showToast(result.example?t('exampleSaved'):t('saved'));}catch{showToast(t('chooseError'));box.querySelectorAll('button').forEach(x=>x.disabled=false);}});box.append(button);}if(card.exemplo)box.append(element('p',t('demo'),'chat-note'));return box;}
function renderMoves(){if(window.Painel128Local?.enabled())return;const host=$('cards');host.replaceChildren(...(data.cards||[]).filter(x=>exampleMode||!x.exemplo).map(choiceCard));const needs=$('needs');needs.replaceChildren();for(const item of (data.needsItems||[]).slice(0,3)){const button=element('button',undefined,'need-item');button.append(element('span','↗'),element('strong',shortTitle(item.title,70)));button.addEventListener('click',()=>drawer(item.title,[detailBlock(t('details'),item.detail)]));needs.append(button);}if(!host.childElementCount&&!needs.childElementCount)host.append(element('p',t('none'),'empty'));}
/* PAINEL128_BOOTSTRAP_START */
window.Painel128Local=(()=>{
 const doc=window.document,words={
  en:{knownIdentities:'Identities confirmed in this partial reading. Chat opening is unavailable here.',copyIdentity:'Copy identity',identityCopied:'Identity copied.',identityCopyFailed:'Could not copy the identity. Try again.',creditUnavailable:'Credit reading unavailable.',resetUnavailable:'Reset unavailable',resetsUnavailable:'Resets unavailable',agendaUnavailable:'Schedule unavailable in this reading.',deadlinesUnavailable:'Deadlines unavailable',partial:'Partial app reading. App status does not prove execution.',unread:'Unread',totalsUnavailable:'Totals unavailable in this partial reading.',received:'Received: titles and app status. Read ',missing:'Awaiting process, choice and total sources.',choicesUnavailable:'Choice source unavailable in this reading.',build:'Local preview in preparation',actions:'Copy and chat actions await a verified session catalog.',cards:'Choices and next steps',sessions:'Team',note:'Chat opening and ordered owner steps await a verified source.'},
  pt:{knownIdentities:'Identidades conferidas neste recorte. Abrir chat está indisponível nesta prévia.',copyIdentity:'Copiar identidade',identityCopied:'Identidade copiada.',identityCopyFailed:'Não foi possível copiar a identidade. Tente de novo.',creditUnavailable:'Leitura de crédito indisponível.',resetUnavailable:'Reset indisponível',resetsUnavailable:'Resets indisponíveis',agendaUnavailable:'Agenda indisponível nesta leitura.',deadlinesUnavailable:'Prazos indisponíveis',partial:'Leitura parcial do app. O estado informado não comprova execução.',unread:'Sem leitura',totalsUnavailable:'Totais indisponíveis nesta leitura parcial.',received:'Recebidos: títulos e estado no app. Leitura ',missing:'Aguardando fontes de processos, escolhas e totais.',choicesUnavailable:'Fonte de escolhas indisponível nesta leitura.',build:'Prévia local em preparo',actions:'Copiar e abrir chat aguardam catálogo de sessões conferido.',cards:'Escolhas e próximos passos',sessions:'Time',note:'Abrir chat e passos ordenados aguardam fonte conferida.'},
  es:{knownIdentities:'Identidades verificadas en este recorte. Abrir chat no está disponible aquí.',copyIdentity:'Copiar identidad',identityCopied:'Identidad copiada.',identityCopyFailed:'No se pudo copiar la identidad. Inténtalo otra vez.',creditUnavailable:'Lectura de crédito no disponible.',resetUnavailable:'Reset no disponible',resetsUnavailable:'Resets no disponibles',agendaUnavailable:'Agenda no disponible en esta lectura.',deadlinesUnavailable:'Plazos no disponibles',partial:'Lectura parcial de la app. El estado informado no prueba ejecución.',unread:'Sin lectura',totalsUnavailable:'Totales no disponibles en esta lectura parcial.',received:'Recibidos: títulos y estado en la app. Lectura ',missing:'Esperando fuentes de procesos, elecciones y totales.',choicesUnavailable:'Fuente de elecciones no disponible en esta lectura.',build:'Vista previa local en preparación',actions:'Copiar y abrir chat esperan un catálogo de sesiones verificado.',cards:'Elecciones y próximos pasos',sessions:'Equipo',note:'Abrir chat y pasos ordenados esperan una fuente verificada.'}
 };
 let instances=null,current=null,nonce=null,epoch=0,identityControls=null;
 const byId=id=>doc.getElementById(id);
 const language=()=>typeof lang==='string'&&['en','pt','es'].includes(lang)?lang:'en';
 function enabled(){
  if(doc.documentElement.dataset.painel128!=='1')return false;
  try{const url=new URL(window.location.href);return url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)&&Number(url.port||80)!==3250&&url.searchParams.getAll('painel128').length===1&&url.searchParams.get('painel128')==='1'&&Array.from(url.searchParams.keys()).every(key=>key==='painel128');}catch{return false;}
 }
 function nativeBindings(){
  if(!enabled()||current?.metadata?.kind!=='native-app-metadata'||current.metadata.partial!==true)return null;
  const marker=byId('panel128-native-bindings');if(!marker||marker.textContent.length>8000)return null;
  let value;try{value=JSON.parse(marker.textContent);}catch{return null;}
  if(value?.kind!=='human-defined'||value.source!=='root-128-configuration'||value.partial!==true||value.sourceObservedAt!==current.metadata.observedAt)return null;
  const catalog=window.PainelAcoes128?.catalogOf(value.catalog);
  if(!catalog?.ok||catalog.entries.length!==3||!Array.isArray(value.organization)||value.organization.length!==3)return null;
  const roles=['coordenador-conversation','coordenador-command','atendimento-integrator'],byRole=new Map();
  for(const target of catalog.entries){
   if(target.family!=='codex'||!roles.includes(target.role)||byRole.has(target.role))return null;
   const rows=current.sessions.equipe.agents.filter(row=>row.id===target.threadId&&row.conversationId===target.threadId&&row.family===target.family&&row.name===target.name);
   if(rows.length!==1)return null;byRole.set(target.role,target);
  }
  const command=byRole.get('coordenador-command'),seen=new Set();
  for(const node of value.organization){
   const target=byRole.get(node?.role);
   if(!target||node.id!==target.threadId||node.family!==target.family||seen.has(node.role)||node.parentId!==(node.role==='coordenador-command'?null:command.threadId))return null;
   seen.add(node.role);
  }
  return {catalog:catalog.entries,organization:value.organization};
 }
 function renderIdentityControls(copy){
  const bindings=nativeBindings(),host=byId('panel128-actions-note');
  if(!bindings){identityControls=null;host.textContent=copy.actions;return;}
  host.classList.add('coordenador128');
  const key=JSON.stringify(bindings.catalog);
  if(!identityControls||identityControls.key!==key){
   host.replaceChildren();const note=doc.createElement('span'),feedback=doc.createElement('span');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
   host.append(note);const buttons=[];
   for(const target of bindings.catalog){
    const button=doc.createElement('button');button.type='button';button.style.display='block';button.style.marginTop='8px';button.style.minHeight='44px';button.style.maxWidth='100%';button.style.whiteSpace='normal';
    button.addEventListener('click',async event=>{
     if(event.isTrusted!==true||button.disabled)return;
     const latest=nativeBindings()?.catalog.find(row=>row.threadId===target.threadId&&row.role===target.role&&row.name===target.name);
     if(!latest)return;button.disabled=true;
     try{const receipt=await copyExact(latest.name+'\nID: '+latest.threadId);feedback.textContent=receipt?.copied===true?words[language()].identityCopied:words[language()].identityCopyFailed;}catch{feedback.textContent=words[language()].identityCopyFailed;}finally{button.disabled=false;}
    });
    buttons.push({button,target});host.append(button);
   }
   host.append(feedback);identityControls={key,note,buttons};
  }
  identityControls.note.textContent=copy.knownIdentities;
  for(const {button,target} of identityControls.buttons)button.textContent=copy.copyIdentity+' · '+target.name;
 }
 const api=path=>path+'?painel128=1';
 async function copyExact(text){
  if(!enabled()||typeof text!=='string'||!text||text.length>12000||window.navigator?.userActivation?.isActive!==true||typeof window.navigator?.clipboard?.writeText!=='function')throw Error('Copy unavailable');
  const generation=epoch;await window.navigator.clipboard.writeText(text);
  if(!enabled()||generation!==epoch)throw Error('Copy state changed');
  return {copied:true};
 }
 async function answerCard(payload){
  if(!enabled()||!current||!nonce)throw Error('Local preview unavailable');
  const version=Object.getOwnPropertyDescriptor(current.cardVersions||{},payload.id)?.value;
  if(typeof version!=='string'||!/^[a-f\d]{64}$/.test(version))throw Error('Current card version unavailable');
  const generation=epoch,response=await window.fetch(api('/api/responder'),{method:'POST',headers:{'Content-Type':'application/json','X-Painel-Nonce':nonce,'X-Painel-Card-Version':version},body:JSON.stringify({id:payload.id,opcao:payload.opcao})});
  const receipt=await response.json();
  if(!enabled()||generation!==epoch||!response.ok||receipt?.kind!=='choice-recorded'||receipt.recorded!==true||receipt.id!==payload.id||receipt.opcao!==payload.opcao||receipt.example!==false)throw Error('Choice not confirmed');
  return receipt;
 }
 async function readFresh(request){
  if(!enabled()||typeof request?.id!=='string')throw Error('Reading unavailable');
  const generation=epoch,response=await window.fetch(api('/api/estado'),{headers:{'X-Painel-Revalidate-Card':request.id}});
  const next=await response.json(),receipt=next?.receipt;
  if(!enabled()||generation!==epoch||!response.ok||!next?.panel128?.cards||receipt?.kind!=='card-revalidated'||receipt.id!==request.id||receipt.status!=='pending')throw Error('Revalidation unavailable');
  current=next.panel128;nonce=next.nonce;
  if(typeof latestSnapshot!=='undefined'){
   latestSnapshot=next;data=next;
   // The next work follows refresh's continuation, which consumes the receipt first.
   window.setTimeout(()=>{if(enabled()&&generation===epoch&&current===next.panel128&&latestSnapshot===next&&typeof render==='function')render();},0);
  }
  return {snapshot:next.panel128.cards,receipt};
 }
 function destroy(){
  if(instances){instances.actions.destroy();instances.sessions.destroy();instances.cards.destroy();instances=null;}
  current=null;nonce=null;epoch++;
  for(const id of ['panel128-command','panel128-cards-block','panel128-sessions-block']){const node=byId(id);if(node)node.hidden=true;}
  byId('command-room')?.replaceChildren();
  for(const id of ['pipeline','operator-live']){const node=byId(id);if(node)node.hidden=false;}
 }
 function setup(){
  if(instances)return;
  const returnFocus=byId('manage-wait');
  const p2=window.PainelCoordenador128,p3=window.PainelSessoes128,p4=window.PainelCards128UI,p1=window.PainelComando;
  if(!p1||!p2||!p3||!p4)throw Error('Local panel modules unavailable');
  let actions,sessions,cards;
  try{
  actions=p2.init({enabled:true,mount:byId('panel128-actions'),lang:language,getCatalog:()=>nativeBindings()?.catalog||[],copyExact,returnFocus});
  sessions=p3.init({enabled:true,compactTeam:true,mount:byId('panel128-sessions'),lang:language(),getOrganization:()=>nativeBindings()?.organization||null,getOpenTarget:()=>null,returnFocus});
  cards=p4.init({enabled:true,mount:byId('panel128-cards'),lang:language(),answerCard,readFresh,copyExact,getCatalog:()=>[],returnFocus});
  }catch(error){cards?.destroy();sessions?.destroy();actions?.destroy();throw error;}instances={actions,sessions,cards};
  byId('cards')?.replaceChildren();byId('needs')?.replaceChildren();
  const dialog=byId('decision');if(dialog?.open)dialog.close();
 }
 const homeWords={
  en:{title:'Current source records',read:'Read ',source:'Source',partial:'Partial local reading. Records do not prove processes are running.',operator:'Operator report',signal:'Codex status record',item:'Item ',fez:'Result reported',rodando:'Front reported',achou:'Constraint reported',proximo:'Next step reported',peguei:'Start recorded',feito:'Completed in source',entregue:'Delivery recorded',segura:'Held in source',pausado:'Paused in source',pendente:'Pending in source',final:'Final record',unknown:'Status unavailable',unavailable:'Source unavailable',queuePending:'Queue progress awaits the status-parser correction.',integration:'ATENDIMENTO integration preserved in the source',start:'Start not confirmed',deadline:'Deadline not confirmed',waiting:'Awaiting source confirmation',approval:'Previous approval is not current',next:'Awaiting verified queue progress and choice sources.'},
  pt:{title:'Registros atuais das fontes',read:'Leitura ',source:'Fonte',partial:'Leitura local parcial. Os registros não comprovam processos em execução.',operator:'Relato do operador',signal:'Registro de estado do Codex',item:'Item ',fez:'Resultado informado',rodando:'Frente informada',achou:'Impedimento informado',proximo:'Próximo passo informado',peguei:'Início registrado',feito:'Concluído na fonte',entregue:'Entrega registrada',segura:'Retido na fonte',pausado:'Pausado na fonte',pendente:'Pendente na fonte',final:'Registro final',unknown:'Estado indisponível',unavailable:'Fonte indisponível',queuePending:'O progresso da fila aguarda a correção da leitura de status.',integration:'Integração ATENDIMENTO preservada no relato',start:'Início sem confirmação',deadline:'Prazo sem confirmação',waiting:'Aguardando confirmação da fonte',approval:'A aprovação anterior não vale para a versão atual',next:'Aguardando progresso da fila e fontes de escolhas conferidas.'},
  es:{title:'Registros actuales de las fuentes',read:'Lectura ',source:'Fuente',partial:'Lectura local parcial. Los registros no prueban procesos en ejecución.',operator:'Informe del operador',signal:'Registro de estado de Codex',item:'Ítem ',fez:'Resultado informado',rodando:'Frente informado',achou:'Impedimento informado',proximo:'Próximo paso informado',peguei:'Inicio registrado',feito:'Completado en la fuente',entregue:'Entrega registrada',segura:'Retenido en la fuente',pausado:'Pausado en la fuente',pendente:'Pendiente en la fuente',final:'Registro final',unknown:'Estado no disponible',unavailable:'Fuente no disponible',queuePending:'El progreso de la cola espera la corrección del lector de estados.',integration:'Integración ATENDIMENTO preservada en el informe',start:'Inicio sin confirmar',deadline:'Plazo sin confirmar',waiting:'Esperando confirmación de la fuente',approval:'La aprobación anterior no corresponde a la versión actual',next:'Esperando progreso de la cola y fuentes verificadas de decisiones.'}
 };
 function renderPublicHome128(home){
  if(home?.kind!=='restricted-local-source-reading'||home.partial!==true||home.totalsAvailable!==false||home.executionProven!==false||!Array.isArray(home.fronts)||!Array.isArray(home.sources))return false;
  const at=new Date(home.readAt);if(!Number.isFinite(at.getTime()))return false;
  const copy=homeWords[language()],host=byId('command-room');
  const make=(tag,value,style)=>{const node=doc.createElement(tag);node.textContent=value;if(style)node.classList.add(style);return node;};
  const clock=at.toISOString().slice(0,19).replace('T',' ')+' UTC';
  host.replaceChildren(make('h3',copy.title),make('p',copy.read+clock),make('p',copy.partial,'chat-note'));
  const signals={
   'integration-preserved':copy.integration,'start-unconfirmed':copy.start,'deadline-unconfirmed':copy.deadline,'waiting-source-confirmation':copy.waiting,'approval-not-current':copy.approval
  };
  for(const front of home.fronts.slice(0,8)){
   if(front?.executionProven!==false||!['operator-report','neutral-record'].includes(front.kind))continue;
   const row=doc.createElement('article');row.classList.add('work-item');
   const ids=front.kind==='neutral-record'?[front.itemId]:(Array.isArray(front.itemIds)?front.itemIds:[]);
   const labels=ids.filter(id=>Number.isSafeInteger(id)&&id>0).map(id=>copy.item+id).join(', ');
   const title=(front.kind==='operator-report'?copy.operator:copy.signal)+(labels?' · '+labels:'');
   row.append(make('strong',title),make('p',Object.hasOwn(copy,front.reportedState)?copy[front.reportedState]:copy.unknown));
   for(const signal of Array.isArray(front.signals)?front.signals:[])if(Object.hasOwn(signals,signal))row.append(make('p',signals[signal],'chat-note'));
   const provenance=doc.createElement('details');provenance.append(make('summary',copy.source),make('p',front.source));
   if(front.reportedAt&&Number.isFinite(Date.parse(front.reportedAt)))provenance.append(make('p',new Date(front.reportedAt).toISOString().slice(0,19).replace('T',' ')+' UTC'));
   row.append(provenance);host.append(row);
  }
  const sources=doc.createElement('details');sources.append(make('summary',copy.source));
  for(const source of home.sources.slice(0,3))sources.append(make('p',source.path+' · '+(source.available===true?copy.read+clock:copy.unavailable)));
  host.append(sources);
  if(home.queue?.available!==true)host.append(make('p',copy.queuePending,'chat-note'));
  const now=byId('now'),next=byId('next');if(now)now.textContent=copy.read+clock;if(next)next.textContent=copy.next;
  return true;
 }

 function renderLocal(snapshot){
  if(!enabled()){if(instances)destroy();return;}
  const projection=snapshot?.panel128;
  if(!projection?.cards||!projection?.sessions||!projection?.actions)return;
  setup();current=projection;nonce=snapshot.nonce;
  const operatorHost=byId('operator-live');if(operatorHost){operatorHost.hidden=true;operatorHost.replaceChildren();}
  const teamHost=byId('team-stage-host');if(teamHost)teamHost.hidden=true;
  const locale=language(),copy=words[locale];
  for(const id of ['panel128-command','panel128-cards-block','panel128-sessions-block'])byId(id).hidden=false;
  const nativePartial=projection.metadata?.kind==='native-app-metadata'&&projection.metadata.partial===true;
  byId('panel128-build-note').textContent=copy.build;byId('panel128-build-note').setAttribute('title',projection.build?.version||'');renderIdentityControls(copy);byId('panel128-cards-note').textContent=projection.cards.available===false?copy.choicesUnavailable:copy.note;
  byId('panel128-cards-title').textContent=copy.cards;byId('panel128-sessions-title').textContent=copy.sessions;
  window.PainelComando.render({command:projection.command},{lang:locale});
  instances.actions.render(projection.actions);
  instances.sessions.render(projection.sessions,locale);
  const cards={cards:projection.cards.cards,needsItems:projection.cards.needsItems,needsAll:projection.cards.needsAll,ownerDecisionSource:projection.cards.ownerDecisionSource,ownerSteps:projection.cards.ownerSteps,lang:locale};
  instances.cards.render(cards);
  byId('panel128-cards').hidden=projection.cards.available===false;
  if(nativePartial){
   byId('command-room').textContent=copy.partial;
   for(const id of ['ready-count','stalled-count','task-count','move-count','total-percent']){const node=byId(id);if(node){node.textContent=copy.unread;node.setAttribute('aria-label',copy.totalsUnavailable);}}
   for(const id of ['claude-ring','codex-ring','owner-ring']){const ring=byId(id);if(ring?.firstElementChild){const reason=id==='owner-ring'?copy.totalsUnavailable:copy.creditUnavailable;ring.firstElementChild.textContent=copy.unread;Object.assign(ring.firstElementChild.style,{fontSize:'11px',lineHeight:'1.2',maxWidth:'44px',whiteSpace:'normal',textAlign:'center'});ring.style.background='none';ring.setAttribute('aria-label',reason);if(ring.parentElement)ring.parentElement.title=reason;}}
   for(const id of ['claude-reset','codex-reset']){const node=byId(id);if(node)node.textContent=copy.resetUnavailable;}
   const resets=byId('codex-resets');if(resets)resets.textContent=copy.resetsUnavailable;
   const agenda=byId('launch-timeline'),deadline=byId('launch-countdown');if(agenda)agenda.textContent=copy.agendaUnavailable;if(deadline)deadline.textContent=copy.deadlinesUnavailable;
   const at=new Date(projection.sessions.updated),reading=Number.isFinite(at.getTime())?new Intl.DateTimeFormat(locale,{timeZone:'America/Sao_Paulo',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(at)+' BRT':copy.unread;
   const now=byId('now'),next=byId('next');if(now)now.textContent=copy.received+reading;if(next)next.textContent=copy.missing;
   renderPublicHome128(projection.home);
  }
 }
 function showCards(){if(!enabled())return;window.PainelVisao?.select?.('home');byId('panel128-cards-block')?.scrollIntoView?.({block:'start'});byId('panel128-cards')?.firstElementChild?.focus?.({preventScroll:true});}
 return Object.freeze({render:renderLocal,destroy,enabled,showCards});
})();
/* PAINEL128_BOOTSTRAP_END */
function render(){if(latestSnapshot){data=window.PainelClareza?.enrich(window.PainelProjetos?.filterSnapshot(latestSnapshot)||latestSnapshot)||window.PainelProjetos?.filterSnapshot(latestSnapshot)||latestSnapshot;window.PainelProjetos?.render(latestSnapshot,$('project-strip'),{lang,brt,onSelect:render});}document.documentElement.lang=lang;document.querySelectorAll('[data-t]').forEach(x=>x.textContent=t(x.dataset.t));document.title='Painel | '+t('house');$('language').value=lang;$('example-badge').hidden=!exampleMode;$('example-toggle').hidden=exampleMode;$('example-toggle').href='/?exemplo=1';$('example-toggle').textContent=t('example');$('brand-home').href=exampleMode?'/?exemplo=1':window.Painel128Local?.enabled()?'/?painel128=1':'/';if(!data)return;if(!document.documentElement.dataset.firstData){document.documentElement.dataset.firstData='1';performance.mark('painel:first-data');}renderPipeline();renderStrips();renderCredits();renderDeadlines();renderLaunches();renderOwnerFilters();renderBoard();renderMoves();$('ready-count').textContent=(data.readyBranches||[]).length;$('stalled-count').textContent=(data.stalledTasks||[]).length;$('status').textContent=brt(data.updated);window.PainelV3?.render(data);window.Painel128Local?.render(data);}
function rewardChanges(next){const phases=new Map((next.tasks||[]).map(x=>[x.id,phaseOf(x)]));if(previousPhases){const newlyLive=(next.tasks||[]).find(x=>phases.get(x.id)==='live'&&previousPhases.has(x.id)&&previousPhases.get(x.id)!=='live');if(newlyLive){const faixa=typeof window!=='undefined'?window.PainelFaixa:null;if(faixa)faixa.novidade(newlyLive);else showToast(t('reward')+' '+shortTitle(newlyLive.title),true);}}previousPhases=phases;}
async function refresh(){if(busy)return;busy=true;try{const response=await fetch(apiUrl('/api/estado'));if(!response.ok)throw Error();const next=await response.json();rewardChanges(next);latestSnapshot=next;data=next;render();window.PainelDev?.observe(next.dev);}catch{$('status').textContent=t('failure');}finally{busy=false;}}
$('progress-note').addEventListener('click',()=>drawer(t('queue'),[element('p',t('phaseHint')),...(data?.pipelineItems||[]).map(item=>{const button=element('button',item.title+' · '+(numeric(item.percent)?item.percent+'%':'?'),'drawer-row');button.addEventListener('click',()=>itemDetails(item));return button;})]));$('refresh').addEventListener('click',refresh);$('language').addEventListener('change',()=>{lang=$('language').value;localStorage.setItem('painel-language',lang);render();});$('close-drawer').addEventListener('click',()=>$('drawer').close());$('drawer').addEventListener('click',event=>{if(event.target===$('drawer')&&event.clientX<$('drawer').getBoundingClientRect().left)$('drawer').close();});$('ready').addEventListener('click',showReady);$('stalled').addEventListener('click',showStalled);$('notes').addEventListener('click',showNotes);$('all-needs').addEventListener('click',showNeeds);$('claude-metric').addEventListener('click',()=>creditDetails('claude'));$('codex-metric').addEventListener('click',()=>creditDetails('codex'));$('owner-metric').addEventListener('click',()=>$('your-moves').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{}});for(const button of document.querySelectorAll('[data-executor]'))button.addEventListener('click',()=>{filters.executor=filters.executor===button.dataset.executor?'':button.dataset.executor;renderBoard();});$('deadline-only').addEventListener('click',()=>{filters.deadlineOnly=!filters.deadlineOnly;renderBoard();});$('owner-only').addEventListener('click',()=>{filters.needsOwner=!filters.needsOwner;renderBoard();});render();refresh();
if(document.modelContext?.registerTool){try{const abort=new AbortController();for(const tool of [{name:'read_house_status',description:'Read local queue progress, capacity and recorded feature phases.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async()=>{await refresh();return {updated:data?.updated,progress:data?.progress,pipeline:data?.pipelineItems?.map(({id,title,executor,actor,status,percent})=>({id,title,executor,actor,status,percent})),needsCount:data?.needsCount,readyBranches:data?.readyBranches?.length,stalledTasks:data?.stalledTasks?.length};}},{name:'filter_house_tasks',description:'Filter visible features by session, executor, deadline or owner action.',inputSchema:{type:'object',properties:{session:{type:'string'},executor:{type:'string',enum:['','claude','codex']},deadlineOnly:{type:'boolean'},needsOwner:{type:'boolean'}},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async input=>{if(!input||typeof input!=='object'||Object.keys(input).some(x=>!['session','executor','deadlineOnly','needsOwner'].includes(x))||('session' in input&&(typeof input.session!=='string'||input.session&&!data?.tasks.some(x=>ownerTokens(x).includes(input.session))))||('executor' in input&&!['','claude','codex'].includes(input.executor))||['deadlineOnly','needsOwner'].some(x=>x in input&&typeof input[x]!=='boolean'))throw Error('Invalid filter');if('session'in input)filters.owner=input.session;if('executor'in input)filters.executor=input.executor;for(const key of ['deadlineOnly','needsOwner'])if(key in input)filters[key]=input[key];renderOwnerFilters();renderBoard();return {shown:filteredTasks().length};}}])Promise.resolve(document.modelContext.registerTool(tool,{signal:abort.signal})).catch(()=>{});window.addEventListener('pagehide',()=>abort.abort(),{once:true});}catch{}}
