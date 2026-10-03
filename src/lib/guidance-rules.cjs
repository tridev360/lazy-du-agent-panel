'use strict';
const fs=require('node:fs'),path=require('node:path');
const {blocked}=require('./usage.cjs');
const restricted=folder=>blocked(folder);
async function marker(file){try{const parent=await fs.promises.lstat(path.dirname(file));if(parent.isSymbolicLink())return {enabled:null,at:null};const stat=await fs.promises.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>262144)return {enabled:null,at:null};const text=await fs.promises.readFile(file,'utf8');return {enabled:/^## Lazy Du Agent Panel/m.test(text),at:stat.mtimeMs};}catch(e){return {enabled:e.code==='ENOENT'?false:null,at:null};}}
function createRules(profile,metrics){let cache=null,last=0,rootMap=new Map(),ruleCache=null,ruleReadAt=0;
 async function snapshot(usage,board,connectedFolder=null){if(cache&&Date.now()-last<180000&&cache.usage===usage&&cache.board===board&&cache.connectedFolder===connectedFolder)return cache.value;
  const roots=new Map();for(const meta of metrics.index?.metadata?.values?.()||[])for(const entry of meta.privateProjectRoots||[])if(entry&&/^[a-f\d]{8}$/.test(entry.key)&&typeof entry.folder==='string'&&!restricted(entry.folder))roots.set(entry.key,entry);
  rootMap=roots;const rootKeys=[...roots.keys()].sort().join('|');if(!ruleCache||Date.now()-ruleReadAt>=180000||ruleCache.rootKeys!==rootKeys){const globals=await Promise.all([marker(path.join(profile,'.claude','CLAUDE.md')),marker(path.join(profile,'.codex','AGENTS.md'))]);
  const enabled=globals.some(g=>g.enabled===true)?true:globals.some(g=>g.enabled===null)?null:false,ruleAt=Math.min(...globals.filter(g=>g.enabled===true).map(g=>g.at).filter(Number.isFinite),Infinity),projects=[];
  for(const [key,entry]of [...roots].slice(0,32)){const own=[];projects.push({key,rulesEnabled:enabled});}ruleCache={rootKeys,enabled,ruleAt,projects};ruleReadAt=Date.now();}
  const {enabled,ruleAt,projects}=ruleCache;
  const session=(usage.sessions||[]).filter(s=>s.startedAt&&Date.parse(s.startedAt)>ruleAt&&roots.has(s.projectId)).sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt))[0],project=session?roots.get(session.projectId):null;
  const choices=[];for(const entry of [...roots.values()].slice(0,32)){let taskFolderExists=false;try{const stat=await fs.promises.lstat(path.join(entry.folder,'tasks'));taskFolderExists=stat.isDirectory()&&!stat.isSymbolicLink();}catch{}choices.push({key:entry.key,name:entry.name,taskFolderExists});}
  let exists=false;if(project)try{const stat=await fs.promises.lstat(path.join(project.folder,'tasks'));exists=stat.isDirectory()&&!stat.isSymbolicLink();}catch{}
  const connected=board?.board?.connected===true,matching=connected&&project&&connectedFolder&&path.resolve(connectedFolder)===path.join(path.resolve(project.folder),'tasks'),steps={running:true,rules:enabled,newSession:enabled===true&&!!session,task:!!matching&&(board.tasks||[]).some(t=>t.phase&&!String(t.id||'').startsWith('decision-')),decision:!!matching&&(board.firstSteps?.decision===true||(board.tasks||[]).some(t=>t.needsOwner===true&&String(t.id||'').startsWith('decision-')))};
  const value={projects,onboarding:{steps,projects:choices,projectKey:project?.key||null,projectName:project?.name||null,taskFolderExists:exists,connected,canReplaceConnectedFolder:connected,rulesObservedAt:Number.isFinite(ruleAt)?new Date(ruleAt).toISOString():null}};
  cache={usage,board,connectedFolder,value};last=Date.now();return value;
 }
 function resolveTaskFolder(projectKey){const root=rootMap.get(projectKey);if(!root||restricted(root.folder))throw Error('Project not observed');const folder=path.join(root.folder,'tasks'),stat=fs.lstatSync(folder);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Tasks folder not available');return folder;}
 return {snapshot,resolveTaskFolder,invalidate(){cache=null;}};
}
module.exports={createRules,marker};
