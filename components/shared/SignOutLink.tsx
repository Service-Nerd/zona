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
// three copies, the deload cadence five). One owner now.
//
// ⚠️ NOT the "Careful Now" treatment. `ui-patterns.md` § SectionLabel groups
// sign-out with account deletion, which is right on Me — a considered action
// among your settings — and wrong here. A destructive-group heading on a screen
// whose job is to welcome someone builds an ejector seat. This is a quiet text
// link, secondary to whatever the screen's real secondary action is.

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { clearWidgetState } from '@/lib/native/sharedStore'

export default function SignOutLink({ disabled = false }: {
  /** True while the host screen is mid-action, so the escape cannot fire
   *  underneath an in-flight permission prompt or plan save. */
  disabled?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const blocked = disabled || busy

  return (
    <button
      onClick={async () => {
        if (blocked) return
        setBusy(true)
        try {
          // Clear the App-Group store BEFORE the session goes: the widget reads
          // race countdown and today's session from it, and a stale one outlives
          // the account that wrote it.
          await clearWidgetState().catch(() => {})
          await createClient().auth.signOut()
        } finally {
          // Hard navigation, not router.replace. The auth cookie write can race
          // a soft nav — the same reason the login screen navigates this way
          // after a successful sign-in.
          window.location.href = '/auth/login'
        }
      }}
      disabled={blocked}
      style={{
        width: '100%', background: 'none', border: 'none',
        // 44px is the iOS HIG minimum. The hand-rolled original used 40.
        padding: '12px 0', minHeight: '44px',
        fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)',
        cursor: blocked ? 'default' : 'pointer',
      }}
    >
      {busy ? 'Signing out…' : 'Not you? Sign out'}
    </button>
  )
}
