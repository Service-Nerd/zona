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
  // 🔴 MATCH THE EFFECT, NOT THE SPELLING.
  //
  // The first cut of this arm tested `/\bvoid\s+supabase/`, which is ONE spelling of
  // "nobody reads the result". Code review found two more writes to this same table —
  // `onDynamicAdjustmentsChange` and `onDailyPushEnabledChange` — written
  // `await supabase.from('user_settings').upsert(...)` inside a `try {} catch {}`. Same
  // effect, different spelling, invisible to the arm written to find exactly that.
  //
  // So the population is every WRITE to the table, and the test is whether the statement
  // does anything with `{ error }`. It is scoped to the TABLE rather than to the name
  // columns on purpose: the first version of this arm found three defects that were not
  // part of the bug it was written for, and only because of that scope.
  it('every write to user_settings reads its own error', () => {
    const src = stripComments(fs.readFileSync(CLIENT, 'utf8'))
    const lines = src.split('\n')
    const offenders: string[] = []
    lines.forEach((l, i) => {
      if (!/\.from\(['"]user_settings['"]\)/.test(l)) return
      if (!/\.(upsert|update|insert|delete)\(/.test(l)) return
      // Statement-scoped, never line-scoped: a chained `.then` sits on the NEXT line, and
      // a line-only test reported the three fixed writes as unfixed. Bound the region.
      const stmt = lines.slice(i, i + 3).join('\n')
      const reads = /\{\s*error(\s*:[^}]*)?\s*\}\s*=/.test(stmt)       // const { error } = await …
        || /\.then\(\(\{\s*error\s*\}\)/.test(stmt)                   // ….then(({ error }) => …
      if (!reads) offenders.push(`${i + 1}: ${l.trim().slice(0, 120)}`)
    })

    // 🔻 DECLARED DEBT, NOT A PASS — the SWEEP-BASELINE-01 pattern.
    //
    // Scoping this arm to the EFFECT rather than to `void` found 11 further writes to
    // this table whose `{ error }` nothing reads. They are NOT part of the reported bug
    // and none has been analysed: each needs its own answer to "what should the runner
    // see when this fails?", and changing 11 call sites without that answer is fixing
    // them without understanding them. Filed as `USER-SETTINGS-UNREAD-WRITE-01`.
    //
    // ⚠️ A declared reason is not a fixed problem. This number may only FALL. It is a
    // COUNT and not a list of line numbers on purpose — a list re-keys itself every time
    // a line is inserted above it, which this repo has already paid for once
    // (`buttonGeometry`'s `file:line` baseline silently stopped looking).
    const BASELINE = 11
    expect(offenders.length, `\n${offenders.join('\n')}\n`).toBeLessThanOrEqual(BASELINE)
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
    expect(src).toMatch(/if \(canBackfill && !current\?\.first_name && !current\?\.last_name\)/)
    expect(src).toMatch(/if \(canBackfill && !current\?\.email\)/)
    // A failed READ must not read as an empty column, or the back-fill overwrites a
    // name the runner typed. Same discarded-`{ error }` class the route exists to fix.
    expect(src).toMatch(/const \{ data: current, error: readErr \}/)
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
