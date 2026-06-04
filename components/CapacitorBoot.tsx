'use client'

// Native-shell boot helper. Four jobs:
//
// 1. Hide the splash. The Capacitor splash auto-hides after a generous
//    fallback timeout (capacitor.config.ts), but on cold-starts WebKit can
//    take several seconds to launch — so we dismiss it the moment React
//    mounts. The timeout is a safety net for boot failures.
//
// 2. Configure the status bar. Warm-slate background, dark text, webview
//    sits below the status bar (not overlaid).
//
// 3. Handle the OAuth deep link. Google OAuth opens in SafariViewController
//    (Browser.open) and returns via NATIVE_AUTH_CALLBACK?code=XXX.
//    iOS routes the URL into the app via App.appUrlOpen — we exchange the
//    code for a Supabase session, dismiss the SafariViewController, and
//    navigate to the dashboard.
//
// 4. Handle push-notification taps (POST-RUN-01). When user taps a push from
//    APNs, @capacitor/push-notifications fires pushNotificationActionPerformed
//    with the payload's data.url — we route to that path. Same shape as web
//    push (data.url = /dashboard?screen=post-run&weekN=14&sessionDay=tue).
//    Gated on APNs going live; harmless until then.
//
// On the web (browser / PWA), Capacitor.isNativePlatform() is false and
// every plugin call below is a no-op. Safe to mount unconditionally.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { createClient } from '@/lib/supabase/client'
import { BRAND } from '@/lib/brand'
import {
  NATIVE_AUTH_CALLBACK   as NATIVE_AUTH_CALLBACK_PREFIX,
  NATIVE_STRAVA_CALLBACK as NATIVE_STRAVA_CALLBACK_PREFIX,
} from '@/lib/native'

export default function CapacitorBoot() {
  const router = useRouter()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    StatusBar.setStyle({ style: Style.Light }).catch(() => {})
    StatusBar.setBackgroundColor({ color: BRAND.og.bg }).catch(() => {})
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})
    SplashScreen.hide().catch(() => {})

    // Foreground HealthKit sync. Pulls new runs + recovery samples since last
    // sync and posts them to the backend. Silent failure — readiness signal
    // and ingest are paid features that degrade gracefully when HealthKit
    // isn't authorized or the plugin isn't installed yet (Phase G).
    void (async () => {
      try {
        const { syncOnAppOpen } = await import('@/lib/health/clientSync')
        await syncOnAppOpen()
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[capacitor-boot] HealthKit sync skipped', err instanceof Error ? err.message : err)
      }
    })()

    let removeUrlListener: (() => void) | undefined
    let removePushListener: (() => void) | undefined

    CapApp.addListener('appUrlOpen', async ({ url }) => {
      // Strava OAuth return — `/api/strava/callback` already wrote tokens to
      // user_settings; we just close the in-app browser and bounce to the
      // dashboard with the status query param so existing UI handlers fire
      // (MeScreen → StravaConnectionRow useEffect reads `?strava=connected`).
      if (url.startsWith(NATIVE_STRAVA_CALLBACK_PREFIX)) {
        Browser.close().catch(() => {})
        const parsed = new URL(url)
        const strava = parsed.searchParams.get('strava') ?? 'error'
        router.replace(`/dashboard?strava=${strava}`)
        return
      }

      if (!url.startsWith(NATIVE_AUTH_CALLBACK_PREFIX)) return
      // SFSafariViewController stays open until we close it; do it before
      // the route transition so the user doesn't see the OAuth page flash.
      Browser.close().catch(() => {})

      const parsed = new URL(url)
      const code = parsed.searchParams.get('code')
      if (!code) {
        router.replace('/auth/login')
        return
      }
      const supabase = createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        router.replace('/auth/login')
        return
      }
      router.replace('/dashboard')
    }).then((handle) => {
      removeUrlListener = () => handle.remove()
    }).catch(() => {})

    // RevenueCat — configure StoreKit 2 purchases with the Supabase user ID as
    // the app user ID. This ensures the webhook's app_user_id maps directly to
    // the subscriptions table user_id. Dynamic import keeps the web bundle clean.
    //
    // We publish the configure promise on window.__rcReady so UpgradeScreen
    // can await it before calling getOfferings — without this, a user who
    // signs up + onboards quickly can hit Subscribe before configure resolves,
    // and getOfferings rejects with "Purchases not configured".
    ;(window as any).__rcReady = (async () => {
      try {
        const { Purchases } = await import('@revenuecat/purchases-capacitor')
        const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_API_KEY
        if (!apiKey) return

        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        await Purchases.configure({ apiKey, appUserID: user?.id ?? null })

        // If app boots on the login screen, update RC identity once auth resolves
        supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN' && session?.user) {
            await Purchases.logIn({ appUserID: session.user.id }).catch(() => {})
          } else if (event === 'SIGNED_OUT') {
            await Purchases.logOut().catch(() => {})
          }
        })
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[capacitor-boot] RevenueCat init skipped', err instanceof Error ? err.message : err)
      }
    })()

    // POST-RUN-01: route push-notification taps to the URL in their payload.
    // Wrapped in a dynamic import so web bundles don't pay for it.
    void (async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')
        const handle = await PushNotifications.addListener('pushNotificationActionPerformed', (event: any) => {
          const url = event?.notification?.data?.url
          if (typeof url === 'string' && url.startsWith('/')) {
            router.replace(url)
          }
        })
        removePushListener = () => handle.remove()
      } catch {
        // Plugin not installed or platform not supported — silent.
      }
    })()

    return () => { removeUrlListener?.(); removePushListener?.() }
  }, [router])

  return null
}
