import { describe, it, expect } from 'vitest'
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * RATELIMIT-MODULE-PATH-01 (2026-11-08) — the limiter moved out of `lib/ai/`, and this is
 * the arm that makes the move mean something.
 *
 * 🔑 WHAT VIOLATION CLASS CAN THIS ACTUALLY FIND? Asked first, because a gate that cannot
 * name one is the `MAINT-ENRICH-VALIDATE-01` shape — built, green, and inert by construction.
 * The answer is a real and reachable class: a new feature hand-rolling its own call to the
 * `check_rate_limit` RPC. Direct `.rpc(...)` is ORDINARY in this repo — `lib/plan/completions.ts`,
 * `lib/coaching/autoAnalyse.ts` and four routes all do it for their own functions — so the next
 * person who needs a limit has every reason to write the RPC call rather than find this module.
 * That is `DELOAD-OWNER-01` / `TIER-OWNER-01` / `OPS-AI-OWNER-01` exactly: a second producer of
 * the same answer, agreeing by accident until it does not.
 *
 * ⚠️ WHAT IT DOES NOT PROVE. It does not prove a caller passes a sensible key, limit or window,
 * and it cannot see a feature that needs a limit and has none — `everyAiRouteIsLimited.test.ts`
 * is the arm for that, and only for AI routes. It also deliberately does NOT re-assert the `ai:`
 * key shape: `lib/charity/redeemRateLimit.test.ts` owns that, and duplicating it here would be
 * the very defect this item exists to remove.
 */

const ROOT = process.cwd()
const OWNER = 'lib/security/rateLimit.ts'
const RPC = 'check_rate_limit'

function sources(roots: string[]): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    for (const e of readdirSync(d)) {
      if (e === 'node_modules' || e === '.next' || e === '.git' || e === '.tmp') continue
      const p = join(d, e)
      if (statSync(p).isDirectory()) { walk(p); continue }
      if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p)
    }
  }
  for (const r of roots) walk(join(ROOT, r))
  return out
}

/** A colour inside a comment is prose, and so is an RPC name. Line numbers preserved. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length))
}

describe('RATELIMIT-MODULE-PATH-01 — one owner of the rate-limit RPC', () => {
  const files = sources(['app', 'lib', 'components', 'scripts'])

  it('population: the walk is derived and reaches every directory that could hold a caller', () => {
    // An empty population renders as a clean result — `CLEAN — 0 files` was the first cut's
    // answer to selecting nothing, in `sweep-colours` and in `profileBackfill`'s own gate.
    expect(files.length).toBeGreaterThan(300)
    for (const dir of ['/app/api/', '/lib/security/', '/lib/ai/', '/components/', '/scripts/']) {
      expect(files.some(f => f.includes(dir)), `the walk must reach ${dir}`).toBe(true)
    }
  })

  it('🔴 nothing outside lib/security/rateLimit.ts names the check_rate_limit RPC', () => {
    const strays = files
      .filter(f => f.replace(ROOT + '/', '') !== OWNER)
      .filter(f => stripComments(readFileSync(f, 'utf8')).includes(RPC))
      .map(f => f.replace(ROOT + '/', ''))
    expect(
      strays,
      `Use \`checkRateLimit\` from ${OWNER}, which owns the RPC, fails open deliberately and logs `
      + `the outage. A second caller is a second producer of the same answer:\n${strays.join('\n')}`,
    ).toEqual([])
  })

  it('…and the owner really does call it, so the arm above is not passing on an absent string', () => {
    const owner = stripComments(readFileSync(join(ROOT, OWNER), 'utf8'))
    expect(owner).toMatch(new RegExp(`\\.rpc[^)]*\\)\\s*\\(\\s*'${RPC}'`))
    expect(owner).toMatch(/export async function checkRateLimit\(/)
  })

  it('the ai: wrapper delegates and does not re-implement the limiter', () => {
    const wrapper = stripComments(readFileSync(join(ROOT, 'lib/ai/rateLimit.ts'), 'utf8'))
    expect(wrapper).toMatch(/from '@\/lib\/security\/rateLimit'/)
    expect(wrapper).not.toContain('createClient')
  })
})
