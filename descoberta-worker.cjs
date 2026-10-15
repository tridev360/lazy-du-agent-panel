'use strict';
const {parentPort,workerData}=require('node:worker_threads');
const D=require('./descoberta.cjs');
function scan(){try{parentPort.postMessage({data:D.snapshot({...workerData,now:workerData.now||Date.now()})});}catch{parentPort.postMessage({error:'Não consegui ler as sessões. Solução: rode node checar.cjs.'});}}
scan();const timer=setInterval(scan,2000);parentPort.on('message',msg=>{if(msg==='close'){clearInterval(timer);parentPort.close();}else if(msg==='scan')scan();});
