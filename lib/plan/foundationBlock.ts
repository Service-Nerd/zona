// FREE — infrastructure
// Foundation Block generator (CoachingPrinciples §57)
//
// A pre-plan preparation phase inserted before Week 1 when the gap between
// today and plan_start is large enough to warrant structured preparation.
// Foundation weeks carry `phase: 'foundation'` and negative `n` values
// (e.g. -2, -1, 0 for a 3-week block). Week 1 of the main plan is always n=1.

import { GENERATION_CONFIG, raceDistanceKey, type RaceDistanceKey } from './generationConfig'
import { validateRecoveryOpeningBlock } from './invariants'
import type { GeneratorInput } from '@/types/plan'
import type { Week } from '@/types/plan'

// ── Gap classification ─────────────────────────────────────────────────────

export type GapClass =
  | 'none'       // < 7 days — nudge only, no block
  | 'auto'       // 7–28 days — auto-generate silently
  | 'choice'     // > 28 days — surface three-option modal

export function classifyGap(gapDays: number): GapClass {
  if (gapDays < GENERATION_CONFIG.FOUNDATION_GAP_NUDGE_DAYS) return 'none'
  if (gapDays <= GENERATION_CONFIG.FOUNDATION_GAP_AUTO_DAYS) return 'auto'
  return 'choice'
}

export function gapDays(today: string, planStart: string): number {
  const t = new Date(today)
  const s = new Date(planStart)
  return Math.max(0, Math.floor((s.getTime() - t.getTime()) / 86_400_000))
}

// ── Effective baseline ─────────────────────────────────────────────────────
// When fresh_return_active, stated volume is aspirational — scale down.

export function effectiveBaseline(input: GeneratorInput): number {
  const fresh = (input.weeks_at_current_volume ?? Infinity) < GENERATION_CONFIG.FRESH_RETURN_WEEKS_THRESHOLD
  return fresh
    ? input.current_weekly_km * GENERATION_CONFIG.FRESH_RETURN_EFFECTIVE_BASELINE_FRACTION
    : input.current_weekly_km
}

// ── Foundation week count ──────────────────────────────────────────────────
// Clamps to FOUNDATION_MAX_WEEKS regardless of gap length.

export function foundationWeekCount(gapDays: number): number {
  const rawWeeks = Math.floor(gapDays / 7)
  return Math.min(rawWeeks, GENERATION_CONFIG.FOUNDATION_MAX_WEEKS)
}

// ── Foundation week themes ─────────────────────────────────────────────────

const THEMES: Record<number, string> = {
  1: 'Shake the rust off.',
  2: 'Building the base.',
  3: 'Last week before the plan proper. Keep it easy.',
}

function themeForPosition(position: number, total: number): string {
  if (total === 1) return THEMES[3]
  if (position === 1) return THEMES[1]
  if (position === total) return THEMES[3]
  return THEMES[2]
}

// ── Session builder ────────────────────────────────────────────────────────
// Foundation weeks: easy runs on training days + rest days.
// Long run placed on the last available training day (usually Sat/Sun).

const DEFAULT_DAYS: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'> = [
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
]

function buildFoundationSessions(
  weeklyKm: number,
  longRunKm: number,
  daysAvailable: number,
  blockedDays: string[],
): Week['sessions'] {
  const blocked = new Set(blockedDays)
  const trainingDays = DEFAULT_DAYS.filter(d => !blocked.has(d)).slice(0, daysAvailable)
  const sessions: Week['sessions'] = {}

  // Place long run on the last training day
  const longDay = trainingDays[trainingDays.length - 1]
  if (longDay) {
    sessions[longDay] = {
      type: 'easy',
      label: 'Long easy',
      detail: `${longRunKm.toFixed(1)}km easy — Zone 2 throughout. No exceptions.`,
      distance_km: longRunKm,
      zone: 'Zone 2',
      coach_notes: ['This is your longest run of the week. Keep it slow.'],
    }
  }

  // Distribute remaining km across other training days
  const otherDays = trainingDays.slice(0, -1)
  const remainingKm = Math.max(0, weeklyKm - longRunKm)
  const eachKm = otherDays.length > 0 ? Math.max(3, remainingKm / otherDays.length) : 0

  for (const day of otherDays) {
    sessions[day] = {
      type: 'easy',
      label: 'Easy run',
      detail: `${eachKm.toFixed(1)}km easy — Zone 2. Conversational pace.`,
      distance_km: parseFloat(eachKm.toFixed(1)),
      zone: 'Zone 2',
      coach_notes: ['Zone 2 only. If you can\'t hold a conversation, slow down.'],
    }
  }

  // Rest days get no entry (absence = rest in the plan schema)
  return sessions
}

// ── Main generator ─────────────────────────────────────────────────────────

export interface FoundationBlockOptions {
  input: GeneratorInput
  planStartDate: string  // ISO date — first day of Week 1
  today: string          // ISO date — used for gap calculation
  /** Override week count (e.g. after user selects "Add Foundation Block") */
  forceWeeks?: number
}

export interface FoundationBlockResult {
  weeks: Week[]
  /** True if fresh_return baseline fraction was applied */
  freshReturnActive: boolean
  effectiveBaselineKm: number
}

export function generateFoundationBlock(opts: FoundationBlockOptions): FoundationBlockResult {
  const { input, planStartDate, today, forceWeeks } = opts

  const gap = gapDays(today, planStartDate)
  const weekCount = forceWeeks ?? foundationWeekCount(gap)

  const baseline = effectiveBaseline(input)
  const freshReturnActive = baseline < input.current_weekly_km

  // Cap long run at the lesser of longest_recent_run_km and 50% of weekly_km
  const maxLongRunByHistory = input.longest_recent_run_km ?? (baseline * 0.5)

  const weeks: Week[] = []
  for (let i = 0; i < weekCount; i++) {
    const position = i + 1
    // Volume: W1 = effective baseline, each subsequent week may grow by ≤ +10%.
    // Hard ceiling: effective_baseline × 1.10 (applied to every week, not just final).
    const maxCeiling = baseline * (1 + GENERATION_CONFIG.FOUNDATION_WEEKLY_INCREASE_PCT / 100)
    const weeklyKm = parseFloat(
      Math.min(
        baseline * Math.pow(1 + GENERATION_CONFIG.FOUNDATION_WEEKLY_INCREASE_PCT / 100, i),
        maxCeiling,
      ).toFixed(1),
    )

    const longRunCap = weeklyKm * (GENERATION_CONFIG.FOUNDATION_LONG_RUN_MAX_PCT / 100)
    const longRunKm = parseFloat(
      Math.min(maxLongRunByHistory, longRunCap).toFixed(1),
    )

    // Week index: count down from -(weekCount-1) to 0
    const weekN = i - weekCount  // e.g. for 3 weeks: -3, -2, -1 → but spec says ≤ 0

    // Compute the ISO date for this foundation week's start
    const weekStartDate = new Date(planStartDate)
    weekStartDate.setDate(weekStartDate.getDate() - (weekCount - i) * 7)

    const sessions = buildFoundationSessions(
      weeklyKm,
      longRunKm,
      input.days_available ?? 4,
      input.days_cannot_train ?? [],
    )

    weeks.push({
      n: weekN,
      date: weekStartDate.toISOString().split('T')[0],
      label: `Foundation ${position}`,
      theme: themeForPosition(position, weekCount),
      type: 'normal',
      phase: 'foundation',
      sessions,
      long_run_hrs: longRunKm > 0 ? parseFloat((longRunKm / (input.current_weekly_km > 0 ? 8 : 6)).toFixed(2)) : null,
      weekly_km: weeklyKm,
    })
  }

  return { weeks, freshReturnActive, effectiveBaselineKm: baseline }
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE-05 — Post-race recovery gating (CoachingPrinciples §76)
//
// A recovery-opening block prepended before Week 1 when the athlete completed a
// race within a distance-keyed recency window. Structurally identical to the
// Foundation Block (easy-only, ramped, `phase:'foundation'`, negative `n`,
// prepended client-side) — it reuses `buildFoundationSessions` — but it is
// triggered by a recent race, opens from a deliberately low fraction of current
// volume, and its depth reuses the §62 post-race blackout table. It takes
// PRECEDENCE over the ordinary Foundation Block: recovery IS the ease-in.
// ═══════════════════════════════════════════════════════════════════════════

export function daysSince(today: string, date: string): number {
  return Math.floor((new Date(today).getTime() - new Date(date).getTime()) / 86_400_000)
}

export interface RecentRaceRecovery {
  /** True when a recent-enough race gates the plan's opening weeks. */
  gates: boolean
  /** Number of recovery-opening weeks to prepend (0 when !gates). */
  weeks: number
  distKey?: RaceDistanceKey
}

/** The race an active post-race maintenance block (MAINT-01) is recovering from. */
export interface ActiveMaintenanceRace {
  date: string        // plan.meta.race_date of the plan carrying the maintenance block
  distanceKm: number  // plan.meta.race_distance_km
}

// Cross-plan match tolerances — structural (dedup), not coaching numerics.
// A recent race "is" the maintenance block's race when distance and date line up.
const RACE_MATCH_DIST_TOLERANCE = 0.1  // ±10%
const RACE_MATCH_DAY_TOLERANCE  = 7    // ±7 days

/**
 * Decide whether a recently-completed race gates the opening weeks, and how many
 * recovery weeks to prepend. Pure — no I/O, no Date.now (today is passed in).
 *
 * Depth = the §62 quality-blackout weeks for the race distance, plus an effort
 * extension for a faded/DNF race, MINUS whole weeks already elapsed since the
 * race (the recovery clock started at the finish line, not at generation), with
 * a floor of 1 so a gated plan always opens with at least one easy week.
 */
export function classifyRecentRace(
  input: GeneratorInput,
  today: string,
  activeMaintenanceRace?: ActiveMaintenanceRace | null,
): RecentRaceRecovery {
  const { last_race_date, last_race_distance_km, last_race_effort } = input
  if (!last_race_date || !last_race_distance_km || last_race_distance_km <= 0) {
    return { gates: false, weeks: 0 }
  }

  // Cross-plan de-dup (§76): if an active post-race maintenance block is already
  // recovering from this same race, prepending an opening trough would double-
  // count recovery. Suppress. (The elapsed-weeks discount below already handles
  // calendar time; this handles the case where a MAINT-01 block explicitly owns it.)
  if (
    activeMaintenanceRace
    && Math.abs(last_race_distance_km - activeMaintenanceRace.distanceKm) <= activeMaintenanceRace.distanceKm * RACE_MATCH_DIST_TOLERANCE
    && Math.abs(daysSince(last_race_date, activeMaintenanceRace.date)) <= RACE_MATCH_DAY_TOLERANCE
  ) {
    return { gates: false, weeks: 0 }
  }

  const elapsed = daysSince(today, last_race_date)
  if (elapsed < 0) return { gates: false, weeks: 0 }  // future-dated — ignore

  const distKey = raceDistanceKey(last_race_distance_km)
  const within  = GENERATION_CONFIG.RECENT_RACE_RECOVERY_TRIGGER[distKey].within_days
  if (elapsed > within) return { gates: false, weeks: 0 }

  const baseWeeks = GENERATION_CONFIG.POST_RACE_RECOVERY_BY_DISTANCE[distKey].quality_blackout_weeks
  const extension = (last_race_effort === 'faded' || last_race_effort === 'dnf')
    ? GENERATION_CONFIG.RECENT_RACE_EFFORT_BLACKOUT_EXTENSION_WEEKS
    : 0
  const elapsedWeeks = Math.floor(elapsed / 7)
  const weeks = Math.max(1, baseWeeks + extension - elapsedWeeks)
  return { gates: true, weeks, distKey }
}

const RECOVERY_THEMES = {
  first: 'Post-race recovery. Easy only — the legs are still rebuilding.',
  mid:   'Still absorbing. Keep it easy.',
  last:  'Last easy week before the plan proper.',
}

function recoveryTheme(position: number, total: number): string {
  if (total === 1 || position === 1) return RECOVERY_THEMES.first
  if (position === total) return RECOVERY_THEMES.last
  return RECOVERY_THEMES.mid
}

export interface RecoveryOpeningBlockOptions {
  input: GeneratorInput
  planStartDate: string  // ISO date — first day of Week 1
  /** Week count from classifyRecentRace(). */
  weeks: number
}

export interface RecoveryOpeningBlockResult {
  weeks: Week[]
}

/**
 * Build the recovery-opening weeks. Volume anchors to `current_weekly_km` (there
 * is no plan peak yet at the opening), starting at RECOVERY_OPENING_START_FRACTION
 * and ramping up at FOUNDATION_WEEKLY_INCREASE_PCT/week, never exceeding current
 * volume — the block eases the athlete back to baseline, it does not build.
 */
export function generateRecoveryOpeningBlock(opts: RecoveryOpeningBlockOptions): RecoveryOpeningBlockResult {
  const { input, planStartDate, weeks: weekCount } = opts

  const baseline = input.current_weekly_km * GENERATION_CONFIG.RECOVERY_OPENING_START_FRACTION
  // Cap long run at the lesser of recent longest run and 50% of the (reduced)
  // baseline — no long efforts while the tissue is still remodelling.
  const maxLongRunByHistory = Math.min(input.longest_recent_run_km ?? (baseline * 0.5), baseline * 0.5)

  const weeks: Week[] = []
  for (let i = 0; i < weekCount; i++) {
    const position = i + 1
    const grown    = baseline * Math.pow(1 + GENERATION_CONFIG.FOUNDATION_WEEKLY_INCREASE_PCT / 100, i)
    const weeklyKm = parseFloat(Math.min(grown, input.current_weekly_km).toFixed(1))

    const longRunCap = weeklyKm * (GENERATION_CONFIG.FOUNDATION_LONG_RUN_MAX_PCT / 100)
    const longRunKm  = parseFloat(Math.min(maxLongRunByHistory, longRunCap).toFixed(1))

    const weekN = i - weekCount  // negative n, same convention as foundation

    const weekStartDate = new Date(planStartDate)
    weekStartDate.setDate(weekStartDate.getDate() - (weekCount - i) * 7)

    const sessions = buildFoundationSessions(
      weeklyKm,
      longRunKm,
      input.days_available ?? 4,
      input.days_cannot_train ?? [],
    )

    weeks.push({
      n: weekN,
      date: weekStartDate.toISOString().split('T')[0],
      label: `Recovery ${position}`,
      theme: recoveryTheme(position, weekCount),
      type: 'normal',
      phase: 'foundation',
      sessions,
      long_run_hrs: longRunKm > 0 ? parseFloat((longRunKm / 8).toFixed(2)) : null,
      weekly_km: weeklyKm,
    })
  }

  // Constitutional check — throws in dev/test, logs in prod (mirrors maintenance).
  const violations = validateRecoveryOpeningBlock(weeks, input.current_weekly_km)
  if (violations.length > 0) {
    const msg = violations.map(v => `[${v.severity.toUpperCase()}] ${v.code} week ${v.week}: ${v.message}`).join('\n')
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      throw new Error(`Recovery-opening block invariant violations:\n${msg}`)
    } else {
      console.error('[recovery-opening] invariant violations:', msg)
    }
  }

  return { weeks }
}
