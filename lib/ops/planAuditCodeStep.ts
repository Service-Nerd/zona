/**
 * AUDIT-STEP-UNDECLARED-01 — when `invalid` RISES, say WHICH RULE IS NEW.
 *
 * 🔴 THE DEFECT THIS EXISTS FOR, MEASURED FROM `ops_events` (2026-10-10). The
 * audit's `invalid` count went **15 → 20 on 2026-10-06 with `checked` FLAT at 30**
 * — five plans became invalid with no plans added. Cause:
 * `INV-PLAN-PEAK-RACE-SPECIFIC-REACHED` shipped at 13:55 that day (`e56f8e7a`,
 * MARATHON-PEAK-ROTATION-01, §93 Am.1) at severity `error`, and the audit ran 34
 * minutes later. It appears on 6 plans from 10-06 and on NONE on 10-04.
 *
 * ⚠️ A NEW ERROR-SEVERITY INVARIANT JUDGING EXISTING PLANS IS CORRECT BEHAVIOUR.
 * The live-plan policy says doctrine is never backfilled, so an older plan
 * breaches a newer constitution BY DESIGN — that is the whole reason
 * `summarisePlanAges` exists. The defect is that the step was never DECLARED, so
 * four days later the daily digest reported the elevated number and reached for
 * the only explanation it had: *"this most likely reflects the audit seeing more
 * plans, not a new defect."* `checked` was flat. It was not coverage.
 *
 * ⚠️ ABSENT WHEN THERE IS NOTHING TO SAY, not present-and-empty — the same rule
 * `repairable` already follows in the route, and for the same reason: a digest
 * line that reads "new codes: 0" every morning is the noise this field exists to
 * avoid being.
 *
 * 🔴 AND ABSENT WHEN THERE IS NO BASELINE, which is the arm that matters. With no
 * previous summary every code is "new", so a first run — or a run after the
 * history window rolls past the last summary — would declare the entire
 * constitution as a step. That is worse than silence, because it is a confident
 * wrong answer. `codes_new_since_last_run` therefore requires a prior set to
 * compare against.
 */
export interface CodeStep {
  /** Every distinct violation code seen across breaching plans this run, sorted. */
  codes_seen: string[]
  /** Codes present now and ABSENT from the previous run. Omitted when empty or unknowable. */
  codes_new_since_last_run?: string[]
}

export function summariseCodeStep(input: {
  /** Codes from every breaching plan this run; duplicates and bare/suffixed forms welcome. */
  codesThisRun: readonly string[]
  /** `codes_seen` from the previous summary event, or null when there is no baseline. */
  prevCodesSeen: readonly string[] | null
}): CodeStep {
  const seen = normalise(input.codesThisRun)
  // No baseline → no claim. See the block above.
  if (input.prevCodesSeen == null) return { codes_seen: seen }
  const prev = new Set(normalise(input.prevCodesSeen))
  const fresh = seen.filter(c => !prev.has(c))
  return fresh.length ? { codes_seen: seen, codes_new_since_last_run: fresh } : { codes_seen: seen }
}

/**
 * Distinct, sorted, and stripped of the per-site suffix.
 *
 * ⚠️ `INV-INPUT-LONGEST-LE-WEEKLY@w0:-` and `INV-INPUT-LONGEST-LE-WEEKLY` are the
 * SAME RULE — the live data carries both forms. Comparing them raw would report a
 * rule as "new" because it fired on a different week, which is exactly the false
 * alarm this module exists to prevent.
 */
function normalise(codes: readonly string[]): string[] {
  return Array.from(new Set(codes.map(c => c.split('@')[0]!.trim()).filter(Boolean))).sort()
}
