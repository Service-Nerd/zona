import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * 🔒 STRENGTH-PROGRESSION-01 — /api/strength/log, run for real with only I/O faked. One row per lift per session; only
 * a MAIN lift of that day's session; a loaded lift needs a weight, a bodyweight one takes none; `counts` comes from the
 * plan (deload / taper / race week / eased → false), never from the request.
 */
const S = vi.hoisted(() => ({
  isAdmin: true, stored: { plan_json: null as unknown, recovery_eases: {} as Record<string, string> },
  upserts: [] as Record<string, unknown>[], upsertError: null as null | { message: string; code?: string },
  missingReps: false,
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
        upsert: async (row: Record<string, unknown>) => {
          S.upserts.push(row)
          if (S.missingReps && 'reps' in row) return { error: { message: "Could not find the 'reps' column", code: 'PGRST204' } }
          return { error: S.upsertError }
        },
      })
      return q
    },
  }),
}))

import { generateStrengthPlan, isLoadedLift, type StrengthPlan } from '@/packages/strength'
const plan: StrengthPlan = generateStrengthPlan({ focus: 'running', session_minutes: 60, sessions_per_week: 2, equipment: ['dumbbells', 'bench'], experience: 'regular' }, null, { standaloneStart: '2026-11-02' })
const withMain = plan.weeks.flatMap(w => w.sessions).find(s => s.date && s.blocks.some(b => b.role === 'main' && b.items.some(i => isLoadedLift(i.exercise_id))))!
const loadedId = withMain.blocks.find(b => b.role === 'main')!.items.find(i => isLoadedLift(i.exercise_id))!.exercise_id
const accessoryId = withMain.blocks.find(b => b.role === 'accessory')?.items[0]?.exercise_id
const post = async (body: unknown) => {
  const { POST } = await import('@/app/api/strength/log/route')
  const res = await POST(new Request('https://x/api/strength/log', { method: 'POST', body: JSON.stringify(body) }) as never)
  return { status: res.status, body: await res.json() }
}
beforeEach(() => { S.isAdmin = true; S.stored = { plan_json: plan, recovery_eases: {} }; S.upserts = []; S.upsertError = null; S.missingReps = false })

describe('POST /api/strength/log', () => {
  it('stores one row for the lift, counting it on a build week', async () => {
    const r = await post({ date: withMain.date, exercise_id: loadedId, load_kg: 22.5, feel: 'right' })
    expect(r.status).toBe(200)
    expect(S.upserts).toEqual([expect.objectContaining({ session_date: withMain.date, exercise_id: loadedId, load_kg: 22.5, feel: 'right', counts: true })])
  })
  it('🔴 an eased day logs, but never counts towards a step', async () => {
    S.stored = { plan_json: plan, recovery_eases: { [withMain.date!]: 'eased' } }
    await post({ date: withMain.date, exercise_id: loadedId, load_kg: 22.5, feel: 'easy' })
    expect(S.upserts[0].counts).toBe(false)
  })
  it('🔴 a deload week logs, but never counts', async () => {
    const deload: StrengthPlan = { ...plan, weeks: plan.weeks.map(w => w.sessions.some(s => s.date === withMain.date) ? { ...w, phase: 'deload' } : w) }
    S.stored = { plan_json: deload, recovery_eases: {} }
    await post({ date: withMain.date, exercise_id: loadedId, load_kg: 22.5, feel: 'easy' })
    expect(S.upserts[0].counts).toBe(false)
  })
  it('🔴 a loaded lift needs a weight; a lift not in the session, or an accessory, is refused', async () => {
    expect((await post({ date: withMain.date, exercise_id: loadedId, load_kg: null, feel: 'right' })).status).toBe(422)
    expect((await post({ date: withMain.date, exercise_id: 'back_squat_nope', load_kg: null, feel: 'right' })).status).toBe(404)
    expect((await post({ date: '2026-10-01', exercise_id: loadedId, load_kg: 20, feel: 'right' })).status).toBe(404)
    expect(accessoryId).toBeDefined()
    expect((await post({ date: withMain.date, exercise_id: accessoryId!, load_kg: isLoadedLift(accessoryId!) ? 10 : null, feel: 'right' })).status).toBe(404)
    expect((await post({ date: withMain.date, exercise_id: loadedId, load_kg: 900, feel: 'right' })).status).toBe(422)
    expect((await post({ date: withMain.date, exercise_id: loadedId, load_kg: 20, feel: 'maybe' })).status).toBe(422)
    expect(S.upserts).toEqual([])
  })
  it('🔴 STRENGTH-LOG-REPS-01: the row carries the reps the stored plan prescribed that lift on that date, never the request\'s', async () => {
    const prescribed = withMain.blocks.find(b => b.role === 'main')!.items.find(i => i.exercise_id === loadedId)!.reps
    expect(prescribed).toBeGreaterThan(0)
    const r = await post({ date: withMain.date, exercise_id: loadedId, load_kg: 22.5, feel: 'right', reps: 99 })
    expect(S.upserts[0].reps).toBe(prescribed)
    expect(r.body.reps).toBe(prescribed)
  })
  it('🔴 before the migration is applied, the log is still saved (without reps); any other failure is still a 500', async () => {
    S.missingReps = true
    const r = await post({ date: withMain.date, exercise_id: loadedId, load_kg: 22.5, feel: 'right' })
    expect(r.status).toBe(200)
    expect(S.upserts.length).toBe(2)
    expect('reps' in S.upserts[1]).toBe(false)
    S.missingReps = false; S.upserts = []; S.upsertError = { message: 'boom', code: '23505' }
    expect((await post({ date: withMain.date, exercise_id: loadedId, load_kg: 22.5, feel: 'right' })).status).toBe(500)
    expect(S.upserts.length).toBe(1)
  })
  it('🔴 a reps outside the column\'s range is stored as null, never a failed save', async () => {
    const odd: StrengthPlan = { ...plan, weeks: plan.weeks.map(w => ({ ...w, sessions: w.sessions.map(s => s.date !== withMain.date ? s : { ...s, blocks: s.blocks.map(b => ({ ...b, items: b.items.map(i => i.exercise_id === loadedId ? { ...i, reps: 60 } : i) })) }) })) }
    S.stored = { plan_json: odd, recovery_eases: {} }
    const r = await post({ date: withMain.date, exercise_id: loadedId, load_kg: 22.5, feel: 'right' })
    expect(r.status).toBe(200)
    expect('reps' in S.upserts[0]).toBe(false)
  })
  it('🔴 non-admin → 404 while strength is admin-only; a failed write is a 500', async () => {
    S.isAdmin = false
    expect((await post({ date: withMain.date, exercise_id: loadedId, load_kg: 20, feel: 'right' })).status).toBe(404)
    S.isAdmin = true; S.upsertError = { message: 'boom' }
    expect((await post({ date: withMain.date, exercise_id: loadedId, load_kg: 20, feel: 'right' })).status).toBe(500)
  })
})
