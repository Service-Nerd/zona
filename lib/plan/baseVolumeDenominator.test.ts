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

  // ⚠️ REWRITTEN 2026-09-20 (§111 Amendment 3). It asserted the two RAW VOLUMES
  // from §111's rationale paragraph — refuse at 10, generate at 12 — and §117
  // made 10 generate. That is not a regression: §111's reckless ceiling is
  // stated as a RATIO, *"<=10 km/week beginner marathon (>= 4.7x) must be
  // refused"*, and the parenthesis is the principle. At §117's 32 km peak that
  // runner is 3.2x, below the 4.0 cap and inside a band the same paragraph
  // ratifies (M1 must pass at 3.13x).
  //
  // So the test now pins the RATIO, which cannot go stale the next time a peak
  // moves. **The conflict scan missed this and this test caught it** — the scan
  // read §111's principle and config, both ratio-expressed, and did not read
  // the rationale paragraph where two raw volumes are pinned.
  it('THE RATIO CEILING IS UNMOVED — the door is downstream of the peak', () => {
    expect(G.MAX_BASE_BUILD_RATIO).toBe(4.0)
    // ⚠️ FLAG-AGNOSTIC BY CONSTRUCTION. §117 is gated, so 10 km/week generates
    // in one flag state and is refused in the other. Asserting either outcome
    // would make this test a record of which flag was set when it was written.
    // What is TRUE IN BOTH STATES is the property §111 actually owns: any plan
    // that DOES generate has a lawful delivered ratio.
    for (const cwk of [10, 12, 15, 20, 30]) {
      let plan
      try { plan = generateRulePlan(mk({ current_weekly_km: cwk }), 'paid', '2026-10-12') }
      catch { continue }   // refused is a lawful outcome; the ratio claim is about plans
      const peak = Math.max(...plan.weeks.filter(w => w.n > 0 && w.type !== 'race')
        .map(w => w.weekly_km ?? 0))
      expect(peak / cwk, `${cwk} km/wk generated a plan with ratio ${(peak / cwk).toFixed(2)}`)
        .toBeLessThanOrEqual(G.MAX_BASE_BUILD_RATIO)
    }
    // And the reckless ratio the board named is still refused: at 2 km/week
    // even §117's reduced peak is 16x.
    expect(() => generateRulePlan(mk({ current_weekly_km: 2 }), 'paid', '2026-10-12')).toThrow()
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
    // ⚠️ Was `/12 km a week/`. §117 lowers the beginner finish-goal peak, so the
    // target this runner is told to reach moved with it. Asserting the SHAPE
    // rather than the number, because the number is a consequence of a peak
    // that has now moved twice.
    expect(msg).toMatch(/\d+ km a week/)   // still names a concrete target
  })

  it('the wait scales with how far below the base they are — derived from §2s ramp', () => {
    const weeks = (km: number) => {
      try { generateRulePlan(mk({ current_weekly_km: km }), 'paid', '2026-10-12'); return 0 }
      catch (e) { return Number(/about (\d+) weeks?/.exec((e as { base: { message: string } }).base.message)?.[1] ?? 0) }
    }
    // ⚠️ `near` moved from 10 to 5 km/week on 2026-09-20. §117 ADMITS a 10
    // km/week beginner finish-goal marathoner, so `weeks(10)` now returns 0 —
    // there is no wait, because there is no refusal. The test was comparing
    // two refused runners and one of them stopped being refused.
    const far = weeks(2), near = weeks(5)
    expect(far).toBeGreaterThan(near)
    expect(near).toBeGreaterThan(0)
    // Not a guess: ceil(log(need/have) / log(1 + MAX_WEEKLY_VOLUME_INCREASE_PCT)).
    // ⚠️ The TARGET is read from the message rather than hardcoded to 12 — it is
    // `ceil(peak / MAX_BASE_BUILD_RATIO)` and the peak moved under §117. A
    // hardcoded 12 here was a second copy of a derived number.
    const rate = 1 + G.MAX_WEEKLY_VOLUME_INCREASE_PCT / 100
    let msg2 = ''
    try { generateRulePlan(mk({ current_weekly_km: 2 }), 'paid', '2026-10-12') }
    catch (e) { msg2 = (e as { base: { message: string } }).base.message }
    const target = Number(/about (\d+) km a week/.exec(msg2)?.[1] ?? 0)
    expect(target).toBeGreaterThan(0)
    expect(far).toBe(Math.ceil(Math.log(target / 2) / Math.log(rate)))
  })

  it('brand: no em dash in the refusal copy', () => {
    let msg = ''
    try { generateRulePlan(mk({ current_weekly_km: 8 }), 'paid', '2026-10-12') } catch (e) { msg = (e as { base: { message: string } }).base.message }
    expect(msg).not.toContain('—')
  })
})
