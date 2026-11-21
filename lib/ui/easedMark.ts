// READINESS-SURFACE-01 item 3 (Design Board, 2026-10-17) — the "Eased for recovery" record.
//
// One owner for the words and for the question "was this session eased for recovery?", so the
// session card, the Plan row and the session screen cannot disagree. The fact lives ON the session
// (`eased_for`, stamped by the readiness producer), so it reaches the plan only when the runner
// confirms the ease and leaves it when they revert.

import type { Session } from '@/types/plan'
import { OBSERVATION_TRIGGERS } from '@/lib/coaching/adjustmentLedger'

/** The mark's words (Design Board ruling). A TEXT mark: never a colour, a tile or a count. */
export const EASED_FOR_RECOVERY_LABEL = 'Eased for recovery'

export function isEasedForRecovery(s: Pick<Session, 'eased_for'> | { eased_for?: 'recovery' } | null | undefined): boolean {
  return s?.eased_for === 'recovery'
}

/**
 * "Changed this week" (PlanAdjustmentsScreen) lists what the plan changed without a fresh decision:
 * silent `auto_applied` changes, and recovery eases the runner confirmed (READINESS-SURFACE-01).
 * A PostgREST `or` filter, owned here so the query and its test read one string.
 */
// WATCHED-SIGNALS-DISCLOSURE-01 — an observation (`OBSERVATION_TRIGGERS`) is stored as
// `auto_applied` but changed nothing, so it is not listed as a change.
export const RECENT_CHANGES_FILTER =
  `and(status.eq.auto_applied,trigger_type.not.in.(${OBSERVATION_TRIGGERS.join(',')})),and(status.eq.confirmed,trigger_type.eq.readiness_signal)`
