'use client'

// Native-shell boot helper. Two jobs:
//
// 1. Hide the splash. The Capacitor splash auto-hides after a generous
//    fallback timeout (capacitor.config.ts), but on cold-starts WebKit can
//    take several seconds to launch — so we dismiss it the moment React
//    mounts. The timeout is a safety net for boot failures.
//
// 2. Configure the status bar. Warm-slate background, dark text (Style.Default
//    in iOS terms), and tell iOS we don't want the webview overlaid under it.
//
// On the web (browser / PWA), Capacitor.isNativePlatform() returns false and
// every plugin call below is a no-op. Safe to mount unconditionally.

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'

export default function CapacitorBoot() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    StatusBar.setStyle({ style: Style.Light }).catch(() => {})
    StatusBar.setBackgroundColor({ color: '#F3F0EB' }).catch(() => {})
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})
    SplashScreen.hide().catch(() => {})
  }, [])
  return null
}
