// LEDGER-01 — "Weeks within the lines" discipline ledger.
//
// Doctrine: a counter, not a streak. Eyal investment + Sutherland reframe —
// the user builds a number that represents restraint, not volume. Resets
// silently to zero on break. No notifications. No flames. No urgency.
//
// Free criteria (per ISO Mon→Sun week):
//   - ≥ MIN_COMPLETION_PCT of planned sessions in that week have
//     session_completions.status='complete'.
//   - No fatigue_tag in ('Heavy','Wrecked') across that week's completions.
//   - No quality session skipped (status='skipped' on a session_type in the
//     quality family — quality / tempo / intervals / hard).
//
// Paid criteria:
//   - Free criteria all hold.
//   - Median `run_analysis.hr_in_zone_pct` across that week's analysed runs
//     ≥ MIN_ZONE_DISCIPLINE_PCT.
//
// Computed lazily on Me-screen open — no cron, no table. The function below
// is the single source of truth.

import type { Plan, Week } from '@/types/plan'

export interface LedgerInput {
  /** Pulled from supabase by the caller. We don't fetch here — keeps the
   *  module pure and unit-testable without a DB. */
  plan: Plan | null
  /** session_completions rows for the user, last ~16 weeks. */
  completions: Array<{
    week_n: number
    session_day: string
    status: string | null
    fatigue_tag: string | null
  }>
  /** run_analysis rows for the user, last ~16 weeks. PAID only — pass [] for free tier. */
  analyses: Array<{
    week_n: number
    hr_in_zone_pct: number | string | null
  }>
  /** Active tier — drives which criteria apply. */
  tier: 'free' | 'trial' | 'paid'
  /** Reference date — typically now(). Determines which week_n is "this week"
   *  and is therefore in the pending bucket. */
  asOfDate: Date
}

export interface LedgerOutcome {
  /** Consecutive completed weeks meeting the criteria, ending at the most
   *  recent fully-judged week (i.e. excluding the current in-flight week). */
  weeksWithinLines: number
  /** State of the in-flight week. `'pending'` until the week ends or breaks. */
  currentWeekStatus: 'on_track' | 'broken' | 'pending'
  /** True when the ledger advanced *this* week — i.e. the just-completed
   *  week pushed the counter up by one. Drives DOCTRINE-01's conditional
   *  brand-statement surface on SessionCompleteCard. */
  advancedThisWeek: boolean
}

// Tunable constants. Live here (not in lib/coaching/constants.ts) until a
// shared coaching constants pass — keeps the module self-contained while
// the doctrine is being validated.
export const LEDGER_FREE_MIN_COMPLETION_PCT = 0.75
export const LEDGER_PAID_MIN_ZONE_DISCIPLINE_PCT = 75 // run_analysis.hr_in_zone_pct is 0–100, not 0–1

const QUALITY_FAMILY = new Set(['quality', 'tempo', 'intervals', 'hard'])
const DOW_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

// Determine the week_n that contains `asOfDate`. Plan weeks carry a `date`
// (Monday of that week, ISO). We walk forward from week 1.
function currentWeekN(plan: Plan, asOfDate: Date): number | null {
  if (!plan?.weeks?.length) return null
  const target = asOfDate.getTime()
  // Sort ascending by date, just to be safe (plans should already be).
  const weeks = [...plan.weeks].sort((a, b) =>
    new Date((a as any).date).getTime() - new Date((b as any).date).getTime(),
  )
  for (const w of weeks) {
    const start = new Date((w as any).date).getTime()
    const end   = start + 7 * 24 * 60 * 60 * 1000
    if (target >= start && target < end) return w.n
  }
  return null
}

// Count planned non-rest sessions in the given week (rest days don't earn
// or lose ledger credit — they're not "sessions").
function plannedSessionCount(week: Week): number {
  let count = 0
  for (const key of DOW_KEYS) {
    const s = week.sessions?.[key]
    if (s && s.type !== 'rest') count += 1
  }
  return count
}

// Sessions in this week that the engine considers "quality-family" — used
// to detect a skipped quality session, which breaks the ledger immediately.
function qualitySessionDays(week: Week): string[] {
  const days: string[] = []
  for (const key of DOW_KEYS) {
    const s = week.sessions?.[key]
    if (s && QUALITY_FAMILY.has(s.type)) days.push(key)
  }
  return days
}

// Numeric median with simple even/odd handling. Returns null on empty input.
function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// Did the in-flight week already break? Mid-week, only the immediate-break
// criteria apply — completion ratio doesn't lock in until the week ends.
// Returns true if a break signal has already landed; false if the week is
// still on track. (Pending = "still on track" — caller decides display.)
function currentWeekBroken(
  week: Week,
  completions: LedgerInput['completions'],
): boolean {
  const weekCompletions = completions.filter(c => c.week_n === week.n)
  if (weekCompletions.some(c => c.fatigue_tag === 'Heavy' || c.fatigue_tag === 'Wrecked')) {
    return true
  }
  const qualityDays = qualitySessionDays(week)
  if (weekCompletions.some(c => c.status === 'skipped' && qualityDays.includes(c.session_day))) {
    return true
  }
  return false
}

// Full verdict for a *past* (locked-in) week under the active tier's
// criteria. Completion ratio applies here — the week is over.
function pastWeekWithinLines(
  week: Week,
  completions: LedgerInput['completions'],
  analyses: LedgerInput['analyses'],
  tier: 'free' | 'trial' | 'paid',
): boolean {
  const planned = plannedSessionCount(week)
  if (planned === 0) {
    // No planned sessions — a rest/recovery week. Treat as "within the lines"
    // by definition: the runner can't break a week that wasn't asking anything.
    return true
  }

  const weekCompletions = completions.filter(c => c.week_n === week.n)
  const completed = weekCompletions.filter(c => c.status === 'complete').length
  if (completed / planned < LEDGER_FREE_MIN_COMPLETION_PCT) return false

  if (weekCompletions.some(c => c.fatigue_tag === 'Heavy' || c.fatigue_tag === 'Wrecked')) {
    return false
  }

  const qualityDays = qualitySessionDays(week)
  if (weekCompletions.some(c => c.status === 'skipped' && qualityDays.includes(c.session_day))) {
    return false
  }

  if (tier !== 'free') {
    const weekAnalyses = analyses
      .filter(a => a.week_n === week.n)
      .map(a => Number(a.hr_in_zone_pct))
      .filter(n => Number.isFinite(n))
    if (weekAnalyses.length > 0) {
      const m = median(weekAnalyses)
      if (m !== null && m < LEDGER_PAID_MIN_ZONE_DISCIPLINE_PCT) return false
    }
    // If there are no analyses, paid criterion silently passes — the
    // engine doesn't penalise a week that wasn't analysed (e.g. Strava
    // dropped, HealthKit hiccup). This is intentional: we don't want
    // infrastructure failures to break the ledger.
  }

  return true
}

/**
 * The single computation entry point. Pure — takes the data it needs as
 * input. Caller fetches plan + completions + analyses and passes them in.
 *
 * Returns the ledger count + the state of the in-flight week + whether
 * the count advanced *this* week (for DOCTRINE-01's conditional brand-
 * statement surface).
 */
export function computeLedger(input: LedgerInput): LedgerOutcome {
  const { plan, completions, analyses, tier, asOfDate } = input

  if (!plan?.weeks?.length) {
    return { weeksWithinLines: 0, currentWeekStatus: 'pending', advancedThisWeek: false }
  }

  const thisWeekN = currentWeekN(plan, asOfDate)

  // Build a chronologically-sorted list of past weeks (excluding the
  // current in-flight one if present).
  const pastWeeks = [...plan.weeks]
    .filter(w => thisWeekN == null || w.n < thisWeekN)
    .sort((a, b) => a.n - b.n)

  // Walk past weeks in reverse to find the consecutive streak ending at
  // the most recent completed week. We stop at the first `false` (a break)
  // or `null` (unjudgeable — e.g. plan didn't exist yet for that week).
  let weeksWithinLines = 0
  for (let i = pastWeeks.length - 1; i >= 0; i--) {
    if (pastWeekWithinLines(pastWeeks[i], completions, analyses, tier)) weeksWithinLines += 1
    else break
  }

  // Did the most-recent past week advance the count *this* calendar week?
  // True when (a) we have at least one past week, (b) the count is ≥1,
  // and (c) the most-recent past week is adjacent to the current week.
  const mostRecentPast = pastWeeks[pastWeeks.length - 1]
  const advancedThisWeek = !!(
    weeksWithinLines >= 1 &&
    mostRecentPast &&
    thisWeekN != null &&
    mostRecentPast.n === thisWeekN - 1
  )

  // Current week status — only the immediate-break criteria apply mid-week.
  let currentWeekStatus: LedgerOutcome['currentWeekStatus'] = 'pending'
  if (thisWeekN != null) {
    const thisWeek = plan.weeks.find(w => w.n === thisWeekN)
    if (thisWeek && currentWeekBroken(thisWeek, completions)) {
      currentWeekStatus = 'broken'
    }
  }

  return { weeksWithinLines, currentWeekStatus, advancedThisWeek }
}
