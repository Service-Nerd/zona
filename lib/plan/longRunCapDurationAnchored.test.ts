/**
 * LR-CAP-BLIND-01 — §45's long-run cap applies to DURATION-anchored plans.
 *
 * §45 is titled "Long-run progression cap (universal, no phase exemption)" and
 * its text says the cap applies in ALL phases with no exemption. It had never
 * once run on a beginner's plan.
 *
 * A session is anchored EITHER by distance OR by duration, and §79/§80 give
 * duration to beginners AND to every race >= 50 km. Both the producer
 * (`applyLongRunProgressionCap`) and the checker
 * (`INV-PLAN-LR-PROGRESSION-CAP`) bailed out on `distance_km == null` — one
 * bug in two copies, so the checker could not catch the producer because it
 * shared the defect.
 *
 * Measured before the fix: 2,271 breaches across 1,568 plans (9.8% of the
 * sweep). Worst case, the fixture below: a 14-week first marathon whose long
 * run went 8.5 km -> 26.0 km, +206%, to 2.9x the runner's lifetime longest.
 * §45's own founding case was +185%.
 *
 * These tests fail on the pre-fix engine.
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import { sessionKmSelfPaced } from './sessionDistance'
import { isLongRun } from './sessionRole'
import type { GeneratorInput, Session } from '@/types/plan'

/** The M3 persona from the charity review packet — the worst case measured. */
const m3 = (over: Record<string, unknown> = {}): GeneratorInput => ({
  race_distance_km: 42.2, race_date: '2026-12-27', goal: 'finish',
  current_weekly_km: 18, longest_recent_run_km: 9, days_available: 3,
  age: 34, training_age: '<6mo', recent_quality_training: 'none',
  max_weekday_mins: 45, acknowledged_prep_warning: true,
  hard_session_relationship: 'neutral', injury_history: [],
  preferred_long_run_day: 'sat', foundation_decision: 'add',
  plan_start: '2026-09-21', ...over,
} as unknown as GeneratorInput)

const longRuns = (plan: { weeks: Array<{ n: number; type?: string; sessions?: Record<string, Session | undefined> }> }) =>
  plan.weeks
    .filter(w => w.n >= 1 && w.type !== 'race')
    .map(w => {
      const s = Object.values(w.sessions ?? {}).find(x => !!x && isLongRun(x))
      return { week: w.n, km: s ? sessionKmSelfPaced(s) ?? 0 : 0, deload: w.type === 'deload' }
    })
    .filter(x => x.km > 0)

const gen = (over: Record<string, unknown> = {}) => {
  const input = m3(over)
  const r = generateRulePlan(input, 'paid') as unknown as Record<string, unknown>
  return { input, plan: (r.plan ?? r) as { weeks: Array<{ n: number; type?: string; sessions?: Record<string, Session | undefined> }> } }
}

describe('§45 on a duration-anchored plan', () => {
  it('the fixture really is duration-anchored — else this file tests nothing', () => {
    // Guards the guard. If beginners ever became distance-anchored, these tests
    // would pass for the wrong reason and the blind spot could return unseen.
    const { plan } = gen()
    const long = plan.weeks
      .filter(w => w.n >= 1 && w.type !== 'race')
      .map(w => Object.values(w.sessions ?? {}).find(s => !!s && isLongRun(s)))
      .find(Boolean)
    expect(long).toBeTruthy()
    // `?? null` because the field is absent rather than explicitly null — the
    // distinction the engine itself treats as identical (`distance_km == null`).
    expect(long!.distance_km ?? null).toBeNull()
    expect(long!.duration_mins).toBeGreaterThan(0)
  })

  it('no long-run step exceeds §45: +20% or +5km, whichever is greater', () => {
    const { plan } = gen()
    const runs = longRuns(plan)
    const capPct = GENERATION_CONFIG.LONG_RUN_PROGRESSION_CAP_PCT / 100
    const capAbs = GENERATION_CONFIG.LONG_RUN_PROGRESSION_CAP_ABS_KM
    for (let i = 1; i < runs.length; i++) {
      const prev = runs[i - 1], curr = runs[i]
      if (prev.deload || curr.km <= prev.km) continue   // step-backs are permitted
      const allowed = prev.km + Math.max(prev.km * capPct, capAbs)
      expect(curr.km, `W${curr.week} ${curr.km.toFixed(1)}km from W${prev.week} ${prev.km.toFixed(1)}km`)
        .toBeLessThanOrEqual(allowed + 0.51)
    }
  })

  it('specifically: no runaway long run off an 8.5km base', () => {
    // The measured defect, pinned as a number. Pre-fix this plan peaked at
    // 26.0km with the prior long run at 8.5km — a +206% single-week jump.
    //
    // ⚠️ PIN RAISED 20 -> 22 on 2026-09-17 (LR-DELOAD-CUT-01), and the reason
    // matters because this guard exists for the worst incident in this repo.
    // The DEFECT was the JUMP, not the peak. The jump is policed by the
    // week-on-week test above, which passes — and it got SAFER, not worse:
    // measured on this persona the deload's long-run cut goes -61% -> -34% and
    // the worst single-week jump +50% -> +47%. Cutting less means climbing less.
    // The peak rises 18.5 -> 20.5km as the intended consequence: this runner is
    // attempting a marathon and 18.5km was not preparing them.
    //
    // ⚠️ IF THIS EVER NEEDS RAISING AGAIN, check the worst-jump number first.
    // A peak pin that keeps drifting up while the jump also rises is the
    // original defect coming back wearing a different number.
    const { plan } = gen()
    const peak = Math.max(...longRuns(plan).map(r => r.km))
    expect(peak).toBeLessThan(22)
  })

  it('the invariant agrees — and it can see the plan at all', () => {
    const { input, plan } = gen()
    const v = validatePlan(plan as never, input)
      .filter(x => x.code === 'INV-PLAN-LR-PROGRESSION-CAP')
    expect(v).toHaveLength(0)
  })

  it('an ULTRA is covered too — §79 makes every race >= 50km duration-anchored', () => {
    // The blind spot was never beginner-only: intermediate and experienced
    // 50K/100K plans were equally unchecked, which the sweep confirmed.
    const { input, plan } = gen({
      race_distance_km: 50, race_date: '2027-03-14', fitness_level: 'intermediate',
      training_age: '2-5yr', current_weekly_km: 40, longest_recent_run_km: 20,
      days_available: 4, max_weekday_mins: undefined,
    })
    const v = validatePlan(plan as never, input)
      .filter(x => x.code === 'INV-PLAN-LR-PROGRESSION-CAP')
    expect(v).toHaveLength(0)
  })

  it('a distance-anchored plan is unaffected — the old path still works', () => {
    const { input, plan } = gen({
      fitness_level: 'experienced', training_age: '5yr+', current_weekly_km: 55,
      longest_recent_run_km: 26, days_available: 5, max_weekday_mins: undefined,
      recent_quality_training: 'regular',
    })
    const v = validatePlan(plan as never, input)
      .filter(x => x.code === 'INV-PLAN-LR-PROGRESSION-CAP')
    expect(v).toHaveLength(0)
  })
})
