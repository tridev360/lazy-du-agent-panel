'use strict';
const fs=require('node:fs'),path=require('node:path');
const key=value=>typeof value==='string'&&/^[a-f\d]{8}$/.test(value);
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().startsWith(value);
function createSettings(folder,{persist=true}={}){
 const file=path.join(folder,'guidance.json');let value={quietDays:7,projects:{}},error=null,revision=0;
 if(persist)try{if(fs.lstatSync(folder).isSymbolicLink())throw Error('Unsafe folder');const stat=fs.lstatSync(file);if(stat.isSymbolicLink()||stat.size>65536)throw Error('Unsafe preferences');const saved=JSON.parse(fs.readFileSync(file,'utf8'));if(saved.version!==1||!Number.isInteger(saved.quietDays)||saved.quietDays<1||saved.quietDays>365||!saved.projects||Array.isArray(saved.projects)||Object.keys(saved.projects).length>128)throw Error('Invalid preferences');for(const [id,p]of Object.entries(saved.projects))if(!key(id)||!p||!['active','queued','paused','closed'].includes(p.state)||p.resumeAt!==null&&!date(p.resumeAt)||p.queueOrder!==null&&(!Number.isInteger(p.queueOrder)||p.queueOrder<0||p.queueOrder>128))throw Error('Invalid project');value={quietDays:saved.quietDays,projects:saved.projects};}catch(e){if(e.code!=='ENOENT')error='Saved preferences could not be read';}
 function snapshot(){return {quietDays:value.quietDays,projects:structuredClone(value.projects),revision,error};}
 function update(input,allowed){if(error)throw Error('Existing preferences unreadable');if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid preferences');const fields=Object.keys(input),next=structuredClone(value),set=new Set(allowed);
  if(fields.length===1&&fields[0]==='quietDays'){if(!Number.isInteger(input.quietDays)||input.quietDays<1||input.quietDays>365)throw Error('Invalid days');next.quietDays=input.quietDays;}
  else if(fields.every(f=>['projectKey','state','resumeAt'].includes(f))&&fields.includes('projectKey')&&fields.includes('state')){if(!key(input.projectKey)||!set.has(input.projectKey)||!['closed','paused','active'].includes(input.state)||input.state==='paused'&&!date(input.resumeAt)||input.state!=='paused'&&input.resumeAt!==undefined)throw Error('Invalid project change');next.projects[input.projectKey]={state:input.state,resumeAt:input.state==='paused'?input.resumeAt:null,queueOrder:null};}
  else if(fields.length===2&&fields.includes('activeProjects')&&fields.includes('queueOrder')){const active=input.activeProjects,queue=input.queueOrder,eligible=[...set].filter(id=>{const p=next.projects[id];return p?.state!=='closed'&&!(p?.state==='paused'&&p.resumeAt>new Date().toISOString().slice(0,10));});if(!Array.isArray(active)||!Array.isArray(queue)||active.length!==Math.min(3,eligible.length)||active.length===0||active.length+queue.length>128||new Set([...active,...queue]).size!==active.length+queue.length||![...active,...queue].every(id=>key(id)&&eligible.includes(id))||eligible.some(id=>![...active,...queue].includes(id)))throw Error('Invalid priority choice');for(const id of active)next.projects[id]={state:'active',resumeAt:null,queueOrder:null};queue.forEach((id,i)=>next.projects[id]={state:'queued',resumeAt:null,queueOrder:i});}
  else throw Error('Unexpected preference fields');
  if(Object.keys(next.projects).length>128)throw Error('Too many saved project choices');
  if(persist){fs.mkdirSync(folder,{recursive:true});if(fs.lstatSync(folder).isSymbolicLink())throw Error('Unsafe folder');try{if(fs.lstatSync(file).isSymbolicLink())throw Error('Unsafe preferences');}catch(e){if(e.code!=='ENOENT')throw e;}const temp=file+'.'+process.pid+'.tmp';fs.writeFileSync(temp,JSON.stringify({version:1,...next}),{encoding:'utf8',mode:0o600,flag:'wx'});try{fs.renameSync(temp,file);}catch(e){fs.unlinkSync(temp);throw e;}}
  value=next;revision++;return snapshot();
 }
 return {snapshot,update};
}
module.exports={createSettings,date,key};
