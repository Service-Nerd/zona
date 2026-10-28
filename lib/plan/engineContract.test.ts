import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { generateRulePlan } from './ruleEngine'
import { isDesignedRefusal, DESIGNED_REFUSAL_ERROR_NAMES } from './designedRefusal'
import { runEngine } from './engine'
import { runAdjustmentEngine } from '@/lib/coaching/adjustmentEngine'

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
    const mods = new Set(
      Array.from(src.matchAll(/from\s+['"]@\/lib\/(plan|coaching)\/([A-Za-z0-9_\-/.]+)['"]/g))
        .map(m => `${m[1]}/${m[2]}`),
    )
    // 🔴 FOURTH HOLE IN THE SAME REGEX, FOUND BY ADJUST-ENGINE-ENTRY-01: the
    // pattern requires `@/lib/plan/`, so `from '@/lib/plan'` — the BARREL,
    // `lib/plan.ts` — was invisible. adjust-plan reached `getCurrentWeekIndex`
    // and `savePlanForUser` through it the whole time, so the figure this gate
    // protects was short by one module. Same class as the `@/lib/coaching/` hole
    // this reader was rewritten to close, one character further along.
    //
    // ⚠️ IT IS COUNTED SEPARATELY, NOT FOLDED IN, because the barrel is NOT pure
    // engine: `lib/plan.ts` imports `@supabase/supabase-js` and sits outside
    // `enginePurity`'s glob (which covers `lib/plan/**`, not `lib/plan.ts`). It
    // re-exports engine leaves AND owns persistence, so calling it an engine
    // module would be as wrong as ignoring it. Both counts are reported.
    for (const m of Array.from(src.matchAll(/from\s+['"]@\/lib\/(plan|coaching)['"]/g))) {
      mods.add(`${m[1]} (barrel)`)
    }
    return mods
  }

  /** The count the contract quotes: direct engine modules, excluding the barrel. */
  const directModules = (file: string): Set<string> =>
    new Set(Array.from(engineModules(file)).filter(m => !m.endsWith('(barrel)')))

  it('generate-plan imports EIGHT engine modules, and the contract says so', () => {
    const mods = directModules('app/api/generate-plan/route.ts')
    expect(
      mods.size,
      `generate-plan imports ${mods.size} engine modules, not 8 — update the contract. ` +
      `Found: ${Array.from(mods).sort().join(', ')}`,
    ).toBe(8)
    expect(CONTRACT).toContain('**eight** engine modules')

    // Not just the count — the SHAPE. One entry point, and the six the contract
    // assigns to the caller. A seventh engine module sneaking back in would keep
    // the count at 7 only by displacing one of these.
    expect(mods, 'the entry point itself must be imported').toContain('plan/engine')
    // NO-RUNNER-TURNED-AWAY-01 (2026-10-24): the eighth is `fetchWeeklyLoad`, the activity-log READ the base-build
    // checkpoint needs. It is IO, so it is the caller's under ADR-003; the decision it feeds (`evaluateCheckpoint`) is
    // behind the engine's door with everything else.
    // ENRICH-RESTORE-REPAIR-01 (2026-10-28): the repair ladder moved from the route into `plan/enrichRepair`,
    // which replaces `plan/enrichPartialRevert` here; still the caller's (it repairs AI copy).
    for (const m of ['plan/enrich', 'plan/enrichAttribution', 'plan/enrichRepair',
                     'plan/enrichServerSave', 'plan/freeIntro', 'plan/canUseFeature', 'coaching/weeklyActualLoad']) {
      expect(mods, `${m} is the CALLER's and must stay in the route`).toContain(m)
    }
  })

  it('adjust-plan imports FIVE engine modules, and the contract says so', () => {
    // 🔴 This claim said TEN, then FOURTEEN, and it is FIVE now
    // (ADJUST-ENGINE-ENTRY-01). It said ten and nothing read it at all: 9 of the
    // 14 were `@/lib/coaching/*`, invisible to the reader written to protect the
    // claim beside it.
    const mods = directModules('app/api/adjust-plan/route.ts')
    expect(
      mods.size,
      `adjust-plan imports ${mods.size} engine modules, not 5 — update the contract. ` +
      `Found: ${Array.from(mods).sort().join(', ')}`,
    ).toBe(5)
    expect(CONTRACT).toContain('`adjust-plan` five')

    // Not just the count — the SHAPE. One door, plus the four the contract
    // assigns to the caller. A sixth engine module creeping back would hold the
    // count at 5 only by displacing one of these.
    expect(mods, 'the entry point itself must be imported').toContain('coaching/adjustmentEngine')
    for (const m of ['plan/canUseFeature', 'coaching/weeklyActualLoad',
                     'coaching/prompts/planAdjustment', 'coaching/prompts/athleteContext']) {
      expect(mods, `${m} is the CALLER's and must stay in the route`).toContain(m)
    }
  })

  it('🔴 and the BARREL is counted too, so it cannot grow back invisibly', () => {
    // The hole this reader had until 2026-10-15. `getCurrentWeekIndex` is engine
    // and `savePlanForUser` is persistence, and both arrive through one import
    // the old pattern could not see. Pinned so a THIRD symbol cannot join them
    // without this going red — which is how `adjust-plan` would quietly reacquire
    // engine surface while the headline count stayed at five.
    const all = engineModules('app/api/adjust-plan/route.ts')
    expect(all.size, `with the barrel: ${Array.from(all).sort().join(', ')}`).toBe(6)
    expect(all).toContain('plan (barrel)')
    expect(CONTRACT).toContain('six counting the `@/lib/plan` barrel')

    // ⚠️ AND THE SYMBOLS, NOT JUST THE MODULE — the first cut of this arm counted
    // modules and its own comment claimed it stopped a third symbol joining. It
    // did not: a third name added to the SAME import statement leaves the count at
    // six. That is the `a-plausible-name-is-not-a-running-check` class, caught by
    // trying to falsify the claim rather than by reading it.
    const route = readFileSync('app/api/adjust-plan/route.ts', 'utf8')
    const barrel = /import\s*\{([^}]*)\}\s*from\s*'@\/lib\/plan'/.exec(route)
    expect(barrel, 'no `from \'@/lib/plan\'` import found — an arm that matches ' +
      'nothing passes vacuously, which is the hole it replaced').not.toBeNull()
    const symbols = barrel![1].split(',').map(x => x.trim()).filter(Boolean).sort()
    expect(
      symbols,
      'adjust-plan reaches a new symbol through the `@/lib/plan` barrel. Decide which ' +
      'it is: `getCurrentWeekIndex` is engine and is here out of NECESSITY (it scopes ' +
      'the route\'s own queries); `savePlanForUser` is persistence and belongs to the ' +
      'caller. Anything else is engine surface re-entering the route while the headline ' +
      'count stays at five.',
      // PLANS-SINGLE-NOT-MAYBE-01 (2026-10-16): `readPlanJson` joins as the READ twin of
      // `savePlanForUser` — persistence, the caller's, not engine surface.
    ).toEqual(['getCurrentWeekIndex', 'readPlanJson', 'savePlanForUser'])

    // generate-plan has none, and that is a FACT about it rather than an
    // accident: it reaches the engine through `lib/plan/engine.ts` only.
    expect(engineModules('app/api/generate-plan/route.ts')).not.toContain('plan (barrel)')
  })

  it('the entry point is real, callable, and the route does not bypass it', () => {
    // A count can be satisfied by an unused import. This asserts the engine is
    // actually on the path: the route calls it, and it is a function.
    expect(typeof runEngine).toBe('function')
    const route = readFileSync('app/api/generate-plan/route.ts', 'utf8')
    expect(route).toMatch(/runEngine\(\{/)

    // Same for the adaptive engine's door (ADJUST-ENGINE-ENTRY-01).
    expect(typeof runAdjustmentEngine).toBe('function')
    const adjust = readFileSync('app/api/adjust-plan/route.ts', 'utf8')
    expect(adjust).toMatch(/runAdjustmentEngine\(\{/)
  })
})
