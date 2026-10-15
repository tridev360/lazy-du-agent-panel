'use strict';
// Fila 179: o estado de um item da estado/fila-codex.md vem da marca efetiva mais recente do bloco inteiro
// (titulo e sublinhas), nunca da ultima linha literal nem so do titulo. Citacao, pedido e negacao nao contam:
// a marca abre a linha (depois de uma [TAG] opcional) e, fora do titulo, vem em maiusculas.
const strip=value=>String(value??'').normalize('NFD').replace(/[̀-ͯ]/g,'');
// Ordem importa: expressoes de duas palavras antes das que comecam igual.
const KEYWORDS=[
  ['ENTREGA CONFERIDA','feito'],['EM PREPARO','pegou'],['EM CURSO','pegou'],['EM EXECUCAO','pegou'],['EM ANDAMENTO','pegou'],['EM REVISAO','revisao'],['NO AR','noar'],['NOAR','noar'],
  ['FEITO','feito'],['FEITA','feito'],['ENTREGUE','feito'],['RESOLVIDO','feito'],['RESOLVIDA','feito'],['CONCLUIDO','feito'],['CONCLUIDA','feito'],['RECONCILIADO','reconciliado'],
  ['CONFERIDO','ciente'],['CIENTE','ciente'],['CIENCIA','ciente'],['RECEBIDO','ciente'],
  ['PEGUEI','pegou'],['DESPACHADO','pegou'],['RETOMADO','pegou'],['PARCIAL','pegou'],
  ['PAUSADO','pausado'],['SEGURA','pausado'],['TRAVADO','pausado'],
  ['PENDENTE','livre'],['REABERTO','livre'],
  ['CANCELADO','cancelado'],['CANCELADA','cancelado'],['ABANDONADO','cancelado'],
  ['SUPERADO','superado'],['SUPERADA','superado'],['SUBSTITUIDO','superado']
];
// O titulo segue a regra antiga do leitor (sem diferenca de caixa e aceita REVISAO sozinho).
const TITLE_KEYWORDS=[...KEYWORDS.slice(0,8),['REVISAO','revisao'],...KEYWORDS.slice(8)];
const SINGLE=new Map(KEYWORDS.filter(([word])=>!word.includes(' ')));
const PERCENT={livre:0,pegou:40,revisao:80,feito:100,noar:100,pausado:null,cancelado:null,superado:null};
const CLOSED=new Set(['feito','noar']);
const EXCLUDED=new Set(['cancelado','superado']);
const TERMINAL=new Set(['cancelado','superado']);
const CLOCK=/(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?(?!\d|:\d)/;
const RAW_CLOCK=/(?<![\d:])\d{1,2}:\d{2}(?![\d])/;
const DMY=/(?<!\d)([0-3]\d)\/([01]\d)(?:\/(20\d{2}))?(?![\d/])/;
const ISO=/(?<!\d)(20\d{2})-(\d{2})-(\d{2})(?!\d)/;
const ROLLOVER_MAX=16*60;
function keywordAt(text,title=false) {
  const source=title?text.toUpperCase():text;
  for(const [word,status] of title?TITLE_KEYWORDS:KEYWORDS){
    if(!source.startsWith(word))continue;
    const next=text.charAt(word.length);
    if(title ? /[a-z]/i.test(next) : /[A-Z]/.test(next))continue;
    return {word,status,rest:text.slice(word.length)};
  }
  return null;
}
function calendar(year,month,day) {
  const date=new Date(Date.UTC(year,month-1,day));
  return month>=1 && month<=12 && day>=1 && date.getUTCMonth()===month-1 && date.getUTCDate()===day ? date.toISOString().slice(0,10) : null;
}
// Dia sem ano: o ano vem do relogio; uma data mais de 1 dia no futuro e do ano anterior.
function dayFromParts(day,month,year,now) {
  const reference=new Date(now.getTime()-3*3600000),base=year?Number(year):reference.getUTCFullYear();
  let result=calendar(base,Number(month),Number(day));
  if(result && !year && Date.parse(result+'T00:00:00Z')>reference.getTime()+86400000)result=calendar(base-1,Number(month),Number(day));
  return result;
}
function itemDayOf(title,now=new Date()) {
  const tag=/-([0-3]\d)-([01]\d)(?:-\d{3,4})?\]/.exec(title);
  if(tag)return dayFromParts(tag[1],tag[2],null,now);
  const iso=ISO.exec(title);if(iso)return calendar(Number(iso[1]),Number(iso[2]),Number(iso[3]));
  const dmy=DMY.exec(title);return dmy ? dayFromParts(dmy[1],dmy[2],dmy[3],now) : null;
}
const shiftDay=(day,delta)=>new Date(Date.parse(day+'T00:00:00Z')+delta*86400000).toISOString().slice(0,10);
// Uma linha vira marca se abre com a palavra de estado (com ou sem [TAG], com ou sem espaco antes da hora).
function markOf(line,{title=false,index=null,now=new Date()}={}) {
  let text=strip(line).replace(/\*\*/g,'').replace(/^\s*(?:[-*]\s+)?/,'');
  if(title)text=text.replace(/^PRIORIDADE\b\s*/i,'');
  let tag=null;
  const tagged=/^\[([^\]\r\n]{1,80})\]\s*/.exec(text);
  if(tagged){tag=tagged[1];text=text.slice(tagged[0].length);}
  // [TAG183] dentro do bloco 184 fala do item 183: nao muda o 184 e a leitura nao reclassifica o 183 sozinha.
  const numbers=tag ? (tag.match(/(?<!\d)\d{3}(?!\d)/g) || []).map(Number) : [];
  if(numbers.length && Number.isInteger(index) && !numbers.includes(index))return null;
  let found=keywordAt(text,title);
  // "FEITO quando concluir", "FEITO se passar": pedido, nao marca.
  if(found && /^\s*(?:quando|se|assim que|apos|depois de|ao)\b/i.test(found.rest))return null;
  if(!found && tag){
    const word=strip(tag).toUpperCase().split(/[-_\s]+/).find(part=>SINGLE.has(part));
    if(word)found={word,status:SINGLE.get(word),rest:text};
  }
  if(!found)return null;
  const window=found.rest.slice(0,48);
  const clock=CLOCK.exec(window),rawClock=RAW_CLOCK.exec(window);
  if(rawClock && (!clock || clock.index!==rawClock.index))return null;
  const head=window.slice(0,clock ? clock.index+clock[0].length+12 : 14);
  const iso=ISO.exec(head),dmy=!iso && DMY.exec(head);
  let day=iso ? calendar(Number(iso[1]),Number(iso[2]),Number(iso[3])) : dmy ? dayFromParts(dmy[1],dmy[2],dmy[3],now) : null;
  if((iso || dmy) && !day)return null;
  let minute=clock ? Number(clock[1])*60+Number(clock[2]) : null;
  const after=clock ? window.slice(clock.index+clock[0].length)+found.rest.slice(48) : found.rest;
  // Hora em UTC vira BRT (o resto do painel fala BRT).
  if(minute!==null && /^\s*UTC\b/i.test(after)){minute-=180;if(minute<0){minute+=1440;if(day)day=shiftDay(day,-1);}}
  const tail=after.replace(/^\s*(?:BRT|UTC)?\s*(?:(?:20\d{2}-\d{2}-\d{2})|(?:[0-3]?\d\/[01]?\d(?:\/20\d{2})?))?\s*(?:guarda)?\s*[:,.;]?\s*/i,'');
  let status=found.status;
  // RECONCILIADO, CIENTE e CONFERIDO podem trazer o resultado logo depois ("RECONCILIADO 04:28: CANCELADO PARA CODEX").
  if(['reconciliado','ciente'].includes(status)){const inner=keywordAt(tail);if(inner && !['reconciliado','ciente'].includes(inner.status))status=inner.status;}
  // "FEITO 10:12 somente o focal" fecha uma fatia, nao o item.
  if(CLOSED.has(status) && /^(?:somente|so o|so a|so os|so as|apenas|parcial|fatia|sem integracao)\b/i.test(tail))status='pegou';
  const clockText=minute===null ? null : String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');
  return {word:found.word,status,clock:clockText,minute,day,tag};
}
function cienciaOnly(details) {
  const text=strip(details);
  return /^\s*PRAZO:\s*ciencia\b/im.test(text) || /^\s*PEDIDO:[^\r\n]*\bso ciencia\b/im.test(text) || /^\s*PEDIDO:\s*(?:nenhum|nada novo)\b/im.test(text) && /\bciencia\b/i.test(text);
}
// Marca efetiva = a mais recente pela hora. A hora conta a partir da hora do titulo e vira o dia so se a marca
// Dia escrito decide quando as duas marcas comparadas tem dia. Sem hora em nenhuma marca, vale a ultima com marca.
// Sublinha sem hora nao derruba marca com hora, exceto CANCELADO e SUPERADO, que valem a partir da marca com hora acima deles.
function effectiveMarkOf(lines,{index=null,now=new Date()}={}) {
  const title=strip(lines[0]||''),itemDay=itemDayOf(title,now),titleClock=CLOCK.exec(title);
  const marks=[];
  lines.forEach((line,position)=>{const mark=markOf(line,{title:position===0,index,now});if(mark)marks.push({...mark,line:position});});
  if(!marks.length)return {mark:null,marks,itemDay};
  const clocked=marks.filter(mark=>mark.minute!==null);
  const base=titleClock ? Number(titleClock[1])*60+Number(titleClock[2]) : clocked[0]?.minute ?? 0;
  for(const mark of clocked){
    const rollover=mark.minute<base-30 && mark.minute+1440-base<=ROLLOVER_MAX ? 1 : 0;
    mark.relative=rollover*1440+mark.minute;
    mark.closedDay=mark.day || (itemDay ? shiftDay(itemDay,rollover) : null);
  }
  let pool=marks;
  if(clocked.length){
    pool=marks.filter(mark=>mark.minute!==null || TERMINAL.has(mark.status) && mark.line>0);
    for(const mark of pool)if(mark.minute===null){const above=clocked.filter(item=>item.line<mark.line);mark.relative=above.length ? Math.max(...above.map(item=>item.relative)) : -1;mark.closedDay=null;}
  } else for(const mark of pool){mark.relative=-1;mark.closedDay=mark.day || null;}
  const later=(a,b)=>a.day && b.day && a.day!==b.day ? a.day>b.day : a.relative!==b.relative ? a.relative>b.relative : a.line>b.line;
  const mark=pool.reduce((best,item)=>!best || later(item,best) ? item : best,null);
  return {mark,marks,itemDay};
}
function statusOf(lines,details,{index=null,now=new Date()}={}) {
  const {mark,marks,itemDay}=effectiveMarkOf(lines,{index,now});
  if(!mark)return {status:'livre',mark:null,marks,itemDay,closedDay:null,source:'sem marca'};
  let status=mark.status;
  if(status==='ciente')status=cienciaOnly(details ?? lines.join('\n')) ? 'feito' : 'pegou';
  if(status==='reconciliado')status='feito';
  return {status,mark,marks,itemDay,closedDay:CLOSED.has(status) ? mark.closedDay || null : null,source:mark.line===0 ? 'titulo' : 'linha '+(mark.line+1)+' do bloco'};
}
// Gancho do leitor.queueItemsOf: troca estado, porcentagem e hora da ultima mudanca pelo que a marca efetiva diz.
// Marca de sublinha sem dia conhecido nao inventa lastChangeAt; marca do titulo segue a regra antiga.
function withMark(block,now,item) {
  const result=statusOf(block.lines,block.lines.join('\n'),{index:block.index,now}),mark=result.mark;
  let lastChangeAt=item.lastChangeAt;
  if(mark && mark.line>0){
    lastChangeAt=null;
    if(mark.minute!==null && mark.closedDay){const at=Date.parse(mark.closedDay+'T00:00:00-03:00')+mark.minute*60000;if(at<=now.getTime()+60000)lastChangeAt=new Date(at).toISOString();}
  }
  const titleClock=CLOCK.exec(strip(block.lines[0]||''));
  return {...item,status:result.status,percent:PERCENT[result.status],lastChangeAt,mark:mark ? {word:mark.word,clock:mark.clock,day:mark.day,line:mark.line+1,source:result.source} : null,day:result.itemDay,closedDay:result.closedDay,titleMinute:titleClock ? Number(titleClock[1])*60+Number(titleClock[2]) : null};
}
// o dia vira +1 so se isso devolver a ordem e nao passar de agora. Marca com dia escrito nao muda.
function chronology(queueItems,now) {
  const nowMinute=Math.floor((now.getTime()-3*3600000)/60000);let previous=null;
  for(const item of queueItems){
    if(!item.day || !Number.isInteger(item.titleMinute))continue;
    let at=Math.floor(Date.parse(item.day+'T00:00:00Z')/60000)+item.titleMinute;
    if(previous!==null && at<previous-120 && at+1440>=previous-120 && at+1440<=nowMinute){
      item.day=shiftDay(item.day,1);at+=1440;
      if(item.closedDay && !item.mark?.day)item.closedDay=shiftDay(item.closedDay,1);
      if(item.lastChangeAt && item.mark && item.mark.line>1 && !item.mark.day){const moved=Date.parse(item.lastChangeAt)+86400000;item.lastChangeAt=moved<=now.getTime()+60000 ? new Date(moved).toISOString() : null;}
    }
    previous=previous===null ? at : Math.max(previous,at);
  }
}
// Gancho do leitor.snapshot: acerta o dia pela ordem da fila, copia para o mapa e monta a barra.
function finishSnapshot(result,now=new Date()) {
  const queue=result.queueItems||[];
  chronology(queue,now);
  const byId=new Map(queue.map(item=>[item.id,item]));
  for(const item of result.pipelineItems||[]){const source=item.source==='queue' && byId.get(item.id);if(source){item.day=source.day;item.closedDay=source.closedDay;item.lastChangeAt=source.lastChangeAt;}}
  result.progress=currentProgressOf(result.pipelineItems||[],queue,result.week,now);
  return result;
}
const counted=item=>!EXCLUDED.has(item?.status);
// Barra da Home: itens fechados / (fechados + abertos) no recorte "abertos de qualquer dia + fechados nesta semana".
// CANCELADO e SUPERADO saem (nem feito nem aberto). Fechado sem dia conhecido vai para o historico, nao para a barra.
// Sem nenhum item no recorte, percent = null ("?"), nunca 0 inventado.
function currentProgressOf(pipelineItems,queueItems=[],week=null,now=new Date()) {
  const closed=item=>CLOSED.has(item.status) || item.phase?.key==='feito';
  const counting=(pipelineItems||[]).filter(counted);
  const excluded=(queueItems||[]).filter(item=>!counted(item)).length;
  const dayOf=item=>item.closedDay || (item.source==='task' ? item.deadlineDay : null);
  const inWeek=item=>{const day=dayOf(item);return !!day && !!week && day>=week.start && day<=week.end;};
  const current=counting.filter(item=>!closed(item) || inWeek(item));
  const done=current.filter(closed).length,historyDone=counting.filter(closed).length;
  const ratio=(part,total)=>total ? Math.round(part/total*1000)/10 : null;
  const measured=current.filter(item=>Number.isFinite(item.percent) && item.percent>=0 && item.percent<=100);
  return {
    percent:ratio(done,current.length),known:current.length,total:current.length,done,open:current.length-done,excluded,
    undatedDone:counting.filter(item=>closed(item) && !dayOf(item)).length,
    scope:'abertos-e-fechados-na-semana',week:week ? {start:week.start,end:week.end} : null,
    phasePercent:measured.length ? Math.round(measured.reduce((sum,item)=>sum+item.percent,0)/measured.length*10)/10 : null,
    history:{percent:ratio(historyDone,counting.length),done:historyDone,total:counting.length,excluded},
    source:'estado/fila-codex.md e tasks com prazo na semana',readAt:now.toISOString()
  };
}
module.exports={KEYWORDS,PERCENT,CLOSED,EXCLUDED,markOf,effectiveMarkOf,statusOf,itemDayOf,cienciaOnly,withMark,counted,currentProgressOf,chronology,finishSnapshot};
