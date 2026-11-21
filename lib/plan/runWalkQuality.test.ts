// §117 Am. 9 (Coaching Board 2026-11-20, RUNWALK-QUALITY-HOTFIX-01; ADR-027 hotfix 1).
// A run-walk plan's QUALITY sessions carry no interval (their reps are the instruction); its 5K time trial keeps the
// interval as ONE instruction: a walk warm-up, no strides, best effort. Population: cohortGrid's run-walk-prescribed
// plans in the shape the wizard posts (no fitness_level), where the board measured 432 plans with stamped quality.
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { cohortGrid, COHORT_PLAN_START, isDesignedRefusal } from './cohortGrid'
import { isQualitySession, isTimeTrial } from './sessionRole'
import { composeSession } from './sessionComposer'
import { applyRunWalk, runWalkTimeTrialNote } from './runWalkPlan'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG as G } from './generationConfig'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

const STRIDE = 7 // coprime with the grid size, asserted below
function runWalkPlans(): { input: GeneratorInput; plan: Plan }[] {
  const grid = cohortGrid()
  expect(grid.length % STRIDE).not.toBe(0)
  const out: { input: GeneratorInput; plan: Plan }[] = []
  for (let i = 0; i < grid.length; i += STRIDE) {
    const { fitness_level: _f, ...input } = grid[i] as GeneratorInput & { fitness_level?: unknown }
    try {
      const plan = generateRulePlan(input as GeneratorInput, 'paid', COHORT_PLAN_START)
      if ((plan.meta as unknown as Record<string, unknown>).run_walk_prescribed) out.push({ input: input as GeneratorInput, plan })
    } catch (e) { if (!isDesignedRefusal(e)) throw e }
  }
  return out
}
const sessions = (p: Plan) => p.weeks.flatMap(w => Object.values(w.sessions).filter(Boolean) as Session[])

describe('§117 Am. 9: run-walk is not stamped on quality; the TT is one run-walk instruction', () => {
  const plans = runWalkPlans()
  it('the population is not empty, and some of it has quality', () => {
    expect(plans.length).toBeGreaterThan(0)
    expect(plans.some(({ plan }) => sessions(plan).some(isQualitySession))).toBe(true)
  })
  it('🔴 no quality session carries run_walk_strategy; every other running session does', () => {
    for (const { plan } of plans) for (const s of sessions(plan)) {
      if (s.type === 'rest' || s.type === 'cross-train' || s.type === 'strength') continue
      if (isQualitySession(s)) expect(s.run_walk_strategy, s.label).toBeFalsy()
      else expect(s.run_walk_strategy, s.label).toBeTruthy()
    }
  })
  it('the plans validate with no INV-PLAN-RUNWALK-PRESCRIBED error', () => {
    for (const { input, plan } of plans) {
      expect(validatePlan(plan, input).filter(v => v.code === 'INV-PLAN-RUNWALK-PRESCRIBED')).toEqual([])
    }
  })
})

describe('§117 Am. 9 time trial', () => {
  const tt = { type: 'hard', label: '5K time trial', distance_km: 5, duration_mins: 35, zone: 'Zone 4–5',
    coach_notes: ['Warm up easy for 10 minutes, then 5 km as hard as you can hold. Cool down easy.', 'This is a measurement, not a session.'],
    recalibration: true } as unknown as Session
  it('is stamped, its first note is the run-walk instruction, its second note is untouched', () => {
    if (!isTimeTrial(tt)) return expect.fail('fixture is not a time trial by isTimeTrial')
    const s = applyRunWalk(tt)
    expect(s.run_walk_strategy).toBeTruthy()
    expect((s.coach_notes as unknown as string[])[0]).toBe(runWalkTimeTrialNote(5))
    expect((s.coach_notes as unknown as string[])[1]).toBe('This is a measurement, not a session.')
  })
  it('composes with a walk warm-up and no strides; a continuous TT keeps both', () => {
    const rw = composeSession({ session: applyRunWalk(tt) })!
    expect(rw.warmup.walk).toBe(true)
    expect(rw.warmup.duration_mins).toBe(G.RUNWALK_WARMUP_WALK_MINS)
    expect(rw.strides).toBeUndefined()
    const plain = composeSession({ session: tt })!
    expect(plain.strides).toBeDefined()
    expect(plain.warmup.walk).toBeFalsy()
  })
  it('a quality session passes through applyRunWalk unchanged', () => {
    const q = { type: 'quality', label: 'Tempo', duration_mins: 40 } as unknown as Session
    expect(applyRunWalk(q)).toBe(q)
  })
})
