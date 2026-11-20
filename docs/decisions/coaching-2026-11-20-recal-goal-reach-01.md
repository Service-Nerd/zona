# Coaching Board — `RECAL-GOAL-REACH-01`, 2026-11-20 — ⏸️ NOT READY (not sat)

**Why not sat:** this board placed the item in category 🅒 *"Blocked on production evidence — do not sit these"* on
2026-11-12 (`docs/decisions/coaching-board-open-items-2026-11-12.md`, with `RECAL-MIXED-MEAN-01`), and set a date —
**re-measure the gate on 2026-12-12**. The founder's brief allows a sitting only when the analysis can supply the
missing thing without engine code. It cannot: the missing thing is recalibrations that have happened to runners.

## The gate, re-measured early
Evidence: `scripts/board-evidence-recal-goal-reach-01.ts` (read-only, production, service-role).

| | 2026-11-12 | 2026-11-20 |
|---|---|---|
| recalibration exposure | *"1 read in the entire trial cohort"* | **0 plans ever recalibrated** — `meta.recalibrations_applied` is empty on **all 43 live plans** and **all 80 archived plans** |
| live plans carrying a `goal_pace_reach` decision a recalibration could flip | not stated | **14 of 43** |

⚠️ **The two figures measure different things** — a "read" (a prompt or screen seen) is not an applied recalibration,
which is what `recalibrations_applied` records (`app/api/recalibrate-zones/route.ts:83–88`). Neither is zero-risk of
misreading, and both say the same thing: **no runner has yet carried a recalibrated plan whose withholding decision
could be stale.** The route records no `ops_events` row, so the stored meta is the only trace.

**The item's own narrowing still holds (read, not re-run):** since `83b0a34a` the race-day opening follows a
recalibration; training sessions and `meta.goal_pace_reach` do not.

## What would make it ready
Either (a) the 2026-12-12 gate shows recalibrated plans exist, or (b) the chair re-scopes the item as a corpus
question (apply `applyRecalibration` to benchmarked grid plans, recompute `goalPaceReach` at the new VDOT, count flips
in each direction) — that is the chair's call to make, not this sitting's, because it reverses an 8-day-old instruction.

## What this does not prove
That the defect is harmless — only that it has had no live instance. A recalibration whose result is not applied leaves
no trace in `recalibrations_applied`.
