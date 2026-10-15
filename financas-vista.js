'use strict';
(function(root){
  // Presentation only. All amounts, ownership and evidence come from FinanceModel.
  const groups=['IA','infra','outros'];
  const category=value=>value==='IA'?'IA':value==='infra'?'infra':value?'outros':null;
  function spending(data){
    const entries=data.entries||[],gross=entries.filter(e=>!e.partOf||e.linkInvalid);
    return (data.currencies||[]).map(currency=>{
      const total=data.totalsByCurrency?.[currency],base=!!data.evidence?.valid&&Number.isFinite(total?.knownBalance);
      const rows=gross.filter(e=>e.currency===currency),unplaced=entries.some(e=>!e.currency&&e.kind!=='entrada');
      const unknown=unplaced||rows.some(e=>!e.kind||e.kind==='gasto'&&(!e.amountKnown||!category(e.category)));
      const complete=base&&!unknown;
      const values=groups.map(name=>({name,value:rows.filter(e=>e.kind==='gasto'&&e.amountKnown&&category(e.category)===name).reduce((sum,e)=>sum+e.value,0)}));
      // count: gastos daquela categoria nesta moeda; a tela esconde a categoria sem nenhum (nunca "US$ 0,00" inventado).
      for(const g of values){g.estimated=rows.some(e=>e.kind==='gasto'&&category(e.category)===g.name&&e.estimated);g.count=rows.filter(e=>e.kind==='gasto'&&category(e.category)===g.name).length;}const max=Math.max(0,...values.map(g=>g.value));
      return {currency,complete,base,groups:values.map(g=>({...g,value:base?g.value:null,scale:complete&&max>0?g.value/max:null}))};
    });
  }
  function reserve(accounts=[]){
    // Percentages from different plans are not a shared credit balance.
    return accounts.filter(a=>Number.isFinite(a.remaining)&&!a.expired).sort((a,b)=>Number(a.old)-Number(b.old)||b.remaining-a.remaining)[0]||null;
  }
  const api={spending,reserve,category};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.FinanceView=api;
})(typeof globalThis==='object'?globalThis:this);
