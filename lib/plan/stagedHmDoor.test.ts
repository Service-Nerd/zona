// STAGED-HM-DOOR-01 / §116 Am. 11 / §118 Am. 4 — Coaching Board 2026-11-06.
//
// 🔴 THE DEFECT THESE ARMS HOLD. Measured through `runEngine` in the shape the wizard posts, for 0 km/week, 0 km
// longest run, declared beginner, three days: the MARATHON staged at every runway from 12, and the HALF MARATHON was
// REFUSED at 12, 16, 20, 24 and 30. A runner who typed the harder race got the plan.
//
// Cause: `stagingDoorKm` read a door only from a `BaseVolumeError`, and §111 governs `>= 42 km`, so a half marathon
// had no door BY CONSTRUCTION. Its §113 branch was also gated on `walkRunStartApplies`, so a runner already running
// was not staged even where §111 HAD a door — the same remedy applied to one twin.
//
// ⚠️ AND THE DOOR HAD TO MOVE. C3 asks for *the lowest CLEAN volume*, and "clean" is `validatePlan` plus the coach
// objections — §111 is in neither below 42 km — so the half staged at 6.5 km/week and built 5.67× off a runner who
// had never run, against 3.55× for the ratified marathon twin, green throughout (🩹 Willy, binding).

import { describe, it, expect } from 'vitest'
import { runEngine } from './engine'
import { generateRulePlan } from './ruleEngine'
import {
  stagedRaceOf, longRunRefusalDoor, stagingDoorKm, raceBlockVerdict, checkpointRaceInput,
  longestSessionKm, halfSameDayInput, generateStagedRacePlan,
} from './stagedRacePlan'
import { validateStagedRace } from './baseBuildValidate'
import { baseBuildRatioOf, baseBuildRatioApplies, BaseVolumeError } from './baseVolume'
import { LongRunReadinessError } from './longRunReadiness'
import { GENERATION_CONFIG } from './generationConfig'
import { baseBuildOfferLine } from './baseBuildCopy'
import { walkRunStartApplies } from './walkRunStart'
import { effectiveStartKm } from './startVolume'
import type { GeneratorInput, Plan } from '@/types/plan'

const PLAN_START = '2026-11-09' // a Monday
const addW = (iso: string, w: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + w * 7)
  return d.toISOString().slice(0, 10)
}

/**
 * ⚠️ THE SHAPE THE PRODUCT POSTS, NOT THE SHAPE A CORPUS USES. `fitness_level` is the API's structural override and
 * **no production caller sets it** (`COHORT-GRID-UNSET-LEVEL-01`); the runner DECLARES a level and §79 binds downward.
 * Six corpora filled it in and made §79's two-signal disagreement unreachable for all of them.
 */
function runner(raceKm: number, runwayWeeks: number, over: Partial<GeneratorInput> = {}): GeneratorInput {
  return {
    goal: 'finish', age: 40, injury_history: [], resting_hr: 55, max_hr: 180,
    preferred_long_run_day: 'sun',
    fitness_level: undefined,
    user_declared_level: 'beginner',
    race_date: addW(PLAN_START, runwayWeeks), race_distance_km: raceKm,
    current_weekly_km: 0, longest_recent_run_km: 0,
    training_days_per_week: 3, days_available: 3,
    ...over,
  } as unknown as GeneratorInput
}

const engine = (input: GeneratorInput) =>
  runEngine({ input, tier: 'paid', displayUnits: 'km', planStart: PLAN_START, today: PLAN_START })

const RUNWAYS = [12, 16, 20, 24, 30] as const
const HM = 21.1
const MARATHON = 42.2

describe('§116 Am. 11 (1) — staging follows the REFUSAL, not §111', () => {
  it('the premise, RE-RULED: §113 and now §111 BOTH govern the half, so the arms are pinned to §113 explicitly', () => {
    // 🔴 THIS ARM PREDICTED ITS OWN OBSOLESCENCE AND WAS RIGHT. It used to assert
    // `baseBuildRatioApplies(HM) === false` with the message *"§111 now governs the half — Am. 11 part 2 is moot and
    // must be re-ruled"*. §111 Amendment 4 (2026-11-07, `HM-BASE-RATIO-SCOPE-01`) made it govern, and the prediction
    // was right in word and wrong in one detail: **part 2 is NARROWED, not moot.** `ratioObjection` fires where
    // `!baseBuildRatioApplies`, which is now 5K and 10K — where it is the ONLY ratio guard, since §111 does not reach
    // there. See `SHORT-DISTANCE-RAMP-SCOPE-01`.
    expect(HM).toBeGreaterThanOrEqual(GENERATION_CONFIG.LONG_RUN_READINESS_MIN_RACE_KM)
    expect(baseBuildRatioApplies(HM), '§111 Am. 4 — the half is inside §111 now').toBe(true)
    expect(baseBuildRatioApplies(MARATHON)).toBe(true)
    // 🔴 AND THE ARMS BELOW MUST KEEP THEIR SUBJECT, which is what deleting this assertion would have thrown away.
    //
    // ⚠️ MY FIRST VERSION OF THIS ARM CLAIMED *"the two causes now coincide by construction"* AND PINNED IT AT
    // cw 15 — true there, FALSE in the band Am. 4 actually moved (`/code-review`, 2026-11-07). At 15 km/week §111's
    // probe does not refuse, so the §113 path reaches its `no_objection` branch and the walk-run gate is never
    // exercised. **A fixture outside the moved band cannot pin a claim about the moved band.**
    //
    // ✅ RE-RULED BY §117 AMENDMENT 7 (Coaching Board 2026-11-07, `WEEK1-FROM-LONGEST-RUN-01`) — AND THIS ARM IS
    // WHY THE BOARD SAW IT. The previous version pinned `WALKRUN-GATE-VOLUME-ONLY-01` as an open question with the
    // words *"so a change in either direction is noticed while the board decides"*. The board decided, and the
    // noticing worked: this arm went red on the ruling. What it used to assert:
    //   · cw 15, lr 0 → REFUSED, because the §113 door seed required §117's walk-run start and the gate read
    //     VOLUME only, so a runner declaring they had never run did not qualify for it.
    //   · cw 6–8, lr 0 → STAGED into CONTINUOUS runs — 82 of 90 such runners, 0 given the walk-run start.
    // Am. 7 gates the walk-run start on the LONGEST RUN (§117 Am. 5's ratified discriminator), so BOTH are now a
    // walk-run start. Measured across 8,064 engine inputs: **335 move, every one `refusal -> base_build`,
    // SERVED -> REFUSED 0, and not one race plan changes (5,325 before and after).**
    //
    // ⚠️ THE 2026-11-06 NARROWING IS NOT REOPENED, AND THAT WAS CHECKED RATHER THAN ASSUMED. The hazard it was
    // forced by — *"at every volume"* giving a 55 km/week runner an 18.3 km week-1 long run, because §116's ramp
    // sizes its long run from VOLUME and never from theirs — cannot reach this cohort: the walk-run start REPLACES
    // the ramp's opening and is duration-anchored, so it carries no distance at all. Measured over all 335 newly
    // staged plans: **0 error-severity violations and a worst week-1 session distance of 0 km.** The `high` runner
    // below (55 km/week, longest run 2) is untouched because 2 is not under the bar, and still refuses.
    expect(engine(runner(HM, 20, { current_weekly_km: 15, longest_recent_run_km: 0 })).kind,
      'cw 15, lr 0: §117 Am. 7 routes a never-run runner to the walk-run start, so the §113 door seed applies').toBe('base_build')
    const low = engine(runner(HM, 20, { current_weekly_km: 6, longest_recent_run_km: 0 }))
    expect(low.kind, 'cw 6: §111 Am. 4 refuses and stages — the band this amendment moved').toBe('base_build')
    const phases = new Set(((low as { plan: Plan }).plan.weeks ?? []).map(w => w.phase))
    // ✅ WAS `.toBe(false)`, PINNING `WALKRUN-GATE-VOLUME-ONLY-01` AS OPEN. §117 Amendment 7 CLOSED IT, and the
    // sentence this replaces said "open, pinned, not endorsed" — which is the whole value of having pinned it.
    expect(phases.has('walk_run_start'),
      '§117 Am. 7: a runner declaring a longest run of 0 gets the WALK-RUN start, not continuous runs')
      .toBe(true)
  })

  it('a never-run runner is staged for a HALF at every runway, and was refused at all of them', () => {
    for (const runway of RUNWAYS) {
      const out = engine(runner(HM, runway))
      expect(out.kind, `half at ${runway} weeks is ${out.kind}, not a staged block`).toBe('base_build')
      const staged = stagedRaceOf((out as { plan: Plan }).plan)
      expect(staged, `half at ${runway} weeks returned a block with no staged race`).not.toBeNull()
      expect(staged!.race_distance_km).toBe(HM)
      // The door is a real weekly volume. ⚠️ Seeding the search with a raw 0 published `door_km: 0`, which reads as
      // "no door" and would have rendered as "0 km" on the staged page.
      expect(staged!.door_km, 'a door of 0 is not a door').toBeGreaterThanOrEqual(
        GENERATION_CONFIG.BASE_BUILD_ONRAMP_MIN_START_KM)
    }
  })

  it('and the marathon is unchanged — staged at every runway, as already ratified', () => {
    for (const runway of RUNWAYS) {
      const out = engine(runner(MARATHON, runway))
      expect(out.kind, `marathon at ${runway} weeks regressed to ${out.kind}`).toBe('base_build')
      expect(stagedRaceOf((out as { plan: Plan }).plan)).not.toBeNull()
    }
  })

  it('a §113-refused runner ABOVE the running floor is staged where §111 has a door (the second twin)', () => {
    // 🔴 The `walkRunStartApplies` gate meant Phase D's remedy reached only the walk-run runner, though the class
    // is "§113 refuses first". Measured: marathon at 6–10 km/week, longest 1–2, doors 9 and 11, refused outright.
    //
    // ⚠️ THE POPULATION IS DERIVED, NOT TYPED, AND THE FIRST CUT OF THIS ARM PROVED WHY: I hand-listed
    // `cw 6, lr 2` as a §113 case and §111 refuses it (`BaseVolumeError`), so the arm failed on its own premise.
    // Which rule fires first at a given volume is the engine's business, not a thing to remember.
    const cases: Array<{ cw: number; lr: number; runway: number }> = []
    for (const cw of [6, 7, 8, 9, 10]) {
      for (const lr of [1, 2, 3]) {
        for (const runway of [12, 16, 20]) {
          if (lr > cw) continue
          const input = runner(MARATHON, runway, { current_weekly_km: cw, longest_recent_run_km: lr })
          // §113 must be what refuses them, AND the walk-run start must not apply — that is the gated case.
          // §113 must be what refuses them, the walk-run start must not apply (that is the gated case), AND §111
          // must supply a door — which is what makes it §116 Am. 9's own path rather than the floor seed.
          // 🔴 THE FIRST CUT OMITTED THE LAST CLAUSE and picked up `cw 9, lr 1, rw 12`, where §111 has NO door, so
          // the case is now correctly REFUSED and the arm failed. Gap B is defined by §111 having an answer.
          if (walkRunStartApplies(effectiveStartKm(input), input.longest_recent_run_km)) continue
          const door = longRunRefusalDoor(input, PLAN_START)
          if (door?.kind !== 'base_volume') continue
          try { generateRulePlan(input, 'paid', PLAN_START) } catch (e) {
            if (e instanceof LongRunReadinessError) cases.push({ cw, lr, runway })
          }
        }
      }
    }
    // 🔴 NOT VACUOUS. An empty list would pass the loop below and prove nothing, which is how a check comes to
    // read green over the cases it was written for.
    expect(cases.length, 'no marathon runner is §113-refused above the running floor: this arm measures nothing')
      .toBeGreaterThan(0)
    for (const { cw, lr, runway } of cases) {
      const input = runner(MARATHON, runway, { current_weekly_km: cw, longest_recent_run_km: lr })
      const out = engine(input)
      expect(out.kind, `marathon cw ${cw} lr ${lr} rw ${runway} is ${out.kind}, not staged`).toBe('base_build')
      expect(stagedRaceOf((out as { plan: Plan }).plan), `cw ${cw} lr ${lr} rw ${runway}`).not.toBeNull()
    }
  })

  it('🔴 a runner ALREADY RUNNING, with no §111 door, is NOT staged — a volume ramp is not a long-run ramp', () => {
    // 🔴 CODE REVIEW CAUGHT THE FIRST CUT SHIPPING THE EXACT HAZARD §113 EXISTS TO PREVENT. Dropping the
    // `walkRunStartApplies` gate outright staged every §113 refusal. §113's blocker is a LONG RUN and the staged
    // door is a WEEKLY VOLUME: §116's ramp sizes its long run from volume, never from theirs. Measured then:
    //
    //     marathon, 55 km/wk, longest 2 km -> staged, WEEK-1 LONG RUN 18.3 km (+815%), and
    //                                         `INV-PLAN-ONRAMP-PER-RUN-STEP` (§116 Am. 2, Willy) FIRED
    //
    // So the floor seed applies only where the walk-run start does. ⚠️ This NARROWS the board's ruling, which said
    // "at every volume"; the ruling assumed §111 would supply the door, and its reason is still served.
    const high = runner(MARATHON, 12, { current_weekly_km: 55, longest_recent_run_km: 2 })
    expect(walkRunStartApplies(effectiveStartKm(high), high.longest_recent_run_km),
      'this runner is above the running floor AND has run 2km; §117 Am.7 must not route them to walk-run').toBe(false)
    expect(longRunRefusalDoor(high, PLAN_START)?.kind, '§111 now has a door here, so the case no longer tests the seed')
      .toBe('no_objection')
    const out = engine(high)
    expect(out.kind, 'a 55 km/wk runner with a 2 km longest run was staged into an 18.3 km week-1 long run').toBe('refusal')
    // ⚠️ AND THEY ARE NOT ABANDONED — §118 Am. 4 is what makes this narrowing acceptable.
    expect((out as { body: Record<string, unknown> }).body.get_running, 'refused with nothing to do').toBeTruthy()
  })

  it('a staged walk-run plan gets its RAMP weeks where the runway allows them', () => {
    // 🔴 `rampDoorFloor` was missing from the walk-run producer while its sibling had it, so the floor seed of 6
    // equalled the ramp's own start of 6, `checkpointPlacement`'s `doorKm > startKm` failed, and the ramp was
    // dropped: a never-run half runner at 20 weeks got **7 walk-run weeks and ZERO ramp weeks**.
    const out = engine(runner(HM, 20))
    const plan = (out as { plan: Plan }).plan
    const ramp = plan.weeks.filter(w => w.phase === 'base_build')
    expect(ramp.length, 'the staged plan is walk-run only; its ramp weeks were dropped').toBeGreaterThan(0)
    expect(stagedRaceOf(plan)!.door_km, 'the door equals the ramp start, so it can never be reached')
      .toBeGreaterThan(GENERATION_CONFIG.BASE_BUILD_ONRAMP_MIN_START_KM)
  })

  it('a refusal that is NOT about the base still stands — the door function does not swallow it', () => {
    // ⚠️ `longRunRefusalDoor` returns null for anything other than §111, so §44 on the runway and §52 on the days
    // are unaffected. Without this the fix would convert every refusal into a staged plan.
    const tooShort = runner(50, 4) // 50K needs §44's 14-week block
    expect(longRunRefusalDoor(tooShort, PLAN_START)).toBeNull()
    const out = engine(tooShort)
    expect(out.kind).toBe('refusal')
  })

  it('the door probe is coherent with §18: a 5 km long run cannot sit on a 2 km week', () => {
    // 🔴 The first cut substituted the long run alone, so the probe asked §111 about a runner
    // `INV-INPUT-LONGEST-LE-WEEKLY` forbids, and `validatePlan` logged an error from inside the probe on every
    // sub-floor case. An incoherent hypothetical cannot give a trustworthy door.
    const floor = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.long
    const low = runner(HM, 20, { current_weekly_km: 2, longest_recent_run_km: 1 })
    const logged: unknown[] = []
    const real = console.error
    console.error = (...a: unknown[]) => { logged.push(a) }
    try { longRunRefusalDoor(low, PLAN_START) } finally { console.error = real }
    expect(logged.flat().join(' '), 'the probe still builds a plan §18 forbids')
      .not.toMatch(/INV-INPUT-LONGEST-LE-WEEKLY/)
    expect(floor).toBeGreaterThan(2) // the case is only interesting while the floor exceeds the volume
  })

  it('stagingDoorKm answers for BOTH refusals, and for neither when nothing is wrong with the base', () => {
    const input = runner(HM, 24)
    expect(stagingDoorKm(new LongRunReadinessError({
      ok: false, message: '', alternatives: [], longest_recent_run_km: 0, min_longest_run_km: 5,
    }), input, PLAN_START), '§113 no longer yields a door').not.toBeNull()
    expect(stagingDoorKm(new Error('not a refusal'), input, PLAN_START)).toBeNull()
  })
})

describe('§116 Am. 11 (2) — the door lands the block inside §111\'s ratio', () => {
  it('every staged half with a found target builds inside the cap, derived not stamped', () => {
    const cap = GENERATION_CONFIG.MAX_BASE_BUILD_RATIO
    let checked = 0
    for (const runway of [24, 30, 36]) {
      const input = runner(HM, runway)
      const out = engine(input)
      const plan = (out as { plan: Plan }).plan
      const staged = stagedRaceOf(plan)!
      if (!staged.target_found) continue // C4: no block promised, nothing to bound
      checked++
      const cp = addW(PLAN_START, staged.checkpoint_week)
      const raceInput = checkpointRaceInput(input, staged.door_km, longestSessionKm(plan.weeks))
      const { race } = raceBlockVerdict(raceInput, cp)
      expect(race, `no race block generates at the door for runway ${runway}`).not.toBeNull()
      const { ratio } = baseBuildRatioOf(race!, raceInput)
      expect(ratio, `runway ${runway}: door ${staged.door_km} builds ${ratio.toFixed(2)}x, over §111's ${cap}x`)
        .toBeLessThanOrEqual(cap)
    }
    // 🔴 NOT VACUOUS. If no runway finds a target the loop body never runs and the arm passes on an empty population
    // — the exact flaw that let a staged exemption read green on a file holding no slug at all.
    expect(checked, 'no staged half found a target: this arm measured nothing').toBeGreaterThan(0)
  })

  it('INV-PLAN-STAGED-DOOR-RATIO is silent on the plans the engine now builds', () => {
    for (const runway of [24, 30, 36]) {
      const out = engine(runner(HM, runway))
      const fired = validateStagedRace((out as { plan: Plan }).plan)
        .filter(v => v.code === 'INV-PLAN-STAGED-DOOR-RATIO')
      expect(fired.map(v => v.actual), `runway ${runway}`).toEqual([])
    }
  })

  it('the invariant does not THROW on a stored plan whose input is malformed', () => {
    // 🔴 CODE REVIEW: this arm regenerates a plan, and `raceBlockVerdict` re-throws anything that is not a
    // DESIGNED refusal. `InputFieldError` is not one (§55 answers it before generation), so a stored staged plan
    // missing a field made `validateStoredPlan` **throw instead of returning violations**, reaching
    // `adjustmentEngine` and `/api/ops/plan-audit` unguarded. Every other arm in that file is a pure read; this is
    // the only one that can fail, and the honest answer to "I could not build the block" is no violation.
    const out = engine(runner(HM, 30))
    const plan = JSON.parse(JSON.stringify((out as { plan: Plan }).plan)) as Plan
    expect((plan.meta as unknown as { generator_input?: unknown }).generator_input,
      'the staged plan carries no generator_input, so this arm cannot test anything').toBeTruthy()
    // ⚠️ THREE CORRUPTIONS, NOT ONE, AND THE THIRD IS WHY THE CATCH IS BROAD. I first narrowed it to §55's input
    // errors so a genuine fault would propagate, then measured that `injury_history = 7` propagates a **TypeError** —
    // so the narrow version still threw out of a validator on corrupt stored data. The visibility the pre-ship gate
    // asks for is supplied by `invariantLiveness` instead: its mutation wakes this code on every `npm run verify`,
    // so a swallow that became universal would fail the build.
    for (const [what, corrupt] of [
      ['a missing §55 field', (g: Record<string, unknown>) => { delete g.age }],
      ['a junk race_date', (g: Record<string, unknown>) => { g.race_date = 'not-a-date' }],
      ['a non-array injury_history', (g: Record<string, unknown>) => { g.injury_history = 7 }],
    ] as Array<[string, (g: Record<string, unknown>) => void]>) {
      const p = JSON.parse(JSON.stringify(plan)) as Plan
      corrupt((p.meta as unknown as { generator_input: Record<string, unknown> }).generator_input)
      expect(() => validateStagedRace(p), `${what}: a validator that throws takes its caller down with it`).not.toThrow()
      // ⚠️ AND IT MUST NOT QUIETLY PASS EITHER — no violation is the right answer; the ratio is simply unknown.
      expect(validateStagedRace(p).filter(v => v.code === 'INV-PLAN-STAGED-DOOR-RATIO'), what).toEqual([])
    }
  })

  it('🔴 §111\'s offer may not promise a race door the runway cannot hold', () => {
    // 🔴 FOUND BY `/code-review` AFTER §111 Am. 4 SHIPPED (2026-11-07), and it is §113's defect in §111's clothes.
    //
    // §113's offer was fixed on 2026-11-06 to answer "does a race plan open?" by GENERATING the block at the
    // checkpoint, because a volume-only test cannot see §44's prep floor. §111's offer kept the volume-only form
    // (`endsAtKm >= min_base_km`), and Am. 4 made it reachable at the half — where a SHORT runway makes
    // `stagingApplies` fail, so this offer is the only thing the runner gets.
    //
    // Measured, both directions: at `cw 6 / lr 5 / runway 9`, days 4 and 5, time goal, the volume-only predicate
    // claimed `reaches_race_door: true` after an **8-week base build on a 9-week runway** — one week for a half
    // marathon block §44 refuses. With §111's own door AND the race-door probe: **2 → 0**.
    //
    // ⚠️ MY FIRST VERIFICATION OF THIS FIX WAS HOLLOW and I found it by falsifying: I checked
    // `offer.weeks >= runway`, and 8 >= 9 is false, so the probe could never see the case it was written for.
    // **The arm below asserts the predicate the runner is actually served, not arithmetic about it.**
    // 🔴 MY FIRST VERSION OF THIS ARM WAS VACUOUS, and code review proved it by replaying its own grid: 168 inputs
    // gave 126 `warn_unacknowledged` + 14 `long_run_readiness` refusals and **0 `base_volume`**, because `runner()`
    // never acknowledges §44's prep warning — so §111 was never reached and `offersClaimingDoor` could not be
    // populated. **It passed with the fix reverted.** That is the third hollow gate I built in one day.
    //
    // The real population is narrow and was measured, not guessed: `cw 6 / lr 5 / runway 9 / days 4–5`, time goal,
    // prep acknowledged — **exactly 2 inputs.** The arm therefore asserts the population is NON-EMPTY first, because
    // an arm whose subject can vanish is an arm that reports nothing (`an empty population must not render`).
    const probed: Array<{ what: string; door: unknown; weeks: unknown }> = []
    for (const days of [3, 4, 5]) for (const rw of [8, 9, 10]) {
      const out = engine({
        ...runner(HM, rw, { current_weekly_km: 6, longest_recent_run_km: 5, days_available: days }),
        goal: 'time_target', target_time: '2:30:00', acknowledged_prep_warning: true,
      } as GeneratorInput)
      if (out.kind !== 'refusal') continue
      const body = (out as { body: Record<string, unknown> }).body
      if (body.reason !== 'base_volume') continue
      const offer = body.get_running as Record<string, unknown> | undefined
      if (!offer) continue
      probed.push({ what: `rw${rw} d${days}`, door: offer.reaches_race_door, weeks: offer.weeks })
    }
    expect(probed.length,
      'no §111 offer was reached: this arm has no subject and would pass with the fix reverted, which is exactly how its first version was vacuous')
      .toBeGreaterThan(0)
    // Every one of them: the base build consumes the runway, so the door must NOT be promised.
    expect(probed.filter(p => p.door === true),
      'a §111 offer claimed the race door opens where the base build consumes the runway — the SLT ruled on exactly this: "when it does not happen, the runner concludes you lied, and they will be right"')
      .toEqual([])
  })

  it('🔴 part 2 STILL FIRES where it is now the only guard, and this arm is the only thing watching it', () => {
    // 🔴 FOUND BY `/code-review` AFTER §111 Am. 4 (2026-11-07), and it is a LOST ARGUMENT, not just a dead rule.
    //
    // `validateStagedDoorRatio` was referenced in NO test — its only proof was the liveness harness mutating a
    // staged half's door down and watching it wake. Am. 4 made that impossible (staging triggers are all >= 21 km,
    // the rule's guard is below 21 km), so the rule had **no watcher at all**. Worse: `baseBuildValidate.ts`'s broad
    // `catch { return [] }` is argued safe on exactly that mechanism — *"`invariantLiveness` IS THE VISIBILITY…
    // if the swallow ever became universal the mutation would stop waking it"*. That sentence stopped being true.
    //
    // So this arm is the replacement watcher. It builds a real staged plan through the producer and re-points it at
    // a distance §111 does not govern, which is how the liveness mutation reached the rule in the first place.
    const staged = engine(runner(HM, 30, { current_weekly_km: 5, longest_recent_run_km: 0 }))
    expect(staged.kind, 'the fixture must stage, or this arm has no subject').toBe('base_build')
    const p = JSON.parse(JSON.stringify((staged as { plan: Plan }).plan)) as Plan
    const meta = p.meta as unknown as Record<string, unknown>
    const sr = meta.staged_race as Record<string, unknown>
    // A 10K: §111 is silent there, so part 2 is the only ratio guard (`SHORT-DISTANCE-RAMP-SCOPE-01`).
    sr.race_distance_km = 10
    ;(meta.generator_input as Record<string, unknown>).race_distance_km = 10
    expect(baseBuildRatioApplies(10), 'the premise of this arm').toBe(false)
    expect(sr.target_found, 'an exempt plan would make this arm vacuous — part 2 skips `target_found: false`').toBe(true)
    // 🔴 MY FIRST VERSION OF THIS ARM ASSERTED `expect(Array.isArray(codes)).toBe(true)` — UNCONDITIONALLY TRUE.
    // Falsified by code review: a universal `return []` in `validateStagedDoorRatio`, the exact regression this arm
    // is cited as guarding in `baseBuildValidate.ts`, left **26 tests and the whole suite green**. I built a hollow
    // gate while fixing a finding about a hollow gate.
    // It asserts the violation FIRES now, which means the door must be genuinely over the cap: 6 and 8.5 are
    // compliant and stay silent, so the number is load-bearing.
    ;(sr as Record<string, unknown>).door_km = 3
    const codes = validateStagedRace(p).map(v => v.code)
    expect(codes, 'part 2 must FIRE on an over-cap door at a distance §111 does not govern — if this goes quiet, the broad `catch { return [] }` in baseBuildValidate has no watcher at all')
      .toContain('INV-PLAN-STAGED-DOOR-RATIO')
  })

  it('§116 Am. 11 part 2 is NARROWED by §111 Am. 4: live at 5K/10K, silent at the half and above', () => {
    // The objection and §111's refusal are two mechanisms for one job, and the hand-off is the ruling's safety.
    // Measured 2026-11-07 across 480 inputs in the affected band: 404 staged, 76 race plans, **0 over the cap, 0
    // bare refusals** — so the refusal does the objection's work inside `raceBlockVerdict`, which returns
    // `race: null` on a designed refusal and makes the door search reject that volume exactly as the objection did.
    expect(baseBuildRatioApplies(5), '§111 does not reach 5K — the objection is the only ratio guard there').toBe(false)
    expect(baseBuildRatioApplies(10), 'nor 10K').toBe(false)
    expect(baseBuildRatioApplies(HM), 'at the half §111 took over').toBe(true)
  })

  it('the ratio condition is a NO-OP where §111 governs, by predicate and not by luck', () => {
    // ⚠️ It would be easy to leave this to the fact that `generateRulePlan` throws `BaseVolumeError` first at the
    // marathon. "It cannot happen" is the claim this repo has paid for. The guard is `!baseBuildRatioApplies`, so a
    // marathon block can never carry the objection even if §111's refusal were lifted.
    const input = runner(MARATHON, 30, { current_weekly_km: 15, longest_recent_run_km: 8 })
    const { race, objectionCodes } = raceBlockVerdict(input, PLAN_START)
    expect(race).not.toBeNull()
    expect(objectionCodes, 'a marathon block carries the staged-door objection; §111 owns that distance')
      .not.toContain('BASE-BUILD-RATIO-OVER-CAP')
    // §111 Am. 4 — the half joined that set, and for the same reason: its refusal fires first.
    const hm = runner(HM, 20, { current_weekly_km: 15, longest_recent_run_km: 8 })
    expect(raceBlockVerdict(hm, PLAN_START).objectionCodes,
      'the half is inside §111 now, so the staged-door objection must be silent there too')
      .not.toContain('BASE-BUILD-RATIO-OVER-CAP')
    // And §111 itself is untouched: it still refuses the reckless tail.
    expect(() => generateRulePlan(runner(MARATHON, 30, { current_weekly_km: 8, longest_recent_run_km: 6 }), 'paid', PLAN_START))
      .toThrowError(BaseVolumeError)
  })

  it('E1\'s half-same-day offer reads the same rule — the twin, not the instance', () => {
    // 🔴 Measured before the ruling: 8 of 68 E1 offers were over §111's cap, all at 6–8 km/week observed, up to
    // 5.67×. The rule lives in `raceBlockVerdict`, which both the door search and E1 reach, so one condition covers
    // both. The cost was measured first: all 8 of those runners have `extend` available.
    const input = runner(MARATHON, 30)
    const overCap = halfSameDayInput(input, 6, 3, PLAN_START)
    expect(overCap, 'E1 still offers a half whose block builds 5.67x off what the runner ran').toBeNull()
    // ⚠️ AND IT MUST STILL OFFER THE HALF WHERE THE BLOCK IS SOUND, or the arm above is just "E1 is broken".
    const sound = halfSameDayInput(input, 20, 12, PLAN_START)
    expect(sound, 'E1 offers nothing at any volume — the condition is too wide').not.toBeNull()
  })
})

describe('§118 Am. 4 — the offer follows §118\'s scope, not §111\'s branch', () => {
  it('a §113 refusal that still stands carries the base-build offer', () => {
    // A marathoner already running, refused on the long run with too short a runway to stage.
    const input = runner(MARATHON, 10, { current_weekly_km: 10, longest_recent_run_km: 2 })
    const out = engine(input)
    expect(out.kind).toBe('refusal')
    const body = (out as { body: Record<string, unknown> }).body
    expect(body.reason).toBe('long_run_readiness')
    expect(body.get_running, '§113 refuses with nothing to do — §118 says every unservable base gets a plan')
      .toBeTruthy()
    const offer = body.get_running as Record<string, unknown>
    expect(typeof offer.weeks).toBe('number')
    expect(typeof offer.line).toBe('string')
    expect(typeof offer.reaches_race_door).toBe('boolean')
  })

  it('reaches_race_door is answered at the END of the base build, not at its start', () => {
    // 🔴 THE PROBE'S CHECKPOINT WAS `planStart`, SO THE BASE-BUILD WEEKS WERE COUNTED TWICE — code review,
    // 2026-11-06. On a 10-week runway it asked whether a race plan generates in the ten weeks starting TODAY while
    // the base build consumes all ten of them. Measured before the fix: **168 of 196** §113 refusals carrying an
    // offer claimed *"a race plan opens up at the end of it"*, about a race day that had already passed. That is the
    // commitment the SLT ruled on — *"when it does not happen, the runner concludes you lied, and they will be
    // right"* (2026-09-20). After the fix: **0 of 612**.
    //
    // 🔴 AND THAT CORRECTION OVERSHOT INTO A SECOND FALSE CLAIM, in this arm and in four documents:
    // *"so the clearing variant is UNREACHABLE for §113, by construction"*. Code review, 2026-11-07. Re-measured
    // through `runEngine` over a 6,600-case grid (5 distances × 11 volumes × 5 longest runs × 8 runways × 3 day
    // counts, longest ≤ weekly): **126 of 936** §113 refusals carrying an offer DO clear the race door.
    //
    // ⚠️ AND THE CLEARING COHORT IS THE ONE THIS SAME COMMIT CREATED. Every one of the 126 has
    // `longest_recent_run_km: 0` with weekly volume ABOVE §117's walk-run start — precisely the runner §116 Am. 11's
    // narrowing excludes from staging, so their §113 refusal survives for a reason that has nothing to do with the
    // runway — at a runway of 24 weeks or more. At runways 10–20 it is **0 of 783**, and the five fixtures below all
    // sit at 10–16. So `.toBe(false)` was a property of the POPULATION, not an invariant: the same corpus blindness
    // as `ENVELOPE-LRR-BLIND-01` and `COHORT-GRID-UNSET-LEVEL-01`, for the third time on this item.
    //
    // ⚠️ THE ENGINE WAS RIGHT THROUGHOUT — no prescription changes here. The offer told the truth; the claim
    // about it did not. **So this arm asserts the predicate MOVES**, on one runner either side of the boundary.
    let offers = 0
    for (const [dk, cw, lr, runway, days] of [
      // ⚠️ THE TWO HM ROWS MOVED FROM cw 6/8 TO 10/12 (§111 Amendment 4, 2026-11-07). Below §111's new door the half
      // is now REFUSED-AND-STAGED, so those two inputs stop being §113 refusals and silently stopped contributing —
      // the `offers > 0` floor below would still have passed on the three non-HM rows alone, which is exactly how a
      // fixture leaves an arm without anyone noticing. Re-pinned above the door, where §113 refuses alone.
      // ⚠️ `[HM, 10, 1, …]` RE-PINNED TO lr 2 (§117 Am. 7, 2026-11-07): at lr 1 this runner is now STAGED, so the
      // row stopped being a §113 refusal and silently stopped contributing — the very failure this comment warns of,
      // committed by the amendment two lines of code away. lr 2 sits on the bar, where §113 still refuses alone.
      [MARATHON, 10, 2, 10, 3], [HM, 10, 2, 10, 3], [HM, 12, 2, 12, 4], [MARATHON, 20, 4, 14, 3], [50, 15, 3, 16, 3],
    ] as Array<[number, number, number, number, number]>) {
      const out = engine(runner(dk, runway, {
        current_weekly_km: cw, longest_recent_run_km: lr, days_available: days,
      }))
      if (out.kind !== 'refusal') continue
      const body = (out as { body: Record<string, unknown> }).body
      if (body.reason !== 'long_run_readiness') continue
      const offer = body.get_running as Record<string, unknown> | undefined
      if (!offer) continue
      offers++
      expect(offer.reaches_race_door,
        `${dk}km cw${cw} lr${lr} rw${runway}: §113's offer promised a race plan, and the runway cannot hold one`)
        .toBe(false)
      // SLT 2026-09-20: the non-clearing variant must say NOTHING about a race.
      expect(String(offer.line), 'the non-clearing offer mentions a race').not.toMatch(/race|marathon|half/i)
    }
    expect(offers, 'no §113 refusal carried an offer: this arm measured nothing').toBeGreaterThan(0)

    // 🔴 THE TWO-SIDED 22/24 BOUNDARY IS GONE, AND SAYING SO IS THE POINT OF THIS COMMENT.
    //
    // §117 Amendment 7 (Coaching Board 2026-11-07, `WEEK1-FROM-LONGEST-RUN-01`) gates the walk-run start on the
    // LONGEST RUN. The comment above describes the clearing cohort in its own words — *"every one of the 126 has
    // `longest_recent_run_km: 0` with weekly volume ABOVE §117's walk-run start … so their §113 refusal survives
    // for a reason that has nothing to do with the runway"* — and **Am. 7 serves exactly those runners**, who are
    // now staged rather than refused.
    //
    // Re-measured on the same 6,600-case grid shape (5 distances × 11 volumes × 5 longest runs × 9 runways × 3 day
    // counts, longest ≤ weekly):
    //   · §113 refusals carrying an offer: **936 → 110**
    //   · of those, CLEARING the race door: **126 → 0**
    //   · surviving refusals by runway: **10 → 46, 12 → 40, 16 → 24, and NOTHING at 20 or beyond**
    //   · inputs that are a §113 refusal at BOTH runway 22 and 24: **0**
    // On every survivor the offer's `weeks` equals the runway, so the base build consumes it and no race block fits.
    //
    // ⚠️ SO THIS ARM LOSES ITS DISTINGUISHING POWER AND I AM NOT PRETENDING OTHERWISE. A one-sided `false` cannot
    // tell "answered at the END of the base build" from "answered at its START" — that was the whole value of the
    // 22/24 pair. **The clearing variant's coverage now rests entirely on the NEXT arm**, which reaches it through
    // §111's branch and passes. If that arm is ever deleted, this property has no test anywhere.
    //
    // ⚠️ AND IT IS RECORDED AS A MEASURED POPULATION, NEVER "UNREACHABLE BY CONSTRUCTION". That exact overreach was
    // made twice on this item and refuted both times, once by `/code-review` on this very arm. 0 of 110 is what was
    // measured on this grid. **If a later change re-opens the cell, the floor below goes red.**
    const probe113 = (dist: number, cw: number, lr: number, runway: number, days: number) => {
      const out = engine(runner(dist, runway, { current_weekly_km: cw, longest_recent_run_km: lr, days_available: days }))
      if (out.kind !== 'refusal') return null
      const body = (out as { body: Record<string, unknown> }).body
      if (body.reason !== 'long_run_readiness') return null
      return (body.get_running as Record<string, unknown> | undefined) ?? null
    }
    // 🔴 DERIVED, NEVER TYPED. My first cut hand-listed three rows read off the grid above and ONE OF THEM WAS NOT A
    // §113 REFUSAL under this file's own `runner()` defaults — the arm failed 2 of 3 on its own fixture list. Which
    // rule fires at a given input is the engine's business, exactly as the loop earlier in this file already records.
    const survivors: Array<{ key: string; offer: Record<string, unknown> }> = []
    for (const dist of [HM, MARATHON]) {
      for (const cw of [6, 8, 10, 12, 15]) {
        for (const lr of [2, 3, 4]) {
          for (const rw of [10, 12, 16]) {
            if (lr > cw) continue
            const offer = probe113(dist, cw, lr, rw, 3)
            if (offer) survivors.push({ key: `${dist}km cw${cw} lr${lr} rw${rw}`, offer })
          }
        }
      }
    }
    // 🔴 NOT VACUOUS. If Am. 7 (or anything after it) removes the rest of the §113 population, this floor fails and
    // the assertions below stop being evidence of anything.
    expect(survivors.length, '§113 refusals with an offer have vanished: this arm measures nothing').toBeGreaterThan(0)
    for (const { key, offer } of survivors) {
      expect(offer.reaches_race_door, `${key}: the base build fills the runway, so no race block can open`).toBe(false)
      expect(offer.weeks, `${key}: the offer's block should fill the runway`).toBeTruthy()
      // SLT 2026-09-20: the non-clearing variant must say NOTHING about a race.
      expect(String(offer.line), `${key}: the non-clearing offer mentions a race`).not.toMatch(/race|marathon|half/i)
    }
    // The cell Am. 7 emptied, asserted as emptied so a re-opening is noticed.
    expect(probe113(HM, 10, 0, 24, 3), 'lr 0 at a 24-week runway: Am. 7 stages this runner, so there is no §113 refusal to carry an offer')
      .toBeNull()
  })

  it('the clearing variant is still live copy, not dead code, and §111 is the branch that reaches it', () => {
    // ⚠️ A BOOLEAN THAT CANNOT MOVE IS A METRIC THAT CANNOT MOVE. The arm above proves the §113 predicate moves
    // on live inputs; this one proves BOTH copy variants exist and still say what the SLT ruled, at the copy owner
    // rather than through the engine. §111's predicate (weekly volume, unchanged) reaches the clearing one too.
    //
    // ⚠️ This arm's own premise used to read *"the arm above proves §113 never clears"*, which was false for the
    // same reason — a stale sentence about a neighbour is how a true check acquires a wrong justification.
    const clearing = baseBuildOfferLine({ weeks: 12, endsAtKm: 24, reachesRaceDoor: true, distanceLabel: '24km' })
    const holding = baseBuildOfferLine({ weeks: 12, endsAtKm: 24, reachesRaceDoor: false, distanceLabel: '24km' })
    expect(clearing).toMatch(/race plan/i)
    expect(holding, 'the non-clearing variant has started making a race claim').not.toMatch(/race|marathon|half/i)
    expect(clearing).not.toBe(holding)
  })

  it('§111\'s own offer predicate is unchanged — weekly volume, as ratified', () => {
    // The §111 branch was moved into a shared helper; its predicate must not have moved with it.
    const input = runner(MARATHON, 30, { current_weekly_km: 8, longest_recent_run_km: 6 })
    let door = 0
    try { generateRulePlan(input, 'paid', PLAN_START) } catch (e) {
      expect(e).toBeInstanceOf(BaseVolumeError)
      door = (e as BaseVolumeError).base.min_base_km
    }
    expect(door).toBeGreaterThan(0)
    // With the flag on this runner is STAGED rather than refused, so §111's offer is reached only when staging
    // cannot place a checkpoint. The predicate is asserted directly instead of hunting for that case.
    expect(generateStagedRacePlan(input, PLAN_START, door), 'this runner is staged, so §111\'s branch is unreachable here')
      .not.toBeNull()
  })
})
