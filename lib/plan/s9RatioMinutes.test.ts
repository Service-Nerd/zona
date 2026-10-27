import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan, validateReshapedPlan } from './invariants'
import { isLongRun, isShakeout } from './sessionRole'
import { COHORT_PLAN_START } from './cohortGrid'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan, Session, Week } from '@/types/plan'

// S9-RATIO-MINUTES-01 (§9 Amendment 2, Coaching Board 2026-10-27). §9's long-vs-easy
// ratio ran in km only, so a duration-anchored plan (beginners; every ultra) was never
// checked. These cases are the ones the build measured, not invented ones.

const CODE = 'INV-PLAN-LONG-IS-LONGEST-MINS'
const RATIO = GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY

// cohort k602: a declared-beginner marathoner at 70 km/week on 4 days. Before the fix,
// week 10 carried a 157-min long run beside two 156-min "easy" runs.
const K602 = {
  athlete_name: 'Athlete', age: 52, race_name: 'Test', primary_metric: 'distance',
  race_distance_km: 42.2, race_date: '2026-08-29', goal: 'time_target', target_time: '4:15:00',
  resting_hr: 55, max_hr: 184, current_weekly_km: 70, longest_recent_run_km: 28,
  fitness_level: 'beginner', recent_quality_training: 'regular', hard_session_relationship: 'neutral',
  injury_history: [], training_age: '2-5yr', days_available: 4, days_cannot_train: [],
} as unknown as GeneratorInput

// The two use-case-envelope 100K plans the first cut failed: V4's "increment" and the
// deload long-run "raise" each SHORTENED a duration-anchored long run (420 → 416, 312 → 308).
const ULTRA_100K = (age: number, race_date: string, injury: string) => ({
  athlete_name: 'Envelope', age, race_name: 'Target race', primary_metric: 'distance',
  race_distance_km: 100, race_date, plan_start: '2026-11-02', goal: 'time_target', target_time: '14:00:00',
  fitness_level: 'beginner', training_age: '6-18mo', resting_hr: 55, max_hr: 185,
  current_weekly_km: 120, longest_recent_run_km: 54, days_available: 3, injury_history: [injury],
  hard_session_relationship: 'neutral', recent_quality_training: 'occasional',
  acknowledged_days_warning: true, acknowledged_prep_warning: true,
}) as unknown as GeneratorInput

const longRun = (w: Week) => Object.values(w.sessions).find(s => s && isLongRun(s)) as Session | undefined
// The checker's own population: easy, not the long run, not a shakeout.
const easies = (w: Week) => (Object.values(w.sessions).filter(s => s && s.type === 'easy' && !isLongRun(s) && !isShakeout(s)) as Session[])

describe('§9 Amendment 2 — the long-vs-easy ratio binds in minutes', () => {
  it('k602 generates clean, and every duration-anchored easy run sits under the long run ÷ 1.25', () => {
    const plan = generateRulePlan(K602, 'paid', COHORT_PLAN_START) // throws in test on any error
    let checked = 0
    for (const w of plan.weeks.filter(w => w.n > 0 && w.type !== 'race')) {
      const lr = longRun(w)
      if (!lr || lr.duration_mins == null) continue
      for (const e of easies(w)) {
        if (e.distance_km != null || e.duration_mins == null) continue
        expect(e.duration_mins * RATIO, `week ${w.n}`).toBeLessThanOrEqual(lr.duration_mins + 0.5 * RATIO + 0.5)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(20) // the population is real, not vacuous
    const w10 = plan.weeks.find(w => w.n === 10)!
    // The before-state was 156 beside 157; after, the easy runs sit at the ratio's ceiling.
    expect(Math.max(...easies(w10).map(e => e.duration_mins ?? 0))).toBeLessThanOrEqual(Math.floor(longRun(w10)!.duration_mins! / RATIO))
  })

  it.each([[38, '2027-05-17', 'achilles'], [28, '2027-07-12', 'shin_splints']])(
    'the 100K envelope plan (age %s, %s, %s) generates clean: an increment or raise never shortens a minutes long run',
    (age, date, inj) => {
      expect(() => generateRulePlan(ULTRA_100K(age, date, inj), 'paid', '2026-11-02')).not.toThrow()
    })

  it('the checker fires on an easy run as long as the long run (falsified on a real plan)', () => {
    const plan = generateRulePlan(K602, 'paid', COHORT_PLAN_START)
    const w = plan.weeks.find(w => w.n === 10)!
    const e = easies(w)[0]
    expect(validatePlan(plan, K602).some(v => v.code === CODE)).toBe(false)
    e.duration_mins = longRun(w)!.duration_mins
    const hit = validatePlan(plan, K602).filter(v => v.code === CODE)
    expect(hit.length).toBe(1)
    expect(hit[0].week).toBe(10)
    expect(hit[0].severity).toBe('error')
  })

  it('the tolerance is rounding, not a margin: inside the bound passes, one minute past it fires', () => {
    const plan = generateRulePlan(K602, 'paid', COHORT_PLAN_START)
    const w = plan.weeks.find(w => w.n === 10)!
    const lrMins = longRun(w)!.duration_mins!
    const e = easies(w)[0]
    e.duration_mins = Math.floor((lrMins + 0.5 * RATIO + 0.5) / RATIO)
    expect(validatePlan(plan, K602).some(v => v.code === CODE && v.week === 10)).toBe(false)
    e.duration_mins += 1
    expect(validatePlan(plan, K602).some(v => v.code === CODE && v.week === 10)).toBe(true)
  })

  it('a km easy run beside a minutes long run is not compared (no pace in the checker)', () => {
    const plan = generateRulePlan(K602, 'paid', COHORT_PLAN_START)
    const w = plan.weeks.find(w => w.n === 10)!
    const e = easies(w)[0]
    e.duration_mins = longRun(w)!.duration_mins
    e.distance_km = 20
    expect(validatePlan(plan, K602).some(v => v.code === CODE && v.week === 10)).toBe(false)
  })

  it('a km long run beside a minutes easy run IS compared (code review: 1,755 such cohort weeks)', () => {
    const plan = generateRulePlan(K602, 'paid', COHORT_PLAN_START)
    const w = plan.weeks.find(w => w.n === 10)!
    const lr = longRun(w)!
    lr.distance_km = 20
    easies(w)[0].duration_mins = lr.duration_mins
    expect(validatePlan(plan, K602).some(v => v.code === CODE && v.week === 10)).toBe(true)
  })

  it('a reshape is held to it on the week it touched, not on a stored breach elsewhere', () => {
    const plan = generateRulePlan(K602, 'paid', COHORT_PLAN_START) as Plan
    const w = plan.weeks.find(w => w.n === 10)!
    easies(w)[0].duration_mins = longRun(w)!.duration_mins
    expect(validateReshapedPlan(plan, 10).some(v => v.code === CODE)).toBe(true)
    expect(validateReshapedPlan(plan, 11).some(v => v.code === CODE)).toBe(false)
  })
})
