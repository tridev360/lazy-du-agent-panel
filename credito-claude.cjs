'use strict';
// Credito do Claude da linha mais nova do estado/credito-claude.jsonl: a mesma que a linha Credito das 6 linhas (WEN e sala) le,
// com a hora da leitura. Semana ou janela que ja zeraram depois da leitura saem (a tela mostra "?"). So leitura.
const fs=require('node:fs'),path=require('node:path');
function claudeCredit(root,now=new Date()){
  let raw;
  try{const file=path.join(root,'estado','credito-claude.jsonl'),stat=fs.lstatSync(file);if(stat.isSymbolicLink()||!stat.isFile()||stat.size>512000)return null;raw=fs.readFileSync(file,'utf8');}catch{return null;}
  const rows=raw.split(/\r?\n/),passed=stamp=>{const at=Date.parse(stamp||'');return Number.isFinite(at)&&now.getTime()>=at;};
  for(let i=rows.length-1;i>=0;i--){
    if(!rows[i].trim())continue;
    let value;try{value=JSON.parse(rows[i]);}catch{continue;}
    if(!Number.isFinite(value.semana)||value.semana<0||value.semana>100)continue;
    const at=Date.parse(value.hora);if(!Number.isFinite(at))return null;
    const windows=[];
    if(!(value.zeraSemana?passed(value.zeraSemana):now.getTime()-at>7*86400000))windows.push({used:value.semana,minutes:10080,reset:value.zeraSemana||null});
    if(Number.isFinite(value.janela5h)&&value.janela5h>=0&&value.janela5h<=100&&!(value.zeraJanela?passed(value.zeraJanela):now.getTime()-at>5*3600000))windows.push({used:value.janela5h,minutes:300,reset:value.zeraJanela||null});
    return {updated:new Date(at).toISOString(),source:'estado/credito-claude.jsonl linha '+(i+1),account:String(value.conta||'?').slice(0,4),windows};
  }
  return null;
}
module.exports={claudeCredit};
