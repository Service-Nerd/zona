import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

/**
 * PROFILE-NAME-WRITE-01 — measured 2026-11-04: of 46 users whose auth metadata carries a
 * `full_name`, 44 had an empty `user_settings.first_name`; only 3 rows of 52 ever held one.
 * The back-fill was a client-side `void supabase...upsert(...)` whose error was discarded.
 *
 * These arms are SOURCE assertions, and that is a weaker instrument than this repo likes —
 * a source assertion passes on a comment. They are bounded to the two facts a comment cannot
 * fake: that no `void`-swallowed write to user_settings remains in the client, and that the
 * server route reads the result of its own write.
 */
const CLIENT = path.join(process.cwd(), 'app/dashboard/DashboardClient.tsx')
const ROUTE  = path.join(process.cwd(), 'app/api/me/today-heartbeat/route.ts')

/**
 * A COLOUR INSIDE A COMMENT IS PROSE, and so is a code sample. The first cut of the
 * route arm grepped the whole file and fired on this very module's own explanatory
 * comment quoting the old `void supabase...` line. This repo has paid for that exact
 * shape in `.githooks/pre-commit` (HOOK-RGBA-COMMENTS-01); line numbers are preserved
 * so a failure still points somewhere real.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length))
}

describe('PROFILE-NAME-WRITE-01', () => {
  // FIX THE PAIR, NOT THE INSTANCE. The first run of this arm found THREE more
  // `void`-swallowed writes to the same table — trial_started_at, timezone and
  // orientation_seen — none of which were part of the reported bug. The arm is
  // deliberately scoped to the TABLE, not to the name columns, so it keeps finding them.
  it('no fire-and-forget write to user_settings survives in the dashboard client', () => {
    const src = stripComments(fs.readFileSync(CLIENT, 'utf8'))
    const lines = src.split('\n')
    const swallowed: string[] = []
    lines.forEach((l, i) => {
      if (!/\bvoid\s+supabase/.test(l) || !/user_settings/.test(l)) return
      // Statement-scoped, not line-scoped: the error handler is chained on the
      // following line. A line-only test reported these as unfixed after they were
      // fixed — the bounded region is the STATEMENT, never the line.
      const stmt = lines.slice(i, i + 3).join('\n')
      if (!/\.then\(\(\{\s*error\s*\}\)/.test(stmt)) swallowed.push(`${i + 1}: ${l.trim()}`)
    })
    expect(swallowed).toEqual([])
  })

  it('the server route back-fills the name and READS the error of its own write', () => {
    const src = stripComments(fs.readFileSync(ROUTE, 'utf8'))
    // Word-bounded, per GATE-FALSIFY-01: `toContain('first_name')` also passes
    // against 'first_nameX', which is the substring-bias shape this repo gates.
    expect(src).toMatch(/\bfirst_name\b/)
    expect(src).toMatch(/\buser_metadata\b/)
    expect(src).toMatch(/const \{ error \} = await supabase/)
    expect(src).toMatch(/if \(error\)/)
    // It must not fire-and-forget either.
    expect(src).not.toMatch(/\bvoid\s+supabase/)
  })

  it('it only fills EMPTY columns — a runner’s own Profile edit is never overwritten', () => {
    const src = fs.readFileSync(ROUTE, 'utf8')
    expect(src).toMatch(/if \(!current\?\.first_name && !current\?\.last_name\)/)
    expect(src).toMatch(/if \(!current\?\.email\)/)
  })
})

/**
 * The name-splitting rule itself, tested as a value rather than as source. Mirrors the
 * route's expression exactly; if that changes, this must change with it.
 */
function splitName(full: string): { first?: string; last?: string } {
  const t = full.trim()
  if (!t) return {}
  const parts = t.split(/\s+/)
  return parts.length > 1 ? { first: parts[0], last: parts.slice(1).join(' ') } : { first: parts[0] }
}

describe('PROFILE-NAME-WRITE-01 — the split', () => {
  it('handles the production shapes', () => {
    expect(splitName('Duncan Bennett')).toEqual({ first: 'Duncan', last: 'Bennett' })
    expect(splitName('  Ana   Maria de Souza ')).toEqual({ first: 'Ana', last: 'Maria de Souza' })
    expect(splitName('Cher')).toEqual({ first: 'Cher' })
    expect(splitName('   ')).toEqual({})
  })
})
