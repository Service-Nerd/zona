// STRAVA-SOR-REVIEW-FIX-03 — a recording stand-in for the supabase-js query builder, shared by the Strava SOR tests (lib/strava/*.test.ts).
// Every chain is recorded as one query; `resolve` decides what it returns. Thenable, so `await q` and `.maybeSingle()`
// both work.
export interface FakeQuery {
  table: string
  op: 'select' | 'update' | 'delete' | 'upsert' | 'insert'
  cols?: string
  filters: Record<string, unknown>
  patch?: unknown
}
export type Resolver = (q: FakeQuery) => { data?: unknown; error?: { message: string } | null }

export function fakeDb(resolve: Resolver) {
  const log: FakeQuery[] = []
  const db = {
    log,
    from(table: string) {
      const q: FakeQuery = { table, op: 'select', filters: {} }
      log.push(q)
      const run = () => Promise.resolve({ data: null, error: null, ...resolve(q) })
      const one = () => run().then(r => ({ ...r, data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data }))
      const b: Record<string, unknown> = {
        select: (cols?: string) => { if (q.op === 'select') q.cols = cols; return b },
        update: (p: unknown) => { q.op = 'update'; q.patch = p; return b },
        upsert: (p: unknown) => { q.op = 'upsert'; q.patch = p; return b },
        insert: (p: unknown) => { q.op = 'insert'; q.patch = p; return b },
        delete: () => { q.op = 'delete'; return b },
        eq: (k: string, v: unknown) => { q.filters[k] = v; return b },
        is: (k: string, v: unknown) => { q.filters[k] = v; return b },
        match: (m: Record<string, unknown>) => { Object.assign(q.filters, m); return b },
        gte: () => b, lte: () => b, lt: () => b, order: () => b, limit: () => b,
        maybeSingle: one, single: one,
        then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => run().then(ok, bad),
      }
      return b
    },
  }
  return db
}
