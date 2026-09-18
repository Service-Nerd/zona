import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ONBOARD-SKIP-LABEL-01 — the gate behind the two onboarding ceremony screens.
//
// WHY THIS EXISTS. ConnectRunsScreen and PushOnboardingScreen each ran ONE busy
// flag for two mutually exclusive actions (connect and skip), and bound the
// PRIMARY button's label to that flag: `{busy ? 'Connecting…' : ...}`. So tapping
// "Connect later" set busy = true and the primary button announced "Connecting…"
// — a lie told for the duration of one tap, at the exact moment a beginner is
// deciding whether to trust the app. The database was always correct; only the
// label lied.
//
// The two screens are internal to a 12k-line client component and cannot be
// rendered standalone, so this walks the source: a "working" primary label must
// key on WHICH action is pending (an equality check), never on a bare truthy
// flag. Same walk-the-source mechanism as lib/auth/signOutOwner.test.ts. (Lives
// under lib/ because the vitest config includes lib/** and components/**, not
// app/**.)

const SRC = readFileSync(join(process.cwd(), 'app/dashboard/DashboardClient.tsx'), 'utf8')

describe('onboarding primary labels key on the specific action, not a bare flag', () => {
  it('finds the two ceremony screens (the walk is not vacuous)', () => {
    expect(SRC).toContain('function ConnectRunsScreen')
    expect(SRC).toContain('function PushOnboardingScreen')
  })

  it('"Connecting…" shows only while the CONNECT action runs', () => {
    expect(SRC, `"Connecting…" must be guarded by === 'connect'`)
      .toMatch(/pending === 'connect' \? 'Connecting…'/)
  })

  it('"Setting up…" shows only while the ENABLE action runs', () => {
    expect(SRC, `"Setting up…" must be guarded by === 'enable'`)
      .toMatch(/pending === 'enable' \? 'Setting up…'/)
  })

  it('no working label is bound to a bare truthy flag (the ONBOARD-SKIP-LABEL-01 bug)', () => {
    // The defect shape: `{busy ? 'Connecting…'` / `{pending ? 'Setting up…'` — a
    // primary "working" label that fires for ANY pending action, including skip.
    for (const label of ['Connecting…', 'Setting up…']) {
      const bad = new RegExp(`\\b(busy|pending)\\s*\\?\\s*'${label}'`)
      expect(SRC, `"${label}" is bound to a bare pending flag — it will show on skip too`)
        .not.toMatch(bad)
    }
  })
})
