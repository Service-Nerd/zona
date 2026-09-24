import { describe, it, expect } from 'vitest'
import { claimAutoLink } from './autoAnalyse'

// Fake Supabase that enforces the session_completions live-row uniqueness on
// (user_id, week_n, session_day) and models the conditional attach-update.
// The atomic arbiter claimAutoLink relies on is now the `claim_session_completion`
// RPC (ON CONFLICT DO NOTHING): exactly one concurrent caller inserts and gets
// `true`, the rest get `false` WITHOUT raising 23505 — COMPLETION-CLAIM-NOLOG-01.
function makeFakeSupabase(seed: Record<string, any>[] = [], opts: { rpcError?: any } = {}) {
  const key = (r: any) => `${r.user_id}|${r.week_n}|${r.session_day}`
  const store = new Map<string, any>(seed.map(r => [key(r), { ...r }]))

  class FakeQuery {
    _patch: any = null
    _eq: Record<string, any> = {}
    _is: Record<string, any> = {}
    _neq: Record<string, any> = {}
    update(patch: any) { this._patch = patch; return this }
    select() { return this }
    eq(k: string, v: any) { this._eq[k] = v; return this }
    is(k: string, v: any) { this._is[k] = v; return this }
    neq(k: string, v: any) { this._neq[k] = v; return this }
    _resolve() {
      // update — locate the single targeted row and apply is/neq guards
      const k = `${this._eq.user_id}|${this._eq.week_n}|${this._eq.session_day}`
      const row = store.get(k)
      if (!row) return { data: [], error: null }
      for (const [f, v] of Object.entries(this._is)) if ((row[f] ?? null) !== v) return { data: [], error: null }
      for (const [f, v] of Object.entries(this._neq)) if (row[f] === v) return { data: [], error: null }
      Object.assign(row, this._patch)
      return { data: [{ week_n: row.week_n }], error: null }
    }
    maybeSingle() { return Promise.resolve(this._resolve()) }
    then(onF: any, onR: any) { return Promise.resolve(this._resolve()).then(onF, onR) }
  }

  return {
    from: (_t: string) => new FakeQuery(),
    // Atomic claim: DO NOTHING semantics. store.has/set run synchronously on
    // call, so three Promise.all'd claims serialise to exactly one `true`.
    rpc: (name: string, { p }: { p: any }) => {
      if (name !== 'claim_session_completion') {
        return Promise.resolve({ data: null, error: { code: '42883', message: 'no such fn' } })
      }
      if (opts.rpcError) return Promise.resolve({ data: null, error: opts.rpcError })
      const k = key(p)
      if (store.has(k)) return Promise.resolve({ data: false, error: null })
      store.set(k, { ...p })
      return Promise.resolve({ data: true, error: null })
    },
    _store: store,
  }
}

const hkRow = () => ({
  user_id: 'u1', week_n: 20, session_day: 'tue', status: 'complete',
  apple_health_uuid: 'AF886705', strava_activity_name: 'Run', strava_activity_km: 8, avg_hr: 147,
  updated_at: '2026-08-04T18:40:00Z',
})

describe('claimAutoLink — link-time push fires exactly once', () => {
  it('first claim wins', async () => {
    const sb = makeFakeSupabase()
    expect(await claimAutoLink(sb, hkRow())).toBe('won')
  })

  it('concurrent duplicate ingests: exactly one wins, the rest do not push', async () => {
    const sb = makeFakeSupabase()
    const results = await Promise.all([
      claimAutoLink(sb, hkRow()),
      claimAutoLink(sb, hkRow()),
      claimAutoLink(sb, hkRow()),
    ])
    expect(results.filter(r => r === 'won')).toHaveLength(1)
    expect(results.filter(r => r === 'exists')).toHaveLength(2)
  })

  it('already-linked row → exists (no push, no clobber)', async () => {
    const sb = makeFakeSupabase([hkRow()]) // row already present + linked
    expect(await claimAutoLink(sb, hkRow())).toBe('exists')
  })

  it('manual completion (complete, no link) → exists (respects the user)', async () => {
    const sb = makeFakeSupabase([
      { user_id: 'u1', week_n: 20, session_day: 'tue', status: 'complete', rpe: 6 },
    ])
    expect(await claimAutoLink(sb, hkRow())).toBe('exists')
  })

  it('unlinked non-complete stub → attached (analyse, but still no push)', async () => {
    const sb = makeFakeSupabase([
      { user_id: 'u1', week_n: 20, session_day: 'tue', status: 'planned' },
    ])
    expect(await claimAutoLink(sb, hkRow())).toBe('attached')
    // link was actually written onto the stub
    expect(sb._store.get('u1|20|tue').apple_health_uuid).toBe('AF886705')
  })

  it('unexpected DB error → exists (never push on uncertainty)', async () => {
    const sb = makeFakeSupabase([], { rpcError: { code: '42P01', message: 'boom' } })
    expect(await claimAutoLink(sb as any, hkRow())).toBe('exists')
  })
})
