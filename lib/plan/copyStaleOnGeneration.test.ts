import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { isDesignedRefusal } from './designedRefusal'
import { distanceEnvelope, DISTANCE_BANDS } from './useCaseEnvelope'
import type { GeneratorInput } from '@/types/plan'

/**
 * COPY-STALE-GEN-01 — a generated plan may not claim a session it does not have.
 *
 * ⚠️ THE REPAIR ALREADY EXISTED AND THE GENERATOR COULD NOT REACH IT.
 * `refreshWeekCopyIfStale` had exactly one caller, `app/api/adjust-plan`. So a
 * plan whose copy went stale DURING GENERATION shipped stale and only a later
 * reshape would ever fix it.
 *
 * ⚠️ MEASURED: 96 plans in the 100K envelope shipped error-severity violations
 * — a week labelled "Build — recovery + benchmark", theme promising "one hard
 * effort in the middle", and three easy sessions. All were 3 days/week at 100K
 * on a 26-week runway. In PRODUCTION these SHIP: `enforceViolations` throws
 * only under development/test and otherwise logs.
 *
 * ⚠️ THE CAUSE IS STALENESS, NOT A WRONG PREDICATE. The label reads
 * `hasBenchmark` — a fact — so it was right when written; a later pass removed
 * the hard session and nothing re-read the copy. Identical to
 * LONG-SESSION-FUEL-01 hours earlier (a duration read at placement was 116 min
 * against the 124 the runner receives). Anything computed mid-pipeline is stale
 * by the end of it.
 */

const CASE = {
  athlete_name: 'A', age: 48, race_name: 'T', primary_metric: 'distance',
  race_distance_km: 100, race_date: '2027-05-30', plan_start: '2026-11-02',
  goal: 'finish', fitness_level: 'intermediate', training_age: '2-5yr',
  resting_hr: 55, max_hr: 185, current_weekly_km: 45, longest_recent_run_km: 20,
  days_available: 3, injury_history: ['knee'],
  hard_session_relationship: 'neutral', recent_quality_training: 'occasional',
} as unknown as GeneratorInput

describe('COPY-STALE-GEN-01', () => {
  it('1. the exact case that shipped invalid now generates clean', () => {
    const plan = generateRulePlan(CASE, 'paid')
    expect(validatePlan(plan, CASE).filter(v => v.severity === 'error')).toEqual([])
  })

  it('2. no week claims a benchmark it does not contain', () => {
    const plan = generateRulePlan(CASE, 'paid')
    for (const w of plan.weeks) {
      const copy = `${w.label ?? ''} ${w.theme ?? ''}`.toLowerCase()
      if (!/benchmark|time trial/.test(copy)) continue
      expect(
        Object.values(w.sessions ?? {}).some(s => s?.type === 'hard'),
        `week ${w.n} copy promises a benchmark: "${w.label}"`,
      ).toBe(true)
    }
  })

  it('3. recalibration_weeks names only weeks that hold a benchmark (§78)', () => {
    const plan = generateRulePlan(CASE, 'paid')
    for (const n of plan.meta.recalibration_weeks ?? []) {
      const w = plan.weeks.find(x => x.n === n)
      expect(w, `recalibration_weeks names week ${n}, which does not exist`).toBeTruthy()
      expect(
        Object.values(w!.sessions ?? {}).some(s => s?.type === 'hard'),
        `week ${n} is listed as recalibration but holds no benchmark`,
      ).toBe(true)
    }
  })

  // ⚠️ The all-distance sweep that belongs with this claim lives in
  // `useCaseEnvelope.test.ts`, which already generates exactly that corpus and
  // already validates every plan. Walking it a second time here cost 3.6 s and
  // bought nothing: a duplicate check is not extra safety, it is a duplicate.
})
