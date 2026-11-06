// SITE-STAGED-PLAN-01 — the ONE way the marketing site generates a published plan.
//
// 🔴 EVERY MARKETING SURFACE CALLED `generateRulePlan` DIRECTLY, AND THAT IS NOT
// THE ENTRY POINT THE PRODUCT USES. `runEngine` is: it wraps the generator and,
// when a designed refusal can be STAGED, returns a base-build block instead of
// throwing (`NO-RUNNER-TURNED-AWAY-01`, live since 2026-10-25, refuses 0%).
//
// The gap was invisible while every published plan was for a runner who already
// runs. The moment one was not — the tenth page, for someone who has never run —
// `generateRulePlan` threw `LongRunReadinessError` and **seven marketing gates
// failed at once**, all with the same cause. ⚠️ My own first measurement of this
// item was taken at the same wrong entry point and reported the marathon as
// refused when the engine stages it.
//
// ⚠️ PARITY-CHECKED BEFORE THE SWITCH, NOT AFTER. All nine existing published
// plans, `generateRulePlan` against `runEngine`, deep-diffed leaf by leaf:
// **exactly ONE differing leaf each — `meta.foundation_gap_class`, which no page
// renders.** No session, no week, no volume moves. The pages are byte-identical
// to a reader.
//
// ⚠️ AND IT CLOSES A TRAP RATHER THAN ONLY FIXING A BUG. A future plan entry whose
// inputs happen to trip a stageable door would have crashed the BUILD under the
// old call. Through the owner it stages, exactly as it would for a real runner.

import { runEngine } from '@/lib/plan/engine'
import { planAnchor, type MarketingPlan } from './plans'
import type { Plan } from '@/types/plan'
import type { GeneratorInput } from '@/types/plan'
import { validatePlan, type Violation } from '@/lib/plan/invariants'
import { validateBaseBuildBlock, validateStagedRace } from '@/lib/plan/baseBuildValidate'

export interface MarketingPlanResult {
  plan: Plan
  /** `plan` for the nine race plans, `base_build` for a staged page. A refusal
   *  throws: a published page that cannot generate is a build failure, not a
   *  state to render. */
  kind: 'plan' | 'base_build'
  planStart: string
  raceDate: string
}

/**
 * Generate a published plan through the engine the product actually runs.
 *
 * Throws when the engine refuses, deliberately: `MARKETING_PLANS` is a committed
 * list, so a refusal means the entry is wrong and the build should stop rather
 * than publish a page with no plan on it.
 */
export function generateMarketingPlan(mp: MarketingPlan): MarketingPlanResult {
  const { planStart, raceDate } = planAnchor(mp.dayOffset)
  const out = runEngine({ input: mp.input(raceDate), tier: 'free', planStart, displayUnits: 'km' })

  if (out.kind === 'refusal') {
    throw new Error(
      `MARKETING_PLANS entry "${mp.slug}" is refused by the engine: `
      + `${String((out as { body?: { reason?: string } }).body?.reason ?? 'unknown')}. `
      + 'A published plan page must generate. Fix the entry, or if the refusal is '
      + 'correct and stageable, that is a STAGED-* item for the Coaching Board.',
    )
  }
  return { plan: (out as { plan: Plan }).plan, kind: out.kind as 'plan' | 'base_build', planStart, raceDate }
}

/**
 * 🔴 `meta.staged_race` — WHAT THE PAGE MAY AND MAY NOT SAY.
 *
 * §116 Amendment 10 (Coaching Board 2026-11-06): *"the base-build block a staged
 * refusal returns may be rendered on a public page; the race it stages may not be
 * claimed there."* `target_found` is **false** on a staged plan: the race block
 * has not been generated and will be built at the checkpoint from observed volume.
 *
 * Read `checkpointWeek` to draw the door. ⚠️ Do NOT read `raceWeeks` onto the page
 * — it is the engine's own bookkeeping about a race the page may not mention, and
 * rendering it is the claim the amendment forbids.
 */
export interface StagedRace {
  doorKm: number
  checkpointWeek: number
  /** Present for the engine's use. Not for the page. */
  raceWeeks: number
  targetFound: boolean
}

export function stagedRaceOfPlan(plan: Plan): StagedRace | null {
  const sr = (plan.meta as unknown as Record<string, unknown> | undefined)?.staged_race as
    | Record<string, unknown>
    | undefined
  if (!sr) return null
  return {
    doorKm: Number(sr.door_km ?? 0),
    checkpointWeek: Number(sr.checkpoint_week ?? 0),
    raceWeeks: Number(sr.race_weeks ?? 0),
    targetFound: sr.target_found === true,
  }
}

/**
 * 🔴 VALIDATE A PUBLISHED PLAN THE WAY ITS OWN PRODUCER VALIDATES IT.
 *
 * `validatePlan()` is the RACE constitution. Run against a `base_build` block it
 * reports violations that are not defects but category errors — measured on the
 * tenth page: **48 × `INV-PLAN-EASY-PACE-PRESENT`** (a walk-run session has no
 * pace by design, for a runner who has never run) and an `INV-PLAN-BASE-BUILD-RATIO`
 * reading *"Peak volume 12.8km is ∞x the runner's 0km/week base"* — **infinite
 * because the base is zero, which is the entire premise of the page.**
 *
 * ⚠️ THIS IS `RESHAPE-VALIDATOR-KIND-01`'S TWIN AND THE REPO ALREADY PAID FOR THE
 * FIRST ONE: *"the adjust path judged a base-build plan by the race constitution."*
 * That remedy was applied to the adjust path. The marketing gates kept the race
 * validator, and nobody noticed because every published plan was a race plan until
 * this one.
 *
 * `runEngine` itself runs `validateBaseBuildBlock` + `validateStagedRace` on a
 * staged plan and never `validatePlan`. This does the same, so the gate asks the
 * question the producer answers rather than a different one.
 */
export function validateMarketingPlan(
  res: MarketingPlanResult,
  input: GeneratorInput,
): Violation[] {
  if (res.kind === 'plan') return validatePlan(res.plan, input)

  const meta = res.plan.meta as unknown as Record<string, unknown>
  const startKm = Number(meta.base_build_start_km ?? 0)
  // The same two arguments `engine.ts` builds via its private `spacingOpts`.
  const opts = {
    spaced: meta.onramp_spaced === true,
    blocked: (input as GeneratorInput & { days_cannot_run?: string[] }).days_cannot_run ?? [],
  }
  return [
    ...validateBaseBuildBlock(res.plan.weeks, startKm, opts as never),
    ...validateStagedRace(res.plan),
  ]
}
