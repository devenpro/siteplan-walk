# M5a mutation proofs (2026-10-25)

Each new check was proved by breaking the code once and watching the named check fail. Unit-level proof ran locally; live proofs ran on sv in a capped container against the working tree (scratch runners `tools/_m5a-smoke.mjs` / `tools/_m5a-mutate.mjs`, gitignored).

| Mutation | File | Check that failed |
|---|---|---|
| room names / labels not XML-escaped | `viewer/plan-svg.js` | `tests/plan-svg.test.mjs` "room names are text, never markup" (live checks cannot see it: the HTML parser tolerates a bare `&`) |
| `plans` flag ignored (loader gate and registry) | `viewer/app.js`, `viewer/sections.js` | M5a flags off |
| compare scales each plan to its own width | `viewer/plans.js` | M5a compare |
| `loadUnits` rethrows on a bad file | `viewer/units.js` | M5a bad data |
| plan not fitted to the sheet width (`k` = 9) | `viewer/plans.js` | M5a phone (drawing must sit inside the viewport; page scroll alone cannot see it because the stage clips) |

Harness lessons recorded while making the checks green: Playwright's `waitForFunction` / `waitForSelector` / `click` all stalled for 30 s on the software-rendered page while the same predicate was true at a snapshot taken right after, so the checks poll with `evaluate` + `waitForTimeout(250)` and dispatch clicks; a hit-test (`elementFromPoint`) only means something with the intro overlay dismissed (`autostart` on).
