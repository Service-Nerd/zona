import { describe, it, expect } from 'vitest'
import { classifyRecentRace, generateRecoveryOpeningBlock } from './foundationBlock'
import type { GeneratorInput } from '@/types/plan'

/**
 * ENGINE-05 — post-race recovery gating (CoachingPrinciples §76).
 * A race completed within a distance-keyed window prepends an easy-only recovery
 * block before Week 1. generateRecoveryOpeningBlock self-validates via
 * validateRecoveryOpeningBlock (throws under NODE_ENV=test), so a successful
 * generate also asserts the structural invariants.
 */

const baseInput = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_date:             '2027-04-24',
  race_distance_km:      42.2,
  goal:                  'finish',
  current_weekly_km:     15,
  longest_recent_run_km: 12,
  days_available:        4,
  age:                   38,
  ...over,
})

const TODAY = '2026-08-02'

describe('classifyRecentRace', () => {
  it('does not gate when no last_race_date is given', () => {
    expect(classifyRecentRace(baseInput(), TODAY)).toEqual({ gates: false, weeks: 0 })
  })

  it('does not gate a future-dated race', () => {
    const r = classifyRecentRace(baseInput({ last_race_date: '2026-08-10', last_race_distance_km: 42.2 }), TODAY)
    expect(r.gates).toBe(false)
  })

  it('does not gate when the race is outside the recency window (marathon > 21d)', () => {
    // 2026-07-03 → 30 days before TODAY, window is 21
    const r = classifyRecentRace(baseInput({ last_race_date: '2026-07-03', last_race_distance_km: 42.2 }), TODAY)
    expect(r.gates).toBe(false)
  })

  it('gates a 100km finished 18 days ago, faded → 2 opening weeks', () => {
    // 100K: blackout 3 + faded extension 1 = 4; elapsed 18d = 2 weeks → 4 - 2 = 2
    const r = classifyRecentRace(
      baseInput({ last_race_date: '2026-07-15', last_race_distance_km: 100, last_race_effort: 'faded' }),
      TODAY,
    )
    expect(r).toEqual({ gates: true, weeks: 2, distKey: '100K' })
  })

  it('gates a marathon finished 5 days ago, strong → 2 opening weeks', () => {
    const r = classifyRecentRace(
      baseInput({ last_race_date: '2026-07-28', last_race_distance_km: 42.2, last_race_effort: 'finished_strong' }),
      TODAY,
    )
    expect(r).toEqual({ gates: true, weeks: 2, distKey: 'MARATHON' })
  })

  it('floors the opening at 1 week when most of the recovery has already elapsed', () => {
    // 100K blackout 3, strong; 34 days elapsed (still within 35d window) = 4 weeks → 3 - 4 = -1 → floored to 1
    const r = classifyRecentRace(
      baseInput({ last_race_date: '2026-06-29', last_race_distance_km: 100, last_race_effort: 'finished_strong' }),
      TODAY,
    )
    expect(r).toEqual({ gates: true, weeks: 1, distKey: '100K' })
  })
})

describe('classifyRecentRace — cross-plan de-dup vs MAINT-01 (#7)', () => {
  const recentUltra = baseInput({ last_race_date: '2026-07-15', last_race_distance_km: 100, last_race_effort: 'faded' })

  it('suppresses gating when an active maintenance block covers the same race', () => {
    const r = classifyRecentRace(recentUltra, TODAY, { date: '2026-07-15', distanceKm: 100 })
    expect(r).toEqual({ gates: false, weeks: 0 })
  })

  it('tolerates small date/distance drift on the match (±7d / ±10%)', () => {
    const r = classifyRecentRace(recentUltra, TODAY, { date: '2026-07-12', distanceKm: 105 })
    expect(r.gates).toBe(false)
  })

  it('still gates when the maintenance block is for a different race (distance)', () => {
    const r = classifyRecentRace(recentUltra, TODAY, { date: '2026-07-15', distanceKm: 42.2 })
    expect(r.gates).toBe(true)
  })

  it('still gates when the maintenance block race is too far off in time', () => {
    const r = classifyRecentRace(recentUltra, TODAY, { date: '2026-06-01', distanceKm: 100 })
    expect(r.gates).toBe(true)
  })

  it('gates normally when there is no active maintenance block', () => {
    expect(classifyRecentRace(recentUltra, TODAY, null).gates).toBe(true)
    expect(classifyRecentRace(recentUltra, TODAY).gates).toBe(true)
  })
})

describe('generateRecoveryOpeningBlock', () => {
  const input = baseInput({ current_weekly_km: 15, longest_recent_run_km: 12 })

  it('produces N easy-only weeks with negative indices ending at -1', () => {
    const { weeks } = generateRecoveryOpeningBlock({ input, planStartDate: '2026-08-17', weeks: 2 })
    expect(weeks).toHaveLength(2)
    expect(weeks.map(w => w.n)).toEqual([-2, -1])
    for (const w of weeks) {
      expect(w.phase).toBe('foundation')
      for (const s of Object.values(w.sessions ?? {})) {
        if (s) expect(['easy', 'rest', 'cross-train']).toContain(s.type)
      }
    }
  })

  it('never builds above current volume and ramps up (INV-RECOV-VOLUME-CEILING)', () => {
    const { weeks } = generateRecoveryOpeningBlock({ input, planStartDate: '2026-08-17', weeks: 3 })
    for (const w of weeks) {
      expect(w.weekly_km).toBeLessThanOrEqual(input.current_weekly_km + 0.1)
    }
    // monotonic non-decreasing ramp
    for (let i = 1; i < weeks.length; i++) {
      expect(weeks[i].weekly_km).toBeGreaterThanOrEqual(weeks[i - 1].weekly_km)
    }
    // opens low — first week at ~50% of current
    expect(weeks[0].weekly_km).toBeLessThan(input.current_weekly_km)
  })

  it('places at least one rest day each week (easy-only block on limited days)', () => {
    const { weeks } = generateRecoveryOpeningBlock({ input: baseInput({ days_available: 4 }), planStartDate: '2026-08-17', weeks: 2 })
    for (const w of weeks) {
      const placed = Object.values(w.sessions ?? {}).filter(Boolean).length
      expect(placed).toBeLessThanOrEqual(4)
    }
  })
})
