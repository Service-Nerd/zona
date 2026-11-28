// FREE — infrastructure. ADR-027 B4b (ADR027-B4B-WEEKS): L3's week planner.
//
// The second of L3's three steps (HLD § 3: block → week → session). `composeWeekVolumes` is the
// single owner of **how many kilometres each week of a race plan carries** — the natural ramp, the
// deload drops, §2's week-on-week cap and its injury tightening, the bounceback allowance, the peak
// clamp and the taper's step-down — plus the `compressed` verdict §31 classifies a plan by.
//
// 🔑 A MOVE, NOT A SECOND DERIVATION, for the reason `composeBlocks.ts`'s header gives: L5 must
// derive everything itself because a checker sharing the producer is blind, but **L3 IS the
// producer**, so a parallel curve would be `DELOAD-OWNER-01` one layer up. `buildVolumeSequence`
// had exactly one caller and is deleted.
//
// 🔴 THE HLD SAYS "SETS VOLUME WITHIN CAPACITY" AND THE SECOND HALF IS NOT BUILT HERE.
// Its own canonical-models table is explicit: `WeekCapacity | L1 → L3 | Nothing; the curve never
// knew the time budget`. Reading L1's `schedule.capacity` would CHANGE WHAT RUNNERS ARE PRESCRIBED,
// which is a Coaching Board ruling and not a slice of a byte-identical move. Filed as
// `WEEK-VOLUME-CAPACITY-01` (🏃). **This module is the curve, unchanged. It does not read capacity,
// and saying so is cheaper than letting "step 2 is done" imply that it does.**
//
// ── WHAT MOVED WITH IT ──────────────────────────────────────────────────────────────────────
// Nothing extra. `deloadVolumeFraction` and `buildWeekCeilingKm` stay in `lib/plan/deloadCadence.ts`
// and are imported: the HLD names that module as one that "becomes L3's metrics owner, used by the
// planner and the verifier alike", so importing it is the intended direction, not a leak.
// `getPhaseForWeek` moved to `composeBlocks.ts`, beside the phase table it reads.
//
// ── WHAT DID NOT MOVE ───────────────────────────────────────────────────────────────────────
//   · `start_km` / `peak_km` — the volume model (`effectiveStartKm`, `levelPeakKm`, §106's floor).
//     Inputs here, exactly as `early_onset` is an input to the block planner.
//   · `deload_weeks` — §87's placement, owned by `computeDeloadWeeks`. Passed in rather than
//     recomputed, which is the fault `DELOAD-OWNER-01` removed; do not re-derive it here.
//   · `injury_cap_pct` — whether this runner is volume-capped (`hasVolumeCappedInjury`).
//
// 🔻 `recoveryFreq` WAS A DEAD PARAMETER AND IS GONE. It sat in the signature and was referenced
// nowhere in 227 lines — left behind when `DELOAD-OWNER-01` moved cadence out and `deload_weeks`
// came in instead. TypeScript does not flag an unused parameter by default, so it survived every
// read of this function. Dropping it is the only signature change.
//
// ⚠️ NOTHING READS THE DECISIONS YET — L4 is B5. They are emitted because "which rule set this
// week's volume" is knowable only as the number is set: three passes write the same slot, and the
// last writer is the binding one.
//
// 📐 THE GATE FOR THE MOVE is the exhaustive equivalence diff against the pre-move function —
// **76,032 cases, 0 differences**, every branch reached (deload drops 68,976 · injury cap 29,290 ·
// bounceback 22,786 · peak clamp 45,086 · taper 71,712 · `compressed` 29,231 · **no taper phase
// 4,320** · start below floor 25,344 · above ceiling 31,680). Falsified three ways: a deeper deload
// 59,567 differences, a loosened peak clamp 43,827, a loosened ramp cap 52,177. Recorded in
// `docs/contracts/engine.md § L3`; the probe is not committed, for the reason B4a's gives.
// ⚠️ **`verify:parity` IS IDENTICAL over 6,210 AND IT REACHES MORE OF THIS THAN I FIRST WROTE.**
// I claimed its grid could not reach the injury branches; code review measured that false — it
// sweeps `['Knee']` and `['Shin splints']`, which is exactly `hasVolumeCappedInjury`'s cohort. What
// it genuinely cannot reach is the **returning-runner** allowance: it never sets `training_age`, and
// `isReturningRunner` requires `2-5yr` or `5yr+`. Half a true sentence is not a true sentence.

import { GENERATION_CONFIG, raceDistanceKey } from '@/lib/plan/generationConfig'
import { deloadVolumeFraction, buildWeekCeilingKm } from '@/lib/plan/deloadCadence'
import { getPhaseForWeek } from './composeBlocks'
import type { Phase } from '@/types/plan'
import type { Decision, Lever } from '@/lib/engine/contracts/decision'

export interface WeekVolumeRequest {
  total_weeks: number
  /** From `composeBlocks`. May be missing the taper (a 5-week 5K): see the note in pass 3. */
  phases: Phase[]
  /** `effectiveStartKm` — the runner's current weekly volume, as the engine resolved it. */
  start_km: number
  /** `levelPeakKm` after §106's floor. The ramp is clamped to it and never exceeds it. */
  peak_km: number
  distance_km: number
  /** §2's returning-runner allowance: the opening weeks may grow faster. */
  returning_runner: boolean
  /** §2's injury weekly-increase cap, applied INSIDE the curve so it compounds. `undefined` for an
   *  uninjured runner, who keeps §2's standard allowance. */
  injury_cap_pct: number | undefined
  /** §87's deload weeks, already phase-corrected. */
  deload_weeks: ReadonlySet<number>
}

export interface WeekVolumePlan {
  /** One entry per week, index `n - 1`, whole km. */
  volumes: number[]
  /** §31 — the ramp could not fit: peak-phase weeks never reach `PEAK_REACHED_THRESHOLD_PCT` of
   *  `peak_km`. Surfaced as `plan.meta.compressed`. */
  compressed: boolean
  /** L4's input (ARCH-ENG-009): one per week, plus the opening volume and §31's verdict. */
  decisions: Decision[]
}

/** The only lever a runner holds over a week's volume is what they told us they currently run. */
const MORE_VOLUME: Lever = { field: 'current_weekly_km', direction: 'increase' }

export function composeWeekVolumes(req: WeekVolumeRequest): WeekVolumePlan {
  const { total_weeks: totalWeeks, phases, start_km: startKm, peak_km: peakKm } = req
  const { distance_km: distanceKm, returning_runner: returningRunner } = req
  const { injury_cap_pct: injuryCapPct, deload_weeks: deloadWeeks } = req

  /** Which rule last wrote each week. Three passes write the same slot, so the binding rule is the
   *  last writer and only this function knows which that was. */
  const boundBy: (Decision['bound_by'])[] = new Array(totalWeeks).fill('INV-PLAN-DELIVERED-RAMP')

  // ⚠️ THE `!` IS SAFE BY RULING SINCE §49 Am. 1, AND WAS SAFE ONLY BY LUCK BEFORE IT.
  // B4a proved a race plan could have NO taper phase — the shortest producible 5K (5 weeks) had
  // none — so this was `undefined` on a real plan and never threw only because pass 3 `continue`s
  // on every non-taper week. §49 Amendment 1 (BLOCK-TAPER-SQUEEZE-01, Coaching Board 2026-11-28)
  // reserves the taper before §4's peak floor, so no producible plan lacks one now.
  // 🔻 That is a WEAKER guarantee than it sounds: it holds only while the amendment does, so
  // `composeWeekVolumes.test.ts` still asserts the no-throw against a SYNTHETIC taper-less phase list.
  const taperPhase = phases.find(p => p.name === 'taper')!
  const distKey = raceDistanceKey(distanceKm)
  const taperConfig = GENERATION_CONFIG.TAPER_BY_DISTANCE[distKey]
  const taperPhaseWeeks = GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK[distKey].length
  const fullTaperWeeks = Math.max(1, taperPhaseWeeks - 1)  // exclude race week
  // §2 Am.2 — depth comes from deloadCadence, the single owner (see there for why).
  const recoveryPct = deloadVolumeFraction(injuryCapPct != null)

  // Returning-runner allowance (CoachingPrinciples §2): first 3 weeks may grow
  // at 15% instead of 10%.
  const allowanceForWeek = (weekN: number): number => {
    if (returningRunner && weekN <= GENERATION_CONFIG.RETURNING_RUNNER_GRACE_WEEKS) {
      return GENERATION_CONFIG.RETURNING_RUNNER_ALLOWANCE_PCT
    }
    return GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT
  }

  const volumes: number[] = new Array(totalWeeks).fill(0)

  // Clamp start volume to a band relative to peakKm.
  // Floor prevents starting too low for the target; ceiling prevents
  // starting too close to peak (no room to ramp).
  // ⚠️ §2 Am. 3 CONSIDERED BOUNDING THIS BY A WEEK-1 CEILING AND IT WAS REVERTED ON
  // MEASUREMENT (`WEEK1-FROM-LONGEST-RUN-01`, 2026-11-07). The curve is NOT the
  // producer of the week-1 leap: at a declared 6 km/week with a 5 km longest run the
  // curve opens at 6 and the runner is DELIVERED 13 (40+32+32 minutes of placed
  // sessions). Bounding the floor lowered the curve, which lowered the delivered base,
  // which OPENED §111's ratio door for runners the engine was deliberately refusing:
  // designed refusals 782 -> 664 across 2,520 probe inputs, and plans carrying
  // `WEEK1-LEAP` rose 70 -> 94 (half 4 -> 17, marathon 6 -> 17). A safety bound that
  // admitted 118 refused runners and gave more of them the leap. The leap is ADR-022's
  // DELIVERED-volume divergence, whose levers are injury-scoped by ruling.
  const initFloor   = peakKm * GENERATION_CONFIG.BUILD_VOL_INIT_FLOOR_VS_PEAK   / 100
  const initCeiling = peakKm * GENERATION_CONFIG.BUILD_VOL_INIT_CEILING_VS_PEAK / 100
  let buildVol = Math.min(Math.max(startKm, initFloor), initCeiling)
  let lastBuildVol = buildVol
  // The opening value, and which of the three inputs decided it. ⚠️ §2 holds the init band
  // (`CoachingPrinciples § 2`, where both keys are documented) but **no invariant checks the band
  // itself**, so the nearest true attribution is the ramp rule §94 cites §2 through. Said rather
  // than dressed up: a decision naming a rule that does not check it would be the L4 class.
  const startBoundBy: Decision['bound_by'] = 'INV-PLAN-DELIVERED-RAMP'
  const startClampedBy: 'floor' | 'ceiling' | 'declared' =
    startKm < initFloor ? 'floor' : startKm > initCeiling ? 'ceiling' : 'declared'

  // Pass 1 — fill non-taper weeks (base/build/peak) with the natural ramp +
  // recovery-week drops. Taper deferred to pass 3 so it can anchor on the
  // post-cap pre-taper value.
  for (let i = 0; i < totalWeeks; i++) {
    const weekN = i + 1
    const phase = getPhaseForWeek(weekN, phases)
    if (phase === 'taper') continue

    const isDeload = deloadWeeks.has(weekN)
    if (isDeload) {
      volumes[i] = Math.round(lastBuildVol * recoveryPct)
      buildVol = lastBuildVol
      boundBy[i] = 'INV-PLAN-DELOAD-IS-A-REDUCTION'
    } else {
      const allowance = 1 + allowanceForWeek(weekN) / 100
      const growthFactor = phase === 'peak' ? 1 + (allowance - 1) / 2 : allowance
      const wanted = buildVol * growthFactor
      buildVol = Math.min(wanted, peakKm)
      // 🔴 THE PEAK CEILING HAS NO INVARIANT, SO NOTHING MAY BE NAMED AS HAVING BOUND IT.
      // The first cut attributed this clamp to `INV-PLAN-PEAK-NOT-BELOW-START` because that is
      // §106's only rule — and code review found that rule is a FLOOR check ("a plan never peaks
      // BELOW where the runner already is", `invariants.ts`). Citing it here would make a floor rule
      // the most-cited binding in a long plan, where every week after the curve reaches peak carries
      // it. That is the §4-for-§91 mistake B4a already paid for, one day later, from the other side.
      // 📐 No catalogue rule asserts that a week may not EXCEED the peak target: filed as
      // `PEAK-CEILING-NO-INVARIANT-01` (⚙️), and `composeWeekVolumes.test.ts`'s §106 arm is the
      // first check of the property anywhere. Until a rule exists, the ramp rule is the honest
      // attribution: §2's allowance is what was computing this week, and it was stopped.
      volumes[i] = Math.round(buildVol)
      lastBuildVol = buildVol
    }
  }

  // Pass 2 — enforce week-on-week cap on non-taper weeks. Drops are exempt;
  // deload weeks themselves are exempt (they intentionally drop). After-deload
  // bouncebacks are NOT exempt — this is the primary effect of the cap
  // (CoachingPrinciples §2).
  for (let i = 1; i < volumes.length; i++) {
    const weekN = i + 1
    const phase = getPhaseForWeek(weekN, phases)
    if (phase === 'taper') continue
    const isThisDeload = deloadWeeks.has(weekN)
    if (isThisDeload) {
      // DELOAD-INVERSION-01 part 1 (§3, Coaching Board 2026-09-06) — a recovery
      // week drops to 70% of the prior BUILD week. Pass 1 set it to 70% of the
      // pre-cap `lastBuildVol`, but pass 2 caps the prior week LOWER (injury/ramp),
      // so 70%-of-uncapped could equal/exceed the delivered prior — a "recovery"
      // week that reduces nothing (12.8% of plans, D-21). Re-anchor to 70% of the
      // ACTUAL (post-cap) prior week — §3's literal intent. Here, not a later pass,
      // so the bounceback below reads the reduced deload. A MIN — only reduces.
      // volumes[i-1] is the pre-deload build week, capped this pass; §3/§87 never
      // place back-to-back deloads. Taper deloads: pass 3.
      volumes[i] = Math.min(volumes[i], Math.round(volumes[i - 1] * recoveryPct))
      continue
    }
    if (volumes[i] <= volumes[i - 1]) continue

    // §2's injury cap tightens its own standard allowance for knee / shin-splint history. Same pass, so
    // it compounds week on week exactly as the standard cap does.
    // ONRAMP-INJURY-CLIMB-01 — the ceiling (this cap AND the bounceback below) is `buildWeekCeilingKm`'s
    // (deloadCadence.ts), shared with the base-build ramp; this caller keeps its whole-km rounding.
    // Byte-identical by construction (every volume here is already a whole km, and rounding is monotone),
    // and checked: `verify:parity` IDENTICAL.

    // CoachingPrinciples §2 (amended 2026-08-06 / D1) — the cap does NOT apply
    // to a post-deload bounceback. Previously it did, and the arithmetic was
    // fatal: a deload drops to 70%, so the next week could rise only 10% above
    // THAT — 77% of where the runner already was. Every deload ratcheted the
    // ceiling permanently down, making progressive overload arithmetically
    // impossible in any plan containing a recovery week. The first organic
    // user's 14-week plan peaked in week 3, in the base phase.
    //
    // Returning to a volume held two weeks ago is not a spike — chronic load
    // has not moved. The bounceback may return to the pre-deload level, and no
    // further: growth resumes from there next week.
    const prevWeekN = weekN - 1
    const prevWasDeload = deloadWeeks.has(prevWeekN)
    // THE BOUNCEBACK RULE, now applied inside `buildWeekCeilingKm` — its history stays here:
      // RAMP-BOUNCEBACK-01 (Coaching Board 2026-09-06, Willy-led). The bounceback
      // splits by injury status, and MEASUREMENT (not intuition) drew the line:
      //
      // INJURY history — BOUNDED by the injury cap, no exemption. Injured tissue's
      // binding constraint is the ACUTE weekly load; a "return" does not lessen it
      // (cardiovascular readiness ≠ tissue readiness). This branch used to
      // `Math.max`-override §2's injury cap entirely, shipping +26% weeks to knee-history
      // runners — the live safety hole that blocked CB-PHASE-01. The bounceback now
      // returns TOWARD pre-deload only as fast as the injury cap allows; the
      // remainder completes next week (§2: "growth resumes from there").
      //
      // HEALTHY — keeps §2's exemption UNBOUNDED. The board provisionally proposed
      // a 20% bound for healthy runners too, conditional on measurement. Measured
      // across a 144-plan grid: a 20% bound flipped the difficulty note to
      // "constrained by inputs" on +50pp of plans and raised the maintenance rate
      // +7.6pp, for ZERO safety benefit — §2's evidence is that returning to a
      // volume held two weeks ago is not a spike for healthy tissue, and no
      // mainstream model caps a bounceback. The measurement resolved the board's
      // recorded Willy/Hutchinson split toward Hutchinson for healthy runners.
      //
      // §2 AMENDMENT 3 (PLAN-FITNESS-01, Coaching Board 2026-09-17) — THE INJURY
      // BOUNCEBACK MAY RETURN TO PRE-DELOAD, AND NO HIGHER.
      //
      // Amendment 1 set the condition this failed: "the curve still RISES within
      // each block — slow is right, STUCK IS NOT." Measured, same runner with and
      // without the knee flag, 18 weeks, nothing else changed: net build
      // **+91% healthy vs +6% injured** (standard cadence), **+79% vs +3%**
      // (masters). 28.9% of injury plans never exceeded their own week-1 volume.
      //
      // Amendment 2 raised the injury deload 70% -> 85% but the number is short of
      // its own break-even: standard needs 1/1.05^3 = 86.4%, masters 1/1.05^2 =
      // 90.7%. At 85% that is -1.6%/cycle and -6.3%/cycle. D-21.
      //
      // WHY WILLY REVERSED HIS OWN VETO: he rejected the unbounded return because
      // a 70% cut returning to 100% is **+43%** onto healing tissue. Amendment 2's
      // shallower cut makes the same return **+17.6%**, of a load the tissue
      // carried seven days earlier.
      //
      // ⚠️ HIS CONDITION IS MECHANICAL: valid only while the cut stays shallow.
      // Lower INJURY_RECOVERY_WEEK_VOLUME_PCT and this exemption withdraws itself.
      // The gate is `injuryBouncebackMayReturnToPreDeload()`, one owner read by both callers.
    const maxAllowed = Math.round(buildWeekCeilingKm({
      prevKm: volumes[i - 1],
      preDeloadKm: volumes[i - 2] ?? volumes[i - 1],
      prevWasDeload,
      allowancePct: allowanceForWeek(weekN),
      injuryCapPct,
    }))

    if (volumes[i] > maxAllowed) {
      volumes[i] = maxAllowed
      // Order matters and follows §2 Amendment 3: for an injury history the cap binds even on a
      // bounceback ("cardiovascular readiness != tissue readiness"), so the injury rule is named
      // first. A healthy bounceback keeps §2's unbounded exemption, so when it is what reduced the
      // week the binding rule is the bounceback rule, not the generic ramp.
      boundBy[i] = injuryCapPct != null ? 'INV-PLAN-INJURY-CAP-DELIVERED'
        : prevWasDeload ? 'INV-PLAN-BOUNCEBACK-BOUNDED'
        : 'INV-PLAN-DELIVERED-RAMP'
    }
  }

  // Pass 3 — fill taper weeks using the POST-CAP pre-taper as anchor.
  // (Bug fix: previously taper ran in pass 1, anchored on the pre-cap pre-taper
  // value. With the cap reducing real build/peak volumes, the resulting
  // taper-from-spec-target was visibly smaller than spec because it was applied
  // to an inflated baseline.)
  for (let i = 0; i < totalWeeks; i++) {
    const weekN = i + 1
    const phase = getPhaseForWeek(weekN, phases)
    if (phase !== 'taper') continue

    const taperIdx = weekN - taperPhase.start_week
    const preTaper = volumes[taperPhase.start_week - 2] ?? lastBuildVol
    boundBy[i] = 'INV-PLAN-TAPER-DELIVERED-DEPTH'
    if (weekN === totalWeeks) {
      volumes[i] = Math.round(preTaper * GENERATION_CONFIG.RACE_WEEK_VOLUME_PCT / 100)
    } else {
      // CD-5 / §6 — shallower cut for a low-volume runner (little fatigue to
      // shed; a full cut would just detrain them). Depth only, not week count.
      const reductionFull = peakKm < GENERATION_CONFIG.LOW_VOLUME_TAPER_THRESHOLD_KM
        ? taperConfig.volume_reduction_pct * (GENERATION_CONFIG.LOW_VOLUME_TAPER_REDUCTION_FACTOR_PCT / 100)
        : taperConfig.volume_reduction_pct
      const stepPct = reductionFull / fullTaperWeeks
      const reductionPct = stepPct * (taperIdx + 1)
      volumes[i] = Math.round(preTaper * (1 - reductionPct / 100))
    }
  }

  // "Ramp can't fit" check (CoachingPrinciples §2 intent). The plan is
  // compressed-by-volume if peak-phase weeks never reach peakKm — i.e. the
  // cap forced the ramp short of target. Single-week firing in build is
  // expected and not flagged.
  // 🔴 AND IT IS MEASURED ON THE HIGHEST LOADING PHASE PRESENT, NOT ALWAYS THE PEAK (B4c round 2).
  // This read `phases.find(… 'peak')` and left `compressed` FALSE when there was none. §49 Am. 1
  // makes the peak phase absent on a 5- or 6-week 5K, so the change would have forced the verdict
  // false on exactly those plans — measured: a 5-week 5K beginner at 10 km/week flipped true →
  // false. **That is absence written as a value**: with no peak phase the question "did the ramp
  // reach target?" is not answered NO, it is asked of the wrong weeks. Found by code review, and
  // ⚠️ `cohort:shape` could not have caught it — `cohortGrid`'s 5K is fixed at 12 weeks.
  // The build phase IS the loading block on such a plan, so that is where the question belongs.
  const loadingPhase = phases.find(p => p.name === 'peak') ?? phases.find(p => p.name === 'build')
  let compressed = false
  if (loadingPhase) {
    const peakThreshold = peakKm * GENERATION_CONFIG.PEAK_REACHED_THRESHOLD_PCT / 100
    const peakReached = volumes.some((v, i) => {
      const wn = i + 1
      return wn >= loadingPhase.start_week && wn <= loadingPhase.end_week && v >= peakThreshold
    })
    compressed = !peakReached
  }

  const decisions: Decision[] = volumes.map((km, i) => ({
    what: 'week.volume_km',
    week: i + 1,
    day: null,
    value: km,
    unit: 'km' as const,
    bound_by: boundBy[i],
    lever: MORE_VOLUME,
  }))
  // The opening volume, and §31's verdict on whether the ramp fitted. Both are plan-level.
  decisions.push({
    what: 'plan.volume_start_km', week: null, day: null,
    value: Math.round(Math.min(Math.max(startKm, initFloor), initCeiling)),
    unit: 'km', bound_by: startBoundBy,
    // 🔴 ONLY THE CEILING CLAMP IS IMMUNE TO THE RUNNER. Code review measured this: at peak 130 a
    // declared 20 km opens the plan at 46 (the FLOOR lifted it) — raising what they told us would
    // move that number, so the lever is real. `=== 'declared'` said otherwise on every floor case.
    lever: startClampedBy === 'ceiling' ? null : MORE_VOLUME,
  })
  decisions.push({
    what: 'plan.volume_compressed', week: null, day: null,
    value: compressed, unit: null,
    bound_by: 'INV-PLAN-COMPRESSION-CLASSIFICATION',
    lever: { field: 'race_date', direction: 'later' },
  })

  return { volumes, compressed, decisions }
}
