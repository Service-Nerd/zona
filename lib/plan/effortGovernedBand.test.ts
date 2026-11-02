/**
 * §40b Amendment 4 — an effort-governed session carries the zone its row declares and no
 * HR band (Coaching Board 2026-11-02, ULTRA-ROWS-PRICED-AS-QUALITY-01).
 *
 * Amendment 1 excluded effort-governed rows from §22 across three surfaces — the label,
 * the `pace_target` and the `derived_set` — and the engine set the FOURTH, zone and HR,
 * from the interval band. So §40b's own body ended up describing the engine's output as
 * its counter-example: *"'Zone 4–5' describes a physiological band, not an instruction a
 * runner can execute on a hill."*
 *
 * Measured before the fix, 18 time-targeted ultra plans: `vert_hike_repeats` — power
 * hiking, `rpe: 6`, row declaring `['Z2']` — delivered as Zone 4–5 with `158–184 bpm`,
 * in peak, two days before the long run.
 *
 * ⚠️ THE POPULATION OF EFFORT-GOVERNED ROWS IS DERIVED, NEVER LISTED. It is two today
 * (`hill_reps`, `vert_hike_repeats`) and they disagree about the answer, which is the
 * whole reason the rule reads the row rather than the fact of being effort-governed. A
 * third row is in scope the moment it is added.
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { isEffortGovernedRow } from './hrBand'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { zoneStringFromZoneKeys } from '@/lib/coaching/zoneRules'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import type { GeneratorInput, Session } from '@/types/plan'

const EFFORT_ROWS = V1_SESSION_CATALOGUE.filter(isEffortGovernedRow)

/** A time-targeted ultra reaches `vert_hike_repeats`; the cohort grid contains no ultra
 *  at all, which is why the first measurement of this family missed it. */
const ultraInput = (km: number, target: string): GeneratorInput => ({
  race_distance_km: km, goal: 'time_target', target_time: target,
  current_weekly_km: 55, longest_recent_run_km: 30, days_available: 6, age: 42,
  training_age: '5yr+', recent_quality_training: 'regular', race_date: '2027-03-28',
} as unknown as GeneratorInput)

const sessionsOf = (plan: { weeks: { n: number; sessions?: Record<string, Session | undefined> }[] }) =>
  plan.weeks.flatMap(w => Object.values(w.sessions ?? {}).filter(Boolean) as Session[])

describe('the catalogue — the two rows disagree, which is why the rule reads the row', () => {
  it('there is more than one effort-governed row and they declare different zones', () => {
    expect(EFFORT_ROWS.length).toBeGreaterThan(1)
    const declared = new Set(EFFORT_ROWS.map(r => zoneStringFromZoneKeys(r.intensity_zones)))
    // If this ever collapses to one value, a blanket rule would be safe and this test is
    // the thing that would tell you — which is the point of asserting it.
    expect(declared.size).toBeGreaterThan(1)
  })

  it('every effort-governed row declares an intensity_zones to be read', () => {
    for (const r of EFFORT_ROWS) {
      expect(zoneStringFromZoneKeys(r.intensity_zones), r.id).toBeTruthy()
    }
  })
})

describe('§40b Am.4 — the generated session', () => {
  it('the traced case: the power-hike reads its own zone, no HR band, RPE intact', () => {
    const plan = generateRulePlan(ultraInput(50, '5:30:00'), 'paid', COHORT_PLAN_START)
    const hikes = sessionsOf(plan).filter(s => s.catalogue_id === 'vert_hike_repeats')
    expect(hikes.length, 'no power-hike session generated — the assertion never ran').toBeGreaterThan(0)
    for (const s of hikes) {
      expect(s.zone).toBe('Zone 2')          // the row declares ['Z2']
      expect(s.hr_target).toBeUndefined()    // omitted, not '' — hrBandFor reads a string as "had a band"
      expect(s.pace_target).toBeUndefined()  // §40b, unchanged
      expect(s.rpe_target).toBe(6)           // the RPE IS the prescription
    }
  })

  it('hill_reps keeps Zone 4–5 — the rule is the row, not the exclusion', () => {
    const grid = (cohortGrid() as GeneratorInput[]).filter(i => i.race_distance_km === 10)
    let found = 0
    for (let k = 0; k < grid.length; k += 23) {
      let plan
      try { plan = generateRulePlan(grid[k], 'paid', COHORT_PLAN_START) } catch { continue }
      for (const s of sessionsOf(plan)) {
        if (s.catalogue_id !== 'hill_reps') continue
        found++
        expect(s.zone).toBe('Zone 4–5')
        expect(s.hr_target).toBeUndefined()  // the HR arm binds here too: 1,757 sessions
      }
      if (found > 40) break
    }
    expect(found, 'no hill_reps session generated — the assertion never ran').toBeGreaterThan(0)
  })

  it('validatePlan reports no violation on an ultra plan carrying the hike', () => {
    for (const [km, target] of [[50, '5:30:00'], [100, '13:00:00']] as const) {
      const input = ultraInput(km, target)
      const plan = generateRulePlan(input, 'paid', COHORT_PLAN_START)
      const errs = validatePlan(plan, input).filter(v => v.severity === 'error')
      expect(errs.map(e => `${e.code} w${e.week}`), `${km}K`).toEqual([])
    }
  })
})
