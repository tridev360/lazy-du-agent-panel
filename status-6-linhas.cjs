'use strict';
// WEN: o status em 6 linhas curtas, montado do disco na hora do pedido (so leitura, sem token).
// No ar | Rodando + previsao | Travado por | Da para acelerar? | Seu proximo passo | Credito do Claude e do Codex.
// Cada linha cabe em 1 linha da tela (MAX caracteres) e passa pelo filtro de palavras de gente (plain): sem sigla da casa,
// hash, id nem numero de item. A fonte tecnica (arquivo, linha e trecho) fica no detalhe, 1 clique.
// Sem dado = "?", nunca 0 inventado. Nada privado.
const fs=require('node:fs'),path=require('node:path');
const reader=()=>require('./leitor.cjs');
// PAINEL HOJE: palavra grudada (texto do disco sem espaco): mais de 18 letras seguidas, minusculas coladas numa sigla
// (visitantesEN, semPNG), sigla colada em minusculas (PROfind, GETprofile, RAREpublico) ou null/undefined no fim (artepartnernull).
// Dia de cada linha e palavra grudada (tambem a curta: emjunção, ecard): status6-hoje.cjs, ao lado deste arquivo.
const HOJE=require('./status6-hoje.cjs');
const gluedOf=text=>HOJE.glued(neutral(text));
// PAINEL HOJE: o que ja aconteceu (NO AR, subiu, FEITO, VERDE, entregue) nao vira hora de previsao.
const DONE=/\b(?:NO AR|SUBIU|SUBIRAM|FEITO|VERDE|ENTREGUE)\b|\b(?:subiu|subiram|entregue|entregou)\b/;
// No ar em portugues simples: sem o nome da leva nem os testes. Linha de chave de ambiente vira o que mudou para quem usa;
// nome de chave (MAIUSCULAS_COM_TRACO) nunca vai para a tela.
function simpleNoAr(head,line){let value=String(head||'');if(/^\s*env\b|\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|\+=/.test(value)){const rest=String(line||'').replace(/^\s*-\s*(?:\d{2}\/\d{2}\s+\d{2}:\d{2}|\d{2}:\d{2}\s+\d{2}\/\d{2})\s+/,'').replace(/\([^)]*\)/g,' ');const after=/:\s*([^;]+)/.exec(rest);value=after?after[1]:'';}value=value.replace(/\([^)]*\)/g,' ').replace(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/g,' ').replace(/\s+/g,' ').trim();const parts=value.split(/\s+\+\s+/).map(part=>part.replace(/^(?:LEVA|LOTE)\s+[A-Z0-9]\s*[=:]\s*/i,'').trim()).filter(Boolean);const kept=parts.filter(part=>!/^(?:LEVA|LOTE)\s+[A-Z0-9]\b/i.test(part)&&!/\bTier\s+S\b/i.test(part)&&!/^testes?\b/i.test(part));const pick=(kept[0]||'').split(/\s+/).map(word=>/^[A-ZÀ-Þ]{4,}$/.test(word)||/^(?:DO|DA|DOS|DAS|DE|E|O|A|OS|AS|NO|NA|NOS|NAS|EM|COM|POR|PRO|PRA|PARA)$/.test(word)?word.toLowerCase():word).join(' ');return pick?pick.charAt(0).toUpperCase()+pick.slice(1):'Versão nova';}
// PAINEL HOJE: trava em portugues simples: "candidato aguardando revisão exata" -> "Revisão pendente"; senao o texto de antes.
const SKIP_WORDS=/^(?:a|o|as|os|da|do|das|dos|de|um|uma|que|pela|pelo|nova|novo)$/i;
function simpleBlocker(clause){const text=plain(clause),wait=/\b(?:aguardando|aguarda|esperando|espera)\s+(.+)$/i.exec(text);if(wait){const noun=wait[1].split(/\s+/).map(word=>word.replace(/[^A-Za-zÀ-ÿ]/g,'')).find(word=>word.length>2&&!SKIP_WORDS.test(word));if(noun)return noun.charAt(0).toUpperCase()+noun.slice(1).toLowerCase()+(/s$/i.test(noun)?' pendentes':' pendente');}return blockerOf(clause);}
const LABELS={noar:'No ar',rodando:'Rodando',travado:'Travado por',acelerar:'Dá para acelerar?',proximo:'Seu próximo passo',credito:'Crédito'};
const MAX=60;
const PRIVATE=/PRIVADO|_SECRETS|backup-privado|\bseed\b|\.env\b|private key|chave privada|mnemonic/i;
const BLOCKER=/\b(?:trava|travad[oa]s?|bloque\w*|impede|segura\b|aguarda\w*|parad[oa]s?|falta\b|sem START|sem início|vermelh[oa]s?|esperando|vetos?\b)/i;
// Trava que o proprio texto diz resolvida ("a falta de X foi suprida") nao conta.
const RESOLVED=/\b(?:suprid[oa]s?|resolvid[oa]s?|destravad[oa]s?|conclu[ií]d[oa]s?|sem trava|n[aã]o (?:trava|impede|bloqueia))\b/i;
const RANGE=/(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)\s*(?:a|-|–|ate|até)\s*([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/i;
// Texto curto e simples: tira hash, id, caminho, link e endereco; separa palavras coladas; corta na palavra.
function neutral(value) {
  return String(value??'')
    .replace(/0x[0-9a-fA-F]{40}/g,'')
    .replace(/https?:\/\/\S+/g,'')
    .replace(/local_[0-9a-f-]{8,}/gi,'')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,'')
    .replace(/(?:[A-Z]:[\\/]|(?:app|wt|scratchpad|pasta-privada|casa|tasks|revisoes|estado)[\\/])[^\s,;)]+/g,'')
    .replace(/[0-9a-f]{7,64}/gi,s=>/\d/.test(s) && /[a-f]/i.test(s) ? '' : s)
    .replace(/(\d)\s*[–—]\s*(\d)/g,'$1 a $2')
    .replace(/[–—]/g,',')
    .replace(/\*\*|`/g,'');
}
function unglue(value) {
  return String(value)
    .replace(/\bnoar\b/gi,'no ar')
    .replace(/([a-zà-ÿ])([A-ZÀ-Þ])/g,'$1 $2')
    .replace(/([A-Za-zÀ-ÿ]{2})(\d)/g,'$1 $2')
    .replace(/(\d)([A-Za-zÀ-ÿ]{2,})/g,'$1 $2')
    .replace(/,(?=\S)/g,', ')
    .replace(/;(?=\S)/g,'; ');
}
function tidy(value) {return unglue(neutral(value)).replace(/\b\d{2}:\d{2}:\d{2}\b/g,'').replace(/\(\s*[,/]*\s*\)/g,'').replace(/\s+([,;.:])/g,'$1').replace(/([,;/])\s*(?=[,;/])/g,'').replace(/\s{2,}/g,' ').replace(/^[\s,;:.\-/]+|[\s,;:\-/]+$/g,'').trim();}
function short(value,limit=90) {
  const text=tidy(value);
  if(text.length<=limit)return text;
  const cut=text.slice(0,limit-1),space=cut.lastIndexOf(' ');
  return (space>limit*0.6 ? cut.slice(0,space) : cut).replace(/[\s,;:·]+$/,'')+'…';
}
function sentence(value) {
  const text=String(value).trim(),letters=text.replace(/[^A-Za-zÀ-ÿ]/g,'');
  if(letters && letters===letters.toUpperCase()){const lower=text.toLowerCase();return lower.charAt(0).toUpperCase()+lower.slice(1);}
  return text;
}
const FORBIDDEN=[/\bP[1-4]\b/,/\bROOT\b/i,/\bETAs?\b/i,/\bguard/i,/\bgates?\b/i,/\bH9\b/i,/\bLIBERAD[OA]S?\b/,/\bSEGURAS?\b/,/\bsev\s?\d*\b/i,/\bhash/i,/\bcommit/i,/\b[aá]rvores?\b/i,/\bids?\b/i,/\bworktree/i,/\bramos?\b/i,/\bCIM\b/,/\bVPS\b/i,/\b(?:PC|CPU)\s*(?:em\s+)?\d{1,3}\s*%/i,/\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,}\b/i,/(?<![\d:])\b\d{3,}\b(?!\s*%)/];
// Troca na ordem: tag, PC, sigla, jargao, numero de item; o que nao tem palavra de gente sai.
const PLAIN=[
  [/\[[^\]]*\]/g,' '],
  [/\b(?:CPU|PC)\s*(?:em\s+)?(\d{2,3})\b\s*%?(?:\s*(?:de\s+)?CPU\b)?(?:\s+medid[ao]s?\b)?/gi,(match,n)=>Number(n)>=90 ? 'o PC está cheio' : Number(n)>=70 ? 'o PC está quase cheio' : 'o PC está com folga'],
  [/\bRAM\s*\d+(?:[.,]\d+)?\s*%?/gi,' '],
  [/\bguard\w*\s+(?:d[aeo]\s+)?(?:CPU|PC)\b/gi,'cuidado com o PC'],
  [/\b(?:nesta|desta|na|da)\s+guarda\b/gi,' '],
  [/\bguard\w*/gi,'plantão'],
  [/\bETAs?(?:\s+pr[oó]pria)?\b/gi,'previsão'],
  [/\bgates?\s+(?:(?:cheio|full|completo)\s+)?(?:(?:na|da|no|pela)\s+)?VPS\b|\bgates?\s+(?:cheio|full|completo)\b/gi,'teste completo'],
  [/\bgates\b/gi,'testes'],[/\bgate\b/gi,'teste'],
  [/\b(?:na|pela)\s+VPS\b/gi,'no servidor de testes'],[/\bda\s+VPS\b/gi,'do servidor de testes'],[/\bVPS\b/gi,'servidor de testes'],
  [/\bP[1-4]\b/g,'painel'],[/\bCHECAGEM\b/g,'conferência do ar'],[/\b[PH]\d{1,2}\b/g,' '],
  [/\bROOT\b/gi,' '],
  [/\b(\d+)\s+SEGURAS?\b/g,'$1 vetos'],[/\bSEGURAS?\b/g,'veto'],
  [/\bLIBERAD([OA])S?\b/g,(match,g)=>g==='A' ? 'aprovada' : 'aprovado'],[/\bLIBERA[CÇ][AÃ]O\b/g,'aprovação'],
  [/\bPODE SUBIR\b/g,'ok para subir'],[/\bCONFERE\b/g,'ok do revisor'],[/\bPONTO\b/g,'pausa salva'],[/\bSTART\b/g,'início'],
  [/\bsev\s?\d*\b/gi,'ajustes'],
  [/(?:\b\d+\s*)?\bhash\w*/gi,' '],
  [/\bcommits\b/gi,'pacotes'],[/\bcommit\w*/gi,'pacote'],
  [/\b[aá]rvores\b/gi,'versões'],[/\b[aá]rvore\b/gi,'versão'],
  [/\bworktrees?\b/gi,'cópia'],
  [/\bramos\b/gi,'pacotes'],[/\bramo\b/gi,'pacote'],
  [/\bCIM\b/g,'lista de processos'],
  [/\bIDs\b/gi,'números'],[/\bid\b/gi,'número'],
  [/\bdeploy\w*/gi,'subida'],
  [/\b(item|itens|fila|envio|pacote|pedido|pedidos|entrega|limpeza|produtor|autora?|turno)((?:\s+[A-Z][\wÀ-ÿ]*)?)\s+\d{1,3}[A-Za-z]?\b/gi,'$1$2'],
  // PAINEL HOJE: sigla de executor com a porta (PA 3296, PB 3297, PC 3298) nao vai para a tela; "o PC" (computador) fica.
  [/\bP[A-E]\s*\d{4}\b/g,' '],
  [/\br\d{1,2}[A-Z]?\b/g,' '],
  [/(\d+)\/(\d+)/g,(match,a,b)=>Number(a)>31 || Number(b)>12 || a===b ? ' ' : match],
  [/(?<![\d:])\b\d{3,}\b(?!\s*%)/g,' ']
];
const ACCENTS={juncao:'junção',previa:'prévia',previas:'prévias',revisao:'revisão',integracao:'integração',aprovacao:'aprovação',automaticas:'automáticas',automatica:'automática',automatico:'automático',conferencia:'conferência',decisao:'decisão',liberacao:'liberação',manha:'manhã',nao:'não',voce:'você',proximo:'próximo',proxima:'próxima',ultima:'última',ultimo:'último',codigo:'código',botao:'botão',botoes:'botões',publico:'público',publica:'pública',dependencias:'dependências',previsao:'previsão',sessao:'sessão',apos:'após',ate:'até',ja:'já',tambem:'também',numero:'número',video:'vídeo',comeca:'começa',comecou:'começou',pre:'pré'};
function accents(text){return String(text).replace(/[A-Za-z]+/g,word=>{const fixed=ACCENTS[word.toLowerCase()];if(!fixed)return word;if(word.length>1 && word===word.toUpperCase())return fixed.toUpperCase();return word[0]===word[0].toUpperCase() ? fixed[0].toUpperCase()+fixed.slice(1) : fixed;});}
// Filtro de palavras de gente: aplicado ao texto montado de cada linha (o detalhe guarda a fonte tecnica).
function plain(value) {
  let text=unglue(neutral(value));
  for(const [pattern,replacement] of PLAIN)text=text.replace(pattern,replacement);
  text=accents(tidy(text.replace(/\s*\/\s*(?=[\s,;.:)]|$)/g,' ').replace(/(^|[\s(])\/\s*/g,'$1')));
  return text.charAt(0).toUpperCase()+text.slice(1);
}
const fit=(value,limit=MAX)=>short(value,limit);
const brtClock=(date,seconds=false)=>new Date(date.getTime()-3*3600000).toISOString().slice(11,seconds?19:16);
const brtDay=date=>{const iso=new Date(date.getTime()-3*3600000).toISOString();return iso.slice(8,10)+'/'+iso.slice(5,7);};
const minuteOf=(hour,minute)=>Number(hour)*60+Number(minute);
const clockOf=minute=>{const value=((minute%1440)+1440)%1440;return String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');};
function linesOf(text){return String(text||'').split(/\r?\n/);}
function source(file,line,excerpt,note){return {file,line:Number.isInteger(line) ? line : null,excerpt:excerpt ? short(excerpt,220) : null,...(note ? {note} : {})};}
function unknown(key,sources,note){return {key,label:LABELS[key],text:'?',known:false,detail:{sources,note:note||'Sem leitura da fonte'}};}
// Bloco "## PARA O OPERADOR (HH:MM)" do coordenacao: FEZ, RODANDO, ACHOU, PROXIMO, OUTROS.
function operatorOf(text) {
  const lines=linesOf(text),start=lines.findIndex(line=>/^##\s+PARA O OPERADOR\b/i.test(line));
  if(start<0)return null;
  const at=/\((\d{2}:\d{2})\)/.exec(lines[start])?.[1] || null,fields={};
  for(let i=start+1;i<lines.length && !/^##\s/.test(lines[i]);i++){const match=/^\s*-\s*([A-Z]+):\s*(.*)$/.exec(lines[i]);if(match && !PRIVATE.test(match[2]))fields[match[1]]={text:match[2],line:i+1};}
  return {at,line:start+1,fields};
}
// Minuto do dia de "HH:MM" ou "HH:Mx" (x = 0); a primeira hora do trecho.
function anchorMinuteOf(text){const match=/(?<![\d:])([01]?\d|2[0-3]):([0-5])([\dx])(?![\d:])/i.exec(String(text||''));return match ? Number(match[1])*60+Number(match[2])*10+(/x/i.test(match[3]) ? 0 : Number(match[3])) : null;}
// Hora escrita depois de agora (com 5 min de folga) e de ontem: minuto negativo.
function anchored(minute,nowMinute){return minute===null ? null : minute>nowMinute+5 ? minute-1440 : minute;}
// Recados das sessoes ("- 06:0x LOJA: ..." ou "- CORTES 06:55: ..."), o mais novo primeiro.
function recadosOf(text,count=10,now=new Date()) {
  const lines=linesOf(text),start=lines.findIndex(line=>/^##\s+Recados\b/i.test(line));
  if(start<0)return [];
  let end=lines.findIndex((line,index)=>index>start && /^##\s/.test(line));if(end<0)end=lines.length;
  const nowMinute=minuteOf(...brtClock(now).split(':')),out=[];
  for(let i=start+1;i<end;i++){
    if(PRIVATE.test(lines[i]))continue;
    const first=/^\s*-\s*(\d{2}:\d[\dx])\s+([A-Z][A-Z ]{1,20}?)\s*(?:\([^)]*\))?:\s*(.*)$/.exec(lines[i]),second=!first && /^\s*-\s*([A-Z][A-Z ]{1,20}?)\s+(\d{2}:\d[\dx])\b\s*(?:\([^)]*\))?:?\s*(.*)$/.exec(lines[i]);
    if(!first && !second)continue;
    const clock=first ? first[1] : second[2],session=(first ? first[2] : second[1]).trim(),body=first ? first[3] : second[3];
    out.push({text:lines[i].replace(/^\s*-\s*/,''),line:i+1,clock,session,body,anchor:anchored(anchorMinuteOf(clock),nowMinute)});
  }
  return out.sort((a,b)=>b.anchor-a.anchor).slice(0,count);
}
function tailOf(text,count=6){const lines=linesOf(text);const out=[];for(let i=lines.length-1;i>=0 && out.length<count;i--)if(lines[i].trim() && !PRIVATE.test(lines[i]))out.unshift({text:lines[i],line:i+1});return out;}
function datedLineOf(line){
  const first=/^\s*-\s*(\d{2}\/\d{2})\s+(\d{2}:\d{2})\s+([^(\r\n:;]+)/.exec(line||''),second=!first&&/^\s*-\s*(\d{2}:\d{2})\s+(\d{2}\/\d{2})\s+([^(\r\n:;]+)/.exec(line||'');
  if(first)return {day:first[1],hm:first[2],rest:first[3]};
  if(second)return {day:second[2],hm:second[1],rest:second[3]};
  return null;
}
function noArOf(atendimento,now=new Date()) {
  const lines=linesOf(atendimento),start=lines.findIndex(line=>/^##\s+NO AR\b/.test(line));
  if(start<0)return unknown('noar',[source('estado/atendimento.md',null,null,'Bloco NO AR não encontrado')]);
  for(let i=start+1;i<lines.length && !/^##\s/.test(lines[i]);i++){
    const match=datedLineOf(lines[i]);
    if(match && !PRIVATE.test(lines[i]))return {key:'noar',label:LABELS.noar,text:short(plain(sentence(simpleNoAr(match.rest,lines[i]))),40)+' (desde '+(match.day===brtDay(now) ? '' : match.day+' ')+match.hm+')',known:true,detail:{sources:[source('estado/atendimento.md',i+1,lines[i])]}};
  }
  return unknown('noar',[source('estado/atendimento.md',start+1,null,'Bloco NO AR sem linha datada')]);
}
// Previsao antiga (1 faixa): a primeira faixa "HH:MM a HH:MM" ainda por vir; se todas passaram, a ultima com "vencida".
function forecastOf(candidates,now) {
  const nowMinute=minuteOf(...brtClock(now).split(':')),found=[];
  for(const candidate of candidates){
    const text=unglue(neutral(candidate.text));let rest=text,match;
    while((match=RANGE.exec(rest))){
      const before=rest.slice(0,match.index).split(/[,;.:(]/).pop().trim().split(/\s+/).slice(-3).join(' ');
      const end=minuteOf(match[3],match[4]),delta=(end-nowMinute+1440)%1440;
      found.push({from:match[1].padStart(2,'0')+':'+match[2],to:match[3].padStart(2,'0')+':'+match[4],label:tidy(before).replace(/^(?:e|a|o|com|de|da|do|para)\s+/i,''),future:delta<=12*60,candidate});
      rest=rest.slice(match.index+match[0].length);
    }
  }
  return found.find(item=>item.future) || (found.length ? {...found.at(-1),expired:true} : null);
}
// Nome curto da frente pelo assunto. Padrao generico; as frentes do seu projeto vem de config/frentes.json
// ([{"palavra": "relatorio", "nome": "Relatorio"}]); sem assunto conhecido = "".
const FRONT_TOPICS=(()=>{const base=[[/\bpainel\b/i,'Painel'],[/\bhome\b/i,'Home']];try{const v=JSON.parse(require('node:fs').readFileSync(process.env.PAINEL_FRENTES||require('node:path').join(__dirname,'config','frentes.json'),'utf8'));if(!Array.isArray(v))return base;const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return [...v.filter(x=>x&&typeof x.palavra==='string'&&x.palavra.trim()&&typeof x.nome==='string').map(x=>[new RegExp('\\b'+esc(x.palavra.trim())+'\\b','i'),x.nome]),...base];}catch{return base;}})();
const FRONT_KINDS=[[/\bposts?\b/i,'Post'],[/\bv[ií]deos?\b/i,'Vídeo'],[/\barte\b/i,'Arte'],[/\b(?:prints?|fotos?)\b/i,'Fotos']];
const SESSIONS={ATENDIMENTO:'Atendimento',LOJA:'Loja',CORTES:'Cortes',ASSISTENTE:'Assistente',COORDENADOR:'Coordenação',COORDENACAO:'Coordenação',CODEX:'Codex'};
function frontName(text) {
  const head=unglue(String(text||'')).slice(0,110);
  const first=list=>list.map(([pattern,name])=>{const match=pattern.exec(head);return match ? {name,index:match.index} : null;}).filter(Boolean).sort((a,b)=>a.index-b.index)[0]||null;
  const kind=first(FRONT_KINDS),topic=first(FRONT_TOPICS);
  return kind && topic ? kind.name+' '+topic.name : (topic||kind)?.name||'';
}
// Nome da frente de um trecho com hora: o assunto do proprio trecho, a sessao escrita nele, o assunto do registro inteiro.
function nameOf(clause,context,fallback) {
  const text=unglue(String(clause||''));
  if(FRONT_TOPICS.some(([pattern])=>pattern.test(text)))return frontName(text);
  const session=/\b(ATENDIMENTO|LOJA|CORTES|ASSISTENTE|COLECAO)\b/.exec(text)?.[1];
  return (session ? SESSIONS[session]||sentence(session) : '')||frontName(context)||frontName(text)||fallback;
}
// Hora dita num registro escrito no minuto "anchor" (de hoje; negativo = ontem): a primeira vez que o relogio chega nela.
function targetOf(minute,anchor){const base=anchor===null ? 0 : anchor,day=Math.floor(base/1440)*1440;let target=day+minute;if(target<base-60)target+=1440;return target;}
const DROPPED=/retir|cancel|vencid|antig|desist|congela/i;
const DEPENDS=/^\s*(?:\S+\s+){0,2}?(?:após|apos|depois\s+d[eoa]s?)\b/i;
// Previsoes de um trecho: faixa "HH:MM a HH:MM", "~HH:MM" e (fora do modo up) "ETA HH:MM" e "ETA ~N min" contados do registro.
// Faixa retirada e prazo "apos X" (depende de outra coisa) nao viram hora. So vale hora por vir, ate 12 h.
function forecastsIn(text,anchor,nowMinute,{upOnly=false,withPast=false}={}) {
  const plainText=unglue(neutral(text)),out=[];
  const future=target=>target>nowMinute && target-nowMinute<=720;
  // Com withPast (so o proximo up): hora vencida ha ate 3 h volta marcada, para dizer "atrasado".
  const recent=target=>withPast && target<=nowMinute && nowMinute-target<=180;
  const dropped=index=>DROPPED.test(plainText.slice(Math.max(0,index-30),index));
  const ranges=/(?<![\d:])(~\s*)?([01]?\d|2[0-3]):([0-5]\d)\s*(?:a|-|ate|até)\s*([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/gi;
  const taken=[];let match;
  while((match=ranges.exec(plainText))){
    taken.push([match.index,match.index+match[0].length]);
    if(dropped(match.index))continue;
    const start=targetOf(minuteOf(match[2],match[3]),anchor);let end=targetOf(minuteOf(match[4],match[5]),anchor);if(end<start)end+=1440;
    const target=future(start) ? start : future(end) ? end : recent(end) ? end : null;
    if(target!==null)out.push({target,clock:clockOf(target),kind:'faixa',index:match.index,past:!future(target)});
  }
  const inRange=index=>taken.some(([from,to])=>index>=from && index<to);
  const single=upOnly ? /~\s*([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/g : /(?:~\s*|\b(?:ETA|previs[aã]o|estimad[ao]|pronto|até|ate|termina)\s*(?:às|as|~)?\s*)([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/gi;
  while((match=single.exec(plainText))){
    if(inRange(match.index) || dropped(match.index))continue;
    const target=targetOf(minuteOf(match[1],match[2]),anchor);
    if(future(target) || recent(target))out.push({target,clock:clockOf(target),kind:'hora',index:match.index,past:!future(target)});
  }
  if(!upOnly && anchor!==null){
    const relative=/(~\s*)?(\d{1,3})(?:\s*a\s*(\d{1,3}))?\s*min\b/gi;
    while((match=relative.exec(plainText))){
      if(dropped(match.index) || DEPENDS.test(plainText.slice(match.index+match[0].length)))continue;
      if(!match[1] && !/\b(?:ETA|previs|estim|leva|termina|pronto)/i.test(plainText.slice(Math.max(0,match.index-50),match.index)))continue;
      const target=anchor+Number(match[3]||match[2]);
      if(future(target))out.push({target,clock:clockOf(target),kind:'duracao',index:match.index});
    }
  }
  return out.sort((a,b)=>a.index-b.index);
}
const clausesOf=text=>String(text||'').split(/;\s+|\.\s+(?=[A-ZÀ-Ý])|\r?\n/).filter(part=>part.trim());
// Proximo up: a primeira hora "~HH:MM" ou faixa nos blocos PROXIMAS e FILA DE UPS do atendimento.md. Hora vencida (ate 3 h) sem up
// no ar depois dela = "atrasado"; com up no ar depois dela, ja subiu e passa para a proxima.
function upOf(atendimento,nowMinute,today) {
  const lines=linesOf(atendimento),noAr=lines.findIndex(line=>/^##\s+NO AR\b/.test(line));
  let lastUp=-1;
  if(noAr>=0)for(let i=noAr+1;i<lines.length && !/^##\s/.test(lines[i]);i++){const match=datedLineOf(lines[i]);if(match){if(match.day===today)lastUp=minuteOf(...match.hm.split(':'));break;}}
  for(const header of [/^##\s+PR[OÓ]XIMAS\b/i,/^##\s+FILA DE UPS\b/i]){
    const start=lines.findIndex(line=>header.test(line));if(start<0)continue;
    const anchor=anchored(anchorMinuteOf(lines[start]),nowMinute);
    for(let i=start;i<lines.length && (i===start || !/^##\s/.test(lines[i]));i++){
      if(PRIVATE.test(lines[i]))continue;
      for(const found of forecastsIn(lines[i],anchor,nowMinute,{upOnly:true,withPast:true})){
        if(!found.past)return {name:'Próximo up',...found,recency:anchor??0,source:source('estado/atendimento.md',i+1,lines[i],'próximo up '+found.clock+' (estimativa)')};
        if(found.target>lastUp)return {name:'Próximo up',...found,clock:'atrasado',recency:anchor??0,source:source('estado/atendimento.md',i+1,lines[i],'próximo up previsto até '+found.clock+'; nada subiu depois dessa hora')};
      }
    }
  }
  return null;
}
// Ate 3 frentes com hora: o proximo up sempre na frente; depois a hora mais perto. Mesma frente em 2 lugares: vale o registro mais novo.
function frontsOf({atendimento,operator,recados,codexTail,launches,now}) {
  const nowMinute=minuteOf(...brtClock(now).split(':')),candidates=[];
  // PAINEL HOJE: trecho que diz que ja aconteceu nao vira previsao; hora escrita mais de 12 h antes dela (ex.: recado das 07:57 com
  // "sobe ~23:55" da noite anterior) tambem nao. Assim vale o registro mais novo.
  const add=(text,context,anchor,fallback,file,line,raw,note)=>{for(const clause of clausesOf(text)){if(DONE.test(unglue(neutral(clause))))continue;for(const found of forecastsIn(clause,anchor,nowMinute)){if(anchor!==null && found.target-anchor>720)continue;candidates.push({name:nameOf(clause,context,fallback),...found,recency:anchor??-9999,source:source(file,line,raw,note+': '+found.clock+' (estimativa)')});}}};
  if(operator){const anchor=anchored(operator.at ? anchorMinuteOf(operator.at) : null,nowMinute);for(const key of ['RODANDO','OUTROS','PROXIMO']){const field=operator.fields[key];if(field)add(field.text,field.text,anchor,'Coordenação','estado/coordenacao.md',field.line,field.text,'PARA O OPERADOR '+(operator.at||'?'));}}
  for(const recado of recados)add(recado.body,recado.body,recado.anchor,SESSIONS[recado.session.split(' ')[0]]||sentence(recado.session),'estado/coordenacao.md',recado.line,recado.text,'recado '+recado.session+' '+recado.clock);
  for(const entry of codexTail){const anchor=anchored(anchorMinuteOf(entry.text.replace(/^\s*\[[^\]]*\]\s*/,'')),nowMinute);add(entry.text.replace(/^\s*\[[^\]]*\]\s*/,''),entry.text,anchor,'Codex','estado/codex.md',entry.line,entry.text,'codex.md');}
  const today=new Date(now.getTime()-3*3600000).toISOString().slice(0,10);
  for(const item of launches?.items||[]){
    const hour=/^(?:~\s*|at[eé]\s+)?([01]?\d|2[0-3]):([0-5]\d)$/i.exec(String(item.hora||'').trim());
    if(item.dia!==today || !hour || ['no ar','pausado'].includes(item.estado) || PRIVATE.test(item.o_que))continue;
    const target=minuteOf(hour[1],hour[2]);
    if(target>nowMinute)candidates.push({name:frontName(item.o_que)||short(sentence(item.o_que),16),target,clock:clockOf(target),kind:'lancamento',recency:-9999,source:source('estado/lancamentos.json',null,item.o_que,'lançamento '+item.hora)});
  }
  const seen=new Set(),picked=[];
  for(const candidate of candidates.sort((a,b)=>b.recency-a.recency || a.target-b.target)){if(!candidate.name || seen.has(candidate.name))continue;seen.add(candidate.name);picked.push(candidate);}
  picked.sort((a,b)=>a.target-b.target);
  const up=atendimento ? upOf(atendimento,nowMinute,brtDay(now)) : null;
  return {up,others:picked,all:[...(up ? [up] : []),...picked]};
}
function rodandoOf(operator,codexTail,now,{atendimento='',recados=[],launches=null}={}) {
  const running=operator?.fields.RODANDO,lastCodex=codexTail.at(-1);
  const context=[];if(running)context.push(source('estado/coordenacao.md',running.line,running.text,'PARA O OPERADOR '+(operator.at||'?')));if(lastCodex)context.push(source('estado/codex.md',lastCodex.line,lastCodex.text,'fim do codex.md'));
  const {all}=frontsOf({atendimento,operator,recados,codexTail,launches,now});
  const note='Até 3 frentes com hora: o próximo up na frente, depois a hora mais perto. A hora é estimativa escrita no disco; faixa retirada e prazo "após X" não viram hora.';
  if(all.length){
    let text='';const shown=[];
    for(const front of all.slice(0,3)){const part=front.name+' '+front.clock,next=text ? text+' · '+part : part;if(next.length>MAX)break;text=next;shown.push(front);}
    return {key:'rodando',label:LABELS.rodando,text,known:true,detail:{sources:[...all.slice(0,6).map(front=>front.source),...context],note}};
  }
  if(!running && !lastCodex && !atendimento)return unknown('rodando',[source('estado/coordenacao.md',null,null),source('estado/codex.md',null,null),source('estado/atendimento.md',null,null)]);
  // PAINEL HOJE: sem frente com hora, vale o trecho mais novo que diz o que anda: nao "nenhum", nao o que ja acabou,
  // nao trava (isso e a linha Travado por). Fonte com palavra grudada (olhada no texto cru, antes de separar) cai inteira e vale
  // a proxima. Ordem: bloco do operador, depois o fim do codex.md (os dois so de hoje).
  const NEGATIVE=/^\s*(?:nenhum|nenhuma|nada|n[aã]o|sem)\b/i,ENDED=/\b(?:conclu[ií]u|conclu[ií]d[oa]s?|encerrad[oa]s?|terminou|terminad[oa]s?)\b/i;
  const raw=[running?.text,...codexTail.slice().reverse().map(entry=>entry.text.replace(/^\s*\[[^\]]*\]\s*/,''))].filter(Boolean),pool=raw.filter(text=>!gluedOf(text));
  let what='';
  for(const text of pool){for(const clause of clausesOf(tidy(text))){const part=clause.split(/,\s/)[0]||'';if(!part.trim()||NEGATIVE.test(part)||ENDED.test(part)||DONE.test(part)||BLOCKER.test(part))continue;what=short(plain(part),44);if(what)break;}if(what)break;}
  if(!what&&raw.length)context.push(source('estado/coordenacao.md',running?.line??null,null,'As fontes de hoje estão escritas com palavras grudadas; nada foi tirado delas.'));
  return {key:'rodando',label:LABELS.rodando,text:what || '?',known:!!what,detail:{sources:context,note:'Nenhuma frente com hora por vir no disco. '+note}};
}
// Trava em palavras: "Painel: aguarda dependências", "O PC está cheio".
function blockerOf(clause) {
  const text=plain(clause),match=BLOCKER.exec(text);
  if(!match)return text;
  const before=text.slice(0,match.index);
  if(/PC está (?:quase )?cheio/i.test(before))return /quase/i.test(before) ? 'O PC está quase cheio' : 'O PC está cheio';
  const name=frontName(before);
  if(name && /\s(?:e|mas)\s*$/i.test(before))return name+': '+text.slice(match.index);
  return text;
}
function travadoOf(operator,recados,codexTail) {
  const every=[operator?.fields.ACHOU,operator?.fields.RODANDO,operator?.fields.OUTROS,...recados,...codexTail.slice().reverse()].filter(Boolean);
  // PAINEL HOJE: linha com palavra grudada nao vira trava; cai para a proxima fonte. A ignorada fica no detalhe (arquivo:linha).
  const fileOf=candidate=>recados.includes(candidate) || operator && Object.values(operator.fields).includes(candidate) ? 'estado/coordenacao.md' : 'estado/codex.md';
  const skipped=every.filter(candidate=>gluedOf(candidate.text)).slice(0,3).map(candidate=>source(fileOf(candidate),candidate.line,candidate.text,'ignorada: palavra grudada sem espaço'));
  const candidates=every.filter(candidate=>!gluedOf(candidate.text));
  if(!candidates.length)return unknown('travado',[source('estado/coordenacao.md',null,null),source('estado/codex.md',null,null)]);
  for(const candidate of candidates){
    const clauses=unglue(neutral(candidate.text)).split(/[;,]\s+|\.\s+/);
    // PAINEL HOJE: trecho que diz que ja aconteceu ou que a trava passou ("travava", "voltaram a gravar") nao e trava.
    const clause=clauses.find(part=>BLOCKER.test(part) && !RESOLVED.test(part) && !DONE.test(part) && !/\btravava\b|\bvolt(?:ou|aram) a\b|\bfoi resolvid|\bj[aá] (?:anda|roda|grava)|\bnenhum[a]?\b|\bn[aã]o h[aá]\b/i.test(part));
    if(clause){
      const file=recados.includes(candidate) || operator && Object.values(operator.fields).includes(candidate) ? 'estado/coordenacao.md' : 'estado/codex.md';
      return {key:'travado',label:LABELS.travado,text:fit(simpleBlocker(clause)),known:true,detail:{sources:[source(file,candidate.line,candidate.text),...skipped]}};
    }
  }
  return {key:'travado',label:LABELS.travado,text:'Nenhuma trava anotada',known:true,detail:{sources:candidates.slice(0,3).map(candidate=>source('estado/coordenacao.md',candidate.line,candidate.text)),note:'Nenhuma trava nas últimas linhas lidas'}};
}
// Titulo simples do pedido: sem o prefixo de quem pediu ("ORDEM 04:41 DONO, DO LADO DO CLAUDE (...):") e sem a TAG.
function askOf(item) {
  const first=String(item.details||'').split('\n')[0].replace(/\s*\[[^\]]*\]\s*$/,'');
  const plainAsk=first.replace(/^(?:ORDEM\s+)?\d{2}:\d[\dx]\s+[^:]*?(?:DO LADO DO (?:CLAUDE|CODEX)|COORDENADOR[^:]*|DONO[^:]*)(?:\s*\([^)]*\))?:\s*/i,'');
  return sentence(plainAsk!==first ? plainAsk : item.title||first);
}
function queueLineOf(lines,item){const pattern=new RegExp('^'+item.index+(item.suffix||'')+'\\.\\s');const index=lines.findIndex(line=>pattern.test(line));return index<0 ? null : index+1;}
// PC cheio: CPU de 90% para cima escrita no bloco do operador.
function cpuFullOf(operator){return !!operator && Object.values(operator.fields).some(field=>[...unglue(neutral(field.text)).matchAll(/\b(?:CPU|PC)\s*(?:em\s+)?(\d{2,3})\b\s*%?/gi)].some(match=>Number(match[1])>=90 && Number(match[1])<=100));}
function acelerarOf(queueText,operator,now) {
  if(!queueText)return unknown('acelerar',[source('estado/fila-codex.md',null,null)]);
  const items=reader().queueItemsOf(queueText,now),lines=linesOf(queueText);
  // So pedidos de hoje e de ontem: item velho que nunca ganhou marca fica fora da linha curta (e conta no detalhe).
  const today=new Date(now.getTime()-3*3600000).toISOString().slice(0,10),yesterday=new Date(now.getTime()-27*3600000).toISOString().slice(0,10);
  const urgent=items.filter(item=>!['feito','noar','cancelado','superado'].includes(item.status) && /^\s*PRAZO:\s*agora\b/im.test(item.details) && !PRIVATE.test(item.details));
  // Com o PC cheio a resposta e nao (nao cabe mais executor), com quantos esperam.
  const ofToday=urgent.filter(item=>item.day===today),fromYesterday=urgent.filter(item=>item.day===yesterday && item.status==='livre').length,older=urgent.length-ofToday.length;
  const idle=ofToday.filter(item=>item.status==='livre'),busy=ofToday.filter(item=>item.status!=='livre');
  const cpu=cpuFullOf(operator);
  const sources=idle.slice(-5).map(item=>source('estado/fila-codex.md',queueLineOf(lines,item),item.details.split('\n')[0],'sem marca do Codex'));
  const waiting=idle.length===1 ? '1 pedido ao Codex espera' : idle.length+' pedidos ao Codex esperam';
  let text;
  if(cpu)text=idle.length ? 'Não: o PC está cheio · '+waiting : 'Não: o PC está cheio';
  else if(idle.length)text='Sim: '+(idle.length===1 ? '1 pedido ao Codex' : idle.length+' pedidos ao Codex')+' sem resposta hoje';
  else if(busy.length)text=busy.length===1 ? 'Não: o pedido de hoje ao Codex já anda' : 'Não: os '+busy.length+' pedidos de hoje ao Codex já andam';
  else text='Nenhum pedido de hoje ao Codex parado';
  if(cpu)sources.push(source('estado/coordenacao.md',operator.line,'PARA O OPERADOR '+(operator.at||'?')+': CPU de 90% para cima'));
  const example=idle.length ? '; ex.: '+short(askOf(idle.at(-1)),80) : '';
  return {key:'acelerar',label:LABELS.acelerar,text:fit(text),known:true,detail:{sources,note:idle.length+' sem marca e '+busy.length+' andando entre os pedidos de hoje ao Codex com PRAZO: agora'+example+'; ontem: '+fromYesterday+' sem marca; '+older+' de dias anteriores ficam fora da linha curta'}};
}
// "Chat do COORDENADOR: card das travas" -> o que fazer + onde clicar. Sem chat escrito: o painel, em "Esperando você".
function stepOf(what,where,more) {
  const tail=' · '+where+(more ? ' (+'+more+')' : '');
  return fit(plain(what),Math.max(16,MAX-tail.length))+tail;
}
function proximoOf(root,needsText) {
  const L=reader();
  // Usa a mesma lista sanitizada da tela de cards; perigo registra intencao, restricao continua no chat.
  let cards=[];try{cards=require('./pc-cards/cards-nucleo.cjs').montarLista({cardsDir:path.join(root,'estado','cards'),dadosDir:path.join(__dirname,'pc-cards','dados')}).pendentes;}catch{}
  if(cards.length){
    const card=cards[0],where=card.bloqueado ? 'no chat da '+String(card.sessao||'sessão').trim() : 'no painel';
    const what=card.restrito ? 'Assunto restrito' : card.pergunta||'card aberto';
    const note=card.bloqueado ? 'responder no chat da '+(card.sessao||'?') : card.perigoso ? 'registrar intenção no painel; falta o ok no chat' : 'responder no painel';
    return {key:'proximo',label:LABELS.proximo,text:stepOf('Responder: '+what,where,cards.length-1),known:true,detail:{sources:[source('estado/cards/'+card.arquivo,null,card.restrito ? null : card.pergunta,note)]}};
  }
  if(!needsText)return unknown('proximo',[source('tasks/ESCOLHAS.md',null,null)]);
  let needs;try{needs=L.needsOf(needsText);}catch{needs=null;}
  const items=(needs?.items||[]).filter(item=>!PRIVATE.test(item.title||''));
  if(!items.length)return {key:'proximo',label:LABELS.proximo,text:'Nada esperando você',known:true,detail:{sources:[source('tasks/ESCOLHAS.md',null,null,'Sem item aberto')]}};
  const first=items[0],lines=linesOf(needsText),probe=String(first.title||'').slice(0,40),line=lines.findIndex(entry=>probe && entry.includes(probe));
  const title=String(first.title||'').split(/\.\s/)[0].replace(/\.$/,'');
  const chat=/^(.*?)\bchat d[aeo]s?\s+([A-Za-zÀ-ÿ]+(?:\s+d[oa]\s+[A-Z][\wÀ-ÿ]*)?)\s*:\s*(.+)$/i.exec(title);
  const what=chat ? sentence(chat[3]) : title,where=chat ? 'no chat da '+chat[2] : 'em Esperando você';
  return {key:'proximo',label:LABELS.proximo,text:stepOf(what.charAt(0).toUpperCase()+what.slice(1),where,items.length-1),known:true,detail:{sources:[source('tasks/ESCOLHAS.md',line<0 ? null : line+1,first.title)]}};
}
// "Claude X% da janela e Y% da semana · Codex Z%". Leitura de antes do zeramento (ou velha demais) = "?".
function creditoOf(root,sessionsRoot,now) {
  const L=reader(),sources=[];
  const pct=value=>Number.isFinite(value) && value>=0 && value<=100 ? Math.round(value)+'%' : '?';
  const passed=stamp=>{const at=Date.parse(stamp||'');return Number.isFinite(at) && now.getTime()>=at;};
  const raw=L.readSafe(root,'estado/credito-claude.jsonl',512000),rows=linesOf(raw);let claude=null;
  for(let i=rows.length-1;i>=0;i--){if(!rows[i].trim())continue;try{const value=JSON.parse(rows[i]);if(Number.isFinite(value.semana) && value.semana>=0 && value.semana<=100){claude={...value,line:i+1};break;}}catch{}}
  let windowText='?',weekText='?',claudeAt=null;
  if(claude){
    const at=L.timestampOf(claude.hora,now),age=at ? now.getTime()-Date.parse(at) : Infinity;claudeAt=at;
    const windowGone=claude.zeraJanela ? passed(claude.zeraJanela) : age>5*3600000,weekGone=claude.zeraSemana ? passed(claude.zeraSemana) : age>7*86400000;
    windowText=windowGone ? '?' : pct(claude.janela5h);weekText=weekGone ? '?' : pct(claude.semana);
    sources.push(source('estado/credito-claude.jsonl',claude.line,null,'Claude conta '+(claude.conta||'?')+': semana '+claude.semana+'%'+(Number.isFinite(claude.janela5h) ? ', janela de 5 h '+claude.janela5h+'%' : '')+(at ? ', lido '+brtClock(new Date(at)) : '')+(windowGone && Number.isFinite(claude.janela5h) ? '; a janela zerou depois da leitura' : '')+(weekGone ? '; a semana zerou depois da leitura' : '')));
  }
  else sources.push(source('estado/credito-claude.jsonl',null,null,'Sem leitura do Claude'));
  let codex=null;try{codex=sessionsRoot ? L.codexCredit(sessionsRoot) : null;}catch{codex=null;}
  const weekly=(codex?.windows||[]).find(window=>window.minutes>=10000 && Number.isFinite(window.used) && window.used>=0 && window.used<=100 && !(window.reset && passed(window.reset)));
  if(weekly)sources.push(source('leitura nativa do Codex (rate_limits)',null,null,'Codex: semana '+weekly.used+'%'+(codex.updated && Number.isFinite(Date.parse(codex.updated)) ? ', lido '+brtClock(new Date(codex.updated)) : '')));
  else sources.push(source('leitura nativa do Codex (rate_limits)',null,null,'Sem leitura do Codex'));
  const resets=L.codexResetsOf(root,now);if(Number.isInteger(resets.resetsAvailable))sources.push(source('estado/uso-codex-resets.json',null,null,'Resets livres do Codex: '+resets.resetsAvailable+(resets.resetsUpdated ? ' (registro '+brtClock(new Date(resets.resetsUpdated))+' de '+brtDay(new Date(resets.resetsUpdated))+')' : '')));
  // PAINEL HOJE: na linha curta, so a semana (a janela de 5 h fica no detalhe) e a hora da leitura do Claude.
  const text='Claude '+weekText+' da semana'+(claudeAt ? ' às '+brtClock(new Date(claudeAt)) : '')+' · Codex '+(weekly ? pct(weekly.used) : '?');
  return {key:'credito',label:LABELS.credito,text,known:!!(claude || weekly),detail:{sources}};
}
// Ultima passada: filtro de palavras e 1 linha da tela (MAX) em toda linha montada.
function finish(line){return line.text==='?' ? line : {...line,text:fit(plain(line.text))};}
function statusLinesOf(root,sessionsRoot,now=new Date()) {
  const L=reader(),read=file=>L.readSafe(root,file);
  const atendimento=read('estado/atendimento.md'),mega=read('estado/coordenacao.md'),codex=read('estado/codex.md'),queue=read('estado/fila-codex.md'),needs=read('tasks/ESCOLHAS.md');
  // PAINEL HOJE: so o que e de hoje (dia de cada linha pelo git blame do estado; sem git, pela data da tag e pelo relogio) e o
  // vocabulario do proprio disco para achar palavra grudada curta (emjunção, ecard).
  HOJE.setCorpus([atendimento,mega,codex,queue,needs]);
  const days=HOJE.dayInfo(root,now),MEGA='estado/coordenacao.md';
  const operatorAll=mega ? operatorOf(mega) : null,operator=operatorAll&&days.isToday(MEGA,operatorAll.line,operatorAll.at,null) ? operatorAll : null;
  const recados=(mega ? recadosOf(mega,60,now) : []).filter(item=>days.isToday(MEGA,item.line,item.clock,item.text)).slice(0,10);
  const codexTail=(codex ? tailOf(codex) : []).filter(entry=>days.isToday('estado/codex.md',entry.line,entry.text,entry.text));
  let launches=null;try{launches=L.launchesOf(root,now);}catch{launches=null;}
  const lines=[
    atendimento ? noArOf(atendimento,now) : unknown('noar',[source('estado/atendimento.md',null,null)]),
    rodandoOf(operator,codexTail,now,{atendimento,recados,launches}),
    travadoOf(operator,recados,codexTail),
    acelerarOf(queue,operator,now),
    proximoOf(root,needs),
    creditoOf(root,sessionsRoot,now)
  ].map(finish);
  return {readAt:now.toISOString(),readAtBrt:brtClock(now,true),lines};
}
function exampleLines(now=new Date()) {
  return {readAt:now.toISOString(),readAtBrt:brtClock(now,true),example:true,lines:Object.keys(LABELS).map(key=>unknown(key,[],'Exemplo: sem leitura do disco'))};
}
const ASSETS={'/status6.js':['status6.js','text/javascript'],'/status6.css':['status6.css','text/css']};
// Gancho do servidor.cjs (1 linha): GET /api/status-6 e os 2 arquivos da tela. Devolve true quando respondeu.
function handle(req,url,{root,sessionsRoot,example,send,dir}) {
  if(req.method!=='GET')return false;
  if(url.pathname==='/api/status-6'){
    try{send(200,example ? exampleLines() : statusLinesOf(root,sessionsRoot,new Date()));}catch{send(503,{error:'Could not read local state'});}
    return true;
  }
  if(!Object.hasOwn(ASSETS,url.pathname))return false;
  const [file,type]=ASSETS[url.pathname];
  try{
    const base=fs.realpathSync(dir),asset=path.join(dir,file);
    if(fs.lstatSync(asset).isSymbolicLink() || fs.realpathSync(asset)!==path.join(base,file))throw Error('Invalid asset');
    send(200,fs.readFileSync(asset),type);
  }catch{send(503,{error:'Asset unavailable'});}
  return true;
}
module.exports={LABELS,MAX,FORBIDDEN,neutral,unglue,short,plain,frontName,forecastsIn,frontsOf,operatorOf,recadosOf,forecastOf,noArOf,rodandoOf,travadoOf,acelerarOf,proximoOf,creditoOf,statusLinesOf,exampleLines,handle,ASSETS};
