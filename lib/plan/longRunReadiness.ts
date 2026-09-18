// CoachingPrinciples §113 — the long-run readiness floor.
//
// A runner attempting a half or a marathon needs a longest recent run the
// engine can actually build FROM. Below that, week one's long run is not a
// progression, it is a leap.
//
// 🔴 WHY A FLOOR EXISTS AT ALL, measured rather than asserted. §45's
// `WEEK_1_2_LONG_RUN_CAP_MULTIPLIER` (1.10) bounds the opening long run against
// the runner's real longest run, and it WORKS — at a 5 km longest run the first
// week lands +7%. But `MIN_SESSION_DISTANCE_KM.long` is applied AFTER that cap
// (ruleEngine `:3033` then `:3101`), so below the floor the floor wins and the
// cap is silently discarded:
//
//     longest 5 km (permitted) -> week 1 = 5.3 km, +7%
//     longest 4 km (refused)   -> week 1 = 4.8 km, +21%
//     longest 2 km (refused)   -> week 1 = 4.8 km, +142%
//
// The engine cannot honour its own safety cap for a runner below the floor. The
// refusal is that limitation, stated honestly, rather than a plan that pretends.
//
// ⚠️ THIS IS THE OPPOSITE RULING TO §111 ON SUBSTANCE AND THE SAME ON
// GOVERNANCE. §111's base-volume gate was non-monotonic and expressed on the
// wrong quantity, so its threshold was wrong. This one is monotonic and tracks
// exactly what it protects against — the threshold is right. What was wrong is
// that it lived as a hardcoded `5` in an API route: ungoverned, invisible to
// `configPrincipleSync` and to `coaching-guard.py`, returning a bare string
// where §44's own text requires alternatives, and a SECOND COPY of a number
// that already had an owner in `MIN_SESSION_DISTANCE_KM.long`.

import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

export interface LongRunReadinessResult {
  ok: boolean
  message: string
  alternatives: string[]
  longest_recent_run_km: number
  min_longest_run_km: number
}

/** §113 governs the distances whose long run cannot be improvised. */
function governs(raceDistanceKm: number): boolean {
  return raceDistanceKm >= GENERATION_CONFIG.LONG_RUN_READINESS_MIN_RACE_KM
}

/**
 * The floor is NOT a second copy of the number — it IS
 * `MIN_SESSION_DISTANCE_KM.long`, read from the one place that owns it. The
 * route used to hold its own `5`, so changing the engine's floor would have
 * left the gate matching the old value with nothing to notice.
 */
export function minLongestRunKm(): number {
  return GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.long
}

/**
 * §44's obligation applied to §113: a refusal explains why AND names what would
 * change it. "Build up to a 5 km run first" is real coaching to someone with
 * months in hand; a bare full stop is a door.
 */
function alternativesFor(floor: number, raceDistanceKm: number): string[] {
  const alts = [
    `Build up to one ${floor} km run, then come back. Nothing else needs to change.`,
  ]
  if (raceDistanceKm >= 42) {
    // ⚠️ THIS USED TO SAY "start with a half marathon plan, which asks less of
    // your longest run." IT IS FALSE, and it is false for the single worst
    // reader: a first-time charity marathoner who has just been refused.
    // §113's floor is `MIN_SESSION_DISTANCE_KM.long` for EVERY race at or above
    // LONG_RUN_READINESS_MIN_RACE_KM (21 km) — the half marathon asks exactly
    // the same 5 km and refuses them again, identically. Measured 2026-09-18:
    // at longest_recent_run_km = 4, marathon REFUSED, half marathon REFUSED,
    // 10K generates, 5K generates.
    //
    // A refusal that hands someone a door which is also locked is worse than a
    // refusal that hands them nothing: they spend the attempt, fail again, and
    // leave. Point them at a distance that actually opens.
    alts.push('Or take a 10K plan for now: it starts from where you are, and it builds the exact base this one needs.')
  }
  alts.push('Already run further than that? Update your longest recent run and try again.')
  return alts
}

export function assessLongRunReadiness(input: GeneratorInput): LongRunReadinessResult {
  const floor = minLongestRunKm()
  const longest = input.longest_recent_run_km
  const base = {
    longest_recent_run_km: longest,
    min_longest_run_km: floor,
    alternatives: [] as string[],
  }

  // Not governed, or nothing stated — §113 has nothing to say. A missing value
  // is not a short one, and refusing on absence would turn an unanswered
  // question into a rejection.
  if (!governs(input.race_distance_km) || typeof longest !== 'number' || !(longest > 0)) {
    return { ...base, ok: true, message: '' }
  }

  if (longest >= floor) return { ...base, ok: true, message: '' }

  return {
    ...base,
    ok: false,
    message:
      `Your longest recent run is ${longest} km, and this plan needs to start from at least ${floor}. `
      + `Week one would be a jump rather than a step, and we are not going to build that.`,
    alternatives: alternativesFor(floor, input.race_distance_km),
  }
}

/** Thrown from generateRulePlan. Mirrors BaseVolumeError (§111) so the route
 *  and the "not yet" screen render it identically — one refusal shape. */
export class LongRunReadinessError extends Error {
  readiness: LongRunReadinessResult
  constructor(readiness: LongRunReadinessResult) {
    super(readiness.message)
    this.name = 'LongRunReadinessError'
    this.readiness = readiness
  }
}
