import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * §89 — experience-gated quality onset.
 *
 * A demonstrably-ready runner (experienced intensity + real base + deep training
 * age + `recent_quality_training: 'regular'` + NOT returning/fresh/injured) gets a
 * SHORTER (still all-easy) base so quality starts ~2 weeks sooner. Everyone else is
 * untouched. The gate is safety-critical: it must NOT reach the less-experienced or
 * the injured, per the founding requirement "don't create injuries."
 *
 * Board: §89, 2026-09-06 — CORRECT WITH AMENDMENT (injury veto, volume floor, 2-week
 * base floor, no added tonnage, intensity-only re-entry relaxation).
 */

const FROZEN_NOW = new Date('2026-04-20T09:00:00Z')
const START = '2026-04-27'
const race = (wk: number) => { const d = new Date(2026, 3, 27); d.setDate(d.getDate() + wk * 7); return d.toISOString().slice(0, 10) }

const base10k = (o: Partial<GeneratorInput>): GeneratorInput => ({
  race_date: race(12), race_distance_km: 10, goal: 'time_target', target_time: '0:45:00',
  current_weekly_km: 30, longest_recent_run_km: 10, days_available: 4, age: 40,
  resting_hr: 50, max_hr: 186, preferred_long_run_day: 'sun', ...o,
} as GeneratorInput)

// The example runner: 30km/wk, longest 10km, experienced declaration, deep age.
const READY = base10k({ training_age: '5yr+', user_declared_level: 'experienced', recent_quality_training: 'regular' })

const baseWeeks = (p: Plan) => p.weeks.filter(w => w.n >= 1 && w.phase === 'base').length
const firstQualityWeek = (p: Plan) => {
  for (const w of p.weeks) if (Object.values(w.sessions).some(s => s?.type === 'quality')) return w.n
  return 0
}

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('§89 — the gate FIRES for a demonstrably-ready runner', () => {
  it('shortens the base and starts quality sooner, and stamps meta', () => {
    const p = generateRulePlan(READY, 'paid', START)
    expect(p.meta.early_quality_onset, 'ready runner should get early onset').toBe(true)
    expect(baseWeeks(p), 'base is shortened to the floor').toBe(GENERATION_CONFIG.MIN_BASE_WEEKS_FLOOR)
    // The control: the same runner WITHOUT the signal keeps the full base.
    const control = generateRulePlan(base10k({ training_age: '5yr+', user_declared_level: 'experienced' }), 'paid', START)
    expect(control.meta.early_quality_onset).toBeFalsy()
    expect(firstQualityWeek(p), 'quality lands sooner than the control').toBeLessThan(firstQualityWeek(control))
  })

  it('does not inflate tonnage — peak stays at the structural target, reached later', () => {
    // §79/§89's hinge: agency moves TIMING, never the tonnage CEILING. A shorter
    // base gives the ramp more build weeks, so the delivered peak reaches the
    // (unchanged, structure-set) target slightly more fully — but never materially
    // above the control, and the volume peak lands NO EARLIER than the intensity
    // onset, so intensity is not pulling volume forward (Sims's condition).
    const peak = (p: Plan) => Math.max(...p.weeks.filter(w => w.type !== 'deload' && w.type !== 'race' && w.n >= 1).map(w => w.weekly_km))
    const peakWeek = (p: Plan) => p.weeks.filter(w => w.type !== 'deload' && w.type !== 'race' && w.n >= 1).reduce((best, w) => w.weekly_km > best.weekly_km ? w : best).n
    const ready = generateRulePlan(READY, 'paid', START)
    const control = generateRulePlan(base10k({ training_age: '5yr+', user_declared_level: 'experienced' }), 'paid', START)
    // Not materially higher — a gentler ramp to the same ceiling, not a raised ceiling.
    expect(peak(ready)).toBeLessThanOrEqual(Math.round(peak(control) * 1.08))
    // Volume peak is not earlier than the first quality (intensity not pulling volume forward).
    const firstQ = firstQualityWeek(ready)
    expect(peakWeek(ready)).toBeGreaterThan(firstQ)
  })
})

describe('§89 — the gate stays SHUT for everyone it must protect', () => {
  const shut = (label: string, input: GeneratorInput) => it(`no early onset: ${label}`, () => {
    const p = generateRulePlan(input, 'paid', START)
    expect(p.meta.early_quality_onset, `${label} must not get early onset`).toBeFalsy()
    expect(validatePlan(p, input).filter(v => v.severity === 'error')).toHaveLength(0)
  })

  // Signal present, but a disqualifier on each.
  shut('injured (absolute veto)',       base10k({ training_age: '5yr+', user_declared_level: 'experienced', recent_quality_training: 'regular', injury_history: ['knee'] }))
  shut('beginner declaration',          base10k({ fitness_level: 'beginner', recent_quality_training: 'regular' }))
  shut('signal only "occasional"',      base10k({ training_age: '5yr+', user_declared_level: 'experienced', recent_quality_training: 'occasional' }))
  shut('no deep training age',          base10k({ training_age: '6-18mo', user_declared_level: 'experienced', recent_quality_training: 'regular' }))
  // A returning runner (low volume) with the signal: base is NOT shortened (they
  // have no current base), but Lever A shortens the intensity re-entry.
  it('returning runner: base kept, but intensity re-entry relaxed', () => {
    const input = base10k({ current_weekly_km: 15, longest_recent_run_km: 12, race_date: race(14), fitness_level: 'experienced', training_age: '5yr+', recent_quality_training: 'regular' })
    const p = generateRulePlan(input, 'paid', START)
    expect(p.meta.early_quality_onset, 'returner has no current base — no early onset').toBeFalsy()
    expect(p.meta.intensity_reentry_active).toBe(true)
    expect(p.meta.intensity_reentry_weeks, 'intensity re-entry shortened, not zeroed')
      .toBe(GENERATION_CONFIG.REENTRY_WEEKS_TISSUE_READY)
    // Same returner WITHOUT the signal keeps the full re-entry.
    const noSignal = generateRulePlan(base10k({ current_weekly_km: 15, longest_recent_run_km: 12, race_date: race(14), fitness_level: 'experienced', training_age: '5yr+' }), 'paid', START)
    expect(noSignal.meta.intensity_reentry_weeks).toBe(GENERATION_CONFIG.RETURNING_RUNNER_INTENSITY_REENTRY_WEEKS)
  })
})

describe('§89 — INV-PLAN-EARLY-ONSET-GATED rejects a forged plan', () => {
  it('an early-onset flag on an injured runner is a hard violation', () => {
    // The real assertion: if the gate were ever bypassed and early onset reached an
    // injured runner, the invariant must catch it. Forge the meta the engine refuses
    // to produce and confirm validation rejects it.
    const input = base10k({ training_age: '5yr+', user_declared_level: 'experienced', recent_quality_training: 'regular', injury_history: ['knee'] })
    const p = generateRulePlan(input, 'paid', START)
    const forged = structuredClone(p)
    forged.meta.early_quality_onset = true
    const found = validatePlan(forged, input).filter(v => v.code === 'INV-PLAN-EARLY-ONSET-GATED')
    expect(found.length, 'injured + early onset must be rejected').toBeGreaterThan(0)
    expect(found[0].severity).toBe('error')
  })
})
