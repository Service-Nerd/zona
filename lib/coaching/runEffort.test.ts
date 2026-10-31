// COACH-EFFORT-PICTURE-01 / §132 — what kind of run was this, by time in zone, never by average heart rate.
import { describe, it, expect } from 'vitest'
import { runEffortKind } from './runEffort'

const run = (z1: number, z2: number, z3: number, z45: number) => ({ hr_pct_z1: z1, hr_pct_z2: z2, hr_pct_z3: z3, hr_pct_z4_5: z45 })

describe('runEffortKind', () => {
  it('a run mostly in Zone 3 is grey', () => {
    // The founder's 23 Aug 9.3 km: 0 / 34 / 59 / 6.
    expect(runEffortKind(run(0, 34.38, 59.38, 6.25))).toBe('grey')
  })

  it('🔴 an interval-shaped run is split, even though its average heart rate would sit in Zone 3', () => {
    expect(runEffortKind(run(10, 30, 25, 35))).toBe('split')
  })

  it('🔴 a linked tempo is planned, never grey: the engine prescribes Zone 3', () => {
    expect(runEffortKind(run(0, 20, 70, 10), 'quality')).toBe('planned')
    expect(runEffortKind(run(0, 20, 70, 10), 'easy')).toBe('grey')
  })

  it('mostly easy is easy, mostly Zone 4–5 is hard, ties go to the easier side', () => {
    expect(runEffortKind(run(5.88, 76.47, 17.65, 0))).toBe('easy')
    expect(runEffortKind(run(0, 19.23, 34.62, 46.15))).toBe('hard')
    expect(runEffortKind(run(0, 50, 50, 0))).toBe('easy')
    expect(runEffortKind(run(0, 0, 50, 50))).toBe('grey')
  })

  it('no split is unknown, never easy', () => {
    expect(runEffortKind({ hr_pct_z1: null, hr_pct_z2: null, hr_pct_z3: null, hr_pct_z4_5: null })).toBe('unknown')
    expect(runEffortKind(run(0, 0, 0, 0))).toBe('unknown')
  })
})
