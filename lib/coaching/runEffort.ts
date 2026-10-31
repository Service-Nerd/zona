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
