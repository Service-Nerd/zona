import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * ADJUST-STATUS-WITHOUT-SAVE-01 (2026-10-16) — confirm/revert mark an adjustment done ONLY
 * after the plan save succeeds.
 *
 * 🔴 THE DEFECT. Both routes ran the save, the `plan_adjustments` status update and the
 * `user_settings` flag in ONE `Promise.all`. The siblings were already in flight when the
 * save rejected, so the row flipped to confirmed/reverted while the plan was unchanged,
 * the change card vanished on the next load, and nothing was recorded.
 *
 * ⚠️ THE ARM THAT MATTERS asserts the row DID NOT MOVE on a failed save. A happy-path test
 * proves nothing here: the happy path already worked. Both real routes are run; only I/O is
 * faked.
 */

const S = vi.hoisted(() => ({
  saveThrows: false,
  saved: 0,
  updates: [] as { table: string; row: Record<string, unknown> }[],
  events: [] as { kind: string; detail: Record<string, unknown> }[],
  adjustment: null as Record<string, unknown> | null,
  readError: null as string | null,
}))

vi.mock('@/lib/supabase/getUserFromRequest', () => ({ getUserFromRequest: async () => ({ id: 'u1' }) }))
vi.mock('@/lib/trial', () => ({ getUserTier: async () => 'paid' }))
vi.mock('@/lib/ops/recordOpsEvent', () => ({
  recordOpsEvent: async (kind: string, detail: Record<string, unknown>) => { S.events.push({ kind, detail }) },
}))
vi.mock('@/lib/plan', () => ({
  // PLANS-SINGLE-NOT-MAYBE-01 — the routes now read through the shared owner.
  readPlanJson: async () => S.readError
    ? { plan: null, error: S.readError }
    : { plan: { meta: {}, weeks: [{ n: 3, sessions: {} }] }, error: null },
  savePlanForUser: async () => {
    if (S.saveThrows) throw new Error('new row violates row-level security policy for table "plans"')
    S.saved++
  },
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {}
      const chain = () => q
      Object.assign(q, {
        select: chain, eq: chain, is: chain,
        single: async () => table === 'plan_adjustments'
          ? { data: S.adjustment, error: null }
          : { data: { plan_json: { meta: {}, weeks: [{ n: 3, sessions: {} }] } }, error: null },
        update: (row: Record<string, unknown>) => {
          S.updates.push({ table, row })
          return { eq: async () => ({ error: null }) }
        },
      })
      return q
    },
  }),
}))

// READINESS-WRONG-DAY-01 — a stored change is the whole week, Mon → Sun.
const REST = { type: 'rest', label: 'Rest' }
const SESSIONS_BEFORE = [REST, REST, REST, { type: 'quality', label: 'Tempo' }, REST, REST, REST]
const SESSIONS_AFTER  = [REST, REST, REST, { type: 'easy', label: 'Easy run' }, REST, REST, REST]

beforeEach(() => {
  S.saveThrows = false; S.saved = 0; S.updates = []; S.events = []; S.readError = null
  S.adjustment = { id: 'a1', user_id: 'u1', status: 'pending', week_n: 3, sessions_after: SESSIONS_AFTER, sessions_before: SESSIONS_BEFORE }
})

const call = async (route: 'confirm-adjustment' | 'revert-adjustment') => {
  const mod = route === 'confirm-adjustment'
    ? await import('@/app/api/confirm-adjustment/route')
    : await import('@/app/api/revert-adjustment/route')
  return mod.POST(new Request(`https://x/api/${route}`, {
    method: 'POST', body: JSON.stringify({ adjustment_id: 'a1' }),
  }) as never)
}

for (const [route, status] of [['confirm-adjustment', 'confirmed'], ['revert-adjustment', 'reverted']] as const) {
  describe(`ADJUST-STATUS-WITHOUT-SAVE-01 — ${route}`, () => {
    it(`🔴 a failed save leaves the adjustment PENDING and the Me flag untouched`, async () => {
      S.saveThrows = true
      const res = await call(route)
      expect(res.status).toBe(500)
      expect(S.updates, 'a status or flag was written although the plan was not').toEqual([])
    })

    it('a failed save is recorded, tagged with this route', async () => {
      S.saveThrows = true
      await call(route)
      expect(S.events).toHaveLength(1)
      expect(S.events[0].kind).toBe('plan_save_failed')
      expect(S.events[0].detail).toMatchObject({ route, week_n: 3 })
    })

    it('PLANS-SINGLE-NOT-MAYBE-01 — a failed plan READ is 500, never "No plan found", and nothing is written', async () => {
      S.readError = 'connection reset'
      const res = await call(route)
      expect(res.status).toBe(500)
      expect(S.saved).toBe(0)
      expect(S.updates).toEqual([])
    })

    it('🔴 READINESS-WRONG-DAY-01 — a one-session (pre-fix) row is REFUSED, never written to Monday', async () => {
      S.adjustment = { ...S.adjustment, sessions_after: [{ type: 'easy' }], sessions_before: [{ type: 'quality' }] }
      const res = await call(route)
      expect(res.status).toBe(409)
      expect(S.saved).toBe(0)
      expect(S.updates).toEqual([])
    })

    it(`a successful save marks it ${status} and clears the flag, and records nothing`, async () => {
      const res = await call(route)
      expect(res.status).toBe(200)
      expect(S.saved).toBe(1)
      expect(S.updates.find(u => u.table === 'plan_adjustments')?.row).toMatchObject({ status })
      expect(S.updates.find(u => u.table === 'user_settings')?.row).toMatchObject({ last_adjustment_check_found_change: false })
      expect(S.events).toEqual([])
    })
  })
}
