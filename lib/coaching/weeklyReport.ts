import { acuteChronicRatio, zoneDisciplineScore, shadowLoadPct } from './loadCalc'
import { EF_DECLINE_THRESHOLD_PCT } from './constants'
import type { CoachingFlag } from './coachingFlag'

export type InsightPriority = 'load_spike' | 'zone_drift' | 'shadow_load' | 'ef_decline' | 'solid_week' | 'low_data'

/**
 * A single session selected from the week to be named explicitly in the report
 * body — the one that pulled the week's signal down hardest. Null when no
 * session crosses the concern threshold (week was clean enough that naming a
 * specific session would be artificial).
 */
export interface SpotlightSession {
  dayLabel:    string                 // 'Wednesday'
  type:        string                 // 'easy', 'quality', 'long', etc.
  distanceKm:  number | null
  totalScore:  number | null          // 0–100
  verdict:     string | null          // 'off_target' | 'concerning' | ...
  hrInZonePct: number | null
  efTrendPct:  number | null          // % vs 4-week baseline
}

/** Row shape consumed by pickSpotlightSession. Mirrors run_analysis select. */
export interface RunAnalysisRow {
  session_day:    string              // 'week_3_wednesday'
  total_score:    number | null
  verdict:        string | null
  hr_in_zone_pct: number | null
  ef_trend_pct:   number | null
}

const DAY_TITLE: Record<string, string> = {
  monday:    'Monday',
  tuesday:   'Tuesday',
  wednesday: 'Wednesday',
  thursday:  'Thursday',
  friday:    'Friday',
  saturday:  'Saturday',
  sunday:    'Sunday',
}

/**
 * Picks one session per week to name explicitly in the report body.
 *
 * Selection rule: lowest total_score, gated to verdicts that already encode
 * "this didn't go well" — 'off_target' or 'concerning'. The verdict bands in
 * constants.ts are the single source of truth for the threshold; we never
 * duplicate the numeric here.
 *
 * Returns null when no session is concerning — the AI is then left to write a
 * clean-week message without inventing a problem session.
 */
export function pickSpotlightSession(
  analyses: RunAnalysisRow[],
  week: { sessions: Record<string, { type: string; distance_km?: number | null } | null | undefined> },
  weekN: number,
): SpotlightSession | null {
  if (!analyses.length) return null

  const scored = analyses.filter(a => a.total_score != null)
  if (!scored.length) return null

  const worst = [...scored].sort(
    (a, b) => (a.total_score as number) - (b.total_score as number),
  )[0]
  if (!worst) return null

  const isConcerning = worst.verdict === 'off_target' || worst.verdict === 'concerning'
  if (!isConcerning) return null

  const dayKey  = worst.session_day.replace(`week_${weekN}_`, '')
  const session = week.sessions[dayKey]
  if (!session) return null

  return {
    dayLabel:    DAY_TITLE[dayKey] ?? dayKey,
    type:        session.type,
    distanceKm:  session.distance_km ?? null,
    totalScore:  worst.total_score,
    verdict:     worst.verdict,
    hrInZonePct: worst.hr_in_zone_pct != null ? Number(worst.hr_in_zone_pct) : null,
    efTrendPct:  worst.ef_trend_pct  != null ? Number(worst.ef_trend_pct)  : null,
  }
}

export interface WeeklyReportInput {
  weekN:                  number
  sessionsCompleted:      number
  sessionsPlanned:        number
  sessionsPlannedToDate:  number       // sessions due by today (mid-week context)
  actualKm:               number
  plannedKm:              number
  plannedKmToDate:        number       // km due by today (mid-week context)
  priorWeeksKm:           number[]     // last 4 weeks actual, most-recent first
  sessionFlagCounts:      Record<CoachingFlag, number>
  hrInZoneData:           { sessionType: string; hrInZonePct: number | null }[]
  efTrendPct:             number | null // % change vs baseline
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
    primaryInsight:      selectPrimaryInsight(ratio, zdScore, shadow, input.efTrendPct, input.sessionsCompleted, input.sessionsPlannedToDate),
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
  sessionsPlannedToDate: number,
): InsightPriority {
  // low_data: only fire when 2+ sessions were due by today but fewer than 2 logged.
  // Early-week (0–1 sessions due) never counts as low data — there's nothing to have done yet.
  if (sessionsCompleted < 2 && sessionsPlannedToDate >= 2) return 'low_data'
  if (ratio >= 1.3)                        return 'load_spike'
  if (zdScore !== null && zdScore < 70)    return 'zone_drift'
  if (shadowPct > 15)                      return 'shadow_load'
  if (efTrend !== null && efTrend < EF_DECLINE_THRESHOLD_PCT) return 'ef_decline'
  return 'solid_week'
}
