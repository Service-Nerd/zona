# Coaching Board — `LR-FINISH-WITHHELD-PRICING-01`, 2026-11-20

**Verdict: CORRECT WITH AMENDMENT — a withheld plan with no derivable current race pace builds its long run as the
finish-goal plan at that distance would. Lands only with §120 Am. 4; today it moves 0 plans.**

**Trigger:** soft, qualifying — what a withheld plan's peak long run prescribes. Records only (founder brief
2026-11-20): nothing built, no doctrine edited.
**Proposed change (as filed):** decide how §25's race-pace long-run finish is priced on a goal-withheld plan whose pace
guide carries no marathon/HM pace, without un-nulling §24b's beginner fields (`ZONES-BEGINNER-BANDS-01`).
**Not ruled here:** `GOALPACE-UNBENCHMARKED-MARATHON-01` and `STEPBACK-SPECIFICITY-SCOPE-01` (both need prototypes).

## Analysis — every figure re-derived

Evidence: `scripts/board-evidence-lr-finish-withheld-pricing-01.ts` (read-only; `cohortGrid` 41,472 inputs plus
`slowGoalGrid` at `slowGoalDates()`; peak non-deload long runs; level read as `fitness_intensity_level ?? fitness_level`).

| Item's figure | Re-measured 2026-11-20 |
|---|---|
| unbenchmarked beginner HM peak long runs with a race-pace finish: 1,728 of 2,592 | **1,728 of 2,592** |
| …marathon: 576 of 1,152 | **576 of 1,152** |
| that finish is priced at GOAL pace | **confirmed**: segment strings are `5:27 /km` (HM, 1:55:00 target) and `6:03 /km` (MAR, 4:15:00), exactly the cohort's goal paces; code path `lrSegPace = !pace.goalWithheld ? goalPace` (`ruleEngine.ts:3580`) |
| `buildFallbackPace('beginner')` MP / HM null | **confirmed** null / null; intermediate and experienced carry both |
| *"a withheld beginner, and any withheld 5K/10K runner, gets no finish"* | 🔴 **FALSE TODAY, in both halves** — see below |

🔴 **The item's headline describes a defect that no plan has today.** Withholding (§120 Am. 2) applies only to
**benchmarked** plans, and a benchmarked plan prices from VDOT, so its guide always carries MP/HM. Measured cell by
cell, withheld vs not, the count of peak long runs carrying a race-pace segment is **identical in every cohort cell**
(e.g. HM beginner 1,728 withheld = 1,728 unwithheld; MAR beginner 576 = 576; slow grid HM beginner 180 of 270 withheld
vs 60 of 90 not). The withheld HM/MAR beginner keeps the finish **at current pace**, which is what
`GOAL-PACE-LR-CURRENT-01` intended.

🔴 **And "`lrSegPace` has no 5K/10K branch" is true and irrelevant.** 5K/10K never read `lrSegPace`: their peak
finish is §24b's `fiveKTenKPeakLongRunSession`, priced from the guide's **current** MP/HM, gated to non-beginners
(§24b Amendment). Withheld 5K/10K intermediate/experienced keep **864 of 864** segments; beginners carry **0** in both
the withheld and unwithheld cells because they take §24d by design.

✅ **What is real:** the defect appears the moment §120 Am. 4 withholds goal pace for an **unbenchmarked** HM/MAR
beginner — their guide has no MP/HM, so `lrSegPace` is null and the finish disappears, silently, on **2,304 peak long
runs** (1,728 + 576) of the cohort grid. That is the population the sitting rules for, in advance.

**What the evidence cannot show:** anything about runners (no plan is affected today); `measure:fitness` /
`cohort:shape` deltas, which need §120 Am. 4 built.

## 🔍 Conflict scan
**§25** (race-specific long run; owns the finish) · **§24b + Amendment** (beginners take no segments; MP/HM null by
design) · **§24d** (feel-based negative split, 5K/10K finish goals and beginners) · **§80** (finish-goal long run is
time on feet) · **§120 Am. 2** — the precedent that settles this: *"a withheld goal leaves no race_specific row to
prefer; selecting as a finish-goal plan"* (taper and peak selection already do exactly this) · **§120 Am. 4**
(unbuilt; this ruling binds its build) · **§47 + Am. 1/3/4** (a finish-goal-shaped long run carries no
`lr_segment_pace`, so §47's stamp trigger will not fire — that is `STEPBACK-SPECIFICITY-SCOPE-01`'s question, not
re-opened here) · **`ZONES-BEGINNER-BANDS-01`** (do not un-null). No contradiction found with the ruling below.

## Seats
🩹 **Willy:** *"Last sitting I said we were rationing a load that should not exist. The answer is not a different
pace for the last three kilometres of a beginner's longest run; it is no pace. Their biggest single load of the block
is the distance. Do not add intensity to it to keep a label."*

🎯 **McMillan:** *"A first-timer still benefits from finishing a long run strong, and §24d does that with no number on
it. I'd give the HM and marathon beginner the negative split too."* (Disagreement recorded below.)

📊 **Seiler:** *"No objection. A finish segment removed from a long run moves nothing on a session-count
denominator (CD-19); this does not touch §1."*

⚕️ **Sims:** *"No objection. It removes a goal-paced effort from a low-fitness cohort's longest day; that is the safe
direction for energy availability."*

🏃 **Hutchinson (chair):** *"Two of the item's three sentences describe nothing that exists, and I want that in the
record before the third. The real case is conditional on a build this board has held. §120 Am. 2 already decided the
shape of the answer: when the goal is withheld the plan is selected as a finish-goal plan. The long run should follow
the rest of the plan, not invent a third prescription."*

## ⚡ Recorded disagreement
McMillan would give HM/MAR beginners §24d's negative-split finish; Willy refuses any added intensity on a beginner's
peak long run. **The chair rules finish-goal parity**, which at HM/MAR today is the plain time-on-feet long run (§80)
and at 5K/10K is already §24d. What would change it: completion or injury data on beginner peak long runs with a
feel-based finish — none exists.

## ⚖️ Ruling — CORRECT WITH AMENDMENT
1. **Where goal pace is withheld and the pace guide has no current race pace for the distance (`marathonPaceStr` /
   `hmPaceStr` null), the peak long run is built exactly as a finish-goal plan at that distance would build it.** Never
   at goal pace; never by un-nulling §24b's fields; never silently absent with a race-pace label left behind.
2. **Scope:** applies only once §120 Am. 4 withholds for unbenchmarked runners. **Today it changes 0 plans**, and it
   must land **in the same commit** as §120 Am. 4, measured with it (McMillan's standing condition: `measure:fitness`
   and `cohort:shape` reported with that build).
3. **The item's two false premises are corrected on the record:** a withheld plan today is benchmarked and keeps its
   finish at current pace; withheld 5K/10K runners keep §24b's finish (864 of 864).
4. **Hand-off, not a ruling:** finish-goal parity leaves the long run with no `lr_segment_pace`, so whether §47's
   step-back still applies to these 2,304 peak long runs is `STEPBACK-SPECIFICITY-SCOPE-01`'s option (b)/(c), unchanged.

## 📦 Required artifacts (land with §120 Am. 4's build)
| | |
|---|---|
| **Principle** | **§25 Amendment** (or §120 Am. 4's own text): withheld + no current race pace ⇒ finish-goal long run, citing §120 Am. 2's precedent |
| **Numeric** | **none** — reuses the finish-goal path's existing config (§80; §24d's `LR_FINISH_GOAL_LATE_PEAK_SEGMENT_PCT` at 5K/10K) |
| **Invariant** | a goal-withheld plan carries no long run whose `lr_segment_pace` equals goal pace, and no long run labelled race-paced without an `lr_segment_pace` (the existing `INV-PLAN-LR-SEGMENT-RECORDED` covers the second half for a `Zone 2–3` label); falsified by restoring `lrSegPace = goalPace` under Am. 4 |

## ↗️ SLT escalation
None. No tier, no price.

## What this does not prove
That the finish-goal long run is better for these runners than a feel-based finish (McMillan's position) — no outcome
data. Nothing about the pace a withheld beginner's other sessions carry (that is `GOALPACE-UNBENCHMARKED-MARATHON-01`).
The grid's unbenchmarked beginners all carry one target per distance, so the goal-pace equality is confirmed for those
targets, not swept across target times.
