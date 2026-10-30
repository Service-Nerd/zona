// RUNKED-LOAD-VIEW-01 — the load history row (Design Board 2026-10-30 ruling; founder-approved mockup, bars not a line).
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import LoadHistory from './LoadHistory'
import { LOAD_HISTORY_WEEKS } from '@/lib/coaching/loadPicture'

const html = (el: React.ReactElement) => renderToStaticMarkup(el)
const w = (km: number, plannedEasy = false) => ({ km, plannedEasy })

describe('LoadHistory', () => {
  const out = html(React.createElement(LoadHistory, {
    history: [w(24), w(27), w(18, true), w(28), w(38)], normalKm: 24, thisWeekColor: 'var(--warn)',
  }))
  it(`always ${LOAD_HISTORY_WEEKS} slots, filled from the right`, () => {
    expect((out.match(/flex:1/g) ?? []).length).toBe(LOAD_HISTORY_WEEKS * 2)   // bar row + marker row
    expect((out.match(/data-bar="past"/g) ?? []).length).toBe(4)
  })
  it('🔴 only this week takes the verdict colour; past weeks are neutral and unemphasised', () => {
    expect(out).toMatch(/data-bar="now" style="[^"]*background:var\(--warn\);opacity:1/)
    expect((out.match(/background:var\(--warn\)/g) ?? []).length).toBe(1)
    expect(out).not.toMatch(/data-bar="past" style="[^"]*opacity:1/)
  })
  it('🔴 a record, not a forecast: no line, no curve, no number per bar', () => {
    expect(out).not.toMatch(/<svg|<path|<polyline|\d+km<\/div>/)
  })
  it('the planned easy week is marked, and the key says so', () => {
    // One ▲ under the week itself, one in the key. Counting both: the key alone also contains "▲".
    expect((out.match(/▲/g) ?? []).length).toBe(2)
    expect(out).toContain('▲ planned easy week')
    const none = html(React.createElement(LoadHistory, { history: [w(20), w(22)], normalKm: 20, thisWeekColor: 'var(--moss)' }))
    expect(none).not.toContain('▲')
  })
  it('the normal band is drawn, and the screen reader gets every week in the reader’s unit', () => {
    expect(out).toContain('data-normal-band')
    expect(out).toContain('aria-label="Total distance, last 5 weeks: 24km, 27km, 18km (planned easy), 28km, 38km this week"')
    const mi = html(React.createElement(LoadHistory, { history: [w(16.09), w(32.19)], normalKm: 20, thisWeekColor: 'var(--moss)', units: 'mi' }))
    expect(mi).toContain('10mi, 20mi this week')
  })
  it('fewer than two weeks draws nothing', () => {
    expect(html(React.createElement(LoadHistory, { history: [w(20)], normalKm: 20, thisWeekColor: 'var(--moss)' }))).toBe('')
  })
})

describe('Coach wiring', () => {
  const shell = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
  it('only with a verdict, never in race week, coloured by the same verdict as the track', () => {
    expect(shell).toContain('history: !isRaceWeek && loadRatio !== null && loadPicture?.normalKm != null')
    expect(shell).toContain('thisWeekColor={lrc.markerColor}')
  })
})
