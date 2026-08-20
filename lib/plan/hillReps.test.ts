import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { GENERATION_CONFIG } from './generationConfig'
import { PLAN_SIGNATURES } from './planSignatures'
import type { GeneratorInput, Plan } from '@/types/plan'
import type { DerivedSet } from './resolveMainSet'

/**
 * SC-09 / CD-17a — hill repeats. The first v2 catalogue row.
 *
 * Ruled CORRECT, unanimous. The engine's stimulus ladder already had a rung
 * called "hills" (STIMULUS_RANK.hills = 3) that nothing in the catalogue could
 * occupy — adding this makes an existing rule true rather than inventing one.
 *
 * Two deviations from the audit's §E.3 spec, both from the ruling:
 *   - NO manual rep advance (McMillan: "you are asking a runner to interact
 *     with their watch at the top of every rep while breathing hard").
 *   - Parameter set is {45s, 90s}, not {45s, 90s, 3 min}. A 3-minute hill rep
 *     is a THRESHOLD stimulus on a gradient; a row carries one category, and a
 *     parameter is a dial setting rather than a different session (CD-17a
 *     addendum 2026-08-20).
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-09-07'

const TENK: GeneratorInput = {
  race_date: '2026-11-30', race_distance_km: 10, goal: 'time_target',
  target_time: '0:44:59', days_available: 4, age: 43,
  current_weekly_km: 40, longest_recent_run_km: 18,
  resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
  fitness_level: 'experienced', training_age: '2-5yr',
}

const row = () => V1_SESSION_CATALOGUE.find(r => r.id === 'hill_reps')!
const hillsIn = (p: Plan) =>
  p.weeks.flatMap(w => Object.values(w.sessions)
    .filter(s => s && /hill/i.test(s.label ?? ''))
    .map(s => s!))

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('SC-09 — the row', () => {
  it('exists and fills the empty rung in the stimulus ladder', () => {
    expect(row()).toBeTruthy()
    expect(GENERATION_CONFIG.STIMULUS_RANK.hills).toBeGreaterThan(0)
  })

  it('is ONE parameterised row, not three', () => {
    const hillRows = V1_SESSION_CATALOGUE.filter(r => /hill rep/i.test(r.name))
    expect(hillRows).toHaveLength(1)
    expect(row().parameterisation!.variants.length).toBeGreaterThan(1)
  })

  it('every variant shares the row category — a parameter is a dial setting', () => {
    // The test for whether something is a variant at all. A 3-minute hill rep
    // is threshold work and would fail this, which is why it is deferred.
    expect(row().category).toBe('vo2max')
    expect(row().parameterisation!.variants.map(v => v.label_suffix)).toEqual(['45s', '90s'])
  })

  it('declares only distances that can actually SELECT a vo2max row', () => {
    // Guards the SC-05 dead-weight defect: eligibility declared but unreachable.
    for (const d of row().distance_eligibility) {
      const focus = PLAN_SIGNATURES[d as '5K'].quality_categories_focus as readonly string[]
      const reachable = focus.includes('vo2max')
      expect(reachable, `${d} declares hill_reps eligible but can never select a vo2max row`).toBe(true)
    }
  })

  it('carries no literal pace — the gradient decides it', () => {
    expect(JSON.stringify(row().main_set_structure)).not.toMatch(/\d+\s*:\s*\d{2}/)
  })
})

describe('SC-09 — what the runner receives', () => {
  it('a 10K plan gets hill reps, labelled with the variant', () => {
    const hills = hillsIn(generateRulePlan(TENK, 'paid', PLAN_START))
    expect(hills.length).toBeGreaterThan(0)
    expect(hills[0].label).toMatch(/^Hill reps — (45s|90s)$/)
  })

  it('carries NO pace target, and an effort target instead', () => {
    // The heart of the ruling. hill_reps is categorised vo2max, so without the
    // effort-governed branch it would inherit interval pace — a number the
    // runner cannot act on, which §19 would then "verify" against the label.
    // The absence of a pace IS the prescription (§41).
    const s = hillsIn(generateRulePlan(TENK, 'paid', PLAN_START))[0]
    expect(s.pace_target, 'a hill rep has no pace — the gradient sets it').toBeUndefined()
    expect(s.rpe_target).toBe(8)
    expect(s.zone).toBe('Zone 4–5')
  })

  it('the derived set carries the full rep: climb, rest, prescribed descent', () => {
    const s = hillsIn(generateRulePlan(TENK, 'paid', PLAN_START))[0]
    const ds = s.derived_set as DerivedSet
    expect(ds).toBeTruthy()

    // Block 1: get to the hill, capped at easy.
    expect(ds.blocks[0].steps[0].role).toBe('transition')
    expect(ds.blocks[0].steps[0].length).toBe('to the bottom of the hill')

    const rep = ds.blocks[1].steps
    expect(ds.blocks[1].repeat).toBeGreaterThan(1)
    expect(rep[0].terrain).toBe('uphill')
    expect(rep[0].pace, 'effort-governed: no pace on the climb').toBeNull()
    expect(rep[0].rpe).toBe(8)
    expect(rep[1].modality, 'standing rest').toBe('stand')
    expect(rep[2].terrain, 'the descent is prescribed, not left to the runner').toBe('downhill')
    expect(rep[2].pace_mode, 'capped at easy — the descent is where the damage happens').toBe('ceiling')
  })

  it('NO manual rep advance — CD-17a struck it', () => {
    const s = hillsIn(generateRulePlan(TENK, 'paid', PLAN_START))[0]
    const ds = s.derived_set as DerivedSet
    for (const b of ds.blocks) for (const st of b.steps) expect(st.advance).toBe('auto')
  })

  it('rep count varies with rep length, and both are coherent sessions', () => {
    // 8 x 45s is a warm-up; 10 x 90s is a race. Rep count is a parameter too.
    const v = row().parameterisation!.variants
    const short = v.find(x => x.label_suffix === '45s')!
    const long = v.find(x => x.label_suffix === '90s')!
    expect(short.values.reps).toBeGreaterThan(long.values.reps)
    expect(short.values.rep_secs).toBeLessThan(long.values.rep_secs)
  })
})

describe('SC-09 — injury exclusion (§21, Willy\'s condition)', () => {
  it('a runner with knee history gets no hill reps', () => {
    const injured = { ...TENK, injury_history: ['Left knee, posterior, recurring'] }
    const plan = generateRulePlan(injured, 'paid', PLAN_START)
    expect(hillsIn(plan)).toHaveLength(0)
    expect(validatePlan(plan, injured).filter(v => v.code === 'INV-PLAN-INJURY-NO-HILLS')).toEqual([])
  })

  it('every restricting injury excludes them, not just knees', () => {
    for (const k of GENERATION_CONFIG.HILL_RESTRICTING_INJURIES) {
      const injured = { ...TENK, injury_history: [`Recurring ${k} problem`] }
      expect(hillsIn(generateRulePlan(injured, 'paid', PLAN_START)),
        `"${k}" must exclude hill reps`).toHaveLength(0)
    }
  })
})
