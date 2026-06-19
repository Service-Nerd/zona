import { describe, it, expect } from 'vitest'
import { findMatchCandidates, autoSelectMatch } from './sessionMatch'

// Golden cases for the auto-match scorer. These exist because we keep
// re-hitting the same picker-empty / no-auto-link failure for runners who go
// over plan — exactly the demographic Zonna is built for. Locking the bands
// here so future tuning doesn't silently regress the "you ran longer than the
// plan said" case.

const sessionAt = (day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun') => {
  // Pick a known weekday from a fixed reference date (2026-06-15 = Mon).
  const offsets = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 } as const
  const d = new Date('2026-06-15T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + offsets[day])
  return d
}

const activityAt = (day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun', distanceM: number, avgHr?: number) => ({
  id:                   1,
  type:                 'Run',
  sport_type:           'Run',
  start_date:           sessionAt(day).toISOString(),
  distance:             distanceM,
  moving_time:          Math.round(distanceM / 1000 * 360), // ~6:00/km
  elapsed_time:         Math.round(distanceM / 1000 * 360),
  total_elevation_gain: 0,
  average_heartrate:    avgHr,
  max_heartrate:        avgHr ? avgHr + 15 : undefined,
  average_speed:        2.78,
  name:                 'Test run',
}) as any

describe('findMatchCandidates — distance band (Zonna over-trainer)', () => {
  it('33% over plan on the right day at easy HR auto-links (the recurring incident)', () => {
    // 9.3 km run vs 7 km plan, Tuesday/Tuesday, HR < 155.
    // Score: same day (+40) + distance match (+30, ratio 1.33 within band) +
    // effort match (+10) = 80 → 'high'. autoSelectMatch returns the activity.
    const session = { distance_km: 7, type: 'easy' } as any
    const activity = activityAt('Tue', 9300, 142)
    const cands = findMatchCandidates(session, sessionAt('Tue'), [activity])
    expect(cands[0]?.confidence).toBe('high')
    expect(autoSelectMatch(cands)).toBe(activity)
  })

  it('25% under plan on the right day still matches on distance', () => {
    // 5.25 km vs 7 km — ratio 0.75, lower edge of new band.
    const session = { distance_km: 7, type: 'easy' } as any
    const activity = activityAt('Tue', 5250, 142)
    const cands = findMatchCandidates(session, sessionAt('Tue'), [activity])
    expect(cands[0]?.reasons).toContain('distance match')
  })

  it('way over plan (60% over) does NOT score distance', () => {
    // 11.2 km vs 7 km — ratio 1.60, above 1.40 cap. Plausibly a substituted
    // long run; the matcher refuses to silently claim it as Tuesday's easy.
    const session = { distance_km: 7, type: 'easy' } as any
    const activity = activityAt('Tue', 11200, 150)
    const cands = findMatchCandidates(session, sessionAt('Tue'), [activity])
    expect(cands[0]?.reasons ?? []).not.toContain('distance match')
  })

  it('right distance, wrong weekday stays sub-high and is not auto-linked', () => {
    // Tuesday activity (9 km) vs Thursday's 9 km session — within the ±2-day
    // window so it's scored, but: score = 0 (no day bonus) + 30 (distance) +
    // 0 (no effort match, no HR + session not easy/recovery) = 30 → 'low'.
    // autoSelectMatch returns null. The user is still shown it in the picker.
    const session = { distance_km: 9, type: 'long' } as any
    const activity = activityAt('Tue', 9000) // no HR → no effort bonus
    const cands = findMatchCandidates(session, sessionAt('Thu'), [activity])
    expect(autoSelectMatch(cands)).toBeNull()
  })
})
