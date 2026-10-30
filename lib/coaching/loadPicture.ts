// LOAD-SOURCE-TOTAL-01 — the single owner of the Coach load picture (Coaching Board 2026-10-30, §129;
// Design Board and SLT the same day, `docs/decisions/runked-load-view-slt-2026-10-30.md`).
//
// WHY IT EXISTS. The Coach "This week's load" tile read `weekly_reports.acute_chronic_ratio`, which is the TRIM
// TRIGGER's ratio: linked runs only (§2 Am.4 clause 2), and only for runners with a weekly report. Measured
// 2026-10-30: 18 people opened Coach 235 times in 56 days and 2 ever saw a value. The trigger keeps its ratio; the
// picture reads what the runner actually ran (clause 1), so the two figures can differ for one week, by design.
//
// ROLLING WINDOWS, NOT PLAN WEEKS. "This week" is the last 7 days, compared with the four 7-day windows before it.
// A plan week still in progress would read "under your normal" every Monday. And the prior windows are NOT clipped to
// the plan: running before the plan started is the runner's normal. (`bucketLoadByPlanWeek` drops pre-plan runs for a
// different question, off-plan volume DURING the block.)
//
// Pure, client-safe, no I/O. Source-agnostic (ADR-011): every row in the activity log counts.

import type { Plan } from '@/types/plan'
import { LOAD_RATIO, LOAD_PICTURE_MIN_PRIOR_WEEKS, LOAD_PICTURE_LOW_WEEKS_TO_NAME } from './constants'
import { acuteChronicRatioOrNull } from './loadCalc'
import { dedupeRuns, isRun, isInsidePlanWeek, type ActivityLogRow } from './weeklyActualLoad'
import { runDistance } from '@/lib/health/runDistance'
import { getWeekIndexForDate } from '@/lib/plan/weekResolution'
import { isDeloadWeekObject } from '@/lib/plan/deloadCadence'

const DAY_MS = 86_400_000
const WINDOW_DAYS = 7
/** The chronic window the ratio averages over (`acuteChronicRatioOrNull` reads up to four). */
const PRIOR_WINDOWS = 4

/** How far back a caller must read for `computeLoadPicture` to answer every question it asks. */
export const LOAD_PICTURE_LOOKBACK_DAYS = WINDOW_DAYS * (PRIOR_WINDOWS + LOAD_PICTURE_LOW_WEEKS_TO_NAME)

export interface LoadPicture {
  /** Last 7 days over the mean of the four 7-day windows before; null below `LOAD_PICTURE_MIN_PRIOR_WEEKS`. */
  ratio: number | null
  /** The plan week containing today is planned lighter: deload, taper, holiday, or post-race restoration. */
  plannedEasy: boolean
  /** Consecutive windows, ending now, under the runner's normal outside a planned lighter week. */
  lowWeeksRunning: number
}

/** A week the plan made lighter on purpose (clause 5). */
export function isPlannedLighterWeek(week: Plan['weeks'][number] | undefined): boolean {
  if (!week) return false
  const w = week as { phase?: string; badge?: string; type?: string }
  return isDeloadWeekObject(w) || w.badge === 'holiday' || w.phase === 'taper' || w.phase === 'maintenance_restoration'
}

function plannedLighterOn(plan: Pick<Plan, 'weeks'> | null, at: Date): boolean {
  const weeks = plan?.weeks
  if (!weeks?.length) return false
  const week = weeks[getWeekIndexForDate(weeks, at)]
  // `getWeekIndexForDate` falls back to the nearest week for a date outside the plan; that is not this week.
  if (!week || !isInsidePlanWeek(week as { date?: string }, at.toISOString())) return false
  return isPlannedLighterWeek(week)
}

export function computeLoadPicture(
  rows: readonly ActivityLogRow[],
  plan: Pick<Plan, 'weeks'> | null,
  now: Date,
): LoadPicture {
  const end = now.getTime()
  const windows = Array.from({ length: PRIOR_WINDOWS + LOAD_PICTURE_LOW_WEEKS_TO_NAME }, () => 0)
  for (const row of dedupeRuns(rows.filter(isRun))) {
    const t = new Date(row.start_date).getTime()
    if (!(t < end)) continue
    const k = Math.floor((end - t) / (WINDOW_DAYS * DAY_MS))
    if (k < windows.length) windows[k] += runDistance(row)?.km ?? 0
  }

  // The ratio for the window `k` weeks back, or null when its own four prior windows hold too little running.
  const ratioAt = (k: number): number | null => {
    const prior = windows.slice(k + 1, k + 1 + PRIOR_WINDOWS)
    if (prior.length < PRIOR_WINDOWS || prior.filter(km => km > 0).length < LOAD_PICTURE_MIN_PRIOR_WEEKS) return null
    return acuteChronicRatioOrNull(windows[k], prior)
  }

  let lowWeeksRunning = 0
  for (let k = 0; k < LOAD_PICTURE_LOW_WEEKS_TO_NAME; k++) {
    const r = ratioAt(k)
    if (r === null || r >= LOAD_RATIO.under || plannedLighterOn(plan, new Date(end - k * WINDOW_DAYS * DAY_MS))) break
    lowWeeksRunning++
  }

  return { ratio: ratioAt(0), plannedEasy: plannedLighterOn(plan, now), lowWeeksRunning }
}
