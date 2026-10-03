'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {parseTask,workspace}=require('./workspace.cjs'),{blocked,safeFile}=require('./usage.cjs');
const stamp=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))?new Date(s).toISOString():null;
function title(text){return String(text||'').replace(/\{[^{}]*\}|\[[^\]]*\]|https?:\/\/\S+|[a-z]:[\\/]\S+|0x[a-f\d]{40}|[`*_#]/gi,' ').replace(/[\u2013\u2014]/g,',').replace(/\s+/g,' ').trim().slice(0,90);}
function decisions(text){
  // Each numbered heading is one pending decision, never a delivery signal.
  return text.split(/(?=^##\s+(?:\d+[.)]|\[))/m).flatMap((block,i)=>{const h=/^##\s+(?:\d+[.)]\s*|\[[^\]]+\]\s*)(.+)$/m.exec(block);if(!h||/respondid|resolvid|conclu[ií]d|\bDONE\b/i.test(h[1]))return[];const name=title(h[1]);if(!name)return[];return[{id:'decision-'+crypto.createHash('sha256').update(name).digest('hex').slice(0,12),title:name,needsOwner:true,source:'task-board',phase:{key:'new',percent:0}}];});
}
class TaskBoard {
  constructor(base,{clock=()=>new Date()}={}){this.base=base;this.clock=clock;this.dir=path.join(base,'.panel-cache');this.file=path.join(this.dir,'task-board.json');this.state={version:1,folder:null,deliveries:{}};try{const x=JSON.parse(fs.readFileSync(this.file,'utf8'));if(x.version===1&&x.deliveries&&typeof x.deliveries==='object'&&!Array.isArray(x.deliveries))this.state=x;}catch{}}
  save(){fs.mkdirSync(this.dir,{recursive:true});const tmp=this.file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(this.state));fs.renameSync(tmp,this.file);}
  connect(folder){if(typeof folder!=='string'||!path.isAbsolute(folder)||blocked(folder))throw Error('Invalid folder');const resolved=path.resolve(folder);if(fs.lstatSync(resolved).isSymbolicLink()||!fs.statSync(resolved).isDirectory())throw Error('Invalid folder');this.state.folder=resolved;this.save();return this.snapshot();}
  snapshot(){
    let result=workspace(this.base),linked=!!this.state.folder||result.configured;const folder=this.state.folder;
    if(folder){try{const tasks=[],names=fs.readdirSync(folder,{withFileTypes:true});for(const entry of names){if(!entry.isFile()||!entry.name.endsWith('.md')||blocked(entry.name))continue;const file=path.join(folder,entry.name);if(!safeFile(folder,file)||fs.statSync(file).size>65536)continue;const text=fs.readFileSync(file,'utf8');if(/^decisions\.md$/i.test(entry.name)){tasks.push(...decisions(text));continue;}const task=parseTask(text,entry.name.slice(0,-3));if(task){const completed=stamp(/^completed_at:\s*["']?([^\r\n"']+)/m.exec(text)?.[1]?.trim());task.completedAt=completed;task.helper=/^helper:\s*true\s*$/m.test(text);task.title=title(task.title);if(!/^(?:owner|dono):[ \t]*\S/m.test(text))task.owner=null;if(!/^executor:[ \t]*(?:claude|codex)[ \t]*$/m.test(text))task.executor=null;if(task.title)tasks.push(task);}}result={tasks,queue:[],configured:true};}catch{result={tasks:[],queue:[],configured:true,error:true};}}
    const connected=linked&&!result.error;
    if(connected){let changed=false;for(const task of result.tasks){if(task.helper||task.phase?.percent!==100||!task.completedAt||!task.title||/^(?:REPORT|RELAT[OÓ]RIO)$/i.test(task.title))continue;const key=crypto.createHash('sha256').update((folder||this.base)+'|'+task.id+'|'+task.completedAt.slice(0,10)).digest('hex');if(!this.state.deliveries[key]){this.state.deliveries[key]={id:key,title:task.title,titlePT:task.titlePT||task.title,completedAt:task.completedAt};changed=true;}}if(changed)this.save();}
    const today=this.clock().toISOString().slice(0,10),delivered=Object.values(this.state.deliveries).filter(x=>x.completedAt?.slice(0,10)===today);
    return {...result,board:{connected,status:result.error?'error':connected?'connected':'disconnected',folderName:folder?path.basename(folder):null},deliveries:{connected,day:today,items:connected?delivered:[],source:'task-board'}};
  }
}
module.exports={TaskBoard,decisions,title};
