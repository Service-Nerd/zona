import { describe, it, expect } from 'vitest'
import { GENERATION_CONFIG as G } from './generationConfig'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { isLongRun } from './sessionRole'
import { sessionKmSelfPaced } from './sessionDistance'
import type { GeneratorInput, Plan, Week } from '@/types/plan'

/**
 * §3 Amendment — LR-DELOAD-CUT-01 (Coaching Board 2026-09-17).
 *
 * §3 says volume drops to 70% "of the prior build week" — about the WEEK. The
 * long run was cut HARDER than the week on 50.4% of 2,817 deloads (week median
 * 22%, long run median 30%), then had to climb all the way back and ran out of
 * weeks. Root cause of every marathon shortfall left after PLAN-FITNESS-01.
 */
const PLAN_START = '2026-09-21'
const km = (s: unknown) => sessionKmSelfPaced(s as never) ?? 0
const lrOf = (w: Week) => km(Object.values(w.sessions).find(s => s && isLongRun(s)))
const isDl = (w: Week) => w.type === 'deload' || w.badge === 'deload'

const runner = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  athlete_name: 'R', age: 52, race_name: 'M', primary_metric: 'distance',
  plan_start: PLAN_START, race_distance_km: 42.2, race_date: '2027-01-24', goal: 'finish',
  resting_hr: 52, max_hr: 182, current_weekly_km: 30, longest_recent_run_km: 14,
  fitness_level: 'intermediate', recent_quality_training: 'occasional',
  hard_session_relationship: 'neutral', training_age: '2-5yr',
  days_available: 4, days_cannot_train: [], injury_history: ['knee'],
  ...over,
} as unknown as GeneratorInput)
const gen = (i: GeneratorInput) => generateRulePlan(i, 'trial', PLAN_START, undefined, PLAN_START)

describe('§3 Am. — a deload cuts the long run no harder than the week', () => {
  it('the deload long run is not cut disproportionately', () => {
    const plan = gen(runner())
    const ws = plan.weeks.filter(w => w.n >= 1)
    let checked = 0
    for (let i = 1; i < ws.length; i++) {
      const prev = ws[i - 1]!, curr = ws[i]!
      if (!isDl(curr) || isDl(prev) || curr.type === 'race') continue
      if (prev.weekly_km <= 0 || lrOf(prev) <= 0) continue
      // ⚠️ SKIP weeks where the DELIVERED deload did not actually reduce. On a
      // measured ~3.5% of plans a deload week delivers MORE than the week before
      // it — session floors and the race-anchored long run size independently of
      // the curve. That is INV-PLAN-DELOAD-IS-A-REDUCTION's known-open residual
      // (§34, declared and exercised), not this amendment's business, and a
      // cut-ratio comparison against a week that grew is meaningless: w9 of this
      // fixture cuts the long run 16% against a week that GREW 6%.
      if (curr.weekly_km >= prev.weekly_km) continue
      const weekCut = (prev.weekly_km - curr.weekly_km) / prev.weekly_km
      const lrCut = (lrOf(prev) - lrOf(curr)) / lrOf(prev)
      // Tolerance absorbs the 0.5km rounding step on a small long run, plus the
      // §52/§9 bounds legitimately cutting deeper on a lopsided or capped week.
      // ⚠️ 0.15 -> 0.25 on 2026-09-19 (§114), and the reason is in this test's
      // own comment two lines up: the tolerance exists to absorb "the §52/§9
      // bounds legitimately cutting deeper on a lopsided or capped week", and
      // §114 is exactly such a bound — now binding at construction rather than
      // warning after the fact. Measured worst case: a 22% long-run cut against
      // a 5% week cut, where the pre-deload long run was bounded to 60% of its
      // week and the deload's was not.
      //
      // ⚠️ A TOLERANCE THAT KEEPS GROWING IS A CHECK BEING SWITCHED OFF, which
      // this repo recorded during STEPBACK-STALE-PEAK-01. If it needs widening
      // a third time, bound the DELOAD long run against the same share instead.
      expect(lrCut, `w${curr.n}: long run cut ${(lrCut * 100).toFixed(0)}% vs week ${(weekCut * 100).toFixed(0)}%`)
        .toBeLessThanOrEqual(weekCut + 0.25)
      checked++
    }
    expect(checked, 'fixture must contain a deload or this proves nothing').toBeGreaterThan(0)
  })

  it('§80 floor is met, OR the shortfall is declared — §114, founder decision 2026-09-19', () => {
    // ⚠️ THE CONTRACT CHANGED, AND THIS TEST CHANGED WITH IT. It used to assert
    // the §80 floor unconditionally. §114 lets the long run YIELD where the week
    // cannot hold it: measured, this runner's peak week is 34 km, and a 29.5 km
    // long run is 87% of it — the single most dangerous session the engine
    // produced. The founder's ruling, taking McMillan's position, is that for a
    // first-timer "get you round" IS the goal: a shorter long run they survive
    // beats a race-specific one that injures them in week 15.
    //
    // ⚠️ SO THE ASSERTION IS NOW A DISJUNCTION, AND THE SECOND ARM IS THE POINT.
    // A shorter long run nobody mentions is not a "get you round" plan, it is a
    // worse plan. Falling short is permitted ONLY when the plan says so.
    const plan = gen(runner())
    const floor = 42.2 * G.FINISH_GOAL_PEAK_LR_RATIO_VS_RACE_DURATION
      - G.DISTANCE_ROUNDING_PRECISION_KM
    const peak = Math.max(...plan.weeks.filter(w => w.n >= 1).map(lrOf), 0)
    if (peak >= floor) return
    const note = plan.meta.long_run_shortfall_note
    expect(note, `peak long run ${peak}km is under §80's ${floor.toFixed(1)}km floor, `
      + 'so the plan MUST carry the shortfall note').toBeTruthy()
    expect(String(note)).toMatch(/longest run/i)
  })

  it('§9 absolute minutes cap still binds — the bug the invariant caught', () => {
    // First build raised a 5K deload long run to 92 min against §9's 90-min
    // ceiling and INV-PLAN-LONG-CAP-MINS threw on 48 grid plans. Pinned on the
    // shape that broke: a high-volume, low-day 5K runner.
    const input = runner({ race_distance_km: 5, goal: 'time_target', target_time: '0:25:00',
      current_weekly_km: 50, days_available: 3, fitness_level: 'beginner',
      max_weekday_mins: 30, race_date: '2026-11-29', age: 40, injury_history: [] } as never)
    const plan = gen(input)
    const cap = G.LONG_RUN_CAP_MINUTES['5K']
    for (const w of plan.weeks) {
      const lr = Object.values(w.sessions).find(s => s && isLongRun(s))
      if (lr?.duration_mins != null) expect(lr.duration_mins, `w${w.n}`).toBeLessThanOrEqual(cap)
    }
    expect(validatePlan(plan, input).filter(v => v.code === 'INV-PLAN-LONG-CAP-MINS')).toEqual([])
  })

  it('a deload never ADDS to the long run', () => {
    // The amendment is a floor on the CUT, not licence to grow in a recovery
    // week. §3 would be meaningless otherwise.
    const plan: Plan = gen(runner())
    const ws = plan.weeks.filter(w => w.n >= 1)
    for (let i = 1; i < ws.length; i++) {
      const prev = ws[i - 1]!, curr = ws[i]!
      if (!isDl(curr) || isDl(prev) || curr.type === 'race') continue
      expect(lrOf(curr), `w${curr.n} deload must not exceed w${prev.n}`)
        .toBeLessThanOrEqual(lrOf(prev) + 0.01)
    }
  })
})
