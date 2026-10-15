'use strict';
(function(root){
 function instant(value){if(value===null||value===undefined||value==='')return null;const numeric=typeof value==='number'||typeof value==='string'&&/^\d+(?:\.\d+)?$/.test(value);const number=numeric?Number(value):Date.parse(value);const ms=numeric&&number<1e12?number*1000:number;return Number.isFinite(ms)&&ms>0&&ms<=8640000000000000?new Date(ms).toISOString():null;}
 function accounts(claude,codex,now=Date.now()){
  const row=(name,used,read,reset,source)=>{read=instant(read);reset=instant(reset);const measured=!!source&&!!read&&Date.parse(read)<=now,expired=!!reset&&Date.parse(reset)<=now,valid=measured&&!expired&&typeof used==='number'&&Number.isFinite(used)&&used>=0&&used<=100;return {name,plan:null,used:valid?used:null,remaining:valid?100-used:null,read,reset,old:!!read&&now-Date.parse(read)>1800000,expired,source:source||null,workdays:null};};
  const rows=(claude?.contas||[]).map(a=>row('Claude '+a.conta,a.semana,a.lidoEm,a.zeraSemana,'estado/credito-claude.jsonl'));
  const week=(codex?.windows||[]).find(w=>w.minutes>=10000);rows.push(row('Codex',week?.used,codex?.updated,week?.reset,codex?.source));return rows;
 }
 function text(credits,lang='pt',now=Date.now()){
  return ['claude','codex'].map(family=>{const c=credits?.[family],a=accounts({contas:[]},c,now)[0],name=family==='claude'?'Claude':'Codex',age=a.read&&Date.parse(a.read)<=now?Math.floor((now-Date.parse(a.read))/60000):null;return name+' '+(a.used===null?'?':a.used+'%')+' · '+(age===null?({pt:'sem leitura',en:'no reading',es:'sin lectura'})[lang]:age+' min'+(a.old?' · '+({pt:'antiga',en:'old',es:'antigua'})[lang]:''));}).join(' | ');
 }
 const api={instant,accounts,text};if(typeof module==='object'&&module.exports)module.exports=api;else root.PainelCreditoModelo=api;
})(typeof globalThis==='object'?globalThis:this);
