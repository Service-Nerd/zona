import { describe, it, expect } from 'vitest'
import {
  isDateBeforePlan,
  isPlanComplete,
  getSessionForDate,
  dayKeyForDate,
  parseLocalDate,
} from './plan'
import type { Session, Week } from '@/types/plan'

// Minimal week fixture — only the fields the temporal resolver reads.
function week(n: number, date: string, sessions: Partial<Record<string, Session>>): Week {
  return {
    n, date, label: `Week ${n}`, theme: '', type: 'normal',
    sessions: sessions as Week['sessions'],
    long_run_hrs: null, weekly_km: 0,
  }
}

const easyMon: Session = { type: 'easy', label: 'Easy run', detail: null, duration_mins: 78 }
const easyWed: Session = { type: 'easy', label: 'Easy run', detail: null, duration_mins: 78 }
const longSat: Session = { type: 'long', label: 'Long run', detail: null, duration_mins: 98 }

// Plan starts Mon 2026-08-17, two weeks. (2026-08-17 is a Monday.)
const weeks: Week[] = [
  week(1, '2026-08-17', { mon: easyMon, wed: easyWed, sat: longSat }),
  week(2, '2026-08-24', { mon: easyMon, wed: easyWed, sat: longSat }),
]

const D = (s: string) => parseLocalDate(s)

describe('isDateBeforePlan (ADR-016 — the missing before-start guard)', () => {
  it('is true strictly before the first week begins', () => {
    expect(isDateBeforePlan(weeks, D('2026-08-10'))).toBe(true) // a week early
    expect(isDateBeforePlan(weeks, D('2026-08-16'))).toBe(true) // day before
  })
  it('is false from the first day onward', () => {
    expect(isDateBeforePlan(weeks, D('2026-08-17'))).toBe(false)
    expect(isDateBeforePlan(weeks, D('2026-09-01'))).toBe(false)
  })
  it('is false for an empty plan (nothing to be before)', () => {
    expect(isDateBeforePlan([], D('2026-08-10'))).toBe(false)
  })
})

describe('getSessionForDate — the canonical active-session resolver', () => {
  it('returns null BEFORE the plan starts (the 78m-push bug)', () => {
    expect(getSessionForDate(weeks, D('2026-08-10'))).toBeNull()
  })

  it('returns the real session on a planned day, keyed by week.n', () => {
    const r = getSessionForDate(weeks, D('2026-08-17')) // Mon, week 1
    expect(r).not.toBeNull()
    expect(r!.session).toBe(easyMon)
    expect(r!.weekN).toBe(1)
    expect(r!.dayKey).toBe('mon')
    expect(r!.originalDay).toBe('mon')
  })

  it('resolves the correct week for a later date', () => {
    const r = getSessionForDate(weeks, D('2026-08-26')) // Wed, week 2
    expect(r!.weekN).toBe(2)
    expect(r!.dayKey).toBe('wed')
    expect(r!.session).toBe(easyWed)
  })

  it('returns null on a genuinely empty day inside the plan', () => {
    expect(getSessionForDate(weeks, D('2026-08-18'))).toBeNull() // Tue, no session
  })

  it('returns null AFTER the plan ends', () => {
    expect(getSessionForDate(weeks, D('2026-09-01'))).toBeNull()
    expect(isPlanComplete(weeks, D('2026-09-01'))).toBe(true)
  })

  it('honours a move override: session resolves at its new day, gone from the old', () => {
    const overrides = [{ week_n: 1, original_day: 'mon', new_day: 'tue' }]
    const moved = getSessionForDate(weeks, D('2026-08-18'), overrides) // Tue now holds Mon's session
    expect(moved!.session).toBe(easyMon)
    expect(moved!.dayKey).toBe('tue')
    expect(moved!.originalDay).toBe('mon') // completion key preserved
    expect(getSessionForDate(weeks, D('2026-08-17'), overrides)).toBeNull() // Mon vacated
  })

  it('keys by week.n, not array position (maintenance plan restarting at n=26)', () => {
    const maint: Week[] = [week(26, '2026-08-17', { mon: easyMon })]
    const r = getSessionForDate(maint, D('2026-08-17'))
    expect(r!.weekN).toBe(26)
    // an override must match on week.n = 26, not index+1 = 1
    const withOverride = getSessionForDate(
      maint, D('2026-08-18'),
      [{ week_n: 26, original_day: 'mon', new_day: 'tue' }],
    )
    expect(withOverride!.session).toBe(easyMon)
    expect(withOverride!.weekN).toBe(26)
  })
})

describe('dayKeyForDate', () => {
  it('maps a local-midnight date to its weekday key', () => {
    expect(dayKeyForDate(D('2026-08-17'))).toBe('mon')
    expect(dayKeyForDate(D('2026-08-22'))).toBe('sat')
    expect(dayKeyForDate(D('2026-08-23'))).toBe('sun')
  })
})
