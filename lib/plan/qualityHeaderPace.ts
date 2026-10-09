import { paceBandStr } from './paceBands'
import type { DerivedSet } from './resolveMainSet'

/**
 * THE SINGLE OWNER OF A QUALITY SESSION'S HEADER PACE (§120 / §85 / §19).
 *
 * The header is a MECHANICALLY VERIFIED MIRROR of the prescription — that is
 * what makes §22's ratio arm sound, because it reads `pace_target` to answer a
 * structural question and may only do so while the header cannot drift from the
 * steps (`INV-PLAN-HEADER-PACE-MATCHES-WORK`).
 *
 * ⚠️ EXTRACTED, NOT WRITTEN. This logic lived inline inside the session
 * composer, which is precisely why `applyRecalibration` could not share it:
 * there was nothing to call. It wrote the category band to every quality
 * session instead, undoing §120 on every recalibrated plan and leaving 3 of 32
 * live plans with a header their own steps contradicted
 * (RECAL-PACE-TWO-WRITER-01).
 *
 * ⚠️ BEHAVIOUR IS UNCHANGED BY THE EXTRACTION, DELIBERATELY. The three branches
 * below are the inline expression verbatim, so `verify:parity` must come back
 * IDENTICAL. Any improvement to the rule is a separate change on top of a
 * proven-equal base — this repo has paid for a refactor that smuggled a
 * semantic in.
 *
 * ⚠️ THE MIXED CASE IS NOT A FALLBACK TO LAZINESS, IT IS §85's SCOPE. An
 * over-under displays a time-weighted mean that equals no single step by
 * design, and the invariant SKIPS rows whose work steps carry more than one
 * pace for that reason. Where generation holds a rep plan it passes the mean in
 * as `repWorkPaceMinPerKm`; where it does not, the category band is the honest
 * description of a session that straddles the category.
 *
 * Measured over 297 generated quality sessions (2026-10-09): 197 carry a single
 * work pace, 82 are mixed (`progressive_tempo`, `tempo_over_under`), 18 are
 * effort-governed with no paced work step at all (`hill_reps`).
 */
export function qualityHeaderPace(args: {
  /**
   * The rep plan's time-weighted work pace, when the caller has one.
   * `pacedRepPlan` already computes it (total work time over total work
   * distance) and returns null for any row it cannot dose.
   */
  repWorkPaceMinPerKm?: number | null
  /** The session's resolved steps — the last resort, never the category band. */
  derivedSet?: DerivedSet | null
  /** `PaceGuide.qualityPaceStr` — the category band for this runner. */
  categoryBand: string
}): string {
  const { repWorkPaceMinPerKm, derivedSet, categoryBand } = args
  if (repWorkPaceMinPerKm != null) return paceBandStr(repWorkPaceMinPerKm, 2)

  const workPaces = new Set(
    (derivedSet?.blocks ?? []).flatMap(b => b.steps)
      .filter(st => st.role === 'work' && st.pace)
      .map(st => st.pace as string),
  )
  return workPaces.size === 1 ? Array.from(workPaces)[0] : categoryBand
}
