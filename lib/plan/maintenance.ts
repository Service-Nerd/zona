// FREE — infrastructure (AI coaching voice is PAID, gated by maintenance_coaching)
// Post-race maintenance block generator (CoachingPrinciples §75, MAINT-01)
//
// Activates after the plan's final race week when the race result has been logged.
// Appends maintenance weeks to plan.weeks — same schema, same Today-screen rendering.
// No new DB tables. Rule-engine only; AI enricher optionally adds coaching voice.

import { GENERATION_CONFIG, raceDistanceKey } from './generationConfig'
import { addDays, formatDate } from './length'
import { validateMaintenanceBlock } from './invariants'
import type { Week, RaceResult, Session } from '@/types/plan'

// ── Phase themes ──────────────────────────────────────────────────────────────

const PHASE1_THEMES = [
  'Restore. Nothing more.',
  'Do nothing. It helps.',
  'The body\'s still accounting.',
]

const PHASE2_THEMES = [
  'Back to base.',
  'Keeping it ticking.',
  'Nothing to prove right now.',
]

const PHASE3_THEME = 'Still here. When you\'re ready.'

const DNF_THEME = 'Recover anyway.'

function phase1Theme(weekIndex: number, isDnf: boolean): string {
  if (isDnf && weekIndex === 0) return DNF_THEME
  return PHASE1_THEMES[weekIndex % PHASE1_THEMES.length]
}

function phase2Theme(weekIndexInPhase: number, totalPhase2: number): string {
  const phase3Start = Math.max(0, totalPhase2 - GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK.PHASE3_LAST_WEEKS)
  if (weekIndexInPhase >= phase3Start) return PHASE3_THEME
  return PHASE2_THEMES[weekIndexInPhase % PHASE2_THEMES.length]
}

// ── Duration calculation ──────────────────────────────────────────────────────

interface MaintenanceDuration {
  phase1Weeks: number
  phase2Weeks: number
}

function computeDuration(distanceKm: number, rpe: number | null, outcome: string | null): MaintenanceDuration {
  const key = raceDistanceKey(distanceKm)
  const cfg = GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK

  let phase1 = cfg.PHASE1_WEEKS_BY_DISTANCE[key]

  // Marathon: RPE modifier selects upper end of range
  if (key === 'MARATHON' && rpe != null && rpe >= cfg.RPE_BLACKOUT_EXTENSION_THRESHOLD) {
    phase1 = cfg.MARATHON_BLACKOUT_RANGE[1]
  } else if (key === 'MARATHON') {
    phase1 = cfg.MARATHON_BLACKOUT_RANGE[0]
  }

  // RPE modifier: +1 week Phase 1 (non-marathon — marathon already handled above)
  if (key !== 'MARATHON' && rpe != null && rpe >= cfg.RPE_BLACKOUT_EXTENSION_THRESHOLD) {
    phase1 += 1
  }

  // DNF modifier: +1 week Phase 1
  if (outcome === 'dnf') {
    phase1 += 1
  }

  return { phase1Weeks: phase1, phase2Weeks: cfg.PHASE2_WEEKS_BY_DISTANCE[key] }
}

// ── Session builder ───────────────────────────────────────────────────────────

const TRAINING_DAYS: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'> = [
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
]

function buildEasySession(distKm: number, coachNote: string, label = 'Easy run'): Session {
  return {
    type: 'easy',
    label,
    detail: `${distKm.toFixed(1)}km easy — Zone 2 throughout. Conversational pace.`,
    distance_km: distKm,
    zone: 'Zone 2',
    coach_notes: [coachNote],
  }
}

function buildRestSession(): Session {
  return { type: 'rest', label: 'Rest', detail: 'Rest day.' }
}

function buildMildQualitySession(distKm: number): Session {
  return {
    type: 'easy',
    label: 'Easy with strides',
    detail: `${distKm.toFixed(1)}km easy with 4×20s strides. Zone 2 bulk, strides feel easy-fast.`,
    distance_km: distKm,
    zone: 'Zone 2',
    coach_notes: ['First quality work since the race. Keep it mild.'],
  }
}

function buildSessions(
  weeklyKm: number,
  daysAvailable: number,
  phase: 'phase1' | 'phase2',
  weekIndexInPhase: number,
  isDnf: boolean,
): Week['sessions'] {
  const sessions: Week['sessions'] = {}
  const trainingDayCount = Math.min(daysAvailable, 5)
  // Rest days: Tue + Sun always; training fills Mon, Wed, Fri, Sat (then Thu if >4 days)
  const preferredTraining: typeof TRAINING_DAYS = ['mon', 'wed', 'fri', 'sat', 'thu']
  const trainingDays = preferredTraining.slice(0, trainingDayCount)
  const restDays = TRAINING_DAYS.filter(d => !trainingDays.includes(d))

  const perDayKm = parseFloat((weeklyKm / trainingDayCount).toFixed(1))
  const longerKm = parseFloat((weeklyKm * GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK.PHASE2_LONG_DAY_PCT / 100).toFixed(1))
  const shortKm  = parseFloat(((weeklyKm - longerKm) / (trainingDayCount - 1)).toFixed(1))

  const easyNote = isDnf
    ? 'The body doesn\'t know what it didn\'t finish. Recover anyway.'
    : 'Zone 2 only. If you\'re questioning whether to slow down, you should.'

  for (const day of trainingDays) {
    const isLong = day === 'sat' || day === trainingDays[trainingDayCount - 1]
    const km = isLong ? Math.max(longerKm, perDayKm) : shortKm

    // Phase 2 from week 2 onwards: last training day gets a mild quality session
    if (phase === 'phase2' && weekIndexInPhase >= 1 && isLong) {
      sessions[day] = buildMildQualitySession(km)
    } else {
      sessions[day] = buildEasySession(km, easyNote, isLong ? 'Long easy' : 'Easy run')
    }
  }

  for (const day of restDays) {
    sessions[day] = buildRestSession()
  }

  return sessions
}

// ── Week date helper ──────────────────────────────────────────────────────────

function addWeeks(isoDate: string, weeks: number): string {
  return formatDate(addDays(new Date(isoDate), weeks * 7))
}

// ── Main generator ────────────────────────────────────────────────────────────

export interface MaintenanceBlockOptions {
  raceResult: RaceResult
  lastRaceWeek: Week        // for n and date
  peakWeeklyKm: number      // plan's highest weekly_km
  raceDistanceKm: number    // from plan.meta.race_distance_km
  daysAvailable: number     // from plan.meta.days_available or default 4
}

export function generateMaintenanceBlock(opts: MaintenanceBlockOptions): Week[] {
  const { raceResult, lastRaceWeek, peakWeeklyKm, raceDistanceKm, daysAvailable } = opts
  const isDnf = raceResult.outcome === 'dnf'
  const rpe   = raceResult.rpe ?? null

  const { phase1Weeks, phase2Weeks } = computeDuration(raceDistanceKm, rpe, raceResult.outcome ?? null)

  const cfg = GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK
  const recoveryCfg = GENERATION_CONFIG.POST_RACE_RECOVERY_BY_DISTANCE
  const distKey = raceDistanceKey(raceDistanceKm)
  const recoveryCurve = recoveryCfg[distKey].volume_curve_pct
  const phase2VolKm = parseFloat((peakWeeklyKm * cfg.PHASE2_VOLUME_PCT_OF_PEAK / 100).toFixed(1))

  const weeks: Week[] = []
  let baseN    = lastRaceWeek.n + 1
  let baseDate = addWeeks(lastRaceWeek.date, 1)

  // Phase 1 — restoration
  for (let i = 0; i < phase1Weeks; i++) {
    const pct   = recoveryCurve[Math.min(i, recoveryCurve.length - 1)]
    const volKm = parseFloat((peakWeeklyKm * pct / 100).toFixed(1))

    weeks.push({
      n: baseN + i,
      date: addWeeks(baseDate, i),
      label: `Maintenance ${i + 1}`,
      theme: phase1Theme(i, isDnf),
      type: 'normal',
      phase: 'maintenance_restoration',
      weekly_km: volKm,
      long_run_hrs: null,
      sessions: buildSessions(volKm, daysAvailable, 'phase1', i, isDnf),
    })
  }

  baseN    += phase1Weeks
  baseDate  = addWeeks(baseDate, phase1Weeks)

  // Phase 2 — base (includes Phase 3 ambient re-engagement in last PHASE3_LAST_WEEKS)
  for (let i = 0; i < phase2Weeks; i++) {
    weeks.push({
      n: baseN + i,
      date: addWeeks(baseDate, i),
      label: `Maintenance ${phase1Weeks + i + 1}`,
      theme: phase2Theme(i, phase2Weeks),
      type: 'normal',
      phase: 'maintenance_base',
      weekly_km: phase2VolKm,
      long_run_hrs: null,
      sessions: buildSessions(phase2VolKm, daysAvailable, 'phase2', i, isDnf),
    })
  }

  // Constitutional check — throws in dev/test, logs in prod (mirrors generateRulePlan)
  const violations = validateMaintenanceBlock(weeks, peakWeeklyKm)
  if (violations.length > 0) {
    const msg = violations.map(v => `[${v.severity.toUpperCase()}] ${v.code} week ${v.week}: ${v.message}`).join('\n')
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      throw new Error(`Maintenance block invariant violations:\n${msg}`)
    } else {
      console.error('[maintenance] invariant violations:', msg)
    }
  }

  return weeks
}
