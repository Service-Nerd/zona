/**
 * V4-ANCHOR-01 — `applyV4LongRunRepeatCeiling` reads the session's SIZE, not its
 * `distance_km` field.
 *
 * A session is anchored EITHER by distance OR by duration, and beginners and
 * ultra runners get duration-anchored long runs (§79/§80, time on feet). V4's
 * entry gate was `lr.session.distance_km == null`, so for those runners it reset
 * the streak and moved on: the rule it enforces
 * (`LR_MAX_CONSECUTIVE_REPEATS` non-deload weeks) had never once run on the
 * cohort the founder ranks first.
 *
 * Measured before the fix: the duration-anchored exit was 81% of every exit V4
 * took (17,268 skips against 380 fires on a 1-in-7 sample of the cohort grid).
 *
 * ⚠️ WHAT THIS TEST DOES NOT PROVE. It does not show that repeated long runs
 * are now rare. Plans carrying 3+ identical consecutive long runs measured
 * 30.3% duration-anchored vs 30.4% distance-anchored BEFORE the fix, and
 * 27.8% vs 30.4% after — V4 is weak in both cohorts because the §40/§9 time
 * cap and the long-run ceiling block it. This asserts that the rule REACHES
 * the cohort, which is the defect; V4's residual weakness is a separate,
 * coaching-level question.
 *
 * Third occurrence of this class: LR-CAP-BLIND-01 (§45's cap) and
 * SESSION-KM-01/02 are the same `distance_km`-shaped hole.
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { sessionKmSelfPaced } from './sessionDistance'
import { isLongRun } from './sessionRole'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Session, Week } from '@/types/plan'

// The case found on the cohort grid: a fully duration-anchored beginner plan
// whose week 7 long run repeats twice and is then incremented by V4. Before the
// fix week 7 stayed at the repeated distance.
const DURATION_ANCHORED_BEGINNER = {
  athlete_name: 'Athlete', age: 35, race_name: 'Test', primary_metric: 'distance',
  plan_start: '2026-04-27', race_distance_km: 10, race_date: '2026-07-18',
  goal: 'finish', resting_hr: 55, max_hr: 184,
  current_weekly_km: 35, longest_recent_run_km: 14, fitness_level: 'beginner',
  recent_quality_training: 'occasional', hard_session_relationship: 'neutral',
  injury_history: [],
  benchmark: { type: 'race', distance_km: 5, time: '0:27:30', benchmark_date: '2026-04-01' },
  days_available: 3, days_cannot_train: ['tue', 'thu'],
} as unknown as GeneratorInput

const longRunOf = (w: Week): Session | undefined =>
  (Object.values(w.sessions ?? {}) as (Session | undefined)[]).find(s => !!s && isLongRun(s))

const loadingWeeks = (weeks: Week[]) =>
  weeks.filter(w => w.n > 0 && w.type !== 'race' && w.phase !== 'foundation')

describe('V4-ANCHOR-01 — the long-run repeat ceiling reaches duration-anchored plans', () => {
  const plan = generateRulePlan(DURATION_ANCHORED_BEGINNER, 'paid', '2026-04-27')
  const weeks = loadingWeeks(plan.weeks)
  const lrs = weeks.map(longRunOf)

  it('the fixture really is duration-anchored — otherwise this test proves nothing', () => {
    expect(lrs.every(Boolean)).toBe(true)
    // No long run carries a distance anchor: this is the shape V4 used to skip.
    expect(lrs.filter(s => s!.distance_km != null)).toHaveLength(0)
  })

  it('V4 breaks the repeat streak it was always documented to break', () => {
    const max = GENERATION_CONFIG.LR_MAX_CONSECUTIVE_REPEATS
    let worst = 1
    let run = 1
    for (let i = 1; i < lrs.length; i++) {
      const adjacent = weeks[i].type === 'normal' && weeks[i - 1].type === 'normal'
      const a = sessionKmSelfPaced(lrs[i - 1]!)
      const b = sessionKmSelfPaced(lrs[i]!)
      expect(a).not.toBeNull()
      expect(b).not.toBeNull()
      run = adjacent && Math.abs(a! - b!) < 0.05 ? run + 1 : 1
      worst = Math.max(worst, run)
    }
    // Before the fix this plan carried a longer streak than the rule allows,
    // because V4 never looked at it.
    expect(worst).toBeLessThanOrEqual(max)
  })

  it('the increment is written to the anchor the runner is shown, never a new one', () => {
    // §79/§80's metric contract: incrementing a duration-anchored long run must
    // not flip the card from minutes to kilometres. Same rule §45's cap follows.
    for (const s of lrs) {
      expect(s!.distance_km ?? null).toBeNull()
      expect(s!.duration_mins).toBeGreaterThan(0)
    }
  })
})
