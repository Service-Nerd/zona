// §111 Amendment 1 — the single owner of "what weekly volume does the engine
// actually START this runner at?"
//
// WHY THIS EXISTS. §111 measured its build ratio against the RAW
// `current_weekly_km` the runner typed into the wizard. The engine does not
// start them there. §29 scales a fresh-from-layoff runner down, and §10 caps a
// `<6mo` runner at `BEGINNER_WEEK1_VOLUME_CAP_KM` because a declared volume is
// a self-reported bucket midpoint, not a measurement.
//
// ⚠️ MEASURED CONSEQUENCE — the gate scored a ratio no runner experienced:
//
//   declared 50 km/wk, <6mo  ->  engine starts them at 30
//                               §111 scored 1.2x, actual build 1.8x
//   declared 40 km/wk, <6mo  ->  engine starts them at 32
//                               §111 scored 1.5x, actual build 1.8x
//   declared 16 km/wk        ->  engine starts them at 18
//                               §111 scored 3.7x, actual build 3.3x
//
// Wrong in BOTH directions, and most wrong exactly where §10's cap bites
// hardest. Hutchinson: "that is a defect in a principle this board ratified
// nine hours ago, and I would rather say so plainly than let it stand because
// it is ours."
//
// ⚠️ AND IT IS EXTRACTED, NOT COPIED. The derivation already existed inline in
// `buildRulePlanOnce`. Re-deriving it inside `baseVolume.ts` would have been a
// second copy of one quantity — the producer/checker split this repo has paid
// for in deloadCadence, supersedeCoverage, tierResolution and, earlier today,
// in §28's stride eligibility. Both callers read THIS.

import type { GeneratorInput } from '@/types/plan'
import { GENERATION_CONFIG } from './generationConfig'

/** §29 — fresh from a layoff, by either the explicit or heuristic path. */
export function isFreshReturn(input: GeneratorInput): boolean {
  const explicit = input.weeks_at_current_volume !== undefined
    && input.weeks_at_current_volume < GENERATION_CONFIG.FRESH_RETURN_WEEKS_THRESHOLD
  const trainingAgeIsExperienced =
    input.training_age === '2-5yr' || input.training_age === '5yr+'
  const heuristic = trainingAgeIsExperienced
    && input.current_weekly_km < GENERATION_CONFIG.HEURISTIC_FRESH_RETURN_WEEKLY_KM
    && input.longest_recent_run_km < GENERATION_CONFIG.HEURISTIC_FRESH_RETURN_LONG_RUN_KM
  return explicit || heuristic
}

/**
 * The weekly volume the engine actually builds FROM.
 *
 * This is §111's correct denominator and `buildRulePlanOnce`'s `startKm`. They
 * are the same number and must stay the same number.
 */
export function effectiveStartKm(input: GeneratorInput): number {
  const declared = isFreshReturn(input)
    ? input.current_weekly_km * GENERATION_CONFIG.FRESH_RETURN_START_FRACTION
    : input.current_weekly_km
  // §10 / CD-6 — a <6mo runner's declared volume is a self-reported bucket, not
  // measured; cap the start so an over-claim cannot hand a beginner too much.
  return input.training_age === '<6mo'
    ? Math.min(declared, GENERATION_CONFIG.BEGINNER_WEEK1_VOLUME_CAP_KM)
    : declared
}
