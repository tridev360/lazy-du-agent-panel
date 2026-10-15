'use strict';
const fs=require('node:fs'),path=require('node:path'),M=require('./marcos-modelo.js'),C=require('./conselho-fonte.cjs');
function read(state,now=Date.now()){let raw=null,fileAt=null;try{const p=path.join(state,'marcos.json'),st=fs.lstatSync(p);if(!st.isFile()||st.isSymbolicLink()||st.size>1024*1024)throw Error();raw=JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));fileAt=st.mtime.toISOString();}catch{}return M.normalize(raw,{now,fileAt,source:'estado/marcos.json',sanitize:C.sanitize});}
module.exports={read};
