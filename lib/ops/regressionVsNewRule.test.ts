import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { classifyCodes, summariseVerdicts, verdictReason, foundationWeekViolations, isInputLevelCode } from './regressionVsNewRule'
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

// ─── AUDIT-FOUNDATION-MISCOUNT-01 (2026-10-09) ──────────────────────────────
//
// 🔴 THE DEFECT, MEASURED IN PRODUCTION. `plan-audit/route.ts` reported
// `foundation_week_violations: errors.filter(v => (v.week ?? 1) <= 0).length`.
//
// Two conventions collide on one sentinel:
//   · ADR-020           — a foundation week has `n <= 0`
//   · invariants.ts:1013 — `week: 0` means "input-level, plan-wide, NO specific week"
//
// **64 invariants use `week: 0`.** Across all 32 stored plans the audit reported
// `foundation_week_violations > 0` on **19**; the true count was **0 on every one**, over
// **15 distinct codes**. 100% of the reports were wrong, and the field exists, in its own
// words, so that *"triage starts in the right place"*.
//
// ⚠️ IT HAD A CONSEQUENCE, WHICH IS WHY THIS IS NOT TIDYING. On 2026-10-08 the daily digest
// escalated `INV-INPUT-LONGEST-LE-WEEKLY` as a live engine regression in a foundation week
// and recommended *"stop the generator setting an early/foundation long run above weekly
// volume"*. The plan had ZERO foundation weeks, no generated week breached anything, and the
// runner had simply stated a 5 km week with a 6 km longest run.
describe('AUDIT-FOUNDATION-MISCOUNT-01 — foundation means n <= 0, not week === 0', () => {
  const planWith = (ns: number[]): Plan => ({
    weeks: ns.map(n => ({ n, sessions: {} })),
  } as unknown as Plan)

  it('🔴 THE DEFECT: a plan-wide violation is NOT a foundation-week violation', () => {
    // `week: 0` is the plan-wide sentinel. This plan has no foundation block at all.
    const plan = planWith([1, 2, 3])
    expect(foundationWeekViolations(plan, [{ week: 0 }])).toBe(0)
    // And the expression it replaced would have said 1 — stated so the regression is legible.
    expect([{ week: 0 }].filter(v => (v.week ?? 1) <= 0).length).toBe(1)
  })

  it('…and it still counts a REAL foundation violation', () => {
    // The risk of over-correcting: the honest predicate must not stop counting.
    const plan = planWith([0, 1, 2])
    expect(foundationWeekViolations(plan, [{ week: 0 }])).toBe(1)
    const deeper = planWith([-1, 0, 1])
    expect(foundationWeekViolations(deeper, [{ week: -1 }, { week: 0 }, { week: 1 }])).toBe(2)
  })

  it('counts only the weeks the plan ACTUALLY carries', () => {
    // A violation citing a foundation week the plan does not have is not a foundation hit.
    expect(foundationWeekViolations(planWith([1, 2]), [{ week: -3 }])).toBe(0)
  })

  it('a missing or null week is not a foundation hit', () => {
    // The old `?? 1` defaulted an absent week to 1 and then compared; membership needs no
    // default, which is the point of using a set.
    expect(foundationWeekViolations(planWith([0, 1]), [{}, { week: null }])).toBe(0)
  })

  it('⚠️ the sentinel is genuinely ambiguous, so the test says so out loud', () => {
    // The SAME violation shape (`week: 0`) is a real hit on one plan and a plan-wide
    // sentinel on another. Nothing about the violation can tell them apart — only the plan
    // can, which is why the predicate takes the plan.
    const v = [{ week: 0 }]
    expect(foundationWeekViolations(planWith([0, 1, 2]), v)).toBe(1)
    expect(foundationWeekViolations(planWith([1, 2, 3]), v)).toBe(0)
  })

  it('the route uses the single owner, not a local copy', () => {
    const raw = readFileSync(join(process.cwd(), 'app/api/ops/plan-audit/route.ts'), 'utf8')
    // ⚠️ COMMENTS STRIPPED. The route QUOTES the dead expression so the next reader knows
    // what was wrong, and the first version of this arm matched that prose — the recorded
    // `an ownership arm matching its own comment` class, and the THIRD time I have hit it
    // in two days. A guard that fires on prose recording a defect gets switched off, which
    // CLAUDE.md treats as equivalent to having no guard.
    const route = raw.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
    expect(route).toContain('foundationWeekViolations(plan, errors)')
    // 🔴 The exact expression that was wrong must not come back AS CODE.
    expect(route).not.toMatch(/errors\.filter\(v => \(v\.week \?\? 1\) <= 0\)/)
    // …and the strip must not blind it: the same text as code still fails.
    const asCode = '  const n = errors.filter(v => (v.week ?? 1) <= 0).length'
    expect(asCode.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n'))
      .toMatch(/errors\.filter\(v => \(v\.week \?\? 1\) <= 0\)/)
  })
})

describe('AUDIT-FOUNDATION-MISCOUNT-01 — an input-level code cannot be an engine regression', () => {
  // 🔴 THE ARM THAT WAS MISSING, AND I FOUND IT BY FALSIFICATION. Turning the input-level
  // branch OFF in `classifyCodes` left all 25 tests green: every other arm here hands
  // `'input_breach'` in by hand and asserts what the REPORTER does with it, so nothing ran
  // `classifyCodes` and checked what it PRODUCES. That is the catalogue's "both halves
  // correct, the COMPOSITION untested" class, in the file written to close this defect.
  //
  // ⚠️ AND WRITING IT TURNED UP SOMETHING THE RCA DID NOT HAVE: this path is
  // ENVIRONMENT-DEPENDENT. `generateRulePlan` and `validatePlan` THROW on error severity
  // under NODE_ENV=test/development and LOG in production (ADR-006 posture). So:
  //   · in TEST      — regeneration throws → `unresolved()` → verdict `undecidable`
  //   · in PRODUCTION — it logs, regeneration succeeds, the input code reappears in
  //                     `freshCodes`, and the verdict WAS `engine_regression`
  // The production digest reported `engine_regression`, which only the production posture
  // produces. A test that ran in the default environment would have asserted a verdict the
  // live system never emits. `vi.stubEnv` puts the test on the real path.
  it('🔴 END TO END on the PRODUCTION path: a real input breach becomes `input_breach`', () => {
    vi.stubEnv('NODE_ENV', 'production')
    try {
      // ⚠️ A HALF, NOT THE FILE'S MARATHON FIXTURE. 5 km/week into a marathon is a DESIGNED
      // REFUSAL (`BaseVolumeError`), which the first version of this arm hit — the refusal
      // fired correctly and my test was wrong. The real runner was a half marathon.
      const breaching = {
        ...INPUT, race_distance_km: 21.1, goal: 'finish',
        current_weekly_km: 5, longest_recent_run_km: 6,
        user_declared_level: 'beginner', injury_history: ['knee'],
      } as unknown as GeneratorInput
      const p = generateRulePlan(breaching, 'paid', PINNED_PLAN_START_0907) as Plan
      const meta = p.meta as unknown as Record<string, unknown>
      meta.plan_start = PINNED_PLAN_START_0907
      meta.generated_at = `${PINNED_PLAN_START_0907}T06:00:00.000Z`
      meta.tier = 'paid'

      const r = classifyCodes(p, breaching, ['INV-INPUT-LONGEST-LE-WEEKLY'])
      // 🔴 Before this item it came back `engine_regression` — the one verdict meaning
      // "act on the engine" — which is how the digest recommended a generator fix.
      expect(r.verdicts['INV-INPUT-LONGEST-LE-WEEKLY']).toBe('input_breach')
      expect(r.verdicts['INV-INPUT-LONGEST-LE-WEEKLY']).not.toBe('engine_regression')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('…and a plan-level code in the SAME call is still judged on its own merits', () => {
    // The branch must not swallow everything: only the `INV-INPUT-` prefix diverts.
    vi.stubEnv('NODE_ENV', 'production')
    try {
      const breaching = {
        ...INPUT, race_distance_km: 21.1, goal: 'finish',
        current_weekly_km: 5, longest_recent_run_km: 6,
        user_declared_level: 'beginner', injury_history: ['knee'],
      } as unknown as GeneratorInput
      const p = generateRulePlan(breaching, 'paid', PINNED_PLAN_START_0907) as Plan
      const meta = p.meta as unknown as Record<string, unknown>
      meta.plan_start = PINNED_PLAN_START_0907
      meta.generated_at = `${PINNED_PLAN_START_0907}T06:00:00.000Z`
      meta.tier = 'paid'
      const r = classifyCodes(p, breaching,
        ['INV-INPUT-LONGEST-LE-WEEKLY', 'INV-PLAN-A-RULE-THAT-NOTHING-BREAKS'])
      expect(r.verdicts['INV-INPUT-LONGEST-LE-WEEKLY']).toBe('input_breach')
      expect(r.verdicts['INV-PLAN-A-RULE-THAT-NOTHING-BREAKS']).not.toBe('input_breach')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('🔴 `INV-INPUT-*` is classified `input_breach`, never `engine_regression`', () => {
    // It guards the runner's STATED input, so regenerating from the stored input
    // reproduces it by construction. `engine_regression` is the one verdict meaning
    // "act on the engine", and it was the only one this code could ever receive.
    expect(isInputLevelCode('INV-INPUT-LONGEST-LE-WEEKLY')).toBe(true)
    expect(isInputLevelCode('INV-PLAN-HEADER-PACE-MATCHES-WORK')).toBe(false)
  })

  it('the prefix is the declaration, NOT `week === 0`', () => {
    // ⚠️ 64 invariants use `week: 0` as the plan-wide sentinel, so that number cannot
    // distinguish input-level from plan-wide — it is the collision this item undoes.
    const src = readFileSync(join(process.cwd(), 'lib/plan/invariants.ts'), 'utf8')
    const weekZero = (src.match(/week: 0,/g) ?? []).length
    expect(weekZero, 'the sentinel is shared, so the prefix must stay the discriminator')
      .toBeGreaterThan(10)
  })

  it('the digest sentence names whose number is wrong', () => {
    // The reader acts on the prose. On 2026-10-08 it said "ENGINE REGRESSION ... escalate
    // it" and the recommended fix was aimed at the generator.
    const r = verdictReason({ 'INV-INPUT-LONGEST-LE-WEEKLY': 'input_breach' }, 'comparable')
    expect(r).toMatch(/INPUT BREACH/)
    expect(r).toMatch(/says nothing\s+about the engine/)
    expect(r).toMatch(/NOT clean/)
    expect(r).not.toMatch(/ENGINE REGRESSION/)
  })

  it('…and a co-occurring input breach is appended, never swallowed', () => {
    const r = verdictReason({
      'INV-PLAN-PEAK-OVER-BASE': 'engine_regression',
      'INV-INPUT-LONGEST-LE-WEEKLY': 'input_breach',
    }, 'comparable')
    expect(r).toMatch(/ENGINE REGRESSION/)
    expect(r).toMatch(/Also an INPUT BREACH/)
  })

  it('⚠️ an input breach does NOT page, and is still reported', () => {
    // NOISE-GATE-01: waking someone for a data-entry problem is how this field became
    // unread. But it is not clean either, so it gets its own counter.
    const s = summariseVerdicts([{ 'INV-INPUT-LONGEST-LE-WEEKLY': 'input_breach' }])
    expect(s.actionable).toBe(false)
    expect(s.inputBreaches).toBe(1)
    expect(s.engine_regression).toBe(0)
  })

  it('the tally handles EVERY verdict, enforced by the compiler', () => {
    // `Record<CodeVerdict, number>` is what caught `input_breach` when it was added.
    const s = summariseVerdicts([{ a: 'engine_regression', b: 'rule_newer_than_plan', c: 'undecidable', d: 'input_breach' }])
    expect(s.engine_regression + s.rule_newer_than_plan + s.undecidable + s.input_breach).toBe(4)
  })
})
