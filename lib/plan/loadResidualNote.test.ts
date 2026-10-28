import { describe, it, expect } from 'vitest'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { planRationaleNotes } from './planRationale'
import { RAMP_RESIDUAL_CODES, reconcileLoadResidualNote } from './loadResidualNote'
import type { Violation } from './invariants'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isDesignedRefusal } from './designedRefusal'
import type { GeneratorInput, Plan } from '@/types/plan'

// INJURY-PEAK-JUMP-01 (Coaching Board 2026-10-28): a plan the ramp checks WARN must tell the runner,
// and a plan they do not warn must not carry the warning. Before this, the note was suppressed by the
// maintenance note on 38-75% of warned plans and rendered by nothing on the rest: 0 runners told.

const RAMP = new Set(RAMP_RESIDUAL_CODES)
const grid = cohortGrid() as GeneratorInput[]
const rows: { warned: boolean; stamped: boolean; shown: boolean; namesFlaggedWeek: boolean }[] = []
for (let i = 0; i < grid.length; i += 97) {
  for (const injury_history of [[], ['achilles'], ['knee']]) {
    const input = { ...grid[i]!, injury_history } as GeneratorInput
    let p: Plan
    // Only a DESIGNED refusal is skipped: anything else is a failure of this test's population.
    try { p = generateRulePlan(input, 'paid', COHORT_PLAN_START) as Plan } catch (e) { if (isDesignedRefusal(e)) continue; throw e }
    const warned = validatePlan(p, input).some(v => RAMP.has(v.code))
    const note = p.meta.load_residual_note
    rows.push({ warned, stamped: !!note, shown: planRationaleNotes(p.meta).some(n => n.text === note),
      namesFlaggedWeek: !note || validatePlan(p, input).some(v => RAMP.has(v.code) && v.week === p.meta.load_residual_week && note.includes(`eek ${v.week}`)) })
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

  it('the note names a week the check flagged (it used to come from its own predicate)', () => {
    expect(rows.filter(r => !r.namesFlaggedWeek).length).toBe(0)
  })

  it('a stored note written before the verdict rule (no load_residual_week) is not shown', () => {
    const old = { load_residual_note: 'We hold weekly volume to about 10% growth, and week 4 rises about 14%.' } as unknown as Plan['meta']
    expect(planRationaleNotes(old).some(n => n.label === 'Heavier week')).toBe(false)
  })

  // ADR-020: composing foundation weeks re-validates the plan the runner receives, and the note must
  // follow THAT verdict. ⚠️ Measured: on the composed plans this grid produces, the verdict never
  // differs before and after composing, so an end-to-end arm passed with the reconciliation removed.
  // So the two halves are tested directly: the function obeys the verdict it is given, and the compose
  // step calls it on its own verdict.
  it('reconcileLoadResidualNote follows the verdict it is given: writes, rewrites and clears', () => {
    const plan = { meta: { load_residual_note: 'stale', load_residual_week: 3 }, weeks: [] } as unknown as Plan
    reconcileLoadResidualNote(plan, [], { race_distance_km: 42.2 })
    expect(plan.meta.load_residual_note).toBeUndefined()
    expect(plan.meta.load_residual_week).toBeUndefined()
    const v = { code: 'INV-PLAN-DELIVERED-RAMP', week: 7, severity: 'warn', principle_ref: '', message: '', actual: '', expected: '',
      ramp: { rise_pct: 23.4, cap_pct: 10, scope: 'week' } } as Violation
    reconcileLoadResidualNote(plan, [v], { race_distance_km: 42.2 })
    expect(plan.meta.load_residual_week).toBe(7)
    expect(plan.meta.load_residual_note).toMatch(/^Week 7 rises about 23%, above the 10% weekly growth/)
  })

  it('composePlanWithFoundation reconciles the note from its own validation of the assembled plan', () => {
    const src = readFileSync(join(__dirname, 'foundationCompose.ts'), 'utf8')
    const at = src.indexOf('const violations = validatePlan(assembled, input)')
    expect(at).toBeGreaterThan(0)
    const ret = src.indexOf('return { plan: assembled', at)
    const call = src.indexOf('reconcileLoadResidualNote(assembled, violations, input)', at)
    expect(call, 'called after the compose validation').toBeGreaterThan(at)
    expect(call, 'and before the composed plan is returned').toBeLessThan(ret)
  })
})

