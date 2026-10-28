// §19 Amendment 2 (Coaching Board 2026-10-28, S9-ONE-REP-01) — a "repeats" session must repeat.
// Since S9-QUALITY-MINUTES-01's 35-minute floor, a runner whose threshold is slower than ~9:22 /km was sized ONE
// 1600 m rep ("Rep three should look like rep one."): 18 slow-grid sessions, 0 cohort. The row now declares a
// same-stimulus sibling (`tempo_cruise`, §19 Am.) delivered in that slot, and INV-PLAN-REPEATS-REPEAT reads the
// delivered set for every rep-scaled row.
import { describe, it, expect } from 'vitest'
import { runEngine } from './engine'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { V1_SESSION_CATALOGUE, requiredPaceAnchors, rowFitsLevel } from './sessionCatalogueData'
import { GENERATION_CONFIG } from './generationConfig'
import { slowGoalDates, slowGoalGrid } from './slowGoalGrid'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

const repScaled = (id: string) => {
  const row = V1_SESSION_CATALOGUE.find(r => r.id === id)!
  return (row.main_set_structure as { sizing?: { scaling?: string } }).sizing?.scaling === 'reps'
}

describe('the sibling declarations are sound', () => {
  const declaring = V1_SESSION_CATALOGUE.filter(r => r.one_rep_sibling)
  it('one row declares one, as ruled (threshold_mile_repeats → tempo_cruise)', () => {
    expect(declaring.map(r => [r.id, r.one_rep_sibling])).toEqual([['threshold_mile_repeats', 'tempo_cruise']])
  })
  it('every sibling exists, shares the category, is rep-scaled, and names no sibling of its own (cannot loop)', () => {
    for (const r of declaring) {
      const sib = V1_SESSION_CATALOGUE.find(x => x.id === r.one_rep_sibling)
      expect(sib, `${r.id} → ${r.one_rep_sibling} missing`).toBeTruthy()
      expect(sib!.category).toBe(r.category)
      expect(repScaled(sib!.id)).toBe(true)
      expect(sib!.one_rep_sibling).toBeUndefined()
    }
  })
})

describe('the sibling is at least as eligible as its row on every axis but phase (second sitting, 2026-10-28)', () => {
  // The swap bypasses the selector, so every filter the selector would apply to the sibling must already be satisfied
  // wherever the row is. Phase is the deliberate exception: the stand-in answers to the selected row's phase.
  const declaring = V1_SESSION_CATALOGUE.filter(r => r.one_rep_sibling)
  for (const r of declaring) {
    const sib = V1_SESSION_CATALOGUE.find(x => x.id === r.one_rep_sibling)!
    it(`${r.id} → ${sib.id}`, () => {
      if (r.is_free_tier) expect(sib.is_free_tier).toBe(true)
      for (const a of requiredPaceAnchors(sib)) expect(requiredPaceAnchors(r)).toContain(a)
      for (const d of r.distance_eligibility) expect(sib.distance_eligibility).toContain(d)
      for (const lvl of ['beginner', 'intermediate', 'experienced'] as const) {
        if (rowFitsLevel(r, lvl)) expect(rowFitsLevel(sib, lvl), lvl).toBe(true)
      }
      if (sib.min_weekly_km != null) expect(sib.min_weekly_km).toBeLessThanOrEqual(r.min_weekly_km ?? 0)
      expect(sib.category).not.toBe('vo2max')
      expect(JSON.stringify(sib.main_set_structure)).not.toMatch(/"terrain"/)
      expect(sib.goal_week_only).toBeUndefined()
    })
  }
})

describe('slow-goal grid: no repeats session with one rep', () => {
  const { planStart, benchmarkDate } = slowGoalDates()
  const today = new Date(Date.parse(`${planStart}T00:00:00Z`) - 7 * 864e5).toISOString().slice(0, 10)
  const plans: { plan: Plan; input: GeneratorInput }[] = []
  for (const c of slowGoalGrid(planStart, benchmarkDate)) {
    const { gap, ...input } = c
    const o = runEngine({ input: input as unknown as GeneratorInput, tier: 'paid', displayUnits: 'km', planStart, today })
    if (o.kind !== 'refusal') plans.push({ plan: o.plan as Plan, input: input as unknown as GeneratorInput })
  }

  it('🔴 INV-PLAN-REPEATS-REPEAT is silent on every served plan', () => {
    const hits = plans.flatMap(p => validatePlan(p.plan, p.input).filter(v => v.code === 'INV-PLAN-REPEATS-REPEAT'))
    expect(hits).toEqual([])
  })
  it('the slowest runners get Cruise intervals in that slot, at two reps', () => {
    // HM, intermediate, a 7:30 marathon benchmark: the 18 measured sessions (week 11 Wednesday, peak).
    const slow = plans.filter(p => p.input.race_distance_km === 21.1
      && (p.input as { benchmark?: { time?: string } }).benchmark?.time === '7:30:00' && p.input.fitness_level === 'intermediate')
    const sessions = slow.map(p => p.plan.weeks.find(w => w.n === 11)?.sessions.wed).filter(Boolean) as Session[]
    const cruise = sessions.filter(s => s.catalogue_id === 'tempo_cruise')
    expect(cruise.length).toBe(18)
    for (const s of cruise) expect(s.derived_set?.blocks?.find(b => b.label === 'reps')?.repeat).toBeGreaterThanOrEqual(GENERATION_CONFIG.REP_ROW_MIN_REPS)
  })
})

describe('INV-PLAN-REPEATS-REPEAT can fail', () => {
  const g = cohortGrid() as GeneratorInput[]
  const found = (() => {
    for (let k = 0; k < g.length; k += 97) {
      const plan = generateRulePlan(g[k], 'paid', COHORT_PLAN_START) as Plan
      for (const w of plan.weeks) for (const [day, s] of Object.entries(w.sessions)) {
        if ((s as Session | undefined)?.catalogue_id === 'threshold_mile_repeats') return { plan, input: g[k], week: w.n, day }
      }
    }
    return null
  })()
  it('a cohort plan carrying 1600m repeats exists to mutate', () => expect(found).toBeTruthy())
  it('🔴 fires when the delivered rep block is cut to one rep', () => {
    const plan = structuredClone(found!.plan)
    const s = plan.weeks.find(w => w.n === found!.week)!.sessions[found!.day as keyof typeof plan.weeks[number]['sessions']] as Session
    expect(validatePlan(plan, found!.input).some(v => v.code === 'INV-PLAN-REPEATS-REPEAT')).toBe(false)
    s.derived_set!.blocks!.find(b => b.label === 'reps')!.repeat = 1
    const hit = validatePlan(plan, found!.input).filter(v => v.code === 'INV-PLAN-REPEATS-REPEAT')
    expect(hit.map(v => [v.week, v.day])).toEqual([[found!.week, found!.day]])
  })
})
