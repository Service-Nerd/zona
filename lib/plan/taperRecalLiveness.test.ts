// §68 Amendment 1 — TAPER-RECAL-COLUMN-01. The board's third artifact: a check
// that §68 CAN FIRE.
//
// 🔴 `taperRecalibration.test.ts` has 20 thorough assertions on
// `computeTaperRecalibration` and NOT ONE OF THEM COULD HAVE CAUGHT THIS. They
// hand the function a `weeklyActuals` map. The defect was that the ROUTE never
// built one — it queried `strava_activities` for two columns that live on
// `run_analysis`, so the map was always empty and the function correctly
// answered "insufficient actual data" for the feature's entire life.
//
// A principle whose only enforcement is a route nobody proved runs is not
// enforced. This file proves the whole path: real generated plan → the rows the
// route now selects → the function → a plan whose taper actually moved.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { computeTaperRecalibration } from './taperRecalibration'
import { generateRulePlan } from './ruleEngine'
import { GENERATION_CONFIG } from './generationConfig'
import { MARKETING_PLANS, planAnchor } from '@/lib/marketing/plans'
import { trainingKm } from './weekVolume'
import type { Plan } from '@/types/plan'

const ROUTE = readFileSync(join(process.cwd(), 'app/api/recalibrate-taper/route.ts'), 'utf8')

/** A real plan, not a fixture — the defect lived in the join between the engine
 *  and the database, which a hand-built plan cannot exercise. */
function realPlan(slug = 'sub-4-hour-marathon-plan'): Plan {
  const src = MARKETING_PLANS.find(p => p.slug === slug)!
  const { planStart, raceDate } = planAnchor(src.dayOffset)
  return generateRulePlan(src.input(raceDate), 'paid', planStart)
}

const taperStartOf = (p: Plan) => {
  const i = p.weeks.findIndex(w => (w as unknown as { phase?: string }).phase === 'taper')
  return i === -1 ? -1 : i + 1
}

describe('the route reads the table the columns actually live on', () => {
  it('selects from run_analysis, never strava_activities', () => {
    const i = ROUTE.indexOf("select('week_n, actual_load_km')")
    expect(i, 'the actuals query').toBeGreaterThan(-1)
    const q = ROUTE.slice(Math.max(0, i - 200), i + 400)
    expect(q).toContain("from('run_analysis')")
    expect(q).not.toContain("from('strava_activities')")
  })

  it("filters superseded_at — week_n is a WITHIN-PLAN coordinate", () => {
    // PLAN-WEEK-COLLISION-01. Without it the functional peak is computed from
    // training the runner did for a DIFFERENT RACE, which is worse than the
    // feature not firing: it tapers them against a stranger's history.
    const i = ROUTE.indexOf("select('week_n, actual_load_km')")
    expect(ROUTE.slice(i, i + 400)).toContain("is('superseded_at', null)")
  })

  it('reads the query error instead of letting it read as "no training"', () => {
    // That conflation is what hid this for the feature's entire life.
    const i = ROUTE.indexOf("select('week_n, actual_load_km')")
    expect(ROUTE.slice(i, i + 700)).toMatch(/actualsErr/)
  })
})

describe('🔴 §68 CAN FIRE — the liveness proof the 20 existing assertions could not give', () => {
  const plan = realPlan()
  const taperStart = taperStartOf(plan)

  it('the corpus reaches the case at all — an unreachable test is not a test', () => {
    expect(taperStart, 'a real marathon plan must have a taper phase').toBeGreaterThan(1)
    expect(plan.weeks.length).toBeGreaterThan(taperStart)
  })

  it('an under-completing runner gets their taper re-anchored', () => {
    // Exactly the rows the route now selects: actual km per plan week, for the
    // build and peak weeks, at 70% of what was planned — the common amateur
    // pattern McMillan named (a work trip and a cold).
    const weeklyActuals = new Map<number, number>()
    for (let n = 1; n < taperStart; n++) {
      const w = plan.weeks[n - 1]
      if (w) weeklyActuals.set(n, (w.weekly_km ?? 0) * 0.7)
    }
    expect(weeklyActuals.size).toBeGreaterThanOrEqual(GENERATION_CONFIG.TAPER_RECAL_MIN_WEEKS_DATA)

    const before = plan.weeks.slice(taperStart - 1).map(w => trainingKm(w))
    const res = computeTaperRecalibration({ weeklyActuals, plan, currentWeekN: taperStart })

    expect(res.skipReason, 'it must not skip').toBeUndefined()
    expect(res.applied, '§68 must actually apply').toBe(true)
    expect(res.plan, 'an applied recalibration returns a plan').toBeDefined()

    // And the taper genuinely moved — "applied: true" with identical volumes
    // would be the same green tick with nothing behind it.
    const after = res.plan!.weeks.slice(taperStart - 1).map(w => trainingKm(w))
    expect(after.some((km, i) => km < before[i]), 'at least one taper week must come down').toBe(true)
  })

  it('and the exact shape of the old failure is what "not firing" looks like', () => {
    // The map the broken route produced, every time, for everyone.
    const res = computeTaperRecalibration({ weeklyActuals: new Map(), plan, currentWeekN: taperStart })
    expect(res.applied).toBe(false)
    expect(res.skipReason).toMatch(/insufficient actual data \(0 </)
  })

  it('a runner who did what was asked is left alone — downward only', () => {
    const weeklyActuals = new Map<number, number>()
    for (let n = 1; n < taperStart; n++) {
      const w = plan.weeks[n - 1]
      if (w) weeklyActuals.set(n, (w.weekly_km ?? 0) * 1.1)
    }
    const res = computeTaperRecalibration({ weeklyActuals, plan, currentWeekN: taperStart })
    expect(res.applied, 'overperformance must never raise the taper (Willy)').toBe(false)
  })
})
