import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * §74 — a logged race result persists on submit. The reshape never gates the write.
 *
 * The founder logged a 100k, submitted, and saw nothing. Three faults in one
 * path: "keep my plan" made no network call, the reshape path only wrote
 * `result_embedded` on Accept, and no success path updated client state. For a
 * FINAL-WEEK race there is no reshape and therefore no Accept button to reach,
 * so the write appeared to do nothing at all.
 *
 * ⚠️ WHY THIS IS A SOURCE-ORDER TEST, WHICH IS NOT THE USUAL BAR.
 *
 * §74's claim is about ORDER inside one route handler: the write lands at the
 * boundary, before any branch. `embedRaceResult` is private to the route and
 * the handler needs Supabase auth, a service client and a fetched plan, so
 * there is no pure function to assert against. The alternatives were an
 * exemption (a rule with no check — the thing this whole exercise exists to
 * eliminate) or this.
 *
 * It reads like `configConsumer.test.ts`: substring-based, biased toward
 * passing, and unable to see a save that is present but unreachable. What it
 * CAN see is the regression that actually happened — the write moving behind
 * the optional decision — and that is the one worth a check.
 */
const ROUTE = join(process.cwd(), 'app', 'api', 'post-race-reshape', 'route.ts')
const src = readFileSync(ROUTE, 'utf8')

// Anchored on CALL SITES, never bare identifiers: the route imports
// `fetchPlanForUser` and `savePlanForUser` on the same line, so an indexOf on
// the bare name measures the import block and the slice below came back empty —
// a test that passed while reading nothing.
const at = (needle: string) => {
  const i = src.indexOf(needle)
  expect(i, `"${needle}" is no longer in the route — this test is now asserting nothing`).toBeGreaterThan(-1)
  return i
}

describe('§74 — the write is unconditional', () => {
  it('saves the result BEFORE the reshape is even computed', () => {
    // The ordering IS the principle. A save after `computePostRaceReshape`
    // reintroduces the final-week case where the result is silently discarded.
    expect(at('await savePlanForUser(')).toBeLessThan(at('computePostRaceReshape(plan'))
  })

  it('nothing returns between fetching the plan and saving the result', () => {
    // Except the "no plan found" guard, which is the one legitimate early exit:
    // there is nothing to embed the result into.
    const between = src.slice(at('await fetchPlanForUser('), at('await savePlanForUser('))
    const returns = between.match(/return NextResponse\.json\([^)]*/g) ?? []
    expect(returns.length, `unexpected early return before the write: ${returns.join(' | ')}`).toBe(1)
    expect(returns[0]).toContain('No plan found')
  })

  it('the save is not wrapped in the reshape decision', () => {
    // `offerReshape` is the "keep my plan as-is" flag. If it appears before the
    // save, the write has become contingent on the decision again.
    expect(at('await savePlanForUser('), 'the write sits behind the offerReshape branch')
      .toBeLessThan(at('const reshapeOutput'))
  })
})

describe('§74 — the client is handed the saved result', () => {
  it('the no-reshape response returns the result-embedded plan, not a bare flag', () => {
    // "Submitting always produces a visible outcome" — the surfacing IS the
    // acknowledgment (no popup, N-004). A `{ reshape_available: false }` with no
    // plan is what made a successful write look like nothing happening.
    const noReshape = src.slice(at("reshape_available: false"), at("reshape_available: false") + 200)
    expect(noReshape).toContain('plan: planWithResult')
  })

  it('embeds the result on the RACE week, keyed by week number', () => {
    expect(src).toMatch(/result_embedded:\s*result/)
    expect(src).toMatch(/i \+ 1 !== raceWeekN/)
  })
})
