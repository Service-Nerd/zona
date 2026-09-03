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

import { generateFoundationBlock, classifyGap, gapDays, type GapClass } from './foundationBlock'
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

  const shouldAdd = gapClass === 'auto' || (gapClass === 'choice' && decision === 'add')

  let assembled = plan
  if (shouldAdd) {
    const { weeks: foundationWeeks } = generateFoundationBlock({
      input, planStartDate: plan.meta.plan_start, today,
    })
    if (foundationWeeks.length) {
      assembled = { ...plan, weeks: [...foundationWeeks, ...plan.weeks] }
    }
  }

  // Unfiltered — CB-2 found that filtering by invariant code (or by week)
  // discards real violations (e.g. blocked-day breaches landing on a
  // foundation week under a non-foundation-specific code). validatePlan sees
  // the WHOLE assembled plan, same as generateRulePlan's own tail.
  const violations = validatePlan(assembled, input)

  return { plan: assembled, gapClass, violations }
}
