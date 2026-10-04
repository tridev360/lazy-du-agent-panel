'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { UsageIndex } = require('../src/lib/usage.cjs');
const { metadataStory, key } = require('../src/lib/session-story.cjs');
const { metadata, publicMetadata } = require('../src/lib/agent-metadata.cjs');
const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];
const at = '2030-01-07T12:00:00Z';
const row = payload => JSON.stringify({ type: 'session_meta', timestamp: at, payload });
test('flat and nested Codex parents produce the same opaque relation', () => {
  for (const extra of [{ parent_thread_id: ids[0] }, { source: { subagent: { parent_thread_id: ids[0] } } }, { source: { subagent: { thread_spawn: { parent_thread_id: ids[0] } } } }]) {
    const m = metadataStory(row({ id: ids[1], ...extra }));
    assert.equal(m.parentKey, key(ids[0])); assert.equal(m.helper, true);
    assert.doesNotMatch(JSON.stringify(m), new RegExp(ids[0]));
  }
});
test('actual reader preserves a flat helper parent without connecting unrelated work', () => {
  const index = new UsageIndex();
  for (const [n, id] of ids.entries()) index.consume('codex', 'fixture-' + n, row({ id, model: 'gpt-6.1-sol', ...(n === 1 ? { parent_thread_id: ids[0] } : {}), instructions: 'PRIVATE_BODY_CANARY', cwd: '/projects/Example' }));
  const sessions = index.snapshot(new Date('2030-01-07T12:01:00Z')).sessions;
  assert.equal(sessions.find(s => s.sessionKey === key(ids[1])).parentKey, key(ids[0]));
  assert.equal(sessions.find(s => s.sessionKey === key(ids[2])).parentKey, null);
  assert.doesNotMatch(JSON.stringify(sessions), /PRIVATE_BODY_CANARY|11111111-1111/);
});
test('copied ancestral session metadata does not replace a helper opening', () => {
  const first = metadataStory(row({ id: ids[1], parent_thread_id: ids[0] }));
  const copied = metadataStory(row({ id: ids[0], parent_thread_id: ids[2] }), first);
  assert.equal(copied.parentKey, undefined); assert.equal(copied.sessionKey, undefined);
});
test('public tool reader already supports full collaboration names and drops arguments', () => {
  const m = metadata(JSON.stringify({ type: 'response_item', timestamp: at, payload: { type: 'function_call', name: 'collaboration.spawn_agent', call_id: 'synthetic-call', arguments: '{"message":"PRIVATE_ARGS_CANARY"}' } }));
  assert.deepEqual(publicMetadata(m).tools, [{ name: 'collaboration.spawn_agent', count: 1 }]);
  assert.doesNotMatch(JSON.stringify(publicMetadata(m)), /PRIVATE_ARGS_CANARY|synthetic-call/);
});
