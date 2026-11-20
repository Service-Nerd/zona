# Coaching Board — `S9-QUALITY-FLOOR-REACH-01` path (2), the prototype sitting

**Date:** 2026-11-20 · **Chair:** Hutchinson · **Seats:** Seiler, McMillan, Willy, Sims (Blagrove silent, no strength rule in scope)
**Trigger:** soft trigger that qualifies. The `lib/plan/ruleEngine.ts` sizing changes a stated prescription field.
**Prior sitting:** `coaching-2026-11-15-wave5-delivered-volume.md` Part B (2) ruled INSUFFICIENT EVIDENCE, on the condition *"the
delivered duration and work-minute distribution of those 13,092 sessions before and after, plus `measure:fitness`.
One prototype."*

## The question the board could not answer without a prototype

§9's Amendment (2026-10-27) says a quality session meets the floor at 5 km **or** at 35 minutes. The primary quality
call site sizes with `Math.max(roundDist(qualKmPrimary), minDist.quality)` (`ruleEngine.ts` ~3719), which is **and**.
If the call site honoured **or**, what would the runner lose? Specifically: how many sessions get shorter, by how many
minutes and work-minutes, and does `measure:fitness` move?

## Options prototyped

- **A: an OR-floor on the budget.** Where the call site lifted the budget to 5 km, deliver the budget instead if the
  session at the budget already lasts `QUALITY_FLOOR_MINS`. This is the item's literal fix.
- **B: effort-governed distance from its own structure.** Added once the measurement showed which sessions A reaches.
  An effort-governed session's `distance_km` becomes its structure's moving time at easy pace. Moving time is the
  total minus standing recovery, priced by `effortGovernedPlan` plus `durationForMainSet`. B applies to every such
  session, lifted or not.

**Prototype:** branch `proto/s9-quality-floor-reach-01` @ `215f2fb3`, worktree
`/Users/russe/rts-training-hub/.claude/worktrees/agent-ae910855a459ed9a0`. Both options sit behind the module-level seam
`__protoS9FloorReach` (default OFF) in `makeQualitySession`, so the baseline and each option generate in one process.

## Evidence (all run on the branch, 2026-11-20)

`npx tsx scripts/proto-s9-floor-reach-measure.ts --stride 1` covers all of `cohortGrid` (39,744 served, 1,728 refused)
and `targetedGrid` (6,164 served, 6 refused). Both grids leave `fitness_level` unset, which is the production shape.

### 🔴 The premise was wrong: the lift almost never reaches a delivered field

| | cohortGrid | targetedGrid |
|---|---|---|
| primary-quality calls where the budget was lifted to 5 km | 46,728 sessions / 20,016 plans (50.36%) | 8,548 / 3,172 (51.46%) |
| …delivered session already ≥ 35 min | 44,100 / 19,080 (48.01%) | 6,788 / 3,044 (49.38%) |
| **…reaching the only branch that reads `distKm`** (unstructured) | **432** | **0** |
| …of those, ≥ 35 min at the budget | 432 (432 plans, 1.09%) | 0 |
| rows | `hill_reps` 432 (intermediate/build 288, experienced/build 144) | none |

Every structured builder (`pacedRepPlan`, `progressiveTempoPlan`, `continuousThresholdPlan`, `fixedShapePlan`) prices
its distance from its own structure and **never reads `distKm`**. So **50,456 of the 50,888 lifted ≥35-minute sessions
(99.2%) are inert**. The only sessions the lift reaches are effort-governed hill reps. Their duration already comes
from structure (§40b Am. 2), and their `distance_km` is simply the weekly budget.

⚠️ **The item's 13,092 sessions / 26.1% was not reproduced.** The closest definition here (lifted, delivered
≥ 35 min) gives 50,888 sessions in 22,124 of 45,908 plans (48.2%). The figure that matters is the 432.

### Option A: what the runner loses

| 432 changed sessions | before | after |
|---|---|---|
| `distance_km` | 5 (all) | 3.5–4 (median 3.5) |
| `duration_mins` | 54 (all) | 54 (all); **0 durations changed** |
| `derived_set` (work structure) | | **0 changed** |

- **Plans:** 432 changed (1.09% of cohortGrid), 0 in targetedGrid.
- **Week totals:** 352 non-quality sessions absorb the freed km, and weekly km moves in 220 weeks (−2 to +1 km).
- **`validatePlan`:** **0 new errors**. New warns: `INV-PLAN-DELIVERED-RAMP` +84.
- **The 11-15 condition, answered:** no session gets shorter in time or in work. A changes one number, the stated
  distance of a 54-minute hill session, and makes it **less true**: 3.5 km in 54 minutes is 15:26 /km.

### Option B

| | cohortGrid | targetedGrid |
|---|---|---|
| plans carrying a hill/hike quality session | 8,664 | 136 |
| plans changed | 8,376 (21.07%) | 136 (2.21%) |
| hill `distance_km` before → after | 5–11.5 (median 7) → 5–7.5 (median 6) | 5–9 (6) → 5–8.5 (6.5) |
| `duration_mins` / `derived_set` changed | 0 / 0 | 0 / 0 |
| weeks whose weekly km moves | 8,428 (−6 to +2 km, median −1) | 196 (−1 to +2) |
| new errors | 0 | 0 |
| warns new / gone | PEAK-IN-PEAK-PHASE +500, LR-MAX-WEEKLY-PCT +176/−192, DELIVERED-RAMP +8/−96, LARGEST-SESSIONS-SPACED +32 | DELIVERED-RAMP −16 |

- **On the hill sessions A reaches, B raises the distance** (`scripts/proto-s9-floor-reach-peakwarn.ts 7`, stride 7):
  5 → 6 km on 267 and 5 → 6.5 km on 41 (both 54 min); 5 → 5 km on 41 (47 min). The floor stops binding.
- **PEAK-IN-PEAK-PHASE:** 71 of 1,236 hill plans (5.7%) at stride 7 gain the warn. Every example is a 5K, 3-day plan
  (e.g. 20 km/wk, "peak-phase max 26km").

**Candidate check, falsified on the branch.** The rule: `distance_km − 0.5`, priced at the plan's easy pace, must fit
inside `duration_mins`. The pace comes from `easyPaceFromPlan`, which reads the plan's own easy sessions rather than
the producer's function. **Baseline: fires on 377 of 1,277 hill sessions (29.5%). Option B: 0.** So today, nearly a
third of hill sessions state a distance the runner could not cover in the stated time even at easy pace.

### `measure:fitness`

`npx tsx scripts/proto-s9-floor-reach-fitness.ts` runs the harness's own `measure()` three times, read-only.
- Seam off vs the committed baseline: identical.
- **Off vs A: identical.**
- **Off vs B: identical**, in every bucket (e.g. other standard: n 9,796, median build 40%, never builds 9.4%).

`cohort:shape` was not run because the item's conditions do not name it. It is a build condition for B below.

## Conflict scan

- **§9 Amendment (S9-QUALITY-MINUTES-01):** A implements its letter. Measured, that letter reaches only effort-governed
  rows, where km is not the dose.
- **§40b Amendment 2:** an effort-governed session is sized against its own structure. It fixed duration and left
  distance on the budget, so A makes distance less coherent. B extends Am. 2 to distance.
- **§40b body and Am. 4:** the estimate is never the prescription. B states a distance and adds no pace, RPE or zone.
- **§8 Am. (2026-09-04):** "the runner plans against the number", with distance and duration each derived
  independently and correctly. B applies this to the one session type it skipped.
- **§52b:** stays in km and is untouched; no day sizing changes.
- **§1:** counts sessions only, so a distance change cannot move it (Seiler; CD-19).
- **§34 (warn honesty):** B's new findings are warns, not errors.
- **PEAK-IN-PEAK-PHASE:** B changes which week is biggest on 5.7% of hill plans. No amendment contradicts the rule.
- **§25 Am. 1** (*"read by nothing is evidence a consumer is missing"*): no structured row's sizing reads the
  call-site 5 km floor. Not deleted, because it still guards the no-row inline fallback (measured reach 0).

## Seats

**🏃 Hutchinson (chair).** On the 15th I called this a prescription change wearing a defect's clothes. The prototype
says it is neither. Of 50,888 lifted sessions, 432 lifts reach anything, and none of those changes a minute of
running. The "quarter of all plans' quality sessions shorter" that stopped this board on the 15th does not exist: that
figure counted a call site, not what runners receive. What A actually does is write 3.5 km on a 54-minute hill
session. I will not rule that a floor is honoured by making a stated number less true.

**📊 Seiler.** Neither option touches §1, which counts sessions. On the 15th my point was that the amendment was live
in the checker and dead in the producer. It is dead in the producer because the producer is right: structured
sessions never read the budget. The hill session is effort-governed, so km is not its dose, and its work structure is
identical under both options. No objection to B.

**🎯 McMillan.** Picture the Tuesday. The runner sees "Hill reps, 54 min, 5 km", runs for 54 minutes and covers 6 or 7.
That is the 11-15 complaint again: the plan said X, they did Y. A makes it worse (3.5 km); B makes the number roughly
what happens. I'd rather the card said less about kilometres on a hill day, but that is Design's call, not ours. B.

**🩹 Willy.** Hill reps are high tissue stress (§40b Am. 2). What matters to me is that weekly km, which §2 and the
ramp checks measure, counts what was actually covered. A takes 1–1.5 km off the stated week and hands it to an easy
run that the runner will also actually run. That under-counts the hill day and adds 84 ramp warns. B moves weekly km
toward the truth (median −1 km/wk), with ramp warns net −88 in cohortGrid and −16 in targetedGrid. I want the
PEAK-IN-PEAK warns measured in the build. They are a condition, not a reason to stop.

**⚕️ Sims.** A stated distance a third too short is a stated energy demand a third too short. That is the same
asymmetry behind §40b Am. 2's 60 seconds. Today 377 of 1,277 hill sessions state a distance that cannot fit in their
own duration; B takes that to 0. No sex-specific objection.

**💪 Blagrove.** Silent.

## Recorded disagreement

**Seiler vs Willy on the PEAK-IN-PEAK-PHASE warns.**
- Seiler: they are an accounting artefact of a truer number and need no ruling.
- Willy: a peak that moves out of the peak phase is a load-shape change on 5K 3-day plans, and it must be quantified
  per plan before ship.

The chair sides with Willy, as a build condition rather than a block.

## Ruling

- **Option A: INCORRECT (veto).** It reaches 432 sessions, all `hill_reps`, and shortens nothing the runner runs
  (0 durations and 0 work structures changed). It lowers a stated distance below what the session covers
  (5 → 3.5 km in 54 min) and adds 84 ramp warns.
- **Path (2) as a §9 question: CLOSED.** The OR/AND contradiction is real in code and empty in delivery. Every
  structured row prices its own distance; the call-site floor binds only effort-governed rows, where km is not the dose.
- **Option B: CORRECT WITH AMENDMENT, as §40b Amendment 5.** It is the fix for the only population the lift reaches,
  and it ends the floor's reach there by construction: the formerly lifted sessions go to 5–6.5 km.

## Build spec

1. **Principle.** A new **§40b Amendment 5**: *"An effort-governed session's stated distance is its own structure's
   moving time (total minus standing recovery) at easy pace. It is an estimate, never a target, and never the weekly
   quality budget."* Plus a note on the §9 Amendment: *"The 5 km floor at the primary quality call site reaches no
   structured row, because each prices its own distance, and after §40b Am. 5 no effort-governed row. It remains only
   as the guard for the no-catalogue-row inline fallback (measured reach 0)."*
2. **Numeric.** **No new constant.** B reuses `EFFORT_GOVERNED_RECOVERY_SECS`, `EFFORT_GOVERNED_TRANSITION_MINS`,
   `durationForMainSet` and the easy pace. `MIN_SESSION_DISTANCE_KM.quality` and `QUALITY_FLOOR_MINS` are unchanged.
3. **Producer.** In `makeQualitySession`'s `effectiveDistKm` chain, add an `effortPlan` arm,
   `(durationForMainSet(effortPlan.mainMins) − effortPlan.standingMins) / pace.minPerKmEasy`, ahead of the `distKm`
   fallthrough. This is exactly the prototype's option B.
4. **Invariant.** **`INV-PLAN-EFFORT-DISTANCE-FITS-DURATION`** (error), with a row in `plan-invariants.md`. For every
   effort-governed quality session, `(distance_km − 0.5) × easyPaceFromPlan(plan) ≤ duration_mins`. It reads the plan,
   not the producer. Falsified on the prototype: 377 of 1,277 baseline hill sessions fire, 0 under B.

### Conditions (binding on the build)
- **(Willy) `cohort:shape`:** run `npm run cohort:shape` with B and state every moved rate, especially mean delivered
  peak. Re-baseline only with that statement.
- **(Willy) PEAK-IN-PEAK-PHASE:** declare the residual per plan, not per warn (prototype: 71 of 1,236 hill plans at
  stride 7, all 5K 3-day). If a plan's peak week leaves the peak phase by more than the hill-day delta, bring it back
  to the board.
- **`measure:fitness`:** re-run in the build commit. It must stay identical, as it did on the prototype.
- **Errors:** no new `error` violations (prototype: 0 on 45,908 plans).

## What this does not prove

- The PEAK-IN-PEAK-PHASE consequence was not traced week by week; only its count and examples were.
- The injury cohort was not measured: `cohortGrid` does not vary injury, and `targetedGrid` reached only 136 hill plans.
- `fullEnvelope`, the slow-goal grid and `ultra_specific` effort rows (`vert_hike_repeats`) were not swept. The hill
  population here is `hill_reps` in two grids.
- Hills are run slower than easy pace, so B's distance is an upper-bound estimate. The invariant's slack is 0.5 km.
- The item's 13,092 / 26.1% was not reproduced, and its derivation is unknown.
- `cohort:shape`, `verify:parity` and the full suite were not run (shared machine, per the brief).
