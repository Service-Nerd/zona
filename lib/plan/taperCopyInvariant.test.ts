import { describe, it, expect } from 'vitest'
import { validatePlan } from './invariants'
import type { Plan, Week, Session, GeneratorInput } from '@/types/plan'

// INV-PLAN-TAPER-COPY-MATCHES-DURATION (GEN-FIX-12, SLT Flag 2) — the mechanical
// backstop for F9. Source is already fixed; this proves a future regression
// (a hardcoded taper word) is caught rather than silently shipped.

const easy = { type: 'easy', label: 'Easy', distance_km: 6 } as unknown as Session

// A plan with THREE taper-phase weeks. The first taper week carries the note.
function planWithTaper(taperNote: string): Plan {
  const mkWeek = (n: number, phase: string, note?: string): Week => {
    const s = note
      ? ({ type: 'easy', label: 'Easy', distance_km: 6, coach_notes: [note] } as unknown as Session)
      : easy
    return {
      n, phase, label: phase, theme: '', weekly_km: 20,
      sessions: { mon: s, wed: easy, sat: easy },
    } as unknown as Week
  }
  return {
    meta: { race_date: '2026-11-15', race_distance_km: 21.1, goal: 'finish' },
    weeks: [
      mkWeek(1, 'build'),
      mkWeek(2, 'taper', taperNote), // note lives here
      mkWeek(3, 'taper'),
      mkWeek(4, 'taper'),            // 3 taper-phase weeks total
    ],
  } as unknown as Plan
}

const INPUT = {
  race_date: '2026-11-15', race_distance_km: 21.1, goal: 'finish',
  current_weekly_km: 0, longest_recent_run_km: 0, days_available: 3,
  age: 40, days_cannot_train: [],
} as unknown as GeneratorInput

const taperErrors = (plan: Plan) =>
  validatePlan(plan, INPUT).filter(v => v.code === 'INV-PLAN-TAPER-COPY-MATCHES-DURATION')

describe('INV-PLAN-TAPER-COPY-MATCHES-DURATION', () => {
  it('errors when the note understates the taper length', () => {
    const errs = taperErrors(planWithTaper('Two week taper. Trust the work.'))
    expect(errs.length).toBe(1)
    expect(errs[0].severity).toBe('error')
    expect(errs[0].week).toBe(2)
  })

  it('errors when the note overstates the taper length', () => {
    expect(taperErrors(planWithTaper('Four week taper. Volume drops.')).length).toBe(1)
  })

  it('accepts a note that matches the actual taper length', () => {
    expect(taperErrors(planWithTaper('Three week taper. Volume drops, trust the work.')).length).toBe(0)
  })

  it('accepts a digit form that matches', () => {
    expect(taperErrors(planWithTaper('3-week taper here.')).length).toBe(0)
  })

  it('ignores notes that do not name a taper length', () => {
    expect(taperErrors(planWithTaper('Volume drops. Trust the work.')).length).toBe(0)
  })
})
