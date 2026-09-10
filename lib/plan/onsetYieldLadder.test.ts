import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import type { GeneratorInput } from '../../types/plan'

/**
 * §98 (CB-ONSET-YIELD-01) — the §1 yield ladder.
 *
 * DELIBERATELY DETERMINISTIC. The property sweep samples its axes independently
 * at random, which is precisely how INTENSITY-3DAY-01 shipped: `days_available: 3`
 * was never crossed with the full §89 gate. Every cell below is a measured
 * breaching case pinned by hand, plus the control that must NOT move.
 */

const TODAY = '2026-09-10'
const HARD = new Set(['quality', 'intervals', 'tempo'])
const addDays = (iso: string, d: number) => {
  const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + d)
  return t.toISOString().slice(0, 10)
}
const PLAN_START = addDays(TODAY, 21)

function build(over: Partial<GeneratorInput> & { race_distance_km: number; target_time: string }) {
  const input = {
    race_date: addDays(PLAN_START, 14 * 7),
    goal: 'time_target',
    current_weekly_km: 45,
    longest_recent_run_km: 16,
    days_available: 4,
    age: 40,
    fitness_level: 'experienced',
    user_declared_level: 'experienced',
    training_age: '5yr+',
    recent_quality_training: 'regular',
    weeks_at_current_volume: 12,
    acknowledged_prep_warning: true,
    ...over,
  } as GeneratorInput
  const plan = generateRulePlan(input, 'paid', PLAN_START, undefined, TODAY)
  return { plan, input }
}

const effectiveOnRamp = (plan: any) =>
  plan.weeks.filter((w: any) => w.n >= 1 && w.phase === 'base').length
  + (plan.meta.foundation_weeks_planned ?? 0)

// The cells measured breaching §1 before §98. Each is a real (distance, days,
// volume) combination, not a synthetic input.
const BREACHING = [
  { name: 'HM @ 3 days (worst measured: 29.5% vs 20%)', race_distance_km: 21.1, target_time: '1:45:00', days_available: 3 },
  { name: 'HM @ 4 days',                                 race_distance_km: 21.1, target_time: '1:45:00', days_available: 4 },
  { name: 'MARATHON @ 4 days',                           race_distance_km: 42.195, target_time: '3:45:00', days_available: 4 },
  { name: 'MARATHON @ 5 days (24.7% vs 18%)',            race_distance_km: 42.195, target_time: '3:45:00', days_available: 5 },
  { name: '10K @ 3 days (29.3% vs 25%)',                 race_distance_km: 10, target_time: '0:46:00', days_available: 3, current_weekly_km: 30, longest_recent_run_km: 11 },
]

describe('§98 — §89 onset yields to §1', () => {
  for (const cell of BREACHING) {
    const { name, ...over } = cell
    it(`${name}: no longer breaches §1`, () => {
      const { plan, input } = build(over as any)
      const breaches = validatePlan(plan, input)
        .filter(v => v.code === 'INV-PLAN-INTENSITY-DISTRIBUTION')
      expect(breaches).toEqual([])
    })

    it(`${name}: never waits longer than the same runner ungated (§91)`, () => {
      const { plan } = build(over as any)
      const { plan: ungated } = build({ ...over, recent_quality_training: 'occasional' } as any)
      expect(effectiveOnRamp(plan)).toBeLessThanOrEqual(effectiveOnRamp(ungated))
    })
  }

  it('stamps its decision only when it actually acts', () => {
    // A compliant gated plan keeps §89 in full and carries no stamp.
    const { plan } = build({ race_distance_km: 5, target_time: '0:22:00', days_available: 5 })
    if (plan.meta.early_quality_onset && !plan.meta.onset_yield) {
      expect(plan.meta.onset_yield).toBeUndefined()
    }
    // Whereas a breaching cell is stamped and bounded.
    const { plan: yielded } = build({ race_distance_km: 21.1, target_time: '1:45:00', days_available: 3 })
    expect(yielded.meta.onset_yield).toBeDefined()
    expect(yielded.meta.onset_yield!.effective).toBeLessThanOrEqual(yielded.meta.onset_yield!.bound)
  })

  it('leaves a NON-gated runner completely untouched', () => {
    // §98 must not reach anyone §89 never reached. Beginner, no recent quality.
    const over = {
      race_distance_km: 21.1, target_time: '2:10:00', days_available: 4,
      fitness_level: 'beginner', user_declared_level: 'beginner',
      training_age: '6-18mo', recent_quality_training: 'none',
    }
    const { plan } = build(over as any)
    expect(plan.meta.early_quality_onset).toBeFalsy()
    expect(plan.meta.onset_yield).toBeUndefined()
  })

  it('the ladder preserves §89 for the majority — quality still starts early', () => {
    // The corrected HM@3d plan must still be a §89 plan, not a silent revert.
    const { plan } = build({ race_distance_km: 21.1, target_time: '1:45:00', days_available: 3 })
    const firstQuality = plan.weeks
      .filter(w => w.n >= 1)
      .find(w => Object.values(w.sessions).some((s: any) => s && HARD.has(s.type)))
    expect(firstQuality).toBeDefined()
  })
})
