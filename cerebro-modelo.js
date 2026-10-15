(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CerebroModelo=api;})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 const regions=['Coordenacao','Memoria','Regras','Sessoes','Ferramentas'];
 const names={Coordenacao:'Coordenação',Memoria:'Memória',Regras:'Regras',Sessoes:'Sessões',Ferramentas:'Ferramentas'};
 const colors={user:'#ff5d98',feedback:'#c3a1ff',project:'#69aeff',reference:'#ffbd79',regra:'#7cdeab'};
 const types={user:'Ordens',feedback:'Lições',project:'Projetos',reference:'Referências',regra:'Regras'};
 const region=n=>regions.includes(n.region)?n.region:({ordem:'Coordenacao',metodo:n.tipo==='project'?'Ferramentas':'Memoria',dominio:'Sessoes',casa:'Regras'}[n.grupo]||'Memoria');
 const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 function filter(nodes,query,type){const q=fold(query).trim();return nodes.filter(n=>(!type||n.tipo===type)&&(!q||fold([n.title,n.desc,n.grupo,n.arquivo].join(' ')).includes(q)));}
 function neighbors(id,edges,nodes){const ids=new Set();for(const e of edges){if(e.de===id)ids.add(e.para);if(e.para===id)ids.add(e.de);}return nodes.filter(n=>ids.has(n.id));}
 function layout(nodes,edges,mobile=false){
 const anchors=mobile?{Coordenacao:[-.22,-.32],Ferramentas:[.25,-.32],Memoria:[-.26,.01],Regras:[.26,.01],Sessoes:[0,.35]}:{Coordenacao:[-.27,-.28],Ferramentas:[.30,-.29],Memoria:[-.34,.19],Regras:[.32,.17],Sessoes:[.02,.36]};
 const counts={},degree=new Map(nodes.map(n=>[n.id,0]));for(const e of edges){degree.set(e.de,(degree.get(e.de)||0)+1);degree.set(e.para,(degree.get(e.para)||0)+1);}
 const placed=nodes.map(n=>{const r=region(n),index=counts[r]||0;counts[r]=index+1;const a=index*2.399963,rad=index===0?0:Math.sqrt(index)*.014;return {...n,region:r,x:anchors[r][0]+Math.cos(a)*rad,y:anchors[r][1]+Math.sin(a)*rad,ax:anchors[r][0],ay:anchors[r][1],vx:0,vy:0,degree:degree.get(n.id)||0};});
 const byId=new Map(placed.map(n=>[n.id,n]));
 for(let tick=0;tick<100;tick++){
 for(let i=0;i<placed.length;i++){const n=placed[i];const pull=.065+Math.sqrt(n.degree)*.012;n.vx+=(n.ax-n.x)*pull;n.vy+=(n.ay-n.y)*pull;
 for(let j=i+1;j<placed.length;j++){const m=placed[j],dx=n.x-m.x,dy=n.y-m.y,d2=Math.max(.0002,dx*dx+dy*dy),f=.000010/d2;n.vx+=dx*f;n.vy+=dy*f;m.vx-=dx*f;m.vy-=dy*f;}}
 for(const e of edges){const n=byId.get(e.de),m=byId.get(e.para);if(!n||!m)continue;const dx=m.x-n.x,dy=m.y-n.y,d=Math.hypot(dx,dy)||1,f=(d-.08)*.0007;n.vx+=dx*f;n.vy+=dy*f;m.vx-=dx*f;m.vy-=dy*f;}
 for(const n of placed){n.vx*=.6;n.vy*=.6;n.x=Math.max(-.43,Math.min(.43,n.x+n.vx));n.y=Math.max(-.42,Math.min(.43,n.y+n.vy));}}
 return {nodes:placed,byId,anchors};
 }
 function ageLabel(at,now=Date.now()) {const t=Date.parse(at);if(!Number.isFinite(t))return 'sem horário';const ms=Math.max(0,now-t);if(ms<60000)return 'agora';if(ms<3600000)return Math.floor(ms/60000)+' min atrás';if(ms<86400000)return Math.floor(ms/3600000)+' h atrás';return Math.floor(ms/86400000)+' dias atrás';}
 return {regions,names,colors,types,region,filter,neighbors,layout,fold,ageLabel};
});
