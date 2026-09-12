import { describe, it, expect } from 'vitest'
import { isPlausibleRunHr, meanHr, buildHrTrendSeries, type RunRecord } from './runHistory'
import { RUN_HR_PLAUSIBLE, TREND_SERIES } from './constants'

// The Coach screen told the founder his easy runs went "77 (Apr avg) → 146
// (now)" and Kit repeated it as fact. The trend maths was right the whole way;
// it was faithfully averaging a corrupt `avg_hr` row. These pin the gate.

describe('isPlausibleRunHr', () => {
  it('accepts a real easy-run average', () => expect(isPlausibleRunHr(146)).toBe(true))

  it('REJECTS 77 — the number that actually shipped', () => {
    expect(isPlausibleRunHr(77)).toBe(false)
  })

  it('rejects a resting heart rate mistaken for a run', () => expect(isPlausibleRunHr(52)).toBe(false))
  it('rejects a sensor spike above any human maximum', () => expect(isPlausibleRunHr(255)).toBe(false))
  it.each([null, undefined, NaN, 0])('rejects %p', (v) => expect(isPlausibleRunHr(v as number)).toBe(false))

  it('is inclusive at both bounds', () => {
    expect(isPlausibleRunHr(RUN_HR_PLAUSIBLE.MIN_BPM)).toBe(true)
    expect(isPlausibleRunHr(RUN_HR_PLAUSIBLE.MAX_BPM)).toBe(true)
    expect(isPlausibleRunHr(RUN_HR_PLAUSIBLE.MIN_BPM - 1)).toBe(false)
    expect(isPlausibleRunHr(RUN_HR_PLAUSIBLE.MAX_BPM + 1)).toBe(false)
  })
})

describe('meanHr', () => {
  it('averages the plausible runs', () => {
    expect(meanHr([{ avgHr: 140 }, { avgHr: 150 }])).toBe(145)
  })

  it('DROPS the bad row rather than the whole month', () => {
    // One corrupt activity should cost that activity, not the bucket.
    expect(meanHr([{ avgHr: 77 }, { avgHr: 144 }, { avgHr: 146 }])).toBe(145)
  })

  it('returns NULL, never 0, when nothing is usable', () => {
    expect(meanHr([{ avgHr: null }, { avgHr: 40 }])).toBeNull()
    expect(meanHr([])).toBeNull()
  })
})

// ── End to end through the series builder ──────────────────────────────────

function run(iso: string, avgHr: number | null, distanceKm = 8): RunRecord {
  return {
    startDate: new Date(iso),
    distanceKm,
    movingTimeSec: distanceKm * 330,
    avgHr,
  } as RunRecord
}

/** Two months, enough runs per bucket to clear every TREND_SERIES threshold. */
function history(earlierHrs: (number | null)[], nowHrs: (number | null)[]): RunRecord[] {
  const now = new Date()
  const monthAgo = (n: number, day: number) => {
    const d = new Date(now); d.setMonth(d.getMonth() - n); d.setDate(day); return d.toISOString()
  }
  return [
    ...earlierHrs.map((hr, i) => run(monthAgo(2, i + 1), hr)),
    ...nowHrs.map((hr, i) => run(monthAgo(0, i + 1), hr)),
  ]
}

describe('buildHrTrendSeries — the corrupt bucket', () => {
  const anchor = { sessionType: 'easy', distanceKm: 8 }

  it('a bad row no longer drags the earlier bucket down', () => {
    const series = buildHrTrendSeries(history([77, 150, 152], [146, 148, 147]), anchor, 6)!
    expect(series.buckets[0].avgHr).toBe(151)     // not 126, and not 77
    expect(series.hrDeltaBpm).toBeLessThan(0)     // genuinely improving
  })

  it('a bucket of ONLY bad rows reports null rather than a fake average', () => {
    const series = buildHrTrendSeries(history([77, 60, 55], [146, 148, 147]), anchor, 6)
    expect(series!.buckets[0].avgHr).toBeNull()
    expect(series!.hrDeltaBpm).toBeNull()
    // And with no delta there is no claim to make.
    expect(series!.hrIsTrending).toBe(false)
  })

  it('FALSIFICATION — the same history WITHOUT the bad row averages identically', () => {
    // Proves the gate removes only the corrupt row's HR and nothing else.
    // The `now` bucket is padded so both runs clear MIN_TOTAL_RUNS; the two
    // earlier buckets are what is being compared.
    const withBad    = buildHrTrendSeries(history([77, 150, 152], [146, 148, 147]), anchor, 6)!
    const withoutBad = buildHrTrendSeries(history([150, 152], [146, 148, 147, 145]), anchor, 6)!
    expect(withBad.buckets[0].avgHr).toBe(withoutBad.buckets[0].avgHr)
  })

  it('a corrupt row still COUNTS as a run — only its HR is discarded', () => {
    // "across 20 easy runs" is a statement about runs at that distance, and
    // that part of the row was never in doubt. Dropping the run entirely would
    // understate the sample.
    const series = buildHrTrendSeries(history([77, 150, 152], [146, 148, 147]), anchor, 6)!
    expect(series.buckets[0].cohortSize).toBe(3)
  })

  it('the thresholds it has to clear are the real ones', () => {
    expect(TREND_SERIES.MIN_BUCKETS).toBe(2)
    expect(TREND_SERIES.MIN_RUNS_PER_BUCKET).toBe(2)
  })
})
