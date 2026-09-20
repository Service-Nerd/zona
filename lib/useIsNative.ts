'use client'

import { useEffect, useState } from 'react'

/**
 * Is this running inside the Capacitor iOS shell?
 *
 * ⚠️ SINGLE OWNER OF THE RENDERING FLAG — and precisely that, not of every
 * platform check in the codebase. Two components in `DashboardClient` each
 * carried their own `useState(false)` + dynamic-import effect purely to decide
 * what to render, and P-10 needed a third; those collapse into this. The
 * failure mode is specific: a screen that resolves platform slightly
 * differently shows a runner a CTA for something their platform cannot do.
 *
 * ⚠️ ONE SITE DELIBERATELY DOES NOT USE THIS, and the distinction is the point.
 * `AppleHealthConnectionRow` uses `Capacitor.isNativePlatform()` as an EARLY
 * EXIT inside a Supabase-reading effect — it is a platform-gated data fetch
 * that happens to expose a flag, not a flag. Routing it through this hook
 * would make the effect run on web and bail, changing behaviour to satisfy a
 * tidiness claim. "Single owner of the flag" is not "single owner of the
 * sequence", and this repo has already recorded the cost of blurring the two.
 *
 * ⚠️ IT STARTS `false` AND THAT IS DELIBERATE. `Capacitor.isNativePlatform()`
 * is only available after a dynamic import, so there is one render where
 * native looks like web. Copy driven by this must therefore be safe when
 * wrong-for-one-frame: say the web thing first and correct to native, never
 * the reverse, or an iOS runner sees a flash of "this needs the app you are
 * already in".
 */
export function useIsNative(): boolean {
  const [isNative, setIsNative] = useState(false)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!cancelled && Capacitor.isNativePlatform()) setIsNative(true)
      } catch {
        // Not running inside Capacitor. Web is the correct answer.
      }
    })()
    return () => { cancelled = true }
  }, [])
  return isNative
}
