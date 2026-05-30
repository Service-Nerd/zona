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

/** The next demanding session this training week, used to give an easy/recovery
 *  day its purpose ("Intervals Thursday"). Computed by the caller from the plan. */
export interface NextKeySession {
  type: string
  dayName: string
}

// Short noun for an upcoming key session — the "why" tag on an easy/recovery day.
function keySessionNoun(type: string): string {
  switch (type) {
    case 'intervals':
    case 'hard':     return 'Intervals'
    case 'quality':
    case 'tempo':    return 'Tempo'
    case 'long':     return 'Long run'
    case 'race':     return 'Race day'
    default:         return 'A hard one'
  }
}

// Push title (HOOK-01, redesigned POST-RUN-02-era). Drops the bureaucratic
// "Today:" prefix — the lock screen already shows the app name and a morning
// timestamp — and instead carries the temporal anchor naturally ("...today") in
// a register that fits the day: relief on rest, respect on the long/hard days,
// reassurance on easy. The session metric (the genuinely useful "what") is kept.
//
// On easy/recovery days, when a key session is coming later this week, the title
// names it ("Easy 45m today. Intervals Thursday.") — reframing the easy day from
// a lesser run into the thing that protects the hard one, which is the whole
// zone-discipline thesis. Body copy (buildDailyPushBody) carries the execution
// coaching and is unchanged.
export function buildDailyPushTitle(
  session: Pick<Session, 'type' | 'duration_mins' | 'distance_km'> | null,
  nextKey: NextKeySession | null = null,
): string {
  if (!session) return 'Nothing today. On purpose.'
  const metric = sessionMetricSummary(session)

  switch (session.type) {
    case 'easy':
    case 'run':
    case 'recovery': {
      const word = session.type === 'recovery' ? 'Recovery' : 'Easy'
      const base = metric ? `${word} ${metric} today.` : `${word} one today.`
      return nextKey ? `${base} ${keySessionNoun(nextKey.type)} ${nextKey.dayName}.` : base
    }
    case 'long':
      return metric ? `The long one today. ${metric}.` : 'The long one today.'
    case 'quality':
    case 'tempo':
      return metric ? `The hard one's today. ${metric}.` : "The hard one's today."
    case 'intervals':
    case 'hard':
      return metric ? `Intervals today. ${metric}.` : 'Intervals today.'
    case 'race':
      return 'Race day.'
    case 'strength':
      return 'Strength today.'
    case 'cross-train':
      return metric ? `Cross-train today. ${metric}.` : 'Cross-train today.'
    case 'rest':
      return 'Nothing today. On purpose.'
    default:
      return metric ? `Training today. ${metric}.` : 'Training today.'
  }
}

// Push body: one voice line, no emoji. Rest days return the rest voice line.
// Unknown types fall back to the brand voice anchor so the push is never empty.
export function buildDailyPushBody(sessionType: string | null | undefined): string {
  return getSessionVoiceLine(sessionType) ?? BRAND.voiceAnchor
}

// ─── Link-time post-run push (POST-RUN-02) ──────────────────────────────────

// Highest bpm integer in a plan hr_target string — the zone ceiling.
// Formats: "< 145 bpm" (single ceiling) | "155–168 bpm" (range upper bound).
// Returns null when no number is present (legacy/untargeted sessions).
function parseHrCeiling(hrTarget: string | null | undefined): number | null {
  const nums = hrTarget?.match(/\d+/g)
  if (!nums?.length) return null
  return Math.max(...nums.map(Number))
}

// Session types where staying *under* the HR ceiling is the whole point.
const CONTROLLED_ZONE_TYPES = new Set(['easy', 'long', 'recovery', 'run'])
// Hard days — high HR is expected, so we acknowledge the effort, never an HR verdict.
const EFFORT_TYPES = new Set(['quality', 'tempo', 'intervals', 'hard'])

/**
 * Copy for the confident auto-link push that fires the instant a run matches a
 * planned session (autoAnalyse.ts), BEFORE the analysis round-trip.
 *
 * Behavioural intent (POST-RUN-02): the lock-screen line should prove Kit
 * actually *looked* — a morsel drawn from data we already hold at link time
 * (average HR vs the planned zone) — and frame RPE entry as the runner's half
 * of the read, not a chore. The title carries recognition; the body keeps the
 * "how did it feel?" CTA that the Post-Run screen header mirrors, so the
 * tap-through is a continuation, not a new question.
 *
 * Why it does NOT call the reframe risk gate (reframeRiskGate.ts): that gate
 * needs this session's coaching_flag and HR drift — neither is computed yet at
 * link time (firing early is the point). So praise here is safe-by-construction
 * instead: the only praise line ("Held the zone") fires solely when average HR
 * sat at or under the planned ceiling — a fact about THIS run's control, never
 * a verdict on the training trajectory — so it can't become praise-against-a-
 * warning. Severity (drift/overload) is still caught by the in-app gate on the
 * very screen this push opens.
 */
export function buildLinkPushCopy(
  session: Pick<Session, 'type' | 'hr_target'> | null | undefined,
  avgHr: number | null | undefined,
): { title: string; body: string } {
  const type    = session?.type
  const ceiling = parseHrCeiling(session?.hr_target)
  const hasHr   = typeof avgHr === 'number' && avgHr > 0

  // Controlled-zone day with a ceiling we can compare against.
  if (type && CONTROLLED_ZONE_TYPES.has(type) && hasHr && ceiling != null) {
    return avgHr <= ceiling
      ? { title: 'Held the zone on that one.', body: 'Numbers look good — how did it feel?' }
      : { title: 'Bit warm, that one.',        body: 'Numbers say one thing — how did it feel?' }
  }

  // Hard session — credit the effort, leave the HR read for inside.
  if (type && EFFORT_TYPES.has(type)) {
    return { title: "That's the hard one done.", body: "Kit's reading it — how did it feel?" }
  }

  // No HR, no parseable target, strength/cross/race/rest: neutral recognition,
  // the read is on its way.
  return { title: "That one's in.", body: "Kit's reading it — how did it feel?" }
}
