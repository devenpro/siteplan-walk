// Arc-3 module flags. Every module defaults OFF so a dataset (and First Line's W1 host) sees no change until it opts in.
// Turn one on in site.json `flags: { experience: true }` or with `?mods=experience,context`; `?mods=none` forces everything off (flag-off regression runs).
export const MODULES = ['experience', 'context', 'location', 'plans', 'presenter', 'connect', 'walkin'];
export function resolveFlags(site, search) {
  const flags = Object.fromEntries(MODULES.map(m => [m, false]));
  const fromSite = site && site.flags;
  if (fromSite && typeof fromSite === 'object') for (const m of MODULES) if (fromSite[m] === true) flags[m] = true;
  const mods = (new URLSearchParams(search || '').get('mods') || '').split(',').map(s => s.trim()).filter(Boolean);
  if (mods.includes('none')) { for (const m of MODULES) flags[m] = false; return flags; }
  for (const m of mods) if (MODULES.includes(m)) flags[m] = true;
  return flags;
}
