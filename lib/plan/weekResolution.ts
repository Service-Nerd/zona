import type { Plan, Session, Week } from '@/types/plan'
import {
  resolveEffectiveSessions,
  type DayKey,
  type SessionOverride,
} from '@/lib/plan/effectiveSessions'

/**
 * ADR-016 — date-aware plan resolution. "Which real session is on calendar
 * date D?", and the window arithmetic every caller of that question needs.
 *
 * ⚠️ THIS IS A LEAF MODULE AND MUST STAY ONE. It lived in `lib/plan.ts`
 * alongside `fetchPlanForUser` / `savePlanForUser`, which import the
 * invariants engine, the zod schema, the ops recorder, the charity
 * re-anchor and the supersede helpers. Every client component that wanted
 * `parseLocalDate` or `getCurrentWeekIndex` — two pure date functions —
 * therefore shipped all of that to the browser. Measured on the marketing
 * homepage, which renders the real week cards in its phone still: **First
 * Load JS 110 kB -> 247 kB, and only ~2 kB of that was Supabase.** The rest
 * was the plan-persistence tail arriving through a date helper.
 *
 * `lib/plan.ts` re-exports everything here, so every existing import of
 * `@/lib/plan` keeps working and there is still exactly one definition.
 * **Client components should import from THIS module directly**; importing
 * the barrel is what re-attaches the tail.
 *
 * Nothing in this file may import persistence, validation, Supabase, or the
 * rule engine. If a function needs one of those, it belongs in `lib/plan.ts`.
 */

// Parse a YYYY-MM-DD string as local midnight — avoids UTC-offset week mismatches
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function getCurrentWeek(weeks: Plan['weeks']) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  // Find the week where today falls within its 7-day window
  const current = weeks.find(w => {
    const weekStart = parseLocalDate((w as any).date)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    return now >= weekStart && now < weekEnd
  })
  // Fallback: last week before today (if between weeks), or first future week
  if (!current) {
    const past = [...weeks].reverse().find(w => parseLocalDate((w as any).date) <= now)
    return past ?? weeks[0]
  }
  return current
}

export function getCurrentWeekIndex(weeks: Plan['weeks']): number {
  const current = getCurrentWeek(weeks)
  const idx = weeks.indexOf(current)
  return idx >= 0 ? idx : 0
}

/**
 * Find the plan-week index whose 7-day window contains the given calendar
 * date. Used by activity-matching paths so a Sunday-night run ingested on
 * Monday morning is matched against last week's plan (where it belongs),
 * not today's. Same fallback semantics as getCurrentWeek: nearest past
 * week if the date sits in a gap, or weeks[0] if it's before the plan.
 *
 * Why this exists separately from getCurrentWeekIndex: that one is
 * (correctly) anchored to "now" for UI surfaces — TodayScreen, Coach
 * report, etc. Activity-matching is anchored to the activity, not the
 * clock — those are different semantics.
 */
export function getWeekIndexForDate(weeks: Plan['weeks'], date: Date): number {
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const idx = weeks.findIndex(w => {
    const weekStart = parseLocalDate((w as any).date)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    return target >= weekStart && target < weekEnd
  })
  if (idx >= 0) return idx
  // Fallback: nearest past week, else first week.
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (parseLocalDate((weeks[i] as any).date) <= target) return i
  }
  return 0
}

export function getWeeksToRace(raceDate: string) {
  const ms = new Date(raceDate).getTime() - Date.now()
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24 * 7)))
}

/**
 * Whether `date` falls inside a plan week's 7-day window [weekStart, weekStart+7).
 *
 * getCurrentWeek() falls back to the last week when today is past the plan, so
 * callers can't otherwise tell "genuinely inside this week" from "pinned to the
 * final week because the plan is over". Coaching surfaces need that distinction:
 * without it they read a stale slot (e.g. today's weekday) out of a week that
 * has already ended and prescribe a session that no longer exists.
 */
export function isDateWithinWeek(week: Plan['weeks'][number], date: Date): boolean {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const weekStart = parseLocalDate((week as any).date)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)
  return d >= weekStart && d < weekEnd
}

/**
 * True when `date` is on or after the END of `week`'s 7-day window — i.e. today
 * is past that week. The canonical "are we past plan-week N?" predicate.
 *
 * Doctrine (§73): temporal position must be reasoned about with a date-window
 * predicate, NEVER with an index comparison against `getCurrentWeekIndex()`.
 * That pointer SATURATES at the final week once today is past the plan
 * (`getCurrentWeek` falls back to the last week), so `currentWeekIndex > N` is
 * unreachable when N is the last week — the "in-flight vs done" bug class that
 * bit the day boundary (§65), the plan-complete surfaces (§70), and the
 * post-race prompt. Use this predicate instead.
 */
export function isDatePastWeek(week: Plan['weeks'][number], date: Date): boolean {
  const weekStart = parseLocalDate((week as any).date)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d >= weekEnd
}

/**
 * Resolve a plan week by its canonical `week.n` key (ADR-013), NOT array
 * position. A standalone maintenance plan's array restarts at index 0 while
 * `week.n` continues the race sequence (26+), so `weeks[week_n - 1]` is out of
 * bounds for it — the source of the "week 29 not found" / silent AI-note
 * failure on maintenance plans. `week_n` is the shared key for
 * `session_completions`, `run_analysis`, `weekly_reports`, `plan_weekly_notes`
 * and `session_reflections`; anything resolving a week from one of those values
 * must go through here. Falls back to array position only when `n` is absent
 * (pre-`n` legacy plans, where position == n anyway).
 */
export function findWeekByN(weeks: Plan['weeks'], n: number): Plan['weeks'][number] | undefined {
  return weeks.find(w => (w as any).n === n) ?? weeks[n - 1]
}

/**
 * True when `date` is on or after the end of the plan's final week — i.e. the
 * plan is over. Special case of {@link isDatePastWeek} on the last week: the
 * race commonly lives in the last week, so post-race is frequently also
 * plan-complete; there is no "week after" for the current-week pointer to
 * advance into.
 */
export function isPlanComplete(weeks: Plan['weeks'], date: Date): boolean {
  const last = weeks[weeks.length - 1]
  if (!last) return false
  return isDatePastWeek(last, date)
}

/**
 * True when `date` is strictly BEFORE the plan's first week begins — i.e. the
 * plan exists but has not started yet.
 *
 * The missing counterpart to {@link isPlanComplete} (§73 / ADR-016). `getCurrentWeek`
 * SATURATES to `weeks[0]` when today is before the plan (there is no earlier week
 * for its fallback to land on), so `getCurrentWeekIndex()` reads "week 1" for a
 * plan that hasn't begun. Any surface that derives "today's session" from that
 * index — the daily push, pre-session readiness, weekly report — will prescribe
 * week 1's weekday session a week (or more) early unless it FIRST asks this.
 * The before-start bug that shipped a "Easy 1h 18 today" push for a plan starting
 * the following Monday.
 */
export function isDateBeforePlan(weeks: Plan['weeks'], date: Date): boolean {
  const first = weeks[0]
  if (!first) return false
  const start = parseLocalDate((first as any).date)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d < start
}

// Map a local-midnight Date to its plan day key. Local getDay() (0=Sun) matched
// against DAY_KEYS (0=Mon) — the caller MUST pass a date built as local midnight
// of the intended calendar day (use parseLocalDate on a YYYY-MM-DD string), so
// this agrees with the local-date windows isDateWithinWeek compares against.
const DOW_TO_KEY: readonly DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
export function dayKeyForDate(date: Date): DayKey {
  return DOW_TO_KEY[date.getDay()]
}

export interface ResolvedSession {
  session: Session
  week: Week
  /** Canonical `week.n` key (ADR-013), not array position. */
  weekN: number
  /** Calendar-day slot the session currently lives on (after move/swap overrides). */
  dayKey: DayKey
  /** Day the session is defined on in `week.sessions` — the completion key. */
  originalDay: DayKey
}

/**
 * THE canonical "is there a real planned session on calendar date D?" resolver
 * (ADR-016). Returns the effective session for `date` — after applying move/swap
 * overrides — or `null` when there is genuinely nothing to show: before the plan
 * starts, after it ends, in a between-week gap, or on an empty day.
 *
 * This is date-aware, not day-of-week-aware: it locates the week whose 7-day
 * window actually CONTAINS `date` (never the saturating `getCurrentWeek` fallback),
 * then reads that week's slot for that weekday. A date outside every window
 * resolves to `null` — which is exactly the guard every scheduled send needs
 * (no plan/session → no push). Callers must treat `null` as "do not send / show
 * the empty state", never fall back to `weeks[0]`.
 *
 * `date` must be local midnight of the target calendar day (see dayKeyForDate).
 */
export function getSessionForDate(
  weeks: Plan['weeks'],
  date: Date,
  overrides: ReadonlyArray<SessionOverride> = [],
): ResolvedSession | null {
  const idx = weeks.findIndex(w => isDateWithinWeek(w, date))
  if (idx < 0) return null
  const week = weeks[idx]
  const weekN = (week as any).n ?? idx + 1
  const dayKey = dayKeyForDate(date)
  const weekOverrides = overrides.filter(o => o.week_n === weekN)
  const effective = resolveEffectiveSessions(week, weekOverrides)
  const entry = effective[dayKey]
  if (!entry) return null
  return {
    session: entry.session,
    week,
    weekN,
    dayKey,
    originalDay: entry.originalDay,
  }
}
