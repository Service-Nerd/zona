'use client'

// ONBOARD-EXIT-01 — the single owner of the client-side sign-out SEQUENCE.
//
// Not the single owner of the sign-out BUTTON: the Me screen's lives inside
// the "Careful Now" card and the onboarding one is a quiet text link
// (`components/shared/SignOutLink.tsx`). Two presentations, deliberately.
// What must not fork is what actually happens when either is pressed, and it
// already had: `ConnectRunsScreen`'s hand-rolled copy omitted
// `clearWidgetState()`, so signing out there left the previous account's race
// countdown on the home-screen widget. D-16 again — the tier ladder had three
// copies of its order, the deload cadence five.
//
// Guarded by `signOutOwner.test.ts`, which walks `app/` and `components/` and
// fails the build on any `auth.signOut()` outside this module.

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { clearWidgetState } from '@/lib/native/sharedStore'

/**
 * End the session and return to the login screen.
 *
 * Order matters. The App-Group store is cleared BEFORE the session goes: the
 * iOS widget reads race countdown and today's session from it, and a stale
 * write outlives the account that made it. `clearWidgetState` swallows its own
 * errors and no-ops on web, so it cannot block the sign-out.
 *
 * 🔴 NAVIGATION MUST BE A CLIENT-SIDE ROUTE CHANGE, NOT `window.location`.
 * On iOS this is the difference between staying in the app and being thrown
 * out into Safari. Capacitor's `WebViewDelegationHandler.decidePolicyFor`:
 *
 *     if let host = navURL.host, bridge.config.shouldAllowNavigation(to: host) { .allow }
 *     let isApplicationNavigation =
 *         navURL.absoluteString.starts(with: bridge.config.serverURL.absoluteString) || ...
 *     if !isApplicationNavigation, toplevelNavigation { UIApplication.shared.open(navURL); .cancel }
 *
 * `shouldAllowNavigation` consults ONLY the `allowNavigation` hostname list —
 * the server's own host is NOT implicitly allowed. So the only thing keeping a
 * full-document load inside the webview is a PREFIX match on the whole
 * absolute string, and our `server.url` carries a path:
 * `https://www.zonna.run/dashboard`. `https://www.zonna.run/auth/login` does
 * not start with it, so iOS opened the login page in Safari and the user was
 * left signed in, in a browser, outside the app.
 *
 * A history navigation never reaches `decidePolicyFor`, so `router.replace`
 * simply cannot escape. `window.location` is therefore banned here, and
 * `signOutNavigation.test.ts` fails the build if it comes back.
 *
 * (`capacitor.config.ts` also now lists `www.zonna.run` under
 * `allowNavigation`, which makes the first check pass and closes this for ANY
 * future full navigation — but that only takes effect on the next native
 * build, whereas this file ships over the air to phones already installed.)
 */
export async function signOutAndReturnToLogin(navigate: () => void): Promise<void> {
  try {
    await clearWidgetState()
    const { error } = await createClient().auth.signOut()
    if (error) forgetLocalSession(error)
  } finally {
    navigate()
  }
}

/**
 * The one way a screen should sign a runner out. Owns the sequence AND the
 * navigation, so no call site has to remember the iOS rule above.
 */
export function useSignOut(): () => Promise<void> {
  const router = useRouter()
  return useCallback(() => signOutAndReturnToLogin(() => router.replace('/auth/login')), [router])
}

/**
 * Make sure the session is gone from THIS device even when the revoke failed.
 *
 * ⚠️ READ `_signOut` IN `@supabase/auth-js` BEFORE CHANGING THIS. It revokes
 * the token first and, on any error that is not 401/403/404/session-missing —
 * a flat network failure being the obvious one on a phone mid-onboarding —
 * it `return`s **before** `_removeSession()`. The promise RESOLVES, carrying
 * `{ error }`. So the default behaviour of a failed sign-out is: the user is
 * told nothing, lands on the login screen, and is still signed in, because the
 * `sb-<ref>-auth-token` cookie was never touched. That is the founder's exact
 * demo — sign out of the test account, hand the phone over — failing silently
 * in the direction that matters.
 *
 * Cookies, not localStorage: `createBrowserClient` (@supabase/ssr) stores the
 * session in `document.cookie` so the server can read it. Both are cleared
 * anyway — a plain browser client uses localStorage, and being wrong about
 * which one is in play is how this class of bug survives.
 *
 * What this does NOT fix: the access token stays valid on Supabase's side
 * until it expires. That is unreachable from a device with no network, and it
 * is the same exposure as force-quitting the app. What must not happen — and
 * no longer does — is the user believing they signed out while the credential
 * is still on the device.
 */
function forgetLocalSession(cause: unknown): void {
  const isAuthKey = (k: string) => k.startsWith('sb-') && k.includes('-auth-token')
  try {
    for (const raw of document.cookie.split(';')) {
      const name = raw.trim().split('=')[0]
      if (name && isAuthKey(name)) {
        document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`
      }
    }
  } catch { /* no document (SSR/test) — the localStorage sweep still runs */ }
  try {
    for (const k of Object.keys(localStorage)) {
      if (isAuthKey(k) || k === 'supabase.auth.token') localStorage.removeItem(k)
    }
  } catch { /* storage blocked (private mode) */ }
  // Not swallowed silently: the navigation still happens, but the reason is
  // left where a bug report can find it. There is no network to report it on.
  console.warn('[signOut] revoke failed; cleared the local session anyway:', cause)
}
