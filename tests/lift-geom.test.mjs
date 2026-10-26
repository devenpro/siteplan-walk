import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LIFT, LIFT_LABEL, liftBoxes, roomAt, labelledRooms, liftView, shouldFallback } from '../viewer/lift-geom.js';

const real = JSON.parse(fs.readFileSync(new URL('../projects/belvedere/units.json', import.meta.url), 'utf8')).units;
const byId = id => real.find(u => u.id === id);
const mk = rooms => ({ id: 't', type: '2 BHK', plan: 'Type T', rooms, entry: { x: 0, y: 0, dir: 'up' } });
const E = 1e-9;

test('one floor and four walls per room, for every real unit', () => {
  for (const u of real) {
    const bs = liftBoxes(u);
    assert.equal(bs.length, u.rooms.length * 5, u.id);
    u.rooms.forEach((_, i) => { const mine = bs.filter(b => b.room === i); assert.equal(mine.filter(b => b.part === 'floor').length, 1, u.id + ' floor ' + i); assert.equal(mine.filter(b => b.part === 'wall').length, 4, u.id + ' walls ' + i); });
  }
});

test('every box lies inside its room inset by the gap; wall tops equal the kind height (balcony 0.5, others 1.1); floor top 0.12', () => {
  for (const u of real) for (const b of liftBoxes(u)) {
    const r = u.rooms[b.room], g = LIFT.inset, ctx = `${u.id} room ${b.room} ${b.part}`;
    assert.ok(b.x0 >= r.x + g - E && b.x1 <= r.x + r.w - g + E && b.z0 >= r.y + g - E && b.z1 <= r.y + r.h - g + E, ctx + ' inside');
    assert.ok(b.x1 > b.x0 && b.z1 > b.z0 && b.y1 > b.y0, ctx + ' positive size');
    if (b.part === 'floor') { assert.ok(Math.abs(b.y1 - 0.12) < E && Math.abs(b.y0 - 0.02) < E, ctx); }
    else { assert.ok(Math.abs(b.y0) < E && Math.abs(b.y1 - (r.kind === 'out' ? 0.5 : 1.1)) < E, ctx + ' wall height ' + b.y1); }
  }
});

test('no two boxes share a coplanar, same-facing, overlapping face (the flicker guard)', () => {
  const AX = ['x', 'y', 'z'], lo = (b, a) => b[a + '0'], hi = (b, a) => b[a + '1'];
  for (const u of real) {
    const bs = liftBoxes(u);
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) for (const ax of AX) for (const sign of [1, -1]) {
      const pi = sign > 0 ? hi(bs[i], ax) : lo(bs[i], ax), pj = sign > 0 ? hi(bs[j], ax) : lo(bs[j], ax);
      if (Math.abs(pi - pj) > E) continue;
      const others = AX.filter(a => a !== ax), ov = others.map(a => Math.min(hi(bs[i], a), hi(bs[j], a)) - Math.max(lo(bs[i], a), lo(bs[j], a)));
      assert.ok(!(ov[0] > E && ov[1] > E), `${u.id}: boxes ${i} (room ${bs[i].room} ${bs[i].part}) and ${j} (room ${bs[j].room} ${bs[j].part}) share a ${ax}${sign > 0 ? '+' : '-'} face at ${pi}`);
    }
  }
});

test('a 0.6 x 0.5 m room gets walls of positive length and thickness <= 0.25 x its short side; so does a 0.2 m room', () => {
  for (const [w, h] of [[0.6, 0.5], [0.2, 0.2]]) {
    const bs = liftBoxes(mk([{ name: 'Tiny', x: 0, y: 0, w, h }])), g = LIFT.inset, short = Math.min(w, h) - 2 * g;
    assert.equal(bs.length, 5);
    for (const b of bs.filter(b => b.part === 'wall')) {
      assert.ok(b.x1 - b.x0 > 0 && b.z1 - b.z0 > 0, `${w}x${h} wall has positive size`);
      assert.ok(Math.min(b.x1 - b.x0, b.z1 - b.z0) <= 0.25 * short + E, `${w}x${h} wall thickness`);
    }
  }
});

test('roomAt names the room at every room centre, -1 in the gap between two touching rooms and outside the unit', () => {
  for (const u of real) {
    u.rooms.forEach((r, i) => assert.equal(roomAt(u, r.x + r.w / 2, r.y + r.h / 2), i, `${u.id} ${r.name}`));
    assert.equal(roomAt(u, -5, -5), -1); assert.equal(roomAt(u, 99, 99), -1);
  }
  const two = mk([{ name: 'A', x: 0, y: 0, w: 3, h: 3 }, { name: 'B', x: 3, y: 0, w: 3, h: 3 }]);
  assert.equal(roomAt(two, 3, 1.5), -1, 'on the shared edge'); assert.equal(roomAt(two, 2.9, 1.5), 0); assert.equal(roomAt(two, 3.1, 1.5), 1);
});

test('labelledRooms excludes rooms narrower than 1.1 m and keeps the rest in data order', () => {
  const u = mk([{ name: 'A', x: 0, y: 0, w: 3, h: 3 }, { name: 'Slim', x: 3, y: 0, w: 1.0, h: 3 }, { name: 'B', x: 4, y: 0, w: 1.1, h: 3 }, { name: 'Low', x: 5.1, y: 0, w: 3, h: 1.09 }]);
  assert.deepEqual(labelledRooms(u), [0, 2]);
  assert.ok(labelledRooms(byId('2l')).length >= 5);
  assert.deepEqual(labelledRooms(u, 3.5), [], 'a larger threshold (phones) drops the small rooms; the tap readout still names them');
  assert.ok(labelledRooms(byId('3p'), 1.6).length < labelledRooms(byId('3p')).length && labelledRooms(byId('3p'), 1.6).length >= 5);
});

test('liftView grows with the unit, grows when the aspect narrows, and min/max bracket the radius', () => {
  const a = liftView(byId('1c'), 1.5), b = liftView(byId('3s'), 1.5);
  assert.ok(b.radius > a.radius, 'bigger unit, bigger radius');
  assert.ok(liftView(byId('2l'), 0.5).radius > liftView(byId('2l'), 1.5).radius, 'portrait needs more distance');
  assert.equal(liftView(byId('2l'), 2).radius, liftView(byId('2l'), 1.2).radius, 'wide aspects are capped at 1');
  for (const v of [a, b]) { assert.ok(v.minDistance < v.radius && v.radius < v.maxDistance); assert.equal(v.phiDeg, 55); assert.equal(v.targetY, 0.4); }
  assert.equal(liftView(byId('2l'), 1.5).thetaDeg, 35); assert.equal(liftView(byId('2l'), 0.5).thetaDeg, 20);
});

test('liftView fits the unit sphere inside the narrower field of view (seen on a phone: 3P was cut off at both sides); camera.aspect is what to pass', () => {
  for (const id of ['1c', '2l', '3g', '3p', '3s']) for (const aspect of [0.45, 0.66, 1, 1.8]) {
    const u = byId(id), e = { w: Math.max(...u.rooms.map(r => r.x + r.w)), h: Math.max(...u.rooms.map(r => r.y + r.h)) }, half = Math.hypot(e.w, e.h) / 2;
    const narrow = Math.atan(Math.tan((42 * Math.PI) / 360) * Math.min(1, aspect)), v = liftView(u, aspect);
    const fit = (v.radius * Math.sin(narrow)) / half;   // 1 = the unit's bounding sphere just touches the edge of the narrow view
    assert.ok(fit >= 0.99 && fit <= 1.05, `${id} @ ${aspect}: the half-diagonal takes ${(fit * 100).toFixed(0)}% of the narrow half-view (live shot: 92% clipped 2L at the right edge on a 390 px phone)`);
  }
});

test('LIFT_LABEL has the exact R3 text and no price word', () => {
  assert.equal(LIFT_LABEL, 'Indicative 3D from published plans · rooms only; walls, doors and finishes are not shown');
  assert.doesNotMatch(LIFT_LABEL, /₹|price|lakh|crore/i);
});

test('shouldFallback: false until enough frames, false when smooth, true when slow, and a slow warm-up is ignored', () => {
  const rep = (n, ms) => Array(n).fill(ms);
  assert.equal(shouldFallback(rep(30, 500)), false, 'too few samples');
  assert.equal(shouldFallback(rep(60, 16)), false, 'smooth');
  assert.equal(shouldFallback(rep(60, 80)), true, 'slow');
  assert.equal(shouldFallback([...rep(8, 400), ...rep(52, 16)]), false, 'warm-up ignored');
  assert.equal(shouldFallback(rep(60, 45)), false, 'exactly at the limit is fine'); assert.equal(shouldFallback(rep(60, 46)), true);
});

test('shouldFallback: one stalled frame (a notification, a tab switch) does not condemn a smooth device, a run of slow frames still does (review finding 1)', () => {
  const smooth = Array(60).fill(16);
  assert.equal(shouldFallback([...smooth.slice(0, 30), 1500, ...smooth.slice(31)]), false, 'one 1.5 s stall among 60 smooth frames');
  assert.equal(shouldFallback([...smooth.slice(0, 30), 1500, 1500, 1500, ...smooth.slice(33)]), false, 'three stalls in a row are still a hiccup, not a slow device');
  assert.equal(shouldFallback(Array(60).fill(1000)), true, 'the ~1 fps software renderer is still caught');
});

test('the overlay meshes (entry wedge, tapped-room marker) share no horizontal plane with each other or the floor (review finding 2: the wedge and the marker both topped out at 0.17)', () => {
  const planes = [['floorTop', LIFT.floorTop], ['wedge y0', LIFT.overlay.wedge[0]], ['wedge y1', LIFT.overlay.wedge[1]], ['marker y0', LIFT.overlay.marker[0]], ['marker y1', LIFT.overlay.marker[1]]];
  for (let i = 0; i < planes.length; i++) for (let j = i + 1; j < planes.length; j++) assert.ok(Math.abs(planes[i][1] - planes[j][1]) >= 0.005, `${planes[i][0]} = ${planes[i][1]} and ${planes[j][0]} = ${planes[j][1]} are coplanar`);
  assert.ok(LIFT.overlay.wedge[0] > LIFT.floorTop && LIFT.overlay.marker[0] > LIFT.floorTop, 'both float above the floor top');
});
