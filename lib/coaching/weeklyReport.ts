import { acuteChronicRatio, zoneDisciplineScore, shadowLoadPct } from './loadCalc'
import { EF_DECLINE_THRESHOLD_PCT } from './constants'
import type { CoachingFlag } from './coachingFlag'

export type InsightPriority = 'load_spike' | 'zone_drift' | 'shadow_load' | 'ef_decline' | 'solid_week' | 'low_data'

/**
 * A single session selected from the week to be named explicitly in the report
 * body. Either the session that pulled the signal down hardest ('concerning')
 * or — when the week was clean — the standout positive session ('standout').
 * Null when neither applies (week was unremarkable in both directions).
 */
export interface SpotlightSession {
  dayLabel:    string                 // 'Wednesday'
  type:        string                 // 'easy', 'quality', 'long', etc.
  distanceKm:  number | null
  totalScore:  number | null          // 0–100
  verdict:     string | null          // 'off_target' | 'concerning' | 'nailed' | ...
  hrInZonePct: number | null
  efTrendPct:  number | null          // % vs 4-week baseline
  /** Whether this session is being called out as a problem or a positive anchor. */
  polarity:    'concerning' | 'standout'
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
 * Selection logic (in order):
 *   1. Concerning — lowest total_score, gated to verdicts 'off_target' or
 *      'concerning'. The session that pulled the week down hardest.
 *   2. Standout — when no concerning session exists, the HIGHEST total_score,
 *      gated to verdict 'nailed' (the same VERDICT_BANDS.nailed threshold).
 *      Gives the model a positive anchor on clean weeks rather than a generic
 *      "solid week" message.
 *   3. Null — neither bucket has a qualifying session. Week was unremarkable.
 *
 * Reuses VERDICT_BANDS semantics implicitly via the verdict string — never
 * duplicates the numeric threshold (single source of truth in constants.ts).
 */
export function pickSpotlightSession(
  analyses: RunAnalysisRow[],
  week: { sessions: Record<string, { type: string; distance_km?: number | null } | null | undefined> },
  weekN: number,
): SpotlightSession | null {
  if (!analyses.length) return null

  const scored = analyses.filter(a => a.total_score != null)
  if (!scored.length) return null

  // Try concerning first — the down-pull is the more actionable coaching signal.
  const worst = [...scored].sort(
    (a, b) => (a.total_score as number) - (b.total_score as number),
  )[0]
  if (worst && (worst.verdict === 'off_target' || worst.verdict === 'concerning')) {
    return toSpotlight(worst, week, weekN, 'concerning')
  }

  // Fall back to standout — pick the highest-scoring nailed session as a positive anchor.
  const best = [...scored].sort(
    (a, b) => (b.total_score as number) - (a.total_score as number),
  )[0]
  if (best && best.verdict === 'nailed') {
    return toSpotlight(best, week, weekN, 'standout')
  }

  return null
}

function toSpotlight(
  row: RunAnalysisRow,
  week: { sessions: Record<string, { type: string; distance_km?: number | null } | null | undefined> },
  weekN: number,
  polarity: 'concerning' | 'standout',
): SpotlightSession | null {
  const dayKey  = row.session_day.replace(`week_${weekN}_`, '')
  const session = week.sessions[dayKey]
  if (!session) return null

  return {
    dayLabel:    DAY_TITLE[dayKey] ?? dayKey,
    type:        session.type,
    distanceKm:  session.distance_km ?? null,
    totalScore:  row.total_score,
    verdict:     row.verdict,
    hrInZonePct: row.hr_in_zone_pct != null ? Number(row.hr_in_zone_pct) : null,
    efTrendPct:  row.ef_trend_pct  != null ? Number(row.ef_trend_pct)  : null,
    polarity,
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
  hrInZoneData:           { hrInZonePct: number | null; actualLoadKm: number | null }[]
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
