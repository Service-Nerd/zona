'use client'

// DASHBOARD-SCREEN-EXTRACT-01 — lifted verbatim out of `DashboardClient.tsx`.
//
// It was a module-level function in a 14,447-line file, so it closed over nothing and
// this move changes no behaviour. What it changes is REACH: nothing could import it,
// so it could not be rendered by a harness, a mounting test, or anything but a live
// signed-in session. Fourteen screens were in that position.
//
// ⚠️ The body below is UNCHANGED. If it needs editing, edit it in a separate commit,
// so the move stays reviewable as a move.

import PendingAdjustmentBanner from '@/components/shared/PendingAdjustmentBanner'
import { createClient } from '@/lib/supabase/client'
import { Capacitor } from '@capacitor/core'
import { useEffect, useState } from 'react'

/**
 * CONNECT-01 — One-shot reminder banner for users who skipped the
 * Connect-Your-Runs ceremony on first plan save.
 *
 * Render rules:
 *   • Native iOS only (no HealthKit on web; banner doesn't apply).
 *   • Shows when connect_runs_seen=false AND connect_runs_banner_dismissed_at IS NULL.
 *   • Dismiss (X button) stamps connect_runs_banner_dismissed_at; banner never returns.
 *
 * Self-contained: fetches its own row from user_settings on mount. Returns
 * null until the check resolves so it doesn't flicker into view on a fresh
 * page load before we know the state.
 */
export default function ConnectRunsBanner() {
  const [visible, setVisible] = useState<boolean | undefined>(undefined)
  const supabase = createClient()

  useEffect(() => {
    void (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) { setVisible(false); return }
      } catch { setVisible(false); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setVisible(false); return }
      const { data } = await supabase
        .from('user_settings')
        .select('connect_runs_seen, connect_runs_banner_dismissed_at, strava_refresh_token, healthkit_connected_at')
        .eq('id', user.id)
        .single()
      const skipped       = (data as any)?.connect_runs_seen === false
      const notYetShown   = (data as any)?.connect_runs_banner_dismissed_at == null
      // Suppress if any data source is live — Strava and HealthKit are co-equal.
      const hasDataSource = !!(data as any)?.strava_refresh_token || !!(data as any)?.healthkit_connected_at
      setVisible(skipped && notYetShown && !hasDataSource)
    })()
  }, [])

  async function dismiss() {
    setVisible(false)  // optimistic — instant fade
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('user_settings').upsert({
        id: user.id,
        connect_runs_banner_dismissed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    } catch {
      // Stamp failed — next session-day open will retry. Acceptable.
    }
  }

  if (!visible) return null

  return (
    // Banner anatomy aligned to ui-patterns.md Pattern 10 (PendingAdjustmentBanner):
    // 14px radius, 14px 16px padding. Moss accent rail (vs Pattern 10's warn)
    // because this is a passive reminder, not a coaching warning. Rail is an
    // absolutely-positioned 3px span per Pattern 16b § Companion.
    <div style={{
      position: 'relative',
      margin: '12px 16px 0',
      padding: '14px 16px 14px 24px',
      background: 'var(--card)', boxShadow: 'var(--shadow-card)',
      border: '1px solid var(--line)',
      borderRadius: '14px',
      display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
    }}>
      <span aria-hidden="true" style={{
        position: 'absolute', left: '8px', top: '14px', bottom: '14px',
        width: '3px', background: 'var(--moss)', borderRadius: '2px',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '2px' }}>
          Still need your runs.
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5 }}>
          Apple Health connects from the Me screen. Takes about ten seconds.
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          // 44pt tap target per iOS HIG. Negative margin keeps the visual ×
          // anchored to the card edge while the hit area extends outward.
          width: '44px', height: '44px',
          marginTop: '-10px', marginRight: '-10px', marginBottom: '-10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--mute)',
          fontFamily: 'var(--font-ui)', fontSize: '18px', fontWeight: 400, lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  )
}
