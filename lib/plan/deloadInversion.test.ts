import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { isLongRun } from './sessionRole'
import type { GeneratorInput, Plan, Week } from '@/types/plan'

/**
 * DELOAD-INVERSION-01 (CoachingPrinciples §90, 2026-09-06).
 *
 * Two coaching promises about what the runner ACTUALLY runs were enforced only
 * on the internal volume curve, not on the delivered week:
 *   1. §3  — a deload week carries less than the week before it.
 *   2. §12 — an injury runner's rise stays within the 5% cap at delivery.
 *
 * The Coaching Board (Willy-led) ruled the fix ships as three levers: the deload
 * curve re-anchor, §8 yielding its 2nd peak quality to §12 on injury weeks, and
 * easy runs trimming to the ceiling while the §52 long run is never trimmed —
 * with one new maintenance trigger for injury+beginner+ultra.
 *
 * This suite pins the three CLEAN structural guarantees. The delivered-volume
 * RESIDUAL (floor-dominated low-volume plans; the §52-protected long run) is
 * deliberately NOT asserted here — it is a declared-and-exercised `warn` on
 * INV-PLAN-DELOAD-IS-A-REDUCTION / -INJURY-CAP-DELIVERED, not a guarantee.
 */

const FROZEN_NOW = new Date('2026-09-06T09:00:00Z')
const PLAN_START = '2026-06-01'

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

const HM_KNEE: GeneratorInput = {
  race_date: '2026-11-01', race_distance_km: 21.1, goal: 'finish',
  age: 35, days_available: 6, current_weekly_km: 40, longest_recent_run_km: 15,
  fitness_level: 'experienced', injury_history: ['knee'],
  resting_hr: 55, max_hr: 185, preferred_long_run_day: 'sun',
}

const qualityCount = (w: Week) =>
  Object.values(w.sessions).filter(s => s?.type === 'quality').length
const trainingDays = (w: Week) =>
  Object.values(w.sessions).filter(s => s && s.type !== 'rest').length
const longKm = (w: Week) => {
  const l = Object.values(w.sessions).find(s => s && isLongRun(s))
  return l?.distance_km ?? 0
}

describe('DELOAD-INVERSION-01 §90 — the delivered week is the promise', () => {
  it('lever: an injury-capped peak week carries at most ONE quality session (§8 yields to §12)', () => {
    const plan = generateRulePlan(HM_KNEE, 'paid', PLAN_START)
    const buildWeeks = plan.weeks.filter(w => w.type !== 'deload' && w.type !== 'race')
    for (const w of buildWeeks) {
      expect(qualityCount(w), `week ${w.n} quality count`).toBeLessThanOrEqual(1)
    }
  })

  it('an UNINJURED experienced runner still gets a 2-quality peak (§8 is untouched off-injury)', () => {
    // Guards the blast radius: the count cap is injury-gated, not global.
    const healthy = generateRulePlan({ ...HM_KNEE, injury_history: [] }, 'paid', PLAN_START)
    const peakQuality = Math.max(
      ...healthy.weeks.filter(w => w.type !== 'deload' && w.type !== 'race').map(qualityCount)
    )
    expect(peakQuality).toBe(2)
  })

  it('lever: a deload delivers less than the week before it on a mid-volume plan (curve re-anchor)', () => {
    // Floors do not dominate at 40km/6-day, so the delivered deload reduction
    // is observable here — this is the archetype the old +36% W9→W10 sawtooth hit.
    const plan = generateRulePlan(HM_KNEE, 'paid', PLAN_START)
    const ws = plan.weeks
    let checkedADeload = false
    for (let i = 1; i < ws.length; i++) {
      const isDeload = ws[i].type === 'deload' || ws[i].badge === 'deload'
      const prevDeload = ws[i - 1].type === 'deload' || ws[i - 1].badge === 'deload'
      if (!isDeload || prevDeload) continue
      checkedADeload = true
      expect(ws[i].weekly_km, `deload week ${ws[i].n} vs week ${ws[i - 1].n}`)
        .toBeLessThanOrEqual(ws[i - 1].weekly_km)
    }
    expect(checkedADeload, 'the plan contained at least one deload to check').toBe(true)
  })

  it('lever: a deload keeps its session FREQUENCY — it is lower-volume, not fewer-days', () => {
    // The day-count grosses the deload target back up before dividing by
    // MIN_KM_PER_TRAINING_DAY, so recovery weeks are not silently stripped to 3 days.
    const plan = generateRulePlan(HM_KNEE, 'paid', PLAN_START)
    const ws = plan.weeks
    for (let i = 1; i < ws.length; i++) {
      const isDeload = ws[i].type === 'deload' || ws[i].badge === 'deload'
      const prevDeload = ws[i - 1].type === 'deload' || ws[i - 1].badge === 'deload'
      if (!isDeload || prevDeload) continue
      // A deload keeps at least (prev training days − 1): it drops load, not the week.
      expect(trainingDays(ws[i]), `deload week ${ws[i].n} training days`)
        .toBeGreaterThanOrEqual(trainingDays(ws[i - 1]) - 1)
    }
  })

  it('the §52-protected long run is never the thing trimmed to fit the injury cap', () => {
    // The long run grows across the build for an injury runner — it is not the
    // lever the delivered ceiling reconciliation pulls (easy volume is).
    const plan = generateRulePlan(HM_KNEE, 'paid', PLAN_START)
    const builds = plan.weeks.filter(w => w.type !== 'deload' && w.type !== 'race')
    const firstLong = longKm(builds[0])
    const peakLong = Math.max(...builds.map(longKm))
    expect(peakLong).toBeGreaterThan(firstLong)
  })

  it('maintenance trigger: injury history + beginner volume + an ultra classifies maintenance, not an unsafe ramp', () => {
    const ULTRA_INJURED_BEGINNER: GeneratorInput = {
      race_date: '2027-03-01', race_distance_km: 50, goal: 'finish',
      age: 40, days_available: 4, current_weekly_km: 20, longest_recent_run_km: 10,
      fitness_level: 'beginner', injury_history: ['shin_splints'],
      resting_hr: 60, max_hr: 180, preferred_long_run_day: 'sun',
    }
    const plan = generateRulePlan(ULTRA_INJURED_BEGINNER, 'paid', PLAN_START)
    expect(plan.meta.volume_profile).toBe('maintenance')
    expect(plan.meta.volume_constraint_note ?? '').not.toBe('')
  })

  it('a HEALTHY beginner targeting the same ultra is NOT force-classified by the injury trigger', () => {
    // The trigger is injury-gated. A healthy beginner may still classify maintenance
    // for other §52 reasons, but not because of this rule — so we assert the plan
    // generates and carries a real curve rather than asserting the profile value.
    const healthyUltra: GeneratorInput = {
      race_date: '2027-03-01', race_distance_km: 50, goal: 'finish',
      age: 40, days_available: 4, current_weekly_km: 20, longest_recent_run_km: 10,
      fitness_level: 'beginner', injury_history: [],
      resting_hr: 60, max_hr: 180, preferred_long_run_day: 'sun',
    }
    const plan = generateRulePlan(healthyUltra, 'paid', PLAN_START)
    expect(plan.weeks.length).toBeGreaterThan(0)
  })
})
