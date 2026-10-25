// Deep-link state in location.hash. Legacy links (#h=<id>, #tour=<id>) keep their exact bytes; arc 3 adds view= and plan=.
const KEYS = ['view', 'h', 'tour', 'plan'];   // also the output order
const dec = s => { try { return decodeURIComponent(s); } catch { return s; } };
export function parseHash(hash) {
  const out = {};
  for (const part of String(hash || '').replace(/^#/, '').split('&')) {
    const i = part.indexOf('='); if (i < 1) continue;
    const k = part.slice(0, i), v = dec(part.slice(i + 1));
    if (KEYS.includes(k) && v && !(k in out)) out[k] = v;
  }
  return out;
}
export function formatHash(state) {
  const parts = KEYS.filter(k => state && typeof state[k] === 'string' && state[k]).map(k => k + '=' + encodeURIComponent(state[k]));
  return parts.length ? '#' + parts.join('&') : '';
}
