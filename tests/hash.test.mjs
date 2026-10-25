import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHash, formatHash } from '../viewer/hash.js';

test('parse legacy links: #h=<id> and #tour=<id>', () => {
  assert.deepEqual(parseHash('#h=entrance-portal'), { h: 'entrance-portal' });
  assert.deepEqual(parseHash('#tour=overview'), { tour: 'overview' });
});
test('round trip survives encoding of reserved characters', () => {
  const id = 'a b&c%d=e';
  assert.deepEqual(parseHash(formatHash({ h: id })), { h: id });
  assert.deepEqual(parseHash(formatHash({ view: 'tours', tour: id })), { view: 'tours', tour: id });
});
test('exact keys only: no substring matching, unknown keys dropped, first duplicate wins', () => {
  assert.deepEqual(parseHash('#xh=1&h=ok'), { h: 'ok' });
  assert.deepEqual(parseHash('#foo=1&h=a&h=b&bar'), { h: 'a' });
});
test('empty and odd input parse to {}', () => {
  for (const s of ['', '#', undefined, null, '#&&', '#h=', '#=x']) assert.deepEqual(parseHash(s), {}, String(s));
});
test('malformed percent-encoding does not throw (raw text is kept)', () => {
  assert.deepEqual(parseHash('#h=%E0%A4%A'), { h: '%E0%A4%A' });
});
test('format order is view, h, tour, plan; empties are skipped', () => {
  assert.equal(formatHash({ h: 'x', view: 'tours' }), '#view=tours&h=x');
  assert.equal(formatHash({ plan: '2l', tour: 't', h: 'x', view: 'v' }), '#view=v&h=x&tour=t&plan=2l');
  assert.equal(formatHash({}), ''); assert.equal(formatHash({ h: '' }), ''); assert.equal(formatHash(undefined), '');
});
test('legacy bytes: a lone h or tour formats exactly as before', () => {
  assert.equal(formatHash({ h: 'x' }), '#h=x');
  assert.equal(formatHash({ tour: 't' }), '#tour=t');
});
