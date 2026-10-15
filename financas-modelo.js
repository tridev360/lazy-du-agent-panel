'use strict';
(function(root){const C=typeof module==='object'&&module.exports?require('./conselho-modelo.js'):root.CouncilModel;
 const CATEGORIES=['IA','infra','API','dominio','servico','venda','royalty','outro'],RECURRENCES=['unico','mensal','anual'],DAY=86400000,TTL=7200000;
 const day=C.day,text=(s,n=240)=>C.text(s,n),cents=v=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=1e9&&Math.abs(v*100-Math.round(v*100))<1e-6?Math.round(v*100):null;
 function time(v){if(typeof v!=='string')return null;const local=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v),s=local?v+':00-03:00':v;if(!day(s.slice(0,10))||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(s))return null;return C.time(s);}
 const fraction=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1?v:null;
 function workdays(start,end,zone='America/Sao_Paulo'){if(!time(start)||!time(end)||Date.parse(end)<=Date.parse(start))return null;const date=t=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t)),a=Date.parse(date(start)+'T12:00:00Z'),b=Date.parse(date(end)+'T12:00:00Z');if(b-a>366*DAY)return null;let n=0;for(let t=a;t<=b;t+=DAY){const w=new Date(t).getUTCDay();if(w!==0&&w!==6)n++;}return n;}
 function normalize(raw,opts={}){
  const now=opts.now??Date.now(),safe=(s,n)=>text(opts.sanitize?opts.sanitize(s):s,n),at=time(raw?.atualizadoEm),source=opts.source||null,valid=!!raw&&!!source&&!!at&&Date.parse(at)<=now,observedAt=new Date(now).toISOString(),today=new Intl.DateTimeFormat('en-CA',{timeZone:opts.zone||'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now)),currency=['BRL','USD','EUR'].includes(raw?.moeda)?raw.moeda:null,evidence={at,source,valid,old:!!at&&now-Date.parse(at)>TTL,observedAt},entries=[],counts=new Map();
  for(const r of Array.isArray(raw?.lancamentos)?raw.lancamentos:[]){
   const id=safe(r?.id,80),description=safe(r?.descricao),usd=r?.valor_usd!==null&&r?.valor_usd!==undefined,rowCurrency=usd?'USD':(['BRL','USD','EUR'].includes(r?.moeda)?r.moeda:currency),ambiguous=usd&&r?.valor!==null&&r?.valor!==undefined,value=cents(usd?r?.valor_usd:r?.valor),date=typeof r?.data==='string'&&r.data.length===10?day(r.data):null,invalidDate=r?.data!==null&&r?.data!==undefined&&(!date||date>today),kind=['gasto','entrada'].includes(r?.tipo)?r.tipo:null,category=CATEGORIES.includes(r?.categoria)?r.categoria:null,recurrence=RECURRENCES.includes(r?.recorrencia)?r.recorrencia:null,origin=safe(r?.fonte),share=fraction(r?.parte_do_dono),known=valid&&!!rowCurrency&&!!id&&!!description&&!!kind&&!!origin&&value!==null&&!ambiguous&&!invalidDate;
   if(id)counts.set(id,(counts.get(id)||0)+1);const people=raw?.divisao?.IA?.pessoas,divisionSource=safe(raw?.divisao?.IA?.fonte),sharingPeople=category==='IA'&&valid&&divisionSource&&Number.isInteger(people)&&people>1&&share!==null&&Math.abs(share-1/people)<1e-10?people:null;
   entries.push({id,description,date,kind,category,recurrence,origin,currency:rowCurrency,value:valid&&origin&&rowCurrency&&!ambiguous?value:null,share:valid&&origin?share:null,sharingPeople,divisionSource:sharingPeople?divisionSource:null,returnBase:safe(r?.base_retorno,80),ownerValue:known&&share!==null?value*share:null,partOf:safe(r?.parte_de,80),reinvested:valid&&origin?cents(r?.reinvestido_usd):null,note:safe(r?.nota),amountKnown:known,complete:known&&!!date&&!!category&&!!recurrence});
  }
  for(let i=0;i<entries.length;i++){const r=raw.lancamentos[i],e=entries[i];e.estimated=r.estimado===true||r.aproximado===true||/\b(?:aproximad\w*|estimad\w*|cerca de)\b|~\s*\d/i.test([r.nota,r.fonte,r.descricao].filter(Boolean).join(' '));}
  for(const e of entries)if(counts.get(e.id)!==1){e.amountKnown=false;e.complete=false;}
  const map=new Map(entries.filter(e=>e.id&&counts.get(e.id)===1).map(e=>[e.id,e])),children=new Map();
  for(const e of entries)if(e.partOf){const parent=map.get(e.partOf);if(!parent||parent.partOf||parent.kind!==e.kind||parent.currency!==e.currency||!parent.amountKnown||!e.amountKnown){e.amountKnown=false;e.linkInvalid=true;if(parent)parent.amountKnown=false;}else{const list=children.get(parent.id)||[];list.push(e);children.set(parent.id,list);}}
  for(const [id,list]of children)if(list.reduce((sum,e)=>sum+e.value,0)>map.get(id).value){map.get(id).amountKnown=false;for(const e of list){e.amountKnown=false;e.linkInvalid=true;}}
  const currencies=[...new Set([currency,...entries.map(e=>e.currency)].filter(Boolean))],totalsByCurrency={};
  for(const code of currencies){
   const all=entries.filter(e=>e.currency===code),gross=all.filter(e=>!e.partOf||e.linkInvalid),owner=all.filter(e=>!children.has(e.id)),baseValid=valid&&Array.isArray(raw?.lancamentos)&&all.length>0,missing=gross.filter(e=>!e.amountKnown).length,ownerMissing=owner.filter(e=>!e.amountKnown||e.share===null).length,knownInvested=gross.filter(e=>e.amountKnown&&e.kind==='gasto').reduce((s,e)=>s+e.value,0),knownRevenue=gross.filter(e=>e.amountKnown&&e.kind==='entrada').reduce((s,e)=>s+e.value,0),knownOwnerInvested=Math.round(owner.filter(e=>e.amountKnown&&e.share!==null&&e.kind==='gasto').reduce((s,e)=>s+e.value*e.share,0)),knownOwnerRevenue=Math.round(owner.filter(e=>e.amountKnown&&e.share!==null&&e.kind==='entrada').reduce((s,e)=>s+e.value*e.share,0));
   const monthly=gross.filter(e=>e.kind==='gasto'&&e.recurrence==='mensal'),contracts=new Set();let monthlyValid=baseValid,ownerMonthlyValid=baseValid;
   for(const e of gross)if(!e.kind||e.kind==='gasto'&&!e.recurrence){monthlyValid=false;if(e.share!==0)ownerMonthlyValid=false;}
   for(const e of monthly){const contract=(e.description||'').toLowerCase()+'|'+e.category;if(!e.amountKnown||contracts.has(contract))monthlyValid=false;if(!e.amountKnown||e.share===null||contracts.has(contract))ownerMonthlyValid=false;contracts.add(contract);}
   const complete=baseValid&&!missing,ownerComplete=baseValid&&!ownerMissing,knownMonthly=monthly.filter(e=>e.amountKnown).reduce((s,e)=>s+e.value,0),knownOwnerMonthly=Math.round(monthly.filter(e=>e.amountKnown&&e.share!==null).reduce((s,e)=>s+e.value*e.share,0));
   totalsByCurrency[code]={currency:code,balance:complete?knownRevenue-knownInvested:null,monthly:monthlyValid?knownMonthly:null,returnRatio:complete&&knownInvested>0?knownRevenue/knownInvested:null,invested:complete?knownInvested:null,revenue:complete?knownRevenue:null,knownBalance:baseValid?knownRevenue-knownInvested:null,knownMonthly:baseValid?knownMonthly:null,missing,datesMissing:all.filter(e=>!e.date).length,monthlyReason:monthlyValid?null:'recurrence',owner:{balance:ownerComplete?knownOwnerRevenue-knownOwnerInvested:null,invested:ownerComplete?knownOwnerInvested:null,revenue:ownerComplete?knownOwnerRevenue:null,monthly:ownerMonthlyValid?knownOwnerMonthly:null,returnRatio:ownerComplete&&knownOwnerInvested>0?knownOwnerRevenue/knownOwnerInvested:null,knownBalance:baseValid?knownOwnerRevenue-knownOwnerInvested:null,missing:ownerMissing},reinvestedUsd:all.filter(e=>e.reinvested!==null).reduce((s,e)=>s+e.reinvested,0)};
  }
  // Receita/gasto exige a mesma base explicitamente atribuída pela fonte.
  // Uma única despesa em USD não comprova todo o custo da receita em USD.
  for(const code of currencies){
   const total=totalsByCurrency[code],gross=entries.filter(e=>e.currency===code&&(!e.partOf||e.linkInvalid));
   const comparable=returnComparison(gross,evidence);
   total.returnRatio=comparable.ratio;total.returnReason=comparable.reason;
   const owner=entries.filter(e=>e.currency===code&&!children.has(e.id)&&e.share!==0);
   const personal=returnComparison(owner,evidence,true);
   total.owner.returnRatio=personal.ratio;total.owner.returnReason=personal.reason;
  }
  for(const code of currencies){const t=totalsByCurrency[code],gross=entries.filter(e=>e.currency===code&&(!e.partOf||e.linkInvalid)),personal=entries.filter(e=>e.currency===code&&!children.has(e.id));t.estimated=gross.some(e=>e.estimated);t.monthlyEstimated=gross.some(e=>e.kind==='gasto'&&e.recurrence==='mensal'&&e.estimated);t.owner.estimated=personal.some(e=>e.share!==0&&e.estimated);t.owner.monthlyEstimated=personal.some(e=>e.kind==='gasto'&&e.recurrence==='mensal'&&e.share!==0&&e.estimated);}
  const totals=totalsByCurrency[currency]||{balance:null,monthly:null,returnRatio:null,returnReason:'missing',invested:null,revenue:null};
  const assets=(Array.isArray(raw?.ativos)?raw.ativos:[]).map(r=>{const supplied=r?.valor_usd??r?.valor,amount=typeof supplied==='number'?supplied:typeof supplied==='string'&&supplied.trim()!==''?Number(supplied):null,amountKnown=Number.isFinite(amount)&&amount>=0,start=day(r?.pago_em),end=day(r?.valido_ate),s=start?Date.parse(start+'T00:00:00Z'):null,t=end?Date.parse(end+'T23:59:59Z'):null,known=valid&&s!==null&&t!==null&&s<t;return {name:safe(r?.nome),needsOwner:[...(!amountKnown?['valor']:[]),...(!start?['pago_em']:[]),...(!end?['valido_ate']:[])],note:safe(r?.nota),start,end,currency:r?.valor_usd!==undefined?'USD':currency,value:valid&&currency&&amountKnown?(amount===0?0:cents(amount)):null,remaining:known?Math.max(0,Math.ceil((t-now)/DAY)):null,expired:known&&now>t,warning:known&&t-now<=30*DAY,life:known?Math.max(0,Math.min(1,(t-now)/(t-s))):null};}).filter(a=>a.name);
  const accounts=[],ids=new Set();for(const r of Array.isArray(raw?.ia)?raw.ia:[]){const name=safe(r?.conta,60);if(!name||ids.has(name))continue;ids.add(name);const read=time(r.lido_em),reset=time(r.zera_em),measured=!!source&&!!read&&Date.parse(read)<=now,expired=!!reset&&Date.parse(reset)<=now,used=measured&&!expired&&typeof r.semana_pct==='number'&&r.semana_pct>=0&&r.semana_pct<=100?r.semana_pct:null;accounts.push({name,plan:safe(r.plano,100),used,remaining:used===null?null:100-used,read,reset,old:!!read&&now-Date.parse(read)>TTL,expired,workdays:measured&&reset?workdays(observedAt,reset,opts.zone):null});}
  return {available:!!raw,currency,currencies,evidence,version:opts.version||null,entries,assets,accounts,totals,totalsByCurrency,incomplete:!valid||!Array.isArray(raw?.lancamentos)||entries.some(e=>!e.amountKnown),monthlyIncomplete:Object.values(totalsByCurrency).some(t=>t.monthly===null),note:safe(raw?.nota),observedAt};
 }
 function returnComparison(rows,evidence,owner=false){
  const result=reason=>({ratio:null,reason});
  if(!evidence.valid||evidence.old)return result('stale');
  if(!rows.length||rows.some(e=>!e.amountKnown||(owner&&e.share===null)))return result('missing');
  if(rows.some(e=>!e.date))return result('dates');
  const bases=new Set(rows.map(e=>e.returnBase));
  if(bases.size!==1||!rows[0].returnBase)return result('scope');
  const amount=e=>e.value*(owner?e.share:1),cost=rows.filter(e=>e.kind==='gasto').reduce((s,e)=>s+amount(e),0),income=rows.filter(e=>e.kind==='entrada').reduce((s,e)=>s+amount(e),0);
  if(cost<=0)return result('cost');if(income<=0)return result('income');
  return {ratio:income/cost,reason:null};
 }
 const api={normalize,returnComparison,CATEGORIES,RECURRENCES,cents,day,time,text,workdays,TTL,fraction};if(typeof module==='object'&&module.exports)module.exports=api;else root.FinanceModel=api;
})(typeof globalThis==='object'?globalThis:this);
