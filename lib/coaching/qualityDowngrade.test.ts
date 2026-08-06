import { describe, it, expect } from 'vitest'
import { INTENSITY_DOWNGRADE_TRIGGERS, recordQualityDowngrade } from './qualityDowngrade'
import type { Week, Session } from '@/types/plan'

// A week whose quality session has just been swapped to easy by a reshape.
function downgradedWeek(): Week {
  const easy = { type: 'easy', label: 'Easy', distance_km: 6 } as unknown as Session
  return {
    n: 5,
    phase: 'build',
    label: 'Build',
    theme: '',
    weekly_km: 30,
    sessions: { mon: easy, wed: easy, sat: easy },
  } as unknown as Week
}

describe('recordQualityDowngrade (GEN-FIX-10)', () => {
  it('exempts the fatigue trigger the reshaper actually emits', () => {
    // Regression guard for the shipped bug: the set held 'fatigue', but
    // planAdjustment.ts:394 emits 'fatigue_accumulation'. If these drift again
    // the fatigue-downgrade exemption silently dies and reshape_invalid noise
    // returns. This is the assertion that would have caught it.
    expect(INTENSITY_DOWNGRADE_TRIGGERS.has('fatigue_accumulation')).toBe(true)

    const week = downgradedWeek()
    const stamped = recordQualityDowngrade(week, 'fatigue_accumulation', '2026-08-06T12:00:00.000Z')
    expect(stamped).toBe(true)
    expect(week.quality_downgraded).toEqual({ trigger: 'fatigue_accumulation', at: '2026-08-06T12:00:00.000Z' })
  })

  it('exempts the efficiency-decline trigger', () => {
    const week = downgradedWeek()
    expect(recordQualityDowngrade(week, 'ef_decline', '2026-08-06T12:00:00.000Z')).toBe(true)
    expect(week.quality_downgraded?.trigger).toBe('ef_decline')
  })

  it('does not exempt an unrelated trigger — a real defect still violates', () => {
    const week = downgradedWeek()
    expect(recordQualityDowngrade(week, 'manual', '2026-08-06T12:00:00.000Z')).toBe(false)
    expect(week.quality_downgraded).toBeUndefined()
  })

  it('does not stamp when a quality session is still present', () => {
    const week = downgradedWeek()
    week.sessions.thu = { type: 'quality', label: 'Intervals', distance_km: 8 } as unknown as Session
    expect(recordQualityDowngrade(week, 'fatigue_accumulation', '2026-08-06T12:00:00.000Z')).toBe(false)
    expect(week.quality_downgraded).toBeUndefined()
  })

  it('no-ops on a missing trigger type', () => {
    const week = downgradedWeek()
    expect(recordQualityDowngrade(week, undefined, '2026-08-06T12:00:00.000Z')).toBe(false)
    expect(week.quality_downgraded).toBeUndefined()
  })
})
