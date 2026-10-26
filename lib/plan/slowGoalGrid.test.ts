// GRID-SLOW-GOALGAP-01 (2026-10-26). The slow-goal grid must keep reaching the runners the 26 Oct RCA found the
// grids missed, and the sweep must keep running it.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SLOW_BENCHMARKS, GOAL_GAPS, SLOW_DISTANCES, targetForGap, slowGoalGrid, slowGoalDates } from './slowGoalGrid'
import { benchmarkVdot } from './benchmarkCheck'

const secs = (t: string) => t.split(':').reduce((a, x) => a * 60 + +x, 0)
/** The sweep's slowest benchmark before this item: HM 2:30. */
const OLD_FLOOR_VDOT = benchmarkVdot({ distance_km: 21.1, time: '2:30:00' })!

describe('the slow-goal grid', () => {
  it('🔴 every benchmark is slower than the sweep ever reached before', () => {
    for (const b of SLOW_BENCHMARKS) expect(benchmarkVdot(b)!, `${b.distance_km} km ${b.time}`).toBeLessThan(OLD_FLOOR_VDOT)
  })
  it('reaches the slowest live runner measured on 26 Oct (VDOT 16.2)', () => {
    expect(Math.min(...SLOW_BENCHMARKS.map(b => benchmarkVdot(b)!))).toBeLessThan(17)
  })
  it('🔴 the goal gap moves the target: each step is faster, and gap 0 is the predicted time', () => {
    for (const b of SLOW_BENCHMARKS) for (const d of SLOW_DISTANCES) {
      const t = GOAL_GAPS.map(g => secs(targetForGap(b, d.km, g)))
      for (let i = 1; i < t.length; i++) expect(t[i]).toBeLessThan(t[i - 1])
      expect(t[t.length - 1] / t[0]).toBeCloseTo(1 - GOAL_GAPS[GOAL_GAPS.length - 1], 2)
    }
  })
  it('every case is a time goal with a benchmark, and the size is the product of its axes', () => {
    const { planStart, benchmarkDate } = slowGoalDates(new Date('2026-10-26T12:00:00Z'))
    const g = slowGoalGrid(planStart, benchmarkDate)
    expect(g.length).toBe(SLOW_BENCHMARKS.length * SLOW_DISTANCES.length * GOAL_GAPS.length * 2 * 3 * 2)
    for (const c of g) { expect(c.goal).toBe('time_target'); expect(c.target_time).toMatch(/^\d+:\d{2}(:\d{2})?$/); expect(c.benchmark.benchmark_date).toBe(benchmarkDate) }
  })
  it('🔴 dates come from the clock: the plan starts on a future Monday and the benchmark is in the past', () => {
    const now = new Date(2026, 9, 26, 7, 0)   // Monday 07:00 LOCAL
    const { planStart, benchmarkDate } = slowGoalDates(now)
    expect(new Date(`${planStart}T12:00:00`).getDay()).toBe(1)
    expect(planStart > '2026-10-26').toBe(true)
    expect(benchmarkDate < '2026-10-26').toBe(true)
  })
})

describe('the sweep runs it', () => {
  // Comments stripped, so a commented-out spread cannot satisfy it (a source assertion passes on a comment).
  const src = readFileSync('scripts/property-validate-plans.ts', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  it('🔴 the slow-goal clones are built from the grid\'s own axes and joined into the inputs', () => {
    expect(src).toMatch(/const slowGoalClones = randomInputs\.filter\(\(_, i\) => i % 17 === 0\)/)
    expect(src).toContain('targetForGap(benchmark, inp.race_distance_km, gap)')
    const inputs = src.slice(src.indexOf('const inputs = ['), src.indexOf(']', src.indexOf('const inputs = [')))
    expect(inputs).toContain('...slowGoalClones,')
  })
  it('🔴 their violations are tallied apart, so the main population keeps its own zero', () => {
    expect(src).toContain('const tally = SLOW_GOAL_INPUTS.has(input) ? `${v.code}${SLOW_GOAL_SUFFIX}` : v.code')
    expect(src).toMatch(/'INV-PLAN-MIN-SESSION-SIZE':\s+0,/)
  })
})
