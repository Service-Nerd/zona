import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { isSupabaseAppUserId } from './revenuecatEvents'

/**
 * `OPS-ANON-USER-ID-01` (2026-10-15) — a webhook id may not reach `ops_events.user_id`
 * without being validated as a UUID.
 *
 * 🔴 FOUND IN A PRODUCTION POSTGRES LOG, NOT BY A TEST.
 * `22P02 invalid input syntax for type uuid: "$RCAnonymousID:03bbc78dfb1947d59972ec037ed47618"`
 *
 * `ops_events.user_id` is a **UUID** (`20260722_ops_events.sql:19`). A runner who
 * redeems an offer code before installing boots signed out, so RevenueCat gives them
 * `$RCAnonymousID:...` and fires `INITIAL_PURCHASE` carrying it. The route's
 * anonymous-id guard handles that correctly and passes `null` — **but the
 * unhandled-event-type branch runs 20 lines EARLIER and passed the raw id.**
 *
 * ⚠️ AND IT FAILS SILENTLY, WHICH IS THE WHOLE COST. `recordOpsEvent` only
 * `console.error`s, so the insert is lost and the route still answers 200. The comment
 * on that very branch says it exists because *"this branch used to be silent, which is
 * how a comp grant could fail with no trace at all. If a charity runner reports a
 * paywall they should not be seeing, look here first."* With 500 charity codes to go
 * out, the branch written to end silent failures was silent again for exactly that
 * cohort.
 *
 * 🔑 **The remedy had been applied to ONE OF TWO WRITERS** — the guard below passed
 * `null`, this one did not. Nth instance of that class in this repo, and it is why the
 * arm here is a POPULATION check rather than a check on the one line that broke.
 */

const ROUTE = 'app/api/webhooks/revenuecat/route.ts'

/** Comments are prose — the route's own notes quote the anonymous id deliberately. */
const code = (path: string) => readFileSync(path, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')

describe('OPS-ANON-USER-ID-01 — the guard rejects the real production id', () => {
  it('rejects the exact value from the Postgres log', () => {
    // Not a synthetic string: this is the id that actually failed, 2026-10-15 11:08:56Z.
    expect(isSupabaseAppUserId('$RCAnonymousID:03bbc78dfb1947d59972ec037ed47618')).toBe(false)
  })

  it('accepts a real Supabase user id, so the guard is not simply always-false', () => {
    // An always-false predicate would pass the arm above and break every real event.
    expect(isSupabaseAppUserId('3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d')).toBe(true)
  })
})

describe('🔴 OPS-ANON-USER-ID-01 — the POPULATION: no raw webhook id reaches a UUID column', () => {
  /**
   * ⚠️ DERIVED FROM THE CODE, NEVER HAND-TYPED. A hand-typed list of call sites is how
   * `sheetClose.test.ts` stayed green while missing the four sheets that mattered — and
   * a hand-typed list here would have contained the guard (which was right) and not the
   * unhandled branch (which was wrong), because I only knew about the one I had read.
   *
   * Every `recordOpsEvent(` call in the route is found, and any that names
   * `app_user_id` in its third argument must route it through `isSupabaseAppUserId`.
   */
  const recordCalls = (src: string): string[] => {
    const out: string[] = []
    const re = /recordOpsEvent\(/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src)) !== null) {
      // Walk to the matching close paren so a multi-line call is one region. A
      // character budget is not a region — that mistake has been made three times
      // in this repo and caused a file to fall out of its own population.
      let depth = 0
      let i = m.index + 'recordOpsEvent'.length
      const start = i
      for (; i < src.length; i++) {
        if (src[i] === '(') depth++
        else if (src[i] === ')') { depth--; if (depth === 0) break }
      }
      out.push(src.slice(start, i + 1))
    }
    return out
  }

  it('finds a real population of recordOpsEvent calls, so nothing passes vacuously', () => {
    const calls = recordCalls(code(ROUTE))
    expect(
      calls.length,
      'no recordOpsEvent calls parsed out of the route — the reader is broken, not the ' +
      'route. An empty population passes every other assertion in this file.',
    ).toBeGreaterThan(3)
  })

  it('🔴 every call that names app_user_id validates it first', () => {
    const offenders = recordCalls(code(ROUTE))
      .filter(c => c.includes('app_user_id'))
      // The id may appear in `detail` as a shape string, which is a TEXT field and safe.
      // What must never happen is an unvalidated id in the USER-ID position.
      .filter(c => /,\s*rc\.app_user_id\s*(\?\?\s*null\s*)?\)/.test(c))

    expect(
      offenders,
      `a recordOpsEvent call passes rc.app_user_id straight into ops_events.user_id, ` +
      `which is a UUID: ${offenders.join(' | ')}. An offer-code runner arrives as ` +
      `"$RCAnonymousID:..." and the insert fails with 22P02 — silently, because ` +
      `recordOpsEvent only console.errors. Validate with isSupabaseAppUserId first.`,
    ).toEqual([])
  })

  it('and the route still imports the validator it needs', () => {
    expect(code(ROUTE)).toMatch(/isSupabaseAppUserId/)
  })
})
