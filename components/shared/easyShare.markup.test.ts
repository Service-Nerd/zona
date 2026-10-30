// COACH-DISCIPLINE-HEADLINE-01 — the rings' headline and weekly record (§130; Design Board; founder-approved mockup).
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { EasyShareHeader, EasyShareBars, EASY_SHARE_BARS } from './EasyShare'
import ZoneRings from './ZoneRings'
import { weeklyEasyShares, weekZoneSplitRows, zoneTimeSplit, easyShare } from '@/lib/coaching/weeklyZoneAggregate'
import { COACH_EASY_SHARE_MIN_RUNS } from '@/lib/coaching/constants'

const html = (el: React.ReactElement) => renderToStaticMarkup(el)
let n = 0
const run = (iso: string, km: number, z: [number, number, number, number]) => ({
  start_date: iso, distance_m: km * 1000, activity_type: 'Run', sport_type: 'Run',
  strava_activity_id: null, apple_health_uuid: `hk-${++n}`, manual_uuid: null,
  hr_pct_z1: z[0], hr_pct_z2: z[1], hr_pct_z3: z[2], hr_pct_z4_5: z[3],
})
const WEEK = { date: '2026-10-26' }

describe('weeklyEasyShares', () => {
  it('this week is last and equals the rings\' own figure (one set of rows)', () => {
    const rows = [run('2026-10-27T07:00:00Z', 10, [20, 60, 20, 0]), run('2026-10-29T07:00:00Z', 10, [0, 80, 20, 0])]
    const weeks = weeklyEasyShares(rows, WEEK, EASY_SHARE_BARS, COACH_EASY_SHARE_MIN_RUNS)
    const rings = easyShare(zoneTimeSplit(weekZoneSplitRows(rows, WEEK)).split!)
    expect(weeks[weeks.length - 1]).toBe(rings)
    expect(rings).toBe(80)
  })
  it(`a week with fewer than ${COACH_EASY_SHARE_MIN_RUNS} runs is null, never 0; leading empty weeks are dropped`, () => {
    const rows = [
      run('2026-10-13T07:00:00Z', 8, [0, 100, 0, 0]), run('2026-10-14T07:00:00Z', 8, [0, 100, 0, 0]),   // 2 weeks ago: 2 runs
      run('2026-10-20T07:00:00Z', 8, [0, 50, 50, 0]),                                                     // last week: 1 run
      run('2026-10-27T07:00:00Z', 8, [0, 70, 30, 0]), run('2026-10-28T07:00:00Z', 8, [0, 70, 30, 0]),   // this week
    ]
    expect(weeklyEasyShares(rows, WEEK, EASY_SHARE_BARS, COACH_EASY_SHARE_MIN_RUNS)).toEqual([100, null, 70])
  })
})

describe('weeklyEasyShares — the week edges (mutation harness survivors, 2026-10-30)', () => {
  it('a run at exactly Monday 00:00 belongs to that week', () => {
    const atStart = new Date('2026-10-26T00:00:00').toISOString()
    const rows = [run(atStart, 8, [0, 100, 0, 0]), run('2026-10-28T07:00:00Z', 8, [0, 100, 0, 0]),
      run('2026-10-20T07:00:00Z', 8, [0, 0, 100, 0]), run('2026-10-21T07:00:00Z', 8, [0, 0, 100, 0])]
    expect(weeklyEasyShares(rows, WEEK, EASY_SHARE_BARS, COACH_EASY_SHARE_MIN_RUNS)).toEqual([0, 100])
  })
  it("a Sunday run belongs to the week it ends, not the next", () => {
    const rows = [run('2026-10-19T09:00:00Z', 8, [0, 0, 100, 0]), run('2026-10-25T09:00:00Z', 8, [0, 0, 100, 0]),
      run('2026-10-27T09:00:00Z', 8, [0, 100, 0, 0]), run('2026-10-28T09:00:00Z', 8, [0, 100, 0, 0])]
    expect(weeklyEasyShares(rows, WEEK, EASY_SHARE_BARS, COACH_EASY_SHARE_MIN_RUNS)).toEqual([0, 100])
  })
})

describe('EasyShareHeader', () => {
  const out = html(React.createElement(EasyShareHeader, { share: 79, runs: 4 }))
  it('shows the share, "easy", and the plain description', () => {
    expect(out).toContain('>79%<')
    expect(out).toContain('of this week&#x27;s running sat in Zones 1–2.')
    expect(out).toMatch(/across (<!-- -->)?4(<!-- -->)? runs/)
  })
  it('🔴 described, never graded: the number is ink, no warning or verdict word (§130)', () => {
    expect(out).toMatch(/font-size:56px;font-weight:800;color:var\(--ink\)/)
    expect(out).not.toMatch(/--warn|--danger|good|great|poor|target|goal/i)
  })
})

describe('EasyShareBars', () => {
  it('always 8 slots; a thin week is an empty slot, not a zero-height value', () => {
    const out = html(React.createElement(EasyShareBars, { weeks: [70, null, 80] }))
    expect((out.match(/flex:1/g) ?? []).length).toBe(EASY_SHARE_BARS)
    expect(out).toContain('data-bar="empty"')
    expect(out).toContain('<span>2 weeks ago</span>')
  })
  it('no line, no number per bar', () => {
    const out = html(React.createElement(EasyShareBars, { weeks: [60, 70, 80, 75] }))
    expect(out).not.toMatch(/<svg|<path|<polyline|\d+%<\/div>/)
  })
  it('fewer than two weeks draws nothing', () => {
    expect(html(React.createElement(EasyShareBars, { weeks: [80] }))).toBe('')
  })
})

describe('ZoneRings headless', () => {
  it('drops its own heading only when asked; the default is unchanged', () => {
    const pct = { z1: 10, z2: 70, z3: 15, z45: 5 }
    expect(html(React.createElement(ZoneRings, { pctByZone: pct, headless: true }))).not.toContain('This week in zones')
    expect(html(React.createElement(ZoneRings, { pctByZone: pct }))).toContain('This week in zones')
  })
})

describe('Coach wiring', () => {
  const shell = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
  it(`the headline appears only with at least ${COACH_EASY_SHARE_MIN_RUNS} runs; below it the rings stand alone`, () => {
    expect(shell).toContain('(zoneHistogramHits ?? 0) >= COACH_EASY_SHARE_MIN_RUNS ? (')
    expect(shell).toContain('<EasyShareHeader share={easyShare(zoneTimePctByZone)} runs={zoneHistogramHits ?? 0} easiestSpan=')
    expect(shell).toContain('<ZoneRings chromeless headless pctByZone={zoneTimePctByZone} />')
  })
  it('the record reads the same activity rows as the rings, far enough back for 8 weeks', () => {
    expect(shell).toContain('weeklyEasyShares(recentActivity ?? [], currentWeek as any, EASY_SHARE_BARS, COACH_EASY_SHARE_MIN_RUNS)')
    expect(shell).toContain('Math.max(LOAD_PICTURE_LOOKBACK_DAYS, (EASY_SHARE_BARS + 1) * 7)')
  })
})
