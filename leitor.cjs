const fs = require('node:fs');
const path = require('node:path');
const {randomUUID}=require('node:crypto');
const clean = value => String(value ?? '').replace(/0x[a-fA-F0-9]{40}/g, s => `${s.slice(0,6)}…${s.slice(-4)}`).replace(/[\u2013\u2014]/g, ',').slice(0,18000);
const normal = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const PHASES = { nova:0, aberta:10, andando:40, adiada:null, commit:60, revisada:80, liberado:90, feito:100 };
function readSafe(root, relative, limit=2*1024*1024) {
  if (/(^|[\\/])(?:PRIVADO|_SECRETS|backup-privado|seed|\.env)(?:[\\/.]|$)|(?:^|[\\/])[^\\/]*\.env$/i.test(relative)) return '';
  try {
    const file = path.resolve(root,relative), base = fs.realpathSync(root);
    const requested=path.relative(path.resolve(root),file);
    if(requested.startsWith('..') || path.isAbsolute(requested) || fs.lstatSync(root).isSymbolicLink())return '';
    let segment=path.resolve(root);
    for(const part of requested.split(path.sep)){segment=path.join(segment,part);if(fs.lstatSync(segment).isSymbolicLink())return '';}
    const real = fs.realpathSync(file), rel = path.relative(base,real);
    if (rel.startsWith('..') || path.isAbsolute(rel) || /(^|[\\/])(?:PRIVADO|_SECRETS|backup-privado|seed|\.env)(?:[\\/.]|$)|(?:^|[\\/])[^\\/]*\.env$/i.test(rel)) return '';
    const stat=fs.statSync(real);
    if (!stat.isFile() || stat.size > limit) return '';
    return fs.readFileSync(real,'utf8').replace(/^\uFEFF/,'');
  } catch { return ''; }
}
function files(root, relative, extension) {
  try {
    const base=path.resolve(root),dir=path.resolve(root,relative),rel=path.relative(base,dir);
    if(rel.startsWith('..') || path.isAbsolute(rel) || fs.lstatSync(base).isSymbolicLink())return [];
    if(/(?:PRIVADO|_SECRETS|backup-privado|(?:^|[\\/])(?:\.env(?:[./\\]|$)|[^\\/]*\.env$|seed(?:[./\\]|$)))/i.test(rel))return [];
    let current=base;
    for(const part of rel.split(path.sep).filter(Boolean)){
      current=path.join(current,part);
      const entry=fs.lstatSync(current);
      if(entry.isSymbolicLink() || !entry.isDirectory())return [];
    }
    if (!fs.lstatSync(dir).isDirectory()) return [];
    return fs.readdirSync(dir,{withFileTypes:true}).filter(x=>x.isFile() && !x.isSymbolicLink() && x.name.endsWith(extension) && !/^\./.test(x.name)).map(x=>x.name);
  } catch { return []; }
}
function frontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) return {meta:{},body:text};
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([\w_]+):\s*(.*)$/.exec(line);
    if (pair) meta[pair[1]] = pair[2].replace(/^(['"])(.*)\1$/,'$2');
  }
  return {meta,body:text.slice(match[0].length)};
}
function logOf(body) {
  const lines=body.split(/\r?\n/), out=[]; let active=false;
  for (const line of lines) {
    if (/^#{1,2}\s/.test(line)) {
      active=/^##\s+Log(?:\s|\(|$)/i.test(line);
      continue;
    }
    if(active) out.push(line);
  }
  return out.join('\n');
}
function timestampOf(value, now=new Date()) {
  const text=String(value).trim();
  const iso=/^(20\d{2})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(?:\s*(Z|[+-]\d{2}:?\d{2}|BRT|UTC))?(?=$|[\s;|),]|\.(?!\d))/i.exec(text);
  const short=!iso && /^(\d{2})\/(\d{2})(?:\/(20\d{2}))?\s+(\d{2}):(\d{2})(?::(\d{2}))?(?:\s*(Z|[+-]\d{2}:?\d{2}|BRT|UTC))?(?=$|[\s;|),]|\.(?!\d))/i.exec(text);
  if(!iso && !short) return null;
  const match=iso || short;
  if(/^\s*(?:[+-]\d|Z\b|UTC\b|BRT\b|GMT\b|\.\d)/i.test(text.slice(match[0].length))) return null;
  const reference=new Date(now.getTime()-3*3600000);
  let year=iso ? Number(iso[1]) : Number(short[3] || reference.getUTCFullYear());
  const month=Number(iso ? iso[2] : short[2]), day=Number(iso ? iso[3] : short[1]);
  // Yearless Get-Date logs may cross the December/January boundary.
  if(short && !short[3] && reference.getUTCMonth()===0 && month===12) year--;
  const hour=Number(match[4]), minute=Number(match[5]), second=Number(match[6] || 0);
  const millisecond=iso && iso[7] ? Number(iso[7].padEnd(3,'0')) : 0;
  const zone=String(iso ? iso[8] || 'BRT' : short[7] || 'BRT').toUpperCase();
  if(month<1 || month>12 || day<1 || day>31 || hour>23 || minute>59 || second>59) return null;
  const local=Date.UTC(year,month-1,day,hour,minute,second,millisecond), calendar=new Date(local);
  if(calendar.getUTCFullYear()!==year || calendar.getUTCMonth()!==month-1 || calendar.getUTCDate()!==day) return null;
  let offset=-180;
  if(zone==='Z' || zone==='UTC') offset=0;
  else if(zone!=='BRT') {
    const parts=/^([+-])(\d{2}):?(\d{2})$/.exec(zone);
    if(!parts || Number(parts[2])>14 || Number(parts[3])>59 || (Number(parts[2])===14 && Number(parts[3])!==0)) return null;
    offset=(parts[1]==='-'?-1:1)*(Number(parts[2])*60+Number(parts[3]));
  }
  return new Date(local-offset*60000).toISOString();
}
function lastLogOf(body, now=new Date()) {
  let at=null, evidence='';
  for(const line of logOf(body).split(/\r?\n/)) {
    const value=line.trim().replace(/^[-*]\s+/, '');
    const stamp=timestampOf(value,now);
    if(stamp && (!at || stamp>=at)) { at=stamp; evidence=clean(line.trim()); }
  }
  return {lastLogAt:at,lastLogEvidence:evidence};
}
function stalledTasksOf(tasks, now=new Date()) {
  return tasks.filter(work=>/^(aberta|andando|em andamento)$/.test(normal(work.state).trim()) && work.phase.key!=='feito' && work.lastLogAt!==null && now.getTime()-Date.parse(work.lastLogAt)>=72*3600000);
}
function readyBranchesOf(text) {
  const branches=new Map(), headings=[...text.matchAll(/^##\s+(.+)$/gm)];
  for(let i=0; i<headings.length; i++) {
    const block=text.slice(headings[i].index+headings[i][0].length,headings[i+1]?.index ?? text.length);
    const branch=/\bramo(?:\s*:\s*|\s+)([\w][\w./-]*)/i.exec(block)?.[1]?.replace(/[.]+$/,'');
    const commit=/\bcommit\s*[:=]?\s*([a-f0-9]{7,40})(?![a-z0-9])/i.exec(block)?.[1];
    if(!branch || !commit || /^(?:sem|nenhum|nao)$/i.test(branch)) continue;
    const field=pattern=>clean(pattern.exec(block)?.[1]?.trim() || '');
    const item={title:clean(headings[i][1].trim()),task:field(/\btask(?:\s*:\s*|\s+)([^;|\r\n]+)/i),branch:clean(branch),commit:commit.toLowerCase(),tree:field(/\barvore\s*[:=]?\s*([a-f0-9]{7,40})(?![a-z0-9])/i),tests:field(/\btestes\s*:\s*([^|\r\n]+)/i),pending:field(/\bfalta\s*\/\s*claude\s*:\s*([^|\r\n]+)/i)};
    const previous=branches.get(branch);
    if(previous && previous.commit===item.commit) for(const key of ['task','tree','tests','pending']) if(!item[key]) item[key]=previous[key];
    branches.set(branch,item);
  }
  for(const line of text.split(/\r?\n/)){
    const match=/^\s*-\s+([\w.-]+\/[\w./-]+)\s*\|\s*hash\s+([a-f0-9]{7,40})\s*\|\s*arvore\s+([a-f0-9]{7,40}).*\bGATE_PASS\b/i.exec(line);
    if(!match || /\b(?:no ar|feito|subiu|merged)\b/i.test(line))continue;
    branches.set(match[1],{title:clean(match[1]),task:'',branch:match[1],commit:match[2].toLowerCase(),tree:match[3].toLowerCase(),tests:'GATE_PASS',pending:'Revisao do Claude'});
  }
  return [...branches.values()];
}
function taskBranchesOf(tasks, recorded) {
  const branches=new Map(recorded.map(item=>[item.branch,item]));
  for(const work of tasks){
    if(!['commit','revisada','liberado'].includes(work.phase.key))continue;
    const log=work.log || '';
    const branch=[...log.matchAll(/\b(?:ramo|branch)\s*[:=]?\s+([\w][\w./-]*)/gi)].at(-1)?.[1]?.replace(/[.]+$/,'');
    const commit=/\bcommit\s*[:=]?\s*([a-f0-9]{7,40})(?![a-z0-9])/i.exec(work.phase.evidence)?.[1] || [...log.matchAll(/\bcommit\s*[:=]?\s*([a-f0-9]{7,40})(?![a-z0-9])/gi)].at(-1)?.[1];
    if(!branch || !commit || !branch.includes('/') || branches.has(branch))continue;
    const tree=[...log.matchAll(/\b(?:arvore|tree)\s*[:=]?\s*([a-f0-9]{7,40})(?![a-z0-9])/gi)].at(-1)?.[1] || '';
    branches.set(branch,{title:work.title,task:work.id,branch:clean(branch),commit:commit.toLowerCase(),tree,tests:'',pending:'Revisao ou subida'});
  }
  return [...branches.values()];
}
// caia em "Nova" na Fila. Vale o comeco do estado; o log da work continua podendo avancar a fase.
function estadoPrefixo(state) {
  const head = String(state || '').replace(/[-_]+/g, ' ').trim();
  if (/^(?:no ar|feit[oa]|entregue|concluid[oa])\b/.test(head)) return 'feito';
  if (/^liberad[oa]\b/.test(head)) return 'liberado';
  // revisao so vale com arvore conferida no log (regra antiga): "pronta-para-subir" e "em revisao" ficam sem fase aqui
  // e a Fila (painel.js) poe o cartao na coluna Em revisao pelo texto do estado.
  if (/^(?:revisad[oa]|em revisao|revisao|review|pode subir|pront[oa] para (?:subir|card))\b/.test(head)) return null;
  if (/^(?:pront[oa]|commit no ramo|codigo em ramo|no lote)\b/.test(head)) return 'commit';
  if (/^(?:andando|em andamento|em obra|em execucao|fazendo)\b/.test(head)) return 'andando';
  if (/^(?:adiad[oa]|pausad[oa]|parad[oa]|descartad[oa]|fim da fila)\b/.test(head)) return 'adiada';
  if (/^(?:aberta|nova|fila|na fila|planejada|ideia|a estudar|roadmap|desenho)\b/.test(head)) return 'aberta';
  return null;
}
function phaseOf(meta, body) {
  const state = normal(meta.estado || '').trim().replace(/^no[-_]?ar$/,'no ar');
  let phase = ({nova:'nova',aberta:'aberta',andando:'andando','em andamento':'andando',adiada:'adiada',adiado:'adiada',parado:'adiada',parada:'adiada',pausado:'adiada',pausada:'adiada',feito:'feito',feita:'feito','no ar':'feito',liberado:'liberado',liberada:'liberado','commit no ramo':'commit'})[state] || estadoPrefixo(state);
  let evidence = phase ? `estado: ${meta.estado}` : '';
  const log = logOf(body);
  for (const raw of log.split(/\r?\n/).filter(x=>/^\s*-\s/.test(x))) {
    // Pending reviews and future work cannot advance the phase.
    const line = normal(raw).split(/\bfalta\b|\bpendente\b|\bamanha\b/)[0];
    let next = null;
    if (/\b(?:no ar|feito)\b/.test(line) && !/\b(?:antes|depois|quando|para|ao|nao)\s+(?:estar\s+)?(?:no ar|feito)\b/.test(line)) next='feito';
    else if (/\b(?:segura|adiad[oa]|pausad[oa]|parad[oa])\b/.test(line)) next='adiada';
    else if (/\bsem commit\b|\bandando\b/.test(line)) next='andando';
    else if (/\bliberacao\s+[a-f0-9]{8,40}\b|\bliberado\s+(?:tree|arvore)\s*[:=]?\s*[a-f0-9]{8,40}\b/.test(line)) next='liberado';
    else if (/\b(?:confere|pode subir)\b/.test(line) && /\b(?:tree|arvore)\s*[:=]?\s*[a-f0-9]{8,40}\b/.test(line) && !/\b(?:pedir|precisa|aguarda|revisao exigida)\b/.test(line)) next='revisada';
    else if (/\bcommit\s*[:=]?\s*[a-f0-9]{7,40}\b/.test(line)) next='commit';
    // A later pause/review of follow-up work cannot undo a confirmed delivery.
    if (next && (phase!=='feito' || next==='feito')) { phase=next; evidence=clean(raw); }
  }
  return {key:phase,percent:phase ? PHASES[phase] : null,evidence};
}
function section(text, title) {
  const lines=text.split(/\r?\n/), out=[]; let active=false;
  for (const line of lines) {
    if (/^##\s/.test(line)) { if(active) break; active=normal(line).includes(normal(title)); if(active) out.push(line.replace(/^##\s*/,'')); }
    else if(active) out.push(line);
  }
  return clean(out.join('\n').trim());
}
function safeLink(value) {
  try { const u=new URL(String(value)); return u.protocol==='https:' && ['claude.ai','chatgpt.com'].includes(u.hostname) && !u.username && !u.password && !u.search ? u.href : null; } catch { return null; }
}
function answered(card) { return !!(card.respondido || card.resposta || card.respondida || /^(respondido|respondida|feito)$/i.test(card.estado || '')); }
function blocked(card) {
  return card.tipo !== 'decisao' || card.aprovar_no_chat === true || /\b(env|chave|hospedagem|push|deploy|merge|dinheiro|money|saque|withdraw|seed|private key|pagamento|transferencia)\b/i.test(normal([card.pergunta,card.tipo,card.assunto,...(Array.isArray(card.opcoes)?card.opcoes.map(x=>`${x.label} ${x.descricao}`):[])].join(' ')));
}
function cardsOf(root) {
  const cards=[];
  for (const file of files(root,'estado/cards','.json')) {
    try {
      const card=JSON.parse(readSafe(root,`estado/cards/${file}`,64000));
      if (typeof card.id !== 'string' || !/^[\w.-]{1,100}$/.test(card.id) || answered(card)) continue;
      const N=require('./cards300-nucleo.cjs');
      if(!N.paraTela(card)){cards.push({id:N.chaveOpaca(file),sessao:clean(card.sessao || '?'),criado:clean(card.criado),pergunta:'',tipo:card.tipo,exemplo:card.exemplo===true,blocked:true,reservado:true,link:null,taskIds:[],opcoes:[]});continue;}
      const recommendation=Number.isInteger(card.recomendada) ? card.recomendada : Number.isInteger(card.recommended) ? card.recommended : -1;
      cards.push({id:card.id,sessao:clean(card.sessao || '?'),criado:clean(card.criado),pergunta:clean(card.pergunta),tipo:card.tipo,exemplo:card.exemplo===true,blocked:blocked(card),link:safeLink(card.link_sessao),taskIds:taskIdsOf([card.task,card.taskId,...(Array.isArray(card.taskIds)?card.taskIds:[]),card.pergunta,card.assunto].filter(Boolean).join(' ')),opcoes:Array.isArray(card.opcoes) ? card.opcoes.slice(0,8).map((x,index)=>({label:clean(x.label),descricao:clean(x.descricao),originalIndex:index,recommended:x.recomendada===true || x.recommended===true || index===recommendation || /\b(?:recomendad[oa]|recommended)\b/i.test(x.label || '')})) : []});
    } catch {}
  }
  return cards;
}
function limitsOf(raw) {
  const windows=[raw?.primary,raw?.secondary].filter(Boolean).map(x=>({used:x.used_percent ?? x.usedPercent,minutes:x.window_minutes ?? x.windowDurationMins,reset:x.resets_at ?? x.resetsAt})).filter(x=>Number.isFinite(x.used) && x.used>=0 && x.used<=100);
  return windows.map(x=>({...x,reset:Number.isFinite(x.reset) ? new Date(x.reset*1000).toISOString() : null}));
}
const creditFileCache=new Map();
function codexCredit(root) {
  // Only dated rollout names are considered. No auth/config files, messages or tool content are parsed.
  const candidates=[];
  try {
    if(fs.lstatSync(root).isSymbolicLink()) return null;
    for(const year of fs.readdirSync(root).filter(x=>/^20\d{2}$/.test(x)).sort().reverse().slice(0,2)) {
      if(fs.lstatSync(path.join(root,year)).isSymbolicLink()) continue;
      for(const month of fs.readdirSync(path.join(root,year)).filter(x=>/^\d{2}$/.test(x)).sort().reverse()) {
        if(fs.lstatSync(path.join(root,year,month)).isSymbolicLink()) continue;
        for(const day of fs.readdirSync(path.join(root,year,month)).filter(x=>/^\d{2}$/.test(x)).sort().reverse()) {
          const dir=path.join(root,year,month,day);
          if(fs.lstatSync(dir).isSymbolicLink()) continue;
          for(const name of fs.readdirSync(dir).filter(x=>/^rollout-[\wT:.-]+\.jsonl$/.test(x))) {
            const file=path.join(dir,name), stat=fs.lstatSync(file);
            if(stat.isFile() && !stat.isSymbolicLink()) candidates.push({file,mtime:stat.mtimeMs});
          }
          if(candidates.length>=12) break;
        }
        if(candidates.length>=12) break;
      }
      if(candidates.length>=12) break;
    }
  } catch { return null; }
  let latest=null;
  for(const {file,mtime} of candidates.sort((a,b)=>b.mtime-a.mtime).slice(0,12)) {
    if(latest&&mtime<=latest.time)continue;
    let fd;
    try {
      fd=fs.openSync(file,'r');const stat=fs.fstatSync(fd),cached=creditFileCache.get(file);let found=null;
      if(cached&&cached.size===stat.size&&cached.mtime===stat.mtimeMs)found=cached.credit;
      else{
        const append=cached&&stat.size>cached.size;
        if(append)found=cached.credit;
        const read=length=>{const buffer=Buffer.alloc(Math.min(stat.size,length));fs.readSync(fd,buffer,0,buffer.length,stat.size-buffer.length);
          for(const line of buffer.toString('utf8').split('\n')) {
            if(!/"type"\s*:\s*"event_msg"/.test(line)||!/"type"\s*:\s*"token_count"/.test(line)||!/"rate_limits"\s*:/.test(line))continue;
            let record;try{record=JSON.parse(line);}catch{continue;}
            if(record.type!=='event_msg'||record.payload?.type!=='token_count'||!record.payload.rate_limits)continue;
            const windows=limitsOf(record.payload.rate_limits),time=Date.parse(record.timestamp);
            if(windows.length&&Number.isFinite(time)&&(!found||time>found.time))found={time,updated:record.timestamp,windows};
          }
        };
        read(append?Math.min(stat.size-cached.size+8192,2*1024*1024):256*1024);
        if(!found&&!append&&stat.size>256*1024)read(2*1024*1024);
        creditFileCache.set(file,{size:stat.size,mtime:stat.mtimeMs,credit:found});
        if(creditFileCache.size>64)creditFileCache.delete(creditFileCache.keys().next().value);
      }
      if(found&&(!latest||found.time>latest.time))latest=found;
    } catch {} finally {if(fd!==undefined)fs.closeSync(fd);}
  }
  return latest?{updated:latest.updated,windows:latest.windows,source:'rate_limits'}:null;
}

function deadlineOf(text, now=new Date()) {
  const normalized=normal(text), year=now.getFullYear();
  const explicit=/(\d{2})\/(\d{2})(?:\/(20\d{2}))?\s+(\d{2}):(\d{2})\s*(utc|brt)/i.exec(normalized);
  if(explicit) { const date=new Date(`${explicit[3] || year}-${explicit[2]}-${explicit[1]}T${explicit[4]}:${explicit[5]}:00${explicit[6]==='utc'?'Z':'-03:00'}`); return Number.isFinite(date.getTime()) ? date.toISOString() : null; }
  const weekday=/\b(dom|seg|ter|qua|qui|sex|sab)\s+(\d{2}):(\d{2})\s*(brt|utc)/.exec(normalized);
  if(!weekday) return null;
  const base=new Date(now.getTime()+(weekday[4]==='brt'?-3:0)*3600000);
  const delta=([ 'dom','seg','ter','qua','qui','sex','sab' ].indexOf(weekday[1])-base.getUTCDay()+7)%7;
  const date=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth(),base.getUTCDate()+delta));
  return `${date.toISOString().slice(0,10)}T${weekday[2]}:${weekday[3]}:00${weekday[4]==='utc'?'Z':'-03:00'}`;
}
// A familia do executor nao depende de identificadores de conversas fixos.
const ACTORS = {};
function actorOf() { return 'Codex'; }
function taskIdsOf(value) {
  return [...new Set(String(value || '').match(/\b20\d{2}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\b/gi) || [])];
}
function humanTaskId(id) { return String(id).replace(/^20\d{2}-\d{2}-\d{2}-/,'').replace(/^(?:atendimento|assistente|loja|cortes|coordenacao|codex|coordenador)-/i,'').replace(/-/g,' '); }
function shortTitle(value,limit=40) {
  const label=clean(value).replace(/(?:[a-z]:[\\/]|(?:tasks|estado|casa|planos-[^\\/\s]+)[\\/])[^\s,)]+/gi,'').replace(/\x60|\*\*|__/g,'').replace(/\s+/g,' ').trim();
  return label.length>limit ? label.slice(0,limit-1).trimEnd()+'…' : label;
}
function queueTitle(raw,taskIds,index) {
  let text=raw.replace(/\r?\n\s*/g,' ').trim().replace(/^(?:feito|peguei|no ar|em revis[aã]o|revis[aã]o)(?:\s+\d{2}:\d{2})?\s*[,;:]?\s*/i,'').replace(/^ver\s+estado[\\/]\S+\s*/i,'');
  for(let i=0;i<8;i++) {
    text=text.replace(/^[\s.,;]+/,'');
    if(/^PRIORIDADE\b/i.test(text)) {text=text.replace(/^PRIORIDADE\b\s*/i,'');continue;}
    if(!text.startsWith('(')) break;
    let depth=0,end=-1;
    for(let j=0;j<text.length;j++){if(text[j]==='(')depth++;else if(text[j]===')' && --depth===0){end=j;break;}}
    if(end<0) break;
    text=text.slice(end+1);
  }
  const slice=/^(?:tasks[\\/]|mesma task\b|item\b)/i.test(text) ? /\bITEM\s+\d+\s*\(([^)]+)/i.exec(text)?.[1] : null;
  if(slice) text=slice;
  else if(/^(?:tasks[\\/]|20\d{2}-)/i.test(text) && taskIds.length) text=humanTaskId(taskIds[0]);
  else {
    const header=/^(?:(?:ORDEM|IDEIA|PEDIDO)\s+)?\d{1,2}:\d{1,2}x?\s.{0,200}?:\s+(.+)$/i.exec(text);
    if(header)text=header[1].replace(/\s*\[[\w-]{3,}\]\s*$/,'').replace(/^["“]([^"”]{3,})["”]/,'$1');
    text=text.split(/:\s|\.\s/)[0];
  }
  return shortTitle(text || (taskIds[0] ? humanTaskId(taskIds[0]) : 'Item '+index));
}
function queueItemsOf(text,now=new Date()) {
  const blocks=[];let current=null;
  const flush=()=>{if(current)blocks.push(current);current=null;};
  for(const line of text.split(/\r?\n/)) {
    const match=/^(\d+)([a-z]?)\.\s+(.+)/i.exec(line);
    if(match){flush();current={index:Number(match[1]),suffix:match[2].toLowerCase(),lines:[match[3]]};}
    else if(/^FORA\b|^#{1,6}\s/i.test(line))flush();
    else if(current)current.lines.push(line);
  }
  flush();
  return blocks.filter(x=>Number.isSafeInteger(x.index) && x.index>0).map(block=>{
    const details=block.lines.join('\n').trim(),head=normal(block.lines[0]).replace(/^prioridade\b\s*/,'');
    const status=/^no ar\b/.test(head)?'noar':/^feito\b/.test(head)?'feito':/^(?:em revisao|revisao)\b/.test(head)?'revisao':/^pausado\b/.test(head)?'pausado':/^peguei\b/.test(head)?'pegou':'livre';
    const taskIds=taskIdsOf(details),partial=/\bitem\s*\d+\b|\bmesma task\b|\bfatia\b|\bsomente\b|\bultima linha\b/i.test(normal(details));
    const measured=/\b(?:PEGUEI|FEITO|NO AR)\s+(\d{2}:\d{2})(?!\d)/i.exec(block.lines[0]);
    const date=new Date(now.getTime()-3*3600000).toISOString().slice(0,10);
    let lastChangeAt=measured ? timestampOf(date+' '+measured[1]+' BRT',now) : null;
    if(lastChangeAt && Date.parse(lastChangeAt)>now.getTime()+60000)lastChangeAt=new Date(Date.parse(lastChangeAt)-86400000).toISOString();
    const localTitle=({'23':'Lancamentos','26':'Mapa ao vivo','26b':'Agente por IA','26c':'Decisoes','26d':'Gestao','26e':'Feeds','26f':'Equipe ao vivo','26g':'IA Tips','26h':'Detalhes claros','26i':'Projetos','26j':'Agente reais','26k':'Agentes em movimento','27':'Comando'})[block.index+block.suffix];
    const summary=/^\s*RESUMO:\s*(.+)$/mi.exec(details)?.[1];
    const nextStep=/^\s*(?:PROXIMO PASSO|NEXT STEP):\s*(.+)$/mi.exec(details)?.[1];
    const blockedReason=/^\s*(?:TRAVA|ESPERA|BLOCKED):\s*(.+)$/mi.exec(details)?.[1];
    const delivery=require('./cronograma.cjs').timingOf(details,now,'fila');
    return require('./fila-marcas.cjs').withMark(block,now,{id:'queue:'+block.index+block.suffix,index:block.index,suffix:block.suffix,title:localTitle || queueTitle(details,taskIds,block.index+block.suffix),summary:summary ? clean(summary).split(/\s+/).slice(0,15).join(' ') : null,nextStep:nextStep ? clean(nextStep).slice(0,180) : null,blockedReason:blockedReason ? clean(blockedReason).slice(0,180) : null,status,percent:{livre:0,pegou:40,feito:100,revisao:80,noar:100,pausado:null}[status],executor:'codex',actor:actorOf(details),priority:/\bprioridade\b/i.test(block.lines[0]),panelCommand:/sua ordem.*pelo painel/i.test(block.lines[0]),taskIds,partial,details:clean(details),lastChangeAt,delivery});
  }).sort((a,b)=>a.index-b.index || a.suffix.localeCompare(b.suffix));
}
function nextQueueItemsOf(items,limit=5) {return items.filter(x=>x.status==='livre').sort((a,b)=>Number(b.panelCommand)-Number(a.panelCommand)||(a.panelCommand && b.panelCommand ? b.index-a.index : Number(b.priority)-Number(a.priority)||a.index-b.index)).slice(0,limit);}
function weekOf(now=new Date()) {
  const local=new Date(now.getTime()-3*3600000),day=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate());
  const monday=day-((local.getUTCDay()+6)%7)*86400000;
  return {start:new Date(monday).toISOString().slice(0,10),end:new Date(monday+6*86400000).toISOString().slice(0,10)};
}
function calendarDay(year,month,day) {
  const date=new Date(Date.UTC(year,month-1,day));
  return month>=1 && month<=12 && day>=1 && date.getUTCFullYear()===year && date.getUTCMonth()===month-1 && date.getUTCDate()===day ? date.toISOString().slice(0,10) : null;
}
function deadlineDayOf(value,now=new Date()) {
  const text=normal(value).trim();
  if(!text || /^(?:-|none\b|nenhum\b|sem prazo\b)/.test(text))return null;
  const iso=/\b(20\d{2})-(\d{2})-(\d{2})\b/.exec(text),short=!iso && /\b(\d{2})\/(\d{2})(?:\/(20\d{2}))?\b/.exec(text);
  const week=weekOf(now),reference=new Date(now.getTime()-3*3600000);
  if(iso || short) {
    const match=iso || short,month=Number(match[2]),day=Number(iso ? match[3] : match[1]);
    let year=Number(iso ? match[1] : short[3] || reference.getUTCFullYear());
    if(short && !short[3])year=[year-1,year,year+1].find(y=>{const d=calendarDay(y,month,day);return d && d>=week.start && d<=week.end;}) ?? year;
    const date=calendarDay(year,month,day);if(!date)return null;
    // An explicit hour and offset define the BRT calendar day. Date-only remains a day.
    const exact=timestampOf(text.slice(match.index),now);
    return exact ? new Date(Date.parse(exact)-3*3600000).toISOString().slice(0,10) : date;
  }
  const weekday=/\b(seg(?:unda(?:-feira)?)?|ter(?:ca(?:-feira)?)?|qua(?:rta(?:-feira)?)?|qui(?:nta(?:-feira)?)?|sex(?:ta(?:-feira)?)?|sab(?:ado)?|dom(?:ingo)?)\b/.exec(text);
  if(!weekday)return null;
  const index=['seg','ter','qua','qui','sex','sab','dom'].indexOf(weekday[1].slice(0,3));
  return new Date(Date.parse(week.start+'T12:00:00Z')+index*86400000).toISOString().slice(0,10);
}
function pipelineItemsOf(queueItems,tasks,now=new Date()) {
  const week=weekOf(now),covered=new Set(queueItems.filter(x=>!x.partial && x.taskIds.length===1).map(x=>x.taskIds[0]));
  const queued=queueItems.filter(require('./fila-marcas.cjs').counted).map(item=>({...item,source:'queue',owner:'CODEX',needsOwner:tasks.some(work=>item.taskIds.includes(work.id) && work.needsOwner)}));
  const weekly=tasks.filter(work=>work.deadlineDay && work.deadlineDay>=week.start && work.deadlineDay<=week.end && !covered.has(work.id)).map(work=>({id:work.id,index:null,title:work.title,status:({nova:'livre',aberta:'livre',andando:'pegou',adiada:'pausado',commit:'pronto',revisada:'revisao',liberado:'liberado',feito:/\bno ar\b/i.test(work.phase.evidence)?'noar':'feito'})[work.phase.key] || 'unknown',percent:work.phase.percent,executor:work.executor,actor:work.actor,owner:work.owner,source:'task',priority:false,taskIds:[work.id],partial:false,needsOwner:work.needsOwner,deadline:work.deadline,deadlineDay:work.deadlineDay,deadlineAt:work.deadlineAt,details:work.details}));
  return [...queued,...weekly];
}
function progressOf(items) {
  const measured=items.filter(item=>Number.isFinite(item.percent) && item.percent>=0 && item.percent<=100);
  return {percent:measured.length ? Math.round(measured.reduce((sum,item)=>sum+item.percent,0)/measured.length*10)/10 : null,known:measured.length,total:items.length};
}
function needsOf(text) { return require('./decisoes.cjs').needsOf(text); }
function codexResetsOf(root,now=new Date()) {
  try {
    const raw=JSON.parse(readSafe(root,'estado/uso-codex-resets.json',4096)),stamp=timestampOf(raw.updated,now);
    if(!Number.isSafeInteger(raw.available) || raw.available<0 || !stamp)return {resetsAvailable:null,resetsUpdated:null};
    return {resetsAvailable:raw.available,resetsUpdated:stamp};
  }catch{return {resetsAvailable:null,resetsUpdated:null};}
}
const LAUNCH_STATES=['no ar','armado','liberado','em revisao','falta card','em obra','pausado'];
function launchDay(value) {
  const parts=typeof value==='string' && /^(20\d{2})-(\d{2})-(\d{2})$/.exec(value);
  return parts ? calendarDay(Number(parts[1]),Number(parts[2]),Number(parts[3])) : null;
}
function launchDeadline(item) {
  const day=item.ate || item.dia;
  if(!day)return null;
  const exact=/^(?:ate\s+)?([01]\d|2[0-3]):([0-5]\d)$/.exec(normal(item.hora).trim());
  if(exact)return timestampOf(day+'T'+exact[1]+':'+exact[2]+':00-03:00');
  if(normal(item.hora).trim()==='ate o fim do dia')return timestampOf(day+'T23:59:59-03:00');
  return null;
}
function launchesOf(root,now=new Date()) {
  try {
    const raw=JSON.parse(readSafe(root,'estado/lancamentos.json',64000));
    if(!raw || raw.fuso!=='BRT' || !Array.isArray(raw.itens) || raw.itens.length>200)return null;
    const seen=new Set(),today=new Date(now.getTime()-3*3600000).toISOString().slice(0,10);
    // inteira: ele aparece sem data, marcado com o problema, e o resto segue normal. O arquivo nunca e corrigido daqui.
    const items=raw.itens.map((source,index)=>{
      const item=source && typeof source==='object' && !Array.isArray(source) ? source : {},problems=[];
      let id=typeof item.id==='string' && /^[\w.-]{1,100}$/.test(item.id) ? item.id : null;
      if(!id){problems.push('sem id');id='torto-'+(index+1);}
      else if(seen.has(id)){problems.push('id repetido');id=id+'-'+(index+1);}
      seen.add(id);
      const text=key=>{if(typeof item[key]==='string' && item[key].trim())return clean(item[key]);problems.push(key+' vazio');return '?';};
      const hora=text('hora'),o_que=text('o_que'),sessao=text('sessao'),depende=text('depende');
      let estado=typeof item.estado==='string' ? item.estado : '';
      if(!LAUNCH_STATES.includes(estado)){problems.push('estado fora da lista'+(estado?' ("'+clean(estado).slice(0,30)+'")':''));estado=estado ? clean(estado).slice(0,30) : '?';}
      if(typeof item.prazo_duro!=='boolean')problems.push('prazo_duro');
      let dia=item.dia===null || item.dia===undefined ? null : item.dia,ate=item.ate===undefined ? null : item.ate;
      if(dia!==null && !launchDay(dia)){problems.push('dia "'+clean(String(dia)).slice(0,20)+'" fora do formato AAAA-MM-DD');dia=null;}
      if(ate!==null && (!launchDay(ate) || !dia || ate<dia)){problems.push('ate "'+clean(String(ate)).slice(0,20)+'"');ate=null;}
      const launch={id,dia,ate,hora,o_que,sessao,estado,depende,prazo_duro:item.prazo_duro===true};
      if(problems.length)return {...launch,deadlineAt:null,torto:true,problema:problems.join('; ')};
      return {...launch,deadlineAt:launch.prazo_duro ? launchDeadline(launch) : null};
    }).filter(item=>item.torto || !item.dia || (item.ate || item.dia)>=today).sort((a,b)=>(a.dia || '9999').localeCompare(b.dia || '9999'));
    const hard=items.filter(item=>!item.torto && item.prazo_duro && item.estado!=='no ar').sort((a,b)=>(a.ate || a.dia || '9999').localeCompare(b.ate || b.dia || '9999') || (a.deadlineAt || '9999').localeCompare(b.deadlineAt || '9999'));
    const escrita=timestampOf(raw.atualizado,now)||(typeof raw.atualizado==='string'&&Number.isFinite(Date.parse(raw.atualizado))&&Date.parse(raw.atualizado)<=now.getTime()+120000?new Date(Date.parse(raw.atualizado)).toISOString():null);
    const velho=!escrita||now.getTime()-Date.parse(escrita)>24*3600000;
    return require('./frescor.cjs').lancamentosComProjetos({updated:escrita,items,nextHard:hard[0] || null,velho,motivoVelho:velho?'lista antiga'+(escrita?', parada desde '+require('./mastigar.cjs').dataTexto(escrita):'')+'; a lista viva e o LANCAMENTO.md':null},root,now.getTime());
  }catch{return null;}
}
function snapshot(root, sessionsRoot, now=new Date(), options={}) {
  let metadata=null;
  if(options.metadataOnly===true){if(!options.metadataProvider||options.metadataProvider.metadataOnly!==true||typeof options.metadataProvider.snapshot!=='function')throw Error('Metadata provider unavailable');metadata=options.metadataProvider.snapshot(now);}
  const tasks=[];
  for(const file of files(root,'tasks','.md')) {
    const {meta,body}=frontmatter(readSafe(root,`tasks/${file}`));
    if(!/^20\d{2}-\d{2}-\d{2}-/.test(meta.id || '')) continue;
    const heading=/^#\s+(.+)$/m.exec(body)?.[1];
    const deadline=/^(?:-|none|nenhum|sem prazo)?$/i.test((meta.prazo || '').trim()) ? '' : clean(meta.prazo);
    tasks.push({id:clean(meta.id),owner:clean(meta.dono || '?'),executor:normal(meta.executor || 'claude'),state:clean(meta.estado),deadline,deadlineAt:deadlineOf(deadline,now),title:shortTitle(heading && !/^(?:objetivo|objetivos)$/.test(normal(heading).trim()) ? heading : humanTaskId(meta.id)),actor:normal(meta.executor || 'claude')==='codex' ? actorOf(meta.conversa || meta.thread_id || logOf(body)) : clean(meta.dono || 'Claude'),deadlineDay:deadlineDayOf(deadline,now),details:clean(body),phase:phaseOf(meta,body),log:clean(logOf(body)),...lastLogOf(body,now)});
  }
  const states=files(root,'estado','.md').map(file=>{
    const text=readSafe(root,`estado/${file}`), updated=text.split(/\r?\n/).find(x=>/^\s*atualizado\s*:?(?:\s|$)/i.test(x));
    const point=text.split(/\r?\n/).filter(x=>/\bPONTO\b/.test(x)).slice(0,3).join('\n');
    return {id:file.slice(0,-3),updated:clean(updated || ''),updatedAt:updated ? timestampOf(updated.replace(/^\s*atualizado\s*:?\s*/i,''),now) : null,point:clean(point || text.split(/\r?\n/).slice(1,5).join('\n'))};
  });
  const mega=readSafe(root,'estado/coordenacao.md'), decisions=readSafe(root,'DECISIONS.md'), codex=readSafe(root,'estado/codex.md');
  let claude=null; try { const raw=JSON.parse(readSafe(root,'estado/uso-claude.json',16000)); claude={updated:raw.hora,source:clean(raw.fonte),account:clean(raw.conta),windows:[{used:raw.semana_pct,minutes:10080,reset:raw.semana_zera},{used:raw.janela5h_pct,minutes:300,reset:raw.janela5h_zera}].filter(x=>Number.isFinite(x.used) && x.used>=0 && x.used<=100)}; } catch {}
  const queue=readSafe(root,'estado/fila-codex.md'),needsText=readSafe(root,'tasks/ESCOLHAS.md'),cards=cardsOf(root),needs=needsOf(needsText),queueItems=queueItemsOf(queue,now);
  const linked=new Set([...needs.taskIds,...cards.filter(card=>!card.exemplo).flatMap(card=>card.taskIds)]);
  for(const work of tasks)work.needsOwner=linked.has(work.id);
  const pipelineItems=pipelineItemsOf(queueItems,tasks,now),credit=options.metadataOnly===true?metadata.codexCredit:codexCredit(sessionsRoot),resets=codexResetsOf(root,now);
  const deadlines=mega.split(/\r?\n/).filter(x=>/^##\s+(?:PRAZOS DUROS|Mesa semanal)/i.test(x)).join(' ').replace(/^##\s*/,'').split(/[.;]\s+/).filter(Boolean).map(text=>({text:clean(text.replace(/^##\s*/,'')),at:deadlineOf(text,now)}));
  const result={updated:now.toISOString(),launches:launchesOf(root,now),week:weekOf(now),queueItems,pipelineItems,progress:progressOf(pipelineItems),nextItems:nextQueueItemsOf(queueItems),needsItems:needs.items,needsAll:needs.all,needsDeferred:needs.deferred,ownerDecisionSource: true,needsTotal:needs.total,needsCount:needs.total,stalledTasks:stalledTasksOf(tasks,now),readyBranches:taskBranchesOf(tasks,readyBranchesOf(codex)),tasks:tasks.sort((a,b)=>a.owner.localeCompare(b.owner)||a.id.localeCompare(b.id)),states,cards,credits:{claude,codex:{...(credit || {updated:null,windows:[],source:'rate_limits'}),...resets}},deadlines,live:section(mega,'NO AR'),needs:clean(needsText),decisions:[...decisions.matchAll(/^##\s+((20\d{2}-\d{2}-\d{2})[^\r\n]*)$/gm)].filter(x=>timestampOf(x[2]+'T00:00:00Z')).sort((a,b)=>b[2].localeCompare(a[2])).slice(0,5).map(x=>clean(x[1])),codex:clean(codex),queue:clean(queue)};
  require('./fila-marcas.cjs').finishSnapshot(result,now);
  return require('./realtime.cjs').enrichSnapshot(root,sessionsRoot,result,now,{metadataOnly:options.metadataOnly,metadataSnapshot:metadata});
}
function answer(root,id,index,now=new Date()) {
  if(typeof id!=='string' || !/^[\w.-]{1,100}$/.test(id) || !Number.isInteger(index)) throw new Error('Invalid choice');
  const matches=files(root,'estado/cards','.json').filter(file=>{ try { return JSON.parse(readSafe(root,`estado/cards/${file}`,64000)).id===id; } catch { return false; } });
  if(matches.length!==1) throw new Error('Card not found or duplicated');
  const file=path.join(root,'estado/cards',matches[0]), lock=file+'.lock'; let fd;
  try {
    fd=fs.openSync(lock,'wx');
    const card=JSON.parse(readSafe(root,`estado/cards/${matches[0]}`,64000));
    if(answered(card)) throw new Error('Already answered');
    if(blocked(card)) throw new Error('Approve in the session chat');
    if(!Array.isArray(card.opcoes) || index<0 || index>=card.opcoes.length || index>=8) throw new Error('Invalid choice');
    const value=card.opcoes[index]?.label;
    if(typeof value!=='string' || !value.trim()) throw new Error('Invalid choice');
    const label=value.replace(/[\r\n|"\u2013\u2014]/g,' ').trim().slice(0,200);
    const owner=String(card.sessao || '?').replace(/[\r\n|"]/g,' ').slice(0,80), date=new Date(now.getTime()-3*3600000);
    const stamp=`${String(date.getUTCDate()).padStart(2,'0')}/${String(date.getUTCMonth()+1).padStart(2,'0')} ${String(date.getUTCHours()).padStart(2,'0')}:${String(date.getUTCMinutes()).padStart(2,'0')}`;
    const entry=`- ${stamp} | PAINEL | sua escolha: "${label}" | card ${id} da ${owner} | painel`;
    const queue=path.join(root,'FILA-DE-DECISOES.md');
    try{const stat=fs.lstatSync(queue);if(stat.isSymbolicLink() || !stat.isFile())throw new Error('Invalid decision file');}catch(error){if(error.code!=='ENOENT')throw error;}
    const existing=readSafe(root,'FILA-DE-DECISOES.md');
    // A retried write following a disk failure reuses the recorded answer, never creates another choice.
    const previous=existing.split(/\r?\n/).find(line=>line.includes(`| card ${id} da `));
    if(previous && !previous.includes(`sua escolha: "${label}"`)) throw new Error('Choice already recorded');
    if(!card.exemplo && !previous) fs.appendFileSync(queue,`\n${entry}\n`,'utf8');
    const result={...card,respondido:now.toISOString(),resposta:label};
    const temp=file+`.${randomUUID()}.tmp`;
    try{fs.writeFileSync(temp,JSON.stringify(result,null,2)+'\n',{encoding:'utf8',flag:'wx'});fs.renameSync(temp,file);}finally{try{fs.unlinkSync(temp);}catch(error){if(error.code!=='ENOENT')throw error;}}
    return {ok:true,example:card.exemplo===true};
  } finally { if(fd!==undefined) { fs.closeSync(fd); fs.unlinkSync(lock); } }
}
module.exports={files,launchesOf,launchDeadline,LAUNCH_STATES,ACTORS,actorOf,taskIdsOf,shortTitle,queueItemsOf,nextQueueItemsOf,weekOf,deadlineDayOf,pipelineItemsOf,progressOf,needsOf,codexResetsOf,PHASES,frontmatter,logOf,timestampOf,lastLogOf,stalledTasksOf,readyBranchesOf,phaseOf,readSafe,cardsOf,codexCredit,deadlineOf,snapshot,answer,blocked};
