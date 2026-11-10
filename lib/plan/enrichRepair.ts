// ENRICH-RESTORE-REPAIR-01 (2026-10-28) — the ONE owner of "enrichment wrote copy that
// breaks an invariant; how much of it do we keep?"
//
// This ladder lived inline in `app/api/generate-plan/route.ts` (ENRICH-PARTIAL-01/02),
// so the voice-restore script (`scripts/reenrich-plans.ts`) never got it: it wrote
// model copy straight onto 9 live plans, and 4 then failed
// `INV-PLAN-COPY-MATCHES-SESSIONS` (a week promising a time trial it did not hold).
// The route and the script now call this.
//
// Ladder: session -> week -> full, and EVERY rung is re-validated rather than
// assumed. "Introduced" is relative to `baseline` (ENRICH-ATTRIB-01): a violation the
// rule plan already had is not the enricher's.

import type { GeneratorInput, Plan } from '@/types/plan'
import { type Violation } from './invariants'
// 🔴 REENRICH-REPAIR-VALIDATOR-KIND-01 (2026-11-10) — §116's KIND DISPATCH, ON BOTH SIDES OF
// THE COMPARISON, IN ONE COMMIT.
//
// This module called `validatePlan` three times and its callers built the baseline with
// `validatePlan` too, so a base-build or maintenance plan handed to the repair ladder was
// judged by the RACE constitution — the long tail `baseBuildValidate.ts` exists to avoid.
// `STORED-PLAN-VALIDATOR-INPUT-01` recorded it as a declared exemption rather than fixing it,
// because **both sides of a comparison must use the same function**: moving only the baseline
// would make `violationsIntroducedBy` diff two constitutions and report phantom introductions.
//
// 📐 MEASURED ON THE LIVE FLEET BEFORE THE SWITCH, and it is why this is safe:
// of **41 stored plans with a usable input, 37 get an IDENTICAL verdict** from `validatePlan`
// and `validateSavedPlan` — because for a RACE plan `validateSavedPlan` **is** `validatePlan`,
// by its own docblock. The **4** that differ are all `base_build` (phantom error counts 59, 42,
// 22 and 13 against **0**), and all four carry **no AI copy**, so `hasAiCopy` refuses them
// before the ladder today. **The change is provably inert on the current fleet and closes the
// hole for the next base-build plan that gains a voice.**
//
// ⚠️ THE ITEM'S POPULATION WAS INCOMPLETE: it named this module and `reenrich-plans.ts`, and
// `app/api/generate-plan/route.ts:462` calls `repairEnrichedCopy` too — the LIVE path. Its
// baseline is `composeViolations`, which `foundationCompose` derives with `validatePlan`, and
// that stays as it is deliberately: the branch destructures the `kind: 'plan'` outcome, so only
// a race plan can reach it, and for a race plan the two functions agree. Adding a dispatch
// there would be a branch that can never fire.
import { validateSavedPlan } from './validateStoredPlan'
import { violationsIntroducedBy } from './enrichAttribution'
import {
  attributableWeeks, revertWeeksToRuleCopy,
  attributableSessions, revertSessionsToRuleCopy,
  type SessionKey,
} from './enrichPartialRevert'

export type EnrichRepairOutcome =
  | 'clean'                     // nothing introduced; the enriched plan stands
  | 'partial_revert_session'    // offending sessions reverted to rule copy
  | 'partial_revert'            // offending weeks reverted to rule copy
  | 'full_revert'               // rule plan returned unchanged

export interface EnrichRepair {
  plan: Plan
  outcome: EnrichRepairOutcome
  /** Error violations the enriched plan introduced, before any repair. */
  introduced: Violation[]
  badSessions: Set<SessionKey>
  badWeeks: Set<number>
}

/**
 * `rule` is the RULE-COPY plan whose weeks match `enriched` (same weeks, same sessions): in the
 * route that is `composedRule`, not the foundation-free `rulePlan` the enricher was handed, because
 * rule copy for a foundation week exists only on the composed plan (ADR-020 Option A). It is where
 * reverted copy comes from, and the full-revert result. The returned plan's
 * `meta.enrichment` is NOT stamped here; the caller owns the state it records.
 */
export function repairEnrichedCopy(
  enriched: Plan, rule: Plan, baseline: Set<string>, input: GeneratorInput,
): EnrichRepair {
  const introduced = violationsIntroducedBy(baseline, validateSavedPlan(enriched, input))
  const none = { badSessions: new Set<SessionKey>(), badWeeks: new Set<number>() }
  if (introduced.length === 0) return { plan: enriched, outcome: 'clean', introduced, ...none }

  const { sessions: badSessions, allAttributable: allSessionAttributable } = attributableSessions(introduced, enriched)
  const { weeks: badWeeks, allAttributable } = attributableWeeks(introduced, enriched)
  if (allSessionAttributable && badSessions.size > 0) {
    const candidate = revertSessionsToRuleCopy(enriched, rule, badSessions)
    if (violationsIntroducedBy(baseline, validateSavedPlan(candidate, input)).length === 0) {
      return { plan: candidate, outcome: 'partial_revert_session', introduced, badSessions, badWeeks }
    }
  }

  if (allAttributable && badWeeks.size > 0) {
    const candidate = revertWeeksToRuleCopy(enriched, rule, badWeeks)
    if (violationsIntroducedBy(baseline, validateSavedPlan(candidate, input)).length === 0) {
      return { plan: candidate, outcome: 'partial_revert', introduced, badSessions, badWeeks }
    }
  }

  return { plan: rule, outcome: 'full_revert', introduced, badSessions, badWeeks }
}
