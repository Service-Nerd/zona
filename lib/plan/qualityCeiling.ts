// §8 / §110 — the single owner of "how many quality sessions may this runner's
// week contain?".
//
// WHY THIS MODULE EXISTS. The ceiling was a plain table lookup
// (`QUALITY_SESSIONS_PER_WEEK_MAX[level]`) until §110 Amendment 2 made it
// conditional: a BEGINNER WHO SET A TIME TARGET has a ceiling of 1 rather than
// 0. The moment a rule stops being a lookup it needs one owner, because the
// producer (`buildWeekSessions`) and the checker (`INV-PLAN-QUALITY-PER-WEEK`)
// both read it, and a checker that re-derives the producer's rule by hand
// cannot catch the producer being wrong.
//
// This repo has paid for that three times — `deloadCadence.ts` (one predicate
// written out in five places, agreeing only by accident of control flow),
// `tierResolution` (the order existed three times and the test asserted its own
// copy), and `sessionDistance.ts`. Applying the fix on the way IN is cheaper
// than after the drift. The invariant caught this change the moment it first
// landed without a shared owner, which is the pair working.
//
// ⚠️ THE CHECKER IS NOT EXEMPTED HERE, AND THE CONTRAST IS DELIBERATE.
// `deloadCadence.test.ts` exempts `invariants.ts` from its producer check for
// the opposite reason: there the checker sharing the producer's PREDICATE would
// be blind to the producer being wrong. Here the ceiling is a DECLARED VALUE,
// not a derivation — there is no independent way to "check" a lookup table, and
// two copies of a table is the failure mode rather than the safeguard.

import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

export type IntensityLevel = keyof typeof GENERATION_CONFIG.QUALITY_SESSIONS_PER_WEEK_MAX

/**
 * The per-week quality ceiling for a runner.
 *
 * @param intensityLevel the INTENSITY level (§79) — the axis governing how hard
 *   a session may be. Never the structural `fitness_level`.
 * @param goal the runner's stated goal. A beginner who set a time target is the
 *   only case where the goal moves the ceiling (§110 Am.2).
 */
export function qualityCeilingFor(
  intensityLevel: IntensityLevel,
  goal: GeneratorInput['goal'] | undefined,
  weeklyKm?: number | null,
): number {
  if (intensityLevel === 'beginner' && goal === 'time_target') {
    // §110b — the week must be able to carry the session. A quality session is
    // sized by an absolute work-minute band, so in a tiny week it is most of
    // the week: measured, 640 §52 breaches without this, all at 5-12 km/week.
    // Unknown volume fails CLOSED (no quality), never open.
    if (weeklyKm == null || weeklyKm < GENERATION_CONFIG.BEGINNER_QUALITY_MIN_WEEKLY_KM) return 0
    return GENERATION_CONFIG.BEGINNER_TIME_TARGET_QUALITY_PER_WEEK_MAX
  }
  return GENERATION_CONFIG.QUALITY_SESSIONS_PER_WEEK_MAX[intensityLevel]
}
