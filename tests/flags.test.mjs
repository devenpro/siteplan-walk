import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULES, resolveFlags } from '../viewer/flags.js';

const allOff = f => MODULES.every(m => f[m] === false);

test('defaults: no flags anywhere => every module false', () => {
  assert.ok(allOff(resolveFlags({}, '')));
  assert.deepEqual(Object.keys(resolveFlags({}, '')).sort(), [...MODULES].sort());
});
test('site.flags turns a module on', () => {
  const f = resolveFlags({ flags: { experience: true } }, '');
  assert.equal(f.experience, true); assert.equal(f.context, false);
});
test('?mods= adds modules', () => {
  const f = resolveFlags({}, '?mods=experience,context');
  assert.equal(f.experience, true); assert.equal(f.context, true); assert.equal(f.plans, false);
});
test('?mods=none beats site flags that are true', () => {
  assert.ok(allOff(resolveFlags({ flags: { experience: true, context: true } }, '?mods=none')));
});
test('junk is ignored: unknown names, stray commas, spaces, non-boolean site values', () => {
  const f = resolveFlags({ flags: { plans: 'yes', location: 1 } }, '?mods=,,bogus, experience ,');
  assert.equal(f.experience, true);
  for (const m of MODULES.filter(m => m !== 'experience')) assert.equal(f[m], false, m);
});
test('?mods= names that are Object prototype members add nothing', () => {
  const f = resolveFlags({}, '?mods=constructor,__proto__,toString');
  assert.deepEqual(Object.keys(f).sort(), [...MODULES].sort()); assert.ok(allOff(f));
});
test('undefined site and an empty or odd search do not throw', () => {
  assert.ok(allOff(resolveFlags(undefined, '')));
  assert.ok(allOff(resolveFlags(null, undefined)));
  assert.ok(allOff(resolveFlags({ flags: null }, '?q=low&mods=')));
});
