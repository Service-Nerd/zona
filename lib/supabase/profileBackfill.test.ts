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
  it('🔴 no raw write to user_settings survives in the client — one owner, one error policy', () => {
    // 🥇 THE ARM GOT STRONGER AND THE DEBT WENT TO ZERO, in the same commit
    // (USER-SETTINGS-UNREAD-WRITE-01, 2026-11-08). This used to count writes that drop their
    // `{ error }` and hold the number at 11 as declared debt. Eleven inline fixes would have
    // left the nineteenth write free to drop its error again, so the write itself moved behind
    // one owner — `lib/supabase/userSettingsWrite.ts`, which reads the error unconditionally.
    // The check is now the `noRawAnthropicCalls.test.ts` shape: not "does each site handle it"
    // but "can a site exist that doesn't".
    //
    // 🔴 THREE DEFECTS IN THE OLD REGISTER, all found by trying to ACT on its list rather than
    // by reading it, and stated because every one of them is a recorded class:
    //   1. IT COUNTED LINES, NOT WRITES. One JSX line here is 1,224 characters and carries TWO
    //      writes (`preferred_units`, `preferred_metric`). Counted once → UNDER-reported.
    //   2. THE `{ error }` WINDOW WAS THREE LINES, and the wizard's onboarding write reads its
    //      error EIGHT lines down via `Promise.allSettled` → a correctly-handled write reported
    //      as debt → OVER-reported. ⚠️ The two cancelled to the same total of 11, which is
    //      exactly how a wrong register survives: the number looked stable for four days.
    //   3. THE MESSAGE WAS `line.slice(0, 120)`, so for those long lines it printed a prop list
    //      and no write at all. **I nearly dismissed two real sites as false positives of my
    //      own check.** A register whose output does not show what it found gets ignored.
    const src = stripComments(fs.readFileSync(CLIENT, 'utf8'))

    /**
     * The one write that stays raw, with its reason. ⚠️ A NAMED LIST, not a pattern: it is
     * inside `Promise.allSettled` so a failed settings write cannot take the PLAN write down
     * with it, and its error is read 8 lines below as `onboardWrite.value.error`, logged, and
     * reported to `/api/ops/onboarding-event` — richer than the owner's policy, not poorer.
     * Keyed by the write's own TEXT, never by line number (`buttonGeometry`'s `file:line`
     * baseline silently stopped looking once a line was inserted above it).
     */
    const RAW_BY_DESIGN = ['upsert(onboardPatch)']

    const offenders: string[] = []
    let writes = 0
    src.split('\n').forEach((l, i) => {
      // PER WRITE, not per line — `matchAll`, because one line here holds two.
      for (const m of Array.from(l.matchAll(/\.from\(['"]user_settings['"]\)\s*\.(upsert|update|insert|delete)\(/g))) {
        writes++
        const at = m.index!
        const write = l.slice(at, at + 150)
        if (RAW_BY_DESIGN.some(x => write.includes(x))) continue
        // THE WRITE, not the first 120 characters of whatever line it sits on.
        offenders.push(`${i + 1}: …${write.trim()}`)
      }
    })

    // The population, or this passes on nothing — `an empty population renders as a clean
    // result`. 18 raw writes before this commit, 1 after.
    expect(writes, 'the write regex matched nothing — check the regex, not the file').toBeGreaterThan(0)
    expect(
      offenders,
      'Use `writeUserSettings` / `updateUserSettings` (lib/supabase/userSettingsWrite.ts), which '
      + 'reads the error and takes the severity as an argument. A raw write that is right anyway '
      + 'goes in RAW_BY_DESIGN with its reason:\n' + offenders.join('\n'),
    ).toEqual([])
  })

  it('…and the owner is the only module that writes the table from the client', () => {
    // The other half: an owner nothing uses is decorative, and a second client-side writer
    // somewhere else in `app/` would reopen the class one directory over.
    const owner = 'lib/supabase/userSettingsWrite.ts'
    const files: string[] = []
    const walk = (d: string) => {
      for (const n of fs.readdirSync(d)) {
        const f = path.join(d, n)
        if (fs.statSync(f).isDirectory()) walk(f)
        else if (/\.tsx?$/.test(n) && !/\.test\./.test(n)) files.push(f)
      }
    }
    // 🔴 IT WALKED `app/` ONLY, AND THAT IS THE DEFECT CLASS THIS COMMIT KEEPS CITING — code
    // review, 2026-11-08, the day it shipped. **Four raw writes live in `components/dashboard/`**
    // and the arm reported clean over all of them: `MeScreen`'s Strava disconnect (the LIVE one —
    // `setConnected(false)` ran after an unread write, so an RLS refusal left the screen saying
    // disconnected while the tokens survived), both halves of `AppleHealthConnectionRow`, and
    // `ConnectRunsBanner`. **A checker whose population excludes the cases at risk**, written by
    // someone who had just quoted that rule twice in the same diff.
    for (const root of ['app', 'components']) walk(path.join(process.cwd(), root))
    expect(files.length, 'the population is derived and must not be empty').toBeGreaterThan(50)
    // ⚠️ AND THE POPULATION IS ASSERTED TO REACH THE DIRECTORY THAT WAS MISSING, not just to be
    // non-empty: `app/` alone already passed the count above, which is exactly why the count
    // alone was no protection.
    expect(files.some(f => f.includes('/components/dashboard/')),
      'the walk must reach components/dashboard — the four writes it originally missed live there')
      .toBe(true)

    const strays = files.filter(f => {
      const rel = f.replace(process.cwd() + '/', '')
      if (rel === owner) return false
      const text = stripComments(fs.readFileSync(f, 'utf8'))
      if (!/\.from\(['"]user_settings['"]\)\s*\.(upsert|update|insert|delete)\(/.test(text)) return false
      // ⚠️ SERVER routes are OUT OF SCOPE and that is the decision, not an oversight: they
      // hold the service-role client, can call `recordOpsEvent` directly, and several must
      // fail the REQUEST rather than log. The owner is the CLIENT's policy.
      if (rel.startsWith('app/api/')) return false
      return !/upsert\(onboardPatch\)/.test(text) || /from\(['"]user_settings['"]\)\s*\.(upsert|update)\((?!onboardPatch)/.test(text)
    })
    expect(strays.map(f => f.replace(process.cwd() + '/', '')),
      'a client surface writes user_settings without the owner').toEqual([])
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
