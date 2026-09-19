/**
 * QUALITY-ZERO-SCOPE-01 — §110's zero-quality floor is scoped on the runner's
 * LEVEL, not on `primary_metric`.
 *
 * `INV-PLAN-QUALITY-NOT-ZERO` gated on `plan.meta.primary_metric !== 'duration'`
 * while its own message read "a runner the engine does not classify beginner".
 * Those are different sets: `primary_metric` is duration when the runner is a
 * beginner **or the race is 50 km or longer** (§79/§80, time on feet), so every
 * ultra runner was exempted from the floor as well — and no ultra runner is a
 * beginner.
 *
 * ⚠️ NOTHING WAS WRONG IN THE DELIVERED PLANS AND THAT IS THE POINT. Measured
 * across 50K and 100K at intermediate and experienced, cwk 50 and 70: every
 * plan receives 10-15 quality sessions. The floor had nothing to catch; what it
 * lacked was the ABILITY to catch it. §110's own text: "a value nothing can
 * falsify is not governed." The sweep confirms the rescope is behaviour-neutral
 * (no new violations), so this test exists to prove the check is now REACHABLE
 * for the cohort it silently excluded.
 *
 * Fourth instance today of a presentation field standing in for a coaching
 * classification (LR-CAP-BLIND-01, SESSION-KM-01/02, V4-ANCHOR-01).
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import type { GeneratorInput, Session } from '@/types/plan'

const ULTRA_EXPERIENCED = {
  athlete_name: 'A', age: 38, race_name: 'T', primary_metric: 'distance',
  plan_start: '2026-04-27', race_date: '2026-10-24', race_distance_km: 100,
  goal: 'finish', resting_hr: 50, max_hr: 182,
  current_weekly_km: 70, longest_recent_run_km: 32, fitness_level: 'experienced',
  recent_quality_training: 'regular', hard_session_relationship: 'neutral',
  injury_history: [], days_available: 5, training_age: '3y+',
} as unknown as GeneratorInput

const fired = (codes: { code: string }[]) =>
  codes.filter(v => v.code === 'INV-PLAN-QUALITY-NOT-ZERO').length

describe('QUALITY-ZERO-SCOPE-01 — §110 floor reaches ultra runners', () => {
  it('an experienced 100K plan is duration-anchored — the shape that used to exempt it', () => {
    const plan = generateRulePlan(ULTRA_EXPERIENCED, 'paid', '2026-04-27')
    // This is what made the old gate skip it. If this ever stops being true the
    // test is no longer proving anything, so it is asserted rather than assumed.
    expect(plan.meta.primary_metric).toBe('duration')
    expect(plan.meta.fitness_intensity_level ?? plan.meta.fitness_level).not.toBe('beginner')
  })

  it('the delivered plan is healthy — the rescope changes no prescription', () => {
    const plan = generateRulePlan(ULTRA_EXPERIENCED, 'paid', '2026-04-27')
    const quality = plan.weeks
      .filter(w => w.n >= 1 && (w.phase === 'build' || w.phase === 'peak'))
      .flatMap(w => Object.values(w.sessions ?? {}).filter(Boolean) as Session[])
      .filter(s => s.type === 'quality')
    expect(quality.length).toBeGreaterThan(0)
    expect(fired(validatePlan(plan, ULTRA_EXPERIENCED))).toBe(0)
  })

  it('CAN FIRE: strip the quality from that same ultra plan and the floor catches it', () => {
    // The falsification. Under the old `primary_metric !== 'duration'` gate this
    // plan stayed silent with every quality session removed — exactly how
    // `suppressQuality` hid zero quality on 2,197 plans before §110.
    const plan = generateRulePlan(ULTRA_EXPERIENCED, 'paid', '2026-04-27')
    for (const w of plan.weeks) {
      for (const [day, s] of Object.entries(w.sessions ?? {})) {
        if (s && s.type === 'quality') {
          ;(w.sessions as Record<string, Session | undefined>)[day] =
            { ...s, type: 'easy', label: 'Easy run — Zone 2' }
        }
      }
    }
    expect(fired(validatePlan(plan, ULTRA_EXPERIENCED))).toBe(1)
  })

  it('a beginner stays exempt — §110 scopes the floor to non-beginners on purpose', () => {
    const beginner = {
      ...ULTRA_EXPERIENCED, race_distance_km: 42.2, fitness_level: 'beginner',
      current_weekly_km: 30, longest_recent_run_km: 14,
      recent_quality_training: 'occasional', training_age: '<6mo',
    } as unknown as GeneratorInput
    const plan = generateRulePlan(beginner, 'paid', '2026-04-27')
    expect(fired(validatePlan(plan, beginner))).toBe(0)
  })
})
