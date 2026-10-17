// STRENGTH-NOTE-01 — the cache key for one week's note: the week number plus a hash of
// that week's sessions, so re-placing the week (the run plan moved) misses the cache
// instead of showing a note about sessions the week no longer has. Pure; client-safe.

import type { StrengthWeek } from '@/packages/strength'

export function weekNoteKey(w: StrengthWeek): string {
  const shape = w.sessions.map(s => `${s.date}|${s.kind}|${s.estimated_minutes}|${s.heavy_legs ? 1 : 0}`).join(',')
  let h = 5381
  for (let i = 0; i < shape.length; i++) h = ((h << 5) + h + shape.charCodeAt(i)) >>> 0
  return `${w.n}:${h.toString(36)}`
}
