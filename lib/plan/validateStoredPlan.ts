import type { Plan, GeneratorInput } from '@/types/plan'
import { validatePlan, validateReshapedPlan, type Violation } from './invariants'
import { validateBaseBuildBlock } from './baseBuildValidate'

/**
 * THE SINGLE OWNER of "validate a plan we have already stored", and the only
 * thing it decides is WHICH CONSTITUTION applies to this plan's KIND.
 *
 * ── WHY THIS EXISTS, AND IT WAS PREDICTED IN WRITING ─────────────────────────
 * `baseBuildValidate.ts`'s own header says it already:
 *
 *   "A SEPARATE VALIDATOR, NOT AN EXEMPTION... A base-build plan has no race
 *    week, no taper, no quality and no peak, so running it through
 *    `validatePlan` would fire a long tail of rules describing a race block it
 *    is not."
 *
 * The daily audit ran `validateReshapedPlan` over every stored plan without ever
 * asking what kind of plan it was. So the long tail fired, every night, on the
 * only two base-build plans in the fleet.
 *
 * 🔴 MEASURED AGAINST PRODUCTION, 2026-10-09:
 *
 *   plan_kind      plans   errors   mean
 *   (race)            32      262    8.2
 *   base_build         2      101   50.5     ← 28% of the whole fleet's errors
 *
 * Every one of those 101 is a phantom. The codes are
 * `INV-PLAN-PREP-TIME-STATUS-ANNOTATED`, `INV-PLAN-DIFFICULTY-ANNOTATED`,
 * `INV-PLAN-COMPRESSION-CLASSIFICATION` and friends — the validator asking a
 * plan with no start line whether it has annotated its prep time.
 *
 * ⚠️ THIS IS THE SECOND DAY RUNNING THAT THE CHECKER WAS THE BROKEN THING. On
 * 2026-10-08 one audit arm reported 49 phantom violations across 19 plans because
 * `week: 0` means "plan-wide" to the invariant layer and "a foundation week" to
 * ADR-020. Same shape: a correct rule pointed at a population it does not
 * describe. The founder's standing instruction covers exactly this — "when a plan
 * and a rule disagree, work out which one is wrong before you call anything a
 * defect."
 *
 * ── WHAT THIS DOES *NOT* DISPATCH, AND THE NUMBER ────────────────────────────
 * ⚠️ `plan_kind: 'maintenance'` still goes to `validateReshapedPlan`, which is
 * the same latent defect for that kind — `validateMaintenanceBlock` exists and is
 * the precedent `baseBuildValidate.ts` names. It is NOT dispatched here because
 * it needs three arguments (`baseWeeklyKm`, `injured`, `sourceRunDays`) that a
 * stored plan's meta does not reliably carry, and because there are **0
 * maintenance plans in production as of 2026-10-09**, so routing it on a guessed
 * base volume would trade a measured phantom for an unmeasured one. Filed as
 * `AUDIT-MAINTENANCE-KIND-01`. Declared, not fixed — and this comment says which.
 */
/** THE predicate. One place, so the two policies below cannot disagree about
 *  what a base-build plan is. */
export function isBaseBuildPlan(plan: Plan | null | undefined): boolean {
  return plan?.meta?.plan_kind === 'base_build'
}

/** §116's constitution, with the start volume the plan itself recorded.
 *  A plan missing `base_build_start_km` predates the field, and 0 is the honest
 *  floor — the curve-climbs check then compares against nothing rather than
 *  against a guess. */
function baseBuildErrors(plan: Plan): Violation[] {
  const startKm = Number((plan.meta as unknown as Record<string, unknown>).base_build_start_km ?? 0)
  return validateBaseBuildBlock(plan.weeks ?? [], startKm)
}

/**
 * For the DAILY AUDIT, which reads rows out of the database. Race plans get
 * `validateReshapedPlan` — it prefers the persisted input and tolerates a
 * legacy plan whose race week has already passed.
 */
export function validateStoredPlan(plan: Plan, reshapedWeekN?: number): Violation[] {
  return isBaseBuildPlan(plan) ? baseBuildErrors(plan) : validateReshapedPlan(plan, reshapedWeekN)
}

/**
 * For the SAVE PATH, which holds the input it generated from.
 *
 * ⚠️ DELIBERATELY `validatePlan`, NOT `validateReshapedPlan`, for a race plan.
 * The reshape variant skips `INV-PLAN-COVERS-RACE-DATE` and
 * `INV-PLAN-RACE-ON-RACE-DAY` because a reshape of a legacy plan cannot be held
 * to them — correct there, and a weakening of the save gate if reused here. Two
 * policies, one predicate: the dispatch is shared, the strictness is not.
 */
export function validateSavedPlan(plan: Plan, input: GeneratorInput): Violation[] {
  return isBaseBuildPlan(plan) ? baseBuildErrors(plan) : validatePlan(plan, input)
}
