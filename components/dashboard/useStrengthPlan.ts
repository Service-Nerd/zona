'use client'
// STRENGTH-ENGINE-01 Phase 2 — the runner's strength plan, fetched ONCE at dashboard level
// and passed down (Global State Pattern, CLAUDE.md), so Today, Plan, Me and the session
// screen can never disagree about it.
//
// `enabled` is the client's release check (admin while STRENGTH_RELEASE='admin'). It only
// decides whether to ASK; the server's gate decides whether to answer (404 → 'off').

import { useCallback, useEffect, useRef, useState } from 'react'
import { authedFetch } from '@/lib/supabase/authedFetch'
import type { StrengthPlan, StrengthProfile } from '@/packages/strength'
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
}

const OFF: StrengthState = { status: 'off', plan: null, profile: null, completions: {}, recoveryEases: {} }

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
        ? { status: 'ready', plan: body.plan, profile: body.profile ?? null, completions: body.completions ?? {}, recoveryEases: parseRecoveryEases(body.recovery_eases) }
        : { status: 'none', plan: null, profile: null, completions: {}, recoveryEases: {} })
    } catch {
      if (!stale()) setState(s => ({ ...s, status: 'error' }))
    }
  }, [enabled])

  // Re-ask when the run plan changes: the server re-places strength around it.
  useEffect(() => { void load() }, [load, runPlanKey])

  /** Save a profile and build the plan. Resolves to an error message or null. */
  const save = useCallback(async (profile: StrengthProfile): Promise<string | null> => {
    ++ticket.current
    try {
      const res = await authedFetch('/api/strength/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile }),
      })
      if (!res.ok) return 'save'
      const body = await res.json()
      setState(s => ({ status: 'ready', plan: body.plan, profile, completions: s.completions, recoveryEases: parseRecoveryEases(body.recovery_eases ?? s.recoveryEases) }))
      return null
    } catch { return 'save' }
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

  return { strength: state, reloadStrength: load, saveStrength: save, setStrengthCompletion: setCompletion, setStrengthRecoveryAnswer: setRecoveryAnswer }
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
