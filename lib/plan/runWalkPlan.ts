import type { GeneratorInput, Session } from '@/types/plan'
import { GENERATION_CONFIG } from './generationConfig'
import { effectiveStartKm } from './startVolume'
import { raceDistanceKey } from './generationConfig'

/**
 * §117 — the finish-goal run-walk marathon.
 *
 * THE SINGLE OWNER of "is this runner being prepared to FINISH rather than to
 * run, and what interval are they prescribed?"
 *
 * WHY. §111 refuses 45.5% of plausible first-time marathoner profiles, and the
 * whole of the marathon's 12.4-point fit-for-purpose gap is that rejection.
 * The §116 on-ramp reaches 40% of them; the rest start below 6 km/week, where
 * the arithmetic is unarguable — from 4 km/week it takes 17 weeks to reach a
 * marathon-capable base at §2's safe rate and the budget is 13.
 *
 * The lever is not the rate. It is the TARGET. `minBase = ceil(peak / 4.0)`,
 * so a plan built to complete the distance rather than run it has a lower peak
 * and therefore a lower door — 32 km/wk puts it at 8 rather than 13.
 *
 * ⚠️ NOTHING IS LOOSENED. §2's ramp, §3's cadence and §111's ratio are
 * untouched. Willy was explicit: *"walk breaks reduce cumulative impact per
 * session; they do not accelerate bone remodelling, which runs on its own
 * clock. §2's 10% stays. Do not come back and ask me to raise it because the
 * runner is walking some of it."*
 *
 * ⚠️ AND §80 ALREADY RATIFIED THE CONCEPT on 2026-08-06 — finish-goal peak long
 * runs are duration-anchored and *"run-walk counts"*. What never existed was
 * the engine PRESCRIBING it. Principle-to-behaviour gap, not a new instrument.
 */

/** Marathon only. Shorter distances refuse nobody (measured: 0% refusal at
 *  5K/10K/HM), and the ultras have their own §24e machinery. */
export function runWalkDistanceApplies(distanceKm: number): boolean {
  return raceDistanceKey(distanceKm) === 'MARATHON'
}

/**
 * Should this runner get the finish-goal run-walk shape?
 *
 * ⚠️ DERIVED, NEVER ASKED. There is no new wizard input and there must not be:
 * a runner who has told their friends they are running a marathon will not
 * tick a box marked "I will be walking some of it", and asking would filter
 * out exactly the cohort this exists to serve. The engine infers it from what
 * the runner already told us.
 *
 * `standardPeakKm` is the peak this runner would otherwise get — passed in
 * rather than recomputed, so the producer and this gate cannot disagree about
 * the number the door is derived from.
 */
export function runWalkApplies(input: GeneratorInput, standardPeakKm: number): boolean {
  // 🔴 SHIPPED DARK, AND THE REASON IS A CONTRADICTION IN THE BOARD'S OWN
  // AMENDMENT 1 THAT ONLY APPEARED WHEN THE PLANS WERE MEASURED.
  //
  // Willy specified BOTH a peak of 30-34 km/wk AND "repeated exposure to 3+
  // hours on feet". Measured, they do not reconcile: at a 32 km peak, §52's
  // 60% cap tops the long run out at ~16.5-18.5 km, which is **2h12 against a
  // projected 5h38 race — 39-44% of race DURATION against §80's ratified
  // finish-goal bar of 70%.**
  //
  //     cwk   peak wk   peak LR   % race duration   §80 bar
  //       8        29      16.5              39%       70%   NO
  //      10        29      16.5              39%       70%   NO
  //      12        31      18.5              44%       70%   NO
  //
  // 3 hours at an easy pace is ~21-22 km, which under §52 needs a ~36 km week —
  // above the range Willy named. **So §117 as ruled admits a runner to a plan
  // that does not meet the board's own stated preparation requirement**, and
  // shipping it would be the door opened with nothing behind it, which is the
  // exact failure amendment 3 exists to prevent.
  //
  // ⚠️ The measurement also found that the STANDARD plan misses §80's bar too
  // (62% at 15 km/wk). That is a pre-existing gap, filed separately, and it is
  // not evidence that §117 is fine.
  //
  // Everything is built, tested and gated. Flip this when the board resolves
  // the peak-versus-time-on-feet contradiction — `S117-PEAK-VS-TIME-01`.
  if (process.env.ENABLE_FINISH_GOAL_RUNWALK !== '1') return false
  if (!runWalkDistanceApplies(input.race_distance_km)) return false
  // §117 is for the runner who CANNOT be prepared to run it. A time goal is an
  // explicit statement that finishing is not the point.
  if (input.goal !== 'finish') return false
  if (input.fitness_level !== 'beginner') return false

  // The trigger is §111's own arithmetic: would the standard peak refuse them?
  // Shared owner with the gate (`effectiveStartKm`) so the two cannot drift —
  // §111 Amendment 2 exists because they did.
  const cap = GENERATION_CONFIG.MAX_BASE_BUILD_RATIO
  const standardDoorKm = Math.ceil(standardPeakKm / cap)
  return effectiveStartKm(input) < standardDoorKm
}

/** The peak a §117 plan builds to. */
export function runWalkPeakKm(): number {
  return GENERATION_CONFIG.FINISH_GOAL_RUNWALK_PEAK_KM
}

/**
 * The prescribed interval, as the string the runner reads.
 *
 * ⚠️ PRESCRIBED, NOT PERMITTED. §80 already lets a finish-goal runner walk;
 * this tells them how. Willy and McMillan arrived at that condition
 * independently at the sitting, which is the strongest signal it produced.
 */
export function runWalkStrategy(): string {
  const run = GENERATION_CONFIG.FINISH_GOAL_RUNWALK_RUN_MINS
  const walk = GENERATION_CONFIG.FINISH_GOAL_RUNWALK_WALK_MINS
  return `Run ${run} minutes, walk ${walk}. Repeat. Take the walk break before you need it, from the first rep.`
}

/** Stamp the interval onto every running session of a §117 plan. */
export function applyRunWalk(session: Session): Session {
  if (session.type === 'rest' || session.type === 'cross-train' || session.type === 'strength') return session
  return { ...session, run_walk_strategy: runWalkStrategy() }
}
