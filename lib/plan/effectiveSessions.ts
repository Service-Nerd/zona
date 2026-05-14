import type { Session, Week } from '@/types/plan'

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export const DAY_KEYS: readonly DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export interface SessionOverride {
  week_n: number
  original_day: string
  new_day: string
}

export interface EffectiveSession {
  session: Session
  /** Day the session is *defined* on in week.sessions — and the completion key. */
  originalDay: DayKey
  /** True when the session has been moved/swapped out of its original slot. */
  isOverride: boolean
}

/**
 * Resolve a week's sessions after applying user move/swap overrides.
 * Returns a map keyed by the *slot* (calendar day) the session currently lives on,
 * not the day it was originally defined on. The original day is preserved on each
 * entry so callers can index into completions (which are keyed by original_day).
 */
export function resolveEffectiveSessions(
  week: Pick<Week, 'sessions'>,
  weekOverrides: ReadonlyArray<SessionOverride>,
): Partial<Record<DayKey, EffectiveSession>> {
  const out: Partial<Record<DayKey, EffectiveSession>> = {}
  const moved = new Set(weekOverrides.map(o => o.original_day))
  for (const key of DAY_KEYS) {
    if (moved.has(key)) continue
    const s = week.sessions[key]
    if (s) out[key] = { session: s, originalDay: key, isOverride: false }
  }
  for (const o of weekOverrides) {
    const s = week.sessions[o.original_day as DayKey]
    if (!s) continue
    out[o.new_day as DayKey] = {
      session: s,
      originalDay: o.original_day as DayKey,
      isOverride: true,
    }
  }
  return out
}

/** Look up where a given original_day's session currently lives after overrides. */
export function slotForOriginalDay(
  originalDay: string,
  weekOverrides: ReadonlyArray<SessionOverride>,
): DayKey {
  const o = weekOverrides.find(x => x.original_day === originalDay)
  return (o?.new_day ?? originalDay) as DayKey
}
