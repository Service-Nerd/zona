import { describe, it, expect } from 'vitest'
import { generateRulePlan, refreshWeekCopyIfStale } from './ruleEngine'
import { validateReshapedPlan } from './invariants'
import type { GeneratorInput } from '@/types/plan'

// analysis open-Q4 — F4 recurring through the reshape path.
//
// The reshaper downgrades quality sessions to easy ("aerobic efficiency
// trending down") and never touched week copy, so a reshaped week could keep
// "Build — first quality session" over four easy runs. Same defect as the one
// fixed at generation, reached by a different route.

const INPUT: GeneratorInput = {
  race_date: '2026-11-18', race_distance_km: 21.1, goal: 'time_target', target_time: '1:45:00',
  days_available: 4, age: 40, current_weekly_km: 40, longest_recent_run_km: 18,
  resting_hr: 52, max_hr: 180, training_age: '2-5yr',
  benchmark: { type: 'race', distance_km: 10, time: '0:47:00', benchmark_date: '2026-07-01' },
}

function planWithQualityWeek() {
  const plan = generateRulePlan(INPUT, 'paid', '2026-08-03')
  const week = plan.weeks.find(w => Object.values(w.sessions).some(s => s?.type === 'quality'))!
  return { plan, week }
}

function downgradeQualityToEasy(week: ReturnType<typeof planWithQualityWeek>['week']) {
  for (const [day, s] of Object.entries(week.sessions)) {
    if (s?.type === 'quality') {
      week.sessions[day as keyof typeof week.sessions] = { ...s, type: 'easy' }
    }
  }
}

describe('reshape copy refresh (open-Q4)', () => {
  it('rewrites copy that a reshape has made false', () => {
    const { plan, week } = planWithQualityWeek()
    expect(week.label).toContain('quality')

    downgradeQualityToEasy(week)
    expect(refreshWeekCopyIfStale(plan, week.n)).toBe(true)

    expect(week.label).not.toContain('quality')
    expect(week.theme).not.toContain('quality')
  })

  it('leaves the reshaped plan free of copy violations', () => {
    const { plan, week } = planWithQualityWeek()
    downgradeQualityToEasy(week)
    refreshWeekCopyIfStale(plan, week.n)

    const copyErrors = validateReshapedPlan(plan)
      .filter(v => v.severity === 'error' && v.code === 'INV-PLAN-COPY-MATCHES-SESSIONS')
    expect(copyErrors).toEqual([])
  })

  it('preserves enriched copy that is still true — a voice is not a lie', () => {
    // Enriched labels are Kit's voice and a paid deliverable. Blanket-refreshing
    // every reshaped week would silently revert trial/paid users to rule-engine
    // strings, so the refresh must fire only on a false claim.
    const { plan, week } = planWithQualityWeek()
    week.label = 'Build — the one that counts'
    week.theme = 'Kit voice, honest, promises nothing absent.'

    expect(refreshWeekCopyIfStale(plan, week.n)).toBe(false)
    expect(week.label).toBe('Build — the one that counts')
  })

  it('is a no-op for a week that was never stale', () => {
    const { plan, week } = planWithQualityWeek()
    const before = { label: week.label, theme: week.theme }
    expect(refreshWeekCopyIfStale(plan, week.n)).toBe(false)
    expect({ label: week.label, theme: week.theme }).toEqual(before)
  })

  it('ignores unknown week numbers rather than throwing', () => {
    const { plan } = planWithQualityWeek()
    expect(refreshWeekCopyIfStale(plan, 999)).toBe(false)
  })
})
