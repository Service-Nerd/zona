import type { Session } from '@/types/plan'
import { BRAND } from '@/lib/brand'

// One-line voice anchors per session type — used wherever the app needs a
// single concrete coaching sentence in Zonna voice. Extracted from
// DashboardClient (HOOK-01) so the daily push cron and unit tests can use it
// without dragging in the dashboard tree.
//
// Returns null for unknown types so callers can render nothing.
export function getSessionVoiceLine(sessionType: string | null | undefined): string | null {
  switch (sessionType) {
    case 'easy':
    case 'run':       return "Conversational the whole way. If you can talk, you're in."
    case 'long':      return "Hours, not effort. Slower than you think you should."
    case 'quality':
    case 'tempo':     return "Comfortably hard. Not all-out. Hold the line."
    case 'intervals':
    case 'hard':      return "Hard on the reps. Easy on the rests. Don't blur it."
    case 'race':      return "This is the day. Trust the work."
    case 'recovery':  return "Slower than easy. Yes, that slow."
    case 'strength':  return "Build the body that holds the zones."
    case 'rest':      return "Do nothing. It helps."
    default:          return null
  }
}

// Human-readable session type word for the title slot. Maps internal codes to
// the noun a runner would expect to read ("intervals" not "hard", "long" not "run").
function sessionTypeWord(sessionType: string): string {
  switch (sessionType) {
    case 'run':        return 'easy'
    case 'hard':       return 'intervals'
    case 'cross-train':return 'cross-train'
    default:           return sessionType
  }
}

// Concise duration/distance summary appended to the title — "45m" or "8km".
// Duration wins when both present (matches how the runner reads the day).
function sessionMetricSummary(session: Pick<Session, 'duration_mins' | 'distance_km'>): string | null {
  if (session.duration_mins) {
    const mins = Math.round(session.duration_mins)
    if (mins >= 60 && mins % 60 === 0) return `${mins / 60}h`
    if (mins >= 90) {
      const h = Math.floor(mins / 60)
      const m = mins % 60
      return `${h}h${m.toString().padStart(2, '0')}`
    }
    return `${mins}m`
  }
  if (session.distance_km) {
    const km = session.distance_km
    return Number.isInteger(km) ? `${km}km` : `${km.toFixed(1)}km`
  }
  return null
}

// Push title: "Today: easy 45m." — concrete, not "Time to train".
// Falls back to "Today: <type>." when no metric is set (e.g. rest, strength).
export function buildDailyPushTitle(session: Pick<Session, 'type' | 'duration_mins' | 'distance_km'> | null): string {
  const prefix = BRAND.push.dailyTraining
  if (!session) return `${prefix}: rest.`
  const word = sessionTypeWord(session.type)
  const metric = sessionMetricSummary(session)
  return metric ? `${prefix}: ${word} ${metric}.` : `${prefix}: ${word}.`
}

// Push body: one voice line, no emoji. Rest days return the rest voice line.
// Unknown types fall back to the brand voice anchor so the push is never empty.
export function buildDailyPushBody(sessionType: string | null | undefined): string {
  return getSessionVoiceLine(sessionType) ?? BRAND.voiceAnchor
}
