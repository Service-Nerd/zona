import { describe, it, expect } from 'vitest'
import { generateFoundationBlock } from './foundationBlock'
import type { GeneratorInput } from '@/types/plan'

/**
 * D4 regression — the Foundation block must honour `preferred_long_run_day`.
 *
 * Before the fix, `buildFoundationSessions` picked the first-N Mon-first days and
 * placed the long run on the LAST of them, ignoring the user's chosen day. A user
 * who selected Sunday got the long run on Thursday (Mon/Tue/Wed easy + Thu long,
 * Fri/Sat/Sun empty) — while the main-phase weeks (ruleEngine) correctly used
 * Sunday. This asserts the two paths now agree on the long-run day.
 *
 * The easy-day distribution and run count are intentionally NOT asserted here —
 * consecutive-easy-day spacing in the Foundation block is a separate coaching
 * question (Coaching-1) awaiting sign-off; this fix only corrects the long-run day.
 */

const BASE: GeneratorInput = {
  race_date: '2026-11-29', race_distance_km: 10, goal: 'time_target', target_time: '0:44:59',
  days_available: 4, age: 43, current_weekly_km: 40, longest_recent_run_km: 18,
  resting_hr: 48, max_hr: 188,
  benchmark: { type: 'race', distance_km: 10, time: '0:48:30' },
}

// A 21-day gap → a multi-week foundation block (every week exercises placement).
const TODAY = '2026-08-01'
const PLAN_START = '2026-08-22'

function longRunDayOf(sessions: Record<string, { label?: string } | undefined>): string | undefined {
  return Object.entries(sessions).find(([, s]) => s?.label === 'Long easy')?.[0]
}

describe('foundation block — long-run day preference (D4)', () => {
  it('places the long run on Sunday when preferred_long_run_day is sun', () => {
    const { weeks } = generateFoundationBlock({
      input: { ...BASE, preferred_long_run_day: 'sun' },
      planStartDate: PLAN_START, today: TODAY,
    })
    expect(weeks.length).toBeGreaterThan(0)
    for (const w of weeks) expect(longRunDayOf(w.sessions)).toBe('sun')
  })

  it('places the long run on Saturday when preferred_long_run_day is sat', () => {
    const { weeks } = generateFoundationBlock({
      input: { ...BASE, preferred_long_run_day: 'sat' },
      planStartDate: PLAN_START, today: TODAY,
    })
    for (const w of weeks) expect(longRunDayOf(w.sessions)).toBe('sat')
  })

  it('defaults to Sunday when no preference is given', () => {
    const { weeks } = generateFoundationBlock({
      input: { ...BASE, preferred_long_run_day: undefined },
      planStartDate: PLAN_START, today: TODAY,
    })
    for (const w of weeks) expect(longRunDayOf(w.sessions)).toBe('sun')
  })

  it('falls back off a blocked preferred day (sun blocked → sat)', () => {
    const { weeks } = generateFoundationBlock({
      input: { ...BASE, preferred_long_run_day: 'sun', days_cannot_train: ['sun'] },
      planStartDate: PLAN_START, today: TODAY,
    })
    for (const w of weeks) {
      const d = longRunDayOf(w.sessions)
      expect(d).not.toBe('sun')
      expect(d).toBe('sat')
    }
  })

  it('keeps the total run count equal to days_available', () => {
    const { weeks } = generateFoundationBlock({
      input: { ...BASE, days_available: 4, preferred_long_run_day: 'sun' },
      planStartDate: PLAN_START, today: TODAY,
    })
    for (const w of weeks) {
      const runCount = Object.values(w.sessions).filter(Boolean).length
      expect(runCount).toBe(4)
    }
  })
})
