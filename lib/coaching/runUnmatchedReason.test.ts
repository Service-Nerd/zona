import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * ACT-RUNREAD-REACH-01 — a run that produced no read must say WHICH wall it hit.
 *
 * ⚠️ BEHAVIOURAL, through the real `autoMatchAndAnalyse`. The four reasons it can see are
 * reached by driving real plan fixtures through the real matcher, not by reading the source —
 * a source assertion passes on a comment, and this file's whole subject is four `return`
 * statements that used to be silent.
 *
 * 📐 The reconstruction these reasons are meant to replace, measured 2026-11-11 over 377 run
 * activities from 22 metric users, judged against the plan version LIVE AT THE TIME:
 * no plan 200 (53.1%) · outside plan weeks 99 (26.3%) · no session that weekday 25 (6.6%) ·
 * a session was there and still nothing 42 (11.1%) · has an analysis 12 (3.2%).
 */

const recorded: Array<{ kind: string; detail: Record<string, unknown>; userId: string | null }> = []
vi.mock('@/lib/ops/recordOpsEvent', () => ({
  recordOpsEvent: async (kind: string, detail: Record<string, unknown>, userId: string | null) => {
    recorded.push({ kind, detail, userId })
  },
}))

/**
 * 🔴 THE WINNING-CLAIM ARMS REACH THE LINK-TIME PUSH, AND THE PUSH BUILDS A REAL SUPABASE CLIENT.
 * Caught by the FULL suite, not by running this file: `notifyUser` throws
 * `supabaseUrl is required` under `environment: 'node'` with no env, and it throws from a
 * `void`-ed call inside `autoMatchAndAnalyse`, so it surfaces as an unhandled error AFTER the
 * test has already passed. 854 files green, 3 errors — the kind of green that is not green.
 *
 * ⚠️ And I only saw it because the full run prints `Errors 3`; the single-file runs I had been
 * grepping for `Tests |FAIL` were hiding it. Do not pipe away your own instrumentation.
 *
 * The send path's own behaviour is covered by `runJourneyTelemetry.test.ts`, which mocks the
 * client deliberately. Here it is out of scope and is stubbed to nothing.
 */
vi.mock('@/lib/webpush', () => ({ notifyUser: async () => {} }))
vi.mock('@/lib/notifications', () => ({ recordNotification: async () => {} }))

import { autoMatchAndAnalyse, RUN_UNMATCHED_REASONS } from './autoAnalyse'

/**
 * A chainable PostgREST stub. A Proxy returns itself for ANY builder method, so the test does
 * not have to enumerate `.neq`, `.is`, `.update`… one failure at a time — and a new filter in
 * the code under test cannot turn this red for a reason that has nothing to do with the subject.
 * Only the terminals resolve.
 */
function supabaseWith(tables: Record<string, unknown>, claimWon = false) {
  const make = (name: string) => {
    const result = { data: tables[name] ?? null, error: null }
    const target: Record<string, unknown> = {
      maybeSingle: async () => result,
      single:      async () => result,
      then:        (res: (v: unknown) => unknown) => Promise.resolve(result).then(res),
    }
    const proxy: unknown = new Proxy(target, {
      get(t, prop) {
        if (prop in t) return (t as Record<string | symbol, unknown>)[prop]
        return () => proxy
      },
    })
    return proxy
  }
  return {
    from: (t: string) => make(t),
    // `claimAutoLink` elects the single winner through an RPC. `false` is "someone else won",
    // which falls through to the attach path and ends at 'exists' — the no-op answer, and what
    // every arm above wants. `claimWon` makes this invocation the WINNER, which is the only
    // state that reaches the link-time push and the `run_linked` record.
    rpc: async () => ({ data: claimWon, error: null }),
  }
}

const RUN = {
  id: 'uuid-1',
  type: 'Run', sport_type: 'Run',
  start_date: '2026-10-06T07:00:00.000Z',   // a Tuesday
  distance: 8000, moving_time: 2400, elapsed_time: 2400, total_elevation_gain: 0,
  average_heartrate: 140,
}
const REF = { source: 'apple_health' as const, appleHealthUuid: 'uuid-1' }

const week = (date: string, sessions: Record<string, unknown>) =>
  ({ n: 1, date, sessions, label: 'W1', phase: 'base', type: 'build', weekly_km: 30 })

const planWith = (...weeks: unknown[]) => ({ plan_json: { weeks, meta: {}, phases: [] } })

const run = (tables: Record<string, unknown>, activity = RUN, claimWon = false) =>
  autoMatchAndAnalyse(supabaseWith(tables, claimWon), 'user-1', activity as never, REF, 'http://localhost:3000')

beforeEach(() => { recorded.length = 0 })

describe('ACT-RUNREAD-REACH-01 — the vocabulary', () => {
  it('names every wall, including the one outside this module', () => {
    expect(Object.keys(RUN_UNMATCHED_REASONS).sort()).toEqual(
      ['below_threshold', 'no_plan', 'outside_plan_weeks', 'plan_read_failed', 'tier_gated',
       'week_has_no_sessions'])
  })

  it('every reason carries a real explanation, not a restated name', () => {
    for (const [k, v] of Object.entries(RUN_UNMATCHED_REASONS)) {
      expect(v.length, `${k} has no explanation`).toBeGreaterThan(30)
    }
  })
})

describe('ACT-RUNREAD-REACH-01 — each wall records itself', () => {
  it('no_plan: the runner had no plan when the run arrived', async () => {
    await run({ plans: null })
    expect(recorded).toHaveLength(1)
    expect(recorded[0].kind).toBe('run_unmatched')
    expect(recorded[0].detail).toMatchObject({ reason: 'no_plan', source: 'apple_health' })
    expect(recorded[0].userId).toBe('user-1')
  })

  it('outside_plan_weeks: the plan exists and its calendar does not reach the run', async () => {
    // The run is 2026-10-06; this plan starts five weeks later.
    await run({ plans: planWith(week('2026-11-09', { tue: { type: 'easy', duration_mins: 40, primary_metric: 'duration' } })) })
    expect(recorded.map(r => r.detail.reason)).toEqual(['outside_plan_weeks'])
  })

  it('week_has_no_sessions: the week the run resolved to is empty', async () => {
    // ⚠️ NOT "no session that weekday" — `plannedSessionsForMatch` returns EVERY session of the
    // week, so this return fires only when the week carries none at all. The first name was
    // wrong and the test is what proved it: a Tuesday run against a Thursday-only week reported
    // `below_threshold`, not this.
    await run({ plans: planWith(week('2026-10-05', {})) })
    expect(recorded.map(r => r.detail.reason)).toEqual(['week_has_no_sessions'])
    expect(recorded[0].detail).toMatchObject({ week_n: 1 })
  })

  it('below_threshold: a session was there and nothing reached the auto-link score', async () => {
    // Same weekday (40 pts) but a 3 km distance-primary session against an 8 km run
    // (ratio 2.67, outside the 0.75–1.40 band) and `quality` earns no effort points.
    await run({ plans: planWith(week('2026-10-05', { tue: { type: 'quality', distance_km: 3, primary_metric: 'distance' } })) })
    expect(recorded.map(r => r.detail.reason)).toEqual(['below_threshold'])
    expect(recorded[0].detail).toMatchObject({ week_n: 1, candidates: 1 })
  })

  it('carries the ACTIVITY ID, because one row is recorded per ingest ATTEMPT', async () => {
    // `clientSync` re-posts recent workouts on every sweep, so `count(*)` over these rows would
    // report sweeps rather than runs. The funnel counts DISTINCT activity_id.
    await run({ plans: null })
    expect(recorded[0].detail.activity_id).toBe('uuid-1')
  })

  it('plan_read_failed: a database failure is NOT "the runner had no plan"', async () => {
    // `readPlanJson` returns `{ plan: null, error }` for both, and `no_plan` is the 53.1%
    // bucket — folding our own outages into it would pad the largest reason unrecoverably.
    const s = supabaseWith({})
    const failing = {
      ...s,
      from: (t: string) => t === 'plans'
        ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'connection reset' } }) }) }) }
        : s.from(t),
    }
    await autoMatchAndAnalyse(failing as never, 'user-1', RUN as never, REF, 'http://localhost:3000')
    expect(recorded.map(r => r.detail.reason)).toEqual(['plan_read_failed'])
    expect(String(recorded[0].detail.message)).toContain('connection reset')
  })

  it('a run AFTER the plan ends, pinned to an empty final week, is outside_plan_weeks', async () => {
    // `getWeekIndexForDate` pins a post-plan run to the last week. If that week is empty, calling
    // it `week_has_no_sessions` blames the plan's shape for a run that was never in the plan.
    await run({ plans: planWith(week('2026-08-31', {})) })   // run is 2026-10-06, weeks before
    expect(recorded.map(r => r.detail.reason)).toEqual(['outside_plan_weeks'])
    expect(recorded[0].detail).toMatchObject({ within_week: false })
  })

  it('records the DATE and not the time', async () => {
    await run({ plans: null })
    expect(recorded[0].detail.activity_date).toBe('2026-10-06')
  })

  it('a WALK records nothing — a non-run is not a run that failed to be read', async () => {
    await run({ plans: null }, { ...RUN, type: 'Walk', sport_type: 'Walk' })
    expect(recorded).toHaveLength(0)
  })

  it('a MATCHED run records no WALL', async () => {
    // Same weekday + duration inside ±15% + easy with HR < 155 = 80 points.
    await run({
      plans: planWith(week('2026-10-05', { tue: { type: 'easy', duration_mins: 40, primary_metric: 'duration' } })),
      session_overrides: [], session_completions: [],
    })
    expect(recorded.filter(r => r.kind === 'run_unmatched')).toHaveLength(0)
  })
})

/**
 * STEP4-RUNS-NO-COMPLETIONS-01 (2026-11-25) — and the other side of the same question.
 *
 * 🔴 WHY IT IS HERE AND NOT IN A NEW FILE. This harness already drives the real
 * `autoMatchAndAnalyse` over real plan fixtures, which is the whole reason the reasons above are
 * trustworthy. A second harness for the success case would be a second definition of "what a
 * matched run looks like", and the two would drift — the duplication class this repo has
 * recorded under five names.
 *
 * 📐 The gap this closes, measured on production the day it shipped: `run_unmatched` had logged
 * 39 distinct unlinked runs over 14 days and NOTHING had ever logged a link, so the rate could
 * only be derived from table counts (27 of 176 live completions carry a run link, 15.3%).
 */
describe('STEP4-RUNS-NO-COMPLETIONS-01 — a LINKED run records itself', () => {
  const MATCHING = {
    plans: planWith(week('2026-10-05', { tue: { type: 'easy', duration_mins: 40, primary_metric: 'duration' } })),
    session_overrides: [], session_completions: [],
  }

  it('🔴 the winner records run_linked, with the day it landed on', async () => {
    await run(MATCHING, RUN, true)
    const ev = recorded.find(r => r.kind === 'run_linked')
    expect(ev, 'a run was auto-linked and nothing recorded it — the funnel has no denominator').toBeTruthy()
    expect(ev!.detail).toMatchObject({
      source: 'apple_health', activity_id: 'uuid-1', week_n: 1, session_day: 'tue', claim: 'won',
    })
    expect(ev!.userId).toBe('user-1')
  })

  it('records the DATE and not the time, exactly as the unmatched side does', async () => {
    await run(MATCHING, RUN, true)
    expect(recorded.find(r => r.kind === 'run_linked')!.detail.activity_date).toBe('2026-10-06')
  })

  it('a linked run records NO wall, and an unlinked one records no link', async () => {
    // The two sides must be mutually exclusive, or a rate computed from them double-counts.
    await run(MATCHING, RUN, true)
    expect(recorded.filter(r => r.kind === 'run_unmatched')).toHaveLength(0)
    recorded.length = 0
    await run({ plans: null })
    expect(recorded.filter(r => r.kind === 'run_linked')).toHaveLength(0)
    expect(recorded.filter(r => r.kind === 'run_unmatched')).toHaveLength(1)
  })

  it('a LOSING concurrent claim records nothing — it did not do the linking', async () => {
    // `claimAutoLink` returning 'exists' means another ingest of the same run won. Recording it
    // would count one run twice, and `clientSync` re-posts every sweep (46 attempts per run,
    // measured), so that is not a rare case.
    await run(MATCHING, RUN, false)
    expect(recorded.filter(r => r.kind === 'run_linked')).toHaveLength(0)
  })
})

describe('ACT-RUNREAD-REACH-01 — the fifth wall lives at the caller', () => {
  // ⚠️ Source-shaped and declared as such: the route needs auth, a tier lookup and a
  // service-role client. What it asserts is the SHAPE that was missing — the `else` of the
  // tier gate — not a comment.
  const route = readFileSync('app/api/health/ingest/route.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

  it('records tier_gated when the free-tier gate skips the matcher', () => {
    expect(route).toMatch(/else\s+await\s+noteRunUnmatched\(userId,\s*'tier_gated'/)
  })

  it('still gates the analysis itself — the reason must not become a bypass', () => {
    expect(route).toMatch(/if\s*\(canAnalyse\)\s*waitUntil\(/)
  })
})
