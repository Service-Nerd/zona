// AI-COMPLETION-COLUMN-01 — the session type of a COMPLETION.
//
// 🔴 `phase-summary` and `race-readiness` both selected `session_type` from
// `session_completions`. THAT COLUMN HAS NEVER EXISTED. Supabase answers a bad
// column with `{ data: null, error }`, both destructured the error away, and the
// `?? []` downstream read the failure as "this runner has completed nothing".
//
// ⚠️ THAT IS WORSE THAN MISSING DATA, AND IT IS THE REASON THIS WAS NOT LEFT AS
// A ONE-LINE FIX. `phase-summary` computes `completionRate = completed /
// totalSessions`, and with an empty array that is `0 / N` — so the model was
// told, as a number, that the runner completed **0%** of the phase, and then
// wrote them a coaching note on that basis. A null would have been honest.
// A zero is a false statement with a decimal point on it.
//
// The type is not a column and should not become one: it lives in the plan JSON,
// where the engine put it. A completion carries `(week_n, session_day)`, which
// is exactly the coordinate that addresses a session — so the join is the fix,
// and `coachingSessionType` stays the single owner of what the type IS
// (INV-CLASS; never a label substring, which the enricher rewrites — D-17).

import { coachingSessionType } from '@/lib/plan/sessionRole'
import type { Plan } from '@/types/plan'

export interface CompletionLike {
  week_n: number | null
  session_day: string | null
}

/**
 * Attach `session_type` to completion rows by looking each one up in the plan.
 *
 * ⚠️ Rows whose session cannot be found keep `session_type: null` rather than a
 * guess. A completion can outlive the session it referred to — a reshape moves
 * or removes sessions — and inventing "easy" for those would put the same class
 * of false number back into the prompt by a different door.
 */
export function withSessionType<T extends CompletionLike>(
  rows: T[],
  plan: Plan | null | undefined,
): (T & { session_type: string | null })[] {
  const byWeek = new Map<number, Record<string, unknown>>()
  for (const w of plan?.weeks ?? []) {
    const n = (w as unknown as { n?: number }).n
    if (typeof n === 'number') byWeek.set(n, (w.sessions ?? {}) as Record<string, unknown>)
  }
  return rows.map(r => {
    const s = r.week_n != null && r.session_day ? byWeek.get(r.week_n)?.[r.session_day] : undefined
    return { ...r, session_type: s ? coachingSessionType(s as never) : null }
  })
}
