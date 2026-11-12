import { describe, it, expect } from 'vitest'
import { generateGetRunningPlan, getRunningWeeks, getRunningApplies } from './getRunningPlan'
import { validateBaseBuildBlock } from './baseBuildValidate'
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
   * 🔴 THE RESIDUAL, ASSERTED RATHER THAN LEFT FOR SOMEONE TO FIND.
   *
   * Measured against the runner's DECLARED volume a sub-floor plan builds far past 4.0 — a 2 km/week runner
   * ends at 22.7 km, **11.35x**. §111's ceiling does not bind that, because its denominator is the block's
   * start and the walk-run start is ratified as bringing the runner TO the floor (Coaching Board 2026-10-25,
   * L1-L5; the staged path has had the same arithmetic since, and the 2026-11-07 HM sitting recorded it as
   * "label artefacts at cw <= 2 where the denominator is zero").
   *
   * This case exists so the number is visible and so nobody reads the case above as a claim it is not. If the
   * board ever rules the declared volume IS the denominator for this cohort, this is the case that fails.
   */
  it('and the DECLARED-volume ratio is large for a sub-floor runner, which §111 does not bind', () => {
    const { plan, endsAtKm } = generateGetRunningPlan(mk({ current_weekly_km: 2, longest_recent_run_km: 1 }), '2026-10-05', 29)
    expect(plan.weeks.some(w => w.phase === 'walk_run_start'), 'below the floor, so a walk-run start').toBe(true)
    expect(blockStartKm(plan), 'the ramp starts at the floor, not at the runner').toBe(G.BASE_BUILD_ONRAMP_MIN_START_KM)
    expect(endsAtKm / 2).toBeGreaterThan(G.MAX_BASE_BUILD_RATIO)
    expect(endsAtKm / blockStartKm(plan)).toBeLessThanOrEqual(G.MAX_BASE_BUILD_RATIO)
  })

  // The ratio is a property of the CURVE, not the runner — which is why the fix
  // was one number and not a per-runner cap.
  it('builds by the same RATIO whatever the start — it is the curve, not the runner', () => {
    // ⚠️ MEASURED OFF THE BLOCK'S START, WHICH IS WHAT MAKES THE PROPERTY TRUE ACROSS §116's FLOOR.
    // 2, 3 and 5 km/week now share one ramp (seeded at the floor after a walk-run start) and 7 has its own,
    // and all four land on the same ratio — which is the point: it is the curve.
    const ratios = [2, 3, 5, 7].map(cwk => {
      const { plan, endsAtKm } = generateGetRunningPlan(mk({ current_weekly_km: cwk }), '2026-10-05', 29)
      return endsAtKm / blockStartKm(plan)
    })
    for (const r of ratios) expect(r).toBeCloseTo(ratios[0], 1)
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
