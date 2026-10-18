import { describe, it, expect } from 'vitest'
import { savePlanForUser } from './plan'
import { WEEK_KEYED_TABLES } from './plan/supersede'
import type { Plan } from '@/types/plan'

/**
 * 🔴 SAVE-PATTERN-01 — how many network round trips does the runner WAIT ON, in sequence, when a plan saves?
 *
 * The founder watched "Saving…" on a phone for long enough to ask what it was doing. On a phone each sequential call
 * costs a round trip; independent calls run together cost one. This fake gives every call a LEVEL: one more than the
 * deepest call that had finished before it started. The deepest level is the number of waits in series.
 * Measured before the change: 4 on a same-calendar edit, 13 on a new calendar (the stamp alone was 7, one table at a
 * time).
 */
function makeClient(prior: Plan) {
  let finishedLevel = 0
  let maxLevel = 0
  const calls: string[] = []
  const call = (label: string, result: unknown) => {
    const level = finishedLevel + 1
    maxLevel = Math.max(maxLevel, level)
    calls.push(label)
    return new Promise(resolve => setTimeout(() => { finishedLevel = Math.max(finishedLevel, level); resolve(result) }, 5))
  }
  const client = {
    from(table: string) {
      let op = 'select'
      const b: any = {
        select() { return b }, eq() { return b }, gte() { return b }, is() { return b }, in() { return b },
        update() { op = 'update'; return b }, delete() { op = 'delete'; return b },
        maybeSingle() { return call(`${table}.read`, { data: table === 'plans' ? { plan_json: prior } : null, error: null }) },
        insert() { return call(`${table}.insert`, { error: null }) },
        upsert() { return call(`${table}.upsert`, { error: null }) },
        then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
          return call(`${table}.${op}`, { data: [], error: null }).then(resolve, reject)
        },
      }
      return b
    },
  }
  return { client: client as any, depth: () => maxLevel, calls }
}

const weeks = (start: string) => [0, 1, 2].map(i => ({ n: i + 1, date: new Date(Date.parse(start) + i * 7 * 86_400_000).toISOString().slice(0, 10), sessions: {} }))
const plan = (start: string) => ({ meta: { race_name: 'Brighton', race_date: '2027-04-11' }, weeks: weeks(start) } as unknown as Plan)

describe('savePlanForUser — round trips the runner waits on', () => {
  it('a same-calendar edit (a day swap): read, write, then the notes clear beside the grant check', async () => {
    const f = makeClient(plan('2026-11-02'))
    await savePlanForUser('u', plan('2026-11-02'), f.client)
    expect(f.depth()).toBe(3)
  })

  it('a new calendar: the archive and all seven stamps run together, so it costs two more, not ten', async () => {
    const f = makeClient(plan('2026-11-02'))
    await savePlanForUser('u', plan('2026-11-09'), f.client)
    expect(f.calls.filter(c => c.endsWith('.update'))).toHaveLength(WEEK_KEYED_TABLES.length)
    expect(f.depth()).toBe(5)
  })
})
