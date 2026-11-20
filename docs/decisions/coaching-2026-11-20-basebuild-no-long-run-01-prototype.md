# Coaching Board — `BASEBUILD-NO-LONG-RUN-01` · 2026-11-20 · prototype sitting · ⚖️ CORRECT WITH AMENDMENT (option B)

**Input:** founder instruction, 2026-11-20: *"Yes prototype the engine builds. I want all coach engine items in a ready
state to build."* Item filed 2026-11-15 as §116 Amendment 12's residual
(`docs/decisions/coaching-2026-11-15-wave5-delivered-volume.md`). It asked for *"a prototype with a designated long
run, `measure:fitness`, `cohort:shape` and a ruling."*

**Trigger:** `lib/plan/foundationBlock.ts` (soft: changes prescription), branch only. Hook exemption: branch-only
prototype for a board measurement, not merged.

**Prototype:** branch `proto/basebuild-no-long-run-01` @ `fe4e69ee`, worktree
`/Users/russe/rts-training-hub/.claude/worktrees/agent-aa66e81f24283456d`. Not pushed, not merged.

---

## The question the board could not answer without a prototype

When a base-build ramp week gives the runner a designated long run, what does that do to the block, and which way of
doing it is safe? The 11-15 sitting knew the block had no long run. It did not know (a) why, mechanically, (b) whether a
long run can be added without breaking §116's own gates, or (c) whether adding one touches the absolute-size hazard.

## Why the block has no long run (read from the producer, reproduced)

Two mechanisms in `buildFoundationSessions` / `generateFoundationBlock`, both under `curve: 'ramp'`:

1. **Three days or fewer: never.** `FOUNDATION_MIN_SESSIONS_FOR_LONG_RUN = 4` is derived from §57's 35% long-run share
   and §9's 1.25 ratio. At 3 runs the ratio needs a 38.5% share, so the week is split equally.
2. **Four days or more: it disappears as the week grows.** The long run may grow by `min(+20%, +1.5 km)` a week while
   the week grows 10%. Once the easy runs pass `long / 1.25` the search breaks and the week falls back to equal runs.
   **The equal-run fallback has no per-run bound at all**, so the bound on the long run is what removes the only bound.
   After every deload the reference is the deload's shortened long run, so it ratchets down.

Reproduced today (`scripts/proto-basebuild-repro.ts 3 70 28`, `runEngine` with `acceptBaseBuild`, marathon): 15 weeks,
**70 → 265.8 km/week, every week three identical runs, week 15 three runs of 88.6 km.** At 4 days, 20 km/week, longest
run 6 km: a long run in weeks 1–4 and in deloads only, identical runs everywhere else, ending at four 18.9 km runs.

## Options prototyped (all ramp-scoped; race-plan foundation blocks untouched)

| | What it does |
|---|---|
| **A** | Designated long run at any run count ≥ 2. Share cap = the derived minimum that admits §9's ratio (`r / (r + n − 1)`), never below §57's 35% nor above §52's 60%. Progression cap unchanged. Falls back to equal runs where it still inverts. §45's 5% step-back after a deload |
| **B** | A, and **the long run governs**. When the progression cap binds, the easy runs are held at `long / 1.25` and the week states what it holds. A deload holds the long run at last week's length and takes its cut from the easy runs, at 70% of what was **delivered**. A build week never shrinks below the last build week |
| **C** | A with the progression cap as §45's ratio only (the producer's +1.5 km absolute dropped, i.e. the producer aligned to §116 Am. 12's invariant unit) |
| **D** | B + C |

Seam: `PROTO_BASEBUILD_LONG_RUN.mode` in `foundationBlock.ts`. **`off` is byte-identical to HEAD**: same sha
`f6242451ab3fa655` on 3,191 base builds + 90 `runEngine` rows with HEAD's file swapped in
(`scripts/proto-basebuild-parity-dump.ts`).

## Evidence

Command: `NODE_ENV=production npx tsx scripts/proto-basebuild-no-long-run-measure.ts 7 1` (≈50 s). Corpora:
`cohortGrid` stride 7 (coprime to 2⁹×81; production shape, `user_declared_level`, never `fitness_level`), 5,925 rows,
every one a base build under the Adjust door. And a constructed **design-cohort grid** of 5,760 rows (3–30 km/week,
longest run 0/25/40% of the week, five day sets including a blocked weekend day as all four live runners have, caps
30/45/none, ages 30/52), because `cohortGrid`'s volume floor is 20 km/week.

**cohortGrid, 5,925 base builds**

| | off | A | B | C | D |
|---|---|---|---|---|---|
| plans with every run identical | **1,975 (33.3%)** | 0 | **0** | 0 | 0 |
| multi-run weeks with a long run | 29.6% | 45.6% | **96.6%** | 67.1% | 96.6% |
| longest session median / p90 / max (km) | 33.2 / 63.2 / **88.6** | 33.2 / 63.2 / 88.6 | 29.5 / 41.0 / **43.4** | 45.3 / 88.6 / 93.0 | 46.5 / 93.0 / **102.2** |
| session > 2× longest recent run | 2,716 (45.8%) | 2,716 | **1,728 (29.2%)** | 5,104 | 5,432 |
| session > race distance | 4,692 (79.2%) | 4,692 | 4,321 (72.9%) | 5,145 | 5,309 |
| peak/start median | 2.59 | 2.59 | 2.31 | 2.59 | 2.59 |
| end-week km median | 132.9 | 132.9 | **96.1** | 132.9 | 132.9 |
| plans changed | — | 4,775 | 5,925 | 5,269 | 5,925 |
| production gate errors (`validateBaseBuildBlock` + `validateStagedRace`) | 0 | 0 | **0** | 0 | 0 |
| weeks with long run > 60% / long run not the longest | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |

**Design-cohort grid, 5,760 base builds** (the ≤ 15 km/week subset, n = 4,320, in brackets)

| | off | A | B | C | D |
|---|---|---|---|---|---|
| every run identical | 2,880 (50.0%) [2,304] | 576 [576] | **0 [0]** | 576 | 0 |
| multi-run weeks with a long run | 23.4% | 43.4% | **83.8%** | 48.6% | 83.8% |
| longest session max (km) | 37.9 | 37.9 | 27.4 | 39.8 | 43.8 |
| end-week km median, all [≤15] | 45.5 [37.9] | 45.5 [37.9] | 42.6 [**37.9**] | 45.5 [37.9] | 45.5 [37.9] |
| peak/start median [≤15] | 3.79 [3.79] | 3.79 | 3.55 [**3.79**] | 3.79 | 3.79 |
| production gate errors | 0 | 0 | **0** | 0 | 0 |

- `validatePlan` (not a gate for this plan kind) moves on one code only, `INV-PLAN-STRIDES-PRESENT` (+2,631 under B on
  cohortGrid), because a week with a long run now has a §28 stride carrier. §116 Am. 6 / §57 keep strides out of this
  block: a race-plan rule that does not apply here, recorded rather than counted.
- **Staged plans share the ramp.** `runEngine` default path, 524 design-grid rows: 376 race plans, 90 staged, 58
  refusals. B changes **84 of 90 staged** plans and **0 race plans**, with **0** gate errors including
  `validateStagedDoorRatio`.
- **Live (read-only SELECT, `scripts/proto-basebuild-live.ts`):** 43 plans, 4 base builds. Stored plans do not change
  (new plans only). Rebuilt from their stored inputs under B: weeks carrying a long run 1→3, 0→6, 1→3, 0→0; end week
  37.9→36.6, 26.5→26.5, 37.9→36.6, 11.6→11.6; longest session **9.4→10.8** on two, 8.8→10.1 on one; 0 gate errors.
- **`measure:fitness` and `cohort:shape` with B on (`PROTO_BASEBUILD_LONG_RUN=B`, once each): identical to the
  committed baselines, every field.** Both call only `generateRulePlan`, which never builds a ramp, so **both are
  structurally blind to this change**. The item named them as conditions; they cannot discharge them.
- The item's figures (99.5% identical of 47,662; p90 88.6) **did not re-derive on cohortGrid**: 33.3% identical, p90
  63.2. The 47,662-row corpus has no committed script. The worst case reproduces exactly.

## 🔍 Conflict scan

- **§57 / CB-1** (`FOUNDATION_MIN_SESSIONS_FOR_LONG_RUN`): *"reduce days, never inflate sessions"; "the inverted week
  is a defect at any volume"*. B inflates no session (held easy runs are smaller) and inverts none (0 weeks). The 35%
  share and 4-session minimum were derived for a **gap-filler**; a ramp is §116's. Ramp-scoped only.
- **§9** ratio 1.25: honoured on every week. **§9's per-distance time cap** cannot reach: the ramp carries no pace
  (`BASEBUILD-DURATION-01`). **§122 Am. 1** (foundation long run not capped by §9) is about a holding block, not a
  climbing ramp; not engaged.
- **§52** 60% share: the derived share sits under it; 0 weeks over.
- **§45**: the step-back after a deload; a growth cap tighter than §45's. B's deload holds, never grows, the long run.
- **§116 Am. 1** (curve climbs): B first failed it on **1,296 of 5,760** (post-deload rounding at 2–3 km runs, and the
  week a long run first appears); both fixed in the prototype, then **0**. **Am. 2 / Am. 12** per-run step: passes.
  **ONRAMP-SPACING-01 R2** (a deload's runs capped at last week's longest): B holds the long run *at* that cap; passes.
- 🔴 **§116 Am. 12, read against B.** B bounds absolute size **only** through the producer's `+1.5 km` arm, read from
  `WEEK1_PER_RUN_STEP_MAX_KM`. Am. 12 ruled that constant a week-1 screen and moved the **invariant** to a ratio; the
  producer kept the tighter `min`. Option D aligns the producer to the ratio and the max session goes **43.4 → 102.2
  km**. So the arm is load-bearing and reads a constant named for another job.
- **§118 / §111** ratio ceiling (3.78 vs 4.0): B lowers peak/start, never raises it. No second ceiling is added.
- **§1 / §116 Am. 6**: all easy, no quality. Unchanged. **§3 / §87**: deload is 70% of delivered under B. **§106**: not
  engaged.

## 🏃 Alex Hutchinson (Chair)

The prototype answered the question the last sitting could not, and not the way the item expected. A designated long
run by itself (A) is cosmetic: it removes the identical weeks and leaves every absolute number where it was, 88.6 km
included. What matters is B's second half: **the long run becomes the bound on the week**, so the equal-run fallback,
which had no bound, stops existing. The 88.6 km three-times-a-week plan becomes a 43.4 km worst case. I will not call
43 km safe for a runner whose longest run is 28. I will call it a problem that now lives in one session, where §9's
time cap can reach it once the ramp carries a pace.

I will not accept B resting on a constant this board said, five days ago, means something else. If 1.5 km is the
ramp's long-run step, it gets its own name and its own principle.

The fitness and shape harnesses returning identical numbers is not evidence of safety. They never generate a ramp.

## 📊 Stephen Seiler

*"All easy and all identical are different things"* was my line, and B is the first version that answers it: 96.6% of
multi-run weeks have a shape. A gets to 45.6%, so half the block is still undistributed. No distribution objection; no
quality enters. The strides delta is a race-plan rule reading a base-build plan; it is not a finding.

## 🎯 Greg McMillan

B is what a coach writes: one longer run, two shorter ones, and when you can't grow the long run you don't pile the
volume into the Tuesday. At the design cohort's volumes the reach does not change (37.9 km end median, before and
after), and below the long-run floor the runs stay equal, which is right at 8 km a week.

The cost lands above 20 km a week: cohortGrid's end-week median drops 132.9 → 96.1. A base build is for a runner whose
volume is too low for their race. A 70 km/week runner reaching 96 instead of 133 loses nothing they should have had.

## 🩹 Rich Willy

C and D are out, by my own amendment: a ratio-only step compounds and the max session passes 100 km. B works because a
+1.5 km step is linear. On 11-15 I conceded the absolute for the **invariant**, where it was unsatisfiable against §2's
weekly 10%. Under B it is no longer measured against the week; the week is measured against the long run. Satisfiable by
construction, 0 violations. So the absolute belongs in the producer under its own name, and the invariant keeps the
ratio.

The residual is mine: **1,728 of 5,925 (29.2%) still prescribe a session over twice the runner's longest recent run.**
Linear beats compounding; it is not tissue-matched. On the live inputs two runners go from a 9.4 km longest session to
10.8 off a longest recent run of 7–8. Stored plans don't move, so my 11-15 condition holds, but a rebuild through the
Adjust sheet would hand them this.

## ⚕️ Stacy Sims

I asked for one longer run and two shorter ones so recovery cost distributes. B does that on 83.8% of weeks in the
design cohort, which skews female. A deload that keeps the long run and cuts the easy runs is the right way round for a
peri- or post-menopausal runner: the key session survives and the recovery is in the rest of the week. My 11-15 ask, the
fuelling note on the edit door, is untouched by this and still unconfirmed.

## 💪 Richard Blagrove

No strength rule in scope. No objection from this seat.

---

## ⚡ Recorded disagreements

1. **Hutchinson vs McMillan, on the 2× longest-run residual.** Hutchinson: a ruling that leaves 29.2% over twice the
   runner's longest run is not done. McMillan: it is a 36% reduction (2,716 → 1,728), and the absolute bound belongs to
   §9's time cap once the ramp has a pace. **Settled by** measuring B with `BASEBUILD-DURATION-01`'s threaded pace and
   §9's `LONG_RUN_CAP_MINUTES` applied to the ramp long run.
2. **Willy, recorded:** a deload keeping the full-length long run is acceptable at these volumes; he would revisit if a
   ramp long run passes the §9 cap for the runner's race.

## ⚖️ Ruling — CORRECT WITH AMENDMENT: option B

A base-build ramp week with two or more runs carries a **designated long run** whenever the long-run floor allows, and
**the long run governs the week**: it grows by a bounded step, the easy runs are held at
`long / LONG_RUN_MIN_RATIO_VS_EASY` when that step binds, and `weekly_km` states what the sessions hold. A deload holds
the long run at the previous week's length and takes its cut (to `RECOVERY_WEEK_VOLUME_PCT` of the **delivered**
previous week) from the easy runs. A build week never falls below the previous build week (§116 Am. 1). Option A is
rejected (shape only, no bound, long run in under half the weeks). C and D are **INCORRECT**: a ratio-only step
compounds to a 102.2 km session.

**Amendment:** the producer's absolute step is **renamed and ratified for this job**, not read from
`WEEK1_PER_RUN_STEP_MAX_KM`. Same value. §2 Am. 2's week-1 constant keeps its week-1 job and its freeze.

### 📦 Build spec

1. **Principle:** §116 **Amendment 13**, *"the ramp has a long run, and the long run bounds the week"*: the derived
   share (`r / (r + n − 1)`, floored at §57's 35%, capped at §52's 60%), the held easy runs, the deload rule, the climb
   guard, ramp-only scope (§57 gap-fillers unchanged), and the stated residual (2× longest run; §9 time cap pending a
   pace). Cross-reference in §57: `FOUNDATION_MIN_SESSIONS_FOR_LONG_RUN` does not govern a ramp.
2. **Numeric:** new `BASE_BUILD_LONG_RUN_STEP_MAX_KM = 1.5` in `GENERATION_CONFIG` (equal to today's producer arm,
   renamed; principle §116 Am. 13 so `configPrincipleSync` holds). Reused unchanged: `LONG_RUN_MIN_RATIO_VS_EASY`,
   `FOUNDATION_LONG_RUN_MAX_PCT`, `LONG_RUN_MAX_PCT_OF_WEEKLY`, `LONG_RUN_PROGRESSION_CAP_PCT`,
   `RECOVERY_WEEK_VOLUME_PCT`. `FOUNDATION_MIN_SESSIONS_FOR_LONG_RUN` stays for `curve: 'flat'`.
3. **Invariant:** new `INV-PLAN-ONRAMP-LONG-RUN` (§116 Am. 13, `error`) in `validateBaseBuildBlock`, so the base-build
   branch's `enforceViolations` runs it, on plans stamped `meta.onramp_long_run` (new plans only, as `onramp_spaced`
   does). Arms: (a) a non-deload ramp week with ≥ 2 runs whose largest run reaches the runner's long floor carries
   exactly one `role: 'long_run'`; (b) that run is ≥ `LONG_RUN_MIN_RATIO_VS_EASY` × every other run (0.1 km rounding);
   (c) the build-week long-run step is ≤ `min(LONG_RUN_PROGRESSION_CAP_PCT, BASE_BUILD_LONG_RUN_STEP_MAX_KM)` +
   rounding. **Falsify** with the stamp set on today's producer: arm (a) must fire (1,975 of 5,925 cohortGrid plans have
   identical weeks). Add a liveness mutation (strip `role`) for `invariantLiveness.test.ts`. Row in
   `plan-invariants.md`.

### Conditions (binding)

1. **A ramp-generating gate ships with it.** `measure:fitness` and `cohort:shape` cannot see a ramp. The build adds a
   committed base-build measurement (this note's metrics: identical-plan rate, long-run weeks, longest session max/p90,
   > 2× longest run, end-km median by cohort) with a baseline, run in `verify`.
2. **Willy:** no stored plan changes (new plans only). The builder is told the Adjust-sheet rebuild of the 4 live
   inputs: 3 of 4 change, longest session up to +1.4 km.
3. **Staged plans move too** (84 of 90 sampled): the build reruns `validateStagedDoorRatio` and the staged handover on a
   wider staged sample before shipping.
4. **Sequence with `BASEBUILD-DURATION-01`** (same producer): whichever lands second re-runs this note's measurement.
   Once the ramp carries a pace, §9's `LONG_RUN_CAP_MINUTES` reaching the ramp long run is the next sitting
   (disagreement 1).

### ↗️ SLT escalation

None. Free plan, no price question.

---

## Interaction with `BASEBUILD-DURATION-01` (prototyped in parallel)

Same function (`buildFoundationSessions`), so the two builds will conflict textually; whichever merges second
re-measures. B helps that item: volume moves onto the long-run day (usually the weekend) and weekday runs shrink, so
fewer weekday sessions can overrun a stated budget (not measured). That item's threaded pace is what lets §9's
per-distance time cap reach B's long run, the remaining absolute bound.

## What this does not prove

- That 1.5 km a week is the right long-run step for a novice. It is the producer's existing value, ratified by name.
- Anything about outcomes. No adherence or injury data.
- The item's 99.5% / 47,662 figure: its corpus has no committed script; cohortGrid gives 33.3%.
- That staged plans stay sound beyond the 90 sampled (0 gate errors there).
- The 2× longest-recent-run residual (29.2% under B) is not solved.
- The invariant was not written or falsified on the branch; the falsification step is in the build spec.
- The weekday-budget benefit of B is reasoned, not measured.

**Observed, not filed:**
- A 4-day runner with no blocked days gets 5 runs in some ramp weeks (design grid, 8 km/week, longest run 40%, under
  `off`): more runs than `days_available`. Not investigated.
- `validatePlan` raises race-plan codes (`PREP-TIME-STATUS-ANNOTATED`, `DIFFICULTY-ANNOTATED`, `STRIDES-PRESENT`) on
  every base build; it is not this plan kind's gate, but any harness that runs it reports 100% error plans.
