import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * 🔒 STRENGTH-RECOVERY-01 — /api/strength/ease, run for real with only I/O faked. The answer is stored
 * by date; only a date holding an easeable session is accepted; the gate holds; a failed write is said.
 */
const S = vi.hoisted(() => ({
  isAdmin: true, stored: { plan_json: null as unknown, recovery_eases: {} as Record<string, string> },
  updates: [] as unknown[], updateError: null as null | { message: string },
}))
vi.mock('@/lib/supabase/getUserFromRequest', () => ({ getUserFromRequest: async () => ({ id: 'u1' }) }))
vi.mock('@/lib/trial', () => ({ getUserTier: async () => 'paid' }))
vi.mock('@/lib/ops/recordOpsEvent', () => ({ recordOpsEvent: async () => {} }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {}
      Object.assign(q, {
        select: () => q, eq: () => q,
        maybeSingle: async () => table === 'user_settings' ? { data: { is_admin: S.isAdmin }, error: null } : { data: S.stored, error: null },
        update: (row: unknown) => { S.updates.push(row); return { eq: async () => ({ error: S.updateError }) } },
      })
      return q
    },
  }),
}))

import { generateStrengthPlan, type StrengthPlan } from '@/packages/strength'
const plan: StrengthPlan = generateStrengthPlan({ focus: 'running', session_minutes: 45, sessions_per_week: 2, equipment: ['dumbbells'], experience: 'some' }, null, { standaloneStart: '2026-11-02' })
const lift = plan.weeks.flatMap(w => w.sessions).find(s => s.kind !== 'mobility' && s.date)!
const post = async (body: unknown) => {
  const { POST } = await import('@/app/api/strength/ease/route')
  const res = await POST(new Request('https://x/api/strength/ease', { method: 'POST', body: JSON.stringify(body) }) as never)
  return { status: res.status, body: await res.json() }
}
beforeEach(() => { S.isAdmin = true; S.stored = { plan_json: plan, recovery_eases: { '2026-01-01': 'declined' } }; S.updates = []; S.updateError = null })

describe('POST /api/strength/ease', () => {
  it('stores the answer by date and keeps earlier answers', async () => {
    const r = await post({ date: lift.date, answer: 'eased' })
    expect(r.status).toBe(200)
    expect(S.updates).toEqual([{ recovery_eases: { '2026-01-01': 'declined', [lift.date!]: 'eased' } }])
  })
  it('🔴 a date with no easeable session is refused, nothing written', async () => {
    expect((await post({ date: '2026-10-01', answer: 'eased' })).status).toBe(404)
    expect(S.updates).toEqual([])
  })
  it('🔴 a bad date or answer is 422', async () => {
    expect((await post({ date: 'tomorrow', answer: 'eased' })).status).toBe(422)
    expect((await post({ date: lift.date, answer: 'maybe' })).status).toBe(422)
    expect(S.updates).toEqual([])
  })
  it('🔴 non-admin → 404 while strength is admin-only', async () => {
    S.isAdmin = false
    expect((await post({ date: lift.date, answer: 'eased' })).status).toBe(404)
  })
  it('a failed write is a 500, never a silent success', async () => {
    S.updateError = { message: 'boom' }
    expect((await post({ date: lift.date, answer: 'declined' })).status).toBe(500)
  })
})
