import { describe, it, expect } from 'vitest'
import type { Plan, Session, Week } from '@/types/plan'
import {
  runsOf, km, placedKm, trainingWeeks, loadingWeeks, peakWeekKm, peakLongRunKm, qualityCount,
  timeTrials, metaNotes, blockedDays, longestRun, foundationWeeks,
} from './metrics'

/** ARCH-ENG-004 — the scorecard's metrics owner, checked against a plan written by hand, so every
 *  expected number below is arithmetic a reader can do, not a value read back from the engine. */
const s = (o: Partial<Session>): Session => ({ type: 'easy', label: 'Easy', ...o }) as Session
const wk = (n: number, o: Partial<Week>, sessions: Week['sessions']): Week =>
  ({ n, date: '2026-01-05', label: '', theme: '', type: 'normal', long_run_hrs: null, weekly_km: 0, sessions, ...o }) as Week

const PLAN = {
  meta: { volume_constraint_note: 'A note.', hard_pref_note: 'Another.', generator_input: { not_a_note: 'x' } },
  weeks: [
    wk(-1, { phase: 'foundation', weekly_km: 12 }, { tue: s({ distance_km: 6 }), sat: s({ distance_km: 6 }) }),
    wk(1, { phase: 'base', weekly_km: 20 }, {
      mon: s({ type: 'rest', label: 'Rest' }),
      tue: s({ distance_km: 5 }), thu: s({ type: 'quality', label: 'Tempo', distance_km: 7 }),
      sat: s({ type: 'strength', label: 'Strength' }), sun: s({ role: 'long_run', label: 'Long run', distance_km: 8 }),
    }),
    wk(2, { phase: 'build', weekly_km: 24, type: 'deload' }, { tue: s({ distance_km: 6 }), sun: s({ role: 'long_run', label: 'Long run', distance_km: 12 }) }),
    wk(3, { phase: 'peak', weekly_km: 30 }, { tue: s({ type: 'hard', label: '5K time trial', distance_km: 9 }), sun: s({ role: 'long_run', label: 'Long run', distance_km: 14 }) }),
    wk(4, { phase: 'taper', weekly_km: 18 }, { sun: s({ role: 'long_run', label: 'Long run', duration_mins: 60, pace_target: '6:00–6:00 /km' }) }),
    wk(5, { type: 'race', weekly_km: 10 }, { sun: s({ type: 'race', label: 'Race', distance_km: 10 }) }),
  ],
} as unknown as Plan

describe('scorecard metrics — hand fixtures (ARCH-ENG-004)', () => {
  it('runsOf drops rest, strength and cross-training, in day order', () => {
    expect(runsOf(PLAN.weeks[1]).map(r => r.day)).toEqual(['tue', 'thu', 'sun'])
  })
  it('km goes through the single owner: distance, else duration at its own pace', () => {
    expect(km(PLAN.weeks[1].sessions.tue)).toBe(5)
    expect(km(PLAN.weeks[4].sessions.sun)).toBeCloseTo(10, 5)    // 60 min at 6:00 /km
    expect(placedKm(PLAN.weeks[1])).toBe(20)                      // 5 + 7 + 8
  })
  it('training weeks exclude foundation and race week; loading weeks also exclude deload and taper', () => {
    expect(trainingWeeks(PLAN).map(w => w.n)).toEqual([1, 2, 3, 4])
    expect(loadingWeeks(PLAN).map(w => w.n)).toEqual([1, 3])
    expect(foundationWeeks(PLAN).map(w => w.n)).toEqual([-1])
  })
  it('peaks read loading weeks only: the deload\'s 12 km long run and the taper do not count', () => {
    expect(peakWeekKm(PLAN)).toBe(30)
    expect(peakLongRunKm(PLAN)).toBe(14)
  })
  it('a time trial is not a quality session, and is counted on its own', () => {
    expect(qualityCount(PLAN)).toBe(1)
    expect(timeTrials(PLAN).map(t => t.w.n)).toEqual([3])
  })
  it('metaNotes joins only *_note strings', () => {
    expect(metaNotes(PLAN)).toContain('A note.')
    expect(metaNotes(PLAN)).toContain('Another.')
    expect(metaNotes(PLAN)).not.toContain('not_a_note')
  })
  it('blocked days normalise full names to plan keys', () => {
    expect(Array.from(blockedDays({ days_cannot_train: ['Monday', 'sunday'] } as never)).sort()).toEqual(['mon', 'sun'])
  })
  it('longestRun counts the longest streak of equal neighbours', () => {
    expect(longestRun([1, 1, 2, 2, 2, 1], (a, b) => a === b)).toBe(3)
    expect(longestRun([], (a, b) => a === b)).toBe(0)
  })
})
