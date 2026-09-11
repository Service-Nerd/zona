// SEC-08 — a route that uses the user-scoped client must be covered by RLS.
//
// WHY THIS IS A TEST AND NOT A REVIEW NOTE. `createUserScopedClient` runs as the
// user, so RLS applies. A JWT client against a table with RLS enabled and no
// matching policy does NOT error — reads return zero rows and writes fail
// quietly. So converting a route wrongly, or adding one query to an
// already-converted route, produces a feature that looks fine and returns
// nothing. There is no symptom to notice later.
//
// The conversion is only safe because this check is mechanical. It runs on every
// build; the rollout report (`npm run check:db` + `scripts/rls-convertible-routes.ts`)
// is the human-facing half.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { RLS_POLICIES } from './rlsPolicyManifest'
import { extractTableUsage, withHelperUsage } from './routeTableUsage'

const ROOT = process.cwd()
const API = join(ROOT, 'app', 'api')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : /route\.tsx?$/.test(name) ? [p] : []
  })
}

const converted = walk(API)
  .map(file => ({ file, src: readFileSync(file, 'utf8') }))
  .filter(r => r.src.includes('createUserScopedClient'))

describe('user-scoped routes are covered by RLS policies', () => {
  it('finds the converted routes at all (guards the guard)', () => {
    // A zero-length list would make every assertion below pass vacuously, which
    // is how a check ends up dead on arrival. This repo has shipped that twice.
    expect(converted.length).toBeGreaterThan(0)
    expect(Object.keys(RLS_POLICIES).length).toBeGreaterThan(10)
  })

  it.each(converted.map(r => [relative(ROOT, r.file), r.src] as const))(
    '%s only touches tables its policies permit',
    (route, src) => {
      const { usage } = withHelperUsage(src, extractTableUsage(src))
      const violations: string[] = []

      for (const [table, ops] of Array.from(usage.entries())) {
        const allowed = RLS_POLICIES[table]
        if (!allowed) {
          violations.push(`${table}: not in the RLS manifest at all`)
          continue
        }
        const missing = Array.from(ops).filter(op => !allowed.includes(op))
        if (missing.length) {
          violations.push(
            `${table}: performs ${missing.join('+')}, policy allows ` +
            `[${allowed.join(',') || 'NOTHING — service role only'}]`,
          )
        }
      }

      expect(
        violations,
        `${route} uses the user-scoped client on operations RLS does not permit:\n` +
        violations.map(v => `  ${v}`).join('\n') +
        `\nUnder a JWT client these fail SILENTLY (reads return empty, writes no-op).\n` +
        `Either keep the service-role client for that call, or add the policy in a ` +
        `migration and update lib/supabase/rlsPolicyManifest.ts.`,
      ).toEqual([])
    },
  )

  // A `.from(someVariable)` cannot be checked statically, so a converted route
  // containing one is outside this guard's reach and must not pretend otherwise.
  it.each(converted.map(r => [relative(ROOT, r.file), r.src] as const))(
    '%s has no dynamically-named table access',
    (route, src) => {
      const { dynamicTableRefs } = extractTableUsage(src)
      expect(
        dynamicTableRefs,
        `${route} builds a table name dynamically, so its RLS coverage cannot be ` +
        `verified. Use a string literal, or keep the service-role client.`,
      ).toBe(0)
    },
  )
})
