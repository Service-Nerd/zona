/**
 * RACE-ANCHOR-CV-OVERRIDE-01 — the FIFTH exemption from §22's goal-pace override,
 * and the §22 Amendment that made it shippable (Coaching Board 2026-10-06).
 *
 * 🔴 WHAT BLOCKED IT FOR THREE SITTINGS, and it was never the exemption. §22's
 * ratio requires >=50% of second-half build/peak non-VO2max quality at goal pace.
 * §120 Amendment 1 WITHHOLDS the HM anchor entirely when goal pace is faster than
 * the runner's own CV. For that runner the ratio was only ever satisfied by §22's
 * OWN RENAME repainting CV rows at goal pace — the §19 defect this exemption
 * removes. So removing the rename collapsed the ratio, on a plan the constitution
 * forbids from satisfying it.
 *
 * ⚠️ ARM 3 IS THE ONE THAT MATTERS: both halves or neither. Removing the override
 * without exempting the per-week check puts `INV-PLAN-RACE-SPECIFIC-EXPOSURE` at
 * 439 firings; the previous attempt's 100 red tests were the same fact.
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { catalogueRowFor } from './catalogueLink'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

const PLAN_START = '2026-04-27'
const race = (wk: number) => {
  const d = new Date(2026, 3, 27); d.setDate(d.getDate() + wk * 7)
  return d.toISOString().slice(0, 10)
}

/** The §89 early-onset cell that voided the previous attempt, verbatim from
 *  `earlyQualityOnset.test.ts` — the case "no grid reaches". */
const s89Cell: GeneratorInput = {
  race_date: race(14), race_distance_km: 21.1, goal: 'time_target', target_time: '1:45:00',
  current_weekly_km: 45, longest_recent_run_km: 18, days_available: 4, age: 40,
  resting_hr: 50, max_hr: 186, preferred_long_run_day: 'sun',
  // ⚠️ NO `plan_start` IN THE INPUT — `base10k` omits it and passes it as the
  // third argument only. Setting it here changed the plan's length and the ratio
  // read 4/5 instead of the recorded 2/5, so the falsification arm could not fail.
  training_age: '5yr+', user_declared_level: 'experienced', recent_quality_training: 'regular',
} as unknown as GeneratorInput

const sessionsOf = (p: Plan): Session[] =>
  p.weeks.flatMap(w => Object.values(w.sessions).filter((s): s is Session => s != null))

describe('§85 Am. / §22 Am. — the CV exemption', () => {
  it('a CV row keeps CV pace: the header no longer disagrees with the work', () => {
    const p = generateRulePlan(s89Cell, 'paid', PLAN_START)
    const cv = sessionsOf(p).filter(s =>
      catalogueRowFor(s, V1_SESSION_CATALOGUE)?.id === 'cv_intervals')
    // The population guard: if the engine stops placing cv_intervals for this
    // runner, this test measures nothing and must say so rather than pass.
    expect(cv.length, 'no cv_intervals placed — the fixture has gone stale').toBeGreaterThan(0)
    // §19: it must NOT be renamed to a race-distance label.
    for (const s of cv) expect(String(s.label)).not.toMatch(/pace/i)
  })

  it('the §89 cell that voided the previous attempt now validates clean', () => {
    const p = generateRulePlan(s89Cell, 'paid', PLAN_START)
    // §120 Am.1 withheld this runner's goal anchor — goal 4:59/km is past their CV.
    expect(p.meta.hm_goal_anchor_withheld).toBe(true)
    const errs = validatePlan(p, s89Cell).filter(v => v.severity === 'error')
    expect(errs.map(v => v.code)).toEqual([])
  })

  it('ARM 3 — a CV-anchored session leaves §22\'s DENOMINATOR, not just its numerator', () => {
    // 🔴 THIS IS THE ARM THAT MATTERS, and getting it wrong cost 143 violations.
    // The first cut exempted CV rows from §22's override (the numerator) and left
    // them in the ratio's denominator. That is arithmetically guaranteed to fail,
    // and it did: **143 NEW error-severity violations, every one at 5K**, reading
    // "33% (1/3)". The invariant's own comment explains why 5K was the cohort — at
    // 5K the ratio was satisfied *because* the rename painted goal pace on
    // everything ("168 of 168 ... at 0% delta").
    //
    // ⚠️ AND A PLAN-LEVEL EXEMPTION WAS BUILT FOR THIS AND REMOVED. I first exempted
    // any plan carrying `hm_goal_anchor_withheld`, copying the §93 Am.1 pattern from
    // an hour earlier. With the denominator correct it was DEAD — all 17 affected
    // tests pass without it — and it would have switched §22 off for 496 of 5,664
    // plans. **The remedy was arithmetic; I reached for the shape of the last fix.**
    //
    // 5K is the cohort, so 5K is what this asserts.
    const fiveK = {
      race_date: race(12), race_distance_km: 5, goal: 'time_target', target_time: '0:22:00',
      current_weekly_km: 25, longest_recent_run_km: 10, days_available: 4, age: 46,
      resting_hr: 50, max_hr: 186, preferred_long_run_day: 'sun',
      training_age: '5yr+', user_declared_level: 'experienced', recent_quality_training: 'regular',
    } as unknown as GeneratorInput
    // Under NODE_ENV=test an error-severity violation throws, so a clean
    // generation IS the assertion. Leaving CV rows in the denominator makes this
    // throw with "Goal-pace ratio ... 33% (1/3)".
    expect(() => generateRulePlan(fiveK, 'paid', PLAN_START)).not.toThrow()
    const p = generateRulePlan(fiveK, 'paid', PLAN_START)
    expect(validatePlan(p, fiveK).filter(v => v.severity === 'error').map(v => v.code)).toEqual([])
  })

  it('a runner whose goal is WITHIN their CV is untouched by any of this', () => {
    // 2:00 off the same profile: goal pace sits behind CV, so the anchor resolves,
    // the ratio applies, and the plan must still satisfy it.
    const within = { ...s89Cell, target_time: '2:00:00' } as GeneratorInput
    const p = generateRulePlan(within, 'paid', PLAN_START)
    expect(p.meta.hm_goal_anchor_withheld).toBeUndefined()
    expect(validatePlan(p, within).filter(v => v.severity === 'error').map(v => v.code)).toEqual([])
  })
})
