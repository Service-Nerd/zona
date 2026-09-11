// RESHAPE-FIX-WAVE3 — Reshape magnitude calibration
//
// SLT 2026-06-26 (Wendy Wood lens): the original "kill auto-apply" framing
// would have ended habit-formation automaticity for every paid runner. The
// replacement is magnitude-calibrated confirmation: small things silent,
// structural things confirmed. This file is the single decision point.
//
// Doctrine: CoachingPrinciples §69 — "Magnitude calibration: the structural
// change that earns confirmation." Numerics in
// `GENERATION_CONFIG.RESHAPE_AUTOAPPLY_THRESHOLDS`. ADR-012 for the
// architectural rationale.
//
// What replaces what:
// - Pre-fix: each builder set `requiresConfirmation` based on its own ad-hoc
//   rule (e.g., reorder only flagged on §7 alternation violations). The
//   2026-06-26 incident's tue↔thu swap that landed the long run on Tuesday
//   was classified `requiresConfirmation: false` — no §7 violation fired, so
//   the engine auto-applied a structural change with no consent.
// - Post-fix: the route calls `computeReshapeMagnitude(proposed)` after the
//   builder runs and uses the magnitude as the authoritative
//   requiresConfirmation. Builder `requiresConfirmation` is no longer the
//   source of truth — magnitude is.
//
// The helper is pure; tests cover the 2026-06-26 incident shape as the
// lead regression case.

import type { ProposedAdjustment } from './planAdjustment'
import { computeSessionDiff, type SessionLike } from './diff/sessionDiff'
import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'

export type ReshapeMagnitude = 'high' | 'low'

/**
 * Decide whether a proposed adjustment needs runner confirmation.
 *
 * High-magnitude cases (always confirm):
 * - Skip-with-reason (the runner missed work — they should sign off on
 *   how the engine absorbs it)
 * - User-initiated session_reorder (any day-of-week move is structural by
 *   definition — the pre-Wave-3 path missed this and shipped the
 *   2026-06-26 incident)
 * - Pre-session readiness signal (quality-day softening is a real call;
 *   the runner deserves to see it before the morning slot fills)
 * - Diff contains `replaced` / `added` / `removed` for any day (session
 *   type change at a slot)
 * - Diff contains `modified` with >`DISTANCE_CHANGE_PCT_THRESHOLD` % change
 *   on a single session
 * - Week-total distance change >`WEEK_VOLUME_PCT_THRESHOLD` % (catches
 *   compound small trims)
 *
 * Low-magnitude cases (auto-apply silently, log to "what we changed this
 * week" surface):
 * - Coach-note-only adjustments (`adjustmentType === 'flag_for_review'`)
 * - Sub-threshold distance trims (≤15% per session AND ≤15% week-total)
 *
 * Pure function — no I/O, deterministic given the same input.
 */
export function computeReshapeMagnitude(
  proposed: ProposedAdjustment,
  config = GENERATION_CONFIG.RESHAPE_AUTOAPPLY_THRESHOLDS,
): ReshapeMagnitude {
  const triggerType = proposed.trigger.type

  // Always-high triggers regardless of diff size
  if (triggerType === 'skip_with_reason')   return 'high'
  if (triggerType === 'session_reorder')    return 'high'
  if (triggerType === 'readiness_signal')   return 'high'

  // Coach-note-only — no structural impact on the plan
  if (proposed.adjustmentType === 'flag_for_review') return 'low'

  // Structural diff inspection
  const diff = computeSessionDiff(
    proposed.sessionsBefore as ReadonlyArray<SessionLike | null | undefined>,
    proposed.sessionsAfter  as ReadonlyArray<SessionLike | null | undefined>,
  )

  for (const entry of diff) {
    if (entry.kind === 'replaced' || entry.kind === 'added' || entry.kind === 'removed') {
      return 'high'
    }
    if (entry.kind === 'modified' && entry.before && entry.after) {
      // SESSION-KM-02 (2026-09-11) — was `distance_km ?? 0` on both sides, and
      // the `beforeKm > 0` guard then made this check UNREACHABLE for a
      // duration-anchored session. A beginner's plan is duration-anchored
      // (measured: 95.8% of their sessions), so ADR-012's >15% structural-change
      // threshold never ran for them: **a beginner's session could be trimmed
      // silently where an experienced runner's identical trim surfaced a
      // confirmation tile.** That is the 2026-06-26 incident class — a plan
      // changing under someone without their consent — reintroduced for the one
      // cohort least able to tell it had happened.
      //
      // Compared on whichever axis the session is ANCHORED. For a
      // duration-anchored session the duration IS the prescription, so a
      // minutes-to-minutes comparison is both simpler and more faithful than
      // converting to km and back. Same threshold either way — ADR-012's
      // magnitude question is "did this change materially", not "by how many km".
      const beforeKm = entry.before.distance_km
      const afterKm  = entry.after.distance_km
      const beforeMins = entry.before.duration_mins
      const afterMins  = entry.after.duration_mins
      const [before, after] = (beforeKm != null && afterKm != null)
        ? [beforeKm, afterKm]
        : (beforeMins != null && afterMins != null)
          ? [beforeMins, afterMins]
          : [0, 0]
      if (before > 0) {
        const pctChange = Math.abs(after - before) / before * 100
        if (pctChange > config.DISTANCE_CHANGE_PCT_THRESHOLD) return 'high'
      }
    }
  }

  // Cumulative week-volume check — catches compound small trims
  const beforeTotal = sumDistances(proposed.sessionsBefore)
  const afterTotal  = sumDistances(proposed.sessionsAfter)
  if (beforeTotal > 0) {
    const weekPctChange = Math.abs(afterTotal - beforeTotal) / beforeTotal * 100
    if (weekPctChange > config.WEEK_VOLUME_PCT_THRESHOLD) return 'high'
  }

  return 'low'
}

function sumDistances(sessions: ReadonlyArray<SessionLike | null | undefined>): number {
  let total = 0
  for (const s of sessions) {
    if (s && typeof s.distance_km === 'number' && s.distance_km > 0) {
      total += s.distance_km
    }
  }
  return total
}
