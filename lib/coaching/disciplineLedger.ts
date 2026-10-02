// LEDGER-01 — "Weeks within the lines" discipline ledger.
//
// Doctrine: the user builds a number that represents restraint, not volume
// (Eyal investment + Sutherland reframe). Resets silently to zero on break.
// No notifications. No flames. No urgency.
//
// 🔴 THIS COMMENT USED TO OPEN "a counter, not a streak", AND THE LINE DIRECTLY BELOW
// `weeksWithinLines` SAYS "**Consecutive** completed weeks". Those describe the same
// object two ways. **A consecutive count that resets on break IS a streak by mechanism**
// — what is absent is the PACKAGING (no flames, no notification, no urgency, no
// milestone celebration), and that absence is the real and deliberate design decision.
// CLAUDE.md states the product "deliberately omits gamification — no streaks, badges,
// leaderboards", so the doctrine and the implementation described it differently and one
// of them was wrong. **Corrected to describe the mechanism honestly (SLT, 2026-10-02);
// no behaviour changed.** Saying "not a streak" did not make it one less.
//
// ⚠️ THE OPEN QUESTION IS THE CRITERIA, NOT THE RESET. See `LEDGER-FATIGUE-HONESTY-01`:
// a week breaks on `fatigue_tag in ('Heavy','Wrecked')`, so a runner who honestly reports
// being wrecked loses the number while a runner who logs nothing keeps it. That is an
// incentive to under-report an input the engine consumes, and it is a COACHING question.
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
// Computed lazily on view — no cron, no table. The function below is the single
// source of truth.
//
// 🔴 RENDERED ON TWO SURFACES (LEDGER-REACH-01, 2026-09-29): the Me index, ungated, and
// the Coach screen, which is paid-only. This header said "Me-screen open" for FOUR MONTHS
// after `353cbbad` moved the only render site to Coach — so the FREE criteria below
// computed a real answer that no free runner could ever see. If you move the card again,
// this comment and `feature-registry.md` are the two records that go stale silently.

import type { Plan, Week } from '@/types/plan'
import { FATIGUE_HIGH_TAGS } from './constants'

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
/**
 * §112 Amendment (Coaching Board, 2026-10-02 — `LEDGER-FATIGUE-HONESTY-01`).
 *
 * 🔴 **A HIGH-FATIGUE TAG BREAKS THE WEEK ONLY ON A NON-QUALITY DAY.** Being wrecked after a
 * prescribed threshold or interval session is **the session working**; being wrecked after an
 * easy day is the grey zone, which is the entire product thesis. One rule was answering two
 * completely different questions.
 *
 * 🔴 WHY IT HAD TO CHANGE — §112 AND THIS LEDGER PULLED OPPOSITE WAYS ON ONE SIGNAL.
 * §112 is titled *"Consecutive self-reported cost SOFTENS the long run"*: the engine REWARDS the
 * report, firing at `FATIGUE_ACCUMULATION_THRESHOLD` (3) consecutive sessions. This ledger
 * PUNISHED the same report on the FIRST one — so a runner had to report fatigue three times to
 * get help and lost the ledger immediately. **It made §112 measurably harder to reach.**
 *
 * ⚠️ `fatigue_tag` IS AN ENGINE INPUT, not a display field: `fatigueAccumulation.ts` (§112),
 * `limiter.ts` §7, `planAdjustment.ts` and `maintenance.ts` all read it. 🩹 Willy: for a runner
 * with no HR it is the earliest warning and often the only one — `limiter.ts` calls it the
 * *"lowest-confidence fallback for manual loggers"*, and HR is present on **27.3%** of runs.
 * 🎯 McMillan: *"a runner who stops logging is worse than one who skips — a skip I can see."*
 * ⚕️ Sims: attaching a cost to saying "I was wrecked" builds exactly the reporting bias that
 * makes low energy availability hard to catch.
 *
 * ⚠️ THE RESIDUAL OVERLAP ON EASY DAYS IS INTENDED. Three consecutive Heavy tags on easy runs
 * should both fire §112 and break the week — that runner is not within the lines.
 *
 * ⚠️ READS `FATIGUE_HIGH_TAGS` RATHER THAN HARDCODING. This file carried
 * `'Heavy' || 'Wrecked'` in TWO places while the owner is `['Heavy','Wrecked','Cooked']` with
 * four other consumers — so **`Cooked` was high fatigue to the engine and invisible here.**
 * Latent (0 production rows carry it today), and the duplicate-owner class regardless.
 */
function brokenByFatigue(week: Week, weekCompletions: LedgerInput['completions']): boolean {
  const qualityDays = qualitySessionDays(week)
  return weekCompletions.some(c =>
    typeof c.fatigue_tag === 'string'
    && (FATIGUE_HIGH_TAGS as readonly string[]).includes(c.fatigue_tag)
    && !qualityDays.includes(c.session_day))
}

// Returns true if a break signal has already landed; false if the week is
// still on track. (Pending = "still on track" — caller decides display.)
function currentWeekBroken(
  week: Week,
  completions: LedgerInput['completions'],
): boolean {
  const weekCompletions = completions.filter(c => c.week_n === week.n)
  if (brokenByFatigue(week, weekCompletions)) {
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

  if (brokenByFatigue(week, weekCompletions)) {
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
