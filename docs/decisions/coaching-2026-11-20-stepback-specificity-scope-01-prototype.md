# Coaching Board — `STEPBACK-SPECIFICITY-SCOPE-01` (prototype sitting) · 2026-11-20

**Ruling: CORRECT WITH AMENDMENT — option (b).** §47 governs every **time-target** plan with two or more
peak weeks, race-paced or not. Option (c), every plan including finish goals, is **INCORRECT as built**:
it fails the fitness gate on the injury cohort. **This unblocks `GOALPACE-UNBENCHMARKED-MARATHON-01`
(§120 Am. 4)**, which is ready to build with one condition carried over from its own 11-16 build.

## The question the board could not answer without a prototype

On 11-16 the chair declined to rule (b) or (c) without `measure:fitness` and `cohort:shape` on each. That
is McMillan's standing condition.

Two more things were unknown:
- (c) had never been measured at all.
- Nobody had shown that (b) gives back the step-back §120 Am. 4 takes away, with the same shape. Am. 4's
  code was reverted without ever being committed, so the combination had never existed.

## Prototype

Branch `proto/stepback-specificity-scope-01` in worktree
`/Users/russe/rts-training-hub/.claude/worktrees/agent-ad8966adf0a48c3ae`, commits `b170e7b1` and
`cbe58082`. **DO NOT MERGE.**

- **The seam.** `lib/plan/protoStepbackSeam.ts` holds two switches, both default OFF:
  - `PROTO_STEPBACK.scope`: `a` is today; `b` also covers any time-target plan; `c` covers every plan.
  - `unbenchmarkedWithhold`: §120 Am. 4.
- **The gate.** The gate at `ruleEngine.ts:4840` becomes `!anyPeakIsRacePace && !stepbackIgnoresSpecificity(goal)`.
  `INV-PLAN-PEAK-LR-ALTERNATION`'s `isPeakLevel` reads the same predicate.
- **§120 Am. 4, re-implemented minimally.**
  - It withholds goal pace when an unbenchmarked goal pace is faster than
    `buildFallbackPace(structural).minPerKmCV × (1 − RACE_PACE_ANCHOR_MAX_OVER_CV_PCT/100)`.
  - It stamps `goal_pace_withheld { gap_pct, basis: 'estimated' }`.
  - It exempts `basis: 'estimated'` from the "no recorded decision" arm.
  - ⚠️ **§44 Am. 2's widened gap-sentence arm (Sims) is NOT re-implemented.** So on this branch every
    withheld plan fails `INV-PLAN-GOAL-PACE-REACHABLE[the gap named]` by construction. The 11-16 build
    closed that arm (6,192 of 6,192).
- **The checker switch.** `PROTO_ALT_ALLDIST=1` widens the checker from HM/MAR to every distance.

## Evidence

Every run uses cohortGrid in its production shape: no `fitness_level`, composed with the foundation
block as `cohort:shape` does, and pinned to `COHORT_PLAN_START`.

**`npx tsx scripts/proto-stepback-scope.ts 7`** covers 5,925 inputs, all distinct (stride 7, coprime
to 2⁹×3⁴), and 5,678 of them generate. Every configuration had 0 refusal flips and 0 unexpected failures.

| config | plans with a §47 step-back | gained / lost vs today | plans changed | Δ prescribed mins (changed plans) | new error codes |
|---|---|---|---|---|---|
| today (a) | 2,222 | – | – | – | – |
| (b) | 2,716 | **+494 / 0** | 494 | median −1.06%, range −2.78…0, **0 up** | **none** |
| (c) | 5,678 | +3,456 / 0 | 3,456 | median −1.05%, range −3.69…+3.40, 99 up | `LONG-IS-LONGEST-MINS` 51 · `LR-SHORTFALL-CAUSE` 17 |
| (a) + Am. 4 | 2,015 | 0 / **−207** | 886 | median −0.15% | gap-sentence arm 886 (not built here) |
| **(b) + Am. 4** | **2,716** | **+494 / 0** | 1,134 | median −0.77%, range −3.15…+1.77, 242 up | gap-sentence arm 886 only |
| (c) + Am. 4 | 5,678 | +3,456 / 0 | 4,096 | median −0.98% | gap arm 886 · 51 · 17 |

### Willy's cohort

The cohort is the 207 unbenchmarked, declared-beginner, time-target HM and marathon plans.

- **Today:** all 207 get a step-back, and every one gets it through a race-paced peak long run priced at
  goal pace.
- **(a) + Am. 4:** **0 of 207**. This reproduces the 11-16 regression.
- **(b) + Am. 4:** **207 of 207**, and none of them carries a race-paced long run.

### Who (b) adds

The +494 are entirely **beginner time-target 5K and 10K** runners, benchmarked and unbenchmarked alike:
5K nobm 123 · 5K bm 123 · 10K nobm 123 · 10K bm 125. §24b gives them no finish segment, so §47 never
reached them.

⚠️ The item said the gain was *"all 5K beginners with no benchmark"*. The measured set is wider: 10K is
in it too, and benchmark makes no difference. 494 × 7 = 3,458 sits next to the item's full-grid 3,456,
but the full grid was **not run**.

### Same shape, not just the same count

`scripts/proto-stepback-scope-fixture.ts` generates the `PEAK-LR-STEPBACK-MINUTES-01` fixture directly under each config.
Peak long runs (`*` = race-paced):

| config | HM | MAR |
|---|---|---|
| today | `132m* 106m 132m*`, step-back W12 | `165m 206m*`, step-back W15 |
| (a) + Am. 4 | `132 132 132`, **no step-back** | `206 208`, **no step-back** |
| (b) + Am. 4 | `132 106 132`, step-back W12 | `165 206`, step-back W15 |

So (b) + Am. 4 gives the same weeks and the same durations as today, without the segment.

⚠️ Under (b) + Am. 4, `vitest run peakLrStepbackMinutes.test.ts` is 7 of 8 red. **Every failure is the
gap-sentence arm this branch did not build**, not a §47 assertion.

### Option (c)'s two new errors, attributed

Source: `scripts/proto-stepback-scope-c-errors.ts 31`.

- **`LONG-IS-LONGEST-MINS`** fires on finish-goal **beginner HM/MAR** step-back weeks. The §9 easy clamp
  floors at `minEasyMins`, which leaves the easy run equal to the long run (88 = 88).
- **`LR-SHORTFALL-CAUSE`** fires on finish-goal beginner marathons. Once the step-back is restored, the
  peak long run reaches its 210-minute cap, and the §40c note still blames volume.

### The checker

Run: `PROTO_ALT_ALLDIST=1 npx tsx scripts/proto-stepback-scope-checker.ts 7`.

- With `INV-PLAN-PEAK-LR-ALTERNATION` widened to every distance, it finds **0 failing plans at a, b and
  c**, so producer and checker agree.
- **Falsified:** running the scope-(b) checker over scope-(a) plans fires on **99 of 1,277** (stride 31).
  All 99 are beginner time-target 5K/10K, exactly the cohort (b) adds.

### `cohort:shape` and `measure:fitness`

Both were run once per option, without `--write`, switched by env, and compared to the committed
baselines (`scripts/proto-stepback-scope-cmp.ts (driven by scripts/proto-stepback-scope-gates.sh)`).

| | `cohort:shape` | `measure:fitness` |
|---|---|---|
| **(b)** | **0 fields differ** | **0 fields differ** |
| **(b) + Am. 4** | maintenance 55.9 → 56.3 (5K 55.3 → 55.5, **10K 51.0 → 52.5**); constraint note 71.0 → 71.3; mean delivered peak 37.24 → 37.16 km | `neverBuildsPct` masters 14.2 → 14.6, standard 9.4 → 9.6 |
| **(c)** | maintenance 55.9 → 57.2 (5K +2.4, HM +1.0, MAR +0.9) | **CAPPED-INJURY median build masters 41.2 → 35.3 (−5.9pp), standard 50.0 → 44.4 (−5.6pp)**; injury marathon peak LR 66.4 → 62.8% of race; personas 0 and 5 lose 1–2 km of peak long run |

- (b) alone moves nothing, so **all of the (b) + Am. 4 movement belongs to Am. 4**. It is the km-ruler
  artefact Am. 4 already declared on 11-16: 14.5 / 9.6 then, 14.6 / 9.6 now.
- (c)'s injury build drops exceed `planFitness.test.ts`'s 5pp build tolerance, so **(c) would turn the
  build red.**

## Conflict scan

| Section | How it is touched |
|---|---|
| **§47's principle** (*"…that includes race-pace segments"*) | Amended by this ruling |
| **§47 Am. 3** (*"a rule about the shape of the week"*) | Supports the amendment |
| **§47 Am. 1** | The ruling this protects |
| **§24b** | Beginners get no segment, which is why (b) reaches them |
| **§25** | Owns the finish; untouched |
| **§9** (long is longest) | Breached under (c) only |
| **§40c** (shortfall cause) | Breached under (c) only |
| **§52 / §47 Am. 2–3** | Unchanged; 0 `PEAK-STEPBACK-VOLUME` errors in any config |
| **§120 Am. 4** | Unblocked |
| **`STEPBACK-STALE-PEAK-01`** | Its 2-minute tolerance was not touched; the fixture passes the §47 arms without widening it |

No zone-label translation was needed.

## Seats

**🩹 Willy.** *"207 of 207 are back, with the same minutes, the same weeks and no segment they cannot
run. That is the load rule doing its job. The 494 beginner 5K and 10K runners are a gain I would have
asked for: their peak long run is the biggest bout in their week too. I want finish goals as well, but
not by breaking §9 on the beginners I am protecting."*

**🎯 McMillan.** *"My condition was both harnesses on each option. That is done. (b) moves neither
harness by a single field. (c) costs injury-capped runners six points of build, and I will not trade
that for symmetry. Build (b)."*

**📊 Seiler.** No objection. Session counts are unchanged, no session is added, and the distribution is
untouched.

**⚕️ Sims.** *"My only concern is the gap sentence, and the prototype says plainly that it did not build
it. It must ship with Am. 4, as it did on the 16th, and 886 of 886 withheld plans must carry it."*

**💪 Blagrove.** Silent: no strength surface is involved.

**🏃 Hutchinson (chair).** *"Willy's mechanism argument wins for time-target plans, and there the
measurement agrees with it: zero cost on both harnesses. Extended to finish goals, the same argument is
probably still right in principle. But as built it fails the fitness gate and two invariants, and I do
not rule on 'probably right'."*

### ⚡ Recorded disagreement

- **Willy:** (c) is the correct end state. Its two errors are producer defects (the §9 floor and the §40c
  note), not reasons against it.
- **The chair:** a ruling must not fail its own gate.
- **What settles it:** a (c) build in which:
  - the §9 clamp yields, the way §47 Am. 3 lets §52 prevail;
  - the §40c note names the cap;
  - CAPPED-INJURY build stays within 5pp.

Not filed; observed only.

## Build spec

1. **Principle: §47 Am. 5** (next free number).
   - Text: *"A 'peak long run' is a long run at ≥ `PEAK_LR_ALTERNATION_THRESHOLD_PCT` of the plan's peak
     long run on **any time-target plan**, and on a finish-goal plan when it carries a race-pace segment.
     Race-pace specificity no longer gates the rule for a runner with a time target, because §47 is a
     load rule about consecutive peak bouts (Am. 3), and withholding a pace must not switch it off."*
   - Edit the principle's first paragraph to say the same.
2. **Numeric: none new.** `PEAK_LR_ALTERNATION_THRESHOLD_PCT` (90) and `PEAK_LR_STEPBACK_MAX_PCT` (80)
   are unchanged. This is stated so it is not mistaken for an omission.
3. **Producer.**
   - `applyPeakLongRunAlternation` gates on `anyPeakIsRacePace || input.goal === 'time_target'`. That
     reads the input field, never a label (ADR-018).
   - Re-bound `stepbackTriggerStamp.test.ts`'s source arm to the new line. It reads red on this branch
     because the end of the region it reads moved.
4. **Invariant: `INV-PLAN-PEAK-LR-ALTERNATION`.**
   - `isPeakLevel` returns true on a time-target plan regardless of the stamp.
   - Widen its HM/MAR-only scope to **every distance**. The producer already steps back 5K/10K, and the
     widened checker reads 0 at every scope.
   - Update its row in `plan-invariants.md`.
   - Record the falsification: the scope-(b) checker on today's producer fires on 99 of 1,277.
5. **Tests.**
   - Re-point the claim in `PEAK-LR-STEPBACK-MINUTES-01`'s fixture: it now steps back because of the
     goal, not the label.
   - Add a beginner time-target 5K arm and a 10K arm.
6. **Re-baselines.** For (b) alone, neither `cohort:shape` nor `measure:fitness` needs one.

## §120 Am. 4 (`GOALPACE-UNBENCHMARKED-MARATHON-01`): unblocked and ready to build

Build it **in the same release, after §47 Am. 5**. Under (b) + Am. 4 the combination is coherent on the
sample:

- 0 refusal flips;
- Willy's cohort keeps 207 of 207 step-backs;
- 0 §47 errors;
- 0 new error codes apart from the gap-sentence arm this branch leaves out;
- prescribed minutes on changed plans move by a median of −0.77%.

**Conditions.** All four come from 11-16; none is new.

1. Ship §44 Am. 2's widened gap arm so that `INV-PLAN-GOAL-PACE-REACHABLE[the gap named]` reads 0.
   886 withheld plans in this sample need it; the 11-16 build had it at 6,192 of 6,192.
2. Re-baseline both harnesses with the km-ruler reason and the figures above: maintenance +0.4pp
   (10K +1.5pp); `neverBuildsPct` 14.2 → 14.6 and 9.4 → 9.6.
3. Ship `INV-PLAN-UNBENCHMARKED-GOAL-BOUNDED` (`error`, both directions) as ruled, with
   `goal_pace_withheld.basis`.
4. HM is in scope; the validity sweep's correction stands.
   - Of the 615 unbenchmarked time-target HM and marathon plans in this sample, 408 keep a current-pace
     finish under Am. 4, because intermediate and experienced fallbacks carry MP/HM.
   - The 207 beginners get the plain long run that `LR-FINISH-WITHHELD-PRICING-01` ruled today.

## What this does not prove

- **It is a sample, not the full grid.** cohortGrid was strided at 7. targetedGrid, the injury grid and
  the slow-goal grid were **not run** through the six configs; only the two harnesses saw their own
  corpora.
- **This Am. 4 is a re-implementation**, not the 11-16 code. It uses the ruled decision rule, but the
  difficulty-note arm, the enrich refusal and the AI-merge paths are absent. Its figures do not replace
  re-measuring the real build.
- **The baselines are the committed fixtures**, not a fresh base run on this machine.
- **Nothing here measures outcomes.** A step-back for a beginner 5K runner is a claim about load shape,
  not about injury rate.
- **(c)'s two error classes are attributed by example and from the code.** Their fixes were not
  prototyped.
