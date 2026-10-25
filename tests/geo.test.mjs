import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitGeo, geoFromSite, pxToLatLon, latLonToPx, distanceM, residualsM, scaleOf, northDegOf } from '../viewer/geo.js';
import fs from 'node:fs';

// ground truth built here, independent of the fit: east/north metres about (LAT0, LON0), plan y points down
const LAT0 = 13.05, LON0 = 77.75, C = Math.PI / 180, M_LAT = 111132.92 - 559.82 * Math.cos(2 * LAT0 * C) + 1.175 * Math.cos(4 * LAT0 * C), M_LON = 111412.84 * Math.cos(LAT0 * C) - 93.5 * Math.cos(3 * LAT0 * C);   // WGS84 metres per degree
function truthPoint(px, scale, northDeg) {
  const nu = northDeg * Math.PI / 180, ar = scale * Math.cos(nu), ai = scale * Math.sin(nu), zr = px[0], zi = -px[1];   // a = scale·e^{iν}, z = x − i·y
  const E = ar * zr - ai * zi, N = ar * zi + ai * zr;
  return { px, lat: LAT0 + N / M_LAT, lon: LON0 + E / M_LON };
}
const PX = [[80, 38], [628, 48], [497, 835], [112, 835], [300, 400]];
const pts = (scale, north, list = PX) => list.map(p => truthPoint(p, scale, north));

test('recovers scale and north from exact points (2 and 5 points), residuals ~0', () => {
  for (const n of [2, 5]) {
    const points = pts(0.343, 135, PX.slice(0, n)), g = fitGeo(points);
    assert.ok(Math.abs(scaleOf(g) / 0.343 - 1) < 0.001, 'scale ' + scaleOf(g));
    assert.ok(Math.abs(northDegOf(g) - 135) < 0.1, 'north ' + northDegOf(g));
    assert.ok(Math.max(...residualsM(g, points)) < 0.01);
  }
});
test('image-up is north: lat rises as plan y falls; north reads 0', () => {
  const g = fitGeo(pts(1, 0, [[0, 100], [0, 0], [50, 50]]));
  assert.ok(Math.abs(northDegOf(g)) < 0.1 || Math.abs(northDegOf(g) - 360) < 0.1);
  assert.ok(pxToLatLon(g, [0, 0])[0] > pxToLatLon(g, [0, 100])[0]);
});
test('pxToLatLon and latLonToPx round-trip', () => {
  const g = fitGeo(pts(0.343, 135));
  for (const p of [[0, 0], [321, 654], [1200, 848]]) { const [la, lo] = pxToLatLon(g, p), back = latLonToPx(g, la, lo); assert.ok(Math.hypot(back[0] - p[0], back[1] - p[1]) < 1e-6); }
});
test('haversine agrees with the fitted scale to 1 % (a sphere is ~0.5 % off the ellipsoid in latitude; independent of the flat-earth maths)', () => {
  const g = fitGeo(pts(0.343, 135)), [a, b] = [pxToLatLon(g, [0, 0]), pxToLatLon(g, [600, 700])];
  assert.ok(Math.abs(distanceM(a[0], a[1], b[0], b[1]) / (0.343 * Math.hypot(600, 700)) - 1) < 0.01);
});
test('distanceM: 0.001 degree of longitude at 13N is about 108.5 m', () => {
  assert.ok(Math.abs(distanceM(13, 77, 13, 77.001) / 108.5 - 1) < 0.01);
  assert.equal(distanceM(13, 77, 13, 77), 0);
});
test('one 8 m error among 4 points is visible but small in the residuals', () => {
  const points = pts(0.343, 135, PX.slice(0, 4)); points[3] = { ...points[3], lat: points[3].lat + 8 / M_LAT };
  const r = residualsM(fitGeo(points), points); assert.ok(Math.max(...r) > 1 && Math.max(...r) < 12, String(Math.max(...r)));
});
test('fitGeo throws on fewer than 2 points and on identical px', () => {
  assert.throws(() => fitGeo(pts(1, 0, [[1, 1]])), /need at least 2 distinct points/);
  assert.throws(() => fitGeo([]), /need at least 2 distinct points/);
  const p = truthPoint([5, 5], 1, 0); assert.throws(() => fitGeo([p, { ...p }]), /need at least 2 distinct points/);
});

// ---- anchored fit: one known point plus the plan's own scale and north (provisional georef) ----
test('anchored fit: 1 point + known scale/north reproduces the truth everywhere (residual 0 at the anchor, correct scale and north)', () => {
  const known = { metresPerPx: 0.343, northDeg: 135 }, all = pts(0.343, 135), g = fitGeo([all[0]], known);
  assert.ok(Math.abs(scaleOf(g) - 0.343) < 1e-9); assert.ok(Math.abs(northDegOf(g) - 135) < 1e-6);
  assert.ok(Math.max(...residualsM(g, all)) < 0.01, 'every other truth point lands on its px: ' + residualsM(g, all).map(r => r.toFixed(3)));
});
test('anchored fit: with 2+ points the scale and rotation stay the known ones and only the shift is averaged', () => {
  const known = { metresPerPx: 0.343, northDeg: 135 }, all = pts(0.343, 135, PX.slice(0, 3));
  const off = all.map((p, i) => i === 1 ? { ...p, lat: p.lat + 6 / M_LAT } : p), g = fitGeo(off, known);
  assert.ok(Math.abs(scaleOf(g) - 0.343) < 1e-9 && Math.abs(northDegOf(g) - 135) < 1e-6);
  assert.ok(Math.max(...residualsM(g, all)) < 6, 'a 6 m error in one point is spread, never amplified');
});
test('anchored fit rejects no points and a non-positive scale', () => {
  assert.throws(() => fitGeo([], { metresPerPx: 0.343, northDeg: 0 }), /need at least 1 point/);
  assert.throws(() => fitGeo(pts(1, 0, [[0, 0]]), { metresPerPx: 0, northDeg: 0 }), /metresPerPx/);
  assert.throws(() => fitGeo(pts(1, 0, [[0, 0]]), { metresPerPx: 0.3, northDeg: NaN }), /northDeg/);
});

// ---- geoFromSite: the one rule for turning a site.json `geo` block into a Geo ----
test('geoFromSite: no geo block => null; fewer than 2 points => anchored on the plan scale + north; 2+ points => free fit', () => {
  const base = { scale: { metresPerPx: 0.343 }, plan: { northDeg: 135 } }, all = pts(0.343, 135);
  assert.equal(geoFromSite(base), null); assert.equal(geoFromSite(undefined), null);
  const one = geoFromSite({ ...base, geo: { points: [all[0]] } });
  assert.ok(Math.abs(scaleOf(one) - 0.343) < 1e-9 && Math.abs(northDegOf(one) - 135) < 1e-6);
  const two = geoFromSite({ ...base, geo: { points: [all[0], all[1]] } }); assert.ok(Math.max(...residualsM(two, all.slice(0, 2))) < 0.01);
  assert.throws(() => geoFromSite({ ...base, geo: { points: [] } }), /need at least 1 point/);
});

// ---- Belvedere's own georeference (site.json `geo`) ----
const site = JSON.parse(fs.readFileSync(new URL('../projects/belvedere/site.json', import.meta.url), 'utf8'));
const geoSite = geoFromSite(site);
test('Belvedere geo: a verified georef needs 2+ points and 3+ independent checks within 20 m; a provisional one must state its accuracy and claim no checks', () => {
  const g = site.geo; assert.ok(g, 'geo block'); assert.ok(['verified', 'provisional'].includes(g.status), 'status');
  if (g.status === 'verified') {
    assert.ok(g.points.length >= 2 && g.check.length >= 3);
    for (const [i, r] of residualsM(fitGeo(g.points), g.check).entries()) assert.ok(r <= 20, `check "${g.check[i].label}" is ${r.toFixed(1)} m off`);
  } else { assert.ok(typeof g.accuracy === 'string' && g.accuracy.length > 10, 'accuracy statement'); assert.equal(g.check.length, 0); }
});
test('Belvedere geo: fitted scale and north equal the plan\'s (provisional) or sit within 5 % / 5 degrees (verified)', () => {
  const dScale = Math.abs(scaleOf(geoSite) / site.scale.metresPerPx - 1), dNorth = Math.abs(((northDegOf(geoSite) - site.plan.northDeg + 540) % 360) - 180);
  const tol = site.geo.status === 'verified' ? [0.05, 5] : [1e-9, 1e-6]; assert.ok(dScale <= tol[0], 'scale ' + dScale); assert.ok(dNorth <= tol[1], 'north ' + dNorth);
});
test('Belvedere geo: the anchor sits on the plot frontage and the plot centre is within 1.5 km of Budigere Cross (13.0462, 77.7504)', () => {
  const [px, py] = site.geo.points[0].px, ys = site.boundary.map(p => p[1]); assert.equal(py, Math.max(...ys), 'anchor on the frontage edge');
  assert.ok(px >= Math.min(...site.boundary.map(p => p[0])) && px <= Math.max(...site.boundary.map(p => p[0])), 'anchor within the plot width');
  const c = site.boundary.reduce((a, p) => [a[0] + p[0] / site.boundary.length, a[1] + p[1] / site.boundary.length], [0, 0]), [la, lo] = pxToLatLon(geoSite, c);
  assert.ok(distanceM(la, lo, 13.0462, 77.7504) <= 1500, `${la},${lo}`);
});
