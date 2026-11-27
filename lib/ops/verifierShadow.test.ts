import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  shadowAsOf, verifierContextFor, shadowVerifyPlan, summariseVerifierShadow, type ShadowRow,
} from './verifierShadow'
import { validateStoredPlan } from '@/lib/plan/validateStoredPlan'
import { rulesFor, verifyPlan, PREDICATES } from '@/lib/engine/verifier/verifyPlan'
import type { Plan, Session } from '@/types/plan'
import type { RuleId } from '@/lib/engine/contracts/rule'
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
    const judged = rulesFor(plan, 'stored') as unknown as string[]
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
    const judged = rulesFor(plan, 'stored') as unknown as string[]
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
    const errored = verifyPlan(plan, verifierContextFor(plan, GENERATED), 'stored')
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

  it('🔴 a rule the BASELINE drops is not judged at all under the stored policy, and IS under the saved one', () => {
    // ⚠️ TWO LESSONS LIVE IN THIS CASE, BOTH PAID FOR.
    // (1) It once read `if (strictOnlyOf(plan).includes(rule))` — and the exempt rules are excluded
    //     from `strict_only` by construction, so the condition could never be true and the assertion
    //     inside it never ran once. An allow-by-default arm is not a check.
    // (2) Since `VERIFIER-RESHAPE-POLICY-01` the verifier has the baseline's own policy, so the
    //     bucket is EMPTY rather than full — and an empty bucket is exactly what a rule that never
    //     fires looks like. So the `saved` half is asserted beside it: the rule still exists, still
    //     fires on this plan, and the POLICY is what suppresses it. Without that half this case
    //     would pass against a verifier that had simply lost the rule.
    const plan = storedPlan()
    const row = shadowVerifyPlan(plan, [], null)
    if (!row.assessed) throw new Error('fixture should be assessable')
    expect(row.reshape_exempt, 'the stored policy does not judge it, so there is nothing to bucket').toEqual([])
    for (const rule of Array.from(RESHAPE_SKIP_INVARIANTS)) {
      expect(row.strict_only).not.toContain(rule)
    }
    // THE OTHER HALF: the same plan, judged as the SAVE path judges it, does report the rule.
    const asOf = shadowAsOf(plan, null)
    if (!asOf) throw new Error('fixture should carry a generation date')
    const saved = verifyPlan(plan, verifierContextFor(plan, asOf), 'saved').map(f => f.rule_id as string)
    expect(saved, 'the rule exists and this plan breaches it: only the policy hides it').toContain('INV-PLAN-COVERS-RACE-DATE')
    // The set is READ from the owner (now the catalogue's `skipped_by`), so this cannot pass against a copy.
    expect(RESHAPE_SKIP_INVARIANTS.has('INV-PLAN-COVERS-RACE-DATE')).toBe(true)
  })

  it('🔴 and `rulesFor` is where the policy lives, so the two halves cannot be answered differently', () => {
    // The seam is in ONE owner, as `validateStoredPlan.ts` keeps the kind dispatch and the strictness
    // together. If a future caller filters findings itself instead, this is the arm that notices.
    const plan = storedPlan()
    const stored = rulesFor(plan, 'stored') as unknown as string[]
    const saved = rulesFor(plan, 'saved') as unknown as string[]
    expect(saved).toContain('INV-PLAN-COVERS-RACE-DATE')
    expect(stored).not.toContain('INV-PLAN-COVERS-RACE-DATE')
    expect(saved.filter(r => !stored.includes(r)).sort(), 'exactly the catalogue\'s skipped set, no more')
      .toEqual(Array.from(RESHAPE_SKIP_INVARIANTS).sort())
    expect(rulesFor(plan, 'repaired') as unknown as string[], 'a repair script is strict, like the save path').toEqual(saved)
  })

  it('level_mismatch is false when meta carries no level to disagree with', () => {
    const row = shadowVerifyPlan(storedPlan({ fitness_intensity_level: undefined }), [], null)
    if (!row.assessed) throw new Error('fixture should be assessable')
    expect(row.level_mismatch).toBe(false)
  })

  it('✅ a §79-SPLIT plan no longer mismatches — the profile reproduces the level it was built at', () => {
    // 🔴 THIS CASE USED TO ASSERT `true`, AND IT WAS PINNING THE DEFECT. `VERIFIER-STORED-LEVEL-01`:
    // `resolveLevels` read `input.fitness_level ?? assessed.intensity`, so the API STRUCTURAL
    // override won the INTENSITY band and a §79-elevated stored plan re-derived as a beginner. It
    // reads `input.fitness_intensity_level` first now, which `storedPlanInput` carries for exactly
    // this, so this plan is judged at `intermediate` as it was built. Measured: 10 of 44 live plans
    // carry this split and the fleet's `plans_level_mismatch` goes 1 → 0.
    const row = shadowVerifyPlan(
      storedPlan({ fitness_level: 'beginner', fitness_intensity_level: 'intermediate' }), [], null)
    if (!row.assessed) throw new Error('fixture should be assessable')
    expect(row.level_mismatch, 'the split is reproduced, so there is nothing to flag').toBe(false)
  })

  it('🔴 but level_mismatch is NOT dead: a plan whose own levels contradict each other still fires it', () => {
    // ⚠️ A FLAG THAT NEVER FIRES AND A FLAG THAT CANNOT FIRE LOOK IDENTICAL, which is why this case
    // exists beside the one above rather than instead of it. The flag's job is unchanged: say when
    // the profile cannot reproduce the level a plan claims. After the fix the way to reach that is a
    // plan whose stamped DECLARATION disagrees with its stamped intensity level — `intensity` is
    // `declared ?? assessedIntensity`, so the declaration wins and the claim is not reproduced.
    // That is a genuinely self-inconsistent plan, and it is exactly what the flag should catch.
    const row = shadowVerifyPlan(
      storedPlan({ fitness_level: 'beginner', fitness_intensity_level: 'intermediate',
        fitness_level_declared: 'experienced' }), [], null)
    if (!row.assessed) throw new Error('fixture should be assessable')
    expect(row.level_mismatch, 'declared experienced against a stamped intermediate intensity').toBe(true)
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
    unverified_only: [],
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

describe('ENGINE-CONTRACT-V2-COVERAGE-01 — a predicate that CANNOT evaluate is counted, end to end', () => {
  /**
   * 🔴 THE ARM THAT WOULD HAVE CAUGHT THE DEFECT, and it has to be BEHAVIOURAL.
   *
   * `verifyPlan` writes a crashed predicate's detail with `UNVERIFIED_PREFIX`; this module counted them
   * with its OWN `startsWith('unverified:')`. Two copies of one convention, no gate, and the failure is
   * silent in the worst direction: reword the message and the nightly run reports **0 unverified** for
   * ever, which reads as *"every rule evaluated cleanly"* — **on the number that goes to the founder with
   * the cut-over request.** Found writing `docs/contracts/engine.md § L5`, 2026-11-26.
   *
   * ⚠️ A SOURCE ASSERTION WAS NOT ENOUGH (`engineContractV2.test.ts` has one, deliberately kept as the
   * cheap tripwire). This exercises the real composition: make a real predicate throw, run the real
   * shadow, and read the real count. **Test the composition, not the halves.**
   */
  it('🔴 a throwing predicate reaches `unverified`, through the owner\'s prefix', () => {
    // ⚠️ THE VICTIM IS CHOSEN FROM `rulesFor`, NOT `Object.keys(PREDICATES)[0]`. The first cut took index
    // 0, which depends on batch literal order AND on that rule surviving the `'stored'` policy — so a
    // harmless reorder would have failed this as *"the planted crash was not counted"*, pointing at the
    // consumer instead of at the choice. Code review. **A bad victim now fails as a bad victim.**
    const plan = storedPlan()
    const judged = rulesFor(plan, 'stored')
    expect(judged.length, 'no rule judges the fixture — the victim choice below is meaningless').toBeGreaterThan(0)
    const victim = judged.find(r => PREDICATES[r])!
    expect(victim, 'no judged rule has a predicate to sabotage').toBeTruthy()
    const original = PREDICATES[victim]
    try {
      PREDICATES[victim] = () => { throw new Error('planted') }
      const row = shadowVerifyPlan(plan, [], `${GENERATED}T00:00:00Z`)
      expect(row.assessed, 'the plan must still be assessed: one bad predicate never ends the run').toBe(true)
      if (!row.assessed) return
      expect(row.unverified, 'the planted crash was not counted').toBeGreaterThanOrEqual(1)
      // 🔴 THIS ARM ASSERTED THE DEFECT AS DESIRED BEHAVIOUR WHEN I WROTE IT ON 2026-11-26. It read
      // `expect(row.strict_only).toContain(victim)`, with the comment *"an unverified rule reads as
      // a plan gaining a code"* — calling the collision LOUD and correct. It is neither:
      // `strict_only` is THE cut-over number, *"rules the verifier fires that the old checker does
      // not"*, and a rule that could not evaluate has not fired. Counting a decline there inflates
      // the figure a founder reads AND hides the opposite case, where the old checker HAD a verdict
      // (`VERIFIER-UNVERIFIED-KEY-COLLISION-01`).
      expect(row.unverified_only, 'a decline belongs in its own bucket').toContain(victim)
      expect(row.strict_only, 'a decline is NOT a rule the verifier fired').not.toContain(victim)
    } finally {
      if (original) PREDICATES[victim] = original; else delete PREDICATES[victim]
    }
  })

  it('🔴 and a REAL old finding replaced by a decline is counted as LOST — the collision itself', () => {
    // 📐 THE DIRECTION THAT WAS INVISIBLE, and the one the cut-over figure rests on. `lost` joined on
    // rule id against a population that INCLUDED unverified findings, so a rule whose real finding
    // became "could not evaluate" was still "present in next" and counted as neither lost nor
    // gained. `plans_lost: 0` and `lost_by_rule: {}` over 44 live plans are quoted in ADR-027, the
    // feature registry and three state blocks as the evidence the verifier loses nothing.
    //
    // 📐 Measured in the agreement harness before the fix: **20 unverified findings over 1,470
    // cases from 2 rules, 4 of them this exact swap**, all four green.
    const plan = storedPlan()
    const judged = rulesFor(plan, 'stored')
    const victim = judged.find(r => PREDICATES[r])!
    const original = PREDICATES[victim]
    try {
      PREDICATES[victim] = () => { throw new Error('planted') }
      // The old checker reported a REAL finding for the same rule.
      const oldViolation = [{ code: victim, severity: 'error', week: 1, day: null, message: 'real' }]
      const row = shadowVerifyPlan(plan, oldViolation as never, `${GENERATED}T00:00:00Z`)
      expect(row.assessed).toBe(true)
      if (!row.assessed) return
      expect(row.lost, 'a real finding replaced by a decline is a LOSS').toContain(victim)
      expect(row.unverified_only, 'and the decline is named, so the loss has a reason').toContain(victim)
      expect(row.escalated, 'a decline is not an escalation either').not.toContain(victim)
    } finally {
      if (original) PREDICATES[victim] = original; else delete PREDICATES[victim]
    }
  })

  it('🔴 the summary AGGREGATES the decline, because a per-row field nobody sums is invisible', () => {
    // The shape of this whole item: the per-row data was there to be read and the figure a founder
    // reads did not read it. `plans_unverified_only` sits beside `plans_lost` for that reason.
    const plan = storedPlan()
    const judged = rulesFor(plan, 'stored')
    const victim = judged.find(r => PREDICATES[r])!
    const original = PREDICATES[victim]
    try {
      PREDICATES[victim] = () => { throw new Error('planted') }
      const summary = summariseVerifierShadow([shadowVerifyPlan(plan, [], `${GENERATED}T00:00:00Z`)])
      expect(summary.plans_unverified_only, 'the decline never reached the summary').toBe(1)
      expect(summary.unverified_only_by_rule[victim], 'and it is attributed to its rule').toBe(1)
      // ⚠️ NOT `plans_strict_only === 0`: the fixture legitimately gains other codes, and asserting
      // the total would have failed for a reason that has nothing to do with this item. The precise
      // claim is that the DECLINED rule is not among them.
      expect(summary.strict_only_by_rule[victim], 'the declined rule must not count as a gain').toBeUndefined()
    } finally {
      if (original) PREDICATES[victim] = original; else delete PREDICATES[victim]
    }
  })

  it('🔻 `unverified_only` and `unverified` agree by CONSTRUCTION, and the arm says so', () => {
    // Code review: the `!verdictRules.has(r)` filter in `unverified_only` can never remove anything,
    // because `verifyPlan`'s catch replaces a rule's whole result with one decline — so a rule has
    // verdicts or exactly one decline, never both. The filter is kept for the day that changes, and
    // this arm is what makes that day loud instead of silent.
    const plan = storedPlan()
    const judged = rulesFor(plan, 'stored')
    const victim = judged.find(r => PREDICATES[r])!
    const original = PREDICATES[victim]
    try {
      PREDICATES[victim] = () => { throw new Error('planted') }
      const row = shadowVerifyPlan(plan, [], `${GENERATED}T00:00:00Z`)
      expect(row.assessed).toBe(true)
      if (!row.assessed) return
      expect(row.unverified_only.length, 'a decline never coexists with a verdict for the same rule')
        .toBe(row.unverified)
    } finally {
      if (original) PREDICATES[victim] = original; else delete PREDICATES[victim]
    }
  })

  it('and with every predicate healthy the count is zero, so the arm above is not always-true', () => {
    // Falsification runs both ways: a counter that always returns >= 1 would pass the arm above.
    const row = shadowVerifyPlan(storedPlan(), [], `${GENERATED}T00:00:00Z`)
    expect(row.assessed).toBe(true)
    if (row.assessed) expect(row.unverified).toBe(0)
  })
})
