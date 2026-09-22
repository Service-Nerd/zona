// FIRSTRUN-MOMENTS-01d + 01e — the honest size of the thing.
//
// Two facts that answer one question a first-timer is actually asking: *how big
// is this?* The marathon stops being the largest thing they will ever do once
// they can see it is a fraction of what they will already have done, and the
// dread of the unknown goes once the worst single day has a number on it.
//
// 🔴 DERIVED LIVE, NEVER STAMPED. Hutchinson's binding condition at the SLT
// sitting: the hardest-run line is a PROMISE about a plan that can reshape. It
// is true at generation and may be false in February. So this is a pure
// function of the plan as it is right now, called at render, and nothing here
// may be written into `plan.meta`.
//
// ⚠️ DISTANCE COMES FROM THE SINGLE OWNER. `sessionKmSelfPaced` (SESSION-KM-01),
// never `distance_km ?? 0`: a beginner's plan is duration-anchored on 95.8% of
// its sessions, so the naive read totals a 20-week marathon block as ~0 km. The
// owner returns `null` rather than lying, and this module refuses to print a
// total rather than printing a wrong one.

import type { Plan, Session } from '@/types/plan'
import { sessionKmSelfPaced } from './sessionDistance'
import { isLongRun } from './sessionRole'
import { formatDistance, formatDuration } from '@/lib/format'
import type { DistanceUnits } from '@/lib/format'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Month name from an ISO date string, read from the STRING rather than parsed
 * into a Date. `new Date('2027-03-08')` is UTC midnight and renders as February
 * in any negative-offset timezone, and `parseLocalDate` has already thrown on a
 * malformed value once in this codebase (the Coach crash). A substring cannot.
 */
function monthOf(isoDate: string | undefined): string | null {
  if (!isoDate || isoDate.length < 7) return null
  const m = Number(isoDate.slice(5, 7))
  return m >= 1 && m <= 12 ? MONTHS[m - 1] : null
}

export interface PlanScale {
  /** Deliberately coarse: "about 780 km" is the claim, not 779.4. */
  totalDistance: string
  /** The race itself, iconic decimals preserved (ADR-015): "42.2 km". */
  raceDistance: string
  /** The single longest run in the plan, ADR-015 formatted: "3h 28". */
  hardestRun: string | null
  /** The month it falls in: "March". Null when the week carries no usable date. */
  hardestMonth: string | null
}

/**
 * The scale of the plan, as it stands right now.
 *
 * Returns `null` when the honest answer cannot be produced — no weeks, or any
 * session whose distance cannot be resolved. **A partial total is worse than no
 * total**: it would quietly under-report the size of the plan, which is the
 * exact direction that makes the reframe a lie.
 */
export function planScale(plan: Plan, units: DistanceUnits = 'km'): PlanScale | null {
  const weeks = plan?.weeks
  if (!Array.isArray(weeks) || weeks.length === 0) return null

  let totalKm = 0
  let hardestMins = 0
  let hardestDate: string | undefined

  for (const week of weeks) {
    for (const session of Object.values(week?.sessions ?? {}) as (Session | undefined)[]) {
      if (!session) continue
      // §121 — the race is the test, not the training. Excluded here for the
      // same reason `sumWeeklyKm` excludes it: a total that folds the race in
      // says "you will cover about 540 km" where a chunk of that is the event
      // the training is FOR. Amendment 2 of the ruling, and it is a subtraction
      // rather than a re-label — `raceDistance` below already names the race
      // separately, so nothing is hidden by taking it out of the total.
      if (session.type === 'race') continue
      const km = sessionKmSelfPaced(session)
      // Unresolvable distance. Measured at 0 of 161 sessions across a
      // first-timer and an intermediate marathon plan, but "zero in the corpus"
      // is not "cannot happen" — so refuse rather than under-count.
      if (km == null) return null
      totalKm += km

      const mins = session.duration_mins
      if (isLongRun(session) && typeof mins === 'number' && mins > hardestMins) {
        hardestMins = mins
        hardestDate = week?.date
      }
    }
  }

  if (!(totalKm > 0)) return null

  // Round to the nearest 10 before formatting. The sentence says "about", and a
  // precise-looking 783 km invites the reader to check it against a plan that
  // will change the first time a session is swapped.
  const rounded = Math.round(totalKm / 10) * 10
  const totalDistance = formatDistance(rounded, units)
  // `exact` keeps the iconic race decimals — 42.2 km, 21.1 km (ADR-015).
  const raceDistance = formatDistance(plan.meta?.race_distance_km, units, { exact: true })
  if (!totalDistance || !raceDistance) return null

  return {
    totalDistance,
    raceDistance,
    hardestRun: hardestMins > 0 ? formatDuration(hardestMins) : null,
    hardestMonth: hardestMins > 0 ? monthOf(hardestDate) : null,
  }
}
