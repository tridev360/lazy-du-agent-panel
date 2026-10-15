'use strict';
// Só gera uma prévia. Nenhuma escrita ou rede.
const fs=require('node:fs'),path=require('node:path');
const rel=process.argv[2];
if(!rel || path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..'))throw Error('Informe um arquivo relativo a modelos/ ou modelos-estado/.');
// modelos-estado/ fica ao lado de metodo/; o resto vem de metodo/modelos/.
const estado=/^modelos-estado[\\/]/.test(rel),root=estado?path.join(__dirname,'..'):path.join(__dirname,'modelos');
let file=root;for(const part of rel.split(/[\\/]/)){file=path.join(file,part);if(fs.lstatSync(file).isSymbolicLink())throw Error('Atalho recusado.');}
const d=new Date(process.env.PAINEL_MODELO_AGORA || Date.now()),pad=n=>String(n).padStart(2,'0'),today=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()),tomorrow=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1),next=tomorrow.getFullYear()+'-'+pad(tomorrow.getMonth()+1)+'-'+pad(tomorrow.getDate());
const delta=d.getTime()-Date.parse('2025-03-14T15:25:00.000Z');
let text=fs.readFileSync(file,'utf8');
text=text.replace(/2025-03-14T[0-9:.]+Z/g,stamp=>new Date(Date.parse(stamp)+delta).toISOString());
// Horas com fuso -03:00 (formato do registro de ideias) e ids com a data compacta.
text=text.replace(/2025-03-14T\d\d:\d\d:\d\d(?:\.\d+)?-03:00/g,stamp=>new Date(Date.parse(stamp)+delta-3*3600000).toISOString().slice(0,-1)+'-03:00');
text=text.replaceAll('20250314',today.replaceAll('-',''));
text=text.replaceAll('2025-03-15',next).replaceAll('2025-03-14',today);
text=text.replace(/"atualizadoEm":\s*"[^"]*"/g,'"atualizadoEm": '+JSON.stringify(d.toISOString()));
process.stdout.write(text);
