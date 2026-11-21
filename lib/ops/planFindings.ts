import type { GeneratorInput, Plan } from '@/types/plan'
import { validateSavedPlan } from '@/lib/plan/validateStoredPlan'
import { recordOpsEvent } from './recordOpsEvent'

/**
 * ADR027-B0-PROD-FINDINGS — the verifier, observe-only, on every production generation
 * (ADR-027 B0; ARCH-ENG-011 "every finding is an event with a rule id").
 *
 * 🔑 WHY ONE EVENT PER GENERATION, EVEN A CLEAN ONE. `plan_rule_invalid` is written only when
 * a rule plan carries an ERROR, and only on the paid stream, so its absence cannot tell "clean"
 * from "never checked" from "free tier". `plan_findings` is written for every plan the route
 * returns, with its counts, so a zero is a measurement.
 *
 * ⚠️ `validateSavedPlan` IS THE OWNER, not `validatePlan`: it dispatches by `plan_kind`, so a
 * base-build plan is judged by §116's constitution rather than firing the race validator's long
 * tail (101 phantom errors on two plans, 2026-10-09).
 *
 * ⚠️ OBSERVE-ONLY. It never throws, never changes the plan and never delays the response:
 * `recordPlanFindings` yields a macrotask before validating, so even a caller that forgets to
 * defer it keeps validation off the request path.
 */

export const PLAN_FINDINGS_CODE_CAP = 40

export interface PlanFindingsDetail {
  codes: string[]
  errors: number
  warns: number
  kind: string
  engine_version?: string
  race_distance_km: number | null
}

/** Pure: the event's detail for a plan. `codes` is error + warn, deduped, capped. */
export function planFindingsDetail(plan: Plan, input: GeneratorInput): PlanFindingsDetail {
  const v = validateSavedPlan(plan, input)
  const errors = v.filter(x => x.severity === 'error')
  const warns = v.filter(x => x.severity === 'warn')
  const codes = Array.from(new Set([...errors, ...warns].map(x => x.code))).slice(0, PLAN_FINDINGS_CODE_CAP)
  const version = plan.meta?.generator_version
  return {
    codes,
    errors: errors.length,
    warns: warns.length,
    kind: plan.meta?.plan_kind ?? 'race',
    ...(version ? { engine_version: version } : {}),
    race_distance_km: typeof input.race_distance_km === 'number' ? input.race_distance_km : null,
  }
}

/** Never throws. A validator crash is itself recorded, as a finding about the checker. */
export async function recordPlanFindings(plan: Plan, input: GeneratorInput, userId: string | null): Promise<void> {
  try {
    await new Promise<void>(r => setTimeout(r, 0))
    await recordOpsEvent('plan_findings', planFindingsDetail(plan, input) as unknown as Record<string, unknown>, userId)
  } catch (e) {
    await recordOpsEvent('plan_findings', {
      codes: ['VERIFIER_THREW'], errors: 0, warns: 0,
      kind: plan?.meta?.plan_kind ?? 'race',
      message: (e instanceof Error ? e.message : String(e)).split('\n')[0].slice(0, 200),
      race_distance_km: typeof input?.race_distance_km === 'number' ? input.race_distance_km : null,
    }, userId)
  }
}
