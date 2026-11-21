// FREE — infrastructure. ADR-027 B1 (ADR027-B1-CONTRACTS).
//
// Decision: what L3 set, and which rule bound it (L4 writes notes from these only,
// ARCH-ENG-009). Finding: what L5 found (ARCH-ENG-011: every finding is an event with
// a rule id, recorded as an `ops_events` kind; no new table).
//
// `findingFromViolation` bridges today's `validatePlan` output into a Finding, so B0's
// observe-only verifier and B3's verifier emit the same record.

import { z } from 'zod'
import type { Violation } from '@/lib/plan/invariants'
import { RuleIdSchema, type RuleId } from './rule'
import type { DayKey } from './profile'

/** The input a runner can change to move a bound. Named by input field, never by copy. */
export interface Lever {
  field:
    | 'race_date' | 'days_available' | 'days_cannot_train' | 'max_weekday_mins' | 'day_budgets'
    | 'current_weekly_km' | 'longest_recent_run_km' | 'goal' | 'target_time' | 'race_distance_km'
    | 'acknowledged_prep_warning' | 'acknowledged_days_warning' | 'accept_base_build'
  /** Which way moving it helps. */
  direction: 'increase' | 'decrease' | 'later' | 'earlier' | 'set' | 'acknowledge'
}

export interface Decision {
  /** What was set, as a path: `week.volume_km`, `session.distance_km`, `plan.peak_km`. */
  what: string
  week: number | null
  day: DayKey | null
  value: number | string | boolean | null
  unit: 'km' | 'min' | 'bpm' | 'pct' | 'sessions' | null
  /** The rule that set or capped it. */
  bound_by: RuleId
  /** What the runner could change to move it; null when nothing they control would. */
  lever: Lever | null
}

export const FindingSchema = z.strictObject({
  rule_id: RuleIdSchema,
  severity: z.enum(['error', 'warn']),
  /** null for a plan-level finding. */
  week: z.number().int().nullable(),
  detail: z.string(),
  /** The stamp of the input that produced the plan. null only for a stored v1 plan
   *  built before stamping, where there is no hash to give. */
  input_hash: z.string().min(1).nullable(),
})
export type Finding = z.infer<typeof FindingSchema>

/** `Violation.week` uses 0 for plan-level checks. */
export function findingFromViolation(v: Violation, inputHash: string | null): Finding {
  return FindingSchema.parse({
    rule_id: v.code,
    severity: v.severity,
    week: v.week > 0 ? v.week : null,
    detail: v.message,
    input_hash: inputHash,
  })
}
