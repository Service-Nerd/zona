import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { composePlanWithFoundation } from './foundationCompose'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan, Week } from '@/types/plan'

/**
 * FRESH-FLOOR-01 — a foundation week smaller than one session's floor.
 *
 * §29's fresh-from-layoff path treats `current_weekly_km` as ASPIRATIONAL and
 * starts at FRESH_RETURN_START_FRACTION (0.7) of it. At 5 km/week that is a
 * 3.5 km week. §52b day-fitting correctly reduces it to ONE run — and that run
 * IS the week, at 3.5 km against MIN_SESSION_DISTANCE_KM.easy of 4.
 *
 * §52b has nothing left to give (it reduces days; one day is the minimum), so
 * this is D-21: a floor a valid input cannot satisfy is a defect in the code
 * enforcing it, not an acceptable session. Held at the floor — the remedy §82
 * already ruled for the weekday cap, one field over.
 *
 * HOW IT WAS FOUND, which is the part worth keeping: `weeks_at_current_volume`
 * had been on GeneratorInput since M-02 and was never once set by the property
 * sweep, so §29's whole path was unreachable. The input-coverage gate added it
 * and 1,426 violations across 660 of 16,141 plans appeared immediately. The
 * tests were not wrong; they were looking elsewhere.
 */

const PLAN_START = '2026-04-27'

// The exact profile from the sweep's own EXPLAIN dump, minus the fields that do
// not bear on it. `weeks_at_current_volume: 7` is below FRESH_RETURN_WEEKS_
// THRESHOLD (8), which is what arms §29.
const FRESH_RETURNER: GeneratorInput = {
  race_date: '2026-07-20', race_distance_km: 10, goal: 'time_target',
  target_time: '0:45:00', days_available: 4, age: 35,
  current_weekly_km: 5, longest_recent_run_km: 3,
  resting_hr: 55, max_hr: 184, preferred_long_run_day: 'sat',
  fitness_level: 'experienced', weeks_at_current_volume: 7,
} as GeneratorInput

const MIN_EASY = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.easy

function composed(input: GeneratorInput, gapDays = 10) {
  const plan = generateRulePlan(input, 'paid', PLAN_START)
  const planStart = plan.weeks.find(w => w.n === 1)?.date ?? PLAN_START
  const today = new Date(new Date(planStart).getTime() - gapDays * 86_400_000)
    .toISOString().slice(0, 10)
  return composePlanWithFoundation(plan, input, today, 'add')
}
const foundationWeeks = (p: Plan): Week[] => p.weeks.filter(w => w.n <= 0)
const runsOf = (w: Week) => Object.values(w.sessions).filter(Boolean) as { distance_km?: number }[]

describe('FRESH-FLOOR-01 — a week smaller than one session', () => {
  it('the profile actually reaches §29 (guards the premise)', () => {
    // If FRESH_RETURN_WEEKS_THRESHOLD or the start fraction ever move, this
    // profile may stop being a fresh return and every assertion below would
    // silently stop testing anything — the §79-PEAKKM lesson.
    expect(FRESH_RETURNER.weeks_at_current_volume!)
      .toBeLessThan(GENERATION_CONFIG.FRESH_RETURN_WEEKS_THRESHOLD)
    const budget = FRESH_RETURNER.current_weekly_km
      * (GENERATION_CONFIG as unknown as { FRESH_RETURN_START_FRACTION: number }).FRESH_RETURN_START_FRACTION
    expect(budget, 'the fresh-return budget is no longer below the easy floor — profile is stale')
      .toBeLessThan(MIN_EASY)
  })

  it('holds the single session at the floor rather than shipping one below it', () => {
    const r = composed(FRESH_RETURNER)
    const weeks = foundationWeeks(r.plan)
    expect(weeks.length, 'no foundation block — test reaches nothing').toBeGreaterThan(0)
    for (const w of weeks) {
      for (const s of runsOf(w)) {
        expect(s.distance_km!, `W${w.n} session below the easy floor`).toBeGreaterThanOrEqual(MIN_EASY)
      }
    }
  })

  it('states a weekly_km that matches its own sessions', () => {
    // The floor-hold without this is a claim/computation mismatch: a 3.5 km week
    // containing a 4 km run.
    for (const w of foundationWeeks(composed(FRESH_RETURNER).plan)) {
      const sum = runsOf(w).reduce((a, s) => a + (s.distance_km ?? 0), 0)
      expect(w.weekly_km, `W${w.n} states ${w.weekly_km} but contains ${sum}`)
        .toBeGreaterThanOrEqual(sum - 0.01)
    }
  })

  it('raises no error violations, INV-PLAN-FOUNDATION-BLOCK included', () => {
    // The floor-hold pushes the week above its fresh-return budget, which is
    // exactly what the foundation volume ceiling guards. Both must hold at once.
    const errs = composed(FRESH_RETURNER).violations.filter(v => v.severity === 'error')
    expect(errs.map(v => `${v.code} W${v.week}`)).toEqual([])
  })

  it('leaves an ordinary-volume foundation week untouched', () => {
    // The fix must bind ONLY where the week cannot hold one floor-sized session.
    // A first attempt derived weekly_km by summing (rounded) session distances,
    // which moved EVERY foundation week's stated volume and broke a real stored
    // plan in the corpus test. Pinned so that cannot return.
    const ordinary = { ...FRESH_RETURNER, current_weekly_km: 40, longest_recent_run_km: 12 }
    const r = composed(ordinary)
    expect(r.violations.filter(v => v.severity === 'error')).toEqual([])
    for (const w of foundationWeeks(r.plan)) {
      // Budget-derived, not session-sum-derived: a rounded sum would drift.
      expect(w.weekly_km).toBeGreaterThan(MIN_EASY)
      for (const s of runsOf(w)) expect(s.distance_km!).toBeGreaterThanOrEqual(MIN_EASY)
    }
  })

  it('a runner NOT on the fresh-return path is unaffected', () => {
    const settled = { ...FRESH_RETURNER, weeks_at_current_volume: 20 }
    expect(composed(settled).violations.filter(v => v.severity === 'error')).toEqual([])
  })
})
