'use client'

// DASHBOARD-SCREEN-EXTRACT-02 — lifted verbatim out of `DashboardClient.tsx`.
//
// It was a module-level function in a 14k-line file, so it closed over nothing and this
// move changes no behaviour. What it changes is REACH: nothing could import it, so it
// could not be rendered by a harness or a mounting test.
//
// ⚠️ The body is UNCHANGED. Edit it in a separate commit so the move stays a move.

import Button from '@/components/ui/Button'
import { BRAND } from '@/lib/brand'
import { syncOnAppOpen } from '@/lib/health/clientSync'
import { createClient } from '@/lib/supabase/client'
import { Capacitor } from '@capacitor/core'
import { useEffect, useState } from 'react'

/**
 * Apple Health connect row — iOS-native only, hidden on web.
 * Mirrors StravaConnectionRow shape; HealthKit auth is plugin-based (no OAuth
 * redirect), so the connect button calls the plugin directly.
 */
export default function AppleHealthConnectionRow({ onHRFound }: {
  /** Called after a successful connect with resting/max HR from HealthKit.
   *  Null = HealthKit had no reading (Garmin user etc). */
  onHRFound?: (rhr: number | null, mhr: number | null) => void
}) {
  const [isNative, setIsNative] = useState(false)
  const [connectedAt, setConnectedAt] = useState<string | null | undefined>(undefined)  // undefined = checking
  const [busy, setBusy] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    void (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) { setConnectedAt(null); return }
        setIsNative(true)
      } catch {
        setConnectedAt(null)
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setConnectedAt(null); return }
      const { data } = await supabase
        .from('user_settings')
        .select('healthkit_connected_at')
        .eq('id', user.id)
        .single()
      setConnectedAt((data as any)?.healthkit_connected_at ?? null)
    })()
  }, [])

  // Hidden on web
  if (!isNative) return null

  async function connect() {
    setBusy(true)
    try {
      const { requestHealthKitAuth, syncOnAppOpen } = await import('@/lib/health/clientSync')
      const granted = await requestHealthKitAuth()
      if (!granted) {
        // User denied at the iOS permission sheet, OR HealthKit unavailable
        // (web/Android), OR the framework isn't linked in Xcode. Caller can
        // distinguish by whether requestHealthKitAuth threw vs returned false.
        console.warn('[HealthKit] auth not granted (denial, unavailable, or framework not linked)')
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const nowIso = new Date().toISOString()
      await supabase.from('user_settings').upsert({
        id: user.id,
        healthkit_connected_at: nowIso,
        updated_at: nowIso,
      })
      setConnectedAt(nowIso)
      // First sync — best-effort, don't block UI
      void syncOnAppOpen().catch((e) => {
        console.warn('[HealthKit] first sync after connect failed:', e)
      })
      // Auto-populate HR zones — same pattern as ConnectRunsScreen
      if (onHRFound) {
        const { fetchAppleHealthHRSnapshot } = await import('@/lib/health/clientSync')
        fetchAppleHealthHRSnapshot()
          .then(snap => onHRFound(snap?.restingHR ?? null, snap?.maxHR ?? null))
          .catch(() => onHRFound(null, null))
      }
    } catch (e) {
      // Most likely the plugin failed to load or HealthKit.framework isn't
      // linked. Without this log the connect button silently does nothing,
      // which makes it impossible to debug from the Xcode console.
      console.warn('[HealthKit] connect failed:', e)
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('user_settings').upsert({
        id: user.id,
        healthkit_connected_at: null,
        updated_at: new Date().toISOString(),
      })
      setConnectedAt(null)
    } finally { setBusy(false) }
  }

  const isLoading = connectedAt === undefined
  const connected = !!connectedAt

  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--border-col)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--moss-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--moss)' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>Apple Health</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', marginTop: '1px', color: isLoading ? 'var(--text-muted)' : connected ? 'var(--teal)' : 'var(--text-muted)' }}>
              {isLoading ? 'checking...' : connected ? 'Connected' : 'Not connected'}
            </div>
          </div>
        </div>

        {/* DESTRUCTIVE-WIRING-01 (Design Board, 2026-10-02) — the disconnect below is
            `destructive`, not `ghost`. Disconnecting a data source is destructive, and the
            variant existed, defined and documented, with ZERO call sites. ⚠️ It does NOT become
            a filled red rectangle: `BUTTON-SYSTEM-01` makes destructive `--card` + a `--danger`
            border at rest and inverts it on hover — the family's one named exception. */}
        {!isLoading && (
          connected ? (
            <Button variant="destructive" size="compact" onClick={disconnect} disabled={busy}>
              {busy ? 'Saving...' : 'Disconnect'}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="compact"
              className="btn--inline-target"
              onClick={connect}
              disabled={busy}
              /* Its original box, restored: 29px in a space-between row. The
                 44px target is `.btn--inline-target`'s invisible overlay. */
              style={{ padding: '8px 14px', fontSize: '11px', borderRadius: '8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}
            >
              {busy ? 'Connecting...' : 'Connect'}
            </Button>
          )
        )}
      </div>
      {!isLoading && !connected && (
        <div style={{ padding: '0 16px 12px', fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.55 }}>
          {BRAND.name} reads your runs from Apple Health to coach you. Read-only: {BRAND.name} never writes to Apple Health.
        </div>
      )}
    </div>
  )
}
