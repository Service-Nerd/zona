/**
 * ENVELOPE MEASURE — the single owner of "what is our fit-for-purpose rate?".
 *
 * ⚠️ WHY THIS EXISTS. The rates lived only as FLOORS inside
 * `useCaseEnvelope.test.ts`, which is a ONE-SIDED gate: a drop fails the build
 * and a rise is silent. So the question the founder actually asks between
 * sittings — *"is this better or worse than last time, and where?"* — had no
 * mechanical answer, and the numbers had to be re-derived by hand each round.
 * That is the same shape as the defect that made the board appear to change
 * its mind: a measurement nobody wrote down.
 *
 * ⚠️ ONE OWNER, TWO CONSUMERS. `scripts/measure-envelope.ts --write` records
 * the baseline; `useCaseEnvelope.test.ts` compares against it. Both call this.
 * A second copy of the computation would drift, which this repo has paid for
 * in the deload cadence, the tier ladder and the session-distance expression.
 */

import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { isDesignedRefusal } from './designedRefusal'
import { auditPlanQuality } from './planQuality'
import { distanceEnvelope, DISTANCE_BANDS } from './useCaseEnvelope'

/** §44's standard: a refusal must say what to do NEXT, never just "no". */
export const REFUSAL_NAMES_NEXT_STEP = /get to|come back|build to|at least|first|instead|about \d/i

export interface DistanceMeasure {
  fitPct: number
  refusedPct: number
  refusedWithoutNextStepPct: number
  invalidPlans: number
  objections: Record<string, number>
}
export interface EnvelopeMeasure {
  stride: number
  productFitPct: number
  byDistance: Record<string, DistanceMeasure>
}

const pc = (n: number, d: number) => d > 0 ? +(n / d * 100).toFixed(1) : 0

/**
 * @param stride coprime sampling stride. The default matches the gate; the
 *   script can pass 1 for the exhaustive run. Sampling was validated against
 *   the full population when the envelope shipped (75.5% vs 75.4%).
 */
export function measureEnvelope(stride = 29): EnvelopeMeasure {
  const byDistance: Record<string, DistanceMeasure> = {}
  let prodFit = 0, prodTot = 0

  for (const band of DISTANCE_BANDS) {
    let total = 0, fit = 0, refused = 0, noNextStep = 0, invalid = 0
    const objections: Record<string, number> = {}

    for (const c of distanceEnvelope(band.value).filter((_, i) => i % stride === 0)) {
      total += c.weight
      let plan
      try { plan = generateRulePlan(c.input, 'paid') }
      catch (e) {
        if (!isDesignedRefusal(e)) { invalid++; continue }
        refused += c.weight
        // A CORRECT refusal is a fit-for-purpose outcome — but only when it
        // names a next step. One that just says "no" is a dropout.
        if (REFUSAL_NAMES_NEXT_STEP.test(e instanceof Error ? e.message : String(e))) fit += c.weight
        else noNextStep += c.weight
        continue
      }
      const m = plan.meta as unknown as Record<string, unknown>
      const maintDeclared = m.volume_profile === 'maintenance' && !!m.volume_constraint_note
      const errs = validatePlan(plan, c.input).filter(v => v.severity === 'error')
      if (errs.length) invalid++
      // §23 licenses a declared maintenance plan that does not build — the
      // reconciliation an earlier audit made for 15,236 findings.
      const objs = auditPlanQuality(plan, c.input)
        .filter(o => !(o.code === 'NEVER-BUILDS' && maintDeclared))
      for (const o of objs) objections[o.code] = +(((objections[o.code] ?? 0) + c.weight)).toFixed(6)
      if (!errs.length && !objs.length) fit += c.weight
    }

    byDistance[String(band.value)] = {
      fitPct: pc(fit, total),
      refusedPct: pc(refused, total),
      refusedWithoutNextStepPct: pc(noNextStep, total),
      invalidPlans: invalid,
      objections: Object.fromEntries(
        Object.entries(objections).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, pc(v, total)])),
    }
    prodFit += fit * band.weight
    prodTot += total * band.weight
  }

  return { stride, productFitPct: pc(prodFit, prodTot), byDistance }
}
