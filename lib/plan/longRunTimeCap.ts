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
import { hasInjuryKeyword } from './injuryScope'
import type { GeneratorInput } from '@/types/plan'

/**
 * The maximum MINUTES a long run may occupy for this runner's race (§9), including
 * §40's tighter ceiling for a finish-goal 5K.
 *
 * This is an absolute ceiling on time on feet. It is not a periodisation rule, so it
 * applies to a foundation week exactly as it applies to a build week — §57 excludes
 * foundation weeks from the periodisation ARC, never from §9's load ceiling.
 */
export type InjuryCapKey = keyof typeof GENERATION_CONFIG.LONG_RUN_CAP_MINUTES_BY_INJURY

/** How each injury ceiling's history is named to the runner. Keyed by the config, so a new key
 *  does not compile until it has a name (it used to fall into "plantar fasciitis"). */
export const INJURY_CAP_LABEL: Record<InjuryCapKey, string> = {
  back: 'back injury',
  plantar_fasciitis: 'plantar fasciitis',
}

export interface LongRunTimeCap {
  mins: number
  /** Which rule set the binding ceiling: the race distance (§9, §40) or an injury history (§9 Am. 3). */
  source: 'distance' | 'injury'
  injury?: InjuryCapKey
}

/**
 * The maximum MINUTES a long run may occupy for this runner (§9), including §40's tighter ceiling
 * for a finish-goal 5K and §9 Am. 3's ceiling for a back or plantar fasciitis history, and WHICH of
 * them binds. Every reader of the ceiling, the sizing paths, the notes that explain a short long run,
 * goes through here (LONG-RUN-BELOW-LONGEST-01: three notes read the distance table directly and
 * blamed the wrong cause for an injury-capped runner).
 */
export function longRunTimeCap(input: Pick<GeneratorInput, 'race_distance_km' | 'goal'> & { injury_history?: string[] | null }): LongRunTimeCap {
  const distKey = raceDistanceKey(input.race_distance_km)
  let mins: number = GENERATION_CONFIG.LONG_RUN_CAP_MINUTES[distKey]
  if (distKey === '5K' && input.goal === 'finish') {
    mins = Math.min(mins, GENERATION_CONFIG.LONG_RUN_CAP_MINUTES_5K_FINISH)
  }
  let out: LongRunTimeCap = { mins, source: 'distance' }
  for (const key of Object.keys(GENERATION_CONFIG.LONG_RUN_CAP_MINUTES_BY_INJURY) as InjuryCapKey[]) {
    const m = GENERATION_CONFIG.LONG_RUN_CAP_MINUTES_BY_INJURY[key]
    if (hasInjuryKeyword(input.injury_history, key) && m < out.mins) out = { mins: m, source: 'injury', injury: key }
  }
  return out
}

export function longRunTimeCapMins(input: Pick<GeneratorInput, 'race_distance_km' | 'goal'> & { injury_history?: string[] | null }): number {
  return longRunTimeCap(input).mins
}
