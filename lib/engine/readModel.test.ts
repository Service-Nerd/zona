import { describe, it, expect } from 'vitest'
import { cohortGrid, COHORT_PLAN_START } from '@/lib/plan/cohortGrid'
import { runEngine } from '@/lib/plan/engine'
import { planRationaleNotes } from '@/lib/plan/planRationale'
import { isBaseBuildPlan } from '@/lib/plan/validateStoredPlan'
import { stagedRaceOf } from '@/lib/plan/stagedRacePlan'
import type { Plan, GeneratorInput } from '@/types/plan'
import { toV2 } from './contracts/planV1V2'
import { GeneratorInputV2Schema } from './contracts/planV2'
import {
  metaNotes, loadResidual, planStamps, generatorInput, planKind, baseBuildFacts, restingHr,
  asPlanV2, META_NOTE_FIELDS,
} from './readModel'

/**
 * ADR027-B1-CONTRACTS — the plan read model answers as today's readers do, on v1 and v2 alike.
 * Each parity arm compares an accessor with the CURRENT consumer of the same fact, so an
 * accessor that drifts from what a screen shows today fails here before B4 migrates one.
 */

const KEYS = new Set(Object.keys(GeneratorInputV2Schema.shape))
const grid = cohortGrid()
const plans: Plan[] = []
for (let i = 0; i < grid.length; i += 1013) {
  const input = Object.fromEntries(Object.entries(grid[i]).filter(([k]) => KEYS.has(k))) as unknown as GeneratorInput
  const o = runEngine({ input, tier: 'paid', displayUnits: 'km', planStart: COHORT_PLAN_START })
  if (o.kind === 'plan') plans.push(o.plan)
  const b = runEngine({ input, tier: 'paid', displayUnits: 'km', planStart: COHORT_PLAN_START, acceptBaseBuild: true })
  if (b.kind === 'base_build') plans.push(b.plan)
}

const fixture = (meta: Record<string, unknown>): Plan =>
  ({ meta: { athlete: 'A', race_name: 'R', race_date: '2026-12-06', race_distance_km: 10,
    plan_start: '2026-10-05', last_updated: 'x', ...meta }, weeks: [] }) as unknown as Plan

describe('ADR027-B1-CONTRACTS — read model', () => {
  it('the population is real: race and base-build plans', () => {
    expect(plans.length).toBeGreaterThanOrEqual(60)
    expect(plans.some(isBaseBuildPlan)).toBe(true)
    expect(plans.some(p => !isBaseBuildPlan(p))).toBe(true)
  })

  it('every accessor answers identically for a v1 plan and its v2 form', () => {
    for (const p of plans) {
      const v2 = toV2(p)
      for (const f of [metaNotes, loadResidual, planStamps, generatorInput, planKind, baseBuildFacts, restingHr]) {
        expect((f as (x: unknown) => unknown)(v2)).toEqual((f as (x: unknown) => unknown)(p))
      }
    }
  })

  it('loadResidual agrees with planRationaleNotes on whether "Heavier week" can show', () => {
    // Parity with today's reader on every plan, plus both fixture branches of its gate.
    const shown = (p: Plan) => planRationaleNotes(p.meta).some(n => n.label === 'Heavier week')
    for (const p of plans) if (shown(p)) expect(loadResidual(p)).not.toBeNull()
    const withWeek = fixture({ load_residual_note: 'Week 6 is heavier.', load_residual_week: 6 })
    const noWeek = fixture({ load_residual_note: 'Week 6 is heavier.' })
    expect(loadResidual(withWeek)).toEqual({ note: 'Week 6 is heavier.', week: 6 })
    expect(shown(withWeek)).toBe(true)
    expect(loadResidual(noWeek)).toBeNull()
    expect(shown(noWeek)).toBe(false)
  })

  it('metaNotes returns exactly the non-empty note fields', () => {
    const p = fixture({ volume_constraint_note: 'v', hard_pref_note: '', fitness_signal_note: 'f', vdot: 40 })
    expect(metaNotes(p)).toEqual({ volume_constraint_note: 'v', fitness_signal_note: 'f' })
    for (const plan of plans) {
      const notes = metaNotes(plan)
      for (const k of META_NOTE_FIELDS) {
        const raw = (plan.meta as unknown as Record<string, unknown>)[k]
        expect(notes[k]).toBe(typeof raw === 'string' && raw.length > 0 ? raw : undefined)
      }
    }
  })

  it('baseBuildFacts agrees with isBaseBuildPlan and stagedRaceOf', () => {
    for (const p of plans) {
      const f = baseBuildFacts(p)
      expect(f !== null).toBe(isBaseBuildPlan(p))
      if (f) {
        expect(f.staged_race).toEqual(stagedRaceOf(p) ?? null)
        expect(f.start_km).toBe((p.meta as unknown as Record<string, unknown>).base_build_start_km ?? null)
      }
    }
  })

  it('stamps: none on a current-engine plan, the v1 provenance fields read through', () => {
    const s = planStamps(plans[0])
    expect(s.engine).toBeNull()
    expect(s.generator_version).toBe(plans[0].meta.generator_version ?? null)
    const stamped = fixture({ engine_stamps: { engine_version: 'v', rules_version: 'r', as_of: '2026-11-21', input_hash: 'h' } })
    expect(planStamps(stamped).engine?.as_of).toBe('2026-11-21')
    expect(planStamps(asPlanV2(stamped)).engine?.as_of).toBe('2026-11-21')
  })

  it('a zero resting HR is not a resting HR; absence is null, never a default', () => {
    expect(restingHr(fixture({ resting_hr: 0 }))).toBeNull()
    expect(restingHr(fixture({ resting_hr: 52 }))).toBe(52)
    expect(restingHr(fixture({}))).toBeNull()
    expect(planKind(fixture({}))).toBeNull()
    expect(generatorInput(fixture({}))).toBeNull()
  })
})
