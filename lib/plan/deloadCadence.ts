// Deload cadence — the single owner of "is week N a recovery week?"
// (DELOAD-OWNER-01, 2026-09-04). CoachingPrinciples §3.
//
// WHY THIS MODULE EXISTS. `weekN % recoveryFreq === 0` was written out FIVE
// times in `ruleEngine.ts` — three building the volume curve, one placing the
// §32 tune-up race, one stamping `week.type = 'deload'`. They were not the same
// expression:
//
//   volume pass 1   weekN % rf === 0 && phase !== 'peak'          (taper skipped upstream)
//   volume pass 2   weekN % rf === 0 && phase !== 'peak'          (taper skipped upstream)
//   bounceback      prevWeekN % rf === 0 && prevPhase not peak/taper
//   tune-up scan    wn % rf === 0                                 (NO phase test at all)
//   week badge      !isRaceWeek && weekN % rf === 0 && phase not peak/taper
//
// They agreed only BY CONTEXT: the tune-up loop iterates build weeks exclusively,
// and the volume passes `continue` past taper before reaching their test. Every
// copy was correct where it stood and none of them said so, which made the
// agreement invisible and therefore unmaintainable.
//
// The cost was measured on 2026-09-04. Changing two of the five — an attempt to
// start quality work earlier in the plan — made the volume curve and the week
// badge disagree, and took plans with a deload blocking the first build week
// from 4 to 12. The failure class is `checker reads a different source from the
// producer`, except here it is producer-vs-producer: two writers of the same
// fact, drifting.
//
// D-08 single ownership. This is deliberately its own module rather than a
// helper further down `ruleEngine.ts`: a file-level owner is greppable, and
// `deloadCadence.test.ts` asserts the raw expression appears NOWHERE outside
// it. A rule that holds only while someone remembers is not a rule.
//
// NOT DERIVED FROM `week.type`. The obvious INV-CLASS answer — read the
// structural field the producer stamps — is unavailable here: the volume curve
// runs BEFORE any week object exists, and is what decides the stamp. This
// predicate is the producer.

import type { GeneratorPhase } from '@/types/plan'

/**
 * Is `weekN` a deload week?
 *
 * @param weekN        1-indexed plan week.
 * @param phase        That week's phase. Peak and taper never deload — peak is
 *                     where the plan is meant to be at its hardest, and taper is
 *                     already a planned drop, so a deload inside one is either a
 *                     second drop or a contradiction.
 * @param recoveryFreq Every Nth week. Masters-aware (§3) — set once in
 *                     `generateRulePlan` so the volume curve and the week badge
 *                     cannot disagree about the cadence itself.
 *
 * Race week is NOT excluded here. It is excluded at the one call site that
 * stamps the badge, because "week N is on the deload cadence" and "we should
 * label this week a deload" are different questions, and only the second one
 * cares that the race is on Saturday.
 */
export function isDeloadWeek(
  weekN: number,
  phase: GeneratorPhase,
  recoveryFreq: number,
): boolean {
  // Guard the modulo rather than trusting callers. `recoveryFreq` comes from
  // config via a masters branch; a 0 would make every week a deload silently,
  // which is precisely the kind of failure this app produces instead of crashing.
  if (!Number.isFinite(recoveryFreq) || recoveryFreq <= 0) return false
  if (weekN < 1) return false
  return weekN % recoveryFreq === 0 && phase !== 'peak' && phase !== 'taper'
}
