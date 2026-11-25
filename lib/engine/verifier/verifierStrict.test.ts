import { describe, it, expect } from 'vitest'
import { verifyPlan } from './verifyPlan'
import { buildRunnerProfile, factsFromInput } from '@/lib/engine/profile/buildRunnerProfile'
import { V1_SESSION_CATALOGUE } from '@/lib/plan/sessionCatalogueData'
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

describe('B3 — the two largest sessions, ranked in one unit and skipping every deload', () => {
  const RULE = 'INV-PLAN-LARGEST-SESSIONS-SPACED'
  const run = (over: Record<string, unknown>) => ({ type: 'easy', label: 'Easy run', ...over }) as unknown as Session

  it('🔴 a 10 km run outranks a 40-minute easy run — km and minutes are not the same quantity', () => {
    // `validatePlan` ranks on `distance_km ?? duration_mins ?? 0`, so 40 (minutes) beat 10 (km) and
    // the "two largest" were the two biggest NUMBERS. Here the 10 km run and the 12 km run are the
    // real top two and they sit one day apart, which the old ranking could not see.
    const p = planWith({}, { sessions: sessions({
      mon: run({ distance_km: 10, duration_mins: 55, pace_target: '5:30-6:00 /km' }),
      tue: run({ distance_km: 12, duration_mins: 66, pace_target: '5:30-6:00 /km' }),
      thu: run({ duration_mins: 40, pace_target: '5:30-6:00 /km' }),
    }) })
    const out = findings(p, RULE)
    expect(out.length, 'the two biggest SESSIONS are mon and tue, one day apart').toBe(1)
  })

  it('🔴 a BADGE-ONLY deload is skipped, as every other deload rule here already does', () => {
    // The corpus cannot reach this: it holds no badge-only deload week, so the agreement harness
    // is green either way and only a direct case proves it. `w.type` is NOT 'deload'; the week is
    // marked by its badge, and `isDeloadWeek` is the owner that reads both.
    const close = sessions({
      mon: run({ distance_km: 12, duration_mins: 66, pace_target: '5:30-6:00 /km' }),
      tue: run({ distance_km: 10, duration_mins: 55, pace_target: '5:30-6:00 /km' }),
    })
    const ordinary = planWith({}, { type: 'build', sessions: close })
    expect(findings(ordinary, RULE).length, 'an ordinary week with two big sessions adjacent should fire').toBe(1)
    // The field is `badge`, read from the verifier's own predicate (`w.type === 'deload' ||
    // w.badge === 'deload'`) rather than guessed — my first attempt invented `is_deload`.
    const badgeOnly = planWith({}, { type: 'build', badge: 'deload', sessions: close })
    expect(findings(badgeOnly, RULE), 'a badge-only deload must be skipped').toEqual([])
  })
})

describe('B5 — every long run, and an unpriceable one is unverified rather than zero', () => {
  const RULE = 'INV-PLAN-LONGEST-RUN-NOT-IN-BASE'
  const long = (over: Record<string, unknown>) =>
    ({ type: 'easy', role: 'long_run', label: 'Long run', pace_target: '6:00-6:30 /km', ...over }) as unknown as Session
  const week = (n: number, phase: string, sess: Record<string, unknown>) =>
    ({ n, date: '2026-11-23', label: `W${n}`, phase, type: 'build', weekly_km: 30, sessions: sessions(sess) })
  const plan = (weeks: unknown[]) => ({ meta: { race_distance_km: 21.1, race_date: '2027-03-01' }, weeks } as unknown as Plan)

  it('🔴 a SECOND long run in the base week is seen — `.find` stopped at the first', () => {
    // Base holds a short long run on Saturday and a 30 km one on Sunday; build's is 20 km. Reading
    // only the first long run scores base at 12 and the rule stays silent on a real violation.
    const p = plan([
      week(1, 'base', { sat: long({ distance_km: 12 }), sun: long({ distance_km: 30 }) }),
      week(2, 'build', { sun: long({ distance_km: 20 }) }),
    ])
    expect(findings(p, RULE).length, 'base 30 km > build 20 km, via the SECOND long run').toBe(1)
  })

  it('🔴 an UNPRICEABLE long run in a LATER phase makes the comparison unverified, not zero', () => {
    // The case that actually distinguishes the two readings, and my first one did not: build holds
    // a priceable 20 km long run AND an unpriceable one. Under `?? 0` the unpriceable scores 0,
    // `later` is 20, base 30 > 20 and the rule FIRES on an upper bound it cannot support. Now it
    // declines. ⚠️ A case where build held ONLY the unpriceable run proves nothing — `later` is
    // then 0 and the rule's own `later > 0` guard returns [] under both readings.
    const p = plan([
      week(1, 'base', { sun: long({ distance_km: 30 }) }),
      week(2, 'build', { sat: long({ distance_km: 20 }), sun: long({ duration_mins: 100, pace_target: null }) }),
    ])
    expect(findings(p, RULE), 'later holds a long run nobody can price, so base > later is unprovable').toEqual([])
  })

  it('an unpriceable long run in BASE is still judged — it can only make the rule fire less', () => {
    // Declining here would LOSE a true finding, which my first cut did: the claim is "base is
    // longer than later", so a base run we cannot price lowers our estimate of base and makes the
    // assertion conservative. Base's priceable 30 km still exceeds build's 20 km.
    const p = plan([
      week(1, 'base', { sat: long({ distance_km: 30 }), sun: long({ duration_mins: 100, pace_target: null }) }),
      week(2, 'build', { sun: long({ distance_km: 20 }) }),
    ])
    expect(findings(p, RULE).length, 'base 30 > build 20 is still provable').toBe(1)
  })

  it('and a fully priceable plan with the longest in base still fires', () => {
    // The guard must not silence the rule generally — this is the case it exists for.
    const p = plan([
      week(1, 'base', { sun: long({ distance_km: 30 }) }),
      week(2, 'build', { sun: long({ distance_km: 20 }) }),
    ])
    expect(findings(p, RULE).length).toBe(1)
  })
})

describe('B9 — a time trial under a non-day key is unverified, not an arbitrary gap', () => {
  const RULE = 'INV-PLAN-TT-LONG-RUN-SPACING'
  const tt = { type: 'hard', label: '5K time trial', distance_km: 5, is_time_trial: true } as unknown as Session
  const long = { type: 'easy', role: 'long_run', label: 'Long run', distance_km: 20, pace_target: '6:00-6:30 /km' } as unknown as Session

  it('🔴 a session stored under a key that is not a weekday is not measured against the long run', () => {
    // `DAYS.indexOf('sun2')` is -1 and the old arithmetic carried on from there.
    //
    // ⚠️ THE LONG RUN IS ON SUNDAY DELIBERATELY, AND MY FIRST CASE PUT IT ON THURSDAY AND PROVED
    // NOTHING. `min_gap_days_from_long_run` is 2, and the sentinel gap depends on the long run's
    // day: against Thursday it is min(|-1-3|, 7-4) = 3, which is NOT under the minimum, so both
    // readings stay silent and the mutation passed. Against SUNDAY it is min(|-1-6|, 7-7) = **0**,
    // comfortably inside the minimum, so the old reading invents a violation and the new one
    // declines. Mutate on the far side of the threshold or the falsification is worthless.
    const p = planWith({}, { sessions: { ...(sessions({ sun: long }) as unknown as Record<string, unknown>), sun2: tt } })
    expect(findings(p, RULE), 'a non-day key carries no measurable gap').toEqual([])
  })

  it('and a time trial on a REAL day beside the long run still fires', () => {
    // The guard must not silence the rule generally — this is the case it exists for.
    const p = planWith({}, { sessions: sessions({ sun: long, sat: tt }) })
    expect(findings(p, RULE).length, 'one day apart, inside the minimum gap of 2').toBe(1)
  })
})

describe('B4 — §89\'s readiness veto reads the assessed runner, not the plan\'s label', () => {
  const RULE = 'INV-PLAN-EARLY-ONSET-GATED'

  /**
   * 🔴 THE HOLE B4 CLOSES IS STRUCTURALLY UNREACHABLE THROUGH THE WIZARD, AND THAT IS A FINDING
   * RATHER THAN A REASON TO SKIP THE FIX. The veto fails a runner on four conditions, and for the
   * LEVEL to be the deciding one the other three must pass — including a deep training age. But
   * §79 LIFTS an intensity level that reads beginner when the training age is deep ("an
   * experienced runner reading beginner on intensity is returning, not new"), so "assessed
   * beginner" and "deep training age" cannot co-exist from wizard input: the `deep` condition
   * already catches that runner. The combination is reachable only through `input.fitness_level`,
   * the API's structural override, which `assessedIntensity` reads BEFORE the assessment
   * (`input.fitness_level ?? assessed.intensity`).
   *
   * ⚠️ SO THIS CASE SETS `fitness_level` DELIBERATELY AND IT IS NOT A PRODUCTION SHAPE.
   * `COHORT-GRID-UNSET-LEVEL-01` is the recorded incident for corpora that set it: no production
   * caller does, and six measurement corpora were blind for exactly that reason. It is set here
   * because this rule is ABOUT that field's effect on the veto, and a test that cannot reach the
   * case proves nothing. It must not be copied into a corpus.
   */
  const override = { ...(INPUT as unknown as Record<string, unknown>),
    fitness_level: 'beginner', user_declared_level: 'experienced', training_age: '5yr+',
    recent_quality_training: 'regular', injury_history: [] } as unknown as GeneratorInput

  it('🔴 the veto reads the ASSESSED level, not the resolved one a declaration wins', () => {
    const prof = buildRunnerProfile(factsFromInput(override), { asOf: AS_OF, timezone: null, planStart: AS_OF })
    // The two fields the ruling distinguishes, and the reason reading the wrong one changes
    // nothing: `intensity` is `declaredLevel ?? assessedIntensity`, so it IS the claim here.
    expect(prof.levels.assessed_intensity.value, 'the assessed level must be beginner or this is vacuous').toBe('beginner')
    expect(prof.levels.intensity.value, 'and the resolved level must differ, or the fix is untested').toBe('experienced')
    const out = findings(planWith({ early_quality_onset: true }, {}), RULE, override)
    expect(out.length, 'early onset stamped for a runner ASSESSED beginner').toBe(1)
  })

  it('and the veto is silent when the plan never claimed early onset', () => {
    expect(findings(planWith({}, {}), RULE, override)).toEqual([])
  })
})

describe('B11 / B12 — the injury chip, the stride signal and the catalogue category', () => {
  it('🔴 B11a: the Achilles gate goes through the chip owner, not a substring test', () => {
    // 🔴 AND MY FIRST CASE HERE WAS HOLLOW, which is worth stating because the reason generalises.
    // I used `'Achilles_Tendinopathy'` expecting the underscore to defeat `includes('achilles')` —
    // it does not: the underscore comes AFTER the word, so a plain substring still matches, the
    // mutation back to `includes` stayed green, and the test proved nothing.
    //
    // For the keyword 'achilles' the two readings differ ONLY through the owner's reverse arm
    // (`k.includes(v)` when `v.length >= 3`), i.e. a chip SHORTER than the keyword. 📐 No chip the
    // product sends is shorter than 'achilles', so **the fix changes no verdict for any realistic
    // chip** — it is correct as ROUTING (if the chip vocabulary ever changes, the owner follows and
    // a copy here would not), and that is what this case proves. Same honest shape as B5's `?? 0`
    // half: ruled, right, and behaviourally latent.
    const RULE = 'INV-PLAN-QUALITY-EXPECTED'
    const build = planWith({ fitness_intensity_level: 'intermediate' },
      { phase: 'build', type: 'build', sessions: sessions({ tue: { type: 'easy', label: 'Easy run', distance_km: 8, duration_mins: 44 } as unknown as Session }) })
    const withChip = (hist: string[]) => ({ ...(INPUT as unknown as Record<string, unknown>),
      injury_history: hist, hard_session_relationship: 'embrace' } as unknown as GeneratorInput)

    // A chip the OWNER matches and a substring test does not. Synthetic by necessity, and named as
    // such — it is the only input that separates the two readings.
    expect(findings(build, RULE, withChip(['Achil'])), 'the owner matches a chip shorter than the keyword').toEqual([])
    // The ordinary spellings, which both readings agree on: the exemption still holds.
    for (const chip of ['Achilles', 'Achilles_Tendinopathy', 'achilles tendinopathy']) {
      expect(findings(build, RULE, withChip([chip])), chip).toEqual([])
    }
    // And it is not a blanket exemption: no Achilles history, so the week is still expected to carry quality.
    expect(findings(build, RULE, withChip([])).length, 'no Achilles history').toBe(1)
  })

  it('🔴 B11b: strides named in a COACH NOTE are caught, not only in the label', () => {
    const RULE = 'INV-MAINT-INJURY-EASY-ONLY'
    const p = {
      meta: { race_distance_km: 21.1, race_date: '2027-03-01', plan_kind: 'maintenance', source_base_weekly_km: 20, source_injured: true },
      weeks: [{ n: 1, date: '2026-11-23', label: 'M1', phase: 'maintenance_base', type: 'build', weekly_km: 20,
        sessions: sessions({ tue: { type: 'easy', label: 'Easy run', distance_km: 6, duration_mins: 34,
          coach_notes: ['Finish with 4 x 20s strides.'] } as unknown as Session }) }],
    } as unknown as Plan
    const out = findings(p, RULE)
    expect(out.map(f => f.day), 'the engine stamps the stride prescription in the note, not the label').toContain('tue')
  })

  it('🔴 B12: a race-specific session is found through its CATALOGUE ROW, which is the only place the category lives', () => {
    const RULE = 'INV-MAINT-NO-RACE-SPECIFIC'
    // Pick a real catalogue row whose category is race_specific, so the case is the product's own
    // data rather than a shape invented for the test.
    const row = V1_SESSION_CATALOGUE.find(r => (r as unknown as { category?: string }).category === 'race_specific')
    expect(row, 'the catalogue must hold a race_specific row or this case is vacuous').toBeTruthy()
    const p = {
      meta: { race_distance_km: 21.1, race_date: '2027-03-01', plan_kind: 'maintenance', source_base_weekly_km: 20, source_injured: false },
      weeks: [{ n: 1, date: '2026-11-23', label: 'M1', phase: 'maintenance_base', type: 'build', weekly_km: 20,
        sessions: sessions({ wed: { type: 'quality', label: 'Session', distance_km: 10, duration_mins: 55,
          catalogue_id: (row as unknown as { id: string }).id } as unknown as Session }) }],
    } as unknown as Plan
    expect(findings(p, RULE).map(f => f.day), 'the session carries no category of its own; its row does').toContain('wed')
  })
})
