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
 * Navigation is a HARD load, not `router.replace`. Sign-in already does this
 * (`app/auth/login/page.tsx:188` — "router.push (soft nav) can race the cookie
 * write"), and the same applies leaving: a hard load also tears down every
 * in-memory copy of the previous user's plan, name and sessions rather than
 * trusting React to unmount them.
 */
export async function signOutAndReturnToLogin(): Promise<void> {
  try {
    await clearWidgetState()
    const { error } = await createClient().auth.signOut()
    if (error) forgetLocalSession(error)
  } finally {
    window.location.href = '/auth/login'
  }
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
