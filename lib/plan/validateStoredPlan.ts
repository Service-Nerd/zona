import type { Plan, GeneratorInput } from '@/types/plan'
import { validatePlan, validateReshapedPlan, validateMaintenanceBlock, type Violation } from './invariants'
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
 * ✅ **`plan_kind: 'maintenance'` IS NOW DISPATCHED (AUDIT-MAINTENANCE-KIND-01,
 * 2026-10-09).** It was previously declared as a known gap here, on the grounds that
 * `validateMaintenanceBlock` needs three arguments a stored plan's meta does not
 * carry. That was true and is now fixed at the source: the maintenance route stamps
 * `source_base_weekly_km`, `source_run_days_per_week` and `source_injured`, because
 * that route is the only place all three exist.
 *
 * ⚠️ A plan without the stamp falls through to the race validator rather than
 * returning clean. Measured: **0 maintenance plans in production**, so a
 * stamp-at-construction fix reaches 100% of the future population and strands
 * nobody — the rare case where "new plans only" is complete rather than a caveat.
 */
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

/** THE predicate for the maintenance kind. Same reason as `isBaseBuildPlan`:
 *  one place, so the policies below cannot disagree about what it is. */
export function isMaintenancePlan(plan: Plan | null | undefined): boolean {
  return plan?.meta?.plan_kind === 'maintenance'
}

/**
 * §75's constitution, from the three arguments the plan recorded at construction
 * (AUDIT-MAINTENANCE-KIND-01).
 *
 * Returns `null` when the plan predates the stamp — NOT an empty array. The
 * distinction is the whole safety argument: an empty array would read as "this
 * maintenance plan is clean", which is exactly the silent pass this repo keeps
 * paying for. `null` means "this validator cannot speak", and the caller then
 * falls back to the race validator rather than inventing a ceiling.
 *
 * ⚠️ `baseWeeklyKm` is the one that cannot be derived. It is the RACE plan's base
 * volume and it drives §75's `VOLUME_CEILING_PCT_OF_BASE` hard cap, so recovering
 * it from the maintenance weeks would measure them against themselves.
 */
function maintenanceErrors(plan: Plan): Violation[] | null {
  const m = plan.meta
  const baseKm = m.source_base_weekly_km
  if (!(typeof baseKm === 'number' && baseKm > 0)) return null
  return validateMaintenanceBlock(
    plan.weeks ?? [],
    baseKm,
    m.source_injured ?? false,
    m.source_run_days_per_week ?? null,
  )
}

/**
 * For the DAILY AUDIT, which reads rows out of the database. Race plans get
 * `validateReshapedPlan` — it prefers the persisted input and tolerates a
 * legacy plan whose race week has already passed.
 */
export function validateStoredPlan(plan: Plan, reshapedWeekN?: number): Violation[] {
  if (isBaseBuildPlan(plan)) return baseBuildErrors(plan)
  if (isMaintenancePlan(plan)) {
    const v = maintenanceErrors(plan)
    // ⚠️ FALL THROUGH, not an empty array. A pre-stamp maintenance plan is judged
    // by the race validator as before — imperfect and loud, which is the safer of
    // the two wrong answers. Measured 2026-10-09: 0 maintenance plans in
    // production, so no stored plan takes this branch today.
    if (v) return v
  }
  return validateReshapedPlan(plan, reshapedWeekN)
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
  if (isBaseBuildPlan(plan)) return baseBuildErrors(plan)
  if (isMaintenancePlan(plan)) {
    const v = maintenanceErrors(plan)
    if (v) return v
  }
  return validatePlan(plan, input)
}
