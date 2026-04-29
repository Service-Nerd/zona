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
import { validatePlan, formatViolations } from './invariants'
import { enforcePrepTime, validateInputFields, type PrepTimeAwareInput, type PrepTimeResult } from './inputs'
import {
  V1_SESSION_CATALOGUE, selectCatalogueSession,
  type SessionCatalogueRow, type CatalogueCategory,
} from './sessionCatalogueData'

// ─── Internal types ───────────────────────────────────────────────────────────

type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
type PhaseType = 'base' | 'build' | 'peak' | 'taper'
type FitnessLevel = 'beginner' | 'intermediate' | 'experienced'

interface ZoneTargets {
  zone2Ceiling: number
  easyHR: string
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
function parseBenchmarkTime(time: string): number {
  const parts = time.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60
  if (parts.length === 2) return parts[0] + parts[1] / 60
  return NaN
}

// Jack Daniels VDOT formula: VDOT from any race result
function calcVDOT(distanceKm: number, timeMinutes: number): number {
  if (!Number.isFinite(timeMinutes) || timeMinutes <= 0) return NaN
  const v = (distanceKm * 1000) / timeMinutes  // metres per minute
  const utilization = 0.8
    + 0.1894393 * Math.exp(-0.012778 * timeMinutes)
    + 0.2989558 * Math.exp(-0.1932605 * timeMinutes)
  const vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v
  return vo2 / utilization
}

// Velocity (m/min) at a given fraction of VDOT — quadratic solve
function velocityAtFraction(vdot: number, fraction: number): number {
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
function applyVdotDiscount(rawVdot: number, b: BenchmarkInput, today: Date): { vdot: number; discountPct: number } {
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

function tanakaMaxHR(age: number): number {
  return Math.round(208 - 0.7 * age)
}

// ─── Fitness level derivation ─────────────────────────────────────────────────
// Uses VDOT when available (more accurate). Falls back to volume-based proxy.

function deriveFitnessLevel(weeklyKm: number, longestKm: number, vdot?: number): FitnessLevel {
  if (vdot !== undefined && Number.isFinite(vdot)) {
    if (vdot < 35) return 'beginner'
    if (vdot <= 50) return 'intermediate'
    return 'experienced'
  }
  if (weeklyKm < 20 || longestKm < 8) return 'beginner'
  if (weeklyKm >= 55 && longestKm >= 20) return 'experienced'
  return 'intermediate'
}

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
    const z2Top    = k(Z.Z2.karvonen_pct[1])  // top of Z2 → easy ceiling
    const z3Low    = k(Z.Z3.karvonen_pct[0])  // Z3 low → quality low
    const z3Top    = k(Z.Z3.karvonen_pct[1])  // Z3 top → quality high
    const z4Low    = k(Z.Z4.karvonen_pct[0])  // Z4 low → intervals low
    return {
      zone2Ceiling: z2Top,
      easyHR:       `< ${z2Top} bpm`,
      qualityHR:    `${z3Low}–${z3Top} bpm`,
      intervalsHR:  `${z4Low}–${mhr} bpm`,
    }
  }
  // %MaxHR — used when resting HR not provided
  const m = (pct: number) => Math.round((pct / 100) * mhr)
  const z2Top = m(Z.Z2.maxhr_pct[1])
  const z3Low = m(Z.Z3.maxhr_pct[0])
  const z3Top = m(Z.Z3.maxhr_pct[1])
  const z4Low = m(Z.Z4.maxhr_pct[0])
  return {
    zone2Ceiling: z2Top,
    easyHR:       `< ${z2Top} bpm`,
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

interface HRZoneFallbackResult {
  zones: ZoneTargets
  derived_max: number
  method: HRZoneMethod
  assumption_note?: string
  estimated_max?: number
}

function buildHRZonesWithFallback(input: GeneratorInput): HRZoneFallbackResult {
  // Note: §55 (L-01) ensures any non-zero, non-undefined max_hr / resting_hr
  // is in physiological range. The checks below treat 0 and undefined alike
  // as "missing" — the form-default sentinel rejection happens upstream.
  const hasMax = input.max_hr !== undefined && input.max_hr !== null && input.max_hr > 0
  const hasResting = input.resting_hr !== undefined && input.resting_hr !== null && input.resting_hr > 0

  if (hasMax && hasResting) {
    const max = input.max_hr!
    return {
      zones: computeZones(max, input.resting_hr!),
      derived_max: max,
      method: 'karvonen',
    }
  }
  if (hasMax && !hasResting) {
    const max = input.max_hr!
    return {
      zones: computeZones(max),
      derived_max: max,
      method: 'percent_of_max',
      assumption_note: 'Zones derived from max HR only (no resting HR provided). Karvonen (using both max and resting) is more accurate. To refine: measure resting HR first thing in the morning, lying down, for 1 minute.',
    }
  }
  if (!hasMax && hasResting) {
    const estMax = tanakaMaxHR(input.age)
    return {
      zones: computeZones(estMax, input.resting_hr!),
      derived_max: estMax,
      method: 'karvonen_estimated_max',
      estimated_max: estMax,
      assumption_note: `Max HR estimated from age (${estMax} bpm using 208 − 0.7 × age). Your true max may differ by ±10 bpm. To refine: note your highest HR during a hard finish or hill effort and update your profile.`,
    }
  }
  // Neither
  const estMax = tanakaMaxHR(input.age)
  const zones = computeZones(estMax)
  return {
    zones,
    derived_max: estMax,
    method: 'percent_of_estimated_max',
    estimated_max: estMax,
    assumption_note: `Both max and resting HR missing — zones estimated from age alone (max ≈ ${estMax} bpm, Zone 2 ceiling ≈ ${zones.zone2Ceiling} bpm). Working approximation. Recommend a HR field test in the first 2 weeks. If easy runs feel consistently too hard or too easy, your true max differs from the estimate — update your inputs.`,
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

    const cap = 1 + allowanceForWeek(weekN) / 100
    const maxAllowed = Math.round(volumes[i - 1] * cap)
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
      const stepPct = taperConfig.volume_reduction_pct / fullTaperWeeks
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

const FULL_TO_SHORT: Record<string, Day> = {
  monday: 'mon', tuesday: 'tue', wednesday: 'wed', thursday: 'thu',
  friday: 'fri', saturday: 'sat', sunday: 'sun',
}

const DAY_ORDER: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_INDEX: Record<Day, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 }

function dayGap(a: Day, b: Day): number {
  const diff = Math.abs(DAY_INDEX[a] - DAY_INDEX[b])
  return Math.min(diff, 7 - diff)
}

// CoachingPrinciples §18 — accept both short ('mon') and full ('monday') forms.
// Wizard sends full names; API/test inputs may send short. The parser is the
// boundary; downstream code treats blocked as Set<Day>.
const SHORT_DAY_SET: Set<Day> = new Set(DAY_ORDER)

function blockedDays(input: GeneratorInput): Set<Day> {
  const s = new Set<Day>()
  for (const d of input.days_cannot_train ?? []) {
    const lower = String(d).toLowerCase()
    if (SHORT_DAY_SET.has(lower as Day)) { s.add(lower as Day); continue }
    const short = FULL_TO_SHORT[lower]
    if (short) s.add(short)
  }
  return s
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
function makeQualitySession(args: {
  weekN: number; day: Day; distKm: number; metric: 'distance' | 'duration'
  zones: ZoneTargets; pace: PaceGuide
  catalogueRow: SessionCatalogueRow | null
  phase: PhaseType; fitness: FitnessLevel; isDeload: boolean
  goalPace: string | null | undefined
  goalPaceWeek?: boolean
  distLabel?: string  // e.g. "10K", "HM" — used when goalPaceWeek triggers race-distance-named session
}): Session {
  const { weekN, day, distKm, metric, zones, pace, catalogueRow, phase, fitness, isDeload, goalPace, goalPaceWeek, distLabel } = args

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
    // CoachingPrinciples §53 — vary the override label by phase so a single
    // race-pace label doesn't dominate the plan. Build phase override gets
    // a tempo flavour; peak retains the interval-flavoured override (matching
    // the catalogue's hm_pace_intervals naming, which keeps build/peak
    // distinguishable for HM/marathon plans).
    const overrideLabel = !distLabel
      ? 'Goal-pace cruise intervals'
      : phase === 'build'
        ? `${distLabel}-pace progression`
        : phase === 'taper'
          ? `${distLabel}-pace sharpener`
          : `${distLabel}-pace intervals`
    label = catalogueRowGoalPace
      ? (catalogueRow?.name ?? fallbackLabel)
      : overrideLabel
    minPerKm = goalCenterMins
    paceTarget = paceBandStr(goalCenterMins, 2)
    zone = 'Zone 3–4'
    hrTarget = zones.qualityHR
  } else if (isVo2max) {
    label = catalogueRow?.name ?? fallbackLabel
    minPerKm = pace.minPerKmInterval
    paceTarget = pace.intervalPaceStr
    zone = 'Zone 4–5'
    hrTarget = zones.intervalsHR
  } else {
    label = catalogueRow?.name ?? fallbackLabel
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
  } else if (catalogueRow?.coach_voice_notes) {
    notes.push(catalogueRow.coach_voice_notes)
    if (phase === 'peak' && goalPace && !catalogueRow.coach_voice_notes.toLowerCase().includes('pace')) {
      notes.push(`Race-pace work. Target: ${goalPace}. Controlled — not all-out.`)
    }
  }
  const coach_notes = notes.length === 0 ? undefined
    : notes.length === 1 ? [notes[0]] as [string]
    : notes.length === 2 ? [notes[0], notes[1]] as [string, string]
    : [notes[0], notes[1], notes[2]] as [string, string, string]

  const rounded = roundDistance(distKm)
  return {
    id: `w${weekN}-${day}`,
    type: 'quality', label, detail: null,
    ...(metric === 'distance' ? { distance_km: rounded } : {}),
    duration_mins: dur(rounded, minPerKm),
    primary_metric: metric,
    zone, hr_target: hrTarget,
    pace_target: paceTarget,
    rpe_target: isDeload ? 6 : 7,
    ...(coach_notes ? { coach_notes } : {}),
    ...(catalogueRow ? {} : {}),  // future: surface catalogue_id when schema permits
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

function raceSession(weekN: number, day: Day, distKm: number, raceName: string): Session {
  return {
    id: `w${weekN}-${day}`,
    type: 'race', label: `Race — ${raceName}`, detail: null,
    distance_km: distKm, primary_metric: 'distance',
    coach_notes: ['Start slower than feels right. First 5 km at Zone 2.', 'No new shoes, no new food.'],
  }
}

function shakeoutSession(weekN: number, day: Day, zones: ZoneTargets, pace: PaceGuide): Session {
  return easySession(weekN, day, 4, 'distance', zones, pace, 'Easy shakeout', 2,
    ['Short and relaxed. Wake the legs, nothing more.'])
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

  // Knee + shin splints: weekly volume cap tightens to INJURY_WEEKLY_INCREASE_CAP_PCT (5%)
  // from the standard MAX_WEEKLY_VOLUME_INCREASE_PCT (10%). CoachingPrinciples §12.
  if (hasInjury(input, 'knee') || hasInjury(input, 'shin_splints')) {
    const cap = 1 + GENERATION_CONFIG.INJURY_WEEKLY_INCREASE_CAP_PCT / 100
    const maxIncrease = prevWeeklyKm * cap
    km = Math.min(km, maxIncrease)
  }
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
function preferredQualityCategory(phase: PhaseType, distKey: RaceDistanceKey): CatalogueCategory {
  if (phase === 'base')  return 'aerobic'
  if (phase === 'build') return 'threshold'
  if (phase === 'taper') return 'threshold'
  // peak:
  if (distKey === '5K' || distKey === '10K') return 'vo2max'
  if (distKey === 'HM')                      return 'race_specific'  // hm_pace_intervals
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
): Partial<Record<Day, Session>> {
  const blocked = blockedDays(input)
  const distKey = raceDistanceKey(input.race_distance_km)

  if (isRaceWeek) {
    const sessions: Partial<Record<Day, Session>> = {}
    const raceName = input.race_name ?? 'Target Race'
    const raceDay = firstAvailableDay(['sun', 'sat', 'fri', 'thu', 'wed'], blocked) ?? 'sun'
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

    const shakeout1 = firstAvailableDay(['tue', 'wed', 'mon'], blocked, [raceDay])
    if (shakeout1) {
      const s = enforceCap(shakeoutSession(weekN, shakeout1, zones, pace))
      const e0 = s.coach_notes?.[0]
      const strideNote = '4×100m strides at 5K effort, full recovery between.'
      s.coach_notes = e0 ? [e0, strideNote] : [strideNote]
      sessions[shakeout1] = s
    }

    const shakeout2 = firstAvailableDay(['thu', 'fri'], blocked, [raceDay, shakeout1 ?? raceDay])
    if (shakeout2 && input.days_available >= 3) {
      sessions[shakeout2] = enforceCap(shakeoutSession(weekN, shakeout2, zones, pace))
    }

    // CoachingPrinciples §39 — race-week mid-week easy for HM/marathon.
    // 8 km of total non-race volume is too deep a taper; add one slightly
    // longer easy run on a remaining available day.
    const raceWeekEasyKm = (GENERATION_CONFIG.RACE_WEEK_EASY_KM as Record<string, number>)[distKey]
    if (raceWeekEasyKm != null && input.days_available >= 4) {
      const used: Day[] = [raceDay]
      if (shakeout1) used.push(shakeout1)
      if (sessions[shakeout2 as Day]) used.push(shakeout2 as Day)
      const easyDay = firstAvailableDay(['sat', 'fri', 'wed', 'mon', 'tue', 'thu'], blocked, used)
      if (easyDay) {
        sessions[easyDay] = easySession(weekN, easyDay, raceWeekEasyKm, 'distance', zones, pace,
          'Race-week easy', 4,
          ['Conversational. Keep the legs moving without adding fatigue.'])
      }
    }

    return sessions
  }

  // ── Determine which session types to include ──────────────────────────────
  const daysAvailable = Math.min(input.days_available, 7 - blocked.size)
  // distKey is hoisted above the race-week branch for §39 use.

  // Quality count for this week — config-driven (CoachingPrinciples §1, §6, §8).
  // Taper retains intensity per TAPER_QUALITY_PER_WEEK[distKey].
  const fitnessCeiling = GENERATION_CONFIG.QUALITY_SESSIONS_PER_WEEK_MAX[fitness]
  let plannedQuality = 0
  if (phase === 'taper') {
    const taperPhase = phases.find(p => p.name === 'taper')!
    const taperIdx = weekN - taperPhase.start_week
    const arr = GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK[distKey]
    plannedQuality = arr[Math.min(taperIdx, arr.length - 1)] ?? 0
  } else if (phase === 'peak' && !isDeload) {
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
  const qualKmPerSession = weeklyKm * (qualPct / 100)
  const totalQualVol     = includeQualityCount * qualKmPerSession
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
  used.push(longDay)

  // ── 2. Quality session(s) ─────────────────────────────────────────────────
  // Catalogue-driven (spec 3.9). Selection deterministic per (weekN, slotIndex).
  // Falls back to inline label when no catalogue row matches (e.g. 5K/10K taper).
  // Spacing reads from MIN_HOURS_BETWEEN_QUALITY_AND_LONG (spec 3.11).
  const minDaysBetweenQualLong = Math.ceil(GENERATION_CONFIG.MIN_HOURS_BETWEEN_QUALITY_AND_LONG / 24)
  const minDaysBetweenQualities = Math.ceil(GENERATION_CONFIG.MIN_HOURS_BETWEEN_QUALITY / 24)

  if (includeQuality && used.length < daysAvailable) {
    const qualKm = Math.max(roundDist(qualKmPerSession), minDist.quality)
    // CoachingPrinciples §36 — alternate taper category by index so consecutive
    // taper weeks vary their stimulus. Even idx → threshold (default), odd idx
    // → race_specific (sharpener). Race week itself has no quality (§26).
    let preferredCategory = preferredQualityCategory(phase, distKey)
    let taperForceSharpener = false
    if (phase === 'taper') {
      const taperPhase = phases.find(p => p.name === 'taper')!
      const taperIdx = weekN - taperPhase.start_week
      if (taperIdx % 2 === 1) {
        preferredCategory = 'race_specific'
        taperForceSharpener = true
      }
    }

    const qualDay = firstAvailableDay(['wed', 'thu', 'tue'], blocked, used.filter(d => dayGap(d, 'wed') < 2))
      ?? firstAvailableDay(['wed', 'thu', 'tue', 'mon', 'fri'], blocked, used)

    // CoachingPrinciples §21 — knee/ITB/Achilles/shin/calf/plantar history
    // excludes hill sessions in base + build phases. Peak may reintroduce.
    const excludeHillSessions = (phase === 'base' || phase === 'build')
      && (input.injury_history ?? []).some(i =>
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
        cat1 = catalogue.find(r => r.id === 'goal_pace_sharpener'
          && r.distance_eligibility.includes(distKey)
          && (tier !== 'free' || r.is_free_tier)
        ) ?? selectCatalogueSession({
          catalogue, phase, distanceKey: distKey, fitness, tier, weekN, slotIndex: 0, preferredCategory,
          excludeHillSessions,
        })
      } else {
        cat1 = selectCatalogueSession({
          catalogue, phase, distanceKey: distKey, fitness, tier, weekN, slotIndex: 0, preferredCategory,
          excludeHillSessions,
        })
      }
      sessions[qualDay] = makeQualitySession({
        weekN, day: qualDay, distKm: qualKm, metric, zones, pace,
        catalogueRow: cat1, phase, fitness, isDeload, goalPace,
        goalPaceWeek, distLabel: distKey,
      })
      used.push(qualDay)

      // Second quality (peak experienced or per TAPER_QUALITY_PER_WEEK if >1)
      if (qualityCountInPeak > 1 && used.length < daysAvailable) {
        const qual2Day = firstAvailableDay(['tue', 'thu', 'mon'], blocked, used)
        if (qual2Day
          && dayGap(qual2Day, longDay) >= minDaysBetweenQualLong
          && dayGap(qual2Day, qualDay) >= minDaysBetweenQualities) {
          // Second slot prefers a different category for variety: vo2max if first was threshold and vice versa.
          const altCategory: CatalogueCategory = preferredCategory === 'threshold' ? 'vo2max'
            : preferredCategory === 'vo2max' ? 'threshold'
            : preferredCategory
          const cat2 = selectCatalogueSession({
            catalogue, phase, distanceKey: distKey, fitness, tier, weekN, slotIndex: 1, preferredCategory: altCategory,
            excludeHillSessions,
          })
          const secondaryFraction = GENERATION_CONFIG.SECONDARY_QUALITY_PCT_OF_PRIMARY / 100
          sessions[qual2Day] = makeQualitySession({
            weekN, day: qual2Day,
            distKm: Math.max(roundDist(qualKm * secondaryFraction), minDist.secondary_quality),
            metric, zones, pace,
            catalogueRow: cat2, phase, fitness, isDeload, goalPace,
            goalPaceWeek, distLabel: distKey,
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
      if (s.label?.toLowerCase().includes('long') || s.label?.toLowerCase().includes('shakeout')) continue
      const note = '4×20s strides at 5K effort, full recovery between.'
      const e0 = s.coach_notes?.[0]
      const e1 = s.coach_notes?.[1]
      s.coach_notes = e0 && e1 ? [e0, e1, note] : e0 ? [e0, note] : [note]
      break  // one stride run per week
    }
  }

  // ── 5. Honour max_weekday_mins constraint ────────────────────────────────
  // CoachingPrinciples — "Life-first, plan-second". User's stated weekday time
  // limit is a hard cap. If a session placed on a weekday exceeds it, reduce
  // duration to the cap and proportionally reduce distance (pace stays
  // constant). Accepts a slightly lower total weekly volume in exchange for
  // honouring the user's schedule reality. Long runs are typically on weekends
  // so are usually unaffected; if a user picks a weekday long run and the cap
  // would force it below the long-vs-easy invariant, the cap still wins —
  // life > coaching ratio.
  if (input.max_weekday_mins) {
    const weekdays: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri']
    const cap = input.max_weekday_mins
    for (const day of weekdays) {
      const s = sessions[day]
      if (!s || !s.duration_mins || s.duration_mins <= cap) continue
      if (s.type === 'strength' || s.type === 'rest' || s.type === 'race') continue
      const ratio = cap / s.duration_mins
      s.duration_mins = cap
      if (s.distance_km != null) {
        s.distance_km = roundDistance(s.distance_km * ratio)
      }
    }
  }

  return sessions
}

// ─── Week metadata ────────────────────────────────────────────────────────────

function weekLabel(phase: PhaseType, weekN: number, buildWeekN: number, isDeload: boolean): string {
  if (isDeload) return `${capitalise(phase)} — recovery week`
  const labels: Record<PhaseType, string[]> = {
    base:  ['Base — easy start', 'Base — building consistency', 'Base — aerobic development', 'Base — aerobic discipline'],
    build: ['Build — first quality session', 'Build — extending the work', 'Build — raising the ceiling', 'Build — consistency'],
    peak:  ['Peak — highest volume', 'Peak — second peak week', 'Peak — sharpening'],
    taper: ['Taper — trust the work', 'Taper — sharpening', 'Taper — final cut'],
  }
  const options = labels[phase]
  return options[Math.min(buildWeekN - 1, options.length - 1)]
}

function weekTheme(phase: PhaseType, isDeload: boolean): string {
  if (isDeload) return 'Adaptation happens in recovery. This week counts.'
  const themes: Record<PhaseType, string> = {
    base:  'HR discipline. Slower than feels right. That is correct.',
    build: 'One quality session. Everything else stays easy.',
    peak:  'This is where the fitness is built. It will feel hard. That is correct.',
    taper: 'Volume drops. Intensity stays. Trust the work you have done.',
  }
  return themes[phase]
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function computeLongRunHrs(sessions: Partial<Record<Day, Session>>, pace: PaceGuide): number | null {
  for (const session of Object.values(sessions)) {
    if (session?.type === 'easy' && session.label?.toLowerCase().includes('long')) {
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
      if (s && s.type === 'easy' && (s.label?.toLowerCase().includes('long') ?? false)) {
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
function applyLongRunProgressionCap(weeks: Week[], pace: PaceGuide): void {
  const capPct = GENERATION_CONFIG.LONG_RUN_PROGRESSION_CAP_PCT / 100
  const capAbs = GENERATION_CONFIG.LONG_RUN_PROGRESSION_CAP_ABS_KM
  const stepBackTol = 1 + GENERATION_CONFIG.LONG_RUN_DELOAD_STEP_BACK_TOLERANCE_PCT / 100
  const precision = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
  const minLong = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.long

  const findLong = (w: Week): { day: Day; session: Session } | null => {
    for (const [d, s] of Object.entries(w.sessions) as [Day, Session | undefined][]) {
      if (s && s.type === 'easy' && (s.label?.toLowerCase().includes('long') ?? false)) {
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

    // Step-back from a deload — allow up to pre-deload distance × tolerance.
    if (prev.type === 'deload') {
      const preDeloadLR = i >= 2 ? findLong(weeks[i - 2]) : null
      const preKm = preDeloadLR?.session.distance_km
      if (preKm != null && currLR.session.distance_km <= preKm * stepBackTol + 0.01) continue
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
      if (session.type === 'easy' || session.type === 'long' || session.type === 'recovery') {
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
  const planStartDate = parseDateLocal(planStartIso)
  const today = formatDate(new Date())

  // CoachingPrinciples §55 — reject nonsense / out-of-range inputs before
  // any other logic. Distinct from §44 (prep-time) and §50 (HR fallbacks):
  // L-01 rejects values that can't be reasoned about (age:0, resting_hr:0,
  // max_hr:50). Throws InputFieldError.
  validateInputFields(input)

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

  const fitness: FitnessLevel = input.fitness_level
    ?? deriveFitnessLevel(input.current_weekly_km, input.longest_recent_run_km, vdot)

  const rhr = input.resting_hr && input.resting_hr > 0 ? input.resting_hr : undefined
  const pace: PaceGuide = (vdot !== undefined && vdotRaw !== undefined)
    ? buildPaceFromVDOT(vdot, vdotRaw)
    : buildFallbackPace(fitness)

  const goalPace = input.goal === 'time_target' && input.target_time
    ? calcGoalPace(input.race_distance_km, input.target_time)
    : null

  const config = getDistanceConfig(input.race_distance_km)
  const { totalWeeks, compressed } = calcPlanLength(input.race_distance_km, input.race_date, planStartIso)
  const phases = computePhases(totalWeeks, input.race_distance_km)

  const metric: 'distance' | 'duration' =
    fitness === 'beginner' || input.race_distance_km >= 50 ? 'duration' : 'distance'

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
  const trainingAgeIsExperienced = input.training_age === '2-5yr' || input.training_age === '5yr+'
  const heuristicFreshReturn = trainingAgeIsExperienced
    && input.current_weekly_km < GENERATION_CONFIG.HEURISTIC_FRESH_RETURN_WEEKLY_KM
    && input.longest_recent_run_km < GENERATION_CONFIG.HEURISTIC_FRESH_RETURN_LONG_RUN_KM
  const isFreshReturn = explicitFreshReturn || heuristicFreshReturn
  const startKm = isFreshReturn
    ? input.current_weekly_km * GENERATION_CONFIG.FRESH_RETURN_START_FRACTION
    : input.current_weekly_km

  // Recovery cadence — masters (age ≥ 45) recover every 3 weeks (CoachingPrinciples §3).
  // Computed once and shared between volume sequence + week badging so they stay aligned.
  const recoveryFreq = input.age >= GENERATION_CONFIG.MASTERS_AGE_THRESHOLD
    ? GENERATION_CONFIG.RECOVERY_WEEK_FREQUENCY_MASTERS
    : GENERATION_CONFIG.RECOVERY_WEEK_FREQUENCY_STANDARD

  // Fresh-return runners get the standard 10% ramp (no allowance) — their
  // structural base is gone and the cap exists to protect them.
  const returningRunner = !isFreshReturn && isReturningRunner(input, peakKm)
  const { volumes, compressed: capCompressed } = buildVolumeSequence(
    totalWeeks, phases, startKm, peakKm, input.race_distance_km,
    recoveryFreq, returningRunner,
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

  for (let i = 0; i < totalWeeks; i++) {
    const weekN = i + 1
    const phase = getPhaseForWeek(weekN, phases)
    phaseWeekCount[phase]++

    const weekDate = formatDate(addDays(planStartDate, i * 7))
    const isRaceWeek = weekN === totalWeeks
    // Deload cadence is masters-aware (CoachingPrinciples §3) — set once at top
    // of generateRulePlan so volumes and week badges stay aligned.
    const isDeload = !isRaceWeek && weekN % recoveryFreq === 0 && phase !== 'peak' && phase !== 'taper'
    // Recalibration on deload weeks in base/build — fresher legs, good time to benchmark
    const isRecalibration = isDeload && (phase === 'base' || phase === 'build')
    if (isRecalibration) recalibrationWeeks.push(weekN)

    const weeklyKm = volumes[i]
    const prevWeeklyKm = i > 0 ? volumes[i - 1] : startKm

    const { adjustedKm } = applyInjuryAdjustments(weeklyKm, prevWeeklyKm, true, input, phase)

    const sessions = buildWeekSessions(
      weekN, phase, isDeload, isRaceWeek,
      adjustedKm, input, zones, pace, metric, phases,
      tier, catalogue,
      fitness,
      goalPace,
      totalWeeks,
    )

    const longRunHrs = computeLongRunHrs(sessions, pace)
    const actualWeeklyKm = sumWeeklyKm(sessions, pace)

    const weekType: Week['type'] = isRaceWeek ? 'race' : isDeload ? 'deload' : 'normal'
    const badge: Week['badge'] = isRaceWeek ? 'race' : isDeload ? 'deload' : undefined

    // CoachingPrinciples §27 — theme matches prescription. "Where the fitness
    // is built" / "highest volume" themes are misleading when peak weekly_km
    // does not exceed the prior non-deload week. "Intensity stays" themes
    // mislead in taper weeks with no quality session prescribed.
    const qualityCount = Object.values(sessions).filter(s => s?.type === 'quality').length
    const prevNonDeloadWeeklyKm = (() => {
      for (let j = weeks.length - 1; j >= 0; j--) {
        if (weeks[j].type !== 'deload') return weeks[j].weekly_km
      }
      return 0
    })()

    // CoachingPrinciples §27, §41 — theme matches prescription. Effort-
    // language ("It will feel hard") only applies when the runner is actually
    // doing hard work (≥1 quality session). All-easy peak weeks get the
    // consistency framing.
    let theme: string
    if (isRaceWeek) {
      theme = 'The work is done. Arrive rested.'
    } else if (isRecalibration) {
      theme = 'Deload week. Run a parkrun or timed 5K — your result sharpens the zones for the next block.'
    } else if (phase === 'peak' && !isDeload && (planIsMaintenance || actualWeeklyKm <= prevNonDeloadWeeklyKm || qualityCount === 0)) {
      theme = 'Consistency. The work is the volume.'
    } else if (phase === 'taper' && !isDeload && qualityCount === 0) {
      theme = 'Volume drops. Trust the work you have done.'
    } else {
      theme = weekTheme(phase, isDeload)
    }

    weeks.push({
      n: weekN,
      date: weekDate,
      label: isRaceWeek
        ? 'Race week'
        : (planIsMaintenance && phase === 'peak' && !isDeload)
          ? 'Peak — consistency'
          : weekLabel(phase, weekN, phaseWeekCount[phase], isDeload),
      theme,
      type: weekType,
      phase,
      ...(badge ? { badge } : {}),
      sessions,
      long_run_hrs: longRunHrs,
      weekly_km: actualWeeklyKm,
      ...(isRaceWeek ? {
        race_notes: `Race day: ${input.race_name ?? 'Target Race'}. Start at Zone 2. The second half is where the race begins.`,
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
  applyLongRunProgressionCap(weeks, pace)

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
    // Goal-pace overrides (X-pace progression / X-pace intervals / X-pace
    // sharpener) are skipped — they're a coordinated specificity move per
    // §22, not catalogue rotation.
    const isOverride = (label: string): boolean =>
      /^(\w+)-pace (progression|intervals|sharpener)$/.test(label)

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
  const meta: Plan['meta'] = {
    athlete:          input.athlete_name ?? 'Athlete',
    handle:           '',
    race_name:        input.race_name ?? 'Target Race',
    race_date:        input.race_date,
    race_distance_km: input.race_distance_km,
    charity:          '',
    plan_start:       planStartIso,
    quit_date:        '',

    resting_hr:    rhr ?? 0,
    max_hr:        derivedMaxHR,
    zone2_ceiling: zones.zone2Ceiling,

    version:      '2.0',
    last_updated: today,
    notes:        `Standard plan — ${input.race_distance_km}km, ${totalWeeks} weeks`,
    primary_metric: metric,

    fitness_level:             fitness,
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

    // INV-PLAN-008: free plans never carry confidence fields
    tier,
    compressed: compressed || capCompressed,  // OR-combine: too-short plan OR 10%-cap forced

    // CoachingPrinciples §31 — differentiated compression classification.
    // Replaces the bare boolean with persona-aware reasoning.
    compression_classification: ((): 'optimal' | 'appropriate_for_persona' | 'constrained_by_inputs' => {
      if (!compressed && !capCompressed) return 'optimal'
      // Beginner with a finish goal doesn't need more volume — race-day success
      // is reaching the start line healthy. Compression here is appropriate.
      if (fitness === 'beginner' && input.goal === 'finish') return 'appropriate_for_persona'
      return 'constrained_by_inputs'
    })(),

    // CoachingPrinciples §23, §38, §45, §46 — peak overload classification +
    // actionable constraint note. Plans ≥ PEAK_OVERLOAD_MIN_PLAN_WEEKS that fail
    // to reach EITHER:
    //   §23 — peak weekly_km ≥ 110% of W1, OR
    //   §46 — peak weekly_km ≥ marathon/ultra absolute floor (time-targeted), OR
    //   §24 — peak long run ≥ race-distance ratio (when §45 cap has bitten),
    // are surfaced as 'maintenance' with a diagnosis AND a prescription.
    ...(totalWeeks >= GENERATION_CONFIG.PEAK_OVERLOAD_MIN_PLAN_WEEKS
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

          // §24 long-run floor for HM/marathon (time-target only). Test against
          // the actual peak LR after post-passes.
          let longRunFloorKm = 0
          let actualPeakLrKm = 0
          if (isTimeTarget && (distKey === 'HM' || distKey === 'MARATHON')) {
            const ratioCfg = GENERATION_CONFIG.PEAK_LR_RATIO_VS_RACE[distKey]
            longRunFloorKm = distKm * ratioCfg
            for (const wk of weeks) {
              if (wk.phase !== 'peak' || wk.type === 'deload') continue
              for (const s of Object.values(wk.sessions)) {
                if (s && s.type === 'easy' && (s.label?.toLowerCase().includes('long') ?? false)) {
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

          // Build the diagnosis. Multiple failures concatenate.
          const reasons: string[] = []
          if (ratioFails) {
            reasons.push(`Peak volume ${peakKmActual} km is ${Math.round(ratio * 100)}% of week 1 (${w1} km) — below the ${Math.round(GENERATION_CONFIG.PEAK_OVER_BASE_RATIO * 100)}% overload threshold.`)
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
      : {}),

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
  }

  const plan: Plan = { meta, phases, weeks }

  // Constitutional review — verify the plan honours its own coaching principles.
  // In dev, throw on errors so the matrix / property tests fail loudly.
  // In prod, log + return the plan (don't break the user). See lib/plan/invariants.ts.
  const violations = validatePlan(plan, input)
  if (violations.length > 0) {
    const errors = violations.filter(v => v.severity === 'error')
    if (errors.length > 0) {
      const msg = `Plan invariant violations:\n${formatViolations(errors)}`
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        throw new Error(msg)
      }
      console.error(msg)
    }
  }

  return plan
}
