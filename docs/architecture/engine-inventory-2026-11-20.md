# Zonna coaching engine: architecture inventory (read-only, 2026-11-20, HEAD 806fe386)

How the numbers were derived: grep/awk/`wc` over the working tree, plus `tsx` one-liners that imported the
real modules (GENERATION_CONFIG, catalogue, corpora). Every count below names how it was taken. "Callers" means
non-test `.ts/.tsx` files under `app/ components/ lib/ packages/` matching `\bname\(`, unless stated otherwise.

---

## 0. Size (section 8 of the brief, first because it frames everything)

| Tree | all .ts/.tsx files | lines | non-test files | non-test lines |
|---|---|---|---|---|
| `lib/plan` | 483 | 104,113 | 127 | 51,646 |
| `lib/coaching` | 186 | 28,401 | 87 | 14,288 |
| `packages/strength` | 23 | 3,064 | 13 | 1,923 |

Biggest single files (`wc -l`): `ruleEngine.ts` **10,773**, `invariants.ts` **10,328**, `generationConfig.ts` 3,164,
`sessionCatalogueData.ts` 1,704, `inputs.ts` 744, `engine.ts` 701, `schema.ts` 517, `foundationCompose.ts` 214.
`ruleEngine.ts` has 85 top-level `function` declarations; `generateRulePlan` starts at line 6874 and
`buildRulePlanOnce` runs 7028 to 10773 (3,745 lines, one function).

---

## 1. Entry points

### 1a. Run engine (lib/plan, lib/coaching)

| Entry | File:symbol | Sync? | Non-test callers outside its own file |
|---|---|---|---|
| **`runEngine(req)`** — the one door for generation (ENGINE-ENTRY-01) | `lib/plan/engine.ts:313` | sync | `app/api/generate-plan/route.ts`, `lib/marketing/marketingPlan.ts` |
| `evaluateCheckpoint(input, stored, loads, units, planStart?, choice?)` — base-build checkpoint | `engine.ts:96` | sync | `generate-plan/route.ts`, `app/staged-preview/page.tsx` |
| `generateRulePlan(raw, tier, planStart?, catalogue=V1, today?)` — race engine | `ruleEngine.ts:6874` | sync, **throws** designed refusals | `engine.ts`, `stagedRacePlan.ts`, `inputs.ts`, `foundationResize.ts`, `storedPlanRegen.ts`, `envelopeMeasure.ts`, `invariantLiveness.ts`, marketing (`SameWeekTwice.tsx`, `WhenItNotices.tsx`, `demoPlanScreen.ts`), `app/staged-preview`, `lib/ops/*` |
| `composePlanWithFoundation(plan, input, today, decision)` (ADR-020) | `foundationCompose.ts:32` | sync | `engine.ts`, `app/api/generate-plan/foundation/route.ts`, `storedPlanRegen.ts`, `lib/ops/regressionVsNewRule.ts` |
| `resizeForDeferredFoundationAdd` | `foundationResize.ts:84` | sync | `generate-plan/foundation/route.ts` |
| `generateGetRunningPlan` (§118, P-15) | `getRunningPlan.ts:61` | sync | `engine.ts` (+ measurement) |
| `generateStagedRacePlan` (NO-RUNNER-TURNED-AWAY-01) | `stagedRacePlan.ts:268` | sync | `engine.ts`, `stagedScore.ts`, `app/staged-preview` |
| `generateBaseBuildPlan` | `baseBuildOnRamp.ts:202` | sync | internal only: `stagedRacePlan.ts`, `getRunningPlan.ts`, `walkRunStart.ts` |
| `composeWalkRunStart` / `generateWalkRunWeeks` (§117) | `walkRunStart.ts:199/127` | sync | internal only (`stagedRacePlan.ts`, `getRunningPlan.ts`) |
| `generateFoundationBlock` | `foundationBlock.ts:590` | sync | internal only (`foundationCompose.ts`, `baseBuildOnRamp.ts`) |
| `generateMaintenanceBlock` (ADR-013) | `maintenance.ts:352` | sync | `app/api/maintenance-block/route.ts` |
| `applyRecalibration` (ADR-014) / `repriceWeeksFrom` | `ruleEngine.ts:6550/6657` | sync | `app/api/recalibrate-zones/route.ts`; `repriceWeeksFrom` only `scripts/recal-live-repair.ts` |
| `computeTaperRecalibration` | `taperRecalibration.ts:129` | sync | `app/api/recalibrate-taper/route.ts` |
| `computePostRaceReshape` | `lib/coaching/postRaceReshape.ts:118` | sync | `app/api/post-race-reshape/route.ts` |
| **`runAdjustmentEngine(req)`** + `acceptAiSummary` (ADJUST-ENGINE-ENTRY-01, ADR-012) | `lib/coaching/adjustmentEngine.ts:228/539` | sync | `app/api/adjust-plan/route.ts` |
| `applyAdjustmentDays` | `lib/coaching/applyAdjustmentDays.ts:20` | sync | `confirm-adjustment`, `revert-adjustment` routes |
| `regenerateFromStored(plan, profileHr)` | `storedPlanRegen.ts:22` | sync | **no app/lib caller**; only `scripts/` (`rca-1026-regen.ts`, `goalpace-5k-01-regen.ts`, `reenrich-plans.ts`) |
| `applyEdits` (Modify plan) | `modifyPlan.ts:260` | sync | `components/shared/ModifyPlanSheet.tsx` (client builds the input, then POSTs to `/api/generate-plan`) |
| `enrich(rulePlan, input, tier, userId, units)` (ADR-006) | `enrich.ts:241` | **async, AI** | `generate-plan/route.ts` only, inside `waitUntil` |
| `generateFreeIntro` | `freeIntro.ts:45` | **async, AI** | `generate-plan/route.ts`, awaited in-request, free tier, first plan only |
| `enrichMaintenanceBlock` | `enrichMaintenance.ts` (uses `callAnthropic`) | async, AI | `maintenance-block/route.ts` |
| `repairEnrichedCopy` | `enrichRepair.ts:70` | sync | `generate-plan/route.ts`, `scripts/reenrich-plans.ts` |
| `validatePlan` (re-exported by `engine.ts:71`) | `invariants.ts:1042` | sync | 17 files incl. `app/api/ops/plan-audit` |

Designed refusals: four `error.name`s (`PrepTimeError`, `DaysAvailableError`, `BaseVolumeError`,
`LongRunReadinessError`) plus `InputFieldError`, mapped to 422 by `engine.ts → mapRefusal`; owner of "was it a
refusal" is `designedRefusal.ts → isDesignedRefusal`. `runEngine` intercepts §111/§113 refusals and, when
`onRampEnabled()` and `stagingDoorKm` returns a door, returns a staged base-build plan instead of a 422.

`generateRulePlan` itself is a **retry ladder**, not one build: `build()` (=`buildRulePlanOnce`) runs once with
deload position-2 avoidance, again without it if that has fewer error violations, and then, if an early-onset
plan breaches `INV-PLAN-INTENSITY-DISTRIBUTION`, an ungated build plus up to `ONSET_YIELD_MAX_RUNGS` relaxed
builds (§98). Each attempt calls `validatePlan` at least once; `finalise` then runs `assessBaseBuild` (may throw
`BaseVolumeError`), `refreshWeekCopyIfStale` on every week, recalibration-week pruning, `validatePlan`,
`reconcileLoadResidualNote`, `enforceViolations`. So one request runs `buildRulePlanOnce` 1 to (3 + rungs) times.

### 1b. Strength engine (`packages/strength/index.ts`, the only public surface)

`generateStrengthPlan(profile, ctx|null, opts)`, `validateStrengthPlan`, `parseStrengthProfile`,
`easeForRecovery`, `suggestLoad`, `recoveryEaseViolations`, `progressionViolations`, `standaloneContext`,
`withChosenDays`, catalogue + `STRENGTH_CONFIG`. All pure.

Callers: `generateStrengthPlan` ← `app/api/strength/plan/route.ts`, `lib/strength-bridge/planReach.ts`
(`regenerateStored`), `app/strength-preview`. `planToRunContext` (`lib/strength-bridge/runContext.ts:43`) ←
`strength/plan` route only. `easeForRecovery` ← `lib/strength-bridge/recoveryEases.ts`, `lib/ui/recoveryCardCopy.ts`.
`suggestLoad` ← `lib/strength-bridge/progressionView.ts`.

**Strength is regenerated lazily on READ**: `GET /api/strength/plan` rebuilds and re-saves when
`storedPlanReach` reports `run_week_changed` (run-context signature moved) or `engine_changed`.

### 1c. API routes

`find app/api -name route.ts` = **68 routes**; **42** import from `lib/plan`, `lib/coaching`, `packages/strength`
or `lib/strength-bridge`. The ones that **produce or mutate a plan**:

| Route | Engine call | AI | Persists via |
|---|---|---|---|
| `POST /api/generate-plan` | `runEngine` / `evaluateCheckpoint` | free: `generateFreeIntro` awaited in-request (first plan); trial/paid: NDJSON stream, rule plan first, then `enrich` in `waitUntil` (`maxDuration = 300`) | **returns the plan; the client saves** it on "Use this plan" (`DashboardClient` → `savePlanForUser`). The `waitUntil` chain writes `plans.plan_json` **directly with `.update()`** only if a row exists and `shouldServerPersist` (bypasses `savePlanForUser`'s `validateSavedPlan`, archive and supersede) |
| `POST /api/generate-plan/foundation` | `composePlanWithFoundation`, `resizeForDeferredFoundationAdd` | no | returns; client saves |
| `/api/adjust-plan` | `runAdjustmentEngine` + `acceptAiSummary` | `callAnthropic` | `savePlanForUser` + `plan_adjustments` |
| `/api/confirm-adjustment`, `/api/revert-adjustment` | `applyAdjustmentDays` | no | `savePlanForUser` |
| `/api/recalibrate-zones` | `applyRecalibration` | no | `savePlanForUser` |
| `/api/recalibrate-taper` | `computeTaperRecalibration` | no | `savePlanForUser` |
| `/api/post-race-reshape` (+ `/confirm`, `/revert`) | `computePostRaceReshape` | `callAnthropic` | `savePlanForUser` + `post_race_reshapes` |
| `/api/maintenance-block` | `generateMaintenanceBlock` | `enrichMaintenanceBlock` | `savePlanForUser` |
| `/api/strength/plan` (GET + POST) | `planToRunContext` → `generateStrengthPlan` → `validateStrengthPlan` | no | `strength_plans` upsert |
| `/api/strength/ease`, `/log`, `/completion` | none / read-side | no | `strength_plans`, `strength_lift_logs`, `strength_completions` |
| `/api/ops/plan-audit` | `validateStoredPlan`, `validatePlan` | no | read-only |

`savePlanForUser` (`lib/plan.ts:95`) callers: `DashboardClient.tsx` (8 call sites) + 9 routes listed above. It runs
`validateSavedPlan`, Zod shape, `plan_archive` insert on race change, `supersedeWeekKeyedRows`, upsert to `plans`,
and deletes all `plan_weekly_notes`.

---

## 2. Inputs

### 2a. `GeneratorInput` (`types/plan.ts:31`): **33 fields, 6 required + 27 optional** (counted from the interface)

⚠️ `docs/contracts/engine.md` says *"31 fields … 25 optional"*. The interface has 33/27. Not reconciled here.

"Wizard" = the object literal in `app/dashboard/GeneratePlanScreen.tsx:1135`, which sets **23 fields**.

| Domain | Field | Wizard? | Other writers (non-test) | Notes |
|---|---|---|---|---|
| Goal / race | `race_date`* | yes | Modify (`race_date` key) | |
| | `race_distance_km`* | yes | | |
| | `goal`* | yes | | |
| | `race_name` | yes | | |
| | `target_time` | yes | | |
| History / volume | `current_weekly_km`* | yes | checkpoint (`checkpointRaceInput`) replaces with observed | |
| | `longest_recent_run_km`* | yes | checkpoint | |
| | `training_age` | yes (optional) | | |
| | `recent_quality_training` | yes (optional) | | |
| | `weeks_at_current_volume` | **no** | **none in product**; only corpora (`cohortGrid` targeted, `charityCohort`) | read by `ruleEngine`, `startVolume`, `foundationBlock`, `inputs`, `invariants` |
| | `volume_observed` | no | engine-internal (`stagedRacePlan.ts:145`); route strips it unless faithful to stored input | |
| | `after_walk_run_start` | no | engine-internal (`engine.ts:190`); route strips likewise | |
| Schedule | `days_available`* | yes | Modify | |
| | `days_cannot_train` | yes | Modify | |
| | `preferred_long_run_day` | yes (default `'sun'`) | Modify | |
| | `max_weekday_mins` | yes | Modify | |
| | `day_budgets` | yes | | |
| Identity / physiology | `age` | yes, **absent when birth year skipped** (MAXHR-AGE-ABSENT-01) | | |
| | `user_declared_level` | yes | | the wizard's level |
| | `fitness_level` | **no** | `app/staged-preview`, `lib/marketing/plans.ts`, `storedPlanInput.ts` (replay from meta) | API structural override; product never sets it |
| | `fitness_intensity_level` | **no** | only `storedPlanInput.ts` replay | not read by `ruleEngine`; read by `invariants.ts` |
| | `athlete_name` | no | **`generate-plan/route.ts:141`** from profile | |
| HR / benchmarks | `resting_hr`, `max_hr`, `max_hr_source` | yes, only when HealthKit supplies them | `withProfileHr` (`rebuildInput.ts`) on Modify | |
| | `benchmark` (`type`, `distance_km`, `time`, `benchmark_date?`) | yes | | `benchmark_date` drives the wall-clock VDOT discount |
| Preferences | `hard_session_relationship` | yes, **paid/trial only** | Modify | |
| | `terrain` | yes, **paid/trial only** | Modify | |
| | `training_style` | **no** | **no writer anywhere** | only copied to `meta` (`ruleEngine.ts:10163`) and into the enrich prompt (`enrich.ts:685`) |
| | `motivation_type` | **no** | **no writer anywhere** | only copied to `meta` (`ruleEngine.ts:10165`) |
| Injuries | `injury_history` | yes, every tier | Modify | |
| Plan options | `acknowledged_prep_warning` | via `ACK_FIELD` on 422 retry | `stagedRacePlan`, corpora | `acknowledged_days_warning` is also sent but lives on `inputs.ts`'s internal type, **not on `GeneratorInput`** |
| | `foundation_decision` | no | `foundationResize.ts:99` (`'add'`, foundation route) | |

Request-body fields outside `GeneratorInput`: `accept_base_build`, `checkpoint`, `checkpoint_choice` (read by route).
Modify plan edits 8 keys (`modifyPlan.ts:41 ModifiableKey`): days_available, days_cannot_train,
preferred_long_run_day, max_weekday_mins, injury_history, hard_session_relationship, terrain, race_date.

**Read but never sent by the product:** `training_style`, `motivation_type` (no writer at all),
`weeks_at_current_volume` (corpora only), `fitness_level` and `fitness_intensity_level` (replay/preview only).

### 2b. `StrengthProfile` (`packages/strength/types.ts:23`): 9 fields (5 required)

`focus`, `session_minutes`, `sessions_per_week`, `equipment`, `experience` required; `injury_tags?`,
`bone_health_flag?`, `unavailable_days?`, `available_days?`. `StrengthSetupScreen.tsx` sets all except
`injury_tags` (injuries are read-only there; they arrive via `RunContext.injury_tags` and are merged in
`generate.ts:53`). Run-side context is `RunContext` v1 from `planToRunContext`, which reads `meta.age`,
`meta.injury_history`, `meta.race_date`, sessions after overrides.

---

## 3. Producers: everything that writes `plan.weeks` / sessions / meta

**Generation-time (inside `generateRulePlan`)**: per-week loop (`ruleEngine.ts:7676`, `buildWeekSessions`,
`applyInjuryAdjustments`, `summariseWeek`) then post-passes. Counted from 2-space-indented statements in
`buildRulePlanOnce` after the week loop (lines 7885–10765):

- **15 named post-pass calls (14 distinct functions)**: `applyLongRunStepBacks`, `applyLongRunProgressionCap` (×2),
  `reclampPeakStepBacks`, `applyTaperLongRunCap`, `applyV2Vo2MaxOnsetTiming`, `applyV5StimulusProgression`,
  `applyV1VolumeQualityStimulusSplit`, `applyV4LongRunRepeatCeiling`, `applyPeakStepBackVolume`,
  `applyTaperDeliveredDepth`, `applyRacePaceSegmentDuration`, `applyV3HrEstimationNotePropagation`,
  `applyV7TaperRationale`, `reconcileWeekdayOverrunNotes`.
- **11 inline mutating blocks**: §52 long-run cap loop (7885), fuelling cues (8151), declined-2nd-quality record
  (8175), §53 variety rebalance (8221), §27 theme re-derivation (8312), injured quality yield (9284), restated-week
  floor cut + copy (10559), late maintenance reclass (10606), adjacent-open-days quality drop (10643), finish-goal
  run-walk pass (10709), §117 run-walk stamping (10755).
- Plus `applyWeekdayMinsCap` called inside the `weeks.forEach` at 10559 (call at ~10566), and meta assembly (`const meta` at 10042,
  roughly 450 lines). Total **26 post-pass sites** by this method (a block whose header comment I could not tie to
  a mutation would change it; not verified line-by-line).
- `finalise` in `generateRulePlan`: `refreshWeekCopyIfStale` on every week, recalibration-week pruning,
  `reconcileLoadResidualNote`.

**ADR-022 levers** are inside the build (deload re-anchor, injury peak yields 2nd quality, easy-run trim);
not separately located here.

**After generation (composition, same request)**: `composePlanWithFoundation` (owner of `plan.weeks` mutation
post-generation, ADR-020), `generateStagedRacePlan` / `generateGetRunningPlan` / `composeWalkRunStart` (their own
plan objects), `runEngine` stamps `meta.foundation_gap_class`.

**AI layer**: `enrich` → `mergePlan` (`enrich.ts:724`), `repairEnrichedCopy`, `revertWeeksToRuleCopy` /
`revertSessionsToRuleCopy` (`enrichPartialRevert.ts`), `generateFreeIntro` (sets `meta.plan_intro`),
`enrichMaintenanceBlock`. `EnrichedWeekSchema` limits what the model may change.

**Later mutations (other routes)**: `applyRecalibration`, `computeTaperRecalibration` (uses `scaleSessionAnchors`),
`computePostRaceReshape` (uses `scaleSessionAnchors`), `runAdjustmentEngine` (`lib/coaching/planAdjustment.ts`,
uses `scaleSessionAnchors`, calls `refreshWeekCopyIfStale`), `applyAdjustmentDays`, `generateMaintenanceBlock`
(new plan object), client-side `applyHrToPlan` (`lib/plan/zones.ts:174`, called from `DashboardClient`).
Repair-only: `repairPlan` (`planRepairs.ts:191`, only `scripts/recal-live-repair.ts`), `regenerateFromStored` (scripts).

**Read-time overlays (never persisted into `plan_json`)**: `resolveEffectiveDay` / `getSessionsForDate`
(`effectiveSessions.ts`, `weekResolution.ts`) apply `session_overrides` moves/swaps for Today, PlanCalendar,
daily-coach-note, push send-daily, pre-session-readiness, widget, strength `RunContext`; `applyRecoveryEases`
for strength.

---

## 4. Outputs

### 4a. Run `Plan` (`types/plan.ts:1069`): `{ meta, phases?, weeks, pre_plan? }`

- **`Session`** (`types/plan.ts:216`): **28 fields** in the TS type. Key ones: `type` (11-value `SessionType`),
  `role` (`long_run|shakeout`), `catalogue_id` (ADR-018), `derived_set` (ADR-019), `stimulus`, `label`, `detail`,
  `distance_km` / `duration_mins` (one or the other anchors), `primary_metric`, `duration_anchored`,
  `floor_protected`, `zone`, `hr_target`, `pace_target`, `rpe_target`, `coach_notes` (≤3), `lr_segment_pace`,
  `race_opening_pace`, `key_session`, `run_walk_strategy`, `walk_run_level`, `weekday_overrun_note`,
  `fueling_protocol`, `enrichment_reverted`, `eased_for`, `displaced_by_adaptation_window`, `id`.
  Zod `SessionSchema` (`schema.ts:17`) declares **24** keys.
- **`Week`** (`types/plan.ts:383`): 18 fields (`n`, `date`, `label`, `theme`, `type`, `phase` incl. foundation /
  base_build / walk_run_start / maintenance_*, `badge`, `sessions` keyed mon..sun, `long_run_hrs`, `weekly_km`,
  `weekly_duration_mins`, `tune_up_callout`, `quality_downgraded`, `result_embedded`, `coach_debrief`,
  `enrichment_reverted`, `peak_stepback`, `reengagement`).
- **`PlanMeta`** (`types/plan.ts:559`): **118 declared fields**; Zod `PlanMetaSchema` declares **61** and is not
  `.strict()`, so the rest pass unchecked. **8 more keys are written/read only through
  `meta as unknown as Record<…>` casts** and appear in neither: `base_build_start_km`, `base_build_target_km`,
  `current_weekly_km`, `onramp_spaced`, `staged_race`, `walk_run_carried`, `walk_run_resumed`,
  `walk_run_start_weeks`.
  - **16 `*_note` fields**: volume_constraint, difficulty, returning_runner, volume_shortfall, long_run_shortfall,
    uncovered_runway, short_opening_block, peak_shortfall, load_residual, fitness_signal, goal_below_easy_ceiling,
    terrain_effort, hard_pref, frequency_constraint, intensity_reentry_omission, hr_assumption. Plus `notes`,
    `prep_time_warning`, `days_available_warning`, `difficulty_band`, `plan_intro`, `coach_intro`,
    `confidence_score/risks`.
  - Stamps: `generated_at`, `generator_version`, `generator_input` (the stored input, replayed by Modify and
    scripts), `tier`, `enrichment`, `foundation_gap_class`, `vdot`, `vdot_training_anchor`, `goal_pace_*`,
    `recalibration_weeks`, `recalibrations_applied`, `taper_recalibrated_at`, `plan_kind`, `source_race_*`
    (maintenance), `rule_adjustments`, `onset_yield`, `deload_position2_yielded`, `hr_*` provenance.

### 4b. `StrengthPlan` v1 (`packages/strength/types.ts:172`, contract `docs/contracts/strength-engine.md`)

`{ version, standalone, split, profile, weeks[{ n, phase, sessions[{ date, day, week_n, kind, heavy_legs,
after_quality_run, estimated_minutes, blocks[{ role, items[{ exercise_id, sets, reps|seconds|contacts, rir,
rest_s, per_side, superset? }] }] }] }], notes[5 enum], start_date, injury_tags }`. Catalogue: 99 exercises.

---

## 5. Consumers

**Screens** (imports and `meta.` reads by grep):
- **Today** `components/dashboard/TodayScreen.tsx` (2,480 lines): `effectiveSessions`, `renderGuidance`,
  `catalogueLink`, `doubles`, `rpeNudges`, `sessionRole`, `easyPaceCeiling`, `checkpointCopy`; session
  `catalogue_id`, `derived_set`, `hr_target`, `pace_target`, `coach_notes`, `zone`, `rpe_target`, `role`.
- **Plan** `components/training/PlanCalendar.tsx` (1,398): `effectiveSessions`, `weekResolution`, `overrideMoves`,
  `resolveMainSet`, `sessionDistance`; meta `days_cannot_train`, `generator_input`.
- **Session detail** `components/dashboard/SessionPopupInner.tsx` (1,993): `resolveMainSet`, `sessionComposer`,
  `notesProvenance`, `runWalkPlan`, `weekdayOverrunNote`; session `run_walk_strategy`, `weekday_overrun_note`.
- **Me** `MeScreen.tsx`: meta `race_date`, `race_name`, `zone2_ceiling`; `HRZonesSection`: `hr_zone_method`,
  `hr_assumption_note`; `TrainingZonesScreen`: `benchmark`, `vdot`.
- **Wizard result** `GeneratePlanScreen.tsx`: `coach_intro`, `confidence_*`, `difficulty_band/note`, `enrichment`,
  `foundation_gap_class`, `plan_intro`, `prep_time_alternatives`, `uncovered_runway_*`.
- **DashboardClient** (root): `generator_input`, `vdot*`, `zone2_ceiling`, `recalibrations_applied`,
  `hr_derived_max`, `hr_assumption_note`, `plan_intro`, and **`planRationaleNotes`** (`planRationale.ts:132`),
  which is the single reader of 12 of the 16 `*_note` fields (also read by `enrich.ts`).
- Coach: rendered inside `DashboardClient` (no `CoachScreen` file). **There is no `PostRunScreen` file**; the name
  survives only in comments (`ReflectionInput.tsx`, `PendingHrCard.tsx`, `FreeRunRead.tsx`) and in CLAUDE.md.

**AI prompt builders** (`lib/coaching/prompts/`, 15 non-test files) read almost no plan meta directly:
`sessionFeedback.ts` (plan_kind, race_*, source_race_*, zone2_ceiling), `sessionReframe.ts` / `weeklyReport.ts` /
`postRaceReshape.ts` (race identity), others take routed context via `athleteContext.ts`. `enrich.ts` reads
coach_intro, confidence_*, difficulty_*, goal_pace_*, notes, recalibration_weeks, time_compressed.

**Push / reports**: `push/send-daily` → `getSessionsForDate` + `voiceLines` (`key_session`); `weekly-report` →
`lib/coaching/weeklyReport.ts`, `weekVolume`; `send-weekly-report` → `autoAnalyse`.

**Website plan pages**: `app/plans/page.tsx`, `app/plans/[slug]/page.tsx`, `app/page.tsx`, `charity-runners`,
`sitemap.ts` → `lib/marketing/marketingPlan.ts → generateMarketingPlan` (calls **`runEngine`** at build/render,
then `validateMarketingPlan`); `SameWeekTwice.tsx` / `WhenItNotices.tsx` call `generateRulePlan` directly.

**Strength bridge**: `planToRunContext` reads sessions after overrides, `meta.age`, `meta.injury_history`,
`meta.race_date`.

**Stored-plan audits**: `/api/ops/plan-audit` (`validateStoredPlan`), `storedPlanDebt.ts`, `scripts/*regen*`.

**Written but read by nothing found**: meta `prep_time_warning`, `days_available_warning` (only the producer and an
invariant at `invariants.ts:4130` reference them); session `fueling_protocol` (only `schema.ts` and
`postRaceReshape.ts`), `duration_anchored`, `displaced_by_adaptation_window` (only producer + invariants).
Method: whole-word grep for the field name; a generic key iterator would not show up.

---

## 6. Rule / check layer

| Layer | Count (method) |
|---|---|
| `GENERATION_CONFIG` | **245 top-level keys** (`Object.keys`, tsx) |
| `PLAN_SIGNATURES` | 6 (5K, 10K, HM, MARATHON, 50K, 100K) |
| `SESSION_FORMAT` | 4 (UNIVERSAL, WARMUP, COOLDOWN, LONG_RUN_PEAK) |
| Session catalogue `V1_SESSION_CATALOGUE` | **31 rows** (27 `is_free_tier`): aerobic 3, threshold 9, vo2max 6, race_specific 9, ultra_specific 4. **0 rows carry `version`**, so ADR-019's v2 resolver path is still unexercised by any row |
| CoachingPrinciples.md | 138 distinct `## N.` headings (+ amendment headings) |
| `validatePlan` | `INVARIANT_CODES` (`invariants.ts:62`) **171** unique, equal to the distinct quoted `'INV-…'` literals in the file |
| `validateBaseBuildBlock` + `validateStagedRace` / `validateStagedDoorRatio` / `validateWalkRunStart` (`baseBuildValidate.ts`) | 8 distinct codes |
| `validateStoredPlan` / `validateSavedPlan` / `validateRepairedPlan` (`validateStoredPlan.ts`), `validateReshapedPlan`, `validateMaintenanceBlock` (`invariants.ts:10037/10075`) | reuse codes; 0 own literals |
| Union of distinct `INV-` literals across non-test `lib/plan` | 179 |
| `docs/canonical/plan-invariants.md` rows starting `INV-` | 174 (does not equal 171 or 179; not reconciled) |
| `validateStrengthPlan` | **50** distinct `'S-…'` literals in `packages/strength/validate.ts` (contract says 40 as of 2026-10-17) |
| `STRENGTH_CONFIG` | 72 keys |
| Liveness baseline `unproven` | 3 entries (mutation 1, static 1, corpus 1) |

**Harnesses** (`package.json`):
- `review:coaching` (`scripts/review-coaching.ts`) runs **7 steps**: coaching-review-round, foundation-review-round,
  `measure-goal-gap --gate`, `measure:envelope`, `review:cohort`, `audit:plans`, `measure:fitness`.
- `verify:ci` runs, among others: `test` (vitest, which gates `cohortShape.test.ts`, `planFitness.test.ts`,
  `invariantLiveness.test.ts`), `review:cohort`, `verify:invariants`, `verify:matrix`, `verify:sweep`
  (`property-validate-plans.ts`), `verify:strength`, `verify:rules`, `verify:coaching`, `audit:plans`, `check:clock`.
- **Not in `verify:ci`**: `verify:parity` (needs a baseline commit), `measure:fitness` / `cohort:shape` /
  `invariant:liveness` as scripts (their baselines are gated through vitest instead), `verify:strength:full`.
- `verify:parity` is blind to the adaptive engine (`runAdjustmentEngine` never called, per the contract).

**Corpora** (sizes and field presence from a tsx run of the real generators):

| Corpus | n | Production-shape gaps found |
|---|---|---|
| `cohortGrid()` | 41,472 | `age`, `resting_hr`, `max_hr` set on **every** row (product: age absent for skipped birth year; HR only with HealthKit); `terrain` 0, `day_budgets` 0, `foundation_decision` 0; `fitness_level` 0 (fixed per COHORT-GRID-UNSET-LEVEL-01) |
| `targetedGrid()` (core 6,144 + extra 26) | 6,170 | **`weeks_at_current_volume` set on 4,608**, a field no product path sends; age/HR always set; terrain 0 |
| `slowGoalGrid()` | 960 | benchmark on all; HR never set; age always set |
| `fullEnvelope()` | 33,792 | age/HR always set; `benchmark` 0; `terrain` 0; `days_cannot_train` 0 |
| Charity personas | 21 (15 charity + 6 engine) | set `weeks_at_current_volume`, `acknowledged_*` |
| `__fixtures__/real-inputs.json` | 4 cases, captured 2026-09-03 | the only production-captured inputs; age present on all 4 |
| `verify-parity.ts` grid | contract says 6,102 (not re-derived) | now iterates `user_declared_level` (line 358); CLAUDE.md's "parity grid is still level-set" is stale per backlog line 57 |

Across all six generated corpora: `training_style` and `motivation_type` are 0 (consistent with the product) and
**no corpus ever omits `age`**, while the contract records 16 of 56 live runners without one.

---

## 7. State (Supabase)

| Table | Written by | Read back into generation? |
|---|---|---|
| `plans` (`plan_json`, one row per user) | `savePlanForUser`; generate-plan `waitUntil` direct `.update()` | yes: `meta.generator_input` replayed by Modify (`DashboardClient → runModifyPreview` → `declaredVolumeEdit` + `withProfileHr` → `/api/generate-plan`); checkpoint reads stored plan; adjust/recalibrate/reshape load and mutate it |
| `plan_archive` | `savePlanForUser` on race change | no (data protection only) |
| `plan_weekly_notes` | AI weekly note route | deleted on every save |
| `session_overrides`, `session_metric_overrides` | client / move-swap | read-time overlay; feeds strength `RunContext` |
| `session_completions`, `run_analysis`, `session_reflections`, `weekly_reports`, `plan_adjustments` | various | `adjust-plan` reads completions + run_analysis; `recalibrate-taper` reads run_analysis; `maintenance-block` reads completions + `health_daily_samples`. These 7 are `WEEK_KEYED_TABLES` (`supersede.ts:75`), superseded on plan change |
| `post_race_reshapes` | post-race-reshape routes | confirm/revert |
| `strava_activities` (activity log) | ingest only | checkpoint reads weekly load via `fetchWeeklyLoad` |
| `user_settings` | profile | tier, units, HR, name read by routes before calling the engine |
| `strength_plans` (`plan_json`, `profile_json`, `run_context_sig`, `generated_at`) | strength routes | regenerated on GET when the run-context signature or engine changes |
| `strength_completions`, `strength_lift_logs` | strength routes | lift logs feed `suggestLoad`; recovery eases stored on `strength_plans` |

---

## Documents that disagree with the code (found while counting; not exhaustive)

- `docs/architecture/architecture.md` still describes Gist plan storage with a `plans` table "TODO", an AI
  (`claude-sonnet-4-6`) generator for paid plans, and a dark-mode toggle. The code has a `plans` table, one rule
  engine for every tier with AI as enrichment only, and no dark mode.
- `docs/contracts/engine.md`: 31 input fields / 25 optional vs 33 / 27 in `types/plan.ts`.
- `docs/contracts/strength-engine.md`: 40 S-codes vs 50 in `validate.ts`.
- ADR-016 names `getSessionForDate` in `lib/plan.ts`; the owner is `getSessionsForDate` in `lib/plan/weekResolution.ts`.
- CLAUDE.md: "139 invariants as of 2026-10-05" (now 171); "parity grid still level-set" (backlog says fixed
  2026-11-07); `PostRunScreen` (no such file); "free tier: no AI calls" vs `generateFreeIntro` on a free first plan.

## What this inventory does not prove

- Post-pass count (26) is by statement shape plus header comments, not a line-by-line read of 3,745 lines.
- "Read by nothing" uses whole-word grep, so it cannot see generic iteration over meta keys.
- I did not run any harness, test or the parity grid; corpus figures come from calling the generators only.
- Production field presence (beyond the 16/56 age figure quoted in the contract) was not queried.
- ADRs 009, 011, 020, 026 were read at heading and decision level only.
