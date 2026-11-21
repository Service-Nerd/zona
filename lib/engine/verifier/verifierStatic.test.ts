// ADR027-B3-VERIFIER — a STATIC rule (one that reads rule data, never the plan) cannot be woken by breaking a plan,
// so the agreement test excuses it from the must-fire arm. This file proves each one FIRES, the other way: it swaps
// in rule data the rule must refuse, and requires validatePlan and the verifier to raise the same finding.
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/plan/planSignatures', async (orig) => {
  const real = await orig<typeof import('@/lib/plan/planSignatures')>()
  // A 10K signature asking for a focus category the catalogue cannot supply.
  return { ...real, PLAN_SIGNATURES: { ...real.PLAN_SIGNATURES, '10K': { ...real.PLAN_SIGNATURES['10K'], quality_categories_focus: ['no_such_category'] } } }
})

describe('ADR027-B3-VERIFIER — static rules fire, on swapped rule data', () => {
  it('🔴 PHASE-FOCUS-REACHABLE: both checkers raise an unreachable focus category, identically', async () => {
    const { validatePlan } = await import('@/lib/plan/invariants')
    const { verifyPlan } = await import('./verifyPlan')
    const { buildRunnerProfile, factsFromInput } = await import('@/lib/engine/profile/buildRunnerProfile')
    const input = { race_distance_km: 10, race_date: '2027-03-07', goal: 'finish', current_weekly_km: 30, longest_recent_run_km: 12,
      days_available: 4, training_age: '2-5yr', age: 35, injury_history: [] } as never
    // The rule never reads the plan, and under the swapped signature the engine refuses to build one, so a
    // minimal plan stands in. Other rules' findings on it are ignored: only this rule is compared.
    const plan = { meta: { race_date: '2027-03-07', race_distance_km: 10 }, weeks: [
      { n: 1, date: '2026-11-23', phase: 'base', type: 'normal', weekly_km: 20, sessions: { sun: { type: 'easy', label: 'Easy', distance_km: 8 } } },
    ] } as never
    const old = validatePlan(plan, input).filter(v => v.code === 'INV-PLAN-PHASE-FOCUS-REACHABLE').map(v => `${v.week}|${v.severity}`)
    const profile = buildRunnerProfile(factsFromInput(input), { asOf: '2026-11-16', timezone: null, planStart: '2026-11-23' })
    const neu = verifyPlan(plan, { input, profile }).filter(f => f.rule_id === 'INV-PLAN-PHASE-FOCUS-REACHABLE').map(f => `${f.week}|${f.severity}`)
    expect(old.length, 'the old checker did not fire on the swapped signature').toBeGreaterThan(0)
    expect(neu).toEqual(old)
  })
})
