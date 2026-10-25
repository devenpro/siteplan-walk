// usage: node tools/georef-check.mjs <slug>   — report a project's georef against the acceptance rules (spec §8): verified = 2+ points, 3+ independent checks within 20 m, scale within 5 %, north within 5 degrees.
// A provisional block (fewer than 2 points) exits 0 with a warning: it is allowed in the viewer but must not feed surroundings or place distances.
import fs from 'node:fs';
import { geoFromSite, residualsM, scaleOf, northDegOf, pxToLatLon } from '../viewer/geo.js';
const slug = process.argv[2]; if (!slug) { console.error('usage: node tools/georef-check.mjs <slug>'); process.exit(2); }
const site = JSON.parse(fs.readFileSync(new URL(`../projects/${slug}/site.json`, import.meta.url), 'utf8'));
if (!site.geo) { console.log('no geo block'); process.exit(0); }
const g = geoFromSite(site), dScale = scaleOf(g) / site.scale.metresPerPx - 1, dNorth = Math.abs(((northDegOf(g) - site.plan.northDeg + 540) % 360) - 180);
console.log(`status: ${site.geo.status || 'unverified'}   points: ${site.geo.points.length}   checks: ${(site.geo.check || []).length}`);
console.log(`scale ${scaleOf(g).toFixed(4)} m/px (${(dScale * 100).toFixed(2)} % from the plan)   north ${northDegOf(g).toFixed(1)} (${dNorth.toFixed(1)} degrees from the plan)`);
const [la, lo] = pxToLatLon(g, site.boundary.reduce((a, p) => [a[0] + p[0] / site.boundary.length, a[1] + p[1] / site.boundary.length], [0, 0])); console.log(`plot centre ${la.toFixed(6)}, ${lo.toFixed(6)}`);
const res = residualsM(g, site.geo.check || []); (site.geo.check || []).forEach((c, i) => console.log(`  check "${c.label}": ${res[i].toFixed(1)} m ${res[i] <= 20 ? 'ok' : 'OVER 20 m'}`));
if (site.geo.points.length < 2) { console.log('PROVISIONAL: ' + (site.geo.accuracy || 'accuracy not stated') + ' — not accepted for surroundings or place distances.'); process.exit(0); }
const bad = (site.geo.check || []).length < 3 || res.some(r => r > 20) || Math.abs(dScale) > 0.05 || dNorth > 5; console.log(bad ? 'NOT ACCEPTED' : 'ACCEPTED'); process.exit(bad ? 1 : 0);
