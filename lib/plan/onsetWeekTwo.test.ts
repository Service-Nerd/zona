import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { composePlanWithFoundation } from './foundationCompose'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * §97 — a demonstrated runner's surplus weeks belong inside the plan.
 * Board: CB-ONSET-03, 2026-09-07 — CORRECT WITH AMENDMENT.
 *
 * §76 delays the start when there are surplus weeks and ADR-020 fills the delay
 * with a §57 foundation block — so the runner trains those weeks either way.
 * "Delay the start" does not create rest; it creates training outside the
 * periodisation arc. For a §89-gated runner the plan now extends instead, and
 * the on-ramp shortens to one week with VO2max withheld (Willy's condition).
 */

const FROZEN_NOW = new Date('2026-09-07T09:00:00Z')
const TODAY = '2026-09-07'
const race = (wk: number) => {
  const d = new Date(2026, 8, 7); d.setDate(d.getDate() + wk * 7)
  return d.toISOString().slice(0, 10)
}

/** The founder's live input — the case this ruling was asked for. */
const ready = (o: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_date: race(14), race_distance_km: 10, goal: 'time_target',
  target_time: '0:45:00', benchmark: { type: 'race', distance_km: 10, time: '0:49:00' },
  current_weekly_km: 30, longest_recent_run_km: 10, days_available: 4, age: 44,
  resting_hr: 52, max_hr: 185, preferred_long_run_day: 'sun',
  training_age: '2-5yr', user_declared_level: 'experienced',
  recent_quality_training: 'regular', hard_session_relationship: 'love', ...o,
} as GeneratorInput)

const hasQuality = (w: Plan['weeks'][number]) =>
  Object.values(w.sessions).some(s => s?.type === 'quality')
const calendarOnset = (p: Plan) => p.weeks.findIndex(hasQuality) + 1
const composed = (i: GeneratorInput) =>
  composePlanWithFoundation(generateRulePlan(i, 'paid'), i, TODAY).plan

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('§97 — quality in calendar week 2', () => {
  it('delivers week 2 for the founder\'s live input', () => {
    expect(calendarOnset(composed(ready()))).toBe(2)
  })

  it('the surplus weeks are INSIDE the plan, not a block in front of it', () => {
    const plan = generateRulePlan(ready(), 'paid')
    // Was a 12-week plan behind 3 foundation weeks; now the plan itself is longer.
    expect(plan.weeks.length).toBeGreaterThan(12)
    expect(plan.meta.foundation_weeks_planned).toBeLessThanOrEqual(1)
  })

  it("WILLY'S CONDITION — VO2max is withheld while the on-ramp is one week", () => {
    // The condition of approval, and the reason the one-week on-ramp was
    // acceptable at all. Quality starts in week 2 as a controlled tempo; the
    // first Zone 4-5 session must come later.
    const p = composed(ready())
    const firstQuality = p.weeks.findIndex(hasQuality)
    const firstVo2 = p.weeks.findIndex(w =>
      Object.values(w.sessions).some(s => s?.type === 'quality' && s.stimulus === 'vo2max'))
    expect(firstQuality).toBeGreaterThanOrEqual(0)
    expect(firstVo2, 'a VO2max session must exist to have been withheld').toBeGreaterThan(0)
    expect(firstVo2, 'VO2max must not be the first quality session')
      .toBeGreaterThan(firstQuality)
  })

  it('BUILD KEEPS ITS VO2MAX EXPOSURE — the slot defers, it is not spent', () => {
    // The defect this ruling surfaced. The single build VO2max slot used to be
    // read off the rotation's modulo; when the re-entry window covered that
    // week the slot was consumed and build ended with ZERO VO2max, pushing the
    // first exposure into peak past §5's deadline and firing V2's swap — which
    // carries its own goal-pace defect. One dropped slot, four steps downstream.
    const plan = generateRulePlan(ready(), 'paid')
    const buildVo2 = plan.weeks.filter(w =>
      w.phase === 'build' &&
      Object.values(w.sessions).some(s => s?.type === 'quality' && s.stimulus === 'vo2max'))
    expect(buildVo2.length, 'build must carry its one VO2max exposure').toBe(1)
  })

  it('leaves LONG distances alone — §1\'s ceiling tightens where the on-ramp cannot', () => {
    // Not "the founder races 10K". §1's ceiling descends with distance while a
    // shorter base raises the quality share, so the short on-ramp is affordable
    // only where the ceiling is loose. Measured: a marathon reached 18.4%
    // against an 18% ceiling before this scope was added.
    const marathon = ready({
      race_distance_km: 42.2, race_date: race(20), target_time: '3:30:00',
      current_weekly_km: 60, longest_recent_run_km: 25, days_available: 5,
    })
    const plan = generateRulePlan(marathon, 'paid')
    // Asserted on the ON-RAMP (base + foundation), not on base alone — §91's
    // whole point. A first draft of this test checked base only and failed on a
    // correct plan whose two-week on-ramp was 1 base + 1 foundation week.
    const base = plan.weeks.filter(w => w.n >= 1 && w.phase === 'base').length
    const onRamp = base + (plan.meta.foundation_weeks_planned ?? 0)
    expect(plan.meta.early_quality_onset, 'gate still fires at marathon').toBe(true)
    expect(onRamp, 'marathon keeps the two-week on-ramp floor')
      .toBeGreaterThanOrEqual(GENERATION_CONFIG.MIN_BASE_WEEKS_FLOOR)
  })

  it('leaves every NON-gated runner completely untouched', () => {
    for (const patch of [
      { injury_history: ['Left knee, recurring'] },
      { recent_quality_training: 'none' as const },
      { hard_session_relationship: 'overdo' as const },   // §96's brake
    ]) {
      const plan = generateRulePlan(ready(patch), 'paid')
      expect(plan.meta.early_quality_onset, JSON.stringify(patch)).toBeFalsy()
      // No extension: a non-gated runner's plan stays at idealWeeks.
      expect(plan.weeks.length).toBeLessThanOrEqual(12)
    }
  })

  it('FALSIFICATION — a non-gated runner cannot reach week 2', () => {
    // Proves the outcome rides on the gate and not on something incidental.
    const notReady = ready({ recent_quality_training: 'none' })
    expect(calendarOnset(composed(notReady))).toBeGreaterThan(2)
  })
})
