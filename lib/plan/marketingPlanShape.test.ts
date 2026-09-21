// MKT-PLAN-SHAPE-01 — the GATE for I1–I10 on the nine published /plans/* pages.
//
// `scripts/audit-plan-invariants.ts` prints the readable per-week table. THIS
// file is what makes a regression fail the build, and it exists because this
// repo has recorded three times that a check you have to remember to type is a
// check that does not run (the liveness debt, decorative config, the eslint rule
// installed and never configured).
//
// ⚠️ WHAT THIS DOES NOT PROVE. It gates the GATING findings only. The advisory
// findings — I1 (22), I3 (18), I7a (5), I8 (4), I9 (4), and a handful under I2/
// I4/I6 — are measured on every run and deliberately NOT gated, because each
// contradicts a ratified Coaching Board decision named in its `conflictsWith`.
// A green run here therefore means "no NEW shape defect", not "the nine plans
// satisfy I1–I10 as the brief wrote them". They do not, and the register of
// what they fail and why is in `docs/decisions/mkt-plan-shape-01-conflicts.md`.

import { describe, it, expect } from 'vitest'
import { MARKETING_PLANS, planAnchor } from '@/lib/marketing/plans'
import { generateRulePlan } from './ruleEngine'
import { checkPlanShape, easySharePctByTime, I10_MIN_EASY_SHARE_PCT } from './planShapeInvariants'
import { validatePlan } from './invariants'
import type { GeneratorInput } from '@/types/plan'

function build(p: typeof MARKETING_PLANS[number]) {
  const { planStart, raceDate } = planAnchor(p.dayOffset)
  return generateRulePlan(p.input(raceDate) as GeneratorInput, 'free', planStart)
}

describe('MKT-PLAN-SHAPE-01 — published plan shape', () => {
  for (const p of MARKETING_PLANS) {
    it(`${p.slug} has no gating shape violation`, () => {
      const findings = checkPlanShape(build(p) as never).filter(f => f.gate)
      expect(findings.map(f => `${f.id} w${f.weekN}: ${f.message}`)).toEqual([])
    })
  }

  it('every plan clears I10 — easy share by time', () => {
    const shares = MARKETING_PLANS.map(p => ({ slug: p.slug, pct: easySharePctByTime(build(p) as never) }))
    for (const s of shares) expect(s.pct, s.slug).toBeGreaterThanOrEqual(I10_MIN_EASY_SHARE_PCT)
  })

  // FALSIFICATION (CLAUDE.md "Completion claims", rule 4). A gate believed green
  // is worth nothing until it has been shown to go red. Each of the three
  // defects the 2026-09-21 audit found is reconstructed here as a hand-built
  // plan, and the checker must catch it.
  describe('the checker can be made to fail', () => {
    const week = (n: number, phase: string, type: string, kmEasy: number[], longKm: number) => ({
      n, phase, type, weekly_km: Math.round(kmEasy.reduce((a, b) => a + b, 0) + longKm),
      label: '', theme: '', date: '2026-01-01', long_run_hrs: 1,
      sessions: Object.fromEntries([
        ...kmEasy.map((k, i) => [['mon', 'wed', 'fri'][i], {
          id: `w${n}-${i}`, type: 'easy', label: 'Easy run — Zone 2', role: 'easy',
          distance_km: k, duration_mins: Math.round(k * 6.5), primary_metric: 'distance', zone: 'Zone 2',
        }]),
        ['sun', {
          id: `w${n}-lr`, type: 'easy', label: 'Long run — Zone 2', role: 'long_run',
          distance_km: longKm, duration_mins: Math.round(longKm * 6.5), primary_metric: 'distance', zone: 'Zone 2',
        }],
      ]),
    })
    const plan = (weeks: unknown[]) => ({ meta: { race_distance_km: 10, age: 40 }, weeks }) as never

    it('P0-A — the build phase restarting at the recovery week rather than resuming (I2)', () => {
      const ids = checkPlanShape(plan([
        week(1, 'base', 'normal', [10, 10, 10], 13),
        week(2, 'base', 'deload', [7, 7, 7], 9),
        week(3, 'build', 'normal', [4, 4, 4], 13),   // ← restarts at the deload's level
      ])).filter(f => f.gate).map(f => f.id)
      expect(ids).toContain('I2')
    })

    it('P0-B — peak never reaching base (I3)', () => {
      const ids = checkPlanShape(plan([
        week(1, 'base', 'normal', [12, 12, 12], 15),   // 51
        week(2, 'peak', 'normal', [9, 9, 9], 12),      // 39
      ])).filter(f => f.gate).map(f => f.id)
      expect(ids).toContain('I3')
    })

    it('P1-B — a recovery week that barely recovers (I4)', () => {
      const ids = checkPlanShape(plan([
        week(1, 'build', 'normal', [10, 10, 10], 13),  // 43
        week(2, 'build', 'deload', [10, 10, 10], 12),  // 42 — a 2% "recovery"
      ])).filter(f => f.gate).map(f => f.id)
      expect(ids).toContain('I4')
    })

    // P1-A is NOT gated by `checkPlanShape` — I5 as written is provably
    // unsatisfiable (0 of 220 placements; see the conflicts register), so it
    // reports as an advisory. Its ratified intent is §119, which lives in
    // `validatePlan()` and therefore runs on EVERY generated plan, in-app
    // included. Falsify it there, where it actually gates.
    it('P1-A — a recovery week after one loading week (§119, via validatePlan)', () => {
      const bad = plan([
        week(1, 'base', 'normal', [10, 10, 10], 13),
        week(2, 'base', 'deload', [7, 7, 7], 9),
      ]) as unknown as Parameters<typeof validatePlan>[0]
      const codes = validatePlan(bad, { race_distance_km: 10 } as never)
        .filter(v => v.code === 'INV-PLAN-MIN-LOADING-BLOCK')
      // EXACTLY ONE. The first cut of this invariant was written inside
      // `validatePlan`'s per-week loop, so it emitted the same plan-level
      // finding once per week — sixteen identical rows on the P5 golden plan.
      // `toContain` passed throughout. A plan-level check asserted with
      // `toContain` cannot tell one finding from sixteen.
      expect(codes.map(v => v.week)).toEqual([2])

      // ...and stays silent once the block is a real one.
      const good = plan([
        week(1, 'base', 'normal', [10, 10, 10], 13),
        week(2, 'base', 'normal', [10, 10, 10], 13),
        week(3, 'base', 'deload', [7, 7, 7], 9),
      ]) as unknown as Parameters<typeof validatePlan>[0]
      expect(validatePlan(good, { race_distance_km: 10 } as never)
        .filter(v => v.code === 'INV-PLAN-MIN-LOADING-BLOCK')).toEqual([])
    })

    it('I5 is reported as an advisory, not silently dropped', () => {
      const findings = checkPlanShape(plan([
        week(1, 'base', 'normal', [10, 10, 10], 13),
        week(2, 'base', 'deload', [7, 7, 7], 9),
      ]))
      const i5 = findings.find(f => f.id === 'I5')
      expect(i5, 'I5 must still be MEASURED even though it does not gate').toBeTruthy()
      expect(i5!.gate).toBe(false)
      expect(i5!.conflictsWith).toMatch(/220/)
    })
  })
})
