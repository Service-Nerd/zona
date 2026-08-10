// RESHAPE-FIX-WAVE2A — Session diff
//
// Pure utility: given two 7-element session arrays (mon→sun ordered),
// produce a structured per-day diff. Used by:
//
//   1. The reshape route's AI prompt — the model is fed the diff
//      explicitly rather than left to infer it from `sessions_before` +
//      `sessions_after` raw JSON. Eliminates the class of confabulation
//      seen in the 2026-06-26 incident where Sonnet wrote "the 24km run
//      stays intact" while moving it sun → tue.
//
//   2. `validateSummaryAgainstDiff` — checks the AI's prose claims
//      against the diff facts; rejects contradictions.
//
//   3. `<AdjustmentDiff />` — the per-day before/after strip rendered
//      under the PendingAdjustmentBanner prose. The user sees the
//      structural change in plain terms before tapping Confirm.
//
// The diff is intentionally coarse: each day is `unchanged`, `modified`
// (same session type, different details), or `replaced` (different
// session type — the structural case the brand voice rule cares about).
// `removed` / `added` are kept for completeness even though the engine
// shouldn't currently produce them (a 7-day week stays 7 days).

import { formatDistance, formatDuration, type DistanceUnits } from '@/lib/format'

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
type Day = typeof DAY_ORDER[number]

/**
 * Structural shape the diff needs to compare. Deliberately loose — accepts
 * `Session` from `@/types/plan` (its `type` field is the strict `SessionType`
 * enum but TS widens it to `string` here, which is fine — diff doesn't need
 * the enum), and accepts JSON-parsed session objects coming back from the
 * `plan_adjustments` table where `type` is just `string`. Additional fields
 * on the source object are ignored; the diff only cares about these four.
 */
export type SessionLike = {
  type:           string
  label?:         string | null
  distance_km?:   number | null
  duration_mins?: number | null
}

export type DiffKind = 'unchanged' | 'modified' | 'replaced' | 'removed' | 'added'

export interface DiffEntry {
  day:    Day
  kind:   DiffKind
  before: SessionLike | null
  after:  SessionLike | null
}

/**
 * Compute the per-day diff between two 7-element session arrays.
 *
 * Indexed mon=0 … sun=6, matching `DAY_ORDER`. Inputs that aren't
 * exactly 7 entries are zip-padded with `null` — this is defensive;
 * a well-formed reshape proposal always passes 7+7 by contract (see
 * `checkAdjustmentTriggers` length-7 invariant, RESHAPE-FIX-WAVE1).
 *
 * Rules:
 * - Both null  → unchanged
 * - Only before → removed
 * - Only after  → added
 * - Same type   → unchanged if all material fields match, else modified
 * - Different type → replaced (this is the "structural change" case)
 *
 * "Material fields" = `type`, `label`, `distance_km`, `duration_mins`.
 * Coach notes, HR targets, RPE targets, etc. are not material — they
 * can be edited by the AI enricher without the user needing to see a
 * structural diff card.
 */
export function computeSessionDiff(
  before: ReadonlyArray<SessionLike | null | undefined>,
  after:  ReadonlyArray<SessionLike | null | undefined>,
): DiffEntry[] {
  return DAY_ORDER.map((day, idx) => {
    const b = (before[idx] ?? null) as SessionLike | null
    const a = (after[idx]  ?? null) as SessionLike | null

    if (b == null && a == null) {
      return { day, kind: 'unchanged', before: null, after: null }
    }
    if (b == null && a != null) {
      return { day, kind: 'added', before: null, after: a }
    }
    if (b != null && a == null) {
      return { day, kind: 'removed', before: b, after: null }
    }
    // Both non-null
    const bb = b as SessionLike
    const aa = a as SessionLike
    if (bb.type !== aa.type) {
      return { day, kind: 'replaced', before: bb, after: aa }
    }
    const same =
      bb.label         === aa.label &&
      bb.distance_km   === aa.distance_km &&
      bb.duration_mins === aa.duration_mins
    return {
      day,
      kind:   same ? 'unchanged' : 'modified',
      before: bb,
      after:  aa,
    }
  })
}

/**
 * Coarse boolean: did anything structural change?
 * True iff any day's `kind !== 'unchanged'`.
 */
export function hasStructuralChange(diff: DiffEntry[]): boolean {
  return diff.some(e => e.kind !== 'unchanged')
}

/**
 * Human-readable per-day summary. Used to feed the AI prompt and to
 * back the `validateSummaryAgainstDiff` checks. Plain prose, one line
 * per non-unchanged day, mon→sun.
 *
 * Examples:
 *   "Sun: long 24km → Tue (now rest)"
 *   "Wed: easy 8km → strength mobility"
 *   "Fri: easy 10km (unchanged)"  ← only emitted when `includeUnchanged`
 *
 * Day labels are 3-letter caps (`Mon`, `Tue`, …).
 */
export function summariseDiff(
  diff: DiffEntry[],
  opts: { includeUnchanged?: boolean } = {},
): string[] {
  const out: string[] = []
  for (const e of diff) {
    const dayLabel = e.day.charAt(0).toUpperCase() + e.day.slice(1)
    if (e.kind === 'unchanged') {
      if (opts.includeUnchanged && e.before) {
        out.push(`${dayLabel}: ${labelSession(e.before)} (unchanged)`)
      }
      continue
    }
    if (e.kind === 'added' && e.after) {
      out.push(`${dayLabel}: + ${labelSession(e.after)}`)
      continue
    }
    if (e.kind === 'removed' && e.before) {
      out.push(`${dayLabel}: − ${labelSession(e.before)} (now empty)`)
      continue
    }
    if (e.kind === 'replaced' && e.before && e.after) {
      out.push(`${dayLabel}: ${labelSession(e.before)} → ${labelSession(e.after)}`)
      continue
    }
    if (e.kind === 'modified' && e.before && e.after) {
      out.push(`${dayLabel}: ${labelSession(e.before)} → ${labelSession(e.after)}`)
      continue
    }
  }
  return out
}

/**
 * Short label for a session — type + size if known. Used by
 * `summariseDiff` and by the `<AdjustmentDiff />` renderer.
 *
 * Examples:
 *   { type: 'rest' }                                  → "rest"
 *   { type: 'easy', distance_km: 8 }                  → "easy 8km"  ("easy 5mi" with units='mi')
 *   { type: 'long', duration_mins: 180 }              → "long 3h"
 *   { type: 'strength', label: 'Mobility only' }      → "strength (Mobility only)"
 */
export function labelSession(s: SessionLike, units: DistanceUnits = 'km'): string {
  const type = String(s.type ?? 'session')
  if (type === 'rest') return 'rest'
  if (typeof s.distance_km === 'number' && s.distance_km > 0) {
    return `${type} ${formatDistance(s.distance_km, units, { exact: true })}`
  }
  if (typeof s.duration_mins === 'number' && s.duration_mins > 0) {
    return `${type} ${formatDuration(s.duration_mins)}`
  }
  // Non-distance/duration session (strength, cross, etc.) — surface label
  // when present, otherwise just the type.
  if (typeof s.label === 'string' && s.label.length > 0) {
    return `${type} (${s.label})`
  }
  return type
}
