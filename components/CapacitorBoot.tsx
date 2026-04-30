'use client'

// Native-shell boot helper. Three jobs:
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
//    (Browser.open) and returns via app.vetra.ios://auth-callback?code=XXX.
//    iOS routes the URL into the app via App.appUrlOpen — we exchange the
//    code for a Supabase session, dismiss the SafariViewController, and
//    navigate to the dashboard.
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

const NATIVE_AUTH_CALLBACK_PREFIX = 'app.vetra.ios://auth-callback'

export default function CapacitorBoot() {
  const router = useRouter()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    StatusBar.setStyle({ style: Style.Light }).catch(() => {})
    StatusBar.setBackgroundColor({ color: '#F3F0EB' }).catch(() => {})
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})
    SplashScreen.hide().catch(() => {})

    let removeListener: (() => void) | undefined

    CapApp.addListener('appUrlOpen', async ({ url }) => {
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
      removeListener = () => handle.remove()
    }).catch(() => {})

    return () => { removeListener?.() }
  }, [router])

  return null
}
