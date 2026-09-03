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
import { GENERATION_CONFIG, raceDistanceKey, type RaceDistanceKey } from './generationConfig'
import { resolveMaxHr, tanakaMaxHR } from './maxHrGuard'
import { assessFitness, fitnessFromVdot, fitnessFromVolume, FITNESS_RANK, type FitnessLevel } from './fitnessAssessment'
import { validatePlan, enforceViolations } from './invariants'
import { enforcePrepTime, enforceDaysAvailable, validateInputFields, type PrepTimeAwareInput, type PrepTimeResult, type DaysAvailableResult } from './inputs'
import { normaliseDays } from './days'
import { isLongRun, isShakeout, classifyStimulus, isStructuredSession } from './sessionRole'
import { PLAN_SIGNATURES } from './planSignatures'
import { isV2Structure, StructureV2Schema } from './sessionStructureV2'
import { durationForMainSet } from './sessionFormat'
import { resolveMainSet, type PaceAnchorMap } from './resolveMainSet'
import {
  V1_SESSION_CATALOGUE, selectCatalogueSession,
  type SessionCatalogueRow, type CatalogueCategory,
} from './sessionCatalogueData'

// ─── Internal types ───────────────────────────────────────────────────────────

type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
type PhaseType = 'base' | 'build' | 'peak' | 'taper'
// FitnessLevel + the classification helpers (assessFitness, fitnessFrom*,
// FITNESS_RANK) now live in ./fitnessAssessment (single owner shared with the
// wizard's level recommendation) and are imported at the top of this file.

interface ZoneTargets {
  zone2Ceiling: number
  easyHR: string
  shakeoutHR: string
  qualityHR: string
  intervalsHR: string
}

interface PaceGuide {
  easyPaceStr:      string   // e.g. "6:00–7:15 /km"
  qualityPaceStr:   string   // T-pace (threshold) — Z3 cruise intervals, tempo
  intervalPaceStr:  string   // I-pace (VO2max)   — Z4–Z5 hard repeats
  minPerKmEasy:     number
  minPerKmQuality:  number
  minPerKmInterval: number
  // Long run segment paces (CoachingPrinciples §24b, §24c, §24d)
  marathonPaceStr:  string | null  // ~79% VDOT; null for beginners
  hmPaceStr:        string | null  // ~84% VDOT; null for beginners
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
function buildPaceFromVDOT(discountedVdot: number, rawVdot: number): PaceGuide {
  const eFast = paceAtFraction(discountedVdot, 0.74)
  const eSlow = paceAtFraction(discountedVdot, 0.59)
  const tFast = paceAtFraction(discountedVdot, 0.88)
  const tSlow = paceAtFraction(discountedVdot, 0.83)
  const iFast = paceAtFraction(rawVdot, 1.00)  // top of interval band, raw VDOT
  const iSlow = paceAtFraction(rawVdot, 0.95)  // sustainable interval pace, raw VDOT
  // Marathon (~79% VDOT) and HM (~84% VDOT) segment paces. Both use discounted
  // VDOT (same conservatism doctrine as easy/threshold). §24b/§24c/§24d.
  const mpMins = paceAtFraction(discountedVdot, 0.79)
  const hmMins = paceAtFraction(discountedVdot, 0.84)
  const eMid  = (eFast + eSlow) / 2
  const tMid  = (tFast + tSlow) / 2
  const iMid  = (iFast + iSlow) / 2
  return {
    easyPaceStr:      `${formatPace(eFast)}–${formatPace(eSlow)} /km`,
    qualityPaceStr:   `${formatPace(tFast)}–${formatPace(tSlow)} /km`,
    intervalPaceStr:  `${formatPace(iFast)}–${formatPace(iSlow)} /km`,
    minPerKmEasy:     eMid,
    minPerKmQuality:  tMid,
    minPerKmInterval: iMid,
    marathonPaceStr:  paceBandStr(mpMins, 3),
    hmPaceStr:        paceBandStr(hmMins, 3),
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

const PACE_GUIDE: Record<FitnessLevel, Omit<PaceGuide, 'source' | 'marathonPaceStr' | 'hmPaceStr'>> = {
  beginner:     { easyPaceStr: '7:30–9:00 /km', qualityPaceStr: '6:30–7:30 /km', intervalPaceStr: '5:30–6:30 /km', minPerKmEasy: 8.0,  minPerKmQuality: 7.0,  minPerKmInterval: 6.0 },
  intermediate: { easyPaceStr: '6:30–7:30 /km', qualityPaceStr: '5:30–6:00 /km', intervalPaceStr: '4:30–5:00 /km', minPerKmEasy: 7.0,  minPerKmQuality: 5.75, minPerKmInterval: 4.75 },
  experienced:  { easyPaceStr: '5:45–6:45 /km', qualityPaceStr: '4:45–5:20 /km', intervalPaceStr: '3:50–4:20 /km', minPerKmEasy: 6.25, minPerKmQuality: 5.0,  minPerKmInterval: 4.05 },
}

function buildFallbackPace(fitness: FitnessLevel): PaceGuide {
  const base = PACE_GUIDE[fitness]
  // Marathon and HM segment paces derived from quality pace midpoint + offset.
  // Beginners: null — no pace segments prescribed. (CoachingPrinciples §24b)
  let marathonPaceStr: string | null = null
  let hmPaceStr:       string | null = null
  if (fitness === 'intermediate') {
    marathonPaceStr = paceBandStr(base.minPerKmQuality + 0.50,       3)  // +30s/km
    hmPaceStr       = paceBandStr(base.minPerKmQuality + 0.25,       3)  // +15s/km
  } else if (fitness === 'experienced') {
    marathonPaceStr = paceBandStr(base.minPerKmQuality + (25 / 60),  3)  // +25s/km
    hmPaceStr       = paceBandStr(base.minPerKmQuality + (12 / 60),  3)  // +12s/km
  }
  return { ...base, marathonPaceStr, hmPaceStr, source: 'fitness_level' }
}

// ─── Phase distribution ───────────────────────────────────────────────────────
// Taper phase weeks are anchored to TAPER_QUALITY_PER_WEEK[dist].length
// (covers full taper weeks + race week). Base/build/peak fill the remaining
// weeks proportionally to PHASE_DISTRIBUTION (35:35:15). See ADR-009.

function computePhases(totalWeeks: number, distanceKm: number): Phase[] {
  const distKey = raceDistanceKey(distanceKm)
  const taperPhaseWeeks = GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK[distKey].length
  const remaining = Math.max(0, totalWeeks - taperPhaseWeeks)

  const dist = GENERATION_CONFIG.PHASE_DISTRIBUTION
  const denom = dist.base_pct + dist.build_pct + dist.peak_pct  // = 85
  let baseWeeks  = Math.max(2, Math.round(remaining * dist.base_pct  / denom))
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
  if (overage > 0 && baseWeeks > 2) {
    const take = Math.min(overage, baseWeeks - 2)
    baseWeeks -= take
  }

  const baseEnd  = baseWeeks
  const buildEnd = baseEnd + buildWeeks
  const peakEnd  = buildEnd + peakWeeks
  const taperEnd = totalWeeks

  return [
    { name: 'base',  start_week: 1,            end_week: baseEnd  },
    { name: 'build', start_week: baseEnd + 1,  end_week: buildEnd },
    { name: 'peak',  start_week: buildEnd + 1, end_week: peakEnd  },
    { name: 'taper', start_week: peakEnd + 1,  end_week: taperEnd },
  ]
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
  // §12 — the injury weekly-increase cap, applied INSIDE the curve.
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
): VolumeSequenceResult {
  const taperPhase = phases.find(p => p.name === 'taper')!
  const distKey = raceDistanceKey(distanceKm)
  const taperConfig = GENERATION_CONFIG.TAPER_BY_DISTANCE[distKey]
  const taperPhaseWeeks = GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK[distKey].length
  const fullTaperWeeks = Math.max(1, taperPhaseWeeks - 1)  // exclude race week
  const recoveryPct = GENERATION_CONFIG.RECOVERY_WEEK_VOLUME_PCT / 100

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

    const isDeload = weekN % recoveryFreq === 0 && phase !== 'peak'
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
    const isThisDeload = weekN % recoveryFreq === 0 && phase !== 'peak'
    if (isThisDeload) continue
    if (volumes[i] <= volumes[i - 1]) continue

    // §12 tightens §2's allowance for knee / shin-splint history. Same pass, so
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
    const prevPhase = getPhaseForWeek(prevWeekN, phases)
    const prevWasDeload = prevWeekN >= 1
      && prevWeekN % recoveryFreq === 0
      && prevPhase !== 'peak'
      && prevPhase !== 'taper'
    if (prevWasDeload) {
      const preDeload = volumes[i - 2] ?? volumes[i - 1]
      maxAllowed = Math.max(maxAllowed, preDeload)
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
    zone: 'Zone 3–4', hr_target: zones.qualityHR,
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
const CONTROLLED_THRESHOLD_CUE = 'Controlled effort — if you can’t say a short sentence, you’ve drifted into the grey zone.'

// LABEL-VARIETY-01 — the display word for a goal-pace-overridden session, taken
// from the underlying row's structure so distinct rows read distinctly and the
// same row reads the same everywhere. Returns null when the shape can't be
// resolved (no row, or an unmapped structure type), letting the caller fall back
// to the phase-flavoured default. `main_set_structure` is `Record<string,
// unknown>` on the row, so it is narrowed here rather than typed at the source.
function goalPaceShapeWord(row: SessionCatalogueRow | null | undefined): string | null {
  const ms = row?.main_set_structure as
    | { version?: number; type?: string; blocks?: { label?: string }[] }
    | undefined
  if (!ms) return null
  // v2 rows (SC-08b) describe the set as blocks; the first block's label is the
  // shape (e.g. threshold_ladder → "ladder"). Fall back to "intervals" for a v2
  // set with no block label rather than leaking the phase default.
  if (ms.version === 2) {
    // v2 shape word is the first block's label (threshold_ladder → "ladder").
    // Effort-governed rows (hikes, phrase labels like "to the climb") are gated
    // out at the call site, so what reaches here is a real shape noun.
    const blockLabel = ms.blocks?.[0]?.label?.trim()
    return blockLabel ? blockLabel : null
  }
  // Words are chosen to be BOTH §19-safe and distinct from race-specific row
  // names. §19 (INV-PLAN-LABEL-MATCHES-PACE) reads "tempo"/"cruise"/"threshold"
  // as a THRESHOLD claim and demands T-pace — fatal on a goal-pace session — so
  // "sustained", not "tempo". And "reps", not "intervals", because the 10K/HM
  // race-specific rows are literally named "…-pace intervals".
  //
  // 'progression' is intentionally NOT mapped: its natural word collides with
  // the build-phase word "progression", and this word is only consumed in PEAK
  // (see the override site). Letting it fall back to the peak generic keeps a
  // build progression and a peak progression on different labels, so no label
  // merges across phases — which would surface repetition that §53 counts by
  // label, the still-open CAT-ULTRA-THIN-01.
  switch (ms.type) {
    case 'continuous':  return 'sustained'
    case 'repeats':     return 'reps'
    default:            return null
  }
}

// SC-08 vo2max — per-rep minutes of a v2 step, resolved against this runner's
// I-pace for distance reps, read directly for duration reps.
function v2StepMinutes(step: { length: { kind: string; secs?: number; m?: number } }, pace: PaceGuide): number {
  const len = step.length
  if (len.kind === 'duration' && typeof len.secs === 'number') return len.secs / 60
  if (len.kind === 'distance' && typeof len.m === 'number') return (len.m / 1000) * pace.minPerKmInterval
  return 0
}

// SC-08 vo2max (Coaching Board 2026-08-21) — the rep COUNT for a v2 VO2max row.
// The dose is a fixed band by fitness × phase (NOT weekly volume — the SC-10
// error the board refused to re-import), bounded [VO2MAX_WORK_MIN_MINS,
// VO2MAX_WORK_MAX_MINS] of WORK. Rep length is the stimulus identity and stays
// fixed; the count is the dose. Returns null for anything that is not a PACED
// vo2max rep block (effort-governed hills, non-vo2max, v1) — those keep their
// existing sizing. `mainMins` is the structure's own main-set length (work +
// recovery), used to make the session STRUCTURE-DRIVEN.
function vo2maxRepPlan(
  row: SessionCatalogueRow | null,
  fitness: FitnessLevel,
  phase: PhaseType,
  pace: PaceGuide,
): { reps: number; mainMins: number } | null {
  if (!row || row.category !== 'vo2max' || !isV2Structure(row.main_set_structure)) return null
  const parsed = StructureV2Schema.safeParse(row.main_set_structure)
  if (!parsed.success) return null
  const block = parsed.data.blocks.find(b => typeof b.repeat === 'object' && b.repeat.param === 'reps')
  if (!block) return null
  const workStep = block.steps.find(s => s.role === 'work')
  if (!workStep || workStep.target.kind !== 'pace') return null  // effort-governed → not this path
  const workMins = v2StepMinutes(workStep, pace)
  if (workMins <= 0) return null
  const recoveryMins = block.steps
    .filter(s => s.role === 'recovery')
    .reduce((sum, s) => sum + v2StepMinutes(s, pace), 0)
  const cfg = GENERATION_CONFIG
  const target = cfg.VO2MAX_WORK_TARGET_MINS[fitness]?.[phase] ?? cfg.VO2MAX_WORK_MIN_MINS
  const floorReps = Math.max(1, Math.ceil(cfg.VO2MAX_WORK_MIN_MINS / workMins))
  const ceilReps  = Math.max(floorReps, Math.floor(cfg.VO2MAX_WORK_MAX_MINS / workMins))
  const reps = Math.max(floorReps, Math.min(ceilReps, Math.round(target / workMins)))
  return { reps, mainMins: reps * (workMins + recoveryMins) }
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
    return p.variants[weekN % p.variants.length]
  })()

  // SC-08 vo2max — the scaled rep count for a v2 VO2max row (null otherwise).
  // Feeds the derived set's `reps` parameter AND makes the session
  // structure-driven (its size is the rep structure, not weekly × 18%).
  const vo2maxScaled = vo2maxRepPlan(catalogueRow, fitness, phase, pace)

  // Is this session governed by EFFORT rather than pace? True when the row's v2
  // work steps carry an effort target and no pace.
  //
  // This is the first session type where effort is the primary prescription
  // rather than a supporting note (§41). A hill rep has no pace and cannot have
  // one — the gradient decides it — so prescribing `intervalPaceStr` here
  // because the row is categorised `vo2max` would ship a number the runner
  // cannot act on and that §19 would then "verify" against a label. The
  // absence of a pace is the prescription.
  const isEffortGoverned = (() => {
    if (!catalogueRow || !isV2Structure(catalogueRow.main_set_structure)) return false
    const parsed = StructureV2Schema.safeParse(catalogueRow.main_set_structure)
    if (!parsed.success) return false
    const work = parsed.data.blocks.flatMap(b => b.steps).filter(st => st.role === 'work')
    return work.length > 0 && work.every(st => st.target.kind === 'effort')
  })()

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
      T: pace.qualityPaceStr,
      I: pace.intervalPaceStr,
      ...(pace.marathonPaceStr ? { M: pace.marathonPaceStr } : {}),
      ...(goalPace ? { goal: goalPace } : {}),
    }
    const params = { ...(variant?.values ?? {}), ...(vo2maxScaled ? { reps: vo2maxScaled.reps } : {}) }
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
  const isVo2max = catalogueRow?.category === 'vo2max'
  // Catalogue rows can request goal-pace prescription via pace_target: 'goal'
  // in main_set_structure.work — used by goal_pace_sharpener (taper).
  const catalogueRowGoalPace = catalogueRow?.category === 'race_specific'
    && ((catalogueRow.main_set_structure as { work?: { pace_target?: string } }).work?.pace_target === 'goal')
  const useGoalPace = (goalPaceWeek === true || catalogueRowGoalPace) && !isVo2max && !!goalPace
  const goalCenterMins = useGoalPace ? paceStrToMins(goalPace!) : null

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
    // LABEL-VARIETY-01 — only PEAK takes the row's shape word. Build and taper
    // keep their single phase word ("progression"/"sharpener") unchanged, so no
    // override label can merge across phases — that cross-phase merge is what
    // surfaces repetition §53 counts by label (CAT-ULTRA-THIN-01, still open).
    // Refining peak's one generic "intervals" into per-row shapes is a strict
    // refinement: it can only lower a label's count, never raise it. Peak is
    // also where the 8×-identical monotony McMillan flagged actually lived.
    //
    // An effort-governed row (a hike, target kind 'effort') has no pace-able
    // shape word — its v2 block label is a coaching phrase ("to the climb"), not
    // a form — and its being goal-paced at all is a separate §22/§40b tension
    // (board territory); fall back to the peak generic rather than leak it.
    const overrideShape =
      phase === 'build'
        ? 'progression'
        : phase === 'taper'
          ? 'sharpener'
          : ((isEffortGoverned ? null : goalPaceShapeWord(catalogueRow)) ?? 'intervals')
    const overrideLabel = distLabel
      ? `${distLabel}-pace ${overrideShape}`
      : 'Goal-pace cruise intervals'
    label = catalogueRowGoalPace
      ? (catalogueRow?.name ?? fallbackLabel)
      : overrideLabel
    minPerKm = goalCenterMins
    paceTarget = paceBandStr(goalCenterMins, 2)
    zone = 'Zone 3–4'
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
    zone = 'Zone 4–5'
    hrTarget = zones.intervalsHR
  } else if (isVo2max) {
    label = catalogueRow?.name ?? fallbackLabel
    minPerKm = pace.minPerKmInterval
    paceTarget = pace.intervalPaceStr
    zone = 'Zone 4–5'
    hrTarget = zones.intervalsHR
  } else {
    // SC-02 — a repurposed aerobic row takes the engine's own threshold label
    // ("Tempo run" / "Cruise intervals" / "Tempo run — short"), which is what
    // this slot would have been called with no catalogue row at all. That is
    // exactly what it is: a threshold slot with nothing threshold to put in it.
    label = aerobicRepurposedAsQuality ? fallbackLabel : (catalogueRow?.name ?? fallbackLabel)
    minPerKm = pace.minPerKmQuality
    paceTarget = pace.qualityPaceStr
    zone = 'Zone 3–4'
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
    notes.push(`${distLabel ?? 'Goal'}-pace work. Target ${goalPace}. Controlled, even splits — exit each rep wanting more.`)
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

  // SC-08 vo2max — a scaled VO2max session is STRUCTURE-DRIVEN: its size is the
  // rep structure's own length (work + recovery), converted to distance via
  // I-pace — NOT weekly × 18%. The freed/added volume vs the sizing estimate is
  // reconciled by the § 4 easy re-derivation in buildWeekSessions (which reads
  // actual placed volume). This is what decouples the VO2max dose from weekly
  // volume at both ends; the SC-10 km-cap becomes a harmless estimate bound.
  const effectiveDistKm = vo2maxScaled
    ? durationForMainSet(vo2maxScaled.mainMins) / pace.minPerKmInterval
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
    duration_mins: dur(rounded, minPerKm),
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
  finalSegmentLabel: string,  // e.g. "Final 30–50% at MP" or "Final third at HM pace"
): Session {
  const voice = catalogueRow.coach_voice_notes ?? 'Easy first. Hit goal pace on tired legs.'
  const coach_notes: [string, string?, string?] = [
    voice,
    `${finalSegmentLabel}: ${goalPace}.`,
  ]
  const rounded = roundDistance(distKm)
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
    zone: 'Zone 2–3',
    hr_target: zones.easyHR,
    pace_target: pace.easyPaceStr,
    rpe_target: 6,
    coach_notes,
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

function raceSession(weekN: number, day: Day, distKm: number, raceName: string | null): Session {
  return {
    id: `w${weekN}-${day}`,
    // F6 — "Race — Target Race" is a placeholder leaking into the plan. When no
    // name was given, say the true thing instead of inventing one.
    type: 'race', label: raceName ? `Race — ${raceName}` : `Race day — ${distKm} km`, detail: null,
    distance_km: distKm, primary_metric: 'distance',
    coach_notes: ['Start slower than feels right. First 5 km at Zone 2.', 'No new shoes, no new food.'],
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
      const km = s.distance_km ?? (s.duration_mins ? s.duration_mins / pace.minPerKmEasy : 0)
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
    'This is a measurement, not a session. Log the result in your profile and your paces update for the next block.',
    'A parkrun counts. So does a solo effort — just make it honest.',
  ]
  return day
}

// ─── Injury adjustments ───────────────────────────────────────────────────────

function hasInjury(input: GeneratorInput, keyword: string): boolean {
  return (input.injury_history ?? []).some(i => i.toLowerCase().includes(keyword))
}

function applyInjuryAdjustments(
  weeklyKm: number,
  prevWeeklyKm: number,
  allowQuality: boolean,
  input: GeneratorInput,
  phase: PhaseType,
): { adjustedKm: number; allowQuality: boolean } {
  let km = weeklyKm
  let quality = allowQuality

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
  // `prevWeeklyKm` is retained in the signature for the non-volume rules below
  // and for callers; it is deliberately unused by the volume path now.
  // Achilles: no quality work (any phase).
  if (hasInjury(input, 'achilles')) {
    quality = false
  }
  // Hip flexor: no quality in base phase only — allows return to quality once aerobic base is built.
  if (hasInjury(input, 'hip_flexor') && phase === 'base') {
    quality = false
  }

  return { adjustedKm: km, allowQuality: quality }
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
  const mpStr    = pace.marathonPaceStr ?? 'marathon pace'
  const hmStr    = pace.hmPaceStr ?? 'HM pace'
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
    if (picked === 'vo2max') {
      const vo2SlotIndex = vo2MustOpenBuild ? 0 : ordered.indexOf('vo2max')
      if (buildRotationIndex !== vo2SlotIndex) {
        return ordered.find(c => c !== 'vo2max') ?? 'threshold'
      }
    }
    return picked
  }
  if (phase === 'taper') return 'threshold'
  // peak:
  if (distKey === '5K' || distKey === '10K') return 'vo2max'
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
  // SC-07 / CD-16 — the adaptation deadline lands on the first build quality
  // week, so the rotation must open on vo2max. Computed once by the caller.
  vo2MustOpenBuild: boolean,
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
): Partial<Record<Day, Session>> {
  const blocked = blockedDays(input)
  const distKey = raceDistanceKey(input.race_distance_km)

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
    sessions[raceDay] = raceSession(weekN, raceDay, input.race_distance_km, raceName)

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
      // Preference order inherited unchanged from the Sunday-race case; §77 adds
      // the `beforeRace` filter so it stays correct for a midweek race. (Whether
      // an easy run the day before a race is good coaching is a separate
      // question — deliberately not relitigated here.)
      const easyDay = firstAvailableDay(
        (['sat', 'fri', 'wed', 'mon', 'tue', 'thu'] as Day[]).filter(beforeRace),
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
  const daysVolumeCanFill = weeklyKm > 0
    ? Math.max(3, Math.floor(weeklyKm / GENERATION_CONFIG.MIN_KM_PER_TRAINING_DAY))
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
  const fitnessCeiling = GENERATION_CONFIG.QUALITY_SESSIONS_PER_WEEK_MAX[intensityFitness]
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
    plannedQuality = fitness === 'experienced' ? 2 : 1
  } else if (phase === 'build' && !isDeload) {
    plannedQuality = 1
  }
  // base = 0; deload weeks (non-peak/taper) = 0

  // Suppression rules — applied AFTER planned count so we keep intent visible.
  const suppressQuality = input.hard_session_relationship === 'avoid'
    || hasInjury(input, 'achilles')
  if (suppressQuality) plannedQuality = 0

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
  const qualKmPerSession = weeklyKm * (qualPct / 100) * qualProgression

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
  const primaryCat = preferredQualityCategory(
    phase, distKey, input.goal === 'time_target', buildRotationIndex, vo2MustOpenBuild)
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
  if (phase === 'peak'
      && !isDeload
      && input.goal === 'time_target'
      && (distKey === 'HM' || distKey === 'MARATHON')) {
    const floorRatio   = GENERATION_CONFIG.PEAK_LR_RATIO_VS_RACE[distKey]
    const targetRatio  = GENERATION_CONFIG.PEAK_LR_RATIO_TARGET[distKey]
    const stretchRatio = GENERATION_CONFIG.PEAK_LR_RATIO_STRETCH[distKey]
    const recentMeetsFloor = input.longest_recent_run_km >= input.race_distance_km * floorRatio
    const noRestrictingInjury = !(input.injury_history ?? []).some(i =>
      GENERATION_CONFIG.HILL_RESTRICTING_INJURIES.some(k => i.toLowerCase().includes(k))
    )
    const lovesHard = input.hard_session_relationship === 'love'
    const tierRatio = (lovesHard && noRestrictingInjury && recentMeetsFloor) ? stretchRatio
      : recentMeetsFloor ? targetRatio
      : floorRatio
    const precisionKm = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
    lrFloorPrinciple = Math.ceil((input.race_distance_km * tierRatio) / precisionKm) * precisionKm
    if (longKm < lrFloorPrinciple) longKm = lrFloorPrinciple
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
  const isFinishGoalPeakLongRun = phase === 'peak'
    && !isDeload
    && input.goal === 'finish'
    && (distKey === 'HM' || distKey === 'MARATHON')
  if (isFinishGoalPeakLongRun
      && pace.minPerKmEasy > 0) {
    const projectedRaceMins = input.race_distance_km * pace.minPerKmEasy
    const floorMins = projectedRaceMins * GENERATION_CONFIG.FINISH_GOAL_PEAK_LR_RATIO_VS_RACE_DURATION
    const floorKm = floorMins / pace.minPerKmEasy
    if (longKm < floorKm) longKm = floorKm
  }

  longKm = applyLongRunCap(longKm, pace.minPerKmEasy, input)

  // Round to DISTANCE_ROUNDING_PRECISION_KM. 0.5 km = whole-number-ish display
  // (11.9 → 12.0, 13.2 → 13.0, 14.7 → 14.5, 8.4 → 8.5).
  const precision = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
  const roundDist = (n: number) => Math.round(n / precision) * precision
  const floorDist = (n: number) => Math.floor(n / precision) * precision
  const minDist   = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM
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
        weekN, longDay, longKm, metric, zones, pace, mpRow, goalPace, 'Final 30–50% at MP'
      )
    } else {
      sessions[longDay] = longSession(weekN, longDay, longKm, metric, zones, pace)
    }
  } else if (useRaceSpecificLR && distKey === 'HM') {
    const hmRow = catalogue.find(r => r.id === 'hm_pace_long_run')
    if (hmRow && (tier !== 'free' || hmRow.is_free_tier)) {
      sessions[longDay] = raceSpecificLongRunSession(
        weekN, longDay, longKm, metric, zones, pace, hmRow, goalPace, 'Final third at HM pace'
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

    if (is5K10K && input.goal === 'time_target' && isFinalTwoPeak) {
      // §24b — final two peak weeks: marathon pace + HM-pace finish
      sessions[longDay] = fiveKTenKPeakLongRunSession(weekN, longDay, longKm, metric, zones, pace)
    } else if (is5K10K && input.goal === 'finish' && isFinalTwoPeak) {
      // §24d — final two peak weeks: negative-split finish
      sessions[longDay] = finishGoalPeakLongRunSession(weekN, longDay, longKm, metric, zones, pace)
    } else {
      sessions[longDay] = longSession(weekN, longDay, longKm, metric, zones, pace)
      // §24c — build phase: Z2-ceiling note on 5K/10K time-targeted long runs
      if (is5K10K && input.goal === 'time_target' && phase === 'build' && !isDeload) {
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
    let preferredCategory = preferredQualityCategory(phase, distKey, isTimeTarget, buildRotationIndex, vo2MustOpenBuild)
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

    const qualDay = firstAvailableDay(['wed', 'thu', 'tue'], blocked, used.filter(d => dayGap(d, 'wed') < 2))
      ?? firstAvailableDay(['wed', 'thu', 'tue', 'mon', 'fri'], blocked, used)

    // CoachingPrinciples §21 — knee/ITB/Achilles/shin/calf/plantar history
    // excludes hill sessions. §21's peak reintroduction is gated on "a successful
    // symptom-free build" that is NOT YET WIRED, so until it is, the exclusion
    // holds in EVERY phase — not just base/build. The old phase scope left peak
    // ungated; it stayed safe only because the stateless selector never happened
    // to pick hill_reps in peak, which the least-used rotation (CAT-ULTRA-THIN-01)
    // no longer guarantees. Restores documented §21 intent.
    const excludeHillSessions = (input.injury_history ?? []).some(i =>
      GENERATION_CONFIG.HILL_RESTRICTING_INJURIES.some(k => i.toLowerCase().includes(k))
    )

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
            && (tier !== 'free' || r.is_free_tier))
          .sort((a, b) => a.distance_eligibility.length - b.distance_eligibility.length)

        cat1 = raceSpecificTaperRows[0] ?? selectCatalogueSession({
          catalogue, phase, distanceKey: distKey, fitness: intensityFitness, tier, weekN, slotIndex: 0, preferredCategory,
          weeklyKm, excludeHillSessions, excludeHighTissueStress, rowUsage, rowLast, poolSizes: poolSink,
        })
      } else {
        cat1 = selectCatalogueSession({
          catalogue, phase, distanceKey: distKey, fitness: intensityFitness, tier, weekN, slotIndex: 0, preferredCategory,
          weeklyKm, excludeHillSessions, excludeHighTissueStress, rowUsage, rowLast, poolSizes: poolSink,
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
          const altCategory: CatalogueCategory = preferredCategory === 'threshold' ? 'vo2max'
            : preferredCategory === 'vo2max' ? 'threshold'
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
            weeklyKm, excludeHillSessions, excludeHighTissueStress, rowUsage, rowLast, poolSizes: poolSink,
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
  if (remainingSlots > 0) {
    // Mirror sumWeeklyKm: distance metric reads distance_km; duration metric
    // converts duration_mins back to km via easy pace. Strength has no volume.
    const placedKm = Object.values(sessions).reduce((sum, s) => {
      if (!s || s.type === 'strength' || s.type === 'rest') return sum
      return sum + (s.distance_km ?? (s.duration_mins ?? 0) / pace.minPerKmEasy)
    }, 0)
    const remainingVolume = Math.max(0, weeklyKm - placedKm)
    // Cap rounded DOWN so post-round easyKm cannot exceed longKm/minRatio.
    // (roundDist uses round-nearest and could otherwise lift easy across the cap,
    // breaking the long-vs-easy invariant by 0.5 km on the boundary.)
    const easyCap = Math.floor((longKm / minRatio) / precision) * precision
    const naturalRounded = roundDist(remainingVolume / remainingSlots)
    easyKm = Math.max(Math.min(naturalRounded, easyCap), minDist.easy)
  }

  // Day-spacing heuristic: at each step, pick the candidate day whose minimum
  // gap to ANY already-used day is largest. Spreads runs across the week
  // instead of stacking them. (Bug fix: prior version filled in fixed
  // easyPreferred order, producing back-to-back runs when blocked days
  // narrowed the candidate pool — e.g. tue+thu blocked → fri/sat/sun consecutive.)
  while (used.length < daysAvailable) {
    const candidates = DAY_ORDER.filter(d => !blocked.has(d) && !used.includes(d))
    if (candidates.length === 0) break
    let best: Day = candidates[0]
    let bestScore = -1
    for (const c of candidates) {
      const score = used.length === 0 ? 7 : Math.min(...used.map(u => dayGap(c, u)))
      if (score > bestScore) {
        bestScore = score
        best = c
      }
    }
    sessions[best] = easySession(weekN, best, easyKm, metric, zones, pace)
    used.push(best)
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
    const stridePreferred: Day[] = ['wed', 'tue', 'thu', 'mon', 'fri']
    const blockedFromStrides: Set<Day> = new Set()
    // Don't append to a session on the day before the long run (heavy legs)
    // or the day after a quality session (recovery day).
    const longDayIdx = DAY_ORDER.indexOf(longDay)
    blockedFromStrides.add(DAY_ORDER[(longDayIdx - 1 + 7) % 7])
    for (const u of used) {
      const s = sessions[u]
      if (s?.type === 'quality') {
        blockedFromStrides.add(DAY_ORDER[(DAY_ORDER.indexOf(u) + 1) % 7])
      }
    }
    for (const d of stridePreferred) {
      if (blocked.has(d) || blockedFromStrides.has(d)) continue
      const s = sessions[d]
      if (!s || s.type !== 'easy') continue
      if (isLongRun(s) || isShakeout(s)) continue
      const note = '4×20s strides at 5K effort, full recovery between.'
      const e0 = s.coach_notes?.[0]
      const e1 = s.coach_notes?.[1]
      s.coach_notes = e0 && e1 ? [e0, e1, note] : e0 ? [e0, note] : [note]
      break  // one stride run per week
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
  if (!input.max_weekday_mins) return
  const weekdays: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri']
  const cap = input.max_weekday_mins
  for (const day of weekdays) {
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
    const floorKm = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.easy
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
    total += s.distance_km ?? ((s.duration_mins ?? 0) / pace.minPerKmEasy)
  }
  return Math.round(total)
}

// CoachingPrinciples §47 — peak long-run alternation. Applied as a post-pass so
// the per-week loop stays simple. Walks peak-phase weeks from last to first and
// marks every other one as a step-back: drop race-pace catalogue specificity,
// reduce LR distance to ≤ PEAK_LR_STEPBACK_MAX_PCT of the peak-level distance,
// and rewrite the label / coach notes to a generic long run.
function applyPeakLongRunAlternation(
  weeks: Week[],
  pace: PaceGuide,
  input: GeneratorInput,
): void {
  const peakWeekIdxs: number[] = []
  for (let i = 0; i < weeks.length; i++) {
    if (weeks[i].phase === 'peak' && weeks[i].type !== 'deload') peakWeekIdxs.push(i)
  }
  if (peakWeekIdxs.length < 2) return  // single peak week — nothing to alternate

  // Find max peak-level LR distance to anchor the step-back fraction.
  const longRunOf = (w: Week): { day: Day; session: Session } | null => {
    for (const [d, s] of Object.entries(w.sessions) as [Day, Session | undefined][]) {
      if (s && isLongRun(s)) {
        return { day: d, session: s }
      }
    }
    return null
  }
  const peakKms = peakWeekIdxs.map(i => longRunOf(weeks[i])?.session.distance_km ?? 0)
  const peakMaxLrKm = Math.max(...peakKms, 0)
  if (peakMaxLrKm <= 0) return

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
  if (!anyPeakIsRacePace) return

  const stepBackMaxKm = peakMaxLrKm * (GENERATION_CONFIG.PEAK_LR_STEPBACK_MAX_PCT / 100)
  const exceptionEligible = input.hard_session_relationship === 'love'
    && (input.injury_history ?? []).length === 0
    && input.training_age === '5yr+'
  let exceptionUsed = false

  // Walk from end (last peak = peak-level) backwards. Even offset → peak-level,
  // odd offset → step-back. Apply to each.
  for (let offset = 0; offset < peakWeekIdxs.length; offset++) {
    const idx = peakWeekIdxs[peakWeekIdxs.length - 1 - offset]
    const w = weeks[idx]
    if (offset % 2 === 0) continue  // peak-level — leave as the engine produced

    // step-back week. If exception applies and not yet used, the runner can
    // carry one back-to-back peak set.
    if (exceptionEligible && !exceptionUsed) {
      exceptionUsed = true
      continue
    }

    const lr = longRunOf(w)
    if (!lr || lr.session.distance_km == null) continue

    const newKm = Math.min(lr.session.distance_km, stepBackMaxKm)
    const precision = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
    const minLong = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.long
    const flooredKm = Math.max(Math.floor(newKm / precision) * precision, minLong)

    // Rewrite the session: strip race-specific label, coach notes, and pace
    // segment fields; restore the standard "Long run — Zone 2" prescription.
    lr.session.label = 'Long run — Zone 2'
    lr.session.zone = 'Zone 2'
    lr.session.distance_km = flooredKm
    lr.session.duration_mins = dur(flooredKm, pace.minPerKmEasy)
    lr.session.rpe_target = 4
    lr.session.coach_notes = ['Step-back week. Easy aerobic — let the legs absorb last week\'s peak before the next push.']
    delete (lr.session as any).lr_segment_pace

    // CoachingPrinciples §9 — long must remain ≥ minRatio × any easy. After
    // reducing the LR, clamp easy runs in this week so the ratio survives.
    const minRatio = GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY
    const minEasy = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.easy
    const easyCeiling = flooredKm / minRatio
    const easyCeilingFloored = Math.floor(easyCeiling / precision) * precision
    for (const [d, s] of Object.entries(w.sessions) as [Day, Session | undefined][]) {
      if (!s) continue
      if (d === lr.day) continue
      if (s.type !== 'easy') continue
      if (s.distance_km == null) continue
      if (s.distance_km > easyCeilingFloored) {
        const newEasy = Math.max(easyCeilingFloored, minEasy)
        s.distance_km = newEasy
        s.duration_mins = dur(newEasy, pace.minPerKmEasy)
      }
    }
  }

  // Recompute weekly_km and long_run_hrs on touched weeks.
  for (const idx of peakWeekIdxs) {
    weeks[idx].weekly_km = sumWeeklyKm(weeks[idx].sessions, pace)
    weeks[idx].long_run_hrs = computeLongRunHrs(weeks[idx].sessions, pace)
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
function applyLongRunStepBacks(weeks: Week[], pace: PaceGuide): void {
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
  const minLong   = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.long
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

function applyLongRunProgressionCap(weeks: Week[], pace: PaceGuide): void {
  const capPct = GENERATION_CONFIG.LONG_RUN_PROGRESSION_CAP_PCT / 100
  const capAbs = GENERATION_CONFIG.LONG_RUN_PROGRESSION_CAP_ABS_KM
  const stepBackTol = 1 + GENERATION_CONFIG.LONG_RUN_DELOAD_STEP_BACK_TOLERANCE_PCT / 100
  const precision = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
  const minLong = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.long

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
    if (prevLR.session.distance_km == null || currLR.session.distance_km == null) continue

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
    const prevPrevKm = prevPrevLR?.session.distance_km
    const prevWasStepBack = prevPrevKm != null
      && prev.type !== 'race'
      && prevLR.session.distance_km < prevPrevKm - 0.01
    if (prev.type === 'deload' || prevWasStepBack) {
      if (prevPrevKm != null && currLR.session.distance_km <= prevPrevKm * stepBackTol + 0.01) continue
    }

    const allowedJumpKm = Math.max(prevLR.session.distance_km * capPct, capAbs)
    const maxAllowedKm = prevLR.session.distance_km + allowedJumpKm
    if (currLR.session.distance_km - 0.01 > maxAllowedKm) {
      const newKm = Math.max(Math.floor(maxAllowedKm / precision) * precision, minLong)
      currLR.session.distance_km = newKm
      currLR.session.duration_mins = dur(newKm, pace.minPerKmEasy)

      // CoachingPrinciples §9 — clamp easy runs so long-vs-easy ratio survives.
      const minRatio = GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY
      const minEasy = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.easy
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
): void {
  const threshold = 1 + GENERATION_CONFIG.V1_VOLUME_QUALITY_SPLIT_THRESHOLD_PCT / 100
  const precision = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
  const minEasy   = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.easy
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
    flattenIntroducingWeek(weeks, triggerIdx, pace, adjustments, threshold, precision, minEasy, minRatio)
  }
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
): void {
  const curr = weeks[triggerIdx]
  const prev = weeks[triggerIdx - 1]

  // Name the stimulus this week actually introduced, so the record says which
  // of the two triggers fired rather than always claiming "first quality".
  const introducesVo2 = Object.values(curr.sessions)
    .some(s => s != null && s.type === 'quality' && classifyStimulus(s) === 'vo2max')
  const isFirstQualityWeek = !weeks.slice(0, triggerIdx)
    .some(w => Object.values(w.sessions).some(s => s?.type === 'quality'))
  const introduced = isFirstQualityWeek
    ? (introducesVo2 ? 'the first quality session of the plan (VO2max)' : 'the first quality session')
    : 'the first VO2max session'
  if (curr.type === 'race' || curr.type === 'deload') return
  if (curr.weekly_km <= prev.weekly_km * threshold) return  // bump is small enough

  // Identify the long-run session — it is excluded from scaling.
  const lr = longRunOfWeek(curr)

  // Sum easy-only volume (excluding long run, quality, strength, rest).
  // Easy = type 'easy' AND NOT the long run.
  const easyKm = Object.entries(curr.sessions).reduce((sum, [d, s]) => {
    if (!s || s.type !== 'easy') return sum
    if (lr && d === lr.day) return sum  // long-run excluded
    return sum + (s.distance_km ?? (s.duration_mins ?? 0) / pace.minPerKmEasy)
  }, 0)

  if (easyKm <= 0) return  // no easies to scale

  // §52 guard — V1 must not shrink weekly so much that LR / weekly exceeds the
  // 60% lopsidedness cap. Compute a floor on weekly_target so the ratio
  // survives, with a precision-aligned safety margin so post-rounding
  // reconstruction (sumWeeklyKm) doesn't drop us below the floor. If
  // prev_weekly is already below this floor, V1 partial-applies (lands at
  // the floor, not at prev) — better to leave easy slightly elevated than
  // to break §52.
  const lrKm = lr?.session.distance_km ?? 0
  const lrMaxPctOfWeekly = GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_WEEKLY / 100
  // Round the floor UP to the next km — sumWeeklyKm rounds the final total to
  // an integer, which can bring us back below the strict floor by up to 1 km.
  const weeklyFloorFromLR = lrKm > 0 ? Math.ceil(lrKm / lrMaxPctOfWeekly) + 1 : 0
  const targetWeeklyKm = Math.max(prev.weekly_km, weeklyFloorFromLR)
  if (targetWeeklyKm >= curr.weekly_km) return  // would leave plan unchanged or grow it

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
  if (easyTargetKm >= easyKm) return  // already under target — nothing to do

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
      minEasy,
    )
    s.distance_km = scaled
    s.duration_mins = dur(scaled, pace.minPerKmEasy)
  }
  const newWeekly = sumWeeklyKm(curr.sessions, pace)
  curr.weekly_km = newWeekly
  curr.long_run_hrs = computeLongRunHrs(curr.sessions, pace)

  adjustments.push({
    rule:           'V1-volume-quality-split',
    violation:      `Week ${curr.n} introduced ${introduced} AND stepped volume up from ${prev.weekly_km} to ${preCorrectionWeeklyKm} km (>${GENERATION_CONFIG.V1_VOLUME_QUALITY_SPLIT_THRESHOLD_PCT}% bump).`,
    resolution:     `Held weekly volume at ${newWeekly} km (target ${prev.weekly_km}) by trimming easy runs; long run + quality preserved.`,
    weeks_affected: [curr.n],
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

  const toWeek = weeks[swapTarget.weekIdx]
  const vo2Session     = fromWeek.sessions[firstVo2Pos.day]!
  const targetSession  = toWeek.sessions[swapTarget.day]!

  // Swap session objects between the two day-slots. Update IDs to match new
  // (week, day) so deterministic-ID invariant (INV-PLAN-009) survives.
  vo2Session.id    = `w${toWeek.n}-${swapTarget.day}`
  targetSession.id = `w${fromWeek.n}-${firstVo2Pos.day}`
  toWeek.sessions[swapTarget.day]   = vo2Session
  fromWeek.sessions[firstVo2Pos.day] = targetSession

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
    if (!lr || lr.session.distance_km == null) {
      streakDist = null
      streakCount = 0
      continue
    }
    const dist = lr.session.distance_km
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

        lr.session.distance_km = newKm
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

export function generateRulePlan(
  input: GeneratorInput,
  tier: Tier,
  planStart?: string,
  catalogue: SessionCatalogueRow[] = V1_SESSION_CATALOGUE,
): Plan {
  const planStartIso = planStart ?? formatDate(nextMonday())
  const today = formatDate(new Date())

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
  const daysCheck: DaysAvailableResult = enforceDaysAvailable(input as PrepTimeAwareInput)

  // CoachingPrinciples §44 — prep-time validation. Runs first so block/warn
  // outcomes surface before any generation work. Throws PrepTimeError on
  // block or warn-without-acknowledgment; falls through with a result the
  // meta block consumes when ok or warn-acknowledged.
  const prepTime: PrepTimeResult = enforcePrepTime(input as PrepTimeAwareInput, planStartIso)

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
  const planLength = calcPlanLength(input.race_distance_km, input.race_date, planStartIso)
  const { totalWeeks, compressed } = planLength
  const anchoredStartIso  = planLength.planStartIso
  const anchoredStartDate = parseDateLocal(anchoredStartIso)
  const phases = computePhases(totalWeeks, input.race_distance_km)

  // §79 (2026-08-31) — the metric recommendation follows EXPERIENCE (intensity),
  // not raw current volume (structural). Duration is the beginner / ultra default
  // (time on feet, §80); a returning or experienced runner sees distance even when
  // their current volume reads low. intensityFitness is 'beginner' only when every
  // signal agrees the runner is a true beginner, so this narrows duration to
  // exactly that cohort. (User-overridable per session/globally — Phase 3.)
  const metric: 'distance' | 'duration' =
    intensityFitness === 'beginner' || input.race_distance_km >= 50 ? 'duration' : 'distance'

  const peakKm = config.peakKmByLevel[fitness]

  // CoachingPrinciples §29 — fresh-from-layoff detection. Two paths:
  //  1. Explicit: weeks_at_current_volume < threshold (the input the wizard
  //     can surface as a "have you been at this volume long?" question).
  //  2. Heuristic (R2/M-03): training_age says experienced, but current volume
  //     and longest recent run are both below floors typical of that
  //     experience. The mismatch points to a layoff regardless of whether
  //     the user thought to mention it.
  const explicitFreshReturn = input.weeks_at_current_volume !== undefined
    && input.weeks_at_current_volume < GENERATION_CONFIG.FRESH_RETURN_WEEKS_THRESHOLD
  // trainingAgeIsExperienced declared above (fed to assessFitness for the §79 lift).
  const heuristicFreshReturn = trainingAgeIsExperienced
    && input.current_weekly_km < GENERATION_CONFIG.HEURISTIC_FRESH_RETURN_WEEKLY_KM
    && input.longest_recent_run_km < GENERATION_CONFIG.HEURISTIC_FRESH_RETURN_LONG_RUN_KM
  const isFreshReturn = explicitFreshReturn || heuristicFreshReturn
  const declaredStartKm = isFreshReturn
    ? input.current_weekly_km * GENERATION_CONFIG.FRESH_RETURN_START_FRACTION
    : input.current_weekly_km
  // CD-6 / §10 — a <6mo runner's declared volume is a self-reported bucket, not
  // measured; cap the start so an over-claim can't hand a beginner too much.
  const startKm = input.training_age === '<6mo'
    ? Math.min(declaredStartKm, GENERATION_CONFIG.BEGINNER_WEEK1_VOLUME_CAP_KM)
    : declaredStartKm

  // Recovery cadence — masters (age ≥ 45) recover every 3 weeks (CoachingPrinciples §3).
  // Computed once and shared between volume sequence + week badging so they stay aligned.
  const recoveryFreq = input.age >= GENERATION_CONFIG.MASTERS_AGE_THRESHOLD
    ? GENERATION_CONFIG.RECOVERY_WEEK_FREQUENCY_MASTERS
    : GENERATION_CONFIG.RECOVERY_WEEK_FREQUENCY_STANDARD

  // Fresh-return runners get the standard 10% ramp (no allowance) — their
  // structural base is gone and the cap exists to protect them.
  const returningRunner = !isFreshReturn && isReturningRunner(input, peakKm)

  // §79 (2026-08-31) — progressive intensity re-entry. A returning runner whose
  // intensity was lifted (or who is otherwise detected as returning/fresh) has an
  // aerobic engine ahead of their tissue tolerance. Withhold VO2max/hills for the
  // opening RETURNING_RUNNER_INTENSITY_REENTRY_WEEKS so quality leads with
  // tempo/threshold. Surfaced in meta for honesty + the invariant.
  const intensityReentryActive =
    assessed.intensityLiftedForReturn || returningRunner || isFreshReturn
  const intensityReentryWeeks = intensityReentryActive
    ? GENERATION_CONFIG.RETURNING_RUNNER_INTENSITY_REENTRY_WEEKS
    : 0
  const { volumes, compressed: capCompressed } = buildVolumeSequence(
    totalWeeks, phases, startKm, peakKm, input.race_distance_km,
    recoveryFreq, returningRunner,
    (hasInjury(input, 'knee') || hasInjury(input, 'shin_splints'))
      ? GENERATION_CONFIG.INJURY_WEEKLY_INCREASE_CAP_PCT
      : undefined,
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
        const wnIsDeload = wn % recoveryFreq === 0
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
  let buildRotationIndex = 0

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
    const isDeload = !isRaceWeek && weekN % recoveryFreq === 0 && phase !== 'peak' && phase !== 'taper'
    // Recalibration on deload weeks in base/build — fresher legs, good time to benchmark
    const isRecalibration = isDeload && (phase === 'base' || phase === 'build')
    // NOTE: recalibrationWeeks is NOT populated here. CoachingPrinciples §78 —
    // the metadata follows the produced plan, never the intent. A week only
    // counts as a recalibration week if the time trial was actually placed,
    // which is resolved after buildWeekSessions returns.

    const weeklyKm = volumes[i]
    // §12's weekly cap now lives in buildVolumeSequence, so the curve already
    // reflects it. This call still handles the non-volume injury rules
    // (achilles/hip-flexor quality suppression).
    const prevWeeklyKm = i > 0 ? volumes[i - 1] : startKm

    const { adjustedKm } = applyInjuryAdjustments(weeklyKm, prevWeeklyKm, true, input, phase)

    const isRotatingBuildWeek = phase === 'build' && !isDeload && !isRaceWeek

    const sessions = buildWeekSessions(
      weekN, phase, isDeload, isRaceWeek,
      adjustedKm, input, zones, pace, metric, phases,
      tier, catalogue,
      fitness,
      goalPace,
      totalWeeks,
      buildRotationIndex,
      vo2MustOpenBuild,
      intensityFitness,
      cueCtx,
      rowUsage,
      rowLast,
      // §79 — withhold VO2max/hills during the returning runner's opening weeks.
      intensityReentryActive && weekN <= intensityReentryWeeks,
      qualityPool,
    )

    // Advance the rotation only on weeks that actually carried a build quality
    // slot — see isRotatingBuildWeek above.
    if (isRotatingBuildWeek) buildRotationIndex++

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
  applyPeakLongRunAlternation(weeks, pace, input)

  // CoachingPrinciples §45 — long-run progression cap. Walks the plan and
  // clamps any LR that exceeds +20% / +5km from the prior week's LR.

  // CoachingPrinciples §9 (CD-9) — build-phase long-run step-backs. Runs LAST so
  // the progression cap can't re-inflate the reduced week. Peak long runs are
  // left alone (culmination + §80 floor), so this can't create a floor violation.
  applyLongRunStepBacks(weeks, pace)
  // §45 runs AFTER the step-backs, not before (fixed 2026-08-20). Running it
  // first meant it never saw the sequence the runner actually gets:
  // applyLongRunStepBacks then cut every Nth build long run, and the week after
  // became a jump nothing re-checked. All 430 remaining sweep violations of this
  // code were that ordering — re-running the cap at the end cleared every one.
  applyLongRunProgressionCap(weeks, pace)

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
  applyV2Vo2MaxOnsetTiming(weeks, input.race_distance_km, phases, ruleAdjustments)
  applyV5StimulusProgression(weeks, input.race_distance_km, pace, zones, ruleAdjustments)
  applyV1VolumeQualityStimulusSplit(weeks, pace, ruleAdjustments)
  applyV4LongRunRepeatCeiling(weeks, input, pace, ruleAdjustments)

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
    if (trainingDays < minDays) {
      // Only report weeks that would otherwise have carried two — i.e. peak
      // weeks for an experienced runner. Reporting every week would be noise.
      const affected = weeks
        .filter(w => w.phase === 'peak' && w.badge !== 'deload' && intensityFitness === 'experienced')
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
                  actualPeakLrKm = Math.max(actualPeakLrKm, s.distance_km ?? 0)
                }
              }
            }
          }

          const ratioFails  = ratio < GENERATION_CONFIG.PEAK_OVER_BASE_RATIO
          const volumeFails = volumeFloor > 0 && peakKmActual + 0.01 < volumeFloor
          const lrFails     = longRunFloorKm > 0 && actualPeakLrKm + 0.01 < longRunFloorKm

          if (!ratioFails && !volumeFails && !lrFails) {
            return { volume_profile: 'build' as const }
          }

          const reasons: string[] = []
          if (ratioFails) {
            // V7 / CD-10 — the ratio is deliberately peak-PHASE-scoped (§23: does the
            // plan overload INTO the peak?), but the note must not imply peakKmActual
            // is the plan's maximum. For a beginner the highest week can sit in base
            // (peak = long run + specificity, not tonnage — §80). State both figures
            // so the note is arithmetically honest about the plan the runner holds.
            const planMaxKm = Math.max(...weeks.map(wk => wk.weekly_km), 0)
            const baseNote = planMaxKm > peakKmActual
              ? ` The plan's highest week is ${planMaxKm} km, earlier in the block — volume holds rather than building into the peak, which is by design for this level.`
              : ''
            reasons.push(`Peak-phase volume ${peakKmActual} km is ${Math.round(ratio * 100)}% of week 1 (${w1} km) — below the ${Math.round(GENERATION_CONFIG.PEAK_OVER_BASE_RATIO * 100)}% overload threshold.${baseNote}`)
          }
          if (volumeFails) {
            reasons.push(`Peak weekly volume ${peakKmActual} km is below the ${Math.round(volumeFloor)} km floor for a time-targeted ${distKey} (${Math.round((volumeFloor / distKm) * 100)}% of race distance).`)
          }
          if (lrFails) {
            reasons.push(`Peak long run ${actualPeakLrKm} km is below the ${Math.round(longRunFloorKm * 10) / 10} km floor (${Math.round(GENERATION_CONFIG.PEAK_LR_RATIO_VS_RACE[distKey as 'HM' | 'MARATHON'] * 100)}% of race distance) — week-on-week long-run cap (§45) prevented reaching the ratio.`)
          }
          const diagnosis = reasons.join(' ') + ' Plan maintains current fitness rather than building it.'

          const suggestions: string[] = []
          if (input.days_available < 6) {
            suggestions.push(`increase days_available from ${input.days_available} to ${input.days_available + 1}`)
          }
          if (input.max_weekday_mins != null && input.max_weekday_mins < 90) {
            suggestions.push(`raise max_weekday_mins from ${input.max_weekday_mins} to 90`)
          }
          if (lrFails || volumeFails) {
            suggestions.push(`defer the race so the build has more weeks (current ${totalWeeks}, recommended ≥${GENERATION_CONFIG.PREP_TIME_THRESHOLDS[distKey].warn})`)
          }
          const prescription = suggestions.length > 0
            ? ` To enable a build profile: ${suggestions.join(', OR ')}.`
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
    ? `Plan generated as maintenance — ${input.days_available} day${input.days_available === 1 ? '' : 's'}/week is ${
        input.days_available <= 2 ? 'too few sessions to avoid structurally lopsided weeks (long run dominates weekly volume)' : `below the recommended ${daysCheck.days_required_ok}-day-minimum for a ${raceDistanceKey(input.race_distance_km)} build`
      }. Plan maintains current fitness rather than building it. To enable a build profile: increase days_available to ${Math.max(daysCheck.days_required_ok, 3)}.`
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
      : `raising the weekday limit to ${input.max_weekday_mins + 15} minutes`

    // Voice per brand.md: honest, specific, never motivational. The earlier
    // draft included "a 44km week you run beats a 65km week you abandon" —
    // true, but it is encouragement, and the brand rule is that we state the
    // fact and let the runner draw the conclusion.
    return `Your ${input.max_weekday_mins}-minute weekday limit is shaping this plan — peak week reaches ${Math.round(peakActual)}km where it would otherwise have gone to ${Math.round(peakIntent)}km, about ${Math.round(lostPct)}% less. Only the volume moves; the sessions and their balance don't. If you want it back, ${lever} is the lever.`
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
    if (peakLrMins === 0 || peakLrMins + 1 >= floorMins) return null
    return `Your longest run tops out at ${Math.round(peakLrMins)} minutes. For a race you'll likely be moving for around ${Math.round(projectedRaceMins)} minutes, we'd normally want it nearer ${Math.round(floorMins)} — but the long-run time cap for this distance stops us going further. Expect the last stretch of race day to be new territory; go out slower than feels right and take the walk breaks early rather than late.`
  })()

  // Compose final values. §23's note wins (more specific) when both trigger.
  // VOL-STRUCTURE-01 — the honest note for a plan that cannot progress.
  //
  // Names the LEVER, per §40c's rule: a note that only reports the loss is a
  // disclaimer. More days is the honest first lever, because the defect scales
  // with volume-per-available-day — 4% at <=8 km/day against 73% at 17+.
  const structuralNote: string | null = structuralPeakInversion
    ? `Plan generated as maintenance — ${input.current_weekly_km}km a week across ${input.days_available} day${input.days_available === 1 ? '' : 's'} cannot be built on. The long run is already at its time cap and the easy runs are capped against it, so adding a quality session takes volume out of the week rather than adding to it: this plan peaks at ${Math.round(structuralPeakInversion.peakMax)}km against ${Math.round(structuralPeakInversion.baseMax)}km earlier in the plan. It maintains your fitness rather than building it. The lever is days, not effort — ${input.days_available + 1} running days would let the same volume progress.`
    : null

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
      const km = sn.distance_km ?? ((sn.duration_mins ?? 0) / pace.minPerKmEasy)
      if (km > longest) longest = km
    }
    return longest / w.weekly_km > lrCapPct
  })
  const lopsidedNote: string | null = lopsidedWeek
    ? `Plan generated as maintenance — the long run this race needs is larger than your current weekly volume can carry around it. By week ${lopsidedWeek.n} the long run is ${Math.round(GENERATION_CONFIG.LONG_RUN_MAX_PCT_OF_WEEKLY)}%+ of the whole week, which is a lopsided week however it is arranged: the race sets the long run, your current ${input.current_weekly_km}km a week sets everything else. It maintains your fitness and gets you round rather than building you up. The lever is weekly volume — more running on the other days, not a longer long run.`
    : null

  // §81 (MWM-02) — the long run does not fit the runner's stated weekday ceiling.
  // Only reachable when the long run has been forced onto a weekday (both
  // weekend days blocked); it is exempt from the cap, so without this the
  // overrun would ship silently. Same shape as lopsidedWeek above.
  const longRunOverrun: { n: number; mins: number; cap: number } | null = (() => {
    const cap = input.max_weekday_mins
    if (!cap) return null
    const limit = cap * (1 + GENERATION_CONFIG.LONG_RUN_WEEKDAY_OVERRUN_MAINTENANCE_PCT / 100)
    let worst: { n: number; mins: number; cap: number } | null = null
    for (const w of weeks) {
      if (w.type === 'race') continue
      for (const d of ['mon', 'tue', 'wed', 'thu', 'fri'] as Day[]) {
        const sn = w.sessions?.[d]
        if (!sn || !isLongRun(sn)) continue
        const mins = sn.duration_mins ?? 0
        if (mins > limit && (!worst || mins > worst.mins)) worst = { n: w.n, mins, cap }
      }
    }
    return worst
  })()
  const longRunOverrunNote: string | null = longRunOverrun
    ? `Plan generated as maintenance — your long run does not fit the time you have. You've kept both weekend days clear of training and capped weekdays at ${longRunOverrun.cap} minutes, but by week ${longRunOverrun.n} the long run this race needs is about ${Math.round(longRunOverrun.mins)} minutes. It stays in the plan at full length, because a long run cut to ${longRunOverrun.cap} minutes stops being a long run. What it can't do is build toward the race on those terms. The lever is one longer session a week — a weekend morning, or a single weekday you can give more time to.`
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
    ? `Plan generated as maintenance — your easy runs don't fit the time you have on ${floorProtectedWeekCount} of this plan's weeks. You've capped weekdays at ${input.max_weekday_mins} minutes, and at that limit some easy runs would shrink to a distance too short to train anything, so they stay a few minutes over your cap instead. The lever is day count — fewer, fuller sessions fit your time better than more, thinner ones.`
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
      ?? longRunOverrunNote ?? easyFloorProtectionNote ?? undefined

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

  const difficultyBand: 'comfortable' | 'demanding' | 'very_demanding' =
    prepTime.status === 'warn' ? 'very_demanding'
    : compressionClassification === 'constrained_by_inputs' ? 'demanding'
    : goalBeyondMeasuredFitness ? 'demanding'
    : (input.goal === 'time_target' && prepMargin < GENERATION_CONFIG.DIFFICULTY_COMFORTABLE_MARGIN_WEEKS) ? 'demanding'
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
      : `Demanding on ${prepTime.weeks_available} weeks — a tight but workable timeline for the time you're chasing. Hold the easy days and it stays honest.`

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
    ...(volumeShortfallNote ? { volume_shortfall_note: volumeShortfallNote } : {}),
    ...(volumeShortfallPct != null ? { volume_shortfall_pct: Math.round(volumeShortfallPct * 10) / 10 } : {}),

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

  // Constitutional review — verify the plan honours its own coaching principles.
  // In dev, throw on errors so the matrix / property tests fail loudly.
  // In prod, log + return the plan (don't break the user). See lib/plan/invariants.ts.
  enforceViolations(validatePlan(plan, input))

  return plan
}
