// One-off converter kept for provenance: the traced `window.BELVEDERE_UNITS` (X0 mockup, backed up in the private creatisoul/belvedere-source repo as units.js) -> projects/belvedere/units.json.
// usage: node tools/units-to-json.mjs [path/to/units.js] [out=projects/belvedere/units.json]
import fs from 'node:fs'; import vm from 'node:vm';
const src = process.argv[2] || '/root/mockups/firstline/x0-data/units.js', out = process.argv[3] || new URL('../projects/belvedere/units.json', import.meta.url).pathname;
const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(src, 'utf8'), ctx);
const units = ctx.window.BELVEDERE_UNITS.map(u => {
  const { availability, rooms, ...rest } = u;   // availability is an unverified sales-status claim: never published
  return { ...rest, rooms: rooms.map(([name, x, y, w, h, kind]) => ({ name, x, y, w, h, ...(kind ? { kind } : {}) })) };
});
const doc = { source: "Traced from Brigade's published unit plans; room sizes from the brochure's room dimensions", asOf: '2026-10-25',
  note: "Indicative layout from published plans · areas are the developer's published figures", units };
const j = JSON.stringify;   // readable diff: one line per unit header, one per room
const lines = units.map(({ rooms, ...head }) => '    ' + j({ ...head, rooms: '@@' }).replace('"@@"', '[\n' + rooms.map(r => '      ' + j(r)).join(',\n') + '\n    ]'));
fs.writeFileSync(out, `{\n  "source": ${j(doc.source)},\n  "asOf": ${j(doc.asOf)},\n  "note": ${j(doc.note)},\n  "units": [\n${lines.join(',\n')}\n  ]\n}\n`); console.log('wrote', out, units.length, 'units');
