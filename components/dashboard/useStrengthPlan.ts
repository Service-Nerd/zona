'use client'
// STRENGTH-ENGINE-01 Phase 2 — the runner's strength plan, fetched ONCE at dashboard level
// and passed down (Global State Pattern, CLAUDE.md), so Today, Plan, Me and the session
// screen can never disagree about it.
//
// `enabled` is the client's release check (admin while STRENGTH_RELEASE='admin'). It only
// decides whether to ASK; the server's gate decides whether to answer (404 → 'off').

import { useCallback, useEffect, useRef, useState } from 'react'
import { authedFetch } from '@/lib/supabase/authedFetch'
import type { LiftFeel, LiftLog, StrengthPlan, StrengthProfile } from '@/packages/strength'
import { applyRecoveryEases, parseRecoveryEases, type RecoveryAnswer, type RecoveryEases } from '@/lib/strength-bridge/recoveryEases'

export type StrengthCompletion = 'done' | 'skipped'

export interface StrengthState {
  /** off: not available to this runner · none: available, not set up · ready · error: could not load. */
  status: 'off' | 'loading' | 'none' | 'ready' | 'error'
  plan: StrengthPlan | null
  profile: StrengthProfile | null
  completions: Record<string, StrengthCompletion>
  /** STRENGTH-RECOVERY-01 — the runner's recovery answers by date ("eased" / "declined"). */
  recoveryEases: RecoveryEases
  /** STRENGTH-PROGRESSION-01 — the runner's lift logs, oldest first (last 120 days). */
  liftLogs: LiftLog[]
}

const OFF: StrengthState = { status: 'off', plan: null, profile: null, completions: {}, recoveryEases: {}, liftLogs: [] }

export function useStrengthPlan(enabled: boolean, runPlanKey: unknown) {
  const [state, setState] = useState<StrengthState>(enabled ? { ...OFF, status: 'loading' } : OFF)
  const live = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  // STRENGTH-ENTRY-01 — the wizard saves strength straight after the run plan, and the new run
  // plan re-triggers a load. A load that started BEFORE a save must not land after it and put
  // the runner back to "not set up", so each request takes a ticket and only the latest counts.
  const ticket = useRef(0)

  const load = useCallback(async () => {
    if (!enabled) { setState(OFF); return }
    const mine = ++ticket.current
    const stale = () => !live.current || mine !== ticket.current
    try {
      const res = await authedFetch('/api/strength/plan')
      if (stale()) return
      if (res.status === 404 || res.status === 401) { setState(OFF); return }
      if (!res.ok) { setState(s => ({ ...s, status: 'error' })); return }
      const body = await res.json()
      if (stale()) return
      setState(body.plan
        ? { status: 'ready', plan: body.plan, profile: body.profile ?? null, completions: body.completions ?? {}, recoveryEases: parseRecoveryEases(body.recovery_eases), liftLogs: Array.isArray(body.lift_logs) ? body.lift_logs : [] }
        : { status: 'none', plan: null, profile: null, completions: {}, recoveryEases: {}, liftLogs: [] })
    } catch {
      if (!stale()) setState(s => ({ ...s, status: 'error' }))
    }
  }, [enabled])

  // Re-ask when the run plan changes: the server re-places strength around it.
  useEffect(() => { void load() }, [load, runPlanKey])

  /** Save a profile and build the plan. Resolves to an error message or null. */
  /** SAVE-PATTERN-01 — returns the saved plan too, so the caller can say what changed. */
  const save = useCallback(async (profile: StrengthProfile): Promise<{ error: string | null; plan: StrengthPlan | null }> => {
    ++ticket.current
    try {
      const res = await authedFetch('/api/strength/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile }),
      })
      if (!res.ok) return { error: 'save', plan: null }
      const body = await res.json()
      setState(s => ({ status: 'ready', plan: body.plan, profile, completions: s.completions, recoveryEases: parseRecoveryEases(body.recovery_eases ?? s.recoveryEases), liftLogs: s.liftLogs }))
      return { error: null, plan: body.plan ?? null }
    } catch { return { error: 'save', plan: null } }
  }, [])

  /** SAVE-PATTERN-01 — the plan this profile WOULD build, validated, written nowhere. Null on any failure. */
  const preview = useCallback(async (profile: StrengthProfile): Promise<StrengthPlan | null> => {
    try {
      const res = await authedFetch('/api/strength/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile, preview: true }),
      })
      if (!res.ok) return null
      return ((await res.json()).plan as StrengthPlan) ?? null
    } catch { return null }
  }, [])

  /** Optimistic; rolls back and resolves false when the server refuses. */
  const setCompletion = useCallback(async (date: string, status: StrengthCompletion | null): Promise<boolean> => {
    let before: StrengthCompletion | undefined
    setState(s => {
      before = s.completions[date]
      const next = { ...s.completions }
      if (status) next[date] = status; else delete next[date]
      return { ...s, completions: next }
    })
    try {
      const res = await authedFetch('/api/strength/completion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, status }),
      })
      if (res.ok) return true
    } catch { /* fall through to rollback */ }
    setState(s => {
      const next = { ...s.completions }
      if (before) next[date] = before; else delete next[date]
      return { ...s, completions: next }
    })
    return false
  }, [])

  /**
   * STRENGTH-RECOVERY-01 — the runner's answer on Today's recovery card. NOT optimistic: the card
   * stays until the server has the answer, so a failed save is said (InlineError) and can be retried.
   * On "eased" the day's session is served lighter at once, through the same owner the server uses.
   */
  const setRecoveryAnswer = useCallback(async (date: string, answer: RecoveryAnswer): Promise<boolean> => {
    try {
      const res = await authedFetch('/api/strength/ease', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, answer }),
      })
      if (!res.ok) return false
    } catch { return false }
    setState(s => {
      const recoveryEases = { ...s.recoveryEases, [date]: answer }
      return { ...s, recoveryEases, plan: s.plan ? applyRecoveryEases(s.plan, recoveryEases) : s.plan }
    })
    return true
  }, [])

  /** STRENGTH-PROGRESSION-01 — one lift's log for one session. Not optimistic: the row says Logged only once saved. */
  const setLiftLog = useCallback(async (date: string, exerciseId: string, loadKg: number | null, feel: LiftFeel): Promise<boolean> => {
    try {
      const res = await authedFetch('/api/strength/log', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, exercise_id: exerciseId, load_kg: loadKg, feel }),
      })
      if (!res.ok) return false
      const saved = await res.json()
      setState(s => ({ ...s, liftLogs: [...s.liftLogs.filter(l => !(l.date === date && l.exercise_id === exerciseId)), { date, exercise_id: exerciseId, load_kg: saved.load_kg ?? null, feel, counts: saved.counts !== false }] }))
      return true
    } catch { return false }
  }, [])

  // STRENGTH-ROW-OPEN-01 — fire and forget: a lost count must never cost the runner anything.
  const recordExerciseOpened = useCallback((exerciseId: string) => {
    authedFetch('/api/strength/opened', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exercise_id: exerciseId }),
    }).catch(() => {})
  }, [])

  return { strength: state, reloadStrength: load, saveStrength: save, previewStrength: preview, setStrengthCompletion: setCompletion, setStrengthRecoveryAnswer: setRecoveryAnswer, setStrengthLiftLog: setLiftLog, recordStrengthExerciseOpened: recordExerciseOpened }
}

/**
 * STRENGTH-NOTE-01 — the week's note, fetched once per week and kept for the session.
 * Silent: any failure leaves it null, and null renders nothing.
 */
export function useStrengthWeeklyNote(weekN: number | null, enabled: boolean): string | null {
  const [notes, setNotes] = useState<Record<number, string>>({})
  // Asked-for weeks live in a ref, not state: marking a week in state would re-run the
  // effect, whose cleanup would then throw the reply away.
  const asked = useRef(new Set<number>())
  useEffect(() => {
    if (!enabled || weekN == null || asked.current.has(weekN)) return
    asked.current.add(weekN)
    authedFetch('/api/strength/weekly-note', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ week_n: weekN }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(b => { if (typeof b?.note === 'string') setNotes(n => ({ ...n, [weekN]: b.note })) })
      .catch(() => {})
  }, [weekN, enabled])
  return weekN == null ? null : notes[weekN] ?? null
}
