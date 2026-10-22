// The persistent "this is a visualisation" label (owner ruling B12). Text lives in site.json `visualisationLabel`
// so a client build can say "…from the sanctioned plan · indicative" without code changes. Absent / blank / non-string => '' (no label shown).
export function resolveVizLabel(site) {
  const v = site && site.visualisationLabel;
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
}
