# Coach engine — RCA of the 26 Oct ops-digest findings

**Input:** the founder's coach-engine analysis of 26 Oct 2026 (six items), treated as a hypothesis and re-measured
against the code at `0c21ace4` and production (read-only). Measurement scripts were throwaway (`scripts/.tmp/`).

## What was re-measured, and what changed from the report

| # | Report | Measured | Verdict |
|---|---|---|---|
| 1 | Marathon goal pace past threshold is prescribed; §120 Am.1 is HM-only | **Wider than reported. At every distance**, goal-anchored work is priced at the stated goal with no reachability check. 5 rows are anchored `goal`: `mp_blocks`, `goal_pace_sharpener`, `tenk_pace_intervals`, `tenk_race_simulation`, `beginner_goal_pace_reps`. §120 Am.1 bounds only `hm_pace_intervals` (anchor `HM`). Engine probe: a 35:00-5K beginner aiming for a 55:00 10K gets **5 rep sessions at 5:30/km against an interval pace of 6:42**. Live: of **12** benchmarked time-target plans with a future race, **9** carry future goal-paced sessions faster than the runner's own T, **7** faster than I. Marathon: **5 of 7** benchmarked | ✅ True, wider. 🏃 Coaching Board |
| 2 | `progressive_tempo` and the pyramid have no §9 floor | Confirmed in code. tasha: `INV-PLAN-MIN-SESSION-SIZE` ×3 (error) on the stored plan | ✅ True. 🏃 Board for the unit (time vs km), then fix |
| 3 | Floor-protected easy runs overrun with no note (tasha Friday 52 vs 30) | tasha has **per-day budgets** (Mon 60, Wed 45, Fri 30): Friday +22 min, Wednesday +7, no note. Monday fits | ✅ True as reported |
| 4 | Grids never reach slow runners | Slowest: sweep HM 2:30, cohort 5K 27:30. tasha is VDOT 16.2. ⚠️ **But the gap is not only speed:** the sweep's fixed 4:15 marathon target against its 2:30-HM benchmark is already goal-faster-than-T, and nothing fails, because **no invariant asserts a prescribed pace is reachable**. The grids have no *goal-gap* axis | ✅ True, and the larger cause is the missing check |
| 5 | Audit 16 → 29; maybe empty-string schema noise | The jump is the 23 Oct invariants judging old plans. `meta.athlete` is `z.string()`, which **accepts** `""`, so the empty-string theory is wrong | Not a defect. Digest band is stale |
| 6 | Founder's Dorney plan: goal-pace work labelled Zone 3 | Matches a pre-§83 Am. plan | Rebuild future weeks after #1 |

## How each was introduced

All four defects are the **same shape**: a fix landed on one member of a family, and the check written with it
measured the symptom it was fixing, not the property the runner needs.

| # | Introduced | Survived because |
|---|---|---|
| 1 | §120 (`T`/goal anchors, 2026-09-03) made "race pace" mean the goal. §120 Am.1 (2026-09-22, `bb079d5d` trace 10-06) bounded **one row**, measured on 4,320 HM plans. Its own text names the sibling rows "already anchored `goal`" and does not bound them. GOALPACE-5K-01 (`6e419e8`, 10-23) then fixed the 5K **shape** (reps) and made the **label** honest (§83 Am.), and never asked whether the pace is runnable | **Remedy applied to one twin** (catalogue class) twice. The new `INV-PLAN-PACE-ZONE-COHERENT` checks that the label matches the pace, so an impossible pace with an honest Zone 4–5 label passes: **a check of the label, not the prescription.** The sweep reaches the case but has no reachability invariant, so "0 violations" meant "not asked" |
| 2 | `7aad6740` (2026-09-04) added the segment-priced 5 km floor to `pacedRepPlan` and `continuousThresholdPlan`. `progressiveTempoPlan` (`378121ff`, the day before) and `fixedShapePlan` (`3c9f74ee`, the same day) were not given it | **Remedy applied to two of four shape builders.** No test enumerates the builders. The sweep's `MIN-SESSION-SIZE` debt is 0 because no swept runner is slow enough for minutes to price under 5 km |
| 3 | §82 floor protection (`03a37f97`, 09-03) ratified "exceeded by a few minutes". SESSION-ACHIEVABLE-01 (`ae3765d5`, 10-06) added the per-session overrun note, **inside the structured/long-run branch only**. MWM-FLOOR-VALIDATOR-01 (10-03) taught the validator the floor exemption with **no bound on the overrun** | Remedy applied to one twin again; and "a few minutes" was never a number, so neither producer nor checker could hold it |
| 4 | Grids built for the average runner; one fixed goal per distance | A grid that never varies an axis cannot show a defect on it (`feedback: varying an axis is not reaching the interaction`) |
| 5 | Digest prompt carries a fixed "10–16" band | A fixed number in a prompt drifts the day an invariant is added |

## Fix plans

| # | Fix | Board | Remediation of live plans |
|---|---|---|---|
| 1 | **One reachability rule for every goal-anchored step, any distance**: price goal-anchored work at the goal only while the goal is within N% of what current fitness predicts for that distance; past it, withhold (as §120 Am.1) or re-anchor to the supported pace, and **name the gap in the note at every distance**. Owner: `resolveAnchorPace('goal', …)`, so all five rows and any future row inherit it | 🏃 **Coaching Board sets N per distance and withhold-vs-re-anchor.** Design Board only if the note's placement changes | The 9 live plans (rebuild future weeks, completions and confirmed HR kept, dry-run diff first) |
| 2 | §9 floor in **one owner** (`sessionFloors.ts`) used by every quality shape builder; Board decides whether the floor is km or `min(km, N minutes at the runner's pace)` (S9-DURATION-FLOOR-01's argument) | 🏃 Board for the unit | tasha (plan starts 7 Dec) |
| 3 | Stamp `weekday_overrun_note` on **every** weekday session over its budget, floor-protected easy runs included; bound the floor-protected overrun with a number | ⚙️ note: none (restores §81's "when they don't fit"). 🏃 the bound | tasha, grace, p4mw |
| 4 | Add slow benchmarks (5K 40:00, HM 3:00, MAR 6:00 and 7:30) **and a goal-gap axis** (goal at fitness, +5%, +15%, +30%) to the sweep and the cohort grid; measure the debt before the fixes so they are judged on it | ⚙️ none | — |
| 5 | Digest prompt: replace the fixed band with "change since yesterday, and any code first seen today" | 👤 founder's cloud routine | — |
| 6 | Rebuild the founder's future weeks after #1 | — | founder |

## So it doesn't happen again

1. **Reachability invariants, not label invariants.** `INV-PLAN-GOAL-PACE-REACHABLE` (no work step faster than the
   Board's line for that distance) and `INV-PLAN-WEEKDAY-OVERRUN-DECLARED` (every weekday session over its budget
   carries the note, any kind). Both are keyed on the **condition**, so a new row or session kind is covered without
   anyone remembering it.
2. **Population gates for families.** A test that enumerates every quality shape builder and asserts each prices its
   floor through the one owner, and one that enumerates every catalogue row with a `goal`/`HM`/`M` anchor and asserts
   each resolves through the bounded owner. A sixth builder or row fails the build until it is covered.
3. **Grids carry the axes the defects live on**: slow benchmarks and the goal gap, so the sweep's "0 violations" is
   about runners like the Make-A-Wish cohort.
4. **Twin sweep made mechanical in review.** The `zona-debug` exit criterion exists and was skipped three times here;
   gates 1 and 2 are its mechanical form. Add catalogue class **"a check of the label, not the prescription"**.

### Status of this list, 2026-10-27 (RCA1026-PREVENT-01)

| # | Promised | Status |
|---|---|---|
| 1 | Reachability invariants | ✅ `INV-PLAN-GOAL-PACE-REACHABLE` (GOAL-PACE-REACHABLE-01), `INV-PLAN-WEEKDAY-OVERRUN-DECLARED` (OVERRUN-NOTE-ALL-01); since, `INV-PLAN-LONG-IS-LONGEST-MINS` and the §82 Am. 2 held-run arms |
| 2a | Goal-anchored row population gate | ✅ `lib/plan/rca1026Gates.test.ts`: all 7 rows enumerated from the catalogue; 2 never generated on the slow grid, named under `GRID-GOAL-INSIDE-LINE-01` |
| 2b | Shape-builder population gate | ✅ same file: all 5 builders enumerated from the engine; 3 do not size through `meetsQualityFloor` (progressive tempo, pyramid, hills), named under `S9-QUALITY-FLOOR-REACH-01` |
| 3 | Grids carry the axes | ⚠️ the sweep (slow-goal clones) and `npm run review:coaching` (new `slow` step, `measure:goal-gap --gate`) do; `cohortGrid` still does not (`GRID-GOAL-INSIDE-LINE-01`) |
| 4 | Debug catalogue class | ✅ "A check of the LABEL, not the PRESCRIPTION" in the `zona-debug` skill |
| M | Daily goal-gap count | ✅ `/api/ops/plan-audit` summary `goal_gap` (`lib/ops/planAuditGoalGap.ts`); 0 on 39 live plans today, because none has been rebuilt since the rule shipped |
| M | Digest compares with yesterday | ✅ founder, 2026-10-27 |

## Monitoring

- **Live plans:** `/api/ops/plan-audit` already runs `validatePlan()` daily on every stored plan, so the two new
  invariants monitor the fleet the day they land, with no new job.
- **The digest** reports change against yesterday and new codes, not a fixed band.
- **Make-A-Wish onboarding:** a one-line daily count of plans with a `goal_gap` note, so a cohort of aspirational
  first-timers is visible as it arrives.

## Step 1 measured (GRID-SLOW-GOALGAP-01, 2026-10-26)

`npm run measure:goal-gap` (`scripts/measure-goal-gap.ts`) walks `lib/plan/slowGoalGrid.ts`: 5 slow benchmarks (5K
35:00 and 40:00, HM 3:00, MAR 6:00 and 7:30) × 4 distances × goal gap 0/5/15/30% × 2 levels × 3 day counts × 2
weekday budgets = **960 inputs, 880 plans** through `runEngine` (the 80 not built are the 3-day marathon time-goal
gate, a designed input check). Goal-paced = `stimulus: 'race_pace'` or a `goal`-anchored row; band centre, 1% tolerance.

| Goal vs current fitness | 5K | 10K | HM | MAR |
|---|---|---|---|---|
| at fitness (0%) | faster than T/CV, not I (normal: race pace) | same | 0% | 0% |
| +5% | 100% faster than I | 20% faster than I | 100% faster than T | 0% |
| +15% | 100% faster than I | 100% | 100% | 100% faster than T, 20% than I |
| +30% | 100% | 100% | 100% | 100% faster than I |

- **Item 1 confirmed on the grid.** Nothing in the engine reacts to the gap: goal-paced work follows the stated goal
  wherever it lands. Where the line should sit is per distance (a 5K at fitness is naturally near I).
- **Item 2:** 204 `INV-PLAN-MIN-SESSION-SIZE` on 152 of 880 plans.
- **Item 3:** 7,627 weekday sessions over their budget with no note, every one floor-protected, on 264 plans, worst
  +20 min.
- **New, same root as item 2:** in the sweep's slow-goal clones the floor-carrying builders grow reps past their
  dose: `INV-PLAN-VO2MAX-MAIN-SET-CAP` 73, `INV-PLAN-GOAL-PACE-SHAPE` 122, `INV-PLAN-MAIN-SET-ORDERING` 1. With the
  §9 floor off, VO2max-cap violations on the slow grid go 24 → 0 (proven for that code; the other two by reading).
  So item 2 has two faces, the floor missing in two builders and the floor over-applied in the others, and the Board
  decides both with one ruling on the unit.

The sweep now carries 1,177 slow-goal clones (every 17th sampled input); their violations are tallied as
`<code>@slow-goal`, so the main population keeps its zero.

## What this does not prove

Nothing here ran on a device. The live counts are 12 benchmarked plans; unbenchmarked plans estimate fitness and were
not counted. The reachability line is a coaching decision this analysis does not make.
