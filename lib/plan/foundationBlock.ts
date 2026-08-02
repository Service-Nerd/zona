// FREE — infrastructure
// Foundation Block generator (CoachingPrinciples §57)
//
// A pre-plan preparation phase inserted before Week 1 when the gap between
// today and plan_start is large enough to warrant structured preparation.
// Foundation weeks carry `phase: 'foundation'` and negative `n` values
// (e.g. -2, -1, 0 for a 3-week block). Week 1 of the main plan is always n=1.

import { GENERATION_CONFIG } from './generationConfig'
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
