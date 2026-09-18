// §111 — the base-build ceiling. The single owner of "is this plan asking the
// runner to build too far above the base they actually have?".
//
// WHY THIS MODULE EXISTS. The old volume gate (`current_weekly_km < 20` for a
// marathon) lived hardcoded in the API route, governed by no principle, invisible
// to configPrincipleSync and the coaching-guard hook, and measured NON-MONOTONIC:
// it refused 15 km/week (peak/week1 2.61) and permitted 20 km/week (2.60) —
// near-identical plans either side of its own boundary — and it refused the
// flagship first-time charity marathoner (M1, 15 km/week) at the door while every
// internal test passed, because the tests call generateRulePlan directly and the
// refusal lived at the route (Coaching Board MARATHON-VOLUME-GATE-01, 2026-09-18).
//
// The ratified metric is the DELIVERED PEAK divided by the runner's RAW current
// volume — the total build off the base they really have, which is monotonic in
// current volume and is the acute stimulus Willy's seat actually worries about
// (5 km/week → 47 km peak = 9.4x). Distinct from §23's PEAK_OVER_BASE_RATIO, which
// is a MINIMUM on peak/WEEK1 (build enough); this is a MAXIMUM on peak/CURRENT
// (do not build recklessly far off the real base). Opposite bound, different
// denominator — they compose.
//
// Both the engine refusal (ruleEngine.finalise → BaseVolumeError) and the
// backstop invariant (INV-PLAN-BASE-BUILD-RATIO) read the assessment from here,
// so the refusal and the check can never drift.

import type { Plan, GeneratorInput } from '@/types/plan'
import { GENERATION_CONFIG, raceDistanceKey } from './generationConfig'
import { effectiveStartKm } from './startVolume'

/** §111 governs the marathon and ultra distances only — the distances whose
 *  peak sits far enough above a low base for the jump to be a load hazard. */
export function baseBuildRatioApplies(distanceKm: number): boolean {
  return distanceKm >= GENERATION_CONFIG.BASE_BUILD_RATIO_MIN_DISTANCE_KM
}

/** Delivered peak weekly km — the most volume the plan actually asks for,
 *  excluding §57 foundation weeks (pre-plan). Mirrors the peak computation in
 *  INV-PLAN-PEAK-NOT-BELOW-START so the two agree on what "peak" means. */
export function deliveredPeakKm(plan: Plan): number {
  // ⚠️ THE RACE WEEK IS NOT A TRAINING PEAK, and counting it was a defect.
  //
  // This filtered foundation weeks and `n > 0` and stopped there, so for a
  // marathon the 42.2 km RACE ITSELF landed in §111's numerator. Measured on a
  // beginner marathon: the training peak is week 16 at **52 km** — exactly
  // `PEAK_KM_BY_LEVEL.MARATHON.beginner` — while week 20, the race week,
  // reports 59 km because it contains the marathon plus shakeouts. §111 was
  // scoring every marathon runner's build **13% higher than the training they
  // actually do**, and the minimum base it demanded was 14.75 km/week instead
  // of 13.
  //
  // This is a DEFECT FIX, not a doctrine change: §111's own header defines the
  // metric as "the acute stimulus", and ratified it citing "5 km/week → 47 km
  // peak", a figure that already excluded the race. The code did not match the
  // principle it was written from.
  const main = plan.weeks.filter(w =>
    w.phase !== 'foundation' && w.n > 0 && w.type !== 'race')
  const weeks = main.length ? main : plan.weeks
  return weeks.reduce((mx, w) => Math.max(mx, w.weekly_km ?? 0), 0)
}

export interface BaseBuildAssessment {
  applies: boolean          // does §111 govern this distance at all?
  peakKm: number            // delivered peak weekly volume
  currentKm: number         // the runner's stated current weekly volume (raw)
  ratio: number | null      // peakKm / currentKm; null when §111 does not apply
  cap: number               // MAX_BASE_BUILD_RATIO
  minBaseKm: number         // the base the runner needs: ceil(peakKm / cap)
  exceeded: boolean         // ratio > cap → the plan must be refused
}

/** The single computation both the refusal and the invariant read. */

export function assessBaseBuild(plan: Plan, input: GeneratorInput): BaseBuildAssessment {
  const peakKm = deliveredPeakKm(plan)
  // §111 Amendment 1 — THE DENOMINATOR IS THE VOLUME THE ENGINE STARTS FROM.
  //
  // This read `input.current_weekly_km` — the raw wizard figure — while §29
  // scales a fresh returner down and §10 caps a `<6mo` runner at
  // BEGINNER_WEEK1_VOLUME_CAP_KM. Measured: declared 50 km/wk started at 30,
  // scored 1.2x, actual build 1.8x. Wrong in BOTH directions and most wrong
  // where §10's cap bites hardest. Shared owner, so producer and gate cannot
  // drift (`lib/plan/startVolume.ts`).
  // ⚠️ STILL THE RAW DECLARED VOLUME, AND THAT IS A KNOWN DEFECT — held, not
  // fixed, deliberately. See S111-DENOMINATOR-01.
  //
  // The Coaching Board ruled on 2026-09-18 that this must become
  // `effectiveStartKm(input)` — the volume the engine actually builds from,
  // after §29's fresh-return scaling and §10's <6mo cap. That ruling is
  // correct and the fix was built and MEASURED:
  //
  //   refused 1,296 -> 1,920 (+624, +48%)
  //   healthy masters never-builds 10.1% -> 10.3%, standard 8.1% -> 8.3%
  //
  // Every one of those 624 is a runner whose REAL build exceeds 4.0x and who
  // was passing on a mismeasurement, so refusing them is correct in isolation.
  // But the founder's standing P0 is that the charity cohort cannot be refused,
  // the board's second step (a runway-aware ceiling) was withdrawn when its
  // premise failed measurement, and S106-FLAT-PEAK-01 would remove most of
  // these refusals by scaling the peak instead. Shipping this alone delivers a
  // 48% refusal INCREASE against a P0 that says the opposite.
  //
  // Sequence: S106 first, then this. The measurement is recorded so the next
  // person does not have to rediscover it.
  const currentKm = input.current_weekly_km ?? 0
  const cap = GENERATION_CONFIG.MAX_BASE_BUILD_RATIO
  const applies = baseBuildRatioApplies(input.race_distance_km)
  const minBaseKm = Math.ceil(peakKm / cap)

  if (!applies || peakKm <= 0) {
    return { applies, peakKm, currentKm, ratio: null, cap, minBaseKm, exceeded: false }
  }
  // current 0 → an infinite ratio → refused: a marathon cannot be built off no
  // base at all. The runner is told the base to reach, not handed a reckless plan.
  const ratio = currentKm > 0 ? peakKm / currentKm : Infinity
  return { applies, peakKm, currentKm, ratio, cap, minBaseKm, exceeded: ratio > cap }
}

export interface BaseVolumeResult {
  message: string
  alternatives: string[]
  current_weekly_km: number
  min_base_km: number
  peak_km: number
  ratio: number
  cap: number
}

/** §44's obligation applied to §111 — a refusal names the lever and an
 *  alternative, in brand voice, never a bare stop. The screen (REFUSAL-SCREEN-01)
 *  renders this as "not yet", using the same date arithmetic it already knows. */
export function baseVolumeRefusal(a: BaseBuildAssessment, input: GeneratorInput): BaseVolumeResult {
  const distKey = raceDistanceKey(input.race_distance_km)
  const label = distKey === 'MARATHON' ? 'marathon' : distKey === '50K' ? '50K' : distKey === '100K' ? '100K' : 'this distance'
  const message =
    `${a.currentKm} km a week is too low to build safely to a ${label} yet. ` +
    `Get to about ${a.minBaseKm} km a week first, then this plan is ready for you.`
  const alternatives = [
    `Build your weekly volume to around ${a.minBaseKm} km, then generate this plan.`,
    `Spend the next few weeks running easy to raise your base before the ${label} block begins.`,
  ]
  return {
    message,
    alternatives,
    current_weekly_km: a.currentKm,
    min_base_km: a.minBaseKm,
    peak_km: a.peakKm,
    ratio: a.ratio ?? Infinity,
    cap: a.cap,
  }
}

/** Thrown from generateRulePlan when §111's ceiling is exceeded. Mirrors
 *  PrepTimeError / DaysAvailableError so the API route renders it the same way:
 *  a structured refusal the client can turn into the "not yet" screen. */
export class BaseVolumeError extends Error {
  base: BaseVolumeResult
  constructor(base: BaseVolumeResult) {
    super(base.message)
    this.name = 'BaseVolumeError'
    this.base = base
  }
}
