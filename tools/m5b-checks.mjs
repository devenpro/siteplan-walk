// M5b live checks (isometric lift behind the `lift` flag): imported by check.mjs after m5aChecks; runnable alone through a scratch runner like tools/_m5a-smoke.mjs.
// Each scenario opens its own page and never throws: a missing element becomes {error} and fails its check instead of killing the run. Clicks are dispatched and waits are interval polls (a ~1 fps software renderer stalls Playwright's actionability waits).
import fs from 'node:fs';
import { LIFT, LIFT_LABEL, liftBoxes, labelledRooms } from '../viewer/lift-geom.js';
const UNITS = JSON.parse(fs.readFileSync(new URL('../projects/belvedere/units.json', import.meta.url), 'utf8')).units, unitOf = id => UNITS.find(u => u.id === id);
export async function m5bChecks(b, url, ok, wire) {
  const want = n => !process.env.M5B_ONLY || process.env.M5B_ONLY.split(',').includes(String(n));   // scratch runs: M5B_ONLY=3,4 runs just those scenarios (used for mutation proofs)
  const MODS = 'experience,plans,lift', HINT = 'Tap a room for its name and size.', FORBID = /₹|price|lakh|crore/i;
  const open = async ({ search = {}, hash = '#plan=2l', width = 1440, height = 900, pre = null, mods = MODS } = {}) => {
    const ctx = await b.newContext({ viewport: { width, height }, reducedMotion: 'reduce' }), pg = await ctx.newPage(); pg.__fatal = []; pg.on('pageerror', e => pg.__fatal.push(e.message)); wire(pg);
    if (pre) await pre(pg);
    const u = new URL(url); u.searchParams.set('autostart', '800'); u.searchParams.set('q', 'low'); if (mods) u.searchParams.set('mods', mods); for (const [k, v] of Object.entries(search)) u.searchParams.set(k, v); u.hash = hash;
    await pg.goto(u.toString(), { waitUntil: 'networkidle', timeout: 120000 });
    await pg.waitForFunction(() => !!window.__walk, null, { timeout: 180000 }); await pg.waitForTimeout(2500);
    return { ctx, pg };
  };
  const run = async fn => { try { return await fn(); } catch (e) { return { error: String(e.message || e).split('\n')[0] }; } };
  const tap = (pg, sel) => pg.evaluate(q => { const e = document.querySelector(q); if (!e) throw new Error('no element ' + q); e.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }, sel);
  const poll = async (pg, fn, arg, what, t = 60000) => { const t0 = Date.now(); for (;;) { if (await pg.evaluate(fn, arg)) return; if (Date.now() - t0 > t) throw new Error('timeout waiting for ' + what); await pg.waitForTimeout(250); } };
  const lifted = (pg, want = true) => poll(pg, w => window.__walk.liftState.lifted === w, want, want ? 'lift on' : 'lift off');
  const enter = async pg => { await poll(pg, () => !!document.querySelector('#planLift'), null, '#planLift'); await tap(pg, '#planLift'); await lifted(pg); };
  // the site's state, to compare against after every exit
  const siteState = pg => pg.evaluate(() => { const w = window.__walk, c = w.controls, probe = document.createElement('div'); probe.className = 'pinwrap'; document.getElementById('labels').appendChild(probe); const pinDisplay = getComputedStyle(probe).display; probe.remove();   // a fresh pin wrapper: CSS2DRenderer sets inline display none on real pins that are off screen
    return { visible: w.world.children.filter(x => x.visible).length, min: c.minDistance, max: c.maxDistance, pan: c.enablePan, polar: [c.minPolarAngle, c.maxPolarAngle].map(v => +v.toFixed(3)), cls: document.documentElement.classList.contains('lifted'), pins: pinDisplay, inScene: !!w.scene.getObjectByName('lift'), labels: document.querySelectorAll('.liftlab').length, barHidden: document.getElementById('liftBar') ? document.getElementById('liftBar').hidden : true }; });

  if (want(1)) {
  // 1. flags: lift needs its own flag AND plans AND experience
  const flags = await run(async () => {
    const reqsOff = [], reqsOn = [];
    const off = await open({ mods: 'experience,plans', pre: pg => pg.on('request', r => reqsOff.push(r.url())) }), on = await open({ pre: pg => pg.on('request', r => reqsOn.push(r.url())) }), noPlans = await open({ mods: 'experience,lift', hash: '' });
    const st = pg => pg.evaluate(() => ({ btn: !!document.querySelector('#planLift'), lift: window.__walk.lift === null ? null : 'ctl', cls: document.documentElement.classList.contains('lifted'), bar: !!document.getElementById('liftBar'), flag: window.__walk.flags.lift }));
    const r = { off: await st(off.pg), on: await st(on.pg), noPlans: await st(noPlans.pg), offReq: reqsOff.some(u => /lift(-geom)?\.js/.test(u)), onReq: reqsOn.some(u => /lift\.js/.test(u)), onText: await on.pg.evaluate(() => document.querySelector('#planLift') && document.querySelector('#planLift').textContent) };
    for (const c of [off, on, noPlans]) await c.ctx.close(); return r; });
  ok('M5b flags: with plans but not lift there is no 3D button, no lift controller, no #liftBar and no lift module request; with lift the button reads "View in 3D"; lift without plans does nothing',
    !flags.error && !flags.off.btn && flags.off.lift === null && !flags.off.bar && !flags.off.cls && !flags.offReq && flags.on.btn && flags.on.lift === 'ctl' && flags.onReq && flags.onText === 'View in 3D' && !flags.noPlans.btn && flags.noPlans.lift === null, JSON.stringify(flags));

  }
  if (want(2)) {
  // 2. enter 3D (2L): the site goes, a small model comes; the draw budget holds; repeated enter/exit leaks nothing
  const enterR = await run(async () => {
    const a = await open(), r = {}; r.before = await siteState(a.pg); r.g0 = await a.pg.evaluate(() => window.__walk.renderer.info.memory.geometries);
    for (let i = 0; i < 3; i++) { await enter(a.pg); await poll(a.pg, g0 => window.__walk.renderer.info.memory.geometries > g0, r.g0, 'the lift geometry to reach the GPU'); await tap(a.pg, '#planLift'); await lifted(a.pg, false); }   // a geometry only counts once a frame has uploaded it
    r.g1 = await a.pg.evaluate(() => window.__walk.renderer.info.memory.geometries); await enter(a.pg); await a.pg.waitForTimeout(2500);
    r.on = await a.pg.evaluate(() => { const w = window.__walk, bar = document.getElementById('liftBar'); let meshes = 0; w.lift.group.traverse(o => { if (o.isMesh) meshes++; });
      return { cls: document.documentElement.classList.contains('lifted'), visibleWorld: w.world.children.filter(x => x.visible).length, base: w.world.children.filter(x => x.visible).every(x => x.geometry && x.geometry.type === 'CircleGeometry'), meshes, labels: document.querySelectorAll('.liftlab').length, barText: bar.textContent, barShown: !bar.hidden && bar.checkVisibility(), creditClear: (() => { const b = bar.getBoundingClientRect(), c = document.getElementById('credit').getBoundingClientRect(); return b.right <= c.left || b.left >= c.right || b.bottom <= c.top || b.top >= c.bottom; })(), calls: w.stats().calls, tris: w.stats().triangles, mode: w.plans.mode, btn: document.getElementById('planLift').textContent, bodyText: document.body.innerText }; });
    r.fatal = a.pg.__fatal; await a.ctx.close(); return r; });
  ok('M5b enter 3D (2L): only the table stays of the site, 5 lift meshes, a name label per labelled room + ENTRY, the verbatim label in the bar and clear of the credit line, <= 24 draw calls and < 5000 triangles, no price words; three enter/exit cycles leave the geometry count where it started',
    !enterR.error && enterR.on.cls && enterR.on.visibleWorld === 1 && enterR.on.base && enterR.on.meshes === 5 && enterR.on.labels === labelledRooms(unitOf('2l')).length + 1 && enterR.on.barText.includes(LIFT_LABEL) && enterR.on.barShown && enterR.on.creditClear && enterR.on.calls <= 24 && enterR.on.tris < 5000 && enterR.on.mode === '3d' && enterR.on.btn === 'Back to 2D plan' && !FORBID.test(enterR.on.bodyText) && enterR.g1 === enterR.g0 && enterR.fatal.length === 0, JSON.stringify(enterR.error ? enterR : { ...enterR, on: { ...enterR.on, bodyText: undefined } }));

  }
  if (want(3)) {
  // 3. geometry facts of the live meshes against the pure boxes
  const geo = await run(async () => {
    const a = await open(); await enter(a.pg);
    const r = await a.pg.evaluate(() => { const w = window.__walk, T = w.THREE, model = w.lift.group.children[0], box = new T.Box3(); w.lift.group.updateMatrixWorld(true);   // world matrices are refreshed by a render, which a slow renderer may not have done yet
      box.expandByObject(model.children[0]); box.expandByObject(model.children[1]);
      const opaque = []; w.lift.group.traverse(o => { if (o.isMesh) opaque.push(o.material.transparent === false && o.material.opacity === 1); }); return { min: box.min.toArray(), max: box.max.toArray(), opaque, scaleY: model.scale.y }; });
    await a.ctx.close(); const bs = liftBoxes(unitOf('2l')), ext = { w: Math.max(...unitOf('2l').rooms.map(x => x.x + x.w)), h: Math.max(...unitOf('2l').rooms.map(x => x.y + x.h)) };
    const exp = { x0: Math.min(...bs.map(x => x.x0)) - ext.w / 2, x1: Math.max(...bs.map(x => x.x1)) - ext.w / 2, z0: Math.min(...bs.map(x => x.z0)) - ext.h / 2, z1: Math.max(...bs.map(x => x.z1)) - ext.h / 2, top: Math.max(...bs.map(x => x.y1)) };
    return { ...r, exp }; });
  ok('M5b geometry: the lifted 2L model spans exactly the room boxes (x and z within 1 cm, centred on the origin), rises to 1.1 m, finished its rise, and every material is opaque',
    !geo.error && Math.abs(geo.min[0] - geo.exp.x0) < 0.01 && Math.abs(geo.max[0] - geo.exp.x1) < 0.01 && Math.abs(geo.min[2] - geo.exp.z0) < 0.01 && Math.abs(geo.max[2] - geo.exp.z1) < 0.01 && Math.abs(geo.max[1] - geo.exp.top) < 0.01 && geo.scaleY === 1 && geo.opaque.length === 5 && geo.opaque.every(Boolean), JSON.stringify(geo));

  }
  if (want(4)) {
  // 4. tapping a room names it; tapping empty space clears the readout
  const tapR = await run(async () => {
    const a = await open(), out = []; await enter(a.pg); const u = unitOf('2l');
    const at = (x, y) => a.pg.evaluate(({ x, y }) => { const c = document.getElementById('gl'), o = { clientX: x, clientY: y, bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0 }; c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o)); return document.getElementById('liftRoom').textContent; }, { x, y });
    for (const name of ['Kitchen', 'Balcony', 'Master bedroom']) {
      const i = u.rooms.findIndex(r => r.name === name), r = u.rooms[i];
      const xy = await a.pg.evaluate(({ r }) => { const w = window.__walk, model = w.lift.group.children[0], v = new w.THREE.Vector3(r.x + r.w / 2, 0.12, r.y + r.h / 2); model.updateMatrixWorld(true); model.localToWorld(v); v.project(w.camera); const c = document.getElementById('gl').getBoundingClientRect(); return { x: c.left + ((v.x + 1) / 2) * c.width, y: c.top + ((1 - v.y) / 2) * c.height }; }, { r });
      out.push({ name, got: await at(xy.x, xy.y), want: `${r.name} · ${r.w.toFixed(2)} × ${r.h.toFixed(2)} m · ${(r.w * r.h).toFixed(1)} m²` });
    }
    const empty = await at(12, 450); await a.ctx.close(); return { out, empty }; });
  ok('M5b tap a room: Kitchen, Balcony and Master bedroom each read "Name · w × d m · area m²" from the data after a tap on their projected centre; a tap on empty space restores the hint', !tapR.error && tapR.out.every(o => o.got === o.want) && tapR.empty === HINT, JSON.stringify(tapR));

  }
  if (want(5)) {
  // 5. every way out restores the site; Reset view stays in the lift
  const exits = await run(async () => {
    const a = await open(), res = {}, base = await siteState(a.pg); res.base = base;
    const reopen = () => a.pg.evaluate(() => { if (!window.__walk.plans.openId) window.__walk.plans.open('2l'); });
    const routes = [
      ['2D plan button', pg => tap(pg, '#liftBack')], ['planLift toggle', pg => tap(pg, '#planLift')], ['All homes', pg => tap(pg, '#planBack')], ['section tab', pg => tap(pg, '#sections button[data-view="tours"]')],
      ['hotspot', pg => pg.evaluate(() => window.__walk.select(window.__walk.hotspots[0].id, false))], ['tour', pg => pg.evaluate(() => window.__walk.startTour(window.__walk.site.tours[0].id))],
      ['Escape', pg => pg.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))], ['compare chip', pg => tap(pg, '.compare-chip[data-id="3g"]')],
    ];
    for (const [name, go] of routes) {
      await reopen(); await a.pg.waitForTimeout(300); await enter(a.pg); await go(a.pg); await lifted(a.pg, false); await a.pg.waitForTimeout(400);
      const s = await siteState(a.pg); res[name] = { ...s, tour: await a.pg.evaluate(() => !!window.__walk.tour), mode: await a.pg.evaluate(() => window.__walk.plans.mode) };
      await a.pg.evaluate(() => { if (window.__walk.tour) window.__walk.endTour(false); });
    }
    await reopen(); await enter(a.pg); const before = await a.pg.evaluate(() => window.__walk.currentView().radius); await tap(a.pg, '#btnReset'); await a.pg.waitForTimeout(1200);
    res.reset = await a.pg.evaluate(() => ({ lifted: window.__walk.liftState.lifted, radius: window.__walk.currentView().radius, min: window.__walk.controls.minDistance, max: window.__walk.controls.maxDistance })); res.reset.before = before;
    res.fatal = a.pg.__fatal; await a.ctx.close(); return res; });
  const restored = (s, b0) => s && s.cls === false && s.visible === b0.visible && s.min === b0.min && s.max === b0.max && s.pan === b0.pan && s.polar.join() === b0.polar.join() && s.pins === b0.pins && s.inScene === false && s.labels === 0 && s.barHidden === true && s.mode === '2d';
  ok('M5b exits: 2D-plan button, the 3D toggle, All homes, a section tab, a hotspot, a tour, Escape and a compare chip each end the lift and restore the site (world visible, orbit limits, pan, pins, no lift in the scene, no labels); Reset view stays lifted inside the lift limits',
    !exits.error && ['2D plan button', 'planLift toggle', 'All homes', 'section tab', 'hotspot', 'tour', 'Escape', 'compare chip'].every(k => restored(exits[k], exits.base)) && exits.tour.tour === true && exits.reset.lifted && exits.reset.radius >= exits.reset.min && exits.reset.radius <= exits.reset.max && exits.fatal.length === 0, JSON.stringify(exits.error ? exits : { base: exits.base, bad: Object.entries(exits).filter(([k, v]) => v && v.cls !== undefined && k !== 'base' && !restored(v, exits.base)).map(([k, v]) => [k, v]), reset: exits.reset, tour: exits.tour && exits.tour.tour }));

  }
  if (want(6)) {
  // 6. the lift's own tier gate: forced on a slow renderer it falls back to the 2D plan; left alone on a normal ?q it stays
  const gate = await run(async () => {
    const drive = (pg, ms) => pg.evaluate(async ms => { const w = window.__walk, t0 = performance.now(); while (performance.now() - t0 < ms && !w.liftState.broken) { w.controls.dispatchEvent({ type: 'change' }); await new Promise(r => setTimeout(r, 120)); } return w.liftState; }, ms);
    const slow = await open({ search: { liftguard: '1' }, width: 800, height: 600 }); await enter(slow.pg); const s1 = await drive(slow.pg, 170000);
    const after = await slow.pg.evaluate(() => ({ mode: window.__walk.plans.mode, btn: !!document.querySelector('#planLift'), room: document.getElementById('planRoom').textContent, cls: document.documentElement.classList.contains('lifted'), lifted: window.__walk.liftState.lifted })); await slow.ctx.close();
    const fine = await open({ width: 800, height: 600 }); await enter(fine.pg); const s2 = await drive(fine.pg, 8000);
    const stay = { lifted: s2.lifted, broken: s2.broken, guard: s2.guard, btn: await fine.pg.evaluate(() => !!document.querySelector('#planLift')) }; await fine.ctx.close();
    return { s1, after, stay }; });
  ok('M5b slow-device gate: with ?liftguard=1 on the software renderer the lift gives way to the 2D plan, drops the button and says "not smooth"; without it (explicit ?q) the same page stays lifted', !gate.error && gate.s1.broken && gate.after.mode === '2d' && !gate.after.btn && /not smooth/.test(gate.after.room) && !gate.after.cls && !gate.after.lifted && gate.s1.guard && gate.stay.lifted && !gate.stay.broken && !gate.stay.guard && gate.stay.btn, JSON.stringify(gate));

  }
  if (want(7)) {
  // 7. phone: the sheet gives way to the model, the bar sits above it and its button is tappable; nothing scrolls sideways
  const phone = await run(async () => {
    const r = {}; for (const [w, h] of [[390, 780], [320, 640]]) {
      const a = await open({ hash: '#plan=3p', width: w, height: h }); await enter(a.pg);
      { let last = null, same = 0; for (let i = 0; i < 50 && same < 3; i++) { const t = await a.pg.evaluate(() => document.getElementById('panel').getBoundingClientRect().top); same = t === last ? same + 1 : 0; last = t; await a.pg.waitForTimeout(200); } }   // the sheet slides down over 0.35 s on a slow renderer: measure only once it has stopped
      r[w] = await a.pg.evaluate(() => { const bar = document.getElementById('liftBar'), back = document.getElementById('liftBack'), panel = document.getElementById('panel'), bb = bar.getBoundingClientRect(), pb = panel.getBoundingClientRect(), k = back.getBoundingClientRect(), hit = document.elementFromPoint(k.x + k.width / 2, k.y + k.height / 2);
        return { collapsed: panel.classList.contains('collapsed'), barShown: bar.checkVisibility(), aboveSheet: bb.bottom <= pb.top + 1, tappable: hit === back || back.contains(hit), overflowX: document.documentElement.scrollWidth - window.innerWidth, labels: document.querySelectorAll('.liftlab').length, w: Math.round(bb.width) }; });
      await tap(a.pg, '#liftBack'); await lifted(a.pg, false); await a.pg.waitForTimeout(600);
      r[w].back = await a.pg.evaluate(() => ({ collapsed: document.getElementById('panel').classList.contains('collapsed'), planShown: !document.getElementById('panelPlan').hidden, mode: window.__walk.plans.mode }));   // "2D plan" must show the 2D plan, not an empty tab row
      await a.ctx.close(); }
    return r; });
  ok('M5b phone (390 and 320 px): entering 3D collapses the sheet, the bar is shown above it with a tappable "2D plan" button, only rooms at least 1.6 m across carry a name label (plus ENTRY) and the page does not scroll sideways; the "2D plan" button brings the sheet back up with the plan open', !phone.error && [390, 320].every(w => phone[w] && phone[w].collapsed && phone[w].barShown && phone[w].aboveSheet && phone[w].tappable && phone[w].back.collapsed === false && phone[w].back.planShown && phone[w].back.mode === '2d' && phone[w].overflowX <= 0 && phone[w].labels === labelledRooms(unitOf('3p'), 1.6).length + 1), JSON.stringify(phone));
  }
}
