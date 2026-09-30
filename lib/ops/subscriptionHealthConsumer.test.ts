import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// OPS-SUBS-HEALTH-CONSUMER-01 — THE GATE AGAINST THIS MODULE GOING INERT AGAIN.
//
// 🔴 `subscriptionHealth.ts` shipped on 2026-09-28 with NO consumer and stayed that
// way for two days while a handoff recorded it as "added to the dashboard". Its own
// tests were green throughout, because they test the RULE and nothing tests that
// anything READS the rule. That is the `configConsumer.test.ts` class: authored,
// ratified, documented, enforced — and unreachable.
//
// ⚠️ SO THIS DOES NOT TEST THE ROUTE. `vitest.config.ts` collects only
// `lib/**/*.test.ts` and `components/**/*.test.ts`, so a test beside the handler
// would never run — the same constraint that put `webhookTrace` in `lib/`. What it
// tests is the one property no other check can see: that the owner has a reader
// OUTSIDE its own directory. Delete the route and this goes red.
//
// ⚠️ It asserts a CONSUMER EXISTS, not that the consumer is correct. The verdict
// logic is `subscriptionHealth.test.ts`'s job; the digest routine's prose is not
// mechanically checkable from here at all, which is the residual named in the
// backlog item and the reason option 1 (route, not prompt) was the only real one.

const ROOT = join(__dirname, '..', '..')
const SEARCH_DIRS = ['app', 'components', 'scripts']
const OWNER = 'lib/ops/subscriptionHealth'

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try { entries = readdirSync(dir) } catch { return out }
  for (const e of entries) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p)
  }
  return out
}

const importers = SEARCH_DIRS
  .flatMap(d => walk(join(ROOT, d)))
  .filter(f => {
    const src = readFileSync(f, 'utf8')
    return src.includes("from '@/lib/ops/subscriptionHealth'")
        || src.includes('from "@/lib/ops/subscriptionHealth"')
  })
  .map(f => relative(ROOT, f))

describe('subscriptionHealth has a consumer', () => {
  it('is imported by at least one file outside lib/ops', () => {
    expect(
      importers,
      `Nothing reads ${OWNER}. A tested rule with no reader is a strongly-worded `
      + 'opinion: the money-critical definition would live only in the daily digest '
      + "routine's prose, where no check can reach it. Wire a consumer "
      + '(see OPS-SUBS-HEALTH-CONSUMER-01) rather than deleting this test.',
    ).not.toEqual([])
  })

  it('the ops route is one of them, and IMPORTS the verdict rather than re-deriving it', () => {
    const route = 'app/api/ops/subscription-health/route.ts'
    expect(importers).toContain(route)

    // ⚠️ ASSERTED AGAINST THE IMPORT BINDINGS, NOT THE FILE TEXT, and the first
    // cut of this test got that wrong. `toContain('judgeEntitlementRisk')` passes
    // when the identifier appears only in a COMMENT — and this file is heavily
    // commented, so that is not a hypothetical. `hollowTestShapes.test.ts` caught
    // it on the way in, which is the third time this repo has recorded the class:
    // bound the region, never grep the file.
    const src = readFileSync(join(ROOT, route), 'utf8')
    const block = src.match(
      /import\s*\{([^}]*)\}\s*from\s*['"]@\/lib\/ops\/subscriptionHealth['"]/,
    )
    expect(block, `${route} must import from the owner with a named-binding block`).not.toBeNull()
    const bound = block![1]
      .split(',')
      .map(b => b.replace(/^\s*type\s+/, '').trim())
      .filter(Boolean)

    // Re-deriving any of these in the route would recreate the drift the module
    // exists to prevent — a second copy of the rule, agreeing only by accident.
    // The carve-out is on the list too: a route deciding for itself which rows are
    // pre-signup would be TIER-OWNER-01's shape all over again.
    for (const sym of [
      'judgeEntitlementRisk', 'ENTITLEMENT_AT_RISK_KINDS',
      'AT_RISK_WINDOW_DAYS', 'isPreSignupRedemption', 'remedyFor',
    ]) {
      expect(bound, `${route} must take ${sym} from the owner, not restate it`).toContain(sym)
    }
  })

  it('the route does not hardcode the kind strings the owner already lists', () => {
    const src = readFileSync(join(ROOT, 'app/api/ops/subscription-health/route.ts'), 'utf8')
    // A literal kind in the query means the list has been copied, which is exactly
    // how the digest's Q9 and the module drifted apart in the first place.
    for (const literal of ["'stripe_event_unusable'", "'revenuecat_event_write_failed'"]) {
      expect(src, `${literal} is copied from the owner — read the array instead`).not.toContain(literal)
    }
  })
})
