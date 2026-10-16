import { describe, it, expect } from 'vitest'
import { cohortGrid, targetedGrid, COHORT_PLAN_START } from '@/lib/plan/cohortGrid'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { isDesignedRefusal } from '@/lib/plan/designedRefusal'
import { planToRunContext } from './runContext'
import { strengthProfileGrid } from './profileGrid'
import { generateStrengthPlan, validateStrengthPlan } from '@/packages/strength'

/**
 * STRENGTH-ENGINE-01 Phase 1 exit: strength placed around REAL generated run plans
 * validates clean. A sampled gate; the full sweep is `npm run verify:strength`.
 * Profiles are strided too, coprime with the plan stride, so every profile shape
 * meets several run-plan shapes.
 */
describe('strength sweep (sampled)', () => {
  it('zero violations', () => {
    const inputs = [...cohortGrid().filter((_, i) => i % 6007 === 0), ...targetedGrid().filter((_, i) => i % 997 === 0)]
    const profiles = strengthProfileGrid()
    let checked = 0
    const bad: string[] = []
    inputs.forEach((input, k) => {
      let plan
      try { plan = generateRulePlan(input, 'paid', COHORT_PLAN_START) } catch (e) { if (isDesignedRefusal(e)) return; throw e }
      const ctx = planToRunContext(plan)
      for (let j = k % 11; j < profiles.length; j += 11) {
        const v = validateStrengthPlan(generateStrengthPlan(profiles[j], ctx), ctx)
        checked++
        if (v.length) bad.push(`${v[0].code} ${v[0].detail}`)
      }
    })
    expect(checked).toBeGreaterThan(100)
    expect(bad.slice(0, 5)).toEqual([])
  })
})
