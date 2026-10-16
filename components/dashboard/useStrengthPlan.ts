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

export type StrengthCompletion = 'done' | 'skipped'

export interface StrengthState {
  /** off: not available to this runner · none: available, not set up · ready · error: could not load. */
  status: 'off' | 'loading' | 'none' | 'ready' | 'error'
  plan: StrengthPlan | null
  profile: StrengthProfile | null
  completions: Record<string, StrengthCompletion>
}

const OFF: StrengthState = { status: 'off', plan: null, profile: null, completions: {} }

export function useStrengthPlan(enabled: boolean, runPlanKey: unknown) {
  const [state, setState] = useState<StrengthState>(enabled ? { ...OFF, status: 'loading' } : OFF)
  const live = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])

  const load = useCallback(async () => {
    if (!enabled) { setState(OFF); return }
    try {
      const res = await authedFetch('/api/strength/plan')
      if (!live.current) return
      if (res.status === 404 || res.status === 401) { setState(OFF); return }
      if (!res.ok) { setState(s => ({ ...s, status: 'error' })); return }
      const body = await res.json()
      if (!live.current) return
      setState(body.plan
        ? { status: 'ready', plan: body.plan, profile: body.profile ?? null, completions: body.completions ?? {} }
        : { status: 'none', plan: null, profile: null, completions: {} })
    } catch {
      if (live.current) setState(s => ({ ...s, status: 'error' }))
    }
  }, [enabled])

  // Re-ask when the run plan changes: the server re-places strength around it.
  useEffect(() => { void load() }, [load, runPlanKey])

  /** Save a profile and build the plan. Resolves to an error message or null. */
  const save = useCallback(async (profile: StrengthProfile): Promise<string | null> => {
    try {
      const res = await authedFetch('/api/strength/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile }),
      })
      if (!res.ok) return 'save'
      const body = await res.json()
      setState(s => ({ status: 'ready', plan: body.plan, profile, completions: s.completions }))
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

  return { strength: state, reloadStrength: load, saveStrength: save, setStrengthCompletion: setCompletion }
}
