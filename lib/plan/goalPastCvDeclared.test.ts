// §44 Amendment 2 — GOAL-PAST-CV-SILENT-01 (Coaching Board, 2026-10-06).
//
// When §120 Am. 1 withholds the HM race-specific row because the runner's goal
// pace is past their own CV pace, the plan may not read `comfortable` and must
// carry the sentence saying why.
//
// ⚠️ WHAT THIS DOES NOT PROVE. It does not prove the SENTENCE is good copy —
// that is brand.md's, and McMillan's binding condition (it may not describe a
// race-pace session, because §120 Am. 1 withheld it) is asserted here only as
// "does not mention race-pace work", which is a necessary and not a sufficient
// test of it.
import { describe, it, expect } from 'vitest'
import { validatePlan } from './invariants'
import { generateRulePlan } from './ruleEngine'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * 🔴 A `catch { continue }` HERE IS AN ALLOW-BY-DEFAULT ARM, AND IT HID THE
 * MUTATION THAT WAS SUPPOSED TO FALSIFY THIS FILE.
 *
 * `generateRulePlan` runs `validatePlan` on its own output and THROWS on an
 * error-severity violation under `NODE_ENV=test`. This invariant is
 * error-severity. So when the band arm was deleted to prove the gate could go
 * red, the five at-risk plans in the sample threw, a bare catch skipped them,
 * and **eight of nine arms stayed green** — the file reported health because it
 * had stopped looking.
 *
 * A designed refusal (§44's floor, a volume gate) is a legitimate skip. A throw
 * naming THIS invariant is the defect under test and must never be swallowed.
 */
function build(g: GeneratorInput): Plan | null {
  try {
    return generateRulePlan(g, 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START) as unknown as Plan
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('INV-PLAN-GOAL-PAST-CV-DECLARED')) {
      throw new Error(`generation threw on the invariant under test — that IS the defect, not a skip: ${msg}`)
    }
    return null
  }
}

const codes = (p: Plan) =>
  (validatePlan(p, { race_distance_km: 21.1 } as never) as { code: string }[])
    .filter(v => v.code === 'INV-PLAN-GOAL-PAST-CV-DECLARED')

const base = {
  meta: { race_distance_km: 21.1 },
  weeks: [{ n: 1, phase: 'base', type: 'normal', sessions: {} }],
} as unknown as Plan

describe('INV-PLAN-GOAL-PAST-CV-DECLARED — the invariant', () => {
  it('silent on a plan that never withheld the row', () => {
    expect(codes(base)).toEqual([])
  })

  it('FIRES when the row was withheld and the band still reads comfortable', () => {
    const p = { ...base, meta: { ...base.meta, hm_goal_anchor_withheld: true, difficulty_band: 'comfortable' } } as Plan
    expect(codes(p).length).toBe(1)
  })

  it('FIRES when the band is unset entirely', () => {
    const p = { ...base, meta: { ...base.meta, hm_goal_anchor_withheld: true } } as Plan
    expect(codes(p).length).toBe(1)
  })

  it('FIRES when the band is demanding but no note says why (§38)', () => {
    const p = { ...base, meta: { ...base.meta, hm_goal_anchor_withheld: true, difficulty_band: 'demanding' } } as Plan
    expect(codes(p).length).toBe(1)
  })

  it('SILENT when band and note are both present', () => {
    const p = {
      ...base,
      meta: { ...base.meta, hm_goal_anchor_withheld: true, difficulty_band: 'demanding', difficulty_note: 'Demanding — ...' },
    } as Plan
    expect(codes(p)).toEqual([])
  })

  it('very_demanding also satisfies it — the rule is a FLOOR, not an equality', () => {
    const p = {
      ...base,
      meta: { ...base.meta, hm_goal_anchor_withheld: true, difficulty_band: 'very_demanding', difficulty_note: 'Very demanding — ...' },
    } as Plan
    expect(codes(p)).toEqual([])
  })
})

describe('§44 Am. 2 on real generated plans', () => {
  // A sampled slice, not the full 5,184: the full measurement is recorded in the
  // ruling (816 of 5,184 moved band) and re-derivable; this gate exists to fail
  // if the producer stops honouring it at all.
  const hmTimeTarget = (cohortGrid() as GeneratorInput[])
    .filter(g => Number(g.race_distance_km) === 21.1 && (g as { goal?: string }).goal === 'time_target')
    .filter((_, i) => i % 97 === 0)

  it('the cohort is non-empty — an empty population passes every other arm', () => {
    expect(hmTimeTarget.length).toBeGreaterThan(10)
  })

  it('no withheld plan reads comfortable, and every one carries a note', () => {
    let withheld = 0
    for (const g of hmTimeTarget) {
      const p = build(g)
      if (!p) continue
      const m = p.meta as unknown as Record<string, unknown>
      if (m.hm_goal_anchor_withheld !== true) continue
      withheld++
      expect(m.difficulty_band, `plan read '${String(m.difficulty_band)}' with the row withheld`).not.toBe('comfortable')
      expect(typeof m.difficulty_note, 'a band with no sentence').toBe('string')
    }
    expect(withheld, 'the sample must actually contain withheld plans').toBeGreaterThan(0)
  })

  it("McMillan's condition: the CV sentence never describes a race-pace session", () => {
    // The interval-band sentence says race-pace sessions "bite harder than the
    // interval work". For a CV-band runner there IS no race-pace session, so
    // reusing that copy would describe a session the plan does not contain.
    let seen = 0
    for (const g of hmTimeTarget) {
      const p = build(g)
      if (!p) continue
      const m = p.meta as unknown as Record<string, unknown>
      if (m.hm_goal_anchor_withheld !== true) continue
      const note = String(m.difficulty_note ?? '')
      // Only the plans whose note is THIS amendment's sentence — a plan with a
      // louder reason keeps that reason's note, including the interval one.
      if (!note.includes("the pace you're chasing")) continue
      seen++
      expect(note, 'the CV sentence must not promise race-pace work').not.toMatch(/race-pace/i)
      expect(note, '§38/§40c: the note must name a lever').toMatch(/set a target|Get fitter/)
    }
    expect(seen, "the amendment's own sentence must appear in the sample").toBeGreaterThan(0)
  })
})
