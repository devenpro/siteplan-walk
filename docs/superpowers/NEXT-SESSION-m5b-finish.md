# M5b (isometric lift): built, deployed flags-off, waiting for the owner phone gate

State written 2026-10-26. Repo `/root/projects/siteplan-walk`, branch **`arc3-m5b`** (local only, NOT pushed, NOT merged; `master` = `692dc84` = M5a). Plan `docs/superpowers/plans/2026-10-26-m5b-isometric-lift.md`; evidence `docs/checkpoints/m5b/` (7 shots + `mutations.md`).

## What it is
Behind the default-off `lift` flag (needs `experience` + `plans`): "View in 3D" on an open plan lifts the rooms into an orbitable low-wall model in the existing canvas (floors, thin walls, room names, an entry wedge, tap a room for its name and size). Site hidden while lifted; orbit limits swapped and restored; slow-device fallback to the 2D plan. Pure parts `viewer/lift-geom.js` (boxes, picking, labels, camera fit, fallback decision) are node-tested; `viewer/lift.js` is the Three side; wiring in `plans.js` / `app.js` / `style.css`. Live checks `tools/m5b-checks.mjs` (7, hooked into `check.mjs`).

## Verification at hand-off
Unit suite 121/121. Full live suite on sv against the deployed page: see the last ledger line / the owner message (52/52 before the final-review fixes; re-run after them reported separately). Mutation proofs: 8 of 8 real ones caught (one of the plan's own was wrong and was replaced, see `mutations.md`). Final whole-branch review (fable): 0 Critical, 3 Important + 1 re-graded, all FIXED test-first.

## The owner phone gate (nothing else is needed)
Open `https://walk.csoul.cloud/belvedere/?mods=experience,plans,lift` on the phone, Homes tab, open a plan (try 3P and 2L), tap **View in 3D**:
1. The rooms read clearly as a plan lifted into 3D; it fits the screen at both phone sizes.
2. Orbit with one finger and pinch to zoom are smooth; two fingers do not drag the model away.
3. Room names are legible; tapping a room shows its name and size in the bar.
4. The label "Indicative 3D from published plans · rooms only; walls, doors and finishes are not shown" is visible; nothing reads as a price.
5. "‹ 2D plan" brings the plan back with the sheet up; Back, a tab, a tour all leave 3D cleanly.
6. No flicker while orbiting (the mobile flicker contract).
Then (ask first) push `arc3-m5b`, ff-merge into `master`, push.

## Deferred minors (ledgered, not fixed unless the owner asks)
Near plane clips the near walls at full zoom-in; tap-tracker listeners registered with the flag off (harmless); 2D room taps and the 3D marker are not synchronised on desktop; `enterLift` guard can refuse after `plans` already flipped to 3d (no live path); `liftSamples` unbounded; the fallback note in `#planRoom` is overwritten by the next render; `exitLift` restores the world after `lift.exit()`; the lift guard is off on desktops the existing autotier reloads as `?q=mid`. Deferred by plan (R7): `#plan=…3d` deep link (M6 presenter will want it); re-fit on phone rotation while lifted.
Earlier M5a minors still stand (see `NEXT-SESSION-m5a-finish.md`).

## Next after the gate
M6 presenter/share/connect, M7 walk-in spike, M8 hardening. M2 (surroundings) and M3 (place distances) stay BLOCKED until the owner's corner pins make `geo.status` verified (`node tools/georef-check.mjs belvedere`). Local ledger workspace `.superpowers/sdd/2026-10-26-m5b-isometric-lift/` (gitignored) can be deleted after the merge.
