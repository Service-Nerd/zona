// §44 Amendment 3 — PROGRESSION-GOAL-INVERTED-01 (Coaching Board, 2026-10-07).
//
// The MIRROR of Amendment 2. §44 Am. 2 guards the goal that is too FAST (past
// CV); nothing guarded the goal that is too SLOW, and the band could not see it
// — `goalBeyondMeasuredFitness` and `hmAnchorWithheld` both compare one way.
//
// 📐 Measured: **10 of 359 time-target plans (2.8%), marathon only** (10 of 65),
// every one `experienced` declared at 20-35 km/week chasing 4:15 → goal
// `6:03 /km` against an easy ceiling of `5:45`.
//
// 🔴 WHY IT IS NOT ONLY A NOTICE (Seiler): on those plans **62 of 115 sessions
// labelled `quality` (53.9%) are prescribed SLOWER than the runner's own easy
// ceiling**, against **0 of 2,574 (0.0%)** on 349 control plans. §1 counts
// SESSIONS, so the plan declares an intensity distribution it does not deliver.
//
// ⚠️ WHAT THIS DOES NOT PROVE, AND IT IS THE WHOLE POINT OF THE `warn` SEVERITY:
// it asserts the note is STAMPED, never that the runner READS it. Measured the
// same day: `planRationaleNotes` renders **1.01 of 2.27** stamped honesty notes
// per plan (3-tile cap, 70-word budget), and on all 10 of these the single
// surviving tile is `Maintenance`. **This gate is green while the runner is told
// nothing.** Blocked on PLAN-NOTE-BUDGET-INERT-01.
import { describe, it, expect } from 'vitest'
import { validatePlan } from './invariants'
import { generateRulePlan } from './ruleEngine'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { bandCeiling } from './paceBands'
import type { GeneratorInput, Plan } from '@/types/plan'

const codes = (p: Plan) =>
  (validatePlan(p, { race_distance_km: 42.2 } as never) as { code: string }[])
    .filter(v => v.code === 'INV-PLAN-GOAL-BELOW-EASY-DECLARED')

const base = {
  meta: { race_distance_km: 42.2 },
  weeks: [{ n: 1, phase: 'base', type: 'normal', sessions: {} }],
} as unknown as Plan

const sec = (t: string) => { const [m, s] = t.split(':').map(Number); return (m ?? 0) * 60 + (s ?? 0) }

describe('INV-PLAN-GOAL-BELOW-EASY-DECLARED — the invariant', () => {
  it('silent on a plan whose goal is not below the easy ceiling', () => {
    expect(codes(base)).toEqual([])
  })

  it('FIRES when the flag is set and the note is missing', () => {
    const p = { ...base, meta: { ...base.meta, goal_below_easy_ceiling: true } } as Plan
    expect(codes(p).length, 'the flag is stamped with no sentence and nothing complained').toBe(1)
  })

  it('silent once the note is stamped', () => {
    const p = { ...base, meta: {
      ...base.meta, goal_below_easy_ceiling: true, goal_below_easy_ceiling_note: 'x',
    } } as Plan
    expect(codes(p)).toEqual([])
  })
})

describe('§44 Am. 3 — the engine detects it, on the real corpus', () => {
  const grid = cohortGrid() as GeneratorInput[]
  let inverted = 0, flagged = 0, noted = 0, falsePositives = 0, timeTargets = 0
  for (let i = 0; i < grid.length; i += 53) {
    let p: Plan
    try { p = generateRulePlan(grid[i]!, 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START) as unknown as Plan } catch { continue }
    const m = p.meta as unknown as Record<string, unknown>
    if (typeof m?.goal_pace_per_km !== 'string') continue
    timeTargets++
    // ⚠️ THE EASY CEILING IS READ FROM THE PLAN'S OWN CEILING-MODE STEPS, never
    // rebuilt from `meta.vdot`. A VDOT rebuild agrees everywhere both exist
    // (183 of 183) but **`meta.vdot` is absent on 176 of 359 time-target plans,
    // including all 10 of these** — so the rebuilt version reports a confident
    // ZERO. Two sources, one blind to half the population.
    let easyCeil: number | null = null
    for (const w of p.weeks ?? []) for (const s of Object.values(w.sessions ?? {})) {
      const ds = (s as { derived_set?: { blocks?: { steps?: { pace?: string; pace_mode?: string }[] }[] } })?.derived_set
      for (const b of ds?.blocks ?? []) for (const st of b.steps ?? [])
        if (st.pace_mode === 'ceiling' && typeof st.pace === 'string') {
          const c = bandCeiling(st.pace); if (c) easyCeil = Math.max(easyCeil ?? 0, sec(c))
        }
    }
    if (easyCeil == null) continue
    const isInverted = sec(String(m.goal_pace_per_km).replace(/[^0-9:].*$/, '')) > easyCeil
    if (isInverted) {
      inverted++
      if (m.goal_below_easy_ceiling === true) flagged++
      if (typeof m.goal_below_easy_ceiling_note === 'string') noted++
    } else if (m.goal_below_easy_ceiling === true) falsePositives++
  }

  it('the population is real', () => {
    expect(timeTargets, 'no time-target plans swept').toBeGreaterThan(200)
    expect(inverted, 'no inverted plans found — the detector has nothing to detect and this file is vacuous')
      .toBeGreaterThan(0)
  })

  it('every inverted plan is flagged AND carries the sentence', () => {
    expect(flagged, `${inverted - flagged} inverted plan(s) unflagged`).toBe(inverted)
    expect(noted, `${inverted - noted} inverted plan(s) flagged with no sentence`).toBe(inverted)
  })

  it('and no plan is flagged that is not inverted', () => {
    expect(falsePositives, 'the detector fired on a plan whose goal is faster than its easy ceiling').toBe(0)
  })
})
