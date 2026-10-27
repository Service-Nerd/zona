// OVERRUN-NOTE-ALL-01 (2026-10-26) — the ONE owner of "this weekday session does not fit the time you set".
//
// §81's obligation is "the plan says when they don't fit". SESSION-ACHIEVABLE-01 (2026-10-06) built it inside the
// structured-session branch only, so §82's floor-protected easy runs — held at the 4 km floor while their duration
// follows the runner's pace — overran silently: measured 7,627 sessions on the slow-goal grid, worst +20 min, and a
// live runner's Friday 52 min against 30. The note also said "you set for weekdays" when the limit was the DAY's own
// (per-day budgets, UX-WIZARD-01). Founder-approved words, 2026-10-26.

import { formatDuration } from '@/lib/format'
import { DAY_FULL_NAME, type Day } from './days'
import { isLongRun, isStructuredSession } from './sessionRole'
import { sessionFloorsFor } from './sessionFloors'
import { GENERATION_CONFIG } from './generationConfig'
import type { Week } from '@/types/plan'

type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri'

/** The limit for this day, and whether the runner set it for the day itself or for every weekday. */
export function weekdayBudgetFor(
  input: { day_budgets?: Partial<Record<Weekday, number>> | null; max_weekday_mins?: number | null },
  day: string,
): { cap: number; perDay: boolean } | null {
  const own = input.day_budgets?.[day as Weekday]
  if (own != null) return { cap: own, perDay: true }
  if (input.max_weekday_mins != null) return { cap: input.max_weekday_mins, perDay: false }
  return null
}


/** "Wednesdays" when the limit is the day's own, "weekdays" when it is the single weekday limit. */
function whenSet(day: string, perDay: boolean): string {
  return perDay ? `${DAY_FULL_NAME[day as Day]}s` : 'weekdays'
}

/** Is the session being shown on the day it was planned for? The note names THAT day's limit, so a moved session
 *  (planned `key` ≠ shown date's weekday) must not show it: it would quote the wrong limit, or call a Saturday
 *  "your weekday". `shownAt` is the ISO timestamp the screens carry; absent means "not moved". */
export function overrunNoteApplies(plannedDay: string, shownAt: string | Date | null | undefined): boolean {
  if (!shownAt) return true
  // A date-only string is a LOCAL date: `new Date('2026-10-20')` is UTC midnight, the previous weekday west of Greenwich.
  const d = typeof shownAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(shownAt)
    ? new Date(+shownAt.slice(0, 4), +shownAt.slice(5, 7) - 1, +shownAt.slice(8, 10)) : new Date(shownAt)
  return Number.isNaN(d.getTime()) || ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getDay()] === plannedDay
}

/** Why it is longer: §82's floor (easy), §81's exemption for a structured session (quality) or for the long run (long).
 *  Founder-approved 2026-10-26. ⚠️ A runner with a PER-DAY limit is offered no "raise" lever: the only control,
 *  "Weekday time limit" in Adjust your plan, does not reach per-day limits (MODIFY-WEEKDAY-INERT-01), and §40c's lever
 *  must be real. Null when either duration cannot be formatted (ADR-015's owner returns null): no note beats "NaN". */
export function weekdayOverrunNote(a: { minutes: number; cap: number; day: string; perDay: boolean; kind: 'quality' | 'easy' | 'long' }): string | null {
  const m = formatDuration(a.minutes), c = formatDuration(a.cap)
  if (m == null || c == null) return null
  const head = `About ${m} against the ${c} you set for ${whenSet(a.day, a.perDay)}. `
  const why = a.kind === 'easy' ? 'Any shorter and it stops being a training run, so take it on a day with more room'
    : a.kind === 'long' ? 'The long run is not cut to fit, so take it on a day with more room'
    : 'Quality work is not shrunk to fit the clock, so take this one on a day with more room'
  return a.perDay ? `${head}${why}.` : `${head}${why}, or raise your weekday time limit in Adjust your plan.`
}


/**
 * The ONE producer of `weekday_overrun_note`: on every weekday session longer than its day, the note, worded from the
 * FINAL minutes; on every session that fits, none. Called where a plan is finished — the tail of `generateRulePlan`
 * and `composePlanWithFoundation` (ADR-020) — never mid-generation.
 *
 * 🔴 WHY HERE AND NOT IN `applyWeekdayMinsCap`: that pass is commented "the weekday cap runs LAST", and it does not —
 * the adequacy block and the run-walk stamp run after it. Stamped there, a note recorded 32 minutes on a run a later
 * step brought to 30 (46 sweep plans), and three hand-written stamp sites (structured, §82 floor, foundation weeks)
 * were the three places the obligation had already been missed twice. Exempt exactly as `INV-PLAN-WEEKDAY-OVERRUN-
 * DECLARED` is: race week, strength / rest / race sessions, a session with no duration.
 */
export function reconcileWeekdayOverrunNotes(
  weeks: readonly Week[],
  input: { day_budgets?: Partial<Record<Weekday, number>> | null; max_weekday_mins?: number | null; longest_recent_run_km?: number | null },
): void {
  // No early return when there is no limit: a note left from an earlier limit must still be cleared.
  const easyFloor = sessionFloorsFor(input.longest_recent_run_km ?? undefined).easy
  for (const w of weeks) {
    const raceWeek = w.type === 'race' || (w as { badge?: string }).badge === 'race'
    for (const d of ['mon', 'tue', 'wed', 'thu', 'fri'] as const) {
      const s = (w.sessions as Record<string, any>)?.[d]
      if (!s) continue
      const budget = weekdayBudgetFor(input, d)
      // The long run IS owed one: the structured-exemption branch always stamped it (§81 exempts both).
      const owed = !raceWeek && budget != null && !!s.duration_mins && s.duration_mins > budget.cap
        && s.type !== 'strength' && s.type !== 'rest' && s.type !== 'race'
      // The words follow WHY it is long, and say nothing when no reason fits: a false sentence is worse than the
      // check flagging a missing one. §82's floor (only when the run is AT OR ABOVE the floor, or §82 Am. 2's held run
      // at exactly EASY_FLOOR_HELD_MINS, which IS the floor below 4 km; any other run below the floor gets no sentence),
      // the long run, or §81's structured exemption. Measured on 9,255 cases: 22,974 structured, 7,627 at-floor, 0 else.
      const kind = s.floor_protected && ((s.distance_km ?? 0) >= easyFloor || (s.distance_km != null && s.duration_mins === GENERATION_CONFIG.EASY_FLOOR_HELD_MINS)) ? 'easy'
        : isLongRun(s) ? 'long' : isStructuredSession(s) ? 'quality' : null
      const note = owed && kind ? weekdayOverrunNote({ minutes: s.duration_mins, cap: budget!.cap, day: d, perDay: budget!.perDay, kind }) : null
      if (note) s.weekday_overrun_note = note
      else delete s.weekday_overrun_note
    }
  }
}
