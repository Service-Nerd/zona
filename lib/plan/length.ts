// FREE — infrastructure
// Plan length calculator. All date arithmetic uses local-time parsing (INV-PLAN-007 note: never
// new Date("YYYY-MM-DD") — that parses as UTC midnight and drifts near midnight in west timezones).

export interface DistanceConfig {
  maxKm: number
  minWeeks: number
  idealWeeks: number
  peakKmByLevel: { beginner: number; intermediate: number; experienced: number }
}

// taperWeeks removed in R23 rebuild — taper duration now sourced from
// GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK[distKey].length (single source of truth).
export const DISTANCE_CONFIGS: DistanceConfig[] = [
  { maxKm: 6,        minWeeks: 8,  idealWeeks: 12, peakKmByLevel: { beginner: 28, intermediate: 38, experienced: 48 } },
  { maxKm: 12,       minWeeks: 10, idealWeeks: 12, peakKmByLevel: { beginner: 32, intermediate: 46, experienced: 56 } },
  { maxKm: 22,       minWeeks: 10, idealWeeks: 14, peakKmByLevel: { beginner: 38, intermediate: 52, experienced: 65 } },
  { maxKm: 43,       minWeeks: 14, idealWeeks: 18, peakKmByLevel: { beginner: 52, intermediate: 65, experienced: 80 } },
  { maxKm: 55,       minWeeks: 16, idealWeeks: 20, peakKmByLevel: { beginner: 62, intermediate: 80, experienced: 95 } },
  { maxKm: Infinity, minWeeks: 18, idealWeeks: 24, peakKmByLevel: { beginner: 72, intermediate: 90, experienced: 110 } },
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
): PlanLengthResult {
  const config = getDistanceConfig(distanceKm)

  const raceWeekStart  = startOfWeekMonday(parseDateLocal(raceDateIso))
  const earliestStart  = startOfWeekMonday(parseDateLocal(earliestStartIso))

  // Inclusive of both bookends: a race in the same week as the earliest start
  // gives exactly one available week (the race week itself).
  const weeksAvailable = weeksBetweenLocal(formatDate(earliestStart), formatDate(raceWeekStart)) + 1

  const totalWeeks = Math.max(1, Math.min(weeksAvailable, config.idealWeeks))

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
