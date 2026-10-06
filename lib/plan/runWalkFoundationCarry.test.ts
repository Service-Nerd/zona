/**
 * RUNWALK-FOUNDATION-GAP-01 — §117 Am.3's interval must reach the FOUNDATION
 * weeks, which `generateRulePlan` never sees.
 *
 * 🔴 THIS WAS LIVE, AND NOT BECAUSE OF THE CHANGE THAT FOUND IT. `generateRulePlan`
 * stamps `run_walk_strategy` as its last act; `composePlanWithFoundation` then
 * PREPENDS weeks built afterwards. Probed over the low-volume beginner marathon
 * grid, **12 of 12** cases that take §117's ORIGINAL route (6-12 km/week, runway
 * long enough to earn a foundation block) shipped 3-9 foundation running sessions
 * with no interval — the charity cohort's first-time marathoner, told to run
 * straight through for three weeks by a plan that prescribes walking everywhere
 * else.
 *
 * ⚠️ WHY NO TEST SAW IT. `INV-PLAN-RUNWALK-PRESCRIBED` fires correctly and
 * `composePlanWithFoundation` returns the violations — but in production errors are
 * LOGGED, not thrown (ADR-006), and no test combined the run-walk route with a
 * foundation block. §117 Am.5 widened the prescription to 15 km/week, at which
 * point `planLength.test.ts`'s existing M1 persona tripped it on the first run.
 * **The suite did not get better; the defect got more common.**
 *
 * ⚠️ IT IS ADR-020'S OWN HAZARD, THE THIRD TIME: *"foundation weeks were
 * prepended after validatePlan() had already run — two live defects shipped from
 * weeks the validator couldn't see."*
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { composePlanWithFoundation } from './foundationCompose'
import type { GeneratorInput } from '@/types/plan'

const TODAY = '2026-09-21'
const raceIn = (w: number) =>
  new Date(new Date(`${TODAY}T00:00:00Z`).getTime() + (w * 7 - 1) * 86_400_000)
    .toISOString().slice(0, 10)

/** The charity cohort's first-time marathoner, at a volume that takes §117's
 *  ORIGINAL door — so this test does not depend on Am.5 existing. */
const lowBase = (runwayWeeks: number, vol: number): GeneratorInput => ({
  athlete_name: 'A', race_name: 'C', primary_metric: 'distance',
  race_distance_km: 42.2, goal: 'finish', current_weekly_km: vol,
  longest_recent_run_km: Math.round(vol * 0.45), days_available: 4, age: 38,
  training_age: '<6mo', recent_quality_training: 'none', fitness_level: 'beginner',
  hard_session_relationship: 'neutral', injury_history: [],
  resting_hr: 55, max_hr: 184, race_date: raceIn(runwayWeeks), plan_start: TODAY,
  foundation_decision: 'add',
} as unknown as GeneratorInput)

function unstamped(plan: { weeks: { n: number; sessions: Record<string, unknown> }[] }) {
  const out: string[] = []
  for (const w of plan.weeks) {
    for (const [day, s] of Object.entries(w.sessions)) {
      const sess = s as { type?: string; run_walk_strategy?: unknown } | null
      if (!sess || sess.type === 'rest' || sess.type === 'cross-train' || sess.type === 'strength') continue
      if (!sess.run_walk_strategy) out.push(`w${w.n}/${day}`)
    }
  }
  return out
}

describe('RUNWALK-FOUNDATION-GAP-01 — the interval survives composition', () => {
  // The grid that found it. Every cell takes §117's original peak-reduction
  // route, so the arm holds whether or not Am.5 is present.
  const CELLS: [number, number][] = [[25, 8], [25, 10], [25, 12], [30, 8], [30, 10], [30, 12], [40, 8], [40, 12]]

  it('every composed plan on the ORIGINAL route is fully stamped', () => {
    let covered = 0
    for (const [runway, vol] of CELLS) {
      const input = lowBase(runway, vol)
      const bare = generateRulePlan(input, 'paid', TODAY, undefined, TODAY)
      // Guard the POPULATION, not just the result: if these inputs stop taking
      // the peak-reduction route, this test is measuring nothing and must say so.
      if ((bare.meta as unknown as Record<string, unknown>).finish_goal_run_walk !== true) continue
      const { plan, violations } = composePlanWithFoundation(bare, input, TODAY, 'add')
      expect(plan.weeks.some(w => w.n <= 0), `${runway}w/${vol}km: no foundation block built`).toBe(true)
      covered++
      expect(unstamped(plan), `${runway}w/${vol}km`).toEqual([])
      expect(violations.filter(v => v.code === 'INV-PLAN-RUNWALK-PRESCRIBED')).toEqual([])
    }
    // An empty population passes every arm above it.
    expect(covered, 'no case took the run-walk route — the grid has gone stale').toBeGreaterThanOrEqual(6)
  })

  it('a plan with NO prescription is left alone', () => {
    // The composition must not invent intervals for a runner who is not on the
    // run-walk shape — the direction that would be invisible.
    const input = lowBase(30, 45)
    const bare = generateRulePlan(input, 'paid', TODAY, undefined, TODAY)
    expect((bare.meta as unknown as Record<string, unknown>).run_walk_prescribed).toBeUndefined()
    const { plan } = composePlanWithFoundation(bare, input, TODAY, 'add')
    const founds = plan.weeks.filter(w => w.n <= 0)
    expect(founds.length).toBeGreaterThan(0)
    for (const w of founds) {
      for (const s of Object.values(w.sessions)) {
        expect((s as { run_walk_strategy?: unknown } | null)?.run_walk_strategy).toBeUndefined()
      }
    }
  })
})
