// Single owner (D-08/D-16) of "what kind of session is this" for the two
// classifications that share `type: 'easy'` — the long run and the race-week
// shakeout. Both used to be told apart by matching words in the display label,
// which the AI enricher rewrites — silently breaking classification and, via the
// post-enrich invariant re-validation, reverting whole enriched plans to rule
// copy (D-17: never couple logic to a display string).
//
// The generator stamps `Session.role` at construction. These predicates read it.
// Legacy plans (generated before `role` existed) have no stamp, so they fall
// back to the original label heuristic — correct for those, and never reached
// once a plan carries the stamp.
import type { Session, SessionType } from '@/types/plan'

// A session the engine models as `type: 'easy'`. Kept narrow so callers pass a
// real classification signal, not a bare string.
type ClassifiableSession = { type?: SessionType | string; role?: Session['role']; label?: string | null }

export function isLongRun(s: ClassifiableSession): boolean {
  // Explicit long type (legacy/hand-authored gist/manual entry) is authoritative.
  if (s.type === 'long') return true
  if (s.role) return s.role === 'long_run'
  return s.type === 'easy' && (s.label?.toLowerCase().includes('long') ?? false)
}

export function isShakeout(s: ClassifiableSession): boolean {
  if (s.role) return s.role === 'shakeout'
  return s.label?.toLowerCase().includes('shakeout') ?? false
}

/**
 * The canonical COACHING classification for a session, as a string. This is the
 * single source of truth for the `sessionType` signal that the coaching engine
 * (planAdjustment, limiter, manualSessionFeedback, readiness) branches on.
 *
 * The generator models long runs as `type: 'easy'`, so `session.type` alone is
 * NOT the coaching class — a long run must classify as `'long'` or every
 * long-run coaching path (fatigue/readiness trim, HARD_TYPES gating, spacing)
 * silently misses it. Always derive the signal through here, never from a raw
 * `session.type`.
 */
export function coachingSessionType(s: ClassifiableSession): string {
  if (isLongRun(s)) return 'long'
  return (s.type as string) ?? 'easy'
}
