import { acuteChronicRatio, zoneDisciplineScore, shadowLoadPct } from './loadCalc'
import { EF_DECLINE_THRESHOLD_PCT } from './constants'
import type { CoachingFlag } from './coachingFlag'

export type InsightPriority = 'load_spike' | 'zone_drift' | 'shadow_load' | 'ef_decline' | 'solid_week' | 'low_data'

export interface WeeklyReportInput {
  weekN:              number
  sessionsCompleted:  number
  sessionsPlanned:    number
  actualKm:           number
  plannedKm:          number
  priorWeeksKm:       number[]         // last 4 weeks actual, most-recent first
  sessionFlagCounts:  Record<CoachingFlag, number>
  hrInZoneData:       { sessionType: string; hrInZonePct: number | null }[]
  efTrendPct:         number | null    // % change vs baseline
}

export interface WeeklyReportData {
  sessionsCompleted:   number
  sessionsPlanned:     number
  totalKmActual:       number
  totalKmPlanned:      number
  acuteChronicRatio:   number
  zoneDisciplineScore: number | null   // null when no Strava-analysed HR data
  avgRpe:              number | null   // not computed here — passed in from session_completions
  dominantFlag:        CoachingFlag
  primaryInsight:      InsightPriority
}

/** Computes deterministic weekly report data. AI prompt templates consume this. */
export function computeWeeklyReportData(input: WeeklyReportInput): WeeklyReportData {
  const ratio   = acuteChronicRatio(input.actualKm, input.priorWeeksKm)
  const zdScore = zoneDisciplineScore(input.hrInZoneData)
  const shadow  = shadowLoadPct(input.actualKm, input.plannedKm)
  const dominant = dominantFlag(input.sessionFlagCounts)

  return {
    sessionsCompleted:   input.sessionsCompleted,
    sessionsPlanned:     input.sessionsPlanned,
    totalKmActual:       input.actualKm,
    totalKmPlanned:      input.plannedKm,
    acuteChronicRatio:   ratio,
    zoneDisciplineScore: zdScore,
    avgRpe:              null,
    dominantFlag:        dominant,
    primaryInsight:      selectPrimaryInsight(ratio, zdScore, shadow, input.efTrendPct, input.sessionsCompleted),
  }
}

function dominantFlag(counts: Record<CoachingFlag, number>): CoachingFlag {
  if (counts.flag > 0)  return 'flag'
  if (counts.watch > 1) return 'watch'
  return 'ok'
}

/**
 * Priority order for insight selection:
 * 1. Load spike (acute:chronic > 1.3)
 * 2. Zone drift (discipline < 70)
 * 3. Shadow load (>15% over plan)
 * 4. EF decline (>8% drop)
 * 5. Low data (< 2 sessions completed)
 * 6. Solid week
 */
function selectPrimaryInsight(
  ratio: number,
  zdScore: number | null,
  shadowPct: number,
  efTrend: number | null,
  sessionsCompleted: number,
): InsightPriority {
  if (sessionsCompleted < 2)               return 'low_data'
  if (ratio >= 1.3)                        return 'load_spike'
  if (zdScore !== null && zdScore < 70)    return 'zone_drift'
  if (shadowPct > 15)                      return 'shadow_load'
  if (efTrend !== null && efTrend < EF_DECLINE_THRESHOLD_PCT) return 'ef_decline'
  return 'solid_week'
}
