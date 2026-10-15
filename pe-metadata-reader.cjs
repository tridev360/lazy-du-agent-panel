'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const team=require('./equipe.cjs'),{projectJSON}=require('./project-json.cjs'),lifecycle=require('./pe-lifecycle.cjs');
const APPROVED_FRONTS=Object.freeze({});
function presentationOfPublicRoot(rootId){
 const key=String(rootId||'').toLowerCase(),approved=Object.hasOwn(APPROVED_FRONTS,key)?APPROVED_FRONTS[key]:null;
 return approved?{rootId:key,frontId:approved.frontId,label:approved.label,proofSource:'approved-id'}:null;
}
const UUID=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const CHILD=/^[a-zA-Z0-9_-]{1,80}$/;
const PRIVATE=/sigilos|segred|carteira|wallet|\bseed\b|\.env\b|\bchave\b|senha|password|0x[a-f\d]{6}/i;
const FIELDS=Object.freeze(['type','timestamp','sessionId','parentSessionId','parentAgentId','agentId','cwd',
 'payload.id','payload.cwd','payload.type','payload.phase','payload.status','payload.name','payload.role',
 'payload.task_id','payload.author','payload.recipient','payload.model','payload.effort','payload.reasoning_effort',
 'payload.agent_path','payload.source.subagent.agent_path','payload.source.subagent.thread_spawn.agent_path',
 'payload.source.subagent.parent_thread_id','payload.source.subagent.thread_spawn.parent_thread_id',
 'payload.parent_thread_id','message.model',
 'payload.rate_limits.primary.used_percent','payload.rate_limits.primary.window_minutes','payload.rate_limits.primary.resets_at',
 'payload.rate_limits.secondary.used_percent','payload.rate_limits.secondary.window_minutes','payload.rate_limits.secondary.resets_at']);
const FLOW_FIELDS=Object.freeze(['type','timestamp','payload.type','payload.name','payload.role','payload.author','payload.recipient','payload.id','payload.agent_path','payload.source.subagent.agent_path','payload.source.subagent.thread_spawn.agent_path']);
const CLAUDE_HEADER=['type','timestamp','sessionId','parentSessionId','parentAgentId','agentId','cwd'];
const INDEX=['id','thread_name'],APP=['sessionId','cliSessionId','title','isArchived','lastActivityAt'];
function project(text,fields){const selected=team.projectMetadata(text,{fields,strict:true});if(!selected)throw Error('Invalid projected metadata');return projectJSON(selected,fields);}
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const iso=value=>{const n=typeof value==='string'?Date.parse(value):NaN;return Number.isFinite(n)?new Date(n).toISOString():null;};
const clean=value=>typeof value==='string'&&!PRIVATE.test(value)&&!/[\\/]|\bhttps?:|[\u0000-\u001f]/i.test(value)?value.replace(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g,'[privado]').replace(/[\u2013\u2014]/g,' ').trim().slice(0,120):null;
function rootOK(value,policy){
 if(typeof value!=='string'||!path.isAbsolute(value)||!Array.isArray(policy?.approvedRoots))return false;
 const absolute=path.resolve(value);return policy.approvedRoots.some(root=>typeof root==='string'&&path.isAbsolute(root)&&path.resolve(root)===absolute);
}
function validatePolicy(config){
 const p=config?.policy;
 if(!p||p.metadataOnly!==true||typeof p.id!=='string'||!/^[a-zA-Z0-9_.-]{1,80}$/.test(p.id))throw Error('Metadata policy unavailable');
 for(const name of ['stateRoot','codexRoot','claudeRoot'])if(!rootOK(config[name],p))throw Error('Metadata root unavailable');
 for(const name of ['indexRoot','appRoot'])if(config[name]!=null&&!rootOK(config[name],p))throw Error('Metadata root unavailable');
 if(p.maxBytes!==undefined&&(!Number.isInteger(p.maxBytes)||p.maxBytes<65536))throw Error('Metadata limit unavailable');
 return {...p,approvedRoots:[...p.approvedRoots],maxBytes:Math.min(p.maxBytes||2*1024*1024,2*1024*1024),freshMs:30000};
}
function signature(s){return [s.dev,s.ino,s.size,s.mtimeMs,s.ctimeMs].join(':');}
function safe(root,file){return team.safePath(root,file,new Map());}
function stableBlock(root,file,offset,length){
 const target=safe(root,file);if(!target)throw Error('Metadata path unavailable');
 let fd;
 try{
  const before=fs.lstatSync(target);if(!before.isFile()||before.isSymbolicLink())throw Error('Metadata file unavailable');
  fd=fs.openSync(target,'r');const opened=fs.fstatSync(fd);
  if(signature(before)!==signature(opened))throw Error('Metadata changed');
  const size=Math.max(0,Math.min(length,opened.size-offset)),bytes=Buffer.alloc(size);
  const count=fs.readSync(fd,bytes,0,size,offset),after=fs.fstatSync(fd),current=fs.lstatSync(target);
  if(count!==size||signature(opened)!==signature(after)||signature(after)!==signature(current)||!safe(root,file))throw Error('Metadata changed');
  return {bytes,stat:after};
 }finally{if(fd!==undefined)fs.closeSync(fd);}
}
function firstLine(source){
 const block=stableBlock(source.root,source.file,0,65536),end=block.bytes.indexOf(10);
 if(end<0&&block.stat.size>block.bytes.length)throw Error('Metadata header incomplete');
 const text=block.bytes.subarray(0,end<0?block.bytes.length:end).toString('utf8');
 return {text,stat:block.stat,digest:hash(text)};
}
// Validate JSONL incrementally, retaining only the approved scalar fields.
// Large unselected strings/objects are validated and discarded, never accumulated.
function scalarRecordStream(maxBytes,selectedFields=FIELDS){
 const fields=selectedFields.map(f=>f.split('.'));
 const prefix=p=>fields.some(f=>f.length>=p.length&&p.every((part,i)=>part===f[i]));
 const stringBoundary=/[\u0000-\u001f"\\]/g;
 let frames=[],record={},rootState='value',lex=null,retained=0;
 const invalid=()=>{throw Error('Invalid projected metadata');};
 const charge=n=>{retained+=n;if(retained>maxBytes)throw Error('Metadata record too large');};
 const reset=()=>{frames=[];record={};rootState='value';lex=null;retained=0;};
 function position(){
  const parent=frames.at(-1);
  if(!parent){if(rootState!=='value')invalid();rootState='done';return [];}
  if(parent.kind==='object'){if(parent.state!=='value')invalid();parent.state='comma';return parent.path===null?null:[...parent.path,parent.key];}
  if(!['first','next'].includes(parent.state))invalid();parent.state='comma';return null;
 }
 const selected=p=>p!==null&&fields.some(f=>f.length===p.length&&p.every((part,i)=>part===f[i]));
 function store(p,value){if(selected(p)&&value!==null)record[p.join('.')]=value;}
 function startValue(c){
  const p=position(),keep=selected(p);
  if(c==='{'||c==='['){
   if(frames.length>=64||keep)invalid();
   const tracked=p!==null&&prefix(p);
   frames.push({kind:c==='{'?'object':'array',path:tracked?p:null,state:'first',keys:tracked?new Set():null,key:null});return;
  }
  if(c==='"'){lex={kind:'string',key:false,path:p,keep,raw:keep?'"':'',length:1,escape:0,unicode:0};if(keep)charge(1);return;}
  if(c==='-'||/[0-9]/.test(c)){lex={kind:'number',path:p,keep,raw:keep?c:'',state:c==='-'?'sign':c==='0'?'zero':'integer'};if(keep)charge(1);return;}
  const word=c==='t'?'true':c==='f'?'false':c==='n'?'null':null;
  if(!word)invalid();lex={kind:'literal',path:p,word,index:1};
 }
 function finishNumber(){
  if(!['zero','integer','fraction','exponent'].includes(lex.state))invalid();
  if(lex.keep)store(lex.path,JSON.parse(lex.raw));lex=null;
 }
 function numberChar(c){
  const digit=/[0-9]/.test(c),l=lex;
  if(l.state==='sign'){if(!digit)invalid();l.state=c==='0'?'zero':'integer';}
  else if(l.state==='zero'||l.state==='integer'){
   if(digit){if(l.state==='zero')invalid();}
   else if(c==='.')l.state='dot';else if(c==='e'||c==='E')l.state='exp';else {finishNumber();return false;}
  }else if(l.state==='dot'){if(!digit)invalid();l.state='fraction';}
  else if(l.state==='fraction'){
   if(c==='e'||c==='E')l.state='exp';else if(!digit){finishNumber();return false;}
  }else if(l.state==='exp'){if(c==='+'||c==='-')l.state='exp-sign';else if(digit)l.state='exponent';else invalid();}
  else if(l.state==='exp-sign'){if(!digit)invalid();l.state='exponent';}
  else if(l.state==='exponent'&&!digit){finishNumber();return false;}
  if(l.keep){charge(Buffer.byteLength(c));l.raw+=c;}return true;
 }
 function stringChar(c){
  const l=lex;
  if(c.charCodeAt(0)<32)invalid();
  if(l.keep){charge(Buffer.byteLength(c));l.raw+=c;l.length++;if(l.key&&l.length>200)invalid();}
  if(l.unicode){if(!/[a-f0-9]/i.test(c))invalid();l.unicode--;return;}
  if(l.escape){l.escape=0;if(c==='u')l.unicode=4;else if(!'"\\/bfnrt'.includes(c))invalid();return;}
  if(c==='\\'){l.escape=1;return;}
  if(c!=='"')return;
  if(l.key){const frame=frames.at(-1);if(l.keep){const key=JSON.parse(l.raw);if(frame.keys.has(key))invalid();frame.keys.add(key);frame.key=key;}frame.state='colon';}
  else if(l.keep)store(l.path,JSON.parse(l.raw));
  lex=null;
 }
 function* push(text){
  for(let i=0;i<text.length;i++){
   let c=text[i];
   if(lex){
    // Discarded string spans have no state transitions until a control, quote or escape.
    // UTF8 remains validated by the streaming decoder before this syntax scan.
    if(lex.kind==='string'&&!lex.keep&&!lex.escape&&!lex.unicode){
     stringBoundary.lastIndex=i;const boundary=stringBoundary.exec(text);
     if(!boundary)break;i=boundary.index;c=text[i];
    }
    if(lex.kind==='string'){stringChar(c);continue;}
    if(lex.kind==='number'){if(numberChar(c))continue;}
    else if(lex.kind==='literal'){if(c!==lex.word[lex.index++])invalid();if(lex.index===lex.word.length){store(lex.path,lex.word==='true'?true:lex.word==='false'?false:null);lex=null;}continue;}
   }
   if(c==='\n'){
    if(frames.length||lex)throw Error('Metadata record incomplete');
    if(rootState==='done')yield record;reset();continue;
   }
   if(/[\t\r ]/.test(c))continue;
   const frame=frames.at(-1);
   if(!frame){if(c!=='{'||rootState!=='value')invalid();startValue(c);continue;}
   if(frame.kind==='object'){
    if(frame.state==='first'||frame.state==='next'){
     if(c==='}'&&frame.state==='first'){frames.pop();continue;}
     if(c!=='"')invalid();lex={kind:'string',key:true,keep:frame.path!==null,raw:frame.path!==null?'"':'',length:1,escape:0,unicode:0};if(lex.keep)charge(1);continue;
    }
    if(frame.state==='colon'){if(c!==':')invalid();frame.state='value';continue;}
    if(frame.state==='value'){startValue(c);continue;}
    if(c==='}'){frames.pop();continue;}if(c!==',')invalid();frame.state='next';continue;
   }
   if(frame.state==='first'||frame.state==='next'){
    if(c===']'&&frame.state==='first'){frames.pop();continue;}startValue(c);continue;
   }
   if(c===']'){frames.pop();continue;}if(c!==',')invalid();frame.state='next';
  }
 }
 function* finish(){if(lex?.kind==='number')finishNumber();if(lex||frames.length)throw Error('Metadata record incomplete');if(rootState==='done')yield record;reset();}
 return {push,finish};
}
// Commit the cache only after full validation and stable EOF, including private cwd vetoes.
function *stableLines(source,maxBytes){
 const target=safe(source.root,source.file);if(!target)throw Error('Metadata path unavailable');
 let fd;
 try{
  const before=fs.lstatSync(target);if(!before.isFile()||before.isSymbolicLink()||signature(before)!==signature(source.stat))throw Error('Metadata changed');
  fd=fs.openSync(target,'r');const opened=fs.fstatSync(fd);
  if(signature(before)!==signature(opened))throw Error('Metadata changed');
  const decoder=new TextDecoder('utf-8',{fatal:true}),parser=scalarRecordStream(maxBytes);let offset=0;
  while(offset<opened.size){
   const size=Math.min(65536,maxBytes,opened.size-offset),bytes=Buffer.alloc(size),count=fs.readSync(fd,bytes,0,size,offset);
   if(count!==size)throw Error('Metadata changed');offset+=count;
   yield* parser.push(decoder.decode(bytes,{stream:true}));
  }
  yield* parser.push(decoder.decode());yield* parser.finish();
  const after=fs.fstatSync(fd),current=fs.lstatSync(target);
  if(signature(opened)!==signature(after)||signature(after)!==signature(current)||!safe(source.root,source.file)||firstLine(source).digest!==source.digest)throw Error('Metadata changed');
 }finally{if(fd!==undefined)fs.closeSync(fd);}
}
function claudeHeader(source,head){
 const r=project(head.text,CLAUDE_HEADER),session=r.sessionId,filename=path.basename(source.file);
 if(!UUID.test(session||'')||typeof r.cwd!=='string'||!iso(r.timestamp)||team.sensitiveCwd(r.cwd)||team.sensitiveCwd(source.projectDir))return null;
 if(source.parentSession){
  const child=/^agent-([a-zA-Z0-9_-]+)\.jsonl$/.exec(filename)?.[1];
  if(!child||!CHILD.test(child)||session.toLowerCase()!==source.parentSession.toLowerCase()||r.agentId!==child)return null;
  if(r.parentSessionId&&r.parentSessionId.toLowerCase()!==session.toLowerCase())return null;
  const parent=r.parentAgentId?session.toLowerCase()+':'+r.parentAgentId:session.toLowerCase();
  if(r.parentAgentId&&!CHILD.test(r.parentAgentId))return null;
  return {id:session.toLowerCase()+':'+child,parentId:parent,cwd:r.cwd,record:r};
 }
 const id=filename.slice(0,-6).toLowerCase();
 if(!UUID.test(id)||session.toLowerCase()!==id)return null;
 if(r.parentSessionId&&(!UUID.test(r.parentSessionId)||r.parentSessionId.toLowerCase()===id))return null;
 return {id,parentId:r.parentSessionId?.toLowerCase()||null,cwd:r.cwd,record:r};
}
function motivoDe(e){const m=String(e&&e.message||e||'');if(/changed|incomplete/i.test(m))return 'arquivo mudando durante a leitura (conversa ativa); relido na proxima';if(/too large/i.test(m))return 'linha de metadado acima do teto de 2 MB';if(/event unavailable/i.test(m))return 'evento com hora a frente do relogio';if(/private/i.test(m))return 'pasta reservada (fica de fora de proposito)';if(/Invalid projected/i.test(m))return 'linha que nao e JSON valido';if(/path unavailable|file unavailable/i.test(m))return 'arquivo sumiu ou virou atalho';return 'erro de leitura ('+(/^[A-Z]{3,12}$/.test(String(e&&e.code||''))?e.code:'sem codigo')+')';}
// 1a linha COMPLETA, entre as 40 primeiras do bloco de 64 KB, que tem sessionId, cwd e timestamp; o resumo (digest) segue o da 1a linha.
function claudeUsefulLine(source,head){
 try{const r=project(head.text,CLAUDE_HEADER);if(r.sessionId&&typeof r.cwd==='string'&&r.timestamp)return head;}catch{}
 const block=stableBlock(source.root,source.file,0,65536),lines=block.bytes.toString('utf8').split('\n');
 if(block.stat.size>block.bytes.length)lines.pop();
 for(const text of lines.slice(1,41)){if(!text.trim())continue;let r;try{r=project(text,CLAUDE_HEADER);}catch{continue;}if(r.sessionId&&typeof r.cwd==='string'&&r.timestamp)return {...head,text};}
 return head;
}
function readHeader(source){
 const head=firstLine(source);
 if(source.family==='codex'){
  const native=team.codexHeader(source,new Map());
  if(!native||!native.record.payload.cwd||team.sensitiveCwd(native.record.payload.cwd))return null;
  if(signature(head.stat)!==signature(fs.lstatSync(source.file)))return null;
  return {...source,stat:head.stat,digest:head.digest,id:native.id.toLowerCase(),parentId:native.parentId?.toLowerCase()||null,
   cwd:native.record.payload.cwd,header:project(head.text,FIELDS)};
 }
 const util=claudeUsefulLine(source,head),native=claudeHeader(source,util);return native?{...source,stat:head.stat,digest:head.digest,...native,header:project(util.text,FIELDS)}:null;
}
function createMetadataReader(config={}){
 const policy=validatePolicy(config),reader=new team.TeamReader(config.stateRoot,config.codexRoot,{claudeRoot:config.claudeRoot});
 // Discovery/header recovery only. The broad TeamReader read/snapshot/prefix methods are never invoked.
 const cache=new Map(),invalidated=new Set();let version=0,latest=null;
 function nativeNames(sources){
  const names=new Map(),blocked=new Set(),appByCli=new Map();
  const indexRoot=config.indexRoot;
  if(indexRoot){
   try{
    const file=path.join(indexRoot,'session_index.jsonl'),stat=fs.lstatSync(file);
    if(stat.size>2*1024*1024)throw Error('Index too large');
    const block=stableBlock(indexRoot,file,0,stat.size);
    for(const line of block.bytes.toString('utf8').split('\n')){
     if(!line.trim())continue;let r;try{r=project(line,INDEX);}catch{continue;}
     if(!UUID.test(r.id||''))continue;const id='codex:'+r.id.toLowerCase(),title=clean(r.thread_name);
     if(typeof r.thread_name==='string'&&!title)blocked.add(id);else if(title)names.set(id,title);
    }
   }catch{}
  }
  // Controlled titles are scalar-selected only for already discovered native IDs.
  try{
   const file=path.join(config.stateRoot,'estado','titulos.json'),stat=fs.lstatSync(file);
   if(stat.size>32000)throw Error('Registry too large');
   const paths=sources.filter(s=>s.family==='codex').map(s=>'por_conversa.'+s.id+'.titulo');
   const r=project(stableBlock(config.stateRoot,file,0,stat.size).bytes.toString('utf8'),paths);
   for(const source of sources.filter(s=>s.family==='codex')){
    const title=r['por_conversa.'+source.id+'.titulo'];if(title==null)continue;
    const key='codex:'+source.id,value=clean(title);if(!value)blocked.add(key);else names.set(key,value);
   }
  }catch{}
  if(config.appRoot){
   try{
    const dirs=dir=>{const full=safe(config.appRoot,dir);return full?fs.readdirSync(full,{withFileTypes:true}).filter(x=>x.isDirectory()&&!x.isSymbolicLink()).slice(0,100):[];};
    for(const account of dirs(config.appRoot))for(const org of dirs(path.join(config.appRoot,account.name))){
     const dir=path.join(config.appRoot,account.name,org.name),files=fs.readdirSync(dir,{withFileTypes:true}).slice(0,400);
     for(const item of files){
      if(!item.isFile()||item.isSymbolicLink()||!/^local_[a-f\d-]{36}\.json$/i.test(item.name))continue;
      const file=path.join(dir,item.name),stat=fs.lstatSync(file);if(stat.size>1024*1024)continue;
      let r;try{r=project(stableBlock(config.appRoot,file,0,stat.size).bytes.toString('utf8'),APP);}catch{continue;}
      if(r.sessionId!==item.name.slice(0,-5)||!UUID.test(r.cliSessionId||'')||r.isArchived===true)continue;
      const id='claude:'+r.cliSessionId.toLowerCase(),title=clean(r.title);
      if(typeof r.title==='string'&&!title)blocked.add(id);else if(title){names.set(id,title);const old=appByCli.get(r.cliSessionId.toLowerCase());if(!old||String(old.lastActivityAt||'')<String(r.lastActivityAt||''))appByCli.set(r.cliSessionId.toLowerCase(),{sessionId:r.sessionId,cliSessionId:r.cliSessionId.toLowerCase(),title,isArchived:false,lastActivityAt:iso(r.lastActivityAt)});}
     }
    }
   }catch{}
  }
  return {names,blocked,appByCli};
 }
 function discover(now){
  reader.checked=new Map();const sources=reader.discover(new Date(now)),headers=[];let unavailable=0;
  const motivos=[];for(const source of sources){try{const header=readHeader(source);if(header)headers.push(header);else{unavailable++;motivos.push({familia:source.family,arquivo:path.basename(source.file).slice(-48),motivo:'cabecalho sem sessao, pasta ou hora validas (ou pasta reservada)'});}}catch(e){unavailable++;motivos.push({familia:source.family,arquivo:path.basename(source.file).slice(-48),motivo:motivoDe(e)});}}
  // An old Claude root is recovered only by its exact native filename inside the child's project.
  const seen=new Set(headers.map(s=>s.family+':'+s.id));
  for(let i=0;i<headers.length&&headers.length<320;i++){
   const s=headers[i];if(s.family!=='claude'||!s.parentId||seen.has('claude:'+s.parentId))continue;
   const rootId=s.parentId.split(':')[0],agent=s.parentId.split(':')[1];
   const file=agent?path.join(s.root,s.projectDir,rootId,'subagents','agent-'+agent+'.jsonl'):path.join(s.root,s.projectDir,rootId+'.jsonl');
   try{
    const source={root:s.root,file,family:'claude',projectDir:s.projectDir,parentSession:agent?rootId:null,metadataOnly:true};
    const h=readHeader(source);if(h){headers.push(h);seen.add('claude:'+h.id);}
   }catch{}
  }
  return {headers,unavailable,motivos};
 }
 function projectFile(source,now,liveClock=false){
  // Discovery can precede projection by many files. Refresh only the same opening,
  // then validate the entire current file; never relabel an old cached prefix as fresh.
  const current=safe(source.root,source.file);if(!current)throw Error('Metadata path unavailable');
  if(signature(fs.lstatSync(current))!==signature(source.stat)){
   const fresh=readHeader(source);
   if(!fresh||fresh.id!==source.id||fresh.parentId!==source.parentId||fresh.cwd!==source.cwd||fresh.digest!==source.digest)throw Error('Metadata changed');
   source=fresh;
  }
  const key=source.file,previous=cache.get(key),stamp=signature(source.stat);
  if(previous&&previous.stamp===stamp&&previous.digest===source.digest)return {...previous,observedAt:new Date(now).toISOString()};
  // Completeness is required for privacy, including recovered ancestors.
  // Reproject the entire stable file; maxBytes bounds retained scalars/keys, not discarded bodies.
  let state=lifecycle.blank(source.family),records=[source.header],model=null,effort=null,tools=new Map(),lastAt=iso(source.header.timestamp),credit=null;
  const incomplete=false,offset=source.stat.size;
  for(const r of stableLines(source,policy.maxBytes)){
   if(team.sensitiveCwd(r.cwd)||team.sensitiveCwd(r['payload.cwd']))throw Error('Metadata became private');
   const at=iso(r.timestamp);if(!at){state=lifecycle.consume(state,{type:r.type,payload:{type:r['payload.type'],phase:r['payload.phase'],name:r['payload.name'],task_id:r['payload.task_id']}},source.family);continue;}
   if(iso(source.header.timestamp)&&at<iso(source.header.timestamp))continue;
   if(r.type==='session_meta'&&r['payload.id']&&r['payload.id'].toLowerCase()!==source.id)continue;
   // A live scan may outlast discovery. Its newly appended records must be no
   // later than the measured wall clock; fixed-time fixture snapshots stay fixed.
   if(Date.parse(at)>(liveClock?Date.now():now))throw Error('Metadata event unavailable');
   // Recovered ancestry was found from its header, but this full stable projection
   // verifies its scalar lifecycle and messages under the same privacy policy.
   const nested={type:r.type,timestamp:at,payload:{type:r['payload.type'],phase:r['payload.phase'],name:r['payload.name'],task_id:r['payload.task_id']}};
   state=lifecycle.consume(state,nested,source.family);
   if(!lastAt||at>lastAt)lastAt=at;
   model=clean(r['payload.model']||r['message.model'])||model;effort=clean(r['payload.effort']||r['payload.reasoning_effort'])||effort;
   const name=clean(r['payload.name']);if(name)tools.set(name,(tools.get(name)||0)+1);
   if(r.type==='event_msg'&&r['payload.type']==='token_count'){
    const windows=[];for(const family of ['primary','secondary']){
     const used=r['payload.rate_limits.'+family+'.used_percent'],minutes=r['payload.rate_limits.'+family+'.window_minutes'],reset=r['payload.rate_limits.'+family+'.resets_at'];
     if(Number.isFinite(used)&&used>=0&&used<=100&&Number.isFinite(minutes)&&minutes>0)windows.push({used,minutes,reset:Number.isFinite(reset)?reset:null});
    }
    if(windows.length)credit={updated:at,windows,source:'rate_limits'};
   }
   records.push(r);
   if(records.length>8192)records=[source.header,...records.slice(-4095)];
  }
  const result={stat:source.stat,stamp,digest:source.digest,offset,lifecycle:state,records:records.length>4096?[source.header,...records.slice(-4095)]:records,model,effort,tools,lastAt,credit,incomplete,observedAt:new Date(now).toISOString()};
  cache.set(key,result);return result;
 }
 function snapshot(nowValue=new Date()){
  const now=nowValue instanceof Date?nowValue.getTime():nowValue;if(!Number.isFinite(now))throw Error('Metadata clock unavailable');
  const started=Date.now(),liveClock=Math.abs(started-now)<1000;
  for(const root of [config.stateRoot,config.codexRoot,config.claudeRoot]){const base=safe(root,root);if(!base||!fs.lstatSync(base).isDirectory())throw Error('Metadata root unavailable');}
  const discovered=discover(now),sources=discovered.headers,{names,blocked,appByCli}=nativeNames(sources),byKey=new Map(sources.map(s=>[s.family+':'+s.id,s]));
  const publicRoot=s=>{
   const seen=new Set();let current=s;
   while(current){
    const key=current.family+':'+current.id;if(seen.has(key)||seen.size>16||blocked.has(key)||!current.cwd||team.sensitiveCwd(current.cwd))return null;
    seen.add(key);if(!current.parentId)return current;current=byKey.get(current.family+':'+current.parentId);
   }return null;
  };
  const depth=s=>{let n=0,current=s;while(current.parentId&&n<17){n++;current=byKey.get(current.family+':'+current.parentId);}return n;};
  const accepted=sources.filter(s=>publicRoot(s)).sort((a,b)=>depth(a)-depth(b)),acceptedFiles=new Set(accepted.map(s=>s.file));
  for(const file of cache.keys())if(!acceptedFiles.has(file))cache.delete(file);
  for(const file of invalidated)if(!acceptedFiles.has(file))invalidated.delete(file);
  const agents=[],projected=[],failed=new Set(),motivos=[...(discovered.motivos||[])];let codexCredit=null;
  const configProjects=team.projectConfig(config.stateRoot);
  for(const source of accepted){
   const root=publicRoot(source),key=source.family+':'+source.id;
   let ancestor=source;let rejected=false;while(ancestor.parentId){ancestor=byKey.get(ancestor.family+':'+ancestor.parentId);if(failed.has(ancestor.family+':'+ancestor.id)){rejected=true;break;}}
   if(rejected){cache.delete(source.file);invalidated.add(source.file);failed.add(key);motivos.push({familia:source.family,arquivo:path.basename(source.file).slice(-48),motivo:'conversa mae sem leitura'});continue;}
   let entry;try{entry=projectFile(source,now,liveClock);invalidated.delete(source.file);}catch(e){cache.delete(source.file);invalidated.add(source.file);failed.add(key);motivos.push({familia:source.family,arquivo:path.basename(source.file).slice(-48),motivo:motivoDe(e)});continue;}
   const proof=lifecycle.proof(entry.lifecycle,{observedAt:entry.observedAt,now,verified:true,scanning:!!entry.incomplete});
   const project=team.projectOf(source.cwd,configProjects),title=names.get(source.family+':'+root.id)||null;
   const name=source.parentId?'Ajudante':source.family==='codex'?'Codex':'Claude';
   agents.push({id:key,parentId:source.parentId?source.family+':'+source.parentId:null,
    conversationId:source.family+':'+root.id,conversationName:title,conversation:title||name,family:source.family,name,role:name,
    projectId:project.id,project:clean(project.name)||'Projeto local',projectColor:project.color,model:entry.model,effort:entry.effort,
    state:proof.state,lastAt:entry.lastAt,eventLastAt:entry.lastAt,startedAt:proof.startedAt,lastActionAt:entry.lastAt,
    lastAction:proof.state==='working'?'Trabalho aberto':proof.state==='waiting'?'Espera registrada':proof.state==='done'?'Passo encerrado':'Sem leitura comprovada',
    workProof:proof,observedAt:proof.observedAt,observedSource:proof.source,source:'scalar-metadata',
    tools:[...entry.tools].map(([name,count])=>({name,count,label:name})),skills:[]});
   projected.push({id:source.id,family:source.family,records:entry.records.map(record=>Object.fromEntries(FLOW_FIELDS.filter(field=>Object.hasOwn(record,field)).map(field=>[field,record[field]])))});
   if(entry.credit&&(!codexCredit||entry.credit.updated>codexCredit.updated))codexCredit=entry.credit;
  }
  // A failed ancestor vetoes descendants, including snapshots produced before its failure.
  const good=agents.filter(a=>{let current=a;const seen=new Set();while(current){if(failed.has(current.id)||seen.has(current.id))return false;seen.add(current.id);if(!current.parentId)return true;current=agents.find(p=>p.id===current.parentId);}return false;});
  const observedNow=liveClock?Date.now():now,observedAt=new Date(observedNow).toISOString();
  for(const agent of good){const source=byKey.get(agent.id),entry=source&&cache.get(source.file);if(!entry)throw Error('Metadata observation unavailable');agent.workProof=lifecycle.proof(entry.lifecycle,{observedAt,now:observedNow,verified:true,scanning:false});agent.observedAt=observedAt;agent.state=agent.workProof.state;}
  // Presentation is assigned only after the existing public-chain and source vetoes.
  for(const agent of good)agent.presentation=presentationOfPublicRoot(agent.conversationId);
  const keys=new Set(good.map(a=>a.id));
  const publicApps=new Map([...appByCli].filter(([id])=>keys.has('claude:'+id)));
  const appSessions={byCli:publicApps,bySession:new Map([...publicApps.values()].map(a=>[a.sessionId,a])),available:!!config.appRoot};
  const commandSessions=good.filter(a=>!a.parentId&&(a.family==='codex'||publicApps.has(a.id.slice(7)))).map(a=>{const bare=a.id.slice(a.family.length+1),app=publicApps.get(bare);return {family:a.family,threadId:a.family==='claude'?app.sessionId:bare,sessionId:app?.sessionId,name:a.conversationName||a.name,lastAt:a.lastAt,presentation:a.presentation};});
  const projects=[...new Map(good.map(a=>[a.projectId,{id:a.projectId,name:a.project,color:a.projectColor}])).values()].map(p=>{
   const group=good.filter(a=>a.projectId===p.id);return {...p,agents:group.length,active:group.filter(a=>a.state==='working').length,lastAt:group.map(a=>a.lastAt).filter(Boolean).sort().at(-1)||null};
  });
  const unread=failed.size+discovered.unavailable,complete=unread===0&&invalidated.size===0;
  const coverage={read:good.length,unread,unknown:good.filter(a=>a.state==='unknown').length,finished:true,durationMs:Date.now()-started,motivos:motivos.slice(0,40)};
  latest={updated:observedAt,readerStatus:complete?'ready':'partial',
   proof:{mode:'scalar-metadata',policyId:policy.id,revision:version+1,observedAt,complete,coverage},
   equipe:{agents:good,projects,total:good.length,active:good.filter(a=>a.state==='working').length,scanning:false,countsExact:complete&&coverage.unknown===0,coverage,source:'scalar-metadata'},
   commandSessions,appSessions,metadataRecords:projected.filter(p=>keys.has(p.family+':'+p.id)).map(p=>({...p,presentation:good.find(a=>a.id===p.family+':'+p.id)?.presentation||null})),codexCredit};
  version++;return latest;
 }
 return {snapshot,current:()=>latest,version:()=>version,policyId:policy.id,metadataOnly:true,config:{stateRoot:config.stateRoot,codexRoot:config.codexRoot,claudeRoot:config.claudeRoot,indexRoot:config.indexRoot,appRoot:config.appRoot,policy},close(){cache.clear();invalidated.clear();latest=null;}};
}
module.exports={createMetadataReader,validatePolicy,FIELDS,stableBlock,stableLines,scalarRecordStream,claudeHeader};
