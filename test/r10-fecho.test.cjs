'use strict';
// R10: closes r9 with proof. Each guarded behavior has an in-memory negative control: the guard is
// removed only inside this test, never on disk.
const test = require('node:test'), a = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), vm = require('node:vm'), Module = require('node:module');
const { key } = require('../src/lib/session-story.cjs');
const root = path.resolve(__dirname, '..');
const now = new Date('2030-01-07T12:00:00Z'), day = 86400000;
const uuid = (n) => '11111111-1111-4111-8111-' + String(n).padStart(12, '0');
const line = (type, payload, at = '2030-01-07T11:59:00Z') => JSON.stringify({ type, timestamp: at, payload }) + '\n';
const content = (id, tokens = 10) => line('session_meta', { id, cwd: '/projects/Game', model: 'gpt-6.1-sol' }) + line('event_msg', { type: 'token_count', info: { total_token_usage: { total_tokens: tokens, input_tokens: tokens, output_tokens: 0, cached_input_tokens: 0 } } });
function fixture(t) { const home = fs.mkdtempSync(path.join(os.tmpdir(), 'panel-r10-')); t.after(() => fs.rmSync(home, { recursive: true, force: true })); return home; }
function write(home, id, text, age = 0) { const file = path.join(home, '.codex', 'sessions', '2030', '01', '07', 'rollout-2030-01-07T12-00-00-' + id + '.jsonl'); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); fs.utimesSync(file, new Date(+now - age), new Date(+now - age)); return file; }

// Minimal document for the view layer: enough to run v2.js before any snapshot exists.
function loadViews(source) {
  const nodes = new Map();
  const make = (tag = 'div') => ({ tagName: String(tag).toUpperCase(), children: [], dataset: {}, style: {}, attrs: {}, hidden: false, disabled: false, textContent: '', className: '',
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; }, removeAttribute(k) { delete this.attrs[k]; },
    append(...xs) { this.children.push(...xs); }, prepend(...xs) { this.children.unshift(...xs); }, replaceChildren(...xs) { this.children = [...xs]; },
    get childElementCount() { return this.children.length; }, querySelector() { return null; }, querySelectorAll() { return []; }, focus() {}, addEventListener() {}, close() {}, contains() { return false; } });
  const document = { body: make('body'), documentElement: make('html'), activeElement: null, createElement: make, querySelector: () => make(), querySelectorAll: () => [],
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, make()); return nodes.get(id); } };
  const window = { document, location: { search: '' }, localStorage: { getItem: () => null, setItem() {} }, scrollTo() {}, requestAnimationFrame() {}, setTimeout() {}, clearTimeout() {},
    PanelCore: require('../public/v2-core.js'), PanelR4Core: require('../public/r4-core.js'), PanelR9: require('../public/r9-model.js'), PanelHuman: require('../public/human.js'), DuPortraits: [{ id: 1, image: '/dus/1.png' }] };
  vm.runInNewContext(source, { window, URLSearchParams });
  return { window, stage: () => nodes.get('agent-stage'), node: (id) => document.getElementById(id) };
}

test('the unconnected Home has one main connection action; results lead to Usage, in EN and PT', () => {
  const source=fs.readFileSync(path.join(root,'public/v2.js'),'utf8');
  const render=(bytes,lang)=>{const v=loadViews(bytes);let connections=0;v.window.PanelR4={update(){},connect(){connections++;}};v.window.PanelV2.render({tasks:[],queue:[],projects:[],board:{connected:false,status:'disconnected'},usage:{ready:true,sessions:[]}},lang);return {...v,connections:()=>connections};};
  for(const lang of ['en','pt']){
    const v=render(source,lang),connect=lang==='pt'?'Ligar minha pasta de tarefas':'Connect my task folder';
    a.equal(v.node('waiting-action').textContent,connect);
    a.equal(v.node('deadline-action').textContent,lang==='pt'?'Ver resultados ↗':'See results ↗');
    a.equal(['waiting-action','deadline-action'].filter(id=>v.node(id).textContent===connect).length,1);
    v.node('waiting-open').onclick();a.equal(v.connections(),1,'the principal action still opens the connection form');
    v.node('deadline-open').onclick();a.equal(v.connections(),1,'results do not repeat the connection action');a.equal(v.window.document.body.dataset.view,'usage');
    v.window.PanelV2.select('queue');a.ok(v.node('queue-connection').children.some(n=>n.textContent===connect),'connection remains available in Queue');
  }
  // Negative control in memory: restoring the old delivery action duplicates the Home CTA.
  const current="txt('deadline-action',pt?'Ver resultados ↗':'See results ↗');";
  a.equal(source.split(current).length-1,1);
  const old=render(source.replace(current,"txt('deadline-action',linked?(pt?'Ver resultados ↗':'See results ↗'):(pt?'Ligar minha pasta de tarefas':'Connect my task folder'));"),'en');
  a.equal(['waiting-action','deadline-action'].filter(id=>old.node(id).textContent==='Connect my task folder').length,2);
});

test('daily progress uses dated real tasks in the delivery UTC day, not helpers, undated history or conversation steps', t=>{
  const home=fixture(t),folder=path.join(home,'tasks');fs.mkdirSync(folder);
  const writeTask=(name,meta,title)=>fs.writeFileSync(path.join(folder,name+'.md'),'---\nid: '+name+'\n'+meta+'\n---\n# '+title+'\n');
  writeTask('done','phase: done\ncompleted_at: 2030-01-07T10:00:00Z','Fix the game jump');
  writeTask('doing','phase: doing\nstarted_at: 2030-01-06T23:30:00-02:00','Draw the menu');
  writeTask('helper','phase: done\ncompleted_at: 2030-01-07T10:00:00Z\nhelper: true','Check the helper');
  writeTask('old','phase: done\ncompleted_at: 2030-01-06T20:00:00Z','Old completed task');
  writeTask('undated','phase: done','Completed without a date');
  writeTask('deadline','phase: doing\ndeadline: 2030-01-07T18:00:00Z','A deadline is not a start');
  writeTask('json','phase: done\ncompleted_at: 2030-01-07T10:00:00Z','{"pageId":null}');
  fs.writeFileSync(path.join(folder,'decisions.md'),'## 1. Choose the music\n');
  const s=new (require('../src/lib/task-board.cjs').TaskBoard)(home,{profile:home,clock:()=>now}).connect(folder),R=require('../public/r4-core.js'),agents=[{observedSteps:100,completedSteps:100}];
  a.equal(s.deliveries.day,'2030-01-07');a.equal(s.deliveries.items.length,1);
  a.deepEqual(R.dailyTasks(s.tasks,s.deliveries.day).map(x=>x.id).sort(),['doing','done']);
  a.deepEqual(R.progress(s.tasks,agents,s.deliveries.day),{percent:70,method:'tasks',count:2});
  a.equal(s.tasks.find(x=>x.id==='doing').startedAt,'2030-01-07T01:30:00.000Z','an explicit start is normalized to the same UTC day');
  a.notEqual(R.progress(s.tasks,agents).percent,70,'the legacy calculation is the negative control: it includes the ineligible tasks');
});

test('daily progress deduplicates task IDs and never falls back to sessions when dates or task source are missing',()=>{
  const R=require('../public/r4-core.js'),day='2030-01-07',agents=[{observedSteps:100,completedSteps:100}],done={id:'done',title:'Fix jump',phase:{percent:100},completedAt:'2030-01-07T10:00:00Z'};
  a.equal(R.progress([],agents,day),null);a.equal(R.progress([done],agents,null),null);
  a.equal(R.progress([{...done,completedAt:'invalid'},{...done,completedAt:'2030-01-07T00:30:00+02:00'}],agents,day),null,'local date text alone is not the UTC date');
  a.deepEqual(R.progress([done,{...done}],agents,day),{percent:100,method:'tasks',count:1});
  a.deepEqual(R.progress([],agents),{percent:100,method:'steps',count:100,done:100},'the simulated/legacy contract stays available');
});

// Minimal attached tree for sync.js, so a removed element really disappears from getElementById.
function loadSync(source) {
  const make = (tag = 'div') => ({ tagName: String(tag).toUpperCase(), children: [], parent: null, dataset: {}, style: {}, attrs: {}, hidden: false, textContent: '', id: '', className: '', title: '',
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; },
    append(...xs) { for (const x of xs) { if (!x || typeof x !== 'object') continue; if (x.parent) x.parent.children = x.parent.children.filter((c) => c !== x); x.parent = this; this.children.push(x); } },
    remove() { if (this.parent) { this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; } } });
  const body = make('body'), actions = make('div'), footer = make('footer'); body.append(actions, footer);
  const find = (n, id) => (n.id === id ? n : n.children.reduce((hit, c) => hit || find(c, id), null));
  const document = { documentElement: { lang: 'en' }, body, createElement: make, getElementById: (id) => find(body, id), querySelector: (sel) => (sel === '.header-actions' ? actions : sel === 'footer' ? footer : null) };
  const window = { document, localStorage: { getItem: () => null, setItem() {} }, DuLofi: { init: () => ({ update() {} }) }, panelDrawer() {}, DuTips: { render() {} }, DuPrompts: [], PanelV2: { select() {} } };
  vm.runInNewContext(source, { window });
  return { window, document };
}

test('a reading with data no longer ends in the refresh failure after the header rebuild removes the feed button', () => {
  const source = fs.readFileSync(path.join(root, 'public/sync.js'), 'utf8');
  a.match(fs.readFileSync(path.join(root, 'public/r9.js'), 'utf8'), /actions\.replaceChildren\(tools,end\);\s*if\(\$\('feed-trigger'\)\)/, 'r9 rebuilds the header before it looks for the feed button');
  const current = loadSync(source);
  current.document.getElementById('feed-trigger').remove();
  a.doesNotThrow(() => current.window.DuSync.update({ usage: {} }, 'en'));
  a.equal(current.document.getElementById('help-trigger').title, 'What each button does');
  // Negative control, in memory only: the r9 describe() throws on every reading with data.
  const guard = 'function describe(node,text){if(!node)return;';
  a.equal(source.split(guard).length - 1, 1);
  const r9Bytes = loadSync(source.replace(guard, 'function describe(node,text){'));
  r9Bytes.document.getElementById('feed-trigger').remove();
  a.throws(() => r9Bytes.window.DuSync.update({ usage: {} }, 'en'), { name: 'TypeError', message: "Cannot set properties of null (setting 'title')" });
});

test('before the first answer the cards keep their final labels and give no instruction; a failed first reading goes to the reading strip', () => {
  const source = fs.readFileSync(path.join(root, 'public/v2.js'), 'utf8'), v = loadViews(source), calls = [];
  v.window.PanelR4 = { loading(l) { calls.push('loading:' + l); }, failed(l) { calls.push('failed:' + l); } };
  v.window.PanelV2.loading('en');
  const text = (id) => v.node(id).textContent;
  a.equal(text('waiting-action'), ''); a.equal(text('deadline-action'), ''); a.equal(text('deadline-label'), 'What you finished'); a.equal(text('status'), ''); a.equal(v.node('progress-note').hidden, true);
  for (const id of ['waiting-question', 'deadline-title']) a.equal(text(id), '', 'no second placeholder next to the card dots');
  v.window.PanelV2.failure();
  a.equal(text('status'), '', 'the strip carries the failure, not a second message');
  a.deepEqual(calls, ['loading:en', 'failed:en']);
  v.window.PanelV2.loading('pt');
  a.deepEqual(calls.slice(-2), ['loading:pt', 'failed:pt'], 'a language change keeps the failure visible');
  a.equal(text('deadline-label'), 'O que ficou pronto');
});

test('initial state without data paints the loading views; the r9 collection failure is the unguarded snapshot read', () => {
  const source = fs.readFileSync(path.join(root, 'public/v2.js'), 'utf8');
  const current = loadViews(source);
  a.doesNotThrow(() => current.window.PanelV2.loading('en'));
  a.equal(current.stage().children.length, 1, 'the empty stage is drawn before r9 places its skeletons');
  current.window.PanelV2.select('team');
  a.doesNotThrow(() => current.window.PanelV2.loading('pt'), 'Team opened before the first answer, then a language change');
  // Negative controls, in memory only: each removed guard brings back the exact r9 error.
  const keyGuard = 'snapshot?.usage?.oldConversations?.total,list.map';
  a.equal(source.split(keyGuard).length - 1, 1);
  const r9Failure = loadViews(source.replace(keyGuard, 'snapshot.usage?.oldConversations?.total,list.map'));
  a.throws(() => r9Failure.window.PanelV2.loading('en'), { name: 'TypeError', message: "Cannot read properties of null (reading 'usage')" });
  const teamGuard = "tab==='team'&&snapshot?.usage?.oldConversations?.total";
  a.equal(source.split(teamGuard).length - 1, 1);
  const teamFailure = loadViews(source.replace(teamGuard, "tab==='team'&&snapshot.usage?.oldConversations?.total"));
  a.doesNotThrow(() => teamFailure.window.PanelV2.loading('en'));
  teamFailure.window.PanelV2.select('team');
  a.throws(() => teamFailure.window.PanelV2.loading('en'), { name: 'TypeError', message: "Cannot read properties of null (reading 'usage')" });
});

// Compiles a reader source next to the real one, in memory, so its siblings resolve normally.
function loadReader(source) {
  const file = path.join(root, 'src/lib/usage.cjs'), m = new Module(file, module);
  m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file)); m._compile(source, file);
  return m.exports.Metrics;
}
async function previewsBeforeProcessAnswer(Metrics, t, waitMs) {
  const home = fixture(t), live = uuid(1), other = uuid(2), fresh = uuid(3);
  write(home, live, content(live), 10 * day); const excluded = write(home, other, content(other), 10 * day); write(home, fresh, content(fresh), 60000);
  let answer; const gate = new Promise((resolve) => { answer = resolve; });
  const opened = [], open = fs.promises.open;
  fs.promises.open = async (file, ...args) => { if (String(file).endsWith('.jsonl')) opened.push(String(file)); return open(file, ...args); };
  try {
    const m = new Metrics(home, { clock: () => now, cacheDir: path.join(home, 'cache'), processReader: () => gate.then(() => ({ codex: 1, claude: 0, liveSessionKeys: [key(live)] })) });
    m.refresh().catch(() => {});
    let early = m.snapshot();
    for (const until = Date.now() + waitMs; Date.now() < until && !early.previewSessions.length;) { await new Promise((r) => setTimeout(r, 10)); early = m.snapshot(); }
    answer();
    for (const until = Date.now() + 15000; Date.now() < until && (m.pending || m.running);) await new Promise((r) => setTimeout(r, 10));
    clearTimeout(m.nextRound);
    return { early, final: m.snapshot(), opened, excluded };
  } finally { fs.promises.open = open; answer(); }
}

test('a slow process source no longer holds the first previews; publication still waits for it and keeps the live older conversation', async (t) => {
  const Metrics = require('../src/lib/usage.cjs').Metrics;
  const r = await previewsBeforeProcessAnswer(Metrics, t, 3000);
  a.ok(r.early.previewSessions.length >= 1, 'a fresh conversation previews before the process source answers');
  a.equal(r.early.ready, false, 'no publication before the process answer');
  a.equal(r.early.processes, null);
  a.equal(r.final.ready, true);
  a.equal(r.final.sessions.length, 2, 'fresh and live older conversation, nothing else');
  a.equal(r.final.sessions.filter((s) => s.processAlive === true).length, 1);
  a.equal(r.final.oldConversations.total, 1, 'the unbound older conversation stays counted only');
  a.ok(!r.opened.includes(r.excluded), 'the unbound older conversation is never opened');
  // Negative control, in memory only: the r9 wait before discovery holds every preview.
  const source = fs.readFileSync(path.join(root, 'src/lib/usage.cjs'), 'utf8'), at = 'if(this.scopeChanged){await this.discovery';
  a.equal(source.split(at).length - 1, 1);
  const blocking = await previewsBeforeProcessAnswer(loadReader(source.replace(at, 'if(this.processPromise)await this.processPromise;\n      ' + at)), t, 1500);
  a.equal(blocking.early.previewSessions.length, 0, 'the blocking order shows nothing before the process answer');
  a.equal(blocking.final.ready, true);
});

test('when the process source fails, a discovery that started without it still finishes as unknown', async (t) => {
  const Metrics = require('../src/lib/usage.cjs').Metrics, home = fixture(t), old = uuid(4), fresh = uuid(5);
  write(home, old, content(old), 10 * day); write(home, fresh, content(fresh), 60000);
  const m = new Metrics(home, { clock: () => now, cacheDir: path.join(home, 'cache'), processReader: () => new Promise((resolve, reject) => setTimeout(() => reject(Error('Unavailable')), 50)) });
  m.refresh().catch(() => {});
  for (const until = Date.now() + 15000; Date.now() < until && (m.pending || m.running || !m.published);) await new Promise((r) => setTimeout(r, 10));
  clearTimeout(m.nextRound);
  const s = m.snapshot();
  a.equal(s.ready, true); a.equal(s.processes, null); a.equal(s.sessions.length, 1); a.equal(s.oldConversations.total, 1);
});

function loadBoard(source) {
  const file = path.join(root, 'src/lib/task-board.cjs'), m = new Module(file, module);
  m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file)); m._compile(source, file);
  return m.exports.TaskBoard;
}
test('a connected task folder shows no empty card and never invents an owner or an executor', (t) => {
  const home = fixture(t), folder = path.join(home, 'tasks'); fs.mkdirSync(folder);
  const at = '2030-01-07T10:00:00Z', file = (name, head, heading) => fs.writeFileSync(path.join(folder, name), '---\n' + head + '\n---\n# ' + heading + '\n');
  file('jump.md', 'id: jump\nphase: done\ncompleted_at: ' + at, 'Fix the game jump');
  file('json.md', 'id: json\nphase: done\ncompleted_at: ' + at, '{"pageId":null}');
  file('mine.md', 'id: mine\nphase: doing\nowner: Ana\nexecutor: codex', 'Draw the menu');
  const source = fs.readFileSync(path.join(root, 'src/lib/task-board.cjs'), 'utf8');
  const s = new (loadBoard(source))(home, { profile: home, clock: () => now }).connect(folder);
  a.deepEqual(s.tasks.map((x) => x.title).sort(), ['Draw the menu', 'Fix the game jump']);
  const jump = s.tasks.find((x) => x.id === 'jump'), mine = s.tasks.find((x) => x.id === 'mine');
  a.equal(jump.owner, null); a.equal(jump.executor, null);
  a.equal(mine.owner, 'Ana'); a.equal(mine.executor, 'codex');
  a.equal(s.deliveries.items.length, 1);
  // Negative control, in memory only: the r9 board keeps an empty card and invents TEAM and Claude Code.
  const start = source.indexOf('task.title=title(task.title);if('), mark = 'if(task.title)tasks.push(task);}', end = source.indexOf(mark, start) + mark.length;
  a.ok(start > 0 && end > start);
  const negativeProfile = fixture(t);
  const r9 = new (loadBoard(source.slice(0, start) + 'task.title=title(task.title);tasks.push(task);}' + source.slice(end)))(negativeProfile, { profile: negativeProfile, clock: () => now }).connect(folder);
  a.ok(r9.tasks.some((x) => x.title === ''), 'r9 shows the JSON task as an empty card');
  a.equal(r9.tasks.find((x) => x.id === 'jump').owner, 'TEAM');
  a.equal(r9.tasks.find((x) => x.id === 'jump').executor, 'claude');
  a.equal(r9.deliveries.items.length, 1, 'the delivered count was already right; only the board changed');
});
