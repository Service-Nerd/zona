/**
 * Design Board amendment 3 (MODIFY-CONFIRM-DIFF-01, 2026-10-13).
 *
 * 🎓 Sierra's finding: a bare "-41%" reads as loss. The sentence must explain
 * the arithmetic and MUST NOT make a claim about training effect — the board
 * routed it to the Coaching Board if it did (the W-03 precedent).
 */
import { describe, it, expect } from 'vitest'
import { explainPlanDelta } from './planDeltaExplain'

// The founder's real edit, 2026-10-13: 12 weeks -> 8, peak 44 -> 40, total 383 -> 221.
const BEFORE = { weeks: 12, peak: 44, total: 383 }
const AFTER  = { weeks: 8,  peak: 40, total: 221 }

describe('explainPlanDelta — the sentence under the whole-plan card', () => {
  it("explains the founder's own 41% cut by the thing that caused it", () => {
    const s = explainPlanDelta(BEFORE, AFTER)
    expect(s).toBe('4 fewer weeks of training, so there is less in total.')
  })

  it('says the peak held when it did — the reassurance is only offered when true', () => {
    expect(explainPlanDelta(BEFORE, { weeks: 8, peak: 43, total: 221 }))
      .toBe('4 fewer weeks of training, so there is less in total. Your biggest week is about the same.')
  })

  it('singular for one week', () => {
    expect(explainPlanDelta(BEFORE, { weeks: 11, peak: 44, total: 350 }))
      .toMatch(/^1 fewer week of training/)
  })

  it('handles a LONGER plan, not only a shorter one', () => {
    expect(explainPlanDelta({ weeks: 8, peak: 40, total: 221 }, BEFORE))
      .toMatch(/^4 more weeks of training, so there is more in total/)
  })

  // 🔴 SILENCE IS THE COMMON CASE. A sentence on every edit is noise.
  it('says NOTHING when the week count did not move', () => {
    expect(explainPlanDelta(BEFORE, { weeks: 12, peak: 38, total: 300 })).toBeNull()
    expect(explainPlanDelta(BEFORE, BEFORE)).toBeNull()
  })

  // 🔴 THE BOARD'S CONDITION, ASSERTED. Any of these words turns a factual
  // sentence into a physiology claim, which is the Coaching Board's and not ours.
  it('🔴 makes no claim about training effect, safety or sufficiency', () => {
    const outputs = [
      explainPlanDelta(BEFORE, AFTER),
      explainPlanDelta(BEFORE, { weeks: 8, peak: 43, total: 221 }),
      explainPlanDelta({ weeks: 8, peak: 40, total: 221 }, BEFORE),
      explainPlanDelta(BEFORE, { weeks: 11, peak: 44, total: 350 }),
    ].filter((s): s is string => s != null)
    expect(outputs.length).toBeGreaterThan(3)
    const banned = /\b(safe|safer|enough|sufficient|fitter|faster|stronger|better|worse|ready|improve|risk|injur|optimal|still (be|get))\b/i
    for (const s of outputs) {
      expect(s, `"${s}" makes a claim this screen may not make`).not.toMatch(banned)
    }
  })

  it('never uses an em dash — the founder rule, and this is a sentence the runner reads', () => {
    for (const s of [explainPlanDelta(BEFORE, AFTER), explainPlanDelta(BEFORE, { weeks: 8, peak: 43, total: 221 })]) {
      expect(s).not.toMatch(/—/)
    }
  })
})
