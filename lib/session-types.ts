/**
 * Canonical session type → colour and label resolution.
 * This is the SINGLE owner of this mapping — see docs/canonical/session-types.md.
 * No component or utility should define its own colour/label map.
 */

export const SESSION_COLORS: Record<string, string> = {
  easy:          '#4A90D9',
  run:           '#7B68EE',
  long:          '#7B68EE',
  quality:       '#F2C14E',
  tempo:         '#F2C14E',
  intervals:     '#E05A5A',
  hard:          '#E05A5A',
  race:          '#E8833A',
  recovery:      '#5BAD8C',
  strength:      '#3A506B',
  'cross-train': '#5BC0BE',
  cross:         '#5BC0BE', // legacy alias — hand-authored gists may use 'cross'
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
  return SESSION_COLORS[type] ?? '#4A90D9'
}

/** Returns the display label for a session type. Defaults to the raw type string. */
export function getSessionLabel(type: string): string {
  return SESSION_LABELS[type] ?? type
}
