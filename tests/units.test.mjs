import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateUnits, loadUnits, unitById } from '../viewer/units.js';

const unit = (over = {}) => ({ id: 'u1', bhk: 2, type: '2 BHK', label: '2 BHK + 2 toilets', plan: 'Type X', tower: 'Tower A', unitsRange: 'A 1 to A 2', floors: '2 to 4', sba: 1000, carpet: 600, balcony: 30, beds: 2, baths: 2,
  entry: { x: 1, y: 2, dir: 'up' }, rooms: [{ name: 'Living', x: 0, y: 0, w: 4, h: 3 }, { name: 'Balcony', x: 4, y: 0, w: 1, h: 3, kind: 'out' }], ...over });
const doc = (...units) => ({ source: 's', asOf: '2026-10-25', note: 'n', units });
const errs = d => validateUnits(d).errors.join(' | ');

test('a valid document passes and returns its units', () => {
  const r = validateUnits(doc(unit())); assert.equal(r.ok, true); assert.deepEqual(r.errors, []); assert.equal(r.units.length, 1);
});
test('each rule fails with a named error', () => {
  assert.match(errs({}), /units/); assert.match(errs({ units: [] }), /units/); assert.match(errs(null), /units/);
  assert.match(errs(doc(unit(), unit())), /duplicate id u1/);
  assert.match(errs(doc(unit({ rooms: [{ name: 'X', x: 0, y: 0, w: 0, h: 3 }] }))), /u1.*room.*size/i);
  assert.match(errs(doc(unit({ rooms: [{ name: 'X', x: NaN, y: 0, w: 1, h: 3 }] }))), /u1.*room.*coordinate/i);
  assert.match(errs(doc(unit({ carpet: 1200 }))), /u1.*carpet/);
  assert.match(errs(doc(unit({ entry: { x: 1, y: 1, dir: 'north' } }))), /u1.*entry/);
  assert.match(errs(doc(unit({ tower: '' }))), /u1.*tower/);
  assert.match(errs(doc(unit({ price: 5 }))), /u1.*price/); assert.match(errs(doc(unit({ cost: 5 }))), /u1.*cost/); assert.match(errs(doc(unit({ availability: 'a' }))), /u1.*availability/);
  assert.equal(validateUnits(doc(unit({ price: 5 }))).ok, false); assert.deepEqual(validateUnits(doc(unit({ price: 5 }))).units, []);
});
test('units sort by bhk then sba (3.5 BHK after 3 BHK)', () => {
  const r = validateUnits(doc(unit({ id: 'c', bhk: 3.5, sba: 2000 }), unit({ id: 'a', bhk: 1, sba: 700 }), unit({ id: 'b2', bhk: 3, sba: 1800 }), unit({ id: 'b1', bhk: 3, sba: 1400 })));
  assert.deepEqual(r.units.map(u => u.id), ['a', 'b1', 'b2', 'c']);
});
test('unitById finds a unit or returns null', () => {
  const us = validateUnits(doc(unit())).units; assert.equal(unitById(us, 'u1').id, 'u1'); assert.equal(unitById(us, 'nope'), null); assert.equal(unitById(undefined, 'u1'), null);
});
async function warns(fetchFn) {
  const orig = console.warn, seen = []; console.warn = (...a) => seen.push(a.join(' '));
  try { const r = await loadUnits('x/units.json', fetchFn); return { r, n: seen.length }; } finally { console.warn = orig; }
}
test('loadUnits resolves [] and warns once on 404, non-JSON, a thrown fetch and an invalid document', async () => {
  for (const f of [async () => ({ ok: false, status: 404 }), async () => ({ ok: true, json: async () => { throw new SyntaxError('x'); } }), async () => { throw new Error('offline'); }, async () => ({ ok: true, json: async () => ({}) })]) {
    const { r, n } = await warns(f); assert.deepEqual(r, []); assert.equal(n, 1);
  }
});
test('loadUnits returns the validated, sorted units for a good document', async () => {
  const { r, n } = await warns(async () => ({ ok: true, json: async () => doc(unit({ id: 'b', bhk: 3 }), unit({ id: 'a', bhk: 1 })) })); assert.deepEqual(r.map(u => u.id), ['a', 'b']); assert.equal(n, 0);
});

// ---- the real Belvedere data ----
const real = JSON.parse(fs.readFileSync(new URL('../projects/belvedere/units.json', import.meta.url), 'utf8'));
test('Belvedere units.json validates and has exactly the 5 traced types', () => {
  const r = validateUnits(real); assert.equal(r.ok, true, r.errors.join(' | ')); assert.deepEqual(r.units.map(u => u.id), ['1c', '2l', '3g', '3p', '3s']);
});
test('Belvedere units.json: no availability, no price words, published areas present', () => {
  const text = JSON.stringify(real); assert.doesNotMatch(text, /"availability"/); assert.doesNotMatch(text, /₹|price|lakh|crore/i);
  for (const u of real.units) for (const k of ['sba', 'carpet', 'balcony']) assert.ok(u[k] > 0, u.id + ' ' + k);
});
test('Belvedere units.json: rooms within a unit do not overlap', () => {
  for (const u of real.units) for (let i = 0; i < u.rooms.length; i++) for (let j = i + 1; j < u.rooms.length; j++) {
    const a = u.rooms[i], b = u.rooms[j], w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    assert.ok(!(w > 0.01 && h > 0.01), `${u.id}: "${a.name}" overlaps "${b.name}" by ${w.toFixed(2)} x ${h.toFixed(2)} m`);
  }
});
