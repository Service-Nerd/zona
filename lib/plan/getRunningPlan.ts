import type { GeneratorInput, Plan } from '@/types/plan'
import { GENERATION_CONFIG } from './generationConfig'
import { effectiveStartKm } from './startVolume'
import { onRampCurve, generateBaseBuildPlan, type OnRampAssessment } from './baseBuildOnRamp'
import { walkRunStartApplies, walkRunStartWeeks, composeWalkRunStart } from './walkRunStart'
import { addWeeksIso } from './stagedRacePlan'

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

  // 🔴 BELOW §116's RUNNING FLOOR THIS PLAN USED TO HAND THE RUNNER CONTINUOUS RUNNING
  // (`GETRUNNING-WALKRUN-FLOOR-01`, Coaching Board 2026-11-12: *"there is nothing to rule. The doctrine is
  // written, the engine disagrees with it"*). The floor note has read *"below
  // `BASE_BUILD_ONRAMP_MIN_START_KM`, including 0, the runner starts with a WALK-RUN start"* since 2026-10-24,
  // and this producer had no walk-run path at all — so **the one plan kind built for people who cannot yet run
  // was the only one that never offered a walk-run.** Measured on a 3,264-row production-shape grid: 2,304 of
  // the 2,394 blocks that should have started with one did not, and every one of them came from here.
  //
  // ⚠️ `walkRunStartApplies`, NOT `walkRunStartPrescribed`, AND THE NARROWER GATE IS DELIBERATE.
  // §117 Am. 7 also prescribes a walk-run start to a runner AT or ABOVE the volume floor whose declared longest
  // run is under `WALK_RUN_START_MIN_LONGEST_RUN_KM`. On a STAGED plan that is additive inside a race runway.
  // Here it is SUBTRACTIVE: this composition reseeds the ramp at the floor, so applying it above the floor cuts
  // what the plan reaches — measured **-11.1 km at 6 km/week, -18.7 at 8, -33.9 at 12**. That is the same
  // volume-reduction hazard that forced Am. 7's own narrowing (a 30 km/week runner restarted at 6), so the
  // longest-run half stays the board's and is marked, not silently fixed: `INV-PLAN-WALKRUN-START-PROGRESSION`
  // raises it as a `warn` naming `GETRUNNING-WALKRUN-FLOOR-01`'s open half.
  if (walkRunStartApplies(startKm)) {
    const wrWeeks = walkRunStartWeeks()
    // ⚠️ THE RAMP GETS THE RUNWAY THAT IS LEFT, AND SPENDS NONE OF ITS BUDGET ON THE WALK-RUN START.
    // `GET_RUNNING_MAX_WEEKS` is 15 because 16 weeks of §2's 10% compounds past §111's `MAX_BASE_BUILD_RATIO`
    // (Willy: *"I will not have two total-build ceilings in one constitution"*) — so it bounds the RUNNING
    // ramp's total build, and a walk-run week carries no distance at all. Measured across the cohort the ramp
    // ratio stays <= 3.78x, inside the 4.0 cap, at every runway.
    const rampWeeks = getRunningWeeks(Math.max(0, runwayWeeks - wrWeeks))
    const composed = composeWalkRunStart(input, {
      planStart,
      rampStart: addWeeksIso(planStart, wrWeeks),
      rampWeeks,
      remainingWeeks: Math.max(0, runwayWeeks - wrWeeks - rampWeeks),
    })
    const plan = { ...composed.base, weeks: composed.weeks }
    const m = plan.meta as unknown as Record<string, unknown>
    m.plan_kind = 'base_build'
    delete m.base_build_onramp
    m.race_name = 'Base building'
    m.enrichment = 'skipped_plan_kind'
    // ⚠️ `plan_start` IS THE WALK-RUN START'S, NOT THE RAMP'S. `generateBaseBuildPlan` was handed `rampStart`,
    // so its meta says the plan begins seven weeks late — the same override the staged path makes.
    m.plan_start = planStart
    m.walk_run_start_weeks = wrWeeks
    m.base_build_start_km = composed.startKm
    return { plan, endsAtKm: composed.endsAtKm, weeks: composed.weeks.length }
  }

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
  // ⚠️ `base_build`, NOT `get_running`. SLT 2026-09-20, Sutherland, and it is a
  // decision rather than a tweak: *"'Getting running' is what you say to a
  // person who does not run. They DO run — badly, not enough, but they run.
  // The name argues with them on the one point they are most sensitive about."*
  // Base building is what every serious runner already calls this, and it moves
  // the runner from "beginner" to "athlete doing a recognised thing" for free.
  //
  // ⚠️ DECIDED BEFORE ANYTHING PERSISTED IT. `plan_kind` is stored on every
  // plan row, so changing it later would have meant a migration.
  meta.plan_kind = 'base_build'
  // ⚠️ The §116 marker is REMOVED. This plan is not an on-ramp to anything, and
  // leaving the flag on would let a downstream reader infer a marathon handover
  // that does not exist. A plan that claims a destination it has not got is the
  // failure mode this whole day has been about.
  delete meta.base_build_onramp
  meta.race_name = 'Base building'
  // BASEBUILD-ENRICH-VISIBILITY-01 — SAY THAT THIS PLAN HAS NO AI VOICE, rather
  // than leaving the field absent. The route returns a base build before
  // `enrich()` for every tier, which is a product decision nobody has taken
  // (SLT 2026-10-10: the PLAN is FREE "because it is the door"; a `base_build_coaching`
  // gate mirroring MAINT-02 is piece 2 and awaits the founder). Until then the
  // honest state is "not eligible because of what this plan is".
  //
  // ⚠️ DELIBERATELY NOT 'skipped', which means "free tier" and is filtered out of
  // the fleet metric's denominator. See the enum in `schema.ts` for the full
  // reasoning: a paid runner with no voice must be COUNTABLE, not tidy.
  meta.enrichment = 'skipped_plan_kind'

  return { plan, endsAtKm, weeks }
}
