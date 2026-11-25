import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  shadowAsOf, verifierContextFor, shadowVerifyPlan, summariseVerifierShadow, type ShadowRow,
} from './verifierShadow'
import { validateStoredPlan } from '@/lib/plan/validateStoredPlan'
import { rulesFor, verifyPlan } from '@/lib/engine/verifier/verifyPlan'
import type { Plan, Session } from '@/types/plan'
import { RESHAPE_SKIP_INVARIANTS, type Violation } from '@/lib/plan/invariants'

/**
 * ADR-027 B3 step 3 — the live-plan shadow run.
 *
 * ⚠️ WHAT THIS FILE IS FOR. The number this module produces goes to the founder with the
 * cut-over request, so the failure that matters is not a crash: it is a number that looks like
 * a measurement and is not one. Two ways that happens, and each has cases below —
 *   (1) the profile is built from the CLOCK rather than the plan's generation date, so §10's
 *       staleness ramp silently moves the level and the divergence is the ramp's, not the rules';
 *   (2) a plan that cannot be assessed is folded into the clean total, so absence reads as
 *       agreement.
 */

const GENERATED = '2026-09-10'
const rest = { type: 'rest', label: 'Rest' } as unknown as Session
const sessions = (over: Record<string, unknown> = {}) =>
  ({ mon: rest, tue: rest, wed: rest, thu: rest, fri: rest, sat: rest, sun: rest, ...over }) as never

/** A minimal STORED plan: the shape the audit reads out of `plans.plan_json`. */
const storedPlan = (meta: Record<string, unknown> = {}, week: Record<string, unknown> = {}): Plan => ({
  meta: {
    race_distance_km: 21.1, race_date: '2027-03-01', plan_start: '2026-09-14',
    generated_at: `${GENERATED}T08:30:00.000Z`,
    generator_input: {
      goal: 'finish', current_weekly_km: 30, longest_recent_run_km: 12, days_available: 4,
      training_age: '2-5yr', age: 38, injury_history: [], days_cannot_train: [],
      race_distance_km: 21.1, race_date: '2027-03-01',
    },
    ...meta,
  },
  weeks: [{
    n: 1, date: '2026-09-14', label: 'W1', phase: 'base', type: 'build', weekly_km: 30,
    sessions: sessions(), ...week,
  }],
} as unknown as Plan)

const v = (code: string, severity: 'error' | 'warn' = 'error'): Violation =>
  ({ code, severity, week: 1, message: code, principle_ref: '§x', actual: 0, expected: 0 }) as Violation

afterEach(() => vi.useRealTimers())

describe('shadowAsOf — the plan says when it was built, or nothing does', () => {
  it('prefers meta.generated_at', () => {
    expect(shadowAsOf(storedPlan(), '2026-11-25T00:00:00Z')).toBe(GENERATED)
  })

  it('falls back to the row created_at — the row was inserted at generation', () => {
    const p = storedPlan({ generated_at: undefined })
    expect(shadowAsOf(p, '2026-07-01T10:00:00Z')).toBe('2026-07-01')
  })

  it('🔴 returns null when the plan cannot say, rather than reaching for today', () => {
    const p = storedPlan({ generated_at: undefined })
    expect(shadowAsOf(p, null)).toBeNull()
  })

  it('🔴 a truncated timestamp is not a date — absence must not be written as a value', () => {
    expect(shadowAsOf(storedPlan({ generated_at: '2026' }), null)).toBeNull()
  })
})

describe('verifierContextFor — as of the GENERATION date, never the clock', () => {
  it('🔴 the profile is dated by the plan, and a clock eleven weeks later does not move it', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-25T12:00:00Z'))
    const ctx = verifierContextFor(storedPlan(), GENERATED)
    // Falsified by passing `new Date()` in place of `asOf`: this reads 2026-11-25.
    expect(ctx.profile.as_of).toBe(GENERATED)
  })

  it('carries the plan start, so week-dated rules are judged against the plan the runner holds', () => {
    const ctx = verifierContextFor(storedPlan(), GENERATED)
    expect(ctx.input.race_distance_km).toBe(21.1)
    expect(ctx.profile.race.date).toBe('2027-03-01')
  })
})

describe('shadowVerifyPlan — the join, and what it refuses to assess', () => {
  it('🔴 an unassessable plan is NAMED, never counted clean', () => {
    const row = shadowVerifyPlan(storedPlan({ generated_at: undefined }), [], null)
    expect(row).toEqual({ assessed: false, reason: 'no_generation_date' })
  })

  it('a rule the OLD checker already reports is not a strict reading', () => {
    const plan = storedPlan()
    const judged = rulesFor(plan) as unknown as string[]
    // The composition the route performs: the producer's own full list, every severity.
    const old = validateStoredPlan(plan)
    const row = shadowVerifyPlan(plan, old, null)
    if (!row.assessed) throw new Error('fixture should be assessable')
    for (const rule of row.strict_only) {
      expect(old.map(o => o.code)).not.toContain(rule)
      expect(judged).toContain(rule)
    }
  })

  it('🔴 a finding the verifier makes and the old checker does not is reported as strict_only', () => {
    const plan = storedPlan()
    const row = shadowVerifyPlan(plan, [], null)
    if (!row.assessed) throw new Error('fixture should be assessable')
    // With NO old violations supplied, every rule the verifier fires is new by construction.
    expect(row.new_findings).toBeGreaterThan(0)
    expect(row.strict_only.length).toBeGreaterThan(0)
    expect(row.lost).toEqual([])
  })

  it('🔴 a finding the OLD checker makes and the verifier does not is reported as lost', () => {
    const plan = storedPlan()
    const judged = rulesFor(plan) as unknown as string[]
    const quiet = judged.filter(r => !strictOnlyOf(plan).includes(r))
    expect(quiet.length).toBeGreaterThan(0)
    const row = shadowVerifyPlan(plan, [v(quiet[0])], null)
    if (!row.assessed) throw new Error('fixture should be assessable')
    expect(row.lost).toContain(quiet[0])
  })

  it('warn -> error on the same rule is an ESCALATION, not a new code', () => {
    const plan = storedPlan()
    // Any rule the verifier fires at ERROR severity: an escalation needs warn -> error, so a
    // warn-severity rule could not reach the branch and would make this case vacuous.
    const errored = verifyPlan(plan, verifierContextFor(plan, GENERATED))
      .find(f => f.severity === 'error' && strictOnlyOf(plan).includes(f.rule_id as string))
      ?.rule_id as string | undefined
    expect(errored).toBeTruthy()
    const row = shadowVerifyPlan(plan, [v(errored!, 'warn')], null)
    if (!row.assessed) throw new Error('fixture should be assessable')
    expect(row.escalated).toContain(errored)
    expect(row.strict_only).not.toContain(errored)
  })

  it('🔴 instance counts read the SAME judged population as the totals', () => {
    const plan = storedPlan()
    const row = shadowVerifyPlan(plan, [], null)
    if (!row.assessed) throw new Error('fixture should be assessable')
    const summed = Object.values(row.instances).reduce((n, [a]) => n + a, 0)
    expect(summed).toBe(row.new_findings)
    const old = validateStoredPlan(plan)
    const row2 = shadowVerifyPlan(plan, old, null)
    if (!row2.assessed) throw new Error('fixture should be assessable')
    expect(Object.values(row2.instances).reduce((n, [, b]) => n + b, 0)).toBe(row2.old_findings)
  })

  it('🔴 a rule the BASELINE cannot report is never a strict reading, and is never dropped', () => {
    // ⚠️ THIS CASE HAD AN UNREACHABLE GUARD AND A MUTATION THAT DELETED THE BUCKET STAYED GREEN.
    // It read `if (strictOnlyOf(plan).includes(rule))` — and the exempt rules are excluded from
    // `strict_only` by construction, so the condition was always false and the assertion inside
    // it never ran. An allow-by-default arm is not a check. Asserted unconditionally now, on a
    // fixture whose final week genuinely does not contain its race date.
    const plan = storedPlan()
    const row = shadowVerifyPlan(plan, [], null)
    if (!row.assessed) throw new Error('fixture should be assessable')
    expect(row.reshape_exempt).toContain('INV-PLAN-COVERS-RACE-DATE')
    for (const rule of Array.from(RESHAPE_SKIP_INVARIANTS)) {
      expect(row.strict_only).not.toContain(rule)
    }
    // The set is READ from the owner, so this case cannot pass against a stale local copy.
    expect(RESHAPE_SKIP_INVARIANTS.has('INV-PLAN-COVERS-RACE-DATE')).toBe(true)
  })

  it('level_mismatch is false when meta carries no level to disagree with', () => {
    const row = shadowVerifyPlan(storedPlan({ fitness_intensity_level: undefined }), [], null)
    if (!row.assessed) throw new Error('fixture should be assessable')
    expect(row.level_mismatch).toBe(false)
  })

  it('🔴 level_mismatch fires when the profile re-derives a level the plan was not built at', () => {
    // The live shape: meta says §79 elevated this runner, the profile re-derives the structural
    // level because `fitness_level` wins the intensity band (fitnessAssessment.ts:201).
    const row = shadowVerifyPlan(
      storedPlan({ fitness_level: 'beginner', fitness_intensity_level: 'intermediate' }), [], null)
    if (!row.assessed) throw new Error('fixture should be assessable')
    expect(row.level_mismatch).toBe(true)
  })

  it('🔴 an unported invariant is OUT of the population, not a lost finding', () => {
    const plan = storedPlan()
    const row = shadowVerifyPlan(plan, [v('INV-PLAN-NOT-A-PORTED-RULE')], null)
    if (!row.assessed) throw new Error('fixture should be assessable')
    expect(row.lost).not.toContain('INV-PLAN-NOT-A-PORTED-RULE')
    expect(row.old_findings).toBe(0)
  })
})

/**
 * The rules the verifier fires on a fixture against an EMPTY baseline — so every judged rule it
 * fires lands in `strict_only`, bar the reshape-exempt ones.
 *
 * ⚠️ NOT "everything the verifier fires": the exempt rules are filtered before this bucket, which
 * is precisely why the case above must name one of them rather than ask this helper.
 */
function strictOnlyOf(plan: Plan): string[] {
  const row = shadowVerifyPlan(plan, [], null)
  if (!row.assessed) throw new Error('fixture should be assessable')
  return row.strict_only
}

describe('summariseVerifierShadow — the figure a founder reads', () => {
  const done = (over: Partial<Extract<ShadowRow, { assessed: true }>> = {}): ShadowRow => ({
    assessed: true, strict_only: [], reshape_exempt: [], escalated: [], lost: [],
    new_findings: 0, old_findings: 0, unverified: 0, level_mismatch: false, instances: {}, ...over,
  })

  it('counts PLANS, not findings', () => {
    const s = summariseVerifierShadow([
      done({ strict_only: ['A', 'B'] }),
      done({ strict_only: ['A'] }),
      done(),
    ])
    expect(s.plans_strict_only).toBe(2)
    expect(s.strict_only_by_rule).toEqual({ A: 2, B: 1 })
    expect(s.assessed).toBe(3)
  })

  it('🔴 not_assessed is ABSENT when everything was assessed, never present-and-zero', () => {
    expect(summariseVerifierShadow([done()]).not_assessed).toBeUndefined()
  })

  it('🔴 an unassessed plan is reported with its reason and is NOT in `assessed`', () => {
    const s = summariseVerifierShadow([
      done(), { assessed: false, reason: 'no_generation_date' }, { assessed: false, reason: 'verifier_threw' },
    ])
    expect(s.assessed).toBe(1)
    expect(s.not_assessed).toEqual({ no_generation_date: 1, verifier_threw: 1 })
  })

  it('🔴 a reshape-exempt rule is its own number, counted in neither strict_only nor silence', () => {
    const s = summariseVerifierShadow([
      done({ reshape_exempt: ['INV-PLAN-COVERS-RACE-DATE', 'INV-PLAN-RACE-ON-RACE-DAY'] }),
      done({ reshape_exempt: ['INV-PLAN-COVERS-RACE-DATE'], strict_only: ['X'] }),
    ])
    expect(s.plans_reshape_exempt).toBe(2)
    expect(s.plans_strict_only).toBe(1)
    expect(s.reshape_exempt_by_rule).toEqual({
      'INV-PLAN-COVERS-RACE-DATE': 2, 'INV-PLAN-RACE-ON-RACE-DAY': 1,
    })
  })

  it('🔴 a level-dependent hit on a level-mismatched plan is ATTRIBUTABLE, not buried', () => {
    const s = summariseVerifierShadow([
      done({ strict_only: ['INV-PLAN-QUALITY-PER-WEEK'], level_mismatch: true }),
      done({ strict_only: ['Y'] }),
      done({ level_mismatch: true }),
    ])
    expect(s.plans_strict_only).toBe(2)
    expect(s.plans_level_mismatch).toBe(2)
    // The subtraction a reader needs: one of the two strict-only plans is not comparable.
    expect(s.plans_strict_only_level_mismatch).toBe(1)
  })

  it('carries the totals, so a change WITHIN a rule is not invisible to the rule-id join', () => {
    const s = summariseVerifierShadow([done({ new_findings: 9, old_findings: 4, unverified: 2 })])
    expect(s).toMatchObject({ new_findings: 9, old_findings: 4, unverified: 2 })
  })

  it('🔴 two within-rule deltas that CANCEL in the total are each named per rule', () => {
    // The live shape that made this field necessary: +8 on one rule, -24 on another, summing to
    // a `+2` total that reads as noise. Both change the rule's reach and neither changes a code.
    const s = summariseVerifierShadow([
      done({ instances: { SPACED: [16, 8], AGE: [1, 25], QUIET: [3, 3] } }),
    ])
    expect(s.rules_fired).toBe(3)
    expect(s.rules_same_instances).toBe(1)
    expect(s.instance_delta_by_rule).toEqual({ AGE: [1, 25], SPACED: [16, 8] })
    // The identical rule is COUNTED, never listed: the payload says what moved.
    expect(s.instance_delta_by_rule.QUIET).toBeUndefined()
  })

  it('instance counts are summed ACROSS plans before the comparison', () => {
    const s = summariseVerifierShadow([
      done({ instances: { R: [2, 1] } }),
      done({ instances: { R: [1, 2] } }),
    ])
    // 3 vs 3 fleet-wide: no delta, although each plan differs. The fleet figure is the claim.
    expect(s.instance_delta_by_rule).toEqual({})
    expect(s.rules_same_instances).toBe(1)
  })

  it('an empty run summarises to zeros rather than throwing', () => {
    expect(summariseVerifierShadow([])).toMatchObject({ assessed: 0, plans_strict_only: 0 })
  })
})

describe('🔴 OBSERVE-ONLY — the shadow cannot reach the audit alert', () => {
  // ⚠️ STRUCTURAL, and stated as such. The behavioural half is upstream: this module is pure and
  // returns only its own fields, so it has no path to `ops_events` or to the per-user code set.
  // What a source read adds is the route's wiring — that the row it produces is not folded into
  // `codes`, `codesThisRun` or `repairableRows`, each of which feeds the transition alert.
  const src = () => require('node:fs').readFileSync('app/api/ops/plan-audit/route.ts', 'utf8') as string

  it('the audit route collects the shadow row into its own array and reads it once', () => {
    // ⚠️ NOT a count of occurrences. A tally fires on the word appearing in a COMMENT, which is
    // `HOOK-RGBA-COMMENTS-01` and is how a guard that fires on correct writing gets deleted.
    // These are the two statements that matter: the only write, and the only read.
    const s = src()
    expect(s).toMatch(/shadowRows\.push\(shadowVerifyPlan\(plan, all, row\.created_at as string \| null\)\)/)
    expect(s).toMatch(/summariseVerifierShadow\(shadowRows\)/)
    // No OTHER call takes it: nothing may pass it on to a writer.
    const calls = s.match(/[A-Za-z_$][\w$]*\(\s*shadowRows\s*\)/g) ?? []
    expect(calls).toEqual(['summariseVerifierShadow(shadowRows)'])
  })

  it('the per-user alert set is not built from anything the shadow produced', () => {
    const s = src()
    expect(s).toMatch(/const codes = storedPlanCodes\(plan as never, errors\.map\(v => v\.code\)\)/)
    expect(s).not.toMatch(/codesThisRun\.push\([^)]*shadow/i)
    expect(s).not.toMatch(/storedPlanCodes\([^)]*shadow/i)
  })

  it('the shadow summary is recorded under a source neither consumer reads', () => {
    const s = src()
    expect(s).toMatch(/source: 'plan-audit-verifier-shadow'/)
    // The two readers, unchanged: the per-user dedupe and the fleet step.
    expect(s).toMatch(/if \(d\.source !== 'plan-audit'\) continue/)
    expect(s).toMatch(/d\.source === 'plan-audit-summary'/)
  })
})
