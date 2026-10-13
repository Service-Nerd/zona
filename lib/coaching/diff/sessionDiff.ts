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
import { isLongRun } from '@/lib/plan/sessionRole'

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

/** Exported so a caller can BUILD the 7-element array this module requires
 *  rather than guess at it — `MODIFY-DIFF-DAY-MAP-01`, where a caller passed a
 *  compact `Object.values(week.sessions)` and every day label was wrong. */
export const DIFF_DAY_ORDER = DAY_ORDER
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
  // 🔴 THE ZIP-PADDING BELOW IS WHAT HID `MODIFY-DIFF-DAY-MAP-01` FOR AS LONG AS
  // IT EXISTED. A caller passing a COMPACT array (only the days that have a
  // session) got a silently plausible answer with every day label shifted. The
  // padding stays — a short array from the database is a real defensive case —
  // but it is no longer silent: outside production this now throws, and the one
  // caller that was wrong is the reason the contract needed teeth rather than a
  // docstring (CB-FOUNDATION-DENOM-01: a defect class that cannot occur beats a
  // check that catches it).
  // ⚠️ EMPTY IS NOT SHORT. A caller with NOTHING to diff passes `[]` — the Plan
  // adjustments door does exactly that when there is no pending change, and the
  // first cut of this guard threw on it. Zero means "no data" and is allowed;
  // any OTHER length that is not 7 is a compact array and is the defect.
  const malformed = (n: number) => n !== 0 && n !== DAY_ORDER.length
  if (malformed(before.length) || malformed(after.length)) {
    const detail = `computeSessionDiff expects ${DAY_ORDER.length}-element day-indexed arrays `
      + `(mon=0…sun=6); got before=${before.length}, after=${after.length}. `
      + 'Build them with DIFF_DAY_ORDER.map(d => week.sessions[d] ?? null), never Object.values().'
    if (process.env.NODE_ENV !== 'production') throw new Error(detail)
    console.error('[sessionDiff] ' + detail)
  }
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
  // PROMPT-UNITS-ADJUST-01 — `units` travels with the diff, because every line it
  // emits runs through `labelSession`, which formats a distance. It stays optional
  // here (default 'km') only because `labelSession`'s own default is, and changing
  // both at once would widen this item into every diff consumer; the one caller
  // that could not answer — the adjustment prompt — now does.
  opts: { includeUnchanged?: boolean; units?: DistanceUnits } = {},
): string[] {
  const units: DistanceUnits = opts.units ?? 'km'
  const out: string[] = []
  for (const e of diff) {
    const dayLabel = e.day.charAt(0).toUpperCase() + e.day.slice(1)
    if (e.kind === 'unchanged') {
      if (opts.includeUnchanged && e.before) {
        out.push(`${dayLabel}: ${labelSession(e.before, units)} (unchanged)`)
      }
      continue
    }
    if (e.kind === 'added' && e.after) {
      out.push(`${dayLabel}: + ${labelSession(e.after, units)}`)
      continue
    }
    if (e.kind === 'removed' && e.before) {
      out.push(`${dayLabel}: − ${labelSession(e.before, units)} (now empty)`)
      continue
    }
    if (e.kind === 'replaced' && e.before && e.after) {
      out.push(`${dayLabel}: ${labelSession(e.before, units)} → ${labelSession(e.after, units)}`)
      continue
    }
    if (e.kind === 'modified' && e.before && e.after) {
      out.push(`${dayLabel}: ${labelSession(e.before, units)} → ${labelSession(e.after, units)}`)
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
  // 🔴 AMENDMENT 4 (Design Board MODIFY-CONFIRM-DIFF-01, 2026-10-13) — READ THE
  // ROLE, NOT THE TYPE. A long run is `type: 'easy'` with `role: 'long_run'`
  // (so §52/§9's ratio rules treat it as aerobic volume), so this printed
  // "easy 17km" for the longest run of the runner's week — on the screen asking
  // them to accept a whole-plan rewrite.
  //
  // 📐 Measured across all 35 live plans: 371 long runs, **371 labelled "easy"**.
  // Every long run in every diff this product has rendered.
  //
  // ⚠️ `sessionRole.ts` is the documented single owner of session
  // classification (INV-CLASS) and this is the parallel-classifier class the
  // repo has shipped twice before. Wroblewski routed it OUT of the board as a
  // defect rather than a design question, and he was right to.
  const type = isLongRun(s as Parameters<typeof isLongRun>[0]) ? 'long run' : String(s.type ?? 'session')
  if (type === 'rest') return 'rest'
  if (typeof s.distance_km === 'number' && s.distance_km > 0) {
    // UPNEXT-EXACT-01 — a PRESCRIBED distance, so whole units, same as the card.
    // `exact: true` here rendered "easy 5.3mi" in the adjustment diff beside a
    // session card reading "5mi" for the same 8.5 km run. ADR-015: planned
    // distances round to whole units; `exact` belongs to MEASURED values.
    return `${type} ${formatDistance(s.distance_km, units)}`
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
