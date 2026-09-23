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
import { auditPlanQuality, objectionsOnly, watchedOnly } from './planQuality'
import { distanceEnvelope, DISTANCE_BANDS } from './useCaseEnvelope'
import { getRunningApplies, generateGetRunningPlan } from './getRunningPlan'
import { weeksBetweenLocal } from './length'

/** §44's standard: a refusal must say what to do NEXT, never just "no". */
export const REFUSAL_NAMES_NEXT_STEP = /get to|come back|build to|at least|first|instead|about \d/i

export interface DistanceMeasure {
  /**
   * ⚠️ THE DENOMINATOR CHANGED — ZERO-REJECTION-SERVED-01, Coaching Board
   * 2026-09-23 sitting 2. Read this before comparing to any round before it.
   *
   * A refusal that hands the runner a validated §118 get-running plan is
   * **excluded from this rate**, neither pass nor fail. It is reported as
   * `servedRefusedPct` instead.
   *
   * 🔴 **HUTCHINSON, BINDING: THIS IS A CORRECTION, NEVER AN IMPROVEMENT.**
   * *"The engine did not get better. Nothing about the plans changed. If this
   * board re-scores and the marathon reads ~91%, not one runner is served
   * differently than they were yesterday."* `fitPctPreCorrection` is retained
   * beside it for exactly that reason: a number that rises because its
   * definition moved must never be readable as progress.
   */
  fitPct: number
  /**
   * The same rate under the PRE-correction definition, where every designed
   * refusal scored FAIL. Amendment 1. Retained so no round can quote the new
   * number without the old one being one field away.
   */
  fitPctPreCorrection: number
  /**
   * WATCHED (amendment 2, Seiler + Sims) — refused by the engine AND offered a
   * §118 plan. Neither scored nor hidden. **A watched quantity nobody reads is
   * a hidden one**, so `measure-envelope.ts` prints it every run.
   */
  servedRefusedPct: number
  /**
   * WATCHED — of the runners this band refuses AND serves, how many does the
   * get-running plan build far enough to reopen the race door?
   *
   * ⚠️ **PER BAND, NEVER AVERAGED (amendment 4, McMillan).** 80.3% at 4 km/week
   * and 100% at 15 are different promises to different people, and a single
   * product figure hides the runner who cannot get there. `null` when the band
   * refuses nobody with a base target to reach.
   */
  doorPct: number | null
  /**
   * Refused and NOT served — no §118 plan at all. **Still a scored FAIL**
   * (amendment 3, Hutchinson): the exemption is for runners who receive a plan,
   * never for the refusal type.
   */
  unservedRefusedPct: number
  refusedPct: number
  refusedWithoutNextStepPct: number
  invalidPlans: number
  objections: Record<string, number>
  /**
   * RUBRIC-GAPS-01(a) — exempted rules, counted but NOT scored.
   *
   * `DAYS-SHORT-SILENCED` is the §18 Am. exemption that raises the
   * fit-for-purpose rate by ~18.7pp. **A rate that climbs means the exemption
   * is carrying more than it was measured carrying.** It is reported beside
   * the fit rate so the two can never drift apart unobserved.
   */
  watched: Record<string, number>
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
    // ZERO-REJECTION-SERVED-01 — refused AND handed a §118 plan.
    let servedRefused = 0, doorEligible = 0, doorReached = 0
    const objections: Record<string, number> = {}
    const watched: Record<string, number> = {}

    for (const c of distanceEnvelope(band.value).filter((_, i) => i % stride === 0)) {
      total += c.weight
      let plan
      try { plan = generateRulePlan(c.input, 'paid') }
      catch (e) {
        if (!isDesignedRefusal(e)) { invalid++; continue }
        refused += c.weight
        // ⚠️ THE BAR MOVED ON 2026-09-20 AND THIS IS THE LINE THAT MOVED.
        //
        // This used to read: "a CORRECT refusal is a fit-for-purpose outcome —
        // but only when it names a next step", and it counted such a refusal as
        // FIT. That was §44's standard, and under it the marathon scored 90.1%.
        //
        // The founder's standard is now explicit and different: **"if someone
        // comes to our platform and asks for a run, we can't just say no, go
        // away"** — a refusal must lead to a PLAN, not to advice, however well
        // the advice is worded. Under that bar a refusal is a DROPOUT.
        //
        // Measured the day the bar moved: marathon **90.1% -> 79.3%**, and the
        // whole 10.8-point gap is refusals that were being scored as successes.
        // Every other distance is unchanged, because no other distance refuses
        // anyone: 5K 100%, 10K 100%, HM 96.2%, 50K 100%, 100K 100%.
        //
        // ⚠️ `refusedWithoutNextStepPct` IS KEPT AND STILL MEASURED. §44's
        // obligation did not go away — a refusal that says nothing is still
        // worse than one that names a next step, and losing that distinction
        // would hide a regression inside a number that is already failing.
        if (!REFUSAL_NAMES_NEXT_STEP.test(e instanceof Error ? e.message : String(e))) noNextStep += c.weight

        // ── ZERO-REJECTION-SERVED-01 (Coaching Board 2026-09-23, sitting 2) ──
        //
        // The bar above was ruled on 2026-09-20 at 16:34. §118 shipped the SAME
        // DAY, and since then a refusal DOES lead to a plan: `/api/generate-plan`
        // catches this throw and offers a get-running plan. `ZERO-REJECTION-01`
        // is not wrong; the world it described changed underneath it nine hours
        // after it was written.
        //
        // ⚠️ CALLS THE SAME TWO OWNERS THE ROUTE CALLS, never a copy of its
        // rule, so the measure and the product cannot drift.
        //
        // ⚠️ AND IT IS NOT SCORED AS A PASS. §118 is not a marathon plan, and
        // counting it as one re-imports the exact dishonesty ZERO-REJECTION-01
        // removed. It leaves the denominator; it never joins the numerator.
        if (!getRunningApplies(c.input)) continue      // amendment 3: still a FAIL
        servedRefused += c.weight
        const minBase = (e as { base?: { min_base_km?: number } }).base?.min_base_km
        // Only a BaseVolumeError names a door. A prep-time or days refusal has no
        // base target, so it is served but NOT door-eligible — counting it either
        // way would invent a denominator.
        if (typeof minBase !== 'number') continue
        doorEligible += c.weight
        try {
          const ci = c.input as unknown as Record<string, string>
          const ps = ci.plan_start ?? '2026-11-02'
          const { endsAtKm } = generateGetRunningPlan(c.input, ps, weeksBetweenLocal(ps, ci.race_date))
          if (endsAtKm >= minBase) doorReached += c.weight
        } catch { /* served, but the plan does not reach the door */ }
        continue
      }
      const m = plan.meta as unknown as Record<string, unknown>
      const maintDeclared = m.volume_profile === 'maintenance' && !!m.volume_constraint_note
      const errs = validatePlan(plan, c.input).filter(v => v.severity === 'error')
      if (errs.length) invalid++
      // §23 licenses a declared maintenance plan that does not build — the
      // reconciliation an earlier audit made for 15,236 findings.
      const all = auditPlanQuality(plan, c.input)
        .filter(o => !(o.code === 'NEVER-BUILDS' && maintDeclared))
      // RUBRIC-GAPS-01(a) — WATCHED quantities are exempted rules, counted and
      // reported but never scored. Scoring them would re-impose a rule the
      // board deliberately relaxed; hiding them would make the relaxation
      // invisible, which is how an exemption becomes a moved goalpost.
      const objs = objectionsOnly(all)
      for (const o of objs) objections[o.code] = +(((objections[o.code] ?? 0) + c.weight)).toFixed(6)
      for (const w of watchedOnly(all)) watched[w.code] = +(((watched[w.code] ?? 0) + c.weight)).toFixed(6)
      if (!errs.length && !objs.length) fit += c.weight
    }

    // THE DENOMINATOR. A served refusal is neither pass nor fail, so it leaves
    // the population being scored rather than counting against it.
    const scored = total - servedRefused
    byDistance[String(band.value)] = {
      fitPct: pc(fit, scored),
      fitPctPreCorrection: pc(fit, total),
      servedRefusedPct: pc(servedRefused, total),
      doorPct: doorEligible > 0 ? pc(doorReached, doorEligible) : null,
      unservedRefusedPct: pc(refused - servedRefused, total),
      refusedPct: pc(refused, total),
      refusedWithoutNextStepPct: pc(noNextStep, total),
      invalidPlans: invalid,
      objections: Object.fromEntries(
        Object.entries(objections).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, pc(v, total)])),
      watched: Object.fromEntries(
        Object.entries(watched).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, pc(v, total)])),
    }
    // The product rate uses the SAME corrected denominator as the per-distance
    // rate. Mixing the two would produce a whole-product figure that no distance
    // rolls up to.
    prodFit += fit * band.weight
    prodTot += scored * band.weight
  }

  return { stride, productFitPct: pc(prodFit, prodTot), byDistance }
}
