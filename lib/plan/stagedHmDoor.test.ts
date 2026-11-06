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
  it('the premise still holds: §113 governs the half and §111 does not', () => {
    // 🔴 GUARDS EVERY ARM BELOW. If §113 stopped governing the half, or §111 started, the arms would pass for a
    // reason that has nothing to do with the ruling. §111's own text claims this runner is served at the half —
    // *"a never-run beginner still generates there"* — and §113, ratified the same day, made that false.
    expect(HM).toBeGreaterThanOrEqual(GENERATION_CONFIG.LONG_RUN_READINESS_MIN_RACE_KM)
    expect(baseBuildRatioApplies(HM), '§111 now governs the half — Am. 11 part 2 is moot and must be re-ruled').toBe(false)
    expect(baseBuildRatioApplies(MARATHON)).toBe(true)
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
          if (walkRunStartApplies(effectiveStartKm(input))) continue
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
    expect(walkRunStartApplies(effectiveStartKm(high)), 'this runner is below the running floor; pick a higher one').toBe(false)
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
    const gi = (plan.meta as unknown as { generator_input?: Record<string, unknown> }).generator_input
    expect(gi, 'the staged plan carries no generator_input, so this arm cannot test anything').toBeTruthy()
    delete gi!.age
    expect(() => validateStagedRace(plan), 'a validator that throws takes its caller down with it').not.toThrow()
    // ⚠️ AND IT MUST NOT QUIETLY PASS EITHER — no violation is the right answer, and the ratio is simply unknown.
    expect(validateStagedRace(plan).filter(v => v.code === 'INV-PLAN-STAGED-DOOR-RATIO')).toEqual([])
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
    // ⚠️ SO THE CLEARING VARIANT IS UNREACHABLE FOR §113, BY CONSTRUCTION, AND THIS ARM SAYS SO RATHER THAN
    // PRETENDING TO VARY. A §113 refusal now survives only where staging could NOT place a checkpoint, which means
    // the runway cannot hold a base build plus §44's block — so the base build cannot leave room for a race plan.
    // An arm asserting both values would be asserting the defect.
    let offers = 0
    for (const [dk, cw, lr, runway, days] of [
      [MARATHON, 10, 2, 10, 3], [HM, 6, 1, 10, 3], [HM, 8, 2, 12, 4], [MARATHON, 20, 4, 14, 3], [50, 15, 3, 16, 3],
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
  })

  it('the clearing variant is still live copy, not dead code, and §111 is the branch that reaches it', () => {
    // ⚠️ A BOOLEAN THAT CANNOT MOVE IS A METRIC THAT CANNOT MOVE. The arm above proves §113 never clears; this
    // proves the other variant still exists and still says what the SLT ruled it must, so the two-variant machinery
    // is not half-dead. §111's predicate (weekly volume, unchanged) is the branch that can reach it.
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
