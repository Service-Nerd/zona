# Phase 3 — Blockers Log

**Branch**: `redesign/phase-3-remaining-screens`
**Started**: 2026-04-23

---

## B-001 — BenchmarkUpdateScreen not wired in DashboardClient

**Screen**: `app/dashboard/BenchmarkUpdateScreen.tsx`
**Status**: Blocked — UI work complete, screen unreachable
**Finding**: `BenchmarkUpdateScreen` is exported from its file but is not imported anywhere in `DashboardClient.tsx`. There is no `'benchmark'` case in the screen router and no `onOpenBenchmark` prop exists on any component. The screen is visually rebuilt in Phase 3 but cannot be reached from the app.
**Resolution required**: Add import, add `'benchmark'` case to screen router, and add an entry point (e.g. button in MeScreen → profile area, or after plan save). This requires a product decision on where the benchmark update flow starts.
**Deferred to**: Post-Phase-3 wiring task.

---

## B-002 — OrientationScreen trigger fires on every plan save, not first-plan-only

**Screen**: `OrientationScreen` inside `DashboardClient.tsx`
**Status**: Blocked — trigger logic wrong, fix requires DB migration
**Finding**: `handlePlanSaved` (line ~489) unconditionally sets `setShowOrientation(true)` on every call. First-plan-only behaviour requires a `user_settings.orientation_seen` boolean column that does not exist in the current schema.
**Resolution required**: 
1. Migration: `ALTER TABLE user_settings ADD COLUMN orientation_seen boolean DEFAULT false;`
2. Code: Check `orientation_seen` before showing; set it to `true` after dismissal.
**Deferred to**: Post-Phase-3 migration task. OrientationScreen visual rebuild proceeds; trigger guard is noted.

---
