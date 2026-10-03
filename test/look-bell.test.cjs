'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const ROOT=path.join(__dirname,'..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const Teach=require('../public/teach.js'),Bell=require('../public/bell.js'),Look=require('../public/look.js'),Locale=require('../public/locale.js');
const {parseTask}=require('../src/lib/workspace.cjs'),{cleanNews,createNews,NEWS_URL}=require('../src/lib/news.cjs');
const example=require('../example.json');
const PICKS=['claude','codex','both'];

test('teach block: 8 to 12 lines, says what it does, and only promises what the reader accepts',()=>{
  for(const lang of ['en','pt','es']){
    const choices=[{mode:'recommended'},...PICKS.map(p=>({mode:'custom',picks:Object.fromEntries(Teach.TASKS.map(t=>[t,p]))}))];
    for(const choice of choices){
      const lines=Teach.lines(choice,lang);assert.ok(lines.length>=8&&lines.length<=12,lang+' '+lines.length);
      assert.match(lines[0],/^## Lazy Du Agent Panel: [^()]+$/);assert.doesNotMatch(lines[0],/delete|apague|borra/);
      const ship=lines.find(l=>/production|produção|producción/.test(l));assert.match(ship,/explicit ok|ok explícito/);
      const header=/--- , phase: doing, --- /.test(lines.join(' '))||/---, phase: doing, ---/.test(lines.join(' '));assert.ok(header,'header lines are described');
      const phases=lines.find(l=>/new, open, doing, ready, review, released, done/.test(l));assert.ok(phases);for(const phase of ['new','open','doing','ready','review','released','done'])assert.notEqual(parseTask('---\nphase: '+phase+'\n---\n# T\n','t').phase.percent,null,phase);
      assert.ok(lines.some(l=>l.includes('tasks/decisions.md')&&/## 1\./.test(l)&&l.includes('DONE')));
      assert.ok(lines.some(l=>l.includes('completed_at')));
    }
    assert.deepEqual(Teach.lines({mode:'own'},lang),[],'keeping your current way makes no rules block');
  }
  assert.ok(parseTask('---\nphase: doing\n---\n# Task title\n','x'));
});

test('custom choice names who does and who reviews; nobody reviews its own work',()=>{
  assert.match(Teach.taskLine('code','claude','en'),/Claude Code, with the strongest model and high effort; Codex reviews each change/);
  assert.match(Teach.taskLine('code','codex','en'),/Codex, with the strongest model and high effort; Claude Code reviews/);
  assert.match(Teach.taskLine('review','both','pt'),/ninguém revisa o próprio trabalho/);
  assert.match(Teach.taskLine('analyze','claude','es'),/modelo más pequeño y esfuerzo bajo/);
  for(const lang of ['en','pt','es'])for(const family of ['claude','codex'])for(const task of Teach.TASKS){const note=Teach.T[lang].notes[family][task];assert.ok(note&&note.length<=200,lang+' '+family+' '+task);assert.ok((note.match(/[.!?](\s|$)/g)||[]).length<=2,'one or two sentences: '+note);}
  for(const lang of ['en','pt','es'])assert.match(Teach.T[lang].signature,/Claude/);
});

test('what the panel observed comes only from tool names and counts, labeled as observed',()=>{
  const seen=Teach.observe(example.usage.sessions);assert.equal(seen.claude.top,'read');assert.equal(seen.codex.top,'command');assert.equal(seen.codex.share,78);
  assert.match(Teach.observation(example.usage.sessions,'en'),/^Observed in your sessions, not a rule: /);
  assert.match(Teach.observation([],'es'),/^Nada observado/);
  const leak=Teach.observe([{agent:'claude',tools:[{name:'Edit',count:2}],text:'PRIVATE',prompt:'PRIVATE'}]);assert.equal(JSON.stringify(leak).includes('PRIVATE'),false);
});

test('teach, bell and look make no network request of their own and keep choices in this browser',()=>{
  for(const file of ['public/teach.js','public/look.js']){const s=read(file);assert.doesNotMatch(s,/\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|import\(/,file);}
  const bell=read('public/bell.js'),calls=bell.match(/fetch\([^,)]*/g)||[];assert.deepEqual(calls,["fetch('/api/news'"]);
  assert.doesNotMatch(bell,/XMLHttpRequest|WebSocket|sendBeacon|EventSource/);
  assert.equal(Bell.VERSION,require('../package.json').version);
});

test('bell lists version notes, one daily tip, waiting items and decisions with the color of who asked',()=>{
  const base={snapshot:{example:false,usage:{sessions:[{id:'w1',agent:'codex',state:'waiting',projectName:'tiny-game'}]},tasks:[{id:'d1',title:'Pick the font',needsOwner:true,executor:'claude',source:'tasks'},{id:'d2',title:'Choose music',needsOwner:true,source:'task-board'}]},used:{},closed:[],log:null,today:'2030-01-01'};
  const list=Bell.items(base,'en');
  assert.deepEqual(list.slice(0,2).map(x=>x.id),['version-'+Bell.VERSION,'recommendations-'+Bell.VERSION]);
  assert.equal(list.filter(x=>x.tip).length,1,'at most one tip');
  assert.equal(list.find(x=>x.id==='waiting-w1').origin,'codex');
  assert.equal(list.find(x=>x.id==='decision-d1').origin,'claude');
  assert.equal(list.find(x=>x.id==='decision-d2').origin,'you');
  assert.equal(Bell.pickTip({wen:true},[],null,'2030-01-02'),'accelerate');
  assert.equal(Bell.pickTip({},['tip-wen'],{date:'2030-01-02',id:'wen'},'2030-01-02'),null,'a closed tip waits for tomorrow');
  assert.equal(Bell.pickTip({wen:true},[],{date:'2030-01-02',id:'wen'},'2030-01-02'),null,'a used feature drops its tip');
  const author=Bell.items({...base,author:[{id:'n1',date:'2030-01-01',title:{en:'Hello'},text:{en:'Short'},link:'https://github.com/tridev360/lazy-du-agent-panel'}]},'pt').find(x=>x.id==='author-n1');assert.equal(author.origin,'author');assert.equal(author.title,'Hello');
  for(const lang of ['en','pt','es'])assert.ok(Bell.T[lang].origin.panel&&Bell.T[lang].origin.author&&Bell.T[lang].origin.panel!==Bell.T[lang].origin.author);
});

test('feedback opens a template issue and contact lists only the author links',()=>{
  const url=new URL(Bell.issueURL('pt'));assert.equal(url.origin+url.pathname,'https://github.com/tridev360/lazy-du-agent-panel/issues/new');
  assert.deepEqual([...url.searchParams.keys()],['title','body']);assert.equal(url.searchParams.get('body').split('\n').at(-2),'Versão do painel: '+Bell.VERSION);assert.equal(url.searchParams.get('body').split('\n').at(-1),'Language: pt');
  assert.deepEqual(Bell.CONTACTS.map(c=>c.text+' '+c.url),['github.com/tridev360 https://github.com/tridev360','X @hallstrid https://x.com/hallstrid']);
});

test('author messages: plain GET only when asked, silent failure, and the repo example is valid',async()=>{
  const sample=JSON.parse(read('news.json'));assert.equal(cleanNews(sample).length,sample.items.length);
  for(const item of cleanNews(sample))for(const lang of ['en','pt','es'])assert.ok(item.title[lang]&&item.text[lang],item.id+' '+lang);
  let seen=null;const ok=createNews({fetcher:async(url,init)=>{seen={url,init};return {ok:true,text:async()=>JSON.stringify(sample)};}});
  const body=await ok();assert.equal(body.ok,true);assert.equal(seen.url,NEWS_URL);assert.equal(seen.init.method,'GET');assert.equal(seen.init.credentials,'omit');assert.deepEqual(Object.keys(seen.init.headers),['Accept']);
  assert.deepEqual(await createNews({fetcher:async()=>{throw Error('offline');}})(),{ok:false});
  assert.deepEqual(await createNews({fetcher:async()=>({ok:true,text:async()=>'x'.repeat(70000)})})(),{ok:false});
  assert.deepEqual(await createNews({timeoutMs:20,fetcher:(u,init)=>new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(Error('timeout'))))})(),{ok:false});
  assert.deepEqual(cleanNews({items:[{id:'Bad ID',date:'2030-01-01',title:{en:'x'}},{id:'ok',date:'nope',title:{en:'x'}},{id:'ok2',date:'2030-01-01',title:{en:'<b>x</b>'}}]}),[]);
  const {createServer}=require('../src/panel.cjs'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'panel-news-'));let calls=0;
  const server=createServer({base:profile,profile,demoOnly:true,metrics:{snapshot:()=>({sessions:[],ready:true})},newsFetch:async()=>{calls++;return {ok:true,text:async()=>JSON.stringify(sample)};}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  try{
    for(const asset of ['/look.js','/look-views.js','/look-team.js','/look.css','/colors.css','/teach.js','/bell.js'])assert.equal((await fetch(base+asset)).status,200,asset);
    assert.equal(calls,0,'nothing is fetched until asked');
    const r=await(await fetch(base+'/api/news')).json();assert.equal(r.ok,true);assert.equal(r.items.length,sample.items.length);assert.equal(calls,1);
  }finally{await new Promise(r=>server.close(r));fs.rmSync(profile,{recursive:true,force:true});}
});

test('look: one card per AI and the week spend come from the public snapshot only',()=>{
  const fam=Look.families([{agent:'claude',state:'working',updated:'2030-01-01T10:00:00Z'},{agent:'codex',state:'resting'},{agent:'codex',state:'waiting'}]);
  assert.deepEqual([fam.claude.count,fam.claude.recent,fam.codex.count,fam.codex.recent,fam.codex.waiting],[1,1,2,0,1]);
  const sp=Look.spend(f=>f==='claude'?{available:true,remaining:54,minutes:10080}:{available:false});assert.deepEqual(sp,{codex:{available:false},claude:{available:true,used:46,minutes:10080}});
});

test('colors live in one place: pink is you, orange is Claude Code, blue is Codex',()=>{
  const tokens=read('public/colors.css');for(const name of ['--who-owner','--who-claude','--who-codex'])assert.match(tokens,new RegExp(name+':#[0-9a-f]{6}'));
  for(const file of ['public/look.css'])assert.doesNotMatch(read(file).toLowerCase(),/#ff2e7e|#ffac62|#65a7ff/,file+' uses the tokens');
});

test('the water label is playful everywhere it is shown',()=>{
  for(const file of ['public/r4.js','public/r9.js','public/r7-usage.js','public/r9-usage.js'])assert.match(read(file),/Playful water estimate/,file);
  assert.equal(Locale.text('Playful water estimate','es'),'Estimación ilustrativa de agua');
  assert.doesNotMatch(read('public/locale.js'),/'Estimated water'|'Water estimate'/);
});

test('sessions side by side: order, tools and totals come from metadata only',()=>{
  const V=require('../public/look-views.js');
  const list=V.order([{id:'a',state:'resting',updated:'2030-01-01T10:00:00Z'},{id:'b',state:'waiting'},{id:'c',state:'working',updated:'2030-01-01T09:00:00Z'},{id:'d',state:'working',updated:'2030-01-01T11:00:00Z'},{id:'e',state:'recent'}]);
  assert.deepEqual(list.map(x=>x.id),['d','c','e','b','a']);
  assert.equal(V.toolsLine([{name:'Read',count:8},{name:'Edit',count:4},{name:'Bash',count:9},{name:'Grep',count:1},{name:'bad'},{name:'Zero',count:0}]),'Bash ×9 · Read ×8 · Edit ×4');
  assert.equal(V.weekTotal({periods:[{key:'week',claude:972000,codex:2802000}]}),3774000);
  assert.equal(V.weekTotal({periods:[{key:'today',claude:1}]}),null);
  const credit=k=>k==='claude'?{available:true,remaining:54,minutes:10080}:{available:false};
  assert.equal(V.summary({ready:true,periods:[{key:'week',claude:1000,codex:2000}]},credit,'en',x=>String(x)),'This week: 3000 tokens · credit used: Claude Code 46%, Codex ?');
  assert.match(V.summary({ready:true,sampled:true,periods:[{key:'week',claude:1,codex:1}]},credit,'pt',String),/^Esta semana: ≥ 2 tokens/);
  assert.equal(V.summary({ready:false},credit,'es',String),'Los totales aparecen cuando termina la primera lectura.');
  assert.equal(V.summary({ready:true,periods:[]},credit,'en',String).startsWith('This week: ? tokens'),true);
  assert.deepEqual([V.ring(null).dash,Math.round(V.ring(50).dash),Math.round(V.ring(150).gap)],[0,82,0]);
  assert.deepEqual([V.waterText(40,'en'),V.waterText(500,'pt'),V.waterText(null,'es')],['~40 ml','~0,5 L','?']);
  const source=read('public/look-views.js');assert.doesNotMatch(source,/\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|payload|\.message\b|\.prompt\b/);
  for(const lang of ['en','pt','es'])assert.equal(V.W[lang].howText.length,6,'how we calculate is complete in '+lang);
});

test('team graph: you on top, both AIs side by side, helpers from parent ids, particles by recency',()=>{
  const T=require('../public/look-team.js'),now=Date.parse('2030-01-01T12:00:00Z');
  const sessions=[
    {id:'lead',agent:'codex',state:'working',updated:'2030-01-01T11:59:30Z'},
    {id:'art',agent:'claude',state:'recent',updated:'2030-01-01T11:50:00Z'},
    {id:'qa',agent:'codex',state:'finished',finishedAt:'2030-01-01T11:58:00Z'},
    {id:'ask',agent:'claude',state:'waiting'},
    {id:'old',agent:'codex',state:'resting',updated:'2029-12-30T10:00:00Z'}
  ],parents={art:'lead',qa:'lead'};
  const g=T.graph(sessions,id=>parents[id]||null,now),by=id=>g.edges.find(e=>e.id===id);
  assert.deepEqual(g.nodes.slice(0,3).map(n=>n.id),['you','hub-claude','hub-codex']);
  assert.equal(g.nodes.find(n=>n.id==='art').depth,1);
  assert.deepEqual([by('lead>art').kind,by('lead>art').sender,by('lead>art').level],['work','codex',1]);
  assert.deepEqual([by('lead>qa').kind,by('lead>qa').sender,T.direction(by('lead>qa'))],['reply','codex',-1]);
  assert.deepEqual([by('hub-claude>ask').kind,by('hub-claude>ask').sender,T.direction(by('hub-claude>ask'))],['question','claude',-1]);
  assert.deepEqual([by('hub-codex>lead').kind,by('hub-codex>lead').sender,by('hub-codex>lead').level],['work','you',3]);
  assert.deepEqual([by('hub-codex>old').kind,T.particles(by('hub-codex>old').level)],['idle',0]);
  assert.ok(T.particles(3)>T.particles(2)&&T.particles(2)>T.particles(1)&&T.particles(1)>0,'denser on the most recent wire');
  assert.equal(by('you>hub-claude').kind,'question','a session waiting for you shows on your wire');
  const L=T.layout(g),boxes=[...L.pos.values()];
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,'nodes never overlap');}
  assert.ok(L.pos.get('hub-claude').x<L.pos.get('hub-codex').x,'Claude Code left, Codex right');
  assert.ok(L.pos.get('you').y<L.pos.get('hub-claude').y,'you on top');
  const geo=T.wire(L.pos.get('lead'),L.pos.get('art'));assert.deepEqual(T.point(geo.p,0),geo.p[0]);assert.deepEqual(T.point(geo.p,1),geo.p[3]);assert.ok(T.length(geo.p)>0);
  const source=read('public/look-team.js');assert.doesNotMatch(source,/\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|\.message\b|\.prompt\b/);
  assert.match(source,/visibilitychange/);assert.match(source,/prefers-reduced-motion/);assert.match(source,/data-motion/);
  assert.match(source,/const reduced=\(\)=>d\.documentElement\.dataset\.motion==='off'\|\|!!root\.matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)\.matches/,'motion off and reduced motion both stop the dots');
  assert.match(source,/const count=reduced\(\)\?0:particles\(edge\.level\)/,'no dots when motion is reduced');
  assert.match(source,/active=list\.filter\(a=>level\(a,Date\.now\(\)\)>=2\)\.length/,'you count only active sessions');
  assert.equal((source.match(/requestAnimationFrame\(/g)||[]).length,2,'one animation loop');
  for(const lang of ['en','pt','es'])assert.match(T.W[lang].source,/metadata|metadados|metadatos/);
});

test('review fixes: author messages off by default, sessions wording, example label, no future promise',()=>{
  for(const author of [undefined,null,{},{auto:false},{auto:'yes'},{auto:false,checkedAt:null}])assert.equal(Bell.shouldFetchAuthor(author,Date.parse('2030-01-02T00:00:00Z')),false,JSON.stringify(author));
  assert.equal(Bell.shouldFetchAuthor({auto:true},0),true);
  assert.equal(Bell.shouldFetchAuthor({auto:true,checkedAt:'2030-01-01T12:00:00Z'},Date.parse('2030-01-01T13:00:00Z')),false,'at most once a day');
  assert.equal(Bell.shouldFetchAuthor({auto:true,checkedAt:'2030-01-01T12:00:00Z'},Date.parse('2030-01-02T13:00:00Z')),true);
  const defaults=[...read('public/bell.js').matchAll(/get\(KEYS\.author,(\{[^}]*\})/g)].map(m=>m[1]);assert.ok(defaults.length>=3);for(const value of defaults)assert.match(value,/^\{auto:false\b/,'every read of the setting starts off');
  for(const lang of ['en','pt','es']){assert.equal(Bell.T[lang].improve,undefined);assert.match(Bell.T[lang].usage,/usage data|dado de uso|datos de uso/);}
  assert.doesNotMatch(read('public/bell.js'),/later version|versão futura|versión futura/);
  const words=/const words=\{[\s\S]*?\};/.exec(read('public/r9.js'))[0];assert.doesNotMatch(words,/Read(?:ing)?(?: today’s)? conversations|conversation history|conversas/);
  assert.doesNotMatch(read('public/v2.js'),/its conversation has been read|sua conversa termina/);
  assert.equal(Locale.text('Reading local sessions','es'),'Leyendo sesiones locales');assert.equal(Locale.text('Daily usage','es'),'Uso diario');
  assert.match(Teach.observation(example.usage.sessions,'en',true),/^Observed in the example sessions, not a rule: /);
  assert.match(read('public/teach.js'),/observation\(snapshot\?\.usage\?\.sessions\|\|\[\],lang,!!snapshot\?\.example\)/,'the open card passes the example flag');
  assert.match(read('public/bell.js'),/function update\(data,locale\)\{[^}]*if\(!offline\(\)&&!checking&&shouldFetchAuthor\(get\(KEYS\.author,\{auto:false\}\)\)\)checkAuthor\(\);\}/,'the page only fetches through the rule');
  assert.match(Teach.observation(example.usage.sessions,'pt'),/Claude Code na maior parte lê e procura em arquivos/);
});

test('agent timeline: origin always resolved from the parent link, "?" only for missing data',()=>{
  const T=require('../public/look-team.js'),names={lead:'DU ARCHITECT · PROJECT PLANNING',kid:'DU DEV · GAME LOGIC',help:'DU TESTER · GAME CHECKS'},name=id=>names[id]||'?';
  const kid={id:'kid',agent:'codex',state:'working',startedAt:'2030-01-01T10:00:00Z',updated:'2030-01-01T10:30:00Z',model:'gpt-5.4',effort:'high',tools:[{name:'Edit',count:3},{name:'Read',count:9}],observedSteps:12,parentKey:'lead'};
  const helper={id:'help',agent:'claude',startedAt:'2030-01-01T10:10:00Z'};
  const tl=T.timeline(kid,{name,parentId:'lead',hasParentLink:true,children:[helper],actionText:()=>'Editing a file'},'en');
  assert.deepEqual(tl.map(e=>e.key),['start','model','helper','tools','last','end']);
  assert.deepEqual(tl.filter(e=>e.untimed).map(e=>e.key),['model','tools','end'],'only real times');
  for(const e of tl.filter(e=>!e.untimed))assert.ok([kid.startedAt,helper.startedAt,kid.updated].map(Date.parse).includes(e.at),e.key+' time comes from metadata');
  const H=require('../public/human.js');assert.equal(T.timeline({id:'x',agent:'codex',model:'m',effort:'xhigh'},{name,parentId:null,hasParentLink:false,effortWord:e=>H.effort(e,'es')},'es')[1].detail,'m · Profunda','same effort words as Sessions');
  assert.match(T.timeline({id:'x',agent:'codex',sampled:true,tools:[{name:'Edit',count:2}]},{name,parentId:null,hasParentLink:false},'en').find(e=>e.key==='tools').detail,/· ≥ 2 steps$/);
  assert.equal(tl[0].detail,'by DU ARCHITECT · PROJECT PLANNING');assert.equal(tl[0].parent,'lead');
  assert.equal(tl[1].detail,'gpt-5.4 · high');
  assert.deepEqual([tl[2].detail,tl[2].actor,new Date(tl[2].at).toISOString()],['DU TESTER · GAME CHECKS','claude','2030-01-01T10:10:00.000Z']);
  assert.equal(tl[3].detail,'Read ×9 · Edit ×3 · 12 steps');assert.equal(tl[4].detail,'Editing a file');assert.equal(tl[5].title,'Working now');
  assert.equal(T.timeline({id:'x',agent:'claude'},{name,parentId:null,hasParentLink:false},'pt')[0].detail,'direto no Claude Code · sem sessão de origem');
  assert.equal(T.timeline({id:'x',agent:'codex',parentKey:'gone'},{name,parentId:null,hasParentLink:true},'es')[0].detail,'por una sesión fuera de esta lectura');
  const bare=T.timeline({id:'x',agent:'codex'},{name,parentId:null,hasParentLink:false},'en');
  assert.equal(bare[0].at,null,'unknown start time stays unknown');assert.equal(bare[1].detail,'?');assert.equal(bare.find(e=>e.key==='last').detail,'?');assert.equal(bare.find(e=>e.key==='tools').detail,'none read');
  const done=T.timeline({id:'x',agent:'codex',state:'finished',finishedAt:'2030-01-01T11:00:00Z'},{name,parentId:null,hasParentLink:false},'en').at(-1);assert.deepEqual([done.title,done.untimed],['Finished',false]);
  const closed=T.timeline({id:'x',agent:'codex',state:'finished',updated:'2030-01-01T11:00:00Z'},{name,parentId:null,hasParentLink:false},'en').at(-1);assert.deepEqual([closed.title,closed.untimed],['Finished',true],'no fixed ? when the finish has no own time');
  const {exampleFor}=require('../src/lib/examples.cjs');for(const size of ['solo','large'])for(const s of exampleFor(example,size).usage.sessions){assert.ok(Number.isFinite(Date.parse(s.startedAt))&&Number.isFinite(Date.parse(s.updated)),size+' example has times');assert.equal(s.observedSteps,(s.tools||[]).reduce((n,t)=>n+t.count,0),size+' '+s.id+' steps add up');assert.ok(s.completedSteps<=s.observedSteps,size+' '+s.id+' completed steps do not exceed observed steps');}
  const team=read('public/look-team.js');assert.match(team,/orphan=!edge\.helper&&!!\(s\?\.parentKey\|\|s\?\.parentId\)/,'no You line for a helper whose parent is outside the reading');
  assert.match(team,/openTimeline\(edge\.to,orphan\?null:/,'orphan opens without the You line');assert.match(team,/effortWord:e=>H\(\)\?\.effort\?\.\(e,lingua\(lang\)\)\|\|e/,'timeline uses the Sessions effort words');
  assert.doesNotMatch(read('public/look-team.js'),/\.message\b|\.prompt\b|payload\./);
});
