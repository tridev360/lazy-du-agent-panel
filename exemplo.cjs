'use strict';
const fs=require('node:fs'),path=require('node:path');
function loadExample(){
  const fixture=path.join(__dirname,'exemplo.json');if(fs.lstatSync(fixture).isSymbolicLink())throw Error('Invalid example link');
  const base=fs.realpathSync(__dirname),file=fs.realpathSync(fixture);
  if(file!==path.join(base,'exemplo.json'))throw Error('Example must stay inside panel');
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!data||data.example!==true||!Array.isArray(data.tasks)||data.tasks.length!==40||!Array.isArray(data.cards)||data.cards.length!==3||!Array.isArray(data.pipelineItems)||!data.credits?.claude||!data.credits?.codex||!Number.isFinite(Date.parse(data.updated)))throw Error('Invalid example');
  if(data.tasks.some(task=>!/^demo-feature-\d+$/.test(task.id)||!['ATENDIMENTO','ASSISTENTE','CONTENT','GAMES'].includes(task.owner)||!task.phase)||new Set(data.tasks.map(task=>task.id)).size!==40)throw Error('Invalid example tasks');
  if(data.cards.some(card=>!/^demo-choice-\d+$/.test(card.id)||!card.exemplo||!Array.isArray(card.opcoes)||!card.opcoes.length)||new Set(data.cards.map(card=>card.id)).size!==3)throw Error('Invalid example cards');
  // The fixture owns all example fields, including credits, dates and details.
  delete data.nonce;
  return data;
}
function snapshotExample(answers){const data=loadExample();data.cards=data.cards.filter(card=>!answers.has(card.id));data.needsCount=data.cards.length+(data.needsTotal||0);return data;}
function answerExample(answers,id,option){
  const card=loadExample().cards.find(card=>card.id===id);
  if(!card||!Number.isInteger(option)||option<0||option>=card.opcoes.length||answers.has(id))throw Error('Invalid example choice');
  answers.set(id,option);return {ok:true,example:true};
}
module.exports={snapshotExample,answerExample};
