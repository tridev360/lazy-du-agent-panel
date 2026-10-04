'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto'), vm = require('node:vm');
const { createServer } = require('../src/panel.cjs');
const { buildTutorialManifest, mp4Duration, validVtt } = require('../src/tutorial-manifest.cjs');
const { tutorialFor, durationText } = require('../public/tutorial264.js');
const releaseConfig = require('../src/tutorial-releases.cjs');
const ROOT = path.join(__dirname, '..'), PUBLIC = path.join(ROOT, 'public');
const VIDEO = '/tutorial-painel/tutorial.pt.mp4', CAPTIONS = '/tutorial-painel/tutorial.pt.vtt';
const VIDEO_SHA = 'be14748ec977492e80df5eb3ca50a2f8c783b201e7d61b2e4759129ad922da8b';
const CAPTIONS_SHA = '49d9ed65525afc6f9f3ec1818a53e7bbf19c36390ce105706494552d95b4bf56';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function temporary(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'panel-tutorial-release-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  return folder;
}
function copiedAssets(t) {
  const folder = temporary(t), publicDir = path.join(folder, 'public');
  fs.mkdirSync(path.join(publicDir, 'tutorial-painel'), { recursive: true });
  for (const asset of [VIDEO, CAPTIONS]) fs.copyFileSync(path.join(PUBLIC, asset), path.join(publicDir, asset));
  return { folder, publicDir };
}
async function server(t, options = {}) {
  const instance = createServer({ demoOnly: true, offline: true, profile: temporary(t), ...options });
  await new Promise(resolve => instance.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => instance.close(resolve)));
  return asset => fetch('http://127.0.0.1:' + instance.address().port + asset);
}
async function manifest(get) {
  const response = await get('/tutorial-manifest.js');
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const context = { window: {} }; vm.runInNewContext(await response.text(), context);
  return JSON.parse(JSON.stringify(context.window.PanelTutorialManifest));
}
async function closed(get) {
  assert.deepEqual(await manifest(get), { version: 1, tutorials: {} });
  for (const asset of [VIDEO, CAPTIONS]) assert.equal((await get(asset)).status, 404, asset + ' stays closed');
}
test('the installed default exposes the approved PT release with measured duration and exact local bytes', async t => {
  const get = await server(t), value = await manifest(get), entry = tutorialFor(value, 'pt-BR');
  assert.ok(entry); assert.deepEqual(Object.keys(value.tutorials), ['pt']);
  assert.equal(entry.durationSeconds, 103.2); assert.equal(durationText(entry.durationSeconds), '1 min 43 s');
  assert.equal(entry.video.bytes, 3111852); assert.equal(entry.subtitle.bytes, 1993);
  for (const [asset, expectedHash, type] of [[VIDEO, VIDEO_SHA, 'video/mp4'], [CAPTIONS, CAPTIONS_SHA, 'text/vtt; charset=utf-8']]) {
    const response = await get(asset); assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(response.headers.get('content-type'), type);
    const body = Buffer.from(await response.arrayBuffer()); assert.equal(sha(body), expectedHash);
    assert.deepEqual(body, fs.readFileSync(path.join(PUBLIC, asset)));
  }
});
test('the approved release still passes the unchanged MP4 and VTT validators', () => {
  const video = fs.readFileSync(path.join(PUBLIC, VIDEO)), captions = fs.readFileSync(path.join(PUBLIC, CAPTIONS), 'utf8');
  assert.equal(mp4Duration(video), 103.2); assert.equal(validVtt(captions, 103.2), true);
  assert.equal(buildTutorialManifest({ publicDir: PUBLIC, ...releaseConfig }).tutorials.pt.video.sha256, VIDEO_SHA);
});
test('EN and ES have no release, no PT fallback and no media route', async t => {
  const get = await server(t), value = await manifest(get);
  for (const language of ['en', 'es']) {
    assert.equal(tutorialFor(value, language), null); assert.equal(value.tutorials[language], undefined);
    for (const extension of ['mp4', 'vtt']) assert.equal((await get('/tutorial-painel/tutorial.' + language + '.' + extension)).status, 404);
  }
});
for (const asset of [VIDEO, CAPTIONS]) {
  test('removing ' + path.basename(asset) + ' closes both assets after an earlier successful read', async t => {
    const f = copiedAssets(t), get = await server(t, { tutorialOptions: { publicDir: f.publicDir } });
    assert.ok((await manifest(get)).tutorials.pt); assert.equal((await get(asset)).status, 200);
    fs.unlinkSync(path.join(f.publicDir, asset)); await closed(get);
  });
  test('changing ' + path.basename(asset) + ' closes both assets without restarting', async t => {
    const f = copiedAssets(t), get = await server(t, { tutorialOptions: { publicDir: f.publicDir } });
    assert.ok((await manifest(get)).tutorials.pt);
    fs.appendFileSync(path.join(f.publicDir, asset), Buffer.from('\nchanged\n')); await closed(get);
  });
}
test('an explicit empty release configuration remains closed even with the approved files present', async t => {
  await closed(await server(t, { tutorialOptions: { releases: [] } }));
});
test('both README thumbnails use the same shipped PT video and an existing PNG', () => {
  const thumbnail = fs.readFileSync(path.join(PUBLIC, '/tutorial-painel/tutorial.pt.png'));
  assert.deepEqual([...thumbnail.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(thumbnail.readUInt32BE(16), 1280); assert.equal(thumbnail.readUInt32BE(20), 720);
  for (const file of ['README.md', 'README.pt-BR.md']) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.ok(text.includes('](public/tutorial-painel/tutorial.pt.png)](public/tutorial-painel/tutorial.pt.mp4)'));
    assert.ok(text.includes('](public/tutorial-painel/tutorial.pt.vtt)'));
  }
});
