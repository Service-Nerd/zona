# Phase 0.2: root-cause pass, curve vs placed volume (2026-11-20)

**Question (build plan § 2, step 0.2):** are many coaching items one defect, the plan's weekly volume **curve**
diverging from the volume of the sessions actually **placed**, with different rules reading different ones?

**Verdict: PARTLY.** One mechanism explains every delivered-volume warn and BINGE-WEEK / FLAT-CURVE. It does
**not** explain NEVER-BUILDS, WEEK1-LEAP or LONG-RUN-SHORT, which are the curve's own decisions and the bulk of the
objection count.

---

## 1. The map

| Role | Where | Reads |
|---|---|---|
| **Curve producer** | `buildVolumeSequence` (`ruleEngine.ts:446`) → `volumes[i]` → `applyInjuryAdjustments` → `adjustedKm` (`:7698`). §2 ramp cap, §3/§87 deloads, §12 injury cap and bounceback, taper depth are all enforced **here, on the curve** | start/peak km, phases |
| Curve-only consumers | `planIsMaintenance` (`:7582`, labels), `capCompressed` → `meta.volume_constrained` (`:10188`), `isVolumePeak` | curve |
| **Placer** | `buildWeekSessions(adjustedKm, …)` (`:2910`): splits the curve into long / quality / easy shares, then sizes each session by its **own** constraints: §45/§47 long-run caps, specificity floors, §52 share cap **computed against the curve** (`:3474`), `sessionFloorsFor` minimums, structure-priced quality (S9: structured builders never read the km budget), §9 easy ≤ long/ratio, `applyWeekdayMinsCap` (`:4148`) | curve as a target; caps per session |
| Week total | `weekly_km = sumWeeklyKm(placed)` (`:7795`); the curve is **not persisted** | placed |
| **Post-passes** that move sessions and restate `weekly_km` | `applyPeakLongRunAlternation`, `applyLongRunStepBacks`, `applyLongRunProgressionCap` (×2), `reclampPeakStepBacks`, `applyTaperLongRunCap`, `applyV1VolumeQualityStimulusSplit`, `applyV4LongRunRepeatCeiling`, `applyPeakStepBackVolume`, `applyTaperDeliveredDepth`, §90 Am. 1 yield, final `applyWeekdayMinsCap` (`:10566`) | placed; none re-applies §2/§3/§12 |
| Readers of placed | `INV-PLAN-DELIVERED-RAMP`, `-DELOAD-IS-A-REDUCTION`, `-BOUNCEBACK-BOUNDED`, `-INJURY-CAP-DELIVERED` (all `warn`), `classifyPeakOverload` (`:8359`), every `planQuality.ts` predicate | `weekly_km` / `sessionKm` |
| Base-build ramp | `generateBaseBuildPlan` → `onRampCurve` → `generateFoundationBlock` (`foundationBlock.ts:787`): here `weekly_km` **is** the curve and the sessions carry no duration, so the weekday cap never binds | curve |

**The split, in one line:** the load rules are enforced on the curve; the checks and objections read placed volume;
the placer can neither reach the curve (time caps, per-session caps) nor tell the curve it cannot.

## 2. Divergence (measured)

Scratch harness: an instrumented **copy** of `lib/` in the session scratchpad stamps `volumes[i]`, `adjustedKm` and the
at-construction total on each week; nothing in the repo was changed. Full grids, production shape (0 rows set
`fitness_level`), order permuted by stride 7919 (coprime with both lengths), race weeks excluded. "Diverges" =
`|placed − curve| > max(2 km, 10%)`, curve = `adjustedKm`.

| | cohortGrid | targetedGrid | beginner-marathon corpus (`audit:plans`'s) |
|---|---|---|---|
| plans generated | 39,744 of 41,472 | 6,164 of 6,170 | 3,035 of 6,480 |
| non-race weeks | 530,496 | 88,330 | 54,933 |
| weeks diverging | **276,904 (52.2%)** | **38,705 (43.8%)** | **14,653 (26.7%)** |
| of which placed UNDER curve | 261,320 | 37,807 | 11,041 |
| plans with ≥ 1 diverging week | 33,340 (83.9%) | 4,688 (76.1%) | 3,035 (100%) |
| placed vs curve, p05 / p50 / p95 | −51.0% / −10.0% / +7.7% | −36.4% / −7.3% / +3.4% | −55.0% / 0.0% / +20.0% |
| diverging weeks caused at placement / post-pass / both | 81.6% / 8.7% / 7.5% | 77.1% / 15.8% / 3.3% | 30.3% / 67.1% / 2.1% |
| UNDER weeks with a weekday run within 5 min of its time cap | **201,632 (77.2%)** | **34,368 (90.9%)** | not measured |

**The divergence is one-directional and has one dominant cause:** the curve is set from declared volume and does not
know the runner's weekday time budget, so the placer delivers less, by a margin that changes week to week as
different caps bind.

## 3. Attribution per class

"Curve" column = would the rule fire if evaluated on the curve instead of placed volume.

| Class | Firings (cohort / targeted / beginner) | Week (or prior) diverges | On the curve | Mechanism? |
|---|---|---|---|---|
| `INV-PLAN-DELIVERED-RAMP` | 10,064 / 834 / 2,948 | 64% / 75% / 87% | **complies, 100% in all three** | **Yes.** Commonest shape: prior week UNDER, this week back on the curve (a catch-up) |
| `INV-PLAN-DELOAD-IS-A-REDUCTION` | 2,512 / 518 / 3,233 | 100% / 100% / 100% | **reduces, 100%** | **Yes** |
| `INV-PLAN-BOUNCEBACK-BOUNDED` | 0 / 4,258 / 2,170 | — / 63% / 75% | **bounded, 100%** | **Yes**; the agreeing remainder is the curve returning exactly to pre-deload and placed rounding 1 km over it |
| `INV-PLAN-INJURY-CAP-DELIVERED` | 0 / 942 / 620 | — / 38% / 100% | total complies, 100% | **Partly**: it reads the non-long share, so it is composition (long-run share moving), which the curve has no notion of |
| BINGE-WEEK + BINGE-SEVERE-75 | 4,172 / 960 / 0 | week UNDER: 3,868 (92.7%) / 448 (46.7%) | **would not fire, 100%** | **Yes.** Code confirms: the §52 share cap is computed as 60% of the **curve** (`:3474`) on the assumption the easy runs deliver the rest; when the weekday cap stops them, the long run's share of the **placed** week exceeds 60% |
| FLAT-CURVE | 72 / 0 / 0 | — | curve moves in 72 of 72 | **Yes** (tiny class) |
| NEVER-BUILDS | 13,992 / 132 / 0 | w1 under: 51% / 97% | **curve itself never builds: 13,816 (98.7%) / 132 (100%)** | **No.** The start is already at the peak target; only 176 plans have a building curve flattened by placement |
| WEEK1-LEAP | 0 / 0 / 284 | 13 of 284 | **still fires on curve week 1: 284 (100%)** | **No.** It is the curve's start (the week-1 floor) against declared volume |
| LONG-RUN-SHORT | 528 / 513 / 839 | 172 / 0 / 0 | n/a | **No** (control) |

By count of the audit objection classes in these runs: divergence explains BINGE + FLAT = **4,244 of 18,764 (22.6%)**
on cohortGrid and **0 of 1,123** on the beginner corpus. It explains **100%** of the four delivered warns by the
"would the curve fire" test.

### The other ruled items

- **WEEKDAY-OVERRUN-BOUND.** My population (weekday non-long runs over 150% of their stated cap) is **30,028
  sessions on cohortGrid, all quality**, and **does not reconcile** with the item's 560: different definition and
  denominator, not resolved here. Of mine, 23,080 (76.9%) sit in weeks placed UNDER the curve and 22,656 (75.4%) are
  no bigger than curve ÷ days. **The overrun is a session too long for its day, not a week too big for its curve.**
  Same root (the plan does not plan against the time budget), different lever: selection, as ruled.
- **S9-QUALITY-FLOOR-REACH.** Not re-run. Its prototype record (50,456 of 50,888 lifted sessions inert because
  structured builders never read the km budget) is the same **shape** one level down: a sizing quantity computed and
  then ignored by placement. It does not cause the weekly divergence measured above.
- **BASEBUILD-DURATION.** Not re-run (base-build plans are not produced by the grids above). Its own record is this
  mechanism in the second generator: there `weekly_km` is the curve and the sessions ignore the time budget; honouring
  the budget made placed fall below the curve (135 of 189 plans overstated in attempt 1) or made the ramp visibly flat
  (attempt 2). Its ruled fix (hold at the stated budget, refuse when the placed block cannot climb) **is** "the curve
  must know placement capacity", for one generator.

## 4. The single-owner alternative

**Delivered volume is decided once, by a placer that owns the week; the curve becomes a target it reports against.**

1. **Capacity first.** Before the curve, compute each week's deliverable maximum from the runner's constraints
   (days, per-day time budgets × easy pace, §45/§52 long-run limits, session floors). One function.
2. **Curve against capacity.** `buildVolumeSequence` ramps over `min(target, capacity)`, so §2/§3/§12/bounceback are
   enforced on volume that can actually be placed, and "cannot climb" is detected there (the BASEBUILD-DURATION
   `budget_cannot_climb` outcome, generalised to both generators).
3. **One reconciliation after the post-passes.** A single pass re-checks §2/§3/§12 on placed volume and applies
   ADR-022's levers (trim easy, never the race-anchored long run) in one place, instead of each post-pass restating
   `weekly_km` and the validator warning afterwards.
4. **§52's share cap reads the delivered week**, not the curve.

**Would subsume or simplify:** the four delivered warns (they become checks that should read 0, and
`DELIVERED-RAMP-FALSE-DRIVER-01` dissolves: the unattributed driver is the under-delivered prior week); BINGE-WEEK and
FLAT-CURVE; BASEBUILD-DURATION's gate (one capacity function for both generators); ADR-022's injury-scoped levers
(generalised). **Would not touch:** NEVER-BUILDS, WEEK1-LEAP, LONG-RUN-SHORT (curve-start and peak decisions; Phase 0.1
must rule them on their own), S9 and WEEKDAY-OVERRUN-BOUND (session sizing and selection; build them as ruled).

⚠️ **Cost, stated before anyone builds it:** 83.9% of cohortGrid plans have a diverging week, so a capacity-aware
curve changes the curve, the volume profile and the labels of most plans. That is a `cohort:shape` and
`measure:fitness` move, a doctrine change to §2/§3/§12's point of enforcement (Coaching Board), and the opposite of a
patch. Not prototyped here.

## 5. Implication for the build waves

- **Re-plan W1 before building it.** BASEBUILD-DURATION and STAGED-RAMP are the capacity question in one generator.
  Build the capacity function once (step 1 above) as the first item of W1, and have BASEBUILD-DURATION consume it,
  rather than a base-build-only gate the main engine then has to duplicate.
- **Add a W1b (or a W4 lead item): the delivered-volume owner** (steps 2–4), needing a Coaching Board sitting on a
  prototype. It is the FIX for BINGE-WEEK and FLAT-CURVE and retires the four delivered warns. W4's ACHILLES "0 new
  bounceback" condition should be measured after it, not before.
- **Do not wait on it for NEVER-BUILDS / WEEK1-LEAP / LONG-RUN-SHORT.** They are 77% of the cohortGrid objections in
  these runs and are not this mechanism; Phase 0.1's triage decides them.
- W2 (S9, WEEKDAY-OVERRUN-BOUND) is unaffected and can proceed as ruled.

## What this does not prove

- The curve is the engine's **internal** target, not a ruled "intended" volume. Placed under the curve is not by
  itself a defect: on a time-capped runner the placed week may be the right one and the curve the wrong one. That is
  the point of step 1.
- "Would not fire on the curve" is partly tautological for the ramp warns (the curve enforces §2/§3 by construction).
  The measured content is that the **placed** sequence moves differently from it, in 64–100% of firings at a diverging
  week.
- The under-week cause test (a weekday run within 5 minutes of its cap) is a proxy; 22.8% of cohortGrid UNDER weeks
  are not explained by it.
- WEEKDAY-OVERRUN's population is not reconciled with the item's. S9 and BASEBUILD-DURATION figures are quoted from
  their records, not re-run. The charity and engine persona corpora were not run.
- **Falsification:** the harness's first pass counted race weeks, where the race session sits above a small race-week
  curve, and reported 4,424 "over" weeks on targetedGrid. Excluding them dropped "over" to 898, which is why race weeks
  are excluded above. The instrumentation was checked by dumping plans: a 4-day knee-history HM plan (targetedGrid) tracks its curve within
  1 km every week; a 3-day, 60-minute-cap runner at 70 km/week has a curve of 65–70 and a placed week of 23.
