/**
 * SWEEP-W1W2-LONG-CAP-01 — ADR-022's deload re-anchor must respect the week-1-2
 * cap, and must write BOTH axes of the session it changes.
 *
 * THE DEFECT, TRACED. `buildWeekSessions` clamps the week-1-2 long run to
 * `longest_recent_run × WEEK_1_2_LONG_RUN_CAP_MULTIPLIER` (§9/§113) and
 * floor-rounds it, so the post-round value can never exceed the cap. ADR-022's
 * deload re-anchor then runs over the FINISHED weeks and re-anchors a deload
 * long run without re-reading that cap — silently undoing it whenever week 2 is
 * a deload. Traced: a capped 13.0 km opening long run raised to 13.5 against a
 * 13.2 ceiling, and §113 would then have refused the runner for a leap this
 * pass created. Identical shape to the floor override §113 Am.1 vetoed.
 *
 * ⚠️ ITS OWN GUARD COMMENT SAYS "a deload never ADDS" AND THAT IS ONLY TRUE WHEN
 * THE DELOAD IS SMALLER. `target` is `prevKm × (curr.weekly_km / prev.weekly_km)`,
 * and that ratio EXCEEDS 1 whenever a deload week delivers more than the week
 * before it — 3,344 week-instances on the cohort grid. On the traced case the
 * week-1 delivery is 22 km and the week-2 deload delivers 23.
 *
 * ⚠️ AND THE DISTANCE ARM LEFT `duration_mins` BEHIND. Measured 44,852 of 67,348
 * fires across 39,632 cohort plans wrote `distance_km` and left `duration_mins`
 * describing the OLD distance. `sessionKm` prefers `distance_km`, so the
 * coaching stayed correct and only the number the RUNNER READS was wrong — which
 * is exactly why nothing caught it. Golden plans moved 79→82, 75→86, 46→53,
 * 77→82 minutes: understated by up to ELEVEN minutes.
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { isLongRun } from './sessionRole'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

const PLAN_START = '2026-04-27'

/** The exact swept input that produced the breach (SWEEP_EXPLAIN dump). */
const BREACH = {
  athlete_name: 'Athlete', age: 55, race_name: 'Test', primary_metric: 'distance',
  injury_history: ['Knee'], plan_start: PLAN_START,
  race_distance_km: 10, race_date: '2026-07-27', target_time: '0:45:00',
  current_weekly_km: 60, longest_recent_run_km: 12,
  days_available: 3, days_cannot_train: ['tue', 'thu'],
  fitness_level: 'experienced', training_age: '2-5yr',
  user_declared_level: 'experienced', hard_session_relationship: 'neutral',
  recent_quality_training: 'occasional', max_weekday_mins: 30,
  weeks_at_current_volume: 7, foundation_decision: 'skip',
  resting_hr: 55, max_hr: 129, max_hr_source: 'observed',
  preferred_long_run_day: 'sun',
  benchmark: { type: 'race', distance_km: 10, time: '0:48:30' },
} as unknown as GeneratorInput

describe('SWEEP-W1W2-LONG-CAP-01 — the deload re-anchor respects §9/§113', () => {
  it('does not raise a week-1-2 long run above longest_recent_run × the cap', () => {
    const plan = generateRulePlan(BREACH, 'free', PLAN_START)
    const cap = 12 * GENERATION_CONFIG.WEEK_1_2_LONG_RUN_CAP_MULTIPLIER   // 13.2
    for (const w of plan.weeks) {
      if (w.n <= 0 || w.n > 2) continue
      const lr = Object.values(w.sessions).find(s => s && isLongRun(s))
      if (!lr?.distance_km) continue
      // Pre-fix week 2 was 13.5 against a 13.2 ceiling, while week 2 is a deload.
      expect(lr.distance_km, `week ${w.n} long run`).toBeLessThanOrEqual(cap + 0.01)
    }
    expect(validatePlan(plan, BREACH)
      .filter(v => v.code === 'INV-PLAN-WEEK-1-2-LONG-CAP')).toEqual([])
  })

  it('a deload long run never exceeds the non-deload week before it', () => {
    const plan = generateRulePlan(BREACH, 'free', PLAN_START)
    for (let i = 1; i < plan.weeks.length; i++) {
      const prev = plan.weeks[i - 1], curr = plan.weeks[i]
      if (curr.type !== 'deload' || prev.type === 'deload') continue
      const pk = Object.values(prev.sessions).find(s => s && isLongRun(s))?.distance_km
      const ck = Object.values(curr.sessions).find(s => s && isLongRun(s))?.distance_km
      if (pk == null || ck == null) continue
      expect(ck, `deload week ${curr.n} long run vs week ${prev.n}`).toBeLessThanOrEqual(pk + 0.01)
    }
  })

  it('every long run that states BOTH distance and duration has them agree', () => {
    // The defect: the re-anchor wrote distance_km and left duration_mins on the
    // OLD distance. The plan carries no top-level pace guide, so this compares
    // each long run's IMPLIED pace against the plan's own median — every long run
    // is priced at the same easy pace, so a session whose two fields disagree is
    // an outlier by construction. Pre-fix week 2 read 13.5 km in 83 min (6.15
    // min/km) against every other week's 6.38.
    const plan = generateRulePlan(BREACH, 'free', PLAN_START)
    const paces: { wk: number, pace: number }[] = []
    for (const w of plan.weeks) {
      for (const s of Object.values(w.sessions)) {
        if (!s || !isLongRun(s)) continue
        if (s.distance_km == null || s.duration_mins == null || s.distance_km <= 0) continue
        paces.push({ wk: w.n, pace: s.duration_mins / s.distance_km })
      }
    }
    expect(paces.length, 'fixture must contain priced long runs').toBeGreaterThan(3)
    const sorted = [...paces].map(p => p.pace).sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    for (const { wk, pace } of paces) {
      expect(Math.abs(pace - median),
        `week ${wk} long run implies ${pace.toFixed(2)} min/km against a plan median of ${median.toFixed(2)}`)
        .toBeLessThanOrEqual(0.15)
    }
  })

  it('GUARD — the fixture still reproduces the conditions the clamp exists for', () => {
    // ⚠️ NOT A FALSIFICATION, AND CALLING IT ONE WOULD HAVE BEEN WRONG. Pre-fix,
    // every case in this file goes red for the SAME reason: `generateRulePlan`
    // THROWS in test env because `validatePlan` throws on error severity, so the
    // plan cannot be built at all. The real fails-before/passes-after was proven
    // by reverting `ruleEngine.ts` alone and re-running (4 red → 4 green).
    //
    // What this case does is keep the FIXTURE honest: it asserts the two
    // conditions that make the clamp load-bearing — week 2 is a deload, and its
    // delivered volume EXCEEDS week 1's, so the pass's `prevKm × (currWeekly /
    // prevWeekly)` target is above the cap. If the engine ever changes so those
    // stop holding, this goes red to say the fixture has stopped exercising the
    // defect, rather than passing silently over a test that proves nothing.
    const plan = generateRulePlan(BREACH, 'free', PLAN_START)
    const w1 = plan.weeks.find(w => w.n === 1)!
    const w2 = plan.weeks.find(w => w.n === 2)!
    expect(w2.type, 'fixture requires week 2 to be a deload').toBe('deload')
    // The ratio that made "a deload never ADDS" false.
    expect(w2.weekly_km!).toBeGreaterThan(w1.weekly_km!)
    const prevKm = Object.values(w1.sessions).find(s => s && isLongRun(s))!.distance_km!
    const uncappedTarget = prevKm * (w2.weekly_km! / w1.weekly_km!)
    const cap = 12 * GENERATION_CONFIG.WEEK_1_2_LONG_RUN_CAP_MULTIPLIER
    expect(uncappedTarget, 'the uncapped target must breach the cap, or this test proves nothing')
      .toBeGreaterThan(cap)
  })
})
