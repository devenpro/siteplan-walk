# M5a Floor Plans 2D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Homes" section behind the `plans` flag: the five traced unit types as tappable SVG floor plans with published areas, and a same-scale side-by-side compare.

**Architecture:** Unit data becomes `projects/belvedere/units.json` (derived from the traced `units.js`). Two pure, node-tested modules (`viewer/units.js` validate/load, `viewer/plan-svg.js` SVG strings) feed a DOM module `viewer/plans.js` that fills a new `Homes` view and a plan detail pane in the existing panel. The shell from M1 hosts it: `sections.js` adds a `homes` tab when the flag and data are present; `app.js` loads the data, wires hash `#view=homes&plan=<id>`, and exposes `__walk.plans`. SVG is DOM only: no GL objects, no draw calls.

**Tech Stack:** Vanilla ES modules, inline SVG, `node --test`, Playwright via `tools/check.mjs` (run on sv).

**Spec:** `docs/superpowers/specs/2026-10-25-property-viewing-experience-design.md` (section 6 row M5a; section 2 ruling 3 flags default off; section 9 answer 1: the 5 traced types).

## Global Constraints

- Flag `plans` is default OFF and only has an effect together with `experience` (the section bar hosts it). `?mods=none` forces it off. With the flag off: no `units.json` request, no Homes tab, `#plan=<id>` ignored, DOM and hashes unchanged.
- Ships exactly the 5 traced types (ids `1c`, `2l`, `3g`, `3p`, `3s`), nothing for the 880 sqft plan.
- On-screen label, verbatim, on every plan view: `Indicative layout from published plans · areas are the developer's published figures`.
- Areas are the developer's published sq ft figures (super built-up, carpet, balcony); never invent or convert them. **No unit prices, no price words** (`₹`, `price`, `lakh`, `crore`) anywhere in `units.json` or rendered text.
- Drop `availability` from the converted data: sales status is not verified and must not be displayed.
- Every string from data is XML/HTML-escaped when rendered (room names contain `&`).
- `units.json` lives in `projects/belvedere/` (existing NOTICE.md carve-out). Brochure PDF and raw plan images stay in the private `creatisoul/belvedere-source` repo.
- Flicker contract untouched: no canvas, depth, loop or `backdrop-filter` changes; every new CSS rule scoped under `html.exp`. M1's `--sheet-h` override stays the only sheet-height lever.
- WebGL/live checks run on sv in a capped container; every new check is mutation-proved; run `check.mjs` alone.

## Review Focus

- Room names with `&`, `<` or quotes must render as text, never markup (Task 2 test; the real data has "Living & dining").
- `3.5 BHK` (fractional) sorts and labels correctly; types sort by `bhk` then `sba`. (Task 1 test.)
- `#plan=<unknown>` opens the Homes list with no error; `#plan=2l` with the flag off is ignored; `units.json` missing or malformed gives no Homes tab and a console warning, not an error. (Task 3 test + Task 4/5 checks.)
- Compare of a type with itself, and compare when only one type exists, must not break; both plans in compare render at the same pixels-per-metre. (Task 2 test + Task 4 check.)
- On a 320 to 390 px phone the tallest plan (`3p`, 10.6 x 13.2 m) never causes horizontal page scroll and stays tappable. (Task 4 check.)

---

## File Structure

- Create `projects/belvedere/units.json`, `tools/units-to-json.mjs` (one-off converter, kept for provenance).
- Create `viewer/units.js` (validate, load, sort), `viewer/plan-svg.js` (SVG strings), `viewer/plans.js` (DOM).
- Create `tests/units.test.mjs`, `tests/plan-svg.test.mjs`; extend `tests/sections.test.mjs`.
- Create `tools/m5a-checks.mjs`; modify `tools/check.mjs` (import and call it).
- Modify `viewer/sections.js`, `viewer/index.html`, `viewer/style.css`, `viewer/app.js`, `projects/belvedere/site.json` (`"unitsFile": "units.json"`, no flag), `projects/belvedere/source/PROVENANCE.md`.

---

### Task 1: Unit data and loader

**Files:** Create `projects/belvedere/units.json`, `tools/units-to-json.mjs`, `viewer/units.js`; Test `tests/units.test.mjs`

**Interfaces:**
- Produces: `units.json` = `{ "source": string, "asOf": "YYYY-MM-DD", "note": string, "units": Unit[] }`, `Unit = { id, bhk: number, type, label, plan, tower, unitsRange, floors, sba, carpet, balcony, beds, baths, entry: {x, y, dir: 'up'|'right'|'down'|'left'}, rooms: {name, x, y, w, h, kind?: 'wet'|'out'}[] }` (metres; sq ft for areas).
- Produces: `validateUnits(doc): { ok: boolean, errors: string[], units: Unit[] }` (units sorted by `bhk` then `sba`; empty when not ok); `loadUnits(url: string, fetchFn = fetch): Promise<Unit[]>` (resolves `[]` and `console.warn`s on any failure); `unitById(units, id): Unit | null`.

- [ ] **Step 1: Write the failing tests** in `tests/units.test.mjs`: a valid synthetic doc passes; each of these fails with a named error: missing `units`, duplicate id, non-positive room size, `carpet > sba`, `entry.dir` not one of the four, a room with a non-finite coordinate, a price-like key (`price`, `cost`) anywhere in a unit. Sorting: `[3.5, 1, 3]` BHK come out `1, 3, 3.5`. `loadUnits` with a fetch stub returning 404, non-JSON, and a doc that fails validation each resolve `[]` and call `console.warn` once (stub `console.warn`). Real data: `projects/belvedere/units.json` validates, has exactly ids `['1c','2l','3g','3p','3s']`, no `availability` key, and `JSON.stringify` contains none of `₹`, `price`, `lakh`, `crore`; rooms of each unit do not overlap (any pair overlapping by more than 0.01 m in both axes fails).
- [ ] **Step 2: Run** `node --test tests/units.test.mjs`. Expected: FAIL (module and file missing).
- [ ] **Step 3: Write `tools/units-to-json.mjs`** (reads the traced `window.BELVEDERE_UNITS` from `/root/mockups/firstline/x0-data/units.js` or the private repo copy via `vm`, converts room arrays `[name,x,y,w,h,kind]` to objects, drops `availability`, writes `projects/belvedere/units.json` with `source: "Traced from Brigade's published unit plans; room sizes from the brochure's room dimensions"`, `asOf: "2026-10-25"`, `note` = the verbatim label from Global Constraints). Run it. Add `"unitsFile": "units.json"` to `site.json` and a provenance paragraph to `PROVENANCE.md`.
- [ ] **Step 4: Implement `viewer/units.js`** to the signatures above. Check `unitsRange`/`floors`/`tower` are non-empty strings.
- [ ] **Step 5: Run** `node --test tests/*.test.mjs`. Expected: PASS. If the real-data overlap test fails, rule on it (fix the data if a room is wrong by more than 0.05 m, else loosen the tolerance) and ledger the ruling.
- [ ] **Step 6: Commit** `feat(m5a): unit data (units.json from the traced plans) and validated loader`.

### Task 2: SVG plan strings

**Files:** Create `viewer/plan-svg.js`; Test `tests/plan-svg.test.mjs`

**Interfaces:**
- Consumes: `Unit` from Task 1.
- Produces: `escapeXml(s: string): string`; `unitExtent(unit): { w: number, h: number }` (metres, max of x+w and y+h over rooms); `planViewBox(unit, { scale = 10, pad = 14, mini = false }): { w: number, h: number }` (viewBox units; `mini` has pad 6 and no scale-bar band); `planSvg(unit, { scale = 10, pad = 14, mini = false, active = -1 }): string` — a self-contained `<svg viewBox role="img" aria-label>` string with one `<rect class="room [wet|out] [on]" data-i>` per room (each with a `<title>` "name · w × h m"), a label and dimension text per room when not `mini` and the room is large enough, an outline path, an entry arrow with the text `ENTRY` (not in `mini`), and a 5 m scale bar (not in `mini`). Port the geometry and label-fit rules from `drawUnit` in `/root/mockups/firstline/x0-data/units.js`.

- [ ] **Step 1: Write the failing tests:** rect count equals room count for every real unit; `mini` output contains no `<text`; `planSvg` of a unit with a room named `A & <b>"x"` contains `A &amp; &lt;b&gt;&quot;x&quot;` and no raw `<b>`; `active: 2` puts class `on` on exactly the rect with `data-i="2"`; `planViewBox(unit, {scale: 20}).w` is about twice the `scale: 10` width minus the padding delta; the entry arrow for `3p` (entry x = -0.55) lies inside the viewBox (translate x ≥ 0); the output of every real unit is balanced markup: one `<svg` and one `</svg>`, `<rect` count equals the room count plus none extra, every `<text` has a `</text>`, and every `<tspan` a `</tspan>`.
- [ ] **Step 2: Run** `node --test tests/plan-svg.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** `viewer/plan-svg.js`. Numbers rounded to 2 decimals in output. All text through `escapeXml`.
- [ ] **Step 4: Run** the whole unit suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat(m5a): SVG floor-plan strings (escaped, mini and full, active room, entry, scale bar)`.

### Task 3: Homes section

**Files:** Modify `viewer/sections.js`; Test `tests/sections.test.mjs` (extend)

**Interfaces:**
- Consumes: `resolveSections(flags, site)` from M1.
- Produces: `resolveSections` additionally appends `{ id: 'homes', label: 'Homes' }` when `flags.experience && flags.plans` and `site.units` is a non-empty array (the loaded, validated list the app attaches before calling it). Order: `masterplan`, `homes`, `tours`.

- [ ] **Step 1: Extend the failing tests:** experience + plans + units gives `['masterplan','homes','tours']`; plans without experience gives `[]`; experience + plans with `units` absent or `[]` omits `homes`; experience without plans omits `homes`; `resolveView('homes', sections)` is `'homes'` when present, falls back to `'masterplan'` otherwise.
- [ ] **Step 2: Run** `node --test tests/sections.test.mjs`. Expected: FAIL on the new cases.
- [ ] **Step 3: Implement** the one added branch. **Step 4: Run** the whole suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat(m5a): Homes section in the registry (needs experience + plans + loaded units)`.

### Task 4: Live checks first (red on sv)

**Files:** Create `tools/m5a-checks.mjs`; Modify `tools/check.mjs`

**Interfaces:**
- Consumes: the `open(...)` pattern and `shown()` (ancestor-aware) from `tools/m1-checks.mjs` (copy the helpers, do not import private ones); the M5a surface from Task 5: `#homes` list (`button.unitcard[data-id]`), `#panelPlan`, `#planSvg svg`, `button#planBack`, `.compare-chip[data-id]`, `__walk.plans = { open(id), close(), compare(id), get openId(), get compareId() }`.
- Produces: `export async function m5aChecks(b, url, ok, wire)`; called from `check.mjs` right after `m1Checks`.

- [ ] **Step 1: Write the checks** (each opens its own page like M1):
  - `M5a flags off`: with `?mods=experience` (plans NOT on) there is no Homes tab and no request to `units.json` (listen with `page.on('request')`); with `?mods=none#plan=2l` the hash is left untouched and no Homes tab; neither case logs a console error.
  - `M5a Homes on` (`?mods=experience,plans`): tabs are `masterplan,homes,tours`; Homes lists exactly 5 cards in the order `1c,2l,3g,3p,3s`; each card shows its type, plan name and the SBA figure from the data; no `₹`, `price`, `lakh`, `crore` in `#homes` or `#panelPlan` text.
  - `M5a plan detail`: clicking the `2l` card opens `#panelPlan` with an SVG having exactly 8 `rect.room`; the verbatim label is present; SBA 1149, carpet 709, balcony 33 are shown; hash is `#view=homes&plan=2l`; tapping a room rect highlights it (`.on`) and shows its name and size; Back returns to the Homes list with hash `#view=homes`.
  - `M5a deep links`: boot with `#plan=3p` (with `autostart` off) shows the plan and the URL still reads `#plan=3p` before Explore; `#plan=nope` shows the Homes list, no error, hash untouched.
  - `M5a compare`: opening `2l` and choosing `3g` as compare renders two SVGs whose pixels-per-metre are equal (ratio of rendered width to `unitExtent` width within 1 %); choosing `2l` against itself does not add a second plan or throw; closing the plan clears compare.
  - `M5a phone`: at 390 and 320 px the `3p` plan is open with `document.documentElement.scrollWidth <= innerWidth` and the SVG is at least 240 px wide.
  - `M5a bad data`: with `units.json` intercepted (`page.route`) to 404 and then to `{}`, boot shows no Homes tab, logs no console error, and the rest of the shell works.
- [ ] **Step 2: Run on sv** (recipe in memory `siteplan-walk-belvedere`; scratch launcher `run-sv.sh` ships the working tree): all new M5a checks FAIL (no Homes tab). Expected: FAIL for the right reason, and `M5a flags off` PASS.
- [ ] **Step 3: Commit** `test(m5a): live checks for the Homes view (red)`.

### Task 5: Homes view (DOM, CSS, wiring)

**Files:** Create `viewer/plans.js`; Modify `viewer/index.html`, `viewer/style.css`, `viewer/app.js`

**Interfaces:**
- Consumes: `planSvg`, `planViewBox`, `unitExtent` (Task 2), `Unit`, `unitById` (Task 1), `resolveSections` with `site.units` (Task 3), `writeHash`/`setView`/`SECTIONS` from M1.
- Produces: `createPlans({ units, listEl, detailEl, onOpen }): { open(id), close(), compare(id), get openId(), get compareId() }` where `onOpen(idOrNull)` is called after every open and close (the app writes the hash from it); `window.__walk.plans` is that object (or `null` when the section is absent).

- [ ] **Step 1: Markup.** In `index.html` add inside `#panelHome` a `<div id="homes" data-view="homes"></div>`, and next to `#panelDetail` a `<div id="panelPlan" hidden></div>` with `#planBack`, a header block, `#planSvg`, a facts row, a compare chip row and the label paragraph (all IDs referenced in Task 4).
- [ ] **Step 2: `viewer/plans.js`** builds the card grid (mini SVG from `planSvg(..., {mini: true})`, type, plan name, `{sba} sq ft`, beds/baths) and the detail pane (full SVG with room tap highlighting via `active` re-render, a room readout showing name and `w × h m` and area in m², facts, compare chips for every other type, the label). Compare renders two `planSvg` at the same `pxPerMetre` by setting each SVG's CSS `width = planViewBox(...).w / scale * pxPerMetre`; `compare(sameId)` is a no-op; `close()` clears compare.
- [ ] **Step 3: CSS** under `html.exp`: card grid (2 columns on phones, 3 on desktop), the plan pane filling the panel, SVG `max-width: 100%`, room fill colours by kind (`wet`, `out`, default) and `.on`, compare layout side by side on desktop and stacked on phones, 44 px tap targets, `overflow-x: hidden` on the plan pane. No `backdrop-filter`.
- [ ] **Step 4: `app.js`.** After `FLAGS`: when `FLAGS.plans && site.unitsFile`, `site.units = await loadUnits(BASE + site.unitsFile)` before `resolveSections`. When the `homes` section exists, `createPlans` is built; `onOpen(id)` calls `writeHash(id ? { plan: id } : {})` and switches panels (`#panelHome` / `#panelPlan` hidden states, mutually exclusive with `#panelDetail`). The section tab click closes any open plan first (as it already deselects a hotspot). Boot: apply `hashState.plan` after `setView(hashState.view, true)` without rewriting the URL (the M1 `boot` rule); an unknown id is ignored. `?mods=none` and flags off skip all of it. Expose `__walk.plans`.
- [ ] **Step 5: Run** `node --test tests/*.test.mjs` (PASS), then the M5a checks on sv. Expected: all PASS, zero console errors. Fix the code, never the checks; any check change gets a ledger ruling.
- [ ] **Step 6: Commit** `feat(m5a): Homes view behind the plans flag (cards, SVG plan detail, room tap, same-scale compare, #plan= deep link)`.

### Task 6: Mutation proofs, full suite, deploy, gate

**Files:** Create `docs/checkpoints/m5a/*.png`, `docs/checkpoints/m5a/mutations.md`

- [ ] **Step 1: Mutation proofs** (one container run, scratch runner like M1's): remove the `escapeXml` call on room names (Task 2 test and `M5a plan detail` fail); make `resolveSections` ignore the `plans` flag (`M5a flags off` fails because the tab appears); make compare scale each plan to its own width (`M5a compare` fails); make `loadUnits` throw on 404 (`M5a bad data` fails); drop `overflow-x: hidden`/`max-width` (`M5a phone` fails). Each must be CAUGHT; record in `mutations.md`.
- [ ] **Step 2: Full suite on sv** against the working tree: all prior 37 checks plus the new M5a checks pass. Run it alone.
- [ ] **Step 3: Deploy** with `tools/deploy.sh belvedere` (flags stay off in `site.json`), run the M5a checks against `https://walk.csoul.cloud/belvedere/`, and take desktop and phone shots with `?mods=experience,plans` (Homes list, `2l` detail, compare `2l` vs `3p`, 320 px) into `docs/checkpoints/m5a/`. Look at the images before reporting.
- [ ] **Step 4: Owner phone gate.** Hand the owner the URL `…/?mods=experience,plans` and this checklist: the Homes tab appears third; the five cards read clearly; each plan shows rooms with sizes and its published areas; tapping a room shows its name and size; compare shows two plans at the same scale; nothing scrolls sideways; the "Indicative layout" label is visible and nothing reads as a price. Stop until the owner rules.
- [ ] **Step 5: After the gate:** commit evidence, `git checkout master && git merge --ff-only arc3-m5a`, push, update memory `siteplan-walk-belvedere`.
