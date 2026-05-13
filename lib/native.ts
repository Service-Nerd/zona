/**
 * Native iOS bundle identifier and derived deep-link constants.
 *
 * Single source of truth for `app.zonna.ios` across the TypeScript codebase.
 * Used by:
 *  - Supabase OAuth redirect construction (app/auth/login/page.tsx)
 *  - Strava OAuth callback construction (app/api/strava/callback/route.ts)
 *  - Capacitor deep-link prefix matching (components/CapacitorBoot.tsx)
 *  - APNs topic documentation (lib/apnpush.ts comment)
 *
 * Duplicated in build-tooling files that TypeScript cannot import from:
 *  - capacitor.config.ts → appId
 *  - ios/App/App/Info.plist → CFBundleIdentifier + URL scheme registration
 *  - Vercel env var APNS_TOPIC
 * Keep all four in sync when this changes.
 *
 * A future bundle-ID rename only needs to touch:
 *   1. NATIVE_BUNDLE_ID below
 *   2. capacitor.config.ts appId
 *   3. ios/App/App/Info.plist (multiple strings)
 *   4. Apple Developer portal + Supabase auth allowlist + APNS_TOPIC env var
 */

export const NATIVE_BUNDLE_ID = 'app.zonna.ios'

/** Full deep-link URL for the Supabase / Google OAuth callback. */
export const NATIVE_AUTH_CALLBACK = `${NATIVE_BUNDLE_ID}://auth-callback`

/** Full deep-link URL for the Strava OAuth callback. */
export const NATIVE_STRAVA_CALLBACK = `${NATIVE_BUNDLE_ID}://strava-callback`
