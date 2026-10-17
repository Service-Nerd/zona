// READINESS-SURFACE-01 item 3 (Design Board, 2026-10-17) — the "Eased for recovery" record.
//
// One owner for the words and for the question "was this session eased for recovery?", so the
// session card, the Plan row and the session screen cannot disagree. The fact lives ON the session
// (`eased_for`, stamped by the readiness producer), so it reaches the plan only when the runner
// confirms the ease and leaves it when they revert.

import type { Session } from '@/types/plan'

/** The mark's words (Design Board ruling). A TEXT mark: never a colour, a tile or a count. */
export const EASED_FOR_RECOVERY_LABEL = 'Eased for recovery'

export function isEasedForRecovery(s: Pick<Session, 'eased_for'> | null | undefined): boolean {
  return s?.eased_for === 'recovery'
}

/**
 * "Changed this week" (PlanAdjustmentsScreen) lists what the plan changed without a fresh decision:
 * silent `auto_applied` changes, and recovery eases the runner confirmed (READINESS-SURFACE-01).
 * A PostgREST `or` filter, owned here so the query and its test read one string.
 */
export const RECENT_CHANGES_FILTER =
  'status.eq.auto_applied,and(status.eq.confirmed,trigger_type.eq.readiness_signal)'
