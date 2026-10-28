import { describe, it, expect } from 'vitest'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { planRationaleNotes } from './planRationale'
import type { GeneratorInput, Plan } from '@/types/plan'

// INJURY-PEAK-JUMP-01 (Coaching Board 2026-10-28): a plan the ramp checks WARN must tell the runner,
// and a plan they do not warn must not carry the warning. Before this, the note was suppressed by the
// maintenance note on 38-75% of warned plans and rendered by nothing on the rest: 0 runners told.

const RAMP = new Set(['INV-PLAN-DELIVERED-RAMP', 'INV-PLAN-INJURY-CAP-DELIVERED'])
const grid = cohortGrid() as GeneratorInput[]
const rows: { warned: boolean; stamped: boolean; shown: boolean }[] = []
for (let i = 0; i < grid.length; i += 97) {
  for (const injury_history of [[], ['achilles'], ['knee']]) {
    const input = { ...grid[i]!, injury_history } as GeneratorInput
    let p: Plan
    try { p = generateRulePlan(input, 'paid', COHORT_PLAN_START) as Plan } catch { continue }
    const warned = validatePlan(p, input).some(v => RAMP.has(v.code))
    const note = p.meta.load_residual_note
    rows.push({ warned, stamped: !!note, shown: planRationaleNotes(p.meta).some(n => n.text === note) })
  }
}

describe('INJURY-PEAK-JUMP-01 — the ramp warning reaches the runner', () => {
  it('population: both warned and unwarned plans are generated', () => {
    expect(rows.filter(r => r.warned).length, 'warned plans').toBeGreaterThan(50)
    expect(rows.filter(r => !r.warned).length, 'unwarned plans').toBeGreaterThan(50)
  })

  it('every warned plan carries the note, and the plan screen shows it', () => {
    const silent = rows.filter(r => r.warned && !(r.stamped && r.shown)).length
    expect(silent).toBe(0)
  })

  it('no unwarned plan carries it (the note had over-declared on 78% of plans)', () => {
    expect(rows.filter(r => !r.warned && r.stamped).length).toBe(0)
  })
})
