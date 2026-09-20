import type { GeneratorInput, Plan, Week } from '@/types/plan'
import { generateFoundationBlock } from './foundationBlock'
import { GENERATION_CONFIG } from './generationConfig'
import { effectiveStartKm } from './startVolume'

/**
 * P-16 — the base-build on-ramp. §116.
 *
 * THE SINGLE OWNER of "this runner is refused by §111; can we offer them an
 * eleven-week ramp instead of a closed door, and how long must it be?"
 *
 * WHY THIS EXISTS. §111 refuses the sub-12 km/week marathoner and **names a
 * base-building plan as the remedy**. §57 makes that remedy structurally
 * impossible: `foundationBlock.ts` sizes every week as
 * `min(baseline × 1.1^i, baseline × 1.10)`, so **every week from the second is
 * `baseline × 1.10` — flat, at any length.** Two principles in deadlock, each
 * unseen by the other because each sitting was convened on its own question.
 *
 * ⚠️ THIS MODULE DECIDES AND SIZES. IT DOES NOT BUILD WEEKS. Week construction
 * has one owner (`generateFoundationBlock`), which now takes a curve policy.
 * A second week-builder is the D-08 shape this repo keeps recording.
 *
 * ⚠️ §111 IS NOT CREDITED IN ADVANCE (board amendment 7). The ramp does not
 * lower the gate. The runner performs it, re-declares their volume, and is
 * gated on OBSERVED data. `S111-FOUNDATION-CREDIT-01` — crediting unperformed
 * training — was VETOED and this is deliberately not that.
 *
 * ⚠️ THE RAMP MUST STAND ALONE (board amendment 8). If the runner never comes
 * back it must still be a good eleven weeks, which is why it carries §3's
 * deload cadence rather than climbing monotonically to a handover.
 */

/** Why an on-ramp was or was not offered. Never a bare boolean — a refused
 *  runner needs to be told which of these it was. */
export type OnRampOutcome =
  /** §111 does not refuse this runner; no ramp is needed. */
  | 'not_needed'
  /** Offered: the ramp reaches the base §111 requires and leaves enough runway. */
  | 'offered'
  /** The ramp would reach the base but leaves under §44's ratified 16 weeks. */
  | 'insufficient_runway'
  /** The runner is below the floor at which a running ramp is the right tool. */
  | 'below_floor'

export interface OnRampAssessment {
  outcome: OnRampOutcome
  /** Weeks of ramp needed to reach `targetKm`. 0 when not offered. */
  rampWeeks: number
  /** Weeks of race plan left after the ramp. */
  remainingWeeks: number
  /** The weekly volume the ramp is trying to reach — §111's own `minBaseKm`. */
  targetKm: number
  /** Where the ramp starts: the volume the ENGINE starts from, not the raw
   *  wizard figure. Same owner as §111's denominator so they cannot drift. */
  startKm: number
}

/**
 * The week-by-week volume curve: §2's rate, §3's cadence.
 *
 * Deliberately NOT §57's `FOUNDATION_WEEKLY_INCREASE_PCT`. Willy's amendment 1:
 * a pre-plan block that builds is governed by the same ramp rule as any other
 * building block, and §57's number was chosen for a gap-filler that was never
 * meant to climb.
 *
 * Returns one entry per week, already deloaded. Index 0 is week 1 of the ramp.
 */
export function onRampCurve(startKm: number, weeks: number): number[] {
  const ratePct = GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT
  const freq    = GENERATION_CONFIG.BASE_BUILD_ONRAMP_DELOAD_FREQUENCY
  const deload  = GENERATION_CONFIG.RECOVERY_WEEK_VOLUME_PCT

  const out: number[] = []
  let carried = startKm          // the build line, which a deload does not reset
  for (let i = 0; i < weeks; i++) {
    const weekN = i + 1
    if (i > 0) carried = carried * (1 + ratePct / 100)
    // ⚠️ A DELOAD DIPS, IT DOES NOT RATCHET THE LINE DOWN. The build continues
    // from `carried`, so the week after a deload resumes the climb rather than
    // re-climbing ground already covered. The deload RATCHET is a defect this
    // repo has recorded once already.
    const isDeload = weekN % freq === 0 && weekN !== weeks
    out.push(floor1dp(isDeload ? carried * (deload / 100) : carried))
  }
  return out
}

/** How many §2-rate weeks, with §3 deloads, to climb from `startKm` to `targetKm`. */
export function onRampWeeksNeeded(startKm: number, targetKm: number): number {
  if (startKm <= 0) return 0
  if (targetKm <= startKm) return 0
  const max = GENERATION_CONFIG.BASE_BUILD_ONRAMP_MAX_WEEKS
  for (let w = 1; w <= max; w++) {
    const curve = onRampCurve(startKm, w)
    // The HANDOVER volume is the last week, and the last week is never a
    // deload (see `isDeload` above) — the runner must hand over on the line,
    // not in a dip, or §111 re-gates them on a number they did not build to.
    if (curve[curve.length - 1] >= targetKm) return w
  }
  return max
}

/**
 * Should this runner be offered an on-ramp instead of a refusal?
 *
 * `runwayWeeks` is the total weeks between today and the race — the caller
 * owns that arithmetic, because the route already computes it and a second
 * date calculation is a second source of truth.
 */
export function assessOnRamp(
  input: GeneratorInput,
  minBaseKm: number,
  runwayWeeks: number,
): OnRampAssessment {
  const startKm = effectiveStartKm(input)
  const none = (outcome: OnRampOutcome): OnRampAssessment =>
    ({ outcome, rampWeeks: 0, remainingWeeks: runwayWeeks, targetKm: minBaseKm, startKm })

  if (minBaseKm <= startKm) return none('not_needed')

  // ⚠️ TWO FLOORS, AND ONLY ONE OF THEM IS A NUMBER.
  //
  // **The COACHING floor** is Willy's: below it a running ramp is not the right
  // tool, because run-walk is for someone who cannot already run 2 km at a
  // time. It is a judgement and it is `BASE_BUILD_ONRAMP_MIN_START_KM`.
  //
  // **The ARITHMETIC floor is DERIVED, NOT STORED** — the lowest start from
  // which the ramp actually reaches the target inside the runway. It falls out
  // of `onRampWeeksNeeded` and the remaining-weeks bound below, so there is
  // nothing to keep in sync.
  //
  // 🔴 WHY THIS IS DERIVED NOW AND WAS NOT BEFORE. The 6 was chosen when the
  // target was 18 km/wk (peak 52 / §111's 4.0) and 6 was exactly where 13 weeks
  // of ramping got you. **§117 dropped the beginner finish-goal peak to 34, so
  // the target is 9 and the arithmetic floor moved to 3** — from 3 km/wk the
  // ramp reaches 9 in 13 weeks, exactly inside the budget.
  //
  //     start   weeks to 18 (old target)   weeks to 9 (§117)
  //         3                        20                  13  <- fits now
  //         4                        17                  10
  //         5                        15                   8
  //         6                        13                   6
  //
  // A derived number written out by hand goes stale the moment the thing it
  // was derived from moves, and it did, within hours. **Now it cannot.**
  if (startKm < GENERATION_CONFIG.BASE_BUILD_ONRAMP_MIN_START_KM) return none('below_floor')

  const rampWeeks = onRampWeeksNeeded(startKm, minBaseKm)
  if (rampWeeks === 0) return none('not_needed')

  const remainingWeeks = runwayWeeks - rampWeeks
  // McMillan's amendment 3: §44's ratified 16-week threshold, not a new number.
  if (remainingWeeks < GENERATION_CONFIG.BASE_BUILD_ONRAMP_MIN_REMAINING_WEEKS) {
    return { outcome: 'insufficient_runway', rampWeeks, remainingWeeks, targetKm: minBaseKm, startKm }
  }

  return { outcome: 'offered', rampWeeks, remainingWeeks, targetKm: minBaseKm, startKm }
}

/** FLOOR to 1dp, never round — rounding must never carry a value past a cap.
 *  Same rule and the same reason as `foundationBlock.ts`. */
function floor1dp(km: number): number {
  return Math.floor(km * 10) / 10
}

// ─── The flag ─────────────────────────────────────────────────────────────────
//
// §116 ships DARK. The Coaching Board's chair gated it explicitly: build behind
// a flag, generate the cohort, run `measure:fitness` and the property sweep,
// bring the numbers back. The 2026-09-19 record is the standing reminder — a
// hand-rolled grid showed 0 violations where the sweep showed 884.
//
// ⚠️ DEFAULT OFF, and off means the refusal payload is byte-identical to what
// it was before §116 existed. A flag whose "off" state still changes behaviour
// is not a flag.
export function onRampEnabled(): boolean {
  return process.env.ENABLE_BASE_BUILD_ONRAMP === '1'
}

/**
 * The offer attached to a §111 refusal, or `null`.
 *
 * ⚠️ IT IS AN OFFER, NOT A SUBSTITUTION. The engine does not quietly hand a
 * runner who asked for a marathon plan an eleven-week base block instead —
 * ADR-012's whole model is that a structural change surfaces for confirmation.
 * The runner chooses. Rendering that choice is `P-15`'s job, not this module's.
 */
export interface OnRampOffer {
  weeks: number
  /** Weeks of race plan that remain after it. */
  remaining_weeks: number
  /** Where the ramp starts and ends, km/week. */
  start_km: number
  target_km: number
}

export function onRampOfferFor(
  input: GeneratorInput,
  minBaseKm: number,
  runwayWeeks: number,
): OnRampOffer | null {
  if (!onRampEnabled()) return null
  const a = assessOnRamp(input, minBaseKm, runwayWeeks)
  if (a.outcome !== 'offered') return null
  return {
    weeks: a.rampWeeks,
    remaining_weeks: a.remainingWeeks,
    start_km: a.startKm,
    target_km: a.targetKm,
  }
}


// ─── The plan itself ──────────────────────────────────────────────────────────

/**
 * Build the on-ramp as a STANDALONE plan the runner follows to completion.
 *
 * ⚠️ BOARD AMENDMENT 8: *"if they never return it must still be a good eleven
 * weeks."* So this is a plan object in its own right — positive week numbers,
 * its own `plan_kind`, renderable by every screen — and **not** a block
 * prepended to a marathon plan that does not exist yet.
 *
 * ⚠️ BOARD AMENDMENT 7: it does NOT generate the race plan and does not credit
 * §111 in advance. The runner finishes this, re-declares their volume, and is
 * gated on OBSERVED data.
 *
 * ⚠️ Week CONSTRUCTION is `generateFoundationBlock`'s under a `ramp` curve —
 * one owner of "build an easy-only week with a capped long run", two volume
 * policies. The phase is then restamped `base_build`, because sharing §57's
 * PHASE would inherit §57's whole invariant surface (see `types/plan.ts`).
 */
export function generateBaseBuildPlan(
  input: GeneratorInput,
  planStart: string,
  assessment: OnRampAssessment,
): Plan {
  const weeklyKm = onRampCurve(assessment.startKm, assessment.rampWeeks)

  const { weeks: built } = generateFoundationBlock({
    input,
    // The block generator dates weeks BACKWARDS from a plan start, so handing
    // it the start of the race plan would date the ramp into the past. The
    // ramp's own end is its reference point.
    planStartDate: addWeeks(planStart, assessment.rampWeeks),
    today: planStart,
    curve: 'ramp',
    rampWeeklyKm: weeklyKm,
  })

  // Restamp: a standalone plan counts from week 1, and carries its own phase.
  const weeks: Week[] = built.map((w, i) => ({ ...w, n: i + 1, phase: 'base_build' }))

  return {
    meta: {
      ...(input as unknown as Record<string, unknown>),
      plan_kind: 'base_build',
      base_build_onramp: true,
      race_name: 'Base building',
      // No race date: this plan has no start line, and a countdown against one
      // would be the plan claiming something it does not deliver.
      race_date: '',
      race_distance_km: input.race_distance_km,
      plan_start: planStart,
      // What it is FOR, so the handover is legible to the runner and to us.
      base_build_target_km: assessment.targetKm,
      base_build_start_km: assessment.startKm,
      last_updated: new Date().toISOString(),
    } as unknown as Plan['meta'],
    weeks,
  }
}

function addWeeks(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n * 7)
  return d.toISOString().split('T')[0]
}
