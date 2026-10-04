(function(root){
  'use strict';
  const panelStorage=()=>root.PanelStorage?.storage()??((root.location?.search&&new URLSearchParams(root.location.search).get('example')==='1')?null:root.localStorage);
  const roles={dev:['Du Dev','Du Dev'],designer:['Du Designer','Du Designer'],reviewer:['Du Reviewer','Du Revisor'],qa:['Du QA','Du QA'],researcher:['Du Researcher','Du Pesquisador'],writer:['Du Writer','Du Redator'],lead:['Du Lead','Du Coordenador'],creator:['Du Creator','Du Criador']};
  const rules=[['qa',/test|playwright|vitest|pytest|jest|quality assurance|\bqa\b/i],['reviewer',/review|revisor|audit/i],['designer',/design|illustrat|imagegen|view_image|artwork|animat|visual/i],['researcher',/research|pesquisa|web__|search|browse/i],['writer',/writing|redat|documentation|copywriting/i],['lead',/coordinat|planning|maestro/i],['dev',/apply_patch|edit|code|developer|implement|exec_command|functions\.exec/i]];
  const pool=()=>root.DuPortraits||[];
  const assigned=new Map();
  try{const saved=JSON.parse(panelStorage()?.getItem('agent-panel-du-portraits')||'{}');for(const [id,duId]of Object.entries(saved).slice(0,512)){const p=pool().find(p=>p.id===duId);if(p)assigned.set(id,p);}}catch{}
  function hash(text){let h=2166136261;for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
  function role(a){if(roles[a.role])return a.role;const explicit=[a.taskRole,a.roleHint].filter(Boolean).join(' ');const matched=rules.find(([,r])=>r.test(explicit));if(matched)return matched[0];const latest=rules.find(([,r])=>r.test(a.lastTool||''));if(latest)return latest[0];const tools=(a.tools||[]).map(x=>typeof x==='string'?x:x.name).join(' ');return rules.find(([,r])=>r.test(tools))?.[0]||'creator';}
  function assign(list){const portraits=pool(),used=new Set(),result=[];for(const a of list){const old=assigned.get(a.id);if(old&&portraits.some(p=>p.id===old.id)&&!used.has(old.id))used.add(old.id);else assigned.delete(a.id);}
    for(const a of list){let portrait=assigned.get(a.id);if(!portrait){const start=hash(a.id)%Math.max(1,portraits.length);for(let i=0;i<portraits.length;i++){const p=portraits[(start+i)%portraits.length];if(!used.has(p.id)){portrait=p;used.add(p.id);break;}}if(!portrait)portrait=portraits[start];if(portrait)assigned.set(a.id,portrait);}const key=role(a);result.push({...a,taskTitle:a.taskTitle||a.title,taskTitlePT:a.taskTitlePT||a.titlePT,role:key,title:roles[key][0],titlePT:roles[key][1],du:portrait});}try{panelStorage()?.setItem('agent-panel-du-portraits',JSON.stringify(Object.fromEntries([...assigned].slice(-512).map(([id,p])=>[id,p.id]))));}catch{}return result;
  }
  const api={assign,role,hash,roles};root.DuCrew=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
