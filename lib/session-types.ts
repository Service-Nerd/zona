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

/** Returns the accent colour for a session type. Defaults to easy blue for unknown types. */
export function getSessionColor(type: string): string {
  return SESSION_COLORS[type] ?? 'var(--session-easy)'
}

/** Returns the display label for a session type. Defaults to the raw type string. */
export function getSessionLabel(type: string): string {
  return SESSION_LABELS[type] ?? type
}
