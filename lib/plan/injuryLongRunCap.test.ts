import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { longRunTimeCapMins, longRunTimeCap } from './longRunTimeCap'
import { GENERATION_CONFIG } from './generationConfig'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { isDesignedRefusal } from './designedRefusal'
import type { GeneratorInput, Plan } from '@/types/plan'

// LONG-RUN-BELOW-LONGEST-01 (Coaching Board 2026-10-28, §9 Amendment 3). A back or plantar fasciitis
// history caps the long run at 120 minutes. It was a literal in one of the two callers of the time-cap
// owner, so the other (the V4 long-run repeat path) let 1,562 of 4,500 back plans run past it.

describe('§9 Am. 3 — the injury long-run ceiling has one owner', () => {
  it('the owner applies it, the tighter cap wins, and history matching tolerates spelling', () => {
    expect(longRunTimeCapMins({ race_distance_km: 42.2, goal: 'time_target' })).toBe(210)
    expect(longRunTimeCapMins({ race_distance_km: 42.2, goal: 'time_target', injury_history: ['back'] })).toBe(120)
    expect(longRunTimeCapMins({ race_distance_km: 42.2, goal: 'finish', injury_history: ['Plantar fasciitis'] })).toBe(120)
    expect(longRunTimeCapMins({ race_distance_km: 42.2, goal: 'finish', injury_history: ['knee'] })).toBe(210)
    expect(longRunTimeCapMins({ race_distance_km: 5, goal: 'finish', injury_history: ['back'] })).toBe(GENERATION_CONFIG.LONG_RUN_CAP_MINUTES_5K_FINISH)
    expect(longRunTimeCap({ race_distance_km: 42.2, goal: 'finish', injury_history: ['shin splints'] }).source).toBe('distance')
    expect(longRunTimeCap({ race_distance_km: 42.2, goal: 'finish', injury_history: ['back'] })).toEqual({ mins: 120, source: 'injury', injury: 'back' })
    // A 5K's own ceiling (70 finish / 90) is tighter than the injury's, so the DISTANCE binds and is named.
    expect(longRunTimeCap({ race_distance_km: 5, goal: 'time_target', injury_history: ['back'] }).source).toBe('distance')
  })

})

const grid = (cohortGrid() as GeneratorInput[]).filter(i => i.race_distance_km === 42.2)
const plans: { input: GeneratorInput; plan: Plan }[] = []
for (let i = 0; i < grid.length && plans.length < 120; i += 37) {
  const input = { ...grid[i]!, injury_history: ['back'] } as GeneratorInput
  try { plans.push({ input, plan: generateRulePlan(input, 'paid', COHORT_PLAN_START) as Plan }) }
  catch (e) { if (!isDesignedRefusal(e)) throw e }
}
const longMins = (p: Plan) => Math.max(...p.weeks.filter(w => w.n > 0)
  .flatMap(w => Object.values(w.sessions).filter(s => s && s.type !== 'race').map(s => s!.duration_mins ?? 0)))

describe('§9 Am. 3 — back-history marathon plans', () => {
  it('population', () => expect(plans.length).toBeGreaterThan(60))

  it('no long run exceeds the injury ceiling (the V4 repeat path used to)', () => {
    const over = plans.filter(({ plan }) => longMins(plan) > 120 + 0.5)
    expect(over.length).toBe(0)
  })

  it('INV-PLAN-LONG-CAP-MINS reads the injury ceiling itself: a 125-minute long run fails for back, passes healthy', () => {
    const { input, plan } = plans.find(({ plan }) => plan.weeks.some(w => w.n > 0 && Object.values(w.sessions).some(s => s?.duration_mins)))!
    const p = JSON.parse(JSON.stringify(plan)) as Plan
    const w = p.weeks.find(x => x.n > 0 && Object.values(x.sessions).some(s => s?.duration_mins && /long/i.test(s.label ?? '')))!
    const s = Object.values(w.sessions).find(x => x?.duration_mins && /long/i.test(x.label ?? ''))!
    s.duration_mins = 125
    const codes = (inp: GeneratorInput) => validatePlan(p, inp).filter(v => v.code === 'INV-PLAN-LONG-CAP-MINS').length
    expect(codes(input)).toBeGreaterThan(0)
    expect(codes({ ...input, injury_history: [] })).toBe(0)
  })

  it('when the ceiling holds the long run, the note names it instead of "ran out of weeks"', () => {
    const named = plans.filter(({ plan }) => /back injury history keeps the long run to 2h/.test(plan.meta.volume_constraint_note ?? ''))
    const wrong = plans.filter(({ plan }) => /back injury history/.test(plan.meta.volume_constraint_note ?? '') && /ran out of weeks/.test(plan.meta.volume_constraint_note ?? ''))
    expect(named.length, 'plans whose note names the cap').toBeGreaterThan(0)
    expect(wrong.length).toBe(0)
  })

  // Code review 2026-10-28: the §80 finish-goal note read the distance table directly, so a
  // back-capped finisher was told "your weekly volume is what limits it".
  it('a finish-goal runner held by the injury ceiling is told the ceiling, never "weekly volume"', () => {
    const finish: Plan[] = []
    for (let i = 0; i < grid.length && finish.length < 80; i += 29) {
      const input = { ...grid[i]!, goal: 'finish', injury_history: ['back'] } as GeneratorInput
      try { finish.push(generateRulePlan(input, 'paid', COHORT_PLAN_START) as Plan) } catch (e) { if (!isDesignedRefusal(e)) throw e }
    }
    const notes = finish.map(p => p.meta.long_run_shortfall_note).filter((n): n is string => !!n)
    expect(notes.length, 'finish-goal plans with a long-run note').toBeGreaterThan(5)
    expect(notes.filter(n => /back injury history keeps the long run to 2h/.test(n)).length).toBeGreaterThan(0)
    expect(notes.filter(n => n.includes('your weekly volume is what limits it')).length).toBe(0)
  })
})

