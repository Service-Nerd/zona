import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { runDistance, REPORTED_DISTANCE_M } from './runDistance'

/**
 * 🔴 UNMEASURED-DISTANCE-01 (architecture + Coaching Board + Design Board 6t-i, 2026-10-22). A runner fills in a distance
 * their device did not record. Stored BESIDE the measured one, fill-only, through `/api/health/ingest`; counted for volume
 * and display (labelled), never for a fitness estimate.
 */
type Row = { id: string; user_id: string; apple_health_uuid: string; distance_m: number | null; reported_distance_m?: number | null; reported_at?: string }
const S: { rows: Row[]; user: { id: string } | null; ops: string[] } = { rows: [], user: { id: 'u1' }, ops: [] }

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => {
      const f: Record<string, unknown> = {}
      const q = { filters: f, patch: null as null | Record<string, unknown> }
      const api: any = {
        select: () => api,
        update: (p: Record<string, unknown>) => { q.patch = p; return api },
        eq: (k: string, v: unknown) => { f[k] = v; return q.patch ? apply() : api },
        maybeSingle: async () => ({ data: S.rows.find(r => Object.entries(f).every(([k, v]) => (r as any)[k] === v)) ?? null, error: null }),
      }
      const apply = () => {
        const done = Object.keys(f).length >= 2
        if (done) for (const r of S.rows) if (Object.entries(f).every(([k, v]) => (r as any)[k] === v)) Object.assign(r, q.patch)
        return done ? Promise.resolve({ error: null }) : api
      }
      return api
    },
  }),
}))
vi.mock('@/lib/supabase/getUserFromRequest', () => ({ getUserFromRequest: async () => S.user }))
vi.mock('@/lib/ops/recordOpsEvent', () => ({ recordOpsEvent: async (k: string) => { S.ops.push(k) } }))

async function post(body: unknown) {
  const { POST } = await import('@/app/api/health/ingest/route')
  const { NextRequest } = await import('next/server')
  return POST(new NextRequest('https://www.zonna.run/api/health/ingest', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' }, body: JSON.stringify(body),
  }))
}

beforeEach(() => {
  S.user = { id: 'u1' }; S.ops = []
  S.rows = [
    { id: 'a', user_id: 'u1', apple_health_uuid: 'PELOTON', distance_m: 0 },
    { id: 'b', user_id: 'u1', apple_health_uuid: 'WATCH', distance_m: 8040 },
    { id: 'c', user_id: 'u2', apple_health_uuid: 'OTHER', distance_m: 0 },
  ]
})

describe('runDistance: measured wins, reported fills, unknown is never zero', () => {
  it('measured distance', () => expect(runDistance({ distance_m: 8040, reported_distance_m: 9000 })).toEqual({ km: 8.04, reported: false }))
  it('🔴 a device 0 with a runner entry reads as reported', () => expect(runDistance({ distance_m: 0, reported_distance_m: 8000 })).toEqual({ km: 8, reported: true }))
  it('🔴 a device 0 with nothing is unknown, not 0 km', () => expect(runDistance({ distance_m: 0 })).toBeNull())
})

describe('the report_distance action on /api/health/ingest', () => {
  it('🔴 fills a run the device left at 0, beside the measured column', async () => {
    const res = await post({ source: 'report_distance', appleHealthUuid: 'PELOTON', distanceMeters: 8000 })
    expect(res.status).toBe(200)
    const r = S.rows.find(x => x.id === 'a')!
    expect(r.reported_distance_m).toBe(8000)
    expect(r.distance_m).toBe(0)
    expect(typeof r.reported_at).toBe('string')
  })
  it('🔴 refuses a run the device measured (409), and writes nothing', async () => {
    const res = await post({ source: 'report_distance', appleHealthUuid: 'WATCH', distanceMeters: 9000 })
    expect(res.status).toBe(409)
    expect(S.rows.find(x => x.id === 'b')!.reported_distance_m).toBeUndefined()
  })
  it('cannot reach another runner\'s run (404)', async () => {
    expect((await post({ source: 'report_distance', appleHealthUuid: 'OTHER', distanceMeters: 8000 })).status).toBe(404)
    expect(S.rows.find(x => x.id === 'c')!.reported_distance_m).toBeUndefined()
  })
  it('rejects a distance outside the bounds, and an unsigned-in caller', async () => {
    expect((await post({ source: 'report_distance', appleHealthUuid: 'PELOTON', distanceMeters: REPORTED_DISTANCE_M.min - 1 })).status).toBe(422)
    expect((await post({ source: 'report_distance', appleHealthUuid: 'PELOTON', distanceMeters: REPORTED_DISTANCE_M.max + 1 })).status).toBe(422)
    S.user = null
    expect((await post({ source: 'report_distance', appleHealthUuid: 'PELOTON', distanceMeters: 8000 })).status).toBe(401)
  })
})

describe('🔴 the Coaching Board line: a reported distance never feeds a fitness estimate', () => {
  for (const f of ['lib/plan/aerobicEstimate.ts', 'app/api/race-times/route.ts', 'app/api/wizard-benchmark-estimate/route.ts', 'lib/coaching/runHistory.ts']) {
    it(f, () => {
      const src = readFileSync(f, 'utf8')
      expect(src).not.toMatch(/reported_distance|runDistance\(/)
    })
  }
  it('the load model does read it (volume)', () => {
    expect(readFileSync('lib/coaching/weeklyActualLoad.ts', 'utf8')).toMatch(/runDistance\(row\)/)
  })
})

describe('🔴 the screens never print 0km for an unrecorded distance, and label a reported one', () => {
  const popup = readFileSync('components/dashboard/SessionPopupInner.tsx', 'utf8')
  const dash = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
  it('session detail: through runDistance, with the unrecorded and reported states and the row', () => {
    expect(popup).toMatch(/runDistance\(\{ distance_m: actualDistM/)
    expect(popup).toMatch(/formatDistance\(actualDistKm, preferredUnits\) : DISTANCE_NOT_RECORDED\)/)
    expect(popup).toMatch(/\{DISTANCE_REPORTED_LABEL\}/)
    expect(popup).toMatch(/canAddDistance && \(\s*<AddDistanceRow/)
    expect(popup).not.toMatch(/Number\.isFinite\(actualDistM\) \? \(actualDistM as number\) \/ 1000/)
  })
  it('post-run: the same', () => {
    expect(dash).toMatch(/const postRunDist = actDistance/)
    expect(dash).toMatch(/: \(displayActivity \? DISTANCE_NOT_RECORDED : ''\)/)
    expect(dash).toMatch(/canAddPostRunDistance && \(\s*<AddDistanceRow/)
  })
})
