import { describe, it, expect } from 'vitest'
import { validateDaysAvailable } from './inputs'
import type { GeneratorInput } from '@/types/plan'

// COPY-DAYS-PLURAL-01 — the days-gate message must singularise. A runner who can
// run one day a week was told "1 days/week is not enough". Copy, not doctrine.

const marathon = (days: number): GeneratorInput => ({
  athlete_name: 'X', age: 35, race_name: 'R', primary_metric: 'distance',
  plan_start: '2026-04-27', race_distance_km: 42.2, race_date: '2026-10-05',
  goal: 'finish', resting_hr: 52, max_hr: 180, current_weekly_km: 20,
  longest_recent_run_km: 10, days_available: days, days_cannot_train: [],
  injury_history: [],
} as unknown as GeneratorInput)

describe('COPY-DAYS-PLURAL-01 — the days message agrees in number', () => {
  it('says "1 day/week", not "1 days/week"', () => {
    const r = validateDaysAvailable(marathon(1))
    expect(r.status).toBe('block')
    expect(r.message).toContain('1 day/week')
    expect(r.message).not.toContain('1 days/week')
  })

  it('still says "2 days/week" for the plural case', () => {
    const r = validateDaysAvailable(marathon(2))
    expect(r.status).toBe('block')
    expect(r.message).toContain('2 days/week')
  })
})
