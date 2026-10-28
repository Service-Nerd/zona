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
import { slowGoalDates, slowGoalGrid, SLOW_BENCHMARKS, GOAL_GAPS, targetForGap } from './slowGoalGrid'
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

// MP-BLOCKS-ONE-BLOCK-01 + TENK-SIM-ONE-REP-01 (Coaching Board 2026-10-28, third sitting).
describe('the marathon-pace run is a fixed shape, out of the repeats rule by construction', () => {
  it('mp_blocks: fixed, one block run once, one goal-paced 4 km work step, no recovery', () => {
    const m = V1_SESSION_CATALOGUE.find(r => r.id === 'mp_blocks')!.main_set_structure as {
      sizing: { scaling: string }; blocks: { repeat: unknown; steps: { role: string; length: { kind: string; m?: number } }[] }[] }
    expect(m.sizing.scaling).toBe('fixed')
    expect(m.blocks.length).toBe(1)
    expect(m.blocks[0].repeat).toBe(1)
    expect(m.blocks[0].steps.map(st => [st.role, st.length.kind, st.length.m])).toEqual([['work', 'distance', 4000]])
  })
})

describe('marathon and 10K race-specific rows, as delivered', () => {
  const g = cohortGrid() as GeneratorInput[]
  const sessions = (rowId: string, inputs: GeneratorInput[]) => {
    const out: { s: Session; input: GeneratorInput }[] = []
    for (const input of inputs) {
      let plan: Plan
      try { plan = generateRulePlan(input, 'paid', COHORT_PLAN_START) as Plan } catch { continue }
      for (const w of plan.weeks) for (const s of Object.values(w.sessions) as (Session | undefined)[]) {
        if (s?.catalogue_id === rowId) out.push({ s, input })
      }
    }
    return out
  }
  const marathon = g.filter(i => i.race_distance_km === 42.2).filter((_, k) => k % 53 === 0)
  const tenK = g.filter(i => i.race_distance_km === 10).filter((_, k) => k % 41 === 0)
  // Slow 10K runners, as the property sweep builds its @slow-goal clones: cohort 10K inputs with a slow benchmark and a
  // goal gap. NOT the slow-goal grid, which never draws this row (rca1026Gates 2a): that version of this test stayed
  // green with the floor removed. This one reaches it: 8 one-rep sessions without the floor, measured.
  const tenKAll = g.filter(i => i.race_distance_km === 10)
  const slowTenK = Array.from({ length: 400 }, (_, j) => {
    const b = SLOW_BENCHMARKS[j % SLOW_BENCHMARKS.length]
    const gap = GOAL_GAPS[Math.floor(j / SLOW_BENCHMARKS.length) % GOAL_GAPS.length]
    return { ...tenKAll[(j * 7919) % tenKAll.length], benchmark: { ...b }, goal: 'time_target', target_time: targetForGap(b, 10, gap) } as GeneratorInput
  })

  it('"Marathon-pace run": one continuous 4 km at marathon pace, no jog after it', () => {
    const found = sessions('mp_blocks', marathon)
    expect(found.length).toBeGreaterThan(0)
    for (const { s } of found) {
      expect(s.label).toBe('Marathon-pace run')
      const blocks = s.derived_set!.blocks!
      expect(blocks.length).toBe(1)
      expect(blocks[0].repeat).toBe(1)
      expect(blocks[0].steps!.map(st => st.role)).toEqual(['work'])
      // Priced from its own length by fixedShapePlan, not the generic share (which gave 54–100 min in a prototype).
      expect(s.duration_mins).toBeGreaterThanOrEqual(35)
      expect(s.duration_mins).toBeLessThanOrEqual(50)
    }
  })
  it('🔴 the 10K race simulation repeats for every runner, inside 60% of the race', () => {
    const slowFound = sessions('tenk_race_simulation', slowTenK)
    expect(slowFound.length, 'the slow population must reach the row, or this proves nothing').toBeGreaterThanOrEqual(8)
    const found = [...sessions('tenk_race_simulation', tenK), ...slowFound]
    for (const { s } of found) {
      const reps = s.derived_set!.blocks!.find(b => b.label === 'reps')!.repeat!
      expect(reps).toBeGreaterThanOrEqual(GENERATION_CONFIG.REP_ROW_MIN_REPS)
      expect(reps * 2).toBeLessThanOrEqual(GENERATION_CONFIG.RACE_SPECIFIC_MAX_RACE_SHARE * 10)
    }
  })
  it('🔴 INV-PLAN-RACE-SPECIFIC-RACE-SHARE fires on a floor-sized session past 60% of the race, and not on a band-sized one', () => {
    const input = tenK.find(i => sessions('tenk_race_simulation', [i]).length > 0)!
    const plan = structuredClone(generateRulePlan(input, 'paid', COHORT_PLAN_START) as Plan)
    expect(validatePlan(plan, input).some(v => v.code === 'INV-PLAN-RACE-SPECIFIC-RACE-SHARE')).toBe(false)
    const s = plan.weeks.flatMap(w => Object.values(w.sessions) as (Session | undefined)[]).find(x => x?.catalogue_id === 'tenk_race_simulation')!
    const rep = s.derived_set!.blocks!.find(b => b.label === 'reps')!
    rep.repeat = 4   // band-sized 4 x 2 km: the dose band's, not the floor's; out of scope by ruling
    expect(validatePlan(plan, input).some(v => v.code === 'INV-PLAN-RACE-SPECIFIC-RACE-SHARE')).toBe(false)
    // At the floor, with a rep long enough that two of them pass 60% of the race: the case the cap exists for.
    const row = V1_SESSION_CATALOGUE.find(r => r.id === 'tenk_race_simulation')!
    const step = (row.main_set_structure as { blocks: { steps: { role: string; length: { m: number } }[] }[] }).blocks[0].steps[0]
    const m = step.length.m
    try {
      step.length.m = 3500
      rep.repeat = 2   // 7 km of a 10 km race
      expect(validatePlan(plan, input).filter(v => v.code === 'INV-PLAN-RACE-SPECIFIC-RACE-SHARE').length).toBe(1)
    } finally { step.length.m = m }
  })
})
