import type { CapacitorConfig } from '@capacitor/cli'

// Capacitor hybrid shell. The native app loads the Next.js codebase from
// Vercel via server.url so API routes, SSR, and dynamic OG keep working.
// Native plugins (StoreKit 2, Sign in with Apple, push notifications via APNs,
// status bar, deep links) are layered on top of the same web build.
//
// webDir is required by Capacitor but is not what the app serves at runtime —
// `public` is fine. server.url overrides it.
//
// Update server.url when migrating to the custom domain (vetra.app).
//
// Local development: temporarily change server.url to your dev machine, e.g.
//   url: 'http://192.168.x.x:3000', cleartext: true
// Then run `npm run dev` and `npx cap run ios`.

const config: CapacitorConfig = {
  appId: 'app.vetra.ios',
  appName: 'Vetra',
  webDir: 'public',
  // Warm Slate (--bg) — keeps the gap between the splash dismissing and the
  // remote page rendering on-brand instead of showing the default black.
  backgroundColor: '#F3F0EB',
  server: {
    // Open directly at /dashboard so we skip the '/' -> '/dashboard'
    // server-side redirect, which forces a second webview load (and a
    // black flash between the two). Auth-gated routing inside the
    // dashboard happens client-side via Supabase, no full reload needed.
    url: 'https://rts-training-hub.vercel.app/dashboard',
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
    contentInset: 'automatic',
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
  },
}

export default config
