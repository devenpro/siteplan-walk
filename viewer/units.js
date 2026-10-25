// Unit types for the Homes view (arc 3, M5a). Data: projects/<slug>/units.json, rooms in metres, areas in sq ft as published by the developer. No prices, no availability.
const DIRS = ['up', 'right', 'down', 'left'], KINDS = [undefined, 'wet', 'out'], FORBIDDEN_KEY = /price|cost|lakh|crore|availability/i;
const isStr = v => typeof v === 'string' && v.trim() !== '', isNum = v => typeof v === 'number' && Number.isFinite(v);
export function validateUnits(doc) {
  const errors = [], list = doc && Array.isArray(doc.units) ? doc.units : null;
  if (!list || !list.length) return { ok: false, errors: ['units: missing or empty'], units: [] };
  const seen = new Set();
  for (const [i, u] of list.entries()) {
    const id = u && isStr(u.id) ? u.id : '#' + i, bad = m => errors.push(id + ': ' + m);
    if (!u || typeof u !== 'object') { bad('not an object'); continue; }
    if (!isStr(u.id)) bad('id missing'); else if (seen.has(u.id)) bad('duplicate id ' + u.id); else seen.add(u.id);
    for (const k of Object.keys(u)) if (FORBIDDEN_KEY.test(k)) bad(`forbidden key "${k}" (no prices or availability)`);
    for (const k of ['type', 'label', 'plan', 'tower', 'unitsRange', 'floors']) if (!isStr(u[k])) bad(k + ' missing');
    if (!(isNum(u.bhk) && u.bhk > 0)) bad('bhk must be a positive number');
    for (const k of ['sba', 'carpet', 'balcony', 'beds', 'baths']) if (!(isNum(u[k]) && u[k] >= 0)) bad(k + ' must be a number >= 0');
    if (isNum(u.carpet) && isNum(u.sba) && u.carpet > u.sba) bad('carpet cannot exceed sba');
    if (!u.entry || !isNum(u.entry.x) || !isNum(u.entry.y) || !DIRS.includes(u.entry.dir)) bad('entry needs numeric x, y and dir up|right|down|left');
    if (!Array.isArray(u.rooms) || !u.rooms.length) bad('rooms missing');
    else for (const r of u.rooms) {
      if (!r || !isStr(r.name)) { bad('room without a name'); continue; }
      if (![r.x, r.y, r.w, r.h].every(isNum)) bad(`room "${r.name}": coordinate not a finite number`);
      else if (!(r.w > 0 && r.h > 0)) bad(`room "${r.name}": size must be positive`);
      if (!KINDS.includes(r.kind)) bad(`room "${r.name}": kind must be wet or out`);
    }
  }
  if (errors.length) return { ok: false, errors, units: [] };
  return { ok: true, errors, units: [...list].sort((a, b) => a.bhk - b.bhk || a.sba - b.sba) };
}
export async function loadUnits(url, fetchFn = fetch) {
  try {
    const res = await fetchFn(url); if (!res.ok) throw new Error('HTTP ' + res.status);
    const r = validateUnits(await res.json()); if (!r.ok) throw new Error(r.errors.slice(0, 3).join('; '));
    return r.units;
  } catch (e) { console.warn('walk: units unavailable —', e.message); return []; }
}
export const unitById = (units, id) => (Array.isArray(units) && units.find(u => u.id === id)) || null;
