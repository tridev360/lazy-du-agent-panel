'use strict';
//  - dayInfo(root,now).isToday(arquivo,linha,relogio,texto): o dia de cada linha pelo git blame do estado (linha ainda nao
//    commitada = escrita depois do ultimo commit; commitada = o dia do commit). Sem git, pela data da tag ([...-20261002], ...-02-10)
//    e, sem tag, pelo relogio (hora depois de agora = ontem). So leitura: o git blame nao grava nada.
//  - glued(texto): frase com palavra grudada (o disco as vezes vem sem espaco). Sigla colada (visitantesEN, PROfind, ecardRARES),
//    letra solta no fim (LevaE), duas palavras conhecidas coladas (conformeClaude, emjunção, ecard, osdois), mais de 18 letras
//    seguidas ou null/undefined no fim (artepartnernull). "Conhecida" = aparece sozinha no proprio disco (setCorpus).
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');

// ---------- dia de cada linha ----------
const blameCache=new Map();
function blameOf(root,file){
  let stat;try{stat=fs.statSync(path.join(root,file));}catch{return null;}
  const key=path.resolve(root)+'|'+file,sig=stat.mtimeMs+':'+stat.size,hit=blameCache.get(key);
  if(hit&&hit.sig===sig)return hit.map;
  let map=null;
  try{
    const r=cp.spawnSync('git',['-C',root,'blame','--line-porcelain','--',file],{encoding:'utf8',maxBuffer:64*1024*1024,timeout:8000,windowsHide:true});
    if(r.status===0&&r.stdout){
      map=new Map();let cur=null;
      for(const line of r.stdout.split('\n')){
        const head=/^([0-9a-f]{40}) \d+ (\d+)/.exec(line);
        if(head){cur={committed:!/^0{40}$/.test(head[1]),time:null,line:Number(head[2])};continue;}
        if(!cur)continue;
        if(line.startsWith('committer-time '))cur.time=Number(line.slice(15))*1000;
        else if(line.startsWith('\t')){map.set(cur.line,cur);cur=null;}
      }
    }
  }catch{map=null;}
  blameCache.set(key,{sig,map});return map;
}
const brt=ms=>new Date(ms-3*3600000);
const brtDay=ms=>brt(ms).toISOString().slice(0,10);
const brtMinute=ms=>{const d=brt(ms);return d.getUTCHours()*60+d.getUTCMinutes();};
function clockMinute(text){const m=/(?<![\d:])([01]?\d|2[0-3]):([0-5])([\dx])(?![\d:])/i.exec(String(text||''));return m?Number(m[1])*60+Number(m[2])*10+(/x/i.test(m[3])?0:Number(m[3])):null;}
function tagDay(text,year){
  let day=null;
  for(const m of String(text||'').matchAll(/-(20\d{2})(\d{2})(\d{2})(?![\d])|-(\d{2})-(\d{2})(?=[\])\s:,.;]|$)/g)){
    if(m[1])day=m[1]+'-'+m[2]+'-'+m[3];
    else{const d=Number(m[4]),mo=Number(m[5]);if(d>=1&&d<=31&&mo>=1&&mo<=12)day=year+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');}
  }
  return day;
}
function dayInfo(root,now=new Date()){
  const today=brtDay(now.getTime()),nowMinute=brtMinute(now.getTime());
  return {today,isToday(file,lineNo,clockText,text){
    const minute=clockMinute(clockText),blame=blameOf(root,file),info=blame&&Number.isInteger(lineNo)?blame.get(lineNo):null;
    if(info){
      if(!info.committed)return minute===null||minute<=nowMinute+5;
      if(!Number.isFinite(info.time)||brtDay(info.time)!==today)return false;
      return minute===null||minute<=brtMinute(info.time)+5;
    }
    const tag=tagDay(text,today.slice(0,4));
    if(tag&&tag!==today)return false;
    return minute===null||minute<=nowMinute+5;
  }};
}

// ---------- palavra grudada ----------
const plainWord=word=>String(word).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
let corpus=new Map(),corpusSig='';
function setCorpus(texts){
  const list=(Array.isArray(texts)?texts:[]).map(text=>String(text||'')),sig=list.map(text=>text.length).join(',');
  if(sig===corpusSig)return;
  const map=new Map();
  for(const text of list)for(const word of text.match(/[A-Za-zÀ-ÿ]+/g)||[]){const w=plainWord(word);map.set(w,(map.get(w)||0)+1);}
  corpus=map;corpusSig=sig;
}
const freq=word=>corpus.get(plainWord(word))||0;
const FUNCTION_WORDS=['com','sem','por','pra','que','uma','nao','mais','dos','das','nos','nas','aos','em','de','do','da','no','na','os','as','ao','um','se','ja','so','e','o','a'];
// Palavras comuns que comecam com uma dessas e nao sao coladas (o resto delas tambem existe sozinho).
const ALLOW=new Set(['depois','desde','dentro','demais','embora','enquanto','entre','entao','ainda','agora','acima','abaixo','antes','aqui','assim','aonde','comando','comum','contra','nossa','nosso','nunca','outra','outro','para','pela','pelo','porque','quando','sobre','tambem','todo','toda','todos','todas','acerto','acesso','agente','agentes','aberto','aberta','abertos','abertas','acordo','aviso','avisos','email','aposta','apostas','aguarda','aguardam','aguardar','aguardo','demora','desfazer','desliga','desligado','desligada','deploy','default','emprego','empresa','apagar','acaba','acabam','acabar','apoio','apoiar','atraso','atrasos','adiante','dentre','defesa','depende','devolve','sempre','semana','semanas','seguro','segura','somente','sozinho','sozinha','ofertas','oferta','ordem','ordens','arquivo','arquivos']);
const LETTERS_19=/[A-Za-zÀ-ÿ]{19,}/,CAPS_GLUE=/[a-zà-ÿ]{2,}[A-ZÀ-Þ]{2,}|\b[A-ZÀ-Þ]{2,}[a-zà-ÿ]{3,}/,NULL_TAIL=/[a-zà-ÿ]{3,}(?:null|undefined)\b/,LETTER_TAIL=/^[A-Za-zÀ-ÿ]*[a-zà-ÿ]{2,}[A-ZÀ-Þ]$/,CAMEL=/^([A-Za-zÀ-ÿ]*[a-zà-ÿ]{2,})([A-ZÀ-Þ][a-zà-ÿ]{2,})$/;
function gluedWord(token){
  if(LETTER_TAIL.test(token))return true;
  const camel=CAMEL.exec(token);
  if(camel){const left=freq(camel[1]),right=freq(camel[2]);if(left>=3&&right>=3&&freq(token)*4<Math.min(left,right))return true;}
  const word=plainWord(token);
  if(word.length<5||ALLOW.has(word)||/[A-ZÀ-Þ]/.test(token.slice(1)))return false;
  for(const prefix of FUNCTION_WORDS){
    if(!word.startsWith(prefix))continue;
    const rest=word.slice(prefix.length);
    if(rest.length>=4&&freq(rest)>=3&&freq(word)*4<freq(rest))return true;
  }
  return false;
}
function glued(text){
  const value=String(text||'');
  if(LETTERS_19.test(value)||CAPS_GLUE.test(value)||NULL_TAIL.test(value))return true;
  for(const token of value.match(/[A-Za-zÀ-ÿ]+/g)||[])if(gluedWord(token))return true;
  return false;
}
module.exports={dayInfo,blameOf,tagDay,clockMinute,setCorpus,glued,gluedWord};
