# M5b Isometric Lift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "View in 3D" button on an open plan lifts its rooms into an orbitable low-wall model in the engine's own scene, with room labels, tap-a-room readout, an entry marker and its own slow-device fallback.

**Architecture:** The lift renders in the existing renderer and canvas (no second WebGL context). While lifted, the site (`world`, except the table `base`) is hidden and a small `lift` group sits at the origin; the existing camera, `flyTo`, lights, sun-shadow fit and tiers are reused. Geometry, picking, camera fit and the fallback decision are pure functions in `viewer/lift-geom.js` (node-tested); `viewer/lift.js` turns them into Three meshes (live-checked only); `plans.js` owns the 2D/3D mode and `app.js` is the host that swaps the scene state.

**Tech Stack:** Vanilla ES modules, Three 0.170 (CDN importmap, `three/addons/utils/BufferGeometryUtils.js`), `node --test`, Playwright via `tools/check.mjs` on sv.

**Spec:** `docs/superpowers/specs/2026-10-25-property-viewing-experience-design.md` (section 6 row M5b; section 8 "Isometric lift uses the engine's Three.js"). Builds on M5a (`docs/superpowers/plans/2026-10-25-m5a-floor-plans-2d.md`, merged).

## Rulings made while planning (change any of these before execution)

- **R1. Separate flag `lift`** (spec says `plans`). M5a passed its phone gate as is; a second flag keeps that surface byte-identical until `?mods=experience,plans,lift`. `lift` does nothing without `plans`.
- **R2. One renderer, one canvas.** No second WebGL context (phones; flicker contract). Cost of being wrong: none visible; the 3D just shares the main canvas.
- **R3. Honest model.** Each room is a floor slab plus four thin low walls (open top), nothing else: no doors, windows, furniture or finishes. Walls are the room rectangles, not surveyed walls. Label, verbatim: `Indicative 3D from published plans · rooms only; walls, doors and finishes are not shown`.
- **R4. "Tier gate of its own"** = a per-tier `lift` setting in `TIERS` plus a measured fallback: if the lift is not smooth the viewer drops back to the 2D plan and hides the button for the session. The guard runs only when `?q` is not explicit, or when `?liftguard=1` forces it (so a check can prove it).
- **R5. Compare is a 2D feature.** Tapping a compare chip while in 3D returns to 2D first.
- **R6. Reduced motion:** with `prefers-reduced-motion: reduce` the lift snaps to its final state (no camera tween, no rise). The checks run with reduced motion, so they are deterministic.
- **R7. Deferred (ledger, not built):** a `#plan=2l&…3d` deep link (M6 presenter will want it); re-fitting the view when the phone rotates mid-lift.

## Global Constraints

- `lift` is default OFF; with it off (or `plans` off, or `experience` off): no 3D button in the DOM, `__walk.lift === null`, no `html.lifted` class, no change to any M5a behaviour. `?mods=none` forces it off.
- Flicker contract untouched: same canvas, opaque (`alpha` false), log depth and `near` unchanged, idle loop never stopped (the lift only adds `lift.animating` to the `moving` test), no `backdrop-filter` on phones, **no coplanar overlapping faces in the lift geometry** (unit-tested), all opaque materials.
- On-screen label (R3) is visible whenever the lift is on, with a visible room readout line; no price words (`₹`, `price`, `lakh`, `crore`).
- New CSS only under `html.exp`; the lift bar hides while the phone sheet is expanded, like `#tourbar`.
- Room names are rendered as text (`textContent`), never markup.
- WebGL/live checks run on sv in the capped container (`tools/run-on-sv.sh`), `check.mjs` alone; every new check is mutation-proved; evidence shots are looked at before the owner gate.

## Review Focus

- Leaving 3D by ANY route (2D plan button, Back, section tab, hotspot, tour, Escape, Reset view, a compare chip) restores the site, pins, orbit limits and `world` visibility. (Task 5 check 5.)
- Re-opening a plan after 3D starts in 2D; opening another plan while lifted is impossible (Back leaves 3D first). (Task 4 + 5.)
- A very small room (0.6 × 0.5 m) must not produce negative-length walls. (Task 1 test.)
- Two-finger touch must not pan the model off-screen (pan disabled while lifted). (Task 4, phone gate.)
- The slow-device fallback must not fire on a fast device and must fire on a slow one. (Task 2 test + Task 5 check 6.)

---

### Task 1: Pure lift geometry, picking and camera fit

**Files:**
- Create: `viewer/lift-geom.js`, `tests/lift-geom.test.mjs`

**Interfaces:**
- Produces (all pure, plan metres, x right, z = plan-y down, unit-local origin = plan top-left):
  - `LIFT = { inset: 0.03, wall: 0.1, floorTop: 0.12, floorBottom: 0.02, heights: { room: 1.1, wet: 1.1, out: 0.5 } }`
  - `liftBoxes(unit, opts = LIFT) -> [{ room, part: 'floor'|'wall', kind, x0, x1, y0, y1, z0, z1 }]` — per room one floor box and four wall boxes; the room rect is inset by `inset` on every side; walls occupy the outer `wall` band (thickness clamped to `0.25 × min(w, d)`), north and south walls span the full inset width, east and west walls span only between them; the floor spans `[inset + t/2, …]` (so its sides sit inside the walls) from `floorBottom` to `floorTop`; walls run `0 → heights[kind || 'room']`.
  - `roomAt(unit, x, z) -> index | -1` (first matching room in data order; the gaps between rooms are not rooms).
  - `labelledRooms(unit) -> number[]` — indexes of rooms with `min(w, d) >= 1.1` (the rest are named by tap only).
  - `liftView(unit, aspect, fovDeg = 42) -> { radius, phiDeg: 55, thetaDeg: 35 (aspect >= 0.8) | 20, targetY: 0.4, minDistance, maxDistance }` with `radius = 0.9 × (hypot(w, d) / 2) / sin(fov/2) / min(1, aspect)`, `minDistance = 0.35 × radius`, `maxDistance = 2.2 × radius`.
  - `LIFT_LABEL` (R3 text, verbatim).

- [ ] **Step 1: Write the failing tests** in `tests/lift-geom.test.mjs` (real units read from `projects/belvedere/units.json`, as `plan-svg.test.mjs` does):
  - `one floor and four walls per room, for every real unit` (5 boxes per room; parts counted).
  - `every box lies inside the unit rooms inset by the gap, and wall tops equal the kind height (balcony 0.5, others 1.1), floor top 0.12`.
  - `no two boxes share a coplanar, same-facing, overlapping face (the flicker guard)` — for every pair of boxes in every real unit, for each axis and sign, if the two faces are in the same plane (±1e-9), face the same way and their 2D overlap area is > 0, fail naming both boxes. Build the checker in the test file.
  - `a 0.6 x 0.5 m room gets walls of positive length and thickness <= 0.25 x its short side`.
  - `roomAt names the room at every room centre, -1 in the gap between two touching rooms and outside the unit`.
  - `labelledRooms excludes rooms narrower than 1.1 m and keeps the rest in data order`.
  - `liftView grows with the unit (3S radius > 1C radius), grows when the aspect narrows (0.5 vs 1.5), min/max bracket the radius`.
  - `LIFT_LABEL has the exact R3 text and no price word`.
- [ ] **Step 2: Run** `node --test tests/lift-geom.test.mjs` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `viewer/lift-geom.js` to the signatures above (no Three import, no DOM).
- [ ] **Step 4: Run** `node --test tests/*.test.mjs` — Expected: all pass (107 existing + new).
- [ ] **Step 5: Commit** `feat(m5b): pure lift geometry, room picking and camera fit`.

### Task 2: Flag, tier setting and the fallback decision

**Files:**
- Modify: `viewer/flags.js` (add `'lift'` to `MODULES`), `viewer/quality.js` (add `lift` per tier), `viewer/lift-geom.js` (add `shouldFallback`)
- Test: `tests/flags.test.mjs`, `tests/quality.test.mjs`, `tests/lift-geom.test.mjs`

**Interfaces:**
- Produces: `MODULES` includes `lift`; `TIERS.<t>.lift = { shadows: boolean }` — `high` and `mid` `true`, `low` `false`; `shouldFallback(frameMs: number[], { warmup = 8, minSamples = 40, limitMs = 45 } = {}) -> boolean` (false until `warmup + minSamples` samples exist; then true when the mean of the samples after the warmup exceeds `limitMs`).

- [ ] **Step 1: Write the failing tests.** flags: `lift` defaults false; `?mods=experience,plans,lift` turns it on; `?mods=none` turns it off; `site.json flags.lift: true` works. quality: every tier has `lift.shadows` boolean; `high` and `mid` true, `low` false. lift-geom: `shouldFallback` is false for 30 samples of 500 ms (too few), false for 60 samples of 16 ms, true for 60 samples of 80 ms, ignores a slow warmup (8 × 400 ms then 52 × 16 ms is false).
- [ ] **Step 2: Run** `node --test tests/*.test.mjs` — Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the three small changes.
- [ ] **Step 4: Run** `node --test tests/*.test.mjs` — Expected: all pass.
- [ ] **Step 5: Commit** `feat(m5b): lift flag, per-tier lift setting, slow-device fallback decision`.

### Task 3: The Three module

**Files:**
- Create: `viewer/lift.js`

**Interfaces:**
- Consumes: Task 1 and 2 exports.
- Produces: `createLift({ THREE, scene, CSS2DObject, mergeGeometries, tier })` → `{ enter(unit, { snap }), exit(), frame(now), pick(ndcX, ndcY, camera), select(i), get active(), get animating(), get group() }`.
  - `enter` builds, from `liftBoxes`: one merged floor mesh (vertex colours by kind: room `#efe7d8`, wet `#cddfe4`, out `#d8e6c4`) and one merged wall mesh (`#fffaf0`), both `MeshStandardMaterial`, opaque, `castShadow`/`receiveShadow` = `tier.lift.shadows`; a pedestal disc (cylinder, radius `0.6 × hypot(w,d)`, top at y = -0.06, 1.2 m tall, `#d8d0c2`); an entry wedge (3-segment cylinder, 0.04 thick, at `floorTop + 0.03`, orange `#d9622b`, `rotation.y` = up π / right π/2 / down 0 / left -π/2) plus an `ENTRY` label; one `CSS2DObject` room-name label (class `liftlab`, `textContent`, uppercase via CSS) per `labelledRooms`, at `floorTop + 0.25`. The group is centred on the unit extent. A selected-room marker is an opaque orange box 0.03 thick at `floorTop + 0.02`, hidden until `select(i)`.
  - `frame(now)` animates a rise `k` 0→1 over 900 ms (`group.scale.y`, with `1e-3` minimum), `snap` sets `k = 1` at once; `animating` is true until `k === 1`.
  - `pick` unprojects to the plane y = `floorTop` and returns `roomAt(...)` in unit-local coordinates.
  - `exit()` removes and disposes everything it made (geometries, materials, labels) so repeated enter/exit does not grow `renderer.info.memory.geometries`.

- [ ] **Step 1: Implement** `viewer/lift.js` to the contract (no node test is possible: Three loads from the CDN importmap; Task 5 carries the live proof).
- [ ] **Step 2: Syntax-check** `node --check viewer/lift.js` — Expected: no output.
- [ ] **Step 3: Commit** `feat(m5b): lift module (rooms as low-wall model, labels, entry wedge, picking)`.

### Task 4: Wiring — plans mode, host, markup, styles

**Files:**
- Modify: `viewer/plans.js`, `viewer/app.js`, `viewer/index.html`, `viewer/style.css`

**Interfaces:**
- `createPlans({ …, lift: boolean, onLift = () => {} })`: with `lift` true the plan detail gets a `View in 3D` button (`#planLift`, 44 px high) under the plan; `plans.mode` is `'2d' | '3d'`; `plans.setMode(mode)` (no-op for an unknown id or `lift` false) calls `onLift(unit | null)`; `open()` always starts `'2d'`; `close()` and `compare()` leave `'3d'` first (`onLift(null)`), also for silent closes (silent means no DOM/hash work, not "stay lifted"); `plans.disableLift(note)` removes the button and writes `note` into `#planRoom`.
- Host (`app.js`), only when `FLAGS.lift && plans`: `import { createLift }`, `mergeGeometries` from `three/addons/utils/BufferGeometryUtils.js`; `onLift(unit)`:
  - **enter:** end a running tour; `html.lifted` on; remember and hide every `world` child except `base` (store previous `visible`); save `controls` `minDistance, maxDistance, minPolarAngle, maxPolarAngle, enablePan, zoomToCursor`, then set `liftView` limits (polar 15°–75°, `enablePan = false`, `zoomToCursor = false`); `lift.enter(unit, { snap: reducedMotion })`; start the camera top-down (`phi` 8°) then `flyTo` the `liftView` (skip the tween when reduced motion); collapse the sheet on phones; show `#liftBar` with title, label and readout.
  - **exit:** `lift.exit()`, restore `world` children and saved controls, remove `html.lifted`, hide `#liftBar`, `flyTo(fitView())` (applyView directly when reduced motion).
  - Loop: add `(lift && lift.animating)` to `moving`; call `lift.frame(now)` before render; skip `updatePins` raycasting while lifted; pins are hidden by `html.lifted .pinwrap { display: none !important }`.
  - Canvas tap (pointerdown→pointerup under 6 px and 350 ms, while lifted): `lift.pick` → `lift.select` + readout `Name · w × d m · area m²` in `#liftRoom`; the existing double-tap fly handler returns early while lifted.
  - `Escape` while lifted → `plans.setMode('2d')`; `#btnReset` while lifted → `flyTo` the lift view; `select()`, `startTour()`, `showHome()` and a section-tab click leave 3D via `plans.close`/`setMode('2d')`.
  - Guard (R4): while lifted and busy, push frame deltas; when `shouldFallback(samples)` and (`!q.get('q')` or `q.get('liftguard') === '1'`): `plans.setMode('2d')` then `plans.disableLift('3D is not smooth on this device, so you are seeing the 2D plan.')`.
  - `__walk.lift` is the lift controller (or `null`), `__walk.liftState = { lifted, guardSamples }` for the checks.
- Markup: `#liftBar` (`hidden`) next to `#tourbar` holding a `‹ 2D plan` button (`#liftBack`), `#liftTitle`, `#liftRoom` (`aria-live="polite"`), and the label paragraph; styles mirror `#tourbar` (light background on phones, no `backdrop-filter`), sit at `bottom: calc(var(--sheet-h) + 10px)` on phones, hide while `#panel:not(.collapsed)` on phones.

- [ ] **Step 1: Implement** the wiring to the contract above. Keep every new line gated on `FLAGS.lift` so the flag-off path executes none of it.
- [ ] **Step 2: Run** `node --check viewer/app.js viewer/plans.js && node --test tests/*.test.mjs` — Expected: no output from check; all tests pass.
- [ ] **Step 3: Smoke** the page on sv with `?mods=experience,plans,lift` via a scratch script (`tools/_m5b-smoke.mjs`, gitignored): open `#plan=2l`, tap `#planLift`, read `__walk.liftState`, no `pageerror`.
- [ ] **Step 4: Commit** `feat(m5b): View in 3D mode, lift host, lift bar and styles`.

### Task 5: Live checks, mutations and evidence

**Files:**
- Create: `tools/m5b-checks.mjs`; Modify: `tools/check.mjs` (import and call `m5bChecks(b, url, ok, wire)` after `m5aChecks`), `docs/checkpoints/m5b/` (shots, `mutations.md`)

**Checks** (each opens its own page, `?q=low`, reduced motion, dispatched clicks, polling as in `m5a-checks.mjs`; imports `liftBoxes`/`labelledRooms` from `../viewer/lift-geom.js` for expectations):

1. **Flags:** with `experience,plans` only: no `#planLift`, `__walk.lift === null`, no `html.lifted`; with `experience,plans,lift`: the button exists after opening `#plan=2l`.
2. **Enter 3D (2L):** tap the button → `html.lifted`; `world` children other than `base` all invisible; `lift.group` has exactly the floor mesh, wall mesh, pedestal and entry wedge as meshes; `liftBar` visible with the R3 label; room-label count equals `labelledRooms(2l).length`; `__walk.stats().calls <= 24`; no `pageerror`; `renderer.info.memory.geometries` after enter→exit→enter→exit equals the count before the first enter.
3. **Geometry facts:** the group's world bounding box equals the unit extent within 0.3 m in x/z and its height is 1.1 ± 0.05 m; the alpha of every lift material is opaque (`transparent === false`).
4. **Tap a room:** project the centre of "Kitchen" (and, separately, the balcony) to screen coordinates, dispatch pointerdown/up there on `#gl`, and expect `#liftRoom` to read that room's name and `w × d m` from the data; tapping the empty pedestal clears the readout to the hint text.
5. **Every exit route** restores the site (`world` children visible as before, `controls.minDistance === 60`, `enablePan` true, no `html.lifted`, pins displayed): `#liftBack`, `#planBack`, a section tab, `__walk.select('<first hotspot>')`, `__walk.startTour(<first tour>)`, `Escape`, a compare chip.
6. **Fallback:** with `liftguard=1` on the software renderer, entering 3D ends in `plans.mode === '2d'`, `#planLift` absent, `#planRoom` containing `not smooth`; without `liftguard` the same page is still lifted after 5 s.

- [ ] **Step 1: Write the checks**, run them alone on sv with `tools/run-on-sv.sh` — Expected: 6/6 PASS (RED first for any check that passes without the feature: write each against a deliberately missing piece).
- [ ] **Step 2: Mutation proofs** (record CAUGHT/MISSED in `mutations.md`): (a) `inset: 0` → the coplanar unit test fails; (b) `exit()` skips restoring `world` → check 5 fails; (c) `pick` swaps x and z → check 4 fails; (d) the host ignores `FLAGS.lift` → check 1 fails; (e) `shouldFallback` always false → check 6 fails. Any MISSED mutation gets a stronger assertion before moving on.
- [ ] **Step 3: Full suite** — `node tools/check.mjs` alone on sv — Expected: the 45 existing + 6 new pass.
- [ ] **Step 4: Evidence shots** from the deployed page (desktop 1440 × 900 and phone 390 × 844, 2L and 3P, lifted and after a room tap), look at every one; fix what looks wrong (clipped labels, a hidden bar, the model off-centre) test-first.
- [ ] **Step 5: Commit** `test(m5b): live checks, mutation record and evidence`.

### Task 6: Docs, deploy, handoff

**Files:**
- Modify: `README.md` (flags table: `lift`; module list), `docs/superpowers/NEXT-SESSION-m5b-finish.md` (create)

- [ ] **Step 1: Update** the README flags/module notes and write the handoff (gate checklist, deferred minors, R7 items).
- [ ] **Step 2: Deploy** with `tools/deploy.sh` (flags stay off in `site.json`); verify `https://walk.csoul.cloud/belvedere/?mods=experience,plans,lift` opens a plan and the button works, and the flag-off URL is unchanged.
- [ ] **Step 3: Final whole-branch review** on model `fable` (Native method), fix Critical/Important test-first, ledger minors.
- [ ] **Step 4: Commit** `docs(m5b): readme, handoff`; then stop for the owner phone gate on `?mods=experience,plans,lift` (does the 3D read clearly, orbit and pinch smoothly, labels legible, the label visible, nothing reads as a price, Back works).
