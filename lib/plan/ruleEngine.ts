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
  easyPaceStr:     string   // e.g. "6:00–7:15 /km"
  qualityPaceStr:  string   // e.g. "5:10–5:25 /km"
  minPerKmEasy:    number   // midpoint for duration calculations
  minPerKmQuality: number
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

// VDOT training pace fractions (Jack Daniels E/T/I)
// Easy: 59–74% VO2max. Tempo: 83–88%. Interval: 97–100%.
function buildPaceFromVDOT(vdot: number): PaceGuide {
  const eFast = paceAtFraction(vdot, 0.74)  // faster end of easy
  const eSlow = paceAtFraction(vdot, 0.59)  // slower end of easy
  const tFast = paceAtFraction(vdot, 0.88)
  const tSlow = paceAtFraction(vdot, 0.83)
  const eMid  = (eFast + eSlow) / 2
  const tMid  = (tFast + tSlow) / 2
  return {
    easyPaceStr:     `${formatPace(eFast)}–${formatPace(eSlow)} /km`,
    qualityPaceStr:  `${formatPace(tFast)}–${formatPace(tSlow)} /km`,
    minPerKmEasy:    eMid,
    minPerKmQuality: tMid,
    source: 'vdot',
  }
}

function calcVDOTFromBenchmark(b: BenchmarkInput): number {
  const mins = parseBenchmarkTime(b.time)
  return calcVDOT(b.distance_km, mins)
}

// VDOT conservatism (CoachingPrinciples §10) — protects users from training at
// peak race-day output. Default 3% discount; +5% if benchmark > 6 months old.
// Surfaced in plan.meta.vdot_discount_applied_pct so the user can see it.
function applyVdotDiscount(rawVdot: number, b: BenchmarkInput, today: Date): { vdot: number; discountPct: number } {
  let discountPct = GENERATION_CONFIG.VDOT_CONSERVATIVE_DISCOUNT_PCT
  if (b.benchmark_date) {
    const bDate = parseDateLocal(b.benchmark_date)
    const monthsAgo = (today.getTime() - bDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    if (monthsAgo > GENERATION_CONFIG.VDOT_STALE_BENCHMARK_MONTHS) {
      discountPct += GENERATION_CONFIG.VDOT_STALE_BENCHMARK_ADDITIONAL_DISCOUNT_PCT
    }
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

// ─── Pace guides by fitness level (fallback when no benchmark) ─────────────────

const PACE_GUIDE: Record<FitnessLevel, Omit<PaceGuide, 'source'>> = {
  beginner:     { easyPaceStr: '7:30–9:00 /km', qualityPaceStr: '6:30–7:30 /km', minPerKmEasy: 8.0,  minPerKmQuality: 7.0  },
  intermediate: { easyPaceStr: '6:30–7:30 /km', qualityPaceStr: '5:30–6:00 /km', minPerKmEasy: 7.0,  minPerKmQuality: 5.75 },
  experienced:  { easyPaceStr: '5:45–6:45 /km', qualityPaceStr: '4:45–5:20 /km', minPerKmEasy: 6.25, minPerKmQuality: 5.0  },
}

function buildFallbackPace(fitness: FitnessLevel): PaceGuide {
  return { ...PACE_GUIDE[fitness], source: 'fitness_level' }
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
  const lowVolume    = input.current_weekly_km < peakKm * 0.5
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

  const volumes: number[] = []

  // Clamp start to a sensible range relative to peak
  let buildVol = Math.min(Math.max(startKm, peakKm * 0.35), peakKm * 0.85)
  let lastBuildVol = buildVol

  for (let i = 0; i < totalWeeks; i++) {
    const weekN = i + 1
    const phase = getPhaseForWeek(weekN, phases)

    if (phase === 'taper') {
      const taperIdx = weekN - taperPhase.start_week  // 0-indexed within taper
      const preTaper = volumes[taperPhase.start_week - 2] ?? lastBuildVol
      if (weekN === totalWeeks) {
        // Race week: shakeouts only — RACE_WEEK_VOLUME_PCT of pre-taper.
        volumes.push(Math.round(preTaper * GENERATION_CONFIG.RACE_WEEK_VOLUME_PCT / 100))
      } else {
        const stepPct = taperConfig.volume_reduction_pct / fullTaperWeeks
        const reductionPct = stepPct * (taperIdx + 1)
        volumes.push(Math.round(preTaper * (1 - reductionPct / 100)))
      }
    } else {
      const isDeload = weekN % recoveryFreq === 0 && phase !== 'peak'
      if (isDeload) {
        volumes.push(Math.round(lastBuildVol * recoveryPct))
        buildVol = lastBuildVol
      } else {
        const allowance = 1 + allowanceForWeek(weekN) / 100
        const growthFactor = phase === 'peak' ? 1 + (allowance - 1) / 2 : allowance
        buildVol = Math.min(buildVol * growthFactor, peakKm)
        volumes.push(Math.round(buildVol))
        lastBuildVol = buildVol
      }
    }
  }

  // Post-process: enforce week-on-week cap. Drops are exempt; deload weeks
  // themselves are exempt (they intentionally drop); taper weeks are exempt
  // (own logic). After-deload bouncebacks are NOT exempt — this is the
  // primary effect of the cap (CoachingPrinciples §2).
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

  // "Ramp can't fit" check (CoachingPrinciples §2 intent). The plan is
  // compressed-by-volume if peak-phase weeks never reach peakKm — i.e. the
  // cap forced the ramp short of target. Single-week firing in build is
  // expected and not flagged.
  const peakPhase = phases.find(p => p.name === 'peak')
  let compressed = false
  if (peakPhase) {
    const peakReached = volumes.some((v, i) => {
      const wn = i + 1
      return wn >= peakPhase.start_week && wn <= peakPhase.end_week && v >= peakKm * 0.95
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

function blockedDays(input: GeneratorInput): Set<Day> {
  const s = new Set<Day>()
  for (const d of input.days_cannot_train ?? []) {
    const short = FULL_TO_SHORT[d.toLowerCase()]
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

function easySession(
  weekN: number, day: Day,
  distKm: number, metric: 'distance' | 'duration',
  zones: ZoneTargets, pace: PaceGuide,
  label = 'Easy run — Zone 2',
  rpe = 4,
  notes?: Session['coach_notes'],
): Session {
  return {
    id: `w${weekN}-${day}`,
    type: 'easy', label, detail: null,
    ...(metric === 'distance' ? { distance_km: Math.round(distKm * 10) / 10 } : {}),
    duration_mins: dur(distKm, pace.minPerKmEasy),
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
  return {
    id: `w${weekN}-${day}`,
    type: 'easy', label: 'Long run — Zone 2', detail: null,
    ...(metric === 'distance' ? { distance_km: Math.round(distKm * 10) / 10 } : {}),
    duration_mins: dur(distKm, pace.minPerKmEasy),
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
}): Session {
  const { weekN, day, distKm, metric, zones, pace, catalogueRow, phase, fitness, isDeload, goalPace } = args

  // Fallback label if no catalogue row matched (e.g. 5K/10K taper week).
  const fallbackLabel = phase === 'taper' ? 'Tempo run — short'
    : phase === 'peak' && fitness !== 'experienced' ? 'Cruise intervals'
    : 'Tempo run'

  const label = catalogueRow?.name ?? fallbackLabel

  // Coach notes: catalogue voice first; goal-pace augmentation in peak when set.
  const notes: string[] = []
  if (catalogueRow?.coach_voice_notes) notes.push(catalogueRow.coach_voice_notes)
  if (phase === 'peak' && goalPace && !catalogueRow?.coach_voice_notes?.toLowerCase().includes('pace')) {
    notes.push(`Race-pace work. Target: ${goalPace}. Controlled — not all-out.`)
  }
  const coach_notes = notes.length > 0
    ? (notes.slice(0, 3) as [string, string?, string?])
    : undefined

  return {
    id: `w${weekN}-${day}`,
    type: 'quality', label, detail: null,
    ...(metric === 'distance' ? { distance_km: Math.round(distKm * 10) / 10 } : {}),
    duration_mins: dur(distKm, pace.minPerKmQuality),
    primary_metric: metric,
    zone: 'Zone 3–4', hr_target: zones.qualityHR,
    pace_target: pace.qualityPaceStr,
    rpe_target: isDeload ? 6 : 7,
    ...(coach_notes ? { coach_notes } : {}),
    ...(catalogueRow ? {} : {}),  // future: surface catalogue_id when schema permits
  }
}

// Marathon-pace long run (CoachingPrinciples §5 + spec 3.7). Easy-first, then
// MP segment in second half. Uses catalogue voice notes augmented with goal pace.
function mpLongRunSession(
  weekN: number, day: Day, distKm: number,
  metric: 'distance' | 'duration',
  zones: ZoneTargets, pace: PaceGuide,
  catalogueRow: SessionCatalogueRow,
  goalPace: string,
): Session {
  const voice = catalogueRow.coach_voice_notes ?? 'Easy first. Hit goal pace on tired legs.'
  const coach_notes: [string, string?, string?] = [
    voice,
    `Final 30–50% at MP target ${goalPace}.`,
  ]
  return {
    id: `w${weekN}-${day}`,
    type: 'easy',  // long run slot — display contract; SessionType drives card colour
    label: catalogueRow.name,
    detail: null,
    ...(metric === 'distance' ? { distance_km: Math.round(distKm * 10) / 10 } : {}),
    duration_mins: dur(distKm, pace.minPerKmEasy),
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

  // Knee + shin splints: weekly volume cap reduced to 5% (CoachingPrinciples §12 / coaching-rules §12).
  if (hasInjury(input, 'knee') || hasInjury(input, 'shin_splints')) {
    const maxIncrease = prevWeeklyKm * 1.05
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

function applyLongRunCap(distKm: number, durationMins: number, input: GeneratorInput): number {
  // Back + plantar fasciitis: long run capped at 120 min.
  if ((hasInjury(input, 'back') || hasInjury(input, 'plantar_fasciitis')) && durationMins > 120) {
    return 120 / (durationMins / distKm)
  }
  return distKm
}

// ─── Week session layout ──────────────────────────────────────────────────────

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
  goalPace?: string | null,
): Partial<Record<Day, Session>> {
  const blocked = blockedDays(input)
  const fitness = input.fitness_level as FitnessLevel

  if (isRaceWeek) {
    const sessions: Partial<Record<Day, Session>> = {}
    const raceName = input.race_name ?? 'Target Race'
    const raceDay = firstAvailableDay(['sun', 'sat', 'fri', 'thu', 'wed'], blocked) ?? 'sun'
    sessions[raceDay] = raceSession(weekN, raceDay, input.race_distance_km, raceName)

    const shakeout1 = firstAvailableDay(['tue', 'wed', 'mon'], blocked, [raceDay])
    if (shakeout1) sessions[shakeout1] = shakeoutSession(weekN, shakeout1, zones, pace)

    const shakeout2 = firstAvailableDay(['thu', 'fri'], blocked, [raceDay, shakeout1 ?? raceDay])
    if (shakeout2 && input.days_available >= 3) {
      sessions[shakeout2] = shakeoutSession(weekN, shakeout2, zones, pace)
    }

    return sessions
  }

  // ── Determine which session types to include ──────────────────────────────
  const daysAvailable = Math.min(input.days_available, 7 - blocked.size)
  const distKey = raceDistanceKey(input.race_distance_km)

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

  // Strength: in base/build 2/week; peak 1-2; taper 1; deload 1 max
  const strengthTarget = isDeload ? 1
    : phase === 'taper' ? 1
    : phase === 'peak' ? (fitness === 'experienced' ? 2 : 1)
    : 2

  // Hard-session-relationship override
  const adjStrength = input.hard_session_relationship === 'avoid'
    ? Math.min(strengthTarget, 1)
    : strengthTarget

  const sessions: Partial<Record<Day, Session>> = {}
  const used: Day[] = []

  // ── 1. Long run ───────────────────────────────────────────────────────────
  // Phase-aware fraction of weekly volume, per LONG_RUN_PCT_OF_WEEKLY_VOLUME.
  // Week 1–2 cap (CoachingPrinciples §9 / spec 3.6): for the first two weeks
  // of any plan, long run cannot exceed longest_recent_run_km × 1.10.
  // Long-run day preference: Sun by default; user can choose Sat. Falls back to Fri.
  const longDayPref: Day[] = input.preferred_long_run_day === 'sat'
    ? ['sat', 'sun', 'fri']
    : ['sun', 'sat', 'fri']
  const longDay = firstAvailableDay(longDayPref, blocked) ?? 'sun'
  const longRunPct = GENERATION_CONFIG.LONG_RUN_PCT_OF_WEEKLY_VOLUME[phase]
  let longKm = Math.round(weeklyKm * (longRunPct / 100) * 10) / 10
  if (weekN <= 2 && input.longest_recent_run_km > 0) {
    const earlyCap = input.longest_recent_run_km * GENERATION_CONFIG.WEEK_1_2_LONG_RUN_CAP_MULTIPLIER
    if (longKm > earlyCap) longKm = Math.round(earlyCap * 10) / 10
  }
  longKm = applyLongRunCap(longKm, 0, input)

  // Marathon peak: swap the standard long run for an mp_long_run from the
  // catalogue (race-pace specificity, spec 3.7) — only when goal_pace is set.
  if (phase === 'peak' && distKey === 'MARATHON' && goalPace) {
    const mpRow = catalogue.find(r => r.id === 'mp_long_run')
    if (mpRow && (tier !== 'free' || mpRow.is_free_tier)) {
      sessions[longDay] = mpLongRunSession(weekN, longDay, Math.max(longKm, 5), metric, zones, pace, mpRow, goalPace)
    } else {
      sessions[longDay] = longSession(weekN, longDay, Math.max(longKm, 5), metric, zones, pace)
    }
  } else {
    sessions[longDay] = longSession(weekN, longDay, Math.max(longKm, 5), metric, zones, pace)
  }
  used.push(longDay)

  // ── 2. Quality session(s) ─────────────────────────────────────────────────
  // Catalogue-driven (spec 3.9). Selection deterministic per (weekN, slotIndex).
  // Falls back to inline label when no catalogue row matches (e.g. 5K/10K taper).
  // Spacing reads from MIN_HOURS_BETWEEN_QUALITY_AND_LONG (spec 3.11).
  const minDaysBetweenQualLong = Math.ceil(GENERATION_CONFIG.MIN_HOURS_BETWEEN_QUALITY_AND_LONG / 24)
  const minDaysBetweenQualities = Math.ceil(GENERATION_CONFIG.MIN_HOURS_BETWEEN_QUALITY / 24)

  if (includeQuality && used.length < daysAvailable) {
    const qualKm = Math.round(weeklyKm * 0.18 * 10) / 10
    const preferredCategory = preferredQualityCategory(phase, distKey)

    const qualDay = firstAvailableDay(['wed', 'thu', 'tue'], blocked, used.filter(d => dayGap(d, 'wed') < 2))
      ?? firstAvailableDay(['wed', 'thu', 'tue', 'mon', 'fri'], blocked, used)

    if (qualDay && dayGap(qualDay, longDay) >= minDaysBetweenQualLong) {
      const cat1 = selectCatalogueSession({
        catalogue, phase, distanceKey: distKey, fitness, tier, weekN, slotIndex: 0, preferredCategory,
      })
      sessions[qualDay] = makeQualitySession({
        weekN, day: qualDay, distKm: Math.max(qualKm, 5), metric, zones, pace,
        catalogueRow: cat1, phase, fitness, isDeload, goalPace,
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
          })
          sessions[qual2Day] = makeQualitySession({
            weekN, day: qual2Day, distKm: Math.max(Math.round(qualKm * 0.8 * 10) / 10, 4), metric, zones, pace,
            catalogueRow: cat2, phase, fitness, isDeload, goalPace,
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
  const easyCount = daysAvailable - used.length
  const remainingEasyKm = weeklyKm
    - (sessions[longDay]?.distance_km ?? (sessions[longDay]?.duration_mins ?? 0) / pace.minPerKmEasy)
    - (includeQuality ? Math.round(weeklyKm * 0.18) : 0)
  const perEasyKm = easyCount > 0 ? Math.max(remainingEasyKm / easyCount, 4) : 0

  const easyPreferred: Day[] = ['tue', 'thu', 'fri', 'sat', 'mon', 'wed', 'sun']
  for (const day of easyPreferred) {
    if (used.length >= daysAvailable) break
    if (blocked.has(day) || used.includes(day)) continue
    sessions[day] = easySession(weekN, day, Math.round(perEasyKm * 10) / 10, metric, zones, pace)
    used.push(day)
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
    taper: ['Taper — trust the work', 'Race week'],
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
  const pace  = buildPaceFromVDOT(vdot)

  const updated: Plan = JSON.parse(JSON.stringify(plan))
  updated.meta.vdot                       = Math.round(vdot * 10) / 10
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

  // ── Derive max HR, VDOT, fitness level, zones, paces ─────────────────────────
  const derivedMaxHR = input.max_hr ?? tanakaMaxHR(input.age)
  let vdotDiscountPct = 0
  const vdot: number | undefined = (() => {
    if (!input.benchmark) return undefined
    const raw = calcVDOTFromBenchmark(input.benchmark)
    if (!Number.isFinite(raw) || raw <= 0) return undefined
    const { vdot: discounted, discountPct } = applyVdotDiscount(raw, input.benchmark, new Date())
    vdotDiscountPct = discountPct
    return discounted
  })()

  const fitness: FitnessLevel = input.fitness_level
    ?? deriveFitnessLevel(input.current_weekly_km, input.longest_recent_run_km, vdot)

  const rhr = input.resting_hr && input.resting_hr > 0 ? input.resting_hr : undefined
  const zones = computeZones(derivedMaxHR, rhr)
  const pace: PaceGuide = vdot !== undefined
    ? buildPaceFromVDOT(vdot)
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
  const startKm = input.current_weekly_km

  // Recovery cadence — masters (age ≥ 45) recover every 3 weeks (CoachingPrinciples §3).
  // Computed once and shared between volume sequence + week badging so they stay aligned.
  const recoveryFreq = input.age >= GENERATION_CONFIG.MASTERS_AGE_THRESHOLD
    ? GENERATION_CONFIG.RECOVERY_WEEK_FREQUENCY_MASTERS
    : GENERATION_CONFIG.RECOVERY_WEEK_FREQUENCY_STANDARD

  const returningRunner = isReturningRunner(input, peakKm)
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
      goalPace,
    )

    const longRunHrs = computeLongRunHrs(sessions, pace)
    const actualWeeklyKm = sumWeeklyKm(sessions, pace)

    const weekType: Week['type'] = isRaceWeek ? 'race' : isDeload ? 'deload' : 'normal'
    const badge: Week['badge'] = isRaceWeek ? 'race' : isDeload ? 'deload' : undefined

    const theme = isRaceWeek
      ? 'The work is done. Arrive rested.'
      : isRecalibration
        ? 'Deload week. Run a parkrun or timed 5K — your result sharpens the zones for the next block.'
        : weekTheme(phase, isDeload)

    weeks.push({
      n: weekN,
      date: weekDate,
      label: isRaceWeek ? 'Race week' : weekLabel(phase, weekN, phaseWeekCount[phase], isDeload),
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
    })
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

    // VDOT / zone model fields
    age: input.age,
    ...(vdot !== undefined ? { vdot: Math.round(vdot * 10) / 10 } : {}),
    ...(vdotDiscountPct > 0 ? { vdot_discount_applied_pct: vdotDiscountPct } : {}),
    ...(goalPace ? { goal_pace_per_km: goalPace } : {}),
    ...(recalibrationWeeks.length > 0 ? { recalibration_weeks: recalibrationWeeks } : {}),
    ...(input.benchmark ? { benchmark: input.benchmark } : {}),

    // R23 rebuild — returning runner + training age
    ...(input.training_age ? { training_age: input.training_age } : {}),
    ...(returningRunner ? { returning_runner_allowance_active: true } : {}),
  }

  return { meta, phases, weeks }
}
