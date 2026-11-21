// STRAVA-SOR-REVIEW-FIX-01 — the three routes, driven end to end against a recording database.
//   link-activity: a Strava id already on an Apple Health row is that run (finding 3), not a discard.
//   webhook:       an update or redelivery for an attached activity records no discard (finding 5).
//   health ingest: a NEW Apple Health row looks up its Strava twin; a re-sync does not (finding 2).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Resolver } from './__fixtures__/fakeDb'

const S = {
  resolve: (() => ({})) as Resolver,
  db: null as ReturnType<typeof fakeDb> | null,
  ops: [] as { kind: string; detail: Record<string, unknown> }[],
  waits: [] as Promise<unknown>[],
  analyse: [] as unknown[],
  stravaCalls: 0,
  backfill: [] as unknown[][],
}
const newDb = () => (S.db = fakeDb(q => S.resolve(q)))

vi.mock('@supabase/supabase-js', () => ({ createClient: () => newDb() }))
vi.mock('@/lib/supabase/getUserFromRequest', () => ({ getUserFromRequest: async () => ({ id: 'u1' }) }))
vi.mock('@/lib/trial', () => ({ getUserTier: async () => 'paid' }))
vi.mock('@/lib/ops/recordOpsEvent', () => ({ recordOpsEvent: async (kind: string, detail: Record<string, unknown>) => { S.ops.push({ kind, detail }) } }))
vi.mock('@vercel/functions', () => ({ waitUntil: (p: Promise<unknown>) => { S.waits.push(p) } }))
vi.mock('@/lib/coaching/autoAnalyse', () => ({
  getInternalBaseUrl: () => 'https://internal.test',
  autoMatchAndAnalyse: async () => undefined,
  noteRunUnmatched: async () => undefined,
}))
vi.mock('@/lib/strava', async (orig) => ({
  ...(await orig<typeof import('@/lib/strava')>()),
  getStravaToken: async () => { S.stravaCalls++; return { access_token: 't', expires_at: 0 } },
  fetchStravaActivity: async (_t: string, id: number) => { S.stravaCalls++; return { status: 200, activity: { id, type: 'Run', start_date: '2026-11-20T07:00:00Z', distance: 10_000 } } },
  fetchHRStreamSummary: async () => null,
  getUserHRZones: async () => ({ zone2Ceiling: 150, maxHR: 190, restingHR: 50 }),
}))
vi.mock('@/lib/strava/stravaSor', async (orig) => ({
  ...(await orig<typeof import('@/lib/strava/stravaSor')>()),
  enrichNewHealthKitRowFromStrava: async (...a: unknown[]) => { S.backfill.push(a); return 'no_strava' },
}))

const realFetch = globalThis.fetch
beforeEach(() => {
  S.ops = []; S.waits = []; S.analyse = []; S.stravaCalls = 0; S.backfill = []
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    if (String(url).includes('/api/analyse-run')) S.analyse.push(JSON.parse(String(init.body)))
    // A raw Strava detail fetch (the pre-fix routes made one) answers like `fetchStravaActivity`, so a falsification
    // against the old code reaches the same branch rather than stopping at "not a run".
    const m = String(url).match(/strava\.com\/api\/v3\/activities\/(\d+)$/)
    if (m) { S.stravaCalls++; return new Response(JSON.stringify({ id: Number(m[1]), type: 'Run', start_date: '2026-11-20T07:00:00Z', distance: 10_000 }), { status: 200 }) }
    return new Response('{}', { status: 200 })
  }) as typeof fetch
  return () => { globalThis.fetch = realFetch }
})

async function call(path: string, mod: { POST: (r: never) => Promise<Response> }, body: unknown) {
  const { NextRequest } = await import('next/server')
  const res = await mod.POST(new NextRequest(`https://www.zonna.run${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' }, body: JSON.stringify(body),
  }) as never)
  await Promise.all(S.waits)
  return res
}

/** Which strava_activities read is this? The by-id lookup filters on strava_activity_id; the merge's window does not. */
const byStravaId = (q: Parameters<Resolver>[0]) => q.table === 'strava_activities' && q.op === 'select' && 'strava_activity_id' in q.filters

describe('link-activity (finding 3)', () => {
  it('🔴 a Strava id already on an Apple Health row takes the HealthKit path: analysed, no Strava call, no discard', async () => {
    S.resolve = q => byStravaId(q) ? { data: [{ source: 'apple_health', apple_health_uuid: 'HK-1' }] } : { data: [] }
    const res = await call('/api/strava/link-activity', await import('@/app/api/strava/link-activity/route'), { strava_activity_id: 42, week_n: 3, session_day: 'tue' })
    expect(res.status).toBe(200)
    expect((await res.json()).mode).toBe('healthkit')
    expect(S.analyse).toEqual([{ apple_health_uuid: 'HK-1', week_n: 3, session_day: 'tue' }])
    expect(S.stravaCalls).toBe(0)
    expect(S.ops.map(o => o.kind)).not.toContain('strava_activity_discarded')
  })
  it('🔴 an enriched link is analysed on its Apple Health row (it used to return before any analysis)', async () => {
    S.resolve = q => {
      if (q.table === 'user_settings') return { data: { strava_refresh_token: 'rt' } }
      if (byStravaId(q)) return { data: [] }
      if (q.table === 'strava_activities' && q.op === 'select') return { data: [{ id: 'r1', apple_health_uuid: 'HK-2', start_date: '2026-11-20T07:02:00Z', distance_m: 10_050, strava_activity_id: null }] }
      return {}
    }
    const res = await call('/api/strava/link-activity', await import('@/app/api/strava/link-activity/route'), { strava_activity_id: 43, week_n: 3, session_day: 'tue' })
    expect((await res.json()).mode).toBe('enriched_healthkit')
    expect(S.analyse).toEqual([{ apple_health_uuid: 'HK-2', week_n: 3, session_day: 'tue' }])
  })
  it('no Apple Health run anywhere: 409 discarded, recorded, nothing analysed', async () => {
    S.resolve = q => (q.table === 'user_settings' ? { data: { strava_refresh_token: 'rt' } } : { data: [] })
    const res = await call('/api/strava/link-activity', await import('@/app/api/strava/link-activity/route'), { strava_activity_id: 44, week_n: 3, session_day: 'tue' })
    expect(res.status).toBe(409)
    expect((await res.json()).mode).toBe('discarded_no_healthkit_match')
    expect(S.ops.map(o => o.kind)).toEqual(['strava_activity_discarded'])
    expect(S.analyse).toEqual([])
  })
})

describe('Strava webhook (finding 5)', () => {
  const event = { object_type: 'activity', aspect_type: 'update', object_id: 42, owner_id: 7, subscription_id: 1, event_time: 0 }
  const resolver = (attached: boolean): Resolver => q => {
    if (q.table === 'user_settings') return { data: q.cols === 'id' ? { id: 'u1' } : { strava_refresh_token: 'rt' } }
    if (byStravaId(q)) return { data: attached ? [{ source: 'apple_health', apple_health_uuid: 'HK-1' }] : [] }
    return { data: [] }
  }
  it('🔴 an update for an activity already patched onto a row records no discard', async () => {
    S.resolve = resolver(true)
    await call('/api/webhooks/strava', await import('@/app/api/webhooks/strava/route'), event)
    expect(S.ops.map(o => o.kind)).toEqual(['strava_webhook_received'])
  })
  it('an activity with no row at all is still recorded as discarded', async () => {
    S.resolve = resolver(false)
    await call('/api/webhooks/strava', await import('@/app/api/webhooks/strava/route'), { ...event, aspect_type: 'create' })
    expect(S.ops.map(o => o.kind)).toEqual(['strava_webhook_received', 'strava_activity_discarded'])
  })
})

describe('health ingest (finding 2)', () => {
  const workout = { uuid: 'HK-NEW', startDate: '2026-11-20T07:00:00Z', durationSeconds: 3000, totalDistanceMeters: 10_000, workoutType: 'running' }
  const resolver = (existing: boolean): Resolver => q => {
    if (q.table === 'strava_activities' && q.op === 'select' && q.filters.apple_health_uuid === 'HK-NEW')
      return { data: existing ? { id: 'r1', avg_hr: 140, hr_present_at_first_query: true } : null }
    return { data: [] }
  }
  it('🔴 a NEW Apple Health row looks up its Strava twin, in the background', async () => {
    S.resolve = resolver(false)
    const res = await call('/api/health/ingest', await import('@/app/api/health/ingest/route'), workout)
    expect(res.status).toBe(200)
    expect(S.backfill).toEqual([[expect.anything(), 'u1', '2026-11-20T07:00:00Z']])
  })
  it('a re-sync of a row that already exists does not', async () => {
    S.resolve = resolver(true)
    await call('/api/health/ingest', await import('@/app/api/health/ingest/route'), workout)
    expect(S.backfill).toEqual([])
  })
})
