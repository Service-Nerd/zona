// FREE — infrastructure
// Plan length calculator. All date arithmetic uses local-time parsing (INV-PLAN-007 note: never
// new Date("YYYY-MM-DD") — that parses as UTC midnight and drifts near midnight in west timezones).

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

export function weeksBetweenLocal(startIso: string, endIso: string): number {
  const start = parseDateLocal(startIso)
  const end = parseDateLocal(endIso)
  return Math.floor((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))
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
  /**
   * §97 (CB-ONSET-03) — allow the plan to run to the distance's `max_weeks`
   * rather than stopping at `idealWeeks`.
   *
   * Passed `true` only for a §89-gated runner. §76 delays the start when there
   * are surplus weeks, and ADR-020 then fills the delay with a §57 foundation
   * block — so those weeks are trained either way. The board's finding is that
   * "delay the start" does not create rest; it creates training that sits
   * outside the periodisation arc and is carved out of five invariants. For a
   * runner the gate has certified as having a current base, converting that
   * filler into validated, ramped base weeks is strictly better.
   *
   * `max_weeks` comes from PLAN_SIGNATURES and was DEAD CONFIG until now
   * (PLANLEN-DUP-01) — this reads a bound the signature already declared, it
   * does not invent a longer plan than §17 permits.
   */
  allowMaxWeeks = false,
): PlanLengthResult {
  const config = getDistanceConfig(distanceKm)

  const raceWeekStart  = startOfWeekMonday(parseDateLocal(raceDateIso))
  const earliestStart  = startOfWeekMonday(parseDateLocal(earliestStartIso))

  // Inclusive of both bookends: a race in the same week as the earliest start
  // gives exactly one available week (the race week itself).
  const weeksAvailable = weeksBetweenLocal(formatDate(earliestStart), formatDate(raceWeekStart)) + 1

  // The cap is `idealWeeks` by default; §97 raises it to the signature's
  // `max_weeks` for a gated runner. `weeksAvailable` still binds — this never
  // invents weeks the calendar does not contain.
  const weekCap = allowMaxWeeks
    ? Math.min(
        Math.max(config.idealWeeks, PLAN_SIGNATURES[raceDistanceKey(distanceKm)].max_weeks),
        config.idealWeeks + GENERATION_CONFIG.MAX_ONSET_PLAN_EXTENSION_WEEKS,
      )
    : config.idealWeeks
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
