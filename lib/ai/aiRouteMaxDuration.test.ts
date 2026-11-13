import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { callTimeoutMsFor, AI_LIMITS } from './limits'

/**
 * OPS-FN-DURATION-01 (2026-11-08) — EVERY ROUTE THAT CAN REACH THE MODEL STATES ITS CEILING.
 *
 * 🔴 WHY A CEILING IN CODE AT ALL. No route set `maxDuration`, so each ran on whatever the
 * platform default happened to be — and that default has changed TWICE: 60 s Hobby / 90 s Pro,
 * then 300 s on all plans, **conditional on Fluid compute being enabled**, which cannot be
 * verified from this machine (observability 404s; the project API does not expose it). An
 * invisible platform default governing whether a runner's plan finishes generating is the
 * `GTM-SITE-01` shape exactly: *"the code said one thing, production did another"*.
 *
 * 📐 AND THE EXPOSURE IS REAL AND RISING, which is why the filed item's "this may be a
 * DON'T BUILD" was wrong. From `ops_events.ai_call` (749 calls, the ledger records `ms`):
 * `enrich-plan` p50 **42.7 s**, p95 **57.0 s**, max **64.4 s**, and p50 went
 * 38.3 → 45.4 → **59.1 s** across 2026-09/10/11 with 3 of 103 calls already over 60 s. The
 * item said *"plan enrichment measures 28–35 s"* — stale by nearly 2×, in the direction that
 * matters. Every other surface maxes at 5.7 s.
 *
 * ⚠️ THE POPULATION IS THE IMPORT CLOSURE, NEVER A LIST. `COHORT-GRID-UNSET-LEVEL-01` is the
 * recorded precedent: a hand-listed population silently excluded the cases at risk. Two of the
 * fourteen routes here reach `callAnthropic` only through `lib/` (`generate-plan` via
 * `enrich.ts`, `maintenance-block` via `enrichMaintenance.ts`), so a grep for `callAnthropic(`
 * in `app/` finds twelve and misses the two slowest.
 */

const ROOT = process.cwd()
const OWNER = 'lib/ai/callAnthropic.ts'

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\./.test(n)) out.push(p)
  }
  return out
}

const rel = (f: string) => f.replace(ROOT + '/', '')
const srcOf = new Map(
  [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'lib')), ...walk(join(ROOT, 'packages'))]
    .map(f => [rel(f), readFileSync(f, 'utf8')] as const),
)

function resolveSpec(fromRel: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = spec.slice(2)
  else if (spec.startsWith('.')) base = rel(resolve(join(ROOT, dirname(fromRel)), spec))
  else return null
  for (const c of [base, base + '.ts', base + '.tsx', base + '/index.ts']) if (srcOf.has(c)) return c
  return null
}

/** Who imports X — walked backwards from the owner, so a route that reaches it through any
 *  number of `lib/` hops is in the population. */
const importers = new Map<string, Set<string>>()
for (const [f, src] of Array.from(srcOf.entries())) {
  for (const m of Array.from(src.matchAll(/from\s+['"]([^'"]+)['"]/g))) {
    const t = resolveSpec(f, m[1]!)
    if (!t) continue
    if (!importers.has(t)) importers.set(t, new Set())
    importers.get(t)!.add(f)
  }
}
const reachable = new Set([OWNER])
const queue = [OWNER]
while (queue.length) {
  for (const up of Array.from(importers.get(queue.shift()!) ?? [])) {
    if (!reachable.has(up)) { reachable.add(up); queue.push(up) }
  }
}
const aiRoutes = Array.from(reachable).filter(f => /^app\/.*\/route\.ts$/.test(f)).sort()

const declared = (src: string): number | null => {
  // CODE, not comments: the explanatory block above each declaration names the number twice.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
  const m = code.match(/^export const maxDuration\s*=\s*(\d+)/m)
  return m ? Number(m[1]) : null
}

/** Every .ts/.tsx under a directory — the ceilings are read from source, not restated here. */
function walkTs(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { out.push(...walkTs(p)); continue }
    if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) out.push(p)
  }
  return out
}

describe('OPS-FN-DURATION-01 — the AI route ceiling', () => {
  it('the closure really was walked, and it is not a list', () => {
    // Non-vacuity for every arm below. 14 measured 2026-11-08; the owner plus the lib hops
    // puts the file count around twenty, so a handful means the resolver broke rather than
    // that the app shrank — this repo's `an empty population renders as a clean result` class.
    expect(srcOf.size).toBeGreaterThan(400)
    expect(reachable.size).toBeGreaterThan(10)
    expect(aiRoutes.length).toBe(14)
  })

  it('🔴 the two routes that reach the model only through lib/ ARE in the population', () => {
    // The arm that makes the closure worth walking: a grep for `callAnthropic(` under `app/`
    // finds twelve routes and misses these two, which are the two SLOWEST.
    for (const r of ['app/api/generate-plan/route.ts', 'app/api/maintenance-block/route.ts']) {
      expect(aiRoutes, `${r} must be in the closure`).toContain(r)
      expect(srcOf.get(r)!, `${r} must NOT call the owner directly, or this arm proves nothing`)
        .not.toMatch(/\bcallAnthropic\(/)
    }
  })

  it('🔴 every route in the closure declares maxDuration, in code', () => {
    const missing = aiRoutes.filter(r => declared(srcOf.get(r)!) === null)
    expect(
      missing,
      'A route that can reach the model has no `export const maxDuration` — it would run on '
      + 'whatever the platform default happens to be. Add it:\n' + missing.join('\n'),
    ).toEqual([])
  })

  it('🔴 …and the literal agrees with AI_LIMITS, which the route cannot import', () => {
    // Next.js route segment config must be statically analysable, so a route cannot read the
    // constant. THIS is the link between the two, and without it the config value is
    // decorative — the `a principle is not a consumer` class.
    const wrong = aiRoutes
      .map(r => [r, declared(srcOf.get(r)!)] as const)
      .filter(([, n]) => n !== AI_LIMITS.ROUTE_MAX_DURATION_SECONDS)
    expect(
      wrong,
      `each must equal AI_LIMITS.ROUTE_MAX_DURATION_SECONDS (${AI_LIMITS.ROUTE_MAX_DURATION_SECONDS}): `
      + wrong.map(([r, n]) => `${r}=${n}`).join(', '),
    ).toEqual([])
  })

  it('🔴 the client timeout fires BEFORE the platform does, with room for the rest of the route', () => {
    // A timeout at or above the ceiling is not a timeout — it is the situation before this
    // commit with a constant next to it. The headroom is what the route still has to do after
    // the model returns: generation, validatePlan, the repair ladder, the save.
    const ceilingMs = AI_LIMITS.ROUTE_MAX_DURATION_SECONDS * 1000
    expect(AI_LIMITS.CALL_TIMEOUT_MS).toBeLessThan(ceilingMs)
    expect(ceilingMs - AI_LIMITS.CALL_TIMEOUT_MS, 'at least 30s of headroom after the model returns')
      .toBeGreaterThanOrEqual(30_000)
  })

  it('🔴 …and it is above the slowest call ever measured, so it cannot cut real work', () => {
    // `enrich-plan` max 64.4s, p50 RISING 38.3 → 45.4 → 59.1s across three months. A timeout
    // sized at the current max would start cutting plans within weeks, so the arm holds a
    // multiple rather than the figure.
    const SLOWEST_MEASURED_MS = 64_400
    expect(AI_LIMITS.CALL_TIMEOUT_MS / SLOWEST_MEASURED_MS,
      'at least 3x the slowest call ever recorded, because the trend is upward')
      .toBeGreaterThanOrEqual(3)
  })

  it('🔴 the SHORT regime is above the slowest small call and still fires well before the platform', () => {
    // AI-TIMEOUT-PER-SURFACE-01. Measured over 807 calls carrying `ms` and `outputTokens`:
    // every call under 500 output tokens finished within 5.7 s, on all twelve surfaces that
    // have ever run one. The short timeout is sized off that, not off a per-surface sample —
    // four surfaces have n <= 5 and two have ZERO, which is why the item declined to go per
    // surface at all.
    const SLOWEST_SMALL_MS = 5_700
    expect(AI_LIMITS.CALL_TIMEOUT_SHORT_MS / SLOWEST_SMALL_MS,
      'the short timeout must be at least 5x the slowest small call ever recorded, or it will '
      + 'start cutting real work').toBeGreaterThanOrEqual(5)
    expect(AI_LIMITS.CALL_TIMEOUT_SHORT_MS,
      'the short regime must be shorter than the long one, or it is not a regime')
      .toBeLessThan(AI_LIMITS.CALL_TIMEOUT_MS)
    expect(AI_LIMITS.ROUTE_MAX_DURATION_SECONDS * 1000 - AI_LIMITS.CALL_TIMEOUT_SHORT_MS)
      .toBeGreaterThanOrEqual(30_000)
  })

  it('🔴 the boundary sits in a GAP the code actually has — read from the ceilings, not typed', () => {
    // ▲ The first cut hardcoded 300 and 2048 while claiming to be "derived" (code review), so a
    // new surface at, say, 900 tokens would take the 60 s regime with every arm green. The
    // ceilings are read from source instead, and the property is that the boundary has CLEAR
    // AIR on both sides — not merely that it falls between two numbers someone typed here.
    const SRC = ['lib', 'app'].flatMap(d => walkTs(join(ROOT, d)))
    // ⚠️ `Array.from`, not a spread — CLAUDE.md's TS2802 gotcha, and the spread version passed
    // vitest while failing tsc, which is exactly the green-suite-red-build trap it warns about.
    const ceilings = SRC.flatMap(f => Array.from(readFileSync(f, 'utf8').matchAll(/maxTokens:\s*(\d[\d_]*)/g))
      .map(m => Number(m[1]!.replace(/_/g, ''))))
    expect(ceilings.length, 'no maxTokens literals found — the scan is reading nothing')
      .toBeGreaterThan(5)

    const b = AI_LIMITS.CALL_TIMEOUT_LARGE_MAX_TOKENS
    const small = ceilings.filter(c => c <= b)
    const large = ceilings.filter(c => c > b)
    expect(small.length, 'no call sits in the short regime').toBeGreaterThan(0)
    expect(large.length, 'no call sits in the long regime').toBeGreaterThan(0)

    // Clear air: nothing may sit near the boundary on either side, because a ceiling close to
    // it is a call whose regime is decided by a rounding rather than by its size.
    expect(b / Math.max(...small),
      `a ceiling of ${Math.max(...small)} sits just under the ${b} boundary — its regime is an `
      + 'accident of where the line was drawn, not a property of the call')
      .toBeGreaterThanOrEqual(2)
    expect(Math.min(...large) / b,
      `a ceiling of ${Math.min(...large)} sits just over the ${b} boundary — same problem, other side`)
      .toBeGreaterThanOrEqual(2)
  })

  it('🔴 the owner routes each ceiling to the regime its measurement puts it in', () => {
    // Falsifiable by moving the boundary: at 100 the short surfaces take the LONG timeout.
    for (const small of [80, 120, 150, 200, 220, 300]) {
      expect(callTimeoutMsFor(small), `${small}-token call must take the short regime`)
        .toBe(AI_LIMITS.CALL_TIMEOUT_SHORT_MS)
    }
    for (const large of [2_048, 3_000, 6_000, 10_000, 14_000]) {
      expect(callTimeoutMsFor(large), `${large}-token call must take the long regime`)
        .toBe(AI_LIMITS.CALL_TIMEOUT_MS)
    }
  })

  it('🔴 the owner actually passes the timeout to fetch, and names TimeoutError not a message', () => {
    const code = readFileSync(join(ROOT, OWNER), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
    expect(code, 'the signal must be on the fetch, not merely imported')
      .toMatch(/signal:\s*AbortSignal\.timeout\(callTimeoutMsFor\(maxTokens\)\)/)
    // Matched on the DOMException NAME. The message is runtime wording that differs between
    // Node versions — this repo's `never match a refusal by its MESSAGE` lesson.
    expect(code).toMatch(/\.name === 'TimeoutError'/)
    expect(code, 'a timeout must be its own ledger reason, not folded into fetch_failed')
      .toMatch(/reason: AiFailureReason = timedOut \? 'timeout' : 'fetch_failed'/)
  })
})
