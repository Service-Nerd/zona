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
import { computeZones, UNDERIVABLE_ZONES, type ZoneTargets } from './zones'
import { resolveMaxHr } from './maxHrGuard'
import { GENERATION_CONFIG } from './generationConfig'

// ─── HR zone fallback hierarchy (CoachingPrinciples §50, L-03) ────────────────
// Four-level fallback. Composes with §55 (L-01) which rejects out-of-range
// values; §50 fills MISSING values without refusing to generate.

export type HRZoneMethod =
  // MAXHR-AGE-ABSENT-01 (Coaching Board 2026-11-17) — §50's table says "estimate max from age"
  // in every arm where the max is missing, and never said what to do with no AGE. These two
  // are that answer. They are distinct methods, not a shared "unknown", because the runner is
  // told a different thing in each and `INV-PLAN-HR-ASSUMPTIONS-SURFACED` reads the method.
  | 'max_unguarded_no_age'        // a max we cannot plausibility-check, used as given and said so
  | 'no_hr_no_age'                // nothing derivable at all — no number, effort governs (§14 Am. 2)
  | 'karvonen'                    // both max + resting provided
  | 'karvonen_estimated_max'      // only resting provided; max estimated from age
  | 'percent_of_max'              // only max provided
  | 'percent_of_estimated_max'    // neither provided; max estimated from age
  | 'observed_max'                // max came from device history, not a measured effort (§50)
  | 'age_estimate_implausible_input'  // supplied max rejected as implausibly HIGH — a sensor artifact (§50)
  | 'age_estimate_max_floor'      // supplied max rejected as below the estimate — a device floor (§50 asymmetry, HR-MAX-01)

export interface HRZoneFallbackResult {
  zones: ZoneTargets
  /** `null` ONLY for `no_hr_no_age` — nothing was derivable, which is the escape hatch
   *  `INV-PLAN-ZONE-LABEL-HAS-PRESCRIPTION` already tests for. */
  derived_max: number | null
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
  // 🔴 NO AGE MEANS §50's GUARD CANNOT BE ASKED, AND THE OLD CODE ASKED IT ANYWAY
  // (MAXHR-AGE-ABSENT-01, Coaching Board 2026-11-17).
  //
  // Every arm of §50's asymmetry is relative to the Tanaka estimate, and Tanaka needs an age.
  // The wizard used to supply a hardcoded 30, so `resolveMaxHr` ran against a fabricated
  // ceiling and inverted its own logic: a stored max of 176 was FLOORED UP to 187 "because the
  // runner is 30". 📐 Measured on live data: 6 of 6 ageless runners with a stored max would
  // get a DIFFERENT effective max depending on their age, and a 60-year-old priced at 30 is
  // told easy <= 150 bpm when 150 is above the top of their own Zone 3 — §12 breached in fact.
  //
  // 🏃 Hutchinson: *"Thirty is not an estimate. An estimate is a value with a stated method and
  // an error bar; this is a literal, chosen because it sat at the end of a ternary."*
  //
  // ⚠️ THE DISPLAY PATH WAS ALREADY HONEST and this is the asymmetry that gave it away:
  // `DashboardClient` asks `hrGuardableAge`, gets null, and says so. The generator pretended.
  // Two cases, ruled separately, because the runner is owed a different thing in each.
  const guardableAge = typeof input.age === 'number' && Number.isFinite(input.age) ? input.age : null
  if (guardableAge === null) {
    const suppliedNoAge =
      typeof input.max_hr === 'number' && Number.isFinite(input.max_hr) && input.max_hr > 0
        ? Math.round(input.max_hr) : null

    // CASE 2 — nothing derivable. §14 Amendment 2 literally: the field stays absent and the
    // talk test IS the prescription. This is the first case that meets that clause's own test,
    // because its stated reason for NOT applying ("§50 falls back to Tanaka") needs an age.
    if (suppliedNoAge === null) {
      return {
        zones: UNDERIVABLE_ZONES,
        derived_max: null,
        method: 'no_hr_no_age',
        assumption_note: 'No heart-rate zones in this plan: we have no max HR on file and no year of birth to estimate one from, and a zone built on a guess is worse than none. Run the easy days by feel: conversational, and if you are not sure, slower. Add either your year of birth or a max HR in Profile and the zones appear.',
      }
    }

    // CASE 1 — the max is real and the PLAUSIBILITY CHECK is what cannot run. Use it as given.
    // ⚠️ NEVER FLOORED AGAINST AN ESTIMATE WE INVENTED, which is the defect: §50's asymmetry
    // rests on "a recorded max is a lower bound", and guarding it against a fabricated ceiling
    // inverts that into raising a genuine 55-year-old's max by eleven beats.
    const zones = hasResting ? computeZones(suppliedNoAge, input.resting_hr!) : computeZones(suppliedNoAge)
    return {
      zones,
      derived_max: suppliedNoAge,
      method: 'max_unguarded_no_age',
      max_source: input.max_hr_source === 'user_confirmed' ? undefined : input.max_hr_source,
      // ⚠️ THE COPY SAYS WHY THE YEAR MATTERS, because the wizard's own subtitle says it does
      // not ("Only to estimate your max heart rate, if you haven't set one") and that is false:
      // the age is what CHECKS a max the runner has set. ⚕️ Sims' objection, answered here.
      assumption_note: `Zones use the max HR on file (${suppliedNoAge} bpm) exactly as given. Without your year of birth we cannot sanity-check it, so if that number came from a device that caught a stray reading, or never caught a hard effort, the zones inherit it (Zone 2 ceiling ≈ ${zones.zone2Ceiling} bpm). Adding your year of birth in Profile lets us check it.`,
    }
  }

  const { estimatedMax, suppliedMax, outcome } = resolveMaxHr(input.max_hr, guardableAge, input.max_hr_source)

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
        ? `The max HR on file (${suppliedMax} bpm) is below the age estimate for age ${guardableAge} (${estimatedMax} bpm). A recorded max below the estimate is a floor: the highest your device happened to catch, not your true ceiling, so zones use ${estimatedMax} bpm (Zone 2 ceiling ≈ ${zones.zone2Ceiling} bpm). If ${suppliedMax} really is your max, set it in Profile and we'll use it.`
        : `The max HR on file (${suppliedMax} bpm) is well above the typical range for age ${guardableAge}, worth double-checking it wasn't a stray reading. Zones use the age estimate of ${estimatedMax} bpm instead (Zone 2 ceiling ≈ ${zones.zone2Ceiling} bpm). If ${suppliedMax} really is your max, set it in Profile and we'll use it.`,
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
