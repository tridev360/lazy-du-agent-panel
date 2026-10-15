'use strict';
const os=require('node:os'),path=require('node:path');
const {atividadeClaude,juntarNoEstado}=require('./claude-atividade.cjs');
const {criarHistorico}=require('./historico-fluxo.cjs');
const JANELAS=Object.freeze(['2h','6h','12h','24h','semana','mes','total']);
function medirCpu(){
 const soma=()=>os.cpus().reduce((s,c)=>{s.idle+=c.times.idle;s.total+=Object.values(c.times).reduce((a,b)=>a+b,0);return s;},{idle:0,total:0});
 const antes=soma();return new Promise(resolve=>setTimeout(()=>{const depois=soma(),total=depois.total-antes.total;resolve(total>0?100*(1-(depois.idle-antes.idle)/total):100);},500));
}
function criarIntegracao(root,cfg={},dep={}){
 const now=dep.now||Date.now,ler=dep.atividadeClaude||atividadeClaude,juntar=dep.juntarNoEstado||juntarNoEstado;
 const cpu=dep.medirCpu||medirCpu;
 const cacheFile=cfg.cacheFile||require('./so-leitura.cjs').cacheLocal('cache-fluxo.json');
 const hist=(dep.criarHistorico||criarHistorico)({estadoRoot:root,claudeRoot:cfg.claudeRoot,appRoot:cfg.appRoot,cacheFile});
 let atividade=null,atividadeEm=-Infinity,atividadeGeracao=0,windows=null,windowsEm=-Infinity,histGeracao=0,nextRefresh=0,lendo=null,closed=false;
 // (so o codigo do erro, sem caminho) e a volta pulada por CPU alta; o snapshot leva isso em fluxoLeitura e o log do servidor ganha 1 linha.
 let tentouEm=null,histOkEm=null,falha=null,pulada=null,atividadeFalhaEm=null;
 const isoDe=t=>Number.isFinite(t)?new Date(t).toISOString():null;
 const FRASE_ERRO={ENOENT:'um arquivo do histórico sumiu no meio da leitura',EACCES:'o Windows negou a leitura de um arquivo',EPERM:'o Windows negou a leitura de um arquivo',EBUSY:'um arquivo estava em uso',EMFILE:'arquivos abertos demais de uma vez'};
 const motivoDe=e=>{const c=e&&typeof e.code==='string'?e.code:'';return FRASE_ERRO[c]||'a leitura deu erro';};
 const memo=new WeakMap();
 function rotulos(snapshot){
  // commandSessions ja vem do leitor sanitizado do painel; nome privado fica generico no modulo do autor.
  const out=new Map();for(const s of Array.isArray(snapshot.commandSessions)?snapshot.commandSessions:[]){if(s&&s.family==='codex'&&typeof s.threadId==='string'&&typeof s.name==='string')out.set(s.threadId.toLowerCase(),s.name);}return out;
 }
 function janelas(snapshot){const labels=rotulos(snapshot);return Object.fromEntries(JANELAS.map(k=>[k,hist.janela(k,{rotulosCodex:labels})]));}
 function atualizar(snapshot,t){
  if(closed||lendo||t<nextRefresh)return;nextRefresh=t+60000;
  // Historico real permanece no PC. CPU alta suspende tanto a primeira leitura quanto a incremental.
  lendo=Promise.resolve().then(cpu).then(async uso=>{if(closed)return;tentouEm=now();if(!Number.isFinite(uso)||uso>90){pulada={em:isoDe(now()),cpu:Number.isFinite(uso)?Math.round(uso):null};histGeracao++;return;}await hist.atualizar();if(!closed){windows=janelas(snapshot);windowsEm=now();histOkEm=windowsEm;falha=null;pulada=null;histGeracao++;}}).catch(e=>{falha={em:isoDe(now()),motivo:motivoDe(e)};histGeracao++;try{console.warn('[fluxo] releitura do historico falhou: '+falha.motivo);}catch{}}).finally(()=>{lendo=null;});
 }
 function decorar(snapshot){
  if(!snapshot||typeof snapshot!=='object')return snapshot;const t=now();
  if(t-atividadeEm>=15000){try{const a=ler({estadoRoot:root,projectsRoot:cfg.claudeRoot,appRoot:cfg.appRoot,now:t});atividade=a;atividadeEm=t;atividadeGeracao++;}catch(e){atividade=null;atividadeEm=t;atividadeFalhaEm=t;atividadeGeracao++;try{console.warn('[fluxo] leitura das conversas falhou: '+motivoDe(e));}catch{}}}
  if(!windows||t-windowsEm>=60000){try{windows=janelas(snapshot);windowsEm=t;histGeracao++;}catch{windows=Object.fromEntries(JANELAS.map(k=>[k,{janela:k,lido:false,lidoEm:null,cobreJanela:false,historicoDesde:null,ligacoes:[]} ]));windowsEm=t;histGeracao++;}}
  atualizar(snapshot,t);const signature=atividadeGeracao+':'+histGeracao,old=memo.get(snapshot);if(old&&old.signature===signature)return old.value;
  const h2=windows&&windows['2h']?windows['2h']:null;
  const fluxoLeitura={conversasLidasEm:atividade&&atividade.ok?atividade.lidoEm:null,conversasFalhaEm:isoDe(atividadeFalhaEm),historicoLidoEm:h2&&h2.lidoEm||null,tentouEm:isoDe(tentouEm),historicoRelidoEm:isoDe(histOkEm),falha,pulada};
  const value={...juntar(snapshot,atividade),fluxoHistorico:windows,fluxoLeitura};memo.set(snapshot,{signature,value});return value;
 }
 decorar.close=()=>{closed=true;};decorar.pending=()=>lendo;return decorar;
}
module.exports={criarIntegracao,JANELAS,medirCpu};
