import { DAY_KEYS, resolveEffectiveDay, type SessionOverride } from './effectiveSessions'
import type { Session, Week } from '@/types/plan'

/**
 * NUDGE-EFFECTIVE-DAY-01 (2026-11-04) — the single owner of "which completed runs still
 * have no RPE, and what day did the runner actually run them?"
 *
 * ── WHY IT IS A PURE MODULE ───────────────────────────────────────────────
 * This lived inside a `useMemo` in TodayScreen, where `vitest.config.ts`'s
 * `environment: 'node'` means no test can reach it and the only alternative is a
 * source assertion, which passes on a comment. The defect below shipped to a real
 * runner under a green suite for exactly that reason.
 *
 * ── THE DEFECT ────────────────────────────────────────────────────────────
 * Completions are keyed by `original_day` — correct, and NOT the day the runner ran.
 * The old code walked the raw day keys and named the day by ARRAY POSITION, so a
 * session moved tue→mon and completed on the Monday was announced as "Tell Kit how
 * TUESDAY's run felt", while the week strip 60 lines below (which does resolve the
 * override) correctly dotted the Monday. One file, one fact, two conventions.
 *
 * ⚠️ The label was the visible half and the smaller one. `sessionDate` was the
 * SCHEDULED date too, so the `sessionDate > now` guard SUPPRESSED the prompt until
 * the original day came round: a run moved earlier could not be rated on the evening
 * it was run, and one moved sat→mon stayed hidden for five days. The 7-day window and
 * the sort read the same wrong date.
 */

export const NUDGE_WINDOW_DAYS = 7
export const NUDGE_MAX = 3

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

export interface NudgeCompletion {
  status?: string | null
  rpe?: number | null
  strava_activity_id?: number | null
  strava_activity_name?: string | null
  strava_activity_km?: number | null
  apple_health_uuid?: string | null
}

export interface RpeNudge {
  session: Session
  weekN: number
  /** The COMPLETION key (original day). PostRunScreen writes back with it. */
  dayKey: string
  /** The day the runner actually ran it, after their moves. Display only. */
  dayName: string
  distKm: number | null
  stravaActivityId: number | null
  stravaActivityName: string | null
  sessionDate: Date
}

export interface NudgeWeek extends Pick<Week, 'sessions'> {
  n: number
  date?: string
  type?: string
  badge?: string
}

/**
 * @param weekStartOf  injected so the caller keeps ownership of local-date parsing
 *                     (`parseLocalDate` + `computeSessionDate` in the dashboard helpers).
 */
export function missingRpeNudges(args: {
  weeks: readonly NudgeWeek[] | undefined
  completionsByWeek: Record<number, Record<string, NudgeCompletion | undefined> | undefined>
  overrides: readonly SessionOverride[]
  now: Date
  weekStartOf: (week: NudgeWeek) => Date
  dateOf: (weekStart: Date, dayKey: string) => Date
}): RpeNudge[] {
  const { weeks, completionsByWeek, overrides, now, weekStartOf, dateOf } = args
  if (!weeks?.length) return []
  const cutoff = new Date(now.getTime() - NUDGE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const out: RpeNudge[] = []

  for (const week of weeks) {
    const weekStart = weekStartOf(week)
    // Every week, not only the open one: the window spans a week boundary.
    const weekOverrides = overrides.filter(o => o.week_n === week.n)
    const effective = resolveEffectiveDay(week, weekOverrides)

    DAY_KEYS.forEach((dayKey, idx) => {
      for (const entry of (effective[dayKey] ?? [])) {
        const completion = completionsByWeek[week.n]?.[entry.originalDay]
        if (!completion) continue
        if (completion.status !== 'complete') continue
        if (completion.rpe != null) continue
        // Nothing to reflect on without a linked activity — a hand-logged session
        // already asked for RPE at the point of logging.
        if (!completion.strava_activity_id && !completion.apple_health_uuid) continue

        const sessionDate = dateOf(weekStart, dayKey)   // the EFFECTIVE day
        if (sessionDate < cutoff || sessionDate > now) continue

        out.push({
          session:            entry.session,
          weekN:              week.n,
          dayKey:             entry.originalDay,
          dayName:            DAY_NAMES[idx],
          distKm:             completion.strava_activity_km ?? null,
          stravaActivityId:   completion.strava_activity_id ?? null,
          stravaActivityName: completion.strava_activity_name ?? null,
          sessionDate,
        })
      }
    })
  }

  return out.sort((a, b) => b.sessionDate.getTime() - a.sessionDate.getTime()).slice(0, NUDGE_MAX)
}
