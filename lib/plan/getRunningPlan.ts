import type { GeneratorInput, Plan } from '@/types/plan'
import { GENERATION_CONFIG } from './generationConfig'
import { effectiveStartKm } from './startVolume'
import { onRampCurve, generateBaseBuildPlan, type OnRampAssessment } from './baseBuildOnRamp'

/**
 * GET-RUNNING PLAN — what we offer the runner no marathon plan can serve.
 *
 * FOUNDER DIRECTIVE, 2026-09-20: *"we can't just say no, go away"* — and, after
 * the board twice ruled zero rejection unreachable by coaching, *"the 12%, I
 * need them to have a get-running plan."* The Coaching Board escalated exactly
 * this as a product decision; this is the founder having made it.
 *
 * ⚠️ IT IS NOT A MARATHON PLAN AND MUST NEVER CLAIM TO BE. That is the whole
 * reason it can exist. `S116-FLOOR-VS-TARGET-01` was VETOED because a 3 km/week
 * runner cannot be built to a marathon in 29 weeks — every ramp target left a
 * 13.5-15 km peak long run against the 17 km ruled adequate. **Remove the
 * marathon promise and the runway constraint that vetoed it disappears with
 * it**: a plan that is simply building a runner has no start line to miss.
 *
 * ⚠️ NO NEW PRESCRIPTION MACHINERY. This is §116's ramp, which the board
 * already ruled correct AS A STANDALONE PLAN (amendment 8: *"if they never
 * return it must still be a good eleven weeks"*). Same generator, same
 * validator, same curve. What differs is the TARGET and the absence of a
 * handover — and building a second plan shape when one already fits is the
 * D-08 duplication this repo keeps paying for.
 */

/** Does this runner need the get-running path? Only ever asked AFTER a
 *  designed refusal — it is a fallback, never a first choice. */
export function getRunningApplies(input: GeneratorInput): boolean {
  return effectiveStartKm(input) > 0
}

/**
 * Where a get-running plan builds TO.
 *
 * ⚠️ DERIVED FROM THE RUNWAY, NOT A FIXED TARGET, and that is the point. A
 * marathon plan has a start line and must reach a specific base by a date. This
 * has neither, so imposing a target would invent a deadline the runner does not
 * have — and `onRampWeeksNeeded` would then refuse them a second time for
 * missing it, which is the failure this plan exists to end.
 *
 * It builds for the weeks available, at §2's rate, under §3's cadence, and
 * stops. Whatever that reaches is where they are.
 */
export function getRunningWeeks(runwayWeeks: number): number {
  return Math.max(
    GENERATION_CONFIG.GET_RUNNING_MIN_WEEKS,
    Math.min(runwayWeeks, GENERATION_CONFIG.GET_RUNNING_MAX_WEEKS),
  )
}

/**
 * Build it. Returns the plan and the volume it ends at, so the caller can tell
 * the runner what they will be able to do — and, if they have a race in mind,
 * whether that reopens the door.
 */
export function generateGetRunningPlan(
  input: GeneratorInput,
  planStart: string,
  runwayWeeks: number,
): { plan: Plan; endsAtKm: number; weeks: number } {
  const startKm = effectiveStartKm(input)
  const weeks = getRunningWeeks(runwayWeeks)
  const curve = onRampCurve(startKm, weeks)
  const endsAtKm = curve[curve.length - 1]

  // ⚠️ REUSES `generateBaseBuildPlan` WHOLESALE. Its assessment argument is the
  // only thing shaped for the marathon path, so it is constructed here rather
  // than a second generator being written: one week-builder, one curve owner,
  // one validator.
  const assessment: OnRampAssessment = {
    outcome: 'offered',
    rampWeeks: weeks,
    remainingWeeks: Math.max(0, runwayWeeks - weeks),
    targetKm: endsAtKm,
    startKm,
  }
  const plan = generateBaseBuildPlan(input, planStart, assessment)
  const meta = plan.meta as unknown as Record<string, unknown>
  meta.plan_kind = 'get_running'
  // ⚠️ The §116 marker is REMOVED. This plan is not an on-ramp to anything, and
  // leaving the flag on would let a downstream reader infer a marathon handover
  // that does not exist. A plan that claims a destination it has not got is the
  // failure mode this whole day has been about.
  delete meta.base_build_onramp
  meta.race_name = 'Getting running'

  return { plan, endsAtKm, weeks }
}
