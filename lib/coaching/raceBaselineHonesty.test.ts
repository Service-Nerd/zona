import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { applyVdotDiscount } from '@/lib/plan/ruleEngine'
import type { BenchmarkInput } from '@/types/plan'

// The arc's baseline must be an INDEPENDENT measurement, never the same one
// aged. `applyVdotDiscount` always discounts, so comparing raw meta.vdot
// against its own discounted self reports a regression for doing nothing.

const ROUTE = readFileSync(join(process.cwd(), 'app/api/race-times/route.ts'), 'utf8')

describe('the discount makes a same-measurement arc arithmetically dishonest', () => {
  const bench = (weeksAgo: number): BenchmarkInput => {
    const d = new Date('2026-09-12'); d.setDate(d.getDate() - weeksAgo * 7)
    return { type: 'race', distance_km: 10, time: '0:50:00', benchmark_date: d.toISOString().slice(0, 10) } as BenchmarkInput
  }
  const today = new Date('2026-09-12')

  it('a FRESH benchmark is already discounted — "now" starts behind "then"', () => {
    const { vdot, discountPct } = applyVdotDiscount(50, bench(0), today)
    expect(discountPct).toBeGreaterThan(0)
    expect(vdot).toBeLessThan(50)
  })

  it('and the gap WIDENS with age, so waiting looks like decline', () => {
    const fresh = applyVdotDiscount(50, bench(0), today).vdot
    const stale = applyVdotDiscount(50, bench(26), today).vdot
    expect(stale).toBeLessThan(fresh)
  })
})

describe('state 1 passes no baseline', () => {
  it('does not hand meta.vdot in as the arc baseline', () => {
    // The defect, verbatim from before 2026-09-12. If this string returns,
    // every benchmark runner is being told they regressed.
    expect(ROUTE).not.toContain('buildTarget(discountedVdot, raceDistKm, raceName, baselineVdot')
  })

  it('FALSIFICATION — the matcher would catch the old call', () => {
    const old = 'buildTarget(discountedVdot, raceDistKm, raceName, baselineVdot, goalSeconds)'
    expect(old).toContain('buildTarget(discountedVdot, raceDistKm, raceName, baselineVdot')
  })

  it('states 2/3 DO pass a baseline — a genuinely separate measurement', () => {
    expect(ROUTE).toMatch(/baselineVdot \?\? usableDerivedBaseline/)
  })
})
