// The isometric lift's pure parts (arc 3, M5b): boxes for the low-wall model, room picking, label choice and camera fit. No Three, no DOM.
// Plan metres: x right, z = plan y (down), unit-local origin = the plan's top-left. The Three side (lift.js) only turns these boxes into meshes.
import { unitExtent } from './plan-svg.js';
export const LIFT = { inset: 0.03, wall: 0.1, floorTop: 0.12, floorBottom: 0.02, heights: { room: 1.1, wet: 1.1, out: 0.5 } };
export const LIFT_LABEL = 'Indicative 3D from published plans · rooms only; walls, doors and finishes are not shown';
// Each room: a floor slab and four thin walls, all inset from the room rectangle so neighbouring rooms never share a plane (a shared plane flickers on phones).
// The floor sits half inside the wall band, so its sides are hidden in the walls; it starts above y = 0 so its underside is not coplanar with the walls' feet.
// North and south walls take the full width, east and west only run between them: no two faces overlap in one plane.
export function liftBoxes(unit, opts = LIFT) {
  const out = [];
  unit.rooms.forEach((r, room) => {
    const g = opts.inset, x0 = r.x + g, x1 = r.x + r.w - g, z0 = r.y + g, z1 = r.y + r.h - g;
    const t = Math.min(opts.wall, 0.25 * Math.min(x1 - x0, z1 - z0)), H = opts.heights[r.kind] ?? opts.heights.room, kind = r.kind || 'room';
    const add = (part, bx0, bx1, by0, by1, bz0, bz1) => out.push({ room, part, kind, x0: bx0, x1: bx1, y0: by0, y1: by1, z0: bz0, z1: bz1 });
    add('floor', x0 + t / 2, x1 - t / 2, opts.floorBottom, opts.floorTop, z0 + t / 2, z1 - t / 2);
    add('wall', x0, x1, 0, H, z0, z0 + t);
    add('wall', x0, x1, 0, H, z1 - t, z1);
    add('wall', x0, x0 + t, 0, H, z0 + t, z1 - t);
    add('wall', x1 - t, x1, 0, H, z0 + t, z1 - t);
  });
  return out;
}
// The room under a unit-local point: the inset rectangle, so the thin gap between two touching rooms is not a room.
export function roomAt(unit, x, z, g = LIFT.inset) {
  return unit.rooms.findIndex(r => x > r.x + g && x < r.x + r.w - g && z > r.y + g && z < r.y + r.h - g);
}
export const labelledRooms = unit => unit.rooms.map((r, i) => (Math.min(r.w, r.h) >= 1.1 ? i : -1)).filter(i => i >= 0);
// Camera for the lifted unit around the origin (the group is centred on the extent). radius fits a sphere around the unit into the narrower of the two fields of view.
export function liftView(unit, aspect, fovDeg = 42) {
  const e = unitExtent(unit), half = Math.hypot(e.w, e.h) / 2, sin = Math.sin((fovDeg * Math.PI) / 360);
  const radius = (0.9 * half) / sin / Math.min(1, aspect);
  return { radius, phiDeg: 55, thetaDeg: aspect >= 0.8 ? 35 : 20, targetY: 0.4, minDistance: 0.35 * radius, maxDistance: 2.2 * radius };
}
