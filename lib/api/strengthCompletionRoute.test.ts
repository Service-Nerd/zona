import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * 🔒 STRENGTH-GUIDED-SESSION-01 — /api/strength/completion with session times, run for real with only I/O faked.
 * Both times or neither, on 'done' only, end after start, at most four hours; before the migration a completion is
 * still saved without them.
 */
const S = vi.hoisted(() => ({
  stored: { plan_json: { weeks: [{ sessions: [{ date: '2026-11-03' }] }] } } as unknown,
  upserts: [] as Record<string, unknown>[], missingTimes: false, events: [] as string[],
}))
vi.mock('@/lib/supabase/getUserFromRequest', () => ({ getUserFromRequest: async () => ({ id: 'u1' }) }))
vi.mock('@/lib/trial', () => ({ getUserTier: async () => 'paid' }))
vi.mock('@/lib/ops/recordOpsEvent', () => ({ recordOpsEvent: async (k: string, d: { where?: string }) => { S.events.push(`${k}:${d.where}`) } }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {}
      Object.assign(q, {
        select: () => q, eq: () => q,
        maybeSingle: async () => table === 'user_settings' ? { data: { is_admin: true }, error: null } : { data: S.stored, error: null },
        upsert: async (row: Record<string, unknown>) => {
          S.upserts.push(row)
          return S.missingTimes && 'started_at' in row ? { error: { code: 'PGRST204', message: "Could not find the 'started_at' column" } } : { error: null }
        },
      })
      return q
    },
  }),
}))
const post = async (body: unknown) => {
  const { POST } = await import('@/app/api/strength/completion/route')
  const res = await POST(new Request('https://x/api/strength/completion', { method: 'POST', body: JSON.stringify(body) }) as never)
  return { status: res.status, body: await res.json() }
}
beforeEach(() => { S.upserts = []; S.missingTimes = false; S.events = [] })
const start = '2026-11-03T07:00:00.000Z', end = '2026-11-03T07:51:00.000Z'

describe('POST /api/strength/completion — session times', () => {
  it('🔴 a guided session stores its start and end with done', async () => {
    const r = await post({ date: '2026-11-03', status: 'done', started_at: start, ended_at: end })
    expect(r.status).toBe(200)
    expect(S.upserts[0]).toMatchObject({ status: 'done', started_at: start, ended_at: end })
  })
  it('marked complete without starting: no time columns are sent at all', async () => {
    await post({ date: '2026-11-03', status: 'done' })
    expect(S.upserts[0]).toMatchObject({ status: 'done' })
    expect('started_at' in S.upserts[0]).toBe(false)
  })
  it('🔴 times that cannot be a session are DROPPED and the done is kept (never strand the runner on the end page)', async () => {
    for (const body of [
      { date: '2026-11-03', status: 'done', started_at: start },
      { date: '2026-11-03', status: 'done', started_at: end, ended_at: start },
      { date: '2026-11-03', status: 'done', started_at: start, ended_at: '2026-11-03T12:00:00.000Z' },
      { date: '2026-11-03', status: 'done', started_at: 'soon', ended_at: end },
    ]) {
      S.upserts = []
      const r = await post(body)
      expect(r.status).toBe(200)
      expect(S.upserts[0]).toMatchObject({ status: 'done' })
      expect('started_at' in S.upserts[0]).toBe(false)
    }
    S.upserts = []
    await post({ date: '2026-11-03', status: 'skipped', started_at: start, ended_at: end })
    expect('started_at' in S.upserts[0]).toBe(false)
  })
  it('🔴 before the migration, a completion without times is one write and no false failure event', async () => {
    S.missingTimes = true
    await post({ date: '2026-11-03', status: 'skipped' })
    expect(S.upserts.length).toBe(1)
    expect(S.events).toEqual([])
  })
  it('🔴 before the migration is applied, the completion is still saved, without its times, and says so', async () => {
    S.missingTimes = true
    const r = await post({ date: '2026-11-03', status: 'done', started_at: start, ended_at: end })
    expect(r.status).toBe(200)
    expect(S.upserts.length).toBe(2)
    expect('started_at' in S.upserts[1]).toBe(false)
    expect(S.events).toContain('strength_save_failed:completion_times_column')
  })
})
