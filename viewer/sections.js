// The section bar's registry. Empty unless the `experience` flag is on; later modules (surroundings, location, homes, share) append their own entries when their flag is on.
export const DEFAULT_VIEW = 'masterplan';
export function resolveSections(flags, site) {
  if (!flags || flags.experience !== true) return [];
  const list = [{ id: 'masterplan', label: 'Master plan' }];
  if (site && Array.isArray(site.tours) && site.tours.length) list.push({ id: 'tours', label: 'Tours' });
  return list;
}
export function resolveView(id, sections) {
  if (sections.some(s => s.id === id)) return id;
  return sections.some(s => s.id === DEFAULT_VIEW) ? DEFAULT_VIEW : '';
}
