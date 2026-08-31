import { GENERATION_CONFIG } from './generationConfig'

/**
 * CoachingPrinciples §50 — max-HR provenance.
 *
 * - `observed`        — read from device history (the highest heart rate on
 *                       record). A floor, not a maximum, for anyone who has
 *                       never run flat out wearing a sensor.
 * - `user_confirmed`  — typed by the runner in Profile and saved. Trusted below
 *                       the age estimate (genuine low-max athletes exist).
 * - `undefined`       — unattributed (arrived via user_settings with no recorded
 *                       provenance). Treated like `observed` on the low side —
 *                       the dominant source of unattributed sub-estimate maxes
 *                       is device-floor laundering.
 */
export type MaxHrSource = 'observed' | 'user_confirmed' | undefined

/**
 * Tanaka age-estimated max HR: 208 − 0.7 × age. Exempt algorithm formula
 * (Configuration Singularity — a fact, not a coaching choice). Single owner so
 * the engine and the client zone display never drift.
 */
export function tanakaMaxHR(age: number): number {
  return Math.round(208 - 0.7 * age)
}

export type MaxHrOutcome =
  | 'trusted'          // supplied max is used as-is
  | 'floored'          // supplied max is below the estimate and not user-confirmed → a floor, rejected
  | 'implausibly_high' // supplied max is above the estimate by more than the upper tolerance → artifact, rejected
  | 'estimated'        // no max supplied → age estimate used

export interface MaxHrResolution {
  /** The max HR the zones MUST be built on. */
  effectiveMax: number
  /** The Tanaka age estimate (always computed). */
  estimatedMax: number
  /** The supplied max, or null when none was provided / it was a sentinel. */
  suppliedMax: number | null
  outcome: MaxHrOutcome
}

/**
 * CoachingPrinciples §50 (asymmetry, HR-MAX-01) — the single owner of the
 * "which max do we trust?" decision.
 *
 * A recorded heart rate is by construction a *lower bound* on the true maximum:
 * the heart demonstrably reached that rate, so the max is at least that. The
 * plausibility guard is therefore asymmetric:
 *
 *   - ABOVE the estimate — the rate must have physically occurred, so trust it,
 *     up to `MAX_HR_PLAUSIBILITY_DEVIATION_PCT` (beyond that it is a sensor
 *     artifact, not a genuine effort).
 *   - BELOW the estimate — a device-observed or unattributed value is a floor
 *     and says nothing about the ceiling, so it is rejected
 *     (`MAX_HR_BELOW_ESTIMATE_TOLERANCE_PCT` = 0). Only a `user_confirmed` max
 *     is trusted below the estimate.
 *
 * §55 (validateInputFields) has already rejected the physiologically impossible
 * before a value reaches here; this rejects the physiologically possible but
 * almost certainly wrong for this runner.
 */
export function resolveMaxHr(
  suppliedMax: number | null | undefined,
  age: number,
  source: MaxHrSource,
): MaxHrResolution {
  const estimatedMax = tanakaMaxHR(age)
  const supplied =
    typeof suppliedMax === 'number' && Number.isFinite(suppliedMax) && suppliedMax > 0
      ? Math.round(suppliedMax)
      : null

  if (supplied == null) {
    return { effectiveMax: estimatedMax, estimatedMax, suppliedMax: null, outcome: 'estimated' }
  }

  const upperTol = GENERATION_CONFIG.MAX_HR_PLAUSIBILITY_DEVIATION_PCT / 100
  const belowTol = GENERATION_CONFIG.MAX_HR_BELOW_ESTIMATE_TOLERANCE_PCT / 100

  if ((supplied - estimatedMax) / estimatedMax > upperTol) {
    return { effectiveMax: estimatedMax, estimatedMax, suppliedMax: supplied, outcome: 'implausibly_high' }
  }

  const userConfirmed = source === 'user_confirmed'
  if (!userConfirmed && (estimatedMax - supplied) / estimatedMax > belowTol) {
    return { effectiveMax: estimatedMax, estimatedMax, suppliedMax: supplied, outcome: 'floored' }
  }

  return { effectiveMax: supplied, estimatedMax, suppliedMax: supplied, outcome: 'trusted' }
}
