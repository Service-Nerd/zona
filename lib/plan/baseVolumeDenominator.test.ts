/**
 * §111 Amendment 2 — the base-build gate divides by the volume the engine
 * actually STARTS from, and the refusal carries a return trigger.
 *
 * Ruled by BOTH boards on 2026-09-19: Coaching Board CORRECT (unanimous),
 * SLT SHIP NOW (unanimous), with Wood's return-trigger condition attached.
 *
 * ⚠️ MEASURED COST, ACCEPTED: +456 beginner-marathon refusals (2,321 -> 2,777
 * of 6,480). The boards ruled on what those runners were getting instead — a
 * median 5.57x build off their real base and a +114% week-one volume jump,
 * with ZERO invariant violations, which is the check measuring the wrong thing.
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { assessBaseBuild } from './baseVolume'
import { effectiveStartKm } from './startVolume'
import { GENERATION_CONFIG as G } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

const mk = (o: Record<string, unknown>) => ({
  athlete_name: 'A', race_name: 'T', primary_metric: 'distance', plan_start: '2026-10-12',
  race_distance_km: 42.2, race_date: '2027-04-25', goal: 'finish',
  resting_hr: 55, max_hr: 184, longest_recent_run_km: 3, fitness_level: 'beginner',
  training_age: '6-12mo', recent_quality_training: 'none',
  hard_session_relationship: 'neutral', injury_history: [], days_available: 4, age: 35,
  ...o,
} as unknown as GeneratorInput)

describe('§111 Am.2 — the denominator', () => {
  it('divides by effectiveStartKm, not the raw wizard figure', () => {
    // A fresh returner declaring 20 starts at 14 (§29). The gate must score the
    // build they will actually do, which is the larger ratio.
    const input = mk({ current_weekly_km: 20, weeks_at_current_volume: 1, training_age: '5yr+', fitness_level: 'intermediate' })
    const eff = effectiveStartKm(input)
    expect(eff).toBeLessThan(20)
    let assessed: ReturnType<typeof assessBaseBuild> | null = null
    try { assessed = assessBaseBuild(generateRulePlan(input, 'paid', '2026-10-12'), input) } catch { /* refused is also a valid outcome */ }
    if (assessed) expect(assessed.currentKm).toBeCloseTo(eff, 5)
  })

  it('THE DOOR IS UNMOVED for a runner whose start equals their declaration', () => {
    // §111's ratified ceiling: <=10 km/week beginner marathon must be refused,
    // 12 km/week must generate. The correction must not shift that — it only
    // bites where §29 or §10 change the start.
    expect(() => generateRulePlan(mk({ current_weekly_km: 10 }), 'paid', '2026-10-12')).toThrow()
    expect(() => generateRulePlan(mk({ current_weekly_km: 12 }), 'paid', '2026-10-12')).not.toThrow()
  })

  it('⚠️ the CAP must not be raised to absorb the correction', () => {
    // Measured and reverted 2026-09-19: cap 5.0 holds the refusal COUNT flat
    // (1,004 vs 1,001) while changing its COMPOSITION, and admits the 10 km/week
    // beginner marathoner §111 says must be refused. A flat total hid it.
    expect(G.MAX_BASE_BUILD_RATIO).toBe(4.0)
  })
})

describe('§111 Am.2 — the refusal carries a RETURN TRIGGER (Wood)', () => {
  it('names WHEN to come back, not only what to reach', () => {
    // "A number plus 'come back' is a goal, and goals do not change behaviour."
    // The date is the context cue that makes it an intervention.
    const input = mk({ current_weekly_km: 5 })
    let msg = ''
    try { generateRulePlan(input, 'paid', '2026-10-12') } catch (e) { msg = (e as { base: { message: string } }).base.message }
    expect(msg).toMatch(/\d+ weeks?/)
    expect(msg).toMatch(/come back/i)
    expect(msg).toMatch(/12 km a week/)   // still names the target
  })

  it('the wait scales with how far below the base they are — derived from §2s ramp', () => {
    const weeks = (km: number) => {
      try { generateRulePlan(mk({ current_weekly_km: km }), 'paid', '2026-10-12'); return 0 }
      catch (e) { return Number(/about (\d+) weeks?/.exec((e as { base: { message: string } }).base.message)?.[1] ?? 0) }
    }
    const far = weeks(5), near = weeks(10)
    expect(far).toBeGreaterThan(near)
    expect(near).toBeGreaterThan(0)
    // Not a guess: ceil(log(need/have) / log(1 + MAX_WEEKLY_VOLUME_INCREASE_PCT))
    const rate = 1 + G.MAX_WEEKLY_VOLUME_INCREASE_PCT / 100
    expect(far).toBe(Math.ceil(Math.log(12 / 5) / Math.log(rate)))
  })

  it('brand: no em dash in the refusal copy', () => {
    let msg = ''
    try { generateRulePlan(mk({ current_weekly_km: 8 }), 'paid', '2026-10-12') } catch (e) { msg = (e as { base: { message: string } }).base.message }
    expect(msg).not.toContain('—')
  })
})
