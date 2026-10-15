'use strict';
// Coordenação fictícia: aplica os pedidos de ordem somente nos arquivos da demo.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.join(__dirname,'estado'),file=path.join(root,'estado','cronograma.json'),pedidos=path.join(root,'estado','pedidos-de-ordem.md');
const child=spawn(process.execPath,[path.join(__dirname,'..','servidor.cjs'),'--estado-root',root,'--port',process.env.PAINEL_PORT||'3257'],{stdio:'inherit',env:{...process.env,PAINEL_DEMO:'1'}});
const ideias=spawn(process.execPath,[path.join(__dirname,'..','decidir-ideias','server.mjs')],{stdio:'inherit',env:{...process.env,PAINEL_DEMO:'1',PORTA:process.env.PAINEL_IDEIAS_PORT||'3259',DADOS:path.join(root,'estado','ideias'),ESTADO:path.join(root,'estado')}});
let ultimo='',busy=false;
function aplicar(){if(busy)return;busy=true;try{const texto=fs.readFileSync(pedidos,'utf8'),linha=texto.trim().split('\n').at(-1);if(linha===ultimo)return;ultimo=linha;const m=/nova ordem: (.+) \| lista: (.+)$/.exec(linha);if(!m)return;const data=JSON.parse(fs.readFileSync(file,'utf8')),alvo=m[2]==='hoje'?data.hoje:(m[2].startsWith('semana, ')?data.semana.find(d=>(d.rotulo||d.dia)===m[2].slice(8)):data.geral.find(d=>d.fase===m[2].slice(7)))?.itens;if(!alvo)return;
const C=require('../cronograma-tela.cjs'),moveis=alvo.filter(i=>!C.fixo(i)),ordem=m[1].split(' > ');if(ordem.length!==moveis.length||new Set(ordem).size!==moveis.length||ordem.some(n=>!moveis.some(i=>i.o_que===n)))return;const porNome=new Map(moveis.map(i=>[i.o_que,i]));let pos=0;for(let i=0;i<alvo.length;i++)if(!C.fixo(alvo[i]))alvo[i]=porNome.get(ordem[pos++]);data.atualizado=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');console.log('Coordenacao de exemplo: ordem aplicada no cronograma do exemplo.');
}catch(e){console.error('Não foi possível aplicar a ordem da demo: '+e.message);}finally{busy=false;}}
const timer=setInterval(aplicar,300);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{clearInterval(timer);child.kill(signal);ideias.kill(signal);});
child.on('exit',(code,signal)=>{clearInterval(timer);ideias.kill();process.exitCode=code||0;});
child.on('error',()=>{clearInterval(timer);process.exitCode=1;});
