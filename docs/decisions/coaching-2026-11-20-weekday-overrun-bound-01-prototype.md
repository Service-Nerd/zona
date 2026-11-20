# Coaching Board — 2026-11-20 — `WEEKDAY-OVERRUN-BOUND-01` on a prototype · **CORRECT WITH AMENDMENT**

Follows `coaching-2026-11-20-weekday-overrun-bound-01.md` (NOT READY: *"a bound's cost needs a prototype selector"*).

## The question the board could not answer without a prototype

For structured weekday sessions past §81's ratified tolerance (`LONG_RUN_WEEKDAY_OVERRUN_MAINTENANCE_PCT` = 50%) at a
stated weekday cap: if the engine is bounded, **what does the selector put in their place, how much quality is lost,
and what does it do to `measure:fitness`?** And the merged share question: is there a single session's share of the
week that needs its own bound?

## Prototype

Branch `proto/weekday-overrun-bound-01` @ `3eb396a7` (this note added in the following commit), worktree
`/Users/russe/rts-training-hub/.claude/worktrees/agent-afc9e846ef5b40f4a`. DO NOT MERGE.
Module seam `__setWeekdayOverrunBoundProto` in `lib/plan/ruleEngine.ts`, default `null` (seam off reproduces the
NOT READY note's population exactly: 500 capped plans, **560** past tolerance in **175** plans, all at a 30-minute cap,
worst **+177%**). Options, each at bound = cap × 1.5 (the ratified tolerance) and where noted × 2.0:

| Option | Mechanism |
|---|---|
| **construct_samecat** | At construction, if the selector's normal pick would run past the bound on a capped weekday, the same selector picks among rows **of the same category** that fit (same dose, same rotation state, easy re-derivation runs after). None fits → normal pick stands and is declared (§81 Am. 2). |
| construct | as above, any non-aerobic category |
| reselect | tail pass after all resizing; another row at the same dose; else keep |
| resize | tail pass; same row re-sized by the sizer at a smaller dose |
| strict | reselect → resize → drop to easy; nothing past the bound survives |
| drop | the session becomes an easy run at the cap |

## Evidence (all run on the branch)

`npx tsx scripts/proto-weekday-overrun-bound-01.ts` (cohortGrid stride 53, coprime to 41,472; capped inputs 521,
plans 500, refused 21; production shape, `fitness_level` unset; changes found by DIFFING against the seam-off plan):

| bound × 1.5 | past tolerance (560) | plans changed | quality sessions lost | weeks losing ALL quality | new ERROR codes | median build, changed plans |
|---|---|---|---|---|---|---|
| **construct_samecat** | **124** | 166 | 6 | 12 (6 plans) | QUALITY-VARIETY-FULL-PLAN 1 | 38.5% → 31.0% |
| construct (any cat.) | 74 | 175 | 6 | 12 (6 plans) | **PEAK-RACE-SPECIFIC-REACHED 15**, VARIETY 1 | 36.4% → 30.4% |
| reselect (tail) | 123 | 175 | 0 | 0 | PEAK-RACE-SPECIFIC-REACHED 15, VARIETY 11, COPY-MATCHES 9 | 36.4% → 30.8% |
| resize | **560 (no-op: 0 of 560 fit)** | 0 | — | — | — | — |
| strict | 0 | 175 | **125** | **126 (58 plans)** | **QUALITY-EXPECTED 122**, VARIETY 19, PEAK-RACE-SPECIFIC 15, … | 36.4% → 27.8% |
| drop | 0 | 175 | **563** | **564 (175 plans)** | **QUALITY-EXPECTED 528**, VO2MAX-ONSET 17, LR-MAX-WEEKLY-PCT 17, … | 36.4% → 26.9% |

At bound × 2.0: construct changes 14 plans (past-tolerance 560 → 554, 12 new PEAK-RACE-SPECIFIC errors);
construct_samecat changes 2 plans (560 → 558). A looser bound buys almost nothing.

- **construct_samecat warns** new/gone: LR-MAX-WEEKLY-PCT +32/−5, DELIVERED-RAMP +9/−7, DELOAD-PHASE-POSITION +6,
  RACE-SPECIFIC-VARIETY +5, PEAK-NOT-BELOW-START +2, DELOAD-IS-A-REDUCTION +1. Maintenance on changed plans 55 → 54.
  Minutes per changed session median −6. Plan km lost 453 km across 166 plans (~2.7 km/plan).
- **What the selector substitutes** (construct_samecat, top): tempo_continuous→progressive_tempo 66 ·
  progressive_tempo→tempo_continuous 40 · threshold_ladder→threshold_mile_repeats 39 · hill_reps→intervals_long 37 ·
  cv_intervals→tempo_cruise 34 · progressive_tempo→tempo_over_under 32 · tempo_cruise_short→tempo_continuous 31 ·
  cv_intervals→threshold_mile_repeats 26. **No category changes** (construct any-category moved race_specific→threshold
  42 times; that is the source of the 15 PEAK-RACE-SPECIFIC-REACHED errors).
- **Residual past tolerance** under construct_samecat (124): hm_pace_intervals 38 · beginner_goal_pace_blocks 24 ·
  cv_intervals 19 · tempo_cruise_short 16 · progressive_tempo 15 · threshold_pyramid 7 · threshold_mile_repeats 3 ·
  threshold_ladder 2. **The worst case is unchanged at +177%** (a race-specific row with no shorter same-category row).
- **The 12 weeks losing all quality** (`scripts/proto-weekday-overrun-bound-01-lostweeks.ts`) are all 42.2 km,
  experienced, weeks 8 and 12, build phase; their baseline sessions were 41–48 min, mostly **inside** the 45-minute
  bound, so they are a ripple through the rotation, not the bound acting on them. Six became a `5K time trial`, six all
  easy. Mechanism **not localised**.
- **Resize is a no-op for a reason the build must know:** the sizer (`makeQualitySession`) doses from the work-target
  band (`THRESHOLD_WORK_TARGET_MINS` etc.) and the quality floors, not from `distKm`. A dose-shrinking remedy is a §8
  band change, not a selector change, and was not prototyped.
- **Share question.** All 750 stride-53 plans, max structured non-long non-race session share of the delivered week per
  plan: median 25.4%, **max 43.2%**, 12 plans above 40%. The 47.9% CV-intervals cell the item carried **does not exist
  today**. construct_samecat moves changed-plan >40% 6 → 6 (no effect).

`npx tsx scripts/proto-weekday-overrun-bound-01-fitness.ts construct_samecat:50,strict:50` (`measure:fitness`'s own
`measure()`, unchanged population and definitions, seam off then on, in one process, ~3 min):

| bucket | baseline build / never | construct_samecat | strict |
|---|---|---|---|
| other standard (n 9,796) | 40% / 9.4% | **37.8%** / 9.4% | 35.9% / 9.4% |
| other masters (n 6,718) | 17.9% / 14.2% | 17.9% / 14.2% | 16.7% / 14.2% |
| CAPPED-INJURY standard (n 3,075) | 50% / 0% | 50% / 0% | 50% / 0% |
| marathon peak LR % of race | 61.6 / 66.4 | unchanged | unchanged |
| marathon personas M1–M7 | — | all unchanged | all unchanged |

`cohort:shape` was **not run** (the item's conditions do not name it; the build must).

---

## Coaching Board sitting

**Trigger:** soft (`ruleEngine.ts` selection) — qualifies: it changes which session a capped runner is prescribed.
**Proposed change:** when a structured weekday session would run past cap × 1.5, prefer a same-category catalogue row
that fits; if none does, keep it and declare it.

### 🔍 Conflict scan
- **§81 + Am. 1 + Am. 2.** Not contradicted: the exemption and *"don't shrink to fit"* stand; nothing is shrunk, a
  different session of the same kind is chosen. Am. 2's *"a second number asking the same question in a different unit
  is the duplicate-semantics failure"* binds: the bound **is** `LONG_RUN_WEEKDAY_OVERRUN_MAINTENANCE_PCT`. Am. 1 binds:
  no `maintenance` relabel (measured 55 → 54).
- **§22 / §93 (race-specific exposure; peak rehearses the race).** **Contradicted by any cross-category substitution:**
  15 `INV-PLAN-PEAK-RACE-SPECIFIC-REACHED` errors under construct and reselect. Same-category confines the bound.
- **§53 (variety, full plan).** Touched: 1 new VARIETY error under construct_samecat.
- **§110 / quality floor (`INV-PLAN-QUALITY-EXPECTED`).** Contradicted by strict and drop (122 / 528 errors).
- **§8 (dose bands).** Touched by resize; not by construct_samecat (the sizer still sizes to the band).
- **§1 (session count, CD-19).** Not moved: a same-category swap changes no session's count class.
- **§52 / LR-MAX-WEEKLY-PCT.** Touched as a warn (+32): shorter weekday sessions raise the long run's share.
- **§23.** Not touched (maintenance flat).

### 🏃 Alex Hutchinson (Chair)
On 2026-10-06 I refused to set a number because I happened to have one. I still have not set one: the bound is the
tolerance this section already ratified, and what was missing was its cost. Now it is measured. Two remedies are dead on
the numbers: dropping the session costs 564 quality weeks and 528 floor errors, and "strict" 126 weeks. Resize is not a
remedy at all, it is a no-op, because the dose lives in the band. What survives is narrow: a swap within the category.
It clears 436 of 560 overruns past tolerance, costs 2.2pp of median build in the largest bucket, and touches no
never-builds figure. It does **not** answer the item's headline: +177% is still there, on a race-specific row with no
shorter sibling. That remains *declared, not prevented*, and I am ruling that it should.

### 📊 Stephen Seiler
My concern was that a bound would take CV intervals off the runners with the least time. With this mechanism it does
not: cv_intervals is swapped for tempo_cruise or mile repeats, threshold work for threshold work, and the session count
is untouched. That is the right unit and the distribution cannot move. The cross-category version is wrong in my terms
too: race-pace work replaced by threshold in the peak is exactly the specificity loss §93 measured.

### 🎯 Greg McMillan
A 30-minute weekday runner asked for 83 minutes concludes the app does not listen. A 39-minute tempo instead of a
48-minute progressive is a session they will actually start. The 2.7 km a plan gives up has nowhere else to go on their
week, so that is the plan telling the truth about their week. I want the 12 lost-quality weeks explained before this
ships: a marathoner whose week-8 tempo becomes all-easy because of a rotation ripple is a defect, whatever caused it.

### 🩹 Rich Willy
Load reads well: shorter weekday sessions, lower peak, nothing escalated (the prototype forbids a VO2max substitute for
a threshold slot, and the build must keep that). On my share gap: the 47.9% cell is gone and the measured max is 43.2%
over 750 plans. I said a principle written before the number exists is the error; the number now says there is no
share problem to bound. I withdraw the share half.

### ⚕️ Stacy Sims
This is the caregiving cohort, and choosing a session that fits the time they told us is the input finally being heard.
I accept the ruling. I record again that the 14.2% masters never-builds figure is on no agenda; this change does not
move it, and nobody should read this sitting as having looked at it.

### 💪 Richard Blagrove
No objection from this seat; no strength rule is touched.

### ⚡ Recorded disagreements
- **Hutchinson vs McMillan on the residual 124:** McMillan would accept a bounded race-specific row (fewer reps) for the
  worst case; Hutchinson holds that is a §8 dose change in disguise and needs its own measured sitting. Settles on: a
  prototype of a race-specific dose cap, measured against `INV-PLAN-PEAK-RACE-SPECIFIC-REACHED` and §8. Not filed.

### ⚖️ Ruling — **CORRECT WITH AMENDMENT**
1. **Adopted: fit-aware, same-category selection at construction** (construct_samecat). When the selector's normal pick
   for a capped weekday would exceed cap × (1 + `LONG_RUN_WEEKDAY_OVERRUN_MAINTENANCE_PCT`/100), the selector chooses
   among eligible rows **of the same category** whose sized duration fits; if none fits, the normal pick stands and §81
   Am. 2's per-session note declares it.
2. **Rejected (INCORRECT):** drop, strict, and any cross-category substitution (§22/§93, §110 errors measured). Resize is
   not a selector remedy (measured no-op); a dose cap is a separate §8 question.
3. **Share bound: not adopted.** Max measured share 43.2%; no cell above 50%. The merged `SESSION-WEEK-SHARE-01` half
   closes.
4. **The magnitude worst case stays declared**, not prevented: a race-specific session with no shorter same-category row
   is prescribed and stated.

### 📦 Build spec (artifacts)
1. **Principle:** `CoachingPrinciples.md` **§81 Amendment 3** — *"A structured weekday session past the tolerance is
   re-selected within its category where a row fits; never shrunk, never re-categorised, never dropped. Where no row of
   its kind fits it is prescribed and declared."* With this note's table.
2. **Numeric:** **no new constant** — reuse `GENERATION_CONFIG.LONG_RUN_WEEKDAY_OVERRUN_MAINTENANCE_PCT` (50), per §81
   Am. 2. Its config comment gains the second consumer.
3. **Invariant:** **not checkable per plan by `validatePlan()`**: whether a fitting same-category row existed is a fact
   about the selector's alternatives, and a validator that re-ran the sizer would share the producer. The mechanical
   check is a **corpus gate** `lib/plan/weekdayOverrunBound.test.ts` (cohortGrid stride 53, capped): (a) sessions past
   tolerance ≤ **124** (ratchet; falsify by setting the bound to `Infinity` → 560, red); (b) **zero** structured
   weekday substitutes change catalogue category; (c) zero new `error` codes against the pre-change corpus,
   specifically `INV-PLAN-PEAK-RACE-SPECIFIC-REACHED`, `INV-PLAN-QUALITY-EXPECTED`, `INV-PLAN-QUALITY-VARIETY-FULL-PLAN`.
   `INV-PLAN-STRUCTURED-OVERRUN-DECLARED` (existing, warn) keeps the residual declared.
4. **Engine:** the selection goes where the prototype's `wobPick` sits (both quality slots in `buildWeekSessions`),
   using the selector with the rotation state, never a tail pass (the tail versions broke variety and copy: 11 VARIETY
   and 9 COPY-MATCHES errors). Candidates are sized through `makeQualitySession` (the single sizer). No VO2max
   escalation of a non-VO2max slot.

### Conditions (binding on the build)
- **C1** The 12 weeks in 6 experienced-marathon plans that lost all quality (ripple, mechanism unlocalised) are localised
  and reduced to **0**, or ruled acceptable at a re-sitting with the mechanism named.
- **C2** The 1 new `INV-PLAN-QUALITY-VARIETY-FULL-PLAN` error is resolved (the filtered pool must record its own
  `poolSizes`).
- **C3** `npm run measure:fitness` stated in the commit: prototype says other-standard 40.0 → 37.8% (−2.2pp, inside the
  5pp gate), never-builds unchanged; re-baseline only with that reason.
- **C4** `npm run cohort:shape` run and any move declared with a number.
- **C5** `INV-PLAN-LR-MAX-WEEKLY-PCT` warns (+32 / −5 on changed plans) reported in the commit, not absorbed.

### ↗️ SLT escalation
None.

## What this does not prove
- One corpus: cohortGrid stride 53, caps 30 and 60 (all overruns are at 30). `targetedGrid`, `slowGoalGrid`, the
  charity personas' capped cases (M4, cap 45, unchanged in `measure:fitness`) and `day_budgets`-shaped inputs were not
  swept.
- The prototype is not the build: `wobPick` dry-runs the selector on cloned rotation state; a build that threads
  rotation differently will move the substitution table.
- Whether the substituted session delivers the same **work** minutes (vs warm-up/cool-down) was not split; −6 min per
  changed session is total duration.
- `cohort:shape`, `invariant:liveness`, `verify:parity` and the full suite were not run.
- Nothing has run on a device; no runner-facing copy changed.
