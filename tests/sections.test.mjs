import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_VIEW, resolveSections, resolveView } from '../viewer/sections.js';

const on = { experience: true }, off = { experience: false };
const ids = s => s.map(x => x.id);

test('experience off => no sections at all', () => {
  assert.deepEqual(resolveSections(off, { tours: [{ id: 't' }] }), []);
  assert.deepEqual(resolveSections({}, {}), []); assert.deepEqual(resolveSections(undefined, undefined), []);
});
test('experience on with tours => masterplan then tours, with labels', () => {
  const s = resolveSections(on, { tours: [{ id: 't' }] });
  assert.deepEqual(ids(s), ['masterplan', 'tours']); assert.deepEqual(s.map(x => x.label), ['Master plan', 'Tours']);
});
test('experience on without tours (absent or empty) => masterplan only', () => {
  assert.deepEqual(ids(resolveSections(on, {})), ['masterplan']);
  assert.deepEqual(ids(resolveSections(on, { tours: [] })), ['masterplan']);
});
test('DEFAULT_VIEW is masterplan', () => assert.equal(DEFAULT_VIEW, 'masterplan'));
test('resolveView: a present id wins; an unknown or missing one falls back to the default', () => {
  const s = resolveSections(on, { tours: [{ id: 't' }] });
  assert.equal(resolveView('tours', s), 'tours');
  for (const bad of ['surroundings', 'bogus', '', undefined, null]) assert.equal(resolveView(bad, s), 'masterplan', String(bad));
});
test('resolveView with no sections is the empty string (shell off)', () => {
  assert.equal(resolveView('tours', []), ''); assert.equal(resolveView(undefined, []), '');
});
