import type { StravaActivity } from '@/types/plan'
import type { Session } from '@/types/plan'

export interface MatchCandidate {
  activity: StravaActivity
  confidence: 'high' | 'medium' | 'low'
  reasons: string[]
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

export function autoSelectMatch(candidates: MatchCandidate[]): StravaActivity | null {
  const highConf = candidates.filter(c => c.confidence === 'high')
  return highConf.length === 1 ? highConf[0].activity : null
}
