import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * SEC-15 — every AI route carries a per-user ceiling.
 *
 * THE DEFECT THIS CLOSES. Eleven of the twelve AI routes called
 * `guardAiRequest` or `enforceAiRateLimit`. `/api/weekly-report` called
 * neither, and it is a Sonnet route. It was authenticated and tier-gated, so
 * not an open door — but it was the one path where a client loop could drive
 * Sonnet with no per-user ceiling, and `?force=true` makes regeneration a
 * first-class parameter.
 *
 * ⚠️ THE TEST IS DELIBERATELY NOT "weekly-report has a limiter". That assertion
 * would have gone green the moment I edited one file and told me nothing about
 * the TWELFTH route someone adds next month — which is exactly how this one
 * came to exist, because nothing was counting. Eleven-of-twelve is a ratio only
 * a sweep can see. Same reasoning, and the same shape, as
 * `noRawAnthropicCalls.test.ts`.
 *
 * ⚠️ WHAT IT CANNOT PROVE. A limiter that is PRESENT is not a limiter that is
 * EFFECTIVE: `checkAiRateLimit` FAILS OPEN by design — an RPC error or an
 * unreachable database allows the request, because a false denial breaks the
 * product while a brief limiter outage has bounded exposure. That trade is
 * documented and correct, and it means this file proves a ceiling is declared,
 * never that it held. `OPS-AI-SPEND-01` is what makes the actual spend visible.
 */
const ROUTES_DIR = 'app/api'
const OWNER_CALLS = ['enforceAiRateLimit', 'guardAiRequest']
const ANTHROPIC_OWNER = 'callAnthropic'

/**
 * Routes that reach the model but must NOT be user-rate-limited, each with the
 * reason. An entry here is a decision, not a suppression — anything absent from
 * both this list and the guard list fails.
 */
const EXEMPT: Record<string, string> = {
  // Fired by Vercel cron against many users; a per-user ceiling is meaningless
  // and the CRON_SECRET is the actual control.
  'app/api/cron': 'cron-driven, gated by CRON_SECRET rather than per-user limits',
}

function files(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) files(p, out)
    else if (/^route\.tsx?$/.test(entry)) out.push(p)
  }
  return out
}

describe('SEC-15 — every AI route declares a per-user ceiling', () => {
  const all = files(ROUTES_DIR)

  it('finds the route tree at all, so the sweep cannot pass by scanning nothing', () => {
    // A structural test whose corpus silently empties goes green forever. This
    // repo has shipped that exact failure more than once.
    expect(all.length).toBeGreaterThan(20)
  })

  it('every route that calls the Anthropic owner also calls a rate-limit guard', () => {
    const unguarded: string[] = []
    for (const f of all) {
      // ⚠️ COMMENTS STRIPPED FIRST. The first cut matched the raw source and
      // reported `app/api/ops/ai-spend/route.ts` as an unguarded AI route — it
      // only NAMES `callAnthropic` in a comment explaining where spend data
      // comes from. Second time in one day a substring match read a comment as
      // code; a guard with a false positive gets an exemption entry it does not
      // deserve, which is how an EXEMPT list stops meaning anything.
      const src = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter(l => !l.trim().startsWith('//'))
        // ⚠️ IMPORT LINES STRIPPED TOO, and this was caught by FALSIFYING the
        // test rather than by reading it. Deleting the call from
        // `analyse-run` left the test GREEN, because `src.includes(
        // 'enforceAiRateLimit')` was matching the surviving import. A route
        // that imports a guard and never calls it would have passed — the
        // "declared but inert" class this repo has paid for repeatedly
        // (decorative config, the eslint rule installed but never configured,
        // §97's two inert gates). A guard that cannot go red is not a guard.
        .filter(l => !l.trim().startsWith('import'))
        .join('\n')
      if (!src.includes(ANTHROPIC_OWNER)) continue           // not an AI route
      const rel = relative(process.cwd(), f)
      if (Object.keys(EXEMPT).some(prefix => rel.startsWith(prefix))) continue
      if (OWNER_CALLS.some(c => src.includes(c + '('))) continue
      unguarded.push(rel)
    }
    expect(
      unguarded,
      'An AI route with no per-user ceiling. Add `enforceAiRateLimit(userId, "<route>")` after the '
      + 'auth and tier gates (rate-limit-only, for routes that read no request body), or '
      + '`guardAiRequest` where a body is read. If it genuinely must not be limited, add it to '
      + 'EXEMPT with the reason — SEC-15 existed because one route was missing and nothing counted.',
    ).toEqual([])
  })

  it('weekly-report specifically is limited, and on the interactive branch only', () => {
    // The route SEC-15 was filed for. The branch matters: it has two callers,
    // and rate-limiting the internal cron would silently stop a runner's
    // scheduled report — a limiter that breaks the product it protects.
    const src = readFileSync('app/api/weekly-report/route.ts', 'utf8')
    expect(src).toContain("enforceAiRateLimit(userId, 'weekly-report')")
    const guardAt = src.indexOf('enforceAiRateLimit(userId')
    const cronAt = src.indexOf('if (isInternalCall)')
    const elseAt = src.indexOf('} else {', cronAt)
    expect(cronAt, 'the two-caller branch still exists').toBeGreaterThan(-1)
    expect(guardAt, 'the guard sits after the else, i.e. on the interactive branch').toBeGreaterThan(elseAt)
  })
})
