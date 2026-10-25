// Authoring-time OpenStreetMap snapshot (ODbL, © OpenStreetMap contributors). Never called by the viewer: the result is committed so builds are deterministic.
// usage: node tools/osm-snapshot.mjs --lat 13.0462 --lon 77.7504 --radius 1500 --out projects/belvedere/source/osm-georef.json
import fs from 'node:fs';
const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : undefined; };
const lat = +arg('lat'), lon = +arg('lon'), radius = +arg('radius') || 1500, out = arg('out');
if (!Number.isFinite(lat) || !Number.isFinite(lon) || !out) { console.error('usage: node tools/osm-snapshot.mjs --lat <n> --lon <n> [--radius <m>] --out <file>'); process.exit(2); }
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const q = `[out:json][timeout:60];(way["building"](around:${radius},${lat},${lon});way["highway"](around:${radius},${lat},${lon}););out tags geom;`;
let data = null;
for (let round = 0; round < 3 && !data; round++) for (const m of MIRRORS) {
  try { const r = await fetch(m, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'siteplan-walk-authoring/1.0' }, signal: AbortSignal.timeout(90000) });
    if (!r.ok) { console.error(m, r.status); continue; } data = await r.json(); console.error('ok', m, data.elements.length, 'elements'); break; }
  catch (e) { console.error(m, String(e.message || e)); }
}
if (!data) { console.error('no mirror answered'); process.exit(1); }
fs.writeFileSync(out, JSON.stringify({ attribution: '© OpenStreetMap contributors (ODbL)', fetched: new Date().toISOString().slice(0, 10), centre: [lat, lon], radiusM: radius, elements: data.elements }));
