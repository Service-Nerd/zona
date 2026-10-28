# Coaching Board: the MP change's cost on the plan-quality audit (2026-10-28, AUDIT-PLANS-MP-COST-01)

**Founder:** "2 board", answering "re-baseline the plan-quality audit with this morning's cost, including the one plan
that now never builds? Or send that one plan to the Coaching Board?"

## Evidence (measured 2026-10-28, `audit-plan-quality.ts` cohortGrid, 3,000 inputs, `239a8f0b` vs HEAD)

MP-BLOCKS-ONE-BLOCK-01 removed the trailing jog from the marathon-pace session (7.5 → 7 km in this plan, 7.5 → 6.5 km
in others), so marathon time-goal peak weeks are about 1 km smaller. Every plan the audit moved is a marathon time goal
at 4:15.

| Code | Before | After | What moved |
|---|---|---|---|
| `BINGE-WEEK` (worst session over 60% of its week) | 306 | 308 | two 4-day intermediate 20 km/week plans cross at **61%**; ~20 already flagged move 1 pp |
| `NEVER-BUILDS` (peak under 110% of week 1) | 1093 | 1094 | **one plan**: 65 → 64 km peak against a 59 km week 1, **+10% → +8%** |

**The one plan:** marathon 4:15, 70 km/week now, longest 28 km, 5 days, experienced, age 52. Weeks:
`59 60 51d 60 60 51d 61 60 54d 59 64 56d 60 64 53 41 32 14`. Before the change, weeks 13–14 were 61 and 65. It is a
**`volume_profile: 'maintenance'`** plan, and its note says so to the runner: *"Your weekly mileage holds steady across
this plan rather than climbing into the final weeks."* The flat shape is designed, declared and unchanged; the change
moved its peak by 1 km across a 10% line it was sitting on.

`measure:fitness` was unchanged by the MP build (healthy masters "never builds" 19.1% before and after).

## Conflict scan

- **§19 Am.2 (M2, this morning):** the cost being asked about. Not reopened.
- **§52 / `LONG_RUN_MAX_PCT_OF_WEEKLY` (60):** the two new BINGE plans are 1 pp over; `INV-PLAN-LR-MAX-WEEKLY-PCT` is a
  warn, and the founder accepted the same delta on `review:cohort` this morning (re-baselined).
- **§106 Am. / `INV-PLAN-NOT-DETRAINING`:** not breached (the lowest progressive week is 51, within 30% of week 1).
- **§81 Am. / maintenance profile:** the plan is maintenance by its own declared rule; a maintenance plan that does not
  build is the profile working.
- **§111:** scoped to refusals; not engaged.

## The seats

🏃 **Hutchinson (chair).** Nothing about this runner's training changed except one kilometre of jog that led nowhere.
The plan was always a holding plan and tells him so. The audit's 10% line is a screening threshold, not a principle,
and a plan sitting on it will cross it on any change. Accept it and say why in the baseline.

📊 **Seiler.** No distribution question. Session counts are unchanged.

🎯 **McMillan.** A 52-year-old running 70 a week, aiming for 4:15, does not need the plan to climb; he needs it to be
specific. What I would look at is not this flag but the note telling a time-goal runner the plan is "built to get you
round". That is the same note the digest raised today on another runner, and it is filed.

🩹 **Willy.** Less load, not more. The two BINGE plans are 1 pp over a warn line in weeks that got smaller; the long
run did not grow. No injury vector.

⚕️ **Sims.** No objection from this seat.

💪 **Blagrove.** No objection from this seat.

## Ruling

**CORRECT: accept and re-baseline `audit:plans`.** The +1 `NEVER-BUILDS` is a maintenance-profile plan crossing a
screening threshold by 1 km, with its flat shape declared to the runner; the +2 `BINGE-WEEK` is the cost already
accepted this morning. No principle, numeric or invariant changes. Re-baseline with `--write`, reason recorded here.

**Not ruled, and filed already:** the "built to get you round, not to chase a time" note on time-goal plans
(`ROUND-NOTE-TIME-GOAL-01`); this plan carries it too.

## Artifacts

None: nothing the engine prescribes changes. The audit baseline moves with this reason; the register row records it.
