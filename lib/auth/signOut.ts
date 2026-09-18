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
    await createClient().auth.signOut()
  } finally {
    window.location.href = '/auth/login'
  }
}
