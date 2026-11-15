import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
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

/**
 * 🔴 `ACT-REPORTED-DISTANCE-DOOR-01` — THE ZERO-DISTANCE RUN REACHES THE LINK ANYWAY.
 *
 * Measured in production 2026-11-15: **88 of 501 Apple Health activities (5 users) arrive with
 * `distance_m` = 0, every one `activity_type: 'Run'`, 31.3 min on average**, and **0 distances
 * have ever been typed in** through `AddDistanceSheet`.
 *
 * The item was filed on the theory that the distance door is unreachable for exactly these runs:
 * both render sites (`SessionPopupInner`'s `canAddDistance`, the post-run screen's
 * `canAddPostRunDistance`) require a run ALREADY LINKED, and such a run *"can never reach 70
 * points — 40 for the weekday plus at most 10 for effort"*.
 *
 * ⚠️ **THAT ARITHMETIC IS RIGHT FOR A DISTANCE-PRIMARY SESSION AND THE LIVE POPULATION IS NOT
 * ONE.** The item's own pre-filing measurement says so — *"0 of the 87 land on a distance-primary
 * planned day; all five planned-day cases are duration-primary, where `distance_km` is null and
 * the distance band never applies at all"*. On a duration-primary day the **duration** band
 * scores instead, so the same run reaches **70 on the weekday and the duration alone** and
 * `autoAnalyse` SILENTLY AUTO-LINKS it (`MIN_AUTO_LINK_CONFIDENCE = 'high'`). No tap, and the
 * door is open.
 *
 * 🔴 **MY FIRST VERSION OF THIS BLOCK TESTED ONLY THE DISTANCE-PRIMARY SHAPE — the branch the
 * item itself calls empty.** Four arms, all green, all describing a cohort of zero
 * (`/code-review`). Both shapes are pinned now, with the live one first.
 */
describe('ACT-REPORTED-DISTANCE-DOOR-01 — a zero-distance run can still be linked', () => {
  /** A 31-minute run the watch never measured. `activityAt` derives `moving_time` from
   *  distance, which is 0 here, so the duration has to be put back explicitly. */
  const zeroDistanceRun = (day: 'Mon' | 'Tue' | 'Wed', mins: number, avgHr?: number) => ({
    ...activityAt(day, 0, avgHr),
    moving_time: mins * 60,
    elapsed_time: mins * 60,
    // ⚠️ `activityAt` hardcodes `average_speed: 2.78`, which is not a product value for a run
    // with no distance. The device reports no speed either when it reports no distance.
    average_speed: undefined,
  })

  // ── The LIVE population: duration-primary. 5 of 5 planned-day cases. ──
  const durationPrimary = { distance_km: null, duration_mins: 30, primary_metric: 'duration', type: 'easy' } as any

  it('🔴 THE LIVE SHAPE: on a duration-primary day it reaches HIGH and is AUTO-LINKED, no tap', () => {
    // same day (+40) + duration match (+30, 31 vs 30 min is inside the 15% band) = 70 = high,
    // and `autoSelectMatch` auto-links at high — so the door opens with no user action at all.
    const cands = findMatchCandidates(durationPrimary, sessionAt('Tue'), [zeroDistanceRun('Tue', 31)])
    expect(cands[0]?.confidence).toBe('high')
    expect(cands[0]?.reasons).toEqual(expect.arrayContaining(['same day', 'duration match']))
    expect(cands[0]?.reasons, 'the distance band must not score — there is no distance')
      .not.toContain('distance match')
    expect(autoSelectMatch(cands), 'auto-linked silently at high').toBe(cands[0]?.activity)
  })

  it('the duration band is what carries it, so a run OUTSIDE that band drops to medium', () => {
    // 45 min against a 30 min plan is ratio 1.5, outside 0.85–1.15: +40 weekday, +10 effort = 50.
    // Still OFFERED (medium), just not auto-linked. This is the arm that proves the high above
    // comes from the duration match rather than from the weekday alone.
    const cands = findMatchCandidates(durationPrimary, sessionAt('Tue'), [zeroDistanceRun('Tue', 45, 142)])
    expect(cands[0]?.confidence).toBe('medium')
    expect(cands[0]?.reasons).not.toContain('duration match')
    expect(autoSelectMatch(cands), 'medium is never auto-linked').toBeNull()
  })

  // ── The shape the item reasoned about: distance-primary. 0 of 88 live. ──
  const distancePrimary = { distance_km: 8, primary_metric: 'distance', type: 'easy' } as any

  it('on a distance-primary day it reaches MEDIUM, so a link CTA is still offered', () => {
    // 70 is the HIGH threshold; 40 is MEDIUM, and `resolveAutoMatch` surfaces medium too
    // (`AUTO-MATCH-02` — "Looks like this one?", same handler). This is the cohort of zero.
    const cands = findMatchCandidates(distancePrimary, sessionAt('Tue'), [zeroDistanceRun('Tue', 31, 142)])
    expect(cands[0]?.confidence).toBe('medium')
    expect(cands[0]?.reasons).not.toContain('distance match')
  })

  it('— and MEDIUM with no HR at all: the weekday alone is 40', () => {
    const cands = findMatchCandidates(distancePrimary, sessionAt('Tue'), [zeroDistanceRun('Tue', 31)])
    expect(cands[0]?.confidence).toBe('medium')
  })

  it('the SAME 31-minute run WITH a measured distance reaches HIGH — one axis moved', () => {
    // The control. ⚠️ It varies DISTANCE ONLY: `activityAt` would derive a 48.6-min duration
    // from 8.1 km, so the duration is pinned to the subject's 31 min. Without that this
    // compares two different runs and proves nothing about the distance band.
    const measured = { ...activityAt('Tue', 8100, 142), moving_time: 31 * 60, elapsed_time: 31 * 60 }
    const cands = findMatchCandidates(distancePrimary, sessionAt('Tue'), [measured])
    expect(cands[0]?.confidence).toBe('high')
    expect(cands[0]?.reasons).toContain('distance match')
  })

  it('🔴 and NEITHER picker site filters on distance', () => {
    // Two routes to the link, and this is the one with no scoring in it at all.
    const zero = zeroDistanceRun('Tue', 31, 142)
    expect(isInLinkPool(new Date(zero.start_date), sessionAt('Tue')), 'in the browse window').toBe(true)
    expect(rankLinkCandidates(distancePrimary, sessionAt('Tue'), [zero] as any), 'ranked, not dropped')
      .toHaveLength(1)

    // ⚠️ `rankLinkCandidates` IS ONLY HALF THE PICKER. The pool is narrowed in
    // `SessionPopupInner` before ranking, and that filter is inline in the component — which a
    // node-environment test cannot mount. So this arm is bounded and source-level: it asserts
    // the component's filter predicate still tests only claimed ids, because adding a
    // `distance > 0` clause there would reopen the trap with every arm above still green
    // (`/code-review` found exactly that hole in the first version of this block).
    const src = readFileSync(
      new URL('../../components/dashboard/SessionPopupInner.tsx', import.meta.url), 'utf8')
    const i = src.indexOf('inLinkWindow.filter(')
    expect(i, 'the picker filter moved — re-point this arm').toBeGreaterThan(-1)
    const predicate = src.slice(i, src.indexOf('}) as StravaActivity[]', i))
    expect(predicate, 'the picker must not filter on distance').not.toMatch(/distance/)
  })
})
