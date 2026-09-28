// LOCAL DESIGN HARNESS — 404s in production (see the guard below), not linked
// from anywhere, not in the sitemap.
//
// Exists because the Me screen's identity card and profile form sit behind
// auth, a plan, and a tab: the only way to SEE the missing-name state was to
// be signed in as an account that had one. That is exactly how the founder's
// own first and last name shipped as the placeholders and read, on a test
// account, as data the app already held.
//
// Renders the real components with fixture props. If you change IdentityCard
// (PROFILE-IDENTITY-01 retired the separate profile form), check this page.

'use client'

import { useState } from 'react'
import { notFound } from 'next/navigation'
import { IdentityCard } from '@/components/shared/IdentityCard'

const CASES: {
  title: string
  note: string
  initials: string
  firstName: string
  lastName: string
  tierLabel: string
}[] = [
  {
    title: 'No name — the state this page exists for',
    note: 'The field itself, empty, with the instruction as its placeholder. Tap it and type: there is nowhere else to go and no button to press.',
    initials: 'T', firstName: '', lastName: '', tierLabel: 'Trial',
  },
  {
    title: 'No name, no plan — avatar falls back to the email',
    note: 'Every earlier source is empty here. The circle used to render blank: plan.meta.athlete is an empty STRING, so the old ?? fallback never fired.',
    initials: 'R', firstName: '', lastName: '', tierLabel: 'Free',
  },
  {
    title: 'First name only',
    note: 'What an email signup now produces. One initial, and the name is editable in place.',
    initials: 'R', firstName: 'Russell', lastName: '', tierLabel: 'Pro',
  },
  {
    title: 'Full name',
    note: 'The Google / Apple path, unchanged.',
    initials: 'R', firstName: 'Russell', lastName: 'Shear', tierLabel: 'Pro',
  },
  {
    title: 'Long name — overflow',
    note: 'Both lines ellipsis rather than wrapping the card taller.',
    initials: 'A', firstName: 'Alexandrina', lastName: 'Featherstonehaugh-Cholmondeley', tierLabel: 'Trial',
  },
]

export default function MePreviewPage() {
  // Never reachable in production. NODE_ENV is inlined at build time, so this
  // is dead-stripped.
  if (process.env.NODE_ENV === 'production') notFound()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '28px 16px 64px', fontFamily: 'var(--font-ui)' }}>
      <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>
        Me screen — identity + profile
      </h1>
      <p style={{ fontSize: '12px', color: 'var(--mute)', lineHeight: 1.6, margin: '0 0 24px', maxWidth: '420px' }}>
        Real components, fixture props. Dev only.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '420px' }}>
        {CASES.map(c => (
          <div key={c.title} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              {c.title}
            </div>
            <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: '10px' }}>
              <IdentityCard
                initials={c.initials}
                firstName={c.firstName}
                tierLabel={c.tierLabel}
                onSaveName={async (n) => { setFirstName(n); return true }}
              />
            </div>
            <p style={{ fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, margin: '10px 0 0' }}>{c.note}</p>
          </div>
        ))}

        {/* PROFILE-IDENTITY-01 — the live card, including the state nobody could see
            before: a SAVE THAT FAILS. Wroblewski made the error path a blocking
            condition precisely because an inline field has no button to press again, so
            it is the state most likely to be inherited rather than designed. */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
            Inline edit — live, and the save always FAILS
          </div>
          <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: '10px' }}>
            <IdentityCard
              initials={(firstName.trim()[0] ?? '?').toUpperCase()}
              firstName={firstName}
              tierLabel="Pro"
              onSaveName={async () => false}
            />
          </div>
          <p style={{ fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, margin: '10px 0 0' }}>
            Type a name and blur. The value reverts and the sub-line says so — the runner is
            never left looking at a name we do not hold.
          </p>
        </div>
      </div>
    </main>
  )
}
