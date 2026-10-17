import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * 🔒 STRENGTH-NOTE-01 — /api/strength/weekly-note, run for real with only I/O faked.
 * Cache first; the model only on a miss; a refused or failed reply is `{ note: null }`
 * and NOTHING is stored; the strength gate holds.
 */
const S = vi.hoisted(() => ({
  isAdmin: true, ai: 'Legs on Tuesday, after the intervals.' as string | null, aiCalls: 0,
  stored: { plan_json: null as unknown, weekly_notes: {} as Record<string, string> }, updates: [] as unknown[],
}))
vi.mock('@/lib/supabase/getUserFromRequest', () => ({ getUserFromRequest: async () => ({ id: 'u1' }) }))
vi.mock('@/lib/trial', () => ({ getUserTier: async () => 'paid' }))
vi.mock('@/lib/userPrefs', () => ({ getUserDisplayPrefs: async () => ({ units: 'km' }) }))
vi.mock('@/lib/ai/guardAiRequest', () => ({ guardAiRequest: async (req: Request) => ({ ok: true, body: await req.json() }) }))
vi.mock('@/lib/ai/callAnthropic', () => ({ callAnthropic: async () => { S.aiCalls++; return S.ai == null ? { ok: false } : { ok: true, text: S.ai } } }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {}
      Object.assign(q, {
        select: () => q, eq: () => q,
        maybeSingle: async () => table === 'user_settings' ? { data: { is_admin: S.isAdmin, first_name: 'Sam' }, error: null } : { data: S.stored, error: null },
        update: (row: unknown) => { S.updates.push(row); return { eq: async () => ({ error: null }) } },
      })
      return q
    },
  }),
}))

import { generateStrengthPlan } from '@/packages/strength'
import { weekNoteKey } from '@/lib/strength-bridge/weekNoteKey'
const plan = generateStrengthPlan({ focus: 'running', session_minutes: 45, sessions_per_week: 2, equipment: ['dumbbells'], experience: 'some' }, null, { standaloneStart: '2026-11-02' })

beforeEach(() => { S.isAdmin = true; S.ai = 'Legs on Tuesday, after the intervals.'; S.aiCalls = 0; S.stored = { plan_json: plan, weekly_notes: {} }; S.updates = [] })
const post = async (body: unknown) => {
  const { POST } = await import('@/app/api/strength/weekly-note/route')
  const res = await POST(new Request('https://x/api/strength/weekly-note', { method: 'POST', body: JSON.stringify(body) }) as never)
  return { status: res.status, body: await res.json() }
}

describe('POST /api/strength/weekly-note', () => {
  it('🔴 non-admin → 404 while the release is admin-only, and the model is never called', async () => {
    S.isAdmin = false
    expect((await post({ week_n: 1 })).status).toBe(404)
    expect(S.aiCalls).toBe(0)
  })
  it('a cache hit returns the stored note without calling the model', async () => {
    S.stored.weekly_notes = { [weekNoteKey(plan.weeks[0])]: 'Cached note.' }
    expect((await post({ week_n: 1 })).body).toMatchObject({ note: 'Cached note.', cached: true })
    expect(S.aiCalls).toBe(0)
  })
  it('a miss calls the model once and stores the note under the week’s key', async () => {
    const r = await post({ week_n: 1 })
    expect(r.body.note).toBe('Legs on Tuesday, after the intervals.')
    expect(S.aiCalls).toBe(1)
    expect(S.updates[0]).toEqual({ weekly_notes: { [weekNoteKey(plan.weeks[0])]: 'Legs on Tuesday, after the intervals.' } })
  })
  it('🔴 a reply that makes a claim is refused: note null, nothing stored', async () => {
    S.ai = 'This helps prevent injury.'
    expect((await post({ week_n: 1 })).body).toEqual({ note: null })
    expect(S.updates).toEqual([])
  })
  it('🔴 a failed model call is silent: 200, note null, nothing stored', async () => {
    S.ai = null
    const r = await post({ week_n: 1 })
    expect(r).toEqual({ status: 200, body: { note: null } })
    expect(S.updates).toEqual([])
  })
  it('an unknown week or no plan is note null; a bad week_n is 422', async () => {
    expect((await post({ week_n: 99 })).body).toEqual({ note: null })
    expect((await post({ week_n: 'x' })).status).toBe(422)
  })
})
