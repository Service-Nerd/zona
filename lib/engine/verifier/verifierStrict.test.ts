import { describe, it, expect } from 'vitest'
import { verifyPlan } from './verifyPlan'
import { buildRunnerProfile, factsFromInput } from '@/lib/engine/profile/buildRunnerProfile'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

/**
 * ADR027-B3-STRICT-01 — the Coaching Board's checker fixes, proven ON THE CASE EACH ONE IS ABOUT.
 * Sitting: `docs/decisions/coaching-2026-11-22-b3-raised-list.md` § B.
 *
 * 🔴 WHY THIS FILE EXISTS BESIDE THE AGREEMENT HARNESS, AND WHY A REGISTER ENTRY IS NOT ENOUGH.
 * `verifierAgreement.test.ts` compares the verifier against `validatePlan` over a corpus of real
 * and mutated plans, and `STRICT_DIVERGENCES` declares where they are now meant to differ. That
 * register proves a divergence is REACHED (or honestly declares it latent) — it cannot prove the
 * new predicate is RIGHT, and for a `latent` entry it proves nothing at all, because nothing in
 * that corpus reaches it. **A fix whose only evidence is a declared baseline is an unproven fix**,
 * which is this repo's `an unwakeable check is asking too narrow a question` class: widen the
 * question rather than baseline the silence. So every strict fix gets a case here, built to the
 * condition the board named, asserted in both directions.
 *
 * ⚠️ These plans are HAND-BUILT and deliberately minimal — the point is to reach one condition the
 * generator does not produce, not to be a realistic plan. Anything a generated plan can reach is
 * asserted in the agreement harness instead, where the comparison against `validatePlan` is live.
 */

const INPUT = {
  goal: 'finish', current_weekly_km: 30, longest_recent_run_km: 12, days_available: 4,
  training_age: '2-5yr', age: 38, injury_history: [], race_distance_km: 21.1, race_date: '2027-03-01',
} as unknown as GeneratorInput

const AS_OF = '2026-11-23'
const ctx = (input: GeneratorInput = INPUT) => ({
  input,
  profile: buildRunnerProfile(factsFromInput(input), { asOf: AS_OF, timezone: null, planStart: AS_OF }),
})

const rest = { type: 'rest', label: 'Rest' } as unknown as Session
const sessions = (over: Record<string, unknown>) =>
  ({ mon: rest, tue: rest, wed: rest, thu: rest, fri: rest, sat: rest, sun: rest, ...over }) as never

/** A one-week plan carrying `meta` and one week's sessions. Enough to reach a single predicate. */
const planWith = (meta: Record<string, unknown>, week: Record<string, unknown>): Plan => ({
  meta: { race_distance_km: 21.1, race_date: '2027-03-01', ...meta },
  weeks: [{ n: 1, date: '2026-11-23', label: 'W1', phase: 'base', type: 'build', weekly_km: 30, sessions: sessions({}), ...week }],
} as unknown as Plan)

const findings = (p: Plan, rule: string, input?: GeneratorInput) =>
  verifyPlan(p, ctx(input)).filter(f => f.rule_id === rule)

describe('B2 — §9 has no race-week exemption from being EMPTY', () => {
  const RULE = 'INV-PLAN-EMPTY-SESSION'
  const empty = (type: string, label: string) =>
    ({ type, label, distance_km: 0, duration_mins: 0 }) as unknown as Session

  it('🔴 an EMPTY race-week easy run is flagged, where validatePlan exempts it from the size loop', () => {
    const p = planWith({}, { type: 'race', sessions: sessions({ tue: empty('easy', 'Easy run') }) })
    expect(findings(p, RULE).map(f => f.day)).toContain('tue')
  })

  it('🔴 an EMPTY shakeout is flagged, in race week and out of it', () => {
    const shake = empty('easy', 'Shakeout')
    for (const weekType of ['race', 'build']) {
      const p = planWith({}, { type: weekType, sessions: sessions({ fri: shake }) })
      expect(findings(p, RULE).map(f => f.day), `week type ${weekType}`).toContain('fri')
    }
  })

  it('a race-week easy run that is SHORT but not empty is still silent — the floor exemption is intact', () => {
    // The ruling narrows the EMPTY check only. §9's size floor legitimately does not govern a
    // race-week easy run, and widening that too would be a prescription change nobody ruled.
    const p = planWith({}, { type: 'race', sessions: sessions({ tue: { type: 'easy', label: 'Easy run', distance_km: 1, duration_mins: 6 } as unknown as Session }) })
    expect(findings(p, RULE)).toEqual([])
  })

  it('the RACE itself stays exempt, which the ruling does not name', () => {
    const p = planWith({}, { type: 'race', sessions: sessions({ sun: empty('race', 'Race day') }) })
    expect(findings(p, RULE)).toEqual([])
  })
})

describe('B7 — NO-INVENTED-AGE is one finding per plan, not one per week', () => {
  const RULE = 'INV-PLAN-NO-INVENTED-AGE'
  const noAge = { ...(INPUT as unknown as Record<string, unknown>) }
  delete noAge.age
  const INPUT_NO_AGE = noAge as unknown as GeneratorInput

  it('🔴 a fifteen-week plan recording an age its input never carried reports it ONCE', () => {
    const weeks = Array.from({ length: 15 }, (_, i) => ({
      n: i + 1, date: '2026-11-23', label: `W${i + 1}`, phase: 'base', type: 'build', weekly_km: 30, sessions: sessions({}),
    }))
    const p = { meta: { race_distance_km: 21.1, race_date: '2027-03-01', age: 38 }, weeks } as unknown as Plan
    const out = findings(p, RULE, INPUT_NO_AGE)
    // ⚠️ "once per plan" means once per CONDITION, not one finding in total — and my first
    // assertion here said `toBe(1)` and failed on a correct fix. This plan trips two distinct
    // conditions (meta carries an age the input did not, AND there is no assumption note), which
    // are two different facts about the runner. The defect was the same fact fifteen times.
    const byDetail = out.reduce((m, f) => m.set(f.detail, (m.get(f.detail) ?? 0) + 1), new Map<string, number>())
    expect(Array.from(byDetail.values()), `15 weeks, details: ${Array.from(byDetail.keys()).join(' | ')}`)
      .toEqual(Array.from(byDetail.values()).map(() => 1))
    expect(byDetail.size, 'both conditions of this plan should be reported').toBe(2)
  })

  it('a plan with NO governed week stays silent, so the gate is still the gate', () => {
    // `plan.weeks.some(governed)` is kept, not deleted: a pure maintenance plan was silent before
    // the fix and must stay silent after it.
    const p = { meta: { race_distance_km: 21.1, race_date: '2027-03-01', age: 38 },
      weeks: [{ n: 1, date: '2026-11-23', label: 'M1', phase: 'maintenance_base', type: 'build', weekly_km: 30, sessions: sessions({}) }] } as unknown as Plan
    expect(findings(p, RULE, INPUT_NO_AGE)).toEqual([])
  })
})

describe('B8 — an empty prep_time_alternatives list is no alternatives', () => {
  const RULE = 'INV-PLAN-PREP-TIME-STATUS-ANNOTATED'
  const warned = (alts: unknown) => planWith(
    { prep_time_status: 'warned', prep_time_warning: 'Your race is sooner than ideal.', prep_time_alternatives: alts }, {})

  it('🔴 an EMPTY list is flagged, where validatePlan passes it because [] is truthy', () => {
    const out = findings(warned([]), RULE)
    expect(out.map(f => f.detail)).toContain('warned without its alternatives')
  })

  it('a list with an alternative in it is silent', () => {
    expect(findings(warned(['A 16-week plan for a later race']), RULE)).toEqual([])
  })

  it('and an ABSENT list is still flagged, as it was before the fix', () => {
    // The fix must not trade one blind spot for another: `undefined` was already caught and stays
    // caught. `?.length` is nullish-safe for exactly this reason.
    const out = findings(warned(undefined), RULE)
    expect(out.map(f => f.detail)).toContain('warned without its alternatives')
  })
})
