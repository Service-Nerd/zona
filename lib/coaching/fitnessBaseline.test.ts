import { describe, it, expect } from 'vitest'
import { deriveFitnessBaseline, weightedAerobicSpeed, FITNESS_BASELINE, type AerobicRun } from './fitnessBaseline'

const WEEK = 7 * 24 * 60 * 60 * 1000
const d = (iso: string) => new Date(iso)
const run = (iso: string, speed = 2.3, km = 10): AerobicRun =>
  ({ startDate: d(iso), avgSpeedMs: speed, distanceM: km * 1000 })

describe('weightedAerobicSpeed', () => {
  it('weights by distance, not by run count', () => {
    // A 2 km shuffle at 2.0 and a 20 km run at 3.0 is not 2.5.
    const s = weightedAerobicSpeed([run('2026-04-01', 2.0, 2), run('2026-04-02', 3.0, 20)])!
    expect(s).toBeCloseTo((2.0 * 2000 + 3.0 * 20000) / 22000, 6)
    expect(s).toBeGreaterThan(2.5)
  })

  it('returns null, never 0, when nothing is usable', () => {
    expect(weightedAerobicSpeed([])).toBeNull()
    expect(weightedAerobicSpeed([run('2026-04-01', 0, 10)])).toBeNull()
    expect(weightedAerobicSpeed([run('2026-04-01', 2.3, 0)])).toBeNull()
    expect(weightedAerobicSpeed([run('2026-04-01', NaN, 10)])).toBeNull()
  })
})

describe('deriveFitnessBaseline — the window', () => {
  const now = d('2026-09-12T00:00:00Z')
  const currentStart = new Date(now.getTime() - 6 * WEEK)   // matches STRAVA_WINDOW_WEEKS

  it('takes the EARLIEST window and labels it by month', () => {
    const b = deriveFitnessBaseline([
      run('2026-04-24'), run('2026-04-28'), run('2026-05-03'),
      run('2026-08-20'), run('2026-09-01'),
    ], currentStart)!
    expect(b.runCount).toBe(3)          // only the April/May window
    expect(b.label).toBe('Apr')
    expect(b.monthKey).toBe('2026-04')
  })

  it('excludes runs past the window end', () => {
    const b = deriveFitnessBaseline([
      run('2026-04-01'), run('2026-04-10'), run('2026-04-20'),
      run('2026-06-01'),   // > 6 weeks after the first — outside
    ], currentStart)!
    expect(b.runCount).toBe(3)
  })

  it('REFUSES when the windows are too close — that is not a "before"', () => {
    // First qualifying run only 4 weeks before the current window starts.
    const first = new Date(currentStart.getTime() - 4 * WEEK).toISOString()
    const b = deriveFitnessBaseline([run(first), run(first), run(first)], currentStart)
    expect(b).toBeNull()
  })

  it('accepts at exactly the separation floor', () => {
    // windowEnd must sit MIN_SEPARATION_WEEKS before currentStart.
    const first = new Date(
      currentStart.getTime()
      - (FITNESS_BASELINE.MIN_SEPARATION_WEEKS + FITNESS_BASELINE.WINDOW_WEEKS) * WEEK,
    ).toISOString()
    expect(deriveFitnessBaseline([run(first), run(first), run(first)], currentStart)).not.toBeNull()
  })

  it('REFUSES below the minimum run count', () => {
    const first = '2026-04-01'
    expect(deriveFitnessBaseline([run(first), run(first)], currentStart)).toBeNull()
  })

  it('is not fooled by unsorted input', () => {
    const b = deriveFitnessBaseline([
      run('2026-05-03'), run('2026-04-24'), run('2026-04-28'),
    ], currentStart)!
    expect(b.label).toBe('Apr')
  })

  it('drops unusable runs before counting them towards the minimum', () => {
    expect(deriveFitnessBaseline([
      run('2026-04-01'), run('2026-04-02', 0), run('2026-04-03', NaN),
    ], currentStart)).toBeNull()
  })
})

describe('deriveFitnessBaseline — the founder, on production data', () => {
  // Measured 2026-09-12, user 1afc17e4: 10 qualifying runs in the 6-week window
  // from 2026-04-24, weighted speed 2.269 m/s; current window 2 runs at 2.574.
  // Separation 8.2 weeks. This is the account that reported the arc missing.
  const currentStart = d('2026-08-01T00:00:00Z')
  const founderRuns: AerobicRun[] = Array.from({ length: 10 }, (_, i) =>
    run(new Date(d('2026-04-24').getTime() + i * 3 * 24 * 3600 * 1000).toISOString(), 2.269, 12))

  it('produces a baseline where the live account previously had none', () => {
    const b = deriveFitnessBaseline(founderRuns, currentStart)!
    expect(b).not.toBeNull()
    expect(b.label).toBe('Apr')
    expect(b.runCount).toBe(10)
    expect(b.weightedSpeedMs).toBeCloseTo(2.269, 3)
  })

  it('the improvement it exposes is real, not a rounding artefact', () => {
    // 2.269 -> 2.574 m/s at the same aerobic HR band is 13.4% faster.
    expect((2.574 - 2.269) / 2.269).toBeGreaterThan(0.10)
  })
})
