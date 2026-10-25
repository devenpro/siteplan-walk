# M1 Shell + Georef Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the flag registry, hash router, georeference and section shell that every later arc-3 module plugs into, with Belvedere georeferenced and the whole thing invisible when flags are off.

**Architecture:** Four small pure modules in `viewer/` (`flags.js`, `hash.js`, `geo.js`, `sections.js`), each node-tested like `viz-label.js`. `app.js` consumes them. A section bar (a tab row at the top of the panel/sheet) switches which blocks of `#panelHome` show, only when the `experience` flag is on. With flags off, DOM visibility, hashes and behaviour are byte-identical to today.

**Tech Stack:** Vanilla ES modules, Three.js r170 (unchanged), `node --test`, Playwright via `tools/check.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-25-property-viewing-experience-design.md` (sections 2, 4, 6 row M1, 8).

## Global Constraints

- Flags are read from `site.json` `flags` and a `?mods=` override; all default OFF. `?mods=none` forces every module off, even if `site.json` turns it on.
- Flag-off regression: with `?mods=none`, the existing 31 live checks pass unchanged and hashes stay exactly `#h=<id>` and `#tour=<id>`.
- Flicker contract (B arc) must hold: opaque canvas, log depth near 2 / far 3600, no coplanar caps, no `backdrop-filter` on phones, idle loop never fully stopped. M1 adds no GL objects and no draw calls.
- `--sheet-h` is read by `SHEET_H` in `app.js` to offset the camera; a taller phone sheet must be done by overriding `--sheet-h` under `html.exp`, not by a second constant.
- Georef acceptance: fit with 2 control points, then at least 3 independent check points all within 20 m; fitted scale within 5 % of `site.scale.metresPerPx`, fitted north within 5 degrees of `site.plan.northDeg` (convention: degrees clockwise from image-up).
- OpenStreetMap data carries ODbL attribution in `PROVENANCE.md` and the geo block. Brochure material never enters this public repo.
- WebGL checks run on sv in a capped container, never on the csoul host. Recipe: memory note `siteplan-walk-belvedere`, entry "LIVE CHECK 2026-10-25" (`git archive` to sv, `node:22` image, apt ffmpeg, `npm install` in `tools/`, `npx playwright install --with-deps chromium`, `--cpus=3 --memory=6g`).
- Every new check is mutation-proved (break the code, watch the check fail). Run `check.mjs` alone.
- No new AI media, no Higgsfield spend. Distances are straight-line; no minutes.

## Review Focus

- `?mods=none` must beat `site.json` flags that are true; `?mods=` with unknown names or stray commas must not throw or enable anything. (Task 1 tests.)
- Old deep links `#h=<id>` and `#tour=<id>` keep working; ids containing `%`-encoded characters survive a round trip; duplicate or unknown keys do not break parsing. (Task 2 tests.)
- `#view=<name>` for a section that does not exist (module off, typo) falls back to the default view, never a blank panel. (Task 4 tests + Task 7 check.)
- A dataset with no `geo` block (every other project) boots with `__walk.geo === null` and no console error. (Task 3 test + Task 7 check.)
- Starting a tour from the Tours view, then ending it, leaves the panel showing a non-empty view; selecting a hotspot while on Tours and pressing Back returns to Tours. (Task 6 wiring + Task 7 check.)

---

## File Structure

- Create `viewer/flags.js`, `viewer/hash.js`, `viewer/geo.js`, `viewer/sections.js` (pure, no DOM, no Three).
- Create `tests/flags.test.mjs`, `tests/hash.test.mjs`, `tests/geo.test.mjs`, `tests/sections.test.mjs`.
- Create `tools/osm-snapshot.mjs` (authoring-time Overpass fetch, reused by M2) and `tools/georef-check.mjs` (fit + residual report, exit 1 on a miss).
- Create `projects/belvedere/source/osm-georef.json` (snapshot) and `docs/checkpoints/m1/georef.md` (verification links for the owner).
- Modify `projects/belvedere/site.json` (add `geo`; leave `flags` absent), `projects/belvedere/source/PROVENANCE.md`.
- Modify `viewer/index.html` (section bar, `data-view` attributes), `viewer/style.css` (`html.exp` rules), `viewer/app.js` (consume the four modules).
- Modify `tools/check.mjs` (new checks).

---

### Task 1: Flag registry

**Files:** Create `viewer/flags.js`; Test `tests/flags.test.mjs`

**Interfaces:**
- Produces: `export const MODULES = ['experience','context','location','plans','presenter','connect','walkin']`; `export function resolveFlags(site, search): Record<string, boolean>` (every module name is a key). `search` is a `location.search` string.

- [ ] **Step 1: Write the failing tests** in `tests/flags.test.mjs`:
  - `defaults: no flags anywhere => every module false`.
  - `site.flags turns a module on`: `resolveFlags({flags:{experience:true}}, '')` has `experience === true`, `context === false`.
  - `?mods= adds`: `resolveFlags({}, '?mods=experience,context')` turns on both.
  - `?mods=none beats site flags`: `resolveFlags({flags:{experience:true}}, '?mods=none')` is all false.
  - `junk is ignored`: `'?mods=,,bogus, experience ,'` enables only `experience`; non-boolean site flag values (`"yes"`, `1`) do not enable.
  - `undefined site and empty search do not throw`.
- [ ] **Step 2: Run** `node --test tests/flags.test.mjs`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `resolveFlags`** in `viewer/flags.js` with `URLSearchParams`; only strict `true` counts from `site.flags`; trim each `mods` token.
- [ ] **Step 4: Run** the test again. Expected: PASS.
- [ ] **Step 5: Commit** `git add viewer/flags.js tests/flags.test.mjs && git commit -m "feat(m1): flag registry (default off, ?mods= override, none beats site)"` with the attribution trailer.

### Task 2: Hash router

**Files:** Create `viewer/hash.js`; Test `tests/hash.test.mjs`

**Interfaces:**
- Produces: `export function parseHash(hash: string): { h?: string, tour?: string, view?: string, plan?: string }`; `export function formatHash(state): string` returning `''` when empty, else `'#' + 'view=…&h=…&tour=…&plan=…'` in that key order, skipping empty values, `encodeURIComponent` on values.

- [ ] **Step 1: Write the failing tests:**
  - `parse legacy`: `parseHash('#h=entrance-portal')` equals `{h:'entrance-portal'}`; `parseHash('#tour=overview')` equals `{tour:'overview'}`.
  - `round trip with encoding`: an id `'a b&c%d'` survives `parseHash(formatHash({h:id}))`.
  - `exact keys`: `parseHash('#xh=1&h=ok')` gives `{h:'ok'}` (no substring matching, the old regex bug); unknown keys are dropped; first duplicate wins.
  - `format order and empties`: `formatHash({h:'x',view:'tours'})` is `'#view=tours&h=x'`; `formatHash({})` and `formatHash({h:''})` are `''`.
  - `legacy bytes`: `formatHash({h:'x'})` is exactly `'#h=x'` and `formatHash({tour:'t'})` exactly `'#tour=t'`.
- [ ] **Step 2: Run** `node --test tests/hash.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** both functions in `viewer/hash.js`; split on `&`, then on the first `=`; guard `decodeURIComponent` against malformed input (return the raw text).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(m1): hash router (parseHash/formatHash, legacy #h= and #tour= bytes unchanged)`.

### Task 3: Georef maths

**Files:** Create `viewer/geo.js`; Test `tests/geo.test.mjs`

**Interfaces:**
- Produces: `fitGeo(points: {px:[number,number], lat:number, lon:number}[]): Geo` (throws `Error('geo: need at least 2 distinct points')` for fewer than 2 or identical px); `pxToLatLon(geo, [x,y]): [lat, lon]`; `latLonToPx(geo, lat, lon): [x, y]`; `distanceM(lat1, lon1, lat2, lon2): number` (haversine); `residualsM(geo, points): number[]`; `scaleOf(geo): number` (metres per px); `northDegOf(geo): number` (degrees clockwise from image-up, in [0,360)). `Geo` is opaque to callers.
- Approach: local east/north metres about the first point (`mLat = 110574`, `mLon = 111320*cos(lat0)`), least-squares similarity as a complex multiply-add `E + iN = a*(x - i*y) + b`; plan y is down so negate it.

- [ ] **Step 1: Write the failing tests** (synthetic, no site data):
  - Build points from a known truth: scale 0.343 m/px, north 135, origin (13.05, 77.75); assert `scaleOf` within 0.1 %, `northDegOf` within 0.1 degrees, `residualsM` all under 0.01 m with 2 and with 4 exact points.
  - Round trip: `latLonToPx(geo, ...pxToLatLon(geo, p))` within 1e-6 px.
  - Image-up north: points where image-up is north give `northDegOf` ≈ 0 and increasing lat as y decreases.
  - `distanceM(13.0,77.0,13.0,77.001)` within 1 % of 108.5 m.
  - Noise: perturb one of 4 points by 8 m; `residualsM` max is below 12 m.
  - Throws on 1 point and on two identical px.
- [ ] **Step 2: Run** `node --test tests/geo.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** the six exports in `viewer/geo.js`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(m1): georef maths (similarity fit, residuals, scale and north readbacks)`.

### Task 4: Sections registry

**Files:** Create `viewer/sections.js`; Test `tests/sections.test.mjs`

**Interfaces:**
- Consumes: `resolveFlags` output shape from Task 1.
- Produces: `export const DEFAULT_VIEW = 'masterplan'`; `export function resolveSections(flags, site): {id: string, label: string}[]` (empty when `flags.experience` is false; else `masterplan` / "Master plan", plus `tours` / "Tours" only when `site.tours` is a non-empty array; later modules append their own); `export function resolveView(id, sections): string` (the id if present in `sections`, else `DEFAULT_VIEW` if present, else `''`).

- [ ] **Step 1: Write the failing tests:** experience off gives `[]`; on with tours gives ids `['masterplan','tours']`; on without tours gives `['masterplan']`; `resolveView('tours', ...)` true case; `resolveView('surroundings', ...)` falls back to `'masterplan'`; `resolveView('x', [])` is `''`.
- [ ] **Step 2: Run** `node --test tests/sections.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** in `viewer/sections.js`.
- [ ] **Step 4: Run** and then the whole suite `node --test tests/*.test.mjs`. Expected: PASS, no regressions.
- [ ] **Step 5: Commit** `feat(m1): sections registry and view resolution`.

### Task 5: Belvedere georef data

**Files:** Create `tools/osm-snapshot.mjs`, `tools/georef-check.mjs`, `projects/belvedere/source/osm-georef.json`, `docs/checkpoints/m1/georef.md`; Modify `projects/belvedere/site.json`, `projects/belvedere/source/PROVENANCE.md`, `tests/geo.test.mjs` (add a Belvedere test)

**Interfaces:**
- Consumes: `fitGeo`, `residualsM`, `scaleOf`, `northDegOf`, `pxToLatLon` (Task 3).
- Produces: `site.json` block `"geo": { "points": [{"label","px":[x,y],"lat","lon","source"}], "check": [same shape, at least 3], "method": "<one sentence>", "asOf": "YYYY-MM-DD", "attribution": "© OpenStreetMap contributors (ODbL)" }`. `tools/georef-check.mjs <slug>` prints residuals for `check`, fitted scale vs `site.scale.metresPerPx`, fitted north vs `site.plan.northDeg`, and exits 1 on any miss against the Global Constraints thresholds. `tools/osm-snapshot.mjs --lat --lon --radius <m> --out <file>` writes Overpass JSON for `way[building]` and `way[highway]`, retrying across mirrors on 502/timeout.

Source ladder for the points, in this order (record which one worked in `method`; coordinates must never be guessed):
1. OSM: look for building or construction polygons in the snapshot that match the plan's Tower A and Tower B footprints, or a road edge in front of the plot that matches the plan's bottom edge. Centre the snapshot on Budigere Cross (13.0462, 77.7504), radius 1500 m.
2. Public listings: the brochure location map is a stylised "not to scale" illustration, so it is NOT a georef source (use it only as the M3 map card).
3. Owner map pins: ask the owner (one question, CLI) to drop Google Maps pins on the entrance portal (plan item 01) and the plot's four boundary corners, and paste the lat/lon. Two pins fit; the others check.

- [ ] **Step 1: Write the failing Belvedere test** in `tests/geo.test.mjs`: load `projects/belvedere/site.json`; assert `site.geo.points.length >= 2`, `site.geo.check.length >= 3`; `fitGeo(points)`; every `residualsM(geo, check)` ≤ 20; `|scaleOf/site.scale.metresPerPx - 1| ≤ 0.05`; north difference ≤ 5 degrees (use wrap-safe difference); and that `pxToLatLon` of the boundary centroid is within 1500 m of Budigere Cross. Also a no-geo case: a site without `geo` is handled by the caller (document in the test that `fitGeo` is only called when `geo` exists).
- [ ] **Step 2: Run** `node --test tests/geo.test.mjs`. Expected: the Belvedere test FAILS (no `geo` block).
- [ ] **Step 3: Implement `tools/osm-snapshot.mjs`, run it, commit the snapshot**; work down the source ladder to obtain points; add the `geo` block; write the ODbL attribution and source line into `PROVENANCE.md`.
- [ ] **Step 4: Implement `tools/georef-check.mjs`**, run `node tools/georef-check.mjs belvedere`. Expected: exit 0 with every check residual ≤ 20 m. If the ladder cannot reach this, STOP and tell the owner what is missing; do not loosen the threshold.
- [ ] **Step 5: Write `docs/checkpoints/m1/georef.md`** with four Google Maps satellite links (`https://www.google.com/maps/@?api=1&map_action=map&center=<lat>,<lon>&zoom=18&basemap=satellite`) for the entrance portal, Tower A centre, Tower B centre and the NE corner, computed from `pxToLatLon`; the owner opens them on the phone gate.
- [ ] **Step 6: Run** the full unit suite `node --test tests/*.test.mjs`. Expected: PASS. Commit `feat(m1): Belvedere georeference (geo block, osm snapshot, check tool, verification links)`.

### Task 6: Shell wiring (DOM, CSS, app.js)

**Files:** Modify `viewer/index.html`, `viewer/style.css`, `viewer/app.js`

**Interfaces:**
- Consumes: `resolveFlags`, `parseHash`/`formatHash`, `fitGeo`/`pxToLatLon`/`latLonToPx`, `resolveSections`/`resolveView`/`DEFAULT_VIEW`.
- Produces on `window.__walk`: `flags` (the resolved record), `view` (getter, current view id), `setView(id)`, `sections` (the resolved list), `geo` (a `Geo` or `null`), `latLonOf(px: [x,y]): [lat, lon] | null`.

- [ ] **Step 1: Markup.** In `index.html` add `<nav id="sections" role="tablist" aria-label="Sections" hidden></nav>` immediately after `#sheetHandle` inside `#panel`. Give the `#tours` div `data-view="tours"`, and give `#facts`, `#themes` and `#hotlist` `data-view="masterplan"`.
- [ ] **Step 2: CSS.** Scope everything under `html.exp`: the bar as a horizontal row of equal tabs (min 44 px touch target, active tab in `--accent`), `html.exp #panelHome > [data-view]:not(.on) { display: none; }`, and inside the phone media query `html.exp { --sheet-h: 248px; }` so the camera offset and tour bar follow. No `backdrop-filter`. With the class absent nothing changes.
- [ ] **Step 3: app.js wiring.** After `site` loads: `const FLAGS = resolveFlags(site, location.search)`; `document.documentElement.classList.toggle('exp', FLAGS.experience)`; `const SECTIONS = resolveSections(FLAGS, site)`; render tabs into `#sections` and un-hide it only when `SECTIONS.length`; `setView(id)` toggles the `.on` class on `[data-view]` blocks and the tab `aria-selected`, and writes the hash through a small `writeHash(patch)` that merges into `parseHash(location.hash)` and calls `history.replaceState(null,'',formatHash(state) || location.pathname + location.search)`; when `view` equals `DEFAULT_VIEW` it is omitted from the hash.
- [ ] **Step 4: Replace the seven hash sites** (`select`, `deselect`, `hashId`, `startTour`, `endTour`, the tour-end branch in `stepTour`, `hashTour`) with `writeHash`/`parseHash`, keeping the exact current outputs when `FLAGS.experience` is false. On boot, read `parseHash(location.hash).view` and call `setView(resolveView(view, SECTIONS))`. `deselect()` and `endTour()` must leave the current view intact; if the resolved view is empty (flags off) nothing changes.
- [ ] **Step 5: Georef on `__walk`.** `const geo = site.geo ? fitGeo(site.geo.points) : null`; expose `geo`, `latLonOf = px => geo ? pxToLatLon(geo, px) : null`, plus `flags`, `view`, `setView`, `sections` on `window.__walk`.
- [ ] **Step 6: Verify on the dev server** (`node tools/serve.mjs 8766`): in a DOM-only Chromium (`--disable-3d-apis`) confirm `?mods=none` gives no `html.exp`, hidden `#sections` and the same visible blocks as before; `?mods=experience` shows two tabs, clicking Tours hides `#hotlist`; `#view=tours` loads on Tours; `#view=bogus` loads on Master plan. Run `node --test tests/*.test.mjs` (PASS). Commit `feat(m1): section shell behind the experience flag, hash router and georef on __walk`.

### Task 7: Live checks, mutation proofs, deploy, gate

**Files:** Modify `tools/check.mjs`; Create `docs/checkpoints/m1/*.png`

**Interfaces:**
- Consumes: everything on `window.__walk` from Task 6 and the existing `ok(name, pass, info)` helper in `check.mjs`.

- [ ] **Step 1: Add the checks** to `tools/check.mjs` (each opens its own page like the existing second-page checks, with `q=low` and `reducedMotion`):
  - `flags off (?mods=none) leaves the shell invisible and hashes legacy`: no `html.exp`, `#sections` hidden, `#tours` and `#hotlist` both displayed, selecting a hotspot sets `location.hash === '#h=<id>'`, starting a tour sets exactly `'#tour=<id>'`.
  - `experience on (?mods=experience) shows the bar and switches views`: two tabs, clicking Tours hides the hotlist and shows the tours, `location.hash` contains `view=tours`; a fresh load of `#view=tours` opens on Tours; `#view=bogus` opens on Master plan with a visible hotlist; select then Back returns to the same view; after a tour ends the panel shows a non-empty view.
  - `georef: __walk.geo fits and places the plan near Budigere Cross`: `latLonOf` of the boundary centroid within 1500 m of (13.0462, 77.7504); and on a dataset without `geo` (load via `?project=` pointing at a fixture copy of the site.json with `geo` removed, if one is not already present create `tests/fixtures/no-geo/` with the minimum copy) `__walk.geo === null` and no console error.
- [ ] **Step 2: Mutation proofs.** For each new check, break the code once and watch it FAIL, then restore: remove the `classList.toggle('exp', ...)`; make `resolveView` return its input unchecked; shift one `geo.points` lat by 0.01. Record the three outcomes in `docs/checkpoints/m1/mutations.md`.
- [ ] **Step 3: Run the full suite on sv** in the capped container against the dev-served build (or the deployed URL after Step 4). Expected: all 31 old checks plus the 3 new pass (34/34). Run it alone.
- [ ] **Step 4: Deploy and shoot.** `tools/deploy.sh belvedere`; take desktop and phone shots with `?mods=experience` (Master plan view, Tours view, sheet collapsed and expanded) and with `?mods=none` into `docs/checkpoints/m1/`. Look at the images before reporting.
- [ ] **Step 5: Owner phone gate.** Hand the owner: the live URL with `?mods=experience`, the four satellite links from `georef.md`, and this checklist: the tab bar does not crowd the title chip, compass or sheet at 320 to 390 px; tours still play from the Tours tab; `?mods=none` looks exactly like before; each satellite pin lands on the named place. Stop here until the owner rules.
- [ ] **Step 6: Commit** the evidence and merge only after the gate: `git checkout master && git merge --ff-only arc3-m1`, push `master`. Update memory `siteplan-walk-belvedere` with the M1 outcome.
