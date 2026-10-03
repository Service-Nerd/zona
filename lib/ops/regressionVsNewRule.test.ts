import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { classifyCodes, summariseVerdicts, verdictReason } from './regressionVsNewRule'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { composePlanWithFoundation } from '@/lib/plan/foundationCompose'
import { PINNED_PLAN_START_0907 } from '@/lib/plan/__fixtures__/pinnedPlanStart'
import type { GeneratorInput, Plan } from '@/types/plan'

const FROZEN = new Date('2026-09-03T12:00:00Z')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN) })
afterAll(() => { vi.useRealTimers() })

/**
 * OPS-DIGEST-STORED-PLAN-DEBT-01 — "engine regressed" vs "we added the rule".
 *
 * 🔴 THE ARM THAT MATTERS IS THE VACUITY ARM, and it exists because the first version of
 * this classifier was wrong in exactly the reassuring direction. It called
 * `generateRulePlan` alone, which does NOT compose the foundation block (ADR-020). Every
 * plan regenerated with ZERO foundation weeks, so a foundation invariant could not fire,
 * and all four live plans were labelled `rule_newer_than_plan`. A genuine engine
 * regression in a foundation week would have been labelled "nothing to see".
 */
const INPUT: GeneratorInput = {
  age: 40, race_name: 'T', target_time: '4:15:00', injury_history: [],
  race_distance_km: 42.2, race_date: '2027-01-10', current_weekly_km: 40,
  longest_recent_run_km: 18, days_available: 5, days_cannot_train: [],
  training_age: '2-5yr', user_declared_level: 'intermediate',
  hard_session_relationship: 'neutral', goal: 'finish',
  preferred_long_run_day: 'sun', max_weekday_mins: 90,
} as GeneratorInput

/** A stored plan is just a generated plan plus the meta the classifier reads. */
function storedPlan(over: Partial<Record<string, unknown>> = {}): Plan {
  const p = generateRulePlan(INPUT, 'paid', PINNED_PLAN_START_0907) as Plan
  ;(p.meta as unknown as Record<string, unknown>).plan_start = PINNED_PLAN_START_0907
  ;(p.meta as unknown as Record<string, unknown>).generated_at = `${PINNED_PLAN_START_0907}T06:00:00.000Z`
  ;(p.meta as unknown as Record<string, unknown>).tier = 'paid'
  Object.assign(p.meta as unknown as Record<string, unknown>, over)
  return p
}

describe('classifyCodes — the verdict', () => {
  it('calls a code the engine does NOT reproduce "rule_newer_than_plan"', () => {
    const p = storedPlan()
    // A code no current plan violates: today's engine cannot reproduce it, and the plan
    // regenerates to the same shape, so the honest verdict is that the rule is newer.
    const r = classifyCodes(p, INPUT, ['INV-PLAN-A-RULE-THAT-NOTHING-BREAKS'])
    expect(r.comparable).toBe(true)
    expect(r.verdicts['INV-PLAN-A-RULE-THAT-NOTHING-BREAKS']).toBe('rule_newer_than_plan')
  })

  it('REFUSES to answer when the plan cannot be regenerated — never the reassuring verdict', () => {
    const p = storedPlan()
    delete (p.meta as unknown as Record<string, unknown>).plan_start
    const r = classifyCodes(p, INPUT, ['INV-PLAN-ANYTHING'])
    expect(r.comparable).toBe(false)
    expect(r.verdicts['INV-PLAN-ANYTHING']).toBe('undecidable')
    expect(r.note).toMatch(/plan_start/)
  })

  it('🔴 THE VACUITY ARM — a regenerated plan missing the CONSTRUCT is undecidable, not clean', () => {
    const p = storedPlan()
    // Simulate the real trap: the stored plan carries foundation weeks that regeneration
    // will not reproduce. Before the fix this returned `rule_newer_than_plan`.
    p.weeks.unshift({
      n: 0, phase: 'base', type: 'normal', weekly_km: 20, start_date: '2026-08-31',
      theme: 'Foundation', sessions: { mon: { type: 'easy', label: 'Easy', distance_km: 5, duration_mins: null } },
    } as never)
    const r = classifyCodes(p, INPUT, ['INV-PLAN-FOUNDATION-WEEKDAY-HAS-DURATION'])
    expect(r.comparable).toBe(false)
    expect(r.verdicts['INV-PLAN-FOUNDATION-WEEKDAY-HAS-DURATION']).toBe('undecidable')
    // The reason must be legible in a report, not a bare boolean.
    expect(r.note).toMatch(/not shape-comparable|generated_at/)
  })

  it('🔴 RUNS THE ADR-020 COMPOSITION STAGE — a plan WITH a real foundation block stays decidable', () => {
    // THE ARM M2 EXPOSED AS MISSING. The vacuity arm above reaches `undecidable` whether or
    // not `composePlanWithFoundation` runs, so it cannot tell the two apart — skipping the
    // stage left the suite green. This fixture is a plan whose foundation block regeneration
    // CAN reproduce: a >28-day runway, composed through the real pipeline exactly as the
    // route does. With the composition stage the shapes match and the verdict is decidable;
    // without it, fresh comes back with 0 foundation weeks and this goes `undecidable`.
    const planStart = '2026-11-30'
    const madeOn = '2026-10-05'           // 56-day runway → a foundation block exists
    // §44 prep time: the race must sit far enough beyond plan_start or generation is
    // REFUSED by design, which is a different outcome from the one under test.
    const far: GeneratorInput = { ...INPUT, race_date: '2027-04-11' }
    const base = generateRulePlan(far, 'paid', planStart) as Plan
    const composed = composePlanWithFoundation(base, far, madeOn, 'add').plan
    const meta = composed.meta as unknown as Record<string, unknown>
    meta.plan_start = planStart
    meta.generated_at = `${madeOn}T06:00:00.000Z`
    meta.tier = 'paid'

    // The fixture is only meaningful if it actually HAS foundation weeks.
    expect(composed.weeks.filter(w => w.n <= 0).length).toBeGreaterThan(0)

    const r = classifyCodes(composed, far, ['INV-PLAN-FOUNDATION-WEEKDAY-HAS-DURATION'])
    expect(r.comparable).toBe(true)
    expect(r.verdicts['INV-PLAN-FOUNDATION-WEEKDAY-HAS-DURATION']).toBe('rule_newer_than_plan')
  })

  it('an empty code list is not an implicit all-clear', () => {
    const r = classifyCodes(storedPlan(), INPUT, [])
    expect(r.verdicts).toEqual({})
    expect(r.comparable).toBe(false)
  })
})

describe('summariseVerdicts — only a regression or an unknown may page anyone', () => {
  it('a page of pure stored debt is NOT actionable', () => {
    const s = summariseVerdicts([
      { A: 'rule_newer_than_plan', B: 'rule_newer_than_plan' },
      { C: 'rule_newer_than_plan' },
    ])
    expect(s.rule_newer_than_plan).toBe(3)
    expect(s.actionable).toBe(false)
    expect(s.regressionCodes).toEqual([])
  })

  it('one engine regression IS actionable and names the code', () => {
    const s = summariseVerdicts([{ A: 'rule_newer_than_plan', B: 'engine_regression' }])
    expect(s.actionable).toBe(true)
    expect(s.regressionCodes).toEqual(['B'])
  })

  it('an UNDECIDABLE is actionable too — "we could not tell" must not read as "fine"', () => {
    const s = summariseVerdicts([{ A: 'undecidable' }])
    expect(s.actionable).toBe(true)
    expect(s.engine_regression).toBe(0)
  })
})

/**
 * `verdictReason` is what the EXISTING digest prints, because it already selects
 * `detail->>'reason'`. These arms assert the three sentences say the opposite things they
 * must — a digest that reads "NOT A DEFECT" for a regression is worse than silence.
 */
describe('verdictReason — the sentence the digest already prints', () => {
  it('names a regression as a live defect to escalate', () => {
    const r = verdictReason({ A: 'engine_regression', B: 'rule_newer_than_plan' }, 'shape matches')!
    expect(r).toMatch(/ENGINE REGRESSION/)
    expect(r).toMatch(/\bA\b/)
    expect(r).toMatch(/escalate/i)
    // It must NOT also tell the reader this is fine.
    expect(r).not.toMatch(/NOT A DEFECT/)
  })

  it('says NOT A DEFECT, and says why, for a rule that post-dates the plan', () => {
    const r = verdictReason({ A: 'rule_newer_than_plan' }, 'shape matches')!
    expect(r).toMatch(/NOT A DEFECT/)
    expect(r).toMatch(/older plan meeting a newer rule/)
    expect(r).toMatch(/Remediation queue, not an alert/)
    expect(r).not.toMatch(/ENGINE REGRESSION/)
  })

  it('an UNDECIDABLE reads as actionable and carries the reason', () => {
    const r = verdictReason({ A: 'undecidable' }, 'foundation weeks 3 → 0')!
    expect(r).toMatch(/UNDECIDABLE/)
    expect(r).toMatch(/foundation weeks 3 → 0/)
    expect(r).toMatch(/not "fine"/)
    expect(r).not.toMatch(/NOT A DEFECT/)
  })

  it('a REGRESSION outranks an undecidable in the same set — the worst news leads', () => {
    const r = verdictReason({ A: 'undecidable', B: 'engine_regression' }, 'x')!
    expect(r).toMatch(/ENGINE REGRESSION/)
  })

  it('returns null for an empty set rather than an empty-sounding sentence', () => {
    expect(verdictReason({}, 'x')).toBeNull()
  })
})
