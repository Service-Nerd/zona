# Plan Invariants — Constitutional Layer

This is the mechanical enforcement layer for `CoachingPrinciples.md`. Every rule
here corresponds to a section in the principles doc and is checked on every
generated plan via `lib/plan/invariants.ts → validatePlan()`.

**Authority chain:**
- Principle defined in `CoachingPrinciples.md`
- Numeric value defined in `lib/plan/generationConfig.ts → GENERATION_CONFIG`
- Mechanical check defined in `lib/plan/invariants.ts`
- Output verified by `validatePlan()` on every `generateRulePlan()` call

When all three layers agree, the engine is provably honouring its own
constitution. When the layers disagree, **the engine has a defect** —
not the principle.

## Enforcement

`generateRulePlan()` calls `validatePlan()` on its output:
- In `NODE_ENV=development` or `NODE_ENV=test`: **throws** on `error`-severity violations.
- In production: logs to `console.error` and returns the plan (failing soft for users).

The matrix script `scripts/r23-phase7-validation.ts` runs all archetype cases
under `NODE_ENV=test`, so any new violation breaks the matrix.

The property sweep `scripts/property-validate-plans.ts` generates plans across
a wide grid of inputs (race × fitness × days × volume × injuries × ...) and
runs `validatePlan()` on each. Designed to catch combinations no archetype covers.
Exit 1 on any violation.

## Active invariants

| Code | Principle Ref | Severity | What it checks |
|---|---|---|---|
| `INV-PLAN-MIN-SESSION-SIZE` | `CoachingPrinciples §9` | error | Every placed session ≥ `MIN_SESSION_DISTANCE_KM[type]`. Below this, "the session is too short to be coaching-meaningful." |
| `INV-PLAN-EMPTY-SESSION` | `CoachingPrinciples §9` | error | No session has both distance and duration zero. |
| `INV-PLAN-LONG-IS-LONGEST` | `CoachingPrinciples §9` | error | The long run is at least `LONG_RUN_MIN_RATIO_VS_EASY` × every easy run in the same week. |
| `INV-PLAN-LONG-CAP-MINS` | `CoachingPrinciples §9` | error | Long run duration ≤ `LONG_RUN_CAP_MINUTES[distance]`. |
| `INV-PLAN-WEEK-1-2-LONG-CAP` | `CoachingPrinciples §9` | error | First two weeks: long run ≤ `longest_recent_run × WEEK_1_2_LONG_RUN_CAP_MULTIPLIER` (or floor, whichever is higher). |
| `INV-PLAN-QUALITY-PER-WEEK` | `CoachingPrinciples §8` | error | Quality session count per week ≤ `QUALITY_SESSIONS_PER_WEEK_MAX[fitness]`. |
| `INV-PLAN-QUALITY-EXPECTED` | `CoachingPrinciples §1, §6, §8` | error | Build/peak/taper non-deload weeks with intermediate/experienced fitness and no quality suppression must place ≥ 1 quality session (unless every eligible day is blocked). Foundation weeks are exempt. Catches engines that derive fitness in one scope and ignore it in another. |
| `INV-PLAN-QUALITY-LONG-SPACING` | `CoachingPrinciples §7` | error | Quality session is at least `MIN_HOURS_BETWEEN_QUALITY_AND_LONG / 24` days from the long run. |
| `INV-PLAN-MAX-WEEKDAY-MINS` | Life-first | error | Every weekday session duration ≤ `input.max_weekday_mins` when the user has set one. |
| `INV-PLAN-RACE-SPECIFIC-EXPOSURE` (extended) | `CoachingPrinciples §22, §5` | error | *(existing per-week + ratio checks retained)* **Added 2026-08-20 (CD-18/SC-05):** a distance whose race pace is physiologically distinct from I-pace — 10K, HM, MARATHON — must OWN a `race_specific` catalogue session; the all-distance `goal_pace_sharpener` does not count. Checks availability, not presence, so it holds for every plan at those distances regardless of phase layout. 5K excluded (race pace ≈ I-pace) — an engineering judgement flagged for the board in §22. |
| `INV-PLAN-INTENSITY-DISTRIBUTION` | `CoachingPrinciples §1` | error | Plan-wide **quality-session share** ≤ `INTENSITY_DISTRIBUTION[distance].max_quality_session_pct`. **Sessions, plan-wide, ceiling** — see §1 for why all three words are load-bearing. Numerator excludes the §78 time trial (typed `hard` precisely so it does not count against `QUALITY_SESSIONS_PER_WEEK_MAX`) and the race (the goal, not training); denominator is running sessions only. Closes a four-month §34 gap: the table was declared in config, read by an offline script and by no engine code, and referenced by no invariant — which is why the *sessions vs minutes* basis error was invisible. **Skips `maintenance`-profile plans (CD-21):** a distribution ratio presupposes enough sessions to distribute, and at 2 runs/week it is undefined rather than breached — §52 already assigns the profile and emits the runner-facing note, and the skip is asserted in `intensityDistributionCd21.test.ts`. Scoped to this ceiling only: §7, §2, §9 and §45 stay binding on maintenance plans. **Ratified CD-21 (2026-08-20)** with 100K 12→15 — the six values were authored on a MINUTES basis and carried across the 2026-08-20 basis change unchanged; at 12% this ceiling and §8 were arithmetically incompatible for a 6-day 100K build plan (peak 2 quality/week = exactly `QUALITY_SESSIONS_PER_WEEK_MAX`) and §1 is the section that yielded. The earlier "verified against a 1,244,160-plan sweep" claim was void — see SWEEP-VACUOUS-01. |
| `INV-PLAN-MAIN-SET-ORDERING` | `CoachingPrinciples §8` | **warn** | A plan's largest VO2max **main set** must not exceed its largest threshold or race-pace main set by more than `MAIN_SET_ORDERING_TOLERANCE_MINS` (3). Compares main set, not session length — the warm-up floor makes session length a poor proxy — derived via `sessionFormat.mainSetMinutes` (single owner). **`warn` because the ordering is currently violated BY DESIGN:** the flat `QUALITY_SESSION_PCT_OF_WEEKLY` delivers 30–32 min VO2max main sets against 22–26 for race pace. Category-specific sizing was built and rejected by the sweep — share-of-weekly-volume cannot express this ordering, because every session scales with the week it sits in and VO2max sits in peak (see §8). Returns to `error` with SIZING-REALLOC-01. Tolerance grounded in `DISTANCE_ROUNDING_PRECISION_KM` (~2.3–2.6 min at quality pace), the same reasoning as §83's `INTENSITY_ORDERING_TOLERANCE_PCT`; calibration-checked so the original 6-minute inversion still fires. |
| `INV-PLAN-VO2MAX-ONSET` | `CoachingPrinciples §5` | error | For races ≤21km, the first VO2max session must leave ≥ `VO2MAX_ONSET_MIN_ADAPTATION_WEEKS` (5) weeks of build/peak before the taper. **Replaces a logged adjustment** — the engine used to record `V2-vo2max-onset-timing` against its own principle and generate the plan anyway, blaming a catalogue constraint that SC-07 removed; a principle the engine logs a violation against and then proceeds past is not a principle (§34 again). **Binding where reachable, recorded where not (CD-22):** below ~12 weeks the deadline falls in base phase where no quality exists, so the window is arithmetically unsatisfiable — and `5K.min_weeks` is 8, so those lengths are supported. There the plan carries `V2-vo2max-onset-unreachable` instead; the number is not lowered to 4 to force a pass, and generation does not throw. Same treatment as CD-20's withheld second quality and CD-21's maintenance exemption. Uses `classifyStimulus` from `sessionRole.ts` (single owner, INV-CLASS) rather than a fourth local label check. |
| `INV-PLAN-SECOND-QUALITY-MIN-DAYS` | `CoachingPrinciples §8, §9` | error | No week places more than one quality session when the runner's training days are below `MIN_TRAINING_DAYS_FOR_SECOND_QUALITY` (5). Derived from volume arithmetic, not preference: quality consumes 32.4% of weekly volume and easy is capped at `long / LONG_RUN_MIN_RATIO_VS_EASY`, so a 4-day week can only reach ~58% of the 67.6% it needs — an ~8% shortfall taken entirely out of the easy run. The engine records the withheld session as `rule_adjustments` entry `V8-second-quality-min-days` (CD-20 — a withheld session is a decision, not a silent absence). |
| `INV-PLAN-PHASE-FOCUS-REACHABLE` | `CoachingPrinciples §17` | error | Every category in `PLAN_SIGNATURES[distance].quality_categories_focus` must have ≥1 catalogue session eligible for that distance outside base phase. Catches a signature declaring a plan shape the catalogue cannot supply — the 10K signature declared `['vo2max','threshold']` while no threshold session was eligible for 10K, so the engine silently fell back to an aerobic row for the whole build phase. Checked per plan so an unreachable focus surfaces on the first plan generated for that distance rather than waiting for an audit. |
| `INV-PLAN-INTENSITY-ORDERING` | `CoachingPrinciples §83, §44` | error | **Cross-session** — the first invariant that compares sessions with *each other* rather than each against its own prescription. A Zone 3 session may not be prescribed faster than a Zone 4–5 session in the same plan, beyond `INTENSITY_ORDERING_TOLERANCE_PCT`. Does **not** forbid the inversion outright (the board's ruling is "reconcile it or surface it") — it forbids a plan being *silent* about one: `meta.goal_beyond_measured_fitness` must be set and `difficulty_band` must not read `comfortable`. Catches the case where an ambitious target pushes goal pace past derived interval pace, so the sessions labelled VO2max are prescribed slower than the sessions labelled race pace while carrying a wider HR band — a plan that cannot be executed as written by both pace and heart rate. **Corrected 2026-08-20:** an earlier note here recorded "the HR ladder is not checked against the pace ladder" as a known gap. It is not a gap. HR bands are a pure function of the zone (`qualityHR` is the Z3 band, `intervalsHR` is Z4→max), so the HR ladder **cannot invert** — it is structurally consistent with the zone labels by construction. Pace is the only quantity that can disagree with its own zone, because it derives from VDOT or a stated target rather than from the zone. An HR-vs-pace check would be a check that can never fire. The real residual gap, stated accurately: the invariant compares the *fastest* Z3 session against the *fastest* Z4–5 session and does not assert finer ordering *within* a band. |
| `INV-PLAN-LABEL-MATCHES-PACE` | `CoachingPrinciples §19, §10, §12` | error | A quality session's name must match its prescribed physiology, **in both directions**. Hard direction: a label implying VO2max requires Z4–Z5 and a pace within ±5% of vVO2max (raw VDOT); a label implying threshold/tempo/cruise requires Z3 and ±3% of T-pace (training anchor). **Easy direction (added 2026-08-20, CD-15/SC-02):** a label implying easy/steady/aerobic/recovery work must not appear on a session prescribed above Z2 — this is the case that shipped, where an aerobic catalogue row fell into a 5K/10K quality slot and was prescribed at T-pace as "Steady aerobic". The engine keys the rename on `catalogueRow.category` (structural); the invariant is label-based **only because the plan session carries no catalogue reference** — re-key on category when SC-08 lands. *Registry gap closed 2026-08-20: this invariant had existed in `invariants.ts` since R23 but was never listed here, so §34's "declared and exercised" rule was not actually satisfied for it.* |
| `INV-PLAN-PEAK-OVER-BASE` | `CoachingPrinciples §23` | error | For plans ≥ `PEAK_OVERLOAD_MIN_PLAN_WEEKS` weeks, peak volume must be ≥ `PEAK_OVER_BASE_RATIO` × W1, or plan flagged as `volume_profile: 'maintenance'`. W1 = first non-foundation week. Foundation weeks are excluded from the W1 baseline. |
| `INV-PLAN-DIFFICULTY-ANNOTATED` | `CoachingPrinciples §44` | error | Every generated plan carries `meta.difficulty_band ∈ {comfortable, demanding, very_demanding}`. Block-status inputs throw before plan construction, so any plan that exists must surface a demand label. Mirrors `INV-PLAN-PREP-TIME-STATUS-ANNOTATED`. |
| `INV-PLAN-DIFFICULTY-NEVER-FRONTS-UNSAFE` | `CoachingPrinciples §44` | error | The demand band may never under-state the plan's own honesty signals: (1) `prep_time_status: 'warned'` ⟹ band = `very_demanding`; (2) `compression_classification: 'constrained_by_inputs'` ⟹ band ≠ `comfortable`. Guarantees a friendly label can't front a warned timeline or an input-constrained plan (Coaching Board 2026-08-18). |
| `INV-PLAN-LR-PROGRESSION-CAP` | `CoachingPrinciples §45` | error | Week-on-week long run jump ≤ `LONG_RUN_PROGRESSION_CAP_PCT`% or `LONG_RUN_PROGRESSION_CAP_ABS_KM`, whichever is larger. Foundation → W1 boundary is exempt (foundation volume is deliberately low; the step-up to main plan is expected). |
| `INV-PLAN-COPY-MATCHES-SESSIONS` | `CoachingPrinciples §27, §41` | error | Week copy — **label and theme** — must not contradict its sessions. Asserts the rule (not a string denylist): copy naming an intensity/benchmark session requires one present; "highest volume / fitness is built" requires overload vs prior non-deload week; "feel(s) hard" requires an intensity or hard session. Foundation weeks are fully exempt. Supersedes the retired `INV-PLAN-THEME-MATCHES-PRESCRIPTION` (GEN-FIX-06 / incident N4, 2026-08-06), whose four-literal denylist missed cases like "Build — first quality session" over three easy runs. |
| `INV-PLAN-FOUNDATION-BLOCK` | `CoachingPrinciples §57` | error | Foundation weeks may only contain `easy`, `rest`, or `cross-train` sessions. Weekly volume must not exceed `current_weekly_km`. Volume increase within the block must not exceed `FOUNDATION_WEEKLY_INCREASE_PCT` (10%) per week. |

## Maintenance block invariants (MAINT-01)

Enforced by `validateMaintenanceBlock()` in `lib/plan/invariants.ts`, called from `generateMaintenanceBlock()`. Maintenance weeks are produced separately from the main plan (not by `generateRulePlan`) so these invariants do not run inside `validatePlan()` — `validatePlan()` skips any week with `phase === 'maintenance_restoration' | 'maintenance_base'`.

| Code | Principle ref | Severity | What it checks |
|---|---|---|---|
| `INV-MAINT-REST-DAY` | `CoachingPrinciples §64, §75` | error | Every maintenance week includes ≥1 rest day. Extends §64 to the post-race block. |
| `INV-MAINT-PHASE1-SESSION-TYPES` | `CoachingPrinciples §75` | error | Phase 1 (`maintenance_restoration`) weeks contain only `easy`, `rest`, or `cross-train`. Any quality/interval/tempo/long session is a violation. |
| `INV-MAINT-QUALITY-CAP` | `CoachingPrinciples §75` | error | Phase 2 (`maintenance_base`) weeks contain at most `PHASE2_QUALITY_PER_WEEK` (1) quality session. |
| `INV-MAINT-VOLUME-CEILING` | `CoachingPrinciples §75` | error | No maintenance week (Phase 1 or Phase 2) exceeds plan **base** volume (`VOLUME_CEILING_PCT_OF_BASE`, 100%). Re-anchored from plan-peak to base 2026-08-02 — the old 70%-of-peak model was "way too much" for a maintenance window. |
| `INV-MAINT-CADENCE` | `CoachingPrinciples §75` | error | No maintenance week schedules more run days/week than the athlete's real source cadence (conservative tick-over). Skipped when source cadence is unknown. |
| `INV-MAINT-INJURY-EASY-ONLY` | `CoachingPrinciples §75` | error | When `injury_history` is non-empty, no maintenance week contains a strides/quality session (detected by label — the mild-quality session is type `easy`). Layer 2. |
| `INV-MAINT-NO-RACE-SPECIFIC` | `CoachingPrinciples §75` | error | No `race_specific` or `ultra_specific` catalogue sessions permitted in any maintenance week. |
| `INV-MAINT-REENGAGEMENT-WINDOW` | `CoachingPrinciples §75 (Phase 3), §67` | error | The `reengagement` marker sits on exactly the **last `PHASE3_LAST_WEEKS` (2) Phase 2 weeks** — fewer only when Phase 2 is shorter — and on no Phase 1 week. This is what the CA-03 goal ladder gates on (MAINT-07), so a mis-marked window silently either re-opens the forward conversation mid-recovery or never opens it at all. Neither fails loudly, hence the mechanical check. |

## Reshape-time invariants

`validatePlan()` is the constitutional layer for *plan generation*. The
reshape engine (`lib/coaching/planAdjustment.ts → checkAdjustmentTriggers`)
operates on an already-generated plan and has its own structural contract
at the entry boundary:

| Code | Location | Severity | What it checks |
|---|---|---|---|
| **CHECK-RESHAPE-WEEK-LEN-7** | `checkAdjustmentTriggers` entry | throws | `currentWeekSessions.length === 7` AND every slot is a valid session object with a string `type` field. Catches the upstream defect where `Object.values(week.sessions)` returned a misaligned array because the plan's session keys were not stored in mon→sun insertion order. |

This invariant is intentionally a hard throw, not a logged warning. A
malformed week reaching the engine indicates either a) `plan_json` is
corrupted, or b) the caller is bypassing the canonical `DAY_ORDER.map` read.
Both demand visibility, not a silent degrade. The throw surfaces to the API
route's 500, which is exactly the diagnostic surface this class of bug
needs.

Full `validatePlan()` integration into the reshape *output* path
(verifying the proposed `sessionsAfter` honours the constitution before
the row is persisted) is deferred to Wave 3 of the reshape remediation
work — see backlog.

## Out of scope (deliberately)

**Week-on-week volume cap (`MAX_WEEKLY_VOLUME_INCREASE_PCT`).** This is enforced
by `buildVolumeSequence` on the planning array, but the per-week sum on the
plan output can deviate due to legitimate session-level floors (e.g. weeks 1-2
where `longest_recent × 1.10` collides with `MIN_SESSION_DISTANCE_KM.long`).
Output-level checking would produce false positives. The cap belongs at the
volume-sequence layer where it's already enforced.

## Adding a new invariant

0. **Has the Coaching Board ruled?** If this invariant encodes a *new or changed*
   coaching decision, the board rules on correctness first — `/coaching-board`,
   chaired by Hutchinson. If it mechanises a principle that already exists and is
   already agreed, proceed; you are closing an enforcement gap, not making a
   coaching decision. See ADR-017.
1. Identify the principle in `CoachingPrinciples.md`. If it's not there, write
   it first — INV-CFG-002 ("principle backstop").
2. Confirm the numeric lives in `GENERATION_CONFIG` (or a sibling config). If
   it's hardcoded, promote it first — INV-CFG-001 / N-013.
3. Add the check to `validatePlan()` with a `code`, `principle_ref`, and severity.
4. Add the row to the table above.
5. Run the matrix and the property sweep. Address any violations the new check surfaces.

**The three artifacts move together.** A coaching change is not complete until the
principle (`CoachingPrinciples.md`), the numeric (`GENERATION_CONFIG`), and the
mechanical check (here + `validatePlan()`) all land **in one commit** — INV-COACH-001.
This registry is where the third one is most often forgotten, which is why the
PostToolUse commit hook checks for it.

Where a principle genuinely cannot be mechanically checked, record that explicitly in
its `CoachingPrinciples.md` section rather than leaving a silent gap. An unenforceable
principle is a known risk; an undocumented one is a defect waiting to be discovered by
a runner.
