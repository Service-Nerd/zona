# Coaching-engine build inventory — 2026-11-20 (read-only, HEAD `1423b4a9`)

Scope: every OPEN run-engine and strength-engine item, read from `docs/releases/backlog.md` blocks and every
2026-11-20 decision note each one cites. Nothing was edited, built or committed. Figures are quoted from the notes
(which state their own commands) unless marked **[run here]**, meaning I ran it in this session.

---

## 0. Population — derivation and count

1. `source scripts/lib/open-items.sh && open_item_boards docs/releases/backlog.md` **[run here]** → **67 open items**:
   COACHING 24 · DESIGN 14 · NO BOARD 16 · SLT 7 · FOUNDER 6.
2. Taken whole: the **24 COACHING** items.
3. Added by subject (the 11 the brief named, all present in the owner's output with the board shown):
   ADR012-INTENSITY-TERM-01 (NO BOARD) · API-WEEKLY-KM-UNBOUNDED-01 (NO BOARD) · ADJUST-TRIGGER-REACH-02 (NO BOARD) ·
   CP-90-AM3-CITATION-01 (NO BOARD) · WIZARD-PAID-INPUTS-TIER-01 (SLT) · STRENGTH-RELEASE-01 (SLT) ·
   PLAN-NOTE-HEAVIER-WEEK-PLACEMENT-01 · TUNE-UP-CALLOUT-INERT-01 · ANCHOR-BAND-MIGRATION-NOTICE-01 ·
   BENCHMARK-DATE-REQUIRED-01 · PROFILE-BIRTH-YEAR-REQUIRED-01 (all DESIGN). → **35**.
4. Added by me after reading every remaining block (2): **ENGINE-COPY-SHARPEN-01** (FOUNDER; its honest fix changes
   §90's injury-yield rewrite in `ruleEngine.ts`) and **TEST-CLOCK-CONSTRUCTED-DATE-01** (NO BOARD; three engine tests
   — `foundationOnRamp`, `foundationResize`, `onsetWeekTwo` — drift against today's clock, and those are the files the
   base-build and onset builds will lean on). → **37 total**.
5. Considered and excluded (subject is not plan/strength prescription): COMPLETION-HR-COVERAGE-01, STEP4-RUNS-NO-COMPLETIONS-01,
   READINESS-SURFACE-01, BENCHMARK-FREE-403-01, STRENGTH-MEDIA-01, TEST-STRIP-COMMENTS-OWNER-01, RUNKED-EFFORT-MESSAGE-01,
   and every site/GTM/native item.
6. ⚠️ **Not in the population because the owner's closed-word rule excludes them, but still engine-relevant**:
   `MAXHR-RECENCY-01` (heading says WITHDRAWN), `BENCHMARK-STALENESS-CEILING-01` (VACATED), `RUNWALK-ASSESSED-LEVEL-01-PEAK`
   (VACATED), `INTENSITY-DECLARATION-FLOOR-01` (CLOSED, "re-opens on outcome data"), `WEEK1-DELIVERED-CEILING-01`
   (CLOSED INCORRECT, data dependency). They appear in §3 as residuals.

**Status tally (37):** READY TO BUILD **29** (some with a pre-build step, named: HEAVIER mockups, ANCHOR-BAND
re-measure, COACH-READ claim 3 attribution, ACHILLES's unprototyped bounceback condition, CARRY after PAIR) · blocked on a
sitting/founder **2** (PLAN-NOTE-MULTIWEEK, STRENGTH-RELEASE) · blocked on data **3** · unmeasured / unruled /
recommended-leave **3** (ADR012-INTENSITY-TERM, API-WEEKLY-KM-UNBOUNDED, ENGINE-COPY-SHARPEN). Breakdown in §1.

---

## 1. Item rows

Legend: **§** = principle text it writes · **K** = config constants · **INV** = invariants · **F** = files ·
**P** = prototype · **C** = build conditions · **O** = ordering · **UI** = UI/design dependency.

### 1A. Base-build / get-running / staged ramp

**BASEBUILD-NO-LONG-RUN-01** — READY. Option B: ramp week (≥2 runs) carries a designated long run that bounds the
week; easy runs held at `long/LONG_RUN_MIN_RATIO_VS_EASY`; deload holds the long run, cuts easy runs to 70% of DELIVERED.
- §: §116 **Am. 13** (+ §57 cross-ref: `FOUNDATION_MIN_SESSIONS_FOR_LONG_RUN` does not govern a ramp).
- K: **new** `BASE_BUILD_LONG_RUN_STEP_MAX_KM = 1.5` (renamed off `WEEK1_PER_RUN_STEP_MAX_KM`).
- INV: **new** `INV-PLAN-ONRAMP-LONG-RUN` (error, in `validateBaseBuildBlock`, stamp `meta.onramp_long_run`), liveness mutation (strip `role`).
- F: `lib/plan/foundationBlock.ts` (`buildFoundationSessions`, `generateFoundationBlock`), `baseBuildValidate.ts`, `generationConfig.ts`, `plan-invariants.md`, new committed base-build measurement + baseline in `verify`.
- P: `proto/basebuild-no-long-run-01` @ `fe4e69ee` (tip `c32b033f`), worktree `agent-aa66e81f24283456d`, 10 commits behind main.
- C: (1) ship a ramp-generating gate (measure:fitness and cohort:shape are structurally blind — both read identical with B on); (2) new plans only; Adjust-sheet rebuild of 3 of 4 live inputs changes, longest session up to +1.4 km; (3) rerun `validateStagedDoorRatio` on a wider staged sample (B moved 84 of 90 sampled staged plans); (4) whichever of this / DURATION lands second re-measures.
- O: **lands before BASEBUILD-DURATION-01** (backlog annotation; DURATION's amendment becomes Am. 14).

**BASEBUILD-DURATION-01** — READY (founder chose option A for the refused cohort). Re-apply `b85d3e4f`'s three parts
(thread `vdotFor`+`buildPaceFromVDOT` so §82's cap binds; `spreadDays` `prefer` uncapped days; restate `weekly_km` /
`base_build_target_km` from PLACED sessions); new `OnRampOutcome 'budget_cannot_climb'` (placed final build week ≤ placed
week 1) → refusal naming the two levers. Option C vetoed.
- §: §116 **Am. 13 in its own note → Am. 14 per backlog** ("ramp sized in the runner's own time; may hold at stated budget").
- K: `ONRAMP_DELIVERED_DRIFT_TOLERANCE_PCT = 2` (re-applied). No numeric for the outcome.
- INV: `INV-PLAN-ONRAMP-DELIVERED-MATCHES` (re-applied); `INV-PLAN-ONRAMP-CURVE-CLIMBS` **amended** (budget-held exemption, recomputed: a weekday run at cap−1 or a `floor_protected` run); `INV-PLAN-ONRAMP-LR-SHARE` **or** §52 check widened to base-build weeks.
- F: `lib/plan/baseBuildOnRamp.ts` (`generateBaseBuildPlan`, `assessOnRamp`), `foundationBlock.ts` (`buildFoundationSessions`, `FoundationBlockOptions`), `getRunningPlan.ts` (`endsAtKm`), `stagedRacePlan.ts` (`door_km`/`reachesDoor`), `engine.ts` (outcome routing, staged fallback to §118 offer), `baseBuildValidate.ts`, refusal copy.
- P: `proto/basebuild-duration-01` @ `302a5e18` (tip `d60171f8`), worktree `agent-ab1d49796b2958be7`, 10 behind.
- C: C1 served→refused ≤ 8 of 1,081 at stride 7, cohort named; C2 §52 >60% in base-build weeks = 0 and placed-below-door ≤ baseline (41 on that grid); C3 re-measure the refused cohort AFTER NO-LONG-RUN; C4 `verify:parity` declares changed BASE_BUILD outcomes; falsify the amended climbs check by lifting the cap.
- UI: refusal copy naming the levers (assistant writes under founder delegation); "held week says so" via existing note mechanism.

**STAGED-RAMP-RATIO-16W-01** — READY. Week count yields, ratio stands: no base-build ramp builds past
`MAX_BASE_BUILD_RATIO` from its own start; surplus runway HOLDS at reached volume with §3 deloads continuing; checkpoint not moved.
- §: §118 Am. 2 note. K: none new. INV: existing `INV-PLAN-GET-RUNNING-BUILD-RATIO` unchanged + producer-direct test (door 25, cw 1, HM, runway 32 → today 16 w / 4.17×) must come back ≤ 4.0.
- F: `lib/plan/stagedRacePlan.ts:82–90` (`placed.rampWeeks`).
- C: latent (0 firings through the engine on >2,700 staged plans); parity on staged plans should show no change.

**GETRUNNING-S111-DENOMINATOR-01** — READY (clarification, no prescription change).
- §: one-paragraph §111 or §118 Am. 2 note (**same paragraph as STAGED-RAMP's note**). INV: none new; a **dispatch test**: every validator entry point (`runEngine` both base-build branches, `validateSavedPlan`, `validateStoredPlan`, `validateMarketingPlan`) sends `plan_kind:'base_build'` to the base-build constitution, never `validatePlan`.
- F: `getRunningPlan.test.ts:207` (rewrite the raw-verdict arm), `invariants.ts:3950` stale "RAW `current_weekly_km`" comment → `effectiveStartKm`.
- ⚠️ `audit:stored` **[run here]** reports `INV-PLAN-BASE-BUILD-RATIO` on **5** stored plans (sole cause on 1). Whether those are base-build plans reaching `validatePlan` (the category error this ruling names) or race plans is **not measured**.

**GETRUNNING-WALKRUN-LRHALF-01** — READY. §118's producer never reseeds at the floor on the longest-run signal; when
`walkRunStartPrescribed && !walkRunStartApplies` every ramp session carries §117's 6/1 run-walk instruction (L5,
`applyRunWalk`, total minutes unchanged).
- §: §117 **Am. 9** (or a §118 amendment). K: none. INV: `INV-PLAN-WALKRUN-START-PROGRESSION` longest-run arm on non-staged plans warn → **error**.
- F: `lib/plan/getRunningPlan.ts` (`generateGetRunningPlan`), `baseBuildValidate.ts`, walk-run helpers.
- C: endpoint km unchanged on all 206 grid rows (parity over the shape).

**WALKRUN-DELOAD-CLAIM-01** — READY (copy approved). Hold IS the deload; theme becomes *"Same as last week, on purpose. No step up yet."*
- §: note on §116 floor-note L1. INV: copy test — a `walk_run_start` `deload` week's theme has no `easier|lighter|less|shorter`.
- F: `lib/plan/walkRunStart.ts:167`.

### 1B. Race-plan quality sizing and selection

**S9-QUALITY-FLOOR-REACH-01** — READY. Option A (OR-floor) vetoed; option B: an effort-governed session's
`distance_km` = (structure moving time − standing recovery) at easy pace.
- §: §40b **Am. 5** + a note on the §9 Amendment (the 5 km floor reaches only the no-row inline fallback).
- K: none new. INV: **new** `INV-PLAN-EFFORT-DISTANCE-FITS-DURATION` (error; baseline fires on 377 of 1,277 hill sessions, B on 0).
- F: `ruleEngine.ts` `makeQualitySession` (`effectiveDistKm` chain), `buildWeekSessions`, `invariants.ts`.
- P: `proto/s9-quality-floor-reach-01` @ `215f2fb3` (tip `de97e8a6`), worktree `agent-ae910855a459ed9a0` (locked), 10 behind.
- C: `cohort:shape` run and every moved rate stated (esp. mean delivered peak); PEAK-IN-PEAK-PHASE residual declared **per plan** (prototype 71 of 1,236 hill plans, all 5K 3-day); `measure:fitness` identical; 0 new errors.

**WEEKDAY-OVERRUN-BOUND-01** — READY with C1. Fit-aware same-category re-selection at construction when a weekday
structured pick exceeds cap × 1.5; else keep and declare. Drop/strict/cross-category INCORRECT; share bound not adopted
(SESSION-WEEK-SHARE-01 half closes).
- §: §81 **Am. 3**. K: none (reuse `LONG_RUN_WEEKDAY_OVERRUN_MAINTENANCE_PCT`).
- INV: not per-plan; **corpus gate** `lib/plan/weekdayOverrunBound.test.ts` (past-tolerance ≤ 124 ratchet; 0 category changes; 0 new `PEAK-RACE-SPECIFIC-REACHED` / `QUALITY-EXPECTED` / `QUALITY-VARIETY-FULL-PLAN`).
- F: `ruleEngine.ts` `buildWeekSessions` (both quality slots, where `wobPick` sits), `buildRulePlanOnce`; candidates sized via `makeQualitySession`.
- P: `proto/weekday-overrun-bound-01` @ `3eb396a7` (tip `bd6906fe`), worktree `agent-afc9e846ef5b40f4a`, 10 behind.
- C: C1 localise the 12 lost-quality weeks in 6 experienced-marathon plans → 0 (or re-sit); C2 resolve the 1 new VARIETY error; C3 measure:fitness stated (proto: other-standard 40.0 → 37.8%); C4 cohort:shape declared; C5 LR-MAX-WEEKLY-PCT +32/−5 reported.

**BEGINNER-TAPER-RACE-ROW-01** — READY. `beginner_goal_pace_blocks` becomes taper-eligible (HM/MAR, beginner), at no more
than its build dose; sharpener-for-beginners INCORRECT.
- §: §110b amendment + §36 note. K: taper dose cell for the row = build dose (`generationConfig.ts`).
- INV: `INV-PLAN-CATALOGUE-ELIGIBLE` derived exception must find no beginner HM/MAR taper on `goal_pace_sharpener`.
- F: `lib/plan/sessionCatalogueData.ts` (`phase_eligibility`), `generationConfig.ts`, taper pick in `ruleEngine.ts` (~3856–3878, reasoned in the note, not run).
- C: `verify:parity` confined to beginner HM/MAR time-target live-goal plans (≈1,418 on two grids); measure:fitness + cohort:shape reported.

### 1C. Long run, peak, goal pace

**STEPBACK-SPECIFICITY-SCOPE-01** — READY. Option (b): §47 governs every time-target plan with ≥2 peak weeks; (c) INCORRECT as built.
- §: §47 **Am. 5** ("next free number"). K: none.
- INV: `INV-PLAN-PEAK-LR-ALTERNATION` — `isPeakLevel` true on time-target; scope widened HM/MAR → every distance; falsification recorded (scope-(b) checker on today's producer fires on 99 of 1,277).
- F: `ruleEngine.ts` `applyPeakLongRunAlternation` (gate `anyPeakIsRacePace || input.goal === 'time_target'`, ~4840), `invariants.ts`, `stepbackTriggerStamp.test.ts` (re-bound), `PEAK-LR-STEPBACK-MINUTES-01` fixture + new 5K/10K beginner arms.
- P: `proto/stepback-specificity-scope-01` @ `b170e7b1`/`cbe58082` (tip `30afcb92`), worktree `agent-ad8966adf0a48c3ae`, 10 behind.
- C: (b) alone needs no re-baseline (0 fields differ on both harnesses).
- O: **before GOALPACE-UNBENCHMARKED-MARATHON-01, same release.**

**GOALPACE-UNBENCHMARKED-MARATHON-01** — READY after STEPBACK. §120 Am. 4: withhold goal pace when an unbenchmarked goal
is faster than `buildFallbackPace(structural).minPerKmCV × (1 − RACE_PACE_ANCHOR_MAX_OVER_CV_PCT/100)`; stamp
`goal_pace_withheld { gap_pct, basis:'estimated' }`. ⚠️ the 11-16 code "is not recoverable from git"; the build re-implements it (the prototype's version omits the difficulty-note arm, enrich refusal and AI-merge paths).
- §: §120 Am. 4 (heading exists in CoachingPrinciples as "RULED, BUILT, AND HELD — NOT SHIPPED"), §44 Am. 2 widened gap arm.
- INV: `INV-PLAN-UNBENCHMARKED-GOAL-BOUNDED` (error, both directions); `INV-PLAN-GOAL-PACE-REACHABLE[the gap named]` must read 0 (886 withheld plans in sample).
- F: `ruleEngine.ts` (withhold, `lrSegPace` 3580), `paceBands.ts`, `invariants.ts`, `enrich.ts`, `schema.ts`, `lib/ops/planAuditGoalGap.ts`.
- C: re-baseline cohort:shape + measure:fitness with the km-ruler reason (maintenance +0.4pp, 10K +1.5pp; neverBuilds masters 14.2→14.6, standard 9.4→9.6); HM in scope.

**LR-FINISH-WITHHELD-PRICING-01** — READY, **same commit as §120 Am. 4**. Withheld + no current race pace ⇒ peak long run built as the finish-goal plan would (2,304 peak long runs once Am. 4 lands; 0 today).
- §: §25 amendment (or in §120 Am. 4's text). K: none. INV: goal-withheld plan carries no long run with `lr_segment_pace` = goal pace (+ existing `INV-PLAN-LR-SEGMENT-RECORDED`).
- F: `ruleEngine.ts:3580` `lrSegPace`.

**WIZARD-PAID-INPUTS-TIER-01** — READY (SLT, Design and Coaching all sat; copy decided).
- Engine half: §96 **Am. 1** (cue on every wholly Zone 1–2 long run: adds deload long runs and §47 step-back long runs, excludes race-pace-segment and negative-split long runs; reach 67.6% → 88.9% by arithmetic); §24e wording ("no pace overlays"); §40c note for `love` × injury (27.7% silent). K: none (`OVERDO_IS_A_BRAKE` stays). INV: `INV-PLAN-OVERDO-BRAKE` gains a cue arm (falsify by restoring §47's wholesale `coach_notes` rewrite → 735 red).
- F: `ruleEngine.ts` §24c cue site, §47 rewrite (~4950, inside `applyPeakLongRunAlternation`), `hard_pref_note` (~10289–10367); `invariants.ts`.
- UI half: one wizard for every tier (`getStepSequence` loses tier), `TeaserCard` deleted, terrain + Modify copy, payload no longer reads `hasPaidAccess`; tests `lib/ui/wizardInjuryFree.test.ts`, `modifyPlan.test.ts`.
- C: measure:fitness and cohort:shape stated unmoved; notes displaced by the cue = 0 on newly reached long runs (765 cue-carrying long runs already at the 3-note cap).

**COACH-READ-1027-FOLLOWUPS-01** — READY, one commit per claim.
- claim 1 (exempt defect): `INV-PLAN-DELOAD-IS-A-REDUCTION` treats equal as a violation (warn); recount residual.
- claim 3 (exempt, conditional): `/zona-debug` attributes the 58% LR-cut-harder-than-week first; if a bound causes it, re-sit.
- claim 4a (exempt defect): `weekLabel` (~4371) "highest volume" reads the plan maximum.
- claim 5 (CORRECT): §114 amendment — "not to chase a time" withheld where goal/race-pace work is prescribed (~8595, ~9568); **new** `INV-PLAN-FINISH-NOTE-MATCHES-PRESCRIPTION` or an arm, reading the STAMP not the label; copy approved.
- claim 6 (CORRECT, `drop`): §6 **Am. 3**; **new** `INV-PLAN-TAPER-EASY-NON-INCREASING` (warn, km via `sessionKmSelfPaced`); producer pass after `applyTaperDeliveredDepth` (~4647).
- claim 7 (CORRECT WITH AMENDMENT, `bounded`): §3 **Am. 2**; **new** `MASTERS_MAX_LOADING_RUN_WEEKS = 5`; **new** `INV-PLAN-MASTERS-LOADING-RUN-BOUNDED` (warn); producer in `deloadCadence.ts` (`computeDeloadWeeks`).
- P: `proto/coach-read-1027-followups-01` @ `e67eca51` (tip `8f6edf3c`), worktree `agent-a58c894ef18b287dc`, 2 behind.
- C: cohort:shape at build for claims 6 and 7 (run only on `literal`); measure:fitness (byte-identical for `drop` and `bounded`); `invariant:liveness` wakes both new invariants; standard (non-masters) cadence not ruled.

### 1D. Injury and onset

**ACHILLES-QUALITY-ONSET-01** — READY, with one unprototyped binding condition. `long+reanchor`, N=1: on an achilles
runner's first quality week the long run does not grow; easy runs ≥ last loading week's; §100 re-anchor carried through
the next deload.
- §: **§89 amendment** (unnumbered in the note). K: **new** `TENDON_ONSET_LONG_RUN_HOLD_WEEKS = 1`; named list `TENDON_ONSET_INJURY_KEYWORDS = ['achilles']` + `hasTendonOnsetHistory()` in `injuryScope.ts`.
- INV: **new** `INV-PLAN-TENDON-ONSET-EASY-HELD` (error) + liveness.
- F: `ruleEngine.ts` `buildWeekSessions` (after `longKm = Math.max(...)`), `applyV1VolumeQualityStimulusSplit` (re-anchor after V1's trigger loop), `reanchorWeekAfterTrim`, `buildRulePlanOnce`; `injuryScope.ts`; threaded state, not a module seam.
- P: `proto/achilles-quality-onset-01` @ `42712275` (tip `48b055ed`), worktree `agent-a51c2c987170f8602`, 10 behind.
- C: per-run easy falls 384 → 0; quality 9,600 / 68,000 km unchanged; **0 new** `DELOAD-IS-A-REDUCTION` and **0 new** `BOUNCEBACK-BOUNDED` on the cohort (prototype N=1 still +320 BOUNCEBACK — **the carry-through is unbuilt; if not achievable it returns to the board, it does not ship with the residual**); DELIVERED-RAMP ≤ 400; 4,608 control rows byte-identical; check parity grid reaches achilles before quoting IDENTICAL.

**INJURY-HIP-INERT-01** — READY. Keep the chip; no new run rule.
- §: **§89 amendment** (every chip incl. Hip is an injury history for any-injury gates) + S14 sentence. K: none.
- INV: test `lib/plan/injuryChipEffect.test.ts` over the wizard's `INJURIES` exported from one owner (Hip: §89-eligible fixture onsets early with `[]` not with `['Hip']`; `planToRunContext` yields `'hip'`).

**LONG-RUN-CAP-INJURY-VALUE-01** — READY. Split: Plantar 120 min (mechanism); Back → `LONG_RUN_CAP_MINUTES.HM` (135); healthy-twin yardstick.
- §: §9 **Am. 3 amended**. K: `LONG_RUN_CAP_MINUTES_BY_INJURY.back` reads a hoisted HM constant; plantar 120.
- INV: `INV-PLAN-LONG-CAP-MINS` (no code change; `plan-invariants.md` row "(120)" amended); new arms in `injuryLongRunCap.test.ts` (existing `toBe(120)` for back updated).
- F: `generationConfig.ts`, `lib/plan/longRunTimeCap.ts` (`longRunTimeCapMins` — serves three paths).
- P: `proto/long-run-cap-injury-value-01` @ `5e3d9e76` (tip `b4adb85a`), worktree `agent-aaa1e514137acd5a9`, 10 behind.
- C: measure:fitness on a back/plantar overlay (no neverBuilds rise; **not run**); count foundation/maintenance weeks that move; binding-cap note names the injury (Sims).

**INJURY-RECENCY-01** — READY (both boards; copy decided). Bucket = last flare-up; "longer ago" lifts ONLY the long-run time cap for Back and Plantar; absent = current; Knee/Shin/Achilles not collected.
- §: §9 **Am. 3 recency clause** (same amendment LONG-RUN-CAP edits). K: declarative table naming which caps `longer_ago` lifts (`back: ['long_run_time_cap'], plantar_fasciitis: ['long_run_time_cap']`).
- INV: **new** `INV-PLAN-INJURY-RECENCY-SCOPE` (error).
- F: `GeneratorInput` type + route, `longRunTimeCap.ts`, `injuryScope.ts`, `invariants.ts`, `GeneratePlanScreen.tsx` (follow-up per chip, visibility = engine predicate evaluated per chip alone; Back marathon+ after LONG-RUN-CAP, Plantar HM+), draft-restore handling, contracts.
- C: measure:fitness on back/plantar cohort with the lift (no neverBuilds rise; delivered LR step inside §45/§2). **Not run.**
- UI: yes (wizard follow-up, `Chip`, `FieldLabel`).

### 1E. Ramp-residual readers (notes / calendar)

**PLAN-NOTE-HEAVIER-WEEK-PLACEMENT-01** — READY for build after **mockups → founder**; merge only after a device/simulator check.
- §: §90 **Am. 3 amended** ("shows it" = week N's calendar row in both renderings + Today in week N, every tier, residual declared in words; injury source on `non_long`) + §34 citation fix.
- INV/check: `loadResidualNote.test.ts` "warned ⇒ shown" re-pointed (not deleted) to the week-N mark at FREE tier, declaration asserted for both scopes; markup arm (mark in both renderings + Today; no other week; no `%`). Lands before or with any rank change.
- F: `components/.../PlanCalendar.tsx` (`WeekCard`, `WeekStripCard`), `TodayScreen.tsx` / `weekIdentity`, `getPlanCoachNote`, `planRationale.ts`, AI daily note context, `ui-patterns.md` §10b.
- Rank of the plan tile: post-ship Design sitting (dead last vs goes).

**CP-90-AM3-CITATION-01** — READY; closes inside HEAVIER's §90 edit.

**PLAN-NOTE-MULTIWEEK-RAMP-01** — coaching READY; **blocked on a Design Board sitting** (amend artifact 3 "no other week carries it" → "exactly the stamped weeks", and rule multi-mark reading) + founder on the tile sentence.
- §: §90 Am. 3 (same edit as HEAVIER). Producer stamps `meta.load_residual_weeks: {week, scope}[]`, keeps `load_residual_week`.
- check: set equality in `loadResidualNote.test.ts`. F: `loadResidualNote.ts` (`reconcileLoadResidualNote`), `foundationCompose.ts:178`, `ruleEngine.ts:6970`.
- O: builds WITH HEAVIER, not before.

**TUNE-UP-CALLOUT-INERT-01** — READY (Design, SLT, Coaching all sat; copy approved).
- §: §32 **Am. 1** (avoid any ramp-flagged week via `RAMP_RESIDUAL_CODES`; omission allowed; quote approved line). The "UI consumers render this" sentence must not merge ahead of the WeekCard line.
- INV: `INV-PLAN-TUNE-UP-CALLOUT` new arm (error) + "offers none" arm accepts omission; liveness mutation.
- F: `ruleEngine.ts:7838` stamp (in `buildRulePlanOnce`), re-checked after `composePlanWithFoundation` (`foundationCompose.ts`), `PlanCalendar` WeekCard line.
- C: injury-grid measurement of tune-up weeks carrying `INJURY-CAP-DELIVERED` (Willy); parity: sessions byte-identical, only `tune_up_callout` moves.
- O: with or after HEAVIER (one slot, one precedence constant).

### 1F. Inputs, HR, migration

**BENCHMARK-DATE-REQUIRED-01** — READY (copy approved). Wizard: date or in-field "I don't remember"; every exit gated (footer, draft restore, native estimate confirm); declaration stored (contract change). Engine already declares dateless (`INV-PLAN-VDOT-DISCOUNT-DATELESS`). F: `BenchmarkFields`, `lib/plan/benchmarkCheck.ts` (+test), `GeneratePlanScreen.tsx`, contracts. 🏃 only if the build dates the estimate path.

**PROFILE-BIRTH-YEAR-REQUIRED-01** — READY (copy approved). `optional` off; untouched wheel cannot proceed; in-step decline; subtitle replaced; declaration stored. F: `GeneratePlanScreen.tsx:282,:976`, step meta, contracts.

**HR-SAVE-UNEDITED-CONFIRMS-01** — READY (status quo ratified). §50 Asymmetry sentence; test arm that the floor line renders whenever `maxIsFloored` (`HRZonesSection.tsx`). Re-open: >5 at risk, or sheet redesign.

**DOUBLE-STRIDES-01** — READY (copy approved). §126 **Am. 1**; `doubles.test.ts` arm (canDouble + `effectiveDoubleViolations` admit `+ strides`/`+ hill strides`; falsify by typing the stride run `quality`); advice line when one half carries hill strides.

**ANCHOR-BAND-MIGRATION-NOTICE-01** — READY to design-build after a **re-measure** (pattern ruled `ui-patterns.md` §10a; 56 of 159 live threshold sessions cannot take the new band). F: `applyHrToPlan`, `PendingAdjustmentBanner` variant. `audit:stored` **[run here]** shows `INV-PLAN-HR-MATCHES-PACE` on 14 stored plans (13 ahead); the link to this item's 23 plans is **not verified**.

### 1G. Strength engine

**STRENGTH-PAIR-STRIDE-01** — READY. Option B: greedy cross-region pairing + session-scoped superset clock (`done` hoisted), same commit.
- §: S10 **Am. 6**. K: none. INV: **new** `S-PAIR-STRANDED`, `S-CLOCK-RECOUNT` (must not call `estimateMinutes`), in `packages/strength/validate.ts`.
- F: `packages/strength/session.ts` (`buildSession`, `estimateMinutes`), `index.ts` (delete seam); `recovery.ts` inherits.
- P: `proto/strength-pair-stride-01` @ `659bde67`, worktree `agent-ad191440eaa07a20e` (locked), 2 behind.
- C: Willy's ratchet in the strength sweep (sets/session ≥ 15.433, core ≥ 4.600, lower main ≤ 2.280); duration-baselined strength tests move.
- UI: Design ruling 4 (2–4 exercises per screen) waits on the part count (5.09 under B).

**STRENGTH-CARRY-PATTERN-01** — READY after PAIR-STRIDE. Merge after the walk, only on standalone carries; rounds = longer half; rest = SUM.
- §: S10 **Am. 7**. K: `CARRY_MEDLEY: ['farmer_carry','suitcase_carry']` in `packages/strength/config.ts`. INV: **new** `S-CARRY-MEDLEY` (4 arms).
- F: `session.ts` `assemble`, `recovery.ts` (reset un-tagged carry to `REST_S.core`), `config.ts`, `catalogue.test.ts`, `validate.ts`.
- C: re-run the PAIR-STRIDE sweep with the merge, hold the ratchet, report vs B (16.441 / 4.966 / 2.233). UI: Design names the merged part.

**STRENGTH-RELEASE-01** — BLOCKED on founder (phone checklist, charity cohort at switch-on) + Design (lapsed-trial state, locked rows) + `/pricing` row / Upgrade line. Then flip `STRENGTH_RELEASE` in `lib/strength-bridge/release.ts` (currently `'admin'`).

### 1H. Blocked on data / unruled / recommended-leave

- **EMAIL-WAVE-4-PATTERN-01** — blocked on data (1 real user with ≥3 HR-bearing analyses; 66 of 76 real analyses superseded). Not plan prescription.
- **LOG-OFFPLAN-03** — blocked on data (link rate: 5 of 239 activities linked at last measure).
- **ADJUST-TRIGGER-REACH-02** — blocked on data (re-run early January 2027; `hr_above_ceiling_pct` coverage is the real gate). Measurement only.
- **ADR012-INTENSITY-TERM-01** — unmeasured, NO BOARD to measure; board only if a threshold changes. F: `lib/coaching/reshapeMagnitude.ts` (`computeReshapeMagnitude`).
- **API-WEEKLY-KM-UNBOUNDED-01** — unruled input contract (`/api/generate-plan` accepts any non-negative `current_weekly_km`); overlaps Willy/McMillan's unfiled input-coherence view (`longest < weekly ÷ 7`).
- **ENGINE-COPY-SHARPEN-01** — founder-held; the block's own recommendation is LEAVE IT (one warn, no runner harm); the fix would change `copyClaimsIntensity` (`invariants.ts:1019`) and §90's injury-yield rewrite (~`ruleEngine.ts:8888`).
- **TEST-CLOCK-CONSTRUCTED-DATE-01** — READY (tooling): re-derive and pin `foundationOnRamp.test.ts`, `foundationResize.test.ts`, `onsetWeekTwo.test.ts`; widen `testClockIndependence.test.ts` to constructed `new Date(y,m,d)`.

---

## 2. Numbering collisions (principle § / amendment numbers)

| # | Number | Claimed by | State |
|---|---|---|---|
| 1 | **§116 Am. 13** | BASEBUILD-NO-LONG-RUN-01 **and** BASEBUILD-DURATION-01 (both notes say 13) | Backlog annotation resolves it: NO-LONG-RUN = 13, DURATION = **14**. DURATION's own decision note still says 13. |
| 2 | **§9 Am. 3** (one amendment, two edits) | LONG-RUN-CAP-INJURY-VALUE-01 (value split + yardstick) and INJURY-RECENCY-01 (recency clause) | Same text and the same config table `LONG_RUN_CAP_MINUTES_BY_INJURY` (+ a new recency table). One edit or strict sequence. |
| 3 | **§89 amendment** (both unnumbered) | ACHILLES-QUALITY-ONSET-01 (tendon onset) and INJURY-HIP-INERT-01 (every chip is an injury history) | §89 currently has no numbered amendment headings (parsed **[run here]**). Assign Am. 1 / Am. 2 at build. |
| 4 | **§90 Am. 3** | PLAN-NOTE-HEAVIER-WEEK-PLACEMENT-01 ("shows it" → week N), PLAN-NOTE-MULTIWEEK-RAMP-01 ("on every warned week"), CP-90-AM3-CITATION-01 (§34 citation) | Same sentence; rulings already say "the same edit". |
| 5 | **§118 Am. 2 note** | STAGED-RAMP-RATIO-16W-01 and GETRUNNING-S111-DENOMINATOR-01 ("§111 note or §118 Am. 2 note") | Same paragraph. |
| 6 | **§47 Am. 5** | STEPBACK-SPECIFICITY-SCOPE-01 ("next free number") | ⚠️ §47 **Am. 4** is ruled in `coaching-rulings.md:3614` (STEPBACK-TRIGGER-STRUCTURAL-01, part 1 shipped 2026-11-16) but `CoachingPrinciples.md` §47 (lines ~4709–4850) carries headings for Am. 1–3 only (grep for "§47 Amendment 4" = 0) **[run here]**. Verify before numbering 5. |
| 7 | §3 Am. 2 | COACH-READ claim 7 | §3's one existing amendment (LR-DELOAD-CUT-01) is unnumbered; Am. 2 assumes it is Am. 1. |
| — | §40b Am. 5, §81 Am. 3, §6 Am. 3, §117 Am. 9, §126 Am. 1, §32 Am. 1, §96 Am. 1, S10 Am. 6, S10 Am. 7 | one claimant each | No collision found (§40b Am. 4 and S10 Am. 4/5 already exist; numbers follow). S10 Am. 6 must land before Am. 7. |

Also: three new `GENERATION_CONFIG` keys (`BASE_BUILD_LONG_RUN_STEP_MAX_KM`, `TENDON_ONSET_LONG_RUN_HOLD_WEEKS`,
`MASTERS_MAX_LOADING_RUN_WEEKS`), one re-applied (`ONRAMP_DELIVERED_DRIFT_TOLERANCE_PCT`), one hoist (HM long-run cap),
one declarative table (recency), one dose cell (beginner blocks taper) — each needs a principle row (configPrincipleSync)
and a consumer (configConsumer) in the same commit.

---

## 3. File-overlap matrix (conflict risk)

| File / function | Items |
|---|---|
| `ruleEngine.ts` `buildWeekSessions` | ACHILLES, S9, WEEKDAY-OVERRUN |
| `ruleEngine.ts` `makeQualitySession` | S9 (`effectiveDistKm`), WEEKDAY (sizes every candidate through it) |
| `ruleEngine.ts` `buildRulePlanOnce` | ACHILLES, WEEKDAY, STEPBACK, COACH-READ (6/7), TUNE-UP (stamp :7838), PLAN-NOTE (reconcile call :6970) |
| `ruleEngine.ts` `applyPeakLongRunAlternation` (+ §47 coach_notes rewrite ~4950) | STEPBACK, WIZARD (§96 cue must survive the rewrite) |
| `ruleEngine.ts` `lrSegPace` (:3580) | GOALPACE, LR-FINISH (same commit) |
| `ruleEngine.ts` taper pass (`applyTaperDeliveredDepth` / `applyTaperLongRunCap`, taper row pick ~3856) | COACH-READ claim 6, BEGINNER-TAPER |
| `ruleEngine.ts` `applyV1VolumeQualityStimulusSplit` / `reanchorWeekAfterTrim` | ACHILLES |
| `ruleEngine.ts` notes (`weekLabel`, §114 sentence ~8595/9568, `hard_pref_note` ~10289) | COACH-READ 4a/5, WIZARD (§40c) |
| `ruleEngine.ts` §90 injury yield (~8888) | ENGINE-COPY-SHARPEN (if ever built) |
| `foundationBlock.ts` `buildFoundationSessions` / `generateFoundationBlock` | BASEBUILD-NO-LONG-RUN, BASEBUILD-DURATION (both prototypes edit it; textual conflict stated in the note) |
| `baseBuildOnRamp.ts` | DURATION |
| `baseBuildValidate.ts` (`validateBaseBuildBlock`, CURVE-CLIMBS, WALKRUN-START-PROGRESSION, GET-RUNNING-BUILD-RATIO) | NO-LONG-RUN, DURATION, LRHALF, STAGED-RAMP |
| `stagedRacePlan.ts` | STAGED-RAMP (`placed.rampWeeks`), DURATION (`door_km`/`reachesDoor`), NO-LONG-RUN (staged plans move) |
| `getRunningPlan.ts` | DURATION (`endsAtKm`), LRHALF, S111 (test) |
| `engine.ts` | DURATION (outcome routing), S111 (dispatch test) |
| `deloadCadence.ts` | COACH-READ claim 7 (ACHILLES carries its re-anchor through the next deload) |
| `invariants.ts` | STEPBACK, S9, ACHILLES, COACH-READ (1/5/6/7), GOALPACE, LR-FINISH, BEGINNER-TAPER, WIZARD, TUNE-UP, INJURY-RECENCY, S111 (comment) |
| `generationConfig.ts` (coaching-guard hard trigger) | NO-LONG-RUN, DURATION, ACHILLES, COACH-READ 7, LONG-RUN-CAP, INJURY-RECENCY, BEGINNER-TAPER |
| `longRunTimeCap.ts` | LONG-RUN-CAP, INJURY-RECENCY |
| `injuryScope.ts` | ACHILLES, INJURY-RECENCY, HIP (one-owner `INJURIES` export) |
| `loadResidualNote.ts` / `foundationCompose.ts` | PLAN-NOTE-HEAVIER, MULTIWEEK, TUNE-UP |
| `PlanCalendar.tsx` WeekCard / WeekStripCard | HEAVIER, MULTIWEEK, TUNE-UP (one slot, one precedence constant) |
| `TodayScreen.tsx` / `weekIdentity` | HEAVIER, MULTIWEEK |
| `GeneratePlanScreen.tsx` | INJURY-RECENCY, BENCHMARK-DATE, PROFILE-BIRTH-YEAR, WIZARD |
| `sessionCatalogueData.ts` | BEGINNER-TAPER |
| `CoachingPrinciples.md` | every run item above (see §2) |
| `packages/strength/session.ts` (`assemble`, `estimateMinutes`), `validate.ts`, `recovery.ts` | PAIR-STRIDE, CARRY |
| Baselines `planFitnessBaseline.json`, `cohortShapeBaseline.json` | GOALPACE (declared re-baseline); S9, WEEKDAY, COACH-READ, BEGINNER-TAPER, WIZARD must state moves |
| tests `foundationOnRamp/foundationResize/onsetWeekTwo.test.ts` | TEST-CLOCK; read by base-build and onset work |

---

## 4. Interaction risks (one ruling's mechanism changes another's measured population)

1. **Every ramp-warn mover × every ramp-warn reader.** `RAMP_RESIDUAL_CODES` verdicts are read by PLAN-NOTE-HEAVIER (week N), MULTIWEEK (stamped set), TUNE-UP (§32 placement) and §32 Am. 1. They are moved by ACHILLES (DELIVERED-RAMP 400 → 256, INJURY-CAP-DELIVERED 488 → 448 on its cohort), S9 B (DELIVERED-RAMP net −88 cohortGrid / −16 targeted), WEEKDAY (DELIVERED-RAMP +9/−7), LONG-RUN-CAP (back HM maintenance 74.2% → 47.2%), STEPBACK (+494 step-back plans), COACH-READ 6/7. The readers' figures (322 / 94 multi-week / 13-of-58 collisions) were measured on today's engine; build the readers **last** or re-measure after each mover.
2. **STAGED-RAMP "surplus runway HOLDS" × `INV-PLAN-ONRAMP-CURVE-CLIMBS`.** The check fires on any non-deload ramp week whose `weekly_km` ≤ the previous (`baseBuildValidate.ts:~81`, read **[run here]**). DURATION's Am. 13/14 exemption covers **budget-held** weeks only. A ratio-held week is neither, so STAGED's own producer-direct test (door 25, cw 1, runway 32) will produce weeks the climbs check calls an error. Neither ruling states the exemption. Latent through the engine today (0 firings).
3. **BASEBUILD-NO-LONG-RUN × BASEBUILD-DURATION** (same functions). DURATION's refused cohort (8 of 1,081, all 3-day, weekend blocked) was measured with NO long run; a §122 Am. 1-exempt long run lands on a weekday for them, may let the block climb and re-opens an uncapped weekday session (DURATION C3). NO-LONG-RUN's derived long-run share (≤ 60%) and DURATION's §52-share gate (0 → must stay 0 after capped easy days) read the same weeks. NO-LONG-RUN's 2× longest-run residual (29.2%) is to be settled by §9's time cap reaching the ramp long run, which needs DURATION's threaded pace.
4. **GETRUNNING-WALKRUN-LRHALF × both base-build items.** Run-walk carried on every §118 ramp session (`applyRunWalk`, minutes kept) sits on sessions DURATION gives `duration_mins` and NO-LONG-RUN gives a designated long run. Its "0 km by construction" endpoint parity was measured on today's ramp.
5. **STEPBACK (b) × GOALPACE §120 Am. 4 × LR-FINISH × BEGINNER-TAPER.** Am. 4 withholds goal pace for unbenchmarked HM/MAR beginners → their long runs become finish-goal shaped (LR-FINISH, 2,304 peak LRs) and their taper selects as finish-goal (§120 Am. 2), so BEGINNER-TAPER's measured ≈1,418 sharpener population (mostly unbenchmarked: 792 + 576 of it) shrinks to whoever keeps a live goal. Its parity condition ("confined to ≈1,418") must be re-derived after Am. 4.
6. **STEPBACK × WIZARD §96 Am. 1.** §47's wholesale `coach_notes` rewrite strips the overdo cue (735 measured). (b) adds 494 step-back plans (beginner time-target 5K/10K), so more long runs go through the rewrite the WIZARD build must preserve the cue across. Same function.
7. **COACH-READ claim 1 (equal deload = violation) × ACHILLES acceptance ("0 new DELOAD-IS-A-REDUCTION").** Changing the checker moves the baseline ACHILLES is accepted against; and claim 7's bounded peak deloads move where "the next deload" falls for ACHILLES's carried re-anchor (which must produce 0 new BOUNCEBACK). Order and re-measure.
8. **LONG-RUN-CAP × INJURY-RECENCY.** Back = HM cap changes where Back's recency follow-up is shown (marathon+), per the Design scope amendment, which reads "the engine's predicate". Same §9 Am. 3 text, same config table, same measure:fitness overlay condition (neither run).
9. **S9 B × WEEKDAY-OVERRUN.** B changes hill-rep distances (5 → 6/6.5 km) and adds PEAK-IN-PEAK-PHASE on 5K 3-day plans; WEEKDAY substitutes `hill_reps → intervals_long` 37 times and sizes through `makeQualitySession`. WEEKDAY's ratchet (≤ 124) and its 12 lost-quality weeks were measured on a pre-B engine.
10. **COACH-READ claim 4a (label reads plan max) × S9 B's PEAK-IN-PEAK moves × claim 6 taper cap.** Which week is "highest volume" changes when B moves the peak week on 5.7% of hill plans.
11. **WIZARD-PAID-INPUTS (free runners now answer hsr/terrain) × free-tier plans in production.** `avoid` changes 44% of no-injury plans, `love` 13%, `overdo` 4% (prescription). Corpora are tier-blind (SLT measured 0/300), so gates do not move; live free plans generated after the build do.
12. **BENCHMARK-DATE / PROFILE-BIRTH-YEAR × §10 staleness and masters cadence.** Requiring date and age moves real runners into §10's ramp and into COACH-READ claim 7's masters population. No corpus moves; production populations do.
13. **ACHILLES §89 amendment × HIP §89 amendment × §89 injury veto.** Two new texts on one section; HIP states every chip is an injury history for the any-injury gates that ACHILLES's tendon rule sits beside. INJURY-RECENCY's "longer ago" proxy is `Back→Hip`.
14. **PAIR-STRIDE × CARRY × Design ruling 4.** CARRY's figures were measured on B's walk; its merge goes inside `assemble` after the walk; parts per screen move (5.99 → 5.09 → ~0.04 less).
15. **TEST-CLOCK × base-build/onset builds.** The three drifting tests cover foundation on-ramp/resize and onset week; they currently exercise a shorter runway than they declare, so they can stay green or go red for reasons unrelated to a base-build or onset change.

---

## 5. Outstanding coach-engine issues that survive the build

### 5a. Declared residuals and dissents in the rulings (37 items read)

1. DURATION — 8 runners refused (`budget_cannot_climb`, levers named); 6 runners held below declared volume (Hutchinson revisits on live data); 49 non-floor-held over-cap weekday sessions unclassified; no-benchmark runners' cap still cannot bind (Sims, `812e7e2e`); placed-below-door 41 at HEAD (observed, not filed); two answers to "is a pace derivable?" (observed).
2. NO-LONG-RUN — 1,728 of 5,925 (29.2%) still prescribe a session > 2× longest recent run (Willy); next sitting = §9 time cap on the ramp long run; ramp weeks with more runs than `days_available` (observed); `validatePlan` raises race codes on every base build (observed).
3. ACHILLES — bounceback carry-through unprototyped (binding); plantar not measured (Sims dissent; corpus rows needed).
4. LONG-RUN-CAP — 50.0% of back marathon plans keep a peak LR below the runner's longest (McMillan dissent, reopens on flare data); 50K/100K unmeasured.
5. INJURY-RECENCY — McMillan knee dissent; ADR-021-ready runners unmeasured.
6. S9 — PEAK-IN-PEAK-PHASE residual declared per plan; injury cohort unmeasured.
7. WEEKDAY — 124 sessions past tolerance stay declared (worst +177%, race-specific); race-specific dose cap = a separate sitting (not filed).
8. STEPBACK — option (c) for finish goals (Willy's end state; not filed).
9. GOALPACE — neverBuilds masters 14.2 → 14.6 and standard 9.4 → 9.6 re-baselined as a km-ruler artefact.
10. LR-FINISH — McMillan's negative-split finish for HM/MAR beginners (needs data).
11. COACH-READ — claim 2 ramp warn debt frozen by §2 Am. 2 (ages at the note: DELOAD-IS-A-REDUCTION 92 days, INJURY-CAP-DELIVERED 75, DELIVERED-RAMP 74); claim 3 attribution pending; claim 7 standard cadence not ruled; Willy's ceiling-4 reopens on outcome data; taper minutes re-price at fixed km (observed).
12. WIZARD — Seiler dissent (deload cue); McMillan §110 dissent (adherence data); 88.9% reach is arithmetic.
13. TUNE-UP — Seiler "the tune-up replaces that week's quality" not ruled; injury grid unmeasured (condition).
14. HR-SAVE — McMillan dissent; re-open triggers (>5 at risk; sheet saves separately).
15. HIP — McMillan wants a hip-specific run effect; §47 Am. 2's injury skip rests on §90 reconciliation that runs only for knee/shin (observed, code-read).
16. WALKRUN-DELOAD — McMillan's 70%-time option on outcome evidence.
17. LRHALF — Willy/McMillan input-coherence check (`longest < weekly ÷ 7`), not filed (overlaps API-WEEKLY-KM-UNBOUNDED-01).
18. STAGED-RAMP — what "hold" looks like week by week, unseen on any grid.
19. MULTIWEEK — Seiler's HM-curve observation (predicate frozen).
20. HEAVIER — plan-tile rank, post-ship.
21. PAIR-STRIDE — "under 0.9 of clock" count watched (Willy).
22. CARRY — in-part order not ruled; Design names the part.
23. GETRUNNING-S111 — race block at the checkpoint not measured.
24. Closed-but-reopenable: WEEK1-DELIVERED-CEILING-01 (run-frequency, blocking data dependency); INTENSITY-DECLARATION-FLOOR-01 (re-open on completion/injury data); FOUNDATION-FLOOR-SUBKM-01 (error arm kept as tripwire); MAXHR-RECENCY-01 (withdrawn); BENCHMARK-STALENESS-CEILING-01 (both numbers vacated); RUNWALK-ASSESSED-LEVEL-01-PEAK (vacated); `INV-PLAN-RUNWALK-SHORTDIST-SCOPE` warn on 84 HM plans (SHORTDIST-RUNWALK-SCOPE-01's residual); STAGED-DOOR-AT-CAP-01 (🔻, modal 4.00×).
25. Blocked-on-data items (3): EMAIL-WAVE-4, LOG-OFFPLAN-03, ADJUST-TRIGGER-REACH-02.

### 5b. Debt registers bearing on engine quality (counted from files **[run here]**)

| Register | Count |
|---|---|
| `SWEEP-BASELINE-01` (`scripts/property-validate-plans.ts` `BASELINE`) | **16 codes, sum of allowances 1** — only `INV-PLAN-PEAK-OVER-BASE@slow-goal: 1` is non-zero |
| Invariant liveness baseline (`__fixtures__/invariantLivenessBaseline.json` `unproven`) | **3**: `INV-INPUT-LONGEST-LE-WEEKLY` (mutation), `INV-PLAN-PHASE-FOCUS-REACHABLE` (static), `INV-PLAN-ULTRA-NO-PACE-SEGMENTS` (corpus) |
| `UNPROVEN_INVARIANT_COVERAGE_BASELINE` (`principleCoverage.ts:119`) | **2** principles: §17, §18 |
| `configPrincipleSync.test.ts` `KNOWN_MISSING` | **24** keys (CLAUDE.md still says 27) |
| `configConsumer.test.ts` registers (key regex, spot-check before quoting) | DECLARATIVE 5 · UNWIRED 0 · SIG_SUPERSEDED 7 · SIG_UNBUILT 3 · SF_DECLARATIVE 1 · SF_SUPERSEDED 1 · SF_UNWIRED 3 · ROW_DECLARATIVE 1 · ROW_UNWIRED 2 · COACHING_UNWIRED 0 |
| `rca1026Gates.test.ts` `DEBT` | **3** builders: `progressiveTempoPlan`, `fixedShapePlan`, `effortGovernedPlan` |
| `boardRulingRegisterDebt.json` | unregistered **50**, no id **43** |
| Stored-plan debt (`npm run audit:stored`, production read-only) | **43** plans; **30** carry error-severity violations; **18** with a breach in a week still ahead; violations ahead **92** · elapsed **191** · plan-level **44**; top ahead code `INV-PLAN-HR-MATCHES-PACE` (13 plans); regen refused 8 started · 5 AI copy · 3 activities · 2 completions. Live-plan policy = new plans only, so no build here repairs these. |

---

## 6. Draft dependency order (waves)

**W0 — hygiene, no prescription delta (parallel-safe):** TEST-CLOCK-CONSTRUCTED-DATE-01 (before anything touches
foundation/onset tests) · GETRUNNING-S111 (dispatch test + comment) · HR-SAVE · DOUBLE-STRIDES · WALKRUN-DELOAD-CLAIM ·
INJURY-HIP (claims §89 Am. 1; coordinate with ACHILLES). *Why first:* small, cheap, and they fix instruments or text the
later waves read.

**W1 — base-build ramp (strictly ordered, one producer):** commit the ramp measurement gate (NO-LONG-RUN condition 1)
→ BASEBUILD-NO-LONG-RUN (§116 Am. 13) → BASEBUILD-DURATION (Am. 14; re-measure the 8; founder option A refusal) →
STAGED-RAMP-RATIO (resolve risk #2: a ratio-held week vs CURVE-CLIMBS) → GETRUNNING-WALKRUN-LRHALF (endpoint parity on
the final ramp). *Why:* every item shares `foundationBlock.ts` / `baseBuildValidate.ts`; each later one must be measured
on the earlier one's output; the gate makes "re-measure" a command.

**W2 — race-plan quality sizing/selection:** S9 (§40b Am. 5) → WEEKDAY-OVERRUN (§81 Am. 3, C1–C5, ratchet re-measured on
post-S9 engine). *Why:* both in `buildWeekSessions`; WEEKDAY sizes candidates through the function S9 changes.

**W3 — peak/goal-pace chain:** STEPBACK (§47 Am. 5; check the Am. 4 numbering gap first) → GOALPACE §120 Am. 4 + §44
Am. 2 gap arm + LR-FINISH (same commit) → BEGINNER-TAPER (parity re-derived on post-Am. 4 population) → WIZARD engine
half (§96 Am. 1 cue through the §47 rewrite; §24e; §40c) + WIZARD UI half → COACH-READ claim 5 (§114; reads the
`race_pace` stamp after Am. 4 has settled who keeps one). *Why:* stated ruling order plus risks #5, #6.

**W4 — load shape, deloads, taper, injury:** COACH-READ claim 1 (checker) → claim 7 (`deloadCadence.ts` bounded) →
claim 6 (taper easy cap) → claim 4a → claim 3 (`/zona-debug` first) → ACHILLES (§89 Am. 2; acceptance measured on the
post-claim-1/7 checker and cadence; bounceback 0 or back to board) → LONG-RUN-CAP (§9 Am. 3 values) → INJURY-RECENCY
(§9 Am. 3 recency + wizard follow-up). *Why:* risks #7, #8; one §9 Am. 3 edit sequence.

**W5 — ramp-residual readers (UI + engine), after W1–W4 have stopped moving warns:** mockups to founder →
PLAN-NOTE-HEAVIER + CP-90-AM3 (§90 Am. 3) → Design sitting on multi-mark → PLAN-NOTE-MULTIWEEK (same §90 edit, set
equality) → TUNE-UP §32 Am. 1 + WeekCard line (one slot). Device check before merge. *Why:* risk #1; stated ordering.

**W6 — inputs and migration:** BENCHMARK-DATE-REQUIRED · PROFILE-BIRTH-YEAR-REQUIRED (independent of engine code;
can run in parallel any time, but they move production populations, risk #12) · ANCHOR-BAND-MIGRATION-NOTICE
(re-measure first) · ADR012-INTENSITY-TERM (measure) · API-WEEKLY-KM-UNBOUNDED (needs a contract decision).

**W7 — strength (independent of the run engine; parallel track):** STRENGTH-PAIR-STRIDE (S10 Am. 6) →
STRENGTH-CARRY-PATTERN (S10 Am. 7) → STRENGTH-RELEASE-01 when the founder/Design conditions clear. *Recommendation, not
a ruling:* PAIR-STRIDE before release, because 29.5% of strength sessions today show a duration longer than S10's own model.

**Parked:** EMAIL-WAVE-4, LOG-OFFPLAN-03, ADJUST-TRIGGER-REACH-02 (data) · ENGINE-COPY-SHARPEN-01 (founder; recommended leave).

---

## 7. What this inventory does not prove

- No build, parity, measure:fitness, cohort:shape or liveness run was made here; every prescription figure is a decision note's, on its sample (most are strided grids, not production).
- Prototype file/function lists come from `git diff merge-base..proto/*` with scripts and docs excluded; the build will touch more (invariants, plan-invariants.md, tests) than the prototypes did.
- Interaction risks are read from the rulings and code, not measured; #2 (ratio-held week vs CURVE-CLIMBS) is a code read of `baseBuildValidate.ts`, not a run.
- The configConsumer counts come from a key regex over each `Record` literal and may miscount a multi-line key.
- `audit:stored` reflects production at the moment it ran.
