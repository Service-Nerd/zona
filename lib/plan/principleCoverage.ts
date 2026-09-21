// principleCoverage.ts — every coaching principle, and what checks it.
//
// WHY THIS EXISTS. `CoachingPrinciples.md` states 106 rules. `invariants.ts`
// enforces 61 of them. Nobody had counted, and nothing failed when a rule was
// written and never checked — §79's re-entry window sat unenforced for a month
// and the engine did the opposite of what it said, with a fully green suite.
//
// Per-commit hooks cannot close that: they see the DIFF, and a rule written in
// March is never in a diff again. Only a repo-wide gate sees the rules nobody
// touched. That gate is `principleCoverage.test.ts`; this file is its manifest.
//
// ⚠️ DELIBERATELY A MANIFEST, NOT A GREP. Inferring coverage from `§N` appearing
// in a test file was tried and produces BOTH false gaps and false confidence:
// §13 and §31 are genuinely covered by `userDeclaredLevel.test.ts` and
// `cohortShape.test.ts` without naming the section, while §11 and §97 "match"
// tests that merely mention them in passing. An explicit entry per principle is
// the only version that can be trusted, and the only one a reviewer can argue
// with.
//
// ⚠️ WHAT THE GATE PROVES, AND WHAT IT DOES NOT. It proves every principle is
// ACCOUNTED FOR — enforced, tested, exempt with a reason, or openly recorded as
// unverified. It does NOT prove a named check actually fails when the rule is
// broken. For invariants that second question has its own harness
// (`invariantLiveness.test.ts`, which breaks valid plans to see which rules
// wake); for plain tests there is no equivalent short of mutation testing.
// Stated here so a green gate cannot be read as more than it is — the same
// honesty §34 and the sweep baseline are written with.
//
// FOUR STATES:
//   invariant   — `validatePlan` enforces it. Checked on every generated plan,
//                 the 15,973-plan sweep, the coaching review, AND the daily
//                 audit over plans real runners hold. The strongest state.
//   test        — a named test file covers it. Verified by reading the test,
//                 never by grep.
//   exempt      — nothing in a generated plan can satisfy or breach it
//                 (a formula, a display convention, a meta-principle). Requires
//                 a written reason.
//   unverified  — DEBT, recorded rather than hidden. The gate baselines the
//                 count and fails if it GROWS, so the list can only shrink.
//                 Same pattern as SWEEP-BASELINE-01.

export type CoverageKind = 'invariant' | 'test' | 'exempt' | 'unverified'

export interface PrincipleCoverage {
  /** Section number in docs/canonical/CoachingPrinciples.md */
  readonly n: number
  readonly by: CoverageKind
  /** Invariant code, or test file path. Absent for exempt/unverified. */
  readonly ref?: string
  /** Mandatory for `exempt`; a note for `test`. */
  readonly why?: string
}

/**
 * The count of `unverified` entries permitted. It may FALL, never rise.
 * Lower it in the same commit that classifies one — that is how the debt is
 * locked in rather than drifting back.
 */
// ⚠️ RAISED 0 -> 1 on 2026-09-21, and a raised baseline should be argued for,
// not slipped in. §120 (HM-ANCHOR-VS-GOAL-01) was RATIFIED by the Coaching
// Board and DELIBERATELY NOT SHIPPED: the ruling is CORRECT WITH AMENDMENT on
// the anchor and INSUFFICIENT EVIDENCE on the amendment's bound, so the engine
// does not implement it yet. An invariant written today would fail on every
// generated plan, because the behaviour it checks for does not exist.
//
// `unverified` is the honest classification and `exempt` would be a lie: this
// is not a principle nothing can breach, it is one the engine currently
// breaches everywhere. The entry exists so the gap is counted rather than
// forgotten, which is the whole reason this manifest does.
//
// ⚠️ Lower it back to 0 in the commit that ships §120's numeric and invariant.
export const UNVERIFIED_BASELINE = 1

/**
 * Principles whose stated enforcer is an invariant that has NEVER BEEN PROVEN
 * ABLE TO FAIL — the gap that made "0 unverified" and "20 unproven" both true
 * at the same time, on 2026-09-15, without either number looking wrong.
 *
 * WHY THIS LIST EXISTS. `by: 'invariant'` asserts that a check EXISTS. It says
 * nothing about whether the check BITES, and this file's own header has said so
 * since it was written — in a comment, which is not a gate. On 2026-09-17 the
 * liveness debt register was worked down and the overlap was measured for the
 * first time: **11 of the 107 principles were counted as enforced by an
 * invariant that nothing could wake**, including §21 (no hill work for a
 * hill-restricting injury), §2 and §90 (the injury caps) and §26 (race week).
 * Every one of those 11 is now proven. This list is what stops it coming back.
 *
 * THE RULE:
 *   · An invariant sitting in the liveness baseline as `unclassified` — nobody
 *     has looked — may NEVER be a principle's coverage. That is a hard failure,
 *     because it is an undeclared gap wearing a green tick.
 *   · An invariant unproven for a DECLARED reason (`corpus`, `mutation`,
 *     `static`) may be, and lands here. The list may only SHRINK.
 *
 * The four below, and why each is tolerated rather than fixed:
 *   §17  INV-PLAN-PHASE-FOCUS-REACHABLE   `static`   — reads PLAN_SIGNATURES and
 *        the catalogue, never the plan, so a `Plan => void` mutation cannot
 *        reach it. Falsified independently by `thresholdReachable.test.ts`.
 *   §18  INV-INPUT-LONGEST-LE-WEEKLY      `mutation` — an INPUT-field rule; the
 *        battery mutates plans, not inputs.
 *   §67  INV-MAINT-REENGAGEMENT-WINDOW    `corpus`   — maintenance blocks have
 *   §75  INV-MAINT-REST-DAY               `corpus`     their own generator and
 *        are not built by the cohort grid at all.
 *
 * ⚠️ §67 and §75 are the visible edge of a bigger hole: NINE `INV-MAINT-*`
 * invariants are unproven for the same reason, and the maintenance generator has
 * no liveness corpus of its own. Filed as MAINT-LIVENESS-01.
 */
// §67 and §75 REMOVED 2026-09-19 (MAINT-LIVENESS-01). Both rested on
// `INV-MAINT-*` invariants that nothing had ever proven could fail, and the
// recorded reason — "the harness never builds this plan shape" — was wrong.
// Those invariants are checked by `validateMaintenanceBlock`; the liveness
// harness only ever called `validatePlan`, so no corpus could have woken them.
// All eight are now woken by a maintenance corpus plus its own mutation
// battery, which discharges these two sections' coverage debt for real rather
// than by re-describing it. 17 and 18 remain and are genuinely open.
export const UNPROVEN_INVARIANT_COVERAGE_BASELINE: readonly number[] = [17, 18]

export const PRINCIPLE_COVERAGE: readonly PrincipleCoverage[] = [
  { n: 1, by: 'invariant', ref: 'INV-PLAN-QUALITY-EXPECTED' },  // Polarised training — protection from grey zone
  { n: 2, by: 'invariant', ref: 'INV-PLAN-BOUNCEBACK-BOUNDED' },  // The 10% rule — injury prevention through gradual load
  { n: 3, by: 'invariant', ref: 'INV-PLAN-DELOAD-IS-A-REDUCTION' },  // Recovery weeks — adaptation happens in rest
  { n: 4, by: 'invariant', ref: 'INV-PLAN-PHASE-STRUCTURE' },  // Phase structure — base, build, peak, taper
  { n: 5, by: 'invariant', ref: 'INV-PLAN-PEAK-SPECIFICITY' },  // Specificity — sessions resemble race demands as race approac
  { n: 6, by: 'invariant', ref: 'INV-PLAN-QUALITY-EXPECTED' },  // Taper — maintain intensity, cut volume, never detrain
  { n: 7, by: 'invariant', ref: 'INV-PLAN-QUALITY-LONG-SPACING' },  // Hard / easy — never two hard days in a row
  { n: 8, by: 'invariant', ref: 'INV-PLAN-QUALITY-PER-WEEK' },  // Quality session frequency — fitness ceiling
  { n: 9, by: 'invariant', ref: 'INV-PLAN-MIN-SESSION-SIZE' },  // Long-run rules — fraction of weekly, capped by distance
  { n: 10, by: 'exempt', why: 'Algorithm formula (Daniels VDOT discount). INV-CFG-003 exempts formula constants; there is no plan property to assert.' },  // VDOT conservatism — protect users from themselves (selective
  { n: 11, by: 'exempt', why: 'Display convention (ranges not points), owned by lib/format.ts under ADR-015 — a formatting rule, not a prescription.' },  // Pace ranges, not points
  { n: 12, by: 'invariant', ref: 'INV-PLAN-EASY-RUN-ZONE-CAP' },  // Easy-run zone cap — Z2 ceiling
  { n: 13, by: 'test', ref: 'lib/plan/fitnessThresholds.test.ts', why: 'The three levels and where each boundary falls. §13\'s DERIVATION rule was superseded by §79 (dual-signal); what it still owns is the definition, and nothing asserted it.' },  // Fitness classification — VDOT first, volume fallback
  { n: 14, by: 'exempt', why: 'Zone FORMULAS (Karvonen / %MaxHR / Tanaka). Exempt for the same reason as §10 — arithmetic, not a coaching choice.' },  // HR zones — five zones, two formulas, one config
  { n: 15, by: 'test', ref: 'lib/plan/featureGates.test.ts', why: 'Option A tier semantics through `canUseFeature`, the place it is actually enforced. Not an invariant: validatePlan never sees a tier.' },  // Tier semantics — Option A: granted-at-trial, retained-in-fre
  { n: 16, by: 'invariant', ref: 'INV-PLAN-EFFORT-GOVERNED-DURATION-LOWER-BOUND' },  // Universal run format — every run has a shape
  { n: 17, by: 'invariant', ref: 'INV-PLAN-PHASE-FOCUS-REACHABLE' },  // Plan signatures — distance shapes the plan
  { n: 18, by: 'invariant', ref: 'INV-INPUT-LONGEST-LE-WEEKLY' },  // Blocked-day enforcement — life-first scheduling
  { n: 19, by: 'invariant', ref: 'INV-PLAN-LABEL-MATCHES-PACE' },  // Session label integrity — name matches prescribed physiology
  { n: 20, by: 'invariant', ref: 'INV-PLAN-VDOT-RAW-EXCEEDS-ANCHOR' },  // VDOT surface — auditable, table-comparable
  { n: 21, by: 'invariant', ref: 'INV-PLAN-INJURY-NO-HILLS' },  // Injury-aware session selection
  { n: 22, by: 'invariant', ref: 'INV-PLAN-RACE-SPECIFIC-EXPOSURE' },  // Race-specific exposure (time-targeted goals)
  { n: 23, by: 'invariant', ref: 'INV-PLAN-PEAK-OVER-BASE' },  // Peak overload requirement
  { n: 24, by: 'invariant', ref: 'INV-PLAN-PEAK-LR-RACE-RATIO' },  // Long-run race specificity (HM and marathon)
  { n: 25, by: 'invariant', ref: 'INV-PLAN-RACE-SPECIFIC-LONG-RUN' },  // Race-specific long run (HM and marathon, time-targeted)
  { n: 26, by: 'invariant', ref: 'INV-PLAN-RACE-WEEK-SHARPENING' },  // Race-week sharpening (not tempo)
  { n: 27, by: 'invariant', ref: 'INV-PLAN-COPY-MATCHES-SESSIONS' },  // Theme matches prescription
  { n: 28, by: 'invariant', ref: 'INV-PLAN-STRIDES-PRESENT', why: 'Exactly one stride note per qualifying week, on an easy run, never beside the long run or after quality. §28\'s "Wed preferred" is a PREFERENCE (146,732 divergences on a 3-day week) and is deliberately not asserted. foundationOnRamp.test.ts keeps the foundation half.' },  // Strides on midweek easy
  { n: 29, by: 'invariant', ref: 'INV-PLAN-FRESH-RETURN-GATE', why: 'The gate fires exactly when the input says it should. The 70% start fraction is pinned by freshReturnGate.test.ts — three later rules squeeze week 1, so an invariant on the fraction would fail correct plans.' },  // Fresh-from-layoff detection
  { n: 30, by: 'invariant', ref: 'INV-PLAN-RACE-WEEK-SHAKEOUT-CAP', why: '35-minute cap and RPE <= 3. §26\'s invariant bans the wrong session TYPES in race week; nothing capped the shakeout\'s own size.' },  // Race-week shakeout cap and strides
  { n: 31, by: 'invariant', ref: 'INV-PLAN-COMPRESSION-CLASSIFICATION', why: 'The three modes, plus the §44 link §31 held with a comment: constrained_by_inputs may never front as comfortable.' },  // Compression classification — three modes
  { n: 32, by: 'invariant', ref: 'INV-PLAN-TUNE-UP-CALLOUT' },  // Tune-up race callout
  { n: 33, by: 'invariant', ref: 'INV-PLAN-COACH-NOTES-MATCH-INTENT' },  // Coach notes by session intent
  { n: 34, by: 'exempt', why: 'Meta-principle ABOUT the invariant registry itself. Asserting it would be the registry checking it exists.' },  // Invariant registry — declared and exercised
  { n: 35, by: 'test', ref: 'lib/plan/peakLrEarnedTier.test.ts', why: '§35 Amendment 1 (Coaching Board, LR-EARNED-TIER-01) rules the tier is a SIZING floor, so a delivered-tier invariant asserts a promise §35 does not make — INV-PLAN-PEAK-LR-EARNED-TIER was retired. The test pins the half that IS observable (the target lift moves the peak long run in 33 of 36 plans), that §24\'s floor still holds, and that PEAK_LR_RATIO_STRETCH is inert in 0 of 36 rather than letting that fact go unrecorded.' },  // Persona-aware prescriptions — floors are minimums, not targe
  { n: 36, by: 'invariant', ref: 'INV-PLAN-TAPER-VARIETY' },  // Taper quality variety
  { n: 37, by: 'invariant', ref: 'INV-PLAN-FRESH-RETURN-GATE', why: 'Same gate as §29, OR-ed. The heuristic AND-gate is pinned arm by arm in freshReturnGate.test.ts.' },  // Fresh-return heuristic — infer from input shape
  { n: 38, by: 'test', ref: 'lib/plan/maintenanceNotePrescriptive.test.ts', why: 'Diagnosis AND prescription, and the test that matters: change the named input and the profile flips to build. Not an invariant because the injury+beginner producer correctly offers no remedy.' },  // Volume constraint notes are prescriptive
  { n: 39, by: 'invariant', ref: 'INV-PLAN-NO-RACE-EVE-SESSION' },  // Race-week mid-week easy run for HM/marathon
  { n: 40, by: 'invariant', ref: 'INV-PLAN-STRUCTURED-OVERRUN-DECLARED' },  // 5K finish-goal long-run cap
  { n: 41, by: 'invariant', ref: 'INV-PLAN-EFFORT-OR-PACE' },  // Effort copy matches the work prescribed
  { n: 42, by: 'invariant', ref: 'INV-PLAN-VDOT-STALENESS-LADDER', why: 'The stamped discount is a legal rung of §42\'s ladder, and an undated benchmark gets the base. Asserts the rung, not the date arithmetic — validatePlan has no clock. vdotStaleness.test.ts still pins the ladder itself.' },  // VDOT staleness compounds
  { n: 44, by: 'invariant', ref: 'INV-PLAN-PREP-TIME-STATUS-ANNOTATED' },  // Prep-time validation — refusal mechanism
  { n: 45, by: 'invariant', ref: 'INV-PLAN-LR-PROGRESSION-CAP' },  // Long-run progression cap (universal, no phase exemption)
  { n: 46, by: 'invariant', ref: 'INV-PLAN-PEAK-VOLUME-FLOOR-LONG-RACES' },  // Peak weekly volume floor for marathon and ultra
  { n: 47, by: 'invariant', ref: 'INV-PLAN-PEAK-LR-ALTERNATION' },  // Peak long-run alternation
  { n: 49, by: 'invariant', ref: 'INV-PLAN-TAPER-DURATION-CAP' },  // Taper duration cap
  { n: 50, by: 'invariant', ref: 'INV-PLAN-HR-ASSUMPTIONS-SURFACED' },  // HR data fallbacks (assumption surfacing)
  { n: 51, by: 'invariant', ref: 'INV-PLAN-RETURNING-RUNNER-NOTE-PRESENT' },  // Returning-runner allowance must be communicated
  { n: 52, by: 'invariant', ref: 'INV-PLAN-LR-MAX-WEEKLY-PCT' },  // Long run not more than 60% of weekly volume
  { n: 53, by: 'invariant', ref: 'INV-PLAN-LABEL-MATCHES-STRUCTURE' },  // Quality session variety across the full plan
  { n: 55, by: 'test', ref: 'lib/plan/inputRanges.test.ts', why: 'Runs BEFORE generation and its point is that no plan exists — validatePlan only ever sees inputs that already passed, so an invariant could not fail.' },  // Critical input validation — reject nonsense values
  { n: 56, by: 'exempt', why: 'Meta-principle describing the constitution document. Nothing in a generated plan can satisfy or breach it.' },  // The constitution
  { n: 57, by: 'invariant', ref: 'INV-PLAN-FOUNDATION-BLOCK' },  // Foundation Block
  { n: 58, by: 'test', ref: 'lib/coaching/cohortSimilarity.test.ts', why: 'The two-axis match (distance band + HR band), the self-exclusion, and the refusal to summarise an empty cohort. Reads run HISTORY, which no generated plan contains.' },  // Past-self comparison — cohort similarity matching
  { n: 59, by: 'test', ref: 'lib/coaching/readinessBaseline.test.ts', why: 'Readiness is computed from RHR/HRV/sleep AFTER the fact — it is not a property of a plan, so validatePlan has nothing to read. `isPoorSleepQuality` and the baseline thresholds are pinned here; the composite is exercised through athleteContext.test.ts.' },  // Pre-session readiness — composite RHR / HRV / sleep signal
  { n: 60, by: 'test', ref: 'lib/coaching/reframeCohort.test.ts', why: 'post-run reframe voice + cohort' },  // Post-run reframe — the hug AND the truth
  { n: 61, by: 'test', ref: 'lib/coaching/limiter.test.ts', why: '`inferLimiter` — names the physiological cause, with the §71 silence guards pinned. Post-run analysis, not a plan property.' },  // Limiter hypothesis — naming the physiological cause
  { n: 62, by: 'test', ref: 'lib/coaching/postRaceRecoveryCurve.test.ts', why: 'The per-distance volume curve and the quality blackout, applied to a real plan. Reshapes an existing plan against a logged result, so validatePlan cannot reach it.' },  // Post-race recovery — structured return to training (AI-DEPTH
  { n: 63, by: 'exempt', why: 'Session intent lives in the `session_guidance` Supabase table (one row per session type), not in a generated plan. validatePlan takes a Plan and has nothing to read; the copy is governed by brand.md\'s voice rules.' },  // Session intent — every type explains its place in the week
  { n: 64, by: 'invariant', ref: 'INV-PLAN-WEEK-HAS-REST-DAY' },  // Day-level rest — every training week needs at least one rest
  { n: 65, by: 'test', ref: 'lib/coaching/dayBoundary.test.ts', why: 'today is in flight until midnight' },  // Day boundary — today is in flight until midnight
  { n: 66, by: 'invariant', ref: 'INV-PLAN-LONG-RUN-HAS-AN-AXIS' },  // Long-run shortfall — match the prescription to where the run
  { n: 67, by: 'invariant', ref: 'INV-MAINT-REENGAGEMENT-WINDOW' },  // Post-race goal ladder — the next line is the engine\s call, 
  { n: 68, by: 'test', ref: 'lib/plan/taperRecalibration.test.ts', why: 'Four silent gates (entry week, idempotency, data floor, downward-only) plus the top-N functional peak. Reads completed training, not a generated plan.' },  // Taper recalibration — re-anchor to the body that actually tr
  { n: 69, by: 'test', ref: 'lib/coaching/reshapeMagnitude.test.ts', why: '`computeReshapeMagnitude` — always-high triggers, the structural diff, and the sub-threshold trims that stay silent (ADR-012).' },  // Magnitude calibration — the structural change that earns con
  { n: 70, by: 'test', ref: 'lib/planDateWindow.test.ts', why: '`isPlanComplete` / `isDateWithinWeek` / `isDatePastWeek` — §70.1, the plan can end. §70.2\'s race-debrief framing is prompt copy, covered by sessionFeedback.test.ts.' },  // Plan\s over, and a race is debriefed — not scored
  { n: 71, by: 'test', ref: 'lib/coaching/limiter.test.ts', why: 'limiter naming in the debrief' },  // A goal race is debriefed *with* the athlete — every surface,
  { n: 72, by: 'test', ref: 'lib/coaching/prompts/sessionFeedback.test.ts', why: 'All three surfaces §72 names: the feedback and reframe prompts drop the fade citation (sessionFeedback.test.ts, sessionReframe.test.ts) and the limiter returns null at the ultra threshold (limiter.test.ts).' },  // An ultra effort is read as time-on-feet — never scored on fa
  { n: 73, by: 'test', ref: 'lib/planDateWindow.test.ts', why: 'date-window, never an index compare' },  // "Are we past plan-week N?" is a date-window question — never
  { n: 74, by: 'test', ref: 'lib/plan/raceResultWriteBoundary.test.ts', why: 'A source-order test, and the file says why: the claim is about ORDER inside one route handler with no pure function to assert against. Catches the regression that happened: the write moving behind the optional reshape.' },  // A logged race result persists on submit — the reshape never 
  { n: 75, by: 'invariant', ref: 'INV-MAINT-REST-DAY' },  // Post-race maintenance block — protecting the recovery window
  { n: 76, by: 'invariant', ref: 'INV-PLAN-COVERS-RACE-DATE' },  // The plan is anchored to race day, not to the start date
  { n: 77, by: 'invariant', ref: 'INV-PLAN-RACE-ON-RACE-DAY' },  // The race sits on race day, and race week builds towards it
  { n: 78, by: 'invariant', ref: 'INV-PLAN-COACH-NOTES-MATCH-INTENT' },  // Recalibration weeks prescribe the benchmark, they don\t just
  { n: 79, by: 'invariant', ref: 'INV-PLAN-RETURNING-INTENSITY-REENTRY' },  // Fitness level — VDOT and volume answer different questions
  { n: 80, by: 'invariant', ref: 'INV-PLAN-DURATION-ANCHORED-KEEPS-MINUTES' },  // Finish-goal long run — time on feet, not distance
  { n: 81, by: 'invariant', ref: 'INV-PLAN-STRUCTURED-OVERRUN-DECLARED' },  // Structured sessions are exempt from the weekday cap — and th
  { n: 82, by: 'invariant', ref: 'INV-PLAN-EASY-FLOOR-PROTECTION-DECLARED' },  // Easy runs are floor-protected against the weekday cap
  { n: 83, by: 'invariant', ref: 'INV-PLAN-INTENSITY-ORDERING' },  // Sessions must be coherent with each other, not only with the
  { n: 84, by: 'invariant', ref: 'INV-PLAN-DISPLAY-ZONE-MATCHES-WORK' },  // Displayed zone and HR derive from prescribed work — one sour
  { n: 85, by: 'invariant', ref: 'INV-PLAN-OVER-UNDER-MEAN-NEAR-THRESHOLD' },  // Intensity has an inventory, or the runner\s answer means not
  { n: 86, by: 'invariant', ref: 'INV-PLAN-STRUCTURED-SESSION-DURATION-COHERENT' },  // A fixed-shape session still owes the runner a dose and an ho
  { n: 87, by: 'invariant', ref: 'INV-PLAN-DELOAD-PLACEMENT' },  // A recovery week must not open a phase
  { n: 88, by: 'invariant', ref: 'INV-PLAN-VO2MAX-FLOAT-IS-A-CEILING', why: 'Seiler\'s condition: the float is a ceiling, and intervals_rolling\'s is run rather than jogged. The DOSE half of §88 is the existing VO2MAX_WORK band, now cross-referenced from it.' },  // The VO2max pool owes dose granularity and a continuous shape
  { n: 89, by: 'invariant', ref: 'INV-PLAN-EARLY-ONSET-GATED' },  // Experience-gated quality onset — a demonstrated base earns a
  { n: 90, by: 'invariant', ref: 'INV-PLAN-INJURY-CAP-DELIVERED' },  // A recovery week reduces, and the injury cap holds at deliver
  { n: 91, by: 'invariant', ref: 'INV-PLAN-ONRAMP-FLOOR' },  // The on-ramp is counted in weeks the runner runs, not weeks i
  { n: 92, by: 'invariant', ref: 'INV-PLAN-FOUNDATION-BLOCK', why: 'Foundation strides require the §89 gate and are vetoed outright by any injury history. §92\'s own text claimed this invariant already enforced it; grepped 2026-09-15, it did not — the producer gated correctly and the checker was never written.' },  // A demonstrated runner\s foundation block may carry strides
  { n: 93, by: 'invariant', ref: 'INV-PLAN-PEAK-SPECIFICITY' },  // Peak rehearses the race — the specificity ladder is enforced
  { n: 94, by: 'invariant', ref: 'INV-PLAN-DELIVERED-RAMP' },  // §2 is measured at delivery for every runner, not only the in
  { n: 95, by: 'invariant', ref: 'INV-PLAN-DELOAD-PHASE-POSITION' },  // A recovery week must not fall on a phase\s second week eithe
  { n: 96, by: 'invariant', ref: 'INV-PLAN-OVERDO-BRAKE' },  // `overdo` is a brake, not a preference
  { n: 97, by: 'invariant', ref: 'INV-PLAN-SURPLUS-IN-PLAN', why: 'No unrequested foundation block while the plan has headroom, and never past max_weeks. WIDENED 2026-09-16 (§97 Am.): the headroom is granted on SURPLUS, not on §89 — the gate check is gone. warn at 0.03%: the compose-time gap is a value generation never had. earlyQualityOnset.test.ts still covers Amendment 1; planLength.test.ts covers the widened scope.' },  // A demonstrated runner\s surplus weeks belong inside the plan
  { n: 98, by: 'invariant', ref: 'INV-PLAN-ONSET-YIELD-BOUNDED' },  // §89\s onset is granted only as far as §1 permits
  { n: 99, by: 'invariant', ref: 'INV-PLAN-STRUCTURED-SESSION-DURATION-COHERENT', why: '§99 IS this check — the principle written when hm_pace_intervals stated 45 minutes for a session needing over 70. Cross-referenced rather than given a second invariant: two checks asserting one property is D-16.' },  // A session states the length its own structure needs
  { n: 100, by: 'invariant', ref: 'INV-PLAN-DELIVERED-RAMP' },  // A safety trim must not hand its deficit to the next week
  { n: 101, by: 'invariant', ref: 'INV-PLAN-COMPRESSION-SPLIT', why: 'Both fields stamped, and the deprecated `compressed` stays the OR rather than drifting back into being the authority.' },  // `compressed` means two different things, so it is two fields
  { n: 102, by: 'test', ref: 'lib/coaching/qualityDowngrade.test.ts', why: '`recordQualityDowngrade` — the exemption keys on a recorded reason, and an unrelated trigger still violates.' },  // An intentional downgrade is not a missing session
  { n: 103, by: 'test', ref: 'lib/coaching/recalibrationPrompt.test.ts', why: '`nextRecalibrationDue` (ADR-014) — the prompt fires only on a completed recalibration-week time trial, never on a non-TT day. Prompt timing, not a plan property.' },  // Fitness signal — benchmark recalibration prompt (ENGINE-01)
  { n: 104, by: 'invariant', ref: 'INV-PLAN-RACE-SPECIFIC-VARIETY' },  // A peak rehearses the race more than one way
  { n: 105, by: 'invariant', ref: 'INV-PLAN-MARATHON-RACE-PACE-NOT-ONLY-LONG-RUN' },  // Marathon pace must exist away from the long run
  { n: 106, by: 'invariant', ref: 'INV-PLAN-PEAK-NOT-BELOW-START', why: 'Peak vs the runner\'s STATED volume. The 2026-09-16 Amendment (plan may not fall below its OWN week 1) is enforced separately by INV-PLAN-NOT-DETRAINING -- the two reference points differ and overlap on only 5.8% of plans.' },  // A plan never peaks below where the runner already is
  { n: 107, by: 'invariant', ref: 'INV-PLAN-LR-SEGMENT-RECORDED' },  // A session may not prescribe work it does not record
  { n: 108, by: 'test', ref: 'lib/coaching/sessionScore.test.ts', why: 'Amendment 1 — no composite score when HR is unmeasured; pinned on the founder\'s own HR-less run' },  // What a run SCORES, and what stays outside the score
  { n: 109, by: 'test', ref: 'lib/coaching/raceProjectionHonesty.test.ts', why: 'may compare, may not predict' },  // A progress surface may remember and compare. It may not predict.
  { n: 110, by: 'invariant', ref: 'INV-PLAN-QUALITY-NOT-ZERO' },  // `avoid` is a floor, not a switch
  { n: 111, by: 'invariant', ref: 'INV-PLAN-BASE-BUILD-RATIO', why: 'The engine refuses over the ceiling (BaseVolumeError), so the invariant is the defense-in-depth backstop; both read lib/plan/baseVolume.ts. Refusal + backstop exercised by baseVolume.test.ts.' },  // The base-build ceiling
  { n: 112, by: 'test', ref: 'lib/coaching/fatigueAccumulation.test.ts', why: 'Coaching-time mechanism: it reads session_completions and never appears in a plan, so no Plan => Violation[] can reach it by construction (the `static` class the liveness baseline records). §112 also RATIFIES a rule that ran for a year citing a §R20-T4 that does not exist, while §70 and the recalibration trigger both depended on it.' },  // Fatigue accumulation — consecutive reported cost softens the long run; a 'Too tired' skip counts
  { n: 113, by: 'test', ref: 'lib/plan/longRunReadiness.test.ts', why: 'Refuses BEFORE a plan exists, so there is no Plan for validatePlan() to inspect — same structural class as §112. Unlike the route gate it replaced, it throws from the engine so the sweep sees it.' },  // Long-run readiness — a plan must have something to build FROM
  { n: 114, by: 'invariant', ref: 'INV-PLAN-LR-MAX-WEEKLY-PCT' },  // The long run fits its week — DELIBERATELY the same invariant as §52. §114's number IS §52's 60%, and its observable consequence is exactly what that invariant asserts. What §114 changes is WHICH SIDE gives (the long run yields, the week is not raised); the check is the same either way.
  { n: 116, by: 'invariant', ref: 'INV-PLAN-ONRAMP-CURVE-CLIMBS' },  // The base-build on-ramp. ⚠️ The invariant covers the CURVE (it climbs, and it does not hand over on a deload). It does NOT cover §116's 0% acute step into week 1 — that compares a plan to an input outside it and is recorded in §116 as a known enforcement gap, not left to be discovered.
  { n: 117, by: 'invariant', ref: 'INV-PLAN-RUNWALK-PRESCRIBED' },  // Finish-goal run-walk marathon. The invariant covers amendment 3 (the interval is PRESCRIBED on every running session), which is the whole safety argument for the lower door. It does NOT cover the peak value itself (amendment 1) — that is a config numeric governed by configPrincipleSync, not a property of a generated plan.  // §117 Am.2 is enforced by INV-PLAN-RUNWALK-ADEQUATE (same section).
  { n: 118, by: 'invariant', ref: 'INV-PLAN-GET-RUNNING-BUILD-RATIO' },
  { n: 119, by: 'invariant', ref: 'INV-PLAN-MIN-LOADING-BLOCK' },  // A loading block is never one week. ⚠️ The invariant CHECKS it; `computeDeloadWeeks` does NOT enforce it, by board ruling — brute force over all 220 deload placements on the 18-week marathon found 0 satisfying the full constraint set and exactly 2 satisfying everything but a THREE-week floor, neither reachable by §87's greedy re-anchor. So the severity is `warn` and the producer change is registered debt (DELOAD-PLAN-OPENING-01, filed 2026-09-21). Measured firing rate at ratification: 26.3% of cohort plans, 33.3% of the targeted grid, 100% of them the plan's OPENING block.  // The get-running plan. ⚠️ The invariant covers the TOTAL BUILD ceiling (amendment 2) — the §2 blind spot this section exists to close. It does not cover the plan's ADEQUACY, because a plan with no race has no adequacy bar to hold it to, which is also why no harness watches this plan kind.
  { n: 120, by: 'unverified',
    why: 'RATIFIED, NOT SHIPPED (Coaching Board 2026-09-21, HM-ANCHOR-VS-GOAL-01). '
       + 'On a time-target plan the HM anchor must resolve to GOAL pace, as T has since '
       + '2026-09-03 and as the sibling mp_blocks row already does. The engine does not do '
       + 'this yet, so there is nothing for an invariant to pass on. Blocked on ONE number: '
       + 'RACE_PACE_ANCHOR_MAX_STRETCH_PCT, Willy\'s bound, which must be MEASURED rather '
       + 'than chosen because a 15% bound costs 27% of these sessions their row and presses '
       + 'on §22\'s own 50% floor. Both obvious gates were examined and rejected: '
       + 'goalBeyondMeasuredFitness tests against INTERVAL pace, and difficulty_band is '
       + 'forbidden by §44 point 3. Ships with INV-PLAN-RACE-ANCHOR-MATCHES-GOAL and '
       + 'INV-PLAN-HEADER-PACE-MATCHES-WORK; lower UNVERIFIED_BASELINE to 0 in that commit.' },
] as const
