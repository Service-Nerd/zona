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

/** What the athlete wants from the maintenance period (§75 Layer 5). */
export type MaintenanceIntent = 'rest' | 'tick_over' | 'stay_sharp'

/** Aggregated training response across the completed plan (§75 Layer 3).
 *  Derived from `session_completions` by `aggregatePlanResponse`. */
export interface MaintenancePlanResponse {
  /** Fraction (0–1) of logged sessions tagged Heavy/Wrecked/Cooked. */
  heavyTagFraction: number
  /** Mean logged RPE across the plan, or null if none logged. */
  meanRpe: number | null
  /** Count of logged sessions (confidence — modifiers stay silent below a floor). */
  loggedCount: number
}

const HEAVY_TAGS = new Set(['Heavy', 'Wrecked', 'Cooked'])
const MIN_LOGGED_FOR_RESPONSE = 4  // structural: don't infer a "hard block" from < 4 data points.

/** Pure aggregation of a plan's training response from completion rows.
 *  Route passes the raw rows; this decides the signal. Unit-tested. */
export function aggregatePlanResponse(
  rows: Array<{ rpe: number | null; fatigue_tag: string | null }>,
): MaintenancePlanResponse {
  const tagged = rows.filter(r => r.fatigue_tag)
  const heavy  = tagged.filter(r => HEAVY_TAGS.has(r.fatigue_tag as string)).length
  const rpes   = rows.map(r => r.rpe).filter((v): v is number => v != null)
  return {
    heavyTagFraction: tagged.length ? heavy / tagged.length : 0,
    meanRpe:          rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null,
    loggedCount:      rows.length,
  }
}

// Session types that count as a COMMITTED run day for cadence detection.
// `recovery` is deliberately EXCLUDED: a recovery jog is supplemental easy volume
// the engine layers onto a training week, not a day the athlete commits to running.
// Counting it inflated maintenance frequency above real cadence (a Race-to-Stones
// ultra with 3 committed run days + 1 recovery jog read as 4). §75 wants a
// conservative tick-over, so cadence tracks committed run days only. Strength,
// cross-train and rest are excluded (not runs).
const COMMITTED_RUN_TYPES = new Set(['easy', 'long', 'quality', 'tempo', 'intervals', 'hard', 'run'])

/**
 * §75 — maintenance should match the athlete's actual RUN cadence, not a stale
 * `meta.days_available` (which counts strength/cross-train days too, or may be
 * aspirational). Counts committed run-days per trained week — excluding recovery
 * jogs, strength, cross-train and rest — and returns the LOWER median. Null when
 * the plan has no run data (caller falls back to meta.days_available).
 *
 * Lower median (not upper): a plan whose run-days drift between 3 and 4 across
 * weeks should maintain at the lower, sustainable cadence, not the busier
 * build-week count — again, the conservative-tick-over default of §75.
 */
export function inferRunDaysPerWeek(nonMaintWeeks: Week[]): number | null {
  const counts = nonMaintWeeks
    .filter(w => (w.weekly_km ?? 0) > 0)
    .map(w => Object.values(w.sessions ?? {}).filter(s => s && COMMITTED_RUN_TYPES.has((s as any).type)).length)
    .filter(c => c > 0)
    .sort((a, b) => a - b)
  if (!counts.length) return null
  return counts[Math.floor((counts.length - 1) / 2)]
}

/** Did the athlete find the plan hard? (§75 Layer 3) */
function planWasHard(response: MaintenancePlanResponse | null | undefined): boolean {
  if (!response || response.loggedCount < MIN_LOGGED_FOR_RESPONSE) return false
  const cfg = GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK
  return response.heavyTagFraction >= cfg.RESPONSE_HEAVY_TAG_FRACTION_THRESHOLD
    || (response.meanRpe != null && response.meanRpe >= cfg.RESPONSE_HIGH_RPE_THRESHOLD)
}

interface DurationInputs {
  rpe:                 number | null
  outcome:             string | null
  injured:             boolean
  planResponse:        MaintenancePlanResponse | null | undefined
  recoverySuppressed:  boolean
}

/** Restoration length adapts to the race AND the person: race-day RPE/DNF
 *  (existing), how hard the whole plan was (Layer 3), whether recovery markers
 *  are still off baseline (Layer 4), and injury (Layer 2). Each adds restoration
 *  weeks — the modifiers stack, floored by the distance base. */
function computeDuration(distanceKm: number, d: DurationInputs): MaintenanceDuration {
  const key = raceDistanceKey(distanceKm)
  const cfg = GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK

  let phase1 = cfg.PHASE1_WEEKS_BY_DISTANCE[key]

  // Marathon: race-day RPE selects the upper end of the range.
  if (key === 'MARATHON' && d.rpe != null && d.rpe >= cfg.RPE_BLACKOUT_EXTENSION_THRESHOLD) {
    phase1 = cfg.MARATHON_BLACKOUT_RANGE[1]
  } else if (key === 'MARATHON') {
    phase1 = cfg.MARATHON_BLACKOUT_RANGE[0]
  }

  // Race-day RPE (non-marathon — marathon handled above).
  if (key !== 'MARATHON' && d.rpe != null && d.rpe >= cfg.RPE_BLACKOUT_EXTENSION_THRESHOLD) phase1 += 1
  // DNF.
  if (d.outcome === 'dnf') phase1 += 1
  // Layer 3 — the plan was hard on them across its whole length.
  if (planWasHard(d.planResponse)) phase1 += cfg.RESPONSE_FATIGUE_PHASE1_EXTENSION_WEEKS
  // Layer 4 — RHR/HRV still off baseline right now.
  if (d.recoverySuppressed) phase1 += cfg.SUPPRESSED_RECOVERY_PHASE1_EXTENSION_WEEKS
  // Layer 2 — injury flagged.
  if (d.injured) phase1 += cfg.INJURY_PHASE1_EXTENSION_WEEKS

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
  allowQuality: boolean,   // Layer 2 — false when injured: stay easy-only, no quality return.
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
    // — unless injured (Layer 2), in which case the block stays easy-only.
    if (phase === 'phase2' && weekIndexInPhase >= 1 && isLong && allowQuality) {
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
  /** Plan BASE weekly_km — the sustainable level the athlete built from.
   *  Maintenance anchors here, NOT to plan peak (§75, rev 2026-08-02). */
  baseWeeklyKm: number
  raceDistanceKm: number    // from plan.meta.race_distance_km
  daysAvailable: number     // from plan.meta.days_available or default 4
  // ── Person & circumstance (§75 Layers 2–5). All optional — absent = neutral. ──
  injuryHistory?: string[]                       // Layer 2 — plan.meta.injury_history
  planResponse?: MaintenancePlanResponse | null  // Layer 3 — aggregated session_completions
  recoverySuppressed?: boolean                   // Layer 4 — RHR/HRV still off baseline
  intent?: MaintenanceIntent                     // Layer 5 — default 'tick_over'
}

export function generateMaintenanceBlock(opts: MaintenanceBlockOptions): Week[] {
  const {
    raceResult, lastRaceWeek, baseWeeklyKm, raceDistanceKm, daysAvailable,
    injuryHistory, planResponse, recoverySuppressed = false, intent = 'tick_over',
  } = opts
  const isDnf   = raceResult.outcome === 'dnf'
  const rpe     = raceResult.rpe ?? null
  const injured = (injuryHistory ?? []).length > 0
  const cfg     = GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK

  const { phase1Weeks, phase2Weeks } = computeDuration(raceDistanceKm, {
    rpe, outcome: raceResult.outcome ?? null, injured, planResponse, recoverySuppressed,
  })

  // ── Volume, anchored to BASE and scaled by intent (§75 Layers 1 + 5) ──────────
  // Phase 2 target = base × tick-over% × intent-multiplier, clamped to base.
  const intentMult      = cfg.INTENT_VOLUME_MULTIPLIER[intent]
  const phase2TargetPct = Math.min(cfg.PHASE2_VOLUME_PCT_OF_BASE * intentMult, cfg.VOLUME_CEILING_PCT_OF_BASE)
  const phase2VolKm     = parseFloat((baseWeeklyKm * phase2TargetPct / 100).toFixed(1))
  // Restoration ramps linearly from a low start up to the Phase 2 target.
  const startPct        = Math.min(cfg.RESTORATION_START_PCT_OF_BASE, phase2TargetPct)
  const restorationVolKm = (i: number): number => {
    const pct = phase1Weeks <= 1
      ? phase2TargetPct
      : startPct + (phase2TargetPct - startPct) * (i / (phase1Weeks - 1))
    return parseFloat((baseWeeklyKm * pct / 100).toFixed(1))
  }
  // Injured → easy-only, no quality return anywhere in the block (Layer 2).
  const allowQuality = !injured

  const weeks: Week[] = []
  let baseN    = lastRaceWeek.n + 1
  let baseDate = addWeeks(lastRaceWeek.date, 1)

  // Phase 1 — restoration
  for (let i = 0; i < phase1Weeks; i++) {
    const volKm = restorationVolKm(i)
    weeks.push({
      n: baseN + i,
      date: addWeeks(baseDate, i),
      label: `Maintenance ${i + 1}`,
      theme: phase1Theme(i, isDnf),
      type: 'normal',
      phase: 'maintenance_restoration',
      weekly_km: volKm,
      long_run_hrs: null,
      sessions: buildSessions(volKm, daysAvailable, 'phase1', i, isDnf, allowQuality),
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
      sessions: buildSessions(phase2VolKm, daysAvailable, 'phase2', i, isDnf, allowQuality),
    })
  }

  // Constitutional check — throws in dev/test, logs in prod (mirrors generateRulePlan)
  const violations = validateMaintenanceBlock(weeks, baseWeeklyKm, injured, daysAvailable)
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
