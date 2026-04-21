// FREE — rule engine
// Deterministic plan generator. Zero AI calls. Same inputs always produce the same structure.
// Enrichment (labels, coaching voice, confidence score) is layered on top in lib/plan/enrich.ts.
// This file owns all numeric values: distances, durations, zones, HR targets.

import type { GeneratorInput, Plan, Week, Session } from '@/types/plan'
import type { Phase } from '@/types/plan'
import {
  getDistanceConfig, calcPlanLength, nextMonday,
  formatDate, addDays, parseDateLocal,
} from './length'

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
  easyPaceStr:    string
  qualityPaceStr: string
  minPerKmEasy:   number
  minPerKmQuality: number
}

// ─── Zone computation (Karvonen formula) ─────────────────────────────────────

function computeZones(rhr: number, mhr: number): ZoneTargets {
  const hrr = mhr - rhr
  const z2 = Math.round(rhr + 0.60 * hrr)
  const z3lo = Math.round(rhr + 0.65 * hrr)
  const z4hi = Math.round(rhr + 0.82 * hrr)
  const z4lo = Math.round(rhr + 0.75 * hrr)
  return {
    zone2Ceiling: z2,
    easyHR:       `< ${z2} bpm`,
    qualityHR:    `${z3lo}–${z4hi} bpm`,
    intervalsHR:  `${z4lo}–${mhr} bpm`,
  }
}

// ─── Pace guides by fitness level ─────────────────────────────────────────────

const PACE_GUIDE: Record<FitnessLevel, PaceGuide> = {
  beginner:     { easyPaceStr: '7:30–9:00 /km', qualityPaceStr: '6:30–7:30 /km', minPerKmEasy: 8.0,  minPerKmQuality: 7.0  },
  intermediate: { easyPaceStr: '6:30–7:30 /km', qualityPaceStr: '5:30–6:00 /km', minPerKmEasy: 7.0,  minPerKmQuality: 5.75 },
  experienced:  { easyPaceStr: '5:45–6:45 /km', qualityPaceStr: '4:45–5:20 /km', minPerKmEasy: 6.25, minPerKmQuality: 5.0  },
}

// ─── Phase distribution ───────────────────────────────────────────────────────

function computePhases(totalWeeks: number, distanceKm: number): Phase[] {
  const config = getDistanceConfig(distanceKm)
  const taperWeeks = config.taperWeeks
  const peakWeeks = Math.max(2, Math.floor(totalWeeks * 0.15))
  const remaining = totalWeeks - taperWeeks - peakWeeks
  const baseWeeks = Math.max(2, Math.floor(remaining * 0.42))
  const buildWeeks = Math.max(1, remaining - baseWeeks)

  // Clamp so phases don't overlap when totalWeeks is very small
  const baseEnd = baseWeeks
  const buildEnd = baseWeeks + buildWeeks
  const peakEnd = buildEnd + peakWeeks
  const taperEnd = totalWeeks

  return [
    { name: 'base',  start_week: 1,           end_week: baseEnd  },
    { name: 'build', start_week: baseEnd + 1,  end_week: buildEnd },
    { name: 'peak',  start_week: buildEnd + 1, end_week: peakEnd  },
    { name: 'taper', start_week: peakEnd + 1,  end_week: taperEnd },
  ]
}

function getPhaseForWeek(weekN: number, phases: Phase[]): PhaseType {
  return (phases.find(p => weekN >= p.start_week && weekN <= p.end_week)?.name ?? 'base') as PhaseType
}

// ─── Weekly volume sequence ───────────────────────────────────────────────────

function buildVolumeSequence(
  totalWeeks: number,
  phases: Phase[],
  startKm: number,
  peakKm: number,
): number[] {
  const taperPhase = phases.find(p => p.name === 'taper')!
  const volumes: number[] = []

  // Clamp start to a sensible range relative to peak
  let buildVol = Math.min(Math.max(startKm, peakKm * 0.35), peakKm * 0.85)
  let lastBuildVol = buildVol

  for (let i = 0; i < totalWeeks; i++) {
    const weekN = i + 1
    const phase = getPhaseForWeek(weekN, phases)

    if (phase === 'taper') {
      const taperIdx = weekN - taperPhase.start_week // 0-indexed within taper
      const preTaper = volumes[taperPhase.start_week - 2] ?? lastBuildVol
      if (weekN === totalWeeks) {
        // Race week: bare minimum
        volumes.push(Math.round(preTaper * 0.18))
      } else {
        volumes.push(Math.round(preTaper * Math.pow(0.65, taperIdx + 1)))
      }
    } else {
      const isDeload = weekN % 4 === 0 && phase !== 'peak'
      if (isDeload) {
        volumes.push(Math.round(lastBuildVol * 0.75))
        buildVol = lastBuildVol // restart from pre-deload level
      } else {
        const growthFactor = phase === 'peak' ? 1.05 : 1.10
        buildVol = Math.min(buildVol * growthFactor, peakKm)
        volumes.push(Math.round(buildVol))
        lastBuildVol = buildVol
      }
    }
  }

  return volumes
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
): { adjustedKm: number; allowQuality: boolean } {
  let km = weeklyKm
  let quality = allowQuality

  if (hasInjury(input, 'knee')) {
    const maxIncrease = prevWeeklyKm * 1.05
    km = Math.min(km, maxIncrease)
  }
  if (hasInjury(input, 'achilles')) {
    quality = false
  }

  return { adjustedKm: km, allowQuality: quality }
}

function applyLongRunCap(distKm: number, durationMins: number, input: GeneratorInput): number {
  if (hasInjury(input, 'back') && durationMins > 120) {
    return 120 / (durationMins / distKm)
  }
  return distKm
}

// ─── Week session layout ──────────────────────────────────────────────────────

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

  // Quality: intermediate/experienced, build or peak phase — achilles injury and 'avoid' preference both suppress it
  const wantsQuality = fitness !== 'beginner'
    && (phase === 'build' || phase === 'peak')
    && input.hard_session_relationship !== 'avoid'
    && !hasInjury(input, 'achilles')

  const includeQuality = wantsQuality && !isDeload
  const qualityCountInPeak = (phase === 'peak' && fitness === 'experienced' && !isDeload) ? 2 : 1

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
  const longDay = firstAvailableDay(['sun', 'sat', 'fri'], blocked) ?? 'sun'
  const longKm = applyLongRunCap(
    Math.round(weeklyKm * (phase === 'taper' ? 0.40 : 0.28) * 10) / 10,
    0, // duration not needed for cap check here — use km as proxy
    input,
  )
  sessions[longDay] = longSession(weekN, longDay, Math.max(longKm, 5), metric, zones, pace)
  used.push(longDay)

  // ── 2. Quality session(s) ─────────────────────────────────────────────────
  if (includeQuality && used.length < daysAvailable) {
    const qualKm = Math.round(weeklyKm * 0.18 * 10) / 10
    const qualLabelMap: Record<PhaseType, string> = {
      base:  'Tempo run',
      build: 'Tempo run',
      peak:  fitness === 'experienced' ? 'Tempo run' : 'Cruise intervals',
      taper: 'Tempo run — short',
    }
    const qualDay = firstAvailableDay(['wed', 'thu', 'tue'], blocked, used.filter(d => dayGap(d, 'wed') < 2))
    ?? firstAvailableDay(['wed', 'thu', 'tue', 'mon', 'fri'], blocked, used)

    if (qualDay && dayGap(qualDay, longDay) >= 2) {
      sessions[qualDay] = qualitySession(
        weekN, qualDay,
        Math.max(qualKm, 5), metric, zones, pace,
        qualLabelMap[phase],
        isDeload ? 6 : 7,
      )
      used.push(qualDay)

      // Second quality for experienced in peak
      if (qualityCountInPeak > 1 && used.length < daysAvailable) {
        const qual2Day = firstAvailableDay(['tue', 'thu', 'mon'], blocked, used)
        if (qual2Day && dayGap(qual2Day, longDay) >= 2 && dayGap(qual2Day, qualDay) >= 2) {
          sessions[qual2Day] = qualitySession(
            weekN, qual2Day,
            Math.max(Math.round(qualKm * 0.8 * 10) / 10, 4), metric, zones, pace,
            'Cruise intervals', 7,
          )
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

export function generateRulePlan(input: GeneratorInput, tier: Tier, planStart?: string): Plan {
  const planStartIso = planStart ?? formatDate(nextMonday())
  const planStartDate = parseDateLocal(planStartIso)
  const today = formatDate(new Date())

  const config = getDistanceConfig(input.race_distance_km)
  const { totalWeeks, compressed } = calcPlanLength(input.race_distance_km, input.race_date, planStartIso)
  const phases = computePhases(totalWeeks, input.race_distance_km)
  const zones = computeZones(input.resting_hr, input.max_hr)
  const fitness = input.fitness_level as FitnessLevel
  const pace = PACE_GUIDE[fitness]

  const metric: 'distance' | 'duration' =
    fitness === 'beginner' || input.race_distance_km >= 50 ? 'duration' : 'distance'

  const peakKm = config.peakKmByLevel[fitness]
  const startKm = input.current_weekly_km

  const volumes = buildVolumeSequence(totalWeeks, phases, startKm, peakKm)

  // ── Build weeks ─────────────────────────────────────────────────────────────
  const weeks: Week[] = []
  const taperPhase = phases.find(p => p.name === 'taper')!

  // Track phase-local week count for labels
  const phaseWeekCount: Record<PhaseType, number> = { base: 0, build: 0, peak: 0, taper: 0 }

  for (let i = 0; i < totalWeeks; i++) {
    const weekN = i + 1
    const phase = getPhaseForWeek(weekN, phases)
    phaseWeekCount[phase]++

    const weekDate = formatDate(addDays(planStartDate, i * 7))
    const isRaceWeek = weekN === totalWeeks
    const isDeload = !isRaceWeek && weekN % 4 === 0 && phase !== 'peak'

    const weeklyKm = volumes[i]
    const prevWeeklyKm = i > 0 ? volumes[i - 1] : startKm

    // applyInjuryAdjustments handles volume (knee cap). Quality suppression is handled inside buildWeekSessions.
    const { adjustedKm } = applyInjuryAdjustments(weeklyKm, prevWeeklyKm, true, input)

    const sessions = buildWeekSessions(
      weekN, phase, isDeload, isRaceWeek,
      adjustedKm, input, zones, pace, metric, phases,
    )

    const longRunHrs = computeLongRunHrs(sessions, pace)
    const actualWeeklyKm = sumWeeklyKm(sessions, pace)

    const weekType: Week['type'] = isRaceWeek ? 'race' : isDeload ? 'deload' : 'normal'
    const badge: Week['badge'] = isRaceWeek ? 'race' : isDeload ? 'deload' : undefined

    weeks.push({
      n: weekN,
      date: weekDate,
      label: isRaceWeek ? 'Race week' : weekLabel(phase, weekN, phaseWeekCount[phase], isDeload),
      theme: isRaceWeek ? 'The work is done. Arrive rested.' : weekTheme(phase, isDeload),
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

    resting_hr:    input.resting_hr,
    max_hr:        input.max_hr,
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
    compressed,
  }

  return { meta, phases, weeks }
}
