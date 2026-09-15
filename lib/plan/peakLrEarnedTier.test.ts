import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG as G, raceDistanceKey } from './generationConfig'
import { isLongRun } from './sessionRole'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

/**
 * §35 — INV-PLAN-PEAK-LR-EARNED-TIER can be made to FIRE.
 *
 * This is the liveness proof for one invariant, written as a test because the
 * mutation harness cannot produce it. `invariantLiveness` mutates a PLAN; §35's
 * tier lift is gated on an INPUT (`longest_recent_run_km` clearing §24's floor)
 * *and* on `volume_profile !== 'maintenance'` *and* on the long run being under
 * the minute cap. The harness's sample reaches inputs that qualify, but not the
 * conjunction, so the rule sat in the baseline reading as unwakeable while it
 * woke on the first qualifying plan tried by hand.
 *
 * A rule nothing can wake is UNPROVEN, not proven dead — and the answer to an
 * unprovable rule is to prove it somewhere else, not to lower the bar. This is
 * that somewhere else, and the baseline entry points here.
 */
const CODE = 'INV-PLAN-PEAK-LR-EARNED-TIER'

/** The first cohort input whose runner earns a tier above §24's floor. */
function qualifyingCase(): { input: GeneratorInput; plan: Plan } {
  for (const input of cohortGrid()) {
    const k = raceDistanceKey(input.race_distance_km)
    if (input.goal !== 'time_target' || (k !== 'HM' && k !== 'MARATHON')) continue
    if (input.longest_recent_run_km < input.race_distance_km * G.PEAK_LR_RATIO_VS_RACE[k]) continue
    let plan: Plan
    try { plan = generateRulePlan(input, 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch { continue }
    if (plan.meta.volume_profile === 'maintenance') continue
    const peaks = plan.weeks.filter(w => w.phase === 'peak' && w.type !== 'deload')
    if (!peaks.length) continue
    const lr = peaks.flatMap(w => Object.values(w.sessions)).find(s => s && isLongRun(s))
    if (!lr || lr.distance_km == null) continue
    return { input, plan }
  }
  throw new Error('no qualifying cohort case — the fixture premise is stale')
}

const peakLongRuns = (plan: Plan): Session[] =>
  plan.weeks.filter(w => w.phase === 'peak' && w.type !== 'deload')
    .flatMap(w => Object.values(w.sessions))
    .filter((s): s is Session => !!s && isLongRun(s))

/**
 * Shrink EVERY long run, not only the peak ones.
 *
 * The invariant exempts a plan whose longest run has ended up outside the peak
 * phase, because that is the signature of §47/§9/§45 having reshaped the peak —
 * and the tier cannot be judged on what survived that (LR-EARNED-TIER-01).
 * Shrinking peak weeks alone therefore builds a plan the invariant deliberately
 * ignores, and the liveness proof silently stopped proving anything. Scaling the
 * whole plan keeps the peak holding the peak, which is the shape the check is
 * actually about.
 */
function shrinkAllLongRuns(plan: Plan, factor: number, capMins?: number): void {
  for (const w of plan.weeks) {
    if (w.n < 1 || w.type === 'race') continue
    for (const sn of Object.values(w.sessions)) {
      if (!sn || !isLongRun(sn)) continue
      if (sn.distance_km != null) sn.distance_km = Math.round(sn.distance_km * factor * 2) / 2
      if (capMins != null) sn.duration_mins = capMins
      else if (sn.duration_mins != null) sn.duration_mins = Math.round(sn.duration_mins * factor)
    }
  }
}

describe('§35 — the earned-tier check is live', () => {
  it('stays silent when the peak phase no longer holds the plan\'s longest run', () => {
    // The exemption added by LR-EARNED-TIER-01. §47/§9/§45 reshape the peak after
    // sizing, and when they move the longest run out of the peak phase the tier
    // cannot be judged on what is left. Pinned so the exemption cannot be removed
    // without someone deciding to.
    const { input, plan } = qualifyingCase()
    for (const lr of peakLongRuns(plan)) {
      if (lr.distance_km != null) lr.distance_km = Math.round(lr.distance_km * 0.5 * 2) / 2
      if (lr.duration_mins != null) lr.duration_mins = 45
    }
    expect(validatePlan(plan, input).filter(v => v.code === CODE)).toEqual([])
  })

  it('a real generated plan for this runner is CLEAN (guards the guard)', () => {
    const { input, plan } = qualifyingCase()
    expect(validatePlan(plan, input).filter(v => v.code === CODE)).toEqual([])
  })

  it('FIRES when the peak long run stops at the floor', () => {
    // §35's "floor-stopping" made literal: the runner's inputs earn the target
    // tier, the long run is nowhere near the minute cap, and it stops short.
    const { input, plan } = qualifyingCase()
    shrinkAllLongRuns(plan, 0.5, 45)
    const fired = validatePlan(plan, input).filter(v => v.code === CODE)
    expect(fired.length, 'the tier check did not wake — it is enforcing nothing').toBeGreaterThan(0)
    expect(fired[0].severity).toBe('warn')
    expect(fired[0].principle_ref).toContain('§35')
  })

  it('does NOT fire when the MINUTE CAP is what binds', () => {
    // The exemption §35 states in its own text ("LONG_RUN_CAP_MINUTES still
    // binds"), and the one a circular km-conversion got wrong: a long run at the
    // cap has bought every kilometre that runner's pace allows.
    const { input, plan } = qualifyingCase()
    const distKey = raceDistanceKey(input.race_distance_km)
    shrinkAllLongRuns(plan, 0.5, G.LONG_RUN_CAP_MINUTES[distKey])
    expect(
      validatePlan(plan, input).filter(v => v.code === CODE),
      'fired on a long run already at the minute cap — the cap wins, §35 says so',
    ).toEqual([])
  })

  it('does NOT fire for a runner who has not earned a tier above the floor', () => {
    // `longest_recent_run_km` below §24's floor means tierRatio === ratio, and
    // §24's own invariant owns that case. Two invariants asserting one shortfall
    // is D-16; this proves the tier check stays out of the floor's territory.
    const { input, plan } = qualifyingCase()
    shrinkAllLongRuns(plan, 0.5, 45)
    const shallow = { ...input, longest_recent_run_km: 1 } as GeneratorInput
    expect(validatePlan(plan, shallow).filter(v => v.code === CODE)).toEqual([])
  })
})
