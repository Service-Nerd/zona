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
  updates: [] as { table: string; row: Record<string, unknown>; filters: Record<string, unknown> }[],
  events: [] as { kind: string; detail: Record<string, unknown> }[],
  adjustment: null as Record<string, unknown> | null,
  readError: null as string | null,
  failWrite: null as string | null,
  // CONFIRM-REVERT-WRITE-ERRORS-01 — a conditional update on this table matches 0 rows, which is
  // what a concurrent answer looks like from here. `observedStatus` is what the read-back finds.
  conflictTable: null as string | null,
  observedStatus: 'reverted' as string | null,
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
      const readFilters: Record<string, unknown> = {}
      const q: Record<string, unknown> = {}
      const chain = () => q
      Object.assign(q, {
        select: chain, is: chain,
        eq: (col: string, val: unknown) => { readFilters[col] = val; return q },
        single: async () => table === 'plan_adjustments'
          ? { data: S.adjustment, error: null }
          : { data: { plan_json: { meta: {}, weeks: [{ n: 3, sessions: {} }] } }, error: null },
        // The conflict read-back: `applyAnsweredProposal` asks what the row actually holds so
        // the event can name it. Only reached when a conditional update matched nothing.
        maybeSingle: async () => ({ data: { status: S.observedStatus }, error: null }),
        // 🔴 THE WRITE IS A THENABLE, because two shapes are awaited in this codebase and the
        // mock has to serve both: the week-not-found branch awaits `.update().eq()` directly,
        // while `applyAnsweredProposal` awaits `.update().eq().eq().select()`. A mock that only
        // answered the first is what made this suite unable to see the defect it now guards.
        update: (row: Record<string, unknown>) => {
          const filters: Record<string, unknown> = {}
          // 🔴 WHETHER `.select()` WAS CALLED IS TRACKED, AND THE FIRST VERSION OF THIS MOCK DID
          // NOT TRACK IT — so `.select('id')` was unobservable and deleting it from the owner
          // left all 24 arms GREEN (code review, 2026-11-25). PostgREST returns NO ROWS from an
          // `UPDATE` without a `select()`, so in production that mutation makes `rowRes.data`
          // null on every update, `!rowRes.data?.length` always true, and **every successful
          // confirm/revert logs a conflict, returns `transition: 'conflict'` and never clears
          // `last_adjustment_check_found_change`** — the Me-screen "1 change suggested" defect
          // `PROFILE-ADJ-01` fixed, back again. A mock that answers the same either way is a
          // gate that cannot fail.
          let selected = false
          const settle = () => {
            S.updates.push({ table, row, filters: { ...filters } })
            if (S.failWrite === table) return { data: null, error: { message: 'boom' } }
            if (!selected) return { data: null, error: null }
            // A conditional update (one carrying a `status` filter) can match nothing.
            if (S.conflictTable === table && 'status' in filters) return { data: [], error: null }
            return { data: [{ id: filters.id ?? 'a1' }], error: null }
          }
          const w: Record<string, unknown> = {}
          Object.assign(w, {
            eq: (col: string, val: unknown) => { filters[col] = val; return w },
            select: () => { selected = true; return w },
            then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
              Promise.resolve(settle()).then(ok, bad),
          })
          return w
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
  S.saveThrows = false; S.saved = 0; S.updates = []; S.events = []; S.readError = null; S.failWrite = null
  S.conflictTable = null; S.observedStatus = 'reverted'
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

    it(`🔴 ADJUST-WEEK-COORD-01 — a row whose week the plan does not carry: the plan is never saved`, async () => {
      // The plan carries only n = 3. Before the fix both routes SAVED the unchanged plan and marked
      // the row. Confirm now refuses ("confirmed" would claim the change is in the plan); revert
      // resolves the row without a save ("reverted" claims it is not, which is true), so a pending
      // row can never be stranded with both answers refused.
      S.adjustment = { ...S.adjustment, week_n: 6 }
      const res = await call(route)
      expect(S.saved, 'the plan was saved for a week that does not exist').toBe(0)
      const body = await res.json()
      expect(body.reason).toBe('week_not_found')
      if (route === 'confirm-adjustment') {
        expect(res.status).toBe(409)
        expect(S.updates, 'a row was marked confirmed for a change applied nowhere').toEqual([])
      } else {
        expect(res.status).toBe(200)
        expect(S.updates.find(u => u.table === 'plan_adjustments')?.row).toMatchObject({ status: 'reverted' })
      }
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

describe('ADJUST-WEEK-COORD-01 code review — week-not-found writes', () => {
  it('🔴 revert: a failed row write is 500 and the Me flag is NOT touched', async () => {
    S.adjustment = { ...S.adjustment, week_n: 6 }; S.failWrite = 'plan_adjustments'
    const res = await call('revert-adjustment')
    expect(res.status).toBe(500)
    expect(S.updates.map(u => u.table)).toEqual(['plan_adjustments'])
    expect(S.events.map(e => e.kind)).toEqual(['adjustment_week_not_found'])
  })
  it('revert: a failed flag write still resolves (200) and is recorded', async () => {
    S.adjustment = { ...S.adjustment, week_n: 6 }; S.failWrite = 'user_settings'
    const res = await call('revert-adjustment')
    expect(res.status).toBe(200)
    expect(S.events[0].detail).toMatchObject({ flag_error: 'boom' })
  })
  it('confirm: a missing week is recorded', async () => {
    S.adjustment = { ...S.adjustment, week_n: 6 }
    await call('confirm-adjustment')
    expect(S.events.map(e => e.kind)).toEqual(['adjustment_week_not_found'])
  })
})

/**
 * CONFIRM-REVERT-WRITE-ERRORS-01 (2026-11-25) — the writes AFTER the save are read, the
 * transition is conditional, and what could not be done is recorded.
 *
 * 🔴 WHY THESE ARMS DID NOT EXIST. The suite above already had a `failWrite` lever and used it
 * on the week-not-found branch ONLY. The happy-path branch ran its two writes in a bare
 * `await Promise.all([...])` whose result was discarded, so there was nothing for a test to
 * assert and nothing for the mock to answer — `.update().eq()` was the whole chain it served.
 * The hole was in the mock as much as in the assertions.
 *
 * ⚠️ EVERY ARM HERE EXPECTS 200. The plan is saved before the transition runs, so a non-200
 * would tell the runner a change failed that actually applied. The divergence belongs in an
 * event, not in the response.
 */
describe('CONFIRM-REVERT-WRITE-ERRORS-01 — the transition is checked, conditional and recorded', () => {
  for (const [route, status] of [['confirm-adjustment', 'confirmed'], ['revert-adjustment', 'reverted']] as const) {
    it(`${route}: the status update is CONDITIONAL on the status that was read`, async () => {
      await call(route)
      const row = S.updates.find(u => u.table === 'plan_adjustments')
      expect(row?.row).toMatchObject({ status })
      // Without this filter a concurrent answer is overwritten in silence. `pending` is what
      // `beforeEach` sets and what the route read.
      expect(row?.filters, `${route} updated the row by id alone, so two answers can race`)
        .toMatchObject({ id: 'a1', status: 'pending' })
    })

    it(`🔴 ${route}: a failed row write is 200, retried once, and RECORDED`, async () => {
      S.failWrite = 'plan_adjustments'
      const res = await call(route)
      expect(res.status, 'the plan saved, so the request must not report failure').toBe(200)
      expect(S.saved).toBe(1)
      // Two attempts: the write, then one retry, because the realistic failure is transient.
      expect(S.updates.filter(u => u.table === 'plan_adjustments')).toHaveLength(2)
      // The flag is never written once the row has failed — the row decides retryability.
      expect(S.updates.some(u => u.table === 'user_settings')).toBe(false)
      const ev = S.events.find(e => e.kind === 'proposal_transition_incomplete')
      expect(ev, 'the plan changed and the row did not, with nothing recorded').toBeTruthy()
      expect(ev!.detail).toMatchObject({ route, table: 'plan_adjustments', answer: status, outcome: 'row_write_failed', week_n: 3 })
    })

    it(`🔴 ${route}: a CONFLICT leaves the row alone, names what it holds, and is 200`, async () => {
      // ⚠️ The observed status must DIFFER from this route's own answer. A row already holding
      // our answer is the retry-landed case below, not a conflict — getting that fixture wrong
      // is how the two branches would be tested as one.
      S.conflictTable = 'plan_adjustments'
      S.observedStatus = status === 'reverted' ? 'confirmed' : 'reverted'
      const res = await call(route)
      expect(res.status).toBe(200)
      expect(S.saved).toBe(1)
      const ev = S.events.find(e => e.kind === 'proposal_transition_incomplete')
      expect(ev!.detail).toMatchObject({
        outcome: 'conflict', observed_status: status === 'reverted' ? 'confirmed' : 'reverted', answer: status,
      })
      // A conflict means somebody else resolved it, so clearing the Me flag here would hide
      // whatever they left behind.
      expect(S.updates.some(u => u.table === 'user_settings')).toBe(false)
    })

    it(`🔴 ${route}: a retry whose FIRST attempt landed is NOT a conflict, and the flag is still cleared`, async () => {
      // The hazard the retry itself creates: attempt 1 commits in Postgres, its response is
      // lost, the retry's status predicate now matches 0 rows because the status has already
      // moved. Reported as a conflict, the flag would be skipped and Me would keep claiming a
      // change is pending while the row and the plan both say it is done.
      S.conflictTable = 'plan_adjustments'; S.observedStatus = status
      const res = await call(route)
      expect(res.status).toBe(200)
      const ev = S.events.find(e => e.kind === 'proposal_transition_incomplete')
      expect(ev!.detail).toMatchObject({ outcome: 'retry_landed_first_attempt', observed_status: status })
      expect(S.updates.find(u => u.table === 'user_settings')?.row,
        'the transition landed and the Me flag was skipped anyway').toMatchObject({ last_adjustment_check_found_change: false })
    })

    it(`${route}: a failed FLAG write still transitions the row, and is recorded`, async () => {
      S.failWrite = 'user_settings'
      const res = await call(route)
      expect(res.status).toBe(200)
      expect(S.updates.find(u => u.table === 'plan_adjustments')?.row).toMatchObject({ status })
      const ev = S.events.find(e => e.kind === 'proposal_transition_incomplete')
      expect(ev!.detail).toMatchObject({ outcome: 'flag_write_failed' })
    })
  }

  it('🔴 revert-adjustment passes the status it READ, so revert-after-confirm is not a conflict', async () => {
    // The route refuses only a row already `reverted`, so a `confirmed` row is a legitimate
    // revert. Hardcoding `fromStatus: 'pending'` would make every one of those report a
    // conflict and leave the row claiming the change is still applied.
    S.adjustment = { ...S.adjustment, status: 'confirmed' }
    const res = await call('revert-adjustment')
    expect(res.status).toBe(200)
    expect(S.updates.find(u => u.table === 'plan_adjustments')?.filters).toMatchObject({ status: 'confirmed' })
    expect(S.events.filter(e => e.kind === 'proposal_transition_incomplete')).toEqual([])
  })
})
