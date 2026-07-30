import { describe, it, expect } from 'vitest'
import { manualMetricsFeedbackText } from './manualSessionFeedback'

describe('manualMetricsFeedbackText (DS-06)', () => {
  // ── HR read leads when avg HR + a ceiling are present ──
  it('easy run inside the band → discipline praise', () => {
    const t = manualMetricsFeedbackText('easy', { distanceKm: 8, plannedKm: 8, avgHr: 140, hrCeiling: 150 })
    expect(t).toContain('140')
    expect(t.toLowerCase()).toContain('inside the band')
  })

  it('easy run a touch over the ceiling → gentle ease-back', () => {
    const t = manualMetricsFeedbackText('easy', { distanceKm: 8, plannedKm: 8, avgHr: 156, hrCeiling: 150 })
    expect(t).toContain('156')
    expect(t.toLowerCase()).toContain('over the ceiling')
  })

  it('easy run well over the ceiling → hot-day warning', () => {
    const t = manualMetricsFeedbackText('easy', { distanceKm: 8, plannedKm: 8, avgHr: 168, hrCeiling: 150 })
    expect(t.toLowerCase()).toContain('hot')
  })

  it('hard session at/above target → "in the work"', () => {
    const t = manualMetricsFeedbackText('intervals', { distanceKm: 6, plannedKm: 6, avgHr: 175, hrCeiling: 168 })
    expect(t.toLowerCase()).toContain('work')
  })

  it('hard session under target → room to push', () => {
    const t = manualMetricsFeedbackText('tempo', { distanceKm: 6, plannedKm: 6, avgHr: 150, hrCeiling: 168 })
    expect(t.toLowerCase()).toContain('under the target')
  })

  // ── No HR → distance vs planned ──
  it('no HR, on the number → on-target line', () => {
    const t = manualMetricsFeedbackText('easy', { distanceKm: 8, plannedKm: 8, avgHr: null, hrCeiling: null })
    expect(t.toLowerCase()).toContain('on the number')
  })

  it('no HR, short of planned → honest short line', () => {
    const t = manualMetricsFeedbackText('easy', { distanceKm: 5, plannedKm: 8, avgHr: null, hrCeiling: null })
    expect(t.toLowerCase()).toContain('short')
    expect(t).toContain('5.0km')
  })

  it('no HR, long → a-bit-long line', () => {
    const t = manualMetricsFeedbackText('easy', { distanceKm: 11, plannedKm: 8, avgHr: null, hrCeiling: null })
    expect(t.toLowerCase()).toContain('long')
  })

  it('no HR and no planned distance → bare distance log', () => {
    const t = manualMetricsFeedbackText('run', { distanceKm: 7.3, plannedKm: null, avgHr: null, hrCeiling: null })
    expect(t).toBe('7.3km logged.')
  })

  it('avg HR present but no ceiling falls through to distance judgement', () => {
    const t = manualMetricsFeedbackText('easy', { distanceKm: 8, plannedKm: 8, avgHr: 145, hrCeiling: null })
    expect(t.toLowerCase()).toContain('on the number')
  })
})
