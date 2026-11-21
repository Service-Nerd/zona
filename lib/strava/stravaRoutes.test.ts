// STRAVA-SOR-REVIEW-FIX-03 — the routes this fix touches, driven end to end against a recording database.
//   link-activity:   a Strava activity with no Apple Health run is refused 409 and nothing is analysed (round-1 behaviour).
//   webhook:         an update or redelivery for an attached activity records no discard.
//   unlink-activity: `only_if_strava_activity_id` clears only while the completion still carries that id.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Resolver } from './__fixtures__/fakeDb'

const S = {
  resolve: (() => ({})) as Resolver,
  db: null as ReturnType<typeof fakeDb> | null,
  ops: [] as { kind: string; detail: Record<string, unknown> }[],
  waits: [] as Promise<unknown>[],
  analyse: [] as unknown[],
  stravaCalls: 0,
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
  fetchHRStreamSummary: async () => null,
  getUserHRZones: async () => ({ zone2Ceiling: 150, maxHR: 190, restingHR: 50 }),
}))

const realFetch = globalThis.fetch
beforeEach(() => {
  S.ops = []; S.waits = []; S.analyse = []; S.stravaCalls = 0
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    if (String(url).includes('/api/analyse-run')) S.analyse.push(JSON.parse(String(init.body)))
    // The routes fetch Strava's activity detail directly; it answers as one 10 km run.
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

describe('link-activity, round-1 behaviour', () => {
  it('no Apple Health run anywhere: 409 discarded, recorded, nothing analysed', async () => {
    S.resolve = q => (q.table === 'user_settings' ? { data: { strava_refresh_token: 'rt' } } : { data: [] })
    const res = await call('/api/strava/link-activity', await import('@/app/api/strava/link-activity/route'), { strava_activity_id: 44, week_n: 3, session_day: 'tue' })
    expect(res.status).toBe(409)
    expect((await res.json()).mode).toBe('discarded_no_healthkit_match')
    expect(S.ops.map(o => o.kind)).toEqual(['strava_activity_discarded'])
    expect(S.analyse).toEqual([])
  })
})

describe('Strava webhook: no false discard', () => {
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

describe('unlink-activity only_if_strava_activity_id', () => {
  const route = () => import('@/app/api/strava/unlink-activity/route')
  const writes = () => (S.db?.log ?? []).filter(q => q.op !== 'select').map(q => `${q.table}:${q.op}`)
  it('🔴 the guard holds (the completion still carries the refused id): cleared, analysis removed', async () => {
    S.resolve = q => (q.table === 'session_completions' ? { data: [{ id: 'c1' }] } : {})
    const res = await call('/api/strava/unlink-activity', await route(), { week_n: 3, session_day: 'tue', only_if_strava_activity_id: 5 })
    expect(await res.json()).toEqual({ ok: true, cleared: true })
    expect(S.db!.log.find(q => q.table === 'session_completions')!.filters).toMatchObject({ strava_activity_id: 5, superseded_at: null })
    expect(writes()).toEqual(['session_completions:update', 'run_analysis:delete'])
  })
  it('🔴 a Strava id already merged onto a row is never cleared: no write at all', async () => {
    S.resolve = q => (q.table === 'strava_activities' ? { data: [{ id: 'hk1' }] } : q.table === 'session_completions' ? { data: [{ id: 'c1' }] } : {})
    const res = await call('/api/strava/unlink-activity', await route(), { week_n: 3, session_day: 'tue', only_if_strava_activity_id: 5 })
    expect(await res.json()).toEqual({ ok: true, cleared: false, reason: 'attached' })
    expect(writes()).toEqual([])
    expect(S.db!.log.find(q => q.table === 'strava_activities')!.filters).toEqual({ user_id: 'u1', strava_activity_id: 5 })
  })
  it('🔴 the guard fails (the runner re-linked meanwhile): nothing else is touched', async () => {
    S.resolve = q => (q.table === 'session_completions' ? { data: [] } : {})
    const res = await call('/api/strava/unlink-activity', await route(), { week_n: 3, session_day: 'tue', only_if_strava_activity_id: 5 })
    expect(await res.json()).toEqual({ ok: true, cleared: false })
    expect(writes()).toEqual(['session_completions:update'])
  })
  it('without the guard it clears unconditionally, as before', async () => {
    S.resolve = q => (q.table === 'session_completions' ? { data: [{ id: 'c1' }] } : {})
    await call('/api/strava/unlink-activity', await route(), { week_n: 3, session_day: 'tue' })
    expect('strava_activity_id' in S.db!.log.find(q => q.table === 'session_completions')!.filters).toBe(false)
    expect(writes()).toEqual(['session_completions:update', 'run_analysis:delete'])
  })
})
