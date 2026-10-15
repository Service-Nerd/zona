// ADR-020 Option A — the single owner of `plan.weeks` mutation after
// generateRulePlan returns. "Every week that reaches a runner is constructed
// by the plan generator and validated before it is shown or saved. No surface
// may append, prepend, or mutate plan.weeks after generation without
// re-entering validatePlan()." (ADR-020, proposed INV-PLAN-SINGLE-CONSTRUCTION)
//
// Before this, foundation weeks were built in the browser and prepended AFTER
// the plan left /api/generate-plan — a second, ungoverned construction path
// (D-08). This function is the replacement: called from the route (for the
// 'auto' gap band, and the 'choice' band when a decision is already known)
// and from POST /api/generate-plan/foundation (the deferred 'choice' + 'add'
// case). Pure — no throw, no console.error; callers decide policy via
// enforceViolations() (lib/plan/invariants.ts).

import {
  generateFoundationBlock, classifyGap, gapDays, plannedFoundationWeeks, type GapClass,
} from './foundationBlock'
import { easyPaceFromPlan, easyTargetsFromPlan } from './easyPace'
import { applyRunWalk } from './runWalkPlan'
import { validatePlan, type Violation } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { Plan, GeneratorInput } from '@/types/plan'

export interface ComposePlanWithFoundationResult {
  plan: Plan
  gapClass: GapClass
  violations: Violation[]
}

export function composePlanWithFoundation(
  plan: Plan,
  input: GeneratorInput,
  today: string,
  decision?: 'add' | 'skip' | 'start_now',
): ComposePlanWithFoundationResult {
  const gap = gapDays(today, plan.meta.plan_start)
  const gapClass = classifyGap(gap)

  // §91 — the count comes from the single owner, and is passed as `forceWeeks`
  // so the number that sized the base phase in generateRulePlan and the number
  // of weeks actually built here are literally the same value, not two
  // computations that happen to agree.
  const weekCount = plannedFoundationWeeks(today, plan.meta.plan_start, decision)

  let assembled = plan
  let foundationWeeksBuilt = 0
  if (weekCount > 0) {
    const { weeks: foundationWeeks } = generateFoundationBlock({
      input, planStartDate: plan.meta.plan_start, today, forceWeeks: weekCount,
      // §92 — read the stamp, never re-derive the gate.
      earlyOnset: plan.meta.early_quality_onset === true,
      // §122 (Coaching Board 2026-10-03) — the foundation block is sized against the
      // runner's stated weekday budgets, which needs their easy pace. Read from the
      // GENERATED plan, so it is the same number the engine already gave every easy
      // session rather than a second derivation of it (EASY-PACE-OWNER-01).
      easyPaceMinPerKm: easyPaceFromPlan(plan),
      // FOUNDATION-PACE-STRIPPED-01 — the easy pace BAND and HR ceiling the
      // runner reads, from the same generated plan and for the same reason as
      // the line above: the engine already chose these strings for every easy
      // session it placed. Measured before this: 381 of 381 foundation easy
      // sessions carried neither, against 0 of 1,355 main-plan easy sessions.
      easyTargets: easyTargetsFromPlan(plan),
    })
    if (foundationWeeks.length) {
      foundationWeeksBuilt = foundationWeeks.length
      // §117 Am.3 — THE FOUNDATION WEEKS NEED THE WALK INTERVAL TOO.
      //
      // 🔴 `generateRulePlan` stamps `run_walk_strategy` on every session as its
      // LAST act, and this module then prepends weeks it has never seen — which
      // is ADR-020's own documented hazard, in ADR-020's own module: *"foundation
      // weeks were prepended after validatePlan() had already run — two live
      // defects shipped from weeks the validator couldn't see."* This is a third.
      //
      // Measured on the board's own M1 persona (the charity cohort's first-time
      // marathoner, 15 km/wk, longest 8 km, 21-week runway): the bare plan had
      // 80 of 80 running sessions stamped, and foundation week -1 had **0 of 3**,
      // producing three `INV-PLAN-RUNWALK-PRESCRIBED` errors. §117 Am.3's rule is
      // that the walk break is PRESCRIBED, not permitted — a foundation week that
      // tells a run-walk runner to run straight through is the plan "only
      // permitting walking", which is precisely what the board refused to ship.
      //
      // ⚠️ `applyRunWalk` is the owner and is idempotent (it sets a field from a
      // constant), so this re-stamps rather than re-deriving the predicate. The
      // GATE is `plan.meta.run_walk_prescribed`, read and never recomputed —
      // same discipline as `earlyOnset` three lines up.
      const prescribed = (plan.meta as unknown as Record<string, unknown>).run_walk_prescribed === true
      const composedWeeks = prescribed
        ? foundationWeeks.map(w => ({
            ...w,
            sessions: Object.fromEntries(
              Object.entries(w.sessions).map(([day, s]) => [day, s ? applyRunWalk(s) : s]),
            ) as typeof w.sessions,
          }))
        : foundationWeeks
      foundationWeeksBuilt = composedWeeks.length
      assembled = { ...plan, weeks: [...composedWeeks, ...plan.weeks] }
    }
  }

  // §57 Amendment / §76 Amendment (FOUNDATION-LONG-RUNWAY-01, Coaching Board
  // 2026-09-15) — DECLARE THE WEEKS THE PLAN DOES NOT COVER.
  //
  // §76 says a runner left with an uncoached void "will fill it by guessing",
  // and asserts "the gap before it is already owned by the foundation block".
  // For any gap above FOUNDATION_MAX_WEEKS it is not: at a 25-week runway a
  // first-time marathoner gets 3 foundation + 18 main and FOUR uncovered weeks,
  // and at a 52-week runway, thirty-one. Nothing told them.
  //
  // This is the only place that CAN tell them: the uncovered count needs `today`
  // and the built block together, and this function is ADR-020's single owner of
  // both. Every other structural limit in this engine already pairs with an
  // honesty obligation (§23 maintenance, §34 residual, §40c shortfall, §52's note,
  // ADR-022). The pre-plan gap had none.
  //
  // Sims's binding point at the sitting: a runner in that gap is not resting,
  // they are training UNSUPERVISED, and for the women in this cohort
  // unsupervised ramping into a first marathon is where energy availability and
  // bone loading go wrong. Silence is not neutral.
  const uncoveredWeeks = Math.max(0, Math.floor(gap / 7) - foundationWeeksBuilt)
  if (uncoveredWeeks > 0) {
    assembled = {
      ...assembled,
      meta: { ...assembled.meta, uncovered_runway_weeks: uncoveredWeeks },
    }
  }
  if (uncoveredWeeks >= GENERATION_CONFIG.FOUNDATION_UNCOVERED_WEEKS_NOTE_THRESHOLD) {
    assembled = {
      ...assembled,
      meta: { ...assembled.meta, uncovered_runway_note: uncoveredRunwayNote(uncoveredWeeks, foundationWeeksBuilt) },
    }
  }

  // FOUNDATION-META-ALIAS-01 (2026-10-15) — THE RETURNED `meta` IS ALWAYS A FRESH
  // OBJECT, AND THE RETURNED PLAN IS NEVER THE CALLER'S.
  //
  // 🔴 Until here, this function returned `meta` in three different identity
  // states depending on its input: the caller's own PLAN when no foundation weeks
  // were built and nothing was uncovered; a fresh plan sharing the caller's META
  // when weeks were built; and a fresh plan with fresh meta once the
  // uncovered-runway spreads above fired. **A caller cannot be correct about
  // that**, and one was not: `app/api/generate-plan/route.ts` mutated
  // `rulePlan.meta` and returned `composedRule`, with a comment explaining that
  // the two were one object. That comment was TRUE when it was written
  // (`eb1b925b`, 2026-09-03) and FOUNDATION-LONG-RUNWAY-01 falsified it twelve
  // days later (`65a5dd71`, 2026-09-15) by adding those spreads. Neither commit
  // referenced the other.
  //
  // For 30 days a free runner whose start was DELAYED — any surplus runway, since
  // §76 delays the start rather than truncating the end — lost `meta.plan_intro`,
  // which is CA-01 and the only AI surface a free runner gets, and the
  // `enrich-health` fleet metric lost the `meta.enrichment` it declares as its
  // denominator. Measured: 76.6% of free-legal plans across a uniform 6-52 week
  // race-date sweep, 3 of 35 live stored plans.
  //
  // ⚠️ MAKING IT UNCONDITIONAL IS THE FIX, not making it shared. A conditional
  // alias is a trap: it rewards the caller that gets it wrong on short runways and
  // punishes them on long ones, which is exactly how this survived a full suite.
  // Now a caller that mutates what it passed IN and reads what came OUT is wrong
  // in EVERY case, so the tests say so immediately.
  //
  // ⚠️ `weeks` is deliberately NOT cloned. This is a meta-identity guarantee, not
  // a deep copy, and claiming more than it does is how the last assumption rotted.
  assembled = { ...assembled, meta: { ...assembled.meta } }

  // Unfiltered — CB-2 found that filtering by invariant code (or by week)
  // discards real violations (e.g. blocked-day breaches landing on a
  // foundation week under a non-foundation-specific code). validatePlan sees
  // the WHOLE assembled plan, same as generateRulePlan's own tail.
  const violations = validatePlan(assembled, input)

  return { plan: assembled, gapClass, violations }
}

/**
 * The honest note for weeks the plan does not cover.
 *
 * Says three things and no more: how many weeks, why they sit BEFORE the plan
 * rather than inside it, and what to do in them. It does NOT promise that easy
 * running in those weeks is preparation — CB-1 ruled a foundation block is
 * "habit and routine, not adaptation", and copy that oversold unsupervised weeks
 * would be worse than the silence it replaces (Sims). Brand voice: honest,
 * brief, never motivational. No em dashes (brand.md § Punctuation).
 *
 * NO RAW DATES. Every other note in this engine speaks in weeks
 * ("By week 13...", "tops out at 208 minutes") and a bare ISO date in runner-
 * facing copy is a display decision `lib/format.ts` owns, not this module
 * (ADR-015).
 *
 * AND THE MECHANISM IS STATED CORRECTLY. A first draft said starting earlier
 * "would just stretch the taper". It would not: §76 lays the plan out backwards
 * from race day and §17's `max_weeks` bounds its length, so surplus weeks land
 * BEFORE the plan. Naming the wrong reason in copy the runner reads is the same
 * defect as naming it in a comment.
 */
function uncoveredRunwayNote(weeks: number, foundationWeeksBuilt: number): string {
  const wk = weeks === 1 ? '1 week' : `${weeks} weeks`
  const picksUp = foundationWeeksBuilt > 0
    ? 'before your foundation weeks begin'
    : 'before this plan starts'
  return `You have ${wk} ${picksUp}, and we are not going to pretend they are training. `
    + 'Your plan is laid out backwards from race day and there is a limit to how long a useful one runs for, '
    + 'so the spare weeks sit in front of it rather than being added to it. '
    + 'Keep running easy through them, at the volume you are on now. '
    + 'Do not use the time to ramp up: arriving at week one with the legs you have today is the point.'
}
