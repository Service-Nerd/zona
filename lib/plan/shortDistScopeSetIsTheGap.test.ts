// §117 Am. 8 — the band `INV-PLAN-RUNWALK-SHORTDIST-SCOPE` counts is a GAP, not a complement.
//
// 🔴 WHY THIS GATE EXISTS. `runWalkOutOfScopeUnready` first tested "any distance outside
// `RUNWALK_INSTRUCTION_RACE_KEYS`", which swept in the 50K and 100K — **62% of all firings** —
// and `runWalkPlan.ts` excludes the ultras from §117 for a different, ratified reason: *"the
// ultras have their own §24e machinery."* Their exclusion is a RULING with its own mechanism,
// so counting them as "§117 Am. 8's residual" attributes them to the wrong cause.
//
// So the set is the GAP between three things that each have an owner:
//   · what §117 named                     — the marathon
//   · what Amendment 8 added              — 5K, 10K      (`RUNWALK_INSTRUCTION_RACE_KEYS`)
//   · what §24e governs instead           — 50K, 100K
// …leaving exactly the half marathon, which nothing covers.
//
// ⚠️ The constant is NAMED rather than derived, because the complement is the wrong answer.
// These arms are what stops the three drifting apart: widen the instruction scope, or bring the
// ultras in, and the arithmetic below says so instead of the invariant silently changing
// population. **A named constant with no gate linking it to its reason is the thing code review
// flagged; this is the link.**
import { describe, it, expect } from 'vitest'
import { GENERATION_CONFIG, raceDistanceKey } from './generationConfig'
import { runWalkDistanceApplies, runWalkInstructionDistanceApplies, runWalkOutOfScopeUnready } from './runWalkPlan'
import { derivedLevelsFor } from './ruleEngine'
import type { GeneratorInput } from '../../types/plan'

/** One representative distance per `raceDistanceKey` band, from the wizard's own list. */
const BY_KEY: Record<string, number> = { '5K': 5, '10K': 10, HM: 21.1, MARATHON: 42.2, '50K': 50, '100K': 100 }
/** §24e's band — the ultras, excluded from §117 by their own machinery. */
const ULTRA_KEYS = ['50K', '100K'] as const

const mk = (km: number): GeneratorInput => ({
  athlete_name: 'A', age: 38, race_name: 'T', primary_metric: 'distance',
  plan_start: '2026-04-27', race_distance_km: km, race_date: '2026-10-04', goal: 'finish',
  days_available: 4, days_cannot_train: [], current_weekly_km: 10, longest_recent_run_km: 0,
  training_age: '<6mo', recent_quality_training: 'none',
  hard_session_relationship: 'neutral', injury_history: [], max_weekday_mins: 60,
} as unknown as GeneratorInput)

describe('§117 Am. 8 — the counted band is the gap between three owners', () => {
  it('every raceDistanceKey is accounted for by exactly one owner', () => {
    const scope = new Set(GENERATION_CONFIG.RUNWALK_INSTRUCTION_RACE_KEYS)
    const ultras = new Set<string>(ULTRA_KEYS)
    const counted: string[] = []
    const unaccounted: string[] = []
    for (const [key, km] of Object.entries(BY_KEY)) {
      expect(raceDistanceKey(km), `${km}km no longer maps to ${key}`).toBe(key)
      const i = mk(km)
      const isCounted = runWalkOutOfScopeUnready(i, derivedLevelsFor(i).structural)
      if (isCounted) counted.push(key)
      const owned = scope.has(key) || ultras.has(key) || isCounted
      if (!owned) unaccounted.push(key)
    }
    expect(unaccounted,
      'a distance band is governed by nobody: not in §117 Am. 8s instruction scope, not an '
      + 'ultra under §24e, and not counted as the residual. Either it belongs in one of them '
      + 'or the invariant needs a ruling for it.').toEqual([])
    expect(counted,
      'the residual band moved. It must be the HALF alone: §117 names the marathon, Am. 8 added '
      + '5K and 10K, §24e governs the ultras, and nothing covers the half.').toEqual(['HM'])
  })

  it('🔴 the ultras are NOT counted — their exclusion is a ruling, not an omission', () => {
    for (const key of ULTRA_KEYS) {
      const i = mk(BY_KEY[key]!)
      expect(runWalkOutOfScopeUnready(i, derivedLevelsFor(i).structural),
        `${key} is being counted as §117 Am. 8s residual, but runWalkPlan.ts excludes the ultras `
        + 'because "the ultras have their own §24e machinery". 62% of the first cut\'s firings '
        + 'were ultras for exactly this reason.').toBe(false)
    }
  })

  it('the instruction scope and the PEAK scope are still different sets', () => {
    // The regression §117 Am. 4 separates by ruling, and the one a one-line fix would have made.
    expect(GENERATION_CONFIG.RUNWALK_INSTRUCTION_RACE_KEYS.includes('5K')).toBe(true)
    expect(runWalkInstructionDistanceApplies(5)).toBe(true)
    expect(runWalkDistanceApplies(5), 'the PEAK scope widened to the 5K').toBe(false)
    expect(runWalkDistanceApplies(42.2)).toBe(true)
  })

  it('the arms are not vacuous — the representatives really span every band', () => {
    expect(Object.keys(BY_KEY).length).toBe(6)
    expect(new Set(Object.values(BY_KEY).map(raceDistanceKey)).size).toBe(6)
  })
})
