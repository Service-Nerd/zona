import {
  LOAD_RATIO,
  SHADOW_LOAD_THRESHOLD_PCT,
  EASY_SESSION_WEIGHT,
  ZONE_DISCIPLINE_BANDS,
} from './constants'

export interface WeekLoad {
  weekN:           number
  plannedKm:       number
  actualKm:        number
  sessionScores:   { sessionType: string; hrInZonePct: number | null }[]
}

/** Acute:chronic load ratio — this week vs 4-week rolling average. */
export function acuteChronicRatio(
  thisWeekKm: number,
  priorWeeks: number[],   // up to 4 weeks of actual km, most-recent first
): number {
  const window = priorWeeks.slice(0, 4)
  if (!window.length) return 1
  const avg = window.reduce((s, v) => s + v, 0) / window.length
  if (avg === 0) return 1
  return thisWeekKm / avg
}

export type LoadRatioFlag = 'ok' | 'watch' | 'flag'

export function classifyLoadRatio(ratio: number): LoadRatioFlag {
  if (ratio >= LOAD_RATIO.flag)  return 'flag'
  if (ratio >= LOAD_RATIO.watch) return 'watch'
  return 'ok'
}

/**
 * Shadow load: actual vs planned. Returns % over/under plan.
 * Positive = over plan, negative = under plan.
 */
export function shadowLoadPct(actualKm: number, plannedKm: number): number {
  if (!plannedKm) return 0
  return ((actualKm - plannedKm) / plannedKm) * 100
}

export function isShadowLoadTriggered(
  recentWeeks: { actualKm: number; plannedKm: number }[],
  consecutiveWeeksRequired = 2,
): boolean {
  const overloaded = recentWeeks.filter(
    w => shadowLoadPct(w.actualKm, w.plannedKm) > SHADOW_LOAD_THRESHOLD_PCT
  )
  return overloaded.length >= consecutiveWeeksRequired
}

/**
 * Zone discipline score (0–100).
 * Weighted average of HR-in-zone% across all sessions.
 * Easy sessions weighted 2× — they're the most commonly violated.
 */
export function zoneDisciplineScore(
  sessions: { sessionType: string; hrInZonePct: number | null }[]
): number {
  const scored = sessions.filter(s => s.hrInZonePct !== null)
  if (!scored.length) return 0

  let totalWeight = 0
  let weightedSum = 0

  for (const s of scored) {
    const weight = ['easy', 'run', 'long', 'recovery'].includes(s.sessionType)
      ? EASY_SESSION_WEIGHT
      : 1
    weightedSum += s.hrInZonePct! * weight
    totalWeight += weight
  }

  return Math.round(weightedSum / totalWeight)
}

export type ZoneDisciplineLabel = 'disciplined' | 'decent' | 'loose' | 'freelancing'

export function classifyZoneDiscipline(score: number): ZoneDisciplineLabel {
  if (score >= ZONE_DISCIPLINE_BANDS.disciplined) return 'disciplined'
  if (score >= ZONE_DISCIPLINE_BANDS.decent)      return 'decent'
  if (score >= ZONE_DISCIPLINE_BANDS.loose)       return 'loose'
  return 'freelancing'
}
