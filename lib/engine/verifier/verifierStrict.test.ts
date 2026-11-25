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
  verifyPlan(p, ctx(input), 'saved').filter(f => f.rule_id === rule)

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

describe('B13 — coach-note intent decided structurally, not from the label', () => {
  const RULE = 'INV-PLAN-COACH-NOTES-MATCH-INTENT'
  const AEROBIC_CUE = 'Boring is the point.'
  const quality = (over: Record<string, unknown>) =>
    ({ type: 'quality', distance_km: 10, duration_mins: 55, coach_notes: [AEROBIC_CUE], ...over }) as unknown as Session

  it('🔴 an aerobic cue on a STAMPED vo2max session is caught, whatever its label says', () => {
    // 📐 The gain the real population shows: hill reps carry `stimulus: vo2max` and a label the
    // old substrings never matched ("Hill reps — 45s"), so an aerobic cue on genuinely hard work
    // went unchecked. This is the case, built from that shape.
    const p = planWith({}, { phase: 'build', sessions: sessions({ wed: quality({ label: 'Hill reps — 45s', stimulus: 'vo2max' }) }) })
    expect(findings(p, RULE).map(f => f.detail), 'a stamped vo2max session with an aerobic cue').toContain(`aerobic cue "boring is the point"`)
  })

  it('🔴 and a session whose ONLY evidence is the token "MP " in its label is no longer judged on it', () => {
    // The ruled LOSS, stated as a deliberate behaviour rather than discovered later: `'mp '`
    // matched any label containing it (including "ramp "), and a display string is what the
    // enricher may rewrite. Nothing structural marks this session as goal-paced, so the rule
    // declines — INV-CLASS's whole point.
    const p = planWith({}, { phase: 'build', sessions: sessions({ wed: quality({ label: 'MP 3 x 2 miles' }) }) })
    expect(findings(p, RULE), 'no stamp, no catalogue category: the label alone does not decide').toEqual([])
  })

  it('a session with no aerobic cue is silent either way', () => {
    const p = planWith({}, { phase: 'build', sessions: sessions({ wed: quality({ label: 'Hill reps — 45s', stimulus: 'vo2max', coach_notes: ['Drive the knees.'] }) }) })
    expect(findings(p, RULE)).toEqual([])
  })
})

describe('B1 (second half) — a distance-only session on race eve is priced, not read as zero minutes', () => {
  const RULE = 'INV-PLAN-NO-RACE-EVE-SESSION'
  // An easy run with BOTH anchors, so `easyMinPerKm` has a pace to read off the plan.
  const pacer = { type: 'easy', label: 'Easy run', distance_km: 10, duration_mins: 60 } as unknown as Session
  const race = { type: 'race', label: 'Race day', distance_km: 21.1 } as unknown as Session

  it('🔴 a 12 km distance-only session the day before the race is over the 35-minute cap', () => {
    // 12 km at the plan's easy pace (6 min/km) is 72 minutes. Read as `duration_mins ?? 0` it is
    // ZERO and can never breach a minutes cap, which is how a long run could sit on race eve
    // unnoticed. ⚠️ Latent in production — 0 of 280 sessions in the protected window are
    // distance-only — so only a direct case can reach it.
    const p = planWith({}, { type: 'race', sessions: sessions({
      mon: pacer, sat: { type: 'easy', label: 'Long run', distance_km: 12 } as unknown as Session, sun: race }) })
    expect(findings(p, RULE).map(f => f.day), '12 km at 6 min/km is 72 min, over the 35 min cap').toContain('sat')
  })

  it('a short distance-only shakeout is still silent', () => {
    // 4 km at 6 min/km is 24 minutes, inside the cap: the fix must not flag everything it can now see.
    const p = planWith({}, { type: 'race', sessions: sessions({
      mon: pacer, sat: { type: 'easy', label: 'Shakeout', distance_km: 4 } as unknown as Session, sun: race }) })
    expect(findings(p, RULE)).toEqual([])
  })

  it('and with no pace anywhere in the plan it is unverified, never zero', () => {
    // Nothing to convert with, so the rule declines rather than declaring the session short.
    const p = planWith({}, { type: 'race', sessions: sessions({
      sat: { type: 'easy', label: 'Long run', distance_km: 12 } as unknown as Session, sun: race }) })
    expect(findings(p, RULE), 'no easy pace to price it with').toEqual([])
  })
})

describe('C1 — the runner and the delivered sessions, never the plan\'s label for itself', () => {
  // 🔑 WHY EVERY CASE HERE IS HAND-BUILT, AND WHY THE AGREEMENT HARNESS CANNOT STAND IN.
  // On the 37 VALID golden plans every C1 divergence measures 0 gained and 0 lost — a plan the
  // engine produced agrees with itself, which is the whole reason the old readings looked harmless.
  // Every number in `STRICT_DIVERGENCES` comes from the mutation battery, and a mutation moves a
  // label in whichever direction the battery happens to move it. These cases move it DELIBERATELY,
  // in both directions, so the protective half is proven rather than inferred from a baseline.
  //
  // The readings are grouped as the ruling groups them — level, injuries, distance, goal, delivered
  // volume — not per rule: after C1 there is one owner for each, so proving the owner proves its
  // callers. Where a second rule shares an owner it is named in the register and not re-tested here.

  /** A runner the assessment reads as experienced on both axes: high volume, a long recent run. */
  const EXPERIENCED = { ...(INPUT as unknown as Record<string, unknown>),
    current_weekly_km: 80, longest_recent_run_km: 32, training_age: '5yr+' } as unknown as GeneratorInput
  /** A runner the assessment reads as a beginner: low volume, short longest run, new to it. */
  const BEGINNER = { ...(INPUT as unknown as Record<string, unknown>),
    current_weekly_km: 10, longest_recent_run_km: 5, training_age: '<6mo' } as unknown as GeneratorInput

  const eightWeeks = (over: Record<string, unknown> = {}) =>
    Array.from({ length: 8 }, (_, i) => ({
      n: i + 1, date: '2026-11-23', label: `W${i + 1}`, phase: i < 4 ? 'base' : 'build', type: 'build',
      weekly_km: 30, sessions: sessions({}), ...over,
    }))
  const planWeeks = (meta: Record<string, unknown>, weeks: unknown[]): Plan =>
    ({ meta: { race_distance_km: 21.1, race_date: '2027-03-01', ...meta }, weeks } as unknown as Plan)

  describe('the LEVEL', () => {
    const RULE = 'INV-PLAN-QUALITY-NOT-ZERO'

    it('🔴 a plan with no quality cannot excuse itself by CALLING its runner a beginner', () => {
      // §110's exemption is for a beginner, and `validatePlan` asked the plan. A label is not a runner:
      // this plan says `beginner` while the assessment reads the request as experienced, and the old
      // reading let it through the quality floor on its own word.
      const p = planWeeks({ fitness_level: 'beginner', fitness_intensity_level: 'beginner' }, eightWeeks())
      expect(findings(p, RULE, EXPERIENCED).length, 'the runner is not a beginner, so §110 governs this plan').toBe(1)
    })

    it('and a plan that OVER-states its runner is no longer flagged on the strength of the label', () => {
      // The converse, and the half a safety reading tends to leave untested: the label claims
      // experienced, the runner is a beginner, and §110 genuinely does not ask this plan for quality.
      const p = planWeeks({ fitness_level: 'experienced', fitness_intensity_level: 'experienced' }, eightWeeks())
      expect(findings(p, RULE, BEGINNER), 'the runner IS a beginner, whatever the plan calls them').toEqual([])
    })

    it('🔴 and the rule that CATCHES a dishonest weekly label no longer prices the week at the label\'s pace', () => {
      // `INV-PLAN-WEEKLY-KM-MATCHES-SESSIONS` converts time-anchored sessions at the level's fallback
      // easy pace (8.0 / 7.0 / 6.25 min/km). Keyed by `meta.fitness_level`, a plan claiming to be
      // experienced was priced at 6.25 — so the same 60 minutes became 9.6 km instead of 7.5 km and
      // the week's stated 10 km matched. The rule whose entire job is to find a label that lies about
      // the sessions was taking a different label's word for how to measure them.
      const week = { n: 1, date: '2026-11-23', label: 'W1', phase: 'base', type: 'build', weekly_km: 10,
        sessions: sessions({ tue: { type: 'easy', label: 'Easy run', duration_mins: 60 } as unknown as Session }) }
      const p = planWeeks({ fitness_level: 'experienced' }, [week])
      const f = findings(p, 'INV-PLAN-WEEKLY-KM-MATCHES-SESSIONS', BEGINNER)
      expect(f.map(x => x.detail), '60 min at the beginner pace is 7.5 km, not the stated 10').toEqual(['10 km stated, 8 placed'])
    })

    it('and the same week is silent when the stated km matches the RUNNER\'s pace', () => {
      const week = { n: 1, date: '2026-11-23', label: 'W1', phase: 'base', type: 'build', weekly_km: 8,
        sessions: sessions({ tue: { type: 'easy', label: 'Easy run', duration_mins: 60 } as unknown as Session }) }
      const p = planWeeks({ fitness_level: 'experienced' }, [week])
      expect(findings(p, 'INV-PLAN-WEEKLY-KM-MATCHES-SESSIONS', BEGINNER)).toEqual([])
    })
  })

  describe('the INJURY list', () => {
    const RULE = 'INV-PLAN-RUNWALK-CAP-NOT-REDUCED'
    const injured = { ...(INPUT as unknown as Record<string, unknown>), injury_history: ['knee'] } as unknown as GeneratorInput

    it('🔴 a run-walk plan that LOST its injury stamp is still flagged for the runner\'s capped injury', () => {
      // §117 Am. 4 is about the runner, and the old reading asked `meta.injury_history`. A plan with no
      // stamp passed a safety rule about the person it was built for. ⚠️ This is the half the agreement
      // corpus measures at 0 gained — its injury mutations rewrite the stamp, never the request — so
      // without this case the fix would look like nothing but a loss of findings.
      const p = planWeeks({ finish_goal_run_walk: true }, eightWeeks())
      expect(findings(p, RULE, injured).length, 'the RUNNER has a knee history, stamp or no stamp').toBe(1)
    })

    it('and a stamp the runner does not have no longer fires it', () => {
      const p = planWeeks({ finish_goal_run_walk: true, injury_history: ['knee'] }, eightWeeks())
      expect(findings(p, RULE, INPUT), 'the request carries no injury, so §117 Am. 4 does not apply').toEqual([])
    })
  })

  describe('the RACE DISTANCE', () => {
    it('🔴 §93\'s scope is the runner\'s race, so a plan understating its distance no longer escapes it', () => {
      // `INV-PLAN-PEAK-SPECIFICITY` only asks for race-specific peak work above 6 km, and the gate read
      // `meta.race_distance_km`. A plan stamped 5 km was out of scope whatever race the runner entered.
      // 📐 Declared LATENT in the register (no mutation moves the stamp across 6 km), so this is the
      // only thing that reaches it.
      const timeGoal = { ...(INPUT as unknown as Record<string, unknown>), goal: 'time_target', target_time: '1:45:00' } as unknown as GeneratorInput
      const peak = { n: 1, date: '2026-11-23', label: 'W1', phase: 'peak', type: 'build', weekly_km: 40,
        sessions: sessions({ thu: { type: 'quality', label: 'Threshold', duration_mins: 50, catalogue_id: 'threshold_continuous' } as unknown as Session }) }
      const p = planWeeks({ race_distance_km: 5 }, [peak])
      expect(findings(p, 'INV-PLAN-PEAK-SPECIFICITY', timeGoal).length, 'the runner is racing 21.1 km').toBe(1)
    })

    it('and a race session with no distance of its own falls back to the runner\'s race, not the stamp', () => {
      // `INV-PLAN-RACE-NOTE-SCALES` prefers the race SESSION's distance — that is the delivered race and
      // is right — and only falls back. Latent in the corpus because every race session carries one.
      const race = { type: 'race', label: 'Race day', coach_notes: ['First 2.1 km at goal pace'] } as unknown as Session
      const week = { n: 1, date: '2026-11-23', label: 'W1', phase: 'peak', type: 'race', weekly_km: 21, sessions: sessions({ sun: race }) }
      const ok = planWeeks({ race_distance_km: 5 }, [week])
      expect(findings(ok, 'INV-PLAN-RACE-NOTE-SCALES'), '2.1 km is the right opening fraction of 21.1 km').toEqual([])
      const bad = { ...race, coach_notes: ['First 0.5 km at goal pace'] } as unknown as Session
      const wrong = planWeeks({ race_distance_km: 5 }, [{ ...week, sessions: sessions({ sun: bad }) }])
      expect(findings(wrong, 'INV-PLAN-RACE-NOTE-SCALES').length, '0.5 km would only be right for a 5 km race').toBe(1)
    })
  })

  describe('the GOAL', () => {
    const RULE = 'INV-PLAN-TIME-TARGET-QUALITY-FLOOR'

    it('🔴 a time target with no time is a FINISH goal here too, as it is in every neighbouring rule', () => {
      // `validatePlan` scoped this rule on the plan's own copy of the request, read RAW, where its
      // neighbours all read `profile.race.goal`. So one plan was a time goal to this rule and a finish
      // goal one rule away. The normalised goal is the only reading now.
      const noTime = { ...(INPUT as unknown as Record<string, unknown>), goal: 'time_target' } as unknown as GeneratorInput
      const weeks = eightWeeks({ weekly_km: 40 })
      const p = planWeeks({ generator_input: { goal: 'time_target' } }, weeks)
      expect(findings(p, RULE, noTime), 'a time target with no time normalises to a finish goal').toEqual([])
    })

    it('and a real time target still reaches the quality floor', () => {
      const timed = { ...(INPUT as unknown as Record<string, unknown>), goal: 'time_target', target_time: '1:45:00' } as unknown as GeneratorInput
      const p = planWeeks({}, eightWeeks({ weekly_km: 40 }))
      expect(findings(p, RULE, timed).length, 'eight weeks, build phases, 40 km weeks, no quality').toBe(1)
    })
  })

  describe('the DELIVERED volume', () => {
    const RULE = 'INV-PLAN-PEAK-VOLUME-FLOOR-LONG-RACES'
    // §46: a time-targeted marathon peaks at 1.25 × its distance — 52.75 km for a 42.2 km race, reported as 53.
    const MARATHON = { ...(INPUT as unknown as Record<string, unknown>), race_distance_km: 42.2,
      goal: 'time_target', target_time: '4:00:00', current_weekly_km: 50, longest_recent_run_km: 25 } as unknown as GeneratorInput
    const peakWeek = (weeklyKm: number, sess: Record<string, unknown>) =>
      ({ n: 1, date: '2026-11-23', label: 'W1', phase: 'peak', type: 'build', weekly_km: weeklyKm, sessions: sessions(sess) })
    const run = (km: number) => ({ type: 'easy', label: 'Easy run', distance_km: km, duration_mins: km * 6 }) as unknown as Session

    it('🔴 THE RULE THE SITTING NAMED: a peak week LABELLED above the floor whose sessions are under it', () => {
      // A floor is a claim about what the runner runs. Stated 60 km clears §46's 52.6; the placed
      // sessions add to 30, and the old reading passed the plan on its own label.
      const p = planWeeks({ race_distance_km: 42.2 }, [peakWeek(60, { sat: run(20), sun: run(10) })])
      expect(findings(p, RULE, MARATHON).map(f => f.detail)).toEqual(['peak 30 km delivered under 53 km'])
    })

    it('and a peak week whose sessions clear the floor while its LABEL understates is silent', () => {
      // The converse: the label says 20 km, the sessions add to 55. The runner gets §46's volume, so
      // the rule has nothing to say — and the old reading would have flagged it.
      const p = planWeeks({ race_distance_km: 42.2 }, [peakWeek(20, { sat: run(35), sun: run(20) })])
      expect(findings(p, RULE, MARATHON)).toEqual([])
    })

    it('🔴 and a peak week whose sessions cannot be priced is UNVERIFIED, never zero', () => {
      // `?? 0` on a floor reads as "the runner ran nothing", which FIRES — and on a ratio it divides by
      // zero. A session with neither a distance nor a duration makes the rule decline instead (B5's
      // ruling, carried into every delivered reading).
      const naked = { type: 'easy', label: 'Easy run' } as unknown as Session
      const p = planWeeks({ race_distance_km: 42.2 }, [peakWeek(60, { sat: run(20), sun: naked })])
      const f = findings(p, RULE, MARATHON)
      expect(f.length).toBe(1)
      expect(f[0].detail).toMatch(/^unverified: /)
    })

    it('🔴 and the delivered sum is read at the WHOLE KILOMETRE, so a threshold case does not flip on 0.5 km', () => {
      // THIS IS THE LIVE PLAN, REBUILT. §23's `INV-PLAN-PEAK-IN-PEAK-PHASE` allows the peak phase to sit
      // within PEAK_INVERSION_MATERIAL_PCT (10%) of the plan's biggest week. One live plan's biggest week
      // states 38 km and its sessions add to 37.5, which moves its peak's share from 34/38 = 89.5% to
      // 34/37.5 = 90.7% — across the 10% line, with NO SESSION CHANGING. Unrounded, the verifier stopped
      // reporting a finding the old checker makes (`plans_lost` 1); rounded to the grain the week states
      // its volume in, and that `INV-PLAN-WEEKLY-KM-MATCHES-SESSIONS` already judges honesty at, the two
      // readings agree. ⚠️ Not cosmetic, and not a tolerance: it is the difference between measuring the
      // sessions and re-deciding a threshold.
      const run2 = (km: number) => ({ type: 'easy', label: 'Easy run', distance_km: km, duration_mins: km * 6 }) as unknown as Session
      const week = (n: number, phase: string, label: number, sess: Record<string, unknown>) =>
        ({ n, date: '2026-11-23', label: `W${n}`, phase, type: 'build', weekly_km: label, sessions: sessions(sess) })
      const p = planWeeks({ race_distance_km: 5 }, [
        // 20 + 17.5 = 37.5 placed, stated 38 — inside WEEKLY-KM-MATCHES-SESSIONS' ±1 km, so the label is honest.
        week(1, 'base', 38, { sat: run2(20), sun: run2(17.5) }),
        week(2, 'peak', 34, { sat: run2(20), sun: run2(14) }),
      ])
      expect(findings(p, 'INV-PLAN-PEAK-IN-PEAK-PHASE').map(f => f.week),
        '34 of 38 is 89.5%, under §23\'s 90% — the same verdict the old checker reaches').toEqual([1])
      expect(findings(p, 'INV-PLAN-WEEKLY-KM-MATCHES-SESSIONS'),
        'and the week\'s own label is honest, so nothing says otherwise').toEqual([])
    })

    describe('an unpriceable week, where the rule prices EVERY main week', () => {
      // 🔑 `INV-PLAN-PEAK-IN-PEAK-PHASE` is the one converted rule whose comparison spans the whole plan
      // (`max` over every non-deload main week), so an unpriceable BASE week leaves it incomplete. Code
      // review (2026-11-25) read the first cut as over-strict — it refused outright, turning a real
      // finding into a vague one. The direction decides it: an unknown week can only RAISE `max`, which
      // can only make an inversion WORSE, so a finding already demonstrated is kept and only an absence
      // of one is uncertain. ⚠️ Excluding the week instead would be the unsafe direction, because a lower
      // `max` makes `peak >= max × 0.9` easier and HIDES an inversion.
      const run3 = (km: number) => ({ type: 'easy', label: 'Easy run', distance_km: km, duration_mins: km * 6 }) as unknown as Session
      const naked3 = { type: 'easy', label: 'Easy run' } as unknown as Session
      const wk = (n: number, phase: string, sess: Record<string, unknown>) =>
        ({ n, date: '2026-11-23', label: `W${n}`, phase, type: 'build', weekly_km: 30, sessions: sessions(sess) })
      const RULE2 = 'INV-PLAN-PEAK-IN-PEAK-PHASE'

      it('🔴 a finding demonstrated at the KNOWN maximum survives an unpriceable base week', () => {
        const p = planWeeks({ race_distance_km: 5 }, [
          wk(1, 'base', { sat: run3(20), sun: run3(18) }),          // 38 known
          wk(2, 'base', { sat: run3(10), sun: naked3 }),            // unpriceable
          wk(3, 'peak', { sat: run3(20), sun: run3(14) }),          // 34 — 89.5% of 38
        ])
        const f = findings(p, RULE2)
        expect(f.map(x => x.detail), 'the inversion is already proved without the unknown week').toEqual(['peak phase short of the plan max'])
        expect(f.map(x => x.week)).toEqual([1])
      })

      it('🔴 but NO finding at the known maximum is UNVERIFIED, never a pass', () => {
        const p = planWeeks({ race_distance_km: 5 }, [
          wk(1, 'base', { sat: run3(10), sun: run3(10) }),          // 20 known
          wk(2, 'base', { sat: run3(10), sun: naked3 }),            // unpriceable — could be the real max
          wk(3, 'peak', { sat: run3(20), sun: run3(14) }),          // 34, clears 20 easily
        ])
        const f = findings(p, RULE2)
        expect(f.length, 'the unknown week could hold a higher max and create an inversion').toBe(1)
        expect(f[0].detail).toMatch(/^unverified: /)
      })

      it('and an unpriceable PEAK week refuses immediately — it is one side of the comparison', () => {
        const p = planWeeks({ race_distance_km: 5 }, [
          wk(1, 'base', { sat: run3(20), sun: run3(18) }),
          wk(2, 'peak', { sat: run3(20), sun: naked3 }),
        ])
        expect(findings(p, RULE2)[0]?.detail).toMatch(/^unverified: /)
      })

      it('and a fully priceable plan with no inversion is silent, so the refusal is not the default', () => {
        const p = planWeeks({ race_distance_km: 5 }, [
          wk(1, 'base', { sat: run3(10), sun: run3(10) }),
          wk(2, 'peak', { sat: run3(20), sun: run3(14) }),
        ])
        expect(findings(p, RULE2)).toEqual([])
      })
    })
  })
})
