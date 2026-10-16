import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * 🔒 STRENGTH-ENGINE-01 — /api/strength/plan, run for real with only I/O faked.
 *
 * The arms that matter are the refusals: no user → 401; a paying NON-admin → 404
 * while the release is admin-only; bad or oversized input → refused before any
 * read; a failed run-plan READ → 500 and NOTHING saved (never a standalone plan
 * placed blind to the runner's hard days); a validator failure → nothing saved.
 */
const S = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  isAdmin: true,
  tier: 'paid' as 'free' | 'trial' | 'paid',
  planError: null as string | null,
  plan: null as unknown,
  upserts: [] as Record<string, unknown>[],
  events: [] as string[],
  stored: null as Record<string, unknown> | null,
  violate: false,
}))

vi.mock('@/packages/strength', async () => {
  const real = await vi.importActual<typeof import('@/packages/strength')>('@/packages/strength')
  return { ...real, validateStrengthPlan: (...a: Parameters<typeof real.validateStrengthPlan>) => S.violate ? [{ code: 'S-LEGS-48H', week: 1, detail: 'x' }] : real.validateStrengthPlan(...a) }
})

vi.mock('@/lib/supabase/getUserFromRequest', () => ({ getUserFromRequest: async () => S.user }))
vi.mock('@/lib/trial', () => ({ getUserTier: async () => S.tier }))
vi.mock('@/lib/ops/recordOpsEvent', () => ({ recordOpsEvent: async (k: string) => { S.events.push(k) } }))
vi.mock('@/lib/planRead', () => ({ readPlanJson: async () => ({ plan: S.planError ? null : S.plan, error: S.planError }) }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {}
      const chain = () => q
      Object.assign(q, {
        select: chain, eq: chain,
        is: async () => ({ data: [], error: null }),
        maybeSingle: async () => table === 'user_settings'
          ? { data: { is_admin: S.isAdmin }, error: null }
          : { data: S.stored, error: null },
        upsert: async (row: Record<string, unknown>) => { S.upserts.push({ table, ...row }); return { error: null } },
      })
      return q
    },
  }),
}))

const PROFILE = { focus: 'running', session_minutes: 45, sessions_per_week: 2, equipment: ['dumbbells', 'bench'], experience: 'some' }
const post = async (body: unknown) => {
  const { POST } = await import('@/app/api/strength/plan/route')
  return POST(new Request('https://x/api/strength/plan', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }) as never)
}

beforeEach(() => {
  S.user = { id: 'u1' }; S.isAdmin = true; S.tier = 'paid'; S.planError = null; S.plan = null
  S.upserts = []; S.events = []; S.stored = null; S.violate = false
})

describe('POST /api/strength/plan', () => {
  it('🔴 no user → 401', async () => { S.user = null; expect((await post({ profile: PROFILE })).status).toBe(401) })
  it('🔴 a paying runner who is not an admin → 404 while the release is admin-only', async () => {
    S.isAdmin = false
    const res = await post({ profile: PROFILE })
    expect(res.status).toBe(404)
    expect(S.upserts).toEqual([])
  })
  it('🔴 oversized body → 413, invalid JSON → 400, bad profile → 422, nothing saved', async () => {
    expect((await post('x'.repeat(5000))).status).toBe(413)
    expect((await post('{not json')).status).toBe(400)
    const bad = await post({ profile: { ...PROFILE, is_admin: true } })
    expect(bad.status).toBe(422)
    expect(S.upserts).toEqual([])
  })
  it('🔴 a failed run-plan read → 500 and NOTHING saved (never a blind standalone plan)', async () => {
    S.planError = 'connection reset'
    expect((await post({ profile: PROFILE })).status).toBe(500)
    expect(S.upserts).toEqual([])
  })
  it('🔴 a plan that fails its own validator is recorded and NOT saved', async () => {
    S.violate = true
    expect((await post({ profile: PROFILE })).status).toBe(500)
    expect(S.upserts).toEqual([])
    expect(S.events).toEqual(['strength_generate_failed'])
  })
  it('no run plan → a standalone plan, saved for this user only', async () => {
    const res = await post({ profile: PROFILE })
    expect(res.status).toBe(200)
    const { plan } = await res.json()
    expect(plan.standalone).toBe(true)
    expect(S.upserts).toHaveLength(1)
    expect(S.upserts[0]).toMatchObject({ table: 'strength_plans', user_id: 'u1', run_context_sig: null })
  })
  it('the stored profile is the PARSED one, never the raw request', async () => {
    await post({ profile: { ...PROFILE, equipment: ['bench', 'bench'] } })
    expect((S.upserts[0].profile_json as { equipment: string[] }).equipment).toEqual(['bench'])
  })
})

describe('GET /api/strength/plan', () => {
  const get = async () => {
    const { GET } = await import('@/app/api/strength/plan/route')
    return GET(new Request('https://x/api/strength/plan') as never)
  }
  it('🔴 non-admin → 404', async () => { S.isAdmin = false; expect((await get()).status).toBe(404) })
  it('nothing stored → plan null', async () => { expect(await (await get()).json()).toEqual({ plan: null }) })
  it('a failed run-plan read reports stale as unknown, never "changed"', async () => {
    S.stored = { plan_json: { v: 1 }, profile_json: PROFILE, run_context_sig: 'abc', generated_at: 'x' }
    S.planError = 'boom'
    expect((await (await get()).json()).stale).toBeNull()
  })
})
