import { describe, it, expect } from 'vitest'
import { findMatchCandidates, autoSelectMatch } from './sessionMatch'
import { resolveEffectiveSessions, DAY_KEYS } from '@/lib/plan/effectiveSessions'

// AUTOLINK-OVERRIDE-BLIND-01 (2026-10-07) — the matcher must see the week the
// runner sees.
//
// THE REAL CASE, from the founder's live plan and his live row. Week 3 starts Mon
// 2026-10-05; `tue` is ABSENT (rest); the Progressive tempo sits on `wed`, 8.5 km,
// `primary_metric: 'distance'`, `type: 'quality'`. He moved it wed → tue and ran
// 9.88 km / 61 min / HR 154 on Tue 2026-10-06. It did not auto-link.
//
// ⚠️ THIS IS A COMPOSITION TEST, DELIBERATELY. `sessionMatch` was correct in
// isolation and `effectiveSessions` was correct in isolation; each had its own
// passing suite. Nothing ran the second's output through the first, which is the
// only question that mattered. Same class as SUBS-CANCELLATION-TIER-01.

const WEEK: any = {
  n: 3,
  date: '2026-10-05',
  label: 'Build — extending the work',
  sessions: {
    mon: { type: 'easy',    label: 'Easy run — Zone 2',   distance_km: 7,    duration_mins: 45, primary_metric: 'distance' },
    wed: { type: 'quality', label: 'Progressive tempo',   distance_km: 8.5,  duration_mins: 48, primary_metric: 'distance' },
    fri: { type: 'easy',    label: 'Easy run — Zone 2',   distance_km: 7,    duration_mins: 45, primary_metric: 'distance' },
    sun: { type: 'easy', role: 'long_run', label: 'Long run — Zone 2', distance_km: 12.5, duration_mins: 81, primary_metric: 'distance' },
  },
}

/** His run, in the shape `/api/health/ingest` marshals before calling the matcher. */
const RUN: any = {
  id: 'dab5d809', type: 'Run', sport_type: 'Run',
  start_date: '2026-10-06T18:07:29+00:00',
  distance: 9880, moving_time: 61 * 60, elapsed_time: 61 * 60,
  total_elevation_gain: 0, average_heartrate: 154, name: 'Run',
}

// 🔴 THIS DRIVES THE REAL `autoMatchAndAnalyse`, NOT A COPY OF ITS LOOP.
//
// The first version of this file re-implemented the loop as a local helper and
// the helper DIVERGED IMMEDIATELY: it passed every override straight to
// `resolveEffectiveSessions` where production filters `o.week_n === week.n`, so
// "an override for ANOTHER week is ignored" failed against a helper that was
// wrong rather than against the code. That is `TIER-OWNER-01`'s flaw exactly — a
// test asserting its own copy cannot catch the producer drifting.
//
// `claimAutoLink` goes through `supabase.rpc('claim_session_completion')`, so a
// fake client CAPTURES the completion row and then reports an error, which makes
// `claimAutoLink` return 'exists' and `autoMatchAndAnalyse` return before any
// push or analyse-run fetch. The captured row is the assertion target, and
// `session_day` on it is the whole question.
function fakeSupabase(plan: any, overrides: any[], captured: { row?: any }) {
  const thenable = (data: any) => {
    const b: any = {
      select: () => b, eq: () => b, is: () => b, neq: () => b, limit: () => b,
      single: async () => ({ data, error: null }),
      maybeSingle: async () => ({ data, error: null }),
      then: (res: any, rej: any) => Promise.resolve({ data, error: null }).then(res, rej),
    }
    return b
  }
  return {
    from: (table: string) =>
      table === 'plans' ? thenable({ plan_json: plan })
      : table === 'session_overrides' ? thenable(overrides)
      : thenable(null),
    rpc: async (_fn: string, args: any) => {
      captured.row = args?.p
      // Force the 'exists' branch: no push, no fetch, no network.
      return { data: null, error: { message: 'stubbed in test' } }
    },
  }
}

/** Runs the real matcher and returns the `session_day` it would write, or null. */
async function autoLinkDay(week: any, overrides: any[], activity: any): Promise<string | null> {
  const { autoMatchAndAnalyse } = await import('./autoAnalyse')
  const captured: { row?: any } = {}
  const plan = { meta: { plan_start: '2026-09-21' }, weeks: [week] }
  await autoMatchAndAnalyse(
    fakeSupabase(plan, overrides, captured) as any,
    'test-user',
    activity,
    { source: 'apple_health', appleHealthUuid: 'uuid-under-test' },
    'http://localhost:3000',
  )
  if (!captured.row) return null
  expect(captured.row.week_n).toBe(week.n)
  return captured.row.session_day as string
}

const MOVED = [{ week_n: 3, original_day: 'wed', new_day: 'tue' }]

describe('AUTOLINK-OVERRIDE-BLIND-01 — a moved session auto-links', () => {
  it('THE DEFECT, REPRODUCED: scored against plan_json, nothing reaches high', async () => {
    // No overrides applied = the old behaviour, on the real data.
    expect(await autoLinkDay(WEEK, [], RUN)).toBeNull()
  })

  it('and the ceiling is 30 of the 70 needed, so it was impossible, not unlucky', async () => {
    const wed = new Date('2026-10-07')
    const c = findMatchCandidates(WEEK.sessions.wed, wed, [RUN])
    expect(c[0].confidence).toBe('low')
    // `sameWeekday` pays 40 and is unreachable off-day; quality earns no effort
    // points; distance-primary earns no duration points. Only "distance match" (30).
    expect(c[0].reasons).toEqual(['distance match'])
  })

  it('THE FIX: with the override live it links, and to the ORIGINAL day', async () => {
    // 'wed', not 'tue' — session_completions is keyed on the defining day.
    expect(await autoLinkDay(WEEK, MOVED, RUN)).toBe('wed')
  })

  it('the Tuesday SLOT now scores high: 40 same-day + 30 distance', async () => {
    const tue = new Date('2026-10-06')
    const c = findMatchCandidates(WEEK.sessions.wed, tue, [RUN])
    expect(c[0].confidence).toBe('high')
    expect(c[0].reasons).toEqual(['same day', 'distance match'])
  })

  it('a runner with NO overrides is unaffected — the path is a no-op', async () => {
    // Same 7 km easy on its own Monday: linked before, linked after.
    const monRun = { ...RUN, start_date: '2026-10-05T18:00:00+00:00', distance: 7200, moving_time: 46 * 60 }
    expect(await autoLinkDay(WEEK, [], monRun)).toBe('mon')
    expect(await autoLinkDay(WEEK, MOVED, monRun)).toBe('mon')
  })

  it('an override for ANOTHER week is ignored', async () => {
    expect(await autoLinkDay(WEEK, [{ week_n: 9, original_day: 'wed', new_day: 'tue' }], RUN)).toBeNull()
  })

  it('it does not become promiscuous: a 3 km jog still matches nothing', async () => {
    // The 70-point threshold and the +-2-day window are untouched by this fix.
    const short = { ...RUN, distance: 3000, moving_time: 20 * 60 }
    expect(await autoLinkDay(WEEK, MOVED, short)).toBeNull()
  })

  it('the moved session is matched on its NEW date, not merely found anywhere', async () => {
    // A run two days before the new slot (Sun 4 Oct) is outside +-2 of Tue 6 Oct
    // for the tempo, and must not link to it.
    const earlier = { ...RUN, start_date: '2026-10-03T18:00:00+00:00' }
    expect(await autoLinkDay(WEEK, MOVED, earlier)).toBeNull()
  })
})
