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
