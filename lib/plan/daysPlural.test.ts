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
  // ⚠️ REFUSAL-COPY-02 — this file used to pin the exact strings "1 day/week"
  // and "2 days/week", so voicing the §52 message for tone broke it even though
  // number agreement was never in question. The RULE is agreement; "/week" was
  // never the rule. Asserted structurally so the copy stays free to change.
  it('says "1 day", never "1 days"', () => {
    const r = validateDaysAvailable(marathon(1))
    expect(r.status).toBe('block')
    expect(r.message).toMatch(/\b1 day\b/)
    expect(r.message, 'the singular case must not read "1 days"').not.toMatch(/\b1 days\b/)
  })

  it('still pluralises every other count', () => {
    // Only counts that actually REFUSE carry a message: at 3 days a
    // finish-goal marathon is `ok` and `message` is undefined, so asserting
    // over it would test nothing while looking like coverage.
    for (const n of [2]) {
      const r = validateDaysAvailable(marathon(n))
      expect(r.status, `${n} days should still be a block for a marathon`).toBe('block')
      expect(r.message, `${n} should pluralise`).toMatch(new RegExp(`\\b${n} days\\b`))
    }
  })

  it('the singular/plural choice is driven by the count, not by a literal', () => {
    // Falsifies a fix that hardcoded "1 day" for the one case it was reported on.
    const one = validateDaysAvailable(marathon(1)).message ?? ''
    const two = validateDaysAvailable(marathon(2)).message ?? ''
    expect(one.replace(/\b1 day\b/, 'N')).toBe(two.replace(/\b2 days\b/, 'N').replace(/ You've got[^]*$/, ''))
  })
})
