// LONG-RUN-TIME-CAP-OWNER-01 (2026-10-03, FOUNDATION-BUDGET-01) — §9's absolute
// time ceiling for a long run, resolved in ONE place.
//
// ⚠️ IT ALREADY EXISTED TWICE IN `ruleEngine.ts` (the sizing path and the maintenance
// path), both spelling out the same three steps: key the race distance, read
// `LONG_RUN_CAP_MINUTES`, then tighten for a finish-goal 5K per §40. §122 needed it a
// THIRD time, for the foundation block — and a third hand-written copy is exactly the
// shape this repo has paid for repeatedly (`DELOAD-OWNER-01`: the same expression in five
// places, agreeing only by accident of surrounding control flow).
//
// ⚠️ NOTE, NOT CHANGED HERE: `invariants.ts` resolves the cap WITHOUT §40's finish-goal
// 5K tightening. That leaves the engine stricter than the checker, which is the safe
// direction, so it is recorded rather than "fixed" inside a build about foundation weeks.
// Changing what the validator accepts is its own decision.
import { GENERATION_CONFIG, raceDistanceKey } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

/**
 * The maximum MINUTES a long run may occupy for this runner's race (§9), including
 * §40's tighter ceiling for a finish-goal 5K.
 *
 * This is an absolute ceiling on time on feet. It is not a periodisation rule, so it
 * applies to a foundation week exactly as it applies to a build week — §57 excludes
 * foundation weeks from the periodisation ARC, never from §9's load ceiling.
 */
export function longRunTimeCapMins(input: Pick<GeneratorInput, 'race_distance_km' | 'goal'>): number {
  const distKey = raceDistanceKey(input.race_distance_km)
  const cap: number = GENERATION_CONFIG.LONG_RUN_CAP_MINUTES[distKey]
  // CoachingPrinciples §40 — finish-goal 5K plans get a tighter cap.
  if (distKey === '5K' && input.goal === 'finish') {
    return Math.min(cap, GENERATION_CONFIG.LONG_RUN_CAP_MINUTES_5K_FINISH)
  }
  return cap
}
