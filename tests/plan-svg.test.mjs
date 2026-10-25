import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { escapeXml, unitExtent, planViewBox, planSvg, estimateTextWidth } from '../viewer/plan-svg.js';

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
  const s = planSvg(byId('2l')); assert.match(s, />MASTER<\/tspan>[^]*?>BEDROOM<\/tspan>/); assert.match(s, /3\.35 × 3\.58 m/);   // the long name wraps onto two lines assert.match(s, /ENTRY/); assert.match(s, />5 m</);
});
test('room names are text, never markup (the real data has "Living & dining")', () => {
  const s = planSvg(mk([{ name: 'A & <b>"x"</b>', x: 0, y: 0, w: 6, h: 5 }]));
  assert.doesNotMatch(s, /<b>/); assert.match(s, /A &amp; &lt;b&gt;&quot;x&quot;&lt;\/b&gt;/);   // tooltip keeps the case
  assert.match(s, /&lt;B&gt;/); assert.match(s, /&quot;X&quot;/); assert.doesNotMatch(s, /&AMP;|&LT;|&GT;|&QUOT;/);   // label is upper-cased BEFORE escaping, so no entity is damaged (the long name may wrap across tspans)
  const l2 = planSvg(byId('2l')); assert.match(l2, />LIVING &amp;<\/tspan>/); assert.match(l2, />DINING<\/tspan>/); assert.doesNotMatch(l2, /&AMP;/);
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

// ---- label fit: a room's name must not spill into its neighbour (seen on the live shots: MASTER BEDROOM, MASTER TOILET, TOILET 2) ----
const tspans = svg => [...svg.matchAll(/<text class="rlab"[^>]*font-size="([\d.]+)"[^>]*>(.*?)<\/text>/g)].map(m => ({ fs: +m[1], lines: [...m[2].matchAll(/<tspan[^>]*>(.*?)<\/tspan>/g)].map(t => t[1].replace(/&amp;/g, '&')) }));
test('labels that are too wide for their room wrap onto two lines (2L Master bedroom / Master toilet)', () => {
  const s = planSvg(byId('2l')); assert.match(s, />MASTER<\/tspan>[^]*?>BEDROOM<\/tspan>/); assert.match(s, />MASTER<\/tspan>[^]*?>TOILET<\/tspan>/);
});
test('every label line of every real unit fits inside its room width at every scale (estimated text width <= room width)', () => {
  for (const u of real) for (const scale of [10, 20]) {
    const s = planSvg(u, { scale }), labels = tspans(s); let idx = 0;
    for (const r of u.rooms) {
      const rw = r.w * scale; const name = r.name.toUpperCase(); const t = labels.find(l => l.lines.join(' ') === name || l.lines.join(' ').replace(' &', ' &') === name);
      if (!t) continue;   // no label for this room (too small): the tooltip and the tap readout still name it
      idx++; for (const line of t.lines) assert.ok(estimateTextWidth(line, t.fs, 0.25 * scale / 10) <= rw, `${u.id} "${name}" line "${line}" ~${estimateTextWidth(line, t.fs, 0.25 * scale / 10).toFixed(1)} > room ${rw.toFixed(1)} at scale ${scale}`);
    }
    assert.ok(idx >= u.rooms.length * 0.6, `${u.id}: most rooms still carry a label (${idx}/${u.rooms.length})`);
  }
});
test('short names stay on one line and keep their full font', () => {
  const s = planSvg(byId('2l')); assert.match(s, />KITCHEN<\/tspan>/); assert.match(s, />FOYER<\/tspan>/); assert.match(s, />BALCONY<\/tspan>/);
});
test('estimateTextWidth grows with length, font size and letter spacing', () => {
  assert.ok(estimateTextWidth('ABCD', 3, 0.25) > estimateTextWidth('ABC', 3, 0.25)); assert.ok(estimateTextWidth('ABC', 4, 0.25) > estimateTextWidth('ABC', 3, 0.25)); assert.ok(estimateTextWidth('ABC', 3, 1) > estimateTextWidth('ABC', 3, 0));
});

// ---- from the rendered check: bold capitals run wider than 0.66 em, and ENTRY must never read upside down ----
test('MASTER BEDROOM wraps in the 3.55 m wide 1C room and in 3P (bold capitals are wide)', () => {
  assert.match(planSvg(byId('1c')), />MASTER<\/tspan>[^]*?>BEDROOM<\/tspan>/); assert.match(planSvg(byId('3p')), />MASTER<\/tspan>[^]*?>BEDROOM<\/tspan>/);
});
test('the ENTRY text is never upside down or clipped: a downward entry (3G) puts it beside the arrow, unrotated and inside the viewBox', () => {
  const s = planSvg(byId('3g')), vb = planViewBox(byId('3g'), {}), g = s.match(/<g class="pentry" transform="translate\(([-\d.]+) ([-\d.]+)\) rotate\((\d+)\)">(.*?)<\/g>/);
  assert.equal(g[3], '180', '3G enters downwards'); assert.doesNotMatch(g[4], /<text/, 'no text inside the rotated group');
  const t = s.match(/<text class="pentry-t" x="([-\d.]+)" y="([-\d.]+)"[^>]*>ENTRY<\/text>/); assert.ok(t, 'a separate upright ENTRY text'); assert.doesNotMatch(t[0], /transform=/);
  assert.ok(+t[1] > +g[1], 'to the right of the arrow'); assert.ok(+t[2] > 3 && +t[2] < vb.h && +t[1] + 12 < vb.w, `inside the viewBox: ${t[1]},${t[2]} of ${vb.w}x${vb.h}`);
  for (const id of ['1c', '2l', '3p']) { const sv = planSvg(byId(id)); assert.doesNotMatch(sv, /class="pentry-t"/, id); assert.match(sv.match(/<g class="pentry".*?<\/g>/)[0], /<text[^>]*>ENTRY<\/text>/, id + ' keeps its text in the rotated group'); }
});
