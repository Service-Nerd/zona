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
 * ⚠️ AN ABSENT longest run returns the CONFIGURED floors unchanged, never a
 * collapsed one. "We do not know" must not read as "this runner can only manage
 * 2 km" — that is the `?? 0` class this repo has paid for four times.
 *
 * 🔴 BUT A DECLARED ZERO IS NOT ABSENT, AND THIS FUNCTION USED TO SAY IT WAS
 * (§10 Amendment, Coaching Board 2026-10-09, `WIZARD-ZERO-VOLUME-REFUSAL-01`
 * Amendment 2). `WIZARD_VOLUME_RULER.LONGEST_RUN_KM_MIN` is **0**, so zero is a
 * reachable slider position and reaching it is an answer: *I have not run.* The
 * guard above was `longestRecentRunKm <= 0`, which collapsed the answer into the
 * gap and handed a declared zero the full 5 km floor — the treatment for a
 * runner we know nothing about.
 *
 * ⚠️ THE CONSEQUENCE WAS AN INVERSION, AND IT RAN THE WRONG WAY ON EVERY
 * COHORT MEASURED. Week-1 long run across the longest-run ladder, before:
 *
 *     lrr        0     1     2     3     4     5     6     8
 *     5K/20/3d   8.0   2.0   2.0   3.0   4.0   5.5   6.5   8.0
 *     10K/30/4d  8.5   2.0   2.0   3.0   4.0   5.5   6.5   8.5
 *     HM/30/3d  12.5   2.0   2.0   3.0   4.0   5.5   6.5   8.5
 *     M/60/5d    9.0   2.0   2.0   3.0   4.0   5.5   6.5   8.5
 *
 * Monotone at every rung except 0→1. **Declaring one kilometre instead of zero
 * cut the first long run from 12.5 km to 2.0** — so the honest answer was
 * punished and the most deconditioned runner got the largest opening week.
 *
 * ⚠️ THE 5 KM READING WAS THE BOARD'S OWN FIRST ANSWER AND IT WAS MEASURED OUT.
 * Capping a declared zero at `MIN_SESSION_DISTANCE_KM.long` (5) is still above
 * the 2.0 km rung that §113 Amendment 1 ratified for a declared 1 km, so it
 * cannot be monotone — and a number that breaks an ordering loses to the
 * ordering. A declared zero lands on the same rung as a declared 1 km, which is
 * also the intuitive reading: both mean *start me at the bottom*.
 */
export function sessionFloorsFor(longestRecentRunKm: number | null | undefined): SessionFloors {
  const cfg = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM
  // ABSENCE ONLY. A negative value is not a declaration either — no slider
  // produces one — so it keeps the absent treatment.
  if (typeof longestRecentRunKm !== 'number' || !Number.isFinite(longestRecentRunKm) || longestRecentRunKm < 0) {
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
