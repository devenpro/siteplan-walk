// Georeference: plan pixels <-> lat/lon for one project. A least-squares similarity (scale + rotation + shift, no skew) fitted to >= 2 control points.
// Flat-earth about the first point with WGS84 metres-per-degree series: fine over a site-sized area (error well under a metre across a few km). Plan y points down, so z = x - i·y; east/north = a·z + b (complex).
const R_EARTH = 6371008.8, RAD = Math.PI / 180;
const mul = (p, q) => [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]];
const div = (p, q) => { const d = q[0] * q[0] + q[1] * q[1]; return [(p[0] * q[0] + p[1] * q[1]) / d, (p[1] * q[0] - p[0] * q[1]) / d]; };
const zOf = px => [px[0], -px[1]];
const mLatAt = lat => 111132.92 - 559.82 * Math.cos(2 * lat * RAD) + 1.175 * Math.cos(4 * lat * RAD);
const mLonAt = lat => 111412.84 * Math.cos(lat * RAD) - 93.5 * Math.cos(3 * lat * RAD);

// fitGeo(points)            : >= 2 distinct points, free scale + rotation (least squares).
// fitGeo(points, {metresPerPx, northDeg}) : >= 1 point, scale and rotation fixed to the plan's own (northDeg = degrees clockwise from image-up); only the shift is fitted (provisional georef).
export function fitGeo(points, known) {
  const ok = Array.isArray(points) ? points : [];
  if (known) {
    if (!(known.metresPerPx > 0)) throw new Error('geo: known.metresPerPx must be > 0');
    if (!Number.isFinite(known.northDeg)) throw new Error('geo: known.northDeg must be a number');
    if (ok.length < 1) throw new Error('geo: need at least 1 point');
  }
  const lat0 = ok.length ? ok[0].lat : 0, lon0 = ok.length ? ok[0].lon : 0, mLon = mLonAt(lat0), mLat = mLatAt(lat0);
  const z = ok.map(p => zOf(p.px)), w = ok.map(p => [(p.lon - lon0) * mLon, (p.lat - lat0) * mLat]);
  const n = ok.length, zm = [z.reduce((s, v) => s + v[0], 0) / n, z.reduce((s, v) => s + v[1], 0) / n], wm = [w.reduce((s, v) => s + v[0], 0) / n, w.reduce((s, v) => s + v[1], 0) / n];
  let a;
  if (known) { const nu = known.northDeg * RAD; a = [known.metresPerPx * Math.cos(nu), known.metresPerPx * Math.sin(nu)]; }   // a = scale·e^{iν}, ν = north clockwise from image-up
  else {
    let num = [0, 0], den = 0;
    for (let i = 0; i < n; i++) { const zc = [z[i][0] - zm[0], z[i][1] - zm[1]], wc = [w[i][0] - wm[0], w[i][1] - wm[1]]; const t = mul([zc[0], -zc[1]], wc); num = [num[0] + t[0], num[1] + t[1]]; den += zc[0] * zc[0] + zc[1] * zc[1]; }
    if (n < 2 || den < 1e-9) throw new Error('geo: need at least 2 distinct points');
    a = [num[0] / den, num[1] / den];
  }
  const am = mul(a, zm);
  return { lat0, lon0, mLat, mLon, a, b: [wm[0] - am[0], wm[1] - am[1]] };
}
export function pxToLatLon(g, px) { const w = mul(g.a, zOf(px)); return [g.lat0 + (w[1] + g.b[1]) / g.mLat, g.lon0 + (w[0] + g.b[0]) / g.mLon]; }
export function latLonToPx(g, lat, lon) { const z = div([(lon - g.lon0) * g.mLon - g.b[0], (lat - g.lat0) * g.mLat - g.b[1]], g.a); return [z[0], -z[1]]; }
export function distanceM(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * RAD, p2 = lat2 * RAD, dp = p2 - p1, dl = (lon2 - lon1) * RAD, h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function residualsM(g, points) { return points.map(p => { const [la, lo] = pxToLatLon(g, p.px); return distanceM(la, lo, p.lat, p.lon); }); }
export const scaleOf = g => Math.hypot(g.a[0], g.a[1]);   // metres per plan pixel
export function northDegOf(g) {   // degrees clockwise from image-up (site.json plan.northDeg convention), in [0, 360)
  const zn = div([0, 1], g.a);   // plan-space direction of north (z = x - i·y)
  return ((Math.atan2(zn[0], zn[1]) / RAD) % 360 + 360) % 360;
}
// The one rule for a site.json `geo` block: with fewer than 2 points the plan's own scale + north anchor it (provisional); with 2+ the fit is free. No block => null.
export function geoFromSite(site) {
  const g = site && site.geo; if (!g) return null;
  const pts = Array.isArray(g.points) ? g.points : [];
  return fitGeo(pts, pts.length < 2 ? { metresPerPx: site.scale.metresPerPx, northDeg: site.plan.northDeg } : undefined);
}
