// PACE-BANDS-OWNER-01 (2026-09-28) — the VDOT → pace-band derivation, extracted from
// `ruleEngine.ts` so a CLIENT surface can call the producer instead of re-deriving it.
//
// 🔴 WHY IT MOVED, AND IT IS NOT A REFACTOR FOR TIDINESS.
// `BUNDLE-BOUNDARY-01` forbids `lib/plan/ruleEngine` in a client bundle — *"generate on
// the server and pass data"* — and the engine is 6,000 lines of generator that has no
// business in a browser. So the Training Zones screen (ZONES-SURFACE-01) could not reach
// the bands, and the tempting alternative was to re-implement the VDOT fractions in the
// component.
//
// ⚠️ `ruleEngine.ts` ALREADY RECORDED WHY THAT IS WRONG, beside `buildPaceFromVDOT`:
//
//   "IT IS EXPORTED SO THAT NOBODY RECOMPUTES IT … the plan does not carry a PaceGuide —
//    only `meta.vdot` and `meta.vdot_training_anchor`, which are this function's own two
//    arguments. Reconstructing the bands from the VDOT fractions in a script is the
//    second-copy-that-drifts class this repo has recorded FIVE times; calling the
//    producer with the producer's own recorded inputs is not."
//
// This module is that sentence made structural. `ruleEngine` imports from here and
// re-exports, so every existing caller is untouched and there is still exactly one
// producer.
//
// ⚠️ PURE BY CONSTRUCTION. No config, no I/O, no engine types. That is what makes it
// safe on both sides of the boundary, and the property to preserve.

export interface PaceGuide {
  easyPaceStr:      string   // e.g. "6:00–7:15 /km"
  qualityPaceStr:   string   // T-pace (threshold) — Z3 cruise intervals, tempo
  cvPaceStr:        string   // CV-pace (~90% vVO2max) — the "over" of an over-under (§85)
  intervalPaceStr:  string   // I-pace (VO2max)   — Z4–Z5 hard repeats
  minPerKmEasy:     number
  minPerKmQuality:  number
  minPerKmCV:       number
  minPerKmInterval: number
  // Long run segment paces (CoachingPrinciples §24b, §24c, §24d)
  marathonPaceStr:  string | null  // ~79% VDOT; null for beginners
  hmPaceStr:        string | null  // ~84% VDOT; null for beginners
  // CAT-ROW-ELIGIBILITY-01 — the CENTRES of the two bands above, so a v2 step
  // anchored 'M'/'HM' can be priced. Null exactly when the band is null (§24b:
  // a structurally-beginner runner is prescribed no pace segments), which is
  // what makes "can this runner run this row?" answerable before selection
  // rather than a throw inside resolveMainSet. Kept beside the Str fields
  // deliberately: band and centre must not drift.
  minPerKmMarathon: number | null
  minPerKmHM:       number | null
  source: 'vdot' | 'fitness_level'
  /**
   * ADR-026 R1 — the DISCOUNTED VDOT these bands were priced at, or `null` when the guide
   * was not priced from a VDOT at all.
   *
   * 🔑 IT RIDES WITH THE PACE BECAUSE THE HR BAND MUST BE DERIVED FROM THE SAME NUMBER.
   * That is the entire content of ADR-026: the pace came from %VO2max, the HR came from a
   * zone constant, and nothing converted between them, so one session carried two
   * prescriptions for two different efforts. A band computed from a VDOT fetched
   * separately could drift from the pace beside it, which is the defect wearing a
   * different hat. `anchorHrBand` reads this.
   *
   * ⚠️ DISCOUNTED, not raw, for the same reason T and CV paces are (§10/§42's
   * conservatism). The interval band needs no raw VDOT: its floor is the CV ceiling and
   * its top is max HR, so no I fraction is ever converted.
   *
   * ⚠️ `null` IS THE COMMON CASE — `buildFallbackPace` prices from a fitness level and has
   * no VDOT, which is 22 of 43 live plans. Those sessions get no anchor-derived band.
   */
  vdot: number | null
  /** §120 Amendment 2 (GOAL-PACE-REACHABLE-01) — set ONLY by `generateRulePlan`, from `goalPaceReach`, when the stated
   *  goal is past `GOAL_PACE_MAX_STRETCH_PCT` beyond current race fitness. Carried on the pace guide because it IS a
   *  fact about this runner's paces ("goal pace is not one they can train at yet") and every place that prices goal
   *  pace already holds the guide; threading a second argument through 79 goal-pace sites would be the drift. */
  goalWithheld?: true
  /** §80 Amendment 2 — set beside `goalWithheld`: the runner's current race-fitness pace at the race distance
   *  ("m:ss /km"), which the race-day opening quotes instead of the goal. */
  currentRacePaceStr?: string
}

/**
 * ADR-026 R1 — the Daniels VO2 fractions, named once, read by BOTH prescriptions.
 *
 * 🔴 THESE NUMBERS WERE WRITTEN OUT INLINE IN `buildPaceFromVDOT` AND NOWHERE ELSE,
 * AND THAT WAS CORRECT UNTIL A SECOND CONSUMER EXISTED. ADR-026 gives a session's HR
 * band the same anchor its pace already uses, so `anchorHrBand` needs the identical
 * fractions. Writing `0.83`/`0.88` a second time there is the SESSION-KM-01 /
 * DELOAD-OWNER-01 / TIER-OWNER-01 class — two copies of one truth that agree until
 * one is tuned — and it is the precise failure ADR-026 exists to end: the pace came
 * from %VO2max, the HR came from a zone constant, nothing converted between them, and
 * so the two prescriptions on one session described different efforts.
 *
 * ⚠️ STILL EXEMPT FROM `GENERATION_CONFIG`, deliberately. CLAUDE.md names "Daniels VDOT
 * coefficients in `buildPaceFromVDOT`" as algorithm-formula constants that stay inline:
 * they are facts about Daniels' tables, not coaching choices a coach would tune. Naming
 * them does not make them config; it gives the second reader the first reader's numbers.
 *
 * M and HM are single-point anchors (§24b/§24c/§24d), stored as a degenerate band so
 * every anchor has one shape.
 */
export const VDOT_FRACTIONS = {
  E:  [0.59, 0.74],
  T:  [0.83, 0.88],
  CV: [0.88, 0.92],
  I:  [0.95, 1.00],
  M:  [0.79, 0.79],
  HM: [0.84, 0.84],
} as const

export type FractionedAnchor = keyof typeof VDOT_FRACTIONS

// Velocity (m/min) at a given fraction of VDOT — quadratic solve
export function velocityAtFraction(vdot: number, fraction: number): number {
  const a = 0.000104
  const b = 0.182258
  const c = -4.60 - fraction * vdot
  const disc = b * b - 4 * a * c
  if (disc < 0) return 100  // fallback ~10 min/km
  return (-b + Math.sqrt(disc)) / (2 * a)
}

// Pace in min/km at a given VO2 fraction of VDOT
export function paceAtFraction(vdot: number, fraction: number): number {
  return 1000 / velocityAtFraction(vdot, fraction)
}

export function formatPace(minPerKm: number): string {
  const mins = Math.floor(minPerKm)
  const secs = Math.round((minPerKm - mins) * 60)
  if (secs === 60) return `${mins + 1}:00`
  return `${mins}:${String(secs).padStart(2, '0')}`
}

// Band around a centre pace, e.g. paceBandStr(5.00, 2) → "4:54–5:06 /km".
export function paceBandStr(centerMins: number, pctTolerance: number): string {
  const fast = centerMins * (1 - pctTolerance / 100)
  const slow = centerMins * (1 + pctTolerance / 100)
  return `${formatPace(fast)}–${formatPace(slow)} /km`
}

export function buildPaceFromVDOT(discountedVdot: number, rawVdot: number): PaceGuide {
  const eFast = paceAtFraction(discountedVdot, VDOT_FRACTIONS.E[1])
  const eSlow = paceAtFraction(discountedVdot, VDOT_FRACTIONS.E[0])
  const tFast = paceAtFraction(discountedVdot, VDOT_FRACTIONS.T[1])
  const tSlow = paceAtFraction(discountedVdot, VDOT_FRACTIONS.T[0])
  // CV band (§85). Deliberately narrow and deliberately adjacent to T's top:
  // an over-under's "over" is *just* over threshold, not a third gear. Its
  // midpoint (0.90) sits 2.6% faster than T's (0.855) in pace terms, which is
  // what keeps a 50/50 over-under inside INV-PLAN-LABEL-MATCHES-PACE's ±3%
  // threshold tolerance without amending §19. Discounted VDOT, like T — same
  // conservatism doctrine (§10, §42); only I-pace uses raw.
  const cvFast = paceAtFraction(discountedVdot, VDOT_FRACTIONS.CV[1])
  const cvSlow = paceAtFraction(discountedVdot, VDOT_FRACTIONS.CV[0])
  const iFast = paceAtFraction(rawVdot, VDOT_FRACTIONS.I[1])  // top of interval band, raw VDOT
  const iSlow = paceAtFraction(rawVdot, VDOT_FRACTIONS.I[0])  // sustainable interval pace, raw VDOT
  // Marathon (~79% VDOT) and HM (~84% VDOT) segment paces. Both use discounted
  // VDOT (same conservatism doctrine as easy/threshold). §24b/§24c/§24d.
  const mpMins = paceAtFraction(discountedVdot, VDOT_FRACTIONS.M[0])
  const hmMins = paceAtFraction(discountedVdot, VDOT_FRACTIONS.HM[0])
  const eMid  = (eFast + eSlow) / 2
  const tMid  = (tFast + tSlow) / 2
  const cvMid = (cvFast + cvSlow) / 2
  const iMid  = (iFast + iSlow) / 2
  return {
    easyPaceStr:      `${formatPace(eFast)}–${formatPace(eSlow)} /km`,
    qualityPaceStr:   `${formatPace(tFast)}–${formatPace(tSlow)} /km`,
    cvPaceStr:        `${formatPace(cvFast)}–${formatPace(cvSlow)} /km`,
    intervalPaceStr:  `${formatPace(iFast)}–${formatPace(iSlow)} /km`,
    minPerKmEasy:     eMid,
    minPerKmQuality:  tMid,
    minPerKmCV:       cvMid,
    minPerKmInterval: iMid,
    marathonPaceStr:  paceBandStr(mpMins, 3),
    hmPaceStr:        paceBandStr(hmMins, 3),
    minPerKmMarathon: mpMins,
    minPerKmHM:       hmMins,
    source: 'vdot',
    vdot: discountedVdot,
  }
}

/**
 * The fast end of a band string — the CEILING.
 *
 * 🔴 IT LIVES HERE, BESIDE THE FUNCTION THAT FORMATS THE BAND, so the format and its
 * reader cannot drift. Splitting `"6:00–7:15 /km"` in a component would be a second
 * place that knows the separator, and the first time someone changed the dash the screen
 * would silently show the whole string or nothing.
 *
 * ⚠️ "Not faster than" is the FAST end, which is the SMALLER number. An easy band of
 * 6:00–7:15 permits anything from 6:00 to 7:15; what it forbids is 5:50. This is the one
 * sentence the Training Zones screen leads with (ZONES-SURFACE-01), and getting the end
 * backwards would invert the product's entire proposition into "run harder".
 */
export function bandCeiling(bandStr: string | null | undefined): string | null {
  if (!bandStr) return null
  const m = bandStr.match(/^\s*(\d+:\d{2})\s*\u2013/)
  return m ? m[1] : null
}
