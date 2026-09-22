// LOCAL DESIGN HARNESS — 404s in production (see the guard below), not linked
// from anywhere, not in the sitemap.
//
// ⚠️ WHY THIS EXISTS. The setup wizard is the longest flow in the product — 15
// steps on free, 18 on paid — and it lives inside `DashboardClient` behind auth,
// so the only way to SEE it was to make a new account and walk it. The Design
// Board was asked to rule on whether its inputs are modern, correctly typed and
// bug-free; "no bugs in them" is a measurement, and nobody could take it.
//
// This repo's record is that a fixture page for an auth-gated surface finds
// defects no test can reach: ONBOARD-EXIT-01 (sign-out was unreachable during
// onboarding) and PROFILE-NAME-01 (the founder's own name shipped as the
// placeholder) were both found this way, and both were invisible to the suite.
//
// ⚠️ WHAT IS REAL AND WHAT IS NOT. The wizard component is the REAL one, with
// the real step sequence, the real controls and the real validation. What is
// stubbed is only what sits OUTSIDE it: the callbacks that would write to
// Supabase, and the tier. Generation at the end calls `/api/generate-plan`,
// which needs a session — so the flow is reviewable up to the point of
// submission and not beyond. That boundary is stated on the page itself rather
// than discovered by whoever clicks it.

'use client'

import { useState } from 'react'
import { notFound } from 'next/navigation'
import GeneratePlanScreen from '@/app/dashboard/GeneratePlanScreen'

export default function WizardPreview() {
  // Never reachable in production. NODE_ENV is inlined at build time, so this
  // is a compile-time branch, not a runtime check someone can flip.
  if (process.env.NODE_ENV === 'production') notFound()

  // The three axes that change the flow. Tier changes the step COUNT (paid adds
  // hard-sessions, terrain, injuries); onboarding changes the first step's
  // framing; an existing plan changes the exit.
  const [paid, setPaid] = useState(true)
  const [onboarding, setOnboarding] = useState(false)
  const [existing, setExisting] = useState(false)
  const [units, setUnits] = useState<'km' | 'mi'>('km')
  const [nonce, setNonce] = useState(0)   // remount to restart the flow

  const restart = () => setNonce(n => n + 1)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--card)', borderBottom: '1px solid var(--line)',
        padding: '10px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
        fontFamily: 'var(--font-ui)', fontSize: 13,
      }}>
        <strong style={{ marginRight: 4 }}>Wizard harness</strong>
        <Toggle on={paid} label={paid ? 'PAID (18 steps)' : 'FREE (15 steps)'} onClick={() => { setPaid(p => !p); restart() }} />
        <Toggle on={onboarding} label={onboarding ? 'onboarding' : 'returning'} onClick={() => { setOnboarding(o => !o); restart() }} />
        <Toggle on={existing} label={existing ? 'has a plan' : 'no plan'} onClick={() => { setExisting(e => !e); restart() }} />
        <Toggle on={units === 'mi'} label={units} onClick={() => { setUnits(u => (u === 'km' ? 'mi' : 'km')); restart() }} />
        <button onClick={restart} style={{
          marginLeft: 'auto', border: '1px solid var(--line)', background: 'var(--bg-soft)',
          borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13,
        }}>Restart</button>
      </div>

      <p style={{
        margin: 0, padding: '8px 16px', fontFamily: 'var(--font-ui)', fontSize: 12,
        color: 'var(--mute)', background: 'var(--bg-soft)', borderBottom: '1px solid var(--line)',
      }}>
        The real component, the real steps, the real validation. Only the save callbacks are
        stubbed. <strong>Generation needs a session</strong>, so the last step will not produce a
        plan here — everything before it is honest.
      </p>

      <div key={`${nonce}-${paid}-${onboarding}-${existing}-${units}`}>
        <GeneratePlanScreen
          onBack={() => { /* harness: no router to go back to */ }}
          hasPaidAccess={paid}
          isOnboarding={onboarding}
          hasExistingPlan={existing}
          preferredUnits={units}
          firstName="Alex"
          restingHR={52}
          maxHR={185}
          maxHrSource="observed"
          birthYear={null}
          onBirthYearSave={async () => {}}
          onPlanSaved={async () => {}}
          onPlanEnriched={async () => {}}
          onUpgrade={() => {}}
        />
      </div>
    </div>
  )
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      border: `1px solid ${on ? 'var(--moss)' : 'var(--line)'}`,
      background: on ? 'var(--moss)' : 'var(--card)',
      color: on ? 'var(--on-ground)' : 'var(--ink-2)',
      borderRadius: 999, padding: '5px 11px', cursor: 'pointer',
      fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
    }}>{label}</button>
  )
}
