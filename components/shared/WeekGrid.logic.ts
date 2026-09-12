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

export const WEEKDAYS: readonly DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri']

/**
 * Minutes available on a given day. UX-WIZARD-01 step 1.
 *
 * Sparse ON PURPOSE: a day absent from this map has no OVERRIDE, not a budget of
 * zero. `?? 0` on a missing budget is the `distance_km ?? 0` mistake in a new
 * costume — "unknown" read as "none" — which cost this repo four silent passes
 * (SESSION-KM-02). Absent means "use the weekday default".
 */
export type DayBudgets = Partial<Record<DayKey, number>>

export interface WeekInputs {
  daysAvailable: number
  restShort: DayKey[]      // days_cannot_train (short keys; caller maps to wire words)
  longDay: 'sat' | 'sun' | null  // preferred_long_run_day; null if none marked
  /**
   * `max_weekday_mins` — the engine's existing single global cap, DERIVED here
   * so the grid and the cap have one owner instead of two.
   *
   * It is the MINIMUM across the weekdays the runner actually runs, because that
   * is what the engine's cap means today: a ceiling every weekday session is
   * trimmed to. A runner with 30 minutes on Tuesday and 90 on Thursday resolves
   * to 30 — which is precisely the loss UX-WIZARD-01 exists to stop (measured
   * 2026-09-12: 22.1% mean peak volume at a 30-minute cap). Deriving it here
   * rather than at the call site is what lets step 2 replace the MINIMUM with
   * per-day sizing without hunting for a second derivation.
   *
   * `undefined` = no limit, matching the existing "No limit" chip.
   */
  maxWeekdayMins: number | undefined
}

/**
 * The wizard's one engine touch: grid → GeneratorInput-facing values.
 *
 * `weekdayDefaultMins` is the single chip the runner picks for "a weekday";
 * `dayBudgets` overrides it per day. Both optional — omit them and this behaves
 * exactly as it did before UX-WIZARD-01, which is what keeps every stored plan
 * and every API caller that sends only `max_weekday_mins` working unchanged.
 */
export function weekPlanToInputs(
  plan: WeekPlan,
  weekdayDefaultMins?: number,
  dayBudgets?: DayBudgets,
): WeekInputs {
  const restShort: DayKey[] = []
  let longDay: 'sat' | 'sun' | null = null
  let daysAvailable = 0
  for (const d of WEEK_DAYS) {
    if (plan[d] === 'rest') restShort.push(d)
    else daysAvailable++
    if (plan[d] === 'long') longDay = d === 'sat' ? 'sat' : 'sun'
  }

  // Only weekdays the runner actually RUNS can constrain a weekday cap. A rest
  // day carrying a stale budget from an earlier edit must not drag the cap down.
  const running = WEEKDAYS.filter(d => plan[d] !== 'rest')
  const mins = running
    .map(d => dayBudgets?.[d] ?? weekdayDefaultMins)
    .filter((m): m is number => typeof m === 'number' && Number.isFinite(m) && m > 0)

  return {
    daysAvailable,
    restShort,
    longDay,
    // No running weekday (a weekend-only week) → fall back to the stated default
    // rather than `undefined`. It changes nothing the runner sees — there is no
    // weekday session to cap — but it keeps the value byte-identical to what the
    // pre-UX-WIZARD-01 call site passed, so `verify:parity` stays a real signal
    // instead of reporting a diff that means nothing.
    maxWeekdayMins: mins.length > 0 ? Math.min(...mins) : weekdayDefaultMins,
  }
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

/**
 * Tap-to-cycle a single day's budget, mirroring `cycleDay` above so the two
 * controls share one idiom: the runner already learned "tap it again" on the
 * grid directly above this row.
 *
 * The cycle ends by returning to ABSENT (rendered "Same"), never to a number —
 * so clearing an override is always reachable by tapping, and the sparse model
 * stays expressible in the UI. A day is removed from the map rather than set to
 * a sentinel, because a sentinel is how "unknown" starts meaning "zero".
 */
export function cycleDayBudget(
  budgets: DayBudgets,
  day: DayKey,
  options: readonly number[],
): DayBudgets {
  const out: DayBudgets = { ...budgets }
  const cur = out[day]
  if (cur == null) {
    const first = options[0]
    if (first != null) out[day] = first
    return out
  }
  const i = options.indexOf(cur)
  const next = i >= 0 ? options[i + 1] : options[0]
  if (next == null) delete out[day]
  else out[day] = next
  return out
}

/**
 * Drop overrides for days that are no longer run, or are not weekdays.
 *
 * Without this, editing the grid AFTER setting budgets leaves orphans: mark
 * Tuesday rest and its 30-minute budget lingers invisibly. `weekPlanToInputs`
 * already ignores those when deriving the cap, so this is not a correctness
 * fix — it is so what the runner is shown and what is stored agree, and so a
 * re-marked day does not silently inherit a budget they set a week ago.
 */
export function pruneDayBudgets(budgets: DayBudgets, plan: WeekPlan): DayBudgets {
  const out: DayBudgets = {}
  for (const d of WEEKDAYS) {
    const v = budgets[d]
    if (v != null && plan[d] !== 'rest') out[d] = v
  }
  return out
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
