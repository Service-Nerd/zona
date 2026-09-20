// Sweep input coverage — proposal #4 of the 2026-09-03 test-coverage set.
//
// THE DEFECT CLASS THIS EXISTS FOR. The property sweep reports "18,059 plans, 0
// violations" and that reads as safety. It is only safety for the inputs the grid
// actually varies. Four times now a field has been held CONSTANT across every
// swept plan, making an entire branch unreachable while the run stayed green:
//
//   • `blocked_days`      — misnamed, so the real field was never set
//   • `fitness_level`     — always present, so the engine's own assessment path
//                           (and the whole §79 structural-vs-intensity split) was
//                           never reached; §79-PEAKKM's "byte-identical" sweep
//                           result meant NO COVERAGE, not safety
//   • `max_weekday_mins`  — tried 45/60/90 while both real users had chosen 30;
//                           three INV-PLAN-MAX-WEEKDAY-MINS defects shipped behind
//                           a green sweep in one day
//   • `target_time`       — (2026-09-04) set ONCE in `baseInput` for every
//                           distance, handing a 100K runner a 27 sec/km goal pace.
//                           Every goal-paced measurement above 10K was void, and
//                           the sweep called it clean.
//
// The pattern is always the same and is never visible from the result: a grid that
// cannot reach a branch cannot vouch for it, and it reports the same number either
// way. So this makes the *shape of the grid* an assertion.
//
// FIELD NAMES ARE PARSED FROM THE DECLARATION, never listed here. A hardcoded list
// is precisely the defect: someone adds a field, forgets the list, and the new
// field is unswept and invisible — which is how three of the four above happened.
// Parsing `types/plan.ts` means a new field is covered the moment it is declared.

/** A field is covered when the grid produced at least this many distinct values
 *  for it. Two — present-vs-absent counts, and so does one value vs another. */
export const MIN_DISTINCT_VALUES = 2

/** Sentinel for "the grid never set this field".
 *
 *  Cannot collide with a real value: every present value is recorded via
 *  `JSON.stringify`, which wraps strings in quote characters, so a field whose
 *  actual value is the string "absent" records as `"absent"` (with quotes) and
 *  stays distinct from this. Stated because it would otherwise look accidental —
 *  an earlier version used a leading space to force the distinction and the space
 *  did not survive the file write. */
const ABSENT = 'absent'

export interface CoverageReport {
  covered: string[]
  /** Declared, not exempt, and the grid produced fewer than MIN_DISTINCT_VALUES. */
  uncovered: { field: string; distinct: number; sample: string }[]
  exempt: string[]
  /** Exemptions naming a field that no longer exists — the exemption list rotting. */
  staleExemptions: string[]
  /**
   * SWEEP-AGE-01 (2026-09-20) — NUMERIC AXES THAT NEVER CROSS A THRESHOLD THE
   * ENGINE BRANCHES ON.
   *
   * ⚠️ THE GATE ABOVE PASSED FOR A YEAR WHILE THE MASTERS COHORT WAS ENTIRELY
   * UNSWEPT. `age` took 35 and 43 — two distinct values, so "covered" — and
   * both are under `MASTERS_AGE_THRESHOLD` (45). **Counting distinct values
   * cannot see that none of them crosses a boundary the engine branches on**,
   * and §3's masters deload cadence had therefore never run in the sweep.
   * It hid 47 violations across five invariants, 25 of them ERROR severity.
   *
   * "Covered" must mean *both sides of every branch*, not *more than one value*.
   */
  uncrossedThresholds: { field: string; threshold: number; label: string; side: 'all below' | 'all at or above' }[]
}

/**
 * Numeric inputs the engine BRANCHES on, and the value it branches at. A sweep
 * that never puts values on both sides of one of these has not swept it.
 *
 * ⚠️ Keep this list honest rather than long: a threshold belongs here only if
 * the engine's behaviour genuinely changes across it. A cosmetic cut-off would
 * make the gate noisy, and a noisy gate gets switched off — which this repo has
 * recorded twice as equivalent to having no gate.
 */
export const BRANCHING_THRESHOLDS: readonly { field: string; threshold: number; label: string }[] = [
  { field: 'age', threshold: 45, label: 'MASTERS_AGE_THRESHOLD (§3 — masters get a 3-week deload cadence)' },
]

/**
 * Field names of the `GeneratorInput` interface, read out of the TypeScript source.
 *
 * A regex over a type declaration is crude, and it is the right crudeness here: the
 * alternative is a hand-maintained list, which is the failure mode this whole module
 * exists to prevent. `GeneratorInput` is a plain interface with one field per line —
 * there is no Zod schema to reflect over — so this reads the only source of truth
 * that exists. If the interface is ever restructured such that this returns an
 * implausible number of fields, the caller's own sanity check fires (see
 * `assertParsedShape`) rather than the gate silently passing on an empty list.
 */
export function generatorInputFields(typesSource: string): string[] {
  const start = typesSource.indexOf('export interface GeneratorInput {')
  if (start === -1) return []
  const end = typesSource.indexOf('\n}', start)
  if (end === -1) return []
  const body = typesSource.slice(start, end)
  const fields: string[] = []
  for (const line of body.split('\n')) {
    // Exactly two spaces of indent = a top-level member. Deeper indentation is a
    // nested object literal's field and is not a GeneratorInput key.
    const m = /^ {2}([a-z_][A-Za-z0-9_]*)\??:/.exec(line)
    if (m) fields.push(m[1])
  }
  return fields
}

/** Guards against the parser silently returning nothing (a restructured interface,
 *  a moved file). An empty or implausibly short field list would make the gate pass
 *  vacuously, which is the same class of failure it is built to catch. */
export function assertParsedShape(fields: string[], minExpected = 20): void {
  if (fields.length < minExpected) {
    throw new Error(
      `Parsed only ${fields.length} GeneratorInput fields (expected >= ${minExpected}). ` +
      `The interface has probably been restructured — fix the parser in ` +
      `lib/plan/sweepInputCoverage.ts rather than lowering this floor, or the ` +
      `coverage gate passes without checking anything.`)
  }
}

/**
 * How many distinct values the grid produced for each declared field.
 *
 * ABSENCE IS A VALUE. `fitness_level` present-with-three-levels but never absent is
 * NOT covered — that is exactly the §79 gap, where every swept plan supplied the
 * field so the engine's own assessment path never ran.
 */
export function inputCoverage(
  inputs: ReadonlyArray<Record<string, unknown>>,
  declaredFields: readonly string[],
  exemptions: Readonly<Record<string, string>>,
): CoverageReport {
  const seen = new Map<string, Set<string>>()
  for (const f of declaredFields) seen.set(f, new Set())
  for (const input of inputs) {
    for (const f of declaredFields) {
      // `undefined` and a missing key are the same thing to the engine, and both
      // must count as the "absent" value rather than being skipped.
      const v = input[f]
      seen.get(f)!.add(v === undefined ? ABSENT : JSON.stringify(v))
    }
  }

  const covered: string[] = []
  const uncovered: CoverageReport['uncovered'] = []
  for (const f of declaredFields) {
    if (f in exemptions) continue
    const values = seen.get(f)!
    if (values.size >= MIN_DISTINCT_VALUES) covered.push(f)
    else {
      const only = Array.from(values)[0] ?? ABSENT
      uncovered.push({
        field: f,
        distinct: values.size,
        sample: only === ABSENT ? 'never set' : `always ${only}`,
      })
    }
  }

  // SWEEP-AGE-01 — both sides of every branch, not just more than one value.
  const uncrossedThresholds: CoverageReport['uncrossedThresholds'] = []
  for (const { field, threshold, label } of BRANCHING_THRESHOLDS) {
    if (!declaredFields.includes(field)) continue
    let below = false, atOrAbove = false
    for (const input of inputs) {
      const v = input[field]
      if (typeof v !== 'number' || !Number.isFinite(v)) continue
      if (v < threshold) below = true
      else atOrAbove = true
      if (below && atOrAbove) break
    }
    // Neither side seen at all means the field is absent everywhere, which the
    // distinct-value check above already reports. Only a ONE-SIDED axis is new.
    if (below !== atOrAbove) {
      uncrossedThresholds.push({ field, threshold, label, side: below ? 'all below' : 'all at or above' })
    }
  }

  return {
    covered,
    uncovered,
    exempt: Object.keys(exemptions).filter(f => declaredFields.includes(f)),
    staleExemptions: Object.keys(exemptions).filter(f => !declaredFields.includes(f)),
    uncrossedThresholds,
  }
}
