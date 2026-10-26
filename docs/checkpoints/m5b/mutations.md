# M5b mutation proofs (2026-10-26)

Each row: break one thing, run the named test on sv, expect it to fail; the file is restored afterwards. Live checks are in `tools/m5b-checks.mjs` (scenario number = `M5B_ONLY`).

| # | Mutation | Caught by | Result |
|---|---|---|---|
| a1 | `floorBottom: 0.02 -> 0` (floor underside coplanar with the wall feet) | unit test "no two boxes share a coplanar, same-facing, overlapping face" | CAUGHT (2 failures) |
| a2 | floor not inset into the wall band (`x0 + t/2 -> x0`) | same unit test | CAUGHT (1 failure) |
| a3 | `inset: 0.03 -> 0` (the plan's first idea) | same unit test | **MISSED, and rightly:** touching rooms' coplanar faces face opposite ways and are hidden inside the walls, so there is nothing to flicker. The plan's mutation was wrong; a1/a2 are the real ones (ledger ruling) |
| b | `exitLift` skips restoring `world` visibility | live check 5 (every exit route) | CAUGHT |
| c | `pick` swaps x and z | live check 4 (tap a room) | CAUGHT |
| d | host ignores `FLAGS.lift` (loads the lift when only `plans` is on) | live check 1 (flags) | CAUGHT |
| e | `shouldFallback` never fires | live check 6 (slow-device gate) | CAUGHT |
| f | `exitLift` does not restore the orbit limits | live check 5 | CAUGHT |
| g | `exit()` does not dispose geometries | live check 2 (geometry count after three enter/exit cycles) | first MISSED (no frame had uploaded the geometry before the exit, so nothing was counted); assertion strengthened to wait for the upload; then CAUGHT |
