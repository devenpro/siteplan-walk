// Floor plan SVG strings for the Homes view (arc 3, M5a). Pure: no DOM, no Three. Rooms are axis-aligned rectangles in metres; 1 m = `scale` viewBox units (default 10).
// Geometry and label-fit rules are ported from drawUnit in the X0 mockup; every string that comes from data goes through escapeXml.
const n = v => +Number(v).toFixed(2);
export const escapeXml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const CHAR_W = 0.74;   // average BOLD upper-case glyph width in em (the labels are 600/700 weight; checked on a render: 0.66 let MASTER BEDROOM touch its room edges): wide on purpose, a label that is too snug spills into the next room
export const estimateTextWidth = (text, fs, ls = 0) => text.length * (fs * CHAR_W + ls);
// Fit an upper-cased room name into a room (viewBox units): one line at the full font, else a balanced two-line split, then shrink the font to a floor, else null (no label; the tooltip and tap readout still name the room).
function fitLabel(name, roomW, roomH, fs0, k) {
  const ls = 0.25 * k, pad = 2 * k, lh = fs => fs + 0.6 * k, mid = name.length / 2, splits = [[name]];
  const spaces = [...name].map((c, i) => (c === ' ' ? i : -1)).filter(i => i >= 0);
  if (spaces.length) { const i = spaces.reduce((x, y) => (Math.abs(y - mid) < Math.abs(x - mid) ? y : x)); splits.push([name.slice(0, i), name.slice(i + 1)]); }
  for (let fs = fs0; fs >= 2.0 * k - 1e-9; fs -= 0.2 * k) for (const lines of splits) if (lines.every(l => estimateTextWidth(l, fs, ls) <= roomW - pad) && lines.length * lh(fs) <= roomH - pad) return { lines, fs };
  return null;
}
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
    const cx = p + (r.x + r.w / 2) * S, cy = p + (r.y + r.h / 2) * S, small = r.w * S < 22 * k || r.h * S < 14 * k;
    const fit = fitLabel(r.name.toUpperCase(), r.w * S, r.h * S, (small ? 2.6 : 3.1) * k, k); if (!fit) return rect;   // upper-case first, escape after, so entities survive
    const { lines, fs } = fit, lh = fs + 0.6 * k, dimText = `${r.w.toFixed(2)} × ${r.h.toFixed(2)} m`, dfs = 2.4 * k;
    const showDim = !small && estimateTextWidth(dimText, dfs * 0.85) <= r.w * S - 2 * k && lines.length * lh + 3.4 * k <= r.h * S - 2 * k;
    const y0 = cy - (lines.length * lh + (showDim ? 3.4 * k : 0)) / 2 + fs * 0.8;
    const text = lines.map((l, j) => `<tspan x="${n(cx)}" dy="${n(j ? lh : 0)}">${escapeXml(l)}</tspan>`).join('');
    const dim = showDim ? `<text class="rdim" x="${n(cx)}" y="${n(y0 + (lines.length - 1) * lh + 3 * k)}" font-size="${n(dfs)}">${dimText}</text>` : '';
    return rect + `<text class="rlab" x="${n(cx)}" y="${n(y0)}" font-size="${n(fs)}" letter-spacing="${n(0.25 * k)}">${text}</text>` + dim;
  }).join('');
  let entry = '';
  if (!mini && unit.entry) {
    const rot = { up: 0, right: 90, down: 180, left: 270 }[unit.entry.dir] ?? 0, ex = p + unit.entry.x * S, ey = p + unit.entry.y * S, tf = `font-size="${n(2.6 * k)}" fill="#d9622b" letter-spacing="${n(0.3 * k)}"`;
    const up = rot === 180;   // a downward arrow would turn its caption upside down and push it off the top: that caption goes beside the arrow, unrotated
    entry = `<g class="pentry" transform="translate(${n(ex)} ${n(ey)}) rotate(${rot})"><path d="M${n(-3.2 * k)} ${n(2.4 * k)} L0 ${n(-1.6 * k)} L${n(3.2 * k)} ${n(2.4 * k)}" fill="none" stroke="#d9622b" stroke-width="${n(1.1 * k)}"/>${up ? '' : `<text x="0" y="${n(8 * k)}" text-anchor="middle" ${tf}>ENTRY</text>`}</g>`
      + (up ? `<text class="pentry-t" x="${n(ex + 4.5 * k)}" y="${n(ey + 1 * k)}" text-anchor="start" ${tf}>ENTRY</text>` : '');
  }
  const y = vb.h - 6, x2 = p + 5 * S;
  const scaleBar = mini ? '' : `<g class="pscale" stroke="#6b655c" stroke-width="${n(0.6 * k)}" fill="none"><line x1="${n(p)}" y1="${n(y)}" x2="${n(x2)}" y2="${n(y)}"/><line x1="${n(p)}" y1="${n(y - 2)}" x2="${n(p)}" y2="${n(y + 2)}"/><line x1="${n(x2)}" y1="${n(y - 2)}" x2="${n(x2)}" y2="${n(y + 2)}"/></g><text class="pscale-t" x="${n(x2 + 3)}" y="${n(y + 1)}" font-size="${n(2.6 * k)}" fill="#6b655c">5 m</text>`;
  const outline = `<path d="${unit.rooms.map(r => `M${n(p + r.x * S)} ${n(p + r.y * S)}h${n(r.w * S)}v${n(r.h * S)}h${n(-r.w * S)}z`).join('')}" fill="none" stroke="#241c14" stroke-width="${n((mini ? 1.4 : 1.6) * k)}" stroke-linejoin="round"/>`;
  return `<svg viewBox="0 0 ${vb.w} ${vb.h}" role="img" aria-label="${escapeXml((unit.type || '') + ' ' + (unit.plan || '') + ' floor plan')}" xmlns="http://www.w3.org/2000/svg">${rooms}${outline}${entry}${scaleBar}</svg>`;
}
