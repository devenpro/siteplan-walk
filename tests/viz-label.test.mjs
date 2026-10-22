import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveVizLabel } from '../viewer/viz-label.js';

const VENDORS = /higgsfield|kling|elevenlabs|nano.?banana|gemini|seedance|\bwan\b|midjourney|runway|openai|gpt/i;
const rd = p => JSON.parse(fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8'));

test('resolveVizLabel: trims and collapses; absent / blank / non-string => no label', () => {
  assert.equal(resolveVizLabel({ visualisationLabel: '  3D visualisation \n from the plan · indicative ' }), '3D visualisation from the plan · indicative');
  for (const s of [undefined, null, {}, { visualisationLabel: '' }, { visualisationLabel: '   ' }, { visualisationLabel: 42 }]) assert.equal(resolveVizLabel(s), '');
});
test('Belvedere carries the exact owner-approved label (ruling B12)', () => {
  assert.equal(resolveVizLabel(rd('projects/belvedere/site.json')), '3D visualisation from the published master plan · indicative');
});
test('ruling B12: nothing displayed names an AI vendor or tool (site text + every manifest credit)', () => {
  const site = rd('projects/belvedere/site.json');
  const shown = [site.name, site.developer, site.location, site.disclaimer, site.visualisationLabel, ...(site.facts || []).flatMap(f => [f.label, f.value]), ...(site.hotspots || []).flatMap(h => [h.name, h.caption]), ...(site.tours || []).flatMap(t => [t.name, t.title, t.blurb])].filter(Boolean);
  for (const t of shown) assert.doesNotMatch(String(t), VENDORS, t);
  const m = rd('projects/belvedere/postcards/manifest.json');
  let n = 0;
  for (const list of Object.values(m.images)) for (const e of list) { n++; assert.doesNotMatch(e.credit || '', VENDORS, e.file + ': ' + e.credit); assert.doesNotMatch(e.title || '', VENDORS, e.file); }
  assert.ok(n > 50);
});
