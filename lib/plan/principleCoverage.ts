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
export const UNVERIFIED_BASELINE = 29

export const PRINCIPLE_COVERAGE: readonly PrincipleCoverage[] = [
  { n: 1, by: 'invariant', ref: 'INV-PLAN-QUALITY-EXPECTED' },  // Polarised training — protection from grey zone
  { n: 2, by: 'invariant', ref: 'INV-PLAN-BOUNCEBACK-BOUNDED' },  // The 10% rule — injury prevention through gradual load
  { n: 3, by: 'invariant', ref: 'INV-PLAN-DELOAD-IS-A-REDUCTION' },  // Recovery weeks — adaptation happens in rest
  { n: 4, by: 'unverified' },  // Phase structure — base, build, peak, taper
  { n: 5, by: 'invariant', ref: 'INV-PLAN-PEAK-SPECIFICITY' },  // Specificity — sessions resemble race demands as race approac
  { n: 6, by: 'invariant', ref: 'INV-PLAN-QUALITY-EXPECTED' },  // Taper — maintain intensity, cut volume, never detrain
  { n: 7, by: 'invariant', ref: 'INV-PLAN-QUALITY-LONG-SPACING' },  // Hard / easy — never two hard days in a row
  { n: 8, by: 'invariant', ref: 'INV-PLAN-QUALITY-PER-WEEK' },  // Quality session frequency — fitness ceiling
  { n: 9, by: 'invariant', ref: 'INV-PLAN-MIN-SESSION-SIZE' },  // Long-run rules — fraction of weekly, capped by distance
  { n: 10, by: 'exempt', why: 'Algorithm formula (Daniels VDOT discount). INV-CFG-003 exempts formula constants; there is no plan property to assert.' },  // VDOT conservatism — protect users from themselves (selective
  { n: 11, by: 'exempt', why: 'Display convention (ranges not points), owned by lib/format.ts under ADR-015 — a formatting rule, not a prescription.' },  // Pace ranges, not points
  { n: 12, by: 'unverified' },  // Easy-run zone cap — Z2 ceiling
  { n: 13, by: 'unverified' },  // Fitness classification — VDOT first, volume fallback
  { n: 14, by: 'exempt', why: 'Zone FORMULAS (Karvonen / %MaxHR / Tanaka). Exempt for the same reason as §10 — arithmetic, not a coaching choice.' },  // HR zones — five zones, two formulas, one config
  { n: 15, by: 'unverified' },  // Tier semantics — Option A: granted-at-trial, retained-in-fre
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
  { n: 28, by: 'test', ref: 'lib/plan/foundationOnRamp.test.ts', why: 'strides inside the foundation block' },  // Strides on midweek easy
  { n: 29, by: 'unverified' },  // Fresh-from-layoff detection
  { n: 30, by: 'test', ref: 'lib/plan/shakeoutExemption.test.ts', why: 'race-week shakeout cap' },  // Race-week shakeout cap and strides
  { n: 31, by: 'unverified' },  // Compression classification — three modes
  { n: 32, by: 'unverified' },  // Tune-up race callout
  { n: 33, by: 'invariant', ref: 'INV-PLAN-COACH-NOTES-MATCH-INTENT' },  // Coach notes by session intent
  { n: 34, by: 'exempt', why: 'Meta-principle ABOUT the invariant registry itself. Asserting it would be the registry checking it exists.' },  // Invariant registry — declared and exercised
  { n: 35, by: 'test', ref: 'lib/plan/overdoBrake.test.ts', why: 'persona floors via the overdo brake' },  // Persona-aware prescriptions — floors are minimums, not targe
  { n: 36, by: 'invariant', ref: 'INV-PLAN-TAPER-VARIETY' },  // Taper quality variety
  { n: 37, by: 'unverified' },  // Fresh-return heuristic — infer from input shape
  { n: 38, by: 'unverified' },  // Volume constraint notes are prescriptive
  { n: 39, by: 'invariant', ref: 'INV-PLAN-NO-RACE-EVE-SESSION' },  // Race-week mid-week easy run for HM/marathon
  { n: 40, by: 'invariant', ref: 'INV-PLAN-STRUCTURED-OVERRUN-DECLARED' },  // 5K finish-goal long-run cap
  { n: 41, by: 'invariant', ref: 'INV-PLAN-EFFORT-OR-PACE' },  // Effort copy matches the work prescribed
  { n: 42, by: 'unverified' },  // VDOT staleness compounds
  { n: 44, by: 'invariant', ref: 'INV-PLAN-PREP-TIME-STATUS-ANNOTATED' },  // Prep-time validation — refusal mechanism
  { n: 45, by: 'invariant', ref: 'INV-PLAN-LR-PROGRESSION-CAP' },  // Long-run progression cap (universal, no phase exemption)
  { n: 46, by: 'invariant', ref: 'INV-PLAN-PEAK-VOLUME-FLOOR-LONG-RACES' },  // Peak weekly volume floor for marathon and ultra
  { n: 47, by: 'invariant', ref: 'INV-PLAN-PEAK-LR-ALTERNATION' },  // Peak long-run alternation
  { n: 49, by: 'invariant', ref: 'INV-PLAN-TAPER-DURATION-CAP' },  // Taper duration cap
  { n: 50, by: 'invariant', ref: 'INV-PLAN-HR-ASSUMPTIONS-SURFACED' },  // HR data fallbacks (assumption surfacing)
  { n: 51, by: 'invariant', ref: 'INV-PLAN-RETURNING-RUNNER-NOTE-PRESENT' },  // Returning-runner allowance must be communicated
  { n: 52, by: 'invariant', ref: 'INV-PLAN-LR-MAX-WEEKLY-PCT' },  // Long run not more than 60% of weekly volume
  { n: 53, by: 'invariant', ref: 'INV-PLAN-LABEL-MATCHES-STRUCTURE' },  // Quality session variety across the full plan
  { n: 55, by: 'unverified' },  // Critical input validation — reject nonsense values
  { n: 56, by: 'exempt', why: 'Meta-principle describing the constitution document. Nothing in a generated plan can satisfy or breach it.' },  // The constitution
  { n: 57, by: 'invariant', ref: 'INV-PLAN-FOUNDATION-BLOCK' },  // Foundation Block
  { n: 58, by: 'unverified' },  // Past-self comparison — cohort similarity matching
  { n: 59, by: 'unverified' },  // Pre-session readiness — composite RHR / HRV / sleep signal
  { n: 60, by: 'test', ref: 'lib/coaching/reframeCohort.test.ts', why: 'post-run reframe voice + cohort' },  // Post-run reframe — the hug AND the truth
  { n: 61, by: 'unverified' },  // Limiter hypothesis — naming the physiological cause
  { n: 62, by: 'unverified' },  // Post-race recovery — structured return to training (AI-DEPTH
  { n: 63, by: 'unverified' },  // Session intent — every type explains its place in the week
  { n: 64, by: 'invariant', ref: 'INV-PLAN-WEEK-HAS-REST-DAY' },  // Day-level rest — every training week needs at least one rest
  { n: 65, by: 'test', ref: 'lib/coaching/dayBoundary.test.ts', why: 'today is in flight until midnight' },  // Day boundary — today is in flight until midnight
  { n: 66, by: 'invariant', ref: 'INV-PLAN-LONG-RUN-HAS-AN-AXIS' },  // Long-run shortfall — match the prescription to where the run
  { n: 67, by: 'invariant', ref: 'INV-MAINT-REENGAGEMENT-WINDOW' },  // Post-race goal ladder — the next line is the engine\s call, 
  { n: 68, by: 'unverified' },  // Taper recalibration — re-anchor to the body that actually tr
  { n: 69, by: 'unverified' },  // Magnitude calibration — the structural change that earns con
  { n: 70, by: 'unverified' },  // Plan\s over, and a race is debriefed — not scored
  { n: 71, by: 'test', ref: 'lib/coaching/limiter.test.ts', why: 'limiter naming in the debrief' },  // A goal race is debriefed *with* the athlete — every surface,
  { n: 72, by: 'unverified' },  // An ultra effort is read as time-on-feet — never scored on fa
  { n: 73, by: 'test', ref: 'lib/planDateWindow.test.ts', why: 'date-window, never an index compare' },  // "Are we past plan-week N?" is a date-window question — never
  { n: 74, by: 'unverified' },  // A logged race result persists on submit — the reshape never 
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
  { n: 86, by: 'unverified' },  // A fixed-shape session still owes the runner a dose and an ho
  { n: 87, by: 'invariant', ref: 'INV-PLAN-DELOAD-PLACEMENT' },  // A recovery week must not open a phase
  { n: 88, by: 'test', ref: 'lib/plan/vo2maxOnsetPlacement.test.ts', why: 'VO2max dose + placement' },  // The VO2max pool owes dose granularity and a continuous shape
  { n: 89, by: 'invariant', ref: 'INV-PLAN-EARLY-ONSET-GATED' },  // Experience-gated quality onset — a demonstrated base earns a
  { n: 90, by: 'invariant', ref: 'INV-PLAN-INJURY-CAP-DELIVERED' },  // A recovery week reduces, and the injury cap holds at deliver
  { n: 91, by: 'invariant', ref: 'INV-PLAN-ONRAMP-FLOOR' },  // The on-ramp is counted in weeks the runner runs, not weeks i
  { n: 92, by: 'test', ref: 'lib/plan/foundationOnRamp.test.ts', why: 'foundation block may carry strides' },  // A demonstrated runner\s foundation block may carry strides
  { n: 93, by: 'invariant', ref: 'INV-PLAN-PEAK-SPECIFICITY' },  // Peak rehearses the race — the specificity ladder is enforced
  { n: 94, by: 'invariant', ref: 'INV-PLAN-DELIVERED-RAMP' },  // §2 is measured at delivery for every runner, not only the in
  { n: 95, by: 'invariant', ref: 'INV-PLAN-DELOAD-PHASE-POSITION' },  // A recovery week must not fall on a phase\s second week eithe
  { n: 96, by: 'invariant', ref: 'INV-PLAN-OVERDO-BRAKE' },  // `overdo` is a brake, not a preference
  { n: 97, by: 'unverified' },  // A demonstrated runner\s surplus weeks belong inside the plan
  { n: 98, by: 'invariant', ref: 'INV-PLAN-ONSET-YIELD-BOUNDED' },  // §89\s onset is granted only as far as §1 permits
  { n: 99, by: 'test', ref: 'lib/plan/anchorEligibility.test.ts', why: 'a session states its own length' },  // A session states the length its own structure needs
  { n: 100, by: 'unverified' },  // A safety trim must not hand its deficit to the next week
  { n: 101, by: 'unverified' },  // `compressed` means two different things, so it is two fields
  { n: 102, by: 'unverified' },  // An intentional downgrade is not a missing session
  { n: 103, by: 'unverified' },  // Fitness signal — benchmark recalibration prompt (ENGINE-01)
  { n: 104, by: 'invariant', ref: 'INV-PLAN-RACE-SPECIFIC-VARIETY' },  // A peak rehearses the race more than one way
  { n: 105, by: 'unverified' },  // Marathon pace must exist away from the long run
  { n: 106, by: 'invariant', ref: 'INV-PLAN-PEAK-NOT-BELOW-START' },  // A plan never peaks below where the runner already is
  { n: 107, by: 'invariant', ref: 'INV-PLAN-LR-SEGMENT-RECORDED' },  // A session may not prescribe work it does not record
  { n: 108, by: 'unverified' },  // What a run SCORES, and what stays outside the score
  { n: 109, by: 'test', ref: 'lib/coaching/raceProjectionHonesty.test.ts', why: 'may compare, may not predict' },  // A progress surface may remember and compare. It may not predict.
] as const
