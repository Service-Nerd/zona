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
    const target = o.new_day as DayKey
    // ⚠️ A COLLISION MUST NOT SILENTLY DROP A SESSION (EFFSESS-COLLISION-01,
    // 2026-09-19). This line was a bare assignment, so a one-sided move onto an
    // OCCUPIED day overwrote whatever was sitting there and a two-session week
    // silently became a one-session week.
    //
    // It is reachable from the UI. `PlanCalendar.handleTargetTap` computes
    // `targetIsSwappable = !!targetSession && type !== 'rest' && not complete
    // && not skipped`, and `confirmPendingMove` routes to `onSwap` only when
    // that is true — so moving onto a day whose session is **already completed
    // or skipped** takes the one-sided `onMove` path with the target occupied.
    // The runner's completed session then vanished from the week, and its
    // completion row became unreachable because nothing pointed at its slot.
    //
    // Fixed HERE rather than only in the UI because this module is the single
    // owner with six callers, two of them server-side (`daily-coach-note`,
    // `push/send-daily`) which never run the UI's guard at all.
    //
    // The displaced session takes the day the mover VACATED — which is free by
    // construction, since the mover left it. That is a swap, which is what the
    // runner almost certainly meant, and it loses nothing. If the vacated day
    // is somehow also taken, the occupant keeps its slot and the override is
    // refused: never drop a session to satisfy a move.
    // ANY occupant is protected, not only an unmoved one. Guarding on
    // `!isOverride` left a second hole: two overrides landing on the same day
    // meant the first mover had `isOverride: true`, fell outside the guard, and
    // was overwritten by the second. Caught by the test below, which is why it
    // asserts the three-session case and not just the two.
    const occupant = out[target]
    if (occupant && occupant.originalDay !== o.original_day) {
      const vacated = o.original_day as DayKey
      if (out[vacated] === undefined) {
        out[vacated] = { ...occupant, isOverride: true }
      } else {
        continue  // nowhere safe to put it — keep the occupant, refuse the move
      }
    }
    out[target] = {
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
