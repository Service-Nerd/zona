import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { generateRulePlan } from './ruleEngine'
import { isDesignedRefusal, DESIGNED_REFUSAL_ERROR_NAMES } from './designedRefusal'
import { runEngine } from './engine'

/**
 * ENGINE-CONTRACT-01 — `docs/contracts/engine.md` must still describe the engine.
 *
 * 🎯 The contract exists because the engine is to be lifted out to a hosted service: it is
 * the one interface anything external would call, and it was governed by nothing. A contract
 * nobody checks is a comment, and this repo has measured that twice — a route comment that
 * claimed a rate limit which never existed, and a contract asserting a charity half-state
 * that a migration had falsified three days earlier.
 *
 * ⚠️ WHAT THIS DELIBERATELY DOES NOT DO: re-state `GeneratorInput`. `types/plan.ts` is the
 * source, and a second copy of a 31-field shape is exactly how `deloadCadence` and
 * `sumWeeklyKm` started. It checks the CLAIMS the prose makes instead — the ones that would
 * silently rot and that a reader would act on.
 */

const CONTRACT = readFileSync('docs/contracts/engine.md', 'utf8')
const TYPES = readFileSync('types/plan.ts', 'utf8')
const ENGINE = readFileSync('lib/plan/ruleEngine.ts', 'utf8')

describe('ENGINE-CONTRACT-01 — the contract matches the engine', () => {
  it('the required-field count is still 7, and the contract says 7', () => {
    // The number a reader builds a request from. If a field becomes required and the
    // contract still says 7, an external caller sends an invalid payload.
    const i = TYPES.indexOf('GeneratorInput')
    const open = TYPES.indexOf('{', i)
    let depth = 0, end = open
    for (let k = open; k < TYPES.length; k++) {
      if (TYPES[k] === '{') depth++
      else if (TYPES[k] === '}') { depth--; if (depth === 0) { end = k; break } }
    }
    const body = TYPES.slice(open, end)
    const required = Array.from(body.matchAll(/^ {2}([a-z_][a-zA-Z_0-9]*)(\??):/gm))
      .filter(m => m[2] !== '?').map(m => m[1])
    expect(required.length, `GeneratorInput now has ${required.length} required fields`).toBe(7)
    expect(CONTRACT).toContain('**7 required**')
    for (const f of required) {
      expect(CONTRACT, `required field \`${f}\` is missing from the contract table`).toContain(f)
    }
  })

  it('every designed-refusal name in the code appears in the contract table', () => {
    // The contract's most load-bearing claim: these FOUR are the engine working, and a
    // service must not map them to 500. A fifth added in code and not here would be
    // invisible to whoever writes the HTTP layer.
    expect(DESIGNED_REFUSAL_ERROR_NAMES.length).toBe(4)
    for (const name of DESIGNED_REFUSAL_ERROR_NAMES) {
      expect(CONTRACT, `refusal \`${name}\` is not in the contract`).toContain(name)
    }
  })

  it('🔴 a designed refusal is THROWN, not returned — asserted against the real engine', () => {
    // Not a claim about the source text. Run an input that cannot work and prove the
    // shape, because this is the fact a hosted engine gets wrong by defaulting to 500.
    const impossible = {
      race_date: '2026-10-20',            // days away, for a marathon
      race_distance_km: 42.2, goal: 'finish' as const,
      current_weekly_km: 10, longest_recent_run_km: 5,
      days_available: 3, age: 40,
    }
    let threw = false
    try {
      generateRulePlan(impossible as never, 'paid', '2026-10-19')
    } catch (e) {
      threw = true
      expect(isDesignedRefusal(e), 'the engine threw something that is NOT a designed refusal').toBe(true)
      expect(DESIGNED_REFUSAL_ERROR_NAMES).toContain((e as Error).name)
    }
    expect(threw, 'the engine RETURNED for an impossible input — the contract is now wrong').toBe(true)
    expect(CONTRACT).toContain('the engine THROWS')
  })

  it('the engine still reads the wall clock, which is the contract\'s central warning', () => {
    // If someone "fixes" this to use todayOverride, the contract's whole clock section
    // becomes wrong in the direction that matters: a service WOULD then be cacheable.
    // The arm fails either way, which is the point — the doc and the code move together.
    expect(ENGINE, 'applyVdotDiscount no longer reads the wall clock — update the contract')
      .toMatch(/applyVdotDiscount\([^)]*new Date\(\)/)
    expect(CONTRACT).toContain('NOT a pure function of its arguments')
  })

  it('the tier values in the contract are the tier values in the code', () => {
    const m = /export type Tier = ([^\n]+)/.exec(ENGINE)
    expect(m, 'the Tier type moved').not.toBeNull()
    for (const t of ['free', 'trial', 'paid']) {
      expect(m![1], `Tier no longer includes '${t}'`).toContain(t)
      expect(CONTRACT).toContain(`'${t}'`)
    }
  })

  it('the catalogue is still a DEFAULT ARGUMENT, which the contract calls a constraint', () => {
    // The moment someone wires it properly, the contract's versioning warning is stale
    // and should be deleted rather than left to mislead.
    expect(ENGINE).toMatch(/catalogue:\s*SessionCatalogueRow\[\]\s*=\s*V1_SESSION_CATALOGUE/)
    expect(CONTRACT).toContain('a default argument, and that is a constraint')
  })

  /**
   * ENGINE-ENTRY-01 (2026-10-15) — 18 → 7, and the READER of this count was itself
   * part of the problem.
   *
   * 🔴 THE OLD PATTERN WAS `from '@/lib/plan/([a-zA-Z]+)'`, WHICH IS THREE BUGS IN
   * ONE REGEX, and they are the reason a sibling claim in the same contract rotted
   * for weeks with a gate sitting next to it:
   *
   *   1. it matches `@/lib/plan/` only, so **`@/lib/coaching/*` is invisible** —
   *      and 9 of `adjust-plan`'s 14 engine imports are exactly that;
   *   2. `[a-zA-Z]+` cannot match a nested path like
   *      `@/lib/coaching/diff/sessionDiff`, nor a name with a digit or underscore;
   *   3. it only ever read generate-plan, so the contract's *"`adjust-plan` ten"*
   *      had **no arm at all** — and the real figure is **14**.
   *
   * **A number in a doc drifts; a number a script checks does not** — but only if the
   * script can see it. Both routes are counted now, by one shared reader.
   */
  const engineModules = (file: string): Set<string> => {
    const src = readFileSync(file, 'utf8')
      // A path inside a comment is prose, not an import.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
    return new Set(
      Array.from(src.matchAll(/from\s+['"]@\/lib\/(plan|coaching)\/([A-Za-z0-9_\-/.]+)['"]/g))
        .map(m => `${m[1]}/${m[2]}`),
    )
  }

  it('generate-plan imports SEVEN engine modules, and the contract says so', () => {
    const mods = engineModules('app/api/generate-plan/route.ts')
    expect(
      mods.size,
      `generate-plan imports ${mods.size} engine modules, not 7 — update the contract. ` +
      `Found: ${Array.from(mods).sort().join(', ')}`,
    ).toBe(7)
    expect(CONTRACT).toContain('**seven** engine modules')

    // Not just the count — the SHAPE. One entry point, and the six the contract
    // assigns to the caller. A seventh engine module sneaking back in would keep
    // the count at 7 only by displacing one of these.
    expect(mods, 'the entry point itself must be imported').toContain('plan/engine')
    for (const m of ['plan/enrich', 'plan/enrichAttribution', 'plan/enrichPartialRevert',
                     'plan/enrichServerSave', 'plan/freeIntro', 'plan/canUseFeature']) {
      expect(mods, `${m} is the CALLER's and must stay in the route`).toContain(m)
    }
  })

  it('the contract\'s adjust-plan count is checked at last, and is 14', () => {
    // 🔴 This claim said TEN and nothing read it. It was wrong by four for as long as
    // the contract has existed, because 9 of the 14 are `@/lib/coaching/*` and the
    // old reader could not see that directory.
    const mods = engineModules('app/api/adjust-plan/route.ts')
    expect(
      mods.size,
      `adjust-plan imports ${mods.size} engine modules, not 14 — update the contract. ` +
      `Found: ${Array.from(mods).sort().join(', ')}`,
    ).toBe(14)
    expect(CONTRACT).toContain('`adjust-plan` fourteen')
  })

  it('the entry point is real, callable, and the route does not bypass it', () => {
    // A count can be satisfied by an unused import. This asserts the engine is
    // actually on the path: the route calls it, and it is a function.
    expect(typeof runEngine).toBe('function')
    const route = readFileSync('app/api/generate-plan/route.ts', 'utf8')
    expect(route).toMatch(/runEngine\(\{/)
  })
})
