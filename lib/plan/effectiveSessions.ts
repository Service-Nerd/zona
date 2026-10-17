import type { Session, Week } from '@/types/plan'
import { canDouble } from './doubles'

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export const DAY_KEYS: readonly DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export type Slot = 'am' | 'pm'

export interface SessionOverride {
  week_n: number
  original_day: string
  new_day: string
  /** SESSION-SLOTS-01 (ADR-025) — which half of a shared day. Null/absent: the day's only session. */
  new_slot?: Slot | null
}

export interface EffectiveSession {
  session: Session
  /** Day the session is *defined* on in week.sessions — and the completion key. */
  originalDay: DayKey
  /** True when the session has been moved/swapped out of its original slot. */
  isOverride: boolean
  /** SESSION-SLOTS-01 — AM / PM when the day holds two sessions; null when it holds one. */
  slot: Slot | null
}

/**
 * The week the runner sees, after their moves and swaps: for each calendar day, the
 * sessions on it, AM before PM. The original day is preserved on each entry so callers
 * can index into completions (which are keyed by original_day).
 *
 * SESSION-SLOTS-01 (ADR-025). A day is a LIST so no caller can assume one session.
 * **Phase 2:** a move carrying `new_slot` onto an occupied day becomes a DOUBLE only when
 * §126 allows it (`canDouble`: both runs easy or recovery, never race week). The mover
 * takes its slot, the occupant the other half, and the mover's own day is left empty.
 * A slotted move §126 forbids is treated as an ordinary move, so it swaps exactly as an
 * unslotted one does (EFFSESS-COLLISION-01) and never drops a session.
 */
export function resolveEffectiveDay(
  week: Pick<Week, 'sessions'> & { type?: string; badge?: string },
  weekOverrides: ReadonlyArray<SessionOverride>,
): Partial<Record<DayKey, EffectiveSession[]>> {
  const plain = weekOverrides.filter(o => !o.new_slot)
  const fallback: SessionOverride[] = []
  const doubles: SessionOverride[] = []
  for (const o of weekOverrides.filter(x => x.new_slot)) {
    const base = resolveOnePerDay(week, [...plain, ...fallback])
    const occupant = base[o.new_day as DayKey]
    const mover = week.sessions[o.original_day as DayKey]
    const free = !doubles.some(d => d.new_day === o.new_day)
    if (occupant && mover && occupant.originalDay !== o.original_day && free && canDouble(occupant.session, mover, week)) doubles.push(o)
    else fallback.push(o)
  }
  const one = resolveOnePerDay(week, [...plain, ...fallback])
  const out: Partial<Record<DayKey, EffectiveSession[]>> = {}
  for (const k of DAY_KEYS) { const e = one[k]; if (e) out[k] = [e] }
  for (const d of doubles) {
    const from = d.original_day as DayKey, to = d.new_day as DayKey
    if (out[from]?.[0]?.originalDay === from) delete out[from]
    const occupant = out[to]![0]
    const mover: EffectiveSession = { session: week.sessions[from]!, originalDay: from, isOverride: true, slot: d.new_slot! }
    const other: EffectiveSession = { ...occupant, slot: d.new_slot === 'am' ? 'pm' : 'am' }
    out[to] = mover.slot === 'am' ? [mover, other] : [other, mover]
  }
  return out
}

/**
 * The day's single session, for a caller that has not yet been taught about two
 * (Phase 4 of ADR-025 teaches each). Named, not `[0]`, so every such caller is countable:
 * `effectiveWeekOwner.test.ts` holds the number and it may only fall.
 */
export function soleSession<T>(list: readonly T[] | undefined): T | undefined {
  return list?.[0]
}

function resolveOnePerDay(
  week: Pick<Week, 'sessions'>,
  weekOverrides: ReadonlyArray<SessionOverride>,
): Partial<Record<DayKey, EffectiveSession>> {
  const out: Partial<Record<DayKey, EffectiveSession>> = {}
  const moved = new Set(weekOverrides.map(o => o.original_day))
  for (const key of DAY_KEYS) {
    if (moved.has(key)) continue
    const s = week.sessions[key]
    if (s) out[key] = { session: s, originalDay: key, isOverride: false, slot: null }
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
      slot: null,
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
