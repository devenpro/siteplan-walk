# M1 mutation proofs (2026-10-25)

Each new live check was proved by breaking the code once and watching the named check fail, on sv in a capped container against the working tree. `tools/m1-checks.mjs` holds the checks; the runner and the mutations were scratch scripts (`tools/_m1-smoke.mjs`, `tools/_m1-mutate.mjs`, gitignored).

| Mutation | File | Check that failed |
|---|---|---|
| drop `classList.toggle('exp', FLAGS.experience)` | `viewer/app.js` | M1 experience on; M1 phone sheet |
| `resolveView` returns any id unchecked | `viewer/sections.js` | M1 deep links (`#view=bogus` no longer falls back) |
| legacy hash gains `view=masterplan` | `viewer/app.js` | M1 flags off (`#h=<id>` / `#tour=<id>` bytes) |
| `geo.points[0].lat` + 0.01 degree | `projects/belvedere/site.json` | M1 georef (plot centre drifts about 1.1 km from Budigere Cross) |
| `showHome()` no-op (panelHome stays hidden after Back) | `viewer/app.js` | M1 experience on (after `shown()` was made ancestor-aware; first run with the old helper: MISSED) |

First attempt at the geo mutation was MISSED: the check read the anchor's expected value from the same block it mutated, and the junction bound was 1.5 km. Fixed by tightening the bound to 600 m (the plot centre is about 210 m from the junction) and re-running: CAUGHT. The anchor round-trip assertion still only proves the fit maths, so it is not the geo data's guard; the junction bound is.

Bug the live run caught that no unit test could: `app.js` already declares its own camera `DEFAULT_VIEW`, so importing `sections.DEFAULT_VIEW` threw a SyntaxError at load. Now imported as `DEFAULT_SECTION`.

Final review (fresh reviewer, 2026-10-25), two fixes made test-first:
- **Boot-time hash rewrite** (Important): with `?mods=experience#h=<id>` the section bar's first `setView` erased the deep link until Explore was pressed. New check "M1 deep links survive boot with the shell on" FAILED on the old code, passes after `setView(id, boot)` skips the URL write on the boot call.
- **`shown()` ignored ancestor visibility** (Minor): a hidden `#panelHome` still counted `#tours` as shown. Now `!e.closest('[hidden]') && e.checkVisibility()`; the `showHome` mutation above went MISSED → CAUGHT.
