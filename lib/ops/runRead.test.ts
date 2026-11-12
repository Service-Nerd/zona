import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { countRunsRead, latestRunRead, trialWindow } from './runRead'
import { resolveTrialWindow, TRIAL_DAYS, TRIAL_MAX_DAYS_FROM_START } from '@/lib/trial'

/**
 * ACT-READ-COUNT-01 — the owner of "run read", and the two defects it closes.
 *
 * ⚠️ BEHAVIOURAL, NOT SOURCE-SHAPED. `vitest.config.ts` is `environment: 'node'`, but nothing here
 * needs a DOM: a chainable stub records exactly which PostgREST calls were issued, which is the
 * only way to assert "no limit" and "the window was applied" rather than asserting on a comment.
 */

interface Call { method: string; args: unknown[] }

function stub(result: { data?: unknown[]; count?: number; error?: { message: string } }) {
  const calls: Call[] = []
  const builder: Record<string, unknown> = {}
  const chain = (method: string) => (...args: unknown[]) => { calls.push({ method, args }); return builder }
  for (const m of ['select', 'eq', 'is', 'gte', 'lt', 'order', 'limit']) builder[m] = chain(m)
  // `await`ing the builder resolves the PostgREST result.
  builder.then = (res: (v: unknown) => unknown) =>
    Promise.resolve({ data: result.data ?? null, count: result.count ?? null, error: result.error ?? null }).then(res)
  return {
    calls,
    client: { from: (t: string) => { calls.push({ method: 'from', args: [t] }); return builder } },
  }
}

const had = (calls: Call[], method: string) => calls.filter(c => c.method === method)

describe('ACT-READ-COUNT-01 — countRunsRead', () => {
  it('returns the EXACT count and never a row length, so there is no cap to forget', async () => {
    // 🔴 The defect: `.limit(10)` then `rows.length` reported 10 for a runner with more. Here the
    // stub returns NO rows and a count of 23 — the old shape would answer 0.
    const s = stub({ data: [], count: 23 })
    expect(await countRunsRead(s.client, 'u1')).toBe(23)
  })

  it('issues a head count and NO limit', async () => {
    const s = stub({ count: 4 })
    await countRunsRead(s.client, 'u1')
    expect(had(s.calls, 'limit'), 'a limit on the count is the capped-total defect').toHaveLength(0)
    const sel = had(s.calls, 'select')[0]
    expect(sel.args[1]).toMatchObject({ count: 'exact', head: true })
  })

  it('counts only LIVE analyses — superseded rows belong to a replaced plan week', async () => {
    const s = stub({ count: 0 })
    await countRunsRead(s.client, 'u1')
    expect(had(s.calls, 'is').map(c => c.args)).toContainEqual(['superseded_at', null])
  })

  it('applies the window when given one, and does not when not', async () => {
    const from = new Date('2026-09-23T00:00:00.000Z')
    const to   = new Date('2026-10-07T00:00:00.000Z')
    const withW = stub({ count: 1 })
    await countRunsRead(withW.client, 'u1', { from, to })
    expect(had(withW.calls, 'gte')[0].args).toEqual(['created_at', from.toISOString()])
    expect(had(withW.calls, 'lt')[0].args).toEqual(['created_at', to.toISOString()])

    const without = stub({ count: 1 })
    await countRunsRead(without.client, 'u1')
    expect(had(without.calls, 'gte')).toHaveLength(0)
    expect(had(without.calls, 'lt')).toHaveLength(0)
  })

  it('THROWS on a read failure — a failed count is not "no runs read"', async () => {
    const s = stub({ error: { message: 'boom' } })
    await expect(countRunsRead(s.client, 'u1')).rejects.toThrow(/boom/)
  })
})

describe('ACT-READ-COUNT-01 — latestRunRead', () => {
  it('takes the newest live row', async () => {
    const row = { actual_load_km: 8.2, hr_in_zone_pct: 61, hr_above_ceiling_pct: 4, verdict: 'held', created_at: '2026-10-06T07:00:00.000Z' }
    const s = stub({ data: [row] })
    expect(await latestRunRead(s.client, 'u1')).toEqual(row)
    expect(had(s.calls, 'order')[0].args).toEqual(['created_at', { ascending: false }])
    expect(had(s.calls, 'limit')[0].args).toEqual([1])
    expect(had(s.calls, 'is').map(c => c.args)).toContainEqual(['superseded_at', null])
  })

  it('returns null, not undefined, when there is nothing', async () => {
    const s = stub({ data: [] })
    expect(await latestRunRead(s.client, 'u1')).toBeNull()
  })
})

describe('ACT-READ-COUNT-01 — trialWindow, which now takes the OWNER\u2019s answer', () => {
  // 🔴 IT USED TO TAKE `(trialStartedAt, trialDays)` AND BUILD `[stamp, stamp + 14)` ITSELF —
  // right for exactly as long as the trial began at signup. Under
  // `TRIAL_STARTS_AT_FIRST_READ` a runner whose first read lands on day 16 has a trial of
  // `[16, 30)`, and the day-14 email counted `[0, 14)` and told them **0 runs read** in the mail
  // asking them to pay for reads. These arms now pin the composition rather than the arithmetic.
  const start = new Date('2026-09-23T00:00:00.000Z')
  const plus = (d: number) => new Date(start.getTime() + d * 24 * 60 * 60 * 1000)

  it('spans the window the owner resolved, not a fortnight from the stamp', () => {
    const w = trialWindow(resolveTrialWindow({ trialStartedAt: start, firstReadAt: plus(5) }, plus(9), true))!
    expect(w.from.getTime(), 'the count must start at the READ, not the signup stamp').toBe(plus(5).getTime())
    expect(w.to.getTime()).toBe(plus(5 + TRIAL_DAYS).getTime())
  })

  it('🔑 and it is CLIPPED by the cap, which my first version of this arm got wrong', () => {
    // A read on day 16 does not buy a window to day 30: `endsAt = min(read + TRIAL_DAYS, cap)`
    // and the cap is `TRIAL_MAX_DAYS_FROM_START`. I asserted `16 + TRIAL_DAYS` and the gate
    // refused — **the composition is the thing being tested, so the cap has to be in it.**
    const w = trialWindow(resolveTrialWindow({ trialStartedAt: start, firstReadAt: plus(16) }, plus(18), true))!
    expect(w.from.getTime()).toBe(plus(16).getTime())
    expect(w.to.getTime()).toBe(plus(TRIAL_MAX_DAYS_FROM_START).getTime())
  })

  it('agrees with the old arithmetic under the OFF policy, to the millisecond', () => {
    const w = trialWindow(resolveTrialWindow({ trialStartedAt: start }, plus(1), false))!
    expect(w.from.getTime()).toBe(start.getTime())
    expect(w.to.getTime() - w.from.getTime()).toBe(TRIAL_DAYS * 24 * 60 * 60 * 1000)
  })

  it('🔑 a clock that has not started is NULL, never "all time"', () => {
    // No read yet: there is no read to count and no window to count it in. A caller that read
    // this as "no window" and counted the runner's whole history would be the exact defect
    // ACT-READ-COUNT-01 was filed for, one policy later.
    const w = resolveTrialWindow({ trialStartedAt: start, firstReadAt: null }, plus(5), true)
    expect(w.clockStartedAt).toBeNull()
    expect(trialWindow(w)).toBeNull()
  })

  it('returns null for no trial at all, so a caller cannot invent one', () => {
    expect(trialWindow(resolveTrialWindow({ trialStartedAt: null }, start))).toBeNull()
    expect(trialWindow({ clockStartedAt: null, endsAt: null })).toBeNull()
  })
})

describe('ACT-READ-COUNT-01 — the trial email consumes the owner', () => {
  // ⚠️ The owner is only worth having if the one site that had the defect actually calls it. A
  // route needs auth, a service-role client and a cron secret, so this arm is source-shaped and
  // declared as such — but it reads the SHAPE that failed, not a comment.
  const route = readFileSync('app/api/email/send-trial/route.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

  it('calls countRunsRead and passes a window built from the OWNER', () => {
    expect(route).toMatch(/countRunsRead\(/)
    // 🔴 THIS PINNED `trialWindow(trialStartedAt, TRIAL_DAYS)` AND THAT SHAPE WAS THE DEFECT one
    // policy later: it built a fortnight from the signup stamp, so with
    // `TRIAL_STARTS_AT_FIRST_READ` on it counted the wrong fortnight and told a runner who first
    // read on day 16 that we had read **0** of their runs. The arm pinned the shape precisely
    // enough to keep it — **a source arm holds whatever it was written against, including a
    // mistake.** It now pins the composition.
    expect(route).toMatch(/trialWindow\(\s*trial\s*\)/)
    expect(route, 'the window must come from resolveTrialWindow, not from the stamp')
      .toMatch(/resolveTrialWindow\(/)
    expect(route, 'the signup-stamp window is what this item closed')
      .not.toMatch(/trialWindow\(\s*(trialStartedAt|settings\.trial_started_at)/)
  })

  it('🔴 the batch first-read query is BOUNDED, and hitting the bound is a failure', () => {
    // Unbounded, a PostgREST max-rows truncation is indistinguishable from "these runners have
    // no reads": the error is null, the tail of the batch silently lands on the cap path and
    // nobody finds out. Found by code review of the item-7 wiring.
    // 🔴 THE FIRST VERSION OF THIS ARM WAS HOLLOW AND A MUTATION CAUGHT IT. It asserted the
    // constant EXISTED and that the `>=` check existed — so deleting the `.limit()` line itself
    // left both in place and the arm stayed green over an unbounded query. **A ceiling that is
    // declared and not applied is the decorative-config class, in a test I had just written to
    // catch an unbounded read.** It now reads the limit ON THE CHAIN.
    expect(route, 'the ceiling must be applied to the query, not merely declared')
      .toMatch(/\.limit\(FIRST_READ_BATCH_MAX\)/)
    expect(route, 'reaching the ceiling must set firstReadFailed, not be read as absence')
      .toMatch(/>=\s*FIRST_READ_BATCH_MAX[\s\S]{0,400}firstReadFailed\s*=\s*true/)
  })

  it('no longer hand-rolls the capped query', () => {
    expect(route, 'the .limit(10) read-count cap is back').not.toMatch(/\.limit\(10\)/)
    expect(route, 'rows.length as a total is the defect this item closed').not.toMatch(/analysedRunCount:\s*rows\.length/)
  })
})
