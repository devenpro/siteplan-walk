// Floor plan SVG strings for the Homes view (arc 3, M5a). Pure: no DOM, no Three. Rooms are axis-aligned rectangles in metres; 1 m = `scale` viewBox units (default 10).
// Geometry and label-fit rules are ported from drawUnit in the X0 mockup; every string that comes from data goes through escapeXml.
const n = v => +Number(v).toFixed(2);
export const escapeXml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
export function unitExtent(unit) {
  return { w: Math.max(...unit.rooms.map(r => r.x + r.w)), h: Math.max(...unit.rooms.map(r => r.y + r.h)) };
}
export function planViewBox(unit, { scale = 10, pad = 14, mini = false } = {}) {
  const p = mini ? 6 : pad, e = unitExtent(unit);
  return { w: n(e.w * scale + p * 2), h: n(e.h * scale + p * 2 + (mini ? 0 : 10)) };
}
export function planSvg(unit, { scale: S = 10, pad = 14, mini = false, active = -1 } = {}) {
  const p = mini ? 6 : pad, k = S / 10, vb = planViewBox(unit, { scale: S, pad, mini });
  const rooms = unit.rooms.map((r, i) => {
    const cls = 'room' + (r.kind ? ' ' + r.kind : '') + (active === i ? ' on' : '');
    const rect = `<rect class="${cls}" data-i="${i}" x="${n(p + r.x * S)}" y="${n(p + r.y * S)}" width="${n(r.w * S)}" height="${n(r.h * S)}" rx="${n(0.6 * k)}"><title>${escapeXml(r.name)} · ${r.w.toFixed(2)} × ${r.h.toFixed(2)} m</title></rect>`;
    if (mini || r.w * S < 12 * k || r.h * S < 9 * k) return rect;   // too small for a label: the tooltip still names it
    const cx = p + (r.x + r.w / 2) * S, cy = p + (r.y + r.h / 2) * S, small = r.w * S < 22 * k || r.h * S < 14 * k, fs = (small ? 2.6 : 3.1) * k;
    const name = r.name.toUpperCase(), lines = (name.length > 12 && r.w * S < 34 * k ? name.replace(' & ', ' &\n') : name).split('\n');   // upper-case first, escape after, so entities survive
    const text = lines.map((l, j) => `<tspan x="${n(cx)}" dy="${n(j ? fs + 0.6 * k : 0)}">${escapeXml(l)}</tspan>`).join('');
    const dim = small ? '' : `<text class="rdim" x="${n(cx)}" y="${n(cy + fs + 2.4 * k)}" font-size="${n(2.4 * k)}">${r.w.toFixed(2)} × ${r.h.toFixed(2)} m</text>`;
    return rect + `<text class="rlab" x="${n(cx)}" y="${n(cy - (lines.length > 1 ? fs / 2 : 0) + (small ? k : 0))}" font-size="${n(fs)}" letter-spacing="${n(0.25 * k)}">${text}</text>` + dim;
  }).join('');
  let entry = '';
  if (!mini && unit.entry) {
    const rot = { up: 0, right: 90, down: 180, left: 270 }[unit.entry.dir] ?? 0;
    entry = `<g class="pentry" transform="translate(${n(p + unit.entry.x * S)} ${n(p + unit.entry.y * S)}) rotate(${rot})"><path d="M${n(-3.2 * k)} ${n(2.4 * k)} L0 ${n(-1.6 * k)} L${n(3.2 * k)} ${n(2.4 * k)}" fill="none" stroke="#d9622b" stroke-width="${n(1.1 * k)}"/><text x="0" y="${n(8 * k)}" font-size="${n(2.6 * k)}" text-anchor="middle" fill="#d9622b" letter-spacing="${n(0.3 * k)}">ENTRY</text></g>`;
  }
  const y = vb.h - 6, x2 = p + 5 * S;
  const scaleBar = mini ? '' : `<g class="pscale" stroke="#6b655c" stroke-width="${n(0.6 * k)}" fill="none"><line x1="${n(p)}" y1="${n(y)}" x2="${n(x2)}" y2="${n(y)}"/><line x1="${n(p)}" y1="${n(y - 2)}" x2="${n(p)}" y2="${n(y + 2)}"/><line x1="${n(x2)}" y1="${n(y - 2)}" x2="${n(x2)}" y2="${n(y + 2)}"/></g><text class="pscale-t" x="${n(x2 + 3)}" y="${n(y + 1)}" font-size="${n(2.6 * k)}" fill="#6b655c">5 m</text>`;
  const outline = `<path d="${unit.rooms.map(r => `M${n(p + r.x * S)} ${n(p + r.y * S)}h${n(r.w * S)}v${n(r.h * S)}h${n(-r.w * S)}z`).join('')}" fill="none" stroke="#241c14" stroke-width="${n((mini ? 1.4 : 1.6) * k)}" stroke-linejoin="round"/>`;
  return `<svg viewBox="0 0 ${vb.w} ${vb.h}" role="img" aria-label="${escapeXml((unit.type || '') + ' ' + (unit.plan || '') + ' floor plan')}" xmlns="http://www.w3.org/2000/svg">${rooms}${outline}${entry}${scaleBar}</svg>`;
}
