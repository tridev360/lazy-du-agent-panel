'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const {WORDS}=require('../public/resolve211.js');
const preservedSix={en:'c5b450744543137b220b1ec685c6acccd27425c00dcb8d8d19d7d6c662e70adb',pt:'dcd03668c0adeceea3c210ef25368dbbae90e6f503becf4dee3a877b7363c1c9',es:'edd97de65662e85fe027c6df68e892f48469aad3ac3d012300458a3ae049500b'};
const contracts={
 en:[/no account/i,/API key/i,/local session metadata/i,/connected tasks/i,/global rules marker/i,/network features are optional/i],
 pt:[/sem conta/i,/chave de API/i,/metadados das sessões locais/i,/tarefas conectadas/i,/marcador das regras globais/i,/recursos de rede são opcionais/i],
 es:[/sin cuenta/i,/clave de API/i,/metadatos de sesiones locales/i,/tareas conectadas/i,/marcador de reglas globales/i,/funciones de red son opcionales/i]
};
function factual(text,lang){assert.doesNotMatch(text,/everything stays|tudo fica|todo queda|reads only metadata|lê só metadados|solo lee metadatos/i,'MUTATION_HOME_PRIVACY_FACTUAL');for(const pattern of contracts[lang])assert.match(text,pattern,'MUTATION_HOME_PRIVACY_FACTUAL');}
test('Home preserves its six useful benefits exactly and the two README benefit sections remain aligned',()=>{for(const lang of ['en','pt','es']){assert.equal(WORDS[lang].lines.length,7);assert.equal(crypto.createHash('sha256').update(JSON.stringify(WORDS[lang].lines.slice(0,6))).digest('hex'),preservedSix[lang]);}for(const [lang,file]of [['en','README.md'],['pt','README.pt-BR.md']]){const text=fs.readFileSync(path.join(__dirname,'..',file),'utf8');assert.ok(text.indexOf('## '+WORDS[lang].title)<text.indexOf('## '+(lang==='en'?'Open in under':'Abrir em menos')));for(const line of WORDS[lang].lines.slice(0,6))assert.ok(text.includes('- '+line));}});
test('Home privacy describes connected tasks, the global marker and optional network in all three languages',()=>{for(const lang of ['en','pt','es'])factual(WORDS[lang].lines[6],lang);});
test('The real mounted Home updates its seven lines when the language changes without storage or network access',()=>{
 const ids=new Map();class Element{constructor(tag){this.tag=tag;this.children=[];}set id(value){this._id=value;ids.set(value,this);}get id(){return this._id;}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(){}querySelector(tag){return this.children.find(n=>n.tag===tag);}}
 const host=new Element('div');host.id='view-home';const document={readyState:'complete',documentElement:{lang:'en'},getElementById:id=>ids.get(id),createElement:tag=>new Element(tag)},context={document,MutationObserver:class{constructor(fn){context.draw=fn;}observe(node,options){assert.equal(node,document.documentElement);assert.equal(options.attributeFilter[0],'lang');}},fetch(){assert.fail('Home copy must not request a network resource');}};Object.defineProperty(context,'localStorage',{get(){assert.fail('Home copy must not access preferences');}});
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/resolve211.js'),'utf8'),context);
 for(const lang of ['en','pt','es']){document.documentElement.lang=lang;context.draw();const box=ids.get('panel-solves');assert.equal(box.querySelector('h2').textContent,WORDS[lang].title);assert.deepEqual(box.querySelector('ul').children.map(n=>n.textContent),WORDS[lang].lines);factual(box.querySelector('ul').children.at(-1).textContent,lang);}
});
test('Public Home copy has no absolute privacy promise, unpublished claim or internal material',()=>{for(const copy of Object.values(WORDS))assert.doesNotMatch(JSON.stringify(copy),/2\.2|coming soon|em breve|próximamente|C:\\Users|[\u2013\u2014]/);});
