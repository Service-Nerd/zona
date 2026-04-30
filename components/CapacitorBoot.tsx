'use client'

// Native-shell boot helper. The Capacitor splash auto-hides after a generous
// fallback timeout (configured in capacitor.config.ts), but on cold-starts
// the WebKit subsystem can take several seconds to launch — so we let the
// web app dismiss the splash itself the moment React mounts. Whoever fires
// first wins; the timeout is just a safety net for boot failures.
//
// On the web (browser / PWA), Capacitor.isNativePlatform() returns false and
// SplashScreen.hide() is a no-op. Safe to mount unconditionally.

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'

export default function CapacitorBoot() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    SplashScreen.hide().catch(() => {})
  }, [])
  return null
}
