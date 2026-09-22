// FREE — rule engine
// Deterministic plan generator. Zero AI calls. Same inputs always produce the same structure.
// Enrichment (labels, coaching voice, confidence score) is layered on top in lib/plan/enrich.ts.
// This file owns all numeric values: distances, durations, zones, HR targets.
//
// Zone model: dual-anchor (pace + HR). Pace derived from VDOT when benchmark available;
// falls back to fitness-level brackets. HR from Karvonen when resting HR known; otherwise
// uses HRmax percentages (Tanaka max HR from age).

import type { GeneratorInput, Plan, Week, Session, BenchmarkInput } from '@/types/plan'
import type { Phase } from '@/types/plan'
import {
  getDistanceConfig, calcPlanLength, nextMonday,
  formatDate, addDays, parseDateLocal,
} from './length'
import { qualityCeilingFor } from './qualityCeiling'
import { LR_SHORTFALL_UNREHEARSED_FUELLING, FUELLING_PRACTICE_NOTE, ULTRA_FUELLING_PREFIX } from './fuellingNotes'
import { runWalkApplies, runWalkPeakKm, applyRunWalk } from './runWalkPlan'
import { GENERATION_CONFIG, raceDistanceKey, type RaceDistanceKey } from './generationConfig'
// ADR-015 / INV-FMT-001 — `lib/format.ts` is the SOLE owner of every duration a
// runner reads, and the rule is locked: under 60 minutes reads "45 min", at or
// above it reads in hours ("3h 28"). These notes are a display surface like any
// card, and they were printing raw minute counts: "tops out at 208 minutes ...
// moving for around 338 minutes". Measured before the fix: 42,444 minute values
// across 29,624 notes, 48.2% of them >= 60, the largest 338 (5h 38).
import { formatDuration, raceDistanceDisplayName } from '@/lib/format'
// Notes are prose, so a null (impossible here: every caller passes a finite
// positive number) must not print "null".
const durationText = (mins: number): string => formatDuration(mins) ?? `${Math.round(mins)} min`
import { resolveMaxHr, tanakaMaxHR } from './maxHrGuard'
import { assessFitness, fitnessFromVdot, fitnessFromVolume, FITNESS_RANK, type FitnessLevel } from './fitnessAssessment'
import { validatePlan, copyClaimsIntensity, enforceViolations } from './invariants'
import { assessBaseBuild, baseVolumeRefusal, BaseVolumeError } from './baseVolume'
import { assessLongRunReadiness, LongRunReadinessError } from './longRunReadiness'
import { sessionFloorsFor, type SessionFloors } from './sessionFloors'
import { strideCarrierDay, neuromuscularNote, neuromuscularLabel, hasHillRestrictingInjury } from './neuromuscular'
import { effectiveStartKm } from './startVolume'
import { weeksBetweenLocal } from './length'
import { enforcePrepTime, enforceDaysAvailable, validateInputFields, coherentGoal, type PrepTimeAwareInput, type PrepTimeResult, type DaysAvailableResult } from './inputs'
import { normaliseDays } from './days'
import { sessionKmOrZero, sessionKmSelfPaced } from '@/lib/plan/sessionDistance'
import { zoneStringFromZoneKeys } from '@/lib/coaching/zoneRules'
import { isLongRun, isShakeout, classifyStimulus, isStructuredSession, isVo2maxSession } from './sessionRole'
import { PLAN_SIGNATURES } from './planSignatures'
import { isV2Structure, StructureV2Schema, goalPaceShapeWord, PACE_ANCHORS, type PaceAnchor } from './sessionStructureV2'
import { durationForMainSet } from './sessionFormat'
import { resolveMainSet, type PaceAnchorMap } from './resolveMainSet'
import { isDeloadWeek, computeDeloadWeeks, deloadVolumeFraction } from './deloadCadence'
import { computeIntensityReentry } from './intensityReentry'
import { catalogueRowFor } from './catalogueLink'
import { plannedFoundationWeeks } from './foundationBlock'
import type { GeneratorPhase } from '@/types/plan'
import {
  V1_SESSION_CATALOGUE, selectCatalogueSession, requiredPaceAnchors, ultraFuellingCadenceMins,
  type SessionCatalogueRow, type CatalogueCategory,
} from './sessionCatalogueData'

// ─── Internal types ───────────────────────────────────────────────────────────

type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
// Single definition, shared with lib/plan/deloadCadence.ts (DELOAD-OWNER-01).
// Aliased to the long-standing local name so every existing usage stands.
type PhaseType = GeneratorPhase
// FitnessLevel + the classification helpers (assessFitness, fitnessFrom*,
// FITNESS_RANK) now live in ./fitnessAssessment (single owner shared with the
// wizard's level recommendation) and are imported at the top of this file.

interface ZoneTargets {
  zone2Ceiling: number
  easyHR: string
  shakeoutHR: string
  qualityHR: string
  /** §84 — the zone string that DESCRIBES `qualityHR`. Paired at construction. */
  qualityZone: string
  /** §84 — the zone string that DESCRIBES `intervalsHR`. Paired at construction. */
  intervalsZone: string
  intervalsHR: string
}

interface PaceGuide {
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

// ─── VDOT model (Jack Daniels) ────────────────────────────────────────────────

// Parse "H:MM:SS", "MM:SS", or "H:MM" → total minutes
export function parseBenchmarkTime(time: string): number {
  const parts = time.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60
  if (parts.length === 2) return parts[0] + parts[1] / 60
  return NaN
}

// Jack Daniels VDOT formula: VDOT from any race result
export function calcVDOT(distanceKm: number, timeMinutes: number): number {
  if (!Number.isFinite(timeMinutes) || timeMinutes <= 0) return NaN
  const v = (distanceKm * 1000) / timeMinutes  // metres per minute
  const utilization = 0.8
    + 0.1894393 * Math.exp(-0.012778 * timeMinutes)
    + 0.2989558 * Math.exp(-0.1932605 * timeMinutes)
  const vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v
  return vo2 / utilization
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
function paceAtFraction(vdot: number, fraction: number): number {
  return 1000 / velocityAtFraction(vdot, fraction)
}

function formatPace(minPerKm: number): string {
  const mins = Math.floor(minPerKm)
  const secs = Math.round((minPerKm - mins) * 60)
  if (secs === 60) return `${mins + 1}:00`
  return `${mins}:${String(secs).padStart(2, '0')}`
}

// Parse pace string ("5:00 /km" or "5:00") to total minutes-per-km.
function paceStrToMins(s: string): number | null {
  const m = s.match(/^(\d+):(\d+)/)
  if (!m) return null
  const mins = parseInt(m[1], 10)
  const secs = parseInt(m[2], 10)
  if (!Number.isFinite(mins) || !Number.isFinite(secs)) return null
  return mins + secs / 60
}

// Band around a centre pace, e.g. paceBandStr(5.00, 2) → "4:54–5:06 /km".
function paceBandStr(centerMins: number, pctTolerance: number): string {
  const fast = centerMins * (1 - pctTolerance / 100)
  const slow = centerMins * (1 + pctTolerance / 100)
  return `${formatPace(fast)}–${formatPace(slow)} /km`
}

// VDOT training pace fractions (Jack Daniels E/T/I)
// Easy: 59–74% VO2max. Tempo: 83–88%. Interval (vVO2max): 95–100%.
//
// CoachingPrinciples §10 + §19 doctrine (R2/H-01, Stance B): the conservatism
// discount applies to easy and threshold paces — the bands where "going hard
// on easy days" risk lives. Interval (VO2max) sessions are short, structured,
// with full recovery; they are MEANT to be hard. Discounting them produces
// under-stimulus. So the discounted VDOT drives easy/threshold paces; the raw
// benchmark VDOT drives interval paces.
// EXPORTED for measurement only (HM-ANCHOR-VS-GOAL-01, 2026-09-22). No
// behaviour delta: the `export` keyword is the whole change.
//
// ⚠️ IT IS EXPORTED SO THAT NOBODY RECOMPUTES IT. A board-evidence script needs
// the runner's threshold pace, and the plan does not carry a PaceGuide — only
// `meta.vdot` and `meta.vdot_training_anchor`, which are this function's own two
// arguments. Reconstructing the bands from the VDOT fractions in a script is the
// second-copy-that-drifts class this repo has recorded five times; calling the
// producer with the producer's own recorded inputs is not.
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

function calcVDOTFromBenchmark(b: BenchmarkInput): number {
  const mins = parseBenchmarkTime(b.time)
  return calcVDOT(b.distance_km, mins)
}

// VDOT conservatism (CoachingPrinciples §10, §42) — protects users from
// training at peak race-day output. Discount = base 3% + staleness ramp,
// capped at MAX. Surfaced in plan.meta.vdot_discount_applied_pct.
export function applyVdotDiscount(rawVdot: number, b: BenchmarkInput, today: Date): { vdot: number; discountPct: number } {
  let discountPct: number = GENERATION_CONFIG.VDOT_CONSERVATIVE_DISCOUNT_PCT
  if (b.benchmark_date) {
    const bDate = parseDateLocal(b.benchmark_date)
    const weeksAgo = (today.getTime() - bDate.getTime()) / (1000 * 60 * 60 * 24 * 7)
    const fresh = GENERATION_CONFIG.VDOT_STALENESS_FRESH_WEEKS
    if (weeksAgo > fresh) {
      const extraBlocks = Math.floor((weeksAgo - fresh) / 4) + 1
      discountPct += extraBlocks * GENERATION_CONFIG.VDOT_STALENESS_PER_4WK_PCT
    }
    discountPct = Math.min(discountPct, GENERATION_CONFIG.VDOT_STALENESS_MAX_DISCOUNT_PCT)
  }
  return { vdot: rawVdot * (1 - discountPct / 100), discountPct }
}

// ─── Tanaka max HR formula ────────────────────────────────────────────────────
// tanakaMaxHR now lives in ./maxHrGuard (single owner shared with the client zone
// display) and is imported at the top of this file.

// ─── Fitness level derivation ─────────────────────────────────────────────────
// FITNESS_RANK, fitnessFromVdot, fitnessFromVolume, assessFitness moved to
// ./fitnessAssessment (single owner, client-safe, shared with the wizard). §79.

// ─── Zone computation ─────────────────────────────────────────────────────────
// Dual-anchor: pace is primary; HR is the governor on hills, heat, and fatigue.
// Karvonen when resting HR is known; %MaxHR otherwise.
//
// All boundary percentages live in GENERATION_CONFIG.ZONES (see ADR-009).
// Easy ceiling = top of Z2. Quality (threshold) = Z3. Intervals (VO2max) = Z4–Z5.
// Forward-compat: a future paid "zone method selector" feature swaps the table
// based on user_settings.zone_method. See zone-rules.md.

function computeZones(mhr: number, rhr?: number): ZoneTargets {
  const Z = GENERATION_CONFIG.ZONES
  if (rhr !== undefined) {
    // Karvonen (HR Reserve) — more personalised
    const hrr = mhr - rhr
    const k = (pct: number) => Math.round(rhr + (pct / 100) * hrr)
    const z1Top    = k(Z.Z1.karvonen_pct[1])  // top of Z1 → shakeout ceiling
    const z2Top    = k(Z.Z2.karvonen_pct[1])  // top of Z2 → easy ceiling
    const z3Low    = k(Z.Z3.karvonen_pct[0])  // Z3 low → quality low
    const z3Top    = k(Z.Z3.karvonen_pct[1])  // Z3 top → quality high
    const z4Low    = k(Z.Z4.karvonen_pct[0])  // Z4 low → intervals low
    return {
      zone2Ceiling: z2Top,
      easyHR:       `< ${z2Top} bpm`,
      shakeoutHR:   `< ${z1Top} bpm`,
      qualityHR:    `${z3Low}–${z3Top} bpm`,
      intervalsHR:  `${z4Low}–${mhr} bpm`,
      // §84 Amendment (Coaching Board 2026-09-04) — the zone STRING is authored
      // in the same expression as the HR string it describes, so the two cannot
      // drift. They had: every threshold session read `zone: 'Zone 3–4'` beside
      // `hr_target: qualityHR`, and qualityHR is z3Low–z3Top — Zone 3 ONLY. The
      // display derives its band from the zone string and the coach note renders
      // hr_target, so one card showed "145–172 bpm" above "Hold 145–158 bpm".
      // §84's own Config paragraph asserted these were written "consistently";
      // it was true for intervals and assumed for quality.
      qualityZone:   'Zone 3',
      intervalsZone: 'Zone 4–5',
    }
  }
  // %MaxHR — used when resting HR not provided
  const m = (pct: number) => Math.round((pct / 100) * mhr)
  const z1Top = m(Z.Z1.maxhr_pct[1])
  const z2Top = m(Z.Z2.maxhr_pct[1])
  const z3Low = m(Z.Z3.maxhr_pct[0])
  const z3Top = m(Z.Z3.maxhr_pct[1])
  const z4Low = m(Z.Z4.maxhr_pct[0])
  return {
    zone2Ceiling: z2Top,
    easyHR:       `< ${z2Top} bpm`,
    shakeoutHR:   `< ${z1Top} bpm`,
    qualityHR:    `${z3Low}–${z3Top} bpm`,
    intervalsHR:  `${z4Low}–${mhr} bpm`,
    // §84 Amendment — see the Karvonen branch above. Same pairing, same reason.
    qualityZone:   'Zone 3',
    intervalsZone: 'Zone 4–5',
  }
}

// ─── HR zone fallback hierarchy (CoachingPrinciples §50, L-03) ────────────────
// Four-level fallback. Composes with §55 (L-01) which rejects out-of-range
// values; §50 fills MISSING values without refusing to generate.

type HRZoneMethod =
  | 'karvonen'                    // both max + resting provided
  | 'karvonen_estimated_max'      // only resting provided; max estimated from age
  | 'percent_of_max'              // only max provided
  | 'percent_of_estimated_max'    // neither provided; max estimated from age
  | 'observed_max'                // max came from device history, not a measured effort (§50)
  | 'age_estimate_implausible_input'  // supplied max rejected as implausibly HIGH — a sensor artifact (§50)
  | 'age_estimate_max_floor'      // supplied max rejected as below the estimate — a device floor (§50 asymmetry, HR-MAX-01)

interface HRZoneFallbackResult {
  zones: ZoneTargets
  derived_max: number
  method: HRZoneMethod
  assumption_note?: string
  estimated_max?: number
  /** §50 provenance of the supplied max, when one was supplied. */
  max_source?: 'observed' | 'user_confirmed'
}

function buildHRZonesWithFallback(input: GeneratorInput): HRZoneFallbackResult {
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
        ? `The max HR on file (${suppliedMax} bpm) is below the age estimate for ${input.age} (${estimatedMax} bpm). A recorded max below the estimate is a floor — the highest your device happened to catch, not your true ceiling — so zones use ${estimatedMax} bpm (Zone 2 ceiling ≈ ${zones.zone2Ceiling} bpm). If ${suppliedMax} really is your max, set it in Profile and we'll use it.`
        : `The max HR on file (${suppliedMax} bpm) is well above the typical range for age ${input.age} — worth double-checking it wasn't a stray reading. Zones use the age estimate of ${estimatedMax} bpm instead (Zone 2 ceiling ≈ ${zones.zone2Ceiling} bpm). If ${suppliedMax} really is your max, set it in Profile and we'll use it.`,
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
      assumption_note: `Both max and resting HR missing — zones estimated from age alone (max ≈ ${estimatedMax} bpm, Zone 2 ceiling ≈ ${zones.zone2Ceiling} bpm). Working approximation. Recommend a HR field test in the first 2 weeks. If easy runs feel consistently too hard or too easy, your true max differs from the estimate — update your inputs.`,
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
      assumption_note: `Max HR (${max} bpm) is the highest your device has recorded, not a measured maximum — if you have never run flat out wearing it, your true max is likely higher. The ${GENERATION_CONFIG.RECALIBRATION_TIME_TRIAL.distance_km}K time trial in your recalibration weeks will sharpen this.`,
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

// ─── Pace guides by fitness level (fallback when no benchmark) ─────────────────

// CV is deliberately absent here and derived in buildFallbackPace — see CV_PACE_RATIO_OF_T.
const PACE_GUIDE: Record<FitnessLevel, Omit<PaceGuide, 'source' | 'marathonPaceStr' | 'hmPaceStr' | 'cvPaceStr' | 'minPerKmCV' | 'minPerKmMarathon' | 'minPerKmHM'>> = {
  beginner:     { easyPaceStr: '7:30–9:00 /km', qualityPaceStr: '6:30–7:30 /km', intervalPaceStr: '5:30–6:30 /km', minPerKmEasy: 8.0,  minPerKmQuality: 7.0,  minPerKmInterval: 6.0 },
  intermediate: { easyPaceStr: '6:30–7:30 /km', qualityPaceStr: '5:30–6:00 /km', intervalPaceStr: '4:30–5:00 /km', minPerKmEasy: 7.0,  minPerKmQuality: 5.75, minPerKmInterval: 4.75 },
  experienced:  { easyPaceStr: '5:45–6:45 /km', qualityPaceStr: '4:45–5:20 /km', intervalPaceStr: '3:50–4:20 /km', minPerKmEasy: 6.25, minPerKmQuality: 5.0,  minPerKmInterval: 4.05 },
}

/**
 * CV pace as a ratio of T pace (§85).
 *
 * DERIVED, never a fourth column in PACE_GUIDE. Pace is inversely proportional
 * to velocity, so CV pace = T pace x (T fraction / CV fraction) = 0.855/0.90.
 * Deriving it means the fallback table can never drift into the one ordering
 * that would be incoherent — CV slower than T, or faster than I — which a
 * hand-maintained fourth column eventually would. Same reason the VDOT path
 * computes all four bands from one VDOT rather than storing them.
 */
const CV_PACE_RATIO_OF_T = 0.855 / 0.90

function buildFallbackPace(fitness: FitnessLevel): PaceGuide {
  const base = PACE_GUIDE[fitness]
  const cvMins = base.minPerKmQuality * CV_PACE_RATIO_OF_T
  // Marathon and HM segment paces derived from quality pace midpoint + offset.
  // Beginners: null — no pace segments prescribed. (CoachingPrinciples §24b)
  let marathonPaceStr: string | null = null
  let hmPaceStr:       string | null = null
  let hmMins:          number | null = null  // centre of hmPaceStr; kept so the band and its centre cannot drift
  let mpMins:          number | null = null  // ditto for marathonPaceStr
  if (fitness === 'intermediate') {
    mpMins          = base.minPerKmQuality + 0.50
    marathonPaceStr = paceBandStr(mpMins,                            3)  // +30s/km
    hmMins          = base.minPerKmQuality + 0.25
    hmPaceStr       = paceBandStr(hmMins,                            3)  // +15s/km
  } else if (fitness === 'experienced') {
    mpMins          = base.minPerKmQuality + (25 / 60)
    marathonPaceStr = paceBandStr(mpMins,                            3)  // +25s/km
    hmMins          = base.minPerKmQuality + (12 / 60)
    hmPaceStr       = paceBandStr(hmMins,                            3)  // +12s/km
  }
  return {
    ...base,
    cvPaceStr:  paceBandStr(cvMins, 2),
    minPerKmCV: cvMins,
    marathonPaceStr, hmPaceStr,
    minPerKmMarathon: mpMins, minPerKmHM: hmMins,
    source: 'fitness_level',
  }
}

// ─── Phase distribution ───────────────────────────────────────────────────────
// Taper phase weeks are anchored to TAPER_QUALITY_PER_WEEK[dist].length
// (covers full taper weeks + race week). Base/build/peak fill the remaining
// weeks proportionally to PHASE_DISTRIBUTION (35:35:15). See ADR-009.

function computePhases(
  totalWeeks: number,
  distanceKm: number,
  earlyOnset = false,
  foundationWeeks = 0,
  // §97 — may this runner's on-ramp shorten to one week? Distance-scoped, because
  // §1's ceiling tightens with distance while a shorter base raises the quality
  // share. False falls back to §91's two-week cap.
  shortOnRamp = false,
  // §98 (CB-ONSET-YIELD-01) — how many weeks of base to give BACK, walking §89's
  // benefit down one rung at a time until the plan satisfies §1. Zero for every
  // plan that complies at full benefit, which is 84% of the gated cohort.
  // Bounded by the base an UNGATED runner would receive: §89 may be trimmed to
  // nothing, never past nothing.
  onsetRelax = 0,
): Phase[] {
  const distKey = raceDistanceKey(distanceKm)
  const taperPhaseWeeks = GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK[distKey].length
  const remaining = Math.max(0, totalWeeks - taperPhaseWeeks)

  const dist = GENERATION_CONFIG.PHASE_DISTRIBUTION
  // §89 — a demonstrably-ready runner gets a shorter base so build/quality starts
  // sooner; the freed weeks flow to build+peak (more quality weeks). Base stays
  // all-easy — this is a shorter base, NOT a base with quality in it (§88 veto
  // preserved). The `Math.max(2, …)` below is the 2-week floor (Seiler's on-ramp).
  const basePct = earlyOnset ? GENERATION_CONFIG.EARLY_ONSET_BASE_PCT : dist.base_pct
  const denom = basePct + dist.build_pct + dist.peak_pct
  const baseFloor = GENERATION_CONFIG.MIN_BASE_WEEKS_FLOOR
  let baseWeeks  = Math.max(baseFloor, Math.round(remaining * basePct  / denom))

  // §91 (CB-ONSET-02) — THE ON-RAMP IS COUNTED IN WEEKS THE RUNNER RUNS.
  //
  // Two corrections, both scoped to the §89-gated runner so nobody else moves:
  //
  //  (a) Cap base in WEEKS as well as percent. A percentage re-grew the base on
  //      longer plans — the runner who entered their race 14 weeks out got MORE
  //      on-ramp than one 12 weeks out, which is backwards.
  //
  //  (b) Credit foundation weeks against it. §57 foundation weeks are all-easy
  //      running at the runner's current volume; so is base. They are the same
  //      object to the tissue, and Seiler's floor is a physiological on-ramp,
  //      not an administrative one. Uncredited, §89's whole effect was cancelled
  //      for the 62% of plans that carry a block: measured delivered onset was
  //      calendar week 4/5/6/6 at 12/13/14/15 weeks-to-race, against week 3 for
  //      a runner with no block at all.
  //
  // Base may reach ZERO here, and that is the intended terminal case: two
  // foundation weeks ARE the two-week floor. It is never negative, and the
  // floor still binds in full for every runner the §89 gate did not pass.
  if (earlyOnset) {
    const cap = shortOnRamp
      ? GENERATION_CONFIG.EARLY_ONSET_BASE_MAX_WEEKS
      : GENERATION_CONFIG.MIN_BASE_WEEKS_FLOOR
    baseWeeks = Math.min(baseWeeks, cap)
    baseWeeks = Math.max(0, baseWeeks - Math.min(foundationWeeks, baseWeeks))
    // §98 — the §1 yield. See the ladder in generateRulePlan.
    if (onsetRelax > 0) {
      const ungatedBase = Math.max(
        baseFloor,
        Math.round(remaining * dist.base_pct / (dist.base_pct + dist.build_pct + dist.peak_pct)),
      )
      baseWeeks = Math.min(ungatedBase, baseWeeks + onsetRelax)
    }
  }
  let buildWeeks = Math.max(1, Math.round(remaining * dist.build_pct / denom))
  let peakWeeks  = Math.max(2, remaining - baseWeeks - buildWeeks)

  // If the max-2 peak floor pushed total > remaining, take back from build
  // first (most flexible), then base. Preserves taper duration as authored.
  let overage = (baseWeeks + buildWeeks + peakWeeks) - remaining
  if (overage > 0 && buildWeeks > 1) {
    const take = Math.min(overage, buildWeeks - 1)
    buildWeeks -= take
    overage -= take
  }
  if (overage > 0 && baseWeeks > baseFloor) {
    const take = Math.min(overage, baseWeeks - baseFloor)
    baseWeeks -= take
  }

  const baseEnd  = baseWeeks
  const buildEnd = baseEnd + buildWeeks
  const peakEnd  = buildEnd + peakWeeks
  const taperEnd = totalWeeks

  const built: Phase[] = [
    { name: 'base',  start_week: 1,            end_week: baseEnd  },
    { name: 'build', start_week: baseEnd + 1,  end_week: buildEnd },
    { name: 'peak',  start_week: buildEnd + 1, end_week: peakEnd  },
    { name: 'taper', start_week: peakEnd + 1,  end_week: taperEnd },
    // A PHASE WITH NO WEEKS IS NOT A PHASE (PHASE-EMPTY-01, 2026-09-19).
    //
    // ADR-021's early-onset gate shortens the base for a demonstrably-ready
    // runner, and on a SHORT plan it shortens to nothing: `baseWeeks` reaches 0
    // and this emitted `{ name: 'base', start_week: 1, end_week: 0 }` — an
    // INVERTED range persisted into `plan_json`. `PlanSchema`, which calls
    // itself the single source of runtime validation for plan JSON, rejects it
    // (`end_week` must be positive); nothing else did, because the schema is
    // only ever run against ENRICHER output and never against engine output.
    //
    // Measured: 12 of 360 plans in the affected cell — `experienced` +
    // `recent_quality_training: 'regular'` + a 12-week plan, across 10K, HM
    // and marathon, both goals.
    //
    // ⚠️ AND NEITHER GRID CAN REACH IT: **0 of 45,776** corpus plans hit this,
    // because `cohortGrid` and `targetedGrid` never combine an experienced
    // runner with regular recent quality on a short runway. A hand-built
    // realistic runner hit it on the first attempt. Same class as the
    // injury x masters cell and CB-SUBFLOOR-ADMIT-01: the corpus cannot see it,
    // so the corpus said the engine was clean.
    //
    // Benign today by luck rather than design — `adjust-plan` matches phases
    // with `start <= w <= end` so an empty one never matches, and every other
    // consumer looks up by NAME. A consumer computing `end - start + 1` would
    // get -1 - 1 = a negative length.
  ]
  return built.filter(p => p.end_week >= p.start_week)
}

function getPhaseForWeek(weekN: number, phases: Phase[]): PhaseType {
  return (phases.find(p => weekN >= p.start_week && weekN <= p.end_week)?.name ?? 'base') as PhaseType
}

// ─── Weekly volume sequence ───────────────────────────────────────────────────

// Detects a returning runner: deep training history (>2 years) AND current
// weekly volume well below typical for fitness level. CoachingPrinciples §2.
function isReturningRunner(input: GeneratorInput, peakKm: number): boolean {
  const isExperienced = input.training_age === '2-5yr' || input.training_age === '5yr+'
  const threshold = peakKm * GENERATION_CONFIG.RETURNING_RUNNER_VOLUME_THRESHOLD_PCT / 100
  const lowVolume = input.current_weekly_km < threshold
  return isExperienced && lowVolume
}

interface VolumeSequenceResult {
  volumes:   number[]
  compressed: boolean  // true if 10% cap forced any week below its uncapped value
}

function buildVolumeSequence(
  totalWeeks: number,
  phases: Phase[],
  startKm: number,
  peakKm: number,
  distanceKm: number,
  recoveryFreq: number,
  returningRunner: boolean,
  // §2 — the injury weekly-increase cap, applied INSIDE the curve.
  //
  // It used to be applied per-week in the session loop, downstream of the
  // curve, against `volumes[i - 1]` — the raw curve value, not the previous
  // week's adjusted result. Two defects followed: the cap never compounded (a
  // capped week was followed by one measured against the higher curve value,
  // producing a 35% sawtooth), and everything else that anchors on the curve —
  // the taper depth, the deload step-down, the long-run share — was working
  // from volumes the runner never actually saw.
  //
  // Applying it here makes the curve the single truth. Undefined for uninjured
  // runners, who keep §2's standard allowance.
  injuryCapPct: number | undefined,
  /** §87 (CB-DELOAD-01) — the plan's deload weeks, already phase-corrected.
   *  Passed in rather than recomputed so the volume curve and the week badge
   *  cannot disagree about placement, which is the fault DELOAD-OWNER-01
   *  removed one layer down. */
  deloadWeeks: ReadonlySet<number>,
): VolumeSequenceResult {
  const taperPhase = phases.find(p => p.name === 'taper')!
  const distKey = raceDistanceKey(distanceKm)
  const taperConfig = GENERATION_CONFIG.TAPER_BY_DISTANCE[distKey]
  const taperPhaseWeeks = GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK[distKey].length
  const fullTaperWeeks = Math.max(1, taperPhaseWeeks - 1)  // exclude race week
  // §2 Am.2 — depth comes from deloadCadence, the single owner (see there for why).
  const recoveryPct = deloadVolumeFraction(injuryCapPct != null)

  // Returning-runner allowance (CoachingPrinciples §2): first 3 weeks may grow
  // at 15% instead of 10%.
  const allowanceForWeek = (weekN: number): number => {
    if (returningRunner && weekN <= GENERATION_CONFIG.RETURNING_RUNNER_GRACE_WEEKS) {
      return GENERATION_CONFIG.RETURNING_RUNNER_ALLOWANCE_PCT
    }
    return GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT
  }

  const volumes: number[] = new Array(totalWeeks).fill(0)

  // Clamp start volume to a band relative to peakKm.
  // Floor prevents starting too low for the target; ceiling prevents
  // starting too close to peak (no room to ramp).
  const initFloor   = peakKm * GENERATION_CONFIG.BUILD_VOL_INIT_FLOOR_VS_PEAK   / 100
  const initCeiling = peakKm * GENERATION_CONFIG.BUILD_VOL_INIT_CEILING_VS_PEAK / 100
  let buildVol = Math.min(Math.max(startKm, initFloor), initCeiling)
  let lastBuildVol = buildVol

  // Pass 1 — fill non-taper weeks (base/build/peak) with the natural ramp +
  // recovery-week drops. Taper deferred to pass 3 so it can anchor on the
  // post-cap pre-taper value.
  for (let i = 0; i < totalWeeks; i++) {
    const weekN = i + 1
    const phase = getPhaseForWeek(weekN, phases)
    if (phase === 'taper') continue

    const isDeload = deloadWeeks.has(weekN)
    if (isDeload) {
      volumes[i] = Math.round(lastBuildVol * recoveryPct)
      buildVol = lastBuildVol
    } else {
      const allowance = 1 + allowanceForWeek(weekN) / 100
      const growthFactor = phase === 'peak' ? 1 + (allowance - 1) / 2 : allowance
      buildVol = Math.min(buildVol * growthFactor, peakKm)
      volumes[i] = Math.round(buildVol)
      lastBuildVol = buildVol
    }
  }

  // Pass 2 — enforce week-on-week cap on non-taper weeks. Drops are exempt;
  // deload weeks themselves are exempt (they intentionally drop). After-deload
  // bouncebacks are NOT exempt — this is the primary effect of the cap
  // (CoachingPrinciples §2).
  for (let i = 1; i < volumes.length; i++) {
    const weekN = i + 1
    const phase = getPhaseForWeek(weekN, phases)
    if (phase === 'taper') continue
    const isThisDeload = deloadWeeks.has(weekN)
    if (isThisDeload) {
      // DELOAD-INVERSION-01 part 1 (§3, Coaching Board 2026-09-06) — a recovery
      // week drops to 70% of the prior BUILD week. Pass 1 set it to 70% of the
      // pre-cap `lastBuildVol`, but pass 2 caps the prior week LOWER (injury/ramp),
      // so 70%-of-uncapped could equal/exceed the delivered prior — a "recovery"
      // week that reduces nothing (12.8% of plans, D-21). Re-anchor to 70% of the
      // ACTUAL (post-cap) prior week — §3's literal intent. Here, not a later pass,
      // so the bounceback below reads the reduced deload. A MIN — only reduces.
      // volumes[i-1] is the pre-deload build week, capped this pass; §3/§87 never
      // place back-to-back deloads. Taper deloads: pass 3.
      volumes[i] = Math.min(volumes[i], Math.round(volumes[i - 1] * recoveryPct))
      continue
    }
    if (volumes[i] <= volumes[i - 1]) continue

    // §2's injury cap tightens its own standard allowance for knee / shin-splint history. Same pass, so
    // it compounds week on week exactly as the standard cap does.
    const allowancePct = injuryCapPct != null
      ? Math.min(allowanceForWeek(weekN), injuryCapPct)
      : allowanceForWeek(weekN)
    const cap = 1 + allowancePct / 100
    let maxAllowed = Math.round(volumes[i - 1] * cap)

    // CoachingPrinciples §2 (amended 2026-08-06 / D1) — the cap does NOT apply
    // to a post-deload bounceback. Previously it did, and the arithmetic was
    // fatal: a deload drops to 70%, so the next week could rise only 10% above
    // THAT — 77% of where the runner already was. Every deload ratcheted the
    // ceiling permanently down, making progressive overload arithmetically
    // impossible in any plan containing a recovery week. The first organic
    // user's 14-week plan peaked in week 3, in the base phase.
    //
    // Returning to a volume held two weeks ago is not a spike — chronic load
    // has not moved. The bounceback may return to the pre-deload level, and no
    // further: growth resumes from there next week.
    const prevWeekN = weekN - 1
    const prevWasDeload = deloadWeeks.has(prevWeekN)
    if (prevWasDeload) {
      const preDeload = volumes[i - 2] ?? volumes[i - 1]
      // RAMP-BOUNCEBACK-01 (Coaching Board 2026-09-06, Willy-led). The bounceback
      // splits by injury status, and MEASUREMENT (not intuition) drew the line:
      //
      // INJURY history — BOUNDED by the injury cap, no exemption. Injured tissue's
      // binding constraint is the ACUTE weekly load; a "return" does not lessen it
      // (cardiovascular readiness ≠ tissue readiness). This branch used to
      // `Math.max`-override §2's injury cap entirely, shipping +26% weeks to knee-history
      // runners — the live safety hole that blocked CB-PHASE-01. The bounceback now
      // returns TOWARD pre-deload only as fast as the injury cap allows; the
      // remainder completes next week (§2: "growth resumes from there").
      //
      // HEALTHY — keeps §2's exemption UNBOUNDED. The board provisionally proposed
      // a 20% bound for healthy runners too, conditional on measurement. Measured
      // across a 144-plan grid: a 20% bound flipped the difficulty note to
      // "constrained by inputs" on +50pp of plans and raised the maintenance rate
      // +7.6pp, for ZERO safety benefit — §2's evidence is that returning to a
      // volume held two weeks ago is not a spike for healthy tissue, and no
      // mainstream model caps a bounceback. The measurement resolved the board's
      // recorded Willy/Hutchinson split toward Hutchinson for healthy runners.
      //
      // §2 AMENDMENT 3 (PLAN-FITNESS-01, Coaching Board 2026-09-17) — THE INJURY
      // BOUNCEBACK MAY RETURN TO PRE-DELOAD, AND NO HIGHER.
      //
      // Amendment 1 set the condition this failed: "the curve still RISES within
      // each block — slow is right, STUCK IS NOT." Measured, same runner with and
      // without the knee flag, 18 weeks, nothing else changed: net build
      // **+91% healthy vs +6% injured** (standard cadence), **+79% vs +3%**
      // (masters). 28.9% of injury plans never exceeded their own week-1 volume.
      //
      // Amendment 2 raised the injury deload 70% -> 85% but the number is short of
      // its own break-even: standard needs 1/1.05^3 = 86.4%, masters 1/1.05^2 =
      // 90.7%. At 85% that is -1.6%/cycle and -6.3%/cycle. D-21.
      //
      // WHY WILLY REVERSED HIS OWN VETO: he rejected the unbounded return because
      // a 70% cut returning to 100% is **+43%** onto healing tissue. Amendment 2's
      // shallower cut makes the same return **+17.6%**, of a load the tissue
      // carried seven days earlier.
      //
      // ⚠️ HIS CONDITION IS MECHANICAL: valid only while the cut stays shallow.
      // Lower INJURY_RECOVERY_WEEK_VOLUME_PCT and this exemption withdraws itself.
      const injuryCutShallowEnough =
        GENERATION_CONFIG.INJURY_RECOVERY_WEEK_VOLUME_PCT
          >= GENERATION_CONFIG.INJURY_BOUNCEBACK_MIN_DELOAD_PCT
      if (injuryCapPct != null && !injuryCutShallowEnough) {
        const bounceMax = Math.round(volumes[i - 1] * (1 + injuryCapPct / 100))
        maxAllowed = Math.max(maxAllowed, Math.min(preDeload, bounceMax))
      } else {
        maxAllowed = Math.max(maxAllowed, preDeload)
      }
    }

    if (volumes[i] > maxAllowed) {
      volumes[i] = maxAllowed
    }
  }

  // Pass 3 — fill taper weeks using the POST-CAP pre-taper as anchor.
  // (Bug fix: previously taper ran in pass 1, anchored on the pre-cap pre-taper
  // value. With the cap reducing real build/peak volumes, the resulting
  // taper-from-spec-target was visibly smaller than spec because it was applied
  // to an inflated baseline.)
  for (let i = 0; i < totalWeeks; i++) {
    const weekN = i + 1
    const phase = getPhaseForWeek(weekN, phases)
    if (phase !== 'taper') continue

    const taperIdx = weekN - taperPhase.start_week
    const preTaper = volumes[taperPhase.start_week - 2] ?? lastBuildVol
    if (weekN === totalWeeks) {
      volumes[i] = Math.round(preTaper * GENERATION_CONFIG.RACE_WEEK_VOLUME_PCT / 100)
    } else {
      // CD-5 / §6 — shallower cut for a low-volume runner (little fatigue to
      // shed; a full cut would just detrain them). Depth only, not week count.
      const reductionFull = peakKm < GENERATION_CONFIG.LOW_VOLUME_TAPER_THRESHOLD_KM
        ? taperConfig.volume_reduction_pct * (GENERATION_CONFIG.LOW_VOLUME_TAPER_REDUCTION_FACTOR_PCT / 100)
        : taperConfig.volume_reduction_pct
      const stepPct = reductionFull / fullTaperWeeks
      const reductionPct = stepPct * (taperIdx + 1)
      volumes[i] = Math.round(preTaper * (1 - reductionPct / 100))
    }
  }

  // "Ramp can't fit" check (CoachingPrinciples §2 intent). The plan is
  // compressed-by-volume if peak-phase weeks never reach peakKm — i.e. the
  // cap forced the ramp short of target. Single-week firing in build is
  // expected and not flagged.
  const peakPhase = phases.find(p => p.name === 'peak')
  let compressed = false
  if (peakPhase) {
    const peakThreshold = peakKm * GENERATION_CONFIG.PEAK_REACHED_THRESHOLD_PCT / 100
    const peakReached = volumes.some((v, i) => {
      const wn = i + 1
      return wn >= peakPhase.start_week && wn <= peakPhase.end_week && v >= peakThreshold
    })
    compressed = !peakReached
  }

  return { volumes, compressed }
}

// ─── Day utilities ────────────────────────────────────────────────────────────

const DAY_ORDER: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_INDEX: Record<Day, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 }

function dayGap(a: Day, b: Day): number {
  const diff = Math.abs(DAY_INDEX[a] - DAY_INDEX[b])
  return Math.min(diff, 7 - diff)
}

// CoachingPrinciples §18 — accept both short ('mon') and full ('monday') forms.
// Wizard sends full names; API/test inputs may send short. The parser is the
// boundary; downstream code treats blocked as Set<Day>.
// Day normalisation lives in ./days so the foundation block (built client-side,
// outside validatePlan's reach) shares one implementation with the engine. Two
// correct-looking copies is how foundation weeks came to ignore blocked days
// entirely — see the note in days.ts.
function blockedDays(input: GeneratorInput): Set<Day> {
  return normaliseDays(input.days_cannot_train)
}

function firstAvailableDay(preferred: Day[], blocked: Set<Day>, also: Day[] = []): Day | null {
  const exclude = new Set([...Array.from(blocked), ...also])
  return preferred.find(d => !exclude.has(d)) ?? null
}

// ─── Session constructors ──────────────────────────────────────────────────────

function dur(distKm: number, minsPerKm: number): number {
  return Math.round(distKm * minsPerKm)
}

// Round a distance to GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM.
// Single source for display-friendly distances (matches CoachingPrinciples §11
// — "specific beats abstract" — but cleaner than 0.1 km precision).
function roundDistance(distKm: number): number {
  const p = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
  return Math.round(distKm / p) * p
}

function easySession(
  weekN: number, day: Day,
  distKm: number, metric: 'distance' | 'duration',
  zones: ZoneTargets, pace: PaceGuide,
  label = 'Easy run — Zone 2',
  rpe = 4,
  notes?: Session['coach_notes'],
): Session {
  // Round to nearest 0.5 km — cleaner display (11.9 → 12.0; 14.7 → 14.5).
  const rounded = roundDistance(distKm)
  return {
    id: `w${weekN}-${day}`,
    type: 'easy', label, detail: null,
    ...(metric === 'distance' ? { distance_km: rounded } : {}),
    duration_mins: dur(rounded, pace.minPerKmEasy),
    primary_metric: metric,
    zone: 'Zone 2', hr_target: zones.easyHR,
    pace_target: pace.easyPaceStr, rpe_target: rpe,
    ...(notes ? { coach_notes: notes } : {}),
  }
}

function longSession(
  weekN: number, day: Day,
  distKm: number, metric: 'distance' | 'duration',
  zones: ZoneTargets, pace: PaceGuide,
  notes?: Session['coach_notes'],
): Session {
  const rounded = roundDistance(distKm)
  return {
    id: `w${weekN}-${day}`,
    type: 'easy', label: 'Long run — Zone 2', detail: null,
    ...(metric === 'distance' ? { distance_km: rounded } : {}),
    duration_mins: dur(rounded, pace.minPerKmEasy),
    primary_metric: metric,
    zone: 'Zone 2', hr_target: zones.easyHR,
    pace_target: pace.easyPaceStr, rpe_target: 4,
    ...(notes ? { coach_notes: notes } : {}),
  }
}

function qualitySession(
  weekN: number, day: Day,
  distKm: number, metric: 'distance' | 'duration',
  zones: ZoneTargets, pace: PaceGuide,
  label = 'Tempo run',
  rpe = 7,
  notes?: Session['coach_notes'],
): Session {
  return {
    id: `w${weekN}-${day}`,
    type: 'quality', label, detail: null,
    ...(metric === 'distance' ? { distance_km: Math.round(distKm * 10) / 10 } : {}),
    duration_mins: dur(distKm, pace.minPerKmQuality),
    primary_metric: metric,
    zone: zones.qualityZone, hr_target: zones.qualityHR,
    pace_target: pace.qualityPaceStr, rpe_target: rpe,
    ...(notes ? { coach_notes: notes } : {}),
  }
}

// Catalogue-aware quality session builder. Uses catalogue row's name and voice
// notes when available; falls back to a Phase-appropriate inline label.
// CoachingPrinciples §1 / Q2 (Coaching Board 2026-08-18, "learn the cue, refuse
// the method") — controlled-threshold execution cue. One sentence, dry, echoes
// BRAND.voiceAnchor "Hold the zone". Placed on the FIRST genuine threshold session
// of the plan only (taught once, then trusted — repetition turns it to wallpaper).
/**
 * §115 — fuelling PRACTICE, not a nutrition prescription (Sims; ADR-011 has no
 * dietary data and individualised nutrition advice is out of scope). Names the
 * rehearsal, not the quantity.
 */
const CONTROLLED_THRESHOLD_CUE = 'Controlled effort — if you can’t say a short sentence, you’ve drifted into the grey zone.'


// Coaching Board 2026-09-03 — resolve a v2 pace anchor to a numeric min/km for
// SIZING purposes (distinct from resolveMainSet's anchor→STRING resolution
// for display, lib/plan/resolveMainSet.ts, which this does not replace).
// `goalPaceMinPerKm` is null whenever the runner has no goal pace (a finish
// plan, or no target_time) — the anchor is then unresolvable, same "absent
// anchors are legitimate" posture as resolveMainSet's own docstring.
/**
 * §120 (+ Amendment 1) — the HM anchor on a time-target HALF plan.
 *
 * ⚠️ THE `HM` ARM READS `goalPaceMinPerKm`, WHICH IS THE PLAN'S GOAL PACE FOR
 * WHATEVER DISTANCE THE PLAN IS. That is the runner's half-marathon goal only
 * because every row carrying an `HM` work anchor is `distance_eligibility:
 * ['HM']` — one row, `hm_pace_intervals`. Left as a comment that would be true
 * today and false the first time a marathon row wanted an HM-paced step, so it
 * is a CHECK instead: `INV-CAT-HM-ANCHOR-IS-HM-ONLY`. Do not delete it and rely
 * on the sentence above.
 *
 * Returning `null` is how §120's bound is enforced, and it needs no second gate:
 * `resolvableAnchors` is built from this function, so an unresolvable anchor
 * already makes every row needing it ineligible (CAT-ROW-ELIGIBILITY-01). One
 * owner prices the anchor and the same owner withholds it.
 */
function resolveAnchorPace(
  anchor: PaceAnchor, pace: PaceGuide, goalPaceMinPerKm: number | null,
): number | null {
  switch (anchor) {
    case 'E':    return pace.minPerKmEasy
    case 'T':    return pace.minPerKmQuality
    case 'CV':   return pace.minPerKmCV
    case 'I':    return pace.minPerKmInterval
    case 'goal': return goalPaceMinPerKm
    // §24b — null for a structurally-beginner runner, who is prescribed no pace
    // segments. That is a legitimate "this runner has no such pace", not a gap:
    // the selector's anchor gate keeps rows needing them out of their pool.
    case 'M':    return pace.minPerKmMarathon
    case 'HM': {
      // Finish goal, or a plan that is not a half: unchanged — the runner's
      // current half-marathon pace, as it has always been.
      if (goalPaceMinPerKm == null) return pace.minPerKmHM
      // §120 Amendment 1 — bounded. Past CV this stops being race rehearsal and
      // becomes threshold-or-harder work at a volume authored for race pace.
      // Withheld rather than capped: a session named "HM-pace reps" run at a
      // pace that is NOT the runner's HM goal is the header defect this whole
      // item exists to fix, and renaming it honestly stops it being
      // race-specific, which is withholding with extra steps.
      if (pace.minPerKmCV != null) {
        const cvFloor = pace.minPerKmCV * (1 - GENERATION_CONFIG.RACE_PACE_ANCHOR_MAX_OVER_CV_PCT / 100)
        if (goalPaceMinPerKm < cvFloor) return null
      }
      // §120 — "HM pace" on a time-target plan means the pace of the race the
      // runner is training for, as `T` has since 2026-09-03 and as the sibling
      // `mp_blocks` / `tenk_pace_intervals` rows are already anchored `goal`.
      return goalPaceMinPerKm
    }
    default:     return null   // R/race_5K/race_3K: no numeric pace resolved here today
  }
}

// SC-08 vo2max, generalised 2026-09-03 — per-rep minutes of a v2 step,
// resolved against this runner's pace for distance reps (via the step's own
// anchor, not always I-pace), read directly for duration reps.
function v2StepMinutes(
  step: { length: { kind: string; secs?: number; m?: number }; target: { kind: string; anchor?: string } },
  pace: PaceGuide,
  goalPaceMinPerKm: number | null,
  // Coaching Board 2026-09-03 — resolve against THIS anchor instead of the
  // step's own, when set. Lets a caller size a T-anchored work step at goal
  // pace for a goal-paced session (useGoalPace) without mutating the row's
  // authored step, which stays 'T' for every OTHER week that draws it.
  anchorOverride?: PaceAnchor,
): number {
  const len = step.length
  if (len.kind === 'duration' && typeof len.secs === 'number') return len.secs / 60
  if (len.kind === 'distance' && typeof len.m === 'number') {
    const anchor = anchorOverride ?? (step.target.kind === 'pace' ? (step.target.anchor as PaceAnchor) : undefined)
    const minPerKm = anchor ? resolveAnchorPace(anchor, pace, goalPaceMinPerKm) : null
    return minPerKm != null ? (len.m / 1000) * minPerKm : 0
  }
  return 0
}

// SC-08 vo2max (Coaching Board 2026-08-21), generalised to threshold/race-pace
// rows (Coaching Board 2026-09-03) — the rep COUNT for a v2 paced-rep row. The
// dose is a fixed band by fitness × phase (NOT weekly volume — the SC-10 error
// the board refused to re-import), bounded per-category [*_WORK_MIN_MINS,
// *_WORK_MAX_MINS] of WORK. Rep length is the stimulus identity and stays
// fixed; the count is the dose. Returns null for anything that is not a PACED
// rep block in an eligible category (effort-governed hills, continuous shapes
// like progressive_tempo, v1 rows) — those keep their existing sizing.
// `mainMins` is the structure's own main-set length (work + recovery), used to
// make the session STRUCTURE-DRIVEN. `workPaceMinPerKm` is exposed so the
// caller's distance estimate uses the SAME pace this function sized against,
// rather than hardcoding I-pace for every category (the bug this generalises
// away — a threshold session's estimated distance was inflated by using
// VO2max pace to convert its minutes).
/**
 * §85 — does this row's rep run at MORE THAN ONE work pace?
 *
 * True only for over-unders today. Two consequences follow, and both are the
 * difference between a coherent session and a broken one:
 *
 *  1. The displayed pace band must be the rep's time-weighted MEAN, not the
 *     category's single band. A header reading plain T on a session half of
 *     whose work is above T understates it, and `INV-PLAN-OVER-UNDER-MEAN-NEAR-
 *     THRESHOLD` fails it — which is how this gap was found, after the ruling
 *     had already assumed the mean was displayed.
 *  2. It must be EXCLUDED from §22's goal-pace-week override. That override
 *     rewrites T-anchored work to goal pace; applied here it rewrites one half
 *     of an alternation and leaves the other, so the "over" can land SLOWER
 *     than the "under". The session is defined by the RELATIONSHIP between its
 *     two paces — substituting one is not a re-pacing, it is a different
 *     session wearing the name. Same reasoning that excluded effort-governed
 *     rows from `useGoalPace` (§40b veto, earlier the same day).
 */
function hasMixedWorkAnchors(row: SessionCatalogueRow | null | undefined): boolean {
  if (!row || !isV2Structure(row.main_set_structure)) return false
  const parsed = StructureV2Schema.safeParse(row.main_set_structure)
  if (!parsed.success) return false
  const anchors = new Set(
    parsed.data.blocks.flatMap(b => b.steps)
      .filter(st => st.role === 'work' && st.target.kind === 'pace')
      .map(st => (st.target as { anchor: string }).anchor)
      // EASY-ANCHORED WORK IS A RAMP, NOT A SECOND WORK PACE. Without this,
      // `progressive_tempo` counts as mixed — its first third is authored
      // `work @ E` — and a first pass duly excluded it from §22's goal-pace
      // override, breaking INV-PLAN-RACE-SPECIFIC-EXPOSURE across 74 tests.
      // The property that matters is two distinct WORKING intensities, which
      // is what an alternation has and a progression does not.
      .filter(a => a !== 'E'),
  )
  return anchors.size > 1
}

function pacedRepPlan(
  row: SessionCatalogueRow | null,
  fitness: FitnessLevel,
  phase: PhaseType,
  pace: PaceGuide,
  goalPaceMinPerKm: number | null,
  // Coaching Board 2026-09-03 — true when this SESSION (not the row
  // intrinsically) is being prescribed at goal pace, per §22's existing
  // goal-pace-week override (see useGoalPace at the call site). A threshold
  // row's work step is authored at the 'T' anchor because that is what the
  // row means on an ordinary week; sizing it at T-pace while the runner is
  // being told "goal pace" on the label produces a session whose own rep
  // structure disagrees with its headline. race_specific rows (already
  // anchored 'goal' intrinsically) don't need this — callers should pass
  // false for them.
  substituteThresholdWithGoal = false,
): { reps: number; mainMins: number; workPaceMinPerKm: number } | null {
  if (!row || !isV2Structure(row.main_set_structure)) return null
  const cfg = GENERATION_CONFIG
  // §85 — a row may price its own work band (Sims's amendment, CB-CAT-01). The
  // override is consulted FIRST and by row id; absence falls through to the
  // category band, so the default remains the rule.
  const override = cfg.SESSION_WORK_OVERRIDE_MINS[row.id]
  const band = override
    ? { min: override.min, max: override.max, target: override.target }
    : row.category === 'vo2max'
      ? { min: cfg.VO2MAX_WORK_MIN_MINS, max: cfg.VO2MAX_WORK_MAX_MINS, target: cfg.VO2MAX_WORK_TARGET_MINS }
      : (row.category === 'threshold' || row.category === 'race_specific')
        ? { min: cfg.THRESHOLD_WORK_MIN_MINS, max: cfg.THRESHOLD_WORK_MAX_MINS, target: cfg.THRESHOLD_WORK_TARGET_MINS }
        : null
  if (!band) return null
  const parsed = StructureV2Schema.safeParse(row.main_set_structure)
  if (!parsed.success || parsed.data.sizing.scaling !== 'reps') return null
  const block = parsed.data.blocks.find(b => typeof b.repeat === 'object' && b.repeat.param === 'reps')
  if (!block) return null
  // §85 (CB-CAT-01, 2026-09-04) — ALL work steps in the block, not just the first.
  //
  // Every reps-scaled row before over-unders had exactly one work step, so
  // `.find()` and "sum them" were the same number and the distinction never
  // surfaced. An over-under's rep is two work steps (over, then under) and no
  // recovery: reading only the first would size the session off half its own
  // rep — 3 minutes instead of 6 — and prescribe roughly double the reps.
  // Verified before changing: no existing reps-scaled row has more than one
  // work step, so this is a generalisation with zero behavioural delta for them.
  const workSteps = block.steps.filter(s => s.role === 'work')
  // Narrowed here rather than by a `.some()` guard above: the guard would not
  // carry the discriminant into the map, and casting past it would defeat the
  // exact check that keeps effort-governed rows out of this function (§40b).
  const pacedWork = workSteps.filter(
    (s): s is typeof s & { target: { kind: 'pace'; anchor: PaceAnchor } } => s.target.kind === 'pace',
  )
  if (workSteps.length === 0 || pacedWork.length !== workSteps.length) {
    return null  // effort-governed → not this path
  }
  const priced = pacedWork.map(s => {
    const anchor: PaceAnchor = substituteThresholdWithGoal && s.target.anchor === 'T'
      ? 'goal' : s.target.anchor
    return {
      mins: v2StepMinutes(s, pace, goalPaceMinPerKm, anchor),
      paceMinPerKm: resolveAnchorPace(anchor, pace, goalPaceMinPerKm),
    }
  })
  if (priced.some(p => p.paceMinPerKm == null || p.mins <= 0)) return null
  const workMins = priced.reduce((sum, p) => sum + p.mins, 0)
  // TIME-WEIGHTED MEAN pace, not the arithmetic mean of the bands. Total time
  // over total distance — the pace the runner actually averages across the rep.
  // For a single-work-step block this is exactly that step's pace, so nothing
  // moves for the rows that existed before. For an over-under it is what makes
  // the displayed band honest AND keeps a threshold-labelled session inside
  // INV-PLAN-LABEL-MATCHES-PACE's ±3% of T (§19) without amending the principle.
  const workDistanceKm = priced.reduce((sum, p) => sum + p.mins / p.paceMinPerKm!, 0)
  const workPaceMinPerKm = workDistanceKm > 0 ? workMins / workDistanceKm : null
  if (workMins <= 0 || workPaceMinPerKm == null) return null
  const recoveryMins = block.steps
    .filter(s => s.role === 'recovery')
    .reduce((sum, s) => sum + v2StepMinutes(s, pace, goalPaceMinPerKm), 0)
  const target = band.target[fitness]?.[phase] ?? band.min
  const floorReps = Math.max(1, Math.ceil(band.min / workMins))
  const ceilReps  = Math.max(floorReps, Math.floor(band.max / workMins))
  let reps = Math.max(floorReps, Math.min(ceilReps, Math.round(target / workMins)))
  // §52b/INPUT-FLOOR-01 floor protection — found migrating goal_pace_sharpener
  // (Coaching Board 2026-09-03): a very slow runner's MINIMUM rep count can
  // still convert to a session under MIN_SESSION_DISTANCE_KM.quality (5km) —
  // 2 x 1km reps at a 9:00/km goal pace produced 4.5km, even though the
  // WORK-MINUTE dose (the time-band this function protects) was satisfied.
  // The distance floor is the harder constraint (§52b's own reasoning: "the
  // day has to be sized for its worst case") — grow reps past the dose
  // ceiling rather than ship an under-floor session. D-21: a floor a valid
  // input can't satisfy is a defect in the code enforcing it, not an
  // acceptable session. Capped defensively — should never bind in practice.
  const minKm = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.quality
  // §8 Amendment (2026-09-04) — the floor check must price the session the SAME
  // way the session is priced. It divided total duration by WORK pace while the
  // caller now prices warm-up and cool-down at EASY pace, so it certified a
  // session as clearing 5 km that the caller then produced at 4.5 —
  // INV-PLAN-MIN-SESSION-SIZE, caught by `userDeclaredLevel.test.ts`. A floor
  // measured in different units from the thing it guards is not a floor.
  while (segmentPricedDistance(reps * (workMins + recoveryMins), workPaceMinPerKm, pace.minPerKmEasy) < minKm
         && reps < floorReps + 20) {
    reps++
  }
  return { reps, mainMins: reps * (workMins + recoveryMins), workPaceMinPerKm }
}

// Coaching Board 2026-09-03 — sizing for `progressive_tempo`'s v2 continuous
// shape. Not a reps structure (pacedRepPlan doesn't apply — nothing repeats),
// so this reads GENERATION_CONFIG.PROGRESSIVE_TEMPO_MAIN_MINS directly by
// fitness × phase and splits it into three equal sequential thirds (easy →
// transition → threshold). Gated on row id, not category or structural shape
// — `threshold_ladder` is the identical shape (one block, repeat 1, several
// sequential work steps, scaling: 'fixed') and nothing in the v2 schema marks
// "this is a progression, not a ladder"; row id is the only honest signal
// available today. `thirdSecs` feeds the row's `{ kind: 'parameter',
// param: 'third_secs' }` length references — without it resolveMainSet
// throws (a missing parameter is a catalogue defect, not a soft failure).
/**
 * §40b Amendment 2 (Coaching Board 2026-09-04) — sizing for an EFFORT-GOVERNED row.
 *
 * The sibling of `pacedRepPlan` for rows it deliberately declines. `pacedRepPlan`
 * returns null the moment a work step has no pace, which is correct for it and left
 * `hill_reps`/`vert_hike_repeats` with no structure-driven sizing at all — they fell
 * back to distance ÷ easy pace, stating 39 minutes for a session whose own reps need
 * 24 inside a 20.1-minute main set.
 *
 * Prices every step of the row's own structure, including the two kinds it could not
 * price before:
 *   • `open` ("until ready")        → EFFORT_GOVERNED_RECOVERY_SECS
 *   • `to_landmark` ("to the hill") → EFFORT_GOVERNED_TRANSITION_MINS
 * Both are SIZING estimates and are never prescribed — see the config comment.
 *
 * Returns `standingMins` separately because a `stand` step covers no ground: the
 * distance estimate must exclude it or the session's distance inflates by the time
 * the runner spends still. (Walking and hiking DO cover ground, just slower than easy
 * pace — that residual over-estimate is pre-existing and untouched here.)
 *
 * Reads the ROW plus the resolved variant, not the session's `derived_set`, so it
 * runs before the set is built and cannot be fed a value it just produced.
 */
function effortGovernedPlan(
  row: SessionCatalogueRow | null | undefined,
  variant: { values: Record<string, number> } | null,
  pace: PaceGuide,
): { mainMins: number; standingMins: number } | null {
  if (!row || !isV2Structure(row.main_set_structure)) return null
  const parsed = StructureV2Schema.safeParse(row.main_set_structure)
  if (!parsed.success) return null
  const work = parsed.data.blocks.flatMap(b => b.steps).filter(s => s.role === 'work')
  // Effort-governed is the same structural test the rest of this file uses.
  if (work.length === 0 || !work.every(s => s.target.kind === 'effort')) return null

  const cfg = GENERATION_CONFIG
  const params = variant?.values ?? {}
  let mainMins = 0
  let standingMins = 0

  for (const block of parsed.data.blocks) {
    const repeat = typeof block.repeat === 'number'
      ? block.repeat
      : params[block.repeat.param]
    if (typeof repeat !== 'number') return null
    let blockMins = 0
    let blockStanding = 0
    let previousWorkMins = 0
    for (const step of block.steps) {
      let mins: number
      switch (step.length.kind) {
        case 'duration':   mins = step.length.secs / 60; break
        case 'distance':   mins = (step.length.m / 1000) * pace.minPerKmEasy; break
        case 'parameter': {
          const secs = params[step.length.param]
          if (typeof secs !== 'number') return null
          mins = secs / 60
          break
        }
        // "same as the previous work step" — the jog/walk back down.
        case 'mirror':     mins = previousWorkMins; break
        case 'to_landmark': mins = cfg.EFFORT_GOVERNED_TRANSITION_MINS; break
        case 'open':       mins = cfg.EFFORT_GOVERNED_RECOVERY_SECS / 60; break
        default:           return null
      }
      if (step.role === 'work') previousWorkMins = mins
      if (step.modality === 'stand') blockStanding += mins
      blockMins += mins
    }
    mainMins += repeat * blockMins
    standingMins += repeat * blockStanding
  }
  return mainMins > 0 ? { mainMins, standingMins } : null
}

function progressiveTempoPlan(
  row: SessionCatalogueRow | null, fitness: FitnessLevel, phase: PhaseType,
): { mainMins: number; thirdSecs: number } | null {
  if (!row || row.id !== 'progressive_tempo' || !isV2Structure(row.main_set_structure)) return null
  const cfg = GENERATION_CONFIG
  const mainMins = cfg.PROGRESSIVE_TEMPO_MAIN_MINS[fitness]?.[phase] ?? cfg.PROGRESSIVE_TEMPO_MAIN_MINS[fitness]?.build
  if (mainMins == null) return null
  const thirdSecs = Math.round((mainMins * 60) / 3)
  return { mainMins, thirdSecs }
}

// Coaching Board 2026-09-03 — sizing for `tempo_continuous`'s v2 single-block
// continuous shape. Not reps (nothing repeats) and not a progression (single
// sustained pace throughout) — but the dose IS the same threshold-work band
// already ruled correct for the reps-scaled rows, so this reads
// THRESHOLD_WORK_TARGET_MINS directly rather than a new constant. Falls back
// to THRESHOLD_WORK_MIN_MINS for taper (no taper entry in the target table —
// same fallback pacedRepPlan already applies for goal_pace_sharpener, a
// taper-only row drawing from the same table).
/**
 * §85 (CB-CAT-01) — sizing for fixed-shape rows: pyramid, and (CB-CAT-02) ladder.
 *
 * A third `scaling: 'fixed'` shape, and like the two before it (`tempo_continuous`,
 * `progressive_tempo`) it gets its own sizer gated on row id. Nothing in the v2
 * schema distinguishes a pyramid from a ladder — both are one block, repeat 1,
 * several sequential work steps — so row id remains the only honest signal, as
 * `continuousThresholdPlan`'s own comment records.
 *
 * Unlike those two it reads NO config: a pyramid's dose IS its rungs, and the
 * variant supplies them. Summing the row's own steps is the whole calculation.
 *
 * DELIBERATELY NOT GENERALISED to every fixed row. `threshold_ladder` is the
 * identical shape and would be swept up by a generic version — changing what a
 * runner is prescribed, which is a board matter and not this ruling's scope. It
 * keeps the flat quality-session formula it has always used.
 */
/**
 * WORK minutes of a fixed-shape v2 row under a given variant (CB-CAT-02).
 *
 * Work steps only — recovery is not dose. Used by dose-aware variant selection
 * to compare a variant against the runner's band. Returns null when any length
 * cannot be resolved to minutes (a distance rep, a missing parameter), because
 * a partial sum compared against a band is worse than no comparison: it would
 * silently prefer whichever variant happened to be more parseable.
 */
function variantWorkMinutes(
  row: SessionCatalogueRow,
  variant: { values: Record<string, number> },
): number | null {
  if (!isV2Structure(row.main_set_structure)) return null
  const parsed = StructureV2Schema.safeParse(row.main_set_structure)
  if (!parsed.success) return null
  let secs = 0
  for (const block of parsed.data.blocks) {
    const repeat = typeof block.repeat === 'number' ? block.repeat : 1
    for (const step of block.steps) {
      if (step.role !== 'work') continue
      const len = step.length
      const v = len.kind === 'duration' ? len.secs
        : len.kind === 'parameter' ? variant.values?.[len.param]
        : undefined
      if (typeof v !== 'number') return null
      secs += v * repeat
    }
  }
  return secs > 0 ? secs / 60 : null
}

function fixedShapePlan(
  row: SessionCatalogueRow | null | undefined,
  variant: { values: Record<string, number> } | null,
  pace: PaceGuide,
  // §22's goal-pace-week override, as `pacedRepPlan` already takes it. WITHOUT
  // this the rungs render at goal pace (the row is renamed "10K-pace pyramid")
  // while the distance is priced at T — the session's stated distance disagrees
  // with its own steps, which is the §8 defect this sizer exists to prevent.
  goalPaceMinPerKm: number | null = null,
): { mainMins: number; workPaceMinPerKm: number } | null {
  // CB-CAT-02 — `threshold_ladder` joins `threshold_pyramid` here. Measured
  // before extending: those two rows were 36 of 306 quality sessions (11.8%)
  // still taking the flat QUALITY_SESSION_PCT_OF_WEEKLY share after
  // SIZING-REALLOC-01 closed for the other nine, so a 3-5-8-5-3 ladder with 90s
  // jogs — 30 minutes of work — could state a duration its own structure does
  // not fit (McMillan: "the runner finds out on the road").
  //
  // Still an explicit ALLOWLIST rather than "every fixed row", because a row
  // joining it changes the length the runner is told, which is a board matter.
  // CB-HMPACE-SIZING-01 (2026-09-10) — `hm_pace_intervals` joins them, and it is
  // the clearest case yet. MEASURED on generated plans: an intermediate runner was
  // told **45 min** for a session whose main set alone needs **57** — over 70 with
  // warm-up and cool-down. threshold_ladder OVERSTATED (61 for 50); this
  // UNDERSTATES, which is the direction that costs a day-job runner their evening
  // (McMillan). Invisible until 2026-09-10 because the row was v1 and had no
  // derived set to compare a stated duration against: the migration EXPOSED this,
  // it did not cause it. Dose is untouched — 4 x 2 km at HM pace, exactly as
  // before (Willy's condition: the stated number yields, never the session).
  const FIXED_SHAPE_SIZED = new Set(['threshold_pyramid', 'threshold_ladder', 'hm_pace_intervals'])
  if (!row || !FIXED_SHAPE_SIZED.has(row.id) || !isV2Structure(row.main_set_structure)) return null
  const parsed = StructureV2Schema.safeParse(row.main_set_structure)
  if (!parsed.success) return null
  let totalSecs = 0
  for (const block of parsed.data.blocks) {
    const repeat = typeof block.repeat === 'number' ? block.repeat : 1
    for (const step of block.steps) {
      const len = step.length
      // CB-HMPACE-SIZING-01 — DISTANCE steps are priced against the step's own
      // anchor, the same way `pacedRepPlan` prices them (`v2StepMinutes`). Before
      // this, a distance-based fixed-shape row fell out of this sizer at the
      // `typeof secs !== 'number'` guard below and silently kept the flat share —
      // so adding such a row to the allowlist above would have changed nothing
      // and looked like it had worked.
      const secs = len.kind === 'duration'
        ? len.secs
        : len.kind === 'parameter'
          ? variant?.values?.[len.param]
          : len.kind === 'distance'
            ? (() => {
                const mins = v2StepMinutes(step, pace, goalPaceMinPerKm)
                return mins > 0 ? mins * 60 : undefined
              })()
            : undefined
      // A missing parameter is a catalogue defect, not a runtime condition —
      // same posture as resolveMainSet, which throws on one. Here it means the
      // session cannot be sized from its structure, so fall back rather than
      // report a confidently wrong duration built from a partial sum.
      if (typeof secs !== 'number') return null
      totalSecs += secs * repeat
    }
  }
  if (totalSecs <= 0) return null
  // The row must have exactly ONE work anchor, and the session is priced at it.
  // A second anchor still returns null — a session priced at a pace half its work
  // is not run at is the defect this sizer exists to prevent, and that reasoning
  // is unchanged.
  //
  // CB-HMPACE-SIZING-01 — what changed is that the anchor no longer has to be 'T'.
  // The old assertion was written when both allowlisted rows were threshold rows,
  // so "one anchor" and "T" were the same statement. They are not: hm_pace_intervals
  // is HM-anchored, and under the old test it would have returned null and kept the
  // flat share — the allowlist entry above would have LOOKED applied and done
  // nothing. Priced through `resolveAnchorPace`, the single owner of anchor
  // pricing, so this and the derived set cannot disagree about what the pace is.
  const workAnchors = new Set(
    parsed.data.blocks.flatMap(b => b.steps)
      .filter(s => s.role === 'work')
      .map(s => (s.target.kind === 'pace' ? s.target.anchor : null)),
  )
  if (workAnchors.size !== 1) return null
  const [anchor] = Array.from(workAnchors)
  if (anchor == null) return null
  // §22's goal-pace override applies to a T-anchored row being run at goal pace;
  // it must not silently re-price a row anchored at something else.
  const workPaceMinPerKm = anchor === 'T' && goalPaceMinPerKm != null
    ? goalPaceMinPerKm
    : resolveAnchorPace(anchor as PaceAnchor, pace, goalPaceMinPerKm)
  if (workPaceMinPerKm == null) return null
  return { mainMins: totalSecs / 60, workPaceMinPerKm }
}

function continuousThresholdPlan(
  row: SessionCatalogueRow | null, fitness: FitnessLevel, phase: PhaseType,
  // §8 Amendment (2026-09-04) — floor protection, as `pacedRepPlan` has had since
  // goal_pace_sharpener. Optional so the invariant layer can call this for the
  // expected main-set minutes without needing paces.
  floor?: { minKm: number; easyPace: number; workPace: number },
): { mainMins: number; workSecs: number } | null {
  if (!row || row.id !== 'tempo_continuous' || !isV2Structure(row.main_set_structure)) return null
  const cfg = GENERATION_CONFIG
  let mainMins = cfg.THRESHOLD_WORK_TARGET_MINS[fitness]?.[phase] ?? cfg.THRESHOLD_WORK_MIN_MINS
  // D-21 / §52b — a floor a valid input cannot satisfy is a defect in the code
  // enforcing it, not an acceptable session. Segment pricing shrank the delivered
  // distance, and this shape had NO floor protection (pacedRepPlan did), so a
  // low-volume 10K taper produced a 4.5 km quality session against a 5 km floor.
  // Grown HERE rather than at the call site because `workSecs` must scale with
  // `mainMins` — the row's step length is a parameter, and growing one without
  // the other makes the session's own structure disagree with its duration.
  if (floor) {
    let guard = 0
    while (segmentPricedDistance(mainMins, floor.workPace, floor.easyPace) < floor.minKm && guard++ < 60) {
      mainMins += 1
    }
  }
  return { mainMins, workSecs: Math.round(mainMins * 60) }
}

/** Distance of a structured session priced SEGMENT BY SEGMENT — warm-up and
 *  cool-down at easy pace, the main set at its own work pace (§8 Amendment,
 *  Coaching Board 2026-09-04). Shared by the sizing functions and their callers
 *  so a floor check can never be measured in different units from the session it
 *  guards — which is exactly how a 4.5 km session passed a 5 km floor. */
function segmentPricedDistance(mainMins: number, workPaceMinPerKm: number, easyPaceMinPerKm: number): number {
  const total = durationForMainSet(mainMins)
  return (total - mainMins) / easyPaceMinPerKm + mainMins / workPaceMinPerKm
}

function makeQualitySession(args: {
  weekN: number; day: Day; distKm: number; metric: 'distance' | 'duration'
  zones: ZoneTargets; pace: PaceGuide
  catalogueRow: SessionCatalogueRow | null
  phase: PhaseType; fitness: FitnessLevel; isDeload: boolean
  goalPace: string | null | undefined
  goalPaceWeek?: boolean
  distLabel?: string  // e.g. "10K", "HM" — used when goalPaceWeek triggers race-distance-named session
  // Plan-level mutable flag for the first-threshold cue (§1/Q2). makeQualitySession
  // owns the decision using its own category/vo2max/goal-pace predicates so no
  // classification logic is duplicated at the call site; it flips the flag when it
  // actually places the cue. Absent → cue never placed (safe degradation).
  cueCtx?: { thresholdCuePlaced: boolean }
}): Session {
  const { weekN, day, distKm, metric, zones, pace, catalogueRow, phase, fitness, isDeload, goalPace, goalPaceWeek, distLabel, cueCtx } = args

  // SC-09 / CD-17a — pick the variant for a parameterised row.
  //
  // Deterministic on weekN so a plan alternates its rep lengths rather than
  // repeating one, which is what makes ONE row satisfy §53's variety rule: the
  // label template renders the parameter, so "Hill reps — 45s" and
  // "Hill reps — 90s" count as distinct labels from a single entry.
  const variant = (() => {
    const p = catalogueRow?.parameterisation
    if (!p || p.variants.length === 0) return null
    // CB-CAT-02 (2026-09-04) — dose-aware selection, OPT-IN per row.
    //
    // For a fixed-shape row the variant IS the dose: `threshold_pyramid`'s two
    // rung sets are 16 and 23 minutes of threshold work, and rotating them by
    // week number made it the one session in the plan that ignored the runner's
    // band entirely — an experienced runner could draw the 16 and an
    // intermediate the 23. Picking the variant whose own work minutes land
    // closest to `THRESHOLD_WORK_TARGET_MINS[fitness][phase]` is what makes a
    // declaration reach a fixed-shape session at all.
    //
    // Rotation stays the default and every other row keeps it: variants are
    // normally a VARIETY dial (45s vs 90s hill reps are different sessions to
    // run), and converting that to "always the biggest" would raise load under
    // the name of selection — Seiler's condition on this ruling.
    if (p.select_by === 'dose' && catalogueRow) {
      const cfg = GENERATION_CONFIG
      const band = cfg.SESSION_WORK_OVERRIDE_MINS[catalogueRow.id]?.target
        ?? (catalogueRow.category === 'vo2max'
          ? cfg.VO2MAX_WORK_TARGET_MINS
          : cfg.THRESHOLD_WORK_TARGET_MINS)
      const target = band[fitness]?.[phase]
      // No target for this fitness x phase cell (a taper, say) — fall through to
      // rotation rather than inventing one. Absence is not zero.
      if (typeof target === 'number') {
        let best = p.variants[0]
        let bestGap = Infinity
        for (const v of p.variants) {
          const mins = variantWorkMinutes(catalogueRow, v)
          if (mins == null) continue
          const gap = Math.abs(mins - target)
          // Strict `<` keeps the FIRST variant on a tie, so the smaller shape
          // wins an exact draw and regeneration stays deterministic.
          if (gap < bestGap) { best = v; bestGap = gap }
        }
        if (bestGap < Infinity) return best
      }
    }
    return p.variants[weekN % p.variants.length]
  })()

  // Moved ahead of repPlan/derivedSet (Coaching Board 2026-09-03) — both need
  // to know whether THIS session is goal-paced before they resolve the row's
  // pace anchor, not after. isVo2max/catalogueRowGoalPace/useGoalPace govern
  // the session's overall label/pace_target below exactly as before; the
  // NEW dependency is that a threshold-category v2 row's T-anchored work
  // step must ALSO resolve to goal pace when useGoalPace is true, or its
  // derived_set silently disagrees with the label sitting next to it (found
  // via a real generated plan: tempo_cruise_short's label correctly read
  // "10K-pace progression" at goal pace while its derived_set showed true
  // threshold pace underneath — the exact class of bug §19 exists to catch,
  // just not one §19 itself could see since it checks label against
  // pace_target, not against derived_set).
  const isVo2max = catalogueRow?.category === 'vo2max'

  // Is this session governed by EFFORT rather than pace? True when the row's v2
  // work steps carry an effort target and no pace.
  //
  // This is the first session type where effort is the primary prescription
  // rather than a supporting note (§41). A hill rep has no pace and cannot have
  // one — the gradient decides it — so prescribing `intervalPaceStr` here
  // because the row is categorised `vo2max` would ship a number the runner
  // cannot act on and that §19 would then "verify" against a label. The
  // absence of a pace is the prescription.
  //
  // HOISTED ABOVE `useGoalPace` (Coaching Board 2026-09-04, §40b veto) — it used
  // to be computed ~40 lines below, which meant §22's goal-pace override could
  // not see it and claimed effort-governed rows for itself. See the veto note on
  // `useGoalPace` immediately below.
  const isEffortGoverned = (() => {
    if (!catalogueRow || !isV2Structure(catalogueRow.main_set_structure)) return false
    const parsed = StructureV2Schema.safeParse(catalogueRow.main_set_structure)
    if (!parsed.success) return false
    const work = parsed.data.blocks.flatMap(b => b.steps).filter(st => st.role === 'work')
    return work.length > 0 && work.every(st => st.target.kind === 'effort')
  })()

  // Catalogue rows can request goal-pace prescription intrinsically (not
  // conditional on goalPaceWeek) — v1 rows via `work.pace_target: 'goal'`
  // (goal_pace_sharpener), v2 rows via a work step anchored `'goal'`
  // (tenk_pace_intervals, migrated 2026-09-03). Checked structurally, not by
  // row id (INV-CLASS) — reads whichever shape the row is actually in rather
  // than assuming v1, which silently stopped matching tenk_pace_intervals
  // the moment it migrated and desynced its top-level pace_target from its
  // own (correctly goal-paced) derived_set.
  const catalogueRowGoalPace = catalogueRow?.category === 'race_specific' && (() => {
    const ms = catalogueRow.main_set_structure
    if (isV2Structure(ms)) {
      const parsed = StructureV2Schema.safeParse(ms)
      if (!parsed.success) return false
      return parsed.data.blocks.flatMap(b => b.steps)
        .some(s => s.role === 'work' && s.target.kind === 'pace' && s.target.anchor === 'goal')
    }
    return (ms as { work?: { pace_target?: string } }).work?.pace_target === 'goal'
  })()
  // §40b VETO — Coaching Board 2026-09-04, unanimous. An effort-governed row is
  // EXCLUDED from §22's goal-pace override entirely: label, pace_target and
  // derived_set.
  //
  // Before this, a time-targeted 100K could draw `vert_hike_repeats` — a power-
  // hiking climb session whose own steps read "hands on quads, short steps" and
  // "walk back down", prescribed at `target: { kind: 'effort', rpe: 6 }` — and
  // ship it to the runner as "100K-pace intervals" with a pace target of
  // 8:14–8:34 /km. §40b is explicit that an effort-governed session "does not
  // invent a number the runner cannot act on"; §22's override invented exactly
  // that number. The tension was named in a comment further down this function
  // and deferred to this board rather than resolved; measured at 4 occurrences
  // in 5,392 swept plans, 100K-only in that sample but distance-agnostic in
  // mechanism — any future effort-governed row on a time-target plan inherits it.
  //
  // `isVo2max` alone did not cover it: `vert_hike_repeats` is `ultra_specific`,
  // and keying on category would only ever chase the categories that exist today.
  // The test is STRUCTURAL (does the row's work step carry a pace at all?) —
  // INV-CLASS, same reason the goal-pace checks above read the row's shape rather
  // than its id.
  // §85 — a mixed-pace row is excluded here for the same reason effort-governed
  // rows are: see hasMixedWorkAnchors.
  const isMixedPaceRow = hasMixedWorkAnchors(catalogueRow)
  const useGoalPace = (goalPaceWeek === true || catalogueRowGoalPace)
    && !isVo2max && !isEffortGoverned && !isMixedPaceRow && !!goalPace
  const goalCenterMins = useGoalPace ? paceStrToMins(goalPace!) : null
  // A threshold row's work step is authored at 'T' because that's what it
  // means on an ordinary week; race_specific rows are already intrinsically
  // 'goal'-anchored (catalogueRowGoalPace already found this) so need no
  // substitution. Shared by repPlan's sizing and derivedSet's display below —
  // both must agree, or the rep structure silently disagrees with its label.
  const substituteThresholdWithGoal = useGoalPace && catalogueRow?.category !== 'race_specific'

  // SC-08 vo2max, generalised to threshold/race-pace rows (Coaching Board
  // 2026-09-03) — the scaled rep count for a v2 paced-rep row (null
  // otherwise). Feeds the derived set's `reps` parameter AND makes the
  // session structure-driven (its size is the rep structure, not weekly ×
  // 18%). `goalPaceMinPerKmForSizing` doubles as the sizing pace for a
  // threshold row's T-anchored work step when useGoalPace is true (see
  // resolveAnchorPace's caller below) — a goal-paced threshold session sizes
  // itself at the pace it will actually be run at, not at generic T-pace.
  const goalPaceMinPerKmForSizing = goalPace ? paceStrToMins(goalPace) : null
  const repPlan = pacedRepPlan(
    catalogueRow, fitness, phase, pace, goalPaceMinPerKmForSizing,
    substituteThresholdWithGoal,
  )

  // Coaching Board 2026-09-03 — progressive_tempo's continuous-shape sizing
  // (see progressiveTempoPlan). Null for every other row; mainMins feeds
  // effectiveDistKm below the same way repPlan.mainMins does, and thirdSecs
  // feeds the row's three `{ kind: 'parameter', param: 'third_secs' }` steps.
  const progTempoPlan = progressiveTempoPlan(catalogueRow, fitness, phase)

  // §40b Amendment 2 (Coaching Board 2026-09-04) — structure-driven sizing for the
  // rows `pacedRepPlan` declines. Null for every paced row.
  const effortPlan = effortGovernedPlan(catalogueRow, variant, pace)

  // §85 / CB-CAT-02 — fixed-shape rows sized by summing their own steps.
  // Null for every other row.
  const fixedShape = fixedShapePlan(
    catalogueRow, variant, pace,
    substituteThresholdWithGoal ? goalPaceMinPerKmForSizing : null,
  )

  // Coaching Board 2026-09-03 — tempo_continuous's single-block continuous
  // sizing (see continuousThresholdPlan). Null for every other row.
  const contTempoPlan = continuousThresholdPlan(catalogueRow, fitness, phase, {
    minKm: GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.quality,
    easyPace: pace.minPerKmEasy,
    workPace: pace.minPerKmQuality,
  })

  // `isEffortGoverned` is defined above, hoisted ahead of `useGoalPace` by the
  // §40b veto (Coaching Board 2026-09-04) — it must be known before §22's
  // goal-pace override decides whether it owns this session.

  const effortRpe = (() => {
    if (!isEffortGoverned || !catalogueRow) return null
    const parsed = StructureV2Schema.safeParse(catalogueRow.main_set_structure)
    if (!parsed.success) return null
    const work = parsed.data.blocks.flatMap(b => b.steps)
      .find(st => st.role === 'work' && st.target.kind === 'effort')
    return work && work.target.kind === 'effort' ? work.target.rpe : null
  })()

  // SC-08b — resolve a v2 row's shape against this runner's paces.
  //
  // ANCHORS RESOLVE TO PACES HERE AND NOWHERE ELSE. A catalogue row never
  // contains a number; the runner's own paces supply them. Anchors that do not
  // apply to this runner are simply absent — a beginner has no marathon pace,
  // and `goal` exists only for a time target — and resolveMainSet degrades the
  // step to its zone or RPE rather than inventing a figure.
  const derivedSet = (() => {
    if (!catalogueRow || !isV2Structure(catalogueRow.main_set_structure)) return null
    const parsed = StructureV2Schema.safeParse(catalogueRow.main_set_structure)
    // A malformed v2 row is a data defect caught by INV-CAT-V2-WELL-FORMED at
    // the catalogue level. Failing soft here keeps generation working (ADR-006's
    // posture) rather than denying a runner a plan over a bad row.
    if (!parsed.success) return null
    const anchors: PaceAnchorMap = {
      E: pace.easyPaceStr,
      // Band, not the bare goalPace point — matches paceTarget's own
      // paceBandStr(goalCenterMins, 2) below exactly, so the derived_set's
      // displayed pace and the session's headline pace_target read as the
      // same prescription formatted the same way, not just the same number.
      T: substituteThresholdWithGoal && goalCenterMins != null ? paceBandStr(goalCenterMins, 2) : pace.qualityPaceStr,
      // §85 — never substituted by §22's goal-pace override. The "over" of an
      // over-under is defined relative to the runner's THRESHOLD, not to their
      // race goal; a goal-paced week must not silently redefine what "over" means.
      CV: pace.cvPaceStr,
      I: pace.intervalPaceStr,
      ...(pace.marathonPaceStr ? { M: pace.marathonPaceStr } : {}),
      // CAT-ROW-ELIGIBILITY-01 — the DISPLAY half of the HM anchor. This map and
      // `resolveAnchorPace` are two resolvers for the same question (which pace
      // does this anchor mean for this runner?), one returning a band string for
      // the derived set and one a numeric for sizing. Adding HM to only the
      // numeric one shipped 859 sessions reading "HM-pace reps" with NO pace at
      // all — caught by INV-PLAN-DERIVED-SET-PACED. Both are null for exactly the
      // same runners (§24b), so the selector's gate stays consistent with both.
      // §120 — the DISPLAY half of the HM anchor, resolved through the SAME
      // owner as the sizing half. It previously read `pace.hmPaceStr` directly,
      // which was correct only while the anchor meant "current HM pace"; §120
      // makes it mean "the pace of the race you are training for" on a
      // time-target plan, and two resolvers answering that question from two
      // sources is how CAT-ROW-ELIGIBILITY-01 shipped 859 sessions reading
      // "HM-pace reps" with no pace at all. Band width 2 when substituted, to
      // match `T`'s goal band above exactly; the unsubstituted case keeps its
      // authored ±3s string.
      ...(() => {
        const hm = resolveAnchorPace('HM', pace, goalPaceMinPerKmForSizing)
        if (hm == null) return {}
        return { HM: goalPaceMinPerKmForSizing != null ? paceBandStr(hm, 2) : pace.hmPaceStr! }
      })(),
      ...(goalPace ? { goal: goalPace } : {}),
    }
    const params = {
      ...(variant?.values ?? {}),
      ...(repPlan ? { reps: repPlan.reps } : {}),
      ...(progTempoPlan ? { third_secs: progTempoPlan.thirdSecs } : {}),
      ...(contTempoPlan ? { work_secs: contTempoPlan.workSecs } : {}),
    }
    return resolveMainSet(parsed.data, { anchors, easyPaceStr: pace.easyPaceStr, params })
  })()

  // Fallback label if no catalogue row matched (e.g. 5K/10K taper week).
  const fallbackLabel = phase === 'taper' ? 'Tempo run — short'
    : phase === 'peak' && fitness !== 'experienced' ? 'Cruise intervals'
    : 'Tempo run'

  // CoachingPrinciples §19 — session label must match prescribed physiology.
  // VO2max-categorised sessions get true I-pace (Z4–Z5). Threshold and the rest
  // get T-pace (Z3). VO2max keeps its label even in goal-pace weeks — the
  // physiology of true I-pace work is too valuable to lose for label specificity.
  // CoachingPrinciples §22 — second-half quality of time-targeted plans is
  // race-specific. When goalPaceWeek is set and the session is not vo2max,
  // override prescription to goal pace and rename label.

  // SC-02 / CD-15 (§19, §33) — an AEROBIC catalogue row selected into a quality
  // slot is prescribed at threshold pace in Zone 3–4 by the final branch below.
  // Keeping the row's own name ships a session whose label says easy and whose
  // prescription says threshold: "Steady aerobic" at T-pace in the grey zone,
  // which is what every 5K and 10K build week contained until this landed.
  // (Cause: no threshold row is eligible for 5K/10K, so the selector falls back
  // to aerobic — SC-04 fixes the eligibility; this fixes the honesty, and the
  // board ruled it ships unconditionally without waiting.)
  //
  // §33 sanctions renaming a repurposed row and REQUIRES the borrowed voice be
  // replaced — an aerobic row's "most of the work happens here" note is wrong
  // on a threshold session. Keyed on the structural category, never the label
  // (INV-CLASS), same as the §1/Q2 cue below.
  const aerobicRepurposedAsQuality = !useGoalPace && !isVo2max
    && catalogueRow?.category === 'aerobic'

  let label: string
  let minPerKm: number
  let paceTarget: string
  let zone: string
  let hrTarget: string

  if (useGoalPace && goalCenterMins != null) {
    // Override label only when the override is the source of goal-pace.
    // When the catalogue row already names itself goal-pace work (e.g.
    // "Goal-pace sharpener"), preserve the catalogue name.
    //
    // CoachingPrinciples §53 / LABEL-VARIETY-01 — the trailing word is the
    // session's SHAPE, not its phase. A peak block draws several distinct rows
    // (a ladder, a continuous tempo, a progressive tempo); naming them all
    // "{dist}-pace intervals" collapsed up to eight sessions to one name, which
    // reads as monotony and tripped §53's label cap. Deriving the word from the
    // row's own structure keeps "{dist}-pace" — the fragment every §22/§19 check
    // keys on — as the stable lead, while restoring the honest distinction: a
    // goal-pace session run as a ladder IS a ladder. Same row → same word, so
    // real repetition still reads as repetition (this does not paper over
    // CAT-ULTRA-THIN-01). Taper keeps its "sharpener" flavour (§6 — sharpen,
    // don't build); build/peak with no resolvable shape fall back to the old
    // phase-flavoured word so behaviour is unchanged where a row is absent.
    // LBL-01 (Coaching Board 2026-09-04) — BUILD now takes the row's shape word
    // too. This is a REVERT of LABEL-VARIETY-01's build/taper carve-out, not a
    // new rule, and recording it as a revert is the point: that carve-out's
    // stated reason was "§53 counts by label", and §53 stopped counting labels
    // 62 minutes later the same morning (`a4db6aa` 08:17 → `1021013` 09:19,
    // 2026-08-21, CAT-ULTRA-THIN-01 — "Counts the ROW, not the label"). Nobody
    // removed the constraint once its reason was deleted. Written down so the
    // next reviewer does not re-add it from the old comment.
    //
    // The cost was label honesty: every build goal-paced session said
    // "progression" whatever the row was, so `tempo_cruise_short` (4 × 5 min
    // cruise intervals — nothing progresses) and `progressive_tempo` shipped
    // under ONE name in consecutive weeks. Measured across 5,392 plans:
    // 12.5–19.1% of plans at every distance except 5K, with up to FOUR
    // structurally different rows sharing a name at marathon and above.
    //
    // TAPER IS DELIBERATELY UNCHANGED, against the ruling's "every phase"
    // wording, because the measurement did not support it: taper collisions are
    // **0% at every distance**. And "sharpener" is a PURPOSE word (§6 — sharpen,
    // don't build), not a shape claim. The defect is a shape word attached to
    // the wrong shape; a purpose word makes no shape claim to be wrong about.
    // Changing taper would have been an unforced change with no evidence.
    //
    // Build/peak with no resolvable shape still fall back to the generic
    // "intervals" so behaviour is unchanged where a row is absent.
    //
    // KNOWN RESIDUAL, and it is honest: `tempo_cruise` and `tempo_cruise_short`
    // both resolve to "reps", so they still share a label at 5K/10K (the only
    // distances where both are eligible). They genuinely ARE the same shape,
    // differing only in rep length — so the shared word is accurate, and §53
    // still tells them apart because it counts the row. What this fix removes is
    // the DISHONEST collision, not every collision.
    //
    // The §22/§40b tension this comment used to defer ("its being goal-paced at
    // all is board territory") was RESOLVED by the 2026-09-04 veto: an effort-
    // governed row never reaches this branch at all — `useGoalPace` excludes it.
    // The `isEffortGoverned` guard below is now unreachable-by-construction and
    // is kept as a defensive belt: if a future change reopens the path, the label
    // degrades to the generic rather than claiming a shape a hike does not have.
    // `INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED` is the check that would catch it.
    const overrideShape =
      phase === 'taper'
        ? 'sharpener'
        : ((isEffortGoverned ? null : goalPaceShapeWord(catalogueRow)) ?? 'intervals')
    // D2 — the runner-facing name, not the enum value. See
    // `raceDistanceDisplayName`: `distLabel` is a RaceDistanceKey, and
    // 'MARATHON' shipped as "MARATHON-pace reps" on the published pages.
    const overrideLabel = distLabel
      ? `${raceDistanceDisplayName(distLabel)}-pace ${overrideShape}`
      : 'Goal-pace cruise intervals'
    label = catalogueRowGoalPace
      ? (catalogueRow?.name ?? fallbackLabel)
      : overrideLabel
    minPerKm = goalCenterMins
    paceTarget = paceBandStr(goalCenterMins, 2)
    zone = zones.qualityZone
    hrTarget = zones.qualityHR
  } else if (isEffortGoverned) {
    // SC-09 / CD-17a — NO PACE, deliberately. Placed before the vo2max branch
    // because `hill_reps` is categorised vo2max and would otherwise inherit
    // interval pace, which is the defect this session exists to avoid.
    //
    // The label renders the variant: "Hill reps — 45s".
    label = variant && catalogueRow?.parameterisation
      ? catalogueRow.parameterisation.name_template.replace('{param}', variant.label_suffix)
      : (catalogueRow?.name ?? fallbackLabel)
    // Duration still needs a pace to estimate against; easy pace is the honest
    // choice, since the climb is short and most of the session is transition
    // and recovery. It is NOT surfaced as a target — see paceTarget below.
    minPerKm = pace.minPerKmEasy
    paceTarget = ''
    zone = zones.intervalsZone
    hrTarget = zones.intervalsHR
  } else if (isVo2max) {
    label = catalogueRow?.name ?? fallbackLabel
    minPerKm = pace.minPerKmInterval
    paceTarget = pace.intervalPaceStr
    zone = zones.intervalsZone
    hrTarget = zones.intervalsHR
  } else {
    // SC-02 — a repurposed aerobic row takes the engine's own threshold label
    // ("Tempo run" / "Cruise intervals" / "Tempo run — short"), which is what
    // this slot would have been called with no catalogue row at all. That is
    // exactly what it is: a threshold slot with nothing threshold to put in it.
    label = aerobicRepurposedAsQuality ? fallbackLabel : (catalogueRow?.name ?? fallbackLabel)
    // §85 — a mixed-pace rep displays its TIME-WEIGHTED MEAN, not the category
    // band. `pacedRepPlan` already computes it (total work time over total work
    // distance); reading it here is what keeps the header honest about a session
    // whose steps run either side of threshold, and what makes the ±3% margin
    // §19 was held to rely on something actually measured rather than assumed.
    //
    // ⚠️ HM-ANCHOR-VS-GOAL-01, 2026-09-22 — `isMixedPaceRow &&` REMOVED, and
    // that guard is the whole defect. §85 introduced the time-weighted mean for
    // over-unders and scoped it to them; every OTHER row fell through to the
    // generic threshold band no matter what its work steps were anchored to.
    // Measured on the sweep: 2,811 sessions displayed a pace their own reps
    // contradicted — `cv_intervals` (CV, faster than T) and `hm_pace_intervals`
    // (HM) in opposite directions, worst case 147 s/km. A runner reading the
    // header ran the reps up to 30 s/km too slow, which is the session gone.
    //
    // The honest answer was already computed and already scoped correctly:
    // `pacedRepPlan` resolves each work step through `resolveAnchorPace` and
    // applies §22's goal substitution only to `T` anchors, so its
    // `workPaceMinPerKm` IS this session's work pace for a single-anchor row as
    // much as for an over-under. Nothing new is derived here; a condition is
    // removed. Rows with no paced rep block (continuous shapes, v1 rows) keep
    // the threshold band, which is what they genuinely are.
    minPerKm = repPlan ? repPlan.workPaceMinPerKm : pace.minPerKmQuality
    // ⚠️ `derivedSet` IS THE LAST RESORT, NOT THE THRESHOLD BAND. `pacedRepPlan`
    // returns null for any row it cannot dose (continuous shapes, v1 rows, and a
    // paced-rep row whose rep length blows past the work-minute band) — and the
    // old fallback then printed the generic threshold band over reps the session
    // had already resolved. Found by INV-PLAN-HEADER-PACE-MATCHES-WORK on its
    // first full run: 100 HM sessions reading 5:25-5:40 over work steps at
    // 10:27-10:53, an eight-minute-per-km lie, because the fix above only
    // reached rows that dose.
    //
    // ⚠️ DISPLAY ONLY — `minPerKm` above is deliberately untouched. It sizes the
    // session and therefore sets its prescribed DISTANCE, and moving it is a
    // prescription change the board has NOT ruled on: §120 §6 parks it by name
    // ("the sizing twin of the header defect"). Raise it as its own item.
    const derivedWorkPaces = new Set(
      (derivedSet?.blocks ?? []).flatMap(b => b.steps)
        .filter(st => st.role === 'work' && st.pace)
        .map(st => st.pace as string),
    )
    paceTarget = repPlan
      ? paceBandStr(repPlan.workPaceMinPerKm, 2)
      : derivedWorkPaces.size === 1
        ? Array.from(derivedWorkPaces)[0]
        : pace.qualityPaceStr
    zone = zones.qualityZone
    hrTarget = zones.qualityHR
  }

  // Coach notes — must match the session's actual intent, not the underlying
  // catalogue row when the label has been overridden.
  // (CoachingPrinciples §33 — coach notes by session intent.)
  const notes: string[] = []
  if (useGoalPace && goalPace) {
    // Goal-pace override: synthesise a voice that matches the prescription.
    // Don't carry the catalogue's voice through (it belongs to whichever
    // category the selector fell back to — usually aerobic for 10K plans
    // where no 10K-eligible threshold row exists).
    notes.push(`${distLabel ? raceDistanceDisplayName(distLabel) : 'Goal'}-pace work. Target ${goalPace}. Controlled, even splits — exit each rep wanting more.`)
  } else if (isVo2max && catalogueRow?.coach_voice_notes) {
    // VO2max sessions keep their catalogue voice (the catalogue's vo2max
    // entries — Three minutes is long, Heroic openers ruin it — are correct).
    notes.push(catalogueRow.coach_voice_notes)
  } else if (aerobicRepurposedAsQuality) {
    // §33 — the borrowed aerobic voice ("Build the aerobic engine. Most of the
    // work happens here.") describes a Zone 2 run and is false on a session
    // prescribed at T-pace. Replace it rather than carry it through, and say
    // what the session actually is.
    notes.push('Threshold work — the pace you could hold for about an hour. Not a race.')
  } else if (catalogueRow?.coach_voice_notes) {
    notes.push(catalogueRow.coach_voice_notes)
    if (phase === 'peak' && goalPace && !catalogueRow.coach_voice_notes.toLowerCase().includes('pace')) {
      notes.push(`Race-pace work. Target: ${goalPace}. Controlled — not all-out.`)
    }
  }

  // §1/Q2 — first genuine threshold session of the plan gets the controlled-effort
  // cue. Keyed on the structural catalogue category (never a label — INV-CLASS);
  // skipped for vo2max, goal-pace overrides and deload weeks, where the
  // "say a short sentence" test doesn't describe the prescribed effort. Pushed
  // before truncation so it respects the 3-note cap like any other note.
  // SC-02 — a repurposed aerobic row is now labelled and prescribed as
  // threshold work, so it is eligible for the cue. Without this, a 5K/10K plan
  // — where EVERY build-phase quality session is a repurposed aerobic row —
  // would never receive the §1/Q2 cue at all, which is the one note that names
  // the grey zone the whole product exists to keep runners out of.
  if (cueCtx && !cueCtx.thresholdCuePlaced
      && (catalogueRow?.category === 'threshold' || aerobicRepurposedAsQuality)
      && !isVo2max && !useGoalPace && !isDeload) {
    notes.push(CONTROLLED_THRESHOLD_CUE)
    cueCtx.thresholdCuePlaced = true
  }

  const coach_notes = notes.length === 0 ? undefined
    : notes.length === 1 ? [notes[0]] as [string]
    : notes.length === 2 ? [notes[0], notes[1]] as [string, string]
    : [notes[0], notes[1], notes[2]] as [string, string, string]


  // SC-08 vo2max, generalised 2026-09-03 — a scaled paced-rep session is
  // STRUCTURE-DRIVEN: its size is the rep structure's own length (work +
  // recovery), converted to distance via the WORK STEP'S OWN pace — NOT
  // always I-pace (that was the bug this generalisation fixes: a threshold
  // session's estimated distance was inflated by converting through VO2max
  // pace), and NOT weekly × 18%. The freed/added volume vs the sizing
  // estimate is reconciled by the § 4 easy re-derivation in
  // buildWeekSessions (which reads actual placed volume). This is what
  // decouples the dose from weekly volume at both ends; the legacy km-cap
  // becomes a harmless estimate bound.
  // progressive_tempo has no single work pace to size against (its three
  // steps span E → Z2-Z3 → T) — `minPerKm` above is already this session's
  // own headline prescription pace (quality pace, the same number paceTarget
  // shows), so reusing it here keeps the distance estimate honest against
  // what the runner is actually told to run.
  // §40b Amendment 2 deliberately does NOT touch an effort-governed session's
  // DISTANCE — it keeps the existing volume-share path below, and the ruling was
  // about duration only.
  //
  // The first cut did derive distance from the corrected duration (moving minutes ÷
  // easy pace) and that was scope creep with a real defect in it: a slow runner's
  // 45s-variant hill session came out at 4.5 km, under `MIN_SESSION_DISTANCE_KM.quality`
  // (5 km, §52b/INPUT-FLOOR-01) — caught by `easyRunFloorProtection.test.ts`, not by
  // reasoning. Unlike `pacedRepPlan`, this shape cannot grow its way out: the rep
  // count IS the variant (the stimulus identity), so there is no dial to turn.
  //
  // Leaving distance alone is also the more honest model. Duration and distance stop
  // implying one another here, and they should: a hill session covers less ground per
  // minute than easy running, and eight standing recoveries cover none at all. Nothing
  // surfaces a pace for this session (§40b), so no contradiction reaches the runner.
  // §8 Amendment (Coaching Board 2026-09-04) — SEGMENT-PRICED distance.
  //
  // These three branches used to divide the WHOLE session duration by the WORK
  // pace, so a 15-minute warm-up and a 4.5-minute cool-down were priced at
  // threshold or VO2max pace. Measured overstatement: 5K 25.7%, 10K 23.5%,
  // HM 11.4%, MAR 19.1%; worst single sessions "stated 10km vs ~6.9km" and
  // "stated 16.5km vs ~9.3km". A card read 10 km while its own displayed steps
  // summed to 8.4.
  //
  // Same reasoning as §40b Amendment 2 earlier the same day: a runner plans
  // against the number, and `weekly_km` sums these — so the inflation landed
  // specifically on the hard component, which is the one every ratio is
  // measured against (Willy). McMillan: "the plan said 45 km, they ran 38."
  //
  // The freed distance is NOT lost and is NOT returned to quality (board
  // amendment, unanimous across McMillan/Willy/Sims). It flows to easy runs via
  // the §9 re-derivation in `buildWeekSessions` — which sums the ACTUAL placed
  // distances, so a smaller quality session automatically enlarges the easy
  // ones. VOL-SHORTFALL-01 proved that path preserves total weekly volume.
  //
  // `durationForMainSet(mainMins) - mainMins` IS the warm-up plus cool-down —
  // taken by subtraction rather than re-splitting, so the two cannot round apart.
  // The main-set minutes of whichever structure-driven shape this session is —
  // null for a session with no resolved structure, which keeps the legacy
  // distance/pace derivation. Named once so the distance and the duration below
  // cannot disagree about which shape they are describing.
  const structuredMainMins: number | null =
    repPlan?.mainMins ?? progTempoPlan?.mainMins ?? contTempoPlan?.mainMins
    ?? fixedShape?.mainMins ?? effortPlan?.mainMins ?? null

  const segmentPricedKm = (mainMins: number, workPaceMinPerKm: number): number =>
    segmentPricedDistance(mainMins, workPaceMinPerKm, pace.minPerKmEasy)
  const effectiveDistKm = repPlan
    ? segmentPricedKm(repPlan.mainMins, repPlan.workPaceMinPerKm)
    : progTempoPlan
      ? segmentPricedKm(progTempoPlan.mainMins, minPerKm)
      : contTempoPlan
        // tempo_continuous is a single T-anchored pace throughout, and
        // `minPerKm` here is already T-pace (quality pace) in this branch —
        // exact, not an approximation like progTempoPlan's multi-pace case.
        ? segmentPricedKm(contTempoPlan.mainMins, minPerKm)
        : fixedShape
          // Every rung is T-anchored (pyramidPlan asserts it), so one work pace
          // prices the whole main set exactly, as tempo_continuous does.
          ? segmentPricedKm(fixedShape.mainMins, fixedShape.workPaceMinPerKm)
          : distKm
  const rounded = roundDistance(effectiveDistKm)

  // CLASSIFY-STIMULUS-01 — stamp the stimulus from the trusted generator label
  // now, while it is canonical, so the AI enricher rewriting the name later can
  // never reclassify this session. `label`/`zone` here already reflect every
  // prescription decision above (the §22 goal-pace rename → "…-pace …", the
  // effort-governed hill, the aerobic-repurposed threshold), so the label read is
  // correct at this instant — it is only UNtrustworthy post-enrich, which is
  // exactly what the stamp defends against. classifyStimulus with no stamp on the
  // input runs its label heuristic; we freeze that answer onto the session.
  const stimulus = classifyStimulus({ label, zone })
  return {
    id: `w${weekN}-${day}`,
    type: 'quality', label, detail: null,
    ...(stimulus ? { stimulus } : {}),
    ...(metric === 'distance' ? { distance_km: rounded } : {}),
    // §40b Amendment 2 — an effort-governed session's duration comes from its own
    // STRUCTURE, not from distance ÷ pace. The two disagree by construction here:
    // the standing recovery is real time that covers no distance, so a
    // distance-derived duration can never contain it. Every other branch keeps the
    // distance-derived value, where distance and duration are two views of one
    // number and `rounded` is the honest source.
    // §8 Amendment (2026-09-04) — a structured session's DURATION comes from its
    // own structure, never from distance / pace.
    //
    // Distance and duration used to be two views of one number: total duration
    // divided by work pace. That made them consistent and both wrong. Segment-
    // pricing the distance (above) then dragged the duration down with it — a
    // 4 x 5 min session reading 41 minutes instead of 46 — which is precisely the
    // defect §40b Amendment 2 fixed for effort-governed rows earlier the same day.
    //
    // The two are now derived independently and correctly: duration from the rep
    // structure, distance from each segment priced at the pace it is run.
    duration_mins: structuredMainMins != null
      ? Math.round(durationForMainSet(structuredMainMins))
      : dur(rounded, minPerKm),
    primary_metric: metric,
    zone, hr_target: hrTarget,
    // SC-09 — an effort-governed session carries NO pace target. The absence is
    // the prescription, not a missing value.
    ...(paceTarget ? { pace_target: paceTarget } : {}),
    rpe_target: effortRpe ?? (isDeload ? 6 : 7),
    ...(coach_notes ? { coach_notes } : {}),
    // SC-08a — stamp the row's identity. The schema now permits it, and the
    // "future" this comment waited for had a live cost: 31% of quality sessions
    // showed the runner no rep structure, because the display re-joined by
    // LABEL and §22 renames race-pace sessions.
    ...(catalogueRow ? { catalogue_id: catalogueRow.id } : {}),
    // SC-08b — for a v2 row, resolve the shape into THIS runner's concrete set.
    // v1 rows produce nothing here and keep v1 semantics forever (D-03), so
    // this is inert until a v2 row exists.
    ...(derivedSet ? { derived_set: derivedSet } : {}),
  }
}

// Race-specific long run (CoachingPrinciples §5, §25). Easy-first, then
// race-pace segment. Used for HM and marathon peak. Catalogue row carries
// label, voice, and segment ratios; goalPace is appended to the coach note.
function raceSpecificLongRunSession(
  weekN: number, day: Day, distKm: number,
  metric: 'distance' | 'duration',
  zones: ZoneTargets, pace: PaceGuide,
  catalogueRow: SessionCatalogueRow,
  goalPace: string,
): Session {
  const voice = catalogueRow.coach_voice_notes ?? 'Easy first. Hit goal pace on tired legs.'
  // §25 AMENDMENT 1 — the segment size comes from the ROW, not from a string
  // typed at the call site. It used to be a literal argument: 'Final 30–50% at
  // MP' for marathon and 'Final third at HM pace' for HM. Three consequences,
  // all measured 2026-09-14. (1) Marathon's "30–50%" BREACHED §25's ratified
  // 25–40% ceiling at its top end, and no check could see it because the number
  // lived inside prose. (2) The session card's structure block, which derives
  // its own percentage, said 20% on the same card — one segment, two answers.
  // (3) "Final third" is a THIRD spelling of a number the row already declares.
  const ms = catalogueRow.main_set_structure as { race_pace_pct?: number; race_pace_zone?: string } | null
  const segPct = ms?.race_pace_pct
  if (typeof segPct !== 'number' || segPct <= 0) {
    throw new Error(
      `§25 race-specific long run: catalogue row ${catalogueRow.id} declares no ` +
      'main_set_structure.race_pace_pct, so the segment size cannot be derived',
    )
  }
  const segZone = ms?.race_pace_zone ?? 'race'
  const coach_notes: [string, string?, string?] = [
    voice,
    // 'MP'/'HM' are the runner's own shorthand and already contain the word
    // pace, so it is not appended. The session label spells the distance out.
    `Final ${segPct}% at ${segZone}: ${goalPace}.`,
  ]
  const rounded = roundDistance(distKm)
  // §107 step 2 (LR-SEGMENT-RECORDED-§25) — the zone is DERIVED from what the
  // catalogue row declares, not authored beside it. `intensity_zones` existed on
  // every row and was read by nothing; the string was hand-written here, so one
  // coaching fact lived in two places that could silently disagree. Measured
  // before the change: 30/30 §25 sessions already agreed — deriving makes that a
  // guarantee rather than a coincidence. Throws rather than substituting a
  // default: a row that declares no zone is a catalogue defect, and §24b's
  // sibling producer sets the precedent that a missing prescription fails loudly
  // instead of shipping a plausible-looking placeholder to a runner.
  const zone = zoneStringFromZoneKeys(catalogueRow.intensity_zones)
  if (!zone) {
    throw new Error(
      `§25 race-specific long run: catalogue row ${catalogueRow.id} declares no ` +
      'intensity_zones, so session.zone cannot be derived (§107 step 2)',
    )
  }
  return {
    id: `w${weekN}-${day}`,
    type: 'easy',  // long run slot — display contract; SessionType drives card colour
    // SC-08a — stamped here too. This session keeps the row's own name today, so
    // the label join happens to work; stamping it anyway means the link does not
    // depend on that continuing to be true (the enricher may rewrite the label,
    // and §22 already renames its sibling sessions).
    catalogue_id: catalogueRow.id,
    label: catalogueRow.name,
    detail: null,
    ...(metric === 'distance' ? { distance_km: rounded } : {}),
    duration_mins: dur(rounded, pace.minPerKmEasy),
    primary_metric: metric,
    zone,
    hr_target: zones.easyHR,
    pace_target: pace.easyPaceStr,
    rpe_target: 6,
    coach_notes,
    // §107 step 1 for §25 — RECORD the segment this session prescribes. The
    // note already states it; nothing machine-readable held it, so no invariant
    // could check it and no surface could render it (288 of 396 such sessions
    // recorded nothing). Goal pace IS the segment pace here — the final portion
    // is run at MP (marathon) or HM pace (HM), which is what `goalPace` holds —
    // so no §24b HM ceiling applies and INV-PLAN-5K10K-LR-PACE-CAP stays
    // 5K/10K-only, exactly as the board scoped it.
    lr_segment_pace: goalPace,
  }
}

function strengthSession(weekN: number, day: Day): Session {
  return {
    id: `w${weekN}-${day}`,
    type: 'strength', label: 'Strength session', detail: null,
    duration_mins: 45, primary_metric: 'duration',
    coach_notes: ['Focus on single-leg stability and glute activation.'],
  }
}

function raceSession(
  weekN: number, day: Day, distKm: number, raceName: string | null,
  goal?: string | null, goalPace?: string | null,
): Session {
  // §80 Amendment 1 (Coaching Board 2026-09-14) — the opening instruction scales
  // with the race, and its effort follows the runner's GOAL.
  //
  // This note used to read "First 5 km at Zone 2." for EVERY distance. On a
  // marathon that is sensible. On a 10K it gives away half the race; on a 5K it
  // instructs the runner not to race their goal race at all. 5 km IS 11.85% of a
  // marathon — the constant was the marathon's opening fraction written out in
  // kilometres and then applied to distances it was never derived for.
  const openingKm = distKm * GENERATION_CONFIG.RACE_OPENING_FRACTION
  // One decimal under 10 km (0.6 km reads as a real instruction; "1 km" does
  // not), whole kilometres above — ADR-015's precision rule for a prescribed
  // distance a runner has to act on mid-race.
  const openingStr = openingKm < 10
    ? `${Math.round(openingKm * 10) / 10} km`
    : `${Math.round(openingKm)} km`
  // A time-targeted runner opens AT GOAL PACE — the pace the whole plan has
  // rehearsed. Opening a sub-50 10K in Zone 2 loses the race in the first
  // kilometre and it cannot be got back. A finish-goal runner opens in Zone 2,
  // because completing the distance is the goal.
  const opening = goal === 'time_target' && goalPace
    ? `Start slower than feels right. First ${openingStr} at goal pace: ${goalPace}.`
    : `Start slower than feels right. First ${openingStr} at Zone 2.`
  return {
    id: `w${weekN}-${day}`,
    // F6 — "Race — Target Race" is a placeholder leaking into the plan. When no
    // name was given, say the true thing instead of inventing one.
    type: 'race', label: raceName ? `Race — ${raceName}` : `Race day — ${distKm} km`, detail: null,
    distance_km: distKm, primary_metric: 'distance',
    coach_notes: [opening, 'No new shoes, no new food.'],
  }
}

/**
 * §30 (amended, F14) — the two race-week shakeouts are not the same session.
 * They were emitted identically (4 km, same label, differing only by a stride
 * note), which reads as a copy-paste rather than a plan.
 *
 * `slot` 0 is the earlier one: longer, carries the strides. `slot` 1 is the
 * final run before the race: minimal, and meant to leave the runner wondering
 * whether it was enough.
 */
function shakeoutSession(
  weekN: number, day: Day, zones: ZoneTargets, pace: PaceGuide, slot: 0 | 1 = 0,
): Session {
  const km = GENERATION_CONFIG.RACE_WEEK_SHAKEOUT_KM[slot]
    ?? GENERATION_CONFIG.RACE_WEEK_SHAKEOUT_KM[0]
  const label = slot === 0 ? 'Easy shakeout' : 'Pre-race shakeout'
  const note = slot === 0
    ? 'Short and relaxed. Wake the legs, nothing more.'
    : 'The last one before race day. Short on purpose — if it feels too easy, that is the point.'
  const session = easySession(weekN, day, km, 'distance', zones, pace, label, 2, [note])
  session.zone = 'Zone 1'
  session.hr_target = zones.shakeoutHR
  session.role = 'shakeout'   // structural, label-independent (see sessionRole.ts)
  return session
}

/**
 * CoachingPrinciples §78 — convert a deload week's midweek easy run into a 5K
 * time trial. Converts rather than adds: distance and duration are preserved, so
 * weekly volume is untouched and the session reads as what a time trial actually
 * is — warm up, run 5K hard, cool down.
 *
 * Typed `hard`, not `quality`, deliberately. `hard` already maps to Z4-5 in
 * zoneRules (the correct band for a maximal effort, so the coaching pipeline
 * doesn't flag the runner for exceeding a Z3 ceiling they were never given), and
 * INV-PLAN-QUALITY-PER-WEEK counts only `quality` — so a beginner on a
 * zero-quality plan still gets this. A benchmark is a measurement, not a
 * training stimulus.
 *
 * Returns the day converted, or null when no slot is long enough to hold a real
 * 5K plus warm-up and cool-down. The caller must then NOT list the week as a
 * recalibration week — metadata follows the plan, never the intent.
 */
function applyRecalibrationTimeTrial(
  sessions: Partial<Record<Day, Session>>,
  longDay: Day,
  zones: ZoneTargets,
  pace: PaceGuide,
): Day | null {
  const cfg = GENERATION_CONFIG.RECALIBRATION_TIME_TRIAL
  const candidates = (Object.keys(sessions) as Day[])
    .filter(d => d !== longDay)
    .filter(d => {
      const s = sessions[d]
      if (!s || s.type !== 'easy') return false
      const km = sessionKmOrZero(s, pace.minPerKmEasy)
      return km >= cfg.min_slot_km
    })
    // Furthest from the long run — freshest legs, and it keeps the hard effort
    // and the week's longest run apart (§7 spacing intent).
    .sort((a, b) => dayGap(b, longDay) - dayGap(a, longDay))

  const day = candidates[0]
  if (!day) return null

  const s = sessions[day]!
  s.type = 'hard'
  s.label = `${cfg.distance_km}K time trial`
  s.zone = 'Zone 4–5'
  s.rpe_target = 9
  // CD-8 / §78 — a 5K time trial is a DISTANCE-fixed measurement: you cover the
  // 5 km and the time is the result. It was inheriting the easy slot's shape
  // (duration-primary, ~63 min, no distance), which is incoherent — the app had
  // no distance to measure the effort against. Fix the distance; the duration is
  // a rough estimate of the effort itself (warm-up/cool-down live in the note).
  s.distance_km = cfg.distance_km
  s.primary_metric = 'distance'
  s.duration_mins = dur(cfg.distance_km, pace.minPerKmQuality)
  // A time trial has NO pace target — prescribing one would defeat the point.
  // The session exists to discover the runner's current pace, not to rehearse
  // the stale one.
  delete s.pace_target
  // CD-8 — HR is RECORDED, not targeted. You don't cap heart rate on a maximal
  // effort, and the old ceiling (zones.intervalsHR) topped at an estimated max
  // the runner has never observed. Effort is led by RPE; HR is an output.
  delete s.hr_target
  s.coach_notes = [
    `Warm up easy for 10 minutes, then ${cfg.distance_km} km as hard as you can hold. Cool down easy.`,
    // TIER-HONEST, and it names no screen (TT-NOTE-HONESTY-01, 2026-09-17).
    // It used to promise "Log the result in your profile and your paces update
    // for the next block" to EVERY runner. Two things were wrong with that.
    // (1) Recalibration is PAID (`dynamic_reshape_r20`, ADR-014) and free plans
    // carry the trial too — measured, both tiers get `recalibration_weeks: [8]`
    // — so the free runner was promised an outcome the tier cannot deliver,
    // while `RecalibrationTile` sitting one surface away already told them the
    // truth. (2) "In your profile" is the wrong place: the entry point is a
    // tile on Today, and Me's route is labelled "Race benchmark".
    // "You'll get the option" is what actually happens at BOTH tiers, and it
    // keeps ADR-014's prompted-and-confirmed model honest: the rewrite is never
    // silent. The tile stays the single owner of what the option costs.
    "This is a measurement, not a session. Log the time when you're done and you'll get the option to rebuild your paces around it.",
    'A parkrun counts. So does a solo effort — just make it honest.',
  ]
  return day
}

// ─── Injury adjustments ───────────────────────────────────────────────────────

/**
 * Does §2/§12's injury VOLUME cap govern this runner?
 *
 * SINGLE OWNER (D-08). `hasInjury(input, 'knee') || hasInjury(input, 'shin_splints')`
 * was written out FOUR times in this file — the volume curve's cap argument, the
 * §90 delivered levers, the long-run trim and the note. Four writers of one fact,
 * agreeing only by copy-paste, which is the DELOAD-OWNER-01 fault exactly.
 *
 * §12 names knee and shin-splint histories specifically: those are the tissues
 * whose binding constraint is ACUTE weekly load. Other histories (achilles, hip
 * flexor, back) are real but are not governed by this cap, and conflating them
 * would silently widen the cap's population.
 */
function hasVolumeCappedInjury(input: GeneratorInput): boolean {
  return hasInjury(input, 'knee') || hasInjury(input, 'shin_splints')
}

/**
 * Does the runner's injury history include `keyword`?
 *
 * ⚠️ FIXED 2026-09-16 — THREE OF THE SIX WIZARD VALUES NEVER MATCHED, and the
 * coaching rules behind them had therefore never fired for a real runner.
 *
 * `GeneratePlanScreen` offers: Achilles · Knee · Back · Hip · Shin splints ·
 * Plantar fasciitis. The keywords here are snake_case. The old body was a raw
 * `i.toLowerCase().includes(keyword)`, so:
 *
 *   wizard value         keyword               matched?
 *   'Knee' / 'Achilles' / 'Back'               yes
 *   'Shin splints'       'shin_splints'        NO  — space vs underscore
 *   'Plantar fasciitis'  'plantar_fasciitis'   NO  — space vs underscore
 *   'Hip'                'hip_flexor'          NO  — different word
 *
 * What silently did not apply: §12's INJURY VOLUME CAP for shin splints (and
 * with it §90's delivered levers and the §2 bounceback bounding), the
 * no-quality-in-base rule for hip, and the 120-minute long-run cap for plantar
 * fasciitis. Verified against the live engine: a plan for ['Shin splints'] was
 * byte-identical to a plan for [] and differed from ['shin_splints'].
 *
 * WHY NO TEST CAUGHT IT: every fixture used the CODE's spelling. The sweep sets
 * `['shin_splints']`, the parity grid `['shin']` — values the product cannot
 * produce. A green run is only ever safety for the inputs actually swept.
 *
 * Separator-insensitive, and bidirectional so the wizard's shorter label matches
 * the more specific keyword ('Hip' -> 'hip_flexor'). The reverse direction needs
 * >= 3 characters so a stray short value cannot match everything.
 */
function hasInjury(input: GeneratorInput, keyword: string): boolean {
  const norm = (t: string) => t.toLowerCase().replace(/[_\s]+/g, ' ').trim()
  const k = norm(keyword)
  return (input.injury_history ?? []).some(raw => {
    const v = norm(raw)
    return v.includes(k) || (v.length >= 3 && k.includes(v))
  })
}

function applyInjuryAdjustments(
  weeklyKm: number,
  input: GeneratorInput,
): { adjustedKm: number } {
  let km = weeklyKm

  // §12's weekly volume cap MOVED INTO buildVolumeSequence (2026-08-20).
  //
  // It used to be applied here, per week, against `volumes[i - 1]` — the raw
  // curve rather than the previous week's adjusted result. Two defects: the cap
  // never compounded (a capped week was followed by one measured against the
  // higher curve value, producing a 35% sawtooth that tripped §45), and
  // everything anchored on the curve — taper depth, deload step-down, long-run
  // share — worked from volumes the runner never saw.
  //
  // Applying it in the curve makes that one source of truth. It must NOT also
  // be applied here: doing both double-caps, and the second pass measures
  // against an already-capped previous week. That drove delivered volume ~20%
  // below the curve on the very weeks the first fix was meant to smooth.
  //
  // `prevWeeklyKm` WAS retained in the signature "for the non-volume rules
  // below"; those rules were dead and are now deleted, so the parameter went
  // with them rather than staying as an unused argument the next reader has to
  // account for.
  // ⚠️ THE QUALITY LOGIC THAT USED TO LIVE HERE WAS DEAD, AND IS DELETED
  // (§110 / §21, 2026-09-16). It computed an `allowQuality` that said:
  //   · Achilles  -> no quality work, any phase
  //   · Hip flexor -> no quality in base phase
  // and returned it alongside `adjustedKm`. **The single call site destructures
  // `{ adjustedKm }` only**, so neither rule has ever fired. (`maintenance.ts`
  // has its own `allowQuality`, computed locally from `injured` — unrelated.)
  //
  // Deleted rather than wired up, on both counts:
  //   · The Achilles rule is the one §110 just removed from `suppressQuality`
  //     as a defect against §21, which prescribes SUBSTITUTION ("progression
  //     runs or flat tempo at equivalent intensity"), not removal. Wiring it
  //     would silently re-impose the thing the board just struck down.
  //   · The hip-flexor rule is unreachable BY DESIGN: base phase carries no
  //     quality for anyone (§4/§5, `plannedQuality` starts at 0 and only build
  //     and peak raise it), so "no quality in base" can never subtract anything.
  //
  // Left in place it is a trap: it reads like a live safety rule, and the
  // obvious "fix" (destructure the second field) would re-break §21.
  return { adjustedKm: km }
}

function applyLongRunCap(distKm: number, paceMinPerKm: number, input: GeneratorInput): number {
  let result = distKm
  // Absolute cap per race distance (CoachingPrinciples §9 — protects against
  // unrealistic time-on-feet for the race).
  const distKey = raceDistanceKey(input.race_distance_km)
  let absCapMins: number = GENERATION_CONFIG.LONG_RUN_CAP_MINUTES[distKey]
  // CoachingPrinciples §40 — finish-goal 5K plans get a tighter cap.
  if (distKey === '5K' && input.goal === 'finish') {
    absCapMins = Math.min(absCapMins, GENERATION_CONFIG.LONG_RUN_CAP_MINUTES_5K_FINISH)
  }
  if (paceMinPerKm > 0 && result * paceMinPerKm > absCapMins) {
    result = absCapMins / paceMinPerKm
  }
  // Injury-specific tighter cap: back + plantar fasciitis cap long run at 120 min.
  if ((hasInjury(input, 'back') || hasInjury(input, 'plantar_fasciitis'))
      && paceMinPerKm > 0 && result * paceMinPerKm > 120) {
    result = 120 / paceMinPerKm
  }
  return result
}

// ─── Week session layout ──────────────────────────────────────────────────────

// §24b — 5K/10K time-targeted, final two peak weeks: long run with two pace
// segments (middle 20% at marathon pace, final 30% at HM pace).
// (CoachingPrinciples §24b)
function fiveKTenKPeakLongRunSession(
  weekN: number, day: Day, distKm: number,
  metric: 'distance' | 'duration',
  zones: ZoneTargets, pace: PaceGuide,
): Session {
  const midPct   = GENERATION_CONFIG.LR_5K10K_PEAK_MID_SEGMENT_PCT    // 0.20
  const finalPct = GENERATION_CONFIG.LR_5K10K_PEAK_FINAL_SEGMENT_PCT   // 0.30
  const midKm    = Math.round(distKm * midPct * 10) / 10
  const finalKm  = Math.round(distKm * finalPct * 10) / 10
  // §24b names WHICH pace each segment runs at, and those choices are coaching
  // decisions (79% / 84% VDOT), so they are read from config rather than fixed
  // here. They were declared and hardcoded at the same time — the config keys
  // existed and this line ignored them, which is how a coaching choice ends up
  // living in two places that can disagree.
  // No `?? 'marathon pace'` fallback. It read as a pace in the note it was
  // interpolated into ("at marathon pace: marathon pace") and hid a missing
  // prescription behind a sentence that looked complete. The caller gates on
  // both strings existing; if that gate is ever removed this throws instead of
  // shipping placeholder text to a runner.
  const mpStr    = pace[GENERATION_CONFIG.LR_5K10K_PEAK_MID_PACE]
  const hmStr    = pace[GENERATION_CONFIG.LR_5K10K_PEAK_FINAL_PACE]
  if (!mpStr || !hmStr) {
    throw new Error(
      '§24b segmented long run requires derivable marathon AND HM paces — ' +
      'caller must gate on pace.marathonPaceStr && pace.hmPaceStr (beginners have neither)',
    )
  }
  const easyPct  = Math.round((1 - midPct - finalPct) * 100)
  const coach_notes: [string, string?, string?] = [
    `Easy for the first ${easyPct}%. Let the aerobic base work.`,
    `Middle ${Math.round(midPct * 100)}% (≈${midKm} km) at marathon pace: ${mpStr}. Controlled — not a tempo session.`,
    `Final ${Math.round(finalPct * 100)}% (≈${finalKm} km) at HM pace: ${hmStr}. This is the work. Exit feeling like you had more.`,
  ]
  const rounded = roundDistance(distKm)
  return {
    id: `w${weekN}-${day}`,
    type: 'easy',
    label: 'Long run — marathon pace + HM-pace finish',
    detail: null,
    ...(metric === 'distance' ? { distance_km: rounded } : {}),
    duration_mins: dur(rounded, pace.minPerKmEasy),
    primary_metric: metric,
    zone: 'Zone 2–3',
    hr_target: zones.easyHR,
    pace_target: pace.easyPaceStr,
    rpe_target: 6,
    coach_notes,
    ...(pace.hmPaceStr ? { lr_segment_pace: pace.hmPaceStr } : {}),
  }
}

// §24d — 5K/10K finish-goal, final two peak weeks: long run with a 10%
// negative-split finish (no pace target — proprioception drill).
// (CoachingPrinciples §24d)
function finishGoalPeakLongRunSession(
  weekN: number, day: Day, distKm: number,
  metric: 'distance' | 'duration',
  zones: ZoneTargets, pace: PaceGuide,
): Session {
  const finalPct  = GENERATION_CONFIG.LR_FINISH_GOAL_LATE_PEAK_SEGMENT_PCT  // 0.10
  const finalKm   = Math.round(distKm * finalPct * 10) / 10
  const easyPct   = Math.round((1 - finalPct) * 100)
  const coach_notes: [string, string?, string?] = [
    `Zone 2 throughout. Conversational for the first ${easyPct}%.`,
    `Negative-split finish — last ${Math.round(finalPct * 100)}% (≈${finalKm} km): go by feel, slightly faster than your easy pace. No pace target — proprioception, not pace.`,
  ]
  const rounded = roundDistance(distKm)
  return {
    id: `w${weekN}-${day}`,
    type: 'easy',
    label: 'Long run — negative-split finish',
    detail: null,
    ...(metric === 'distance' ? { distance_km: rounded } : {}),
    duration_mins: dur(rounded, pace.minPerKmEasy),
    primary_metric: metric,
    zone: 'Zone 2',
    hr_target: zones.easyHR,
    pace_target: pace.easyPaceStr,
    rpe_target: 5,
    coach_notes,
  }
}

// Maps phase → preferred catalogue category for the *quality* session slot.
// CoachingPrinciples §5 — specificity rises as race approaches.
//
// Note: for Marathon peak, race_specific (mp_long_run) is used in the LONG-RUN
// slot — so quality stays threshold. For 50K/100K, ultra_specific sessions
// (back_to_back_long, ultra_race_sim) are awkward as midweek single-day quality
// — quality stays threshold; ultra-specific work belongs in the long-run slot
// when the catalogue is widened to support it.
// Categories that can sit in the MIDWEEK QUALITY SLOT, ordered by intensity.
// `race_specific` and `ultra_specific` are deliberately absent: they are
// long-run-slot work (see the note above), not a midweek single-day session.
const MIDWEEK_QUALITY_LADDER: CatalogueCategory[] = ['aerobic', 'threshold', 'vo2max']

// The build phase's rotation for a distance, taken from its SIGNATURE.
//
// SC-07 / CD-16 (2026-08-20). `quality_categories_focus` was decorative in
// build: the 10K signature has declared `['vo2max', 'threshold']` since R23
// while this function returned a hardcoded 'threshold' for every distance, so
// half of every 10K build phase's declared focus was unreachable. Granting the
// vo2max catalogue rows build eligibility changes NOTHING on its own — verified
// experimentally before the board ruled. This is the lock that mattered.
//
// Sorted ASCENDING by intensity so the build phase OPENS on its least intense
// category. The first quality session of a plan should not be its hardest kind
// (§2 — and the reason applyVolumeStimulusSplit exists at all). For a 10K that
// means threshold → vo2max → threshold across build, which is also McMillan's
// "alternate, don't front-load" amendment.
//
// Every non-short distance is UNCHANGED by construction: HM/MARATHON focus on
// ['threshold', 'race_specific'] and 50K on ['threshold', 'ultra_specific'],
// whose second entry is filtered out as long-run-slot work, leaving threshold
// alone; 100K's ['ultra_specific'] filters to empty and falls back to threshold.
// Only 5K and 10K — the two distances CD-16 is about — see any change.
function buildRotationCategories(distKey: RaceDistanceKey): CatalogueCategory[] {
  const focus = PLAN_SIGNATURES[distKey].quality_categories_focus as readonly CatalogueCategory[]
  const midweek = focus.filter(c => MIDWEEK_QUALITY_LADDER.includes(c))
  if (midweek.length === 0) return ['threshold']
  return [...midweek].sort(
    (a, b) => MIDWEEK_QUALITY_LADDER.indexOf(a) - MIDWEEK_QUALITY_LADDER.indexOf(b))
}

function preferredQualityCategory(
  phase: PhaseType,
  distKey: RaceDistanceKey,
  isTimeTarget: boolean,
  // Index of this week within the build phase's NON-DELOAD weeks. Deload weeks
  // carry no quality, so counting them would let the rotation skip a beat and
  // drop vo2max out of a build phase entirely.
  buildRotationIndex = 0,
  // True when the VO2max adaptation deadline lands on the FIRST build quality
  // week, so the rotation must open on vo2max rather than on the gentlest
  // category. See the note below — this is why the rotation is deadline-aware
  // rather than letting V2 swap afterwards.
  vo2MustOpenBuild = false,
  // §93 — index of this week within the peak phase's NON-DELOAD weeks, the peak
  // twin of `buildRotationIndex`. Peak had no rotation at all: its category was
  // a constant per distance, so the phase could not vary however long it grew.
  peakRotationIndex = 0,
  // §93 — how many non-deload weeks the peak phase actually has. The VO2max
  // allowance is the LESSER of PEAK_MAX_VO2MAX_SESSIONS and half the phase, so
  // peak is never majority-general however short it is. Without the second
  // term a two-week peak spends both slots on VO2max and delivers 0% specific
  // against §5's declared 60% — which is the pre-existing shape measured on the
  // non-gated control.
  peakWeeksTotal = 0,
  // §97 — the build-rotation index at which VO2max becomes ELIGIBLE, i.e. the
  // first rotating build week not inside an intensity re-entry window. Computed
  // by the caller, which owns both the deload cadence and the re-entry window;
  // deriving it here would duplicate two rules that already have owners.
  vo2BuildSlotIndex?: number,
  // §79 vs §5 PRECEDENCE (Coaching Board, ruled before 2026-09-14: "§79 wins
  // that conflict"). True when an intensity re-entry window is OPEN on this
  // plan. Only then does the window outrank §5's adaptation deadline — with no
  // window there is no conflict, and §5 behaves exactly as it always has.
  reentryActive = false,
): CatalogueCategory {
  if (phase === 'base')  return 'aerobic'
  if (phase === 'build') {
    const cats = buildRotationCategories(distKey)
    // DEADLINE-AWARE ORDERING, and the reason is a defect, not neatness.
    //
    // Left to the plain ascending rotation, a 12-week 10K opens build on
    // threshold (W5) and reaches vo2max at W6 — one week past the adaptation
    // deadline. V2 then SWAPS the two sessions to fix the timing, and that swap
    // is where it goes wrong: `goalPaceWeek` (§22 — second-half build quality
    // must be goal-pace work for a time target) is applied when the session is
    // CONSTRUCTED, so the displaced threshold session arrives in W6 still
    // wearing W5's treatment and immediately breaks INV-PLAN-RACE-SPECIFIC-
    // EXPOSURE. Caught by the archetype matrix on 02-10k-intermediate.
    //
    // Patching the session after the swap would mean re-deriving naming, pace
    // and notes outside the one place that owns them. Building the plan
    // correctly the first time is the smaller and more honest change: when the
    // deadline binds, the rotation simply opens on vo2max and no swap happens.
    // V2 stays as the safety net for shapes this does not cover.
    const ordered = vo2MustOpenBuild && cats.includes('vo2max')
      ? ['vo2max', ...cats.filter(c => c !== 'vo2max')] as CatalogueCategory[]
      : cats

    // §97 — THE SINGLE BUILD VO2MAX SLOT IS PLACED, NOT DISCOVERED.
    //
    // This used to read the slot off the rotation's own modulo and then veto
    // any OTHER index that happened to land on vo2max. That works while the
    // slot's week is always available — and breaks silently when it is not.
    // With §79/§97's intensity re-entry withholding VO2max over the opening
    // weeks, the slot's week could be inside the window: the week returned
    // threshold, the slot was spent, and build ended with ZERO VO2max. The
    // first exposure then landed in peak, past the §5 adaptation deadline,
    // firing V2's swap safety net — which carries its own documented defect
    // (a session built for an early week arrives in a second-half week still
    // wearing the early week's goal-pace treatment). One dropped slot, four
    // steps downstream, and every step looked locally correct.
    //
    // Stating the slot positively fixes it: build carries exactly one VO2max
    // exposure, at the first eligible rotation index, and every other index
    // rotates through the non-VO2max categories. `vo2BuildSlotIndex` is
    // undefined for runners with no re-entry window, so their slot stays at the
    // rotation's own index and nothing moves.
    //
    // §79 vs §5 — WHICH ONE DECIDES. `vo2MustOpenBuild` used to win
    // unconditionally, so §5's deadline overrode §79's withhold on every plan
    // where both applied and the re-entry window was silently ignored for the
    // exact runner it protects. The board ruled §79 wins THAT CONFLICT.
    //
    // The conflict only exists when a window is open, and the scoping is the
    // whole fix: a previous attempt made `vo2BuildSlotIndex` win outright and
    // broke 29 tests including `cohortShape`, because with no window the slot
    // index IS the rotation's natural index and overriding §5 there changes
    // plans that had no §79 claim on them at all.
    //
    // `undefined` under an OPEN window means the walk found no eligible week —
    // the window withheld VO2max for the whole build. -1 matches no rotation
    // index, so build carries none, and §79 Amendment 2's omission note then
    // declares it to the runner rather than dropping it silently.
    const vo2Slot = reentryActive
      ? (vo2BuildSlotIndex ?? -1)
      : (vo2MustOpenBuild ? 0 : vo2BuildSlotIndex ?? ordered.indexOf('vo2max'))
    if (ordered.includes('vo2max') && buildRotationIndex === vo2Slot) return 'vo2max'
    const nonVo2 = ordered.filter(c => c !== 'vo2max')
    if (nonVo2.length > 0) return nonVo2[buildRotationIndex % nonVo2.length]
    const picked = ordered[buildRotationIndex % ordered.length]

    // ONE VO2MAX EXPOSURE IN BUILD, AND NO MORE — Seiler's binding constraint
    // on CD-16: "moving VO2max earlier must not become MORE VO2max. The value
    // is in the exposures landing early enough to adapt to, not in adding a
    // third hard session to a four-hour-a-week runner's week."
    //
    // Without this cap the modulo rotation cycles back: a three-week build runs
    // vo2max / threshold / vo2max, which with peak's two gives FOUR VO2max
    // sessions where the plan previously had two. That is the over-correction
    // Seiler named, arriving through the front door with a physiological
    // justification. The intended shape is one build exposure — early enough to
    // open the adaptation window — plus peak's two: three spread exposures,
    // replacing two crammed before the taper.
    //
    // Everything after that exposure falls back to the next category in the
    // rotation, which is threshold for both 5K and 10K.
    return picked
  }
  if (phase === 'taper') return 'threshold'

  // ── peak ──────────────────────────────────────────────────────────────────
  //
  // §93 (CB-SPEC-01). This branch used to read
  // `if (distKey === '5K' || distKey === '10K') return 'vo2max'` — unconditional,
  // every peak week, both goals. It is the leftover CD-16 identified and did not
  // remove: *"peak-only was a leftover from the superseded assumption that VO2max
  // was the specific work for a 10K."* SC-05 reclassified 10K race pace as the
  // specific work and VO2max as GENERAL; §5's ladder then asks peak for 60%
  // SPECIFIC. Measured, 10K peak delivered 0% — the exact inverse — while HM,
  // whose signature carries `race_specific`, delivered 5/5.
  //
  // 5K is deliberately untouched: §22/SC-05 (board-ratified 2026-09-03) excludes
  // it because race pace ~ I-pace there, so the VO2max rows ARE the specific work.
  // Requiring a separate race-pace row at 5K demands a distinction the physiology
  // does not make (Seiler).
  if (distKey === '5K') return 'vo2max'
  if (distKey === '10K') {
    // CD-16's own arithmetic, now enforced instead of assumed: "one build
    // exposure ... plus peak's two". Beyond that the peak turns to race-specific
    // work for a time goal — which is what §5 asked for all along — or to
    // threshold for a finish goal, which has no goal pace to run (CD-2/§80).
    const vo2Allowance = peakWeeksTotal > 0
      ? Math.min(GENERATION_CONFIG.PEAK_MAX_VO2MAX_SESSIONS, Math.ceil(peakWeeksTotal / 2))
      : GENERATION_CONFIG.PEAK_MAX_VO2MAX_SESSIONS
    if (peakRotationIndex < vo2Allowance) return 'vo2max'
    return isTimeTarget ? 'race_specific' : 'threshold'
  }
  // CD-2 / §22 / §80 — race-pace ("race_specific") work is a TIME-TARGET tool.
  // A finish-goal runner has no goal pace to run it at, so selecting it here left
  // the engine naming a session "HM-pace intervals" and then prescribing generic
  // threshold pace (a §19 label-integrity violation). Finish goals train the peak
  // on threshold + the long run (§80, time on feet).
  if (distKey === 'HM' && isTimeTarget)      return 'race_specific'  // hm_pace_intervals
  // MARATHON, 50K, 100K peak quality stays threshold; race-specific work goes in long-run slot.
  return 'threshold'
}

function buildWeekSessions(
  weekN: number,
  phase: PhaseType,
  isDeload: boolean,
  isRaceWeek: boolean,
  weeklyKm: number,
  input: GeneratorInput,
  zones: ZoneTargets,
  pace: PaceGuide,
  metric: 'distance' | 'duration',
  phases: Phase[],
  tier: Tier,
  catalogue: SessionCatalogueRow[],
  fitness: FitnessLevel,
  goalPace: string | null | undefined,
  totalWeeks: number,
  // SC-07 / CD-16 — index of this week among the build phase's NON-DELOAD
  // weeks, used to rotate the build quality category. Computed by the caller,
  // which owns the deload cadence; deriving it here would duplicate that rule
  // and let the two drift. Deload weeks carry no quality, so counting them
  // would let the rotation skip a beat and drop vo2max out of a build phase.
  buildRotationIndex: number,
  // §93 (CB-SPEC-01) — the peak twin of the above, counted over the peak
  // phase's NON-DELOAD weeks. Same reasoning: the caller owns the deload
  // cadence, so deriving it here would duplicate that rule and let the two
  // drift (DELOAD-OWNER-01).
  peakRotationIndex: number,
  // §97 — see preferredQualityCategory. The rotation index at which VO2max
  // first becomes eligible, given the intensity re-entry window.
  vo2BuildSlotIndex: number | undefined,
  // SC-07 / CD-16 — the adaptation deadline lands on the first build quality
  // week, so the rotation must open on vo2max. Computed once by the caller.
  vo2MustOpenBuild: boolean,
  // §79 vs §5 precedence — is an intensity re-entry window OPEN on this plan?
  // Plan-level, not per-week: `excludeHighTissueStress` says "this week is
  // inside the window", which is false on most weeks of a plan that HAS one.
  intensityReentryActive: boolean,
  // D2 — the level that governs INTENSITY. Equals `fitness` unless the VDOT and
  // volume signals disagreed, in which case `fitness` is the lower (structure:
  // volume, caps) and this is the higher (intensity allowance). See
  // assessFitness().
  intensityFitness: FitnessLevel = fitness,
  // Plan-level flag for the first-threshold cue (§1/Q2). Threaded from
  // generateRulePlan so "first in the plan" persists across weeks. Optional so
  // legacy/test callers keep working (cue simply never places).
  cueCtx?: { thresholdCuePlaced: boolean },
  // §53 (CAT-ULTRA-THIN-01) — plan-level per-row selection tally for least-used
  // rotation. Threaded from generateRulePlan so pool exhaustion persists across
  // weeks; optional so legacy/test callers keep the stateless index.
  rowUsage?: Map<string, number>,
  // §36/§53 anti-repeat tie-break state, threaded with rowUsage.
  rowLast?: Map<string, string>,
  // §79 (2026-08-31) — returning-runner intensity re-entry. When true, the highest
  // tissue-stress quality (VO2max intervals + hill reps, both category 'vo2max')
  // is withheld this week; tempo/threshold carry the load. Set by the caller for a
  // returning/elevated runner's opening weeks. Default false = no restriction.
  excludeHighTissueStress = false,
  // CoachingPrinciples §53 (2026-09-02) — one entry per quality pick: how many
  // rows were eligible for it. `INV-PLAN-QUALITY-VARIETY-FULL-PLAN` needs it to
  // know whether its cap is satisfiable at all (D-21). Per-pick because the pool
  // varies by phase and a plan-level union hides the binding constraint.
  poolSink?: number[],
  // §53 (Coaching Board 2026-09-03) — second eligibility path for
  // min_weekly_km-gated rows. Computed by the caller from ALREADY-BUILT
  // prior weeks (never same-week circular) — see generateRulePlan's main
  // loop. Default false so legacy/test callers keep the flat-floor-only
  // behaviour.
  recentThresholdEligible = false,
): Partial<Record<Day, Session>> {
  const blocked = blockedDays(input)
  const distKey = raceDistanceKey(input.race_distance_km)
  // DELOAD-INVERSION-01 (§2 injury cap, Coaching Board 2026-09-06) — the same knee/shin
  // predicate that sets the injury VOLUME cap in buildVolumeSequence. When set,
  // the injury cap is a DELIVERED ceiling, not just a curve one: the peak quality
  // count drops to one (part 2a) and the easy-run COUNT is trimmed to fit the
  // ceiling (part 2b), never the race-anchored long run (§52).
  const injuryVolumeCapped = hasVolumeCappedInjury(input)

  if (isRaceWeek) {
    const sessions: Partial<Record<Day, Session>> = {}
    const raceName = input.race_name ?? null
    // CoachingPrinciples §77 — the race sits on the ACTUAL weekday of race_date.
    // It deliberately ignores `days_cannot_train`: the race is an external fixed
    // event, not a training session, and a runner who cannot train on Wednesdays
    // can still race on one. Every other session in this block does respect it.
    const raceDay = DAY_ORDER[(parseDateLocal(input.race_date).getDay() + 6) % 7]
    const raceDayIdx = DAY_INDEX[raceDay]
    // §77 — nothing in race week may fall after the race.
    const beforeRace = (d: Day): boolean => DAY_INDEX[d] < raceDayIdx
    // §39 Amendment 1 — how many days before the race does this day sit?
    // Same vocabulary §77 uses for shakeout spacing, so the protected window
    // generalises to any race weekday rather than naming Saturday.
    const daysBeforeRace = (d: Day): number => raceDayIdx - DAY_INDEX[d]
    sessions[raceDay] = raceSession(weekN, raceDay, input.race_distance_km, raceName, input.goal, goalPace)

    // CoachingPrinciples §30 — race-week shakeouts capped at
    // RACE_WEEK_SHAKEOUT_MAX_MINS. The first shakeout carries a stride note
    // to preserve neuromuscular sharpness with no fatigue cost.
    const capMins = GENERATION_CONFIG.RACE_WEEK_SHAKEOUT_MAX_MINS
    const enforceCap = (s: Session): Session => {
      if (s.duration_mins != null && s.duration_mins > capMins) {
        const ratio = capMins / s.duration_mins
        s.duration_mins = capMins
        if (s.distance_km != null) s.distance_km = roundDistance(s.distance_km * ratio)
      }
      return s
    }

    // §77 — shakeouts are spaced in days BEFORE the race, so the placement
    // generalises to any race weekday. Offsets landing outside race week (a race
    // early in the week) or on a blocked day are skipped, never relocated to
    // after the race — the preceding taper week carries that load instead.
    const shakeoutDays: Day[] = []
    for (const daysBefore of GENERATION_CONFIG.RACE_WEEK_SHAKEOUT_DAYS_BEFORE_RACE) {
      const idx = raceDayIdx - daysBefore
      if (idx < 0) continue                    // before race week began
      const d = DAY_ORDER[idx]
      if (blocked.has(d) || shakeoutDays.includes(d)) continue
      shakeoutDays.push(d)
    }

    // §77 / §30 (CD-7) — an early-week race (Tue/Wed) leaves no room for the
    // [5,3]-days-before shakeouts inside race week, so the loop above places
    // none and the runner gets days of complete rest with no neuromuscular
    // priming — exactly what §30 warns against. Fallback: place ONE short
    // pre-race shakeout with strides on the nearest AVAILABLE day before the
    // race that still sits in race week (respects blocked days). A Monday race
    // genuinely has no earlier in-week day, so this correctly does nothing there
    // (the preceding week would carry it — a separate cross-week change).
    if (shakeoutDays.length === 0) {
      for (let idx = raceDayIdx - 1; idx >= 0; idx--) {
        const d = DAY_ORDER[idx]
        if (blocked.has(d)) continue
        shakeoutDays.push(d)
        break
      }
    }

    const [shakeout1, shakeout2] = shakeoutDays

    if (shakeout1) {
      const s = enforceCap(shakeoutSession(weekN, shakeout1, zones, pace, 0))
      const e0 = s.coach_notes?.[0]
      const strideNote = '4×100m strides at 5K effort, full recovery between.'
      s.coach_notes = e0 ? [e0, strideNote] : [strideNote]
      sessions[shakeout1] = s
    }

    if (shakeout2 && input.days_available >= 3) {
      sessions[shakeout2] = enforceCap(shakeoutSession(weekN, shakeout2, zones, pace, 1))
    }

    // CoachingPrinciples §39 — race-week mid-week easy for HM/marathon.
    // 8 km of total non-race volume is too deep a taper; add one slightly
    // longer easy run on a remaining available day.
    const raceWeekEasyKm = (GENERATION_CONFIG.RACE_WEEK_EASY_KM as Record<string, number>)[distKey]
    if (raceWeekEasyKm != null && input.days_available >= 4) {
      const used: Day[] = [raceDay]
      if (shakeout1) used.push(shakeout1)
      if (sessions[shakeout2 as Day]) used.push(shakeout2 as Day)
      // §39 Amendment 1 (Coaching Board 2026-09-14) — THAT SEPARATE QUESTION IS
      // NOW ANSWERED, and the answer was no.
      //
      // This preference order began with 'sat'. For a Sunday race — nearly every
      // real race — Saturday is the day before the gun, so §39's run landed on
      // race eve in **81 of 81 plans on the measured grid (100%)**, mean 54 min,
      // worst case 9 km / 72 min the day before a BEGINNER's first marathon.
      //
      // §39 is titled "Race-week MID-WEEK easy run" and §77 calls it "the §39
      // mid-week easy" — the constitution said mid-week in two places while the
      // engine said Saturday. §26 independently forbids scheduling a
      // fatigue-adding session in race week.
      //
      // Earliest, not latest: §39's job is aerobic preservation, which any day
      // serves equally. The only axis that varies is proximity to the race, and
      // on that axis earlier is strictly better.
      const easyDay = firstAvailableDay(
        (['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as Day[])
          .filter(beforeRace)
          // `> N`, not `>= N`: RACE_EVE_PROTECTED_DAYS = 1 means the day 1 before
          // the race is protected, so the run must sit at least 2 days out. The
          // first cut wrote `> N - 1`, which is a no-op on top of `beforeRace`
          // and left 'sat' reachable whenever every earlier day was blocked or
          // already used. The property sweep caught it — the reorder alone had
          // hidden it on the measurement grid.
          .filter(d => daysBeforeRace(d) > GENERATION_CONFIG.RACE_EVE_PROTECTED_DAYS),
        blocked, used,
      )
      if (easyDay) {
        sessions[easyDay] = easySession(weekN, easyDay, raceWeekEasyKm, 'distance', zones, pace,
          'Race-week easy', 4,
          ['Conversational. Keep the legs moving without adding fatigue.'])
      }
    }

    // Life-first (INV-PLAN-MAX-WEEKDAY-MINS). This branch returns early and so
    // never reached the shared cap pass at the end of the function — a runner
    // with a 30-minute weekday limit got a 35-minute weekday shakeout
    // (RACE_WEEK_SHAKEOUT_MAX_MINS). §30's intent is a short, sharp, low-fatigue
    // shakeout, so shortening it further to honour the runner's stated limit
    // costs the session nothing; the stride note is set on the object and rides
    // along unchanged. The race itself is exempt inside the helper.
    applyWeekdayMinsCap(sessions, input, /* isRaceWeek */ true)

    return sessions
  }

  // ── Determine which session types to include ──────────────────────────────
  // CoachingPrinciples §64 — cap at six training days so every week keeps a rest
  // day. A runner selecting 7 available days is telling us their schedule, not
  // asking for seven runs. Enforced by INV-PLAN-WEEK-HAS-REST-DAY.
  // §52b (INPUT-FLOOR-01) — a training day must be able to carry a real session.
  //
  // A runner on 12km a week who selects seven days gets seven ~1.7km jogs, and
  // no session in the week does anything: the quality session falls under
  // MIN_SESSION_DISTANCE_KM and the long run is barely longer than the rest.
  // The same 12km over three days is a training week.
  //
  // Does NOT override life-first (§18) — the runner's availability is unchanged
  // and honoured. This declines to SPREAD volume across days it cannot fill.
  // Never below 3 days: at or under that, §52's low-day rule already owns the
  // shape and downgrades the plan to maintenance with its own note.
  // DELOAD-INVERSION-01 part 3 (§3/§1, Coaching Board 2026-09-06) — a deload is
  // shorter runs on the SAME frequency, not fewer runs (a recovery week keeps the
  // rhythm). Since DELOAD-INVERSION-01 correctly deepened the deload curve, the
  // raw `weeklyKm/MIN_KM` would drop the deload's day count and strip easy runs —
  // which shrinks §1's running-session denominator and inflates the quality share
  // (measured on 50K low-volume plans). Gross the deload volume back up to the
  // pre-deload level for the DAY-COUNT only (the sessions are still sized to the
  // real, reduced `weeklyKm` downstream, so volume still drops). Recovery weeks
  // thus keep the surrounding weeks' frequency.
  // Same owner as the cut above — this DIVIDES by it, so if the two ever read
  // different depths the gross-up recovers a volume that was never cut.
  const dayCountKm = isDeload ? weeklyKm / deloadVolumeFraction(hasVolumeCappedInjury(input)) : weeklyKm
  const daysVolumeCanFill = weeklyKm > 0
    ? Math.max(GENERATION_CONFIG.MIN_TRAINING_DAYS_VOLUME_FLOOR, Math.floor(dayCountKm / GENERATION_CONFIG.MIN_KM_PER_TRAINING_DAY))
    : input.days_available

  const daysAvailable = Math.min(
    input.days_available,
    7 - blocked.size,
    GENERATION_CONFIG.MAX_TRAINING_DAYS_PER_WEEK,
    daysVolumeCanFill,
  )
  // distKey is hoisted above the race-week branch for §39 use.

  // Quality count for this week — config-driven (CoachingPrinciples §1, §6, §8).
  // Taper retains intensity per TAPER_QUALITY_PER_WEEK[distKey].
  // §110 Amendment 2 — a beginner who set a TIME TARGET has a ceiling of 1, not
  // 0; finish-goal beginners are unchanged. `qualityCeilingFor` is the single
  // owner, shared with INV-PLAN-QUALITY-PER-WEEK so producer and checker cannot
  // disagree about the ceiling.
  const fitnessCeiling = qualityCeilingFor(intensityFitness, input.goal, weeklyKm)
  let plannedQuality = 0
  if (phase === 'taper') {
    const taperPhase = phases.find(p => p.name === 'taper')!
    const taperIdx = weekN - taperPhase.start_week
    const arr = GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK[distKey]
    plannedQuality = arr[Math.min(taperIdx, arr.length - 1)] ?? 0
  } else if (phase === 'peak' && !isDeload) {
    // §79 (2026-09-02) — the COUNT of quality sessions is a LOAD decision, so it
    // keys off the STRUCTURAL level, not the intensity allowance. A second hard
    // session in a week is tonnage, and §79 is explicit that agency raises
    // intensity, never tonnage. The intensity level still governs how hard each
    // session is (`fitnessCeiling` above, and catalogue selection) — it just
    // cannot add one.
    //
    // Before this, a runner on 12 km/week declaring `experienced` got 2 peak
    // quality sessions on a beginner structure. That took plan-wide quality from
    // 9 to 11 against a threshold pool of 3 rows in build and 2 in peak/taper,
    // which no arrangement can spread inside §53's variety cap — 109 violations
    // across the property grid.
    // DELOAD-INVERSION-01 part 2a (Coaching Board 2026-09-06) — §8's second peak
    // quality YIELDS to §2's injury cap. A knee/shin-history runner's peak week
    // must fit the injury-capped curve at DELIVERY, and the least-harm lever is the
    // quality COUNT (Willy: it sheds the sharpest — intensity — load; the race-
    // anchored long run is protected by §52). One peak quality, never two, for an
    // injury-capped runner; an experienced runner without that history keeps two.
    plannedQuality = (fitness === 'experienced' && !injuryVolumeCapped) ? 2 : 1
  } else if (phase === 'build' && !isDeload) {
    plannedQuality = 1
  }
  // base = 0; deload weeks (non-peak/taper) = 0

  // §110 (Coaching Board 2026-09-16, CB-HSR-AVOID-01) — `avoid` is a FLOOR,
  // not a switch. This line used to read `plannedQuality = 0` for the whole
  // plan. It now CAPS. See GENERATION_CONFIG.HARD_AVERSE_QUALITY_PER_WEEK_MAX
  // for the five-seat reasoning and why 1 is the value §96's precedent forces.
  //
  // ACHILLES REMOVED — it was a defect against §21, not a coaching choice.
  // §21 prescribes SUBSTITUTION for hill-restricting injuries ("Substitutes are
  // progression runs or flat tempo at equivalent intensity"), and that is
  // ALREADY WIRED: `excludeHillSessions` (~:3244) filters hill rows out of
  // `selectCatalogueSession()` using HILL_RESTRICTING_INJURIES, which contains
  // 'achilles'. This line then deleted the flat session §21 had just
  // substituted — the engine satisfied §21 and overrode itself 400 lines later,
  // for 756 plans. Willy, decisive: tendinopathy management is progressive
  // LOADING, not unloading; the hill exclusion is right because the eccentric
  // load at the top of each rep is the aggravator, and flat tempo is not.
  // Removing it needs no principle change — §21 already says the right thing.
  if (input.hard_session_relationship === 'avoid') {
    plannedQuality = Math.min(plannedQuality, GENERATION_CONFIG.HARD_AVERSE_QUALITY_PER_WEEK_MAX)
    // §110 Am.1 reduces the DOSE, not the count — see qualKmPerSession
    // below for why the frequency lever was built, measured and withdrawn.
  }

  // Apply fitness ceiling — beginner = 0, intermediate/experienced = 2.
  const includeQualityCount = Math.min(plannedQuality, fitnessCeiling)
  const includeQuality = includeQualityCount > 0
  const qualityCountInPeak = includeQualityCount  // legacy variable name for downstream

  // Strength sessions — flagged off until R21 ships full content (CoachingPrinciples
  // doc + backlog R21). When STRENGTH_ENABLED=false, engine schedules 0 strength
  // sessions and frees up those day slots for easy runs. Prevents the
  // "long-run + 2 strength = 3 days used, no easy fillers" failure mode for
  // low-day-availability plans.
  const strengthTargetEnabled = GENERATION_CONFIG.STRENGTH_ENABLED
    ? (isDeload ? 1
       : phase === 'taper' ? 1
       : phase === 'peak' ? (fitness === 'experienced' ? 2 : 1)
       : 2)
    : 0
  const adjStrength = input.hard_session_relationship === 'avoid'
    ? Math.min(strengthTargetEnabled, 1)
    : strengthTargetEnabled

  const sessions: Partial<Record<Day, Session>> = {}
  const used: Day[] = []

  // ── 0. Volume distribution — compute distances FIRST so we can enforce
  //       the invariant that the long run is always the longest run of the week.
  //       (Bug fix: previously, low-day-count plans produced easy runs longer
  //       than the long run because volume = weekly - long fraction got
  //       crammed into few easy slots.)
  const longRunPct       = GENERATION_CONFIG.LONG_RUN_PCT_OF_WEEKLY_VOLUME[phase]
  const qualPct          = GENERATION_CONFIG.QUALITY_SESSION_PCT_OF_WEEKLY
  // CD-3 / §8 — quality grows by duration across build+peak (intensity held).
  // Centred on 1.0 so the plan's total intensity budget is unchanged.
  let qualProgression = 1
  if (phase === 'build' || phase === 'peak') {
    const buildStart = phases.find(p => p.name === 'build')?.start_week
    const peakEnd    = phases.find(p => p.name === 'peak')?.end_week
    if (buildStart != null && peakEnd != null && peakEnd > buildStart) {
      const t = Math.min(1, Math.max(0, (weekN - buildStart) / (peakEnd - buildStart)))
      qualProgression = 1 + (GENERATION_CONFIG.QUALITY_PROGRESSION_RANGE_PCT / 100) * (t - 0.5)
    }
  }
  // §110 Am.1 (CB-HSR-AVOID-01 second sitting) — `avoid` gets a SMALLER quality
  // session, not fewer of them. This is the lever that reaches an intermediate,
  // who never earns the 2/week the per-week cap bites on.
  //
  // ⚠️ THE FREQUENCY LEVER WAS BUILT, MEASURED AND WITHDRAWN, and why is the
  // transferable part. Skipping alternate BUILD weeks collided with three
  // separately-ratified rules in succession: §5's VO2max adaptation deadline
  // (on a 14-week 10K the natural slot lands EXACTLY on the deadline, so any
  // earlier skip fires INV-PLAN-VO2MAX-ONSET), §53's variety cap (a thinner
  // rotation repeats `tempo_continuous` — 61 new errors), and §79's intensity
  // re-entry window (264 new errors). Each fix produced the next collision.
  //
  // The build rotation is tightly coupled — §5's deadline, §22's rename, §53's
  // variety and §79's window all key off its index and calendar position — so
  // removing half its weeks perturbs all four. Three collisions from one lever
  // is a signal the lever is wrong, not that a fourth patch is needed.
  //
  // DOSE is the one axis nothing else keys on. Freed distance returns to the
  // easy runs through §9's re-derivation, which VOL-SHORTFALL-01 measured as
  // volume-preserving, so the week is the same size and only the hard part of
  // it is smaller. That is what "spared" should mean (§96 line 4771), and what
  // McMillan asked for: the runner who says the last one hurt gets a SHORTER
  // one, not a later one.
  const hardAverseDose = input.hard_session_relationship === 'avoid'
    ? GENERATION_CONFIG.HARD_AVERSE_QUALITY_DOSE_PCT / 100
    : 1
  const qualKmPerSession = weeklyKm * (qualPct / 100) * qualProgression * hardAverseDose

  // SC-10 / CD-14 — VO2max main-set ceiling. Sizing quality as a share of weekly
  // volume makes the hardest session GROW into peak (§8, measured p50 25 min).
  // VO2max is the least sustainable per minute, so its main set is capped in
  // ABSOLUTE minutes, converted to a distance here via I-pace (the pace the flat
  // vo2max session is priced at — see makeQualitySession). Only the PRIMARY slot
  // is ever vo2max in practice (peak 5K/10K and the build rotation put vo2max
  // primary; a second slot is the softer category). The freed distance returns
  // to the week through the §9 easy redistribution below — VOL-SHORTFALL-01 proved
  // that preserves total weekly volume, which is why a ceiling succeeds where the
  // percentage attempt (which was reasoned to lose volume) failed. Effort-governed
  // hills are priced at easy pace, so this leaves them longer — deliberately, they
  // are lower impact (SC-09) and not the work this ceiling exists to bound.
  // §93 — the peak phase's length, derived from the phases array this function
  // already receives rather than passed in, so it cannot disagree with the
  // boundaries every other consumer reads. Deload weeks are NOT subtracted: the
  // allowance is a share of the phase, and a deload inside peak is excluded from
  // the rotation by the caller (isRotatingPeakWeek), so subtracting here would
  // discount it twice.
  const peakPhase = phases.find(p => p.name === 'peak')
  const peakWeeksTotal = peakPhase ? Math.max(0, peakPhase.end_week - peakPhase.start_week + 1) : 0

  const primaryCat = preferredQualityCategory(
    phase, distKey, input.goal === 'time_target', buildRotationIndex, vo2MustOpenBuild,
    peakRotationIndex, peakWeeksTotal, vo2BuildSlotIndex, intensityReentryActive)
  const vo2maxCapKm = durationForMainSet(GENERATION_CONFIG.VO2MAX_MAIN_SET_MAX_MINS) / pace.minPerKmInterval
  const qualKmPrimary = primaryCat === 'vo2max'
    ? Math.min(qualKmPerSession, vo2maxCapKm)
    : qualKmPerSession
  const secondaryFrac    = GENERATION_CONFIG.SECONDARY_QUALITY_PCT_OF_PRIMARY / 100
  // Per-slot, and ZERO when the week carries no quality (beginners in base, §8) —
  // the old `count × qualKmPerSession` handled that by multiplying by 0; the
  // per-slot sum must reproduce it or a phantom quality volume is stolen from the
  // easy runs (which silently shrank beginner base weeks and flipped a plan's
  // volume_profile).
  const totalQualVol     = includeQualityCount === 0
    ? 0
    : qualKmPrimary + (includeQualityCount > 1 ? qualKmPerSession * secondaryFrac : 0)
  const easyCount        = Math.max(0, daysAvailable - 1 - includeQualityCount - adjStrength)

  let longKm = weeklyKm * (longRunPct / 100)
  let easyKm = easyCount > 0 ? Math.max(0, weeklyKm - longKm - totalQualVol) / easyCount : 0

  // Long-vs-easy invariant (CoachingPrinciples §9): long must be at least
  // LONG_RUN_MIN_RATIO_VS_EASY × the easy distance. When the natural
  // distribution would invert this (low-volume / low-day plans), redistribute
  // while preserving total weekly volume.
  const minRatio = GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY
  if (easyCount > 0 && longKm < easyKm * minRatio) {
    // longKm = easyKm × R; total = longKm + easyKm × N + qualVol = weeklyKm
    //   → easyKm × (R + N) = weeklyKm − qualVol
    easyKm = (weeklyKm - totalQualVol) / (minRatio + easyCount)
    longKm = easyKm * minRatio
  }

  // Apply caps after redistribution.
  if (weekN <= 2 && input.longest_recent_run_km > 0) {
    const earlyCap = input.longest_recent_run_km * GENERATION_CONFIG.WEEK_1_2_LONG_RUN_CAP_MULTIPLIER
    if (longKm > earlyCap) longKm = earlyCap
  }

  // CoachingPrinciples §24, §35 — peak long-run race specificity (tiered).
  // Floor (default) → target (longest_recent supports it) → stretch (persona
  // signals support more aggressive prescription). Selects the highest tier
  // the persona qualifies for; LONG_RUN_CAP_MINUTES still wins below.
  let lrFloorPrinciple = 0
  if ((phase === 'peak' || phase === 'build')
      && !isDeload
      && input.goal === 'time_target'
      && (distKey === 'HM' || distKey === 'MARATHON')) {
    // §35 Amendment 2 (Coaching Board LR-TIER-GATE-RECONCILE-01, 2026-09-15) —
    // TWO RUNGS, NOT THREE. The stretch rung is removed.
    //
    // It was gated on `hard_session_relationship: 'love'` — a self-report about
    // appetite for hard work — with NO training-age floor and only a partial
    // injury test, while §47's exception answers the same question ("can this
    // runner take more long-run load?") requiring no injury at all AND `5yr+`.
    // Two gates, one question, and the weaker one was the one adding distance.
    //
    // It was also INERT: measured across 36 comparable plans, the stretch rung
    // changed the delivered peak long run in 0 of 36, while the target lift moved
    // 33 of 36. Removing it has provably no effect on any runner's plan.
    const floorRatio   = GENERATION_CONFIG.PEAK_LR_RATIO_VS_RACE[distKey]
    const targetRatio  = GENERATION_CONFIG.PEAK_LR_RATIO_TARGET[distKey]
    const recentMeetsFloor = input.longest_recent_run_km >= input.race_distance_km * floorRatio
    const tierRatio = recentMeetsFloor ? targetRatio : floorRatio
    const precisionKm = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
    lrFloorPrinciple = Math.ceil((input.race_distance_km * tierRatio) / precisionKm) * precisionKm
    longKm = Math.max(longKm, rampedSpecificityFloor(lrFloorPrinciple, phase, weekN, phases))
  }

  // CoachingPrinciples §80 (D3) — finish-goal HM/marathon long-run floor,
  // expressed in DURATION. §45's ≥85%-of-race-distance floor applies only to
  // time-targeted plans, so a first-timer had no floor at all: the first organic
  // user peaked at 1:46 against a ~2:45 projected finish (64%). §45's own
  // rationale — "the fatigue profile of running for ~2 hours is fundamentally
  // different" — applies more to them, not less.
  //
  // Duration, not distance, because a first-timer is time-on-feet limited rather
  // than aerobically limited, and because the cap that may override this is
  // itself in minutes. Projected finish uses easy pace: a finish-goal runner
  // will not race at threshold, and run-walk is expected.
  // The run-walk permission attaches to every finish-goal peak long run, not
  // only the ones this floor happened to lift — a first-timer facing a two-hour
  // effort needs it either way.
  const isFinishGoalPeakLongRun = (phase === 'peak' || phase === 'build')
    && !isDeload
    && input.goal === 'finish'
    && (distKey === 'HM' || distKey === 'MARATHON')
  if (isFinishGoalPeakLongRun
      && pace.minPerKmEasy > 0) {
    const projectedRaceMins = input.race_distance_km * pace.minPerKmEasy
    const floorMins = projectedRaceMins * GENERATION_CONFIG.FINISH_GOAL_PEAK_LR_RATIO_VS_RACE_DURATION
    const floorKm = floorMins / pace.minPerKmEasy
    longKm = Math.max(longKm, rampedSpecificityFloor(floorKm, phase, weekN, phases))
  }

  // ── §114 — THE LONG RUN FITS THE WEEK IT IS IN ("get you round") ──────────
  //
  // FOUNDER DECISION, 2026-09-19, after the Coaching Board reached a genuine
  // trilemma: where the week cannot hold the long run the race asks for, the
  // LONG RUN YIELDS and the plan says so. The alternative on the table was
  // refusing these runners outright.
  //
  // WHY THE LONG RUN AND NOT THE WEEK. §114 was first built as a floor on the
  // VOLUME CURVE — raise the week to hold the run — in four formulations, all
  // recorded in §9's structural finding. Every one was inert or broke §2/§3,
  // because the week CANNOT be raised: an 8 km/week runner cannot reach the
  // 43 km a 26 km long run needs, in nineteen weeks, under §2's 10% rule once
  // §3's deloads take 30% four times over. That is arithmetic about running.
  // Measured on that runner before this bound: a **26 km long run inside a
  // 28 km week — 93%** — while the long run climbed 8 -> 26 km and the week
  // never passed 29.
  //
  // McMillan, whose position the founder took: "for a first-timer, 'get you
  // round' IS the goal." A runner who does a 17 km longest run and run-walks
  // the last 10 km finishes. A runner given a 26 km run off an 8 km/week base
  // is injured in week 15 and does not start.
  //
  // ⚠️ APPLIED AT CONSTRUCTION, NOT AS A POST-PASS, and the position is the
  // whole fix. Ten post-hoc bounds were built and measured first; every one
  // destroyed specificity, because §45's progression cap is multiplicative on
  // the previous week's long run — reduce any week and the trajectory ratchets
  // down and never recovers. Sized here, the sequence §45 later inspects is
  // coherent from week 1 and there is no discontinuity to ratchet from.
  //
  // ⚠️ THE SHORTFALL IS DECLARED, NEVER SILENT. §80's shortfall note and §38's
  // volume-constraint note both key on the delivered long run, so a bounded
  // plan tells the runner its longest run falls short of what the race wants
  // and why. That honesty is the other half of the founder's decision — a
  // shorter long run that nobody mentions is not a "get you round" plan, it is
  // a worse plan.
  //
  // ⚠️ FLOORED BY §9's LONG-VS-EASY RATIO, so the bound can never make the long
  // run shorter than the easy runs it is supposed to exceed.
  // ⚠️ IT ONLY EVER REDUCES, and the first cut did not. Written as
  // `max(min(longKm, shareCap), easyKm × minRatio)` the §9 ratio floor could
  // RAISE the long run — straight past §45's week-1/2 cap, which is applied
  // twenty lines above. Measured: week 1 at 4.5 km against a 4.4 km cap, and
  // `INV-PLAN-WEEK-1-2-LONG-CAP` threw across the charity cohort. A bound that
  // can increase its subject is not a bound.
  //
  // Where §9's ratio floor sits ABOVE the 60% share, the share gives way rather
  // than the long run dropping under the easy runs — and §52's warn then
  // declares the residual, which is what it is for (§34).
  //
  // ⚠️ DELOAD AND RACE WEEKS EXEMPT — the same exemption `INV-PLAN-LR-MAX-WEEKLY-PCT`
  // already carries, and leaving it out broke §3 Am. A deload scales the whole
  // week down together, so bounding the long run to 60% of the REDUCED week cuts
  // it a second time and makes the long-run cut disproportionate to the week's —
  // which is the exact defect §3 Am. was written to fix (LR-DELOAD-CUT-01).
  //
  // ⚠️ THE FREED VOLUME GOES TO THE OTHER DAYS — SIMS'S BINDING CONDITION, and
  // omitting it was a measured defect. Without recomputing `easyKm`, whatever
  // the long run gives up is simply LOST: the delivered week shrinks, persona
  // M3's net build fell 79% -> 42%, and §3's deload proportionality broke
  // because `weekCut` was computed from a week that had quietly deflated. A
  // shorter long run in a smaller week is not a "get you round" plan, it is a
  // smaller plan. This is a REDISTRIBUTION.
  if (weeklyKm > 0 && !isRaceWeek) {
    const shareCap = weeklyKm * (GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_DELIVERED_WEEK / 100)
    const bounded = Math.min(longKm, Math.max(shareCap, easyKm * minRatio))
    if (bounded < longKm) {
      longKm = bounded
      // ⚠️ `easyKm` IS DELIBERATELY NOT RECOMPUTED HERE. The freed volume is
      // already absorbed downstream: the easy-placement step recomputes
      // `remainingVolume = weeklyKm - placedKm` from the sessions actually
      // placed, so a smaller long run leaves more for the easy runs by
      // construction. Recomputing it here as well double-counted the release
      // and pushed an injury-capped bounceback week ABOVE its pre-deload
      // volume (§2 Am.3, `INV-PLAN-BOUNCEBACK-BOUNDED` at 41 km against 39).
      // Sims's condition — the week total must not fall — is met by the
      // downstream pass, not by this one.
    }
  }

  longKm = applyLongRunCap(longKm, pace.minPerKmEasy, input)

  // Round to DISTANCE_ROUNDING_PRECISION_KM. 0.5 km = whole-number-ish display
  // (11.9 → 12.0, 13.2 → 13.0, 14.7 → 14.5, 8.4 → 8.5).
  const precision = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
  const roundDist = (n: number) => Math.round(n / precision) * precision
  const floorDist = (n: number) => Math.floor(n / precision) * precision
  // CB-SUBFLOOR-ADMIT-01 — floors resolved FOR THIS RUNNER, not the flat config.
  //
  // `Math.max(floorDist(longKm), minDist.long)` below runs three lines after
  // §45's cap and used to break it: at longest 3 km the cap places 3.3 km
  // (+10%) and the flat 5 km floor overrode it to 5.0 km (+67%). §113 then
  // refused the runner FOR THE LEAP THE FLOOR HAD JUST CREATED. Coaching Board
  // 2026-09-18 vetoed that. Identical to the old constant for every runner at
  // or above the floor — see `sessionFloors.test.ts`'s no-op property.
  const minDist   = sessionFloorsFor(input.longest_recent_run_km)
  // Long run uses floor-rounding so post-round value never exceeds upstream caps
  // (longest_recent × 1.10 in weeks 1-2; LONG_RUN_CAP_MINUTES per distance).
  // Round-nearest would round 8.8 → 9.0 and break the cap by 0.5 km.
  longKm = Math.max(floorDist(longKm), minDist.long)
  // Note: `easyKm` here is provisional — it informs the long-vs-easy invariant
  // above. The actual placement value is re-derived after long/quality/strength
  // are placed (see § 4) so freed-up volume from un-placed planned sessions
  // (e.g. qual2 with no eligible day) flows to the easy slots that fill them.

  // ── 1. Long run ───────────────────────────────────────────────────────────
  // Long-run day preference: Sun by default; user can choose Sat. Falls back to Fri.
  const longDayPref: Day[] = input.preferred_long_run_day === 'sat'
    ? ['sat', 'sun', 'fri']
    : ['sun', 'sat', 'fri']
  const longDay = firstAvailableDay(longDayPref, blocked) ?? 'sun'

  // Marathon / HM peak: swap the standard long run for a race-specific long
  // run from the catalogue (CoachingPrinciples §25, ADR-009 spec 3.7) — only
  // when goal_pace is set and the runner is in a non-deload peak week.
  const useRaceSpecificLR = phase === 'peak' && !isDeload && goalPace
  if (useRaceSpecificLR && distKey === 'MARATHON') {
    const mpRow = catalogue.find(r => r.id === 'mp_long_run')
    if (mpRow && (tier !== 'free' || mpRow.is_free_tier)) {
      sessions[longDay] = raceSpecificLongRunSession(
        weekN, longDay, longKm, metric, zones, pace, mpRow, goalPace
      )
    } else {
      sessions[longDay] = longSession(weekN, longDay, longKm, metric, zones, pace)
    }
  } else if (useRaceSpecificLR && distKey === 'HM') {
    const hmRow = catalogue.find(r => r.id === 'hm_pace_long_run')
    if (hmRow && (tier !== 'free' || hmRow.is_free_tier)) {
      sessions[longDay] = raceSpecificLongRunSession(
        weekN, longDay, longKm, metric, zones, pace, hmRow, goalPace
      )
    } else {
      sessions[longDay] = longSession(weekN, longDay, longKm, metric, zones, pace)
    }
  } else {
    // §24b / §24c / §24d — structured long-run variants for 5K/10K plans.
    const is5K10K = distKey === '5K' || distKey === '10K'
    const taperPhaseObj = phases.find(p => p.name === 'taper')
    const weeksUntilTaper = taperPhaseObj ? taperPhaseObj.start_week - weekN : 999
    const isFinalTwoPeak  = phase === 'peak' && !isDeload && weeksUntilTaper <= 2

    // §24b's segments ARE the session, so a runner with no derivable marathon /
    // HM pace cannot be prescribed it. `buildFallbackPace` already says so in as
    // many words — "Beginners: null — no pace segments prescribed
    // (CoachingPrinciples §24b)" — and returns null for both. This gate is that
    // sentence, enforced.
    //
    // ⚠️ MEASURED 2026-09-12, and it was shipping: without this gate the session
    // was built anyway and the pace strings fell back to the literal WORDS, so
    // every beginner on a time-targeted 5K/10K plan read
    //   "Middle 20% (≈2.1 km) at marathon pace: marathon pace."
    // in their final two peak weeks — a sentence that says the same thing twice
    // and gives them no number. 108 of 108 beginner sessions in the 621-plan
    // cohort; 0 of 108 intermediate/experienced. A defect fix restoring
    // documented intent, so ADR-017-exempt from the Coaching Board.
    const canPaceSegments = !!pace.marathonPaceStr && !!pace.hmPaceStr
    if (is5K10K && input.goal === 'time_target' && isFinalTwoPeak && canPaceSegments) {
      // §24b — final two peak weeks: marathon pace + HM-pace finish
      sessions[longDay] = fiveKTenKPeakLongRunSession(weekN, longDay, longKm, metric, zones, pace)
    } else if (is5K10K && input.goal === 'finish' && isFinalTwoPeak) {
      // §24d — final two peak weeks: negative-split finish
      sessions[longDay] = finishGoalPeakLongRunSession(weekN, longDay, longKm, metric, zones, pace)
    } else {
      sessions[longDay] = longSession(weekN, longDay, longKm, metric, zones, pace)
      // §24c — build phase: Z2-ceiling note on 5K/10K time-targeted long runs.
      //
      // §96 (CB-HSR-01) widens it for one cohort: a runner who answered "I
      // overdo it. Rein me in." gets the same cue on EVERY long run, at every
      // distance and in every phase. §24c's own reasoning is that the long run
      // is where runners most often drift into Z3 — which is precisely what this
      // runner has told us they do. Reusing §24c's existing cue rather than
      // writing new copy is deliberate: one cue per week on the session where
      // drift is worst, not a note on every easy run, which becomes wallpaper
      // and gets ignored (McMillan: a rule you experience, not one you study).
      const overdoCue = GENERATION_CONFIG.OVERDO_IS_A_BRAKE
        && input.hard_session_relationship === 'overdo'
      const z2CueApplies = !isDeload && (
        (is5K10K && input.goal === 'time_target' && phase === 'build') || overdoCue)
      if (z2CueApplies) {
        const s = sessions[longDay]!
        const ceilingNote = 'Zone 2 ceiling — if HR starts climbing, back off to a walk for 30 seconds before resuming.'
        const existing = s.coach_notes
        s.coach_notes = existing
          ? [existing[0], ceilingNote, existing[1]] as [string, string?, string?]
          : [ceilingNote]
      }
    }
  }
  // Stamp the structural role at the placement boundary. The code that DECIDES
  // which session is the long run owns the fact (D-07), independent of the label
  // any of the four long-run builders wrote — or that the enricher later rewrites.
  if (sessions[longDay]) sessions[longDay]!.role = 'long_run'

  // §80 — when the finish-goal floor lifted this long run, say why, and make
  // run-walk explicit. "Two and a half hours of moving" is a different
  // psychological object from "18 kilometres", and only one of them is
  // achievable for a first-timer. The instruction is time on feet, not pace.
  if (isFinishGoalPeakLongRun && sessions[longDay]) {
    appendCoachNote(
      sessions[longDay]!,
      'Time on feet is the point — walk breaks are fine and do not undo it. Finishing this feeling steady matters more than the pace.',
    )
    // §80 (HR-MAX-01 part 3) — this session's prescription IS time on feet, so it
    // stays duration-anchored whatever the runner's metric preference. A distance
    // headline would misrepresent what's limiting (time-on-feet, not aerobic) and
    // make a walk break look like a failed target. Distance is carried as a
    // secondary value; duration is primary. INV-PLAN-DURATION-ANCHORED-KEEPS-MINUTES.
    const lr = sessions[longDay]!
    lr.duration_anchored = true
    lr.primary_metric = 'duration'
    if (lr.duration_mins == null) lr.duration_mins = dur(roundDistance(longKm), pace.minPerKmEasy)
    if (lr.distance_km == null) lr.distance_km = roundDistance(longKm)  // secondary value
  }

  // §24e / CAT-ULTRA-FUELLING-01 — the peak-phase fuelling cue on the ultra long
  // run (Coaching Board 2026-09-13, re-spec of the struck
  // `fuelling_practice_from_week: 8`).
  //
  // Sims led the concept ruling: under-fuelling a 4–6 h effort is the RED-S /
  // low-energy-availability vector, and it lands hardest on the women and masters
  // runners this distance serves. The original numeric was the wrong SHAPE (an
  // absolute week index means different things in a 16- vs 22-week plan — §44's
  // fragility) and the wrong OBJECT (fuelling is not a scheduled session). This
  // is the re-spec: phase-anchored, on the session where the duration makes
  // fuelling both possible and necessary.
  //
  // A NOTE, not a field: §24e forbids any pace overlay on an ultra long run, and
  // INV-PLAN-ULTRA-NO-PACE-SEGMENTS enforces it. Fuelling is not pace, so the
  // cue is additive to a session that stays pure aerobic time-on-feet.
  //
  // Peak only, deliberately. Every long run in the plan would be wallpaper
  // (§24c/§96's own reasoning: one cue on the session where it matters, not a
  // note on everything). Peak is where the durations reach the 3–4 h at which
  // fuelling stops being optional.
  used.push(longDay)

  // ── 2. Quality session(s) ─────────────────────────────────────────────────
  // Catalogue-driven (spec 3.9). Selection deterministic per (weekN, slotIndex).
  // Falls back to inline label when no catalogue row matches (e.g. 5K/10K taper).
  // Spacing reads from MIN_HOURS_BETWEEN_QUALITY_AND_LONG (spec 3.11).
  const minDaysBetweenQualLong = Math.ceil(GENERATION_CONFIG.MIN_HOURS_BETWEEN_QUALITY_AND_LONG / 24)
  const minDaysBetweenQualities = Math.ceil(GENERATION_CONFIG.MIN_HOURS_BETWEEN_QUALITY / 24)

  if (includeQuality && used.length < daysAvailable) {
    const qualKm = Math.max(roundDist(qualKmPrimary), minDist.quality)
    // CoachingPrinciples §36 — alternate taper category by index so consecutive
    // taper weeks vary their stimulus. Even idx → threshold (default), odd idx
    // → race_specific (sharpener). Race week itself has no quality (§26).
    const isTimeTarget = input.goal === 'time_target'
    // CAT-ROW-ELIGIBILITY-01 — the pace anchors THIS runner actually has, computed
    // once per week and handed to every row-picking path below. Built from the
    // single owner of anchor pricing (`resolveAnchorPace`) so the gate and the
    // sizing can never disagree about whether a pace exists — a checker that
    // reads a different source from the producer is this repo's own recorded
    // silent-failure class.
    const goalPaceMins = goalPace ? paceStrToMins(goalPace) : null
    const resolvableAnchors: ReadonlySet<string> = new Set(
      PACE_ANCHORS.filter(a => resolveAnchorPace(a, pace, goalPaceMins) != null),
    )

    let preferredCategory = preferredQualityCategory(
      phase, distKey, isTimeTarget, buildRotationIndex, vo2MustOpenBuild, peakRotationIndex,
      peakWeeksTotal, vo2BuildSlotIndex, intensityReentryActive)
    let taperForceSharpener = false
    // CD-2 / §36 — goal-pace sharpening in the taper is a time-target tool; a
    // finish-goal taper stays on threshold (§80). Without the goal-gate, a
    // finish runner's odd taper weeks were named "Goal-pace sharpener" over
    // generic threshold pace (§19 violation).
    if (phase === 'taper' && isTimeTarget) {
      const taperPhase2 = phases.find(p => p.name === 'taper')!
      const taperIdx2 = weekN - taperPhase2.start_week

      // SC-04 (2026-08-20) — alternation needs at least two sessions to
      // alternate between. A 5K/10K taper is ~10 days: two weeks, one of which
      // is race week (no quality, §26). That leaves exactly ONE quality session,
      // at index 0 — even — which the alternation gives to threshold. The plan
      // then carries NO race-specific taper work at all, against §5's ladder
      // (taper = 70% specific) and §22.
      //
      // It didn't show before SC-04 only because no threshold row was eligible
      // for 5K/10K, so the selector's silent fallback handed the slot to the
      // sharpener anyway. Making threshold reachable removed the accident and
      // exposed the rule underneath. Restores documented intent — not a new
      // coaching decision, and deliberately scoped so multi-week tapers keep
      // their existing parity untouched.
      const taperQualityWeeks = (totalWeeks - 1) - taperPhase2.start_week + 1
      const soleTaperQualityWeek = taperQualityWeeks <= 1

      if (soleTaperQualityWeek || taperIdx2 % 2 === 1) {
        preferredCategory = 'race_specific'
        taperForceSharpener = true
      }
    }

    let qualDay = firstAvailableDay(['wed', 'thu', 'tue'], blocked, used.filter(d => dayGap(d, 'wed') < 2))
      ?? firstAvailableDay(['wed', 'thu', 'tue', 'mon', 'fri'], blocked, used)

    // UX-WIZARD-01 Stage B — DAY-IDENTITY-AWARE PLACEMENT. With per-day budgets,
    // the structured session belongs on the weekday with the most room, so it
    // lands where its budget holds it instead of overrunning a tight day (the
    // §81 exemption then rarely needs to fire). Gated on `day_budgets`, so a
    // plan without them keeps the selection above exactly (verify:parity
    // IDENTICAL). Only swaps to a day that is itself eligible — unblocked,
    // unused, and correctly spaced from the long run (§6/§8/§18) — so it can
    // never place quality adjacent to the long run or drop it.
    if (input.day_budgets && qualDay) {
      const wd = (d: Day) => d as 'mon' | 'tue' | 'wed' | 'thu' | 'fri'
      const budgetOf = (d: Day) => input.day_budgets?.[wd(d)] ?? input.max_weekday_mins ?? Infinity
      const PREF: Day[] = ['wed', 'thu', 'tue', 'mon', 'fri']
      const eligible = PREF.filter(d =>
        !blocked.has(d) && !used.includes(d) && dayGap(d, longDay) >= minDaysBetweenQualLong)
      // Most room first; ties keep the deterministic preference order.
      eligible.sort((a, b) => (budgetOf(b) - budgetOf(a)) || (PREF.indexOf(a) - PREF.indexOf(b)))
      if (eligible.length > 0 && budgetOf(eligible[0]) > budgetOf(qualDay)) qualDay = eligible[0]
    }

    // CoachingPrinciples §21 — knee/ITB/Achilles/shin/calf/plantar history
    // excludes hill sessions. §21's peak reintroduction is gated on "a successful
    // symptom-free build" that is NOT YET WIRED, so until it is, the exclusion
    // holds in EVERY phase — not just base/build. The old phase scope left peak
    // ungated; it stayed safe only because the stateless selector never happened
    // to pick hill_reps in peak, which the least-used rotation (CAT-ULTRA-THIN-01)
    // no longer guarantees. Restores documented §21 intent.
    // §21 — one owner for this predicate (see `neuromuscular.ts`). It was
    // written out here, again in `invariants.ts`, and a third copy was about to
    // be added for §28 Am.1's hill strides — which is how the hill-stride
    // defect reached production.
    const excludeHillSessions = hasHillRestrictingInjury(input.injury_history)

    // CoachingPrinciples §22 — race-specific exposure for time-targeted goals.
    // From the half-week onwards (inclusive — R2/H-02), prescribe quality at
    // goal pace and rename to "{distKey}-pace intervals". VO2max sessions are
    // exempt — true I-pace physiology is preserved at the top of peak.
    const isSecondHalf = weekN >= Math.ceil(totalWeeks / 2)
    const goalPaceWeek = !!goalPace
      && input.goal === 'time_target'
      && isSecondHalf
      && (phase === 'build' || phase === 'peak')

    if (qualDay && dayGap(qualDay, longDay) >= minDaysBetweenQualLong) {
      // Taper alternation: prefer goal_pace_sharpener directly on odd taper
      // indices so the selector's deterministic mod doesn't accidentally
      // re-pick the threshold row (CoachingPrinciples §36).
      let cat1: SessionCatalogueRow | null
      if (taperForceSharpener) {
        // SC-05 / CD-18 — MOST SPECIFIC ROW WINS. `goal_pace_sharpener` is the
        // all-distance generic; where a distance actually has its own race-pace
        // session eligible in taper (10K, via tenk_pace_intervals), that is the
        // more specific prescription and should be preferred. Ranking by the
        // size of `distance_eligibility` rather than by id keeps this true for
        // any future distance-specific row without another special case.
        const raceSpecificTaperRows = catalogue
          .filter(r => r.category === 'race_specific'
            && r.phase_eligibility.includes('taper')
            && r.distance_eligibility.includes(distKey)
            && (tier !== 'free' || r.is_free_tier)
            // CAT-ROW-ELIGIBILITY-01 — this path picks a row DIRECTLY rather than
            // through selectCatalogueSession, so it needs the anchor gate applied
            // explicitly or it re-opens the hole one line below the fix.
            && requiredPaceAnchors(r).every(a => resolvableAnchors.has(a)))
          .sort((a, b) => a.distance_eligibility.length - b.distance_eligibility.length)

        cat1 = raceSpecificTaperRows[0] ?? selectCatalogueSession({
          catalogue, phase, distanceKey: distKey, fitness: intensityFitness, tier, weekN, slotIndex: 0, preferredCategory,
          weeklyKm, excludeHillSessions, excludeHighTissueStress, rowUsage, rowLast, poolSizes: poolSink, recentThresholdEligible,
          resolvableAnchors,
        })
      } else {
        cat1 = selectCatalogueSession({
          catalogue, phase, distanceKey: distKey, fitness: intensityFitness, tier, weekN, slotIndex: 0, preferredCategory,
          weeklyKm, excludeHillSessions, excludeHighTissueStress, rowUsage, rowLast, poolSizes: poolSink, recentThresholdEligible,
          resolvableAnchors,
        })
      }
      if (process.env.DEBUG_ROT) console.error(`      cat1 -> ${cat1?.id}:${cat1?.category} (pref=${preferredCategory})`)
      sessions[qualDay] = makeQualitySession({
        weekN, day: qualDay, distKm: qualKm, metric, zones, pace,
        catalogueRow: cat1, phase, fitness: intensityFitness, isDeload, goalPace,
        goalPaceWeek, distLabel: distKey, cueCtx,
      })
      used.push(qualDay)

      // Second quality (peak experienced or per TAPER_QUALITY_PER_WEEK if >1).
      //
      // §8 / CD-20 — the week must be long enough to carry it. Below
      // MIN_TRAINING_DAYS_FOR_SECOND_QUALITY the week cannot hold two quality
      // sessions without breaking §9's long-vs-easy ratio or losing ~8% of its
      // own volume out of the easy run. See the config comment for the
      // arithmetic. This is the rule the hardcoded candidate-day list below was
      // enforcing by accident.
      const weekCanCarrySecondQuality =
        daysAvailable >= GENERATION_CONFIG.MIN_TRAINING_DAYS_FOR_SECOND_QUALITY

      if (qualityCountInPeak > 1 && weekCanCarrySecondQuality && used.length < daysAvailable) {
        // SC-01 — two defects fixed here; the 48-hour spacing doctrine was fine.
        //
        // (1) 'fri' was never a candidate, though the FIRST quality session's
        //     fallback above considers all five weekdays. For the common shape
        //     — long run Sunday, first quality Wednesday — Friday is the ONLY
        //     day satisfying both gaps, so the session was dropped for a
        //     constraint that did not exist.
        // (2) The old code took the first FREE day and THEN tested spacing, so
        //     a failing candidate ended the search instead of advancing. Even
        //     within ['tue','thu','mon'] only the first free day was ever really
        //     considered.
        //
        // Spacing now filters the candidates and the first survivor wins;
        // preference order is otherwise unchanged.
        const qual2Day = firstAvailableDay(
          (['tue', 'thu', 'mon', 'fri', 'wed'] as Day[]).filter(d =>
            dayGap(d, longDay) >= minDaysBetweenQualLong
            && dayGap(d, qualDay) >= minDaysBetweenQualities
          ),
          blocked, used,
        )
        if (qual2Day) {
          // Second slot prefers a different category for variety: vo2max if first was threshold and vice versa.
          //
          // §93 — the map must be EXHAUSTIVE, and it was not. The final
          // `: preferredCategory` fallback returned the primary's own category
          // unchanged for `race_specific` / `ultra_specific`, so a week whose
          // primary was race-pace filled BOTH slots from the same category —
          // and, since 10K owns exactly one `race_specific` row
          // (`tenk_pace_intervals`), with the literally identical session twice
          // in one week. Latent while only HM reached a race-specific primary;
          // live the moment §93 gave 10K peak one. A race-pace primary pairs
          // with threshold: pairing it with a second specific session is both
          // duplicative and more goal-pace intensity than one week should carry.
          const altCategory: CatalogueCategory = preferredCategory === 'threshold' ? 'vo2max'
            : preferredCategory === 'vo2max' ? 'threshold'
            : preferredCategory === 'race_specific' ? 'threshold'
            : preferredCategory === 'ultra_specific' ? 'threshold'
            : preferredCategory
          // §79 (2026-09-02, Coaching Board) — select on the INTENSITY level, as
          // the primary slot above already does. This slot read the STRUCTURAL
          // level, and the catalogue filters rows by
          // `FITNESS_RANK[row.fitness_level_min] <= userRank`: 0 of 14 quality
          // rows are eligible at `beginner`, so a returning runner (structural
          // beginner, intensity intermediate) could never fill their second
          // quality slot — measured at 0 of 6 build/peak weeks — despite
          // QUALITY_SESSIONS_PER_WEEK_MAX allowing 2. The allowance and the
          // catalogue filter disagreed; the allowance is right.
          const cat2 = selectCatalogueSession({
            catalogue, phase, distanceKey: distKey, fitness: intensityFitness, tier, weekN, slotIndex: 1, preferredCategory: altCategory,
            weeklyKm, excludeHillSessions, excludeHighTissueStress, rowUsage, rowLast, poolSizes: poolSink, recentThresholdEligible,
            resolvableAnchors,
          })
          const secondaryFraction = GENERATION_CONFIG.SECONDARY_QUALITY_PCT_OF_PRIMARY / 100
          // SC-10 — size the second (softer) slot off the UNCAPPED base, never the
          // vo2max-capped primary, so a capped primary doesn't shrink a threshold
          // second session.
          sessions[qual2Day] = makeQualitySession({
            weekN, day: qual2Day,
            distKm: Math.max(roundDist(qualKmPerSession * secondaryFraction), minDist.secondary_quality),
            metric, zones, pace,
            catalogueRow: cat2, phase, fitness: intensityFitness, isDeload, goalPace,
            goalPaceWeek, distLabel: distKey, cueCtx,
          })
          used.push(qual2Day)
        }
      }
    }
  }

  // ── 3. Strength ───────────────────────────────────────────────────────────
  const strengthPreferred: Day[][] = [['mon', 'fri', 'sat'], ['fri', 'sat', 'mon']]
  let strengthPlaced = 0
  for (let s = 0; s < Math.min(adjStrength, 2) && used.length < daysAvailable; s++) {
    const strDay = firstAvailableDay(strengthPreferred[s] ?? strengthPreferred[0], blocked, used)
    if (strDay) {
      sessions[strDay] = strengthSession(weekN, strDay)
      used.push(strDay)
      strengthPlaced++
    }
  }

  // ── 4. Easy runs (fill remaining slots) ───────────────────────────────────
  // Re-derive easyKm based on ACTUAL remaining slots and remaining volume.
  // Why re-derive: the upfront easyKm assumed all planned quality/strength
  // slots would be placed. When one fails (e.g. qual2 with no eligible day),
  // the freed slot is filled by an easy run — and the freed volume should
  // flow to that easy run, not be lost.
  //
  // Constraints (CoachingPrinciples §9):
  //   • Floor: every placed easy session is at least MIN_SESSION_DISTANCE_KM.easy.
  //     Below this, the session is too short to be coaching-meaningful.
  //   • Ceiling: easy must not exceed longKm / LONG_RUN_MIN_RATIO_VS_EASY —
  //     the long run is always the longest run of the week. If the freed volume
  //     would invert this, cap easy at the ratio limit and let the week run
  //     slightly under target volume rather than break the principle.
  //
  // The floors are self-consistent: minDist.long / minRatio = 5/1.25 = 4 =
  // minDist.easy, so the cap and floor never collide.
  const remainingSlots = daysAvailable - used.length
  // DELOAD-INVERSION-01 part 2b — how many easy runs to actually place. Normally
  // all remaining slots; for an INJURY-CAPPED week it is trimmed to what the
  // ceiling supports (below), dropping the excess to rest days.
  let easyToPlace = remainingSlots
  // Hoisted so the Stage B budget-weighted redistribution below can read them
  // (they were block-locals when the easy split was uniform).
  let remainingVolume = 0
  let easyCap = Infinity
  if (remainingSlots > 0) {
    // Mirror sumWeeklyKm: distance metric reads distance_km; duration metric
    // converts duration_mins back to km via easy pace. Strength has no volume.
    const placedKm = Object.values(sessions).reduce((sum, s) => {
      if (!s || s.type === 'strength' || s.type === 'rest') return sum
      return sum + sessionKmOrZero(s, pace.minPerKmEasy)
    }, 0)
    remainingVolume = Math.max(0, weeklyKm - placedKm)
    // DELOAD-INVERSION-01 part 2b (§12, Coaching Board 2026-09-06) — on an
    // injury-capped week the injury cap is a DELIVERED ceiling. The long run
    // (§52-protected) and count-capped quality are already placed; flooring EVERY
    // remaining easy slot at minDist.easy over-sums a low budget and breaks the
    // cap at delivery (the +36% sawtooth). So cap the NUMBER of easy runs to what
    // the ceiling budget supports at the floor, dropping the rest to rest days —
    // a reduced-but-whole week (McMillan), never the long run (§52). At least one
    // easy run is always kept so the week is not just long + quality. Healthy
    // weeks are untouched (Hutchinson scope): they keep all slots and may run
    // slightly over, which §52 already governs as lopsided → maintenance.
    if (injuryVolumeCapped) {
      const supported = Math.max(1, Math.floor(remainingVolume / minDist.easy))
      easyToPlace = Math.min(remainingSlots, supported)
    }
    // Cap rounded DOWN so post-round easyKm cannot exceed longKm/minRatio.
    // (roundDist uses round-nearest and could otherwise lift easy across the cap,
    // breaking the long-vs-easy invariant by 0.5 km on the boundary.)
    easyCap = Math.floor((longKm / minRatio) / precision) * precision
    const naturalRounded = roundDist(remainingVolume / Math.max(1, easyToPlace))
    easyKm = Math.max(Math.min(naturalRounded, easyCap), minDist.easy)
  }

  // Day-spacing heuristic: at each step, pick the candidate day whose minimum
  // gap to ANY already-used day is largest. Spreads runs across the week
  // instead of stacking them. (Bug fix: prior version filled in fixed
  // easyPreferred order, producing back-to-back runs when blocked days
  // narrowed the candidate pool — e.g. tue+thu blocked → fri/sat/sun consecutive.)
  // Place `easyToPlace` easy runs (all remaining slots, unless an injury-capped
  // week trimmed the count above). Unused days stay rest — a reduced-but-whole
  // week on a capped week (§12/§52, DELOAD-INVERSION-01).
  // Collect the easy days first (same max-spacing selection), THEN size them —
  // so Stage B can water-fill the fixed easy volume across them by budget. The
  // selection is identical to the old in-loop placement: spacing is scored
  // against the days already taken (used ∪ easy-days-so-far).
  const easyDays: Day[] = []
  while (easyDays.length < easyToPlace && (used.length + easyDays.length) < daysAvailable) {
    const taken: Day[] = [...used, ...easyDays]
    const candidates = DAY_ORDER.filter(d => !blocked.has(d) && !taken.includes(d))
    if (candidates.length === 0) break
    let best: Day = candidates[0]
    let bestScore = -1
    for (const c of candidates) {
      const score = taken.length === 0 ? 7 : Math.min(...taken.map(u => dayGap(c, u)))
      if (score > bestScore) {
        bestScore = score
        best = c
      }
    }
    easyDays.push(best)
  }

  // UX-WIZARD-01 Stage B item 4 — REDISTRIBUTION. Without per-day budgets every
  // easy day gets the uniform `easyKm` exactly as before (byte-identical,
  // verify:parity). With them, water-fill the same fixed easy volume across the
  // days weighted by each day's room, so a roomy day absorbs what a tight day
  // cannot hold instead of that volume being trimmed away. The per-day ceiling
  // is min(§9 long-vs-easy cap, this day's budget in km); weekends carry no
  // weekday cap and are bounded by §9 alone. The weekly total is unchanged.
  let easyKmForDay: (d: Day) => number = () => easyKm
  if (input.day_budgets && easyDays.length > 0) {
    const weekdayKeys = new Set<Day>(['mon', 'tue', 'wed', 'thu', 'fri'])
    const ceilOf = (d: Day): number => {
      const budgetMin = weekdayKeys.has(d)
        ? (input.day_budgets?.[d as 'mon' | 'tue' | 'wed' | 'thu' | 'fri'] ?? input.max_weekday_mins)
        : undefined
      const budgetKm = budgetMin != null && pace.minPerKmEasy > 0 ? budgetMin / pace.minPerKmEasy : Infinity
      return Math.min(easyCap, budgetKm)
    }
    const km = waterFillEasyKm(easyDays.map(ceilOf), remainingVolume, minDist.easy, precision)
    const byDay = new Map<Day, number>(easyDays.map((d, i) => [d, km[i]]))
    easyKmForDay = (d) => byDay.get(d) ?? easyKm
  }

  for (const d of easyDays) {
    sessions[d] = easySession(weekN, d, easyKmForDay(d), metric, zones, pace)
    used.push(d)
  }

  // ── 4a. Recalibration time trial (CoachingPrinciples §78) ─────────────────
  // Deload weeks in base/build carry the benchmark the week's theme has always
  // promised. Runs before strides so the converted session is no longer type
  // 'easy' and can't also pick up a stride note.
  const isRecalibrationWeek = isDeload && (phase === 'base' || phase === 'build')
  if (isRecalibrationWeek) {
    applyRecalibrationTimeTrial(sessions, longDay, zones, pace)
  }

  // ── 4b. Strides on a midweek easy run (CoachingPrinciples §28) ────────────
  // From W3 onwards (skip race week and deloads), pick a midweek easy session
  // that is NOT the day before the long run, NOT the day after a quality, and
  // append "4×20s strides at 5K effort, full recovery" as a coach note. This
  // preserves neuromuscular sharpness without adding fatigue.
  // BUG-FIX-STRIDES: weekN > 0 guards against foundation weeks (weekN ≤ 0).
  // The STRIDES_FIRST_WEEK (≥3) check already implies this for correctly-numbered
  // weeks, but the explicit guard prevents misfire if a future caller passes a
  // foundation-week weekN into this function.
  if (weekN > 0
      && weekN >= GENERATION_CONFIG.STRIDES_FIRST_WEEK
      && !isRaceWeek
      && !isDeload) {
    // §28 + §28 Am.1 — placement delegates to `lib/plan/neuromuscular.ts`, which
    // the INVARIANT also calls. The eligibility rule used to live only here, and
    // when the invariant re-derived it the two disagreed on 2-day plans: 12 cases
    // in the property sweep, invisible to both cohort grids.
    const carrier = strideCarrierDay(sessions, longDay, blocked)
    if (carrier) {
      const s = sessions[carrier]!
      const note = neuromuscularNote(weekN, input.fitness_level, input.injury_history)
      const e0 = s.coach_notes?.[0]
      const e1 = s.coach_notes?.[1]
      s.coach_notes = e0 && e1 ? [e0, e1, note] : e0 ? [e0, note] : [note]
      // STRIDE-VISIBILITY-01 (SLT) — the label names what the session contains.
      // Derived HERE, where "strides were placed" is a structural fact, never
      // re-parsed from the string afterwards (D-17).
      if (s.label) s.label = neuromuscularLabel(s.label, weekN, input.fitness_level, input.injury_history)
    }
  }

  // ── 5. Honour max_weekday_mins constraint ────────────────────────────────
  applyWeekdayMinsCap(sessions, input)

  return sessions
}

/**
 * CoachingPrinciples — "Life-first, plan-second". The user's stated weekday time
 * limit is a hard cap. If a session placed on a weekday exceeds it, reduce
 * duration to the cap and proportionally reduce distance (pace stays constant).
 * Accepts a slightly lower total weekly volume in exchange for honouring the
 * user's schedule reality. Long runs are typically on weekends so are usually
 * unaffected; if a user picks a weekday long run and the cap would force it
 * below the long-vs-easy invariant, the cap still wins — life > coaching ratio.
 *
 * Enforced by INV-PLAN-MAX-WEEKDAY-MINS.
 *
 * Extracted to a named helper (2026-09-03) because the race-week branch of
 * `buildWeekSessions` returns early and so never reached the inline version.
 * Race-week shakeouts are bounded only by RACE_WEEK_SHAKEOUT_MAX_MINS (35), so
 * a runner with a 30-minute weekday limit shipped a 35-minute weekday shakeout
 * — a live constitutional violation, soft-degraded to console.error in prod.
 * It also broke enrichment: the post-enrich re-validation in
 * app/api/generate-plan/route.ts read the engine's own violation as one the AI
 * had introduced and discarded every enriched plan. Both callers must run this.
 *
 * The race itself is exempt (`type === 'race'`) — a race is an external fixed
 * event, not a training session the runner scheduled around their weekday.
 */
function applyWeekdayMinsCap(
  sessions: Partial<Record<Day, Session>>,
  input: GeneratorInput,
  isRaceWeek = false,
): void {
  // UX-WIZARD-01 Stage B — the cap is now PER-DAY. Each weekday is trimmed to
  // its OWN budget (`day_budgets[day]`), falling back to the single
  // `max_weekday_mins` where a day has no explicit budget. When `day_budgets` is
  // absent every day resolves to `max_weekday_mins`, i.e. exactly the old
  // single-cap behaviour — byte-identical (verify:parity). Placement (below, at
  // the quality-day selection) puts the un-trimmable structured session on the
  // day whose budget can hold it, so this per-day trim mostly touches easy runs.
  const budgets = input.day_budgets
  if (input.max_weekday_mins == null && budgets == null) return
  const weekdays: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri']
  for (const day of weekdays) {
    const cap = budgets?.[day as 'mon' | 'tue' | 'wed' | 'thu' | 'fri'] ?? input.max_weekday_mins
    if (cap == null) continue
    const s = sessions[day]
    if (!s || !s.duration_mins || s.duration_mins <= cap) continue
    if (s.type === 'strength' || s.type === 'rest' || s.type === 'race') continue
    // MWM-02 (Coaching Board, 2026-09-03) — THE LONG RUN IS EXEMPT.
    //
    // Squeezing it to the weekday cap does not honour §18, it deforms the week:
    // a long run cut to 30 minutes alongside two 30-minute easy runs is not a
    // long run, and the label then lies to the runner. Measured: capping it
    // traded 1,615 §18 breaches for 979 §9 breaches (+511 LONG-IS-LONGEST,
    // +468 MIN-SESSION-SIZE). The board VETOED that trade — "don't shrink to
    // fit" (Hutchinson, McMillan, Willy, independently).
    //
    // The remedy is honesty, not deformation: where the long run cannot fit the
    // runner's stated availability the plan SAYS SO and classifies maintenance
    // (§52's third remedy, §40c's "a suppressed target is stated, never absorbed
    // silently"). See CoachingPrinciples §81.
    // §81 — the long run AND any structured session are exempt. For the long
    // run, capping stops it being the longest run of the week. For a structured
    // session the failure is worse: the cap scales distance/duration but NOT
    // `derived_set`, so the work is unchanged and only the stated duration
    // moves. See isStructuredSession for the measured case.
    if (isLongRun(s) || isStructuredSession(s)) continue
    const originalDurationMins = s.duration_mins
    const ratio = cap / originalDurationMins
    const cappedDistance = s.distance_km != null ? roundDistance(s.distance_km * ratio) : undefined

    // §82 (Coaching Board, 2026-09-03) — EASY RUNS ARE FLOOR-PROTECTED.
    //
    // §81 draws the line: an easy run's prescription IS its distance and
    // duration, so (unlike the long run or a structured session) the cap
    // applies to it "normally" — scaled. But the ratio can scale it below
    // MIN_SESSION_DISTANCE_KM.easy, §9's own floor for "too short to be
    // coaching-meaningful" (measured: at max_weekday_mins=30 this lands at
    // 3.5km against a 4km floor, ~5% of the widened sweep). Where the ratio
    // would cross the floor, hold the session at the floor instead and let
    // its duration follow at the runner's own easy pace — the stated weekday
    // cap is exceeded by a few minutes, not honoured by a session that trains
    // nothing. §52b's day-count remedy already ran before this session was
    // placed, so this is the fallback once the day count is already minimal
    // for the runner's volume, not a substitute for it.
    //
    // Race week is exempt from floor protection, mirroring
    // INV-PLAN-MIN-SESSION-SIZE's own `isRaceWeek && type === 'easy'`
    // exemption (§30) — a shakeout or race-week easy run is DELIBERATELY
    // short (taper intent), never "too short to be coaching-meaningful".
    // Without this, the shakeout cap (RACE_WEEK_SHAKEOUT_MAX_MINS, 35) got
    // overridden by the floor and a 30-minute-capped runner got a 56-minute
    // "shortened" shakeout — the opposite of §30's intent.
    const floorKm = sessionFloorsFor(input.longest_recent_run_km).easy
    if (!isRaceWeek && s.type === 'easy' && cappedDistance != null && cappedDistance < floorKm && s.distance_km) {
      const paceMinPerKm = originalDurationMins / s.distance_km
      s.distance_km = floorKm
      s.duration_mins = Math.round(floorKm * paceMinPerKm)
      s.floor_protected = true
    } else {
      s.duration_mins = cap
      if (cappedDistance != null) s.distance_km = cappedDistance
    }
  }
}

// MWM-02 postscript — the final cap pass was removed and later restored.
// Full history is at the call site in generateRulePlan: it was a measured no-op
// while only the long run was exempt, and became load-bearing the moment §81
// was extended to structured sessions.

/**
 * UX-WIZARD-01 Stage B — REDISTRIBUTION. Distribute a fixed easy-volume pool
 * across the week's easy days weighted by each day's ceiling, so roomy days
 * absorb what tight days cannot hold instead of that volume being trimmed away.
 *
 * Water-filling, not proportional: the pool fills the lowest days first, so a
 * tight day sits at its ceiling and the surplus flows to days with room — which
 * is the whole point (Tuesday 30 caps out; Thursday 90 takes the rest). The
 * WEEKLY TOTAL is preserved (§2 curve unchanged); any residual that no day can
 * hold is un-fittable and the week honestly runs under, exactly as today. Each
 * ceiling already folds in §9's long-vs-easy cap, so no easy run can reach the
 * long run. Returns one km per input day, precision-rounded and clamped under
 * its ceiling so rounding can never lift a day over its budget or the §9 cap.
 */
function waterFillEasyKm(ceils: number[], total: number, floorKm: number, precision: number): number[] {
  const n = ceils.length
  if (n === 0) return []
  // Base everyone at the floor (a placed easy run is never below MIN_SESSION;
  // the §82 floor-protection in applyWeekdayMinsCap owns the sub-budget case).
  const assign = ceils.map(() => floorKm)
  let remaining = total - floorKm * n
  for (let guard = 0; guard < n + 2 && remaining > 1e-6; guard++) {
    const active = assign.map((a, i) => (a < ceils[i] - 1e-9 ? i : -1)).filter(i => i >= 0)
    if (active.length === 0) break
    const share = remaining / active.length
    let moved = 0
    for (const i of active) {
      const add = Math.min(share, ceils[i] - assign[i])
      assign[i] += add
      moved += add
    }
    remaining -= moved
    if (moved <= 1e-9) break
  }
  return assign.map((a, i) => {
    const rounded = Math.round(a / precision) * precision
    const ceilRounded = Math.floor(ceils[i] / precision) * precision
    return Math.max(floorKm, Math.min(rounded, ceilRounded))
  })
}

// ─── Week metadata ────────────────────────────────────────────────────────────

/**
 * What a week actually contains. CoachingPrinciples §27 — copy is chosen from
 * this, never from the phase name alone.
 *
 * The 2026-08-06 incident (analysis F4): `weekLabel` and `weekTheme` were pure
 * functions of `(phase, index)` and never saw `sessions`, so a beginner — for
 * whom QUALITY_SESSIONS_PER_WEEK_MAX is 0 by design — was told "Build — first
 * quality session" over three easy runs, for fourteen weeks. The §27 guards
 * bolted onto the call site patched the peak and taper symptoms and left the
 * build case, because they were written as string exceptions rather than as a
 * rule about where copy comes from.
 */
interface WeekContent {
  phase:        PhaseType
  phaseWeekN:   number   // 1-indexed within the phase
  isDeload:     boolean
  isRaceWeek:   boolean
  hasQuality:   boolean  // a prescribed quality/intervals session
  hasBenchmark: boolean  // §78 recalibration time trial
  isVolumePeak: boolean  // highest weekly_km of any non-deload week so far
}

function summariseWeek(
  sessions: Partial<Record<Day, Session>>,
  phase: PhaseType,
  phaseWeekN: number,
  isDeload: boolean,
  isRaceWeek: boolean,
  isVolumePeak: boolean,
): WeekContent {
  const values = Object.values(sessions)
  return {
    phase, phaseWeekN, isDeload, isRaceWeek, isVolumePeak,
    hasQuality:   values.some(s => s?.type === 'quality' || s?.type === 'intervals' || s?.type === 'tempo'),
    hasBenchmark: values.some(s => s?.type === 'hard'),
  }
}

// Copy is paired with the content that makes it true. Every string promising
// intensity lives only in a `withQuality` list; every list is safe for any week
// that satisfies its key. Adding copy here means answering "what must be in the
// week for this to be honest?" — which is the whole point.
const WEEK_LABELS: Record<PhaseType, { withQuality: string[]; easyOnly: string[] }> = {
  base: {
    withQuality: ['Base — first quality session', 'Base — adding a little sharpness'],
    easyOnly:    ['Base — easy start', 'Base — building consistency', 'Base — aerobic development', 'Base — aerobic discipline'],
  },
  build: {
    withQuality: ['Build — first quality session', 'Build — extending the work', 'Build — raising the ceiling', 'Build — holding the work'],
    easyOnly:    ['Build — building the engine', 'Build — extending the long run', 'Build — aerobic volume', 'Build — consistency'],
  },
  peak: {
    withQuality: ['Peak — highest volume', 'Peak — second peak week', 'Peak — sharpening'],
    easyOnly:    ['Peak — consistency', 'Peak — holding the volume', 'Peak — steady'],
  },
  taper: {
    withQuality: ['Taper — trust the work', 'Taper — sharpening', 'Taper — final cut'],
    easyOnly:    ['Taper — trust the work', 'Taper — winding down', 'Taper — final cut'],
  },
}

function weekLabel(c: WeekContent): string {
  if (c.isRaceWeek) return 'Race week'
  if (c.isDeload) {
    return c.hasBenchmark ? `${capitalise(c.phase)} — recovery + benchmark` : `${capitalise(c.phase)} — recovery week`
  }
  // "highest volume" is a claim about the plan, not just the week.
  if (c.phase === 'peak' && !c.isVolumePeak) {
    const opts = WEEK_LABELS.peak.easyOnly
    return opts[Math.min(c.phaseWeekN - 1, opts.length - 1)]
  }
  const opts = c.hasQuality ? WEEK_LABELS[c.phase].withQuality : WEEK_LABELS[c.phase].easyOnly
  return opts[Math.min(c.phaseWeekN - 1, opts.length - 1)]
}

function weekTheme(c: WeekContent): string {
  if (c.isRaceWeek) return 'The work is done. Arrive rested.'
  if (c.isDeload) {
    return c.hasBenchmark
      ? 'Deload week. One hard effort in the middle — log the result and your zones refresh for the next block.'
      : 'Adaptation happens in recovery. This week counts.'
  }
  switch (c.phase) {
    case 'base':
      return 'HR discipline. Slower than feels right. That is correct.'
    case 'build':
      return c.hasQuality
        ? 'One quality session. Everything else stays easy.'
        : 'Aerobic volume. The work is showing up, not going hard.'
    case 'peak':
      if (c.hasQuality && c.isVolumePeak) return 'This is where the fitness is built. It will feel hard. That is correct.'
      return 'Consistency. The work is the volume.'
    case 'taper':
      return c.hasQuality
        ? 'Volume drops. Intensity stays. Trust the work you have done.'
        : 'Volume drops. Trust the work you have done.'
  }
}

/**
 * CoachingPrinciples §27 — re-derive a week's copy when the sessions beneath it
 * have changed and the existing copy has become false.
 *
 * The reshaper (R20) downgrades quality sessions to easy — "aerobic efficiency
 * trending down" — and never touched `label` / `theme`, so a week could keep
 * "Build — first quality session" over four easy runs. That is F4 recurring
 * through the reshape path rather than at generation (analysis open-Q4).
 *
 * Deliberately surgical: it rewrites ONLY when the current copy claims something
 * the week no longer contains. Enriched copy is Kit's voice and a paid
 * deliverable — blanket-refreshing every reshaped week would silently revert
 * trial/paid users to rule-engine strings. A lie gets replaced; a voice does not.
 *
 * Returns true when the copy was rewritten.
 */
export function refreshWeekCopyIfStale(plan: Plan, weekN: number): boolean {
  const idx = plan.weeks.findIndex(w => w.n === weekN)
  if (idx < 0) return false
  const w = plan.weeks[idx]
  const phase = w.phase
  // Foundation and maintenance weeks are generated elsewhere with their own copy.
  if (!phase || phase === 'foundation' || phase === 'maintenance_restoration' || phase === 'maintenance_base') {
    return false
  }

  const hasIntensity = Object.values(w.sessions).some(
    x => x?.type === 'quality' || x?.type === 'intervals' || x?.type === 'tempo')
  const hasBenchmark = Object.values(w.sessions).some(x => x?.type === 'hard')
  const copy = `${w.label ?? ''} | ${w.theme ?? ''}`.toLowerCase()

  const claimsIntensity = /quality|threshold|tempo|interval|vo2|sharpen|raising the ceiling|intensity stays|feels? hard/.test(copy)
  const claimsBenchmark = /benchmark|time trial/.test(copy)

  const copyIsStale = (claimsIntensity && !hasIntensity && !hasBenchmark)
    || (claimsBenchmark && !hasBenchmark)
  if (!copyIsStale) return false

  let phaseWeekN = 0
  for (let i = 0; i <= idx; i++) if (plan.weeks[i].phase === phase) phaseWeekN++

  let prevNonDeloadKm = 0
  for (let j = idx - 1; j >= 0; j--) {
    if (plan.weeks[j].type !== 'deload') { prevNonDeloadKm = plan.weeks[j].weekly_km; break }
  }
  const isVolumePeak = plan.meta.volume_profile !== 'maintenance' && w.weekly_km > prevNonDeloadKm

  const content = summariseWeek(
    w.sessions, phase as PhaseType, phaseWeekN,
    w.type === 'deload', w.type === 'race', isVolumePeak,
  )
  w.label = weekLabel(content)
  w.theme = weekTheme(content)
  return true
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function computeLongRunHrs(sessions: Partial<Record<Day, Session>>, pace: PaceGuide): number | null {
  for (const session of Object.values(sessions)) {
    if (session != null && isLongRun(session)) {
      const mins = session.duration_mins ?? (session.distance_km ? session.distance_km * pace.minPerKmEasy : null)
      if (mins) return Math.round((mins / 60) * 10) / 10
    }
  }
  return null
}

function sumWeeklyKm(sessions: Partial<Record<Day, Session>>, pace: PaceGuide): number {
  let total = 0
  for (const s of Object.values(sessions)) {
    if (!s || s.type === 'strength' || s.type === 'rest') continue
    total += sessionKmOrZero(s, pace.minPerKmEasy)
  }
  return Math.round(total)
}

/**
 * §6 Amendment 1 — cap each taper week's long run at the peak phase's long run.
 *
 * Reduces DISTANCE and re-derives duration through the same easy pace the week
 * was sized with, then restates `weekly_km` from the sessions (§90's "the runner
 * sees sumWeeklyKm, not the curve").
 *
 * ⚠️ NEVER reduces below the point where the long run stops being the longest
 * run of the week. §9's ratio (`LONG_RUN_MIN_RATIO_VS_EASY`) still binds, and a
 * cap that satisfied §6 by breaking §9 would be trading one inversion for
 * another. Where both cannot hold, §9 wins and the residual is left — the same
 * honest-residual pattern §34 sets.
 */
function applyTaperLongRunCap(weeks: Week[], pace: PaceGuide): void {
  const peakLr = Math.max(0, ...weeks
    .filter(w => w.n > 0 && w.phase === 'peak' && w.type !== 'deload' && w.type !== 'race')
    .map(w => {
      const s = Object.values(w.sessions).find(sn => sn && isLongRun(sn))
      return s ? sessionKmOrZero(s, pace.minPerKmEasy) : 0
    }))
  if (peakLr <= 0) return

  const tol = GENERATION_CONFIG.TAPER_LR_VS_PEAK_TOLERANCE_KM
  const ratio = GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY

  for (const w of weeks) {
    if (w.n <= 0 || w.phase !== 'taper' || w.type === 'race') continue
    const entry = (Object.entries(w.sessions) as [Day, Session | undefined][])
      .find(([, sn]) => sn && isLongRun(sn))
    if (!entry) continue
    const [day, long] = entry
    if (!long || long.distance_km == null) continue
    if (long.distance_km <= peakLr + tol) continue

    // §9's floor: the long run must stay at least `ratio` times the longest
    // other run in the week, or capping §6's inversion creates §9's.
    const longestOther = Math.max(0, ...(Object.entries(w.sessions) as [Day, Session | undefined][])
      .filter(([d, sn]) => d !== day && !!sn && sn.type !== 'rest' && sn.type !== 'strength')
      .map(([, sn]) => sessionKmOrZero(sn!, pace.minPerKmEasy)))
    const floorFromRatio = longestOther * ratio
    const capped = Math.max(peakLr, floorFromRatio)
    if (capped >= long.distance_km) continue

    const rounded = roundDistance(capped)
    w.sessions[day] = {
      ...long,
      distance_km: rounded,
      duration_mins: dur(rounded, pace.minPerKmEasy),
    }
    w.weekly_km = sumWeeklyKm(w.sessions, pace)
  }
}

/**
 * §6 Amendment 2 — re-anchor the taper's DELIVERED volume on the DELIVERED
 * pre-taper week (Coaching Board TAPER-DEPTH-02, 2026-09-15).
 *
 * WHY THIS EXISTS, stated precisely, because the first diagnosis was wrong.
 * The taper was filed as "barely reduces". It does not. The taper curve is
 * correct and the taper delivers it — delivered/curve runs 0.99-1.02 across
 * every traced case, the best-delivered phase in the plan. What fails is the
 * PEAK phase, which delivers 0.70-0.90 of its own curve because the long run is
 * pinned at LONG_RUN_CAP_MINUTES and the easy runs are pinned by §9's ratio.
 * §23/CD-10 ACCEPTS that — the caps do not move. This pass prices the
 * consequence nobody had: anchoring the taper on the INTENDED peak lets an
 * accepted structural limit silently delete the taper. Worst measured, an HM
 * plan peaking at 45.5 km with a first taper week of 44.5.
 *
 * The lever order is ADR-022's, already ratified: **easy runs trim, the §52 long
 * run never does, and a quality session is never touched** — §6 keeps intensity
 * and cuts volume, so trimming the taper's quality session would invert the
 * principle it is enforcing. §9's LONG_RUN_MIN_RATIO_VS_EASY cannot be broken
 * here by construction: trimming easy runs only ever increases the long run's
 * margin over them.
 *
 * Where MIN_SESSION_DISTANCE_KM.easy binds before the target is reached, the
 * remainder is LEFT and declared — §34's honest residual, and Willy's condition
 * at the sitting ("a 3 km easy run is not a session, it is an apology").
 *
 * Mirrors buildVolumeSequence's own taper arithmetic exactly (same anchor index,
 * same LOW_VOLUME_TAPER_REDUCTION_FACTOR_PCT branch, same per-step division) so
 * the curve and the delivered target cannot disagree about what §6 asks for —
 * D-16.
 */
function applyTaperDeliveredDepth(
  weeks: Week[], pace: PaceGuide, peakKm: number, raceDistanceKm: number,
  floors: SessionFloors,
): void {
  const taperWeeks = weeks.filter(w => w.n > 0 && w.phase === 'taper' && w.type !== 'race')
  if (taperWeeks.length === 0) return

  const firstTaperN = Math.min(...taperWeeks.map(w => w.n))
  const anchorWeek = weeks.find(w => w.n === firstTaperN - 1)
  if (!anchorWeek) return

  // FULL PRECISION on both sides. `sumWeeklyKm` Math.round's to whole km, and
  // measuring the gate against rounded totals silently shrinks it: one HM case
  // computed a 0.94 km excess from 25 and 22 where the true figures are 24.5 and
  // 22.0 and the excess is 1.36 — 3.8% of the anchor against 5.6%, so the trim
  // was skipped and INV-PLAN-TAPER-DELIVERED-DEPTH, which measures unrounded,
  // fired on a week the pass had decided to leave. A producer and its checker
  // must agree on the unit before they can agree on anything else (D-16).
  const exactWeekKm = (w: Week): number => {
    let total = 0
    for (const sn of Object.values(w.sessions)) {
      if (!sn || sn.type === 'strength' || sn.type === 'rest') continue
      total += sessionKmOrZero(sn, pace.minPerKmEasy)
    }
    return total
  }

  const anchorKm = exactWeekKm(anchorWeek)
  if (anchorKm <= 0) return

  const distKey = raceDistanceKey(raceDistanceKm)
  const taperConfig = GENERATION_CONFIG.TAPER_BY_DISTANCE[distKey]
  const fullTaperWeeks = Math.max(1, GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK[distKey].length - 1)
  const reductionFull = peakKm < GENERATION_CONFIG.LOW_VOLUME_TAPER_THRESHOLD_KM
    ? taperConfig.volume_reduction_pct * (GENERATION_CONFIG.LOW_VOLUME_TAPER_REDUCTION_FACTOR_PCT / 100)
    : taperConfig.volume_reduction_pct
  const stepPct = reductionFull / fullTaperWeeks
  const easyFloorKm = floors.easy
  const gatePct = GENERATION_CONFIG.TAPER_DELIVERED_REANCHOR_MATERIAL_PCT

  for (const w of taperWeeks) {
    const curveTarget = anchorKm * (1 - (stepPct * (w.n - firstTaperN + 1)) / 100)

    // §52 IS A HARD FLOOR ON THE TRIM, and it is an `error`-severity invariant
    // (INV-PLAN-LR-MAX-WEEKLY-PCT), not advice. The long run is never trimmed
    // here, so shrinking the easy runs raises its SHARE — and a first version of
    // this pass drove 112 cohort plans past the 60% cap and made them throw.
    // The week may not be cut below the point where the long run would breach
    // it. Where that binds before §6's target, the remainder is LEFT and
    // declared (§34) — the same treatment Willy's session-floor condition gets.
    let longKm = 0
    for (const sn of Object.values(w.sessions)) {
      if (!sn || !isLongRun(sn)) continue
      longKm = Math.max(longKm, sessionKmOrZero(sn, pace.minPerKmEasy))
    }
    const lrFloorKm = longKm > 0
      ? longKm / (GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_WEEKLY / 100)
      : 0
    const target = Math.max(curveTarget, lrFloorKm)

    const delivered = exactWeekKm(w)
    if (delivered <= target) continue
    // Materiality in PERCENTAGE POINTS OF THE ANCHOR — "how much of the promised
    // cut evaporated", not "how big is this week".
    if (((delivered - target) / anchorKm) * 100 < gatePct) continue

    let excess = delivered - target
    const easies = (Object.entries(w.sessions) as [Day, Session | undefined][])
      .filter(([, s]) => !!s && s.type === 'easy' && !isLongRun(s))
      .sort((a, b) =>
        sessionKmOrZero(b[1]!, pace.minPerKmEasy) - sessionKmOrZero(a[1]!, pace.minPerKmEasy))

    for (const [day, session] of easies) {
      if (excess <= 0) break
      const km = sessionKmOrZero(session!, pace.minPerKmEasy)
      const room = km - easyFloorKm
      if (room <= 0) continue
      // ROUNDS UP, not to nearest. `roundDistance` can round a 4.7 km target
      // down to 4.5 and take 0.2 km MORE than asked for; compounded across a
      // week's easy runs that pushed 24 cohort plans past §52's 60% long-run cap
      // even with the floor above computed correctly. Ceiling to the same
      // DISTANCE_ROUNDING_PRECISION_KM grid means this pass can undershoot §6's
      // target but can never breach a floor it was given.
      const precision = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
      const newKm = Math.ceil((km - Math.min(room, excess)) / precision) * precision
      if (newKm >= km) continue
      w.sessions[day] = session!.distance_km != null
        ? { ...session!, distance_km: newKm, duration_mins: dur(newKm, pace.minPerKmEasy) }
        : { ...session!, duration_mins: dur(newKm, pace.minPerKmEasy) }
      excess -= km - newKm
    }
    w.weekly_km = sumWeeklyKm(w.sessions, pace)
  }
}

// CoachingPrinciples §47 — peak long-run alternation. Applied as a post-pass so
// the per-week loop stays simple. Walks peak-phase weeks from last to first and
// marks every other one as a step-back: drop race-pace catalogue specificity,
// reduce LR distance to ≤ PEAK_LR_STEPBACK_MAX_PCT of the peak-level distance,
// and rewrite the label / coach notes to a generic long run.
/**
 * Returns the week numbers it actually STEPPED BACK.
 *
 * STEPBACK-STALE-PEAK-01 — §47 sizes the step-back as a ratio of the peak long
 * run IT CAN SEE, and `applyLongRunProgressionCap` runs afterwards and can trim
 * that peak, so the ratio ends up measured against a number that no longer
 * exists (measured: a 166-minute step-back against a final peak of 206, 80.6%
 * against §47's 80% bound).
 *
 * ⚠️ THE SET IS RETURNED RATHER THAN RE-DERIVED, because a naive re-clamp was
 * tried and reverted: treating every SUB-PEAK week as a step-back breaks §35
 * and §24. Only the weeks this function chose are step-backs, and only this
 * function knows which those are — the §47 exception, the deload interaction
 * and the alternation parity all feed that choice.
 */
function applyPeakLongRunAlternation(
  weeks: Week[],
  pace: PaceGuide,
  input: GeneratorInput,
): Set<number> {
  const steppedBack = new Set<number>()
  const peakWeekIdxs: number[] = []
  for (let i = 0; i < weeks.length; i++) {
    if (weeks[i].phase === 'peak' && weeks[i].type !== 'deload') peakWeekIdxs.push(i)
  }
  if (peakWeekIdxs.length < 2) return steppedBack  // single peak week — nothing to alternate

  // Find max peak-level LR distance to anchor the step-back fraction.
  const longRunOf = (w: Week): { day: Day; session: Session } | null => {
    for (const [d, s] of Object.entries(w.sessions) as [Day, Session | undefined][]) {
      if (s && isLongRun(s)) {
        return { day: d, session: s }
      }
    }
    return null
  }
  // §47 + §80 (PEAK-LR-STEPBACK-MINUTES-01, Coaching Board 2026-09-13) — the peak
  // anchor is computed on BOTH axes, because a plan is anchored on one of them
  // and a beginner's is minutes.
  //
  // `peakMaxLrKm` alone used to decide this, via `distance_km ?? 0`. On a
  // duration-anchored plan every peak long run reads 0, so `peakMaxLrKm <= 0`
  // was unconditionally true and the function returned before doing anything:
  // **a beginner never received a peak long-run step-back week at all.** Willy:
  // denying the pre-taper recovery value purely because a runner's plan speaks
  // in minutes is the SESSION-KM silent-pass class, not a coaching choice.
  //
  // `duration_mins` is set by every long-run builder, so the minutes axis is
  // always complete; `distance_km` is present only when the plan is
  // distance-anchored. Both are computed and each step-back uses the axis its
  // own session is anchored on — never a conversion, which is what would put
  // one week reading "14 km" into a plan that otherwise speaks in minutes
  // (McMillan/Hutchinson: that breaks the runner's model of their own plan).
  const peakLrs = peakWeekIdxs
    .map(i => longRunOf(weeks[i]))
    .filter((l): l is { day: Day; session: Session } => l != null)
  const peakMaxLrKm   = Math.max(...peakLrs.map(l => l.session.distance_km  ?? 0), 0)
  const peakMaxLrMins = Math.max(...peakLrs.map(l => l.session.duration_mins ?? 0), 0)
  if (peakMaxLrKm <= 0 && peakMaxLrMins <= 0) return steppedBack

  // §47 only applies to weeks where the long run carries race-pace specificity
  // (MP-finish / HM-pace). Plans whose peak long runs are flat Zone 2 (5K, 10K,
  // and finish-goal HM/marathon) don't have the back-to-back overload risk —
  // they're aerobic, not specific. Skip alternation entirely if no peak LR has
  // race-pace segments.
  const labelHasRacePace = (label: string): boolean => {
    const l = label.toLowerCase()
    return l.includes('pace') || l.includes(' mp') || l.startsWith('mp') || l.includes('hm-pace')
  }
  const anyPeakIsRacePace = peakWeekIdxs.some(i => {
    const lr = longRunOf(weeks[i])
    return lr ? labelHasRacePace(lr.session.label ?? '') : false
  })
  if (!anyPeakIsRacePace) return steppedBack

  const stepBackMaxKm = peakMaxLrKm * (GENERATION_CONFIG.PEAK_LR_STEPBACK_MAX_PCT / 100)
  const exceptionEligible = input.hard_session_relationship === 'love'
    && (input.injury_history ?? []).length === 0
    && input.training_age === '5yr+'
  let exceptionUsed = false
  // Whether the week AFTER this one was left peak-level. We walk backwards, so
  // it has already been decided. ADJACENCY, not parity — see below.
  let laterWeekIsPeakLevel = false

  // Walk from the end (last peak = peak-level) backwards, stepping back any week
  // that would otherwise sit next to a peak-level one.
  //
  // ⚠️ THIS USED TO BE `offset % 2` — EVEN peak-level, ODD step-back — and the
  // parity was wrong the moment the exception fired (fixed 2026-09-16,
  // LONG-RUNWAY-EARNS-PLAN-01).
  //
  // The exception lets an eligible runner carry ONE back-to-back peak set. On a
  // two-week peak phase, consuming it at the single odd offset produced exactly
  // one adjacent pair and matched the invariant. On a THREE-week peak phase it
  // skipped the only step-back the parity scheduled, leaving all three weeks
  // peak-level and therefore TWO adjacent pairs — one more than §47 permits. The
  // checker counts pairs; the producer counted positions, and the two only agreed
  // while the phase was two weeks long.
  //
  // Found by the sweep when §97's amendment made three-week peak phases reachable
  // at HM (9 plans in 15,973, all `hard_session_relationship: 'love'` +
  // `training_age: '5yr+'` + no injury — the exception's own preconditions). The
  // defect is older than that change; the change is what made it reachable.
  //
  // Stated the way the invariant states it: a week is stepped back when the week
  // after it is peak-level. That is the same question `isPeakLevel(prev) &&
  // isPeakLevel(curr)` asks, so producer and checker can no longer disagree about
  // parity — there is no parity left to disagree about (§97's own lesson: a
  // scarce resource should be PLACED, not discovered by arithmetic).
  for (let offset = 0; offset < peakWeekIdxs.length; offset++) {
    const idx = peakWeekIdxs[peakWeekIdxs.length - 1 - offset]
    const w = weeks[idx]

    // No peak-level week directly after this one — nothing to alternate against.
    if (!laterWeekIsPeakLevel) {
      laterWeekIsPeakLevel = true
      continue
    }

    // Adjacent to a peak-level week. The eligible runner may carry ONE such pair.
    if (exceptionEligible && !exceptionUsed) {
      exceptionUsed = true
      laterWeekIsPeakLevel = true   // still peak-level: a later week must yield
      continue
    }

    const lr = longRunOf(w)
    if (!lr) continue

    // Which axis is THIS session anchored on? §80 — a duration-anchored session's
    // prescription IS its time on feet, so the step-back is expressed in minutes
    // and `distance_km` stays absent. Anything else writes a kilometre figure
    // into a plan that never speaks in kilometres.
    const durationAnchored = lr.session.distance_km == null
    const precision = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
  // CB-SUBFLOOR-ADMIT-01 — resolved FOR THIS RUNNER. Was the flat
  // GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.long, which re-floored the long
  // run straight back up to 5 km after the cap above had just bounded it.
    const minLong = sessionFloorsFor(input.longest_recent_run_km).long

    let flooredKm: number | null = null
    let flooredMins: number | null = null
    if (durationAnchored) {
      if (lr.session.duration_mins == null || peakMaxLrMins <= 0) continue
      // The same PEAK_LR_STEPBACK_MAX_PCT, applied to the axis the plan uses.
      // No new numeric: the minutes floor is the km floor converted through the
      // runner's own easy pace, so the two axes carry one policy.
      const stepBackMaxMins = peakMaxLrMins * (GENERATION_CONFIG.PEAK_LR_STEPBACK_MAX_PCT / 100)
      const minLongMins = dur(minLong, pace.minPerKmEasy)
      flooredMins = Math.max(Math.round(Math.min(lr.session.duration_mins, stepBackMaxMins)), minLongMins)
    } else {
      if (peakMaxLrKm <= 0) continue
      const newKm = Math.min(lr.session.distance_km!, stepBackMaxKm)
      flooredKm = Math.max(Math.floor(newKm / precision) * precision, minLong)
    }

    // This week is now a step-back, so the week BEFORE it has nothing to
    // alternate against and may stay peak-level. Set here rather than at the top
    // of the branch deliberately: every `continue` above leaves the week
    // peak-level, and the flag must still say so when the trim could not happen.
    laterWeekIsPeakLevel = false
    // STEPBACK-STALE-PEAK-01 — record the week so the post-cap re-clamp knows
    // which weeks §47 actually stepped back. Only these are step-backs; a week
    // merely below peak is not (§35, §24).
    steppedBack.add(w.n)

    // Rewrite the session: strip race-specific label, coach notes, and pace
    // segment fields; restore the standard "Long run — Zone 2" prescription.
    lr.session.label = 'Long run — Zone 2'
    lr.session.zone = 'Zone 2'
    if (durationAnchored) {
      lr.session.duration_mins = flooredMins!
    } else {
      lr.session.distance_km = flooredKm!
      lr.session.duration_mins = dur(flooredKm!, pace.minPerKmEasy)
    }
    lr.session.rpe_target = 4
    lr.session.coach_notes = ['Step-back week. Easy aerobic — let the legs absorb last week\'s peak before the next push.']
    delete (lr.session as any).lr_segment_pace
    // §47's own contract, one field late: "drop race-pace catalogue
    // specificity". It dropped the label, the zone, the notes and the segment
    // pace — and left `catalogue_id` pointing at `mp_long_run` /
    // `hm_pace_long_run` on a session it had just rewritten into a plain Zone 2
    // long run. ADR-018 makes that id the session→row join, so the plan was
    // carrying a row identity its prescription no longer matched.
    //
    // Latent rather than live TODAY, and the reason is worth recording: the one
    // surface that would render the MP segment (`composeSession`) derives
    // `isMpLong` from the LABEL, which §47 does rewrite. So the join is wrong and
    // nothing currently reads it wrongly — which is exactly how this bites later,
    // because ADR-018's whole direction of travel is re-keying label heuristics
    // onto `catalogue_id`. Found while broadening INV-PLAN-LR-SEGMENT-RECORDED.
    delete (lr.session as any).catalogue_id

    // CoachingPrinciples §9 — long must remain ≥ minRatio × any easy. After
    // reducing the LR, clamp easy runs in this week so the ratio survives.
    const minRatio = GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY
    const minEasy = sessionFloorsFor(input.longest_recent_run_km).easy
    // The fourth `distance_km` gate on this path, and the one that would have
    // made the fix above cosmetic: it `continue`d past every duration-anchored
    // easy run, so §9's ratio would have been restored for distance-anchored
    // plans only — exactly the cohort that never needed it. Clamped on the same
    // axis the session is anchored on, from the same ratio.
    const easyCeilingFloored = flooredKm != null
      ? Math.floor((flooredKm / minRatio) / precision) * precision
      : null
    const easyCeilingMins = flooredMins != null
      ? Math.round(flooredMins / minRatio)
      : null
    const minEasyMins = dur(minEasy, pace.minPerKmEasy)
    for (const [d, s] of Object.entries(w.sessions) as [Day, Session | undefined][]) {
      if (!s) continue
      if (d === lr.day) continue
      if (s.type !== 'easy') continue
      if (s.distance_km != null) {
        if (easyCeilingFloored == null) continue
        if (s.distance_km > easyCeilingFloored) {
          const newEasy = Math.max(easyCeilingFloored, minEasy)
          s.distance_km = newEasy
          s.duration_mins = dur(newEasy, pace.minPerKmEasy)
        }
      } else if (s.duration_mins != null && easyCeilingMins != null) {
        if (s.duration_mins > easyCeilingMins) {
          s.duration_mins = Math.max(easyCeilingMins, minEasyMins)
        }
      }
    }
  }

  // Recompute weekly_km and long_run_hrs on touched weeks.
  for (const idx of peakWeekIdxs) {
    weeks[idx].weekly_km = sumWeeklyKm(weeks[idx].sessions, pace)
    weeks[idx].long_run_hrs = computeLongRunHrs(weeks[idx].sessions, pace)
  }
  return steppedBack
}

/**
 * STEPBACK-STALE-PEAK-01 — re-clamp §47's step-backs against the FINAL peak.
 *
 * Runs after `applyLongRunProgressionCap`, which is the pass that can trim the
 * peak out from under the ratio. Keys strictly on the weeks §47 chose, so a
 * week that is merely below peak is untouched (§35, §24).
 *
 * Interim note retired: `peakLrStepbackMinutes.test.ts` had its tolerance
 * widened 1 -> 2 minutes to absorb this, with "fix the ordering instead"
 * written into it. This is that fix.
 */
function reclampPeakStepBacks(
  weeks: Week[], pace: PaceGuide, input: GeneratorInput, steppedBack: ReadonlySet<number>,
): void {
  if (steppedBack.size === 0) return
  const peak = weeks.filter(w => w.n > 0 && w.phase === 'peak' && w.type !== 'deload' && w.type !== 'race')
  const lrOf = (w: Week) => Object.values(w.sessions ?? {}).find(s => s && isLongRun(s)) as Session | undefined
  // ⚠️ ABSENT IS NOT ZERO (SESSION-KM-01). A peak week whose long run is
  // duration-anchored has no `distance_km` at all, and reading that as 0 would
  // drag the max down and under-bound every step-back on the plan. Each axis
  // takes only the weeks that actually speak it.
  const notSteppedBack = peak.filter(w => !steppedBack.has(w.n))
  const kmVals = notSteppedBack.map(w => lrOf(w)?.distance_km).filter((k): k is number => k != null)
  const minsVals = notSteppedBack.map(w => lrOf(w)?.duration_mins).filter((m): m is number => m != null)
  const peakKmFinal = kmVals.length ? Math.max(...kmVals) : 0
  const peakMinsFinal = minsVals.length ? Math.max(...minsVals) : 0
  const pct = GENERATION_CONFIG.PEAK_LR_STEPBACK_MAX_PCT / 100
  const precision = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
  const minLong = sessionFloorsFor(input.longest_recent_run_km).long
  const minRatio = GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY
  for (const w of weeks) {
    if (!steppedBack.has(w.n)) continue
    const s = lrOf(w)
    if (!s) continue
    // §9 — the long run must stay the LONGEST run of its week. Lowering it
    // without this floor inverts the long-vs-easy ratio and
    // `INV-PLAN-LONG-IS-LONGEST` throws (measured: long 21 km against easy
    // 17 km, ratio 1.235 against a 1.25 minimum, 16 hard failures in the
    // cohort grid). The easy runs are not touched — they are sized by the
    // volume curve, and re-cutting them here would be a second owner for a
    // decision step 0 already made.
    // ⚠️ NULLS ARE DROPPED, NOT READ AS ZERO. `sessionDistanceReach.test.ts`
    // caught the first cut using `?? 0` here — the SESSION-KM-01 antipattern,
    // which asserts "this session covered no ground" and has produced four
    // measured defects. A session with no resolvable distance is unknown, and
    // an unknown must not lower a ratio floor.
    const easyKms = Object.values(w.sessions ?? {})
      .filter(x => x && x !== s && x.type !== 'rest' && x.type !== 'strength')
      .map(x => sessionKmSelfPaced(x as Session))
      .filter((k): k is number => k != null)
    const ratioFloorKm = easyKms.length ? Math.max(...easyKms) * minRatio : 0
    // Written on the axis the session already uses (§79/§80).
    if (s.distance_km != null) {
      if (peakKmFinal <= 0) continue
      const bound = Math.max(Math.floor((peakKmFinal * pct) / precision) * precision, minLong, ratioFloorKm)
      if (s.distance_km > bound) { s.distance_km = bound; s.duration_mins = dur(bound, pace.minPerKmEasy) }
    } else if (s.duration_mins != null) {
      if (peakMinsFinal <= 0) continue
      const bound = Math.max(Math.round(peakMinsFinal * pct), Math.round(dur(minLong, pace.minPerKmEasy)),
        Math.round(dur(ratioFloorKm, pace.minPerKmEasy)))
      if (s.duration_mins > bound) s.duration_mins = bound
    }
    w.weekly_km = sumWeeklyKm(w.sessions, pace)
    w.long_run_hrs = computeLongRunHrs(w.sessions, pace)
  }
}

// §47 Amendment 2 (Coaching Board 2026-09-16) — a peak step-back is a VOLUME
// step-back, not only an intensity one.
//
// `applyPeakLongRunAlternation` eases the step-back week's long run (pace + a
// distance cap) and stamps "absorb last week's peak", but the WEEK's total kept
// climbing on the volume curve — measured, 6,720 plans (22.5% of the grid)
// delivered a step-back week BIGGER than the week before it. §90's principle
// ("a week the runner is told is easier must DELIVER less") applied in peak.
//
// MUST RUN AFTER the §45 cap / §9 step-backs / taper cap, because those pass
// recompute `weekly_km` (a peak long run capped by §45 drops its whole week) —
// reading the neighbour's volume any earlier reads a number no runner sees.
// The step-back week is identified by the note `applyPeakLongRunAlternation`
// stamps (that IS the semantic marker), not re-derived — no producer/producer
// drift (DELOAD-OWNER-01). The long run is never touched (§52/§90 protect it);
// only easy volume is trimmed, toward PEAK_STEPBACK_WEEK_MAX_PCT of the
// preceding week, never below §52's long-run share or the min-easy floor.
function applyPeakStepBackVolume(weeks: Week[], pace: PaceGuide, input: GeneratorInput): void {
  // Scoped to non-injury runners. An injury-history runner's delivered volume is
  // owned by §90/§2's injury reconciliation (the injury-yield pass), which runs
  // AFTER this one and reshapes the peak weeks — layering a second volume trim on
  // top would both race with it and double-govern the same weeks. Willy's concern
  // at the sitting was the HEALTHY build's unbroken climb; the injury cohort's
  // peak is already suppressed by the injury caps. (Measured: the only step-back
  // weeks that exceeded their neighbour were injury plans whose peak the yield
  // pass then lowered beneath this trim — the sweep, not cohortGrid, surfaced it.)
  if ((input.injury_history ?? []).length > 0) return
  const STEPBACK_NOTE = 'Step-back week. Easy aerobic'
  const minEasy = sessionFloorsFor(input.longest_recent_run_km).easy
  const precision = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
  const minEasyMins = dur(minEasy, pace.minPerKmEasy)
  const kmOf = (s: Session): number =>
    s.distance_km ?? (s.duration_mins != null ? s.duration_mins / pace.minPerKmEasy : 0)
  const longRunOf = (w: Week): Session | null => {
    for (const s of Object.values(w.sessions)) if (s && isLongRun(s)) return s
    return null
  }

  for (let idx = 0; idx < weeks.length; idx++) {
    const w = weeks[idx]
    if (w.phase !== 'peak' || w.type === 'deload') continue
    const lr = longRunOf(w)
    if (!lr || !(lr.coach_notes ?? []).some(n => n?.includes(STEPBACK_NOTE))) continue

    const prevWeek = weeks[idx - 1]
    if (!prevWeek || prevWeek.type === 'deload' || prevWeek.weekly_km <= 0) continue

    const weekKm = sumWeeklyKm(w.sessions, pace)
    const target = prevWeek.weekly_km * (GENERATION_CONFIG.PEAK_STEPBACK_WEEK_MAX_PCT / 100)
    if (weekKm <= target) continue

    const lrKm = kmOf(lr)
    // §52: trimming easy raises the long-run share, so the week may not fall below
    // lrKm / LONG_RUN_MAX_PCT_OF_WEEKLY.
    const szFloor = lrKm / (GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_WEEKLY / 100)
    const easies = (Object.values(w.sessions) as (Session | undefined)[])
      .filter((s): s is Session => s != null && s.type === 'easy' && s.role !== 'long_run')
    const easyKm = easies.reduce((a, s) => a + kmOf(s), 0)
    const nonEasyKm = weekKm - easyKm
    const targetEasyKm = Math.max(0, Math.max(target, szFloor) - nonEasyKm)
    if (easyKm <= targetEasyKm || easyKm <= 0) continue

    const f = targetEasyKm / easyKm
    for (const s of easies) {
      if (s.distance_km != null) {
        s.distance_km = Math.max(minEasy, Math.floor((s.distance_km * f) / precision) * precision)
        s.duration_mins = dur(s.distance_km, pace.minPerKmEasy)
      } else if (s.duration_mins != null) {
        s.duration_mins = Math.max(minEasyMins, Math.round(s.duration_mins * f))
      }
    }
    w.weekly_km = sumWeeklyKm(w.sessions, pace)
    w.long_run_hrs = computeLongRunHrs(w.sessions, pace)
  }
}

// CoachingPrinciples §45 — long-run progression cap. Universal (all phases).
// Walks the plan after the per-week build and clamps any LR that jumps more
// than +20% / +5km from the prior week's LR. Step-back from a deload week is
// permitted up to the pre-deload distance (with §45 tolerance).
// CoachingPrinciples §9 (CD-9) — every Nth BUILD long run steps back so a runner
// isn't repeating the same long run for weeks. Build phase only: peak long runs
// are the culmination (and carry the §80 finish-goal floor), deloads already
// step the whole week back. Metric-agnostic (distance or duration).
function applyLongRunStepBacks(weeks: Week[], pace: PaceGuide, minLongKm: number): void {
  const longRunOf = (w: Week): Session | null => {
    for (const s of Object.values(w.sessions)) {
      if (s && isLongRun(s)) return s
    }
    return null
  }
  const buildLRs: Array<{ session: Session; wIdx: number }> = []
  for (let i = 0; i < weeks.length; i++) {
    if (weeks[i].phase !== 'build' || weeks[i].type === 'deload') continue
    const lr = longRunOf(weeks[i])
    if (lr) buildLRs.push({ session: lr, wIdx: i })
  }
  const cadence   = GENERATION_CONFIG.LONG_RUN_STEPBACK_CADENCE_N
  const factor    = 1 - GENERATION_CONFIG.LONG_RUN_STEPBACK_PCT / 100
  const precision = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
  // CB-SUBFLOOR-ADMIT-01 — resolved FOR THIS RUNNER. Was the flat
  // GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.long, which re-floored the long
  // run straight back up to 5 km after the cap above had just bounded it.
  const minLong   = minLongKm
  const ratio = GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY
  for (let k = 0; k < buildLRs.length; k++) {
    if ((k + 1) % cadence !== 0) continue  // every Nth: 3rd, 6th, …
    const s = buildLRs[k].session
    const w = weeks[buildLRs[k].wIdx]
    // §9 — the long run must stay the longest run of the week (≥1.25× easy).
    // Floor the step-back at that ratio; if there's no room to step back without
    // inverting the ratio, skip this week rather than violate.
    const maxEasy = Math.max(0, ...Object.values(w.sessions)
      .filter((x): x is Session => !!x && x.type === 'easy' && !isLongRun(x))
      .map(x => x.distance_km ?? x.duration_mins ?? 0))
    if (s.distance_km != null) {
      const floorKm  = maxEasy * ratio
      const steppedKm = Math.round((s.distance_km * factor) / precision) * precision
      if (steppedKm <= floorKm || steppedKm < minLong) continue
      s.distance_km   = steppedKm
      s.duration_mins = dur(s.distance_km, pace.minPerKmEasy)
    } else if (s.duration_mins != null) {
      const floorMins   = maxEasy * ratio  // easy measured in duration for these plans
      const steppedMins = Math.round(s.duration_mins * factor)
      if (steppedMins <= floorMins) continue
      s.duration_mins = steppedMins
    }
    w.weekly_km    = sumWeeklyKm(w.sessions, pace)
    w.long_run_hrs = computeLongRunHrs(w.sessions, pace)
  }
}

/**
 * §24 / §80 Amendment (PLAN-FITNESS-01, Coaching Board 2026-09-17) — THE
 * SPECIFICITY FLOOR RAMPS THROUGH BUILD INSTEAD OF STEPPING AT PEAK.
 *
 * Both floors were gated on `phase === 'peak'`. The floor itself was right —
 * §80 asks a finish-goal marathoner for 42.2 x 0.70 = 29.5 km — but it was only
 * REQUESTED in peak, and §45's +5 km/week cannot climb from §9's share (~11 km)
 * to 29.5 km in the two or three peak weeks that remain. Measured: M1, a first
 * marathon with a 24-WEEK RUNWAY, no injury and no time cap, peaked at 21 km —
 * 50% of race distance against a 30-32 km norm.
 *
 * ⚠️ THE LONG RUN WAS NEVER HELD DOWN BY §52 OR §9, which is where two earlier
 * diagnoses went wrong. It tracked §9's share for 14 of 19 weeks because nothing
 * asked it to do otherwise; §52's 60% ceiling was never within reach. The defect
 * is a floor arriving too late to be climbed to, not a cap holding it down.
 *
 * §45's progression cap still runs afterwards, so this changes WHEN the climb
 * starts, never how fast it is allowed to go.
 */
function rampedSpecificityFloor(
  peakFloorKm: number, phase: PhaseType, weekN: number, phases: Phase[],
): number {
  if (phase === 'peak') return peakFloorKm
  if (phase !== 'build') return 0
  const build = phases.find(p => p.name === 'build')
  if (!build) return 0
  const span = Math.max(1, build.end_week - build.start_week + 1)
  const pos  = Math.min(1, Math.max(0, (weekN - build.start_week + 1) / span))
  const start = GENERATION_CONFIG.SPECIFICITY_RAMP_START_PCT / 100
  return peakFloorKm * (start + (1 - start) * pos)
}

/**
 * ⚠️ `minLongKm` is a PARAMETER, not a config read, since CB-SUBFLOOR-ADMIT-01.
 * It used to read `GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.long` directly —
 * the THIRD producer site on the flat floor — so it capped the week-on-week
 * progression correctly and then floored the result straight back up to 5 km,
 * re-creating the jump it had just removed. Measured: W2 2.9 km -> W3 4.97 km,
 * a 71% step, which `INV-PLAN-LR-PROGRESSION-CAP` caught the moment the flat
 * floor stopped masking it everywhere else.
 */
function applyLongRunProgressionCap(weeks: Week[], pace: PaceGuide, floors: SessionFloors): void {
  const capPct = GENERATION_CONFIG.LONG_RUN_PROGRESSION_CAP_PCT / 100
  const capAbs = GENERATION_CONFIG.LONG_RUN_PROGRESSION_CAP_ABS_KM
  const stepBackTol = 1 + GENERATION_CONFIG.LONG_RUN_DELOAD_STEP_BACK_TOLERANCE_PCT / 100
  const precision = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
  // CB-SUBFLOOR-ADMIT-01 — resolved FOR THIS RUNNER. Was the flat
  // GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.long, which re-floored the long
  // run straight back up to 5 km after the cap above had just bounded it.
  const minLong = floors.long

  const findLong = (w: Week): { day: Day; session: Session } | null => {
    for (const [d, s] of Object.entries(w.sessions) as [Day, Session | undefined][]) {
      if (s && isLongRun(s)) {
        return { day: d, session: s }
      }
    }
    return null
  }

  for (let i = 1; i < weeks.length; i++) {
    const prev = weeks[i - 1]
    const curr = weeks[i]
    if (curr.type === 'race') continue

    const prevLR = findLong(prev)
    const currLR = findLong(curr)
    if (!prevLR || !currLR) continue

    // ⚠️ THIS USED TO BAIL OUT ON `distance_km == null`, WHICH MEANT §45 WAS
    // NEVER APPLIED TO A BEGINNER OR AN ULTRA (LR-CAP-BLIND-01, Coaching Board
    // 2026-09-16). A session is anchored EITHER by distance OR by duration, and
    // §79/§80 give duration to beginners AND to every race >= 50km — so the two
    // cohorts with the least margin for a long-run spike were the two the cap
    // silently skipped. `INV-PLAN-LR-PROGRESSION-CAP` carried the identical
    // bail-out, so nothing caught the omission either: one bug, two copies, and
    // the checker could not catch the producer because it shared the defect.
    //
    // Measured: 2,271 breaches across 1,568 plans (9.8% of the sweep). Worst
    // seen is a 14-week first marathon whose long run went 8.5km -> 26.0km,
    // +206%, to 2.9x the runner's lifetime longest — worse than the +185%
    // incident §45 was written to prevent.
    //
    // ⚠️ `sessionKmSelfPaced`, NOT `sessionKm(s, pace.minPerKmEasy)` — AND THE
    // FIRST CUT OF THIS FIX GOT IT WRONG, which parity caught.
    //
    // The two converters disagree for a duration-anchored session:
    // `sessionKmSelfPaced` uses the session's OWN pace band, `sessionKm` a
    // plan-level easy pace. Using one here and the other in
    // `INV-PLAN-LR-PROGRESSION-CAP` made producer and checker disagree about how
    // long the long run IS, so §45's deload-bounceback exemption fired on one
    // side and not the other and the checker failed plans the producer had
    // deliberately allowed. That is the producer/consumer split this file has
    // paid for repeatedly (D-16, TIER-OWNER-01, §47's positions-vs-pairs) —
    // reintroduced while fixing a different instance of it.
    //
    // The checker has no PaceGuide and therefore MUST use the self-paced
    // reading, so the producer uses it too. Agreement by construction.
    const prevKmOf = sessionKmSelfPaced(prevLR.session)
    const currKmOf = sessionKmSelfPaced(currLR.session)
    if (prevKmOf == null || currKmOf == null || prevKmOf <= 0 || currKmOf <= 0) continue

    // BOUNCEBACK EXEMPTION — from a deload OR from a long-run step-back.
    //
    // Returning to a distance the runner covered two weeks ago is not a spike:
    // chronic load has not moved. §45's tolerance already said this for deloads;
    // it did not know about `applyLongRunStepBacks`, which deliberately cuts
    // every Nth BUILD long run in a non-deload week.
    //
    // Without this, capping after the step-backs run would clamp every
    // bounceback and ratchet the long run permanently down — the same fatal
    // arithmetic D-21 records for volume deloads, where "the first organic
    // user's 14-week plan peaked in week 3".
    //
    // Detected STRUCTURALLY (prev long run shorter than the one before it)
    // rather than by re-deriving the step-back cadence, so the two cannot drift.
    const prevPrevLR = i >= 2 ? findLong(weeks[i - 2]) : null
    const prevPrevKm = prevPrevLR ? sessionKmSelfPaced(prevPrevLR.session) : null
    const prevWasStepBack = prevPrevKm != null
      && prev.type !== 'race'
      && prevKmOf < prevPrevKm - 0.01
    if (prev.type === 'deload' || prevWasStepBack) {
      if (prevPrevKm != null && currKmOf <= prevPrevKm * stepBackTol + 0.01) continue
    }

    // §45 Amendment 2 — the ABSOLUTE arm tapers on a small week. §9 already
    // sizes the long run as a share of weekly volume; this was the one part of
    // long-run prescription that ignored the week entirely, so +5km was a
    // sensible step on a 30km long run (+17%) and a different training stimulus
    // arriving in one week on a 6km one (+83%). Basis is the PRIOR week's
    // delivered volume — non-circular, since the current week's volume is partly
    // determined by the long run being capped.
    //
    // ⚠️ BASIS IS THE PRIOR LONG RUN, NOT THE PRIOR WEEK, AND THAT IS NOT A
    // WEAKENING — it is arithmetically the same rule on a stable input. §9 sizes
    // the build-phase long run at 30% of the week, so "15% of the week" IS "50%
    // of the long run". The week is NOT stable here: §45 runs mid-pipeline and
    // the long run is re-anchored (duration -> distance) afterwards, so
    // `prev.weekly_km` differs between the producer and the checker and the two
    // disagreed on 140 plans when this shipped on a weekly basis. `prevKmOf` is
    // the exact value the % arm already reads, so producer and checker cannot
    // drift — which is the whole lesson of LR-CAP-BLIND-01 (one bug, two
    // copies, checker blind because it shared the defect).
    const absArmKm = Math.min(
      capAbs,
      prevKmOf * GENERATION_CONFIG.LONG_RUN_ABS_STEP_MAX_PCT_OF_LR / 100,
    )
    const allowedJumpKm = Math.max(prevKmOf * capPct, absArmKm)
    const maxAllowedKm = prevKmOf + allowedJumpKm
    if (currKmOf - 0.01 > maxAllowedKm) {
      const newKm = Math.max(Math.floor(maxAllowedKm / precision) * precision, minLong)
      // WRITE BACK TO THE ANCHOR THE SESSION ACTUALLY USES. Setting
      // `distance_km` on a duration-anchored session would flip a beginner's
      // card from minutes to kilometres and break §79/§80's metric contract —
      // fixing a load bug by silently changing what the runner is shown.
      if (currLR.session.distance_km != null) {
        currLR.session.distance_km = newKm
        currLR.session.duration_mins = dur(newKm, pace.minPerKmEasy)
      } else {
        // SCALE THE DURATION BY THE KM RATIO rather than converting km -> minutes
        // with some pace. Distance and duration are proportional at a fixed
        // pace, so the ratio lands exactly on `newKm` under the SAME converter
        // the checker will use — no second pace is introduced, so none can drift.
        const mins = currLR.session.duration_mins
        if (mins != null && mins > 0) {
          currLR.session.duration_mins = Math.round(mins * (newKm / currKmOf))
        }
      }

      // CoachingPrinciples §9 — clamp easy runs so long-vs-easy ratio survives.
      const minRatio = GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY
      const minEasy = floors.easy
      const easyCeiling = newKm / minRatio
      const easyCeilingFloored = Math.floor(easyCeiling / precision) * precision
      for (const [d, s] of Object.entries(curr.sessions) as [Day, Session | undefined][]) {
        if (!s) continue
        if (d === currLR.day) continue
        if (s.type !== 'easy') continue
        if (s.distance_km == null) continue
        if (s.distance_km > easyCeilingFloored) {
          const newEasy = Math.max(easyCeilingFloored, minEasy)
          s.distance_km = newEasy
          s.duration_mins = dur(newEasy, pace.minPerKmEasy)
        }
      }

      curr.weekly_km = sumWeeklyKm(curr.sessions, pace)
      curr.long_run_hrs = computeLongRunHrs(curr.sessions, pace)
    }
  }
}

/**
 * §25 / §24b — price a race-pace long run at the paces its own coach note
 * prescribes (I7b, MKT-PLAN-SHAPE-01, 2026-09-21).
 *
 * THE DEFECT. Every long run in the engine is priced `dur(km, minPerKmEasy)`,
 * which is right for a long run that is entirely easy. The three constructors
 * that build a long run with a RACE-PACE SEGMENT inherited that line unchanged,
 * so the published marathon plan told the runner:
 *
 *     "Marathon-pace long run · 29 km · 192 min"
 *     "Final 40% at MP: 5:40 /km."
 *
 * 192 min over 29 km is **6:37/km**. The session states a 5:40/km segment in its
 * own second line and then prices none of it. Measured across the nine published
 * plans, all five segmented long runs overstate their duration, by 6–9%.
 *
 * ⚠️ WHY IT IS A DISPLAY FIX AND NOT A PRESCRIPTION CHANGE, which is what keeps
 * it out of the Coaching Board (ADR-017's "defect fixes restoring documented
 * intent"). The distance is unchanged, the segment is unchanged, the pace is
 * unchanged — the runner is asked to run exactly what they were asked to run
 * before. Only the minutes the card claims it will take are corrected, and they
 * only ever go DOWN, so no minutes-based ceiling (§9's `LONG_RUN_CAP_MINUTES`,
 * INV-PLAN-LONG-CAP-MINS) can be newly breached. ADR-015 already owns exactly
 * this assertion one layer up: the number shown to the runner must be the number
 * the prescription implies.
 *
 * ⚠️ THE DOSE IS READ AS A FRACTION OF DISTANCE, AND THE CODEBASE IS NOT
 * UNANIMOUS ABOUT THAT. §24b's own coach note states it in km ("Middle 20%
 * (≈3.7 km)"), which is the distance reading; `sessionComposer.ts` splits §25's
 * rows by TIME (`segMins = total * mpPct / 100`). For the five live sessions the
 * two readings differ by under a minute (marathon: 181 vs 180), so nothing here
 * turns on it — but it is a real ambiguity in §25's `race_pace_pct` and it is
 * filed rather than silently resolved (MKT-PLAN-SEGMENT-BASIS-01).
 */
function applyRacePaceSegmentDuration(weeks: Week[], pace: PaceGuide): void {
  for (const w of weeks) {
    for (const s of Object.values(w.sessions) as (Session | undefined)[]) {
      if (!s || !isLongRun(s)) continue
      if (!s.lr_segment_pace) continue          // §47 strips this on a step-back
      const distKm = s.distance_km
      if (distKm == null || distKm <= 0) continue   // duration-anchored: §79/§80's metric contract

      const row = catalogueRowFor(s)
      const mss = row?.main_set_structure as
        { type?: string; race_pace_pct?: number; race_pace_zone?: string } | undefined

      // Segments as { fraction of distance, min/km }. Two shapes exist and
      // neither is inferred from a label (D-17): §25's rows DECLARE their dose
      // in `main_set_structure.race_pace_pct`, and §24b's inline 5K/10K session
      // has no row at all, so its own two config constants are the authority.
      let segments: { frac: number; minPerKm: number }[] = []
      if (mss?.type === 'long_run_with_segment' && typeof mss.race_pace_pct === 'number') {
        const segMinPerKm = mss.race_pace_zone === 'HM' ? pace.minPerKmHM : pace.minPerKmMarathon
        if (segMinPerKm == null) continue
        segments = [{ frac: mss.race_pace_pct / 100, minPerKm: segMinPerKm }]
      } else if (!row && pace.minPerKmMarathon != null && pace.minPerKmHM != null) {
        segments = [
          { frac: GENERATION_CONFIG.LR_5K10K_PEAK_MID_SEGMENT_PCT,   minPerKm: pace.minPerKmMarathon },
          { frac: GENERATION_CONFIG.LR_5K10K_PEAK_FINAL_SEGMENT_PCT, minPerKm: pace.minPerKmHM },
        ]
      } else continue

      const segFrac = segments.reduce((a, x) => a + x.frac, 0)
      if (segFrac <= 0 || segFrac > 1) continue
      const mins = distKm * (1 - segFrac) * pace.minPerKmEasy
        + segments.reduce((a, x) => a + distKm * x.frac * x.minPerKm, 0)
      const priced = Math.round(mins)
      // Only ever REDUCES — a race-pace segment is by definition faster than
      // easy. A guard, not an expectation: if a pace table ever inverts, the
      // session keeps the conservative number rather than silently growing.
      if (priced > 0 && priced < (s.duration_mins ?? Infinity)) s.duration_mins = priced
    }
    w.long_run_hrs = computeLongRunHrs(w.sessions, pace)
  }
}

// ─── V1–V7 post-pass rules ────────────────────────────────────────────────────
// Each helper runs after weeks/sessions are built, mutates the weeks array
// (and a shared ruleAdjustments audit list) in place, and returns nothing.
// The patterns mirror applyLongRunProgressionCap / applyPeakLongRunAlternation:
// pure functions of the plan state, no I/O, deterministic. Running order
// matters — see the call-site comments in generateRulePlan.

import type { RuleAdjustment } from '@/types/plan'

// Helper: append a coach note to a session, respecting the 3-element tuple cap
// declared in the schema. If the session already has 3 notes, the new note is
// dropped — better to lose a propagation note than to break a structurally
// important note (catalogue voice, segment pace target).
function appendCoachNote(s: Session, note: string): void {
  const existing = s.coach_notes ?? []
  // Avoid exact duplicates so V3 propagation doesn't double-up if applied twice.
  if (existing.some(n => n === note)) return
  if (existing.length >= 3) return
  if (existing.length === 0)      s.coach_notes = [note]
  else if (existing.length === 1) s.coach_notes = [existing[0]!, note]
  else                            s.coach_notes = [existing[0]!, existing[1], note]
}

// Helper: find the first non-rest, non-strength session of a week, in mon→sun
// order. Used by V3 + V7 — they want "the first thing the runner sees" for
// that week, not the long run / quality slot specifically.
function firstActiveSession(week: Week): Session | null {
  for (const d of DAY_ORDER) {
    const s = week.sessions[d]
    if (!s) continue
    if (s.type === 'strength' || s.type === 'rest') continue
    return s
  }
  return null
}

// Helper: identify the long-run session in a week (mirrors findLong inside
// applyLongRunProgressionCap). Returns null if none.
function longRunOfWeek(week: Week): { day: Day; session: Session } | null {
  for (const [d, s] of Object.entries(week.sessions) as [Day, Session | undefined][]) {
    if (s && isLongRun(s)) {
      return { day: d, session: s }
    }
  }
  return null
}

// V5 — map a quality-session label to a STIMULUS_RANK key. Substring match,
// case-insensitive. Returns null when the label doesn't fit any known bucket
// (should never happen for engine-generated labels — defensive).
// classifyStimulus now lives in ./sessionRole — the declared single owner of
// session classification (INV-CLASS / D-17). It was here, private, while
// invariants.ts grew its own label checks; SC-07 needed it in both, and a third
// copy is exactly the drift D-17 warns about. Imported at the top of this file.

// V1 — simultaneous volume step + first quality intro.
// Coaching rationale: introducing a new stress (the first quality session) on
// top of a meaningful volume bump compounds adaptation load. Either hold the
// volume bump for a week or delay quality by a week. Resolution chosen here:
// hold volume constant in the bump week (option 1 from the spec) — preserves
// the build's session-mix intent and is mechanically simpler than reshuffling
// quality across weeks.
//
// Mechanics: scales EASY runs only (not the long run, not quality). The long
// run is the structural anchor for §45/§47 cascades and for the
// long-is-longest invariant; shrinking it here would break those. The
// long-run growth is governed by §45's own progression cap, not V1.
// If easy-only scaling can't reach the prior-week target, V1 partially
// reduces — better to leave the easy load slightly elevated than break the
// long-run cap chain.
function applyV1VolumeQualityStimulusSplit(
  weeks: Week[],
  pace: PaceGuide,
  adjustments: RuleAdjustment[],
  floors: SessionFloors,
): void {
  const threshold = 1 + GENERATION_CONFIG.V1_VOLUME_QUALITY_SPLIT_THRESHOLD_PCT / 100
  const precision = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
  const minEasy   = floors.easy
  const minRatio  = GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY

  // TWO TRIGGER WEEKS, one rule.
  //
  //   1. The first week carrying ANY quality session (original V1, §2).
  //   2. The first week carrying a VO2MAX session — Willy's gate, a binding
  //      condition of CD-16's approval: "VO2max may enter build only under the
  //      rule that already governs the first quality session of a plan: the week
  //      that introduces it holds volume flat. Intensity and volume do not
  //      progress in the same week."
  //
  // Extended rather than duplicated, on Willy's own instruction ("that machinery
  // exists — extend it rather than inventing a parallel rule"). A second
  // near-identical flattening routine is how two rules drift apart.
  //
  // On a 12-week 10K these collapse to the same week and the gate costs nothing,
  // which is exactly why it must not be skipped: that coincidence is a property
  // of one plan shape. On a longer plan VO2max lands mid-build, where the first
  // trigger has long since passed and only this second one protects the runner.
  const firstIdxWhere = (pred: (s: Session) => boolean): number => {
    for (let i = 0; i < weeks.length; i++) {
      if (Object.values(weeks[i].sessions).some(s => s != null && pred(s))) return i
    }
    return -1
  }

  const triggerIdxs = Array.from(new Set([
    firstIdxWhere(s => s.type === 'quality'),
    firstIdxWhere(s => s.type === 'quality' && classifyStimulus(s) === 'vo2max'),
  ])).filter(i => i > 0).sort((a, b) => a - b)

  for (const triggerIdx of triggerIdxs) {
    const trimmed = flattenIntroducingWeek(
      weeks, triggerIdx, pace, adjustments, threshold, precision, minEasy, minRatio,
    )
    // RAMP-PRODUCER-01 — a trim that hands its deficit to the next week has not
    // protected the runner, it has moved the spike by seven days.
    if (trimmed) {
      reanchorWeekAfterTrim(
        weeks, triggerIdx, trimmed.trimmedToKm, pace, adjustments, precision, minEasy, minRatio,
      )
    }
  }
}

/**
 * Trim a week's EASY runs until its weekly volume is at or under `rawTargetKm`.
 * Long run and quality are never touched, and §52's long-run-share floor is
 * respected (a partial apply is preferred to breaking it).
 *
 * Extracted from `flattenIntroducingWeek` so the V1 flatten and the RAMP-PRODUCER
 * re-anchor below share ONE trimmer. Willy's instruction when V1 gained its
 * second trigger was "that machinery exists — extend it rather than inventing a
 * parallel rule", and a second near-identical flattening routine is how two
 * rules drift apart. Same argument, one level down.
 *
 * Returns the before/after weekly km, or null when nothing was changed.
 */
function trimWeekEasyToTarget(
  curr: Week,
  rawTargetKm: number,
  pace: PaceGuide,
  precision: number,
  minEasy: number,
  minRatio: number,
  /**
   * §52 — a floor on how small an individual easy run may be driven, ABOVE the
   * absolute MIN_SESSION_DISTANCE. Defaults to `minEasy` (V1's own behaviour,
   * unchanged). The re-anchor passes a higher floor: see the call site.
   */
  perSessionFloorKm: number = minEasy,
): { before: number; after: number } | null {
  // Identify the long-run session — it is excluded from scaling.
  const lr = longRunOfWeek(curr)

  // Sum easy-only volume (excluding long run, quality, strength, rest).
  // Easy = type 'easy' AND NOT the long run.
  const easyKm = Object.entries(curr.sessions).reduce((sum, [d, s]) => {
    if (!s || s.type !== 'easy') return sum
    if (lr && d === lr.day) return sum  // long-run excluded
    return sum + sessionKmOrZero(s, pace.minPerKmEasy)
  }, 0)

  if (easyKm <= 0) return null  // no easies to scale

  // §52 guard — V1 must not shrink weekly so much that LR / weekly exceeds the
  // 60% lopsidedness cap. Compute a floor on weekly_target so the ratio
  // survives, with a precision-aligned safety margin so post-rounding
  // reconstruction (sumWeeklyKm) doesn't drop us below the floor. If
  // prev_weekly is already below this floor, V1 partial-applies (lands at
  // the floor, not at prev) — better to leave easy slightly elevated than
  // to break §52.
  // §52's floor. `?? 0` reads a duration-anchored long run as zero km, so
  // `weeklyFloorFromLR` is 0 and this floor is INERT for beginners.
  //
  // ⚠️ LEFT INERT DELIBERATELY — Coaching Board 2026-09-13, SESSION-KM-02 item (3).
  // Do not "fix" this to `sessionKmOrZero`. Measured 2026-09-12: **0 breaches
  // across 2,337 duration-anchored sessions in scope** — §9's easy ceiling and
  // the long-run cap are holding the ratio on their own, so a producer change
  // here would alter prescriptions to prevent something that does not happen.
  // The ruling was explicit: "do not add a producer change for a zero-breach
  // case." What DOES need to see these sessions is the CHECKER, and it already
  // does — `INV-PLAN-LR-MAX-WEEKLY-PCT` was moved onto `sessionKmForCheck`
  // (2026-09-12) after it was found skipping every duration-anchored session.
  // If a breach ever surfaces there, THAT is the signal to revisit this line.
  const lrKm = lr?.session.distance_km ?? 0
  const lrMaxPctOfWeekly = GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_WEEKLY / 100
  // Round the floor UP to the next km — sumWeeklyKm rounds the final total to
  // an integer, which can bring us back below the strict floor by up to 1 km.
  const weeklyFloorFromLR = lrKm > 0 ? Math.ceil(lrKm / lrMaxPctOfWeekly) + 1 : 0
  const targetWeeklyKm = Math.max(rawTargetKm, weeklyFloorFromLR)
  if (targetWeeklyKm >= curr.weekly_km) return null  // unchanged, or would grow it

  // The volume this week had BEFORE V1 trimmed it. Captured here because
  // `curr.weekly_km` is reassigned below, and the adjustment message needs the
  // value that justified the intervention, not the value after it.
  // Defect fixed 2026-08-20: the message read `curr.weekly_km` post-mutation and
  // rendered as "stepped volume up from 32 to 32 km (>5% bump)" — a claim the
  // numbers in the same sentence contradict. Claim/computation mismatch: the
  // engine did the right thing and then described it wrongly.
  const preCorrectionWeeklyKm = curr.weekly_km

  // Compute easy-target so total weekly = targetWeeklyKm.
  // weekly = quality + long + easy_total + recovery. Only easy_total moves.
  const fixedKm = (curr.weekly_km - easyKm)  // quality + long + recovery — held constant
  const easyTargetKm = Math.max(0, targetWeeklyKm - fixedKm)
  if (easyTargetKm >= easyKm) return null  // already under target

  const scale = easyTargetKm / easyKm
  // Easy ceiling per §9: easy ≤ long / minRatio. Apply both the V1 scale and
  // this ceiling. V1 should never raise easy above where the existing engine
  // already left it, only lower; so the floor is `minEasy`, the ceiling is
  // pre-existing distance × scale, and the §9-derived ceiling is layered on
  // top.
  const easyCeilingFromLR = lr?.session.distance_km != null
    ? Math.floor((lr.session.distance_km / minRatio) / precision) * precision
    : Infinity

  for (const [d, s] of Object.entries(curr.sessions) as [Day, Session | undefined][]) {
    if (!s || s.type !== 'easy') continue
    if (lr && d === lr.day) continue
    if (s.distance_km == null) continue
    const scaled = Math.max(
      Math.min(
        Math.round(s.distance_km * scale / precision) * precision,
        easyCeilingFromLR,
      ),
      Math.max(minEasy, perSessionFloorKm),
    )
    s.distance_km = scaled
    s.duration_mins = dur(scaled, pace.minPerKmEasy)
  }
  const newWeekly = sumWeeklyKm(curr.sessions, pace)
  curr.weekly_km = newWeekly
  curr.long_run_hrs = computeLongRunHrs(curr.sessions, pace)
  return { before: preCorrectionWeeklyKm, after: newWeekly }
}

function flattenIntroducingWeek(
  weeks: Week[],
  triggerIdx: number,
  pace: PaceGuide,
  adjustments: RuleAdjustment[],
  threshold: number,
  precision: number,
  minEasy: number,
  minRatio: number,
): { trimmedToKm: number } | null {
  const curr = weeks[triggerIdx]

  // MKT-PLAN-SHAPE-01 (2026-09-21) — THE REFERENCE IS THE LAST **LOADING** WEEK,
  // NOT THE WEEK BEFORE. A defect fix restoring this function's own stated
  // intent, so ADR-017-exempt from the Coaching Board (see the commit).
  //
  // V1 exists to hold volume FLAT across the week that introduces intensity:
  // "intensity and volume do not progress in the same week" (Willy, CD-16). That
  // sentence presumes the comparison week is a week the runner LOADED. Read
  // against `weeks[triggerIdx - 1]` it was not: build week 1 follows the base
  // phase's RECOVERY week on 7 of the 9 published plans, so "hold flat" meant
  // "hold at 70% of what the runner was already running" — a 38% CUT dressed as
  // a safety rule, on the exact week the plan tells the runner the hard work
  // begins.
  //
  // It then compounds, because `reanchorWeekAfterTrim` (correctly) ramps the
  // rest of the block from what was actually delivered. Measured on the nine
  // published plans, before → after:
  //
  //   half-marathon-12-week  45 28R 28 31 34 37 41  →  45 28R 41 48 49 50 51
  //   sub-45-10k-plan        45 28R 30 33 36 35R 46 →  45 28R 43 50 56 35R 46
  //
  // On the HM plan the peak phase topped out at 41 km against a BASE week of 45:
  // the plan peaked in week 3 and spent the next nine weeks getting back. That is
  // the same arithmetic D-21 records for deload bouncebacks ("the first organic
  // user's 14-week plan peaked in week 3, in the base phase"), reached by a
  // different route — and §2's own remedy for it was already written and
  // implemented one function away: `buildVolumeSequence` exempts a post-deload
  // bounceback because "returning to a volume held two weeks ago is not a spike".
  // V1 is a SECOND producer of the same rule and never learned the exemption.
  // Two writers of one fact, drifting — the fault DELOAD-OWNER-01 and
  // SESSION-KM-01 both exist to remove, here found a third time.
  //
  // ⚠️ THIS DOES NOT WEAKEN V1. Where the introducing week genuinely steps up
  // from the volume the runner has been holding, V1 fires exactly as before and
  // the re-anchor cascade still runs. What it no longer does is read a planned
  // REDUCTION as the runner's chronic load.
  let prev = weeks[triggerIdx - 1]
  for (let j = triggerIdx - 1; j >= 0; j--) {
    if (weeks[j].type !== 'deload' && weeks[j].type !== 'race') { prev = weeks[j]; break }
  }

  // Name the stimulus this week actually introduced, so the record says which
  // of the two triggers fired rather than always claiming "first quality".
  const introducesVo2 = Object.values(curr.sessions)
    .some(s => s != null && s.type === 'quality' && classifyStimulus(s) === 'vo2max')
  const isFirstQualityWeek = !weeks.slice(0, triggerIdx)
    .some(w => Object.values(w.sessions).some(s => s?.type === 'quality'))
  const introduced = isFirstQualityWeek
    ? (introducesVo2 ? 'the first quality session of the plan (VO2max)' : 'the first quality session')
    : 'the first VO2max session'
  if (curr.type === 'race' || curr.type === 'deload') return null
  if (curr.weekly_km <= prev.weekly_km * threshold) return null  // bump is small enough

  const trimmed = trimWeekEasyToTarget(curr, prev.weekly_km, pace, precision, minEasy, minRatio)
  if (!trimmed) return null
  const { before: preCorrectionWeeklyKm, after: newWeekly } = trimmed

  adjustments.push({
    rule:           'V1-volume-quality-split',
    violation:      `Week ${curr.n} introduced ${introduced} AND stepped volume up from ${prev.weekly_km} to ${preCorrectionWeeklyKm} km (>${GENERATION_CONFIG.V1_VOLUME_QUALITY_SPLIT_THRESHOLD_PCT}% bump).`,
    resolution:     `Held weekly volume at ${newWeekly} km (target ${prev.weekly_km}) by trimming easy runs; long run + quality preserved.`,
    weeks_affected: [curr.n],
  })

  return { trimmedToKm: newWeekly }
}

/** The smallest easy (non-long-run) run in a week, in km. The §52 floor the
 *  re-anchor may not trim below. Returns 0 when the week has no easy runs, which
 *  makes the floor a no-op rather than an accidental constraint. */
function smallestEasyKm(w: Week, pace: PaceGuide): number {
  const lr = longRunOfWeek(w)
  const easies = Object.entries(w.sessions)
    .filter(([d, s]) => s && s.type === 'easy' && !(lr && d === lr.day))
    .map(([, s]) => sessionKmOrZero(s, pace.minPerKmEasy))
    .filter(km => km > 0)
  return easies.length ? Math.min(...easies) : 0
}

/**
 * RAMP-PRODUCER-01 — the week AFTER a V1 trim must ramp from what the runner
 * actually ran, not from the curve.
 *
 * V1 holds the introducing week flat (correct — intensity and volume must not
 * progress together). The next week was then built from the volume CURVE, which
 * still believed the trimmed week was at its curve value, so the trim handed its
 * whole deficit forward. On the founder's live 10K the curve read 33 -> 37 -> 40
 * (+8%, legal); the trim held week 2 at 33; the runner therefore ran 33, 33, 40,
 * a +23% delivered rise against a chronic load of 33. §94 detects this; until
 * now nothing produced a different plan.
 *
 * Bounded by §2's own cap, measured from the DELIVERED value. Trims easy runs
 * only, through the same trimmer V1 uses, so the long run (§52-exempt,
 * race-anchored) and every quality session are untouched.
 *
 * Deliberately caps ONE week, not the remaining curve. The deficit is a
 * one-week artefact of the trim; damping the whole curve would lower delivered
 * peak volume everywhere, and §79/§89 reserve peak structure to the runner's
 * inputs. The board REJECTED exactly that trade on 2026-09-06 when a healthy
 * bounceback cap flipped +50pp of plans to "constrained by inputs" for zero
 * safety benefit.
 */
function reanchorWeekAfterTrim(
  weeks: Week[],
  trimIdx: number,
  trimmedToKm: number,
  pace: PaceGuide,
  adjustments: RuleAdjustment[],
  precision: number,
  minEasy: number,
  minRatio: number,
): void {
  const capPct = GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT
  let deliveredKm = trimmedToKm
  const reanchored: number[] = []
  let firstBefore = 0

  // CASCADE, not a single week. Capping only week N+1 moves the spike to N+2:
  // the curve keeps climbing while delivered volume restarts lower, so the gap
  // reappears one week later. Measured on the 10K golden plan, the single-week
  // variant produced exactly that. Walk forward until the curve catches up with
  // what the runner is actually running, then stop — the loop is self-limiting
  // because each capped week raises the delivered baseline by the full 10%.
  for (let i = trimIdx + 1; i < weeks.length; i++) {
    const w = weeks[i]
    // Planned DROPS. §2's rise cap has nothing to say about them, and
    // INV-PLAN-DELOAD-IS-A-REDUCTION owns the first.
    if (w.type === 'race' || w.type === 'deload' || w.phase === 'taper') break

    const allowedKm = deliveredKm * (1 + capPct / 100)
    if (w.weekly_km <= allowedKm) break   // curve has caught up — nothing left to damp

    const before = w.weekly_km
    // §52 — "the constitutional answer is to surface the constraint, not to
    // silently truncate weekday runs to single-digit km". Without this floor the
    // cap did exactly that: on the 10K golden plan it drove two 11.5 km easy
    // runs to the 4 km MIN_SESSION_DISTANCE to hold a +62% rise down to +10%,
    // reproducing §52's own Case 04 (weekday runs cut to 4 km each, "a week that
    // doesn't actually train the runner").
    //
    // So no easy run may be pushed below the SMALLEST easy run of the week the
    // runner has just completed. No new numeric: the floor is the runner's own
    // most recent easy session. Where that prevents reaching the cap, the trim
    // PARTIAL-APPLIES and §94 keeps reporting the residual as a `warn` — the
    // same honest-residual treatment §52 and §90 already use.
    const floorKm = smallestEasyKm(weeks[trimIdx], pace)
    const result = trimWeekEasyToTarget(w, allowedKm, pace, precision, minEasy, minRatio, floorKm)
    if (!result) break                     // §52 floor or no easy left to trim
    if (!firstBefore) firstBefore = before
    reanchored.push(w.n)
    deliveredKm = result.after
  }

  if (!reanchored.length) return

  adjustments.push({
    rule:           'V1-volume-quality-split-reanchor',
    violation:      `Week ${reanchored[0]} stepped up from the volume curve (${firstBefore} km) rather than from the ${trimmedToKm} km week ${weeks[trimIdx].n} actually delivered after its quality-split trim, a +${Math.round((firstBefore - trimmedToKm) / trimmedToKm * 100)}% delivered rise.`,
    resolution:     `Re-anchored week${reanchored.length > 1 ? 's' : ''} ${reanchored.join(', ')} to §2's ${capPct}% cap measured from delivered volume (now ${deliveredKm} km) by trimming easy runs; long run + quality preserved.`,
    weeks_affected: reanchored,
  })
}

// V2 — VO2max onset must allow at least VO2MAX_ONSET_MIN_ADAPTATION_WEEKS
// weeks of build/peak before taper. Applies only to races ≤ 21km — the
// catalogue does not produce vo2max sessions for marathon+ (no rows with
// distance_eligibility containing MARATHON/50K/100K), so the rule is a no-op
// for those distances.
//
// Resolution: if the first vo2max session lands later than the deadline,
// swap day-positions with the latest non-VO2 quality session that sits at or
// before the deadline. Preserves total quality count and weekday placements.
function applyV2Vo2MaxOnsetTiming(
  weeks: Week[],
  raceDistanceKm: number,
  phases: Phase[],
  adjustments: RuleAdjustment[],
  /** V2-SWAP-RESIZE-01 — re-size a relocated session for its new week's phase.
   *  Supplied by the caller so the resize runs through the SAME constructor
   *  that sized it originally. Optional so existing tests keep compiling; when
   *  absent the swap behaves as it did before (dose not corrected). */
  resizeForPhase?: (session: Session, week: Week, day: Day) => void,
  /** §79 vs §5 — is this plan week inside the intensity re-entry window's
   *  protected QUALITY weeks? Supplied by the caller because the window is
   *  plan-level state this function has no other route to. */
  isReentryProtectedWeek?: (weekN: number) => boolean,
): void {
  if (raceDistanceKm > 21) return  // V2 limited to short races per spec

  const taperPhase = phases.find(p => p.name === 'taper')
  if (!taperPhase) return
  // Earliest week index (0-based) where the first vo2max session is allowed
  // to land. weekN <= deadline ⇒ compliant.
  const taperWeeks = (weeks.length - taperPhase.start_week) + 1
  const deadlineWeekN = weeks.length - taperWeeks - GENERATION_CONFIG.VO2MAX_ONSET_MIN_ADAPTATION_WEEKS
  if (deadlineWeekN < 1) return  // plan too short — nothing to enforce

  // Scan for the first vo2max session and the latest pre-deadline non-vo2 quality.
  let firstVo2Pos: { weekIdx: number; day: Day } | null = null
  for (let i = 0; i < weeks.length; i++) {
    for (const [d, s] of Object.entries(weeks[i].sessions) as [Day, Session | undefined][]) {
      if (s && s.type === 'quality' && classifyStimulus(s) === 'vo2max') {
        firstVo2Pos = { weekIdx: i, day: d }
        break
      }
    }
    if (firstVo2Pos) break
  }
  if (!firstVo2Pos) return  // catalogue produced no vo2max for this plan
  if (weeks[firstVo2Pos.weekIdx].n <= deadlineWeekN) return  // already compliant

  const fromWeek = weeks[firstVo2Pos.weekIdx]

  // SC-07 / CD-16 + CD-22 (2026-08-20) — THE OLD EARLY-RETURN IS DELETED.
  //
  // It read: if the first vo2max session is in peak, log "No swap — catalogue
  // places VO2max only in peak phase for this race distance" and accept the
  // late placement. That sentence was true when it was written and is now
  // false: the three vo2max rows are build-eligible and the build rotation
  // selects them (see buildRotationCategories). Leaving a stale excuse in the
  // record is worse than no record — it explains the plan with a constraint
  // that no longer exists, and it is why this sat unexamined for months.
  //
  // The swap below now has somewhere to swap FROM, so it runs.

  // Can this plan's geometry contain the adaptation window at all? The deadline
  // must fall at or after the first week that carries a quality session — i.e.
  // build start. Below 12 weeks it does not: for an 11-week 10K the deadline is
  // W4 while build begins W5, so the window lands in base phase, where there is
  // no quality to move. 5K.min_weeks is 8 and 10K.min_weeks is 10, so these are
  // SUPPORTED plan lengths, not edge cases.
  //
  // CD-22: the window is BINDING WHERE REACHABLE and EXPLICITLY RECORDED WHERE
  // NOT. Not lowered to 4 to make short plans pass — the adaptation window is a
  // physiological quantity and does not shrink because the runner chose a
  // shorter plan (Seiler). Not thrown either: refusing to generate a plan a
  // runner legitimately asked for, over a window that plan cannot geometrically
  // contain, is a crash rather than enforcement (Hutchinson).
  //
  // Same shape, same treatment, third time: CD-20 recorded the withheld second
  // quality session; CD-21 exempted maintenance plans from the §1 ceiling.
  const buildStartWeekN = phases.find(p => p.name === 'build')?.start_week
  if (buildStartWeekN != null && deadlineWeekN < buildStartWeekN) {
    adjustments.push({
      rule:           'V2-vo2max-onset-unreachable',
      violation:      `First VO2max session is in week ${fromWeek.n}; the adaptation window needs it by week ${deadlineWeekN}.`,
      resolution:     `Plan is ${weeks.length} weeks — too short to contain a ${GENERATION_CONFIG.VO2MAX_ONSET_MIN_ADAPTATION_WEEKS}-week VO2max adaptation window, because week ${deadlineWeekN} falls in the base phase (build starts week ${buildStartWeekN}) where no quality session exists. The VO2max sessions are kept for their other value; expect them to sharpen rather than to build a new ceiling. A ${weeks.length + (buildStartWeekN - deadlineWeekN)}-week plan would fit the full window.`,
      weeks_affected: [fromWeek.n],
    })
    return
  }

  // Find latest non-vo2 quality session at or before deadline week. Restrict
  // swap candidates to sessions whose stimulus rank is at or above tempo (rank
  // 4) — pulling a low-rank aerobic session forward into the deadline weeks
  // is a no-op for the V2 rationale (the runner still doesn't get vo2max
  // adaptation early enough). Threshold/race-pace sessions provide useful
  // adaptation overlap and are physiologically suitable in either week slot.
  let swapTarget: { weekIdx: number; day: Day } | null = null
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].n > deadlineWeekN) continue
    if (weeks[i].type === 'race' || weeks[i].type === 'deload') continue
    for (const [d, s] of Object.entries(weeks[i].sessions) as [Day, Session | undefined][]) {
      if (!s || s.type !== 'quality') continue
      const stim = classifyStimulus(s)
      if (stim === 'vo2max') continue
      if (!stim) continue
      const rank = GENERATION_CONFIG.STIMULUS_RANK[stim]
      if (rank < GENERATION_CONFIG.STIMULUS_RANK.tempo) continue
      swapTarget = { weekIdx: i, day: d }
      break
    }
    if (swapTarget) break
  }
  if (!swapTarget) return  // no suitable swap candidate — leave plan unchanged

  // §79 vs §5, SECOND MECHANISM (2026-09-15). `vo2MustOpenBuild` is not the only
  // way §5 outranks the re-entry window — this swap relocates VO2max EARLIER to
  // meet the adaptation deadline, and it was landing it inside the very weeks
  // §79 withholds it from. The rotation had already placed the slot correctly
  // (index 1, clear of a 1-week window) and the swap pulled it back to index 0.
  //
  // The board ruled §79 wins that conflict. A swap that would put VO2max inside
  // the protected window is declined, exactly as an absent candidate is — §5's
  // window is then recorded unreachable by the CD-22 path below rather than
  // being met by overriding a tissue-tolerance rule.
  if (isReentryProtectedWeek?.(weeks[swapTarget.weekIdx].n)) return

  const toWeek = weeks[swapTarget.weekIdx]
  const vo2Session     = fromWeek.sessions[firstVo2Pos.day]!
  const targetSession  = toWeek.sessions[swapTarget.day]!

  // Swap session objects between the two day-slots. Update IDs to match new
  // (week, day) so deterministic-ID invariant (INV-PLAN-009) survives.
  vo2Session.id    = `w${toWeek.n}-${swapTarget.day}`
  targetSession.id = `w${fromWeek.n}-${firstVo2Pos.day}`
  toWeek.sessions[swapTarget.day]   = vo2Session
  fromWeek.sessions[firstVo2Pos.day] = targetSession

  // V2-SWAP-RESIZE-01 (Coaching Board 2026-09-15) — A RELOCATED SESSION MUST BE
  // RE-SIZED FOR THE PHASE IT NOW SITS IN.
  //
  // Updating `id` and nothing else was the whole defect. Several row families
  // are sized by fitness x PHASE — `progressive_tempo` from
  // PROGRESSIVE_TEMPO_MAIN_MINS (intermediate: build 24 / peak 28 / taper 20),
  // and every `pacedRepPlan` row from its WORK_TARGET band — so moving the
  // object across a phase boundary left it carrying the OLD block's dose.
  // Measured: 64 plans in a 2,916-input probe, all `progressive_tempo`, a build
  // dose (24 min main, 43 min stated) sitting in a peak week that needs 28/~48.
  // `INV-PLAN-STRUCTURED-SESSION-DURATION-COHERENT` (§8) fired on every one.
  //
  // Latent on main until now only because §79's re-entry window was inert, so
  // VO2max landed early and this swap rarely had to run.
  //
  // The board's amendment is that re-sizing goes through THE SAME SIZER the
  // constructor uses, inheriting its floor protections rather than growing a
  // second, bespoke resize path (Willy/Sims). `resizeForPhase` is therefore a
  // callback onto `makeQualitySession` supplied by the caller — this function
  // stays ignorant of pace/zone construction detail, and there is exactly one
  // implementation of "how big is this session in this phase" (D-08).
  //
  // Only the phase-dependent DOSE is adopted. Identity, label, coach notes and
  // the §1/Q2 threshold cue stay as they were: the session is the same session,
  // prescribed at the dose its new block calls for.
  //
  // ⚠️ CURRENTLY LATENT, AND SAID PLAINLY RATHER THAN IMPLIED LIVE. Measured
  // 2026-09-15: this swap branch fires on 0 of 2,304 varied inputs and 0 of the
  // 7,452-plan cohort grid — the plan is either already compliant or the window
  // is geometrically unreachable (346 of 2,304, recorded as
  // V2-vo2max-onset-unreachable). The swap only comes alive once §79's re-entry
  // window is repaired (QUALITY-ONSET-ORDER-01), because withholding VO2max is
  // what pushes the first VO2max session past the §5 deadline. So this re-size
  // changes no plan today; it is the prerequisite that stops the onset repair
  // shipping a build dose into a peak week. Filed as V2-SWAP-INERT-01.
  if (resizeForPhase) {
    resizeForPhase(vo2Session, toWeek, swapTarget.day)
    resizeForPhase(targetSession, fromWeek, firstVo2Pos.day)
  }

  // §22 Amendment (Coaching Board 2026-09-15) — V2-SWAP-S22-01.
  //
  // `fromWeek` held a VO2max session, which satisfies §22's per-week check BY
  // EXEMPTION (`isVo2maxSession`). The swap replaces it with a threshold row
  // that is not exempt, so a week that was legal becomes illegal — measured at
  // 288 ERROR violations, a completely homogeneous cohort (144x 5K + 144x 10K,
  // all time-targeted, all returning runners with recent_quality_training
  // 'regular'). `ruleEngine.ts`'s own construct-compliant comment already said
  // late swapping "breaks §22"; nothing enforced it.
  //
  // The board rejected making §79 yield (it reinstates the very defect §79
  // exists for — a returning runner's first quality session at Zone 4-5) and
  // rejected making §5 yield (Willy: pushing VO2max later compresses the same
  // dose into fewer weeks, a density increase for the runner whose tissue is
  // already the limiting factor). Swapping with a race_pace partner instead
  // covers only 144 of the 288 — measured — so it is a tactic, not a rule.
  //
  // So the displaced session is EXEMPT from §22's per-week naming check, on
  // exactly the footing of the three exemptions §22 already grants (VO2max,
  // effort-governed §40b, mixed-anchor §85), and with their identical
  // justification: the PLAN-level `INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO` still
  // holds the plan to a race-pace share, so exempting one week cannot let a
  // plan avoid race-specific work overall.
  //
  // Stamped STRUCTURALLY. A label or row-id test would be rewritten by the
  // enricher (D-17) — the same fault that silently killed the shakeout
  // invariant for months.
  targetSession.displaced_by_adaptation_window = true

  // Add the adaptation-window coach note onto the (now-earlier) vo2 session.
  appendCoachNote(
    vo2Session,
    'VO2max work requires 4–6 weeks to produce measurable adaptation. This session marks the start of that window.',
  )

  adjustments.push({
    rule:           'V2-vo2max-onset-timing',
    violation:      `First VO2max session was placed in week ${fromWeek.n}; latest compliant week is ${deadlineWeekN} (need ≥${GENERATION_CONFIG.VO2MAX_ONSET_MIN_ADAPTATION_WEEKS} adaptation weeks before taper).`,
    resolution:     `Swapped VO2max session to week ${toWeek.n} (${swapTarget.day}); displaced quality moved to week ${fromWeek.n}.`,
    weeks_affected: [fromWeek.n, toWeek.n].sort((a, b) => a - b),
  })
}

// V3 — propagate the meta-level HR-estimation note into session-level coach
// notes when the zones were derived from an estimated max HR. Targets:
//   • every session in Week 1
//   • the first session of each phase transition (base→build, build→peak,
//     peak→taper)
// Skipped on sessions whose week is already a recalibration week (the deload
// already carries the recalibration prompt — duplicate would be noise).
const HR_ESTIMATED_NOTE = 'HR zones in this plan are estimated from age. Run the first session by feel (RPE 4 = conversational, easy). If your HR sits consistently above or below target at that effort, flag it for zone recalibration.'

function applyV3HrEstimationNotePropagation(
  weeks: Week[],
  hrZoneMethod: string | undefined,
  recalibrationWeeks: number[] | undefined,
): void {
  if (hrZoneMethod !== 'percent_of_estimated_max') return
  const recalSet = new Set(recalibrationWeeks ?? [])

  // Week 1 — every active session.
  if (weeks.length > 0 && !recalSet.has(weeks[0].n)) {
    for (const s of Object.values(weeks[0].sessions)) {
      if (!s || s.type === 'strength' || s.type === 'rest' || s.type === 'race') continue
      appendCoachNote(s, HR_ESTIMATED_NOTE)
    }
  }

  // Phase transitions — first active session of the new phase.
  for (let i = 1; i < weeks.length; i++) {
    const prev = weeks[i - 1]
    const curr = weeks[i]
    if (curr.phase === prev.phase) continue
    if (recalSet.has(curr.n)) continue
    const first = firstActiveSession(curr)
    if (first) appendCoachNote(first, HR_ESTIMATED_NOTE)
  }
}

// V4 — long run distance must not repeat identically across more than
// LR_MAX_CONSECUTIVE_REPEATS non-deload weeks. Walks the plan, tracks runs of
// identical LR distance through non-deload weeks, and increments by
// LR_REPEAT_INCREMENT_KM on the third (and subsequent) consecutive week.
// Capped per race-distance multiplier so we don't push a 10K plan to a 25km
// long run by accident.
//
// Deload weeks reset the counter (they intentionally drop) and are themselves
// never modified. Race week is excluded.
function applyV4LongRunRepeatCeiling(
  weeks: Week[],
  input: GeneratorInput,
  pace: PaceGuide,
  adjustments: RuleAdjustment[],
): void {
  const raceDistanceKm = input.race_distance_km
  const distKey = raceDistanceKey(raceDistanceKm)
  const incrementKm = GENERATION_CONFIG.LR_REPEAT_INCREMENT_KM
  const maxRepeats  = GENERATION_CONFIG.LR_MAX_CONSECUTIVE_REPEATS
  const cap = raceDistanceKm <= 21
    ? raceDistanceKm * GENERATION_CONFIG.LR_RACE_DISTANCE_MULT_SHORT
    : raceDistanceKm * GENERATION_CONFIG.LR_RACE_DISTANCE_MULT_LONG
  const precision = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM

  // Time-based absolute cap. 5K finish-goal plans use a tighter cap per §40.
  let timeCapMins: number = GENERATION_CONFIG.LONG_RUN_CAP_MINUTES[distKey]
  if (distKey === '5K' && input.goal === 'finish') {
    timeCapMins = Math.min(timeCapMins, GENERATION_CONFIG.LONG_RUN_CAP_MINUTES_5K_FINISH)
  }

  // §52 long-run-as-fraction-of-weekly cap — V4 must not push LR above this
  // ratio. Mirrors LONG_RUN_MAX_PCT_OF_WEEKLY (60%).
  const lrMaxPctOfWeekly = GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_WEEKLY / 100

  // Streak state: tracks the last-seen non-deload LR distance and how many
  // consecutive non-deload weeks have carried that exact distance.
  let streakDist: number | null = null
  let streakCount = 0
  const incrementedWeeks: number[] = []

  for (let i = 0; i < weeks.length; i++) {
    const w = weeks[i]
    if (w.type === 'race') continue
    if (w.type === 'deload') {
      // Deload resets the streak — the post-deload week starts fresh.
      streakDist = null
      streakCount = 0
      continue
    }
    const lr = longRunOfWeek(w)
    // ⚠️ READS THE SESSION'S SIZE, NOT ITS `distance_km` FIELD (V4-ANCHOR-01,
    // 2026-09-19). This gate was `lr.session.distance_km == null`, and a
    // session is anchored EITHER by distance OR by duration — beginners and
    // ultra runners get duration-anchored long runs (§79/§80, time on feet),
    // so `distance_km` is null and V4 reset the streak and moved on. The rule
    // it enforces is written "LR_MAX_CONSECUTIVE_REPEATS non-deload weeks",
    // not "distance-anchored weeks", and it had never once run on the cohort
    // the founder ranks first.
    //
    // Measured before the fix: the duration-anchored exit was **81% of every
    // exit V4 took** — 17,268 skips against 380 fires on a 1-in-7 sample of
    // the cohort grid.
    //
    // ⚠️ AND THE OBVIOUS CONCLUSION FROM THAT NUMBER IS WRONG, so it is
    // recorded here rather than left for someone to re-derive. 81% of exits
    // sounds like most of the repeats; it is not. Plans carrying 3+ identical
    // consecutive long runs measured **30.3% duration-anchored against 30.4%
    // distance-anchored before the fix — indistinguishable** — because where
    // V4 already ran it was being blocked by the §40/§9 time cap and the
    // long-run ceiling anyway. After the fix the duration-anchored rate moves
    // **30.3% -> 27.8%**, distance-anchored unchanged at 30.4%.
    //
    // So this is a CORRECTNESS fix — a rule now applies to the cohort it
    // always claimed to cover — and buys 2.5pp, not the 81% the exit counter
    // suggests. **The residual 27.8% is V4 being weak everywhere, which is a
    // separate coaching-level question and is NOT fixed here.**
    //
    // Third occurrence of this exact class: LR-CAP-BLIND-01 (§45's cap) and
    // SESSION-KM-01/02 are the same `distance_km`-shaped hole.
    const lrKm = lr ? sessionKmSelfPaced(lr.session) : null
    if (!lr || lrKm == null) {
      streakDist = null
      streakCount = 0
      continue
    }
    const dist = lrKm
    if (streakDist != null && Math.abs(dist - streakDist) < 0.05) {
      streakCount++
      if (streakCount > maxRepeats) {
        // Increment this week's LR. The streak's tracked distance also
        // advances so subsequent weeks compare against the new floor.
        const proposed = dist + incrementKm
        const newKm = Math.min(
          Math.round(proposed / precision) * precision,
          Math.floor(cap / precision) * precision,
        )
        if (newKm <= dist + 0.01) continue  // capped out; no-op

        // Safety guards — V4 must not break other invariants. If applying
        // the increment would breach any of these, skip this week (the
        // repeat continues, but no other rule fires).
        const newWeekly = w.weekly_km + (newKm - dist)
        const newLrMins = newKm * pace.minPerKmEasy
        if (newLrMins > timeCapMins) continue                      // §40/§9 absolute time cap
        if (newKm / newWeekly > lrMaxPctOfWeekly + 0.005) continue // §52 LR/weekly cap (0.005 tolerance for rounding)

        // WRITE BACK TO THE ANCHOR THE SESSION ACTUALLY USES — the same
        // correction, and the same wording, as §45's cap at
        // `applyLongRunProgressionCap`. Setting `distance_km` on a
        // duration-anchored session would flip a beginner's card from minutes
        // to kilometres and break §79/§80's metric contract.
        if (lr.session.distance_km != null) {
          lr.session.distance_km = newKm
        }
        lr.session.duration_mins = dur(newKm, pace.minPerKmEasy)
        w.weekly_km = sumWeeklyKm(w.sessions, pace)
        w.long_run_hrs = computeLongRunHrs(w.sessions, pace)
        streakDist = newKm
        streakCount = 1  // fresh streak so the increment doesn't fire again next week
        incrementedWeeks.push(w.n)
      }
    } else {
      streakDist = dist
      streakCount = 1
    }
  }

  if (incrementedWeeks.length > 0) {
    adjustments.push({
      rule:           'V4-long-run-repeat-ceiling',
      violation:      `Long run distance repeated identically across more than ${maxRepeats} consecutive non-deload weeks.`,
      resolution:     `Incremented long run by ${incrementKm} km on weeks ${incrementedWeeks.join(', ')} (capped at race × ${raceDistanceKm <= 21 ? GENERATION_CONFIG.LR_RACE_DISTANCE_MULT_SHORT : GENERATION_CONFIG.LR_RACE_DISTANCE_MULT_LONG}).`,
      weeks_affected: incrementedWeeks,
    })
  }
}

// V5 — quality-session stimulus progression within the build phase.
// Walks build-phase quality sessions in order. If session N's stimulus rank
// is ≤ session N-1's rank, escalate session N to the next rank (when a
// suitable replacement exists in the catalogue / engine vocabulary).
// Exception: a quality session immediately following a deload week is
// allowed to regress — the deload resets the ladder.
//
// Escalation map (current → escalated): each transition keeps the session
// distance and HR target identical, only the label / zone / pace changes
// to match the new physiology. Implemented as a label rewrite + zone bump,
// not a full session regeneration — keeps the change minimal.
function applyV5StimulusProgression(
  weeks: Week[],
  raceDistanceKm: number,
  pace: PaceGuide,
  zones: ZoneTargets,
  adjustments: RuleAdjustment[],
): void {
  // Collect build-phase quality positions in week-order.
  type Pos = { weekIdx: number; day: Day; session: Session; rank: number; afterDeload: boolean }
  const positions: Pos[] = []
  for (let i = 0; i < weeks.length; i++) {
    const w = weeks[i]
    if (w.phase !== 'build') continue
    if (w.type === 'race' || w.type === 'deload') continue
    const afterDeload = i > 0 && weeks[i - 1].type === 'deload'
    for (const [d, s] of Object.entries(w.sessions) as [Day, Session | undefined][]) {
      if (!s || s.type !== 'quality') continue
      const key = classifyStimulus(s)
      if (!key) continue
      positions.push({
        weekIdx: i, day: d, session: s, rank: GENERATION_CONFIG.STIMULUS_RANK[key], afterDeload,
      })
    }
  }
  if (positions.length < 2) return

  const escalatedWeeks: number[] = []
  // VO2max only meaningful for short races (catalogue eligibility).
  const canEscalateToVo2 = raceDistanceKm <= 12

  for (let k = 1; k < positions.length; k++) {
    const curr = positions[k]
    const prev = positions[k - 1]
    if (curr.afterDeload) continue  // deload resets the ladder
    // Only true regressions trigger escalation. Equal-rank consolidation
    // (e.g. tempo → tempo for marathon plans where the catalogue has no
    // rank-5 vo2max for marathon) is normal coaching and should not be
    // forced upward — there is no upward path in the catalogue.
    if (curr.rank >= prev.rank) continue

    // Pick a target rank: one above prev. Choose label class by target rank.
    const targetRank = prev.rank + 1
    let escalated = false
    if (targetRank <= 4) {
      // Bump to tempo (or stay at tempo if already there but ranks tied).
      // Mechanically: rewrite to a "Continuous tempo" / threshold session.
      const s = curr.session
      s.label        = 'Continuous tempo'
      s.zone         = 'Zone 3'
      s.hr_target    = zones.qualityHR
      s.pace_target  = pace.qualityPaceStr
      s.coach_notes  = ['Sustainable. Same pace at the end as at the start.']
      curr.rank = GENERATION_CONFIG.STIMULUS_RANK.tempo
      escalated = true
    } else if (targetRank === 5 && canEscalateToVo2) {
      const s = curr.session
      s.label        = 'Classic VO2max'
      s.zone         = 'Zone 4–5'
      s.hr_target    = zones.intervalsHR
      s.pace_target  = pace.intervalPaceStr
      s.coach_notes  = ['Three minutes is long. Don\'t blow rep one.']
      curr.rank = GENERATION_CONFIG.STIMULUS_RANK.vo2max
      escalated = true
    }
    if (escalated) escalatedWeeks.push(weeks[curr.weekIdx].n)
  }

  if (escalatedWeeks.length > 0) {
    adjustments.push({
      rule:           'V5-stimulus-progression',
      violation:      'Build-phase quality session(s) regressed in stimulus rank vs the prior quality.',
      resolution:     `Escalated quality on weeks ${escalatedWeeks.join(', ')} to maintain progressive build-phase stimulus.`,
      weeks_affected: escalatedWeeks,
    })
  }
}

// V7 — taper rationale coach note. Adds a coach note to the first session of
// the first taper week (excluding race week) explaining why the taper length
// is what it is. Coaching rationale: athletes mistrust short tapers ("only
// one week?") and over-taper long ones ("three weeks is too much rest").
// A direct sentence about why it's the right length pre-empts both.
function applyV7TaperRationale(
  weeks: Week[],
  raceDistanceKm: number,
): void {
  const firstTaperIdx = weeks.findIndex(w => w.phase === 'taper' && w.type !== 'race')
  if (firstTaperIdx < 0) return
  const target = firstActiveSession(weeks[firstTaperIdx])
  if (!target) return

  // analysis F9 — the note used to be chosen from race DISTANCE while the taper
  // length came from TAPER_QUALITY_PER_WEEK[distKey].length. Two owners for one
  // fact (D-08), so a 21.1 km race got a three-week taper described as "two
  // week taper". Count the weeks that actually exist.
  const taperWeeks = weeks.filter(w => w.phase === 'taper').length
  const WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five']
  const word = WORDS[taperWeeks] ?? String(taperWeeks)

  // "Intensity stays" is only true if the taper actually prescribes any.
  const taperHasQuality = weeks
    .filter(w => w.phase === 'taper')
    .some(w => Object.values(w.sessions).some(
      s => s?.type === 'quality' || s?.type === 'intervals' || s?.type === 'tempo',
    ))

  let rationale: string
  if (taperWeeks <= 1) {
    rationale = 'More would risk arriving flat.'
  } else if (raceDistanceKm > 50) {
    rationale = 'Your aerobic base is what carries you — arriving rested matters more than last-minute fitness.'
  } else {
    rationale = 'Long enough for adaptation to consolidate without losing sharpness.'
  }

  const closer = taperHasQuality ? ' Intensity stays, volume drops.' : ' Volume drops. Trust the work.'
  appendCoachNote(target, `${word} week taper. ${rationale}${closer}`)
}

// V6 — emit pre-plan buffer guidance when prep_time_weeks_available exceeds
// prep_time_weeks_required by more than the threshold. Returns the guidance
// block (or null) — the caller attaches it to the plan.
function buildV6PrePlanGuidance(
  prepTime: PrepTimeResult,
  planStartIso: string,
  todayIso: string,
): { buffer_weeks: number; guidance: string; week_estimate: string } | null {
  const available = prepTime.weeks_available
  const required  = prepTime.weeks_required_ok
  if (typeof available !== 'number' || typeof required !== 'number') return null
  const buffer = available - required
  if (buffer <= GENERATION_CONFIG.PRE_PLAN_BUFFER_WEEKS_THRESHOLD) return null
  return {
    buffer_weeks: buffer,
    guidance: 'Maintain your current weekly volume. Include 2–3 easy aerobic sessions per week. No quality or interval work. Arrive at Week 1 healthy and consistent.',
    week_estimate: `${todayIso} → ${planStartIso}`,
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export type Tier = 'free' | 'trial' | 'paid'

// ─── Goal pace from target time ───────────────────────────────────────────────

function calcGoalPace(distanceKm: number, targetTime: string): string | null {
  const mins = parseBenchmarkTime(targetTime)
  if (!Number.isFinite(mins) || mins <= 0) return null
  const paceMinPerKm = mins / distanceKm
  return `${formatPace(paceMinPerKm)} /km`
}

// ─── Apply new benchmark to all sessions from a given week ───────────────────
// Used by the recalibrate-zones API to update future weeks after a re-test.

export function applyRecalibration(
  plan: Plan,
  benchmark: BenchmarkInput,
  fromWeekN: number,
): Plan {
  const rawVdot = calcVDOTFromBenchmark(benchmark)
  if (!Number.isFinite(rawVdot) || rawVdot <= 0) return plan

  // Apply the same conservative discount as initial generation (CoachingPrinciples §10).
  const { vdot, discountPct } = applyVdotDiscount(rawVdot, benchmark, new Date())

  const mhr = plan.meta.max_hr
  const rhr  = plan.meta.resting_hr > 0 ? plan.meta.resting_hr : undefined
  const zones = computeZones(mhr, rhr)
  const pace  = buildPaceFromVDOT(vdot, rawVdot)

  const updated: Plan = JSON.parse(JSON.stringify(plan))
  updated.meta.vdot                       = Math.round(rawVdot * 10) / 10
  updated.meta.vdot_training_anchor       = Math.round(vdot * 10) / 10
  updated.meta.benchmark                  = benchmark
  if (discountPct > 0) updated.meta.vdot_discount_applied_pct = discountPct

  for (const week of updated.weeks) {
    if (week.n < fromWeekN) continue
    for (const session of Object.values(week.sessions)) {
      if (!session || session.type === 'strength' || session.type === 'rest') continue
      if (session.type === 'easy' || isLongRun(session) || session.type === 'recovery') {
        session.hr_target    = zones.easyHR
        session.pace_target  = pace.easyPaceStr
      } else if (session.type === 'quality' || session.type === 'tempo' || session.type === 'intervals') {
        session.hr_target    = zones.qualityHR
        session.pace_target  = pace.qualityPaceStr
      }
    }
  }

  return updated
}

// ─── §98 — the §1 yield ladder (Coaching Board CB-ONSET-YIELD-01, 2026-09-10) ──
//
// §89 grants a demonstrably-ready runner a shorter all-easy base so quality
// starts sooner. Measured 2026-09-10, that grant BREACHES §1 on its own: over a
// 240-plan grid, 34 of 212 gated plans exceeded their distance ceiling (worst
// HM@3d 29.5% against 20%), and the SAME cells with the gate closed produced
// ZERO breaches. 11 of the 34 carried no §57 foundation block at all, so §91's
// on-ramp credit — which the defect was originally filed against — is an
// amplifier, not the cause.
//
// THE BOARD RULED §1 BINDS AND THE ONSET YIELDS. This is §97's own stated
// disposition ("the on-ramp yields, not the ceiling"), applied where §97's two
// gates could not reach: they set the base CAP, and §91's credit then subtracts
// from it, so base landed at 0 whether the gate granted or denied.
//
// WHY A LADDER AND NOT A NUMBER. Three threshold-shaped levers were measured and
// died, the last decisively: breaches occur at `ceiling_fraction × days_available`
// of 0.60 AND 1.25, so no proxy separates them. This measures the actual §1 share
// instead of predicting it — there is no constant to drift, and the breach becomes
// impossible by construction rather than caught afterwards (CB-FOUNDATION-DENOM-01:
// "a defect class that cannot occur beats a check that catches it").
//
// THE BOUND IS THE LOAD-BEARING PART. An unbounded ladder fixed all 34 breaches
// and introduced a regression: one runner ended up with a LATER first quality
// session than the same runner ungated (effective on-ramp 6 vs 5) — which is
// exactly the §91 non-monotonicity defect, where demonstrating readiness makes
// your plan more conservative. So the ladder never walks past the ungated
// runner's EFFECTIVE on-ramp (base + §57 foundation weeks, per §91 — the runner
// cannot tell the two apart), and if no rung complies within that bound it
// returns the genuinely ungated plan. That is the ladder's true terminal rung,
// and it is §1-clean by measurement.
//
// MEASURED, bounded, over the same 240-plan grid: 178 plans clean at full
// benefit (84% of the gated cohort keep §89 untouched) · 33 corrected within the
// bound (rungs 1/2/3 = 13/16/4) · 1 fell back to ungated · §1 breaches remaining
// ZERO · plans worse than ungated ZERO. Mean cost to a corrected plan +1.71
// on-ramp weeks, max +3.
//
// The §1 check runs on the BARE plan, which is only sound because
// CB-FOUNDATION-DENOM-01 (2026-09-10) made §1 count main-plan weeks only — the
// bare and assembled verdicts are now identical, so the ladder does not need the
// ADR-020 compose path.
export function generateRulePlan(
  rawInput: GeneratorInput,
  tier: Tier,
  planStart?: string,
  catalogue: SessionCatalogueRow[] = V1_SESSION_CATALOGUE,
  todayOverride?: string,
): Plan {
  // §22 / GOAL-COHERENCE-01 — normalised by its single owner, which the
  // validator calls too. See `coherentGoal` in inputs.ts for why one side
  // fixing this was not enough.
  const input = coherentGoal(rawInput)

  const build = (relax: number, ungated: boolean, avoidPos2 = true) =>
    buildRulePlanOnce(input, tier, planStart, catalogue, todayOverride, relax, ungated, false, avoidPos2)

  const breachesIntensity = (plan: Plan) =>
    validatePlan(plan, input).some(v => v.code === 'INV-PLAN-INTENSITY-DISTRIBUTION')

  // §91 — the on-ramp the RUNNER counts: all-easy main-plan base weeks plus the
  // §57 foundation weeks that will be prepended ahead of week 1.
  const effectiveOnRamp = (plan: Plan) =>
    plan.weeks.filter(w => w.n >= 1 && w.phase === 'base').length
    + (plan.meta.foundation_weeks_planned ?? 0)

  const finalise = (plan: Plan, yielded?: { rungs: number; bound: number }) => {
    if (yielded) {
      plan.meta.onset_yield = { ...yielded, effective: effectiveOnRamp(plan) }
    }
    // §111 — the base-build ceiling. Refuse (with the base to reach) before the
    // generic invariant throw, so the runner gets the structured "not yet"
    // refusal and its alternatives rather than a bare violation. Thrown here, on
    // the single exit path, so every candidate the ladder can return is checked
    // against the plan it actually delivers. Mirrors the §44/§52 refusals.
    const bb = assessBaseBuild(plan, input)
    if (bb.exceeded) throw new BaseVolumeError(baseVolumeRefusal(bb, input))

    // COPY-STALE-GEN-01 (2026-09-19) — WEEK COPY IS REFRESHED ON THE GENERATION
    // PATH, NOT ONLY ON RESHAPE.
    //
    // ⚠️ THE REPAIR ALREADY EXISTED AND THE GENERATOR COULD NOT REACH IT.
    // `refreshWeekCopyIfStale` detects a week whose label/theme promise work
    // the sessions do not contain and rewrites both. It had exactly ONE caller:
    // `app/api/adjust-plan/route.ts`. So a plan whose copy went stale DURING
    // GENERATION shipped stale, and only a later reshape would ever fix it.
    //
    // ⚠️ MEASURED: 96 of the 100K envelope's plans shipped with error-severity
    // violations — `INV-PLAN-COPY-MATCHES-SESSIONS` and
    // `INV-PLAN-RECALIBRATION-HAS-SESSION` on a week labelled "Build — recovery
    // + benchmark" whose theme promises "one hard effort in the middle" and
    // whose three sessions are all easy. Every one was 3 days/week at 100K on a
    // 26-week runway. In PRODUCTION these ship: `enforceViolations` throws only
    // under development/test and otherwise logs.
    //
    // ⚠️ WHY THE COPY WENT STALE, WHICH IS THE ACTUAL BUG: the label reads
    // `hasBenchmark` — a FACT, `sessions.some(type === 'hard')` — so it was
    // correct when written. A later post-pass removed the hard session and
    // nothing re-read the copy. Identical shape to LONG-SESSION-FUEL-01 hours
    // earlier, where a duration read at placement was 116 min against the 124
    // the runner receives. A value computed mid-pipeline is stale by the end of
    // it; copy about sessions belongs AFTER every pass that can move a session.
    //
    // It runs here, immediately before validation, so nothing can mutate a
    // session between the refresh and the check.
    for (const w of plan.weeks) refreshWeekCopyIfStale(plan, w.n)

    // §78 — AND THE METADATA FOLLOWS THE PLAN TOO, WHICH IS THE PRINCIPLE'S
    // OWN WORDING AND WAS ONLY HALF TRUE.
    //
    // `recalibrationWeeks` is built inside the week loop and already gates on
    // the FACT (`sessions.some(type === 'hard')`) rather than the intent —
    // §78's comment says so explicitly. But it is computed MID-PIPELINE, and a
    // later pass removes the hard session, so the array kept a week that no
    // longer holds a benchmark. Fixing the copy alone left
    // `INV-PLAN-RECALIBRATION-HAS-SESSION` still firing on all 96 plans.
    //
    // Recomputed from the finished weeks. §78: "the metadata follows the
    // produced plan, never the intent" — this is that sentence, applied at the
    // point the plan is actually produced.
    //
    // Coaching Board EXEMPT: a defect fix restoring documented intent. It
    // changes no prescription; it stops the plan claiming a session it does
    // not contain.
    if (plan.meta.recalibration_weeks?.length) {
      const real = plan.meta.recalibration_weeks.filter(n => {
        const w = plan.weeks.find(x => x.n === n)
        return !!w && Object.values(w.sessions ?? {}).some(sn => sn?.type === 'hard')
      })
      if (real.length) plan.meta.recalibration_weeks = real
      else delete (plan.meta as { recalibration_weeks?: number[] }).recalibration_weeks
    }

    enforceViolations(validatePlan(plan, input))
    return plan
  }

  // §95 Amendment 1 (Coaching Board 2026-09-15) — THE POSITION-2 PREFERENCE
  // YIELDS TO §1, exactly as §89's onset does under §98.
  //
  // Re-locating a deload changes session COMPOSITION, not just placement: the
  // board's measured table showed a marathon going [4,8,12] -> [2,6,10], which
  // turns former-recovery week 12 into a quality-carrying loading week (+1
  // hard) while the earlier placements shed 3 running sessions. Numerator up
  // AND denominator down, so the §1 share crosses the ceiling — 19.6% against
  // MARATHON's 18% (10 hard / 51 running), reproduced exactly by the sweep.
  //
  // Position-2 is a PREFERENCE (§95 is a `warn`) and §1 is a ceiling, so the
  // preference gives way and the plan reverts to §87's placement. Same shape as
  // §98: measure the actual share rather than predict it, so there is no
  // constant to drift and no proxy to be wrong.
  // The yield triggers on ANY error the §87 placement does not also have, not
  // on §1 alone. The board ruled against §1 because that is the breach its table
  // measured, but the MECHANISM is composition drift — re-locating a deload
  // changes which weeks carry quality — and that drift also breaks §53's
  // variety cap (`progressive_tempo` 5 times against a cap of 4, same plan).
  // A preference that costs a ratified ceiling is not worth its benefit
  // whichever ceiling it is, so the comparison is "did this make things worse
  // than §87's placement", answered by measurement rather than by listing codes.
  const errorCount = (plan: Plan) =>
    validatePlan(plan, input).filter(v => v.severity === 'error').length

  const withPos2 = build(0, false)
  let atFullBenefit = withPos2
  if (errorCount(withPos2) > 0) {
    const basePlacement = build(0, false, false)
    if (errorCount(basePlacement) < errorCount(withPos2)) {
      atFullBenefit = basePlacement
      atFullBenefit.meta.deload_position2_yielded = true
    }
  }

  // Not §89-gated, or already compliant: the overwhelming majority. No extra work.
  if (!atFullBenefit.meta.early_quality_onset || !breachesIntensity(atFullBenefit)) {
    return finalise(atFullBenefit)
  }

  const ungatedPlan = build(0, true)
  const bound = effectiveOnRamp(ungatedPlan)

  for (let rung = 1; rung <= GENERATION_CONFIG.ONSET_YIELD_MAX_RUNGS; rung++) {
    const candidate = build(rung, false)
    // Never trade a §1 breach for the §91 defect.
    if (effectiveOnRamp(candidate) > bound) break
    if (!breachesIntensity(candidate)) return finalise(candidate, { rungs: rung, bound })
  }

  return finalise(ungatedPlan, { rungs: 0, bound })
}

function buildRulePlanOnce(
  input: GeneratorInput,
  tier: Tier,
  planStart?: string,
  catalogue: SessionCatalogueRow[] = V1_SESSION_CATALOGUE,
  // INTENSITY-FOUNDATION-BLIND-02 — `today` is an INPUT to generation, not an
  // ambient fact. It decides the §57 gap class and therefore how many all-easy
  // foundation weeks §91 credits against the base on-ramp, so a caller that
  // pins `planStart` while leaving `today` to the wall clock is generating a
  // plan for a timeline that does not exist.
  //
  // That is exactly what the property sweep was doing: PLAN_START is pinned to
  // 2026-04-27, `gapDays` clamps negatives to 0, so generation saw gap 0 ('none',
  // zero foundation weeks) for all 16,038 plans while the sweep then composed
  // 3-week blocks against its own synthetic `today`. Generation and composition
  // were reasoning about different calendars — the two-writer split §91's own
  // single-owner comment exists to prevent — which is why the sweep could not
  // execute this file's foundation path at all, and why its results drifted with
  // the wall-clock date despite a pinned seed.
  //
  // Production passes nothing and keeps the wall clock, unchanged.
  todayOverride?: string,
  // §98 — set by the ladder in generateRulePlan. Never passed by production callers.
  onsetRelax = 0,
  suppressEarlyOnset = false,
  // Intermediate rungs are candidates, not deliveries — only the CHOSEN plan is
  // put to the constitution, or a discarded attempt would throw in dev/test.
  validate = true,
  // §95 Amendment 1 — set by the yield in generateRulePlan. When false the
  // deload walk uses §87's placement only, dropping the position-2 preference.
  // Never passed by production callers.
  deloadAvoidPosition2 = true,
): Plan {
  const planStartIso = planStart ?? formatDate(nextMonday())
  const today = todayOverride ?? formatDate(new Date())

  // CoachingPrinciples §55 — reject nonsense / out-of-range inputs before
  // any other logic. Distinct from §44 (prep-time) and §50 (HR fallbacks):
  // L-01 rejects values that can't be reasoned about (age:0, resting_hr:0,
  // max_hr:50). Throws InputFieldError.
  validateInputFields(input)

  // CoachingPrinciples §52 (low-day extension) — days-availability gate.
  // Refuses inputs where days/week is below the per-distance minimum
  // (marathon and ultras require ≥3, ideally ≥4). Throws DaysAvailableError
  // on block / warn-unacknowledged. Runs before prep-time so the more
  // structural infeasibility surfaces first.
  const daysCheck: DaysAvailableResult = enforceDaysAvailable(input as PrepTimeAwareInput, planStartIso)

  // CoachingPrinciples §44 — prep-time validation. Runs first so block/warn
  // outcomes surface before any generation work. Throws PrepTimeError on
  // block or warn-without-acknowledgment; falls through with a result the
  // meta block consumes when ok or warn-acknowledged.
  const prepTime: PrepTimeResult = enforcePrepTime(input as PrepTimeAwareInput, planStartIso)

  // CoachingPrinciples §113 — long-run readiness. Runs with the other input
  // gates, before any generation work, because it is a fact about the runner
  // rather than about the plan they would get. Throws LongRunReadinessError,
  // the same shape as §44/§52/§111, so the route renders one refusal screen.
  //
  // MOVED HERE FROM app/api/generate-plan/route.ts, where it was a hardcoded
  // `longest_recent_run_km < 5` with a bare string. In the route it was
  // invisible to the sweep, to configPrincipleSync and to the coaching-guard
  // hook — the same blind spot that let me "refute" §111's threshold by
  // measuring the engine and never going through the boundary.
  {
    // §113 Am.1 — the runway is what turns "not ready" into "not ready YET".
    // weeksBetweenLocal is the same helper §44 uses, so the two gates cannot
    // disagree about how long a runway is.
    const readiness = assessLongRunReadiness(
      input,
      input.race_date ? weeksBetweenLocal(planStartIso, input.race_date) : undefined,
    )
    if (!readiness.ok) throw new LongRunReadinessError(readiness)
  }

  // ── Derive zones with HR fallback hierarchy (CoachingPrinciples §50) ────────
  const hrFallback = buildHRZonesWithFallback(input)
  const derivedMaxHR = hrFallback.derived_max
  const zones = hrFallback.zones

  // ── Derive VDOT, fitness level, paces ───────────────────────────────────────
  let vdotDiscountPct = 0
  let vdotRaw: number | undefined
  const vdot: number | undefined = (() => {
    if (!input.benchmark) return undefined
    const raw = calcVDOTFromBenchmark(input.benchmark)
    if (!Number.isFinite(raw) || raw <= 0) return undefined
    vdotRaw = raw
    const { vdot: discounted, discountPct } = applyVdotDiscount(raw, input.benchmark, new Date())
    vdotDiscountPct = discountPct
    return discounted
  })()

  // D2 — VDOT and volume answer different questions; consult both. §79 (2026-08-31)
  // — a deep training age lifts the INTENSITY read off the beginner floor for a
  // returning runner whose current volume alone would misclassify them.
  const trainingAgeIsExperienced = input.training_age === '2-5yr' || input.training_age === '5yr+'
  const assessed = assessFitness(input.current_weekly_km, input.longest_recent_run_km, vdot, trainingAgeIsExperienced)
  // §79 (2026-09-02, Coaching Board) — TWO axes, TWO inputs. Do not merge them.
  //
  //   `input.fitness_level`       — the API-level STRUCTURAL declaration. When
  //                                 supplied it stands in for the volume-derived
  //                                 assessment (long-standing contract; the
  //                                 archetype matrix and property sweep rely on
  //                                 it). Unchanged by this amendment.
  //   `input.user_declared_level` — what the RUNNER picked in the wizard.
  //
  // The runner's declaration binds asymmetrically:
  //   UPWARD   → intensity allowance only. Peak km, the week-1 volume floor, the
  //              ramp and the long-run caps stay on the assessment.
  //   DOWNWARD → both. A runner volunteering caution is credible about caution.
  //
  // The previous revision let a declaration set `fitness`, and `fitness` sets
  // `peakKm`, and `peakKm` sets the week-1 floor at BUILD_VOL_INIT_FLOOR_VS_PEAK
  // (`Math.max(startKm, initFloor)`) — so a dropdown raised starting tonnage
  // above the runner's actual current volume. The comment that used to sit here
  // claimed the start volume was independent of the level; line 477 disagreed.
  // Measured before the fix: 10K 15km/wk declaring `experienced` went wk1 13→20,
  // peak 18→35; a `<6mo` novice's marathon peak went 42→55.
  const assessedStructural: FitnessLevel = input.fitness_level ?? assessed.structural
  const assessedIntensity:  FitnessLevel = input.fitness_level ?? assessed.intensity

  const declaredLevel = input.user_declared_level
  const declaredIsDownward =
    declaredLevel !== undefined
    && FITNESS_RANK[declaredLevel] < FITNESS_RANK[assessedStructural]

  // Structure moves for a declaration ONLY downward (the config flag names the
  // rule; flipping it to false would restore symmetric binding).
  const fitness: FitnessLevel =
    (GENERATION_CONFIG.USER_DECLARED_LEVEL_BINDS_STRUCTURE_DOWNWARD_ONLY
      ? (declaredIsDownward ? declaredLevel! : assessedStructural)
      : (declaredLevel ?? assessedStructural))

  // Intensity always follows the declaration when there is one — that is the
  // agency the wizard offers. §1's distribution ceiling and the §79 re-entry
  // gate remain binding at the elevated level.
  const intensityFitness: FitnessLevel = declaredLevel ?? assessedIntensity

  const rhr = input.resting_hr && input.resting_hr > 0 ? input.resting_hr : undefined
  const pace: PaceGuide = (vdot !== undefined && vdotRaw !== undefined)
    ? buildPaceFromVDOT(vdot, vdotRaw)
    : buildFallbackPace(fitness)

  const goalPace = input.goal === 'time_target' && input.target_time
    ? calcGoalPace(input.race_distance_km, input.target_time)
    : null

  const config = getDistanceConfig(input.race_distance_km)
  // CoachingPrinciples §76 — `planStartIso` is the EARLIEST the plan could begin;
  // calcPlanLength anchors on race week and returns the actual start. Surplus
  // weeks delay the start rather than truncating the end. Everything downstream
  // (week dates, meta.plan_start) must use the anchored value.
  // ── §97 (CB-ONSET-03) — the readiness gate is decided BEFORE plan length ──
  //
  // These were computed ~20 lines below `calcPlanLength` purely by convention.
  // None of them depends on plan length: `peakKm` is distance + fitness, and the
  // fresh/returning/tissue predicates are input + fitness assessment. Verified
  // before moving, because a genuine cycle here would have made §97 unbuildable
  // rather than merely awkward.
  //
  // They must come first now, because §97 lets a gated runner's plan RUN LONGER
  // instead of being preceded by a §57 foundation block — so plan length depends
  // on the gate, and the gate must not depend on plan length.
  // CoachingPrinciples §29 — fresh-from-layoff detection. Two paths:
  //  1. Explicit: weeks_at_current_volume < threshold.
  //  2. Heuristic (R2/M-03): training_age says experienced, but current volume
  //     and longest recent run are both below floors typical of that experience.
  const explicitFreshReturn = input.weeks_at_current_volume !== undefined
    && input.weeks_at_current_volume < GENERATION_CONFIG.FRESH_RETURN_WEEKS_THRESHOLD
  // trainingAgeIsExperienced declared above (fed to assessFitness for the §79 lift).
  const heuristicFreshReturn = trainingAgeIsExperienced
    && input.current_weekly_km < GENERATION_CONFIG.HEURISTIC_FRESH_RETURN_WEEKLY_KM
    && input.longest_recent_run_km < GENERATION_CONFIG.HEURISTIC_FRESH_RETURN_LONG_RUN_KM
  const isFreshReturn = explicitFreshReturn || heuristicFreshReturn

  // §111 Am.1 — extracted to `lib/plan/startVolume.ts`, which §111 now also
  // reads. It used to live only here while §111 measured its ratio against the
  // RAW declared volume, so the gate scored a build no runner experienced
  // (declared 50, started at 30: scored 1.2x, actual 1.8x).
  const startKm = effectiveStartKm(input)

  // §106 (Coaching Board MAINT-PROFILE-01, 2026-09-11) — THE CEILING GETS A FLOOR.
  //
  // `peakKmByLevel` reads distance and fitness level and never asks what the
  // runner already runs. Measured: a 100 km/week experienced marathoner was
  // handed a block starting at 76 km and peaking at 73 — below their own current
  // volume in both directions. §23 then correctly observed the peak was 96% of
  // week 1 and labelled the plan maintenance, so every honesty layer worked
  // perfectly on a plan that should never have been built. §23 and §46 license
  // maintenance when THE RUNNER'S constraints prevent overload — they name
  // `days_available` and `max_weekday_mins`. Neither was binding here. Ours was.
  //
  // A FLOOR, NOT A SCALED TARGET (Willy's condition of approval; he would veto
  // the general form). This adds no tissue load: `startKm` is already the
  // runner's declared volume, and all this does is refuse to build a curve whose
  // top is below its own start. §2's 10% rule, §45's long-run cap and §3's
  // deload cadence stay fully binding — nothing here permits a bigger
  // week-to-week step. §10/CD-6's `<6mo` over-claim cap governs `startKm` above,
  // so a novice's over-stated volume cannot reach this line un-capped.
  //
  // Ordering: `startKm` and the fresh-return predicates moved up with it. Both
  // depend only on `input` and the fitness assessment, never on plan length, so
  // the §97 constraint documented above (the gate must not depend on plan
  // length) is preserved.
  //
  // ⚠️ §79 YIELDS NOTHING HERE, AND §106 YIELDS TO IT. The conflict scan for
  // MAINT-PROFILE-01 missed §79 and the engine caught it: a runner who declares
  // UPWARD gets an intensity allowance only — "peak km, the week-1 volume floor,
  // the ramp and the long-run caps stay on the assessment". A floor that lifts
  // `peakKm` above the assessed band is exactly the tonnage rise §79 exists to
  // refuse, and `INV-PLAN-USER-LEVEL-NO-UPWARD-TONNAGE` cannot tell a floor
  // driven by `current_weekly_km` from one driven by the dropdown.
  //
  // So the floor does not apply to an upward declaration. The residual is real
  // and deliberate — a declared-upward runner on high volume still gets a
  // reduced plan — and it is VISIBLE rather than silent:
  // `INV-PLAN-PEAK-NOT-BELOW-START` warns on it. The two principles compose;
  // neither was weakened to fit the other.
  const standardLevelPeakKm = config.peakKmByLevel[fitness]

  // §117 — THE FINISH-GOAL RUN-WALK MARATHON.
  //
  // §111's door is `ceil(peak / MAX_BASE_BUILD_RATIO)`, so a plan built to
  // COMPLETE the distance rather than run it has a lower peak and therefore a
  // lower door: 32 km/wk puts it at 8 rather than 13. That is how a runner we
  // currently refuse is admitted **without loosening anything** — §2's ramp,
  // §3's cadence and §111's ratio are all untouched.
  //
  // ⚠️ Derived, never asked. A runner who has told their friends they are
  // running a marathon will not tick a box marked "I will walk some of it",
  // and asking would filter out the exact cohort this serves.
  // ⚠️ EVALUATED EXACTLY ONCE. The stamping pass later in this file used to
  // call `runWalkApplies` a SECOND time with a different argument shape — two
  // evaluations of one predicate, which is the DELOAD-OWNER-01 fault (five
  // copies of a cadence that agreed only by accident of control flow). The
  // second site now reads `plan.meta.finish_goal_run_walk`.
  // ⚠️ THE RUNWAY IS COMPUTED FROM THE DATES, NOT FROM `calcPlanLength`, which
  // runs 70 lines below this point. It has to: the peak depends on `isRunWalk`
  // and the plan length would depend on the peak, so reading the length here
  // would be circular. `weeksBetweenLocal` is peak-independent and is the
  // single owner of "how many weeks between these two dates".
  const runwayWeeks = weeksBetweenLocal(planStartIso, input.race_date)
  const isRunWalk = runWalkApplies(input, standardLevelPeakKm, runwayWeeks)
  const levelPeakKm = isRunWalk ? runWalkPeakKm() : standardLevelPeakKm

  const declaredUpward = declaredLevel !== undefined
    && FITNESS_RANK[declaredLevel] > FITNESS_RANK[assessedStructural]
  // ⚠️ §117 PLANS DO NOT TAKE THE START-VOLUME FLOOR. `PEAK_FLOOR_VS_START_RATIO`
  // raises the peak to at least the runner's current volume, which is right for
  // a normal plan and self-defeating here: this runner's whole problem is that
  // their base is low, and floating the peak back up would re-close the door
  // the lower peak just opened.
  const peakKm = (declaredUpward || isRunWalk)
    ? levelPeakKm
    : Math.max(levelPeakKm, startKm * GENERATION_CONFIG.PEAK_FLOOR_VS_START_RATIO)


  // Fresh-return runners get the standard 10% ramp (no allowance) — their
  // structural base is gone and the cap exists to protect them.
  const returningRunner = !isFreshReturn && isReturningRunner(input, peakKm)

  // §89 — EXPERIENCE-GATED QUALITY ONSET. The signal is DEMONSTRATED recent
  // structured hard training, a tissue-readiness proxy, NOT self-image. An
  // injury history is an absolute veto (Willy/Sims).
  const injuryFree = (input.injury_history ?? []).length === 0
  // Tissue conditioned by the exact stimulus §2196 protects — the premise-falsifier.
  const tissueConditioned =
    input.recent_quality_training === 'regular' && injuryFree && trainingAgeIsExperienced

  // §96 — `overdo` is a BRAKE, not a preference. It was byte-identical to
  // `neutral` in every measured cell (training_age x distance x injury): a
  // wizard option that could never change anything, for any runner, ever.
  // §35 builds a three-tier ladder UPWARD for runners who want more work
  // (floor -> target -> stretch, selected by `love`) and never built the rung
  // going the other way. This is that rung.
  const overdoBrake = GENERATION_CONFIG.OVERDO_IS_A_BRAKE
    && input.hard_session_relationship === 'overdo'

  // §110 — `avoid` joins §96's brake on ONSET (not on the Z2 cue, which §96
  // scoped to `overdo`'s specific drift failure mode). Same argument as §96's:
  // §89's gate is a list of DEMONSTRATED READINESS signals, and a runner who
  // has told us they steer away from hard sessions is not the runner to hand
  // intensity to two weeks early. Willy's position on the board; McMillan
  // dissented, wanting the reduced dose to start on the normal schedule, and
  // the dissent is recorded in §110 because the data that would settle it
  // (first-quality-session adherence by hard_session_relationship) does not
  // exist yet. Reuses the existing gate rather than adding a parallel one.
  const cautionBrake = overdoBrake || input.hard_session_relationship === 'avoid'

  // §98 — the ladder's terminal rung regenerates the runner as if ungated.
  const earlyQualityOnset = !suppressEarlyOnset && tissueConditioned
    && intensityFitness === 'experienced'
    && FITNESS_RANK[fitness] >= FITNESS_RANK['intermediate']
    && !returningRunner && !isFreshReturn
    // §96 (CB-HSR-01) — a runner who says "I overdo it. Rein me in." does not
    // get quality two weeks sooner, however ready every other signal says they
    // are. §89's gate is a list of DEMONSTRATED READINESS signals; this is the
    // one declared RISK signal, and §79 already holds that self-report is
    // trusted MORE when it points toward caution than when it points toward
    // more work. Ignoring it entirely was the inconsistency.
    && !cautionBrake

  // §97 Amendment (LONG-RUNWAY-EARNS-PLAN-01, Coaching Board 2026-09-16) —
  // surplus weeks become plan weeks rather than a §57 block in front of the plan.
  //
  // `earlyQualityOnset` USED TO BE PASSED HERE as a fourth argument. It no longer
  // is, and the parameter is gone rather than defaulted: the board granted the
  // headroom on surplus, and `calcPlanLength` already scopes itself to surplus by
  // taking `min(weeksAvailable, weekCap)`. The gate is still computed above — it
  // still drives §91/§97/§98's on-ramp and re-entry — it just no longer decides
  // how long the plan is.
  const planLength = calcPlanLength(
    input.race_distance_km, input.race_date, planStartIso)
  const { totalWeeks, compressed } = planLength
  const anchoredStartIso  = planLength.planStartIso
  const anchoredStartDate = parseDateLocal(anchoredStartIso)
  // §89 — `phases` is computed BELOW, after the readiness predicate, so a
  // demonstrably-ready runner can be given a shorter base. Nothing between here
  // and that call reads `phases`.

  // §79 (2026-08-31) — the metric recommendation follows EXPERIENCE (intensity),
  // not raw current volume (structural). Duration is the beginner / ultra default
  // (time on feet, §80); a returning or experienced runner sees distance even when
  // their current volume reads low. intensityFitness is 'beginner' only when every
  // signal agrees the runner is a true beginner, so this narrows duration to
  // exactly that cohort. (User-overridable per session/globally — Phase 3.)
  const metric: 'distance' | 'duration' =
    intensityFitness === 'beginner' || input.race_distance_km >= 50 ? 'duration' : 'distance'


  // CoachingPrinciples §29 — fresh-from-layoff detection. Two paths:
  //  1. Explicit: weeks_at_current_volume < threshold (the input the wizard
  //     can surface as a "have you been at this volume long?" question).
  //  2. Heuristic (R2/M-03): training_age says experienced, but current volume
  //     and longest recent run are both below floors typical of that
  //     experience. The mismatch points to a layoff regardless of whether
  //     the user thought to mention it.

  // Recovery cadence — masters (age ≥ 45) recover every 3 weeks (CoachingPrinciples §3).
  // Computed once and shared between volume sequence + week badging so they stay aligned.
  const recoveryFreq = input.age >= GENERATION_CONFIG.MASTERS_AGE_THRESHOLD
    ? GENERATION_CONFIG.RECOVERY_WEEK_FREQUENCY_MASTERS
    : GENERATION_CONFIG.RECOVERY_WEEK_FREQUENCY_STANDARD

  // Fresh-return runners get the standard 10% ramp (no allowance) — their
  // structural base is gone and the cap exists to protect them.

  // §89 (Coaching Board 2026-09-06) — EXPERIENCE-GATED QUALITY ONSET. The signal
  // is DEMONSTRATED recent structured hard training (`recent_quality_training`),
  // a tissue-readiness proxy, NOT self-image. An injury history is an absolute
  // veto (Willy/Sims): a self-report cannot overrule a documented structure.

  // §79 (2026-08-31) — progressive intensity re-entry. A returning runner whose
  // intensity was lifted (or who is otherwise detected as returning/fresh) has an
  // aerobic engine ahead of their tissue tolerance. Withhold VO2max/hills for the
  // opening RETURNING_RUNNER_INTENSITY_REENTRY_WEEKS so quality leads with
  // tempo/threshold. Surfaced in meta for honesty + the invariant.
  // §97 — Willy's condition of approval on the one-week on-ramp. A gated runner
  // is by definition NOT returning and NOT fresh, so none of the three arms
  // below fired for them and the re-entry was zero. That was fine while their
  // on-ramp was two weeks; at one week it is not. The gate now opens re-entry
  // too, so quality starting in week 2 means a controlled tempo rather than
  // intervals — the mitigation is the mechanism that already exists, not a
  // second one invented alongside it.
  const oneWeekOnRamp = earlyQualityOnset
  // §89 Lever A — a conditioned returning runner has the INTENSITY re-entry
  // SHORTENED (not zeroed — Willy: one week tempo-first is cheap insurance); the
  // VOLUME ramp caution (returning allowance) is untouched (tonnage is structure's).
  //
  // INTENSITY-REENTRY-OWNER-01 — the window (active + depth + "is week N
  // withheld") has ONE owner in `intensityReentry.ts`. It used to be derived
  // here and then the withhold predicate hand-written at two separate call
  // sites; see that module's header for why that is the DELOAD-OWNER-01 fault.
  const reentry = computeIntensityReentry({
    intensityLiftedForReturn: assessed.intensityLiftedForReturn,
    returningRunner,
    isFreshReturn,
    oneWeekOnRamp,
    tissueConditioned,
    // §79 Amendment 3 — a declaration ABOVE the structural assessment opens the
    // same window a returning runner gets. Not a new mechanism and not a
    // category ban: tempo/threshold still arrive immediately, the vo2max family
    // (intervals AND hill reps) waits out the opening quality weeks.
    //
    // SCOPED TO A SHALLOW TRAINING AGE, and the scoping is the whole rule. A
    // runner with `2-5yr`/`5yr+` who declares up has demonstrated tissue
    // tolerance and is ALREADY covered by `intensityLiftedForReturn` — firing
    // here too would withhold VO2max from a 55 km/week runner with five years
    // and regular quality behind them, which is not what the board ruled and is
    // what §96's brake test caught on the first run. The gap the board named is
    // the runner whose claim NOTHING has demonstrated: shallow history, low
    // volume, declaring up. The two arms are complementary, never overlapping.
    userRaisedAboveStructural:
      declaredLevel !== undefined
      && FITNESS_RANK[declaredLevel] > FITNESS_RANK[assessedStructural]
      && input.training_age !== '2-5yr' && input.training_age !== '5yr+',
  })
  const intensityReentryActive = reentry.active
  const intensityReentryWeeks = reentry.weeks
  /** §79 Amendment 3 — the window opened ONLY because the runner declared up.
   *  Decides which honesty note the plan carries: a first-timer who over-rated
   *  themselves is not "coming back" from anything. */
  const reentryIsUserRaisedOnly =
    reentry.active
    && !assessed.intensityLiftedForReturn && !returningRunner && !isFreshReturn && !oneWeekOnRamp

  /**
   * §79 Amendment 5 (Coaching Board 2026-09-19, REENTRY-CAUSE-01) — THE NOTE
   * MUST NAME THE REASON THE WINDOW ACTUALLY OPENED.
   *
   * ⚠️ MEASURED: the "You are coming back" copy reached 21% of experienced-runner
   * plans (120/576), and 96 of those 120 had `early_quality_onset` set — 84 were
   * not returning by ANY arm. ADR-021 §89 certifies that cohort as experienced
   * intensity, deep training age, regular recent quality, explicitly NOT
   * returning or fresh, and no injury history. The engine was telling its most
   * demonstrably-READY runners that their legs needed to re-adapt.
   *
   * ⚠️ THE MECHANISM WAS NOT THE ONE I FIRST NAMED, AND TRACING IT MATTERED.
   * Not the fresh-return heuristic (25 km/wk AND 10 km longest — nowhere near
   * these runners) and not `isReturningRunner` (50% of peak). It is
   * `oneWeekOnRamp = earlyQualityOnset` sitting in the exclusion list above:
   * an early-onset runner fails `reentryIsUserRaisedOnly`, so the binary fell
   * through to the returning copy. A third cause needed a third branch.
   *
   * §79 Amendment 3 already fixed this exact copy class in the adjacent arm —
   * its closing line records "copy that does not tell a first-timer they are
   * 'coming back', which was a real defect introduced and fixed inside this
   * change". One arm was fixed; this one survived.
   *
   * THE CAUSE IS STAMPED, NOT RE-DERIVED. `INV-PLAN-REENTRY-NOTE-MATCHES-CAUSE`
   * reads this field and the rendered note. A checker that recomputed the
   * predicate would share the producer's logic and be blind to the producer
   * being wrong — the deloadCadence / tierResolution class this repo has paid
   * for repeatedly.
   */
  const reentryCause: 'returning' | 'user_raised' | 'early_onset' | null =
    !reentry.active ? null
    : reentryIsUserRaisedOnly ? 'user_raised'
    // Only the early-onset flag is set: this runner is READY, not returning.
    : (oneWeekOnRamp && !assessed.intensityLiftedForReturn && !returningRunner && !isFreshReturn)
      ? 'early_onset'
    : 'returning'

  // §89 Lever B — earlier quality onset via a SHORTER (still all-easy) base. Only
  // for a demonstrably-ready runner with a real CURRENT base: experienced
  // intensity, intermediate+ structure (volume floor), deep training age,
  // conditioned tissue, and NOT returning/fresh (they have a base, not a layoff).
  // Adds zero tonnage (peakKm unchanged, §79). Beginners/returners/injured keep
  // the full base. Stamped in meta and enforced by INV-PLAN-EARLY-ONSET-GATED.
  // §91 (CB-ONSET-02) — how many all-easy foundation weeks will sit in front of
  // week 1. From the single owner in foundationBlock.ts, using the SAME `today`
  // and the SAME anchored start that composePlanWithFoundation will use, so the
  // number that sizes base here and the number of weeks built there cannot
  // disagree. Zero whenever no block is coming (gap < 7 days, or the runner
  // declined it) — in which case the base floor binds unchanged.
  const foundationWeeksAhead = plannedFoundationWeeks(
    today, anchoredStartIso, input.foundation_decision,
  )
  // §97 — the shortened on-ramp is distance-scoped; see ONSET_SHORT_ONRAMP_DISTANCES.
  // §97 Amendment 1 (INTENSITY-3DAY-01) — and denominator-scoped. A shortened base
  // is affordable only where the §1 ceiling permits ≥1 quality session per week the
  // runner actually runs (ceiling_fraction × days_available). Otherwise the ~1
  // quality/week the short on-ramp drives breaches §1 on low-day plans — the 3-day
  // 10K / 4-day HM the distance-only gate never saw. Base then falls back to §91's
  // two-week floor. See ONSET_SHORT_ONRAMP_MIN_WEEKLY_QUALITY_HEADROOM.
  const onsetDistKey = raceDistanceKey(input.race_distance_km)
  const ceilingFraction =
    GENERATION_CONFIG.INTENSITY_DISTRIBUTION[onsetDistKey].max_quality_session_pct / 100
  const shortOnRamp = earlyQualityOnset
    && (GENERATION_CONFIG.ONSET_SHORT_ONRAMP_DISTANCES as readonly string[]).includes(onsetDistKey)
    && ceilingFraction * input.days_available
       >= GENERATION_CONFIG.ONSET_SHORT_ONRAMP_MIN_WEEKLY_QUALITY_HEADROOM
  const phases = computePhases(
    totalWeeks, input.race_distance_km, earlyQualityOnset, foundationWeeksAhead, shortOnRamp,
    onsetRelax,
  )
  // §87 (CB-DELOAD-01) — WHERE the deloads fall, decided once for the whole
  // plan and passed to every consumer. Computing it twice from the same inputs
  // is what DELOAD-OWNER-01 removed; re-deriving it inside buildVolumeSequence
  // AND at the week-badge site would have reintroduced that fault one layer up.
  const deloadWeeks = computeDeloadWeeks(
    totalWeeks, recoveryFreq, wn => getPhaseForWeek(wn, phases), deloadAvoidPosition2)

  const { volumes, compressed: capCompressed } = buildVolumeSequence(
    totalWeeks, phases, startKm, peakKm, input.race_distance_km,
    recoveryFreq, returningRunner,
    hasVolumeCappedInjury(input)
      ? GENERATION_CONFIG.INJURY_WEEKLY_INCREASE_CAP_PCT
      : undefined,
    deloadWeeks,
  )

  // ── Build weeks ─────────────────────────────────────────────────────────────
  const weeks: Week[] = []
  const taperPhase = phases.find(p => p.name === 'taper')!
  const recalibrationWeeks: number[] = []

  // Track phase-local week count for labels
  const phaseWeekCount: Record<PhaseType, number> = { base: 0, build: 0, peak: 0, taper: 0 }

  // CoachingPrinciples §27 — pre-compute peak-overload classification so
  // theme/label selection in the per-week loop reflects the plan as a whole.
  const peakWeekIndices: number[] = []
  for (let i = 0; i < totalWeeks; i++) {
    if (getPhaseForWeek(i + 1, phases) === 'peak') peakWeekIndices.push(i)
  }
  const peakMaxKm = peakWeekIndices.length > 0
    ? Math.max(...peakWeekIndices.map(i => volumes[i]))
    : 0
  const w1Km = volumes[0] ?? 0
  const planIsMaintenance = totalWeeks >= GENERATION_CONFIG.PEAK_OVERLOAD_MIN_PLAN_WEEKS
    && w1Km > 0
    && peakMaxKm < w1Km * GENERATION_CONFIG.PEAK_OVER_BASE_RATIO

  // CoachingPrinciples §32 — tune-up race callout. Place on the latest
  // non-deload build week (the one right before peak begins) for plans of
  // sufficient length. Optional callout — the runner can use a parkrun
  // result as a benchmark or skip it entirely.
  let tuneUpWeekN: number | null = null
  if (totalWeeks >= GENERATION_CONFIG.TUNE_UP_MIN_PLAN_WEEKS) {
    const buildPhase = phases.find(p => p.name === 'build')
    if (buildPhase) {
      for (let wn = buildPhase.end_week; wn >= buildPhase.start_week; wn--) {
        // Was a BARE modulo with no phase test. Equivalent only because this
        // loop scans build weeks exclusively — an equivalence nothing stated.
        const wnIsDeload = deloadWeeks.has(wn)
        if (!wnIsDeload) { tuneUpWeekN = wn; break }
      }
    }
  }

  // §1/Q2 — plan-level flag so the controlled-threshold cue lands on the FIRST
  // genuine threshold session across the whole plan (weeks build in order below).
  const cueCtx = { thresholdCuePlaced: false }

  // §53 (CAT-ULTRA-THIN-01) — plan-level per-row selection tally driving the
  // least-used-first rotation in selectCatalogueSession, so the eligible pool is
  // exhausted before any row repeats (a thin marathon/50k threshold pool used to
  // land one row five times while another went unpicked).
  const rowUsage = new Map<string, number>()
  const rowLast = new Map<string, string>()
  // §53 (2026-09-02) — per-pick eligible-pool sizes across the whole plan,
  // stamped as `meta.quality_pool_sizes` so the variety invariant can tell
  // 'the engine repeated lazily' from 'the catalogue had nothing else to offer'.
  const qualityPool: number[] = []

  // SC-07 / CD-16 — counts NON-DELOAD build weeks as they are emitted, so the
  // build quality rotation (threshold -> vo2max -> threshold for 5K/10K) is
  // driven by quality-carrying weeks rather than calendar position.
  // §97 — the build-rotation index at which VO2max first becomes ELIGIBLE.
  //
  // Build carries exactly ONE VO2max exposure and its slot used to be fixed at
  // the rotation's own index for 'vo2max'. If an intensity re-entry window
  // (§79, and now §97's one-week-on-ramp arm) withheld VO2max on that exact
  // week, the slot was spent on a threshold session and build ended with none.
  //
  // Walk the build weeks the same way the driver loop will — same deload set,
  // same phase boundaries — and take the first rotation index whose week is
  // clear of the window. Precomputed rather than discovered mid-loop because
  // the decision must be made BEFORE week 1 is built.
  const vo2BuildSlotIndex = (() => {
    const cats = buildRotationCategories(raceDistanceKey(input.race_distance_km))
    const naturalSlot = cats.indexOf('vo2max')
    if (naturalSlot < 0) return undefined        // distance has no build VO2max
    const buildPhase = phases.find(p => p.name === 'build')
    if (!buildPhase) return undefined
    // The slot is the first eligible index AT OR AFTER the rotation's natural
    // one — never earlier. Returning the first non-withheld index outright
    // would pull VO2max to index 0 for every runner with no re-entry window,
    // opening build on its hardest category and contradicting §2 (and
    // McMillan's "alternate, don't front-load" amendment on CD-16).
    let idx = 0
    for (let wn = buildPhase.start_week; wn <= buildPhase.end_week; wn++) {
      if (deloadWeeks.has(wn)) continue          // deload weeks carry no quality
      const withheld = reentry.withheldAtQualityIndex(idx)
      if (idx >= naturalSlot && !withheld) return idx
      idx++
    }
    return undefined   // no eligible week — build legitimately carries none
  })()

  let buildRotationIndex = 0
  // §93 — peak's own rotation counter. Peak previously had no rotation: its
  // category was a per-distance constant, so however many weeks the phase grew
  // to, every one of them got the same session category.
  let peakRotationIndex = 0

  // Does the VO2max adaptation deadline land on the first build quality week?
  // Mirrors applyV2Vo2MaxOnsetTiming's arithmetic deliberately — same inputs,
  // same answer — so the plan is CONSTRUCTED compliant instead of being built
  // late and swapped afterwards (which breaks §22; see preferredQualityCategory).
  const vo2MustOpenBuild = (() => {
    if (input.race_distance_km > 21) return false
    const taperPhase = phases.find(p => p.name === 'taper')
    const buildPhase = phases.find(p => p.name === 'build')
    if (!taperPhase || !buildPhase) return false
    const taperWeeks = (totalWeeks - taperPhase.start_week) + 1
    const deadlineWeekN = totalWeeks - taperWeeks - GENERATION_CONFIG.VO2MAX_ONSET_MIN_ADAPTATION_WEEKS
    // Unreachable deadlines (short plans, CD-22) are handled by V2's recorded
    // adjustment — do not distort the rotation chasing a week that cannot work.
    if (deadlineWeekN < buildPhase.start_week) return false
    return deadlineWeekN <= buildPhase.start_week
  })()

  for (let i = 0; i < totalWeeks; i++) {
    const weekN = i + 1
    const phase = getPhaseForWeek(weekN, phases)
    phaseWeekCount[phase]++

    const weekDate = formatDate(addDays(anchoredStartDate, i * 7))
    const isRaceWeek = weekN === totalWeeks
    // Deload cadence is masters-aware (CoachingPrinciples §3) — set once at top
    // of generateRulePlan so volumes and week badges stay aligned.
    const isDeload = !isRaceWeek && deloadWeeks.has(weekN)
    // Recalibration on deload weeks in base/build — fresher legs, good time to benchmark
    const isRecalibration = isDeload && (phase === 'base' || phase === 'build')
    // NOTE: recalibrationWeeks is NOT populated here. CoachingPrinciples §78 —
    // the metadata follows the produced plan, never the intent. A week only
    // counts as a recalibration week if the time trial was actually placed,
    // which is resolved after buildWeekSessions returns.

    const weeklyKm = volumes[i]
    // §12's weekly cap now lives in buildVolumeSequence, so the curve already
    // reflects it. What remains here is the non-volume injury sizing only — the
    // quality-suppression rules this function used to return were DEAD (never
    // destructured) and were deleted with §110; see applyInjuryAdjustments.
    const { adjustedKm } = applyInjuryAdjustments(weeklyKm, input)

    const isRotatingBuildWeek = phase === 'build' && !isDeload && !isRaceWeek
    const isRotatingPeakWeek  = phase === 'peak'  && !isDeload && !isRaceWeek

    // §53 (Coaching Board 2026-09-03) — threshold_ladder's second eligibility
    // path. Read from ALREADY-BUILT prior weeks (weeks.push happens at the
    // end of each iteration below, so `weeks` here holds only weeks 1..i) —
    // never same-week circular. Categorised structurally (row.category), not
    // a hardcoded row-id list (INV-CLASS). Requires a FULL lookback window —
    // a plan's first weeks fall back to the flat floor only, matching "a
    // first-time-ever threshold session still requires the volume floor."
    const thresholdAltLookback = GENERATION_CONFIG.THRESHOLD_LADDER_ALT_LOOKBACK_WEEKS
    const recentWeeksForThresholdGate = weeks.slice(-thresholdAltLookback)
    const recentThresholdEligible = recentWeeksForThresholdGate.length === thresholdAltLookback && (() => {
      const hits = recentWeeksForThresholdGate.filter(w =>
        Object.values(w.sessions).some(s => {
          if (!s?.catalogue_id) return false
          const row = catalogue.find(r => r.id === s.catalogue_id)
          return row?.category === 'threshold' || row?.category === 'race_specific'
        })
      ).length
      if (hits < GENERATION_CONFIG.THRESHOLD_LADDER_ALT_MIN_HITS) return false
      // Collapse guard (Willy) — this week's volume must not have dropped
      // more than THRESHOLD_LADDER_ALT_STABILITY_PCT below the window's peak.
      // Not a floor (Sims) — says nothing about how low volume can be, only
      // that it can't be actively falling apart mid-window.
      const recentPeakKm = Math.max(...recentWeeksForThresholdGate.map(w => w.weekly_km))
      if (recentPeakKm <= 0) return false
      return adjustedKm >= recentPeakKm * (1 - GENERATION_CONFIG.THRESHOLD_LADDER_ALT_STABILITY_PCT / 100)
    })()

    const sessions = buildWeekSessions(
      weekN, phase, isDeload, isRaceWeek,
      adjustedKm, input, zones, pace, metric, phases,
      tier, catalogue,
      fitness,
      goalPace,
      totalWeeks,
      buildRotationIndex,
      peakRotationIndex,
      vo2BuildSlotIndex,
      vo2MustOpenBuild,
      intensityReentryActive,
      intensityFitness,
      cueCtx,
      rowUsage,
      rowLast,
      // §79 — withhold VO2max/hills during the returning runner's opening weeks.
      // Same owner as the build-slot reservation above (INTENSITY-REENTRY-OWNER-01).
      //
      // ⚠️ STILL THE CALENDAR READING, WHICH IS PROVEN INERT — and the flip is
      // BLOCKED, not forgotten. `withheldAtQualityIndex` is built and measured
      // (returning runners whose FIRST quality session is VO2max 25.4% -> 12.7%),
      // but switching to it RE-UNITS a ratified numeric:
      // RETURNING_RUNNER_INTENSITY_REENTRY_WEEKS = 4 was calibrated as CALENDAR
      // weeks, where it did nothing. Read as QUALITY weeks it withholds the first
      // FOUR quality sessions, which on a short 10K plan is most of them and
      // removes hill work entirely. That is a change to what the numeric MEANS
      // (D-22), so it needs the board, not an edit. See REENTRY-DEPTH-01.
      // §110 — VO2max withhold for `avoid` was PROPOSED by the board and
      // WITHDRAWN on measurement (D-21: a rule the catalogue cannot satisfy is a
      // defect in the rule, not in the engine).
      //
      // Reusing §79's `excludeHighTissueStress` for the whole `avoid` cohort
      // produced 61 NEW §53 variety errors -- "tempo_continuous appears 3 times
      // across 5 quality sessions; cap is 2" -- because removing the vo2max
      // category leaves the eligible pool too thin to satisfy §53's anti-repeat
      // cap. Scoping it to build phase only made it WORSE (570 plans carrying a
      // violation against 63). This is CAT-DEPTH-01's known catalogue thinness
      // surfacing, not a fixable wiring error: §79's lever is calibrated for a
      // few weeks of ONE runner's plan, and a standing preference is a different
      // duration entirely.
      //
      // Nothing is lost by withdrawing it. §110 Am.1's build-week frequency cut
      // ALREADY takes `avoid` to 0% inert for intermediate and experienced
      // runners, which is the outcome arm 3 was reached for. Keeping a second
      // mechanism that buys no measured reach and breaks a ratified invariant
      // would be the opposite of SLC.
      reentry.withheldAtQualityIndex(buildRotationIndex),
      qualityPool,
      recentThresholdEligible,
    )

    // Advance the rotation only on weeks that actually carried a build quality
    // slot — see isRotatingBuildWeek above.
    if (isRotatingBuildWeek) buildRotationIndex++
    if (isRotatingPeakWeek) peakRotationIndex++

    // §78 — the benchmark session is the proof. `isRecalibration` was the
    // intent; a placed `hard` session is the fact. If the slot was too short to
    // hold a real 5K, the week is simply not a recalibration week.
    if (isRecalibration && Object.values(sessions).some(s => s?.type === 'hard')) {
      recalibrationWeeks.push(weekN)
    }

    const longRunHrs = computeLongRunHrs(sessions, pace)
    const actualWeeklyKm = sumWeeklyKm(sessions, pace)

    const weekType: Week['type'] = isRaceWeek ? 'race' : isDeload ? 'deload' : 'normal'
    const badge: Week['badge'] = isRaceWeek ? 'race' : isDeload ? 'deload' : undefined

    // CoachingPrinciples §27 — theme matches prescription. "Where the fitness
    // is built" / "highest volume" themes are misleading when peak weekly_km
    // does not exceed the prior non-deload week. "Intensity stays" themes
    // mislead in taper weeks with no quality session prescribed.
    // CoachingPrinciples §27 — copy is derived from what the week CONTAINS.
    // The chain of string exceptions that used to live here is gone: weekLabel
    // and weekTheme now read a WeekContent summary, so a week without quality
    // cannot be given copy that promises it. (analysis F4 / N4)
    const prevNonDeloadWeeklyKm = (() => {
      for (let j = weeks.length - 1; j >= 0; j--) {
        if (weeks[j].type !== 'deload') return weeks[j].weekly_km
      }
      return 0
    })()
    const isVolumePeak = !planIsMaintenance && actualWeeklyKm > prevNonDeloadWeeklyKm

    const content = summariseWeek(
      sessions, phase, phaseWeekCount[phase], isDeload, isRaceWeek, isVolumePeak,
    )

    weeks.push({
      n: weekN,
      date: weekDate,
      label: weekLabel(content),
      theme: weekTheme(content),
      type: weekType,
      phase,
      ...(badge ? { badge } : {}),
      sessions,
      long_run_hrs: longRunHrs,
      weekly_km: actualWeeklyKm,
      ...(isRaceWeek ? {
        // §77 / INV-PLAN-NO-PLACEHOLDER-COPY (F6) — never interpolate an invented
        // race name into user-facing copy.
        race_notes: input.race_name
          ? `Race day: ${input.race_name}. Start at Zone 2. The second half is where the race begins.`
          : 'Race day. Start at Zone 2. The second half is where the race begins.',
      } : {}),
      ...(weekN === tuneUpWeekN ? {
        tune_up_callout: 'Optional: drop a parkrun PB or local 5K this week. Use the result as a fitness check, not a race effort.',
      } : {}),
    })
  }

  // CoachingPrinciples §47 — alternate peak long runs (step-back vs peak-level).
  // Runs first because §47 reduces some peak LRs to step-back distances, which
  // affects the §45 cap calculation that follows.
  const peakStepBackWeeks = applyPeakLongRunAlternation(weeks, pace, input)

  // CoachingPrinciples §45 — long-run progression cap. Walks the plan and
  // clamps any LR that exceeds +20% / +5km from the prior week's LR.

  // CoachingPrinciples §9 (CD-9) — build-phase long-run step-backs. Runs LAST so
  // the progression cap can't re-inflate the reduced week. Peak long runs are
  // left alone (culmination + §80 floor), so this can't create a floor violation.
  // §3 AMENDMENT — THE DELOAD'S LONG-RUN CUT TRACKS THE WEEK'S CUT
  // (LR-DELOAD-CUT-01, Coaching Board 2026-09-17).
  //
  // §3 says "volume drops to 70% of the prior build week" — a statement about
  // the WEEK. Nothing in §3 asks for the long run to be cut HARDER than the
  // week, and it was, on HALF of all deloads. Measured over 2,817 deload weeks:
  // week cut a median 22%, long run cut a median 30%, and on 50.4% the long run
  // was cut >5pp harder. Worst traced: a week falling 44 -> 43km (-2%) while its
  // long run fell 20.5 -> 13.5km (-34%).
  //
  // ⚠️ WHY THE LONG RUN SITS ABOVE §9's SHARE IN NORMAL WEEKS — the mechanism,
  // established only after two wrong hypotheses were disproved. It is NOT the
  // specificity pull switching off (the gap is identical in base phase, where no
  // such pull exists) and NOT sessions going unplaced (placed easy count equals
  // planned on 100% of weeks). It is this: THE LONG RUN HITS §9's SHARE OF THE
  // PLANNED WEEK, AND THE REST OF THE WEEK IS TRIMMED DURING PLACEMENT — median
  // -6km, p10 -22km. Same numerator, smaller denominator, so the delivered share
  // rises from §9's 28-30% to 37-42%. A deload's planned week is smaller, the
  // trim bites proportionally harder, and the share falls back to 33-34%. That
  // asymmetry IS the disproportionate cut.
  //
  // THE CONSEQUENCE, and why this is a fitness defect rather than a curiosity:
  // the long run then has to climb all the way back, and runs out of weeks. It
  // is the single root cause of every remaining marathon shortfall — the
  // knee+masters finish goal (26.0 vs §80's 29.5) and both time-goal cases.
  //
  // ⚠️ §52 BINDS ON THE RESULT (Willy's amendment, McMillan and Sims
  // concurring). Without it a first marathoner off a 9km base reached a 24.5km
  // long run — "not a long run inside a training week, a training week with a
  // run attached". With it they reach 20.5km, and the worst single-week jump is
  // +47% against +50% BEFORE this change: cutting less means climbing less.
  for (let i = 1; i < weeks.length; i++) {
    const prev = weeks[i - 1], curr = weeks[i]
    const isDeloadWeek = curr.type === 'deload' || curr.badge === 'deload'
    const prevIsDeload = prev.type === 'deload' || prev.badge === 'deload'
    if (!isDeloadWeek || prevIsDeload || curr.type === 'race') continue
    if (prev.weekly_km <= 0 || (curr.weekly_km ?? 0) <= 0) continue
    const prevLr = Object.values(prev.sessions).find(x => x && isLongRun(x)) as Session | undefined
    const currLr = Object.values(curr.sessions).find(x => x && isLongRun(x)) as Session | undefined
    if (!prevLr || !currLr) continue
    const prevKm = sessionKmSelfPaced(prevLr)
    const currKm = sessionKmSelfPaced(currLr)
    if (prevKm == null || currKm == null || prevKm <= 0) continue
    // Proportional to the week's own cut, bounded by §52's ceiling, and then by
    // §9's ABSOLUTE minutes cap.
    //
    // ⚠️ The minutes cap is not optional and was missed on the first build:
    // raising a deload long run toward its proportional target pushed a 5K plan
    // to a 92-minute long run against §9's 90-minute ceiling, and
    // INV-PLAN-LONG-CAP-MINS threw on 48 grid plans. `applyLongRunCap` is the
    // single owner of that ceiling, so it is reused rather than re-expressed.
    const target = applyLongRunCap(
      Math.min(
        prevKm * (curr.weekly_km / prev.weekly_km),
        curr.weekly_km * (GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_WEEKLY / 100),
      ),
      pace.minPerKmEasy,
      input,
    )
    if (currKm >= target - 0.01) continue   // already at or above: a deload never ADDS
    const precision = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
    const set = Math.max(
      Math.floor(target / precision) * precision,
      sessionFloorsFor(input.longest_recent_run_km).long)
    // Written on the axis the session already uses (§79/§80).
    if (currLr.distance_km != null) currLr.distance_km = set
    else currLr.duration_mins = Math.round(dur(set, pace.minPerKmEasy))
    curr.weekly_km = sumWeeklyKm(curr.sessions, pace)
  }

  applyLongRunStepBacks(weeks, pace, sessionFloorsFor(input.longest_recent_run_km).long)
  // §45 runs AFTER the step-backs, not before (fixed 2026-08-20). Running it
  // first meant it never saw the sequence the runner actually gets:
  // applyLongRunStepBacks then cut every Nth build long run, and the week after
  // became a jump nothing re-checked. All 430 remaining sweep violations of this
  // code were that ordering — re-running the cap at the end cleared every one.
  applyLongRunProgressionCap(weeks, pace, sessionFloorsFor(input.longest_recent_run_km))

  // STEPBACK-STALE-PEAK-01 — §47's ratio is re-measured against the peak that
  // survived the cap above, not the one it saw before.
  //
  // ⚠️ §45 RUNS AGAIN AFTER IT, and that is not belt-and-braces. Lowering a
  // step-back raises the step the FOLLOWING week has to take, and measured, it
  // breaks §45: re-clamping W15 to 23 km turned W16's untouched 29 km into a
  // 26% jump. Same ratchet shape as §114's post-pass attempts. §45 is already
  // the documented cleanup pass for this class, and it only ever REDUCES, so a
  // second run converges rather than oscillating. Any residual staleness is
  // bounded by one §45 trim of the peak, well inside `peakLrStepbackMinutes`'s
  // tolerance.
  reclampPeakStepBacks(weeks, pace, input, peakStepBackWeeks)
  applyLongRunProgressionCap(weeks, pace, sessionFloorsFor(input.longest_recent_run_km))

  // §6 Amendment 1 — THE TAPER LONG RUN MAY NOT EXCEED THE PEAK LONG RUN.
  // (Coaching Board PEAK-LR-NOT-IN-PEAK-01, 2026-09-15.)
  //
  // §6: "volume drops sharply in the taper." §9's shares say base 28 / build 30 /
  // peak 32 / taper 40, so the taper takes the LARGEST share of a smaller week —
  // and on 1.9% of plans that larger share of a smaller week beats the peak's
  // smaller share of a bigger one. Worst measured: an HM taper long run of
  // 20.5 km after a peak of 18.5, two weeks out from a 21.1 km race. McMillan:
  // that is a dress rehearsal, not a taper, and a runner told they are tapering
  // will either do it and arrive flat or skip it and stop trusting the plan.
  //
  // RUNS LAST, after §47 alternation, §9 step-backs and §45's cap, because those
  // decide what the peak long run finally IS. Capping against a pre-pass value
  // would be capping against a number no runner sees.
  applyTaperLongRunCap(weeks, pace)

  // ── V1–V7 post-passes ───────────────────────────────────────────────────────
  // Order matters:
  //   V2 first — moves vo2max sessions earlier; downstream V5 reads the new
  //     placements when checking build-phase stimulus progression.
  //   V5 next — escalates regressing build-phase quality before V1 inspects
  //     the "first quality" position (V5 may have rewritten the label, but
  //     never moves which week it lives in).
  //   V1 — checks first-quality-session week vs prior-week volume bump and
  //     scales non-quality sessions down. Does not touch quality.
  //   V4 — long-run repeat ceiling. Mutates LR distances; runs after the §45
  //     cap so it doesn't fight LR clamping.
  //   V3 — propagates HR-estimation note into session coach_notes.
  //   V7 — taper rationale note on first taper-week session.
  // V6 (pre_plan block) is constructed below alongside meta — it doesn't
  // mutate weeks.
  const ruleAdjustments: RuleAdjustment[] = []
  // V2-SWAP-RESIZE-01 — the resize seam. `makeQualitySession` IS the sizer, so
  // the relocated session is re-sized by the same code that sized it first,
  // including every floor protection. Only the phase-dependent dose fields are
  // adopted; identity, label and notes are deliberately preserved.
  applyV2Vo2MaxOnsetTiming(weeks, input.race_distance_km, phases, ruleAdjustments,
    (session, week, day) => {
      const row = catalogueRowFor(session)
      if (!row) return                       // v1/legacy session — nothing phase-sized to correct
      const resized = makeQualitySession({
        weekN: week.n, day,
        distKm: session.distance_km ?? 0,
        metric: session.primary_metric === 'duration' ? 'duration' : 'distance',
        zones, pace,
        catalogueRow: row,
        phase: getPhaseForWeek(week.n, phases),
        fitness: intensityFitness,
        isDeload: week.type === 'deload',
        goalPace,
        distLabel: onsetDistKey,
        // No cueCtx: the §1/Q2 threshold cue was already placed (or not) during
        // construction. Re-running that decision here could duplicate it.
      })
      session.duration_mins = resized.duration_mins
      session.distance_km   = resized.distance_km
      if (resized.derived_set) session.derived_set = resized.derived_set
    },
    // §79 vs §5 — the protected quality weeks, derived from the FINISHED weeks
    // the same way `INV-PLAN-RETURNING-INTENSITY-REENTRY` derives them, so the
    // producer and the checker cannot disagree about which weeks are protected.
    (weekN: number) => {
      if (!reentry.active) return false
      let seen = 0
      for (const w of weeks) {
        if (w.n < 1) continue
        const carriesQuality = Object.values(w.sessions ?? {})
          .some(sn => sn && (sn as Session).type === 'quality')
        if (!carriesQuality) continue
        if (seen >= reentry.weeks) return false
        if (w.n === weekN) return true
        seen++
      }
      return false
    })
  applyV5StimulusProgression(weeks, input.race_distance_km, pace, zones, ruleAdjustments)
  applyV1VolumeQualityStimulusSplit(weeks, pace, ruleAdjustments, sessionFloorsFor(input.longest_recent_run_km))
  applyV4LongRunRepeatCeiling(weeks, input, pace, ruleAdjustments)

  // §47 Amendment 2 (Coaching Board 2026-09-16) — the peak step-back is a VOLUME
  // step-back, not only an intensity one. RUNS AFTER V1 AND V4 for the reason the
  // taper-depth pass below records: V1 scales non-quality (easy) sessions and V4
  // mutates long-run distances, so before them the step-back week is not the week
  // the runner receives. Anchors on the number no later pass will move.
  applyPeakStepBackVolume(weeks, pace, input)

  // §6 Amendment 2 (Coaching Board TAPER-DEPTH-02) — the cut is a percentage of
  // the week the runner ACTUALLY DID, not of the week the volume curve intended.
  //
  // RUNS AFTER V1 AND V4, and that ordering is measured, not assumed. Placed
  // first immediately after §6 Am.1's long-run cap, it left 6 sweep cases where
  // the taper fell short with easy-run headroom still on the table — V1 scales
  // non-quality sessions and V4 mutates long-run distances, so the week this
  // pass sized was not the week the runner receives. Same lesson §6 Am.1's own
  // comment records: anchor on the number no later pass will move.
  applyTaperDeliveredDepth(weeks, pace, peakKm, input.race_distance_km, sessionFloorsFor(input.longest_recent_run_km))

  // I7b (MKT-PLAN-SHAPE-01, 2026-09-21) — A SEGMENTED LONG RUN IS PRICED AT THE
  // PACES IT PRESCRIBES, NOT ENTIRELY AT EASY PACE.
  //
  // Runs LAST of the long-run passes, so it only ever re-prices a segment that
  // survived §47's step-back rewrite (which strips `lr_segment_pace`) and every
  // cap that could still move the distance.
  applyRacePaceSegmentDuration(weeks, pace)

  // §24e AMENDMENT (Coaching Board 2026-09-19, LONG-SESSION-FUEL-01) — a long
  // run long enough to need fuel says so. THE GATE IS DURATION, NOT THE RACE'S
  // DISTANCE BUCKET.
  //
  // ⚠️ MEASURED: of 88 plans containing a session of two hours or more, only 27
  // carried any fuelling guidance ON that session — 69% silent — and the
  // never-run beginner MARATHONER is prescribed SEVEN sessions over two hours,
  // up to 3h28, with no mention of fuelling anywhere in the plan. §24e's cue
  // was gated `distKey === '50K' || '100K'`, so the identical hazard at the
  // identical duration was excluded by the race's name. Sims led the original
  // ruling and the hazard she named is a DURATION hazard.
  //
  // ⚠️ `distance_km` (or its bucket) standing in for a coaching classification
  // is the FIFTH instance in this repo — LR-CAP-BLIND-01, SESSION-KM-01/02,
  // V4-ANCHOR-01, QUALITY-ZERO-SCOPE-01. It is a grep, not a discovery.
  //
  // ⚠️ IT RUNS HERE, AS A POST-PASS, AND THAT PLACEMENT IS THE WHOLE FIX.
  // The first version sat at the placement boundary beside §80 and read the
  // long run's `duration_mins` there. Measured: at placement H1's peak long run
  // is 116 minutes; by the time the runner sees it, it is 124. Something
  // downstream lengthens it, so a duration read at placement is STALE and the
  // cue silently missed every session sitting just under the threshold. Caught
  // by the invariant on the first run, which is the argument for shipping the
  // rule and its check together.
  //
  // PEAK-ONLY AND NON-DELOAD PRESERVED (§24c/§96): a cue on every long run is
  // wallpaper. Ultra behaviour is unchanged — where the catalogue supplies a
  // cadence it is used verbatim; other distances get PRACTICE guidance with no
  // cadence, because inventing one would be a nutrition prescription Zonna has
  // no data to support (ADR-011).
  {
    const raceKey = raceDistanceKey(input.race_distance_km)
    const isUltraRace = raceKey === '50K' || raceKey === '100K'
    const cadence = isUltraRace ? ultraFuellingCadenceMins(catalogue) : null
    for (const w of weeks) {
      if (w.phase !== 'peak') continue
      for (const sn of Object.values(w.sessions ?? {})) {
        if (!sn || sn.role !== 'long_run') continue
        if ((sn.duration_mins ?? 0) < GENERATION_CONFIG.FUELLING_PRACTICE_MIN_SESSION_MINS) continue
        appendCoachNote(sn, cadence
          ? `${ULTRA_FUELLING_PREFIX}${cadence.min}–${cadence.max} minutes, starting in the first hour. ` +
            'Race day is not the day to find out what your stomach tolerates.'
          : FUELLING_PRACTICE_NOTE)
      }
    }
  }

  // V8 / CD-20 (SC-01) — record the withheld second quality session.
  //
  // McMillan's binding amendment: when the engine DECLINES the second quality
  // session it must be a recorded decision, not a silent absence. Half the W1d
  // wave exists because things failed quietly — and a four-day runner who asks
  // why they only get one quality session deserves an answer from the plan
  // rather than from the source code.
  {
    const minDays = GENERATION_CONFIG.MIN_TRAINING_DAYS_FOR_SECOND_QUALITY
    const trainingDays = Math.min(
      input.days_available,
      7 - blockedDays(input).size,
      GENERATION_CONFIG.MAX_TRAINING_DAYS_PER_WEEK,
    )
    // The note is only truthful when the engine ACTUALLY planned two and days
    // cut it to one. That decision is `qualityCountInPeak > 1` in the per-week
    // builder (min(plannedQuality, fitnessCeiling)): plannedQuality reaches 2
    // only for STRUCTURAL `fitness === 'experienced'` (§79 — count is a load
    // decision, keyed off structure, not the declared intensity), and the
    // fitnessCeiling `QUALITY_SESSIONS_PER_WEEK_MAX[intensityFitness]` must
    // allow 2 (i.e. intensity is not `beginner`). This reporter previously gated
    // on `intensityFitness === 'experienced'` — a DIFFERENT predicate from the
    // count it claims to explain — so a structural-intermediate/declared-
    // experienced runner was told a second quality was "withheld for days" when
    // the count was 1 regardless of days, advertising a 5th-day lever that does
    // not exist. Gate reconstructs the count's own predicate so claim and
    // computation cannot disagree (claim/computation-mismatch class).
    const plannedTwoInPeak = fitness === 'experienced'
      && GENERATION_CONFIG.QUALITY_SESSIONS_PER_WEEK_MAX[intensityFitness] >= 2
    if (trainingDays < minDays && plannedTwoInPeak) {
      const affected = weeks
        .filter(w => w.phase === 'peak' && w.badge !== 'deload')
        .map(w => w.n)
      if (affected.length > 0) {
        ruleAdjustments.push({
          rule: 'V8-second-quality-min-days',
          violation: `Peak weeks intend two quality sessions for an experienced runner, but the week has ${trainingDays} training days.`,
          resolution: `Second quality session withheld (needs ${minDays}). At ${trainingDays} days, a long run plus two quality sessions leaves too little room for easy running — the week would lose volume from the easy run, which is the part that makes the hard work survivable (CoachingPrinciples §8, §9).`,
          weeks_affected: affected,
        })
      }
    }
  }
  // DIAGNOSTIC: re-run the cap last to test whether a later pass undoes it.
  applyV3HrEstimationNotePropagation(weeks, hrFallback.method, recalibrationWeeks)
  applyV7TaperRationale(weeks, input.race_distance_km)

  // CoachingPrinciples §53 — quality variety across the full plan. Catalogue
  // rotation gets stuck when only one threshold row is eligible for taper
  // (progressive_tempo) AND for peak (2 candidates, even split). Walk the plan
  // and rebalance over-represented labels with under-represented same-category
  // alternatives. Same-category swap preserves the physiology (T-pace, Z3)
  // and the session shape — only the label and coach voice change.
  {
    const cap = (n: number) =>
      Math.floor(n / GENERATION_CONFIG.QUALITY_VARIETY_DENOMINATOR)
        + GENERATION_CONFIG.QUALITY_VARIETY_ALLOWANCE
    // Build a tally and a list of (week, day, session) for each label.
    type QualPos = { week: Week; day: Day; session: Session }
    const positionsByLabel = new Map<string, QualPos[]>()
    for (const w of weeks) {
      if (w.type === 'race') continue
      for (const [d, s] of Object.entries(w.sessions) as [Day, Session | undefined][]) {
        if (!s || s.type !== 'quality') continue
        const label = (s.label ?? '').trim()
        if (!label) continue
        if (!positionsByLabel.has(label)) positionsByLabel.set(label, [])
        positionsByLabel.get(label)!.push({ week: w, day: d, session: s })
      }
    }
    const totalQuality = Array.from(positionsByLabel.values()).reduce((a, v) => a + v.length, 0)
    const max = cap(totalQuality)

    // Find under-represented labels in the same physiology bucket. We bucket by
    // the session's zone tag — Zone 3 / Zone 3–4 = threshold; Zone 4–5 = vo2max.
    // Goal-pace overrides are skipped — they're a coordinated specificity move
    // per §22, not catalogue rotation. Rotating one into a bare threshold name
    // ("Cruise intervals") strips its race-pace signal and trips §22/§19.
    // Keyed on the stable "-pace " fragment every goal-pace label carries
    // (LABEL-VARIETY-01 gave the override a per-row trailing word — "…-pace
    // reps", "…-pace ladder" — so the old enumerated regex no longer covers it).
    const isOverride = (label: string): boolean => label.includes('-pace ')

    const physBucket = (s: Session): 'threshold' | 'vo2max' | 'other' => {
      const zone = (s.zone ?? '').toLowerCase()
      if (zone.includes('zone 4') || zone.includes('zone 5')) return 'vo2max'
      if (zone.includes('zone 3')) return 'threshold'
      return 'other'
    }

    // Threshold-bucket alternative labels + matching coach voices.
    const THRESHOLD_ALTS: { label: string; voice: string }[] = [
      { label: 'Continuous tempo', voice: 'Sustained sub-threshold work. Builds the ceiling.' },
      { label: 'Cruise intervals', voice: 'Threshold work in repeats. Same effort on rep 3 as rep 1 — that is the test.' },
      { label: 'Progressive tempo', voice: 'Start at aerobic, finish at threshold. Discipline at the start, honesty at the end.' },
    ]

    for (const [label, positions] of Array.from(positionsByLabel)) {
      if (isOverride(label)) continue
      if (positions.length <= max) continue
      const overage = positions.length - max
      const sample = positions[0].session
      const bucket = physBucket(sample)
      if (bucket !== 'threshold') continue  // current swap pool covers threshold only

      // Pick alternative threshold labels under cap.
      const labelCounts = new Map<string, number>()
      for (const [l, ps] of Array.from(positionsByLabel)) labelCounts.set(l, ps.length)
      const altCandidates = THRESHOLD_ALTS
        .filter(a => a.label !== label)
        .sort((a, b) => (labelCounts.get(a.label) ?? 0) - (labelCounts.get(b.label) ?? 0))

      let swapped = 0
      // Walk positions in order; skip first `max` (keep them as-is), swap the rest.
      for (let i = max; i < positions.length && swapped < overage; i++) {
        const pos = positions[i]
        // Pick the alt with lowest current count.
        const alt = altCandidates.find(a => (labelCounts.get(a.label) ?? 0) < max) ?? altCandidates[0]
        if (!alt) break
        pos.session.label = alt.label
        pos.session.coach_notes = [alt.voice]
        labelCounts.set(label, (labelCounts.get(label) ?? 0) - 1)
        labelCounts.set(alt.label, (labelCounts.get(alt.label) ?? 0) + 1)
        swapped++
      }
    }
  }

  // CoachingPrinciples §27 — themes can drift out of alignment after §47/§45
  // post-passes shrink a week's weekly_km. Re-derive overload-implying themes
  // so the §27 invariant doesn't trip on weeks whose volume no longer exceeds
  // the prior non-deload week.
  for (let i = 0; i < weeks.length; i++) {
    const w = weeks[i]
    if (w.type === 'race' || w.type === 'deload') continue
    if (w.phase !== 'peak') continue
    const themeText = (w.theme ?? '').toLowerCase()
    const overloadImplied = themeText.includes('highest volume')
      || themeText.includes('fitness is built')
      || themeText.includes('feel hard')
      || themeText.includes('feels hard')
    if (!overloadImplied) continue
    const prevNonDeload = (() => {
      for (let j = i - 1; j >= 0; j--) if (weeks[j].type !== 'deload') return weeks[j]
      return null
    })()
    const qualityCount = Object.values(w.sessions).filter(s => s?.type === 'quality').length
    if (!prevNonDeload || w.weekly_km <= prevNonDeload.weekly_km || qualityCount === 0) {
      w.theme = 'Consistency. The work is the volume.'
      w.label = 'Peak — consistency'
    }
  }

  // ── Meta ────────────────────────────────────────────────────────────────────
  // ── Volume profile composition ──────────────────────────────────────────────
  // Two independent triggers can downgrade a plan to 'maintenance':
  //   (a) §23/§38/§45/§46 — peak doesn't actually overload (ratio / floor / LR fails)
  //   (b) §52 (low-day extension) — too few days/wk for a structurally-sound plan
  // Compute each separately, then compose. The note from (a) is more specific,
  // so it wins when both fire; (b)'s note is the fallback.

  // §23 result — runs only on plans long enough for overload to be a coherent
  // requirement. Returns { volume_profile, volume_constraint_note? }.
  const peakOverloadResult: { volume_profile: 'build' | 'maintenance'; volume_constraint_note?: string } | null =
    totalWeeks >= GENERATION_CONFIG.PEAK_OVERLOAD_MIN_PLAN_WEEKS
      ? (() => {
          const w1 = weeks[0]?.weekly_km ?? 0
          const peakKmActual = Math.max(...weeks.filter(wk => wk.phase === 'peak').map(wk => wk.weekly_km), 0)
          const ratio = w1 > 0 ? peakKmActual / w1 : 0
          const isTimeTarget = input.goal === 'time_target'
          const distKey = raceDistanceKey(input.race_distance_km)
          const distKm = input.race_distance_km

          // DELOAD-INVERSION-01 (§52 / §2 injury cap, Coaching Board 2026-09-06) — an INJURED
          // runner (knee/shin) with BEGINNER structural volume building an ULTRA is
          // maintenance-grade, not a build. You cannot safely build injured,
          // low-volume tissue to a 50K/100K (Willy: injury = maintenance-grade).
          // Classifying it maintenance is the honest §52 outcome AND exempts it
          // from §1's session-share ceiling, which such a plan cannot satisfy: a
          // benchmark can lift its INTENSITY (→ quality sessions) while its VOLUME
          // (→ few sessions) stays low, so the quality SHARE runs high. Narrow by
          // construction — injury + structural beginner + ultra (10 plans in the
          // sweep grid), and each is genuinely one no coach would call a build.
          if (hasVolumeCappedInjury(input)
              && fitness === 'beginner' && distKm > 43) {
            return {
              volume_profile: 'maintenance' as const,
              volume_constraint_note: `An injury history plus a beginner's current volume can't safely build to a ${distKey} — the plan protects your current fitness rather than pushing volume into injured tissue. Aim to finish, not to a time; a healthy return to higher mileage comes first.`,
            }
          }

          // §46 floor for marathon and ultra (time-target only).
          let volumeFloor = 0
          if (isTimeTarget) {
            if (distKm >= 40 && distKm <= 43) volumeFloor = distKm * GENERATION_CONFIG.MARATHON_PEAK_VOLUME_FLOOR_RATIO
            else if (distKm > 43 && distKm <= 55) volumeFloor = distKm * GENERATION_CONFIG.ULTRA_50K_PEAK_VOLUME_FLOOR_RATIO
            else if (distKm > 55) volumeFloor = Math.min(
              distKm * GENERATION_CONFIG.ULTRA_LONG_PEAK_VOLUME_FLOOR_RATIO,
              GENERATION_CONFIG.ULTRA_PEAK_VOLUME_FLOOR_CAP_KM,
            )
          }

          // §24 long-run floor for HM/marathon (time-target only).
          let longRunFloorKm = 0
          let actualPeakLrKm = 0
          if (isTimeTarget && (distKey === 'HM' || distKey === 'MARATHON')) {
            const ratioCfg = GENERATION_CONFIG.PEAK_LR_RATIO_VS_RACE[distKey]
            longRunFloorKm = distKm * ratioCfg
            for (const wk of weeks) {
              if (wk.phase !== 'peak' || wk.type === 'deload') continue
              for (const s of Object.values(wk.sessions)) {
                if (s && isLongRun(s)) {
                  // SESSION-KM-01 (2026-09-11) — was `s.distance_km ?? 0`.
                  //
                  // A beginner's plan is DURATION-ANCHORED: `duration_mins` is
                  // set and `distance_km` is null. So this read 0 for a 132-minute
                  // long run, `lrFails` was unconditionally true, and the plan was
                  // downgraded to `maintenance` on a false premise — while telling
                  // the runner "Peak long run 0 km is below the 17.9 km floor".
                  // Measured before the fix: 45 of 135 HM/marathon time-target
                  // plans in the cohort grid (33.3%).
                  //
                  // §24's floor means the runner's ACTUAL peak long run. Reading
                  // 0 is not a conservative default, it is a wrong measurement,
                  // so this is a defect fix restoring documented intent and is
                  // Coaching-Board exempt (ADR-017). The classification it moves
                  // is declared against `cohort:shape` in the same commit.
                  actualPeakLrKm = Math.max(actualPeakLrKm, sessionKmOrZero(s, pace.minPerKmEasy))
                }
              }
            }
          }

          const ratioFails  = ratio < GENERATION_CONFIG.PEAK_OVER_BASE_RATIO
          const volumeFails = volumeFloor > 0 && peakKmActual + 0.01 < volumeFloor
          // §24 Amendment 1 (Coaching Board 2026-09-13, MARATHON-MAINT-LABEL-01
          // re-opened) — the floor comparison must not be decided by the engine's
          // OWN rounding.
          //
          // The peak long run is floor-rounded to DISTANCE_ROUNDING_PRECISION_KM
          // before it reaches here (`floorDist` in the long-run placement), and
          // was then compared against an UNROUNDED threshold. So a runner whose
          // computed long run is 31.9 km is stored as 31.5 and fails a 31.65 km
          // floor by 150 metres — labelled `maintenance` by a rounding artefact.
          // Measured: 9 of 162 marathon plans below the floor (5.6%) and 6 of 78
          // HM plans (7.7%) sit inside that dead band. Willy: 0.5 km on a 31.65 km
          // long run carries no tissue implication; this is a comparison bug, not
          // a load change. McMillan: six kilometres short is a coaching fact the
          // runner should be told, 150 metres is not, and both read the same
          // sentence today.
          //
          // Reuses DISTANCE_ROUNDING_PRECISION_KM — the tolerance IS the rounding
          // that caused it, so no new coaching numeric enters.
          //
          // ⚠️ This is the ONLY part of the batch sitting's item 2 that survived
          // measurement. The proposed §24-vs-LONG_RUN_CAP_MINUTES exclusion is
          // DEAD: the cap allows 33.5 km against a 31.65 km floor at the engine's
          // actual easy pace, so it never binds, and implementing it flipped zero
          // plans. Substituting §45 as the blocker was ruled INCORRECT because
          // §45 already legislates this case in its own words ("this principle
          // wins and the plan downgrades to maintenance"). Do not re-file either.
          const lrFloorTolerated = longRunFloorKm - GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
          const lrFails     = longRunFloorKm > 0 && actualPeakLrKm + 0.01 < lrFloorTolerated

          if (!ratioFails && !volumeFails && !lrFails) {
            return { volume_profile: 'build' as const }
          }

          const reasons: string[] = []
          // ONE CAUSE, ONE TELLING — applied inside the note as well as between
          // tiles (SLT 2026-09-17). `ratioFails` and `volumeFails` are two
          // readings of the same fact: the weekly mileage does not get big
          // enough. Stacking both produced three consecutive sentences about
          // weekly volume, two of them opening "Your biggest week" with
          // different meanings. When the floor reading is available it wins,
          // because it names the actual gap the runner can act on; the ratio
          // reading only says "it did not climb".
          if (ratioFails && !volumeFails) {
            // V7 / CD-10 — the ratio is deliberately peak-PHASE-scoped (§23: does the
            // plan overload INTO the peak?), but the note must not imply peakKmActual
            // is the plan's maximum. For a beginner the highest week can sit in base
            // (peak = long run + specificity, not tonnage — §80). State both figures
            // so the note is arithmetically honest about the plan the runner holds.
            const planMaxKm = Math.max(...weeks.map(wk => wk.weekly_km), 0)
            // SLT 2026-09-17 — consequence first, arithmetic out. This read
            // "Peak-phase volume 52 km is 104% of week 1 (50 km), below the 110%
            // overload threshold." Precise, unarguable, and unusable: nobody has
            // ever acted on 110%. The runner needs to know their weekly mileage
            // holds steady instead of climbing, which is the same fact in words
            // they can do something with.
            // PLAN-NOTE-LENGTH-01 — this clause is a SECOND detail on the same
            // point as "holds steady rather than climbing", so it only earns
            // its 12 words when it is the note's only reason. With the long-run
            // clause also present the note reached 127 words against a 117
            // ratchet, and the test's instruction is to shorten the copy.
            // Decided here rather than by trimming at the join, because only
            // here is it known that this clause is the redundant one.
            const baseNote = planMaxKm > peakKmActual && reasons.length === 0 && !volumeFails && !lrFails
              ? ` Your biggest week comes earlier in the block, not at the end.`
              : ''
            reasons.push(`Your weekly mileage holds steady across this plan rather than climbing into the final weeks.${baseNote}`)
          }
          if (volumeFails) {
            // Keep BOTH figures — Hutchinson: the gap is the coaching fact, and a
            // note that reports a constraint without naming what it costs the
            // runner is a disclaimer, not coaching. Dropped: "floor", "% of race
            // distance", and the raw distance key.
            reasons.push(`Your biggest week reaches ${peakKmActual} km, where a time goal at this distance usually wants nearer ${Math.round(volumeFloor)}.`)
          }
          if (lrFails) {
            // COPY-GLYPH-01 (founder-reported, 2026-09-17) — this sentence used to
            // end "week-on-week long-run cap (§45) prevented reaching the ratio."
            // A § is how the constitution talks to US; the runner cannot open
            // CoachingPrinciples, so it reads as a glitch. "The ratio" was jargon
            // for the same reason. The rule is stated in words instead, and the
            // em dash went with it (BRAND-EMDASH-01's standard).
            // The one genuinely SAFETY-relevant line here, so it keeps both
            // numbers and gains the consequence: this runner arrives at the start
            // line never having run the distance the race asks for, and should be
            // told what that feels like rather than what ratio it breaches.
            reasons.push(`Your longest run reaches ${Math.round(actualPeakLrKm * 10) / 10} km, where this race wants nearer ${Math.round(longRunFloorKm * 10) / 10}, so the closing stretch will be new ground on the day. The long run can only grow so much week to week, and it ran out of weeks before it got there.`)
          }
          // MAINT-LABEL-01 (2026-09-11, second pass) — two defects in one string.
          //
          // (1) It ended "Plan maintains current fitness rather than building
          //     it." That is the sentence the founder objected to, and the first
          //     pass only rewrote the lopsided-week variant; this family kept
          //     shipping it, to beginners, on 5K through marathon.
          // (2) The remedies named DATABASE FIELDS — "increase days_available
          //     from 4 to 5", "raise max_weekday_mins from 30 to 90". Same
          //     defect class as UX-BEGINNER-01, which was fixed in `inputs.ts`
          //     and missed here: a runner is told to change a column name.
          // SLT 2026-09-17 — ONE reassurance, not two, and no em dash (the
          // COPY-GLYPH-01 ratchet). Sutherland: the tile opened by explaining
          // what the plan could not do, in our warning colour. Lead with what it
          // WILL do; the runner has just committed to this.
          // PLAN-NOTE-LENGTH-01 — AT MOST TWO REASONS, and the cap is the fix
          // the ratchet test asks for rather than a raised ratchet.
          //
          // `reasons` accumulates one clause per failing check, and nothing
          // bounded the count. Three stacking (ratio + volume + long run) put
          // the note at **127 words** against a 117-word ratchet, surfaced when
          // GRID-MARATHON-CAPABLE-01 widened the grid to a cohort that trips
          // all three at once. The test's own instruction is "shorten the copy,
          // do not raise the ratchet", and the SLT's PLAN-NOTE-VOICE-01 ruling
          // is consequence, then cause, then the one lever — singular.
          //
          // ⚠️ THE ORDER OF `reasons` IS THE PRIORITY ORDER and it is already
          // correct: the long-run clause is pushed last and is the one
          // Hutchinson called "the one genuinely SAFETY-relevant line here", so
          // it is kept and the earlier, softer clauses are what drop. Taking
          // the LAST two rather than the first preserves that.
          const shown = reasons.slice(-2)
          // ⚠️ TWO CAUSES WORE ONE SENTENCE, AND FOR THE COMMONER ONE IT WAS
          // FALSE (CB-PLAN-REVIEW-01, Coaching Board 2026-09-19).
          //
          // "built to get you round, not to chase a time" is §114's finish-goal
          // language. It is TRUE when the engine cannot build the runner far
          // enough for the time they asked for — `volumeFails` or `lrFails`.
          // It is FALSE when the ONLY failing check is the ramp ratio, because
          // that is §23's "nowhere to ramp to": the runner's volume is already
          // adequate and the block sharpens rather than builds. Telling them we
          // are getting them round misdescribes their own plan.
          //
          // MEASURED across 45,888 plans: of time-goal maintenance plans,
          // **8,852 are at their ceiling against 2,396 genuinely under-built —
          // the sentence was wrong 78.7% of the times it fired.** The sharp
          // case the board would not hand over: an experienced runner on
          // 55 km/week chasing a 45:00 10K, told their plan is to get them
          // round.
          //
          // Sims, on why the wording is not cosmetic: to a runner who entered a
          // time goal, "get you round" reads as being quietly reassigned to a
          // lesser category. The CLASSIFICATION is correct either way (§23
          // licenses maintenance) — only the description was wrong.
          const atCeiling = ratioFails && !volumeFails && !lrFails
          const opening = atCeiling
            ? 'Your weekly volume is already where this distance wants it, so this plan sharpens rather than builds. '
            : 'This plan is built to get you round, not to chase a time. '
          const closing = atCeiling
            ? ' The gains here come from the quality sessions, not from more miles.'
            : ' You will still get fitter: starting from where you are, you could hardly not.'
          const diagnosis = opening + shown.join(' ') + closing

          const suggestions: string[] = []
          if (input.days_available < 6) {
            suggestions.push(`run ${input.days_available + 1} days a week instead of ${input.days_available}`)
          }
          if (input.max_weekday_mins != null && input.max_weekday_mins < 90) {
            suggestions.push(`give your weekday runs more room than the ${durationText(input.max_weekday_mins)} you have allowed`)
          }
          // The weeks suggestion is gated on the weeks ACTUALLY being short.
          // It used to fire whenever the long-run or volume floor failed, so a
          // runner with exactly enough runway was told "current 16, recommended
          // ≥16" — advice to change nothing. Invisible while the copy was
          // schema-shaped; obvious the moment it read as a sentence.
          const weeksWanted = GENERATION_CONFIG.PREP_TIME_THRESHOLDS[distKey].warn
          if ((lrFails || volumeFails) && totalWeeks < weeksWanted) {
            suggestions.push(`give yourself more weeks before race day (you have ${totalWeeks}, this distance wants at least ${weeksWanted})`)
          }
          const prescription = suggestions.length > 0
            ? ` If you want it to build instead: ${suggestions.join(', or ')}.`
            : ''
          return {
            volume_profile: 'maintenance' as const,
            volume_constraint_note: diagnosis + prescription,
          }
        })()
      : null

  // §52 (low-day extension) — structural maintenance trigger. Three triggers:
  //   1. days_available <= 2: any 2-day plan. The §9 ratio (long ≥ 1.25× easy)
  //      forces LR ≥ ~56% of weekly volume on 2 sessions, leaving no room
  //      under the §52 60% cap. Maintenance is the honest framing.
  //   2. days_available < days_required_ok for the distance (e.g. 3 days for
  //      marathon, where ok=4): the runner is below the recommended training
  //      frequency for build-grade adaptation.
  //   3. validator returned 'warn' (means user acknowledged a sub-recommended
  //      time-targeted plan): same outcome as case 2, just gated on time goal.
  // All three resolve to: maintenance + a constraint note.
  const daysLowMaintenance = input.days_available <= 2
    || input.days_available < daysCheck.days_required_ok
    || daysCheck.status === 'warn'
  const daysLowNote = daysLowMaintenance
    ? `This plan is built to get you round, not to build you up — ${input.days_available} day${input.days_available === 1 ? '' : 's'}/week is ${
        input.days_available <= 2 ? 'too few sessions to avoid structurally lopsided weeks (long run dominates weekly volume)' : `below the recommended ${daysCheck.days_required_ok}-day-minimum for a ${raceDistanceKey(input.race_distance_km)} build`
      }. You will get fitter doing it — starting from where you are, you could hardly not. What it will not do is build toward a time goal. If you want it to build instead: run at least ${Math.max(daysCheck.days_required_ok, 3)} days a week.`
    : null

  // VOL-STRUCTURE-01 / §52 (fourth trigger, 2026-08-20) — the runner's volume
  // cannot be STRUCTURED within their available days.
  //
  // Detected by OUTCOME rather than by proxy: if the peak phase's biggest week
  // is smaller than the base phase's biggest week, the plan does not progress —
  // whatever the volume curve intended.
  //
  // Measured on realistic inputs (long run 20-60% of weekly volume, i.e. a
  // runner whose numbers are internally consistent), this fired on 33% of
  // plans, rising with volume-per-available-day: 4% at <=8 km/day, 53% at
  // 13-16, 73% at 17+. Those runners were handed a plan that peaks BELOW where
  // they started — it detrains them — and it said nothing.
  //
  // The mechanism, traced (10K, 3 days, 60 km/wk): base weeks run a 19km long
  // run at 119 of a 120-minute cap plus two 15km easy runs = 49km. A quality
  // session then DISPLACES a 15km easy run with a ~9km session, and neither
  // remaining slot can absorb the 6km — the long run is pinned at
  // LONG_RUN_CAP_MINUTES and easy is capped at long / LONG_RUN_MIN_RATIO_VS_EASY
  // (§9). The volume falls out of the STRUCTURE, not out of a coaching decision.
  //
  // The board rejected the charitable reading — that this is a deliberate
  // volume cut for a short race. A defensible reduction and an accidental one
  // produce the same number, and the engine gives no evidence of intent
  // (Hutchinson). The caps do not move; both are correct (Willy).
  //
  // Same treatment §52 already gives a 2-day week: maintenance profile plus an
  // honest note. Same condition — volume that will not fit the days — detected
  // by result instead of by day count.
  const structuralPeakInversion = (() => {
    // FILTER MUST MATCH INV-PLAN-PEAK-IN-PEAK-PHASE EXACTLY. A first version
    // also excluded badge-deload weeks; the invariant excludes by `type` only,
    // so a badge-deload week with high volume counted toward the invariant's
    // maximum and not toward this detection — leaving 338 of 1080 violations
    // standing. Two filters for one question is how they drift.
    const nonDeload = weeks.filter(w => w.n > 0 && w.type !== 'race' && w.type !== 'deload')
    const maxOf = (phase: string) => {
      const ws = nonDeload.filter(w => w.phase === phase)
      return ws.length > 0 ? Math.max(...ws.map(w => w.weekly_km)) : 0
    }
    const peakMax = maxOf('peak')
    if (peakMax <= 0) return null

    // EXACTLY §23'S OWN COMPARISON: does the peak phase reach the plan's
    // maximum? Not a re-derivation of it.
    //
    // Two narrower versions failed here and both failures were instructive.
    // Comparing base-vs-peak left 828 of 1080 violations standing, because the
    // commonest shape is a BUILD week on top. Adding build left 338, because
    // the next commonest is a TAPER week on top — the delivered taper exceeding
    // the delivered peak, since the taper's smaller targets are achievable
    // where the peak's are not. Same root cause wearing three shapes.
    //
    // Deriving the condition twice is how a detection and its invariant drift.
    // This asks the invariant's question verbatim.
    const planMax = Math.max(0, ...nonDeload.map(w => w.weekly_km))
    if (planMax <= 0 || peakMax >= planMax) return null

    // MATERIALITY GATE. Measured across realistic inputs, the inversion
    // distribution is min 1.3% / median 4.2% / p75 10.6% / max 15.6%. Most of it
    // is ROUNDING — session distances round to 0.5km and a week holds 3-6
    // sessions, so +/-1-2km of noise is structural, not a coaching failure.
    //
    // Without this gate a first implementation flipped 45% of realistic plans to
    // "maintenance", including a 45 km/week runner on four days. That is
    // relabelling at scale, not a fix: maintenance is for runners who genuinely
    // cannot be built, not for the engine's own rounding.
    //
    // Above the gate the plan really does not progress — the traced 49->43 and
    // the 50K 94->83 both sit at ~12%.
    const inversionPct = ((planMax - peakMax) / planMax) * 100
    if (inversionPct < GENERATION_CONFIG.PEAK_INVERSION_MATERIAL_PCT) return null
    return { baseMax: planMax, peakMax, lostKm: planMax - peakMax }
  })()

  // VOL-SHORTFALL-01 / §40c — did a life-first constraint materially suppress
  // the peak week?
  //
  // Measured as a COUNTERFACTUAL, which is the only honest way to answer it:
  // the weekday cap binds through easy-run durations, so "how much did it cost"
  // cannot be read off the finished plan. Compare the volume curve's intent
  // against what was actually delivered.
  //
  // The cap WINS — this states the cost, it never changes the plan (Seiler:
  // clawing the volume back onto the weekend converts a manageable week into a
  // two-hard-days week, the pattern this product exists to prevent).
  // Measured peak-week shortfall as a percentage, or null when the weekday cap
  // is not materially binding. Stamped into meta so the honesty obligation is
  // MECHANICALLY CHECKABLE: the invariant cannot recompute a counterfactual
  // (the volume curve is generation-time state), so without this it could only
  // check pinned-ness — which fires on plans whose volume landed fine, and
  // caught exactly that mismatch on the HM archetype.
  const volumeShortfallPct: number | null = (() => {
    if (!input.max_weekday_mins) return null
    const peakActual = Math.max(0, ...weeks
      .filter(w => w.type !== 'deload' && w.type !== 'race' && w.badge !== 'deload')
      .map(w => w.weekly_km))
    const peakIntent = Math.max(0, ...volumes)
    if (peakIntent <= 0 || peakActual <= 0) return null

    let weekdayEasy = 0
    let pinned = 0
    for (const w of weeks) {
      for (const [d, sn] of Object.entries(w.sessions) as [Day, Session | undefined][]) {
        if (!sn || sn.type !== 'easy' || d === 'sat' || d === 'sun') continue
        weekdayEasy++
        if ((sn.duration_mins ?? 0) >= input.max_weekday_mins - 1) pinned++
      }
    }
    // Not materially binding → the cap is not what shaped this plan, and naming
    // the wrong lever is worse than saying nothing.
    if (weekdayEasy === 0 || pinned / weekdayEasy < 0.25) return null

    return Math.max(0, ((peakIntent - peakActual) / peakIntent) * 100)
  })()

  const volumeShortfallNote: string | null = (() => {
    if (!input.max_weekday_mins) return null

    if (volumeShortfallPct == null) return null
    if (volumeShortfallPct < GENERATION_CONFIG.VOLUME_SHORTFALL_NOTE_THRESHOLD_PCT) return null

    const lostPct = volumeShortfallPct
    const peakActual = Math.max(0, ...weeks
      .filter(w => w.type !== 'deload' && w.type !== 'race' && w.badge !== 'deload')
      .map(w => w.weekly_km))
    const peakIntent = Math.max(0, ...volumes)

    // Name the lever (McMillan) — a note that only reports the loss is a
    // disclaimer; a note that names the one thing that would change it is
    // coaching. Five-day weeks lose 2-11% where three- and four-day weeks lose
    // 25%, so the day count is the honest first lever.
    const lever = input.days_available < 5
      ? `running ${input.days_available + 1} days instead of ${input.days_available}`
      : `raising the weekday limit to ${durationText(input.max_weekday_mins + 15)}`

    // Voice per brand.md: honest, specific, never motivational. The earlier
    // draft included "a 44km week you run beats a 65km week you abandon" —
    // true, but it is encouragement, and the brand rule is that we state the
    // fact and let the runner draw the conclusion.
    return `Your weekday limit of ${durationText(input.max_weekday_mins)} is shaping this plan — peak week reaches ${Math.round(peakActual)}km where it would otherwise have gone to ${Math.round(peakIntent)}km, about ${Math.round(lostPct)}% less. Only the volume moves; the sessions and their balance don't. If you want it back, ${lever} is the lever.`
  })()

  // §80 — if LONG_RUN_CAP_MINUTES stopped the peak long run reaching the
  // finish-goal floor, say so rather than shipping a silent shortfall. The cap
  // still wins; the runner is told what the plan cannot give them.
  const finishGoalLrShortfallNote: string | null = (() => {
    if (input.goal !== 'finish') return null
    const dk = raceDistanceKey(input.race_distance_km)
    if (dk !== 'HM' && dk !== 'MARATHON') return null
    if (!(pace.minPerKmEasy > 0)) return null
    const projectedRaceMins = input.race_distance_km * pace.minPerKmEasy
    const floorMins = projectedRaceMins * GENERATION_CONFIG.FINISH_GOAL_PEAK_LR_RATIO_VS_RACE_DURATION
    let peakLrMins = 0
    for (const w of weeks) {
      if (w.phase !== 'peak' || w.type === 'deload') continue
      for (const sess of Object.values(w.sessions)) {
        if (!sess || sess.type !== 'easy') continue
        if (!isLongRun(sess)) continue
        const mins = sess.duration_mins ?? ((sess.distance_km ?? 0) * pace.minPerKmEasy)
        peakLrMins = Math.max(peakLrMins, mins)
      }
    }
    // §80 Am.1 — MATERIALITY. The note used to fire at a 2-minute shortfall
    // (1.7% of the floor) and then tell the runner to expect race day to be
    // "new territory". §40c: "notes that fire on noise get ignored, which costs
    // more than the note gains". 5% silences 2.6%; 10% would silence 30.5%.
    const materialFloorMins = floorMins * (1 - GENERATION_CONFIG.LONG_RUN_SHORTFALL_MATERIAL_PCT / 100)
    if (peakLrMins === 0 || peakLrMins >= materialFloorMins) return null
    // ⚠️ SECOND INSTANCE OF THE SAME DEFECT AS `structuralNote` ABOVE, found
    // while fixing that one (M5-EASY-CEILING-01, Coaching Board 2026-09-16).
    //
    // This block's own opening comment states the intent — "IF
    // LONG_RUN_CAP_MINUTES STOPPED the peak long run reaching the floor, say
    // so" — and the code never checked whether the cap was the cause. It fired
    // on ANY shortfall and blamed the time cap for all of them. On the plan the
    // board reviewed the long run was 151 minutes against a 210-minute cap: the
    // shortfall was real, the stated reason was not.
    //
    // The cap is only one of three things that can hold the long run down; the
    // others are §45's week-on-week progression cap and §9's share-of-the-week
    // sizing. §40c requires the note to name the lever, so it now names whichever
    // one is actually binding.
    const capMins = GENERATION_CONFIG.LONG_RUN_CAP_MINUTES[dk]
    // §80 Am.1 — the `+ 1` here was DEAD. `LONG_RUN_CAP_MINUTES` is applied on
    // the kilometre axis and the distance is then rounded, so a capped long run
    // lands 2–3 minutes UNDER its ceiling and can never satisfy `+1 >= cap`.
    // Measured: 0 of 5,264 notes named the cap; 71.0% sat 2–3 min beneath it
    // and blamed weekly volume, which for a marathoner 2 minutes under a
    // 210-minute ceiling is an injury vector served as advice (Willy).
    const atTimeCap = capMins > 0
      && peakLrMins + GENERATION_CONFIG.LONG_RUN_AT_CAP_TOLERANCE_MINS >= capMins
    // ⚠️ THE CAP BRANCH NAMES NO LEVER, ON PURPOSE (McMillan, §80 Am.1). §40c
    // says name the lever that would change it; when the ceiling binds there
    // isn't one, and §40 already settled that "the caps do not move". Implying
    // the runner could train their way past it would be the same defect in the
    // opposite direction.
    // §80 Amendment 2 (Coaching Board 2026-09-20, MARA-LR-LOWBASE-01) — A THIRD
    // ARM, because the note had two and this cohort falls through both.
    //
    // MEASURED at the sitting. Marathon, finish goal, 3 days, `<6mo`, beginner,
    // 29-week runway. A KNEE-HISTORY runner and a HEALTHY runner at the SAME
    // weekly volume get different long runs:
    //
    //   cwk 12 / 15 / 20 — healthy 26 / 26 / 26 km (62% of race)
    //                    — knee    17 / 17 / 19 km (40 / 40 / 45%)
    //
    // Same volume, different long run. So weekly volume is DEMONSTRABLY not what
    // limits the injury cohort — the §12 volume cap is — and the note was telling
    // them otherwise. McMillan: "a runner told 'your weekly volume is what limits
    // it' will go and add volume, which is precisely what their knee history says
    // not to do." Willy, on the identical defect at §80 Am.1: "an injury vector
    // served as advice."
    //
    // ⚠️ THE ARM NAMES NO LEVER, ON PURPOSE — same construction as the cap branch
    // above (§80 Am.1, McMillan). §40c says name the lever that would change it;
    // a runner cannot train past their own injury history inside one build, so
    // implying they could would be the same defect in the opposite direction.
    //
    // ⚠️ PREDICATE REUSED, NOT RESTATED (D-08/D-16). `hasVolumeCappedInjury` is
    // the documented single owner of "does §12's volume cap apply", and
    // `volume_constraint_note` already branches on it a few hundred lines below
    // with the sibling sentence. A second predicate here would be the parallel-
    // semantics defect this repo keeps paying for.
    const injuryCapped = hasVolumeCappedInjury(input)
    const why = atTimeCap
      ? 'and this is as far as we take it: the long-run ceiling for this distance is deliberate, not a gap in the plan'
      : injuryCapped
      ? 'and your injury history is what limits it: the cap on how fast weekly volume may rise holds the long run down with it, which is the trade we are making on purpose'
      : 'but your weekly volume is what limits it: the long run is sized as a share of the week, and this week cannot carry more'
    // §80 Am.2, second half (Sims) — the existing tail is about DISTANCE. Where
    // the race runs materially longer than the longest rehearsal, the FUELLING is
    // untested too, and for a first-time, predominantly-female cohort that is the
    // failure mode that arrives first.
    //
    // ⚠️ THRESHOLD DERIVED, NOT CHOSEN. `FUELLING_PRACTICE_MIN_SESSION_MINS` (120)
    // is §24e's own bar for "long enough that fuelling matters". A gap wider than
    // that is more than a whole fuelling-relevant session spent in untested
    // territory. Reusing §24e's constant rather than inventing a second one.
    const fuellingGapMins = projectedRaceMins - peakLrMins
    const fuellingTail = fuellingGapMins > GENERATION_CONFIG.FUELLING_PRACTICE_MIN_SESSION_MINS
      ? ` ${LR_SHORTFALL_UNREHEARSED_FUELLING}`
      : ''
    return `Your longest run tops out at ${durationText(peakLrMins)}. For a race you'll likely be moving for around ${durationText(projectedRaceMins)}, and we'd normally want it nearer ${durationText(floorMins)}, ${why}. Expect the last stretch of race day to be new territory; go out slower than feels right and take the walk breaks early rather than late.${fuellingTail}`
  })()

  // Compose final values. §23's note wins (more specific) when both trigger.
  // VOL-STRUCTURE-01 — the honest note for a plan that cannot progress.
  //
  // Names the LEVER, per §40c's rule: a note that only reports the loss is a
  // disclaimer. More days is the honest first lever, because the defect scales
  // with volume-per-available-day — 4% at <=8 km/day against 73% at 17+.
  //
  // ⚠️ THE MECHANISM CLAUSE IS MEASURED, NOT ASSERTED (M5-EASY-CEILING-01,
  // Coaching Board 2026-09-16). This note used to state flatly that "the long
  // run is already at its time cap" — and on the plan the board reviewed, the
  // long run was at 165 minutes against a 210-minute cap. The EFFECT it
  // describes is real (easy runs are held below the long run, so the week
  // cannot grow itself); the CAUSE it named was false.
  //
  // Measured across 5,760 weeks: §9's easy ceiling binds on 35.3% of them, and
  // the long run is at its time cap in only 19.8% of those. So the time cap was
  // the stated reason for a constraint it was not causing four times out of five.
  //
  // §40c requires the note to NAME THE LEVER, which is exactly why naming the
  // wrong one matters: a runner who reads "the long run is at its time cap"
  // learns nothing they can act on when it is not.
  const longRunCapMinsForNote = GENERATION_CONFIG.LONG_RUN_CAP_MINUTES[raceDistanceKey(input.race_distance_km)]
  const peakLrMinsDelivered = Math.max(0, ...weeks
    .filter(w => w.n >= 1 && w.type !== 'race')
    .map(w => {
      const lr = Object.values(w.sessions ?? {}).find(sn => !!sn && isLongRun(sn))
      return lr?.duration_mins ?? 0
    }))
  const longRunIsAtTimeCap = longRunCapMinsForNote > 0
    && peakLrMinsDelivered + 1 >= longRunCapMinsForNote
  const whyItCannotGrow = longRunIsAtTimeCap
    ? 'The long run is already at its time cap and the easy runs are capped against it'
    : 'Your easy runs are held below your long run so it stays the longest run of the week, and the long run is itself a share of that week'

  // SLT 2026-09-17 — was 103 words and said "it holds rather than grows" twice,
  // once at each end. BRAND-EMDASH-01: this note carried two of the em dashes
  // that item was filed for, and they go with the rewrite.
  const structuralNote: string | null = structuralPeakInversion
    ? `This plan holds your fitness rather than growing it. ${input.current_weekly_km}km a week across ${input.days_available} day${input.days_available === 1 ? '' : 's'} leaves no room to add: ${whyItCannotGrow}, so a harder session takes volume out of the week instead of adding to it. The lever is days, not effort: ${input.days_available + 1} running days would let the same volume climb.`
    : null


  // ── MAINT-LABEL-01 (2026-09-11) — WHAT THESE NOTES CALL THE PLAN ──────────
  //
  // Every one of these used to open "Plan generated as maintenance". Measured:
  // **89% of beginner MARATHON plans** carry one (320 of 360; 10K 0%, HM 4%),
  // including a parkrun-er with a 24-week runway. So the first thing the product
  // says to a first-time charity marathoner is a word §23 defines as "maintains
  // current fitness rather than building it".
  //
  // That is TRUE of the volume curve and FALSE about the runner. Someone going
  // from 5km a week to 26.2 miles will improve more than any other user of this
  // product; what the engine actually means is "the long run already takes most
  // of your week, so the week cannot also grow".
  //
  // SLT 2026-09-11, Sutherland: "Fix the word. Not the engine — the word."
  // So `volume_profile` is UNCHANGED — it feeds the paid confidence score and
  // §38's remedies, and changing the VALUE is a Coaching Board question
  // (MAINT-LABEL-01's second half). Only the prose moved: lead with what the
  // plan IS and what it will do, keep every diagnosis and every lever (§38
  // requires both), and never open with an internal classification.
  //
  // The post-race maintenance BLOCK (`plan_kind === 'maintenance'`, the badge in
  // PlanCalendar) is untouched — that one genuinely is maintenance.

  // §81 (MWM-02) — the long run does not fit the runner's stated weekday ceiling.
  // Only reachable when the long run has been forced onto a weekday (both
  // weekend days blocked); it is exempt from the cap, so without this the
  // overrun would ship silently. Same shape as lopsidedWeek above.
  // §81 — ONE weekday-overrun detector, three consumers (2026-09-15).
  //
  // This existed as three near-identical IIFEs differing only in which session
  // they matched, and the third — a plain EASY run — was simply never written.
  // A capped-weekday runner therefore got a 74-minute Thursday easy run against
  // a 30-minute cap in weeks 1-3 and was told nothing, because the only note
  // that fires talks about "hard sessions" and their first hard session is week
  // 5. The family had two of its three members. Found by the coaching deviation
  // scan, not by any invariant.
  type Overrun = { n: number; mins: number; cap: number } | null
  const weekdayOverrun = (matches: (sn: Session) => boolean): Overrun => {
    const cap = input.max_weekday_mins
    if (!cap) return null
    const limit = cap * (1 + GENERATION_CONFIG.LONG_RUN_WEEKDAY_OVERRUN_MAINTENANCE_PCT / 100)
    let worst: Overrun = null
    for (const w of weeks) {
      if (w.type === 'race') continue
      for (const d of ['mon', 'tue', 'wed', 'thu', 'fri'] as Day[]) {
        const sn = w.sessions?.[d]
        if (!sn || !matches(sn)) continue
        const mins = sn.duration_mins ?? 0
        if (mins > limit && (!worst || mins > worst.mins)) worst = { n: w.n, mins, cap }
      }
    }
    return worst
  }

  const longRunOverrun: Overrun = weekdayOverrun(sn => isLongRun(sn))

  // §81 DEFECT FIX (2026-09-11) — the obligation applies to STRUCTURED sessions
  // too, and the engine only ever applied it to the long run.
  //
  // §81 states it plainly: "An exemption is not a licence to ignore the runner —
  // it applies to the long run AND TO STRUCTURED SESSIONS ALIKE." The loop above
  // does `if (!isLongRun(sn)) continue`, so a quality session running far past
  // the runner's stated ceiling shipped with no note and no reclassification.
  //
  // Measured incidence: at max_weekday_mins 30, 54% of plans carry a weekday
  // structured session over the cap and 44% are past the 150% limit (worst seen:
  // 54 minutes against a stated 30). At a cap of 45 or above, NOTHING crosses
  // the limit — so this binds only on the most time-constrained runners, which
  // is exactly the cohort §81's closing paragraph is about.
  //
  // Restores documented intent, so it is board-EXEMPT per ADR-017 (the principle
  // was already correct; the engine was not honouring half of it).
  const structuredOverrun: Overrun =
    weekdayOverrun(sn => !isLongRun(sn) && isStructuredSession(sn))

  // THE MISSING THIRD. Neither a long run nor a structured session — a plain
  // easy run over the runner's own stated weekday budget. It has no §81
  // exemption to invoke and no intervals to protect; it is simply longer than
  // the time they said they had, and until now nothing said so.
  const easyOverrun: Overrun =
    weekdayOverrun(sn => !isLongRun(sn) && !isStructuredSession(sn)
      && sn.type !== 'rest' && sn.type !== 'race' && sn.type !== 'strength')

  // ⚠️ DELIBERATE PARTIAL — the NOTE ships, the maintenance downgrade does NOT.
  //
  // §81's obligation is two things: (1) say so, (2) classify maintenance. I
  // shipped both, then measured the after and found the second is far larger
  // than §81 anticipated. At `max_weekday_mins: 30`, maintenance classification
  // went **20% -> 80% of plans** (+60pp). §81's maintenance clause was written
  // for the LONG RUN case, which the section itself describes as rare — "only
  // when the long run has been forced onto a weekday, i.e. the runner blocked
  // both weekend days", 896 plans. The structured-session case is not rare: it
  // is 60% of 30-minute-cap plans. Applying the same remedy at sixty times the
  // incidence is a different decision from the one §81 recorded.
  //
  // It is also the exact magnitude the board REJECTED on 2026-09-06, when a
  // healthy bounceback cap flipped +50pp of plans and was thrown out for it.
  //
  // And the substance is genuinely arguable: weekends are NOT capped, so a
  // runner with 30-minute weekdays and a free Sunday can build perfectly well
  // for a 10K. Calling that plan "maintenance" may be over-classifying the very
  // cohort §81's closing paragraph (Sims) is trying not to turn away.
  //
  // So the runner is TOLD (the original defect — silence — is fixed), and the
  // reclassification waits for a board sitting with this measurement in front of
  // it. Tracked as CAT/MWM-STRUCTURED-MAINTENANCE-01 in the backlog.
  // SLT 2026-09-17 — was 90 words on 84 plans. The middle two sentences explained
  // an ENGINE decision (why we did not shorten the label) rather than telling the
  // runner anything they can use. Kept: the clash, and the lever.
  const structuredOverrunNote: string | null = structuredOverrun
    ? `Your hard sessions do not fit the time you have. You've capped weekdays at ${durationText(structuredOverrun.cap)}, and by week ${structuredOverrun.n} the session this race needs runs about ${durationText(structuredOverrun.mins)}. It stays at full length rather than being trimmed into something easier. The lever is one longer session a week: a weekend morning, or a single weekday you can give more time to.`
    : null

  // THE MISSING THIRD NOTE. `structuredOverrunNote` talks about "hard sessions"
  // and `longRunOverrunNote` about the long run — so a runner whose EASY runs
  // are the thing over budget got either silence or, worse, an explanation
  // about sessions their plan does not contain yet. Measured: a 30-minute-cap
  // runner had 60/67/74-minute Thursday easy runs in weeks 1-3 while the only
  // note that fired described hard sessions starting in week 5.
  //
  // No §81 exemption is invoked here and there are no intervals to protect —
  // this run is simply longer than the time the runner said they had, and the
  // honest thing is to say which day and what the lever is.
  const easyOverrunNote: string | null = easyOverrun
    ? `Your easy runs do not fit the time you have. You've capped weekdays at ${durationText(easyOverrun.cap)}, but by week ${easyOverrun.n} an easy run lands at about ${durationText(easyOverrun.mins)}. It stays at that length because cutting it would leave the week too short to build on, and the long run would end up carrying too much of it. The lever is one longer weekday, or moving a run to the weekend.`
    : null

  const longRunOverrunNote: string | null = longRunOverrun
    ? `This plan is built to get you round on the time you have — your long run does not fit it. You've kept both weekend days clear of training and capped weekdays at ${durationText(longRunOverrun.cap)}, but by week ${longRunOverrun.n} the long run this race needs is about ${durationText(longRunOverrun.mins)}. It stays in the plan at full length, because a long run cut to ${durationText(longRunOverrun.cap)} stops being a long run. What it can't do is build toward the race on those terms. The lever is one longer session a week — a weekend morning, or a single weekday you can give more time to.`
    : null

  // §82 — easy-run floor protection recurring across weeks. One week is
  // arithmetic (a cap value that happens to land under MIN_SESSION_DISTANCE_KM.easy
  // for this runner's pace); recurrence means the day count doesn't fit the
  // stated weekday budget at this volume — same diagnosis as §52b, surfacing
  // late because the cap runs after §52b already chose the day count.
  const floorProtectedWeekCount = weeks.reduce((count, w) => {
    const hasFloorProtected = Object.values(w.sessions ?? {}).some(sn => sn?.floor_protected)
    return hasFloorProtected ? count + 1 : count
  }, 0)
  const easyFloorProtectionOverrun = floorProtectedWeekCount >= GENERATION_CONFIG.EASY_RUN_FLOOR_PROTECTION_MAINTENANCE_WEEKS
  const easyFloorProtectionNote: string | null = easyFloorProtectionOverrun
    // ⚠️ `max_weekday_mins` is OPTIONAL ("No limit" in the wizard), and this
    // note is gated on floor-protected WEEKS, not on the cap existing. The
    // previous template interpolated it raw, so an unset cap would have read
    // "You've capped weekdays at undefined minutes". Measured across 16,080
    // no-cap plans in both grids: 0 occurrences, so this is latent rather than
    // live — but a note whose premise may be false should not assert it.
    ? `This plan is shaped by the time you have — your easy runs don't fit it on ${floorProtectedWeekCount} of this plan's weeks.${input.max_weekday_mins != null ? ` You've capped weekdays at ${durationText(input.max_weekday_mins)}, and at that limit some` : ' Some'} easy runs would shrink to a distance too short to train anything, so they stay a few minutes over${input.max_weekday_mins != null ? ' your cap' : ' the budget those days allow'} instead. The lever is day count — fewer, fuller sessions fit your time better than more, thinner ones.`
    : null

  // ── §90 Amendment 1 — WHEN THE INJURY TRIM REMOVES EASY RUNS, QUALITY YIELDS ──
  //
  // Coaching Board S1-INJURY-DENOMINATOR-01, 2026-09-15. CORRECT WITH AMENDMENT.
  //
  // §90's levers trim easy volume to hold §2's delivered injury cap on injured
  // tissue, and §90 says so in its own words: "easy runs trim/DROP to the
  // ceiling; the long run never does." Trim far enough and §52b day-fitting
  // removes a whole day — and the day it removes is always an EASY one, because
  // §52 protects the long run and §8 protects the quality slot.
  //
  // §1 counts SESSIONS (CD-19). So the injured runner's denominator falls while
  // the quality count holds, and the ratio climbs through the ceiling on a plan
  // where nothing chose to add intensity. MEASURED — same runner, one field:
  //
  //     injury_history []        46 running / 8 quality = 17.4%   clean
  //     injury_history ['knee']  39 running / 8 quality = 20.5%   breach (18%)
  //
  // Willy: we are removing the thing that heals and keeping the thing that
  // provokes. Seiler: under load the engine converts a polarised plan into a
  // threshold plan, which is the failure this product exists to prevent.
  //
  // THIS IS NOT A NEW PRINCIPLE. §90 already ruled "§8 yields to §2's injury cap when the
  // tissue is the binding constraint" — scoped to peak weeks and the second
  // quality session only because that was the case in front of the board. The
  // reasoning was never peak-specific; this releases it.
  //
  // ⚠️ CONVERT, NEVER REMOVE. Deleting the session does not even fix the
  // arithmetic — it takes the denominator down with the numerator:
  //     delete  → 38 running / 7 quality = 18.4%   STILL BREACHING
  //     convert → 39 running / 7 quality = 17.9%   compliant
  // The deletion is the obvious implementation and it is wrong. Board amendment 1.
  //
  // ⚠️ One at a time, LATEST FIRST — §98's walk, applied to a different lever.
  // Latest-first because the early quality exposures are the ones §79's re-entry
  // window already vetted for a returning/injured runner; the late ones are the
  // sharpening a finish-goal runner needs least. Board amendment 2.
  //
  // ⚠️ RUNS AFTER `finalVolumeProfile`, deliberately. The invariant EXEMPTS a
  // maintenance plan, so a yield that fired before the profile was known would
  // be trimming intensity from plans nothing was checking. Moved here from
  // before the §27 pass once parity showed the scale of it.
  // ⚠️ THE `maintenance` GATE WAS REMOVED HERE (COMPLIANCE-FIX-3, Coaching Board
  // 2026-09-16). It read `&& finalVolumeProfile !== 'maintenance'`, which
  // disabled §1's only producer-side remedy on exactly the plans most likely to
  // need it.
  //
  // MEASURED, 15,973-plan sweep: 7,057 plans (44.2%) are `maintenance`. Of those,
  // 2,648 (16.6%) carry ZERO quality — CD-21's real case, still correctly exempt
  // from §1's invariant — and 841 (5.3%) BREACH their §1 ceiling by a median of
  // +5.0pp, p90 +10.0pp, worst +16.7pp. On a marathon that worst case is a 34.7%
  // quality share, on an injured runner, with the check exempted AND the remedy
  // gated off by the same label.
  //
  // CD-21's exemption is justified in its own words as "§1 is undefined over an
  // all-easy block — no intensity to distribute". That is true of the 2,648 and
  // FALSE of all 841: a plan breaching a quality SHARE has quality sessions by
  // construction. The rule the board drew: a carve-out granted because a quantity
  // is UNDEFINED may not be applied where the quantity is defined and out of
  // range.
  if (GENERATION_CONFIG.INJURY_QUALITY_YIELD_TO_INTENSITY_CEILING
      && hasVolumeCappedInjury(input)) {
    const yieldDistKey = raceDistanceKey(input.race_distance_km)
    const ceilingPct = GENERATION_CONFIG.INTENSITY_DISTRIBUTION[yieldDistKey]?.max_quality_session_pct
    if (ceilingPct != null) {
      // Same denominator INV-PLAN-INTENSITY-DISTRIBUTION uses, or the fix would
      // be measured against a different population than the check (the
      // denominator lesson, one more time).
      const countable = (w: Week) => w.n >= 1
      const runningOf = (w: Week) => (Object.values(w.sessions).filter(Boolean) as Session[])
        .filter(sn => sn.type !== 'rest' && sn.type !== 'race'
          && sn.type !== 'strength' && sn.type !== 'cross-train')
      const isQual = (sn: Session) => sn.type === 'quality' || sn.type === 'intervals'
        || sn.type === 'tempo' || sn.type === 'hard'
      const share = () => {
        const runs = weeks.filter(countable).flatMap(runningOf)
        return runs.length === 0 ? 0 : (runs.filter(isQual).length / runs.length) * 100
      }
      // Latest-first list of convertible quality sessions. The race week's own
      // sharpening is excluded: §26 owns race week, and taking its sharpener is
      // a different decision the board has not made.
      const raceWeekN = Math.max(0, ...weeks.map(w => w.n))
      const candidates: { w: Week; d: Day; sn: Session }[] = []
      for (const w of weeks.filter(countable)) {
        if (w.n === raceWeekN) continue
        for (const [d, sn] of Object.entries(w.sessions) as [Day, Session | undefined][]) {
          if (sn && isQual(sn)) candidates.push({ w, d, sn })
        }
      }
      candidates.sort((a, b) => b.w.n - a.w.n)

      let yielded = 0
      const yieldedWeeks: number[] = []
      for (const c of candidates) {
        if (share() <= ceilingPct) break
        // CONVERT. Distance and day are preserved — the runner's week keeps its
        // shape and its volume; only the stimulus changes. Keeping the distance
        // also keeps the denominator, which is the whole point.
        // `easySession` is the single owner of an easy run's shape — same
        // builder the week loop uses, so the converted session carries the same
        // zone, HR band, pace string and rounding as every other easy run
        // (D-08). Distance and day are preserved: the runner's week keeps its
        // shape and its volume, only the stimulus changes. Keeping the distance
        // also keeps the denominator, which is the whole point.
        // PRESERVE THE RUNNER'S EVENING, NOT THE KILOMETRES.
        //
        // The board's amendment said "converted at the same distance", to keep
        // §1's denominator. Measured: that is the wrong quantity to hold, and it
        // breaks a different rule. §1 counts SESSIONS, so distance cannot move
        // the ratio at all — while an easy run is SLOWER than the quality it
        // replaces, so the same distance is a LONGER session and the converted
        // run overran `max_weekday_mins` (1 sweep case, INV-PLAN-MAX-WEEKDAY-MINS).
        //
        // Holding the DURATION keeps the denominator just as well, keeps the
        // runner's Tuesday the length they budgeted for, and lowers the load,
        // which is the direction §12 wanted. Board's intent honoured; the
        // quantity it named was not the one carrying the intent.
        const targetMins = c.sn.duration_mins
          ?? (c.sn.distance_km != null && pace.minPerKmEasy > 0
              ? c.sn.distance_km * pace.minPerKmEasy : null)
        const rawKm = targetMins != null && pace.minPerKmEasy > 0
          ? targetMins / pace.minPerKmEasy
          : c.sn.distance_km ?? null
        if (rawKm == null) continue   // nothing to size an easy run from; leave it alone

        // §9 — THE LONG RUN STAYS THE LONGEST, BY A RATIO, NOT BY A NOSE.
        //
        // Measured twice, and the first fix was not enough. A quality session is
        // floored at MIN_SESSION_DISTANCE_KM.quality, which on a 14 km taper week
        // is LARGER than that week's long run; converting it at its own distance
        // made an "easy run" the longest run of the week. Clamping it just under
        // the long run then failed a SECOND rule in the same invariant: §9 wants
        // the long run at LONG_RUN_MIN_RATIO_VS_EASY (1.25x) of the longest easy,
        // and 5 km vs 4.5 km is 1.11x. Read the ratio from config, never a
        // hand-picked gap.
        //
        // The week loses the difference, and that is the right direction: §1
        // counts SESSIONS, so a smaller easy run costs the ratio nothing, and
        // less volume on an injury-capped week is what §2's injury cap wanted anyway.
        const longKmOfWeek = Math.max(0, ...(Object.values(c.w.sessions).filter(Boolean) as Session[])
          .filter(sn => isLongRun(sn))
          // `sessionKmOrZero` is the same resolver `sumWeeklyKm` uses two lines
          // down, so the clamp and the week total can never disagree about how
          // far a duration-anchored long run is (SESSION-KM-01).
          .map(sn => sessionKmOrZero(sn, pace.minPerKmEasy)))
        const prec = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
        const easyCeilingKm = longKmOfWeek > 0
          ? Math.floor((longKmOfWeek / GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY) / prec) * prec
          : Infinity
        const km = Math.min(rawKm, easyCeilingKm)
        if (km < sessionFloorsFor(input.longest_recent_run_km).easy) continue   // no room to convert into

        c.w.sessions[c.d] = easySession(
          c.w.n, c.d, km, c.sn.primary_metric ?? 'distance', zones, pace,
          'Easy run — Zone 2', 4,
          ['Easy today. Your injury history caps how fast this week can climb, and that cap has '
           + 'already taken volume out of it. A hard session on top of a shorter week concentrates '
           + 'the stress on tissue that is still rebuilding, and the easy running is what builds '
           + 'its tolerance.'],
        )

        // §102 — AN INTENTIONAL DOWNGRADE IS NOT A MISSING SESSION.
        //
        // `INV-PLAN-QUALITY-EXPECTED` requires a quality session in a build or
        // peak week for an intermediate runner, and exempts a week that RECORDS
        // why it no longer has one. §102: "the exemption must be earned; it keys
        // on a recorded reason, not on the absence itself." This is a recorded
        // reason, so it earns it — and reusing the field rather than inventing a
        // second absence-marker is D-16.
        //
        // ⚠️ The field's contract said "Set by the reshaper; NEVER by
        // generateRulePlan." That was a true scope statement when the generator
        // had no deliberate-downgrade path; it now has one, and the contract is
        // amended in `types/plan.ts` in this commit rather than quietly violated.
        c.w.quality_downgraded = {
          trigger: 'injury_intensity_ceiling',
          // THE WEEK'S OWN DATE, NEVER `new Date()`.
          //
          // Caught by `verify:parity` the day after this shipped: a wall-clock
          // stamp inside a WEEK makes the generated plan non-deterministic, so
          // the same inputs hash differently on every run. `meta.generated_at`
          // is wall-clock too, which is exactly why the parity harness strips
          // it — but `quality_downgraded.at` is nested in a week and no stripper
          // reaches it. Six plans reported as "changed" against a commit that
          // contained no engine change at all.
          //
          // The field is written in two places and READ IN NONE (the §102
          // exemption only tests `!!w.quality_downgraded`), so nothing is lost
          // by making it deterministic. The reshaper's own writer takes `nowIso`
          // as a PARAMETER for the same reason; this path had no caller to take
          // it from and reached for the clock instead.
          at: c.w.date,
        }

        // §28 — THE WEEK MAY HAVE JUST GAINED ITS ONLY STRIDE-ELIGIBLE DAY.
        //
        // The stride pass runs inside `buildWeekSessions`, long before this one.
        // On a 2-day week whose only non-long session was the quality, §28
        // correctly placed no strides (nothing to append to) — and converting
        // that session to easy makes the week eligible after the pass that would
        // have served it has already run. 274 sweep violations, all of them this
        // ordering. Append here rather than re-running the whole pass: the day is
        // already chosen, and §28's placement rules cannot object to a day that
        // no longer holds a quality session.
        {
          const weekHasStrides = (Object.values(c.w.sessions).filter(Boolean) as Session[])
            .some(sn => (sn.coach_notes ?? []).some(n => !!n && /strides/i.test(n)))
          const converted = c.w.sessions[c.d]!
          if (!weekHasStrides && c.w.n >= GENERATION_CONFIG.STRIDES_FIRST_WEEK
              && c.w.type !== 'deload' && c.w.n !== raceWeekN
              && !isLongRun(converted) && !isShakeout(converted)) {
            // `coach_notes` is a BOUNDED tuple ([string, string?, string?]), not
            // an array — mirror §28's own append rather than spreading into it.
            const note = '4×20s strides at 5K effort, full recovery between.'
            const e0 = converted.coach_notes?.[0]
            const e1 = converted.coach_notes?.[1]
            converted.coach_notes = e0 && e1 ? [e0, e1, note] : e0 ? [e0, note] : [note]
          }
        }

        // §27 — THE WEEK'S COPY MUST NOT PROMISE WHAT IT NO LONGER CONTAINS.
        // The existing theme realigner below only walks PEAK weeks; the yield
        // can land on a build or taper week, and `INV-PLAN-COPY-MATCHES-SESSIONS`
        // reads label AND theme for intensity claims. Rewritten here rather than
        // by widening that pass, which would change copy on healthy plans too.
        // SHARED PREDICATE, not a local regex. This used to carry its own copy
        // of the patterns and it had drifted from the checker's: it omitted
        // `feels? hard`, so a peak week themed "This is where the fitness is
        // built. It will feel hard." kept the promise after its last quality
        // session was converted away. 84 plans on the sweep.
        if (copyClaimsIntensity(c.w.label, c.w.theme)) {
          c.w.label = 'Easy week'
          c.w.theme = 'All easy this week. Your injury cap has already taken volume out, '
            + 'so the hard session comes out too rather than landing on a shorter week.'
        }

        // "Life-first, plan-second" — `applyWeekdayMinsCap` runs inside
        // `buildWeekSessions`, before this pass, so the converted session was
        // never offered to it. Calling the SAME helper rather than re-deriving
        // the cap: `day_budgets` overrides `max_weekday_mins` per weekday, and a
        // second reading of that precedence is exactly the parallel semantics
        // D-16 forbids. One sweep case proved the need.
        applyWeekdayMinsCap(c.w.sessions, input, c.w.n === raceWeekN)

        yieldedWeeks.push(c.w.n)
        yielded++
      }
      if (yielded > 0) {
        // The clamp above can shrink a week; the week must state what it now
        // contains (INV-PLAN-WEEKLY-KM consistency, and §90's own "the runner
        // sees sumWeeklyKm, not the curve").
        for (const w of weeks) {
          if (yieldedWeeks.includes(w.n)) w.weekly_km = sumWeeklyKm(w.sessions, pace)
        }
        ruleAdjustments.push({
          rule: '§90 Amendment 1 — injury trim yields quality to §1',
          violation: `§2's injury cap removed enough easy running that the plan's quality `
            + `share passed §1's ${ceilingPct}% ${yieldDistKey} ceiling without any intensity being added.`,
          resolution: `${yielded} quality session(s) converted to easy at the same distance, `
            + `latest first, bringing the plan to ${share().toFixed(1)}%.`,
          weeks_affected: yieldedWeeks.slice().sort((a, b) => a - b),
        })
      }
    }
  }
  // ── LOPSIDED-ORDER-01 (2026-09-20) — WHY §52's DETECTION LIVES DOWN HERE ────
  //
  // This block, and `finalVolumeProfile` with it, used to sit ~450 lines above,
  // before §90 Amendment 1's injury-quality yield pass. That pass calls
  // `applyWeekdayMinsCap` on the weeks it touches and then RECOMPUTES
  // `w.weekly_km` from the surviving sessions. It trims easy runs; it never
  // trims the long run. So a week that read fine when §52 looked at it could
  // cross the 60% cap afterwards, with the producer already committed to
  // "not lopsided" and the invariant firing on the shrunken week.
  //
  // MEASURED on the 14,253-plan property sweep: three ERROR-severity
  // `INV-PLAN-LR-MAX-WEEKLY-PCT` violations, all three a Sunday long run at
  // 61-62% of a week the yield pass had shortened (21.0km/34km twice, 19.0km/
  // 31km once). Distance-anchored on both sides, so this is an ORDERING defect
  // and not the self-paced-vs-real-pace divergence between producer and checker.
  //
  // ⚠️ THE ORDERING CONSTRAINT THAT PUT IT ABOVE IS VESTIGIAL. The comment on
  // the yield pass still says it "RUNS AFTER `finalVolumeProfile`, deliberately"
  // because the invariant exempts maintenance — but COMPLIANCE-FIX-3 (Coaching
  // Board 2026-09-16) DELETED that `&& finalVolumeProfile !== 'maintenance'`
  // gate, and nothing between the two sites reads the variable any more. The
  // reason outlived the code it was protecting, which is why this read as a
  // circular dependency on inspection and was not one.
  //
  // This is a DEFECT FIX restoring documented intent — §52 already names
  // "downgrade to maintenance" as the remedy and the engine simply looked too
  // early — so it is exempt from a Coaching Board sitting (ADR-017 exemption
  // path). It is not exempt from measurement: see the cohort:shape delta in the
  // commit, because reclassifying plans is exactly what that harness watches.

  // §52 (2026-09-02) — LOPSIDED-WEEK maintenance trigger. §52 itself names the
  // three remedies for a week whose long run exceeds LONG_RUN_MAX_PCT_OF_WEEKLY:
  // "reduce the long run, raise weekly volume, or downgrade to maintenance". The
  // engine did none of them — it built the lopsided week and let the invariant
  // fire, which reports the runner's plan as defective for a constraint the
  // engine chose.
  //
  // It happens when the long run is race-anchored (§45/§47 floors) while the week
  // is runner-anchored (§2 ramp off current volume). At very low volume those two
  // anchors diverge until the week is lopsided BY CONSTRUCTION: a 5 km/week runner
  // building to a half marathon reaches a 14.5 km long run against a 24 km week —
  // 60.4%. Nothing is drifting; the plan is simply more race than the runner's
  // base can carry, which is exactly what `maintenance` exists to say.
  //
  // Reducing the long run instead would collide with §45/§47's floors, so of §52's
  // three remedies this is the one that does not need a new doctrine ruling — and
  // maintenance is already exempt from this cap, so the plan stops being reported
  // as defective and starts being described honestly.
  const lrCapPct = GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_WEEKLY / 100
  const lopsidedWeek = weeks.find(w => {
    if (w.type === 'race' || w.type === 'deload' || w.badge === 'deload') return false
    if (!w.weekly_km || w.weekly_km <= 0) return false
    let longest = 0
    for (const sn of Object.values(w.sessions)) {
      if (!sn || sn.type === 'strength' || sn.type === 'rest') continue
      const km = sessionKmOrZero(sn, pace.minPerKmEasy)
      if (km > longest) longest = km
    }
    return longest / w.weekly_km > lrCapPct
  })
  // SLT 2026-09-17 — 123 words, the longest note the engine emitted, on 37 plans
  // in a 563-plan sample. It made the same point four times: the long run is big
  // relative to the week, the race sets it, your volume sets the rest, and the
  // lever is volume. Now: the consequence, the cause, the lever. The 60% figure
  // went with it — it is our threshold, not a number the runner can act on.
  const lopsidedNote: string | null = lopsidedWeek
    ? `This plan is built to get you round, not to chase a time. The long run this race needs is big next to the ${input.current_weekly_km}km a week you run now, so by week ${lopsidedWeek.n} it takes up most of the week on its own. You will still get fitter: starting from where you are, you could hardly not. The lever is the other days: more running across the week, not a longer long run.`
    : null

  const finalVolumeProfile: 'build' | 'maintenance' | undefined =
    (peakOverloadResult?.volume_profile === 'maintenance' || daysLowMaintenance || structuralPeakInversion || lopsidedWeek || longRunOverrun || easyFloorProtectionOverrun)
      ? 'maintenance'
      : peakOverloadResult?.volume_profile  // 'build' or undefined

  // Order matters: the more specific diagnosis wins. A structural inversion
  // explains WHY the volume will not fit, where the day-count note only says
  // the day count is low — and a runner on 5 days with 80km hits the former
  // without tripping the latter at all.
  const finalVolumeNote: string | undefined =
    structuralNote ?? peakOverloadResult?.volume_constraint_note
      ?? (daysLowMaintenance ? daysLowNote ?? undefined : undefined)
      ?? lopsidedNote
      // §81 before §82: both name a specific runner constraint, but the long
      // run overrun is the more severe shape (the plan's pivotal session
      // doesn't fit at all, vs. easy runs running a few minutes long).
      // Appending keeps existing precedence untouched.
      // easyOverrunNote sits LAST of the three §81 notes: the long run not
      // fitting is the most severe shape, then a structured session, then an
      // easy run that is simply long. It is still ahead of §82's floor note,
      // which describes a different constraint (runs too SHORT).
      ?? longRunOverrunNote ?? structuredOverrunNote ?? easyOverrunNote
      ?? easyFloorProtectionNote ?? undefined

  // §34 / §106 — WHEN THE PLAN PEAKS BELOW WHAT THE RUNNER ALREADY RUNS, SAY SO.
  //
  // §106's invariant fires on 29.6% of the sweep and, measured, 89.7% of those
  // firings are plans the constitution EXPLICITLY licenses: §12's injury cap,
  // §10/CD-6's refusal to believe a `<6mo` self-report, §23/§46's days and
  // weekday-minute constraints. Those plans are not defective. What they were is
  // SILENT: 654 of them carried no note of any kind, so a runner doing 60 km a
  // week was handed a plan peaking at 45 and told nothing.
  //
  // §34's standing obligation is that a structural residual is DECLARED, and
  // §40c's rule is that a note reporting only the loss is a disclaimer — it must
  // name the lever. So this branches on the constraint that actually binds rather
  // than emitting one generic line.
  //
  // Deliberately NOT emitted when `volume_constraint_note` or the maintenance
  // label already covers it: two notes describing the same shortfall is worse
  // than one (§23's note wins, more specific).
  const peakShortfall: { note: string; targetOnly: boolean } | null = (() => {
    const stated = input.current_weekly_km
    if (!stated || stated <= 0) return null
    if (finalVolumeNote || finalVolumeProfile === 'maintenance') return null
    const training = weeks.filter(w =>
      w.n >= 1 && w.type !== 'deload' && w.badge !== 'deload' && w.type !== 'race'
      && !Object.values(w.sessions ?? {}).some(sn => sn?.type === 'race'))
    if (!training.length) return null
    const deliveredPeak = Math.max(...training.map(w => w.weekly_km ?? 0))

    // TWO DIFFERENT SHORTFALLS, and this note only ever covered the first.
    //
    //  1. §106 — the plan peaks BELOW WHAT THE RUNNER ALREADY RUNS.
    //  2. §40c — the plan peaks far below ITS OWN TARGET, because that target
    //     was never reachable from this runner's start over this runway.
    //
    // (2) went undeclared. Measured on the sweep: 3 plans carried a peak below
    // 75% of `peak_km_target` with NO note of any kind — 5K time goals off a
    // 5-12 km week, where `peak_km_target` is 28 and a 10%/week ramp from 5 km
    // over 11 weeks tops out near 13. The target was unreachable on day one.
    //
    // Why the existing declarations all missed it: `volume_shortfall_note`
    // measures delivered against the internal volume CURVE, and the curve is
    // itself ramp-limited, so it reports NO shortfall — the gap is between the
    // curve and the target, which nothing was comparing. §40c's obligation ("a
    // suppressed target is stated, never absorbed silently") applies to both.
    //
    // Reuses VOLUME_SHORTFALL_NOTE_THRESHOLD_PCT rather than adding a second
    // number: "how large must a suppressed target be before we say so" is one
    // question, already answered by §40c, and a parallel constant would be free
    // to drift from it.
    const belowStart = deliveredPeak + 0.5 < stated
    const targetGapPct = peakKm > 0 ? ((peakKm - deliveredPeak) / peakKm) * 100 : 0
    // TIME GOALS ONLY, and the restriction is §40c's own logic rather than a
    // convenience. §40c declares a SUPPRESSED TARGET. A runner who asked only to
    // finish was never promised a volume, so nothing is being suppressed and
    // there is nothing to own up to.
    //
    // It is also load-bearing: without the gate this fired on two golden FINISH
    // plans and DEMOTED their `load_residual_note` (which yields to this one as
    // the more specific), replacing a real "week 9 rises 38%, be careful with
    // it" safety warning with a volume-target observation those runners did not
    // need. A note that displaces a better note is a regression, not a fix.
    const belowTarget = input.goal === 'time_target'
      && targetGapPct >= GENERATION_CONFIG.VOLUME_SHORTFALL_NOTE_THRESHOLD_PCT
    if (deliveredPeak <= 0 || (!belowStart && !belowTarget)) return null

    const injuryCapped = hasVolumeCappedInjury(input)
    const overClaim = input.training_age === '<6mo'
    const lowDays = input.days_available <= 3
    const cap = input.max_weekday_mins

    // The unreachable-target case names a DIFFERENT lever from the others, so it
    // branches first when the runner is not also below their own current volume.
    // Naming the weekday cap here would be naming the wrong lever (§40c): the
    // cap is not what stopped this plan, the runway and the starting base are.
    const trainingWeeks = training.length
    const why = (!belowStart && belowTarget)
      ? `Getting there needs more weekly volume than ${trainingWeeks} weeks can safely build from ${Math.round(stated)}km, so the plan builds as far as it safely can and stops there.`
      : injuryCapped
      ? 'Your injury history caps how fast weekly volume is allowed to rise, and over this many weeks that cap cannot climb back to where you are.'
      : overClaim
        ? 'With under six months of running behind you, we size the opening weeks on what the plan can verify rather than the figure entered, then build from there.'
        : lowDays
          ? `On ${input.days_available} running days there is nowhere to put the difference without one run carrying too much of the week.`
          : cap != null
            ? `A weekday ceiling of ${durationText(cap)} limits what the midweek runs can carry, and the long run cannot absorb the rest on its own.`
            : 'Your starting volume and the time available cap how far this plan can build.'

    const lever = (!belowStart && belowTarget)
      ? 'The levers are time and starting volume, not effort. More weeks before race day, or a higher base to build from.'
      : injuryCapped
      ? 'That is the cap doing its job. The lever is time, not effort.'
      : overClaim
        ? 'Log a few weeks at your real volume and a regenerated plan will start from it.'
        : lowDays
          ? 'The lever is days: one more running day lifts the ceiling more than any change to the sessions.'
          : 'The lever is one longer weekday, or an extra running day.'

    const opening = belowStart
      ? `This plan peaks at ${Math.round(deliveredPeak)}km a week, below the ${Math.round(stated)}km you told us you are running now.`
      : `This plan peaks at ${Math.round(deliveredPeak)}km a week, short of the ${Math.round(peakKm)}km a goal like this usually wants.`
    return { note: `${opening} ${why} ${lever}`, targetOnly: !belowStart }
  })()

  // §106's shortfall and §40c's are DIFFERENT FACTS, and only one of them makes
  // the load residual redundant.
  //
  // `loadResidualNote` yields to this note as "more specific". That is right for
  // the §106 case — "your plan peaks below where you already are" and "a week
  // ramps faster than the cap" are two readings of one struggling plan. It is
  // WRONG for the §40c case: "your goal wants more volume than this runway can
  // build" says nothing about week 9 rising 38%, and letting it silence that
  // swaps a safety warning for an expectation-setting one.
  //
  // Measured: unhandled, this demoted `load_residual_note` on 542 parity cases.
  // Sessions were byte-identical on both sides (structure hash unchanged) — the
  // whole delta was which note the runner reads, which is exactly the kind of
  // change a hash diff flags and a human has to adjudicate.
  const peakShortfallNote: string | null = peakShortfall?.note ?? null
  const peakShortfallSupersedesResidual = peakShortfall != null && !peakShortfall.targetOnly

  // §34 / ADR-022 — THE DELIVERED LOAD RESIDUAL, DECLARED.
  //
  // ADR-022 established that the load rules (§2/§3/§12) are enforced on the
  // volume CURVE while the runner runs the PLACED SESSIONS, and that the two
  // diverge upward because the §52-exempt long run is sized on its own
  // race-anchored schedule and cannot be trimmed. The residual is real, ruled
  // honest, and tracked by three `warn` invariants — INV-PLAN-INJURY-CAP-DELIVERED,
  // INV-PLAN-DELIVERED-RAMP and INV-PLAN-BOUNCEBACK-BOUNDED.
  //
  // What it was NOT was declared. Measured: 244 + 225 + 138 plans carry one of
  // those residuals and tell the runner nothing, which is the §34 obligation
  // unmet — the same gap the peak-shortfall note above closes for §106.
  //
  // DELIBERATELY BROADER AND SIMPLER THAN THE INVARIANTS. The checkers carry
  // careful exclusions (deloads, taper, bounceback, the trimable-portion test).
  // Reproducing those here would be a second copy of three predicates, drifting
  // (the fault this file has paid for repeatedly). Instead this asks the blunt
  // question — did ANY training week rise faster than the applicable cap — so it
  // OVER-declares rather than under-declares. Declaring a residual that the
  // checker forgives is harmless; staying silent on one it catches is the defect.
  const loadResidualNote: string | null = (() => {
    if (finalVolumeNote || peakShortfallSupersedesResidual) return null   // more specific wins
    const capPct = hasVolumeCappedInjury(input)
      ? GENERATION_CONFIG.INJURY_WEEKLY_INCREASE_CAP_PCT
      : GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT
    const training = weeks.filter(w =>
      w.n >= 1 && w.phase !== 'taper' && w.type !== 'race'
      && !Object.values(w.sessions ?? {}).some(sn => sn?.type === 'race'))
    let worstPct = 0, worstWeek = 0
    for (let i = 1; i < training.length; i++) {
      const prev = training[i - 1].weekly_km ?? 0
      const cur = training[i].weekly_km ?? 0
      if (prev <= 0 || cur <= prev) continue
      const rise = (cur - prev) / prev * 100
      if (rise > worstPct) { worstPct = rise; worstWeek = training[i].n }
    }
    if (worstWeek === 0 || worstPct <= capPct) return null
    const who = hasVolumeCappedInjury(input)
      ? `Your injury history sets a ${capPct}% weekly ceiling`
      : `We hold weekly volume to about ${capPct}% growth`
    return `${who}, and week ${worstWeek} rises about ${Math.round(worstPct)}%. `
      + 'The long run is set by your race distance and cannot be cut to make the arithmetic work, '
      + `so that week lands heavier than the rule wants. Treat week ${worstWeek} as the one to be careful with: `
      + 'hold the easy days genuinely easy, and move the long run rather than shorten it if the week is not going well.'
  })()



  // CoachingPrinciples §31 — persona-aware compression classification. Computed
  // here (not inline in meta) so the difficulty band below reads the SAME value,
  // keeping the two consistent by construction.
  const compressionClassification: 'optimal' | 'appropriate_for_persona' | 'constrained_by_inputs' =
    (!compressed && !capCompressed) ? 'optimal'
    // Beginner with a finish goal doesn't need more volume — race-day success is
    // reaching the start line healthy. Compression here is appropriate, not a bind.
    : (fitness === 'beginner' && input.goal === 'finish') ? 'appropriate_for_persona'
    : 'constrained_by_inputs'

  // CoachingPrinciples §44 (amended) + §31 — ordinal difficulty band. A
  // *pre-generation feasibility* read of the runner's chosen timeline, derived
  // ONLY from prep-time margin + compression_classification (SLT boundary,
  // 2026-08-18: never from plan-quality signals — that is the PAID confidence
  // score's job). Ordinal, never a percentage (Coaching Board veto). Block-status
  // inputs throw before reaching here, so the refusal tier is never surfaced.
  //
  // Ordered so both difficulty invariants hold by construction:
  //   prep warned                        → very_demanding  (never fronts a warned plan)
  //   constrained_by_inputs              → demanding       (never reads 'comfortable')
  //   time goal on a tight-but-ok clock  → demanding
  //   otherwise                          → comfortable
  const prepMargin = prepTime.weeks_available - prepTime.weeks_required_ok

  // SC-06 / CD-16 — the pace inversion. Goal pace comes from the runner's stated
  // target; interval pace from their measured benchmark. When the target is
  // ambitious enough, goal pace OVERTAKES interval pace, and the plan prescribes
  // its "VO2max" sessions slower than its "race pace" sessions while giving them
  // a heart-rate band 28 beats wider at the top. A runner following pace and a
  // runner following heart rate then run two different plans. This is not rare —
  // any sufficiently ambitious target produces it — and nothing caught it,
  // because every existing invariant validates one session in isolation.
  //
  // Stays inside the §44 band's SLT boundary (2026-08-18: the band reads
  // *pre-generation feasibility*, never plan quality — that is the PAID
  // confidence score's job). This is derived from two INPUTS, target time and
  // benchmark, before any session exists. It is the same class of statement as
  // prep-time margin: your chosen goal is a real ask.
  const goalPaceMins = goalPace ? paceStrToMins(goalPace) : null
  const goalBeyondMeasuredFitness = goalPaceMins != null
    && goalPaceMins < pace.minPerKmInterval * (1 - GENERATION_CONFIG.INTENSITY_ORDERING_TOLERANCE_PCT / 100)

  /**
   * §44 Amendment (Coaching Board 2026-09-19, DIFFICULTY-SHORTFALL-01) — A PLAN
   * THAT TELLS THE RUNNER IT DOES NOT REACH ITS TARGET MAY NOT READ
   * 'COMFORTABLE'.
   *
   * §44 defines the bottom rung itself: "`comfortable` — adequate timeline,
   * plan REACHES ITS TARGET (or is `appropriate_for_persona`)". Measured on
   * 4,536 plans, 751 read `comfortable` while carrying a note saying the plan
   * falls short — 26% of all comfortable plans. The escape clause does not
   * cover them: 721 of the 751 were classified `optimal`, only 30 were
   * `appropriate_for_persona`. The runner met both statements on one screen.
   *
   * ⚠️ THIS IS NOT THE BAND READING THE TRAINING LOAD, WHICH THE BOARD VETOED.
   * §44 point 3 (Willy's own constraint) holds: the band is derived only from
   * PRE-GENERATION feasibility, never from plan-quality signals. It does not
   * read `duration_mins`, ramp rate or age, and the proposal that it should was
   * ruled INCORRECT in the same sitting. A shortfall FLAG is a statement about
   * whether the plan met the target it was given — the same class of fact as
   * prep-time margin, which the band already reads.
   */
  const declaresShortfall = !!(finishGoalLrShortfallNote || peakShortfallNote || volumeShortfallNote)

  const difficultyBand: 'comfortable' | 'demanding' | 'very_demanding' =
    prepTime.status === 'warn' ? 'very_demanding'
    : compressionClassification === 'constrained_by_inputs' ? 'demanding'
    : goalBeyondMeasuredFitness ? 'demanding'
    : (input.goal === 'time_target' && prepMargin < GENERATION_CONFIG.DIFFICULTY_COMFORTABLE_MARGIN_WEEKS) ? 'demanding'
    // Placed LAST deliberately: a plan already demanding for a louder reason
    // keeps that reason's note. This arm only ever moves a plan that would
    // otherwise have read 'comfortable', which is the 751 and nothing else.
    : declaresShortfall ? 'demanding'
    : 'comfortable'

  // One-line honest "why" for the demanding tiers only (mirrors
  // volume_constraint_note). 'comfortable' needs no explanation. Voice: honest,
  // dry, names the constraint and the lever — never motivational, never a verdict
  // on the runner (§44 amendment: the demand is on the timeline, not the athlete).
  const difficultyNote: string | undefined =
    difficultyBand === 'comfortable' ? undefined
    : prepTime.status === 'warn'
      ? `Very demanding on ${prepTime.weeks_available} weeks — below the ${prepTime.weeks_required_ok}-week mark for this race. It can be run; the timeline is the constraint, not your effort.`
    : compressionClassification === 'constrained_by_inputs'
      ? `Demanding — your inputs (days available, weekday time, or starting volume) cap how far the plan can build. Freeing one of those lifts the ceiling.`
    : goalBeyondMeasuredFitness
      // §44 voice: the demand is on the target, not the athlete. Says the thing
      // the runner would otherwise discover mid-plan — that their race-pace
      // sessions feel harder than their interval sessions — and why.
      ? `Demanding — the pace you're targeting is quicker than your benchmark currently supports, so race-pace sessions will bite harder than the interval work. That gap is the plan's job.`
    : (input.goal === 'time_target' && prepMargin < GENERATION_CONFIG.DIFFICULTY_COMFORTABLE_MARGIN_WEEKS)
      ? `Demanding on ${prepTime.weeks_available} weeks — a tight but workable timeline for the time you're chasing. Hold the easy days and it stays honest.`
    // §44 Amendment (DIFFICULTY-SHORTFALL-01) — the only remaining cause. The
    // shortfall note itself names WHICH part and why, so this does not repeat it.
      : `Demanding — this plan does not fully reach what this distance usually asks for. The shortfall note says which part, and what would lift it.`

  // §18 Amendment (FREQ-SILENCE-01, 2026-09-19) — WHEN VOLUME, NOT LIFE, SETS
  // THE NUMBER OF RUNNING DAYS, SAY SO.
  //
  // ⚠️ MEASURED: 18.7% of the weighted population across every distance gets
  // fewer running days than they declared, and the plan never mentions it.
  // 46% of 5K plans. A runner who told the wizard "six days" and opens a plan
  // with three has been silently overruled, and has no way to know the engine
  // did it on purpose.
  //
  // ⚠️ THE PRESCRIPTION IS CORRECT AND IS NOT CHANGING. `daysVolumeCanFill`
  // caps frequency at `weeklyKm / MIN_KM_PER_TRAINING_DAY` (5 km), floored at
  // 3, and the reasoning above it is sound: "a runner on 12 km a week who
  // selects seven days gets seven ~1.7km jogs, and no session in the week does
  // anything". Measured against the cap: this NEVER fires at 40+ km/week and
  // fires on 65% of runners under 20. It is volume, exactly as designed.
  // ⚠️ I nearly filed the cap itself as a defect after seeing a plan hold 3
  // runs from 5 km/week to 17 km/week. It is `MIN_KM_PER_TRAINING_DAY`
  // working: floor(17/5) = 3. Traced before filing.
  //
  // ⚠️ COMPUTED FROM THE FINAL WEEKS, not from the intent. Twice today a value
  // read mid-pipeline was stale by the time the runner saw it
  // (LONG-SESSION-FUEL-01, COPY-STALE-GEN-01). Frequency also GROWS within a
  // plan as volume does — measured 4→5 on a marathon, 3→5 on a half — so the
  // note quotes the real low and high rather than a single number that would
  // be wrong for most of the block.
  //
  // Coaching Board EXEMPT: no prescription change. It declares a behaviour
  // doctrine already documents, which is §40c's rule ("a suppressed target is
  // stated, never absorbed") applied to frequency instead of intensity.
  const frequencyConstraintNote: string | null = (() => {
    const declared = input.days_available
    if (!declared) return null
    const loading = weeks.filter(w => w.n > 0 && (w.phase === 'build' || w.phase === 'peak'))
    if (!loading.length) return null
    const counts = loading.map(w => Object.values(w.sessions ?? {}).filter(
      sn => sn && sn.type !== 'rest' && sn.type !== 'strength' && sn.type !== 'cross-train').length)
    const lo = Math.min(...counts), hi = Math.max(...counts)
    if (lo >= declared) return null
    const grows = hi > lo
    return `You told us you can run ${declared} days a week. This plan uses `
      + (grows ? `${lo}, building to ${hi}` : `${lo}`)
      + `, because your weekly volume spread any thinner would make every run too short to do much. `
      + (grows
          ? `The days come back as the volume grows.`
          : `More weekly volume is what adds days: until then, ${lo} honest runs beat ${declared} token ones.`)
  })()

  const meta: Plan['meta'] = {
    // F6 — empty, not invented. Every consumer already falls back gracefully
    // (`race_name || 'your race'`, `|| 'Your plan'`); a placeholder string does
    // not, because it is truthy and renders as if it were real.
    athlete:          input.athlete_name ?? '',
    handle:           '',
    race_name:        input.race_name ?? '',
    race_date:        input.race_date,
    race_distance_km: input.race_distance_km,
    charity:          '',
    plan_start:       anchoredStartIso,
    quit_date:        '',

    resting_hr:    rhr ?? 0,
    max_hr:        derivedMaxHR,
    zone2_ceiling: zones.zone2Ceiling,

    version:      '2.0',
    last_updated: today,
    notes:        `Standard plan — ${input.race_distance_km}km, ${totalWeeks} weeks`,
    primary_metric: metric,

    fitness_level:             fitness,
    // §79 (2026-09-02) — what the RUNNER selected, recorded verbatim. Distinct
    // from `fitness_level` (what the engine built volume from). Absent when the
    // wizard passed nothing. `INV-PLAN-USER-LEVEL-NO-UPWARD-TONNAGE` compares
    // the two without re-running the assessment.
    ...(declaredLevel ? { fitness_level_declared: declaredLevel } : {}),
    // §79 — the peak the volume curve was actually built from. See the field doc:
    // delivered weekly_km is not a usable proxy for this.
    peak_km_target: peakKm,
    // §53 — see qualityPool above. Omitted when the plan has no quality picks.
    ...(qualityPool.length > 0 ? { quality_pool_sizes: qualityPool } : {}),
    // §79 (2026-09-02) — stamp the intensity level whenever it DIFFERS from the
    // structural one, not only when the VDOT/volume signals disagreed. A user
    // declaration now elevates intensity on its own, and the reshape validator
    // reconstructs its input from this meta (`validateReshapedPlan` →
    // `validatePlan`, which keys the quality-per-week ceiling off the intensity
    // level). If the elevated level is missing here, a legitimate quality
    // session is validated against the structural ceiling and the plan fails
    // its own invariant on the next reshape — throwing in dev/test and logging
    // a false `reshape_invalid` in prod. Stamping unconditionally-on-difference
    // is what keeps meta self-consistent.
    ...(intensityFitness !== fitness ? { fitness_intensity_level: intensityFitness } : {}),
    // D2 — when VDOT and volume disagree, `fitness_level` is the conservative
    // (structural) answer and intensity is allowed at the higher level. Surface
    // a plain-English note, so a consumer reading `fitness_level: 'beginner'`
    // next to a quality session isn't looking at an apparent contradiction with
    // no explanation.
    ...(assessed.signalsDisagree ? {
      // §79 — the note depends on WHY the signals split. A training-age lift
      // (returning runner, no benchmark) must not claim a benchmark disagreement.
      fitness_signal_note: assessed.intensityLiftedForReturn
        ? `Your current volume reads like a beginner's, but your training history says you're not one — you're a runner coming back, not starting out. So the plan keeps the mileage cautious while it rebuilds, but gives you real quality work rather than a true beginner's easy-only plan. Hard sessions ease in over the first few weeks (your fitness returns faster than your tendons and bones do), and recovery and fuelling matter more coming back than they did at your peak.`
        : `Your race benchmark and your training volume point to different levels (${fitnessFromVdot(vdot ?? 0)} on benchmark, ${fitnessFromVolume(input.current_weekly_km, input.longest_recent_run_km)} on volume). The plan uses the more cautious of the two for how much you run, and the less cautious for how hard — building volume is where injuries come from, holding back intensity is where progress is lost.`,
    } : {}),
    // §79 (2026-08-31) — progressive intensity re-entry surfaced for honesty + the
    // INV-PLAN-RETURNING-INTENSITY-REENTRY invariant.
    ...(intensityReentryActive ? {
      intensity_reentry_active: true,
      intensity_reentry_weeks: intensityReentryWeeks,
    } : {}),
    // §89 — experience-gated quality onset surfaced for honesty + the
    // INV-PLAN-EARLY-ONSET-GATED invariant. Stamped only when it actually fired.
    ...(earlyQualityOnset ? { early_quality_onset: true } : {}),
    // §117 — stamped from the SINGLE evaluation of `runWalkApplies` above. The
    // session-stamping pass later in this file reads this flag rather than
    // re-deriving the predicate, so the two can never disagree.
    ...(isRunWalk ? { finish_goal_run_walk: true } : {}),
    // §91 — the on-ramp credit, stamped because the INVARIANT cannot otherwise
    // see it. validatePlan runs twice on different objects: once here on the
    // bare plan (no foundation weeks exist yet) and again in
    // composePlanWithFoundation on the assembled one. Counting foundation weeks
    // off `plan.weeks` would therefore give two different answers to the same
    // question. The DECISION is made once, here, so the number is recorded once,
    // here — and both validations read the same field.
    foundation_weeks_planned: foundationWeeksAhead,
    goal:                      input.goal,
    target_time:               input.target_time,
    days_available:            input.days_available,
    training_style:            input.training_style,
    hard_session_relationship: input.hard_session_relationship,
    motivation_type:           input.motivation_type,
    injury_history:            input.injury_history,
    terrain:                   input.terrain,

    generated_at:      new Date().toISOString(),
    generator_version: '2.0',

    // PV2-A / §1 — persist the full generator input so a plan can be replayed
    // byte-for-byte (regression, incident forensics). Fields like
    // current_weekly_km, longest_recent_run_km, days_cannot_train and
    // preferred_long_run_day are consumed by the engine and were otherwise
    // discarded, making a faithful re-generation impossible. Stored in the plan
    // JSON (no migration); it is the user's own input, already theirs.
    generator_input: input,

    // INV-PLAN-008: free plans never carry confidence fields
    tier,
    // D4 (2026-08-06) — `compressed` OR-combined two unrelated facts, so it was
    // true for 5 of 6 personas including a 12-week 5K plan with 24 days spare
    // and a plan classified 'build'. It also feeds the PAID confidence score
    // ("deduct 2 if compressed"), so that number was dominated by a
    // near-constant. Split into the two things it actually meant.
    time_compressed:    compressed,      // fewer calendar weeks than the distance's minimum
    volume_constrained: capCompressed,   // the ramp never reached target peak volume
    /** @deprecated Use time_compressed / volume_constrained. Retained for one
     *  release so existing readers (saved plans, the enricher prompt) keep
     *  working. */
    compressed: compressed || capCompressed,

    // CoachingPrinciples §31 — differentiated compression classification.
    // Replaces the bare boolean with persona-aware reasoning. Computed above as
    // `compressionClassification` so the difficulty band reads the same value.
    compression_classification: compressionClassification,

    // CoachingPrinciples §44 (amended) + §31 — ordinal difficulty band + honest
    // "why" note (demanding tiers only). FREE honesty signal (SLT 2026-08-18);
    // distinct from the PAID confidence score. Every generated plan carries a band
    // (INV-PLAN-DIFFICULTY-ANNOTATED); it may never under-state the plan's own
    // constraint signals (INV-PLAN-DIFFICULTY-NEVER-FRONTS-UNSAFE).
    difficulty_band: difficultyBand,
    // SC-06 — structured, so INV-PLAN-INTENSITY-ORDERING can check the plan is
    // honest about the inversion without parsing the prose note.
    ...(goalBeyondMeasuredFitness ? { goal_beyond_measured_fitness: true } : {}),
    ...(difficultyNote ? { difficulty_note: difficultyNote } : {}),

    // CoachingPrinciples §23/§38/§45/§46 (peak overload) + §52 (low-day) —
    // composed maintenance trigger. See peakOverloadResult / daysLowMaintenance
    // computation above the meta block for the full rule set.
    ...(finalVolumeProfile ? { volume_profile: finalVolumeProfile } : {}),
    ...(finalVolumeNote    ? { volume_constraint_note: finalVolumeNote } : {}),
    ...(finishGoalLrShortfallNote ? { long_run_shortfall_note: finishGoalLrShortfallNote } : {}),
    ...(peakShortfallNote ? { peak_shortfall_note: peakShortfallNote } : {}),
    ...(loadResidualNote ? { load_residual_note: loadResidualNote } : {}),
    ...(volumeShortfallNote ? { volume_shortfall_note: volumeShortfallNote } : {}),
    ...(volumeShortfallPct != null ? { volume_shortfall_pct: Math.round(volumeShortfallPct * 10) / 10 } : {}),
    ...(frequencyConstraintNote ? { frequency_constraint_note: frequencyConstraintNote } : {}),
    // §40b Amendment 2 (CB-TERRAIN-01) — runner-environment terrain governs the
    // pace-vs-effort EMPHASIS, never a fabricated pace. Off-road, effort/HR leads
    // and pace is a road reference (§40b: do not invent a number the runner cannot
    // act on). Asserted present by INV-PLAN-TERRAIN-EFFORT-NOTE-DECLARED.
    ...((GENERATION_CONFIG.TERRAIN_EFFORT_GOVERNS as readonly string[]).includes(input.terrain ?? '')
      ? { terrain_effort_note: 'Off-road, let effort and HR lead — the pace targets are a road reference, not a number to chase.' }
      : {}),
    // §79 Amendment 2 (Coaching Board 2026-09-15, REENTRY-DEPTH-01) — WHERE THE
    // RE-ENTRY WINDOW MEANS NO VO2max THIS CYCLE, SAY SO.
    //
    // Measured: of the plans where the window changes the opening stimulus, 576
    // lost VO2max from the plan ENTIRELY and 0 were merely re-ordered. The
    // window only WITHHOLDS — it carries no obligation to place VO2max
    // afterwards, and with §53's rotation the freed slots get filled by other
    // categories, so withholding becomes omission.
    //
    // The board ruled omission LEGITIMATE on §5's own authority: its CD-16/CD-22
    // amendment records Seiler verbatim — "either commit to it properly in the
    // build, or do not do it. The middle position is the only indefensible one."
    // Forcing a late VO2max block to satisfy an ordering rule is precisely that
    // indefensible middle, so requiring deferral was REJECTED.
    //
    // What is NOT legitimate is arriving there silently. §87/§95's test applies:
    // a defensible outcome reached at random is a coincidence, not a decision.
    // So the plan declares it. Rendered through the ONE note renderer
    // (`planRationaleNotes`, PLAN-NOTE-SURFACE-01), never a second path.
    ...(intensityReentryActive
      && !weeks.some(w => (w.n ?? 0) >= 1 && Object.values(w.sessions).some(
        sn => sn && sn.type === 'quality' && isVo2maxSession(sn, V1_SESSION_CATALOGUE)))
      ? { intensity_reentry_cause: reentryCause ?? undefined,
          intensity_reentry_omission_note: reentryIsUserRaisedOnly
            // §79 Amendment 3 — this runner is NOT coming back from anything;
            // they told the wizard they are further along than the data says.
            // Saying "you are coming back" to a couch-to-10K first-timer is the
            // copy equivalent of a wrong prescription, and it was live for the
            // length of one measurement before this branch existed.
            ? 'No interval or hill sessions this block. You told us you are further on than your recent running shows, so the plan takes you at your word on effort and starts with tempo and threshold. The sharp stuff earns its place once there is a base under it.'
            // §79 Amendment 5 — the runner qualified for EARLY quality onset
            // (ADR-021 §89), which requires they are NOT returning and NOT
            // fresh. Telling them they are coming back is false about the one
            // cohort the engine has certified as ready.
            : reentryCause === 'early_onset'
            ? 'No interval or hill sessions this block. Your base is solid enough that quality starts earlier than standard, so it opens with tempo and threshold and works toward the sharper sessions rather than starting there.'
            : 'No interval or hill sessions this block. You are coming back, so the quality work leads with tempo and threshold while your legs re-adapt — sharper work earns its place in the next cycle, not this one.' }
      : {}),
    // §96 / HSR-INERT-01 (brand-routed honesty, CB-HSR-01) — a `love` runner below the
    // 5yr+ tier does not get love's full structural effect (peak-LR stretch + §47
    // back-to-back exception are tissue-tolerance judgements the board ruled CORRECT).
    // Tell them the preference is noted and earned with experience, rather than silently
    // discarding it. TRIGGER IS DELIBERATELY THE SINGLE `!== '5yr+'` CONDITION, NOT the
    // full multi-branch gate at :2695/:3497 — re-deriving that gate here would be the
    // duplication this note's own review flagged. The copy is forward-looking, so it
    // stays honest for a 2-5yr HM runner who did get the recent-run stretch (they still
    // have not earned the 5yr+ exception).
    ...(input.hard_session_relationship === 'love' && input.training_age !== '5yr+'
      ? { hard_pref_note: 'You said you like hard sessions. The plan earns longer peak runs and more intensity as your training history deepens — not before your legs have proven they will take it.' }
      : {}),

    // §110 / §40c (Coaching Board 2026-09-16) — THE NOTE IS PART OF THE RULING,
    // not decoration. Before §110 this field fired for `love` ONLY, so 2,197
    // runners had every quality session removed from their plan and the plan
    // said nothing. §40c's standing rule is that a suppressed target is STATED,
    // never absorbed silently, and §40c also requires the note to NAME THE
    // LEVER — so this says which lever (one a week, started later) rather than
    // gesturing at "your preferences". Unconditional on training_age: unlike
    // the `love` note above, nothing here is forward-looking.
    // ⚠️ THE NOTE MUST DESCRIBE THE PLAN THAT WAS BUILT, NOT THE RULE THAT RAN.
    // First cut fired on `avoid` alone and told 1,615 runners "the plan keeps
    // one a week at most" while delivering ZERO quality — because the §10/§79
    // BEGINNER CEILING zeroes quality before §110's cap has anything to cap,
    // and the note never asked what actually landed. Caught by the board's cold
    // re-review of T2, not by any check.
    //
    // That is the claim/computation mismatch class, and it is worse here than
    // elsewhere: every honest-residual rule this engine has (§34, §40c) is
    // undone by a sentence that is not true. A note is a claim about the
    // artefact, so it is derived FROM the artefact.
    //
    // The preference is still acknowledged in the all-easy case rather than
    // dropped — the runner told us something and silence reads as ignoring it —
    // but the plan is attributed to the base, which is what actually shaped it.
    // §40c — A SUPPRESSED TARGET IS STATED, NEVER ABSORBED, AND THAT APPLIES
    // TO EVERY RUNNER AND NOT ONLY THE ONE WHO SAID `avoid`
    // (CB-PLAN-REVIEW-01, Coaching Board 2026-09-19).
    //
    // This branch opened on `hard_session_relationship === 'avoid'`, so a plan
    // with no quality explained itself ONLY to the runner who had asked for
    // that. Everyone else — a beginner on a finish goal, which the board ruled
    // CORRECT AS IS the same day — got an all-easy plan and **no sentence at
    // all**. Measured: **1,752 plans (17.5% of the 9,984 carrying zero
    // quality) shipped with no explanatory note of any kind.**
    //
    // McMillan brought it on the sample: a knee-history beginner got sixteen
    // weeks, no quality, and nothing saying why, while the very similar P1 and
    // P3 both explained themselves. "Silence reads as an oversight, and this
    // runner is the most likely to wonder whether the app noticed their injury
    // at all."
    //
    // The plan is not wrong — the board ruled all-easy correct for this cohort
    // — so this changes nothing the runner DOES. It changes whether they know
    // why, which is §40c's whole point and the same reasoning that put the
    // `avoid` sentence here in the first place.
    ...((() => {
      const hasQuality = weeks.some(w => w.n >= 1 && Object.values(w.sessions ?? {})
        .some(sn => sn?.type === 'quality'))
      if (input.hard_session_relationship === 'avoid') {
        return {
          hard_pref_note: hasQuality
            ? 'You said you avoid hard sessions. The plan keeps one a week at most and starts them later than usual. One is enough to prepare for the race; two is what you were trying to avoid.'
            : 'You said you avoid hard sessions. This plan has none to avoid: at your current base, easy running is what builds the most, so there was nothing to hold back.',
        }
      }
      if (!hasQuality) {
        return {
          hard_pref_note: 'This plan has no hard sessions in it. At your current base, easy running and the long run are what build the most, and the strides on your midweek run keep your legs quick. Adding intensity now would cost more than it returns.',
        }
      }
      return {}
    })()),

    // VDOT / zone model fields (CoachingPrinciples §10, §20).
    // `vdot` is raw (benchmark-derived) — what users compare against Daniels' tables.
    // `vdot_training_anchor` is the conservatism-discounted value used to derive
    // training paces. The gap is `vdot_discount_applied_pct`.
    age: input.age,
    ...(vdotRaw !== undefined ? { vdot: Math.round(vdotRaw * 10) / 10 } : {}),
    ...(vdot !== undefined ? { vdot_training_anchor: Math.round(vdot * 10) / 10 } : {}),
    ...(vdotDiscountPct > 0 ? { vdot_discount_applied_pct: vdotDiscountPct } : {}),
    ...(goalPace ? { goal_pace_per_km: goalPace } : {}),
    ...(recalibrationWeeks.length > 0 ? { recalibration_weeks: recalibrationWeeks } : {}),
    ...(input.benchmark ? { benchmark: input.benchmark } : {}),

    // R23 rebuild — returning runner + training age
    ...(input.training_age ? { training_age: input.training_age } : {}),
    ...(returningRunner ? { returning_runner_allowance_active: true } : {}),
    ...(isFreshReturn ? { fresh_return_active: true } : {}),

    // CoachingPrinciples §51 — communicate the allowance / start-fraction
    // change so the runner knows why their week-1 volume looks the way it
    // does. Mirrors volume_constraint_note pattern.
    ...((returningRunner || isFreshReturn) ? {
      returning_runner_note: isFreshReturn
        ? `Fresh-from-layoff start: week 1 begins at ${Math.round(GENERATION_CONFIG.FRESH_RETURN_START_FRACTION * 100)}% of your stated current weekly volume (${Math.round(volumes[0])} km vs ${input.current_weekly_km} km stated). Returning to running needs caution, not faster ramp — the engine prefers a small base to rebuild from. Volume grows at the standard ${GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT}% per week.`
        : `Returning-runner allowance active: weeks 1-${GENERATION_CONFIG.RETURNING_RUNNER_GRACE_WEEKS} grow at ${GENERATION_CONFIG.RETURNING_RUNNER_ALLOWANCE_PCT}% per week (vs the standard ${GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT}%). Your training history allows a faster rebuild because the aerobic and structural base is still there.`,
    } : {}),

    // CoachingPrinciples §50 — HR zone fallback hierarchy (L-03). Surface
    // which method derived the zones so the runner knows whether their data
    // was used or estimated.
    hr_zone_method: hrFallback.method,
    ...(hrFallback.assumption_note ? { hr_assumption_note: hrFallback.assumption_note } : {}),
    ...(hrFallback.estimated_max !== undefined ? { hr_estimated_max: hrFallback.estimated_max } : {}),
    // §50 asymmetry (HR-MAX-01) — the max the zones were actually built on, plus
    // its provenance. Lets INV-PLAN-MAX-HR-NOT-BELOW-ESTIMATE-FLOOR verify no
    // plan rests on a device/unattributed max below its own age estimate.
    hr_derived_max: hrFallback.derived_max,
    ...(hrFallback.max_source ? { hr_max_source: hrFallback.max_source } : {}),

    // CoachingPrinciples §44 — prep-time status surface. 'ok' or 'warned'.
    // 'block' outcomes never reach this code path (PrepTimeError thrown above).
    prep_time_status: prepTime.status === 'warn' ? 'warned' : 'ok',
    prep_time_weeks_available: prepTime.weeks_available,
    prep_time_weeks_required_ok: prepTime.weeks_required_ok,
    ...(prepTime.status === 'warn' && prepTime.message
      ? { prep_time_warning: prepTime.message }
      : {}),
    ...(prepTime.status === 'warn' && prepTime.alternatives
      ? { prep_time_alternatives: prepTime.alternatives }
      : {}),

    // CoachingPrinciples §52 (low-day) — days-availability status surface.
    // Same shape as prep-time. 'warned' means the runner acknowledged a
    // sub-recommended days/wk for a time-target plan; the engine continues
    // but the plan is downgraded to maintenance via volume_profile below.
    days_available_status: daysCheck.status === 'warn' ? 'warned' : 'ok',
    days_required_ok: daysCheck.days_required_ok,
    ...(daysCheck.status === 'warn' && daysCheck.message
      ? { days_available_warning: daysCheck.message }
      : {}),
    ...(daysCheck.status === 'warn' && daysCheck.alternatives
      ? { days_available_alternatives: daysCheck.alternatives }
      : {}),

    // V1/V2/V4/V5 audit trail — only emitted when at least one rule fired.
    ...(ruleAdjustments.length > 0 ? { rule_adjustments: ruleAdjustments } : {}),
  }

  // V6 — pre-plan buffer guidance. Attached at plan top-level (sibling to
  // weeks/phases/meta) per spec. Informational only; no session data.
  const prePlan = buildV6PrePlanGuidance(prepTime, anchoredStartIso, today)

  // §18/§81 — the weekday cap runs LAST, after every re-sizing post-pass.
  //
  // `applyWeekdayMinsCap` also runs inside buildWeekSessions, but at least eight
  // later passes re-size sessions (long-run floors §45/§47, easy redistribution
  // §9, volume scaling) and none re-applies it, so a capped session can be
  // silently re-expanded.
  //
  // HISTORY — this pass was deleted once. Do not delete it again without
  // repeating the measurement:
  //   1. Added on the ordering argument above (MWM-02).
  //   2. MEASURED A NO-OP and removed: every re-expanded session was the long
  //      run, which §81 exempts. 0 of 153,728 non-long weekday sessions exceeded
  //      the cap, and an A/B was byte-identical. A check that provably changes
  //      nothing reads as a safeguard while guarding nothing.
  //   3. RE-ADDED when §81 was extended to structured sessions: keeping a
  //      quality session at full size changes what the redistribution passes
  //      hand the easy runs, and those DO get pushed past the cap. Measured
  //      303 violations without this pass, 0 with it.
  // The lesson is not "always add a final pass" — it is that the answer changed
  // when the conditions did, and only re-measuring caught it.
  for (const w of weeks) if (w.sessions) applyWeekdayMinsCap(w.sessions, input, w.type === 'race')

  const plan: Plan = {
    meta,
    phases,
    weeks,
    ...(prePlan ? { pre_plan: prePlan } : {}),
  }

  // §117 — stamp the prescribed run-walk interval on every running session.
  //
  // ⚠️ ONE PASS HERE, NOT AT EVERY SESSION-CONSTRUCTION SITE. Sessions are
  // built in a dozen places (easy, long, deload, taper, race week, foundation
  // compose) and touching each is the D-08 shape that produced SESSION-KM-01,
  // the deload cadence in five places, and `raceDistanceKey` in three. One
  // pass over the finished plan cannot miss a site, and a site added tomorrow
  // is covered for free.
  //
  // ⚠️ PRESCRIBED, NOT PERMITTED (board amendment 3). §80 already lets a
  // finish-goal runner walk; this is what tells them how.
  if ((plan.meta as unknown as Record<string, unknown>).finish_goal_run_walk) {
    // 🔴 §117 Am.2 — ADEQUACY IS CHECKED ON THE FINISHED PLAN, AND FAILING IT
    // REFUSES RATHER THAN HANDS OVER.
    //
    // The gate in `runWalkApplies` asks whether §2's ramp arithmetic can reach
    // the peak in the runway. That is necessary and NOT sufficient: the
    // delivered peak also depends on days available, the weekday cap, §52's
    // share bound and the taper. Measured, plans slipped through at **11-12 km**
    // peak long runs against the 17 km the board ruled adequate.
    //
    // ⚠️ AN INVARIANT IS NOT ENOUGH HERE. In production `validatePlan` only
    // LOGS an error-severity violation — the runner still receives the plan.
    // So a plan that fails §117's own promise must not be produced at all; it
    // must fall back to the refusal §117 was trying to avoid. **Refusing is
    // worse for the metric and better for the runner, which is the trade the
    // board made explicitly.**
    const peakLr = plan.weeks
      .filter(w => w.n > 0 && w.type !== 'race' && w.type !== 'deload')
      .flatMap(w => Object.values(w.sessions))
      // SESSION-KM-02 — beginner plans are duration-anchored; `distance_km ?? 0`
      // reads a real long run as zero, and that error was made twice today.
      .reduce((mx, sn) => Math.max(mx, sessionKmSelfPaced(sn as Session) ?? 0), 0)

    if (peakLr > 0 && peakLr < GENERATION_CONFIG.FINISH_GOAL_RUNWALK_MIN_PEAK_LR_KM) {
      // Reuses the SAME refusal builder as §111's own throw at :5957, so the
      // runner sees one consistent message and `isDesignedRefusal` classifies
      // it identically. A second refusal shape for the same outcome is the
      // never-match-a-refusal-by-its-message trap.
      throw new BaseVolumeError(baseVolumeRefusal(assessBaseBuild(plan, input), input))
    }

    for (const w of plan.weeks) {
      for (const [day, session] of Object.entries(w.sessions)) {
        if (session) (w.sessions as Record<string, unknown>)[day] = applyRunWalk(session)
      }
    }
  }

  // Constitutional review — verify the plan honours its own coaching principles.
  // In dev, throw on errors so the matrix / property tests fail loudly.
  // In prod, log + return the plan (don't break the user). See lib/plan/invariants.ts.
  if (validate) enforceViolations(validatePlan(plan, input))

  return plan
}
