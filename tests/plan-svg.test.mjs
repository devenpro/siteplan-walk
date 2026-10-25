import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { escapeXml, unitExtent, planViewBox, planSvg } from '../viewer/plan-svg.js';

const real = JSON.parse(fs.readFileSync(new URL('../projects/belvedere/units.json', import.meta.url), 'utf8')).units;
const byId = id => real.find(u => u.id === id);
const mk = (rooms, entry = { x: 1, y: 1, dir: 'up' }) => ({ id: 't', type: '2 BHK', plan: 'Type T', rooms, entry });
const count = (s, re) => (s.match(re) || []).length;

test('escapeXml escapes the five markup characters', () => assert.equal(escapeXml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;'));
test('unitExtent is the metres bounding box of the rooms (2L is 11.83 x 8.52)', () => {
  const e = unitExtent(byId('2l')); assert.ok(Math.abs(e.w - 11.83) < 0.005 && Math.abs(e.h - 8.52) < 0.005, JSON.stringify(e));
});
test('one rect per room for every real unit; markup is balanced', () => {
  for (const u of real) {
    const s = planSvg(u); assert.equal(count(s, /<rect /g), u.rooms.length, u.id);
    assert.equal(count(s, /<svg /g), 1); assert.equal(count(s, /<\/svg>/g), 1);
    assert.equal(count(s, /<text[ >]/g), count(s, /<\/text>/g), u.id); assert.equal(count(s, /<tspan[ >]/g), count(s, /<\/tspan>/g), u.id);
    assert.equal(count(s, /<title>/g), count(s, /<\/title>/g), u.id);
  }
});
test('mini drops every label, the entry arrow and the scale bar', () => {
  const s = planSvg(byId('2l'), { mini: true }); assert.equal(count(s, /<text/g), 0); assert.doesNotMatch(s, />ENTRY<|>5 m<|pscale|pentry/); assert.equal(count(s, /<rect /g), 8);
});
test('full plan carries room labels with dimensions, ENTRY and a 5 m scale bar', () => {
  const s = planSvg(byId('2l')); assert.match(s, /MASTER BEDROOM/); assert.match(s, /3\.35 × 3\.58 m/); assert.match(s, /ENTRY/); assert.match(s, />5 m</);
});
test('room names are text, never markup (the real data has "Living & dining")', () => {
  const s = planSvg(mk([{ name: 'A & <b>"x"</b>', x: 0, y: 0, w: 6, h: 5 }]));
  assert.doesNotMatch(s, /<b>/); assert.match(s, /A &amp; &lt;b&gt;&quot;x&quot;&lt;\/b&gt;/);   // tooltip keeps the case
  assert.match(s, /A &amp; &lt;B&gt;&quot;X&quot;&lt;\/B&gt;/);   // label is upper-cased BEFORE escaping, so no entity is damaged
  assert.match(planSvg(byId('2l')), /LIVING &amp; DINING/); assert.doesNotMatch(planSvg(byId('2l')), /&AMP;/);
});
test('rooms too small for a label stay as a bare rect with a tooltip', () => {
  const s = planSvg(mk([{ name: 'Big', x: 0, y: 0, w: 6, h: 5 }, { name: 'Tiny', x: 6, y: 0, w: 1, h: 0.8 }]));
  assert.equal(count(s, /<rect /g), 2); assert.match(s, /<title>Tiny/); assert.doesNotMatch(s, />TINY</);
});
test('active room: class "on" on exactly the rect with that data-i', () => {
  const s = planSvg(byId('3g'), { active: 2 }); assert.equal(count(s, /class="room[^"]* on"/g), 1); assert.match(s, /class="room[^"]* on" data-i="2"/);
});
test('kind classes: wet and out rooms carry them', () => {
  const s = planSvg(byId('1c')); assert.match(s, /class="room out"/); assert.match(s, /class="room wet"/);
});
test('planViewBox scales with `scale` and has a fixed pad (14, mini 6)', () => {
  const u = byId('2l'), a = planViewBox(u, { scale: 10 }), b = planViewBox(u, { scale: 20 }), e = unitExtent(u);
  assert.ok(Math.abs(a.w - (e.w * 10 + 28)) < 0.01); assert.ok(Math.abs(b.w - (e.w * 20 + 28)) < 0.01);
  assert.ok(Math.abs(planViewBox(u, { mini: true }).w - (e.w * 10 + 12)) < 0.01);
  assert.ok(planViewBox(u, {}).h > planViewBox(u, { mini: true }).h, 'full plan has the scale-bar band');
});
test('the entry arrow of every real unit sits inside the viewBox (3P enters at x = -0.55)', () => {
  for (const u of real) { const s = planSvg(u), vb = planViewBox(u, {}), m = s.match(/translate\(([-\d.]+) ([-\d.]+)\)/); assert.ok(m, u.id);
    assert.ok(+m[1] >= 0 && +m[1] <= vb.w && +m[2] >= 0 && +m[2] <= vb.h, `${u.id} entry at ${m[1]},${m[2]} outside ${vb.w}x${vb.h}`); }
});
test('numbers in the output are rounded to at most 2 decimals', () => {
  assert.doesNotMatch(planSvg(byId('3s')), /\d\.\d{3,}/);
});
