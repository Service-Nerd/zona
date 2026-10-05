import type { StravaActivity } from '@/types/plan'
import type { Session } from '@/types/plan'

export interface MatchCandidate {
  activity: StravaActivity
  confidence: 'high' | 'medium' | 'low'
  reasons: string[]
}

// Minimum confidence for SERVER-SIDE passive auto-link (no user action).
// Client tap-to-confirm flows may surface medium-confidence matches — the tap
// is explicit consent. Change this in one place; callers import, don't hardcode.
export const MIN_AUTO_LINK_CONFIDENCE: MatchCandidate['confidence'] = 'high'

// ── The BROWSE pool, which is a DIFFERENT QUESTION from a match candidate ──
//
// 🔴 MATCH-LIST-WINDOW-01. Two questions were sharing one answer, badly:
//   1. "which run IS this session?"      -> findMatchCandidates below: +/-2 days,
//                                          distance-aware (0.75-1.40), confidence-ranked.
//   2. "which runs may I BROWSE to link?" -> wider on purpose, because a runner
//                                          does a Tuesday session on Saturday and must
//                                          still be able to link it.
//
// Question 2 was answered by a hand-rolled date test inside SessionPopupInner with
// NO distance component and an ASYMMETRIC -5/+0-day window. So a 20 Sep / 14 km run
// was offered for a Fri 25 Sep / 8 km session: 25 Sep - 5 = 20 Sep, exactly the
// boundary, and 14/8 = 1.75 is far outside the matcher's ratio. The item was filed as
// "the candidate list has no date filter" and that was WRONG — there was a filter,
// it was a SECOND ANSWER, which is harder to see and worse (TIER-OWNER-01's class).
//
// The window stays deliberately wide. It is NAMED and lives HERE, beside the matcher,
// so nobody can add a third answer without reading both. Ranking is the matcher's job.
export const LINK_POOL_LOOKBACK_DAYS = 5

/**
 * Is `activityDate` inside the pool a runner may browse when linking `sessionDate`?
 *
 * A FUTURE session has no "session day" to look back from, so the pool is the last
 * LINK_POOL_LOOKBACK_DAYS from `now` — you cannot have run a session that has not
 * happened, but you may be linking an early effort. A session today or in the past
 * looks back from the session and stops at the END of its own day.
 */
export function isInLinkPool(
  activityDate: Date,
  sessionDate: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  const back = (from: Date) => {
    const d = new Date(from)
    d.setDate(d.getDate() - LINK_POOL_LOOKBACK_DAYS)
    return d
  }
  if (!sessionDate || Number.isNaN(sessionDate.getTime())) return activityDate >= back(now)
  if (sessionDate > now) return activityDate >= back(now)
  const end = new Date(sessionDate)
  end.setHours(23, 59, 59, 999)
  return activityDate >= back(sessionDate) && activityDate <= end
}

/**
 * The browse list, ranked by the SAME owner the auto-linker uses.
 *
 * Pool membership is `isInLinkPool` (wide, deliberate). ORDER is
 * `findMatchCandidates` (narrow, distance-aware) — so the likely run is first and a
 * five-day-old run of the wrong distance sinks instead of sitting at the top looking
 * equivalent. Runs the matcher does not rank keep their incoming order after it.
 *
 * ⚠️ This RANKS, it does not FILTER. Narrowing the browse pool to the matcher's
 * +/-2 days would stop a runner linking a session they ran four days late, which is a
 * capability question for the Design Board, not a defect fix.
 */
export function rankLinkCandidates(
  session: Session,
  sessionDate: Date | null | undefined,
  pool: StravaActivity[],
): StravaActivity[] {
  if (!sessionDate || Number.isNaN(sessionDate.getTime()) || !pool.length) return pool
  const rank = new Map<unknown, number>()
  findMatchCandidates(session, sessionDate, pool)
    .forEach((c, i) => rank.set(c.activity.id, i))
  return [...pool].sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id)! : Number.MAX_SAFE_INTEGER
    const rb = rank.has(b.id) ? rank.get(b.id)! : Number.MAX_SAFE_INTEGER
    return ra - rb
  })
}

/**
 * Returns ordered match candidates for a planned session, best match first.
 * Auto-selects if exactly one 'high' confidence candidate.
 */
export function findMatchCandidates(
  session: Session,
  sessionDate: Date,
  activities: StravaActivity[],
): MatchCandidate[] {
  const runs = activities.filter(a => a.type === 'Run' || a.sport_type === 'Run')

  // Consider activities within ±2 days of planned session date
  const windowMs = 2 * 24 * 60 * 60 * 1000
  const sessionMs = sessionDate.getTime()
  const nearby = runs.filter(a => {
    const actMs = new Date(a.start_date).getTime()
    return Math.abs(actMs - sessionMs) <= windowMs
  })

  return nearby
    .map(activity => scoreMatch(session, sessionDate, activity))
    .filter(c => c.confidence !== 'low' || c.reasons.length > 0)
    .sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence))
}

function scoreMatch(session: Session, sessionDate: Date, activity: StravaActivity): MatchCandidate {
  const reasons: string[] = []
  let score = 0

  const actDate = new Date(activity.start_date)
  // Calendar-weekday equality (not numerical day distance). Sunday == Sunday
  // even across week boundaries; the activity-vs-session window-filter above
  // (±2 days) already constrains how far apart they can be in real time.
  // The earlier `Math.abs(... ? 1 : 0)` wrapper was dead — abs of 0 or 1 is
  // the value — and read as a numerical distance, which it isn't.
  const sameWeekday = actDate.getDay() === sessionDate.getDay()

  // Same calendar day = strong signal
  if (sameWeekday) { score += 40; reasons.push('same day') }

  // Distance match — asymmetric band targeting Zonna's over-trainer demographic.
  // Lower bound 0.75 (25% under), upper bound 1.40 (40% over). The previous
  // symmetric ±20% missed runners who routinely tack 2–3 km onto an easy session
  // — the exact "blurring the zones" pattern the brand calls out. A 7 km plan
  // and a 9.3 km actual (ratio 1.33) is the same session, not a stranger.
  const plannedKm = session.distance_km
  if (plannedKm) {
    const actKm = activity.distance / 1000
    const ratio = actKm / plannedKm
    if (ratio >= 0.75 && ratio <= 1.40) {
      score += 30
      reasons.push('distance match')
    }
  }

  // Duration match for duration-primary sessions (within 15%)
  if (session.primary_metric === 'duration' && session.duration_mins) {
    const actMins = activity.moving_time / 60
    const ratio = actMins / session.duration_mins
    if (ratio >= 0.85 && ratio <= 1.15) {
      score += 30
      reasons.push('duration match')
    }
  }

  // Effort alignment — easy session + low HR is consistent
  if (session.type === 'easy' || session.type === 'recovery') {
    if (activity.average_heartrate && activity.average_heartrate < 155) {
      score += 10
      reasons.push('effort match')
    }
  }

  const confidence: MatchCandidate['confidence'] =
    score >= 70 ? 'high' :
    score >= 40 ? 'medium' : 'low'

  return { activity, confidence, reasons }
}

function confidenceRank(c: MatchCandidate['confidence']): number {
  return c === 'high' ? 2 : c === 'medium' ? 1 : 0
}

// Returns the single high-confidence candidate, or null if there are 0 or 2+
// (ambiguous). Uses MIN_AUTO_LINK_CONFIDENCE so the threshold is defined once.
export function autoSelectMatch(candidates: MatchCandidate[]): StravaActivity | null {
  const qualified = candidates.filter(c => c.confidence === MIN_AUTO_LINK_CONFIDENCE)
  return qualified.length === 1 ? qualified[0].activity : null
}
