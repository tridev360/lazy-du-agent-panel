'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Teach=require('../public/teach.js');
const APPROVED={
  en:"Save the rules below in my global ~/.claude/CLAUDE.md so they apply to all my projects. Put them in a section that starts with the title \"## Lazy Du Agent Panel\". If that section already exists, replace only that section: its title line and the lines starting with \"- \" right below it. Create the file if it does not exist. Do not delete or change anything else. Then confirm in one line. If you cannot reach my home folder from here (for example, in a cloud session), say so in one line and stop.",
  pt:"Salve as regras abaixo no meu ~/.claude/CLAUDE.md global, para valerem em todos os meus projetos. Coloque numa seção que começa com o título \"## Lazy Du Agent Panel\". Se essa seção já existir, troque só ela: a linha do título e as linhas que começam com \"- \" logo abaixo. Crie o arquivo se ele não existir. Não apague nem mude mais nada. Depois confirme em 1 linha. Se daqui você não alcança a minha pasta pessoal (por exemplo, numa sessão na nuvem), diga isso em 1 linha e pare.",
  es:"Guarda las reglas de abajo en mi ~/.claude/CLAUDE.md global, para que valgan en todos mis proyectos. Ponlas en una sección que empiece con el título \"## Lazy Du Agent Panel\". Si esa sección ya existe, reemplaza solo esa sección: la línea del título y las líneas que empiezan con \"- \" justo debajo. Crea el archivo si no existe. No borres ni cambies nada más. Después confirma en 1 línea. Si desde aquí no llegas a mi carpeta personal (por ejemplo, en una sesión en la nube), dilo en 1 línea y detente."
};
test('the copied instruction stays the approved text in every language',()=>{
  for(const lang of ['en','pt','es']){assert.equal(Teach.SIMPLE[lang].instruction,APPROVED[lang]);assert.equal(Teach.ruleText(undefined,lang).split('\n\n')[0],APPROVED[lang]);}
});
test('the README blocks carry exactly the copied rules',()=>{
  for(const [file,lang,title] of [['README.md','en','### Exact copied rules'],['README.pt-BR.md','pt','### Regras copiadas, texto exato']]){
    const readme=fs.readFileSync(path.join(__dirname,'..',file),'utf8').replace(/\r\n/g,'\n'),start=readme.indexOf(title);assert.ok(start>=0,file+' title');
    const block=readme.slice(start).match(/\n~~~text\n([\s\S]*?)\n~~~\n/);assert.ok(block,file+' block');assert.equal(block[1],Teach.ruleText(undefined,lang));
  }
});
