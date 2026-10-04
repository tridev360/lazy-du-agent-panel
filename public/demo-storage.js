(function(root){
  'use strict';
  // Example preferences belong to this document, never to another tab on this origin.
  function createStorage(context){
    const example=new URLSearchParams(context.location?.search||'').get('example')==='1';
    const values=new Map();
    const memory={
      getItem(key){return values.get(String(key))??null;},
      setItem(key,value){values.set(String(key),String(value));},
      removeItem(key){values.delete(String(key));},
      clear(){values.clear();},
      key(index){return [...values.keys()][index]??null;},
      get length(){return values.size;}
    };
    return {storage:()=>example?memory:context.localStorage};
  }
  if(typeof module==='object'&&module.exports)module.exports={createStorage};
  else root.PanelStorage=createStorage(root);
})(typeof window==='object'?window:globalThis);
