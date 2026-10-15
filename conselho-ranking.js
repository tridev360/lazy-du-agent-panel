'use strict';
(function(root){
  const matches={FAZER:'yes',PROVAR:'yes',GUARDAR:'depends',DESCARTAR:'no'};
  function calculate(council,ledger,now=Date.now()){
    const month=new Date(now).toISOString().slice(0,7),members=[...(council?.members||[])],valid=council?.councilEvidence?.valid===true&&ledger?.valid===true;
    const hasPresident=(council?.ideas||[]).some(i=>['FAZER','PROVAR','GUARDAR','DESCARTAR'].includes(i.presidentChoice));
    if(hasPresident)members.push({id:'coordenador-presidente',name:'COORDENADOR'});
    const rows=members.map((m,index)=>({id:m.id,name:m.name,index,points:valid?0:null,judged:0,accuracy:null,streak:valid?0:null,monthPoints:valid?0:null,monthJudged:0}));
    const ideas=new Map((council?.ideas||[]).filter(i=>i.sourceId).map(i=>[i.sourceId,i])),ids=new Set(),duplicates=new Set();
    for(const seal of ledger?.rows||[]){if(ids.has(seal.id))duplicates.add(seal.id);ids.add(seal.id);}
    const calendar=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(s)&&Number.isFinite(Date.parse(s.slice(0,10)+'T12:00:00Z'))&&new Date(s.slice(0,10)+'T12:00:00Z').toISOString().slice(0,10)===s.slice(0,10);
    const seals=valid?(ledger.rows||[]).filter(s=>typeof s.id==='string'&&!duplicates.has(s.id)&&Object.hasOwn(matches,s.veredito)&&calendar(s.hora)&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(s.hora)&&Number.isFinite(Date.parse(s.hora))&&Date.parse(s.hora)<=now).sort((a,b)=>Date.parse(a.hora)-Date.parse(b.hora)||a.id.localeCompare(b.id)):[];
    let unmatched=0,missingVotes=0;
    for(const seal of seals){const idea=ideas.get(seal.id);if(!idea){unmatched++;continue;}
      const seen=new Map(),conflicts=new Set(),votes=seal.votos?.map(v=>({memberId:v.conselheiro,value:v.voto}))||idea.votes||[];for(const v of votes){if(!['yes','no','depends'].includes(v.value))continue;if(seen.has(v.memberId)&&seen.get(v.memberId)!==v.value)conflicts.add(v.memberId);else seen.set(v.memberId,v.value);}
      const currentMonth=new Date(seal.hora).toISOString().slice(0,7)===month;
      for(const row of rows){const president=row.id==='coordenador-presidente',vote=president?(Object.hasOwn(seal,'parecer_coordenador')?seal.parecer_coordenador:idea.presidentChoice):seen.get(row.id);if(!vote||conflicts.has(row.id)){missingVotes++;continue;}
        const hit=president?vote===seal.veredito:vote===matches[seal.veredito];row.judged++;if(hit)row.points++;row.streak=hit?row.streak+1:0;
        if(currentMonth){row.monthJudged++;if(hit)row.monthPoints++;}
      }
    }
    for(const row of rows)row.accuracy=row.judged?row.points/row.judged*100:null;
    const compare=(a,b)=>b.points-a.points||(b.accuracy??-1)-(a.accuracy??-1)||b.streak-a.streak;
    rows.sort((a,b)=>compare(a,b)||a.index-b.index);for(let i=0;i<rows.length;i++)rows[i].position=valid&&seals.length>0?(i&&compare(rows[i],rows[i-1])===0?rows[i-1].position:i+1):null;
    const topMonth=Math.max(0,...rows.map(r=>r.monthPoints||0)),bestAccuracy=Math.max(0,...rows.filter(r=>r.judged).map(r=>r.accuracy));
    return {valid,ledgerMissing:ledger?.missing===true,month,seals:seals.length,empty:valid&&seals.length===0,rows,monthlyLeaders:topMonth>0?rows.filter(r=>r.monthPoints===topMonth).map(r=>r.id):[],alignedLeaders:bestAccuracy>0?rows.filter(r=>r.judged&&r.accuracy===bestAccuracy).map(r=>r.id):[],unmatched,missingVotes,duplicates:duplicates.size,sources:['estado/ideias/conselho.json','estado/ideias/vereditos-dono.jsonl']};
  }
  const api={calculate,matches};if(typeof module==='object'&&module.exports)module.exports=api;else root.CouncilRanking=api;
})(typeof globalThis==='object'?globalThis:this);
