'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {DailyUsage}=require('./daily-usage.cjs');
const digest=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
const VERSION=23;
const fields=['privateProjectRoots','lastInputTokens','contextWindow','metadataComplete','toolTruncated','kind','id','projectId','projectName','model','effort','role','estimateAt','weightedTokens','startedAt','taskStart','lastTool','lastToolAt','taskSubject','taskDurationsMinutes','taskTitle','taskTitlePT','taskAt','taskWords','action','actionPT','activityAt','finishedAt','closedAt','birthAt','sessionKey','parentKey','helper','helperKey','helperDescriptions','sampled'];
function pack(index,file){
  const meta=index.metadata.get(file)||{},metadata={};
  for(const field of fields)if(meta[field]!==undefined)metadata[field]=meta[field];
  metadata.toolCounts={...meta.toolCounts};metadata.completedCount=meta.completed?.size||meta.completedCount||0;
  const entry=index.files.get(file),quota=index.quotas.get(file);
  return{metadata,entry:entry?{kind:entry.kind,id:entry.id,at:entry.at,total:entry.total,messages:entry.messages?[...entry.messages]:null,records:entry.records?[...entry.records]:null}:null,quota:quota||null};
}
function unpack(index,file,value){
  if(!value||!value.metadata||typeof value.metadata!=='object')return false;
  const metadata={};for(const field of fields)if(value.metadata[field]!==undefined)metadata[field]=value.metadata[field];
  metadata.toolCounts=value.metadata.toolCounts||{};metadata.completedCount=value.metadata.completedCount||0;
  index.metadata.set(file,metadata);
  if(value.entry){const e=value.entry;index.files.set(file,{...e,messages:e.messages?new Map(e.messages):null,records:e.records?new Map(e.records):null});}
  if(value.quota)index.quotas.set(file,value.quota);
  return true;
}
class ConversationCache{
  constructor(dir,profile){this.dir=path.join(dir,digest(path.resolve(profile)).slice(0,16));this.loaded=false;this.entries=new Map();this.hits=0;this.misses=0;this.scopeDays=1;this.daily=new DailyUsage();}
  fingerprint(file){return digest(path.resolve(file.file)+'|'+file.size+'|'+file.mtime);}
  async prepare(){if(this.loaded)return;this.loaded=true;try{if((await fs.promises.lstat(this.dir)).isSymbolicLink())return;}catch{return;}
    const read=async name=>{try{const file=path.join(this.dir,name);const stat=await fs.promises.lstat(file);if(stat.isSymbolicLink()||stat.size>16*1024*1024)return null;return JSON.parse(await fs.promises.readFile(file,'utf8'));}catch{return null;}};
    const [saved,preferences,daily]=await Promise.all([read('results.json'),read('preferences.json'),read('daily.json')]);
    if(saved?.version===VERSION&&Array.isArray(saved.entries))this.entries=new Map(saved.entries);
    if([1,3,7].includes(preferences?.scopeDays))this.scopeDays=preferences.scopeDays;
    if(daily?.version===1)this.daily.merge(daily.rows);
  }
  async write(name,value){try{await fs.promises.mkdir(this.dir,{recursive:true});if((await fs.promises.lstat(this.dir)).isSymbolicLink())return;const text=JSON.stringify(value);if(Buffer.byteLength(text)>16*1024*1024)return;const tmp=path.join(this.dir,name+'.'+process.pid+'.tmp');await fs.promises.writeFile(tmp,text,{encoding:'utf8',mode:0o600});await fs.promises.rename(tmp,path.join(this.dir,name));}catch{}}
  async setScopeDays(days){this.scopeDays=days;await this.write('preferences.json',{scopeDays:days});}
  restore(index,file){const entry=this.entries.get(digest(file.file));if(!entry?.partial&&entry?.fingerprint===this.fingerprint(file)&&unpack(index,file.file,entry.value)){this.hits++;return true;}this.misses++;return false;}
  save(index,file,partial=false){this.entries.set(digest(file.file),{fingerprint:this.fingerprint(file),partial,value:pack(index,file.file)});}
  async flush(files){const allowed=new Set(files.map(f=>digest(f.file))),entries=[...this.entries].filter(([id])=>allowed.has(id));this.entries=new Map(entries);await this.write('daily.json',{version:1,rows:this.daily.save()});await this.write('results.json',{version:VERSION,entries});}
}
module.exports={ConversationCache,pack,unpack};
