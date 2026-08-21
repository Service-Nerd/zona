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
import { GENERATION_CONFIG } from './generationConfig'

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

/**
 * The STIMULUS a quality session delivers — the axis `STIMULUS_RANK` orders.
 *
 * Moved here from ruleEngine.ts (2026-08-20, SC-07). It was a private helper
 * there while invariants.ts independently grew `label.includes('vo2max')` checks
 * in half a dozen places. SC-07 needed the same answer in both files, and a
 * third copy is precisely the drift D-17 warns about — so it lives with the
 * other classifiers instead.
 *
 * CLASSIFY-STIMULUS-01 (2026-08-21) — the generator now stamps `Session.stimulus`
 * at construction and this reads it first, the same remedy `role` applied to the
 * long run. The label heuristic below is the LEGACY FALLBACK: plans generated
 * before the stamp, and the case D-17 warns about — an AI enricher rewriting a
 * session name can no longer reclassify a stamped session. The stamp is taken
 * from the trusted generator label (never `catalogue_id` → row.category, which
 * would mis-map a threshold row re-prescribed at goal pace as `tempo` rather than
 * `race_pace` — §22 makes those two things different on purpose).
 */
export function classifyStimulus(
  session: { label?: string | null; zone?: string | null; stimulus?: keyof typeof GENERATION_CONFIG.STIMULUS_RANK },
): keyof typeof GENERATION_CONFIG.STIMULUS_RANK | null {
  if (session.stimulus) return session.stimulus
  const label = (session.label ?? '').toLowerCase()
  const zone  = (session.zone  ?? '').toLowerCase()
  // VO2max is unambiguous — drives off both label and zone.
  if (label.includes('vo2') || zone.includes('zone 4–5') || zone.includes('zone 5')) return 'vo2max'
  // Goal-pace and tempo both sit at rank 4 (race_pace / tempo). Distinguish for
  // the audit log; rank is identical so escalation logic isn't affected.
  if (label.includes('-pace') || label.includes('goal pace') || label.includes('sharpener')) return 'race_pace'
  if (label.includes('tempo') || label.includes('cruise') || label.includes('threshold') || label.includes('progressive')) return 'tempo'
  if (label.includes('hill'))  return 'hills'
  if (label.includes('strid')) return 'strides'
  if (label.includes('aerobic') || label.includes('steady')) return 'steady_aerobic'
  return null
}

/**
 * Is this session VO2max work — structurally, not by what it is called?
 *
 * Added 2026-08-20 (SC-09). The label test `label.includes('vo2max')` was
 * correct while every VO2max session was NAMED "… VO2max". `hill_reps` broke
 * that: it is `category: 'vo2max'` and labelled "Hill reps — 45s", so §22's
 * VO2max exemption silently stopped applying to it and the plan failed its own
 * race-specific-exposure check.
 *
 * D-17 again, and the third site this week where `catalogue_id` (ADR-018) makes
 * the structural answer available. The label fallback stays for legacy plans
 * generated before the stamp.
 */
export function isVo2maxSession(
  session: { catalogue_id?: string; label?: string | null },
  catalogue: Array<{ id: string; category: string }>,
): boolean {
  if (session.catalogue_id) {
    const row = catalogue.find(r => r.id === session.catalogue_id)
    if (row) return row.category === 'vo2max'
  }
  const label = (session.label ?? '').toLowerCase()
  return label.includes('vo2max') || label.includes('vo2 max')
}
