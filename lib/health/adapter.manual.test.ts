import { describe, it, expect } from 'vitest'
import { adaptManualRun, type ManualRunPayload } from './adapter'

const BASE: ManualRunPayload = {
  source:          'manual',
  manualUuid:      'manual-w5-tue',
  startDate:       '2026-07-30T08:00:00.000Z',
  distanceMeters:  8100,
  durationSeconds: 3000, // 50 min
}

describe('adaptManualRun (DS-06)', () => {
  it('maps a manual payload to a source=manual activity row', () => {
    const row = adaptManualRun('user-1', BASE)
    expect(row.source).toBe('manual')
    expect(row.manual_uuid).toBe('manual-w5-tue')
    expect(row.apple_health_uuid).toBeNull()
    expect(row.strava_activity_id).toBeNull()
    expect(row.distance_m).toBe(8100)
    expect(row.moving_time_s).toBe(3000)
    expect(row.elapsed_time_s).toBe(3000)
    expect(row.name).toBe('Manual run')
  })

  it('computes avg_speed from distance and duration (m/s)', () => {
    const row = adaptManualRun('user-1', BASE)
    // 8100 m / 3000 s = 2.7 m/s
    expect(row.avg_speed).toBeCloseTo(2.7, 4)
  })

  it('carries avg HR when supplied, rounded to bpm', () => {
    const row = adaptManualRun('user-1', { ...BASE, avgHeartRate: 148.6 })
    expect(row.avg_hr).toBe(149)
  })

  it('leaves avg_hr null when not supplied', () => {
    const row = adaptManualRun('user-1', BASE)
    expect(row.avg_hr).toBeNull()
  })

  it('never populates HR-stream-derived fields (a single avg HR is not a stream)', () => {
    const row = adaptManualRun('user-1', { ...BASE, avgHeartRate: 150 })
    expect(row.hr_in_zone_pct).toBeNull()
    expect(row.hr_pct_z2).toBeNull()
    expect(row.hr_above_ceiling_pct).toBeNull()
    expect(row.max_hr).toBeNull()
    expect(row.elevation_gain).toBeNull()
    expect(row.calories_kcal).toBeNull()
  })

  it('uses a trimmed name when provided, else "Manual run"', () => {
    expect(adaptManualRun('u', { ...BASE, name: '  Parkrun ' }).name).toBe('Parkrun')
    expect(adaptManualRun('u', { ...BASE, name: '   ' }).name).toBe('Manual run')
  })

  it('guards divide-by-zero on zero duration', () => {
    const row = adaptManualRun('user-1', { ...BASE, durationSeconds: 0 })
    expect(row.avg_speed).toBeNull()
  })
})
