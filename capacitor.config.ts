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
  server: {
    url: 'https://rts-training-hub.vercel.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
  },
}

export default config
