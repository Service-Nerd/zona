// Intensity re-entry window — the single owner of "is VO2max/hill work withheld
// in plan week N?" (INTENSITY-REENTRY-OWNER-01, 2026-09-15). CoachingPrinciples
// §79, with §89 Lever A and §97's one-week-on-ramp arm.
//
// WHY THIS MODULE EXISTS. The predicate was written out BY HAND TWICE inside
// `generateRulePlan`, twenty lines apart, with different loop variables:
//
//   vo2BuildSlotIndex   intensityReentryActive && wn     <= intensityReentryWeeks
//   buildWeekSessions   intensityReentryActive && weekN  <= intensityReentryWeeks
//
// They are the same fact. One decides WHICH build rotation slot VO2max may
// occupy; the other decides whether a given week's selector may offer a
// VO2max-category row at all. Feeding those two channels different predicates
// does not produce a wrong session — it produces a plan whose VO2max slot was
// reserved on one rule and then refused on another, and the failure surfaces
// far downstream as §53 rotation drift (measured at 47 -> 594 sweep failures
// when the two were changed out of step).
//
// This is the DELOAD-OWNER-01 failure class exactly — two producers of one
// fact, agreeing only by accident of being adjacent — so it gets the same
// remedy: a file-level owner, greppable, with a test that fails if the raw
// expression reappears anywhere else. D-08 single ownership, D-16 no parallel
// semantics.
//
// NOT DERIVED FROM `meta.intensity_reentry_active`. That field is STAMPED from
// this window, so reading it back would be a checker sharing its producer's
// premise. This predicate is the producer.

import { GENERATION_CONFIG } from './generationConfig'

/** The four independent signals that open a re-entry window (§79, §97). */
export interface IntensityReentryArms {
  /** §79 — a returning runner whose intensity was lifted by self-declaration. */
  readonly intensityLiftedForReturn: boolean
  /** §79 — detected as returning from a layoff with a structural base. */
  readonly returningRunner: boolean
  /** §79 — detected as a fresh return (structural base gone). */
  readonly isFreshReturn: boolean
  /** §97 — an ADR-021/§89-gated runner on the one-week quality on-ramp. */
  readonly oneWeekOnRamp: boolean
  /**
   * §79 Amendment 3 (Coaching Board 2026-09-15) — the runner declared a level
   * ABOVE the engine's structural assessment.
   *
   * §79's amendment already mandated this protection for intensity that is
   * "lifted (OR USER-RAISED)", but scoped it to returning/fresh-return runners.
   * That scoping is backwards relative to risk: a returner has historical
   * tissue adaptation, a novice has none. Measured on the charity cohort — T1
   * "couch-to-10K", 8 km/week, longest run 4 km, <6mo running, no quality
   * history — declaring 'intermediate' produced Hill reps at RPE 8 (Zone 4-5,
   * HR 158-182) in week 5 and Long VO2max in week 7, with no window at all,
   * because `training_age: '<6mo'` fails every returning-runner arm.
   *
   * §79's own words: "a runner declaring MORE is claiming a tissue tolerance
   * that nothing has demonstrated."
   */
  readonly userRaisedAboveStructural: boolean
  /**
   * §89 Lever A — tissue demonstrably conditioned, so the window is SHORTENED
   * rather than zeroed (Willy: one week tempo-first is cheap insurance).
   */
  readonly tissueConditioned: boolean
}

export interface IntensityReentryWindow {
  /** Is any re-entry window open on this plan? */
  readonly active: boolean
  /** How many weeks the window spans. 0 when inactive. */
  readonly weeks: number
  /**
   * Is VO2max-category work (intervals AND hill reps) withheld in plan week
   * `weekN`? This is the ONLY place the comparison is made — both the build
   * slot reservation and the per-week selector gate ask this same function,
   * so they cannot disagree about which weeks are protected.
   *
   * CALENDAR-ANCHORED. Retained for the meta stamp and for callers that
   * genuinely mean "plan week N". For the withholding decision itself, use
   * `withheldAtQualityIndex` — see below for why the calendar reading is inert.
   */
  withheldIn(weekN: number): boolean

  /**
   * Is VO2max-category work withheld at quality-carrying-week index `idx`
   * (0-based, counted over the weeks that actually carry a quality session)?
   *
   * WHY THIS EXISTS — QUALITY-ONSET-ORDER-01. §79's claim is an ORDERING one:
   * "withhold VO2max/hills for the opening weeks SO QUALITY LEADS WITH
   * TEMPO/THRESHOLD". Encoded against CALENDAR weeks it is systematically
   * inert, because `plannedQuality` is 0 for every base week and every deload
   * week — so weeks 1..N are all-easy by construction and there is nothing
   * there to withhold. Measured before the fix: of 48 plans with re-entry
   * ACTIVE, the first quality session fell inside the protective window in
   * 0 of 48 (0.0%), and was Zone 4-5 anyway in 32 of 48.
   *
   * Anchoring to the quality sequence instead makes the window mean what §79
   * says: the runner's FIRST N quality sessions lead with tempo/threshold.
   *
   * The index is not invented here. Both call sites already maintain it — the
   * build-slot IIFE walks build weeks skipping deloads, and the driver loop
   * advances `buildRotationIndex` on exactly the same predicate. Passing an
   * index rather than a precomputed Set avoids adding a THIRD producer of
   * "which weeks carry quality" (D-08).
   */
  withheldAtQualityIndex(idx: number): boolean
}

/**
 * Compute the §79 intensity re-entry window for a plan.
 *
 * DEPTH (§89 Lever A / §97), preserved exactly as it was written inline:
 * the one-week-on-ramp arm is checked FIRST and takes the LONGER of the two
 * "ready" windows. A gated runner is `tissueConditioned` by construction, so
 * testing `tissueConditioned` first would silently apply the shorter
 * REENTRY_WEEKS_TISSUE_READY and discard Willy's §97 condition entirely.
 */
export function computeIntensityReentry(arms: IntensityReentryArms): IntensityReentryWindow {
  const active =
    arms.intensityLiftedForReturn || arms.returningRunner || arms.isFreshReturn
    || arms.oneWeekOnRamp || arms.userRaisedAboveStructural

  const weeks = !active ? 0
    : arms.oneWeekOnRamp ? Math.max(
        GENERATION_CONFIG.REENTRY_WEEKS_ONE_WEEK_ONRAMP,
        GENERATION_CONFIG.REENTRY_WEEKS_TISSUE_READY)
    : arms.tissueConditioned ? GENERATION_CONFIG.REENTRY_WEEKS_TISSUE_READY
    : GENERATION_CONFIG.RETURNING_RUNNER_INTENSITY_REENTRY_WEEKS

  return {
    active,
    weeks,
    withheldIn(weekN: number): boolean {
      return active && weekN <= weeks
    },
    withheldAtQualityIndex(idx: number): boolean {
      return active && idx >= 0 && idx < weeks
    },
  }
}
