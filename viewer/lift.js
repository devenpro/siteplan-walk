// The isometric lift's Three side (arc 3, M5b): turns lift-geom.js boxes into two merged meshes (floors, walls), a pedestal, an entry wedge, room-name labels and a tapped-room marker.
// Browser only (Three comes from the importmap), so it is proved by the live checks, not by node tests. Everything is opaque: no transparency, no coplanar faces (see lift-geom.js).
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LIFT, liftBoxes, roomAt, labelledRooms } from './lift-geom.js';
import { unitExtent } from './plan-svg.js';

const FLOOR_COLOR = { room: 0xefe7d8, wet: 0xcddfe4, out: 0xd8e6c4 }, RISE_MS = 900, ENTRY_ROT = { up: Math.PI, right: Math.PI / 2, down: 0, left: -Math.PI / 2 };
const ease = k => 1 - Math.pow(1 - k, 3);
export function createLift({ scene, tier }) {
  let group = null, model = null, marker = null, unit = null, ext = null, labels = [], k = 1, t0 = null, rise = false;
  const raycaster = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -LIFT.floorTop), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  const mergedBoxes = (boxes, withColor) => {
    const parts = boxes.map(b => {
      const g = new THREE.BoxGeometry(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0); g.translate((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
      if (withColor) { const c = new THREE.Color(FLOOR_COLOR[b.kind] ?? FLOOR_COLOR.room), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
      return g;
    });
    const merged = mergeGeometries(parts, false); parts.forEach(g => g.dispose()); return merged;
  };
  const label = (text, x, y, z, cls) => { const el = document.createElement('div'); el.className = 'liftlab' + (cls ? ' ' + cls : ''); el.textContent = text; const o = new CSS2DObject(el); o.position.set(x, y, z); model.add(o); labels.push(o); return o; };
  function enter(u, { snap = false, minLabelSide = 1.1 } = {}) {
    exit(); unit = u; ext = unitExtent(u);
    const boxes = liftBoxes(u), shadows = !!(tier.lift && tier.lift.shadows);
    group = new THREE.Group(); group.name = 'lift';
    model = new THREE.Group(); model.position.set(-ext.w / 2, 0, -ext.h / 2); group.add(model);
    const floors = new THREE.Mesh(mergedBoxes(boxes.filter(b => b.part === 'floor'), true), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    const walls = new THREE.Mesh(mergedBoxes(boxes.filter(b => b.part === 'wall'), false), new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.88 }));
    for (const m of [floors, walls]) { m.castShadow = shadows; m.receiveShadow = shadows; model.add(m); }
    const R = 0.6 * Math.hypot(ext.w, ext.h), ped = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1.2, 64), new THREE.MeshStandardMaterial({ color: 0xd8d0c2, roughness: 0.95 }));
    ped.position.y = -0.06 - 0.6; ped.receiveShadow = shadows; group.add(ped);   // top at -0.06: never coplanar with the floor feet
    if (u.entry) {
      const wedge = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, LIFT.overlay.wedge[1] - LIFT.overlay.wedge[0], 3), new THREE.MeshStandardMaterial({ color: 0xd9622b, roughness: 0.7 }));
      wedge.position.set(u.entry.x, (LIFT.overlay.wedge[0] + LIFT.overlay.wedge[1]) / 2, u.entry.y); wedge.rotation.y = ENTRY_ROT[u.entry.dir] ?? 0; model.add(wedge);
      label('ENTRY', u.entry.x, LIFT.floorTop + 0.55, u.entry.y, 'entry');
    }
    for (const i of labelledRooms(u, minLabelSide)) { const r = u.rooms[i]; label(r.name, r.x + r.w / 2, LIFT.floorTop + 0.25, r.y + r.h / 2); }
    marker = new THREE.Mesh(new THREE.BoxGeometry(1, LIFT.overlay.marker[1] - LIFT.overlay.marker[0], 1), new THREE.MeshStandardMaterial({ color: 0xc8772a, roughness: 0.6 })); marker.visible = false; model.add(marker);
    scene.add(group);
    rise = !snap; k = snap ? 1 : 0; t0 = null; model.scale.y = snap ? 1 : 1e-3;
  }
  function frame(now) {
    if (!group || k >= 1) return;
    if (t0 === null) t0 = now;
    k = Math.min(1, (now - t0) / RISE_MS); model.scale.y = Math.max(1e-3, ease(k));
  }
  function pick(x, y, camera) {
    if (!group) return -1;
    ndc.set(x, y); raycaster.setFromCamera(ndc, camera);
    if (!raycaster.ray.intersectPlane(plane, hit)) return -1;
    return roomAt(unit, hit.x + ext.w / 2, hit.z + ext.h / 2);
  }
  function select(i) {
    if (!marker) return;
    const r = i >= 0 && unit.rooms[i]; if (!r) { marker.visible = false; return; }
    const inset = LIFT.inset + LIFT.wall;
    marker.scale.set(Math.max(0.1, r.w - 2 * inset), 1, Math.max(0.1, r.h - 2 * inset)); marker.position.set(r.x + r.w / 2, (LIFT.overlay.marker[0] + LIFT.overlay.marker[1]) / 2, r.y + r.h / 2); marker.visible = true;
  }
  function exit() {
    if (!group) return;
    for (const l of labels) { if (l.parent) l.parent.remove(l); l.element.remove(); }
    group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    scene.remove(group); group = model = marker = unit = ext = null; labels = []; k = 1; t0 = null; rise = false;
  }
  return { enter, exit, frame, pick, select, get active() { return !!group; }, get animating() { return !!group && k < 1; }, get group() { return group; }, get unit() { return unit; } };
}
