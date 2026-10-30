// COACH-SEEN-MOMENTS-01 (§131): the earned sentences fire only on the runner's own evidence (Coaching Board 2026-10-30).
import { describe, it, expect } from 'vitest'
import { easiestWeekSpan, easiestWeekSentence, easyCostFell, easyCostFellThisWeek, easyCostSentence } from './moments'
import { COACH_MOMENT_EASIEST_MARGIN_PTS as M, COACH_MOMENT_MIN_PRIOR_WEEKS as P } from './constants'
import { TREND_PACE_CONFOUND_SEC_PER_KM as C } from './constants'

describe('easiestWeekSpan', () => {
  it(`fires when this week beats every earlier drawn week by ${M} points; N is the weeks drawn`, () => {
    expect(easiestWeekSpan([30, 25, 40, 20, 40 + M])).toBe(5)
  })
  it(`🔴 one point short of ${M} is an ordinary week`, () => {
    expect(easiestWeekSpan([30, 25, 40, 20, 40 + M - 1])).toBeNull()
  })
  it(`needs ${P} earlier weeks WITH data; empty slots do not count`, () => {
    expect(easiestWeekSpan([null, 20, null, 20, 90])).toBeNull()
    expect(easiestWeekSpan([20, null, 20, 20, 90])).toBe(5)
  })
  it('a thin week this week never fires', () => {
    expect(easiestWeekSpan([20, 20, 20, null])).toBeNull()
  })
  it('the sentence counts the weeks in words', () => {
    expect(easiestWeekSentence(8)).toBe('Your easiest week in eight weeks.')
  })
})

const t = (a: number, b: number, pa: number | null = 360, pb: number | null = 360) =>
  ({ hrIsTrending: Math.abs(b - a) >= 4, buckets: [{ avgHr: a, avgPaceSecPerKm: pa }, { avgHr: b, avgPaceSecPerKm: pb }] })

describe('easyCostFell', () => {
  it('heart rate down past the floor at a similar pace', () => expect(easyCostFell(t(146, 141))).toBe(true))
  it('🔴 not when a slower pace explains it', () => expect(easyCostFell(t(146, 141, 360, 360 + C))).toBe(false))
  it('not when pace is unknown', () => expect(easyCostFell(t(146, 141, null, 360))).toBe(false))
  it('not when the heart rate rose', () => expect(easyCostFell(t(141, 146))).toBe(false))
  it('not below the noise floor', () => expect(easyCostFell(t(146, 143))).toBe(false))
  it('not when the ends are equal, even if a caller flags a trend', () =>
    expect(easyCostFell({ ...t(146, 146), hrIsTrending: true })).toBe(false))
})

describe('easyCostFellThisWeek', () => {
  it('true only in the week it first crosses', () => {
    expect(easyCostFellThisWeek(t(146, 141), t(146, 144))).toBe(true)
    expect(easyCostFellThisWeek(t(146, 141), null)).toBe(true)
    expect(easyCostFellThisWeek(t(146, 141), t(146, 140))).toBe(false)
  })
  it('the sentence', () => expect(easyCostSentence(146, 141, 'August')).toBe('Easy is costing you less: 146 → 141 bpm since August.'))
})
