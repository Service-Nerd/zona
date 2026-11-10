import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { AI_LIMITS } from './limits'

/**
 * AI-ROUTE-HTTP-HOP-CEILING-01 — every site that AWAITS an AI route over HTTP must bound the hop
 * and declare a ceiling of its own.
 *
 * 🔴 WHY THE POPULATION IS DERIVED AND NOT LISTED, which the item said to settle first.
 * `aiRouteMaxDuration.test.ts` walks an IMPORT graph: it finds the routes that reach
 * `callAnthropic` through module imports. **The routes that WAIT on one reach it through a URL
 * STRING**, so no import graph can see them, and the two populations do not overlap at all. This
 * reader therefore matches a `fetch` whose URL contains `/api/<name>` where `<name>` is a route
 * in the import closure — derived from the filesystem, so a new AI route joins the population the
 * day it is written.
 *
 * ⚠️ THE ITEM NAMED THREE SITES AND THERE ARE FIVE. It missed **both** `fetch`es in
 * `app/api/strava/link-activity/route.ts`, which is exactly why this is a derived reader rather
 * than the table from the item: a hand-written population is wrong on the day it is written.
 *
 * 🔑 AND THE FIX MADE THE EXPOSURE WORSE BEFORE IT FIXED IT. `OPS-FN-DURATION-01` gave the
 * downstream routes a 240 s client timeout, so a hop may now hold for four minutes where the
 * platform used to cut it off — and `push/send-weekly-report` is a **cron looping SEQUENTIALLY
 * over every push subscription** (31 subscriptions, 26 users, measured 2026-11-10). One hop
 * hanging does not cost one report; it ends the cron, and every subsequent subscriber gets no
 * Sunday push, which nothing watches.
 */
const ROOT = process.cwd()
const SKIP = new Set(['node_modules', '.next', '.git', 'ios'])

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (SKIP.has(e)) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(e)) out.push(p)
  }
  return out
}
const rel = (f: string) => f.replace(ROOT + '/', '').replace(/\\/g, '/')
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

/** Route names under `app/api/**` that reach `callAnthropic` through imports. */
const aiRouteNames = (() => {
  const files = walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'lib'))).map(rel)
  const src = new Map(files.map(f => [f, readFileSync(join(ROOT, f), 'utf8')]))
  const resolve = (from: string, spec: string): string | null => {
    const base = spec.startsWith('@/') ? spec.slice(2)
      : spec.startsWith('.') ? join(from, '..', spec).replace(/\\/g, '/')
      : null
    if (!base) return null
    for (const ext of ['.ts', '.tsx', '/index.ts']) if (src.has(base + ext)) return base + ext
    return src.has(base) ? base : null
  }
  // ⚠️ `Array.from`, not a spread: `[...Map]` and `[...Set]` fail tsc here (TS2802, the gotcha
  // CLAUDE.md names). It failed exactly that way on the first run of this file.
  const importers = new Map<string, Set<string>>()
  for (const f of Array.from(src.keys())) {
    for (const m of Array.from(stripComments(src.get(f)!).matchAll(/from\s+'([^']+)'/g))) {
      const t = resolve(f, m[1]!)
      if (t) (importers.get(t) ?? importers.set(t, new Set()).get(t)!).add(f)
    }
  }
  const OWNER = 'lib/ai/callAnthropic.ts'
  const seen = new Set([OWNER]); const q = [OWNER]
  while (q.length) {
    const cur = q.pop()!
    for (const up of Array.from(importers.get(cur) ?? [])) if (!seen.has(up)) { seen.add(up); q.push(up) }
  }
  return new Set(Array.from(seen)
    .filter(f => /^app\/api\/[^/]+\/route\.ts$/.test(f))
    .map(f => f.split('/')[2]!))
})()

/** Every `fetch` to an AI route, with the file and whether it carries a signal. */
const hops = (() => {
  const out: Array<{ file: string; target: string; hasSignal: boolean }> = []
  for (const f of walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'lib'))).map(rel)) {
    if (/\.test\.tsx?$/.test(f)) continue
    const src = stripComments(readFileSync(join(ROOT, f), 'utf8'))
    // `fetch(` …up to the matching close of its init object. Bounded to the call, never the file.
    for (const m of Array.from(src.matchAll(/fetch\(\s*[`'"][^`'"]*\/api\/([a-z-]+)[^`'"]*[`'"]\s*,\s*\{/g))) {
      const name = m[1]!
      if (!aiRouteNames.has(name)) continue
      // 🔴 BRACE-MATCH THE INIT OBJECT, DO NOT GUESS ITS CLOSE. The first cut sliced to the next
      // `\n})`, which depends on the caller's indentation — so it found NONE of the five signals
      // that were already there and the arm failed on correct code. **Bound the region, never
      // guess where it ends.**
      const open = m.index! + m[0].length - 1
      let depth = 0, end = open
      for (let i = open; i < src.length; i++) {
        if (src[i] === '{') depth++
        else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break } }
      }
      const init = src.slice(open, end + 1)
      out.push({ file: f, target: name, hasSignal: /\bsignal\s*:/.test(init) })
    }
  }
  return out
})()

describe('AI-ROUTE-HTTP-HOP-CEILING-01 — the hop, and the caller that waits on it', () => {
  it('the population was DERIVED and is not empty — both halves of it', () => {
    // An empty set here passes every arm below, and both derivations are regex-based.
    expect(aiRouteNames.size, 'no AI routes found; the import walk is broken').toBeGreaterThan(5)
    expect(aiRouteNames, 'analyse-run reaches the model and must be in the closure').toContain('analyse-run')
    expect(aiRouteNames).toContain('weekly-report')
    expect(hops.length, 'no HTTP hops to an AI route found; the fetch reader is broken').toBeGreaterThanOrEqual(5)
  })

  it('🔴 the item said THREE sites — link-activity has two of the five it missed', () => {
    const files = new Set(hops.map(h => h.file))
    for (const f of ['app/api/health/ingest/route.ts',
                     'app/api/push/send-weekly-report/route.ts',
                     'lib/coaching/autoAnalyse.ts',
                     'app/api/strava/link-activity/route.ts']) {
      expect(files, `${f} awaits an AI route and is not in the derived population`).toContain(f)
    }
    expect(hops.filter(h => h.file === 'app/api/strava/link-activity/route.ts').length,
      'link-activity has TWO hops and the item named neither').toBe(2)
  })

  it('🔴 every hop carries an AbortSignal', () => {
    const bare = hops.filter(h => !h.hasSignal).map(h => `${h.file} → /api/${h.target}`)
    expect(bare,
      'this awaits a route that may hold for CALL_TIMEOUT_MS (240 s). Add '
      + '`signal: AbortSignal.timeout(AI_LIMITS.HOP_TIMEOUT_MS)` or the CALLER is what dies.')
      .toEqual([])
  })

  it('🔴 every ROUTE that waits declares its own maxDuration, and the literal agrees with AI_LIMITS', () => {
    // A lib has no route config; its callers are the routes, and they are in this set too.
    const callerRoutes = Array.from(new Set(hops.map(h => h.file))).filter(f => /^app\/.*route\.ts$/.test(f))
    expect(callerRoutes.length, 'no caller ROUTES in the population').toBeGreaterThanOrEqual(3)
    for (const f of callerRoutes) {
      const src = readFileSync(join(ROOT, f), 'utf8')
      const m = /export const maxDuration\s*=\s*(\d+)/.exec(src)
      expect(m, `${f} awaits an AI route and declares no maxDuration`).not.toBeNull()
      expect(Number(m![1]), `${f}'s maxDuration disagrees with AI_LIMITS`)
        .toBe(AI_LIMITS.ROUTE_MAX_DURATION_SECONDS)
    }
  })

  it('🔑 the hop timeout fires well before the caller’s ceiling, and cannot cut real work', () => {
    // Its job is to bound what ONE bad hop costs a sequential loop, not to predict a duration.
    expect(AI_LIMITS.HOP_TIMEOUT_MS).toBeLessThan(AI_LIMITS.ROUTE_MAX_DURATION_SECONDS * 1000)
    // Room for many iterations: the weekly cron loops over every subscription.
    expect(AI_LIMITS.HOP_TIMEOUT_MS * 8, 'one bad hop can consume most of the cron’s budget')
      .toBeLessThanOrEqual(AI_LIMITS.ROUTE_MAX_DURATION_SECONDS * 1000)
    // …and ≥ 5× the slowest model call either hop's target has ever recorded (weekly-report 5.7 s).
    expect(AI_LIMITS.HOP_TIMEOUT_MS).toBeGreaterThanOrEqual(5 * 5_700)
    // It must also be shorter than the downstream's own client timeout, or it never fires first.
    expect(AI_LIMITS.HOP_TIMEOUT_MS).toBeLessThan(AI_LIMITS.CALL_TIMEOUT_MS)
  })

  it('🔴 no caller hand-builds the server→server base — `getInternalBaseUrl()` is the one owner', () => {
    // GTM-SITE-01. `link-activity` was the last file carrying the copy, TWICE, and the owner's
    // own comment names the cost: VERCEL_URL "carries Vercel Deployment Protection and is not
    // the canonical host", and it "silently degraded the no-app run-analysis on both ingest
    // paths after 2026-09-10". The catch there only `console.warn`s, so it said nothing.
    const offenders = walk(join(ROOT, 'app')).concat(walk(join(ROOT, 'lib'))).map(rel)
      .filter(f => !/\.test\.tsx?$/.test(f))
      .filter(f => /VERCEL_URL \? `https:\/\//.test(stripComments(readFileSync(join(ROOT, f), 'utf8'))))
    expect(offenders, 'hand-built server→server base; call `getInternalBaseUrl()` instead').toEqual([])
  })
})
