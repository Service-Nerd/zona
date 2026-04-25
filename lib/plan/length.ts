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

export interface PlanLengthResult {
  totalWeeks: number
  idealWeeks: number
  minWeeks: number
  compressed: boolean
}

export function calcPlanLength(
  distanceKm: number,
  raceDateIso: string,
  planStartIso: string,
): PlanLengthResult {
  const config = getDistanceConfig(distanceKm)
  const available = weeksBetweenLocal(planStartIso, raceDateIso)
  const totalWeeks = Math.max(1, Math.min(available, config.idealWeeks))
  return {
    totalWeeks,
    idealWeeks: config.idealWeeks,
    minWeeks: config.minWeeks,
    compressed: available < config.minWeeks,
  }
}
