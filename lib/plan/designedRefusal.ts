// REFUSAL-COPY-02 — the single owner of "was that throw the engine WORKING?"
//
// WHY THIS EXISTS. A deliberate coaching refusal (§44 prep-time, §52 days,
// §111 base volume, §113 long-run readiness) and a genuine engine fault both
// arrive as a thrown Error, and every grid harness has to tell them apart: a
// refusal is counted, a fault must fail the run. That distinction was made by
// MATCHING THE MESSAGE TEXT — `COHORT_REFUSAL`, a regex over prose like
// "is not enough preparation" and "days/week is below".
//
// ⚠️ SO THE REFUSAL COPY WAS A WIRE FORMAT AND NOTHING SAID SO. Rewording the
// §44/§52 messages for tone (which is what REFUSAL-COPY-02 is) broke four
// checks across three files, and the failure mode is the dangerous direction:
// an unmatched refusal is re-thrown as a REAL failure, so the suite goes red
// loudly. It could just as easily have gone the other way — a regex broad
// enough to match a genuine fault silently counts a crash as a design choice.
//
// A copy change must not be able to do either. The type is the contract; the
// wording is not.
//
// ⚠️ NAME FALLBACK IS DELIBERATE. `instanceof` fails across duplicate module
// instances (two copies of lib/plan under a worktree, which `verify:parity`
// creates by design). `e.name` is set explicitly in every one of these
// constructors, so it survives that.

import { PrepTimeError, DaysAvailableError } from './inputs'
import { BaseVolumeError } from './baseVolume'
import { LongRunReadinessError } from './longRunReadiness'

/** Every throw that means "the engine declined, on purpose". */
const DESIGNED_REFUSAL_NAMES = [
  'PrepTimeError',          // §44 — not enough weeks
  'DaysAvailableError',     // §52 — not enough days per week
  'BaseVolumeError',        // §111 — base volume too low for the distance
  'LongRunReadinessError',  // §113 — longest recent run too short
] as const

export function isDesignedRefusal(e: unknown): boolean {
  if (e instanceof PrepTimeError || e instanceof DaysAvailableError) return true
  if (e instanceof BaseVolumeError || e instanceof LongRunReadinessError) return true
  const name = (e as { name?: unknown } | null)?.name
  return typeof name === 'string' && (DESIGNED_REFUSAL_NAMES as readonly string[]).includes(name)
}

/** The refusal classes, for a test that wants to assert on the set itself. */
export const DESIGNED_REFUSAL_ERROR_NAMES: readonly string[] = DESIGNED_REFUSAL_NAMES
