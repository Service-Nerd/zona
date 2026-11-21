import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { dirname, join, resolve, relative } from 'path'
import { cohortGrid, targetedGrid, derivedWeekdayCap } from './cohortGrid'
import { slowGoalGrid, slowGoalDates } from './slowGoalGrid'
import { PLAN_PERSONAS, charityInput } from './charityCohort'
import { fullEnvelope } from './useCaseEnvelope'
import { FITNESS_RANK, recommendFitnessLevel } from './fitnessAssessment'
import { derivedLevelsFor } from './ruleEngine'
import type { GeneratorInput } from '@/types/plan'
import {
  goldenSample, goldenStrata, goldenSpaceSize, goldenRowAt, goldenProductionRows, gcd, strideFor,
  GOLDEN_DEFAULT_PER_GROUP, type GoldenRow,
} from '@/lib/corpus/goldenCorpus'
import { wizardShapeViolations } from './wizardShape'
import {
  WIZARD_DISTANCES, WIZARD_INJURY_WIRE, MAX_WEEKDAY_CHIPS, WIZARD_TRAINING_AGES, WIZARD_RECENT_QUALITY,
  WIZARD_LEVELS, WIZARD_HARD_SESSIONS, WIZARD_TERRAINS,
} from './wizardOptions'

/** A local calendar date from `YYYY-MM-DD` (not `new Date(iso)`, which is UTC midnight). */
const isoDay = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * COHORT-GRID-UNSET-LEVEL-01 — every coaching measurement corpus is shaped like a
 * plan the wizard can actually post.
 *
 * `input.fitness_level` is the API's STRUCTURAL override: supplied, it stands in for
 * the volume-derived assessment and wins outright inside `resolveLevels`. No
 * production caller sets it — `GeneratePlanScreen` sends the runner's level on
 * `user_declared_level`, accepted or overridden, and a declaration binds structure
 * DOWNWARD ONLY (§79). So a corpus that fills the field in measures a runner shape
 * the product cannot build, and every level-gated rule reads as exercised.
 *
 * 🔴 WHAT IT COST, which is why this is a gate and not a note. On 2026-11-03 five
 * rules were found reading the raw field; three had NEVER FIRED FOR ANY RUNNER
 * (§117 Am.5's run-walk prescription, §117's peak reduction, §28 Am.1's hill
 * strides + `INV-PLAN-BEGINNER-NEUROMUSCULAR`, whose own comment calls it "that
 * watch"). Six harnesses reported them working. THREE BOARD RULINGS THE SAME DAY
 * were ratified on level-forced evidence, and the quality instrument itself read
 * marathon at 85.0% while we shipped 79.2%.
 *
 * ⚠️ AND THE CHECKER SHARED THE PRODUCER'S BLIND FIELD, so the property sweep came
 * back clean VACUOUSLY: the engine prescribed nothing and the invariant skipped.
 * A corpus is the only place this can be caught.
 */

const ROOT = resolve(__dirname, '../..')

/** ARM 1 — the corpora themselves, behaviourally. A row is the unit, not a line of
 *  source: a source assertion passes on a comment, and this file is full of them. */
const CORPORA: { name: string; rows: () => Record<string, unknown>[] }[] = [
  { name: 'cohortGrid', rows: () => cohortGrid() as unknown as Record<string, unknown>[] },
  { name: 'targetedGrid', rows: () => targetedGrid() as unknown as Record<string, unknown>[] },
  { name: 'slowGoalGrid', rows: () => {
      const { planStart, benchmarkDate } = slowGoalDates()
      return slowGoalGrid(planStart, benchmarkDate) as unknown as Record<string, unknown>[]
    } },
  { name: 'charity + engine personas', rows: () =>
      PLAN_PERSONAS.map(p => charityInput(p) as unknown as Record<string, unknown>) },
  { name: 'useCaseEnvelope', rows: () =>
      fullEnvelope().map(c => c.input as unknown as Record<string, unknown>) },
]

describe('COHORT-GRID-UNSET-LEVEL-01 — corpora carry the production level shape', () => {
  for (const c of CORPORA) {
    it(`${c.name}: no row sets the API structural override`, () => {
      const rows = c.rows()
      expect(rows.length).toBeGreaterThan(0)
      const offenders = rows.filter(r => r.fitness_level !== undefined)
      expect(
        offenders.length,
        `${offenders.length} of ${rows.length} rows set \`fitness_level\`. The wizard sends `
        + '`user_declared_level`; this field is the API structural override and forces '
        + 'structural === intensity, which is how five rules shipped never having fired.',
      ).toBe(0)
    })
  }

  /**
   * ARM 2 — THE LIST ABOVE IS COMPLETE, and the population is DERIVED, never listed.
   *
   * Arm 1 can only see the corpora someone remembered to import here. This walks the
   * import closure of every script behind the coaching gates — resolved from
   * `package.json` and from `review-coaching.ts`'s own step table, so it moves when
   * they move — and fails on any non-comment write of `fitness_level` that is not
   * exempt WITH A REASON.
   *
   * It is the arm that would have caught `measure-plan-fitness.ts`'s hand-built
   * injury × masters cohort, which is not a grid, lives in a script, and was the
   * sixth blind harness nobody had enumerated.
   */
  const EXEMPT: Record<string, string> = {
    'lib/plan/inputs.ts':
      '§55 enum validation table — the ALLOWED VALUES for the field, not an input carrying it',
    // STORED-PLAN-VALIDATOR-INPUT-01 (2026-11-08) — THE EXEMPTION MOVED WITH THE CODE. The
    // reconstruction was inline in `invariants.ts` and is now its own owner, because eight
    // scripts that validate stored plans were hand-building the input instead and so got
    // neither the kind dispatch nor this merge. ⚠️ The exemption is the SAME exemption, now
    // naming the file that holds the writes; `invariants.ts` stays listed because the gate's
    // own closure still reaches it and a removed-but-still-needed entry is a hole.
    'lib/plan/storedPlanInput.ts':
      'THE owner of "what input was this STORED plan built from". `meta.fitness_level` IS the '
      + 'level the plan was built at, post-declaration, so reading it back is correct — and it '
      + 'is read meta-FIRST precisely because the persisted input is often absent (§79)',
    'lib/plan/invariants.ts':
      'validateReshapedPlan delegates the reconstruction to storedPlanInput.ts; any remaining '
      + 'mention here is the call or its explanatory comment',
    'lib/plan/ruleEngine.ts':
      'the engine STAMPING meta.fitness_level on its own output — the write this whole item '
      + 'relies on, since every checker reads meta first',
    // ── The two corpora that SET it on purpose, measured 2026-11-03 ──────────────
    'scripts/property-validate-plans.ts':
      'the sweep varies it DELIBERATELY: `fitnessSets = [undefined, beginner, intermediate, '
      + 'experienced]` crossed with an independent `declaredSets`, so 1/4 of cases are '
      + 'production-shaped and the API-override path keeps its only coverage (§79, 2026-09-02)',
    'scripts/r23-phase7-validation.ts':
      'a declared ARCHETYPE matrix keyed BY level — 11 of its 17 cases set the field as part of '
      + 'the archetype, and 6 take the assessment path carrying explicit `derived_structural` / '
      + '`derived_intensity` assertions (SWEEP-COVERAGE-02). Both paths are covered on purpose',
  }

  const stripComments = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
      .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')

  const resolveLocal = (fromFile: string, spec: string): string | null => {
    const base = spec.startsWith('@/') ? join(ROOT, spec.slice(2))
      : spec.startsWith('.') ? resolve(dirname(fromFile), spec)
      : null
    if (!base) return null
    for (const cand of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
      if (existsSync(cand)) return relative(ROOT, cand)
    }
    return null
  }

  const gateClosure = (): string[] => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts as Record<string, string>
    // 🔴 `verify:sweep` AND `verify:matrix` WERE OUTSIDE THIS LIST (code review,
    // 2026-11-03) — 15 writes between them, exempt by my prose and by nothing
    // mechanical. They ARE deliberately exempt, and the exemption now lives in
    // `EXEMPT` with its measured reason, where a reviewer reads it and the
    // stale-exemption arm below keeps it honest.
    const GATE_KEYS = ['review:coaching', 'cohort:shape', 'measure:fitness', 'invariant:liveness',
      'review:cohort', 'measure:envelope', 'audit:plans', 'check:slow',
      'verify:sweep', 'verify:matrix']
    const entries = new Set<string>()
    const addFrom = (cmd: string) => {
      for (const m of Array.from((cmd ?? '').matchAll(/scripts\/[\w.-]+\.ts/g))) entries.add(m[0])
    }
    for (const k of GATE_KEYS) addFrom(pkg[k])
    // `review:coaching` shells out to its steps, so its own source names them.
    const rc = readFileSync(join(ROOT, 'scripts/review-coaching.ts'), 'utf8')
    addFrom(rc)
    for (const m of Array.from(rc.matchAll(/npm run --silent ([\w:-]+)/g))) addFrom(pkg[m[1]])

    const seen = new Set<string>()
    const queue = Array.from(entries)
    while (queue.length) {
      const f = queue.pop()
      if (!f || seen.has(f) || !existsSync(join(ROOT, f))) continue
      seen.add(f)
      const src = readFileSync(join(ROOT, f), 'utf8')
      for (const m of Array.from(src.matchAll(/from\s+['"]([^'"]+)['"]/g))) {
        const r = resolveLocal(join(ROOT, f), m[1])
        if (r && !seen.has(r)) queue.push(r)
      }
    }
    return Array.from(seen).sort()
  }

  it('no module reachable from a coaching gate sets `fitness_level` unexempted', () => {
    const closure = gateClosure()
    // Falsifiable on its own terms: a closure that collapsed to the entry scripts
    // would pass vacuously.
    expect(closure.length).toBeGreaterThan(50)
    expect(closure).toContain('lib/plan/cohortGrid.ts')
    expect(closure).toContain('lib/plan/slowGoalGrid.ts')
    expect(closure).toContain('scripts/measure-plan-fitness.ts')
    // The two exempted corpora must be IN the closure, or their exemption is decorative
    // and the stale-exemption arm below is the only thing holding them.
    expect(closure).toContain('scripts/property-validate-plans.ts')
    expect(closure).toContain('scripts/r23-phase7-validation.ts')

    const hits: string[] = []
    for (const f of closure) {
      if (EXEMPT[f]) continue
      // ANCHOR ON THE NAME. `fitness_level_min` / `fitness_level_declared` /
      // `fitness_intensity_level` are different fields, and matching a substring is
      // this repo's most-recorded check defect.
      //
      // 🔴 AND IT MUST MATCH A SHORTHAND PROPERTY, WHICH MY FIRST VERSION DID NOT.
      // It required `fitness_level\s*:`, so `{ benchmark, fitness_level, days }` was
      // invisible — and that is **exactly the form `slowGoalGrid.ts` used before this
      // commit**, in one of the five corpora this gate exists to hold. Falsified by a
      // reviewer putting a shorthand write into `measure-plan-fitness.ts`, the file
      // arm 2's own comment names as its reason to exist: the gate stayed green.
      // So: a colon write, a bare shorthand (followed by `,` or `}`), or an
      // assignment. A destructuring READ (`const { fitness_level } = x`) is excluded
      // by the `{`-lookbehind being absent from the shorthand arm's own start anchor,
      // which is why the preceding character is checked.
      stripComments(readFileSync(join(ROOT, f), 'utf8')).split('\n').forEach((l, i) => {
        const colon = /(?<![A-Za-z_])fitness_level\s*:/.test(l)
        // ⚠️ A WRITE TO `meta.fitness_level` IS NOT AN INPUT WRITE, and the distinction
        // is principled rather than a per-file blanket (this repo records that a blanket
        // skip is a hole). `plan.meta.fitness_level` is the level the plan was BUILT at,
        // post-declaration — the engine stamps it and every checker reads it first — so
        // the liveness battery poking it to forge a §79 mismatch is exactly right.
        // The file stays in scope, so a genuine INPUT write there still fires.
        const assign = /(?<![A-Za-z_])fitness_level\s*=[^=]/.test(l)
          && !/(?:^|[^A-Za-z_])meta\s*(?:\[[^\]]*\]\s*)?\.\s*fitness_level\s*=/.test(l)
        // Shorthand: `, fitness_level,` or `, fitness_level }` — a property position,
        // never a destructuring target (those sit after a `{` with no leading comma on
        // the same token, and are reads, not writes).
        const shorthand = /,\s*fitness_level\s*[,}]/.test(l)
        if (colon || assign || shorthand) hits.push(`${f}:${i + 1}  ${l.trim()}`)
      })
    }
    expect(hits, `unexempted \`fitness_level\` writes reachable from a coaching gate:\n${hits.join('\n')}`)
      .toEqual([])
  })

  it('every exemption still names a real file (a stale exemption is a hole)', () => {
    for (const f of Object.keys(EXEMPT)) expect(existsSync(join(ROOT, f)), f).toBe(true)
  })

  /**
   * ARM 3 — THE POSITIVE CLAIM, because arms 1 and 2 are satisfied by DELETING the
   * level axis altogether, which would be a worse corpus than the one we had.
   *
   * §79's whole reason for existing is that the two signals can disagree. With the
   * field forced, `structural === intensity` on every row of `cohortGrid` — the
   * split was unreachable by `cohort:shape`, `measure:fitness`, `invariant:liveness`,
   * `audit:plans` and the strength sweep. And `targetedGrid` was beginner-structural
   * on all 6,144 rows, which made its own `user_declared_level` axis — added by
   * GRID-COVERAGE-02 Phase 2 to reach exactly that path — inert on structure.
   */
  // ⚠️ `derivedLevelsFor`, NOT `resolveLevels`: it is the owner that composes
  // `vdotFor` first, and it is what the engine builds the plan with. Half of
  // `cohortGrid` carries a benchmark, and without the VDOT these shares read 25.0%
  // instead of 45.8% — my own first measurement of this change was the lower number
  // for exactly that reason.
  it('cohortGrid reaches §79’s two-band cell (structural ≠ intensity)', () => {
    const rows = cohortGrid()
    const split = rows.filter(i => {
      const lv = derivedLevelsFor(i as unknown as GeneratorInput)
      return lv.structural !== lv.intensity
    })
    // Measured 2026-11-03: 19,008 of 41,472 (45.8%). A FLOOR, and asserted as a
    // share so a grid widening does not need this line edited. The forced field
    // gives exactly 0.
    expect(split.length / rows.length).toBeGreaterThan(0.4)
  })

  /**
   * And the OVER-CLAIM shape specifically — declared ABOVE the assessed structural
   * level — because that is what §79 Am.3's withholding of VO2max and hills is gated
   * on, and it is the one shape `targetedGrid` LOST by this change (its forced
   * `fitness_level: 'beginner'` floored structure, so all three of its upward
   * declarations were upward from beginner). Measured: `cohortGrid` now carries
   * 13,824 such rows where it carried 0, so the mechanism moved corpus rather than
   * going unreached — asserted here so a future grid edit cannot drop it silently.
   */
  it('the §79 Am.3 over-claim shape is reached (declared > assessed structural)', () => {
    const rows = cohortGrid()
    const over = rows.filter(i => {
      const lv = derivedLevelsFor(i as unknown as GeneratorInput)
      return lv.declared !== undefined
        && FITNESS_RANK[lv.declared] > FITNESS_RANK[lv.assessedStructural]
    })
    expect(over.length / rows.length).toBeGreaterThan(0.25)
  })

  it('targetedGrid holds both structural bands, so its declared-level axis bites', () => {
    const bands = new Set(targetedGrid().map(i => derivedLevelsFor(i as unknown as GeneratorInput).structural))
    expect(Array.from(bands).sort()).toEqual(['beginner', 'intermediate'])
  })
})

/**
 * GRID-DAY-BUDGET-NO-CAP-01 — the SECOND field, same class.
 *
 * `day_budgets` and `max_weekday_mins` are not independent inputs: the wizard derives
 * the second from the first (`weekPlanToInputs`, the MINIMUM across the weekdays the
 * runner actually runs) and posts both. A corpus that sends only the budgets measures a
 * runner the product cannot build, and specifically makes every rule gated on
 * `input.max_weekday_mins != null` read as unexercised.
 *
 * 🔴 WHAT IT COST: the plan-level §81 weekday-overrun detector opens
 * `if (!cap) return null`. `targetedGrid` was the ONLY corpus anywhere carrying per-day
 * budgets, and on all 3,072 of its budgeted rows that detector returned null — so the
 * corpus built to reach per-day budgets was the one corpus structurally blind to the
 * note those budgets break. Measured: 614 of 810 firings of that note are FALSE in
 * production shape (STRUCTURAL-NOTE-DAY-BUDGET-01), and no corpus could see one.
 *
 * ⚠️ NARROWER THAN THE FIRST READ. `scripts/property-validate-plans.ts:511` already does
 * `max_weekday_mins: Math.min(...Object.values(db))`, and the coach-review canonical cases
 * carry `// = min(day_budgets), what the wizard sends today` beside the value. ONE corpus
 * was wrong, not six — stated because the `fitness_level` arm above found six and the
 * temptation is to assume the same breadth twice.
 */
describe('GRID-DAY-BUDGET-NO-CAP-01 — day_budgets never travels without its derived cap', () => {
  for (const c of CORPORA) {
    it(`${c.name}: every row with day_budgets carries max_weekday_mins = min(running weekdays)`, () => {
      const rows = c.rows()
      expect(rows.length).toBeGreaterThan(0)
      const budgeted = rows.filter(r => r.day_budgets != null)
      // Not every corpus sets per-day budgets, and that is fine — the claim is
      // conditional. But the arm must say which corpora it actually exercised, or a
      // grid that drops the axis turns this green by selecting nothing.
      const offenders = budgeted.filter(r => {
        const want = derivedWeekdayCap(
          r.day_budgets as Record<'mon', number>,
          (r.days_cannot_train as string[]) ?? [],
        )
        return r.max_weekday_mins !== want
      })
      expect(
        offenders.length,
        `${offenders.length} of ${budgeted.length} budgeted rows in ${c.name} do not carry the `
        + 'cap the wizard derives from those budgets. `weekPlanToInputs` sends both; a corpus '
        + 'that sends only `day_budgets` leaves `input.max_weekday_mins` undefined, and every '
        + 'rule gated on it — the plan-level §81 overrun detector among them — reads as '
        + `exercised while firing for nobody. First offender: ${JSON.stringify(offenders[0] ?? null)}`,
      ).toBe(0)
    })
  }

  /**
   * 🔴 `derivedWeekdayCap` IS NOT THE WHOLE PRODUCTION DERIVATION, so the condition that keeps
   * it equivalent is asserted rather than assumed (`/code-review`, 2026-11-08).
   *
   * The wizard takes `min(dayBudgets[d] ?? weekdayDefaultMins)` — it falls back to the single
   * chip the runner picked for "a weekday". This helper has no default, so a PARTIAL shape such
   * as `{ tue: 90 }` against a 35-minute default yields 90 here and 35 in production, and the
   * arms above would certify that as production shape. It is latent only because every budget
   * shape in `cohortGrid.ts` covers all five weekdays. This is the arm that makes that a
   * requirement instead of a coincidence.
   */
  it('every budgeted row budgets EVERY weekday, which is what makes the derived cap equivalent', () => {
    const rows = targetedGrid().filter(r => (r as { day_budgets?: unknown }).day_budgets != null)
    expect(rows.length).toBeGreaterThan(0)
    const partial = rows.filter(r => {
      const b = (r as { day_budgets: Record<string, number> }).day_budgets
      const rest = new Set(((r as { days_cannot_train?: string[] }).days_cannot_train ?? [])
        .map(d => String(d).slice(0, 3).toLowerCase()))
      return (['mon', 'tue', 'wed', 'thu', 'fri'] as const).some(d => !rest.has(d) && b[d] == null)
    })
    expect(
      partial.length,
      `${partial.length} budgeted rows leave a running weekday without a budget. `
      + '`derivedWeekdayCap` has no `weekdayDefaultMins` to fall back to, so its answer would '
      + 'diverge from the wizard\'s and the pairing arms above would certify a shape production '
      + 'cannot post. Either budget every running weekday, or teach the helper the default.',
    ).toBe(0)
  })

  /** The population, asserted. `targetedGrid` is the only corpus with per-day budgets today,
   *  so if it ever stops carrying them the arm above passes on an empty set and says nothing. */
  it('targetedGrid is still the corpus that exercises per-day budgets', () => {
    const rows = targetedGrid()
    const budgeted = rows.filter(r => (r as { day_budgets?: unknown }).day_budgets != null)
    expect(budgeted.length).toBeGreaterThan(0)
    // And the cap it derives is the minimum, not one of the roomier days: the whole
    // defect is that 30 is quoted at a session sitting on the 60-minute Thursday.
    expect(new Set(budgeted.map(r => (r as { max_weekday_mins?: number }).max_weekday_mins)))
      .toEqual(new Set([30]))
  })
})

/**
 * ADR027-B0-GOLDEN-CORPUS — THE GENERAL FORM OF THE TWO ARMS ABOVE (ARCH-ENG-007).
 *
 * Both describes above are one instance each of "this corpus row could not have come from the
 * wizard". `wizardShapeViolations` is the general check, read off `handleGenerate` and the owners
 * it calls, and `goldenCorpus.ts` is the corpus built FROM those owners. Three arms:
 *
 *   1. the golden corpus is wizard-shaped: 0 violations, every row, and it is spread;
 *   2. the predicate REFUSES what it says it refuses (planted defects, one per code that matters);
 *   3. the EXISTING corpora, measured and declared — not fixed and not failed today.
 *
 * ⚠️ Arm 3 is a DECLARED BASELINE, not a pass. Every row of every existing corpus is off the
 * wizard's shape (measured 2026-11-21, below), most for reasons no gate has looked at before:
 * no `preferred_long_run_day`, a `days_available` that is not 7 minus the rest days, an empty
 * `injury_history` list. ADR-027 B3 migrates the coaching harnesses onto the golden corpus;
 * until then this pins the debt so it cannot grow silently and must be re-declared to shrink.
 */
describe('ADR027-B0 — the golden corpus is wizard-shaped, and the predicate is falsifiable', () => {
  const golden = goldenSample()
  const shape = (r: GoldenRow) => wizardShapeViolations(r.input, { tier: r.tier, today: isoDay(r.asOf) })

  it('every golden wizard row passes wizardShapeViolations', () => {
    expect(golden.length).toBe(GOLDEN_DEFAULT_PER_GROUP * 9)
    const bad = golden.map(r => ({ id: r.id, v: shape(r) })).filter(x => x.v.length)
    expect(bad.length, `first: ${JSON.stringify(bad[0] ?? null)}`).toBe(0)
  })

  it('no golden row sets the structural override, and every row carries the declared level', () => {
    expect(golden.filter(r => 'fitness_level' in r.input).length).toBe(0)
    expect(golden.every(r => r.input.user_declared_level !== undefined)).toBe(true)
  })

  it('the space is the product of its axes, too big for a number, and enumerable by index', () => {
    const strata = goldenStrata()
    expect(strata.length).toBe(18)   // free × 3 tiles + paid × 6 tiles, × budget none|set
    const total = goldenSpaceSize()
    expect(total).toBe(strata.reduce((n, s) => n + s.size, BigInt(0)))
    expect(total > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true)
    // The first and last index decode, and one past the end refuses rather than wrapping.
    expect(goldenRowAt(BigInt(0)).id).toBe('w:free:5:none:0')
    expect(goldenRowAt(total - BigInt(1)).source).toBe('wizard')
    expect(() => goldenRowAt(total)).toThrow(RangeError)
  })

  it('every stratum stride is coprime with its size — an even stride would alias', () => {
    for (const s of goldenStrata()) {
      expect(gcd(strideFor(s.size), s.size), `${s.tier}:${s.distanceKm}:${s.budget}`).toBe(BigInt(1))
      // Falsifier, on the real sizes: every stratum size is even, so the naive power-of-two
      // stride the `even-stride-aliases` lesson names would share a factor with every one.
      expect(gcd(BigInt(32), s.size) > BigInt(1)).toBe(true)
    }
  })

  it('the sample is deterministic', () => {
    expect(goldenSample().map(r => r.id)).toEqual(golden.map(r => r.id))
  })

  it('the sample reaches every answer it is built from', () => {
    const seen = <T>(f: (r: GoldenRow) => T) => new Set(golden.map(f))
    expect(seen(r => r.input.race_distance_km)).toEqual(new Set(WIZARD_DISTANCES.map(d => d.value)))
    expect(seen(r => r.input.days_available)).toEqual(new Set([1, 2, 3, 4, 5, 6, 7]))
    expect(seen(r => r.input.preferred_long_run_day)).toEqual(new Set(['sat', 'sun']))
    // Blocked weekends: both weekend days rest, so the long run defaults to a resting Sunday.
    expect(golden.some(r => r.input.days_cannot_train?.includes('saturday')
      && r.input.days_cannot_train?.includes('sunday'))).toBe(true)
    expect(seen(r => r.input.max_weekday_mins)).toEqual(new Set(MAX_WEEKDAY_CHIPS.map(c => c.mins)))
    expect(golden.some(r => r.input.day_budgets)).toBe(true)
    expect(seen(r => r.input.age).has(undefined)).toBe(true)
    expect(seen(r => r.input.age).size).toBeGreaterThan(60)
    const injuries = new Set(golden.flatMap(r => r.input.injury_history ?? []))
    expect(injuries).toEqual(new Set(WIZARD_INJURY_WIRE))
    expect(seen(r => r.input.training_age)).toEqual(new Set([undefined, ...WIZARD_TRAINING_AGES]))
    expect(seen(r => r.input.recent_quality_training)).toEqual(new Set([undefined, ...WIZARD_RECENT_QUALITY]))
    expect(seen(r => r.input.user_declared_level)).toEqual(new Set(WIZARD_LEVELS))
    expect(seen(r => r.input.hard_session_relationship)).toEqual(new Set([undefined, ...WIZARD_HARD_SESSIONS]))
    expect(seen(r => r.input.terrain)).toEqual(new Set([undefined, ...WIZARD_TERRAINS]))
    expect(seen(r => r.input.goal)).toEqual(new Set(['finish', 'time_target']))
    expect(seen(r => r.foundation_choice)).toEqual(new Set(['add', 'as_is']))
    expect(seen(r => isoDay(r.input.race_date).getDay())).toEqual(new Set([0, 1, 2, 3, 4, 5, 6]))
    const bench = seen(r => !r.input.benchmark ? 'none'
      : `${r.input.benchmark.type}:${r.input.benchmark.benchmark_date ? 'dated' : 'undated'}`)
    expect(bench).toEqual(new Set(['none', 'race:dated', 'race:undated', 'tt_30min:dated', 'tt_30min:undated']))
    // The recommendation is ACCEPTED on some rows and OVERRIDDEN on others.
    const accepted = golden.filter(r => r.input.user_declared_level === recommendFitnessLevel(
      r.input.current_weekly_km, r.input.longest_recent_run_km,
      r.input.training_age === '2-5yr' || r.input.training_age === '5yr+').level).length
    expect(accepted).toBeGreaterThan(0)
    expect(accepted).toBeLessThan(golden.length)
    // A free row never carries a paid-only answer or a paid distance.
    expect(golden.filter(r => r.tier === 'free'
      && (r.input.hard_session_relationship || r.input.terrain || r.input.race_distance_km > 21.1)).length).toBe(0)
  })

  /** The planted defects: start from a CLEAN golden row (asserted), break one thing, and the
   *  predicate must name it. A check that only ever saw clean rows has not been shown to work. */
  describe('the predicate refuses each planted defect', () => {
    const base = golden.find(r => r.input.days_cannot_train && r.input.injury_history && r.tier === 'paid')!
    const plant = (patch: Record<string, unknown>) =>
      wizardShapeViolations({ ...base.input, ...patch }, { tier: base.tier, today: isoDay(base.asOf) }).map(v => v.code)

    it('the base row is clean', () => { expect(shape(base)).toEqual([]) })
    it('fitness_level set', () => { expect(plant({ fitness_level: 'intermediate' })).toContain('FITNESS_LEVEL_SET') })
    it('a day split that is not 7 − rest days', () => {
      expect(plant({ days_available: base.input.days_available + 1 })).toContain('DAY_SPLIT')
    })
    it('a weekly km off the ruler', () => {
      expect(plant({ current_weekly_km: base.input.current_weekly_km + 1 })).toContain('WEEKLY_KM_OFF_RULER')
    })
    it('an injury spelling no chip posts', () => {
      expect(plant({ injury_history: ['shin_splints'] })).toContain('INJURY_SPELLING')
    })
    it('weeks_at_current_volume set', () => {
      expect(plant({ weeks_at_current_volume: 8 })).toContain('WEEKS_AT_VOLUME_SET')
    })
    it('short day names', () => { expect(plant({ days_cannot_train: ['mon'] })).toContain('REST_DAY_SPELLING') })
    it('budgets without the cap derived from them', () => {
      const running = (['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const)
        .find(d => !base.input.days_cannot_train!.includes(d))!
      expect(plant({ day_budgets: { [running.slice(0, 3)]: 45 }, max_weekday_mins: undefined }))
        .toContain('DAY_BUDGETS_WITHOUT_CAP')
    })
    it('a paid-only answer on a free row', () => {
      expect(wizardShapeViolations({ ...base.input, hard_session_relationship: 'love' }, { tier: 'free' })
        .map(v => v.code)).toContain('PAID_ONLY_FIELD')
    })
  })

  /**
   * The four production-captured inputs. They ARE product-path rows, from earlier wizard
   * versions; one predates the week grid (`days_available` 3 beside two SHORT rest-day names, and
   * no `user_declared_level`). Declared, so a fifth capture that is off-shape is noticed.
   */
  it('production rows: the declared legacy deviations, and nothing else', () => {
    const got = Object.fromEntries(goldenProductionRows().map(r => [r.id, shape(r).map(v => v.code)]))
    expect(got).toEqual({
      'p:8333720c': ['MISSING_FIELD', 'REST_DAY_SPELLING', 'DAY_SPLIT'],
      'p:731f2878': [],
      'p:c29db5d6': [],
      'p:e876c470': [],
    })
  })

  /**
   * ARM 3 — the existing corpora, measured 2026-11-21. Rows-per-code (a row counts once per code).
   * ⚠️ EVERY row of all five is off-shape. Equality, not a ceiling: a grid edit that changes these
   * must re-declare them here with its reason, which is how a ratchet stays honest in both
   * directions. ADR-027 B3 migrates the harnesses; do not "fix" a grid to turn this green.
   */
  const EXISTING_BASELINE: Record<string, { rows: number; codes: Record<string, number> }> = {
    cohortGrid: { rows: 41472, codes: {
      UNKNOWN_KEY: 41472, MISSING_FIELD: 41472, DAY_SPLIT: 41472, INJURY_SHAPE: 41472, REST_DAYS_SHAPE: 13824 } },
    targetedGrid: { rows: 6170, codes: {
      UNKNOWN_KEY: 6170, MISSING_FIELD: 6170, REST_DAYS_SHAPE: 6170, DAY_SPLIT: 6170, INJURY_SHAPE: 1556,
      FOUNDATION_DECISION_SET: 4608, WEEKS_AT_VOLUME_SET: 4608, INJURY_SPELLING: 4614, WEEKLY_KM_OFF_RULER: 3 } },
    slowGoalGrid: { rows: 960, codes: {
      UNKNOWN_KEY: 960, MISSING_FIELD: 960, TARGET_TIME_FORMAT: 300, DAY_SPLIT: 960, INJURY_SHAPE: 960,
      TRAINING_AGE_ENUM: 960 } },
    'charity + engine personas': { rows: 21, codes: {
      MISSING_FIELD: 21, DAY_SPLIT: 21, WEEKS_AT_VOLUME_SET: 1, WEEKLY_KM_OFF_RULER: 3, INJURY_SHAPE: 1,
      INJURY_SPELLING: 1, TARGET_TIME_FORMAT: 1 } },
    useCaseEnvelope: { rows: 33792, codes: {
      UNKNOWN_KEY: 33792, MISSING_FIELD: 33792, DAY_SPLIT: 33792, INJURY_SHAPE: 8448, INJURY_SPELLING: 8448,
      WEEKLY_KM_OFF_RULER: 7680 } },
  }

  it('the baseline names every corpus in CORPORA, so a new corpus must declare itself', () => {
    expect(Object.keys(EXISTING_BASELINE).sort()).toEqual(CORPORA.map(c => c.name).sort())
  })

  for (const c of CORPORA) {
    it(`${c.name}: off-shape rows match the declared baseline (B3 migrates them)`, () => {
      const rows = c.rows()
      const codes: Record<string, number> = {}
      let off = 0
      for (const r of rows) {
        const v = wizardShapeViolations(r)
        if (v.length) off++
        for (const code of Array.from(new Set(v.map(x => x.code)))) codes[code] = (codes[code] ?? 0) + 1
      }
      const want = EXISTING_BASELINE[c.name]
      expect({ total: rows.length, off, codes }).toEqual({ total: want.rows, off: want.rows, codes: want.codes })
    })
  }
})
