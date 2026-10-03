'use strict';
function createReadSnapshot({ttl=Infinity,clock=Date.now,serialize=true}={}){
  let previous=null,keys=null,at=0;
  return {
    read(next,build){const now=clock();if(previous&&now-at<ttl&&keys.length===next.length&&keys.every((value,i)=>Object.is(value,next[i])))return previous;
      const value=build();previous={value,json:serialize?JSON.stringify(value):null};keys=next.slice();at=now;return previous;},
    invalidate(){previous=null;keys=null;}
  };
}
module.exports={createReadSnapshot};
