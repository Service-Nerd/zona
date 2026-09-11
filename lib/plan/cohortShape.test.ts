// COHORT-SHAPE-01 — did this change reshape the population of plans?
//
// THE THIRD QUESTION. The engine already answers two:
//   `npm run verify`        — are plans VALID?     (0 invariant violations)
//   `npm run verify:parity` — are plans UNCHANGED? (byte-identical hashes)
// Neither can see a cohort being reclassified. On 2026-09-11 extending §81's
// obligation to structured sessions took `volume_profile: 'maintenance'` from
// 20% to 80% of plans at a 30-minute weekday cap — a +60pp swing, the same
// magnitude the Coaching Board REJECTED on 2026-09-06 — and the suite was green
// throughout. 16,038 plans, zero violations, nothing to see.
//
// A move here is NOT automatically a bug. Most of the engine work that matters
// is supposed to move these numbers. What it is, is something that must be
// DECLARED — with the number — before it ships, which is the whole complaint
// that produced this file.
//
// WHEN THIS GOES RED:
//   1. Read which metric moved and by how much. The message says both.
//   2. Decide whether you intended it. If a Coaching Board ruling is behind it,
//      that ruling should already quote this number.
//   3. `npm run cohort:shape -- --write`, and say in the commit WHICH number
//      moved and WHY. The JSON diff is the statement.
// Never re-baseline to turn a test green. That converts the one check that can
// see this class of change into a rubber stamp.

import { describe, it, expect } from 'vitest'
import baseline from './__fixtures__/cohortShapeBaseline.json'
import { summariseCohort, type CohortShape, type CohortCase } from './cohortShape'
import { cohortGrid, COHORT_PLAN_START, COHORT_REFUSAL } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import { composePlanWithFoundation } from './foundationCompose'

function runCohort(): CohortCase[] {
  return cohortGrid().map(input => {
    try {
      const raw = generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
      const plan = composePlanWithFoundation(raw, input, COHORT_PLAN_START, 'add').plan
      return { input, plan, refused: false }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { input, plan: null, refused: COHORT_REFUSAL.test(msg) }
    }
  })
}

const actual = summariseCohort(runCohort())
const base = baseline as unknown as CohortShape

/** Rates are percentages of ~620 plans, so one plan is ~0.16pp. A tolerance of
 *  0.5 absorbs a single plan tipping a boundary without absorbing anything a
 *  human would call a change. The §81 incident was +60pp. */
const TOLERANCE_PP = 0.5
/** Kilometres. One rounded session moving is ~0.1km on a mean of ~620. */
const TOLERANCE_KM = 0.3

describe('cohort shape — the population must not change silently', () => {
  // If the grid stopped generating, every rate below would compare 0 to 0 and
  // pass. That exact failure (SWEEP-VACUOUS-01) shipped here before.
  it('the grid still generates what it used to', () => {
    expect(actual.attempted).toBe(base.attempted)
    expect(actual.failed, 'a hard failure is never acceptable in this grid').toBe(0)
    expect(
      actual.generated,
      `Generated ${actual.generated} plans, baseline ${base.generated}. A change in ` +
      `how many inputs the engine ACCEPTS is a finding in itself — every rate ` +
      `below is measured against this denominator.`,
    ).toBe(base.generated)
    expect(actual.generated).toBeGreaterThan(100)
  })

  it.each([
    ['maintenancePct',          'plans downgraded to maintenance'],
    ['constrainedByInputsPct',  'plans classified constrained_by_inputs'],
    ['volumeConstrainedPct',    'plans whose ramp never reached target peak'],
    ['timeCompressedPct',       'plans short of calendar weeks'],
    ['constraintNotePct',       'plans carrying a runner-facing constraint note'],
    ['plansWithNoQualityPct',   'plans with no quality session at all'],
    ['earlyQualityOnsetPct',    'plans granted §89 early quality onset'],
  ] as const)('%s is unchanged (%s)', (key, human) => {
    const a = actual[key] as number
    const b = base[key] as number
    expect(
      Math.abs(a - b),
      `${key} moved ${(a - b).toFixed(1)}pp — ${human}: baseline ${b}%, now ${a}%.\n` +
      `  If you MEANT this, re-baseline with \`npm run cohort:shape -- --write\` and ` +
      `state the number and the reason in the commit.\n` +
      `  If you did NOT, a change somewhere has reshaped who gets what kind of plan.`,
    ).toBeLessThanOrEqual(TOLERANCE_PP)
  })

  it('mean quality per build week is unchanged', () => {
    expect(
      Math.abs(actual.meanQualityPerBuildWeek - base.meanQualityPerBuildWeek),
      `meanQualityPerBuildWeek: baseline ${base.meanQualityPerBuildWeek}, now ` +
      `${actual.meanQualityPerBuildWeek}. This is how much hard work the population ` +
      `is being given — §1 and §8 both bear on it.`,
    ).toBeLessThanOrEqual(0.05)
  })

  it('mean delivered peak volume is unchanged', () => {
    expect(
      Math.abs(actual.meanDeliveredPeakKm - base.meanDeliveredPeakKm),
      `meanDeliveredPeakKm: baseline ${base.meanDeliveredPeakKm}km, now ` +
      `${actual.meanDeliveredPeakKm}km. §79/§89 reserve peak structure to the ` +
      `runner's inputs, so a change here is a change to what the engine believes ` +
      `it is allowed to build.`,
    ).toBeLessThanOrEqual(TOLERANCE_KM)
  })

  it('mean plan length is unchanged', () => {
    expect(Math.abs(actual.meanPlanWeeks - base.meanPlanWeeks)).toBeLessThanOrEqual(0.05)
  })

  // An aggregate can hold steady while one distance swings hard. Marathon is
  // the distance the charity referral channel sends, so a marathon-only
  // regression hiding inside a flat overall rate is the exact shape to catch.
  it.each(Object.keys(baseline.maintenanceByDistance))(
    'maintenance rate for %skm is unchanged',
    distance => {
      const a = actual.maintenanceByDistance[distance]
      const b = base.maintenanceByDistance[distance]
      expect(a, `no plans generated for ${distance}km`).toBeDefined()
      expect(
        Math.abs(a - b),
        `maintenance at ${distance}km moved ${(a - b).toFixed(1)}pp: baseline ${b}%, now ${a}%.`,
      ).toBeLessThanOrEqual(TOLERANCE_PP)
    },
  )
})
