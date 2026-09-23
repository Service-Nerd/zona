'use client'

// ONBOARD-EXIT-01 — the single owner of "sign out from a screen that has no
// other way out".
//
// WHY THIS EXISTS. The onboarding gate sequence (wizard → Orientation →
// Connect Runs → Push permission) renders IN FRONT of the Me screen, where
// sign-out lives, and the bottom nav is hidden throughout. An authenticated
// user with the wrong account — a typo'd email, the wrong Google identity, a
// shared device, or the founder demoing — was trapped: the only escape was
// backing out of the wizard to an empty Today, then Me, then the "Careful Now"
// section that also holds Delete Account. Four taps, and the last one sits next
// to the most destructive control in the app.
//
// ⚠️ WHY A COMPONENT AND NOT A COPIED BLOCK. `ConnectRunsScreen` already had
// this button, hand-rolled, and it had ALREADY DRIFTED from the Me-screen
// sign-out: it never called `clearWidgetState()`. A user at that screen HAS a
// plan, so signing out there left the previous account's race countdown on the
// home-screen widget for whoever signed in next. Two copies, one of them wrong,
// which is the D-16 class this repo keeps paying for (the tier ladder had
// three copies, the deload cadence five). One owner now — and the SEQUENCE
// itself is owned one level down, in `lib/auth/signOut.ts`, because the Me
// screen's button is presented differently and must still behave identically.
//
// ⚠️ NOT the "Careful Now" treatment. `ui-patterns.md` § SectionLabel groups
// sign-out with account deletion, which is right on Me — a considered action
// among your settings — and wrong here. A destructive-group heading on a screen
// whose job is to welcome someone builds an ejector seat. This is a quiet text
// link, secondary to whatever the screen's real secondary action is.

import { useState } from 'react'
import { useSignOut } from '@/lib/auth/signOut'

export default function SignOutLink({ disabled = false }: {
  /** True while the host screen is mid-action, so the escape cannot fire
   *  underneath an in-flight permission prompt or plan save. */
  disabled?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const signOut = useSignOut()
  const blocked = disabled || busy

  return (
    <button
      onClick={async () => {
        if (blocked) return
        setBusy(true)
        // The sequence AND the navigation belong to lib/auth/signOut.ts.
        // ⚠️ It must be a ROUTE CHANGE, not window.location — on iOS a
        // full-document load to a path outside `server.url`'s /dashboard
        // prefix is handed to Safari. See that file.
        await signOut()
      }}
      disabled={blocked}
      style={{
        width: '100%', background: 'none', border: 'none',
        // 44px is the iOS HIG minimum. The hand-rolled original used 40.
        padding: '12px 0', minHeight: '44px',
        // Separation, not decoration. On Connect Runs this link sits directly
        // under the screen's own "Not now →" skip, and at 375px the two read as
        // a pair of near-identical muted links — one skips a step, the other
        // ends the session, on the one onboarding screen where the user already
        // HAS a plan to lose. Caught on /onboarding-preview; no test sees this.
        // A rule would be a decorative divider (banned), so it is space.
        marginTop: 'var(--space-2)',
        fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)',
        // A disabled control must look unavailable. `cursor` alone changed
        // nothing a user could see.
        opacity: blocked ? 0.4 : 1,
        cursor: blocked ? 'default' : 'pointer',
      }}
    >
      {busy ? 'Signing out…' : 'Not you? Sign out'}
    </button>
  )
}
