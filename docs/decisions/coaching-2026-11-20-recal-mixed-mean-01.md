# Coaching Board — `RECAL-MIXED-MEAN-01`, 2026-11-20 — ⏸️ NOT READY (not sat)

**Why not sat — two independent blockers, both already on the record:**
1. **Production evidence (this board, 2026-11-12, category 🅒, *"do not sit these"*, gate re-measure 2026-12-12).**
   Re-measured early: **0 plans have ever been recalibrated** — `meta.recalibrations_applied` empty on all **43 live**
   and **80 archived** plans (`scripts/board-evidence-recal-goal-reach-01.ts`, read-only, shared with
   `RECAL-GOAL-REACH-01`).
2. **It is half of one build with `RECAL-DISTANCE-REPS-01`**, which this board re-ruled **INSUFFICIENT EVIDENCE**
   on 2026-10-11 (§125 Am. 4) pending the rep-count cost, and whose prerequisite — *step lengths resolved onto the
   session* — is this item's blocker. Still absent: `DerivedStep.length` is a human-readable string only
   (`lib/plan/resolveMainSet.ts:45–61`); no variant parameter is stamped, so §85's time-weighted mean still cannot be
   recomputed after generation. Ruling on this item alone would split a pair the board deliberately merged.

## The item's figures
| Item's figure | Re-measured 2026-11-20 |
|---|---|
| 82 of 297 generated quality sessions are mixed-anchor (27.6%) | **63,420 of 250,616 (25.3%)** quality sessions on the full `cohortGrid` are `progressive_tempo` or `tempo_over_under` (`scripts/board-evidence-beginner-taper-race-row-01.ts`, last line). The item's corpus is unnamed, so the two denominators differ; same order of magnitude |
| 192 of their 228 work-step lengths are `parameter` kind | **not re-measured** — the stamping gap it describes is confirmed structurally (above), which is what blocks |
| `INV-PLAN-HEADER-PACE-MATCHES-WORK` skips these rows by design | not re-checked |

## What would make it ready
The 2026-12-12 gate showing applied recalibrations **and** the `RECAL-DISTANCE-REPS-01` rep-count cost measured, so
both halves of the one build come back together.

## What this does not prove
Anything about how wrong the scaled header is on a recalibrated mixed-anchor session — no such session exists live.
