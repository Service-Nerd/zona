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
import { validatePlan, type Violation } from './invariants'
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
  if (weekCount > 0) {
    const { weeks: foundationWeeks } = generateFoundationBlock({
      input, planStartDate: plan.meta.plan_start, today, forceWeeks: weekCount,
      // §92 — read the stamp, never re-derive the gate.
      earlyOnset: plan.meta.early_quality_onset === true,
    })
    if (foundationWeeks.length) {
      assembled = { ...plan, weeks: [...foundationWeeks, ...plan.weeks] }
    }
  }

  // INTENSITY-FOUNDATION-BLIND-02 — the foundation question is SETTLED for this
  // plan, and that has to be stamped BEFORE validatePlan runs, because checks
  // that defer while a decision is outstanding read it to know the deferral is
  // over. It is set on every composed plan, whatever the decision and whether or
  // not a week was added: a runner who picks 'skip' produces an assembled plan
  // byte-identical to the bare one, and if that could not be distinguished from
  // the still-undecided state, the deferred check would never bind for them.
  // A defer must be transient; this is what makes it transient.
  //
  // Assigned onto the EXISTING meta object rather than spread into a new one.
  // `composedRule.meta` is deliberately the same object as `rulePlan.meta` —
  // this function spreads the plan, not its meta — and /api/generate-plan relies
  // on that identity to land the free-tier CA-01 `plan_intro` and the
  // `enrichment` stamp AFTER composing (route.ts:150). Replacing meta here would
  // silently return free plans without their intro: no error, no symptom, just a
  // missing wedge surface.
  assembled.meta.foundation_composed = true

  // Unfiltered — CB-2 found that filtering by invariant code (or by week)
  // discards real violations (e.g. blocked-day breaches landing on a
  // foundation week under a non-foundation-specific code). validatePlan sees
  // the WHOLE assembled plan, same as generateRulePlan's own tail.
  const violations = validatePlan(assembled, input)

  return { plan: assembled, gapClass, violations }
}
