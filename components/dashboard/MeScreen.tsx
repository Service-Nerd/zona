'use client'

// DASHBOARD-SCREEN-EXTRACT-03 — lifted verbatim out of `DashboardClient.tsx`.
//
// Module-level in the original, so it closed over nothing and this move changes no
// behaviour. It changes REACH: nothing could import it, so nothing could render it.
//
// ⚠️ Bodies UNCHANGED. Edit in a separate commit so the move stays a move.

import AIMark from '@/components/shared/AIMark'
import { getDeviceToken } from '@/components/dashboard/pushDevice'
import ActionRow from '@/components/shared/ActionRow'
import AdjustmentDiff from '@/components/shared/AdjustmentDiff'
import AppleHealthConnectionRow from '@/components/dashboard/AppleHealthConnectionRow'
import BackButton from '@/components/shared/BackButton'
import FloatingBackButton from '@/components/shared/FloatingBackButton'
import Button from '@/components/ui/Button'
import ExternalLink from '@/components/shared/ExternalLink'
import FaqScreen from '@/components/shared/FaqScreen'
import LedgerCard from '@/components/dashboard/LedgerCard'
import MePlanCard from '@/components/shared/MePlanCard'
import QuitTab from '@/components/dashboard/QuitTab'
import ScreenHeader from '@/components/ui/ScreenHeader'
import SupportScreen from '@/components/dashboard/SupportScreen'
import Switch from '@/components/ui/Switch'
import type { AfterSheet } from '@/lib/subscriptions/redeemCode'
import type { Plan } from '@/types/plan'
import type { TierReason } from '@/lib/trial'
import type { Zone } from '@/components/shared/ZoneBar'
import { BRAND } from '@/lib/brand'
import { CONNECTIONS_TITLE, ZONES_UNSET_SUB, PLAN_ADJUSTMENTS_PENDING_SUB, PLAN_ADJUSTMENTS_SUB, PLAN_ADJUSTMENTS_TITLE, connectionsSubtitle } from '@/components/shared/meDoors'
import { Capacitor } from '@capacitor/core'
import { Chevron } from '@/components/shared/Chevron'
import { FAQ_SUBTITLE, FAQ_TITLE } from '@/components/shared/FaqScreen'
import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'
import { IdentityCard } from '@/components/shared/IdentityCard'
import { MICRO_LABELS } from '@/components/shared/microLabels'
import { PREFERENCES_SUBTITLE, PREFERENCES_TITLE, PreferencesScreen } from '@/components/shared/PreferencesScreen'
import { PUSH_OFF_KEY } from '@/components/dashboard/dashboardHelpers'
import { RedeemCodeLink } from '@/components/shared/RedeemCodeLink'
import { SectionLabel } from '@/components/shared/SectionLabel'
import { authedFetch } from '@/lib/supabase/authedFetch'
import { clearWidgetState } from '@/lib/native/sharedStore'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/format'
import { getCurrentWeekIndex } from '@/lib/plan'
import { Z_LAYERS } from '@/lib/ui/zLayers'
import { useDisciplineLedger } from '@/lib/coaching/useDisciplineLedger'
import { useEffect, useState } from 'react'
import { useScrolledContainer } from '@/lib/ui/useScrolledContainer'
import { useRouter } from 'next/navigation'
import { useSignOut } from '@/lib/auth/signOut'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData  = window.atob(base64)
  const bytes    = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) bytes[i] = rawData.charCodeAt(i)
  return bytes.buffer
}

function PushNotificationsRow({ onStatusChange }: { onStatusChange?: (subscribed: boolean) => void } = {}) {
  const [status, setStatus] = useState<'checking' | 'unsupported' | 'subscribed' | 'denied' | 'idle'>('checking')
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  // Bubble the subscribed boolean up so the parent can gate the
  // dependent "Morning training push" toggle on it (you can't get a
  // morning reminder if push itself is off).
  useEffect(() => {
    onStatusChange?.(status === 'subscribed')
  }, [status, onStatusChange])

  useEffect(() => {
    async function check() {
      // Respect user's explicit-off intent — even if iOS permission is
      // still granted, treat as idle so the toggle starts off.
      const userTurnedOff = (() => {
        try { return localStorage.getItem(PUSH_OFF_KEY) === '1' } catch { return false }
      })()

      // Native: ask the plugin whether iOS already granted permission.
      const { Capacitor } = await import('@capacitor/core')
      if (Capacitor.isNativePlatform()) {
        const { PushNotifications } = await import('@capacitor/push-notifications')
        try {
          const perm = await PushNotifications.checkPermissions()
          if (perm.receive === 'denied')  { setStatus('denied'); return }
          // Permission granted is necessary but NOT sufficient — the APNs token
          // can fail to register, leaving no push_subscriptions row. Showing
          // "on" off permission alone is a false positive. Confirm a real row.
          if (perm.receive === 'granted' && !userTurnedOff) {
            setStatus((await hasServerSubscription('ios')) ? 'subscribed' : 'idle')
            return
          }
          setStatus('idle')
        } catch { setStatus('idle') }
        return
      }

      // Web: rely on the service worker / PushManager check, then confirm the
      // server row exists too so the toggle can't claim "on" without one.
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setStatus('unsupported'); return }
      const perm = (Notification as any).permission
      if (perm === 'denied') { setStatus('denied'); return }
      try {
        const regs = await navigator.serviceWorker.getRegistrations()
        if (!regs.length) { setStatus('idle'); return }
        const sub = await regs[0].pushManager.getSubscription()
        if (!sub || userTurnedOff) { setStatus('idle'); return }
        setStatus((await hasServerSubscription('web')) ? 'subscribed' : 'idle')
      } catch { setStatus('idle') }
    }
    void check()
  }, [])

  async function disablePush() {
    setLoading(true)
    setErrMsg(null)
    try {
      const { Capacitor } = await import('@capacitor/core')

      if (Capacitor.isNativePlatform()) {
        // Get the current device token so we can DELETE the matching row.
        // iOS won't let us revoke the permission itself — that's a Settings
        // app concern — but we can stop sending pushes at our end. Uses the
        // shared cached-token helper so it can't hang on a stale register().
        let token: string | null = null
        try { token = await getDeviceToken(5_000) } catch { token = null }
        if (token) {
          await authedFetch('/api/push/subscribe', {
            method:  'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ token }),
          })
        }
      } else if ('serviceWorker' in navigator) {
        // Web: read the subscription endpoint and delete the matching row.
        // The browser-side subscription stays — we don't unsubscribe from
        // PushManager so re-toggling on doesn't re-prompt for permission.
        try {
          const regs = await navigator.serviceWorker.getRegistrations()
          const sub  = regs[0] && await regs[0].pushManager.getSubscription()
          if (sub) {
            await authedFetch('/api/push/subscribe', {
              method:  'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({ endpoint: sub.endpoint }),
            })
          }
        } catch {}
      }

      try { localStorage.setItem(PUSH_OFF_KEY, '1') } catch {}
      setStatus('idle')
    } catch (err) {
      console.warn('[push] disable failed:', err instanceof Error ? err.message : err)
      setErrMsg("Couldn't turn off. Try again in a moment.")
    } finally {
      setLoading(false)
    }
  }

  async function enablePush() {
    setLoading(true)
    setErrMsg(null)
    // Clearing the explicit-off flag — the user is opting back in.
    try { localStorage.removeItem(PUSH_OFF_KEY) } catch {}
    const { Capacitor } = await import('@capacitor/core')

    // Native iOS path: request permission, register, send the device token
    // returned via the `registration` event up to /api/push/subscribe.
    if (Capacitor.isNativePlatform()) {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')
        const perm = await PushNotifications.requestPermissions()
        if (perm.receive !== 'granted') {
          setStatus('denied')
          setLoading(false)
          return
        }
        // Resolve the device token (cached if we've already seen one this
        // session, else register-and-wait, bounded at 30s). This is the fix
        // for the "Working… forever → Couldn't enable push" bug: a second
        // register() in a session doesn't re-fire the registration event, but
        // the cached token from the first one lets us subscribe instantly.
        const token = await getDeviceToken()
        const res = await authedFetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: 'ios', token, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
        })
        // authedFetch resolves on ANY HTTP status — a 5xx is not a thrown error.
        // Without this check the toggle flips to "subscribed" while no row was
        // ever written. Surface the real failure instead.
        if (!res.ok) {
          throw new Error(`subscribe failed (${res.status})`)
        }
        setStatus('subscribed')
      } catch (err) {
        // Most common cause on simulator: APNs sandbox unreachable. Also fires
        // on a true APNs registration failure in TestFlight. Surface the
        // reason in the UI instead of silently returning to idle — that was
        // the "Enabling… forever" UX the user reported.
        const msg = err instanceof Error ? err.message : String(err)
        console.warn('[push] iOS registration failed:', msg)
        setStatus('idle')
        setErrMsg("Couldn't enable push. Try again in a moment.")
      } finally {
        setLoading(false)
      }
      return
    }

    // Web path: existing service-worker + VAPID flow.
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setLoading(false); return }
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) { setLoading(false); return }
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      const res = await authedFetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sub.toJSON(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      })
      // Same guard as the native path: authedFetch doesn't throw on a 403/5xx,
      // so an unchecked response would fake a successful subscribe.
      if (!res.ok) {
        setStatus('idle')
        setErrMsg(res.status === 403
          ? 'Run pings are part of the paid plan.'
          : "Couldn't enable push. Try again in a moment.")
        return
      }
      setStatus('subscribed')
    } catch { setStatus((Notification as any).permission === 'denied' ? 'denied' : 'idle') }
    finally { setLoading(false) }
  }

  if (status === 'unsupported') return null

  // Toggle is "on" when subscribed; "off" otherwise. While the iOS permission
  // sheet is up we keep it visually on (optimistic) so the user gets immediate
  // feedback. On grant we stay on; on deny we revert to off + sub-copy.
  const isOn = status === 'subscribed' || loading
  // Tap behaviour: OFF → subscribe. ON → unsubscribe (delete the DB row,
  // stamp the localStorage flag so the row isn't auto-recreated on mount).
  // Denied stays a no-op — user has to fix it in iOS Settings.
  const handleTap = () => {
    if (loading || status === 'checking' || status === 'denied') return
    if (status === 'subscribed') {
      void disablePush()
    } else if (status === 'idle') {
      void enablePush()
    }
  }
  const subtitle = errMsg
    ? errMsg
    : status === 'checking' ? 'Checking…'
    : status === 'subscribed' ? "Kit pings you when he's read your run."
    : status === 'denied' ? 'Blocked in iOS Settings. Open to enable.'
    : loading ? 'Working…'
    : "Off. Tap to let Kit ping you when he's read your run."

  return (
    <div style={{ margin: '4px 0', background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', gap: 'var(--space-3)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', fontWeight: 500 }}>Run notifications</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', marginTop: '2px', lineHeight: 1.4 }}>
            {subtitle}
          </div>
        </div>
        <Switch
          checked={isOn}
          onChange={handleTap}
          disabled={loading || status === 'checking' || status === 'denied'}
          ariaLabel="Run notifications"
        />
      </div>
    </div>
  )
}

function DailyPushToggleRow({ enabled, onChange, disabled = false }: {
  enabled: boolean
  onChange: (v: boolean) => void
  /** Parent/child gate — true when Run notifications is off; row goes dim
   *  and toggle is non-interactive (you can't get a morning reminder if
   *  push itself is off). */
  disabled?: boolean
}) {
  // Effective on-state: only "on" when both the user preference says on AND
  // push is enabled at all. Otherwise the toggle should read as off so the
  // user isn't lied to about getting a push that can never arrive.
  const effectiveOn = enabled && !disabled
  return (
    <div style={{ margin: '4px 0', background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', opacity: disabled ? 0.55 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', gap: 'var(--space-3)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', fontWeight: 500 }}>Morning training push</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', marginTop: '2px', lineHeight: 1.4 }}>
            {disabled
              ? 'Turn on Run notifications first.'
              : enabled
                ? `${BRAND.coachName} reminds you about today's session at 06:30.`
                : 'Off. No morning reminder.'}
          </div>
        </div>
        {/* ⚠️ `effectiveOn`, not `enabled`. The row is gated on push being on at
            all, and renders OFF when it is not even if the stored preference
            says on, so nobody is promised a push that cannot arrive. `Switch`
            never derives this — the caller owns it (board amendment 2). */}
        <Switch
          checked={effectiveOn}
          onChange={() => onChange(!enabled)}
          disabled={disabled}
          ariaLabel="Morning training push"
        />
      </div>
    </div>
  )
}

// DS-03: StravaConnectionRow is gated on is_admin.
// Strava API approval is pending — showing a Connect button that fails to all
// non-admin users damages trust and implies Strava is required (it isn't).
// Admins still see it for testing. Removes itself silently when is_admin=false.
function StravaConnectionRow() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [isAdminUser, setIsAdminUser] = useState<boolean | null>(null) // null = loading
  const [disconnecting, setDisconnecting] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setConnected(false); setIsAdminUser(false); return }
      setUserId(user.id)
      const { data } = await supabase.from('user_settings').select('strava_refresh_token, is_admin').eq('id', user.id).single()
      setConnected(!!(data?.strava_refresh_token))
      setIsAdminUser(!!(data as any)?.is_admin)
    }
    check()

    // Handle redirect back from Strava OAuth
    const params = new URLSearchParams(window.location.search)
    if (params.get('strava') === 'connected') {
      setConnected(true)
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [])

  async function disconnect() {
    setDisconnecting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('user_settings').upsert({
        id: user.id,
        strava_access_token: null,
        strava_refresh_token: null,
        strava_token_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      setConnected(false)
    } finally { setDisconnecting(false) }
  }

  // Resolve loading: both flags must be non-null before rendering anything.
  const isLoading = connected === null || isAdminUser === null
  // Non-admins never see the Strava row (Strava API approval pending — DS-03).
  if (!isLoading && !isAdminUser) return null

  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--border-col)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--strava-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--strava)' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>Strava</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', marginTop: '1px', color: isLoading ? 'var(--text-muted)' : connected ? 'var(--teal)' : 'var(--text-muted)' }}>
              {isLoading ? 'checking...' : connected ? 'Connected' : 'Not connected'}
            </div>
          </div>
        </div>

        {!isLoading && (
          connected ? (
            <Button variant="ghost" size="compact"  onClick={disconnect} disabled={disconnecting}>
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </Button>
          ) : (
            <Button variant="primary" className="btn--inline-target" onClick={async () => {
              if (!userId) return
              // Finding 7: mint the authorize URL via an authenticated request
              // (authedFetch attaches the bearer token) so the server derives
              // the userId from the session and signs the OAuth state. The
              // route returns the URL as JSON; native opens it in
              // SFSafariViewController (returns via NATIVE_STRAVA_CALLBACK,
              // handled in CapacitorBoot.tsx), web navigates to it. Dynamic
              // Capacitor import keeps the web bundle free of native shims.
              const { Capacitor } = await import('@capacitor/core')
              const isNative = Capacitor.isNativePlatform()
              const res = await authedFetch(`/api/strava/connect${isNative ? '?platform=ios' : ''}`)
              if (!res.ok) return
              const { url } = await res.json()
              if (!url) return
              if (isNative) {
                const { Browser } = await import('@capacitor/browser')
                await Browser.open({ url, presentationStyle: 'popover' })
                return
              }
              window.location.href = url
            }} disabled={!userId}  style={{
              background: 'var(--strava)', color: 'var(--card)',
              borderRadius: '8px', padding: '8px 14px',
              fontSize: '11px',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              cursor: userId ? 'pointer' : 'default',
              opacity: userId ? 1 : 0.5,
            }}>
              Connect
            </Button>
          )
        )}
      </div>
      {!isLoading && !connected && (
        <div style={{ padding: '0 16px 12px', fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.55 }}>
          Kit reads your Strava runs. Nothing else. We're not interested in your followers.
        </div>
      )}
    </div>
  )
}

function DeleteAccountScreen({ onBack }: { onBack: () => void }) {
  const { ref: pinRef, scrolled: pinScrolled } = useScrolledContainer(true)
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)
    try {
      const res = await authedFetch('/api/delete-account', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Something went wrong. Try again.')
        setLoading(false)
        return
      }
      const supabase = createClient()
      await clearWidgetState()
      await supabase.auth.signOut()
      router.replace('/auth/login')
    } catch {
      setError('Something went wrong. Try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* 🔴 BACK-ARROW-FLOAT-04 — PINNED AS A GROUP, NOT FLOATED. This is the OTHER
          arrow family `useScrolledContainer` already names (`BACK-HEADER-OWNER-01`): arrow
          and title in one row. Floating the arrow alone would tear it off its title, which
          is exactly the wizard mistake the founder caught. Same treatment as the session
          and post-run headers. */}
      <div
        ref={pinRef}
        className={`pinned-chrome${pinScrolled ? ' pinned-chrome--scrolled' : ''}`}
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                 padding: '16px 16px 8px', zIndex: Z_LAYERS.screenHeader }}
      >
        <BackButton onClick={onBack} />
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-brand)', letterSpacing: '-0.3px' }}>
          Delete your account
        </div>
      </div>

      <div style={{ padding: '8px 16px 40px', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', flex: 1 }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--border-col)', padding: '16px', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.55 }}>
            Your sessions, plan, and profile will be permanently removed.
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.55 }}>
            There&apos;s no going back. Your training history, HR data, and account details will be gone for good.
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', cursor: 'pointer' }}>
          <div
            onClick={() => setChecked(c => !c)}
            style={{ width: '20px', height: '20px', borderRadius: '5px', border: `1.5px solid ${checked ? 'var(--coral)' : 'var(--border-col)'}`, background: checked ? 'var(--session-intervals-soft)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px', cursor: 'pointer' }}
          >
            {checked && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6L5 9L10 3" stroke="var(--coral)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
          <span
            onClick={() => setChecked(c => !c)}
            style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.55, userSelect: 'none' }}
          >
            I understand this can&apos;t be undone
          </span>
        </label>

        {error && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--coral)', background: 'var(--session-intervals-soft)', borderRadius: '8px', padding: '10px 14px' }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 'auto' }}>
          <button
            onClick={handleDelete}
            disabled={!checked || loading}
            style={{ width: '100%', padding: '15px', background: checked && !loading ? 'var(--session-intervals)' : 'var(--session-intervals-soft)', border: 'none', borderRadius: '12px', color: checked && !loading ? 'var(--bg-primary)' : 'var(--coral)', fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, letterSpacing: '0.02em', cursor: checked && !loading ? 'pointer' : 'default', transition: 'background 0.15s, color 0.15s' }}
          >
            {loading ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface ArchivedPlan {
  id:          string
  race_name:   string | null
  race_date:   string | null
  archived_at: string
  /** The live plan (from `plans`), surfaced at the top so history is never
   *  confusingly empty for a single-plan user — `plan_archive` only holds
   *  SUPERSEDED plans, so the current/just-finished plan would otherwise never
   *  appear. */
  isCurrent?:  boolean
}

function PlanHistoryScreen({ onBack }: { onBack: () => void }) {
  const [status, setStatus]   = useState<'loading' | 'loaded' | 'error'>('loading')
  const [plans, setPlans]     = useState<ArchivedPlan[]>([])

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setStatus('error'); return }
        const [{ data, error }, { data: planRow }] = await Promise.all([
          supabase
            .from('plan_archive')
            .select('id, race_name, race_date, archived_at')
            .eq('user_id', user.id)
            .order('archived_at', { ascending: false }),
          supabase.from('plans').select('plan_json').eq('user_id', user.id).maybeSingle(),
        ])
        if (error) { setStatus('error'); return }
        // Prepend the live plan so the user's current/just-finished plan is visible
        // (plan_archive only holds superseded plans).
        const cur = planRow?.plan_json as any
        const currentEntry: ArchivedPlan | null =
          cur && (cur.weeks?.length ?? 0) > 0
            ? { id: 'current', race_name: cur.meta?.race_name ?? null, race_date: cur.meta?.race_date ?? null, archived_at: '', isCurrent: true }
            : null
        setPlans(currentEntry ? [currentEntry, ...(data ?? [])] : (data ?? []))
        setStatus('loaded')
      } catch {
        setStatus('error')
      }
    }
    void load()
  }, [])

  function formatRaceDate(dateStr: string | null): string {
    if (!dateStr) return ''
    // DATE-OWNER-01 — the try/catch is gone: `formatDate` returns null on an
    // unparseable input rather than throwing. Falling back to the raw string
    // keeps the previous behaviour for a value we cannot parse.
    return formatDate(dateStr, 'medium') ?? dateStr
  }

  function relativeTime(isoStr: string): string {
    const diff = Date.now() - new Date(isoStr).getTime()
    const days = Math.floor(diff / 86400000)
    if (days < 1)   return 'today'
    if (days === 1) return 'yesterday'
    if (days < 30)  return `${days} days ago`
    const months = Math.floor(days / 30)
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
    const years = Math.floor(months / 12)
    return `${years} year${years === 1 ? '' : 's'} ago`
  }

  const backBtn = <FloatingBackButton onClick={onBack} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'var(--bg)' }}>
      {/* BACK-ARROW-FLOAT-04 — same shape, same defect as the benchmark screen: a
          `flexShrink: 0` header beside a body whose `overflowY: auto` can never overflow
          under `minHeight: 100%`, so the arrow scrolled away with the page. */}
      {backBtn}
      <div style={{ padding: 'var(--space-5) 20px 0', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-2)' }}>
          Your training
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '26px', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 'var(--space-5)' }}>
          Plan history
        </div>
      </div>

      <div style={{ flex: 1, padding: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {status === 'loading' && (
          <>
            <style>{`@keyframes ph-shimmer { 0%,100%{opacity:.3} 50%{opacity:.6} }`}</style>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: '62px', borderRadius: 'var(--radius-lg)',
                background: 'var(--card)', border: '1px solid var(--line)',
                animation: `ph-shimmer 1.4s ease-in-out infinite`,
                animationDelay: `${i * 0.1}s`,
              }} />
            ))}
          </>
        )}

        {status === 'error' && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', textAlign: 'center', marginTop: 'var(--space-7)' }}>
            Couldn&apos;t load plan history. Go back and try again.
          </div>
        )}

        {status === 'loaded' && plans.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '200px', gap: 'var(--space-2)' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>
              No prior plans.
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--mute)' }}>
              This is the first one.
            </div>
          </div>
        )}

        {status === 'loaded' && plans.map(p => {
          const raceName  = p.race_name ?? 'Unnamed plan'
          const raceDate  = formatRaceDate(p.race_date)
          let subtitle: string
          if (p.isCurrent) {
            const raceInPast = p.race_date ? new Date(p.race_date).getTime() < Date.now() : false
            subtitle = [raceDate, raceInPast ? 'race done' : 'in progress'].filter(Boolean).join(' · ')
          } else {
            const archived = relativeTime(p.archived_at)
            subtitle = [raceDate, archived ? `replaced ${archived}` : ''].filter(Boolean).join(' · ')
          }
          return (
            <div key={p.id} style={{
              background: 'var(--card)', boxShadow: 'var(--shadow-card)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--line)',
              borderLeft: p.isCurrent ? '3px solid var(--moss)' : '1px solid var(--line)',
              padding: '14px 16px',
            }}>
              {p.isCurrent && (
                <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: 'var(--moss)', marginBottom: '4px' }}>
                  Current
                </div>
              )}
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4, marginBottom: '3px' }}>
                {raceName}
              </div>
              {subtitle && (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.4 }}>
                  {subtitle}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Whether the server has a stored push_subscriptions row for this user on the
// given platform. Used so the toggle reflects real subscription state, not just
// OS permission. Any failure resolves false — never claim "on" unconfirmed.
async function hasServerSubscription(platform: 'ios' | 'web'): Promise<boolean> {
  try {
    const res = await authedFetch(`/api/push/subscribe?platform=${platform}`)
    if (!res.ok) return false
    const json = await res.json()
    return json?.subscribed === true
  } catch {
    return false
  }
}

export default function MeScreen({ openSection, onOpenSectionConsumed, tierReason, healthkitConnectedAt, stravaConnected, plan, initials, athlete, quitDays, smokeTrackerEnabled, quitDate, onSmokeTrackerChange, theme, onThemeChange, preferredUnits, onUnitsChange, preferredMetric, onMetricChange, restingHR, maxHR, maxHrSource, birthYear, onDeviceHRFound, firstName, lastName, profileEmail, onSaveName, onOpenGenerate, onOpenBenchmark, onOpenReshape, onOpenFounderNote, onRecheckEntitlement, onOpenZones, charityGrantEndsAt, onUpgrade, hasPaidAccess, trialDaysLeft, dynamicAdjustmentsEnabled, onDynamicAdjustmentsChange, dailyPushEnabled, onDailyPushEnabledChange, lastAdjustmentCheckAt, lastAdjustmentCheckFoundChange, hasPendingAdjustment, recentChanges }: {
  /** ME-DOORS-01 — open Me AT a door instead of at the index. Consumed once, then cleared
   *  by `onOpenSectionConsumed`, so a later visit to Me lands on the index as usual. */
  openSection?: string | null
  onOpenSectionConsumed?: () => void
  /** TIER-BADGE-01 — the resolved access reason for the identity card's status badge.
   *  ⚠️ NOT `hasPaidAccess`: that collapses five states into three and tells a comped
   *  charity runner they are a subscriber. */
  tierReason?: TierReason | null
  /** ME-ORDER-01 — read for the Connections row's subtitle. ⚠️ These come from
   *  `DashboardClient`, which already held both, NOT from the connection rows: those live
   *  behind the door and do not mount until it is opened, so they cannot tell the index
   *  anything. `undefined` = not loaded yet. */
  healthkitConnectedAt?: string | null | undefined
  stravaConnected?: boolean
  plan: Plan; initials: string; athlete: string; quitDays: number | null; smokeTrackerEnabled: boolean; quitDate: string
  onSmokeTrackerChange: (enabled: boolean, date: string) => void
  theme: 'dark' | 'light' | 'auto'; onThemeChange: (t: 'dark' | 'light' | 'auto') => void
  preferredUnits: 'km' | 'mi'; onUnitsChange: (u: 'km' | 'mi') => void
  preferredMetric: 'distance' | 'duration'; onMetricChange: (m: 'distance' | 'duration') => void
  restingHR: number | null; maxHR: number | null; maxHrSource?: 'observed' | 'user_confirmed' | null; birthYear?: number | null; /* ⚠️ `onHRChange` WAS HERE AND IS GONE (ZONES-HR-SHEET-01). It fed the `Heart rate`
   door's form; with the door removed this screen declared a required prop that nothing
   inside it called. Its owner is now `handleHrSave` on `DashboardClient`, with one
   consumer: the HR sheet on the zones screen. */
  /** §50 (HR-MAX-01) — device-sourced HR from a Settings reconnect. Tags 'observed'
   *  provenance (a floor), distinct from onHRChange's user_confirmed manual save. */
  onDeviceHRFound?: (rhr: number | null, mhr: number | null) => void
  firstName: string; lastName: string; profileEmail: string
  /** PROFILE-IDENTITY-01 — resolves false if the write failed; the card reverts. */
  onSaveName: (name: string) => Promise<boolean>
  onOpenGenerate?: () => void
  onOpenBenchmark?: () => void
  onOpenReshape?: () => void
  onOpenFounderNote?: () => void
  onRecheckEntitlement?: AfterSheet
  /** ZONES-SURFACE-01 — opens the Training Zones screen. */
  /** ZONES-HR-SHEET-01 — `editHr` opens the HR sheet on arrival, for the unset row. */
  onOpenZones?: (returnTo?: string, editHr?: boolean) => void
  /** GTM-CHARITY-04 — ISO end date of a live charity grant, or null. */
  charityGrantEndsAt?: string | null
  onUpgrade?: () => void
  hasPaidAccess?: boolean
  trialDaysLeft?: number | null
  /** ⚠️ REQUIRED, not optional (SWITCH-PRIMITIVE-01). It was `?: boolean` while
   *  the parent has always passed it and the state defaults to TRUE — so an
   *  `undefined` would have rendered the row's copy as "off" against a real
   *  default of on, and `Switch` would have announced the wrong state to a
   *  screen reader. `Switch.checked` being a required prop is what surfaced it:
   *  the board made it required so the compiler stops exactly this. */
  dynamicAdjustmentsEnabled: boolean
  onDynamicAdjustmentsChange?: (enabled: boolean) => void
  dailyPushEnabled?: boolean
  onDailyPushEnabledChange?: (enabled: boolean) => void
  lastAdjustmentCheckAt?: string | null
  lastAdjustmentCheckFoundChange?: boolean | null
  /**
   * True when a `plan_adjustments` row with status='pending' exists for this user.
   * Distinct from `lastAdjustmentCheckFoundChange`, which can stay true after the
   * engine auto-applies a change silently. Drives the tappable "View change" copy.
   */
  hasPendingAdjustment?: boolean
  /**
   * Recent silent (auto_applied) plan adjustments from the last 14 days, newest
   * first. Feeds the "Changed this week" audit surface (RESHAPE-FIX-WAVE3-PHASE2):
   * sub-threshold changes the engine applied without asking (§69), so honest
   * absorption requires a passive place to see them. Rows: { id, week_n, summary,
   * sessions_before, sessions_after, created_at }.
   */
  recentChanges?: any[]
}) {
  const signOut = useSignOut()
  const [activeSection, setActiveSection] = useState<'main' | 'preferences' | 'plan-adjustments' | 'connections' | 'quit' | 'delete-account' | 'support' | 'faq' | 'plan-history'>('main')

  // ⚠️ BEFORE THE EARLY RETURNS. `MeScreen` returns early for every door, so a hook placed
  //   below one is a conditional hook — the React error 310 this repo has already shipped once.
  useEffect(() => {
    if (!openSection) return
    setActiveSection(openSection as 'preferences' | 'plan-adjustments')
    onOpenSectionConsumed?.()
  }, [openSection, onOpenSectionConsumed])

  // Push subscription state — bubbled up from PushNotificationsRow so we can
  // gate the dependent DailyPushToggleRow ("Morning training push" can't fire
  // if push itself is off). Defaults to false until the row checks iOS perm.
  const [pushSubscribed, setPushSubscribed] = useState(false)

  // Plan adjustments — "What we watch for" disclosure
  const [adjustmentsDisclosureOpen, setAdjustmentsDisclosureOpen] = useState(false)

  // RESHAPE-FIX-WAVE3-PHASE2 — per-change dismissal for the "Changed this week"
  // audit surface, persisted client-side (matches the MAINT-01 dismissable-card
  // precedent — informational card, no migration). Keyed by adjustment id.
  const [dismissedChanges, setDismissedChanges] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const raw = window.localStorage.getItem('zonna_dismissed_changes')
      return new Set(raw ? (JSON.parse(raw) as string[]) : [])
    } catch { return new Set() }
  })
  const dismissChange = (id: string) => {
    setDismissedChanges(prev => {
      const next = new Set(prev)
      next.add(id)
      try { window.localStorage.setItem('zonna_dismissed_changes', JSON.stringify(Array.from(next))) } catch {}
      return next
    })
  }
  const visibleChanges = (recentChanges ?? []).filter((c: any) => !dismissedChanges.has(c.id))

  // Relative-time formatter for the "Last checked" row. (The "Recent tweaks"
  // log that also used this was relocated to the notification inbox — NOTIF-01.)
  const formatRelative = (iso: string): string => {
    const ms    = Date.now() - new Date(iso).getTime()
    const days  = Math.floor(ms / 86_400_000)
    const hours = Math.floor(ms / 3_600_000)
    if (hours < 1)   return 'just now'
    if (hours < 24)  return 'today'
    if (days === 1)  return 'yesterday'
    if (days < 7)    return `${days} days ago`
    if (days < 14)   return 'last week'
    return `${Math.floor(days / 7)} weeks ago`
  }

  // "Last checked N days ago" — null when the engine has never run for this user.
  const lastCheckedLabel: string | null = (() => {
    if (!lastAdjustmentCheckAt) return null
    const ms        = Date.now() - new Date(lastAdjustmentCheckAt).getTime()
    const days      = Math.floor(ms / 86_400_000)
    const hours     = Math.floor(ms / 3_600_000)
    if (hours < 1)   return 'just now'
    if (hours < 24)  return 'today'
    if (days === 1)  return 'yesterday'
    if (days < 7)    return `${days} days ago`
    if (days < 14)   return 'last week'
    return `${Math.floor(days / 7)} weeks ago`
  })()

  const raceDistKm = plan?.meta?.race_distance_km ?? 0

  if (activeSection === 'quit')           return <QuitTab    quitDays={quitDays} raceDistanceKm={raceDistKm} onBack={() => setActiveSection('main')} />
  if (activeSection === 'delete-account') return <DeleteAccountScreen onBack={() => setActiveSection('main')} />
  if (activeSection === 'support')        return <SupportScreen onBack={() => setActiveSection('main')} email={profileEmail} hasPaidAccess={hasPaidAccess} trialDaysLeft={trialDaysLeft} />
  // FAQ-01 — a door, exactly as ME-DOORS-01 defines one: the union gains a member and
  // nothing else changes. `onContact` hands off to the contact screen rather than
  // dead-ending, and it returns to the INDEX on back, not to the FAQ, because the
  // runner who reached support through the FAQ has finished with the FAQ.
  if (activeSection === 'faq')            return <FaqScreen onBack={() => setActiveSection('main')} onContact={() => setActiveSection('support')} />
  if (activeSection === 'plan-history')   return <PlanHistoryScreen onBack={() => setActiveSection('main')} />
  // ⚠️ `activeSection === 'heart-rate'` WAS A DOOR HERE (ZONES-HR-SHEET-01). The union
  // member goes with it, so a stale `openSection` value cannot route to a screen that no
  // longer exists. `activeSection` remains the door mechanism for the others.
  // ME-DOORS-01 door 3. Rendered here rather than extracted — see the row on the index.
  if (activeSection === 'plan-adjustments') return (
    <>
      <FloatingBackButton onClick={() => setActiveSection('main')} />
      <ScreenHeader title={PLAN_ADJUSTMENTS_TITLE} sub="What the engine changes, and when" />
      <div style={{ padding: '0 16px', paddingBottom: 'var(--space-7)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
  {/* ── Plan adjustments (paid/trial only) ───────────────────
       One engine, two controls: Auto-adjust runs it on a schedule,
       Check now runs it on demand. The "Last checked" line and the
       "What we watch for" disclosure exist to make this engine
       visible — without them users can't tell what they're paying for. */}
  {hasPaidAccess && onDynamicAdjustmentsChange && (
    <>

      <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--line)', overflow: 'hidden' }}>

        {/* Last checked status — top of the card so the engine's activity is visible at a glance.
         *  Three honest states (PROFILE-ADJ-01):
         *  - pending change waiting for user → moss accent + tappable, routes to ReshapeScreen which shows the existing row
         *  - engine ran, applied a tweak silently (auto-applied) → factual "Plan tweaked" line, not tappable
         *  - engine ran, found nothing → "No changes needed" */}
        {hasPendingAdjustment ? (
          <button
            onClick={onOpenReshape}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderBottom: '1px solid var(--line)',
              background: 'var(--moss-soft)', border: 'none', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, color: 'var(--moss)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>
                1 change pending
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', lineHeight: 1.4 }}>
                Tap to review and accept.
              </div>
            </div>
            <div style={{ color: 'var(--moss)', marginLeft: 'var(--space-3)' }}><Chevron /></div>
          </button>
        ) : (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--bg-soft)' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>
              Last checked
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', lineHeight: 1.4 }}>
              {lastCheckedLabel === null
                ? 'Not yet. Tap Check now to run.'
                : lastAdjustmentCheckFoundChange
                  ? `${lastCheckedLabel.charAt(0).toUpperCase() + lastCheckedLabel.slice(1)} · Plan tweaked`
                  : `${lastCheckedLabel.charAt(0).toUpperCase() + lastCheckedLabel.slice(1)} · No changes needed`}
            </div>
          </div>
        )}

        {/* RESHAPE-FIX-WAVE3-PHASE2 — "Changed this week" audit surface.
            Sub-threshold adjustments auto-apply silently (§69); this is the
            passive, honest place to see what the engine did without asking.
            Read-only + dismissable per row. AdjustmentDiff is rule-engine
            output (no AIMark); the summary is a factual record line, same
            provenance stance as the "Plan tweaked" line above. */}
        {visibleChanges.length > 0 && (
          <div style={{ borderBottom: '1px solid var(--line)' }}>
            <div style={{ padding: '12px 16px 2px', fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Changed this week
            </div>
            {visibleChanges.map((c: any) => (
              <div key={c.id} style={{ padding: '8px 16px 14px' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', lineHeight: 1.45 }}>
                  {c.summary}
                </div>
                <AdjustmentDiff sessionsBefore={c.sessions_before ?? []} sessionsAfter={c.sessions_after ?? []} units={preferredUnits} />
                <Button variant="secondary" size="compact" 
                  onClick={() => dismissChange(c.id)} style={{ marginTop: 'var(--space-3)' }}>
                  Got it
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Auto-adjust toggle. */}
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', borderBottom: '1px solid var(--line)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', fontWeight: 500, lineHeight: 1.4, marginBottom: '2px' }}>Auto-adjust</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5 }}>
              {dynamicAdjustmentsEnabled
                ? `${BRAND.name} checks automatically and suggests changes when something looks off.`
                : `Plan stays fixed. ${BRAND.name} tracks data but won't suggest changes.`}
            </div>
          </div>
          <Switch
            checked={dynamicAdjustmentsEnabled}
            onChange={() => onDynamicAdjustmentsChange(!dynamicAdjustmentsEnabled)}
            ariaLabel="Auto-adjust my plan"
          />
        </div>

        {/* What we watch for — user-facing disclosure of trigger taxonomy.
            SYNC RULE: keep in step with TriggerType in lib/coaching/planAdjustment.ts.
            If you add or remove a trigger type, update this copy in the same commit. */}
        <Button variant="ghost" 
          onClick={() => setAdjustmentsDisclosureOpen(o => !o)} style={{ justifyContent: 'flex-start', width: '100%', padding: '14px 16px', background: 'none', textAlign: 'left' }}
          aria-expanded={adjustmentsDisclosureOpen}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.4 }}>
            What we watch for
          </div>
          <div style={{ color: 'var(--mute)', marginLeft: 'var(--space-3)', transform: adjustmentsDisclosureOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}><Chevron /></div>
        </Button>
        {adjustmentsDisclosureOpen && (
          <div style={{ padding: '0 16px 16px', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.6 }}>
            Recovery signals before hard sessions: resting HR, HRV, sleep. Easy runs drifting above Zone 2. Load spiking against your recent weeks. Aerobic efficiency slipping over time. Long runs consistently finishing short. Missed or rearranged sessions. Quality sessions running faster than target at controlled effort, a signal your fitness may have moved. When something looks off, you&apos;ll get a notification and can review it here.
          </div>
        )}
      </div>
    </>
  )}
      </div>
    </>
  )

  // ME-ORDER-01 door 4 — Connections. ⚠️ The rows are UNCHANGED; only their home moved.
  if (activeSection === 'connections') return (
    <>
      <FloatingBackButton onClick={() => setActiveSection('main')} />
      <ScreenHeader title={CONNECTIONS_TITLE} sub="Where your runs come from" />
      <div style={{ padding: '0 16px', paddingBottom: 'var(--space-7)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <AppleHealthConnectionRow onHRFound={(rhr, mhr) => onDeviceHRFound?.(rhr, mhr)} />
        <StravaConnectionRow />
      </div>
    </>
  )

  if (activeSection === 'preferences') return (
    <>
      <FloatingBackButton onClick={() => setActiveSection('main')} />
      <ScreenHeader title={PREFERENCES_TITLE} sub={PREFERENCES_SUBTITLE} />
      <PreferencesScreen
        preferredUnits={preferredUnits}
        onUnitsChange={onUnitsChange}
        preferredMetric={preferredMetric}
        onMetricChange={onMetricChange}
        notifications={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <PushNotificationsRow onStatusChange={setPushSubscribed} />
            {hasPaidAccess && onDailyPushEnabledChange && (
              <DailyPushToggleRow
                enabled={dailyPushEnabled ?? true}
                onChange={onDailyPushEnabledChange}
                disabled={!pushSubscribed}
              />
            )}
          </div>
        }
      />
    </>
  )

  const hasPlan = !!(plan?.meta?.race_name)

  // Compute Zone 2 ceiling for display — mirrors DashboardClient logic
  const z2Ceiling = (restingHR && maxHR)
    ? Math.round(restingHR + 0.70 * (maxHR - restingHR))
    : plan?.meta?.zone2_ceiling ?? null
  const hrConfigured = !!(restingHR && maxHR)

  // 🔴 THIS WAS THE ORIGINAL LOCAL `const` — the exact variable `ACTION-ROW-01` was
  // written about: *"the chevron was a local `const` inside the Me screen's component.
  // Seven rows there used it; the Plan screen could not reach it."* It was never removed;
  // `ActionRow` was built beside it with a SECOND local copy, and `row()` later shipped a
  // tappable control with no affordance because it could reach neither. Three copies.
  // `CHEVRON-OWNER-01` is the one home; the seven call sites below are unchanged.
  const chevron = <Chevron />

  // Tier label: Trial / Pro / Free
  const tierLabel = hasPaidAccess
    ? ((trialDaysLeft ?? 0) > 0 ? 'Trial' : 'Pro')
    : 'Free'

  // Plan progress for read-only training section
  const currentWeekIndex = getCurrentWeekIndex(plan.weeks)
  const weekNum    = currentWeekIndex + 1
  const totalWeeks = plan.weeks.length
  const raceDateFormatted = plan?.meta?.race_date
    ? formatDate(plan.meta.race_date, 'long')
    : null

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)' }}>

      {/* Header — tab destination, no back button */}
      <ScreenHeader title="Your profile" />

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', paddingBottom: '40px' }}>

        {/* Identity card — who is signed in, and on what.
            Lives in components/shared/IdentityCard.tsx so its missing-name
            state can be seen at /me-preview rather than only reasoned about. */}
        <IdentityCard
          initials={initials}
          firstName={firstName}
          tierLabel={tierLabel}
          tierReason={tierReason}
          onSaveName={onSaveName}
        />

        {/* ⚠️ NO HEADING (ME-ORDER-01). `Account` was a heading over ONE read-only row.
            It announced a category and then declined to contain one (Sierra), so the
            email now sits with the identity card it belongs to. */}
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--line)', padding: '16px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', color: 'var(--ink-2)' }}>Email</span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {profileEmail}
          </span>
        </div>

        {/* ── ME-ATHLETE — "What Kit knows about you" ──────────────────
            Read-only synthesis of the inputs the engine runs on. Surfaces
            staleness honestly — a benchmark four+ weeks old silently softens
            pace targets via VDOT_STALENESS_FRESH_WEEKS; this card names it.
            Configuration becomes identity, not chores. Existing editors
            below remain — this card is the read, not a replacement. */}
        {(() => {
          // Benchmark data + staleness signal. Threshold sourced from the
          // engine config so the user-facing freshness window matches what
          // the VDOT engine actually treats as fresh (D-08, INV-CFG-001).
          const bm = (plan?.meta as any)?.benchmark
          const bmDate = bm?.benchmark_date ? new Date(bm.benchmark_date) : null
          const bmWeeks = bmDate
            ? Math.max(0, Math.floor((Date.now() - bmDate.getTime()) / (7 * 86_400_000)))
            : null
          const bmStale = bmWeeks != null && bmWeeks > GENERATION_CONFIG.VDOT_STALENESS_FRESH_WEEKS

          // Row state badges: --moss for healthy, --warn for stale, --mute for unset.
          type RowState = 'set' | 'stale' | 'unset'
          const row = (label: string, value: string, sub: string | null, state: RowState, onTap?: () => void) => {
            const colour = state === 'stale' ? 'var(--warn)' : state === 'set' ? 'var(--moss)' : 'var(--mute)'
            const inner = (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)' }}>{label}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: colour, flexShrink: 0 }} />
                    {value}
                  </span>
                </div>
                {sub && (
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: state === 'stale' ? 'var(--warn)' : 'var(--mute)', marginTop: '4px', lineHeight: 1.4 }}>
                    {sub}
                  </div>
                )}
              </>
            )
            const baseStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid var(--line)' }
            // 🔴 THE CHEVRON IS THE WHOLE FIX. This returned a `<button>` styled
            // IDENTICALLY to the static `<div>` — tappable and indistinguishable from a
            // read-only row — and five rows shipped that way, `Benchmark` among them.
            // The founder, twice now and in almost the same words: *"it's not clear you
            // can click on it. We have them under Me profile so we should have a standard
            // pattern for these."* `ACTION-ROW-01` IS that pattern; its chevron was a
            // local `const` and could not travel here. `CHEVRON-OWNER-01` freed it.
            return onTap ? (
              <button onClick={onTap} style={{ ...baseStyle, width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>{inner}</div>
                <div style={{ color: 'var(--mute)', display: 'inline-flex' }}><Chevron /></div>
              </button>
            ) : (
              <div style={baseStyle}>{inner}</div>
            )
          }

          return (
            <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--line)', overflow: 'hidden' }}>
              <div style={{ ...MICRO_LABELS.eyebrow, padding: '14px 16px 4px', fontFamily: 'var(--font-ui)', color: 'var(--mute)' }}>
                What Kit knows about you
              </div>

              {/* 🔴 THE ENTRY POINT FOR ZONES-SURFACE-01, AND THE FIRST CUT PUT IT IN THE
                  WRONG PLACE. It went beside the HR inputs — the FIFTH block down, nested
                  under settings — while this row, which already STATES the runner's zones,
                  sits near the top of Me and is where anyone actually looks. The founder
                  looked and reported seeing nothing done.

                  ⚠️ AND IT IS A SURFACE MY OWN BRIEF UNDERCOUNTED. The Design Board was
                  told FOURTEEN surfaces render zone information; this row was folded into
                  a single file-level count and never named, so the consolidation argument
                  was never applied to it. One entry, on the row that already carries the
                  value — same treatment as Benchmark directly beneath. */}
              {row(
                'Zones',
                hrConfigured ? `Z2 ≤ ${z2Ceiling} · Max ${maxHR}` : 'Not set',
                // 🔴 A THIRD STALE "below", found by sweeping for the SHAPE of the fix
                // rather than the symptom. ME-DOORS-01 put the HR form behind the
                // `Heart rate` door; this row still told the runner to set it "below",
                // where there is now nothing. Names the door instead of a direction.
                // 🔴 ZONES-HR-SHEET-01 — THE PREVIOUS SENTENCE NAMED THE WRONG SECTION,
                // AND IT WAS LIVE. It read "Set your heart rate under Setup"; the `Heart
                // rate` door sat under **Your training**. Its own comment above records it
                // as the fix for a stale "below" — so the remedy was applied and the
                // DESTINATION was wrong. This row IS the door now, so the copy names no
                // location at all. Owner: `ZONES_UNSET_SUB`.
                hrConfigured ? null : ZONES_UNSET_SUB,
                hrConfigured ? 'set' : 'unset',
                // 🔴 TAPPABLE IN BOTH STATES, WHICH IT WAS NOT. Unset passed `undefined`,
                // so the one runner who most needed this row got a dead row and a sentence
                // pointing at the wrong heading. Unset opens the HR sheet DIRECTLY rather
                // than landing them on a zones screen with no zones on it (Wroblewski).
                hrConfigured
                  ? () => onOpenZones?.()
                  : () => onOpenZones?.(undefined, true),
              )}

              {row(
                'Benchmark',
                bmDate ? `${bmWeeks}w old` : 'Not set',
                bmStale
                  ? 'Targets may be soft. Re-benchmark when you can.'
                  : bmDate ? null : 'No benchmark: pace targets are estimated.',
                bmDate ? (bmStale ? 'stale' : 'set') : 'unset',
                onOpenBenchmark,
              )}

              {/* Recovery signals — no longer the last row now that injuries
                  sit beneath it. Same display-only treatment as before. */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)' }}>Recovery signals</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--moss)', flexShrink: 0, opacity: 0.4 }} />
                    Apple Health
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', marginTop: '4px', lineHeight: 1.4 }}>
                  Connect below to feed readiness checks.
                </div>
              </div>

              {/* Injury flags — last row, no border below. Empty list reads
                  as "None reported" (moss dot — no flags is the healthy state);
                  any present injuries read as warn (something to watch on hard
                  sessions). Strings are lowercase tags from plan.meta — cap on
                  display so they read as labels, not commands. */}
              {(() => {
                const injuries = (plan?.meta as any)?.injury_history as string[] | undefined
                const hasInjuries = !!injuries?.length
                const displayList = hasInjuries
                  ? injuries.map(i => i.charAt(0).toUpperCase() + i.slice(1)).join(', ')
                  : 'None reported'
                const colour = hasInjuries ? 'var(--warn)' : 'var(--moss)'
                return (
                  <div style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)' }}>Injury flags</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--ink)', textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: colour, flexShrink: 0 }} />
                        {displayList}
                      </span>
                    </div>
                    {hasInjuries && (
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--warn)', marginTop: '4px', lineHeight: 1.4 }}>
                        Engine eases hill and long-run prescriptions.
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )
        })()}

        {/* PROFILE-IDENTITY-01 — what used to be a three-field form card is now one
            read-only row, because the name moved into the identity card above and the
            surname was retired.

            ⚠️ THE EMAIL WAS ALREADY READ-ONLY and this is not a downgrade. It is the
            auth identity, owned by the OAuth provider; nothing in the app writes
            `auth.users.email`, so an editable field would have changed a display string
            and not the login. It is shown for orientation — "which account am I in?" —
            which is a value, not a control, so it is deliberately NOT an `ActionRow`.

            🎪 Collins' deferred question, recorded rather than resolved: this makes
            FOUR section headers on Me. Whether the screen is four sections or two is a
            ruling nobody has taken. */}
        {/* ── Your training ──────────────────────────────────────── */}
        {/* Plan · HR data · display preferences — everything that shapes session cards */}
        <SectionLabel>Your training</SectionLabel>
        {/* 🔴 LEDGER-REACH-01 — THE FREE BRANCH OF A TIER-AWARE FEATURE WAS UNREACHABLE.
            `computeLedger` has explicit FREE criteria (≥75% of planned sessions complete, no
            Heavy/Wrecked, no skipped quality — no HR needed) and its only render site was
            inside the PAID Coach screen, so no free runner could ever see it. Live four
            months, since `353cbbad`. Breaks "gate richness, never access".
            ⚠️ THE COACH CARD STAYS. `353cbbad` moved it there with a stated, sound reason
            (*"an identity / execution metric, not admin chrome"*) that says nothing about
            tier. Removing it would reverse a reasoned design decision under cover of a
            defect fix, and placement belongs to the Design Board (ADR-023).
            ⚠️ NO PROP PASSED: `LedgerCard` falls back to `useDisciplineLedger()` when the
            prop is absent, which is the fallback `353cbbad` built into it. One fetch. */}
        <LedgerCard surface="me" />


        {/* Read-only plan overview */}
        {hasPlan && (
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--line)', overflow: 'hidden' }}>
            {[
              { label: 'Current race', value: plan.meta.race_name },
              { label: 'Race date',    value: raceDateFormatted ?? '—' },
              { label: 'Plan',         value: `W${weekNum} of ${totalWeeks}` },
            ].map(({ label, value }, i, arr) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : undefined }}>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--ink)', textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* 🔴 ZONES-HR-SHEET-01 — THE `Heart rate` DOOR STOOD HERE AND IS GONE.
            Founder: *"I don't like the heat calibration being on its own. It should be from
            within zones."* The form now has ONE mount, inside a sheet on the zones screen,
            reached from the `Zones` row above. Two mounts would be a duplicate owner, which
            is how this codebase's worst defects start.
            ⚖️ This REVERSES `ZONES-INPUTS-01`, ruled one day earlier, and the reversal is in
            `design-rulings.md` rather than made quietly. Three of that ruling's four reasons
            did not survive the code; the fourth, *"a set-once input"*, argues the same way:
            a set-once input should not own a permanent door on a weekly-read screen.
            ⚠️ MEASURED: this leaves `Your training` with 3 items, above `MIN_ITEMS_PER_HEADING`
            (2) — but a FREE runner sees 2, exactly at the floor, because `Plan adjustments`
            is paid-gated. `meOrder.test.ts` holds that line. */}
        {/* Plan + benchmark actions — moved below zones */}
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--line)', overflow: 'hidden' }}>
          <Button variant="ghost" 
            onClick={onOpenGenerate} style={{ justifyContent: 'flex-start', width: '100%', padding: '14px 16px', background: 'none', borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', fontWeight: 500, lineHeight: 1.55 }}>
                {/* PLANVERB-01 — see the Plan screen's row. This one goes to the
                    wizard, which archives the live plan, so it says START. The
                    subtitle names the consequence rather than implying it: the
                    verb change makes the destructive path MORE discoverable,
                    and a row that is easier to find has to be honest about
                    what it does. */}
                {hasPlan ? 'Start a new plan' : 'Generate a plan'}
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', marginTop: '1px' }}>
                {hasPlan ? 'A different race or goal. Replaces the plan you have.' : 'Choose a template or build a custom plan'}
              </div>
            </div>
            <div style={{ color: 'var(--mute)', marginLeft: 'var(--space-3)' }}>{chevron}</div>
          </Button>
          {/* 🔴 ME-BENCHMARK-DUP-01 — THE `Race benchmark` DOOR STOOD HERE AND IS GONE.
              The founder: *"it appears twice in the me screen as Benchmark and Race
              benchmark."* Both rows called the same `onOpenBenchmark`. The one that stays
              is the `Benchmark` status row in "What Kit knows about you", because it
              carries what this one could not: the age of the benchmark and the amber
              staleness warning. That is `ZONES-SURFACE-01`'s ruling one day earlier — the
              zones entry REPLACES the zone rows rather than adding a surface — and the
              note left beside the Zones row already said *"same treatment as Benchmark
              directly beneath"*, so the status row was the canonical entry and this was
              the copy nobody removed.
              ⚠️ WHAT IS LOST, STATED: *"How fast. Pace targets calibrated from a recent
              race."* The status row shows the age when set and *"No benchmark: pace
              targets are estimated"* when not, so the explanatory sentence only carried
              the set-and-fresh case. Not rewritten into the screen's own header, which is
              founder copy. */}
          <button
            onClick={() => setActiveSection('plan-history')}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', fontWeight: 500, lineHeight: 1.55 }}>Plan history</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', marginTop: '1px' }}>
                All the races you&apos;ve trained for.
              </div>
            </div>
            <div style={{ color: 'var(--mute)', marginLeft: 'var(--space-3)' }}>{chevron}</div>
          </button>
        </div>

        {/* ME-DOORS-01 door 3 — Plan adjustments. ⚠️ PAID/TRIAL ONLY, and the gate stays on
            the ROW: a free runner sees no door at all rather than a door onto a locked room.
            ⚠️ The block moves as a call site, it is not extracted to a component — it reads
            seven identifiers from `MeScreen`'s scope (`dynamicAdjustmentsEnabled`,
            `hasPendingAdjustment`, `lastCheckedLabel`, `lastAdjustmentCheckFoundChange`,
            `adjustmentsDisclosureOpen`, `onDynamicAdjustmentsChange`, `onOpenReshape`), and
            threading all seven through a new boundary is a second change wearing the first
            one's clothes. Extraction is filed, not done here. */}
        {hasPaidAccess && onDynamicAdjustmentsChange && (
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--line)', overflow: 'hidden' }}>
            <ActionRow
              title={PLAN_ADJUSTMENTS_TITLE}
              subtitle={hasPendingAdjustment ? PLAN_ADJUSTMENTS_PENDING_SUB : lastCheckedLabel ?? PLAN_ADJUSTMENTS_SUB}
              onClick={() => setActiveSection('plan-adjustments')}
            />
          </div>
        )}


        {/* ── Setup ─────────────────────────────────────
            🔴 I ARGUED FOR NO HEADING HERE AND THE RENDER PROVED ME WRONG. The board ruled
            seven labels → five; I said four, on the reasoning that a heading governing one
            row is not a heading and these are two single doors. But an UNLABELLED card
            placed after a heading **inherits that heading** — `Preferences` and
            `Connections` came out reading as part of `Your training`, which is the exact
            defect this change was fixing one section up. The only unlabelled position that
            reads as its own group is the top, before any heading, which the identity card
            already occupies.
            ⚠️ The rule survives intact, because the CARD holds TWO doors: a heading over
            two items is a heading. What fails is my count, not the principle. */}
        <SectionLabel>Setup</SectionLabel>
        {/* ME-ORDER-01 — TWO DOORS, ONE CARD.
            🔴 "A heading that governs one row is not a heading" (Collins): it is a category
            pretending to be content. `Preferences` and `Connections` are single doors, so
            they share an unlabelled card rather than taking a `SectionLabel` each. The
            identity card above already establishes unlabelled cards on this screen.
            ⚠️ `divider` is `ActionRow`'s own documented prop — *"when stacking rows inside
            one card (Me)"* — and had NEVER been used in the app. Same shape as `ActionRow`
            itself being created for Me and going unused. */}
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--line)', overflow: 'hidden' }}>
          <ActionRow
            title={PREFERENCES_TITLE}
            subtitle={PREFERENCES_SUBTITLE}
            onClick={() => setActiveSection('preferences')}
            divider
          />
          {/* ⚠️ THE SUBTITLE CARRIES LIVE STATE, which is how Silvanto's objection is
              answered without granting Connections an exception: a door hides a status the
              runner wants at a glance, so the status rides the row. It returns NULL while
              the profile is still loading rather than asserting a negative it cannot know. */}
          <ActionRow
            title={CONNECTIONS_TITLE}
            subtitle={connectionsSubtitle(healthkitConnectedAt, !!stravaConnected)}
            onClick={() => setActiveSection('connections')}
          />
        </div>

        {/* ── P-12: THE PLAN CARD (was a single "View plans" row) ─────────
            UPGRADE-ENTRY-01's §3.1.2 requirement is unchanged and still met:
            any non-Pro user can reach the paywall from Me at any time. What
            changed is that the row became a value statement.

            The teardown's one genuinely copyable idea: state what the runner
            ALREADY HAS before listing what they do not. Ours was a link.

            ⚠️ Rendered for subscribers too, without an upsell — a paid runner
            seeing what their subscription covers is the honest half of the
            same card, and hiding it would make the section appear only when
            we want something. */}
        {/* 🔴 A6 — THIS SECTION WAS CALLED "Plan" AND CONTAINS THE
             SUBSCRIPTION CARD, in a product whose entire vocabulary uses "plan"
             to mean the TRAINING plan — it is the noun on the nav bar, the
             wizard, the arc and the marketing site. Collins' taxonomy test: a
             word the product uses for two different things is not a word.
             Renamed; the card is untouched, and the SLT's kill on a settings
             screen that merchandises stands. */}
        <SectionLabel>Subscription</SectionLabel>
        {onUpgrade
          ? <MePlanCard
              hasPaidAccess={!!hasPaidAccess}
              trialDaysLeft={trialDaysLeft ?? null}
              onUpgrade={onUpgrade}
            />
          : null}

        {/* ── Charity access — GTM-CHARITY-04 ──────────────────────
            The comped runner's own status. Exists because a silent expiry
            turns a gift into a complaint (Traynor), and because without it
            the ONLY place the end date appeared was the redemption screen
            they saw once, weeks ago.

            NOTE: no charity name here, deliberately. The SLT ruled we never
            reflect the runner's charity back at them: the fundraising page and
            the people watching are the extrinsic pressure that makes this
            cohort overtrain. */}
        {charityGrantEndsAt && (
          <>
            <div style={{
              background: 'var(--card)', borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-card)', border: '1px solid var(--line)',
              padding: '14px 16px', marginBottom: 'var(--space-5)',
            }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.4, marginBottom: '3px' }}>
                Full access, free
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5 }}>
                Runs to {formatDate(charityGrantEndsAt, 'long')}. Set your race date and it extends to a week after race day.
              </div>
            </div>
          </>
        )}

        {/* GTM-CHARITY-04 — the day-one door. A runner whose charity gave them
            a code can redeem it immediately instead of waiting to be stopped by
            the gate a fortnight later. Quiet register: most users have no code
            and this must not read like a discount prompt. */}
        {/* ⚠️ MOVED OUT OF "Careful Now" (ME-ORDER-01). Redeeming a gift is not a
            destructive action, and a runner whose charity gave them a code had to look
            for it under a heading that means *this will hurt* (Sierra). It sits with
            Subscription, beside the access it grants.
            CHARITY-CODE-CONTROL-01 — KEPT at the founder's request. ⚠️ Wood's own
            ruling calls Me "the lowest-frequency surface in the product", and the single
            lifetime in-app redemption happened here. It stays because it is the only
            placement a runner can return to on purpose once onboarding is behind them. */}
        {onRecheckEntitlement && (
          <RedeemCodeLink onAfterSheet={onRecheckEntitlement}
            style={{ alignSelf: 'center', marginTop: 'var(--space-4)' }} />
        )}

        {/* ── Support — questions first, then contact (FREE; SUPPORT-01 + FAQ-01) ──
            ⚠️ THE CONTACT ROW WAS HAND-ROLLED and is now `ActionRow`, because adding a
            second row beside it would otherwise have shipped two rows doing the same job
            looking different. That is `ACTION-ROW-01`'s own recorded failure ("the remedy
            was applied to one twin"), and the twin was right here.
            🔴 Its subtitle also carried an EM DASH in a sentence the runner reads. The
            app guard could not see it: `noEmDashApp.test.ts` scans STRING LITERALS and
            this was JSX text. Filed as `NOEMDASH-JSX-TEXT-01` (56 candidates); fixed here
            only because this row was being rewritten anyway. */}
        <SectionLabel>Support</SectionLabel>
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--line)', overflow: 'hidden' }}>
          {/* FAQ first: a runner with a question should meet the answer before the
              contact form. Sierra's condition at the FAQ-01 sitting was that the list
              stays a defect log — see `shouldBeObviousOn` in `lib/faq.ts`. */}
          <ActionRow
            title={FAQ_TITLE}
            subtitle={FAQ_SUBTITLE}
            onClick={() => setActiveSection('faq')}
            divider
          />
          <ActionRow
            title="Something broken? Tell us."
            subtitle="Email support, and a real person reads it."
            onClick={() => setActiveSection('support')}
          />
          {/* ── P-14(a): THE PASSIVE REVIEW ROW ──────────────────────────
              We had NEITHER half of this: no passive row, no native prompt, no
              plugin — `requestReview` / `SKStoreReview` returned zero hits
              across the whole codebase. This is the half that needs no plugin,
              no flag and no migration.

              ⚠️ ONE ROW, NO FRAMING, NO CLAIM. The moment it acquires a reason
              ("help other runners find us") it becomes marketing copy on a
              support screen and needs a brand decision. It asks; it does not
              persuade.

              ⚠️ (b), the native SKStoreReviewController prompt after a defined
              win, is NOT here. Apple rate-limits to three a year, so firing it
              on anything less than a real win wastes a scarce resource — and
              "a defined win" has to be written down before it is coded, which
              is P-14's own acceptance criterion. Deliberately left rather than
              guessed.

              ⚠️ ExternalLink, not <a>: inside the Capacitor webview a bare
              href REPLACES the app and the runner has no way back
              (`externalLink.test.ts`). */}
          {/* Gated on the store URL existing: BRAND.appStore declares that
              `url` is blank until the app is approved, and a review link to a
              page that does not exist is worse than no link. */}
          {BRAND.appStore.url && <>
          <div style={{ height: '1px', background: 'var(--line)' }} />
          <ExternalLink
            href={BRAND.appStore.reviewUrl}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', textDecoration: 'none' }}
          >
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', fontWeight: 500, lineHeight: 1.4 }}>
              Leave a review
            </div>
            <div style={{ color: 'var(--mute)', marginLeft: 'var(--space-3)' }}>{chevron}</div>
          </ExternalLink>
          </>}
        </div>

        {/* ── Careful Now — destructive account actions ───────── */}
        <SectionLabel>Careful Now</SectionLabel>
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--line)', overflow: 'hidden' }}>
          <Button variant="ghost" 
            onClick={signOut} style={{ justifyContent: 'flex-start', width: '100%', padding: '14px 16px', background: 'none', borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)', fontWeight: 500 }}>Sign out</span>
          </Button>
          <button
            onClick={() => setActiveSection('delete-account')}
            style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--danger)', fontWeight: 500 }}>Delete account</span>
          </button>
        </div>

        {/* FOUNDER-01 — quiet footer link. Moved here from "Your profile"
            (where it competed with profile editing). Same register as
            About / Privacy / Terms — discoverable, doesn't compete. */}
        {onOpenFounderNote && (
          <Button variant="ghost" size="compact" 
            onClick={onOpenFounderNote} style={{ alignSelf: 'center', marginTop: 'var(--space-4)' }}>
            A note from the founder →
          </Button>
        )}

      </div>
    </div>
  )
}
