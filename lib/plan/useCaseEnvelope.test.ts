import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { isDesignedRefusal } from './designedRefusal'
import { sessionKmSelfPaced } from './sessionDistance'
import { marathonEnvelope, MARATHON_VOLUME_BANDS, DAYS_BANDS, LEVEL_BANDS } from './useCaseEnvelope'

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
  const cases = marathonEnvelope().filter((_, i) => i % STRIDE === 0)

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

  it('a weighted majority of real marathon entrants get a plan we would hand over', () => {
    let total = 0, fit = 0, refused = 0
    for (const c of cases) {
      total += c.weight
      let plan
      try { plan = generateRulePlan(c.input, 'paid') }
      catch (e) { if (isDesignedRefusal(e)) { refused += c.weight; continue } throw e }

      const errs = validatePlan(c.input ? plan : plan, c.input).filter(v => v.severity === 'error')
      const km = plan.weeks.map(w => w.weekly_km ?? 0)
      const peak = Math.max(...km.slice(0, -1)), w1 = km[0] || 1
      let lrKm = 0, lrMins = 0, fuel = false, worstShare = 0
      for (const w of plan.weeks) {
        const wk = w.weekly_km ?? 0
        for (const s of Object.values(w.sessions ?? {})) {
          if (s?.role !== 'long_run') continue
          const d = sessionKmSelfPaced(s) ?? 0
          if (wk > 0) worstShare = Math.max(worstShare, d / wk)
          if (d > lrKm) { lrKm = d; lrMins = s.duration_mins ?? 0 }
          if ((s.coach_notes ?? []).some(n => /fuelling matters|Fuel every/.test(String(n)))) fuel = true
        }
      }
      const m = plan.meta as unknown as Record<string, unknown>
      // §23's maintenance note counts as declaring a shortfall — omitting it
      // reported 2.1% of plans "silent" that were not.
      const declares = !!(m.long_run_shortfall_note || m.peak_shortfall_note
        || m.volume_shortfall_note || m.volume_constraint_note)
      // §80 — distance OR time on feet. A beginner's 208-minute long run is the
      // prescription; judging it on kilometres alone would fail a correct plan.
      const farEnough = lrKm >= 26 || lrMins >= 180
      const builds = peak > w1 * 1.10
        || (m.volume_profile === 'maintenance' && !!m.volume_constraint_note)
      if (errs.length === 0 && builds && farEnough && (lrMins < 120 || fuel)
          && worstShare <= 0.70 && (declares || farEnough)) fit += c.weight
    }
    const rate = fit / total
    expect(
      rate,
      `Fit-for-purpose ${(rate * 100).toFixed(1)}% of weighted marathon entrants ` +
      `(refused ${(refused / total * 100).toFixed(1)}%). Floor ${FIT_FOR_PURPOSE_FLOOR * 100}%.\n` +
      `  A DROP is a coaching regression, not a test failure — find what stopped serving whom.\n` +
      `  A RISE is good and the floor should be raised deliberately, in a commit that says by how much.`,
    ).toBeGreaterThanOrEqual(FIT_FOR_PURPOSE_FLOOR)
  })
})
