'use client'

// LEDGER-01 — shared client hook for the discipline-ledger fetch.
//
// Single GET on mount, cancelled on unmount. Returns `null` while
// loading (callers render a placeholder) and the resolved outcome
// otherwise. No polling.
//
// Used by MeScreen for the "Weeks within the lines" card, by
// SessionPopupInner reflect view + PostRunScreen for the DOCTRINE-01
// conditional brand-statement surface on SessionCompleteCard.

import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/supabase/authedFetch'

export interface LedgerSnapshot {
  weeksWithinLines: number
  currentWeekStatus: 'on_track' | 'broken' | 'pending'
  advancedThisWeek: boolean
  tier: 'free' | 'trial' | 'paid'
}

export function useDisciplineLedger(): LedgerSnapshot | null {
  const [snapshot, setSnapshot] = useState<LedgerSnapshot | null>(null)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await authedFetch('/api/discipline-ledger')
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (cancelled) return
        setSnapshot({
          weeksWithinLines:  data.weeksWithinLines ?? 0,
          currentWeekStatus: data.currentWeekStatus ?? 'pending',
          advancedThisWeek:  !!data.advancedThisWeek,
          tier:              data.tier ?? 'free',
        })
      } catch { /* silent — caller treats null as "no data yet" */ }
    })()
    return () => { cancelled = true }
  }, [])
  return snapshot
}
