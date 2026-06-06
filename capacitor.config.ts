import type { CapacitorConfig } from '@capacitor/cli'

// Capacitor hybrid shell. The native app loads the Next.js codebase from
// Vercel via server.url so API routes, SSR, and dynamic OG keep working.
// Native plugins (StoreKit 2, Sign in with Apple, push notifications via APNs,
// status bar, deep links) are layered on top of the same web build.
//
// webDir is required by Capacitor but is not what the app serves at runtime —
// `public` is fine. server.url overrides it.
//
// server.url migrated to zonna.run (2026-05-15). Custom domain live.
//
// Local development: temporarily change server.url to your dev machine, e.g.
//   url: 'http://192.168.x.x:3000', cleartext: true
// Then run `npm run dev` and `npx cap run ios`.

const config: CapacitorConfig = {
  // appId must equal NATIVE_BUNDLE_ID in lib/native.ts. Build-tooling cannot
  // import TS so the literal lives here; keep in sync on any rename.
  // appName mirrors BRAND.name from lib/brand.ts for the same reason.
  appId: 'app.zonna.ios',
  appName: 'Zonna',
  webDir: 'public',
  // Warm Slate (--bg) — keeps the gap between the splash dismissing and the
  // remote page rendering on-brand instead of showing the default black.
  backgroundColor: '#F3F0EB',
  server: {
    // Open directly at /dashboard so we skip the '/' -> '/dashboard'
    // server-side redirect, which forces a second webview load (and a
    // black flash between the two). Auth-gated routing inside the
    // dashboard happens client-side via Supabase, no full reload needed.
    url: 'https://www.zonna.run/dashboard',
    cleartext: false,
    // Hosts the webview is allowed to navigate to. Without these,
    // Capacitor opens any non-server-host navigation in Safari — which
    // breaks Supabase OAuth (Google) and Strava OAuth, since the user
    // ends up authenticated in Safari instead of returning to the app.
    allowNavigation: [
      'accounts.google.com',
      '*.googleapis.com',
      '*.googleusercontent.com',
      '*.supabase.co',
      'www.strava.com',
    ],
  },
  ios: {
    // 'never' = edge-to-edge webview; CSS env(safe-area-inset-*) handles
    // the inset. 'automatic' double-applies the bottom inset (webview is
    // shrunk by the home-indicator area AND CSS adds the same padding
    // again), leaving the bottom nav floating above empty space.
    contentInset: 'never',
    backgroundColor: '#F3F0EB',
  },
  plugins: {
    SplashScreen: {
      // Splash holds until the web app calls SplashScreen.hide() on mount
      // (see components/CapacitorBoot.tsx). The 10s timeout is just a
      // safety net for cold starts on slow networks or boot failures.
      launchShowDuration: 10000,
      launchAutoHide: true,
      launchFadeOutDuration: 200,
      backgroundColor: '#F3F0EB',
      showSpinner: false,
    },
    PushNotifications: {
      // Show push banners even when the app is in the foreground.
      // Without this, iOS suppresses banners by default — which means the
      // run-linked push sent after HealthKit auto-match is invisible
      // (the user opened the app to trigger the sync, so the app is always
      // in the foreground at match time). Strava doesn't have this problem
      // because its webhook fires while the app is closed/backgrounded.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
