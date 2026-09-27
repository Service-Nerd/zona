// LOG-OFFPLAN-01 — the single owner of "how far did this runner actually run in
// plan week N" (Coaching Board 2026-09-27, CORRECT WITH AMENDMENT).
//
// 🔴 WHY THIS EXISTS, AND IT IS THE DUPLICATION CLASS THIS REPO KEEPS PAYING FOR.
// "Sum actual load per plan week" was written out by hand in FIVE places —
// `weekly-report`, `adjust-plan`, `recalibrate-taper`, `phase-summary` and
// `race-readiness` — and they agreed only by accident. §68 Amendment 1 records
// what that costs: `recalibrate-taper` selected `week_n, actual_load_km` from
// `strava_activities`, which has NEITHER column, so §68 applied to nobody from
// the day it shipped until 2026-09-22. Same shape as DELOAD-OWNER-01 and
// SESSION-KM-01/02.
//
// ── THE TWO FIGURES, AND WHY THERE MUST BE TWO ────────────────────────────
//
// `run_analysis.actual_load_km` only exists for a run MATCHED to a session —
// `/api/analyse-run` 422s without `week_n` + `session_day`. So a run the plan
// did not prescribe contributes zero to it, by construction. Measured on
// production 2026-09-27: of runs that happened while a plan existed, **21 of 78
// (26.9%) were off-plan, carrying 173 km of 848 (20.4%)**.
//
// The board split the consequence in two, and the split is load-bearing:
//
//   • `linkedKm`  — runs matched to a prescribed session. This is what the
//     ACUTE:CHRONIC RATIO reads, because that trigger AUTO-TRIMS sessions at
//     `LOAD_RATIO.watch` without confirmation. **Clause 2: an off-plan run
//     raises the observation, not the adjustment.** Feeding off-plan volume
//     into the ratio would make a runner's own extra easy run silently shrink
//     next week — McMillan's objection, sustained.
//
//   • `totalKm` (= linked + off-plan) — what the runner actually ran. This is
//     what SHADOW LOAD and the weekly report read. **Clause 1: actual load is a
//     measurement of what happened, and excluding real running makes it wrong.**
//     `shadow_load` builds `sessionsAfter` as an exact copy of `sessionsBefore`
//     and says "Flagged — no auto-change applied" — it was already clause 2's
//     shape before the board met.
//
// ⚠️ THE PROFILE SAYS THIS VOLUME IS ORDINARY, WHICH IS WHY IT COUNTS. Measured
// against a same-person on-plan control: off-plan runs are SHORTER (median 7.5
// vs 8.0 km) and MORE disciplined (median 68.8% vs 60.0% in Z2; mean Z4/5 4.7
// vs 7.3). They are easy aerobic volume, not hidden hard sessions — so Seiler's
// grey-zone-drift hypothesis was NOT supported, and Willy's cap argument stands
// on the tonnage rather than the intensity. ⚠️ n=21, 12 of them one runner.
//
// ⚠️ CLAUSE 3 IS NOT IMPLEMENTED HERE. Including off-plan volume in §2's injury
// cap (`INJURY_WEEKLY_INCREASE_CAP_PCT`) was ruled CORRECT and is blocked on
// sample size. `linkedKm` is what the cap still reads. Do not quietly switch it.

import type { Plan } from '@/types/plan'
import { getWeekIndexForDate } from '@/lib/plan/weekResolution'
import { DUPLICATE_ACTIVITY } from './constants'

/** One physical run, as the activity log stores it. Source-agnostic (ADR-011). */
export interface ActivityLogRow {
  start_date:          string
  distance_m:          number | null
  activity_type:       string | null
  sport_type:          string | null
  strava_activity_id:  number | string | null
  apple_health_uuid:   string | null
}

export interface WeeklyLoad {
  /** Runs matched to a prescribed session. What the ratio and §2's cap read. */
  linkedKm:  number
  /** Runs the plan did not prescribe. */
  offPlanKm: number
  /** What the runner actually ran. `linkedKm + offPlanKm`. */
  totalKm:   number
}

export const EMPTY_LOAD: WeeklyLoad = { linkedKm: 0, offPlanKm: 0, totalKm: 0 }

/**
 * The activity-log identity of a run, for the linked-set lookup. Mirrors the
 * ingest gateway's two id columns (ADR-011) and returns null when a row carries
 * neither — such a row can never be matched, so it is counted as off-plan.
 */
export function activityKey(r: {
  strava_activity_id?: number | string | null
  apple_health_uuid?:  string | null
}): string | null {
  if (r.strava_activity_id != null) return `s:${r.strava_activity_id}`
  if (r.apple_health_uuid  != null) return `h:${r.apple_health_uuid}`
  return null
}

const isRun = (r: ActivityLogRow) => r.activity_type === 'Run' || r.sport_type === 'Run'

/**
 * Collapse rows that describe the SAME physical run, keeping the longest.
 *
 * 🔴 NOT OPTIONAL, AND NOT MASKING. Measured on production 2026-09-27: the same
 * run is ingested twice as "Run (Strava)" and "Run (Connect)" — and once three
 * times — accounting for **63 km, 4.2% of the whole activity log**. Summing raw
 * rows is a provably wrong answer to "how far did they run", so a load figure
 * built on them is wrong on day one.
 *
 * ⚠️ The INGEST defect is filed separately (`ACTIVITY-DUPLICATE-01`). This is
 * the read side refusing to double-count history that already exists; it is not
 * a substitute for consolidation at write time, and this comment is here so the
 * next reader does not mistake it for one (SC-10's lesson: masked reads green).
 */
export function dedupeRuns(rows: readonly ActivityLogRow[]): ActivityLogRow[] {
  const out: ActivityLogRow[] = []
  for (const r of [...rows].sort((a, b) => a.start_date.localeCompare(b.start_date))) {
    const t = new Date(r.start_date).getTime()
    const d = r.distance_m ?? 0
    const dup = out.find(o => {
      const od = o.distance_m ?? 0
      return Math.abs(new Date(o.start_date).getTime() - t) < DUPLICATE_ACTIVITY.WINDOW_MINS * 60_000
        && Math.abs(od - d) <= DUPLICATE_ACTIVITY.DISTANCE_TOLERANCE_PCT / 100 * Math.max(od, d, 1)
    })
    // Keep the longer record — a truncated duplicate must not shrink the week.
    if (!dup) out.push(r)
    else if (d > (dup.distance_m ?? 0)) out[out.indexOf(dup)] = r
  }
  return out
}

/**
 * Bucket the activity log into plan weeks, splitting linked from off-plan.
 *
 * Pure — the caller fetches. Keyed by `week.n` (NOT array position), per
 * ADR-013 and PLAN-WEEK-COLLISION-01.
 *
 * @param linkedKeys `activityKey()` of every run already matched to a session.
 *                   Build it from `run_analysis` AND `session_completions`: a
 *                   manual log writes a completion without ever reaching
 *                   `run_analysis`, so either alone under-counts `linkedKm`.
 */
export function bucketLoadByPlanWeek(
  plan:        Pick<Plan, 'weeks'>,
  rows:        readonly ActivityLogRow[],
  linkedKeys:  ReadonlySet<string>,
): Map<number, WeeklyLoad> {
  const out = new Map<number, WeeklyLoad>()
  if (!plan?.weeks?.length) return out

  for (const row of dedupeRuns(rows.filter(isRun))) {
    const idx  = getWeekIndexForDate(plan.weeks, new Date(row.start_date))
    const week = plan.weeks[idx]
    if (!week) continue
    // ⚠️ `getWeekIndexForDate` FALLS BACK to the nearest past week (or week 0)
    // for a date outside the plan. A run from before the plan started would
    // otherwise land in week 1 and read as off-plan volume the runner never did
    // during the block. Measured: 78 of 99 unlinked runs in production PREDATE
    // their user's plan — HealthKit history backfill, 79% of the raw figure.
    // Dropping them is the difference between 63.5% and the true 26.9%.
    if (!isInsidePlanWeek(week, row.start_date)) continue

    const n   = (week as { n?: number }).n ?? idx + 1
    const km  = (row.distance_m ?? 0) / 1000
    const key = activityKey(row)
    const cur = out.get(n) ?? { ...EMPTY_LOAD }
    if (key != null && linkedKeys.has(key)) cur.linkedKm += km
    else cur.offPlanKm += km
    cur.totalKm = cur.linkedKm + cur.offPlanKm
    out.set(n, cur)
  }
  return out
}

/** Is this date inside the week's own 7-day window? Guards the fallback above. */
function isInsidePlanWeek(week: { date?: string }, isoDate: string): boolean {
  if (!week?.date) return false
  const start = new Date(`${String(week.date).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(start.getTime())) return false
  const end = new Date(start); end.setDate(end.getDate() + 7)
  const d = new Date(isoDate)
  return d >= start && d < end
}

/** The prior weeks' figures the acute:chronic ratio compares against, most-recent first. */
export function priorWeeks(
  loads: ReadonlyMap<number, WeeklyLoad>,
  weekN: number,
  count: number,
  pick: (w: WeeklyLoad) => number = w => w.linkedKm,
): number[] {
  return Array.from(loads.entries())
    .filter(([n]) => n < weekN)
    .sort(([a], [b]) => b - a)
    .slice(0, count)
    .map(([, w]) => pick(w))
}

/**
 * Fetch + bucket in one call, so no route re-implements either half.
 *
 * ⚠️ `linkedKeys` is built from `run_analysis` AND `session_completions`, both
 * filtered to the LIVE plan (`superseded_at is null`), matching every other
 * query in these routes (PLAN-WEEK-COLLISION-01). Two tables because a MANUAL
 * log writes a completion and never reaches `run_analysis` — production carries
 * 207 completions with no activity id at all — so `run_analysis` alone would
 * report a hand-logged prescribed run as off-plan.
 *
 * Reads only. `strava_activities` writes stay behind the single ingestion
 * gateway (INV-DATA-008); this never writes.
 */
export async function fetchWeeklyLoad(
  supabase: { from: (t: string) => any },
  userId:   string,
  plan:     Pick<Plan, 'weeks'>,
): Promise<Map<number, WeeklyLoad>> {
  if (!plan?.weeks?.length) return new Map()

  const first = plan.weeks[0] as { date?: string }
  const last  = plan.weeks[plan.weeks.length - 1] as { date?: string }
  if (!first?.date || !last?.date) return new Map()
  const from = new Date(`${String(first.date).slice(0, 10)}T00:00:00`)
  const to   = new Date(`${String(last.date).slice(0, 10)}T00:00:00`)
  to.setDate(to.getDate() + 7)

  const [actsRes, raRes, compRes] = await Promise.all([
    supabase.from('strava_activities')
      .select('start_date, distance_m, activity_type, sport_type, strava_activity_id, apple_health_uuid')
      .eq('user_id', userId)
      .gte('start_date', from.toISOString())
      .lt('start_date', to.toISOString()),
    supabase.from('run_analysis')
      .select('strava_activity_id, apple_health_uuid')
      .eq('user_id', userId).is('superseded_at', null),
    supabase.from('session_completions')
      .select('strava_activity_id, apple_health_uuid')
      .eq('user_id', userId).is('superseded_at', null),
  ])

  // ⚠️ A query error is NOT an empty week. Returning an empty map here would
  // report every run as absent and read as "the runner did nothing" — the §68
  // Am.1 failure exactly, where a destructured-away error made the feature
  // silently apply to nobody for four months. Surface it.
  const err = actsRes?.error ?? raRes?.error ?? compRes?.error
  if (err) throw new Error(`fetchWeeklyLoad: ${err.message ?? String(err)}`)

  const linkedKeys = new Set<string>()
  for (const r of [...(raRes?.data ?? []), ...(compRes?.data ?? [])]) {
    const k = activityKey(r); if (k) linkedKeys.add(k)
  }
  return bucketLoadByPlanWeek(plan, (actsRes?.data ?? []) as ActivityLogRow[], linkedKeys)
}
