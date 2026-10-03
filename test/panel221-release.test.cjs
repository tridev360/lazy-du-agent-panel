'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Bell = require('../public/bell.js');
const { WORDS } = require('../public/onboarding22.js');
const { guidedChecks } = require('../tools/validate-runtime.cjs');

function unreadAfterUpdate(version, marks) {
  const storage = new Map([
    [Bell.KEYS.read, JSON.stringify([...marks, 'recommendations-' + version])],
    [Bell.KEYS.used, JSON.stringify(Object.fromEntries(Bell.FEATURES.map(id => [id, true])))]
  ]);
  const node = () => ({ append() {}, setAttribute() {}, dataset: {} });
  const root = {
    document: { createElement: node, addEventListener() {}, getElementById() { return null; } },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  };
  const source = fs.readFileSync(require.resolve('../public/bell.js'), 'utf8')
    .replace("const VERSION='" + Bell.VERSION + "';", "const VERSION='" + version + "';");
  vm.runInNewContext(source, { window: root, globalThis: root });
  return root.PanelBell.unread();
}

test('an already read 2.1 note stays read across release updates in the browser', () => {
  for (const mark of ['version-2.1', 'version-2.1.0', 'version-2.1.1', 'version-2.2.0']) {
    assert.equal(unreadAfterUpdate(Bell.VERSION, [mark]), 0, mark);
  }
  assert.equal(unreadAfterUpdate('2.2.2', ['version-2.2.1']), 0);
  assert.equal(unreadAfterUpdate(Bell.VERSION, []), 1, 'a new profile still sees the version note');
  assert.ok(Bell.readMarks(['author-note', 'version-2.2.0']).includes('author-note'));
});

test('2.2 patch releases keep all four guided interaction validations', () => {
  const expected = [
    'validate-guidance22.cjs', 'validate-onboarding22.cjs',
    'validate-session-copy22.cjs', 'validate-connect22.cjs'
  ];
  for (const version of ['2.2.0', '2.2.1', '2.2.10']) assert.deepEqual(guidedChecks(version), expected);
  for (const version of ['2.1.1', '2.2', '2.2.01', '2.2.1-other', null]) assert.deepEqual(guidedChecks(version), []);
});

test('first steps allow a few minutes without a three-minute upper bound', () => {
  for (const [lang, phrase] of [['en', 'a few minutes'], ['pt', 'alguns minutos'], ['es', 'unos minutos']]) {
    assert.ok(WORDS[lang].wait.includes(phrase), lang);
    assert.doesNotMatch(WORDS[lang].wait, /\d/);
  }
});
