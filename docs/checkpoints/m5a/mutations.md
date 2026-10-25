# M5a mutation proofs (2026-10-25)

Each new check was proved by breaking the code once and watching the named check fail. Unit-level proof ran locally; live proofs ran on sv in a capped container against the working tree (scratch runners `tools/_m5a-smoke.mjs` / `tools/_m5a-mutate.mjs`, gitignored).

| Mutation | File | Check that failed |
|---|---|---|
| room names / labels not XML-escaped | `viewer/plan-svg.js` | `tests/plan-svg.test.mjs` "room names are text, never markup" (live checks cannot see it: the HTML parser tolerates a bare `&`) |
| `plans` flag ignored (loader gate and registry) | `viewer/app.js`, `viewer/sections.js` | M5a flags off |
| compare scales each plan to its own width | `viewer/plans.js` | M5a compare |
| `loadUnits` rethrows on a bad file | `viewer/units.js` | M5a bad data |
| plan not fitted to the sheet width (`k` = 9) | `viewer/plans.js` | M5a phone (drawing must sit inside the viewport; page scroll alone cannot see it because the stage clips) |
| compare lists the open plan twice (`list = cmp ? [u, u] : [u]`) | `viewer/plans.js` | M5a compare (after the check was strengthened to assert the figure ids `2l`,`3g` and rooms 8/10; before that: MISSED, found by the final review) |

Harness lessons recorded while making the checks green: Playwright's `waitForFunction` / `waitForSelector` / `click` all stalled for 30 s on the software-rendered page while the same predicate was true at a snapshot taken right after, so the checks poll with `evaluate` + `waitForTimeout(250)` and dispatch clicks; a hit-test (`elementFromPoint`) only means something with the intro overlay dismissed (`autostart` on).

## Final review fix pass (2026-10-25)
Final reviewer: 0 Critical, 2 Important, 6 Minor (minors deferred, not fixed).
- **Plan opened during a tour or with a hotspot selected** lost the tour from the URL and was closed by the tour's next keyframe. New check "M5a opening a plan ends a running tour..." FAILED on the old code (RED), passes after `plans.open` calls `onOpen` first and the host ends the tour / deselects. The same check also found that opening a plan from the Master plan view left the tab bar and hash on Master plan: the host now switches to the Homes view.
- **Compare check could not see a wrong second plan**: mutation "compare lists the open plan twice" was MISSED by the old check (RED), CAUGHT after it asserts the figure order.
