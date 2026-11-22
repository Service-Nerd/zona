import { describe, it, expect } from 'vitest'
import { mirrorAvgHrToCompletion } from './completionHrMirror'

/** A chain recorder: every filter the code applies is captured, and the final `.select` resolves to `result`. */
function fake(result: { data: unknown; error: unknown }) {
  const calls: { op: string; args: unknown[] }[] = []
  const chain: Record<string, (...a: unknown[]) => unknown> = {}
  for (const op of ['from', 'update', 'eq', 'is']) chain[op] = (...args: unknown[]) => { calls.push({ op, args }); return chain }
  chain.select = (...args: unknown[]) => { calls.push({ op: 'select', args }); return Promise.resolve(result) }
  return { db: chain as never, calls }
}

describe('SESSION-COMPLETION-AVG-HR-STALE-01 — mirrorAvgHrToCompletion', () => {
  it('🔴 fills a NULL avg_hr on the LIVE completion for this user and this run, and nothing else', async () => {
    const { db, calls } = fake({ data: [{ week_n: 5 }], error: null })
    const r = await mirrorAvgHrToCompletion(db, 'u1', 'HK-1', 153.4)
    expect(r.updated).toBe(true)
    const eqs = calls.filter(c => c.op === 'eq').map(c => `${c.args[0]}=${c.args[1]}`)
    const nulls = calls.filter(c => c.op === 'is').map(c => `${c.args[0]}:${c.args[1]}`).sort()
    expect(eqs).toEqual(['user_id=u1', 'apple_health_uuid=HK-1'])
    // only a NULL is filled (a manual log is never overwritten) and only the LIVE row is touched
    expect(nulls).toEqual(['avg_hr:null', 'superseded_at:null'])
    expect(calls.find(c => c.op === 'update')!.args[0]).toMatchObject({ avg_hr: 153 })
  })
  it('no HR, a zero or a non-finite value writes nothing at all', async () => {
    for (const v of [null, undefined, 0, -4, Number.NaN]) {
      const { db, calls } = fake({ data: [], error: null })
      expect((await mirrorAvgHrToCompletion(db, 'u1', 'HK-1', v)).updated).toBe(false)
      expect(calls).toHaveLength(0)
    }
  })
  it('a database error is reported as not updated and never thrown', async () => {
    const { db } = fake({ data: null, error: { message: 'boom' } })
    expect((await mirrorAvgHrToCompletion(db, 'u1', 'HK-1', 150)).updated).toBe(false)
  })
  it('no matching live row (nothing linked yet) is a clean false', async () => {
    const { db } = fake({ data: [], error: null })
    expect((await mirrorAvgHrToCompletion(db, 'u1', 'HK-1', 150)).updated).toBe(false)
  })
})
