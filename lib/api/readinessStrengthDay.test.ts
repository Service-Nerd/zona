import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Plan } from '@/types/plan'

/**
 * 🔴 STRENGTH-RECOVERY-01 (Design Board 2026-10-18) — a day whose only easeable session is strength
 * still gets the recovery reading, so Today can offer the strength ease. Copied harness from
 * readinessWrongDay.test.ts (the run cases live there).
 * ---- original header follows ----
 * READINESS-WRONG-DAY-01 (2026-10-17) — a recovery ease changes TODAY, and only today.
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
  overrides: [] as unknown[], overridesError: null as null | { message: string }, strength: null as unknown,
}))
vi.mock('@/lib/supabase/getUserFromRequest', () => ({ getUserFromRequest: async () => ({ id: 'u1' }) }))
vi.mock('@/lib/trial', () => ({ getUserTier: async () => 'paid' }))
vi.mock('@/lib/strength-bridge/serverDay', () => ({ strengthSessionOn: async () => S.strength }))
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
        then: (r: (x: unknown) => void) => r(table === 'health_daily_samples' ? { data: S.samples, error: null }
          : table === 'session_overrides' ? { data: S.overridesError ? null : S.overrides, error: S.overridesError }
          : { data: S.pending, error: null }),
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

beforeEach(() => { S.plan = plan(); S.pending = []; S.inserts = []; S.updates = []; S.events = []; S.overrides = []; S.overridesError = null; S.strength = null })
const LIFT = { date: '2026-11-04', day: 'wed', week_n: 3, kind: 'full_body', heavy_legs: true, after_quality_run: false, estimated_minutes: 40, blocks: [] }

async function check(date: string) {
  S.samples = samples(date)
  const { GET } = await import('@/app/api/pre-session-readiness/route')
  const { NextRequest } = await import('next/server')
  const res = await GET(new NextRequest(`https://x/api/pre-session-readiness?date=${date}`))
  return { status: res.status, body: await res.json() }
}

describe('a strength-only day', () => {
  it('🔴 a no-run day with a lift gets the reading: warranted, with its signals, and NO run row', async () => {
    S.strength = LIFT
    const r = await check('2026-11-04')                       // Wednesday: no run in week 3
    expect(r.body).toMatchObject({ adjustment: null, reason: 'strength_only', warranted: true, signals: { isLowHRV: true } })
    expect(r.body.detail.hrvToday).toBe(30)
    expect(S.inserts).toHaveLength(0)
  })
  it('an easy-run day with a lift is the same (the easy run is not eased)', async () => {
    S.strength = { ...LIFT, date: '2026-11-02', day: 'mon' }
    const r = await check('2026-11-02')                       // Monday: easy run
    expect(r.body).toMatchObject({ reason: 'strength_only', warranted: true })
    expect(S.inserts).toHaveLength(0)
  })
  it('🔴 control: the same days without a lift keep their old answers', async () => {
    expect((await check('2026-11-04')).body).toEqual({ adjustment: null, reason: 'no_active_session' })
    expect((await check('2026-11-02')).body).toEqual({ adjustment: null, reason: 'session_type_not_eligible' })
  })
  it('a mobility session is not easeable, so it is the no-lift answer', async () => {
    S.strength = { ...LIFT, kind: 'mobility' }
    expect((await check('2026-11-04')).body.reason).toBe('no_active_session')
  })
  it('a run day says warranted too, so the card can add the lift beside the run', async () => {
    const r = await check('2026-11-05')                       // Thursday: tempo
    expect(r.body.warranted).toBe(true)
    expect(S.inserts).toHaveLength(1)
  })
})
