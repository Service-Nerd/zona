import { GENERATION_CONFIG } from './generationConfig'

/**
 * CoachingPrinciples §79 — fitness classification. Single owner, shared by the
 * engine (generateRulePlan) and the wizard's level recommendation so the two
 * never drift (same pattern as maxHrGuard.ts). Pure, client-safe.
 */

export type FitnessLevel = 'beginner' | 'intermediate' | 'experienced'

export const FITNESS_RANK: Record<FitnessLevel, number> = { beginner: 0, intermediate: 1, experienced: 2 }

export function fitnessFromVdot(vdot: number): FitnessLevel {
  const t = GENERATION_CONFIG.FITNESS_VDOT_THRESHOLDS
  if (vdot < t.intermediate_min) return 'beginner'
  if (vdot <= t.experienced_min) return 'intermediate'
  return 'experienced'
}

export function fitnessFromVolume(weeklyKm: number, longestKm: number): FitnessLevel {
  const t = GENERATION_CONFIG.FITNESS_VOLUME_THRESHOLDS
  if (weeklyKm < t.beginner_max_weekly_km || longestKm < t.beginner_max_long_km) return 'beginner'
  if (weeklyKm >= t.experienced_min_weekly_km && longestKm >= t.experienced_min_long_km) return 'experienced'
  return 'intermediate'
}

/**
 * CoachingPrinciples §79 (D2, 2026-08-06) — VDOT and volume answer different
 * questions and must both be consulted.
 *
 * VDOT measures what a runner can currently RACE. Volume measures what they can
 * currently ABSORB. The first organic user ran a 29:00 5K (VDOT 30.8 →
 * "beginner") while running 30 km/week with a 12 km long run (volume →
 * "intermediate"). Classifying from VDOT alone made them a beginner, and
 * `QUALITY_SESSIONS_PER_WEEK_MAX.beginner = 0` then removed every quality
 * session from a 14-week half-marathon plan. One threshold, cascading into the
 * whole plan shape.
 *
 * On disagreement, take the LOWER level for structure (volume, long-run caps —
 * the things that hurt people when overestimated) and the HIGHER level for the
 * intensity allowance (the thing that under-trains them when underestimated).
 */
export interface FitnessAssessment {
  /** Drives volume, peak km, long-run caps. Conservative on disagreement. */
  structural: FitnessLevel
  /** Drives QUALITY_SESSIONS_PER_WEEK_MAX only. Generous on disagreement. */
  intensity: FitnessLevel
  /** True when the two signals disagreed — surfaced in meta for honesty. */
  signalsDisagree: boolean
  /**
   * CoachingPrinciples §79 (returning-runner intensity, 2026-08-31). True when a
   * deep training age rescued a beginner-by-volume intensity — i.e. an experienced
   * runner returning from a layoff. The plan lifts their INTENSITY allowance (they
   * have the skill and the aerobic base returns fast) but must gate the highest
   * tissue-stress work through a progressive re-entry — tissue tolerance lags.
   */
  intensityLiftedForReturn: boolean
}

/**
 * @param trainingAgeExperienced  CoachingPrinciples §79 — when a runner with a deep
 *   training age (2-5yr / 5yr+) reads beginner on CURRENT volume, they are a
 *   returning runner, not a beginner. Volume measures what they can absorb *now*;
 *   training age measures the skill and aerobic base a layoff has not erased. Their
 *   intensity allowance is lifted off the beginner floor so a returning ultra
 *   runner is not handed a true-beginner's zero-quality plan — while structure
 *   (volume, caps) stays bound to current volume, and §79's re-entry gate withholds
 *   VO2max/hills until tissue rebuilds.
 */
export function assessFitness(
  weeklyKm: number,
  longestKm: number,
  vdot?: number,
  trainingAgeExperienced = false,
): FitnessAssessment {
  const byVolume = fitnessFromVolume(weeklyKm, longestKm)

  // Base structural/intensity from the two-signal model (§79).
  let structural: FitnessLevel
  let intensity:  FitnessLevel
  let signalsDisagree: boolean
  if (vdot === undefined || !Number.isFinite(vdot)) {
    structural = intensity = byVolume
    signalsDisagree = false
  } else {
    const byVdot = fitnessFromVdot(vdot)
    if (byVdot === byVolume) {
      structural = intensity = byVdot
      signalsDisagree = false
    } else {
      structural = FITNESS_RANK[byVdot] < FITNESS_RANK[byVolume] ? byVdot : byVolume
      intensity  = FITNESS_RANK[byVdot] > FITNESS_RANK[byVolume] ? byVdot : byVolume
      signalsDisagree = true
    }
  }

  // §79 training-age lift — an experienced runner reading beginner on intensity is
  // returning, not new. Lift intensity one step (to intermediate); structure is
  // untouched, so tonnage stays conservative. A truly experienced returner can
  // raise it further via the wizard (user override).
  let intensityLiftedForReturn = false
  if (trainingAgeExperienced && intensity === 'beginner') {
    intensity = 'intermediate'
    signalsDisagree = true
    intensityLiftedForReturn = true
  }

  return { structural, intensity, signalsDisagree, intensityLiftedForReturn }
}

export interface FitnessRecommendation {
  level: FitnessLevel
  /** True when the recommendation reflects a returning runner (deep training age,
   *  low current volume) — the wizard can frame the "we'll ease hard work back in"
   *  message. */
  isReturning: boolean
}

/**
 * The level the wizard RECOMMENDS the runner picks. Keyed to the INTENSITY read —
 * what the runner can handle for hard work — because a user selection sets the
 * intensity allowance. The runner can override it. VDOT is optional (a benchmark
 * may not be collected yet); volume + training age alone give a safe recommendation.
 */
export function recommendFitnessLevel(
  weeklyKm: number,
  longestKm: number,
  trainingAgeExperienced: boolean,
  vdot?: number,
): FitnessRecommendation {
  const a = assessFitness(weeklyKm, longestKm, vdot, trainingAgeExperienced)
  return { level: a.intensity, isReturning: a.intensityLiftedForReturn }
}

/** The four levels a plan is built with. §79 keeps them separate on purpose. */
export interface ResolvedLevels {
  /** What the assessment read from volume + VDOT + training age, before any
   *  declaration or API override. Structural. */
  assessedStructural: FitnessLevel
  /** Ditto, for the intensity allowance. */
  assessedIntensity: FitnessLevel
  /** What the runner picked in the wizard, if they picked anything. */
  declared?: FitnessLevel
  /** THE structural level the plan is built with: volume, peak km, long-run caps. */
  structural: FitnessLevel
  /** THE intensity level: QUALITY_SESSIONS_PER_WEEK_MAX and the §1 ceiling. */
  intensity: FitnessLevel
  /** The raw two-signal read, for the callers that need `signalsDisagree` and
   *  `intensityLiftedForReturn` (surfaced in meta, and §79's re-entry gate). */
  assessment: FitnessAssessment
  /** §79's returning-runner predicate, derived from `training_age`. Returned
   *  rather than re-derived by each caller — it is the same one-line rule and
   *  this repo has paid for one-line rules written out twice. */
  trainingAgeIsExperienced: boolean
}

/**
 * THE SINGLE OWNER of "what levels is this runner's plan built at".
 *
 * ── WHY IT IS A FUNCTION AND NOT FIFTEEN LINES INSIDE THE ENGINE ─────────────
 * It was those fifteen lines, inside `buildRulePlanOnce`, and nothing outside
 * generation could ask the question. `REFUSAL-TELEMETRY-01` wanted it — it
 * records `fitness_level` on every designed refusal so we can see WHICH runners
 * the engine turns away — and reached for `input.fitness_level`, which is the
 * API-level structural override the wizard never sends. Measured 2026-10-09: **20
 * refusal events, 0 carrying any level.** The field had been inert since the day
 * it shipped, and the type's own doc comment says, in as many words, "do NOT
 * repurpose it for the wizard's user selection".
 *
 * Copying the fifteen lines into the route would have been the `deloadCadence`
 * defect by hand — a predicate in two places, agreeing until one moves. So the
 * engine and the telemetry now call the same function.
 *
 * ── THE ASYMMETRY IS §79 AND IT IS LOAD-BEARING ──────────────────────────────
 * A runner's declaration binds UPWARD on intensity only (a self-declaration is
 * not evidence of tissue tolerance — §10, Willy) and DOWNWARD on both (a runner
 * volunteering caution is credible about caution). Measured before that fix: a
 * 10K runner at 15 km/wk declaring `experienced` went week 1 13 -> 20 km and peak
 * 18 -> 35.
 *
 * @param vdot  Already discounted (§10/§42). Optional: a benchmark may not have
 *              been collected, and volume plus training age alone give a safe
 *              read.
 */
export function resolveLevels(
  input: Pick<import('@/types/plan').GeneratorInput,
    'current_weekly_km' | 'longest_recent_run_km' | 'training_age' | 'fitness_level' | 'user_declared_level'>,
  vdot?: number,
): ResolvedLevels {
  // D2 — VDOT and volume answer different questions; consult both. §79 — a deep
  // training age lifts the INTENSITY read off the beginner floor for a returning
  // runner whose current volume alone would misclassify them.
  const trainingAgeIsExperienced = input.training_age === '2-5yr' || input.training_age === '5yr+'
  const assessed = assessFitness(
    input.current_weekly_km, input.longest_recent_run_km, vdot, trainingAgeIsExperienced)

  // `input.fitness_level` is the API-level STRUCTURAL declaration. When supplied
  // it stands in for the volume-derived assessment (long-standing contract; the
  // archetype matrix and property sweep rely on it).
  const assessedStructural: FitnessLevel = input.fitness_level ?? assessed.structural
  const assessedIntensity:  FitnessLevel = input.fitness_level ?? assessed.intensity

  const declaredLevel = input.user_declared_level
  const declaredIsDownward =
    declaredLevel !== undefined
    && FITNESS_RANK[declaredLevel] < FITNESS_RANK[assessedStructural]

  // Structure moves for a declaration ONLY downward (the config flag names the
  // rule; flipping it to false would restore symmetric binding).
  const structural: FitnessLevel =
    (GENERATION_CONFIG.USER_DECLARED_LEVEL_BINDS_STRUCTURE_DOWNWARD_ONLY
      ? (declaredIsDownward ? declaredLevel! : assessedStructural)
      : (declaredLevel ?? assessedStructural))

  // Intensity always follows the declaration when there is one — that is the
  // agency the wizard offers. §1's distribution ceiling and the §79 re-entry
  // gate remain binding at the elevated level.
  const intensity: FitnessLevel = declaredLevel ?? assessedIntensity

  return {
    assessedStructural, assessedIntensity, declared: declaredLevel, structural, intensity,
    assessment: assessed, trainingAgeIsExperienced,
  }
}
