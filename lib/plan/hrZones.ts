/**
 * §50 / L-03 — THE SINGLE OWNER OF "runner inputs → HR zones + provenance".
 *
 * ⚠️ EXTRACTED FROM `ruleEngine.ts` 2026-10-10 (`BASEBUILD-ZONE-CEILING-01`) WITH NO
 * BEHAVIOURAL CHANGE. It was private to a 9,500-line module, so the SECOND plan
 * producer could not reach it: `generateBaseBuildPlan` built its `meta` from scratch
 * and never computed zones at all. Measured on both live base-build plans — every
 * session carried `zone: "Zone 2"` and **ZERO carried `hr_target`** (51/51 and 30/30),
 * against ~86% on race plans. §84 Am.1 says `hr_target` IS the prescription and
 * `session.zone` is a label about it, so the label was standing alone.
 *
 * It lives beside `maxHrGuard.ts` (§50's max-HR guard, which it calls) rather than
 * inside the engine, because importing 9,500 lines to derive one ceiling is how a
 * second copy gets written instead.
 *
 * ⚠️ THE EXTRACTION AND THE NEW CALLER ARE SEPARATE COMMITS ON PURPOSE. This one is
 * provably inert — `verify:parity` IDENTICAL across 6,066 cases — so if the behaviour
 * change that follows it goes wrong, the two are not tangled.
 */
import type { GeneratorInput } from '@/types/plan'
import { computeZones, type ZoneTargets } from './zones'
import { resolveMaxHr } from './maxHrGuard'
import { GENERATION_CONFIG } from './generationConfig'

// ─── HR zone fallback hierarchy (CoachingPrinciples §50, L-03) ────────────────
// Four-level fallback. Composes with §55 (L-01) which rejects out-of-range
// values; §50 fills MISSING values without refusing to generate.

export type HRZoneMethod =
  | 'karvonen'                    // both max + resting provided
  | 'karvonen_estimated_max'      // only resting provided; max estimated from age
  | 'percent_of_max'              // only max provided
  | 'percent_of_estimated_max'    // neither provided; max estimated from age
  | 'observed_max'                // max came from device history, not a measured effort (§50)
  | 'age_estimate_implausible_input'  // supplied max rejected as implausibly HIGH — a sensor artifact (§50)
  | 'age_estimate_max_floor'      // supplied max rejected as below the estimate — a device floor (§50 asymmetry, HR-MAX-01)

export interface HRZoneFallbackResult {
  zones: ZoneTargets
  derived_max: number
  method: HRZoneMethod
  assumption_note?: string
  estimated_max?: number
  /** §50 provenance of the supplied max, when one was supplied. */
  max_source?: 'observed' | 'user_confirmed'
}

export function buildHRZonesWithFallback(input: GeneratorInput): HRZoneFallbackResult {
  // Note: §55 (L-01) ensures any non-zero, non-undefined max_hr / resting_hr
  // is in physiological range. The checks below treat 0 and undefined alike
  // as "missing" — the form-default sentinel rejection happens upstream.
  const hasResting = input.resting_hr !== undefined && input.resting_hr !== null && input.resting_hr > 0

  // CoachingPrinciples §50 (plausibility + asymmetry, HR-MAX-01) — a recorded max
  // is a lower bound on the true max. resolveMaxHr (single owner, shared with the
  // client zone display) decides which max to trust: it rejects a value below the
  // age estimate as a floor (unless user-confirmed) and one implausibly above it
  // as an artifact. §55 has already rejected the physiologically impossible.
  const { estimatedMax, suppliedMax, outcome } = resolveMaxHr(input.max_hr, input.age, input.max_hr_source)

  // Rejected supplied max (floor below the estimate, or artifact above it) — fall
  // back to Tanaka and say so. The wrong max poisons every HR target for the
  // plan's whole duration; the cost of over-riding a genuine outlier is one note
  // and a Profile edit.
  if (outcome === 'floored' || outcome === 'implausibly_high') {
    const zones = hasResting ? computeZones(estimatedMax, input.resting_hr!) : computeZones(estimatedMax)
    return {
      zones,
      derived_max: estimatedMax,
      method: outcome === 'floored' ? 'age_estimate_max_floor' : 'age_estimate_implausible_input',
      estimated_max: estimatedMax,
      max_source: input.max_hr_source === 'user_confirmed' ? undefined : input.max_hr_source,
      // The two directions have different causes, so they get different notes. A
      // value below the estimate is a floor — the highest the device happened to
      // catch, not a maximum. A value far above it is a stray reading.
      assumption_note: outcome === 'floored'
        ? `The max HR on file (${suppliedMax} bpm) is below the age estimate for ${input.age} (${estimatedMax} bpm). A recorded max below the estimate is a floor: the highest your device happened to catch, not your true ceiling, so zones use ${estimatedMax} bpm (Zone 2 ceiling ≈ ${zones.zone2Ceiling} bpm). If ${suppliedMax} really is your max, set it in Profile and we'll use it.`
        : `The max HR on file (${suppliedMax} bpm) is well above the typical range for age ${input.age}, worth double-checking it wasn't a stray reading. Zones use the age estimate of ${estimatedMax} bpm instead (Zone 2 ceiling ≈ ${zones.zone2Ceiling} bpm). If ${suppliedMax} really is your max, set it in Profile and we'll use it.`,
    }
  }

  // No max supplied — estimate from age (Tanaka).
  if (outcome === 'estimated') {
    if (hasResting) {
      return {
        zones: computeZones(estimatedMax, input.resting_hr!),
        derived_max: estimatedMax,
        method: 'karvonen_estimated_max',
        estimated_max: estimatedMax,
        assumption_note: `Max HR estimated from age (${estimatedMax} bpm using 208 − 0.7 × age). Your true max may differ by ±10 bpm. To refine: note your highest HR during a hard finish or hill effort and update your profile.`,
      }
    }
    const zones = computeZones(estimatedMax)
    return {
      zones,
      derived_max: estimatedMax,
      method: 'percent_of_estimated_max',
      estimated_max: estimatedMax,
      assumption_note: `Both max and resting HR missing: zones estimated from age alone (max ≈ ${estimatedMax} bpm, Zone 2 ceiling ≈ ${zones.zone2Ceiling} bpm). Working approximation. Recommend a HR field test in the first 2 weeks. If easy runs feel consistently too hard or too easy, your true max differs from the estimate. Update your inputs.`,
    }
  }

  // Trusted supplied max (within band, or user-confirmed below the estimate).
  const max = suppliedMax!

  // Device-observed max: usable, but still an inference — note that it is the
  // highest recorded rate, not a measured maximum. Only reachable now when the
  // observed max is at or above the estimate (a real hard effort happened).
  if (input.max_hr_source === 'observed') {
    const zones = hasResting ? computeZones(max, input.resting_hr!) : computeZones(max)
    return {
      zones,
      derived_max: max,
      method: 'observed_max',
      estimated_max: estimatedMax,
      max_source: 'observed',
      assumption_note: `Max HR (${max} bpm) is the highest your device has recorded, not a measured maximum: if you have never run flat out wearing it, your true max is likely higher. The ${GENERATION_CONFIG.RECALIBRATION_TIME_TRIAL.distance_km}K time trial in your recalibration weeks will sharpen this.`,
    }
  }

  if (hasResting) {
    return {
      zones: computeZones(max, input.resting_hr!),
      derived_max: max,
      method: 'karvonen',
      estimated_max: estimatedMax,
      max_source: input.max_hr_source,
    }
  }
  return {
    zones: computeZones(max),
    derived_max: max,
    method: 'percent_of_max',
    estimated_max: estimatedMax,
    max_source: input.max_hr_source,
    assumption_note: 'Zones derived from max HR only (no resting HR provided). Karvonen (using both max and resting) is more accurate. To refine: measure resting HR first thing in the morning, lying down, for 1 minute.',
  }
}
