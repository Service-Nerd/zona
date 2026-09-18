// PLAN-WEEK-COLLISION-01 — the detector must be able to see the real incident.
import { describe, it, expect } from 'vitest'
import { findWeekCollisions } from './planWeekCollision'

// The founder's actual data, 2026-09-18: a Dorney Lake 10K starting 2026-09-21
// with completions written the previous April still resolving against it.
const dorney = {
  meta: { plan_start: '2026-09-21', race_name: 'Dorney Lake' },
  weeks: Array.from({ length: 12 }, (_, i) => ({ n: i + 1 })),
}

describe('findWeekCollisions', () => {
  it('detects the incident it was written for', () => {
    const [f] = findWeekCollisions('u1', dorney, {
      session_completions: [
        { week_n: 2, at: '2026-04-14T00:00:00Z' },
        { week_n: 11, at: '2026-04-11T00:00:00Z' },
      ],
    })
    expect(f.staleRows).toBe(2)
    expect(f.earliest).toBe('2026-04-11T00:00:00Z')
    expect(f.raceName).toBe('Dorney Lake')
  })

  it('is silent on a healthy plan', () => {
    expect(findWeekCollisions('u1', dorney, {
      session_completions: [{ week_n: 1, at: '2026-09-22T00:00:00Z' }],
    })).toEqual([])
  })

  // A runner logging the Sunday before their plan's Monday start is normal.
  // Flagging it would train whoever reads the digest to ignore the signal.
  it('allows a week of grace around the plan start', () => {
    expect(findWeekCollisions('u1', dorney, {
      session_completions: [{ week_n: 1, at: '2026-09-18T00:00:00Z' }],
    })).toEqual([])
  })

  // A row outside the plan's week range is orphaned, not colliding. Different
  // defect; reporting it here would dilute this one.
  it('ignores weeks the plan does not own', () => {
    expect(findWeekCollisions('u1', dorney, {
      session_completions: [{ week_n: 40, at: '2026-04-14T00:00:00Z' }],
    })).toEqual([])
  })

  it('reports each affected table separately', () => {
    const f = findWeekCollisions('u1', dorney, {
      session_completions: [{ week_n: 2, at: '2026-04-14T00:00:00Z' }],
      run_analysis:        [{ week_n: 3, at: '2026-04-15T00:00:00Z' }],
    })
    expect(f.map(x => x.table).sort()).toEqual(['run_analysis', 'session_completions'])
  })

  it('says nothing when there is no plan to compare against', () => {
    expect(findWeekCollisions('u1', null, { session_completions: [{ week_n: 1, at: '2020-01-01' }] })).toEqual([])
  })
})
