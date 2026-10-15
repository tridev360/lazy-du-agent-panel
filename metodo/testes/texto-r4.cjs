'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),prompt=fs.readFileSync(path.join(root,'COLE-NO-SEU-CLAUDE-METODO.md'),'utf8'),add=fs.readFileSync(path.join(root,'ADENDO-R4.md'),'utf8');
for(const term of ['sim claro','credencial'])assert.ok(prompt.includes(term));
for(const term of ['sim claro','Desfazer','hooks','CLAUDE.md','pedidos de ordem','worktree','Esperar'])assert.ok(add.includes(term));
assert.match(add,/Desfazer[^\n]*sim claro/);
function scan(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())scan(p);else{const text=fs.readFileSync(p,'utf8');assert.doesNotMatch(text,new RegExp('['+String.fromCharCode(8210,8211,8212,8213,8722)+']|\\p{Extended_Pictographic}','u'),path.relative(root,p));}}}
scan(root);console.log('Texto: regras e forma conferidas.');
