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
}

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
  const eFast = paceAtFraction(discountedVdot, 0.74)
  const eSlow = paceAtFraction(discountedVdot, 0.59)
  const tFast = paceAtFraction(discountedVdot, 0.88)
  const tSlow = paceAtFraction(discountedVdot, 0.83)
  // CV band (§85). Deliberately narrow and deliberately adjacent to T's top:
  // an over-under's "over" is *just* over threshold, not a third gear. Its
  // midpoint (0.90) sits 2.6% faster than T's (0.855) in pace terms, which is
  // what keeps a 50/50 over-under inside INV-PLAN-LABEL-MATCHES-PACE's ±3%
  // threshold tolerance without amending §19. Discounted VDOT, like T — same
  // conservatism doctrine (§10, §42); only I-pace uses raw.
  const cvFast = paceAtFraction(discountedVdot, 0.92)
  const cvSlow = paceAtFraction(discountedVdot, 0.88)
  const iFast = paceAtFraction(rawVdot, 1.00)  // top of interval band, raw VDOT
  const iSlow = paceAtFraction(rawVdot, 0.95)  // sustainable interval pace, raw VDOT
  // Marathon (~79% VDOT) and HM (~84% VDOT) segment paces. Both use discounted
  // VDOT (same conservatism doctrine as easy/threshold). §24b/§24c/§24d.
  const mpMins = paceAtFraction(discountedVdot, 0.79)
  const hmMins = paceAtFraction(discountedVdot, 0.84)
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
