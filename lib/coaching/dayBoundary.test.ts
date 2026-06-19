import { describe, it, expect } from 'vitest'
import { daysDueByEndOfYesterday } from './dayBoundary'

// CoachingPrinciples §65 — today is in flight until midnight.
// These tests lock the exact off-by-one we shipped twice on 2026-06-19.
// If a future contributor "fixes" the slice by adding +1 (so today gets
// counted as due before the day is over), every test in this file fails.

describe('daysDueByEndOfYesterday', () => {
  // Anchor: 2026-06-15 was a Monday (verified). Every test names a noon
  // clock to confirm time-of-day doesn't matter — only the calendar day.

  it('Monday noon — no days due yet (week just started)', () => {
    const weekStart = '2026-06-15' // Monday
    const monNoon = new Date('2026-06-15T12:00:00')
    expect(daysDueByEndOfYesterday(weekStart, monNoon)).toEqual([])
  })

  it('Tuesday noon — only Monday is due', () => {
    const weekStart = '2026-06-15'
    const tueNoon = new Date('2026-06-16T12:00:00')
    expect(daysDueByEndOfYesterday(weekStart, tueNoon)).toEqual(['mon'])
  })

  it('Wednesday noon — Mon and Tue are due, Wed is NOT (the brand-corrosive bug)', () => {
    // The original failure: weekly report at noon Wed counted today as missed.
    // CoachScreen sessionsPlannedToDate did the same. Lock the right answer.
    const weekStart = '2026-06-15'
    const wedNoon = new Date('2026-06-17T12:00:00')
    expect(daysDueByEndOfYesterday(weekStart, wedNoon)).toEqual(['mon', 'tue'])
  })

  it('Wednesday late evening — still NOT Wed (in flight until midnight)', () => {
    const weekStart = '2026-06-15'
    const wed2330 = new Date('2026-06-17T23:30:00')
    expect(daysDueByEndOfYesterday(weekStart, wed2330)).toEqual(['mon', 'tue'])
  })

  it('Sunday noon — Mon–Sat are due (Sunday is still the last day in flight)', () => {
    const weekStart = '2026-06-15'
    const sunNoon = new Date('2026-06-21T12:00:00')
    expect(daysDueByEndOfYesterday(weekStart, sunNoon)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat'])
  })

  it('next Monday morning — the previous week is fully done', () => {
    // The week's "done" boundary is the next Monday's midnight. Any caller
    // running on Monday morning for last week's report sees all 7 days.
    const weekStart = '2026-06-15'
    const nextMon = new Date('2026-06-22T08:00:00')
    expect(daysDueByEndOfYesterday(weekStart, nextMon)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
  })

  it('pre-week-start — empty (no days have been due yet)', () => {
    // Edge: a future week the runner is previewing. Nothing is yet due.
    const weekStart = '2026-06-15'
    const lastFri = new Date('2026-06-12T12:00:00')
    expect(daysDueByEndOfYesterday(weekStart, lastFri)).toEqual([])
  })

  it('weeks later — saturates at 7 days, never overruns the array', () => {
    // A stale call (e.g. user opens an archived weekly report) shouldn't
    // panic. The slice caps at the week's 7 days.
    const weekStart = '2026-06-15'
    const twoWeeksLater = new Date('2026-06-29T12:00:00')
    expect(daysDueByEndOfYesterday(weekStart, twoWeeksLater)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
  })

  it('default `now` argument falls back to current clock', () => {
    // Just confirms the optional argument compiles + the default is real Date.
    const result = daysDueByEndOfYesterday('2020-01-06') // Mon, week long-past
    expect(result.length).toBe(7) // every day of that ancient week is "done"
  })
})
