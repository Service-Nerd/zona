/**
 * §47 Amendment 3 (Coaching Board PEAK-STEPBACK-S52-FLOOR-01, 2026-10-13).
 *
 * The checker forgave ONE of the two floors the producer honours, so
 * `applyPeakStepBackVolume` declining for a §52 reason read as a constitutional
 * failure. These arms hold the new tolerance OPEN for exactly that condition and
 * SHUT for everything else — a widened tolerance is a hole unless the shutting
 * half is proven too.
 */
import { describe, it, expect } from 'vitest'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG as G } from './generationConfig'
import type { Plan, Week, GeneratorInput } from '@/types/plan'

const CODE = 'INV-PLAN-PEAK-STEPBACK-VOLUME'
const MAXPCT = G.LONG_RUN_MAX_PCT_OF_WEEKLY / 100
const easyFloor = G.MIN_SESSION_DISTANCE_KM.easy

/** A peak week whose long run and easy runs we control exactly. */
function week(n: number, weekly: number, longKm: number, easies: number[], stamp: boolean): Week {
  const sessions: Record<string, unknown> = {
    sun: { type: 'easy', role: 'long_run', label: 'Long run — Zone 2', distance_km: longKm,
           duration_mins: longKm * 6, coach_notes: stamp ? ['Step-back week. Easy aerobic — absorb.'] : [] },
  }
  const days = ['mon', 'tue', 'wed', 'thu', 'fri']
  easies.forEach((km, i) => {
    sessions[days[i]] = { type: 'easy', label: 'Easy run', distance_km: km, duration_mins: km * 6 }
  })
  const w: Week = {
    n, date: '2026-11-02', label: `Week ${n}`, theme: 't', type: 'normal', phase: 'peak',
    sessions: sessions as Week['sessions'], long_run_hrs: null, weekly_km: weekly,
  }
  if (stamp) w.peak_stepback = true
  return w
}

const input = { race_distance_km: 42.2, longest_recent_run_km: 11, injury_history: [] } as unknown as GeneratorInput
const planOf = (weeks: Week[]) => ({ weeks, meta: {} } as unknown as Plan)
const fire = (p: Plan) => validatePlan(p, input).filter(v => v.code === CODE)

describe('§47 Am.3 — §52 prevails when its share floor sits above the preceding week', () => {
  it('🔴 SILENT on the measured real case: 20km long run floors the week at 33.3 > prev 31', () => {
    // The exact shape of the four failing envelope plans.
    const v = fire(planOf([week(9, 31, 17, [7, 7], false), week(10, 33, 20, [6.5, 6.5], true)]))
    expect(20 / MAXPCT).toBeGreaterThan(31)          // the premise, asserted not assumed
    expect(v.filter(x => x.severity === 'error')).toEqual([])
  })

  it('declares the residual rather than ignoring it — a WARN is still emitted', () => {
    const v = fire(planOf([week(9, 31, 17, [7, 7], false), week(10, 33, 20, [6.5, 6.5], true)]))
    expect(v.map(x => x.severity)).toEqual(['warn'])
    expect(v[0].message).toMatch(/§52/)
  })

  // 🔴 THE SHUTTING HALF. A widened tolerance that forgives everything is a hole.
  it('🔴 FALSIFICATION — a climbing step-back week NOT limited by §52 is still an ERROR', () => {
    // Same overrun, small long run: §52 floor is 10/0.6 = 16.7, far BELOW prev 31.
    // There is room to trim and the engine simply did not, so this must fail.
    const v = fire(planOf([week(9, 31, 10, [10, 11], false), week(10, 33, 10, [11.5, 11.5], true)]))
    expect(10 / MAXPCT).toBeLessThan(31)
    expect(v.filter(x => x.severity === 'error').length).toBe(1)
  })

  it('🔴 FALSIFICATION — the min-easy floor tolerance still works and is not shadowed', () => {
    const v = fire(planOf([week(9, 31, 10, [10, 11], false), week(10, 33, 10, [easyFloor, easyFloor], true)]))
    expect(v).toEqual([])
  })
})

describe('§47 Am.3 — the step-back week is identified STRUCTURALLY', () => {
  it('the `peak_stepback` stamp alone is enough, with no coach note', () => {
    const w = week(10, 33, 10, [11.5, 11.5], true)
    const lr = (w.sessions as Record<string, { coach_notes?: string[] }>).sun
    lr.coach_notes = []                                   // strip the legacy marker
    const v = fire(planOf([week(9, 31, 10, [10, 11], false), w]))
    expect(v.filter(x => x.severity === 'error').length).toBe(1)
  })

  it('a week with NEITHER the stamp nor the note is not a step-back and is never judged', () => {
    expect(fire(planOf([week(9, 31, 10, [10, 11], false), week(10, 33, 10, [11.5, 11.5], false)]))).toEqual([])
  })
})
