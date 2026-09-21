// FREE — infrastructure
// Plan length calculator. All date arithmetic uses local-time parsing (INV-PLAN-007 note: never
// new Date("YYYY-MM-DD") — that parses as UTC midnight and drifts near midnight in west timezones).

import { calendarWeeksBetween } from '@/lib/dates'
import { PLAN_SIGNATURES } from './planSignatures'
import { raceDistanceKey, GENERATION_CONFIG } from './generationConfig'

export interface DistanceConfig {
  maxKm: number
  minWeeks: number
  idealWeeks: number
  peakKmByLevel: { beginner: number; intermediate: number; experienced: number }
}

// taperWeeks removed in R23 rebuild — taper duration now sourced from
// GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK[distKey].length (single source of truth).
// §106 (Coaching Board MAINT-PROFILE-01, 2026-09-11) — `peakKmByLevel` USED TO BE
// WRITTEN OUT HERE, and that was the defect behind the defect. Eighteen coaching
// numerics, setting the single most consequential number in a plan, living
// outside `GENERATION_CONFIG` — so no principle governed them,
// `configPrincipleSync.test.ts` could not see them, and the coaching-guard hook
// did not fire on edits to this file. They now come from
// `GENERATION_CONFIG.PEAK_KM_BY_LEVEL`, keyed by the same `raceDistanceKey`
// bands this table's `maxKm` boundaries already encode (6 / 12 / 22 / 43 / 55 / ∞).
// The values are unchanged; only their home and their governance are.
const PEAK = GENERATION_CONFIG.PEAK_KM_BY_LEVEL

export const DISTANCE_CONFIGS: DistanceConfig[] = [
  { maxKm: 6,        minWeeks: 8,  idealWeeks: 12, peakKmByLevel: PEAK['5K'] },
  { maxKm: 12,       minWeeks: 10, idealWeeks: 12, peakKmByLevel: PEAK['10K'] },
  { maxKm: 22,       minWeeks: 10, idealWeeks: 14, peakKmByLevel: PEAK['HM'] },
  { maxKm: 43,       minWeeks: 14, idealWeeks: 18, peakKmByLevel: PEAK['MARATHON'] },
  { maxKm: 55,       minWeeks: 16, idealWeeks: 20, peakKmByLevel: PEAK['50K'] },
  { maxKm: Infinity, minWeeks: 18, idealWeeks: 24, peakKmByLevel: PEAK['100K'] },
]

export function getDistanceConfig(distanceKm: number): DistanceConfig {
  return DISTANCE_CONFIGS.find(c => distanceKm <= c.maxKm) ?? DISTANCE_CONFIGS[DISTANCE_CONFIGS.length - 1]
}

/**
 * The longest plan this distance may run — §17's own declared bound.
 *
 * SINGLE OWNER (D-08). `calcPlanLength` sizes the plan with it and
 * `INV-PLAN-SURPLUS-IN-PLAN` judges the result against it. Those two had the
 * formula written out separately, and they agreed only because
 * `max_weeks - idealWeeks` happens to be ≤ 2 at every distance — the checker was
 * reading `PLAN_SIGNATURES.max_weeks` raw while the producer also applied
 * `MAX_PLAN_EXTENSION_WEEKS`. Raise one `max_weeks` by three and they diverge
 * silently, which is the DELOAD-OWNER-01 fault (five copies of a cadence that
 * agreed by accident of control flow).
 *
 * The invariant deliberately shares this VALUE rather than re-deriving it: what
 * it independently asserts is the plan's actual week count against the bound,
 * which is the claim that can actually go wrong. A cap value that is itself wrong
 * is governed one layer up, by §17 and `configPrincipleSync.test.ts`.
 *
 * ⚠️ `MAX_PLAN_EXTENSION_WEEKS` does NOT bind at any distance today (the
 * headroom is +2 everywhere except 5K, where it is +0). It is a guard on a future
 * `max_weeks` change, not an active constraint, and it is stated that way so
 * nobody reads a green check as evidence it is doing work (§34).
 */
export function planWeekCap(distanceKm: number): number {
  const ideal = getDistanceConfig(distanceKm).idealWeeks
  const signatureMax = PLAN_SIGNATURES[raceDistanceKey(distanceKm)].max_weeks
  return Math.min(
    Math.max(ideal, signatureMax),
    ideal + GENERATION_CONFIG.MAX_PLAN_EXTENSION_WEEKS,
  )
}

export function parseDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + n)
  return d
}

export function nextMonday(from: Date = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const dow = d.getDay() // 0 = Sunday
  const daysUntilMonday = dow === 1 ? 7 : (8 - dow) % 7
  d.setDate(d.getDate() + daysUntilMonday)
  return d
}

/**
 * Whole weeks between two `YYYY-MM-DD` dates.
 *
 * Delegates to `calendarWeeksBetween` (DATE-DST-01). It used to difference two
 * local midnights in milliseconds and floor the quotient, which loses a day
 * across spring-forward and therefore a whole WEEK on the Monday-to-Monday
 * spans this function is actually given. See `lib/dates.ts`.
 */
export function weeksBetweenLocal(startIso: string, endIso: string): number {
  return calendarWeeksBetween(startIso, endIso)
}

/**
 * Monday that begins the week containing `date`. Weeks are Monday-anchored
 * throughout the engine (`nextMonday()`, `DAY_ORDER`), so this is the single
 * owner of "which week does this date belong to" (D-08). Structural constant,
 * not a coaching numeric — exempt under INV-CFG-003.
 */
export function startOfWeekMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dow = d.getDay()                     // 0 = Sunday
  const daysSinceMonday = (dow + 6) % 7      // Mon→0, Tue→1, … Sun→6
  d.setDate(d.getDate() - daysSinceMonday)
  return d
}

export interface PlanLengthResult {
  totalWeeks: number
  idealWeeks: number
  minWeeks: number
  compressed: boolean
  /**
   * The week the plan ACTUALLY starts — derived, not the caller's proposal.
   * When more weeks are available than the distance's ideal length, the surplus
   * delays the start rather than being dropped off the end (CoachingPrinciples
   * §76). The caller proposes the earliest possible Monday; this is the answer.
   */
  planStartIso: string
  /** Monday of the week containing race day. The plan's final week. */
  raceWeekStartIso: string
  /** Whole weeks from the earliest possible start through race week, inclusive. */
  weeksAvailable: number
}

/**
 * CoachingPrinciples §76 — the plan is laid out BACKWARDS from race week.
 *
 * Previously this returned `min(available, ideal)` weeks and the engine laid
 * them forward from `earliestStartIso`, which discarded the surplus off the END
 * — every plan finished before race day (see
 * docs/incidents/2026-08-06-plan-defects/analysis.md F2). Anchoring on race week
 * discards nothing: it moves the start, and the gap before it is already owned
 * by the foundation block.
 *
 * @param earliestStartIso the soonest the plan could begin (a Monday; normalised
 *                         defensively). Treated as a floor, not a fixture.
 */
export function calcPlanLength(
  distanceKm: number,
  raceDateIso: string,
  earliestStartIso: string,
): PlanLengthResult {
  const config = getDistanceConfig(distanceKm)

  const raceWeekStart  = startOfWeekMonday(parseDateLocal(raceDateIso))
  const earliestStart  = startOfWeekMonday(parseDateLocal(earliestStartIso))

  // Inclusive of both bookends: a race in the same week as the earliest start
  // gives exactly one available week (the race week itself).
  const weeksAvailable = weeksBetweenLocal(formatDate(earliestStart), formatDate(raceWeekStart)) + 1

  // §97 Amendment (LONG-RUNWAY-EARNS-PLAN-01, Coaching Board 2026-09-16) — THE
  // HEADROOM IS GRANTED ON SURPLUS, NOT ON §89's GATE.
  //
  // This used to take `allowMaxWeeks`, passed `earlyQualityOnset`, so §17's
  // declared `max_weeks` reached only a §89-gated runner. M1 — the charity
  // cohort's first-time marathoner — is the precise opposite of gated and was
  // measured getting 18 weeks of an available 20, with 3 foundation weeks and
  // FOUR uncovered weeks in front of them.
  //
  // THE PARAMETER IS GONE RATHER THAN DEFAULTED TRUE, because the scoping
  // condition the board set is satisfied by the line below and needs no flag:
  // `min(weeksAvailable, weekCap)` means raising the cap changes nothing unless
  // `weeksAvailable > idealWeeks`, and that IS the surplus case. Measured on
  // marathon: runway 14/16/18 -> delta 0; 19+ -> delta 1-2. A gate would have
  // been a second answer to a question the arithmetic already answers.
  //
  // WHY IT IS SAFE WHERE §97's VERSION NEEDED ARGUING. §97 shortens base for a
  // gated runner, so its gained weeks land in build and peak and it had to
  // concede it delivers MORE quality (18.4% against §1's 18% marathon ceiling,
  // which is why `MAX_PLAN_EXTENSION_WEEKS` exists). `base_pct` is untouched
  // here — Willy's binding condition at the sitting — so the gain is
  // proportional, and §1's denominator is main-plan weeks (CB-FOUNDATION-DENOM-01),
  // which two more weeks ENLARGE. The quality share moves down, not up.
  //
  // Measured on the live engine: max ramp between non-deload weeks 35.7% at
  // 14-15 weeks against 20.0% at 16-18. Longer plan, gentler tissue progression.
  //
  // `weeksAvailable` still binds — this never invents weeks the calendar does
  // not contain, and never runs past §17's own bound.
  const weekCap = planWeekCap(distanceKm)
  const totalWeeks = Math.max(1, Math.min(weeksAvailable, weekCap))

  // Count back from race week. When weeksAvailable <= ideal this lands on (or
  // after) earliestStart by construction; when the race is already in the past
  // it lands before, which the §44 prep-time gate refuses upstream.
  const planStart = addDays(raceWeekStart, -(totalWeeks - 1) * 7)

  return {
    totalWeeks,
    idealWeeks: config.idealWeeks,
    minWeeks: config.minWeeks,
    compressed: weeksAvailable < config.minWeeks,
    planStartIso: formatDate(planStart),
    raceWeekStartIso: formatDate(raceWeekStart),
    weeksAvailable,
  }
}
