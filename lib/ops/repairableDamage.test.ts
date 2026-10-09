import { describe, it, expect } from 'vitest'
import { summariseRepairable, REPAIR_COMMAND } from './repairableDamage'
import { REPAIRABLE_CODES } from '@/lib/plan/planRepairs'

/**
 * DIGEST-REPAIRABLE-01 — the digest says what to DO, not only what is wrong.
 *
 * 🔴 WHAT THIS EXISTS FOR, MEASURED. The recalibration defect broke three live
 * plans on 2026-10-03. The audit's transition alert fired once and then went
 * quiet — correctly, by its own rule — and the damage sat for **six days** while
 * the digest said nothing, because after the first morning nothing had *changed*.
 * It surfaced only because the founder read an unrelated line and asked.
 */
describe('summariseRepairable', () => {
  it('counts distinct PLANS and per-code totals, commonest first', () => {
    const out = summariseRepairable([
      { user_id: 'a', codes: ['INV-PLAN-HEADER-PACE-MATCHES-WORK', 'INV-PLAN-STEP-PACE-FROM-GUIDE'] },
      { user_id: 'b', codes: ['INV-PLAN-HEADER-PACE-MATCHES-WORK'] },
      { user_id: 'c', codes: ['INV-PLAN-HEADER-PACE-MATCHES-WORK'] },
    ])!
    expect(out.plans).toBe(3)
    expect(Object.keys(out.by_code)[0]).toBe('INV-PLAN-HEADER-PACE-MATCHES-WORK')
    expect(out.by_code['INV-PLAN-HEADER-PACE-MATCHES-WORK']).toBe(3)
    expect(out.by_code['INV-PLAN-STEP-PACE-FROM-GUIDE']).toBe(1)
  })

  it('counts a plan ONCE however many repairable codes it carries', () => {
    const out = summariseRepairable([{ user_id: 'a', codes: Array.from(REPAIRABLE_CODES) }])!
    expect(out.plans).toBe(1)
  })

  /**
   * ⚠️ ABSENCE IS THE CLEAN SIGNAL. A digest line reading "repairable: 0 plans"
   * every morning is the noise this is meant to avoid being — the same reasoning
   * that made the code-set alert fire on a transition.
   */
  it('returns UNDEFINED when there is nothing to do, never a zeroed object', () => {
    expect(summariseRepairable([])).toBeUndefined()
    expect(summariseRepairable([{ user_id: 'a', codes: [] }])).toBeUndefined()
    expect(summariseRepairable([{ user_id: 'a', codes: ['INV-PLAN-LR-PROGRESSION-CAP'] }]))
      .toBeUndefined()
  })

  it('ignores a violation with no remedy — it would advertise a command that cannot fix it', () => {
    const out = summariseRepairable([{
      user_id: 'a',
      codes: ['INV-PLAN-LR-PROGRESSION-CAP', 'INV-INPUT-LONGEST-LE-WEEKLY', 'INV-PLAN-STEP-PACE-FROM-GUIDE'],
    }])!
    expect(Object.keys(out.by_code)).toEqual(['INV-PLAN-STEP-PACE-FROM-GUIDE'])
    expect(out.plans).toBe(1)
  })

  it('carries the command, and it is a DRY RUN by default', () => {
    const out = summariseRepairable([{ user_id: 'a', codes: ['INV-PLAN-STEP-PACE-FROM-GUIDE'] }])!
    expect(out.command).toBe(REPAIR_COMMAND)
    expect(out.command).not.toContain('--apply')   // the digest must not hand over a write
    expect(out.command).toContain('--repair')
  })

  /**
   * ⚠️ THE TWO LISTS MUST BE ONE. The repair script's population filter and this
   * summary both read `REPAIRABLE_CODES`, so the digest can never advertise a
   * command that does not cover the damage it reports. That exact drift already
   * happened once inside the script itself.
   */
  it('reports EVERY repairable code and invents none', () => {
    const out = summariseRepairable(
      Array.from(REPAIRABLE_CODES).map((c, i) => ({ user_id: `u${i}`, codes: [c] })),
    )!
    expect(Object.keys(out.by_code).sort()).toEqual(Array.from(REPAIRABLE_CODES).sort())
    expect(out.plans).toBe(REPAIRABLE_CODES.length)
  })

  /**
   * ⚠️ FALSIFICATION AGAINST THE REAL INCIDENT, not an invented case. These are
   * the exact code sets the three damaged plans carried on 2026-10-09 before the
   * repairs — so this arm is what the check was written for.
   */
  it('FALSIFICATION — reproduces the three real plans as 3 repairable', () => {
    const out = summariseRepairable([
      // Floe: 7 header + 8 step-pace
      { user_id: 'floe', codes: ['INV-PLAN-HEADER-PACE-MATCHES-WORK', 'INV-PLAN-STEP-PACE-FROM-GUIDE'] },
      // Clay: step-pace + easy-pace (not repairable) — regeneration case
      { user_id: 'clay', codes: ['INV-PLAN-STEP-PACE-FROM-GUIDE', 'INV-PLAN-EASY-PACE-PRESENT'] },
      // Duncan: headers, effort-governed pace, long-run segment
      { user_id: 'duncan', codes: [
        'INV-PLAN-HEADER-PACE-MATCHES-WORK',
        'INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED',
        'INV-PLAN-5K10K-LR-PACE-CAP',
        'INV-PLAN-LR-PROGRESSION-CAP',      // no remedy — must not be counted
      ] },
    ])!
    expect(out.plans).toBe(3)
    expect(out.by_code['INV-PLAN-LR-PROGRESSION-CAP']).toBeUndefined()
    expect(out.by_code['INV-PLAN-HEADER-PACE-MATCHES-WORK']).toBe(2)
  })
})
