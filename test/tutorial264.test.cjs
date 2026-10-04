'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { buildTutorialManifest, tutorialManifestScript, mp4Duration, validVtt, MAX_VIDEO_BYTES } = require('../src/tutorial-manifest.cjs');
const { tutorialFor, durationText } = require('../public/tutorial264.js');
const defaults = require('../public/tutorial-manifest.js');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function box(type, content) { const header = Buffer.alloc(8); header.writeUInt32BE(content.length + 8); header.write(type, 4); return Buffer.concat([header, content]); }
function movie(seconds = 2.4, version = 0, timescale = 1000) {
  const header = Buffer.alloc(version === 0 ? 100 : 112); header[0] = version;
  if (version === 0) { header.writeUInt32BE(timescale, 12); header.writeUInt32BE(Math.round(seconds * timescale), 16); }
  else { header.writeUInt32BE(timescale, 20); header.writeBigUInt64BE(BigInt(Math.round(seconds * timescale)), 24); }
  return Buffer.concat([box('ftyp', Buffer.from('isom0000isom')), box('moov', box('mvhd', header))]);
}
const captions = 'WEBVTT\n\n00:00.000 --> 00:02.000\nLegenda fictícia de teste.\n';
function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tutorial264-test-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'tutorial-painel'));
  const video = movie(), subtitle = Buffer.from(captions);
  fs.writeFileSync(path.join(dir, 'tutorial-painel', 'fixture.pt.mp4'), video);
  fs.writeFileSync(path.join(dir, 'tutorial-painel', 'fixture.pt.vtt'), subtitle);
  const release = { locale: 'pt', videoSrc: '/tutorial-painel/fixture.pt.mp4', subtitleSrc: '/tutorial-painel/fixture.pt.vtt', approval: { approvedByOwner: true, approvedAtUtc: '2026-10-03T00:00:00Z', videoSha256: sha(video), subtitleSha256: sha(subtitle) } };
  return { dir, video, subtitle, release, build: (...releases) => buildTutorialManifest({ publicDir: dir, releases }) };
}
test('default manifest and absent media leave all languages unavailable', () => {
  for (const locale of ['pt', 'en', 'es']) assert.equal(tutorialFor(defaults, locale), null);
  assert.deepEqual(buildTutorialManifest(), { version: 1, tutorials: {} });
});
test('MP4 duration is read from both movie-header formats', () => {
  assert.equal(mp4Duration(movie(95)), 95); assert.equal(mp4Duration(movie(2.4, 1)), 2.4);
});
test('damaged, truncated and zero-timescale movies have no duration', () => {
  assert.equal(mp4Duration(Buffer.from('not a movie')), null);
  assert.equal(mp4Duration(movie().subarray(0, 19)), null);
  assert.equal(mp4Duration(movie(0)), null); assert.equal(mp4Duration(movie(2, 0, 0)), null);
});
test('duration label uses the measured value and does not invent zero', () => {
  assert.equal(durationText(95), '1 min 35 s'); assert.equal(durationText(2.4), '2 s');
  for (const bad of [null, undefined, 0, -2, NaN, Infinity]) assert.equal(durationText(bad), null);
});
test('only valid WebVTT cues inside the movie duration pass', () => {
  assert.equal(validVtt(captions, 2.4), true);
  for (const text of ['SRT\n\n00:00.000 --> 00:01.000\nText', 'WEBVTT\n\n00:03.000 --> 00:04.000\nText', 'WEBVTT\n\n00:01.000 --> 00:00.000\nText', 'WEBVTT\n\n00:00.000 --> 00:01.000\n', 'WEBVTT\n\n00:67.000 --> 00:68.000\nText']) assert.equal(validVtt(text, 2.4), false);
});
test('both local final files and matching owner approval expose PT only', t => {
  const f = setup(t), manifest = f.build(f.release), entry = tutorialFor(manifest, 'pt-BR');
  assert.equal(entry.durationSeconds, 2.4); assert.equal(entry.video.bytes, f.video.length);
  assert.equal(tutorialFor(manifest, 'en'), null); assert.equal(tutorialFor(manifest, 'es'), null);
  assert.equal(JSON.stringify(manifest).includes('approvedAtUtc'), false, 'Private approval details must not enter the browser manifest');
});
test('a caption file alone cannot enable the tutorial', t => {
  const f = setup(t); fs.unlinkSync(path.join(f.dir, 'tutorial-painel', 'fixture.pt.mp4'));
  assert.equal(tutorialFor(f.build(f.release), 'pt'), null);
});
test('existing files without an explicit final owner approval stay hidden', t => {
  const f = setup(t);
  for (const approval of [undefined, {}, { ...f.release.approval, approvedByOwner: false }, { ...f.release.approval, approvedAtUtc: 'not measured' }]) {
    assert.equal(tutorialFor(f.build({ ...f.release, approval }), 'pt'), null);
  }
});
test('any changed video or subtitle invalidates the inherited approval', t => {
  const f = setup(t); fs.appendFileSync(path.join(f.dir, 'tutorial-painel', 'fixture.pt.vtt'), '\nNOTE modified\n');
  assert.equal(tutorialFor(f.build(f.release), 'pt'), null);
  fs.writeFileSync(path.join(f.dir, 'tutorial-painel', 'fixture.pt.vtt'), f.subtitle);
  fs.writeFileSync(path.join(f.dir, 'tutorial-painel', 'fixture.pt.mp4'), movie(3));
  assert.equal(tutorialFor(f.build(f.release), 'pt'), null);
});
test('correct hashes cannot approve damaged media or invalid captions', t => {
  const f = setup(t), video = Buffer.from('invalid');
  fs.writeFileSync(path.join(f.dir, 'tutorial-painel', 'fixture.pt.mp4'), video);
  assert.equal(tutorialFor(f.build({ ...f.release, approval: { ...f.release.approval, videoSha256: sha(video) } }), 'pt'), null);
  fs.writeFileSync(path.join(f.dir, 'tutorial-painel', 'fixture.pt.mp4'), f.video);
  const subtitle = Buffer.from('WEBVTT\n\n00:00.000 --> 00:05.000\nToo late.\n');
  fs.writeFileSync(path.join(f.dir, 'tutorial-painel', 'fixture.pt.vtt'), subtitle);
  assert.equal(tutorialFor(f.build({ ...f.release, approval: { ...f.release.approval, subtitleSha256: sha(subtitle) } }), 'pt'), null);
});
test('MP4 above the package size limit stays unavailable', t => {
  const f = setup(t), filename = path.join(f.dir, 'tutorial-painel', 'fixture.pt.mp4');
  fs.truncateSync(filename, MAX_VIDEO_BYTES + 1);
  assert.equal(tutorialFor(f.build(f.release), 'pt'), null);
});
test('remote, traversal, query, encoded and wrong-extension sources fail closed', t => {
  const f = setup(t);
  for (const src of ['https://fixture.invalid/movie.mp4', '//fixture.invalid/movie.mp4', '/tutorial-painel/../movie.mp4', '/tutorial-painel/fixture.pt.mp4?x=1', '/tutorial-painel/%2e%2e.mp4', '/tutorial-painel/fixture.pt.vtt'])
    assert.equal(tutorialFor(f.build({ ...f.release, videoSrc: src }), 'pt'), null);
});
test('a symbolic link outside public cannot be included', t => {
  const f = setup(t), link = path.join(f.dir, 'tutorial-painel', 'linked.pt.mp4');
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'tutorial264-outside-')); t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  const real = path.join(outside, 'movie.mp4'); fs.writeFileSync(real, f.video); fs.symlinkSync(real, link);
  assert.equal(tutorialFor(f.build({ ...f.release, videoSrc: '/tutorial-painel/linked.pt.mp4' }), 'pt'), null);
});
test('EN and ES require their own enabled releases, never PT fallback', t => {
  const f = setup(t), en = { ...f.release, locale: 'en' }, es = { ...f.release, locale: 'es' };
  assert.equal(tutorialFor(f.build(en, es), 'en'), null);
  assert.equal(tutorialFor(buildTutorialManifest({ publicDir: f.dir, releases: [en, es], enabledLocales: ['en', 'es'] }), 'en'), null, 'A PT file cannot become an English tutorial');
  for (const release of [en, es]) {
    const language = release.locale;
    release.videoSrc = '/tutorial-painel/fixture.' + language + '.mp4'; release.subtitleSrc = '/tutorial-painel/fixture.' + language + '.vtt';
    fs.copyFileSync(path.join(f.dir, 'tutorial-painel', 'fixture.pt.mp4'), path.join(f.dir, 'tutorial-painel', 'fixture.' + language + '.mp4'));
    fs.copyFileSync(path.join(f.dir, 'tutorial-painel', 'fixture.pt.vtt'), path.join(f.dir, 'tutorial-painel', 'fixture.' + language + '.vtt'));
  }
  const next = buildTutorialManifest({ publicDir: f.dir, releases: [en, es], enabledLocales: ['en', 'es'] });
  assert.equal(tutorialFor(next, 'en')?.locale, 'en'); assert.equal(tutorialFor(next, 'es')?.locale, 'es');
  assert.equal(tutorialFor(next, 'pt'), null);
});
test('browser refuses a manifest missing availability proof or measured duration', t => {
  const f = setup(t), good = f.build(f.release);
  for (const change of [{ approvalMatched: false }, { durationSeconds: null }, { video: { ...good.tutorials.pt.video, src: 'https://fixture.invalid/clip.mp4' } }, { subtitle: null }, { locale: 'en' }])
    assert.equal(tutorialFor({ version: 1, tutorials: { pt: { ...good.tutorials.pt, ...change } } }, 'pt'), null);
});
test('the local script is regenerated from current assets and carries no approval receipt', t => {
  const f = setup(t), options = { publicDir: f.dir, releases: [f.release] }, vm = require('node:vm');
  const scope = { window: {} }; vm.runInNewContext(tutorialManifestScript(options), scope);
  assert.equal(scope.window.PanelTutorialManifest.tutorials.pt.durationSeconds, 2.4);
  assert.equal(tutorialManifestScript(options).includes('approvedAtUtc'), false);
  fs.unlinkSync(path.join(f.dir, 'tutorial-painel', 'fixture.pt.mp4'));
  vm.runInNewContext(tutorialManifestScript(options), scope);
  assert.equal(Object.keys(scope.window.PanelTutorialManifest.tutorials).length, 0);
});
