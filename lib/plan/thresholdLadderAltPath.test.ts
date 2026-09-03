import { describe, it, expect } from 'vitest'
import { selectCatalogueSession, V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { GENERATION_CONFIG } from './generationConfig'
import type { CatalogueSelectorArgs } from './sessionCatalogueData'

/**
 * §53 second eligibility path (Coaching Board 2026-09-03) — `threshold_ladder`
 * is reachable at `weeklyKm >= 45` (unchanged) OR when the caller asserts
 * `recentThresholdEligible` (computed by generateRulePlan's main loop from
 * already-built prior weeks — see the block above buildWeekSessions'
 * invocation). This tests the selector's own OR-gate in isolation, since the
 * mechanical invariant route was tried and abandoned (see invariants.ts's
 * comment at the INV-PLAN-THRESHOLD-LADDER-ELIGIBLE placeholder) — a finished
 * plan's stored weekly_km is post-cap actual volume, not the pre-cap target
 * the engine's real-time decision used, so post-hoc re-derivation
 * false-positives. Direct selector tests don't have that problem.
 */

const baseArgs: CatalogueSelectorArgs = {
  catalogue: V1_SESSION_CATALOGUE,
  phase: 'build',
  distanceKey: 'HM',
  fitness: 'intermediate',
  tier: 'paid',
  weekN: 7,
  preferredCategory: 'threshold',
  weeklyKm: 32, // below THRESHOLD_LADDER_MIN_WEEKLY_KM (45)
}

function poolIncludesLadder(args: CatalogueSelectorArgs): boolean {
  // Run selection many times across slotIndex/weekN variants isn't needed —
  // what we actually want is "is threshold_ladder in the eligible pool at
  // all", which the rotation will surface given enough distinct rowUsage
  // states. Simplest robust check: call with a rowUsage map that already
  // heavily favours every OTHER threshold row, forcing least-used rotation
  // toward threshold_ladder if and only if it's eligible.
  const rowUsage = new Map<string, number>()
  for (const row of V1_SESSION_CATALOGUE) {
    if (row.category === 'threshold' && row.id !== 'threshold_ladder') rowUsage.set(row.id, 99)
  }
  const picked = selectCatalogueSession({ ...args, rowUsage })
  return picked?.id === 'threshold_ladder'
}

describe('threshold_ladder second eligibility path (§53, Coaching Board 2026-09-03)', () => {
  it('is NOT reachable below the flat floor when recentThresholdEligible is unset/false', () => {
    expect(poolIncludesLadder(baseArgs)).toBe(false)
  })

  it('IS reachable below the flat floor when recentThresholdEligible is true', () => {
    expect(poolIncludesLadder({ ...baseArgs, recentThresholdEligible: true })).toBe(true)
  })

  it('the flat floor alone (no alt-path flag) still admits it at/above 45km/wk', () => {
    expect(poolIncludesLadder({ ...baseArgs, weeklyKm: 45, recentThresholdEligible: false })).toBe(true)
  })

  it('config constants exist and are sane (Coaching Board values, not invented at test time)', () => {
    expect(GENERATION_CONFIG.THRESHOLD_LADDER_ALT_LOOKBACK_WEEKS).toBe(3)
    expect(GENERATION_CONFIG.THRESHOLD_LADDER_ALT_MIN_HITS).toBe(2)
    expect(GENERATION_CONFIG.THRESHOLD_LADDER_ALT_STABILITY_PCT).toBe(20)
  })
})
