// COACH-TREND-PENDING-01 — the trend card while it waits (founder-approved mockup + Coaching Board, 2026-10-30).
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import TrendCard from './TrendCard'
import { trendReadiness, buildHrTrendSeries, type RunRecord } from '@/lib/coaching/runHistory'
import { TREND_SERIES } from '@/lib/coaching/constants'

const html = (p: any) => renderToStaticMarkup(React.createElement(TrendCard, p))

/** A run `monthsAgo` months back (mid-month), `km` long. */
const run = (monthsAgo: number, km: number, hr = 140): RunRecord => {
  const d = new Date(); d.setUTCDate(15); d.setUTCMonth(d.getUTCMonth() - monthsAgo)
  return { source: 'apple_health' as any, startDate: d, distanceKm: km, movingTimeSec: km * 360, avgHr: hr, avgSpeedMs: null, hrInZonePct: null, hrAboveCeilingPct: null, hrBelowFloorPct: null }
}

describe('trendReadiness counts the same cohort the series is built from', () => {
  it('runs near the anchor distance count; far ones do not', () => {
    const r = trendReadiness([run(0, 8), run(1, 8.2), run(1, 30)], { distanceKm: 8 })
    expect(r.runs).toBe(2)
    expect(r.needRuns).toBe(TREND_SERIES.MIN_TOTAL_RUNS)
  })
  it('a month counts only with MIN_RUNS_PER_BUCKET runs', () => {
    expect(trendReadiness([run(0, 8), run(0, 8), run(1, 8)], { distanceKm: 8 }).months).toBe(1)
  })
  it('🔴 when readiness says ready, the series exists (one cohort, never two)', () => {
    const h = [run(0, 8), run(0, 8), run(0, 8), run(1, 8), run(1, 8), run(1, 8)]
    const r = trendReadiness(h, { distanceKm: 8 })
    expect(r.runs >= r.needRuns && r.months >= r.needMonths).toBe(true)
    expect(buildHrTrendSeries(h, { sessionType: 'easy', distanceKm: 8 })).not.toBeNull()
  })
})

describe('TrendCard pending with progress', () => {
  it('shows "N of 6", a strip, and the approved sentence', () => {
    const out = html({ state: 'pending', label: 'Easy run trend', sessionLabel: 'easy run', progress: { runs: 4, needRuns: 6 } })
    expect(out).toContain('data-trend-progress')
    expect(out).toMatch(/4\s*(<!-- -->)?\s*<span[^>]*>of 6</)
    expect(out).toContain('Easy runs at your usual distance, two a month for two months.')
    expect(out).not.toContain('Compounds quietly')
  })
  it('never shows more than the target', () => {
    expect(html({ state: 'pending', progress: { runs: 9, needRuns: 6 }, sessionLabel: 'easy run' })).toMatch(/6\s*(<!-- -->)?\s*<span[^>]*>of 6</)
  })
  it('without progress it keeps the old dashes (a failed readiness read is not "0 of 6")', () => {
    const out = html({ state: 'pending', sessionLabel: 'easy run' })
    expect(out).not.toContain('data-trend-progress')
    expect(out).toContain('Compounds quietly')
  })
})

describe('TrendCard steady', () => {
  const base = { state: 'steady', label: 'Easy run trend', sessionLabel: 'easy run', earlierHr: 142, nowHr: 141, sinceMonth: 'August', cohortSize: 9, noiseFloorBpm: 4 }
  it('numbers and the word "steady", with the noise floor stated', () => {
    const out = html(base)
    expect(out).toContain('data-trend-steady')
    expect(out).toContain('Steady since August, across 9 easy runs. A change under 4 bpm is noise, so I am not calling it yet.')
  })
  it('no up/down word and no colour verdict (Coaching Board)', () => {
    const out = html(base)
    expect(out).not.toMatch(/improv|declin|worse|better|fitter|--moss|--warn|--danger/i)
  })
  it('states a real pace change plainly, never hides it', () => {
    expect(html({ ...base, earlierPace: 400, nowPace: 360 })).toMatch(/You were running .+, now .+\./)
    expect(html({ ...base, earlierPace: 400, nowPace: 395 })).not.toContain('You were running')
  })
})

describe('Coach wiring', () => {
  const shell = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
  it('no series → pending with readiness; series below the floor → steady', () => {
    expect(shell).toMatch(/state: 'pending', progress: \{ runs: r\.runs, needRuns: r\.needRuns \}/)
    expect(shell).toMatch(/if \(!trend\.hrIsTrending\) \{/)
    expect(shell).toContain('noiseFloorBpm={TREND_SERIES.MIN_HR_DELTA_BPM}')
  })
  it('the route returns readiness from the shared cohort', () => {
    const route = readFileSync('app/api/coaching/trend/route.ts', 'utf8')
    expect(route).toContain('trendReadiness(history, { distanceKm }, windowMonths)')
    expect(route).toMatch(/NextResponse\.json\(\{ trend, readiness/)
  })
})
