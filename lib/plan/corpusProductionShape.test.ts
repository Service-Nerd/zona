import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { dirname, join, resolve, relative } from 'path'
import { cohortGrid, targetedGrid } from './cohortGrid'
import { slowGoalGrid, slowGoalDates } from './slowGoalGrid'
import { PLAN_PERSONAS, charityInput } from './charityCohort'
import { fullEnvelope } from './useCaseEnvelope'
import { FITNESS_RANK } from './fitnessAssessment'
import { derivedLevelsFor } from './ruleEngine'
import type { GeneratorInput } from '@/types/plan'

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
    'lib/plan/invariants.ts':
      'validateReshapedPlan reconstructs a legacy input from plan meta; `meta.fitness_level` IS '
      + 'the level the plan was built at, post-declaration, so reading it back is correct',
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
