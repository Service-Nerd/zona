// Day-boundary doctrine (CoachingPrinciples §65) — single source of truth
// for "what counts as due" when comparing this-week-so-far against the plan.
//
// The rule: today is in flight until midnight. Don't count it against the
// runner before then.
//
// Two surfaces shipped today (2026-06-19) before this helper existed each
// had the same bug independently: weekly-report's `daysDueByToday` included
// today; CoachScreen's `liveSessionsPlanned` was the whole week. Both made
// the runner read as "behind" at noon when the week was still in progress.
//
// Centralising this stops the third surface inheriting the same bug.

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type DayKey = typeof DAYS[number]

/**
 * Returns the day-keys whose calendar date is strictly past — i.e. due by
 * end of yesterday relative to `now`. Today is excluded; future days are
 * excluded. Used by:
 *   - app/api/weekly-report/route.ts → `daysDueByToday` (slice 0..dayIndex)
 *   - app/dashboard/DashboardClient.tsx → `liveSessionsDueToDate`
 *   - any future surface comparing "what was due" vs "what's done"
 *
 * `weekStartIso` is the plan week's start date — a YYYY-MM-DD string or
 * any value `new Date()` accepts. The helper normalises both endpoints
 * to local midnight before computing the day index.
 *
 * `now` defaults to the current clock and can be overridden in tests.
 */
export function daysDueByEndOfYesterday(
  weekStartIso: string | Date,
  now: Date = new Date(),
): readonly DayKey[] {
  const weekStart = new Date(weekStartIso)
  weekStart.setHours(0, 0, 0, 0)
  const todayMidnight = new Date(now)
  todayMidnight.setHours(0, 0, 0, 0)
  // Strictly past days. No upper cap — slice naturally bounds at array length,
  // so calls made AFTER the plan-week ends (e.g. Monday morning reviewing
  // last week's report) return all 7 keys without special-casing.
  // CoachingPrinciples §65.
  const dayIndex = Math.max(
    Math.floor((todayMidnight.getTime() - weekStart.getTime()) / 86_400_000),
    0,
  )
  return DAYS.slice(0, dayIndex)
}
