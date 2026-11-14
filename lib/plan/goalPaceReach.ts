// GOAL-PACE-REACHABLE-01 (§120 Amendment 2, Coaching Board 2026-10-27) — the single owner of "is this runner's goal
// pace something the plan may prescribe?"
//
// WHY THIS EXISTS. Two paths priced goal pace and neither asked whether it was runnable: the `goal`-anchored catalogue
// rows, and §22's goal-week override of threshold rows. Only the half-marathon `HM` anchor was bounded (§120 Am. 1, at
// CV). Measured on the slow-goal grid: at 15% past fitness, 100% of goal-paced sessions at every distance were faster
// than the runner's own threshold, most faster than their interval pace. Live: 10 of 13 benchmarked runners with a
// future time goal sit past the line, median gap ~10%.
//
// ⚠️ ONE PERCENTAGE, AND WHY THAT DOES NOT REPEAT THE FORM §120 Am. 1 REJECTED. Am. 1 refused a percentage because it
// duplicated a rounding tolerance. Measured at the 2026-10-27 sitting: the pace bands are FIXED percentages of race
// pace (VDOT-invariant within 0.4pp) — CV sits +5.1% at HM, T +5.8% at the marathon, I +4.3% at 10K — so the
// percentage and the band are the same rule wherever a band exists, and the percentage is the only form that reaches
// 5K, where interval pace IS race pace (+1.1%). Gate for superseding Am. 1, measured before the swap: of 2,832
// benchmarked HM time-target inputs (cohort, targeted and slow-goal grids), the CV rule and this line disagree on 0.
//
// ⚠️ BENCHMARKED RUNNERS ONLY. `vdot` is undefined without a benchmark; an estimate from volume cannot withhold a
// runner's race pace (chair, binding). Returns null, never "reachable": no claim either way.
//
// ⚠️ Not a projection. The board left "price at a projected pace" INSUFFICIENT EVIDENCE: production holds no usable
// improvement case. 5% is the published 9–10-week mean (3.5–7.3%) used as the boundary of what a plan may ASK, not a
// forecast of what this runner will become.

import { GENERATION_CONFIG } from './generationConfig'
import { racePaceMinPerKm } from './aerobicEstimate'

export interface GoalPaceReach {
  /** How much faster the goal is than current race fitness at the race distance, in percent (negative = slower). */
  gapPct: number
  /** True when the gap is past `GOAL_PACE_MAX_STRETCH_PCT`: goal pace is not prescribed. */
  withheld: boolean
}

export function goalPaceReach(args: {
  vdot: number | undefined
  raceDistanceKm: number
  goalPaceMinPerKm: number | null
}): GoalPaceReach | null {
  const { vdot, raceDistanceKm, goalPaceMinPerKm } = args
  if (vdot === undefined || goalPaceMinPerKm == null || !(raceDistanceKm > 0)) return null
  const fitnessMinPerKm = racePaceMinPerKm(vdot, raceDistanceKm)
  if (!(fitnessMinPerKm > 0)) return null
  const gapPct = (1 - goalPaceMinPerKm / fitnessMinPerKm) * 100
  return { gapPct, withheld: gapPct > GENERATION_CONFIG.GOAL_PACE_MAX_STRETCH_PCT }
}

/**
 * Which lever the gap sentence may name.
 *
 * 🧭 `GOALPACE-GAP-LEVER-COPY-01` (Design Board 2026-11-14): the sentence named the loss and not
 * the lever, and *"the runner does not hold a currency"* (McMillan). The board ruled that a lever
 * must be named and that the copy BRANCHES on the benchmark's age; the founder delegated the words.
 *
 * ⚠️ READ FROM THE RAMP'S OWN VERDICT, NOT FROM A SECOND AGE CALCULATION. `applyVdotDiscount`
 * already decides staleness (`VDOT_STALENESS_FRESH_WEEKS`, 4), so this takes its `discountPct` and
 * compares against the base. Recomputing weeks here would be two answers to one question.
 *
 * 🔴 AN UNDATED BENCHMARK IS NOT FRESH. The ramp leaves `discountPct` at the base when there is no
 * `benchmark_date`, so a discount test alone reads "fresh" for a benchmark whose age is UNKNOWN —
 * and telling that runner there is nothing to retest is a claim we cannot make. Unknown takes the
 * lever, which is the harmless direction: a time trial they did not need costs them one session.
 */
export type BenchmarkFreshness = 'fresh' | 'stale_or_unknown'

export function benchmarkFreshness(args: { hasDate: boolean; discountPct: number }): BenchmarkFreshness {
  if (!args.hasDate) return 'stale_or_unknown'
  return args.discountPct > GENERATION_CONFIG.VDOT_CONSERVATIVE_DISCOUNT_PCT ? 'stale_or_unknown' : 'fresh'
}

/** The gap clause. Founder's words (2026-10-27), UNCHANGED: the board required a lever, not a
 *  rewrite, so his sentence survives verbatim and the lever is appended. */
export function goalGapClause(gapPct: number): string {
  return `Your target is about ${Math.round(gapPct)}% quicker than your recent run suggests, so sessions are set to what you can run now.`
}

/**
 * The runner-facing sentence: the gap, then the lever.
 *
 * ⚠️ On a FRESH benchmark the lever is not "test again" — a new trial inside
 * `VDOT_STALENESS_FRESH_WEEKS` moves the ramp by nothing, so it would be advice that cannot work.
 * The lever there is the race itself.
 */
export function goalGapSentence(gapPct: number, freshness: BenchmarkFreshness): string {
  const lever = freshness === 'fresh'
    ? 'Nothing to retest: run the race you trained for.'
    : 'A fresh 5K time trial resets them.'
  return `${goalGapClause(gapPct)} ${lever}`
}

/** Does this text carry the gap sentence? Derived from `goalGapSentence` itself, so a rewording of the sentence moves
 *  every check with it (the checker and the tests match through this, never through a copied regex). */
export function hasGoalGapSentence(text: string | null | undefined): boolean {
  if (!text) return false
  // ⚠️ THE GAP CLAUSE ONLY, not the whole sentence. The lever branches, so matching the full
  // string would make this answer FALSE for one of the two branches — and the invariant at
  // `invariants.ts:9365` requires the sentence on every withheld plan, so it would have failed
  // for exactly the runners whose benchmark is fresh.
  const [head, tail] = goalGapClause(0).split('0%')
  return new RegExp(`${escapeRe(head)}\\d+%${escapeRe(tail)}`).test(text)
}
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Does this note quote the runner's goal pace, as the `{{goal_pace}}` token (any spacing, any case), the words "goal /
 *  target / race pace", or the literal "m:ss" the plan stores? One detector for §120 Am. 2's merge guard and the
 *  race-day check, so the two cannot drift (code review). */
export function quotesGoalPace(note: string, goalPacePerKm: string | null | undefined): boolean {
  if (/\{\{\s*goal_pace\s*\}\}/i.test(note)) return true
  if (/\b(goal|target|race)[ -]pace\b/i.test(note)) return true
  const literal = goalPacePerKm?.match(/\d+:\d{2}/)?.[0]
  return !!literal && new RegExp(`(^|[^\\d])${literal}([^\\d]|$)`).test(note)
}

/** The race-day opening sentence's fixed start, shared by its writer and every reader that has to find it. */
export const RACE_OPENING_PREFIX = 'Start slower than feels right.'
