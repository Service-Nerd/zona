// DayGridSelector — pure logic (no JSX/React), so it's node-testable without a
// DOM (see vitest.config.ts scope note). The .tsx presentation layer imports
// from here; DayGridSelector.test.ts tests this module directly.

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export const DAY_GRID: ReadonlyArray<{ key: DayKey; label: string }> = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
]

const DAY_ORDER: readonly DayKey[] = DAY_GRID.map(d => d.key)

/**
 * Pure toggle: the next selection when `key` is tapped.
 * - multiple: add if absent, remove if present; result always in Mon–Sun order.
 * - single: select `key`, or clear if it was already the sole selection.
 */
export function toggleDay(
  value: readonly DayKey[],
  key: DayKey,
  multiple: boolean,
): DayKey[] {
  if (!multiple) {
    return value.length === 1 && value[0] === key ? [] : [key]
  }
  const next = value.includes(key)
    ? value.filter(k => k !== key)
    : [...value, key]
  // Canonical Mon–Sun order regardless of tap order.
  return DAY_ORDER.filter(k => next.includes(k))
}
