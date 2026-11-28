// §49 Amendment 1 (BLOCK-TAPER-SQUEEZE-01, Coaching Board 2026-11-28) — `INV-PLAN-TAPER-WEEKS-FLOOR`.
//
// 🔴 WHY THIS FILE EXISTS, AND IT IS A HOLE A MUTATION FOUND RATHER THAN A HABIT.
// `invariant:liveness` wakes this rule (169 of 172 woken, and it is not among the three unproven),
// so the standing harness says it is alive. But a mutation that made the check count race week too
// — the single mistake the amendment's own comment warns against — left **every suite green**.
// Liveness proves a rule CAN fire; it does not prove it fires on the shape it was written for.
//
// 📐 The shape: a 6-week 5K whose taper phase is RACE WEEK ALONE. It passes
// `INV-PLAN-TAPER-DURATION-CAP` (1 taper-phase week against a cap of 2) and it was what a real
// runner got — one live plan of 44, generated 2026-11-27: `[17, 13, 19, 21, 5]`.
import { describe, it, expect } from 'vitest'
import { validatePlan } from './invariants'
import { verifyPlan } from '@/lib/engine/verifier/verifyPlan'
import { buildRunnerProfile, factsFromInput } from '@/lib/engine/profile/buildRunnerProfile'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan, Week } from '@/types/plan'

const INPUT: GeneratorInput = {
  race_distance_km: 5,
  race_date: '2027-01-17',
  goal: 'finish',
  current_weekly_km: 20,
  longest_recent_run_km: 6,
  days_available: 4,
  training_age: '6-18mo',
  recent_quality_training: 'occasional',
  injury_history: [],
} as GeneratorInput

/** A minimal plan with the phase labels under test. Volumes and sessions are not what this rule
 *  reads — it reads the phase of each week and which week is last — so they are kept trivial
 *  rather than invented, and no other invariant's verdict is asserted here. */
function planWithPhases(phases: Week['phase'][]): Plan {
  const weeks = phases.map((phase, i) => ({
    n: i + 1,
    date: '2027-01-04',
    label: `W${i + 1}`,
    theme: '',
    type: i === phases.length - 1 ? 'race' : 'normal',
    phase,
    weekly_km: 10,
    long_run_hrs: null,
    sessions: {},
  })) as unknown as Week[]
  return { meta: {}, phases: [], weeks } as unknown as Plan
}

const PROFILE = buildRunnerProfile(factsFromInput(INPUT), { asOf: '2026-12-01', timezone: null })
const fired = (p: Plan) => validatePlan(p, INPUT).filter(v => v.code === 'INV-PLAN-TAPER-WEEKS-FLOOR')

describe('§49 Am. 1 — INV-PLAN-TAPER-WEEKS-FLOOR', () => {
  it('the authored floor for 5K is 1 actual taper week, read from config not typed', () => {
    expect(GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK['5K'].length - 1).toBe(1)
  })

  it('🔴 FIRES when the taper phase is RACE WEEK ALONE — the 6-week 5K the amendment was ruled for', () => {
    // The exact shape. A mutation that counted race week in the floor left this silent.
    const v = fired(planWithPhases(['base', 'base', 'build', 'build', 'peak', 'taper']))
    expect(v).toHaveLength(1)
    expect(v[0].severity).toBe('error')
    expect(v[0].message).toMatch(/0 actual taper week/)
  })

  it('🔴 FIRES when there is no taper phase at all — the 5-week 5K', () => {
    // ⚠️ `buildsToARace` must still be true here, and it is: the last week carries `type: 'race'`.
    // Without that arm this plan would be read as a maintenance block and skipped.
    expect(fired(planWithPhases(['base', 'base', 'build', 'peak', 'peak']))).toHaveLength(1)
  })

  it('is SILENT when the floor is met — one taper week then race week', () => {
    expect(fired(planWithPhases(['base', 'base', 'build', 'peak', 'taper', 'taper']))).toEqual([])
  })

  it('🔴 is SILENT for a block with no race — a floor must not fire on every base-build plan', () => {
    // 📐 Measured on the live fleet: 5 of the 7 plans with no taper week are `base_build`, which has
    // no taper by design. A floor without this scope would flag every one of them.
    const bb = planWithPhases(['base_build', 'base_build', 'base_build'] as Week['phase'][])
    for (const w of bb.weeks) (w as { type: string }).type = 'normal'
    expect(fired(bb)).toEqual([])
  })

  it('🔴 L5 agrees with the old checker on all three shapes — independently derived', () => {
    // The verifier reads §49's table itself rather than the plan's claims about itself, so this is
    // agreement between two derivations, not a tautology.
    const cases: [Week['phase'][], boolean, string][] = [
      [['base', 'base', 'build', 'build', 'peak', 'taper'], true, 'taper is race week alone'],
      [['base', 'base', 'build', 'peak', 'peak'], true, 'no taper phase'],
      [['base', 'base', 'build', 'peak', 'taper', 'taper'], false, 'floor met'],
    ]
    for (const [phases, shouldFire, label] of cases) {
      const p = planWithPhases(phases)
      const old = fired(p).length > 0
      const neu = verifyPlan(p, { input: INPUT, profile: PROFILE }, 'saved')
        .filter(f => f.rule_id === 'INV-PLAN-TAPER-WEEKS-FLOOR').length > 0
      expect(old, `old checker on "${label}"`).toBe(shouldFire)
      expect(neu, `L5 on "${label}"`).toBe(shouldFire)
    }
  })
})
