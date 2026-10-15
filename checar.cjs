'use strict';
const path=require('node:path'),fs=require('node:fs'),net=require('node:net');
const {snapshot,label}=require('./descoberta.cjs');
function exportData(s,name='Fonte local') {
 const clean=r=>({id:r.id,family:r.family,name:label(r.name),cwd:r.cwd,parentId:r.parentId,lastAt:r.lastAt,state:r.state,tokens:r.tokens,todayTokens:r.todayTokens});
 return {version:1,name:label(name),updated:s.updated,sessions:s.sessions.map(clean),helpers:s.helpers.map(clean)};
}
async function check() {
 const s=snapshot();
 if(process.argv.includes('--exportar')) {console.log(JSON.stringify(exportData(s,process.env.PAINEL_FONTE_NOME||'VPS 1')));return;}
 console.log('Home usada: '+s.homes.join('; '));
 for(const [id,name] of [['claude','Claude Code'],['codex','Codex']]){const count=s.sessions.filter(r=>r.family===id).length,helpers=s.helpers.filter(r=>r.family===id).length;console.log(name+': '+count+(count===1?' sessão':' sessões')+' e '+helpers+(helpers===1?' ajudante.':' ajudantes.'));}
 console.log('Projetos: '+s.projects.length+'. Última atividade: '+(s.activity.length?'há '+Math.max(0,Math.floor((Date.now()-Date.parse(s.activity[0].at))/60000))+' min.':'nenhuma.'));
 for(const d of s.diagnostics)console.log(d.reason);
 if(!s.diagnostics.length)console.log('Arquivos pulados: nenhum atalho ou arquivo privado nas pastas de sessões. Credenciais não são abertas.');
 const root=process.env.PAINEL_ROOT||path.join(__dirname,'estado-local');console.log('Estado: '+(fs.existsSync(root)?'achado.':'faltando. Passo 2 opcional: metodo/.'));
 let port=Number(process.env.PAINEL_PORT||3257);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Porta inválida.');
 for(let i=0;i<20 && port<=65535;i++,port++) {
  if([3250,3256,3259].includes(port))continue;
  const free=await new Promise(resolve=>{const p=net.createServer();p.once('error',()=>resolve(false));p.listen(port,'127.0.0.1',()=>p.close(()=>resolve(true)));});
  if(free){console.log('Porta '+port+' livre. Abra com node servidor.cjs --port '+port+'.');return;}
 }
 throw Error('Nenhuma porta livre no intervalo. Solução: escolha PAINEL_PORT.');
}
if(require.main===module)check().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={exportData};
