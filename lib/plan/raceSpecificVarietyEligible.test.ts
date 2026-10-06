import { describe, it, expect } from 'vitest'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { FITNESS_RANK } from './fitnessAssessment'
import type { Plan, Session } from '@/types/plan'

// §104 Amendment — an ALTERNATIVE is one the RUNNER is eligible for, not one the
// catalogue owns.
//
// 🔴 Before the fitness gate this check fired 3,456 times, ALL on HM plans, and
// every message named a session the runner could not be prescribed: a beginner
// told to use `hm_pace_intervals` (`fitness_level_min: 'intermediate'`), an
// intermediate told to use `beginner_goal_pace_blocks`
// (`fitness_level_max: 'beginner'`).
//
// ⚠️ AND THE FIX COULD HAVE SILENTLY KILLED THE CHECK. With the gate applied, HM
// and MARATHON have exactly ONE eligible race-specific peak quality row per
// fitness band, so the check CANNOT fire for them at all. It remains wakeable only
// for 10K intermediate/experienced, where two are eligible. The falsification arm
// below proves that, because "fires 0 times" and "cannot fire" are different
// claims and only one of them is acceptable.
const CODE = 'INV-PLAN-RACE-SPECIFIC-VARIETY'

const eligiblePeakRows = (distKey: string, fitness: string) => {
  const rank = (FITNESS_RANK as Record<string, number>)[fitness]
  return V1_SESSION_CATALOGUE.filter(r =>
    r.category === 'race_specific'
    && (r.distance_eligibility as readonly string[]).includes(distKey)
    && (r.phase_eligibility as readonly string[]).includes('peak')
    && (r.main_set_structure as { type?: string } | null)?.type !== 'long_run_with_segment'
    && (FITNESS_RANK as Record<string, number>)[r.fitness_level_min] <= rank
    && (r.fitness_level_max == null || rank <= (FITNESS_RANK as Record<string, number>)[r.fitness_level_max]))
}

describe('§104 Am. — variety alternatives must be eligible for THIS runner', () => {
  it('no longer fires on HM plans, where no band has a second eligible row', () => {
    let checked = 0
    for (const g of cohortGrid()) {
      if (g.race_distance_km !== 21.1 || g.goal !== 'time_target') continue
      let plan: Plan
      try { plan = generateRulePlan(g, 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch { continue }
      checked++
      expect(validatePlan(plan, g).filter(v => v.code === CODE).map(v => v.message?.slice(0, 90)))
        .toEqual([])
      if (checked >= 40) break
    }
    expect(checked, 'population must be non-empty').toBeGreaterThan(0)
  })

  it('HM and MARATHON have exactly ONE eligible row per band — so the check is structurally silent there', () => {
    for (const d of ['HM', 'MARATHON']) {
      for (const f of ['beginner', 'intermediate', 'experienced']) {
        expect(eligiblePeakRows(d, f).length, `${d} ${f}`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('but it is STILL WAKEABLE for 10K intermediate+, which is why the fix is a gate and not a deletion', () => {
    for (const f of ['intermediate', 'experienced']) {
      expect(eligiblePeakRows('10K', f).length, `10K ${f} must have 2 eligible rows`).toBeGreaterThanOrEqual(2)
    }
  })

  it('FALSIFICATION — a genuine single-row repeat on 10K intermediate DOES fire', () => {
    const g = cohortGrid().find(x => x.race_distance_km === 10
      && x.goal === 'time_target' && x.fitness_level === 'intermediate')
    expect(g, 'need a 10K intermediate time-target row').toBeTruthy()
    const plan = generateRulePlan(g!, 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
    // Forge a peak that fills two slots with the SAME eligible race-specific row.
    const row = eligiblePeakRows('10K', 'intermediate')[0]
    const peak = plan.weeks.filter(w => w.n >= 1 && w.phase === 'peak')
    expect(peak.length, 'fixture needs peak weeks').toBeGreaterThan(1)
    const donor: Session = {
      type: 'quality', label: row.name, catalogue_id: row.id,
      distance_km: 10, duration_mins: 50, zone: 'Zone 4',
    } as unknown as Session
    const forged: Plan = {
      ...plan,
      weeks: plan.weeks.map(w =>
        peak.some(p => p.n === w.n)
          ? { ...w, sessions: { ...w.sessions, wed: donor } }
          : w),
    }
    const fired = validatePlan(forged, g!).filter(v => v.code === CODE)
    expect(fired.length, 'repeating one eligible row across peak must still be caught').toBeGreaterThan(0)
    expect(fired[0].message, 'and the named alternative must be one this runner CAN have')
      .toMatch(/tenk_race_simulation|tenk_pace_intervals/)
  })
})
