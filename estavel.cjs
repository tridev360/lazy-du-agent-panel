'use strict';
// Keep presentation identity in the serving process, even if a reader is replaced.
function createStabilizer(root,resolver,options={}){
 let pool=resolver;const accumulate=require('./consumo.cjs').createAccumulator(root,require('./so-leitura.cjs').ativo?{persist:false}:{});
 return function stabilize(snapshot){
  const team=snapshot?.equipe;if(!Array.isArray(team?.agents))return snapshot;
  require('./identidades.cjs').applyIdentities(root,team);
  pool||=require('./realtime.cjs').getAvatarResolver();
  const sessions=snapshot.operator?.sessions||[],ids=new Set(team.agents.map(agent=>agent.id));
  const nodes=sessions.map(session=>session.node).filter(node=>node&& !ids.has(node.id));
  const assigned=pool.assign([...team.agents,...nodes]),agente=new Map(assigned.map(agent=>[agent.id,agent.agente]));
  for(const agent of team.agents)agent.agente=agente.get(agent.id);
  for(const session of sessions)if(session.node)session.node.agente=agente.get(session.node.id)||session.node.agente;
  const now=new Date(snapshot.updated||Date.now());require('./previsao.cjs').applyForecasts(root,team,now);
  require('./previsao.cjs').applyForecasts(root+':operator',{agents:sessions.map(session=>session.node).filter(Boolean),groups:[]},now);
  require('./atividade.cjs').applyActivity(snapshot,options.processReading===false?{ids:new Set(),available:false}:undefined);
  try{team.guardaCodex=require('./guarda-codex.cjs').guardaDe(root);}catch{team.guardaCodex=null;}
  return accumulate(snapshot);
 };
}
module.exports={createStabilizer};
