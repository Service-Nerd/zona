import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { isDesignedRefusal } from './designedRefusal'
import { sessionKmSelfPaced } from './sessionDistance'
import { measureEnvelope } from './envelopeMeasure'
import baselineJson from './__fixtures__/envelopeBaseline.json'
import type { EnvelopeMeasure } from './envelopeMeasure'
// The JSON's inferred literal type has no index signature; the measure's
// own type is the right one to read it through.
const baseline = baselineJson as unknown as EnvelopeMeasure
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
  // ⚠️ THE MARATHON FLOOR DROPPED 0.88 -> 0.78 ON 2026-09-20 AND THAT IS NOT A
  // RELAXATION. THE RUBRIC GOT HARDER, SO THE SAME ENGINE SCORES LOWER.
  //
  // Until today a DESIGNED REFUSAL counted as fit-for-purpose whenever its
  // message named a next step (§44's standard). The founder's standard is now
  // explicit and different: **"if someone comes to our platform and asks for a
  // run, we can't just say no, go away"** — a refusal must lead to a PLAN, not
  // to advice. So a refusal is now a DROPOUT and scores zero.
  //
  // Measured the day the bar moved, same engine, same corpus, both rubrics:
  //
  //     distance   refusal=pass (old)   refusal=FAIL (new)   refused
  //        5 km          100.0%               100.0%           0.0%
  //       10 km          100.0%               100.0%           0.0%
  //     21.1 km           96.2%                96.2%           0.0%
  //     42.2 km           90.1%           **79.3%**           10.9%
  //       50 km          100.0%               100.0%           0.0%
  //      100 km          100.0%               100.0%           0.0%
  //
  // 🔴 **EVERY OTHER DISTANCE IS UNCHANGED, because no other distance refuses
  // anyone.** The entire 10.8-point marathon gap is rejection, and rejection is
  // now the single thing standing between this product and its own target.
  //
  // ⚠️ THE TARGET IS UNCHANGED AND IS NOT THIS NUMBER. The founder's bar is
  // **90-95% on every distance**. 0.78 is a DEBT FLOOR in the same pattern as
  // SWEEP-BASELINE-01 and the liveness baseline: it makes the gap visible and
  // stops it growing. **It is not permission to sit at 79%.** Raise it as the
  // marathon rejection rate falls, and never lower it again.
  // ⚠️ AND IT DROPPED AGAIN, 0.78 -> 0.77, ON THE SAME DAY AND FOR THE SAME
  // REASON: the POPULATION was also wrong. The lowest marathon volume band was
  // 8 km/week, which sits ABOVE the 6 km/week arithmetic floor — so every
  // runner the on-ramp cannot help was outside the measured population
  // entirely. 60% of real §111 refusals start below 6 km/week and were scoring
  // nothing, in either direction. A 4 km/week band now exists.
  //
  //     79.3%  ->  77.6%   (refused 10.9% -> 12.2%)
  //
  // **Two corrections in one day, both of which made the number worse, and
  // neither of which changed a single line of the engine.** The score was
  // wrong about what counts as success AND wrong about who was being counted.
  // ⚠️ RATCHETED UP 0.77 -> 0.79 on 2026-09-20 — the FIRST upward move of the
  // day, and the only one that came from the engine rather than the ruler.
  // §117 went live at peak 34 and LONG-RUN-SHORT became WATCHED on those plans
  // (the board ruled their adequacy; the 55%-of-race bar is the run-it bar).
  // 77.6% -> 79.2%, refused 12.2% -> 11.3%.
  //
  // ⚠️ THE EXEMPTION IS PRINTED, NOT HIDDEN: `LONG-RUN-SHORT-RUNWALK 1.5%`
  // appears in the WATCHED block on every run. An exemption you cannot see is
  // a moved goalpost.
  const MARATHON_TARGET = 0.90   // the founder's bar; currently 0.792. Gap: 10.8pp — 11.3 of it refusals, which the board ruled coaching cannot reach.
  const FLOORS: Record<number, number> = {
    5: 0.97, 10: 0.97, 21.1: 0.93, 42.2: 0.79, 50: 0.97, 100: 0.92,
  }
  void MARATHON_TARGET
  // WEEK1-LEAP-ABS-01 raised 5K again, 91.8% -> 100%: the ≤2km week-1
  // "leap" artefact was almost entirely a 5K phenomenon, because that is where
  // the absolute volumes are small enough for a ratio to be meaningless.
  // Whole product 78.0% -> 84.5%.

  // ⚠️ THE FLOOR IS NOT IN THE TITLE, deliberately. It was, and raising a floor
  // then renamed the test, which broke its entry in the duration baseline
  // (matched on file + title). A test name that embeds a number churns every
  // time the number moves; the floor belongs in the failure message.
  // ⚠️ ONE CORPUS WALK, TWO CHECKS, AND THE SECOND ONE IS NEW.
  // The floors are a ONE-SIDED gate: a drop fails, a rise is silent. So the
  // question asked between board sittings -- "is this better or worse than
  // last time, and where?" -- had no mechanical answer and the numbers were
  // re-derived by hand each round. That is the same shape as the defect that
  // made the board appear to change its mind: a measurement nobody wrote down.
  //
  // `measureEnvelope` is the single owner, shared with
  // `scripts/measure-envelope.ts --write`. A second copy of the computation
  // would drift, which this repo has paid for three times.
  const measured = measureEnvelope()

  it.each(DISTANCE_BANDS.map(d => [d.value, FLOORS[d.value]] as const))(
    '%s km — a weighted majority of entrants get a plan we would hand over',
    (distanceKm, floor) => {
      const m = measured.byDistance[String(distanceKm)]
      expect(m, `no measurement for ${distanceKm} km`).toBeTruthy()
      expect(
        m.invalidPlans,
        `${distanceKm} km: ${m.invalidPlans} plan(s) fail the engine's own constitution`,
      ).toBe(0)
      expect(
        m.refusedWithoutNextStepPct,
        `${distanceKm} km: ${m.refusedWithoutNextStepPct}% refused WITHOUT naming a next step. ` +
        `§44's standard is "not yet", never "no" — a refusal with no route back is a dropout.`,
      ).toBe(0)
      const top = Object.entries(m.objections).slice(0, 3)
        .map(([k, v]) => `${k} ${v}%`).join(', ')
      expect(
        m.fitPct / 100,
        `${distanceKm} km: fit-for-purpose ${m.fitPct}% (refused ${m.refusedPct}%). ` +
        `Floor ${(floor * 100).toFixed(0)}%. Top objections: ${top}`,
      ).toBeGreaterThanOrEqual(floor)
    })

  it('no distance has MOVED against the recorded baseline, in either direction', () => {
    // The two-sided half. A RISE is good and still has to be declared, because
    // an undeclared rise is an unexplained change in what runners receive.
    const moves: string[] = []
    const check = (label: string, now: number, was: number) => {
      if (Math.abs(now - was) > 0.6) moves.push(`${label}: ${was}% -> ${now}% (${(now - was).toFixed(1)}pp)`)
    }
    check('WHOLE PRODUCT', measured.productFitPct, baseline.productFitPct)
    for (const d of Object.keys(measured.byDistance)) {
      check(`${d}km`, measured.byDistance[d].fitPct, baseline.byDistance[d]?.fitPct ?? -1)
    }
    expect(
      moves,
      `Fit-for-purpose moved:\n  ${moves.join('\n  ')}\n` +
      `  A MOVE IS NOT AUTOMATICALLY WRONG — it is automatically something to DECLARE.\n` +
      `  Re-baseline with \`npm run measure:envelope -- --write\` and say in the commit\n` +
      `  which number moved and why. Never to turn a test green.`,
    ).toEqual([])
  })

  it('every distance has a floor — a distance with no floor is a distance nobody is watching', () => {
    for (const d of DISTANCE_BANDS) {
      expect(FLOORS[d.value], `no fit-for-purpose floor for ${d.value} km`).toBeGreaterThan(0)
      expect(VOLUME_BANDS_BY_DISTANCE[d.value] ?? MARATHON_VOLUME_BANDS).toBeTruthy()
    }
  })
})
