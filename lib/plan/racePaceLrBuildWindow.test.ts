import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { COHORT_PLAN_START, cohortGrid } from './cohortGrid'
import { isLongRun } from './sessionRole'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan } from '@/types/plan'

// §25 Amendment 2 — the race-pace long run reaches the final
// RACE_PACE_LR_BUILD_WEEKS non-deload build weeks, and NEVER three consecutive.
//
// ⚠️ THE INJURY COHORT IS CONSTRUCTED, AND IT HAS TO BE. `cohortGrid()` contains
// ZERO time-targeted HM/marathon plans with an injury history — measured: 0 of
// 8,592. Willy made "does an injury flag change who receives this?" a blocking
// condition of the dose, and a gate pointed at the grid could not have answered
// it. Same correction `measure:fitness` had to make for injury x masters.
const CODE = 'INV-PLAN-RACE-PACE-LR-BUILD-WINDOW'

function mk(dist: number, level: string, injury: string[]): GeneratorInput {
  return {
    race_distance_km: dist, race_date: '2027-03-14', fitness_level: level,
    current_weekly_km: 45, longest_recent_run_km: 18, days_available: 5,
    days_cannot_train: [], age: 38, goal: 'time_target', goal_type: 'time',
    target_time: dist === 42.2 ? '03:45:00' : '01:45:00',
    training_age: '2-5yr', recent_quality_training: 'regular',
    metric: 'distance', injury_history: injury,
  } as unknown as GeneratorInput
}

const segWeeks = (plan: Plan) => plan.weeks.filter(w =>
  w.n >= 1 && Object.values(w.sessions ?? {}).some(s => s && isLongRun(s) && Boolean(s.lr_segment_pace)))

const longestRun = (plan: Plan) => {
  let run = 0, worst = 0
  for (const w of plan.weeks.filter(x => x.n >= 1)) {
    const seg = Object.values(w.sessions ?? {}).some(s => s && isLongRun(s) && Boolean(s.lr_segment_pace))
    run = seg ? run + 1 : 0
    if (run > worst) worst = run
  }
  return worst
}

describe('§25 Am. 2 — the race-pace long run in the final build week', () => {
  it('a time-targeted HM/marathon plan now carries one in BUILD', () => {
    for (const dist of [21.1, 42.2]) {
      const plan = generateRulePlan(mk(dist, 'intermediate', []), 'paid', COHORT_PLAN_START)
      const inBuild = segWeeks(plan).filter(w => w.phase === 'build')
      expect(inBuild.length, `${dist}km should carry a build race-pace long run`).toBe(
        GENERATION_CONFIG.RACE_PACE_LR_BUILD_WEEKS)
    }
  })

  it('and it sits inside the sharpening window, never earlier', () => {
    for (const dist of [21.1, 42.2]) {
      const input = mk(dist, 'intermediate', [])
      const plan = generateRulePlan(input, 'paid', COHORT_PLAN_START)
      expect(validatePlan(plan, input).filter(v => v.code === CODE)).toEqual([])
    }
  })

  it('NEVER three consecutive weeks — Willy’s hard limit', () => {
    for (const dist of [21.1, 42.2]) {
      for (const level of ['intermediate', 'experienced']) {
        const plan = generateRulePlan(mk(dist, level, []), 'paid', COHORT_PLAN_START)
        expect(longestRun(plan), `${dist}km ${level}`).toBeLessThanOrEqual(2)
      }
    }
  })

  it('an injury history does not INCREASE the dose — Willy’s blocking condition', () => {
    // The constructed cell. An injury flag may REDUCE what a runner gets (peak
    // length differs); it must never give them more.
    for (const dist of [21.1, 42.2]) {
      for (const level of ['intermediate', 'experienced']) {
        const healthy = generateRulePlan(mk(dist, level, []), 'paid', COHORT_PLAN_START)
        for (const injury of [['knee'], ['shin_splints'], ['achilles']]) {
          const injured = generateRulePlan(mk(dist, level, injury), 'paid', COHORT_PLAN_START)
          expect(longestRun(injured), `${dist}km ${level} ${injury[0]} consecutive`).toBeLessThanOrEqual(2)
          expect(segWeeks(injured).length, `${dist}km ${level} ${injury[0]} total`)
            .toBeLessThanOrEqual(segWeeks(healthy).length)
        }
      }
    }
  })

  it('the invariant can FIRE — a third consecutive week is caught', () => {
    // Falsification: forge a third consecutive segmented week and require the
    // consecutive arm to go red. Without this the arm above passes because the
    // engine happens not to produce one, which is not the same as being checked.
    const input = mk(42.2, 'experienced', [])
    const plan = generateRulePlan(input, 'paid', COHORT_PLAN_START)
    const segs = segWeeks(plan)
    expect(segs.length, 'fixture must carry at least one').toBeGreaterThan(0)
    const first = segs[0]
    const donor = Object.entries(first.sessions ?? {}).find(([, s]) => s && isLongRun(s) && s.lr_segment_pace)!
    const main = plan.weeks.filter(w => w.n >= 1)
    const idx = main.findIndex(w => w.n === first.n)
    const forged: Plan = {
      ...plan,
      weeks: plan.weeks.map(w => {
        const k = main.findIndex(m => m.n === w.n)
        if (k < idx || k > idx + 2) return w
        return { ...w, sessions: { ...w.sessions, [donor[0]]: donor[1] } }
      }),
    }
    const fired = validatePlan(forged, input).filter(v => v.code === CODE)
    expect(fired.length, 'three consecutive race-pace long runs must be caught').toBeGreaterThan(0)
    expect(fired.some(v => /CONSECUTIVE/.test(v.message ?? ''))).toBe(true)
  })

  it('lands on the LAST NON-DELOAD build week, not merely the final one', () => {
    // The distance-split sitting's correction. The first window was the calendar
    // one and skipped the session whenever a deload landed on it: 50.7% of
    // MARATHON plans against 0.2% of HM. So a marathon plan whose final build
    // week is a deload must STILL carry the session, one week earlier.
    let checked = 0
    for (const g of cohortGrid()) {
      if (g.race_distance_km !== 42.2 || g.goal !== 'time_target') continue
      // A designed refusal (e.g. DaysAvailableError) is not this gate's subject.
      let plan: Plan
      try { plan = generateRulePlan(g, 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch { continue }
      const build = plan.weeks.filter(w => w.n >= 1 && w.phase === 'build')
      const last = build[build.length - 1]
      if (!last || (last.type !== 'deload' && last.badge !== 'deload')) continue
      checked++
      expect(segWeeks(plan).filter(w => w.phase === 'build').length,
        'a marathon plan whose final build week is a deload must still get the session')
        .toBe(GENERATION_CONFIG.RACE_PACE_LR_BUILD_WEEKS)
      if (checked >= 8) break
    }
    // The population arm: if no such plan exists the assertion above is vacuous.
    expect(checked, 'the grid must contain marathon plans whose final build week is a deload')
      .toBeGreaterThan(0)
  })

  it('does not fire on a finish-goal plan, whose long run is aerobic by design', () => {
    const g = cohortGrid().find(x => x.goal !== 'time_target'
      && (x.race_distance_km === 21.1 || x.race_distance_km === 42.2))
    if (!g) return
    const plan = generateRulePlan(g, 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
    expect(validatePlan(plan, g).filter(v => v.code === CODE)).toEqual([])
  })
})
