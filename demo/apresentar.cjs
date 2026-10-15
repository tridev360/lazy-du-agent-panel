'use strict';
const path=require('path'),{spawn}=require('node:child_process');const port=Number(process.argv[2]||3255);if(!Number.isInteger(port)||port<1024||port>65534)throw Error('Porta inválida');
const home=path.join(__dirname,'home'),root=path.join(__dirname,'estado');
// Idealizadores: o app do Conselho da demo sobe na porta seguinte, com as ideias fictícias da demo, e o painel aponta para ele.
const portaIdeias=Number(process.env.PAINEL_IDEIAS_PORT||port+1);process.env.PAINEL_IDEIAS_URL='http://127.0.0.1:'+portaIdeias;
const ideias=spawn(process.execPath,[path.join(__dirname,'..','decidir-ideias','server.mjs')],{stdio:'inherit',env:{...process.env,PAINEL_DEMO:'1',PORTA:String(portaIdeias),PAINEL_PORT:String(port),DADOS:path.join(root,'estado','ideias'),ESTADO:path.join(root,'estado')}});process.on('exit',()=>ideias.kill());
// A demo fica parada no tempo enquanto roda (relogio-demo.cjs): nada envelhece até virar "sem leitura".
const relogio=require('./relogio-demo.cjs').congelar(root);setInterval(relogio.tique,30000).unref();
const s=require('../automatico-servidor.cjs').createServer(root,{home,port});s.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Porta ocupada. Escolha outra porta; nenhum processo foi encerrado.':'Não foi possível abrir a prévia.');s.close();ideias.kill();process.exitCode=1;});s.readerReady.then(()=>s.listen(port,'127.0.0.1',()=>console.log('Demo local: http://127.0.0.1:'+port)));process.on('SIGINT',()=>{ideias.kill();s.closeAllConnections();s.close(()=>process.exit(0));});
