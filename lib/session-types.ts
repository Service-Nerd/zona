import { isLongRun } from '@/lib/plan/sessionRole'
import type { Session, SessionType } from '@/types/plan'

/** The shape `isLongRun` needs: a real classification signal, not a bare string. */
type ClassifiableSession = { type?: SessionType | string; role?: Session['role']; label?: string | null }

/**
 * Canonical session type → colour and label resolution.
 * This is the SINGLE owner of this mapping — see docs/canonical/session-types.md.
 * No component or utility should define its own colour/label map.
 */

export const SESSION_COLORS: Record<string, string> = {
  easy:          'var(--session-easy)',
  run:           'var(--session-long)',
  long:          'var(--session-long)',
  quality:       'var(--session-quality)',
  tempo:         'var(--session-quality)',
  intervals:     'var(--session-intervals)',
  hard:          'var(--session-intervals)',
  race:          'var(--session-race)',
  recovery:      'var(--session-recovery)',
  strength:      'var(--session-strength)',
  'cross-train': 'var(--session-cross)',
  cross:         'var(--session-cross)', // legacy alias — hand-authored gists may use 'cross'
  rest:          'transparent',
}

export const SESSION_LABELS: Record<string, string> = {
  easy:          'Easy run — Zone 2',
  run:           'Long run',
  long:          'Long run',
  quality:       'Quality session',
  tempo:         'Tempo run',
  intervals:     'Intervals',
  hard:          'Hard session',
  race:          'Race',
  recovery:      'Recovery run',
  strength:      'Strength',
  'cross-train': 'Cross-training',
  cross:         'Cross-training', // legacy alias
  rest:          'Rest day',
}

/**
 * Returns the accent colour for a session.
 *
 * PLAN-LONGRUN-COLOUR-01 (2026-09-12) — pass the SESSION, not a bare type.
 * `--s-long` (#5E4FB0) was declared in `globals.css`, documented in CLAUDE.md's
 * session colour map and in `ui-patterns.md`, and was **unreachable for any
 * engine-generated plan**: the engine models a long run as `type: 'easy'` (so
 * that §52/§9 ratio rules treat it as aerobic volume), and every surface
 * coloured by `SESSION_COLORS[session.type]`. So the week's anchor session
 * rendered identical to a 5 km shakeout. Same class as `--section-gap` and the
 * decorative-config family: declared, ratified, consumed by nothing.
 *
 * The long run is told apart by `isLongRun`, the existing single owner of that
 * question — NOT by matching words in the label, which the AI enricher rewrites
 * (D-17). A bare string is still accepted for the handful of call sites that
 * genuinely hold only a type; those cannot detect a long run, by construction.
 */
export function getSessionColor(session: ClassifiableSession | string): string {
  if (typeof session === 'string') return SESSION_COLORS[session] ?? 'var(--session-easy)'
  if (isLongRun(session)) return SESSION_COLORS.long
  return SESSION_COLORS[session.type ?? ''] ?? 'var(--session-easy)'
}

/** Returns the display label for a session type. Defaults to the raw type string. */
export function getSessionLabel(type: string): string {
  return SESSION_LABELS[type] ?? type
}
