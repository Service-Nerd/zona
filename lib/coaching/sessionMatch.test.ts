import { describe, it, expect } from 'vitest'
import { findMatchCandidates, autoSelectMatch, isInLinkPool, rankLinkCandidates } from './sessionMatch'

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

// ── MATCH-LIST-WINDOW-01 — the BROWSE pool and the RANKING are different questions ──
//
// Filed as "the candidate list has no date filter". It HAD one: a hand-rolled
// -5/+0-day test inside SessionPopupInner with no distance component, running
// parallel to findMatchCandidates above. A second answer, which is harder to see
// than a missing one and worse (TIER-OWNER-01's class).
//
// These arms are keyed to the founder's own capture, because a test written from
// an invented case would not have caught it: a 20 Sep / 14 km run offered for a
// Fri 25 Sep / 8 km easy session. 25 Sep - 5 = 20 Sep, EXACTLY the boundary.
describe('MATCH-LIST-WINDOW-01 — link pool and ranking', () => {
  const SESSION_DAY = new Date('2026-09-25T00:00:00Z')   // Friday
  const NOW         = new Date('2026-09-26T09:00:00Z')
  const act = (id: number, iso: string, distanceM: number) => ({
    id, type: 'Run', sport_type: 'Run', start_date: iso,
    distance: distanceM, moving_time: Math.round(distanceM / 1000 * 360),
    elapsed_time: Math.round(distanceM / 1000 * 360), total_elevation_gain: 0,
    average_speed: 2.78, name: `run-${id}`,
  }) as never

  const easy8k = { type: 'easy', distance_km: 8, primary_metric: 'distance', label: 'Easy run' } as never

  // The founder's case, and a run that genuinely IS the session.
  const sept20_14k = act(20, '2026-09-20T07:00:00Z', 14_000)
  const sept25_8k  = act(25, '2026-09-25T07:00:00Z',  8_200)

  it('keeps the wide browse window — the 5-day-old run is still POOL-ELIGIBLE', () => {
    // ⚠️ This is the arm that stops the "fix" being a capability loss. A runner
    // does a Tuesday session on Saturday; narrowing the pool to the matcher's
    // +/-2 days would stop them linking it at all, which is a Design Board
    // question and not a defect fix.
    expect(isInLinkPool(new Date('2026-09-20T07:00:00Z'), SESSION_DAY, NOW)).toBe(true)
    expect(isInLinkPool(new Date('2026-09-19T07:00:00Z'), SESSION_DAY, NOW)).toBe(false) // 6 days — out
    expect(isInLinkPool(new Date('2026-09-26T07:00:00Z'), SESSION_DAY, NOW)).toBe(false) // after session day
  })

  it('a FUTURE session looks back from NOW, not from the session', () => {
    const future = new Date('2026-10-10T00:00:00Z')
    expect(isInLinkPool(new Date('2026-09-24T07:00:00Z'), future, NOW)).toBe(true)  // 2 days before now
    expect(isInLinkPool(new Date('2026-09-18T07:00:00Z'), future, NOW)).toBe(false) // 8 days before now
  })

  it('no session date falls back to the last 5 days from NOW', () => {
    expect(isInLinkPool(new Date('2026-09-23T07:00:00Z'), null, NOW)).toBe(true)
    expect(isInLinkPool(new Date('2026-09-15T07:00:00Z'), null, NOW)).toBe(false)
  })

  it('🔴 THE FOUNDER\'S CASE: the 20 Sep / 14 km run is NOT first for a Fri 25 Sep / 8 km session', () => {
    // Deliberately seeded in the order the OLD code produced (recency first),
    // so a revert to recency makes this arm go red rather than coincidentally pass.
    const ranked = rankLinkCandidates(easy8k, SESSION_DAY, [sept20_14k, sept25_8k])
    expect((ranked[0] as { id: number }).id).toBe(25)
    expect((ranked[1] as { id: number }).id).toBe(20)
  })

  it('ranking does not DROP anything — pool membership is unchanged', () => {
    // The fix RANKS, it does not FILTER. Same length, same ids, any order.
    const pool = [sept20_14k, sept25_8k, act(21, '2026-09-21T07:00:00Z', 30_000)]
    const ranked = rankLinkCandidates(easy8k, SESSION_DAY, pool)
    expect(ranked).toHaveLength(pool.length)
    expect(new Set(ranked.map(r => (r as { id: number }).id))).toEqual(new Set([20, 25, 21]))
  })

  it('returns the pool untouched when there is no session date to rank against', () => {
    const pool = [sept20_14k, sept25_8k]
    expect(rankLinkCandidates(easy8k, null, pool)).toEqual(pool)
  })
})
