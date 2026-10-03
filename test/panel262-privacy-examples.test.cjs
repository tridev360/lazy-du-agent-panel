'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createRules}=require('../src/lib/guidance-rules.cjs'),{exampleFor}=require('../src/lib/examples.cjs'),Credit=require('../public/r9-model.js'),Views=require('../public/look-views.js');
const large=require('../example.json'),solo=require('../example-solo.json');
test('rule detection never stats or reads project instruction files, including false and unknown globals',async()=>{
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'panel-public-rules-')),project=path.join(profile,'project'),globalFile=path.join(profile,'.claude','CLAUDE.md');
  const originalRead=fs.promises.readFile,originalStat=fs.promises.lstat,projectRulePaths=[path.join(project,'CLAUDE.md'),path.join(project,'AGENTS.md')],accessed=[];
  try{
    fs.mkdirSync(project);fs.mkdirSync(path.dirname(globalFile));for(const f of projectRulePaths)fs.writeFileSync(f,'## Lazy Du Agent Panel\n- This local marker must not enable the public rule detection.');
    fs.promises.readFile=async function(file,...args){const resolved=path.resolve(String(file));assert.ok(!projectRulePaths.includes(resolved),'must not read project instruction files');accessed.push(resolved);return originalRead.call(this,file,...args);};
    let denyGlobal=false;fs.promises.lstat=async function(file,...args){const resolved=path.resolve(String(file));assert.ok(!projectRulePaths.includes(resolved),'must not inspect project instruction files');if(denyGlobal&&resolved===globalFile)throw Object.assign(Error('test access denied'),{code:'EACCES'});return originalStat.call(this,file,...args);};
    for(const expected of [false,true,null]){
      denyGlobal=expected===null;if(expected===true)fs.writeFileSync(globalFile,'## Lazy Du Agent Panel\n- Global rule marker.');else if(fs.existsSync(globalFile))fs.unlinkSync(globalFile);
      const reader=createRules(profile,{index:{metadata:new Map([['fixture',{privateProjectRoots:[{key:'abcdef12',folder:project,name:'Project'}]}]])}}),value=await reader.snapshot({sessions:[]},{board:{connected:false},tasks:[]});
      assert.equal(value.projects.length,1);assert.equal(value.projects[0].rulesEnabled,expected);assert.equal(value.onboarding.steps.rules,expected);assert.equal(value.onboarding.taskFolderExists,false);assert.equal(value.onboarding.projects[0].taskFolderExists,false);assert.ok(!JSON.stringify(value).includes(project));
    }
    assert.ok(accessed.every(file=>file===globalFile||file===path.join(profile,'.codex','AGENTS.md')));
  }finally{fs.promises.readFile=originalRead;fs.promises.lstat=originalStat;fs.rmSync(profile,{recursive:true,force:true});}
});
test('both shipped fixtures show unavailable Claude credit and preserve Codex and token data',()=>{
  for(const value of [large,solo]){
    assert.deepEqual(value.usage.claude.windows,[]);assert.equal(Credit.credit(value.usage,'claude').available,false);assert.equal(Credit.credit(value.usage,'codex').available,true);
    for(const lang of ['en','pt','es']){const line=Views.summary(value.usage,key=>Credit.credit(value.usage,key),lang,String);assert.ok(line.includes('Claude Code ?'));assert.ok(/Codex \d+%/.test(line));}
  }
  assert.equal(large.usage.claude.tokens,486000);assert.equal(large.usage.codex.windows[0].used,28);assert.equal(solo.usage.codex.windows[0].used,18);
});
test('generated solo and large examples discard Claude windows without mutating caller or losing tokens',()=>{
  const base=structuredClone(large);base.usage.claude.windows=[{used:46,minutes:10080,reset:'2030-10-05T12:00:00Z'}];base.usage.claude.tokens=123456;const before=JSON.stringify(base);
  for(const size of ['solo','large']){const sample=exampleFor(base,size);assert.deepEqual(sample.usage.claude.windows,[]);assert.equal(sample.usage.claude.tokens,123456);assert.equal(Credit.credit(sample.usage,'claude').available,false);assert.equal(sample.usage.codex.windows[0].used,size==='solo'?18:28);assert.equal(JSON.stringify(base),before);}
});
test('privacy promises appear once and Portuguese explains private profile cache, matching English',()=>{
 const en=fs.readFileSync(path.join(__dirname,'../README.md'),'utf8'),pt=fs.readFileSync(path.join(__dirname,'../README.pt-BR.md'),'utf8'),phrases={en:'To find task folders, it also checks whether a tasks folder exists in the project folders of your sessions. It reads only the .md files of the folder you connect.',pt:'Para achar pastas de tarefas, ele também confere se existe uma pasta tasks nas pastas de projeto das suas sessões. Só lê os .md da pasta que você conectar.'};
 assert.equal(en.split(phrases.en).length-1,1);assert.equal(pt.split(phrases.pt).length-1,1);assert.match(en,/full paths stay private in the profile cache/);assert.match(pt,/o caminho completo fica privado no cache do perfil/);assert.match(pt,/Ele nunca aparece nos dados enviados ao navegador nem sai deste computador\./);assert.doesNotMatch(pt,/Ligar minha pasta de tarefas/);
});
