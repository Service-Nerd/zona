// §109 Amendment 1 — the no-measurement race estimate (Coaching Board 2026-09-17).
//
// Pure, node-testable, and deliberately OUT of the route: a Next.js route may
// not export helpers, and more importantly this is where the twelve numerics
// were hiding. Same precedent as `aerobicEstimate.ts`, which is the measured
// sibling of this estimator.
//
// THE DEFECT THIS REPLACES. `app/api/race-times/route.ts` carried a
// hand-authored 3x4 table of VDOTs, outside GENERATION_CONFIG, explained by no
// principle, invisible to `configPrincipleSync.test.ts` and to the
// coaching-guard hook — the `peakKmByLevel` / §106 class. Six of its twelve
// cells asserted a VDOT that §13's own `FITNESS_VDOT_THRESHOLDS` would classify
// as a DIFFERENT level from the label that selected the cell. Measured: it was
// the sole source of the projected times for 58% of plans.

import { GENERATION_CONFIG } from './generationConfig'

type TrainingAgeKey = keyof typeof GENERATION_CONFIG.ESTIMATE_VDOT_BAND_FRACTIONS

const FITNESS_BANDS: Record<string, number> = {
  beginner:     GENERATION_CONFIG.FITNESS_VDOT_THRESHOLDS.intermediate_min
                  - (GENERATION_CONFIG.FITNESS_VDOT_THRESHOLDS.experienced_min
                     - GENERATION_CONFIG.FITNESS_VDOT_THRESHOLDS.intermediate_min),
  intermediate: GENERATION_CONFIG.FITNESS_VDOT_THRESHOLDS.intermediate_min,
  experienced:  GENERATION_CONFIG.FITNESS_VDOT_THRESHOLDS.experienced_min,
}

/** Width of a fitness band — §13's own two thresholds, not a new numeric. */
const BAND_WIDTH =
  GENERATION_CONFIG.FITNESS_VDOT_THRESHOLDS.experienced_min
  - GENERATION_CONFIG.FITNESS_VDOT_THRESHOLDS.intermediate_min

/** VDOT for one (level, training age) pair, before the estimate discount. */
export function bracketVdotFor(fitnessLevel: string | undefined, trainingAge: TrainingAgeKey): number | null {
  const floor = FITNESS_BANDS[fitnessLevel ?? 'intermediate']
  if (floor === undefined) return null
  const f = GENERATION_CONFIG.ESTIMATE_VDOT_BAND_FRACTIONS[trainingAge]
  return Math.round((floor + BAND_WIDTH * f) * 10) / 10
}

/**
 * The estimate for a runner with nothing measured.
 *
 * ⚠️ A DECLINED TRAINING AGE WIDENS THE ESTIMATE, it does not take the middle
 * bracket. The route used to substitute `'6-18mo'` via `??`, which made
 * "I'd rather not say" and a real answer produce IDENTICAL figures — measured
 * on the live database, 2 of 6 comparable plans had declined and were shown the
 * same numbers as the 2 who answered. Hutchinson and McMillan were unanimous
 * that this was the least defensible behaviour in the chain. Unanswered now
 * returns the band's own span, which the card renders as a range.
 */
export function estimateVdotRange(
  fitnessLevel: string | undefined,
  trainingAge:  string | undefined,
): { low: number; high: number } | null {
  const keys = Object.keys(GENERATION_CONFIG.ESTIMATE_VDOT_BAND_FRACTIONS) as TrainingAgeKey[]
  const d = 1 - GENERATION_CONFIG.ESTIMATE_VDOT_DISCOUNT_PCT / 100

  if (trainingAge && keys.includes(trainingAge as TrainingAgeKey)) {
    const v = bracketVdotFor(fitnessLevel, trainingAge as TrainingAgeKey)
    return v === null ? null : { low: v * d, high: v * d }
  }
  // Declined or unrecognised: the whole band, not its midpoint.
  const lo = bracketVdotFor(fitnessLevel, keys[0])
  const hi = bracketVdotFor(fitnessLevel, keys[keys.length - 1])
  return lo === null || hi === null ? null : { low: lo * d, high: hi * d }
}
