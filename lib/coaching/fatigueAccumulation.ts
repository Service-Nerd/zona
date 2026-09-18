// CoachingPrinciples §112 — the single owner of "has this runner reported
// consecutive cost, and does that soften the long run?"
//
// WHY A MODULE AND NOT AN INLINE PREDICATE. The check lived as a `.every()`
// inside `planAdjustment.ts` and the window was assembled in
// `app/api/adjust-plan/route.ts`. Two halves of one rule, in two files, neither
// naming the principle — and the principle did not exist either (§112 records
// that `§R20-T4` was cited for a year and was never written). Producer and
// checker in different modules is the shape this repo has paid for repeatedly.
//
// WHAT CHANGED AT §112. A session SKIPPED because the runner was too tired to
// start now counts as evidence. A runner who logs 'Heavy' COMPLETED the
// session; one who reports 'Too tired' could not begin it, which Willy holds is
// the stronger signal. Before this the trigger could not observe them at all:
// they did not run, so they logged no tag, so the window's consecutiveness
// broke on the very sessions that were most costly.
//
// ⚠️ AND IT BROKE IT BOTH WAYS. Before FIRSTRUN-MISSED-01 part 1, a skip put
// 'Too tired' into `fatigue_tag`, which never matched, so the chain broke.
// After part 1, the row carries `fatigue_tag = null`, so the chain STILL broke.
// Moving the column fixed the storage and left the signal exactly as unreachable
// — this module is the half that makes it count.

import {
  FATIGUE_HIGH_TAGS,
  FATIGUE_ACCUMULATION_THRESHOLD,
  FATIGUE_COUNTING_SKIP_REASONS,
  FATIGUE_WINDOW_REQUIRES_LOGGED_SESSION,
} from './constants'

/** The two columns a completion can report cost through (FIRSTRUN-MISSED-01). */
export interface FatigueSignalRow {
  fatigue_tag?: string | null
  skip_reason?: string | null
}

/** What a single completion contributes to the window. */
export type FatigueSignal =
  | { kind: 'logged'; tag: string }   // ran it, tagged it high
  | { kind: 'skipped'; reason: string } // could not start, and the reason is fatigue
  | null                                // no cost reported, or not a fatigue reason

/**
 * Read one completion's contribution.
 *
 * ⚠️ A logged fatigue tag wins over a skip reason. A row should never carry
 * both — §112's storage split guarantees it — but if one ever does, the session
 * the runner actually RAN is the better evidence.
 */
export function fatigueSignalOf(row: FatigueSignalRow | null | undefined): FatigueSignal {
  if (!row) return null
  const tag = row.fatigue_tag
  if (typeof tag === 'string' && (FATIGUE_HIGH_TAGS as readonly string[]).includes(tag)) {
    return { kind: 'logged', tag }
  }
  const reason = row.skip_reason
  if (typeof reason === 'string' && (FATIGUE_COUNTING_SKIP_REASONS as readonly string[]).includes(reason)) {
    return { kind: 'skipped', reason }
  }
  return null
}

export interface FatigueWindowVerdict {
  fires: boolean
  /** How many of the trailing window reported cost. */
  consecutive: number
  /** How many of those were sessions the runner actually ran. */
  logged: number
  /** How many were skips. */
  skipped: number
}

/**
 * Does the trailing window fire §112's softening?
 *
 * `rows` must be CHRONOLOGICAL, oldest first — consecutiveness is the whole
 * rule, so an unsorted input silently changes the answer.
 *
 * Two conditions, both from the board:
 *  1. The last `FATIGUE_ACCUMULATION_THRESHOLD` completions all reported cost.
 *  2. `FATIGUE_WINDOW_REQUIRES_LOGGED_SESSION` — at least one of them was a
 *     session the runner RAN. McMillan's dissent at its cheapest price: "too
 *     tired" on a Tuesday is often a bad night's sleep, so a skip may CONTRIBUTE
 *     to the window but may not fill it alone. A runner who only ever skips is a
 *     different problem and not this rule's job.
 */
export function assessFatigueWindow(
  rows: readonly FatigueSignalRow[],
): FatigueWindowVerdict {
  const empty = { fires: false, consecutive: 0, logged: 0, skipped: 0 }
  if (!Array.isArray(rows) || rows.length < FATIGUE_ACCUMULATION_THRESHOLD) return empty

  const window = rows.slice(-FATIGUE_ACCUMULATION_THRESHOLD).map(fatigueSignalOf)
  if (window.some(s => s === null)) return empty

  const logged  = window.filter(s => s?.kind === 'logged').length
  const skipped = window.filter(s => s?.kind === 'skipped').length

  return {
    fires: FATIGUE_WINDOW_REQUIRES_LOGGED_SESSION ? logged > 0 : true,
    consecutive: window.length,
    logged,
    skipped,
  }
}
