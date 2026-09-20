import type { GeneratorInput } from '@/types/plan'
import { GENERATION_CONFIG } from './generationConfig'
import { effectiveStartKm } from './startVolume'

/**
 * P-16 — the base-build on-ramp. §116.
 *
 * THE SINGLE OWNER of "this runner is refused by §111; can we offer them an
 * eleven-week ramp instead of a closed door, and how long must it be?"
 *
 * WHY THIS EXISTS. §111 refuses the sub-12 km/week marathoner and **names a
 * base-building plan as the remedy**. §57 makes that remedy structurally
 * impossible: `foundationBlock.ts` sizes every week as
 * `min(baseline × 1.1^i, baseline × 1.10)`, so **every week from the second is
 * `baseline × 1.10` — flat, at any length.** Two principles in deadlock, each
 * unseen by the other because each sitting was convened on its own question.
 *
 * ⚠️ THIS MODULE DECIDES AND SIZES. IT DOES NOT BUILD WEEKS. Week construction
 * has one owner (`generateFoundationBlock`), which now takes a curve policy.
 * A second week-builder is the D-08 shape this repo keeps recording.
 *
 * ⚠️ §111 IS NOT CREDITED IN ADVANCE (board amendment 7). The ramp does not
 * lower the gate. The runner performs it, re-declares their volume, and is
 * gated on OBSERVED data. `S111-FOUNDATION-CREDIT-01` — crediting unperformed
 * training — was VETOED and this is deliberately not that.
 *
 * ⚠️ THE RAMP MUST STAND ALONE (board amendment 8). If the runner never comes
 * back it must still be a good eleven weeks, which is why it carries §3's
 * deload cadence rather than climbing monotonically to a handover.
 */

/** Why an on-ramp was or was not offered. Never a bare boolean — a refused
 *  runner needs to be told which of these it was. */
export type OnRampOutcome =
  /** §111 does not refuse this runner; no ramp is needed. */
  | 'not_needed'
  /** Offered: the ramp reaches the base §111 requires and leaves enough runway. */
  | 'offered'
  /** The ramp would reach the base but leaves under §44's ratified 16 weeks. */
  | 'insufficient_runway'
  /** The runner is below the floor at which a running ramp is the right tool. */
  | 'below_floor'

export interface OnRampAssessment {
  outcome: OnRampOutcome
  /** Weeks of ramp needed to reach `targetKm`. 0 when not offered. */
  rampWeeks: number
  /** Weeks of race plan left after the ramp. */
  remainingWeeks: number
  /** The weekly volume the ramp is trying to reach — §111's own `minBaseKm`. */
  targetKm: number
  /** Where the ramp starts: the volume the ENGINE starts from, not the raw
   *  wizard figure. Same owner as §111's denominator so they cannot drift. */
  startKm: number
}

/**
 * The week-by-week volume curve: §2's rate, §3's cadence.
 *
 * Deliberately NOT §57's `FOUNDATION_WEEKLY_INCREASE_PCT`. Willy's amendment 1:
 * a pre-plan block that builds is governed by the same ramp rule as any other
 * building block, and §57's number was chosen for a gap-filler that was never
 * meant to climb.
 *
 * Returns one entry per week, already deloaded. Index 0 is week 1 of the ramp.
 */
export function onRampCurve(startKm: number, weeks: number): number[] {
  const ratePct = GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT
  const freq    = GENERATION_CONFIG.BASE_BUILD_ONRAMP_DELOAD_FREQUENCY
  const deload  = GENERATION_CONFIG.RECOVERY_WEEK_VOLUME_PCT

  const out: number[] = []
  let carried = startKm          // the build line, which a deload does not reset
  for (let i = 0; i < weeks; i++) {
    const weekN = i + 1
    if (i > 0) carried = carried * (1 + ratePct / 100)
    // ⚠️ A DELOAD DIPS, IT DOES NOT RATCHET THE LINE DOWN. The build continues
    // from `carried`, so the week after a deload resumes the climb rather than
    // re-climbing ground already covered. The deload RATCHET is a defect this
    // repo has recorded once already.
    const isDeload = weekN % freq === 0 && weekN !== weeks
    out.push(floor1dp(isDeload ? carried * (deload / 100) : carried))
  }
  return out
}

/** How many §2-rate weeks, with §3 deloads, to climb from `startKm` to `targetKm`. */
export function onRampWeeksNeeded(startKm: number, targetKm: number): number {
  if (startKm <= 0) return 0
  if (targetKm <= startKm) return 0
  const max = GENERATION_CONFIG.BASE_BUILD_ONRAMP_MAX_WEEKS
  for (let w = 1; w <= max; w++) {
    const curve = onRampCurve(startKm, w)
    // The HANDOVER volume is the last week, and the last week is never a
    // deload (see `isDeload` above) — the runner must hand over on the line,
    // not in a dip, or §111 re-gates them on a number they did not build to.
    if (curve[curve.length - 1] >= targetKm) return w
  }
  return max
}

/**
 * Should this runner be offered an on-ramp instead of a refusal?
 *
 * `runwayWeeks` is the total weeks between today and the race — the caller
 * owns that arithmetic, because the route already computes it and a second
 * date calculation is a second source of truth.
 */
export function assessOnRamp(
  input: GeneratorInput,
  minBaseKm: number,
  runwayWeeks: number,
): OnRampAssessment {
  const startKm = effectiveStartKm(input)
  const none = (outcome: OnRampOutcome): OnRampAssessment =>
    ({ outcome, rampWeeks: 0, remainingWeeks: runwayWeeks, targetKm: minBaseKm, startKm })

  if (minBaseKm <= startKm) return none('not_needed')

  // ⚠️ THE FLOOR IS WHERE A RUNNING RAMP STOPS BEING THE RIGHT TOOL.
  // Willy, at the sitting: a runner at 8 km/week over 4 days is already running
  // 2 km at a time; run-walk is for someone who cannot, and that runner is
  // below this floor anyway. **Run-walk is explicitly NOT scoped. Do not build
  // it to copy a competitor.**
  if (startKm < GENERATION_CONFIG.BASE_BUILD_ONRAMP_MIN_START_KM) return none('below_floor')

  const rampWeeks = onRampWeeksNeeded(startKm, minBaseKm)
  if (rampWeeks === 0) return none('not_needed')

  const remainingWeeks = runwayWeeks - rampWeeks
  // McMillan's amendment 3: §44's ratified 16-week threshold, not a new number.
  if (remainingWeeks < GENERATION_CONFIG.BASE_BUILD_ONRAMP_MIN_REMAINING_WEEKS) {
    return { outcome: 'insufficient_runway', rampWeeks, remainingWeeks, targetKm: minBaseKm, startKm }
  }

  return { outcome: 'offered', rampWeeks, remainingWeeks, targetKm: minBaseKm, startKm }
}

/** FLOOR to 1dp, never round — rounding must never carry a value past a cap.
 *  Same rule and the same reason as `foundationBlock.ts`. */
function floor1dp(km: number): number {
  return Math.floor(km * 10) / 10
}

// ─── The flag ─────────────────────────────────────────────────────────────────
//
// §116 ships DARK. The Coaching Board's chair gated it explicitly: build behind
// a flag, generate the cohort, run `measure:fitness` and the property sweep,
// bring the numbers back. The 2026-09-19 record is the standing reminder — a
// hand-rolled grid showed 0 violations where the sweep showed 884.
//
// ⚠️ DEFAULT OFF, and off means the refusal payload is byte-identical to what
// it was before §116 existed. A flag whose "off" state still changes behaviour
// is not a flag.
export function onRampEnabled(): boolean {
  return process.env.ENABLE_BASE_BUILD_ONRAMP === '1'
}

/**
 * The offer attached to a §111 refusal, or `null`.
 *
 * ⚠️ IT IS AN OFFER, NOT A SUBSTITUTION. The engine does not quietly hand a
 * runner who asked for a marathon plan an eleven-week base block instead —
 * ADR-012's whole model is that a structural change surfaces for confirmation.
 * The runner chooses. Rendering that choice is `P-15`'s job, not this module's.
 */
export interface OnRampOffer {
  weeks: number
  /** Weeks of race plan that remain after it. */
  remaining_weeks: number
  /** Where the ramp starts and ends, km/week. */
  start_km: number
  target_km: number
}

export function onRampOfferFor(
  input: GeneratorInput,
  minBaseKm: number,
  runwayWeeks: number,
): OnRampOffer | null {
  if (!onRampEnabled()) return null
  const a = assessOnRamp(input, minBaseKm, runwayWeeks)
  if (a.outcome !== 'offered') return null
  return {
    weeks: a.rampWeeks,
    remaining_weeks: a.remainingWeeks,
    start_km: a.startKm,
    target_km: a.targetKm,
  }
}
