// WeekGrid — pure logic (no JSX/React), node-testable (see vitest.config.ts).
// The keystone "your week" control's model: a per-day Rest/Run/Long plan, the
// tap-to-cycle transition, and — critically — the mapping from the grid to the
// existing GeneratorInput fields (days_available, days_cannot_train,
// preferred_long_run_day). That mapping is the wizard's one engine touch, so it
// lives here as a pure function and is tested exhaustively (silent-mapping is a
// known Zonna failure class).

import type { DayKey } from './DayGridSelector.logic'
export type { DayKey }

export type DayState = 'rest' | 'run' | 'long'
export type WeekPlan = Record<DayKey, DayState>

export const WEEK_DAYS: readonly DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

// First ship: the long run may only sit on a weekend day — matches the current
// engine's preferred_long_run_day contract (Sat/Sun). Weekday-long-run lands
// with the preferred_long_run_day widening (separate fast-follow, Light Board).
export const LONG_ELIGIBLE: readonly DayKey[] = ['sat', 'sun']

export function emptyWeek(): WeekPlan {
  return { mon: 'rest', tue: 'rest', wed: 'rest', thu: 'rest', fri: 'rest', sat: 'rest', sun: 'rest' }
}

// A friendly anchor for a fresh wizard — a common 4-day recreational week, Sun
// long. The user adjusts; anchoring beats an empty grid that blocks on open.
export function defaultWeek(): WeekPlan {
  return { mon: 'run', tue: 'rest', wed: 'run', thu: 'rest', fri: 'run', sat: 'rest', sun: 'long' }
}

/**
 * Tap-to-cycle a day. Weekday: rest ↔ run. Weekend: rest → run → long → rest.
 * Only one long across the week — marking a new long demotes any prior long to run.
 */
export function cycleDay(plan: WeekPlan, day: DayKey): WeekPlan {
  const cur = plan[day]
  const eligible = LONG_ELIGIBLE.includes(day)
  const next: DayState =
    cur === 'rest' ? 'run'
    : cur === 'run' ? (eligible ? 'long' : 'rest')
    : 'rest' // 'long' → rest
  const out: WeekPlan = { ...plan, [day]: next }
  if (next === 'long') {
    for (const d of WEEK_DAYS) if (d !== day && out[d] === 'long') out[d] = 'run'
  }
  return out
}

export interface WeekInputs {
  daysAvailable: number
  restShort: DayKey[]      // days_cannot_train (short keys; caller maps to wire words)
  longDay: 'sat' | 'sun' | null  // preferred_long_run_day; null if none marked
}

/** The wizard's one engine touch: grid → GeneratorInput-facing values. */
export function weekPlanToInputs(plan: WeekPlan): WeekInputs {
  const restShort: DayKey[] = []
  let longDay: 'sat' | 'sun' | null = null
  let daysAvailable = 0
  for (const d of WEEK_DAYS) {
    if (plan[d] === 'rest') restShort.push(d)
    else daysAvailable++
    if (plan[d] === 'long') longDay = d === 'sat' ? 'sat' : 'sun'
  }
  return { daysAvailable, restShort, longDay }
}

/**
 * Reconstruct a plan from the pre-grid separate fields, for draft back-compat.
 * A legacy draft with rest days set restores them; a legacy draft that only had
 * a day COUNT (no explicit rest days) can't place specific days, so it restores
 * as the default week — graceful, low-stakes (drafts are single-session).
 */
export function weekPlanFromLegacy(
  restShort: readonly DayKey[],
  longDay: 'sat' | 'sun' | null,
): WeekPlan {
  if (restShort.length === 0 && !longDay) return defaultWeek()
  const restSet = new Set(restShort)
  const plan = emptyWeek()
  for (const d of WEEK_DAYS) plan[d] = restSet.has(d) ? 'rest' : 'run'
  if (longDay && plan[longDay] === 'run') plan[longDay] = 'long'
  return plan
}

export type DayThreshold = { block: number; ok: number }
export interface CountVerdict { state: 'blocked' | 'warn' | 'ok'; hint: string | null }

/**
 * Block/warn/ok for a selected-day count against a distance's thresholds.
 * Re-keyed from the old per-button count to the grid's derived day count.
 * `warn` (time goal below the recommended count) still proceeds — matches the
 * pre-grid behaviour where the warn zone was treated as ok for finish goals.
 */
export function dayCountVerdict(
  count: number,
  thr: DayThreshold | null,
  distanceLabel: string | null,
  isTimeGoal: boolean,
): CountVerdict {
  if (!thr) return { state: 'ok', hint: null }
  if (count < thr.block) {
    return { state: 'blocked', hint: `Not enough for a ${distanceLabel}. Needs ${thr.block}+ days.` }
  }
  if (count < thr.ok && isTimeGoal) {
    return { state: 'warn', hint: `Will train for completion, not time. Recommended: ${thr.ok} days.` }
  }
  return { state: 'ok', hint: null }
}
