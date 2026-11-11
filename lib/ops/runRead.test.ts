import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { countRunsRead, latestRunRead, trialWindow } from './runRead'
import { TRIAL_DAYS } from '@/lib/trial'

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

describe('ACT-READ-COUNT-01 — trialWindow', () => {
  it('is TRIAL_DAYS wide and half-open', () => {
    const w = trialWindow('2026-09-23T00:00:00.000Z', TRIAL_DAYS)!
    expect(w.to.getTime() - w.from.getTime()).toBe(TRIAL_DAYS * 24 * 60 * 60 * 1000)
  })

  it('returns null for a missing or unparseable start, so a caller cannot invent a trial', () => {
    expect(trialWindow(null, TRIAL_DAYS)).toBeNull()
    expect(trialWindow(undefined, TRIAL_DAYS)).toBeNull()
    expect(trialWindow('not a date', TRIAL_DAYS)).toBeNull()
  })
})

describe('ACT-READ-COUNT-01 — the trial email consumes the owner', () => {
  // ⚠️ The owner is only worth having if the one site that had the defect actually calls it. A
  // route needs auth, a service-role client and a cron secret, so this arm is source-shaped and
  // declared as such — but it reads the SHAPE that failed, not a comment.
  const route = readFileSync('app/api/email/send-trial/route.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

  it('calls countRunsRead and passes a trial window', () => {
    expect(route).toMatch(/countRunsRead\(/)
    expect(route).toMatch(/trialWindow\(trialStartedAt,\s*TRIAL_DAYS\)/)
  })

  it('no longer hand-rolls the capped query', () => {
    expect(route, 'the .limit(10) read-count cap is back').not.toMatch(/\.limit\(10\)/)
    expect(route, 'rows.length as a total is the defect this item closed').not.toMatch(/analysedRunCount:\s*rows\.length/)
  })
})
