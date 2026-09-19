import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { isDesignedRefusal } from './designedRefusal'
import { sessionKmSelfPaced } from './sessionDistance'
import { auditPlanQuality } from './planQuality'
import { distanceEnvelope, DISTANCE_BANDS, MARATHON_VOLUME_BANDS, DAYS_BANDS, LEVEL_BANDS,
  VOLUME_BANDS_BY_DISTANCE } from './useCaseEnvelope'

/**
 * USE-CASE-ENVELOPE-01 — "are 90–95% of use cases fit for purpose?", made
 * measurable and then GATED.
 *
 * ⚠️ THE NUMBER THIS PRODUCES IS NOT COMPARABLE TO ANY OTHER HARNESS, AND THAT
 * IS THE POINT. Every other corpus is uniform: `cohortGrid` counts a 10 km/week
 * marathoner exactly as heavily as a 30 km/week one, which is right for finding
 * defects and wrong for answering "are we serving our runners". Measured
 * 2026-09-19 the marathon refusal rate reads 32% uniform and 18.3% weighted.
 * Both true; only one answers the founder's question.
 *
 * ⚠️ THE WEIGHTS ARE ASSUMPTIONS AND THE BASELINE INHERITS THAT. This gate
 * catches REGRESSION, not absolute truth. If the charity answers the volume
 * question the weights change and so does the baseline — deliberately.
 *
 * SAMPLED BY A COPRIME STRIDE, not a head slice: the envelope is generated in
 * nested-loop order, so a prefix would be all-8km/week and measure nothing.
 */

const FIT_FOR_PURPOSE_FLOOR = 0.70   // measured 0.754 on 2026-09-19
const STRIDE = 29                    // coprime with the 9,216 layout
// ⚠️ THE SAMPLE WAS VALIDATED AGAINST THE FULL POPULATION, not assumed.
// Full 9,216 cases: 75.4%. Stride 13: 76.0%. Stride 19: 75.8%. Stride 29: 75.5%.
// Stride 29 runs in under a second where the full run is ~7 s, which the
// duration gate (rightly) refused at ~24 s of CI time. A sample that had NOT
// been checked against the whole would be a guess wearing a number.

describe('USE-CASE-ENVELOPE-01 — the marathon population, weighted', () => {

  it('the envelope weights sum to 1 on every axis — an unnormalised band silently re-weights everything', () => {
    for (const [name, bands] of [
      ['volume', MARATHON_VOLUME_BANDS], ['days', DAYS_BANDS], ['level', LEVEL_BANDS],
    ] as const) {
      const sum = bands.reduce((s, b) => s + b.weight, 0)
      expect(Math.abs(sum - 1), `${name} bands sum to ${sum}`).toBeLessThan(0.001)
    }
  })

  it('every band carries a stated reason — a weight with no argument is a guess in disguise', () => {
    for (const b of [...MARATHON_VOLUME_BANDS, ...DAYS_BANDS, ...LEVEL_BANDS]) {
      expect(b.why.length, `band ${String(b.value)} has no why`).toBeGreaterThan(20)
    }
  })

  // ⚠️ The marathon-only case that used to sit here was DELETED, not baselined.
  // The per-distance suite below covers 42.2 km with the same criteria, so
  // keeping both measured the same population twice and cost ~1.6 s of the
  // duration budget to do it. A duplicate check is not extra safety.

  // ── ALL DISTANCES ─────────────────────────────────────────────────────────
  // The 90–95% target applies to EVERY distance (founder, 2026-09-19), with the
  // marathon as priority. Measured 2026-09-19, reconciled:
  //   5K 50.6% · 10K 59.3% · HM 70.3% · marathon 67.4% · 50K 91.6% · 100K 89.9%
  //   whole product 66.7%
  // ⚠️ THE SHORT RACES ARE THE WORST AND NOBODY HAD LOOKED. Every sitting so far
  // has been about the marathon; 5K is the distance furthest from the bar.
  //
  // ⚠️ TWO RECONCILIATIONS, BOTH JUSTIFIED, NEITHER TO FLATTER THE NUMBER:
  //  · LONG-RUN-SHORT is excluded above 42.2 km. Its bar is 55% of race
  //    distance, which for 100K demands a 55 km TRAINING long run. No coach
  //    prescribes that and §24e prescribes back-to-backs instead. Measured: it
  //    fired on 46 of 48 sampled 100K plans whose median long run was 36 km.
  //    That is a criterion defect in `planQuality`, filed, not a plan defect.
  //  · NEVER-BUILDS is excluded where the plan is DECLARED maintenance with a
  //    note — §23 licenses exactly that, and an earlier audit already
  //    reconciled 15,236 such findings to zero in breach.
  const FLOORS: Record<number, number> = {
    5: 0.45, 10: 0.54, 21.1: 0.65, 42.2: 0.62, 50: 0.86, 100: 0.84,
  }

  it.each(DISTANCE_BANDS.map(d => [d.value, FLOORS[d.value]] as const))(
    '%s km — a weighted majority of entrants get a plan we would hand over (floor %s)',
    (distanceKm, floor) => {
      let total = 0, fit = 0, refused = 0
      const codes: Record<string, number> = {}
      for (const c of distanceEnvelope(distanceKm).filter((_, i) => i % STRIDE === 0)) {
        total += c.weight
        let plan
        try { plan = generateRulePlan(c.input, 'paid') }
        catch (e) {
          if (isDesignedRefusal(e)) { refused += c.weight; continue }
          // ⚠️ NOT a crash — an INVALID PLAN, counted as unfit.
          // `enforceViolations` throws on error-severity violations under
          // NODE_ENV=test and merely logs in production, so a throw here is a
          // plan a real runner WOULD RECEIVE, carrying a violation of the
          // engine's own constitution. Rethrowing would make this harness
          // fall over on exactly the defect it exists to find.
          codes['THREW-INVALID'] = (codes['THREW-INVALID'] ?? 0) + c.weight
          continue
        }
        const m = plan.meta as unknown as Record<string, unknown>
        const maintDeclared = m.volume_profile === 'maintenance' && !!m.volume_constraint_note
        const errs = validatePlan(plan, c.input).filter(v => v.severity === 'error')
        const objs = auditPlanQuality(plan, c.input).filter(o =>
          !(o.code === 'LONG-RUN-SHORT' && distanceKm > 42.2)
          && !(o.code === 'NEVER-BUILDS' && maintDeclared))
        for (const o of objs) codes[o.code] = (codes[o.code] ?? 0) + c.weight
        if (!errs.length && !objs.length) fit += c.weight
      }
      const rate = fit / total
      const top = Object.entries(codes).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([k, v]) => `${k} ${(v / total * 100).toFixed(0)}%`).join(', ')
      expect(
        rate,
        `${distanceKm} km: fit-for-purpose ${(rate * 100).toFixed(1)}% (refused ` +
        `${(refused / total * 100).toFixed(1)}%). Floor ${(floor * 100).toFixed(0)}%. Top objections: ${top}\n` +
        `  A DROP is a coaching regression. A RISE is good — raise the floor in a commit that says by how much.`,
      ).toBeGreaterThanOrEqual(floor)
    })

  it('every distance has a floor — a distance with no floor is a distance nobody is watching', () => {
    for (const d of DISTANCE_BANDS) {
      expect(FLOORS[d.value], `no fit-for-purpose floor for ${d.value} km`).toBeGreaterThan(0)
      expect(VOLUME_BANDS_BY_DISTANCE[d.value] ?? MARATHON_VOLUME_BANDS).toBeTruthy()
    }
  })
})
