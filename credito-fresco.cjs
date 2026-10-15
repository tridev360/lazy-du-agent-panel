'use strict';
// So leitura. Quem GRAVA:
//   Codex  -> estado/uso-codex.json, com "lidoEm" (hora do evento do proprio Codex).
//   Claude -> estado/credito-claude.jsonl e estado/uso-claude.json (gravados a cada consulta de uso).
// Nenhum script agendado consegue chamar o get_usage do Claude; por isso o Claude e honesto (idade ou "?"), nao automatico.
const fs=require('node:fs'),path=require('node:path');
const MAX_AGE_MS=2*3600000,FUTURE_SLACK_MS=120000,WEEK_MINUTES=10080;

function lerJson(root,relative,max=16000){
  try{
    const file=path.join(root,relative),stat=fs.lstatSync(file);
    if(stat.isSymbolicLink()||!stat.isFile()||stat.size>max)return null;
    return JSON.parse(fs.readFileSync(file,'utf8').replace(/^﻿/,''));
  }catch{return null;}
}
// aceita ISO, epoch em segundos (rate_limits do Codex) e epoch em ms
function ms(value){
  if(typeof value==='number')return Number.isFinite(value)&&value>0?(value<1e12?value*1000:value):NaN;
  if(typeof value==='string'&&value.trim())return Date.parse(value);
  return NaN;
}
const iso=value=>{const at=ms(value);return Number.isFinite(at)?new Date(at).toISOString():null;};
const pct=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100;

// estado/uso-codex.json. "lidoEm" e a hora do evento token_count do Codex, nao a hora do script.
function lerCodex(root){
  const raw=lerJson(root,'estado/uso-codex.json');
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
  const at=ms(raw.lidoEm);
  if(!Number.isFinite(at))return null;
  const windows=[];
  if(pct(raw.semana_pct))windows.push({used:raw.semana_pct,minutes:WEEK_MINUTES,reset:iso(raw.zera_semana)});
  if(pct(raw.janela_pct)&&Number.isFinite(raw.janela_minutos)&&raw.janela_minutos>0)windows.push({used:raw.janela_pct,minutes:raw.janela_minutos,reset:iso(raw.zera_janela)});
  return {updated:new Date(at).toISOString(),source:'estado/uso-codex.json',windows};
}

// A leitura mais nova ganha; empate fica com o primeiro (a fonte gravada por script).
function maisNova(...candidatos){
  let best=null,bestAt=-Infinity;
  for(const c of candidatos){
    if(!c||typeof c!=='object')continue;
    const at=ms(c.updated);
    if(Number.isFinite(at)&&at>bestAt){best=c;bestAt=at;}
    else if(!best)best=c;
  }
  return best;
}

// Marca a leitura como velha ou nao. Leitura velha perde as janelas (nenhum consumidor consegue mostrar o numero);
// "updated" fica, para a tela dizer a hora. Janela cujo reset ja passou tambem sai.
function fresco(credit,now=Date.now(),maxAge=MAX_AGE_MS){
  const base=credit&&typeof credit==='object'?credit:{};
  const at=ms(base.updated);
  let reason=null;
  if(!Number.isFinite(at))reason='sem hora';
  else if(at>now+FUTURE_SLACK_MS)reason='hora futura';
  else if(now-at>maxAge)reason='antiga';
  const alive=(Array.isArray(base.windows)?base.windows:[]).filter(item=>{const reset=ms(item?.reset);return !(Number.isFinite(reset)&&reset<=now);});
  if(!reason&&!alive.length)reason='zerou';
  return {
    ...base,
    updated:Number.isFinite(at)?new Date(at).toISOString():null,
    ageMinutes:Number.isFinite(at)&&at<=now+FUTURE_SLACK_MS?Math.max(0,Math.floor((now-at)/60000)):null,
    stale:reason!==null,
    staleReason:reason,
    windows:reason?[]:alive
  };
}

// current = snapshot.credits do leitor (Claude de uso-claude.json; Codex pela varredura das conversas publicas).
// Devolve o novo objeto credits, ja com a regra das 2 h.
function creditos(root,current,now=Date.now()){
  let claudeJsonl=null;
  try{claudeJsonl=require('./credito-claude.cjs').claudeCredit(root,new Date(now));}catch{}
  const claude=maisNova(claudeJsonl,current?.claude);
  const arquivo=lerCodex(root),varredura=current?.codex;
  let vps=null;try{vps=require('./codex-sessoes.cjs').creditoVps();}catch{vps=null;}
  const escolhido=maisNova(arquivo,vps,varredura&&varredura.updated?varredura:null)||varredura||null;
  // os resets guardados vem de outro arquivo (uso-codex-resets.json) e seguem como estavam
  const codex=escolhido?{...escolhido}:{};
  for(const key of ['resetsAvailable','resetsUpdated'])if(varredura&&key in varredura&&!(key in codex))codex[key]=varredura[key];
  return {...(current||{}),claude:fresco(claude,now),codex:fresco(codex,now)};
}

function carimbo(at,now=Date.now()){
  if(!Number.isFinite(at))return null;
  const two=n=>String(n).padStart(2,'0'),d=new Date(at-3*3600000),n=new Date(now-3*3600000),hhmm=two(d.getUTCHours())+':'+two(d.getUTCMinutes());
  return d.getUTCFullYear()===n.getUTCFullYear()&&d.getUTCMonth()===n.getUTCMonth()&&d.getUTCDate()===n.getUTCDate()?hhmm:two(d.getUTCDate())+'/'+two(d.getUTCMonth()+1)+' '+hhmm;
}
const idade=minutos=>minutos<60?minutos+' min':Math.floor(minutos/60)+' h '+String(minutos%60).padStart(2,'0')+' min';

// Para o "Crédito" do Agora/WEN (que antes lia o texto escrito a mao em estado-agora.json, com a hora renovada a cada 3 min pelo estado-auto).
// Devolve null quando nenhuma fonte existe: o texto escrito pela sua IA segue como estava (so acontece em pasta de teste).
function paraAgora(root,now=Date.now()){
  const uso=lerJson(root,'estado/uso-claude.json');
  const base=uso&&Number.isFinite(ms(uso.hora))?{claude:{updated:iso(uso.hora),account:String(uso.conta||'?').slice(0,4),windows:[{used:uso.semana_pct,minutes:WEEK_MINUTES,reset:iso(uso.semana_zera)},{used:uso.janela5h_pct,minutes:300,reset:iso(uso.janela5h_zera)}].filter(x=>pct(x.used))}}:{};
  const todos=creditos(root,base,now);
  if(!todos.claude.updated&&!todos.codex.updated)return null;
  const linha=credit=>{
    const week=(credit.windows||[]).find(item=>item.minutes>=10000&&pct(item.used));
    const hora=carimbo(ms(credit.updated),now);
    if(credit.stale||!week)return {texto:'? · '+(hora?'lido '+hora:'sem leitura'),...(credit.updated?{lidoEm:credit.updated}:{})};
    return {semana:week.used,texto:'lido '+hora+' · '+idade(credit.ageMinutes),lidoEm:credit.updated,...(iso(week.reset)?{zeraEm:iso(week.reset)}:{})};
  };
  return {credito:{claude:linha(todos.claude),codex:linha(todos.codex)},fontes:[{file:'estado/credito-claude.jsonl',note:todos.claude.updated?'lido '+carimbo(ms(todos.claude.updated),now):'sem leitura'},{file:todos.codex.source&&/VPS/.test(todos.codex.source)?'VPS (rollouts do codex exec, ssh 60 s)':'estado/uso-codex.json',note:todos.codex.updated?'lido '+carimbo(ms(todos.codex.updated),now):'sem leitura'}]};
}

module.exports={MAX_AGE_MS,WEEK_MINUTES,lerCodex,maisNova,fresco,creditos,carimbo,idade,paraAgora,ms};
