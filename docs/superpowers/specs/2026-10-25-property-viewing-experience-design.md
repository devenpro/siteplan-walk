# Belvedere property-viewing experience: design (arc 3)

Status: DRAFT for owner review, 2026-10-25. Nothing built. Plan file of record: `/root/.claude/plans/pasted-content-id-757c-plan-session-hashed-mango.md`.

## 1. Intent

`walk.csoul.cloud/belvedere` today is a drone-style fly-over of a master plan with 44 hotspots, tours, a media gallery and narrated clips. The operator wants it to become a full property-viewing experience: something a builder's sales team can present on site (tablet, projector, phone) and something a visitor can open from any shared URL and explore alone.

The five asks: (1) the structures around the site, (2) the location, (3) the project master plan, (4) floor plans, (5) the whole experience, presentable, interactive, with a way for the visitor to connect. The reference idea is a floor plan turned into a first-person walkable 3D unit.

Why it matters: this is the sales demo CreatiSoul shows real-estate developers. The more complete the viewing experience, the better the pitch ("this is what your buyers could open from a WhatsApp link").

## 2. Rulings that bind this design (owner, 2026-10-25)

1. **Standalone CreatiSoul sales demo, built as engine modules.** It is not a First Line deliverable. Each new surface is a separate module with a flag, so First Line can adopt it later through W1 without a rewrite. CX4 rulings 5, 13 and 15 bind First Line surfaces only. X2, X3, X4, X4m and W1 stay exactly as ruled.
2. **Walk-in is allowed, as the LAST stage, behind a time-boxed spike** with its own phone gate and a go/no-go. Dropping it must not cost the earlier stages.
3. **Flag-gated modules, default OFF.** W1's "no new engine features" applies to W1's host-profile work only. This arc never edits W1's assembler. With every flag off, the viewer's behaviour and W1's DOM-equivalence expectations are unchanged.
4. **Connect is demo-safe on the Brigade dataset.** The enquiry form is built but inert there: labelled as a demo, no visitor data sent or stored. A separate "Talk to CreatiSoul about your project" contact does reach CreatiSoul. Share is Web Share, copy link and QR. Live capture is allowed only for a builder's own dataset, after their rights note, routed to their CRM.
5. **Sequencing.** Hygiene (backup, C2 gate and merge) runs now. The build starts after the website release plan (L1 to L11), per the "release first, focus on what is built" ruling. The arc touches only the walk repo, so it neither blocks nor is blocked by S1c.

## 3. Goals, non-goals, anti-goals

**Goals**
- A visitor can understand the project's setting, location, master plan and homes from one URL, on a phone, without help.
- A sales person can run a guided, fullscreen presentation from a tablet or laptop.
- Every new surface is honest about what it is: indicative, sourced, labelled.
- The next builder's dataset can reuse each module by changing data, not code.

**Non-goals**
- No First Line integration, host-profile changes or `?embed=1` work (that is W1/W2).
- No remote-control sync between presenter and visitor devices (Later).
- No new AI stills or AI video, no Higgsfield spend.
- No live lead capture on the Brigade dataset.
- No unit prices (the app withholds them by design).
- No architect-grade geometry. All plans are "indicative".

**Anti-goals (a failure even if it technically works)**
- A visitor believes Brigade runs this page or receives their details.
- A buyer reads the walk-in or the surroundings as survey-accurate.
- A regression of the flicker contract, or any new draw-call growth that breaks the tier budgets on a phone.
- The new modules change what First Line or the existing live suite sees with flags off.

## 4. Constraints

- **Flicker contract (B arc, must hold):** opaque canvas (`getClearAlpha()===1`), log depth with near 2 and far 3600 (high tier uses its own AO path), no coplanar caps, no `backdrop-filter` on phones, never a fully stopped idle loop.
- **Budgets:** low tier 90 calls / 90k tris per whole frame, mid 94 / 90k, high ceilings 220 / 700k. New modules must fit inside the existing ceilings or the spec for that module must state a new measured ceiling.
- **Tiers:** every module defines high / mid / low behaviour.
- **Licensing and provenance:** Belvedere imagery stays under the NOTICE.md carve-out. OpenStreetMap data needs ODbL attribution on screen. Backed-up brochure material must not be committed to the PUBLIC `devenpro/siteplan-walk` repo.
- **Verification:** WebGL runs only in a capped container, never as a Playwright WebGL screenshot on the csoul host. `check.mjs` is run alone. Every new check is mutation-proved.
- **Copy rules:** distances only for places (CX-R2, no minutes). "drone" stays forbidden copy. Floor-area figures are the developer's published numbers.

## 5. Current state (measured 2026-10-25)

- `arc2-c2` is 18 commits ahead of `master` (tip `24bbd0d`), pushed and deployed. The C2 phone gate and the B12 label check are still owed.
- `units.js` (5 unit types: 1C, 2L, 3G, 3P, 3S) exists only in the local mockups repo `/root/mockups/firstline/x0-data/units.js`, which has no remote. The plan images are in a gitignored `media/belvedere/`. The brochure PDF exists only in an old scratchpad. None of it is backed up. The brief mentioned 7 plans, so reconcile against the brochure.
- `units.js` holds axis-aligned room rectangles in metres and one entry point per type, with no walls, doors or windows.
- `location-map.webp` (1200×819) is in `projects/belvedere/source/` and unused. `site.json` has no coordinates.
- OpenStreetMap near Budigere Cross (13.0462, 77.7504, the junction, not the site) has about 343 building ways within 1.2 km, about 108 with `height` or `building:levels`.

## 6. Modules

All flags are read from `site.json` (and `?` overrides for dev). All default off.

| Module | Flag | Behaviour | Data |
|---|---|---|---|
| M1 Shell + georef | `experience` | Georeference the plan: at least 2 control points mapping plan pixels to lat/lon, stored in `site.json` `geo`. A bottom bar (Surroundings, Location, Master plan, Homes, Share) replaces the tours-first sheet on phones. New deep links `#plan=<id>` and `#view=<id>` sit beside `#tour=` and `#h=`. | `geo` block |
| M2 Surroundings | `context` | Overpass pull at authoring time, baked to `context.json`: building footprints in local metres, heights from `height`, else `building:levels` times 3 m, else a deterministic 2 to 3 storey fallback, plus roads as draped lines, about 600 m radius. Rendered as ONE merged geometry in a neutral ghost tone that fades with distance and is excluded from AO. On-screen label: "Surroundings from OpenStreetMap · heights indicative" with ODbL attribution. | `context.json` |
| M3 Location | `location` | Curated places with distances only, each with source and as-of date. `location-map.webp` becomes a provenance-labelled map card. Places also show as compass-ring markers in 3D. | `places[]` |
| M4 Master plan | existing | Unchanged. Joined into the presenter sequence. | none |
| M5a Floor plans 2D | `plans` | SVG plan per unit type from the unit data: rooms, dimensions, published areas, within-project compare. Label: "Indicative layout from published plans". | `units.json` (converted from `units.js`) |
| M5b Isometric lift | `plans` | Extruded rooms, orbitable, reusing the engine's Three.js. Phone tier gate of its own. | same |
| M6 Presenter, share, connect | `presenter`, `connect` | Guided sequence (overview, surroundings, location, master plan hotspots, a unit). Fullscreen (C4 pulled forward) with an iOS fallback, chrome-hidden mode, keyboard or clicker control, wake lock. Visitor view stays the default. Inert enquiry form (clearly labelled demo), a real "Talk to CreatiSoul" link, Web Share, copy link, QR. | none new |
| M7 Walk-in spike | `walkin` | First-person eye-height walk through one unit (suggest 2L) with touch joystick and wall collision. Needs wall, door and window tracing from the brochure plan images, by extending `tools/trace.html`. Label: "Indicative layout · finishes not shown". Time-boxed, with a go/no-go gate. | traced openings JSON |
| M8 Hardening | none | Per-module `check.mjs` additions, flag-off regression check, README and `docs/adding-a-project.md` updates, pitch shots from the live URL. | none |

## 7. Order and gates

Step 0 (hygiene) then spec and recipe, then M1, M2, M3, M5a, M5b, M6, M7, M8. Each phase: its own plan, mutation-proved checks, evidence shots from the live URL, and an owner phone gate before the next phase. Estimated total 9 to 11 sessions including the spike.

## 8. Decisions left to the builder (my calls, mark if you disagree)

- Isometric lift uses the engine's Three.js, not SVG (shared lights, tiers and camera helpers). Cost is phone performance, so M5b has its own tier gate.
- Context geometry is baked at authoring time, not fetched live (no runtime dependency on Overpass, deterministic output).
- Presenter control is local to one device. Remote sync is Later.
- The Brigade dataset's "Talk to CreatiSoul" link target is chosen in the M6 recipe (see section 9).

Further calls made after the builder check (my calls, mark if you disagree):

- **Georef source.** I derive the control points myself by matching plan features (the access road, boundary corners, the Budigere Cross junction side) to OSM road geometry and satellite imagery. Acceptance for M1: residual error of 20 m or less against at least 3 independent OSM features. You verify the result visually at the M1 phone gate. The same numbers fix the M2 pull centre and the M3 distances.
- **Flags on the live URL.** `?` overrides work in production so each phase can be gated on the live URL while the stored `site.json` still has the flags off. A flag is flipped on in the live `site.json` only after you pass that phase's gate. The flag-off regression check runs against the live URL with no overrides.
- **Data locations.** Derived `units.json` (rectangles and published areas) lives in `projects/belvedere/` under the existing NOTICE.md carve-out. Brochure PDF and raw brochure plan images stay in the private backup repo. M5a and M7 read them from a gitignored `projects/belvedere/private/` path, and `check.mjs` skips tracing-dependent checks when that path is absent.
- **Backup timing.** The backup is a prerequisite for M5 and M7 only. It runs in Step 0 in parallel with the gate.
- **Tracing.** I do the M7 tracing with the extended tracer. The first task of M7 is a feasibility measurement: image resolution, printed dimensions, whether doors and windows are legible. If it fails, M7 stops there at a cost of under a day.
- **Places.** I research and source the list myself (no builder input). Distances are straight-line and labelled so, plus a link to live traffic. No minutes, no routing source needed.
- **Base branch.** M1 branches from `master` after the `arc2-c2` fast-forward merge. Step 0 therefore gates M1.
- **Presenter unit.** The presenter sequence takes a per-unit pick from the unit data, which already carries a tower field. It is not tied to a tower. The default is 2L.

## 9. Owner answers to the builder-check questions (2026-10-25)

1. **Plan set:** the 5 traced types (1C, 2L, 3G, 3P, 3S). The duplicate 2L image is the Tower A & C variant of the same plan. The 880 sqft plan is left out until its type is identified (possible later add, about half a session).
2. **"Talk to CreatiSoul" link:** the creatisoul.org contact page. Exact URL to be confirmed in the M6 recipe. No phone number baked into the demo.
3. **Backup home:** DONE. Private repo `creatisoul/belvedere-source` (31 MB, `main`) holds units.js, the 7 unit-plan images, the brochure PDF (re-downloaded 2026-10-25), the location map, CHECKSUMS.sha256 and a provenance README.
4. **Walk-in go/no-go, tested on the owner's phone:** ship only if all three hold. (1) It moves and turns without visible stutter for a minute. (2) Rooms, doors and the entry read correctly against the brochure plan. (3) The "indicative layout" label is visible and the owner feels it does not overpromise. Any miss and the walk-in is dropped, and M5a/M5b stand alone.

No open questions remain for planning. Still owed by the owner before M1 can start: the C2 + B12 phone gate.
