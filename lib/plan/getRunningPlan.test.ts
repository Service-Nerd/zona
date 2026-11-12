import { describe, it, expect } from 'vitest'
import { generateGetRunningPlan, getRunningWeeks, getRunningApplies } from './getRunningPlan'
import { validateBaseBuildBlock } from './baseBuildValidate'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG as G } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

const mk = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_distance_km: 42.195, race_date: '2027-04-25', days_available: 3,
  goal: 'finish', fitness_level: 'beginner', current_weekly_km: 5,
  longest_recent_run_km: 2, age: 32, injuries: [],
  recent_quality_training: 'none', training_age: '<6mo',
  ...over,
} as unknown as GeneratorInput)

/**
 * The denominator §111's ceiling is measured against: **the volume the BLOCK starts at**, which is what
 * `engine.ts` passes (`meta.base_build_start_km`) and is not always the runner's declared volume.
 *
 * 🔴 EVERY RATIO CASE BELOW USED TO PASS `cwk` ITSELF, AND IT WAS RIGHT UNTIL IT WASN'T.
 * Before `GETRUNNING-WALKRUN-FLOOR-01` (2026-11-12) this producer always seeded its ramp at the declared
 * volume, so the two numbers were equal and nothing distinguished them. A runner below §116's floor now gets a
 * walk-run start first and the ramp begins at the FLOOR — so passing `cwk` measures the block against a start
 * it does not have, and reported 11.35x on a plan production validates at 3.78x. **A fixture that reads the
 * field the producer stamps cannot drift from the producer again.**
 */
const blockStartKm = (plan: { meta: unknown }) =>
  Number((plan.meta as Record<string, unknown>).base_build_start_km ?? 0)

describe('§118 — the get-running plan', () => {
  it('is a plan with NO RACE, and says so in its own metadata', () => {
    const { plan } = generateGetRunningPlan(mk(), '2026-10-05', 29)
    // ⚠️ `base_build`, not `get_running` — SLT decision, and `plan_kind` is
    // PERSISTED so it had to be settled before any plan stored it.
    expect((plan.meta as any).plan_kind).toBe('base_build')
    expect((plan.meta as any).race_date).toBe('')
    // ⚠️ The §116 marker must be GONE. Leaving it would let a downstream reader
    // infer a marathon handover that does not exist — a plan claiming a
    // destination it has not got.
    expect((plan.meta as any).base_build_onramp).toBeUndefined()
  })

  it('serves every runner the race plans refuse', () => {
    // ⚠️ THE VOLUMES ABOVE 8 ARE ONRAMP-STEP-UNITS-01 (2026-09-23), AND THEY
    // ARE THE WHOLE POINT OF THIS LIST.
    //
    // This case used to stop at cwk 8. The §116 gate in `baseBuildValidate.test.ts`
    // does reach 15 — but it builds ON-RAMP plans, not these. So the cell
    // `cwk 15 x §118 x 12-15 weeks` was covered by NEITHER, and a real breach
    // of §116 amendment 2 lived there: 54 of 522 plans built for refused
    // marathoners, stepping +1.7 km against a +1.5 km bound.
    //
    // **Two corpora that each cover half a grid do not cover the grid.** The
    // runway is swept too, because the breach only appears on weeks 12-15 and a
    // short runway never reaches them.
    // ⚠️ TWO THINGS ARE SCALED HERE, AND BOTH WERE LEARNED THE HARD WAY.
    //
    // 1. `longest_recent_run_km`. The fixture default is 2 km. Holding it there
    //    while raising `current_weekly_km` to 15 describes someone running 15 km
    //    a week over three runs whose longest is 2 km — impossible. §111's own
    //    worked example uses `longest = 0.4 x cwk`; that ratio is used here.
    //
    // 2. The VOLUME CEILING. Above a weekly volume of `days x 15` km this plan
    //    CANNOT satisfy §116 amendment 2, and that is a conflict between two
    //    ratified rules rather than a defect — see the case below, which pins it.
    //    This case therefore sweeps the population §118 actually serves.
    // cwk stops at 12: at 3 days a 15-week ramp from 15 km/week reaches 56.7,
    // past the `days x 15` line where §2 and §116 Am.2 stop being jointly
    // satisfiable. That region is owned by the pinned conflict case below, not
    // asserted clean here — asserting it clean would mean weakening one of two
    // ratified rules to make a test pass.
    for (const cwk of [2, 3, 4, 5, 6, 7, 8, 10, 12]) {
      for (const runway of [8, 12, 16, 20, 29]) {
        const { plan } = generateGetRunningPlan(
          mk({ current_weekly_km: cwk, longest_recent_run_km: Math.max(1, Math.round(cwk * 0.4)),
               training_age: '<6mo' }),
          '2026-10-05', runway)
        expect(validateBaseBuildBlock(plan.weeks, blockStartKm(plan)), `cwk ${cwk} runway ${runway}`).toEqual([])
      }
    }
  })

  // 🔴 ONRAMP-STEP-UNITS-01 (2026-09-23) — A STRUCTURAL CONFLICT, PINNED SO IT
  // CANNOT BE REDISCOVERED AS A BUG.
  //
  // §2 caps WEEKLY growth at 10%. §116 amendment 2 caps the PER-RUN step at
  // WEEK1_PER_RUN_STEP_MAX_KM (1.5 km, absolute). A base-build week below
  // FOUNDATION_MIN_SESSIONS_FOR_LONG_RUN has no designated long run and splits
  // evenly, so its longest run is weekly/runs and a lawful 10% weekly rise
  // produces a per-run step of weekly/(runs x 10).
  //
  //     weekly / (runs x 10) > 1.5   <=>   weekly > runs x 15
  //
  // Above that line the two rules CANNOT BOTH HOLD. Measured: 3 days breaches
  // above 45 km/week, 4 days above 60 — exactly the prediction, every case.
  //
  // ⚠️ NOT REACHABLE BY ANY RUNNER §118 SERVES TODAY (0 of 522 plans built for
  // the refused marathon envelope), because those start low enough that 15
  // weeks of 10% never crosses the line. It is reachable for a runner at
  // 15-20 km/week, and §118 deliberately has NO volume target — "it builds for
  // the weeks available and stops" — so nothing bounds it there.
  //
  // FILED for the Coaching Board. Do not "fix" this by raising the per-run cap
  // or relaxing §2: both are ratified, Willy owns both, and which yields is his
  // call, not an implementer's.
  it('pins the §2 / §116 Am.2 conflict above weekly = days x 15', () => {
    const inp = mk({ current_weekly_km: 20, longest_recent_run_km: 8, days_available: 3 })
    const { plan } = generateGetRunningPlan(inp, '2026-10-05', 16)
    const breaches = validateBaseBuildBlock(plan.weeks, 20)
      .filter(v => v.code === 'INV-PLAN-ONRAMP-PER-RUN-STEP')
    // If this goes GREEN, the conflict has been resolved by a doctrine change
    // and this case plus its comment must be revisited — not deleted silently.
    expect(breaches.length,
      'the §2/§116 conflict no longer reproduces. If doctrine changed, update this case and the board filing.',
    ).toBeGreaterThan(0)
  })



  // ⚠️ AMENDMENT 1, AND THE NUMBER IS PHYSIOLOGICAL, NOT EDITORIAL. 16 weeks
  // was chosen for legibility and compounds to a 4.17x total build, above
  // §111's 4.0. Every week lawful, the sum not.
  it('never builds past §111s total-build ceiling, at any start', () => {
    for (const cwk of [2, 3, 5, 7, 8]) {
      const { plan, endsAtKm } = generateGetRunningPlan(mk({ current_weekly_km: cwk }), '2026-10-05', 29)
      const start = blockStartKm(plan)
      const ratio = endsAtKm / start
      expect(ratio, `cwk ${cwk} builds ${ratio.toFixed(2)}x from a ${start}km block start`).toBeLessThanOrEqual(G.MAX_BASE_BUILD_RATIO)
      expect(validateBaseBuildBlock(plan.weeks, start).map(v => v.code))
        .not.toContain('INV-PLAN-GET-RUNNING-BUILD-RATIO')
    }
  })

  /**
   * 🔴 L4 — *"the walk-run start is never shortened; the ramp is cut first, else the walk-run start alone"* —
   * AND IT WAS UNREACHABLE FROM THIS CALLER THROUGH TWO SUCCESSIVE VERSIONS OF THIS CODE.
   *
   * `getRunningWeeks` floors at `GET_RUNNING_MIN_WEEKS` (8) and the walk-run start is 7 weeks, so the ramp
   * budget was never below 1 — a `Math.max(0, …)` that can never return 0, twice, and a comment claiming
   * otherwise. Worse, a ONE-week ramp cannot climb: `onRampCurve(6, 1)` is `[6]`, so `endsAtKm === startKm`
   * and the offer published *"you will reach 6 km a week"* having built nothing. **And the guard for a
   * non-climbing ramp, `INV-PLAN-ONRAMP-CURVE-CLIMBS`, never enters its loop on a single-element curve —
   * blind to the only shape that cannot climb.**
   */
  it('🔴 a runway too short for a real ramp gets the walk-run start ALONE (L4), not a ramp of one week', () => {
    for (const runway of [1, 4, 8]) {
      const { plan, weeks, endsAtKm } = generateGetRunningPlan(mk({ current_weekly_km: 2 }), '2026-10-05', runway)
      const ramp = plan.weeks.filter(w => w.phase === 'base_build')
      const wr = plan.weeks.filter(w => w.phase === 'walk_run_start')
      expect(ramp.length, `runway ${runway}: a one-week ramp is not a ramp`).toBe(0)
      expect(wr.length, `runway ${runway}: the walk-run start is never shortened`).toBe(G.WALK_RUN_START_SESSIONS > 0 ? wr.length : 0)
      expect(wr.length).toBeGreaterThan(0)
      expect(weeks, `runway ${runway}: the plan IS the walk-run start`).toBe(wr.length)
      expect(endsAtKm, 'and it ends at the floor the walk-run start brings them to')
        .toBe(G.BASE_BUILD_ONRAMP_MIN_START_KM)
    }
  })

  it('and a runway that does hold a ramp gets one that CLIMBS', () => {
    // The other side of the cut, so the arm above cannot pass by cutting every ramp.
    const { plan } = generateGetRunningPlan(mk({ current_weekly_km: 2 }), '2026-10-05', 29)
    const km = plan.weeks.filter(w => w.phase === 'base_build').map(w => w.weekly_km ?? 0)
    expect(km.length).toBeGreaterThan(1)
    expect(Math.max(...km), 'the ramp must rise above its own start').toBeGreaterThan(km[0])
  })

  /**
   * 🔴 THE RESIDUAL — AND THIS CASE'S FIRST VERSION STATED IT BACKWARDS.
   *
   * It read *"the DECLARED-volume ratio is large for a sub-floor runner, which §111 does not bind"*, and I
   * justified that from `INV-PLAN-GET-RUNNING-BUILD-RATIO`, whose denominator is the caller-supplied block
   * start. **§111 has a SECOND invariant with the other denominator.**
   * `INV-PLAN-BASE-BUILD-RATIO` (`invariants.ts`, **error** severity) is peak over the runner's **raw
   * `current_weekly_km`**, and its own comment says it exists to catch *"any plan that reaches validatePlan
   * over the ceiling by ANOTHER ROUTE"* — a §118 plan, built because the runner was refused, is that route.
   * Measured: it fires at **5.8x** on a 2 km/week runner. **I reasoned from one of two registers and wrote
   * the conclusion as fact.**
   *
   * ⚠️ IT IS NOT A NEW CLASS AND THE BOARD HAS SEEN IT. The staged path seeds its ramp at the same floor and
   * has since 2026-10-25 (L1–L5), and the 2026-11-07 HM sitting recorded exactly these as *"label artefacts
   * at cw <= 2 where the denominator is zero"*. What this ship did was extend the shape to §118's path.
   * ⚠️ AND NOTHING REPORTS IT TODAY: `engine.ts`'s §118 branch returns the plan without calling
   * `validatePlan` or `enforceViolations` at all, so the error is latent on that path. Filed as
   * `GETRUNNING-S111-DENOMINATOR-01` — which denominator governs a ramp that follows a walk-run start is the
   * board's, not an implementer's, and it applies to the staged path identically.
   *
   * This case now asserts BOTH invariants' verdicts, so neither can be quoted without the other.
   */
  it('🔴 the two §111 ratio invariants DISAGREE on a sub-floor plan, and both verdicts are asserted', () => {
    const input = mk({ current_weekly_km: 2, longest_recent_run_km: 1 })
    const { plan, endsAtKm } = generateGetRunningPlan(input, '2026-10-05', 29)
    expect(plan.weeks.some(w => w.phase === 'walk_run_start'), 'below the floor, so a walk-run start').toBe(true)
    expect(blockStartKm(plan), 'the ramp starts at the floor, not at the runner').toBe(G.BASE_BUILD_ONRAMP_MIN_START_KM)

    // (a) block-start denominator — satisfied, which is what `validateBaseBuildBlock` checks.
    expect(endsAtKm / blockStartKm(plan)).toBeLessThanOrEqual(G.MAX_BASE_BUILD_RATIO)
    expect(validateBaseBuildBlock(plan.weeks, blockStartKm(plan)).map(v => v.code))
      .not.toContain('INV-PLAN-GET-RUNNING-BUILD-RATIO')

    // (b) raw declared-volume denominator — NOT satisfied, and it is an `error`.
    const s111 = validatePlan(plan, input).filter(v => v.code === 'INV-PLAN-BASE-BUILD-RATIO')
    expect(s111.length, 'if this goes empty the board has ruled, or the seeding changed — update the filing')
      .toBeGreaterThan(0)
    expect(s111[0].severity).toBe('error')
    expect(endsAtKm / 2).toBeGreaterThan(G.MAX_BASE_BUILD_RATIO)
  })

  // The ratio is a property of the CURVE, not the runner — which is why the fix
  // was one number and not a per-runner cap.
  it('builds by the same RATIO whatever the start — it is the curve, not the runner', () => {
    // ⚠️ THE PROPERTY HOLDS WITHIN EACH SIDE OF §116's FLOOR AND NOT ACROSS IT, and the asymmetry is
    // deliberate rather than a regression. A sub-floor runner spends seven of the plan's weeks on the
    // walk-run start, so their ramp is SHORTER (8 weeks) than an above-floor runner's (15) — the
    // `/code-review` correction to `GETRUNNING-WALKRUN-FLOOR-01`, which stopped the walk-run start
    // being ADDED to the plan's length and made it come out of it instead. Same curve, fewer weeks of
    // it. Asserting one ratio across the boundary would be asserting the two cohorts get the same
    // number of ramp weeks, which they must not.
    // 🔴 THE SUB-FLOOR SIDE VARIES THE RUNWAY, NOT THE VOLUME, AND THE FIRST CUT DID THE OPPOSITE.
    // Below the floor the ramp is seeded at `BASE_BUILD_ONRAMP_MIN_START_KM` regardless of what the runner
    // declared, so cwk 1/2/3/5 produce **the same plan**: four identical ratios, an arm that could not
    // fail, and a property that reads as tested while asserting `x === x`. Varying the runway varies the
    // ramp LENGTH, which is the thing the curve property is actually about.
    const ratioFor = (cwk: number, runway = 29) => {
      const { plan, endsAtKm } = generateGetRunningPlan(mk({ current_weekly_km: cwk }), '2026-10-05', runway)
      return { ratio: endsAtKm / blockStartKm(plan), ramp: plan.weeks.filter(w => w.phase === 'base_build').length }
    }
    const sub = [1, 2, 3, 5].map(c => ratioFor(c))
    const over = [7, 8, 10].map(c => ratioFor(c))
    for (const r of sub) expect(r.ratio, `sub-floor ${r.ramp}w`).toBeCloseTo(sub[0].ratio, 1)
    for (const r of over) expect(r.ratio, `above-floor ${r.ramp}w`).toBeCloseTo(over[0].ratio, 1)
    // The sub-floor cohort is identical BY CONSTRUCTION (same seed, same length), so assert that rather
    // than dressing it as the curve property, and get the real variation from the runway.
    expect(new Set(sub.map(r => r.ramp)).size, 'the seed does not depend on the declared volume').toBe(1)
    const byRunway = [12, 16, 22, 29].map(rw => ratioFor(2, rw))
    expect(new Set(byRunway.map(r => r.ramp)).size, 'the runway must actually move the ramp length')
      .toBeGreaterThan(1)
    for (let i = 1; i < byRunway.length; i++)
      expect(byRunway[i].ratio, `runway grew, so the ramp climbs further (${byRunway[i].ramp}w)`)
        .toBeGreaterThanOrEqual(byRunway[i - 1].ratio)
    // 🔑 And the REASON they differ is the ramp length, asserted so the next reader does not read the
    // two ratios as a defect. Without this the case would pass on two cohorts that differ for any reason.
    expect(sub[0].ramp, 'a sub-floor ramp is shortened by the walk-run start').toBeLessThan(over[0].ramp)
    expect(sub[0].ratio).toBeLessThan(over[0].ratio)
    // Both inside §111's ceiling, which is the thing that actually matters.
    for (const r of [...sub, ...over]) expect(r.ratio).toBeLessThanOrEqual(G.MAX_BASE_BUILD_RATIO)
  })

  it('the invariant catches a build past the ceiling that no week-on-week rule can see', () => {
    const { plan } = generateGetRunningPlan(mk(), '2026-10-05', 29)
    // Inflate only the LAST week: every week-on-week check is blind to this.
    plan.weeks[plan.weeks.length - 1].weekly_km = 999
    expect(validateBaseBuildBlock(plan.weeks, 5).map(v => v.code))
      .toContain('INV-PLAN-GET-RUNNING-BUILD-RATIO')
  })

  it('sizes itself to the runway, between the declared bounds', () => {
    expect(getRunningWeeks(4)).toBe(G.GET_RUNNING_MIN_WEEKS)
    expect(getRunningWeeks(11)).toBe(11)
    expect(getRunningWeeks(40)).toBe(G.GET_RUNNING_MAX_WEEKS)
    expect(G.GET_RUNNING_MAX_WEEKS).toBe(15)
  })

  it('declines a runner with no base at all rather than inventing one', () => {
    expect(getRunningApplies(mk({ current_weekly_km: 0 }))).toBe(false)
  })
})
