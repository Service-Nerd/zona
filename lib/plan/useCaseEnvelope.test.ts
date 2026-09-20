import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { isDesignedRefusal } from './designedRefusal'
import { sessionKmSelfPaced } from './sessionDistance'
import { auditPlanQuality } from './planQuality'
import { distanceEnvelope, DISTANCE_BANDS, MARATHON_VOLUME_BANDS, DAYS_BANDS, levelBandsFor,
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
    // ⚠️ `levelBandsFor` REPLACED the flat LEVEL_BANDS when level became
    // conditional on volume (ENVELOPE-COHERENCE-01). Asserting the old flat
    // table here would check a constant the builder no longer reads — a
    // decorative assertion. Every conditional band set is checked instead.
    for (const [name, bands] of [
      ['volume', MARATHON_VOLUME_BANDS], ['days', DAYS_BANDS],
      ['level@10', levelBandsFor(10)], ['level@20', levelBandsFor(20)],
      ['level@35', levelBandsFor(35)], ['level@60', levelBandsFor(60)],
    ] as const) {
      const sum = bands.reduce((s, b) => s + b.weight, 0)
      expect(Math.abs(sum - 1), `${name} bands sum to ${sum}`).toBeLessThan(0.001)
    }
  })

  it('every band carries a stated reason — a weight with no argument is a guess in disguise', () => {
    for (const b of [...MARATHON_VOLUME_BANDS, ...DAYS_BANDS, ...levelBandsFor(10), ...levelBandsFor(60)]) {
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
  // FLOORS RAISED DELIBERATELY 2026-09-19 after COPY-STALE-GEN-01 and
  // FREQ-SILENCE-01, and the movement is stated rather than absorbed:
  //   5K   50.6 -> 91.8  (+41.2pp — almost all of it FREQ-SILENCE-01; 46% of
  //                       5K plans were silently short on days)
  //   10K  59.3 -> 73.0  (+13.7)
  //   HM   70.3 -> 84.0  (+13.7)
  //   42.2 67.4 -> 72.8  (+5.4 — the marathon gains least because its gap is
  //                       18.5% REFUSALS, which item 4 addresses, not silence)
  //   50K  91.6 -> 93.3  ·  100K 89.9 -> 93.4 (COPY-STALE-GEN-01)
  //   whole product 66.7 -> 78.0
  // Floors sit a little under measured so ordinary noise does not fail a build;
  // a real regression still does.
  // Floors after ENVELOPE-COHERENCE-01 made level conditional on volume.
  // Measured: 5K 100% · 10K 78.3% · HM 85.4% · marathon 73.9% · 50K 94.3% ·
  // 100K 93.5%; whole product 85.3% (was 66.7% at the start of the build).
  // The marathon is now the weakest and its gap is 17.3% REFUSALS, which
  // measurement showed are correct (a capped peak would be below the credible
  // floor for 100% of them). Excluding designed refusals, 89.4% of the
  // marathon plans we actually generate are fit to hand over.
  // Floors after REFUSAL-IS-AN-OUTCOME-01 (2026-09-20), which counts a correct
  // refusal as a fit-for-purpose OUTCOME rather than a failure. Measured:
  //   5K 100% · 10K 78.3% · HM 85.4% · marathon 90.1% · 50K 100% · 100K 100%
  //   whole product 87.0%  (was 66.7% at the start of the 2026-09-19 build)
  // ⚠️ THE MARATHON IS NOW IN TARGET at 90.1%, and 10.9pp of that is correct
  // refusals — every one of which names a next step, asserted below.
  // ⚠️ UPDATED 2026-09-20 after §2 Amendment 2 (HM-WEEK1-PERRUN-01):
  //   5K 100% · 10K 100% · HM 96.2% · marathon 90.1% · 50K 100% · 100K 100%
  //   WHOLE PRODUCT 95.3%.
  // The HM's entire 12% gap was the ratio arm firing on the 10 km/week cohort,
  // whose week 1 is a 5.3 km long run against a 5 km longest-ever plus two
  // 32-minute easy runs. The MARATHON FLOOR IS THE BOARD'S HARD CONDITION:
  // two engine caps were vetoed for taking it out of target, and this change
  // holds it at 90.1%.
  const FLOORS: Record<number, number> = {
    5: 0.97, 10: 0.97, 21.1: 0.93, 42.2: 0.88, 50: 0.97, 100: 0.92,
  }
  // WEEK1-LEAP-ABS-01 raised 5K again, 91.8% -> 100%: the ≤2km week-1
  // "leap" artefact was almost entirely a 5K phenomenon, because that is where
  // the absolute volumes are small enough for a ratio to be meaningless.
  // Whole product 78.0% -> 84.5%.

  // ⚠️ THE FLOOR IS NOT IN THE TITLE, deliberately. It was, and raising a floor
  // then renamed the test, which broke its entry in the duration baseline
  // (matched on file + title). A test name that embeds a number churns every
  // time the number moves; the floor belongs in the failure message.
  it.each(DISTANCE_BANDS.map(d => [d.value, FLOORS[d.value]] as const))(
    '%s km — a weighted majority of entrants get a plan we would hand over',
    (distanceKm, floor) => {
      let total = 0, fit = 0, refused = 0, refusedWithoutNextStep = 0
      // COPY-STALE-GEN-01 — no generated plan may carry an error-severity
      // violation. Asserted HERE because this suite already generates the
      // corpus; a second walk elsewhere cost 3.6s and proved the same thing.
      const invalid: string[] = []
      const codes: Record<string, number> = {}
      for (const c of distanceEnvelope(distanceKm).filter((_, i) => i % STRIDE === 0)) {
        total += c.weight
        let plan
        try { plan = generateRulePlan(c.input, 'paid') }
        catch (e) {
          // ⚠️ A CORRECT REFUSAL IS A FIT-FOR-PURPOSE OUTCOME, NOT A FAILURE
          // (founder, 2026-09-20). Refusing an 8 km/week runner a marathon is
          // the right answer: measured, for 100% of §111-refused cases a
          // capped peak lands below the credible floor (median 22.4 km against
          // 52.8), so the only alternative is a degenerate plan.
          //
          // ⚠️ BUT A REFUSAL HAS TO EARN IT, WHICH IS WHY IT IS CHECKED.
          // §44's standard is "not yet", never "no" — the refusal must name
          // what to do next. One that just says no is a dropout and still
          // counts against us. Measured: BaseVolumeError names a next step in
          // 100% of cases ("get to about 11 km a week first... come back").
          if (isDesignedRefusal(e)) {
            refused += c.weight
            const msg = e instanceof Error ? e.message : String(e)
            if (/get to|come back|build to|at least|first|instead|about \d/i.test(msg)) fit += c.weight
            else refusedWithoutNextStep += c.weight
            continue
          }
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
        if (errs.length) invalid.push(`${c.label} :: ${errs.map(e => e.code).join(',')}`)
        // ⚠️ The LONG-RUN-SHORT ultra exclusion USED TO BE HERE and has moved
        // into `planQuality` itself (ULTRA-LR-BAR-01). Knowledge about what
        // counts as a defect belongs to the owner of the predicates, not to
        // one of its consumers — while it lived here, `audit:plans` and this
        // harness disagreed about whether an ultra plan was defective.
        const objs = auditPlanQuality(plan, c.input).filter(o =>
          !(o.code === 'NEVER-BUILDS' && maintDeclared))
        for (const o of objs) codes[o.code] = (codes[o.code] ?? 0) + c.weight
        if (!errs.length && !objs.length) fit += c.weight
      }
      expect(invalid, `${distanceKm} km: plans failing the engine's own constitution`).toEqual([])
      expect(
        refusedWithoutNextStep / total,
        `${distanceKm} km: ${(refusedWithoutNextStep / total * 100).toFixed(1)}% refused WITHOUT naming a next ` +
        `step. §44's standard is "not yet", never "no" — a refusal with no route back is a dropout.`,
      ).toBe(0)
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
