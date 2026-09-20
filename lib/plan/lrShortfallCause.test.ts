// §80 Amendment 2 (Coaching Board 2026-09-20, MARA-LR-LOWBASE-01).
//
// The long-run shortfall note had TWO arms — time cap, or weekly volume — and
// the injury cohort fell through both onto the wrong one.
//
// MEASURED at the sitting: at cwk 12/15/20 a knee-history beginner marathoner
// gets a 17/17/19 km peak long run where their HEALTHY twin at the SAME weekly
// volume gets 26 km. Volume is therefore demonstrably not the binding lever, and
// the note said it was — pointing an injury-history runner at the one lever
// their history says not to pull (Willy: "an injury vector served as advice").
//
// ⚠️ The invariant half of this file is a FALSIFICATION test, not a coverage
// test. It proves INV-PLAN-LR-SHORTFALL-CAUSE can go RED, because this repo has
// shipped a green tick with nothing behind it more than once.

import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import type { GeneratorInput, Plan } from '@/types/plan'

const BASE = {
  race_date: '2027-04-25',
  race_distance_km: 42.2,
  goal: 'finish',
  days_available: 3,
  age: 38,
  training_age: '<6mo',
  user_declared_level: 'beginner',
} as unknown as GeneratorInput

const START = '2026-10-05'
const mk = (cwk: number, injury?: string[]) => generateRulePlan(
  { ...BASE, current_weekly_km: cwk, longest_recent_run_km: Math.max(1, Math.round(cwk * 0.4)), injury_history: injury } as GeneratorInput,
  'paid',
  START,
)
const note = (p: Plan) => (p.meta as unknown as { long_run_shortfall_note?: string }).long_run_shortfall_note ?? ''

describe('§80 Am.2 — the shortfall note names the INJURY cap when it binds', () => {
  it('blames the injury history, not weekly volume, for a knee-history runner', () => {
    const n = note(mk(15, ['knee']))
    expect(n).toContain('your injury history is what limits it')
    expect(n).not.toContain('your weekly volume is what limits it')
  })

  it('fires for shin splints too — §12 caps both', () => {
    expect(note(mk(15, ['shin splints']))).toContain('your injury history is what limits it')
  })

  it('names NO lever in the injury arm (§40c / §80 Am.1 construction)', () => {
    const n = note(mk(15, ['knee']))
    // The volume arm invites more volume; the injury arm must not invite anything.
    expect(n).not.toMatch(/more (weekly )?volume|add (more )?volume|build (up )?more/i)
  })

  it('THE MEASURED CASE: same volume, different long run — so volume is not the lever', () => {
    const knee = mk(15, ['knee'])
    const healthy = mk(15)
    const peak = (p: Plan) => Math.max(...p.weeks
      .filter(w => w.phase !== 'foundation' && w.type !== 'race')
      .flatMap(w => Object.values(w.sessions).map(s => (s && s.type !== 'race' ? (s.distance_km ?? 0) : 0))))
    // Identical declared weekly volume, materially different peak long run.
    expect(peak(healthy)).toBeGreaterThan(peak(knee))
  })

  it('a healthy runner still gets the time-cap or volume arm, unchanged', () => {
    const n = note(mk(15))
    expect(n).not.toContain('your injury history is what limits it')
  })
})

describe('§80 Am.2 — the unrehearsed-fuelling tail (Sims)', () => {
  it('fires when the race runs more than a fuelling-session beyond the longest run', () => {
    expect(note(mk(8, ['knee']))).toContain('fuelling goes untested')
  })

  it('is a practice cue, never a nutrition prescription (ADR-011)', () => {
    const n = note(mk(8, ['knee']))
    expect(n).not.toMatch(/\bgrams?\b|\bkcal\b|\bcalorie/i)
  })
})

describe('INV-PLAN-LR-SHORTFALL-CAUSE — FALSIFICATION: it must be able to go RED', () => {
  it('flags a note that blames volume while a knee history is present', () => {
    const p = mk(15, ['knee'])
    // Put the PRE-AMENDMENT note back. This is what the engine used to emit.
    const broken = {
      ...p,
      meta: {
        ...p.meta,
        long_run_shortfall_note:
          "Your longest run tops out at 2h 16. For a race you'll likely be moving for around 5h 38, "
          + "and we'd normally want it nearer 3h 56, but your weekly volume is what limits it: the long "
          + 'run is sized as a share of the week, and this week cannot carry more.',
      },
    } as Plan
    const vs = validatePlan(broken, { ...BASE, current_weekly_km: 15, injury_history: ['knee'] } as GeneratorInput)
      .filter(v => v.code === 'INV-PLAN-LR-SHORTFALL-CAUSE')
    expect(vs.length).toBeGreaterThan(0)
    // The INJURY arm specifically, not the pre-existing time-cap arm.
    expect(vs.some(v => v.message.includes('volume-capped injury history'))).toBe(true)
    expect(vs.every(v => v.severity === 'error')).toBe(true)
  })

  it('the INJURY arm specifically does not fire without an injury history', () => {
    // ⚠️ The first draft of this test asserted the CODE was absent and failed —
    // correctly. A healthy runner's long run sits AT the time cap, so the arm
    // that already existed fires on the same doctored note. Two arms share one
    // code, so the code alone cannot tell them apart; the message can.
    const p = mk(15)
    const same = {
      ...p,
      meta: {
        ...p.meta,
        injury_history: undefined,
        long_run_shortfall_note: 'x but your weekly volume is what limits it: y',
      },
    } as unknown as Plan
    const msgs = validatePlan(same, { ...BASE, current_weekly_km: 15 } as GeneratorInput)
      .filter(v => v.code === 'INV-PLAN-LR-SHORTFALL-CAUSE')
      .map(v => v.message)
    expect(msgs.some(m => m.includes('volume-capped injury history'))).toBe(false)
  })

  it('the LIVE plan is clean — the producer and the checker agree', () => {
    const p = mk(15, ['knee'])
    const codes = validatePlan(p, { ...BASE, current_weekly_km: 15, injury_history: ['knee'] } as GeneratorInput).map(v => v.code)
    expect(codes).not.toContain('INV-PLAN-LR-SHORTFALL-CAUSE')
  })
})
