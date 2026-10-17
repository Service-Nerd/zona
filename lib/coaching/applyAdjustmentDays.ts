// READINESS-WRONG-DAY-01 (2026-10-17) — the ONE owner of "write an adjustment's sessions
// back into the plan week". Used by confirm-adjustment (before → after) and
// revert-adjustment (after → before).
//
// 🔴 WHY IT EXISTS. Both routes did `days.forEach((day, idx) => week.sessions[day] = list[idx])`:
// a positional write that is only correct when the stored list is the full week, Mon → Sun.
// The readiness route stored ONE session, so accepting a recovery ease would have written
// it onto MONDAY and left today hard. And a positional write rewrites all seven days, so a
// change made to any other day since the adjustment was proposed was silently undone.
//
// Now: the list must be exactly seven (a malformed row is REFUSED, never guessed at), and
// only the days that actually differ between the two lists are written.

import type { Session, Week } from '@/types/plan'

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export type ApplyResult = { ok: true; changed: (typeof DAYS)[number][] } | { ok: false; reason: 'malformed' }

export function applyAdjustmentDays(week: Pick<Week, 'sessions'>, from: unknown, to: unknown): ApplyResult {
  if (!Array.isArray(from) || !Array.isArray(to) || from.length !== 7 || to.length !== 7) return { ok: false, reason: 'malformed' }
  const changed: (typeof DAYS)[number][] = []
  DAYS.forEach((day, i) => {
    if (JSON.stringify(from[i]) === JSON.stringify(to[i])) return
    if (to[i] == null) return
    ;(week.sessions as Record<string, Session>)[day] = to[i] as Session
    changed.push(day)
  })
  return { ok: true, changed }
}
