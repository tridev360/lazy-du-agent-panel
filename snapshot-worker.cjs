'use strict';
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
// or a live API request in the last demandMs) the next read starts watchMs after the previous one ends;
// with nobody watching nothing is scheduled. A viewer who returns after the pause starts a read at once
// and is served the kept snapshot, with its own read time, until the new one arrives.
const CADENCE={watchMs:5000,demandMs:30000,refreshMs:50,changeGapMs:2500};
if(!isMainThread){
 const reader=require('./leitor.cjs'),commands=require('./comandos.cjs');
 const metadataProvider=workerData.metadataOnly===true?require('./pe-metadata-reader.cjs').createMetadataReader(workerData.metadataReaderConfig):null;
 const run=()=>{try{const snapshot=reader.snapshot(workerData.root,workerData.sessionsRoot,new Date(),{metadataOnly:workerData.metadataOnly,metadataProvider});if(workerData.metadataOnly!==true)snapshot.commandSessions=commands.sessionsOf(snapshot.equipe,workerData.root);snapshot.commandsEnabled=true;snapshot.public=false;parentPort.postMessage({snapshot,metadata:metadataProvider?.current()||null});}catch{parentPort.postMessage({error:'state_unavailable'});}};
 parentPort.on('message',message=>{if(message==='read')run();else if(message==='close')parentPort.close();});
}else{
 function createCadence(read,options={}){
  const o={...CADENCE,...options},now=o.now||Date.now,setTimer=o.setTimeout||setTimeout,clearTimer=o.clearTimeout||clearTimeout;
  let streams=0,requestAt=-Infinity,doneAt=-Infinity,reading=false,stopped=false,timer=null,dueAt=Infinity,forced=false,againGap=null;
  const watching=()=>streams>0||now()-requestAt<o.demandMs;
  const cancel=()=>{if(timer!==null)clearTimer(timer);timer=null;dueAt=Infinity;};
  const begin=()=>{cancel();forced=false;reading=true;read();};
  const schedule=when=>{if(timer!==null&&dueAt<=when)return;cancel();dueAt=when;timer=setTimer(tick,Math.max(0,when-now()));timer?.unref?.();};
  function tick(){timer=null;dueAt=Infinity;if(!stopped&&(forced||watching()))begin();}
  // An asked read starts soon, never closer than gap to the end of the previous one; during a read, one more follows it.
  const request=gap=>{if(stopped)return;forced=true;if(reading){againGap=againGap===null?gap:Math.min(againGap,gap);return;}schedule(Math.max(now()+o.refreshMs,doneAt+gap));};
  const wake=()=>{if(stopped||reading||timer!==null)return;if(now()-doneAt>=o.watchMs)begin();else schedule(doneAt+o.watchMs);};
  return {
   start(){if(!stopped&&!reading)begin();},
   touch(){requestAt=now();wake();},
   open(){streams++;wake();},
   leave(){streams=Math.max(0,streams-1);},
   refresh(){request(0);},
   changed(){request(o.changeGapMs);},
   done(){reading=false;doneAt=now();if(stopped)return;
    if(againGap!==null){const gap=againGap;againGap=null;forced=true;schedule(Math.max(now()+o.refreshMs,doneAt+gap));}else if(watching())schedule(doneAt+o.watchMs);},
   stop(){stopped=true;cancel();},
   status(){return {watching:watching(),reading,streams,dueAt,doneAt};}
  };
 }
 function createSnapshotWorker(root,sessionsRoot,onChange,options={}){
  if(options.metadataOnly===true&&!options.metadataReaderConfig)throw Error('Metadata policy unavailable');
  const worker=new Worker(__filename,{workerData:{root,sessionsRoot,metadataOnly:options.metadataOnly,metadataReaderConfig:options.metadataReaderConfig}});let latest=null,metadata=null,error=null,closed=false,resolveReady,rejectReady,reads=0;
  const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});ready.catch(()=>{});
  const cadence=createCadence(()=>worker.postMessage('read'),options);
  worker.on('message',message=>{if(closed)return;reads++;if(message.snapshot){latest=message.snapshot;metadata=message.metadata||null;error=null;resolveReady();}else error=message.error||'state_unavailable';cadence.done();onChange?.();});
  worker.on('error',()=>{error='state_unavailable';cadence.stop();rejectReady(Error('State reader unavailable'));onChange?.();});
  cadence.start();
  return {ready,snapshot(){if(!latest)throw Error('State reader loading');return {...latest,readerStatus:error?'delayed':'ready'};},
   metadataSnapshot(){if(closed||!metadata)throw Error('Metadata unavailable');return error?{...metadata,readerStatus:'delayed'}:metadata;},
   touch(){if(!closed)cadence.touch();},open(){if(!closed)cadence.open();},leave(){if(!closed)cadence.leave();},
   refresh(){if(!closed)cadence.refresh();},changed(){if(!closed)cadence.changed();},status:cadence.status,version(){return reads;},
   close(){if(closed)return;closed=true;cadence.stop();worker.postMessage('close');return worker.terminate();}};
 }
 module.exports={createSnapshotWorker,createCadence,CADENCE};
}
