// DATE-DST-01 — whole-calendar-day arithmetic, DST-proof.
//
// The single owner (D-08) of "how many whole days / weeks between these two
// dates". Every caller that used to write `(b - a) / 86_400_000` and floor it
// reads this instead.
//
// ⚠️ WHY THIS EXISTS, because the naive version looks obviously correct.
// Two LOCAL midnights across a spring-forward DST boundary are 24n − 1 hours
// apart, not 24n. The millisecond quotient therefore comes out a fraction
// SHORT and `Math.floor` silently drops a day. On a span that is an exact
// multiple of seven, that dropped day is a dropped WEEK.
//
// Measured 2026-09-21: every plan whose start→race span crossed 2027-03-28
// generated ONE WEEK SHORT of what was asked for. That included all nine
// published `/plans/*` pages, which state their week count in the H1, the
// <title> and the slug: for eleven weeks of every year `/plans/5k-12-week`
// rendered eleven weeks under the words "12 Weeks". `computePlanLength` works
// in whole weeks (Monday to Monday), so an exact multiple of seven is not an
// edge case there, it is the normal case. Nothing crashed, nothing logged, and
// the fault heals itself in April.
//
// `Date.UTC(y, m, d)` has no DST, so differencing the two calendar dates in
// that frame is exact. `Math.round` then costs nothing and guards against any
// caller that hands us a Date carrying a time component.

/** A calendar date: a `YYYY-MM-DD` string, any other string `Date` accepts, or a `Date`. */
export type DateLike = string | Date

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Normalise to a `Date` whose LOCAL y/m/d are the calendar date meant.
 *
 * A bare `YYYY-MM-DD` is parsed as local midnight, never handed to
 * `new Date(string)` — that parses date-only strings as UTC midnight, which in
 * any negative-offset zone reads back as the PREVIOUS calendar day.
 */
function toLocalDate(v: DateLike): Date {
  if (v instanceof Date) return v
  if (DATE_ONLY.test(v)) {
    const [y, m, d] = v.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(v)
}

/** Whole calendar days from `start` to `end`. Negative when `end` precedes `start`. */
export function calendarDaysBetween(start: DateLike, end: DateLike): number {
  const a = toLocalDate(start)
  const b = toLocalDate(end)
  return Math.round(
    (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
      - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86_400_000,
  )
}

/** Whole calendar weeks from `start` to `end`, rounded down. */
export function calendarWeeksBetween(start: DateLike, end: DateLike): number {
  return Math.floor(calendarDaysBetween(start, end) / 7)
}
