import { describe, it, expect } from 'vitest'
import { nextRecalibrationDue } from './recalibrationPrompt'
import type { Plan } from '@/types/plan'

// Minimal plan: recalibration weeks 4 & 8, each with a `hard` time trial on wed.
function plan(): Plan {
  const mkWeek = (n: number, hasTT: boolean) => ({
    n, phase: 'base', label: '', theme: '', weekly_km: 26,
    sessions: {
      mon: { type: 'easy' },
      wed: hasTT ? { type: 'hard', label: '5K time trial' } : { type: 'easy' },
      sat: { type: 'easy' },
    },
  })
  return {
    meta: { race_date: '2026-11-18', race_distance_km: 21.1, recalibration_weeks: [4, 8] },
    weeks: [mkWeek(4, true), mkWeek(8, true)],
  } as unknown as Plan
}

describe('nextRecalibrationDue (PV2-H / ADR-014)', () => {
  it('returns null when the time trial has not been completed', () => {
    expect(nextRecalibrationDue(plan(), [])).toBeNull()
  })

  it('fires when a recalibration-week time trial is completed', () => {
    expect(nextRecalibrationDue(plan(), [{ week_n: 4, session_day: 'wed' }]))
      .toEqual({ week_n: 4, session_day: 'wed' })
  })

  it('does not fire for a completion on a non-time-trial day', () => {
    expect(nextRecalibrationDue(plan(), [{ week_n: 4, session_day: 'mon' }])).toBeNull()
  })

  it('does not fire for a completion in a non-recalibration week', () => {
    expect(nextRecalibrationDue(plan(), [{ week_n: 5, session_day: 'wed' }])).toBeNull()
  })

  it('skips a recalibration week already applied, returns the next due', () => {
    expect(nextRecalibrationDue(
      plan(),
      [{ week_n: 4, session_day: 'wed' }, { week_n: 8, session_day: 'wed' }],
      [4],
    )).toEqual({ week_n: 8, session_day: 'wed' })
  })

  it('returns the EARLIEST due when several are complete', () => {
    expect(nextRecalibrationDue(
      plan(),
      [{ week_n: 8, session_day: 'wed' }, { week_n: 4, session_day: 'wed' }],
    )).toEqual({ week_n: 4, session_day: 'wed' })
  })

  it('returns null when the plan has no recalibration weeks', () => {
    const p = plan()
    delete (p.meta as { recalibration_weeks?: number[] }).recalibration_weeks
    expect(nextRecalibrationDue(p, [{ week_n: 4, session_day: 'wed' }])).toBeNull()
  })
})
