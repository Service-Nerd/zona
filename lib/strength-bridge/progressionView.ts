// STRENGTH-PROGRESSION-01 (S14) — the suggestion for every loaded main lift of one session, from the plan and the
// runner's logs. Client-safe; the strength session screen reads it. The rule itself is `suggestLoad`'s.

import { isNoStepSession, suggestLoad, type LiftLog, type LiftSuggestion, type StrengthPlan, type StrengthSession } from '@/packages/strength'
import type { RecoveryEases } from './recoveryEases'

export function liftSuggestionsFor(
  plan: StrengthPlan, session: StrengthSession, logs: readonly LiftLog[], eases: RecoveryEases,
): Record<string, LiftSuggestion> {
  if (!session.date) return {}
  const week = plan.weeks.find(w => w.sessions.some(s => s.date === session.date))
  const noStep = isNoStepSession(week?.phase, eases[session.date] === 'eased' || session.eased_for === 'recovery')
  const injuries = plan.injury_tags ?? plan.profile.injury_tags ?? []
  // S14 Am.1 — each log carries the reps the plan prescribed that lift on its date, so a block whose reps rise can
  // bring the load down. Read from the plan (logs store load and feel only).
  const logDates = new Set(logs.map(l => l.date))
  const prescribed = new Map<string, number>()
  for (const w of plan.weeks) for (const s of w.sessions) if (s.date && logDates.has(s.date)) for (const b of s.blocks) if (b.role === 'main') for (const it of b.items) {
    if (it.reps != null) prescribed.set(`${s.date}|${it.exercise_id}`, it.reps)
  }
  const withReps = logs.map(l => ({ ...l, reps: l.reps ?? prescribed.get(`${l.date}|${l.exercise_id}`) }))
  const out: Record<string, LiftSuggestion> = {}
  for (const b of session.blocks) if (b.role === 'main') for (const it of b.items) {
    out[it.exercise_id] = suggestLoad(withReps, { exerciseId: it.exercise_id, today: session.date, noStep, injuries, reps: it.reps, rir: it.rir })
  }
  return out
}

/** Today's own log for each lift, so the opened row shows what was entered. */
export function logsOn(logs: readonly LiftLog[], date: string | null): Record<string, LiftLog> {
  const out: Record<string, LiftLog> = {}
  if (date) for (const l of logs) if (l.date === date) out[l.exercise_id] = l
  return out
}
