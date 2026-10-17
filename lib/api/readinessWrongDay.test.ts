import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Plan } from '@/types/plan'
import { applyAdjustmentDays } from '@/lib/coaching/applyAdjustmentDays'

/**
 * 🔴 READINESS-WRONG-DAY-01 (2026-10-17) — a recovery ease changes TODAY, and only today.
 *
 * Three defects, one test file, each arm run against the REAL code with only I/O faked:
 *  1. The readiness route handed the engine ONE session; the engine's 7-entry guard
 *     (RESHAPE-FIX-WAVE1, 2026-06-26) threw, so every softening crashed with a 500 that
 *     the client swallowed. 0 readiness changes ever reached a runner.
 *  2. Confirm/revert wrote the stored list back BY POSITION (mon first), so a one-session
 *     row would have eased MONDAY and left today hard.
 *  3. The obvious repair (pass the whole week) eased EVERY quality session and the long run.
 */
const S = vi.hoisted(() => ({
  plan: null as unknown, samples: [] as unknown[], pending: [] as unknown[],
  inserts: [] as Record<string, unknown>[], updates: [] as unknown[], events: [] as string[],
}))
vi.mock('@/lib/supabase/getUserFromRequest', () => ({ getUserFromRequest: async () => ({ id: 'u1' }) }))
vi.mock('@/lib/trial', () => ({ getUserTier: async () => 'paid' }))
vi.mock('@/lib/ops/recordOpsEvent', () => ({ recordOpsEvent: async (k: string) => { S.events.push(k) } }))
vi.mock('@/lib/supabase/userScopedClient', () => ({
  createUserScopedClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {}
      const chain = () => q
      Object.assign(q, {
        select: chain, eq: chain, is: chain, gte: chain, order: chain, contains: chain, in: chain,
        maybeSingle: async () => table === 'plans' ? { data: { plan_json: S.plan }, error: null } : { data: null, error: null },
        single: async () => ({ data: S.inserts[S.inserts.length - 1], error: null }),
        insert: (row: Record<string, unknown>) => { S.inserts.push(row); return q },
        update: (row: unknown) => { S.updates.push(row); return q },
        then: (r: (x: unknown) => void) => r(table === 'health_daily_samples' ? { data: S.samples, error: null } : { data: S.pending, error: null }),
      })
      return q
    },
  }),
}))

const sess = (type: string, extra: Record<string, unknown> = {}) => ({ type, label: type, distance_km: 8, ...extra })
function plan(): Plan {
  // 12 weeks, so the taper protection does not decline week 3. Week 3 starts Mon 2026-11-02.
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 9, 19 + i * 7)).toISOString().slice(0, 10)
    return { n: i + 1, date: d, phase: 'build', sessions: {
      mon: sess('easy'), tue: sess('quality'), thu: sess('tempo'), sat: sess('easy', { role: 'long_run', distance_km: 18 }),
    } }
  })
  return { meta: { race_date: '2027-01-15' }, weeks } as unknown as Plan
}
/** 14 prior days of a stable baseline, then today: HRV well below normal. */
function samples(today: string) {
  const out = []
  for (let k = 1; k <= 14; k++) {
    const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - k)
    out.push({ sample_date: d.toISOString().slice(0, 10), rhr_bpm: 50, hrv_ms: k % 2 ? 58 : 62, sleep_hours: 7.5, sleep_stages: null })
  }
  out.push({ sample_date: today, rhr_bpm: 50, hrv_ms: 30, sleep_hours: 7.5, sleep_stages: null })
  return out
}

beforeEach(() => { S.plan = plan(); S.samples = samples('2026-11-05'); S.pending = []; S.inserts = []; S.updates = []; S.events = [] })

async function check(date = '2026-11-05') {
  const { GET } = await import('@/app/api/pre-session-readiness/route')
  const { NextRequest } = await import('next/server')
  const res = await GET(new NextRequest(`https://x/api/pre-session-readiness?date=${date}`))
  return { status: res.status, body: await res.json() }
}

describe('the readiness route', () => {
  it('🔴 softening on Thursday no longer crashes, and proposes a change', async () => {
    const r = await check()
    expect(r.status, JSON.stringify(r.body)).toBe(200)
    expect(S.inserts, JSON.stringify(r.body)).toHaveLength(1)
    expect(S.events).toEqual([])
  })
  it('🔴 the stored week is the WHOLE week, and ONLY Thursday changed', async () => {
    await check()
    const row = S.inserts[0] as { sessions_before: { type: string }[]; sessions_after: { type: string; distance_km?: number }[]; trigger_detail: Record<string, unknown> }
    expect(row.sessions_before).toHaveLength(7)
    expect(row.sessions_after).toHaveLength(7)
    const changed = row.sessions_after.map((s, i) => JSON.stringify(s) !== JSON.stringify(row.sessions_before[i]))
    expect(changed).toEqual([false, false, false, true, false, false, false])
    expect(row.sessions_after[3].type).toBe('easy')
    expect(row.sessions_after[1].type).toBe('quality')          // Tuesday's quality untouched
    expect(row.sessions_after[5].distance_km).toBe(18)          // the long run untouched
    expect(row.trigger_detail).toMatchObject({ sessionDay: 'thu', sessionDate: '2026-11-05' })
  })
  it('a pending ease from an earlier day is closed, not shown again', async () => {
    S.pending = [{ id: 'old', trigger_detail: { sessionDay: 'tue', sessionDate: '2026-11-03' } }]
    await check()
    expect(S.updates).toContainEqual({ status: 'reverted' })
  })
  it('🔴 an engine failure is RECORDED, not swallowed', async () => {
    ;(S.plan as Plan).weeks[2].sessions = { thu: sess('tempo'), tue: { label: 'broken' } } as never
    const r = await check()
    expect(r.status).toBe(500)
    expect(S.events).toEqual(['readiness_failed'])
  })
})

describe('applyAdjustmentDays — writing a change back', () => {
  const week = () => ({ sessions: { mon: sess('easy'), tue: sess('quality'), thu: sess('tempo') } as Record<string, unknown> })
  const seven = (thu: unknown) => [sess('easy'), sess('quality'), { type: 'rest' }, thu, { type: 'rest' }, { type: 'rest' }, { type: 'rest' }]
  it('🔴 writes ONLY the day that changed (not Monday, not every day)', () => {
    const w = week()
    const r = applyAdjustmentDays(w as never, seven(sess('tempo')), seven(sess('easy')))
    expect(r).toEqual({ ok: true, changed: ['thu'] })
    expect((w.sessions.thu as { type: string }).type).toBe('easy')
    expect((w.sessions.mon as { type: string }).type).toBe('easy')
    expect(w.sessions.wed).toBeUndefined()                      // no rest object written into an empty day
  })
  it('🔴 refuses a malformed row rather than guessing (the old one-session shape)', () => {
    const w = week()
    expect(applyAdjustmentDays(w as never, [sess('tempo')], [sess('easy')])).toEqual({ ok: false, reason: 'malformed' })
    expect((w.sessions.mon as { type: string }).type).toBe('easy')
  })
  it('a change made to another day since is left alone', () => {
    const w = week(); w.sessions.tue = sess('easy')            // runner changed Tuesday after the proposal
    applyAdjustmentDays(w as never, seven(sess('tempo')), seven(sess('easy')))
    expect((w.sessions.tue as { type: string }).type).toBe('easy')
  })
})
