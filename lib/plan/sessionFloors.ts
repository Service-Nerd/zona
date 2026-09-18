// CB-SUBFLOOR-ADMIT-01 / §113 Amendment 1 — the single owner of "how short a
// session may this runner's plan prescribe?"
//
// WHY THIS EXISTS. `MIN_SESSION_DISTANCE_KM` is a flat floor applied AFTER
// §45's week-1 long-run cap (`ruleEngine.ts:3106`,
// `Math.max(floorDist(longKm), minDist.long)`). For a runner whose longest
// recent run is below the floor, the floor wins and the cap is discarded:
//
//     longest 3 km -> §45 cap 3.3 km (+10%, safe)
//                  -> after the 5 km floor, 5.0 km (+67%, unsafe)
//
// §113 then REFUSES that runner because week one is a leap — a leap the engine
// introduced. §113's own header documents the mechanism without drawing the
// conclusion. The Coaching Board vetoed that refusal on 2026-09-18: a rule that
// manufactures the hazard it then refuses over is not coaching-correct.
//
// ⚠️ WHY A DERIVED VALUE AND NOT A PER-LEVEL CONFIG. The obvious change is
// `MIN_SESSION_DISTANCE_KM: { beginner: {...}, intermediate: {...} }`. That is
// **27 call sites across 5 modules**, every one of which would have to learn the
// runner's level, for the sake of a cohort the engine currently refuses outright.
// This resolves ONCE from the input instead, and every caller passes the floors
// it already holds.
//
// ⚠️ THE PROPERTY THAT MAKES THIS SAFE TO SHIP. For any runner at or above the
// configured floor the resolver returns **exactly today's values**, so this is a
// provable no-op for everyone the engine already serves. Only a sub-floor runner
// — currently refused for HM and marathon — resolves to anything different.
// `sessionFloorsAreNoOpAboveFloor` in the tests is that claim, asserted.

import { GENERATION_CONFIG } from './generationConfig'

/**
 * Widened from the config's literal types on purpose: a resolved floor is a
 * computed number, not one of the four literals in `GENERATION_CONFIG`.
 */
export interface SessionFloors {
  long: number
  easy: number
  quality: number
  secondary_quality: number
}

/**
 * Floors for this runner.
 *
 * `longestRecentRunKm` is the anchor because it is the quantity §45's cap is
 * expressed against — the floor must not exceed what the cap permits, and the
 * cap is a function of exactly this number.
 *
 * ⚠️ A missing or non-positive longest run returns the CONFIGURED floors
 * unchanged, never a collapsed one. "We do not know" must not read as "this
 * runner can only manage 2 km" — that is the `?? 0` class this repo has paid
 * for four times.
 */
export function sessionFloorsFor(longestRecentRunKm: number | null | undefined): SessionFloors {
  const cfg = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM
  if (typeof longestRecentRunKm !== 'number' || !Number.isFinite(longestRecentRunKm) || longestRecentRunKm <= 0) {
    return cfg
  }
  // Never below the absolute minimum: under it, a "long run" is not a session,
  // and §113 still refuses (that gate is runway-aware, not removed).
  const anchor = Math.max(longestRecentRunKm, GENERATION_CONFIG.MIN_SESSION_DISTANCE_ABSOLUTE_KM)
  // ⚠️ FLOORS ARE SNAPPED DOWN TO THE ENGINE'S DISTANCE GRID, and this is not
  // cosmetic. The engine rounds every placed distance to
  // DISTANCE_ROUNDING_PRECISION_KM, so a floor of 3.2 km is UNSATISFIABLE: the
  // producer places 3.0 and the validator rejects it ("Got 3, expected 3.2"),
  // which is what the first wiring of this resolver did to the T1 charity
  // persona on every week. Snapping DOWN is the safe direction — a floor is a
  // minimum, and the thing protecting the runner is the CAP, not the floor.
  const grid = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
  const snapDown = (n: number) => Math.floor((n + 1e-9) / grid) * grid

  const long = snapDown(Math.min(cfg.long, anchor))
  // ⚠️ THE EASY FLOOR IS DERIVED FROM THE LONG FLOOR, NOT FROM THE ANCHOR.
  // The first cut wrote `Math.min(cfg.easy, anchor)` and broke §9: at a 4 km
  // anchor the long floor fell to 4 and the easy floor stayed 4, so the long run
  // was no longer the longest run of the week and
  // `INV-PLAN-LONG-IS-LONGEST` fired on every week of the T1 charity persona.
  // §9's ratio is the relationship that has to survive, so the easy floor is
  // expressed through it.
  const easy = snapDown(Math.min(cfg.easy, long / GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY))
  return {
    long,
    easy,
    quality:           cfg.quality,            // a beginner gets no quality (§110)
    secondary_quality: cfg.secondary_quality,  // so neither floor can bind here
  }
}
