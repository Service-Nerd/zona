import type { GeneratorInput, Plan, Week } from '@/types/plan'
import { generateFoundationBlock } from './foundationBlock'
import { hasVolumeCappedInjuryHistory } from './injuryScope'
import { buildWeekCeilingKm, deloadVolumeFraction } from './deloadCadence'
import { GENERATION_CONFIG } from './generationConfig'
import { effectiveStartKm } from './startVolume'
import { buildHRZonesWithFallback } from './hrZones'

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

export type RampProfile = 'standard' | 'volume_capped_injury'

/**
 * ONRAMP-INJURY-CLIMB-01 (§116 Am. 16) — which ramp rules apply to this runner. One owner, REQUIRED at every
 * `onRampCurve` / `onRampWeeksNeeded` call site with no default: a defaulted profile is how a caller silently
 * ramps a knee/shin runner on the healthy curve. The cohort is §12's own producer owner.
 */
export function rampProfileFor(input: Pick<GeneratorInput, 'injury_history'>): RampProfile {
  return hasVolumeCappedInjuryHistory(input.injury_history) ? 'volume_capped_injury' : 'standard'
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
export function onRampCurve(startKm: number, weeks: number, profile: RampProfile): number[] {
  const freq = GENERATION_CONFIG.BASE_BUILD_ONRAMP_DELOAD_FREQUENCY
  if (profile === 'volume_capped_injury') return injuryRampCurve(startKm, weeks, freq)

  const ratePct = GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT
  const deload  = GENERATION_CONFIG.RECOVERY_WEEK_VOLUME_PCT

  const out: number[] = []
  let carried = startKm          // the build line, which a deload does not reset
  for (let i = 0; i < weeks; i++) {
    const weekN = i + 1
    if (i > 0) carried = carried * (1 + ratePct / 100)
    // ⚠️ A DELOAD DIPS, IT DOES NOT RATCHET THE LINE DOWN. The build continues
    // from `carried`, so the week after a deload resumes the climb rather than
    // re-climbing ground already covered. The deload RATCHET is a defect this
    // repo has recorded once already. HEALTHY RUNNERS ONLY: §2 leaves the healthy
    // bounceback unbounded (RAMP-BOUNCEBACK-01); §116 Am. 16 does not touch this branch.
    const isDeload = weekN % freq === 0 && weekN !== weeks
    out.push(floor1dp(isDeload ? carried * (deload / 100) : carried))
  }
  return out
}

/**
 * §116 Am. 16 — a §12-capped (knee/shin) runner's ramp is the race engine's own combination of §2, §2 Am. 2 and
 * §2 Am. 3, through the SAME owner (`buildWeekCeilingKm`):
 *   1. an ordinary week rises at most `INJURY_WEEKLY_INCREASE_CAP_PCT` over the previous week;
 *   2. a deload is `deloadVolumeFraction(true)` (85%) of the previous week AS PRESCRIBED, with no carried line;
 *   3. the week after a deload returns to the pre-deload week and no higher (5%-capped instead if §2 Am. 3's
 *      gate has withdrawn itself);
 *   4. growth resumes at 5% from there. Net ×1.05² per 4-week cycle.
 *
 * ⚠️ §2 Am. 1's capped bounceback is WITHDRAWN and must not be restored: with an 85% deload it is
 * ×1.05³ × 0.85 = 0.984 per cycle (the ruling measured 216 of 425 grid ramps ending at or below their start).
 *
 * The +0.1 km floor on an ordinary week is the `floor1dp` unit, not a coaching number: at 2–3 km/week, 5% floors
 * to nothing and the ramp would sit flat. It never lifts a bounceback above pre-deload.
 */
function injuryRampCurve(startKm: number, weeks: number, freq: number): number[] {
  const out: number[] = []
  for (let i = 0; i < weeks; i++) {
    const weekN = i + 1
    if (i === 0) { out.push(floor1dp(startKm)); continue }
    const prev = out[i - 1]
    const isDeload = weekN % freq === 0 && weekN !== weeks
    if (isDeload) { out.push(floor1dp(prev * deloadVolumeFraction(true))); continue }
    const prevWasDeload = (weekN - 1) % freq === 0 && i >= 2
    const preDeload = prevWasDeload ? out[i - 2] : prev
    const ceiling = buildWeekCeilingKm({
      prevKm: prev,
      preDeloadKm: preDeload,
      prevWasDeload,
      allowancePct: GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT,
      injuryCapPct: GENERATION_CONFIG.INJURY_WEEKLY_INCREASE_CAP_PCT,
    })
    // `ceiling === preDeload` exactly when the bounceback returns to pre-deload: take the stored value rather than
    // re-flooring it, so a binary-fraction artefact cannot land the return a step BELOW the week it returns to.
    const atCeiling = prevWasDeload && ceiling === preDeload ? preDeload : floor1dp(ceiling)
    const oneStep = Math.round(prev * 10 + 1) / 10
    out.push(prevWasDeload ? Math.min(preDeload, Math.max(atCeiling, oneStep)) : Math.max(atCeiling, oneStep))
  }
  return out
}

/** How many §2-rate weeks, with §3 deloads, to climb from `startKm` to `targetKm`. */
export function onRampWeeksNeeded(startKm: number, targetKm: number, profile: RampProfile): number {
  if (startKm <= 0) return 0
  if (targetKm <= startKm) return 0
  const max = GENERATION_CONFIG.BASE_BUILD_ONRAMP_MAX_WEEKS
  for (let w = 1; w <= max; w++) {
    const curve = onRampCurve(startKm, w, profile)
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

  const rampWeeks = onRampWeeksNeeded(startKm, minBaseKm, rampProfileFor(input))
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
// 🟢 SWITCHED ON 2026-10-25 by the founder (NO-RUNNER-TURNED-AWAY-01, after Phases B–E, the coach review of real
// plans, the code review and the Design Board's render pass). **ON BY DEFAULT IN CODE**, not by a production-only
// env var, because a gate must measure what ships: with an env var, CI and every harness would have kept measuring the
// old off-state while production ran the new one. `ENABLE_BASE_BUILD_ONRAMP=0` is the off-switch, and off still means
// the refusal payload is byte-identical to what it was before §116 existed.
export function onRampEnabled(): boolean {
  return process.env.ENABLE_BASE_BUILD_ONRAMP !== '0'
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
  const weeklyKm = onRampCurve(assessment.startKm, assessment.rampWeeks, rampProfileFor(input))

  // 🔴 BASEBUILD-ZONE-CEILING-01 (Coaching Board, 2026-10-10) — §84 Am.1 says
  // `hr_target` IS the prescription and `session.zone` is a label ABOUT it. Measured
  // on both live base-build plans: every session carried `zone: "Zone 2"` and ZERO
  // carried an `hr_target` (51/51 and 30/30), against ~86% on race plans. **The label
  // was standing on its own.**
  //
  // ⚠️ THE MECHANISM ALREADY EXISTED AND THIS CALLER NEVER USED IT.
  // `generateFoundationBlock` sets `hr_target` from `easyTargets` (shipped yesterday as
  // FOUNDATION-PACE-STRIPPED-01, after 381 of 381 foundation sessions carried neither
  // pace nor HR). `foundationCompose` passes it via `easyTargetsFromPlan(plan)` — which
  // reads a GENERATED plan, and a base build has none at this point. That chicken-and-egg
  // is why it was never threaded, so the fix derives from the INPUT instead.
  //
  // 🔴 AMENDMENT 1 (Hutchinson, binding): DERIVED THROUGH §50's GUARD, NEVER THE RAW
  // INPUT. `buildHRZonesWithFallback` calls `resolveMaxHr`, which rejects a supplied max
  // below the age estimate as a device FLOOR. On live plan `3df045d5` — age 25,
  // `max_hr: 182`, `max_hr_source: 'observed'`, Tanaka 191 — the raw value would have
  // given a Z2 ceiling of ~144 against ~150 from the estimate: **six beats low for
  // fifteen weeks**, which is the 2026-08-06 incident §50 exists for.
  //
  // ⚠️ AMENDMENT 4 (McMillan, Willy concurring): A CEILING, NOT A TARGET. `zones.easyHR`
  // is already `"< NNN bpm"`, and the existing note — *"Zone 2 only. If you can't hold a
  // conversation, slow down."* — is UNCHANGED and stays FIRST. The talk test governs; the
  // number is the backstop.
  //
  // ⚠️ `paceTarget` stays null, deliberately. There is no finished plan to read a pace
  // from here — the same reason the ramp's sessions carry no `duration_mins` (§122, below).
  const hr = buildHRZonesWithFallback(input)
  // 🔴 AMENDMENT 2, AND THE SCHEMA CAUGHT ME NOT IMPLEMENTING IT. The first cut wrote
  // these fields unconditionally. With no `age` and no `max_hr` there is nothing for
  // Tanaka to work from, so the ceiling comes back non-finite and the plan failed
  // `meta.zone2_ceiling: z.number().positive().optional()` — i.e. the amendment's own
  // case ("where nothing can be derived, the field stays absent") reached production
  // as a NaN rather than as an absence. A `.optional()` field written with a junk
  // value is worse than an unwritten one: it is the `?? 0` class wearing a number.
  //
  // ⚠️ `Number.isFinite`, not a truthiness check — NaN is falsy here by accident and
  // 0 would also have to go, but relying on that is the kind of coincidence this
  // repo has paid for before.
  // ✅ AND SINCE `MAXHR-AGE-ABSENT-01` THE TYPES AGREE WITH THIS COMMENT. `zone2Ceiling` and
  // `derived_max` are now genuinely optional — the `no_hr_no_age` case emits neither — so this
  // predicate stopped being a defensive read of a required field and became the real question.
  const hrDerivable = typeof hr.zones.zone2Ceiling === 'number' && Number.isFinite(hr.zones.zone2Ceiling)
    && hr.zones.zone2Ceiling > 0
    && typeof hr.derived_max === 'number' && Number.isFinite(hr.derived_max) && hr.derived_max > 0

  const { weeks: built } = generateFoundationBlock({
    easyTargets: { paceTarget: null, hrTarget: hrDerivable ? (hr.zones.easyHR ?? null) : null },
    input,
    // The block generator dates weeks BACKWARDS from a plan start, so handing
    // it the start of the race plan would date the ramp into the past. The
    // ramp's own end is its reference point.
    planStartDate: addWeeks(planStart, assessment.rampWeeks),
    today: planStart,
    curve: 'ramp',
    rampWeeklyKm: weeklyKm,
    // §122 — the SECOND caller of generateFoundationBlock, and the one I missed on the
    // first pass: the consumer check covered readers of `duration_mins` and not callers of
    // the function whose signature widened. There is no finished plan to read a pace from
    // at this point in generation, so the ramp's sessions carry no duration — which the
    // §122 invariant permits, because it only requires one where a pace is derivable.
  })

  // Restamp: a standalone plan counts from week 1, and carries its own phase.
  const weeks: Week[] = built.map((w, i) => ({ ...w, n: i + 1, phase: 'base_build' }))

  return {
    meta: {
      ...(input as unknown as Record<string, unknown>),
      // PV2-A / §1 — the SECOND producer of a plan from a GeneratorInput, and
      // for its whole life the only one that did not stamp the input it was
      // built from. The spread above copies the input's FIELDS flat, which
      // reads like the same thing and is not: every consumer reads the nested
      // `meta.generator_input`, so a base-build runner could not open the
      // Modify sheet (`canModifyPlan`), their plan saved without
      // `savePlanForUser`'s validate gate running, the daily audit could not
      // classify it, `validateReshapedPlan` fell to its legacy branch with
      // three fields zeroed, and five repair scripts skipped them.
      //
      // ⚠️ `canModifyPlan`'s own doc comment said "every plan generated from
      // today carries the stamp, so this shrinks on its own". True when it was
      // written; false from the moment §118 shipped a second producer. Measured
      // 2026-10-09: 2 live base-build plans unstamped, both created after the
      // field existed, and the daily digest reported them under the SAME cause
      // as the 7 genuinely pre-PV2-A legacy rows.
      generator_input: input,
      // BASEBUILD-SCHEMA-CEREMONY-01 — `meta.athlete` has SEVEN readers
      // (`profileInitials`, `postRaceReshape`'s prompt, `DashboardClient`'s avatar)
      // and this producer never wrote it, so every base-build plan failed the
      // schema on a field that is actually used. Written exactly as `ruleEngine`
      // writes it, so the two producers cannot disagree about the same key.
      // ⚠️ Severity was LOW and is stated rather than inflated: `profileInitials`
      // falls through to the email initial, so the avatar was never broken.
      athlete: input.athlete_name ?? '',
      plan_kind: 'base_build',
      base_build_onramp: true,
      // ONRAMP-SPACING-01 — built under R1 and R2, so the stored-plan validator holds it to them (new plans only).
      onramp_spaced: true,
      // ONRAMP-INJURY-CLIMB-01 — the curve rules this ramp was built under, so the stored-plan validator holds an
      // injury ramp to §116 Am. 16 without needing the input (an unstamped plan reads as `standard`: new plans only).
      onramp_profile: rampProfileFor(input),
      race_name: 'Base building',
      // No race date: this plan has no start line, and a countdown against one
      // would be the plan claiming something it does not deliver.
      race_date: '',
      race_distance_km: input.race_distance_km,
      plan_start: planStart,
      // What it is FOR, so the handover is legible to the runner and to us.
      base_build_target_km: assessment.targetKm,
      base_build_start_km: assessment.startKm,
      // §50 / §14 Am. — the SAME field set `ruleEngine` writes, so the two producers
      // cannot describe their HR provenance differently. `INV-PLAN-HR-ASSUMPTIONS-SURFACED`
      // requires `hr_zone_method` on EVERY plan at `error` severity and was firing on both
      // live base-build plans for want of it.
      //
      // ⚠️ AMENDMENT 3 (Sims, binding): the provenance note is MANDATORY wherever the
      // number appears. Tanaka is derived from predominantly male cohorts and its error
      // bars widen through the menopause transition, so a derived ceiling presented
      // without its provenance is the thing she objected to — not the ceiling.
      //
      // ⚠️ `max_hr` is left as the input spread supplies it and `hr_derived_max` carries
      // the max the zones were BUILT on, exactly as the race path does. The two differ
      // precisely when §50 overrode a floor, and that difference is the signal
      // `INV-PLAN-MAX-HR-NOT-BELOW-ESTIMATE-FLOOR` reads.
      ...(hrDerivable ? {
        zone2_ceiling: hr.zones.zone2Ceiling,
        hr_zone_method: hr.method,
        hr_derived_max: hr.derived_max,
        ...(hr.assumption_note ? { hr_assumption_note: hr.assumption_note } : {}),
        ...(hr.estimated_max !== undefined ? { hr_estimated_max: hr.estimated_max } : {}),
        ...(hr.max_source ? { hr_max_source: hr.max_source } : {}),
      } : {}),
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
