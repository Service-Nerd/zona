import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateStrengthPlan, parseStrengthProfile } from '@/packages/strength'

/**
 * 🔒 STRENGTH-ENGINE-01 — /api/strength/plan, run for real with only I/O faked.
 *
 * The arms that matter are the refusals: no user → 401; a paying NON-admin → 404
 * while the release is admin-only; bad or oversized input → refused before any
 * read; a failed run-plan READ → 500 and NOTHING saved (never a standalone plan
 * placed blind to the runner's hard days); a validator failure → nothing saved.
 */
const S = vi.hoisted(() => ({ liftLogs: [] as unknown[],
  user: { id: 'u1' } as { id: string } | null,
  isAdmin: true,
  tier: 'paid' as 'free' | 'trial' | 'paid',
  planError: null as string | null,
  plan: null as unknown,
  upserts: [] as Record<string, unknown>[],
  events: [] as string[],
  stored: null as Record<string, unknown> | null,
  violate: false,
  deletes: [] as Record<string, unknown>[],
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
        select: chain, eq: chain, gte: chain,
        // STRENGTH-PROGRESSION-01 — the lift-log read ends in .order(); S.liftLogs is what the table holds.
        order: async () => ({ data: table === 'strength_lift_logs' ? S.liftLogs : [], error: null }),
        is: async () => ({ data: [], error: null }),
        maybeSingle: async () => table === 'user_settings'
          ? { data: { is_admin: S.isAdmin }, error: null }
          : { data: S.stored, error: null },
        upsert: async (row: Record<string, unknown>) => { S.upserts.push({ table, ...row }); return { error: null } },
        delete: () => { const d: Record<string, unknown> = { table }; S.deletes.push(d); const c = { eq: (k: string, v: unknown) => { d[k] = v; return c }, then: (r: (x: unknown) => void) => r({ error: null }) }; return c },
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
  S.upserts = []; S.events = []; S.stored = null; S.violate = false; S.deletes = []; S.liftLogs = []
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
  it('🔴 SAVE-PATTERN-01: a preview returns the built plan and writes NOTHING', async () => {
    const res = await post({ profile: PROFILE, preview: true })
    expect(res.status).toBe(200)
    expect((await res.json()).plan.weeks.length).toBeGreaterThan(0)
    expect(S.upserts).toEqual([])
  })
  it('a preview is held to the same validator: a failing plan is refused, not shown', async () => {
    S.violate = true
    expect((await post({ profile: PROFILE, preview: true })).status).toBe(500)
    expect(S.upserts).toEqual([])
  })
  it('preview must be literally true: anything else saves', async () => {
    await post({ profile: PROFILE, preview: 'yes' })
    expect(S.upserts.filter(u => u.table === 'strength_plans')).toHaveLength(1)
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

describe('GET re-places strength silently when the run week moved under it (STRENGTH-APP-01 H)', () => {
  const get = async () => {
    const { GET } = await import('@/app/api/strength/plan/route')
    return GET(new Request('https://x/api/strength/plan') as never)
  }
  it('a stale signature regenerates from the STORED profile and saves it', async () => {
    S.stored = { plan_json: { weeks: [] }, profile_json: PROFILE, run_context_sig: 'old-signature', generated_at: 'x' }
    const body = await (await get()).json()
    expect(body.replaced).toBe(true)
    expect(S.upserts).toHaveLength(1)
    expect(body.plan.standalone).toBe(true)
  })
  // The route stores the PARSED profile (defaults filled), so a fixture of "what it stored" must be built from it too.
  const parsedProfile = () => { const r = parseStrengthProfile(PROFILE); if (!r.ok) throw new Error('profile'); return r.profile }
  it('🔴 a matching signature and the plan the engine builds today saves nothing', async () => {
    S.stored = { plan_json: generateStrengthPlan(parsedProfile(), null, { standaloneStart: '2026-11-02' }), profile_json: PROFILE, run_context_sig: null, generated_at: 'x' }
    const body = await (await get()).json()
    expect(body.replaced).toBe(false)
    expect(S.upserts).toEqual([])
  })
  it('🔴 STRENGTH-ENGINE-REACH-01: a matching signature on an older engine\'s plan is rebuilt, keeping its start', async () => {
    const old = generateStrengthPlan(parsedProfile(), null, { standaloneStart: '2026-11-02' })
    old.weeks = old.weeks.slice(0, 1)
    S.stored = { plan_json: old, profile_json: PROFILE, run_context_sig: null, generated_at: 'x' }
    const body = await (await get()).json()
    expect(body.replaced).toBe(true)
    expect(S.upserts).toHaveLength(1)
    expect(body.plan.start_date).toBe('2026-11-02')
    expect(S.events).toContain('strength_plan_engine_rebuilt')
  })
  it('🔴 a failed run-plan read never re-places blind', async () => {
    S.stored = { plan_json: { weeks: [] }, profile_json: PROFILE, run_context_sig: 'old-signature', generated_at: 'x' }
    S.planError = 'boom'
    await get()
    expect(S.upserts).toEqual([])
  })
})

describe('POST /api/strength/completion — done or skipped only', () => {
  const post = async (body: unknown) => {
    const { POST } = await import('@/app/api/strength/completion/route')
    return POST(new Request('https://x/api/strength/completion', { method: 'POST', body: JSON.stringify(body) }) as never)
  }
  const withSession = () => { S.stored = { plan_json: { weeks: [{ sessions: [{ date: '2026-11-03' }] }] } } }
  it('🔴 401 / 404 behind the same gate', async () => {
    S.user = null; expect((await post({ date: '2026-11-03', status: 'done' })).status).toBe(401)
    S.user = { id: 'u1' }; S.isAdmin = false; expect((await post({ date: '2026-11-03', status: 'done' })).status).toBe(404)
  })
  it('🔴 refuses a bad date, a bad status, and a date with no strength session', async () => {
    withSession()
    expect((await post({ date: '03/11/2026', status: 'done' })).status).toBe(422)
    expect((await post({ date: '2026-11-03', status: 'great' })).status).toBe(422)
    expect((await post({ date: '2026-11-03', status: 'done', rpe: 7 })).status).toBe(200)
    S.upserts = []
    expect((await post({ date: '2026-11-04', status: 'done' })).status).toBe(404)
    expect(S.upserts).toEqual([])
  })
  it('done saves this user\'s row; null undoes it', async () => {
    withSession()
    await post({ date: '2026-11-03', status: 'done' })
    expect(S.upserts[0]).toMatchObject({ table: 'strength_completions', user_id: 'u1', session_date: '2026-11-03', status: 'done' })
    await post({ date: '2026-11-03', status: null })
    expect(S.deletes[0]).toMatchObject({ table: 'strength_completions', user_id: 'u1', session_date: '2026-11-03' })
  })
})

describe('STRENGTH-PROGRESSION-01 — the plan carries the runner\'s lift logs', () => {
  it('GET returns lift_logs, mapped to the engine\'s shape (numeric load, date)', async () => {
    const { generateStrengthPlan } = await import('@/packages/strength')
    S.stored = { plan_json: generateStrengthPlan(PROFILE as never, null, { standaloneStart: '2026-11-02' }), profile_json: PROFILE, run_context_sig: 'x', generated_at: '2026-11-01' }
    S.planError = 'boom'   // keep the stored plan; this arm is about the logs
    S.liftLogs = [{ session_date: '2026-11-03', exercise_id: 'goblet_squat', load_kg: '20.00', feel: 'right', counts: true }]
    const { GET } = await import('@/app/api/strength/plan/route')
    const body = await (await GET(new Request('https://x/api/strength/plan') as never)).json()
    expect(body.lift_logs).toEqual([{ date: '2026-11-03', exercise_id: 'goblet_squat', load_kg: 20, feel: 'right', counts: true }])
  })
})
