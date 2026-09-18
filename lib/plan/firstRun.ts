// FIRSTRUN-MOMENTS-01b — the first session, pulled out of the wall of weeks.
//
// A first-timer opening a 20-week marathon block sees an intimidating object.
// This reduces "marathon" to the one concrete thing they do first: a day, a
// duration, an effort. Wood funds it — it lowers the activation cost of the first
// action, which is the behaviour that matters. Pure so it is node-testable; the
// card (components/shared/FirstRunCard.tsx) only renders what this returns.

import type { Week, Session } from '@/types/plan'
import { formatDistance, formatDuration } from '@/lib/format'
import type { DistanceUnits } from '@/lib/format'

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_LABEL: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
}

/** A gentle-first-week session is almost always easy; map the rest honestly so
 *  the card never calls a hard session easy. */
function effortWord(s: Session): string {
  switch (s.type) {
    case 'tempo':
    case 'quality':
      return 'Tempo'
    case 'intervals':
    case 'hard':
      return 'Hard'
    case 'race':
      return 'Race'
    // easy / recovery / long / run — a long run is run at easy effort.
    default:
      return 'Easy'
  }
}

export interface FirstRun {
  /** Full weekday name, e.g. "Monday". */
  dayLabel: string
  /** ADR-015 string: a duration ("20 min") when duration-anchored (beginners
   *  are, 95.8% of the time), else a distance in the runner's own units. */
  metric: string
  /** "Easy" / "Tempo" / "Hard" / "Race". */
  effort: string
}

/** The first session the runner actually does — the first non-rest session of the
 *  FIRST week (a foundation week if one is present, which is gentler still).
 *  Returns null when there is nothing concrete to promise: no weeks, an all-rest
 *  first week, or a session carrying neither a duration nor a distance. */
export function firstRunOfPlan(weeks: Week[], units: DistanceUnits = 'km'): FirstRun | null {
  const first = weeks[0]
  if (!first) return null
  for (const day of DAY_ORDER) {
    const s = first.sessions[day]
    if (!s || (s.type as string) === 'rest') continue
    // ⚠️ `${Math.round(km)} km` shipped here first and was TWO defects: it
    // re-implemented the ADR-015 rounding rule (INV-FMT-001 says do not, ever)
    // and it hardcoded the unit, so a miles runner read km on this card.
    const metric =
      formatDuration(s.duration_mins)
      ?? formatDistance(s.distance_km, units)
    if (!metric) return null
    return { dayLabel: DAY_LABEL[day] ?? day, metric, effort: effortWord(s) }
  }
  return null
}
