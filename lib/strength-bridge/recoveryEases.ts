// STRENGTH-RECOVERY-01 (S13; Design Board 2026-10-18) — the runner's answer to a recovery ease on a
// strength day, and the one place it is applied. Client-safe: the strength route applies it on the
// server, `useStrengthPlan` applies it after the runner taps, and both call `applyRecoveryEases`.
//
// Stored on `strength_plans.recovery_eases` (migration 20261018_strength_recovery_eases.sql) keyed by
// calendar date. "eased" serves that day's session through `easeForRecovery`; "declined" only means
// "do not ask again". Nothing is eased without an answer: the runner decides (S13).

import { easeForRecovery, type StrengthPlan, type StrengthSession } from '@/packages/strength'

export type RecoveryAnswer = 'eased' | 'declined'
export type RecoveryEases = Record<string, RecoveryAnswer>

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** A stored value of any shape becomes a clean map; anything else is dropped, never trusted. */
export function parseRecoveryEases(raw: unknown): RecoveryEases {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: RecoveryEases = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (DATE.test(k) && (v === 'eased' || v === 'declined')) out[k] = v
  }
  return out
}

/** A session a recovery ease can change: anything with load. Mobility has none, so it is never offered. */
export function strengthEaseEligible(s: StrengthSession | null | undefined): s is StrengthSession {
  return !!s && !!s.date && s.kind !== 'mobility'
}

/** The plan as the runner sees it: each session on an "eased" date served lighter (S13). */
export function applyRecoveryEases(plan: StrengthPlan, eases: RecoveryEases): StrengthPlan {
  if (!Object.values(eases).includes('eased')) return plan
  return {
    ...plan,
    weeks: plan.weeks.map(w => ({
      ...w,
      sessions: w.sessions.map(s => (s.date && eases[s.date] === 'eased' && strengthEaseEligible(s) && !s.eased_for ? easeForRecovery(s) : s)),
    })),
  }
}
