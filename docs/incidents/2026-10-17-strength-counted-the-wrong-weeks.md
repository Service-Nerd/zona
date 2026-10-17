# 2026-10-17 — strength counted the run plan's weeks, and jumps had no presence check

**Items:** `STRENGTH-START-WEEK-01`, `STRENGTH-PLYO-BUDGET-01`. **Live?** No: strength is admin-only and its tables were
never created, so no runner received either. Found while building the mid-plan entry points (`STRENGTH-ENTRY-01`),
which would have made the first defect the common path.

## What happened
1. `generate.ts` passed `weekIndex` = the index in the RUN plan's weeks to the dose model, the selector and the jumps
   gate. A runner who set strength up in week 8 started past the technique block, at heavy 5s, with jumps open.
2. The session packer gave jumps priority 4 and dropped them before trimming main sets, so only a deload (cut sets)
   left room: **one week of jumps in sixteen**. Jump difficulty climbed from the lifting level, so a `some` lifter's
   first jump was **bounding or a drop jump**. A third layer: once jumps were dropped, the fill step spent the freed
   minutes on another main set and the session finished under budget with none.

## Why it survived
- **The checker shared the producer's assumption.** `validateStrengthPlan` iterated `plan.weeks.forEach((w, wi)` and
  read `wi` as the strength week: the same convention the engine got wrong, so it agreed with it on every plan.
- **A promise with no presence check.** S8 promises jumps once the gate opens; every plyo rule checked jumps that
  WERE placed (too soon, too many, wrong week). Nothing asked whether any arrived, so a plan with none passed clean.

## Fix
`start_date` on the plan (route: today for a new plan, kept on every rebuild); weeks before it are empty and every
count starts there. Jumps drop last and return first at no less than the start dose; jumps start at level 1. New
checks `S-BEFORE-START`, `S-PLYO-MISSING`, `S-PLYO-START-LEVEL`, and the validator counts from `start_date`. Each
fix was reverted in turn and its test went red; the fill-step re-add is caught by the sampled sweep in `verify`
(2 failures) and the full sweep (7,128), not by the unit calendar. Full sweep after: 266,688 plans, 0 violations.
