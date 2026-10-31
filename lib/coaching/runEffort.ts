// COACH-EFFORT-PICTURE-01 / §132 (Coaching Board 2026-10-31) — THE SINGLE OWNER of "what kind of run was this?" for
// Coach's every-run picture. A different question from `zoneVerdict` ("did a session meant to be easy hold?"): most
// runs are not linked to a plan session (measured 2026-10-31: 1 of 69 Zone-3-dominant runs was linked), so their intent
// is unknown and this owner never claims one.
//
// ⚠️ BY TIME IN ZONE, NEVER BY AVERAGE HEART RATE. Measured across 21 runners / 256 runs: average HR called 105 runs
// "grey", 21 of them interval-shaped (real easy AND real hard inside one run). An interval session averages into Zone 3
// while containing almost none of it.
//
// ⚠️ THE ENGINE PRESCRIBES ZONE 3. Tempo and quality sessions target Z3 (`zoneForSessionType`), so a linked hard-effort
// session is `planned`, never `grey`: counting it would accuse a runner of doing what their plan asked.

import { isHardEffortType } from '@/lib/plan/sessionRole'
import { COACH_EFFORT_SPLIT_MIN_PCT } from './constants'
import { dedupeRuns, isRun, type ActivityLogRow } from './weeklyActualLoad'
import { hasZoneSplit, type ZoneActivityRow } from './weeklyZoneAggregate'

export type RunEffortKind = 'easy' | 'grey' | 'hard' | 'split' | 'planned' | 'unknown'

export interface RunEffortRow {
  hr_pct_z1?: number | null
  hr_pct_z2?: number | null
  hr_pct_z3?: number | null
  hr_pct_z4_5?: number | null
}

/**
 * `plannedType` is the linked plan session's `type` when the run completed one, else null. Order of the answer:
 * no split → `unknown`; a linked hard-effort session → `planned`; real easy AND real hard inside one run → `split`;
 * otherwise the largest of easy (Z1–2), Zone 3 and hard (Z4–5), ties going to the easier side (benefit of the doubt).
 */
export function runEffortKind(row: RunEffortRow, plannedType: string | null = null): RunEffortKind {
  const parts = [row.hr_pct_z1, row.hr_pct_z2, row.hr_pct_z3, row.hr_pct_z4_5]
  if (parts.every(p => p == null || !Number.isFinite(p))) return 'unknown'
  const easy = (row.hr_pct_z1 ?? 0) + (row.hr_pct_z2 ?? 0), grey = row.hr_pct_z3 ?? 0, hard = row.hr_pct_z4_5 ?? 0
  if (easy + grey + hard <= 0) return 'unknown'
  if (isHardEffortType(plannedType)) return 'planned'
  if (easy >= COACH_EFFORT_SPLIT_MIN_PCT && hard >= COACH_EFFORT_SPLIT_MIN_PCT) return 'split'
  if (easy >= grey && easy >= hard) return 'easy'
  if (grey >= hard) return 'grey'
  return 'hard'
}

/** One run in the every-run record: its zone split and what kind of run it was. */
export interface EffortRun { date: string; z1: number; z2: number; z3: number; z45: number; kind: RunEffortKind; thisWeek: boolean }

/** A linked activity's plan session type, from the completion that names it (`week_n` + `session_day`). */
export function plannedTypeByActivity(
  completions: ReadonlyArray<{ week_n: number; session_day: string; strava_activity_id?: number | string | null; apple_health_uuid?: string | null }> | null | undefined,
  plan: { weeks?: ReadonlyArray<{ n: number; sessions?: Record<string, { type?: string } | undefined> }> } | null | undefined,
): Map<string, string> {
  const out = new Map<string, string>()
  for (const c of completions ?? []) {
    const type = plan?.weeks?.find(w => w.n === c.week_n)?.sessions?.[c.session_day]?.type
    if (!type) continue
    if (c.strava_activity_id != null) out.set(`s:${c.strava_activity_id}`, type)
    if (c.apple_health_uuid) out.set(`a:${c.apple_health_uuid}`, type)
  }
  return out
}

/**
 * Every run carrying a zone split in the last `weeks` plan-aligned weeks (this week last), oldest first. Same run
 * filter and dedupe as the rings (`weekZoneSplitRows`), so the two never count different runs.
 */
export function effortRecord(
  rows: readonly ZoneActivityRow[],
  week: { date?: string } | null | undefined,
  weeks: number,
  plannedTypes: ReadonlyMap<string, string> = new Map(),
): EffortRun[] {
  if (!week?.date) return []
  const thisStart = new Date(`${String(week.date).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(thisStart.getTime())) return []
  const from = new Date(thisStart); from.setDate(from.getDate() - 7 * (weeks - 1))
  const to = new Date(thisStart); to.setDate(to.getDate() + 7)
  return dedupeRuns(rows.filter(isRun) as ActivityLogRow[])
    .map(r => r as ZoneActivityRow)
    .filter(hasZoneSplit)
    .filter(r => { const d = new Date(r.start_date); return d >= from && d < to })
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .map(r => {
      const planned = plannedTypes.get(`s:${r.strava_activity_id}`) ?? (r.apple_health_uuid ? plannedTypes.get(`a:${r.apple_health_uuid}`) : undefined) ?? null
      return {
        date: r.start_date,
        z1: Number(r.hr_pct_z1 ?? 0), z2: Number(r.hr_pct_z2 ?? 0), z3: Number(r.hr_pct_z3 ?? 0), z45: Number(r.hr_pct_z4_5 ?? 0),
        kind: runEffortKind(r, planned),
        thisWeek: new Date(r.start_date) >= thisStart,
      }
    })
    .filter(r => r.kind !== 'unknown')
}
