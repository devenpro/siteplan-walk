import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitGeo, pxToLatLon, latLonToPx, distanceM, residualsM, scaleOf, northDegOf } from '../viewer/geo.js';

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
