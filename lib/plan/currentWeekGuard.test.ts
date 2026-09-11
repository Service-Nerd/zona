import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { getCurrentWeek } from '@/lib/plan'

/**
 * COACH-NULLWEEK-01 — the Coach screen must not dereference a week that is not there.
 *
 * `getCurrentWeek` falls back to `past ?? weeks[0]`, which for an EMPTY array is
 * `undefined ?? undefined`. `DashboardClient` calls it as
 * `getCurrentWeek(plan?.weeks ?? [])`, so a plan that loads with no weeks — or a
 * `weeks` key that is not an array — yields `undefined`.
 *
 * The Coach block then optional-chained it on one line and dereferenced it raw
 * on the next two:
 *     const wn = (currentWeek as any)?.n ?? …        // knew it could be null
 *     Object.entries((currentWeek as any).sessions ?? {})   // and then did not
 *     daysDueByEndOfYesterday((currentWeek as any).date)    // nor here
 *
 * Coach is the only screen that does this, which is why it presented as a
 * Coach-only crash while Today and Plan were fine.
 */

describe('getCurrentWeek — the undefined nobody guarded', () => {
  it('returns undefined for an empty plan, which is the whole bug', () => {
    expect(getCurrentWeek([] as never)).toBeUndefined()
  })

  it('still returns a week whenever there is one to return', () => {
    const weeks = [{ n: 1, date: '2020-01-06', sessions: {} }] as never
    expect(getCurrentWeek(weeks)).toBeDefined()
  })

  it('reproduces the exact crash the unguarded dereference produced', () => {
    const currentWeek = getCurrentWeek([] as never) as unknown as { sessions?: object }
    expect(() => Object.entries(currentWeek.sessions ?? {}))
      .toThrowError(/Cannot read properties of undefined \(reading 'sessions'\)/)
  })

  it('the Coach block now returns before it can dereference', () => {
    const src = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
    const coach = src.slice(src.indexOf("{screen === 'coach'"), src.indexOf('onOpenBenchmark={() => setScreen(\'benchmark\')}'))
    const guard = coach.indexOf('if (!currentWeek) return')
    const deref = coach.indexOf('(currentWeek as any).sessions')
    expect(guard, 'no null guard before the Coach week dereference').toBeGreaterThan(-1)
    expect(guard).toBeLessThan(deref)
  })
})
