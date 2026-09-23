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
  // §111 Amendment 2 — THE DENOMINATOR IS THE VOLUME THE ENGINE STARTS FROM.
  // SHIPPED 2026-09-19 after BOTH boards ruled.
  //
  // This read `input.current_weekly_km`, the raw wizard figure, while §29
  // scales a fresh returner down and §10 caps a `<6mo` runner. So the gate
  // scored a build no runner performs: declared 50 km/wk starts at 30 and
  // scored 1.2x against a real 1.8x; a fresh returner declaring 20 starts at
  // 14, scored 3.0x against a real 4.2x. Wrong in BOTH directions and most
  // wrong where §10's cap bites hardest. Shared owner with the producer
  // (`lib/plan/startVolume.ts`) so gate and engine cannot drift.
  //
  // ⚠️ THE COST, MEASURED AND ACCEPTED: +456 beginner-marathon refusals
  // (2,321 -> 2,777 of 6,480, +19.6% for the cohort the founder ranks FIRST).
  // Held for most of 2026-09-19 for exactly that reason, then ruled by both
  // boards on evidence about what those runners were getting instead:
  //
  //     median TRUE build ratio (peak / real start)   5.57x   (cap 4.0)
  //     median WEEK-1 LEAP above their real start     +114%
  //     median peak long run                          62% of race
  //     genuine plan defects                          ZERO
  //     typical profile   12 km/week, LONGEST RUN EVER 0 km, marathon in 29 wks
  //
  // **The zero matters as much as the 5.57**: these plans pass every check the
  // engine owns and still double a never-run beginner's weekly volume in week
  // one. That is the check measuring the wrong thing, which is what this fixes.
  // Willy: "the clearest bone-stress setup in this whole engine." Sims: this
  // cohort pays for an over-ambitious week one in stress fractures, and skews
  // female. Hutchinson: "declining to apply a correction because the truth is
  // expensive is not a coaching position." SLT unanimous to ship; Traynor:
  // waiting on the charity's numbers buys nothing, because they would tell us
  // HOW MANY are affected and not WHETHER the plan is safe.
  //
  // ⚠️ RUNWAY DOES NOT RESCUE THEM, measured: <=16 weeks is WORSE (+157%
  // week-1 leap, peak long run 50% of race). The hazard is the week-1 floor
  // (35% of peak), which does not scale down with the runner, so more time
  // cannot fix it. §2's ramp cap governs week-on-week and NOT week 1.
  //
  // ⚠️ THE CAP CANNOT ABSORB THE CORRECTION — do not retry it. Raising
  // MAX_BASE_BUILD_RATIO to hold refusals flat looks clean (cap 5.0 -> 1,004
  // vs today's 1,001) and is wrong: `effectiveStartKm` differs from raw ONLY
  // for fresh-return and `<6mo` runners, so the cap raise is a pure loosening
  // for everyone else. A FLAT TOTAL HID A CHANGED COMPOSITION, and at cap 5.0
  // a 10 km/week beginner marathoner is admitted at 4.70 — the exact runner
  // §111's ratified text says must be refused. Caught by
  // `racePeakExclusion.test.ts`.
  const currentKm = effectiveStartKm(input)
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

/** Which rule produced the refusal. §111's ratio and §117's adequacy bound are
 *  different failures and were sharing one message; see `runWalkInadequateRefusal`. */
export type BaseVolumeCause = 'base-ratio' | 'runwalk-inadequate'

export interface BaseVolumeResult {
  cause: BaseVolumeCause
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
/**
 * `finishRescues` — would a finish-goal plan ACTUALLY generate for this runner?
 *
 * ⚠️ PASSED IN, NEVER DERIVED HERE, AND THAT IS THE WHOLE LESSON.
 * The first cut computed it from `runWalkApplies` — §117's own eligibility
 * predicate — on the reasoning that §117 is what rescues these runners. It is.
 * The predicate was still wrong: **11 of 45 offers led to a SECOND refusal**,
 * because §117's adequacy bound (`FINISH_GOAL_RUNWALK_MIN_PEAK_LR_KM`) is
 * checked AFTER the plan is built and a gate cannot see it. A door can be open
 * and the room still empty.
 *
 * So the caller answers the question the only way it can be answered honestly:
 * by generating the finish-goal plan and seeing. It costs one extra generation
 * on the refusal path only, and an offer that gets refused again is worse than
 * no offer at all.
 */
export function baseVolumeRefusal(
  a: BaseBuildAssessment, input: GeneratorInput, finishRescues = false,
): BaseVolumeResult {
  const distKey = raceDistanceKey(input.race_distance_km)
  const label = distKey === 'MARATHON' ? 'marathon' : distKey === '50K' ? '50K' : distKey === '100K' ? '100K' : 'this distance'
  // §111 Am.2 — THE RETURN TRIGGER (Wood's condition, SLT 2026-09-19).
  //
  // The refusal named a TARGET and said come back. Wood: "a number plus 'come
  // back' is a goal, and goals do not change behaviour" — she had already
  // called that a pure motivation intervention earlier the same day. What
  // makes it an intervention is a DATE: a context cue the runner can act on,
  // rather than a wish they have to hold.
  //
  // Derived, not guessed: §2 caps weekly volume growth at
  // MAX_WEEKLY_VOLUME_INCREASE_PCT, so the weeks needed to grow from where
  // they are to the base they need is ceil(log(need/have) / log(1 + rate)).
  // The runner is told the number of weeks the engine's OWN ramp rule implies,
  // which is the same arithmetic their plan would have used.
  const rate = 1 + GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT / 100
  const weeksToBase = a.currentKm > 0
    ? Math.max(1, Math.ceil(Math.log(a.minBaseKm / a.currentKm) / Math.log(rate)))
    : null
  // Sutherland: the refusal should read as the beginning of the relationship,
  // not a verdict. Same information, different object.
  const when = weeksToBase != null
    ? ` Give it about ${weeksToBase} week${weeksToBase === 1 ? '' : 's'} of steady easy running and come back: we will build the plan then.`
    : ' Come back when you have a few weeks of steady easy running behind you and we will build the plan then.'
  // ⚠️ WHEN §117 CAN SERVE THEM, "COME BACK IN N WEEKS" IS FALSE.
  // The runner is not short of base for the race, they are short of base for
  // the TIME. Telling them to wait while the engine could build their plan
  // this minute is the refusal contradicting itself.
  // ⚠️ "instead" IS LOAD-BEARING, not a stylistic choice.
  // `REFUSAL_NAMES_NEXT_STEP` (envelopeMeasure.ts) proves §44's obligation by
  // MATCHING THE PROSE: /get to|come back|build to|at least|first|instead|about \d/.
  // The first draft of this sentence read "Finishing it is another matter:
  // switch your goal to finishing and we will build that plan now" and matched
  // NONE of them — so the most actionable refusal in the engine scored as a
  // dropout with no route back, and `useCaseEnvelope.test.ts` went red on 0.1%
  // of marathon runners.
  //
  // ⚠️ SECOND TIME THIS REPO HAS BEEN BITTEN BY MATCHING A REFUSAL ON ITS
  // WORDING. Recorded rather than worked around: the guard is prose-matching a
  // semantic obligation, and the next person to improve this copy will trip it
  // too. Making it structural (a `next_step` field on BaseVolumeResult) is the
  // real fix and is filed, not done here.
  const message = finishRescues
    ? `${a.currentKm} km a week is too low to chase a ${label} time safely. ` +
      `Switch your goal to finishing instead and we will build that plan now.`
    : `${a.currentKm} km a week is too low to build safely to a ${label} yet. ` +
      `Get to about ${a.minBaseKm} km a week first.${when}`

  const alternatives = finishRescues
    ? [
        `Switch your goal to finishing and generate this plan now.`,
        `Or build your weekly volume to around ${a.minBaseKm} km and come back for the time goal.`,
      ]
    : [
        `Build your weekly volume to around ${a.minBaseKm} km, then generate this plan.`,
        weeksToBase != null
          ? `Run easy ${weeksToBase > 8 ? 'three or four' : 'three'} times a week and check back in ${weeksToBase} weeks.`
          : `Spend the next few weeks running easy to raise your base before the ${label} block begins.`,
      ]
  return {
    cause: 'base-ratio',
    message,
    alternatives,
    current_weekly_km: a.currentKm,
    min_base_km: a.minBaseKm,
    peak_km: a.peakKm,
    ratio: a.ratio ?? Infinity,
    cap: a.cap,
  }
}

/**
 * §117 Am.2 — the run-walk plan was BUILT and its longest run came in under
 * `FINISH_GOAL_RUNWALK_MIN_PEAK_LR_KM`. Refusing is correct; the message it used
 * to carry was not.
 *
 * 🔴 THE DEFECT THIS REPLACES. That throw reused `baseVolumeRefusal`, which
 * computes its sentence from the BASE-VOLUME RATIO — a rule that did not fire
 * here. Measured across the marathon envelope: **208 refusals, 11.1% of all
 * BaseVolumeError refusals**, every one of them a runner at 8 km/week with a
 * 4 km longest run, and every one told something arithmetically impossible:
 *
 *     "8 km a week is too low ... Get to about 7 km a week first."   (ratio 3.13, cap 4.0)
 *
 * The runner is ALREADY above the number they are told to reach, because that
 * number is `ceil(peak / 4)` off a peak the §111 ratio never objected to. The
 * reuse was deliberate and its reason was sound — one refusal TYPE, so
 * `isDesignedRefusal` classifies it identically and there is no second shape to
 * match on. **That is kept. Only the sentence changes: same type, true content.**
 *
 * ⚠️ NAMES BOTH LEVERS, because the measurement does not isolate one. These
 * plans fail at every runway in the grid (12, 16, 20 and 30 weeks) and at every
 * day count, so "give it more time" would be false advice on its own. What is
 * true is that the plan tops out short, and the starting point is why.
 */
export function runWalkInadequateRefusal(
  a: BaseBuildAssessment, input: GeneratorInput, peakLrKm: number,
): BaseVolumeResult {
  const distKey = raceDistanceKey(input.race_distance_km)
  const label = distKey === 'MARATHON' ? 'marathon' : distKey === '50K' ? '50K' : distKey === '100K' ? '100K' : 'this distance'
  const need = GENERATION_CONFIG.FINISH_GOAL_RUNWALK_MIN_PEAK_LR_KM
  // ⚠️ "about N", "at least", "first" and "come back" each satisfy
  // REFUSAL_NAMES_NEXT_STEP, which proves §44's obligation by matching PROSE.
  // Reword with care: a more helpful sentence that matches none of its tokens
  // scores as a dropout with no route back. That has already happened once.
  const message =
    `We would only get your longest run to about ${Math.round(peakLrKm)} km before race day, ` +
    `and you need at least ${need} km behind you to get round a ${label}. ` +
    `Build your base up first and come back: we will build the plan then.`
  const alternatives = [
    `Spend the next few months raising your weekly volume and your longest run, then generate this plan.`,
    `Or choose a shorter distance for this race and come back to the ${label} next time.`,
  ]
  return {
    cause: 'runwalk-inadequate',
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
